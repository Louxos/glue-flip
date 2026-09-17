import {
  KONAMI_SEQUENCE,
  MAGIC_WORD,
  EGG_TIMING,
} from '@/config/easterEggs';
import { createLogger } from '@/utils/logger';

const log = createLogger('eggs');

/**
 * Everything that can trigger an easter egg.
 *
 * The system never touches the DOM, the scene or the save file: the app feeds it
 * events and applies whatever it reports back. That is what makes the triggers
 * unit-testable.
 */
export type EggEvent =
  /** A key was pressed. `code` is a `KeyboardEvent.code`. */
  | { type: 'key'; code: string; time: number; mode?: string }
  /** A printable character was typed (used for the magic word). */
  | { type: 'char'; char: string }
  /** The throw resolved. `offDesk` means it never came back to the desk. */
  | {
      type: 'throw';
      status: 'perfect' | 'landing' | 'failed' | 'lost';
      offDesk: boolean;
      perfectsTotal: number;
    }
  /** The menu title was clicked. */
  | { type: 'titleClick'; time: number }
  /** Wall-clock check, fed on boot and when the menu opens. */
  | { type: 'hour'; hour: number };

/**
 * What one event produced.
 *
 * The two lists answer different questions, and conflating them was a real bug:
 * an egg that was already known used to return nothing at all, so its *effect*
 * stopped happening — low gravity could be switched on but never off, and the
 * patience glow never came back in a later session.
 */
export interface EggTrigger {
  /** Every egg whose condition this event satisfied. Effects re-apply. */
  fired: string[];
  /** The subset seen for the first time. Announcements and saves use this. */
  discovered: string[];
}

const NO_TRIGGER: EggTrigger = { fired: [], discovered: [] };

export interface EggOptions {
  /** Ids already unlocked by the save file. */
  unlocked?: string[];
}

/**
 * Detects easter eggs.
 *
 * State is deliberately tiny: a key ring buffer, a typed-word buffer, two streak
 * counters and two burst timers. Feeding an event returns the list of egg ids it
 * just unlocked (usually empty), so the caller can react once.
 */
export class EasterEggSystem {
  private unlockedIds = new Set<string>();
  private keys: string[] = [];
  private typed = '';
  private missStreak = 0;
  private offDeskStreak = 0;
  private titleClicks: number[] = [];
  private gravityPresses: number[] = [];
  private lowGravity = false;

  constructor(options: EggOptions = {}) {
    for (const id of options.unlocked ?? []) this.unlockedIds.add(id);
  }

  /** Ids unlocked so far, in insertion order. */
  get unlocked(): string[] {
    return [...this.unlockedIds];
  }

  isUnlocked(id: string): boolean {
    return this.unlockedIds.has(id);
  }

  /** True while the `moon` egg has reduced gravity for this session. */
  get gravityReduced(): boolean {
    return this.lowGravity;
  }

  /** Gravity multiplier the app should apply right now (1 = Earth). */
  get gravityScale(): number {
    return this.lowGravity ? EGG_TIMING.lowGravityScale : 1;
  }

  /** Feeds one event and reports what fired and what was newly discovered. */
  feed(event: EggEvent): EggTrigger {
    switch (event.type) {
      case 'key':
        return this.onKey(event.code, event.time, event.mode);
      case 'char':
        return this.onChar(event.char);
      case 'throw':
        return this.onThrow(event);
      case 'titleClick':
        return this.onTitleClick(event.time);
      case 'hour':
        return this.onHour(event.hour);
      default:
        return NO_TRIGGER;
    }
  }

  // --- Triggers ----------------------------------------------------------

  private onKey(code: string, time: number, mode?: string): EggTrigger {
    const fired: string[] = [];

    // Konami code: matched against the tail of the recent key history.
    this.keys.push(code);
    if (this.keys.length > KONAMI_SEQUENCE.length) this.keys.shift();
    if (this.matchesKonami()) {
      this.keys = [];
      fired.push('konami');
    }

    // Low gravity: three G presses inside the burst window, in Open Mode.
    if (code === 'KeyG' && mode === 'open') {
      this.gravityPresses = this.gravityPresses
        .filter((at) => time - at < EGG_TIMING.burstWindow)
        .concat(time);
      if (this.gravityPresses.length >= EGG_TIMING.gravityPresses) {
        this.gravityPresses = [];
        this.lowGravity = !this.lowGravity;
        fired.push('moon');
      }
    }

    return this.report(fired);
  }

  private matchesKonami(): boolean {
    if (this.keys.length < KONAMI_SEQUENCE.length) return false;
    return KONAMI_SEQUENCE.every((code, index) => this.keys[index] === code);
  }

  private onChar(char: string): EggTrigger {
    const letter = char.toLowerCase();
    if (letter < 'a' || letter > 'z') {
      this.typed = '';
      return NO_TRIGGER;
    }
    this.typed = (this.typed + letter).slice(-MAGIC_WORD.length);
    if (this.typed === MAGIC_WORD) {
      this.typed = '';
      return this.report(['glueglue']);
    }
    return NO_TRIGGER;
  }

  private onThrow(event: Extract<EggEvent, { type: 'throw' }>): EggTrigger {
    const fired: string[] = [];
    const landed = event.status === 'perfect' || event.status === 'landing';

    this.missStreak = landed ? 0 : this.missStreak + 1;
    this.offDeskStreak = event.offDesk ? this.offDeskStreak + 1 : 0;

    if (this.missStreak >= EGG_TIMING.patienceMisses) {
      this.missStreak = 0;
      fired.push('patience');
    }
    if (this.offDeskStreak >= EGG_TIMING.lostSticks) {
      this.offDeskStreak = 0;
      fired.push('lostfound');
    }
    if (event.perfectsTotal >= EGG_TIMING.velvetPerfects) {
      fired.push('velvet');
    }
    return this.report(fired);
  }

  private onTitleClick(time: number): EggTrigger {
    this.titleClicks = this.titleClicks
      .filter((at) => time - at < EGG_TIMING.burstWindow)
      .concat(time);
    if (this.titleClicks.length >= EGG_TIMING.titleClicks) {
      this.titleClicks = [];
      return this.report(['credits']);
    }
    return NO_TRIGGER;
  }

  private onHour(hour: number): EggTrigger {
    if (hour >= 0 && hour < 4) return this.report(['insomniac']);
    return NO_TRIGGER;
  }

  /**
   * Splits what fired into "just discovered" and "already known", recording the
   * new ones. Effects are driven by `fired` so a repeat still does something.
   */
  private report(fired: string[]): EggTrigger {
    const discovered = fired.filter((id) => !this.unlockedIds.has(id));
    for (const id of discovered) {
      this.unlockedIds.add(id);
      log.info('easter egg unlocked', id);
    }
    return { fired, discovered };
  }
}
