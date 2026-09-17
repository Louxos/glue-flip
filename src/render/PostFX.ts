import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { FXAAShader } from 'three/examples/jsm/shaders/FXAAShader.js';
import type { QualityPreset } from '@/config/quality';
import { createLogger } from '@/utils/logger';

const log = createLogger('postfx');

/**
 * Subtle cinematic grade: vignette + film grain + a whisper of chromatic
 * aberration at the edges. Deliberately restrained — the look stays photoreal.
 */
const GradeShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    uTime: { value: 0 },
    uVignette: { value: 1 },
    uGrain: { value: 0.035 },
    uAberration: { value: 0.0016 },
    uFade: { value: 0 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform float uVignette;
    uniform float uGrain;
    uniform float uAberration;
    uniform float uFade;
    varying vec2 vUv;

    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
    }

    void main() {
      vec2 uv = vUv;
      vec2 center = uv - 0.5;
      float radius = length(center);

      // Edge chromatic aberration (very slight, only at the borders).
      float amount = uAberration * smoothstep(0.15, 0.75, radius);
      vec4 color;
      color.r = texture2D(tDiffuse, uv + center * amount).r;
      color.g = texture2D(tDiffuse, uv).g;
      color.b = texture2D(tDiffuse, uv - center * amount).b;
      color.a = 1.0;

      // Vignette.
      float vignette = smoothstep(0.95, 0.28, radius);
      color.rgb *= mix(1.0, vignette, uVignette * 0.85);

      // Film grain, animated so it does not look like dirt on the lens.
      float grain = hash(uv * 1024.0 + fract(uTime) * 91.7) - 0.5;
      color.rgb += grain * uGrain * (0.4 + 0.6 * (1.0 - vignette + 0.4));

      // Fade to black, used by screen transitions.
      color.rgb *= (1.0 - uFade);

      gl_FragColor = color;
    }
  `,
};

export interface PostFXOptions {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.Camera;
  preset: QualityPreset;
}

export class PostFX {
  readonly composer: EffectComposer;
  private renderPass: RenderPass;
  private bloomPass: UnrealBloomPass | null = null;
  private gradePass: ShaderPass;
  private fxaaPass: ShaderPass | null = null;
  private outputPass: OutputPass;
  private enabled: boolean;
  private time = 0;

  constructor(options: PostFXOptions) {
    const { renderer, scene, camera, preset } = options;

    const size = renderer.getSize(new THREE.Vector2());
    this.composer = new EffectComposer(renderer);
    this.composer.setSize(size.x, size.y);

    this.renderPass = new RenderPass(scene, camera);
    this.composer.addPass(this.renderPass);

    try {
      this.bloomPass = new UnrealBloomPass(
        new THREE.Vector2(size.x, size.y),
        preset.bloomStrength,
        0.62,
        0.86,
      );
      this.composer.addPass(this.bloomPass);
    } catch (error) {
      log.warn('bloom unavailable', error);
      this.bloomPass = null;
    }

    this.gradePass = new ShaderPass(GradeShader);
    this.composer.addPass(this.gradePass);

    if (preset.antialias === 'fxaa') {
      this.fxaaPass = new ShaderPass(FXAAShader);
      this.composer.addPass(this.fxaaPass);
    }

    this.outputPass = new OutputPass();
    this.composer.addPass(this.outputPass);

    this.enabled = true;
    this.configure(preset);
  }

  configure(preset: QualityPreset): void {
    const size = this.composer.renderer.getSize(new THREE.Vector2());
    if (this.bloomPass) {
      this.bloomPass.enabled = preset.bloom;
      this.bloomPass.strength = preset.bloomStrength;
      this.bloomPass.radius = 0.62;
      this.bloomPass.threshold = 0.86;
    }
    const grade = this.gradePass.uniforms;
    grade.uVignette.value = preset.vignette ? 1 : 0;
    grade.uGrain.value = preset.filmGrain ? 0.032 : 0;
    grade.uAberration.value = preset.id === 'low' ? 0 : 0.0016;

    const wantsFxaa = preset.antialias === 'fxaa';
    if (wantsFxaa && !this.fxaaPass) {
      this.fxaaPass = new ShaderPass(FXAAShader);
      // Insert before the output pass so tonemapping stays last.
      this.composer.insertPass(this.fxaaPass, this.composer.passes.length - 1);
    }
    if (this.fxaaPass) this.fxaaPass.enabled = wantsFxaa;
    this.updateFxaaResolution(size.x, size.y);

    // With no post effects at all, drawing through the composer is wasted work.
    const anyEffect =
      (this.bloomPass?.enabled ?? false) ||
      preset.vignette ||
      preset.filmGrain ||
      (this.fxaaPass?.enabled ?? false);
    this.enabled = anyEffect;
  }

  private updateFxaaResolution(width: number, height: number): void {
    if (!this.fxaaPass) return;
    const pixelRatio = this.composer.renderer.getPixelRatio();
    const uniforms = this.fxaaPass.material.uniforms as { resolution?: { value: THREE.Vector2 } };
    uniforms.resolution?.value.set(1 / (width * pixelRatio), 1 / (height * pixelRatio));
  }

  setSize(width: number, height: number, pixelRatio: number): void {
    this.composer.setPixelRatio(pixelRatio);
    this.composer.setSize(width, height);
    this.updateFxaaResolution(width, height);
  }

  setFade(amount: number): void {
    this.gradePass.uniforms.uFade.value = amount;
  }

  /** Renders a frame. Returns false when the composer was bypassed. */
  render(deltaTime: number): boolean {
    this.time += deltaTime;
    this.gradePass.uniforms.uTime.value = this.time;
    if (!this.enabled) return false;
    this.composer.render(deltaTime);
    return true;
  }

  dispose(): void {
    for (const pass of this.composer.passes) pass.dispose?.();
    this.composer.dispose?.();
  }
}
