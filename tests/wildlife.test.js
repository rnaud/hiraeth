import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Wildlife, WILDLIFE } from '../src/wildlife.js';
import { allTargets, clearTargets, raycastTargets, hitTarget } from '../src/targets.js';
import { Physics } from '../src/physics.js';
import { LEVELS } from '../src/levels/index.js';
import { CONTENT } from '../src/levels/content.js';
import { buildableById } from '../src/levels/buildable.js';
import { wildlifeOf } from '../src/wildlife.js';

const Y = new THREE.Vector3(0, 1, 0);
const built = new Map();
/** a real level with its collision and wildlife (cached per id) */
function world(id) {
  if (!built.has(id)) {
    const meta = buildableById(id), scene = new THREE.Scene();   // (a merged world's part on its own too: src/levels/buildable.js)
    const level = meta.create(scene);
    const physics = new Physics(scene, level.ground.heightAt ? level.ground : null);
    level.init?.(physics);
    built.set(id, { scene, level, physics, wildlife: new Wildlife(scene, level, physics, { content: CONTENT[id] }) });
  }
  return built.get(id);
}
/** a stand-in for the player: standing still, far from everything unless moved */
const player = (pos) => ({ pos: pos.clone(), vel: new THREE.Vector3(), onGround: true, frame: { up: Y.clone() }, vehicles: [] });
const camera = (at) => { const c = new THREE.PerspectiveCamera(); c.position.copy(at).add(new THREE.Vector3(0, 2, 6)); c.lookAt(at); c.updateMatrixWorld(); return c; };
function run(w, p, cam, seconds, t0 = 0) { let t = t0; for (let i = 0; i < seconds * 60; i++) { t += 1 / 60; w.update(1 / 60, t, p, cam); } return t; }

test('every visible world has two or three species of its own, each with a different surprise', () => {
  const tricks = new Map();
  for (const meta of LEVELS.filter((l) => !l.hidden)) {
    const defs = WILDLIFE[meta.id];
    assert.ok(defs, `${meta.id} has wildlife`);
    assert.ok(defs.length >= 2 && defs.length <= 3, `${meta.id} has ${defs.length} species`);
    const total = defs.reduce((s, d) => s + d.count, 0);
    assert.ok(total >= 8 && total <= 20, `${meta.id} has ${total} creatures`);
    for (const d of defs) {
      assert.ok(d.trick?.pose && d.trick.dur > 0, `${d.id} has a surprise`);
      if (meta.side) continue;   // (a detour off the route borrows a route world's creatures: names.js SIDE)
      assert.ok(!tricks.has(d.trick.name), `${d.id} repeats the surprise of ${tricks.get(d.trick.name)}`);
      tricks.set(d.trick.name, `${meta.id}/${d.id}`);
    }
  }
  assert.ok((WILDLIFE.atelier ?? []).length <= 1, 'the atelier stays quiet');
  // a merged world's creatures: its parts', each round its own places (Vael's on the plain, the sky stones' on their plateau)
  const vael = world('arzach');
  const ids = wildlifeOf(vael.level, CONTENT.arzach).map((d) => d.id);
  for (const d of [...WILDLIFE.arzach, ...WILDLIFE.arzach2]) assert.ok(ids.includes(d.id), `Vael has the ${d.id}`);
  const crab = vael.wildlife.creatures.find((c) => c.species.id === WILDLIFE.arzach2[0].id);
  assert.ok(crab && crab.pos.z > -900, `the sky stones’ ${WILDLIFE.arzach2[0].id} lives over the cloud, not on Vael’s plain (z ${crab?.pos.z.toFixed(0)})`);
});

for (const id of ['spheres', 'bazaar', 'perdide2', 'incal']) {
  test(`${id}: creatures spawn on solid ground (or in water if they swim), clear of the spawn`, () => {
    const { level, physics, wildlife } = world(id);
    const C = wildlife.creatures;
    assert.ok(C.length >= 8, `${id} spawned ${C.length}`);
    for (const def of WILDLIFE[id]) assert.ok(C.some((c) => c.species.id === def.id), `${def.id} spawned`);
    for (const c of C) {
      const { x, y, z } = c.pos, name = `${c.species.id} at ${x.toFixed(1)},${y.toFixed(1)},${z.toFixed(1)}`;
      const ground = physics.groundAt(x, y + 0.5, z, 6);
      assert.ok(Number.isFinite(ground), `${name} has ground below`);
      if (c.species.habitat === 'water') {
        const w = wildlife.waterAt(x, z);
        assert.ok(Math.abs(w - y) < 0.01, `${name} swims at the surface`);
        assert.ok(w - ground > 0.25, `${name} is in water deep enough`);
      } else {
        assert.ok(Math.abs(ground - y) < 0.15, `${name} stands on the ground (${ground})`);
        assert.ok(!(wildlife.waterAt(x, z) > y), `${name} is not under water`);
        assert.ok(!level.unsafe?.(c.pos), `${name} is not somewhere unsafe`);
      }
      assert.ok(c.pos.distanceTo(level.spawn) >= 9, `${name} keeps off the spawn`);
      assert.equal(c.herd.parts[0].mesh.userData.noCollide, true);
    }
    assert.equal(wildlife.root.userData.noCollide, true);
  });
}

test('wandering keeps creatures on walkable ground', () => {
  const { physics, wildlife } = world('spheres');
  const c = wildlife.creatures.find((k) => k.species.habitat !== 'water');
  const p = player(c.pos.clone().add(new THREE.Vector3(40, 0, 0))), cam = camera(c.pos);
  for (let i = 0; i < 6; i++) {
    run(wildlife, p, cam, 2, 100 + i * 2);
    const g = physics.groundAt(c.pos.x, c.pos.y + 0.6, c.pos.z, 2);
    assert.ok(Math.abs(g - c.pos.y) < 0.3, `${c.species.id} still on the ground (${g} vs ${c.pos.y})`);
  }
});

test('a stilling glob freezes a creature in an enchanted shimmer (no surprise), then it wakes and wanders off calmly', () => {
  clearTargets();
  const { scene, level, physics } = world('bazaar');
  const w = new Wildlife(scene, level, physics, { content: CONTENT.bazaar });
  const c = w.creatures[0], p = player(c.pos.clone().add(new THREE.Vector3(30, 0, 0))), cam = camera(c.pos);
  run(w, p, cam, 0.5);
  // a glob finds it through the shared registry
  const eye = c.center.clone().add(new THREE.Vector3(0, 0.5, 6));
  const dir = c.center.clone().sub(eye).normalize();
  const hit = raycastTargets(eye, dir, 20);
  assert.equal(hit?.target.kind, 'wildlife');
  assert.equal(hit.target.creature, c);
  const tones = ['#d6f0fa', '#86bfe8', '#5a8ed6'];
  hitTarget(hit, 'stun', dir, { colours: tones });
  assert.equal(c.state, 'stun');
  assert.equal(c.stunned, true);
  assert.deepEqual(c.tones, tones, 'it takes the fluid\'s tones');
  const at = c.pos.clone();
  run(w, p, cam, 3, 10);
  assert.equal(c.state, 'stun', 'still frozen after 3 s');
  assert.ok(c.pos.distanceTo(at) < 1e-6, 'it does not move while enchanted');
  assert.ok(c.tint > 0.9, 'it is fully enchanted');
  // its tint shimmers: not white, and changing from one moment to the next
  const part = c.herd.parts[0].mesh, col = () => { const v = new THREE.Color(); part.getColorAt(c.index, v); return v; };
  const c1 = col();
  run(w, p, cam, 0.6, 13.1);
  const c2 = col();
  assert.ok(Math.abs(c1.r - 1) + Math.abs(c1.g - 1) + Math.abs(c1.b - 1) > 0.1, 'tinted in the fluid\'s colours');
  assert.ok(Math.abs(c1.r - c2.r) + Math.abs(c1.g - c2.g) + Math.abs(c1.b - c2.b) > 0.01, 'the colours shift');
  assert.equal(w.stars.mesh.count, 3, 'stars wheel over its head');
  assert.equal(hit.target.enabled(), true, 'a stunned creature can still be hit');
  run(w, p, cam, 3.5, 20);
  assert.notEqual(c.state, 'stun', 'it wakes up within 6 s');
  assert.notEqual(c.state, 'trick', 'waking is calm, no surprise');
  run(w, p, cam, 2, 30);
  assert.ok(c.tint < 0.1, 'its own colour comes back');
  // the push does not enchant: it sets off the surprise
  c.cool = 0;
  const target = allTargets().find((t) => t.creature === c);
  if (target.enabled()) { target.onHit('push', c.center.clone(), new THREE.Vector3(0, 0, -1)); assert.equal(c.state, 'trick'); }
  // a plain glob of fluid splashes: a glint of colour, and it scampers off (no freeze); an ember glob scares it
  const d = w.creatures.find((k) => k !== c && k.visible && k.state !== 'trick');
  if (d) {
    const td = allTargets().find((t) => t.creature === d);
    hitTarget({ target: td, point: d.center.clone() }, 'shoot', new THREE.Vector3(0, 0, -1), { colours: ['#52c8cf', '#966ede'] });
    assert.equal(d.state, 'flee', 'splashed: it runs');
    assert.ok(d.tint > 0.5, 'glinting in the fluid');
    d.state = 'idle'; d.cool = 0;
    hitTarget({ target: td, point: d.center.clone() }, 'fire', new THREE.Vector3(0, 0, -1), {});
    assert.equal(d.state, 'trick', 'an ember glob sets off its surprise: it flees');
  }
  w.dispose();
});

test('the push (or a scare) sets off the surprise, then the creature recovers or comes back later', () => {
  clearTargets();
  const { scene, level, physics } = world('spheres');
  const w = new Wildlife(scene, level, physics, { content: CONTENT.spheres });
  for (const def of WILDLIFE.spheres) {
    const c = w.creatures.find((k) => k.species.id === def.id);
    const p = player(c.pos.clone().add(new THREE.Vector3(40, 0, 0))), cam = camera(c.pos);
    const target = allTargets().find((t) => t.creature === c);
    target.onHit('push', c.center.clone(), new THREE.Vector3(0, 0, -1));
    assert.equal(c.state, 'trick', `${def.id} plays its surprise`);
    assert.equal(target.enabled(), false, 'mid-surprise it cannot be hit again');
    run(w, p, cam, def.trick.dur + 0.5, 50);
    assert.notEqual(c.state, 'trick', `${def.id} finished its surprise`);
    if (def.trick.end === 'gone') {
      assert.equal(c.state, 'gone');
      p.pos.copy(c.pos).add(new THREE.Vector3(60, 0, 0));
      run(w, p, cam, 40, 80);
      assert.notEqual(c.state, 'gone', `${def.id} came back`);
    }
  }
  // what frightens them: a sprint nearby
  const c = w.creatures.find((k) => k.state === 'idle' || k.state === 'walk' || k.state === 'wary');
  const p = player(c.pos.clone().add(new THREE.Vector3(5, 0, 0)));
  p.vel.set(-7, 0, 0);
  c.cool = 0;
  w.update(1 / 60, 200, p, camera(c.pos));
  assert.equal(c.state, 'trick', 'sprinting close by scares it');
  w.dispose();
});

test('targets unregister when a creature is removed', () => {
  clearTargets();
  const { scene, level, physics } = world('perdide2');
  const w = new Wildlife(scene, level, physics, { content: CONTENT.perdide2 });
  const mine = () => allTargets().filter((t) => t.kind === 'wildlife').length;
  const n = w.creatures.length;
  assert.equal(mine(), n);
  const c = w.creatures[0];
  c.remove();
  assert.equal(mine(), n - 1);
  assert.ok(!allTargets().some((t) => t.creature === c));
  assert.ok(!w.creatures.includes(c));
  w.dispose();
  assert.equal(mine(), 0);
  assert.equal(w.root.parent, null);
});
