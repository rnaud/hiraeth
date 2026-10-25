// Foes called in out of a cloud of darkness (issue #664, src/foe-entrance.js): the cloud's lifecycle, the body grown
// out of it, its mind held until the cloud has thinned, the first telegraph only once it is gone, nothing left after.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Foes } from '../src/foes.js';
import { GameState } from '../src/game-state.js';
import { clearTargets, allTargets } from '../src/targets.js';
import { FoeClouds, ENTRANCE, cloudSize, bodyGrown } from '../src/foe-entrance.js';

const v = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z), DT = 1 / 60;
const flat = { groundAt: () => 0, rayDistance: () => Infinity, rayHit: () => null };
function world() {
  clearTargets();
  const P = { pos: v(0, 0, 0), vel: v(), heading: 0, onGround: true, health: 1, down: null, dead: false, frame: { up: v(0, 1, 0) }, hurt() {}, knockDown() { return true; }, flinch() {} };
  const foes = new Foes({ scene: new THREE.Scene(), level: { spawn: v(0, 0, -500), foes: { waves: true } }, levelId: 'arena', physics: flat, player: P, settings: { enemies: 'normal' }, game: new GameState(null), tool: { drops: { add() {} } } });
  foes.setPractice('');
  return { foes, P };
}

test('the timeline: the cloud gathers before the body, thins after it, and has mostly cleared when the mind wakes', () => {
  assert.equal(cloudSize(0), 0); assert.equal(cloudSize(ENTRANCE.clear), 0);
  assert.equal(bodyGrown(ENTRANCE.gather * 0.9), 0, 'nothing of the body while it gathers');
  assert.equal(cloudSize(ENTRANCE.gather + 0.1), 1, 'the cloud full as the body comes');
  assert.equal(bodyGrown(ENTRANCE.gather + ENTRANCE.grow), 1);
  assert.ok(bodyGrown(ENTRANCE.hold) > 0.95, 'whole by the time it moves');
  assert.ok(cloudSize(ENTRANCE.hold) ** 2 < 0.2, 'the cloud thinned under a fifth of its cover as its mind wakes');
  assert.ok(ENTRANCE.hold < ENTRANCE.clear && ENTRANCE.clear <= ENTRANCE.hold + 0.6, 'gone before its first cool (0.6 s) runs out');
});

test('the clouds: one pooled mesh, blobs swell and are gone after the entrance; repeated calls never grow the scene', () => {
  const scene = new THREE.Scene(), C = new FoeClouds(scene, 60);
  for (let r = 0; r < 6; r++) {
    for (let i = 0; i < 5; i++) C.add(v(i, 0, 0), 1.4, 1.2);
    assert.ok(C.live <= 60, 'never more than its pool');
    for (let t = 0; t < 0.5; t += DT) C.update(DT);
    assert.ok(C.mesh.count > 0);
    for (let t = 0; t < ENTRANCE.clear; t += DT) C.update(DT);
    assert.equal(C.live, 0); assert.equal(C.mesh.count, 0, 'nothing drawn once it has cleared');
    assert.equal(scene.children.length, 1, 'no mesh per cloud');
  }
  C.dispose(); assert.equal(scene.children.length, 0);
});

test('called in: no lock, no cut, no wind-up until the cloud has cleared; the first telegraph starts after it is gone', () => {
  for (const kind of ['blot', 'hound', 'brute', 'machine']) {
    const { foes, P } = world();
    const [f] = foes.spawnKind(kind, { n: 1, dist: 3 });
    assert.ok(f.arriving > 0 && foes.clouds.live > 0, `${kind}: comes out of a cloud`);
    const target = allTargets().find((t) => t.foe === f);
    let t = 0, firstWind = null, lockable = null;
    for (; t < 8 && firstWind === null; t += DT) {
      P.health = 1; foes.update(DT);
      if (lockable === null && target.enabled()) lockable = t;
      if (t < ENTRANCE.gather) assert.ok(f.model.group.scale.x < 0.05 * (f.model.size ?? 1) + 1e-6, `${kind}: hidden while the cloud gathers`);
      if (f.state === 'wind') firstWind = t;
    }
    assert.ok(lockable >= ENTRANCE.hold - DT, `${kind}: lockable at ${lockable?.toFixed(2)} s`);
    assert.ok(firstWind >= ENTRANCE.clear, `${kind}: first wind-up at ${firstWind?.toFixed(2)} s, the cloud gone at ${ENTRANCE.clear} s`);
    foes.dispose();
  }
});

test('spawned again and again: every cloud cleared, nothing left in the scene after', () => {
  const { foes } = world();
  const scene = foes.scene ?? foes.group, count = () => { let n = 0; scene.traverse((o) => { if (o.isMesh) n++; }); return n; };
  foes.spawnKind('blot', { n: 3, dist: 5 });
  for (let t = 0; t < 2; t += DT) foes.update(DT);
  for (const f of foes.list.slice()) foes.remove(f);
  const base = count();
  for (let r = 0; r < 8; r++) { foes.spawnKind('blot', { n: 3, dist: 5 }); for (let t = 0; t < 0.6; t += DT) foes.update(DT); for (const f of foes.list.slice()) foes.remove(f); }
  for (let t = 0; t < 2; t += DT) foes.update(DT);
  assert.equal(foes.clouds.live, 0); assert.equal(foes.clouds.mesh.count, 0);
  assert.equal(count(), base, 'no mesh leaked by the entrances');
  foes.dispose();
});
