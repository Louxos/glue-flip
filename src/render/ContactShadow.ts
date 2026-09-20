import * as THREE from 'three';
import { createContactShadowTexture } from '@/render/ProceduralTextures';
import { clamp } from '@/utils/math';

/**
 * Fake contact shadow.
 *
 * The real shadow map handles the sun, but a soft blob directly under the object
 * grounds it far better at grazing angles — and it costs one quad.
 */
export class ContactShadow {
  readonly mesh: THREE.Mesh;
  private texture: THREE.CanvasTexture;
  private geometry: THREE.PlaneGeometry;
  private material: THREE.MeshBasicMaterial;
  private baseSize: number;

  constructor(baseSize = 0.075) {
    this.baseSize = baseSize;
    this.texture = createContactShadowTexture(256);
    this.geometry = new THREE.PlaneGeometry(1, 1);
    this.material = new THREE.MeshBasicMaterial({
      map: this.texture,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
      blending: THREE.NormalBlending,
      toneMapped: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.rotation.x = -Math.PI / 2;
    this.mesh.name = 'contact-shadow';
    this.mesh.renderOrder = 1;
  }

  /**
   * @param x       world X of the object
   * @param z       world Z of the object
   * @param height  height above the surface (m)
   * @param stretch optional elongation along Z (used while the stick is tilted)
   */
  update(x: number, z: number, surfaceY: number, height: number, stretch = 1): void {
    const fade = clamp(1 - height / 0.55, 0, 1);
    const spread = 1 + height * 2.4;
    this.mesh.position.set(x, surfaceY + 0.0016, z);
    this.mesh.scale.set(this.baseSize * spread, this.baseSize * spread * clamp(stretch, 1, 2.2), 1);
    this.material.opacity = 0.42 * fade * fade;
    this.mesh.visible = this.material.opacity > 0.01;
  }

  setVisible(visible: boolean): void {
    this.mesh.visible = visible;
  }

  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
    this.texture.dispose();
  }
}
