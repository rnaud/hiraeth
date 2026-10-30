import test from 'node:test';
import assert from 'node:assert/strict';
import './register-gadgets.js';
import * as THREE from 'three';
import { templeOf } from '../src/temples/attachment.js';
import { createArzach } from '../src/levels/arzach.js';
import { Physics } from '../src/physics.js';
import { Player } from '../src/player.js';
import { game } from '../src/game-state.js';
import { HALL } from '../src/temples/arzach.js';

// The Aerie's Hall of Winds (#216): behind anything solid the wind can't reach you (it used to only behind the screens'
// narrow shelter boxes), and its streaks stop there.
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const DT = 1 / 60;
const quiet = (fn) => { const w = console.warn; console.warn = () => {}; try { return fn(); } finally { console.warn = w; } };
const scene = new THREE.Scene();
const level = quiet(() => createArzach(scene));
const physics = new Physics(scene, level.ground.heightAt ? level.ground : null);
level.init?.(physics);
const rt = templeOf(level, 'arzach') ?? level.temple;
if (!rt.physics) rt.init(physics);   // (as the level's initSteps does in the game: its doors and the like solid)

test('the Aerie (#216): a gust passes you by in the lee of a screen or the far wall, and shoves you in the open', () => {
  game.reset();
  const P = new Player(physics, { spawn: rt.arrival.pos.clone(), dynamic: level.dynamic, health: true });
  const notes = [];
  rt.connect({ player: P, toast: (s) => notes.push(s) });
  let t = 0;
  const frame = () => { t += DT; physics.syncMovers(DT); rt.update(DT, t); P.update(DT, {}, 0); };
  const gust = rt.pieces.find((p) => p.shelters);
  const at = (x, z) => { P.teleport(rt.kit.world(x, 0.05, z), V(0, 1, 0), V(0, 0, 1)); P.vel.set(0, 0, 0); for (let i = 0; i < 20; i++) frame(); };
  const blown = (x, z) => {
    at(x, z);
    gust.t = gust.calm + 0.05;   // (blowing)
    const a = P.pos.clone();
    for (let i = 0; i < 1.2 / DT; i++) frame();
    return P.pos.distanceTo(a);
  };
  // 3 m behind a screen (outside its old shelter box, 2 m deep), and by the far wall off the doorway: still
  assert.ok(blown(4.2, 27.8) < 0.2, 'in a screen’s lee');   // (v1.77: the hall 30 by 66, the screens 9.4 m apart from z 22)
  assert.ok(blown(-5.5, HALL.z0 + HALL.d - 1.6) < 0.2, 'in the far wall’s lee');
  // in the open, and beside a screen, out of its lee: shoved down the hall
  assert.ok(blown(7, 36) > 3, 'in the open');
  assert.ok(blown(0, 18) > 3, 'in the hall’s middle');   // (short of its stone, at z 26.8)
  // the streaks: in the lee none (at their own height), in the open some
  const lanes = gust.leeLanes();
  assert.ok(lanes && lanes.length === gust.streaks.length, 'every streak has its lane');
  const calm = lanes.reduce((n, L) => n + L.lane.reduce((a, b) => a + b, 0), 0), all = lanes.reduce((n, L) => n + L.lane.length, 0);
  assert.ok(calm > all * 0.08 && calm < all * 0.6, `some of the hall is in a lee, not all (${calm} of ${all} samples)`);
  const low = gust.streaks.filter((s) => s.y < 2.5).length;
  assert.ok(low >= gust.streaks.length / 3, `many streaks at a body’s height (${low})`);
});
