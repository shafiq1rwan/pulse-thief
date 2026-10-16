/* Pulse Thief — tiny synthesized sound system (Web Audio, no files). */
(function (PT) {
  'use strict';

  class AudioSystem {
    constructor() {
      this.ctx = null;
      this.muted = false;
    }

    /** Browsers only allow audio after a user gesture; call this on first click. */
    unlock() {
      if (this.ctx) return;
      try {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      } catch (e) { /* audio unavailable; stay silent */ }
    }

    toggleMute() {
      this.muted = !this.muted;
      return this.muted;
    }

    /** Short pitched blip. freq in Hz, duration in seconds, type = oscillator wave. */
    tone(freq, duration = 0.1, type = 'sine') {
      if (this.muted || !this.ctx) return;
      try {
        const ctx = this.ctx;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const now = ctx.currentTime;
        osc.type = type;
        osc.frequency.setValueAtTime(freq, now);
        osc.frequency.exponentialRampToValueAtTime(Math.max(70, freq * 0.62), now + duration);
        gain.gain.setValueAtTime(0.045, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + duration + 0.01);
      } catch (e) { /* ignore */ }
    }
  }

  PT.AudioSystem = AudioSystem;
})(window.PulseThief);
