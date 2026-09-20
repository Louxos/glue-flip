/**
 * Deterministic, seedable PRNG (mulberry32).
 *
 * The physics must feel alive but never random-feeling: every source of
 * "natural variation" in the game goes through an RNG so a run can be reproduced
 * when debugging.
 */
export class Random {
  private state: number;

  constructor(seed = 0x9e3779b9) {
    this.state = seed >>> 0;
  }

  /** Re-seeds the generator. */
  seed(seed: number): void {
    this.state = seed >>> 0;
  }

  /** Uniform float in [0, 1). */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Uniform float in [min, max). */
  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  /** Uniform integer in [min, max] (inclusive). */
  int(min: number, max: number): number {
    return Math.floor(this.range(min, max + 1));
  }

  /** Symmetric variation: value ± fraction * value. */
  vary(value: number, fraction: number): number {
    return value * (1 + this.range(-fraction, fraction));
  }

  /** Approximately gaussian value (mean 0, sigma ~1) via sum of uniforms. */
  gaussian(): number {
    return (this.next() + this.next() + this.next() + this.next() - 2) * 1.1;
  }

  pick<T>(items: readonly T[]): T {
    return items[Math.floor(this.next() * items.length) % items.length];
  }

  /** Signed variation in [-amount, amount]. */
  jitter(amount: number): number {
    return this.range(-amount, amount);
  }
}

/** Shared instance for gameplay-level variation (throw noise, particles…). */
export const rng = new Random(0x5eed);

/** Separate instance so visual noise never desynchronises gameplay. */
export const visualRng = new Random(0xc0ffee);
