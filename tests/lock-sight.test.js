// Issue #313: no lock on a foe behind a shut door, a lock let go once its foe has gone behind one, no blow through one.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Foes, LOCK_SIGHT, lockSight } from '../src/foes.js';
import { Physics } from '../src/physics.js';
import { clearTargets } from '../src/targets.js';
import { GameState } from '../src/game-state.js';

const v = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const player = (at = v()) => ({ pos: at, vel: v(), heading: 0, onGround: true, health: 1, down: null, dead: false, hurt() {}, knockDown() { return true; }, flinch() {} });

/** A floor, and a shut door (a doorway's block, added as a temple door adds its own: src/temples/pieces.js) across z = 4. */
function world() {
  const scene = new THREE.Scene();
  const floor = new THREE.Mesh(new THREE.BoxGeometry(80, 0.2, 80), new THREE.MeshBasicMaterial());
  floor.position.y = -0.1; scene.add(floor);
  const physics = new Physics(scene);
  const door = new THREE.Mesh(new THREE.BoxGeometry(12, 6, 0.4), new THREE.MeshBasicMaterial());
  door.position.set(0, 3, 4); door.updateMatrixWorld(true);
  return { physics, door, shut: () => physics.addCollider(door) };
}
function setup(physics) {
  clearTargets();
  const P = player(v());
  const camera = new THREE.PerspectiveCamera(60, 16 / 9, 0.1, 500);
  camera.position.set(0, 2, -4); camera.lookAt(0, 1, 4); camera.updateMatrixWorld(); camera.updateProjectionMatrix();
  const foes = new Foes({ scene: new THREE.Scene(), level: { spawn: v(0, 0, -500), foes: { waves: true } }, levelId: 'arena', physics, player: P, settings: { enemies: 'normal' }, game: new GameState(null), camera });
  foes.waveRest = 1e9;
  return { P, foes };
}

test('lockSight: a ray from any eye that reaches the body; none through a wall', () => {
  const { physics, shut } = world();
  assert.ok(lockSight(physics, [v(0, 1.5, 0)], v(0, 1, 8)), 'open way: seen');
  shut();
  assert.equal(lockSight(physics, [v(0, 1.5, 0), v(0, 2, -4)], v(0, 1, 8)), false, 'behind the door: hidden from both');
  assert.ok(lockSight(physics, [v(0, 1.5, 0), v(0, 2, 6)], v(0, 1, 8)), 'one eye past it: seen');
  assert.ok(lockSight(null, [v()], v(0, 0, 9)), 'no physics: seen');
});

test('#313: no lock through a shut door; the one this side is taken, and the door opened, the one beyond', () => {
  const { physics, shut } = world();
  const handle = shut();
  const { foes } = setup(physics);
  const beyond = foes.add('blot', v(0, 0, 8));
  assert.equal(foes.cycleLock(), null, 'the only foe is behind the door');
  const here = foes.add('blot', v(1, 0, 3));
  assert.equal(foes.cycleLock(), here);
  assert.equal(foes.cycleLock(), null, 'the next one is behind the door: the lock lets go rather than take it');
  physics.removeCollider(handle);
  assert.equal(foes.cycleLock(), here);
  assert.equal(foes.cycleLock(), beyond, 'the door open: the one beyond');
  foes.dispose(); clearTargets();
});

test('#313: a locked foe gone behind a door is let go after the grace, not at once', () => {
  const { physics, shut } = world();
  const { foes } = setup(physics);
  const f = foes.add('blot', v(0, 0, 8));
  assert.equal(foes.cycleLock(), f);
  shut();
  const dt = 1 / 30;
  for (let t = 0; t < LOCK_SIGHT.grace * 0.6; t += dt) foes.updateLock(dt);
  assert.equal(foes.lock, f, 'a moment out of sight: held');
  for (let t = 0; t < LOCK_SIGHT.grace + LOCK_SIGHT.every; t += dt) foes.updateLock(dt);
  assert.equal(foes.lock, null, 'out of sight past the grace: let go');
  foes.dispose(); clearTargets();
});

test('#313: a foe behind a shut door neither notices you nor begins a blow through it', () => {
  const { physics, shut } = world();
  shut();
  const { P, foes } = setup(physics);
  const f = foes.add('blot', v(0, 0, 5));
  P.pos.set(0, 0, 3);   // (a step off it, the door between)
  assert.equal(foes.env.mayStrike(f), false, 'no blow through the door');
  f.state = 'chase'; f.cool = 0;   // (even one already after you)
  for (let i = 0; i < 90; i++) { foes.update(1 / 30); assert.ok(f.state !== 'wind' && f.state !== 'strike', 'it never winds up at you through the door'); }
  foes.dispose(); clearTargets();
});
