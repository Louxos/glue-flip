import type { Settings } from '@/core/SaveManager';
import type { QualityLevel } from '@/config/quality';
import { Screen } from '@/ui/Screen';
import { el } from '@/utils/dom';
import type { UiCallbacks } from '@/ui/UIManager';

/**
 * Settings. Every control writes straight to the save file, so preferences
 * survive a reload without an "apply" step.
 */
export class SettingsScreen extends Screen {
  private settings: Settings;
  private callbacks: UiCallbacks;
  private body: HTMLElement;
  private onCancel: (() => void) | null = null;

  constructor(settings: Settings, callbacks: UiCallbacks) {
    super('gf-overlay');
    this.settings = settings;
    this.callbacks = callbacks;
    this.body = el('div', { class: 'gf-card__body' });

    const card = el('div', { class: 'gf-card gf-panel' }, [
      el('div', { class: 'gf-card__header' }, [
        el('h2', { class: 'gf-card__title', text: 'Settings' }),
        this.closeButton(),
      ]),
      this.body,
      el('div', { class: 'gf-card__footer' }, [this.resetButton()]),
    ]);

    this.element.append(card);
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
      'aria-label': 'Close settings',
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
      text: 'Reset progress',
    });
    button.addEventListener('click', () => {
      button.textContent = 'Tap again to confirm';
      const revert = window.setTimeout(() => {
        button.textContent = 'Reset progress';
      }, 2600);
      button.addEventListener(
        'click',
        () => {
          window.clearTimeout(revert);
          this.callbacks.onResetProgress();
          button.textContent = 'Progress reset';
        },
        { once: true },
      );
    });
    return button;
  }

  private build(): void {
    this.body.replaceChildren();

    this.body.append(
      this.section('Audio'),
      this.slider('Master volume', 'masterVolume', 0, 1, 0.01, (v) => `${Math.round(v * 100)}%`),
      this.slider('Effects', 'sfxVolume', 0, 1, 0.01, (v) => `${Math.round(v * 100)}%`),
      this.slider('Ambience', 'ambienceVolume', 0, 1, 0.01, (v) => `${Math.round(v * 100)}%`),
      this.section('Graphics'),
      this.quality(),
      this.toggle('Performance mode', 'performanceMode', 'Lowest preset, effects off'),
      this.section('Controls'),
      this.slider('Camera sensitivity', 'cameraSensitivity', 0.3, 2.2, 0.05, (v) => v.toFixed(2)),
      this.slider('Throw sensitivity', 'throwSensitivity', 0.4, 2, 0.05, (v) => `${v.toFixed(2)}×`),
      this.toggle('Invert camera Y', 'invertCameraY'),
      this.toggle('Haptic feedback', 'haptics', 'Mobile vibration on landings'),
      this.section('Comfort'),
      this.toggle('Throw guide', 'showThrowGuide', 'Faint trajectory dots while holding'),
      this.toggle('Screen shake', 'screenShake'),
      this.toggle('Reduce motion', 'reducedMotion', 'Softens camera moves and slow motion'),
      this.section('Accessibility'),
      this.toggle('High contrast', 'highContrast', 'Stronger text and panel contrast'),
      this.textSize(),
      this.section('Tools'),
      this.toggle('Debug overlay', 'showDebug', 'Telemetry, colliders and vectors (F1)'),
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
        el('span', { class: 'gf-field__name', text: 'Text size' }),
        el('span', { class: 'gf-field__hint', text: 'Scales the whole interface' }),
      ]),
      container,
    ]);
  }

  private quality(): HTMLElement {
    const options: { id: QualityLevel | 'auto'; label: string }[] = [
      { id: 'auto', label: 'Auto' },
      { id: 'low', label: 'Perf' },
      { id: 'medium', label: 'Bal' },
      { id: 'high', label: 'High' },
      { id: 'ultra', label: 'Ultra' },
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
        el('span', { class: 'gf-field__name', text: 'Graphic quality' }),
        el('span', { class: 'gf-field__hint', text: 'Lower for a steadier frame rate' }),
      ]),
      container,
    ]);
  }
}
