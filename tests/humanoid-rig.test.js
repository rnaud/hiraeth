// The humanoid foe rig (issue #724, src/enemies/humanoid-rig.js): every foe state maps to a clip (or a held procedural
// pose where no clip exists), the wind-up's clip is stretched to the foe's own wind-up time and its loaded pose held from
// HOLD_AT (the mind's timing untouched), every attack clip named exists in the shipped moves, and with the real clips
// (public/anim/ual.glb + moves.glb, parsed here) the bodies take the pose: the loaded wind-up held, a different pose from
// the walk, the feet on the ground, at a measured cost.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { readFile } from 'node:fs/promises';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { libraryFrom } from '../src/animator.js';
import { attachMotion } from '../src/motion-match.js';
import { stateClip, windClipTime, strikeClipTime, pingpong, HOLD_AT, STATE_CLIPS, PROC_POSES, setFoeClips, foeClips, humanoidSkeleton } from '../src/enemies/humanoid-rig.js';
import { MUMMER_MOVES, KING_MOVES, MUMMER_BODY, KING_BODY } from '../src/enemies/plans/mummer.js';
import { ARCHETYPES } from '../src/enemies/archetypes.js';
import { Foes, FOES } from '../src/foes.js';
import { GameState } from '../src/game-state.js';
import { clearTargets } from '../src/targets.js';

const v = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const DT = 1 / 60;
const parse = async (n) => { const b = await readFile(new URL(`../public/anim/${n}`, import.meta.url)); return new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), ''); };
let libP = null;
const library = () => (libP ??= Promise.all([parse('ual.glb'), parse('moves.glb')]).then(([ual, moves]) => { const lib = libraryFrom(ual); attachMotion(lib, moves); return lib; }));

test('every state maps to a clip: the fight, the knock-down and its get-up, a stagger, a pickup, the sites\' idles, walking by speed', () => {
  const atk = { id: 'whack', contact: 0.55 };
  assert.deepEqual(stateClip({ state: 'chase' }, MUMMER_MOVES), { loop: 'move' }, 'chasing: the locomotion loops by speed');
  assert.deepEqual(stateClip({ state: 'idle' }, MUMMER_MOVES), { loop: 'move' });
  const w = stateClip({ state: 'wind', k: 0.4, atk }, MUMMER_MOVES);
  assert.equal(w.clip, 'gs_slash_1'); assert.equal(w.kind, 'wind');
  assert.equal(stateClip({ state: 'strike', k: 0.2, atk }, MUMMER_MOVES).kind, 'strike');
  assert.equal(stateClip({ state: 'recover', k: 0.2, atk }, MUMMER_MOVES).t, MUMMER_MOVES.whack.to, 'recovering: the follow-through held, easing out');
  // the poise knock-down (#722): lying on its back, then the get-up over its last second
  const lying = stateClip({ state: 'recover', downT: 1.2 }, MUMMER_MOVES), rising = stateClip({ state: 'recover', downT: 0.3 }, MUMMER_MOVES);
  assert.equal(lying.clip, 'get_up_back'); assert.equal(lying.t, STATE_CLIPS.down.at);
  assert.ok(rising.t > STATE_CLIPS.down.rise.from && rising.t < STATE_CLIPS.down.rise.to, 'getting up');
  assert.equal(stateClip({ state: 'recover', stunned: 0.4 }, MUMMER_MOVES).clip, 'ss_impact_1', 'stunned: the impact');
  assert.equal(stateClip({ state: 'recover', reel: 'pickup', timer: 0.5 }, MUMMER_MOVES).clip, 'kneeling_inspecting', 'bending for its weapon');
  // calm at a site: squatting by the fire, asleep on its back, looking out; provoked, its own again
  assert.equal(stateClip({ state: 'idle', idle: { mode: 'sit' } }, MUMMER_MOVES, { t: 3 }).clip, 'kneeling_inspecting');
  assert.equal(stateClip({ state: 'idle', idle: { mode: 'sleep' } }, MUMMER_MOVES).clip, 'get_up_back');
  assert.deepEqual(stateClip({ state: 'idle', idle: { mode: 'lookout' } }, MUMMER_MOVES), { loop: 'look' });
  assert.deepEqual(stateClip({ state: 'idle', provoked: true, idle: { mode: 'sit' } }, MUMMER_MOVES), { loop: 'move' });
  // circling sideways while it waits its turn: the strafe, mirrored for the other way
  assert.equal(stateClip({ state: 'chase' }, MUMMER_MOVES, { strafe: 0.9 }).clip, 'ss_strafe_1');
  assert.equal(stateClip({ state: 'chase' }, MUMMER_MOVES, { strafe: -0.9 }).clip, 'ss_strafe_1_m');
  // a clip with a hand-made pose of the arms over it (the bow, #724: its body the sword-and-shield guard's stance)
  const bow = stateClip({ state: 'wind', k: 0.9, atk: { id: 'volley' } }, MUMMER_MOVES);
  assert.equal(bow.pose, 'bow'); assert.equal(bow.load, 1);
  for (const M of [MUMMER_MOVES, KING_MOVES]) for (const m of Object.values(M)) if (m.pose) assert.ok(PROC_POSES[m.pose], `${m.pose}: a pose`);
  assert.equal(pingpong(0.5, 1, 2), 1.5); assert.equal(pingpong(1.5, 1, 2), 1.5); assert.equal(pingpong(1.0, 1, 2), 2);
});

test('the wind-up keeps the foe\'s own time: the clip\'s anticipation stretched over it, loaded at 75 % and held; the cut at the contact', () => {
  const M = MUMMER_MOVES.whack;
  assert.equal(windClipTime(0, M), M.from);
  assert.ok(Math.abs(windClipTime(HOLD_AT, M) - M.load) < 1e-9, 'loaded at 75 %');
  assert.equal(windClipTime(0.9, M), M.load, 'and held to the end');
  for (let k = 0.01; k < 1; k += 0.01) assert.ok(windClipTime(k, M) >= windClipTime(k - 0.01, M) - 1e-12, 'never back');
  assert.ok(windClipTime(1, M) < M.cut, 'the cut never begins in the wind-up');
  assert.equal(strikeClipTime(0, M, 0.55), M.load);
  assert.ok(Math.abs(strikeClipTime(0.55, M, 0.55) - M.cut) < 1e-9, 'the clip\'s cut lands on the strike\'s contact');
  assert.ok(Math.abs(strikeClipTime(1, M, 0.55) - M.to) < 1e-9);
  // the mind's own wind-up untouched: the rig reads the foe's clock, it never sets it
  for (const id of ['mummer', 'mummerking']) for (const a of ARCHETYPES[id].def.attacks) assert.equal(FOES[id].attacks.find((x) => x.id === a.id).wind, a.wind);
});

test('every attack clip is a shipped move, its anticipation, load, cut and follow-through in order inside it', async () => {
  const lib = await library(), names = new Set(lib.motion.clips.map((c) => c.name.replace(/^mixamo_/, '')));
  for (const S of [STATE_CLIPS]) for (const [k, m] of Object.entries(S)) if (m.clip) assert.ok(names.has(m.clip), `${k}: ${m.clip}`);
  for (const [who, MOVES] of [['mummer', MUMMER_MOVES], ['mummerking', KING_MOVES]]) {
    for (const a of ARCHETYPES[who].def.attacks) assert.ok(MOVES[a.id], `${who}.${a.id}: a clip or a pose`);
    for (const [id, m] of Object.entries(MOVES)) {
      if (m.pose) continue;
      const clip = lib.motion.clips.find((c) => c.name === `mixamo_${m.clip}`);
      assert.ok(clip, `${who}.${id}: ${m.clip} in moves.glb`);
      assert.ok(m.from < m.load && m.load < m.cut && m.cut < m.to && m.to <= clip.duration + 1e-6, `${who}.${id}: from < load < cut < to ≤ ${clip.duration.toFixed(2)}`);
    }
  }
  const ual = new Set(Object.keys(lib.clips).filter((k) => lib.clips[k]));
  for (const k of ['idle', 'walk', 'jog', 'sprint', 'look']) assert.ok(ual.has(k), `the library's ${k}`);
});

test('with the clips: the bodies take the clip\'s pose, hold the loaded wind-up, stand on their feet; the cost a foe a frame', async () => {
  setFoeClips(await library());
  assert.ok(foeClips());
  clearTargets();
  const P = { pos: v(0, 0, -4), vel: v(), heading: 0, onGround: true, health: 1, down: null, dead: true, frame: { up: v(0, 1, 0) }, hurt() {}, knockDown() { return true; }, flinch() {} };
  const foes = new Foes({ scene: new THREE.Scene(), level: { spawn: v(0, 0, -500), foes: { waves: true } }, levelId: 'arena', physics: { groundAt: () => 0, rayHit: () => null }, player: P, settings: { enemies: 'normal' }, game: new GameState(null), tool: { drops: { add() {} } } });
  foes.setPractice('');
  for (const [kind, D, id] of [['mummer', MUMMER_BODY, 'whack'], ['mummerking', KING_BODY, 'smash']]) {
    const f = foes.add(kind, v(0, 0, 0)); f.provoked = true;
    const J = f.model.joints, hand = new THREE.Vector3(), low = () => { f.model.group.updateMatrixWorld(true); return Math.min(...J.feet.map((x) => x.getWorldPosition(new THREE.Vector3()).y)); };
    for (let i = 0; i < 30; i++) foes.look(f, DT);
    assert.ok(f.model.driver.A, `${kind}: its own Animator`);
    assert.ok(Math.abs(low() - (D.hip - D.thigh - D.shin)) < 0.08, `${kind}: standing on its feet (${low().toFixed(3)})`);
    // the wind-up: its fist rises toward the loaded pose and holds it from 75 %
    const a = f.def.attacks.find((x) => x.id === id), at = (k) => { f.state = 'wind'; f.atk = a; f.k = k; for (let i = 0; i < 12; i++) foes.look(f, DT); f.model.group.updateMatrixWorld(true); return J.hands[0].getWorldPosition(hand).clone(); };
    const rest = at(0), held = at(HOLD_AT), late = at(0.97);
    assert.ok(held.y > rest.y + 0.2 * D.hip, `${kind}: its arm up in the wind-up (${rest.y.toFixed(2)} → ${held.y.toFixed(2)})`);
    assert.ok(held.distanceTo(late) < 0.12 * (D.hip + D.chest), `${kind}: the loaded pose held to the end (${held.distanceTo(late).toFixed(3)} m)`);
    f.state = 'chase'; f.atk = null;
    // the cost: a frame of its pose (the clip's mixer and the retarget), median of many
    const t = [];
    for (let i = 0; i < 120; i++) { f.pos.z += 0.03; const t0 = performance.now(); foes.look(f, DT); t.push(performance.now() - t0); }
    t.sort((x, y) => x - y);
    const ms = t[60];
    console.log(`${kind}: ${ms.toFixed(3)} ms a frame (node, this machine; the look whole, the rig's own ${f.model.driver.cost.toFixed(3)} ms)`);
    assert.ok(ms < 2, `${kind}: under 2 ms a frame (${ms.toFixed(3)})`);
    foes.remove(f);
  }
  foes.dispose(); clearTargets();
});

test('one skeleton for every humanoid: the Animator\'s joints, each limb hanging down its own length', () => {
  const J = humanoidSkeleton(new THREE.Group(), MUMMER_BODY);
  for (const k of ['body', 'torso', 'head']) assert.ok(J[k]?.isObject3D, k);
  for (const k of ['arms', 'elbows', 'hands', 'legs', 'knees', 'feet']) assert.equal(J[k].length, 2, k);
  assert.ok(J.arms[0].position.x < 0 && J.arms[1].position.x > 0, 'index 0 the right side (-x), as the traveller\'s');
  assert.equal(J.knees[0].position.y, -MUMMER_BODY.thigh); assert.equal(J.feet[0].position.y, -MUMMER_BODY.shin);
});
