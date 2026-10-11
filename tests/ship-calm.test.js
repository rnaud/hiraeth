// Calm by the ship (issue #84): no strollers round the hull and the ramp, and whoever stands there idles slower.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { buildPeople } from '../src/crowd.js';
import { Physics } from '../src/physics.js';
import { SHIP_CALM, shipCalmZones, inCalm } from '../src/npc.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const quiet = (f) => { const l = console.log, w = console.warn, i = console.info; console.log = console.warn = console.info = () => {}; try { return f(); } finally { console.log = l; console.warn = w; console.info = i; } };

test('the ship\'s calm zones: the hull and the ramp\'s foot', () => {
  const z = shipCalmZones(V(0, 0, 0), V(0, 0, 12));
  assert.equal(z.length, 2);
  assert.ok(inCalm(V(3, 0, 2), z), 'by the hull');
  assert.ok(inCalm(V(0, 0, 12 + SHIP_CALM.ramp - 1), z), 'out from the ramp');
  assert.ok(!inCalm(V(60, 0, 0), z), 'well off');
  assert.ok(SHIP_CALM.idle < 1 && SHIP_CALM.walk < 1 && SHIP_CALM.pause > 1, 'slower, and longer waits');
});

test('a strollers\' route past the ship is cut where it runs by the hull; a procession keeps its loop', () => {
  const scene = new THREE.Scene();
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(600, 600).rotateX(-Math.PI / 2)));
  const physics = new Physics(scene);
  const line = Array.from({ length: 41 }, (_, i) => V(-100 + i * 5, 0, 0));   // straight past the hull at the origin
  const calm = shipCalmZones(V(0, 0, 0), V(0, 0, 10));
  const near = (people) => people.filter((p) => p.walk && Math.hypot(p.pos.x, p.pos.z) < SHIP_CALM.hull - 1).length;
  const without = quiet(() => buildPeople(physics, { walks: [{ path: line, count: 12 }] }, { seed: 3 }));
  const withCalm = quiet(() => buildPeople(physics, { walks: [{ path: line, count: 12 }] }, { seed: 3, calm }));
  const pts = (b) => b.routes.flatMap((r) => r.pts);
  assert.ok(pts(without).some((p) => Math.hypot(p.x, p.z) < SHIP_CALM.hull), 'without: the route runs by the hull');
  assert.ok(!pts(withCalm).some((p) => Math.hypot(p.x, p.z) < SHIP_CALM.hull - 0.5), 'with: no route point by the hull');
  assert.equal(near(withCalm.people), 0, 'nobody walking there');
  assert.ok(withCalm.routes.length >= 1, 'the rest of the route kept');
  const src = readFileSync(new URL('../src/crowd.js', import.meta.url), 'utf8');
  assert.match(src, /avoid: sp\.column \? avoid : walkAvoid/, 'a procession\'s loop is not cut');
});

test('the game sets the zones from the ship, and people standing there idle slower', () => {
  const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8'), npc = readFileSync(new URL('../src/npc.js', import.meta.url), 'utf8');
  assert.match(main, /const shipCalm = shipCalmZones\(ship\.restPos, ship\.rampFoot\);\nsetCalmZones\(shipCalm\);/);
  assert.match(main, /buildPeopleSteps\(physics, crowdSpots, \{ seed: 11, clear: crowdClear, calm: shipCalm \}\)/);
  assert.match(npc, /this\.pose\(this\._poseDt \* \(calmIdle \? SHIP_CALM\.idle : 1\)/, 'a story person');
  assert.match(npc, /this\.pose\(dt \* \(calmIdle \? SHIP_CALM\.idle : 1\)/, 'a crowd person close up');
  assert.match(npc, /speed = this\.speed \* \(calm \? SHIP_CALM\.walk : 1\)/, 'a route walked slower there');
});
