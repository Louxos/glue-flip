import { CHALLENGES } from '@/config/challenges';
import { getSurface } from '@/config/surfaces';
import type { SaveData } from '@/core/SaveManager';
import { Screen } from '@/ui/Screen';
import { el } from '@/utils/dom';
import type { UiCallbacks } from '@/ui/UIManager';

/** Challenge browser: twelve set-ups that each test a different physical skill. */
export class ChallengesScreen extends Screen {
  private list: HTMLElement;
  private save: SaveData;
  private callbacks: UiCallbacks;

  constructor(save: SaveData, callbacks: UiCallbacks) {
    super('gf-overlay');
    this.save = save;
    this.callbacks = callbacks;
    this.list = el('div', { class: 'gf-challenges' });

    const card = el('div', { class: 'gf-card gf-panel' }, [
      el('div', { class: 'gf-card__header' }, [
        el('div', {}, [
          el('h2', { class: 'gf-card__title', text: 'Challenges' }),
          el('p', { class: 'gf-hint', text: 'Each one is a different surface, distance or obstacle.' }),
        ]),
        this.backButton(callbacks),
      ]),
      el('div', { class: 'gf-card__body' }, [this.list]),
    ]);

    this.element.append(card);
    this.build();
  }

  private backButton(callbacks: UiCallbacks): HTMLElement {
    const button = el('button', {
      class: 'gf-icon-button',
      type: 'button',
      'aria-label': 'Back',
      html:
        '<svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">' +
        '<path d="M9 2L4 7l5 5" stroke="currentColor" stroke-width="1.6" fill="none" ' +
        'stroke-linecap="round" stroke-linejoin="round"/></svg>',
    });
    button.addEventListener('click', () => callbacks.onCloseScreen());
    return button;
  }

  private build(): void {
    this.list.replaceChildren();
    CHALLENGES.forEach((challenge, index) => {
      const record = this.save.challenges[challenge.id];
      const status = el('span', {
        class: `gf-challenge__status${record?.completed ? ' is-done' : ''}`,
        text: record?.completed ? 'Done' : `${getSurface(challenge.surfaceId).name}`,
      });

      const dots = el('span', { class: 'gf-difficulty' });
      for (let i = 0; i < 5; i++) {
        dots.append(el('span', { class: i < challenge.difficulty ? 'is-on' : '' }));
      }

      const button = el('button', { class: 'gf-challenge', type: 'button' }, [
        el('span', { class: 'gf-challenge__index', text: String(index + 1).padStart(2, '0') }),
        el('div', { class: 'gf-challenge__body' }, [
          el('span', { class: 'gf-challenge__name', text: challenge.name }),
          el('span', { class: 'gf-challenge__brief', text: challenge.brief }),
        ]),
        status,
        dots,
      ]);
      button.addEventListener('click', () => this.callbacks.onSelectChallenge(challenge.id));
      this.list.append(button);
    });
  }

  refresh(save: SaveData): void {
    this.save = save;
    this.build();
  }

  protected override onShow(): void {
    this.build();
  }
}

