import { THROW } from '@/config/throw';
import type { PointerSample, ThrowImpulse } from '@/config/throw';
import {
  clamp,
  cross3,
  length3,
  mapRange,
  normalize3,
  scale3,
  add3,
} from '@/utils/math';

/**
 * Turns a raw pointer gesture into a physical throw.
 *
 * Design notes:
 *  - The stick is *actually* moved by the pointer while held, so the release
 *    velocity is measured from real world-space motion (least-squares fit over
 *    the last samples) instead of being faked from pixels.
 *  - The flip (rotation about the screen-right axis) is derived from release
 *    speed: a harder flick means more rotations over the estimated flight time.
 *  - A "curl" — the pointer circling around the stick — adds roll about the
 *    camera forward axis, which is what gives expert players fine control.
 *
 * This module is pure (no three.js, no DOM) and therefore unit-testable.
 */

export interface ThrowContext {
  /** World-space up (usually [0,1,0]). */
  up: [number, number, number];
  /** Camera forward (points away from the viewer). */
  forward: [number, number, number];
  /** Gravity magnitude (positive, e.g. 9.81). */
  gravity: number;
  /** Height of the release point above the landing surface (m). */
  heightAboveSurface: number;
  /** Player sensitivity multiplier. */
  sensitivity: number;
  /** Height of the stick (m) — used to scale spin. */
  stickHeight: number;
  /** Random source in [-1, 1]; inject a seeded one for reproducibility. */
  random: () => number;
}

export interface ThrowDiagnostics {
  sampleCount: number;
  travel: number;
  rawSpeed: number;
  speed: number;
  flightTime: number;
  rotations: number;
  curlRate: number;
  axis: [number, number, number];
}

export interface ThrowResolution extends ThrowImpulse {
  diagnostics: ThrowDiagnostics;
}

const UP: [number, number, number] = [0, 1, 0];

/** Least-squares velocity estimate over a set of samples. */
function fitVelocity(samples: PointerSample[]): [number, number, number] {
  const n = samples.length;
  if (n < 2) return [0, 0, 0];
  const t0 = samples[0].t;
  let sumT = 0;
  let sumT2 = 0;
  let sumX = 0;
  let sumY = 0;
  let sumZ = 0;
  let sumTX = 0;
  let sumTY = 0;
  let sumTZ = 0;
  for (const s of samples) {
    const t = s.t - t0;
    sumT += t;
    sumT2 += t * t;
    sumX += s.x;
    sumY += s.y;
    sumZ += s.z;
    sumTX += t * s.x;
    sumTY += t * s.y;
    sumTZ += t * s.z;
  }
  const denom = n * sumT2 - sumT * sumT;
  if (Math.abs(denom) < 1e-9) return [0, 0, 0];
  return [
    (n * sumTX - sumT * sumX) / denom,
    (n * sumTY - sumT * sumY) / denom,
    (n * sumTZ - sumT * sumZ) / denom,
  ];
}

/** Total path length travelled by the pointer-driven stick (m). */
function pathLength(samples: PointerSample[]): number {
  let length = 0;
  for (let i = 1; i < samples.length; i++) {
    const a = samples[i - 1];
    const b = samples[i];
    length += Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
  }
  return length;
}

/**
 * Signed turning rate of the pointer path (rad/s).
 *
 * Measured from the angle *between consecutive segments*, so a straight flick
 * returns ~0 while a curved or circular gesture returns a large value (a full
 * loop is ±2π). Measuring the angle around the path's centroid instead would
 * report a huge "curl" for any straight line that crosses it.
 */
function curlRate(samples: PointerSample[]): number {
  if (samples.length < 3) return 0;
  let totalAngle = 0;
  for (let i = 1; i < samples.length - 1; i++) {
    const ax = samples[i].sx - samples[i - 1].sx;
    const ay = samples[i].sy - samples[i - 1].sy;
    const bx = samples[i + 1].sx - samples[i].sx;
    const by = samples[i + 1].sy - samples[i].sy;
    const la = Math.hypot(ax, ay);
    const lb = Math.hypot(bx, by);
    if (la < 0.5 || lb < 0.5) continue;
    const cross = ax * by - ay * bx;
    const dot = ax * bx + ay * by;
    totalAngle += Math.atan2(cross, dot);
  }
  const duration = samples[samples.length - 1].t - samples[0].t;
  if (duration < 1e-4) return 0;
  return totalAngle / duration;
}

/** Flight time until the stick comes back to the surface height. */
export function estimateFlightTime(
  verticalSpeed: number,
  heightAboveSurface: number,
  gravity: number,
): number {
  const g = Math.max(0.1, gravity);
  const discriminant = Math.max(0, verticalSpeed * verticalSpeed + 2 * g * Math.max(0, heightAboveSurface));
  return (verticalSpeed + Math.sqrt(discriminant)) / g;
}

/**
 * Resolves a throw from the recorded samples.
 *
 * @param samples Ordered pointer samples, oldest first (at least 2).
 * @param context World/camera context for the throw.
 */
export function resolveThrow(
  samples: PointerSample[],
  context: ThrowContext,
): ThrowResolution {
  const random = context.random ?? (() => 0);
  const up = context.up ?? UP;
  const gravity = context.gravity > 0 ? context.gravity : 9.81;
  const sensitivity = clamp(context.sensitivity ?? 1, 0.2, 3);

  const travel = pathLength(samples);
  const velocity = fitVelocity(samples);
  const rawSpeed = length3(velocity);

  const invalid: ThrowResolution = {
    velocity: [0, 0, 0],
    angularVelocity: [0, 0, 0],
    power: 0,
    estimatedRotations: 0,
    estimatedFlightTime: 0,
    speed: rawSpeed,
    valid: false,
    diagnostics: {
      sampleCount: samples.length,
      travel,
      rawSpeed,
      speed: rawSpeed,
      flightTime: 0,
      rotations: 0,
      curlRate: 0,
      axis: [1, 0, 0],
    },
  };

  if (samples.length < THROW.minSamples || travel < THROW.minTravel) return invalid;

  // --- Linear velocity ---------------------------------------------------
  // The gesture is measured in world space (the stick really moves with the
  // pointer), then scaled: a firm drag already reaches several m/s.
  const measured = scale3(velocity, sensitivity * THROW.speedGain);
  const measuredSpeed = length3(measured);
  if (measuredSpeed < THROW.minReleaseSpeed) return invalid;
  const raw: [number, number, number] =
    measuredSpeed > 1e-6 ? scale3(measured, 1 / measuredSpeed) : [0, 1, 0];

  // Gentle assists, applied to the *direction* so the release speed stays inside
  // the configured cap: a flick should arc rather than simply go faster.
  const lift =
    THROW.liftBias + THROW.liftGain * clamp(measuredSpeed / THROW.maxReleaseSpeed, 0, 1);
  const forward = normalize3(context.forward);
  let direction: [number, number, number] = [raw[0], raw[1] + lift, raw[2]];
  direction = normalize3(add3(direction, scale3(forward, THROW.forwardAssist)));

  // Natural variation: keeps repeated throws from feeling robotic.
  const releaseSpeed = Math.min(measuredSpeed, THROW.maxReleaseSpeed);
  const variation = 1 + random() * THROW.naturalVariation;
  const velocityOut = scale3(direction, releaseSpeed * variation);
  const speed = length3(velocityOut);

  // --- Rotation ----------------------------------------------------------
  const flightTime = Math.max(
    0.18,
    estimateFlightTime(velocityOut[1], context.heightAboveSurface, gravity),
  );

  const speedRatio = clamp(speed / THROW.referenceSpeed, 0.2, 2.5);
  const rotations = clamp(
    THROW.rotationsAtReference * Math.pow(speedRatio, THROW.flipGain),
    THROW.minRotations,
    THROW.maxRotations,
  );

  // Flip axis: perpendicular to both the throw direction and world up, which is
  // the screen-right axis for a throw that travels away from the camera.
  let axis = normalize3(cross3(velocityOut, up));
  if (length3(axis) < 0.2) axis = normalize3(cross3(forward, up));
  if (length3(axis) < 0.2) axis = [1, 0, 0];

  const flipSpin = (rotations * Math.PI * 2) / flightTime;
  let angular: [number, number, number] = scale3(axis, flipSpin);

  // Curl → roll about the camera forward axis.
  const curl = curlRate(samples);
  const twist = clamp(-curl * THROW.curlToSpin, -THROW.maxCurlSpin, THROW.maxCurlSpin);
  angular = add3(angular, scale3(normalize3(context.forward), twist));

  // Handling noise: the tiny wobble a real hand imparts.
  const noise = THROW.handlingNoise;
  angular = [
    angular[0] + random() * noise,
    angular[1] + random() * noise,
    angular[2] + random() * noise,
  ];

  return {
    velocity: [velocityOut[0], velocityOut[1], velocityOut[2]],
    angularVelocity: [angular[0], angular[1], angular[2]],
    power: clamp(mapRange(speed, THROW.minReleaseSpeed, THROW.maxReleaseSpeed, 0, 1), 0, 1),
    estimatedRotations: rotations,
    estimatedFlightTime: flightTime,
    speed: speed,
    valid: true,
    diagnostics: {
      sampleCount: samples.length,
      travel,
      rawSpeed,
      speed: speed,
      flightTime,
      rotations,
      curlRate: curl,
      axis,
    },
  };
}

/**
 * Keeps only the samples inside the release window. Called every frame while the
 * stick is held so the buffer stays short and the fit stays responsive.
 */
export function pruneSamples(samples: PointerSample[], now: number): PointerSample[] {
  const cutoff = now - THROW.velocityWindow;
  let start = 0;
  while (start < samples.length - 1 && samples[start].t < cutoff) start++;
  return samples.slice(start);
}
