import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Physics } from '../src/physics.js';
import { Crowd, buildPeople, buildPeopleSteps } from '../src/crowd.js';
import { DeferredWork } from '../src/deferred.js';
import { runSteps } from '../src/load-steps.js';

// The crowd's strollers worked out after the first frame (src/crowd.js buildPeopleSteps with defer, issue #14): each
// walk on its own, so the crowd comes out the same whenever and in whatever order its walks are worked out.

const V = (x, y, z) => new THREE.Vector3(x, y, z);
/** A floor 1.2 km across with a few walls, walks near the spawn (the origin) and far from it, circles and perches. */
function town() {
  const scene = new THREE.Scene();
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(1200, 1200).rotateX(-Math.PI / 2)));
  for (const [x, z] of [[20, 4], [300, -3], [-420, 6], [10, 400]]) { const m = new THREE.Mesh(new THREE.BoxGeometry(3, 4, 3)); m.position.set(x, 2, z); scene.add(m); }
  const line = (x0, z0, x1, z1, n = 20) => Array.from({ length: n + 1 }, (_, i) => V(x0 + (x1 - x0) * i / n, 0, z0 + (z1 - z0) * i / n));
  const spots = {
    walks: [
      { path: line(-60, 4, 60, 4), n: 6 },                           // by the spawn, past a wall
      { path: line(200, -3, 400, -3), n: 8, pair: 0.6 },             // far east, past a wall
      { path: line(-500, 6, -300, 6), n: 5 },                        // far west
      { path: line(10, 300, 10, 500), n: 4 },                        // far north, crossing the next
      { path: line(-60, 400, 80, 400), n: 4 },
    ],
    groups: [{ at: V(0, 0, 4.6), n: 3 }, { at: V(5, 0, -12), n: 4 }, { at: V(300, 0, 10), n: 3 }, { at: V(10, 0, 402), n: 3 }],
    edges: [{ at: V(18, 0, -6), heading: 0, pose: 'look' }, { at: V(-400, 0, -20), heading: 1, pose: 'look' }],
  };
  return { scene, spots, physics: new Physics(scene) };
}
const sig = (b) => ({
  people: b.people.map((p) => [p.id, p.kind, +p.pos.x.toFixed(4), +p.pos.y.toFixed(4), +p.pos.z.toFixed(4), +p.home.x.toFixed(4), +p.home.z.toFixed(4), +p.heading.toFixed(4), +p.size.toFixed(5), p.look.flat().join(','), p.walk ? [+p.walk.u.toFixed(4), p.walk.dir, p.walk.route.order] : null, p.group?.id ?? null]),
  routes: b.routes.map((r) => [r.order, r.pts.length, +r.total.toFixed(4), r.pts.map((q) => `${q.x.toFixed(3)},${q.y.toFixed(3)},${q.z.toFixed(3)}`).join(' ')]),
  groups: b.groups.map((g) => [g.id, g.members.length, +g.center.x.toFixed(4)]),
});

const now = town(), all = buildPeople(now.physics, now.spots, { seed: 5 });

test('worked out later, in any order, the crowd is the one worked out at once', () => {
  // (a clock that ticks once a look, not the machine's: a few steps a frame however slow the machine; with
  // performance.now and a 0.0001 ms budget, CI's runners sometimes did nothing in a frame and ran out of frames)
  let tick = 0;
  const later = town(), q = new DeferredWork({ guard: 0, now: () => tick++ });
  const b = runSteps(buildPeopleSteps(later.physics, later.spots, { seed: 5, defer: q }));
  assert.equal(b.later, 5, 'every walk waits');
  assert.ok(b.people.every((p) => !p.walk), 'only those standing about so far');
  assert.ok(b.people.length > 0 && b.people.length === all.people.filter((p) => !p.walk).length);
  // the first frame's near detail: the walk by the spawn, whole, though it reaches 60 m out of the circle
  runSteps(q.needSteps([V(0, 0, 0)], 20));
  assert.equal(b.later, 4);
  assert.ok(b.people.some((p) => p.walk && Math.abs(p.home.z - 4) < 2), 'the walk by the spawn is there');
  // then a frame at a time, from far away (the opposite order to the spawn's)
  for (let f = 0; f < 4000 && q.pending; f++) q.run(V(-500, 0, 6), 4);
  assert.equal(b.later, 0);
  assert.deepEqual(sig(b), sig(all));
});

test('a chunk forced (the guard, a passage) finishes its whole walk at once', () => {
  const later = town(), q = new DeferredWork({ guard: 0 });
  const b = runSteps(buildPeopleSteps(later.physics, later.spots, { seed: 5, defer: q }));
  q.need(V(400, 0, -3), 5);   // (the far end of the east walk)
  assert.equal(b.later, 4);
  const east = b.people.filter((p) => p.walk && p.home.x > 150);
  assert.ok(east.length > 0, 'its strollers are out');
  assert.ok(b.routes.some((r) => r.pts.some((p) => p.x < 230)), 'and its route runs from its start, 170 m from where it was forced');
});

test('the crowd takes the strollers who come later: drawn, counted, told what the story told everyone', () => {
  const later = town(), q = new DeferredWork({ guard: 0 });
  const built = runSteps(buildPeopleSteps(later.physics, later.spots, { seed: 5, defer: q }));
  const crowd = new Crowd(later.scene, later.physics, { spots: later.spots, built, pool: 0 });
  const before = crowd.people.length;
  assert.equal(crowd.pending, 5);
  crowd.persist('lines', (p) => { p.lines = ['the lamp is lit']; });
  q.flush();
  assert.equal(crowd.pending, 0);
  assert.equal(crowd.people.length, all.people.length);
  assert.ok(crowd.people.length > before && crowd.stats.people === crowd.people.length);
  assert.ok(crowd.people.every((p) => p.lines[0] === 'the lamp is lit'), 'the story\'s rule on the late ones too');
  assert.ok(crowd.mid.max >= crowd.people.length && crowd.far.max >= crowd.people.length, 'room in the figures for everyone');
  assert.equal(crowd.shadow.instanceMatrix, crowd.mid.mesh.instanceMatrix);
  const cam = new THREE.PerspectiveCamera(60, 1, 0.1, 3000); cam.position.set(300, 20, 60); cam.lookAt(300, 0, 0); cam.updateMatrixWorld();
  const player = { pos: V(300, 0, 30), vel: V(0, 0, 0) };
  for (let f = 0; f < 5; f++) crowd.update(1 / 60, f / 60, player, cam);
  assert.ok(crowd.mid.n + crowd.far.n > 0, 'the late ones drawn');
  assert.deepEqual(sig(crowd), sig(all));
});
