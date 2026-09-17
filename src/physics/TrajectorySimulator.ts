/**
 * Lightweight ballistic predictor.
 *
 * Used for the subtle aim guide and for camera look-ahead. It intentionally does
 * *not* run the real solver — it is a cheap integrator with quadratic drag, which
 * is plenty accurate for a preview and never risks diverging from the display.
 */

export interface TrajectoryOptions {
  position: [number, number, number];
  velocity: [number, number, number];
  /** Gravity (negative, e.g. -9.81). */
  gravity: number;
  /** Linear drag coefficient (1/s). */
  drag: number;
  /** Integration step (s). */
  dt: number;
  /** Maximum simulated duration (s). */
  maxTime: number;
  /** Stop the prediction when Y drops below this value. */
  stopBelowY: number;
}

export interface TrajectoryPoint {
  position: [number, number, number];
  velocity: [number, number, number];
  time: number;
}

export interface TrajectoryResult {
  points: TrajectoryPoint[];
  /** Estimated impact time (s), or maxTime when nothing was hit. */
  impactTime: number;
  /** Estimated impact point. */
  impactPoint: [number, number, number];
  /** Peak height reached. */
  peakY: number;
}

export function predictTrajectory(options: TrajectoryOptions): TrajectoryResult {
  const {
    position,
    velocity,
    gravity,
    drag,
    dt = 1 / 120,
    maxTime = 3,
    stopBelowY = 0,
  } = options;

  const points: TrajectoryPoint[] = [];
  let p: [number, number, number] = [...position];
  let v: [number, number, number] = [...velocity];
  let time = 0;
  let peakY = p[1];

  points.push({ position: [...p], velocity: [...v], time });

  while (time < maxTime) {
    // Semi-implicit Euler with drag.
    v = [v[0] * (1 - drag * dt), v[1] * (1 - drag * dt) + gravity * dt, v[2] * (1 - drag * dt)];
    p = [p[0] + v[0] * dt, p[1] + v[1] * dt, p[2] + v[2] * dt];
    time += dt;
    peakY = Math.max(peakY, p[1]);
    points.push({ position: [...p], velocity: [...v], time });
    if (p[1] <= stopBelowY) break;
  }

  return {
    points,
    impactTime: time,
    impactPoint: p,
    peakY,
  };
}

/**
 * Downsamples a trajectory into evenly-spaced guide dots.
 * `count` dots are returned, spaced by `stride` simulated points.
 */
export function sampleGuide(
  trajectory: TrajectoryResult,
  count = 18,
  stride = 6,
): [number, number, number][] {
  const dots: [number, number, number][] = [];
  for (let i = 1; i <= count; i++) {
    const index = Math.min(trajectory.points.length - 1, i * stride);
    dots.push(trajectory.points[index].position);
  }
  return dots;
}
