import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import './register-gadgets.js';
import { LEVELS } from '../src/levels/index.js';
import { CONTENT } from '../src/levels/content.js';
import { ORDER } from '../src/levels/names.js';
import { Physics } from '../src/physics.js';
import { Waters } from '../src/water.js';
import { TRIALS, trialsFor } from '../src/trials/data.js';
import { courtOf } from '../src/finds/courts.js';
import { partsOf } from '../src/levels/names.js';
import { checkCourse } from '../src/trials/check.js';
import { createTrials } from '../src/trials/index.js';
import { COURTS, COURT } from '../src/finds/courts.js';
import { clearInteractables, allInteractables } from '../src/interact.js';
import { clearTargets } from '../src/targets.js';
import { clearWorkings } from '../src/workings.js';
import { GameState } from '../src/game-state.js';

// Every route world as main.js builds it (its temple, its makers' court), with real collision and water: the
// court stands clear of the world's people and its gadget's pieces are the world's to play with; the trial's
// course is fair (src/trials/check.js: every gate in the open, the way between them clear, a ride rideable,
// a glide glidable) and its sign stands on the ground, ready to open.

const quiet = (f) => { const w = console.warn, i = console.info; console.warn = console.info = () => {}; try { return f(); } finally { console.warn = w; console.info = i; } };
const V = (x, y, z) => new THREE.Vector3(x, y, z);

for (const id of ORDER) {
  test(`${id}: its makers’ court and its trial`, () => {
    clearInteractables(); clearTargets(); clearWorkings();
    const meta = LEVELS.find((l) => l.id === id);
    const scene = new THREE.Scene();
    const level = quiet(() => meta.create(scene));
    const physics = new Physics(scene, level.ground.heightAt ? level.ground : null);
    quiet(() => level.init?.(physics));
    const waters = quiet(() => new Waters(scene, { physics, drops: false }));
    const surfaceAt = (x, z, y, b) => waters.surfaceAt(x, z, y, b);
    // the courts (a merged world has its parts': src/levels/names.js PARTS)
    const parts = partsOf(id);
    for (const part of parts) {
    const C = courtOf(part);
    if (C) {
      const court = level.finds?.courts?.[part];
      assert.ok(court, `${part}: the court is built`);
      assert.equal(court.gadget, C.gadget);
      const [x, y, z] = court.box.at;
      const g = physics.groundAt(x, y + 1.5, z, 4);
      assert.ok(Math.abs(g - y) < 0.2, `the box stands on the pavement (${g.toFixed(2)} vs ${y.toFixed(2)})`);
      const o = court.frame.origin;
      for (const n of CONTENT[id]?.npcs ?? []) if (n.at) assert.ok(Math.hypot(n.at[0] - o.x, (n.at.length === 2 ? n.at[1] : n.at[2]) - o.z) > COURT.clear, `${n.id ?? 'someone'} is clear of it`);
      assert.ok(!(surfaceAt(o.x, o.z, o.y + 5, 10)?.y > o.y), 'not under water');
      const W = level.gadgetWorld ?? {};
      const n = ['props', 'breakables', 'anchors', 'plates', 'ropes', 'pickups', 'pinwheels'].reduce((s, k) => s + (W[k]?.length ?? 0), 0);
      assert.ok(n > 0 || C.gadget === 'bridge' || C.gadget === 'monocle' || C.gadget === 'springs', `${C.gadget}: its pieces join the world (${n})`);
    } else assert.equal(level.finds?.court, undefined, 'no court in the desert (its box is the backpack’s)');
    }
    // the trials (each part's, where it lies in the world)
    const trials = trialsFor(id);
    assert.equal(trials.length, parts.length, 'a trial for every part');
    for (const T of trials) assert.deepEqual(checkCourse(T, { physics, surfaceAt }), [], `${T.name}: a fair course`);
    const T = trials[0];
    const game = new GameState();
    const items = { has: () => true, grant() {} };
    const world = createTrials({ levelId: id, scene, physics, level, player: { pos: V(0, 0, 0), mount: { kind: MODE_MOUNT[T.mode] ?? 'none' } }, items, game, surfaceAt });
    assert.ok(Number.isFinite(world.sign.position.y), 'its sign stands somewhere');
    assert.ok(allInteractables().some((e) => e.id === `trial.${T.world}`), 'and opens its card');
    assert.equal(world.lacks(), '');
    assert.ok(world.par > 10, `a par (${world.par} s)`);
    world.dispose();
  });
}
const MODE_MOUNT = { bike: 'bike', skiff: 'skiff', bird: 'bird' };
