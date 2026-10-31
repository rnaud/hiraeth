// The sentinel (issue #800, family G): its approved redesign, the cistern keeper, as its body (Tripo, src/enemies/plans/
// sentinel-tripo.js on public/enemies/sentinel/, loaded by src/enemies/foe-assets.js; the slim duelling droid,
// plans/sentinel.js legacySentinelModel, kept and standing in while the mesh loads). Tripo's biped rig posed directly by
// the clips (plans/tripo-biped.js), its fists carried whole on its hands. It keeps the sentinel's id, def, attacks and
// windows (thrust, cut, bash, dash, riposte), its shield guard and the turtle, the stings that snap its guard up, its
// Arena-only skin and its scorched tier, the ragdoll (tests/foe-ragdoll.test.js) and its look at the traveller.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Foes, FOES } from '../src/foes.js';
import { GameState } from '../src/game-state.js';
import { clearTargets } from '../src/targets.js';
import { SKINS, skinOf, DROID_TIER } from '../src/enemies/skins.js';
import { archetypeModel } from '../src/enemies/plans/index.js';
import { legacySentinelModel, SENTINEL_HOLD } from '../src/enemies/plans/sentinel.js';
import { tripoSentinelModel } from '../src/enemies/plans/sentinel-tripo.js';
import { foeSource, FOE_ASSETS } from '../src/enemies/foe-assets.js';

const SRC = foeSource('sentinel');
const seeded = (s = 7) => () => ((s = (s * 16807) % 2147483647) / 2147483647);
const arena = () => { clearTargets(); return new Foes({ level: { foes: { own: true } }, levelId: 'arena', scene: null, player: { pos: new THREE.Vector3(6, 0, 4), heading: Math.PI }, physics: { groundAt: () => 0 }, game: new GameState(null), rng: seeded() }); };
const body = (M) => { let s = null; M.group.traverse((o) => { if (o.isSkinnedMesh && o.name === 'tripo body') s = o; }); return s; };
const hexOf = (c, v) => '#' + [c.getX(v), c.getY(v), c.getZ(v)].map((x) => Math.round(x * 255).toString(16).padStart(2, '0')).join('');

test('the sentinel is the approved cistern keeper: its Tripo body by default, the slim droid kept as legacySentinelModel', () => {
  assert.ok(FOE_ASSETS.sentinel && SRC, 'its asset is read at once in node');
  const M = archetypeModel('sentinel', 'desert');
  assert.match(M.group.name, /sentinel \(Tripo\)/); assert.ok(M.tripo);
  M.dispose();
  const L = legacySentinelModel(skinOf('sentinel', 'desert'));
  assert.ok(L.group.getObjectByName('shield') && L.group.getObjectByName('grip'), 'the old droid still builds');
  L.dispose();
});

test('it keeps the sentinel\'s fight: its five attacks and their windows, the shield guard, the stings, the turtle; Arena-only', () => {
  const D = FOES.sentinel;
  assert.deepEqual(D.attacks.map((a) => a.id), ['thrust', 'cut', 'bash', 'dash', 'riposte']);
  const A = Object.fromEntries(D.attacks.map((a) => [a.id, a]));
  assert.deepEqual([A.thrust.wind, A.thrust.strike, A.cut.wind, A.cut.strike, A.bash.wind, A.dash.wind, A.dash.lunge, A.riposte.wind], [0.75, 0.18, 0.95, 0.24, 0.95, 0.75, 5.5, 0.5]);
  assert.deepEqual([D.guard.pose, D.guard.stings, D.guard.blocks, D.guard.counter, D.turtle.attack], ['shield', 2, 1, 'riposte', 'bash']);
  assert.deepEqual(Object.keys(SKINS.sentinel), ['desert']); assert.ok(SKINS.sentinel.desert.arena, 'Arena-only');
  assert.deepEqual(Object.keys(SENTINEL_HOLD), ['blade']);
});

test('its skin and its scorched tier build the contract in 3 draws, the tier in the droids\' scorched ceramic', () => {
  for (const tier of [0, 1]) {
    const M = tripoSentinelModel(skinOf('sentinel', 'desert', tier), SRC);
    for (const k of ['group', 'body', 'parts', 'eyeMat', 'tell', 'anim', 'dispose', 'driver', 'joints', 'wield', 'gaze']) assert.ok(M[k] !== undefined, `${tier}: ${k}`);
    for (const a of FOES.sentinel.attacks) assert.ok(M.tell(a.id)?.isObject3D, `a tell for ${a.id}`);
    assert.equal(M.tell('bash').name, 'shield', 'the bash told on its shield');
    let n = 0; M.group.traverseVisible((o) => { if (o.isMesh) n++; });
    assert.equal(n, 3, `${tier}: ${n} meshes`);
    const top = new THREE.Box3().setFromObject(M.group).max.y;
    assert.ok(top > 1.9 && top < 2.15, `${top.toFixed(2)} m to its head's top (the old droid's 2.01)`);
    const C = body(M).geometry.attributes.color, seen = new Set(); for (let v = 0; v < C.count; v += 7) seen.add(hexOf(C, v));
    if (tier) assert.ok(seen.has(DROID_TIER.ceramic), 'scorched ceramic'); else assert.ok(seen.has(SRC.rig.palette.ceramic), 'the reference\'s pink ceramic');
    M.dispose();
  }
});

test('the Tripo skin: 10–15k triangles, flat colours, normalised weights, its fists whole on its hands; one amber lens in the visor', () => {
  const tris = SRC.geometry.index.count / 3;
  assert.ok(tris >= 10000 && tris <= 15000, `${tris} triangles`);
  const pal = new Set(Object.values(SRC.rig.palette)), col = SRC.geometry.attributes.color;
  for (let v = 0; v < col.count; v++) assert.ok(pal.has(hexOf(col, v)), `vertex ${v}: ${hexOf(col, v)} a flat colour`);
  const M = tripoSentinelModel(skinOf('sentinel', 'desert'), SRC), sm = body(M), W = sm.geometry.attributes.skinWeight, I = sm.geometry.attributes.skinIndex;
  for (let i = 0; i < W.count; i++) { const s = W.getX(i) + W.getY(i) + W.getZ(i) + W.getW(i); assert.ok(Math.abs(s - 1) < 1e-5); }
  assert.ok(sm.skeleton.bones.includes(M.gaze[0].node), 'the head bone is the look');
  const hands = [0, 1].map((i) => sm.skeleton.bones.indexOf(M.joints.hands[i])), fist = M.joints && (() => { let n = 0; for (let i = 0; i < W.count; i++) if (hands.includes(I.getX(i)) && W.getX(i) === 1) n++; return n; })();
  assert.ok(fist > 100, `${fist} vertices of its fists carried whole`);
  const V = SRC.rig.landmarks.visor;
  assert.ok(V.texels > 100 && V.w > 0.12 && V.centre[1] > 1.75, JSON.stringify(V));
  assert.equal(M.group.getObjectByName('eyes').parent, M.gaze[0].node, 'the lens on the look');
  M.dispose();
});

test('in the fight: it looks at the traveller, raises its shield in its guard, the blade in its fist through every clip', () => {
  const foes = arena();
  const f = foes.add('sentinel@desert', new THREE.Vector3(), { tier: 0 }); f.heading = 0; f.provoked = true;
  for (let i = 0; i < 45; i++) { f.dist = 7; foes.look(f, 1 / 30); }
  const M = f.model, fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(M.gaze[0].node.getWorldQuaternion(new THREE.Quaternion()));
  assert.ok(fwd.x > 0.25, `the head turns to the traveller (${fwd.x.toFixed(2)})`);
  // its guard: the shield brought square before it
  const shield = M.group.getObjectByName('shield'), face = () => new THREE.Vector3(0, 0, 1).applyQuaternion(shield.getWorldQuaternion(new THREE.Quaternion()));
  const rest = face().z;
  for (let i = 0; i < 30; i++) { f.guardK = 1; foes.look(f, 1 / 30); }
  assert.ok(face().z > 0.9 && face().z > rest, `the shield square before it in its guard (${rest.toFixed(2)} → ${face().z.toFixed(2)})`);
  f.guardK = 0;
  // the blade's grip in the fist's middle through the clips
  const grip = M.group.getObjectByName('grip'), hand = M.joints.hands[0];
  let worst = 0;
  const run = (secs, set) => { for (let t = 0; t < secs; t += 1 / 30) { set(t); foes.look(f, 1 / 30); const d = grip.getWorldPosition(new THREE.Vector3()).distanceTo(hand.localToWorld(new THREE.Vector3(...M.wield.at[0]))); worst = Math.max(worst, d); } };
  for (const a of FOES.sentinel.attacks) run(a.wind + (a.strike ?? 0.3) + 0.3, (t) => { f.atk = a; f.dist = 2; f.state = t < a.wind ? 'wind' : t < a.wind + (a.strike ?? 0.3) ? 'strike' : 'recover'; f.k = f.state === 'wind' ? t / a.wind : 0; });
  assert.ok(worst < 0.02, `the blade held at the fist's middle (${worst.toFixed(3)} m)`);
  foes.dispose(); clearTargets();
});
