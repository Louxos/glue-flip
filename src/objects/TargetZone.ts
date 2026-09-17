import * as THREE from 'three';
import { WORLD } from '@/config/world';
import { createZoneTexture } from '@/render/ProceduralTextures';
import { damp } from '@/utils/math';

/**
 * The landing zone marker.
 *
 * Purely visual: whether the stick is "in the zone" is computed from the real
 * body position, never from a trigger volume, so the player is never cheated by
 * a collider that does not match the decal.
 */
/** Opacity the zone rests at (0.9 while the patience assist is on). */
const BASE_OPACITY = 0.55;

export class TargetZone {
  readonly mesh: THREE.Mesh;
  private texture: THREE.CanvasTexture;
  private geometry: THREE.CircleGeometry;
  private material: THREE.MeshBasicMaterial;
  private radius: number;
  private pulse = 0;
  private targetOpacity: number;
  private visible = true;
  private assist = false;

  constructor(radius: number = 0.2, height: number = WORLD.desk.topY) {
    this.radius = radius;
    this.texture = createZoneTexture(512, '#ffffff');
    this.geometry = new THREE.CircleGeometry(radius, 64);
    this.material = new THREE.MeshBasicMaterial({
      map: this.texture,
      transparent: true,
      opacity: BASE_OPACITY,
      depthWrite: false,
      blending: THREE.NormalBlending,
      toneMapped: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.rotation.x = -Math.PI / 2;
    this.mesh.position.y = height + 0.0012;
    this.mesh.name = 'target-zone';
    this.mesh.renderOrder = 2;
    this.targetOpacity = BASE_OPACITY;
  }

  get currentRadius(): number {
    return this.radius;
  }

  /** Moves and resizes the zone (geometry is rebuilt only when needed). */
  place(center: [number, number], radius: number, height: number = WORLD.desk.topY): void {
    this.mesh.position.set(center[0], height + 0.0012, center[1]);
    if (Math.abs(radius - this.radius) > 0.0005) {
      this.radius = radius;
      this.mesh.scale.setScalar(1);
      this.geometry.dispose();
      this.geometry = new THREE.CircleGeometry(radius, 64);
      this.mesh.geometry = this.geometry;
    }
  }

  setVisible(visible: boolean): void {
    this.visible = visible;
    this.applyTargetOpacity();
  }

  /** Emphasises the zone right before a landing. */
  highlight(amount: number): void {
    this.material.opacity = Math.min(0.9, this.material.opacity + amount);
  }

  /**
   * Persistent guide glow, used by the "patience" easter egg after a run of
   * misses. Unlike `highlight()` this survives the opacity damping, because it
   * moves the target the zone settles at rather than nudging the current value.
   */
  setAssist(on: boolean): void {
    this.assist = on;
    this.applyTargetOpacity();
  }

  private applyTargetOpacity(): void {
    this.targetOpacity = this.visible ? (this.assist ? 0.9 : BASE_OPACITY) : 0;
  }

  update(dt: number, elapsed: number): void {
    this.pulse = 1 + Math.sin(elapsed * 1.8) * 0.012;
    this.mesh.scale.setScalar(this.pulse);
    this.material.opacity = damp(this.material.opacity, this.targetOpacity, 8, dt);
    this.mesh.visible = this.material.opacity > 0.01;
  }

  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
    this.texture.dispose();
  }
}
