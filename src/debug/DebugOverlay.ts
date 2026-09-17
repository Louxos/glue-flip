import * as THREE from 'three';
import type { Engine } from '@/core/Engine';
import type { UIManager } from '@/ui/UIManager';
import type { PhysicsWorld } from '@/physics/PhysicsWorld';
import type { GameController } from '@/gameplay/GameController';
import type { ThrowPhase } from '@/gameplay/GameEvents';
import { createLogger } from '@/utils/logger';

const log = createLogger('debug');

export interface DebugInfo {
  phase: ThrowPhase;
  fps: number;
  frameMs: number;
  resolutionScale: number;
  drawCalls: number;
  timeScale: number;
}

/**
 * Development overlay.
 *
 * Shows live telemetry (velocity, spin, tilt, contacts) and draws the things
 * that are otherwise invisible: Rapier's collider wireframe, the centre of mass,
 * the velocity and angular-velocity vectors, the predicted trajectory and the
 * two raycasts the game plays with (the grab ray and the landing ray).
 * Disabled in normal play; toggled with F1 or from Settings.
 */
export class DebugOverlay {
  enabled = false;

  private engine: Engine;
  private physics: PhysicsWorld;
  private ui: UIManager;
  private controller: GameController | null = null;
  private colliderLines: THREE.LineSegments | null = null;
  private comMarker: THREE.Mesh;
  private velocityArrow: THREE.ArrowHelper;
  private spinArrow: THREE.ArrowHelper;
  private trajectoryLine: THREE.Line;
  private rayLines: THREE.LineSegments;
  private readonly trajectoryCapacity = 96;
  private readonly rayVertices = new Float32Array(12); // 2 segments
  private refreshTimer = 0;
  private lines: string[] = [];

  constructor(engine: Engine, physics: PhysicsWorld, ui: UIManager) {
    this.engine = engine;
    this.physics = physics;
    this.ui = ui;

    const markerGeometry = new THREE.SphereGeometry(0.004, 12, 8);
    const markerMaterial = new THREE.MeshBasicMaterial({ color: 0xff5c5c, toneMapped: false });
    this.comMarker = new THREE.Mesh(markerGeometry, markerMaterial);
    this.comMarker.name = 'debug-com';
    this.comMarker.visible = false;

    this.velocityArrow = new THREE.ArrowHelper(
      new THREE.Vector3(0, 1, 0),
      new THREE.Vector3(),
      0.1,
      0x6fd3ff,
      0.02,
      0.012,
    );
    this.spinArrow = new THREE.ArrowHelper(
      new THREE.Vector3(1, 0, 0),
      new THREE.Vector3(),
      0.06,
      0xffd166,
      0.016,
      0.01,
    );
    this.velocityArrow.visible = false;
    this.spinArrow.visible = false;

    const trajectoryGeometry = new THREE.BufferGeometry();
    trajectoryGeometry.setAttribute(
      'position',
      new THREE.BufferAttribute(new Float32Array(this.trajectoryCapacity * 3), 3),
    );
    trajectoryGeometry.setDrawRange(0, 0);
    this.trajectoryLine = new THREE.Line(
      trajectoryGeometry,
      new THREE.LineDashedMaterial({
        color: 0x6fd3ff,
        dashSize: 0.02,
        gapSize: 0.015,
        transparent: true,
        opacity: 0.85,
        depthTest: false,
        toneMapped: false,
      }),
    );
    this.trajectoryLine.name = 'debug-trajectory';
    this.trajectoryLine.visible = false;
    this.trajectoryLine.renderOrder = 998;

    const rayGeometry = new THREE.BufferGeometry();
    rayGeometry.setAttribute('position', new THREE.BufferAttribute(this.rayVertices, 3));
    this.rayLines = new THREE.LineSegments(
      rayGeometry,
      new THREE.LineBasicMaterial({
        color: 0xff8fa3,
        transparent: true,
        opacity: 0.8,
        depthTest: false,
        toneMapped: false,
      }),
    );
    this.rayLines.name = 'debug-rays';
    this.rayLines.visible = false;
    this.rayLines.renderOrder = 998;

    engine.scene.add(
      this.comMarker,
      this.velocityArrow,
      this.spinArrow,
      this.trajectoryLine,
      this.rayLines,
    );
  }

  /** Fills the trajectory line from the predicted path of the aimed throw. */
  private updateTrajectory(): number {
    const trajectory = this.controller?.debugTrajectory ?? null;
    if (!trajectory || trajectory.points.length < 2) {
      this.trajectoryLine.visible = false;
      return 0;
    }
    const attribute = this.trajectoryLine.geometry.getAttribute('position') as THREE.BufferAttribute;
    const stride = Math.max(1, Math.ceil(trajectory.points.length / this.trajectoryCapacity));
    let count = 0;
    for (let i = 0; i < trajectory.points.length && count < this.trajectoryCapacity; i += stride) {
      const p = trajectory.points[i].position;
      attribute.setXYZ(count, p[0], p[1], p[2]);
      count += 1;
    }
    attribute.needsUpdate = true;
    this.trajectoryLine.geometry.setDrawRange(0, count);
    this.trajectoryLine.computeLineDistances();
    this.trajectoryLine.visible = count > 1;
    return count;
  }

  /**
   * Draws the two raycasts the gameplay actually uses: the camera ray that drags
   * the held stick, and the vertical ray that finds the surface underneath it.
   */
  private updateRays(): string {
    const body = this.controller?.entity.body;
    if (!body) {
      this.rayLines.visible = false;
      return '-';
    }
    const position = body.position();
    let cursor = 0;
    const put = (a: [number, number, number], b: [number, number, number]) => {
      this.rayVertices[cursor++] = a[0];
      this.rayVertices[cursor++] = a[1];
      this.rayVertices[cursor++] = a[2];
      this.rayVertices[cursor++] = b[0];
      this.rayVertices[cursor++] = b[1];
      this.rayVertices[cursor++] = b[2];
    };

    // Grab ray: camera → the stick while it is held.
    const camera = this.engine.camera.position;
    put([camera.x, camera.y, camera.z], position);

    // Landing ray: straight down from the stick to whatever is below it.
    const hit = this.physics.castRay(position, [0, -1, 0], 3);
    put(position, hit ? hit.point : [position[0], position[1] - 3, position[2]]);

    (this.rayLines.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
    this.rayLines.geometry.setDrawRange(0, 4);
    this.rayLines.visible = true;
    return hit ? `${hit.distance.toFixed(3)}m ${hit.tag}` : 'miss';
  }

  attach(controller: GameController): void {
    this.controller = controller;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) {
      this.ui.setDebug(null);
      this.comMarker.visible = false;
      this.velocityArrow.visible = false;
      this.spinArrow.visible = false;
      this.trajectoryLine.visible = false;
      this.rayLines.visible = false;
      this.removeColliders();
    }
    log.debug('debug overlay', enabled ? 'on' : 'off');
  }

  private removeColliders(): void {
    if (!this.colliderLines) return;
    this.engine.scene.remove(this.colliderLines);
    this.colliderLines.geometry.dispose();
    (this.colliderLines.material as THREE.Material).dispose();
    this.colliderLines = null;
  }

  private rebuildColliders(): void {
    const buffers = this.physics.debugBuffers();
    if (!buffers) return;
    this.removeColliders();
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(buffers.vertices, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(buffers.colors, 4));
    const material = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.75,
      depthTest: false,
      toneMapped: false,
    });
    this.colliderLines = new THREE.LineSegments(geometry, material);
    this.colliderLines.name = 'debug-colliders';
    this.colliderLines.renderOrder = 999;
    this.engine.scene.add(this.colliderLines);
  }

  update(dt: number, info: DebugInfo): void {
    if (!this.enabled) return;
    this.refreshTimer += dt;

    if (this.refreshTimer > 0.25) {
      this.refreshTimer = 0;
      this.rebuildColliders();
    }

    if (this.controller) {
      const body = this.controller.entity.body;
      const com = body.worldCom();
      const position = body.position();
      const linvel = body.linvel();
      const angvel = body.angvel();
      const speed = body.speed();
      const spin = body.spinSpeed();

      this.comMarker.visible = true;
      this.comMarker.position.set(com[0], com[1], com[2]);

      this.velocityArrow.visible = speed > 0.02;
      if (this.velocityArrow.visible) {
        this.velocityArrow.position.set(position[0], position[1], position[2]);
        this.velocityArrow.setDirection(
          new THREE.Vector3(linvel[0], linvel[1], linvel[2]).normalize(),
        );
        this.velocityArrow.setLength(Math.min(0.4, 0.05 + speed * 0.06), 0.02, 0.012);
      }

      this.spinArrow.visible = spin > 0.1;
      if (this.spinArrow.visible) {
        this.spinArrow.position.set(position[0], position[1], position[2]);
        this.spinArrow.setDirection(
          new THREE.Vector3(angvel[0], angvel[1], angvel[2]).normalize(),
        );
        this.spinArrow.setLength(Math.min(0.2, 0.03 + spin * 0.012), 0.016, 0.01);
      }

      const trajectoryPoints = this.updateTrajectory();
      const rayInfo = this.updateRays();
      const setup = this.controller.currentSetup;
      this.lines = [
        'DEBUG',
        `phase      ${info.phase}`,
        `fps        ${info.fps.toFixed(0)}  frame ${info.frameMs.toFixed(1)}ms`,
        `scale      ${info.resolutionScale.toFixed(2)}  calls ${info.drawCalls}`,
        `timeScale  ${info.timeScale.toFixed(2)}`,
        `pos        ${position.map((v) => v.toFixed(3)).join(' ')}`,
        `speed      ${speed.toFixed(2)} m/s   spin ${spin.toFixed(2)} rad/s`,
        `tilt       ${body.tiltDeg().toFixed(2)}°`,
        `mass       ${(body.mass * 1000).toFixed(1)} g  com ${body.comOffsetY.toFixed(4)}`,
        `surface    ${setup.surfaceId}  zone ${setup.zoneRadius.toFixed(2)}m`,
        `obstacles  ${setup.obstacles.length}`,
        `flight     ${this.controller.flightSeconds.toFixed(2)}s`,
        `trajectory ${trajectoryPoints} pts`,
        `ray down   ${rayInfo}`,
        'keys       F1 debug · R reset · Esc pause',
      ];
      this.ui.setDebug(this.lines);
    }
  }

  dispose(): void {
    this.removeColliders();
    this.comMarker.geometry.dispose();
    (this.comMarker.material as THREE.Material).dispose();
    this.velocityArrow.dispose();
    this.spinArrow.dispose();
    this.trajectoryLine.geometry.dispose();
    (this.trajectoryLine.material as THREE.Material).dispose();
    this.rayLines.geometry.dispose();
    (this.rayLines.material as THREE.Material).dispose();
  }
}
