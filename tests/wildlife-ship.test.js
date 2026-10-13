// No wild creature on the ship (issue #246: "I saw an animal on my ship in the desert level. That shouldn't happen."):
// the parked ship's hull, its ramp, the rooms and the ground under and round them are kept off (Ship.keepsOff, handed
// to the wildlife as keepOff in main.js): none is put there, and none walks, wanders or is chased onto it.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';


const { createDesert } = await import('../src/levels/desert.js');
const { Physics } = await import('../src/physics.js');
const { Wildlife } = await import('../src/wildlife.js');
const { CONTENT } = await import('../src/levels/content.js');
const { Ship, KEEP_OFF } = await import('../src/ship/ship.js');

const quiet = (fn) => { const w = console.warn; console.warn = () => {}; try { return fn(); } finally { console.warn = w; } };
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const flat = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const scene = new THREE.Scene();
const level = createDesert(scene);
const physics = new Physics(scene, level.ground);
const ship = quiet(() => new Ship({ scene, physics, level, levelId: 'desert', content: CONTENT.desert }));
scene.updateMatrixWorld(true);

test('#246: the ship’s hull, ramp and the ground round them are kept off; the open desert is not', () => {
  const S = ship.restPos, foot = ship.rampFoot, hinge = ship.hinge;
  assert.ok(ship.keepsOff(S.clone()), 'on its deck');
  assert.ok(ship.keepsOff(V(S.x, physics.groundAt(S.x, S.y - 1, S.z, 20), S.z)), 'under the hull');
  assert.ok(ship.keepsOff(hinge.clone().lerp(foot, 0.5)), 'half way down the ramp');
  assert.ok(ship.keepsOff(foot.clone()), 'at the ramp’s foot');
  const out = ship.outDir.clone().setY(0).normalize();
  assert.ok(!ship.keepsOff(foot.clone().addScaledVector(out, KEEP_OFF + 6)), 'a few steps out from the ramp’s foot: open ground');
  assert.ok(!ship.keepsOff(S.clone().add(V(60, 0, 0))), '60 m off: open ground');
});

/** The desert's creatures, each brought to the ship's side and at home on its hull, for two minutes: where they stood on it. */
function crowdTheShip(keepOff) {
  const w = new Wildlife(scene, level, physics, { content: CONTENT.desert, keepOff });
  const S = ship.restPos, land = w.list.filter((c) => c.species.habitat !== 'water');
  land.forEach((c, i) => {
    const a = (i / land.length) * Math.PI * 2;
    for (let r = 12; r < 40; r += 0.5) {
      const x = S.x + Math.cos(a) * r, z = S.z + Math.sin(a) * r, y = physics.groundAt(x, S.y + 20, z, 60);
      const p = V(x, y, z);
      if (!Number.isFinite(y) || ship.keepsOff(p)) continue;
      c.place({ pos: p, up: V(0, 1, 0) });
      c.home.copy(S);   // (its idle walks aim at the ship)
      c.state = 'idle'; c.timer = 0;
      break;
    }
  });
  const player = { pos: S.clone().add(V(45, 0, 0)), vel: V(0, 0, 0), heading: 0, riding: false, onGround: true, vehicles: [], frame: { up: V(0, 1, 0), dir: (h, o) => o.set(Math.sin(h), 0, Math.cos(h)) } };
  player.pos.y = physics.groundAt(player.pos.x, S.y + 20, player.pos.z, 60);
  const cam = new THREE.PerspectiveCamera(); cam.position.copy(S).add(V(0, 30, 60)); cam.lookAt(S); cam.updateMatrixWorld();
  let t = 0;
  const on = new Set();
  for (let i = 0; i < 60 * 120; i++) {
    t += 1 / 60;
    // half way through, the traveller comes up on the far side: they back off and bolt, toward the hull
    if (i === 60 * 60) { player.pos.copy(S).add(V(-16, 0, 0)); player.pos.y = physics.groundAt(player.pos.x, S.y + 20, player.pos.z, 60); }
    w.update(1 / 60, t, player, cam);
    if (i % 10 === 0) for (const c of land) if (!c.hidden && c.alive && ship.keepsOff(c.pos, 0)) on.add(c.herd.def.id + ' ' + c.index);
  }
  return { w, on: [...on] };
}

test('#246: no creature is put on the ship, and none walks onto it, wandering or chased', () => {
  const { w, on } = crowdTheShip((p) => ship.keepsOff(p));
  assert.ok(w.list.length >= 8, `the desert keeps its creatures (${w.list.length})`);
  assert.deepEqual(on, [], 'none on the hull, the ramp or under the ship');
  const fresh = new Wildlife(scene, level, physics, { content: CONTENT.desert, keepOff: (p) => ship.keepsOff(p) });
  for (const c of fresh.list) assert.ok(!ship.keepsOff(c.pos), `${c.herd.def.id} put on the ship`);
  // (and the check can fail: without the keep-off, the same two minutes put some of them on it)
  assert.ok(crowdTheShip(null).on.length > 0, 'without it they climb on');
});
