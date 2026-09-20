/**
 * Graphic quality presets. Quality can be forced by the player or auto-detected
 * from the device. Everything heavy is gated here.
 */

export type QualityLevel = 'low' | 'medium' | 'high' | 'ultra';

export interface QualityPreset {
  id: QualityLevel;
  name: string;
  /** Cap on devicePixelRatio. */
  maxDpr: number;
  /** Enable dynamic resolution scaling when the frame budget is missed. */
  dynamicResolution: boolean;
  /** Lowest scale dynamic resolution may drop to. */
  minResolutionScale: number;
  shadows: boolean;
  shadowMapSize: number;
  /** Extra directional shadow cascade-ish fill light. */
  fillLight: boolean;
  bloom: boolean;
  bloomStrength: number;
  filmGrain: boolean;
  vignette: boolean;
  antialias: 'none' | 'fxaa' | 'msaa';
  /** Dust mote count. */
  dust: number;
  /** Resolution of the procedural PMREM environment. */
  envSize: number;
  /** Number of decorative props placed on the desk. */
  props: 'minimal' | 'standard' | 'full';
  /** Contact shadow blob under the stick. */
  contactShadow: boolean;
  /** Texture resolution multiplier for procedural canvas textures. */
  textureScale: number;
  /** Target frame time in ms used by the dynamic resolution controller. */
  frameBudgetMs: number;
}

export const QUALITY_PRESETS: Record<QualityLevel, QualityPreset> = {
  low: {
    id: 'low',
    name: 'Performance',
    maxDpr: 1,
    dynamicResolution: true,
    minResolutionScale: 0.6,
    shadows: true,
    shadowMapSize: 1024,
    fillLight: false,
    bloom: false,
    bloomStrength: 0,
    filmGrain: false,
    vignette: false,
    antialias: 'none',
    dust: 30,
    envSize: 128,
    props: 'minimal',
    contactShadow: false,
    textureScale: 0.5,
    frameBudgetMs: 24,
  },
  medium: {
    id: 'medium',
    name: 'Balanced',
    maxDpr: 1.5,
    dynamicResolution: true,
    minResolutionScale: 0.7,
    shadows: true,
    shadowMapSize: 1024,
    fillLight: true,
    bloom: true,
    bloomStrength: 0.18,
    filmGrain: false,
    vignette: true,
    antialias: 'fxaa',
    dust: 90,
    envSize: 256,
    props: 'standard',
    contactShadow: true,
    textureScale: 0.75,
    frameBudgetMs: 19,
  },
  high: {
    id: 'high',
    name: 'High',
    maxDpr: 2,
    dynamicResolution: true,
    minResolutionScale: 0.8,
    shadows: true,
    shadowMapSize: 2048,
    fillLight: true,
    bloom: true,
    bloomStrength: 0.24,
    filmGrain: true,
    vignette: true,
    antialias: 'msaa',
    dust: 170,
    envSize: 256,
    props: 'full',
    contactShadow: true,
    textureScale: 1,
    frameBudgetMs: 17,
  },
  ultra: {
    id: 'ultra',
    name: 'Ultra',
    maxDpr: 2.5,
    dynamicResolution: false,
    minResolutionScale: 1,
    shadows: true,
    shadowMapSize: 4096,
    fillLight: true,
    bloom: true,
    bloomStrength: 0.3,
    filmGrain: true,
    vignette: true,
    antialias: 'msaa',
    dust: 260,
    envSize: 512,
    props: 'full',
    contactShadow: true,
    textureScale: 1,
    frameBudgetMs: 14,
  },
};

export const QUALITY_ORDER: QualityLevel[] = ['low', 'medium', 'high', 'ultra'];

export function getPreset(level: QualityLevel): QualityPreset {
  return QUALITY_PRESETS[level] ?? QUALITY_PRESETS.medium;
}

/**
 * Picks a sensible default preset from the device. Deliberately conservative on
 * phones: a stable 60fps beats a pretty 25fps for a physics game.
 */
export function detectQuality(): QualityLevel {
  if (typeof navigator === 'undefined') return 'high';
  const cores = navigator.hardwareConcurrency ?? 4;
  const memory = (navigator as unknown as { deviceMemory?: number }).deviceMemory ?? 4;
  const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
  const smallScreen = Math.min(window.innerWidth, window.innerHeight) < 500;

  if (isMobile || smallScreen) {
    if (cores <= 4 || memory <= 3) return 'low';
    return 'medium';
  }
  if (cores <= 4 || memory <= 4) return 'medium';
  if (cores >= 8 && memory >= 8) return 'ultra';
  return 'high';
}
