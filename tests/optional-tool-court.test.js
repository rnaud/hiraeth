import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import './register-gadgets.js';
import { attachCourt, COURTS } from '../src/finds/courts.js';
import { GadgetWorld } from '../src/gadgets/world.js';
import { IN_HANDS, canCarry } from '../src/carry.js';
import { GameState } from '../src/game-state.js';
import { PLACEMENTS } from '../src/boxes/placements.js';
import { boxTool, toolHeld } from '../src/boxes/index.js';

// Subsystem regressions only. Ordinary hook/carry and fluid-shot routes require
// separate gameplay acceptance; positioning here does not claim a route solve.
function fixture(game = null, addMover = undefined) {
  const scene = new THREE.Scene(), level = { spawn: new THREE.Vector3() };
  const court = attachCourt('spacecity', scene, level);
  const player = { pos: court.frame.origin.clone().add(new THREE.Vector3(40, 0, 40)) };
  const physics = { groundAt: () => -Infinity, addMover };
  const world = new GadgetWorld({ physics, player, spec: level.gadgetWorld, game });
  return { court, player, world, spec: level.gadgetWorld };
}
function ticks(w, seconds) { for (let t = 0; t < seconds; t += .05) w.updateProps(.05); }

test('moorers court retains hook equipment and its existing optional reward', () => {
  const p = PLACEMENTS.spacecity.find(p => p.id === 'spacecity.court');
  assert.equal(p.item, 'splice'); assert.equal(p.court, 'spacecity');
  assert.equal(boxTool(p), 'hook');
  assert.equal(toolHeld(p, () => false), false);
  assert.equal(toolHeld(p, id => id === 'hook'), true);
  assert.deepEqual(COURTS.spacecity.at, [-77, 30]);
  const { world: w } = fixture();
  try {
    assert.equal(w.props.length, 2);
    assert.ok(w.props.every(p => p.mass === 1 && p.light && canCarry(p)));
    assert.ok(w.props.every(p => p.recovery));
    assert.equal(w.plates[0].things, true);
  } finally { w.dispose(); }
});

test('real loose load latches the exit; held or off-plate loads cannot solve it', () => {
  const { world: w, player } = fixture();
  try {
    const p = w.props[0], plate = w.plates[0], gate = w.gates[0];
    player.pos.copy(plate.pos); w.updatePlates(.1);
    assert.equal(plate.on, false, 'standing is not a load');
    p.pos.copy(plate.pos).add(new THREE.Vector3(0, p.h, 0)); p.held = IN_HANDS;
    w.updatePlates(.1); assert.equal(plate.on, false); assert.equal(gate.open, 0);
    p.held = null; p.pos.x += 2; w.updatePlates(.1); assert.equal(plate.on, false);
    p.pos.x -= 2; w.updatePlates(.1); assert.equal(plate.on, true);
    for (let i = 0; i < 30; i++) w.updatePlates(.1);
    assert.equal(gate.open, 1);
    p.pos.x += 3; w.updatePlates(.1);
    assert.equal(plate.on, false); assert.equal(gate.open, 1, 'no closing door behind the player');
  } finally { w.dispose(); }
});

test('court recovery waits, excludes every held mode and protects player at either endpoint', () => {
  const { world: w, player } = fixture();
  try {
    const p = w.props[1], home = p.home.clone();
    const lose = () => { p.pos.copy(home).add(new THREE.Vector3(30, 0, 0)); p.vel.set(0, 0, 0); p.resting = true; };
    for (const held of [IN_HANDS, 'hook', 'magnet', 'bubble']) {
      lose(); p.held = held; ticks(w, 2.5);
      assert.ok(p.pos.distanceTo(home) > 20, held); assert.equal(p.lostFor, 0);
    }
    p.held = null; lose(); player.pos.copy(p.pos); ticks(w, 2.5);
    assert.ok(p.pos.distanceTo(home) > 20, 'player retrieving lost crate');
    player.pos.copy(home); ticks(w, 2.5); assert.ok(p.pos.distanceTo(home) > 20, 'home occupied');
    player.pos.copy(home).add(new THREE.Vector3(0, 0, 40));
    ticks(w, 1); assert.ok(p.pos.distanceTo(home) > 20, 'sustained loss required');
    ticks(w, 1.05); assert.ok(p.pos.distanceTo(home) < .1);
    assert.equal(p.lostFor, 0); assert.equal(p.held, null);
    assert.ok(p.object.quaternion.equals(p.homeQ));
  } finally { w.dispose(); }
});

test('returning inside the court cancels recovery; unrelated props retain default contract', () => {
  const { world: w } = fixture();
  try {
    const p = w.props[1]; p.resting = true; p.pos.x += 30;
    ticks(w, 1); assert.ok(p.lostFor > 0);
    p.pos.copy(p.home); ticks(w, .1); assert.equal(p.lostFor, 0);
    const ordinary = w.addProp({ object: new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1)) });
    ordinary.resting = true; ordinary.pos.x = 100; ticks(w, 3);
    assert.equal(ordinary.pos.x, 100, 'no global horizontal reset');
  } finally { w.dispose(); }
});


test('lost crate waits for another prop to clear home, then returns without overlap', () => {
  const { world: w } = fixture();
  try {
    const [blocker, p] = w.props;
    blocker.pos.copy(p.home); blocker.resting = true;
    p.pos.copy(p.home).add(new THREE.Vector3(30, 0, 0)); p.resting = true;
    ticks(w, 2.5);
    assert.ok(p.pos.distanceTo(p.home) > 20); assert.equal(p.lostFor, 0);
    blocker.pos.x += 3;
    ticks(w, 1); assert.ok(p.pos.distanceTo(p.home) > 20, 'a fresh safe interval is required');
    ticks(w, 1.05); assert.ok(p.pos.distanceTo(p.home) < .1);
    assert.ok(p.pos.distanceTo(blocker.pos) > p.r + blocker.r);
  } finally { w.dispose(); }
});

test('depth loss recovers within horizontal bounds without resetting a held falling crate', () => {
  const { world: w } = fixture();
  try {
    const p = w.props[1];
    p.pos.copy(p.home); p.pos.y = p.recovery.minY - 1; p.resting = true;
    p.held = 'hook'; ticks(w, 2.5); assert.ok(p.pos.y < p.recovery.minY);
    p.held = null; ticks(w, 2.05); assert.ok(p.pos.distanceTo(p.home) < .1);
  } finally { w.dispose(); }
});


test('solving persists before collecting the reward and restores the open gate on reload', () => {
  const storage = new Map();
  const store = { getItem: k => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, v) };
  const game = new GameState(store), first = fixture(game);
  try {
    assert.equal(game.flag('court.spacecity.solved'), undefined);
    const p = first.world.props[1], plate = first.world.plates[0];
    p.pos.copy(plate.pos).add(new THREE.Vector3(0, p.h, 0));
    p.held = IN_HANDS; first.world.updatePlates(.1);
    assert.equal(game.flag('court.spacecity.solved'), undefined);
    p.held = null; first.world.updatePlates(.1);
    assert.equal(game.flag('court.spacecity.solved'), true);
    assert.equal(game.flag('box.spacecity.court'), undefined, 'solve does not award reward');
  } finally { first.world.dispose(); }
  const second = fixture(new GameState(store));
  try {
    const gate = second.world.gates[0];
    assert.equal(gate.open, 1, 'open before the first update');
    assert.equal(gate.latched, true);
    assert.equal(gate.object.position.y, gate.base.y - gate.travel);
    second.world.updatePlates(.1);
    assert.equal(second.world.plates[0].on, false, 'loose props still reset normally');
    assert.equal(gate.open, 1);
  } finally { second.world.dispose(); }
});

test('older collected reward saves restore the exit without granting another reward', () => {
  const game = new GameState(null); game.set('box.spacecity.court', true);
  const { world } = fixture(game);
  try {
    assert.equal(world.gates[0].open, 1);
    assert.equal(game.flag('item.splice'), undefined, 'no inventory mutation');
    assert.equal(game.flag('court.spacecity.solved'), undefined, 'no fabricated solve');
  } finally { world.dispose(); }
});

test('temporary held gate override cannot persist a solve', () => {
  const game = new GameState(null), { world } = fixture(game);
  try {
    world.gates[0].held = 1; world.updatePlates(.1);
    assert.equal(game.flag('court.spacecity.solved'), undefined);
  } finally { world.dispose(); }
  const reloaded = fixture(game);
  try { assert.equal(reloaded.world.gates[0].open, 0); }
  finally { reloaded.world.dispose(); }
});


test('restored gate collision is registered at the open transform; other gates stay closed', () => {
  const game = new GameState(null); game.set('court.spacecity.solved', true);
  const registrations = [];
  const addMover = object => {
    registrations.push({ pos: object.position.clone(), matrix: object.matrixWorld.clone() });
    return null;
  };
  const { world } = fixture(game, addMover);
  try {
    const gate = world.gates[0], recorded = registrations[0];
    assert.equal(recorded.pos.y, gate.base.y - gate.travel);
    assert.equal(new THREE.Vector3().setFromMatrixPosition(recorded.matrix).y, gate.object.getWorldPosition(new THREE.Vector3()).y);
    const unrelated = world.addGate({ object: new THREE.Group(), latch: true, want: 0 });
    assert.equal(unrelated.open, 0);
    world.updatePlates(.1);
    assert.equal(unrelated.open, 0, 'saved court flag never opens an unrelated gate');
  } finally { world.dispose(); }
});
