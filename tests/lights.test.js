import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveLights, toggleLights } from '../lights.js';

test('with no saved choice the lights follow the operating system', () => {
  assert.equal(resolveLights({ stored: null, osReduced: false }), 'full');
  assert.equal(resolveLights({ stored: null, osReduced: true }), 'calm');
  assert.equal(resolveLights({ stored: undefined, osReduced: true }), 'calm');
});

test('a saved choice beats the operating system either way', () => {
  assert.equal(resolveLights({ stored: 'full', osReduced: true }), 'full');
  assert.equal(resolveLights({ stored: 'calm', osReduced: false }), 'calm');
});

test('rubbish in storage is ignored', () => {
  assert.equal(resolveLights({ stored: 'banana', osReduced: false }), 'full');
  assert.equal(resolveLights({ stored: 'banana', osReduced: true }), 'calm');
});

test('toggle flips between full and calm', () => {
  assert.equal(toggleLights('full'), 'calm');
  assert.equal(toggleLights('calm'), 'full');
});
