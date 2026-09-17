import { createLogger } from '@/utils/logger';

const log = createLogger('input');

/**
 * Unified pointer input.
 *
 * Mouse and touch go through the exact same path (Pointer Events), so the throw
 * gesture behaves identically on desktop and mobile. Multi-touch is tracked so
 * pinch-zoom can be distinguished from a throw.
 */

export interface PointerState {
  id: number;
  /** Client coordinates in CSS pixels. */
  x: number;
  y: number;
  /** Movement since the previous event. */
  dx: number;
  dy: number;
  down: boolean;
  button: number;
  pointerType: 'mouse' | 'touch' | 'pen';
  startTime: number;
  /** Total distance travelled while down. */
  travel: number;
}

export interface PinchState {
  distance: number;
  delta: number;
  centerX: number;
  centerY: number;
}

export interface InputHandlers {
  onPointerDown?: (pointer: PointerState) => void;
  onPointerMove?: (pointer: PointerState) => void;
  onPointerUp?: (pointer: PointerState) => void;
  onWheel?: (delta: number, x: number, y: number) => void;
  onPinch?: (pinch: PinchState) => void;
  onKey?: (event: KeyboardEvent) => void;
  onHover?: (x: number, y: number) => void;
}

export class InputManager {
  readonly pointers = new Map<number, PointerState>();
  private element: HTMLElement;
  private handlers: InputHandlers;
  private pinchDistance = 0;
  private disposed = false;

  constructor(element: HTMLElement, handlers: InputHandlers = {}) {
    this.element = element;
    this.handlers = handlers;
    this.element.style.touchAction = 'none';

    this.element.addEventListener('pointerdown', this.handleDown);
    this.element.addEventListener('pointermove', this.handleMove);
    this.element.addEventListener('pointerup', this.handleUp);
    this.element.addEventListener('pointercancel', this.handleUp);
    this.element.addEventListener('pointerleave', this.handleLeave);
    this.element.addEventListener('wheel', this.handleWheel, { passive: false });
    this.element.addEventListener('contextmenu', this.handleContextMenu);
    window.addEventListener('keydown', this.handleKey);
    window.addEventListener('blur', this.handleBlur);
  }

  setHandlers(handlers: InputHandlers): void {
    this.handlers = { ...this.handlers, ...handlers };
  }

  get primary(): PointerState | null {
    for (const pointer of this.pointers.values()) {
      if (pointer.down) return pointer;
    }
    return null;
  }

  get isMultiTouch(): boolean {
    let count = 0;
    for (const pointer of this.pointers.values()) if (pointer.down) count++;
    return count > 1;
  }

  get usingTouch(): boolean {
    for (const pointer of this.pointers.values()) {
      if (pointer.pointerType === 'touch') return true;
    }
    return false;
  }

  /** Converts client coordinates to normalised device coordinates (-1..1). */
  toNdc(x: number, y: number): [number, number] {
    const rect = this.element.getBoundingClientRect();
    return [
      ((x - rect.left) / Math.max(1, rect.width)) * 2 - 1,
      -(((y - rect.top) / Math.max(1, rect.height)) * 2 - 1),
    ];
  }

  /** Position relative to the element, in CSS pixels. */
  toLocal(x: number, y: number): [number, number] {
    const rect = this.element.getBoundingClientRect();
    return [x - rect.left, y - rect.top];
  }

  get rect(): DOMRect {
    return this.element.getBoundingClientRect();
  }

  private createPointer(event: PointerEvent): PointerState {
    return {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      dx: 0,
      dy: 0,
      down: true,
      button: event.button,
      pointerType: (event.pointerType as PointerState['pointerType']) ?? 'mouse',
      startTime: performance.now(),
      travel: 0,
    };
  }

  private handleDown = (event: PointerEvent): void => {
    if (this.disposed) return;
    this.element.setPointerCapture?.(event.pointerId);
    const pointer = this.createPointer(event);
    this.pointers.set(pointer.id, pointer);
    if (this.pointers.size === 2) {
      this.pinchDistance = this.currentPinchDistance();
    }
    this.handlers.onPointerDown?.(pointer);
  };

  private handleMove = (event: PointerEvent): void => {
    if (this.disposed) return;
    const existing = this.pointers.get(event.pointerId);
    if (!existing) {
      this.handlers.onHover?.(event.clientX, event.clientY);
      return;
    }
    const dx = event.clientX - existing.x;
    const dy = event.clientY - existing.y;
    existing.dx = dx;
    existing.dy = dy;
    existing.x = event.clientX;
    existing.y = event.clientY;
    existing.travel += Math.hypot(dx, dy);

    if (this.pointers.size >= 2) {
      const distance = this.currentPinchDistance();
      const delta = distance - this.pinchDistance;
      this.pinchDistance = distance;
      const [a, b] = Array.from(this.pointers.values());
      this.handlers.onPinch?.({
        distance,
        delta,
        centerX: (a.x + b.x) / 2,
        centerY: (a.y + b.y) / 2,
      });
      // While pinching, individual moves should not orbit the camera.
      this.handlers.onPointerMove?.(existing);
      return;
    }

    this.handlers.onPointerMove?.(existing);
  };

  private handleUp = (event: PointerEvent): void => {
    if (this.disposed) return;
    const pointer = this.pointers.get(event.pointerId);
    if (!pointer) return;
    pointer.down = false;
    pointer.dx = 0;
    pointer.dy = 0;
    this.pointers.delete(event.pointerId);
    this.element.releasePointerCapture?.(event.pointerId);
    if (this.pointers.size < 2) this.pinchDistance = 0;
    this.handlers.onPointerUp?.(pointer);
  };

  private handleLeave = (event: PointerEvent): void => {
    // Only treat as a release when the button is still held (drag out of window).
    if (event.buttons === 0) this.handleUp(event);
  };

  private handleWheel = (event: WheelEvent): void => {
    event.preventDefault();
    this.handlers.onWheel?.(event.deltaY, event.clientX, event.clientY);
  };

  private handleContextMenu = (event: Event): void => {
    event.preventDefault();
  };

  private handleKey = (event: KeyboardEvent): void => {
    this.handlers.onKey?.(event);
  };

  private handleBlur = (): void => {
    // Avoid "stuck" pointers when the tab loses focus mid-drag.
    for (const pointer of this.pointers.values()) {
      pointer.down = false;
      this.handlers.onPointerUp?.(pointer);
    }
    this.pointers.clear();
  };

  private currentPinchDistance(): number {
    const [a, b] = Array.from(this.pointers.values());
    if (!a || !b) return 0;
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.element.removeEventListener('pointerdown', this.handleDown);
    this.element.removeEventListener('pointermove', this.handleMove);
    this.element.removeEventListener('pointerup', this.handleUp);
    this.element.removeEventListener('pointercancel', this.handleUp);
    this.element.removeEventListener('pointerleave', this.handleLeave);
    this.element.removeEventListener('wheel', this.handleWheel);
    this.element.removeEventListener('contextmenu', this.handleContextMenu);
    window.removeEventListener('keydown', this.handleKey);
    window.removeEventListener('blur', this.handleBlur);
    this.pointers.clear();
    log.debug('disposed');
  }
}
