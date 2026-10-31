import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createDrone, voiceAt, AFTER_PRESS, DONE_MS, DRONE } from '../drone.js';
import { planBreath, breathLevelAt, breathTroubles, BREATH } from '../lights.js';
import { BEATS } from '../startup-timing.js';

/* Just enough Web Audio to watch what the drone schedules. */
class Param {
  constructor(v = 0) { this.value = v; this.events = []; }
  setValueAtTime(v, t) { this.events.push(['set', v, t]); }
  linearRampToValueAtTime(v, t) { this.events.push(['lin', v, t]); }
  exponentialRampToValueAtTime(v, t) { this.events.push(['exp', v, t]); }
  cancelScheduledValues(t) { this.events = this.events.filter((e) => e[2] < t); }
  cancelAndHoldAtTime(t) { this.events = this.events.filter((e) => e[2] <= t); this.events.push(['hold', null, t]); }
  last() { return this.events.at(-1); }
}
function fakeContext() {
  const ctx = { currentTime: 0, sampleRate: 44100, nodes: [], sources: [] };
  const node = (extra = {}) => {
    const n = { connected: new Set(), disconnected: false, ...extra,
      connect(to) { this.connected.add(to); return to instanceof Param ? undefined : to; },
      disconnect() { this.connected.clear(); this.disconnected = true; } };
    ctx.nodes.push(n);
    return n;
  };
  const source = (extra) => {
    const s = node({ started: false, stopped: false, start() { this.started = true; }, stop() { this.stopped = true; }, ...extra });
    ctx.sources.push(s);
    return s;
  };
  Object.assign(ctx, {
    createGain: () => node({ gain: new Param(1) }),
    createOscillator: () => source({ type: 'sine', frequency: new Param(440), detune: new Param(0) }),
    createBiquadFilter: () => node({ type: 'lowpass', frequency: new Param(350), Q: new Param(1) }),
    createDelay: () => node({ delayTime: new Param(0) }),
    createStereoPanner: () => node({ pan: new Param(0) }),
    createBufferSource: () => source({ buffer: null, loop: false }),
    createBuffer: (ch, len) => ({ getChannelData: () => new Float32Array(len) }),
  });
  return ctx;
}
const setup = (t, breath) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const ctx = fakeContext();
  const sfxBus = { name: 'sfx' };
  const drone = createDrone({ ctx, sfxBus }, breath);
  const out = ctx.nodes.find((n) => n.connected.has(sfxBus));
  return { ctx, drone, out };
};
const seeded = (seed) => () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };

test('the breath the drone hears is the breath on the screen', () => {
  const plan = planBreath(seeded(3));
  for (const k of plan.keyframes) assert.ok(Math.abs(breathLevelAt(plan, k.offset * plan.duration) - k.level) < 1e-6, 'at every keyframe');
  assert.ok(Math.abs(breathLevelAt(plan, plan.duration + 10) - breathLevelAt(plan, 10)) < 1e-9, 'it loops');
  let falters = 0;
  for (let i = 0; i < 50; i++) falters += breathTroubles(planBreath(seeded(i + 1))).falters.length;
  assert.ok(falters > 0, 'falters are found for the drone to stumble with');
  assert.ok(falters <= 50 * BREATH.breaths, 'at most one a breath');
});

test('brighter robot, more harmonics: every layer moves the right way with the breath', () => {
  for (let l = 0; l < 0.85; l += 0.1) {
    const [a, b] = [voiceAt(l), voiceAt(l + 0.1)];
    assert.ok(b.breath > a.breath && b.cutoff > a.cutoff && b.ghost > a.ghost && b.whine > a.whine, 'up with the light');
    assert.ok(b.hiss < a.hiss, 'the hiss thins, as the static does');
  }
  assert.ok(voiceAt(0).breath >= 0.5, 'it never stops breathing altogether');
});

test('it rises out of silence and never clicks on', (t) => {
  const { drone, out } = setup(t, {});
  assert.equal(out.gain.value, 0);
  drone.start();
  const [kind, level, at] = out.gain.last();
  assert.equal(kind, 'lin');
  assert.ok(Math.abs(level - DRONE.level) < 1e-9 && Math.abs(at - DRONE.fadeInS) < 1e-9, 'a slow fade in');
  assert.ok(!out.gain.events.some(([k, v]) => k === 'set' && v > 0), 'no step up to a level');
  drone.stop();
});

test('it is drawn from the screen\'s own phase, a little behind the light', (t) => {
  const plan = planBreath(seeded(9));
  const { ctx, drone } = setup(t, { plan, phase: () => 1234 });
  drone.start();
  const filter = ctx.nodes.find((n) => n.type === 'lowpass' && n.Q?.value > 2);
  const first = filter.frequency.events.find(([k]) => k === 'lin');
  const ms = 1234 + first[2] * 1000 - DRONE.lagS * 1000;
  assert.ok(Math.abs(first[1] - voiceAt(breathLevelAt(plan, ms)).cutoff) < 1e-6);
  drone.stop();
});

test('the press: it holds its breath - every layer silent in 150 ms, the drone let go, nothing after', (t) => {
  for (const [layer, pts] of Object.entries(AFTER_PRESS)) {
    assert.deepEqual(pts[0], [0, 1], `${layer} starts where it was`);
    assert.deepEqual(pts.at(-1), [150, 0], `${layer} is silent by 150 ms`);
  }
  assert.ok(DONE_MS < BEATS.coinIn + 400, 'gone before the coin has swung into shot');
  assert.ok(DONE_MS < BEATS.catch, 'nothing of it is left for the heartbeat');

  const { ctx, drone, out } = setup(t, { plan: planBreath(seeded(5)), phase: () => 0 });
  drone.start();
  ctx.currentTime = 30;
  drone.awaken();
  const latest = Math.max(...ctx.nodes.flatMap((n) => Object.values(n).filter((v) => v instanceof Param).flatMap((p) => p.events.map((e) => e[2]))));
  assert.ok(latest <= 30 + 0.15 + 1e-9, `nothing is scheduled past the held breath (${latest.toFixed(3)})`);
  assert.equal(drone.state, 'awake');
  t.mock.timers.tick(DONE_MS + 400);
  assert.ok(ctx.sources.every((s) => s.stopped), 'every oscillator and noise source stopped');
  assert.ok(ctx.nodes.every((n) => n.disconnected), 'and the whole graph let go');
  assert.equal(out.disconnected, true);
});

test('unarmed, the press is silent: nothing sounds, and it is let go', (t) => {
  const { ctx, drone, out } = setup(t, {});
  ctx.currentTime = 5;
  drone.awaken();
  assert.ok(!out.gain.events.some(([k, v]) => k === 'lin' && v > 0), 'no fade in: the dormant cabinet was silent and stays so');
  t.mock.timers.tick(DONE_MS + 400);
  assert.ok(ctx.sources.every((s) => s.stopped));
});

test('a hidden tab falls silent and picks the breath up again; disarming fades and lets go', (t) => {
  const { ctx, drone, out } = setup(t, { plan: planBreath(seeded(2)), phase: () => 500 });
  assert.equal(drone.sounding, false, 'built is not sounding');
  drone.start();
  assert.equal(drone.sounding, true);
  ctx.currentTime = 20;
  drone.setVisible(false);
  assert.deepEqual(out.gain.last().slice(0, 2), ['lin', 0]);
  ctx.currentTime = 40;
  drone.setVisible(true);
  assert.equal(out.gain.last()[1], DRONE.level);
  drone.stop();
  assert.deepEqual(out.gain.last().slice(0, 2), ['lin', 0]);
  assert.ok(!ctx.sources.some((s) => s.stopped), 'it fades before it stops');
  t.mock.timers.tick(DRONE.fadeOutS * 1000 + 300);
  assert.ok(ctx.sources.every((s) => s.stopped));
  drone.start();
  assert.equal(drone.state, 'gone', 'a stopped drone stays stopped');
});

test('the operator arms it; the public screen shows nothing new', () => {
  const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const keys = app.slice(app.indexOf("window.addEventListener('keydown', (e) => {\n    if (started || attractScreen.hidden) return;"));
  assert.ok(keys.indexOf("e.code === 'KeyD' && e.altKey && e.shiftKey") < keys.indexOf('startNight();'), 'Alt+Shift+D is caught before it can start the night');
  assert.match(app, /lift: \(\) => \{ play\('lift'\); safely\('drone', wakeDrone\); \}/, 'the coin hands the drone to the film');
  assert.match(app, /visibilitychange', \(\) => drone\?\.setVisible/);
  assert.doesNotMatch(html, /drone|Alt\+Shift/i, 'no control or hint on the page');
  assert.match(app, /new URLSearchParams\(location\.search\)\.has\('hum'\)/, '?hum lets a tap arm it, for phones and tablets');
  const click = app.slice(app.indexOf("attractScreen.addEventListener('click'"));
  assert.ok(click.indexOf('armByPress()') < click.indexOf('startNight()'), 'with ?hum the first press arms the hum, not the coin');
  assert.match(click, /performance\.now\(\) - armedAt < 700/, 'and the click that follows Space or Enter is the same press');
  assert.match(keys, /if \(armByPress\(\)\) return;\n    startNight\(\);/);
  assert.match(app, /let humFirst = new URLSearchParams\(location\.search\)\.has\('hum'\) \|\| rememberedDrone;/,
    'a remembered hum the browser has not let play yet is armed by the first press, not lost to the coin');
  assert.match(app, /if \(!humFirst \|\| drone\?\.sounding\)/, 'only a hum already sounding lets the first press be the coin');
  assert.match(app, /safely\('drone', armDrone\)/, 'the first press arms; it never toggles a silent hum off');
  assert.match(readFileSync(new URL('../audio.js', import.meta.url), 'utf8'), /navigator\.audioSession\.type = 'playback'/, 'iPhone: plays through the silent switch');
  assert.match(readFileSync(new URL('../sw.js', import.meta.url), 'utf8'), /'drone\.js'/, 'it works offline too');
});
