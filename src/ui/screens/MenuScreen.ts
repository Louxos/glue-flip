import { playableGlueSticks } from '@/config/glueSticks';
import type { GlueStickVariant } from '@/config/glueSticks';
import type { SaveData } from '@/core/SaveManager';
import { Screen } from '@/ui/Screen';
import { t, tOr } from '@/ui/i18n';
import { el } from '@/utils/dom';
import type { UiCallbacks } from '@/ui/UIManager';
import { unlockedContent } from '@/config/easterEggs';

/**
 * Main menu, rendered over the live 3D desk.
 *
 * Deliberately spare: one dominant action, three secondary ones and a single
 * stick selector that cycles on click. Everything else lives in Settings, so the
 * player can go from boot to first throw in one click.
 */
export class MenuScreen extends Screen {
  private stats: { score: HTMLElement; combo: HTMLElement; perfects: HTMLElement };
  private stickChip!: HTMLElement;
  private stickName!: HTMLElement;
  private stickMeta!: HTMLElement;
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

    this.build();
    this.refresh();
  }

  /** Builds (or rebuilds, on a language change) the whole menu. */
  private build(): void {
    this.stickName = el('span', { class: 'gf-stick-chip__name', text: '' });
    this.stickMeta = el('span', { class: 'gf-stick-chip__meta', text: '' });
    this.stickChip = el('button', { class: 'gf-stick-chip', type: 'button' }, [
      el('span', { class: 'gf-eyebrow', text: t('menu.stick') }),
      this.stickName,
      this.stickMeta,
    ]);
    this.stickChip.title = t('menu.stickHint');
    this.stickChip.addEventListener('click', () => this.cycleStick());
    this.stickChip.addEventListener('mouseenter', () => this.callbacks.onHover());

    // The title doubles as an easter egg trigger (see EASTER_EGGS.md).
    const title = el('h1', { class: 'gf-title gf-title--clickable', text: t('menu.title') });
    title.addEventListener('click', () => this.callbacks.onTitleClick());

    const inner = el('div', { class: 'gf-menu__inner' }, [
      el('div', { class: 'gf-menu__brand' }, [
        el('span', { class: 'gf-eyebrow', text: t('menu.eyebrow') }),
        title,
        el('p', { class: 'gf-menu__tagline', text: t('menu.tagline') }),
      ]),
      el('div', { class: 'gf-menu__actions' }, [
        this.button(t('menu.play'), true, () => this.callbacks.onPlay()),
        el('div', { class: 'gf-menu__secondary' }, [
          this.button(t('menu.challenges'), false, () => this.callbacks.onChallenges()),
          this.button(t('menu.openMode'), false, () => this.callbacks.onOpenMode()),
          this.button(t('menu.settings'), false, () => this.callbacks.onSettings()),
        ]),
      ]),
      this.stickChip,
      el('div', { class: 'gf-menu__footer' }, [
        this.stat(t('menu.bestScore'), this.stats.score),
        this.stat(t('menu.bestCombo'), this.stats.combo),
        this.stat(t('menu.perfects'), this.stats.perfects),
      ]),
    ]);

    this.element.replaceChildren(inner);
  }

  protected override onRebuild(): void {
    this.build();
    this.refresh();
  }

  private cycleStick(): void {
    const available = playableGlueSticks(unlockedContent(this.save.easterEggs));
    const index = available.findIndex((stick) => stick.id === this.save.selectedGlueStick);
    const next = available[(index + 1) % available.length] ?? available[0];
    this.callbacks.onSelectStick(next.id);
    this.callbacks.onHover();
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

  /** Called whenever the save changes (or the menu is re-opened). */
  refresh(save?: SaveData): void {
    if (save) this.save = save;
    this.stats.score.textContent = String(this.save.best.classic.score);
    this.stats.combo.textContent = String(this.save.best.classic.combo);
    this.stats.perfects.textContent = String(this.save.stats.perfects);

    const selected = this.selectedStick();
    this.stickName.textContent = tOr(`stick.${selected.id}.name`, selected.name);
    this.stickMeta.textContent =
      `${Math.round(selected.mass * 1000)} g · ${'★'.repeat(selected.difficulty)}`;
    this.stickChip.title = tOr(`stick.${selected.id}.tagline`, selected.tagline);
  }

  private selectedStick(): GlueStickVariant {
    const available = playableGlueSticks(unlockedContent(this.save.easterEggs));
    return (
      available.find((stick) => stick.id === this.save.selectedGlueStick) ?? available[0]
    );
  }

  protected override onShow(): void {
    this.refresh();
  }
}
