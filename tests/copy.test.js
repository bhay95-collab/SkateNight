import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BOOT_POOL,
  SKATE_JOKES,
  IDLE_JOKES,
  OUT_OF_ORDER_LINES,
  createRotator,
  sample,
} from '../copy.js';

const BLOCKED = ['damn', 'hell', 'crap', 'sucks', 'stupid', 'idiot', 'dumb', 'drunk', 'beer', 'wine', 'sexy', 'hate', 'kill', 'dead', 'die', 'butt', 'bum', 'fat', 'ugly', 'loser'];

const textPools = {
  SKATE_JOKES,
  IDLE_JOKES,
  OUT_OF_ORDER_LINES,
};

test('every text pool is big, unique, tidy and LED-uppercase', () => {
  for (const [name, pool] of Object.entries(textPools)) {
    assert.ok(pool.length >= 12, `${name} has only ${pool.length} lines`);
    assert.equal(new Set(pool).size, pool.length, `${name} has duplicates`);
    for (const line of pool) {
      assert.equal(typeof line, 'string');
      assert.equal(line, line.trim(), `${name}: stray spaces in "${line}"`);
      assert.ok(line.length > 3, `${name}: too short "${line}"`);
      assert.ok(line.length <= 64, `${name}: too long to read from the back "${line}"`);
      assert.equal(line, line.toUpperCase(), `${name}: not uppercase "${line}"`);
    }
  }
});

test('the boot self-test pool is big, unique and well-formed', () => {
  assert.ok(BOOT_POOL.length >= 20);
  const labels = BOOT_POOL.map((b) => b.t);
  assert.equal(new Set(labels).size, labels.length);
  for (const b of BOOT_POOL) {
    assert.ok(b.t && b.t.length <= 30, `label too long: ${b.t}`);
    assert.ok(b.s && b.s.length <= 8, `status too long: ${b.s}`);
    assert.ok(['ok', 'warn', 'bad'].includes(b.k), `bad kind: ${b.k}`);
    assert.equal(b.t, b.t.toUpperCase());
  }
  for (const needed of ['TONEARM CALIBRATION', 'WHEEL BEARINGS LUBED', 'BUBBLE TUBES FILLED']) {
    assert.ok(labels.includes(needed), `missing the lines Ben asked for: ${needed}`);
  }
});

test('the ticker has a large pool of skate jokes so a long night never repeats early', () => {
  assert.ok(SKATE_JOKES.length >= 100, `only ${SKATE_JOKES.length} skate jokes`);
  assert.ok(IDLE_JOKES.length >= 15, `only ${IDLE_JOKES.length} music-stopped jokes`);
  assert.ok(SKATE_JOKES.includes('WE WALK BY FAITH. TONIGHT WE ROLL BY IT.'));
});

test('all copy stays church-family friendly', () => {
  const all = [
    ...SKATE_JOKES, ...IDLE_JOKES, ...OUT_OF_ORDER_LINES,
    ...BOOT_POOL.map((b) => `${b.t} ${b.s}`),
  ];
  for (const line of all) {
    const lower = line.toLowerCase();
    for (const word of BLOCKED) {
      assert.ok(!new RegExp(`\\b${word}\\b`).test(lower), `"${line}" contains "${word}"`);
    }
  }
});

test('sample returns n distinct entries without touching the source', () => {
  const src = Array.from({ length: 20 }, (_, i) => i);
  const copy = src.slice();
  const out = sample(src, 5);
  assert.equal(out.length, 5);
  assert.equal(new Set(out).size, 5);
  assert.deepEqual(src, copy);
  assert.equal(sample(src, 99).length, 20);
});

test('a rotator uses every line before repeating and never repeats back-to-back', () => {
  const pool = ['a', 'b', 'c', 'd', 'e'];
  const next = createRotator(pool);
  let prev = null;
  for (let round = 0; round < 40; round++) {
    const seen = new Set();
    for (let i = 0; i < pool.length; i++) {
      const line = next();
      assert.ok(pool.includes(line));
      assert.notEqual(line, prev);
      prev = line;
      seen.add(line);
    }
    assert.equal(seen.size, pool.length, 'a full cycle must cover the whole pool');
  }
});

test('a rotator over one line just repeats it', () => {
  const next = createRotator(['only']);
  assert.equal(next(), 'only');
  assert.equal(next(), 'only');
});
