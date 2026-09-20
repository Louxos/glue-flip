import { describe, expect, it } from 'vitest';
import {
  ScoreBoard,
  comboMultiplier,
  difficultyMultiplier,
  scoreLanding,
} from '@/gameplay/ScoreSystem';
import { SCORING } from '@/config/gameplay';

describe('scoreLanding', () => {
  it('awards nothing for a failed throw', () => {
    const breakdown = scoreLanding({ status: 'failed', precision: 0.9, level: 5, combo: 9 });
    expect(breakdown.total).toBe(0);
    expect(breakdown.success).toBe(false);
  });

  it('awards more for a perfect landing than a sloppy one', () => {
    const perfect = scoreLanding({ status: 'perfect', precision: 1, level: 1, combo: 0 });
    const sloppy = scoreLanding({ status: 'landing', precision: 0.2, level: 1, combo: 0 });
    expect(perfect.total).toBeGreaterThan(sloppy.total);
  });

  it('scales with difficulty', () => {
    const early = scoreLanding({ status: 'landing', precision: 0.5, level: 1, combo: 0 });
    const late = scoreLanding({ status: 'landing', precision: 0.5, level: 12, combo: 0 });
    expect(late.total).toBeGreaterThan(early.total);
  });

  it('caps the difficulty multiplier', () => {
    expect(difficultyMultiplier(1)).toBe(1);
    expect(difficultyMultiplier(1000)).toBe(SCORING.difficultyMax);
  });

  it('caps the combo multiplier', () => {
    expect(comboMultiplier(0)).toBe(1);
    expect(comboMultiplier(SCORING.comboMax)).toBeCloseTo(1 + SCORING.comboMax * SCORING.comboStep);
    expect(comboMultiplier(9999)).toBeCloseTo(1 + SCORING.comboMax * SCORING.comboStep);
  });
});

describe('ScoreBoard', () => {
  it('builds a combo that multiplies the next landing', () => {
    const board = new ScoreBoard();
    const first = board.apply('landing', 0.5);
    const second = board.apply('landing', 0.5);
    expect(board.combo).toBe(2);
    expect(second.total).toBeGreaterThan(first.total);
  });

  it('resets the combo on failure but keeps the score', () => {
    const board = new ScoreBoard();
    board.apply('perfect', 1);
    const scoreBefore = board.score;
    board.apply('failed', 0);
    expect(board.combo).toBe(0);
    expect(board.score).toBe(scoreBefore);
    expect(board.bestCombo).toBe(1);
  });

  it('tracks accuracy', () => {
    const board = new ScoreBoard();
    board.apply('landing', 1);
    board.apply('failed', 0);
    board.apply('perfect', 1);
    board.apply('failed', 0);
    expect(board.accuracy).toBeCloseTo(0.5);
  });
});
