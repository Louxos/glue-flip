import { describe, expect, it } from 'vitest';
import { SaveManager } from '@/core/SaveManager';
import type { KeyValueStorage } from '@/core/SaveManager';
import { EventBus } from '@/core/EventBus';
import type { GameEvents } from '@/gameplay/GameEvents';
import { ClassicMode, ChallengeMode, OpenMode } from '@/gameplay/modes';
import type { GameContext } from '@/gameplay/GameContext';
import type { GameController } from '@/gameplay/GameController';
import type { LandingResult } from '@/gameplay/LandingEvaluator';
import { getChallenge } from '@/config/challenges';

/**
 * The auto-restart contract, per mode.
 *
 * The stick has to come back by itself after a throw, but *when it stops* is a
 * rule of the mode: Open Mode never stops, Challenges stop when the challenge is
 * settled, and Classic stops the moment a run ends — a miss is the end of a run
 * there, which is the whole point of a streak game. Getting this wrong either
 * locks the player out of the next throw or silently lets a run go on forever.
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

/** The slice of GameController the modes actually touch. */
function stubController(): GameController & { autoReset: boolean } {
  return {
    autoReset: false,
    configure: () => undefined,
  } as unknown as GameController & { autoReset: boolean };
}

function landing(status: LandingResult['status'], precision = 0.8): LandingResult {
  const success = status === 'landing' || status === 'perfect';
  return {
    status,
    tiltDeg: status === 'perfect' ? 1 : 9,
    precision,
    baseDown: success,
    insideZone: true,
    reason: status,
    reasonKey: success ? 'standing' : 'toppled',
    cleanliness: 0.9,
  };
}

function context(): { ctx: GameContext; events: EventBus<GameEvents>; save: SaveManager } {
  const save = new SaveManager({ storage: new MemoryStorage() });
  const events = new EventBus<GameEvents>();
  return { ctx: { save, events } as unknown as GameContext, events, save };
}

describe('Open Mode', () => {
  it('keeps resetting, even after repeated misses', () => {
    const { ctx } = context();
    const controller = stubController();
    const mode = new OpenMode(ctx);
    mode.start(controller);
    expect(controller.autoReset).toBe(true);

    for (let i = 0; i < 5; i++) {
      mode.onLanding(landing('failed'));
      expect(controller.autoReset).toBe(true);
    }
  });
});

describe('Classic Mode', () => {
  it('keeps resetting while landings hold the streak alive', () => {
    const { ctx } = context();
    const controller = stubController();
    const mode = new ClassicMode(ctx);
    mode.start(controller);

    mode.onLanding(landing('landing'));
    expect(controller.autoReset).toBe(true);
    mode.onLanding(landing('perfect'));
    expect(controller.autoReset).toBe(true);
  });

  it('stops the run on a miss — a miss is the end of a Classic run', () => {
    const { ctx, events } = context();
    const controller = stubController();
    const mode = new ClassicMode(ctx);
    mode.start(controller);

    let runOver = false;
    events.on('run:over', () => (runOver = true));

    mode.onLanding(landing('landing'));
    expect(controller.autoReset).toBe(true);

    mode.onLanding(landing('failed'));
    expect(controller.autoReset).toBe(false);
    expect(runOver).toBe(true);
  });
});

describe('Challenge Mode', () => {
  it('keeps resetting after a miss while attempts remain', () => {
    const { ctx } = context();
    const controller = stubController();
    // 'long-shot' has a 12-throw budget, so one miss cannot end it.
    const mode = new ChallengeMode(ctx, getChallenge('long-shot')!);
    mode.start(controller);

    mode.onLanding(landing('failed'));
    expect(controller.autoReset).toBe(true);
    mode.onLanding(landing('failed'));
    expect(controller.autoReset).toBe(true);
  });

  it('stops when the throw budget runs out', () => {
    const { ctx, events } = context();
    const controller = stubController();
    const challenge = getChallenge('long-shot')!;
    const mode = new ChallengeMode(ctx, challenge);
    mode.start(controller);

    let failed = false;
    events.on('challenge:failed', () => (failed = true));

    for (let i = 0; i < challenge.attempts - 1; i++) {
      mode.onLanding(landing('failed'));
      expect(controller.autoReset).toBe(true);
    }

    mode.onLanding(landing('failed'));
    expect(controller.autoReset).toBe(false);
    expect(failed).toBe(true);
  });

  it('stops when the goal is reached, without failing the challenge', () => {
    const { ctx, events } = context();
    const controller = stubController();
    const mode = new ChallengeMode(ctx, getChallenge('first-blood')!);
    mode.start(controller);

    let complete = false;
    let failed = false;
    events.on('challenge:complete', () => (complete = true));
    events.on('challenge:failed', () => (failed = true));

    mode.onLanding(landing('landing'));

    expect(controller.autoReset).toBe(false);
    expect(complete).toBe(true);
    expect(failed).toBe(false);
  });
});
