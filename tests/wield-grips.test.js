// The grips left over from #744 (issue #746, src/enemies/wield.js): both fists on a two-handed haft through every frame
// of the move (the warlord's sweep, overhead, lance and last stand, the hulk's smash and sweep, the mummer king's smash
// and swing, the grunt's and the mummer's clubs), the lance's other hand ahead, the edges of the blades leading their
// cuts, and no fist in the ground lying down, getting up or asleep.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { readFile } from 'node:fs/promises';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { libraryFrom } from '../src/animator.js';
import { attachMotion } from '../src/motion-match.js';
import { setFoeClips } from '../src/enemies/humanoid-rig.js';
import { Foes } from '../src/foes.js';
import { GameState } from '../src/game-state.js';
import { clearTargets } from '../src/targets.js';
// (the fights' picks seeded: unseeded, a rare draw failed a test as the bodies changed, #800)
const seeded = (s = 7) => () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; };

const v = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z), DT = 1 / 60, deg = 180 / Math.PI;
const parse = async (n) => { const b = await readFile(new URL(`../public/anim/${n}`, import.meta.url)); return new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), ''); };
const WEAPON = { warlord: 'glaive', hulk: 'club', mummerking: 'beam', grunt: 'club', mummer: 'club', fencer: 'sword', sentinel: 'blade', prowler: 'blade', shade: 'sword' };

let foes;
test.before(async () => {
  const [ual, moves] = await Promise.all([parse('ual.glb'), parse('moves.glb')]);
  const lib = libraryFrom(ual); attachMotion(lib, moves); setFoeClips(lib);
  clearTargets();
  const P = { pos: v(0, 0, -4), vel: v(), heading: 0, onGround: true, health: 1, down: null, dead: true, frame: { up: v(0, 1, 0) }, hurt() {}, knockDown() { return true; }, flinch() {} };
  foes = new Foes({ scene: new THREE.Scene(), level: { spawn: v(0, 0, -500), foes: { waves: true } }, levelId: 'arena', physics: { groundAt: () => 0, rayHit: () => null }, player: P, settings: { enemies: 'normal' }, game: new GameState(null), tool: { drops: { add() {} } }, rng: seeded() });
  foes.setPractice('');
});
test.after(() => { foes.dispose(); clearTargets(); });

function make(kind) {
  const f = foes.add(kind, v()); f.provoked = true; f.heading = 0; f.state = 'chase';
  if (f.weapon) f.weapon = WEAPON[kind];
  return f;
}
const look = (f) => { foes.look(f, DT); f.model.group.updateMatrixWorld(true); };
/** One move as the game plays it (its wind-up, its strike, a beat of its recovery), `each` after every frame. */
function play(f, id, each) {
  const atk = f.def.attacks.find((a) => a.id === id);
  f.state = 'chase'; f.atk = null; for (let i = 0; i < 40; i++) look(f);
  const strike = atk.strike ?? 0.24;
  let t = 0;
  for (; t < atk.wind; t += DT) { f.state = 'wind'; f.atk = atk; f.timer = t; f.k = Math.min(1, t / atk.wind); look(f); each('wind', t, f.k); }
  for (let s = 0; s < strike; s += DT, t += DT) { f.state = 'strike'; f.timer = s; f.k = Math.min(1, s / strike); look(f); each('strike', t, f.k); }
  for (let s = 0; s < 0.3; s += DT, t += DT) { f.state = 'recover'; f.timer = 0.3 - s; f.k = 0; look(f); each('recover', t, s); }
  f.state = 'chase'; f.atk = null; for (let i = 0; i < 30; i++) look(f);
  return atk;
}

const TWO = { warlord: ['sweep', 'overhead', 'charge', 'whirl'], hulk: ['smash', 'sweep'], mummerking: ['smash', 'swing'], grunt: ['club'], mummer: ['whack'] };

test('two-handed: the other fist closes on the haft within a third of a second and stays on it (3 cm) every frame the move holds it; the lance with that hand ahead', () => {
  for (const [kind, ids] of Object.entries(TWO)) {
    const f = make(kind), M = f.model, Wd = M.wield, J = M.joints, scale = J.body.getWorldScale(v()).y;
    const spec = Wd.weapons[WEAPON[kind]], side = spec.side, j = 1 - side, grip = Wd.grips[side];
    for (const id of ids) {
      const H = spec.moves[id].both;
      let on = null, worst = 0, at = null, min = Infinity;
      play(f, id, (phase, t) => {
        if (H.phases && !H.phases.includes(phase)) return;
        if (phase === 'recover' && H.phases) return;
        const p = grip.getWorldPosition(v()), line = v(0, 1, 0).applyQuaternion(grip.getWorldQuaternion(new THREE.Quaternion()));
        const other = J.hands[j].localToWorld(Wd.haftAt(j, spec.r, v())), d = other.clone().sub(p), along = d.dot(line);
        const off = other.distanceTo(p.clone().addScaledVector(line, Math.max(-spec.reach[1] * scale, Math.min(spec.reach[0] * scale, along))));
        if (on == null && Wd.offW > 0.98 && off < 0.03 * scale) on = t;
        if (on == null) return;
        if (off > worst) { worst = off; at = `${phase} ${t.toFixed(2)} s`; }
        if (id === 'charge') min = Math.min(min, along);
        assert.ok(Wd.offW > 0.97, `${kind} ${id}: never lets go (${Wd.offW.toFixed(2)} at ${phase} ${t.toFixed(2)} s)`);
      });
      assert.ok(on != null && on < 0.35, `${kind} ${id}: the other fist on the haft by ${on?.toFixed(2)} s`);
      assert.ok(worst <= 0.03 * scale, `${kind} ${id}: the other fist ${(worst * 100).toFixed(1)} cm off the haft at ${at}`);
      if (id === 'charge') assert.ok(min > 0.3 * scale, `warlord charge: the left hand ahead of the right along the lance (${min.toFixed(2)} m)`);
    }
    foes.remove(f);
  }
});

// (the fencer's and the shade's swords cut with either edge; the warlord's glaive, the sentinel's and the prowler's blades
// with one)
const EDGES = { fencer: ['overhead', 'sweep', 'leap'], warlord: ['sweep', 'overhead', 'whirl'], sentinel: ['cut', 'riposte', 'dash'], shade: ['cut'], prowler: ['slash', 'dart'] };

test('the edges lead: the blade turned on its haft so its edge faces the way its tip moves through the strike', () => {
  for (const [kind, ids] of Object.entries(EDGES)) {
    const f = make(kind), M = f.model, Wd = M.wield, spec = Wd.weapons[WEAPON[kind]], grip = Wd.grips[spec.side];
    assert.ok(spec.edge, `${kind}: its edge's way given`);
    for (const id of ids) {
      let prev = null, sum = 0, n = 0;
      const rows = [];
      play(f, id, (phase, t) => {
        const q = grip.getWorldQuaternion(new THREE.Quaternion()), line = v(0, 1, 0).applyQuaternion(q);
        const tip = M.group.worldToLocal(grip.localToWorld(v(0, spec.reach[0] * 0.8, 0)));
        if (prev && phase === 'strike') {
          const vel = tip.clone().sub(prev).divideScalar(DT).applyQuaternion(M.group.getWorldQuaternion(new THREE.Quaternion()));
          vel.addScaledVector(line, -vel.dot(line));
          const edge = v(spec.edge[0], 0, spec.edge[1]).normalize().applyQuaternion(q);
          let c = edge.dot(vel.clone().normalize());
          if (spec.edges === 2) c = Math.abs(c);
          const a = Math.acos(Math.max(-1, Math.min(1, c))) * deg, s = vel.length();
          if (s > 1.5) { sum += a * s; n += s; rows.push({ a, s, t }); }
        }
        prev = tip;
      });
      assert.ok(n > 0, `${kind} ${id}: its blade moves`);
      assert.ok(sum / n < 30, `${kind} ${id}: its edge ${(sum / n).toFixed(0)}° off its cut on average`);
      // (where it cuts hardest: its fastest frames, half its top speed and over; where the swing turns, slow, the edge
      // follows it round a few frames late)
      const top = Math.max(...rows.map((r) => r.s)), fast = rows.filter((r) => r.s >= top / 2), worst = fast.reduce((b, r) => (r.a > b.a ? r : b));
      assert.ok(worst.a < 50, `${kind} ${id}: its edge ${worst.a.toFixed(0)}° off its cut at ${worst.t.toFixed(2)} s (${worst.s.toFixed(0)} m/s)`);
    }
    foes.remove(f);
  }
});

test('no fist in the ground: knocked down (falling, lying, getting up) or asleep', () => {
  for (const kind of Object.keys(WEAPON)) {
    for (const mode of ['down', 'sleep']) {
      const f = make(kind), M = f.model, J = M.joints;
      let low = Infinity, where = '';
      const check = (label) => {
        for (let h = 0; h < 2; h++) {
          const F = M.fists?.[h], pts = [J.hands[h].getWorldPosition(v()), J.hands[h].localToWorld(M.wield.haftAt(h, 0.03, v()))];
          if (F) pts.push(F.knuckles.getWorldPosition(v()), F.tips.getWorldPosition(v()), F.tips.localToWorld(v(0, F.spec.E[0] - F.spec.M[0], F.spec.E[1] - F.spec.M[1])));
          for (const p of pts) if (p.y < low) { low = p.y; where = `${label}, the ${h ? 'left' : 'right'} hand`; }
        }
      };
      if (mode === 'down') {
        for (let i = 0; ; i++) { f.state = 'recover'; f.downT = 2.6 - i * DT; if (f.downT <= 0) break; look(f); check(`${(i * DT).toFixed(2)} s down`); }
        f.downT = 0;
      } else {
        f.provoked = false; f.state = 'idle'; f.idle = { mode: 'sleep' }; f.sleep = 10;
        for (let i = 0; i < 60; i++) { look(f); if (i > 20) check('asleep'); }
      }
      assert.ok(low > 0, `${kind} ${mode}: a fist ${(low * 100).toFixed(1)} cm into the ground (${where})`);
      foes.remove(f);
    }
  }
});
