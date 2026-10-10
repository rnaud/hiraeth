// The desert's two caves (src/desert-city.js: the giant's heart; src/desert-hearth.js: the Givers' Hearth) are rough
// domes stood on a flat floor. Their roughening lifted the dome's foot ring by up to 0.6 m in places, opening a slit
// between the floor and the wall that the sun shone through: a lit seam round the floor, in the shade of the dome.
// The foot ring now only goes down (into the floor); the rest of the dome keeps its roughness.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { readFileSync } from 'node:fs';
import { rough as roughCity } from '../src/desert-city.js';
import { rough as roughHearth, hallDome, HEARTH } from '../src/desert-hearth.js';

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
