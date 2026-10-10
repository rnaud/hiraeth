// The desert's two caves (src/desert-city.js: the giant's heart; src/desert-hearth.js: the Givers' Hearth) are rough
// domes stood on a flat floor. Their roughening lifted the dome's foot ring by up to 0.6 m in places, opening a slit
// between the floor and the wall that the sun shone through: a lit seam round the floor, in the shade of the dome.
// The foot ring now only goes down (into the floor); the rest of the dome keeps its roughness.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { readFileSync } from 'node:fs';
import { rough as roughCity } from '../src/desert-city.js';
import { rough as roughHearth, hallDome, HEARTH, cut as cutHearth } from '../src/desert-hearth.js';

const dome = (r, w, h, sy) => new THREE.SphereGeometry(r, w, h, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, sy, 1);

// (as the levels build them: radius, segments, rings, height scale; amount, frequency, seed)
for (const [name, rough, shape, args] of [
  ['the giant’s heart', roughCity, [31, 30, 16, 0.62], [1.2, 0.18, 5]],
  ['the Givers’ Hearth', roughHearth, [18.5, 28, 14, 0.8], [0.9, 0.22, 4]],
]) {
  test(`${name}: the dome's foot never lifts off the floor, and the dome stays rough`, () => {
    const before = dome(...shape).toNonIndexed().attributes.position;
    const g = rough(dome(...shape), ...args), after = (g.index ? g.toNonIndexed() : g).attributes.position;
    assert.equal(after.count, before.count);
    const foot = [], moved = [];
    for (let i = 0; i < after.count; i++) {
      if (Math.abs(before.getY(i)) < 0.01) foot.push(after.getY(i));
      moved.push(Math.abs(after.getY(i) - before.getY(i)));
    }
    assert.ok(foot.length > 20);
    assert.ok(Math.max(...foot) <= 1e-6, `the foot ring at or under the floor (highest ${Math.max(...foot).toFixed(3)} m)`);
    assert.ok(Math.min(...foot) < -0.05, 'and pushed into it where it would have risen');
    assert.ok(Math.max(...moved) > 0.2, 'the rest still rough');
  });
}

test('the Givers’ Hearth: the floor runs on under the dome’s whole foot (no hairline of sky at its edge)', () => {
  // the roughening pushes the foot ring out as well as down (17.4 to 19.8 m); a floor of 18 m left a gap between its
  // edge and the wall a few cm under it, where the sky showed as a hairline round the floor (visual audit v1.4)
  const floor = (HEARTH.hall + HEARTH.floorOut) * Math.cos(Math.PI / 28);   // (the 28-sided floor's inner radius)
  for (const seg of [28, 14]) {
    const p = hallDome(seg).attributes.position;
    let far = 0, n = 0;
    for (let i = 0; i < p.count; i++) if (p.getY(i) <= 0) { far = Math.max(far, Math.hypot(p.getX(i), p.getZ(i))); n++; }
    assert.ok(n > 20, 'the foot ring');
    assert.ok(far < floor - 0.3, `${seg} segments: the foot out to ${far.toFixed(2)} m, the floor to ${floor.toFixed(2)} m`);
  }
});

test('the giant’s heart: its floor runs on under the dome’s foot too', () => {
  // (desert-city.js: the floor's lathe out to ROOM + 4 = 34 m, 36 sides; the dome as built there)
  const floor = 34 * Math.cos(Math.PI / 36), p = roughCity(dome(31, 30, 16, 0.62), 1.2, 0.18, 5).attributes.position;
  let far = 0;
  for (let i = 0; i < p.count; i++) if (p.getY(i) <= 0) far = Math.max(far, Math.hypot(p.getX(i), p.getZ(i)));
  assert.ok(far > 32 && far < floor - 0.3, `the foot out to ${far.toFixed(2)} m, the floor to ${floor.toFixed(2)} m`);
  assert.match(readFileSync(new URL('../src/desert-city.js', import.meta.url), 'utf8'), /\[ROOM \+ 4, 0\], \[ROOM \+ 4, -1\]\];/);
});

test('the Givers’ Hearth: no triangle of the dome hangs across the passage’s mouth', () => {
  // the doorway was cut by dropping the triangles whose centre lay in it, so a big one straddling the passage's walls
  // or its lintel stayed whole and hung a dark corner across the mouth (visual audit v1.21): straddling ones are split
  // finely now, and nothing is left inside the passage's open width (its walls' inner faces at ±2.5 m, its ceiling at 4.8)
  const door = (x, y, z) => Math.abs(x) < 2.7 && y < 4.8 && z > 10;
  const open = (x, y, z) => Math.abs(x) < 2.45 && y > 0.05 && y < 4.7 && z > 12;
  const area = (q, where) => {
    let s = 0;
    const A = new THREE.Vector3(), B = new THREE.Vector3(), C = new THREE.Vector3();
    for (let i = 0; i < q.count; i += 3) {
      A.fromBufferAttribute(q, i); B.fromBufferAttribute(q, i + 1); C.fromBufferAttribute(q, i + 2);
      if (where(A.clone().add(B).add(C).divideScalar(3))) s += B.clone().sub(A).cross(C.clone().sub(A)).length() / 2;
    }
    return s;
  };
  for (const seg of [28, 14]) {
    const whole = hallDome(seg), p = cutHearth(whole, door).attributes.position;
    let inside = 0;
    for (let i = 0; i < p.count; i += 3) {
      for (let a = 0; a <= 6; a++) for (let b = 0; b <= 6 - a; b++) {
        const u = a / 6, v = b / 6, w = 1 - u - v;
        if (open(p.getX(i) * u + p.getX(i + 1) * v + p.getX(i + 2) * w, p.getY(i) * u + p.getY(i + 1) * v + p.getY(i + 2) * w, p.getZ(i) * u + p.getZ(i + 1) * v + p.getZ(i + 2) * w)) inside++;
      }
    }
    assert.equal(inside, 0, `${seg} segments: ${inside} points of the dome inside the passage's mouth`);
    // and the dome away from the door is all there (its area within 1 %)
    const away = (c) => Math.abs(c.x) > 5 || c.y > 7 || c.z < 8;
    const before = area((whole.index ? whole.toNonIndexed() : whole).attributes.position, away), after = area(p, away);
    assert.ok(Math.abs(after - before) / before < 0.01, `${seg} segments: the dome away from the door unchanged (${before.toFixed(1)} → ${after.toFixed(1)} m²)`);
  }
});
