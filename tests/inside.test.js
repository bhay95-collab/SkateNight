import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { BEATS, BEAT_MS, EXTENDED, LOCK_BEATS, STORE_EXTENDED, supplyAt, timeline, wantsExtended } from '../startup-timing.js';
import { SHAFT, depthAt } from '../startup-inside.js';

const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const ext = timeline(true);
const std = timeline(false);

test('the extended cut is the default: TOOLS turns it off, ?cut= compares, never with reduced motion', () => {
  const page = { browser: true, reduced: false, search: '', stored: null };
  assert.equal(wantsExtended(page), true, 'a fresh laptop plays the extended cut');
  assert.equal(wantsExtended({ ...page, stored: '1' }), true);
  assert.equal(wantsExtended({ ...page, stored: '0' }), false, 'the operator chose the standard cut');
  assert.equal(wantsExtended({ ...page, search: '?cut=standard' }), false, 'a comparison link wins');
  assert.equal(wantsExtended({ ...page, stored: '0', search: '?hum&cut=extended' }), true);
  assert.equal(wantsExtended({ ...page, reduced: true }), false, 'never with reduced motion');
  assert.equal(wantsExtended({ ...page, reduced: true, search: '?cut=extended' }), false, 'not even when asked');
  assert.equal(EXTENDED, false, 'outside a page (these tests) the standard cut is timed');
  assert.deepEqual(std.BEATS, BEATS, 'and the standard cut is exactly the film as it was');
  assert.equal(STORE_EXTENDED, 'sn-extended-cut');
  assert.match(read('index.html'), /<input type="checkbox" id="extended-cut" checked> Extended cut \(Bigger on the Inside\)/);
  assert.match(read('app.js'), /localStorage\.setItem\(STORE_EXTENDED, extendedSetting\.checked \? '1' : '0'\)/);
  assert.match(read('startup.js'), /if \(EXTENDED\) stageInside\(buildInside\(/);
  assert.match(read('sw.js'), /'startup-inside\.js'/, 'cached for offline');
});

test('its story: the dive, a three-second fall, the box, the same tries, a longer rise, out through the screen', () => {
  const B = ext.BEATS;
  const times = Object.entries(B).filter(([k]) => k !== 'end').map(([, v]) => v);
  assert.deepEqual(['look', 'coinIn', 'gone', 'inside', 'credit', 'relay'].map((k) => B[k]), ['look', 'coinIn', 'gone', 'inside', 'credit', 'relay'].map((k) => B[k]).sort((a, b) => a - b));
  assert.ok(times.every((v) => v >= 0 && v <= B.cut));
  assert.equal(B.gone, std.BEATS.gone, 'identical until the coin is swallowed');
  assert.ok(B.credit - B.inside >= 2900, 'about three seconds falling with the coin');
  assert.ok(ext.CHUTE_CLINKS_MS.every((ms) => B.gone + ms < B.credit), 'every clink before it lands');
  const shift = B.relay - std.BEATS.relay;
  for (const k of ['attempt', 'almost', 'fail']) assert.equal(B[k] - std.BEATS[k], shift, `${k}: the first try unchanged, just later`);
  assert.equal(B.catch - B.fail, std.BEATS.catch - std.BEATS.fail, 'the same 1.8 s of dark');
  assert.ok(B.ignite - B.catch > std.BEATS.ignite - std.BEATS.catch, 'a longer rise on the heartbeat');
  assert.ok(B.catch < B.surface && B.surface < B.through && B.through < B.ignite, 'the surface, then through, then the lock');
  const gaps = ext.PULSE.heartbeat.slice(1).map((ms, n) => ms - ext.PULSE.heartbeat[n]);
  assert.ok(gaps.every((g, n) => n === 0 || g < gaps[n - 1]), 'the heartbeat still quickens');
  assert.ok(Math.abs(B.ignite - ext.PULSE.heartbeat.at(-1) - BEAT_MS) < 0.1, 'into the lock, on the song\'s tempo');
  assert.equal(ext.PULSE.lock.length, LOCK_BEATS);
  assert.equal(B.cut, ext.PULSE.lock.at(-1), 'the cut on the last beat, as ever');
  assert.ok(B.cut < 19000, `about eighteen seconds in all (${B.cut})`);
});

test('the camera inside: falls with the coin, lands, waits through the tries, and rises to the screen', () => {
  const B = ext.BEATS;
  assert.equal(depthAt(B.inside, B), 0);
  for (let ms = B.inside; ms < B.credit; ms += 50) assert.ok(depthAt(ms + 50, B) >= depthAt(ms, B), 'only ever down while it falls');
  assert.ok(Math.abs(depthAt(B.credit, B) - SHAFT.bottom) < 1e-9, 'at the box when the coin lands');
  for (let ms = B.relay; ms <= B.catch + 250; ms += 100) assert.equal(depthAt(ms, B), SHAFT.bottom, 'still through the first try and the dark');
  for (let ms = B.catch + 250; ms < B.surface; ms += 50) assert.ok(depthAt(ms + 50, B) <= depthAt(ms, B), 'only ever up as it rises');
  assert.ok(Math.abs(depthAt(B.surface, B) - SHAFT.top) < 1e-9, 'at the back of the screen');
});

test('the extended cut keeps the flash budget: the supply still struggles in at most two flashes a second', () => {
  const at = (ms) => supplyAt(ms, ext.SUPPLY);
  const legs = [];
  let dir = 0;
  let extreme = at(0);
  let extremeAt = 0;
  for (let ms = 0; ms <= ext.BEATS.end; ms += 5) {
    const v = at(ms);
    if (dir === 0) { if (Math.abs(v - at(0)) >= 0.1) { dir = Math.sign(v - at(0)); extreme = v; extremeAt = ms; } } else if ((v - extreme) * dir > 0) { extreme = v; extremeAt = ms; } else if ((extreme - v) * dir >= 0.1) { legs.push(extremeAt); dir = -dir; extreme = v; extremeAt = ms; }
  }
  for (const start of legs) assert.ok(legs.filter((ms) => ms >= start && ms < start + 1000).length <= 4, `from ${start} ms`);
  const inside = read('startup-inside.js');
  assert.match(inside, /opacity: 1, offset: inAt \/ end \}/, 'the dive into black is one fade');
  assert.doesNotMatch(read('styles.css').match(/\.in-[\s\S]*?\.in-above\{[^}]*\}/)?.[0] ?? '', /infinite[^;]*\b0?\.\d+s\b/, 'no fast repeating animation inside');
});
