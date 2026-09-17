import { STORAGE_KEYS } from '@/config/gameplay';
import type { QualityLevel } from '@/config/quality';
import { createLogger } from '@/utils/logger';

const log = createLogger('save');

export type GameModeId = 'menu' | 'classic' | 'challenge' | 'open';

export interface Settings {
  masterVolume: number;
  sfxVolume: number;
  ambienceVolume: number;
  /** 'auto' resolves to a detected preset at runtime. */
  quality: QualityLevel | 'auto';
  cameraSensitivity: number;
  throwSensitivity: number;
  performanceMode: boolean;
  showThrowGuide: boolean;
  screenShake: boolean;
  invertCameraY: boolean;
  reducedMotion: boolean;
  showDebug: boolean;
  haptics: boolean;
  /** Stronger text and panel contrast for bright rooms / low-vision players. */
  highContrast: boolean;
  /** UI text size multiplier (0.9 – 1.25). */
  textScale: number;
}

export interface ModeRecord {
  score: number;
  combo: number;
  level: number;
  perfects: number;
}

export interface ChallengeRecord {
  completed: boolean;
  best: number;
  attemptsUsed: number;
}

export interface SaveData {
  version: number;
  settings: Settings;
  best: {
    classic: ModeRecord;
    open: ModeRecord;
  };
  challenges: Record<string, ChallengeRecord>;
  selectedGlueStick: string;
  lastMode: GameModeId;
  stats: {
    throws: number;
    landings: number;
    perfects: number;
    playTimeMs: number;
  };
}

export const SAVE_VERSION = 1;

export const DEFAULT_SETTINGS: Settings = {
  masterVolume: 0.85,
  sfxVolume: 0.9,
  ambienceVolume: 0.55,
  quality: 'auto',
  cameraSensitivity: 1,
  throwSensitivity: 1,
  performanceMode: false,
  showThrowGuide: true,
  screenShake: true,
  invertCameraY: false,
  reducedMotion: false,
  showDebug: false,
  haptics: true,
  highContrast: false,
  textScale: 1,
};

export function defaultSave(): SaveData {
  return {
    version: SAVE_VERSION,
    settings: { ...DEFAULT_SETTINGS },
    best: {
      classic: { score: 0, combo: 0, level: 0, perfects: 0 },
      open: { score: 0, combo: 0, level: 0, perfects: 0 },
    },
    challenges: {},
    selectedGlueStick: 'classic',
    lastMode: 'menu',
    stats: { throws: 0, landings: 0, perfects: 0, playTimeMs: 0 },
  };
}

/** Pluggable storage so the save layer is testable outside a browser. */
export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

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

function resolveStorage(explicit?: KeyValueStorage): KeyValueStorage {
  if (explicit) return explicit;
  if (typeof localStorage !== 'undefined') {
    try {
      // Private-mode Safari throws on write; probe once.
      localStorage.setItem('__glue_flip_probe__', '1');
      localStorage.removeItem('__glue_flip_probe__');
      return localStorage;
    } catch {
      log.warn('localStorage unavailable, falling back to in-memory storage');
    }
  }
  return new MemoryStorage();
}

export class SaveManager {
  private data: SaveData;
  private storage: KeyValueStorage;
  private key: string;
  private dirty = false;

  constructor(options: { storage?: KeyValueStorage; key?: string } = {}) {
    this.storage = resolveStorage(options.storage);
    this.key = options.key ?? STORAGE_KEYS.save;
    this.data = this.load();
  }

  private load(): SaveData {
    const base = defaultSave();
    try {
      const raw = this.storage.getItem(this.key);
      if (!raw) return base;
      const parsed = JSON.parse(raw) as Partial<SaveData>;
      return mergeSave(base, parsed);
    } catch (error) {
      log.warn('corrupted save file, starting fresh', error);
      return base;
    }
  }

  get all(): SaveData {
    return this.data;
  }

  get settings(): Settings {
    return this.data.settings;
  }

  update(mutator: (data: SaveData) => void): SaveData {
    mutator(this.data);
    this.dirty = true;
    this.persist();
    return this.data;
  }

  setSetting<K extends keyof Settings>(key: K, value: Settings[K]): void {
    this.data.settings[key] = value;
    this.dirty = true;
    this.persist();
  }

  /** Registers a result and updates bests. Returns the updated save. */
  recordResult(input: {
    mode: 'classic' | 'open';
    score: number;
    combo: number;
    level: number;
    perfect: boolean;
  }): SaveData {
    const record = this.data.best[input.mode];
    record.score = Math.max(record.score, input.score);
    record.combo = Math.max(record.combo, input.combo);
    record.level = Math.max(record.level, input.level);
    if (input.perfect) record.perfects += 1;
    this.data.stats.landings += 1;
    if (input.perfect) this.data.stats.perfects += 1;
    this.dirty = true;
    this.persist();
    return this.data;
  }

  recordThrow(): void {
    this.data.stats.throws += 1;
    this.dirty = true;
    this.persist();
  }

  recordChallenge(id: string, patch: Partial<ChallengeRecord>): void {
    const existing = this.data.challenges[id] ?? { completed: false, best: 0, attemptsUsed: 0 };
    this.data.challenges[id] = { ...existing, ...patch };
    this.dirty = true;
    this.persist();
  }

  addPlayTime(ms: number): void {
    this.data.stats.playTimeMs += ms;
    this.dirty = true;
  }

  /** Writes pending changes; cheap enough to call on every mutation. */
  persist(): void {
    if (!this.dirty) return;
    try {
      this.storage.setItem(this.key, JSON.stringify(this.data));
      this.dirty = false;
    } catch (error) {
      log.warn('could not persist save', error);
    }
  }

  reset(): void {
    this.data = defaultSave();
    this.dirty = true;
    this.persist();
  }
}

/** Deep-ish merge that tolerates older/partial save files. */
export function mergeSave(base: SaveData, patch: Partial<SaveData>): SaveData {
  const merged: SaveData = {
    ...base,
    ...patch,
    settings: { ...base.settings, ...(patch.settings ?? {}) },
    best: {
      classic: { ...base.best.classic, ...(patch.best?.classic ?? {}) },
      open: { ...base.best.open, ...(patch.best?.open ?? {}) },
    },
    challenges: { ...(patch.challenges ?? {}) },
    stats: { ...base.stats, ...(patch.stats ?? {}) },
  };
  // Clamp numeric settings in case a hand-edited file went out of range.
  merged.settings.masterVolume = clamp01(merged.settings.masterVolume);
  merged.settings.sfxVolume = clamp01(merged.settings.sfxVolume);
  merged.settings.ambienceVolume = clamp01(merged.settings.ambienceVolume);
  merged.settings.cameraSensitivity = clampRange(merged.settings.cameraSensitivity, 0.2, 3);
  merged.settings.throwSensitivity = clampRange(merged.settings.throwSensitivity, 0.2, 3);
  merged.settings.textScale = clampRange(merged.settings.textScale, 0.9, 1.25);
  merged.settings.highContrast = Boolean(merged.settings.highContrast);
  return merged;
}

function clamp01(v: number): number {
  return Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0;
}

function clampRange(v: number, min: number, max: number): number {
  return Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : min;
}
