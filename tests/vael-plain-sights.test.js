// Vael's plain and its two blind legs (level design audit v1.49, issue #133; docs/systems/worlds.md "Vael: the plain's
// sights, Aube's smoke and the founders' lamp"): the walk from the Aerie to the lone tower passes the great bird's bones
// and the riders' shrine, Aube's smoke shows from the riders' gate, and the founders' lamp over the Belfry from Calix at
// the foot of his bell tower.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

await import('./register-gadgets.js');
const A = await import('./playthrough-agent.js');
const { THINGS } = await import('../src/story/arzach-data.js');
const { THINGS: THINGS2 } = await import('../src/story/arzach2-data.js');
const { templeOf } = await import('../src/temples/index.js');
const { game } = await import('../src/game-state.js');

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const flat = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
/** As the level design audit sees: nothing the collision holds between the eye and the point, and no ground over the ray. */
function sees(W, eye, at) {
  const d = eye.distanceTo(at), dir = at.clone().sub(eye).normalize();
  if (W.physics.rayDistance(eye.clone(), dir, d) < d - 3) return false;
  for (let s = 6; s < d - 3; s += 6) { const p = eye.clone().addScaledVector(dir, s); if (W.level.ground.heightAt(p.x, p.z) > p.y + 0.3) return false; }
  return true;
}
const beacon = (W, name) => { const b = W.level.beacons.find((x) => x.name === name); return b && { top: V(...b.top), height: b.height, aim: V(b.top[0], b.top[1] - b.height * 0.2, b.top[2]) }; };

globalThis.location = { search: '?level=arzach' };
const W = A.loadWorld('arzach');
test.after(() => { game.set('arzach2.bell.rung', undefined); W.dispose(); });

test('the plain from the Aerie to the lone tower: the great bird’s bones and the riders’ shrine on the way, no stretch over 35 s with nothing near', () => {
  const door = templeOf(W.level, 'arzach').outside.door.at, T = W.level.arzach.tower, tower = V(T.x, T.base, T.z);
  const { bones, shrine } = W.level.arzach.plain;
  const places = [door, tower, bones.at, shrine.at];
  // each a few steps off the straight walk, to turn aside for (the pull: 30–150 m off is a detour, nearer is on the way)
  const off = (p) => { const dx = tower.x - door.x, dz = tower.z - door.z, t = ((p.x - door.x) * dx + (p.z - door.z) * dz) / (dx * dx + dz * dz); return { t, d: Math.hypot(p.x - door.x - dx * t, p.z - door.z - dz * t) }; };
  for (const [name, p] of [['the bones', bones.at], ['the shrine', shrine.at]]) { const o = off(p); assert.ok(o.t > 0.2 && o.t < 0.8 && o.d > 8 && o.d < 40, `${name} beside the walk (${(o.t * 100).toFixed(0)} %, ${o.d.toFixed(0)} m off)`); }
  // the longest stretch of the walk with nothing within 40 m, at a run (8.2 m/s): under 35 s
  let run = 0, longest = 0;
  const L = flat(door, tower);
  for (let s = 0; s <= L; s += 5) {
    const p = door.clone().lerp(tower, s / L);
    if (places.every((q) => flat(q, p) > 40)) { run += 5; longest = Math.max(longest, run); } else run = 0;
  }
  assert.ok(longest / 8.2 < 35, `the longest empty stretch ${longest} m (${(longest / 8.2).toFixed(0)} s); it was 483 m`);
  assert.ok(W.level.sights.some((s) => /bird’s bones/.test(s.name)) && W.level.sights.some((s) => /riders’ shrine/.test(s.name)), 'both places to stop');
  for (const id of ['bones', 'shrine']) assert.ok(THINGS[id]?.talk.nodes.look.say.length >= 3, `${id} can be looked at`);
  // what stands collides; the cloth, the ring and the streamers are drawn only
  assert.ok(!W.scene.getObjectByName('The great bird’s bones').userData.noCollide && !W.scene.getObjectByName('The riders’ shrine').userData.noCollide);
  assert.ok(W.scene.getObjectByName('The riders’ shrine’s streamers').userData.noCollide);
  for (const p of [bones.at, shrine.at]) assert.ok(Math.abs(p.y - W.level.ground.heightAt(p.x, p.z)) < 0.6, 'on the sand');
});

test('the flight from the riders’ gate to Sister Aube: her smoke shows over the sky stones from the gate', () => {
  const { gate } = W.level.arzach2;
  const aube = W.npcs.find((n) => n.def?.id === 'aube');
  const b = beacon(W, 'Aube’s smoke');
  assert.ok(b && flat(b.top, aube.pos) < 80, `a landmark by her (${b && flat(b.top, aube.pos).toFixed(0)} m)`);
  const eye = gate.at.clone().add(V(0, 1.7, 0));
  assert.ok(!sees(W, eye, aube.pos.clone().add(V(0, 2, 0))), 'her hermitage itself is behind the stones');
  assert.ok(sees(W, eye, b.aim), 'the smoke shows over them');
  assert.ok(W.scene.getObjectByName('Aube’s smoke')?.userData.noCollide, 'smoke is drawn only');
  assert.ok(THINGS2.gate.talk.nodes.look.say.some((l) => /smoke/.test(typeof l === 'string' ? l : l.text)), 'the gate’s look points at it');
});

test('Calix waits at the foot of his bell tower, where the founders’ lamp over the Belfry shows; it lights when the bell rings', () => {
  const calix = W.npcs.find((n) => n.def?.id === 'calix');
  const rope = W.level.arzach2.ropeFoot;
  assert.ok(flat(calix.pos, rope) < 10 && flat(calix.pos, rope) > 3, `beside the bell rope, not on it (${flat(calix.pos, rope).toFixed(1)} m)`);
  const lamp = W.level.arzach2.belfryLamp, door = templeOf(W.level, 'arzach2').outside.door.at;
  const b = beacon(W, 'the founders’ lamp');
  assert.ok(lamp && b && flat(b.top, door) < 80, 'a beacon over the Belfry, by its door');
  const eye = calix.pos.clone().add(V(0, 1.7, 0));
  assert.ok(!sees(W, eye, door.clone().add(V(0, 2, 0))), 'the Belfry’s door is below the cliff');
  assert.ok(sees(W, eye, b.aim) && sees(W, eye, lamp.at), 'the lamp shows over the roofs');
  W.step(1);
  assert.ok(!lamp.isLit(), 'cold while the bell is silent');
  game.set('arzach2.bell.rung', true);
  W.step(1);
  assert.ok(lamp.isLit(), 'lit once it has rung');
});
