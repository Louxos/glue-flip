import { GLUE_STICKS } from '@/config/glueSticks';
import type { SaveData } from '@/core/SaveManager';
import { Screen } from '@/ui/Screen';
import { el } from '@/utils/dom';
import type { UiCallbacks } from '@/ui/UIManager';

/**
 * Main menu. Rendered over the live 3D desk so the backdrop keeps breathing
 * (slow camera drift, dust, daylight) while the player reads.
 */
export class MenuScreen extends Screen {
  private stats: { score: HTMLElement; combo: HTMLElement; perfects: HTMLElement };
  private chips: HTMLElement[] = [];
  private save: SaveData;
  private callbacks: UiCallbacks;

  constructor(save: SaveData, callbacks: UiCallbacks) {
    super('gf-menu');
    this.save = save;
    this.callbacks = callbacks;

    const score = el('span', { class: 'gf-stat__value', text: '0' });
    const combo = el('span', { class: 'gf-stat__value', text: '0' });
    const perfects = el('span', { class: 'gf-stat__value', text: '0' });
    this.stats = { score, combo, perfects };

    const actions = el('div', { class: 'gf-menu__actions' }, [
      this.button('Play', true, () => this.callbacks.onPlay()),
      this.button('Challenges', false, () => this.callbacks.onChallenges()),
      this.button('Open Mode', false, () => this.callbacks.onOpenMode()),
      this.button('Settings', false, () => this.callbacks.onSettings()),
    ]);

    const sticks = el('div', { class: 'gf-sticks' });
    for (const variant of GLUE_STICKS) {
      const chip = el('button', { class: 'gf-stick-chip', type: 'button' }, [
        el('span', { class: 'gf-stick-chip__name', text: variant.name }),
        el('span', {
          class: 'gf-stick-chip__meta',
          text: `${Math.round(variant.mass * 1000)} g · ${'★'.repeat(variant.difficulty)}`,
        }),
      ]);
      chip.title = variant.tagline;
      chip.addEventListener('click', () => {
        this.callbacks.onSelectStick(variant.id);
        this.markSelected(variant.id);
      });
      chip.addEventListener('mouseenter', () => this.callbacks.onHover());
      this.chips.push(chip);
      sticks.append(chip);
    }
    this.markSelected(save.selectedGlueStick);

    const inner = el('div', { class: 'gf-menu__inner' }, [
      el('div', { class: 'gf-menu__brand' }, [
        el('span', { class: 'gf-eyebrow', text: 'A physics toy' }),
        el('h1', { class: 'gf-title', text: 'Glue Flip' }),
        el('p', { class: 'gf-menu__tagline', text: 'Master the perfect landing.' }),
      ]),
      actions,
      el('div', { class: 'gf-menu__brand' }, [
        el('span', { class: 'gf-eyebrow', text: 'Your stick' }),
        sticks,
      ]),
      el('div', { class: 'gf-menu__footer' }, [
        this.stat('Best score', score),
        this.stat('Best combo', combo),
        this.stat('Perfect landings', perfects),
      ]),
    ]);

    this.element.append(inner);
    this.refresh();
  }

  private button(label: string, primary: boolean, onClick: () => void): HTMLElement {
    const button = el('button', {
      class: `gf-button${primary ? ' is-primary' : ''}`,
      type: 'button',
      text: label,
    });
    button.addEventListener('click', onClick);
    button.addEventListener('mouseenter', () => this.callbacks.onHover());
    return button;
  }

  private stat(label: string, valueNode: HTMLElement): HTMLElement {
    return el('div', { class: 'gf-stat' }, [
      valueNode,
      el('span', { class: 'gf-stat__label', text: label }),
    ]);
  }

  private markSelected(id: string): void {
    GLUE_STICKS.forEach((variant, index) => {
      this.chips[index]?.classList.toggle('is-selected', variant.id === id);
    });
  }

  /** Called whenever the save changes (or the menu is re-opened). */
  refresh(save?: SaveData): void {
    if (save) this.save = save;
    this.stats.score.textContent = String(this.save.best.classic.score);
    this.stats.combo.textContent = String(this.save.best.classic.combo);
    this.stats.perfects.textContent = String(this.save.stats.perfects);
    this.markSelected(this.save.selectedGlueStick);
  }

  protected override onShow(): void {
    this.refresh();
  }
}
