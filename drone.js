/* ============================================================
   DRONE - the sound of the dormant machine: something alive inside it,
   dreaming of waking up.

   A low electrical drone in the opener's key: the night's first song is in
   E-flat (OPENER, rotation.js) and the transformer the film powers up hums
   on E-flat too, so the drone is built on E-flat 1 and its harmonics are the
   same machine - and the same song, waiting. Layers:
     body    two slightly detuned saws on the root, one on its fifth,
             drifting against each other, through a resonant low-pass: as
             the robot gathers its light the filter opens and the harmonics
             come up through it; as it fades they sink back into the hum.
             An octave saw and only a little sine under them: most speakers
             here are laptops, so the drone lives in its harmonics.
     ghost   the 6th and 7th harmonics (233 and 272 Hz, the 7th flat of
             anything in tune), sines a few cents apart beating slowly, trailing
             the breath by a second, through a dark feedback echo.
     whine   the CRT's flyback, distant and faint.
     hiss    a little electrical noise, thicker as the robot dims, as the
             static on the screen is.
   It breathes with the robot: the level comes from the same breathing
   plan the screen uses (planBreath, breathLevelAt in lights.js), read at
   the screen's own phase every second, so sound and picture share one
   pulse. The sound trails the light a little (a transformer has inertia).
   When the picture falters the pitch sags and the contacts tick; when a
   band rolls down the tube the hiss sweeps down with it.

   It plays only once audio is allowed: the operator arms it before the
   night with Alt+Shift+D (app.js; remembered, so a browser that permits
   sound on load starts it by itself), or the visitor's own touch starts
   it. Unarmed, the dormant screen is silent.

   awaken() is the press: the machine holds its breath. Every layer falls
   silent in 150 ms and the drone is let go; the coin, the relays and the
   transformer are the film's own (sound.js). Everything is on the Effects
   bus, under the limiter; every change is a ramp, so it never clicks.
   ============================================================ */
import { breathLevelAt, breathTroubles } from './lights.js';

export const DRONE = {
  root: 38.89,         // E-flat 1
  level: 0.34,         // the whole drone, before the Effects fader: about 17 dB under the opener at equal faders
  fadeInS: 3,          // barely there at first, then it rises (and the operator hears it has armed)
  fadeOutS: 1.6,
  stepS: 0.1,          // how finely the breath is drawn onto the audio parameters
  aheadS: 2.5,         // how far ahead it is drawn
  tickMs: 1000,
  lagS: 0.22,          // the sound trails the light
  ghostLagS: 1.1,      // and the ghost trails further, like an echo of the breath
  stillLevel: 0.5,     // reduced motion / calm: the robot glows still, the drone holds
};

const clamp = (v, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
const S = (ms) => ms / 1000;

/* The breath level (0..1) -> each layer. */
export function voiceAt(level) {
  const l = clamp(level);
  return {
    breath: 0.5 + 0.5 * l,                  // the body never goes silent
    cutoff: 230 * 2 ** (2.5 * l),           // 230 Hz (a hum) to ~1.3 kHz (harmonics through)
    ghost: 0.15 + 0.85 * l,
    hiss: 1.25 - 0.6 * l,
    whine: 0.7 + 0.3 * l,
  };
}

/* After the press: every layer's share of its dormant level, as [ms from the press, share]. It holds its breath. */
const HOLD_MS = 150;
export const AFTER_PRESS = Object.fromEntries(['body', 'ghost', 'echo', 'hiss', 'whine'].map((layer) => [layer, [[0, 1], [HOLD_MS, 0]]]));
export const DONE_MS = HOLD_MS + 400;   // nothing left of it after this

function noiseBuffer(ctx, seconds) {
  const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * seconds), ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

/* engine: { ctx, sfxBus } (audio.js). breath: { plan, phase() } from wakeAttract. */
export function createDrone(engine, breath = {}) {
  const { ctx, sfxBus } = engine;
  const nodes = [];
  const sources = [];
  const node = (n) => { nodes.push(n); return n; };
  const gain = (v) => { const g = node(ctx.createGain()); g.gain.value = v; return g; };
  const osc = (type, freq, detune = 0) => {
    const o = node(ctx.createOscillator());
    o.type = type; o.frequency.value = freq; o.detune.value = detune;
    sources.push(o);
    return o;
  };
  const lfo = (hz, depth, target) => {        // a slow drift on a parameter, never repeating with the others
    const o = osc('sine', hz);
    const d = gain(depth);
    o.connect(d).connect(target);
  };
  const pan = (v) => { const p = node(ctx.createStereoPanner ? ctx.createStereoPanner() : ctx.createGain()); if (p.pan) p.pan.value = v; return p; };

  const out = gain(0);                         // fades and the hand-off
  out.connect(sfxBus);
  const mix = gain(1);
  mix.connect(out);

  // body
  const breathGain = gain(0.75);
  breathGain.connect(mix);
  const filter = node(ctx.createBiquadFilter());
  filter.type = 'lowpass'; filter.frequency.value = 400; filter.Q.value = 5.5;
  const bodyGain = gain(1);
  filter.connect(bodyGain).connect(breathGain);
  const SAW_CENTS = [-6, 7, -3, 4];
  const saws = [osc('sawtooth', DRONE.root, SAW_CENTS[0]), osc('sawtooth', DRONE.root, SAW_CENTS[1]),
    osc('sawtooth', DRONE.root * 1.5, SAW_CENTS[2]), osc('sawtooth', DRONE.root * 2, SAW_CENTS[3])];
  [[saws[0], 0.12, -0.35], [saws[1], 0.12, 0.35], [saws[2], 0.08, 0], [saws[3], 0.13, 0.1]].forEach(([o, level, side]) => o.connect(gain(level)).connect(pan(side)).connect(filter));
  lfo(0.031, 5, saws[0].detune);
  lfo(0.047, 6, saws[1].detune);
  lfo(0.023, 4, saws[2].detune);
  lfo(0.037, 5, saws[3].detune);
  lfo(0.013, 80, filter.frequency);            // the harmonics wander a little of their own accord
  const sub = osc('sine', DRONE.root);
  sub.connect(gain(0.1)).connect(bodyGain);   // small: most speakers here cannot reach it, the harmonics carry the drone

  // ghost
  const ghostGain = gain(0.5);
  const ghostShare = gain(1);
  const ghostIn = gain(1);
  ghostIn.connect(ghostGain).connect(ghostShare);
  const ghosts = [osc('sine', DRONE.root * 6, 3), osc('sine', DRONE.root * 7, -3), osc('sine', DRONE.root * 7, 4)];   // a few cents off the saws' own: slow beats, no buzz
  [[ghosts[0], 0.06], [ghosts[1], 0.055], [ghosts[2], 0.04]].forEach(([o, level]) => o.connect(gain(level)).connect(ghostIn));
  lfo(0.07, 4, ghosts[0].detune);
  lfo(0.053, 3, ghosts[1].detune);
  const echo = node(ctx.createDelay(1));
  echo.delayTime.value = 0.43;
  const echoTone = node(ctx.createBiquadFilter());
  echoTone.type = 'lowpass'; echoTone.frequency.value = 1400;
  const feedback = gain(0.42);
  const echoShare = gain(1);
  ghostShare.connect(pan(-0.25)).connect(mix);
  ghostShare.connect(echo);
  echo.connect(echoTone).connect(feedback).connect(echo);
  echoTone.connect(gain(0.7)).connect(echoShare).connect(pan(0.4)).connect(mix);

  // whine
  const whine = osc('sine', 7800);
  lfo(0.21, 5, whine.frequency);
  const whineGain = gain(0.0016);
  const whineShare = gain(1);
  whine.connect(whineGain).connect(whineShare).connect(mix);

  // hiss, and the bands that roll through it
  const noise = node(ctx.createBufferSource());
  noise.buffer = noiseBuffer(ctx, 3);
  noise.loop = true;
  sources.push(noise);
  const band = node(ctx.createBiquadFilter());
  band.type = 'bandpass'; band.frequency.value = 2400; band.Q.value = 0.6;
  const hissGain = gain(0.011);
  const hissShare = gain(1);
  const roll = gain(1);
  noise.connect(band).connect(hissGain).connect(roll).connect(hissShare).connect(mix);

  // contact ticks when it falters: short, quiet, high
  const tickBuf = noiseBuffer(ctx, 0.03);
  const tick = (t, level) => {
    const src = ctx.createBufferSource();
    const f = ctx.createBiquadFilter();
    const g = ctx.createGain();
    src.buffer = tickBuf;
    f.type = 'bandpass'; f.frequency.value = 2800 + Math.random() * 2400; f.Q.value = 1.2;
    g.gain.setValueAtTime(level, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.012 + Math.random() * 0.012);
    src.connect(f).connect(g).connect(mix);
    src.onended = () => { src.disconnect(); f.disconnect(); g.disconnect(); };
    src.start(t);
    src.stop(t + 0.04);
  };

  sources.forEach((s) => s.start());

  const plan = breath.plan;
  const troubles = plan ? breathTroubles(plan) : { falters: [], rolls: [] };
  const levelAt = (phaseMs) => (plan ? breathLevelAt(plan, phaseMs) : DRONE.stillLevel);
  // how far the ghost has risen, breath by breath: some breaths call it up, some barely
  const swell = (phaseMs) => 0.55 + 0.45 * Math.sin((phaseMs / 1000) * 0.21) * Math.sin((phaseMs / 1000) * 0.083 + 1);

  const params = () => [breathGain.gain, filter.frequency, ghostGain.gain, hissGain.gain, whineGain.gain];
  let drawnTo = 0;
  let timer = 0;
  let state = 'dormant';      // dormant -> awake (the film has it) -> gone
  let level = 0;              // where out is heading

  // Hold every breath parameter where it is now and drop what was drawn ahead.
  const hold = (param, t) => {
    if (param.cancelAndHoldAtTime) param.cancelAndHoldAtTime(t);
    else { const v = param.value; param.cancelScheduledValues(t); param.setValueAtTime(v, t); }
  };

  function draw() {
    if (state !== 'dormant') return;
    const now = ctx.currentTime;
    const phase = plan ? breath.phase?.() : 0;
    if (plan && phase == null) { timer = setTimeout(draw, DRONE.tickMs); return; }
    const zero = now - (phase || 0) / 1000;      // audio time of the loop's start, re-read each tick: no drift
    const from = Math.max(now, drawnTo);
    const to = now + DRONE.aheadS;
    if (drawnTo < now) params().forEach((p) => hold(p, now));
    for (let t = from + DRONE.stepS; t <= to + 1e-6; t += DRONE.stepS) {
      const ms = (t - zero) * 1000;
      const v = voiceAt(levelAt(ms - DRONE.lagS * 1000));
      const g = voiceAt(levelAt(ms - DRONE.ghostLagS * 1000));
      breathGain.gain.linearRampToValueAtTime(0.75 * v.breath, t);
      filter.frequency.linearRampToValueAtTime(v.cutoff, t);
      ghostGain.gain.linearRampToValueAtTime(0.5 * g.ghost * swell(ms), t);
      hissGain.gain.linearRampToValueAtTime(0.011 * v.hiss, t);
      whineGain.gain.linearRampToValueAtTime(0.0016 * v.whine, t);
    }
    if (plan) {
      const at = (loopMs) => {               // every time this loop moment falls in [from, to)
        const times = [];
        const first = Math.ceil(((from - zero) * 1000 - loopMs) / plan.duration);
        for (let k = first; ; k++) { const t = zero + (loopMs + k * plan.duration) / 1000; if (t >= to) break; if (t >= from) times.push(t); }
        return times;
      };
      for (const f of troubles.falters) for (const t of at(f + DRONE.lagS * 1000)) stumble(t);
      for (const r of troubles.rolls) for (const t of at(r)) rollBy(t);
    }
    drawnTo = to;
    timer = setTimeout(draw, DRONE.tickMs);
  }

  // The supply stumbles: the pitch sags and recovers, a contact ticks once or twice.
  function stumble(t) {
    saws.forEach((s, i) => {
      const c = SAW_CENTS[i];
      s.detune.setValueAtTime(c, t);
      s.detune.linearRampToValueAtTime(c - 22, t + 0.07);
      s.detune.setValueAtTime(c - 22, t + 0.22);
      s.detune.linearRampToValueAtTime(c, t + 0.75);
    });
    tick(t + 0.02, 0.05);
    if (Math.random() < 0.6) tick(t + 0.09 + Math.random() * 0.1, 0.03);
  }

  // A band rolls down the tube: the hiss sweeps down and swells as it passes.
  function rollBy(t) {
    const dur = 1.7;
    band.frequency.setValueAtTime(2400, t);
    band.frequency.exponentialRampToValueAtTime(3600, t + 0.3);
    band.frequency.exponentialRampToValueAtTime(700, t + dur);
    band.frequency.exponentialRampToValueAtTime(2400, t + dur + 0.6);
    roll.gain.setValueAtTime(1, t);
    roll.gain.linearRampToValueAtTime(1.9, t + dur * 0.49);
    roll.gain.linearRampToValueAtTime(1, t + dur + 0.3);
  }

  function fade(to, seconds, at = ctx.currentTime) {
    level = to;
    hold(out.gain, at);
    out.gain.linearRampToValueAtTime(to, at + seconds);
  }

  let disposed = false;
  function dispose() {
    if (disposed) return;
    disposed = true;
    clearTimeout(timer);
    state = 'gone';
    sources.forEach((s) => { try { s.stop(); } catch { /* not started */ } });
    nodes.forEach((n) => n.disconnect());
  }

  const drone = {
    get playing() { return state !== 'gone'; },
    get state() { return state; },
    get sounding() { return state === 'dormant' && level > 0; },   // started, not just built and waiting for sound

    /* Begin: it rises out of nothing over a few seconds. */
    start({ fadeS = DRONE.fadeInS, share = 1 } = {}) {
      if (state !== 'dormant') return drone;
      clearTimeout(timer);
      draw();
      fade(DRONE.level * share, fadeS);
      return drone;
    },

    /* Let it go (the operator disarming, or the page leaving). */
    stop(seconds = DRONE.fadeOutS) {
      if (state === 'gone') return;
      clearTimeout(timer);
      fade(0, seconds);
      state = 'gone';
      setTimeout(dispose, seconds * 1000 + 200);
    },

    /* The tab hidden or back: fall silent, then pick the breath up where the screen is. */
    setVisible(visible) {
      if (state !== 'dormant') return;
      clearTimeout(timer);
      if (!visible) { hold(out.gain, ctx.currentTime); out.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.4); return; }
      drawnTo = 0;
      draw();
      hold(out.gain, ctx.currentTime);
      out.gain.linearRampToValueAtTime(level, ctx.currentTime + 1.2);
    },

    /* The press: hand the drone to the film's beats, from audio time `at`. */
    awaken(at = ctx.currentTime) {
      if (state !== 'dormant') return;
      clearTimeout(timer);
      state = 'awake';
      if (level > 0) {                                        // armed and sounding: it stops, all at once
        for (const p of params()) hold(p, at);
        for (const [layer, share] of [['body', bodyGain], ['ghost', ghostShare], ['echo', echoShare], ['echo', feedback], ['hiss', hissShare], ['whine', whineShare]]) {
          hold(share.gain, at);
          const scale = share === feedback ? 0.42 : 1;
          for (const [ms, v] of AFTER_PRESS[layer]) share.gain.linearRampToValueAtTime(v * scale, at + S(ms));
        }
      }
      setTimeout(dispose, DONE_MS + Math.max(0, at - ctx.currentTime) * 1000);
    },

    dispose,
  };
  return drone;
}
