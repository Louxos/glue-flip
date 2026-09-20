import type { PointerState } from '@/input/InputManager';
import type { CameraRig } from '@/camera/CameraRig';

/**
 * Turns pointer input into camera commands.
 *
 * The app delegates explicitly (rather than letting this class subscribe to the
 * input manager) so that a drag which grabs the glue stick never also orbits the
 * camera.
 */
export class CameraControls {
  enabled = true;
  invertY = false;

  private rig: CameraRig;
  private dragging = false;
  private dragPointerId: number | null = null;
  private multiTouch = false;

  constructor(rig: CameraRig) {
    this.rig = rig;
  }

  get isDragging(): boolean {
    return this.dragging;
  }

  handleDown(pointer: PointerState, isMultiTouch: boolean): void {
    if (!this.enabled) return;
    this.multiTouch = isMultiTouch;
    if (isMultiTouch) {
      this.dragging = false;
      return;
    }
    this.dragging = true;
    this.dragPointerId = pointer.id;
  }

  handleMove(pointer: PointerState, isMultiTouch: boolean): void {
    if (!this.enabled || !this.dragging) return;
    if (isMultiTouch || this.multiTouch) {
      this.dragging = false;
      return;
    }
    if (pointer.id !== this.dragPointerId) return;
    this.rig.orbitBy(pointer.dx, pointer.dy * (this.invertY ? -1 : 1));
  }

  handleUp(pointer: PointerState): void {
    if (pointer.id === this.dragPointerId) {
      this.dragging = false;
      this.dragPointerId = null;
    }
    this.multiTouch = false;
  }

  handleWheel(delta: number): void {
    if (!this.enabled) return;
    this.rig.zoomBy(Math.sign(delta) * Math.min(1, Math.abs(delta) / 120));
  }

  handlePinch(delta: number): void {
    if (!this.enabled) return;
    this.rig.zoomBy(-delta / 240);
  }

  cancel(): void {
    this.dragging = false;
    this.dragPointerId = null;
  }
}
