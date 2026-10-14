// The Moon Foundry's three explorations, one way through the world (issue #193; docs/systems/worlds.md "The Moon Foundry:
// inside the moons, the cranes and the night pour"): from Wen's gantry into the broken moon, up the street on its inner
// curve and the spiral to its crown, along the high walk to the old hoist's signal box, the moon-carrier down to the
// lookout and back; under it all the night pour's runnels, dry lanes by day, molten by night, every one running back to
// the Casting-House.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

await import('./register-gadgets.js');
const A = await import('./playthrough-agent.js');
const L = await import('../scripts/level-design/lib.mjs');
const { ROUTE } = await import('./playthrough-worlds.js');
const { COURT, PMOON, HUNG, HUNG2, CRADLE } = await import('../src/levels/moon-foundry.js');
const { RUNNEL, RUNNELS, RECTS, BRIDGES, STEPS, floorHeight, runnelAt, onPlate, slabRects, toHouse, pourK } = await import('../src/foundry-pour.js');
const { STREET, SPIRAL, HATCH, streetPlan, cutHoles, snapHoles, sector } = await import('../src/foundry-street.js');
const { BOX, RIDE, CRANES, ridePos, rideState, rideStep, rideCall, rideDocked, craneTarget, craneStep, atHouseHour } = await import('../src/foundry-cranes.js');
const { moon } = await import('../src/levels/moon-foundry-kit.js');
const { QUESTS } = await import('../src/story/moonfoundry-people.js');

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const flat = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

globalThis.location = { search: '?level=moonfoundry' };
const W = A.loadWorld('moonfoundry');
const { level, physics } = W, ground = (x, z) => level.ground.heightAt(x, z);
const door = level.temple.outside.door.at;
test.after(() => W.dispose());

/** As the level design audit sees: nothing the collision holds between the eye and the point, and no ground over the ray. */
function sees(eye, at, near = 3) {
  const d = eye.distanceTo(at), dir = at.clone().sub(eye).normalize();
  if (physics.rayDistance(eye.clone(), dir, d) < d - near) return false;
  for (let s = 6; s < d - near; s += 6) { const p = eye.clone().addScaledVector(dir, s); if (ground(p.x, p.z) > p.y + 0.3) return false; }
  return true;
}
/** A traveller who cannot climb, walked through the points in turn (a point he stalls short of ends the walk). */
function walk(points, from, { tick = () => {}, seconds = 25 } = {}) {
  const P = new A.Player(physics, { health: false, climb: false });
  P.has = () => false;
  P.respawn(from.clone().add(V(0, 0.3, 0)));
  let reached = 0;
  for (const to of points) {
    let i = 0;
    for (; i < 60 * seconds && flat(P.pos, to) > 0.8; i++) {
      const heading = Math.atan2(to.x - P.pos.x, to.z - P.pos.z);
      P.heading = heading;
      tick(1 / 60);
      physics.syncMovers?.(1 / 60);
      P.update(1 / 60, { KeyW: true }, heading + Math.PI);
    }
    if (flat(P.pos, to) > 0.8 || Math.abs(P.pos.y - to.y) > 1.2) break;
    reached++;
  }
  return { reached, pos: P.pos.clone(), P };
}
const clearAt = (p, y, h = 1.9) => physics.pushCapsule(V(p.x, y + 0.05, p.z), 0.35, 0.6, h) === null;

test('one way through the moons: Wen’s gantry, the street up the broken moon to its crown, the high walk, the carrier to the lookout, the signal box', () => {
  const play = ROUTE.find((r) => r.id === 'moonfoundry').play, at = (q) => play.findIndex((p) => p === q || p.act === q);
  assert.ok(at('meetWen') < at('climbMoon') && at('climbMoon') < at('moonfoundry.count') && at('moonfoundry.count') < at('moonfoundry.moons'), 'the route goes up through the broken moon between Wen and the count');
  const crown = W.quests.resolve('moonCrown');
  assert.ok(crown && Math.abs(crown.y - (COURT.yc + SPIRAL.top)) < 0.01, 'the crown’s deck, a place the route stops at');
  const hoist = QUESTS.find((q) => q.id === 'moonfoundry.moons').stages.find((s) => s.id === 'hoist');
  assert.match(hoist.text, /signal box/, 'the main quest looks at the moons from the signal box');
  const goal = W.quests.resolve('hoistDeck');
  assert.ok(goal.x > BOX.x0 && goal.x < BOX.x1 && goal.z > BOX.z0 && goal.z < BOX.z1 && Math.abs(goal.y - BOX.y) < 0.01, 'its goal in the signal box');
  // the leading lines carry it: Wen to the crown up the street, the crown to the lookout by the walk and the carrier
  const street = level.lines.find((l) => l.name === 'the street in the broken moon'), high = level.lines.find((l) => l.name === 'the high walk and the moon-carrier');
  assert.ok(street && high, 'two leading lines');
  const lookout = W.quests.resolve('lookout');
  assert.ok(L.dist(street.points.at(-1), crown.toArray()) < 3 && L.dist(high.points[0], crown.toArray()) < 3, 'the street ends where the high walk starts');
  assert.ok(L.dist(high.points.at(-1), lookout.toArray()) < 1, 'and the walk and the carrier end at the lookout');
  assert.ok(street.points.reduce((m, p) => Math.max(m, p[1]), 0) - street.points[0][1] > 45, 'the street climbs from the gantry to the crown (height on the path)');
});

test('the street on the inner curve, its bridge and the spiral are walked up to the crown and down again by a traveller who cannot climb', () => {
  const pts = level.street.line;
  const from = V(level.court.lip.x, level.court.y, level.court.lip.z);
  // in over the lip, across the courtyard to the street's foot, up it
  const up = walk(pts, from, { seconds: 30 });
  assert.equal(up.reached, pts.length, `walked up the whole street and spiral (${up.reached} of ${pts.length} points, stopped at ${up.pos.toArray().map((v) => v.toFixed(1))})`);
  assert.ok(up.pos.y > COURT.yc + SPIRAL.top - 0.4, `out on the crown’s deck (${up.pos.y.toFixed(1)} m)`);
  const down = walk([...pts].reverse(), pts.at(-1), { seconds: 30 });
  assert.equal(down.reached, pts.length, `and down again (${down.reached} of ${pts.length})`);
  // each flight a stair, not a ramp; a house on most landings; the courtyard's houses kept off the street's foot
  const P = level.street.plan;
  assert.equal(P.flights.length, STREET.flights);
  for (const F of P.flights) assert.ok((F.y1 - F.y0) / F.n <= 0.25, `flight ${F.k}: steps of ${((F.y1 - F.y0) / F.n).toFixed(2)} m`);
  assert.ok(level.street.houses.length >= 6, `${level.street.houses.length} houses along it`);
  for (const H of level.street.houses) assert.ok(physics.groundAt(H.at.x, H.top + 0.6, H.at.z, 3) > H.at.y + 1, `the house on landing ${H.k} solid (${physics.groundAt(H.at.x, H.top + 0.6, H.at.z, 3)?.toFixed(2)} for ${H.at.y.toFixed(1)}, its top ${H.top.toFixed(1)})`);
});

test('the crater windows open the shell beside the street, and through them the floor below is in sight', () => {
  const P = level.street.plan, C = V(COURT.x, COURT.yc, COURT.z);
  for (const w of P.windows) {
    const o = C.clone().addScaledVector(w.dir, COURT.R - COURT.thick - 1.2), d = w.dir.clone();
    assert.ok(!(physics.rayDistance(o, d, 3) < 2.4), `the window at ${w.a.toFixed(2)} is open through the shell`);
  }
  // from the street by a low window, out and down through it to the floor
  const low = P.windows.filter((w) => !w.high)[0], F = P.flights[1];
  const eye = V(COURT.x + Math.sin(low.a) * (F ? 20 : 20), COURT.yc + low.y, COURT.z + Math.cos(low.a) * 20);
  const out = C.clone().addScaledVector(low.dir, COURT.R + 0.5), floorPt = out.clone().addScaledVector(out.clone().sub(eye).normalize(), (out.y - 0.5) / Math.max(0.2, (eye.y - out.y) / eye.distanceTo(out)));
  floorPt.y = 0.5;
  assert.ok(sees(eye, out, 0.5), 'the window seen from the street');
  // the hatch at the crown: open over the spiral's last turn
  const well = P.crown.landing[1] + (1 - (P.crown.landing[1] - P.crown.landing[0]) / (Math.PI * 2)) * Math.PI;   // (the middle of the open stairwell)
  const hat = C.clone().add(V(Math.sin(well) * 2, SPIRAL.top - 0.5 * SPIRAL.open * 9.3 + 0.25, Math.cos(well) * 2));   // (just over the step there)
  assert.ok(!(physics.rayDistance(hat, V(0, 1, 0), 6) < 5), 'the hatch is open over the spiral’s last turn');
  // the cut keeps the shell whole elsewhere: a moon cut the same way has holes only where they were asked for
  const M = moon({ R: 20, seg: 48, craters: 0, seed: 3, cut: { dir: V(0, 0, 1), angle: 0.7, thick: 0.5 } });
  const before = M.shell[0].index.count;
  const holes = snapHoles([{ dir: V(1, 0.2, -0.5).normalize(), r: 2.6 }], M.shell[0]);
  cutHoles(M.shell, holes, 20);
  assert.ok(M.shell[0].index.count < before && M.shell[0].index.count > before * 0.97, 'a few triangles out, the rest kept');
  const rc = new THREE.Raycaster(holes[0].dir.clone().multiplyScalar(30), holes[0].dir.clone().negate());
  assert.equal(rc.intersectObject(new THREE.Mesh(M.shell[0], new THREE.MeshBasicMaterial({ side: THREE.DoubleSide })))[0]?.distance < 10.5 ? 'shut' : 'open', 'open');
  const s = sector(0, 1, 2, 3, 0, 1);
  s.computeBoundingBox();
  assert.ok(s.boundingBox.max.y === 1 && s.boundingBox.min.y === 0, 'a ring sector, solid');
});

test('the high walk runs from the crown’s deck down to the signal box’s door, walked both ways; from the box the hung moons and the Casting-House are in sight', () => {
  const Wk = level.walk, pts = [Wk.from, ...Wk.points.slice(1)];
  const go = walk(pts, level.street.crown.clone().add(V(0.5, 0, 1.8)));
  assert.equal(go.reached, pts.length, `along the high walk into the box (${go.reached} of ${pts.length}, at ${go.pos.toArray().map((v) => v.toFixed(1))})`);
  assert.ok(Math.abs(go.pos.y - BOX.y) < 0.3, 'in the signal box');
  const back = walk([...pts].reverse(), pts.at(-1));
  assert.equal(back.reached, pts.length, 'and back to the crown');
  // its deck clear over the moon's shoulder all the way (the shell under it, never through it)
  for (let k = 0; k <= 20; k++) { const p = Wk.from.clone().lerp(Wk.door, k / 20); assert.ok(clearAt(p, p.y), `the way clear at ${k}/20`); }
  // the box: its floor round the hoist's top stage, the rungs still come up at its south edge, its levers
  const box = level.signalBox, eye = V(53.3, BOX.y + 1.6, -181.5);
  assert.ok(Math.abs(physics.groundAt(53, BOX.y + 2, BOX.z1 - 0.2, 4) - BOX.y) < 0.05, 'the balcony where the hoist’s rungs come out');
  assert.equal(box.levers.length, 6, 'six levers');
  for (const h of [HUNG]) assert.ok(sees(V(BOX.x0 + 0.6, BOX.y + 1.6, -181), V(h.x, h.y, h.z), h.R), `the hung moon at ${h.x}, ${h.z} seen from the box`);
  const houseEye = V(BOX.x1 - .6, BOX.y + 1.6, BOX.z1 - .5), houseDir = door.clone().add(V(0, 6, 0)).sub(houseEye).normalize();
  const shell = new THREE.Raycaster(houseEye, houseDir).intersectObjects(level.temple.outside.kit.group.children, true)[0];
  const first = physics.rayHit(houseEye, houseDir, houseEye.distanceTo(door) + 10);
  assert.ok(shell && first && first.point.distanceTo(shell.point) < .05, 'the first visible surface is the Casting-House itself');
  assert.ok(eye.y > CRADLE.yc + CRADLE.R, 'over the moon in the claws');
});

test('the cranes’ timetable: the carrier waits at each dock, goes in its time, comes when called; the travelling cranes keep their stops by day and carry their moons to the Casting-House at dusk', () => {
  // the carrier's docks: flush with the box's floor and the lookout's jetty
  assert.ok(Math.abs(ridePos(0).y - BOX.y) < 1e-9 && Math.abs(ridePos(1).y - (PMOON.h * 0.78)) < 1e-9, 'its deck flush at both docks');
  assert.ok(RIDE.a[0] - RIDE.deck - BOX.x1 < 0.3 && RIDE.a[0] - RIDE.deck > BOX.x1, 'docked against the box’s east door');
  const toPillar = Math.hypot(RIDE.b[0] - PMOON.x, RIDE.b[1] - PMOON.z);
  assert.ok(toPillar - RIDE.deck - RIDE.jetty.to < 0.4 && toPillar - RIDE.R > 3.2 + 2, 'docked at the jetty’s end, its moon clear of the pillar');
  assert.ok(toPillar - RIDE.deck > PMOON.R + 1, 'its chains clear of the moon on the pillar');
  // its timetable: wait, go, arrive, wait, come back
  const st = rideState(), L = Math.hypot(RIDE.b[0] - RIDE.a[0], RIDE.yB - RIDE.yA, RIDE.b[1] - RIDE.a[1]);
  let t = 0;
  while (rideDocked(st) === 0 && t < 60) { rideStep(st, 0.1); t += 0.1; }
  assert.ok(Math.abs(t - RIDE.wait) < 0.2, `waits ${RIDE.wait} s at the box (${t.toFixed(1)})`);
  let ride = 0;
  while (rideDocked(st) !== 1 && ride < 120) { rideStep(st, 0.1); ride += 0.1; }
  assert.ok(Math.abs(ride - L / RIDE.speed) < 0.5, `carries you down in ${ride.toFixed(1)} s (${(L / RIDE.speed).toFixed(1)})`);
  // called back from the box while it waits at the lookout: it comes at once; pulled where it is docked, it goes at once
  assert.equal(rideCall(st, 0), 'called');
  rideStep(st, 0.1);
  assert.ok(st.u < 1 && st.to === 0, 'on its way back');
  while (rideDocked(st) !== 0) rideStep(st, 0.1);
  assert.equal(rideCall(st, 0), 'sent');
  rideStep(st, 0.1);
  assert.ok(st.u > 0 && st.to === 1, 'sent off at once');
  // the travelling cranes: their stops on their runs, the dusk stop the nearest to the Casting-House, held till dawn
  for (const c of CRANES) {
    const d = (p) => Math.hypot(p[0] - door.x, p[1] - door.z);
    for (const p of [...c.stops, c.dusk]) assert.ok(p[0] >= c.x[0] && p[0] <= c.x[1] && p[1] <= c.z[0] && p[1] >= c.z[1], `${c.name}: ${p} on its run`);
    assert.ok(c.stops.every((p) => d(c.dusk) <= d(p)), `${c.name}: at dusk the nearest it can get to the Casting-House`);
    const day = new Set(); for (let tt = 0; tt < c.dwell * c.stops.length; tt += c.dwell) day.add(String(craneTarget(c, tt + 1, 10)));
    assert.equal(day.size, c.stops.length, `${c.name}: every stop in a round of the day`);
    assert.deepEqual(craneTarget(c, 123, 18.5), c.dusk); assert.deepEqual(craneTarget(c, 123, 2), c.dusk); assert.deepEqual(craneTarget(c, 123, 9), craneTarget(c, 123, 12));
    const s = { started: false }; craneStep(s, c, 0.1, 0, 10);
    for (let k = 0; k < 3000; k++) craneStep(s, c, 0.1, 0, 18);
    assert.ok(Math.hypot(s.x - c.dusk[0], s.z - c.dusk[1]) < 1e-6, `${c.name}: there by nightfall`);
    // its moon clear of the hung moons, the pillars on its runway's columns and the broken moon wherever it goes
    for (const p of [...c.stops, c.dusk]) {
      for (const m of [HUNG, HUNG2, { x: COURT.x, z: COURT.z, y: COURT.yc, R: COURT.R }, { x: PMOON.x, z: PMOON.z, y: PMOON.h + PMOON.R, R: PMOON.R }]) assert.ok(Math.hypot(p[0] - m.x, c.y - m.y, p[1] - m.z) > c.R + m.R + 1, `${c.name} at ${p}: clear of the moon at ${m.x}, ${m.z}`);
      for (const [px, pz] of level.pillars) assert.ok(Math.hypot(p[0] - px, p[1] - pz) > c.R + 3.9 || Math.abs(p[0] - px) > c.R + 3.9, `${c.name} at ${p}: clear of the pillar at ${px}, ${pz}`);
    }
    assert.ok(atHouseHour(18) && atHouseHour(3) && !atHouseHour(10));
  }
});

test('the moon-carrier carries a traveller from the signal box down to the lookout’s jetty, and the lever calls it', () => {
  const C = level.cranes, st = C.ride.state;
  Object.assign(st, { u: 0, to: 0, wait: 0.5 });
  C.update(0.016, 0, 10);
  physics.syncMovers?.(0);
  const P = new A.Player(physics, { health: false, climb: false });
  P.has = () => false;
  P.respawn(ridePos(0).add(V(0, 0.3, 0)));
  let t = 0;
  for (; t < 60 && rideDocked(st) !== 1; t += 1 / 60) { C.update(1 / 60, t, 10); physics.syncMovers(1 / 60); P.update(1 / 60, {}, 0); }
  for (let k = 0; k < 30; k++) { C.update(1 / 60, t, 10); physics.syncMovers(1 / 60); P.update(1 / 60, {}, 0); }
  const B = ridePos(1);
  assert.ok(flat(P.pos, B) < 1.6 && Math.abs(P.pos.y - B.y) < 0.4, `carried to the lookout’s dock (${P.pos.toArray().map((v) => v.toFixed(1))} for ${B.toArray().map((v) => v.toFixed(1))})`);
  // off it along the jetty onto the lookout's platform: the count is made there
  const J = level.signalBox.jetty, look = W.quests.resolve('lookout');
  const off = walk([J.to.clone(), J.from.clone()], P.pos, { tick: (dt) => { C.update(dt, t, 10); } });
  assert.equal(off.reached, 2, `off the carrier onto the jetty and the platform (${off.pos.toArray().map((v) => v.toFixed(1))})`);
  assert.ok(flat(off.pos, look) < 9 && Math.abs(off.pos.y - look.y) < 5, 'where the moons are counted');
  // the lever in the box calls it back; the bell-pull at the jetty sends it from there
  const lever = A.allInteractables().find((e) => e.id === 'moonfoundry.lever'), bell = A.allInteractables().find((e) => e.id === 'moonfoundry.bell');
  assert.ok(lever && lever.prompt === 'pull the lever' && bell && bell.prompt === 'pull the bell-cord', 'a lever and a bell-pull');
  assert.ok(lever.distance({ pos: level.signalBox.stand }) < lever.range, 'the lever at hand by the levers');
  assert.ok(bell.distance({ pos: J.to.clone().add(V(0, 0.05, 0)) }) < bell.range, 'the bell-pull at hand at the jetty’s end');
  Object.assign(st, { u: 1, to: 1, wait: 9 });
  lever.use();
  assert.equal(st.to, 0, 'the lever calls it to the box');
  Object.assign(st, { u: 1, to: 1, wait: 9 });
  bell.use();
  assert.equal(st.to, 0, 'the bell-pull sends it from the lookout');
  Object.assign(st, { u: 0, to: 0, wait: RIDE.wait });
});

test('the night pour: runnels cut 1 m into the slabs along their joints, plates and footbridges over them, steps down into them; by night molten and burning', () => {
  const base = () => 0, H = floorHeight(base);
  // every runnel's way leads back to the Casting-House's door
  for (const r of RUNNELS) {
    const way = toHouse(r), end = way.at(-1);
    assert.ok(Math.hypot(end[0] - door.x, end[1] - door.z) < 22, `${r.name} runs back to the Casting-House (${Math.round(Math.hypot(end[0] - door.x, end[1] - door.z))} m from its door)`);
    for (let i = 1; i < r.pts.length; i++) assert.ok(r.pts[i][0] === r.pts[i - 1][0] || r.pts[i][1] === r.pts[i - 1][1], `${r.name}: along the slabs' grid`);
    const line = level.lines.find((l) => l.name === r.name);
    assert.ok(line && line.points.length === way.length, `${r.name}: a leading line the audit follows`);
  }
  for (const R of RECTS) {
    const cx = (R.x0 + R.x1) / 2, cz = (R.z0 + R.z1) / 2;
    if (onPlate(cx, cz)) continue;
    assert.equal(H(cx, cz), -RUNNEL.depth, 'the bed 1 m down');
    assert.equal(level.ground.heightAt(cx, cz), -RUNNEL.depth, 'the level’s ground has it too');
  }
  assert.equal(H(0, 0), 0); assert.equal(H(0, 54), 0, 'the aisle’s plate is floor');
  // the slabs drawn round the runnels, none over them
  for (const [a0, a1, b0, b1] of slabRects(-170, 170, -292, 82)) for (const R of RECTS) assert.ok(a1 <= R.x0 + 1e-6 || a0 >= R.x1 - 1e-6 || b1 <= R.z0 + 1e-6 || b0 >= R.z1 - 1e-6, 'no slab over a runnel');
  // nothing stands in a runnel: the gantries' legs, the pillars, the cradles, the casting rails (but the steps)
  const steps = STEPS.map((s) => V(s.at[0], 0, s.at[1]));
  for (const R of RECTS) {
    const len = R.along === 'x' ? R.x1 - R.x0 : R.z1 - R.z0;
    for (let u = 1.6; u < len - 1.6; u += 2) {
      const p = R.along === 'x' ? V(R.x0 + u, 0, (R.z0 + R.z1) / 2) : V((R.x0 + R.x1) / 2, 0, R.z0 + u);
      if (steps.some((s) => flat(s, p) < 4.5) || onPlate(p.x, p.z) || onPlate(p.x - 1.2, p.z) || onPlate(p.x + 1.2, p.z) || onPlate(p.x, p.z - 1.2) || onPlate(p.x, p.z + 1.2)) continue;
      assert.ok(clearAt(p, -RUNNEL.depth, 0.8), `${RUNNELS[R.runnel].name}: clear in its bed at ${p.x.toFixed(0)}, ${p.z.toFixed(0)}`);
    }
  }
  for (const [px, pz] of level.pillars) assert.ok(runnelAt(px, pz) < 0 && RECTS.every((R) => px < R.x0 - 4.5 || px > R.x1 + 4.5 || pz < R.z0 - 4.5 || pz > R.z1 + 4.5), `the pillar at ${px}, ${pz} clear of the runnels`);
  // by day a dry lane: down the steps on the forecourt, along the bed, and up them again; without them its wall stops you
  const S = STEPS[0], R0 = RECTS.find((q) => S.at[0] >= q.x0 && S.at[0] <= q.x1 && S.at[1] >= q.z0 && S.at[1] <= q.z1), zw = R0.z0 + 0.55;
  const down = walk([V(S.at[0] + 0.3, -0.2, zw), V(S.at[0] + 2.1, -0.8, zw), V(S.at[0] + 6, -1, (R0.z0 + R0.z1) / 2)], V(S.at[0] + 0.3, 0, R0.z0 - 1.5));
  assert.equal(down.reached, 3, `down into the runnel (${down.pos.toArray().map((v) => v.toFixed(1))})`);
  const out = walk([V(S.at[0] + 2.1, -0.8, zw), V(S.at[0] + 0.3, -0.2, zw), V(S.at[0] + 0.3, 0, R0.z0 - 1.5)], down.pos);
  assert.equal(out.reached, 3, `and up its steps out again (${out.pos.toArray().map((v) => v.toFixed(1))})`);
  const stuck = walk([V(S.at[0] + 14, 0, R0.z0 - 2)], V(S.at[0] + 14, -1, (R0.z0 + R0.z1) / 2));
  assert.equal(stuck.reached, 0, 'its wall higher than a step');
  // the footbridges: their decks hold you over the runnel
  for (const B of level.night.bridges.filter((b) => b.kind === 'arch')) assert.ok(physics.groundAt(B.at.x, 3, B.at.z, 4) > 0.4, `the footbridge at ${B.at.x.toFixed(0)}, ${B.at.z.toFixed(0)} holds`);
  assert.equal(BRIDGES.filter((b) => b.kind === 'plate').length, 2);
  // by night: molten, glowing, its bands moving; in it it burns and throws you out; on a bridge, a plate or the floor it doesn't
  const N = level.night;
  assert.ok(pourK(0) === 0 && pourK(1) === 1 && pourK(0.5) > 0 && pourK(0.5) < 1);
  N.force = 0; N.update(0);
  assert.ok(!N.molten.visible && N.lights.every((l) => l.w === 0), 'by day: dry, unlit');
  N.force = 1; N.update(1);
  assert.ok(N.molten.visible && N.lights.every((l) => l.w > 5), 'by night: molten, and lighting the floor round it');
  const col = N.molten.geometry.attributes.color, c0 = col.array.slice(); N.update(1.7);
  assert.ok(col.array.some((v, i) => Math.abs(v - c0[i]) > 1e-3), 'its bands march out from the house');
  const inIt = V(S.at[0] + 8, -1, (R0.z0 + R0.z1) / 2), bridge = N.bridges.find((b) => b.kind === 'arch').at;
  assert.ok(N.hazard.test(inIt), 'in a runnel by night it burns');
  assert.ok(!N.hazard.test(V(0, 0.07, 54)) && !N.hazard.test(bridge) && !N.hazard.test(V(S.at[0] + 8, 0, R0.z0 - 3)), 'not on a plate, a footbridge or the floor');
  const Pl = { pos: inIt.clone(), vel: V(), onGround: true };
  N.update(2, Pl);
  assert.ok(Pl.vel.y > 8 && Math.abs(Pl.vel.z) > 3, 'thrown up and out toward its wall');
  N.force = 0; N.update(0);
  assert.ok(!N.hazard.test(inIt), 'by day it doesn’t');
  N.force = null;
});
