// The berths that carry the ship (issue #451, src/levels/port-berth.js, docs/systems/worlds.md "Space ports"): the
// Underwater City's lock lowers it onto the Dock's dome, the City-Shaft's cradle swings it in over the rim. The ship rests
// where it always did; the berth changes only where it sets down and lifts off, in a short step of each scene.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { BERTH, berthSpec, berthPose, berthOut, berthRest, berthArrive, berthLeave } from '../src/levels/port-berth.js';
import { PORTS } from '../src/levels/ports.js';
import { buildPort, hullFrame } from '../src/levels/port-pad.js';
import { HALF_W, NOSE_Z, STERN_Z, HINGE_R, BELLY, LIFT } from '../src/ship/hull.js';
import { Physics } from '../src/physics.js';
import { Player } from '../src/player.js';
import { Ship } from '../src/ship/ship.js';
import { ArrivalDirector, TakeoffDirector } from '../src/ship/cinematics.js';
import { game } from '../src/game-state.js';

globalThis.window ??= { addEventListener() {} };
const BERTHED = { underwater: 'lock', incal: 'cradle' };
const near = (a, b, e = 1e-6) => Math.abs(a - b) < e;

test('the two ports of the brief have their berth, the others none', () => {
  for (const [id, P] of Object.entries(PORTS)) assert.equal(P.berth?.kind, BERTHED[id], id);
});

test('a berth sets down out, brings the ship to rest with no jolt, and carries it out again', () => {
  for (const kind of Object.keys(BERTH)) {
    const b = { kind }, S = berthSpec(b), out = berthOut(b), rest = berthRest(b);
    assert.ok(out.up > 1 || Math.abs(out.du) > 5, `${kind}: out is somewhere else`);
    assert.ok(near(rest.du, 0) && near(rest.up, 0) && near(rest.theta, 0), `${kind}: at rest, where the ship rests`);
    for (const [fn, dur, a, z] of [[berthArrive, S.arrive, out, rest], [berthLeave, S.leave, rest, out]]) {
      const p0 = fn(b, 0), p1 = fn(b, dur), pEnd = fn(b, dur + 5);
      assert.ok(near(p0.du, a.du) && near(p0.up, a.up), `${kind} ${fn.name}: starts where it should`);
      assert.ok(near(p1.du, z.du, 1e-4) && near(p1.up, z.up, 1e-4) && near(pEnd.up, z.up, 1e-4), `${kind} ${fn.name}: ends where it should`);
      // no speed at either end, and never a jump between frames
      const dt = 1 / 60, v = (t) => Math.hypot(fn(b, t + dt).du - fn(b, t).du, fn(b, t + dt).up - fn(b, t).up) / dt;
      assert.ok(v(0) < 0.3 && v(dur - dt) < 0.3, `${kind} ${fn.name}: from and to a standstill (${v(0).toFixed(2)}, ${v(dur - dt).toFixed(2)} m/s)`);
      for (let t = 0; t < dur; t += dt) assert.ok(v(t) < 12, `${kind} ${fn.name}: ${v(t).toFixed(1)} m/s at ${t.toFixed(2)} s`);
    }
    assert.ok(S.arrive <= 4 && S.leave <= 3, `${kind}: a short step, not a wait`);
  }
  // the cradle swings past its rest and back (a swing, not a slide), by at most a third of its swing
  const swings = [];
  for (let t = 0; t <= BERTH.cradle.arrive; t += 0.02) swings.push(berthArrive({ kind: 'cradle' }, t).theta);
  const low = Math.min(...swings);
  assert.ok(low < -0.05 * BERTH.cradle.swing && low > -BERTH.cradle.swing / 3, `the overswing ${low.toFixed(3)} rad`);
  // the cradle hangs level: its pose is the arm's swing, as a gondola's
  const p = berthPose({ kind: 'cradle' }, 0.5);
  assert.ok(near(Math.hypot(p.du, BERTH.cradle.arm - p.up), BERTH.cradle.arm), 'on the arm’s circle');
});

test('each berth: its moving meshes move with its pose, never collide or freeze; its fixed part clear of the hull and the ramp', () => {
  for (const id of Object.keys(BERTHED)) {
    const P = PORTS[id], port = buildPort(P), B = port.berth, F = hullFrame(P.site);
    assert.ok(B && B.group.parent === port.group, `${id}: the berth in the port`);
    const meshes = []; B.group.traverse((o) => o.isMesh && meshes.push(o));
    assert.ok(meshes.length >= 1 && meshes.length <= 4, `${id}: ${meshes.length} moving meshes`);
    for (const m of meshes) assert.ok(m.userData.dynamic && m.userData.noCollide, `${id} ${m.name}: dynamic, walked through`);
    const box = () => new THREE.Box3().setFromObject(meshes[0]);
    const at0 = box().getCenter(new THREE.Vector3());
    const out = berthOut(B.spec);
    B.set(out);
    const at1 = box().getCenter(new THREE.Vector3());
    const [du0, ] = F.uv(at0.x, at0.z), [du1] = F.uv(at1.x, at1.z);
    assert.ok(near(at1.y - at0.y, out.up, 1e-3) && near(du1 - du0, out.du, 1e-3), `${id}: the body moved by the pose (${(du1 - du0).toFixed(2)}, ${(at1.y - at0.y).toFixed(2)})`);
    B.set(berthRest(B.spec));
    // the fixed part (columns, towers) in the port's solid meshes, off the hull's plan and the ramp: tests/ports.test.js;
    // at rest, the moving part stays under the belly or off the hull's plan, and off the ramp's way
    const pos = meshes.flatMap((m) => { m.updateMatrixWorld(true); const a = m.geometry.attributes.position, v = new THREE.Vector3(), out = []; for (let i = 0; i < a.count; i += 3) out.push(v.fromBufferAttribute(a, i).applyMatrix4(m.matrixWorld).clone()); return out; });
    for (const v of pos) {
      const [u, w] = F.uv(v.x, v.z), y = v.y - P.site.y;
      const onPlan = Math.abs(u) < HALF_W && w > NOSE_Z && w < STERN_Z;
      assert.ok(!onPlan || y < LIFT + BELLY + 0.05 || Math.abs(u) > HALF_W - 1.2, `${id}: (${u.toFixed(1)}, ${w.toFixed(1)}, ${y.toFixed(1)}) inside the hull`);
      assert.ok(!(u > HINGE_R - 1 && u < 28 && Math.abs(w) < 1.8 && y > -0.5 && y < 4.5), `${id}: (${u.toFixed(1)}, ${w.toFixed(1)}, ${y.toFixed(1)}) across the ramp`);
    }
  }
});

test('the cradle’s arms stay pinned to the cradle as it swings', () => {
  const P = PORTS.incal, port = buildPort(P), B = port.berth, S = B.spec;
  const body = B.group.getObjectByName('berth body'), arms = B.group.getObjectByName('berth arms');
  for (const k of [0, 0.3, 0.7, 1, -0.25]) {
    const pose = berthPose(S, k);
    B.set(pose);
    // the pin on the body (the hull's frame: its end, S.pin up) and the arm's foot (S.arm under the hub), in the world
    const pin = body.localToWorld(new THREE.Vector3(S.ends[0], S.pin, 0)), foot = arms.localToWorld(new THREE.Vector3(S.ends[0], -S.arm, 0));
    assert.ok(pin.distanceTo(foot) < 1e-3, `k ${k}: the arm's foot ${pin.distanceTo(foot).toFixed(3)} m off its pin`);
    if (k === 1) { const [u] = hullFrame(P.site).uv(pin.x, pin.z); assert.ok(u > 5, `swung out of the hatch's side (${u.toFixed(1)})`); }
  }
});

// a flat world with one of the berthed ports round its ship (the ship as the game places it: Ship.place)
function berthWorld(id) {
  const P = PORTS[id], scene = new THREE.Scene();
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(3000, 3000).rotateX(-Math.PI / 2).translate(0, P.site.y, 0)));
  const port = buildPort(P);
  scene.add(port.group);
  const physics = new Physics(scene);
  const level = { spawn: new THREE.Vector3(P.site.x + 120, P.site.y, P.site.z), ground: { heightAt: () => P.site.y }, lights: [], port, shipSite: { x: P.site.x, z: P.site.z, heading: P.site.h } };
  const ship = new Ship({ scene, physics, level, levelId: `${id}-flat`, content: { npcs: [], relics: { spots: [] } } });
  ship.player = new Player(physics);
  ship.rig = { yaw: 0, pitch: 0.2, target: new THREE.Vector3(), indoor: false };
  ship.camera = new THREE.PerspectiveCamera();
  ship.sound = {};
  ship.onReady = () => {};
  ship.shots = [];
  const shot = ship.shot.bind(ship);
  ship.shot = (s) => { ship.shots.push(s); return shot(s); };
  return { ship, port };
}

test('arriving at a berthed port: it sets down on the berth out, the berth brings it to rest, then the ramp; skipped, at rest', () => {
  for (const id of Object.keys(BERTHED)) {
    game.reset();
    const { ship, port } = berthWorld(id), B = port.berth, m = ship.parked;
    const rest = ship.restPos.clone(), d = new ArrivalDirector(ship);
    const plain = 6;   // (space, the clouds, out of the clouds, the landing, the ramp, the walk out)
    assert.equal(d.steps.length, plain + 1, `${id}: one step more, the berth's`);
    assert.ok(Math.abs(d.steps[4].dur - B.spec.arrive - 0.3) < 1e-9, `${id}: after the landing`);
    d.start();
    let touched = null;
    for (let t = 0; t < 60 && !d.done; t += 1 / 30) {
      const was = d.i;
      d.update(1 / 30, false);
      if (was === 3 && d.i === 4) touched = m.group.position.clone();   // (the landing's end: on the berth, out)
      if (d.i === 4) assert.ok(ship.shots.at(-1).fov > 30, `${id}: the berth's lens`);
      if (d.i === 5 && touched) { assert.ok(m.group.position.distanceTo(rest) < 1e-6, `${id}: at rest when the ramp opens`); }
      if (ship.auto && d.i >= 6) ship.auto = null;
    }
    assert.ok(d.done && touched, `${id}: the arrival ends`);
    assert.ok(touched.distanceTo(ship.berthPos(berthOut(B.spec))) < 0.05, `${id}: it set down on the berth out (${touched.distanceTo(ship.berthPos(berthOut(B.spec))).toFixed(3)} m)`);
    assert.ok(m.group.position.distanceTo(rest) < 1e-6, `${id}: it rests where it always did`);
    // held to skip mid-way: at rest, the berth too
    const s = new ArrivalDirector(ship);
    s.start();
    for (let t = 0; t < 30 && !s.done; t += 1 / 30) s.update(1 / 30, t > 0.5);
    assert.ok(m.group.position.distanceTo(rest) < 1e-6, `${id}: skipped, at rest`);
    const body = B.group.getObjectByName('berth body');
    assert.ok(body.position.length() < 1e-6, `${id}: the berth at rest`);
  }
  game.reset();
});

test('leaving a berthed port: sealed, the berth carries it out, and it lifts off from there', () => {
  for (const id of Object.keys(BERTHED)) {
    const { ship, port } = berthWorld(id), B = port.berth, m = ship.parked;
    ship.warp = { start() {} };
    const d = new TakeoffDirector(ship, { to: 'desert', title: 'The Desert', onDone() {} });
    assert.equal(d.steps.length, 4, `${id}: the seal, the berth, the lift-off, the stars`);
    d.start();
    let lifted = null;
    for (let t = 0; t < 20 && !d.done; t += 1 / 30) {
      const was = d.i;
      d.update(1 / 30, false);
      if (was === 1 && d.i === 2) lifted = m.group.position.clone();
    }
    assert.ok(lifted && lifted.distanceTo(ship.berthPos(berthOut(B.spec))) < 0.05, `${id}: it lifts off from the berth out`);
  }
});
