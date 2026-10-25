// Issue #628: the porch sill must support ordinary walking after its slab sinks.
// A focused physics fixture, not an earned temple walkthrough.
import test from 'node:test';
import assert from 'node:assert/strict';
import './register-gadgets.js';
import * as THREE from 'three';
import { buildableById } from '../src/levels/buildable.js';
import { TEMPLE_HOME, templeOf } from '../src/temples/index.js';
import { ROOMS, UP, HOLD } from '../src/temples/arzach2.js';
import { Physics } from '../src/physics.js';
import { Player } from '../src/player.js';
import { game } from '../src/game-state.js';
import { items } from '../src/items.js';

const DT = 1 / 60;
const OFFSETS = [0, -4.510044877292785e-5, -.25, .25];

test('Belfry porch threshold supports walking both ways while its latched door still blocks before opening', async t => {
  game.reset();
  t.after(() => game.reset());
  // Explicit upstream unit-fixture prerequisite: dP requires the already-earned hook.
  // This is not an earned-item proof; d3 still starts closed and opens through its real bell.
  items.grant('hook');
  const scene = new THREE.Scene();
  const level = buildableById(TEMPLE_HOME.arzach2 ?? 'arzach2').create(scene);
  const physics = new Physics(scene, level.ground.heightAt ? level.ground : null);
  level.init?.(physics);
  const rt = templeOf(level, 'arzach2'), door = rt.byId.get('d3');
  const L = (x, z) => rt.kit.world(x, UP, z);
  const player = new Player(physics, { spawn: L(0, ROOMS.porch.z1 - 2), dynamic: level.dynamic, health: true, unsafe: level.unsafe });
  rt.connect({ player });
  t.after(() => rt.dispose());
  let time = 0;
  function frame(input = {}, yaw = 0) {
    time += DT; physics.syncMovers?.(DT); rt.update(DT, time); player.update(DT, input, yaw);
  }
  function stage(x, z) {
    player.teleport(L(x, z), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1));
    for (let i = 0; i < Math.ceil(.5 / DT); i++) frame();
    assert.ok(player.onGround, 'fixture settles on the actual room floor');
  }
  await t.test('closed door retains its blocking collider', () => {
    assert.ok(!door.open && door.handle);
    stage(0, ROOMS.porch.z1 - 2);
    for (let i = 0; i < Math.ceil(3 / DT); i++) frame({ KeyW: true }, Math.PI);
    assert.ok(rt.kit.local(player.pos).z < door.o.at[2] - .3, 'ordinary walking cannot cross closed slab');
    assert.ok(door.handle && !door.open);
  });
  // Exercise the real bell and door transition. No setOpen or collider removal in the fixture.
  stage(0, ROOMS.porch.z1 - 2);
  rt.foundersBell.toggle('threshold-regression');
  for (let i = 0; i < Math.ceil(2.2 / DT); i++) frame();
  assert.ok(door.open && door.k === 1 && !door.handle);
  for (const bellState of ['rung', 'still-latched']) {
    if (bellState === 'still-latched') {
      rt.foundersBell.toggle('threshold-regression');
      for (let i = 0; i < Math.ceil((HOLD.fade + .2) / DT); i++) frame();
      assert.equal(rt.logic.drumT('bell'), 0);
      assert.ok(door.open && !door.handle, 'latched door stays open after bell fades');
    }
    await t.test(`${bellState}: actual downward queries find continuous threshold support`, () => {
      for (const x of OFFSETS) for (let i = 0; i <= 30; i++) {
        const z = ROOMS.porch.z1 + .2 + i * .05, p = L(x, z);
        assert.ok(Math.abs(physics.groundAt(p.x, p.y + .6, p.z, 2) - p.y) < .03,
          `floor support at x=${x}, z=${z}, bell=${bellState}`);
      }
    });
    await t.test(`${bellState}: ordinary unsprinted walking remains grounded in both directions`, () => {
      for (const x of OFFSETS) for (const direction of [1, -1]) {
        const start = direction > 0 ? ROOMS.porch.z1 - 1.5 : ROOMS.echoes.z0 + .5;
        const end = direction > 0 ? ROOMS.echoes.z0 + .5 : ROOMS.porch.z1 - 1.5;
        stage(x, start); const health = player.health; let crossed = false;
        for (let i = 0; i < Math.ceil(5 / DT); i++) {
          frame({ KeyW: true }, direction > 0 ? Math.PI : 0);
          const local = rt.kit.local(player.pos);
          assert.ok(player.onGround && Math.abs(local.y - UP) < .05,
            `no unsupported fall at ${local.toArray()} moving ${direction}, bell=${bellState}`);
          assert.equal(player.health, health);
          if (direction * (local.z - end) >= 0) { crossed = true; break; }
        }
        assert.ok(crossed, 'actual feet cross the whole doorway at ordinary walk speed');
      }
    });
  }
});
