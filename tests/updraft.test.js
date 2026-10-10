// Rising air (src/updraft.js): every column of it lifts open wings straight up (the author, 2026-10-10: "when in an
// air shaft I should go just up, not keep going forward"), settles you onto its axis, hangs you near its top, and lets
// the stick steer you out.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Player } from '../src/player.js';
import { Physics } from '../src/physics.js';
import { items, ITEMS } from '../src/items.js';
import { UPDRAFT, liftAt, riseToward, rideColumn, columnDrift, inColumn } from '../src/updraft.js';

const DT = 1 / 60;
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

test('the lift: full low down, easing to nothing over the top, and a fall caught at once', () => {
  assert.equal(liftAt(8, 40, 10), 8);
  assert.equal(liftAt(8, 40, 40), 0);
  assert.equal(liftAt(8, 40, 41), 0);
  assert.ok(liftAt(8, 40, 38.5) > 0 && liftAt(8, 40, 38.5) < 8);
  assert.ok(riseToward(-20, 10, DT) >= 5, 'a fall into it is caught: at least half its speed up at once');
  let vy = 0;
  for (let i = 0; i < 120; i++) vy = riseToward(vy, 10, DT);
  assert.ok(Math.abs(vy - 10) < 0.2, `and it settles at its speed (${vy.toFixed(2)})`);
});

test('the drift: the stick moves you across at its steer speed; let go and it draws you onto the axis', () => {
  const out = { x: 0, z: 0 };
  columnDrift(out, { x: 1, z: 0 }, { x: 0, z: 0 }, { x: 0, z: 0 });
  assert.equal(out.x, UPDRAFT.steer); assert.equal(out.z, 0);
  columnDrift(out, { x: 0, z: 0 }, { x: 2, z: -1 }, { x: 0, z: 0 });
  assert.ok(out.x < 0 && out.z > 0, 'back toward the axis');
  columnDrift(out, { x: 1, z: 0 }, { x: 3, z: 0 }, { x: 0, z: 0 });
  assert.equal(out.x, UPDRAFT.steer, 'pushing out, nothing pulls you back: you always get out');
});

/** A traveller with the wings, gliding at 15 m/s along +z into a column at the origin (r 5, top 60 m). */
function ride({ stick = null, secs = 12, column = { x: 0, z: 0, r: 5, top: 60, lift: 10 } } = {}) {
  for (const id of Object.keys(ITEMS)) items.revoke(id);
  items.grant('backpack'); items.grant('glider');
  const scene = new THREE.Scene();
  const floor = new THREE.Mesh(new THREE.BoxGeometry(400, 1, 400)); floor.position.set(0, -0.5, 0); scene.add(floor);
  const P = new Player(new Physics(scene), { health: false });
  P.respawn(V(0, 20, -8));
  P.heading = 0;
  // jump held as you fall: the wings open and carry you forward, into the column
  const log = [];
  for (let i = 0; i < secs / DT; i++) {
    const inside = Math.hypot(P.pos.x - column.x, P.pos.z - column.z) < column.r && P.pos.y < column.top;
    const input = { Space: true, ...(stick && inColumn(P) ? stick : {}) };
    P.update(DT, input, Math.PI);   // (the camera behind him, looking along +z)
    if (inside && P.gliding) rideColumn(P, DT, column);
    log.push({ p: P.pos.clone(), inside, gliding: P.gliding });
  }
  return { P, log };
}

test('gliding into a column: straight up its middle, no forward run, and held near its top', () => {
  const { P, log } = ride();
  const first = log.findIndex((s) => s.inside && s.gliding);
  assert.ok(first >= 0, 'the glide reaches the column');
  // a second in, the forward run is spent; from then on he only goes up
  const settled = log.slice(first + 60);
  const flat = settled.slice(1).map((s, i) => Math.hypot(s.p.x - settled[i].p.x, s.p.z - settled[i].p.z) / DT);
  assert.ok(Math.max(...flat) < 2, `no forward drift once in it (fastest flat ${Math.max(...flat).toFixed(2)} m/s)`);
  assert.ok(Math.hypot(P.pos.x, P.pos.z) < 1.5, `settled on the axis (${P.pos.x.toFixed(2)}, ${P.pos.z.toFixed(2)})`);
  assert.ok(P.pos.y > 55 && P.pos.y < 60.5, `up to the top, and held there (${P.pos.y.toFixed(1)} m)`);
  assert.ok(P.gliding, 'still on the wings');
  const tail = log.slice(-60);
  assert.ok(Math.abs(tail.at(-1).p.y - tail[0].p.y) < 1, 'hanging at the top, not falling out of it');
});

test('the stick steers you out of a column, and the glide takes up again beyond it', () => {
  const { P, log } = ride({ stick: { KeyD: true }, secs: 10 });
  const first = log.findIndex((s) => s.inside && s.gliding);
  const out = log.findIndex((s, i) => i > first && !s.inside);
  assert.ok(out > first, 'he leaves the column');
  assert.ok((out - first) * DT < 4, `within a few seconds of steering (${((out - first) * DT).toFixed(1)} s)`);
  assert.ok(Math.hypot(P.pos.x, P.pos.z) > 8, `and glides on away from it (${Math.hypot(P.pos.x, P.pos.z).toFixed(1)} m out)`);
});

test('held in rising air on the wings, the gun may come up (not the blade); the Warden’s bellows climb quicker', async () => {
  const { FluidTool } = await import('../src/fluid-tool.js');
  const free = (P, o) => FluidTool.prototype.bodyFree.call({ _enabled: true, player: P }, false, o);
  const { P } = ride({ secs: 8 });
  assert.equal(P.hovering, true, 'gliding in the column: held');
  assert.equal(free(P, { hover: true }), true, 'the arm may come up to aim and shoot');
  assert.equal(free(P), false, 'but the body is not free for a sword swing');
  const out = ride({ stick: { KeyD: true }, secs: 8 }).P;
  assert.equal(out.hovering, false, 'gliding out of it: not held');
  assert.equal(free(out, { hover: true }), false, 'and no aiming on a plain glide');
  // the bellows: the same column, a quicker climb
  const climb = (bellows) => {
    for (const id of Object.keys(ITEMS)) items.revoke(id);
    items.grant('backpack'); items.grant('glider'); if (bellows) items.grant('wardenbellows');
    const Q = new Player(new Physics(new THREE.Scene()), { health: false });
    Q.respawn(V(0, 0, 0)); Q.vel.set(0, 0, 0);
    for (let i = 0; i < 60; i++) rideColumn(Q, DT, { x: 0, z: 0, top: 100, lift: 10 });
    return Q.vel.y;
  };
  assert.ok(climb(true) > climb(false) * 1.15, `quicker with the bellows (${climb(true).toFixed(1)} vs ${climb(false).toFixed(1)} m/s)`);
});
