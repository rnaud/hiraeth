// Issue #265: the Unity bridge's plans without fixed views (-idle, -tour, -walk, -play) start at the level's spawn,
// which in the desert was under the ship's ramp from 2026-10-10 (9f55e63f) until #254 had the ship move a spawn it
// covers to the foot of its ramp (Ship.clearSpawn): the Xbox's "desert spawn" numbers of that time were taken there
// (docs/systems/performance.md, "The bench's desert start"). engine/game.js in a bare V8 context (the bundle the engines
// run) starts a plan in the desert where the web's ?level=desert starts, at the foot of the ramp, out from under the
// ship (which tests/route-spawn.test.js walks from, the camera turned, in every route world, with every bench view);
// -hull-spawn (`hullSpawn`) puts him back on the old spot under the ramp, to compare with the numbers taken there.
import test from 'node:test';
import assert from 'node:assert/strict';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as THREE from 'three';
import { bundle } from '../scripts/engine-bundle.mjs';
import { loadBundle } from '../engine/vm-run.mjs';
import { tempPath } from '../scripts/temp-dirs.mjs';

// as the game (main.js): colours are display values, not converted to linear
THREE.ColorManagement.enabled = false;

/** A backend that takes every op and keeps nothing. */
const backend = new Proxy({}, { get: () => () => {} });
const near = (a, b, d = 0.05) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) < d;
const fmt = (p) => [p.x, p.y, p.z].map((n) => n.toFixed(1)).join(', ');

test('the bridge\'s plans start in the desert where the web game does, at the foot of the ramp, clear of the ship; -hull-spawn on the old spot under it (issue #265)', async () => {
  const file = tempPath(join(tmpdir(), `hiraeth-bench-start-${process.pid}.js`));
  await bundle('godot', { input: 'engine/game.js', out: [file] });
  // (quiet: the GLTF loader's textures want a Blob the bare context hasn't)
  const warn = console.warn, info = console.info, log = console.log, error = console.error; console.warn = console.info = console.log = console.error = () => {};
  let plan, old;
  try {
    // a plan's start (engine/unity/game.js launch: no save's place, no -arrive), and the same with -hull-spawn
    plan = await loadBundle(file).exports.createGame({ levelId: 'desert', backend });
    old = await loadBundle(file).exports.createGame({ levelId: 'desert', backend, hullSpawn: true });
  } finally { console.warn = warn; console.info = info; console.log = log; console.error = error; }
  const { player, ship, level, rig } = plan, p = player.pos, a = ship.arrivalSpot();
  assert.ok(!ship.isInside(ship.parked, p), `the plan's start out of the ship (${fmt(p)})`);
  assert.ok(!ship.covers(p), `the plan's start not under its hull or ramp (${fmt(p)})`);
  assert.ok(near(p, a.pos), `at the foot of the ramp (${fmt(p)} against ${fmt(a.pos)})`);
  assert.ok(Math.abs(player.heading - a.heading) < 1e-6, 'facing out');
  assert.ok(Math.abs(rig.yaw - level.camYaw) < 1e-6, 'the camera behind him, as the web\'s start sets it');
  // (the web's ?level=desert: the level's spawn, which the ship has moved there)
  assert.ok(near(p, level.spawn), `the web's start (${fmt(level.spawn)})`);
  // the old start, to compare with the numbers taken there: the spot the ship covers
  const c = old.level.coveredSpawn;
  assert.ok(c, 'the spot the ship moved the spawn from, kept');
  assert.ok(near(old.player.pos, c.pos) && old.ship.covers(old.player.pos), `-hull-spawn under the ramp again (${fmt(old.player.pos)})`);
  assert.ok(old.player.pos.distanceTo(p) > 3, 'not the plan\'s start');
});
