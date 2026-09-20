import * as THREE from 'three';
import { CAMERA } from '@/config/camera';
import { clamp, damp } from '@/utils/math';

/**
 * Hybrid camera rig.
 *
 * One rig, three behaviours:
 *  - `free`      : the player orbits the desk at will (preparation phase)
 *  - `follow`    : the stick drives target + distance, the player keeps partial
 *                  authority over the angle, so the camera never feels hijacked
 *  - `cinematic` : landing approach / confirmation accents
 *
 * Every transition is damped, never snapped, and respects reduced-motion.
 */

export type CameraMode = 'free' | 'follow' | 'cinematic';

export interface CameraFrame {
  target: [number, number, number];
  radius: number;
  azimuth: number;
  polar: number;
}

export class CameraRig {
  readonly camera: THREE.PerspectiveCamera;

  mode: CameraMode = 'free';
  sensitivity = 1;
  reducedMotion = false;

  /** Point the camera looks at (world space). */
  readonly target = new THREE.Vector3();

  private desiredTarget = new THREE.Vector3();
  private desired: { radius: number; azimuth: number; polar: number } = {
    radius: 1,
    azimuth: 0,
    polar: 1,
  };
  private current: { radius: number; azimuth: number; polar: number } = {
    radius: 1,
    azimuth: 0,
    polar: 1,
  };

  private followTarget: THREE.Vector3 | null = null;
  private followSpeed = 0;
  private baseRadius: number = CAMERA.default.distance;

  private shake = 0;
  private shakeSeed = Math.random() * 100;
  private zoomBias = 1;

  private scratchPosition = new THREE.Vector3();

  constructor(camera: THREE.PerspectiveCamera) {
    this.camera = camera;
    this.setFrame(
      {
        target: [...CAMERA.default.target],
        radius: CAMERA.default.distance,
        azimuth: CAMERA.default.azimuth,
        polar: CAMERA.default.polar,
      },
      true,
    );
  }

  /** Sets the desired framing. `instant` skips damping (used on mode change). */
  setFrame(frame: CameraFrame, instant = false): void {
    this.desiredTarget.set(frame.target[0], frame.target[1], frame.target[2]);
    this.desired.radius = clamp(frame.radius, CAMERA.orbit.minDistance, CAMERA.orbit.maxDistance);
    this.desired.azimuth = frame.azimuth;
    this.desired.polar = clamp(frame.polar, CAMERA.orbit.minPolar, CAMERA.orbit.maxPolar);
    this.baseRadius = this.desired.radius;
    if (instant) {
      this.target.copy(this.desiredTarget);
      this.current.radius = this.desired.radius;
      this.current.azimuth = this.desired.azimuth;
      this.current.polar = this.desired.polar;
      this.applyToCamera();
    }
  }

  get frame(): CameraFrame {
    return {
      target: [this.target.x, this.target.y, this.target.z],
      radius: this.current.radius,
      azimuth: this.current.azimuth,
      polar: this.current.polar,
    };
  }

  get desiredFrame(): CameraFrame {
    return {
      target: [this.desiredTarget.x, this.desiredTarget.y, this.desiredTarget.z],
      radius: this.desired.radius,
      azimuth: this.desired.azimuth,
      polar: this.desired.polar,
    };
  }

  get radius(): number {
    return this.current.radius;
  }

  /** Player orbit input (radians). */
  orbitBy(deltaX: number, deltaY: number): void {
    const scale = CAMERA.orbit.rotateSpeed * this.sensitivity;
    this.desired.azimuth -= deltaX * scale;
    this.desired.polar = clamp(
      this.desired.polar - deltaY * scale,
      CAMERA.orbit.minPolar,
      CAMERA.orbit.maxPolar,
    );
  }

  /** Player zoom input (positive = zoom out). */
  zoomBy(delta: number): void {
    const next = clamp(
      this.baseRadius * (1 + delta * CAMERA.orbit.zoomSpeed),
      CAMERA.orbit.minDistance,
      CAMERA.orbit.maxDistance,
    );
    this.baseRadius = next;
    this.desired.radius = next;
  }

  /** Multiplies the radius without changing the player's zoom preference. */
  setZoomBias(bias: number): void {
    this.zoomBias = clamp(bias, 0.5, 2);
  }

  addShake(amount: number): void {
    if (this.reducedMotion) return;
    this.shake = Math.min(0.06, this.shake + amount);
  }

  setMode(mode: CameraMode): void {
    this.mode = mode;
  }

  /** Called by gameplay while the stick is airborne. */
  setFollow(target: THREE.Vector3 | null, speed = 0): void {
    this.followTarget = target;
    this.followSpeed = speed;
  }

  /** Smoothly returns to the preparation framing. */
  returnToDesk(instant = false): void {
    this.setFollow(null, 0);
    this.setZoomBias(1);
    this.setMode('free');
    this.setFrame(
      {
        target: [...CAMERA.default.target],
        radius: this.baseRadius,
        azimuth: this.desired.azimuth,
        polar: this.desired.polar,
      },
      instant,
    );
  }

  update(dt: number): void {
    if (this.mode === 'follow' && this.followTarget) {
      const follow = CAMERA.follow;
      const lead = clamp(this.followSpeed * follow.lead, 0, follow.maxLead);
      this.desiredTarget.copy(this.followTarget);
      this.desiredTarget.y += follow.targetLift;
      // Look ahead along the horizontal travel so the stick stays centred.
      this.desiredTarget.z -= lead * 0.35;

      const extra = clamp(this.followSpeed * follow.speedDistance, 0, follow.maxExtraDistance);
      this.desired.radius = clamp(
        (this.baseRadius * follow.distanceMultiplier + extra) * this.zoomBias,
        CAMERA.orbit.minDistance,
        CAMERA.orbit.maxDistance,
      );
    } else {
      this.desired.radius = clamp(this.baseRadius * this.zoomBias, CAMERA.orbit.minDistance, CAMERA.orbit.maxDistance);
    }

    const damping = this.mode === 'follow' ? CAMERA.follow.damping : CAMERA.orbit.damping;
    this.target.x = damp(this.target.x, this.desiredTarget.x, damping, dt);
    this.target.y = damp(this.target.y, this.desiredTarget.y, damping, dt);
    this.target.z = damp(this.target.z, this.desiredTarget.z, damping, dt);

    this.current.radius = damp(this.current.radius, this.desired.radius, damping, dt);
    this.current.azimuth = damp(this.current.azimuth, this.desired.azimuth, damping * 0.9, dt);
    this.current.polar = damp(this.current.polar, this.desired.polar, damping, dt);

    this.shake = damp(this.shake, 0, CAMERA.cinematic.shakeDecay, dt);

    this.applyToCamera();
  }

  private applyToCamera(): void {
    const { radius, azimuth, polar } = this.current;
    const sinPolar = Math.sin(polar);
    this.scratchPosition.set(
      this.target.x + radius * sinPolar * Math.sin(azimuth),
      this.target.y + radius * Math.cos(polar),
      this.target.z + radius * sinPolar * Math.cos(azimuth),
    );

    if (this.shake > 0.0001) {
      const t = performance.now() * 0.001 + this.shakeSeed;
      const amount = this.shake;
      this.scratchPosition.x += Math.sin(t * 47.3) * amount;
      this.scratchPosition.y += Math.sin(t * 61.7) * amount;
      this.scratchPosition.z += Math.cos(t * 53.1) * amount;
    }

    this.camera.position.copy(this.scratchPosition);
    this.camera.lookAt(this.target);
    this.camera.updateMatrixWorld();
  }

  /** Frames a world point without changing the current angle. */
  lookAtPoint(point: THREE.Vector3): void {
    this.desiredTarget.copy(point);
  }

  /** Used by the menu backdrop: slow orbital drift around the desk. */
  applyMenuDrift(elapsed: number): void {
    const menu = CAMERA.menu;
    this.desiredTarget.set(menu.target[0], menu.target[1], menu.target[2]);
    this.desired.radius = menu.distance;
    this.desired.polar = menu.polar;
    this.desired.azimuth = Math.sin(elapsed * menu.driftSpeed) * menu.azimuthDrift;
    this.baseRadius = menu.distance;
  }
}
