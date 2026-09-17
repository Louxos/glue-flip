import { createLogger } from '@/utils/logger';
import type { SurfaceAudio } from '@/config/surfaces';

const log = createLogger('audio');

/**
 * Procedural sound design.
 *
 * No audio files ship with the game: every sound is synthesised with the Web
 * Audio API from noise bursts, filtered resonances and short envelopes. That
 * keeps the download tiny, lets impact sounds scale continuously with the real
 * contact force, and keeps the palette coherent.
 */

export interface ImpactParams {
  surface: SurfaceAudio;
  /** Impact speed in m/s. */
  speed: number;
  /** 0..1, how "flat" the impact was (1 = base perfectly flat). */
  flatness?: number;
  /** 0..1 stereo position. */
  pan?: number;
}

interface SurfaceVoice {
  /** Resonant body frequency. */
  freq: number;
  /** Decay time of the resonance. */
  decay: number;
  /** How much noise vs tone. */
  noise: number;
  /** Lowpass cutoff for the transient. */
  cutoff: number;
  /** Extra ring (metal/glass). */
  ring?: number;
}

const SURFACE_VOICES: Record<SurfaceAudio, SurfaceVoice> = {
  wood: { freq: 178, decay: 0.13, noise: 0.55, cutoff: 1500 },
  glass: { freq: 880, decay: 0.42, noise: 0.35, cutoff: 3200, ring: 1580 },
  metal: { freq: 1240, decay: 0.5, noise: 0.4, cutoff: 3800, ring: 2080 },
  rubber: { freq: 96, decay: 0.09, noise: 0.75, cutoff: 700 },
  stone: { freq: 430, decay: 0.2, noise: 0.5, cutoff: 2200, ring: 720 },
  paper: { freq: 240, decay: 0.07, noise: 0.9, cutoff: 1100 },
};

export class AudioEngine {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private uiBus: GainNode | null = null;
  private ambienceBus: GainNode | null = null;
  private reverb: ConvolverNode | null = null;
  private reverbSend: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private airSource: AudioBufferSourceNode | null = null;
  private airGain: GainNode | null = null;
  private airFilter: BiquadFilterNode | null = null;
  private ambienceSource: AudioBufferSourceNode | null = null;
  private ambienceGain: GainNode | null = null;

  private volumes = { master: 0.85, sfx: 0.9, ambience: 0.55 };
  private ready = false;

  get isReady(): boolean {
    return this.ready;
  }

  get suspended(): boolean {
    return this.context?.state === 'suspended';
  }

  /** Creates the audio graph. Must be called from a user gesture on iOS. */
  async init(): Promise<void> {
    if (this.ready) return;
    try {
      const Ctor: typeof AudioContext =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) {
        log.warn('Web Audio unavailable');
        return;
      }
      const context = new Ctor({ latencyHint: 'interactive' });
      this.context = context;

      const master = context.createGain();
      master.gain.value = this.volumes.master;
      const compressor = context.createDynamicsCompressor();
      compressor.threshold.value = -14;
      compressor.knee.value = 22;
      compressor.ratio.value = 3.2;
      compressor.attack.value = 0.004;
      compressor.release.value = 0.22;
      master.connect(compressor);
      compressor.connect(context.destination);

      const sfxBus = context.createGain();
      sfxBus.gain.value = this.volumes.sfx;
      sfxBus.connect(master);

      const uiBus = context.createGain();
      uiBus.gain.value = Math.min(1, this.volumes.sfx * 0.85);
      uiBus.connect(master);

      const ambienceBus = context.createGain();
      ambienceBus.gain.value = this.volumes.ambience;
      ambienceBus.connect(master);

      // Small procedural room reverb so impacts sit in a space.
      const reverb = context.createConvolver();
      reverb.buffer = this.createImpulseResponse(1.5, 2.6);
      const reverbSend = context.createGain();
      reverbSend.gain.value = 0.16;
      reverbSend.connect(reverb);
      const reverbReturn = context.createGain();
      reverbReturn.gain.value = 0.9;
      reverb.connect(reverbReturn);
      reverbReturn.connect(master);

      this.master = master;
      this.sfxBus = sfxBus;
      this.uiBus = uiBus;
      this.ambienceBus = ambienceBus;
      this.reverb = reverb;
      this.reverbSend = reverbSend;
      this.noiseBuffer = this.createNoiseBuffer(2);
      this.ready = true;

      await context.resume();
      log.info('audio ready', { state: context.state });
    } catch (error) {
      log.warn('audio init failed', error);
    }
  }

  async resume(): Promise<void> {
    if (!this.context) await this.init();
    if (this.context?.state === 'suspended') {
      try {
        await this.context.resume();
      } catch (error) {
        log.debug('resume blocked', error);
      }
    }
  }

  setVolumes(volumes: Partial<typeof this.volumes>): void {
    this.volumes = { ...this.volumes, ...volumes };
    if (this.master) this.master.gain.value = this.volumes.master;
    if (this.sfxBus) this.sfxBus.gain.value = this.volumes.sfx;
    if (this.uiBus) this.uiBus.gain.value = Math.min(1, this.volumes.sfx * 0.85);
    if (this.ambienceBus) this.ambienceBus.gain.value = this.volumes.ambience;
  }

  // --- Sound effects -----------------------------------------------------

  /** Fingers closing on the plastic shell. */
  grab(): void {
    if (!this.ready) return;
    this.playNoiseBurst({ duration: 0.05, gain: 0.16, cutoff: 2400, type: 'bandpass', q: 1.2 });
    this.playTone({ freq: 320, type: 'triangle', duration: 0.05, gain: 0.05, decay: 0.05 });
  }

  /** The flick that releases the stick. */
  release(power: number): void {
    if (!this.ready) return;
    const context = this.context!;
    const now = context.currentTime;
    const duration = 0.16 + power * 0.16;
    const source = context.createBufferSource();
    source.buffer = this.noiseBuffer;
    const filter = context.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = 0.9;
    filter.frequency.setValueAtTime(320, now);
    filter.frequency.exponentialRampToValueAtTime(900 + power * 1400, now + duration);
    const gain = context.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.05 + power * 0.16, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxBus!);
    this.connectReverb(gain, 0.1);
    source.start(now);
    source.stop(now + duration + 0.02);
  }

  /** Contact with a surface — the core sound of the game. */
  impact(params: ImpactParams): void {
    if (!this.ready) return;
    const voice = SURFACE_VOICES[params.surface] ?? SURFACE_VOICES.wood;
    const intensity = Math.min(1, params.speed / 4.5);
    if (intensity <= 0.015) return;

    const flatness = params.flatness ?? 0.5;
    const context = this.context!;
    const now = context.currentTime;
    const pan = this.createPanner(params.pan ?? 0.5);

    // Transient: filtered noise, sharper for a flat base hit.
    this.playNoiseBurst({
      duration: 0.035 + intensity * 0.05,
      gain: 0.1 + intensity * 0.34,
      cutoff: voice.cutoff * (0.6 + intensity * 0.8),
      type: 'lowpass',
      q: 0.7 + flatness * 0.8,
      destination: pan,
    });

    // Body resonance: the material's tone.
    this.playTone({
      freq: voice.freq * (0.94 + flatness * 0.12),
      type: params.surface === 'rubber' ? 'sine' : 'triangle',
      duration: voice.decay * (0.6 + intensity),
      gain: 0.05 + intensity * 0.2 * (1 - voice.noise * 0.5),
      decay: voice.decay,
      destination: pan,
    });

    if (voice.ring) {
      this.playTone({
        freq: voice.ring * (0.98 + intensity * 0.06),
        type: 'sine',
        duration: voice.decay * 1.5,
        gain: 0.02 + intensity * 0.07,
        decay: voice.decay * 1.4,
        destination: pan,
      });
      this.playTone({
        freq: voice.ring * 1.51,
        type: 'sine',
        duration: voice.decay,
        gain: 0.01 + intensity * 0.03,
        decay: voice.decay,
        destination: pan,
      });
    }

    void now;
  }

  /** Light bounce — same recipe, quieter and shorter. */
  bounce(speed: number, surface: SurfaceAudio): void {
    this.impact({ surface, speed: speed * 0.6, flatness: 0.25 });
  }

  /** Scraping along a surface. */
  slide(speed: number, surface: SurfaceAudio): void {
    if (!this.ready) return;
    const intensity = Math.min(1, speed / 2.5);
    if (intensity < 0.05) return;
    const voice = SURFACE_VOICES[surface] ?? SURFACE_VOICES.wood;
    this.playNoiseBurst({
      duration: 0.05 + intensity * 0.08,
      gain: 0.02 + intensity * 0.09,
      cutoff: voice.cutoff * 0.7,
      type: 'bandpass',
      q: 2.2,
    });
  }

  /** The stick is spinning through the air. */
  startAir(): void {
    if (!this.ready || this.airSource) return;
    const context = this.context!;
    const source = context.createBufferSource();
    source.buffer = this.noiseBuffer;
    source.loop = true;
    const filter = context.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 700;
    filter.Q.value = 1.1;
    const gain = context.createGain();
    gain.gain.value = 0.0001;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxBus!);
    source.start();
    this.airSource = source;
    this.airGain = gain;
    this.airFilter = filter;
  }

  /** Modulates the air sound with the stick's actual speed and spin. */
  updateAir(speed: number, spin: number): void {
    if (!this.airGain || !this.airFilter || !this.context) return;
    const now = this.context.currentTime;
    const intensity = Math.min(1, speed / 5);
    this.airGain.gain.setTargetAtTime(0.0001 + intensity * 0.045, now, 0.05);
    this.airFilter.frequency.setTargetAtTime(420 + spin * 55 + speed * 90, now, 0.08);
  }

  stopAir(): void {
    if (!this.airGain || !this.context) return;
    const now = this.context.currentTime;
    this.airGain.gain.setTargetAtTime(0.0001, now, 0.06);
    const source = this.airSource;
    this.airSource = null;
    this.airGain = null;
    this.airFilter = null;
    window.setTimeout(() => {
      try {
        source?.stop();
      } catch {
        /* already stopped */
      }
    }, 240);
  }

  /** Clean upright landing. */
  landingSuccess(perfect: boolean): void {
    if (!this.ready) return;
    const base = perfect ? 784 : 622;
    this.playChord([base, base * 1.5], 0.5, 0.055);
    if (perfect) {
      window.setTimeout(() => this.playChord([base * 2, base * 3], 0.7, 0.035), 70);
      window.setTimeout(() => this.playTone({ freq: base * 4, type: 'sine', duration: 0.5, gain: 0.02, decay: 0.5 }), 130);
    }
  }

  /** Soft confirmation that a throw failed (never punishing). */
  landingFail(): void {
    if (!this.ready) return;
    this.playTone({ freq: 196, type: 'sine', duration: 0.28, gain: 0.035, decay: 0.28 });
  }

  uiHover(): void {
    this.playTone({ freq: 1250, type: 'sine', duration: 0.045, gain: 0.014, decay: 0.045, bus: 'ui' });
  }

  uiClick(): void {
    this.playTone({ freq: 620, type: 'triangle', duration: 0.075, gain: 0.05, decay: 0.075, bus: 'ui' });
    this.playNoiseBurst({ duration: 0.02, gain: 0.03, cutoff: 3200, type: 'highpass', q: 0.8, bus: 'ui' });
  }

  uiBack(): void {
    this.playTone({ freq: 380, type: 'triangle', duration: 0.09, gain: 0.04, decay: 0.09, bus: 'ui' });
  }

  /** Very quiet room tone: filtered noise with a slow amplitude drift. */
  startAmbience(): void {
    if (!this.ready || this.ambienceSource) return;
    const context = this.context!;
    const source = context.createBufferSource();
    source.buffer = this.noiseBuffer;
    source.loop = true;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 340;
    filter.Q.value = 0.4;
    const gain = context.createGain();
    gain.gain.value = 0.0001;
    const lfo = context.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoGain = context.createGain();
    lfoGain.gain.value = 0.006;
    lfo.connect(lfoGain);
    lfoGain.connect(gain.gain);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.ambienceBus!);
    source.start();
    lfo.start();
    gain.gain.setTargetAtTime(0.028, context.currentTime, 1.2);
    this.ambienceSource = source;
    this.ambienceGain = gain;
  }

  stopAmbience(): void {
    if (!this.ambienceGain || !this.context) return;
    this.ambienceGain.gain.setTargetAtTime(0.0001, this.context.currentTime, 0.4);
    const source = this.ambienceSource;
    this.ambienceSource = null;
    this.ambienceGain = null;
    window.setTimeout(() => {
      try {
        source?.stop();
      } catch {
        /* already stopped */
      }
    }, 900);
  }

  // --- Internals ---------------------------------------------------------

  private createNoiseBuffer(duration: number): AudioBuffer {
    const context = this.context!;
    const length = Math.floor(context.sampleRate * duration);
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1;
      // Light pink-ish tilt: sounds less harsh than pure white noise.
      last = (last + 0.02 * white) / 1.02;
      data[i] = white * 0.7 + last * 3;
    }
    return buffer;
  }

  private createImpulseResponse(duration: number, decay: number): AudioBuffer {
    const context = this.context!;
    const length = Math.floor(context.sampleRate * duration);
    const buffer = context.createBuffer(2, length, context.sampleRate);
    for (let channel = 0; channel < 2; channel++) {
      const data = buffer.getChannelData(channel);
      for (let i = 0; i < length; i++) {
        const t = i / length;
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, decay);
      }
    }
    return buffer;
  }

  private connectReverb(node: AudioNode, amount = 0.15): void {
    if (!this.reverbSend) return;
    const send = this.context!.createGain();
    send.gain.value = amount;
    node.connect(send);
    send.connect(this.reverbSend);
  }

  private createPanner(pan: number): AudioNode {
    const context = this.context!;
    if (typeof context.createStereoPanner !== 'function') return this.sfxBus!;
    const panner = context.createStereoPanner();
    panner.pan.value = Math.max(-1, Math.min(1, (pan - 0.5) * 1.4));
    panner.connect(this.sfxBus!);
    return panner;
  }

  private playTone(options: {
    freq: number;
    type: OscillatorType;
    duration: number;
    gain: number;
    decay?: number;
    destination?: AudioNode;
    bus?: 'sfx' | 'ui';
  }): void {
    if (!this.ready || !this.context) return;
    const context = this.context;
    const now = context.currentTime;
    const oscillator = context.createOscillator();
    oscillator.type = options.type;
    oscillator.frequency.setValueAtTime(options.freq, now);
    const gain = context.createGain();
    const decay = options.decay ?? options.duration;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, options.gain), now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + decay);
    oscillator.connect(gain);
    const destination =
      options.destination ?? (options.bus === 'ui' ? this.uiBus! : this.sfxBus!);
    gain.connect(destination);
    if (options.bus !== 'ui') this.connectReverb(gain, 0.18);
    oscillator.start(now);
    oscillator.stop(now + decay + 0.05);
  }

  private playNoiseBurst(options: {
    duration: number;
    gain: number;
    cutoff: number;
    type: BiquadFilterType;
    q: number;
    destination?: AudioNode;
    bus?: 'sfx' | 'ui';
  }): void {
    if (!this.ready || !this.context || !this.noiseBuffer) return;
    const context = this.context;
    const now = context.currentTime;
    const source = context.createBufferSource();
    source.buffer = this.noiseBuffer;
    const filter = context.createBiquadFilter();
    filter.type = options.type;
    filter.frequency.value = options.cutoff;
    filter.Q.value = options.q;
    const gain = context.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, options.gain), now + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + options.duration);
    source.connect(filter);
    filter.connect(gain);
    const destination =
      options.destination ?? (options.bus === 'ui' ? this.uiBus! : this.sfxBus!);
    gain.connect(destination);
    if (options.bus !== 'ui') this.connectReverb(gain, 0.12);
    source.start(now);
    source.stop(now + options.duration + 0.03);
  }

  private playChord(frequencies: number[], duration: number, gain: number): void {
    for (const freq of frequencies) {
      this.playTone({ freq, type: 'sine', duration, gain, decay: duration });
    }
  }

  dispose(): void {
    this.stopAir();
    this.stopAmbience();
    try {
      this.context?.close();
    } catch {
      /* ignore */
    }
    this.context = null;
    this.ready = false;
  }
}
