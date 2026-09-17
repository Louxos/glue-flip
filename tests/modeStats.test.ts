import { describe, expect, it } from 'vitest';
import { SaveManager } from '@/core/SaveManager';
import type { KeyValueStorage } from '@/core/SaveManager';
import { EventBus } from '@/core/EventBus';
import type { GameEvents } from '@/gameplay/GameEvents';
import { OpenMode } from '@/gameplay/modes';
import type { GameContext } from '@/gameplay/GameContext';
import type { LandingResult } from '@/gameplay/LandingEvaluator';

/**
 * Lifetime stats regression tests.
 *
 * Two bugs lived here: Open Mode never emitted `landing:result`, so the HUD
 * verdict and the easter-egg detector saw nothing; and only Classic Mode wrote
 * `stats.perfects`, so the menu counter and the "ten perfects" secret ignored
 * every landing made anywhere else.
 */

class MemoryStorage implements KeyValueStorage {
  private map = new Map<string, string>();
  getItem(key: string): string | null {
    return this.map.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }
  removeItem(key: string): void {
    this.map.delete(key);
  }
}

function landing(status: LandingResult['status'], precision = 0.8): LandingResult {
  return {
    status,
    tiltDeg: status === 'perfect' ? 1 : 9,
    precision,
    baseDown: status !== 'failed',
    insideZone: true,
    reason: status,
    reasonKey: status === 'perfect' ? 'vertical' : 'standing',
    cleanliness: 0.9,
  };
}

/** The smallest context OpenMode actually touches. */
function contextFor(save: SaveManager): { ctx: GameContext; events: EventBus<GameEvents> } {
  const events = new EventBus<GameEvents>();
  const ctx = { save, events } as unknown as GameContext;
  return { ctx, events };
}

describe('lifetime stats', () => {
  it('recordLanding counts landings and perfects on its own', () => {
    const save = new SaveManager({ storage: new MemoryStorage() });
    save.recordLanding(true);
    save.recordLanding(false);
    save.recordLanding(true);
    expect(save.all.stats.landings).toBe(3);
    expect(save.all.stats.perfects).toBe(2);
  });

  it('recordResult still counts stats exactly once', () => {
    const save = new SaveManager({ storage: new MemoryStorage() });
    save.recordResult({ mode: 'classic', score: 100, combo: 1, level: 1, perfect: true });
    expect(save.all.stats.landings).toBe(1);
    expect(save.all.stats.perfects).toBe(1);
  });

  it('Open Mode perfect landings reach the lifetime counter', () => {
    const save = new SaveManager({ storage: new MemoryStorage() });
    const { ctx } = contextFor(save);
    const mode = new OpenMode(ctx);

    mode.onLanding(landing('perfect'));
    mode.onLanding(landing('landing'));
    mode.onLanding(landing('failed'));

    expect(save.all.stats.landings).toBe(3);
    expect(save.all.stats.perfects).toBe(1);
    expect(save.all.best.open.score).toBe(2);
  });

  it('Open Mode emits landing:result so the HUD and eggs can react', () => {
    const save = new SaveManager({ storage: new MemoryStorage() });
    const { ctx, events } = contextFor(save);
    const seen: string[] = [];
    events.on('landing:result', ({ result }) => seen.push(result.status));

    const mode = new OpenMode(ctx);
    mode.onLanding(landing('perfect'));
    mode.onLanding(landing('failed'));

    expect(seen).toEqual(['perfect', 'failed']);
  });

  it('stats are persisted, so the ten-perfect secret survives a reload', () => {
    const storage = new MemoryStorage();
    const first = new SaveManager({ storage });
    for (let i = 0; i < 10; i++) first.recordLanding(true);
    expect(first.all.stats.perfects).toBe(10);

    const reloaded = new SaveManager({ storage });
    expect(reloaded.all.stats.perfects).toBe(10);
  });
});
