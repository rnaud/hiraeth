// Swoosh trails on the foes' attacks (issue #663, src/attack-trail.js): the phase read from the attack's own timing,
// the strike's ribbon the widest and warm, the recovery thinning it away, one pool for every foe, nothing left after.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Foes } from '../src/foes.js';
import { GameState } from '../src/game-state.js';
import { clearTargets } from '../src/targets.js';
import { AttackTrails, TRAIL, trailPhase, trailLook, trailTaper, trailSide } from '../src/attack-trail.js';

const v = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z), DT = 1 / 60;
const flat = { groundAt: () => 0, rayDistance: () => Infinity, rayHit: () => null };
// (the fights' picks seeded: unseeded, the brute backed off and lobbed its hurl, no ribbon, for 16 s in 3% of runs)
const seeded = (s = 7) => () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; };
function world() {
  clearTargets();
  const P = { pos: v(0, 0, 0), vel: v(), heading: 0, onGround: true, health: 1, down: null, dead: false, frame: { up: v(0, 1, 0) }, hurt() {}, knockDown() { return true; }, flinch() {} };
  const foes = new Foes({ scene: new THREE.Scene(), level: { spawn: v(0, 0, -500), foes: { waves: true } }, levelId: 'arena', physics: flat, player: P, settings: { enemies: 'normal' }, game: new GameState(null), tool: { drops: { add() {} } }, rng: seeded() });
  foes.setPractice('');
  return { foes, P };
}

test('the phase follows the attack timing: wind-up ink, the strike active until its hit is checked, then spent, nothing in recovery', () => {
  const a = { id: 'x', wind: 1, strike: 0.3, contact: 0.5 };
  assert.equal(trailPhase({ state: 'wind', atk: a, k: 0.4 }), 'wind');
  assert.equal(trailPhase({ state: 'strike', atk: a, contacted: false }), 'active');
  assert.equal(trailPhase({ state: 'strike', atk: a, contacted: true }), 'spent');
  for (const state of ['recover', 'chase', 'idle', 'home']) assert.equal(trailPhase({ state, atk: a }), null, state);
  assert.equal(trailPhase({ state: 'strike', atk: a, stunned: 1 }), null, 'a blow broken off lays nothing');
  assert.equal(trailPhase({ state: 'wind', atk: { ...a, lob: true } }), null, 'a lob is read from its mark and its glob');
  assert.equal(trailPhase({ state: 'wind', atk: { ...a, instant: true } }), null);
  assert.equal(trailLook('wind'), 'wind'); assert.equal(trailLook('active'), 'active'); assert.equal(trailLook('spent'), 'active');
  assert.ok(TRAIL.width.active > TRAIL.width.spent && TRAIL.width.spent > TRAIL.width.wind, 'the dangerous part the widest');
  assert.equal(trailTaper(0, 0.3), 1); assert.equal(trailTaper(0.3, 0.3), 0); assert.ok(trailTaper(0.15, 0.3) < 1);
});

test('the ribbon lies in the plane the part swings through, and stands up for a straight lunge', () => {
  const s = trailSide(v(1, 1, 0), v(0, 1, 0), v(0, 0, 1));
  assert.ok(Math.abs(s.x + 1) < 1e-6, 'toward the body, square to the swing');
  const up = trailSide(v(0, 1, 1), v(0, 1, 0), v(0, 0, 1));
  assert.ok(Math.abs(up.y - 1) < 1e-6, 'a lunge straight ahead: up');
});

test('a pool: laid, released, thinned away; ribbons reused, nothing made per attack, all let go on dispose', () => {
  const scene = new THREE.Scene(), T = new AttackTrails(scene, 3), f = {}, g = {};
  for (let i = 0; i < 12; i++) { T.follow(f, 'active', v(i * 0.1, 1, 0), v(0, 1, -1)); T.update(DT); }
  const R = T.of.get(f);
  assert.ok(R.length > 0.5 && R.widest > TRAIL.width.active * 0.5, 'the strike drawn wide');
  assert.equal(R.body.mesh.material, T.ribbons[0].body.mesh.material);
  T.follow(f, 'wind', v(2, 1, 0), v(0, 1, -1));
  assert.notEqual(T.of.get(f), R, 'a new look starts a new ribbon');
  T.follow(f, null, v(), v()); T.follow(g, 'active', v(), v(0, 1, -1));
  for (let t = 0; t < TRAIL.fade + 0.4; t += DT) T.update(DT);
  assert.equal(R.shown, false, 'the recovery thins it to nothing');
  for (let k = 0; k < 20; k++) { const h = {}; T.follow(h, 'active', v(), v(0, 1, -1)); T.follow(h, 'active', v(1, 0, 0), v(0, 1, -1)); T.release(h); }
  assert.ok(T.ribbons.length <= 3, 'never more than its pool');
  T.dispose();
  assert.equal(scene.children.length, 0);
});

test('in play: every melee attack of a few kinds lays a warm ribbon through its strike, and the foe gone leaves none', () => {
  for (const kind of ['blot', 'machine', 'hound', 'brute', 'shade']) {
    const { foes, P } = world();
    const f = foes.add(kind, v(0, 0, 3)); f.state = 'chase';
    const seen = { wind: 0, active: 0 };
    let order = '';
    for (let t = 0; t < 16; t += DT) {
      P.health = 1; foes.update(DT);
      const ph = trailPhase(f), R = foes.trails?.of.get(f);
      if (ph && order.at(-1) !== ph[0]) order += ph[0];
      if (ph && R) seen[trailLook(ph)] = Math.max(seen[trailLook(ph)], R.length);
    }
    assert.ok(seen.active > 0.4, `${kind}: a strike ribbon (${seen.active.toFixed(2)} m)`);
    assert.match(order, /wa/, `${kind}: wind-up before the strike (${order})`);
    foes.remove(f);
    for (let t = 0; t < 1; t += DT) foes.update(DT);
    assert.equal(foes.trails.drawn, 0, `${kind}: nothing drawn after it is gone`);
    foes.dispose();
  }
});
