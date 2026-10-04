import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

// The giant's chest is dry until the rib is pushed off the channel: no pool, no stream, only damp
// stains. Then the stream runs out of the crack down to the basin, and the pool fills it from the
// bottom up. A save with the channel already open finds it full.

const el = () => ({ classList: { add() {}, remove() {}, toggle() {}, contains: () => false }, style: {}, dataset: {}, remove() {}, addEventListener() {}, querySelector: () => null, appendChild() {}, set textContent(v) {}, set innerHTML(v) {} });
globalThis.document ??= { createElement: el, body: el(), getElementById: () => null, querySelector: () => null };

const { createDesert } = await import('../src/levels/desert.js');
const { Physics } = await import('../src/physics.js');
const { createStory } = await import('../src/story/index.js');
const { game } = await import('../src/game-state.js');
const { THINGS } = await import('../src/story/desert-data.js');
const { allTargets } = await import('../src/targets.js');

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const flat = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

/** A desert with its story running, the camera and the stand-in player down in the cave. */
function desert() {
  const scene = new THREE.Scene();
  const level = createDesert(scene);
  const physics = new Physics(scene, level.ground);
  const cave = level.qanat.cave;
  const player = { pos: cave.inside.clone(), vel: V(0, 0, 0), wind: V(0, 0, 0), heading: 0, riding: false, frame: { up: V(0, 1, 0), dir: (h, out) => out.set(Math.sin(h), 0, Math.cos(h)) } };
  const toasts = [];
  const sound = { setBands() {}, setBandMode() {}, band: () => null, chime() {}, listen() {}, whoosh() {} };
  const rt = createStory({ levelId: 'desert', scene, physics, level, player, npcs: [], crowd: null, sound, journal: { sections: [], el: { addEventListener() {} } }, story: { complete() {} },
    capture: null, lib: null, humans: null, toast: (t) => toasts.push(t), tool: null });
  const camera = new THREE.PerspectiveCamera();
  let t = 0;
  const step = (n = 1, dt = 1 / 30) => {
    for (let i = 0; i < n; i++) {
      t += dt;
      camera.position.copy(player.pos).add(V(0, 2, 4));
      rt.update(dt, t, { camera });
      level.update?.(dt, t, { camera, player });
    }
  };
  return { scene, level, physics, cave, player, rt, step, toasts };
}

test('the giant’s chest is dry until the channel is open: no pool, no stream, damp stains only', () => {
  game.reset();
  const D = desert(), { cave, player, step, toasts } = D;
  step(3);
  assert.equal(cave.wet, false, 'no pool');
  assert.equal(cave.pool.visible, false, 'no water surface in the basin');
  assert.equal(cave.flow, 0, 'no stream');
  assert.equal(cave.stream.visible, false, 'nothing in the channel');
  assert.equal(cave.stream.geometry.drawRange.count, 0);
  // the basin is still there to walk down into; wading it, you find it dry
  player.pos.copy(cave.poolCenter).setY(cave.origin.y - 1.6);
  step(2);
  assert.ok(toasts.some((x) => /dry/i.test(x)), 'the basin is dry');
  assert.ok(!toasts.some((x) => /water is shallow/.test(x)));
  // what you see when you look at the rib: a dry channel (no trapped water behind it)
  const said = THINGS.bone.talk.nodes.look.say.join(' ');
  assert.match(said, /dry/);
  assert.doesNotMatch(said, /water stands/);

  // push the rib clear: the stream runs out of the crack, segment by segment, then the pool fills from the bottom
  const bone = allTargets().find((x) => x.kind === 'bone');
  player.pos.copy(cave.bone.position).add(V(3, 0, 3));
  bone.onHit('push');
  assert.equal(game.flag('desert.channel.open'), true);
  step(15);                                  // half a second: the rib is rolling
  const flows = [];
  for (let i = 0; i < 6; i++) { step(15); flows.push(cave.flow); }
  assert.ok(flows[0] > 0 && flows[0] < 1, `the stream starts running (${flows[0].toFixed(2)})`);
  for (let i = 1; i < flows.length; i++) assert.ok(flows[i] >= flows[i - 1], 'and runs on down the channel');
  assert.ok(cave.stream.visible && cave.stream.geometry.drawRange.count > 0, 'drawn as far as it has run');
  // it reaches the pool: the basin fills, the water widening up its sides
  for (let i = 0; i < 60 && !cave.wet; i++) step(5);
  assert.equal(cave.flow, 1, 'the stream reaches the pool first');
  assert.ok(cave.wet && cave.pool.visible, 'then there is water in the basin');
  const r0 = cave.pool.scale.x, y0 = cave.pool.position.y;
  step(30 * 4);
  assert.ok(cave.pool.position.y > y0 + 0.2 && cave.pool.scale.x > r0, 'it rises and widens');
  step(30 * 12);
  assert.ok(Math.abs(cave.level - cave.levels.high) < 1e-6, 'full');
  assert.ok(Math.abs(cave.pool.scale.x - (cave.basinR(cave.levels.high) - 0.1)) < 1e-3, 'brim to brim with the basin');
  // the waterline meets the floor: just inside it, the bed is under the water; just outside, above it
  const edge = cave.pool.scale.x, c = cave.poolCenter;
  const bedIn = D.physics.groundAt(c.x + edge - 0.6, c.y + 3, c.z), bedOut = D.physics.groundAt(c.x + edge + 0.6, c.y + 3, c.z);
  assert.ok(bedIn < cave.pool.position.y && bedOut > cave.pool.position.y, `the water stands in its basin (${bedIn.toFixed(2)} < ${cave.pool.position.y.toFixed(2)} < ${bedOut.toFixed(2)})`);
  game.reset();
});

test('a save with the channel already open finds the stream running and the pool full', () => {
  game.reset();
  game.set('desert.channel.open', true);
  const { cave, step } = desert();
  step(1);
  assert.equal(cave.flow, 1);
  assert.ok(cave.wet && cave.pool.visible && cave.stream.visible);
  assert.ok(Math.abs(cave.level - cave.levels.high) < 1e-6, 'full from the start');
  assert.ok(flat(cave.bone.position, cave.boneRest.pos) > 2, 'the rib lies where it rolled');
  game.reset();
});
