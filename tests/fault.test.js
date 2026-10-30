import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { FAULT, FILM_FAULTS, faultMoments, faultsAllowed, nextDormantFault, startDormantFaults, stageFaults } from '../startup-fault.js';
import { planBreath, breathTroubles } from '../lights.js';
import { BEATS, supplyAt } from '../startup-timing.js';

const seeded = (seed) => () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
const css = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
const end = (ev) => ev.at + ev.coreMs + ev.decayMs;
const deadFrom = () => { for (let ms = BEATS.fail; ms < BEATS.catch; ms += 5) if (supplyAt(ms) === 0) return ms; return BEATS.fail; };

test('at rest the contact is dark: no glow, nothing lit until an animation lifts it', () => {
  for (const sel of ['.fault-arc', '.fault-light']) {
    assert.match(css, new RegExp(`\\n${sel.replace('.', '\\.')}\\{[^}]*opacity:0;`), `${sel} rests at 0`);
  }
  assert.match(css, /\.cab-fault\{[^}]*clip-path:inset\(-1em 0\.8em -1em -1em\)/, 'the filament is clipped at the silhouette');
});

test('dormant contacts are rare, irregular, never at load, and repeatable from a seed', () => {
  for (let s = 1; s <= 200; s++) {
    const plan = planBreath(seeded(s));
    const rng = seeded(s * 7);
    let phase = Math.floor(seeded(s + 3)() * plan.duration);
    const gaps = [];
    for (let n = 0; n < 12; n++) {
      const ev = nextDormantFault(plan, phase, rng);
      assert.ok(ev.inMs >= FAULT.minGapMs && ev.inMs <= FAULT.longGapMs, `gap ${ev.inMs}`);
      assert.ok(ev.coreMs >= 25 && ev.coreMs <= 60 && ev.decayMs >= 50 && ev.decayMs <= 110);
      assert.ok(ev.strength <= 0.55 && ev.variant >= 0 && ev.variant < FAULT.variants);
      gaps.push(ev.inMs);
      phase = (phase + ev.inMs) % plan.duration;
    }
    assert.ok(new Set(gaps).size > 6, 'not one gesture on a fixed beat');
  }
  const a = nextDormantFault(planBreath(seeded(4)), 1000, seeded(9));
  const b = nextDormantFault(planBreath(seeded(4)), 1000, seeded(9));
  assert.deepEqual(a, b, 'deterministic under a seeded RNG');
});

test('dormant contacts land on the robot\'s falters and recoveries when there are any', () => {
  let onFalter = 0;
  let total = 0;
  for (let s = 1; s <= 200; s++) {
    const plan = planBreath(seeded(s));
    const moments = faultMoments(plan).map((m) => m.ms);
    const ev = nextDormantFault(plan, 0, seeded(s + 50));
    if (!moments.length) continue;
    total++;
    if (moments.some((m) => ((ev.inMs - m) % plan.duration + plan.duration) % plan.duration < 1)) onFalter++;
    if (breathTroubles(plan).falters.length) assert.ok(faultMoments(plan).some((m) => m.weight === 3));
  }
  assert.ok(onFalter / total > 0.9, `contacts follow the breath (${onFalter}/${total})`);
});

test('the film: none in the coin, two as the first attempt fails, two as the second catches, none after', () => {
  const { relay, attempt, fail, tick, catch: caught, ignite } = BEATS;
  const dead = deadFrom();
  assert.equal(FILM_FAULTS.length, 4, 'four contacts across the whole film');
  for (const ev of FILM_FAULTS) {
    assert.ok(ev.at >= attempt, 'nothing during the coin or the relay');
    assert.ok(supplyAt(ev.at) >= FAULT.minSupply && supplyAt(end(ev)) > 0, 'only while there is supply to arc');
    assert.ok(end(ev) < dead || ev.at >= caught, 'every contact and its light are gone before the supply dies');
    assert.ok(!(ev.at < caught && end(ev) > dead), 'nothing crosses into the dark');
    assert.ok(end(ev) < ignite, 'all of it over before the machine locks');
    assert.ok(!(ev.at <= tick && end(ev) >= tick), 'the tick in the dark is alone');
    assert.ok(ev.strength <= FAULT.maxStrength);
  }
  assert.equal(FILM_FAULTS.filter((ev) => ev.at < fail + 380).length, 2, 'first attempt');
  assert.equal(FILM_FAULTS.filter((ev) => ev.at >= caught).length, 2, 'second attempt');
  for (let n = 1; n < FILM_FAULTS.length; n++) assert.ok(FILM_FAULTS[n].at - end(FILM_FAULTS[n - 1]) >= 500, 'well apart');
  assert.ok(relay < attempt && dead > fail && dead < caught, 'the beats it is built on');
  const src = readFileSync(new URL('../startup-fault.js', import.meta.url), 'utf8');
  assert.match(src, /\[attempt \+ \d+,/, 'placed on BEATS, not absolute times');
  assert.doesNotMatch(src.slice(src.indexOf('const AUTHORED'), src.indexOf('export const FILM_FAULTS')), /\[\d{4},/);
});

test('reduced motion and calm lights: no contacts at all', () => {
  const doc = (lights) => ({ documentElement: { dataset: { lights } } });
  const media = (reduce) => () => ({ matches: reduce });
  assert.equal(faultsAllowed(doc('full'), media(false)), true);
  assert.equal(faultsAllowed(doc('full'), media(true)), false);
  assert.equal(faultsAllowed(doc('calm'), media(false)), false);
  assert.match(css, /html\[data-lights="calm"\] \.cab-fault, html\[data-lights="calm"\] \.fault-light\{ display:none; \}/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)\{ \.cab-fault, \.fault-light\{ display:none; \} \}/);
});

/* A stand-in page for the runtime: elements that record their animations. */
function fakePage(t, { reduce = false, lights = 'full' } = {}) {
  try { t.mock.timers.enable({ apis: ['setTimeout'] }); } catch { /* already on in this test */ }
  const listeners = new Map();
  const anims = [];
  const element = () => ({ animate(frames, opts) { const a = { frames, opts, cancelled: false, cancel() { this.cancelled = true; } }; anims.push(a); return a; } });
  globalThis.document = {
    hidden: false, documentElement: { dataset: { lights } },
    addEventListener: (type, fn) => listeners.set(type, fn), removeEventListener: (type) => listeners.delete(type),
  };
  globalThis.matchMedia = () => ({ matches: reduce });
  t.after(() => { delete globalThis.document; delete globalThis.matchMedia; });
  return { el: { arcs: [element(), element(), element()], light: element() }, anims, listeners };
}

test('dormant runtime: one timer, a contact at a time, and stop() leaves it dark and quiet', (t) => {
  const { el, anims, listeners } = fakePage(t);
  const plan = planBreath(seeded(12));
  const faults = startDormantFaults(el, { plan, phase: () => 0 });
  t.mock.timers.tick(FAULT.minGapMs - 1);
  assert.equal(anims.length, 0, 'nothing at load');
  t.mock.timers.tick(FAULT.longGapMs);
  assert.ok(anims.length >= 2 && anims.length <= 4, 'one contact (filament and its light), maybe two');
  for (const a of anims) assert.equal(a.frames.at(-1).opacity, 0, 'every contact ends dark');
  listeners.get('visibilitychange')();                          // still visible: re-arms, no stale flash
  document.hidden = true;
  listeners.get('visibilitychange')();
  assert.ok(anims.every((a) => a.cancelled), 'hidden: whatever was lit is gone');
  const before = anims.length;
  t.mock.timers.tick(FAULT.longGapMs * 3);
  assert.equal(anims.length, before, 'and nothing fires behind a hidden tab');
  document.hidden = false;
  listeners.get('visibilitychange')();
  faults.stop();
  assert.ok(!listeners.has('visibilitychange'), 'its listener removed');
  t.mock.timers.tick(FAULT.longGapMs * 3);
  assert.equal(anims.length, before, 'no contact after the coin');
});

test('the film stages its contacts only when allowed, each one ending dark', (t) => {
  const { el, anims } = fakePage(t);
  stageFaults(el);
  assert.equal(anims.length, FILM_FAULTS.length * 2);
  for (const a of anims) {
    assert.equal(a.frames.at(-1).opacity, 0);
    assert.equal(a.opts.fill, undefined, 'no fill: at rest it is the CSS, dark');
    assert.ok(FILM_FAULTS.some((ev) => ev.at === a.opts.delay), 'on the film\'s clock, from the press');
  }
  const calm = fakePage(t, { lights: 'calm' });
  assert.deepEqual(stageFaults(calm.el), []);
  const still = fakePage(t, { reduce: true });
  assert.deepEqual(stageFaults(still.el), []);
  assert.equal(still.anims.length, 0);
  const dormant = startDormantFaults(still.el, { plan: planBreath(seeded(1)), phase: () => 0 });
  t.mock.timers.tick(FAULT.longGapMs * 2);
  assert.equal(still.anims.length, 0, 'reduced motion: none while it waits either');
  dormant.stop();
});

test('wired in: dormant contacts stop at the press, the film\'s run with the rest, offline too', () => {
  const startup = readFileSync(new URL('../startup.js', import.meta.url), 'utf8');
  const insert = startup.slice(startup.indexOf('async function insert'));
  assert.ok(insert.indexOf('faults.stop()') < insert.indexOf("classList.add('is-inserting')"), 'quiet before the film starts');
  assert.match(startup, /stageFaults\(el\.fault\)/);
  assert.doesNotMatch(startup.slice(startup.indexOf('function stageGently')), /stageFaults/, 'the gentle film has none');
  assert.match(readFileSync(new URL('../sw.js', import.meta.url), 'utf8'), /'startup-fault\.js'/);
});
