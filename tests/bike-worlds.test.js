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
  // the one game setup brings it out, for both hosts (src/host/game-host.js, #427): the whistle's where the bird doesn't
  // answer, parked by the ramp where she does
  const host = readFileSync(new URL('../src/host/game-host.js', import.meta.url), 'utf8');
  assert.match(host, /bikeComes\(levelId, level/);
  assert.match(host, /if \(bikeHere && !level\.mount\)/);
  assert.match(host, /player\.vehicles\.push\(bike\)/);
  for (const f of ['../src/main.js', '../engine/game.js']) assert.match(readFileSync(new URL(f, import.meta.url), 'utf8'), /wireVehicles\(\{ bikeHere,/, f);
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

test('#249: the hoverbike is called from your pack, not whistled for; the bird keeps her call, a taxi its whistle', async () => {
  const { callKind } = await import('../src/bike-worlds.js');
  assert.equal(callKind('mount', 'hoverbike', true), 'pack', 'the bike: a pulse from the pack');
  assert.equal(callKind('mount', 'hoverbike', false), null, 'no pack, no call: it runs on it (the notice says it needs power)');
  assert.equal(callKind('mount', 'bird', true), 'rider', 'Vael’s bird: the rider’s call on the flute');
  assert.equal(callKind('taxi', 'hoverbike', true), 'whistle', 'a cab is hailed with a whistle');
  const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  assert.match(main, /callKind\(kind, level\.mountName/, 'main.js sounds the call as callKind says');
  const audio = readFileSync(new URL('../src/audio.js', import.meta.url), 'utf8');
  assert.match(audio, /\n {2}packCall\(\) \{/, 'the pack’s call has its own sound');
  const en = readFileSync(new URL('../src/i18n/en.js', import.meta.url), 'utf8');
  for (const key of ['teach.bikeCall', 'ctl.k.use.how']) assert.doesNotMatch(en.match(new RegExp(`'${key}': '[^\\n]*`))[0], /whistl/i, `${key}: no whistle`);
});

test('#376: the hover trails follow the vehicle you ride, the bike by the ship too where the bird is the world’s mount', async () => {
  const { laysTrail, trailVehicles, trailVehicle } = await import('../src/bike-worlds.js');
  const { Hoverbike } = await import('../src/bike.js');
  const { Bird } = await import('../src/bird.js');
  const physics = new Physics(new THREE.Scene(), null);
  const bird = quiet(() => new Bird(physics)), bike = parkedBike(physics, new THREE.Vector3(), 0);
  const skiff = new Hoverbike(physics, { kind: 'skiff' }), cab = { kind: 'taxi', vel: new THREE.Vector3() };
  assert.equal(laysTrail(bike), true, 'the hoverbike');
  assert.equal(laysTrail(skiff), true, 'the skiff');
  assert.equal(laysTrail(bird), false, 'not the bird');
  assert.equal(laysTrail(cab), false, 'not a cab');
  // Viridel with the bird's promise: the bird is the mount, the bike one of the vehicles (main.js bikeHere)
  const player = { mount: bird, vehicles: [bird, cab, bike], ride: null };
  assert.deepEqual(trailVehicles(player), [bike], 'the bike lays them, though not the mount');
  assert.equal(trailVehicle(player), bike, 'on foot: the bike’s (fading)');
  player.ride = bike; assert.equal(trailVehicle(player), bike, 'riding the bike');
  player.ride = bird; assert.equal(trailVehicle(player, bike), bike, 'on the bird: still the bike’s, fading out');
  assert.equal(trailVehicle({ vehicles: [bird], ride: bird }), null, 'only the bird: no trails');
  const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  assert.match(main, /trailVehicle\(player, trailBy\)/, 'main.js lays them behind the vehicle trailVehicle names');
  assert.doesNotMatch(main, /player\.mount\.kind !== 'bird' \? \[new Trail/, 'not made for the mount alone');
});
