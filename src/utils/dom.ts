/** Tiny DOM helpers — the UI is hand-rolled on purpose (no framework needed). */

export type Attrs = Record<string, string | number | boolean | undefined>;

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Attrs = {},
  children: (Node | string)[] = [],
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === undefined || value === false) continue;
    if (key === 'class') node.className = String(value);
    else if (key === 'text') node.textContent = String(value);
    else if (key === 'html') node.innerHTML = String(value);
    else if (key === 'style' && typeof value === 'object') Object.assign(node.style, value);
    else node.setAttribute(key, String(value));
  }
  for (const child of children) {
    node.append(typeof child === 'string' ? document.createTextNode(child) : child);
  }
  return node;
}

export function byId<T extends HTMLElement = HTMLElement>(id: string): T | null {
  return document.getElementById(id) as T | null;
}

export function qs<T extends HTMLElement = HTMLElement>(
  selector: string,
  root: ParentNode = document,
): T | null {
  return root.querySelector(selector) as T | null;
}

export function qsa<T extends HTMLElement = HTMLElement>(
  selector: string,
  root: ParentNode = document,
): T[] {
  return Array.from(root.querySelectorAll(selector)) as T[];
}

/** Adds a class, forcing a reflow so CSS transitions restart reliably. */
export function restartAnimation(node: HTMLElement, className: string): void {
  node.classList.remove(className);
  // eslint-disable-next-line @typescript-eslint/no-unused-expressions
  void node.offsetWidth;
  node.classList.add(className);
}

/** Removes a node after its CSS transition ends (with a safety timeout). */
export function fadeOutAndRemove(node: HTMLElement, durationMs = 320): void {
  node.classList.add('is-leaving');
  window.setTimeout(() => node.remove(), durationMs);
}

export function setStyle(node: HTMLElement, styles: Partial<CSSStyleDeclaration>): void {
  Object.assign(node.style, styles);
}
