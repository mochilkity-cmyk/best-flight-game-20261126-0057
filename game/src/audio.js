// Skycourier — Island Run: sound, synthesized live.
// One job: every sound the game makes, built with WebAudio at run time —
// no audio files, no network. An engine drone that follows the throttle,
// wind that follows the speed, a chime for a ring, a thud for a landing.

export function createAudio() {
  let ctx = null;
  let engineOsc = null;
  let engineGain = null;
  let windSrc = null;
  let windGain = null;
  let muted = false;
  let started = false;

  function ensure() {
    if (started) return;
    started = true;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      // Engine: two detuned saws through a low-pass filter.
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 70;
      const osc2 = ctx.createOscillator();
      osc2.type = 'sawtooth';
      osc2.frequency.value = 105;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 420;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      engineOsc.connect(filter);
      osc2.connect(filter);
      filter.connect(engineGain);
      engineGain.connect(ctx.destination);
      engineOsc.start();
      osc2.start();
      // Wind: looped noise, filtered, gain follows airspeed.
      const len = ctx.sampleRate * 2;
      const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      windSrc = ctx.createBufferSource();
      windSrc.buffer = buffer;
      windSrc.loop = true;
      const windFilter = ctx.createBiquadFilter();
      windFilter.type = 'bandpass';
      windFilter.frequency.value = 600;
      windGain = ctx.createGain();
      windGain.gain.value = 0;
      windSrc.connect(windFilter);
      windFilter.connect(windGain);
      windGain.connect(ctx.destination);
      windSrc.start();
    } catch (err) {
      ctx = null;
    }
  }

  function tone(freq, dur, type, vol, when = 0) {
    if (!ctx || muted) return;
    const t = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(vol, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  return {
    // Call from the first user gesture; browsers require it.
    unlock() {
      ensure();
      if (ctx && ctx.state === 'suspended') ctx.resume();
    },
    update(throttle, speed, engineOn) {
      if (!ctx || muted) return;
      const t = ctx.currentTime;
      const target = engineOn ? 0.05 + throttle * 0.06 : 0;
      engineGain.gain.setTargetAtTime(target, t, 0.1);
      engineOsc.frequency.setTargetAtTime(55 + throttle * 90, t, 0.1);
      windGain.gain.setTargetAtTime(Math.min(0.09, speed * 0.0011), t, 0.15);
    },
    ring() {
      tone(880, 0.35, 'sine', 0.22);
      tone(1318, 0.4, 'sine', 0.18, 0.07);
    },
    land() {
      tone(180, 0.25, 'sine', 0.3);
      tone(90, 0.4, 'sine', 0.25, 0.05);
    },
    crash() {
      tone(70, 0.7, 'sawtooth', 0.3);
      tone(45, 0.9, 'sine', 0.3, 0.05);
    },
    click() {
      tone(660, 0.08, 'square', 0.08);
    },
    toggleMute() {
      muted = !muted;
      if (ctx) {
        if (engineGain) engineGain.gain.value = 0;
        if (windGain) windGain.gain.value = 0;
      }
      return muted;
    },
    get muted() {
      return muted;
    },
  };
}
