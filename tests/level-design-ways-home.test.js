// The v1.53 level design audit's follow-ups (docs/audits/level-design-v1.53.md, issues #178-#180): the leading lines and
// places added are in sight from the spots they are there for, as the audit's own rays see them (scripts/level-design/
// audit.mjs: the collision and the terrain under the ray), and the ways home go another way than the ways in.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

await import('./register-gadgets.js');
const A = await import('./playthrough-agent.js');
const { KEEPERS_STONE } = await import('../src/temples/spheres.js');
const { STEPS_STAKE } = await import('../src/lorn-crossing.js');

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const flat = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const EYE = 1.7;
/** The first thing a ray from a to b meets (the collision, then the terrain under it), or null: b is in sight. */
function blocker(W, a, b, { near = 3 } = {}) {
  const d = a.distanceTo(b), dir = b.clone().sub(a).normalize();
  const hit = W.physics.rayHit(a, dir, d);
  if (hit && hit.distance < d - near) return hit.point;
  const G = W.level.ground, H = G?.heightAt ? (x, z) => G.heightAt(x, z) : null;
  if (H) for (let s = 6; s < d - near; s += 6) { const p = a.clone().addScaledVector(dir, s); if (p.y < H(p.x, p.z) - 0.3) return p; }
  return null;
}
const lineOf = (L, name) => (typeof L.lines === 'function' ? L.lines() : L.lines).find((l) => l.name === name);
const sightOf = (L, re) => (typeof L.sights === 'function' ? L.sights() : L.sights).find((s) => re.test(s.name));
const vec = (p) => (p.isVector3 ? p.clone() : p.length === 2 ? V(p[0], 0, p[1]) : V(p[0], p[1], p[2]));
/** Points every `step` m along a polyline ([x, z] or [x, y, z] or Vector3s), flat. */
function along(points, step = 5) {
  const P = points.map(vec), out = [];
  for (let i = 1; i < P.length; i++) { const L = flat(P[i - 1], P[i]); for (let s = 0; s < L; s += step) out.push(P[i - 1].clone().lerp(P[i], s / L)); }
  out.push(P.at(-1));
  return out;
}
/** How much of the way home (past `skip` m of the ship) runs within `r` m of the way in. */
const shared = (home, wayIn, ship, { r = 35, skip = 70 } = {}) => {
  const H = along(home).filter((p) => flat(p, ship) > skip), I = along(wayIn);
  return H.filter((p) => I.some((q) => flat(p, q) < r)).length / H.length;
};

test('the Garden of Spheres (issue #178): the heel path leads from the ship to the Footprint past the little Footprint and the tall white stone, and the Footprint lets you out by the keepers’ stone, home by the white hill’s path', () => {
  globalThis.location = { search: '?level=spheres' };
  const W = A.loadWorld('spheres');
  try {
    const L = W.level, heel = L.spheres.heel, O = L.temple.outside, rt = L.temple, ship = V(L.spawn.x, 0, L.spawn.z);
    // (the eye on the ground under the grove's umbrellas, not on their canopies)
    const G = (x, z) => L.ground.heightAt(x, z), eyeAt = (x, z) => V(x, G(x, z) + EYE, z);
    // the path: from beside the ship to the porch, each of its turns in sight from the one before
    const P = heel.path;
    assert.ok(flat(vec(P[0]), ship) < 12, 'it starts at the ship');
    assert.ok(flat(vec(P.at(-1)), O.door.at) < 12, 'it ends at the Footprint’s porch');
    for (let i = 1; i < P.length; i++) assert.equal(blocker(W, eyeAt(...P[i - 1]), eyeAt(...P[i])), null, `the path’s turn ${i} in sight from turn ${i - 1}`);
    // what stands on it, each in sight from the way to it: the little Footprint's sphere from where the path leaves the
    // grove, the tall stone from the little Footprint, the Footprint's heel from the tall stone; none far off the path
    const little = sightOf(L, /little Footprint/).at, tall = sightOf(L, /tall white stone/).at;
    const pts = along(P, 2), off = (p) => Math.min(...pts.map((q) => flat(p, q)));
    assert.ok(off(little) < 20 && off(tall) < 20, `beside the path: ${off(little).toFixed(0)} m, ${off(tall).toFixed(0)} m`);
    assert.equal(blocker(W, eyeAt(...P[1]), V(heel.little.x, heel.little.y + heel.little.R * 0.6, heel.little.z)), null, 'the little Footprint’s sphere from the grove’s edge');
    assert.equal(blocker(W, eyeAt(little.x + 6, little.z + 6), V(tall.x, G(tall.x, tall.z) + heel.tall.h * 0.8, tall.z)), null, 'the tall white stone from the little Footprint');
    assert.equal(blocker(W, eyeAt(tall.x + 5, tall.z + 5), V(O.door.at.x, O.top, O.door.at.z).lerp(V(-250, O.top, 250), 0.5)), null, 'the Footprint’s heel from the tall white stone');
    // the way out: the last way out, past the Echo, comes up on the keepers' stone; the ground there is under the feet
    const out = rt.portals.filter((p) => p.label === 'way out' && p.to).at(-1);
    assert.ok(out && flat(out.to, V(KEEPERS_STONE.x, 0, KEEPERS_STONE.z)) < 0.5, 'the way out comes up at the keepers’ stone');
    assert.ok(Math.abs(out.to.y - G(out.to.x, out.to.z)) < 0.35, `its feet on the ground: ${out.to.y.toFixed(2)} vs ${G(out.to.x, out.to.z).toFixed(2)}`);
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 4) {
      const x = out.to.x + Math.cos(a) * 1.5, z = out.to.z + Math.sin(a) * 1.5;
      assert.ok(W.physics.groundAt(x, out.to.y + 3, z, 5) < out.to.y + 0.6, 'nothing to step out into round it');
    }
    // home from it: the white hill's path, the grove's umbrellas in sight from the stone; another way than the way in,
    // past the keepers' stone and the sphere at the hill's foot, which the way in doesn't pass
    const home = lineOf(L, 'the white hill path'), wayIn = lineOf(L, 'the meadow path and the heel path');
    assert.ok(home && home.auto === false && wayIn, 'both ways are the audit’s leading lines');
    assert.ok(flat(vec(home.points[0]), out.to) < 3 && flat(vec(home.points.at(-1)), ship) < 12, 'the way home runs from the stone to the ship');
    assert.ok(flat(vec(wayIn.points[0]), V(0, 0, -620)) < 30 && flat(vec(wayIn.points.at(-1)), O.door.at) < 30, 'the way in runs from the humming pole to the door');
    const s = shared(home.points, wayIn.points, ship);
    assert.ok(s < 0.25, `${(s * 100).toFixed(0)} % of the way home runs along the way in`);
    const foot = sightOf(L, /white hill’s foot/).at, inPts = along(wayIn.points);
    for (const p of [foot, V(KEEPERS_STONE.x, 0, KEEPERS_STONE.z)]) assert.ok(Math.min(...inPts.map((q) => flat(p, q))) > 35, 'a place the way in doesn’t pass');
  } finally { W.dispose(); }
});

test('Lorn (issue #179): a keepers’ stake stands beside the Hush-House’s steps, seen from its door, and the stakes run on from it to Hollin', () => {
  globalThis.location = { search: '?level=perdide' };
  const W = A.loadWorld('perdide');
  try {
    const L = W.level, S = L.crossing.stakes.stakes, D = L.temples.find((t) => t.id === 'perdide').outside.door, door = D.at, hollin = A.objectiveAt(W, 'hollin');
    const steps = door.clone().add(V(Math.sin(D.heading) * 3, 0, Math.cos(D.heading) * 3));   // (out of the porch, on its steps)
    const i = S.findIndex((p) => flat(p, V(STEPS_STAKE.x, 0, STEPS_STAKE.z)) < 1);
    assert.ok(i > 0, 'a stake stands at the steps');
    assert.ok(flat(S[i], door) < 10 && flat(S[i], door) > 4, `${flat(S[i], door).toFixed(1)} m from the door, beside its steps, not on them`);
    // from the door, its float in sight; and the line the stakes make carries the leg from the door to Hollin
    // (the audit's walk along a line: one that runs from beside the leg's start to beside its goal, 30 m)
    assert.equal(blocker(W, V(steps.x, steps.y + EYE, steps.z), V(S[i].x, S[i].y + 0.45, S[i].z)), null, 'the stake’s float from the door’s steps');
    const line = lineOf(L, 'the keepers’ stakes').points.map(vec);
    assert.ok(Math.min(...line.map((p) => flat(p, door))) < 30 && Math.min(...line.map((p) => flat(p, hollin))) < 30, 'the stakes run from beside the door to beside Hollin');
    // the stakes on from the steps keep to the water down the channel, clear of the island's moss and the house
    for (const p of S.slice(i + 1, i + 6)) assert.ok(L.ground.heightAt(p.x, p.z) < 0.5, `stake at (${p.x.toFixed(0)}, ${p.z.toFixed(0)}) stands in the water`);
  } finally { W.dispose(); }
});
