import { describe, expect, it } from 'vitest';
import { evaluateLanding, isSettled } from '@/gameplay/LandingEvaluator';
import { LANDING } from '@/config/gameplay';

const baseInput = {
  tiltDeg: 2,
  baseY: 0.76,
  capY: 0.856,
  surfaceY: 0.758,
  stickHeight: 0.096,
  insideZone: true,
  zoneRequired: true,
  flightTime: 0.6,
  outOfBounds: false,
};

describe('evaluateLanding', () => {
  it('grades a near-vertical landing as perfect', () => {
    const result = evaluateLanding({ ...baseInput, tiltDeg: 1.4 });
    expect(result.status).toBe('perfect');
    expect(result.baseDown).toBe(true);
    expect(result.precision).toBeGreaterThan(0.8);
  });

  it('grades a tilted-but-standing landing as a normal landing', () => {
    const result = evaluateLanding({ ...baseInput, tiltDeg: 10 });
    expect(result.status).toBe('landing');
    expect(result.precision).toBeGreaterThan(0);
    expect(result.precision).toBeLessThan(1);
  });

  it('fails a stick that is standing but beyond the tilt limit', () => {
    const result = evaluateLanding({ ...baseInput, tiltDeg: LANDING.standTiltDeg + 1 });
    expect(result.status).toBe('failed');
    expect(result.reason).toBe('Toppled over');
  });

  it('fails a stick that came to rest on its cap', () => {
    const result = evaluateLanding({
      ...baseInput,
      tiltDeg: 178,
      baseY: 0.856,
      capY: 0.76,
    });
    expect(result.status).toBe('failed');
    expect(result.reason).toBe('Landed on the cap');
  });

  it('fails a stick lying flat even when the tilt looks small', () => {
    const result = evaluateLanding({
      ...baseInput,
      tiltDeg: 88,
      baseY: 0.77,
      capY: 0.782,
    });
    expect(result.status).toBe('failed');
    expect(result.baseDown).toBe(false);
  });

  it('fails a landing outside the required zone', () => {
    const result = evaluateLanding({ ...baseInput, insideZone: false });
    expect(result.status).toBe('failed');
    expect(result.reason).toBe('Outside the zone');
  });

  it('accepts any position when no zone is required (open mode)', () => {
    const result = evaluateLanding({
      ...baseInput,
      insideZone: false,
      zoneRequired: false,
    });
    expect(result.status).toBe('perfect');
  });

  it('reports a lost stick', () => {
    const result = evaluateLanding({ ...baseInput, outOfBounds: true });
    expect(result.status).toBe('lost');
    expect(result.precision).toBe(0);
  });

  it('rejects a result that was resolved before the stick left the hand', () => {
    const result = evaluateLanding({ ...baseInput, flightTime: 0.05 });
    expect(result.status).toBe('failed');
  });

  it('precision decreases monotonically with tilt', () => {
    const tilts = [1, 4, 8, 12];
    const precisions = tilts.map((tilt) =>
      evaluateLanding({ ...baseInput, tiltDeg: tilt }).precision,
    );
    for (let i = 1; i < precisions.length; i++) {
      expect(precisions[i]).toBeLessThan(precisions[i - 1]);
    }
  });
});

describe('isSettled', () => {
  it('is true for a quiet body', () => {
    expect(isSettled(0.005, 0.05)).toBe(true);
  });

  it('is false while the body still moves', () => {
    expect(isSettled(0.5, 0.05)).toBe(false);
    expect(isSettled(0.005, 3)).toBe(false);
  });
});
