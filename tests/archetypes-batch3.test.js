// The enemy roster's batch 3 against its sheets (docs/design/enemy-roster.md "Status"; issue #29): the skitters' curved
// bony legs (a bowed shin in its own bend plane: src/motion-kit/rig.js jointedLeg's bow), the heron flying off when you
// run at it (Foe.takeOff, calm.flee), the toad's swollen sac see-through with the glob inside it.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Foe } from '../src/foes.js';
import { archetypeModel } from '../src/enemies/plans/index.js';

const v = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const DT = 1 / 60;
const env = { ground: () => 0, seen: () => true };
const player = (at, vel = v()) => ({ pos: at, vel, heading: 0, onGround: true, health: 1, down: null, dead: false, hurt() {}, knockDown() { return true; }, flinch() {} });
const run = (f, P, secs, e = env) => { const ev = []; for (let i = 0; i < secs / DT; i++) ev.push(...f.update(DT, P, e)); return ev; };

test('the skitter\'s legs are bowed: each thigh and shin bends in the leg\'s own plane', () => {
  for (const skin of ['desert', 'moonfoundry']) {
    const m = archetypeModel('skitter', skin);
    assert.ok(m.rig.legs.length === 6 && m.rig.legs.every((l) => l.bowed), `${skin}: six bowed legs`);
    m.dispose?.();
  }
});

test('the heron: walk up and it strides away; run at it and it takes off, flies away and lands at a new home', () => {
  // walked up to: it backs off, on the ground
  const w = new Foe('heron', v(), { rng: () => 0.5, calm: true });
  const Pw = player(v(0, 0, -6), v(0, 0, 1.5));
  run(w, Pw, 1);
  assert.ok(!w.flight && w.pos.y === 0 && w.pos.z > 0, 'walked up to, it strides away');
  // run at: it crouches, takes off up into the air and lands 13 m away from you, its home there
  const h = new Foe('heron', v(), { rng: () => 0.5, calm: true }), home = h.home.clone();
  const P = player(v(0, 0, -6), v(0, 0, 5));
  run(h, P, DT * 2);
  assert.ok(h.flight, 'run at, it takes off');
  let top = 0;
  const ev = [];
  for (let i = 0; i < 4 / DT && (h.flight || !ev.length); i++) { ev.push(...h.update(DT, P, env)); top = Math.max(top, h.pos.y); }
  assert.ok(top > 2.5, `up in the air (${top.toFixed(2)} m)`);
  assert.ok(!h.flight && ev.some((e) => e.type === 'hop' && e.how === 'fly'), 'it lands');
  assert.ok(h.pos.z > 10 && h.home.distanceTo(home) > 10 && h.home.distanceTo(h.pos) < 1e-6, 'away from you, its new home');
  assert.ok(!h.provoked && h.state === 'idle', 'still calm');
  // no ground to land on that way or to either side: it stays and backs off
  const s = new Foe('heron', v(), { rng: () => 0.5, calm: true });
  run(s, player(v(0, 0, -6), v(0, 0, 5)), DT * 2, { ground: (x, y, z) => (Math.hypot(x, z) > 6 ? null : 0), seen: () => true });
  assert.ok(!s.flight, 'nowhere to land: no flight');
  // cut in the air, it falls and fights
  const c = new Foe('heron', v(), { rng: () => 0.5, calm: true });
  run(c, P, DT * 2); run(c, P, 1.2);
  assert.ok(c.flight && c.pos.y > 1);
  c.hit('blade', v(0, 0, 1), { damage: 1 });
  assert.ok(!c.flight && c.air && c.provoked, 'struck in the air, it falls, provoked');
});
