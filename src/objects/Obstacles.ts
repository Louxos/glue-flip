import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { ObstacleSpec } from '@/config/challenges';
import type { MaterialLibrary } from '@/render/MaterialLibrary';
import type { PhysicsWorld } from '@/physics/PhysicsWorld';
import { visualRng } from '@/utils/random';

/**
 * Obstacles for challenges and higher progression levels.
 *
 * They are real static bodies, so a throw that clips a mug really does deflect —
 * which is what makes the "thread the needle" challenges worth playing.
 */
export class ObstacleSet {
  readonly group = new THREE.Group();
  private geometries: THREE.BufferGeometry[] = [];
  private bodies: import('@dimforge/rapier3d-compat').RigidBody[] = [];
  private physics: PhysicsWorld;

  constructor(
    physics: PhysicsWorld,
    private materials: MaterialLibrary,
    specs: ObstacleSpec[],
    zoneCenter: [number, number],
    surfaceY: number,
  ) {
    this.physics = physics;
    this.group.name = 'obstacles';
    for (const spec of specs) this.add(spec, zoneCenter, surfaceY);
  }

  private add(spec: ObstacleSpec, zoneCenter: [number, number], surfaceY: number): void {
    const x = zoneCenter[0] + spec.position[0];
    const z = zoneCenter[1] + spec.position[2];
    const [w, h, d] = spec.size;
    const rotationY = spec.rotationY ?? 0;

    switch (spec.kind) {
      case 'book':
        this.buildBook(x, surfaceY, z, w, h, d, rotationY);
        break;
      case 'mug':
        this.buildMug(x, surfaceY, z, w, h);
        break;
      case 'tape':
        this.buildTape(x, surfaceY, z, w, h);
        break;
      case 'pencilCase':
        this.buildPencilCase(x, surfaceY, z, w, h, d, rotationY);
        break;
      case 'block':
      default:
        this.buildBlock(x, surfaceY, z, w, h, d, rotationY);
        break;
    }
  }

  private track<T extends THREE.BufferGeometry>(geometry: T): T {
    this.geometries.push(geometry);
    return geometry;
  }

  private place(
    mesh: THREE.Mesh,
    position: [number, number, number],
    rotationY = 0,
    name = 'obstacle',
  ): void {
    mesh.position.set(position[0], position[1], position[2]);
    mesh.rotation.y = rotationY;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.name = name;
    this.group.add(mesh);
  }

  private boxCollider(
    position: [number, number, number],
    halfExtents: [number, number, number],
    rotationY = 0,
  ): void {
    const collider = this.physics.createFixedCuboid('obstacle', position, halfExtents, {
      friction: 0.55,
      restitution: 0.22,
      rotationY,
    });
    void collider;
  }

  private buildBook(
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    rotationY: number,
  ): void {
    visualRng.seed(Math.round((x + z) * 1000));
    const coverGeometry = this.track(new RoundedBoxGeometry(w, h, d, 2, 0.004));
    const cover = new THREE.Mesh(coverGeometry, this.materials.fabric(0x35506b));
    this.place(cover, [x, y + h / 2, z], rotationY, 'obstacle-book');

    const paperGeometry = this.track(new THREE.BoxGeometry(w * 0.95, h * 0.78, d * 0.95));
    const paper = new THREE.Mesh(paperGeometry, this.materials.ceramic(0xf4f1e8));
    this.place(paper, [x, y + h / 2, z], rotationY, 'obstacle-book-pages');

    this.boxCollider([x, y + h / 2, z], [w / 2, h / 2, d / 2], rotationY);
  }

  private buildMug(x: number, y: number, z: number, w: number, h: number): void {
    const radius = w / 2;
    const geometry = this.track(new THREE.CylinderGeometry(radius, radius * 0.9, h, 24));
    const mug = new THREE.Mesh(geometry, this.materials.ceramic(0xdfe3e6));
    this.place(mug, [x, y + h / 2, z], 0, 'obstacle-mug');

    const handleGeometry = this.track(new THREE.TorusGeometry(radius * 0.55, radius * 0.14, 8, 18, Math.PI * 1.3));
    const handle = new THREE.Mesh(handleGeometry, this.materials.ceramic(0xdfe3e6));
    handle.position.set(x + radius + radius * 0.35, y + h * 0.55, z);
    handle.rotation.y = Math.PI / 2;
    handle.castShadow = true;
    this.group.add(handle);

    const body = this.physics.world.createRigidBody(
      this.physics.rapier.RigidBodyDesc.fixed().setTranslation(x, y + h / 2, z),
    );
    const collider = this.physics.world.createCollider(
      this.physics.rapier.ColliderDesc.cylinder(h / 2, radius).setFriction(0.5).setRestitution(0.25),
      body,
    );
    this.physics.tag(collider.handle, 'obstacle');
    this.bodies.push(body);
  }

  private buildTape(x: number, y: number, z: number, w: number, h: number): void {
    const baseGeometry = this.track(new RoundedBoxGeometry(w, h * 0.6, w * 0.55, 2, 0.006));
    const base = new THREE.Mesh(baseGeometry, this.materials.darkPlastic(0x23262b));
    this.place(base, [x, y + h * 0.3, z], 0, 'obstacle-tape');

    const rollGeometry = this.track(new THREE.TorusGeometry(w * 0.26, w * 0.09, 10, 26));
    const roll = new THREE.Mesh(rollGeometry, this.materials.gloss(0xc8d0d4, 0.3));
    roll.position.set(x, y + h * 0.85, z);
    roll.rotation.y = Math.PI / 2;
    roll.castShadow = true;
    this.group.add(roll);

    this.boxCollider([x, y + h * 0.45, z], [w / 2, h * 0.45, w * 0.28]);
  }

  private buildPencilCase(
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    rotationY: number,
  ): void {
    const geometry = this.track(new RoundedBoxGeometry(w, h, d, 3, 0.014));
    const caseMesh = new THREE.Mesh(geometry, this.materials.fabric(0x4a4f5a));
    this.place(caseMesh, [x, y + h / 2, z], rotationY, 'obstacle-pencil-case');

    const zipGeometry = this.track(new THREE.BoxGeometry(w * 0.96, 0.004, 0.008));
    const zip = new THREE.Mesh(zipGeometry, this.materials.metal(0xb9bec4, 0.28));
    this.place(zip, [x, y + h * 0.92, z], rotationY, 'obstacle-pencil-case-zip');

    this.boxCollider([x, y + h / 2, z], [w / 2, h / 2, d / 2], rotationY);
  }

  private buildBlock(
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    rotationY: number,
  ): void {
    const geometry = this.track(new RoundedBoxGeometry(w, h, d, 2, 0.006));
    const block = new THREE.Mesh(geometry, this.materials.woodMaterial(0x9c6b3f, [1, 1]));
    this.place(block, [x, y + h / 2, z], rotationY, 'obstacle-block');
    this.boxCollider([x, y + h / 2, z], [w / 2, h / 2, d / 2], rotationY);
  }

  dispose(): void {
    for (const geometry of this.geometries) geometry.dispose();
    for (const body of this.bodies) this.physics.removeBody(body);
    this.bodies = [];
    this.group.clear();
  }
}
