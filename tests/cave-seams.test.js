// The desert's two caves (src/desert-city.js: the giant's heart; src/desert-hearth.js: the Givers' Hearth) are rough
// domes stood on a flat floor. Their roughening lifted the dome's foot ring by up to 0.6 m in places, opening a slit
// between the floor and the wall that the sun shone through: a lit seam round the floor, in the shade of the dome.
// The foot ring now only goes down (into the floor); the rest of the dome keeps its roughness.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { rough as roughCity } from '../src/desert-city.js';
import { rough as roughHearth } from '../src/desert-hearth.js';

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
