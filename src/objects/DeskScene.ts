import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js';
import { WORLD } from '@/config/world';
import type { QualityPreset } from '@/config/quality';
import type { MaterialLibrary } from '@/render/MaterialLibrary';
import type { PhysicsWorld } from '@/physics/PhysicsWorld';
import { buildProps } from '@/objects/props';
import type { PropBuild } from '@/objects/props';
import { createSoftDotTexture } from '@/render/ProceduralTextures';
import { visualRng } from '@/utils/random';
import { createLogger } from '@/utils/logger';

const log = createLogger('scene');

/**
 * The desk environment: room shell, desk, lighting and atmosphere.
 *
 * Everything is built once and then only animated cheaply (dust drift, subtle
 * light flicker). The same class serves the gameplay scenes and the animated
 * main-menu backdrop.
 */
export class DeskScene {
  readonly group = new THREE.Group();
  readonly lights: {
    key: THREE.DirectionalLight;
    fill: THREE.DirectionalLight;
    hemisphere: THREE.HemisphereLight;
    window: THREE.RectAreaLight;
  };

  private materials: MaterialLibrary;
  private preset: QualityPreset;
  private geometries: THREE.BufferGeometry[] = [];
  private props: PropBuild;
  private dust: THREE.Points | null = null;
  private dustVelocities: Float32Array = new Float32Array(0);
  private dustTexture: THREE.CanvasTexture | null = null;
  private windowMesh: THREE.Mesh | null = null;
  private disposables: { dispose(): void }[] = [];
  private time = 0;

  constructor(materials: MaterialLibrary, preset: QualityPreset) {
    this.materials = materials;
    this.preset = preset;
    this.group.name = 'desk-scene';

    RectAreaLightUniformsLib.init();

    this.buildRoom();
    this.buildDesk();
    this.lights = this.buildLights();
    this.props = buildProps(materials, preset.props, WORLD.desk.topY);
    this.group.add(this.props.group);
    this.buildDust(preset.dust);

    log.debug('scene built', { props: preset.props, dust: preset.dust });
  }

  // --- Construction ------------------------------------------------------

  private buildRoom(): void {
    const { floor, room, desk } = WORLD;

    const floorGeometry = new THREE.PlaneGeometry(floor.size, floor.size);
    this.geometries.push(floorGeometry);
    const floorMesh = new THREE.Mesh(floorGeometry, this.materials.floorMaterial(0x6f543d));
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.position.y = floor.y;
    floorMesh.receiveShadow = true;
    floorMesh.name = 'floor';
    this.group.add(floorMesh);

    const wallGeometry = new THREE.PlaneGeometry(room.wallWidth, room.wallHeight);
    this.geometries.push(wallGeometry);
    const backWall = new THREE.Mesh(wallGeometry, this.materials.wallMaterial(0xcfc8bb));
    backWall.position.set(0, room.wallHeight / 2, room.wallZ);
    backWall.receiveShadow = true;
    backWall.name = 'wall-back';
    this.group.add(backWall);

    const sideWall = new THREE.Mesh(wallGeometry, this.materials.wallMaterial(0xc6bfb2));
    sideWall.rotation.y = Math.PI / 2;
    sideWall.position.set(-room.wallWidth / 2 + 0.5, room.wallHeight / 2, room.wallZ + room.wallWidth / 2);
    sideWall.receiveShadow = true;
    sideWall.name = 'wall-side';
    this.group.add(sideWall);

    // Skirting board where the wall meets the floor.
    const skirtGeometry = new THREE.BoxGeometry(room.wallWidth, 0.09, 0.02);
    this.geometries.push(skirtGeometry);
    const skirt = new THREE.Mesh(skirtGeometry, this.materials.darkPlastic(0xe6e0d5));
    skirt.position.set(0, 0.045, room.wallZ + 0.011);
    skirt.receiveShadow = true;
    this.group.add(skirt);

    // Window: frame + bright pane (reads as daylight, feeds the bloom).
    const { window: win } = room;
    const paneGeometry = new THREE.PlaneGeometry(win.width, win.height);
    this.geometries.push(paneGeometry);
    this.windowMesh = new THREE.Mesh(paneGeometry, this.materials.emissivePanel(0xdce9f5, 3.4));
    this.windowMesh.position.set(win.x, win.y, room.wallZ + 0.02);
    this.windowMesh.name = 'window-pane';
    this.group.add(this.windowMesh);

    const frameMaterial = this.materials.darkPlastic(0xf0ece4);
    const frameThickness = 0.045;
    const frameDepth = 0.05;
    const frameSpecs: [number, number, number, number][] = [
      [win.width + frameThickness * 2, frameThickness, win.x, win.y + win.height / 2 + frameThickness / 2],
      [win.width + frameThickness * 2, frameThickness, win.x, win.y - win.height / 2 - frameThickness / 2],
      [frameThickness, win.height, win.x - win.width / 2 - frameThickness / 2, win.y],
      [frameThickness, win.height, win.x + win.width / 2 + frameThickness / 2, win.y],
      [frameThickness * 0.6, win.height, win.x, win.y],
    ];
    for (const [w, h, x, y] of frameSpecs) {
      const geometry = new THREE.BoxGeometry(w, h, frameDepth);
      this.geometries.push(geometry);
      const bar = new THREE.Mesh(geometry, frameMaterial);
      bar.position.set(x, y, room.wallZ + 0.03);
      bar.castShadow = true;
      this.group.add(bar);
    }

    // Sill.
    const sillGeometry = new THREE.BoxGeometry(win.width + 0.14, 0.03, 0.14);
    this.geometries.push(sillGeometry);
    const sill = new THREE.Mesh(sillGeometry, frameMaterial);
    sill.position.set(win.x, win.y - win.height / 2 - frameThickness, room.wallZ + 0.07);
    sill.castShadow = true;
    sill.receiveShadow = true;
    this.group.add(sill);

    // Keep the desk reference used by buildDesk in scope for linting.
    void desk;
  }

  private buildDesk(): void {
    const { desk } = WORLD;
    const topY = desk.topY;
    const halfWidth = desk.width / 2;
    const halfDepth = desk.depth / 2;

    // Top with a soft bevel.
    const topGeometry = new RoundedBoxGeometry(
      desk.width,
      desk.thickness,
      desk.depth,
      3,
      0.006,
    );
    this.geometries.push(topGeometry);
    const top = new THREE.Mesh(topGeometry, this.materials.woodMaterial(0xa9793f, [2.2, 1.6]));
    top.position.set(0, topY - desk.thickness / 2, 0);
    top.castShadow = true;
    top.receiveShadow = true;
    top.name = 'desk-top';
    this.group.add(top);

    // Apron rails under the top.
    const apronMaterial = this.materials.darkPlastic(0x3b3f45);
    const apronSpecs: [number, number, number, number, number][] = [
      [desk.width - desk.legInset * 2, desk.apronHeight, 0, topY - desk.thickness - desk.apronHeight / 2, -halfDepth + 0.06],
      [desk.width - desk.legInset * 2, desk.apronHeight, 0, topY - desk.thickness - desk.apronHeight / 2, halfDepth - 0.06],
      [0.05, desk.apronHeight, -halfWidth + 0.06, topY - desk.thickness - desk.apronHeight / 2, 0],
      [0.05, desk.apronHeight, halfWidth - 0.06, topY - desk.thickness - desk.apronHeight / 2, 0],
    ];
    for (const [w, h, x, y, z] of apronSpecs) {
      const depth = w > 0.1 ? 0.04 : desk.depth - desk.legInset * 2;
      const geometry = new THREE.BoxGeometry(w, h, depth);
      this.geometries.push(geometry);
      const apron = new THREE.Mesh(geometry, apronMaterial);
      apron.position.set(x, y, z);
      apron.castShadow = true;
      apron.receiveShadow = true;
      this.group.add(apron);
    }

    // Legs: slightly tapered metal.
    const legMaterial = this.materials.metal(0x2f3238, 0.45);
    const legHeight = topY - desk.thickness;
    const legGeometry = new THREE.CylinderGeometry(
      desk.legSize * 0.5,
      desk.legSize * 0.62,
      legHeight,
      12,
    );
    this.geometries.push(legGeometry);
    const legPositions: [number, number][] = [
      [-halfWidth + desk.legInset, -halfDepth + desk.legInset],
      [halfWidth - desk.legInset, -halfDepth + desk.legInset],
      [-halfWidth + desk.legInset, halfDepth - desk.legInset],
      [halfWidth - desk.legInset, halfDepth - desk.legInset],
    ];
    for (const [x, z] of legPositions) {
      const leg = new THREE.Mesh(legGeometry, legMaterial);
      leg.position.set(x, legHeight / 2, z);
      leg.castShadow = true;
      leg.receiveShadow = true;
      this.group.add(leg);
    }

    // Drawer unit for silhouette and occlusion.
    const drawerGeometry = new RoundedBoxGeometry(0.42, 0.42, desk.depth - 0.2, 2, 0.008);
    this.geometries.push(drawerGeometry);
    const drawer = new THREE.Mesh(drawerGeometry, this.materials.darkPlastic(0x35393f));
    drawer.position.set(halfWidth - 0.3, 0.22, 0);
    drawer.castShadow = true;
    drawer.receiveShadow = true;
    this.group.add(drawer);

    for (let i = 0; i < 3; i++) {
      const handleGeometry = new THREE.CylinderGeometry(0.006, 0.006, 0.12, 8);
      this.geometries.push(handleGeometry);
      const handle = new THREE.Mesh(handleGeometry, this.materials.metal(0xaeb4bb, 0.3));
      handle.rotation.z = Math.PI / 2;
      handle.position.set(halfWidth - 0.3, 0.34 - i * 0.13, (desk.depth - 0.2) / 2 + 0.004);
      handle.rotation.x = Math.PI / 2;
      handle.castShadow = true;
      this.group.add(handle);
    }
  }

  private buildLights(): {
    key: THREE.DirectionalLight;
    fill: THREE.DirectionalLight;
    hemisphere: THREE.HemisphereLight;
    window: THREE.RectAreaLight;
  } {
    const { window: win, wallZ } = WORLD.room;

    const hemisphere = new THREE.HemisphereLight(0xd8e6f2, 0x3a2f26, 0.55);
    this.group.add(hemisphere);

    // Key light: sunlight through the window.
    const key = new THREE.DirectionalLight(0xfff2dd, 2.9);
    key.position.set(win.x + 1.1, 2.5, wallZ + 1.1);
    key.target.position.set(0, WORLD.desk.topY, 0.05);
    key.castShadow = this.preset.shadows;
    key.shadow.mapSize.set(this.preset.shadowMapSize, this.preset.shadowMapSize);
    key.shadow.camera.near = 0.5;
    key.shadow.camera.far = 8;
    key.shadow.camera.left = -1.8;
    key.shadow.camera.right = 1.8;
    key.shadow.camera.top = 1.8;
    key.shadow.camera.bottom = -1.8;
    key.shadow.bias = -0.0004;
    key.shadow.normalBias = 0.012;
    key.shadow.radius = 2.5;
    this.group.add(key);
    this.group.add(key.target);

    // Fill from the opposite side keeps shadows readable without flattening.
    const fill = new THREE.DirectionalLight(0xcfe0f5, this.preset.fillLight ? 0.55 : 0.28);
    fill.position.set(-2.2, 1.6, 2.4);
    fill.target.position.set(0, WORLD.desk.topY, 0);
    this.group.add(fill);
    this.group.add(fill.target);

    // Soft window bounce.
    const windowLight = new THREE.RectAreaLight(0xdfeaf7, 3.2, win.width, win.height);
    windowLight.position.set(win.x, win.y, wallZ + 0.08);
    windowLight.lookAt(0, WORLD.desk.topY, 0.2);
    this.group.add(windowLight);

    return { key, fill, hemisphere, window: windowLight };
  }

  private buildDust(count: number): void {
    if (count <= 0) {
      this.removeDust();
      return;
    }
    this.removeDust();

    const positions = new Float32Array(count * 3);
    this.dustVelocities = new Float32Array(count * 3);
    visualRng.seed(31);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = visualRng.range(-1.5, 1.5);
      positions[i * 3 + 1] = visualRng.range(WORLD.desk.topY - 0.1, 2.1);
      positions[i * 3 + 2] = visualRng.range(-1.2, 1.2);
      this.dustVelocities[i * 3] = visualRng.range(-0.006, 0.006);
      this.dustVelocities[i * 3 + 1] = visualRng.range(-0.004, 0.006);
      this.dustVelocities[i * 3 + 2] = visualRng.range(-0.006, 0.006);
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.dustTexture = createSoftDotTexture(64);
    const material = new THREE.PointsMaterial({
      size: 0.0075,
      map: this.dustTexture,
      transparent: true,
      opacity: 0.32,
      depthWrite: false,
      sizeAttenuation: true,
      blending: THREE.AdditiveBlending,
      color: 0xfff4e2,
    });
    this.dust = new THREE.Points(geometry, material);
    this.dust.name = 'dust';
    this.dust.frustumCulled = false;
    this.group.add(this.dust);
  }

  private removeDust(): void {
    if (!this.dust) return;
    this.group.remove(this.dust);
    this.dust.geometry.dispose();
    (this.dust.material as THREE.Material).dispose();
    this.dustTexture?.dispose();
    this.dust = null;
    this.dustTexture = null;
  }

  // --- Runtime -----------------------------------------------------------

  /** Registers the static colliders that match this scene's visuals. */
  createColliders(physics: PhysicsWorld): void {
    const { desk, floor, room } = WORLD;

    physics.createFixedCuboid(
      'desk',
      [0, desk.topY - desk.thickness / 2, 0],
      [desk.width / 2, desk.thickness / 2, desk.depth / 2],
      { friction: 0.6, restitution: 0.2 },
    );

    physics.createFixedCuboid(
      'floor',
      [0, floor.y - 0.25, 0],
      [floor.size / 2, 0.25, floor.size / 2],
      { friction: 0.75, restitution: 0.15 },
    );

    physics.createFixedCuboid(
      'wall',
      [0, room.wallHeight / 2, room.wallZ - 0.05],
      [room.wallWidth / 2, room.wallHeight / 2, 0.05],
      { friction: 0.5, restitution: 0.2 },
    );

    physics.createFixedCuboid(
      'wall',
      [-room.wallWidth / 2 + 0.45, room.wallHeight / 2, 0],
      [0.05, room.wallHeight / 2, room.wallWidth / 2],
      { friction: 0.5, restitution: 0.2 },
    );

    for (const collider of this.props.colliders) {
      if (collider.type === 'box') {
        physics.createFixedCuboid('prop', collider.position, collider.halfExtents, {
          friction: 0.6,
          restitution: 0.2,
          rotationY: collider.rotationY ?? 0,
        });
      } else {
        const body = physics.world.createRigidBody(
          physics.rapier.RigidBodyDesc.fixed().setTranslation(
            collider.position[0],
            collider.position[1],
            collider.position[2],
          ),
        );
        const desc = physics.rapier.ColliderDesc.cylinder(collider.halfHeight, collider.radius)
          .setFriction(0.55)
          .setRestitution(0.2);
        const created = physics.world.createCollider(desc, body);
        physics.tag(created.handle, 'prop');
      }
    }
  }

  applyQuality(preset: QualityPreset): void {
    this.preset = preset;
    this.lights.key.castShadow = preset.shadows;
    this.lights.key.shadow.mapSize.set(preset.shadowMapSize, preset.shadowMapSize);
    this.lights.key.shadow.map?.dispose();
    this.lights.key.shadow.map = null as unknown as THREE.WebGLRenderTarget;
    this.lights.fill.intensity = preset.fillLight ? 0.55 : 0.28;

    const previousProps = this.props;
    this.group.remove(previousProps.group);
    previousProps.dispose();
    this.props = buildProps(this.materials, preset.props, WORLD.desk.topY);
    this.group.add(this.props.group);

    this.buildDust(preset.dust);
  }

  update(dt: number, elapsed: number): void {
    this.time = elapsed;

    if (this.dust) {
      const attribute = this.dust.geometry.getAttribute('position') as THREE.BufferAttribute;
      const array = attribute.array as Float32Array;
      const count = array.length / 3;
      for (let i = 0; i < count; i++) {
        const ix = i * 3;
        array[ix] += (this.dustVelocities[ix] + Math.sin(elapsed * 0.3 + i) * 0.0006) * dt * 12;
        array[ix + 1] += this.dustVelocities[ix + 1] * dt * 8;
        array[ix + 2] += (this.dustVelocities[ix + 2] + Math.cos(elapsed * 0.24 + i) * 0.0006) * dt * 12;

        if (array[ix + 1] > 2.2) array[ix + 1] = WORLD.desk.topY - 0.1;
        if (array[ix + 1] < WORLD.desk.topY - 0.2) array[ix + 1] = 2.1;
        if (Math.abs(array[ix]) > 1.7) array[ix] *= -0.9;
        if (Math.abs(array[ix + 2]) > 1.4) array[ix + 2] *= -0.9;
      }
      attribute.needsUpdate = true;
    }

    if (this.windowMesh) {
      // Extremely subtle daylight variation so the scene never looks frozen.
      const flicker = 1 + Math.sin(this.time * 0.35) * 0.012 + Math.sin(this.time * 1.7) * 0.006;
      this.lights.key.intensity = 2.9 * flicker;
    }
  }

  dispose(): void {
    this.removeDust();
    this.props.dispose();
    for (const geometry of this.geometries) geometry.dispose();
    for (const item of this.disposables) item.dispose();
    this.group.clear();
  }
}
