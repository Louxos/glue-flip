import type { Settings } from '@/core/SaveManager';
import type { QualityLevel } from '@/config/quality';
import { Screen } from '@/ui/Screen';
import { t } from '@/ui/i18n';
import { el } from '@/utils/dom';
import type { UiCallbacks } from '@/ui/UIManager';

/**
 * Settings. Every control writes straight to the save file, so preferences
 * survive a reload without an "apply" step.
 */
export class SettingsScreen extends Screen {
  private settings: Settings;
  private callbacks: UiCallbacks;
  private body!: HTMLElement;
  private onCancel: (() => void) | null = null;

  constructor(settings: Settings, callbacks: UiCallbacks) {
    super('gf-overlay');
    this.settings = settings;
    this.callbacks = callbacks;
    this.buildCard();
    this.build();
  }

  /** Creates the card shell (title and footer are language-dependent). */
  private buildCard(): void {
    this.body = el('div', { class: 'gf-card__body' });
    const card = el('div', { class: 'gf-card gf-panel' }, [
      el('div', { class: 'gf-card__header' }, [
        el('h2', { class: 'gf-card__title', text: t('settings.title') }),
        this.closeButton(),
      ]),
      this.body,
      el('div', { class: 'gf-card__footer' }, [this.resetButton()]),
    ]);
    this.element.replaceChildren(card);
  }

  /** Re-applies externally-changed settings (e.g. after a progress reset). */
  refresh(settings: Settings): void {
    this.settings = settings;
    this.build();
  }

  protected override onRebuild(): void {
    this.buildCard();
    this.build();
  }

  /** Lets the caller decide where "back" goes (menu vs pause). */
  setCancel(handler: () => void): void {
    this.onCancel = handler;
  }

  private closeButton(): HTMLElement {
    const button = el('button', {
      class: 'gf-icon-button',
      type: 'button',
      'aria-label': t('settings.close'),
      html:
        '<svg width="13" height="13" viewBox="0 0 13 13" aria-hidden="true">' +
        '<path d="M1.5 1.5l10 10M11.5 1.5l-10 10" stroke="currentColor" stroke-width="1.5" ' +
        'stroke-linecap="round" fill="none"/></svg>',
    });
    button.addEventListener('click', () => (this.onCancel ? this.onCancel() : this.callbacks.onCloseScreen()));
    return button;
  }

  private resetButton(): HTMLElement {
    const button = el('button', {
      class: 'gf-button is-ghost',
      type: 'button',
      text: t('settings.resetProgress'),
    });
    button.addEventListener('click', () => {
      button.textContent = t('settings.resetConfirm');
      const revert = window.setTimeout(() => {
        button.textContent = t('settings.resetProgress');
      }, 2600);
      button.addEventListener(
        'click',
        () => {
          window.clearTimeout(revert);
          this.callbacks.onResetProgress();
          button.textContent = t('settings.resetDone');
        },
        { once: true },
      );
    });
    return button;
  }

  private build(): void {
    this.body.replaceChildren();

    this.body.append(
      this.section(t('settings.sectionAudio')),
      this.slider(t('settings.masterVolume'), 'masterVolume', 0, 1, 0.01, (v) => `${Math.round(v * 100)}%`),
      this.slider(t('settings.sfxVolume'), 'sfxVolume', 0, 1, 0.01, (v) => `${Math.round(v * 100)}%`),
      this.slider(t('settings.ambienceVolume'), 'ambienceVolume', 0, 1, 0.01, (v) => `${Math.round(v * 100)}%`),
      this.section(t('settings.sectionLanguage')),
      this.language(),
      this.section(t('settings.sectionGraphics')),
      this.quality(),
      this.toggle(t('settings.performanceMode'), 'performanceMode', t('settings.performanceModeHint')),
      this.section(t('settings.sectionControls')),
      this.slider(t('settings.cameraSensitivity'), 'cameraSensitivity', 0.3, 2.2, 0.05, (v) => v.toFixed(2)),
      this.slider(t('settings.throwSensitivity'), 'throwSensitivity', 0.4, 2, 0.05, (v) => `${v.toFixed(2)}×`),
      this.toggle(t('settings.invertCameraY'), 'invertCameraY'),
      this.toggle(t('settings.haptics'), 'haptics', t('settings.hapticsHint')),
      this.section(t('settings.sectionComfort')),
      this.toggle(t('settings.showThrowGuide'), 'showThrowGuide', t('settings.showThrowGuideHint')),
      this.toggle(t('settings.screenShake'), 'screenShake'),
      this.toggle(t('settings.reducedMotion'), 'reducedMotion', t('settings.reducedMotionHint')),
      this.section(t('settings.sectionAccessibility')),
      this.toggle(t('settings.highContrast'), 'highContrast', t('settings.highContrastHint')),
      this.textSize(),
      this.section(t('settings.sectionTools')),
      this.toggle(t('settings.showDebug'), 'showDebug', t('settings.showDebugHint')),
    );
  }

  private section(title: string): HTMLElement {
    return el('span', { class: 'gf-eyebrow', text: title, style: 'margin-top:6px' });
  }

  private slider(
    label: string,
    key: 'masterVolume' | 'sfxVolume' | 'ambienceVolume' | 'cameraSensitivity' | 'throwSensitivity',
    min: number,
    max: number,
    step: number,
    format: (value: number) => string,
  ): HTMLElement {
    const value = el('span', { class: 'gf-value', text: format(this.settings[key]) });
    const input = el('input', {
      class: 'gf-slider',
      type: 'range',
      min,
      max,
      step,
      value: this.settings[key],
      'aria-label': label,
    }) as HTMLInputElement;

    input.addEventListener('input', () => {
      const next = Number(input.value);
      this.settings[key] = next;
      value.textContent = format(next);
      this.callbacks.onSettingChange(key, next);
    });

    return el('div', { class: 'gf-field' }, [
      el('div', { class: 'gf-field__label' }, [el('span', { class: 'gf-field__name', text: label })]),
      el('div', { style: 'display:flex;align-items:center;gap:10px' }, [input, value]),
    ]);
  }

  private toggle(label: string, key: keyof Settings, hint?: string): HTMLElement {
    const button = el('button', {
      class: 'gf-toggle',
      type: 'button',
      'aria-pressed': String(Boolean(this.settings[key])),
      'aria-label': label,
    });
    button.addEventListener('click', () => {
      const next = !this.settings[key];
      (this.settings as unknown as Record<string, unknown>)[key] = next;
      button.setAttribute('aria-pressed', String(next));
      this.callbacks.onSettingChange(key, next as never);
    });

    return el('div', { class: 'gf-field' }, [
      el('div', { class: 'gf-field__label' }, [
        el('span', { class: 'gf-field__name', text: label }),
        ...(hint ? [el('span', { class: 'gf-field__hint', text: hint })] : []),
      ]),
      button,
    ]);
  }

  /** Interface language. Applies immediately — every screen rebuilds itself. */
  private language(): HTMLElement {
    const options: { id: 'en' | 'fr'; label: string }[] = [
      { id: 'fr', label: 'Français' },
      { id: 'en', label: 'English' },
    ];
    const container = el('div', { class: 'gf-segmented' });
    const buttons = options.map((option) => {
      const button = el('button', {
        type: 'button',
        text: option.label,
        'aria-pressed': String(this.settings.language === option.id),
      });
      button.addEventListener('click', () => {
        this.settings.language = option.id;
        for (const other of buttons) {
          other.setAttribute('aria-pressed', String(other === button));
        }
        this.callbacks.onSettingChange('language', option.id);
      });
      return button;
    });
    container.append(...buttons);

    return el('div', { class: 'gf-field' }, [
      el('div', { class: 'gf-field__label' }, [
        el('span', { class: 'gf-field__name', text: t('settings.language') }),
        el('span', { class: 'gf-field__hint', text: t('settings.languageHint') }),
      ]),
      container,
    ]);
  }

  private textSize(): HTMLElement {
    const options = [
      { id: 0.9, label: 'S' },
      { id: 1, label: 'M' },
      { id: 1.12, label: 'L' },
      { id: 1.25, label: 'XL' },
    ];
    const container = el('div', { class: 'gf-segmented' });
    const buttons = options.map((option) => {
      const button = el('button', {
        type: 'button',
        text: option.label,
        'aria-pressed': String(Math.abs(this.settings.textScale - option.id) < 0.01),
      });
      button.addEventListener('click', () => {
        this.settings.textScale = option.id;
        for (const other of buttons) {
          other.setAttribute('aria-pressed', String(other === button));
        }
        this.callbacks.onSettingChange('textScale', option.id);
      });
      return button;
    });
    container.append(...buttons);

    return el('div', { class: 'gf-field' }, [
      el('div', { class: 'gf-field__label' }, [
        el('span', { class: 'gf-field__name', text: t('settings.textSize') }),
        el('span', { class: 'gf-field__hint', text: t('settings.textSizeHint') }),
      ]),
      container,
    ]);
  }

  private quality(): HTMLElement {
    const options: { id: QualityLevel | 'auto'; label: string }[] = [
      { id: 'auto', label: t('settings.quality.auto') },
      { id: 'low', label: t('settings.quality.low') },
      { id: 'medium', label: t('settings.quality.medium') },
      { id: 'high', label: t('settings.quality.high') },
      { id: 'ultra', label: t('settings.quality.ultra') },
    ];
    const container = el('div', { class: 'gf-segmented' });
    const buttons = options.map((option) => {
      const button = el('button', {
        type: 'button',
        text: option.label,
        'aria-pressed': String(this.settings.quality === option.id),
      });
      button.addEventListener('click', () => {
        this.settings.quality = option.id;
        for (const other of buttons) {
          other.setAttribute('aria-pressed', String(other === button));
        }
        this.callbacks.onSettingChange('quality', option.id);
      });
      container.append(button);
      return button;
    });

    return el('div', { class: 'gf-field' }, [
      el('div', { class: 'gf-field__label' }, [
        el('span', { class: 'gf-field__name', text: t('settings.quality') }),
        el('span', { class: 'gf-field__hint', text: t('settings.qualityHint') }),
      ]),
      container,
    ]);
  }
}
