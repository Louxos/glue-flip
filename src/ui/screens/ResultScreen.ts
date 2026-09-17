import { Screen } from '@/ui/Screen';
import { el } from '@/utils/dom';

/** Generic result card: run over, challenge complete, challenge failed. */
export interface ResultConfig {
  title: string;
  note?: string;
  summary: { label: string; value: string | number }[];
  buttons: { label: string; primary?: boolean; run: () => void }[];
}

export class ResultScreen extends Screen {
  private titleNode: HTMLElement;
  private noteNode: HTMLElement;
  private summaryNode: HTMLElement;
  private footerNode: HTMLElement;

  constructor() {
    super('gf-overlay');
    this.titleNode = el('h2', { class: 'gf-card__title', text: '' });
    this.noteNode = el('p', { class: 'gf-note', text: '' });
    this.summaryNode = el('div', { class: 'gf-summary' });
    this.footerNode = el('div', { class: 'gf-card__footer' });

    const card = el('div', { class: 'gf-card gf-panel' }, [
      el('div', { class: 'gf-card__header' }, [this.titleNode]),
      el('div', { class: 'gf-card__body' }, [this.summaryNode, this.noteNode]),
      this.footerNode,
    ]);
    this.element.append(card);
  }

  present(config: ResultConfig): void {
    this.titleNode.textContent = config.title;
    this.noteNode.textContent = config.note ?? '';
    this.noteNode.style.display = config.note ? '' : 'none';

    this.summaryNode.replaceChildren(
      ...config.summary.map((item) =>
        el('div', { class: 'gf-summary__item' }, [
          el('span', { class: 'gf-summary__value', text: String(item.value) }),
          el('span', { class: 'gf-summary__label', text: item.label }),
        ]),
      ),
    );

    this.footerNode.replaceChildren(
      ...config.buttons.map((button) => {
        const node = el('button', {
          class: `gf-button${button.primary ? ' is-primary' : ''}`,
          type: 'button',
          text: button.label,
        });
        node.addEventListener('click', button.run);
        return node;
      }),
    );

    this.show();
  }
}
