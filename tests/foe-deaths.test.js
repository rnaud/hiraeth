// A death that fits each body, and nothing ends on its side (issue #767, src/enemies/defeat.js): every archetype has its
// death; no recipe flips or rolls a body over; going down, no root is tipped more than SIDE onto a side (the moth and the
// drone spiral down level, the centipede's plates sink flat, the crawler's dome comes down flat); a humanoid past the
// ragdolls' cap falls the way it was struck; a struck-down humanoid's ragdoll lies on its front or its back.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Foes } from '../src/foes.js';
import { GameState } from '../src/game-state.js';
import { clearTargets } from '../src/targets.js';
import { resetFeel } from '../src/feel.js';
import { ARCHETYPES } from '../src/enemies/archetypes.js';
import { DEFEATS, DEATHS } from '../src/enemies/defeat.js';
import { RAGDOLL } from '../src/enemies/foe-ragdoll.js';
import { J as RJ } from '../src/ragdoll.js';

const v = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z), DT = 1 / 60;
const SIDE = Math.sin((25 * Math.PI) / 180);   // (the most a body's own across may tip up or down: 25°)
const seeded = (s) => () => ((s = (s * 16807) % 2147483647) / 2147483647);
function world() {
  clearTargets(); resetFeel();
  const P = { pos: v(0, 0, -30), vel: v(), heading: 0, onGround: true, health: 1, frame: { up: v(0, 1, 0) }, hurt() {}, knockDown() { return true; }, flinch() {} };
  const foes = new Foes({ scene: new THREE.Scene(), level: { spawn: v(0, 0, -500), foes: { waves: true } }, levelId: 'arena', physics: { groundAt: () => 0, rayDistance: () => Infinity, rayHit: () => null }, player: P, settings: { enemies: 'normal' }, game: new GameState(null), rng: seeded(11), tool: { drops: { add() {} } } });
  foes.setPractice('');
  return { foes, done: () => { foes.dispose(); clearTargets(); } };
}
const kill = (foes, f, dir) => { f.hp = 0.1; f.state = 'recover'; f.timer = 0.5; f.buried = false; return foes.hurt(f, 'blade', dir, { damage: 9, combo: 2 }, f.chest.clone()); };
// how far an object's own across (its +x) is tipped up or down: the sine of its roll onto a side
const _x = v();
const side = (o) => Math.abs(_x.set(1, 0, 0).transformDirection(o.matrixWorld).y);

test('every archetype has a death that fits its body, and none flips or rolls over', () => {
  const bodies = new Set(['beast', 'long', 'plant', 'shell', 'burrower', 'flyer', 'machine', 'spirit', 'humanoid']);
  for (const id of Object.keys(ARCHETYPES)) {
    assert.ok(DEFEATS[id], `${id} has a recipe`);
    assert.ok(bodies.has(DEATHS[id]), `${id} dies as a ${DEATHS[id]}`);
    assert.ok(!DEFEATS[id].flip && !DEFEATS[id].roll, `${id}: no flip onto its back, no roll onto its side`);
  }
});

test('going down, no archetype tips onto its side (the recipe\'s fall, the ragdolls held off)', () => {
  const most = RAGDOLL.most;
  RAGDOLL.most = 0;
  try {
    for (const id of Object.keys(ARCHETYPES)) {
      const kind = ARCHETYPES[id].kind;
      for (const dir of [v(0, 0, 1), v(1, 0, 0)]) {
        const { foes, done } = world();
        const f = foes.add(kind, v(0, 0, 0)); f.heading = 0.4;
        for (let i = 0; i < 20; i++) foes.update(DT);
        kill(foes, f, dir);
        if (!f.dying) { done(); continue; }   // (gone at once: a burrower under the sand)
        let worst = 0, part = '';
        for (let t = 0; t < 2 && foes.list.includes(f) && f.dead === undefined; t += DT) {
          foes.update(DT);
          const g = f.model.group;
          g.updateMatrixWorld(true);
          if (side(g) > worst) { worst = side(g); part = 'its root'; }
          // (and its body as its own pose turns it, the crab's flip, the heron's topple, once the blow's own flinch, a
          // recoil of a few tenths of a second, has passed: how it ends up)
          const B = f.model.body;
          if (f.dying.u > 0.5 && B?.isObject3D && B !== g && side(B) > worst) { worst = side(B); part = 'its body'; }
          // (the centipede's plates and head are in the foes' space, each its own)
          if (id === 'centipede') for (const p of f.model.parts) if (p.visible && side(p) > worst) { worst = side(p); part = p.name || 'a plate'; }
        }
        assert.ok(worst < SIDE, `${id} struck along ${dir.toArray()}: ${part} tipped ${(Math.asin(Math.min(1, worst)) * 180 / Math.PI).toFixed(0)}° onto a side`);
        done();
      }
    }
  } finally { RAGDOLL.most = most; }
});

test('a humanoid past the ragdolls\' cap falls the way the blow pushed it: back when struck from in front', () => {
  const most = RAGDOLL.most;
  RAGDOLL.most = 0;
  try {
    for (const [dir, way] of [[v(0, 0, -1), -1], [v(0, 0, 1), 1]]) {
      const { foes, done } = world();
      const f = foes.add('grunt', v(0, 0, 0)); f.heading = 0;   // (facing +z: a push along -z is a blow from in front)
      for (let i = 0; i < 10; i++) foes.update(DT);
      kill(foes, f, dir);
      for (let t = 0; t < 0.95 && f.dead === undefined; t += DT) foes.update(DT);
      const pitch = f.dying.pose.pitch;
      assert.ok(Math.sign(pitch) === way && Math.abs(pitch) > 0.8, `struck along ${dir.z}: toppled ${pitch.toFixed(2)} rad`);
      done();
    }
  } finally { RAGDOLL.most = most; }
});

test('a struck-down humanoid\'s ragdoll lies on its front or its back, not on its side', () => {
  let worst = 0, who = '';
  for (const kind of ['grunt', 'hulk', 'prowler', 'warlord', 'sentinel', 'fencer', 'mummer', 'mummerking']) {
    for (const dir of [v(0, 0, 1), v(1, 0, 0), v(-0.6, 0, -0.8)]) {
      const { foes, done } = world();
      const f = foes.add(kind, v(0, 0, 0)); f.heading = Math.PI;
      for (let i = 0; i < 10; i++) foes.update(DT);
      kill(foes, f, dir);
      const R = f.dying?.rag;
      assert.ok(R, `${kind} ragdolls`);
      for (let t = 0; t < 2 && !R.asleep && foes.list.includes(f); t += DT) foes.update(DT);
      // (its hips' line level, or nearly: on its side one hip is over the other)
      const x = R.rag.x, across = v().subVectors(x[RJ.hipL], x[RJ.hipR]).normalize();
      if (Math.abs(across.y) > worst) { worst = Math.abs(across.y); who = `${kind} struck along ${dir.toArray()}`; }
      done();
    }
  }
  assert.ok(worst < Math.sin((50 * Math.PI) / 180), `${who}: its hips tipped ${(Math.asin(worst) * 180 / Math.PI).toFixed(0)}°`);
});
