import type { Settings, SaveManager } from '@/core/SaveManager';
import { setLanguage, t } from '@/ui/i18n';
import type { LandingResult } from '@/gameplay/LandingEvaluator';
import type { ScoreBreakdown } from '@/gameplay/ScoreSystem';
import type { HudState } from '@/gameplay/modes';
import { Screen } from '@/ui/Screen';
import { MenuScreen } from '@/ui/screens/MenuScreen';
import { HudScreen } from '@/ui/screens/HudScreen';
import { PauseScreen } from '@/ui/screens/PauseScreen';
import { SettingsScreen } from '@/ui/screens/SettingsScreen';
import { ChallengesScreen } from '@/ui/screens/ChallengesScreen';
import { ResultScreen } from '@/ui/screens/ResultScreen';
import type { ResultConfig } from '@/ui/screens/ResultScreen';
import { el } from '@/utils/dom';
import { isBrowser } from '@/utils/platform';
import { createLogger } from '@/utils/logger';

import '@/ui/styles/base.css';
import '@/ui/styles/menu.css';
import '@/ui/styles/hud.css';
import '@/ui/styles/overlays.css';

const log = createLogger('ui');

export interface UiCallbacks {
  onPlay: () => void;
  onChallenges: () => void;
  onOpenMode: () => void;
  onSettings: () => void;
  onCloseScreen: () => void;
  onResume: () => void;
  onRestart: () => void;
  onMenu: () => void;
  onPause: () => void;
  onSelectChallenge: (id: string) => void;
  onSelectStick: (id: string) => void;
  onSettingChange: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
  onResetProgress: () => void;
  onHover: () => void;
  /** The menu title was clicked (an easter egg counts them). */
  onTitleClick: () => void;
}

type ScreenName = 'menu' | 'hud' | 'pause' | 'settings' | 'challenges' | 'result';

/**
 * Owns the DOM overlay: which screen is up, toasts, the landing flash and the
 * debug panel. Gameplay never touches the DOM directly.
 */
export class UIManager {
  readonly root: HTMLElement;

  private save: SaveManager;
  private callbacks: UiCallbacks;
  private menu: MenuScreen;
  private hud: HudScreen;
  private pause: PauseScreen;
  private settings: SettingsScreen;
  private challenges: ChallengesScreen;
  private resultScreen: ResultScreen;
  private toasts: HTMLElement;
  private debugPanel: HTMLElement;
  private current: ScreenName | null = null;
  private settingsReturn: ScreenName = 'menu';

  constructor(root: HTMLElement, save: SaveManager, callbacks: UiCallbacks) {
    this.root = root;
    this.save = save;
    this.callbacks = callbacks;

    this.root.classList.add('gf-ui');
    setLanguage(save.settings.language);
    if (isBrowser()) document.documentElement.lang = save.settings.language;

    this.menu = new MenuScreen(save.all, callbacks);
    this.hud = new HudScreen(callbacks);
    this.pause = new PauseScreen(callbacks);
    this.settings = new SettingsScreen(save.settings, callbacks);
    this.challenges = new ChallengesScreen(save.all, callbacks);
    this.resultScreen = new ResultScreen();

    this.toasts = el('div', { class: 'gf-toasts' });
    this.debugPanel = el('div', { class: 'gf-debug', style: 'display:none' });

    for (const screen of this.allScreens()) this.root.append(screen.element);
    this.root.append(this.toasts, this.debugPanel);
  }

  private allScreens(): Screen[] {
    return [this.menu, this.hud, this.pause, this.settings, this.challenges, this.resultScreen];
  }

  private screen(name: ScreenName): Screen {
    switch (name) {
      case 'menu':
        return this.menu;
      case 'hud':
        return this.hud;
      case 'pause':
        return this.pause;
      case 'settings':
        return this.settings;
      case 'challenges':
        return this.challenges;
      case 'result':
        return this.resultScreen;
    }
  }

  get currentScreen(): ScreenName | null {
    return this.current;
  }

  // --- Screen switching --------------------------------------------------

  showMenu(): void {
    this.menu.refresh(this.save.all);
    this.hideOverlays();
    this.menu.show();
    this.hud.hide();
    this.current = 'menu';
  }

  showHud(): void {
    this.hideOverlays();
    this.menu.hide();
    this.hud.show();
    this.current = 'hud';
  }

  showPause(summary: string): void {
    this.pause.setSummary(summary);
    this.pause.show();
    this.current = 'pause';
  }

  hidePause(): void {
    this.pause.hide();
    if (this.current === 'pause') {
      this.hud.show();
      this.current = 'hud';
    }
  }

  get isPaused(): boolean {
    return this.pause.isVisible;
  }

  showSettings(from: ScreenName = 'menu'): void {
    this.settingsReturn = from;
    this.settings.setCancel(() => this.hideSettings());
    this.settings.show();
    this.current = 'settings';
  }

  hideSettings(): void {
    this.settings.hide();
    if (this.settingsReturn === 'pause') {
      this.pause.show();
      this.current = 'pause';
    } else {
      this.showMenu();
    }
  }

  showChallenges(): void {
    this.challenges.refresh(this.save.all);
    this.menu.hide();
    this.challenges.show();
    this.current = 'challenges';
  }

  presentResult(config: ResultConfig): void {
    this.resultScreen.present(config);
    this.current = 'result';
  }

  hideResult(): void {
    this.resultScreen.hide();
  }

  private hideOverlays(): void {
    this.pause.hide();
    this.settings.hide();
    this.challenges.hide();
    this.resultScreen.hide();
  }

  /** Closes whatever overlay is open and returns to the game or the menu. */
  closeTop(): void {
    if (this.settings.isVisible) {
      this.hideSettings();
      return;
    }
    if (this.resultScreen.isVisible) {
      this.hideResult();
      this.callbacks.onMenu();
      return;
    }
    if (this.challenges.isVisible) {
      this.challenges.hide();
      this.showMenu();
      return;
    }
    if (this.pause.isVisible) {
      this.callbacks.onResume();
      return;
    }
    if (this.hud.isVisible) this.callbacks.onPause();
  }

  // --- Gameplay feedback -------------------------------------------------

  updateHud(state: HudState): void {
    this.hud.update(state);
  }

  setPower(power: number | null, rotations = 0): void {
    this.hud.setPower(power, rotations);
  }

  showLanding(result: LandingResult, breakdown: ScoreBreakdown): void {
    this.hud.showLanding(result, breakdown);
  }

  setHint(text: string | null): void {
    this.hud.setHint(text);
  }

  toast(text: string, tone: 'info' | 'good' | 'bad' = 'info'): void {
    const node = el('div', { class: `gf-toast${tone === 'info' ? '' : ` is-${tone}`}`, text });
    this.toasts.append(node);
    window.setTimeout(() => {
      node.classList.add('is-leaving');
      window.setTimeout(() => node.remove(), 260);
    }, 1700);
    while (this.toasts.children.length > 3) this.toasts.firstElementChild?.remove();
  }

  setDebug(lines: string[] | null): void {
    if (!lines) {
      this.debugPanel.style.display = 'none';
      return;
    }
    this.debugPanel.style.display = '';
    this.debugPanel.textContent = lines.join('\n');
  }

  // --- Boot states -------------------------------------------------------

  fatal(title: string, message: string, error?: unknown): void {
    log.error(title, error);
    const box = el('div', { class: 'gf-fatal__box gf-panel' }, [
      el('h2', { text: title }),
      el('p', { text: message }),
      ...(error
        ? [el('code', { text: error instanceof Error ? error.message : String(error) })]
        : []),
    ]);
    const overlay = el('div', { class: 'gf-fatal' }, [box]);
    document.body.append(overlay);
  }

  refreshSave(): void {
    this.menu.refresh(this.save.all);
    this.challenges.refresh(this.save.all);
    this.settings.refresh(this.save.settings);
  }

  /**
   * Switches the interface language and rebuilds every screen in place, so the
   * change is visible immediately — including on the screen that triggered it.
   */
  applyLanguage(language: Settings['language']): void {
    setLanguage(language);
    if (isBrowser()) document.documentElement.lang = language;
    for (const screen of this.allScreens()) screen.rebuild();
    this.refreshSave();
  }

  /**
   * Applies the accessibility settings to the whole UI: text size and contrast.
   * Both are driven by CSS custom properties / a root attribute so every screen
   * (including ones built later) picks them up without extra plumbing.
   */
  applyAccessibility(settings: Settings): void {
    const root = document.documentElement;
    root.style.setProperty('--gf-text-scale', String(settings.textScale || 1));
    if (settings.highContrast) root.setAttribute('data-contrast', 'high');
    else root.removeAttribute('data-contrast');
  }

  dispose(): void {
    for (const screen of this.allScreens()) screen.dispose();
    this.toasts.remove();
    this.debugPanel.remove();
  }
}
