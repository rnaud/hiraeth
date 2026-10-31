// The dune mummer (issue #800): its own enemy `dunemummer` beside today's mummer, the author's pick of the trials' bodies
// (Tripo, src/enemies/plans/dune-mummer-tripo.js on public/enemies/dunemummer/, loaded by src/enemies/foe-assets.js; the
// direct one, src/enemies/plans/dune-mummer.js, stands in while it loads). Both keep the mummer's model contract, its rig
// (the humanoid clip rig, #724), weapons, mask, look and ragdoll; the Tripo skin is Tripo's own weights on the rig's
// joints, posed directly; its fixes: the body one flat sage, every part the reference's flat colour, broad mittens that
// keep the club through every clip, the slits filling Tripo's recesses (pure black since it landed), the mask broadened.
import { readFileSync } from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Foes, FOES, ARENA_KINDS } from '../src/foes.js';
import { GameState } from '../src/game-state.js';
import { clearTargets } from '../src/targets.js';
import { SKINS, skinOf, skinFor } from '../src/enemies/skins.js';
import { ARCHETYPES, BUILT } from '../src/enemies/archetypes.js';
import { TRIAL_BUILDERS, archetypeModel } from '../src/enemies/plans/index.js';
import { duneMummerModel, gourdGeometry } from '../src/enemies/plans/dune-mummer.js';
import { tripoMummerModel, MASK_WIDEN } from '../src/enemies/plans/dune-mummer-tripo.js';
import { foeSource, glbGeometry } from '../src/enemies/foe-assets.js';
import { WORLDS, worldArchetypes, GROUP } from '../src/foe-worlds.js';
import { sitesOf } from '../src/encounters/sites.js';
import { FIGHT, TIERS } from '../src/enemies/fight.js';
import { FOE_VOICES } from '../src/foe-voices.js';
import { FOE_CALLS, FOE_MOVES } from '../src/foe-sounds.js';

const SRC = foeSource('dunemummer');
const BUILD = { direct: duneMummerModel, tripo: (skin) => tripoMummerModel(skin, SRC) };
const drawn = (g) => { let n = 0; g.traverseVisible((o) => { if (o.isMesh) n++; }); return n; };
const skinnedOf = (M, name) => { let sm = null; M.group.traverse((o) => { if (o.isSkinnedMesh && o.name === name) sm = o; }); return sm; };

test('the game builds its own mummer, untouched, and the dune mummer on the Tripo body (#800)', () => {
  assert.equal(TRIAL_BUILDERS.dunemummer, undefined); assert.equal(TRIAL_BUILDERS.dunemummer, undefined);
  const M = archetypeModel('mummer', 'desert');
  assert.equal(M.trial, undefined, 'the mummer of plans/mummer.js'); assert.notEqual(M.archetype, 'dunemummer');
  M.dispose();
  const D = archetypeModel('dunemummer', 'desert');
  assert.match(D.group.name, /Tripo/); assert.equal(D.archetype, 'dunemummer');
  let maps = 0; D.group.traverse((o) => { if (o.isMesh) for (const m of [].concat(o.material)) if (m.uniforms?.uMap?.value || m.map) maps++; });
  assert.equal(maps, 0, 'no texture: its vertex colours');
  D.dispose();
});

test('both dune mummer bodies build in every one of its skins, keep the model contract and the rig, in 3 meshes', () => {
  for (const [v, build] of Object.entries(BUILD)) for (const id of Object.keys(SKINS.dunemummer)) {
    const M = build(skinOf('dunemummer', id));
    for (const k of ['group', 'body', 'parts', 'eyeMat', 'size', 'tones', 'tell', 'anim', 'dispose', 'driver', 'joints', 'wield', 'gaze']) assert.ok(M[k] !== undefined, `${v}@${id}: ${k}`);
    for (const a of ARCHETYPES.dunemummer.def.attacks) assert.ok(M.tell(a.id)?.isObject3D, `${v}: a tell for ${a.id}`);
    assert.equal(drawn(M.group), 3, `${v}@${id}: the body, the rigid parts, the eyes`);
    M.dispose();
  }
});

test('the gourd faces outward (its normals point away from its axis)', () => {
  const g = gourdGeometry(), P = g.attributes.position, N = g.attributes.normal;
  let out = 0, n = 0;
  for (let i = 0; i < P.count; i++) { if (P.getY(i) < 0.35 || P.getY(i) > 1.1) continue; n++; if (P.getX(i) * N.getX(i) + P.getZ(i) * N.getZ(i) > 0) out++; }
  assert.ok(out / n > 0.99, `${out}/${n}`);
});

function arena() {
  clearTargets();
  return new Foes({ level: { foes: { own: true } }, levelId: 'arena', scene: null, player: { pos: new THREE.Vector3(6, 0, 4), heading: Math.PI }, physics: { groundAt: () => 0 }, game: new GameState(null), rng: () => 0.01 });
}

test('in the fight: 1.8 m (#741), the head looks at the traveller, the mask flies off, it slumps where it stands', () => {
  for (const [v, build] of Object.entries(BUILD)) {
    TRIAL_BUILDERS.dunemummer = build;
    const foes = arena();
    const f = foes.add('dunemummer@desert', new THREE.Vector3(), { tier: 0 }); f.heading = 0; f.provoked = true;
    for (let i = 0; i < 45; i++) { f.dist = 7; foes.look(f, 1 / 30); }
    const M = f.model, body = skinnedOf(M, v === 'tripo' ? 'tripo body' : 'gourd');
    const top = body.boundingBox.clone().applyMatrix4(body.matrixWorld).max.y;
    assert.ok(top > 1.7 && top < 1.95, `${v}: the gourd's top at ${top.toFixed(2)} m`);
    // the look: the traveller off to its left (+x): the head turned toward him, the mask's eyes with it
    const look = M.gaze[0].node, fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(look.getWorldQuaternion(new THREE.Quaternion()));
    assert.ok(fwd.x > 0.3, `${v}: the head turns to the traveller (${fwd.x.toFixed(2)})`);
    const eyes = M.group.getObjectByName('eyes').getWorldPosition(new THREE.Vector3()), head = look.getWorldPosition(new THREE.Vector3());
    assert.ok(eyes.x - head.x > 0.03, `${v}: the eyes went round with it`);
    // the mask knocked off: gone from its face, flying; the club dropped
    f.weapon = 'club'; foes.unmask(f);
    for (let i = 0; i < 10; i++) foes.look(f, 1 / 30);
    assert.ok(M.group.getObjectByName('mask').scale.x < 0.01, `${v}: the mask is off`);
    assert.ok(M.group.getObjectByName('dropped mask').scale.x > 0.5, `${v}: the mask flies`);
    foes.hurt(f, 'blade', new THREE.Vector3(-1, 0, 0), { damage: 99, source: 'charge', breaks: true });
    for (let i = 0; i < 20; i++) foes.update(1 / 30);
    assert.ok(f.dying && !f.dying.rag, `${v}: its gourd slumps where it stands (no ragdoll: src/enemies/defeat.js DEFEATS.dunemummer)`);
    foes.dispose();
    delete TRIAL_BUILDERS.dunemummer;
  }
  clearTargets();
});

test('weapons per spawn: club, spear and bow each held in its own fist', () => {
  for (const [v, build] of Object.entries(BUILD)) {
    TRIAL_BUILDERS.dunemummer = build;
    const foes = arena();
    for (const w of ['club', 'spear', 'bow']) {
      const f = foes.add('dunemummer@desert', new THREE.Vector3(), { tier: 0 }); f.weapon = w; f.provoked = true;
      for (let i = 0; i < 10; i++) foes.look(f, 1 / 30);
      for (const k of ['club', 'spear', 'bow']) assert.equal(f.model.group.getObjectByName(k).scale.x > 0.5, k === w, `${v}: ${w} shown, ${k}`);
      const hand = f.model.joints.hands[w === 'bow' ? 1 : 0].getWorldPosition(new THREE.Vector3()), at = f.model.group.getObjectByName(w).getWorldPosition(new THREE.Vector3());
      assert.ok(hand.distanceTo(at) < 0.25, `${v}: the ${w} in the hand (${hand.distanceTo(at).toFixed(2)} m)`);
      foes.remove(f);
    }
    foes.dispose();
    delete TRIAL_BUILDERS.dunemummer;
  }
  clearTargets();
});

test('the Tripo skin: 10–15k triangles, normalised weights on the rig\'s joints, a knee bent moves only its leg', () => {
  const tris = SRC.geometry.index.count / 3;
  assert.ok(tris >= 10000 && tris <= 15000, `${tris} triangles`);
  assert.equal(SRC.rig.joints.length, 23, 'Tripo\'s biped rig');
  const M = tripoMummerModel(skinOf('dunemummer', 'desert'), SRC), sm = skinnedOf(M, 'tripo body');
  assert.ok(M.joints.torso && sm.skeleton.bones.includes(M.gaze[0].node), 'the head bone is the look');
  const W = sm.geometry.attributes.skinWeight, I = sm.geometry.attributes.skinIndex, P = sm.geometry.attributes.position, used = new Set(sm.geometry.index.array);
  for (const i of used) { const s = W.getX(i) + W.getY(i) + W.getZ(i) + W.getW(i); assert.ok(Math.abs(s - 1) < 1e-5, `vertex ${i}: weights ${s}`); }
  M.group.updateMatrixWorld(true); sm.skeleton.update();
  const v = new THREE.Vector3(), skinned = (i) => sm.applyBoneTransform(i, v.fromBufferAttribute(P, i)).applyMatrix4(sm.matrixWorld).clone();
  // at the rig's rest the arms hang: the mittens well under the shoulders
  const hand = sm.skeleton.bones.indexOf(M.joints.hands[1]);
  let low = 0, n = 0; for (const i of used) if (I.getX(i) === hand && W.getX(i) > 0.9) { n++; if (skinned(i).y < 0.45) low++; }
  assert.ok(n > 50 && low / n > 0.9, `the left mitten hangs (${low}/${n})`);
  // the right knee bent alone: the right shin's and boot's vertices move, nothing on the left or over the hips (Tripo's
  // crotch blend carries a few vertices just left of the middle by under 5 mm)
  const before = [...used].map((i) => skinned(i));
  M.joints.knees[0].rotateX(-0.8); M.group.updateMatrixWorld(true); sm.skeleton.update();
  let moved = 0; const wrong = [];
  [...used].forEach((i, k) => { const d = skinned(i).distanceTo(before[k]); if (d > 1e-3) { moved++; if ((before[k].x > 0.02 && d > 0.005) || before[k].x > 0.08 || before[k].y > 0.45) wrong.push([...before[k].toArray().map((x) => +x.toFixed(3)), +d.toFixed(4)]); } });
  assert.ok(moved > 100, `the knee moved ${moved} vertices`);
  assert.deepEqual(wrong, [], 'nothing on the left (past the crotch\'s few mm of blend) or above the hips moved');
  M.dispose();
});

// ---------------------------------------------------------------- the Tripo mummer's fixes (the author's pick, 2026-10-30)

const hexOf = (c, v) => '#' + [c.getX(v), c.getY(v), c.getZ(v)].map((x) => Math.round(x * 255).toString(16).padStart(2, '0')).join('');

test('the Tripo body is painted flat by part: the reference\'s eight colours, no olive shade left', () => {
  const pal = SRC.rig.palette, want = new Set(Object.values(pal)), col = SRC.geometry.attributes.color, used = new Set(SRC.geometry.index.array);
  const seen = new Map(); for (const v of used) { const h = hexOf(col, v); seen.set(h, (seen.get(h) ?? 0) + 1); }
  assert.deepEqual([...seen.keys()].filter((h) => !want.has(h)), [], 'COLOR_0 holds only the palette');
  // the body one sage: no colour on it but the palette's (the k-means' olive #5b6855 and brown #6d4324 folded in)
  for (const h of ['#5b6855', '#6d4324', '#728c77', '#948e6d', '#bd8552']) assert.ok(!seen.has(h), `${h} gone`);
  // every part there, the body the most of it
  for (const [k, h] of Object.entries(pal)) assert.ok((seen.get(h) ?? 0) > (k === 'ink' ? 5 : 30), `${k} ${h}: ${seen.get(h) ?? 0} vertices`);
  assert.ok(seen.get(pal.body) > seen.get(pal.glove), 'the sage the most');
  // the chest patch salmon (y 0.6–0.8 m at the front, size 1) and the toe caps sand, no longer one colour
  const P = SRC.geometry.attributes.position; let patch = 0, toe = 0;
  for (const v of used) { const h = hexOf(col, v); if (h === pal.patch && P.getY(v) > 0.55 && P.getZ(v) > 0.1) patch++; if (h === pal.toe && P.getY(v) < 0.12) toe++; }
  assert.ok(patch > 30 && toe > 30, `patch ${patch}, toe caps ${toe}`);
});

test('the Tripo mittens widened toward the approved broad ones', () => {
  for (const side of ['Left', 'Right']) {
    const h = SRC.rig.hands[side], size = [0, 1, 2].map((k) => h.max[k] - h.min[k]);
    assert.ok(size[1] > 0.14 && size[2] > 0.15, `${side}: ${size.map((x) => x.toFixed(3))} (Tripo's own 0.13 × 0.13)`);
    assert.ok(SRC.rig.widened[side] > 300, `${side}: ${SRC.rig.widened[side]} vertices moved`);
  }
});

test('the club stays in the Tripo mitten through every clip: idle, walk, run, each attack, hurt', () => {
  TRIAL_BUILDERS.dunemummer = BUILD.tripo;
  const foes = arena();
  const f = foes.add('dunemummer@desert', new THREE.Vector3(), { tier: 0 }); f.heading = 0; f.provoked = true; f.weapon = 'club';
  const M = f.model, sm = skinnedOf(M, 'tripo body'), hand = sm.skeleton.bones.indexOf(M.joints.hands[0]);
  const P = sm.geometry.attributes.position, SI = sm.geometry.attributes.skinIndex, SW = sm.geometry.attributes.skinWeight, mitten = [];
  for (let i = 0; i < P.count; i++) { let b = 0; for (let k = 1; k < 4; k++) if (SW.getComponent(i, k) > SW.getComponent(i, b)) b = k; if (SI.getComponent(i, b) === hand && SW.getComponent(i, b) > 0.5) mitten.push(i); }
  const v = new THREE.Vector3(), worst = { off: 0, at: '' };
  const check = (what) => {
    M.group.updateMatrixWorld(true); sm.skeleton.update();
    const pts = mitten.map((i) => sm.applyBoneTransform(i, v.fromBufferAttribute(P, i)).applyMatrix4(sm.matrixWorld).clone());
    const c = pts.reduce((s, p) => s.add(p), new THREE.Vector3()).divideScalar(pts.length);
    const club = M.group.getObjectByName('club'), o = club.getWorldPosition(new THREE.Vector3()), ax = new THREE.Vector3(0, 1, 0).applyQuaternion(club.getWorldQuaternion(new THREE.Quaternion()));
    const radial = (p) => { const d = p.clone().sub(o); return d.sub(ax.clone().multiplyScalar(d.dot(ax))).length(); };
    // the haft passes through the mitten: nearer its centre than most of its own surface is (the median radius)
    const r = pts.map((p) => p.distanceTo(c)).sort((a, b) => a - b)[pts.length >> 1], off = radial(c);
    assert.ok(club.scale.x > 0.5, `${what}: the club in hand`);
    if (off / r > worst.off) { worst.off = off / r; worst.at = `${what}: ${off.toFixed(3)} m off the centre, the mitten ${r.toFixed(3)} m`; }
  };
  const run = (secs, set, what) => { for (let t = 0; t < secs; t += 1 / 30) { set(t); foes.look(f, 1 / 30); if (Math.round(t * 30) % 3 === 0) check(`${what} ${t.toFixed(2)} s`); } };
  run(1.5, () => { f.state = 'idle'; f.atk = null; f.dist = 7; }, 'idle');
  for (const pace of [1, 3]) run(1.5, (t) => { f.state = 'chase'; f.atk = null; f.dist = 7; f.pos.z += pace / 30; }, pace > 2 ? 'run' : 'walk');
  for (const a of ARCHETYPES.dunemummer.def.attacks.filter((x) => x.weapon === 'club' || !x.weapon)) {
    const cyc = a.wind + (a.strike ?? 0.3) + (a.recover ?? 0.5);
    run(cyc, (t) => { f.atk = a; f.dist = 2; f.state = t < a.wind ? 'wind' : t < a.wind + (a.strike ?? 0.3) ? 'strike' : 'recover'; f.k = f.state === 'wind' ? t / a.wind : f.state === 'strike' ? (t - a.wind) / (a.strike ?? 0.3) : 0; }, a.id);
    f.atk = null; f.state = 'idle';
  }
  foes.hurt(f, 'blade', new THREE.Vector3(-1, 0, 0), { damage: 0.1, source: 'combo', combo: 0 });
  run(0.6, () => {}, 'hurt');
  assert.ok(worst.off < 0.35, `worst ${worst.at} (the haft through the middle: under 0.35 of its radius; 0.15 measured)`);
  foes.dispose(); delete TRIAL_BUILDERS.dunemummer; clearTargets();
});

test('the Tripo mask\'s slits fill the recesses Tripo cut for them, the mask whole round them', () => {
  const M = tripoMummerModel(skinOf('dunemummer', 'desert'), SRC);
  for (const e of M.tripo.slits) {
    assert.ok(e.n >= 10, `a slit's recess found (${e.n} vertices)`);
    assert.ok(e.surf - e.at[2] > 0.008, 'the plug runs from the recess\'s bottom out to the surface');
    assert.ok(e.w > 0.03 && e.w < 0.07 && e.h > 0.01 && e.h < 0.035, `${e.w} × ${e.h} m`);
  }
  assert.ok(M.tripo.slits[0].at[0] > 0.02 && M.tripo.slits[1].at[0] < -0.02, 'one each side');
  M.dispose();
});

test('its own enemy, `dunemummer`: the mummer\'s kit copied, its own name, skins, plan, sound and voice; the mummer untouched', () => {
  const A = ARCHETYPES.dunemummer, B = ARCHETYPES.mummer;
  assert.ok(BUILT.includes('dunemummer')); assert.equal(A.kind, 'dunemummer'); assert.equal(FOES.dunemummer, A.def);
  assert.equal(B.def.name, 'mummer'); assert.equal(B.sound, 'junk'); assert.equal(B.plan, 'mummer');
  assert.notEqual(A.def, B.def); assert.notEqual(A.def.attacks, B.def.attacks);
  assert.deepEqual(A.def.attacks.map((a) => a.id), B.def.attacks.map((a) => a.id));
  for (const a of B.def.attacks) { const d = A.def.attacks.find((x) => x.id === a.id); for (const k of ['wind', 'strike', 'contact', 'damage', 'range', 'weapon', 'onParry']) assert.deepEqual(d[k], a[k], `${a.id}.${k}`); }
  for (const k of ['hp', 'radius', 'height', 'speed', 'weapons', 'mask', 'disarm', 'calm']) assert.deepEqual(A.def[k], B.def[k], k);
  assert.equal(A.scale, B.scale, 'grown as the mummer (#741)');
  assert.deepEqual(Object.keys(SKINS.dunemummer), ['desert', 'glassdunes']);
  const names = new Set(Object.values(SKINS.mummer).map((x) => x.name));
  for (const x of Object.values(SKINS.dunemummer)) assert.ok(!names.has(x.name), `${x.name}: not a mummer's skin name`);
  assert.equal(A.sound, 'gourd'); assert.ok(FOE_CALLS.gourd && FOE_MOVES.dunemummer && FOE_VOICES.dunemummer && FIGHT.dunemummer && TIERS.dunemummer);
  assert.equal(GROUP.dunemummer, 2, 'a pair, as the mummers');
});

test('where it is met (#800): the Desert with the mummers (their hoard), the Glass Dunes (its packs and a lookout); the Arena', () => {
  const where = Object.keys(WORLDS).filter((w) => worldArchetypes(w).includes('dunemummer'));
  assert.deepEqual(where.sort(), ['desert', 'glassdunes']);
  assert.ok(sitesOf('desert').some((s) => s.foes.includes('dunemummer')), 'the Desert: a site');
  assert.ok(sitesOf('glassdunes').some((s) => s.lookout === 'dunemummer'), 'the Glass Dunes: a lookout');
  assert.equal(skinFor('dunemummer', 'glassdunes'), 'glassdunes');
  const e = ARENA_KINDS.find((x) => x.kind === 'dunemummer');
  assert.ok(e && e.skins.includes('desert') && e.skins.includes('glassdunes'));
});

test('the mask broadened out of the hood, its slits pure black', () => {
  const M = tripoMummerModel(skinOf('dunemummer', 'desert'), SRC);
  assert.ok(MASK_WIDEN > 1.1 && MASK_WIDEN < 1.4);
  const w = M.tripo.mask[0];
  assert.ok(w > 0.21 && w < 0.32, `the mask ${w.toFixed(3)} m across (Tripo's ${(w / MASK_WIDEN).toFixed(3)})`);
  assert.equal(M.eyeMat.uniforms?.uColor?.value?.getHexString?.() ?? M.base, '000000');
  // (a second body of the same source: the same mask, not broadened twice)
  const M2 = tripoMummerModel(skinOf('dunemummer', 'desert'), SRC);
  assert.ok(Math.abs(M2.tripo.mask[0] - w) < 1e-3, 'the same mask');
  M.dispose(); M2.dispose();
  const g = glbGeometry(readFileSync(new URL('../public/enemies/dunemummer/body.glb', import.meta.url)));
  assert.ok(g.geometry.attributes.skinIndex && g.geometry.attributes.color, 'its weights and colours in the game\'s asset');
});
