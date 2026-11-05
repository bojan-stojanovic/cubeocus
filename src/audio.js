// Synthesised audio (no asset files): SFX with a small reverb, plus a soft procedural ambient loop.
const STORE = 'hocus.audio.v1';

let ctx = null;
let master, sfxBus, musicBus, reverb, wet;
let state = { sfx: true, music: true };
let musicTimer = null;
let nextChord = 0;
let chordIdx = 0;
let nextPluck = 0;

try { Object.assign(state, JSON.parse(localStorage.getItem(STORE)) || {}); } catch { /* ignore */ }
const save = () => { try { localStorage.setItem(STORE, JSON.stringify(state)); } catch { /* ignore */ } };

function impulse(c, seconds = 1.6, decay = 3) {
  const len = Math.floor(c.sampleRate * seconds);
  const buf = c.createBuffer(2, len, c.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
  }
  return buf;
}

function ensure() {
  if (!ctx) {
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch { return null; }
    master = ctx.createGain();
    master.gain.value = 0.9;
    const comp = ctx.createDynamicsCompressor();
    master.connect(comp).connect(ctx.destination);
    sfxBus = ctx.createGain();
    musicBus = ctx.createGain();
    sfxBus.gain.value = state.sfx ? 1 : 0;
    musicBus.gain.value = state.music ? 0.5 : 0;
    reverb = ctx.createConvolver();
    reverb.buffer = impulse(ctx);
    wet = ctx.createGain();
    wet.gain.value = 0.28;
    sfxBus.connect(master);
    musicBus.connect(master);
    sfxBus.connect(reverb);
    musicBus.connect(reverb);
    reverb.connect(wet).connect(master);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

// one enveloped tone through an optional low-pass filter
function tone({ f, t = 0, dur = 0.15, type = 'sine', vol = 0.08, to = 0, bus = 'sfx', lp = 0, attack = 0.005, detune = 0 }) {
  const c = ensure();
  if (!c) return;
  const when = c.currentTime + t;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f, when);
  if (to) o.frequency.exponentialRampToValueAtTime(to, when + dur);
  o.detune.value = detune;
  g.gain.setValueAtTime(0.0001, when);
  g.gain.exponentialRampToValueAtTime(vol, when + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
  let node = o;
  if (lp) {
    const fl = c.createBiquadFilter();
    fl.type = 'lowpass';
    fl.frequency.value = lp;
    o.connect(fl);
    node = fl;
  }
  node.connect(g).connect(bus === 'music' ? musicBus : sfxBus);
  o.start(when);
  o.stop(when + dur + 0.05);
}

const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

// ---- ambient music ---------------------------------------------------------------------
const CHORDS = [[60, 64, 67, 71], [57, 60, 64, 67], [53, 57, 60, 64], [55, 59, 62, 65]]; // Cmaj7 Am7 Fmaj7 G6
const PENTA = [72, 74, 76, 79, 81, 84, 79, 76];

function scheduleMusic() {
  if (!ctx || !state.music) return;
  const now = ctx.currentTime;
  while (nextChord < now + 1.0) {
    const chord = CHORDS[chordIdx++ % CHORDS.length];
    chord.forEach((m, i) => tone({ f: mtof(m - 12), t: nextChord - now, dur: 8.5, type: 'triangle', vol: 0.035, lp: 700, attack: 2.2, detune: i * 3, bus: 'music' }));
    nextChord += 8;
  }
  while (nextPluck < now + 1.0) {
    const m = PENTA[Math.floor(Math.random() * PENTA.length)];
    tone({ f: mtof(m), t: Math.max(0, nextPluck - now), dur: 1.6, type: 'sine', vol: 0.05, lp: 2400, bus: 'music' });
    nextPluck += 0.55 + Math.random() * 1.6;
  }
}

function startMusic() {
  if (!ensure() || musicTimer || !state.music) return;
  nextChord = nextPluck = ctx.currentTime + 0.1;
  musicTimer = setInterval(scheduleMusic, 250);
  scheduleMusic();
}
function stopMusic() {
  clearInterval(musicTimer);
  musicTimer = null;
}

export const sfx = {
  // call from a user gesture; also starts the music if enabled
  unlock() { if (ensure()) startMusic(); },
  get state() { return { ...state }; },
  setSfx(on) { state.sfx = on; save(); if (sfxBus) sfxBus.gain.value = on ? 1 : 0; },
  setMusic(on) {
    state.music = on;
    save();
    if (musicBus) musicBus.gain.setTargetAtTime(on ? 0.5 : 0, ctx.currentTime, 0.2);
    if (on) startMusic(); else stopMusic();
  },
  pick() { tone({ f: 660, dur: 0.07, type: 'triangle', vol: 0.05, lp: 3000 }); },
  snap() { tone({ f: 240, to: 150, dur: 0.12, type: 'square', vol: 0.035, lp: 900 }); tone({ f: 880, t: 0.02, dur: 0.1, type: 'sine', vol: 0.03 }); },
  rotate() { tone({ f: 300, to: 520, dur: 0.14, type: 'triangle', vol: 0.06, lp: 2200 }); },
  fail() { tone({ f: 180, to: 120, dur: 0.16, type: 'sawtooth', vol: 0.035, lp: 500 }); },
  undo() { tone({ f: 520, to: 330, dur: 0.12, type: 'triangle', vol: 0.05, lp: 2400 }); },
  hint() { [784, 988].forEach((f, i) => tone({ f, t: i * 0.09, dur: 0.3, type: 'sine', vol: 0.05 })); },
  gate(open) { tone({ f: open ? 330 : 440, to: open ? 660 : 220, dur: 0.25, type: 'triangle', vol: 0.05, lp: 2000 }); },
  step(i) { tone({ f: mtof(60 + (i * 2) % 12 + 12), dur: 0.16, type: 'triangle', vol: 0.06, lp: 2600 }); },
  sink() { tone({ f: 420, to: 110, dur: 0.4, type: 'sine', vol: 0.07 }); },
  win() { [72, 76, 79, 84].forEach((m, i) => tone({ f: mtof(m), t: i * 0.1, dur: 0.7, type: 'triangle', vol: 0.06, lp: 3200 })); },
};
