import type RAPIER from '@dimforge/rapier3d-compat';
import type { GlueStickVariant } from '@/config/glueSticks';
import { GLUE_PHYSICS, HOLD } from '@/config/physics';
import { solveStickMassProperties } from '@/physics/geometry';
import type { PhysicsWorld } from '@/physics/PhysicsWorld';

export interface GlueStickSnapshot {
  position: [number, number, number];
  rotation: [number, number, number, number];
  linvel: [number, number, number];
  angvel: [number, number, number];
}

/**
 * The glue stick as a physical object.
 *
 * A single flat-capped cylinder collider carrying the exact mass properties of a
 * bottom-heavy stick (dense twist mechanism, light glue and cap). Using one real
 * cylinder instead of stacked convex hulls matters: hull prisms produce poor
 * contact manifolds on their polygon edges and the stick topples on landing even
 * from a few centimetres, while the analytic cylinder lands and stays.
 */
export class GlueStickBody {
  readonly body: RAPIER.RigidBody;
  readonly colliders: RAPIER.Collider[] = [];
  readonly variant: GlueStickVariant;
  readonly height: number;
  readonly radius: number;
  /** Centre of mass offset along local Y (negative = below centre). */
  readonly comOffsetY: number;

  private physics: PhysicsWorld;
  /** Simulation time of the last reported contact (s). */
  private lastContactAt = -10;

  constructor(
    physics: PhysicsWorld,
    variant: GlueStickVariant,
    position: [number, number, number],
  ) {
    this.physics = physics;
    this.variant = variant;
    this.height = variant.height;
    this.radius = variant.radius;

    const desc = physics.rapier.RigidBodyDesc.dynamic()
      .setTranslation(position[0], position[1], position[2])
      .setLinearDamping(GLUE_PHYSICS.linearDamping)
      .setAngularDamping(GLUE_PHYSICS.angularDamping)
      .setCcdEnabled(GLUE_PHYSICS.ccdEnabled)
      .setCanSleep(true)
      .setSoftCcdPrediction(0.12);

    this.body = physics.world.createRigidBody(desc);

    const baseHeight = Math.min(variant.baseHeight, variant.height * 0.6);
    const props = solveStickMassProperties(
      variant.height,
      variant.radius,
      baseHeight,
      variant.mass,
      variant.comRatio,
    );
    this.comOffsetY = props.comY;

    const shape = physics.rapier.ColliderDesc.cylinder(variant.height / 2, variant.radius)
      .setMassProperties(
        props.mass,
        { x: 0, y: props.comY, z: 0 },
        { x: props.inertia[0], y: props.inertia[1], z: props.inertia[2] },
        { x: 0, y: 0, z: 0, w: 1 },
      )
      .setFriction(variant.friction)
      .setRestitution(variant.restitution)
      .setContactSkin(GLUE_PHYSICS.contactSkin);
    this.colliders.push(physics.world.createCollider(shape, this.body));

    if (this.colliders.length === 0) {
      // Extremely defensive: never leave the game without a collider.
      const fallback = physics.rapier.ColliderDesc.cylinder(variant.height / 2, variant.radius)
        .setDensity(variant.mass / (Math.PI * variant.radius ** 2 * variant.height))
        .setFriction(variant.friction)
        .setRestitution(variant.restitution);
      this.colliders.push(physics.world.createCollider(fallback, this.body));
    }

    for (const collider of this.colliders) {
      collider.setActiveEvents(
        physics.rapier.ActiveEvents.COLLISION_EVENTS | physics.rapier.ActiveEvents.CONTACT_FORCE_EVENTS,
      );
      collider.setContactForceEventThreshold(0.02);
      physics.tag(collider.handle, 'glue');
    }
  }

  get mass(): number {
    return this.body.mass();
  }

  /** Records that the stick touched something at `time` (simulation seconds). */
  noteContact(time: number): void {
    this.lastContactAt = time;
  }

  /**
   * Bleeds off residual motion while the stick is rubbing against a surface.
   *
   * A solver has no rolling resistance, so a stick that lands on its side rolls
   * for seconds: killing only the spin lets the remaining linear momentum spin it
   * back up through friction, so both are damped together — which is what static
   * friction actually does to a light object on a desk.
   */
  dampContactSpin(dt: number, now: number): void {
    if (now - this.lastContactAt > GLUE_PHYSICS.contactSpinWindow) return;
    if (this.speed() > GLUE_PHYSICS.contactSpinMaxSpeed) return;
    const keepSpin = Math.max(0, 1 - GLUE_PHYSICS.contactSpinDamping * dt);
    const w = this.body.angvel();
    this.body.setAngvel({ x: w.x * keepSpin, y: w.y * keepSpin, z: w.z * keepSpin }, true);

    const keepSlide = Math.max(0, 1 - GLUE_PHYSICS.contactSlideDamping * dt);
    const v = this.body.linvel();
    // Vertical is left alone so gravity keeps the stick pressed on the surface.
    this.body.setLinvel({ x: v.x * keepSlide, y: v.y, z: v.z * keepSlide }, true);
  }

  get handle(): number {
    return this.body.handle;
  }

  position(): [number, number, number] {
    const t = this.body.translation();
    return [t.x, t.y, t.z];
  }

  rotation(): [number, number, number, number] {
    const r = this.body.rotation();
    return [r.x, r.y, r.z, r.w];
  }

  linvel(): [number, number, number] {
    const v = this.body.linvel();
    return [v.x, v.y, v.z];
  }

  angvel(): [number, number, number] {
    const v = this.body.angvel();
    return [v.x, v.y, v.z];
  }

  speed(): number {
    const v = this.body.linvel();
    return Math.hypot(v.x, v.y, v.z);
  }

  spinSpeed(): number {
    const v = this.body.angvel();
    return Math.hypot(v.x, v.y, v.z);
  }

  /** World-space position of the centre of mass. */
  worldCom(): [number, number, number] {
    const com = this.body.worldCom();
    return [com.x, com.y, com.z];
  }

  /**
   * Transforms a body-local point into world space.
   * Implemented directly (no three.js) so this stays usable in tests.
   */
  localToWorld(local: [number, number, number]): [number, number, number] {
    const t = this.body.translation();
    const q = this.body.rotation();
    const [x, y, z] = local;
    // v' = v + 2 * cross(q.xyz, cross(q.xyz, v) + q.w * v)
    const cx = q.y * z - q.z * y;
    const cy = q.z * x - q.x * z;
    const cz = q.x * y - q.y * x;
    return [
      t.x + x + 2 * (q.y * cz - q.z * cy + q.w * cx),
      t.y + y + 2 * (q.z * cx - q.x * cz + q.w * cy),
      t.z + z + 2 * (q.x * cy - q.y * cx + q.w * cz),
    ];
  }

  /** Rotates a local direction into world space (no translation). */
  localDirToWorld(local: [number, number, number]): [number, number, number] {
    const q = this.body.rotation();
    const [x, y, z] = local;
    const cx = q.y * z - q.z * y;
    const cy = q.z * x - q.x * z;
    const cz = q.x * y - q.y * x;
    return [
      x + 2 * (q.y * cz - q.z * cy + q.w * cx),
      y + 2 * (q.z * cx - q.x * cz + q.w * cy),
      z + 2 * (q.x * cy - q.y * cx + q.w * cz),
    ];
  }

  /** World-space centre of the base (the face that should land). */
  basePoint(): [number, number, number] {
    return this.localToWorld([0, -this.height / 2, 0]);
  }

  /** World-space centre of the cap. */
  capPoint(): [number, number, number] {
    return this.localToWorld([0, this.height / 2, 0]);
  }

  /** Body up axis in world space. */
  upAxis(): [number, number, number] {
    return this.localDirToWorld([0, 1, 0]);
  }

  /** Tilt from vertical, in degrees (0 = perfectly upright). */
  tiltDeg(): number {
    const up = this.upAxis();
    const dot = Math.min(1, Math.max(-1, up[1]));
    return (Math.acos(dot) * 180) / Math.PI;
  }

  isSleeping(): boolean {
    return this.body.isSleeping();
  }

  setDynamic(): void {
    this.body.setBodyType(this.physics.rapier.RigidBodyType.Dynamic, true);
  }

  setKinematic(): void {
    this.body.setBodyType(this.physics.rapier.RigidBodyType.KinematicPositionBased, true);
  }

  setFixed(): void {
    this.body.setBodyType(this.physics.rapier.RigidBodyType.Fixed, true);
  }

  reset(
    position: [number, number, number],
    rotation: [number, number, number, number] = [0, 0, 0, 1],
  ): void {
    this.body.setTranslation({ x: position[0], y: position[1], z: position[2] }, true);
    this.body.setRotation({ x: rotation[0], y: rotation[1], z: rotation[2], w: rotation[3] }, true);
    this.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    this.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    this.body.resetForces(true);
    this.body.resetTorques(true);
    this.body.wakeUp();
    this.setDynamic();
  }

  /** Applies a resolved throw: linear velocity + angular velocity. */
  applyThrow(velocity: [number, number, number], angular: [number, number, number]): void {
    this.setDynamic();
    this.body.wakeUp();
    this.body.setLinvel({ x: velocity[0], y: velocity[1], z: velocity[2] }, true);
    this.body.setAngvel({ x: angular[0], y: angular[1], z: angular[2] }, true);
  }

  /** Moves the held (kinematic) stick towards a target position. */
  driveKinematic(target: [number, number, number], rotation: [number, number, number, number]): void {
    this.setKinematic();
    this.body.setNextKinematicTranslation({
      x: target[0],
      y: target[1],
      z: target[2],
    });
    this.body.setNextKinematicRotation({
      x: rotation[0],
      y: rotation[1],
      z: rotation[2],
      w: rotation[3],
    });
  }

  snapshot(): GlueStickSnapshot {
    return {
      position: this.position(),
      rotation: this.rotation(),
      linvel: this.linvel(),
      angvel: this.angvel(),
    };
  }

  destroy(): void {
    this.physics.removeBody(this.body);
  }

  /** Local point used to place the held stick in the hand. */
  heldGrabOffset(): [number, number, number] {
    return [0, -this.height * 0.1, 0];
  }

  /** Half height including a small epsilon, for resting placement. */
  restHalfHeight(): number {
    return this.height / 2 + HOLD.restLift;
  }
}
