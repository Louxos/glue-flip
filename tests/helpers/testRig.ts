import type { ThrowContext } from '@/gameplay/ThrowGesture';
import { PhysicsWorld } from '@/physics/PhysicsWorld';
import { GlueStickBody } from '@/physics/GlueStickBody';
import { getGlueStick } from '@/config/glueSticks';
import type { GlueStickVariant } from '@/config/glueSticks';
import { WORLD } from '@/config/world';

/** Surface the tests land on: the bare desk top (no landing pad in the rig). */
export const TEST_SURFACE_Y = WORLD.desk.topY;

export interface TestRig {
  physics: PhysicsWorld;
  body: GlueStickBody;
  surfaceY: number;
  /** Simulation clock, advanced by `simulateLive` (mirrors `GameController`). */
  clock: number;
}

/**
 * Builds a real Rapier world containing the desk, the floor and one glue stick.
 * This is the same code path the game runs, so the tests below exercise the
 * shipped simulation rather than a model of it.
 */
export async function createTestRig(options: {
  variant?: GlueStickVariant;
  position?: [number, number, number];
  friction?: number;
  restitution?: number;
} = {}): Promise<TestRig> {
  const physics = await PhysicsWorld.create();
  const variant = options.variant ?? getGlueStick('classic');
  const friction = options.friction ?? 0.58;
  const restitution = options.restitution ?? 0.2;

  physics.createFixedCuboid(
    'desk',
    [0, WORLD.desk.topY - WORLD.desk.thickness / 2, 0],
    [WORLD.desk.width / 2, WORLD.desk.thickness / 2, WORLD.desk.depth / 2],
    { friction, restitution },
  );
  physics.createFixedCuboid(
    'floor',
    [0, -0.25, 0],
    [WORLD.floor.size / 2, 0.25, WORLD.floor.size / 2],
    { friction: 0.75, restitution: 0.15 },
  );

  const position = options.position ?? [
    0,
    TEST_SURFACE_Y + variant.height / 2,
    WORLD.spawn.z,
  ];
  const body = new GlueStickBody(physics, variant, position);
  const rig: TestRig = { physics, body, surfaceY: TEST_SURFACE_Y, clock: 0 };
  // Same wiring the game uses: contacts feed the resting-friction model.
  physics.onContactForce((event) => {
    if (event.tagA === 'glue' || event.tagB === 'glue') body.noteContact(rig.clock);
  });
  return rig;
}

/** Steps the world for `seconds` of simulated time. */
export function simulate(physics: PhysicsWorld, seconds: number): void {
  physics.stepExact(Math.round(seconds / physics.timestep));
}

/**
 * Steps the world the way the game loop does: physics plus the resting-friction
 * pass that stops a stick which lands on its side.
 */
export function simulateLive(rig: TestRig, seconds: number): void {
  const steps = Math.round(seconds / rig.physics.timestep);
  for (let i = 0; i < steps; i++) {
    rig.clock += rig.physics.timestep;
    rig.physics.step(rig.physics.timestep);
    rig.body.dampContactSpin(rig.physics.timestep, rig.clock);
  }
}

/**
 * Builds the throw context for a body exactly the way the game does: the height
 * that matters is the gap under the *base*, not under the centre.
 */
export function throwContextFor(
  body: GlueStickBody,
  surfaceY: number,
  overrides: Partial<ThrowContext> = {},
): ThrowContext {
  return {
    up: [0, 1, 0],
    forward: [0, 0, -1],
    gravity: 9.81,
    heightAboveSurface: Math.max(0, body.position()[1] - body.height / 2 - surfaceY),
    sensitivity: 1,
    stickHeight: body.height,
    random: () => 0,
    ...overrides,
  };
}
