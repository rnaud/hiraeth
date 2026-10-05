import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

// a little DOM for the people's speech balloons
const el = () => ({ classList: { add() {}, remove() {}, toggle() {}, contains: () => false }, style: {}, dataset: {}, remove() {}, addEventListener() {}, querySelector: () => null, appendChild() {}, set textContent(v) {}, set innerHTML(v) {} });
globalThis.document ??= { createElement: el, body: el(), getElementById: () => null, querySelector: () => null };
const { Cape, resetDrapes } = await import('../src/cape.js');
const { NPC } = await import('../src/npc.js');
const { Physics } = await import('../src/physics.js');

// Far off nobody simulates cloth: a cape used to stay in the air where it was last simulated (or
// never appear), then drop into place from a stiff cone as you came near. Now it hangs on the body
// as its drape (baked by letting it settle) and the simulation starts again from there.

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const UP = V(0, 1, 0);
// a standing body: trunk, shoulders and legs
const body = () => [[V(0, 0.95, 0), V(0, 1.35, 0), 0.2], [V(0, 1.35, 0), V(0, 1.5, 0), 0.17], [V(-0.15, 1.42, 0), V(0.15, 1.42, 0), 0.12],
  [V(0.1, 0.95, 0), V(0.1, 0.5, 0), 0.12], [V(0.1, 0.5, 0), V(0.1, 0.08, 0), 0.1], [V(-0.1, 0.95, 0), V(-0.1, 0.5, 0), 0.12], [V(-0.1, 0.5, 0), V(-0.1, 0.08, 0), 0.1]]
  .map(([a, b, r]) => ({ a, b, r }));
function rig() {
  const scene = new THREE.Scene(), root = new THREE.Object3D(), anchor = new THREE.Object3D();
  anchor.position.y = 0.75; root.add(anchor); scene.add(root); root.updateMatrixWorld(true);
  return { scene, root, anchor, cape: new Cape(scene, anchor, { cols: 10, rows: 8, length: 1.2, bottom: 0.45 }) };
}
const still = (caps) => ({ up: UP, vel: V(), wind: V(), floor: V(), capsules: caps });
const world = (cape, i, out = V()) => out.set(cape.p[i], cape.p[i + 1], cape.p[i + 2]).applyMatrix4(cape.mesh.matrixWorld);
const maxGap = (a, b) => { let m = 0; for (let i = 0; i < a.length; i++) m = Math.max(m, Math.abs(a[i] - b[i])); return m; };

test('a baked drape is where the cloth comes to rest on the body, and cheap enough to bake on the fly', () => {
  resetDrapes();
  const { cape } = rig(), caps = body();
  assert.ok(cape.bake(still(caps), { force: true }));
  const baked = cape.drape.slice();
  // the long way: let it fall for 10 s
  cape.drape = null; cape.ready = false;
  for (let k = 0; k < 600; k++) cape.update(1 / 60, still(caps));
  cape.capture();
  assert.ok(maxGap(baked, cape.drape) < 0.08, `within a few cm of the settled cloth: ${maxGap(baked, cape.drape).toFixed(3)} m`);
  // the quickest of ten bakes (a busy machine stretches some of them; the cost is the bake's own)
  let ms = Infinity;
  for (let k = 0; k < 10; k++) { const t0 = performance.now(); cape.bake(still(caps), { force: true }); ms = Math.min(ms, performance.now() - t0); }
  assert.ok(ms < 8, `a bake costs a few cloth frames (${ms.toFixed(2)} ms)`);
});

test('a hanging cape is carried by the body wherever it goes, at rest, with no simulation', () => {
  resetDrapes();
  const { root, anchor, cape } = rig();
  cape.bake(still(body()), { force: true });
  assert.ok(cape.rest(1 / 60) === false || cape.hung);   // eases onto the drape, then hangs
  for (let k = 0; k < 40 && !cape.hung; k++) cape.rest(1 / 30);
  assert.ok(cape.hung, 'hangs after half a second');
  assert.equal(cape.mesh.parent, anchor);
  // the body walks 30 m and turns: the cloth goes with it, in its drape
  root.position.set(30, 0, -12); root.rotation.y = 1.2; root.updateMatrixWorld(true);
  const want = V(), got = V();
  let worst = 0;
  for (let i = 0; i < cape.p.length; i += 3) {
    want.set(cape.drape[i], cape.drape[i + 1], cape.drape[i + 2]).applyMatrix4(anchor.matrixWorld);
    worst = Math.max(worst, world(cape, i, got).distanceTo(want));
  }
  assert.ok(worst < 1e-4, 'every point where the drape says');
  // (and the sim itself does not run: a hung update is a no-op until the cloth is wanted again)
  const before = cape.p.slice();
  cape.rest(1 / 60);
  assert.deepEqual(cape.p, before);
});

test('coming close, the cloth starts from its drape: no drop into place', () => {
  resetDrapes();
  const { root, anchor, cape } = rig(), caps = body();
  cape.bake(still(caps), { force: true });
  for (let k = 0; k < 40 && !cape.hung; k++) cape.rest(1 / 30);
  root.position.set(5, 0, 5); root.updateMatrixWorld(true);
  for (const c of caps) { c.a.add(V(5, 0, 5)); c.b.add(V(5, 0, 5)); }
  const s = { ...still(caps), floor: V(5, 0, 5) };
  const start = [];
  for (let i = 0; i < cape.p.length; i += 3) start.push(V(cape.drape[i], cape.drape[i + 1], cape.drape[i + 2]).applyMatrix4(anchor.matrixWorld));
  let moved = 0;
  for (let f = 0; f < 30; f++) {
    cape.update(1 / 60, s);
    for (let i = 0; i < cape.p.length; i += 3) moved = Math.max(moved, start[i / 3].distanceTo(V(cape.p[i], cape.p[i + 1], cape.p[i + 2])));
  }
  assert.equal(cape.mesh.parent?.isScene, true, 'back in world space');
  assert.ok(moved < 0.1, `the hem stays put over the first half second (${moved.toFixed(3)} m; from the cut's cone it fell ~0.5 m)`);
});

test('capes of one cut on one kind of body share a drape (a crowd swaps people in without baking again)', () => {
  resetDrapes();
  const a = rig(), b = rig(), caps = body();
  assert.ok(a.cape.bake(still(caps), { key: 'm/average/0', force: true }));
  assert.ok(b.cape.bake(still(caps), { key: 'm/average/0' }), 'no wait: the shared drape');
  assert.equal(b.cape.drape, a.cape.drape);
  // standing still a while, the second one keeps its own (fresh) drape without touching the shared one
  const shared = a.cape.drape.slice();
  for (let k = 0; k < 150; k++) b.cape.update(1 / 60, { ...still(caps), still: true });
  assert.notEqual(b.cape.drape, a.cape.drape);
  assert.deepEqual(a.cape.drape, shared);
});

test('a villager with a cape walking 100 m off wears it (it used to stay in the air where it was last simulated)', () => {
  resetDrapes();
  const scene = new THREE.Scene();
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(600, 600).rotateX(-Math.PI / 2)));
  const physics = new Physics(scene);
  const npc = new NPC(scene, physics, { route: [V(0, 0, 0), V(0, 0, 40)], cape: 1.2, lines: ['…'], world: 'desert' });
  assert.ok(npc.cape, 'a cape');
  const player = { pos: V(0, 0, -20), vel: V(), riding: false, ride: null, wind: V() };
  const camera = new THREE.PerspectiveCamera();
  const at = (z) => camera.position.set(0, 2, z);
  // close by first: the cloth is simulated
  at(-8);
  for (let f = 0; f < 90; f++) npc.update(1 / 60, player, camera);
  assert.equal(npc.cape.hung, false);
  // you walk off: 100 m away it hangs on them as they walk their loop
  player.pos.set(0, 0, -100); at(-100);
  for (let f = 0; f < 600; f++) npc.update(1 / 60, player, camera);
  assert.ok(npc.cape.hung && npc.cape.mesh.visible, 'hung, and shown');
  npc.object.updateMatrixWorld(true);
  const torso = (npc.char.capeAnchor ?? npc.char.torso).getWorldPosition(V());
  let far = 0;
  for (let i = 0; i < npc.cape.p.length; i += 3) far = Math.max(far, world(npc.cape, i).distanceTo(torso));
  assert.ok(far < 2, `the cape is on them (${far.toFixed(2)} m from the shoulders at most)`);
  assert.ok(npc.pos.z > 1, 'they did walk');
  // you come back: the cloth goes on from its drape
  player.pos.set(0, 0, npc.pos.z - 20); at(npc.pos.z - 20);
  npc.update(1 / 60, player, camera);
  assert.equal(npc.cape.hung, false);
  assert.equal(npc.cape.ready, true);
});

// Seated people's capes fanned out round them like wings: the cloth fell onto a floor at the seat's
// height, as wide as the world, and its bends (stiff downward, for long standing folds) held it out
// flat like a board. Now a seated cape falls onto the seat and the ground round it (groundField,
// probed under the hips: the bench top, its edges, the ground beyond) and folds where it lands.
const { loadAssets } = await import('./gait-sim.js');
const { groundField } = await import('../src/cape.js');
const { PEOPLE: DESERT } = await import('../src/story/desert-data.js');
const { PEOPLE: BAZAAR } = await import('../src/story/bazaar-data.js');
const { PEOPLE: BURIED } = await import('../src/story/buried-data.js');

/** A seated story person settled on their seat (boxes: [w, h, d, z] under them), and how their cape lies near and far. */
async function seatedCape(def, world, { seat, boxes = [] }) {
  resetDrapes();
  const { lib, human } = await loadAssets();
  const scene = new THREE.Scene();
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(600, 600).rotateX(-Math.PI / 2)));
  let top = 0;
  for (const [w, h, d, z = 0] of boxes) { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d)); b.position.set(0, h / 2, z); scene.add(b); top = Math.max(top, h); }
  scene.updateMatrixWorld(true);
  const npc = new NPC(scene, new Physics(scene), { route: [V(0, top, 0)], seat, def, kind: def.kind, cape: def.cape, palette: def.palette, head: def.head, look: def.look, world, lines: def.lines, lib, human: human[def.kind] });
  npc.heading = 0;
  const player = { pos: V(0, 0, 8), vel: V(), riding: false, ride: null, wind: V() };
  const camera = new THREE.PerspectiveCamera();
  camera.position.set(0, 1.6, 6);
  for (let f = 0; f < 240; f++) npc.update(1 / 60, player, camera);
  const near = lies(npc);
  // you walk away: far off it hangs in its baked drape
  player.pos.set(0, 0, 200); camera.position.set(0, 1.6, 200);
  for (let f = 0; f < 90; f++) npc.update(1 / 60, player, camera);
  return { npc, near, far: lies(npc) };
}

/** spread: the farthest cloth from the body's axis; wing: the same for cloth standing up over the seat (25 cm); hem: how far the hem hangs below the collar. */
function lies(npc) {
  npc.object.updateMatrixWorld(true);
  const c = npc.cape, m = c.hung ? c.mesh.matrixWorld : new THREE.Matrix4(), o = npc.object.position, seatY = npc.pos.y;
  const collar = (npc.char.capeAnchor ?? npc.char.torso).localToWorld(V(0, c.local[1], 0)), p = V();
  let spread = 0, wing = 0, hem = 0, lowest = Infinity;
  for (let i = 0; i < c.p.length; i += 3) {
    p.set(c.p[i], c.p[i + 1], c.p[i + 2]).applyMatrix4(m);
    const d = Math.hypot(p.x - o.x, p.z - o.z);
    spread = Math.max(spread, d);
    if (p.y > seatY + 0.25) wing = Math.max(wing, d);
    if (i >= (c.rows - 1) * c.cols * 3) hem += (collar.y - p.y) / c.cols;
    lowest = Math.min(lowest, p.y - seatY);
  }
  return { spread, wing, hem, lowest, hung: c.hung };
}
const fmt = (r) => `spread ${r.spread.toFixed(2)} m, wing ${r.wing.toFixed(2)} m, hem ${r.hem.toFixed(2)} m under the collar, lowest ${r.lowest.toFixed(2)} m`;

test('a seated cape falls down the back and over the bench, not out like wings (Nour on her bench)', async () => {
  // Qanat's stone bench: 1.5 x 0.42 x 0.5 m; she sits on its cushion, a little behind its middle
  const { npc, near, far } = await seatedCape(DESERT.nour, 'desert', { seat: 0.02, boxes: [[1.5, 0.42, 0.5]] });
  console.log(`  nour: near ${fmt(near)}; far ${fmt(far)}`);
  assert.ok(npc.clothState({ wind: V() }, 0).field, 'seated: the cloth knows the seat');
  for (const [r, when] of [[near, 'simulated'], [far, 'its drape']]) {
    assert.ok(r.spread < 0.9, `${when}: close round her (${fmt(r)}; it spread ~1.2 m)`);
    assert.ok(r.wing < 0.6, `${when}: nothing stands out over the seat (${fmt(r)})`);
    assert.ok(r.hem > 0.45, `${when}: the hem hangs well below the shoulders (${fmt(r)}; it was level with them)`);
    assert.ok(r.lowest < -0.15, `${when}: some of it hangs over the bench's edge (${fmt(r)})`);
  }
  assert.ok(far.hung, 'far off it hangs');
});

test('other seated people: on a stool the cloth falls past, and on a wide ledge', async () => {
  // Sel (the Bazaar): 0.45 m up on a seat the physics doesn't see (a stool, a crate): the cloth falls to the ground
  const sel = await seatedCape(BAZAAR.sel, 'bazaar', { seat: 0.45 });
  // Hask (the Buried City): on a broad ledge, the cloth lies on it round him
  const hask = await seatedCape(BURIED.hask, 'buried', { seat: 0.02, boxes: [[3, 0.5, 3, -1.2]] });
  for (const [who, { near, far }] of [['sel', sel], ['hask', hask]]) {
    console.log(`  ${who}: near ${fmt(near)}; far ${fmt(far)}`);
    for (const r of [near, far]) {
      assert.ok(r.spread < 0.9 && r.wing < 0.65, `${who}: close round them (${fmt(r)})`);
      assert.ok(r.hem > 0.3, `${who}: hanging down, not out (${fmt(r)})`);
    }
  }
  assert.ok(sel.near.lowest < -0.3, `Sel: down to the ground (${fmt(sel.near)})`);
  assert.ok(hask.near.lowest > -0.1, `Hask: on the ledge (${fmt(hask.near)})`);
});

test('the ground round a seat: the bench top under the hips, the ground past its edges', () => {
  const scene = new THREE.Scene();
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(50, 50).rotateX(-Math.PI / 2)));
  const b = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.42, 0.5)); b.position.set(0, 0.21, 0); scene.add(b);
  const b2 = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.42, 1.5)); b2.position.set(10, 0.21, 0); scene.add(b2);
  scene.updateMatrixWorld(true);
  const physics = new Physics(scene), groundAt = (x, y, z, d) => physics.groundAt(x, y, z, d);
  const F = groundField(groundAt, V(0, 0.44, -0.1), 0);
  const at = (u, v) => F.h[Math.round((v + F.half) / F.step) * F.n + Math.round((u + F.half) / F.step)];
  assert.ok(Math.abs(at(0, 0) + 0.02) < 0.01, 'under the hips: the bench top');
  assert.ok(Math.abs(at(0, -0.36) + 0.44) < 0.01, 'behind: the ground');
  assert.ok(Math.abs(at(0.6, 0.1) + 0.02) < 0.01 && Math.abs(at(0.96, 0.1) + 0.44) < 0.01, 'along the bench, then past its end');
  // the same seat turned round: the same shape (a drape is shared between people on one kind of seat)
  assert.equal(groundField(groundAt, V(9.9, 0.44, 0), Math.PI / 2).sig, F.sig);
});

test('standing, the cloth is as it was: the plain ground under the feet, the standing drape', () => {
  const scene = new THREE.Scene();
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(50, 50).rotateX(-Math.PI / 2)));
  scene.updateMatrixWorld(true);
  const npc = new NPC(scene, new Physics(scene), { route: [V(0, 0, 0)], cape: 1.2, lines: ['~neutral~ …'], world: 'desert' });
  assert.equal(npc.clothState({ wind: V() }, 0).field, null);
  assert.equal(npc.drapeKey(), 'rig/0');
});
