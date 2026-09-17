import { el } from '@/utils/dom';

/**
 * Base class for every UI screen.
 *
 * Screens are plain DOM: no framework, no virtual DOM. The game only needs a
 * handful of overlays and hand-rolled CSS keeps them cheap and fully stylable.
 */
export abstract class Screen {
  readonly element: HTMLElement;
  protected visible = false;

  constructor(className: string, ...extraClasses: string[]) {
    this.element = el('div', { class: ['gf-screen', className, ...extraClasses].join(' ') });
  }

  get isVisible(): boolean {
    return this.visible;
  }

  show(): void {
    if (this.visible) return;
    this.visible = true;
    this.element.classList.remove('is-leaving');
    this.element.classList.add('is-visible');
    this.onShow();
    this.focusFirst();
  }

  hide(): void {
    if (!this.visible) return;
    this.visible = false;
    this.element.classList.add('is-leaving');
    this.element.classList.remove('is-visible');
    this.onHide();
  }

  /** Moves keyboard focus into the screen so it is immediately navigable. */
  protected focusFirst(): void {
    const focusable = this.element.querySelector<HTMLElement>(
      'button:not([disabled]), input, [tabindex]',
    );
    focusable?.focus({ preventScroll: true });
  }

  protected onShow(): void {
    /* override */
  }

  protected onHide(): void {
    /* override */
  }

  dispose(): void {
    this.element.remove();
  }
}
