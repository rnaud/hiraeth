// The frame's commands handed to C# as a view of the command writer's own buffer (engine/unity/pack.js takeView), not
// a fresh ArrayBuffer a frame: in Unity's IL2CPP players Puerts holds each buffer handed over until the managed side lets
// its box go, and ~350 kB a frame of them made V8 run a full collection every ~190 frames, the Xbox's stall every ~3 s at
// the City-Shaft's rim (issue #113). And the script's watch on V8's full collections (engine/unity/gc-watch.js, -v8-gcs).
import test from 'node:test';
import assert from 'node:assert/strict';
import { setFlagsFromString } from 'node:v8';
import { runInNewContext } from 'node:vm';
import { CommandWriter, OP } from '../engine/unity/pack.js';
import { UnityBackend } from '../engine/unity/backend.js';
import { fullGcWatch } from '../engine/unity/gc-watch.js';

function write(w) {
  w.reserve(2 + 17); w.u(OP.transforms); w.u(1); w.i(42); w.matrix([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 7, 8, 9, 1]);
  for (let k = 0; k < 40; k++) { w.reserve(2); w.u(OP.remove); w.i(k); }   // (grows past its first buffer)
}

test('takeView: the same words as take, over the writer\'s own buffer, and the writer starts again', () => {
  const a = new CommandWriter(64), b = new CommandWriter(64);
  write(a); write(b);
  const copy = new Uint8Array(a.take()), view = b.takeView();
  assert.ok(view instanceof Uint32Array);
  assert.equal(view.buffer, b.buf, 'no new ArrayBuffer: a view of the writer\'s');
  assert.equal(view.byteOffset, 0);
  assert.equal(view.byteLength, copy.byteLength, 'the bytes Puerts copies: the stream and its closing 0, no more');
  assert.deepEqual(new Uint8Array(view.buffer, 0, view.byteLength), copy);
  assert.equal(view[view.length - 1], 0, 'closed with 0');
  assert.ok(b.empty, 'the writer starts again');
  // the next frame writes over the same buffer: what was handed over was copied at the call
  const buf = b.buf;
  write(b);
  assert.equal(b.takeView().buffer, buf, 'the same buffer frame after frame once it is large enough');
});

test('the backend hands each frame over as a view (frameView), or as a copy with -js-off copy', () => {
  const got = [];
  const B = new UnityBackend({ Frame: (x) => got.push(x) });
  B.remove(5); B.frame();
  B.remove(6); B.frame();
  assert.ok(got[0] instanceof Uint32Array && got[1] instanceof Uint32Array);
  assert.equal(got[0].buffer, got[1].buffer, 'one buffer for every frame');
  assert.deepEqual(Array.from(got[1]), [OP.remove, 6, 0]);
  assert.equal(B.stats.commandBytes, 12);
  B.frameView = false;
  B.remove(7); B.frame();
  assert.ok(got[2] instanceof ArrayBuffer, 'as before: a fresh ArrayBuffer');
  assert.deepEqual(Array.from(new Uint32Array(got[2])), [OP.remove, 7, 0]);
});

test('the watch on V8\'s full collections: said once after one, not after scavenges', async () => {
  setFlagsFromString('--expose-gc');
  const gc = runInNewContext('gc');
  const job = () => new Promise((r) => setImmediate(r));   // (each frame a job of its own, as each Eval is in Puerts)
  const watch = fullGcWatch(4);
  const frames = async (n) => { const said = []; for (let i = 0; i < n; i++) { const f = watch.check(); if (f) said.push(f); await job(); } return said; };
  assert.deepEqual(await frames(12), [], 'nothing without a collection');
  gc({ type: 'minor' });
  assert.deepEqual(await frames(8), [], 'a scavenge keeps a weak reference\'s target');
  gc();
  const said = await frames(8);
  assert.equal(said.length, 1, 'a full collection said once');
  assert.equal(watch.count, 1);
  gc();
  const next = await frames(8);
  assert.equal(next.length, 1, 'and the next one again');
  assert.ok(next[0] >= 8 && next[0] <= 16, `with the frames between them (${next[0]})`);
  assert.equal(watch.count, 2);
  gc(); gc();
  assert.equal((await frames(8)).length, 1, 'two within the lag: said once (seen up to lag frames late)');
});
