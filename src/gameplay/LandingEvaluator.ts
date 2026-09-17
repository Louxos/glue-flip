import { LANDING } from '@/config/gameplay';
import type { LandingStatus } from '@/config/gameplay';
import { clamp } from '@/utils/math';

/**
 * Landing evaluation.
 *
 * The verdict comes from the *measured* final state of the rigid body — tilt of
 * the body's up axis, which end is down, whether the base still touches the
 * surface and whether the stick is inside the target zone. Nothing here is
 * animated or scripted: if the physics says it fell over, it failed.
 */

export interface LandingInput {
  /** Angle between the stick's up axis and world up, in degrees. */
  tiltDeg: number;
  /** World Y of the centre of the base face. */
  baseY: number;
  /** World Y of the centre of the cap face. */
  capY: number;
  /** Height of the landing surface (world Y). */
  surfaceY: number;
  /** Height of the stick (used to sanity check the end-to-end distance). */
  stickHeight: number;
  /** True when the stick is inside the target zone (or no zone is required). */
  insideZone: boolean;
  /** Whether a zone is required at all. */
  zoneRequired: boolean;
  /** Seconds between release and settle. */
  flightTime: number;
  /** True when the stick left the play area / fell off the desk. */
  outOfBounds: boolean;
}

export interface LandingResult {
  status: LandingStatus;
  tiltDeg: number;
  /** 0..1, higher = closer to perfectly vertical. */
  precision: number;
  baseDown: boolean;
  insideZone: boolean;
  /** Human readable reason, surfaced in the UI and the debug overlay. */
  reason: string;
  /** Points multiplier hint: how "clean" the landing looked. */
  cleanliness: number;
}

export type LandingThresholds = typeof LANDING;

export function evaluateLanding(
  input: LandingInput,
  thresholds: LandingThresholds = LANDING,
): LandingResult {
  const tilt = Math.abs(input.tiltDeg);
  const baseGap = input.baseY - input.surfaceY;
  const verticalSpan = input.capY - input.baseY;
  const baseDown =
    verticalSpan > input.stickHeight * 0.45 && baseGap <= thresholds.baseContactTolerance;

  const base: Omit<LandingResult, 'status' | 'reason'> = {
    tiltDeg: tilt,
    precision: clamp(1 - tilt / thresholds.standTiltDeg, 0, 1),
    baseDown,
    insideZone: input.insideZone,
    cleanliness: 0,
  };

  if (input.outOfBounds) {
    return { ...base, status: 'lost', precision: 0, reason: 'Lost the stick' };
  }

  if (input.flightTime < thresholds.minFlightTime) {
    return { ...base, status: 'failed', precision: 0, reason: 'Barely left the hand' };
  }

  if (!baseDown) {
    const onCap = input.capY < input.baseY && input.surfaceY - input.capY <= thresholds.baseContactTolerance;
    return {
      ...base,
      status: 'failed',
      precision: 0,
      reason: onCap ? 'Landed on the cap' : 'Never touched down on its base',
    };
  }

  if (tilt > thresholds.standTiltDeg) {
    return { ...base, status: 'failed', reason: 'Toppled over' };
  }

  if (input.zoneRequired && !input.insideZone) {
    return { ...base, status: 'failed', reason: 'Outside the zone' };
  }

  const perfect = tilt <= thresholds.perfectTiltDeg;
  const cleanliness = clamp(
    1 - tilt / Math.max(0.001, thresholds.perfectTiltDeg * 3),
    0.35,
    1,
  );

  return {
    ...base,
    status: perfect ? 'perfect' : 'landing',
    reason: perfect ? 'Dead vertical' : 'Standing',
    cleanliness,
  };
}

/** True when the body is quiet enough that the result can be locked in. */
export function isSettled(
  linearSpeed: number,
  angularSpeed: number,
  thresholds: LandingThresholds = LANDING,
): boolean {
  return linearSpeed < thresholds.settleLinvel && angularSpeed < thresholds.settleAngvel;
}
