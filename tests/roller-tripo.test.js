// The pearl roller (issue #800, family D): its approved snail-and-pearl redesign as its body (Tripo,
// src/enemies/plans/roller-tripo.js on public/enemies/roller/, loaded by src/enemies/foe-assets.js; the steel snail,
// plans/roller.js legacyRollerModel, kept and standing in while the mesh loads). It keeps the roller's id, def, attacks and
// windows, its roll locked to the ground, skins and dress, eyes and death; the machines' rigid parts on the roller plan.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Foes, FOES } from '../src/foes.js';
import { GameState } from '../src/game-state.js';
import { clearTargets } from '../src/targets.js';
import { SKINS, skinOf } from '../src/enemies/skins.js';
import { archetypeModel } from '../src/enemies/plans/index.js';
import { legacyRollerModel } from '../src/enemies/plans/roller.js';
import { tripoRollerModel, ROLLER_PARTS, ROLLER_HOME } from '../src/enemies/plans/roller-tripo.js';
import { foeSource, FOE_ASSETS } from '../src/enemies/foe-assets.js';
import { PLANS } from '../src/motion-kit/plans.js';

const SRC = foeSource('roller');
const world = () => new Foes({ level: { foes: { own: true } }, levelId: 'arena', scene: null, player: { pos: new THREE.Vector3(0, 0, 40), heading: Math.PI }, physics: { groundAt: () => 0 }, game: new GameState(null), rng: () => 0.01 });
const skinned = (g) => { let s = null; g.traverse((o) => { if (o.isSkinnedMesh) s = o; }); return s; };

test('the pearl roller is its approved redesign: its Tripo body by default, the steel snail kept as legacyRollerModel', () => {
  assert.ok(FOE_ASSETS.roller && SRC, 'its asset is read at once in node');
  const M = archetypeModel('roller', 'garage');
  assert.equal(M.body3d, 'tripo'); assert.match(M.group.name, /pearl roller \(Tripo\)/);
  M.dispose();
  const L = legacyRollerModel(skinOf('roller', 'garage'));
  assert.ok(L.group.getObjectByName('sole 0'), 'the old nine-sole snail still builds');
  L.dispose();
  const D = FOES.roller;
  assert.deepEqual(D.attacks.map((a) => a.id).sort(), ['bowl', 'last', 'ricochet']);
});

test('every skin builds the contract on the one mesh: its palette, its dress, two eyes with pupils that turn', () => {
  for (const w of Object.keys(SKINS.roller)) {
    const M = tripoRollerModel(skinOf('roller', w), SRC);
    for (const k of ['group', 'body', 'parts', 'eyeMat', 'tell', 'anim', 'dispose', 'gaze']) assert.ok(M[k], `${w}: ${k}`);
    assert.equal(M.gaze.length, 2, `${w}: each eyeball looks`);
    let meshes = 0, pupils = 0; M.group.traverseVisible((o) => { if (o.isMesh) meshes++; if (o.name === 'pupil') pupils++; });
    assert.equal(pupils, 2);
    assert.ok(meshes <= 6, `${w}: ${meshes} meshes drawn (the old roller's 5)`);
    const box = new THREE.Box3().setFromObject(M.group), top = box.max.y;
    assert.ok(top > 1.35 && top < 1.7, `${w}: ${top.toFixed(2)} m tall (as tall as the traveller's chest)`);
    if (w === 'garage') { const C = skinned(M.group).geometry.attributes.color, b = (x) => Math.round(x * 255).toString(16).padStart(2, '0'), hex = new Set(); for (let i = 0; i < C.count; i += 31) hex.add(`#${b(C.getX(i))}${b(C.getY(i))}${b(C.getZ(i))}`); assert.ok(hex.has(ROLLER_HOME.shell) && hex.has(ROLLER_HOME.head), 'its home skin in the reference\'s pale shell and terracotta'); }
    M.dispose();
  }
  const M = tripoRollerModel(skinOf('roller', 'spheres'), SRC);
  assert.ok(M.group.getObjectByName('key') && M.group.getObjectByName('runners'), 'the Garden\'s wind-up key and runners');
  M.dispose();
});

test('the rig: 10–15k triangles, normalised weights, an exact bind', () => {
  assert.ok(SRC.triangles >= 10000 && SRC.triangles <= 15000, `${SRC.triangles} triangles`);
  assert.deepEqual(SRC.rig.partNames, ROLLER_PARTS);
  assert.ok(Math.abs(SRC.rig.shell.r - PLANS.roller.shell.radius) < 0.05, `the shell's radius ${SRC.rig.shell.r} is the plan's ${PLANS.roller.shell.radius}: its roll is locked to the ground`);
  const M = tripoRollerModel(skinOf('roller', 'garage'), SRC), sm = skinned(M.group), W = sm.geometry.attributes.skinWeight;
  for (let i = 0; i < W.count; i++) { const s = W.getX(i) + W.getY(i) + W.getZ(i) + W.getW(i); assert.ok(Math.abs(s - 1) < 1e-5); }
  M.group.updateMatrixWorld(true);
  const p = new THREE.Vector3(), q = new THREE.Vector3(); let worst = 0;
  for (let i = 0; i < W.count; i += 5) { p.fromBufferAttribute(sm.geometry.attributes.position, i); sm.getVertexPosition(i, q); worst = Math.max(worst, p.distanceTo(q)); }
  assert.ok(worst < 1e-4, `bind round trip ${(worst * 1000).toFixed(3)} mm`);
  M.dispose();
});

test('in the fight: rolled up it is a ball (its foot and head drawn in), its eyes look at you either side, a deadly blow leaves its last roll', () => {
  clearTargets();
  const foes = world();
  const f = foes.add('roller@garage', new THREE.Vector3(), { tier: 0 }); f.heading = 0; f.provoked = true;
  for (let i = 0; i < 40; i++) foes.look(f, 1 / 30);
  const J = f.model.rollerJoints;
  assert.ok(J.soft.scale.x > 0.9, 'unrolled: on its foot');
  f.state = 'strike'; f.atk = f.def.attacks.find((a) => a.id === 'bowl'); f.k = 0.3;
  for (let i = 0; i < 60; i++) { f.pos.z += 5 / 30; foes.look(f, 1 / 30); }
  assert.ok(J.soft.scale.x < 0.1, `rolled: its soft parts drawn in (${J.soft.scale.x.toFixed(2)})`);
  f.state = 'idle'; f.atk = null; f.k = 0; f.pos.set(0, 0, 0);
  for (let i = 0; i < 60; i++) foes.look(f, 1 / 30);
  const eye = J.stalks[0].tip, yaw = () => new THREE.Euler().setFromQuaternion(eye.children[0].getWorldQuaternion(new THREE.Quaternion()), 'YXZ').y;
  for (const [x, sign] of [[-6, -1], [6, 1]]) {
    foes.player.pos.set(x, 0, 4);
    for (let i = 0; i < 90; i++) { f.dist = 6; foes.look(f, 1 / 30); }
    assert.ok(Math.sign(yaw()) === sign && Math.abs(yaw()) > 0.3, `the traveller at x ${x}: its eye turned ${yaw().toFixed(2)} rad toward him`);
  }
  // (a deadly blow leaves it its last roll first, src/enemies/fight.js FIGHT.roller.low: it clings to a share of its health)
  foes.hurt(f, 'blade', new THREE.Vector3(-1, 0, 0), { damage: 99, source: 'charge', breaks: true });
  assert.ok(f.hp > 0 && f.hp < FOES.roller.hp, `its last share of health kept for the last roll (${f.hp})`);
  foes.dispose(); clearTargets();
});
