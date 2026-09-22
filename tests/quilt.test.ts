// tests/quilt.test.ts — node --test on tsc-compiled output, zero runtime deps.
// The kernel byte law, the bridge wrappers, and harness-format interop.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  Kernel,
  fnv1a64,
  hash16,
  canaryOk,
  CANARY_VEC,
  GENESIS_PREV_HASH,
} from '../src/quilt/kernel.js';
import {
  QuiltBridge,
  wrapZustandAction,
  type ZustandLike,
} from '../src/quilt/bridge.js';

test('canary: byte hash, numeric law', () => {
  assert.equal(canaryOk(), true);
  assert.equal(fnv1a64(CANARY_VEC), 0x24a555471370b18dn);
  assert.equal(hash16(CANARY_VEC), '0x24a555471370b18d');
});

test('genesis prev_hash chains to real cells', () => {
  const k = new Kernel('t');
  const c0 = k.emit('BIND', { kind: 'prop', name: 'Mailbox' });
  assert.equal(c0.prev_hash, GENESIS_PREV_HASH);
  const c1 = k.emit('EFFECT', { kind: 'easter-egg', id: 'unobtanium' });
  assert.equal(c1.prev_hash, c0.cell_hash);
  assert.equal(k.cells.length, 2);
});

test('unknown opcode rejected', () => {
  const k = new Kernel('t');
  assert.throws(() => k.emit('HYPOTHESIZE' as never, {}), /unknown opcode/);
});

test('local coherence is 1.0 on an unbroken chain', () => {
  const k = new Kernel('t');
  for (let i = 0; i < 10; i++) k.emit('TICK', { frame: i });
  assert.equal(k.coherence(), 1);
});

test('coherence drops at the first tampered cell', () => {
  const k = new Kernel('t');
  for (let i = 0; i < 5; i++) k.emit('BIND', { i });
  k.cells[2].payload = { i: 999, forged: true };
  assert.ok(k.coherence() < 1);
  assert.equal(k.coherence(), 2 / 5);
});

test('FORGET is emitted honestly, counters stay right', () => {
  const k = new Kernel('t');
  for (let i = 0; i < 10; i++) k.emit('TICK', { i });
  const f = k.forget(5)!;
  assert.equal(f.op, 'FORGET');
  assert.equal(k.cells.length, 6); // 5 kept + the FORGET cell
  assert.equal(k.counters().FORGET, 1);
});

test('witness export matches harness replay field-for-field', () => {
  const k = new Kernel('night-city:demo');
  k.emit('BIND', { kind: 'prop', name: 'Unobtanium' });
  k.emit('EFFECT', { kind: 'easter-egg', id: 'unobtanium' });
  const w = k.witness();
  assert.equal(w.length, 2);
  for (const cell of w) {
    for (const key of [
      'conv_id',
      'cell_id',
      'tick',
      'state_json',
      'answers_json',
      'prev_hash',
      'cell_hash',
    ] as const) {
      assert.ok(key in cell, `witness cell missing ${key}`);
    }
    assert.equal(cell.answers_json, '[]');
    const body = JSON.parse(cell.state_json);
    assert.ok('op' in body && 'payload' in body);
  }
  // replay-verify: hashes recompute from verbatim strings
  let last = GENESIS_PREV_HASH;
  for (const cell of w) {
    assert.equal(cell.prev_hash, last);
    const recomputed = hash16(
      cell.cell_id + cell.state_json + cell.answers_json + cell.prev_hash
    );
    assert.equal(recomputed, cell.cell_hash);
    last = cell.cell_hash;
  }
});

function fakeZustand<T extends Record<string, unknown>>(initial: T) {
  let state = { ...initial };
  const store: ZustandLike & { state: () => T } = {
    getState: () => state,
    setState: (partial) => {
      state = { ...state, ...partial };
    },
    state: () => state,
  };
  return store;
}

test('wrapper fidelity: originals still run, order intact', () => {
  const calls: string[] = [];
  const store = fakeZustand({
    setLocation(loc: { x: number }) {
      calls.push(`orig:${loc.x}`);
      return 'ok';
    },
  });
  const bridge = new QuiltBridge({ convId: 't', now: () => 0 });
  wrapZustandAction(store, 'setLocation', (loc) => {
    calls.push(`cell:${(loc as { x: number }).x}`);
    bridge.playerMoved({ x: (loc as { x: number }).x, y: 0, z: 0 });
  });

  const ret = (store.getState().setLocation as (l: { x: number }) => unknown)({ x: 1 });
  assert.equal(ret, 'ok'); // original return value preserved
  assert.deepEqual(calls, ['cell:1', 'orig:1']); // cell first, original second
  assert.equal(bridge.kernel.counters().LINK, 1);
});

test('easter-egg discovery is EFFECT {kind:"easter-egg", id}', () => {
  const b = new QuiltBridge({ convId: 't' });
  const cell = b.soundPlayed('/blob/audio/guy/unobtanium.wav')!;
  assert.equal(cell.op, 'EFFECT');
  assert.deepEqual(cell.payload, { kind: 'easter-egg', id: 'unobtanium' });
  const fan = b.soundPlayed('/blob/audio/guy/finished.wav')!;
  assert.deepEqual(fan.payload, { kind: 'easter-egg', id: 'true-fan' });
  // ordinary voice-overs are audio EFFECTs, not eggs; eggs dedup
  assert.equal(b.soundPlayed('/blob/audio/guy/welcome.wav')!.payload.kind, 'audio');
  assert.equal(b.soundPlayed('/blob/audio/guy/unobtanium.wav'), null);
});

test('player visits throttled by distance and dwell', () => {
  let t = 0;
  const b = new QuiltBridge({ convId: 't', now: () => t });
  assert.ok(b.playerMoved({ x: 0, y: 0, z: 0 })); // first move lands
  assert.equal(b.playerMoved({ x: 1, y: 0, z: 0 }), null); // 1 unit, same moment: swallowed
  t = 5000; // dwell exceeded
  assert.ok(b.playerMoved({ x: 1.5, y: 0, z: 0 }));
  assert.equal(b.playerMoved({ x: 10, y: 0, z: 0 })!.op, 'LINK'); // distance exceeded
  const visits = b.kernel.cells.filter((c) => c.op === 'LINK' && c.payload.kind === 'visit');
  assert.equal(visits.length, 3);
});

test('territory entries dedup, unknown names ignored', () => {
  const b = new QuiltBridge({ convId: 't' });
  assert.equal(b.territoryEntered('Space Bar')!.payload.name, 'Space Bar');
  assert.equal(b.territoryEntered('Space Bar'), null);
  assert.equal(b.territoryEntered(''), null);
  assert.equal(b.kernel.counters().EFFECT, 1);
});

test('scene load emits VIEW + BIND + LINK + TICK exactly once', () => {
  const b = new QuiltBridge({ convId: 't' });
  const n = b.sceneLoaded('night-city', ['Mailbox', 'coffee']);
  assert.equal(n, 5); // VIEW + 2 BIND + LINK + TICK
  b.sceneLoaded('night-city', ['Mailbox', 'coffee']); // second call is a no-op
  assert.equal(b.kernel.cells.length, 5);
  assert.equal(b.kernel.counters().BIND, 2);
  assert.equal(b.kernel.cells[0].op, 'VIEW');
});

test('bridge emits aggregate TICK on the cadence and forgets honestly', () => {
  const b = new QuiltBridge({ convId: 't', tickEvery: 3, keep: 4 });
  b.sceneLoaded('night-city', ['a', 'b', 'c']); // 5 cells
  assert.equal(b.tick(), null); // frame 1
  assert.equal(b.tick(), null); // frame 2
  const cell = b.tick()!; // frame 3
  assert.equal(cell.op, 'TICK');
  assert.equal(cell.payload.frame, 3);
  for (let i = 0; i < 30; i++) b.tick(); // frames 6..33 → 10 more TICKs + FORGET
  assert.ok(b.kernel.cells.length <= 5);
  assert.ok((b.kernel.counters().FORGET || 0) >= 1);
});

test('BSD license file intact with creator copyright', () => {
  // cwd = repo root for both `npm test` and CI
  const license = readFileSync(`${process.cwd()}/LICENSE`, 'utf8');
  assert.match(license, /BSD 3-Clause License/);
  assert.match(license, /Cyrus Mobini/);
});

test('upstream creator credit survives the fork README', () => {
  const readme = readFileSync(`${process.cwd()}/README.md`, 'utf8');
  assert.match(readme, /cyrus2281/i);
  assert.match(readme, /Cyrus Mobini/i);
});
