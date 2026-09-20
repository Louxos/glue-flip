/**
 * Landing surfaces. Every surface changes friction, restitution, visuals *and*
 * the impact sound, which is a big part of the game feel.
 */

export type SurfaceAudio = 'wood' | 'glass' | 'metal' | 'rubber' | 'stone' | 'paper';

export interface SurfacePreset {
  id: string;
  name: string;
  description: string;
  friction: number;
  restitution: number;
  audio: SurfaceAudio;
  /** Visual recipe consumed by the material library. */
  look: {
    color: number;
    roughness: number;
    metalness: number;
    /** 'wood' | 'glass' | 'metal' | 'rubber' | 'stone' | 'paper' */
    texture: 'wood' | 'glass' | 'metal' | 'rubber' | 'stone' | 'paper';
    /** Tint multiplier for the procedural texture. */
    tint: number;
  };
  /** Difficulty hint (1 = easy). */
  difficulty: 1 | 2 | 3 | 4;
  /** Hidden until the matching easter egg is found (see EASTER_EGGS.md). */
  secret?: boolean;
}

export const SURFACES: SurfacePreset[] = [
  {
    id: 'wood',
    name: 'Oak Desk',
    description: 'Warm, grippy wood. The classic landing surface.',
    friction: 0.58,
    restitution: 0.2,
    audio: 'wood',
    look: { color: 0xb08454, roughness: 0.62, metalness: 0, texture: 'wood', tint: 1 },
    difficulty: 1,
  },
  {
    id: 'walnut',
    name: 'Dark Walnut',
    description: 'Dense hardwood with a satin finish.',
    friction: 0.5,
    restitution: 0.24,
    audio: 'wood',
    look: { color: 0x6b452c, roughness: 0.48, metalness: 0, texture: 'wood', tint: 0.72 },
    difficulty: 1,
  },
  {
    id: 'rubber',
    name: 'Rubber Mat',
    description: 'Very grippy, kills the bounce. Forgiving but dull.',
    friction: 1.15,
    restitution: 0.1,
    audio: 'rubber',
    look: { color: 0x2c2f33, roughness: 0.94, metalness: 0, texture: 'rubber', tint: 1 },
    difficulty: 1,
  },
  {
    id: 'glass',
    name: 'Glass Panel',
    description: 'Slippery and bouncy. Precision required.',
    friction: 0.16,
    restitution: 0.38,
    audio: 'glass',
    look: { color: 0xdfeaea, roughness: 0.06, metalness: 0.1, texture: 'glass', tint: 1 },
    difficulty: 3,
  },
  {
    id: 'metal',
    name: 'Steel Tray',
    description: 'Loud, springy and unpredictable.',
    friction: 0.34,
    restitution: 0.46,
    audio: 'metal',
    look: { color: 0xb9bec4, roughness: 0.3, metalness: 0.95, texture: 'metal', tint: 1 },
    difficulty: 3,
  },
  {
    id: 'stone',
    name: 'Marble Slab',
    description: 'Hard stone with a polished, slightly slick surface.',
    friction: 0.42,
    restitution: 0.3,
    audio: 'stone',
    look: { color: 0xdad6cd, roughness: 0.24, metalness: 0.02, texture: 'stone', tint: 1 },
    difficulty: 2,
  },
  {
    id: 'paper',
    name: 'Notebook',
    description: 'Soft stack of paper. Absorbs everything.',
    friction: 0.82,
    restitution: 0.13,
    audio: 'paper',
    look: { color: 0xf2efe6, roughness: 0.86, metalness: 0, texture: 'paper', tint: 1 },
    difficulty: 2,
  },
  {
    id: 'velvet',
    name: 'Velvet',
    description: 'A gift box lining. Enormous grip, no bounce at all.',
    friction: 1.4,
    restitution: 0.03,
    audio: 'rubber',
    look: { color: 0x3b2340, roughness: 0.94, metalness: 0, texture: 'rubber', tint: 0.5 },
    difficulty: 1,
    secret: true,
  },
];

/** Surfaces the player may pick: everything except unreleased secrets. */
export function playableSurfaces(unlocked: string[] = []): SurfacePreset[] {
  return SURFACES.filter((surface) => !surface.secret || unlocked.includes(surface.id));
}

export const DEFAULT_SURFACE = SURFACES[0];

export function getSurface(id: string): SurfacePreset {
  return SURFACES.find((s) => s.id === id) ?? DEFAULT_SURFACE;
}
