import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { Physics } from '../src/physics.js';
import { buildableById } from '../src/levels/buildable.js';
import { ORDER } from '../src/levels/names.js';
import { BIKE_WORLDS, bikeComes, parkedBike, parkingSpot } from '../src/bike-worlds.js';
import { birdAnswers } from '../src/bird.js';

// The hoverbike in the worlds after the desert (issue #86, src/bike-worlds.js): found in the desert, it comes out of
// the ship in the worlds made for riding, and only there; parked by the ramp on open ground.

const quiet = (fn) => { const w = console.warn; console.warn = () => {}; try { return fn(); } finally { console.warn = w; } };
const flags = (o) => (k) => o[k];

test('the bike comes along once found, only to the worlds made for riding, never where the world has a mount of its own', () => {
  const found = flags({ 'desert.bike.found': true });
  for (const id of Object.keys(BIKE_WORLDS)) {
    assert.ok(ORDER.includes(id), `${id}: a world on the route`);
    assert.equal(bikeComes(id, { features: { mount: false } }, found), true, id);
    assert.equal(bikeComes(id, { features: { mount: false } }, flags({})), false, `${id}: not before it is found`);
  }
  // the worlds it can't work in: domes under the sea, a shaft's terraces, islands over the void, a workshop, streets
  for (const id of ['underwater', 'incal', 'spacecity', 'moonfoundry', 'bazaar', 'home', 'lantern', 'arena', 'overnighttrain'])
    assert.equal(bikeComes(id, { features: { mount: false } }, found), false, `${id}: on foot`);
  // a world with a mount of its own keeps it (the desert's bike, Lorn's skiff, Vael's bird)
  for (const id of ['desert', 'perdide', 'arzach']) assert.equal(bikeComes(id, { features: { mount: true } }, found), false, id);
  // every world on the route is decided, and the module says why for each
  const src = readFileSync(new URL('../src/bike-worlds.js', import.meta.url), 'utf8');
  for (const id of ORDER) assert.match(src, new RegExp(`//\\s.*\\b${id}\\b`), `${id}: decided in src/bike-worlds.js`);
  // main.js brings it out: the whistle's where the bird doesn't answer, parked by the ramp where she does
  const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  assert.match(main, /bikeComes\(levelId, level/);
  assert.match(main, /if \(bikeHere && !level\.mount\)/);
  assert.match(main, /player\.vehicles\.push\(bike\)/);
});

test('where Vael’s bird answers (Viridel, the Garden of Spheres), she keeps the whistle and the bike stands by the ship', () => {
  const both = flags({ 'desert.bike.found': true, 'bird.promise': true });
  for (const id of ['edena', 'spheres']) {
    const level = { features: { mount: false } };
    assert.equal(birdAnswers(id, level, both), true, `${id}: the bird answers`);
    assert.equal(bikeComes(id, level, both), true, `${id}: and the bike comes too`);
  }
});

test('in each riding world the bike is parked by the ship’s ramp, on open ground, ready to board', () => {
  for (const id of Object.keys(BIKE_WORLDS)) {
    const scene = new THREE.Scene();
    const level = quiet(() => buildableById(id).create(scene));
    const physics = new Physics(scene, level.ground?.heightAt ? level.ground : null);
    level.init?.(physics);
    const spawn = level.spawn, h = level.spawnHeading ?? 0;
    const bike = parkedBike(physics, spawn, h);
    assert.ok([bike.pos.x, bike.pos.y, bike.pos.z].every(Number.isFinite), `${id}: placed`);
    const at = parkingSpot(spawn, h), d = Math.hypot(at.x - spawn.x, at.z - spawn.z);
    assert.ok(d > 5 && d < 8, `${id}: beside the ramp (${d.toFixed(1)} m)`);
    const g = physics.groundAt(bike.pos.x, bike.pos.y + 1, bike.pos.z, 6);
    assert.ok(Number.isFinite(g) && bike.pos.y - g > 0.2 && bike.pos.y - g < 1.6, `${id}: hovering over the ground (${(bike.pos.y - g).toFixed(2)} m)`);
    assert.ok(Math.abs(g - spawn.y) < 3, `${id}: on the landing's ground, not on a roof (${(g - spawn.y).toFixed(1)} m)`);
    // room round it to get on and ride off (nothing solid where it stands)
    const room = physics.roomAt(new THREE.Vector3(bike.pos.x, g + 1.2, bike.pos.z), 1.5);
    assert.ok(room > 1.1, `${id}: room round it (${room.toFixed(2)} m to the nearest surface)`);
    assert.equal(bike.dormant, false, `${id}: awake`);
  }
});
