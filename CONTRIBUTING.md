# 🤝 Contributing · Contribuer

Thanks for wanting to make the stick land even straighter. 🙏

## Setup

```bash
npm install
npm run dev        # play it at http://localhost:5173
npm test           # the whole suite (real Rapier physics + jsdom DOM)
npm run verify     # real headless-Chromium render check (optional, needs npm egress)
npm run typecheck  # strict TS must stay clean
```

## Before you open a PR

- **Keep the physics honest.** If a change touches gameplay, it should be backed by a
  test in `tests/`. The simulation is the point of this project — don't replace real
  behaviour with a scripted fake.
- **No magic numbers.** Every tunable lives in `src/config/`. If you introduce a
  constant, give it a typed, commented home there.
- **Both languages.** Any user-visible string goes through `src/ui/i18n.ts` in *both*
  English and French. `FR` is typed against `EN`, so a missing translation is a build
  error — and `tests/i18n.test.ts` will remind you anyway.
- **Typecheck stays green.** `npm run typecheck` must pass; the build enforces it.
- **Small, readable files.** The codebase is deliberately split into ~60 focused
  modules. Extend an existing layer rather than reaching across layers.

## Commit style

Short imperative subject, e.g. `Let the red miss flash play before the card covers it`.
Explain *why* in the body when the reason isn't obvious.

## What we're unlikely to accept

- Arcade-style juice that breaks the photoreal-minimal look (neon, confetti, screen
  shake by default).
- Anything that adds a backend, account or telemetry — the game is fully local.

Not sure where to start? The [README](README.md) explains the architecture, and the
[easter eggs](EASTER_EGGS.md) are a fun, well-tested place to add a secret. 💛
