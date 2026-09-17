import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type RAPIER from '@dimforge/rapier3d-compat';
import type { SurfacePreset } from '@/config/surfaces';
import { WORLD } from '@/config/world';
import type { MaterialLibrary } from '@/render/MaterialLibrary';
import type { PhysicsWorld } from '@/physics/PhysicsWorld';

/**
 * A swappable landing surface laid on top of the desk.
 *
 * It owns both the visual slab and the physics collider, so changing surface
 * changes grip, bounce, look *and* impact sound together — which is the whole
 * point of surfaces in this game.
 */
export class SurfacePad {
  readonly mesh: THREE.Mesh;
  readonly size: [number, number];
  preset: SurfacePreset;

  private physics: PhysicsWorld;
  private materials: MaterialLibrary;
  private geometry: THREE.BufferGeometry;
  private collider: RAPIER.Collider | null = null;
  private body: RAPIER.RigidBody | null = null;
  private thickness: number;

  constructor(
    physics: PhysicsWorld,
    materials: MaterialLibrary,
    preset: SurfacePreset,
    options: { size?: [number, number]; thickness?: number; center?: [number, number] } = {},
  ) {
    this.physics = physics;
    this.materials = materials;
    this.preset = preset;
    this.size = options.size ?? [0.5, 0.5];
    this.thickness = options.thickness ?? 0.008;

    this.geometry = new RoundedBoxGeometry(this.size[0], this.thickness, this.size[1], 2, 0.003);
    this.mesh = new THREE.Mesh(this.geometry, materials.surface(preset));
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.mesh.name = `surface-pad:${preset.id}`;

    const center = options.center ?? [0, 0];
    this.mesh.position.set(
      center[0],
      WORLD.desk.topY + this.thickness / 2,
      center[1],
    );

    this.createCollider(center);
  }

  /** Height of the pad's usable top surface. */
  get surfaceY(): number {
    return WORLD.desk.topY + this.thickness;
  }

  private createCollider(center: [number, number]): void {
    this.removeCollider();
    this.body = this.physics.world.createRigidBody(
      this.physics.rapier.RigidBodyDesc.fixed().setTranslation(
        center[0],
        WORLD.desk.topY + this.thickness / 2,
        center[1],
      ),
    );
    const desc = this.physics.rapier.ColliderDesc.cuboid(
      this.size[0] / 2,
      this.thickness / 2,
      this.size[1] / 2,
    )
      .setFriction(this.preset.friction)
      .setRestitution(this.preset.restitution);
    this.collider = this.physics.world.createCollider(desc, this.body);
    this.physics.tag(this.collider.handle, 'surface');
  }

  private removeCollider(): void {
    if (this.body) this.physics.removeBody(this.body);
    this.body = null;
    this.collider = null;
  }

  setPreset(preset: SurfacePreset): void {
    if (preset.id === this.preset.id) return;
    this.preset = preset;
    this.mesh.material = this.materials.surface(preset);
    this.mesh.name = `surface-pad:${preset.id}`;
    const center: [number, number] = [this.mesh.position.x, this.mesh.position.z];
    this.createCollider(center);
  }

  dispose(): void {
    this.removeCollider();
    this.geometry.dispose();
  }
}
