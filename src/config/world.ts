/**
 * Static world layout shared by the renderer, the physics world and the camera.
 * Everything is in meters with the desk top surface at `desk.topY`.
 */

export const WORLD = {
  desk: {
    /** Width along X. */
    width: 2.0,
    /** Depth along Z. */
    depth: 1.5,
    /** Top thickness. */
    thickness: 0.045,
    /** Height of the usable surface. */
    topY: 0.75,
    /** Centre of the desk in world space. */
    center: [0, 0] as [number, number],
    /** Apron / rail under the top. */
    apronHeight: 0.06,
    legInset: 0.1,
    legSize: 0.06,
  },
  floor: {
    y: 0,
    size: 26,
  },
  room: {
    /** Back wall plane. */
    wallZ: -2.1,
    wallHeight: 3.2,
    wallWidth: 10,
    /** Window opening in the back wall (main light source). */
    window: { x: 1.05, y: 1.6, width: 1.2, height: 1.4 },
  },
  /** Where the glue stick is placed when a throw is prepared. */
  spawn: {
    x: 0,
    /** Offset from the desk centre along Z (positive = towards the player). */
    z: 0.55,
    /** Gap left between the resting stick and the surface. */
    lift: 0.0008,
  },
  /** Usable area for landing zones (keeps decals and pads on the desk). */
  playArea: {
    minX: -0.78,
    maxX: 0.78,
    minZ: -0.6,
    maxZ: 0.48,
  },
} as const;

/** Derived helpers used by gameplay code. */
export function deskTopY(): number {
  return WORLD.desk.topY;
}

export function spawnPosition(halfHeight: number): [number, number, number] {
  return [WORLD.spawn.x, WORLD.desk.topY + halfHeight + WORLD.spawn.lift, WORLD.spawn.z];
}

/** Clamps a point so that a zone of `radius` centred on it stays on the desk. */
export function clampZoneCenter(
  x: number,
  z: number,
  radius: number,
): [number, number] {
  const area = WORLD.playArea;
  const cx = Math.min(area.maxX - radius, Math.max(area.minX + radius, x));
  const cz = Math.min(area.maxZ - radius, Math.max(area.minZ + radius, z));
  return [cx, cz];
}
