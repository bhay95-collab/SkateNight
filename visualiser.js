/* ============================================================
   VISUALISER - everything that moves with the music, driven by ONE
   shared requestAnimationFrame loop.

   Each frame (capped at 30 per second - plenty for a projector and kind
   to a modest laptop) it reads the music's frequencies and loudness once,
   then feeds:
     - the neon SPECTRUM bars and the twin needle VU meters (canvas)
     - the two BUBBLE TUBES (canvas), which also speed up with the music
     - the marquee's bulb chase speed (animation playbackRate)
     - the BASS PULSE across the monitor glass (one element's opacity)
     - the mirror-ball light spots

   Rules this file lives by:
     - Only transform / opacity / background-position animate; canvases
       are drawn from preallocated buffers (nothing is created per frame),
       so a three-hour night never grows memory.
     - The loop stops when the tab is hidden and when LIGHTS are CALM.
       (Music does NOT depend on this loop in any way.)
     - Photosensitive safety: every music-driven brightness change goes
       through an envelope AND a 340 ms beat gate (dsp.js), so nothing can
       flash faster than 3 times a second, and the pulse is a small
       brightness swell, never an on/off flash.
     - Every draw is wrapped: an error in one effect switches that effect
       off quietly instead of reaching the music.
   ============================================================ */
import { groupBands, rmsFromFloat, vuLevel, logoGlow, createEnvelope, createBeatDetector } from './dsp.js';
import { getEngine } from './audio.js';
import { isCalm, onCalmChange, safely } from './fx.js';
import { clamp } from './format.js';

const FRAME_MS = 1000 / 30;
const GLOW_REST = 0.14;
const GLOW_SWELL = 0.56;            // .14–.70 on translucent gradients, never an opaque flash
const BAR_COUNT = 36;
const SPECTRUM_TOP_HZ = 15000;      // the highest pitch the bars show (MP3s hold almost nothing above it)
const MAX_DPR = 1.5;

// Neon colours as plain numbers so canvas can use them (mirror the CSS tokens).
const COLORS = {
  magenta: [255, 45, 149],
  cyan: [37, 232, 226],
  cream: [255, 243, 222],
  red: [255, 84, 112],
  ink: [20, 7, 34],
  screen: [12, 5, 22],
};
const rgb = (c, a = 1) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t].map(Math.round);

// Slow colour journey for the bubble tubes: magenta -> violet -> cyan -> mauve -> back.
const TUBE_STOPS = [COLORS.magenta, [150, 90, 255], COLORS.cyan, [190, 100, 170]];
function tubeColor(seconds) {
  const period = 48;                                        // a full cycle takes 48 s
  const p = ((seconds % period) / period) * TUBE_STOPS.length;
  const i = Math.floor(p);
  return mix(TUBE_STOPS[i % TUBE_STOPS.length], TUBE_STOPS[(i + 1) % TUBE_STOPS.length], p - i);
}

function sizeCanvas(canvas) {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
  const w = Math.max(2, Math.round(rect.width * dpr));
  const h = Math.max(2, Math.round(rect.height * dpr));
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  return { ctx: canvas.getContext('2d'), w, h, dpr };
}

/* source: the crowd screen has no sound of its own, so it draws from levels
   sent by the control window (a function returning { levels, vuL, vuR }).
   tap: the control window hands each frame's levels to the crowd screen. */
export function createVisualiser({ source = null, tap = null } = {}) {
  const $ = (id) => document.getElementById(id);
  const engine = source ? null : getEngine();
  const freq = engine ? new Uint8Array(engine.analyser.frequencyBinCount) : new Uint8Array(0);
  const timeL = engine ? new Float32Array(engine.analyserL.fftSize) : new Float32Array(0);
  const timeR = engine ? new Float32Array(engine.analyserR.fftSize) : new Float32Array(0);
  const timeBass = engine ? new Float32Array(engine.beatAnalyser.fftSize) : new Float32Array(0);

  // ---- element handles
  const glow = $('cab-glow');
  const logoHalo = $('logo-halo');
  const reduceMotion = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)');
  const logoImg = $('marquee-logo');
  let logoLive = false;
  const spectrumCanvas = $('spectrum');
  const vuCanvases = [$('vu-l'), $('vu-r')];
  const tubeCanvases = [$('tube-l')?.querySelector('canvas'), $('tube-r')?.querySelector('canvas')];

  // ---- smoothing state
  const makeBassEnvelope = () => createEnvelope({ attackMs: 140, releaseMs: 420 });
  let bassEnv = makeBassEnvelope();
  const energyEnv = createEnvelope({ attackMs: 200, releaseMs: 900 });
  const vuEnv = [createEnvelope({ attackMs: 60, releaseMs: 300 }), createEnvelope({ attackMs: 60, releaseMs: 300 })];   // about a real VU's 300 ms
  const beat = createBeatDetector();                 // finds the kick in the bass-only signal, 340 ms apart at most
  let kickUntil = 0;
  const bars = new Float32Array(BAR_COUNT);
  const peaks = new Float32Array(BAR_COUNT);

  // ---- canvas pieces
  let spectrum = null;
  let vus = [];
  let tubes = [];
  let bubbleSeeds = [];

  function layout() {
    spectrum = spectrumCanvas ? sizeCanvas(spectrumCanvas) : null;
    vus = vuCanvases.map((c) => (c ? Object.assign(sizeCanvas(c), { face: null }) : null));
    vus.forEach((v) => { if (v) v.face = renderVuFace(v); });
    tubes = tubeCanvases.map((c) => (c ? sizeCanvas(c) : null));
    if (spectrum) {
      const g = spectrum.ctx.createLinearGradient(0, spectrum.h, 0, 0);
      g.addColorStop(0, rgb(COLORS.magenta));
      g.addColorStop(0.65, rgb(mix(COLORS.magenta, COLORS.cyan, 0.6)));
      g.addColorStop(1, rgb(COLORS.cyan));
      spectrum.gradient = g;
    }
    if (bubbleSeeds.length === 0) {
      bubbleSeeds = tubeCanvases.map(() => Array.from({ length: 16 }, () => ({
        x: 0.2 + Math.random() * 0.6,
        y: Math.random(),
        r: 0.8 + Math.random() * 1.9,
        v: 0.03 + Math.random() * 0.05,
        wobble: Math.random() * Math.PI * 2,
      })));
    }
  }

  /* ---------- VU meter ----------
     Geometry comes from the smaller of width and height, so the whole scale
     and the needle's pivot always sit INSIDE the window, whatever shape the
     layout gives the canvas. The pivot is a small cap just above the bottom
     edge; the scale is a 100-degree arc that fits both sides and the top. */
  function vuGeometry(w, h) {
    const pad = Math.min(w, h) * 0.08;
    const cx = w / 2;
    const cy = h - pad * 1.1;
    const sin50 = Math.sin((50 * Math.PI) / 180);
    const r = Math.max(4, Math.min((w / 2 - pad) / sin50, cy - pad - h * 0.06));
    return { cx, cy, r, pad };
  }

  function renderVuFace(v) {
    const off = document.createElement('canvas');
    off.width = v.w;
    off.height = v.h;
    const c = off.getContext('2d');
    const { w, h } = v;
    const { cx, cy, r } = vuGeometry(w, h);
    // warm, back-lit face - a touch dimmer than paper so it never glares
    const bg = c.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, '#DCCBA3');
    bg.addColorStop(1, '#B9A47A');
    c.fillStyle = bg;
    c.fillRect(0, 0, w, h);
    c.lineCap = 'round';
    for (let i = 0; i <= 20; i++) {
      const a = (-50 + (100 * i) / 20) * (Math.PI / 180);
      const inner = r * (i % 5 === 0 ? 0.78 : 0.87);
      c.strokeStyle = i >= 15 ? '#C2364A' : '#2A1B12';
      c.lineWidth = Math.max(1, r * (i % 5 === 0 ? 0.035 : 0.022));
      c.beginPath();
      c.moveTo(cx + Math.sin(a) * inner, cy - Math.cos(a) * inner);
      c.lineTo(cx + Math.sin(a) * r, cy - Math.cos(a) * r);
      c.stroke();
    }
    c.fillStyle = '#2A1B12';
    c.font = `700 ${Math.round(r * 0.22)}px "JetBrains Mono", monospace`;
    c.textAlign = 'center';
    c.fillText('VU', cx, cy - r * 0.42);
    // a soft shadow at the top edge, like the meter sits behind a bezel
    const shade = c.createLinearGradient(0, 0, 0, h * 0.25);
    shade.addColorStop(0, 'rgba(0,0,0,.28)');
    shade.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = shade;
    c.fillRect(0, 0, w, h * 0.25);
    return off;
  }

  function drawVu(v, level, side) {
    if (!v) return;
    const { ctx, w, h } = v;
    const { cx, cy, r, pad } = vuGeometry(w, h);
    ctx.drawImage(v.face, 0, 0);
    const angle = (-50 + 100 * clamp(level, 0, 1)) * (Math.PI / 180);
    ctx.strokeStyle = '#1A0F0A';
    ctx.lineWidth = Math.max(1.5, r * 0.03);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.sin(angle) * r * 0.97, cy - Math.cos(angle) * r * 0.97);
    ctx.stroke();
    ctx.fillStyle = '#1A0F0A';                     // the pivot cap
    ctx.beginPath();
    ctx.arc(cx, cy, Math.max(2, r * 0.07), 0, Math.PI * 2);
    ctx.fill();
    ctx.font = `700 ${Math.round(r * 0.18)}px "JetBrains Mono", monospace`;
    ctx.textAlign = side === 'L' ? 'left' : 'right';
    ctx.textBaseline = 'top';
    ctx.fillText(side, side === 'L' ? pad : w - pad, pad * 0.8);
    ctx.textBaseline = 'alphabetic';
  }

  /* ---------- spectrum ---------- */
  function drawSpectrum(levels, dt) {
    if (!spectrum) return;
    const { ctx, w, h, gradient } = spectrum;
    ctx.clearRect(0, 0, w, h);
    const gap = Math.max(1, w * 0.006);
    const bw = (w - gap * (BAR_COUNT - 1)) / BAR_COUNT;
    for (let i = 0; i < BAR_COUNT; i++) {
      const target = levels ? Math.pow(levels[i], 0.85) : 0.06;
      bars[i] = target > bars[i] ? target : Math.max(target, bars[i] - dt * 0.0016);
      peaks[i] = bars[i] > peaks[i] ? bars[i] : Math.max(bars[i], peaks[i] - dt * 0.0006);
      const x = i * (bw + gap);
      const bh = Math.max(2, bars[i] * h);
      ctx.globalAlpha = 0.82;                                  // a little under full brightness
      ctx.fillStyle = gradient;
      ctx.fillRect(x, h - bh, bw, bh);
      ctx.fillStyle = rgb(COLORS.cream, 0.8);                 // the peak cap
      ctx.fillRect(x, h - peaks[i] * h - 3 * spectrum.dpr, bw, 2 * spectrum.dpr);
      ctx.globalAlpha = 1;
    }
  }

  /* ---------- bubble tubes ---------- */
  function drawTube(t, index, seconds, speed) {
    if (!t) return;
    const { ctx, w, h } = t;
    const col = tubeColor(seconds + index * 12);
    ctx.clearRect(0, 0, w, h);
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, rgb(col, 0.05));
    g.addColorStop(1, rgb(col, 0.24));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    // a bright strip of glass highlight down the left side
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.fillRect(w * 0.14, 0, w * 0.1, h);
    const seeds = bubbleSeeds[index];
    for (const b of seeds) {
      b.y -= b.v * speed * (1 / 30);
      if (b.y < -0.05) { b.y = 1.05; b.x = 0.2 + Math.random() * 0.6; }
      const x = (b.x + Math.sin(seconds * 1.5 + b.wobble) * 0.06) * w;
      const y = b.y * h;
      const r = b.r * t.dpr * 1.6;
      ctx.fillStyle = rgb(COLORS.cream, 0.38);
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.fillRect(x - r * 0.35, y - r * 0.4, r * 0.4, r * 0.4);
    }
    return col;
  }

  // ---------- slow-changing CSS pieces ----------
  let animations = [];
  const collectAnimations = () => {
    animations = document.getAnimations().filter((a) => {
      const n = a.animationName;
      return n === 'bulb-chase';
    });
  };
  let lastRate = -1;
  let lastTubeCss = 0;
  function applySpeed(energy) {
    const rate = Math.round((0.7 + energy * 0.9) * 10) / 10;
    if (rate === lastRate) return;
    lastRate = rate;
    for (const a of animations) { try { a.playbackRate = rate; } catch { /* animation gone */ } }
  }

  // ---------- the frame ----------
  let rafId = 0;
  let lastFrame = 0;
  let t0 = performance.now();
  let running = false;
  let lastRateTick = 0;

  function frame(now) {
    rafId = requestAnimationFrame(frame);
    const dt = now - lastFrame;
    if (dt < FRAME_MS - 2) return;                  // 30 fps cap
    lastFrame = now;
    const step = Math.min(dt, 100);                 // never let a long pause create a jump
    const seconds = (now - t0) / 1000;

    // 1. listen
    let levels = null;
    let rmsL = 0;
    let rmsR = 0;
    let bassLevel = 0;
    if (engine) {
      engine.analyser.getByteFrequencyData(freq);
      engine.analyserL.getFloatTimeDomainData(timeL);
      engine.analyserR.getFloatTimeDomainData(timeR);
      levels = groupBands(freq, BAR_COUNT, { maxBin: SPECTRUM_TOP_HZ / (engine.ctx.sampleRate / engine.analyser.fftSize) });
      const gain = engine.musicBus.gain.value;
      rmsL = vuLevel(rmsFromFloat(timeL), gain);
      rmsR = vuLevel(rmsFromFloat(timeR), gain);
      engine.beatAnalyser.getFloatTimeDomainData(timeBass);
      bassLevel = rmsFromFloat(timeBass) / Math.max(gain, 0.05);          // the MUSIC slider divided back out
      if (tap) safely('tap', () => tap({ levels: Array.from(levels, (v) => Math.round(v * 1000) / 1000), vuL: rmsL, vuR: rmsR, bass: Math.round(bassLevel * 10000) / 10000 }));
    } else if (source) {
      const d = source();
      if (d && Array.isArray(d.levels)) { levels = d.levels; rmsL = d.vuL || 0; rmsR = d.vuR || 0; bassLevel = d.bass || 0; }
    }
    let total = 0;
    if (levels) {
      for (let i = 0; i < levels.length; i++) total += levels[i];
      total /= levels.length;
    }

    // 2. beat detection (bass only) -> gated, smoothed pulse
    if (beat.step(bassLevel, now, step)) kickUntil = now + 160;
    const pulse = bassEnv.step(now < kickUntil ? 1 : 0, step);
    const energy = energyEnv.step(total * 1.6, step);

    // 3. draw (each guarded)
    safely('spectrum', () => drawSpectrum(levels, step));
    safely('vu', () => {
      drawVu(vus[0], vuEnv[0].step(rmsL, step), 'L');
      drawVu(vus[1], vuEnv[1].step(rmsR, step), 'R');
    });
    let tubeCol = null;
    safely('tubes', () => {
      tubeCol = drawTube(tubes[0], 0, seconds, 1 + energy * 1.2);
      drawTube(tubes[1], 1, seconds, 1 + energy * 1.2);
    });

    // 4. a visible glass/edge swell across the whole cabinet (opacity only).
    // Beat only: raw loudness would add ripples outside the beat gate.
    if (glow) glow.style.opacity = (GLOW_REST + GLOW_SWELL * pulse).toFixed(3);
    safely('logo', () => driveLogo(pulse, energy));

    // 5. slower things, a few times a second
    if (now - lastRateTick > 140) {
      lastRateTick = now;
      applySpeed(energy);
      if (tubeCol && now - lastTubeCss > 1000) {
        lastTubeCss = now;
        document.documentElement.style.setProperty('--tube-glow', rgb(tubeCol, 0.3));
        document.documentElement.style.setProperty('--tube-col', rgb(tubeCol, 1));
      }
    }
  }

  function start() {
    if (running || isCalm() || document.hidden) return;
    running = true;
    layout();
    collectAnimations();
    lastFrame = 0;
    t0 = performance.now() - 1000 * 12;
    rafId = requestAnimationFrame(frame);
  }

  /* The logo answers the music: halo and a small swell on the beat. Hands back
     to the slow CSS breathing when the music stops (and in CALM). */
  function driveLogo(pulse, energy) {
    if (!logoHalo || !logoImg) return;
    const live = energy > 0.12 || pulse > 0.05;            // hands back to the slow breathing about 2 s after the music stops
    if (!live) { if (logoLive) clearLogo(); return; }
    const g = logoGlow(pulse);
    logoLive = true;
    logoHalo.dataset.live = '1';
    logoHalo.style.opacity = g.haloOpacity.toFixed(3);
    if (reduceMotion?.matches) return;                    // reduced motion: the glow answers, nothing swells
    logoHalo.style.transform = `scale(${g.haloScale.toFixed(3)})`;
    logoImg.style.transform = `scale(${g.logoScale.toFixed(3)})`;
  }
  function clearLogo() {
    logoLive = false;
    if (logoHalo) { delete logoHalo.dataset.live; logoHalo.style.opacity = ''; logoHalo.style.transform = ''; }
    if (logoImg) logoImg.style.transform = '';
  }

  function stop() {
    running = false;
    cancelAnimationFrame(rafId);
    kickUntil = 0;
    bassEnv = makeBassEnvelope();
    if (glow) glow.style.opacity = String(GLOW_REST);
    clearLogo();
  }

  /* CALM: draw each canvas once in a quiet, finished state. */
  function drawStill() {
    layout();
    bars.fill(0.08);
    peaks.fill(0.1);
    safely('still', () => {
      drawSpectrum(null, 0);
      drawVu(vus[0], 0.18, 'L');
      drawVu(vus[1], 0.18, 'R');
      drawTube(tubes[0], 0, 6, 0);
      drawTube(tubes[1], 1, 18, 0);
    });
    if (glow) glow.style.opacity = String(GLOW_REST);
    for (const a of animations) { try { a.playbackRate = 1; } catch { /* gone */ } }
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop();
    else if (!isCalm()) start();
  });

  let resizeTimer = 0;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { layout(); if (isCalm()) drawStill(); }, 150);
  });

  onCalmChange((calm) => {
    if (calm) { stop(); drawStill(); } else { start(); setTimeout(collectAnimations, 400); }
  });

  return {
    start() { if (isCalm()) drawStill(); else start(); },
    stop,
  };
}

/* ============================================================
   MIRROR BALL - soft spots of light drifting across the whole page.
   Pure CSS animation on a dozen small, fixed elements (transform only).
   Calm: the spots hold still at their starting places.
   ============================================================ */
export function buildMirrorLight(container, count = 7) {
  container.replaceChildren();
  for (let i = 0; i < count; i++) {
    const spot = document.createElement('i');
    const size = 9 + Math.random() * 11;                         // vmin
    spot.style.setProperty('--size', `${size.toFixed(1)}vmin`);
    spot.style.setProperty('--x', `${(Math.random() * 100).toFixed(1)}vw`);
    spot.style.setProperty('--y', `${(Math.random() * 100).toFixed(1)}vh`);
    spot.style.setProperty('--dx', `${((Math.random() - 0.5) * 70).toFixed(1)}vw`);
    spot.style.setProperty('--dy', `${((Math.random() - 0.5) * 50).toFixed(1)}vh`);
    spot.style.setProperty('--dur', `${(45 + Math.random() * 50).toFixed(1)}s`);
    spot.style.setProperty('--delay', `${(-Math.random() * 60).toFixed(1)}s`);
    spot.dataset.tone = i % 3 === 0 ? 'cyan' : i % 3 === 1 ? 'magenta' : 'cream';
    container.append(spot);
  }
}
