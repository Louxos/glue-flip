import { describe, expect, it, afterEach } from 'vitest';
import { CHALLENGES } from '@/config/challenges';
import { GLUE_STICKS } from '@/config/glueSticks';
import { SURFACES } from '@/config/surfaces';
import {
  TRANSLATION_KEYS,
  dictionaryCoverage,
  getLanguage,
  setLanguage,
  t,
  tOr,
} from '@/ui/i18n';

/**
 * Translation tests.
 *
 * The interface ships in English and French, and a missing key must never reach
 * the player as a raw `settings.sectionTools` string. These tests pin parity and
 * the fallback behaviour.
 */

afterEach(() => setLanguage('en'));

describe('i18n dictionaries', () => {
  it('the French dictionary covers every English key', () => {
    const coverage = dictionaryCoverage('fr');
    expect(coverage.missing).toEqual([]);
    expect(coverage.total).toBeGreaterThan(100);
  });

  it('the English dictionary is complete by construction', () => {
    expect(dictionaryCoverage('en').missing).toEqual([]);
    expect(TRANSLATION_KEYS.length).toBe(new Set(TRANSLATION_KEYS).size);
  });

  it('switches language and reports the active one', () => {
    expect(getLanguage()).toBe('en');
    setLanguage('fr');
    expect(getLanguage()).toBe('fr');
    expect(t('menu.play')).toBe('Jouer');
    setLanguage('en');
    expect(t('menu.play')).toBe('Play');
  });

  it('ignores an unknown language instead of blanking the UI', () => {
    setLanguage('fr');
    setLanguage('de' as never);
    expect(getLanguage()).toBe('fr');
  });

  it('substitutes placeholders in both languages', () => {
    expect(t('toast.throwsLeft', { count: 2 })).toBe('2 throws left');
    setLanguage('fr');
    expect(t('toast.throwsLeft', { count: 2 })).toBe('2 lancers restants');
  });

  it('leaves an unknown placeholder untouched rather than printing undefined', () => {
    expect(t('result.personalBest')).toBe('Personal best: {score}');
  });

  it('returns the key when it does not exist anywhere', () => {
    expect(t('does.not.exist' as never)).toBe('does.not.exist');
  });
});

describe('i18n data strings', () => {
  it('translates id-based keys and falls back to the given text', () => {
    setLanguage('fr');
    expect(tOr('surface.wood.name', 'Oak Desk')).toBe('Bureau en chêne');
    expect(tOr('surface.unobtainium.name', 'Mystery Pad')).toBe('Mystery Pad');
  });

  it('has a translated name for every glue stick', () => {
    for (const language of ['en', 'fr'] as const) {
      setLanguage(language);
      for (const stick of GLUE_STICKS) {
        const name = tOr(`stick.${stick.id}.name`, '');
        expect(name, `${language}: stick.${stick.id}.name`).not.toBe('');
        expect(name).not.toBe(`stick.${stick.id}.name`);
        expect(tOr(`stick.${stick.id}.tagline`, '')).not.toBe('');
      }
    }
  });

  it('has a translated name for every surface', () => {
    for (const language of ['en', 'fr'] as const) {
      setLanguage(language);
      for (const surface of SURFACES) {
        expect(tOr(`surface.${surface.id}.name`, ''), `${language}: ${surface.id}`).not.toBe('');
      }
    }
  });

  it('has a translated name and brief for every challenge', () => {
    for (const language of ['en', 'fr'] as const) {
      setLanguage(language);
      for (const challenge of CHALLENGES) {
        expect(tOr(`challenge.${challenge.id}.name`, '')).not.toBe('');
        expect(tOr(`challenge.${challenge.id}.brief`, '')).not.toBe('');
      }
    }
  });
});
