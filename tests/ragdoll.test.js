import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Humanoid, prepareHuman } from '../src/humanoid.js';
import { buildCharacter } from '../src/player.js';
import { Ragdoll, Knockdown, J, JOINTS, KNOCK } from '../src/ragdoll.js';

globalThis.ProgressEvent ??= class { constructor(type, init) { Object.assign(this, { type }, init); } };
async function glb(name) {
  const bytes = await readFile(new URL(`../public/anim/${name}`, import.meta.url));
  const length = bytes.readUInt32LE(12);
  const json = JSON.parse(bytes.subarray(20, 20 + length));
  json.buffers[0].uri = `data:application/octet-stream;base64,${bytes.subarray(28 + length).toString('base64')}`;
  return (await new GLTFLoader().parseAsync(JSON.stringify(json), '')).scene;
}
const human = prepareHuman(await glb('human_m.glb'), 'm');
const Y = new THREE.Vector3(0, 1, 0);
const flat = { heightAbove: (p) => p.y, pushCapsule: () => null };
const body = (at = new THREE.Vector3()) => {
  const char = buildCharacter();
  new THREE.Scene().add(char.root);
  char.root.position.copy(at);
  const H = new Humanoid(human, char, 'm');
  H.update();
  return H;
};

test('ragdoll: a body knocked over falls, lies still on the ground and keeps its shape', () => {
  const H = body();
  const rag = new Ragdoll().startFrom(H, new THREE.Vector3(0, -6, 4));
  const len = rag.links.map(([, , l]) => l);
  let t = 0;
  for (; t < 5 && !rag.settled; t += 1 / 60) rag.step(1 / 60, flat, Y);
  assert.ok(rag.settled, `settles (${rag.speed.toFixed(2)} m/s after ${t.toFixed(1)} s)`);
  for (let i = 0; i < JOINTS.length; i++) assert.ok(rag.x[i].y >= rag.r[i] - 0.02, `${JOINTS[i][0]} on the ground, not in it (${rag.x[i].y.toFixed(2)})`);
  assert.ok(rag.x[J.head].y < 0.5 && rag.x[J.chest].y < 0.5, 'lying down');
  rag.links.forEach(([i, j, , k], n) => { if (k === 1) assert.ok(Math.abs(rag.x[i].distanceTo(rag.x[j]) - len[n]) < 0.05, `${JOINTS[i][0]}-${JOINTS[j][0]} keeps its length`); });
  // the knees bend forward only
  for (const [h, k, f] of [[J.hipL, J.kneeL, J.footL], [J.hipR, J.kneeR, J.footR]]) {
    const L = rag.x[J.hipL].clone().sub(rag.x[J.hipR]).normalize();
    const n = rag.x[k].clone().sub(rag.x[h]).cross(rag.x[f].clone().sub(rag.x[k]));
    assert.ok(n.dot(L) > -0.02, 'no knee bent backward');
  }
});

test('ragdoll: it holds on a gentle slope instead of sliding forever', () => {
  const slope = { heightAbove: (p) => p.y - p.x * 0.25, pushCapsule: () => null };   // ~14°
  const H = body();
  const rag = new Ragdoll().startFrom(H, new THREE.Vector3(0, -5, 0));
  let t = 0;
  for (; t < 5 && !rag.settled; t += 1 / 60) rag.step(1 / 60, slope, Y);
  assert.ok(rag.settled, `settles on the slope (${rag.speed.toFixed(2)} m/s)`);
});

test('ragdoll: it poses the skeleton on its particles', () => {
  const H = body(new THREE.Vector3(5, 2, 1));
  const rag = new Ragdoll().startFrom(H, new THREE.Vector3(3, 0, -2));
  for (let i = 0; i < 90; i++) rag.step(1 / 60, flat, Y);
  rag.apply(H);
  for (const [name, bone] of JOINTS) {
    const p = H.b[bone].getWorldPosition(new THREE.Vector3());
    assert.ok(p.distanceTo(rag.x[J[name]]) < 0.09, `${bone} on its particle (${p.distanceTo(rag.x[J[name]]).toFixed(3)} m off)`);
  }
  H.char.root.traverse((o) => { if (o.isBone) assert.ok(Number.isFinite(o.quaternion.x + o.position.x), 'no NaN'); });
});

test('knockdown: falls, lies a moment, gets up into the standing pose; the dead stay down', () => {
  const H = body();
  const kd = new Knockdown(H).start(new THREE.Vector3(2, -4, 0));
  let up = false, t = 0;
  for (; t < 8 && !up; t += 1 / 60) {
    if (kd.phase === 'rise') {
      // the owner's standing pose: the rig where the body lies, then the blend
      H.char.root.position.copy(kd.rag.groundSpot(flat, Y));
      H.char.root.quaternion.identity();
      H.update();
      up = kd.rise(1 / 60, Y);
    } else if (kd.update(1 / 60, flat, Y)) kd.beginRise();
  }
  assert.ok(up, `back on the feet after ${t.toFixed(1)} s`);
  assert.ok(t < KNOCK.maxFall + KNOCK.lie + KNOCK.rise + 0.5, 'never long');
  const head = H.b.Head.getWorldPosition(new THREE.Vector3());
  assert.ok(head.y > 1.4, `standing (head at ${head.y.toFixed(2)} m)`);
  const dead = new Knockdown(body(), { dead: true }).start(new THREE.Vector3(0, -10, 0));
  let rise = false;
  for (let i = 0; i < 600; i++) rise ||= dead.update(1 / 60, flat, Y);
  assert.equal(dead.phase, 'lie');
  assert.equal(rise, false, 'never gets up on its own');
});

test('ragdoll: on a mesh floor the trunk capsule lifts it, and it still stops (it used to slide on for ever)', () => {
  // a floor only the capsule cast sees, the rays' ground far below
  const deck = {
    heightAbove: (p) => p.y + 50,
    pushCapsule(pos, r, bottom, top, out, axis) {
      const a = pos.clone().addScaledVector(axis, bottom + r), b = pos.clone().addScaledVector(axis, top - r);
      const low = Math.min(a.y, b.y) - r;
      if (low >= 0) return null;
      out.set(0, -low, 0); pos.add(out); return out;
    },
  };
  const H = body();
  const rag = new Ragdoll().startFrom(H, new THREE.Vector3(5, -2, 0));
  let t = 0;
  for (; t < 5 && !rag.settled; t += 1 / 60) rag.step(1 / 60, deck, Y);
  assert.ok(rag.settled, `settles (${rag.speed.toFixed(2)} m/s)`);
  assert.ok(rag.pelvis.x < 6, `slid only a little (${rag.pelvis.x.toFixed(1)} m)`);
});

test('people: a close push knocks someone right over; they get up where they lie', async () => {
  const { NPC } = await import('../src/npc.js');
  const hadDoc = 'document' in globalThis;
  if (!hadDoc) globalThis.document = { createElement: () => ({ className: '', style: {}, classList: { add() {}, remove() {}, toggle() {} } }), body: { appendChild() {} } };
  const scene = new THREE.Scene();
  const ground = { ...flat, groundAt: () => 0 };
  const v = (x, y, z) => new THREE.Vector3(x, y, z);
  const camera = new THREE.PerspectiveCamera(); camera.position.set(0, 2, 6); camera.updateMatrixWorld();
  const walker = { pos: v(0, 0, 0), vel: v(0, 0, 0), ride: null, riding: false, wind: v(0, 0, 0) };
  const npc = new NPC(scene, ground, { route: [v(0, 0, -3)], palette: {}, lines: ['~neutral~ …'], human });
  npc.update(1 / 60, walker, camera);
  const from = npc.pos.clone();
  npc.hit('push', v(0, 0, -1), { strength: 0.9, shove: 2.4 });
  assert.ok(npc.down, 'knocked over');
  assert.ok(npc.shout?.text, 'and says so');
  let t = 0;
  for (; t < 8 && npc.down; t += 1 / 60) npc.update(1 / 60, walker, camera);
  assert.ok(!npc.down, `up again after ${t.toFixed(1)} s`);
  assert.ok(npc.pos.z < from.z - 0.5, `knocked back, away from the traveller (${(from.z - npc.pos.z).toFixed(2)} m)`);
  npc.object.updateMatrixWorld(true);
  assert.ok(npc.humanoid.b.Head.getWorldPosition(v(0, 0, 0)).y > 1.2, 'standing');
  const far = new NPC(scene, ground, { route: [v(4, 0, -3)], palette: {}, lines: ['~neutral~ …'], human });
  far.hit('push', v(0, 0, -1), { strength: 0.1, shove: 2.4 });
  assert.ok(!far.down && far.time < far.stumbleUntil, 'a push from the edge of the cone only makes them stumble');
  if (!hadDoc) delete globalThis.document;
});

test('the traveller: a hard landing goes limp on the ragdoll, the place follows the body, then up again', async () => {
  const { Player } = await import('../src/player.js');
  const ground = { ...flat, groundAt: () => 0, rayDistance: () => Infinity, groundNormal: () => new THREE.Vector3(0, 1, 0) };
  const p = new Player(ground);
  p.humanoid = new Humanoid(human, p.char, 'm');
  p.attach(new THREE.Scene());
  p.pos.set(0, 20, 0); p.vel.set(0, 0, 6); p.onGround = false;
  for (let i = 0; i < 300 && !p.down; i++) p.update(1 / 60, {}, 0);
  assert.ok(p.down?.H, 'down, on the ragdoll');
  const at = p.pos.clone();
  for (let i = 0; i < 30; i++) p.update(1 / 60, {}, 0);
  assert.ok(Math.abs(p.pos.y) < 0.3, 'its place is on the ground under the body');
  let t = 0;
  for (; t < 8 && p.down; t += 1 / 60) p.update(1 / 60, {}, 0);
  assert.ok(!p.down, `back up after ${t.toFixed(1)} s`);
  assert.ok(p.pos.distanceTo(at) < 4, 'about where it fell');
  p.object.updateMatrixWorld(true);
  assert.ok(p.humanoid.b.Head.getWorldPosition(new THREE.Vector3()).y > 1.4, 'standing');
});

test('knockdown: a long fall through the air never ends in the air (it used to stop after a few seconds and get up there)', () => {
  // the ground 400 m down: ~5 s of falling, past KNOCK.maxFall
  const cliff = { heightAbove: (p) => p.y + 400, pushCapsule: () => null };
  const kd = new Knockdown(body()).start(new THREE.Vector3(2, 0, 0));
  let t = 0, rose = false;
  for (; t < KNOCK.maxFall + 1; t += 1 / 60) rose ||= kd.update(1 / 60, cliff, Y);
  assert.equal(kd.phase, 'fall', `still falling after ${t.toFixed(1)} s`);
  assert.equal(rose, false, 'no getting up in mid-air');
  assert.ok(!kd.rag.grounded && kd.rag.pelvis.y < -100, `and still coming down (${kd.rag.pelvis.y.toFixed(0)} m)`);
  // on the ground at last: a landing at speed (the owner hurts for it), then it lies, then up
  let landing = 0;
  for (; t < 20 && kd.phase === 'fall'; t += 1 / 60) { kd.update(1 / 60, cliff, Y); landing = Math.max(landing, kd.rag.takeLanding()); }
  assert.ok(kd.phase === 'lie' && kd.rag.pelvis.y < -399, `lying on the ground below (${kd.rag.pelvis.y.toFixed(1)} m)`);
  assert.ok(landing > 60, `the landing's speed is known (${landing.toFixed(0)} m/s)`);
  for (; t < 30 && !rose; t += 1 / 60) rose = kd.update(1 / 60, cliff, Y);
  assert.ok(rose, 'and then gets up, on the ground');
});

test('the traveller: tumbling off a ledge down a long drop stays limp all the way down, gets up only on the ground, and the landing hurts', async () => {
  const { Player, FALL } = await import('../src/player.js');
  // a ledge at 0 for x < 1, the ground 300 m below beyond it
  const h = (p) => p.x < 1 ? p.y : p.y + 300;
  const ledge = { heightAbove: h, groundAt: (x, y, z) => -h({ x, y: 0, z }), rayDistance: () => Infinity, pushCapsule: () => null, groundNormal: () => new THREE.Vector3(0, 1, 0) };
  const p = new Player(ledge);
  p.humanoid = new Humanoid(human, p.char, 'm');
  p.attach(new THREE.Scene());
  p.pos.set(0.6, 0, 0); p.onGround = true;
  for (let i = 0; i < 10; i++) p.update(1 / 60, {}, 0);
  p.knockDown(new THREE.Vector3(12, -2, 0));
  let t = 0, worst = 0;
  for (; t < 20 && p.down && !p.dead; t += 1 / 60) {
    p.update(1 / 60, {}, 0);
    if (p.down?.phase === 'rise' || p.down?.phase === 'lie') worst = Math.max(worst, p.down.rag.pelvis.y - (-300));
  }
  assert.ok(p.pos.y < -295, `down at the bottom (${p.pos.y.toFixed(1)} m)`);
  assert.ok(worst < 1.5, `it only lies and gets up on the ground (pelvis ${worst.toFixed(1)} m over it at most)`);
  assert.ok(p.dead && p.health === 0, 'a 300 m fall is fatal, ragdoll or not');
  // a shorter drop (~25 m) hurts a little, and you get up at the bottom
  const q = new Player({ ...ledge, heightAbove: (pt) => pt.x < 1 ? pt.y : pt.y + 25, groundAt: (x) => x < 1 ? 0 : -25 });
  q.humanoid = new Humanoid(human, q.char, 'm');
  q.attach(new THREE.Scene());
  q.pos.set(0.6, 0, 0); q.onGround = true;
  for (let i = 0; i < 10; i++) q.update(1 / 60, {}, 0);
  q.knockDown(new THREE.Vector3(12, -2, 0));
  for (t = 0; t < 12 && q.down; t += 1 / 60) q.update(1 / 60, {}, 0);
  assert.ok(!q.down && q.pos.y < -24, `up at the bottom (${q.pos.y.toFixed(1)} m)`);
  assert.ok(q.hearts < q.maxHearts && q.hearts >= q.maxHearts - FALL.worst, `a little hurt (${q.hearts} hearts)`);
});
