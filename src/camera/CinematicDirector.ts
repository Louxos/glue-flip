import { CAMERA } from '@/config/camera';
import { FEEDBACK } from '@/config/gameplay';
import type { CameraRig } from '@/camera/CameraRig';
import { clamp, damp } from '@/utils/math';

/**
 * Cinematic direction for the moment of truth.
 *
 * The director never fakes the outcome: it only changes *how the camera and time
 * behave* while the real simulation keeps running. A failed landing keeps full
 * physics; the camera simply settles back.
 */

type DirectorState = 'idle' | 'approach' | 'confirm' | 'release';

export interface FlightInfo {
  inFlight: boolean;
  descending: boolean;
  /** Height of the stick's base above the landing surface (m). */
  heightAboveSurface: number;
  /** Linear speed (m/s). */
  speed: number;
}

export interface LandingInfo {
  success: boolean;
  perfect: boolean;
}

export class CinematicDirector {
  /** Time scale the game should run at (applied to the engine). */
  timeScale = 1;

  state: DirectorState = 'idle';

  private rig: CameraRig;
  private reducedMotion: boolean;
  private elapsed = 0;
  private targetTimeScale = 1;
  private approachArmed = false;

  constructor(rig: CameraRig, reducedMotion = false) {
    this.rig = rig;
    this.reducedMotion = reducedMotion;
  }

  setReducedMotion(value: boolean): void {
    this.reducedMotion = value;
  }

  /** Called when a throw starts. */
  arm(): void {
    this.state = 'idle';
    this.approachArmed = true;
    this.targetTimeScale = 1;
    this.elapsed = 0;
  }

  reset(): void {
    this.state = 'idle';
    this.approachArmed = false;
    this.targetTimeScale = 1;
    this.timeScale = damp(this.timeScale, 1, 8, 1 / 60);
    this.rig.setZoomBias(1);
  }

  update(dt: number, info: FlightInfo): void {
    this.elapsed += dt;

    if (this.state === 'confirm') {
      if (this.elapsed > FEEDBACK.confirmationDuration) {
        this.state = 'release';
        this.elapsed = 0;
        this.targetTimeScale = 1;
        this.rig.setZoomBias(1);
      }
      this.timeScale = damp(this.timeScale, this.targetTimeScale, 9, dt);
      return;
    }

    if (this.state === 'release') {
      this.timeScale = damp(this.timeScale, 1, 6, dt);
      if (this.timeScale > 0.985) {
        this.timeScale = 1;
        this.state = 'idle';
      }
      return;
    }

    // Approach: only when the stick is genuinely coming down near the surface.
    const shouldSlow =
      this.approachArmed &&
      info.inFlight &&
      info.descending &&
      info.heightAboveSurface < FEEDBACK.cinematicTriggerHeight;

    if (shouldSlow && this.state !== 'approach') {
      this.state = 'approach';
      this.rig.setZoomBias(CAMERA.cinematic.approachZoom);
    }

    if (this.state === 'approach') {
      this.targetTimeScale = this.reducedMotion
        ? 0.85
        : FEEDBACK.cinematicTimeScale;
      this.timeScale = damp(this.timeScale, this.targetTimeScale, 11, dt);
    } else {
      this.timeScale = damp(this.timeScale, 1, 8, dt);
    }
  }

  /** Called once the landing has been evaluated. */
  onLanded(info: LandingInfo): void {
    this.approachArmed = false;
    if (info.success) {
      this.state = 'confirm';
      this.elapsed = 0;
      this.targetTimeScale = this.reducedMotion ? 0.9 : FEEDBACK.confirmationTimeScale;
      this.rig.setZoomBias(CAMERA.cinematic.successZoom);
      this.rig.addShake(info.perfect ? FEEDBACK.perfectShake : FEEDBACK.landingShake);
    } else {
      this.state = 'release';
      this.elapsed = 0;
      this.targetTimeScale = 1;
      this.rig.setZoomBias(1);
    }
  }

  /** Safety clamp so a stuck director can never freeze the game. */
  clampTimeScale(value: number): number {
    return clamp(value, 0.2, 1);
  }
}
