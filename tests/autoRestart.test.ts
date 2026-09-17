import { describe, expect, it } from 'vitest';
import { FEEDBACK } from '@/config/gameplay';

/**
 * Auto-restart and miss-flash tests.
 *
 * Both decisions live in `FEEDBACK` rather than inline in the controller and the
 * app, so the rules ("a miss holds longer", "Open Mode never flashes red") are
 * pinned here instead of being invisible inside two private methods.
 */

describe('auto-restart timing', () => {
  it('resets a success quickly so throws can be chained', () => {
    expect(FEEDBACK.resetDelay(false)).toBe(FEEDBACK.chainResetTime);
  });

  it('holds a miss longer so the verdict and the flash can be read', () => {
    expect(FEEDBACK.resetDelay(true)).toBe(FEEDBACK.failResetTime);
    expect(FEEDBACK.failResetTime).toBeGreaterThan(FEEDBACK.chainResetTime);
  });

  it('keeps both delays short enough to feel automatic', () => {
    expect(FEEDBACK.chainResetTime).toBeLessThan(1.5);
    expect(FEEDBACK.failResetTime).toBeLessThan(2);
  });

  it('outlasts the fail flash so the vignette is never cut off', () => {
    expect(FEEDBACK.failResetTime).toBeGreaterThanOrEqual(FEEDBACK.failFlash.duration);
  });
});

describe('miss flash', () => {
  it('flashes red on a miss in the scored modes', () => {
    expect(FEEDBACK.missFlash('classic', 'failed', false)).toBe(FEEDBACK.failFlash.opacity);
    expect(FEEDBACK.missFlash('challenge', 'failed', false)).toBe(FEEDBACK.failFlash.opacity);
    expect(FEEDBACK.missFlash('classic', 'lost', false)).toBe(FEEDBACK.failFlash.opacity);
  });

  it('never flashes in Open Mode, where a miss is just an experiment', () => {
    expect(FEEDBACK.missFlash('open', 'failed', false)).toBeNull();
    expect(FEEDBACK.missFlash('open', 'lost', false)).toBeNull();
  });

  it('never flashes on a landing', () => {
    expect(FEEDBACK.missFlash('classic', 'landing', false)).toBeNull();
    expect(FEEDBACK.missFlash('challenge', 'perfect', false)).toBeNull();
  });

  it('softens the vignette when reduce motion is on, but still shows it', () => {
    const soft = FEEDBACK.missFlash('classic', 'failed', true);
    expect(soft).toBe(FEEDBACK.failFlash.reducedOpacity);
    expect(soft).toBeLessThan(FEEDBACK.failFlash.opacity);
    expect(soft).toBeGreaterThan(0);
  });

  it('stays a vignette rather than a solid screen', () => {
    expect(FEEDBACK.failFlash.opacity).toBeLessThan(0.5);
  });
});
