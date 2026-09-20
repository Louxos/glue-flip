import * as THREE from 'three';
import { visualRng } from '@/utils/random';

/**
 * Procedural texture factory.
 *
 * Every texture in the game is generated at runtime on a 2D canvas. That keeps
 * the repository free of binary assets, lets quality presets scale texture
 * resolution, and guarantees the look is consistent across platforms.
 */

function makeCanvas(size: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas context unavailable');
  return { canvas, ctx };
}

function toTexture(canvas: HTMLCanvasElement, repeat: [number, number] = [1, 1]): THREE.CanvasTexture {
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeat[0], repeat[1]);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  texture.needsUpdate = true;
  return texture;
}

function toDataTexture(canvas: HTMLCanvasElement, repeat: [number, number] = [1, 1]): THREE.CanvasTexture {
  const texture = toTexture(canvas, repeat);
  // Roughness / bump maps carry data, not colour.
  texture.colorSpace = THREE.NoColorSpace;
  return texture;
}

/** Cheap value noise field, seeded so textures are stable between reloads. */
function noiseField(size: number, octaves: number, seed = 1337): Float32Array {
  const field = new Float32Array(size * size);
  visualRng.seed(seed);
  for (let octave = 0; octave < octaves; octave++) {
    const frequency = Math.pow(2, octave + 2);
    const amplitude = 1 / Math.pow(2, octave);
    const gridSize = Math.max(2, Math.round(frequency));
    const grid = new Float32Array(gridSize * gridSize);
    for (let i = 0; i < grid.length; i++) grid[i] = visualRng.next();
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const gx = (x / size) * gridSize;
        const gy = (y / size) * gridSize;
        const x0 = Math.floor(gx) % gridSize;
        const y0 = Math.floor(gy) % gridSize;
        const x1 = (x0 + 1) % gridSize;
        const y1 = (y0 + 1) % gridSize;
        const fx = gx - Math.floor(gx);
        const fy = gy - Math.floor(gy);
        const sx = fx * fx * (3 - 2 * fx);
        const sy = fy * fy * (3 - 2 * fy);
        const a = grid[y0 * gridSize + x0];
        const b = grid[y0 * gridSize + x1];
        const c = grid[y1 * gridSize + x0];
        const d = grid[y1 * gridSize + x1];
        const top = a + (b - a) * sx;
        const bottom = c + (d - c) * sx;
        field[y * size + x] += (top + (bottom - top) * sy) * amplitude;
      }
    }
  }
  return field;
}

function paintNoise(
  ctx: CanvasRenderingContext2D,
  size: number,
  field: Float32Array,
  color: (value: number) => string,
): void {
  const image = ctx.createImageData(size, size);
  for (let i = 0; i < size * size; i++) {
    const value = Math.min(1, Math.max(0, field[i] / 1.6));
    const [r, g, b] = parseColorString(color(value));
    image.data[i * 4] = r;
    image.data[i * 4 + 1] = g;
    image.data[i * 4 + 2] = b;
    image.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);
}

function parseColorString(input: string): [number, number, number] {
  if (input.startsWith('#')) {
    const hex = input.slice(1);
    return [
      parseInt(hex.slice(0, 2), 16),
      parseInt(hex.slice(2, 4), 16),
      parseInt(hex.slice(4, 6), 16),
    ];
  }
  const match = input.match(/(\d+)\D+(\d+)\D+(\d+)/);
  if (match) return [Number(match[1]), Number(match[2]), Number(match[3])];
  return [0, 0, 0];
}

function hexToRgb(hex: number): [number, number, number] {
  return [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255];
}

function shade(rgb: [number, number, number], factor: number): string {
  const clampByte = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return `rgb(${clampByte(rgb[0] * factor)}, ${clampByte(rgb[1] * factor)}, ${clampByte(rgb[2] * factor)})`;
}

export interface WoodTextureOptions {
  size?: number;
  baseColor?: number;
  grainContrast?: number;
  rings?: number;
  seed?: number;
}

/** Oak/walnut style wood: long grain, cathedral arcs, pores and a matching roughness map. */
export function createWoodTextures(options: WoodTextureOptions = {}): {
  map: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture;
} {
  const size = options.size ?? 512;
  const base = hexToRgb(options.baseColor ?? 0xb08454);
  const contrast = options.grainContrast ?? 0.32;
  const seed = options.seed ?? 7;
  const rings = options.rings ?? 26;

  const { canvas, ctx } = makeCanvas(size);
  const field = noiseField(size, 3, seed);

  paintNoise(ctx, size, field, (v) => shade(base, 0.9 + v * 0.2));

  // Grain lines running along X.
  visualRng.seed(seed + 1);
  for (let i = 0; i < rings; i++) {
    const y = (i / rings) * size + visualRng.jitter(size / rings) * 0.6;
    const darkness = 1 - contrast * (0.4 + visualRng.next() * 0.8);
    ctx.strokeStyle = shade(base, darkness);
    ctx.globalAlpha = 0.35 + visualRng.next() * 0.4;
    ctx.lineWidth = 0.6 + visualRng.next() * 2.4;
    ctx.beginPath();
    ctx.moveTo(-10, y);
    const segments = 8;
    for (let s = 1; s <= segments; s++) {
      const x = (s / segments) * (size + 20) - 10;
      const yy =
        y +
        Math.sin((s / segments) * Math.PI * 2 + i) * (size * 0.012) +
        visualRng.jitter(size * 0.006);
      ctx.lineTo(x, yy);
    }
    ctx.stroke();
  }

  // Cathedral arcs (the classic flat-sawn figure).
  ctx.globalAlpha = 0.16;
  for (let i = 0; i < 5; i++) {
    const cx = visualRng.range(0, size);
    const cy = visualRng.range(0, size);
    for (let r = 20; r < size * 0.55; r += 9 + visualRng.next() * 6) {
      ctx.strokeStyle = shade(base, 1 - contrast * 0.9);
      ctx.lineWidth = 1 + visualRng.next() * 1.6;
      ctx.beginPath();
      ctx.ellipse(cx, cy, r * 1.6, r, 0.2, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  // Pores and speckle.
  ctx.globalAlpha = 0.5;
  for (let i = 0; i < size * 3; i++) {
    const x = visualRng.range(0, size);
    const y = visualRng.range(0, size);
    const len = 1 + visualRng.next() * 5;
    ctx.strokeStyle = shade(base, 0.55 + visualRng.next() * 0.3);
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + len, y + visualRng.jitter(0.6));
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // Roughness: grain is slightly rougher, pores rougher still.
  const { canvas: roughCanvas, ctx: roughCtx } = makeCanvas(size);
  paintNoise(roughCtx, size, field, (v) => {
    const grey = Math.round(120 + v * 90);
    return `rgb(${grey}, ${grey}, ${grey})`;
  });
  roughCtx.globalAlpha = 0.35;
  for (let i = 0; i < size * 2; i++) {
    const x = visualRng.range(0, size);
    const y = visualRng.range(0, size);
    roughCtx.fillStyle = 'rgb(235,235,235)';
    roughCtx.fillRect(x, y, 1 + visualRng.next() * 4, 1);
  }
  roughCtx.globalAlpha = 1;

  return {
    map: toTexture(canvas),
    roughnessMap: toDataTexture(roughCanvas),
  };
}

/** Generic speckled roughness map (plastic, stone, rubber). */
export function createRoughnessNoise(
  size = 256,
  low = 0.25,
  high = 0.6,
  seed = 42,
): THREE.CanvasTexture {
  const { canvas, ctx } = makeCanvas(size);
  const field = noiseField(size, 4, seed);
  paintNoise(ctx, size, field, (v) => {
    const grey = Math.round((low + (high - low) * v) * 255);
    return `rgb(${grey}, ${grey}, ${grey})`;
  });
  return toDataTexture(canvas);
}

/** Soft bumpy normal-ish map derived from noise (used as bumpMap). */
export function createBumpNoise(size = 256, seed = 99): THREE.CanvasTexture {
  const { canvas, ctx } = makeCanvas(size);
  const field = noiseField(size, 4, seed);
  paintNoise(ctx, size, field, (v) => {
    const grey = Math.round(v * 255);
    return `rgb(${grey}, ${grey}, ${grey})`;
  });
  return toDataTexture(canvas);
}

export interface MarbleOptions {
  size?: number;
  baseColor?: number;
  veinColor?: number;
}

export function createMarbleTexture(options: MarbleOptions = {}): THREE.CanvasTexture {
  const size = options.size ?? 512;
  const base = hexToRgb(options.baseColor ?? 0xdad6cd);
  const vein = hexToRgb(options.veinColor ?? 0x8d8a83);
  const { canvas, ctx } = makeCanvas(size);
  const field = noiseField(size, 3, 21);
  paintNoise(ctx, size, field, (v) => shade(base, 0.95 + v * 0.1));

  visualRng.seed(22);
  for (let i = 0; i < 14; i++) {
    ctx.strokeStyle = shade(vein, 0.8 + visualRng.next() * 0.4);
    ctx.globalAlpha = 0.1 + visualRng.next() * 0.25;
    ctx.lineWidth = 0.5 + visualRng.next() * 2.2;
    ctx.beginPath();
    let x = visualRng.range(-0.1, 1.1) * size;
    let y = -10;
    ctx.moveTo(x, y);
    while (y < size + 10) {
      x += visualRng.jitter(size * 0.09);
      y += size * 0.06 + visualRng.next() * size * 0.05;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  return toTexture(canvas);
}

/** Brushed metal: anisotropic-looking streaks. */
export function createBrushedMetalTexture(size = 512, tint = 0xb9bec4): THREE.CanvasTexture {
  const { canvas, ctx } = makeCanvas(size);
  const base = hexToRgb(tint);
  const field = noiseField(size, 2, 55);
  paintNoise(ctx, size, field, (v) => shade(base, 0.92 + v * 0.16));
  visualRng.seed(56);
  for (let i = 0; i < size * 2.5; i++) {
    const y = visualRng.range(0, size);
    const length = visualRng.range(size * 0.2, size);
    const x = visualRng.range(-size * 0.2, size);
    ctx.strokeStyle = `rgba(255,255,255,${visualRng.range(0.02, 0.09)})`;
    ctx.lineWidth = visualRng.range(0.4, 1.4);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + length, y + visualRng.jitter(1.2));
    ctx.stroke();
    ctx.strokeStyle = `rgba(0,0,0,${visualRng.range(0.02, 0.07)})`;
    ctx.beginPath();
    ctx.moveTo(x, y + 1.5);
    ctx.lineTo(x + length, y + 1.5 + visualRng.jitter(1.2));
    ctx.stroke();
  }
  return toTexture(canvas);
}

/** Rubber mat: dark, matte, faintly textured. */
export function createRubberTexture(size = 512, tint = 0x2c2f33): THREE.CanvasTexture {
  const { canvas, ctx } = makeCanvas(size);
  const base = hexToRgb(tint);
  const field = noiseField(size, 4, 77);
  paintNoise(ctx, size, field, (v) => shade(base, 0.85 + v * 0.35));
  visualRng.seed(78);
  ctx.globalAlpha = 0.25;
  for (let i = 0; i < size * 4; i++) {
    ctx.fillStyle = visualRng.next() > 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.08)';
    ctx.fillRect(visualRng.range(0, size), visualRng.range(0, size), 1.5, 1.5);
  }
  ctx.globalAlpha = 1;
  return toTexture(canvas);
}

/** Paper / notebook cover: fibres plus subtle mottling. */
export function createPaperTexture(size = 512, tint = 0xf2efe6): THREE.CanvasTexture {
  const { canvas, ctx } = makeCanvas(size);
  const base = hexToRgb(tint);
  const field = noiseField(size, 4, 123);
  paintNoise(ctx, size, field, (v) => shade(base, 0.94 + v * 0.12));
  visualRng.seed(124);
  ctx.globalAlpha = 0.12;
  for (let i = 0; i < size * 6; i++) {
    const x = visualRng.range(0, size);
    const y = visualRng.range(0, size);
    ctx.strokeStyle = visualRng.next() > 0.5 ? '#ffffff' : '#c9c4b6';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + visualRng.jitter(9), y + visualRng.jitter(4));
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  return toTexture(canvas);
}

/** Plaster wall: broad, soft mottling. */
export function createWallTexture(size = 512, tint = 0xd9d4cb): THREE.CanvasTexture {
  const { canvas, ctx } = makeCanvas(size);
  const base = hexToRgb(tint);
  const field = noiseField(size, 3, 900);
  paintNoise(ctx, size, field, (v) => shade(base, 0.93 + v * 0.14));
  return toTexture(canvas);
}

/** Floor: wide-plank wood with darker seams. */
export function createFloorTexture(size = 1024, tint = 0x7a5b40): THREE.CanvasTexture {
  const { canvas, ctx } = makeCanvas(size);
  const base = hexToRgb(tint);
  const field = noiseField(size, 3, 313);
  paintNoise(ctx, size, field, (v) => shade(base, 0.8 + v * 0.3));

  visualRng.seed(314);
  const plankHeight = size / 8;
  for (let row = 0; row < 8; row++) {
    const y = row * plankHeight;
    const offset = (row % 2) * size * 0.3;
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(size, y);
    ctx.stroke();
    for (let x = offset; x < size; x += size * 0.5) {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, y + plankHeight);
      ctx.stroke();
    }
    // Per-plank tone variation.
    ctx.fillStyle = `rgba(0,0,0,${visualRng.range(0.02, 0.1)})`;
    ctx.fillRect(0, y, size, plankHeight);
  }
  return toTexture(canvas);
}

export interface LabelOptions {
  size?: number;
  primary: string;
  secondary: string;
  text: string;
  subText: string;
  accent?: string;
}

/**
 * The glue stick label: a wrap-around band with the brand block, a weight line
 * and the small print. Wraps a cylinder, so the text is drawn once, centred.
 */
export function createGlueLabelTexture(options: LabelOptions): THREE.CanvasTexture {
  const width = options.size ?? 512;
  const height = Math.round(width / 2);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas context unavailable');

  // Base wrap colour.
  ctx.fillStyle = options.secondary;
  ctx.fillRect(0, 0, width, height);

  // Coloured band across the middle.
  const bandTop = height * 0.18;
  const bandHeight = height * 0.46;
  ctx.fillStyle = options.primary;
  ctx.fillRect(0, bandTop, width, bandHeight);

  // Angled accent swoosh.
  ctx.save();
  ctx.globalAlpha = 0.22;
  ctx.fillStyle = options.accent ?? '#ffffff';
  ctx.beginPath();
  ctx.moveTo(0, bandTop + bandHeight);
  ctx.lineTo(width * 0.62, bandTop);
  ctx.lineTo(width, bandTop);
  ctx.lineTo(width * 0.38, bandTop + bandHeight);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // Brand text.
  ctx.fillStyle = options.secondary;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const fontSize = Math.round(height * 0.3);
  ctx.font = `800 ${fontSize}px "Helvetica Neue", Helvetica, Arial, sans-serif`;
  ctx.fillText(options.text, width * 0.5, bandTop + bandHeight * 0.5, width * 0.8);

  // Sub text (weight / variant).
  ctx.fillStyle = 'rgba(40,40,45,0.85)';
  ctx.font = `600 ${Math.round(height * 0.11)}px "Helvetica Neue", Helvetica, Arial, sans-serif`;
  ctx.fillText(options.subText, width * 0.5, bandTop + bandHeight + height * 0.12, width * 0.8);

  // Small print bar (barcode-ish) for scale detail.
  visualRng.seed(4242);
  const barY = height * 0.86;
  for (let x = width * 0.34; x < width * 0.66; x += 3 + visualRng.next() * 3) {
    ctx.fillStyle = 'rgba(30,30,35,0.75)';
    ctx.fillRect(x, barY, 1 + visualRng.next() * 1.6, height * 0.07);
  }

  // Wear: faint scuffs so it does not look freshly printed.
  ctx.globalAlpha = 0.06;
  for (let i = 0; i < 40; i++) {
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 0.6 + visualRng.next();
    ctx.beginPath();
    const x = visualRng.range(0, width);
    const y = visualRng.range(0, height);
    ctx.moveTo(x, y);
    ctx.lineTo(x + visualRng.jitter(26), y + visualRng.jitter(6));
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.anisotropy = 8;
  texture.needsUpdate = true;
  return texture;
}

/** Soft radial sprite used for dust motes. */
export function createSoftDotTexture(size = 64): THREE.CanvasTexture {
  const { canvas, ctx } = makeCanvas(size);
  const gradient = ctx.createRadialGradient(
    size / 2,
    size / 2,
    0,
    size / 2,
    size / 2,
    size / 2,
  );
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.35, 'rgba(255,255,255,0.55)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** Contact shadow blob projected under the stick. */
export function createContactShadowTexture(size = 256): THREE.CanvasTexture {
  const { canvas, ctx } = makeCanvas(size);
  const gradient = ctx.createRadialGradient(
    size / 2,
    size / 2,
    size * 0.05,
    size / 2,
    size / 2,
    size * 0.5,
  );
  gradient.addColorStop(0, 'rgba(0,0,0,0.55)');
  gradient.addColorStop(0.55, 'rgba(0,0,0,0.22)');
  gradient.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** Landing zone decal: a clean, thin ring with a subtle inner fill. */
export function createZoneTexture(size = 512, tint = '#ffffff'): THREE.CanvasTexture {
  const { canvas, ctx } = makeCanvas(size);
  const center = size / 2;

  const fill = ctx.createRadialGradient(center, center, size * 0.1, center, center, center);
  fill.addColorStop(0, 'rgba(255,255,255,0.16)');
  fill.addColorStop(0.75, 'rgba(255,255,255,0.05)');
  fill.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.arc(center, center, center, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = tint;
  ctx.globalAlpha = 0.85;
  ctx.lineWidth = size * 0.012;
  ctx.beginPath();
  ctx.arc(center, center, size * 0.46, 0, Math.PI * 2);
  ctx.stroke();

  ctx.globalAlpha = 0.45;
  ctx.lineWidth = size * 0.006;
  ctx.beginPath();
  ctx.arc(center, center, size * 0.33, 0, Math.PI * 2);
  ctx.stroke();

  // Tick marks so the player can judge the centre.
  ctx.globalAlpha = 0.6;
  ctx.lineWidth = size * 0.008;
  for (let i = 0; i < 4; i++) {
    const angle = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const r0 = size * 0.4;
    const r1 = size * 0.46;
    ctx.beginPath();
    ctx.moveTo(center + Math.cos(angle) * r0, center + Math.sin(angle) * r0);
    ctx.lineTo(center + Math.cos(angle) * r1, center + Math.sin(angle) * r1);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
