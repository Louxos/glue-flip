import { describe, expect, it } from 'vitest';
import { createTestRig, simulateLive, TEST_SURFACE_Y, throwContextFor } from './helpers/testRig';
import { makeThrowSamples } from './helpers/throwSamples';
import { resolveThrow } from '@/gameplay/ThrowGesture';
import { GlueStickBody } from '@/physics/GlueStickBody';
import { PHYSICS } from '@/config/physics';
import { EGG_TIMING } from '@/config/easterEggs';
import { WORLD } from '@/config/world';
import { Random } from '@/utils/random';

/**
 * The "Desk Moon" easter egg, verified physically.
 *
 * The egg writes `physics.world.gravity.y`, and the controller reads the *live*
 * world gravity when it builds the throw context. This runs the same flick under
 * both gravities through the real Rapier world to prove the effect is real and
 * not just a flag nobody reads.
 */

function flick(body: GlueStickBody, surfaceY: number, speed: number, gravity: number) {
  const random = new Random(1);
  const samples = makeThrowSamples({
    start: [0, body.position()[1], WORLD.spawn.z],
    direction: [0, 0.62, -1],
    speed,
  });
  return resolveThrow(
    samples,
    throwContextFor(body, surfaceY, {
      random: () => random.jitter(1),
      stickHeight: body.height,
      // Exactly what GameController does: read the live world gravity.
      gravity,
    }),
  );
}

/** Peak height above the desk and total time spent off it, for one flick. */
async function flightProfile(gravityScale: number, speed = 2.4) {
  const rig = await createTestRig();
  const gravity = PHYSICS.gravity * gravityScale;
  rig.physics.world.gravity.y = gravity;

  const result = flick(rig.body, rig.surfaceY, speed, Math.abs(gravity));
  expect(result.valid).toBe(true);
  rig.body.applyThrow(result.velocity, result.angularVelocity);

  let peak = rig.body.position()[1];
  let airborne = 0;
  for (let i = 0; i < 600; i++) {
    simulateLive(rig, rig.physics.timestep);
    const y = rig.body.position()[1];
    peak = Math.max(peak, y);
    if (y - rig.body.height / 2 > rig.surfaceY + 0.002) airborne += rig.physics.timestep;
  }

  return { peakAboveDesk: peak - rig.body.height / 2 - TEST_SURFACE_Y, airborne, result };
}

describe('Desk Moon easter egg', () => {
  it('the low-gravity scale is a real reduction, not a no-op', () => {
    expect(EGG_TIMING.lowGravityScale).toBeLessThan(1);
    expect(EGG_TIMING.lowGravityScale).toBeGreaterThan(0);
    expect(PHYSICS.gravity * EGG_TIMING.lowGravityScale).toBeCloseTo(-3.43, 2);
  });

  it('makes the same flick hang in the air much longer', async () => {
    const earth = await flightProfile(1);
    const moon = await flightProfile(EGG_TIMING.lowGravityScale);

    // Physics says ~1/scale for the same launch velocity; allow wide margins.
    expect(moon.airborne).toBeGreaterThan(earth.airborne * 2);
  });

  it('makes the same flick peak much higher', async () => {
    const earth = await flightProfile(1);
    const moon = await flightProfile(EGG_TIMING.lowGravityScale);

    expect(moon.peakAboveDesk).toBeGreaterThan(earth.peakAboveDesk * 2);
    expect(earth.peakAboveDesk).toBeGreaterThan(0);
  });

  it('feeds the reduced gravity into the throw model, so the aim guide stays honest', async () => {
    const earth = await flightProfile(1);
    const moon = await flightProfile(EGG_TIMING.lowGravityScale);

    // The controller passes live gravity into resolveThrow; a lower gravity means
    // a longer predicted flight for the same gesture.
    expect(moon.result.estimatedFlightTime).toBeGreaterThan(earth.result.estimatedFlightTime);
    expect(earth.result.estimatedFlightTime).toBeGreaterThan(0);
  });
});
