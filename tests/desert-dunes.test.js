// The walking dunes (issue #167; src/desert-dunes.js, src/story/desert-dunes.js): the sand rivers the bike rides fast,
// the ruins two dunes walk over and two walk off (a different two each visit, the same for the same visit), and the
// sandfalls off two mesas.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { loadWorld } from './playthrough-agent.js';
import { allInteractables } from '../src/interact.js';
import { Hoverbike, LANE } from '../src/bike.js';
import { game } from '../src/game-state.js';
import { Terrain } from '../src/world.js';
import { desertHeight, SAND_RUN, WASH } from '../src/desert-landmarks.js';
import { buildWalkingDunes, clearOn } from '../src/desert-dunes.js';
import { STORY, RUINS, DUNE_VISITS, hearthStones } from '../src/desert-sites.js';

const visitBefore = game.flag('desert.dunes.visit') ?? 0;
const W = loadWorld('desert');
const { level, physics } = W;
const D = level.dunes;
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const toLine = (p, pts) => {
  let best = Infinity;
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i], [bx, bz] = pts[i + 1], dx = bx - ax, dz = bz - az;
    const t = Math.max(0, Math.min(1, ((p.x - ax) * dx + (p.z - az) * dz) / (dx * dx + dz * dz)));
    best = Math.min(best, Math.hypot(ax + dx * t - p.x, az + dz * t - p.z));
  }
  return best;
};

test('two sand rivers: the bike rides them faster with the flow than over the dunes beside them', () => {
  assert.equal(D.rivers.length, 2);
  for (const ch of [SAND_RUN, WASH]) {
    const u = 0.5, c = ch.curve.getPointAt(u), t = ch.curve.getTangentAt(u);
    const on = D.lane(c.x, c.z), off = D.lane(c.x - t.z * (ch.opt.bed + 12), c.z + t.x * (ch.opt.bed + 12));
    assert.ok(on && on.k > 0.9, 'on its bed, in the lane');
    assert.ok(on.fx * t.x + on.fz * t.z > 0.9, 'it runs down the river');
    assert.equal(off, null, 'beside it, no lane');
  }
  // the same throttle for six seconds down the sand river out of the hollow, with its lane and without
  const ride = (lane) => {
    const bike = new Hoverbike(physics, { lane }), p0 = SAND_RUN.curve.getPointAt(0.15), t = SAND_RUN.curve.getTangentAt(0.15);
    bike.place(p0.x, p0.z, Math.atan2(t.x, t.z));
    let top = 0;
    for (let i = 0; i < 60 * 6; i++) { bike.update(1 / 60, { KeyW: true }); top = Math.max(top, Math.hypot(bike.vel.x, bike.vel.z)); }
    return top;
  };
  const fast = ride(D.lane), plain = ride(null);
  assert.ok(fast > plain * 1.2, `faster in the lane (${fast.toFixed(1)} against ${plain.toFixed(1)} m/s)`);
  assert.ok(fast < 34 * (1 + LANE.speed) + LANE.current + 2, `but not wild (${fast.toFixed(1)} m/s)`);
  // the bike as the level makes it rides them
  const b = level.mount(physics);
  assert.equal(b.lane, D.lane);
});

test('the dunes walk: a different two ruins stand clear each visit, the same two for the same visit', () => {
  const seen = new Set(DUNE_VISITS.map((p) => p.join()));
  assert.equal(seen.size, DUNE_VISITS.length, 'no two visits alike in a row of six');
  for (let v = 0; v < 12; v++) assert.notDeepEqual(clearOn(v), clearOn(v + 1), `visit ${v} and the next differ`);
  assert.deepEqual(clearOn(7), clearOn(1));
  // this world was built for the visit before, and setting the story up counted it
  assert.equal(D.visit, visitBefore);
  assert.equal(game.flag('desert.dunes.visit'), visitBefore + 1);
  assert.deepEqual(D.ruins.filter((r) => r.open).map((r) => r.n), clearOn(D.visit));
  // built for two visits, on the same ground: the dunes stand over different ruins
  const terrain = new Terrain({ height: desertHeight });
  const a = buildWalkingDunes(new THREE.Scene(), terrain, { visit: 0 }), b = buildWalkingDunes(new THREE.Scene(), terrain, { visit: 1 });
  assert.notDeepEqual(a.ruins.map((r) => r.open), b.ruins.map((r) => r.open));
  const a2 = buildWalkingDunes(new THREE.Scene(), terrain, { visit: 0 });
  assert.deepEqual(a.ruins.map((r) => r.open), a2.ruins.map((r) => r.open));
});

test('a covered ruin is under its dune (the tower\'s tip shows), an open one has its dune walked off downwind', () => {
  for (const r of D.ruins) {
    const g = physics.groundAt(r.at.x, r.top.y + 30, r.at.z, 80);
    if (r.open) assert.ok(g < r.top.y + 0.5, `${r.id}: no dune over it (${(g - r.top.y).toFixed(1)})`);
    else if (r.id === 'tower') assert.ok(g >= r.top.y - 0.2, `the tower's tip at the dune's top (${(g - r.top.y).toFixed(1)})`);
    else assert.ok(g > r.top.y, `${r.id}: the dune stands over it (${(g - r.top.y).toFixed(1)})`);
  }
  // the open ones are things to look at, and sights for the level design audit, 30-150 m off the ride out
  const looks = allInteractables().filter((e) => /^dunes\./.test(e.id)).map((e) => e.id.slice(6));
  assert.deepEqual(looks.sort(), D.ruins.filter((r) => r.open).map((r) => r.id).sort());
  const ride = [[STORY.bike.x, STORY.bike.z], [STORY.hearth.x, STORY.hearth.z]];
  for (const def of RUINS) { const d = toLine({ x: def.x, z: def.z }, ride); assert.ok(d > 30 && d < 150, `${def.id} ${d.toFixed(0)} m off the ride`); }
  const names = level.sights().map((s) => s.name);
  assert.ok(D.sights.every((s) => names.includes(s.name)));
});

test('sand pours off two mesas, in the waterfalls\' own moving curtain', () => {
  assert.equal(D.falls.length, 2);
  for (const f of D.falls) {
    assert.ok(f.height > 40, `a fall of ${f.height.toFixed(0)} m`);
    assert.ok(f.sheet.material.defines?.FALL, 'drawn as a fall');
    assert.ok(f.sheet.userData.noCollide, 'walked through');
    // seen from the way: within 150 m of the ride out or the marked stones home
    const d = Math.min(toLine(f.at, [[STORY.bike.x, STORY.bike.z], [STORY.hearth.x, STORY.hearth.z]]), toLine(f.at, [[STORY.city.x, STORY.city.z], ...hearthStones()]));
    assert.ok(d < 150, `its foot ${d.toFixed(0)} m from the way`);
  }
});
