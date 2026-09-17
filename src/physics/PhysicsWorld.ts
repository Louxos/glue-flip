import type RAPIER from '@dimforge/rapier3d-compat';
import { PHYSICS } from '@/config/physics';
import { createLogger } from '@/utils/logger';

const log = createLogger('physics');

export type ColliderTag =
  | 'glue'
  | 'desk'
  | 'floor'
  | 'wall'
  | 'surface'
  | 'obstacle'
  | 'prop'
  | 'zone';

export interface CollisionEvent {
  a: number;
  b: number;
  started: boolean;
  tagA: ColliderTag | undefined;
  tagB: ColliderTag | undefined;
}

export interface ContactForceEvent {
  a: number;
  b: number;
  tagA: ColliderTag | undefined;
  tagB: ColliderTag | undefined;
  /** Sum of contact force magnitudes (newtons). */
  magnitude: number;
  direction: [number, number, number];
}

export interface PhysicsWorldOptions {
  gravity?: number;
  timestep?: number;
}

/**
 * Thin, testable wrapper around Rapier.
 *
 * Responsibilities:
 *  - deterministic fixed-step integration with an accumulator,
 *  - a tag registry so gameplay can react to "glue hit desk" without knowing
 *    anything about collider handles,
 *  - collision + contact-force event fan-out (used by audio and feedback).
 *
 * The class holds no three.js references, so it runs identically in Node for
 * integration tests.
 */
export class PhysicsWorld {
  readonly rapier: typeof RAPIER;
  readonly world: RAPIER.World;
  readonly eventQueue: RAPIER.EventQueue;

  private accumulator = 0;
  private tags = new Map<number, ColliderTag>();
  private collisionListeners = new Set<(event: CollisionEvent) => void>();
  private forceListeners = new Set<(event: ContactForceEvent) => void>();
  private stepCount = 0;

  private constructor(rapier: typeof RAPIER, options: PhysicsWorldOptions = {}) {
    this.rapier = rapier;
    const gravity = options.gravity ?? PHYSICS.gravity;
    this.world = new rapier.World({ x: 0, y: gravity, z: 0 });
    this.world.timestep = options.timestep ?? PHYSICS.timestep;
    this.eventQueue = new rapier.EventQueue(true);
  }

  /** Rapier's WASM payload must be initialised before any world exists. */
  static async create(options: PhysicsWorldOptions = {}): Promise<PhysicsWorld> {
    const rapier = await import('@dimforge/rapier3d-compat');
    const mod = (rapier as unknown as { default?: typeof RAPIER }).default ?? rapier;
    // Rapier's generated glue warns when the wasm init is called without an
    // options object; passing one keeps the console clean.
    await (mod.init as unknown as (options?: object) => Promise<void>)({});
    log.debug('rapier initialised', { version: (mod as unknown as { version?: string }).version });
    return new PhysicsWorld(mod, options);
  }

  get timestep(): number {
    return this.world.timestep;
  }

  get steps(): number {
    return this.stepCount;
  }

  /**
   * Fraction of a timestep left in the accumulator — used to interpolate the
   * rendered transform between the last two physics states.
   */
  get interpolationAlpha(): number {
    return Math.min(1, Math.max(0, this.accumulator / this.world.timestep));
  }

  tag(handle: number, tag: ColliderTag): void {
    this.tags.set(handle, tag);
  }

  tagOf(handle: number): ColliderTag | undefined {
    return this.tags.get(handle);
  }

  onCollision(listener: (event: CollisionEvent) => void): () => void {
    this.collisionListeners.add(listener);
    return () => this.collisionListeners.delete(listener);
  }

  onContactForce(listener: (event: ContactForceEvent) => void): () => void {
    this.forceListeners.add(listener);
    return () => this.forceListeners.delete(listener);
  }

  /**
   * Advances the simulation by `dt` seconds using fixed sub-steps.
   * Returns the number of physics steps actually executed.
   */
  step(dt: number, maxSteps = PHYSICS.maxStepsPerFrame): number {
    this.accumulator += Math.max(0, Math.min(dt, 0.25));
    let steps = 0;
    while (this.accumulator >= this.world.timestep && steps < maxSteps) {
      this.world.step(this.eventQueue);
      this.accumulator -= this.world.timestep;
      this.stepCount += 1;
      steps += 1;
    }
    if (steps === maxSteps) this.accumulator = 0; // avoid the spiral of death
    this.drainEvents();
    return steps;
  }

  /** Advances an exact number of fixed steps (used by deterministic tests). */
  stepExact(steps: number): void {
    for (let i = 0; i < steps; i++) {
      this.world.step(this.eventQueue);
      this.stepCount += 1;
    }
    this.drainEvents();
  }

  private drainEvents(): void {
    if (this.collisionListeners.size > 0) {
      this.eventQueue.drainCollisionEvents((h1, h2, started) => {
        const event: CollisionEvent = {
          a: h1,
          b: h2,
          started,
          tagA: this.tags.get(h1),
          tagB: this.tags.get(h2),
        };
        for (const listener of this.collisionListeners) listener(event);
      });
    } else {
      this.eventQueue.drainCollisionEvents(() => undefined);
    }

    if (this.forceListeners.size > 0) {
      this.eventQueue.drainContactForceEvents((event) => {
        const h1 = event.collider1();
        const h2 = event.collider2();
        const dir = event.maxForceDirection();
        const payload: ContactForceEvent = {
          a: h1,
          b: h2,
          tagA: this.tags.get(h1),
          tagB: this.tags.get(h2),
          magnitude: event.totalForceMagnitude(),
          direction: [dir.x, dir.y, dir.z],
        };
        for (const listener of this.forceListeners) listener(payload);
      });
    } else {
      this.eventQueue.drainContactForceEvents(() => undefined);
    }
  }

  /** Convenience: a fixed cuboid (desk top, floor, walls, trays). */
  createFixedCuboid(
    tag: ColliderTag,
    position: [number, number, number],
    halfExtents: [number, number, number],
    options: { friction?: number; restitution?: number; rotationY?: number } = {},
  ): RAPIER.Collider {
    const body = this.world.createRigidBody(
      this.rapier.RigidBodyDesc.fixed().setTranslation(position[0], position[1], position[2]),
    );
    const desc = this.rapier.ColliderDesc.cuboid(
      halfExtents[0],
      halfExtents[1],
      halfExtents[2],
    )
      .setFriction(options.friction ?? 0.6)
      .setRestitution(options.restitution ?? 0.2);
    if (options.rotationY) {
      const half = options.rotationY / 2;
      desc.setRotation({ x: 0, y: Math.sin(half), z: 0, w: Math.cos(half) });
    }
    const collider = this.world.createCollider(desc, body);
    this.tag(collider.handle, tag);
    return collider;
  }

  removeBody(body: RAPIER.RigidBody): void {
    for (let i = 0; i < body.numColliders(); i++) {
      this.tags.delete(body.collider(i).handle);
    }
    this.world.removeRigidBody(body);
  }

  /**
   * Vertices + colours for a wireframe debug overlay of every collider.
   * Returns null when Rapier's debug renderer is unavailable.
   */
  debugBuffers(): { vertices: Float32Array; colors: Float32Array } | null {
    try {
      const buffers = this.world.debugRender();
      return { vertices: buffers.vertices, colors: buffers.colors };
    } catch (error) {
      log.warn('debug render failed', error);
      return null;
    }
  }

  /** Generic ray cast with an optional tag filter. */
  castRay(
    origin: [number, number, number],
    direction: [number, number, number],
    maxToi: number,
    filter?: (tag: ColliderTag | undefined, handle: number) => boolean,
  ): { point: [number, number, number]; distance: number; handle: number; tag?: ColliderTag } | null {
    const ray = new this.rapier.Ray(
      { x: origin[0], y: origin[1], z: origin[2] },
      { x: direction[0], y: direction[1], z: direction[2] },
    );
    const predicate = filter
      ? (collider: RAPIER.Collider) => filter(this.tags.get(collider.handle), collider.handle)
      : undefined;
    const hit = this.world.castRay(
      ray,
      maxToi,
      true,
      undefined,
      undefined,
      undefined,
      undefined,
      predicate,
    );
    if (!hit) return null;
    const t = hit.timeOfImpact;
    return {
      point: [origin[0] + direction[0] * t, origin[1] + direction[1] * t, origin[2] + direction[2] * t],
      distance: t,
      handle: hit.collider.handle,
      tag: this.tags.get(hit.collider.handle),
    };
  }

  /** Shortest distance from a point to the nearest solid, used by the camera. */
  castRayDown(
    origin: [number, number, number],
    maxDistance: number,
    exclude?: RAPIER.RigidBody,
  ): { point: [number, number, number]; distance: number } | null {
    const ray = new this.rapier.Ray(
      { x: origin[0], y: origin[1], z: origin[2] },
      { x: 0, y: -1, z: 0 },
    );
    const hit = this.world.castRay(ray, maxDistance, true, undefined, undefined, undefined, exclude);
    if (!hit) return null;
    return {
      point: [origin[0], origin[1] - hit.timeOfImpact, origin[2]],
      distance: hit.timeOfImpact,
    };
  }

  dispose(): void {
    this.collisionListeners.clear();
    this.forceListeners.clear();
    this.tags.clear();
    this.eventQueue.free();
    this.world.free();
  }
}

export type { RAPIER };
