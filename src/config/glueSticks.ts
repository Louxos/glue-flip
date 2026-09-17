/**
 * Glue stick variants.
 *
 * Each variant is a real physical object: its mass, size, centre of mass and
 * material response all change how it flies and how hard it is to land.
 * Dimensions are in meters, mass in kilograms.
 *
 * The proportions are not arbitrary: landing tolerance grows with the base
 * diameter relative to the height (a wide, low stick self-rights, a tall thin
 * one topples on the friction impulse of its own landing). These are the
 * chunky "jumbo craft" proportions that make an upright landing physically
 * achievable at all — verified by the landing-window tests.
 */

export interface GlueStickVariant {
  id: string;
  name: string;
  tagline: string;
  /** Total height of the closed stick. */
  height: number;
  /** Radius of the main body. */
  radius: number;
  /** Height of the cap section (top). */
  capHeight: number;
  /** Height of the twist mechanism section (bottom). */
  baseHeight: number;
  /** Total mass in kg. */
  mass: number;
  /**
   * Height of the centre of mass, expressed as a ratio of `height` measured from
   * the base. A real glue stick is bottom heavy (mechanism + glue) so this is
   * below 0.5 — which is exactly why it can land upright at all.
   */
  comRatio: number;
  /** Friction coefficient of the plastic shell. */
  friction: number;
  /** Bounciness of the plastic shell. */
  restitution: number;
  /** Visual parameters used by the procedural mesh builder. */
  look: {
    bodyColor: number;
    bodyRoughness: number;
    capColor: number;
    baseColor: number;
    labelPrimary: string;
    labelSecondary: string;
    labelText: string;
    labelSubText: string;
    clearcoat: number;
    ridges: number;
  };
  /** Difficulty hint shown in the selector (1 = forgiving). */
  difficulty: 1 | 2 | 3;
  /** Hidden until the matching easter egg is found (see EASTER_EGGS.md). */
  secret?: boolean;
}

export const GLUE_STICKS: GlueStickVariant[] = [
  {
    id: 'classic',
    name: 'School Classic',
    tagline: 'The one from the pencil case. Bottom heavy, very forgiving.',
    height: 0.084,
    radius: 0.023,
    capHeight: 0.026,
    baseHeight: 0.02,
    mass: 0.03,
    comRatio: 0.38,
    friction: 0.46,
    restitution: 0.18,
    difficulty: 1,
    look: {
      bodyColor: 0xf4f1ea,
      bodyRoughness: 0.42,
      capColor: 0xc0392b,
      baseColor: 0x2f3437,
      labelPrimary: '#e8472c',
      labelSecondary: '#f6f3ec',
      labelText: 'GLUE',
      labelSubText: 'FLIP  30 g',
      clearcoat: 0.55,
      ridges: 12,
    },
  },
  {
    id: 'jumbo',
    name: 'Jumbo 48',
    tagline: 'Big, slow and heavy. Huge inertia, long rotations.',
    height: 0.108,
    radius: 0.028,
    capHeight: 0.032,
    baseHeight: 0.026,
    mass: 0.048,
    comRatio: 0.4,
    friction: 0.5,
    restitution: 0.2,
    difficulty: 2,
    look: {
      bodyColor: 0xe9e6dd,
      bodyRoughness: 0.38,
      capColor: 0x2e7d5b,
      baseColor: 0x25282b,
      labelPrimary: '#1f7a55',
      labelSecondary: '#f2efe7',
      labelText: 'GLUE',
      labelSubText: 'JUMBO  48 g',
      clearcoat: 0.62,
      ridges: 14,
    },
  },
  {
    id: 'slim',
    name: 'Slim Mini',
    tagline: 'Featherweight. Snappy rotations, twitchy landings.',
    height: 0.074,
    radius: 0.019,
    capHeight: 0.022,
    baseHeight: 0.018,
    mass: 0.017,
    comRatio: 0.36,
    friction: 0.42,
    restitution: 0.34,
    difficulty: 3,
    look: {
      bodyColor: 0xfaf8f3,
      bodyRoughness: 0.35,
      capColor: 0x2f6fb2,
      baseColor: 0x33373b,
      labelPrimary: '#2f6fb2',
      labelSecondary: '#ffffff',
      labelText: 'GLUE',
      labelSubText: 'SLIM  17 g',
      clearcoat: 0.7,
      ridges: 10,
    },
  },
  {
    id: 'purple',
    name: 'Purple Twist',
    tagline: 'Purple goes clear. Slightly top heavy — for experts.',
    height: 0.09,
    radius: 0.022,
    capHeight: 0.027,
    baseHeight: 0.021,
    mass: 0.026,
    comRatio: 0.46,
    friction: 0.46,
    restitution: 0.26,
    difficulty: 3,
    look: {
      bodyColor: 0xf2eef7,
      bodyRoughness: 0.4,
      capColor: 0x6c4bb6,
      baseColor: 0x3b3550,
      labelPrimary: '#6c4bb6',
      labelSecondary: '#f7f4fb',
      labelText: 'GLUE',
      labelSubText: 'PURPLE  26 g',
      clearcoat: 0.8,
      ridges: 16,
    },
  },
  {
    id: 'gold',
    name: 'Golden Glue',
    tagline: 'Not a real product. Lands like a rumour.',
    height: 0.084,
    radius: 0.023,
    capHeight: 0.026,
    baseHeight: 0.02,
    mass: 0.052,
    comRatio: 0.34,
    friction: 0.6,
    restitution: 0.12,
    difficulty: 3,
    secret: true,
    look: {
      bodyColor: 0xd8b25c,
      bodyRoughness: 0.18,
      capColor: 0x8a6a24,
      baseColor: 0x2a2118,
      labelPrimary: '#8a6a24',
      labelSecondary: '#f6e7bd',
      labelText: 'GLUE',
      labelSubText: 'OR  52 g',
      clearcoat: 1,
      ridges: 18,
    },
  },
];

/** Sticks the player may pick: everything except unreleased secrets. */
export function playableGlueSticks(unlocked: string[] = []): GlueStickVariant[] {
  return GLUE_STICKS.filter((stick) => !stick.secret || unlocked.includes(stick.id));
}

export const DEFAULT_GLUE_STICK = GLUE_STICKS[0];

export function getGlueStick(id: string): GlueStickVariant {
  return GLUE_STICKS.find((s) => s.id === id) ?? DEFAULT_GLUE_STICK;
}
