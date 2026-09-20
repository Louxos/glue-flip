/**
 * Throwing model configuration.
 *
 * The throw is derived from the *actual motion* of the pointer: the stick is
 * driven kinematically while held, and the release velocity is measured from the
 * recorded sample history. Spin is derived from how fast the pointer travels plus
 * how much it "curls" around the stick (a flick = flip, a circle = roll).
 */

export const THROW = {
  /** Minimum pointer travel (m) for the gesture to count as a throw. */
  minTravel: 0.012,
  /** Minimum release speed for the throw to be registered (m/s). */
  minReleaseSpeed: 0.3,
  /**
   * Gesture speed → release speed. Dragging the stick across the screen already
   * moves it at several m/s in world space; this gain keeps a comfortable flick
   * inside the range the desk can actually catch (measured in the throw tests).
   */
  speedGain: 0.72,
  /** Soft cap on release speed (m/s) — beyond this it simply flies off the desk. */
  maxReleaseSpeed: 3.4,
  /** Time window of recent samples used to fit the release velocity (s). */
  velocityWindow: 0.075,
  /** Minimum samples required for a meaningful release velocity. */
  minSamples: 3,
  /**
   * Exponent linking release speed to the number of rotations. Kept small on
   * purpose: a harder flick flies longer, so the flip rate barely has to change
   * for the stick to come round once. The residual dependence (plus the natural
   * variation below) is what makes an inconsistent flick miss the landing phase.
   */
  flipGain: 0.02,
  /** Number of rotations targeted at "reference" release speed. */
  rotationsAtReference: 1.012,
  /** Release speed (m/s) at which `rotationsAtReference` is reached. */
  referenceSpeed: 1.6,
  /** Rotation clamp (rotations over the estimated flight). */
  minRotations: 0.55,
  maxRotations: 1.6,
  /** Contribution of pointer "curl" (screen-space angular rate) to spin (rad/s per rad/s). */
  curlToSpin: 0.85,
  /** Max extra spin from curl (rad/s). */
  maxCurlSpin: 8,
  /**
   * Residual spin the stick keeps from being handled (rad/s). Kept small: over a
   * 0.35 s flight even 0.3 rad/s adds several degrees of random tilt, and the
   * landing window is only a few degrees wide.
   */
  handlingNoise: 0.12,
  /** Natural variation applied to every throw (fraction, 0..1). */
  naturalVariation: 0.035,
  /** Upwards bias added to a throw so flicks feel natural. */
  liftBias: 0.18,
  /**
   * Extra lift for harder flicks. Ballistic distance grows with the square of
   * the speed, so without this a firm flick sails straight off the desk; the
   * extra arc turns speed into height instead and keeps the reachable distance
   * inside the play area.
   */
  liftGain: 0.26,
  /** Forward (away from camera) assist so throws travel towards the desk. */
  forwardAssist: 0.12,
} as const;

/** A fully resolved throw, ready to be applied to the rigid body. */
export interface ThrowImpulse {
  /** World-space linear velocity (m/s). */
  velocity: [number, number, number];
  /** World-space angular velocity (rad/s). */
  angularVelocity: [number, number, number];
  /** 0..1 normalised power. */
  power: number;
  /** Estimated number of rotations before the stick comes back down. */
  estimatedRotations: number;
  /** Estimated flight time (s). */
  estimatedFlightTime: number;
  /** Release speed (m/s). */
  speed: number;
  /** True when the gesture was too weak / too short to count as a throw. */
  valid: boolean;
}

export interface PointerSample {
  /** World-space position of the held stick at this sample. */
  x: number;
  y: number;
  z: number;
  /** Screen-space position (pixels, y down). */
  sx: number;
  sy: number;
  /** Timestamp in seconds. */
  t: number;
}
