import type { QualityLevel } from '@/config/quality';
import { getPreset } from '@/config/quality';
import { CHALLENGES, getChallenge } from '@/config/challenges';
import { WORLD } from '@/config/world';
import { Engine } from '@/core/Engine';
import { EventBus } from '@/core/EventBus';
import { SaveManager } from '@/core/SaveManager';
import type { Settings } from '@/core/SaveManager';
import { MaterialLibrary } from '@/render/MaterialLibrary';
import { DeskScene } from '@/objects/DeskScene';
import { PhysicsWorld } from '@/physics/PhysicsWorld';
import { InputManager } from '@/input/InputManager';
import type { PointerState } from '@/input/InputManager';
import { CameraControls } from '@/input/CameraControls';
import { CameraRig } from '@/camera/CameraRig';
import { CinematicDirector } from '@/camera/CinematicDirector';
import { AudioEngine } from '@/audio/AudioEngine';
import { GameController } from '@/gameplay/GameController';
import type { GameContext } from '@/gameplay/GameContext';
import type { GameEvents } from '@/gameplay/GameEvents';
import { ClassicMode, ChallengeMode, OpenMode } from '@/gameplay/modes';
import type { GameMode, HudState } from '@/gameplay/modes';
import { UIManager } from '@/ui/UIManager';
import { DebugOverlay } from '@/debug/DebugOverlay';
import { prefersReducedMotion } from '@/utils/platform';
import { createLogger } from '@/utils/logger';

const log = createLogger('app');

export type ProgressCallback = (progress: number, label?: string) => void;

interface AppSystems {
  canvas: HTMLCanvasElement;
  engine: Engine;
  physics: PhysicsWorld;
  materials: MaterialLibrary;
  scene: DeskScene;
  audio: AudioEngine;
  events: EventBus<GameEvents>;
  input: InputManager;
  rig: CameraRig;
  cameraControls: CameraControls;
  director: CinematicDirector;
  controller: GameController;
  debug: DebugOverlay;
  ui: UIManager;
  save: SaveManager;
  context: GameContext;
}

/**
 * Application orchestrator.
 *
 * Boots every subsystem in a deliberate order (renderer → physics → content →
 * UI), wires the event flow between them and runs the frame loop. Nothing else
 * in the codebase needs to know about the whole system, which is what keeps the
 * modules independent.
 */
export class GameApp {
  readonly engine: Engine;
  readonly physics: PhysicsWorld;
  readonly materials: MaterialLibrary;
  readonly audio: AudioEngine;
  readonly save: SaveManager;
  readonly events: EventBus<GameEvents>;
  readonly ui: UIManager;

  private systems: AppSystems;
  private scene: DeskScene;
  private input: InputManager;
  private rig: CameraRig;
  private cameraControls: CameraControls;
  private director: CinematicDirector;
  private controller: GameController;
  private debug: DebugOverlay;

  private mode: GameMode;
  private classicMode: ClassicMode;
  private openMode: OpenMode;
  private challengeMode: ChallengeMode | null = null;

  private paused = false;
  private holding = false;
  private holdingPointerId: number | null = null;
  private menuDrift = true;
  private hudState: HudState | null = null;
  private audioArmed = false;
  private disposed = false;

  private constructor(systems: AppSystems) {
    this.systems = systems;
    this.engine = systems.engine;
    this.physics = systems.physics;
    this.materials = systems.materials;
    this.scene = systems.scene;
    this.audio = systems.audio;
    this.events = systems.events;
    this.input = systems.input;
    this.rig = systems.rig;
    this.cameraControls = systems.cameraControls;
    this.director = systems.director;
    this.controller = systems.controller;
    this.debug = systems.debug;
    this.ui = systems.ui;
    this.save = systems.save;

    this.classicMode = new ClassicMode(systems.context);
    this.openMode = new OpenMode(systems.context);
    this.mode = this.classicMode;

    this.wireEvents();
    this.wireInput();
    this.applySettings(this.save.settings);
    this.debug.attach(this.controller);
    this.debug.setEnabled(this.save.settings.showDebug);
  }

  /** Boots the game, reporting progress so the loading bar is honest. */
  static async boot(
    canvas: HTMLCanvasElement,
    onProgress: ProgressCallback = () => undefined,
  ): Promise<GameApp> {
    onProgress(0.05, 'Renderer');
    const save = new SaveManager();
    const engine = new Engine({
      canvas,
      quality: save.settings.quality === 'auto' ? undefined : save.settings.quality,
    });

    onProgress(0.25, 'Physics');
    const physics = await PhysicsWorld.create();

    onProgress(0.42, 'Materials');
    const materials = new MaterialLibrary(getPreset(engine.quality).textureScale);

    onProgress(0.6, 'Environment');
    const scene = new DeskScene(materials, engine.currentPreset);
    engine.scene.add(scene.group);
    scene.createColliders(physics);

    onProgress(0.74, 'Camera & input');
    const input = new InputManager(canvas);
    const rig = new CameraRig(engine.camera);
    const cameraControls = new CameraControls(rig);
    const director = new CinematicDirector(rig, prefersReducedMotion());
    const audio = new AudioEngine();
    const events = new EventBus<GameEvents>();

    const context: GameContext = {
      physics,
      engine,
      materials,
      audio,
      input,
      rig,
      director,
      events,
      save,
      settings: () => save.settings,
    };

    onProgress(0.86, 'Interface');
    // `app` is assigned right after construction; the callbacks are invoked long
    // after boot, so the closure is always populated by then.
    let app: GameApp | null = null;
    const ui = new UIManager(document.getElementById('ui') ?? createUiRoot(), save, {
      onPlay: () => app?.startClassic(),
      onChallenges: () => app?.ui.showChallenges(),
      onOpenMode: () => app?.startOpen(),
      onSettings: () => app?.openSettings(),
      onCloseScreen: () => app?.closeOverlay(),
      onResume: () => app?.resume(),
      onRestart: () => app?.restart(),
      onMenu: () => app?.toMenu(),
      onPause: () => app?.pause(),
      onSelectChallenge: (id) => app?.startChallenge(id),
      onSelectStick: (id) => app?.selectStick(id),
      onSettingChange: (key, value) => app?.onSettingChange(key, value),
      onResetProgress: () => app?.resetProgress(),
      onHover: () => app?.audio.uiHover(),
    });

    onProgress(0.94, 'Gameplay');
    const controller = new GameController(context, {
      surfaceId: 'wood',
      zoneCenter: [WORLD.spawn.x, WORLD.spawn.z - 0.4],
      zoneRadius: 0.24,
      obstacles: [],
    });
    engine.scene.add(controller.group);

    const debug = new DebugOverlay(engine, physics, ui);

    app = new GameApp({
      canvas,
      engine,
      physics,
      materials,
      scene,
      audio,
      events,
      input,
      rig,
      cameraControls,
      director,
      controller,
      debug,
      ui,
      save,
      context,
    });

    onProgress(1, 'Ready');
    log.info('boot complete', { quality: engine.quality });
    return app;
  }

  // --- Lifecycle ---------------------------------------------------------

  start(): void {
    this.engine.start((frame) => this.tick(frame));
    this.ui.showMenu();
    this.armAudio();
    log.info('started');
  }

  private tick(frame: {
    dt: number;
    rawDt: number;
    elapsed: number;
    fps: number;
    resolutionScale: number;
  }): void {
    if (this.disposed) return;
    const { dt, rawDt, elapsed } = frame;

    if (!this.paused) {
      this.controller.update(dt, rawDt, elapsed);
      this.scene.update(dt, elapsed);
      if (this.menuDrift) this.rig.applyMenuDrift(elapsed);
      this.save.addPlayTime(rawDt * 1000);
    }

    // The camera always runs on real time so slow motion never feels laggy.
    this.rig.update(rawDt);

    this.debug.update(rawDt, {
      phase: this.controller.phase,
      fps: frame.fps,
      frameMs: this.engine.stats.frameMs,
      resolutionScale: frame.resolutionScale,
      drawCalls: this.engine.stats.drawCalls,
      timeScale: this.engine.timeScale,
    });
  }

  // --- Mode switching ----------------------------------------------------

  startClassic(): void {
    this.mode = this.classicMode;
    this.mode.start(this.controller);
    this.enterGame();
  }

  startOpen(): void {
    this.mode = this.openMode;
    this.mode.start(this.controller);
    this.enterGame();
    this.ui.toast('C: surface · V: stick', 'info');
  }

  startChallenge(id: string): void {
    const challenge = getChallenge(id);
    if (!challenge) {
      this.ui.toast('Challenge unavailable', 'bad');
      return;
    }
    this.challengeMode = new ChallengeMode(this.systems.context, challenge);
    this.mode = this.challengeMode;
    this.mode.start(this.controller);
    this.enterGame();
  }

  private enterGame(): void {
    this.menuDrift = false;
    this.paused = false;
    this.engine.timeScale = 1;
    this.ui.showHud();
    this.ui.setHint(this.hintForMode());
    this.refreshHud(true);
    void this.audio.resume();
  }

  toMenu(): void {
    this.paused = false;
    this.menuDrift = true;
    this.engine.timeScale = 1;
    this.director.reset();
    this.rig.setFollow(null, 0);
    this.rig.setZoomBias(1);
    this.controller.autoReset = true;
    this.controller.prepare();
    this.mode.stop();
    this.ui.showMenu();
  }

  restart(): void {
    this.ui.hidePause();
    this.ui.hideResult();
    this.paused = false;
    this.mode.start(this.controller);
    this.enterGame();
  }

  pause(): void {
    if (this.ui.currentScreen !== 'hud') return;
    this.paused = true;
    this.engine.timeScale = 1;
    this.audio.stopAir();
    if (this.holding) {
      this.holding = false;
      this.holdingPointerId = null;
      this.cameraControls.enabled = true;
      this.ui.setPower(null);
      this.controller.prepare();
    }
    this.ui.showPause(this.summaryText());
  }

  resume(): void {
    this.paused = false;
    this.ui.hidePause();
    void this.audio.resume();
  }

  private summaryText(): string {
    const state = this.hudState ?? this.mode.hud();
    return `Score ${state.score} · combo ${state.combo} · ${state.objective}`;
  }

  private openSettings(): void {
    this.ui.showSettings(this.ui.currentScreen === 'pause' ? 'pause' : 'menu');
  }

  private closeOverlay(): void {
    switch (this.ui.currentScreen) {
      case 'challenges':
        this.ui.showMenu();
        break;
      case 'settings':
        this.ui.hideSettings();
        break;
      case 'result':
        this.ui.hideResult();
        this.toMenu();
        break;
      case 'pause':
        this.resume();
        break;
      default:
        this.ui.showMenu();
        break;
    }
  }

  // --- Events ------------------------------------------------------------

  private wireEvents(): void {
    this.events.on('throw:hold', ({ power, rotations }) => this.ui.setPower(power, rotations));
    this.events.on('throw:grabbed', () => {
      this.ui.setPower(0, 0);
      this.ui.setHint(null);
    });
    this.events.on('throw:released', () => this.ui.setPower(null));

    this.events.on('phase:change', ({ phase }) => {
      if (phase === 'idle') {
        this.ui.setHint(this.hintForMode());
        this.cameraControls.enabled = true;
        this.rig.setFollow(null, 0);
        if (!this.menuDrift) this.rig.setMode('free');
      }
      if (phase === 'flight') this.cameraControls.enabled = false;
      this.refreshHud();
    });

    this.events.on('landing:evaluated', ({ result }) => this.mode.onLanding(result));

    this.events.on('landing:result', ({ result, breakdown }) => {
      this.ui.showLanding(result, breakdown);
      this.refreshHud(true);
    });

    this.events.on('score:change', () => this.refreshHud(true));
    this.events.on('level:change', ({ level, note }) => this.ui.toast(`Level ${level} · ${note}`, 'good'));
    this.events.on('challenge:progress', ({ completed, total, attemptsLeft }) => {
      if (attemptsLeft >= 0 && attemptsLeft <= 3) {
        this.ui.toast(`${attemptsLeft} throws left`, attemptsLeft === 1 ? 'bad' : 'info');
      } else {
        this.ui.toast(`${completed} / ${total}`, 'info');
      }
    });
    this.events.on('challenge:complete', ({ rewardText, name }) => {
      const hud = this.mode.hud();
      this.ui.presentResult({
        title: 'Challenge complete',
        note: rewardText ?? `${name} cleared.`,
        summary: [
          { label: 'Score', value: hud.score },
          { label: 'Landings', value: hud.stats.landings },
          { label: 'Perfect', value: hud.stats.perfects },
        ],
        buttons: [
          { label: 'Menu', run: () => this.toMenu() },
          { label: 'Retry', run: () => this.restart() },
          { label: 'Next', primary: true, run: () => this.nextChallenge() },
        ],
      });
    });
    this.events.on('challenge:failed', ({ name }) => {
      const hud = this.mode.hud();
      this.ui.presentResult({
        title: 'Out of throws',
        note: `${name} needs another run.`,
        summary: [
          { label: 'Best', value: hud.bestScore },
          { label: 'Landings', value: hud.stats.landings },
        ],
        buttons: [
          { label: 'Menu', run: () => this.toMenu() },
          { label: 'Retry', primary: true, run: () => this.restart() },
        ],
      });
    });
    this.events.on('run:over', ({ score, bestCombo, landings, perfects, level }) => {
      const best = this.save.all.best.classic;
      this.ui.presentResult({
        title: 'Run over',
        note: score > 0 && score >= best.score ? 'New personal best.' : `Personal best: ${best.score}`,
        summary: [
          { label: 'Score', value: score },
          { label: 'Best combo', value: bestCombo },
          { label: 'Landings', value: landings },
          { label: 'Perfect', value: perfects },
          { label: 'Level', value: level },
        ],
        buttons: [
          { label: 'Menu', run: () => this.toMenu() },
          { label: 'Play again', primary: true, run: () => this.restart() },
        ],
      });
    });
    this.events.on('toast', ({ text, tone }) => this.ui.toast(text, tone ?? 'info'));
  }

  private nextChallenge(): void {
    const current = this.challengeMode?.definition.id;
    const index = CHALLENGES.findIndex((challenge) => challenge.id === current);
    const next = CHALLENGES[(index + 1) % CHALLENGES.length];
    this.startChallenge(next.id);
  }

  private hintForMode(): string {
    if (this.mode.id === 'open') return 'Drag the glue stick · C surface · V stick';
    return 'Drag the glue stick and flick to throw';
  }

  private refreshHud(force = false): void {
    const state = this.mode.hud();
    this.hudState = state;
    if (force || this.ui.currentScreen === 'hud') this.ui.updateHud(state);
  }

  // --- Input -------------------------------------------------------------

  private wireInput(): void {
    this.input.setHandlers({
      onPointerDown: (pointer) => this.handlePointerDown(pointer),
      onPointerMove: (pointer) => this.handlePointerMove(pointer),
      onPointerUp: (pointer) => this.handlePointerUp(pointer),
      onWheel: (delta) => this.cameraControls.handleWheel(delta),
      onPinch: (pinch) => this.cameraControls.handlePinch(pinch.delta),
      onKey: (event) => this.handleKey(event),
    });
  }

  private handlePointerDown(pointer: PointerState): void {
    void this.audio.resume();
    if (this.paused || this.ui.currentScreen !== 'hud') return;

    if (this.controller.tryGrab(pointer)) {
      this.holding = true;
      this.holdingPointerId = pointer.id;
      this.cameraControls.enabled = false;
      return;
    }
    this.cameraControls.handleDown(pointer, this.input.isMultiTouch);
  }

  private handlePointerMove(pointer: PointerState): void {
    if (this.holding && pointer.id === this.holdingPointerId) {
      this.controller.updatePointer(pointer);
      return;
    }
    this.cameraControls.handleMove(pointer, this.input.isMultiTouch);
  }

  private handlePointerUp(pointer: PointerState): void {
    if (this.holding && pointer.id === this.holdingPointerId) {
      this.holding = false;
      this.holdingPointerId = null;
      this.controller.release();
      this.ui.setPower(null);
      window.setTimeout(() => {
        this.cameraControls.enabled = true;
      }, 240);
      return;
    }
    this.cameraControls.handleUp(pointer);
  }

  private handleKey(event: KeyboardEvent): void {
    if (event.repeat) return;
    switch (event.code) {
      case 'Escape':
        event.preventDefault();
        if (this.ui.currentScreen === 'hud') this.pause();
        else if (this.ui.currentScreen === 'pause') this.resume();
        else this.closeOverlay();
        break;
      case 'F1':
        event.preventDefault();
        this.toggleDebug();
        break;
      case 'KeyR':
        if (this.ui.currentScreen === 'hud') this.controller.prepare();
        break;
      case 'KeyC':
        if (this.mode.id === 'open' && this.ui.currentScreen === 'hud') this.openMode.cycleSurface();
        break;
      case 'KeyV':
        if (this.mode.id === 'open' && this.ui.currentScreen === 'hud') this.openMode.cycleStick();
        break;
      default:
        break;
    }
  }

  private toggleDebug(): void {
    const next = !this.save.settings.showDebug;
    this.save.setSetting('showDebug', next);
    this.debug.setEnabled(next);
    this.ui.toast(next ? 'Debug on' : 'Debug off', 'info');
  }

  // --- Settings ----------------------------------------------------------

  private onSettingChange<K extends keyof Settings>(key: K, value: Settings[K]): void {
    this.save.setSetting(key, value);
    this.applySettings(this.save.settings);
    if (key === 'showThrowGuide') this.controller.configure(this.controller.currentSetup);
    if (key === 'quality') this.ui.toast(`Quality: ${this.engine.quality}`, 'info');
  }

  private applySettings(settings: Settings): void {
    this.audio.setVolumes({
      master: settings.masterVolume,
      sfx: settings.sfxVolume,
      ambience: settings.ambienceVolume,
    });
    this.rig.sensitivity = settings.cameraSensitivity;
    this.cameraControls.invertY = settings.invertCameraY;

    const reduceMotion = settings.reducedMotion || prefersReducedMotion();
    this.director.setReducedMotion(reduceMotion);
    this.rig.reducedMotion = reduceMotion;

    // Performance mode pins the cheapest preset regardless of the chosen one.
    this.engine.setQuality(settings.performanceMode ? 'low' : settings.quality);
    this.debug.setEnabled(settings.showDebug);
    this.ui.applyAccessibility(settings);
  }

  private selectStick(id: string): void {
    this.save.update((data) => {
      data.selectedGlueStick = id;
    });
    this.audio.uiClick();
    this.controller.configure(this.controller.currentSetup);
    this.ui.toast('Stick updated', 'info');
  }

  private resetProgress(): void {
    this.save.reset();
    this.applySettings(this.save.settings);
    this.ui.refreshSave();
    this.ui.toast('Progress reset', 'info');
  }

  /** Unlocks the audio context on the first gesture (required by browsers). */
  private armAudio(): void {
    if (this.audioArmed) return;
    this.audioArmed = true;
    const unlock = () => {
      void this.audio.init().then(() => {
        this.applySettings(this.save.settings);
        this.audio.startAmbience();
      });
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.engine.stop();
    this.input.dispose();
    this.controller.dispose();
    this.debug.dispose();
    this.scene.dispose();
    this.materials.dispose();
    this.audio.dispose();
    this.physics.dispose();
    this.ui.dispose();
    this.engine.dispose();
  }
}

function createUiRoot(): HTMLElement {
  const root = document.createElement('div');
  root.id = 'ui';
  document.body.append(root);
  return root;
}
