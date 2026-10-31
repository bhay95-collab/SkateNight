import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ORNAMENT, ORNAMENTS, ornaments } from '../ornament.js';
import { tubeSchedule } from '../startup-power.js';

const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');

test('ornament is retired by default and can be brought back from the address for an A/B comparison', () => {
  assert.equal(ORNAMENT.size, 0, 'none of it in the show');
  assert.deepEqual([...ornaments('')], []);
  assert.deepEqual([...ornaments('?hum')], [], 'other settings leave it out');
  assert.deepEqual([...ornaments('?ornament=all')], [...ORNAMENTS], 'all of it, as before');
  assert.deepEqual([...ornaments('?ornament')], [...ORNAMENTS]);
  assert.deepEqual([...ornaments('?hum&ornament=spin,neon')], ['spin', 'neon'], 'or just some');
  assert.deepEqual([...ornaments('?ornament=spin,sparkles')], ['spin'], 'unknown names are ignored');
});

test('each piece of ornament is gated, and the story without it is whole', () => {
  const start = read('startup.js');
  assert.match(start, /if \(ORNAMENT\.has\('spin'\)\) buildCoinEdge\(el\.spin\);/, 'a face-on coin needs no edge');
  assert.match(start, /el\.dust = ORNAMENT\.has\('dust'\) \? addDust\(el\.cab\) : \[\];/, 'no dust shaken off the arch');
  assert.match(start, /while \(ORNAMENT\.has\('neon'\) && el\.tubes\.length/, 'no dead letters');
  assert.match(read('startup-coin.js'), /if \(ORNAMENT\.has\('spin'\)\) \{[^}]*el\.spin\.animate\(tumble\(\), total\);/, 'no turn and no shine');
  assert.match(read('startup-power.js'), /if \(ORNAMENT\.has\('glints'\)\) \{\s*const sweep/, 'no glints');
  const plan = tubeSchedule(10, new Set());
  assert.ok([...plan.values()].every(({ struggle }) => !struggle), 'no letter catches, drops and catches again');
  assert.equal(new Set([...plan.values()].map(({ at }) => at)).size, 10, 'every letter strikes on its own beat');
  assert.match(read('sw.js'), /'ornament\.js'/, 'cached for offline');
});
