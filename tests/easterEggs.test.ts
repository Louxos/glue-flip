import { describe, expect, it } from 'vitest';
import {
  EASTER_EGG_IDS,
  KONAMI_SEQUENCE,
  EGG_TIMING,
  EGG_UNLOCKS,
  persistsEgg,
  unlockedContent,
} from '@/config/easterEggs';
import { GLUE_STICKS } from '@/config/glueSticks';
import { SURFACES } from '@/config/surfaces';
import { playableGlueSticks } from '@/config/glueSticks';
import { playableSurfaces } from '@/config/surfaces';
import { EasterEggSystem } from '@/gameplay/EasterEggSystem';
import type { EggEvent } from '@/gameplay/EasterEggSystem';

/**
 * Easter egg trigger tests.
 *
 * The detector is pure, so every secret can be exercised deterministically
 * without a DOM, a scene or a save file.
 */

function press(system: EasterEggSystem, code: string, time: number, mode = 'classic'): string[] {
  return system.feed({ type: 'key', code, time, mode });
}

function typeWord(system: EasterEggSystem, word: string): string[] {
  const found: string[] = [];
  for (const char of word) found.push(...system.feed({ type: 'char', char }));
  return found;
}

function throwEvent(
  system: EasterEggSystem,
  status: 'perfect' | 'landing' | 'failed' | 'lost',
  perfectsTotal: number,
): string[] {
  const event: EggEvent = {
    type: 'throw',
    status,
    offDesk: status === 'lost',
    perfectsTotal,
  };
  return system.feed(event);
}

describe('Konami code', () => {
  it('unlocks after the full sequence', () => {
    const eggs = new EasterEggSystem();
    let time = 0;
    for (const code of KONAMI_SEQUENCE.slice(0, -1)) {
      expect(press(eggs, code, (time += 0.1))).toEqual([]);
    }
    const found = press(eggs, KONAMI_SEQUENCE.at(-1)!, (time += 0.1));
    expect(found).toEqual(['konami']);
    expect(eggs.isUnlocked('konami')).toBe(true);
  });

  it('does not fire on a broken sequence', () => {
    const eggs = new EasterEggSystem();
    let time = 0;
    for (const code of [...KONAMI_SEQUENCE.slice(0, 5), 'ArrowUp']) {
      press(eggs, code, (time += 0.1));
    }
    expect(eggs.isUnlocked('konami')).toBe(false);
  });

  it('fires only once', () => {
    const eggs = new EasterEggSystem();
    let time = 0;
    for (let round = 0; round < 2; round++) {
      const found = KONAMI_SEQUENCE.flatMap((code) => press(eggs, code, (time += 0.1)));
      expect(found.filter((id) => id === 'konami')).toHaveLength(round === 0 ? 1 : 0);
    }
  });
});

describe('Magic word', () => {
  it('unlocks when GLUE is spelled, in any case', () => {
    expect(typeWord(new EasterEggSystem(), 'GLUE')).toEqual(['glueglue']);
    expect(typeWord(new EasterEggSystem(), 'glue')).toEqual(['glueglue']);
  });

  it('unlocks when the word appears inside a longer word', () => {
    expect(typeWord(new EasterEggSystem(), 'superglue')).toEqual(['glueglue']);
  });

  it('ignores other words and non-letters', () => {
    const eggs = new EasterEggSystem();
    typeWord(eggs, 'GLU');
    typeWord(eggs, '7');
    expect(eggs.isUnlocked('glueglue')).toBe(false);
  });
});

describe('Desk moon', () => {
  it('unlocks on three G presses in Open Mode and toggles gravity', () => {
    const eggs = new EasterEggSystem();
    expect(eggs.gravityScale).toBe(1);
    expect(press(eggs, 'KeyG', 0, 'open')).toEqual([]);
    expect(press(eggs, 'KeyG', 0.5, 'open')).toEqual([]);
    expect(press(eggs, 'KeyG', 1, 'open')).toEqual(['moon']);
    expect(eggs.gravityReduced).toBe(true);
    expect(eggs.gravityScale).toBeCloseTo(EGG_TIMING.lowGravityScale, 5);

    // Pressing again switches gravity back but does not re-report the egg.
    press(eggs, 'KeyG', 5, 'open');
    press(eggs, 'KeyG', 5.2, 'open');
    expect(press(eggs, 'KeyG', 5.4, 'open')).toEqual([]);
    expect(eggs.gravityReduced).toBe(false);
    expect(eggs.gravityScale).toBe(1);
  });

  it('ignores presses spread over more than the burst window', () => {
    const eggs = new EasterEggSystem();
    press(eggs, 'KeyG', 0, 'open');
    press(eggs, 'KeyG', 10, 'open');
    expect(press(eggs, 'KeyG', 20, 'open')).toEqual([]);
    expect(eggs.gravityReduced).toBe(false);
  });

  it('does nothing outside Open Mode', () => {
    const eggs = new EasterEggSystem();
    press(eggs, 'KeyG', 0, 'classic');
    press(eggs, 'KeyG', 0.2, 'classic');
    expect(press(eggs, 'KeyG', 0.4, 'classic')).toEqual([]);
  });
});

describe('Gameplay eggs', () => {
  it('unlocks the velvet pad after ten perfect landings in total', () => {
    const eggs = new EasterEggSystem();
    for (let i = 1; i < EGG_TIMING.velvetPerfects; i++) {
      expect(throwEvent(eggs, 'perfect', i)).toEqual([]);
    }
    expect(throwEvent(eggs, 'perfect', EGG_TIMING.velvetPerfects)).toEqual(['velvet']);
  });

  it('unlocks the patience assist after ten consecutive misses', () => {
    const eggs = new EasterEggSystem();
    for (let i = 0; i < EGG_TIMING.patienceMisses - 1; i++) {
      expect(throwEvent(eggs, 'failed', 0)).toEqual([]);
    }
    expect(throwEvent(eggs, 'failed', 0)).toEqual(['patience']);
  });

  it('resets the miss streak on a landing', () => {
    const eggs = new EasterEggSystem();
    for (let i = 0; i < EGG_TIMING.patienceMisses - 1; i++) throwEvent(eggs, 'failed', 0);
    throwEvent(eggs, 'landing', 0);
    for (let i = 0; i < EGG_TIMING.patienceMisses - 1; i++) {
      expect(throwEvent(eggs, 'failed', 0)).toEqual([]);
    }
    expect(eggs.isUnlocked('patience')).toBe(false);
  });

  it('unlocks lost-and-found after five sticks off the desk', () => {
    const eggs = new EasterEggSystem();
    for (let i = 0; i < EGG_TIMING.lostSticks - 1; i++) {
      expect(throwEvent(eggs, 'lost', 0)).toEqual([]);
    }
    expect(throwEvent(eggs, 'lost', 0)).toEqual(['lostfound']);
  });

  it('resets the off-desk streak when a throw stays on the desk', () => {
    const eggs = new EasterEggSystem();
    for (let i = 0; i < EGG_TIMING.lostSticks - 1; i++) throwEvent(eggs, 'lost', 0);
    throwEvent(eggs, 'landing', 0);
    expect(throwEvent(eggs, 'lost', 0)).toEqual([]);
    expect(eggs.isUnlocked('lostfound')).toBe(false);
  });
});

describe('Title clicks and late nights', () => {
  it('unlocks the credits after seven quick title clicks', () => {
    const eggs = new EasterEggSystem();
    for (let i = 0; i < EGG_TIMING.titleClicks - 1; i++) {
      expect(eggs.feed({ type: 'titleClick', time: i * 0.1 })).toEqual([]);
    }
    expect(eggs.feed({ type: 'titleClick', time: 0.6 })).toEqual(['credits']);
  });

  it('needs the clicks to be close together', () => {
    const eggs = new EasterEggSystem();
    for (let i = 0; i < EGG_TIMING.titleClicks; i++) {
      eggs.feed({ type: 'titleClick', time: i * 10 });
    }
    expect(eggs.isUnlocked('credits')).toBe(false);
  });

  it('unlocks the night shift egg between midnight and 4 a.m.', () => {
    expect(new EasterEggSystem().feed({ type: 'hour', hour: 0 })).toEqual(['insomniac']);
    expect(new EasterEggSystem().feed({ type: 'hour', hour: 3 })).toEqual(['insomniac']);
    expect(new EasterEggSystem().feed({ type: 'hour', hour: 4 })).toEqual([]);
    expect(new EasterEggSystem().feed({ type: 'hour', hour: 15 })).toEqual([]);
  });
});

/**
 * Regression: the first version compared egg ids against content ids, so finding
 * `konami` never revealed the `gold` stick — the reward was unreachable. Every
 * unlock must map onto a real, hidden piece of content.
 */
describe('egg unlocks', () => {
  it('maps each unlocking egg onto content that actually exists and is hidden', () => {
    const stickIds = GLUE_STICKS.map((stick) => stick.id);
    const surfaceIds = SURFACES.map((surface) => surface.id);

    for (const [egg, contents] of Object.entries(EGG_UNLOCKS)) {
      expect(EASTER_EGG_IDS).toContain(egg);
      for (const id of contents) {
        const isStick = stickIds.includes(id);
        const isSurface = surfaceIds.includes(id);
        expect(isStick || isSurface, `${egg} unlocks unknown content "${id}"`).toBe(true);
        const preset = isStick
          ? GLUE_STICKS.find((stick) => stick.id === id)!
          : SURFACES.find((surface) => surface.id === id)!;
        expect(preset.secret, `${id} should stay hidden until unlocked`).toBe(true);
      }
    }
  });

  it('reveals the golden stick once the Konami egg is found', () => {
    expect(playableGlueSticks(unlockedContent([])).map((s) => s.id)).not.toContain('gold');
    expect(playableGlueSticks(unlockedContent(['konami'])).map((s) => s.id)).toContain('gold');
  });

  it('reveals the velvet pad once the velvet egg is found', () => {
    expect(playableSurfaces(unlockedContent([])).map((s) => s.id)).not.toContain('velvet');
    expect(playableSurfaces(unlockedContent(['velvet'])).map((s) => s.id)).toContain('velvet');
  });

  it('ignores eggs that unlock nothing', () => {
    expect(unlockedContent(['moon', 'credits', 'patience'])).toEqual([]);
  });
});

describe('Save integration', () => {
  it('restores previously found eggs and never re-reports them', () => {
    const eggs = new EasterEggSystem({ unlocked: ['konami', 'velvet'] });
    expect(eggs.unlocked).toEqual(['konami', 'velvet']);
    let time = 0;
    const found = KONAMI_SEQUENCE.flatMap((code) => press(eggs, code, (time += 0.1)));
    expect(found).toEqual([]);
  });

  it('marks which eggs are worth persisting', () => {
    expect(persistsEgg('konami')).toBe(true);
    expect(persistsEgg('velvet')).toBe(true);
    expect(persistsEgg('credits')).toBe(true);
    expect(persistsEgg('moon')).toBe(false);
    expect(persistsEgg('insomniac')).toBe(false);
    expect(persistsEgg('lostfound')).toBe(false);
    expect(persistsEgg('patience')).toBe(true);
    // Every registered egg has a decision.
    expect(EASTER_EGG_IDS.length).toBe(8);
  });
});
