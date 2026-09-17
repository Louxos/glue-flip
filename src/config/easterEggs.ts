/**
 * Easter egg registry.
 *
 * Only the *identity* of each egg lives here; the trigger logic is in
 * `src/gameplay/EasterEggSystem.ts` (pure, unit-tested) and the effect is
 * applied by the app. Names, toasts and hints are translated through i18n with
 * the keys `egg.<id>`, `egg.<id>Toast` and `egg.<id>Hint`.
 *
 * The player-facing list lives in `EASTER_EGGS.md` at the repository root.
 */

export interface EasterEggDefinition {
  id: string;
  /**
   * Persisted eggs are written to the save and stay unlocked forever (secret
   * stick, secret surface, credits). Session eggs only last until reload.
   */
  persists: boolean;
  /** Short category, used by the docs and the debug overlay. */
  kind: 'input' | 'gameplay' | 'time';
}

export const EASTER_EGGS: EasterEggDefinition[] = [
  { id: 'konami', persists: true, kind: 'input' },
  { id: 'glueglue', persists: true, kind: 'input' },
  { id: 'credits', persists: true, kind: 'input' },
  { id: 'moon', persists: false, kind: 'input' },
  { id: 'velvet', persists: true, kind: 'gameplay' },
  { id: 'patience', persists: true, kind: 'gameplay' },
  { id: 'lostfound', persists: false, kind: 'gameplay' },
  { id: 'insomniac', persists: false, kind: 'time' },
];

export const EASTER_EGG_IDS = EASTER_EGGS.map((egg) => egg.id);

export function isEasterEggId(id: string): boolean {
  return EASTER_EGG_IDS.includes(id);
}

export function persistsEgg(id: string): boolean {
  return EASTER_EGGS.find((egg) => egg.id === id)?.persists ?? false;
}

/** Konami code, as `KeyboardEvent.code` values. */
export const KONAMI_SEQUENCE = [
  'ArrowUp',
  'ArrowUp',
  'ArrowDown',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'ArrowLeft',
  'ArrowRight',
  'KeyB',
  'KeyA',
] as const;

/** Word that triggers the `glueglue` egg. */
export const MAGIC_WORD = 'glue';

export const EGG_TIMING = {
  /** Window in which the G presses / title clicks must happen (s). */
  burstWindow: 2.5,
  /** G presses needed for the low-gravity egg. */
  gravityPresses: 3,
  /** Title clicks needed for the credits egg. */
  titleClicks: 7,
  /** Consecutive misses that earn a little help. */
  patienceMisses: 10,
  /** Consecutive sticks on the floor. */
  lostSticks: 5,
  /** Perfect landings (total, across sessions) that unlock the velvet pad. */
  velvetPerfects: 10,
  /** Gravity multiplier used by the `moon` egg. */
  lowGravityScale: 0.35,
} as const;
