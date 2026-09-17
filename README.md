# Glue Flip

A physics game about one object and one gesture: pick a glue stick off a desk, flick
it so it turns once in the air, and land it perfectly upright on its base.

Everything that decides the outcome is simulated. The stick has a real mass
distribution, a real inertia tensor, real friction and restitution against the
surface it lands on; the throw is measured from the actual motion of your pointer;
the landing tier is computed from the angle the stick really came to rest at. There
is no scripted animation of a "good" throw and no hidden aim assist — the same
gesture produces the same flight, plus a few percent of hand noise.

---

## Running it

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # type-check + production bundle in dist/
npm run preview    # serve the production build
npm test           # 192 tests, including the real physics engine
npm run typecheck
npm run smoke      # imports every module: catches bad imports / load-time throws
```

Requirements: Node 18+ and a WebGL2 browser. No backend, no accounts — progress is
stored in `localStorage`.

## Controls

| | Desktop | Touch |
| --- | --- | --- |
| Grab / throw | Press on the stick, drag, release | Same, with haptics on grab, release and landing |
| Camera | Drag on empty space to orbit, wheel to zoom | One-finger drag to orbit, pinch to zoom |
| Retry | `R` | Retry button |
| Pause | `Esc` | Pause button |
| Debug overlay | `F1` | Settings → Debug |
| Cycle stick / surface (Open Mode) | `V` / `C` | Buttons in the HUD |

The throw is *not* a button. While you hold the stick it is driven kinematically by
the pointer, and the last ~75 ms of its world-space motion are fitted with a
least-squares line to get the release velocity. Flick harder to send it further,
flick more upward to make it arc, and curve the pointer around the stick to add
roll.

## Modes

- **Classic** — streak, score and combo. Each level moves the target further away
  (0.30 → 0.95 m), shrinks the landing zone, and from level 6 adds obstacles; every
  4 levels the surface changes (walnut, rubber, stone, paper…), which changes the
  friction and bounce you are landing on.
- **Challenges** — 12 hand-authored setups: long distance, small zone, slippery
  glass, a raised platform, obstacles, limited attempts.
- **Open Mode** — no score, no timer. Swap the stick and the surface and see what
  the physics does.

Landing tiers come straight from the final orientation: **PERFECT** (≤ 5° from
vertical), **LANDING** (≤ 14°), **FAILED** (anything else, cap-down, or off the
desk).

---

## How the simulation works

The interesting part of this project is not the rendering, so here is what actually
happens between the flick and the result.

**Fixed-step physics.** Rapier runs at a fixed 1/120 s with an accumulator, up to 8
substeps per frame, and the renderer interpolates between the last two states
(`sync(alpha)`). Frame-rate never changes the outcome: two runs of the same gesture
produce bit-identical trajectories (there is a test for that).

**The body.** The stick is a single flat-capped cylinder collider carrying
*analytically derived* mass properties. `solveStickMassProperties()` splits the
cylinder into a dense lower section (the twist mechanism) and a light upper one
(glue + cap), solves the two densities that reproduce the design mass **and** the
design centre of mass, then integrates the inertia tensor of that composite with
the parallel-axis theorem. The result is handed to Rapier with
`setMassProperties`, so `body.mass()`, `worldCom()` and the inertia all match the
variant to float precision — verified per variant in the tests.

Two details here were load-bearing and are covered by tests:

- *A cylinder, not a convex hull.* An earlier version built the collider from two
  stacked convex-hull prisms. The mass maths was right, but hull prisms produce
  poor contact manifolds along their polygon edges: the stick toppled on landing
  even when dropped from 4 cm, while the analytic cylinder lands and stays. 
- *Proportions.* Landing tolerance is set by the base diameter relative to the
  height. A tall, thin stick is destroyed by the friction impulse of its own
  landing (the base grips, and the impulse at the rim reverses the spin). The
  variants therefore use chunky "jumbo craft" proportions — the wide, low stick
  self-rights, and that is what makes an upright landing physically achievable.

**The throw.** Gesture → release velocity (`speedGain`), then two directional
assists: a lift bias that grows with speed (ballistic distance grows with the
square of the speed, so without it a firm flick sails off the desk — the assist
turns speed into height instead) and a small forward assist along the camera axis.
The assists rotate the *direction*, so the release speed stays inside the cap. The
flip is one rotation over the predicted flight time, computed from the gap under
the **base** (not under the centre) — a subtle difference worth ~10° of landing
phase. A "curl" in the pointer path adds roll about the camera forward axis,
measured as the summed turning angle between consecutive segments so that a
straight flick contributes nothing.

**Resting friction.** A solver has no rolling resistance, so a stick that lands on
its side rolls for seconds. While a contact is fresh and the body is nearly at
rest, both the spin and the horizontal slide are damped — which is what static
friction actually does to a light object on a desk. Killing only the spin is not
enough: the remaining linear momentum spins it straight back up.

**Landing.** `evaluateLanding` reads the real orientation, the height of the base
above the surface, the vertical span of the stick (to reject a stick lying on its
side that happens to be near the target height) and whether it is inside the zone.

The tuning is not guesswork — `tests/physics.test.ts` sweeps flick strength through
the whole pipeline (gesture → resolver → Rapier → landing evaluation) and asserts
the resulting difficulty gradient: a comfortable flick lands ~8/8 times, the same
flick at the far end of the Classic range lands about half the time, and a slam
never lands.

## Configuration

Every constant lives in `src/config/`, typed and commented — nothing is hard-coded
in gameplay code:

| File | Contents |
| --- | --- |
| `physics.ts` | timestep, substeps, damping, CCD, contact skin, resting-friction model, settle thresholds |
| `glueSticks.ts` | 4 variants: height, radius, mass, centre-of-mass ratio, friction, restitution, materials |
| `throw.ts` | gesture → velocity mapping, flip model, curl, hand noise, natural variation |
| `surfaces.ts` | 7 surfaces with friction/restitution and their audio voice |
| `gameplay.ts` | landing tiers, scoring, combo, classic progression |
| `challenges.ts` | the 12 challenge setups |
| `camera.ts` | framing, follow behaviour, cinematic staging |
| `quality.ts` | low/medium/high/ultra presets (DPR, shadow map, dust, env size, frame budget) |
| `world.ts` | desk, floor, spawn, play area |

## Architecture

61 source files, ~11.5k lines, largest file 683 lines. Rendering, physics,
gameplay, input, camera, audio, UI and data are separate layers wired together
through one `GameContext` (dependency injection) and a typed `EventBus`; nothing
reaches across layers directly.

```
src/
  main.ts            boot: canvas, fatal-error surface, GameApp
  app.ts             composition root: builds the single GameContext, owns the loop
  config/            all tunable constants (see above)
  core/              Engine (renderer/scene/clock), EventBus, SaveManager
  physics/           PhysicsWorld (Rapier wrapper), GlueStickBody, geometry, TrajectorySimulator
  gameplay/          GameController (state machine), ThrowGesture, LandingEvaluator,
                     ScoreSystem, ProgressionSystem, modes, GameEvents, GameContext
  objects/           GlueStickMesh/Entity, DeskScene, props, SurfacePad, TargetZone, Obstacles
  render/            MaterialLibrary, ProceduralTextures, PostFX, ContactShadow, ThrowGuide
  camera/            CameraRig (prep/follow/cinematic), CinematicDirector
  input/             InputManager (pointer/touch/keys), CameraControls
  audio/             AudioEngine — procedural WebAudio, no samples
  ui/                Screen base class, UIManager, 6 screens, 4 stylesheets
  debug/             DebugOverlay: colliders, COM, velocities, trajectory, raycasts
  utils/             math, random (seeded), platform (haptics/touch), dom, logger
```

The visual style is photoreal-minimal: a real desk scene with procedural wood,
paper, ceramic and fabric materials, an image-based environment, a contact shadow
under the stick, and a shallow-depth-of-field pass on landing. Audio is fully
synthesised (impact voices per surface, filtered by impact speed, plus a light room
ambience) so there are no asset files to ship.

## Settings, accessibility, performance

The settings menu (saved locally) covers interface language, master/SFX/ambience
volume, graphics quality, camera and throw sensitivity, invert-Y, haptics, the
throw guide and screen shake.

**Languages** — the interface ships in French and English. The first run picks the
browser language; the picker in Settings switches it live, every screen rebuilds
itself in place, and the choice is stored in the save. `src/ui/i18n.ts` holds both
dictionaries, with English as the source of truth: `FR` is typed
`Record<keyof typeof EN, string>`, so a missing translation is a build error, and
`tests/i18n.test.ts` additionally pins runtime parity plus a translated name for
every stick, surface and challenge.

**Auto-restart and chaining** — the menu is deliberately one big action (Play)
with three secondary ones, and in every mode the stick resets itself after each
throw: 0.85 s on a success (`FEEDBACK.chainResetTime`) so a session is a
continuous run of flicks, and 1.25 s on a miss (`FEEDBACK.failResetTime`) so the
verdict has time to be read. A "press R" hint appears once per session.

In Classic and Challenges, a miss also washes a red vignette over the screen
(`FEEDBACK.failFlash`) before the reset. Open Mode is a sandbox, so it never
flashes — the verdict is enough there. "Reduce motion" gets a softer vignette
rather than none, and high contrast gets a stronger one.

Accessibility, in its own section:

- **High contrast** — swaps the whole design-token set (opaque panels, white text,
  stronger borders) via a `data-contrast` attribute on the root, so every screen
  picks it up without per-component work.
- **Text size** — S/M/L/XL scales the entire interface through a `--gf-text-scale`
  custom property; all 40 font sizes in the stylesheets are expressed against it.
- **Reduce motion** — softens camera moves and shortens the slow-motion staging;
  `prefers-reduced-motion` is honoured by default and OR'd with the setting.
- **Performance mode** — pins the lowest quality preset regardless of the chosen
  one.

Quality presets cap the device pixel ratio (1 → 2.5), shadow-map resolution, dust
count and environment size, and the loop degrades substeps when the frame budget is
missed. Portrait and landscape layouts are handled down to 520 px.

Debug tools (`F1`, or from Settings) draw Rapier's collider wireframe, a marker at
the centre of mass, the velocity and angular-velocity vectors, the predicted
trajectory of the throw being aimed at, and the two raycasts the gameplay uses (the
camera grab ray and the vertical landing ray, with the hit distance and collider
tag). A telemetry panel shows phase, FPS, frame time, resolution scale, draw calls,
time scale, position, speed, spin, tilt, mass and COM offset. The logger that feeds
it is silenced in production builds.

## Tests

```
tests/
  helpers/         real Rapier world + desk + one stick; gesture sample generator
  physics.test.ts  19 integration tests on the real simulation
  throwGesture.test.ts, landingEvaluator.test.ts, scoreSystem.test.ts,
  progression.test.ts, save.test.ts, smoke.test.ts,
  i18n.test.ts (translation parity), easterEggs.test.ts (secret triggers),
  modeStats.test.ts (lifetime stats per mode),
  autoRestart.test.ts (reset timing, miss-flash rules),
  hudDom.test.ts (real DOM: flash, translated verdict, menu)
```

Rapier's WASM build runs in Node, so the physics tests exercise the shipped
simulation rather than a model of it: mass and centre of mass per variant, collider
shape, determinism, no tunnelling, settle behaviour, contact events, raycasts, the
landing-window sweep and the difficulty gradient.

## Easter eggs

Eight secrets are hidden in the game — a Konami code, a magic word, a low-gravity
mode, two unlockable pieces of hidden content (a golden stick, a velvet surface), a
patience assist, a lost-and-found comment, a late-night message and a credits card.
Five of them are written to the save and stay unlocked forever.

**[EASTER_EGGS.md](EASTER_EGGS.md)** lists every one of them with its exact trigger,
its effect and whether it persists. The triggers live in
`src/gameplay/EasterEggSystem.ts`, which is pure and fully unit-tested
(`tests/easterEggs.test.ts`), so the secrets cannot silently stop working.

## Notes and limitations

- Verification here was `tsc --noEmit`, the test suite (which runs the real physics
  engine and, in `tests/hudDom.test.ts`, a real jsdom DOM), `vite build`, and the
  dev server serving the module graph. There is no headless *browser* in this
  environment, so the WebGL rendering itself is still not exercised by an
  automated test — the DOM above it now is.
- The HMR websocket may not connect through a reverse proxy; reloads still work.
- The Rapier bundle is ~2.2 MB (830 KB gzipped) because the WASM payload is
  inlined; it is split into its own chunk and loaded once at boot.

## License

MIT
