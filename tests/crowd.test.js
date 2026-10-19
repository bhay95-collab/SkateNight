import test from 'node:test';
import assert from 'node:assert/strict';
import { createCrowdConnection } from '../crowd.js';

test('a quiet operator remains connected through background timer delays', () => {
  let time = 0;
  const connection = createCrowdConnection({ now: () => time });
  assert.equal(connection.status(), 'waiting');
  assert.equal(connection.receive('snapshot'), false);
  time = 29_999;
  assert.equal(connection.status(), 'connected');
  connection.receive('heartbeat');
  time += 29_999;
  assert.equal(connection.status(), 'connected');
  time += 1;
  assert.equal(connection.status(), 'lost');
});

test('reconnection requests a complete snapshot, but not a snapshot loop', () => {
  let time = 0;
  const connection = createCrowdConnection({ now: () => time });
  assert.equal(connection.receive('heartbeat'), true, 'initial heartbeat requests current playback');
  assert.equal(connection.receive('snapshot'), false);
  time = 30_000;
  assert.equal(connection.status(), 'lost');
  assert.equal(connection.receive('time'), true, 'a resumed stream refreshes the complete picture');
  assert.equal(connection.status(), 'connected');
  assert.equal(connection.receive('levels'), false);
  time += 30_000;
  assert.equal(connection.receive('snapshot'), false, 'an unsolicited snapshot already supplies the picture');
  assert.equal(connection.status(), 'connected');
});

test('crowd hellos and unrelated channel messages cannot impersonate an operator', () => {
  let time = 0;
  const connection = createCrowdConnection({ now: () => time });
  assert.equal(connection.receive('hello'), false);
  assert.equal(connection.status(), 'waiting');
  connection.receive('state');
  time = 30_000;
  connection.receive('hello');
  connection.receive('crowd-heartbeat');
  connection.receive('unrelated');
  assert.equal(connection.status(), 'lost');
  assert.equal(connection.receive('operator'), true);
  assert.equal(connection.status(), 'connected');
});

test('operator heartbeats receive a crowd reply at most once every six seconds', () => {
  let time = 0;
  const replies = [];
  const connection = createCrowdConnection({ now: () => time, onHeartbeatReply: () => replies.push(time) });
  connection.receive('heartbeat');
  for (time = 2_000; time <= 12_000; time += 2_000) connection.receive('heartbeat');
  assert.deepEqual(replies, [0, 6_000, 12_000]);
  time = 44_000;
  connection.receive('crowd-heartbeat');
  assert.equal(connection.status(), 'lost', 'another crowd window cannot keep an absent operator alive');
  assert.deepEqual(replies, [0, 6_000, 12_000], 'crowd replies never produce reply loops');
  assert.equal(connection.receive('heartbeat'), true);
  assert.deepEqual(replies, [0, 6_000, 12_000, 44_000]);
});
