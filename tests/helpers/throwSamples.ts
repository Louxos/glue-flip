import type { PointerSample } from '@/config/throw';

export interface SampleOptions {
  /** World-space start position of the held stick. */
  start: [number, number, number];
  /** World-space direction of the flick (does not need to be normalised). */
  direction: [number, number, number];
  /** Peak speed of the flick (m/s). */
  speed: number;
  /** Duration of the recorded gesture (s). */
  duration?: number;
  /** Number of samples. */
  count?: number;
  /** Screen-space start (pixels). */
  screenStart?: [number, number];
  /** Screen-space travel direction. */
  screenDirection?: [number, number];
  /** Extra lateral curl, in screen pixels, applied as a sine offset. */
  curl?: number;
}

/**
 * Builds a synthetic pointer trace that mimics a real flick: the stick
 * accelerates away from the hand and the samples span a short window, like a
 * 120Hz capture of a quick gesture.
 */
export function makeThrowSamples(options: SampleOptions): PointerSample[] {
  const duration = options.duration ?? 0.09;
  const count = options.count ?? 9;
  const [sx, sy] = options.screenStart ?? [420, 520];
  const [sdx, sdy] = options.screenDirection ?? [0, -260];
  const curl = options.curl ?? 0;

  const dir = normalize(options.direction);
  const samples: PointerSample[] = [];

  for (let i = 0; i < count; i++) {
    const t = (i / (count - 1)) * duration;
    // Ease-in: the hand accelerates through the flick.
    const eased = (t / duration) ** 1.6;
    const distance = options.speed * duration * eased * 1.35;
    const curlOffset = curl * Math.sin((t / duration) * Math.PI);

    samples.push({
      x: options.start[0] + dir[0] * distance,
      y: options.start[1] + dir[1] * distance,
      z: options.start[2] + dir[2] * distance,
      sx: sx + sdx * (t / duration) + curlOffset,
      sy: sy + sdy * (t / duration),
      t,
    });
  }
  return samples;
}

function normalize(v: [number, number, number]): [number, number, number] {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
}
