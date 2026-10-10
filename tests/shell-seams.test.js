// Every helper that roughens a shell standing on a floor (a cave's dome, a hall's round wall, a trunk, a mound) keeps
// its foot ring at or under the floor. The cave seam (tests/cave-seams.test.js, docs/systems/rendering.md "Spot blacks
// anchored to the surface; cave seams") was the desert's two domes lifted up to 0.6 m off their floor by rough(): a
// slit the sun shone through, a lit line round the cave. This is that test for every displacement helper the worlds
// build with, on every shape of shell, and a scan of src/ for new helpers so none comes in untested.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import * as THREE from 'three';
import { rough as roughCity } from '../src/desert-city.js';
import { rough as roughHearth } from '../src/desert-hearth.js';
import { lumpy } from '../src/levels/sky-stones-kit.js';
import { jitter, soften } from '../src/world.js';

// shells as the worlds stand them on a floor at y = 0: a dome, an open drum (a round hall's wall, a trunk), a
// tapering mound, a squashed half-sphere (the caves' 0.62 and 0.8)
const SHELLS = {
  dome: () => new THREE.SphereGeometry(18, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2),
  'low dome': () => new THREE.SphereGeometry(31, 30, 16, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.62, 1),
  drum: () => new THREE.CylinderGeometry(12, 12, 9, 24, 6, true).translate(0, 4.5, 0),
  mound: () => new THREE.CylinderGeometry(9, 15, 7, 18, 2).translate(0, 3.5, 0),
};
// every helper, with the amounts the worlds use and the strongest (as amount, freq, seed, …)
const HELPERS = {
  'desert-city rough': [(g) => roughCity(g, 1.2, 0.18, 5), (g) => roughCity(g, 2.5, 0.4, 1)],
  'desert-hearth rough': [(g) => roughHearth(g, 0.9, 0.22, 4), (g) => roughHearth(g, 1.6, 0.18, 2)],
  'sky-stones lumpy': [(g) => lumpy(g, 0.12, 0.08, 3), (g) => lumpy(g, 0.3, 0.5, 9)],
  // (as the worlds call it, and with its vertical noise: the foot ring only goes down, into the floor)
  'world jitter': [(g) => jitter(g, 0.22, 0.05, 7), (g) => jitter(g, 0.3, 0.2, 3), (g) => jitter(g, 0.3, 0.2, 3, 1.5)],
  'world soften': [(g) => soften(g, 0.08), (g) => soften(g, -0.14, 0.2)],
};
// helpers that move vertices but never of a shell on a floor (a reason each)
const NOT_SHELLS = {
  pennantWave: 'a pennant in the wind (cloth, hung)',
  squashHair: 'hair on a head',
  markTripoHair: 'hair on a head (marks, never a shell)',
  warpFace: 'a face',
  keepThin: 'thin bars kept a pixel wide (moves sideways, never down)',
};

for (const [name, fns] of Object.entries(HELPERS)) for (const [shell, make] of Object.entries(SHELLS)) {
  test(`${name} keeps a ${shell}'s foot on the floor`, () => {
    for (const fn of fns) {
      const before = make().toNonIndexed().attributes.position;
      const g = fn(make()), after = (g.index ? g.toNonIndexed() : g).attributes.position;
      assert.equal(after.count, before.count);
      let foot = 0, highest = -Infinity;
      for (let i = 0; i < after.count; i++) if (Math.abs(before.getY(i)) < 0.01) { foot++; highest = Math.max(highest, after.getY(i)); }
      assert.ok(foot >= 12, `${shell} has a foot ring (${foot})`);
      assert.ok(highest <= 1e-6, `${name}, ${shell}: the foot ring at or under the floor (highest ${highest.toFixed(3)} m)`);
    }
  });
}

test('jitter\'s vertical noise still moves the rest of a shell up and down', () => {
  const before = SHELLS.drum().attributes.position, after = jitter(SHELLS.drum(), 0, 0.2, 3, 1.5).attributes.position;
  let up = 0, down = 0;
  for (let i = 0; i < after.count; i++) if (before.getY(i) > 0.5) { const d = after.getY(i) - before.getY(i); if (d > 0.01) up++; else if (d < -0.01) down++; }
  assert.ok(up > 10 && down > 10, `up ${up}, down ${down}`);
});

test('every helper in src/ that moves a geometry\'s vertices is checked here, or named as not a shell', () => {
  const walk = (d) => readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(d, e.name)) : e.name.endsWith('.js') ? [join(d, e.name)] : []));
  const root = new URL('../src/', import.meta.url).pathname, found = [];
  for (const f of walk(root)) {
    const s = readFileSync(f, 'utf8'), re = /export function (\w+)\((?:g|geo|geometry)\b[^)]*\)\s*\{/g;
    for (let m; (m = re.exec(s));) {
      const end = s.indexOf('\n}', m.index), body = s.slice(m.index, end > 0 ? end : m.index + 1500);
      if (/setXYZ|setY\(/.test(body)) found.push(m[1]);
    }
  }
  const tested = new Set(Object.keys(HELPERS).map((k) => k.split(' ').at(-1)));
  for (const fn of found) assert.ok(tested.has(fn) || fn in NOT_SHELLS, `${fn} moves vertices: add it to HELPERS (a shell on a floor keeps its foot down) or to NOT_SHELLS with why`);
  assert.ok(found.length >= 5, `the scan finds the helpers (${found.join(', ')})`);
});
