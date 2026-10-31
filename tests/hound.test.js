// The game's hound (issue #800): the broad-pawed Tripo hound, the author's pick of the trial, put in the game. Its asset
// (public/enemies/hound/body.glb: 512² texture, landmarks in the mesh's extras, vertex colours for the engines) is fetched
// before a world's foes are made (read at once in the engines and Node); without it the direct body (plans/broad-hound.js)
// stands in.
// Everything but the body is the hound's own: the id, def, attacks, windows, sounds, shadow form, death, lying body.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { Foes, FOES } from '../src/foes.js';
import { GameState } from '../src/game-state.js';
import { clearTargets } from '../src/targets.js';
import { SKINS, skinOf } from '../src/enemies/skins.js';
import { ARCHETYPES } from '../src/enemies/archetypes.js';
import { archetypeModel, TRIAL_BUILDERS } from '../src/enemies/plans/index.js';
import { houndSource, setHoundSource, houndModel, parseHound } from '../src/enemies/plans/hound-tripo.js';
import { lyingBody } from '../src/enemies/defeat.js';
import { presenceOf, presenceProblems } from '../src/foe-presence.js';
import { PLANS } from '../src/motion-kit/plans.js';
import { COLOURED_PICTURES } from '../engine/boot.js';
// (the fights' picks seeded: unseeded, a rare draw failed a test as the bodies changed, #800)
const seeded = (s = 7) => () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; };

const SRC = parseHound(readFileSync(new URL('../public/enemies/hound/body.glb', import.meta.url)));
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const arena = (player) => new Foes({ level: { foes: { own: true } }, levelId: 'arena', scene: null, player, physics: { groundAt: () => 0 }, game: new GameState(null), rng: () => 0.01 });
const drawn = (g) => { let n = 0; g.traverseVisible((o) => { if (o.isMesh) n++; }); return n; };
const withBody = (fn) => { const was = houndSource(); setHoundSource(SRC); try { return fn(); } finally { setHoundSource(was); } };

test('the asset: 10-15k triangles, a 512² texture, the landmarks in its extras, and the trial\'s mesh unchanged (#800)', () => {
  assert.ok(SRC.triangles >= 10000 && SRC.triangles <= 15000, `${SRC.triangles} triangles`);
  assert.equal(SRC.texture, 512);
  const L = SRC.landmarks;
  assert.equal(L.legs.length, 4); assert.equal(L.hornRoot.length, 2); assert.ok(L.bones.includes('head'));
  assert.ok(SRC.geometry.attributes.color && SRC.geometry.attributes.skinIndex && SRC.geometry.attributes.skinWeight, 'vertex colours and weights');
  assert.ok(SRC.bytes < 800 * 1024, `${SRC.bytes} bytes`);
  // (the engines draw it by its vertex colours, its picture left out quietly; Unity's player copies it)
  assert.ok(COLOURED_PICTURES.includes('enemies/hound/'));
  assert.match(read('unity/Hiraeth/Assets/HiraethJS/Editor/BridgeBuild.cs'), /"enemies\/hound", new\[\] \{ "body\.glb" \}/);
  // (fetched before a world's foes are made, the page and the gallery; 16-bit indices)
  assert.match(read('src/main.js'), /\nawait houndBody;/);
  assert.match(read('src/enemies/page.js'), /\nawait loadHoundBody\(\);/);
  assert.ok(SRC.geometry.index.array instanceof Uint16Array);
  // (node, like the engines, reads it at once)
  assert.ok(houndSource(), 'read at once');
});

test('the game builds the Tripo hound once its asset has loaded, the direct body before; no trial stands in', () => {
  assert.equal(TRIAL_BUILDERS.hound, undefined);
  setHoundSource(false);
  const D = archetypeModel('hound', 'eclipse');
  assert.equal(D.body3d, 'direct', 'before the asset: the direct broad-pawed body'); assert.equal(D.trial, undefined);
  D.dispose(); setHoundSource(null);
  withBody(() => {
    for (const id of Object.keys(SKINS.hound)) for (const tier of [0, 1]) {
      const M = archetypeModel('hound', id, tier);
      assert.equal(M.body3d, 'tripo', `${id}${tier ? '*' : ''}`);
      assert.equal(M.trial, undefined);
      for (const k of ['group', 'body', 'rig', 'parts', 'eyeMat', 'size', 'tones', 'tell', 'anim', 'dispose', 'gaze']) assert.ok(M[k] !== undefined, `${id}: ${k}`);
      assert.equal(M.rig.plan.gait, PLANS.quadruped.gait, 'on the hound\'s rig family');
      for (const a of ARCHETYPES.hound.def.attacks) assert.ok(M.tell(a.id)?.isObject3D, `${id}: a tell for ${a.id}`);
      assert.ok(drawn(M.group) <= 10, `${id}: ${drawn(M.group)} meshes`);
      M.dispose();
    }
  });
});

test('every skin\'s colours: the home skin by its texture (or its own vertex colours where none is decoded), the others recoloured; the Garden of Spheres\' muzzle pale', () => withBody(() => {
  const skinOfModel = (M) => { let sm = null; M.group.traverse((o) => { if (o.isSkinnedMesh) sm = o; }); return sm; };
  const home = houndModel(skinOf('hound', 'eclipse'));
  const hs = skinOfModel(home);
  assert.ok(hs.material.vertexColors || hs.material.uniforms?.uMap, 'node: no picture, so the asset\'s colours');
  home.dispose();
  // the Garden of Spheres: its muzzle (the mesh's own cream) pale, its horns (added after the mesh) the skin's dark antler
  const M = houndModel(skinOf('hound', 'spheres')), sm = skinOfModel(M), C = sm.geometry.attributes.color, n0 = SRC.geometry.attributes.position.count;
  const A0 = SRC.geometry.attributes.color, lum = (a, i) => a.getX(i) + a.getY(i) + a.getZ(i);
  let muzzle = null; for (let i = 0; i < n0; i++) if (lum(A0, i) > 2) { muzzle = i; break; }
  assert.ok(muzzle !== null, 'the mesh has its cream muzzle');
  assert.ok(lum(C, muzzle) > 2.2, `the muzzle pale (${lum(C, muzzle).toFixed(2)})`);
  assert.ok(lum(C, n0) < 0.6, `the horns dark (${lum(C, n0).toFixed(2)})`);
  M.dispose();
}));

test('its shadow form\'s rising head wears the new swept horns, a world\'s own (wire in the Market, bleached in the Mangrove)', () => withBody(() => {
  const verts = {};
  for (const id of ['eclipse', 'mangrove', 'bazaar']) {
    const M = houndModel(skinOf('hound', id));
    let rise = null; M.group.traverse((o) => { if (o.name === 'rising') rise = o; });
    // (its head, its horns and snout, its eyes: the horns the biggest)
    const meshes = []; rise.traverse((o) => { if (o.isMesh) meshes.push(o); });
    const horns = meshes.sort((a, b) => b.geometry.attributes.position.count - a.geometry.attributes.position.count)[0];
    const box = new THREE.Box3().setFromBufferAttribute(horns.geometry.attributes.position);
    assert.ok(box.max.y > 0.15 && box.max.x > 0.12, `${id}: horns over and beside the rising head (${box.max.y.toFixed(2)}, ${box.max.x.toFixed(2)} m)`);
    verts[id] = horns.geometry.attributes.position.count;
    M.dispose();
  }
  assert.notEqual(verts.bazaar, verts.eclipse, 'the Market\'s a tangle of wire');
}));

test('in the fight it stands at least to the traveller\'s hip, shows itself in every state, pounces, phases into a pool, goes down and leaves a body (#741, #797)', () => withBody(() => {
  clearTargets();
  const foes = arena({ pos: new THREE.Vector3(0, 0, 40), heading: Math.PI });
  const f = foes.add('hound@eclipse', new THREE.Vector3(), { tier: 0 }); f.heading = 0; f.provoked = true; f.lit = 99;
  assert.equal(f.model.body3d, 'tripo');
  assert.equal(f.def.name, 'horned hound');
  for (let i = 0; i < 45; i++) foes.look(f, 1 / 30);
  const top = new THREE.Box3().setFromObject(f.model.group).max.y;
  assert.ok(top >= 0.955 && top < 2.2, `${top.toFixed(2)} m`);
  assert.deepEqual(presenceProblems(presenceOf(f.model.group, 0)), []);
  const pounce = f.def.attacks.find((a) => a.id === 'pounce'), head = f.model.tell('pounce'), y0 = head.getWorldPosition(new THREE.Vector3()).y;
  assert.equal(pounce.wind, FOES.hound.attacks.find((a) => a.id === 'pounce').wind, 'the pounce\'s windows the hound\'s');
  f.atk = pounce; f.state = 'wind';
  for (let i = 0; i <= 30; i++) { f.k = i / 30; foes.look(f, 1 / 30); }
  assert.ok(head.getWorldPosition(new THREE.Vector3()).y < y0 - 0.15, 'the pounce\'s crouch');
  f.state = 'strike'; let up = 0;
  for (let i = 0; i <= 8; i++) { f.k = i / 8; foes.look(f, 1 / 30); up = Math.max(up, f.model.group.position.y); }
  assert.ok(up > 0.3, `the leap leaves the ground (${up.toFixed(2)} m)`);
  f.atk = null; f.state = 'chase'; f.k = 0; f.lit = 0;
  for (let i = 0; i < 30; i++) foes.look(f, 1 / 30);
  assert.ok(f.phased && f.model.body.visible === false, 'phased: no body');
  assert.deepEqual(presenceProblems(presenceOf(f.model.group, 0)), [], 'phased: its pool and rising head show');
  f.lit = 99; f.state = 'idle'; for (let i = 0; i < 30; i++) foes.look(f, 1 / 30);
  foes.hurt(f, 'blade', new THREE.Vector3(-1, 0, 0), { damage: 99, source: 'charge', breaks: true });
  for (let i = 0; i < 40; i++) foes.update(1 / 30);
  assert.ok(f.dying, 'down');
  assert.ok(lyingBody(f)?.r > 0.3, 'a lying body the traveller can\'t walk through (#797)');
  foes.dispose();
  clearTargets();
}));

test('the load\'s warm builds it (its programs compiled before the Arena\'s first hound comes in, #797) and keeps the body for that hound', () => withBody(() => {
  clearTargets();
  const foes = arena({ pos: new THREE.Vector3(0, 0, 40), heading: Math.PI });
  const w = foes.warmModels(['hound@eclipse', 'hound@spheres', 'hound@bazaar', 'hound@mangrove']);
  let tripo = 0; w.group.traverse((o) => { if (o.isSkinnedMesh && o.name === 'hound skin') tripo++; });
  assert.equal(tripo, 4, 'each skin\'s Tripo body in the warm');
  w.dispose({ keep: true });
  const f = foes.add('hound@spheres', new THREE.Vector3(), { tier: 0 });
  assert.equal(f.model.body3d, 'tripo', 'the kept body');
  foes.dispose();
  clearTargets();
}));

test('the Tripo hound shows itself in every state in every skin, calm or fighting, as every foe must (tests/foe-presence.test.js)', () => withBody(() => {
  const v = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z), DT = 1 / 60, failed = [], seen = new Set();
  for (const skin of Object.keys(SKINS.hound)) for (const calm of [false, true]) {
    clearTargets();
    const P = { pos: v(), vel: v(), heading: 0, onGround: true, health: 1, down: null, dead: false, hurt() {}, knockDown() { return true; }, flinch() {} };
    const foes = new Foes({ scene: new THREE.Scene(), level: { spawn: v(0, 0, -500), foes: { waves: true } }, levelId: 'arena', physics: { groundAt: () => 0, rayDistance: () => Infinity, rayHit: () => null }, player: P, settings: { enemies: 'normal' }, game: new GameState(null), rng: seeded() });
    foes.waveRest = 1e9;
    const f = foes.add(`hound@${skin}`, v(0, 0, calm ? 14 : 8), { calm });
    assert.equal(f.model.body3d, 'tripo');
    for (let i = 0; i < (calm ? 8 : 16) / DT; i++) {
      foes.update(DT); P.health = 1; P.down = null;
      if (i % 300 === 0) P.pos.set(Math.sin(i) * 4, 0, Math.cos(i) * 4);
      if (calm && i === 4 / DT) P.pos.set(0, 0, 11);
      if (!f.alive) break;
      const tag = `${skin}:${calm ? 'calm:' : ''}${f.state}${f.phased ? ':phased' : ''}`;
      seen.add(tag);
      const probs = presenceProblems(presenceOf(f.model.group, f.pos.y));
      if (probs.length) { failed.push(`${tag} at ${i}: ${probs.join(', ')}`); break; }
    }
    foes.dispose();
  }
  clearTargets();
  assert.deepEqual(failed, []);
  assert.ok([...seen].some((t) => t.includes(':phased')), 'phased ones checked');
}));
