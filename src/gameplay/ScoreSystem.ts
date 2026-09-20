import { SCORING } from '@/config/gameplay';
import type { LandingStatus } from '@/config/gameplay';
import { clamp } from '@/utils/math';

/**
 * Scoring.
 *
 * A landing scores: base + precision bonus (+ perfect bonus), multiplied by a
 * difficulty factor (progression level) and a combo factor. Failed throws score
 * zero and reset the combo. Deliberately simple so the player can build a mental
 * model of what is worth doing.
 */

export interface ScoreInput {
  status: LandingStatus;
  /** 0..1 landing precision from the evaluator. */
  precision: number;
  /** Current progression level (1 = first level). */
  level: number;
  /** Combo *before* this landing is applied. */
  combo: number;
  /** Optional explicit difficulty override (challenges). */
  difficulty?: number;
}

export interface ScoreBreakdown {
  total: number;
  base: number;
  precisionBonus: number;
  perfectBonus: number;
  difficultyMultiplier: number;
  comboMultiplier: number;
  success: boolean;
  perfect: boolean;
}

export function difficultyMultiplier(level: number): number {
  return clamp(1 + (Math.max(1, level) - 1) * SCORING.difficultyStep, 1, SCORING.difficultyMax);
}

export function comboMultiplier(combo: number): number {
  return 1 + clamp(combo, 0, SCORING.comboMax) * SCORING.comboStep;
}

export function scoreLanding(input: ScoreInput): ScoreBreakdown {
  const success = input.status === 'landing' || input.status === 'perfect';
  const perfect = input.status === 'perfect';

  if (!success) {
    return {
      total: 0,
      base: 0,
      precisionBonus: 0,
      perfectBonus: 0,
      difficultyMultiplier: 1,
      comboMultiplier: 1,
      success: false,
      perfect: false,
    };
  }

  const precision = clamp(input.precision, 0, 1);
  const base = SCORING.base;
  const precisionBonus = Math.round(SCORING.precisionBonus * precision);
  const perfectBonus = perfect ? SCORING.perfectBonus : 0;
  const difficulty = input.difficulty ?? difficultyMultiplier(input.level);
  const combo = comboMultiplier(input.combo);
  const total = Math.round((base + precisionBonus + perfectBonus) * difficulty * combo);

  return {
    total,
    base,
    precisionBonus,
    perfectBonus,
    difficultyMultiplier: difficulty,
    comboMultiplier: combo,
    success: true,
    perfect,
  };
}

/**
 * Mutable scoreboard used by the game modes. Kept separate from the pure
 * scoring function so tests can exercise both independently.
 */
export class ScoreBoard {
  score = 0;
  combo = 0;
  bestCombo = 0;
  landings = 0;
  perfects = 0;
  attempts = 0;
  level = 1;

  reset(level = 1): void {
    this.score = 0;
    this.combo = 0;
    this.landings = 0;
    this.perfects = 0;
    this.attempts = 0;
    this.level = level;
  }

  /** Applies a landing result; returns the points earned. */
  apply(status: LandingStatus, precision: number, difficulty?: number): ScoreBreakdown {
    this.attempts += 1;
    const breakdown = scoreLanding({
      status,
      precision,
      level: this.level,
      combo: this.combo,
      difficulty,
    });
    if (breakdown.success) {
      this.score += breakdown.total;
      this.combo += 1;
      this.landings += 1;
      if (breakdown.perfect) this.perfects += 1;
      this.bestCombo = Math.max(this.bestCombo, this.combo);
    } else {
      this.combo = 0;
    }
    return breakdown;
  }

  /** Accuracy as a 0..1 ratio of landings over attempts. */
  get accuracy(): number {
    return this.attempts === 0 ? 0 : this.landings / this.attempts;
  }
}
