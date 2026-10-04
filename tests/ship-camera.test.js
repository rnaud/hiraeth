import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Physics } from '../src/physics.js';
import { Player, CameraRig } from '../src/player.js';
import { Ship } from '../src/ship/ship.js';
import { DECK } from '../src/ship/hull.js';
import { SKIRT } from '../src/ship/model.js';

// The close camera in the ship's rooms (players: "the camera clips into everything, and bugs out
// when I'm moving around"): turning round on the spot anywhere aboard, the lens stays clear of the
// walls, the bunks and the furniture, and the view does not jump about.

globalThis.window ??= { addEventListener() {} };
const dom = { addEventListener() {} };
const v = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const quiet = (fn) => { const w = console.warn; console.warn = () => {}; try { return fn(); } finally { console.warn = w; } };

function shipWorld() {
  const scene = new THREE.Scene();
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(400, 400).rotateX(-Math.PI / 2)));
  const physics = new Physics(scene);
  const level = { spawn: v(0, 0, 60), ground: { heightAt: () => 0 }, lights: [], shipSite: { x: 0, z: 0, heading: Math.PI / 2 } };
  const ship = quiet(() => new Ship({ scene, physics, level, levelId: 'test', content: { npcs: [], relics: { spots: [] } } }));
  const camera = new THREE.PerspectiveCamera(65, 16 / 9, 0.3, 5000);
  const rig = new CameraRig(camera, dom, physics);
  rig.indoor = true;
  return { scene, physics, ship, rig, camera };
}

/** Geometry within the near plane's reach of the lens (in front of it or beside it). */
function lensClipped(physics, camera) {
  const c = camera.position, fwd = camera.getWorldDirection(v());
  for (const x of [-1, 0, 1]) for (const y of [-1, 0, 1]) for (const z of [-1, 0, 1]) {
    if (!x && !y && !z) continue;
    const d = v(x, y, z).normalize();
    if (d.dot(fwd) > -0.2 && physics.rayDistance(c, d, 0.3) < 0.3) return true;
  }
  return false;
}

const SPOTS = { bunk: 'bunkStand', hall: 'hatchIn', cockpit: 'cockpit', corridor: [2.4, 0.3], corridor2: [2.4, 2.2], galley: [6.5, 4.7], bunkroom: [6.0, 0.3] };

test('turning round anywhere in the ship: the lens never cuts into walls or furniture, and the view does not jump', () => {
  const { physics, ship, rig, camera } = shipWorld();
  const m = ship.parked, dt = 1 / 60;
  const report = [];
  for (const [name, at] of Object.entries(SPOTS)) {
    const l = typeof at === 'string' ? m.interior.points[at].clone() : v(Math.sin(at[1]) * at[0], DECK, Math.cos(at[1]) * at[0]);
    const p = ship.world(m, l);
    rig.target.copy(p);
    rig.snapTight(p);
    for (let i = 0; i < 40; i++) rig.update(p, dt);
    let clipped = 0, jumps = 0, frames = 0;
    const last = camera.position.clone();
    // a full turn in 6 s, as a stick would
    for (let i = 0; i < 6 * 60; i++) {
      rig.look(-(Math.PI * 2 / 360) / 0.0025, 0);
      rig.update(p, dt);
      frames++;
      if (lensClipped(physics, camera)) clipped++;
      if (camera.position.distanceTo(last) > 0.35) jumps++;
      last.copy(camera.position);
    }
    report.push(`${name}: clipped ${clipped}/${frames}, jumps ${jumps}`);
    assert.ok(clipped <= frames * 0.02, `${name}: the lens clear of the room (${report.at(-1)})`);
    assert.ok(jumps <= 8, `${name}: no more than a few quick cuts in (${report.at(-1)})`);
  }
});

test('the floor stops at the foot of the curved hull: you cannot walk up the wall of the rooms', () => {
  const { physics, ship } = shipWorld();
  const m = ship.parked;
  const player = new Player(physics, { climb: false });
  for (const a of [0.3, 2.0, 3.6, 5.2]) {
    const start = ship.world(m, v(Math.sin(a) * 7.2, DECK + 0.05, Math.cos(a) * 7.2));
    player.respawn(start);
    const dir = v(Math.sin(a), 0, Math.cos(a)).applyQuaternion(m.group.quaternion);
    const yaw = Math.atan2(-dir.x, -dir.z);   // the camera behind, the stick forward walks outward
    for (let i = 0; i < 4 * 60; i++) player.update(1 / 60, { KeyW: true }, yaw);
    const l = ship.local(m, player.pos);
    assert.ok(l.y < DECK + 0.25, `at ${a}: still on the floor (${(l.y - DECK).toFixed(2)} m up)`);
    assert.ok(Math.hypot(l.x, l.z) < 8.9, `at ${a}: not out into the hull`);
  }
  assert.ok(SKIRT > 0.6 && SKIRT < 1.4, 'the skirting is over a step and under the camera');
});
