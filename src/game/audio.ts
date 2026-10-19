/**
 * Procedural Web Audio API sound effects and ambient cozy synth music.
 * Zero external audio files/404s; 100% synthesized in real time.
 */

class SynthAudioEngine {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;
  private masterGain: GainNode | null = null;

  // Engine sound nodes
  private engineOsc: OscillatorNode | null = null;
  private engineFilter: BiquadFilterNode | null = null;
  private engineGain: GainNode | null = null;

  // Snow plowing continuous noise nodes
  private plowNoiseNode: AudioNode | null = null;
  private plowFilter: BiquadFilterNode | null = null;
  private plowGain: GainNode | null = null;

  // Ambient cozy synth music timer
  private musicIntervalId: number | null = null;
  private isMusicPlaying: boolean = false;

  constructor() {
    // AudioContext will be initialized on first user interaction
  }

  public init() {
    if (this.ctx) return;
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : 0.65, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);

      this.initEngineSynth();
      this.initPlowNoiseSynth();
      this.startAmbientMusic();
    } catch {
      // Audio not supported or blocked in headless environment
    }
  }

  public resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.isMuted ? 0 : 0.65, this.ctx.currentTime, 0.05);
    }
    return this.isMuted;
  }

  public getIsMuted(): boolean {
    return this.isMuted;
  }

  // --- Engine continuous synthesizer ---
  private initEngineSynth() {
    if (!this.ctx || !this.masterGain) return;
    try {
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'triangle';
      this.engineOsc.frequency.setValueAtTime(42, this.ctx.currentTime);

      this.engineFilter = this.ctx.createBiquadFilter();
      this.engineFilter.type = 'lowpass';
      this.engineFilter.frequency.setValueAtTime(120, this.ctx.currentTime);

      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.setValueAtTime(0.08, this.ctx.currentTime);

      this.engineOsc.connect(this.engineFilter);
      this.engineFilter.connect(this.engineGain);
      this.engineGain.connect(this.masterGain);

      this.engineOsc.start();
    } catch {
      // Ignore in headless
    }
  }

  // --- Snow plowing noise synthesizer ---
  private initPlowNoiseSynth() {
    if (!this.ctx || !this.masterGain) return;
    try {
      // Create 2 seconds of pink/white noise buffer
      const bufferSize = this.ctx.sampleRate * 2;
      const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      let b0 = 0, b1 = 0, b2 = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        output[i] = (b0 + b1 + b2 + white * 0.5362) * 0.11;
      }

      const whiteNoise = this.ctx.createBufferSource();
      whiteNoise.buffer = noiseBuffer;
      whiteNoise.loop = true;

      this.plowFilter = this.ctx.createBiquadFilter();
      this.plowFilter.type = 'bandpass';
      this.plowFilter.frequency.setValueAtTime(800, this.ctx.currentTime);
      this.plowFilter.Q.setValueAtTime(1.5, this.ctx.currentTime);

      this.plowGain = this.ctx.createGain();
      this.plowGain.gain.setValueAtTime(0, this.ctx.currentTime);

      whiteNoise.connect(this.plowFilter);
      this.plowFilter.connect(this.plowGain);
      this.plowGain.connect(this.masterGain);

      whiteNoise.start();
      this.plowNoiseNode = whiteNoise;
    } catch {
      // Ignore
    }
  }

  /**
   * Modulate engine and snow crunch based on speed and plowing activity
   */
  public updateVehicleAudio(speedNormalized: number, isPlowing: boolean, comboMult: number) {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    // Engine sound modulation
    if (this.engineOsc && this.engineFilter && this.engineGain) {
      const targetFreq = 40 + speedNormalized * 65; // 40Hz idle to 105Hz high rev
      const targetFilter = 110 + speedNormalized * 240;
      const targetGain = 0.07 + speedNormalized * 0.08;

      this.engineOsc.frequency.setTargetAtTime(targetFreq, now, 0.08);
      this.engineFilter.frequency.setTargetAtTime(targetFilter, now, 0.08);
      this.engineGain.gain.setTargetAtTime(targetGain, now, 0.08);
    }

    // Snow plowing whoosh modulation
    if (this.plowFilter && this.plowGain) {
      if (isPlowing && speedNormalized > 0.1) {
        const targetCrunchFreq = 700 + comboMult * 120 + speedNormalized * 400;
        const targetPlowGain = Math.min(0.22, 0.06 + speedNormalized * 0.12 * (1 + comboMult * 0.15));

        this.plowFilter.frequency.setTargetAtTime(targetCrunchFreq, now, 0.05);
        this.plowGain.gain.setTargetAtTime(targetPlowGain, now, 0.05);
      } else {
        this.plowGain.gain.setTargetAtTime(0, now, 0.08);
      }
    }
  }

  /**
   * Melodic synth arpeggio when combo tier advances
   */
  public playComboChime(tierIndex: number) {
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    const now = this.ctx.currentTime;

    // Cozy pentatonic scale frequencies (Eb major: Eb4, F4, G4, Bb4, C5, Eb5, F5, G5)
    const notes = [311.13, 349.23, 392.00, 466.16, 523.25, 622.25, 698.46, 783.99];
    const baseIdx = Math.min(notes.length - 3, tierIndex * 1);
    const chords = [notes[baseIdx], notes[baseIdx + 1], notes[baseIdx + 2]];

    chords.forEach((freq, idx) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.055);

      gain.gain.setValueAtTime(0, now + idx * 0.055);
      gain.gain.linearRampToValueAtTime(0.18, now + idx * 0.055 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.055 + 0.45);

      osc.connect(gain);
      gain.connect(this.masterGain!);

      osc.start(now + idx * 0.055);
      osc.stop(now + idx * 0.055 + 0.5);
    });
  }

  /**
   * Shimmering bell synth when finding buried presents or snowmen
   */
  public playTreasureFound() {
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    const now = this.ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.50, 1318.51]; // C E G C E shimmer

    notes.forEach((freq, i) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + i * 0.06);

      gain.gain.setValueAtTime(0, now + i * 0.06);
      gain.gain.linearRampToValueAtTime(0.2, now + i * 0.06 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.06 + 0.6);

      osc.connect(gain);
      gain.connect(this.masterGain!);

      osc.start(now + i * 0.06);
      osc.stop(now + i * 0.06 + 0.65);
    });
  }

  /**
   * Turbo Nitro Boost synth whoosh & chime
   */
  public playBoostSound() {
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(420, now + 0.35);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(300, now);
    filter.frequency.exponentialRampToValueAtTime(2400, now + 0.3);

    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.5);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + 0.55);
  }

  /**
   * Snowbank bump / soft impact thump
   */
  public playBumpSound() {
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(120, now);
    osc.frequency.exponentialRampToValueAtTime(35, now + 0.15);

    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + 0.22);
  }

  /**
   * Upgrade purchased happy synth blip
   */
  public playUpgradeSound() {
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    const now = this.ctx.currentTime;
    const notes = [440, 554.37, 659.25, 880];

    notes.forEach((freq, idx) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.045);

      gain.gain.setValueAtTime(0.15, now + idx * 0.045);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.045 + 0.25);

      osc.connect(gain);
      gain.connect(this.masterGain!);

      osc.start(now + idx * 0.045);
      osc.stop(now + idx * 0.045 + 0.3);
    });
  }

  /**
   * Stage victory fanfare synth
   */
  public playVictoryFanfare() {
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    const now = this.ctx.currentTime;
    // Inspiring cozy fanfare: Eb4, G4, Bb4, Eb5, G5
    const sequence = [
      { f: 311.13, d: 0.14, t: 0 },
      { f: 392.00, d: 0.14, t: 0.15 },
      { f: 466.16, d: 0.14, t: 0.30 },
      { f: 622.25, d: 0.45, t: 0.45 },
      { f: 783.99, d: 0.8, t: 0.70 },
    ];

    sequence.forEach((note) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(note.f, now + note.t);

      gain.gain.setValueAtTime(0, now + note.t);
      gain.gain.linearRampToValueAtTime(0.25, now + note.t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + note.t + note.d);

      osc.connect(gain);
      gain.connect(this.masterGain!);

      osc.start(now + note.t);
      osc.stop(now + note.t + note.d + 0.05);
    });
  }

  // --- Ambient winter background synth music ---
  private startAmbientMusic() {
    if (this.isMusicPlaying) return;
    this.isMusicPlaying = true;

    // Cozy lofi winter chord progression (Ebmaj7 -> Cm7 -> Fm7 -> Bb7sus4)
    const chords = [
      [155.56, 196.00, 233.08, 293.66], // Ebmaj7 (Eb3, G3, Bb3, D4)
      [130.81, 155.56, 196.00, 233.08], // Cm7 (C3, Eb3, G3, Bb3)
      [174.61, 207.65, 261.63, 311.13], // Fm7 (F3, Ab3, C4, Eb4)
      [116.54, 174.61, 233.08, 311.13], // Bb7sus (Bb2, F3, Bb3, Eb4)
    ];

    let currentChordIndex = 0;

    const playChord = () => {
      if (!this.ctx || !this.masterGain || this.isMuted) return;
      const now = this.ctx.currentTime;
      const chord = chords[currentChordIndex];
      currentChordIndex = (currentChordIndex + 1) % chords.length;

      chord.forEach((freq) => {
        try {
          const osc = this.ctx!.createOscillator();
          const filter = this.ctx!.createBiquadFilter();
          const gain = this.ctx!.createGain();

          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now);

          filter.type = 'lowpass';
          filter.frequency.setValueAtTime(450, now);

          gain.gain.setValueAtTime(0, now);
          gain.gain.linearRampToValueAtTime(0.035, now + 1.2); // soft swell
          gain.gain.exponentialRampToValueAtTime(0.0001, now + 5.2);

          osc.connect(filter);
          filter.connect(gain);
          gain.connect(this.masterGain!);

          osc.start(now);
          osc.stop(now + 5.5);
        } catch {
          // Ignore
        }
      });
    };

    // Trigger first chord soon, then every 5.5 seconds
    setTimeout(() => {
      playChord();
      this.musicIntervalId = window.setInterval(playChord, 5500);
    }, 1000);
  }

  public dispose() {
    if (this.musicIntervalId) {
      clearInterval(this.musicIntervalId);
      this.musicIntervalId = null;
    }
    if (this.ctx) {
      try {
        this.ctx.close();
      } catch {
        // Ignore
      }
      this.ctx = null;
    }
  }
}

export const soundManager = new SynthAudioEngine();
