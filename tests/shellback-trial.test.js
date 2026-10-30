// The shellback crab (issue #800): the Tripo body is the game's crab (src/enemies/plans/shellback-tripo.js, its shipped
// asset public/enemies/shellback/body.glb), the direct one (src/enemies/plans/shellback.js) its stand-in where the body is
// not loaded. Both keep the crab's model contract; the Tripo skin's weights are sound; every world's skin wears its dress.
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
import { shellbackModel } from '../src/enemies/plans/shellback.js';
import { tripoShellbackModel, shellbackSource, parseShellback, SHELLBACK_BODY } from '../src/enemies/plans/shellback-tripo.js';
import { PLANS } from '../src/motion-kit/plans.js';
import { lyingBody } from '../src/enemies/defeat.js';

THREE.ColorManagement.enabled = false;   // (as the game: colours are display values, src/main.js)
const SRC = shellbackSource();
SRC.triangles = SRC.geometry.index.count / 3;
const BUILD = { direct: shellbackModel, tripo: (skin) => tripoShellbackModel(skin, SRC) };
const variant = (M) => M.trial ?? M.shellback;
const drawn = (g) => { let n = 0; g.traverseVisible((o) => { if (o.isMesh) n++; }); return n; };

test('the game\'s crab is the Tripo shellback, from its shipped body, in every skin (#800)', () => {
  assert.deepEqual(Object.keys(TRIAL_BUILDERS), []);
  for (const id of Object.keys(SKINS.crab)) { const M = archetypeModel('crab', id); assert.equal(M.shellback, 'tripo', id); M.dispose(); }
  // (the shipped file: the trial's mesh as it is, its indices 16 bits, the flat texture 512², the landmarks in its extras)
  const trial = readFileSync(new URL('../references/enemy-redesign-2026-10-30/trials/shellback-tripo/tripo-lod.glb', import.meta.url));
  const T = parseShellback(trial);
  assert.deepEqual(Array.from(SRC.geometry.attributes.position.array), Array.from(T.geometry.attributes.position.array));
  assert.deepEqual(Array.from(SRC.geometry.attributes.color.array), Array.from(T.geometry.attributes.color.array));
  assert.deepEqual(Array.from(SRC.geometry.index.array), Array.from(T.geometry.index.array));
  assert.ok(SRC.geometry.index.array instanceof Uint16Array);
  assert.equal(SRC.image.mime, 'image/png');
  const png = new DataView(SRC.image.bytes.buffer, SRC.image.bytes.byteOffset);
  assert.deepEqual([png.getUint32(16), png.getUint32(20)], [512, 512], 'the texture 512²');
  assert.deepEqual(SRC.landmarks, JSON.parse(readFileSync(new URL('../references/enemy-redesign-2026-10-30/trials/shellback-tripo/landmarks.json', import.meta.url), 'utf8')));
  assert.ok(readFileSync(new URL(`../public/${SHELLBACK_BODY}`, import.meta.url)).length < 450 * 1024, 'under 450 KB');
});

test('where no picture is drawn (the engines, node) the home skin wears its vertex colours, the texture\'s five', () => {
  assert.equal(SRC.map, null);
  const M = tripoShellbackModel(skinOf('crab', 'arzach2'), SRC); let sm = null; M.group.traverse((o) => { if (o.isSkinnedMesh) sm = o; });
  const C = sm.geometry.attributes.color, S = SRC.geometry.attributes.color;
  assert.ok(C, 'vertex colours');
  for (let i = 0; i < C.count; i += 97) for (const [a, b] of [[C.getX(i), S.getX(i)], [C.getY(i), S.getY(i)], [C.getZ(i), S.getZ(i)]]) assert.ok(Math.abs(a - b) < 1.5 / 255, `vertex ${i}`);
  M.dispose();
});

test('every world\'s skin wears its palette and its dress on the Tripo dome: merged, sitting on it, gone when it cracks', () => {
  const want = { garage: ['antennae'], bazaar: ['awning'], saltharbour: ['barnacles', 'rope'], glassdunes: ['facets'], underwater: ['coral'], antennas: ['antennae', 'patina'] };
  for (const [id, props] of Object.entries(want)) {
    const skin = skinOf('crab', id); assert.deepEqual(skin.props.filter((p) => p !== 'sheen'), props, id);
    const M = tripoShellbackModel(skin, SRC), dress = M.parts.find((p) => p.name === 'dress'), dome = M.parts.find((p) => p.name === 'dome');
    let meshes = 0; dress.traverse((o) => { if (o.isMesh) meshes++; });
    assert.ok(meshes >= 1 && meshes <= 3, `${id}: ${meshes} dress meshes`);
    // (on the dome: none sunk far into it, the anchor hanging off its side no lower than the hips)
    M.group.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(dress), d = new THREE.Box3().setFromObject(dome);
    assert.ok(box.min.y > d.min.y - 0.4 && box.max.y < d.max.y + 0.7, `${id}: the dress over the dome (${box.min.y.toFixed(2)}–${box.max.y.toFixed(2)} against ${d.min.y.toFixed(2)}–${d.max.y.toFixed(2)})`);
    // the skin's own colours on the body
    let sm = null; M.group.traverse((o) => { if (o.isSkinnedMesh) sm = o; });
    const legs = new THREE.Color(skin.palette.leg), C = sm.geometry.attributes.color;
    let found = false; for (let i = 0; i < C.count && !found; i++) found = Math.abs(C.getX(i) - legs.r) < 1e-4 && Math.abs(C.getY(i) - legs.g) < 1e-4 && Math.abs(C.getZ(i) - legs.b) < 1e-4;
    assert.ok(found, `${id}: its legs' colour`);
    assert.equal(dome.material, M.plates[0].material, `${id}: the scutes the dome's own`);
    M.dispose();
  }
  // the home skin: the reference's, no dress
  const H = tripoShellbackModel(skinOf('crab', 'arzach2'), SRC); let n = 0; H.parts.find((p) => p.name === 'dress').traverse((o) => { if (o.isMesh) n++; }); assert.equal(n, 0); H.dispose();
});

test('both trial shellbacks build in every crab skin, keep the model contract and cut the crab\'s 67 meshes to a handful', () => {
  const crab = ARCHETYPES.crab.def;
  for (const [v, build] of Object.entries(BUILD)) for (const id of Object.keys(SKINS.crab)) {
    const M = build(skinOf('crab', id));
    for (const k of ['group', 'body', 'rig', 'parts', 'eyeMat', 'size', 'tones', 'tell', 'anim', 'dispose']) assert.ok(M[k] !== undefined, `${v}@${id}: ${k}`);
    assert.equal(variant(M), v);
    assert.equal(M.rig.legs.length, 6, `${v}: six legs on the kit`);
    assert.equal(M.rig.plan, PLANS.walker, `${v}: on the crab's rig family, the walker plan`);
    assert.equal(M.plates.length, 2, `${v}: its two scutes of armour (#722)`);
    for (const a of crab.attacks) assert.ok(M.tell(a.id)?.isObject3D, `${v}: a tell for ${a.id}`);
    assert.ok(drawn(M.group) <= 9, `${v}@${id}: ${drawn(M.group)} meshes`);
    M.dispose();
  }
});

test('in the fight both stand at least to the traveller\'s hip, snap, guard, go down and leave a body (#741, #797)', () => {
  clearTargets();
  for (const [v, build] of Object.entries(BUILD)) {
    TRIAL_BUILDERS.crab = build;
    const foes = new Foes({ level: { foes: { own: true } }, levelId: 'arena', scene: null, player: { pos: new THREE.Vector3(0, 0, 40), heading: Math.PI }, physics: { groundAt: () => 0 }, game: new GameState(null), rng: () => 0.01 });
    const f = foes.add('crab@arzach2', new THREE.Vector3(), { tier: 0 }); f.heading = 0;
    assert.equal(variant(f.model), v);
    for (let i = 0; i < 45; i++) foes.look(f, 1 / 30);
    const top = new THREE.Box3().setFromObject(f.model.group).max.y;
    assert.ok(top >= 0.955 && top < 2.2, `${v}: ${top.toFixed(2)} m`);
    // the snap through its wind-up and strike: the pincer moves
    const snap = f.def.attacks.find((a) => a.id === 'snap'), tip = f.model.tell('snap'), at0 = tip.getWorldPosition(new THREE.Vector3());
    f.atk = snap; f.state = 'wind';
    for (let i = 0; i <= 20; i++) { f.k = i / 20; foes.look(f, 1 / 30); }
    assert.ok(tip.getWorldPosition(new THREE.Vector3()).distanceTo(at0) > 0.2, `${v}: the snap's pincer rears`);
    f.atk = null; f.state = 'idle'; f.k = 0;
    f.guardK = 1; for (let i = 0; i < 20; i++) foes.look(f, 1 / 30); f.guardK = 0;
    for (const x of [f.model.group]) x.updateMatrixWorld(true);
    foes.hurt(f, 'blade', new THREE.Vector3(-1, 0, 0), { damage: 99, source: 'charge', breaks: true });
    for (let i = 0; i < 40; i++) foes.update(1 / 30);
    assert.ok(f.dying, `${v}: down`);
    assert.ok(lyingBody(f)?.r > 0.3, `${v}: a lying body the traveller can't walk through (#797)`);
    foes.dispose();
    delete TRIAL_BUILDERS.crab;
  }
  clearTargets();
});

test('the Tripo skin: 10–15k triangles, normalised weights, an exact bind, every part moving only its own vertices', () => {
  assert.ok(SRC.triangles >= 10000 && SRC.triangles <= 15000, `${SRC.triangles} triangles`);
  const M = tripoShellbackModel(skinOf('crab', 'arzach2'), SRC);
  let sm = null; M.group.traverse((o) => { if (o.isSkinnedMesh) sm = o; });
  const W = sm.geometry.attributes.skinWeight, J = sm.geometry.attributes.skinIndex, P = sm.geometry.attributes.position, n = P.count;
  const used = new Set(sm.geometry.index.array);
  const per = new Map();
  for (const i of used) { const s = W.getX(i) + W.getY(i) + W.getZ(i) + W.getW(i); assert.ok(Math.abs(s - 1) < 1e-5, `vertex ${i}: weights ${s}`); per.set(J.getX(i), (per.get(J.getX(i)) ?? 0) + 1); }
  assert.equal(per.size, sm.skeleton.bones.length, 'every bone carries vertices');
  M.group.updateMatrixWorld(true); sm.skeleton.update();
  const rest = new THREE.Vector3(), v = new THREE.Vector3();
  const skinned = (i) => sm.applyBoneTransform(i, v.fromBufferAttribute(P, i)).applyMatrix4(sm.matrixWorld);
  let worst = 0; for (const i of used) { rest.fromBufferAttribute(P, i).applyMatrix4(sm.matrixWorld); worst = Math.max(worst, skinned(i).distanceTo(rest)); }
  assert.ok(worst < 1e-4, `bind round trip ${worst}`);
  // a shin bent alone: its own leg's vertices move, no vertex of another leg or of the dome's side
  const bone = sm.skeleton.bones.find((b) => b.name === 'leg0_shin'), before = [...used].map((i) => skinned(i).clone());
  bone.rotateX(0.5); M.group.updateMatrixWorld(true); sm.skeleton.update();
  const k0 = SRC.landmarks.legs[0].knee;
  let moved = 0, far = 0;
  [...used].forEach((i, j) => { const d = skinned(i).distanceTo(before[j]); if (d > 1e-3) { moved++; if (before[j].distanceTo(new THREE.Vector3(...k0)) > 0.75) far++; } });
  assert.ok(moved > 50, `the shin moved ${moved} vertices`);
  assert.equal(far, 0, 'nothing far from that leg moved');
  M.dispose();
});

// ------------------------------------------------------------------ the phase 2a fixes (#800): lip, colours, claw, gaze
const LIP = SRC.landmarks.lip;
/** The lip's height at a point's azimuth (prepare.mjs's Fourier series), less its drop: the cut. */
const cutAt = (x, z) => { const a = Math.atan2(x, z - LIP.centre[1]); let y = LIP.y[0]; for (let k = 1; k <= LIP.order; k++) y += LIP.y[2 * k - 1] * Math.cos(k * a) + LIP.y[2 * k] * Math.sin(k * a); return y - LIP.drop; };
const hexAt = (C, i) => '#' + [C.getX(i), C.getY(i), C.getZ(i)].map((x) => Math.round(x * 255).toString(16).padStart(2, '0')).join('');

test('the Tripo dome is cut along its lip, by geometry: every dome vertex over the lip, its open edge on it', () => {
  const g = SRC.geometry, P = g.attributes.position, I = g.index.array, nd = SRC.landmarks.domeTriangles * 3;
  assert.ok(nd / 3 > 1500 && nd < I.length / 2, `${nd / 3} dome triangles`);
  let under = 0; for (let t = 0; t < nd; t++) { const i = I[t]; if (P.getY(i) < cutAt(P.getX(i), P.getZ(i)) - 1e-3) under++; }
  assert.equal(under, 0, 'no dome vertex under the cut');
  // its boundary (edges of one dome triangle only, welded across UV seams) lies on the cut, a millimetre at most
  const key = (i) => `${Math.round(P.getX(i) * 2e4)},${Math.round(P.getY(i) * 2e4)},${Math.round(P.getZ(i) * 2e4)}`, edges = new Map();
  for (let t = 0; t < nd; t += 3) for (let k = 0; k < 3; k++) { const a = I[t + k], b = I[t + (k + 1) % 3], e = [key(a), key(b)].sort().join('|'); edges.set(e, [(edges.get(e)?.[0] ?? 0) + 1, a]); }
  // (the export's own two hairline cracks high on the crown, 2 mm wide, are not the lip's)
  let open = 0, off = 0, cracks = 0;
  for (const [n, i] of edges.values()) if (n === 1) { const d = P.getY(i) - cutAt(P.getX(i), P.getZ(i)); if (d > 0.3) { cracks++; continue; } open++; off = Math.max(off, Math.abs(d)); }
  assert.ok(open > 100, `${open} edges round the lip`);
  assert.ok(off < 1e-3, `the dome's edge off the cut by ${off} m`);
  assert.ok(cracks <= 4, `${cracks} crack edges`);
  // and the lip one smooth closed curve round the body, 0.65–0.95 m up
  for (let a = 0; a < 2 * Math.PI; a += 0.1) { const y = cutAt(Math.sin(a), LIP.centre[1] + Math.cos(a)); assert.ok(y > 0.65 && y < 0.95, `lip at ${a.toFixed(1)}: ${y}`); }
});

test('the Tripo colours are flat: one colour a role, the reference\'s, and nothing ochre under the lip', () => {
  const C = SRC.geometry.attributes.color, P = SRC.geometry.attributes.position, I = SRC.geometry.index.array, pal = SRC.landmarks.palette, seen = new Set();
  for (let i = 0; i < C.count; i++) seen.add(hexAt(C, i));
  assert.deepEqual([...seen].sort(), Object.values(pal).sort(), 'shell, cream, red, green, dark: no in-between');
  // (the lip's own vertices, on the cut, are the skin's too: they wear what is under the lip)
  const nd = SRC.landmarks.domeTriangles * 3, domeV = new Set(I.subarray(0, nd)), restV = new Set(I.subarray(nd));
  for (const i of domeV) if (!restV.has(i)) assert.equal(hexAt(C, i), pal.shell, 'the dome all ochre');
  let under = 0; for (const i of new Set(I.subarray(nd))) if (!domeV.has(i) && hexAt(C, i) === pal.shell && P.getY(i) < cutAt(P.getX(i), P.getZ(i)) - 0.01) under++;
  assert.equal(under, 0, 'nothing ochre under the lip');
});

/** A foe of the trial body in a bare fight, the traveller in front. */
function fight(build) {
  clearTargets(); TRIAL_BUILDERS.crab = build;
  const player = { pos: new THREE.Vector3(0, 0, 4), heading: Math.PI };
  const foes = new Foes({ level: { foes: { own: true } }, levelId: 'arena', scene: null, player, physics: { groundAt: () => 0 }, game: new GameState(null), rng: () => 0.01 });
  const f = foes.add('crab@arzach2', new THREE.Vector3(), { tier: 0 }); f.heading = 0; f.provoked = true;
  return { foes, f, player, done() { foes.dispose(); delete TRIAL_BUILDERS.crab; clearTargets(); } };
}

test('both trial shellbacks open and shut the near pincer\'s jaw in the snap (the Tripo inner finger its own bone)', () => {
  for (const [v, build] of Object.entries(BUILD)) {
    const { foes, f, done } = fight(build);
    for (let i = 0; i < 30; i++) foes.look(f, 1 / 30);
    const tip = f.model.tell('snap'); let finger = null;
    f.model.group.traverse((o) => { if (o.name === 'finger' && o.getWorldPosition(new THREE.Vector3()).x > 0) finger = o; });
    assert.ok(finger, `${v}: the near pincer's finger`);
    // (the jaw: the blade's tip to the inner finger's foot)
    const foot = new THREE.Object3D(); finger.add(foot);
    if (v === 'tripo') { const c = SRC.landmarks.claws[1]; foot.position.set(c.finger[0] - c.knuckle[0], c.finger[1] - c.knuckle[1], c.finger[2] - c.knuckle[2]); } else foot.position.set(0, -0.44, 0);
    const gap = () => { f.model.group.updateMatrixWorld(true); return tip.getWorldPosition(new THREE.Vector3()).distanceTo(foot.getWorldPosition(new THREE.Vector3())); };
    const rest = gap();
    f.atk = f.def.attacks.find((a) => a.id === 'snap'); f.state = 'wind'; f.k = 1; for (let i = 0; i < 3; i++) foes.look(f, 1 / 60);
    const open = gap();
    f.state = 'strike'; f.k = 0.35; for (let i = 0; i < 3; i++) foes.look(f, 1 / 60);
    const shut = gap();
    assert.ok(open > rest * 1.3, `${v}: opens at the top of the wind (${rest.toFixed(2)} → ${open.toFixed(2)} m)`);
    assert.ok(shut < rest + 0.02 && shut < open * 0.6, `${v}: slams shut in the chop (${shut.toFixed(2)} m)`);
    done();
  }
  // the Tripo finger carries the claw's own red vertices only
  const M = tripoShellbackModel(skinOf('crab', 'arzach2'), SRC); let sm = null; M.group.traverse((o) => { if (o.isSkinnedMesh) sm = o; });
  const J = sm.geometry.attributes.skinIndex, C = SRC.geometry.attributes.color, fi = sm.skeleton.bones.findIndex((b) => b.name === 'finger');
  let n = 0; for (const i of new Set(sm.geometry.index.array)) if (J.getX(i) === fi) { n++; assert.equal(hexAt(C, i), SRC.landmarks.palette.claw, 'a red vertex'); }
  assert.ok(n > 30, `the finger carries ${n} vertices`);
  M.dispose();
});

test('both trial shellbacks look at the traveller: the face turns his way, the Tripo eyes slide on (#800, the author\'s)', () => {
  for (const [v, build] of Object.entries(BUILD)) {
    const at = {};
    for (const side of [1, -1]) {
      const { foes, f, player, done } = fight(build);
      player.pos.set(side * 3.4, 0, 2.2);
      for (let i = 0; i < 90; i++) { f.dist = player.pos.distanceTo(f.pos); foes.look(f, 1 / 60); f.model.group.updateMatrixWorld(true); }
      assert.ok(f.gaze.watching, `${v}: it has noticed him`);
      const box = new THREE.Box3().setFromObject(f.model.tell('burrow'));   // (its eyes)
      at[side] = { eyes: box.getCenter(new THREE.Vector3()).x, yaw: f.model.gaze[0].yaw };
      done();
    }
    assert.ok(at[1].yaw > 0.2 && at[-1].yaw < -0.2, `${v}: the face turns his way (${at[1].yaw.toFixed(2)}, ${at[-1].yaw.toFixed(2)})`);
    assert.ok(at[1].eyes - at[-1].eyes > (v === 'tripo' ? 0.08 : 0.05), `${v}: the eyes go his way (${(at[1].eyes - at[-1].eyes).toFixed(3)} m)`);
  }
});
