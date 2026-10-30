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
