/* SPDX-License-Identifier: MIT */
(function () {
  'use strict';
  BN.Audio = class {
    constructor() { this.enabled = false; this.ctx = null; this.musicTimer = 0; this.step = 0; }
    toggle() {
      if (!this.ctx) this.init();
      this.enabled = !this.enabled;
      if (this.ctx) {
        this.ctx.resume().catch(function () {});
        this.master.gain.setTargetAtTime(this.enabled ? 0.3 : 0, this.ctx.currentTime, 0.15);
      }
      return this.enabled;
    }
    init() {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      const c = this.ctx = new AC();
      this.master = c.createGain(); this.master.gain.value = 0; this.master.connect(c.destination);
      const source = (type, hz) => { const o = c.createOscillator(), g = c.createGain(); o.type = type; o.frequency.value = hz; g.gain.value = 0; o.connect(g); g.connect(this.master); o.start(); return {o,g}; };
      this.engine = source('sawtooth', 45); this.siren = source('sine', 620);
      const buffer = c.createBuffer(1, c.sampleRate * 3, c.sampleRate), d = buffer.getChannelData(0);
      let seed = 5216; for (let i = 0; i < d.length; i++) { seed = (1664525 * seed + 1013904223) >>> 0; d[i] = ((seed / 4294967296) * 2 - 1) * 0.65; }
      const n = c.createBufferSource(), filter = c.createBiquadFilter(); n.buffer = buffer; n.loop = true; filter.type = 'lowpass'; filter.frequency.value = 1800;
      this.rain = c.createGain(); this.rain.gain.value = 0; n.connect(filter); filter.connect(this.rain); this.rain.connect(this.master); n.start();
    }
    beep(frequency = 440, duration = 0.15, type = 'sine', volume = 0.15) {
      if (!this.ctx || !this.enabled) return;
      const c = this.ctx, o = c.createOscillator(), g = c.createGain(); o.type = type; o.frequency.value = frequency;
      g.gain.setValueAtTime(volume, c.currentTime); g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration);
      o.connect(g); g.connect(this.master); o.start(); o.stop(c.currentTime + duration + 0.02);
    }
    horn() { this.beep(220, 0.35, 'square', 0.16); this.beep(277, 0.35, 'square', 0.1); }
    impact() { this.beep(65, 0.18, 'sawtooth', 0.35); }
    update(dt, state) {
      if (!this.ctx) return;
      const t = this.ctx.currentTime;
      this.engine.g.gain.setTargetAtTime(state.driving && state.playing ? 0.045 : 0, t, 0.1);
      this.engine.o.frequency.setTargetAtTime(38 + Math.abs(state.speed) * 6, t, 0.08);
      this.siren.g.gain.setTargetAtTime(state.siren && state.playing ? 0.065 : 0, t, 0.1);
      this.siren.o.frequency.setTargetAtTime(650 + Math.sin(t * 6) * 190, t, 0.03);
      this.rain.gain.setTargetAtTime(state.rain * 0.3, t, 0.5);
      this.musicTimer -= dt;
      if (state.cinematic && this.musicTimer <= 0) {
        const notes = [146.83, 220, 293.66, 349.23, 293.66, 261.63, 220, 174.61];
        this.beep(notes[this.step++ % notes.length], 1.8, 'triangle', 0.09); this.musicTimer = 0.65;
      }
    }
  };
})();
