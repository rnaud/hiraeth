// The spool drone (issue #800): the Tripo body is the game's drone (src/enemies/plans/drone-tripo.js, its shipped asset
// public/enemies/drone/body.glb), the legacy ring drone (plans/hover-legacy.js) its stand-in where the body is not
// loaded, kept so its look can come back. Its rigid parts' weights are sound, it hovers as the ring drone did, its core
// looks at the traveller, its plates part for the harpoon and lock for the ram, every skin builds, and it goes down.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { Foes } from '../src/foes.js';
import { GameState } from '../src/game-state.js';
import { clearTargets } from '../src/targets.js';
import { SKINS, skinOf } from '../src/enemies/skins.js';
import { ARCHETYPES } from '../src/enemies/archetypes.js';
import { TRIAL_BUILDERS, archetypeModel } from '../src/enemies/plans/index.js';
import { droneLegacyModel } from '../src/enemies/plans/hover-legacy.js';
import { tripoDroneModel, droneSource, DRONE_BODY, DRONE_ROLES } from '../src/enemies/plans/drone-tripo.js';
import { parseTripoBody } from '../src/enemies/plans/tripo-body.js';
import { nextRigSeed } from '../src/motion-kit/rig.js';

THREE.ColorManagement.enabled = false;
const SRC = droneSource();
const BUILD = { legacy: droneLegacyModel, tripo: (skin) => tripoDroneModel(skin, SRC) };
const drawn = (g) => { let n = 0; g.traverseVisible((o) => { if (o.isMesh) n++; }); return n; };
const skinnedOf = (M) => { const out = []; M.group.traverse((o) => { if (o.isSkinnedMesh && o.name.startsWith('drone ') && o.name !== 'drone fittings') out.push(o); }); return out; };
/** A seeded random (the fights' own rng: tests that field foes are seeded, c5b8ab3c1). */
const seeded = (s = 11) => () => ((s = (s * 16807) % 2147483647) / 2147483647);

test('the game\'s drone is the Tripo spool drone, from its shipped body, in every skin; the legacy kept (#800)', () => {
  assert.deepEqual(Object.keys(TRIAL_BUILDERS), []);
  for (const id of Object.keys(SKINS.drone)) { const M = archetypeModel('drone', id); assert.equal(M.tripo, 'tripo', id); M.dispose(); }
  const T = parseTripoBody(readFileSync(new URL('../references/enemy-redesign-2026-10-30/trials/familyE-tripo/drone-lod.glb', import.meta.url)));
  assert.deepEqual(Array.from(SRC.geometry.attributes.position.array), Array.from(T.geometry.attributes.position.array));
  assert.deepEqual(Array.from(SRC.geometry.index.array), Array.from(T.geometry.index.array));
  assert.equal(SRC.geometry.attributes.uv, undefined, 'no picture (no UVs)');
  assert.deepEqual(SRC.landmarks, JSON.parse(readFileSync(new URL('../references/enemy-redesign-2026-10-30/trials/familyE-tripo/drone-landmarks.json', import.meta.url), 'utf8')));
  assert.ok(readFileSync(new URL(`../public/${DRONE_BODY}`, import.meta.url)).length < 450 * 1024, 'under 450 KB');
  for (const id of Object.keys(SKINS.drone)) { const M = droneLegacyModel(skinOf('drone', id)); assert.equal(M.tripo, undefined); M.dispose(); }
  const home = skinOf('drone', 'incal').palette;
  assert.equal(home.plate, DRONE_ROLES.plate, 'the home skin the reference\'s cream');
  assert.equal(home.cap, DRONE_ROLES.cap, 'and its slate cap');
});

test('every world\'s skin builds on the Tripo body: a handful of meshes, its tells, its harpoon and line, its eye', () => {
  for (const id of Object.keys(SKINS.drone)) {
    const M = tripoDroneModel(skinOf('drone', id), SRC);
    for (const k of ['group', 'body', 'parts', 'eyeMat', 'size', 'tones', 'tell', 'anim', 'dispose', 'line', 'harpoon', 'gaze']) assert.ok(M[k] !== undefined, `${id}: ${k}`);
    const sms = skinnedOf(M);
    assert.equal(new Set(sms.map((s) => s.skeleton)).size, 1, `${id}: one skeleton`);
    assert.ok(sms.some((s) => s.material.defines?.FOE_SURFACE), `${id}: a painted surface`);
    assert.ok(drawn(M.group) <= 9, `${id}: ${drawn(M.group)} meshes`);
    for (const a of ARCHETYPES.drone.def.attacks) assert.ok(M.tell(a.id)?.isObject3D, `${id}: a tell for ${a.id}`);
    assert.equal(M.line.visible, false, `${id}: the line hidden at rest`);
    M.dispose();
  }
});

test('the Tripo skin: its triangles, normalised weights, an exact bind, each part\'s bone carrying its vertices', () => {
  const tris = SRC.geometry.index.count / 3;
  assert.ok(tris >= 10000 && tris <= 15000, `${tris} triangles`);
  const M = tripoDroneModel(skinOf('drone', 'incal'), SRC), sms = skinnedOf(M), sk = sms[0].skeleton;
  M.group.updateMatrixWorld(true); sk.update();
  const v = new THREE.Vector3(), rest = new THREE.Vector3(), carried = new Set();
  let worst = 0;
  for (const sm of sms) {
    const W = sm.geometry.attributes.skinWeight, J = sm.geometry.attributes.skinIndex, P = sm.geometry.attributes.position;
    for (const i of new Set(sm.geometry.index.array)) {
      const s = W.getX(i) + W.getY(i) + W.getZ(i) + W.getW(i); assert.ok(Math.abs(s - 1) < 1e-5, `vertex ${i}: weights ${s}`);
      carried.add(J.getX(i));
      rest.fromBufferAttribute(P, i).applyMatrix4(sm.matrixWorld);
      worst = Math.max(worst, sm.applyBoneTransform(i, v.fromBufferAttribute(P, i)).applyMatrix4(sm.matrixWorld).distanceTo(rest));
    }
  }
  assert.ok(worst < 1e-4, `bind round trip ${worst}`);
  // (the body's bone carries no vertex of its own: every part is a plate's or the core's, on the body)
  assert.deepEqual([...carried].sort(), [1, 2, 3], 'the top plate, the core and the bottom plate each carry their vertices');
  M.dispose();
});

function fight(build, id = 'drone@incal') {
  clearTargets(); TRIAL_BUILDERS.drone = build; nextRigSeed(41);
  const player = { pos: new THREE.Vector3(0, 0, 7), heading: Math.PI };
  const foes = new Foes({ level: { foes: { own: true } }, levelId: 'arena', scene: null, player, physics: { groundAt: () => 0 }, game: new GameState(null), rng: seeded() });
  const f = foes.add(id, new THREE.Vector3(), { tier: 0 }); f.heading = 0; f.provoked = true;
  return { foes, f, player, done() { foes.dispose(); delete TRIAL_BUILDERS.drone; clearTargets(); } };
}

test('it hovers as the ring drone did; its plates part for the harpoon and spin up for the ram; it goes down', () => {
  const tops = {};
  for (const [v, build] of Object.entries(BUILD)) {
    const { foes, f, done } = fight(build);
    for (let i = 0; i < 45; i++) foes.look(f, 1 / 30);
    f.model.group.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(f.model.body);
    tops[v] = box.min.y;
    if (v === 'tripo') {
      const top = f.model.tell('ram'), y0 = top.getWorldPosition(new THREE.Vector3()).y, spin0 = top.rotation.y;
      f.atk = f.def.attacks.find((a) => a.id === 'harpoon'); f.state = 'wind';
      for (let i = 0; i <= 30; i++) { f.k = i / 30; foes.look(f, 1 / 30); }
      assert.ok(top.getWorldPosition(new THREE.Vector3()).y > y0 + 0.06, 'the top plate lifts as the plates part');
      assert.ok(f.model.harpoon.visible, 'the harpoon out of its nozzle');
      f.atk = f.def.attacks.find((a) => a.id === 'ram'); f.state = 'wind';
      const s1 = top.rotation.y; for (let i = 0; i <= 30; i++) { f.k = i / 30; foes.look(f, 1 / 30); }
      assert.ok(Math.abs(top.rotation.y - s1) > Math.abs(s1 - spin0) * 0.5 + 1, 'the plates spin up for the ram');
    }
    f.atk = null; f.state = 'idle'; f.k = 0;
    foes.hurt(f, 'blade', new THREE.Vector3(-1, 0, 0), { damage: 99, source: 'charge', breaks: true });
    for (let i = 0; i < 40; i++) foes.update(1 / 30);
    assert.ok(f.dying || !f.alive, `${v}: down`);
    done();
  }
  assert.ok(Math.abs(tops.tripo - tops.legacy) < 0.8, `its body as high off the ground (${tops.tripo.toFixed(2)} m against ${tops.legacy.toFixed(2)} m)`);
});

test('it looks at the traveller: its core turns his way between the plates (#800, the author\'s)', () => {
  const at = {};
  for (const side of [1, -1]) {
    const { foes, f, player, done } = fight(BUILD.tripo);
    player.pos.set(side * 5, 0, 4);
    for (let i = 0; i < 90; i++) { f.dist = player.pos.distanceTo(f.pos); f.state = 'idle'; foes.look(f, 1 / 60); f.model.group.updateMatrixWorld(true); }
    assert.ok(f.gaze.watching, 'it has noticed him');
    at[side] = f.model.gaze[0].yaw;
    done();
  }
  assert.ok(at[1] > 0.15 && at[-1] < -0.15, `the core turns his way (${at[1].toFixed(2)}, ${at[-1].toFixed(2)})`);
});
