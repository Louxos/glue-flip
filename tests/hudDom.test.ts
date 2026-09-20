// @vitest-environment jsdom
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { HudScreen } from '@/ui/screens/HudScreen';
import { MenuScreen } from '@/ui/screens/MenuScreen';
import type { UiCallbacks } from '@/ui/UIManager';
import { defaultSave } from '@/core/SaveManager';
import type { LandingResult } from '@/gameplay/LandingEvaluator';
import { setLanguage } from '@/ui/i18n';
import { FEEDBACK } from '@/config/gameplay';

/**
 * DOM tests.
 *
 * Everything above this file tests logic; this one is the only place the actual
 * UI is constructed and poked, so the miss flash, the translated verdict and the
 * simplified menu are exercised rather than merely type-checked.
 */

function callbacks(): UiCallbacks {
  const noop = () => undefined;
  return {
    onPlay: noop,
    onChallenges: noop,
    onOpenMode: noop,
    onSettings: noop,
    onCloseScreen: noop,
    onResume: noop,
    onRestart: noop,
    onMenu: noop,
    onPause: noop,
    onSelectChallenge: noop,
    onSelectStick: noop,
    onSettingChange: noop,
    onResetProgress: noop,
    onHover: noop,
    onTitleClick: noop,
  };
}

function landing(status: LandingResult['status'], reasonKey: string): LandingResult {
  return {
    status,
    tiltDeg: 40,
    precision: 0,
    baseDown: false,
    insideZone: false,
    reason: 'Toppled over',
    reasonKey,
    cleanliness: 0.4,
  };
}

beforeEach(() => setLanguage('en'));
afterEach(() => setLanguage('en'));

describe('HudScreen', () => {
  it('builds a red miss vignette into the DOM', () => {
    const hud = new HudScreen(callbacks());
    const flash = hud.element.querySelector<HTMLElement>('.gf-failflash');
    expect(flash).not.toBeNull();
    expect(flash!.getAttribute('aria-hidden')).toBe('true');
  });

  it('plays the flash and passes the intensity through as a CSS variable', () => {
    const hud = new HudScreen(callbacks());
    const flash = hud.element.querySelector<HTMLElement>('.gf-failflash')!;

    hud.flashFail(FEEDBACK.failFlash.opacity);

    expect(flash.classList.contains('is-show')).toBe(true);
    expect(flash.style.getPropertyValue('--gf-failflash-opacity')).toBe(
      String(FEEDBACK.failFlash.opacity),
    );
    expect(flash.style.getPropertyValue('--gf-failflash-duration')).toBe(
      `${FEEDBACK.failFlash.duration * 1000}ms`,
    );
  });

  it('replays the flash on a second miss instead of leaving a stuck class', () => {
    const hud = new HudScreen(callbacks());
    const flash = hud.element.querySelector<HTMLElement>('.gf-failflash')!;

    hud.flashFail(0.34);
    hud.flashFail(0.34);

    // restartAnimation drops and re-adds the class; it must end up present once.
    expect(flash.classList.contains('is-show')).toBe(true);
    expect(flash.className.split('is-show').length - 1).toBe(1);
  });

  it('shows the translated verdict for a miss', () => {
    const hud = new HudScreen(callbacks());
    hud.showLanding(landing('failed', 'toppled'), {
      total: 0,
      base: 0,
      precisionBonus: 0,
      perfectBonus: 0,
      difficultyMultiplier: 1,
      comboMultiplier: 1,
      success: false,
      perfect: false,
    });

    expect(hud.element.querySelector('.gf-result__title')!.textContent).toBe('FAILED');
    expect(hud.element.querySelector('.gf-result__sub')!.textContent).toBe('Toppled over');

    setLanguage('fr');
    hud.rebuild();
    hud.showLanding(landing('failed', 'toppled'), {
      total: 0,
      base: 0,
      precisionBonus: 0,
      perfectBonus: 0,
      difficultyMultiplier: 1,
      comboMultiplier: 1,
      success: false,
      perfect: false,
    });

    expect(hud.element.querySelector('.gf-result__title')!.textContent).toBe('RATÉ');
    expect(hud.element.querySelector('.gf-result__sub')!.textContent).toBe('Renversé');
  });
});

describe('MenuScreen', () => {
  it('offers one primary action and three secondary ones', () => {
    const menu = new MenuScreen(defaultSave(), callbacks());
    const primary = menu.element.querySelectorAll('.gf-button.is-primary');
    const secondary = menu.element.querySelectorAll('.gf-menu__secondary .gf-button');
    expect(primary).toHaveLength(1);
    expect(secondary).toHaveLength(3);
  });

  it('renders in French and rebuilds on a language change', () => {
    const menu = new MenuScreen(defaultSave(), callbacks());
    expect(menu.element.querySelector('.gf-title')!.textContent).toBe('Glue Flip');
    expect(menu.element.querySelector('.gf-menu__actions .gf-button')!.textContent).toBe('Play');

    setLanguage('fr');
    menu.rebuild();

    expect(menu.element.querySelector('.gf-menu__actions .gf-button')!.textContent).toBe('Jouer');
    const labels = [...menu.element.querySelectorAll('.gf-menu__secondary .gf-button')].map(
      (node) => node.textContent,
    );
    expect(labels).toEqual(['Défis', 'Mode libre', 'Réglages']);
  });

  /**
   * The chip is stateless on purpose: it asks the app to change the stick, and
   * the app writes the save and calls `refresh()` back — which is exactly what
   * this harness reproduces.
   */
  function cyclingMenu(save: ReturnType<typeof defaultSave>) {
    const seen: string[] = [];
    const menu = new MenuScreen(save, {
      ...callbacks(),
      onSelectStick: (id) => {
        seen.push(id);
        save.selectedGlueStick = id;
        menu.refresh(save);
      },
    });
    return { menu, seen };
  }

  it('cycles the stick chip through the ordinary sticks', () => {
    const save = defaultSave();
    const { menu, seen } = cyclingMenu(save);

    for (let i = 0; i < 4; i++) menu.element.querySelector<HTMLElement>('.gf-stick-chip')!.click();

    expect(seen).toEqual(['jumbo', 'slim', 'purple', 'classic']);
    // The secret golden stick stays out of the rotation.
    expect(seen).not.toContain('gold');
  });

  it('adds the golden stick to the rotation once its egg is found', () => {
    const save = defaultSave();
    save.easterEggs = ['konami'];
    const { menu, seen } = cyclingMenu(save);

    for (let i = 0; i < 5; i++) menu.element.querySelector<HTMLElement>('.gf-stick-chip')!.click();

    expect(seen).toContain('gold');
    expect(seen).toHaveLength(5);
  });
});
