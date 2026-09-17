import type { ChallengeDef } from '@/config/challenges';
import { WORLD } from '@/config/world';
import { getSurface } from '@/config/surfaces';
import type { LandingResult } from '@/gameplay/LandingEvaluator';
import { ScoreBoard } from '@/gameplay/ScoreSystem';
import { buildLevel, levelDifficulty } from '@/gameplay/ProgressionSystem';
import type { LevelSpec } from '@/gameplay/ProgressionSystem';
import type { GameController } from '@/gameplay/GameController';
import type { GameContext } from '@/gameplay/GameContext';

/**
 * Game modes.
 *
 * A mode owns *rules*: what to set up, how to score, when a run ends. It never
 * touches rendering or physics directly — it configures the controller and reacts
 * to landing results.
 */

export type ModeId = 'classic' | 'challenge' | 'open';

export interface HudState {
  score: number;
  bestScore: number;
  combo: number;
  bestCombo: number;
  level: number;
  objective: string;
  objectiveVisible: boolean;
  attemptsLeft: number | null;
  scoreVisible: boolean;
  comboVisible: boolean;
  levelVisible: boolean;
  /** Secondary line under the objective (surface, distance…). */
  detail: string;
  /** Session counters shown in Open Mode. */
  stats: { throws: number; landings: number; perfects: number };
}

export interface GameMode {
  readonly id: ModeId;
  readonly label: string;
  start(controller: GameController): void;
  stop(): void;
  onLanding(result: LandingResult): void;
  hud(): HudState;
  /** Optional per-frame hook. */
  update?(dt: number): void;
  /** Optional extra action bound to a UI button (Open Mode surface cycling). */
  action?: { label: string; run: () => void };
}

const emptyHud: HudState = {
  score: 0,
  bestScore: 0,
  combo: 0,
  bestCombo: 0,
  level: 1,
  objective: '',
  objectiveVisible: false,
  attemptsLeft: null,
  scoreVisible: true,
  comboVisible: true,
  levelVisible: true,
  detail: '',
  stats: { throws: 0, landings: 0, perfects: 0 },
};

// ---------------------------------------------------------------------------
// Classic
// ---------------------------------------------------------------------------

export class ClassicMode implements GameMode {
  readonly id = 'classic' as const;
  readonly label = 'Classic';

  private ctx: GameContext;
  private controller: GameController | null = null;
  private board = new ScoreBoard();
  private spec: LevelSpec = buildLevel(1);

  constructor(ctx: GameContext) {
    this.ctx = ctx;
  }

  start(controller: GameController): void {
    this.controller = controller;
    this.board.reset(1);
    controller.autoReset = true;
    this.applyLevel(1);
    this.emitScore();
    this.ctx.events.emit('mode:change', { mode: 'classic', label: this.label });
  }

  stop(): void {
    this.controller = null;
  }

  private applyLevel(level: number): void {
    this.spec = buildLevel(level);
    this.board.level = level;
    const zoneZ = WORLD.spawn.z - this.spec.distance;
    this.controller?.configure({
      surfaceId: this.spec.surfaceId,
      zoneCenter: [WORLD.spawn.x, zoneZ],
      zoneRadius: this.spec.zoneRadius,
      obstacles: this.spec.obstacles,
      glueStickId: this.ctx.save.all.selectedGlueStick,
      showGuide: this.ctx.save.settings.showThrowGuide,
    });
    this.ctx.events.emit('level:change', {
      level,
      note: `${Math.round(this.spec.distance * 100)} cm · ${getSurface(this.spec.surfaceId).name}`,
    });
  }

  onLanding(result: LandingResult): void {
    if (!this.controller) return;
    const breakdown = this.board.apply(result.status, result.precision, levelDifficulty(this.spec));

    this.ctx.save.recordResult({
      mode: 'classic',
      score: this.board.score,
      combo: this.board.combo,
      level: this.board.level,
      perfect: result.status === 'perfect',
    });

    this.ctx.events.emit('landing:result', {
      result,
      breakdown,
      score: this.board.score,
      combo: this.board.combo,
      level: this.board.level,
    });
    this.emitScore();

    if (breakdown.success) {
      this.applyLevel(this.board.level + 1);
    } else {
      // The run is over: longest streak wins.
      this.controller.autoReset = false;
      this.ctx.events.emit('run:over', {
        score: this.board.score,
        bestCombo: this.board.bestCombo,
        landings: this.board.landings,
        perfects: this.board.perfects,
        level: this.board.level,
      });
    }
  }

  private emitScore(): void {
    this.ctx.events.emit('score:change', {
      score: this.board.score,
      combo: this.board.combo,
      bestCombo: this.board.bestCombo,
      level: this.board.level,
    });
  }

  hud(): HudState {
    const best = this.ctx.save.all.best.classic;
    return {
      ...emptyHud,
      score: this.board.score,
      bestScore: best.score,
      combo: this.board.combo,
      bestCombo: Math.max(this.board.bestCombo, best.combo),
      level: this.board.level,
      objective: 'Land it upright',
      objectiveVisible: true,
      detail: this.spec.note,
      stats: {
        throws: this.board.attempts,
        landings: this.board.landings,
        perfects: this.board.perfects,
      },
    };
  }
}

// ---------------------------------------------------------------------------
// Challenges
// ---------------------------------------------------------------------------

export class ChallengeMode implements GameMode {
  readonly id = 'challenge' as const;
  readonly label = 'Challenge';

  private ctx: GameContext;
  private controller: GameController | null = null;
  private board = new ScoreBoard();
  private challenge: ChallengeDef;
  private progress = 0;
  private attemptsUsed = 0;
  private streak = 0;
  private finished = false;

  constructor(ctx: GameContext, challenge: ChallengeDef) {
    this.ctx = ctx;
    this.challenge = challenge;
  }

  get definition(): ChallengeDef {
    return this.challenge;
  }

  start(controller: GameController): void {
    this.controller = controller;
    this.board.reset(1);
    this.progress = 0;
    this.attemptsUsed = 0;
    this.streak = 0;
    this.finished = false;
    controller.autoReset = true;

    const zoneZ = WORLD.spawn.z - this.challenge.distance;
    controller.configure({
      surfaceId: this.challenge.surfaceId,
      zoneCenter: this.challenge.zoneRadius > 0 ? [WORLD.spawn.x, zoneZ] : null,
      zoneRadius: this.challenge.zoneRadius,
      obstacles: this.challenge.obstacles,
      glueStickId: this.challenge.glueStickId ?? this.ctx.save.all.selectedGlueStick,
      showGuide: this.ctx.save.settings.showThrowGuide,
    });

    this.emitProgress();
    this.ctx.events.emit('mode:change', { mode: 'challenge', label: this.challenge.name });
  }

  stop(): void {
    this.controller = null;
  }

  onLanding(result: LandingResult): void {
    if (!this.controller || this.finished) return;
    const success = result.status === 'landing' || result.status === 'perfect';
    this.attemptsUsed += 1;
    this.streak = success ? this.streak + 1 : 0;

    const breakdown = this.board.apply(result.status, result.precision);
    this.ctx.events.emit('landing:result', {
      result,
      breakdown,
      score: this.board.score,
      combo: this.board.combo,
      level: 1,
    });

    if (success) {
      switch (this.challenge.goal.type) {
        case 'landings':
          this.progress += 1;
          break;
        case 'perfects':
          if (result.status === 'perfect') this.progress += 1;
          break;
        case 'combo':
          this.progress = Math.max(this.progress, this.streak);
          break;
        case 'distance':
          if (this.challenge.goal.minDistance && this.challenge.distance >= this.challenge.goal.minDistance) {
            this.progress += 1;
          }
          break;
      }
    }

    this.ctx.save.recordChallenge(this.challenge.id, {
      best: Math.max(this.ctx.save.all.challenges[this.challenge.id]?.best ?? 0, this.progress),
      attemptsUsed: this.attemptsUsed,
    });

    this.emitProgress();

    if (this.progress >= this.challenge.goal.count) {
      this.finished = true;
      this.controller.autoReset = false;
      this.ctx.save.recordChallenge(this.challenge.id, { completed: true });
      this.ctx.events.emit('challenge:complete', {
        id: this.challenge.id,
        name: this.challenge.name,
        rewardText: this.challenge.rewardText,
      });
      return;
    }

    if (this.challenge.attempts > 0 && this.attemptsUsed >= this.challenge.attempts) {
      this.finished = true;
      this.controller.autoReset = false;
      this.ctx.events.emit('challenge:failed', {
        id: this.challenge.id,
        name: this.challenge.name,
      });
    }
  }

  private emitProgress(): void {
    this.ctx.events.emit('challenge:progress', {
      completed: this.progress,
      total: this.challenge.goal.count,
      attemptsLeft:
        this.challenge.attempts > 0 ? Math.max(0, this.challenge.attempts - this.attemptsUsed) : -1,
    });
  }

  /** Restarts the challenge after a failure or a completion. */
  retry(): void {
    if (this.controller) this.start(this.controller);
  }

  hud(): HudState {
    const goalText =
      this.challenge.goal.type === 'combo'
        ? `${this.challenge.goal.count} in a row`
        : `${this.progress} / ${this.challenge.goal.count} ${
            this.challenge.goal.type === 'perfects' ? 'perfect landings' : 'landings'
          }`;
    return {
      ...emptyHud,
      score: this.board.score,
      bestScore: this.ctx.save.all.challenges[this.challenge.id]?.best ?? 0,
      combo: this.board.combo,
      bestCombo: this.board.bestCombo,
      level: 1,
      objective: goalText,
      objectiveVisible: true,
      attemptsLeft:
        this.challenge.attempts > 0 ? Math.max(0, this.challenge.attempts - this.attemptsUsed) : null,
      detail: `${this.challenge.name} · ${getSurface(this.challenge.surfaceId).name}`,
      levelVisible: false,
      stats: {
        throws: this.attemptsUsed,
        landings: this.board.landings,
        perfects: this.board.perfects,
      },
    };
  }
}

// ---------------------------------------------------------------------------
// Open mode
// ---------------------------------------------------------------------------

export class OpenMode implements GameMode {
  readonly id = 'open' as const;
  readonly label = 'Open Mode';

  action: { label: string; run: () => void };

  private ctx: GameContext;
  private controller: GameController | null = null;
  private surfaceIndex = 0;
  private throws = 0;
  private landings = 0;
  private perfects = 0;
  private lastStatus = '';

  constructor(ctx: GameContext) {
    this.ctx = ctx;
    this.action = {
      label: 'Change surface',
      run: () => this.cycleSurface(),
    };
  }

  start(controller: GameController): void {
    this.controller = controller;
    this.throws = 0;
    this.landings = 0;
    this.perfects = 0;
    this.lastStatus = '';
    controller.autoReset = true;
    this.apply();
    this.ctx.events.emit('mode:change', { mode: 'open', label: this.label });
  }

  stop(): void {
    this.controller = null;
  }

  private apply(): void {
    const surfaces = ['wood', 'walnut', 'rubber', 'stone', 'glass', 'metal', 'paper'];
    const surfaceId = surfaces[this.surfaceIndex % surfaces.length];
    this.controller?.configure({
      surfaceId,
      zoneCenter: null,
      zoneRadius: 0,
      obstacles: [],
      glueStickId: this.ctx.save.all.selectedGlueStick,
      showGuide: this.ctx.save.settings.showThrowGuide,
    });
    this.ctx.events.emit('toast', { text: getSurface(surfaceId).name, tone: 'info' });
  }

  cycleSurface(): void {
    this.surfaceIndex += 1;
    this.apply();
  }

  cycleStick(): void {
    const save = this.ctx.save;
    const ids = ['classic', 'jumbo', 'slim', 'purple'];
    const index = (ids.indexOf(save.all.selectedGlueStick) + 1) % ids.length;
    save.update((data) => {
      data.selectedGlueStick = ids[index];
    });
    this.apply();
  }

  onLanding(result: LandingResult): void {
    this.throws += 1;
    if (result.status === 'landing' || result.status === 'perfect') {
      this.landings += 1;
      if (result.status === 'perfect') this.perfects += 1;
    }
    this.lastStatus = result.reason;
    this.ctx.save.addPlayTime(0);
    this.ctx.events.emit('score:change', {
      score: 0,
      combo: 0,
      bestCombo: 0,
      level: 1,
    });
  }

  hud(): HudState {
    const best = this.ctx.save.all.best.open;
    return {
      ...emptyHud,
      score: this.landings,
      bestScore: best.score,
      combo: 0,
      bestCombo: 0,
      level: 1,
      objective: 'Free practice',
      objectiveVisible: true,
      detail: this.lastStatus ? `Last: ${this.lastStatus}` : 'Throw anywhere',
      scoreVisible: false,
      comboVisible: false,
      levelVisible: false,
      stats: { throws: this.throws, landings: this.landings, perfects: this.perfects },
    };
  }
}
