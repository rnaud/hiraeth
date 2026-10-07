import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createPerdide2, PERDIDE2_CONTENT, CAVE, SKIFF } from '../src/levels/perdide2.js';
import { Physics } from '../src/physics.js';
import { CONTENT, ORDER } from '../src/levels/content.js';
import { LEVELS } from '../src/levels/index.js';

const scene = new THREE.Scene(), level = createPerdide2(scene), physics = new Physics(scene, level.ground);

// where Relics (quest.js) would put a spot
function resolve(s) {
  if (Array.isArray(s)) return new THREE.Vector3(s[0], physics.groundAt(s[0], 1e4, s[1], 2e4) + 1.1, s[1]);
  const p = new THREE.Vector3(...s.at);
  if (s.snap) { const y = physics.groundAt(p.x, p.y + 3, p.z, 6); if (Number.isFinite(y)) p.y = y + 1.1; }
  return p;
}

test('the deep wood builds and is registered', () => {
  assert.equal(level.id, 'perdide2');
  assert.ok(ORDER.includes('perdide2'));
  assert.ok(LEVELS.some((l) => l.id === 'perdide2' && !l.hidden));
  assert.equal(CONTENT.perdide2, PERDIDE2_CONTENT);
  assert.ok(level.lights.length > 40, 'eggs, pools and the cave light the swamp');
  assert.ok(level.sky.script.dusk.length === 5 && level.defaults.hour > 17 && level.defaults.hour < 18.5);
});

test('spawn stands on a dry island', () => {
  const { x, y, z } = level.spawn;
  assert.ok(y > 1, `spawn is above the water: ${y}`);
  assert.ok(Math.abs(physics.groundAt(x, y + 2, z) - y) < 0.05);
  assert.equal(level.unsafe(level.spawn), false);
  for (let a = 0; a < 6.28; a += 0.5) assert.ok(level.ground.heightAt(x + Math.cos(a) * 10, z + Math.sin(a) * 10) > 0.5, 'island is dry around spawn');
});

test('five relics sit on reachable surfaces', () => {
  const { spots, names } = PERDIDE2_CONTENT.relics;
  assert.equal(spots.length, 5); assert.equal(names.length, 5);
  for (const s of spots) {
    const p = resolve(s), g = physics.groundAt(p.x, p.y, p.z, 10);
    assert.ok(Number.isFinite(g) && p.y - g > 0 && p.y - g < 3, `relic ${s.at} has a surface below: ${g} (${p.y})`);
    assert.ok(g > -0.5, `relic ${s.at} is above the water: ${g}`);
  }
  // the raised ones really are up on something (not on the swamp floor)
  for (const i of [0, 1, 2, 3]) {
    const p = resolve(spots[i]);
    assert.ok(p.y - level.ground.heightAt(p.x, p.z) > 1.5, `relic ${i} is up on a structure`);
  }
});

test('the lit path leads dry or wadeable to the cave goal', () => {
  const g = PERDIDE2_CONTENT.story.goal;
  assert.ok(PERDIDE2_CONTENT.story.title && PERDIDE2_CONTENT.story.intro && PERDIDE2_CONTENT.story.outro);
  assert.ok(Math.abs(g[0] - CAVE.x) < 1 && g[2] < CAVE.mouth && g[2] > CAVE.z - CAVE.len / 2);
  const gy = level.ground.heightAt(g[0], g[2]);
  assert.ok(gy > 0, 'the cave floor is dry');
  // under the vault: a roof overhead
  assert.ok(physics.rayHit(new THREE.Vector3(g[0], gy + 1, g[2]), new THREE.Vector3(0, 1, 0), 30), 'the cave has a roof');
  // walking from spawn to the cave never needs deep water
  const pts = [[0, -10], [4, -34], [-6, -70], [-22, -108], [-15, -148], [6, -188], [21, -228], [13, -268], [-9, -304], [-23, -340], [-19, -376], [-7, -408]];
  const curve = new THREE.CatmullRomCurve3(pts.map(([x, z]) => new THREE.Vector3(x, 0, z)), false, 'centripetal');
  for (let u = 0; u <= 1; u += 0.005) {
    const p = curve.getPointAt(u);
    assert.ok(level.ground.heightAt(p.x, p.z) > -1.5, `path wadeable at ${p.x.toFixed(0)},${p.z.toFixed(0)}`);
  }
});

test('the skiff waits at the cave mouth and the collision budget holds', () => {
  const skiff = level.mount(physics);
  assert.equal(skiff.kind, 'skiff');
  assert.ok(Math.hypot(skiff.pos.x - SKIFF.x, skiff.pos.z - SKIFF.z) < 0.01);
  assert.ok(skiff.pos.y > 0 && skiff.pos.y < 3, `skiff floats on the shallows: ${skiff.pos.y}`);
  assert.ok(level.ground.heightAt(SKIFF.x, SKIFF.z) < 0, 'skiff is in the water');
  skiff.update(0.016, null, 0);
  assert.ok(Number.isFinite(skiff.pos.y));
  const triangles = physics.triangles;
  // (the trunks, caps and arches collide as drawn since the contact audit, and since its second pass the
  // root heaps and gate roots over the cave, the arches' main twist roots, the glass dome's ribs, the
  // saucer's blister and the 30 drapes over the root cave: 130 k → ~154 k, the BVH 38 → 56 ms to bake,
  // ground rays and capsule pushes within noise; since its third pass every root, the 26 bank roots, the
  // whip roots and the splayed feet: ~154 k → ~172 k, bake +5 ms, along the path rays +7 %, capsules +15 %;
  // docs/systems/movement.md "Contact")
  assert.ok(triangles < 180000, `static collision budget: ${triangles}`);
});

test('every root is solid as drawn: the bank roots, the whip roots and the splayed feet too', () => {
  const roots = scene.children.filter((o) => o.isMesh && o.name === 'roots');
  assert.ok(roots.length >= 2, 'the drawn roots');
  let n = 0, off = 0, worst = 0, s = 3;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), e1 = new THREE.Vector3(), e2 = new THREE.Vector3();
  for (const m of roots) {
    const P = m.geometry.attributes.position;
    for (let t = 0; t < P.count / 3; t++) {
      if (rnd() > 0.1) continue;
      a.fromBufferAttribute(P, 3 * t); b.fromBufferAttribute(P, 3 * t + 1); c.fromBufferAttribute(P, 3 * t + 2);
      const nrm = e1.subVectors(b, a).cross(e2.subVectors(c, a));
      if (nrm.y / (nrm.length() || 1) < 0.7) continue;   // (a top you could stand on)
      const p = a.add(b).add(c).divideScalar(3);
      if (level.ground.heightAt(p.x, p.z) > p.y) continue;   // (under the mud)
      const g = physics.groundAt(p.x, p.y + 0.05, p.z, 1.5);
      n++;
      if (Math.abs(g - p.y) > 0.06) { off++; worst = Math.max(worst, Math.abs(g - p.y)); }
    }
  }
  assert.ok(n > 300, `root tops checked: ${n}`);
  assert.ok(off <= n * 0.01, `${off} of ${n} root tops with no collision under them (up to ${worst.toFixed(2)} m)`);
});
