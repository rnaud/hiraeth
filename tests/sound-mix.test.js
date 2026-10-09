// The playtest of 8 October 2026's sound notes: footsteps follow the surface underfoot (not the world's
// ground everywhere: leaves on every roof and deck of a grassy world), and the desert wind, the water
// welling up and the mount's whistle sit in the mix instead of over it. The levels are rendered with the
// game's own Sound on engine/webaudio.js (the JS Web Audio), peak RMS over 100 ms windows, in dBFS.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Physics, groundKind } from '../src/physics.js';
import { installAudio } from '../engine/webaudio.js';

const G = globalThis;
G.window ??= G; G.addEventListener ??= () => {}; G.removeEventListener ??= () => {};
delete G.AudioContext; installAudio(G, { sampleRate: 48000 });
const { Sound, footSurface } = await import('../src/audio.js');

const rms = (a) => { let s = 0; for (let i = 0; i < a.length; i += 2) s += a[i] * a[i]; return Math.sqrt(s / Math.max(1, a.length / 2)); };
const peakRms = (a, w = 4800) => { let best = 0; for (let i = 0; i + w * 2 <= a.length; i += w * 2) best = Math.max(best, rms(a.subarray(i, i + w * 2))); return best; };
const dB = (x) => 20 * Math.log10(x + 1e-12);
const CALM = { speed: 0, gust: 0, storm: 0, rain: 0, rainRoof: 0, thrusting: false, riding: false, rideKind: null, rideSpeed: 0, altitude: 0 };
const sounds = [];
const fresh = (level = 'desert') => {
  const s = new Sound(level, { score: false });
  s.start(); clearInterval(s.scheduler); clearTimeout(s._preload);
  s.update(CALM); s.ctx.render(48000);
  sounds.push(s);
  return s;
};
/** Math.random seeded while `fn` runs: the sounds' noise is random, and a level measured 1-2 dB inside a
 *  limit failed now and then on GitHub (the water under the whoosh, 2026-10-09). */
const seeded = (fn, seed = 12345) => {
  const real = Math.random;
  let x = seed >>> 0;
  Math.random = () => { x = (x * 1664525 + 1013904223) >>> 0; return x / 2 ** 32; };
  try { return fn(); } finally { Math.random = real; }
};
/** The loudest 100 ms of `fn`'s sound over the calm, in dB (with the noise seeded, so it is the same every run). */
const loudest = (fn, level, secs = 3) => seeded(() => { const s = fresh(level); fn(s); return dB(peakRms(s.ctx.render(48000 * secs))); });
test.after(() => { for (const s of sounds) { clearInterval(s.scheduler); clearInterval(s.menuTimer); s._unlisten?.(); } });

test('the footsteps\' surface: the world\'s own ground, stone on anything built on it', () => {
  assert.equal(footSurface('home', 'ground'), 'grass');
  assert.equal(footSurface('home', 'built'), 'stone', 'a grassy world\'s roofs, stairs and the ship\'s deck are no longer leaves');
  assert.equal(footSurface('edena', 'built'), 'stone');
  assert.equal(footSurface('desert', 'ground'), 'sand');
  assert.equal(footSurface('desert', 'built'), 'stone');
  assert.equal(footSurface('bazaar', 'ground'), 'stone');
  assert.equal(footSurface('no-such-world'), 'sand');
});

test('groundKind: the heightfield or a world\'s only ground is its own; a mesh standing on the heightfield, or added later, is built', () => {
  const at = (y, o = {}) => ({ point: { y }, ...o });
  assert.equal(groundKind(null, 2, true), 'ground', 'nothing but the heightfield');
  assert.equal(groundKind(at(1.9), 2, true), 'ground', 'a mesh under the heightfield');
  assert.equal(groundKind(at(3), 2, true), 'built', 'a rock or a roof on the heightfield');
  assert.equal(groundKind(at(3), -Infinity, false), 'ground', 'a world built of meshes walks on its own ground');
  assert.equal(groundKind(at(3, { added: true }), -Infinity, false), 'built', 'the ship, a room added later');
  assert.equal(groundKind(at(3, { mover: {} }), -Infinity, false), 'built', 'a moving collider');
});

test('Physics says what is underfoot: the terrain beside a slab, the slab on it, the ship added later', () => {
  const scene = new THREE.Scene();
  const slab = new THREE.Mesh(new THREE.BoxGeometry(4, 1, 4)); slab.position.set(0, 0.5, 0); scene.add(slab);
  const physics = new Physics(scene, { heightAt: () => 0 });
  physics.groundAt(0, 5, 0); assert.equal(physics.groundKind, 'built');
  physics.groundAt(10, 5, 0); assert.equal(physics.groundKind, 'ground');
  const deck = new THREE.Group(), d = new THREE.Mesh(new THREE.BoxGeometry(4, 0.2, 4)); d.position.set(20, 0.1, 0); deck.add(d);
  physics.addCollider(deck);
  physics.groundAt(20, 5, 0); assert.equal(physics.groundKind, 'built', 'the ship\'s deck');
  physics.groundAt(10, 5, 0); assert.equal(physics.groundKind, 'ground');
  const bare = new Physics(new THREE.Scene().add(new THREE.Mesh(new THREE.BoxGeometry(40, 1, 40))));
  bare.groundAt(3, 5, 3); assert.equal(bare.groundKind, 'ground', 'no heightfield: the meshes are the ground');
});

test('a step plays the surface the feet are on (sound.update\'s footing), on landings too', () => {
  const s = fresh('home'), heard = [];
  s.sample = (group) => { heard.push(group); return true; };
  s.step(5);
  s.update({ ...CALM, footing: 'built' }); s.step(5); s.land({ speed: 3 });
  s.update({ ...CALM, footing: 'ground' }); s.step(5);
  assert.deepEqual(heard, ['step-grass', 'step-stone', 'step-stone', 'step-stone', 'step-grass']);
});

test('the desert wind sits under the world: calm, gusting, and in a sandstorm', () => {
  const wind = (st) => { const s = fresh('desert'); for (let f = 0; f < 120; f++) { s.update({ ...CALM, ...st }); s.ctx.render(400); } return dB(rms(s.ctx.render(48000))); };
  const calm = wind({ gust: 0.4 }), gust = wind({ gust: 0.9, speed: 5 }), storm = wind({ gust: 1, storm: 1, speed: 5 });
  // (before: -46.7, -42.4 and -32.3 dB; a footstep's synth is about -42 dB, the music about -27 dB)
  assert.ok(calm < -50, `calm ${calm.toFixed(1)} dB`);
  assert.ok(gust < -45, `gusting, walking ${gust.toFixed(1)} dB`);
  assert.ok(storm < -38 && storm > calm + 6, `a sandstorm rises over the calm but stays under the world: ${storm.toFixed(1)} dB`);
});

test('the mount\'s whistle and the train\'s are no longer the loudest things in the game', () => {
  const mount = loudest((s) => s.whistle('mount')), taxi = loudest((s) => s.whistle('taxi'));
  const train = loudest((s) => s.trainWhistle(s.ctx.currentTime));
  // (before: -20.8 and -27.1 dB)
  assert.ok(mount < -28 && mount > -40, `the mount's whistle ${mount.toFixed(1)} dB`);
  assert.ok(taxi < -28, `a taxi's hail ${taxi.toFixed(1)} dB`);
  assert.ok(train < -29, `the train's whistle ${train.toFixed(1)} dB`);
});

test('water welling up: a soft gurgle, well under the old whoosh, with no click', () => {
  const water = loudest((s) => s.waterRise());
  const whoosh = loudest((s) => s.whoosh());
  assert.ok(water < -32 && water > -46, `the water ${water.toFixed(1)} dB`);
  assert.ok(water < whoosh - 8, `under the whoosh (${whoosh.toFixed(1)} dB) by 8 dB`);
  const s = fresh('desert');
  s.waterRise({ dur: 3 });
  const a = s.ctx.render(48000 * 2);
  let first = 0; for (let i = 0; i < 2400 * 2; i++) first = Math.max(first, Math.abs(a[i]));
  assert.ok(first < 0.05, `no click as it starts (peak ${first.toFixed(3)})`);
  s.waterRise({ vol: 0 });   // (nothing, and no exponential ramp to 0, which a browser throws on)
});
