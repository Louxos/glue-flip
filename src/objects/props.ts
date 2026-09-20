import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { MaterialLibrary } from '@/render/MaterialLibrary';
import type { QualityPreset } from '@/config/quality';
import { visualRng } from '@/utils/random';

/**
 * Desk dressing.
 *
 * Secondary objects give the scene scale, occlusion and believable reflections,
 * but they are deliberately placed away from the play area so they never compete
 * with the glue stick for attention.
 */

export type PropColliderSpec =
  | {
      type: 'box';
      position: [number, number, number];
      halfExtents: [number, number, number];
      rotationY?: number;
    }
  | {
      type: 'cylinder';
      position: [number, number, number];
      radius: number;
      halfHeight: number;
    };

export interface PropBuild {
  group: THREE.Group;
  colliders: PropColliderSpec[];
  dispose(): void;
}

interface BuildContext {
  materials: MaterialLibrary;
  group: THREE.Group;
  colliders: PropColliderSpec[];
  geometries: THREE.BufferGeometry[];
  surfaceY: number;
}

function track(geometry: THREE.BufferGeometry, ctx: BuildContext): THREE.BufferGeometry {
  ctx.geometries.push(geometry);
  return geometry;
}

function mesh(
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  position: [number, number, number],
  ctx: BuildContext,
  name: string,
): THREE.Mesh {
  const object = new THREE.Mesh(track(geometry, ctx), material);
  object.position.set(position[0], position[1], position[2]);
  object.castShadow = true;
  object.receiveShadow = true;
  object.name = name;
  ctx.group.add(object);
  return object;
}

/** Stack of notebooks with slightly rotated pages. */
function buildNotebookStack(ctx: BuildContext, position: [number, number, number]): void {
  visualRng.seed(2024);
  const colours = [0x2f4858, 0x8c3b2e, 0xd9d3c5];
  let y = ctx.surfaceY;
  for (let i = 0; i < 3; i++) {
    const w = 0.21 - i * 0.006;
    const d = 0.155 - i * 0.005;
    const h = 0.016;
    const geometry = new RoundedBoxGeometry(w, h, d, 2, 0.002);
    const cover = mesh(geometry, ctx.materials.fabric(colours[i]), [position[0], y + h / 2, position[2]], ctx, `notebook-${i}`);
    cover.rotation.y = visualRng.jitter(0.18);
    // Paper block slightly inset and lighter.
    const paperGeometry = new THREE.BoxGeometry(w * 0.94, h * 0.72, d * 0.94);
    const paper = mesh(paperGeometry, ctx.materials.ceramic(0xf3efe4), [position[0], y + h / 2, position[2]], ctx, `notebook-paper-${i}`);
    paper.rotation.y = cover.rotation.y;
    y += h;
  }
  ctx.colliders.push({
    type: 'box',
    position: [position[0], ctx.surfaceY + 0.024, position[2]],
    halfExtents: [0.105, 0.024, 0.078],
    rotationY: 0,
  });
}

/** Ceramic mug with a handle. */
function buildMug(ctx: BuildContext, position: [number, number, number]): void {
  const profile: THREE.Vector2[] = [];
  const height = 0.095;
  const radius = 0.036;
  for (let i = 0; i <= 10; i++) {
    const t = i / 10;
    const r = radius * (0.88 + 0.12 * Math.sin(t * Math.PI * 0.75));
    profile.push(new THREE.Vector2(r, t * height));
  }
  profile.push(new THREE.Vector2(radius * 0.82, height));
  const geometry = new THREE.LatheGeometry(profile, 32);
  const mug = mesh(geometry, ctx.materials.ceramic(0xe8e4da), position, ctx, 'mug');
  mug.position.y = position[1] + 0;

  const handleGeometry = new THREE.TorusGeometry(0.024, 0.006, 8, 20, Math.PI * 1.2);
  const handle = mesh(handleGeometry, ctx.materials.ceramic(0xe8e4da), [position[0] + radius + 0.012, position[1] + height * 0.55, position[2]], ctx, 'mug-handle');
  handle.rotation.y = Math.PI / 2;
  handle.rotation.z = -0.5;

  ctx.colliders.push({
    type: 'cylinder',
    position: [position[0], position[1] + height / 2, position[2]],
    radius: radius + 0.004,
    halfHeight: height / 2,
  });
}

/** Pencil: hexagonal body, wood cone, graphite tip. */
function buildPencil(ctx: BuildContext, position: [number, number, number], rotationY: number): void {
  const length = 0.17;
  const radius = 0.0038;
  const bodyGeometry = new THREE.CylinderGeometry(radius, radius, length, 6);
  const body = mesh(bodyGeometry, ctx.materials.gloss(0xd9a441, 0.4), [position[0], position[1] + radius, position[2]], ctx, 'pencil');
  body.rotation.z = Math.PI / 2;
  body.rotation.y = rotationY;

  const tipGeometry = new THREE.ConeGeometry(radius, 0.014, 6);
  const tip = mesh(tipGeometry, ctx.materials.gloss(0xe4cfa4, 0.7), [position[0] + Math.cos(rotationY) * (length / 2 + 0.006), position[1] + radius, position[2] - Math.sin(rotationY) * (length / 2 + 0.006)], ctx, 'pencil-tip');
  tip.rotation.z = -Math.PI / 2;
  tip.rotation.y = rotationY;

  ctx.colliders.push({
    type: 'cylinder',
    position: [position[0], position[1] + radius, position[2]],
    radius,
    halfHeight: length / 2,
  });
}

/** Tape dispenser: weighted base plus a roll. */
function buildTapeDispenser(ctx: BuildContext, position: [number, number, number]): void {
  const baseGeometry = new RoundedBoxGeometry(0.1, 0.035, 0.055, 2, 0.008);
  mesh(baseGeometry, ctx.materials.darkPlastic(0x1f2226), [position[0], position[1] + 0.0175, position[2]], ctx, 'tape-base');

  const rollGeometry = new THREE.TorusGeometry(0.026, 0.009, 10, 28);
  const roll = mesh(rollGeometry, ctx.materials.gloss(0xcfd6d9, 0.25), [position[0], position[1] + 0.052, position[2]], ctx, 'tape-roll');
  roll.rotation.y = Math.PI / 2;

  ctx.colliders.push({
    type: 'box',
    position: [position[0], position[1] + 0.03, position[2]],
    halfExtents: [0.05, 0.03, 0.03],
  });
}

/** Phone lying face-down: dark glass slab with a camera bump. */
function buildPhone(ctx: BuildContext, position: [number, number, number], rotationY: number): void {
  const geometry = new RoundedBoxGeometry(0.072, 0.0085, 0.148, 3, 0.004);
  const phone = mesh(geometry, ctx.materials.gloss(0x14161a, 0.16), [position[0], position[1] + 0.0043, position[2]], ctx, 'phone');
  phone.rotation.y = rotationY;

  const bumpGeometry = new RoundedBoxGeometry(0.026, 0.003, 0.028, 2, 0.0015);
  const bump = mesh(bumpGeometry, ctx.materials.gloss(0x0c0d10, 0.2), [position[0] + Math.sin(rotationY) * 0.02, position[1] + 0.01, position[2] - Math.cos(rotationY) * 0.055], ctx, 'phone-camera');
  bump.rotation.y = rotationY;

  ctx.colliders.push({
    type: 'box',
    position: [position[0], position[1] + 0.005, position[2]],
    halfExtents: [0.036, 0.005, 0.074],
    rotationY,
  });
}

/** Small potted plant for a bit of organic shape and colour. */
function buildPlant(ctx: BuildContext, position: [number, number, number]): void {
  const potProfile: THREE.Vector2[] = [];
  for (let i = 0; i <= 8; i++) {
    const t = i / 8;
    potProfile.push(new THREE.Vector2(0.042 + t * 0.012, t * 0.075));
  }
  const potGeometry = new THREE.LatheGeometry(potProfile, 24);
  mesh(potGeometry, ctx.materials.ceramic(0xb7654a), position, ctx, 'plant-pot');

  const soilGeometry = new THREE.CylinderGeometry(0.05, 0.048, 0.008, 20);
  mesh(soilGeometry, ctx.materials.darkPlastic(0x2a211b), [position[0], position[1] + 0.073, position[2]], ctx, 'plant-soil');

  visualRng.seed(808);
  const leafGeometry = new THREE.SphereGeometry(0.028, 10, 8);
  for (let i = 0; i < 7; i++) {
    const angle = (i / 7) * Math.PI * 2;
    const radius = 0.022 + visualRng.next() * 0.02;
    const leaf = mesh(
      leafGeometry,
      ctx.materials.fabric(0x3f6b45),
      [
        position[0] + Math.cos(angle) * radius,
        position[1] + 0.09 + visualRng.next() * 0.045,
        position[2] + Math.sin(angle) * radius,
      ],
      ctx,
      `plant-leaf-${i}`,
    );
    leaf.scale.set(0.8, 1.5 + visualRng.next(), 0.8);
    leaf.rotation.z = visualRng.jitter(0.5);
  }

  ctx.colliders.push({
    type: 'cylinder',
    position: [position[0], position[1] + 0.06, position[2]],
    radius: 0.055,
    halfHeight: 0.06,
  });
}

/**
 * Places the dressing around the play area.
 * `minimal` keeps only what reads at a glance; `full` adds the extra clutter.
 */
export function buildProps(
  materials: MaterialLibrary,
  detail: QualityPreset['props'],
  surfaceY: number,
): PropBuild {
  const group = new THREE.Group();
  group.name = 'desk-props';
  const colliders: PropColliderSpec[] = [];
  const geometries: THREE.BufferGeometry[] = [];
  const ctx: BuildContext = { materials, group, colliders, geometries, surfaceY };

  // Left of the play area.
  buildNotebookStack(ctx, [-0.62, surfaceY, -0.34]);
  buildPencil(ctx, [-0.44, surfaceY, -0.08], 0.35);

  if (detail !== 'minimal') {
    buildMug(ctx, [0.62, surfaceY, -0.4]);
    buildTapeDispenser(ctx, [0.56, surfaceY, 0.16]);
  }

  if (detail === 'full') {
    buildPhone(ctx, [-0.66, surfaceY, 0.2], -0.4);
    buildPlant(ctx, [0.78, surfaceY, -0.1]);
  }

  return {
    group,
    colliders,
    dispose() {
      for (const geometry of geometries) geometry.dispose();
      group.clear();
    },
  };
}
