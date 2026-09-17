/**
 * Gameplay tuning: landing evaluation, scoring, combos and timing.
 */

export type LandingStatus = 'perfect' | 'landing' | 'failed' | 'lost';

export const LANDING = {
  /** Tilt (deg from vertical) below which the landing counts as PERFECT. */
  perfectTiltDeg: 5,
  /** Tilt (deg) below which the stick still counts as standing. */
  standTiltDeg: 14,
  /** Linear speed under which the stick is considered "settling" (m/s). */
  settleLinvel: 0.028,
  /** Angular speed under which the stick is considered "settling" (rad/s). */
  settleAngvel: 0.22,
  /** How long the stick must stay quiet before the result is locked in (s). */
  settleHoldTime: 0.42,
  /** Absolute time limit for a single throw (s). */
  throwTimeout: 9,
  /** Max height above the surface the base may sit and still count as landed (m). */
  baseContactTolerance: 0.012,
  /** Minimum air time before a result is evaluated — avoids instant re-lands (s). */
  minFlightTime: 0.28,
} as const;

export const SCORING = {
  base: 100,
  perfectBonus: 130,
  /** Extra points scaled by landing precision (0..1). */
  precisionBonus: 140,
  /** Combo multiplier: 1 + combo * step, clamped. */
  comboStep: 0.12,
  comboMax: 25,
  /** Difficulty multiplier per progression level. */
  difficultyStep: 0.14,
  difficultyMax: 3.2,
} as const;

export const CLASSIC = {
  /** Level gained per successful landing. */
  levelPerLanding: 1,
  /** Landing zone radius shrink per level (m), clamped. */
  zoneShrinkPerLevel: 0.009,
  zoneRadiusMin: 0.075,
  zoneRadiusStart: 0.24,
  /** Distance the landing pad moves away per level (m), clamped. */
  distancePerLevel: 0.05,
  distanceMin: 0.3,
  distanceMax: 0.95,
  /** Levels between surface changes. */
  surfaceEveryLevels: 4,
  /** Level at which obstacles start appearing. */
  obstaclesFromLevel: 6,
} as const;

export const FEEDBACK = {
  /** Slow-motion scale used during the landing approach. */
  cinematicTimeScale: 0.42,
  /** Height above the surface at which the cinematic kicks in (m). */
  cinematicTriggerHeight: 0.085,
  /** Slow-motion scale for the confirmation moment. */
  confirmationTimeScale: 0.55,
  /** Duration of the confirmation hold (s, real time). */
  confirmationDuration: 0.95,
  /** Duration of the result overlay before auto-dismiss (s). */
  resultHoldTime: 1.35,
  /**
   * How long the result stays on screen before the stick resets itself, so the
   * player can chain throws without touching a button (s).
   */
  chainResetTime: 0.85,
  /**
   * Delay before a *failed* throw resets itself. Longer than a success so the
   * red flash and the verdict have time to be read (s).
   */
  failResetTime: 1.25,
  /** Red vignette shown on a miss outside Open Mode. */
  failFlash: {
    /** Peak opacity of the vignette. */
    opacity: 0.34,
    /** Fade out over (s). */
    duration: 0.9,
    /** Softer vignette when "reduce motion" is on. */
    reducedOpacity: 0.16,
  },
  /** Screen shake strength for a perfect landing. */
  perfectShake: 0.011,
  landingShake: 0.006,
  /**
   * How long a resolved throw holds on the desk before it resets itself.
   * A miss holds longer so the red flash and the verdict stay readable.
   */
  resetDelay(failed: boolean): number {
    return failed ? FEEDBACK.failResetTime : FEEDBACK.chainResetTime;
  },
  /**
   * Opacity of the red miss vignette, or null when it must not be shown.
   *
   * Open Mode is a sandbox — a miss there is an experiment, not a failure — and
   * a successful landing never flashes. "Reduce motion" gets a softer vignette.
   */
  missFlash(modeId: string, status: string, reduceMotion: boolean): number | null {
    if (modeId === 'open') return null;
    if (status !== 'failed' && status !== 'lost') return null;
    return reduceMotion
      ? FEEDBACK.failFlash.reducedOpacity
      : FEEDBACK.failFlash.opacity;
  },
  /** Mobile vibration patterns (ms). */
  vibrateLanding: [18],
  vibratePerfect: [16, 40, 26],
  vibrateFail: [10],
} as const;

export const STORAGE_KEYS = {
  save: 'glue-flip.save.v1',
} as const;
