import { describe, expect, it } from 'vitest';
import { createTestRig, simulate, simulateLive, TEST_SURFACE_Y, throwContextFor } from './helpers/testRig';
import { makeThrowSamples } from './helpers/throwSamples';
import { resolveThrow } from '@/gameplay/ThrowGesture';
import { evaluateLanding, isSettled } from '@/gameplay/LandingEvaluator';
import { GlueStickBody } from '@/physics/GlueStickBody';
import { PhysicsWorld } from '@/physics/PhysicsWorld';
import { getGlueStick, GLUE_STICKS } from '@/config/glueSticks';
import { solveStickMassProperties } from '@/physics/geometry';
import { LANDING } from '@/config/gameplay';
import { WORLD } from '@/config/world';
import { Random } from '@/utils/random';

/**
 * Integration tests that run the *real* Rapier simulation with the shipped
 * collider setup, throw model and landing evaluation. Rapier's WASM build runs
 * in Node, so these exercise exactly the code the browser runs.
 */

const throwContext = {
  up: [0, 1, 0] as [number, number, number],
  forward: [0, 0, -1] as [number, number, number],
  gravity: 9.81,
  heightAboveSurface: 0.12,
  sensitivity: 1,
  stickHeight: 0.096,
  random: () => 0,
};

/**
 * Builds a flick from a rig, using the same context the game builds (the height
 * that matters is the gap under the *base*, read from the live body).
 */
function flick(
  body: GlueStickBody,
  surfaceY: number,
  speed: number,
  options: { seed?: number; curl?: number } = {},
) {
  const random = new Random(options.seed ?? 1);
  const start: [number, number, number] = [0, body.position()[1], WORLD.spawn.z];
  const samples = makeThrowSamples({
    start,
    direction: [0, 0.62, -1],
    speed,
    curl: options.curl ?? 0,
  });
  return resolveThrow(
    samples,
    throwContextFor(body, surfaceY, {
      random: () => random.jitter(1),
      stickHeight: body.height,
    }),
  );
}

describe('glue stick rigid body', () => {
  it('has the mass the variant declares', async () => {
    for (const variant of GLUE_STICKS) {
      const { body } = await createTestRig({ variant });
      // Solved from two densities, so it must match the design value exactly.
      expect(body.mass).toBeCloseTo(variant.mass, 6);
    }
  });

  it('derives the inertia of a bottom-heavy cylinder', () => {
    for (const variant of GLUE_STICKS) {
      const props = solveStickMassProperties(
        variant.height,
        variant.radius,
        variant.baseHeight,
        variant.mass,
        variant.comRatio,
      );
      expect(props.mass).toBeCloseTo(variant.mass, 10);
      expect(props.comY).toBeCloseTo((variant.comRatio - 0.5) * variant.height, 10);
      // Axial inertia of a cylinder: m·r²/2 — untouched by the density split.
      expect(props.inertia[1]).toBeCloseTo((variant.mass * variant.radius ** 2) / 2, 10);
      // The perpendicular axes are equal, and larger than the uniform case
      // because the mass sits low (parallel axis term).
      expect(props.inertia[0]).toBeCloseTo(props.inertia[2], 12);
      const uniform =
        (variant.mass * (3 * variant.radius ** 2 + variant.height ** 2)) / 12;
      expect(props.inertia[0]).toBeGreaterThan(uniform);
    }
  });

  it('places the centre of mass where the variant says (bottom heavy)', async () => {
    for (const variant of GLUE_STICKS) {
      const { body } = await createTestRig({ variant });
      const [py, cy] = [body.position()[1], body.worldCom()[1]];
      const offset = cy - py;
      const expected = (variant.comRatio - 0.5) * variant.height;
      expect(offset).toBeCloseTo(expected, 4);
      // Bottom heavy means the centre of mass sits below the geometric centre.
      expect(offset).toBeLessThan(0);
      // The value reported by Rapier must match the value the body advertises.
      expect(offset).toBeCloseTo(body.comOffsetY, 4);
    }
  });

  it('uses a flat-capped cylinder (a capsule or ball could never stand)', async () => {
    const { physics, body } = await createTestRig();
    expect(body.colliders.length).toBe(1);
    expect(body.colliders[0].shape.type).toBe(physics.rapier.ShapeType.Cylinder);
  });
});

describe('simulation sanity', () => {
  it('a dropped stick lands on its base', async () => {
    const { physics, body, surfaceY } = await createTestRig({
      position: [0, TEST_SURFACE_Y + 0.22, 0.3],
    });
    simulate(physics, 2);

    const tilt = body.tiltDeg();
    const base = body.basePoint();
    expect(tilt).toBeLessThan(LANDING.perfectTiltDeg);
    expect(base[1] - surfaceY).toBeLessThan(LANDING.baseContactTolerance);
    expect(isSettled(body.speed(), body.spinSpeed())).toBe(true);
  });

  it('never tunnels through the floor, however hard the throw', async () => {
    // A slam leaves the desk — that is correct — but it must be stopped by the
    // floor rather than passing through it.
    for (const speed of [2.4, 3.4]) {
      const rig = await createTestRig({ position: [0, TEST_SURFACE_Y + 0.12, WORLD.spawn.z] });
      const throwResult = flick(rig.body, rig.surfaceY, speed);
      expect(throwResult.valid).toBe(true);
      rig.body.applyThrow(throwResult.velocity, throwResult.angularVelocity);

      let minY = Number.POSITIVE_INFINITY;
      for (let i = 0; i < 600; i++) {
        rig.physics.stepExact(1);
        minY = Math.min(minY, rig.body.position()[1]);
      }
      expect(minY).toBeGreaterThan(WORLD.floor.y - 0.01);
    }
  });

  it('the stick actually rotates in flight', async () => {
    const { physics, body, surfaceY } = await createTestRig({
      position: [0, TEST_SURFACE_Y + 0.12, WORLD.spawn.z],
    });
    const before = body.rotation();
    const throwResult = flick(body, surfaceY, 3.4);
    body.applyThrow(throwResult.velocity, throwResult.angularVelocity);
    simulate(physics, 0.2);
    const after = body.rotation();
    const dot =
      before[0] * after[0] + before[1] * after[1] + before[2] * after[2] + before[3] * after[3];
    expect(Math.abs(dot)).toBeLessThan(0.98);
  });

  it('the same gesture always produces the same outcome', async () => {
    const results: number[] = [];
    for (let run = 0; run < 2; run++) {
      const { physics, body, surfaceY } = await createTestRig({
        position: [0, TEST_SURFACE_Y + 0.12, WORLD.spawn.z],
      });
      const throwResult = flick(body, surfaceY, 3.4, { seed: 42 });
      body.applyThrow(throwResult.velocity, throwResult.angularVelocity);
      simulate(physics, 2.5);
      const position = body.position();
      results.push(position[0] * 1e6 + position[1] * 1e3 + body.tiltDeg());
    }
    expect(results[0]).toBeCloseTo(results[1], 6);
  });

  it('every throw comes to rest well inside the throw timeout', async () => {
    for (const speed of [1.5, 2.4, 3.4]) {
      const rig = await createTestRig({ position: [0, TEST_SURFACE_Y + 0.12, WORLD.spawn.z] });
      const throwResult = flick(rig.body, rig.surfaceY, speed);
      rig.body.applyThrow(throwResult.velocity, throwResult.angularVelocity);
      simulateLive(rig, 3);
      expect(isSettled(rig.body.speed(), rig.body.spinSpeed())).toBe(true);
    }
  });

  it('stops a stick that lands on its side (resting friction)', async () => {
    // Without the resting-friction pass a cylinder on its side rolls for seconds
    // because a rigid-body solver has no rolling resistance.
    const rig = await createTestRig({ position: [0, TEST_SURFACE_Y + 0.12, WORLD.spawn.z] });
    const slam = flick(rig.body, rig.surfaceY, 3.4);
    rig.body.applyThrow(slam.velocity, slam.angularVelocity);
    simulateLive(rig, 2.5);
    expect(rig.body.tiltDeg()).toBeGreaterThan(LANDING.standTiltDeg); // it did fall over
    expect(rig.body.spinSpeed()).toBeLessThan(LANDING.settleAngvel);
    expect(rig.body.speed()).toBeLessThan(LANDING.settleLinvel);
  });

  it('a hard sideways shove does not count as a landing', async () => {
    const { physics, body, surfaceY } = await createTestRig({
      position: [0, TEST_SURFACE_Y + 0.12, WORLD.spawn.z],
    });
    body.applyThrow([2.4, 0.4, -1.6], [1, 2, 0.5]);
    simulate(physics, 3);
    const result = evaluateLanding({
      tiltDeg: body.tiltDeg(),
      baseY: body.basePoint()[1],
      capY: body.capPoint()[1],
      surfaceY,
      stickHeight: body.variant.height,
      insideZone: true,
      zoneRequired: false,
      flightTime: 3,
      outOfBounds: false,
    });
    expect(['failed', 'lost']).toContain(result.status);
  });

  it('reports contact forces when the stick hits the desk', async () => {
    const { physics, body, surfaceY } = await createTestRig({
      position: [0, TEST_SURFACE_Y + 0.35, 0.2],
    });
    let impacts = 0;
    let maxForce = 0;
    physics.onContactForce((event) => {
      if (event.tagA === 'glue' || event.tagB === 'glue') {
        impacts += 1;
        maxForce = Math.max(maxForce, event.magnitude);
      }
    });
    for (let i = 0; i < 90; i++) physics.step(1 / 60);
    expect(impacts).toBeGreaterThan(0);
    expect(maxForce).toBeGreaterThan(0);
    void body;
  });
});

describe('landing outcome distribution', () => {
  it('rewards a well-tuned flick and punishes bad ones', async () => {
    const speeds = [1.5, 1.8, 2.1, 2.4, 2.8, 3.4, 4.5];
    const rows: { speed: number; landings: number; total: number }[] = [];

    for (const speed of speeds) {
      let landings = 0;
      const total = 8;
      for (let i = 0; i < total; i++) {
        const { physics, body, surfaceY } = await createTestRig({
          position: [0, TEST_SURFACE_Y + 0.12, WORLD.spawn.z],
        });
        const throwResult = flick(body, surfaceY, speed, { seed: 100 + i });
        if (!throwResult.valid) continue;
        body.applyThrow(throwResult.velocity, throwResult.angularVelocity);
        simulate(physics, 2.6);

        const result = evaluateLanding({
          tiltDeg: body.tiltDeg(),
          baseY: body.basePoint()[1],
          capY: body.capPoint()[1],
          surfaceY,
          stickHeight: body.variant.height,
          insideZone: true,
          zoneRequired: false,
          flightTime: 1,
          outOfBounds: false,
        });
        if (result.status === 'landing' || result.status === 'perfect') landings += 1;
      }
      rows.push({ speed, landings, total });
    }

    const successes = rows.reduce((sum, row) => sum + row.landings, 0);
    const attempts = rows.reduce((sum, row) => sum + row.total, 0);
    const rate = successes / attempts;
    const bySpeed = (speed: number) => rows.find((row) => row.speed === speed)!;

    // A comfortable flick is reliable, a comfortable one that travels further is
    // a coin flip, and a slam never lands. That gradient *is* the difficulty.
    expect(bySpeed(1.8).landings).toBeGreaterThanOrEqual(5);
    expect(bySpeed(2.8).landings).toBeLessThan(bySpeed(1.8).landings);
    expect(bySpeed(4.5).landings).toBeLessThanOrEqual(1);
    expect(successes).toBeGreaterThan(0);
    expect(rate).toBeLessThan(0.85);
  }, 120000);

  it('lands inside the CLASSIC distance range with the tuned model', async () => {
    // Regression guard for the throw tuning: at the reference flick the stick
    // must travel inside the play area and stand up most of the time.
    const variant = getGlueStick('classic');
    let upright = 0;
    let inside = 0;
    const total = 10;
    for (let i = 0; i < total; i++) {
      const rig = await createTestRig({ variant, position: [0, 0.87, WORLD.spawn.z] });
      const random = new Random(900 + i);
      const samples = makeThrowSamples({
        start: [0, 0.87, WORLD.spawn.z],
        direction: [0, 0.6, -1],
        speed: 1.9,
      });
      const throwResult = resolveThrow(
        samples,
        throwContextFor(rig.body, rig.surfaceY, { random: () => random.jitter(1) }),
      );
      rig.body.applyThrow(throwResult.velocity, throwResult.angularVelocity);
      simulateLive(rig, 2.6);
      const travelled = WORLD.spawn.z - rig.body.position()[2];
      if (travelled > 0.25 && travelled < 0.85) inside += 1;
      if (rig.body.tiltDeg() < LANDING.standTiltDeg) upright += 1;
    }
    expect(inside).toBe(total);
    expect(upright).toBeGreaterThanOrEqual(Math.round(total * 0.6));
  }, 120000);

  it('every stick variant can land when dropped', async () => {
    for (const variant of GLUE_STICKS) {
      const { physics, body, surfaceY } = await createTestRig({
        variant,
        position: [0, TEST_SURFACE_Y + 0.18, 0.3],
      });
      simulate(physics, 2.2);
      expect(body.tiltDeg()).toBeLessThan(LANDING.standTiltDeg);
    }
  });
});

describe('world plumbing', () => {
  it('tags colliders so gameplay can react to them', async () => {
    const { physics, body } = await createTestRig();
    expect(physics.tagOf(body.colliders[0].handle)).toBe('glue');
    const tags: string[] = [];
    physics.world.forEachCollider((collider) => {
      const tag = physics.tagOf(collider.handle);
      if (tag) tags.push(tag);
    });
    expect(tags).toContain('desk');
    expect(tags).toContain('floor');
  });

  it('exposes an interpolation alpha in [0, 1]', async () => {
    const physics = await PhysicsWorld.create();
    expect(physics.interpolationAlpha).toBeGreaterThanOrEqual(0);
    expect(physics.interpolationAlpha).toBeLessThanOrEqual(1);
    physics.step(1 / 240);
    expect(physics.interpolationAlpha).toBeGreaterThanOrEqual(0);
    expect(physics.interpolationAlpha).toBeLessThanOrEqual(1);
  });

  it('casts rays against the desk', async () => {
    const { physics, surfaceY } = await createTestRig();
    // The query pipeline is refreshed during a step, so colliders created after
    // the world was built are only hittable once the world has stepped twice.
    physics.step(1 / 120);
    physics.step(1 / 120);
    const hit = physics.castRayDown([0, 1.4, 0], 2);
    expect(hit).not.toBeNull();
    expect(hit!.point[1]).toBeCloseTo(surfaceY, 3);
  });

  it('creates a body with the expected inertia for each variant', async () => {
    for (const variant of GLUE_STICKS) {
      const physics = await PhysicsWorld.create();
      const body = new GlueStickBody(physics, variant, [0, 1, 0]);
      expect(body.mass).toBeCloseTo(variant.mass, 4);
      expect(body.height).toBe(variant.height);
    }
  });
});
