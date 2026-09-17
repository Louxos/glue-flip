/**
 * Camera configuration: free orbit during preparation, assisted follow in flight,
 * cinematic accents on landing. All angles in radians, distances in meters.
 */

export const CAMERA = {
  fov: 40,
  fovMobile: 48,
  near: 0.01,
  far: 80,

  /** Default framing when the game starts. */
  default: {
    target: [0, 0.84, 0.14] as [number, number, number],
    distance: 1.28,
    /** Azimuth around Y (0 = looking from +Z towards the desk). */
    azimuth: 0.12,
    /** Polar angle from +Y. */
    polar: 1.16,
  },

  orbit: {
    minDistance: 0.42,
    maxDistance: 3.4,
    minPolar: 0.42,
    maxPolar: 1.52,
    /** Rotation speed per pixel of drag. */
    rotateSpeed: 0.0055,
    /** Zoom speed per wheel notch / pinch unit. */
    zoomSpeed: 0.16,
    /** Positional damping factor (higher = snappier). */
    damping: 11,
  },

  follow: {
    /** How strongly the camera chases the stick's velocity (look-ahead). */
    lead: 0.32,
    maxLead: 0.42,
    /** Distance multiplier applied while the stick is airborne. */
    distanceMultiplier: 1.22,
    /** Extra distance per m/s of speed (clamped). */
    speedDistance: 0.045,
    maxExtraDistance: 0.5,
    /** Damping for the follow target. */
    damping: 7.5,
    /** Keep the stick inside this fraction of the screen half-height. */
    screenKeepIn: 0.62,
    /** How much of the player's own orbit input is preserved in flight (0..1). */
    playerAuthority: 0.55,
    /** Height the follow target is lifted by so the desk stays in frame. */
    targetLift: -0.05,
  },

  cinematic: {
    /** Push-in applied when the stick approaches the surface. */
    approachZoom: 0.88,
    /** Push-in on a successful landing. */
    successZoom: 0.8,
    /** Duration of the success push-in (s). */
    successDuration: 0.7,
    /** Slight low-angle lift during the approach. */
    approachPolarOffset: -0.1,
    /** Shake damping. */
    shakeDecay: 7,
  },

  /** Framing used by the animated main-menu backdrop. */
  menu: {
    target: [0.02, 0.83, 0.1] as [number, number, number],
    distance: 1.55,
    azimuthDrift: 0.16,
    polar: 1.24,
    driftSpeed: 0.055,
  },
} as const;
