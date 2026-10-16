// Issue #385: a world loaded from its bake (src/world-bake.js: the collision's BVH, the buried instances, the crowd's
// ray tests) is the world generated: the same triangles, the same answers to rays and ground queries over the map, the
// same instanced things dropped, the same crowd, person for person. In the engines' own code (engine/game.js bundled,
// a bare V8 context), as scripts/bake-worlds.mjs bakes it and a Unity build loads it. And a bake is ignored where it
// does not fit: another world's, other code's, other triangles.
import test from 'node:test';
import assert from 'node:assert/strict';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import './register-gadgets.js';
import { bundle } from '../scripts/engine-bundle.mjs';
import { loadBundle } from '../engine/vm-run.mjs';
import { tempPath } from '../scripts/temp-dirs.mjs';
import { mulberry32 } from '../src/noise.js';

const UNSET = new Set(['shapeAttrs', 'quietWalk', 'listMatrices', 'stillMatrices', 'skipHidden', 'peopleLod', 'portrait', 'capeOffload', 'clothOffload', 'brush', 'materialFluid', 'materialLive', 'materialVec', 'vertices', 'then', 'photo']);
const backend = new Proxy({}, { get: (t, k) => (UNSET.has(k) ? undefined : () => {}) });
const quietly = async (fn) => { const w = console.warn, i = console.info, l = console.log, e = console.error; console.warn = console.info = console.log = console.error = () => {}; try { return await fn(); } finally { console.warn = w; console.info = i; console.log = l; console.error = e; } };

const file = tempPath(join(tmpdir(), `hiraeth-world-bake-${process.pid}.js`));
let built = null;
const load = async (levelId, bake) => {
  built ??= bundle('godot', { input: 'engine/game.js', out: [file] });
  await built;
  const B = loadBundle(file, { pads: () => [] });
  const lines = [];
  const g = await quietly(() => B.exports.createGame({ levelId, backend, bake, log: (...a) => lines.push(a.join(' ')) }));
  quietly(() => g.deferred?.flush());
  g.bakeLine = lines.find((l) => l.startsWith('bake:')) ?? '';
  return g;
};

/** What a world's load worked out, to compare: rays and ground over its map, its static instances, its crowd. */
function readOut(g, n = 1500) {
  const P = g.physics, V = g.player.pos.constructor, R = mulberry32(385);
  const lim = Math.min(g.level.limit ?? 900, 900), at = g.level.spawn ?? new V();
  const rays = [];
  for (let i = 0; i < n; i++) {
    const x = at.x + (R() * 2 - 1) * lim, z = at.z + (R() * 2 - 1) * lim, y = at.y + R() * 120 - 20;
    const a = R() * Math.PI * 2, e = (R() - 0.7) * 1.2;
    const d = new V(Math.cos(a) * Math.cos(e), Math.sin(e), Math.sin(a) * Math.cos(e));
    rays.push(P.groundAt(x, y + 200, z, 600), P.rayDistance(new V(x, y, z), d, 300));
  }
  const inst = [];
  g.scene.traverse((o) => { if (o.isInstancedMesh && !o.userData.dynamic) inst.push(`${o.name}:${o.count}:${Array.from(o.instanceMatrix.array.subarray(0, o.count * 16)).join(',')}`); });
  // (where each was placed, not where the story or the crowd has moved them since: a procession's people walk on the clock)
  const crowd = g.crowd ? g.crowd.people.map((p) => `${p.id} ${p.kind} ${p.home.toArray().join(',')} ${p.homeHeading} ${p.size} ${p.walk ? `${p.walk.route.order} ${p.walk.dir} ${p.walk.side}` : '-'}`) : [];
  const routes = g.crowd ? g.crowd.routes.map((r) => r.pts.map((v) => v.toArray().join(',')).join(';')) : [];
  return { tris: P.triangles, hash: P.levelHash, rays, inst, crowd, routes };
}

function same(a, b, what) {
  assert.equal(a.tris, b.tris, `${what}: the same collision triangles`);
  assert.equal(a.rays.length, b.rays.length);
  const off = a.rays.findIndex((v, i) => !Object.is(v, b.rays[i]));
  assert.equal(off, -1, `${what}: every ray and ground query answers the same (first off: ${off}, ${a.rays[off]} against ${b.rays[off]})`);
  assert.equal(a.inst.length, b.inst.length, `${what}: the same instanced meshes`);
  for (let i = 0; i < a.inst.length; i++) assert.ok(a.inst[i] === b.inst[i], `${what}: instanced mesh ${a.inst[i].split(':')[0]} the same, its dropped instances too`);
  const c = a.crowd.findIndex((v, i) => v !== b.crowd[i]);
  assert.equal(a.crowd.length, b.crowd.length, `${what}: as many people`);
  assert.equal(c, -1, `${what}: the same crowd, person for person (first off: ${a.crowd[c]} against ${b.crowd[c]})`);
  assert.equal(a.routes.length, b.routes.length, `${what}: as many routes`);
  const r = a.routes.findIndex((v, i) => v !== b.routes[i]);
  assert.equal(r, -1, `${what}: the same routes (first off: ${r}, ${a.routes[r]?.slice(0, 200)} against ${b.routes[r]?.slice(0, 200)})`);
}

for (const id of ['desert', 'incal']) {
  test(`${id}: loaded from its bake, the world generated (collision, buried instances, crowd)`, { timeout: 600000 }, async () => {
    const rec = await load(id, 'record');
    const buf = rec.bakeOut();
    assert.ok(buf && buf.byteLength > 1e5, 'a bake written');
    const generated = readOut(rec);
    rec.dispose?.();
    // (the load as the Unity build has it without a bake: distant detail deferred, then finished)
    const plain = await load(id, false);
    const fromGen = readOut(plain);
    plain.dispose?.();
    same(fromGen, generated, `${id}, generated with distant detail against generated at once`);
    const used = await load(id, buf);
    assert.match(used.bakeLine, /^bake: used: the BVH baked/, used.bakeLine);
    if (id === 'incal') assert.match(used.bakeLine, /[1-9]\d* buried checks answered/, 'the trees in houses from the bake');
    assert.match(used.bakeLine, /the crowd \d+ answers/, 'the crowd from the bake');
    assert.equal(used.deferred?.count ?? 0, 0);
    same(readOut(used), generated, `${id} from its bake`);
    used.dispose?.();
  });
}

test('a bake is ignored where it does not fit: another world’s, or a world whose triangles differ', { timeout: 300000 }, async () => {
  const rec = await load('home', 'record');
  const buf = rec.bakeOut();
  rec.dispose?.();
  const other = await load('lantern', buf);
  assert.match(other.bakeLine, /: generating$/, 'another world’s bake: generated, no bake used');
  other.dispose?.();
  // (its file edited: the BVH's key no longer the triangles' → built, and nothing else answered from it)
  const u8 = new Uint8Array(buf.slice(0));
  const n = new DataView(u8.buffer).getUint32(4, true);
  const json = new TextDecoder().decode(u8.subarray(8, 8 + n));
  const key = JSON.parse(json).bvhs[0].key;
  const bad = json.replace(key, key.replace(/^./, (c) => (c === '0' ? '1' : '0')));
  u8.set(new TextEncoder().encode(bad), 8);
  const g = await load('home', u8.buffer);
  assert.match(g.bakeLine, /^bake: used: the BVH other triangles/, g.bakeLine);
  assert.ok(g.physics.bvh, 'its BVH built');
  g.dispose?.();
});
