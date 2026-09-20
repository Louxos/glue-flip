import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { QualityLevel, QualityPreset } from '@/config/quality';
import { detectQuality, getPreset } from '@/config/quality';
import { CAMERA } from '@/config/camera';
import { createLogger } from '@/utils/logger';
import { isSmallScreen } from '@/utils/platform';
import { PostFX } from '@/render/PostFX';

const log = createLogger('engine');

export interface FrameInfo {
  /** Scaled delta time in seconds (already multiplied by `timeScale`). */
  dt: number;
  /** Unscaled delta time in seconds. */
  rawDt: number;
  /** Total elapsed seconds since boot. */
  elapsed: number;
  /** Frames per second (smoothed). */
  fps: number;
  /** Current resolution scale (1 = native). */
  resolutionScale: number;
}

export type FrameCallback = (frame: FrameInfo) => void;

export interface EngineOptions {
  canvas: HTMLCanvasElement;
  quality?: QualityLevel;
  /** Optional callback invoked when the WebGL context is lost/restored. */
  onContextLost?: () => void;
  onContextRestored?: () => void;
}

/**
 * Owns the renderer, the scene graph root, the main camera and the frame loop.
 * Gameplay systems only ever talk to the Engine through this interface, which
 * keeps rendering concerns out of the simulation.
 */
export class Engine {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  readonly canvas: HTMLCanvasElement;

  postFX: PostFX;

  /** Multiplies delta time — used for cinematic slow motion. */
  timeScale = 1;

  private preset: QualityPreset;
  private requestedQuality: QualityLevel;
  private rafId = 0;
  private running = false;
  private lastTime = 0;
  private elapsed = 0;
  private fps = 60;
  private frameMs = 16;
  private resolutionScale = 1;
  private frameCallback: FrameCallback | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private envRenderTarget: THREE.WebGLRenderTarget | null = null;
  private onContextLost?: () => void;
  private onContextRestored?: () => void;
  private frameBudgetAccumulator = 0;
  private frameBudgetSamples = 0;

  constructor(options: EngineOptions) {
    this.canvas = options.canvas;
    this.onContextLost = options.onContextLost;
    this.onContextRestored = options.onContextRestored;
    this.requestedQuality = options.quality ?? detectQuality();
    this.preset = getPreset(this.requestedQuality);

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: this.preset.antialias === 'msaa',
      alpha: false,
      stencil: false,
      depth: true,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: false,
    });
    this.renderer.setClearColor(0x0b0d10, 1);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.06;
    this.renderer.shadowMap.enabled = this.preset.shadows;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.info.autoReset = true;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0e1116);
    this.scene.fog = new THREE.Fog(0x14181f, 5.5, 16);

    const fov = isSmallScreen() ? CAMERA.fovMobile : CAMERA.fov;
    this.camera = new THREE.PerspectiveCamera(fov, 1, CAMERA.near, CAMERA.far);
    this.camera.position.set(0, 1.3, 1.6);

    this.buildEnvironment(this.preset.envSize);

    this.postFX = new PostFX({
      renderer: this.renderer,
      scene: this.scene,
      camera: this.camera,
      preset: this.preset,
    });

    this.canvas.addEventListener('webglcontextlost', this.handleContextLost, false);
    this.canvas.addEventListener('webglcontextrestored', this.handleContextRestored, false);

    this.setupResize();
    this.applyPreset(this.preset);
    this.resize();

    log.info('engine ready', {
      quality: this.preset.id,
      maxDpr: this.preset.maxDpr,
      renderer: this.renderer.capabilities.isWebGL2 ? 'webgl2' : 'webgl1',
    });
  }

  get quality(): QualityLevel {
    return this.preset.id;
  }

  get currentPreset(): QualityPreset {
    return this.preset;
  }

  get stats(): { fps: number; frameMs: number; resolutionScale: number; drawCalls: number } {
    return {
      fps: this.fps,
      frameMs: this.frameMs,
      resolutionScale: this.resolutionScale,
      drawCalls: this.renderer.info.render.calls,
    };
  }

  /** Builds an image-based lighting environment for believable plastic/metal. */
  private buildEnvironment(size: number): void {
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    pmrem.compileEquirectangularShader();
    const roomScene = new RoomEnvironment();
    try {
      this.envRenderTarget?.dispose();
      this.envRenderTarget = pmrem.fromScene(roomScene, 0.04, 0.1, 100);
      this.scene.environment = this.envRenderTarget.texture;
      this.scene.environmentIntensity = 0.42;
    } catch (error) {
      log.warn('environment map generation failed, falling back to lights only', error);
    } finally {
      roomScene.traverse((child) => {
        const mesh = child as THREE.Mesh;
        if (mesh.isMesh) {
          mesh.geometry?.dispose();
          const material = mesh.material as THREE.Material | THREE.Material[];
          if (Array.isArray(material)) material.forEach((m) => m.dispose());
          else material?.dispose();
        }
      });
      pmrem.dispose();
    }
  }

  setQuality(level: QualityLevel | 'auto'): void {
    const resolved = level === 'auto' ? detectQuality() : level;
    this.requestedQuality = resolved;
    const preset = getPreset(resolved);
    this.applyPreset(preset);
    log.info('quality changed', resolved);
  }

  private applyPreset(preset: QualityPreset): void {
    this.preset = preset;
    this.renderer.shadowMap.enabled = preset.shadows;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    // Toggling antialias requires a context attribute; MSAA is chosen at boot,
    // so a quality change falls back to FXAA when MSAA was not requested.
    this.postFX.configure(preset);
    this.resolutionScale = 1;
    this.scene.traverse((child) => {
      const light = child as THREE.DirectionalLight;
      if (light.isDirectionalLight && light.shadow) {
        light.shadow.mapSize.set(preset.shadowMapSize, preset.shadowMapSize);
        light.shadow.map?.dispose();
        light.shadow.map = null as unknown as THREE.WebGLRenderTarget;
      }
    });
    this.resize();
    // Let listeners (scene builder) adapt expensive details.
    this.canvas.dispatchEvent(new CustomEvent('qualitychange', { detail: preset }));
  }

  onQualityChange(handler: (preset: QualityPreset) => void): () => void {
    const listener = (event: Event) => handler((event as CustomEvent<QualityPreset>).detail);
    this.canvas.addEventListener('qualitychange', listener as EventListener);
    return () => this.canvas.removeEventListener('qualitychange', listener as EventListener);
  }

  private setupResize(): void {
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this.resize());
      const parent = this.canvas.parentElement ?? this.canvas;
      this.resizeObserver.observe(parent);
    }
    window.addEventListener('resize', this.resize);
    window.addEventListener('orientationchange', this.resize);
  }

  resize = (): void => {
    const parent = this.canvas.parentElement;
    const width = Math.max(1, parent?.clientWidth ?? window.innerWidth);
    const height = Math.max(1, parent?.clientHeight ?? window.innerHeight);
    const dpr = Math.min(window.devicePixelRatio || 1, this.preset.maxDpr) * this.resolutionScale;

    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(width, height, false);
    this.postFX.setSize(width, height, dpr);

    const fov = isSmallScreen() ? CAMERA.fovMobile : CAMERA.fov;
    if (this.camera.fov !== fov) this.camera.fov = fov;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  };

  start(callback: FrameCallback): void {
    if (this.running) return;
    this.frameCallback = callback;
    this.running = true;
    this.lastTime = performance.now();
    const tick = (now: number) => {
      if (!this.running) return;
      this.rafId = requestAnimationFrame(tick);
      const rawDt = Math.min(0.05, Math.max(0.0005, (now - this.lastTime) / 1000));
      this.lastTime = now;
      this.measure(rawDt);
      this.elapsed += rawDt;
      try {
        this.frameCallback?.({
          dt: rawDt * this.timeScale,
          rawDt,
          elapsed: this.elapsed,
          fps: this.fps,
          resolutionScale: this.resolutionScale,
        });
      } catch (error) {
        log.error('frame callback threw', error);
      }
      this.render(rawDt * this.timeScale);
    };
    this.rafId = requestAnimationFrame(tick);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.rafId);
  }

  /** Draws one frame (composer when post FX are on, plain render otherwise). */
  render(deltaTime: number): void {
    const composed = this.postFX.render(deltaTime);
    if (!composed) this.renderer.render(this.scene, this.camera);
  }

  private measure(rawDt: number): void {
    const instantFps = 1 / rawDt;
    this.fps += (instantFps - this.fps) * 0.08;
    this.frameMs = rawDt * 1000;

    if (!this.preset.dynamicResolution) return;
    this.frameBudgetAccumulator += this.frameMs;
    this.frameBudgetSamples += 1;
    if (this.frameBudgetSamples < 45) return;

    const average = this.frameBudgetAccumulator / this.frameBudgetSamples;
    this.frameBudgetAccumulator = 0;
    this.frameBudgetSamples = 0;

    const budget = this.preset.frameBudgetMs;
    const minScale = this.preset.minResolutionScale;
    let next = this.resolutionScale;
    if (average > budget * 1.25 && this.resolutionScale > minScale) {
      next = Math.max(minScale, this.resolutionScale - 0.1);
    } else if (average < budget * 0.72 && this.resolutionScale < 1) {
      next = Math.min(1, this.resolutionScale + 0.08);
    }
    if (Math.abs(next - this.resolutionScale) > 0.001) {
      this.resolutionScale = next;
      this.resize();
      log.debug('resolution scale ->', next.toFixed(2), `avg frame ${average.toFixed(1)}ms`);
    }
  }

  private handleContextLost = (event: Event): void => {
    event.preventDefault();
    log.warn('WebGL context lost');
    this.stop();
    this.onContextLost?.();
  };

  private handleContextRestored = (): void => {
    log.info('WebGL context restored');
    this.buildEnvironment(this.preset.envSize);
    this.applyPreset(this.preset);
    this.onContextRestored?.();
    if (this.frameCallback) this.start(this.frameCallback);
  };

  dispose(): void {
    this.stop();
    window.removeEventListener('resize', this.resize);
    window.removeEventListener('orientationchange', this.resize);
    this.resizeObserver?.disconnect();
    this.canvas.removeEventListener('webglcontextlost', this.handleContextLost);
    this.canvas.removeEventListener('webglcontextrestored', this.handleContextRestored);
    this.postFX.dispose();
    this.envRenderTarget?.dispose();
    this.scene.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.geometry?.dispose();
      const material = mesh.material as THREE.Material | THREE.Material[];
      if (Array.isArray(material)) material.forEach((m) => m.dispose());
      else material?.dispose();
    });
    this.renderer.dispose();
  }
}
