import * as THREE from 'three';
import type { GlueStickVariant } from '@/config/glueSticks';
import type { MaterialLibrary } from '@/render/MaterialLibrary';

/**
 * Procedural glue stick model.
 *
 * Built from lathed profiles so the silhouette has real chamfers (bottom edge,
 * cap lip, dome top) instead of being a plain cylinder. Three material zones
 * match the real object: printed label over the body, glossy cap, dark knurled
 * twist mechanism at the base.
 */

export interface GlueStickModel {
  group: THREE.Group;
  height: number;
  radius: number;
  /** Local Y of the base face. */
  baseY: number;
  /** Local Y of the cap face. */
  capY: number;
  dispose(): void;
}

function lathe(points: [number, number][], segments = 48): THREE.LatheGeometry {
  const vectors = points.map(([x, y]) => new THREE.Vector2(Math.max(0, x), y));
  const geometry = new THREE.LatheGeometry(vectors, segments);
  geometry.computeVertexNormals();
  return geometry;
}

export function buildGlueStick(
  variant: GlueStickVariant,
  materials: MaterialLibrary,
): GlueStickModel {
  const group = new THREE.Group();
  group.name = `glue-stick:${variant.id}`;

  const H = variant.height;
  const r = variant.radius;
  const baseH = Math.min(variant.baseHeight, H * 0.45);
  const capH = Math.min(variant.capHeight, H * 0.42);
  const capR = r * 1.045;

  const yBottom = -H / 2;
  const baseTop = yBottom + baseH;
  const capBottom = H / 2 - capH;
  const chamfer = Math.min(0.0028, H * 0.03);

  const geometries: THREE.BufferGeometry[] = [];

  // --- Body + label ------------------------------------------------------
  const bodyGeometry = lathe(
    [
      [r * 0.985, baseTop - 0.0005],
      [r, baseTop + chamfer * 0.6],
      [r, capBottom - chamfer * 0.6],
      [r * 0.99, capBottom + 0.0005],
    ],
    56,
  );
  geometries.push(bodyGeometry);
  const body = new THREE.Mesh(bodyGeometry, materials.plastic(variant));
  body.castShadow = true;
  body.receiveShadow = true;
  body.name = 'body';
  group.add(body);

  // Printed label wrapped around the middle of the body.
  const labelHeight = (capBottom - baseTop) * 0.82;
  const labelGeometry = new THREE.CylinderGeometry(
    r * 1.004,
    r * 1.004,
    labelHeight,
    56,
    1,
    true,
  );
  geometries.push(labelGeometry);
  const label = new THREE.Mesh(labelGeometry, materials.label(variant));
  label.position.y = (baseTop + capBottom) / 2;
  label.castShadow = true;
  label.receiveShadow = true;
  label.name = 'label';
  group.add(label);

  // --- Cap ---------------------------------------------------------------
  const capGeometry = lathe(
    [
      [r * 0.97, capBottom],
      [capR, capBottom + chamfer],
      [capR, H / 2 - chamfer * 1.2],
      [r * 0.82, H / 2 - chamfer * 0.25],
      [0, H / 2],
    ],
    56,
  );
  geometries.push(capGeometry);
  const cap = new THREE.Mesh(capGeometry, materials.gloss(variant.look.capColor, 0.28));
  cap.castShadow = true;
  cap.receiveShadow = true;
  cap.name = 'cap';
  group.add(cap);

  // Grip ridges around the cap.
  const ridgeCount = Math.max(3, Math.round(variant.look.ridges / 4));
  const ridgeGeometry = new THREE.TorusGeometry(capR * 1.002, Math.max(0.00025, r * 0.02), 6, 40);
  geometries.push(ridgeGeometry);
  const ridgeMaterial = materials.gloss(variant.look.capColor, 0.42);
  for (let i = 0; i < ridgeCount; i++) {
    const ridge = new THREE.Mesh(ridgeGeometry, ridgeMaterial);
    const t = (i + 1) / (ridgeCount + 1);
    ridge.position.y = capBottom + chamfer + t * (capH - chamfer * 2.4);
    ridge.rotation.x = Math.PI / 2;
    ridge.castShadow = true;
    ridge.name = `cap-ridge-${i}`;
    group.add(ridge);
  }

  // --- Base mechanism ----------------------------------------------------
  const baseGeometry = lathe(
    [
      [0, yBottom],
      [r * 0.9, yBottom],
      [r * 0.99, yBottom + chamfer],
      [r, baseTop - chamfer * 0.5],
      [r * 0.96, baseTop],
    ],
    56,
  );
  geometries.push(baseGeometry);
  const base = new THREE.Mesh(baseGeometry, materials.darkPlastic(variant.look.baseColor));
  base.castShadow = true;
  base.receiveShadow = true;
  base.name = 'base';
  group.add(base);

  // Knurled twist dial: a faceted cylinder reads as real knurling.
  const dialHeight = baseH * 0.62;
  const dialGeometry = new THREE.CylinderGeometry(
    r * 1.015,
    r * 1.015,
    dialHeight,
    Math.max(8, variant.look.ridges),
    1,
    true,
  );
  geometries.push(dialGeometry);
  const dial = new THREE.Mesh(dialGeometry, materials.darkPlastic(variant.look.baseColor));
  dial.position.y = yBottom + chamfer + dialHeight / 2;
  dial.castShadow = true;
  dial.name = 'dial';
  group.add(dial);

  // Bottom plug with a small nub (the part you twist).
  const nubGeometry = new THREE.CylinderGeometry(r * 0.34, r * 0.3, H * 0.035, 20);
  geometries.push(nubGeometry);
  const nub = new THREE.Mesh(nubGeometry, materials.darkPlastic(variant.look.baseColor));
  nub.position.y = yBottom - H * 0.012;
  nub.castShadow = true;
  nub.name = 'nub';
  group.add(nub);

  return {
    group,
    height: H,
    radius: r,
    baseY: yBottom,
    capY: H / 2,
    dispose() {
      for (const geometry of geometries) geometry.dispose();
      group.clear();
    },
  };
}
