// The mummer king (issue #800, family G): its approved redesign as its body (Tripo, src/enemies/plans/mummer-king-tripo.js
// on public/enemies/mummerking/, loaded by src/enemies/foe-assets.js; the junk king, plans/mummer.js legacyMummerKingModel,
// kept and standing in while the mesh loads). Tripo's biped rig posed directly by the clips (plans/tripo-biped.js): its
// weights folded onto the humanoid rig's joints, bound in the T-pose. It keeps the king's id, def, attacks and windows
// (smash, royal swing, the horn that wakes the camp, the thrown mummer that lands dazed), its size, its Desert site, the
// ragdoll (tests/foe-ragdoll.test.js) and its look at the traveller.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Foes, FOES } from '../src/foes.js';
import { GameState } from '../src/game-state.js';
import { clearTargets } from '../src/targets.js';
import { SKINS, skinOf } from '../src/enemies/skins.js';
import { ARCHETYPES } from '../src/enemies/archetypes.js';
import { archetypeModel } from '../src/enemies/plans/index.js';
import { legacyMummerKingModel, KING_HOLD } from '../src/enemies/plans/mummer.js';
import { tripoMummerKingModel, KING_TRIPO_MOVES } from '../src/enemies/plans/mummer-king-tripo.js';
import { foeSource, FOE_ASSETS, assetsOfKinds } from '../src/enemies/foe-assets.js';
import { WORLDS } from '../src/foe-worlds.js';

const SRC = foeSource('mummerking');
const seeded = (s = 7) => () => ((s = (s * 16807) % 2147483647) / 2147483647);
const arena = () => { clearTargets(); return new Foes({ level: { foes: { own: true } }, levelId: 'arena', scene: null, player: { pos: new THREE.Vector3(6, 0, 4), heading: Math.PI }, physics: { groundAt: () => 0 }, game: new GameState(null), rng: seeded() }); };
const body = (M) => { let s = null; M.group.traverse((o) => { if (o.isSkinnedMesh && o.name === 'tripo body') s = o; }); return s; };
const hexOf = (c, v) => '#' + [c.getX(v), c.getY(v), c.getZ(v)].map((x) => Math.round(x * 255).toString(16).padStart(2, '0')).join('');

test('the mummer king is the approved redesign: its Tripo body by default, the junk king kept as legacyMummerKingModel', () => {
  assert.ok(FOE_ASSETS.mummerking && SRC, 'its asset is read at once in node');
  assert.deepEqual(assetsOfKinds(['mummerking@desert']), ['mummerking']);
  const M = archetypeModel('mummerking', 'desert');
  assert.match(M.group.name, /mummer king \(Tripo\)/); assert.ok(M.tripo, 'a rebuilt body');
  let maps = 0; M.group.traverse((o) => { if (o.isMesh) for (const m of [].concat(o.material)) if (m.uniforms?.uMap?.value || m.map) maps++; });
  assert.equal(maps, 0, 'no texture: its vertex colours');
  M.dispose();
  const L = legacyMummerKingModel(skinOf('mummerking', 'desert'));
  assert.ok(L.group.getObjectByName('crown') && L.group.getObjectByName('beam'), 'the junk king still builds');
  L.dispose();
});

test('it keeps the king\'s fight: the def, its four attacks and their windows, the camp\'s horn, the thrown mummer; its Desert site', () => {
  const D = FOES.mummerking;
  assert.deepEqual(D.attacks.map((a) => a.id), ['smash', 'swing', 'horn', 'throw']);
  const [smash, swing, horn, thr] = D.attacks;
  assert.deepEqual([smash.wind, smash.strike, smash.contact, smash.range], [1.1, 0.3, 0.55, 3.8]);
  assert.deepEqual([swing.wind, swing.strike, swing.contact, swing.range], [1.1, 0.35, 0.5, 4]);
  assert.deepEqual([horn.wind, horn.horn], [1.2, 25]);
  assert.deepEqual([thr.wind, thr.throwsAlly, thr.lob], [1.0, 'mummer', true]);
  assert.deepEqual([D.hp, D.radius, D.height, D.heavy, D.stout, D.throws], [7, 0.95, 2.6, true, true, 'mummer']);
  assert.ok(WORLDS.desert.sites.includes('mummerking'), 'its Desert site');
  for (const [id, m] of Object.entries(KING_TRIPO_MOVES)) assert.ok(m.clip, `${id}: a clip`);
  assert.deepEqual(Object.keys(KING_HOLD), ['beam'], 'the paddle held as the door beam was: its reach and swings');
});

test('every skin and its tier build the contract on the one mesh in 3 draws: the body, its rigid parts, the eyes', () => {
  for (const id of Object.keys(SKINS.mummerking)) for (const tier of [0, 1]) {
    const M = tripoMummerKingModel(skinOf('mummerking', id, tier), SRC);
    for (const k of ['group', 'body', 'parts', 'eyeMat', 'size', 'tones', 'tell', 'anim', 'dispose', 'driver', 'joints', 'wield', 'gaze']) assert.ok(M[k] !== undefined, `${id}/${tier}: ${k}`);
    for (const a of FOES.mummerking.attacks) assert.ok(M.tell(a.id)?.isObject3D, `${id}: a tell for ${a.id}`);
    let n = 0; M.group.traverseVisible((o) => { if (o.isMesh) n++; });
    assert.equal(n, 3, `${id}/${tier}: ${n} meshes`);
    const top = new THREE.Box3().setFromObject(M.group).max.y;
    assert.ok(top > 2.6 && top < 2.8, `${id}: ${top.toFixed(2)} m to its crown (the junk king's 2.68)`);
    const C = body(M).geometry.attributes.color;
    if (tier) assert.notEqual(hexOf(C, 0), hexOf(SRC.geometry.attributes.color, 0), 'its tier darker');
    M.dispose();
  }
});

test('the Tripo skin: 10–15k triangles, flat colours, normalised weights on the rig\'s joints, a knee bent moves only its leg', () => {
  const tris = SRC.geometry.index.count / 3;
  assert.ok(tris >= 10000 && tris <= 15000, `${tris} triangles`);
  assert.equal(SRC.rig.joints.length, 23, 'Tripo\'s biped rig');
  const pal = new Set(Object.values(SRC.rig.palette)), col = SRC.geometry.attributes.color, seen = new Map();
  for (let v = 0; v < col.count; v++) { const h = hexOf(col, v); seen.set(h, (seen.get(h) ?? 0) + 1); }
  assert.deepEqual([...seen.keys()].filter((h) => !pal.has(h)), [], 'COLOR_0 holds only the reference\'s flat colours');
  for (const k of ['body', 'shin', 'mask', 'crown', 'glove', 'boot']) assert.ok(seen.get(SRC.rig.palette[k]) > 40, `${k}: ${seen.get(SRC.rig.palette[k])}`);
  const M = tripoMummerKingModel(skinOf('mummerking', 'desert'), SRC), sm = body(M);
  assert.ok(sm.skeleton.bones.includes(M.gaze[0].node), 'the head bone is the look');
  const W = sm.geometry.attributes.skinWeight, P = sm.geometry.attributes.position, n = P.count;
  for (let i = 0; i < n; i++) { const s = W.getX(i) + W.getY(i) + W.getZ(i) + W.getW(i); assert.ok(Math.abs(s - 1) < 1e-5, `vertex ${i}: weights ${s}`); }
  M.group.updateMatrixWorld(true); sm.skeleton.update();
  const v = new THREE.Vector3(), at = (i) => sm.applyBoneTransform(i, v.fromBufferAttribute(P, i)).applyMatrix4(sm.matrixWorld).clone();
  const before = Array.from({ length: n }, (_, i) => at(i));
  // (at the rig's rest the arms hang: the gauntlets under the shoulders)
  const hand = sm.skeleton.bones.indexOf(M.joints.hands[1]), I = sm.geometry.attributes.skinIndex;
  let low = 0, k = 0; for (let i = 0; i < n; i++) if (I.getX(i) === hand && W.getX(i) > 0.9) { k++; if (before[i].y < 1.5) low++; }
  assert.ok(k > 100 && low / k > 0.9, `the left gauntlet hangs (${low}/${k})`);
  M.joints.knees[0].rotateX(-0.8); M.group.updateMatrixWorld(true); sm.skeleton.update();
  let moved = 0; const wrong = [];
  for (let i = 0; i < n; i++) { const d = at(i).distanceTo(before[i]); if (d > 1e-3) { moved++; if ((before[i].x > 0.05 && d > 0.005) || before[i].y > 1.1) wrong.push(before[i].toArray().map((x) => +x.toFixed(2))); } }
  assert.ok(moved > 100, `the knee moved ${moved} vertices`);
  assert.deepEqual(wrong.slice(0, 5), [], 'nothing on the left or over the hips moved');
  M.dispose();
});

test('in the fight: it looks at the traveller (the head bone, its mask, eyes and crown with it), the paddle in its gauntlet through every clip', () => {
  const foes = arena();
  const f = foes.add('mummerking@desert', new THREE.Vector3(), { tier: 0 }); f.heading = 0; f.provoked = true;
  for (let i = 0; i < 45; i++) { f.dist = 7; foes.look(f, 1 / 30); }
  const M = f.model, look = M.gaze[0].node, fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(look.getWorldQuaternion(new THREE.Quaternion()));
  assert.ok(fwd.x > 0.25, `the head turns to the traveller off to its left (${fwd.x.toFixed(2)})`);
  const eyes = M.group.getObjectByName('eyes'); assert.equal(eyes.parent, look, 'the eyes on the head bone');
  // the paddle through the right gauntlet's centre (no fingers to close: the haft through the mitten's middle)
  const sm = body(M), hand = sm.skeleton.bones.indexOf(M.joints.hands[0]), P = sm.geometry.attributes.position, SI = sm.geometry.attributes.skinIndex, SW = sm.geometry.attributes.skinWeight, glove = [];
  for (let i = 0; i < P.count; i++) if (SI.getX(i) === hand && SW.getX(i) > 0.99) glove.push(i);
  const v = new THREE.Vector3(); let worst = 0, where = '';
  const check = (what) => {
    M.group.updateMatrixWorld(true); sm.skeleton.update();
    const pts = glove.map((i) => sm.applyBoneTransform(i, v.fromBufferAttribute(P, i)).applyMatrix4(sm.matrixWorld).clone());
    const c = pts.reduce((s, p) => s.add(p), new THREE.Vector3()).divideScalar(pts.length), beam = M.group.getObjectByName('beam');
    if (beam.scale.x < 0.5) return;
    const o = beam.getWorldPosition(new THREE.Vector3()), ax = new THREE.Vector3(0, 1, 0).applyQuaternion(beam.getWorldQuaternion(new THREE.Quaternion()));
    const d = c.clone().sub(o), off = d.sub(ax.clone().multiplyScalar(d.dot(ax))).length(), r = pts.map((p) => p.distanceTo(c)).sort((a, b) => a - b)[pts.length >> 1];
    if (off / r > worst) { worst = off / r; where = `${what}: ${off.toFixed(3)} m off, the gauntlet ${r.toFixed(3)} m`; }
  };
  const run = (secs, set, what) => { for (let t = 0; t < secs; t += 1 / 30) { set(t); foes.look(f, 1 / 30); if (Math.round(t * 30) % 3 === 0) check(`${what} ${t.toFixed(2)}`); } };
  run(1.5, () => { f.state = 'idle'; f.atk = null; f.dist = 7; }, 'idle');
  for (const pace of [1, 3]) run(1.5, () => { f.state = 'chase'; f.atk = null; f.dist = 7; f.pos.z += pace / 30; }, pace > 2 ? 'run' : 'walk');
  for (const a of FOES.mummerking.attacks.filter((x) => x.id === 'smash' || x.id === 'swing')) {
    const strike = a.strike ?? 0.3;
    run(a.wind + strike + 0.5, (t) => { f.atk = a; f.dist = 2; f.state = t < a.wind ? 'wind' : t < a.wind + strike ? 'strike' : 'recover'; f.k = f.state === 'wind' ? t / a.wind : f.state === 'strike' ? (t - a.wind) / strike : 0; }, a.id);
  }
  f.atk = null; f.state = 'idle';
  foes.hurt(f, 'blade', new THREE.Vector3(-1, 0, 0), { damage: 0.1, source: 'combo', combo: 0 });
  run(0.6, () => {}, 'hurt');
  assert.ok(worst < 0.35, `the haft through the gauntlet: worst ${where}`);
  foes.dispose(); clearTargets();
});

test('its belly patch and knee pads are clean discs on the mesh, its eyes two black ovals proud of the mask', () => {
  const M = tripoMummerKingModel(skinOf('mummerking', 'desert'), SRC);
  const E = SRC.rig.landmarks.eyes;
  assert.ok(E.left.centre[0] > 0.05 && E.right.centre[0] < -0.05, 'one each side');
  for (const e of [E.left, E.right]) assert.ok(e.texels > 40 && e.w > 0.02 && e.w < 0.09 && e.h > 0.04 && e.h < 0.14 && e.centre[1] > 2.05 && e.centre[1] < 2.3, JSON.stringify(e));
  assert.equal(M.eyeMat.uniforms.uColor.value.getHexString(), '000000', 'black, as drawn');
  assert.equal(M.tripo.eyes, 2);
  M.dispose();
});
