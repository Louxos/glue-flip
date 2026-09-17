import { Screen } from '@/ui/Screen';
import { el } from '@/utils/dom';
import type { UiCallbacks } from '@/ui/UIManager';

/** Pause overlay: resume, restart, settings, quit. */
export class PauseScreen extends Screen {
  private summary: HTMLElement;

  constructor(callbacks: UiCallbacks) {
    super('gf-overlay');

    this.summary = el('div', { class: 'gf-note', text: '' });

    const card = el('div', { class: 'gf-card gf-panel' }, [
      el('div', { class: 'gf-card__header' }, [
        el('h2', { class: 'gf-card__title', text: 'Paused' }),
      ]),
      el('div', { class: 'gf-card__body' }, [
        this.summary,
        el('p', {
          class: 'gf-hint',
          text: 'Drag to orbit the camera · Flick the glue stick to throw · Esc to resume',
        }),
      ]),
      el('div', { class: 'gf-card__footer' }, [
        this.button('Menu', () => callbacks.onMenu()),
        this.button('Settings', () => callbacks.onSettings()),
        this.button('Restart', () => callbacks.onRestart()),
        this.button('Resume', () => callbacks.onResume(), true),
      ]),
    ]);

    this.element.append(card);
  }

  setSummary(text: string): void {
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
