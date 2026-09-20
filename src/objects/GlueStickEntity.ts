import * as THREE from 'three';
import type { GlueStickVariant } from '@/config/glueSticks';
import { GlueStickBody } from '@/physics/GlueStickBody';
import type { PhysicsWorld } from '@/physics/PhysicsWorld';
import { buildGlueStick } from '@/objects/GlueStickMesh';
import type { GlueStickModel } from '@/objects/GlueStickMesh';
import type { MaterialLibrary } from '@/render/MaterialLibrary';

/**
 * Binds the visual model to the physical body.
 *
 * Physics runs at a fixed 120Hz while rendering runs at the display rate, so the
 * mesh transform is interpolated between the last two physics states. Without
 * this the stick visibly stutters on 144Hz screens.
 */
export class GlueStickEntity {
  body: GlueStickBody;
  model: GlueStickModel;
  readonly group = new THREE.Group();

  private previous = {
    position: new THREE.Vector3(),
    quaternion: new THREE.Quaternion(),
  };

  private current = {
    position: new THREE.Vector3(),
    quaternion: new THREE.Quaternion(),
  };

  private scratchQuaternion = new THREE.Quaternion();
  private scratchPosition = new THREE.Vector3();

  constructor(
    private physics: PhysicsWorld,
    private materials: MaterialLibrary,
    variant: GlueStickVariant,
    position: [number, number, number],
  ) {
    this.body = new GlueStickBody(physics, variant, position);
    this.model = buildGlueStick(variant, materials);
    this.group.add(this.model.group);
    this.group.name = 'glue-stick-entity';
    this.snap();
  }

  get variant(): GlueStickVariant {
    return this.body.variant;
  }

  /** Rebuilds the mesh for a different variant (keeps the same rigid body slot). */
  setVariant(variant: GlueStickVariant, position: [number, number, number]): void {
    const previousState = {
      position: this.body.position(),
      rotation: this.body.rotation(),
    };
    this.model.dispose();
    this.group.remove(this.model.group);
    this.body.destroy();

    this.body = new GlueStickBody(this.physics, variant, position);
    this.body.body.setRotation(
      {
        x: previousState.rotation[0],
        y: previousState.rotation[1],
        z: previousState.rotation[2],
        w: previousState.rotation[3],
      },
      true,
    );
    this.model = buildGlueStick(variant, this.materials);
    this.group.add(this.model.group);
    this.snap();
  }

  /** Stores the pre-step transform (call before `physics.step`). */
  beginStep(): void {
    this.previous.position.copy(this.current.position);
    this.previous.quaternion.copy(this.current.quaternion);
  }

  /** Reads the post-step transform (call after `physics.step`). */
  endStep(): void {
    const p = this.body.position();
    const r = this.body.rotation();
    this.current.position.set(p[0], p[1], p[2]);
    this.current.quaternion.set(r[0], r[1], r[2], r[3]);
  }

  /** Applies an interpolated transform to the mesh. */
  sync(alpha: number): void {
    const t = Math.min(1, Math.max(0, alpha));
    this.scratchPosition.lerpVectors(this.previous.position, this.current.position, t);
    this.scratchQuaternion
      .copy(this.previous.quaternion)
      .slerp(this.current.quaternion, t);
    this.group.position.copy(this.scratchPosition);
    this.group.quaternion.copy(this.scratchQuaternion);
  }

  /** Hard-snaps the mesh to the physics state (used after resets). */
  snap(): void {
    this.endStep();
    this.previous.position.copy(this.current.position);
    this.previous.quaternion.copy(this.current.quaternion);
    this.group.position.copy(this.current.position);
    this.group.quaternion.copy(this.current.quaternion);
  }

  get position(): THREE.Vector3 {
    return this.group.position;
  }

  /** Local axis in world space, used by the aim guide and camera. */
  upAxis(): THREE.Vector3 {
    return new THREE.Vector3(0, 1, 0).applyQuaternion(this.group.quaternion);
  }

  dispose(): void {
    this.model.dispose();
    this.body.destroy();
    this.group.clear();
  }
}
