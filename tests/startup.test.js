import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { BEATS, supplyAt } from '../startup-timing.js';
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
  for (const [selector, response] of [['.cab-sign', RESPONSE.sign(standby)], ['.tv-picture', RESPONSE.picture(standby, 0)], ['.cab-arch', RESPONSE.chrome(standby)]]) {
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
