import test from 'node:test';
import assert from 'node:assert/strict';
import { SHOTS, DURATION, frameAt, actorPosition } from '../src/trailer/timeline.js';
test('trailer reaches every shot at its boundary and finishes at 48 seconds', () => {
  assert.equal(DURATION, 48);
  let t = 0;
  for (const [i, shot] of SHOTS.entries()) {
    const f = frameAt(t);
    assert.equal(f.index, i); assert.deepEqual(f.position, shot.from); assert.equal(f.fade, 1);
    assert.equal(frameAt(t + shot.duration / 2).fade, 0);
    t += shot.duration;
  }
  assert.deepEqual(frameAt(DURATION).position, SHOTS.at(-1).to);
  assert.equal(frameAt(DURATION).fade, 1);
});
test('capture seeks clamp safely and camera moves continuously inside a shot', () => {
  assert.deepEqual(frameAt(-1), frameAt(0));
  assert.deepEqual(frameAt(NaN), frameAt(0));
  assert.deepEqual(frameAt(100), frameAt(DURATION));
  for (let t = 0; t <= DURATION; t += 0.1) {
    const f = frameAt(t);
    assert.ok(f.position.every(Number.isFinite));
    assert.ok(f.fade >= 0 && f.fade <= 1);
  }
});
test('tracking aim follows the bird while the fire shot stays locked', () => {
  const index = SHOTS.findIndex(s => s.name === 'On the wing');
  const start = SHOTS.slice(0, index).reduce((n, s) => n + s.duration, 0);
  for (const offset of [0, 1, 2.5, 4.9]) {
    const f = frameAt(start + offset);
    assert.deepEqual(f.look, f.bird);
    assert.ok(Math.hypot(...f.position.map((v, i) => v - f.bird[i])) > 10);
  }
  const tilt = SHOTS.findIndex(s => s.name === 'The burning crown');
  const t = SHOTS.slice(0, tilt).reduce((n, s) => n + s.duration, 0);
  assert.deepEqual(frameAt(t + 3.9).look, frameAt(t).look);
  assert.deepEqual(frameAt(t + 3.9).position, frameAt(t).position);
});
test('the actual desert flame advances with the cinematic camera, including review seeks', async () => {
  globalThis.document ??= { createElement: () => ({ getContext: () => null, style: {} }), body: {}, getElementById: () => null, querySelector: () => null };
  const THREE = await import('three');
  const { createDesert } = await import('../src/levels/desert.js');
  const { updateTrailerWorld } = await import('../src/trailer/world.js');
  const level = createDesert(new THREE.Scene());
  const camera = new THREE.PerspectiveCamera(70, 16 / 9, 0.5, 5000);
  camera.position.set(213, 3.25, 370.5); camera.lookAt(231.5, 60, 402.6); camera.updateMatrixWorld();
  const flame = level.qanat.city.flames;
  updateTrailerWorld(level, 10, 1 / 30, camera);
  const first = flame.uniforms.uTime.value;
  updateTrailerWorld(level, 11, 1 / 30, camera);
  assert.ok(flame.uniforms.uTime.value > first + 0.3);
  updateTrailerWorld(level, 10, 0, camera);
  assert.ok(Math.abs(flame.uniforms.uTime.value - first) < 1e-6);
});
test('the expanded cut covers six contrasting worlds without extending its runtime', () => {
  assert.equal(DURATION, 48);
  assert.equal(SHOTS.length, 12);
  assert.deepEqual([...new Set(SHOTS.map(s => s.world))], ['desert', 'shaft', 'arzach2', 'spheres', 'buried', 'perdide2']);
});

test('most compositions are locked off, and actors move independently of the camera', () => {
  const locked = SHOTS.filter(s => s.from.every((v, i) => v === s.to[i]) && !s.lookTo);
  assert.equal(locked.length, 9);
  assert.ok(locked.filter(s => s.actors?.length || s.bird).length >= 5);
  assert.deepEqual([...new Set(SHOTS.flatMap(s => (s.actors ?? []).map(a => a.kind)))].sort(), ['flock', 'hero', 'taxi']);
  for (const s of locked) for (const a of s.actors ?? []) if (a.kind !== 'hero' || a.clip === 'climbUp') assert.notDeepEqual(a.from, a.to);
});

test('staged actor routes are seekable and independent of camera easing', () => {
  const cue = { from: [-10, 2, 0], to: [10, 2, 0], start: 0.2, end: 0.8 };
  assert.deepEqual(actorPosition(cue, 0), cue.from);
  assert.ok(Math.abs(actorPosition(cue, 0.5)[0]) < 1e-9);
  assert.deepEqual(actorPosition(cue, 1), cue.to);
  for (const shot of SHOTS) for (const actor of shot.actors ?? []) {
    assert.deepEqual(actorPosition(actor, 0), actor.from);
    assert.deepEqual(actorPosition(actor, 1), actor.to);
  }
});

test('the traveller demonstrates riding and climbing across the cut', () => {
  const heroes = SHOTS.flatMap(s => (s.actors ?? []).filter(a => a.kind === 'hero'));
  assert.ok(heroes.length >= 5);
  assert.ok(heroes.some(a => a.mount === 'bike'));
  assert.ok(heroes.some(a => a.mount === 'bird'));
  assert.ok(heroes.some(a => a.clip === 'climbUp' && a.to[1] > a.from[1]));
});

test('opening walks toward the ship, and the ending changes worlds', () => {
  assert.equal(SHOTS[0].scene, 'horizon');
  const hero = SHOTS[0].actors[0];
  assert.notDeepEqual(hero.from, hero.to);
  const distance = p => Math.hypot(p[0] - 65, p[2] + 180);
  assert.ok(distance(hero.to) < distance(hero.from));
  assert.equal(new Set(SHOTS.slice(-3).map(s => s.world)).size, 3);
  assert.ok(Math.cos(hero.heading) < 0);
  const taxis = SHOTS.find(s => s.world === 'shaft').actors;
  assert.ok(taxis.length >= 8);
  assert.ok(taxis.some(a => a.to[1] > a.from[1]));
  assert.ok(taxis.some(a => a.to[1] < a.from[1]));
  for (const s of SHOTS) for (const a of s.actors ?? []) {
    assert.notEqual(a.kind, 'person');
    if (a.kind === 'hero' && !a.mount && !a.clip) assert.equal(s, SHOTS[0]);
  }
});

test('taxi routes clear the actual shaft geometry with their full vehicle envelopes', async () => {
  const T = await import('three');
  const { referenceBuilder } = await import('../src/trailer/reference-scenes.js');
  const { Physics } = await import('../src/physics.js');
  const { Taxi } = await import('../src/taxi.js');
  const scene = new T.Scene(), iterator = referenceBuilder('shaft')(scene);
  let step; do { step = iterator.next(); } while (!step.done);
  const level = step.value, physics = new Physics(scene);
  for (const cue of SHOTS.find(s => s.world === 'shaft').actors) {
    const taxi = new Taxi(null, cue.color, cue.scale, () => {}, { driver: false, fares: false });
    taxi.object.updateMatrixWorld(true);
    const size = new T.Box3().setFromObject(taxi.object).getSize(new T.Vector3());
    const radius = Math.hypot(size.x, size.z) / 2;
    for (let i = 0; i <= 100; i++) {
      const p = new T.Vector3(...actorPosition(cue, i / 100)).applyMatrix4(level.stage.matrixWorld), before = p.clone();
      physics.pushCapsule(p, radius, -size.y / 2 - 0.15, size.y / 2 + 0.15, new T.Vector3());
      assert.ok(p.distanceTo(before) < 0.001, `Taxi intersects the shaft at ${i}%`);
    }
  }
});

test('both great-bird views include flocks crossing the frame', () => {
  for (const shot of SHOTS.filter(s => s.bird)) assert.ok(shot.actors.some(a => a.kind === 'flock' && a.count >= 9));
});
