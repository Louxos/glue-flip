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
export class TargetZone {
  readonly mesh: THREE.Mesh;
  private texture: THREE.CanvasTexture;
  private geometry: THREE.CircleGeometry;
  private material: THREE.MeshBasicMaterial;
  private radius: number;
  private pulse = 0;
  private targetOpacity: number;

  constructor(radius: number = 0.2, height: number = WORLD.desk.topY) {
    this.radius = radius;
    this.texture = createZoneTexture(512, '#ffffff');
    this.geometry = new THREE.CircleGeometry(radius, 64);
    this.material = new THREE.MeshBasicMaterial({
      map: this.texture,
      transparent: true,
      opacity: 0.55,
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
    this.targetOpacity = 0.55;
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
    this.targetOpacity = visible ? 0.55 : 0;
  }

  /** Emphasises the zone right before a landing. */
  highlight(amount: number): void {
    this.material.opacity = Math.min(0.9, this.material.opacity + amount);
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
