// How the humanoid foes hold their weapons (issue #744, src/enemies/wield.js): the fist turned to the haft, the fingers
// closed round it, each move's own aim, the other hand on a two-handed haft, the bow at the middle of its stave.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { readFile } from 'node:fs/promises';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { libraryFrom } from '../src/animator.js';
import { attachMotion } from '../src/motion-match.js';
import { setFoeClips, HOLD_AT } from '../src/enemies/humanoid-rig.js';
import { fistTurn, curlAngles, slerpDir, frameDir, WRIST, SWORD_WRIST } from '../src/enemies/wield.js';
import { Foes } from '../src/foes.js';
import { GameState } from '../src/game-state.js';
import { clearTargets } from '../src/targets.js';
// (the fights' picks seeded: unseeded, a rare draw failed a test as the bodies changed, #800)
const seeded = (s = 7) => () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; };

const v = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z), DT = 1 / 60, deg = 180 / Math.PI;
const parse = async (n) => { const b = await readFile(new URL(`../public/anim/${n}`, import.meta.url)); return new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), ''); };
let libP = null;
const library = () => (libP ??= Promise.all([parse('ual.glb'), parse('moves.glb')]).then(([ual, moves]) => { const lib = libraryFrom(ual); attachMotion(lib, moves); return lib; }));

test('the fist turned to the haft: across the palm out of the thumb, the wrist within its reach, the line held exact', () => {
  let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
  const q = new THREE.Quaternion();
  for (let n = 0; n < 400; n++) {
    const fore = v(rnd(), rnd(), rnd()).normalize(), want = v(rnd(), rnd(), rnd()).normalize(), s = n % 2 ? 1 : -1, lim = n % 3 ? WRIST : SWORD_WRIST;
    const axis = want.clone(), diag = fistTurn(fore, axis, s, q, lim);
    const held = Math.acos(Math.max(-1, Math.min(1, fore.dot(axis))));
    assert.ok(held >= lim.min - 1e-6 && held <= lim.max + 1e-6, `the haft's angle to the forearm within the wrist's reach (${(held * deg).toFixed(1)}°)`);
    // (a haft the wrist can hold is held where it was aimed)
    const ang = Math.acos(Math.max(-1, Math.min(1, fore.dot(want))));
    if (ang > lim.min && ang < lim.max) assert.ok(axis.angleTo(want) < 1e-6, 'held where aimed');
    // the grip's line in the hand (its +y: the thumb's side, leaning by the diagonal) is the haft
    const grip = v(s, 0, 0).applyAxisAngle(v(0, 0, 1), -s * diag).applyQuaternion(q);
    assert.ok(grip.angleTo(axis) < 1e-5, `the grip along the haft (${(grip.angleTo(axis) * deg).toFixed(3)}°)`);
    // the wrist bends only what the palm's diagonal does not take: the hand's fingers' line near the forearm's
    const fingers = v(0, -1, 0).applyQuaternion(q);
    assert.ok(fingers.angleTo(fore) <= Math.abs(Math.PI / 2 - held) - Math.abs(diag) + 1e-5, 'the wrist bent no more than it must');
    assert.ok(Math.abs(diag) <= lim.diag + 1e-9);
  }
  // a hanging right hand holding a sword out ahead: its palm to its thigh (+x), its thumb (the haft's way) forward
  const axis = v(0, 0, 1); fistTurn(v(0, -1, 0), axis, -1, q);
  assert.ok(v(0, 0, 1).applyQuaternion(q).distanceTo(v(1, 0, 0)) < 1e-6, 'the palm toward the body');
  assert.ok(slerpDir(v(1, 0, 0), v(0, 1, 0), 0.5).distanceTo(v(1, 1, 0).normalize()) < 1e-9);
  assert.ok(slerpDir(v(1, 0, 0), v(-1, 0, 0), 0.5, v(), v(0, 0, 1)).distanceTo(v(0, 0, 1)) < 1e-9, 'opposite: round the pole');
});

test('the fingers wrap the haft: the middle joint and the tip laid on it', () => {
  // a finger hanging from its knuckle (y, z): 1.9 to the middle joint, 1.45 on to its tip; a haft before the palm
  const K = [-2.45, 0.2], M = [-4.3, 0.65], E = [-5.35, 1.65];
  for (const [C, R] of [[[-2.8, 1.35], 0.92], [[-2.9, 1.6], 1.2], [[-3.4, 1.0], 0.8]]) {
    const [b1, b2] = curlAngles(K, M, E, C, R);
    const turn = (p, o, a) => { const y = p[0] - o[0], z = p[1] - o[1]; return [o[0] + y * Math.cos(a) - z * Math.sin(a), o[1] + y * Math.sin(a) + z * Math.cos(a)]; };
    // (forward, from −y toward +z: in (y, z) a turn by +a)
    const M2 = turn(M, K, -b1), E1 = turn(E, K, -b1), E2 = turn(E1, M2, -b2);
    const d = (p) => Math.hypot(p[0] - C[0], p[1] - C[1]);
    assert.ok(b1 > 0 && b2 > 0, 'bent forward, both joints');
    assert.ok(Math.abs(d(M2) - R) < 1e-6, `the middle joint on the haft (${d(M2).toFixed(3)} for ${R})`);
    assert.ok(Math.abs(d(E2) - R) < 1e-6, `the tip round it (${d(E2).toFixed(3)})`);
  }
});

const KINDS = {
  hulk: { weapon: 'club', moves: ['smash', 'sweep', 'stomp'], both: ['smash'], aims: { smash: 12 } },
  grunt: { weapon: 'club', moves: ['club', 'lunge'], both: ['club'] },
  sentinel: { weapon: 'blade', moves: ['cut', 'thrust', 'dash', 'bash'], aims: { cut: 12, thrust: 12 } },
  fencer: { weapon: 'sword', moves: ['overhead', 'sweep', 'leap'], aims: { overhead: 12 } },
  shade: { weapon: 'sword', moves: ['cut', 'feint'], aims: { cut: 12 } },
  prowler: { weapon: 'blade', moves: ['slash', 'dart'], aims: { slash: 12 } },
  warlord: { weapon: 'glaive', moves: ['sweep', 'overhead', 'charge', 'whirl'], aims: { overhead: 12, charge: 12 } },
  mummer: { weapon: 'club', moves: ['whack'], both: ['whack'] },
  mummerking: { weapon: 'beam', moves: ['smash', 'swing'] },
};

test('with the clips: every armed foe holds its weapon in a closed fist, along the line each move aims it, both hands on a two-handed haft; the bow at its middle, its cord drawn', async () => {
  setFoeClips(await library());
  clearTargets();
  const P = { pos: v(0, 0, -4), vel: v(), heading: 0, onGround: true, health: 1, down: null, dead: true, frame: { up: v(0, 1, 0) }, hurt() {}, knockDown() { return true; }, flinch() {} };
  const foes = new Foes({ scene: new THREE.Scene(), level: { spawn: v(0, 0, -500), foes: { waves: true } }, levelId: 'arena', physics: { groundAt: () => 0, rayHit: () => null }, player: P, settings: { enemies: 'normal' }, game: new GameState(null), tool: { drops: { add() {} } }, rng: seeded() });
  foes.setPractice('');
  const quat = (o) => o.getWorldQuaternion(new THREE.Quaternion());
  for (const [kind, K] of Object.entries(KINDS)) {
    const f = foes.add(kind, v()); f.provoked = true; f.heading = 0; f.state = 'chase';
    if (f.weapon) f.weapon = K.weapon;   // (a mummer's or a grunt's own, whatever it was dealt)
    const run = (n, set) => { for (let i = 0; i < n; i++) { set?.(i); foes.look(f, DT); } f.model.group.updateMatrixWorld(true); };
    const M = f.model, Wd = M.wield, J = M.joints, scale = J.body.getWorldScale(v()).y;
    assert.ok(Wd, `${kind}: a wielder`);
    const spec = Wd.weapons[K.weapon], side = spec.side, grip = Wd.grips[side];
    const check = (label) => {
      assert.equal(Wd.name, K.weapon, `${kind} ${label}: its ${K.weapon} in hand`);
      const line = v(0, 1, 0).applyQuaternion(quat(grip));
      // the grip in the fist: at the fist's haft, the weapon along the line the wrist holds
      const fist = J.hands[side].localToWorld(Wd.haftAt(side, spec.r, v())), at = grip.getWorldPosition(v());
      assert.ok(at.distanceTo(fist) < 0.01 * scale, `${kind} ${label}: the grip in the fist (${at.distanceTo(fist).toFixed(3)} m)`);
      assert.ok(line.angleTo(Wd.axis) < 0.02, `${kind} ${label}: the weapon along the line held (${(line.angleTo(Wd.axis) * deg).toFixed(1)}°)`);
      // (the ground before the wrist: a weapon kept off it may bend the fist further)
      const low = Math.min(grip.localToWorld(v(0, spec.reach[0], 0)).y, grip.localToWorld(v(0, -spec.reach[1], 0)).y) < 0.25 * scale;
      const fore = v(0, -1, 0).applyQuaternion(quat(J.elbows[side])), lim = low ? { min: 0.1, max: 3.0 } : spec.wrist ?? WRIST, a = fore.angleTo(line);
      assert.ok(a > lim.min - 0.02 && a < lim.max + 0.02, `${kind} ${label}: within the wrist's reach (${(a * deg).toFixed(0)}°)`);
      if (M.fists?.[side]) assert.ok(M.fists[side].w > 0.9, `${kind} ${label}: its fist closed (${M.fists[side].w.toFixed(2)})`);
      return line;
    };
    run(40);
    check('chase');
    for (const id of K.moves) {
      const atk = f.def.attacks.find((a) => a.id === id);
      run(40, () => { f.state = 'wind'; f.atk = atk; f.k = HOLD_AT + 0.1; });
      const line = check(`${id} wind`);
      // its own aim held through the loaded pose (where nothing keeps it off: the ground, the wrist)
      if (K.aims?.[id]) {
        const key = spec.moves[id], want = frameDir(key.frame === 'body' ? J.body : J.torso, key.wind);
        assert.ok(line.angleTo(want) < K.aims[id] / deg, `${kind} ${id}: the loaded pose's aim (${(line.angleTo(want) * deg).toFixed(0)}° off)`);
      }
      if (K.both?.includes(id)) {
        assert.ok(Wd.offW > 0.8, `${kind} ${id}: both hands on it (${(Wd.offW ?? 0).toFixed(2)})`);
        const j = 1 - side, other = J.hands[j].localToWorld(Wd.haftAt(j, spec.r, v())), p = grip.getWorldPosition(v()), d = other.clone().sub(p);
        const along = d.dot(line), off = d.addScaledVector(line, -along).length();
        assert.ok(off < 0.06 * scale, `${kind} ${id}: the other fist on the haft (${off.toFixed(3)} m off its line)`);
        assert.ok(Math.abs(along) > 0.05 * scale, `${kind} ${id}: the fists apart along it, not one through the other (${along.toFixed(2)} m)`);
        if (M.fists?.[j]) assert.ok(M.fists[j].w > 0.8, `${kind} ${id}: the other fist closed`);
      }
      run(6, () => { f.state = 'strike'; f.k = atk.contact ?? 0.5; });
      check(`${id} strike`);
      f.state = 'chase'; f.atk = null; run(40);
    }
    // knocked down: lying, its weapon off the ground
    run(50, () => { f.state = 'recover'; f.downT = 2; });
    // (no lower than the ground, or than its own fist where the lying clip sinks that a little into it)
    const tip = grip.localToWorld(v(0, spec.reach[0], 0)), butt = grip.localToWorld(v(0, -spec.reach[1], 0)), floor = Math.min(0, grip.getWorldPosition(v()).y) - 0.06;
    assert.ok(tip.y > floor && butt.y > floor, `${kind} lying: its weapon laid on the ground, not into it (${tip.y.toFixed(2)}, ${butt.y.toFixed(2)})`);
    f.downT = 0; f.state = 'chase'; run(60);
    foes.remove(f);
  }
  // the hulk throws a grunt: its club set down, its hands open
  {
    const f = foes.add('hulk', v()); f.provoked = true; f.state = 'chase';
    for (let i = 0; i < 30; i++) foes.look(f, DT);
    const atk = f.def.attacks.find((a) => a.id === 'throw');
    for (let i = 0; i < 40; i++) { f.state = 'wind'; f.atk = atk; f.k = 0.5; foes.look(f, DT); }
    assert.equal(f.model.wield.name, null);
    assert.ok(f.model.fists.every((x) => x.w < 0.1), `the hulk's hands open to take the grunt (${f.model.fists.map((x) => x.w.toFixed(2))})`);
    foes.remove(f);
  }
  // the bow: in the left fist at the middle of its stave, its limbs near upright at you in the volley, the cord drawn
  // back to the right fist
  for (const kind of ['mummer', 'grunt']) {
    const f = foes.add(kind, v()); f.provoked = true; f.state = 'chase'; f.weapon = 'bow';
    const run = (n, set) => { for (let i = 0; i < n; i++) { set?.(i); foes.look(f, DT); } f.model.group.updateMatrixWorld(true); };
    run(30);
    const M = f.model, J = M.joints, bow = M.group.getObjectByName('bow'), cord = M.group.getObjectByName('cord top');
    const fist = J.hands[1].localToWorld(M.wield.haftAt(1, M.wield.weapons.bow.r, v()));
    assert.ok(bow.getWorldPosition(v()).distanceTo(fist) < 0.01, `${kind}: the bow held at the middle of its stave`);
    const atk = f.def.attacks.find((a) => a.id === 'volley');
    run(40, () => { f.state = 'wind'; f.atk = atk; f.k = 0.9; });
    const limbs = v(0, 1, 0).applyQuaternion(quat(bow));
    assert.ok(limbs.y > 0.85, `${kind} volley: the bow's limbs near upright (${limbs.y.toFixed(2)})`);
    const nock = cord.localToWorld(v(0, -(M.wield.weapons.bow.reach[0] - 0.02), 0)), hand = J.hands[0].localToWorld(M.fists[0].fit(0.006).at.clone());
    assert.ok(nock.distanceTo(hand) < 0.05, `${kind} volley: the cord drawn back to the right hand (${nock.distanceTo(hand).toFixed(2)} m)`);
    assert.ok(M.fists[0].w > 0.8 && M.fists[1].w > 0.8, `${kind} volley: both hands closed (the bow, the cord)`);
    foes.remove(f);
  }
  foes.dispose(); clearTargets();
});
