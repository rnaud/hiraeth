// The wood cutter (issue #800): its own enemy beside the furnace brute, the author's pick of the trials' bodies (Tripo,
// src/enemies/plans/woodcutter-tripo.js on public/enemies/woodcutter/, loaded by src/enemies/foe-assets.js; the direct one,
// src/enemies/plans/woodcutter.js, stands in while it loads). Both keep the brute's model contract at the author's
// 2.2–2.6 m, the brute's attacks with their windows and its reach scaled, the tool on the ground where the slam lands,
// its gaze, plates, weak point and pieces. Registered, skinned, placed; the brute untouched.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { readFileSync } from 'node:fs';
import { Foes, FOES, ARENA_KINDS } from '../src/foes.js';
import { GameState } from '../src/game-state.js';
import { clearTargets } from '../src/targets.js';
import { SKINS, skinOf, skinFor } from '../src/enemies/skins.js';
import { ARCHETYPES, BUILT } from '../src/enemies/archetypes.js';
import { TRIAL_BUILDERS, archetypeModel } from '../src/enemies/plans/index.js';
import { woodcutterModel, woodcutterDef, WOODCUTTER, WOODCUTTER_ID } from '../src/enemies/plans/woodcutter.js';
import { lowestIn } from '../src/enemies/plans/kit.js';
import { tripoWoodcutterModel, partsOf, PARTS, BONES, BLEND } from '../src/enemies/plans/woodcutter-tripo.js';
import { foeSource, glbGeometry, assetsOfKinds, FOE_ASSETS } from '../src/enemies/foe-assets.js';
import { WORLDS, PLACED, worldArchetypes, packOf } from '../src/foe-worlds.js';
import { sitesOf } from '../src/encounters/sites.js';
import { FIGHT, ARMOUR, TIERS } from '../src/enemies/fight.js';
import { FOE_VOICES } from '../src/foe-voices.js';
import { blowLayers } from '../src/foe-sounds.js';

const SRC = foeSource('woodcutter');
const BUILD = { direct: woodcutterModel, tripo: (skin) => tripoWoodcutterModel(skin, SRC) };
const drawn = (g) => { let n = 0; g.traverseVisible((o) => { if (o.isMesh) n++; }); return n; };
const world = () => new Foes({ level: { foes: { own: true } }, levelId: 'arena', scene: null, player: { pos: new THREE.Vector3(0, 0, 40), heading: Math.PI }, physics: { groundAt: () => 0 }, game: new GameState(null), rng: () => 0.01 });

test('the game builds its own brute, untouched: no trial body stands in, no trial def (#800)', () => {
  assert.deepEqual(Object.keys(TRIAL_BUILDERS), []);
  const M = archetypeModel('brute', 'perdide2');
  assert.equal(M.trial, undefined); assert.equal(M.trialDef, undefined); assert.notEqual(M.archetype, WOODCUTTER_ID);
  assert.equal(ARCHETYPES.brute.def.radius, 1.15); assert.equal(ARCHETYPES.brute.def.attacks[0].radius, 2.1);
  M.dispose();
});

test('its own enemy, `woodcutter`: registered with its def, skins, fight, armour, tier, voice and drop', () => {
  const A = ARCHETYPES.woodcutter;
  assert.equal(WOODCUTTER_ID, 'woodcutter');
  assert.ok(BUILT.includes('woodcutter')); assert.equal(A.kind, 'woodcutter'); assert.equal(FOES.woodcutter, A.def);
  assert.equal(A.name, 'wood cutter'); assert.equal(A.plan, 'woodcutter', 'its own plan (its own steps), on the brute\'s rig family'); assert.equal(A.sound, 'iron');
  assert.deepEqual(Object.keys(SKINS.woodcutter), ['perdide2', 'edena', 'moonfoundry'], 'Lorn II its home');
  const names = new Set(Object.values(SKINS.brute).map((s) => s.name));
  for (const s of Object.values(SKINS.woodcutter)) assert.ok(!names.has(s.name), `${s.name}: no brute's name`);
  for (const t of [FIGHT, ARMOUR, TIERS, FOE_VOICES]) assert.ok(t.woodcutter);
  // its def is the brute's with woodcutterDef's reach: the same as laying woodcutterDef over the brute's
  const D = woodcutterDef(ARCHETYPES.brute.def);
  for (const k of ['radius', 'height', 'hp', 'speed', 'stout', 'heavy', 'breaks']) assert.deepEqual(A.def[k], D[k], k);
  assert.equal(A.def.guard.near, D.guard.near);
  for (const a of D.attacks) { const b = A.def.attacks.find((x) => x.id === a.id); for (const k of ['radius', 'ahead', 'max', 'range', 'wind', 'strike', 'contact', 'damage', 'knock', 'min', 'track']) assert.deepEqual(b[k], a[k], `${a.id}.${k}`); }
  assert.deepEqual(woodcutterDef(A.def).attacks.map((x) => x.radius ?? x.range), A.def.attacks.map((x) => x.radius ?? x.range), 'woodcutterDef idempotent (the direct body\'s trialDef)');
});

test('its def: the brute\'s windows kept, the reach scaled to the body', () => {
  const B = ARCHETYPES.brute.def, D = ARCHETYPES.woodcutter.def;
  for (const a of B.attacks) {
    const d = D.attacks.find((x) => x.id === a.id);
    for (const k of ['wind', 'strike', 'contact', 'damage', 'track', 'min', 'onParry', 'dodge']) assert.deepEqual(d[k], a[k], `${a.id}.${k}`);
    if (a.wave) assert.deepEqual(d.wave, a.wave, 'the quake is the brute\'s');
    for (const k of ['radius', 'range', 'max', 'ahead']) if (a[k] != null && a.id !== 'hurl') assert.ok(d[k] < a[k], `${a.id}.${k} nearer`);
  }
  for (const k of ['hp', 'stout', 'heavy', 'breaks', 'speed', 'recover', 'cool', 'sound', 'calm']) assert.deepEqual(D[k], B[k], k);
  assert.equal(D.guard.hold, B.guard.hold); assert.equal(D.guard.blocks, B.guard.blocks);
  assert.ok(D.radius < B.radius && D.height < B.height);
});

test('where it is met (#800): Viridel\'s and the Moon Foundry\'s packs and beats, Lorn II\'s sawyer placed; no early world fields it; the Arena runs it', () => {
  const where = Object.keys(WORLDS).filter((w) => worldArchetypes(w).includes('woodcutter'));
  assert.deepEqual(where.sort(), ['edena', 'moonfoundry', 'perdide2']);
  assert.ok(WORLDS.edena.stage >= 2 && WORLDS.moonfoundry.stage >= 2, 'in the packs only from stage 2, where the brute is');
  assert.ok(!WORLDS.perdide2.roster.woodcutter, 'Lorn II: placed, never in a pack');
  assert.ok(PLACED.perdide2.some((p) => p.archetype === 'woodcutter'));
  for (const w of ['edena', 'moonfoundry']) assert.ok(sitesOf(w).some((s) => s.foes.includes('woodcutter')), `${w}: a site`);
  assert.equal(skinFor('woodcutter', 'edena'), 'edena'); assert.equal(skinFor('woodcutter', 'moonfoundry'), 'moonfoundry'); assert.equal(skinFor('woodcutter', 'perdide2'), 'perdide2');
  const e = ARENA_KINDS.find((x) => x.kind === 'woodcutter');
  assert.ok(e && ['perdide2', 'edena', 'moonfoundry'].every((s) => e.skins.includes(s)), 'the Arena\'s run: its skins on the route');
  // a heavy lead: two places, never the first pack
  let seen = 0; for (let i = 0; i < 400; i++) { const p = packOf(1 + (i % 6), 'edena', Math.random); if (p.includes('woodcutter')) { seen++; assert.ok(p.length <= 4); } }
  assert.ok(seen > 0, 'Viridel\'s packs bring it');
});

test('its source: the game\'s asset (no texture: vertex colours), read once, asked for by the kinds that need it', () => {
  assert.equal(foeSource('woodcutter'), SRC, 'once');
  assert.ok(SRC.geometry.attributes.color && SRC.rig.parts && SRC.triangles > 10000);
  assert.deepEqual(assetsOfKinds(['woodcutter@edena', 'brute', 'woodcutter*', 'crab']), ['woodcutter']);
  assert.deepEqual(Object.keys(FOE_ASSETS).includes('woodcutter'), true);
  const g = glbGeometry(readFileSync(new URL('../public/enemies/woodcutter/body.glb', import.meta.url)));
  assert.equal(g.geometry.attributes.position.count, SRC.geometry.attributes.position.count);
  const M = archetypeModel('woodcutter', 'edena');
  assert.match(M.group.name, /Tripo/, 'the game builds the Tripo body');
  let maps = 0; M.group.traverse((o) => { if (o.isMesh) for (const m of [].concat(o.material)) if (m.uniforms?.uMap?.value || m.map) maps++; });
  assert.equal(maps, 0, 'no texture');
  M.dispose();
});

test('both wood cutter bodies build in every one of its skins, keep the model contract, and are few draws', () => {
  for (const [v, build] of Object.entries(BUILD)) for (const id of Object.keys(SKINS.woodcutter)) {
    const M = build(skinOf('woodcutter', id));
    for (const k of ['group', 'body', 'rig', 'parts', 'eyeMat', 'size', 'tones', 'tell', 'anim', 'dispose', 'weak', 'gaze']) assert.ok(M[k] !== undefined, `${v}@${id}: ${k}`);
    assert.equal(M.archetype, WOODCUTTER_ID);
    assert.equal(M.rig.legs.length, 2, `${v}: two legs on the kit`);
    assert.equal(M.rig.plan.gait.gait, 'alternate'); assert.equal(M.rig.plan.knee.pole, 'forward');
    assert.equal(M.plates.length, 3, `${v}: two pauldrons and a breastplate (#722)`);
    for (const a of ARCHETYPES.brute.def.attacks) assert.ok(M.tell(a.id)?.isObject3D, `${v}: a tell for ${a.id}`);
    assert.ok(drawn(M.group) <= 15, `${v}@${id}: ${drawn(M.group)} meshes`);
    M.dispose();
  }
});

test('in the fight, both bodies: 2.2–2.6 m, over the traveller; the slam\'s tools meet the ground at its ring; it looks at you; it comes apart', () => {
  clearTargets();
  for (const [v, build] of Object.entries(BUILD)) {
    TRIAL_BUILDERS.woodcutter = build;
    const foes = world();
    const f = foes.add('woodcutter@perdide2', new THREE.Vector3(), { tier: 0 }); f.heading = 0; f.provoked = true;
    assert.equal(f.def.radius, WOODCUTTER.radius, `${v}: its own def`);
    for (let i = 0; i < 45; i++) foes.look(f, 1 / 30);
    const top = new THREE.Box3().setFromObject(f.model.group).max.y;
    assert.ok(top >= 2.2 && top <= 2.6, `${v}: ${top.toFixed(2)} m`);
    const arms = f.model.wcJoints.arms, low = (a) => lowestIn(f.model.group, a.fist, a.reach);
    for (const a of arms) assert.ok(low(a) > 0.02, `${v}: its hands clear the ground at rest`);
    // the slam: up over its head, then down; from its contact on, the saw's edge and the clamp on the ground
    const slam = f.def.attacks.find((a) => a.id === 'slam');
    f.atk = slam; f.state = 'wind';
    for (let i = 0; i <= 30; i++) { f.k = i / 30; foes.look(f, slam.wind / 30); }
    f.model.group.updateMatrixWorld(true);
    assert.ok(arms[0].fist.getWorldPosition(new THREE.Vector3()).y > WOODCUTTER.height, `${v}: the saw raised over its head`);
    f.state = 'strike';
    for (let i = 0; i <= 20; i++) { f.k = i / 20; foes.look(f, slam.strike / 20); }
    f.model.group.updateMatrixWorld(true);
    for (const [k, a] of arms.entries()) {
      assert.ok(Math.abs(low(a)) < 0.03, `${v}: arm ${k} on the ground (${low(a).toFixed(3)})`);
      // (where it bites: inside the slam's ring, ahead)
      let best = null; for (const p of a.reach) { const w = p.clone().applyMatrix4(a.fist.matrixWorld); if (!best || w.y < best.y) best = w; }
      assert.ok(Math.hypot(best.x, best.z - slam.ahead) < slam.radius, `${v}: arm ${k} bites at ${best.z.toFixed(2)} m ahead, the ring at ${slam.ahead}`);
    }
    // (the slam's weight sounds as the game's body's tools meet the ground, #800: foe-sounds.js blowLayers, attack.land)
    if (v === 'tripo') {
      f.atk = slam; f.state = 'wind'; for (let i = 0; i <= 40; i++) { f.k = i / 40; foes.look(f, slam.wind / 40); }
      f.state = 'strike'; let t = null;
      for (let i = 0; i <= 64 && t === null; i++) { f.k = i / 64; foes.look(f, slam.strike / 64); f.model.group.updateMatrixWorld(true); if (Math.min(...arms.map(low)) < 0.03) t = f.k * slam.strike; }
      const at = blowLayers('slam', slam).find((L) => L.at > 0).at;
      assert.ok(t !== null && Math.abs(at - t) < 0.03, `${v}: the slam sounds at ${at.toFixed(3)} s, its tools on the ground at ${t?.toFixed(3)} s`);
    }
    f.atk = null; f.state = 'idle'; f.k = 0;
    // the gaze: the traveller off to its right, its head turns to him
    foes.player.pos.set(-5, 0, 4);
    const head = f.model.wcJoints.head, fwd0 = new THREE.Vector3(0, 0, 1).applyQuaternion(head.children[0].getWorldQuaternion(new THREE.Quaternion()));
    for (let i = 0; i < 60; i++) { f.dist = 6; foes.look(f, 1 / 30); }
    const fwd1 = new THREE.Vector3(0, 0, 1).applyQuaternion(head.children[0].getWorldQuaternion(new THREE.Quaternion()));
    assert.ok(fwd1.x < fwd0.x - 0.15, `${v}: its head turns toward him (${fwd0.x.toFixed(2)} → ${fwd1.x.toFixed(2)})`);
    foes.hurt(f, 'blade', new THREE.Vector3(-1, 0, 0), { damage: 99, source: 'charge', breaks: true });
    for (let i = 0; i < 40; i++) foes.update(1 / 30);
    assert.ok(f.dying, `${v}: down`);
    if (v === 'tripo') { let sm = null; f.model.group.traverse((o) => { if (o.isSkinnedMesh) sm = o; }); if (!sm) foes.group?.traverse((o) => { if (o.isSkinnedMesh && o.name === 'tripo skin') sm = o; });
      const w = sm.geometry.attributes.skinWeight; let soft = 0; for (let i = 0; i < w.count; i++) if (w.getX(i) < 1) soft++; assert.equal(soft, 0, 'tripo: rigid as it comes apart (no stretched cuts)'); }
    foes.dispose();
    delete TRIAL_BUILDERS.woodcutter;
  }
  clearTargets();
});

test('the Tripo machine rig: 10–15k triangles, every vertex on one joint (two only across a limb\'s cut), an exact bind, a joint moves only its parts', () => {
  assert.ok(SRC.triangles >= 10000 && SRC.triangles <= 15000, `${SRC.triangles} triangles`);
  const M = tripoWoodcutterModel(skinOf('woodcutter', 'perdide2'), SRC);
  let sm = null; M.group.traverse((o) => { if (o.isSkinnedMesh) sm = o; });
  const W = sm.geometry.attributes.skinWeight, J = sm.geometry.attributes.skinIndex, P = sm.geometry.attributes.position, n = P.count, per = new Map();
  // (rigid but for a band BLEND either side of each limb's cut, where a vertex is shared by the two bones: the joint
  //  bends closed. Its two weights sum to 1 and it lies within BLEND of a cut)
  let blended = 0;
  for (let i = 0; i < n; i++) {
    assert.ok(Math.abs(W.getX(i) + W.getY(i) - 1) < 1e-6 && W.getZ(i) === 0, 'one joint a vertex, or two');
    if (W.getX(i) < 1) { blended++; const near = Object.values(SRC.rig.cuts).some((c) => Math.abs((P.getX(i) - c.at[0]) * c.n[0] + (P.getY(i) - c.at[1]) * c.n[1] + (P.getZ(i) - c.at[2]) * c.n[2]) < BLEND + 1e-4); assert.ok(near, 'blended only at a cut'); }
    per.set(J.getX(i), (per.get(J.getX(i)) ?? 0) + 1);
  }
  assert.ok(blended > 200 && blended < n * 0.3, `${blended} vertices blended across the cuts`);
  assert.equal(per.size, sm.skeleton.bones.length, 'every joint carries a part');
  for (const [b, c] of per) assert.ok(c > 30, `${sm.skeleton.bones[b].name}: ${c} vertices`);
  M.group.updateMatrixWorld(true); sm.skeleton.update();
  const v = new THREE.Vector3(), rest = new THREE.Vector3(), skinned = (i) => sm.applyBoneTransform(i, v.fromBufferAttribute(P, i)).applyMatrix4(sm.matrixWorld);
  let worst = 0; for (let i = 0; i < n; i++) { rest.fromBufferAttribute(P, i).applyMatrix4(sm.matrixWorld); worst = Math.max(worst, skinned(i).distanceTo(rest)); }
  assert.ok(worst < 1e-4, `bind round trip ${worst}`);
  // the clamp arm's elbow bent alone: only its forearm and hand move
  const el = M.wcJoints.arms[1].el, ids = new Set([sm.skeleton.bones.indexOf(el), sm.skeleton.bones.indexOf(M.wcJoints.arms[1].fist)]);
  const before = Array.from({ length: n }, (_, i) => skinned(i).clone());
  el.rotateX(-0.8); M.group.updateMatrixWorld(true); sm.skeleton.update();
  let moved = 0, wrong = 0;
  for (let i = 0; i < n; i++) { if (skinned(i).distanceTo(before[i]) > 1e-3) { moved++; if (!ids.has(J.getX(i)) && !(ids.has(J.getY(i)) && W.getY(i) > 0)) wrong++; } }
  assert.ok(moved > 100, `the elbow moved ${moved}`); assert.equal(wrong, 0, 'nothing else moved');
  // a bent elbow opens no gap: the corners the upper arm and the forearm both have at its cut stay together
  {
    const arm = new Set(['upper1', 'fore1'].map((x) => BONES.indexOf(x))), key = (i) => `${P.getX(i).toFixed(4)},${P.getY(i).toFixed(4)},${P.getZ(i).toFixed(4)}`, groups = new Map();
    for (let i = 0; i < n; i++) { if (!arm.has(J.getX(i))) continue; const k = key(i); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(i); }
    let gap = 0, shared = 0;
    for (const g of groups.values()) { if (new Set(g.map((i) => J.getX(i))).size < 2) continue; shared++; const a = skinned(g[0]).clone(); for (const i of g) gap = Math.max(gap, skinned(i).distanceTo(a)); }
    assert.ok(shared > 10, `${shared} corners shared across the elbow's cut`);
    assert.ok(gap < 1e-4, `the elbow bent: the widest seam ${gap.toFixed(4)} m`);
  }
  // the parts by name: the head its own (the gaze turns it), the pauldrons, the boots; Tripo's saw hand dropped, the
  // disc the model's own on its own joint (it spins), with the clamp and bracket on the fist
  const prep = partsOf(SRC), count = (name) => prep.tri.filter((t) => t === PARTS.indexOf(name)).length;
  for (const name of ['head', 'pauldron0', 'pauldron1', 'foot0', 'foot1', 'hand1']) assert.ok(count(name) > 50, `${name}: ${count(name)} triangles`);
  assert.equal(count('hand0') + count('saw'), 0, 'no Tripo saw hand');
  for (const name of ['fist0', 'saw']) assert.ok(per.get(BONES.indexOf(name)) > 60, `${name}: the model's own tool (${per.get(BONES.indexOf(name))} vertices)`);
  M.dispose();
});
