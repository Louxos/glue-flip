import { Screen } from '@/ui/Screen';
import { t } from '@/ui/i18n';
import { el } from '@/utils/dom';
import type { UiCallbacks } from '@/ui/UIManager';

/** Pause overlay: resume, restart, settings, quit. */
export class PauseScreen extends Screen {
  private summary: HTMLElement;
  private summaryText = '';
  private callbacks: UiCallbacks;

  constructor(callbacks: UiCallbacks) {
    super('gf-overlay');
    this.callbacks = callbacks;
    this.summary = el('div', { class: 'gf-note', text: '' });
    this.build();
  }

  private build(): void {
    this.summary = el('div', { class: 'gf-note', text: this.summaryText });

    const card = el('div', { class: 'gf-card gf-panel' }, [
      el('div', { class: 'gf-card__header' }, [
        el('h2', { class: 'gf-card__title', text: t('pause.title') }),
      ]),
      el('div', { class: 'gf-card__body' }, [
        this.summary,
        el('p', { class: 'gf-hint', text: t('pause.hint') }),
      ]),
      el('div', { class: 'gf-card__footer' }, [
        this.button(t('pause.menu'), () => this.callbacks.onMenu()),
        this.button(t('pause.settings'), () => this.callbacks.onSettings()),
        this.button(t('pause.restart'), () => this.callbacks.onRestart()),
        this.button(t('pause.resume'), () => this.callbacks.onResume(), true),
      ]),
    ]);

    this.element.replaceChildren(card);
  }

  protected override onRebuild(): void {
    this.build();
  }

  setSummary(text: string): void {
    this.summaryText = text;
    this.summary.textContent = text;
  }

  private button(label: string, onClick: () => void, primary = false): HTMLElement {
    const button = el('button', {
      class: `gf-button${primary ? ' is-primary' : ''}`,
      type: 'button',
      text: label,
    });
    button.addEventListener('click', onClick);
    return button;
  }
}
