// The crash landing, from the playtest of 8 October 2026 (src/ship/landing.js): nobody talks while the
// ship is still coming down, the one who waits at the wreck stands well clear of it, and stepping out
// doesn't take you straight back in; boarding is your own walk up the ramp (no "go aboard" button, issue #87; no walk the
// ship takes over, issue #775), on both hulls.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { readFileSync } from 'node:fs';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { talkAllowed, bystanderSpot, inFurrow, planGap, BYSTANDER } from '../src/ship/landing.js';
import { Ship } from '../src/ship/ship.js';
import { Physics } from '../src/physics.js';
import { Player } from '../src/player.js';
import { game } from '../src/game-state.js';

const quiet = (fn) => { const w = console.warn; console.warn = () => {}; try { return fn(); } finally { console.warn = w; } };

test('no balloons or talk prompts while a ship’s scene plays (the crash, a landing, a recording)', () => {
  assert.equal(talkAllowed({ shipPlaying: true }), false);
  assert.equal(talkAllowed({ shipPlaying: false }), true);
  assert.equal(talkAllowed(), true);
});

test('whoever waits at the wreck stands well clear of the hull and out of its furrow, near the hatch’s side', () => {
  for (let k = 0; k < 16; k++) {
    const heading = (k / 16) * Math.PI * 2, out = { x: Math.sin(heading), z: Math.cos(heading) };
    for (const travel of [0, Math.PI / 2, Math.PI, -Math.PI / 3, null]) {
      const hull = { x: 30, z: -12 };
      const p = bystanderSpot({ out, hull, travel });
      const d = Math.hypot(p.x - hull.x, p.z - hull.z), gap = planGap(p.x - hull.x, p.z - hull.z, out);
      assert.ok(gap >= BYSTANDER.clear - 1e-6 && gap >= 6, `well clear of the hull (${gap.toFixed(1)} m from its plan, ${d.toFixed(1)} m from its origin)`);
      if (travel !== null) assert.ok(!inFurrow(p.x - hull.x, p.z - hull.z, travel), 'not where it ploughed in');
      // seen as you step out: on the hatch's side whenever the furrow leaves room there
      if (travel === null) assert.ok(((p.x - hull.x) * out.x + (p.z - hull.z) * out.z) / d > 0.6, 'in front of the hatch');
    }
  }
  // the desert's own wreck: it slid along heading PI (src/ship/sites.js), hatch facing the city
  const p = bystanderSpot({ out: { x: 1, z: 0 }, hull: { x: 0, z: 0 }, travel: Math.PI });
  assert.ok(Math.hypot(p.x, p.z) >= BYSTANDER.dist - 0.01);
  assert.ok(p.x > 0, 'on the ramp’s side');
});

test('the ship: no “go aboard” at the ramp; walking into it takes you in, but not right after stepping out (issue #87)', () => {
  const scene = new THREE.Scene();
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(400, 400).rotateX(-Math.PI / 2)));
  const physics = new Physics(scene);
  const level = { spawn: new THREE.Vector3(0, 0, 60), ground: { heightAt: () => 0 }, lights: [], shipSite: { x: 0, z: 0, heading: Math.PI / 2 } };
  const ship = quiet(() => new Ship({ scene, physics, level, levelId: 'test', content: { npcs: [] } }));
  ship.player = new Player(physics);
  ship.camera = new THREE.PerspectiveCamera();
  ship.rig = { indoor: false };
  const m = ship.parked;
  const frame = () => quiet(() => ship.update(1 / 60, 0, {}));
  // aboard, then out at the foot of the ramp (as the prologue and every arrival leave you)
  ship.placePlayer(ship.world(m, m.interior.points.hatchIn), 0, true);
  frame();
  assert.ok(ship.inside);
  ship.placePlayer(ship.rampFoot.clone().addScaledVector(ship.outDir, 2.2), 0, true);
  frame();
  assert.ok(ship.atRampFoot(), 'standing at the ramp’s foot');
  assert.equal(ship.hud(), null, 'no “go aboard” right after stepping out');
  assert.ok(ship.input({ KeyE: true }).KeyE, 'and E is the player’s (talk, pick up), not the hatch');
  ship.input({});
  // off into the desert, and back
  ship.placePlayer(ship.rampFoot.clone().addScaledVector(ship.outDir, 12), 0, true);
  frame();
  ship.placePlayer(ship.rampFoot.clone(), 0, true);
  frame();
  assert.equal(ship.hud(), null, 'back at the ramp: no prompt, no button');
  assert.ok(ship.input({ KeyE: true }).KeyE && !ship.auto, 'E is still the player’s');
  ship.input({});
  // walking up into it: still yours (issue #775: the ship no longer takes the stick and walks you up)
  const inward = ship.hinge.clone().sub(ship.rampFoot).setY(0).normalize();
  ship.player.vel.copy(inward).multiplyScalar(3);
  const ctl = ship.input({ KeyW: true });
  assert.ok(ctl.KeyW && !ctl.stick && !ship.auto, 'walking into the ramp: the stick stays the player’s');
});

let caravanTemplate;
async function caravan() {
  if (!caravanTemplate) {
    const b = readFileSync(new URL('../public/models/ships/caravan-a/playable.glb', import.meta.url));
    caravanTemplate = (await new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), '')).scene;
  }
  return caravanTemplate;
}

for (const kind of ['caravan', 'original']) {
  test(`boarding the ${kind} is your own walk: up the ramp on your feet, aboard once in the rooms (issue #775)`, async () => {
    globalThis.window ??= { addEventListener() {} };
    const scene = new THREE.Scene();
    scene.add(new THREE.Mesh(new THREE.PlaneGeometry(400, 400).rotateX(-Math.PI / 2)));
    const physics = new Physics(scene);
    const level = { spawn: new THREE.Vector3(0, 0, 60), ground: { heightAt: () => 0 }, lights: [], shipSite: { x: 0, z: 0, heading: Math.PI / 2 } };
    const model = kind === 'caravan' ? await caravan() : null;
    const ship = quiet(() => new Ship({ caravan: model, scene, physics, level, levelId: 'test', content: { npcs: [] } }));
    const P = (ship.player = new Player(physics));
    P.opts.climb = false;
    ship.camera = new THREE.PerspectiveCamera();
    ship.rig = { indoor: false, yaw: 0 };
    ship.sound = {};
    // 4 m out from the foot of the ramp, walking straight at the hatch with the stick held: what the player presses is
    // what reaches him every frame, the ship never takes it over
    const out = ship.rampFoot.clone().sub(ship.hinge).setY(0).normalize();
    ship.placePlayer(ship.rampFoot.clone().addScaledVector(out, 4), 0, true);
    const target = ship.world(ship.parked, ship.parked.interior.points.aboard);
    let entered = 0;
    const off = game.on('ship:enter', () => entered++);
    let i = 0;
    for (; i < 1200 && !ship.inside; i++) {
      physics.syncMovers?.(1 / 60);
      const ctl = ship.input({ KeyW: true });
      assert.ok(ctl.KeyW && !ctl.stick, `frame ${i}: the stick is the player’s`);
      assert.equal(ship.auto, null, `frame ${i}: no walk taken over`);
      P.update(1 / 60, ctl, Math.atan2(target.x - P.pos.x, target.z - P.pos.z) + Math.PI);
      quiet(() => ship.update(1 / 60, 0, {}));
    }
    off();
    assert.ok(ship.inside, `walked up the ramp and in: stopped at ${P.pos.toArray().map((n) => n.toFixed(2))}`);
    assert.ok(Math.abs(P.pos.y - ship.world(ship.parked, new THREE.Vector3(0, 0, 0)).y) < 0.3, `on the deck: ${P.pos.y.toFixed(2)}`);
    assert.ok(ship.rig.indoor, 'aboard: the rooms’ close camera');
    assert.equal(entered, 1, 'boarded once (ship:enter)');
    assert.match(ship.hud(), /^(aboard the ship|E step outside)$/, 'the cue says you are aboard (or by the hatch)');
  });
}
