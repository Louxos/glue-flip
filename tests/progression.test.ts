import { describe, expect, it } from 'vitest';
import {
  buildLevel,
  describeLevel,
  levelDifficulty,
  levelDistance,
  levelObstacles,
  levelSurface,
  levelZoneRadius,
} from '@/gameplay/ProgressionSystem';
import { CLASSIC } from '@/config/gameplay';
import { WORLD } from '@/config/world';
import { getSurface } from '@/config/surfaces';

describe('progression', () => {
  it('starts easy and gets steadily harder', () => {
    let previousDistance = 0;
    let previousRadius = Number.POSITIVE_INFINITY;
    for (let level = 1; level <= 30; level++) {
      const spec = buildLevel(level);
      expect(spec.distance).toBeGreaterThanOrEqual(previousDistance);
      expect(spec.zoneRadius).toBeLessThanOrEqual(previousRadius);
      previousDistance = spec.distance;
      previousRadius = spec.zoneRadius;
    }
  });

  it('never pushes the landing zone off the desk', () => {
    for (let level = 1; level <= 60; level++) {
      const spec = buildLevel(level);
      const [x, z] = spec.zoneCenter;
      expect(x - spec.zoneRadius).toBeGreaterThanOrEqual(WORLD.playArea.minX - 1e-9);
      expect(x + spec.zoneRadius).toBeLessThanOrEqual(WORLD.playArea.maxX + 1e-9);
      expect(z - spec.zoneRadius).toBeGreaterThanOrEqual(WORLD.playArea.minZ - 1e-9);
      expect(z + spec.zoneRadius).toBeLessThanOrEqual(WORLD.playArea.maxZ + 1e-9);
      expect(spec.distance).toBeLessThanOrEqual(CLASSIC.distanceMax);
    }
  });

  it('keeps obstacles inside the desk and away from the spawn point', () => {
    for (let level = CLASSIC.obstaclesFromLevel; level <= 40; level++) {
      const spec = buildLevel(level);
      for (const obstacle of spec.obstacles) {
        const worldX = spec.zoneCenter[0] + obstacle.position[0];
        const worldZ = spec.zoneCenter[1] + obstacle.position[2];
        expect(Math.abs(worldX)).toBeLessThan(WORLD.desk.width / 2 - 0.1);
        expect(Math.abs(worldZ)).toBeLessThan(WORLD.desk.depth / 2 - 0.1);
        // A clear corridor must remain between the spawn point and the zone.
        expect(worldZ).toBeLessThan(WORLD.spawn.z - 0.1);
      }
    }
  });

  it('introduces obstacles only from the configured level', () => {
    expect(levelObstacles(1)).toHaveLength(0);
    expect(levelObstacles(CLASSIC.obstaclesFromLevel - 1)).toHaveLength(0);
    expect(levelObstacles(CLASSIC.obstaclesFromLevel).length).toBeGreaterThan(0);
  });

  it('always resolves to a real surface', () => {
    for (let level = 1; level <= 40; level++) {
      expect(getSurface(levelSurface(level)).id).toBeTruthy();
    }
  });

  it('produces a monotonic difficulty factor', () => {
    let previous = 0;
    for (let level = 1; level <= 40; level++) {
      const value = levelDifficulty(buildLevel(level));
      expect(value).toBeGreaterThanOrEqual(previous - 1e-9);
      expect(value).toBeGreaterThanOrEqual(1);
      previous = value;
    }
  });

  it('clamps distance and radius', () => {
    expect(levelDistance(1)).toBe(CLASSIC.distanceMin);
    expect(levelDistance(500)).toBe(CLASSIC.distanceMax);
    expect(levelZoneRadius(1)).toBe(CLASSIC.zoneRadiusStart);
    expect(levelZoneRadius(500)).toBe(CLASSIC.zoneRadiusMin);
  });

  it('describes a level in human terms', () => {
    const text = describeLevel({
      distance: 0.62,
      zoneRadius: 0.1,
      surfaceId: 'glass',
      obstacleCount: 2,
    });
    expect(text).toContain('62 cm');
    expect(text).toContain('tight zone');
    expect(text).toContain('2 obstacles');
    expect(text).toContain('glass');
  });
});
