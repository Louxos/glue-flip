import { describe, expect, it } from 'vitest';
import { estimateFlightTime, pruneSamples, resolveThrow } from '@/gameplay/ThrowGesture';
import { THROW } from '@/config/throw';
import { Random } from '@/utils/random';
import { makeThrowSamples } from './helpers/throwSamples';

const context = {
  up: [0, 1, 0] as [number, number, number],
  forward: [0, 0, -1] as [number, number, number],
  gravity: 9.81,
  heightAboveSurface: 0.12,
  sensitivity: 1,
  stickHeight: 0.096,
  random: () => 0,
};

describe('resolveThrow', () => {
  it('rejects a gesture that is too short', () => {
    const samples = makeThrowSamples({
      start: [0, 0.85, 0.5],
      direction: [0, 1, -1],
      speed: 0.05,
    });
    const result = resolveThrow(samples, context);
    expect(result.valid).toBe(false);
    expect(result.power).toBe(0);
  });

  it('rejects too few samples', () => {
    const samples = makeThrowSamples({
      start: [0, 0.85, 0.5],
      direction: [0, 1, -1],
      speed: 4,
      count: 2,
    });
    expect(resolveThrow(samples, context).valid).toBe(false);
  });

  it('produces a forward flip when throwing away from the camera', () => {
    const samples = makeThrowSamples({
      start: [0, 0.85, 0.5],
      direction: [0, 0.6, -1],
      speed: 3.2,
    });
    const result = resolveThrow(samples, context);
    expect(result.valid).toBe(true);
    expect(result.velocity[2]).toBeLessThan(0);
    // Spin axis must be the screen-right axis for a throw travelling in -Z.
    expect(Math.abs(result.diagnostics.axis[0])).toBeGreaterThan(0.9);
    expect(result.angularVelocity[0]).toBeGreaterThan(0);
  });

  it('spins faster when the flick is harder', () => {
    const soft = resolveThrow(
      makeThrowSamples({ start: [0, 0.85, 0.5], direction: [0, 0.6, -1], speed: 2 }),
      context,
    );
    const hard = resolveThrow(
      makeThrowSamples({ start: [0, 0.85, 0.5], direction: [0, 0.6, -1], speed: 5.5 }),
      context,
    );
    expect(hard.estimatedRotations).toBeGreaterThan(soft.estimatedRotations);
    // A harder flick stays airborne longer, so angular *velocity* need not grow —
    // what must grow is the total rotation over the flight (ω · T).
    const totalSoft = Math.hypot(...soft.angularVelocity) * soft.estimatedFlightTime;
    const totalHard = Math.hypot(...hard.angularVelocity) * hard.estimatedFlightTime;
    expect(totalHard).toBeGreaterThan(totalSoft);
    expect(hard.angularVelocity[0]).toBeGreaterThan(0);
  });

  it('keeps rotations inside the configured bounds', () => {
    for (const speed of [1, 2, 3, 5, 7, 12]) {
      const result = resolveThrow(
        makeThrowSamples({ start: [0, 0.85, 0.5], direction: [0, 0.6, -1], speed }),
        context,
      );
      if (!result.valid) continue;
      expect(result.estimatedRotations).toBeGreaterThanOrEqual(THROW.minRotations);
      expect(result.estimatedRotations).toBeLessThanOrEqual(THROW.maxRotations);
      expect(result.speed).toBeLessThanOrEqual(THROW.maxReleaseSpeed * 1.3);
    }
  });

  it('clamps the release speed', () => {
    const result = resolveThrow(
      makeThrowSamples({ start: [0, 0.85, 0.5], direction: [0, 0.4, -1], speed: 40 }),
      context,
    );
    expect(result.speed).toBeLessThanOrEqual(THROW.maxReleaseSpeed * 1.3);
  });

  it('is deterministic for a given seed', () => {
    const samples = makeThrowSamples({
      start: [0, 0.85, 0.5],
      direction: [0, 0.6, -1],
      speed: 3.4,
    });
    const a = resolveThrow(samples, { ...context, random: () => new Random(7).jitter(1) });
    const b = resolveThrow(samples, { ...context, random: () => new Random(7).jitter(1) });
    expect(a.velocity).toEqual(b.velocity);
    expect(a.angularVelocity).toEqual(b.angularVelocity);
  });

  it('scales with player sensitivity', () => {
    const samples = makeThrowSamples({
      start: [0, 0.85, 0.5],
      direction: [0, 0.6, -1],
      speed: 3,
    });
    const normal = resolveThrow(samples, context);
    const boosted = resolveThrow(samples, { ...context, sensitivity: 1.6 });
    expect(boosted.speed).toBeGreaterThan(normal.speed);
  });

  it('adds roll when the pointer curls around the stick', () => {
    const straight = resolveThrow(
      makeThrowSamples({ start: [0, 0.85, 0.5], direction: [0, 0.6, -1], speed: 3, curl: 0 }),
      context,
    );
    const curled = resolveThrow(
      makeThrowSamples({ start: [0, 0.85, 0.5], direction: [0, 0.6, -1], speed: 3, curl: 90 }),
      context,
    );
    // Curl spins about the camera forward axis (Z); a straight flick must not.
    expect(Math.abs(straight.diagnostics.curlRate)).toBeLessThan(3);
    expect(Math.abs(curled.angularVelocity[2])).toBeGreaterThan(
      Math.abs(straight.angularVelocity[2]),
    );
  });
});

describe('estimateFlightTime', () => {
  it('is longer from a higher release', () => {
    const low = estimateFlightTime(1.5, 0.05, 9.81);
    const high = estimateFlightTime(1.5, 0.6, 9.81);
    expect(high).toBeGreaterThan(low);
  });

  it('is longer with more upward speed', () => {
    const soft = estimateFlightTime(0.5, 0.1, 9.81);
    const strong = estimateFlightTime(3, 0.1, 9.81);
    expect(strong).toBeGreaterThan(soft);
  });

  it('never returns a negative time', () => {
    // Thrown straight down from the surface: no flight time, and never negative.
    expect(estimateFlightTime(-4, 0, 9.81)).toBeGreaterThanOrEqual(0);
  });
});

describe('pruneSamples', () => {
  it('keeps only the recent window but never drops the newest sample', () => {
    const samples = makeThrowSamples({
      start: [0, 0.85, 0.5],
      direction: [0, 0.6, -1],
      speed: 3,
      duration: 0.4,
      count: 20,
    });
    const now = samples[samples.length - 1].t;
    const pruned = pruneSamples(samples, now);
    expect(pruned.length).toBeLessThan(samples.length);
    expect(pruned[pruned.length - 1].t).toBe(now);
    const window = now - pruned[0].t;
    expect(window).toBeLessThanOrEqual(THROW.velocityWindow + 1e-6);
  });
});
