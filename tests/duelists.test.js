// The shade and the makers' fencer on the humanoid foe rig (issue #724, src/enemies/humanoid-rig.js): every move of theirs
// maps to a shipped clip (or the shade's step, its own sink into its pool), the mind's wind-up times untouched, the
// shade's feint the cut's clip stopped halfway and then its thrust from the hip, the fencer's guard the sword-and-shield
// block over its walk; with the real clips (public/anim/ual.glb + moves.glb) the bodies take the poses, fall down and get
// up through a crossfade, stand on their feet, at a measured cost.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { readFile } from 'node:fs/promises';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { libraryFrom } from '../src/animator.js';
import { attachMotion } from '../src/motion-match.js';
import { stateClip, feintClip, HOLD_AT, XFADE, PROC_POSES, setFoeClips } from '../src/enemies/humanoid-rig.js';
import { SHADE_MOVES, SHADE_BODY } from '../src/enemies/plans/humanoid.js';
import { FENCER_MOVES, FENCER_BODY } from '../src/enemies/plans/fencer.js';
import { archetypeModel } from '../src/enemies/plans/index.js';
import { skinWorlds } from '../src/enemies/skins.js';
import { ARCHETYPES } from '../src/enemies/archetypes.js';
import { Foes, FOES } from '../src/foes.js';
import { GameState } from '../src/game-state.js';
import { clearTargets } from '../src/targets.js';

const v = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const DT = 1 / 60;
const parse = async (n) => { const b = await readFile(new URL(`../public/anim/${n}`, import.meta.url)); return new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), ''); };
let libP = null;
const library = () => (libP ??= Promise.all([parse('ual.glb'), parse('moves.glb')]).then(([ual, moves]) => { const lib = libraryFrom(ual); attachMotion(lib, moves); return lib; }));
const SETS = [['shade', SHADE_MOVES, SHADE_BODY], ['fencer', FENCER_MOVES, FENCER_BODY]];

test('the mind\'s timing is the contract: every wind-up, strike and contact as it was before the clips', () => {
  const was = { shade: { cut: [0.95, 0.24, 0.55], feint: [1.3, 0.22, 0.5], step: [1.0, undefined, undefined], recut: [0.55, 0.22, 0.5] },
    fencer: { overhead: [1.0, 0.22, 0.55], sweep: [0.95, 0.26, 0.5], leap: [0.95, 1.15, 0.95], bash: [0.75, 0.2, 0.5], shove: [0.95, 0.2, 0.5] } };
  for (const [id, moves] of Object.entries(was)) for (const [a, [wind, strike, contact]] of Object.entries(moves)) {
    const A = FOES[id].attacks.find((x) => x.id === a);
    assert.deepEqual([A.wind, A.strike, A.contact], [wind, strike, contact], `${id}.${a}`);
  }
  assert.equal(FOES.shade.attacks.find((a) => a.id === 'feint').feint, 0.45);
});

test('every move maps to a shipped clip, its anticipation, load, cut and follow-through in order inside it', async () => {
  const lib = await library(), clip = (n) => lib.motion.clips.find((c) => c.name === `mixamo_${n}`);
  for (const [who, MOVES] of SETS) {
    for (const a of ARCHETYPES[who].def.attacks) assert.ok(MOVES[a.id] || (who === 'shade' && a.id === 'step'), `${who}.${a.id}: a clip (the step: its own sink)`);
    for (const [id, m] of Object.entries(MOVES)) {
      const c = clip(m.clip);
      assert.ok(c, `${who}.${id}: ${m.clip} in moves.glb`);
      assert.ok(m.from < m.load && m.load < m.cut && m.cut < m.to && m.to <= c.duration + 1e-6, `${who}.${id}: from < load < cut < to ≤ ${c.duration.toFixed(2)}`);
      if (m.pose) assert.ok(PROC_POSES[m.pose], `${who}.${id}: ${m.pose}`);
      if (m.feint) { assert.ok(m.from < m.half && m.half < m.load, 'the feint stops its cut before it loads'); assert.ok(clip(m.feint.clip) && PROC_POSES[m.feint.pose]); }
    }
  }
  for (const n of ['ss_block_idle', 'ss_impact_1', 'get_up_back', 'ss_strafe_1']) assert.ok(clip(n), n);
});

test('the feint: the cut\'s clip begun and stopped halfway, held, then the thrust from the hip on its own clip and pose', () => {
  const M = SHADE_MOVES.feint, A = 0.45, at = (state, k) => stateClip({ state, k, atk: { id: 'feint', feint: A, contact: 0.5 } }, SHADE_MOVES);
  const early = at('wind', 0.1), half = at('wind', A), hold = at('wind', A + 0.04), late = at('wind', 0.8), thrust = at('strike', 0.5);
  assert.equal(early.clip, M.clip); assert.equal(half.clip, M.clip);
  assert.ok(early.t > M.from && early.t < M.half, 'the cut begun');
  assert.ok(Math.abs(half.t - M.half) < 1e-9 && Math.abs(hold.t - M.half) < 1e-9, 'stopped halfway and held: never loaded');
  assert.ok(half.load <= 0.5 + 1e-9, 'its tell only half a cut');
  assert.equal(late.clip, M.feint.clip); assert.equal(late.pose, 'thrust'); assert.equal(late.load, 1, 'the thrust loaded by 75 %');
  assert.equal(thrust.pose, 'thrust'); assert.equal(thrust.phase, 'strike');
  assert.deepEqual(feintClip({ state: 'recover', k: 0 }, M, A).pose, 'thrust');
  // the cut itself loads fully at 75 % and holds
  const cut = stateClip({ state: 'wind', k: HOLD_AT, atk: { id: 'cut' } }, SHADE_MOVES);
  assert.ok(Math.abs(cut.t - SHADE_MOVES.cut.load) < 1e-9 && cut.load === 1);
});

test('built in every skin, on the rig: a driver, its joints, the parts the fight finds by name', () => {
  for (const id of ['shade', 'fencer']) for (const w of skinWorlds(id)) {
    const m = archetypeModel(id, w);
    assert.ok(m.driver && m.joints && m.rig === null && m.upright, `${id}@${w}: on the humanoid rig`);
    for (const n of id === 'fencer' ? ['grip', 'shield', 'dropped sword'] : ['grip', 'sword', 'drape', 'smoke']) assert.ok(m.group.getObjectByName(n), `${id}@${w}: ${n}`);
    m.dispose();
  }
});

test('with the clips: cuts held loaded, the feint read as a cut stopped halfway, the guard, a fall and a get-up, on its feet; its cost', async () => {
  setFoeClips(await library());
  clearTargets();
  const P = { pos: v(0, 0, -4), vel: v(), heading: 0, onGround: true, health: 1, down: null, dead: true, frame: { up: v(0, 1, 0) }, hurt() {}, knockDown() { return true; }, flinch() {} };
  const foes = new Foes({ scene: new THREE.Scene(), level: { spawn: v(0, 0, -500), foes: { waves: true } }, levelId: 'arena', physics: { groundAt: () => 0, rayHit: () => null }, player: P, settings: { enemies: 'normal' }, game: new GameState(null), tool: { drops: { add() {} } } });
  foes.setPractice('');
  const W = (f, j) => { f.model.group.updateMatrixWorld(true); return j.getWorldPosition(v()); };
  const run = (f, n, set) => { for (let i = 0; i < n; i++) { set?.(i); foes.look(f, DT); } };
  for (const [kind, , D] of SETS) {
    const f = foes.add(kind, v(0, 0, 0)); f.provoked = true; f.heading = 0;
    const J = f.model.joints, ankle = D.hip - D.thigh - D.shin;
    run(f, 40);
    assert.ok(f.model.driver.A, `${kind}: its own Animator`);
    const feet = Math.min(...J.feet.map((x) => W(f, x).y));
    assert.ok(Math.abs(feet - ankle) < 0.09, `${kind}: standing on its feet (${feet.toFixed(3)})`);
    const hand = (i = 0) => W(f, J.hands[i]).y, rest = hand();
    // its first move's wind-up: the sword hand up toward the loaded pose, held from 75 % to the end
    const a = f.def.attacks[0], wind = (k) => { f.state = 'wind'; f.atk = a; f.k = k; run(f, 14); return W(f, J.hands[0]).clone(); };
    const held = wind(HOLD_AT), late = wind(0.97);
    assert.ok(held.y > rest + 0.3, `${kind}.${a.id}: its sword hand up (${rest.toFixed(2)} → ${held.y.toFixed(2)} m)`);
    assert.ok(held.distanceTo(late) < 0.15, `${kind}.${a.id}: the loaded pose held to the end (${held.distanceTo(late).toFixed(3)} m)`);
    f.state = 'chase'; f.atk = null; run(f, 30);
    if (kind === 'shade') {
      // the feint: half a cut (its hand up but short of the cut's loaded height), then the sword at its hip, then out
      const F = f.def.attacks.find((x) => x.id === 'feint');
      run(f, 40, (i) => { f.state = 'wind'; f.atk = F; f.k = Math.min(F.feint, i / 39 * F.feint); });
      const half = hand();
      run(f, 50, (i) => { f.k = F.feint + (i / 49) * (0.95 - F.feint); });
      const hip = hand();
      assert.ok(half > rest + 0.15 && half < held.y - 0.1, `the cut stopped halfway: its hand up ${half.toFixed(2)} m (the cut's loaded ${held.y.toFixed(2)} m)`);
      assert.ok(hip < half - 0.25 && hip < 1.1, `then the sword at its hip (${hip.toFixed(2)} m)`);
      run(f, 10, (i) => { f.state = 'strike'; f.k = 0.3 + i / 20; });
      const out = W(f, J.hands[0]);
      assert.ok(out.z > 0.35 && out.y < 1.35, `the thrust: its sword hand out before it, low (z ${out.z.toFixed(2)}, y ${out.y.toFixed(2)} m)`);
      f.state = 'chase'; f.atk = null; run(f, 30);
    } else {
      // the guard: the sword-and-shield block over the walk, the shield hand out before its chest
      const l0 = W(f, J.hands[1]).clone();
      run(f, 40, () => { f.state = 'chase'; f.guardK = 1; });
      const l1 = W(f, J.hands[1]);
      assert.ok(l1.z > l0.z + 0.15 && l1.y > 0.9, `its shield up before it (z ${l0.z.toFixed(2)} → ${l1.z.toFixed(2)}, y ${l1.y.toFixed(2)} m)`);
      f.guardK = 0; run(f, 40);
      // the leap: its clip's own rise left out (the mind's arc lifts it): its hips no higher than standing
      const L = f.def.attacks.find((x) => x.id === 'leap'), hips = W(f, J.torso).y;
      run(f, 30, (i) => { f.state = 'strike'; f.atk = L; f.k = 0.3 + i / 100; f.alt = 0; });
      assert.ok(W(f, J.torso).y < hips + 0.1, `the leap's rise is the mind's, not the clip's (${hips.toFixed(2)} → ${W(f, J.torso).y.toFixed(2)} m)`);
      f.state = 'chase'; f.atk = null; run(f, 30);
    }
    // a stagger, then knocked down: it falls over XFADE.fall (not in a frame), lies, then gets up
    const head = () => W(f, J.head).y, up = head();
    run(f, 20, (i) => { f.state = 'recover'; f.stunned = 0.6 - i / 60; });
    f.stunned = 0; f.downT = 1.6; foes.look(f, DT);
    const first = head();
    run(f, Math.ceil(XFADE.fall * 60) + 6, () => { f.downT -= DT; });
    const lying = head();
    assert.ok(first > up * 0.6, `the fall eased in from the stagger (${first.toFixed(2)} m a frame in)`);
    assert.ok(lying < 0.35, `lying on its back (${lying.toFixed(2)} m)`);
    run(f, 80, () => { f.downT = Math.max(0, f.downT - DT); });
    f.downT = 0; f.state = 'chase'; run(f, 40);
    assert.ok(head() > up - 0.2, `and up again (${head().toFixed(2)} m)`);
    // the cost: a frame of its pose (the clip's mixer, the retarget and its own layers), median of many
    const t = [];
    for (let i = 0; i < 160; i++) { f.pos.z += 0.04; const t0 = performance.now(); foes.look(f, DT); t.push(performance.now() - t0); }
    t.sort((x, y) => x - y);
    console.log(`${kind}: ${t[80].toFixed(3)} ms a frame (node, this machine; the look whole, the rig's own ${f.model.driver.cost.toFixed(3)} ms)`);
    assert.ok(t[80] < 2, `${kind}: under 2 ms a frame (${t[80].toFixed(3)})`);
    foes.remove(f);
  }
  foes.dispose(); clearTargets();
});
