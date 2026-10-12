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
  const looks = allInteractables().filter((e) => /^dunes\./.test(e.id) && e.id !== 'dunes.lookout').map((e) => e.id.slice(6));
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

// (issue #181: the desert's places all stood on the sand) A ledge cut round the second sandfall's mesa, from the sand up to
// a lookout beside its lip, some 40 m over the ride: walked up by a traveller who cannot climb, ridden up on the bike.
test('the lookout on the sandfall mesa: a ledge up from the sand, walked and ridden, to a view 35 m and more over it', async () => {
  const A = await import('./playthrough-agent.js');
  const O = D.lookout;
  assert.ok(O, 'the lookout is built');
  const floor = Math.min(...[0, 1, 2, 3, 4, 5, 6, 7].map((k) => level.ground.heightAt(O.stand.x + Math.cos(k * 0.785) * 10, O.stand.z + Math.sin(k * 0.785) * 10)), level.ground.heightAt(O.stand.x, O.stand.z));
  assert.ok(O.stand.y - floor > 35, `the platform ${(O.stand.y - floor).toFixed(0)} m over the sand round it`);
  assert.ok(Math.abs(physics.groundAt(O.stand.x, O.stand.y + 3, O.stand.z, 8) - O.stand.y) < 0.5, 'the platform is solid where you stand');
  // its foot on the sand, and the ledge solid all the way up, no step higher than a stride
  assert.ok(Math.abs(O.path[0].y - level.ground.heightAt(O.path[0].x, O.path[0].z)) < 1, 'the ledge starts on the sand');
  for (const p of O.path) assert.ok(Math.abs(physics.groundAt(p.x, p.y + 3, p.z, 6) - p.y) < 0.3, `the ledge solid at ${p.x.toFixed(0)}, ${p.z.toFixed(0)}`);
  for (let i = 1; i < O.path.length; i++) assert.ok(O.path[i].y - O.path[i - 1].y < 1.2, 'a gentle ramp, no step up');
  // a traveller who cannot climb walks up it and down again
  const walk = (points, from) => {
    const P = new A.Player(physics, { health: false, climb: false });
    P.has = () => false;
    P.respawn(from.clone().add(V(0, 0.2, 0)));
    for (const to of points) for (let i = 0; i < 60 * 20 && A.flat(P.pos, to) > 0.9; i++) {
      const heading = Math.atan2(to.x - P.pos.x, to.z - P.pos.z);
      P.heading = heading;
      P.update(1 / 60, { KeyW: true }, heading + Math.PI);
    }
    return P.pos.clone();
  };
  const foot = O.path[0].clone().addScaledVector(O.path[0].clone().sub(O.path[1]).setY(0).normalize(), 6);
  foot.y = level.ground.heightAt(foot.x, foot.z);
  assert.ok(walk([...O.path, O.stand], foot).distanceTo(O.stand) < 1.5, 'walked up to the platform');
  assert.ok(walk([...O.path].reverse(), O.stand).distanceTo(O.path[0]) < 1.5, 'and down again');
  // the bike rides it up, steered along it
  const bike = new Hoverbike(physics);
  bike.place(foot.x, foot.z, Math.atan2(O.path[1].x - foot.x, O.path[1].z - foot.z));
  let k = 0;
  for (let i = 0; i < 60 * 40 && k < O.path.length; i++) {
    const to = O.path[k];
    if (A.flat(bike.pos, to) < 4) { k++; continue; }
    let dh = Math.atan2(to.x - bike.pos.x, to.z - bike.pos.z) - bike.heading;
    while (dh > Math.PI) dh -= 2 * Math.PI;
    while (dh < -Math.PI) dh += 2 * Math.PI;
    bike.update(1 / 60, { KeyW: true, KeyA: dh > 0.05, KeyD: dh < -0.05 });
  }
  assert.equal(k, O.path.length, 'the bike rides the whole ledge');
  assert.ok(bike.pos.y > O.top - 3, `and comes up onto the top (${bike.pos.y.toFixed(1)} of ${O.top.toFixed(1)})`);
  // a look out over the ride from the platform; the level design audit counts it as a place
  const look = allInteractables().find((e) => e.id === 'dunes.lookout');
  assert.ok(look && look.prompt === 'look out', 'look out from the platform');
  assert.ok(level.sights().some((s) => s.name === 'the lookout on the sandfall mesa'), 'a sight the audit counts');
});
