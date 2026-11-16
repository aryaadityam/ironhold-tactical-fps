// IRONHOLD — all sound is synthesized with WebAudio; there are no audio files.
// Each effect is a few oscillators and filtered noise bursts shaped by
// envelopes. The context wakes on the first user gesture (the menu click), and

let ctx = null, master = null, noiseBuf = null, ambientOn = false;

export function initAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = 0.5;
  master.connect(ctx.destination);
  const len = ctx.sampleRate * 1.2;
  noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
}

function env(gain, t0, peak, a, d) {
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t0 + a);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + a + d);
}

function noise(t0, dur, filterType, f0, f1, peak, q = 1) {
  if (!ctx) return;
  const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
  src.playbackRate.value = 0.7 + Math.random() * 0.6;
  const flt = ctx.createBiquadFilter(); flt.type = filterType; flt.Q.value = q;
  flt.frequency.setValueAtTime(f0, t0);
  flt.frequency.exponentialRampToValueAtTime(Math.max(f1, 20), t0 + dur);
  const g = ctx.createGain(); env(g, t0, peak, 0.004, dur);
  src.connect(flt).connect(g).connect(master);
  src.start(t0, Math.random() * 0.4); src.stop(t0 + dur + 0.1);
}

function tone(t0, type, f0, f1, dur, peak, when = 0) {
  if (!ctx) return;
  const o = ctx.createOscillator(); o.type = type;
  const tt = t0 + when;
  o.frequency.setValueAtTime(f0, tt);
  o.frequency.exponentialRampToValueAtTime(Math.max(f1, 20), tt + dur);
  const g = ctx.createGain(); env(g, tt, peak, 0.006, dur);
  o.connect(g).connect(master);
  o.start(tt); o.stop(tt + dur + 0.1);
}

const now = () => (ctx ? ctx.currentTime : 0);

// Gunshots by weapon class: a crack (highpassed noise), a body thump (sine
export function sfxShot(kind, dist = 0, pan = 0) {
  if (!ctx) return;
  const t = now();
  const g = 1 - dist * 0.75;
  const dark = 1 - dist * 0.55;
  switch (kind) {
    case 'kijang':
      noise(t, 0.11, 'highpass', 900 * dark, 300, 0.30 * g);
      tone(t, 'sine', 210, 55, 0.1, 0.32 * g); break;
    case 'rusa':
      noise(t, 0.09, 'highpass', 1100 * dark, 350, 0.26 * g);
      tone(t, 'sine', 240, 60, 0.08, 0.26 * g); break;
    case 'badak':
      noise(t, 0.3, 'lowpass', 2600 * dark, 200, 0.55 * g);
      tone(t, 'sine', 130, 38, 0.28, 0.55 * g); break;
    case 'cendrawasih':
      noise(t, 0.42, 'lowpass', 3200 * dark, 120, 0.6 * g);
      noise(t, 0.16, 'highpass', 700, 200, 0.3 * g);
      tone(t, 'sine', 110, 30, 0.4, 0.6 * g); break;
    default: // banteng, elang
      noise(t, 0.13, 'highpass', 800 * dark, 260, 0.34 * g);
      tone(t, 'sine', 190, 48, 0.13, 0.36 * g);
  }
  void pan;
}

export function sfxDry() { tone(now(), 'square', 1400, 900, 0.04, 0.08); }
export function sfxReload(stage) {
  const t = now();
  tone(t, 'square', stage === 0 ? 500 : 760, 300, 0.05, 0.10);
  noise(t + 0.02, 0.05, 'bandpass', 1800, 900, 0.10, 2);
}
export function sfxHit(head) {
  const t = now();
  tone(t, 'sine', head ? 1560 : 1050, head ? 1200 : 800, 0.07, 0.16);
}
export function sfxKill() {
  const t = now();
  tone(t, 'sine', 880, 660, 0.09, 0.14);
  tone(t, 'sine', 1320, 990, 0.12, 0.12, 0.07);
}
export function sfxHurt() { noise(now(), 0.12, 'lowpass', 700, 200, 0.2); }
export function sfxStep(run) {
  const t = now();
  noise(t, 0.055, 'lowpass', run ? 500 : 380, 120, run ? 0.075 : 0.05);
}
export function sfxJump() { noise(now(), 0.08, 'bandpass', 500, 240, 0.07, 1.4); }
export function sfxSwing() { noise(now(), 0.12, 'bandpass', 900, 2400, 0.12, 1.6); }
export function sfxThrow() { noise(now(), 0.14, 'bandpass', 600, 1500, 0.08, 1.2); }
export function sfxExplosion(big = 1) {
  const t = now();
  noise(t, 0.9 * big, 'lowpass', 3000, 60, 0.85);
  tone(t, 'sine', 100, 24, 0.85 * big, 0.8);
  noise(t + 0.03, 0.25, 'highpass', 500, 150, 0.3);
}
export function sfxFlashbang() {
  const t = now();
  tone(t, 'sine', 3400, 3200, 0.7, 0.20);
  noise(t, 0.2, 'highpass', 2000, 800, 0.25);
}
export function sfxBeep(final) {
  tone(now(), 'square', final ? 1760 : 1180, final ? 1760 : 1180, final ? 0.16 : 0.06, 0.10);
}
export function sfxWire() { noise(now(), 0.07, 'bandpass', 2400, 1600, 0.07, 3); }
export function sfxBuy(ok) {
  const t = now();
  if (ok) { tone(t, 'sine', 990, 990, 0.06, 0.12); tone(t, 'sine', 1480, 1480, 0.08, 0.1, 0.06); }
  else tone(t, 'square', 160, 120, 0.14, 0.12);
}
export function sfxClick() { tone(now(), 'sine', 700, 500, 0.04, 0.08); }

// Round stingers: a two-note brass-ish figure, warm for a win, low for a loss.
export function sfxSting(win) {
  if (!ctx) return;
  const t = now();
  const notes = win ? [392, 523, 659] : [330, 262, 196];
  notes.forEach((f, i) => {
    tone(t, 'triangle', f, f, 0.34, 0.16, i * 0.13);
    tone(t, 'sawtooth', f / 2, f / 2, 0.34, 0.05, i * 0.13);
  });
}

// The yard at dusk: mains hum, a far generator, cloth and metal in the wind.
export function startAmbient() {
  if (!ctx || ambientOn) return;
  ambientOn = true;
  const g = ctx.createGain(); g.gain.value = 0.045; g.connect(master);
  const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
  const flt = ctx.createBiquadFilter(); flt.type = 'lowpass'; flt.frequency.value = 220;
  src.connect(flt).connect(g); src.start();
  const hum = ctx.createOscillator(); hum.type = 'sine'; hum.frequency.value = 58;
  const hg = ctx.createGain(); hg.gain.value = 0.016;
  hum.connect(hg).connect(master); hum.start();
  const lfo = ctx.createOscillator(); lfo.frequency.value = 0.07;
  const lg = ctx.createGain(); lg.gain.value = 60;
  lfo.connect(lg).connect(flt.frequency); lfo.start();
}
