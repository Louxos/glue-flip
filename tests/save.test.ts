import { describe, expect, it } from 'vitest';
import { SaveManager, defaultSave, mergeSave } from '@/core/SaveManager';
import type { KeyValueStorage, SaveData } from '@/core/SaveManager';
import { CHALLENGES } from '@/config/challenges';
import { WORLD } from '@/config/world';
import { getSurface } from '@/config/surfaces';
import { getGlueStick } from '@/config/glueSticks';

class MemoryStorage implements KeyValueStorage {
  readonly map = new Map<string, string>();
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

describe('SaveManager', () => {
  it('starts from defaults when nothing is stored', () => {
    const save = new SaveManager({ storage: new MemoryStorage() });
    expect(save.settings.masterVolume).toBeCloseTo(0.85);
    expect(save.all.best.classic.score).toBe(0);
  });

  it('persists settings and reads them back', () => {
    const storage = new MemoryStorage();
    const first = new SaveManager({ storage });
    first.setSetting('sfxVolume', 0.4);
    first.setSetting('quality', 'low');

    const second = new SaveManager({ storage });
    expect(second.settings.sfxVolume).toBeCloseTo(0.4);
    expect(second.settings.quality).toBe('low');
  });

  it('records bests without ever lowering them', () => {
    const save = new SaveManager({ storage: new MemoryStorage() });
    save.recordResult({ mode: 'classic', score: 900, combo: 6, level: 4, perfect: true });
    save.recordResult({ mode: 'classic', score: 300, combo: 2, level: 2, perfect: false });
    expect(save.all.best.classic.score).toBe(900);
    expect(save.all.best.classic.combo).toBe(6);
    expect(save.all.best.classic.level).toBe(4);
    expect(save.all.best.classic.perfects).toBe(1);
    expect(save.all.stats.landings).toBe(2);
  });

  it('tracks challenge completion', () => {
    const save = new SaveManager({ storage: new MemoryStorage() });
    save.recordChallenge('precision', { completed: true, best: 2 });
    expect(save.all.challenges.precision.completed).toBe(true);
    save.recordChallenge('precision', { best: 5 });
    expect(save.all.challenges.precision.best).toBe(5);
    expect(save.all.challenges.precision.completed).toBe(true);
  });

  it('survives a corrupted save file', () => {
    const storage = new MemoryStorage();
    storage.setItem('glue-flip.save.v1', '{not json');
    const save = new SaveManager({ storage });
    expect(save.all.version).toBe(defaultSave().version);
  });

  it('clamps out-of-range settings from an edited file', () => {
    const merged = mergeSave(defaultSave(), {
      settings: { masterVolume: 5, sfxVolume: -2, cameraSensitivity: 99 } as never,
    });
    expect(merged.settings.masterVolume).toBe(1);
    expect(merged.settings.sfxVolume).toBe(0);
    expect(merged.settings.cameraSensitivity).toBeLessThanOrEqual(3);
  });

  it('clamps the accessibility settings from an edited file', () => {
    const merged = mergeSave(defaultSave(), {
      settings: { textScale: 9, highContrast: 1 } as never,
    });
    expect(merged.settings.textScale).toBeLessThanOrEqual(1.25);
    expect(merged.settings.textScale).toBeGreaterThanOrEqual(0.9);
    expect(merged.settings.highContrast).toBe(true);
  });

  it('persists the accessibility settings', () => {
    const storage = new MemoryStorage();
    const save = new SaveManager({ storage });
    save.setSetting('textScale', 1.12);
    save.setSetting('highContrast', true);
    const reloaded = new SaveManager({ storage });
    expect(reloaded.settings.textScale).toBe(1.12);
    expect(reloaded.settings.highContrast).toBe(true);
  });

  it('merges partial saves without losing defaults', () => {
    const partial: Partial<SaveData> = { best: { classic: { score: 42 } } as never };
    const merged = mergeSave(defaultSave(), partial);
    expect(merged.best.classic.score).toBe(42);
    expect(merged.best.classic.combo).toBe(0);
    expect(merged.best.open.score).toBe(0);
  });

  it('reset restores defaults', () => {
    const save = new SaveManager({ storage: new MemoryStorage() });
    save.recordResult({ mode: 'classic', score: 500, combo: 3, level: 3, perfect: true });
    save.reset();
    expect(save.all.best.classic.score).toBe(0);
    expect(save.all.stats.throws).toBe(0);
  });
});

describe('content integrity', () => {
  it('every challenge fits on the desk', () => {
    for (const challenge of CHALLENGES) {
      const zoneZ = WORLD.spawn.z - challenge.distance;
      // Zone centre stays in the play area, and the whole zone stays on the desk.
      expect(zoneZ).toBeGreaterThanOrEqual(WORLD.playArea.minZ - 1e-9);
      expect(zoneZ).toBeLessThanOrEqual(WORLD.playArea.maxZ + 1e-9);
      expect(zoneZ - challenge.zoneRadius).toBeGreaterThanOrEqual(-WORLD.desk.depth / 2 + 0.02);
      expect(zoneZ + challenge.zoneRadius).toBeLessThanOrEqual(WORLD.desk.depth / 2 - 0.02);
      expect(getSurface(challenge.surfaceId).id).toBeTruthy();
      if (challenge.glueStickId) expect(getGlueStick(challenge.glueStickId).id).toBeTruthy();
      expect(challenge.attempts).toBeGreaterThanOrEqual(0);
      expect(challenge.goal.count).toBeGreaterThan(0);

      for (const obstacle of challenge.obstacles) {
        expect(Math.abs(obstacle.position[0])).toBeLessThan(WORLD.desk.width / 2);
        expect(Math.abs(zoneZ + obstacle.position[2])).toBeLessThan(WORLD.desk.depth / 2);
      }
    }
  });

  it('challenge ids are unique', () => {
    const ids = CHALLENGES.map((challenge) => challenge.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
