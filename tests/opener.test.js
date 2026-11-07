import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { OPENER, OPENING_IDS, UPBEAT_IDS, arrivalPlan, openingOrder } from '../rotation.js';

const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const seeded = (seed) => () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };

test('the opener is mapped from the music: the reveal is bar 2, one complete bar after the groove begins', () => {
  assert.equal(OPENER.id, 'praise-lifted-on-high');
  assert.ok(OPENING_IDS.includes(OPENER.id), 'it is one of the night\'s opening songs');
  assert.ok(Math.abs(60 / OPENER.beat - 134.4) < 0.1, '134.4 BPM, measured (not the earlier 136 estimate)');
  assert.ok(OPENER.firstHit < OPENER.bar1, 'the free first hit comes before bar 1');
  assert.ok(Math.abs(OPENER.revealAt - (OPENER.bar1 + 4 * OPENER.beat)) < 1e-9, 'exactly four beats after bar 1');
  assert.ok(Math.abs(OPENER.revealAt - 3.584) < 0.001);
  assert.ok(Object.isFrozen(OPENER));
  assert.match(read('tracks.js'), /id: 'praise-lifted-on-high'/, 'the song is in the catalogue');
});

test('the hand-over: the new cut by default, the old path kept whole behind the setting', () => {
  const next = OPENER.id;
  assert.deepEqual(arrivalPlan({ autoMusic: true, firstBoot: true, nextId: next, openerPlayed: false }), { diagnostics: false, music: 'opener' },
    'first Awakening: no diagnostics, the opener lands the reveal');
  assert.deepEqual(arrivalPlan({ autoMusic: true, firstBoot: false, nextId: next, openerPlayed: true }), { diagnostics: false, music: 'house' },
    'after a reload: no repeat of the opener, the next song starts');
  assert.deepEqual(arrivalPlan({ autoMusic: true, firstBoot: true, nextId: 'come-unto-me', openerPlayed: false }), { diagnostics: false, music: 'house' },
    'opener missing or not first: the next song starts the normal way');
  assert.deepEqual(arrivalPlan({ autoMusic: true, firstBoot: true, nextId: null, openerPlayed: false }), { diagnostics: false, music: 'none' },
    'nothing playable: the jukebox is revealed, silent');
  assert.deepEqual(arrivalPlan({ autoMusic: false, firstBoot: true, nextId: next, openerPlayed: false }), { diagnostics: true, music: 'none' },
    'setting off: diagnostics and START exactly as before');
  assert.deepEqual(arrivalPlan({ autoMusic: false, firstBoot: false, nextId: next, openerPlayed: false }), { diagnostics: false, music: 'none' });
});

test('the opening order: the opener first when it will land the reveal, the rest still shuffled', () => {
  for (let s = 1; s < 30; s++) {
    const order = openingOrder(OPENING_IDS, { lead: OPENER.id, rng: seeded(s) });
    assert.equal(order[0], OPENER.id);
    assert.deepEqual([...order].sort(), [...OPENING_IDS].sort(), 'every opening song, once');
  }
  const plain = openingOrder(OPENING_IDS, { rng: seeded(3) });
  assert.deepEqual([...plain].sort(), [...OPENING_IDS].sort());
  assert.deepEqual(openingOrder(OPENING_IDS, { lead: 'not-a-song', rng: seeded(3) }), plain, 'an unknown lead changes nothing');
});

test('the upbeat five come next, shuffled, then the rest shuffled', () => {
  assert.equal(UPBEAT_IDS.length, 5);
  for (const id of UPBEAT_IDS) assert.ok(OPENING_IDS.includes(id), `${id} is an opening song`);
  const firsts = new Set();
  for (let s = 1; s < 60; s++) {
    const led = openingOrder(OPENING_IDS, { lead: OPENER.id, rng: seeded(s) });
    assert.equal(led[0], OPENER.id);
    assert.deepEqual(led.slice(1, 6).sort(), [...UPBEAT_IDS].sort(), 'songs 2-6 are the upbeat five');
    assert.deepEqual([...led].sort(), [...OPENING_IDS].sort(), 'every opening song, once');
    const plain = openingOrder(OPENING_IDS, { rng: seeded(s) });
    assert.deepEqual(plain.slice(0, 5).sort(), [...UPBEAT_IDS].sort(), 'no opener: songs 1-5 are the upbeat five');
    assert.deepEqual([...plain].sort(), [...OPENING_IDS].sort());
  }
  for (let i = 0; i < 400; i++) firsts.add(openingOrder(OPENING_IDS, { lead: OPENER.id })[1]);
  assert.equal(firsts.size, 5, 'each upbeat song gets a turn straight after the opener');
});

test('wired in: cued at the press, started in the dark, revealed by the song\'s own clock', () => {
  const app = read('app.js');
  const land = app.slice(app.indexOf('async function landOpener'), app.indexOf('/* Change to a chosen song right now'));
  assert.match(land, /startAudio\(id, token, \{ leadInMs: 0, fadeInMs: 0, needle: false \}\)/, 'no crackle, no needle drop on the opener');
  assert.match(land, /mech\.showPlaying\(/, 'the record is already playing when the light lands');
  assert.match(land, /player\.currentTrackId === id && player\.currentTime >= at - frame \/ 2000/, 'the picture follows the sound, on the nearest frame');
  assert.match(land, /reveal\.at \+ \(getEngine\(\)\?\.ctx\.outputLatency \|\| 0\) \+ REVEAL_OFFSET_MS \/ 1000/, 'allowing for output latency and a venue calibration');
  assert.match(land, /setTimeout\(finish, \(reveal\.at \+ 2\.5\) \* 1000\)/, 'a fail-safe if the song cannot start');
  const power = app.slice(app.indexOf('async function powerOn'), app.indexOf('async function startNight'));
  assert.match(power, /player\.cue\(trackById\.get\(OPENER\.id\)\)/, 'cued at the press, ready long before it plays');
  assert.match(power, /if \(!toDark\) releaseInput\(\);/, 'input held through the dark');
  assert.ok(power.indexOf("classList.add('is-revealed')") < power.indexOf('releaseInput();\n      setTimeout(retire'), 'released at the reveal');
  assert.match(power, /const boot = startBoot\(\$\('boot'\)\);/, 'the diagnostics path is still there for the setting');
  assert.match(read('player.js'), /deck\.needlePending = needle;/);
  assert.match(read('index.html'), /<input type="checkbox" id="auto-music" checked> The Awakening starts the music/);
  assert.match(read('styles.css'), /\.attract\.is-dark \.attract-world\{ opacity:0;/);
});

test('the film reveals on the opener accent while the live cut keeps its longer lead', async () => {
  const { BEATS, PULSE, BEAT_MS } = await import('../startup-timing.js');
  assert.equal(BEATS.end, BEATS.cut, 'the film ends on the cut');
  assert.equal(BEATS.cut, PULSE.lock.at(-1), 'and the cut is the lock\'s last beat');
  assert.equal(BEATS.fail, 7550, 'the first try is untouched');
  const app = read('app.js');
  assert.match(app, /const OPENER_LEAD_MS = \(5 \* OPENER\.beat - OPENER\.bar1\) \* 1000;/);
  const lead = (5 * OPENER.beat - OPENER.bar1) * 1000;
  assert.ok(lead > 0, 'the song starts after the cut, in the dark');
  assert.ok(Math.abs(BEATS.cut + lead + OPENER.bar1 * 1000 - (BEATS.cut + 5 * BEAT_MS)) < 1e-6, 'bar 1 is the fifth beat after the cut');
  const power = app.slice(app.indexOf('async function powerOn'), app.indexOf('async function startNight'));
  assert.match(power, /await landOpener\(reveal\.leadMs, reveal\);/, 'the opener uses the selected film/live reveal timing');
  assert.match(power, /playedFilm && !new URLSearchParams\(location\.search\)\.has\('reveal'\)\s+\?\s+REVEALS\.a/, 'the film defaults to the first musical accent');
  assert.match(app, /await delay\(leadMs\);\s+\/\/ the record is on the platter from the cut/, 'with the record already on the platter');
  assert.match(app, /long: \{ leadMs: OPENER_LEAD_MS, at: OPENER\.revealAt \}/, 'the long reveal is still there to compare');
});
