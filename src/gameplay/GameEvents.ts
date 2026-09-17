import type { LandingResult } from '@/gameplay/LandingEvaluator';
import type { ScoreBreakdown } from '@/gameplay/ScoreSystem';
import type { SurfaceAudio } from '@/config/surfaces';

/**
 * Events flowing between gameplay, UI, audio and camera.
 * Keeping them typed means a typo in an event name is a compile error.
 */

export type ThrowPhase = 'idle' | 'held' | 'flight' | 'settling' | 'resolved';

export interface GameEvents {
  'phase:change': { phase: ThrowPhase };
  'throw:grabbed': { power: number };
  'throw:released': { power: number; rotations: number; speed: number };
  'throw:hold': { power: number; rotations: number; speed: number };
  'impact': { surface: SurfaceAudio; speed: number; pan: number; flatness: number };
  'bounce': { surface: SurfaceAudio; speed: number };
  'slide': { surface: SurfaceAudio; speed: number };
  'landing:evaluated': {
    result: LandingResult;
    flightTime: number;
    /** Speed just before the stick settled. */
    impactSpeed: number;
  };
  'landing:result': {
    result: LandingResult;
    breakdown: ScoreBreakdown;
    score: number;
    combo: number;
    level: number;
  };
  'score:change': { score: number; combo: number; bestCombo: number; level: number };
  'level:change': { level: number; note: string };
  'mode:change': { mode: 'menu' | 'classic' | 'challenge' | 'open'; label: string };
  'challenge:progress': { completed: number; total: number; attemptsLeft: number };
  'challenge:complete': { id: string; name: string; rewardText?: string };
  'challenge:failed': { id: string; name: string };
  'run:over': { score: number; bestCombo: number; landings: number; perfects: number; level: number };
  'toast': { text: string; tone?: 'info' | 'good' | 'bad' };
  'settings:change': { key: string };
}

export type GameEventBus = import('@/core/EventBus').EventBus<GameEvents>;
