import * as THREE from 'three';
import type { GlueStickVariant } from '@/config/glueSticks';
import type { SurfacePreset } from '@/config/surfaces';
import {
  createBrushedMetalTexture,
  createBumpNoise,
  createFloorTexture,
  createGlueLabelTexture,
  createMarbleTexture,
  createPaperTexture,
  createRubberTexture,
  createRoughnessNoise,
  createWallTexture,
  createWoodTextures,
} from '@/render/ProceduralTextures';

/**
 * Material library.
 *
 * Everything is a `MeshPhysicalMaterial` with procedurally generated maps, and
 * every material/texture is cached and disposed in one place so quality changes
 * never leak GPU memory.
 */

interface CacheEntry {
  material: THREE.Material;
  textures: THREE.Texture[];
}

export class MaterialLibrary {
  private cache = new Map<string, CacheEntry>();
  private textureScale: number;

  constructor(textureScale = 1) {
    this.textureScale = textureScale;
  }

  private size(base: number): number {
    return Math.max(64, Math.round(base * this.textureScale));
  }

  private register(key: string, material: THREE.Material, textures: THREE.Texture[] = []): void {
    this.cache.set(key, { material, textures });
  }

  /** Matte-ish plastic used for the glue stick body. */
  plastic(variant: GlueStickVariant): THREE.MeshPhysicalMaterial {
    const key = `plastic:${variant.id}`;
    const existing = this.cache.get(key);
    if (existing) return existing.material as THREE.MeshPhysicalMaterial;

    const bump = createBumpNoise(this.size(256), 11);
    const material = new THREE.MeshPhysicalMaterial({
      color: variant.look.bodyColor,
      roughness: variant.look.bodyRoughness,
      metalness: 0.02,
      clearcoat: variant.look.clearcoat,
      clearcoatRoughness: 0.28,
      bumpMap: bump,
      bumpScale: 0.00035,
      sheen: 0.15,
      sheenColor: new THREE.Color(0xffffff),
      envMapIntensity: 1.05,
    });
    this.register(key, material, [bump]);
    return material;
  }

  /** Glossy plastic for caps and dials. */
  gloss(color: number, roughness = 0.3): THREE.MeshPhysicalMaterial {
    const key = `gloss:${color}:${roughness}`;
    const existing = this.cache.get(key);
    if (existing) return existing.material as THREE.MeshPhysicalMaterial;
    const material = new THREE.MeshPhysicalMaterial({
      color,
      roughness,
      metalness: 0.03,
      clearcoat: 0.85,
      clearcoatRoughness: 0.18,
      envMapIntensity: 1.1,
    });
    this.register(key, material);
    return material;
  }

  /** Dark engineering plastic (twist mechanism). */
  darkPlastic(color: number): THREE.MeshPhysicalMaterial {
    const key = `dark:${color}`;
    const existing = this.cache.get(key);
    if (existing) return existing.material as THREE.MeshPhysicalMaterial;
    const bump = createBumpNoise(this.size(128), 31);
    const material = new THREE.MeshPhysicalMaterial({
      color,
      roughness: 0.62,
      metalness: 0.05,
      bumpMap: bump,
      bumpScale: 0.0006,
      envMapIntensity: 0.85,
    });
    this.register(key, material, [bump]);
    return material;
  }

  /** Printed label wrapped around the stick. */
  label(variant: GlueStickVariant): THREE.MeshPhysicalMaterial {
    const key = `label:${variant.id}`;
    const existing = this.cache.get(key);
    if (existing) return existing.material as THREE.MeshPhysicalMaterial;
    const map = createGlueLabelTexture({
      size: this.size(512),
      primary: variant.look.labelPrimary,
      secondary: variant.look.labelSecondary,
      text: variant.look.labelText,
      subText: variant.look.labelSubText,
      accent: variant.look.labelPrimary,
    });
    const roughness = createRoughnessNoise(this.size(256), 0.34, 0.55, 71);
    const material = new THREE.MeshPhysicalMaterial({
      map,
      roughnessMap: roughness,
      roughness: 0.5,
      metalness: 0.0,
      clearcoat: 0.4,
      clearcoatRoughness: 0.35,
      envMapIntensity: 0.95,
    });
    this.register(key, material, [map, roughness]);
    return material;
  }

  /** Landing surface material for a given preset. */
  surface(preset: SurfacePreset): THREE.MeshPhysicalMaterial {
    const key = `surface:${preset.id}`;
    const existing = this.cache.get(key);
    if (existing) return existing.material as THREE.MeshPhysicalMaterial;

    const textures: THREE.Texture[] = [];
    const params: THREE.MeshPhysicalMaterialParameters = {
      color: preset.look.color,
      roughness: preset.look.roughness,
      metalness: preset.look.metalness,
      envMapIntensity: 1,
    };

    switch (preset.look.texture) {
      case 'wood': {
        const { map, roughnessMap } = createWoodTextures({
          size: this.size(512),
          baseColor: preset.look.color,
          seed: preset.id === 'walnut' ? 17 : 7,
        });
        map.repeat.set(2, 2);
        roughnessMap.repeat.set(2, 2);
        params.map = map;
        params.roughnessMap = roughnessMap;
        params.roughness = 1;
        textures.push(map, roughnessMap);
        break;
      }
      case 'stone': {
        const map = createMarbleTexture({ size: this.size(512), baseColor: preset.look.color });
        params.map = map;
        params.clearcoat = 0.35;
        params.clearcoatRoughness = 0.2;
        textures.push(map);
        break;
      }
      case 'metal': {
        const map = createBrushedMetalTexture(this.size(512), preset.look.color);
        map.repeat.set(3, 3);
        params.map = map;
        params.roughness = 0.32;
        textures.push(map);
        break;
      }
      case 'rubber': {
        const map = createRubberTexture(this.size(512), preset.look.color);
        map.repeat.set(3, 3);
        params.map = map;
        textures.push(map);
        break;
      }
      case 'paper': {
        const map = createPaperTexture(this.size(512), preset.look.color);
        params.map = map;
        textures.push(map);
        break;
      }
      case 'glass': {
        params.transparent = true;
        params.opacity = 0.42;
        params.transmission = 0.85;
        params.thickness = 0.012;
        params.ior = 1.5;
        params.roughness = 0.05;
        params.color = 0xe8f2f2;
        params.envMapIntensity = 1.4;
        break;
      }
    }

    const material = new THREE.MeshPhysicalMaterial(params);
    this.register(key, material, textures);
    return material;
  }

  woodMaterial(color: number, repeat: [number, number] = [2, 2]): THREE.MeshStandardMaterial {
    const key = `wood:${color}:${repeat.join('x')}`;
    const existing = this.cache.get(key);
    if (existing) return existing.material as THREE.MeshStandardMaterial;
    const { map, roughnessMap } = createWoodTextures({ size: this.size(512), baseColor: color });
    map.repeat.set(repeat[0], repeat[1]);
    roughnessMap.repeat.set(repeat[0], repeat[1]);
    const material = new THREE.MeshStandardMaterial({
      map,
      roughnessMap,
      roughness: 1,
      metalness: 0.02,
      envMapIntensity: 0.7,
    });
    this.register(key, material, [map, roughnessMap]);
    return material;
  }

  floorMaterial(color: number): THREE.MeshStandardMaterial {
    const key = `floor:${color}`;
    const existing = this.cache.get(key);
    if (existing) return existing.material as THREE.MeshStandardMaterial;
    const map = createFloorTexture(this.size(1024), color);
    map.repeat.set(4, 4);
    const material = new THREE.MeshStandardMaterial({
      map,
      roughness: 0.78,
      metalness: 0.02,
      envMapIntensity: 0.55,
    });
    this.register(key, material, [map]);
    return material;
  }

  wallMaterial(color: number): THREE.MeshStandardMaterial {
    const key = `wall:${color}`;
    const existing = this.cache.get(key);
    if (existing) return existing.material as THREE.MeshStandardMaterial;
    const map = createWallTexture(this.size(512), color);
    map.repeat.set(3, 2);
    const material = new THREE.MeshStandardMaterial({
      map,
      roughness: 0.95,
      metalness: 0,
      envMapIntensity: 0.45,
    });
    this.register(key, material, [map]);
    return material;
  }

  fabric(color: number): THREE.MeshStandardMaterial {
    const key = `fabric:${color}`;
    const existing = this.cache.get(key);
    if (existing) return existing.material as THREE.MeshStandardMaterial;
    const bump = createBumpNoise(this.size(256), 61);
    bump.repeat.set(6, 6);
    const material = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.92,
      metalness: 0,
      bumpMap: bump,
      bumpScale: 0.0015,
    });
    this.register(key, material, [bump]);
    return material;
  }

  metal(color: number, roughness = 0.35): THREE.MeshStandardMaterial {
    const key = `metal:${color}:${roughness}`;
    const existing = this.cache.get(key);
    if (existing) return existing.material as THREE.MeshStandardMaterial;
    const material = new THREE.MeshStandardMaterial({
      color,
      roughness,
      metalness: 0.95,
      envMapIntensity: 1.1,
    });
    this.register(key, material);
    return material;
  }

  ceramic(color: number): THREE.MeshPhysicalMaterial {
    const key = `ceramic:${color}`;
    const existing = this.cache.get(key);
    if (existing) return existing.material as THREE.MeshPhysicalMaterial;
    const material = new THREE.MeshPhysicalMaterial({
      color,
      roughness: 0.22,
      clearcoat: 0.9,
      clearcoatRoughness: 0.12,
      envMapIntensity: 1,
    });
    this.register(key, material);
    return material;
  }

  /** Emissive panel used for the window light. */
  emissivePanel(color: number, intensity: number): THREE.MeshBasicMaterial {
    const key = `emissive:${color}:${intensity}`;
    const existing = this.cache.get(key);
    if (existing) return existing.material as THREE.MeshBasicMaterial;
    const material = new THREE.MeshBasicMaterial({ color, toneMapped: false });
    material.color.multiplyScalar(intensity);
    this.register(key, material);
    return material;
  }

  /** Frees every cached material and texture. */
  dispose(): void {
    for (const entry of this.cache.values()) {
      entry.material.dispose();
      for (const texture of entry.textures) texture.dispose();
    }
    this.cache.clear();
  }
}
