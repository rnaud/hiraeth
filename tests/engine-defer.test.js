// Issue #385: the engines (engine/game.js, the Unity version's game in a bare V8 context) defer what main.js defers, with
// its promises (docs/systems/performance.md, "Distant detail after the first frame"): the sand drifts' collision and the
// crowd's strollers are worked out after the first frame, everything near where it looks from is done before it, the
// guard does what the traveller comes near in that frame, and once drained the world is the one built all at load. The
// flora's burial check (which the engines never ran) and the large plants' collision come with it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import './register-gadgets.js';
import { bundle } from '../scripts/engine-bundle.mjs';
import { loadBundle } from '../engine/vm-run.mjs';
import { tempPath } from '../scripts/temp-dirs.mjs';
import { DEFER } from '../src/deferred.js';
import { WORKER_TRIS } from '../src/late-collision.js';

const UNSET = new Set(['shapeAttrs', 'quietWalk', 'listMatrices', 'stillMatrices', 'skipHidden', 'peopleLod', 'portrait', 'capeOffload', 'clothOffload', 'brush', 'materialFluid', 'materialLive', 'materialVec', 'vertices', 'then', 'photo']);
const backend = new Proxy({}, { get: (t, k) => (UNSET.has(k) ? undefined : () => {}) });
const quietly = async (fn) => { const w = console.warn, i = console.info, l = console.log, e = console.error; console.warn = console.info = console.log = console.error = () => {}; try { return await fn(); } finally { console.warn = w; console.info = i; console.log = l; console.error = e; } };

const file = tempPath(join(tmpdir(), `hiraeth-engine-defer-${process.pid}.js`));
const built = bundle('godot', { input: 'engine/game.js', out: [file] });
/** A world in a VM of its own (a second game in one VM differs: what moves has moved), distant detail on or off. */
async function world(levelId, defer) {
  await built;
  const B = loadBundle(file, { pads: () => [] });
  const logs = [];
  const g = await quietly(() => B.exports.createGame({ levelId, backend, flags: { 'prologue.done': true }, defer, log: (...a) => logs.push(a.join(' ')) }));
  return { g, logs, THREE: B.exports };
}
const round = (v) => (v == null || !Number.isFinite(v) ? null : +v.toFixed(3));
/** The ground on a grid round p (step m, n each way), as the traveller's footing asks for it. */
const grid = (g, p, step, n, y = null) => {
  const out = [];
  for (let i = -n; i <= n; i++) for (let j = -n; j <= n; j++) out.push(round(g.physics.groundAt(p.x + i * step, y ?? p.y + 40, p.z + j * step, y ? 1200 : 120)));
  return out;
};
/** Rays at knee and chest height from p, all round: what he would walk into. */
const walls = (g, p) => {
  const out = [], o = p.clone(), d = p.clone();
  for (const h of [0.4, 1.3]) for (let k = 0; k < 16; k++) {
    o.copy(p); o.y += h; d.set(Math.sin(k * Math.PI / 8), 0, Math.cos(k * Math.PI / 8));
    out.push(round(g.physics.rayDistance(o, d, 60)));
  }
  return out;
};
const dropped = (g) => { let n = 0; g.scene.traverse((o) => { if (!o.isInstancedMesh || o.userData.dynamic) return; const a = o.instanceMatrix.array; for (let i = 0; i < o.count; i++) if (a[i * 16] === 0 && a[i * 16 + 1] === 0 && a[i * 16 + 2] === 0 && a[i * 16 + 5] === 0) n++; }); return n; };
const crowdSig = (g) => Array.from(g.crowd?.people ?? [], (p) => `${p.id}:${p.pos.x.toFixed(3)},${p.pos.y.toFixed(3)},${p.pos.z.toFixed(3)}:${p.heading.toFixed(3)}`).sort();   // (Array.from: the VM's arrays are another realm's)

test('the desert in the engines: its drifts\' collision and its flora checks after the first frame, nothing near missing, the same world once drained', async () => {
  const off = await world('desert', false), on = await world('desert', true);
  const a = off.g, b = on.g, P = b.player.pos.clone();
  assert.ok(a.player.pos.distanceTo(P) < 1e-6, 'the same spawn');
  // queued: the drifts' pieces and the flora's checks, the near ones done
  const late = b.physics.late;
  assert.ok(late && late.made > 0 && late.pending > 100, `the drifts' collision in pieces, the near made (${late?.made}), the rest later (${late?.pending})`);
  assert.ok(b.deferred.pending > 100, `distant detail waiting after the first frame (${b.deferred.pending})`);
  assert.ok(b.floraLater !== b.deferred && b.floraLater.pending > 1000, `the flora's checks in a queue of their own, after the sand (${b.floraLater.pending})`);
  assert.ok(!a.physics.late && !a.deferred, 'all at load without it');
  assert.ok(on.logs.some((l) => /pieces of the drifts' to make later/.test(l)));
  // nothing near where the first frame looks from is left, and what is there answers as if all were made
  for (const q of [b.deferred, b.floraLater]) assert.equal(q._take(P, DEFER.near).length, 0, 'no job left within DEFER.near of the spawn');
  assert.deepEqual(grid(b, P, 6, 10), grid(a, P, 6, 10), 'the footing round the spawn (120 m across)');
  assert.deepEqual(walls(b, P), walls(a, P), 'what he would walk into round the spawn');
  assert.deepEqual(crowdSig(b), crowdSig(a), 'the same people (the desert\'s procession is placed at load)');
  // the guard: far off, a frame there makes what is within it
  const far = P.clone(); far.x += 520; far.z -= 380; far.y = b.level.ground.heightAt(far.x, far.z) + 1;
  b.player.respawn?.(far) ?? b.player.pos.copy(far);
  await quietly(() => b.frame(1 / 30));
  for (const q of [b.deferred, b.floraLater]) assert.equal(q._take(b.player.pos, DEFER.guard - 3).length, 0, 'nothing waits within the guard of where he is');
  // the flora's checks wait for the sand: a frame's share goes to them only once all its pieces are made
  const f0 = b.floraLater.pending;
  await quietly(() => { for (let i = 0; i < 3; i++) b.frame(1 / 30); });
  assert.ok(late.pending > 0 && f0 - b.floraLater.pending < 25, `none but the guard's checks while the sand is still coming: ${f0} → ${b.floraLater.pending}, sand ${late.pending}, at ${b.player.pos.toArray().map(Math.round)}`);
  // drained: the same sand, the same ground everywhere, the same plants dropped
  const n = b.deferred.flush();
  assert.ok(n > 0 && !b.deferred.pending && !late.pending);
  await quietly(() => b.frame(1 / 30));
  assert.ok(b.floraLater.pending < f0, 'then they go on, a share a frame');
  b.floraLater.flush();
  let fit = 0; a.scene.traverse((o) => { if (/^Sand banked: collision/.test(o.name)) fit += o.geometry.attributes.position.count / 3; });
  assert.ok(fit > 1000 && late.triangles === fit, `the drifts' triangles made (${late.triangles}) are the load's (${fit})`);
  assert.ok(late.parts.length > 1 && late.parts.length <= 24, `kept in a few colliders, no merge on the frame past WORKER_TRIS (${late.parts.length})`);
  for (const p of late.parts) assert.ok(p.tris.length / 9 <= WORKER_TRIS * 2, `a part of ${p.tris.length / 9} triangles`);
  assert.deepEqual(grid(b, P, 100, 8, 400), grid(a, P, 100, 8, 400), 'the ground over 1.6 km');
  assert.equal(dropped(b), dropped(a), 'the same buried plants left out');
  assert.ok(dropped(a) > 0, 'the flora\'s burial check runs in the engines');
  a.dispose?.(); b.dispose?.();
});

test('the Floating City in the engines: its strollers\' walks after the first frame, joining the crowd as main.js\'s do', async () => {
  const off = await world('spacecity', false), on = await world('spacecity', true);
  const a = off.g, b = on.g;
  assert.ok(b.crowd.pending >= 1, `walks still to come at the first frame (${b.crowd.pending})`);
  assert.ok(b.crowd.people.length < a.crowd.people.length, 'their people come later');
  assert.equal(b.deferred._take(b.player.pos, DEFER.near).length, 0, 'none near the spawn left');
  // (the near ones are there already: every stroller whose walk comes within DEFER.near of the spawn was there at the
  // first frame)
  const P = b.player.pos.clone(), early = new Set(b.crowd.people.map((p) => p.id));
  b.deferred.flush();
  assert.equal(b.crowd.pending, 0);
  assert.deepEqual(crowdSig(b), crowdSig(a), 'the same people, person for person');
  let near = 0;
  for (const p of b.crowd.people) {
    if (!p.walk?.route?.pts?.some((q) => q.distanceTo(P) < DEFER.near - 5)) continue;
    near++;
    assert.ok(early.has(p.id), `${p.id}, walking by the spawn, was there at once`);
  }
  assert.ok(near > 0, 'strollers walk by the spawn');
  // the crowd's figures carry the newcomers (the tiers grew)
  await quietly(() => { for (let i = 0; i < 3; i++) b.frame(1 / 30); });
  assert.ok(b.crowd.mid.max >= b.crowd.people.length || b.crowd.far.max >= b.crowd.people.length, 'room for everyone in the figures');
  a.dispose?.(); b.dispose?.();
});
