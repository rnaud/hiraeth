// The cinder wisp (issue #800): the Tripo body is the game's wisp (src/enemies/plans/wisp-tripo.js, its shipped asset
// public/enemies/wisp/body.glb), the legacy ember bud (plans/ember-legacy.js) its stand-in where the body is not loaded,
// kept so its look can come back. Every skin builds and keeps its palette and props, its petals open on their hinges, its
// eyes look at the traveller, the ball leaves from its coal, and it drops as a flyer does.
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
import { wispLegacyModel } from '../src/enemies/plans/ember-legacy.js';
import { tripoWispModel, wispSource, WISP_BODY, WISP_ROLES } from '../src/enemies/plans/wisp-tripo.js';
import { parseTripoBody } from '../src/enemies/plans/tripo-body.js';
import { nextRigSeed } from '../src/motion-kit/rig.js';

THREE.ColorManagement.enabled = false;
const SRC = wispSource();
const BUILD = { legacy: wispLegacyModel, tripo: (skin) => tripoWispModel(skin, SRC) };
const seeded = (s = 7) => () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; };
const drawn = (g) => { let n = 0; g.traverseVisible((o) => { if (o.isMesh) n++; }); return n; };
const skinnedOf = (M) => { const out = []; M.group.traverse((o) => { if (o.isSkinnedMesh) out.push(o); }); return out; };
const named = (M, name) => { let out = null; M.group.traverse((o) => { if (o.name === name) out = o; }); return out; };
const hex = (m) => `#${m.uniforms.uColor.value.getHexString()}`;
function posed(M) {
  M.group.updateMatrixWorld(true);
  const b = new THREE.Box3(), v = new THREE.Vector3();
  for (const sm of skinnedOf(M)) { sm.skeleton.update(); const P = sm.geometry.attributes.position; for (const i of new Set(sm.geometry.index.array)) b.expandByPoint(sm.applyBoneTransform(i, v.fromBufferAttribute(P, i)).applyMatrix4(sm.matrixWorld)); }
  return b;
}

test('the game\'s wisp is the Tripo cinder wisp, from its shipped body, in every skin; the legacy kept (#800)', () => {
  assert.deepEqual(Object.keys(TRIAL_BUILDERS), []);
  for (const id of Object.keys(SKINS.wisp)) { const M = archetypeModel('wisp', id); assert.equal(M.tripo, 'tripo', id); M.dispose(); }
  const T = parseTripoBody(readFileSync(new URL('../references/enemy-redesign-2026-10-30/trials/familyF-tripo/wisp-lod.glb', import.meta.url)));
  assert.deepEqual(Array.from(SRC.geometry.attributes.position.array), Array.from(T.geometry.attributes.position.array));
  assert.deepEqual(Array.from(SRC.geometry.index.array), Array.from(T.geometry.index.array));
  assert.equal(SRC.geometry.attributes.uv, undefined, 'no picture (no UVs)');
  assert.deepEqual(SRC.landmarks, JSON.parse(readFileSync(new URL('../references/enemy-redesign-2026-10-30/trials/familyF-tripo/wisp-landmarks.json', import.meta.url), 'utf8')));
  assert.ok(readFileSync(new URL(`../public/${WISP_BODY}`, import.meta.url)).length < 450 * 1024, 'under 450 KB');
  for (const id of Object.keys(SKINS.wisp)) { const M = wispLegacyModel(skinOf('wisp', id)); assert.equal(M.tripo, undefined); M.dispose(); }
  const home = skinOf('wisp', 'moonfoundry').palette;
  assert.deepEqual([home.shell, home.cup], [WISP_ROLES.petal, WISP_ROLES.cup], 'the home skin the reference\'s');
});

test('every world\'s skin builds on the Tripo body: the cup and four petals, the coal, its props, its tells', () => {
  for (const id of Object.keys(SKINS.wisp)) {
    const skin = skinOf('wisp', id), P = skin.palette, M = tripoWispModel(skin, SRC);
    for (const k of ['group', 'body', 'parts', 'eyeMat', 'size', 'tones', 'tell', 'anim', 'dispose', 'mouthAt']) assert.ok(M[k] !== undefined, `${id}: ${k}`);
    const sms = skinnedOf(M);
    assert.equal(sms.length, 2, `${id}: the cup, and the four petals in one mesh`);
    assert.equal(new Set(sms.map((s) => s.skeleton)).size, 1, `${id}: one skeleton`);
    assert.equal(hex(named(M, 'wisp petals').material), P.shell, `${id}: its petals`);
    assert.equal(!!named(M, 'band'), (skin.props ?? []).includes('brass'), `${id}: its brass band`);
    assert.ok(drawn(M.group) <= 9, `${id}: ${drawn(M.group)} meshes`);
    assert.equal(M.fire, P.fire, `${id}: its fire's colour`);
    for (const a of ARCHETYPES.wisp.def.attacks) assert.ok(M.tell(a.id)?.isObject3D, `${id}: a tell for ${a.id}`);
    M.dispose();
  }
});

test('the Tripo skin: its triangles, normalised weights, an exact bind, a petal opened alone moves only its own and its seam', () => {
  const tris = SRC.geometry.index.count / 3;
  assert.ok(tris >= 10000 && tris <= 16000, `${tris} triangles`);
  const M = tripoWispModel(skinOf('wisp', 'moonfoundry'), SRC), sms = skinnedOf(M), sk = sms[0].skeleton;
  M.group.updateMatrixWorld(true); sk.update();
  const v = new THREE.Vector3(), rest = new THREE.Vector3();
  let worst = 0;
  for (const sm of sms) {
    const W = sm.geometry.attributes.skinWeight, Pp = sm.geometry.attributes.position;
    for (const i of new Set(sm.geometry.index.array)) {
      const s = W.getX(i) + W.getY(i) + W.getZ(i) + W.getW(i); assert.ok(Math.abs(s - 1) < 1e-5, `vertex ${i}: weights ${s}`);
      rest.fromBufferAttribute(Pp, i).applyMatrix4(sm.matrixWorld);
      worst = Math.max(worst, sm.applyBoneTransform(i, v.fromBufferAttribute(Pp, i)).applyMatrix4(sm.matrixWorld).distanceTo(rest));
    }
  }
  assert.ok(worst < 1e-4, `bind round trip ${worst}`);
  // (the front petal opened alone: the back petal's vertices stay put)
  sk.bones[1].rotation.x = 1.2; M.group.updateMatrixWorld(true); sk.update();
  const petals = sms.find((s) => s.name === 'wisp petals'), [bf, bc] = SRC.landmarks.parts.back, I = SRC.geometry.index.array; let moved = 0;
  for (const i of new Set(I.subarray(bf * 3, (bf + bc) * 3))) { rest.fromBufferAttribute(petals.geometry.attributes.position, i); moved = Math.max(moved, petals.applyBoneTransform(i, v.fromBufferAttribute(petals.geometry.attributes.position, i)).distanceTo(rest)); }
  assert.ok(moved < 1e-4, `the back petal moved ${moved}`);
  M.dispose();
});

function fight(build, id = 'wisp@moonfoundry') {
  clearTargets(); TRIAL_BUILDERS.wisp = build; nextRigSeed(19);
  const player = { pos: new THREE.Vector3(0, 0, 8), heading: Math.PI };
  const foes = new Foes({ level: { foes: { own: true } }, levelId: 'arena', scene: null, player, physics: { groundAt: () => 0 }, game: new GameState(null), rng: seeded() });
  const f = foes.add(id, new THREE.Vector3(), { tier: 0 }); f.heading = 0; f.provoked = true;
  return { foes, f, player, done() { foes.dispose(); delete TRIAL_BUILDERS.wisp; clearTargets(); } };
}

test('it hovers high, opens its petals for the fireball with its coal rising, clenches for the flare, and drops as it dies', () => {
  for (const [v, build] of Object.entries(BUILD)) {
    const { foes, f, done } = fight(build);
    for (let i = 0; i < 60; i++) foes.look(f, 1 / 30);
    const coal = new THREE.Vector3();
    if (v === 'tripo') {
      const rest = posed(f.model), c0 = f.model.mouthAt(new THREE.Vector3());
      assert.ok(rest.min.y > 2.5, `${v}: high over the ground (${rest.min.y.toFixed(2)} m)`);
      f.atk = f.def.attacks.find((a) => a.id === 'fireball'); f.state = 'wind';
      for (let i = 0; i <= 30; i++) { f.k = (i / 30) * 0.8; foes.look(f, 1 / 30); }
      const open = posed(f.model), w0 = rest.max.x - rest.min.x, w1 = open.max.x - open.min.x;
      assert.ok(w1 > w0 * 1.5, `${v}: the petals open (${w0.toFixed(2)} → ${w1.toFixed(2)} m across)`);
      f.model.mouthAt(coal);
      assert.ok(coal.y > c0.y - 0.3, `${v}: the ball leaves from the coal`);
      f.atk = f.def.attacks.find((a) => a.id === 'flare');
      for (let i = 0; i <= 30; i++) { f.k = (i / 30) * 0.8; foes.look(f, 1 / 30); }
      const shut = posed(f.model);
      assert.ok(shut.max.x - shut.min.x <= w0 * 1.05, `${v}: clenched shut for the flare`);
      f.atk = null; f.state = 'idle'; f.k = 0;
    }
    foes.hurt(f, 'blade', new THREE.Vector3(-1, 0, 0), { damage: 99, source: 'charge', breaks: true });
    for (let i = 0; i < 60; i++) foes.update(1 / 30);
    assert.ok(f.dying || !f.alive, `${v}: down`);
    done();
  }
});

test('it looks at the traveller: its eyes slide his way (#800, the author\'s)', () => {
  const at = {};
  for (const side of [1, -1]) {
    const { foes, f, player, done } = fight(BUILD.tripo);
    player.pos.set(side * 5, 0, 5);
    for (let i = 0; i < 90; i++) { f.dist = player.pos.distanceTo(f.pos); f.state = 'idle'; foes.look(f, 1 / 60); f.model.group.updateMatrixWorld(true); }
    assert.ok(f.gaze.watching, 'it has noticed him');
    at[side] = f.model.gaze[0].node.position.x - f.model.gaze[0].rest.x;
    done();
  }
  assert.ok(at[1] > 0.005 && at[-1] < -0.005, `the eyes slide his way (${at[1].toFixed(3)}, ${at[-1].toFixed(3)})`);
});
