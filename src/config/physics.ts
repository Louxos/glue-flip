/**
 * Central physics configuration.
 *
 * Every tunable number that shapes the *feel* of the simulation lives here so the
 * gameplay code never contains magic numbers. Units are metric (meters, kilograms,
 * seconds) which keeps the Rapier simulation numerically well behaved.
 */

export const PHYSICS = {
  /** Gravity applied to the world (m/s²). */
  gravity: -9.81,
  /** Fixed simulation step. 120Hz gives stable thin-cylinder contacts. */
  timestep: 1 / 120,
  /** Hard cap of physics steps per frame (protects against tab-switch spikes). */
  maxStepsPerFrame: 8,
  /** Linear velocity below which a body is considered "not moving". */
  sleepLinearThreshold: 0.02,
  /** Angular velocity below which a body is considered "not spinning". */
  sleepAngularThreshold: 0.15,
  /** Rapier "length unit" — 1 means 1 world unit == 1 meter. */
  lengthUnit: 1,
  /** Contact skin (a.k.a. contact slop) in meters. */
  contactSkin: 0.0015,
} as const;

/** Behaviour of the thrown glue stick itself. */
export const GLUE_PHYSICS = {
  /** Air drag applied while in flight (keeps long throws from being absurd). */
  linearDamping: 0.08,
  /** Air resistance on spin. */
  angularDamping: 0.12,
  /** Continuous collision detection: mandatory, the stick is thin and fast. */
  ccdEnabled: true,
  /**
   * Contact skin (slop) for the stick's colliders, in meters. Rapier's default
   * is scaled to metre-sized scenes; on an object a few centimetres across it
   * would be a visible gap, so it is set explicitly here.
   */
  contactSkin: 0.0004,
  /**
   * A rigid-body solver has no rolling resistance, so a stick lying on its side
   * would keep spinning for seconds. While a contact is fresh and the body is
   * essentially at rest we bleed that spin off (plastic on wood really does stop
   * quickly). The speed gate keeps this from ever touching the flight.
   */
  contactSpinDamping: 12,
  /** Matching loss for the horizontal slide (m/s per second, proportional). */
  contactSlideDamping: 10,
  /** Above this speed (m/s) no contact spin damping is applied. */
  contactSpinMaxSpeed: 0.18,
  /** How long after the last contact the damping still applies (s). */
  contactSpinWindow: 0.25,
  /** Below this height the stick is considered lost (fell off the desk / world). */
  outOfBoundsY: -1.2,
  /** Distance from the desk centre beyond which a throw is considered "off". */
  outOfBoundsRadius: 6,
} as const;

/** How the "held" (kinematic) glue stick follows the pointer before release. */
export const HOLD = {
  /** Max speed the held stick may reach while tracking the cursor (m/s). */
  maxTrackSpeed: 9,
  /** Smoothing applied to the held position (higher = snappier). */
  positionStiffness: 26,
  /** How far in front of the camera the grab plane sits (meters). */
  grabPlaneDistance: 0.42,
  /** Tilt applied to the held stick so it looks natural in the hand. */
  heldTiltDeg: 8,
  /** Small gap left between the resting stick and the surface (m). */
  restLift: 0.0008,
} as const;

/** Coefficient combine rules for mixing surface + object friction. */
export const COMBINE = {
  /** Average keeps results intuitive and predictable. */
  friction: 'average',
  restitution: 'average',
} as const;

export type PhysicsConfig = typeof PHYSICS;
