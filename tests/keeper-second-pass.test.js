// The Keeper's second pass (issues #320, #321, #331; docs/systems/foes.md "The first guardian, a second pass"): its skin
// turned the way the fight faces it (it was turned π − h), its legs never through each other, its body inside the
// cistern's wall, a leap in place of the burrow, no spark for a tell, three phases of two calming acts each, the boss
// framing and the steady lock, and the traveller knocked back on his feet by a blow, not ragdolled.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import './register-gadgets.js';
import { keeperGuardian } from '../src/temples/guardian-generated.js';
import { Guardian } from '../src/temples/boss.js';
import { KEEPER, KEEPER_GUARD, KEEPER_LIGHT, KEEPER_DARK } from '../src/temples/desert.js';
import { templeOf } from '../src/temples/index.js';
import { buildableById } from '../src/levels/buildable.js';
import { Physics } from '../src/physics.js';
import { guardianLock, STEADY } from '../src/foes.js';
import { CameraRig, BOSS_CAM, OPEN_DIST, STAGGER } from '../src/player.js';

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
const quiet = (fn) => { const w = console.warn, l = console.log; console.warn = console.log = () => {}; try { return fn(); } finally { console.warn = w; console.log = l; } };
const fakePlayer = () => ({ pos: V(), vel: V(), heading: 0, dead: false, down: null, hearts: 3, maxHearts: 3, hurts: [], knocks: 0, hurt(d) { this.hurts.push(d); }, knockDown() { this.knocks++; } });

/**
 * The retained Keeper combat definition in the real cistern's hooks, floor and wall, on its skin. The story layout
 * now offers a helping game (#623); these legacy combat/rig regressions explicitly stage the raw combat controller.
 * One for the file (the desert is a big level to build), reset at home with its braziers out for each test.
 */
let staged = null;
async function cistern() {
  staged ??= stageCistern();
  const S = await staged, { g, rt, P } = S;
  g.stop(); g.reset(); g.meter = g.floor = 0; g.answered = undefined; g.cool = 2.5;
  for (const id of ['b6', 'b7', 'b8', 'b9']) rt.logic.store.set(`lit.${id}`, false);
  Object.assign(P, { dead: false, down: null, hurts: [], guard: null });
  S.rt.dispose = () => {};
  return S;
}
async function stageCistern() {
  const scene = new THREE.Scene();
  const level = quiet(() => buildableById('desert').create(scene));
  const physics = new Physics(scene, level.ground.heightAt ? level.ground : null);
  level.init?.(physics);
  const rt = templeOf(level, 'desert'), helper = rt.guardian, P = fakePlayer();
  quiet(() => rt.connect({ player: P }));
  await helper.model.ready;
  assert.equal(helper.def.helper, 'cistern', 'the actual story layout is peaceful');
  const { helper: _help, ...combatDef } = helper.def;
  helper.dispose();
  const g = rt.guardian = new Guardian(rt, { def: combatDef, model: helper.model, arena: helper.arena });
  let t = 0;
  const step = () => { g.update(DT, (t += DT)); P.down = null; };
  return { rt, g, P, m: g.model, A: g.arena, step };
}
/** Leg i's two segments (hip-knee, knee-ankle) in the world. */
const legs = (m) => Array.from({ length: 6 }, (_, i) => ['thigh', 'shin', 'foot'].map((b) => m.inner.bones[`leg${i}_${b}`].getWorldPosition(V())));
function segDist(p1, q1, p2, q2) {
  const d1 = q1.clone().sub(p1), d2 = q2.clone().sub(p2), r = p1.clone().sub(p2);
  const a = d1.dot(d1), e = d2.dot(d2), f = d2.dot(r), c = d1.dot(r), b = d1.dot(d2), den = a * e - b * b;
  let s = den > 1e-9 ? THREE.MathUtils.clamp((b * f - c * e) / den, 0, 1) : 0, u = (b * s + f) / e;
  if (u < 0) { u = 0; s = THREE.MathUtils.clamp(-c / a, 0, 1); } else if (u > 1) { u = 1; s = THREE.MathUtils.clamp((b - c) / a, 0, 1); }
  return p1.clone().addScaledVector(d1, s).distanceTo(p2.clone().addScaledVector(d2, u));
}
/** The least distance between two different legs' segments now (m). */
function closestLegs(m) {
  const L = legs(m);
  let min = Infinity;
  for (let i = 0; i < 6; i++) for (let j = i + 1; j < 6; j++) for (const [a, b] of [[0, 1], [1, 2]]) for (const [c, d] of [[0, 1], [1, 2]]) min = Math.min(min, segDist(L[i][a], L[i][b], L[j][c], L[j][d]));
  return min;
}
/** The skin's farthest drawn point from the cistern's middle (m), on the flat. */
function skinReach(m, A) {
  const me = m.inner.meshes[0], pc = me.geometry.attributes.position, p = V();
  me.skeleton.update();
  let r = 0;
  for (let q = 0; q < pc.count; q += 17) { me.getVertexPosition(q, p).applyMatrix4(me.matrixWorld); r = Math.max(r, Math.hypot(p.x - A.center.x, p.z - A.center.z)); }
  return r;
}

test('its skin faces where the fight turns it: a heading past ±π/2 at the swap no longer turns it the other way (π − h)', async () => {
  const m = keeperGuardian(), P = fakePlayer();
  const rt = { def: { id: 'keeper-mirror' }, root: new THREE.Group(), logic: { resolved: false }, physics: { groundAt: () => 0 }, player: P, notice() {} };
  rt.root.add(m.group);
  m.pos.set(0, 0, 0); m.heading = Math.PI;   // (asleep facing its cistern's door, as desert.js lays it)
  const g = new Guardian(rt, { def: KEEPER, model: m, arena: { center: V(), r: 30, y: 0 } });
  await m.ready;
  let t = 0;
  for (const h of [Math.PI, 2.4, -2.2, 0.7]) {
    m.heading = h;
    for (let i = 0; i < 5; i++) g.update(DT, (t += DT));
    const q = m.inner.group.getWorldQuaternion(new THREE.Quaternion()), f = V(0, 0, 1).applyQuaternion(q);
    const off = Math.atan2(Math.sin(Math.atan2(f.x, f.z) - m.heading), Math.cos(Math.atan2(f.x, f.z) - m.heading));
    assert.ok(Math.abs(off) < 1e-3, `the skin faces its heading ${m.heading.toFixed(2)} (off by ${off.toFixed(2)} rad)`);
    const mo = Math.atan2(m.mouth.x - m.pos.x, m.mouth.z - m.pos.z);
    assert.ok(Math.abs(Math.atan2(Math.sin(mo - m.heading), Math.cos(mo - m.heading))) < 0.6, 'and its head is in front of it');
  }
  g.dispose(); m.dispose();
});

test('its legs never pass through each other: walking, turning on the spot, charging and fighting, every two legs kept apart', async () => {
  const { g, P, m, A, step, rt } = await cistern();
  g.wake(); g.enter('fight'); g.cool = 1;
  let min = Infinity;
  const each = [];
  const watch = (n, fn) => { let w = Infinity; for (let i = 0; i < n; i++) { fn(i); step(); w = Math.min(w, closestLegs(m)); } each.push(+w.toFixed(2)); min = Math.min(min, w); };
  // the fight, the traveller circling it at 6 m (its first phase held)
  let a = 0;
  watch(20 / DT, () => { a += 0.5 * DT; P.pos.set(m.pos.x + Math.sin(a) * 6, A.y, m.pos.z + Math.cos(a) * 6); if (g.phaseIndex) g.meter = g.floor = 0; });
  const fight = g.fight;
  g.stop(); g.enter('fight'); g.fight = () => 0;
  P.pos.set(A.center.x, A.y + 50, A.center.z);
  watch(6 / DT, () => g.walk(DT, V(A.center.x, A.y, A.center.z - 10), 2.2, 0));
  let want = m.heading;
  watch(6 / DT, (i) => { if (i % 180 === 0) want += i % 360 ? -2.5 : 2.5; g.turnTo(DT, want, 4); });
  g.fight = fight;
  P.pos.set(m.pos.x + Math.sin(m.heading) * 10, A.y, m.pos.z + Math.cos(m.heading) * 10);
  watch(5 / DT, (i) => { if (i === 0) { g.stop(); g.enter('fight'); g.begin(P, null, 'charge'); } });
  // (0.2 m between their bones' lines: their skins, about 0.14 m round, never pass through each other)
  assert.ok(min > 0.2, `every two legs ${min.toFixed(2)} m apart at least (fight, walk, turns, charge: ${each}; they went through each other: 0)`);
  rt.dispose?.();
});

test('it stays inside its cistern: its shell and head off the wall, however it turns and lunges by it', async () => {
  const { g, P, m, A, step, rt } = await cistern();
  g.wake(); g.enter('fight'); g.cool = 1;
  let reach = 0, a = 0;
  // (the traveller running round by the wall, 15 m out: it follows him, turns and lunges there)
  for (let i = 0; i < 40 / DT; i++) {
    a += 0.25 * DT; P.pos.set(A.center.x + Math.sin(a) * 15, A.y, A.center.z + Math.cos(a) * 15);
    step(); if (g.phaseIndex) g.meter = g.floor = 0;
    if (i % 6 === 0) reach = Math.max(reach, skinReach(m, A));
  }
  // (walking, it is held off the wall at once; in a move, slid off it at KEEP_IN.speed, a few centimetres in for a moment)
  assert.ok(reach < A.r + 0.35, `its skin within ${reach.toFixed(2)} m of the middle, the wall at ${A.r} (it reached 19.8)`);
  assert.ok(A.posts?.length === 1, 'and the spout in the basin a post it is kept off');
  rt.dispose?.();
});

test('no burrow in a stone cistern: it leaps, over the spot it sprang for, its feet off the floor, then lies winded', async () => {
  assert.ok(!KEEPER.attacks.burrow, 'no burrow');
  const L = KEEPER.attacks.leap;
  assert.ok(L && L.over && L.leap && KEEPER.phases[2].attacks.includes('leap') && L.open >= 3, 'a leap in its last phase, an opening after it');
  const { g, P, m, A, step, rt } = await cistern();
  g.wake(); g.enter('fight'); g.meter = g.floor = 0.6; g.cool = 99;
  // (beside it, clear of the spout in the basin's middle: a spot by the spout it is kept off)
  P.pos.set(m.pos.x + 7, A.y, m.pos.z);
  for (let i = 0; i < 30; i++) step();
  g.begin(P, null, 'leap');
  const spot = P.pos.clone(), from = m.pos.clone();
  let top = 0, tucked = 0;
  for (let frame = 0; frame < 20 / DT && g.attack?.id === 'leap' && !g.struck; frame++) {
    step();
    top = Math.max(top, m.inner.hop);
    if (m.kit.rig.air > 0) tucked++;
  }
  assert.ok(g.struck, 'the leap reaches its strike within twenty seconds');
  assert.ok(Math.hypot(m.pos.x - spot.x, m.pos.z - spot.z) < 0.1 && from.distanceTo(m.pos) > 3, 'it lands where it sprang for');
  assert.ok(top > 2 && tucked > 10, `off the floor (${top.toFixed(2)} m up, its feet tucked ${tucked} frames)`);
  for (let i = 0; i < 4 / DT && g.state !== 'open'; i++) step();
  assert.equal(g.state, 'open', 'and lies winded after it');
  rt.dispose?.();
});

test('no spark for a tell: its body’s wind-up is the whole of it', async () => {
  const { g, P, m, A, step, rt } = await cistern();
  assert.equal(KEEPER.glow, false);
  g.wake(); g.enter('fight'); g.cool = 99;
  P.pos.set(m.pos.x + Math.sin(m.heading) * 5, A.y, m.pos.z + Math.cos(m.heading) * 5);
  g.begin(P, null, 'stamp');
  for (let i = 0; i < 60; i++) { step(); assert.ok(g.glows.every((x) => !x.visible), 'no glow on its feet'); }
  rt.dispose?.();
});

test('three phases of two: two braziers, then two drinks, then two more; an opening holds while it drinks', async () => {
  const { g, P, m, A, step, rt } = await cistern();
  const P3 = KEEPER.phases.filter((p) => !p.weary);
  assert.equal(P3.length, 3, 'three phases');
  assert.ok(Math.abs(0.4 / KEEPER_LIGHT - 2) < 1e-9 && Math.abs(0.2 / KEEPER_GUARD.water - 2) < 1e-9 && KEEPER_DARK.water === 1, 'two acts a phase');
  g.wake(); g.enter('fight'); g.cool = 99;
  P.pos.set(m.pos.x + Math.sin(m.heading) * 8, A.y, m.pos.z + Math.cos(m.heading) * 8);
  // the first phase: two of the rim's braziers lit
  const RIM = ['b6', 'b7', 'b8', 'b9'];
  for (const id of RIM.slice(0, 2)) { rt.logic.store.set(`lit.${id}`, true); rt.onLit(id); }
  assert.equal(g.phaseIndex, 1, 'two braziers end its first phase');
  // the second: one opening, two drinks a gulp apart (one at once is swallowed whole: no double)
  g.enter('open'); g.openFor = 3;
  const mouth = (n) => { for (let i = 0; i < n; i++) step(); return g.hit('mouth', 'shoot'); };
  mouth(1); const after1 = g.meter;
  mouth(1); assert.equal(g.meter, after1, 'a second shot at once is still the first drink');
  mouth(Math.ceil(KEEPER_GUARD.gulp / DT) + 1);
  assert.ok(g.phaseIndex === 2, `one opening, two drinks, and its second phase is done (calm ${g.meter.toFixed(2)})`);
  // the third, in the dark: a gasp is short, but two drinks fit in it
  for (let i = 0; i < 3 / DT && g.state !== 'fight'; i++) step();
  g.stop(); g.enter('open'); g.openFor = KEEPER_DARK.open;
  mouth(1); mouth(Math.ceil(KEEPER_GUARD.gulp / DT) + 1);
  assert.equal(g.state, 'weary', 'two drinks in its last phase, and it is worn out: go to it');
  rt.dispose?.();
});

test('the boss framing and the steady lock: further back and higher in its arena, and its lunges no longer swing the view', async () => {
  const { g, P, m, A, step, rt } = await cistern();
  const { Foes } = await import('../src/foes.js');
  const foes = Object.assign(Object.create(Foes.prototype), { player: P });
  P.pos.set(A.center.x, A.y, A.center.z - 10);
  assert.equal(foes.bossFight(), null, 'asleep: no boss framing');
  g.wake();
  assert.equal(foes.bossFight(), g, 'awake, him in its arena: its fight');
  assert.ok(g.def.camera, 'it asks for the boss framing');
  P.pos.set(A.center.x, A.y, A.center.z - A.r - 4);
  assert.equal(foes.bossFight(), null, 'out of its arena: none');
  // the arm: the open one and BOSS_CAM.arm more, never close in
  const rig = Object.assign(Object.create(CameraRig.prototype), { dist: OPEN_DIST, _distBoost: 0, tightK: 1, hallK: 0, roomK: 4.5, bossK: 1, _boss: BOSS_CAM });
  assert.ok(Math.abs(rig.armLength(undefined, 0) - (OPEN_DIST + BOSS_CAM.arm)) < 1e-9, `the arm ${rig.armLength(undefined, 0).toFixed(2)} m`);
  // the lock camera's stand-in: a 3 m lunge in a frame moves it a fraction, and it gets there
  const L = guardianLock(g), S = L.steady(DT), at = S.pos.clone();
  m.pos.x += 3;
  L.steady(DT);
  assert.ok(S.pos.distanceTo(at) < 0.2, `a lunge moves the view's point ${S.pos.distanceTo(at).toFixed(2)} m in a frame`);
  for (let i = 0; i < 3 / DT; i++) L.steady(DT);
  assert.ok(S.pos.distanceTo(m.pos) < 0.05, 'and it follows it there');
  assert.ok(L.aim.distanceTo(m.mouth) < 1e-9, 'the gun’s aim still the real mouth');
  m.pos.x += STEADY.jump + 1; L.steady(DT);
  assert.ok(S.pos.distanceTo(m.pos) < 1e-9, 'a knockout’s reset is taken at once');
  rt.dispose?.();
});

test('a blow knocks the traveller back on his feet, not down; nothing lands again a moment; a knockout still drops him', async () => {
  const { traveller, course, CAM_PLUS_Z } = await import('./gait-sim.js');
  const p = await quiet(() => traveller(course({ ramp: false, stairs: false }), V(0, 0, -60), { moves: true, body: 'b3' }));
  for (let i = 0; i < 30; i++) p.update(DT, {}, CAM_PLUS_Z);
  const m = keeperGuardian({ load: () => Promise.reject(new Error('offline')) });
  await m.ready;
  const rt = { def: { id: 'keeper-stagger' }, root: new THREE.Group(), logic: { resolved: false }, physics: { groundAt: () => 0 }, player: p, notice() {}, rumble() {} };
  const g = quiet(() => new Guardian(rt, { def: KEEPER, model: m, arena: { center: V(0, 0, -60), r: 30, y: 0 } }));
  m.pos.set(0, 0, -64);
  const a = { id: 'stamp', ...KEEPER.attacks.stamp }, at = p.pos.clone();
  g.catch(a, p, m.pos, a.damage, a.knock);
  assert.ok(!p.down && p.staggered, 'staggered, not knocked down');
  for (let i = 0; i < STAGGER.time / DT; i++) p.update(DT, { KeyW: true }, CAM_PLUS_Z);
  const back = p.pos.z - at.z;
  assert.ok(back > 0.4 && !p.down, `knocked back ${back.toFixed(2)} m on his feet, his hands taken meanwhile`);
  assert.equal(g.contact(p), false, 'no second blow lands at once');
  for (let i = 0; i < STAGGER.guard / DT + 2; i++) p.update(DT, {}, CAM_PLUS_Z);
  assert.ok(!p.staggered && !p.down, 'and he is himself again');
  // the last of his hearts: down for good, the ragdoll
  p.opts.health = true; p.hearts = 0.25;
  g.catch(a, p, m.pos, 1, a.knock);
  p.update(DT, {}, CAM_PLUS_Z);
  assert.ok(p.down?.dead, 'knocked out, he falls');
  g.dispose();
});
