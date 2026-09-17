import * as THREE from 'three';
import { createSoftDotTexture } from '@/render/ProceduralTextures';
import { clamp } from '@/utils/math';

/**
 * The throw guide: a handful of fading dots showing where the stick is heading.
 *
 * Deliberately faint and short — enough to learn the arc, never enough to remove
 * the skill. Can be disabled in settings (and is off by default in challenges
 * beyond the tutorial).
 */
export class ThrowGuide {
  readonly points: THREE.Points;
  private geometry: THREE.BufferGeometry;
  private material: THREE.PointsMaterial;
  private texture: THREE.CanvasTexture;
  private count: number;
  private opacity = 0;
  private targetOpacity = 0;

  constructor(count = 16) {
    this.count = count;
    const positions = new Float32Array(count * 3);
    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.texture = createSoftDotTexture(64);
    this.material = new THREE.PointsMaterial({
      size: 0.012,
      map: this.texture,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      sizeAttenuation: true,
      color: 0xfff2df,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    });
    this.points = new THREE.Points(this.geometry, this.material);
    this.points.frustumCulled = false;
    this.points.name = 'throw-guide';
    this.points.renderOrder = 3;
  }

  setVisible(visible: boolean): void {
    this.targetOpacity = visible ? 0.5 : 0;
  }

  /** Replaces the dot positions with a predicted trajectory. */
  update(points: [number, number, number][], power: number): void {
    const attribute = this.geometry.getAttribute('position') as THREE.BufferAttribute;
    const array = attribute.array as Float32Array;
    for (let i = 0; i < this.count; i++) {
      const point = points[Math.min(points.length - 1, Math.floor((i / this.count) * points.length))];
      if (!point) {
        array[i * 3] = 0;
        array[i * 3 + 1] = -10;
        array[i * 3 + 2] = 0;
        continue;
      }
      array[i * 3] = point[0];
      array[i * 3 + 1] = point[1];
      array[i * 3 + 2] = point[2];
    }
    attribute.needsUpdate = true;
    this.material.size = 0.008 + clamp(power, 0, 1) * 0.008;
  }

  updateOpacity(dt: number): void {
    const speed = 9;
    this.opacity += (this.targetOpacity - this.opacity) * clamp(dt * speed, 0, 1);
    this.material.opacity = this.opacity;
    this.points.visible = this.opacity > 0.01;
  }

  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
    this.texture.dispose();
  }
}
