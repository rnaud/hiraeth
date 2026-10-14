// The Keeper made fair for a first guardian (issues #314, #315, #316; docs/systems/foes.md "The first guardian, fair"):
// its tells and the breath between its blows, an opening in every phase for a player who dodges or guards (its last
// phase had none), its blows landing with its posed bones (they took floor up to 13.7 m from its body), the lock on its
// mouth (it was on its middle, 5.6 m under it), a contact shadow under it (its cistern has no sun to cast one), its walk
// and its turns, and the traveller's sidestep circling a locked foe (it drifted off it 0.2 m a metre).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import './register-gadgets.js';
import { keeperGuardian } from '../src/temples/guardian-generated.js';
import { Guardian, windOf, comboOf, GroundShadow } from '../src/temples/boss.js';
import { KEEPER, KEEPER_DARK } from '../src/temples/desert.js';
import { templeOf } from '../src/temples/index.js';
import { buildableById } from '../src/levels/buildable.js';
import { Physics } from '../src/physics.js';
import { guardianLock } from '../src/foes.js';
import { guardianHitboxes } from '../src/hitboxes.js';
import { selfLitSkips } from '../src/shadows.js';
import { KEEPER_GAIT } from '../src/characters/keeper-creature.js';

globalThis.ProgressEvent ??= class { constructor(type, v) { this.type = type; Object.assign(this, v); } };
const PUBLIC = new URL('../public/', import.meta.url);
GLTFLoader.prototype.load = function (url, onLoad, onProgress, onError) {
  try {
    const bytes = fs.readFileSync(new URL(String(url).replace(/^\/+/, ''), PUBLIC)), len = bytes.readUInt32LE(12), json = JSON.parse(bytes.subarray(20, 20 + len));
    for (const m of json.meshes) for (const p of m.primitives) delete p.material;
    delete json.materials; delete json.textures; delete json.images;
    json.buffers[0].uri = 'data:application/octet-stream;base64,' + bytes.subarray(28 + len).toString('base64');
    this.parse(JSON.stringify(json), '', onLoad, onError);
  } catch (e) { onError?.(e); }
};
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const DT = 1 / 60;
const quiet = (fn) => { const w = console.warn; console.warn = () => {}; try { return fn(); } finally { console.warn = w; } };
const fakePlayer = () => ({ pos: V(), vel: V(), heading: 0, dead: false, down: null, hearts: 3, maxHearts: 3, hurts: [], hurt(d) { this.hurts.push(d); }, knockDown() {} });

/** The Keeper on its skin in a plain ring (flat floor at 0), a still traveller 7 m before it. */
async function ring() {
  const m = keeperGuardian(), P = fakePlayer();
  const rt = { def: { id: 'keeper-fair' }, root: new THREE.Group(), logic: { resolved: false }, physics: { groundAt: () => 0 }, player: P, notice() {}, rumble() {} };
  rt.root.add(m.group);
  await m.ready;
  const g = new Guardian(rt, { def: KEEPER, model: m, arena: { center: V(), r: 30, y: 0 } });
  m.pos.set(0, 0, 0); m.heading = 0; g.enter('fight'); g.cool = 99;
  P.pos.set(0, 0, 7);
  let t = 0;
  const run = (s) => { for (let i = 0; i < s / DT; i++) g.update(DT, (t += DT)); };
  run(1);
  return { m, g, P, rt, run };
}

test('its tells and the breath between its blows: every move ≥ 1.3 s, every link ≥ 0.85 s, a combo’s blows ≥ 1.2 s apart, lighter blows', () => {
  for (const [id, a] of Object.entries(KEEPER.attacks)) {
    if (a.link) assert.ok(windOf(a) >= 0.85, `${id}: a link of ${windOf(a)} s`);
    else assert.ok(windOf(a) >= 1.3, `${id}: a tell of ${windOf(a)} s`);
    if (a.then) assert.ok((a.gap ?? 0.25) + windOf(KEEPER.attacks[a.then]) >= 1.2, `${id} → ${a.then}: the next blow ${(a.gap ?? 0.25) + windOf(KEEPER.attacks[a.then])} s after`);
    assert.ok(a.damage <= 0.75, `${id}: ${a.damage} of a heart at most`);
    assert.ok(a.then || a.open > 0, `${id}: it opens after it`);
  }
  // the three-blow sweep only in its last phase; its pauses longer than before (1.8 / 1.5 / 1.3 s)
  const longest = (p) => Math.max(...p.attacks.map((x) => comboOf(KEEPER, x).length));
  const P = KEEPER.phases.filter((p) => !p.weary);
  assert.ok(longest(P[0]) <= 2 && longest(P[1]) <= 2 && longest(P[2]) === 3, `combos ${P.map(longest)}`);
  assert.deepEqual(P.map((p) => p.pause), [2.4, 2, 1.8]);
});

test('an opening in every phase for a traveller who dodges or guards, its last phase too (in the dark: a gasp)', () => {
  const scene = new THREE.Scene();
  const level = quiet(() => buildableById('desert').create(scene));
  const physics = new Physics(scene, level.ground.heightAt ? level.ground : null);
  level.init?.(physics);
  const rt = templeOf(level, 'desert'), g = rt.guardian, A = g.arena, P = fakePlayer();
  quiet(() => rt.connect({ player: P }));
  let t = 0;
  for (let i = 0; i < 3; i++) for (const manner of ['dodge', 'guard']) {
    g.stop(); g.meter = g.floor = i ? KEEPER.phases[i - 1].to : 0; g.enter('fight'); g.cool = 1;
    P.pos.set(g.model.pos.x, A.y, g.model.pos.z + 9); P.guard = manner === 'guard' ? () => true : null;
    let opens = 0, was = g.state, shortest = Infinity, openAt = 0;
    for (let f = 0; f < 60 / DT; f++) {
      // (the dodger is in the air over every blow's live window)
      P.pos.y = A.y + (manner === 'dodge' && g.attack && g.at > g.windFor - 0.1 && g.at < g.windFor + 0.6 ? 6 : 0);
      g.update(DT, (t += DT));
      if (g.phaseIndex !== i) { g.meter = g.floor = i ? KEEPER.phases[i - 1].to : 0; if (g.state !== 'fight' && g.state !== 'open') g.enter('fight'); }
      if (g.state === 'open' && was !== 'open') { opens++; openAt = t; }
      if (g.state !== 'open' && was === 'open') shortest = Math.min(shortest, t - openAt);
      was = g.state; P.down = null;
    }
    assert.ok(opens >= 3, `phase ${i + 1}, ${manner}: ${opens} openings in a minute`);
    assert.ok(shortest >= 1.5, `phase ${i + 1}, ${manner}: each long enough to water it (${shortest.toFixed(2)} s)`);
    if (i === 2) assert.ok(shortest <= KEEPER_DARK.open + 0.05, 'in the dark, a gasp');
  }
  rt.dispose?.();
});

test('its blows land with its posed bones: the sweep’s jaw where the jaw is, nothing on the floor its old cone took', async () => {
  const { m, g, P, run } = await ring();
  const inner = m.inner, a = { id: 'sweep', ...KEEPER.attacks.sweep };
  assert.ok(g.bodyBlow(a), 'the skin strikes with its bones');
  // the parts are its bones: the jaw's tip, the head, the neck's top
  const parts = g.partsOf(a, []);
  assert.ok(parts[0].c.distanceTo(m.mouth) < 1e-6 && parts[1].c.distanceTo(inner.head.getWorldPosition(V())) < 1e-6, 'on the jaw and the head');
  // a bone turned: its sphere goes with it
  const before = g.partsOf(a, [])[1].c.clone();
  inner.neck[0].rotation.x += 0.6; inner.group.updateMatrixWorld(true);
  assert.ok(g.partsOf(a, [])[1].c.distanceTo(before) > 1, `the head’s sphere follows the neck (${g.partsOf(a, [])[1].c.distanceTo(before).toFixed(2)})`);
  // played: it swings its lowered head across through a traveller beside its path, and not one 9 m out
  for (const [at, hit] of [[V(1.5, 0, 6), true], [V(0, 0, 9.5), false], [V(4.5, 0, 9), false]]) {
    g.stop(); g.enter('fight'); g.cool = 99; m.pos.set(0, 0, 0); m.heading = 0; run(0.5);
    P.pos.copy(at); P.hurts.length = 0;
    g.begin(P, null, 'sweep');
    // (its aim held straight ahead: the test is where its body goes, not where it turns)
    for (let i = 0; i < 2.2 / DT && g.attack?.id === 'sweep'; i++) { m.heading = 0; g.update(DT, 10 + i * DT); }
    assert.equal(P.hurts.length > 0, hit, `the sweep ${hit ? 'catches' : 'misses'} a traveller at (${at.x}, ${at.z})`);
    if (!hit) assert.ok(KEEPER.attacks.sweep.range < 12, 'and the old cone (12 m) is gone from the fallback too');
  }
  // what its blow would take is what the overlay draws: the spheres of its parts, live after the strike
  g.stop(); g.enter('fight'); g.begin(P, null, 'stamp'); run(KEEPER.attacks.stamp.wind + 0.02);
  const shapes = guardianHitboxes(g, []);
  assert.ok(shapes.some((s) => s.tag === 'guardian.stamp' && s.kind === 'sphere'), 'drawn on its feet');
  assert.ok(shapes.some((s) => s.tag === 'guardian.mouth'), 'and its weak point');
  g.dispose(); m.dispose();
});

test('the lock aims at its mouth, and its reticle rings its head; the procedural body too (v1.70, #319: every guardian on its weak point)', async () => {
  const { m, g } = await ring();
  const L = guardianLock(g);
  assert.ok(L.aim.distanceTo(m.mouth) < 1e-6, 'the lock’s aim is its mouth');
  assert.ok(L.aim.distanceTo(L.chest) > 3, `not its middle (${L.aim.distanceTo(L.chest).toFixed(1)} m apart)`);
  assert.equal(L.aimR, m.mouthR);
  const { LockReticle } = await import('../src/lock-reticle.js');
  const cam = new THREE.PerspectiveCamera(55, 16 / 9, 0.3, 500);
  cam.position.set(0, 3, 16); cam.lookAt(L.chest); cam.updateMatrixWorld(true);
  const box = LockReticle.prototype.screenBox.call({ span: {} }, L, cam, 1600, 900);
  const p = L.aim.clone().project(cam), cx = (p.x * 0.5 + 0.5) * 1600, cy = (0.5 - p.y * 0.5) * 900;
  assert.ok(Math.abs((box.x0 + box.x1) / 2 - cx) < 1 && Math.abs((box.y0 + box.y1) / 2 - cy) < 1, 'the ring round its mouth');
  g.dispose(); m.dispose();
  // (the procedural body, a skin that never loaded: its mouth all the same, as every guardian since v1.70)
  const old = keeperGuardian({ load: () => Promise.reject(new Error('offline')) });
  await old.ready;
  const rt = { def: { id: 'k-old' }, root: new THREE.Group(), logic: { resolved: false }, physics: { groundAt: () => 0 }, player: fakePlayer(), notice() {} };
  const g2 = quiet(() => new Guardian(rt, { def: KEEPER, model: old, arena: { center: V(), r: 20, y: 0 } }));
  const L2 = guardianLock(g2);
  assert.ok(L2.aim.distanceTo(old.mouth) < 1e-6 && L2.aimR === Math.max(1, old.mouthR));
  g2.dispose();
});

test('it is grounded: its skin in the shadow passes, and a contact shadow under its body and each foot, the feet’s shrinking as they lift', async () => {
  const { m, g, run } = await ring();
  const meshes = []; m.group.traverse((o) => { if (o.isSkinnedMesh) meshes.push(o); });
  assert.ok(meshes.length && meshes.every((o) => !selfLitSkips(o) && o.material.allowOverride !== false), 'the skin casts in the sun');
  assert.ok(g.ground instanceof GroundShadow && g.ground.group.parent === g.rt.root);
  const [body, ...feet] = g.ground.spots;
  assert.equal(feet.length, 6, 'a spot for each foot');
  // walking: each spot under its foot, a lifted one smaller
  let lifted = 0;
  for (let i = 0; i < 240; i++) {
    m.pos.z += 2.2 * DT; run(DT);
    const c = m.body.getWorldPosition(V());
    assert.ok(Math.hypot(body.position.x - c.x, body.position.z - c.z) < 1e-6 && Math.abs(body.position.y - m.pos.y) < 0.1, 'the body’s patch under its body');
    m.kit.rig.planner.feet.forEach((f, k) => {
      assert.ok(Math.hypot(feet[k].position.x - f.pos.x, feet[k].position.z - f.pos.z) < 1e-6, `foot ${k}’s spot under it`);
      if (!f.planted && f.pos.y > 0.3) { lifted++; assert.ok(feet[k].scale.x < m.shadow.feet); }
    });
  }
  assert.ok(lifted > 10, 'and the feet lifted as it walked');
  g.dispose(); m.dispose();
});

test('its walk and its turns: higher, quicker steps than its shuffle, the shell rolling over them, a turn its feet can step round', async () => {
  const { m, g, run } = await ring();
  assert.ok(KEEPER_GAIT.gait.height >= 0.15 && KEEPER_GAIT.gait.drift <= 0.2 && KEEPER_GAIT.body.bob >= 0.03, 'the gait (was a lift of 0.08 leg, strides of 0.3, a bob of 0.008)');
  // turning in place, as fast as it may: every foot steps it round, none dragged
  m.pos.set(0, 0, 0); g.stop(); g.enter('open'); g.openFor = 99; run(1);
  const P = m.kit.rig.planner.feet, steps = P.map(() => 0), was = P.map((f) => f.planted), at = P.map((f) => f.pos.clone());
  let drag = 0;
  const before = m.heading;
  g.face(1 / 60, V(0, 0, -10), 99);
  assert.ok(Math.abs(m.heading - before) <= m.turnRate / 60 + 1e-9, `no faster than ${m.turnRate} rad/s, whatever it is asked`);
  for (let i = 0; i < 2.2 / DT; i++) {
    m.heading += m.turnRate * DT; run(DT);
    P.forEach((f, k) => {
      if (f.planted && was[k]) drag = Math.max(drag, Math.hypot(f.pos.x - at[k].x, f.pos.z - at[k].z));
      if (!f.planted && was[k]) steps[k]++;
      was[k] = f.planted; if (f.planted) at[k].copy(f.pos);
    });
  }
  assert.ok(steps.every((n) => n >= 1), `every foot steps round (${steps})`);
  assert.ok(drag < 0.02, `no planted foot dragged (${drag.toFixed(3)} m)`);
  g.dispose(); m.dispose();
});

test('the traveller’s sidestep, locked on: the strafe and the side hop circle the foe at the distance he stood', async () => {
  const { traveller, course, CAM_PLUS_Z } = await import('./gait-sim.js');
  const { items } = await import('../src/items.js');
  items.grant('backpack');
  const scene = course({ ramp: false, stairs: false });
  const p = await traveller(scene, V(0, 0, -60), { moves: true, body: 'v1' });
  const foe = V(0, 0, -53);
  const lock = () => { p.lockOn = { dir: V(foe.x - p.pos.x, 0, foe.z - p.pos.z).normalize(), at: foe }; };
  const d = () => Math.hypot(foe.x - p.pos.x, foe.z - p.pos.z);
  for (let i = 0; i < 60; i++) { lock(); p.update(DT, {}, CAM_PLUS_Z); }
  // (the camera held still, as a trailing lock camera is: the stick is read against the foe all the same)
  for (const keys of [{ KeyD: true }, { KeyA: true }]) {
    const d0 = d();
    let moved = 0, last = p.pos.clone();
    for (let i = 0; i < 2 / DT; i++) { lock(); p.update(DT, keys, CAM_PLUS_Z); moved += p.pos.distanceTo(last); last.copy(p.pos); }
    assert.ok(moved > 5, `it stepped (${moved.toFixed(1)} m)`);
    assert.ok(Math.abs(d() - d0) < 0.25, `round it at ${d0.toFixed(2)} m, not off it (${d().toFixed(2)} m after ${moved.toFixed(1)} m)`);
  }
  // the side hop: carried round it too
  for (let i = 0; i < 30; i++) { lock(); p.update(DT, {}, CAM_PLUS_Z); }
  const d0 = d();
  for (let i = 0; i < 3; i++) { lock(); p.update(DT, { KeyD: true }, CAM_PLUS_Z); }
  lock(); p.update(DT, { KeyD: true, Space: true }, CAM_PLUS_Z);
  assert.ok(['left', 'right'].includes(p.hopping?.kind), 'a side hop');
  for (let i = 0; i < 50 && !p.onGround; i++) { lock(); p.update(DT, { KeyD: true }, CAM_PLUS_Z); }
  for (let i = 0; i < 20; i++) { lock(); p.update(DT, {}, CAM_PLUS_Z); }
  assert.ok(Math.abs(d() - d0) < 0.25, `the hop lands round it (${d0.toFixed(2)} → ${d().toFixed(2)} m)`);
});
