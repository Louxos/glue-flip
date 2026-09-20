import * as THREE from 'three';
import type { ObstacleSpec } from '@/config/challenges';
import { FEEDBACK, LANDING } from '@/config/gameplay';
import { GLUE_PHYSICS, HOLD } from '@/config/physics';
import type { PointerSample } from '@/config/throw';
import { WORLD, clampZoneCenter, deskTopY, spawnPosition } from '@/config/world';
import { getGlueStick } from '@/config/glueSticks';
import { getSurface } from '@/config/surfaces';
import type { SurfacePreset } from '@/config/surfaces';
import type { PointerState } from '@/input/InputManager';
import { GlueStickEntity } from '@/objects/GlueStickEntity';
import { SurfacePad } from '@/objects/SurfacePad';
import { TargetZone } from '@/objects/TargetZone';
import { ObstacleSet } from '@/objects/Obstacles';
import { ThrowGuide } from '@/render/ThrowGuide';
import { ContactShadow } from '@/render/ContactShadow';
import { PhysicsWorld } from '@/physics/PhysicsWorld';
import type { ColliderTag } from '@/physics/PhysicsWorld';
import { predictTrajectory, sampleGuide } from '@/physics/TrajectorySimulator';
import type { TrajectoryResult } from '@/physics/TrajectorySimulator';
import { evaluateLanding, isSettled } from '@/gameplay/LandingEvaluator';
import type { LandingResult } from '@/gameplay/LandingEvaluator';
import { resolveThrow, pruneSamples } from '@/gameplay/ThrowGesture';
import type { ThrowResolution } from '@/gameplay/ThrowGesture';
import type { GameEvents, ThrowPhase } from '@/gameplay/GameEvents';
import { clamp, damp, planarDistance } from '@/utils/math';
import { Random } from '@/utils/random';
import { vibrate } from '@/utils/platform';
import { createLogger } from '@/utils/logger';
import type { GameContext } from '@/gameplay/GameContext';

const log = createLogger('controller');

export interface ThrowSetup {
  surfaceId: string;
  /** Landing zone centre, or null when the whole desk counts. */
  zoneCenter: [number, number] | null;
  zoneRadius: number;
  obstacles: ObstacleSpec[];
  glueStickId?: string;
  showGuide?: boolean;
}

/** Maps a physics collider tag to the impact sound palette. */
function audioForTag(tag: ColliderTag | undefined, pad: SurfacePreset): SurfacePreset['audio'] {
  switch (tag) {
    case 'surface':
      return pad.audio;
    case 'desk':
      return 'wood';
    case 'floor':
      return 'wood';
    case 'wall':
      return 'stone';
    case 'obstacle':
    case 'prop':
      return 'wood';
    default:
      return 'wood';
  }
}

/**
 * The throw lifecycle.
 *
 *   idle → held → flight → settling → resolved → idle
 *
 * This class owns the glue stick entity, the landing surface, the zone and the
 * obstacles, and it is the only place that decides whether a landing counts.
 */
export class GameController {
  phase: ThrowPhase = 'idle';
  /** When false, the mode is responsible for the next `prepare()`. */
  autoReset = true;

  readonly group = new THREE.Group();
  entity: GlueStickEntity;
  pad: SurfacePad;
  zone: TargetZone;
  obstacles: ObstacleSet | null = null;

  private ctx: GameContext;
  private guide: ThrowGuide;
  private contactShadow: ContactShadow;

  private setup: ThrowSetup = {
    surfaceId: 'wood',
    zoneCenter: null,
    zoneRadius: 0,
    obstacles: [],
  };

  // Hold state.
  private heldPosition = new THREE.Vector3();
  private previousHeld = new THREE.Vector3();
  private samples: PointerSample[] = [];
  private grabDistance = 0.6;
  private preview: ThrowResolution | null = null;

  // Flight state.
  private flightTime = 0;
  private lastTrajectory: TrajectoryResult | null = null;
  private settleTimer = 0;
  private resolveTimer = 0;
  /** True when the last resolved throw failed: the auto-reset waits longer. */
  private lastThrowFailed = false;
  private lastSpeed = 0;
  private lastSpin = 0;
  private impactCount = 0;
  private clock = 0;
  private throwRng = new Random(0x1234);
  private lastPointer: PointerState | null = null;

  private raycaster = new THREE.Raycaster();
  private ndc = new THREE.Vector2();
  private scratchVector = new THREE.Vector3();
  private scratchQuaternion = new THREE.Quaternion();
  private tiltAxis = new THREE.Vector3();
  private disposers: (() => void)[] = [];

  constructor(ctx: GameContext, setup: ThrowSetup) {
    this.ctx = ctx;
    this.group.name = 'gameplay';

    const surface = getSurface(setup.surfaceId);
    this.pad = new SurfacePad(ctx.physics, ctx.materials, surface, {
      size: [0.62, 0.62],
      center: setup.zoneCenter ?? [0, 0],
    });
    this.zone = new TargetZone(setup.zoneRadius || 0.2, this.pad.surfaceY);
    this.guide = new ThrowGuide(18);
    this.contactShadow = new ContactShadow();

    const variant = getGlueStick(setup.glueStickId ?? ctx.save.all.selectedGlueStick);
    this.entity = new GlueStickEntity(
      ctx.physics,
      ctx.materials,
      variant,
      spawnPosition(variant.height / 2),
    );

    this.group.add(this.pad.mesh);
    this.group.add(this.zone.mesh);
    this.group.add(this.guide.points);
    this.group.add(this.contactShadow.mesh);
    this.group.add(this.entity.group);

    this.disposers.push(
      ctx.physics.onContactForce((event) => this.handleContact(event)),
    );

    this.configure(setup);
  }

  // --- Setup -------------------------------------------------------------

  configure(setup: ThrowSetup): void {
    this.setup = setup;

    const surface = getSurface(setup.surfaceId);
    this.pad.setPreset(surface);

    if (this.obstacles) {
      this.group.remove(this.obstacles.group);
      this.obstacles.dispose();
      this.obstacles = null;
    }
    if (setup.obstacles.length > 0 && setup.zoneCenter) {
      this.obstacles = new ObstacleSet(
        this.ctx.physics,
        this.ctx.materials,
        setup.obstacles,
        setup.zoneCenter,
        this.pad.surfaceY,
      );
      this.group.add(this.obstacles.group);
    }

    if (setup.zoneCenter) {
      const [zx, zz] = clampZoneCenter(setup.zoneCenter[0], setup.zoneCenter[1], setup.zoneRadius);
      this.zone.place([zx, zz], setup.zoneRadius, this.pad.surfaceY);
      this.zone.setVisible(true);
    } else {
      this.zone.setVisible(false);
    }

    this.guide.setVisible(setup.showGuide ?? true);

    if (setup.glueStickId && setup.glueStickId !== this.entity.variant.id) {
      const variant = getGlueStick(setup.glueStickId);
      this.entity.setVariant(variant, spawnPosition(variant.height / 2));
    }

    this.prepare();
  }

  /** Places the stick back at the spawn point, ready to be grabbed. */
  prepare(): void {
    const halfHeight = this.entity.variant.height / 2;
    const [x, , z] = spawnPosition(halfHeight);
    this.entity.body.reset([x, this.pad.surfaceY + halfHeight + WORLD.spawn.lift, z]);
    this.entity.snap();
    this.samples = [];
    this.preview = null;
    this.flightTime = 0;
    this.settleTimer = 0;
    this.resolveTimer = 0;
    this.lastThrowFailed = false;
    this.impactCount = 0;
    this.lastSpeed = 0;
    this.lastSpin = 0;
    this.setPhase('idle');
    this.guide.setVisible(this.setup.showGuide ?? true);
    this.guide.updateOpacity(1);
    this.ctx.director.reset();
    this.ctx.audio.stopAir();
  }

  private setPhase(phase: ThrowPhase): void {
    if (this.phase === phase) return;
    this.phase = phase;
    this.ctx.events.emit('phase:change', { phase });
  }

  // --- Interaction -------------------------------------------------------

  /** Attempts to grab the stick. Returns true when the grab succeeded. */
  tryGrab(pointer: PointerState): boolean {
    if (this.phase !== 'idle') return false;

    const [ndcX, ndcY] = this.ctx.input.toNdc(pointer.x, pointer.y);
    this.raycaster.setFromCamera(this.ndc.set(ndcX, ndcY), this.ctx.engine.camera);
    const origin = this.ctx.engine.camera.position;
    const direction = this.raycaster.ray.direction;

    const hit = this.ctx.physics.castRay(
      [origin.x, origin.y, origin.z],
      [direction.x, direction.y, direction.z],
      4,
      (tag) => tag === 'glue',
    );

    if (!hit && !this.isPointerNearStick(pointer)) return false;

    this.beginHold(pointer);
    return true;
  }

  /** Touch-friendly fallback: is the pointer close to the stick on screen? */
  private isPointerNearStick(pointer: PointerState): boolean {
    const camera = this.ctx.engine.camera;
    const rect = this.ctx.input.rect;
    const centre = this.scratchVector.copy(this.entity.position).project(camera);
    const centreX = ((centre.x + 1) / 2) * rect.width;
    const centreY = ((1 - centre.y) / 2) * rect.height;

    const base = this.entity.body.basePoint();
    const cap = this.entity.body.capPoint();
    const baseNdc = new THREE.Vector3(base[0], base[1], base[2]).project(camera);
    const capNdc = new THREE.Vector3(cap[0], cap[1], cap[2]).project(camera);
    const screenLength =
      Math.hypot(
        ((baseNdc.x - capNdc.x) / 2) * rect.width,
        ((capNdc.y - baseNdc.y) / 2) * rect.height,
      ) || 40;

    const threshold = Math.max(46, screenLength * 1.5);
    const dx = pointer.x - rect.left - centreX;
    const dy = pointer.y - rect.top - centreY;
    return Math.hypot(dx, dy) < threshold;
  }

  private beginHold(pointer: PointerState): void {
    void this.ctx.audio.resume();
    this.lastPointer = pointer;
    this.setPhase('held');

    const camera = this.ctx.engine.camera;
    this.grabDistance = clamp(
      camera.position.distanceTo(this.entity.position),
      0.22,
      1.8,
    );
    this.heldPosition.copy(this.entity.position);
    this.previousHeld.copy(this.entity.position);
    this.samples = [];
    this.impactCount = 0;

    const body = this.entity.body;
    body.setKinematic();
    body.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    body.body.setAngvel({ x: 0, y: 0, z: 0 }, true);

    this.ctx.audio.grab();
    if (this.ctx.save.settings.haptics) vibrate(8);
    this.ctx.events.emit('throw:grabbed', { power: 0 });
    log.debug('grabbed', { distance: this.grabDistance.toFixed(2) });
  }

  /** Called by the app on every pointer move while holding. */
  updatePointer(pointer: PointerState): void {
    this.lastPointer = pointer;
  }

  /** Releases the stick and turns the gesture into a physical throw. */
  release(): void {
    if (this.phase !== 'held') return;
    const settings = this.ctx.save.settings;
    const resolution = this.buildThrow();

    if (resolution.valid) {
      this.entity.body.applyThrow(resolution.velocity, resolution.angularVelocity);
      this.ctx.audio.release(resolution.power);
      this.ctx.director.arm();
      this.ctx.rig.setMode('follow');
      this.ctx.audio.startAir();
      if (settings.haptics) vibrate(6);
      this.ctx.events.emit('throw:released', {
        power: resolution.power,
        rotations: resolution.estimatedRotations,
        speed: resolution.speed,
      });
      this.ctx.save.recordThrow();
      log.debug('released', {
        power: resolution.power.toFixed(2),
        speed: resolution.speed.toFixed(2),
        rotations: resolution.estimatedRotations.toFixed(2),
      });
    } else {
      // Too gentle to count as a throw: it simply slips out of the hand.
      this.entity.body.setDynamic();
      this.entity.body.body.setLinvel({ x: 0, y: -0.05, z: 0 }, true);
      this.entity.body.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
      this.ctx.events.emit('toast', { text: 'Too soft — flick harder', tone: 'info' });
    }

    this.flightTime = 0;
    this.settleTimer = 0;
    this.setPhase('flight');
    this.guide.setVisible(false);
  }

  /** Resolves the gesture from the recorded samples. */
  buildThrow(): ThrowResolution {
    if (this.preview) return this.preview;
    return this.computeThrow();
  }

  private computeThrow(): ThrowResolution {
    const camera = this.ctx.engine.camera;
    const settings = this.ctx.save.settings;
    const halfHeight = this.entity.variant.height / 2;
    const heightAboveSurface = Math.max(
      0,
      this.entity.position.y - halfHeight - this.pad.surfaceY,
    );

    camera.getWorldDirection(this.scratchVector);
    return resolveThrow(this.samples, {
      up: [0, 1, 0],
      forward: [this.scratchVector.x, this.scratchVector.y, this.scratchVector.z],
      gravity: -this.ctx.physics.world.gravity.y,
      heightAboveSurface,
      sensitivity: settings.throwSensitivity,
      stickHeight: this.entity.variant.height,
      random: () => this.throwRng.jitter(1),
    });
  }

  // --- Frame update ------------------------------------------------------

  update(dt: number, rawDt: number, elapsed: number): void {
    this.clock = elapsed;

    if (this.phase === 'held') this.driveHeld(dt);

    this.entity.beginStep();
    this.ctx.physics.step(dt);
    this.entity.body.dampContactSpin(dt, this.clock);
    this.entity.endStep();

    switch (this.phase) {
      case 'flight':
        this.updateFlight(dt, rawDt);
        break;
      case 'settling':
        this.settleTimer += rawDt;
        if (this.settleTimer > LANDING.settleHoldTime) this.resolveLanding(false);
        break;
      case 'resolved':
        this.resolveTimer += rawDt;
        // Misses hold a beat longer so the red flash and the verdict can be read.
        if (this.autoReset && this.resolveTimer > FEEDBACK.resetDelay(this.lastThrowFailed)) {
          this.prepare();
        }
        break;
      case 'idle':
      case 'held':
      default:
        break;
    }

    this.entity.sync(this.ctx.physics.interpolationAlpha);
    this.updateContactShadow();
    this.zone.update(rawDt, elapsed);
    this.guide.updateOpacity(rawDt);

    this.lastSpeed = this.entity.body.speed();
    this.lastSpin = this.entity.body.spinSpeed();
  }

  /** Moves the held stick towards the pointer and records motion samples. */
  private driveHeld(dt: number): void {
    const pointer = this.lastPointer ?? this.ctx.input.primary;
    if (!pointer || (!pointer.down && this.samples.length > 0)) {
      this.release();
      return;
    }

    const camera = this.ctx.engine.camera;
    const [ndcX, ndcY] = this.ctx.input.toNdc(pointer.x, pointer.y);
    this.raycaster.setFromCamera(this.ndc.set(ndcX, ndcY), camera);

    const target = this.scratchVector
      .copy(this.raycaster.ray.direction)
      .multiplyScalar(this.grabDistance)
      .add(camera.position);

    const halfHeight = this.entity.variant.height / 2;
    const minY = this.pad.surfaceY + halfHeight + 0.004;
    target.x = clamp(target.x, -WORLD.desk.width / 2 + 0.05, WORLD.desk.width / 2 - 0.05);
    target.z = clamp(target.z, -WORLD.desk.depth / 2 + 0.05, WORLD.desk.depth / 2 - 0.05);
    target.y = clamp(target.y, minY, deskTopY() + 1.1);

    this.previousHeld.copy(this.heldPosition);
    this.heldPosition.x = damp(this.heldPosition.x, target.x, HOLD.positionStiffness, dt);
    this.heldPosition.y = damp(this.heldPosition.y, target.y, HOLD.positionStiffness, dt);
    this.heldPosition.z = damp(this.heldPosition.z, target.z, HOLD.positionStiffness, dt);

    // Orientation: upright with a slight lean into the movement.
    const dx = this.heldPosition.x - this.previousHeld.x;
    const dz = this.heldPosition.z - this.previousHeld.z;
    const planarSpeed = Math.hypot(dx, dz) / Math.max(dt, 1e-4);
    const tilt = clamp(planarSpeed * 9, 0, HOLD.heldTiltDeg) * (Math.PI / 180);
    this.tiltAxis.set(dz, 0, -dx);
    if (this.tiltAxis.lengthSq() < 1e-10) this.tiltAxis.set(1, 0, 0);
    this.tiltAxis.normalize();
    this.scratchQuaternion.setFromAxisAngle(this.tiltAxis, tilt);

    const body = this.entity.body;
    body.driveKinematic(
      [this.heldPosition.x, this.heldPosition.y, this.heldPosition.z],
      [
        this.scratchQuaternion.x,
        this.scratchQuaternion.y,
        this.scratchQuaternion.z,
        this.scratchQuaternion.w,
      ],
    );

    this.samples.push({
      x: this.heldPosition.x,
      y: this.heldPosition.y,
      z: this.heldPosition.z,
      sx: pointer.x,
      sy: pointer.y,
      t: this.clock,
    });
    this.samples = pruneSamples(this.samples, this.clock);

    this.preview = this.computeThrow();
    this.ctx.events.emit('throw:hold', {
      power: this.preview.power,
      rotations: this.preview.estimatedRotations,
      speed: this.preview.speed,
    });
    this.updateGuide(this.preview);
  }

  private updateGuide(resolution: ThrowResolution): void {
    if (!resolution.valid) {
      this.lastTrajectory = null;
      this.guide.update([], 0);
      return;
    }
    const halfHeight = this.entity.variant.height / 2;
    const trajectory = predictTrajectory({
      position: [
        this.heldPosition.x,
        this.heldPosition.y - halfHeight,
        this.heldPosition.z,
      ],
      velocity: resolution.velocity,
      gravity: this.ctx.physics.world.gravity.y,
      drag: GLUE_PHYSICS.linearDamping,
      dt: 1 / 120,
      maxTime: Math.min(2.4, resolution.estimatedFlightTime * 1.1),
      stopBelowY: this.pad.surfaceY,
    });
    this.lastTrajectory = trajectory;
    this.guide.update(sampleGuide(trajectory, 16, 7), resolution.power);
  }

  private updateFlight(dt: number, rawDt: number): void {
    this.flightTime += rawDt;
    const body = this.entity.body;
    const position = body.position();
    const speed = body.speed();
    const spin = body.spinSpeed();

    this.ctx.rig.setFollow(
      new THREE.Vector3(position[0], position[1], position[2]),
      speed,
    );
    this.ctx.audio.updateAir(speed, spin);

    const heightAbove = body.basePoint()[1] - this.pad.surfaceY;
    const descending = body.linvel()[1] < 0;
    this.ctx.director.update(rawDt, {
      inFlight: true,
      descending,
      heightAboveSurface: heightAbove,
      speed,
    });
    this.ctx.engine.timeScale = this.ctx.director.timeScale;

    const outOfBounds =
      position[1] < GLUE_PHYSICS.outOfBoundsY ||
      Math.hypot(position[0], position[2]) > GLUE_PHYSICS.outOfBoundsRadius;

    if (outOfBounds) {
      this.resolveLanding(true);
      return;
    }

    if (this.flightTime > LANDING.throwTimeout) {
      this.resolveLanding(false);
      return;
    }

    if (this.flightTime > LANDING.minFlightTime && isSettled(speed, spin)) {
      this.settleTimer += rawDt;
      if (this.settleTimer > LANDING.settleHoldTime) this.resolveLanding(false);
    } else {
      this.settleTimer = 0;
    }

    void dt;
  }

  /** Locks in the result of the throw from the measured body state. */
  private resolveLanding(outOfBounds: boolean): void {
    if (this.phase === 'resolved' || this.phase === 'settling') return;
    this.setPhase('settling');

    const body = this.entity.body;
    const basePoint = body.basePoint();
    const capPoint = body.capPoint();
    const insideZone = this.setup.zoneCenter
      ? planarDistance([basePoint[0], 0, basePoint[2]], [this.setup.zoneCenter[0], 0, this.setup.zoneCenter[1]]) <=
        this.setup.zoneRadius
      : true;

    const result: LandingResult = evaluateLanding({
      tiltDeg: body.tiltDeg(),
      baseY: basePoint[1],
      capY: capPoint[1],
      surfaceY: this.pad.surfaceY,
      stickHeight: this.entity.variant.height,
      insideZone,
      zoneRequired: Boolean(this.setup.zoneCenter),
      flightTime: this.flightTime,
      outOfBounds,
    });

    this.ctx.audio.stopAir();

    if (result.status === 'perfect' || result.status === 'landing') {
      this.ctx.audio.landingSuccess(result.status === 'perfect');
      this.zone.highlight(result.status === 'perfect' ? 0.35 : 0.15);
      if (this.ctx.save.settings.haptics) {
        vibrate(result.status === 'perfect' ? [...FEEDBACK.vibratePerfect] : [...FEEDBACK.vibrateLanding]);
      }
    } else {
      this.ctx.audio.landingFail();
      if (this.ctx.save.settings.haptics) vibrate([...FEEDBACK.vibrateFail]);
    }

    this.ctx.director.onLanded({
      success: result.status === 'perfect' || result.status === 'landing',
      perfect: result.status === 'perfect',
    });
    this.ctx.engine.timeScale = this.ctx.director.timeScale;

    this.ctx.events.emit('landing:evaluated', {
      result,
      flightTime: this.flightTime,
      impactSpeed: this.lastSpeed,
    });

    this.resolveTimer = 0;
    this.lastThrowFailed = result.status === 'failed' || result.status === 'lost';
    this.setPhase('resolved');
    log.debug('landing resolved', {
      status: result.status,
      tilt: result.tiltDeg.toFixed(2),
      reason: result.reason,
    });
  }

  // --- Contacts ----------------------------------------------------------

  private handleContact(event: {
    tagA?: ColliderTag;
    tagB?: ColliderTag;
    magnitude: number;
  }): void {
    const involvesGlue = event.tagA === 'glue' || event.tagB === 'glue';
    if (!involvesGlue) return;
    this.entity.body.noteContact(this.clock);
    const other = event.tagA === 'glue' ? event.tagB : event.tagA;
    const surface = audioForTag(other, this.pad.preset);
    const speed = this.lastSpeed;
    const pan = this.screenPan();

    const vertical = Math.abs(this.entity.body.linvel()[1]);
    if (speed < 0.18) return;

    if (vertical < 0.35 && speed > 0.45) {
      this.ctx.audio.slide(speed, surface);
      this.ctx.events.emit('slide', { surface, speed });
      return;
    }

    this.impactCount += 1;
    if (this.impactCount === 1) {
      this.ctx.audio.impact({ surface, speed, pan, flatness: clamp(1 - this.entity.body.tiltDeg() / 90, 0, 1) });
      this.ctx.events.emit('impact', { surface, speed, pan, flatness: 0.5 });
      if (speed > 2.6 && this.ctx.save.settings.screenShake) {
        this.ctx.rig.addShake(clamp(speed * 0.0022, 0, 0.012));
      }
    } else {
      this.ctx.audio.bounce(speed, surface);
      this.ctx.events.emit('bounce', { surface, speed });
    }
  }

  private screenPan(): number {
    const camera = this.ctx.engine.camera;
    const projected = this.scratchVector.copy(this.entity.position).project(camera);
    return clamp((projected.x + 1) / 2, 0, 1);
  }

  private updateContactShadow(): void {
    if (!this.ctx.engine.currentPreset.contactShadow) {
      this.contactShadow.setVisible(false);
      return;
    }
    const position = this.entity.position;
    const baseY = this.entity.body.basePoint()[1];
    const height = Math.max(0, baseY - this.pad.surfaceY);
    const tilt = this.entity.body.tiltDeg();
    this.contactShadow.update(position.x, position.z, this.pad.surfaceY, height, 1 + tilt / 60);
  }

  /** Current zone settings, used by the HUD and the debug overlay. */
  get currentSetup(): ThrowSetup {
    return this.setup;
  }

  get surfaceY(): number {
    return this.pad.surfaceY;
  }

  get throwPreview(): ThrowResolution | null {
    return this.preview;
  }

  /** Predicted path of the throw currently being aimed at (debug overlay). */
  get debugTrajectory(): TrajectoryResult | null {
    return this.phase === 'held' ? this.lastTrajectory : null;
  }

  get flightSeconds(): number {
    return this.flightTime;
  }

  dispose(): void {
    for (const dispose of this.disposers) dispose();
    this.disposers = [];
    this.obstacles?.dispose();
    this.zone.dispose();
    this.pad.dispose();
    this.guide.dispose();
    this.contactShadow.dispose();
    this.entity.dispose();
    this.group.clear();
  }
}
