import { CLASSIC } from '@/config/gameplay';
import type { ObstacleSpec } from '@/config/challenges';
import { WORLD, clampZoneCenter } from '@/config/world';
import { clamp } from '@/utils/math';

/**
 * Classic-mode progression.
 *
 * Difficulty grows on three axes at once but slowly: the pad moves away, the pad
 * shrinks, and the surface changes. Obstacles arrive later, always with enough
 * room to clear them. Nothing here can produce an impossible setup — every
 * generated spec is clamped to the physical desk.
 */

export interface LevelSpec {
  level: number;
  /** Distance from the spawn point to the landing zone centre (m). */
  distance: number;
  /** Landing zone radius (m). */
  zoneRadius: number;
  /** Zone centre in world coordinates. */
  zoneCenter: [number, number];
  surfaceId: string;
  obstacles: ObstacleSpec[];
  /** Short label shown in the HUD. */
  note: string;
}

/** Surface rotation order — easy first, slippery later, then back to wood. */
const SURFACE_ORDER = [
  'wood',
  'walnut',
  'wood',
  'rubber',
  'stone',
  'walnut',
  'paper',
  'wood',
];

/**
 * Obstacle patterns, expressed as offsets from the zone centre.
 * They always leave a clear corridor of at least ~14cm.
 */
const OBSTACLE_PATTERNS: ObstacleSpec[][] = [
  [{ kind: 'book', position: [0, 0, 0.16], size: [0.2, 0.032, 0.15], rotationY: 0.08 }],
  [
    { kind: 'mug', position: [0.19, 0, 0.12], size: [0.08, 0.1, 0.08] },
    { kind: 'book', position: [-0.14, 0, 0.2], size: [0.19, 0.03, 0.14], rotationY: -0.2 },
  ],
  [
    { kind: 'tape', position: [-0.2, 0, 0.14], size: [0.1, 0.05, 0.1] },
    { kind: 'pencilCase', position: [0.2, 0, 0.18], size: [0.19, 0.05, 0.07], rotationY: 0.25 },
  ],
  [
    { kind: 'block', position: [0.24, 0, 0.1], size: [0.085, 0.085, 0.085] },
    { kind: 'book', position: [-0.05, 0, 0.24], size: [0.21, 0.035, 0.16], rotationY: 0.3 },
  ],
  [
    { kind: 'mug', position: [-0.22, 0, 0.16], size: [0.08, 0.1, 0.08] },
    { kind: 'block', position: [0.22, 0, 0.2], size: [0.08, 0.08, 0.08] },
    { kind: 'tape', position: [0, 0, 0.3], size: [0.1, 0.05, 0.1] },
  ],
];

export function levelDistance(level: number): number {
  const l = Math.max(1, level);
  return clamp(
    CLASSIC.distanceMin + (l - 1) * CLASSIC.distancePerLevel,
    CLASSIC.distanceMin,
    CLASSIC.distanceMax,
  );
}

export function levelZoneRadius(level: number): number {
  const l = Math.max(1, level);
  return Math.max(
    CLASSIC.zoneRadiusMin,
    CLASSIC.zoneRadiusStart - (l - 1) * CLASSIC.zoneShrinkPerLevel,
  );
}

export function levelSurface(level: number): string {
  const l = Math.max(1, level);
  const index = Math.floor((l - 1) / CLASSIC.surfaceEveryLevels) % SURFACE_ORDER.length;
  return SURFACE_ORDER[index];
}

export function levelObstacles(level: number): ObstacleSpec[] {
  if (level < CLASSIC.obstaclesFromLevel) return [];
  const step = Math.floor((level - CLASSIC.obstaclesFromLevel) / 2);
  // Clamp instead of cycling: difficulty must never drop back down.
  const index = Math.min(step, OBSTACLE_PATTERNS.length - 1);
  return OBSTACLE_PATTERNS[index];
}

export function buildLevel(level: number): LevelSpec {
  const l = Math.max(1, Math.floor(level));
  const zoneRadius = levelZoneRadius(l);
  let distance = levelDistance(l);

  // Never place the pad off the desk: shrink the distance until the whole zone
  // (plus a safety margin) fits inside the play area.
  const spawnZ = WORLD.spawn.z;
  const maxDistance = Math.max(
    0.2,
    spawnZ - (WORLD.playArea.minZ + zoneRadius + 0.02),
  );
  distance = Math.min(distance, maxDistance);

  const [zoneX, zoneZ] = clampZoneCenter(WORLD.spawn.x, spawnZ - distance, zoneRadius);

  const surfaceId = levelSurface(l);
  const obstacles = levelObstacles(l);

  return {
    level: l,
    distance,
    zoneRadius,
    zoneCenter: [zoneX, zoneZ],
    surfaceId,
    obstacles,
    note: describeLevel({ distance, zoneRadius, surfaceId, obstacleCount: obstacles.length }),
  };
}

export function describeLevel(input: {
  distance: number;
  zoneRadius: number;
  surfaceId: string;
  obstacleCount: number;
}): string {
  const parts = [`${Math.round(input.distance * 100)} cm`];
  if (input.zoneRadius < 0.14) parts.push('tight zone');
  if (input.obstacleCount > 0) parts.push(`${input.obstacleCount} obstacle${input.obstacleCount > 1 ? 's' : ''}`);
  parts.push(input.surfaceId);
  return parts.join(' · ');
}

/** Difficulty factor used for scoring — grows with distance and zone tightness. */
export function levelDifficulty(spec: LevelSpec): number {
  const distanceFactor = 1 + (spec.distance - CLASSIC.distanceMin) * 1.1;
  const zoneFactor = 1 + (CLASSIC.zoneRadiusStart - spec.zoneRadius) * 1.6;
  const obstacleFactor = 1 + spec.obstacles.length * 0.08;
  return clamp(distanceFactor * zoneFactor * obstacleFactor, 1, 4);
}
