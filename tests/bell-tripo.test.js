// The bell walker (issue #800, family D): its approved clean-background redesign as its body (Tripo,
// src/enemies/plans/bell-tripo.js on public/enemies/bell/, loaded by src/enemies/foe-assets.js; the spider-legged bell walker,
// plans/siege.js legacyBellModel, kept and standing in while the mesh loads). It keeps the bell's id, def, attacks and
// windows, the clapper (only it takes harm), skins and dress, armour, eyes and death; a machine's rig (rigid parts on the
// kit's four legs, blended across the cuts).
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Foes, FOES } from '../src/foes.js';
import { GameState } from '../src/game-state.js';
import { clearTargets } from '../src/targets.js';
import { SKINS, skinOf } from '../src/enemies/skins.js';
import { ARCHETYPES } from '../src/enemies/archetypes.js';
import { archetypeModel } from '../src/enemies/plans/index.js';
import { legacyBellModel } from '../src/enemies/plans/siege.js';
import { tripoBellModel, BELL_PARTS, BELL_HOME } from '../src/enemies/plans/bell-tripo.js';
import { foeSource, FOE_ASSETS } from '../src/enemies/foe-assets.js';
import { ARMOUR } from '../src/enemies/fight.js';

const SRC = foeSource('bell');
const world = () => new Foes({ level: { foes: { own: true } }, levelId: 'arena', scene: null, player: { pos: new THREE.Vector3(0, 0, 40), heading: Math.PI }, physics: { groundAt: () => 0 }, game: new GameState(null), rng: () => 0.01 });
const skinned = (g) => { let s = null; g.traverse((o) => { if (o.isSkinnedMesh) s = o; }); return s; };

test('the bell walker is its approved redesign: its Tripo body by default, the spider-legged bell kept as legacyBellModel', () => {
  assert.ok(FOE_ASSETS.bell && SRC, 'its asset is read at once in node');
  const M = archetypeModel('bell', 'bazaar');
  assert.equal(M.body3d, 'tripo'); assert.match(M.group.name, /bell walker \(Tripo\)/);
  M.dispose();
  const L = legacyBellModel(skinOf('bell', 'bazaar'));
  assert.equal(L.rig.legs.length, 5, 'the old five spider legs still build');
  L.dispose();
  assert.equal(ARCHETYPES.bell.plan, 'siege');
});

test('it keeps the bell\'s fight: toll and drop with their windows, the clapper, the whistle, three plates', () => {
  const D = FOES.bell, toll = D.attacks.find((a) => a.id === 'toll'), drop = D.attacks.find((a) => a.id === 'drop');
  assert.deepEqual([toll.wind, toll.strike, toll.contact, toll.wave.count, toll.whistle], [1.6, 0.5, 0.25, 3, true]);
  assert.deepEqual([drop.wind, drop.strike, drop.contact, drop.opens, drop.leap.height], [1.2, 0.55, 0.92, 2.5, 1.3]);
  assert.ok(D.clapper && D.stout && D.heavy);
  assert.deepEqual([D.hp, D.radius, D.height], [6, 1.3, 2.6]);
  assert.equal(ARMOUR.bell.plates, 3);
});

test('every skin builds the contract on the one mesh: its palette, its dress, three plates, the spirit\'s eyes, the clapper', () => {
  for (const w of Object.keys(SKINS.bell)) {
    const M = tripoBellModel(skinOf('bell', w), SRC);
    for (const k of ['group', 'body', 'rig', 'parts', 'eyeMat', 'tell', 'anim', 'dispose', 'gaze', 'weak']) assert.ok(M[k], `${w}: ${k}`);
    assert.equal(M.plates.length, 3, `${w}: three plates`);
    assert.equal(M.rig.legs.length, 4, `${w}: four legs`);
    assert.ok(M.weak.obj === M.bellJoints.spirit, `${w}: only the spirit, the clapper, takes harm`);
    let meshes = 0, eyes = 0; M.group.traverseVisible((o) => { if (o.isMesh) meshes++; if (o.name === 'eye') eyes++; });
    assert.equal(eyes, 2, `${w}: the spirit's two slit eyes`);
    assert.ok(meshes <= 10, `${w}: ${meshes} meshes drawn (the old bell's up to 14)`);
    const top = new THREE.Box3().setFromObject(M.group).max.y;
    assert.ok(top > 3.2 && top < 3.6, `${w}: ${top.toFixed(2)} m to the arch`);
    if (w === 'bazaar') { const C = skinned(M.group).geometry.attributes.color, b = (x) => Math.round(x * 255).toString(16).padStart(2, '0'), hex = new Set(); for (let i = 0; i < C.count; i += 53) hex.add(`#${b(C.getX(i))}${b(C.getY(i))}${b(C.getZ(i))}`); assert.ok(hex.has(BELL_HOME.bell) && hex.has(BELL_HOME.body), 'its home skin in the reference\'s pink and sage'); }
    M.dispose();
  }
  const has = (w, name) => { const M = tripoBellModel(skinOf('bell', w), SRC); const o = M.group.getObjectByName(name); M.dispose(); return !!o; };
  assert.ok(has('saltharbour', 'drum') && has('underside', 'drum') && !has('bazaar', 'drum'), 'the winches\' drum in the arch');
  assert.ok(has('bazaar', 'pennant') && !has('saltharbour', 'pennant'), 'the Market\'s pennants');
});

test('the Tripo machine rig: 10–15k triangles, normalised weights, an exact bind, a knee moves only its leg', () => {
  assert.ok(SRC.triangles >= 10000 && SRC.triangles <= 15000, `${SRC.triangles} triangles`);
  assert.deepEqual(SRC.rig.partNames, BELL_PARTS);
  const M = tripoBellModel(skinOf('bell', 'bazaar'), SRC), sm = skinned(M.group), W = sm.geometry.attributes.skinWeight, J = sm.geometry.attributes.skinIndex;
  for (let i = 0; i < W.count; i++) { const s = W.getX(i) + W.getY(i) + W.getZ(i) + W.getW(i); assert.ok(Math.abs(s - 1) < 1e-5, `vertex ${i} weights sum ${s}`); }
  M.group.updateMatrixWorld(true);
  const p = new THREE.Vector3(), q = new THREE.Vector3(); let worst = 0;
  for (let i = 0; i < W.count; i += 7) { p.fromBufferAttribute(sm.geometry.attributes.position, i); sm.getVertexPosition(i, q); worst = Math.max(worst, p.distanceTo(q)); }
  assert.ok(worst < 1e-4, `bind round trip ${(worst * 1000).toFixed(3)} mm`);
  const shin = sm.skeleton.bones.findIndex((b) => b.name === 'leg1_shin'), own = new Set(['leg1_thigh', 'leg1_shin', 'leg1_foot'].map((n) => sm.skeleton.bones.findIndex((b) => b.name === n)));
  const before = []; for (let i = 0; i < W.count; i++) { sm.getVertexPosition(i, q); before.push(q.clone()); }
  sm.skeleton.bones[shin].rotateX(0.4); M.group.updateMatrixWorld(true);
  for (let i = 0; i < W.count; i++) { sm.getVertexPosition(i, q); if (q.distanceTo(before[i]) > 1e-6) assert.ok([0, 1, 2, 3].some((k) => W.getComponent(i, k) > 0 && own.has(J.getComponent(i, k))), `vertex ${i} moved by the knee is the leg's`); }
  M.dispose();
});

test('in the fight: it rears back for the toll as the clapper swings, its spirit looks at you either side, and it comes apart rigid', () => {
  clearTargets();
  const foes = world();
  const f = foes.add('bell@bazaar', new THREE.Vector3(), { tier: 0 }); f.heading = 0; f.provoked = true;
  for (let i = 0; i < 60; i++) foes.look(f, 1 / 30);
  const frame = f.model.body, rest = frame.rotation.x;
  const toll = f.def.attacks.find((a) => a.id === 'toll');
  f.atk = toll; f.state = 'wind';
  let swung = 0;
  for (let i = 0; i <= 40; i++) { f.k = (i / 40) * 0.8; foes.look(f, toll.wind / 40); swung = Math.max(swung, Math.abs(f.model.bellJoints.clapper.rotation.x)); }
  assert.ok(frame.rotation.x - rest < -0.15, `it rears back (${(frame.rotation.x - rest).toFixed(2)} rad)`);
  assert.ok(swung > 0.4, `the clapper swings (${swung.toFixed(2)} rad)`);
  f.atk = null; f.state = 'idle'; f.k = 0;
  const spirit = f.model.bellJoints.spirit, yaw = () => new THREE.Euler().setFromQuaternion(spirit.children[0].getWorldQuaternion(new THREE.Quaternion()), 'YXZ').y;
  for (const [x, sign] of [[-6, -1], [6, 1]]) {
    foes.player.pos.set(x, 0, 4);
    for (let i = 0; i < 90; i++) { f.dist = 6; foes.look(f, 1 / 30); }
    assert.ok(Math.sign(yaw()) === sign && Math.abs(yaw()) > 0.4, `the traveller at x ${x}: its spirit turned ${yaw().toFixed(2)} rad toward him`);
  }
  f.open = 2; foes.hurt(f, 'blade', new THREE.Vector3(-1, 0, 0), { damage: 99, source: 'charge', breaks: true });
  for (let i = 0; i < 40; i++) foes.update(1 / 30);
  assert.ok(f.dying, 'down');
  const sm = skinned(f.model.group) ?? (() => { let s = null; foes.group?.traverse((o) => { if (o.isSkinnedMesh && o.name === 'tripo skin') s = o; }); return s; })();
  const w = sm.geometry.attributes.skinWeight; let soft = 0; for (let i = 0; i < w.count; i++) if (w.getX(i) < 1) soft++;
  assert.equal(soft, 0, 'rigid as it comes apart');
  foes.dispose(); clearTargets();
});
