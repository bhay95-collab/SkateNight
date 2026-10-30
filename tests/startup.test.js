import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { BEATS, STANDBY, supplyAt } from '../startup-timing.js';
import { RESPONSE, tubeSchedule } from '../startup-power.js';

test('the neon tubes catch through phase B and the dead ones last, at ignition', () => {
  const dead = new Set([3, 8]);
  const plan = tubeSchedule(10, dead);
  assert.equal(plan.size, 10, 'every tube strikes');
  for (const [i, { at }] of plan) {
    if (dead.has(i)) assert.ok(at >= BEATS.ignite, `dead tube ${i} catches only when the supply locks`);
    else assert.ok(at > BEATS.catch && at < BEATS.ignite, `tube ${i} strikes while the supply climbs`);
  }
});

/* brightness and saturate out of a CSS filter, e.g. "brightness(.55) saturate(.55)". */
const levels = (filter) => ['brightness', 'saturate'].map((fn) => Number(filter.match(new RegExp(`${fn}\\(([\\d.]+)\\)`))?.[1] ?? 1));

test('the dormant cabinet in styles.css is the cabinet on standby supply', () => {
  const css = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
  const cssFilter = (selector) => css.match(new RegExp(`\\n${selector.replace('.', '\\.')}\\{[^}]*?filter:([^;]+);`))?.[1] ?? '';
  const standby = supplyAt(0);
  for (const [selector, response] of [['.cab-sign', RESPONSE.sign(standby)], ['.tv-picture', RESPONSE.picture(standby, 0)], ['.cab-arch', RESPONSE.chrome(standby)],
    ['.cab-body', RESPONSE.body(standby)], ['.cab-door', RESPONSE.door(standby)]]) {
    const [b, s] = levels(cssFilter(selector));
    const [vb, vs] = levels(response.filter);
    assert.ok(Math.abs(b - vb) < 0.01 && Math.abs(s - vs) < 0.01, `${selector}: CSS ${b}/${s} vs standby ${vb}/${vs}`);
  }
  assert.equal(RESPONSE.room(standby).opacity, 0, 'the room only lights once the cabinet is awake');
});

test('the film keeps its story: a failed first try, a real silence, and a held, lit machine', () => {
  const { relay, attempt, almost, fail, tick, catch: caught, ignite, surge } = BEATS;
  assert.ok(supplyAt(relay + 100) < 0.05, 'the relay cuts the standby supply');
  assert.ok(supplyAt(almost) >= 0.5 && supplyAt(almost) < 0.84, 'the first try nearly reaches running, and no more');
  assert.ok(attempt < almost && almost < fail, 'it gathers, nearly holds, then fails');
  const dark = [];
  for (let ms = fail; ms <= caught; ms += 10) if (supplyAt(ms) < 0.05) dark.push(ms);
  assert.ok(dark.length && dark.at(-1) - dark[0] >= 500, 'at least half a second of real dark before the second try');
  assert.ok(tick > dark[0] && tick < caught, 'the tick lands in the dark');
  for (let ms = ignite + 420; ms <= surge; ms += 50) assert.ok(supplyAt(ms) >= 1, 'the lit machine holds steady');
  assert.ok(surge - ignite >= 1500, 'the lit machine gets its moment before the dive');
});

test('the dormant attract scene is intentionally dark and instruction-free', () => {
  const css = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
  assert.match(css, /attract:not\(\.is-powered\)[\s\S]*?\.cab-sign[\s\S]*?opacity:\s*0/,
    'the sign is hidden before the cabinet wakes');
  assert.match(css, /attract:not\(\.is-inserting\)[\s\S]*?\.door-text[\s\S]*?opacity:\s*0/,
    'the coin prompt and price stay out of the dark first frame');
  assert.match(css, /attract:not\(\.is-powered\)[\s\S]*?\.attract-logo[\s\S]*?opacity:\s*0/,
    'the CRT logo stays off until the coin goes in');
});

test('the dormant room is blacked out so the screen is the only light', () => {
  const css = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
  const opacity = (selector) => Number(css.match(new RegExp(`\\n${selector.replace(/\./g, '\\.')}{[^}]*?opacity:([\\d.]+)`))?.[1]);
  assert.ok(opacity('.attract-beam') <= 0.12, 'the room beam should be nearly swallowed by darkness');
  assert.equal(opacity('.attract-floor'), 0, 'the floor should remain blacked out on standby');
  assert.ok(css.includes('linear-gradient(180deg, #030209, #010103 62%, #000000)'), 'the room should fall fully to black on standby');
});

test('the dormant cabinet is the darkest moment: only the picture tube is really lit', () => {
  const css = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
  const opacity = (selector) => Number(css.match(new RegExp(`\\n${selector.replace(/\./g, '\\.')}\\{[^}]*?opacity:([\\d.]+)`))?.[1]);
  assert.equal(supplyAt(0), STANDBY);
  assert.equal(RESPONSE.lamp(STANDBY).opacity, 0, 'the coin lamp is dark until someone touches the machine');
  assert.equal(opacity('.mech-glow'), 0);
  assert.equal(RESPONSE.tubes(STANDBY).opacity, 0, 'the bubble tubes are cold');
  assert.equal(opacity('.cab-tube i'), 0);
  assert.equal(opacity('.cab-spill'), RESPONSE.spill(STANDBY).opacity, 'the tube light on the cabinet is the standby response');
  assert.equal(opacity('.attract-grain'), Number(RESPONSE.static(STANDBY).opacity.toFixed(2)));
  const [sign] = levels(RESPONSE.sign(STANDBY).filter);
  const [lit] = levels(RESPONSE.sign(1).filter);
  assert.ok(sign < lit / 10, 'the sign is barely there next to the lit machine');
  for (const v of [1, 1.14]) assert.ok(Math.abs(levels(RESPONSE.door(v).filter)[0] - (1 + 0.3 * (v - 0.5))) < 0.01, 'the lit door is as bright as ever');
});

test('the dormant picture tube is a real light: a glowing, snowy raster the rest of the dark falls away from', () => {
  const [picture] = levels(RESPONSE.picture(STANDBY, 0).filter);
  assert.ok(picture >= 0.35, `the tube glows on standby (${picture})`);
  assert.ok(RESPONSE.static(STANDBY).opacity >= 0.3, 'no signal: the glow is snow');
  assert.ok(RESPONSE.static(1).opacity <= 0.05, 'the snow clears once the picture locks');
  assert.ok(levels(RESPONSE.picture(0.03, 0).filter)[0] < 0.02, 'the relay still kills the tube');
  for (const v of [1, 1.14]) assert.ok(Math.abs(levels(RESPONSE.picture(v, 0).filter)[0] - (v - 0.06) * 1.18) < 0.01, 'the lit picture is unchanged');
});
