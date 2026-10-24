// The Rose House's Keeper on its fitted Tripo skin (issue #267; src/temples/guardian-generated.js, keeperGuardian):
// the procedural body until the skin has loaded (and for good when it can't), the fight's rules, sizes, hit spots and
// tells the same on either body, and the real cistern fight played on the generated one. The skin's own rig checks are
// tests/keeper-creature.test.js; the walkers' audit tests/motion-guardians.test.js.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import './register-gadgets.js';
import { keeperGuardian } from '../src/temples/guardian-generated.js';
import { Guardian } from '../src/temples/boss.js';
import { KEEPER } from '../src/temples/desert.js';
import { TEMPLE_HOME, templeOf } from '../src/temples/index.js';
import { buildableById } from '../src/levels/buildable.js';
import { Physics } from '../src/physics.js';
import { bestInteractable } from '../src/interact.js';
import { beginHelperEncounter, helperRun, consumeHelperReturn } from '../src/temples/helper-encounter.js';
import { allTargets, hitTarget } from '../src/targets.js';

// (the game loads it by URL: here from public/, as the Unity export does, scripts/unity-export/build-world.mjs; node has
// no image decoder, so without its texture)
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
const runtime = (id) => ({ def: { id }, root: new THREE.Group(), logic: { resolved: false }, physics: { groundAt: () => 0 }, player: { pos: V(0, 0, 9), dead: false }, notice() {} });

test('no skin (a failed load): the procedural Keeper fights on, the same sizes', async () => {
  const m = keeperGuardian({ load: () => Promise.reject(new Error('offline')) });
  assert.equal(await m.ready, false);
  assert.equal(m.generated, false);
  assert.deepEqual([m.radius, m.height, m.mouthR], [2.9, 4.4, 1.3]);
  const boss = new Guardian(runtime('keeper-fallback'), { def: KEEPER, model: m, arena: { center: V(), r: 20, y: 0 } });
  const states = new Set();
  for (let f = 0; f < 1800; f++) { boss.update(DT, f * DT); states.add(boss.state); assert.ok(m.mouth.toArray().every(Number.isFinite)); }
  assert.ok(states.has('fight'));
  boss.dispose();
});

test('the skin swaps in under a fight already made: its phase marks, pos, heading and hit spots carry over', async () => {
  const m = keeperGuardian();
  const rt = runtime('keeper-swap'), boss = new Guardian(rt, { def: KEEPER, model: m, arena: { center: V(), r: 20, y: 0 } });
  rt.root.add(m.group);   // (as the temple holds it, src/temples/runtime.js)
  const oldGroup = m.group;
  m.pos.set(2, 0, 3); m.heading = 0.7;
  for (let f = 0; f < 30; f++) boss.update(DT, f * DT);
  const oldRig = m.tellRig, marks = boss.marks.lines;
  assert.ok(marks.every((l) => l.parent === oldRig), 'the fight laid its phase marks in the procedural body’s tell rig');
  assert.equal(await m.ready, true);
  assert.equal(m.generated, true);
  assert.ok(!oldGroup.parent && m.group.parent === rt.root, 'the skin takes the old body’s place in the temple');
  assert.equal(m.inner.pos, m.pos, 'the same pos the fight moves');
  assert.ok(marks.every((l) => l.parent === m.tellRig), 'the marks move to the skin’s tell rig');
  // (and onto its body: their middle is the new body's mark centre)
  const box = new THREE.Box3(); for (const l of marks) { l.updateMatrix(); l.geometry.computeBoundingBox(); box.union(l.geometry.boundingBox.clone().applyMatrix4(l.matrix)); }
  const c = box.getCenter(V());
  assert.ok(Math.abs(c.y - m.marks.c[1]) < 0.6 && Math.abs(box.max.x - box.min.x) < m.marks.r[0] * 2.4, `marks round the new shell (${c.y.toFixed(2)}, ${(box.max.x - box.min.x).toFixed(2)} m across)`);
  boss.update(DT, 1);
  assert.ok(m.inner.mouth.distanceTo(m.mouth) < 1e-9, 'the fluid’s target is the skin’s mouth');
  const mouthTarget = allTargets().find((t) => t.position() === m.mouth);
  assert.ok(mouthTarget && mouthTarget.radius === 1.3, 'the mouth’s hit sphere: as generous as the old one');
  const states = new Set(), attacks = new Set();
  for (let f = 0; f < 3600; f++) { boss.update(DT, 1 + f * DT); states.add(boss.state); if (boss.attack) attacks.add(boss.attack.id); assert.ok(m.mouth.toArray().every(Number.isFinite)); }
  assert.ok(states.has('wake') && states.has('fight'));
  assert.ok(attacks.size >= 2, `attacks: ${[...attacks]}`);
  boss.dispose(); m.dispose();
});

test('every move’s tell on the skin still lasts at least 1.2 s (issue #258), its body leaning into it over planted feet', async () => {
  for (const [id, a] of Object.entries(KEEPER.attacks)) if (!a.link) assert.ok(a.wind >= 1.2, `${id} winds up ${a.wind} s`);
  const m = keeperGuardian(), rt = runtime('keeper-tells');
  rt.root.add(m.group);
  await m.ready;
  const boss = new Guardian(rt, { def: KEEPER, model: m, arena: { center: V(), r: 20, y: 0 } });
  boss.enter('fight'); boss.cool = 99;
  for (let f = 0; f < 120; f++) boss.update(DT, f * DT);
  for (let i = 0; i < 6; i++) assert.ok(m.inner.bones[`leg${i}_shin`].getWorldPosition(V()).y < m.inner.bones[`leg${i}_thigh`].getWorldPosition(V()).y, `raised fighting knee ${i} below its hip`);
  const feet = () => m.kit.rig.planner.feet.map((f) => f.pos.clone());
  boss.attack = { ...KEEPER.attacks.stamp, id: 'stamp' }; boss.view = boss.attack;
  let held = null, planted = [];
  for (let f = 0; f < 80; f++) {
    boss.attackK = Math.min(0.99, f / 80); boss.struck = false;
    boss.poseRig(DT, 2 + f * DT);
    m.group.position.copy(m.pos); m.group.rotation.y = m.heading;
    m.animate(DT, 2 + f * DT, { state: 'fight', attack: boss.attack, k: boss.attackK, kit: { ground: () => 0 } });
    if (f === 76) held = feet();
    if (f >= 60) planted.forEach((was, i) => { if (i >= 2) assert.ok(!was || m.kit.rig.planner.feet[i].planted, `no hind foot lifts late in the wind-up (${i} at k ${boss.attackK.toFixed(2)})`); });
    planted = m.kit.rig.planner.feet.map((x) => x.planted);
    if (held) feet().slice(2).forEach((p, i) => assert.ok(p.distanceTo(held[i + 2]) < 0.02, `hind foot ${i + 2} planted as it rears`));
  }
  const fore = [0, 1].map((i) => m.inner.bones[`leg${i}_foot`].getWorldPosition(V()).y);
  assert.ok(fore.every((y) => y > 0.6), `its forelegs up for the stamp (${fore.map((y) => y.toFixed(2))})`);
  boss.dispose(); m.dispose();
});

test('the shell’s glyphs glow brighter as it calms', async () => {
  const m = keeperGuardian();
  new THREE.Group().add(m.group);
  await m.ready;
  const glow = m.inner.glowM.uniforms.uGlow, k = (meter) => { m.animate(DT, 1, { state: 'fight', meter, kit: { ground: () => 0 } }); return glow.value; };
  assert.ok(m.inner.glyphs.geometry.attributes.position.count > 500, 'the makers’ signs laid on its shell');
  assert.ok(m.inner.glyphs.parent === m.inner.body, 'carried by its body');
  assert.ok(k(0.9) > k(0) + 0.5);
  m.dispose();
});

test('in the Rose House’s cistern: the fitted skin stays grounded, offers help and resolves on a completed game', async () => {
  const scene = new THREE.Scene();
  const level = quiet(() => buildableById(TEMPLE_HOME.desert ?? 'desert').create(scene));
  const physics = new Physics(scene, level.ground.heightAt ? level.ground : null);
  level.init?.(physics);
  const rt = templeOf(level, 'desert') ?? level.temple, K = rt.guardian, m = K.model;
  assert.equal(await m.ready, true, 'the fitted skin loads in the temple');
  assert.ok(m.generated && m.group.parent === rt.root);
  const P = { pos: V(), heading: 0, vel: V(), dead: false };
  rt.connect({ player: P });
  const frames = (s) => { for (let i = 0; i < s / DT; i++) K.update(DT, (K._t = (K._t ?? 0) + DT)); };
  // Waking the peaceful helper does not select its raised fighting pose.
  K.wake(); frames(4);
  // (you at the world's origin, 160 m off: its legs on the kit's far tier, the canned cycle; its body stays on its feet,
  // 2400 m up as the temples are, not sunk toward the ground's height under it)
  assert.ok(Math.abs(m.body.position.y - 1.35) < 0.3, `its sleeping body stays at its authored resting height at the far tier (${m.body.position.y.toFixed(2)} m)`);
  // Its sleeping crouch keeps planted feet on the elevated cistern floor; the raised combat knees are checked separately above.
  P.pos.copy(m.pos).add(V(0, 0, 8)); frames(1);
  for (let i = 0; i < 6; i++) {
    const b = (r) => m.inner.bones[`leg${i}_${r}`].getWorldPosition(V());
    const f = b('foot'), floor = physics.groundAt(f.x, K.arena.y + 2.5, f.z, 6);
    // (the first frame back from the far tier's canned cycle, which plants at the body's own floor: a foot a stride out
    // over the basin's 0.8 m step hangs over it until its next step, issue #315's quicker, shorter strides put one there)
    if (m.kit.rig.planner.feet[i].planted && !(m.kit.legs[i].lift > 0.05)) assert.ok(Math.abs(f.y - floor) < 0.9, `foot ${i} on the floor (${(f.y - floor).toFixed(2)} m)`);
    assert.ok(b('shin').toArray().every(Number.isFinite) && b('thigh').toArray().every(Number.isFinite), `sleeping leg ${i} has a finite fitted pose`);
  }
  assert.equal(K.state, 'sleep'); assert.equal(K.def.helper, 'cistern');
  assert.ok(!allTargets().some(t => t.position() === m.mouth && t.enabled()), 'its mouth is not a combat target');
  let href = null;
  rt.startHelper = () => { href = beginHelperEncounter(rt.game, 'desert', { from: 'desert',
    returnPose: { pos: P.pos.toArray(), up: [0, 1, 0], fwd: [0, 0, 1] } }); return !!href; };
  P.pos.copy(m.mouth).setY(K.arena.y).add(V(1.2, 0, 0));
  const invite = bestInteractable(P);
  assert.equal(invite?.entry.id, 'temple.desert.help'); invite.entry.use(P);
  const run = helperRun(rt.game, 'cistern', new URLSearchParams(href).get('encounter'));
  assert.ok(run); assert.equal(run.onResult({ goal: { game: 'cistern', complete: true } }), true); run.left();
  assert.equal(consumeHelperReturn(rt.game, 'desert', 'desert', { restore: p => P.pos.fromArray(p.pos), resolve: () => K.resolve() }).success, true);
  assert.equal(K.state, 'resolved'); frames(20);
  assert.ok(m.mouth.y - K.arena.y < 3.5, `its resting head stays low (${(m.mouth.y - K.arena.y).toFixed(2)} m)`);
  rt.dispose?.();
});
