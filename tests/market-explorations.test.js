// The Signal Market's three explorations, one way through the world (issue #191; docs/systems/worlds.md "The Signal
// Market's explorations"): up from beside Madame Sel through the market in the air (the lantern, sign painters' and
// antenna sellers' galleries up the west towers, Kip's skybridge on the way, the basket over the square onto the cream
// balcony, the antenna sellers' mast over it all), and home from the square down into the old market under the avenue
// (its grilles, its first stall, its crossing sign), east along the passage and up into the screen lanes, where a
// picture runs ahead of you from screen to screen and every screen turns to one face once the tower has spoken.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

await import('./register-gadgets.js');
const A = await import('./playthrough-agent.js');
const L = await import('../scripts/level-design/lib.mjs');
const { auditContact, formatContact } = await import('../src/contact-audit.js');
const { AIR, STAIRS, GALLERIES, BASKET, MAST, KIP_BRIDGE } = await import('../src/market-air.js');
const { OLD, STAIRWELL, GRILLES, ROUND, TUNNEL, ALLEY_STAIR } = await import('../src/market-old.js');
const { LANES, LANE, alongLanes } = await import('../src/market-lanes.js');
const { QUESTS, THINGS } = await import('../src/story/bazaar-data.js');
const { parseLine } = await import('../src/story/tone.js');
const { FRAGMENTS } = await import('../src/fragments-data.js');

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const flat = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

globalThis.location = { search: '?level=bazaar' };
const W = A.loadWorld('bazaar');
const { level, physics, scene } = W, X = level.market;
test.after(() => W.dispose?.());
const XM = (AIR.x0 + AIR.x1) / 2;
const floorAt = (x, y, z) => physics.groundAt(x, y + 0.6, z, 4);

/** As the level design audit sees: nothing the collision holds between the eye and the point. */
function sees(eye, at, near = 2) {
  const d = eye.distanceTo(at), dir = at.clone().sub(eye).normalize();
  return physics.rayDistance(eye.clone(), dir, d) >= d - near;
}
/** A traveller who cannot climb, walked through the points in turn (a point he stalls short of ends the walk). */
function walk(points, from, { secs = 25 } = {}) {
  const P = new A.Player(physics, { health: false, climb: false });
  P.has = () => false;
  P.respawn(from.clone().add(V(0, 0.3, 0)));
  let reached = 0;
  for (const to of points) {
    let i = 0;
    for (; i < 60 * secs && flat(P.pos, to) > 0.8; i++) {
      const heading = Math.atan2(to.x - P.pos.x, to.z - P.pos.z);
      P.heading = heading;
      physics.syncMovers?.(1 / 60);
      P.update(1 / 60, { KeyW: true }, heading + Math.PI);
    }
    if (flat(P.pos, to) > 0.8 || Math.abs(P.pos.y - to.y) > 1.2) break;
    reached++;
  }
  return { reached, pos: P.pos.clone(), P };
}
const on = (p) => { const [x, y, z] = p; return V(x, physics.groundAt(x, y + 1, z, 3), z); };
const ours = /^The (market in the air|old market|screen lanes)/;
const mine = () => { const out = []; scene.traverse((o) => { if (o.isMesh && ours.test(o.name ?? '') && !/basket/.test(o.name)) out.push(o); }); return out; };

test('the climbs: the quest’s two climbs name the market in the air, which runs from beside Sel to Kip and on to the balcony', () => {
  const line = level.lines.find((l) => l.name === 'the market in the air');
  assert.ok(line && line.auto === false, 'a leading line the stages name');
  const Q = QUESTS.find((q) => q.id === 'bazaar.signal');
  for (const id of ['kip', 'tune']) assert.equal(Q.stages.find((s) => s.id === id).via, 'the market in the air', `${id} goes up through it`);
  const sel = W.quests.where(Q.stages[0]), kip = W.quests.where(Q.stages[1]), ant = level.signal.places.antenna;
  const pts = line.points;
  for (const [a, b, name] of [[sel, kip, 'Sel to Kip'], [kip, ant, 'Kip to the antenna']]) {
    const hit = L.lineFor(a.toArray(), b.toArray(), [line], { reach: { a: 80, b: 80 } });
    assert.ok(hit && hit.metres < 1.6 * L.dist(a.toArray(), b.toArray()), `${name}: along it (${hit?.metres} m for ${Math.round(L.dist(a.toArray(), b.toArray()))})`);
  }
  assert.ok(pts.some((p) => Math.hypot(p[0] - kip.x, p[2] - kip.z) < 5), 'past Kip on his bridge');
  assert.ok(pts.some((p) => Math.hypot(p[0] - BASKET.to[0], p[2] - BASKET.to[2]) < 1), 'and over in the basket');
  // each gallery its own trade, at its own height, stairs between: 10, 25, 44 m
  assert.deepEqual(GALLERIES.map((g) => g.y), [10, 25, 44]);
  assert.deepEqual(new Set(X.air.stalls.map((s) => s.trade)), new Set(['lanterns', 'signs', 'antennas']));
  for (const S of X.air.stairs) assert.ok(S.rise < 0.45, `the ${S.id} stair’s step (${S.rise.toFixed(2)} m)`);
});

test('walked up by a traveller who cannot climb: the lantern stair, the galleries, Kip’s bridge, to the basket’s end', () => {
  const pts = [];
  const stair = (S) => { for (const t of X.air.stairs.find((q) => q.id === S.id).treads) pts.push(V(XM, t.y, t.z)); };
  const deck = (y, z0, z1) => { for (let z = z0; Math.sign(z1 - z0) * (z1 - z) > 0; z += Math.sign(z1 - z0) * 6) pts.push(V(XM, y, z)); pts.push(V(XM, y, z1)); };
  stair(STAIRS[0]); deck(10, 52.5, -1.5);
  stair(STAIRS[1]); deck(25, -23.5, -88);
  pts.push(V(-26, 25, -90), V(XM, 25, -92.5));   // (Kip’s bridge: on and back to the stair’s foot)
  stair(STAIRS[2]); deck(44, -121.5, -204);
  pts.unshift(V(XM, 0.3, STAIRS[0].z0 + 1));   // (into the gap between the stalls, before its foot)
  const from = V(-22, 0.3, STAIRS[0].z0 + 1);
  const up = walk(pts, from);
  assert.equal(up.reached, pts.length, `walked to the basket (${up.reached} of ${pts.length}, stopped at ${up.pos.toArray().map((v) => v.toFixed(1))})`);
  // the rails hold him on: from the gallery’s middle, walking out sideways toward the street, he stays up
  const side = walk([V(-20, 25, -55)], V(XM, 25, -55), { secs: 3 });
  assert.ok(side.pos.y > 24.5 && side.pos.x < AIR.x1 + 0.2, `kept on the gallery by its rail (${side.pos.toArray().map((v) => v.toFixed(1))})`);
});

test('the basket carries whoever stands in it over the square onto the cream balcony, goes home empty, and comes when called', () => {
  const B = X.air.basket, P = W.player;
  assert.ok(B.collider?.moving, 'a moving collider');
  assert.ok(B.len > 20, `a ride over the square (${B.len.toFixed(0)} m)`);
  // the balcony is where it stops: its floor flush with the basket’s
  assert.ok(Math.abs(floorAt(BASKET.to[0] + BASKET.r + 0.6, 44, BASKET.to[2]) - 44) < 0.05, 'the balcony beside its far end');
  assert.ok(Math.abs(floorAt(BASKET.from[0] - BASKET.r - 0.6, 44, BASKET.from[2]) - 44) < 0.05, 'the gallery beside its near end');
  W.at(V(...BASKET.from).add(V(0, 0.05, 0)));
  let t = 0;
  const run = (secs, keys = {}, heading = 0) => { for (let i = 0; i < 60 * secs; i++) { physics.syncMovers(1 / 60); P.update(1 / 60, keys, heading); X.air.update(1 / 60, (t += 1 / 60), P); } };
  run(22);
  assert.equal(B.t, 1, 'it went over');
  assert.ok(flat(P.pos, V(...BASKET.to)) < BASKET.r && Math.abs(P.pos.y - 44) < 0.5, `and carried him (${P.pos.toArray().map((v) => v.toFixed(1))})`);
  // he steps off onto the balcony and walks away: it goes home after a while
  W.at(V(-4, 44.05, -232));
  run(BASKET.home + 16);
  assert.equal(B.t, 0, 'home again, empty');
  // at the balcony’s end, waiting by it: it comes back for him
  W.at(V(BASKET.to[0] + 2.2, 44.05, BASKET.to[2]));
  run(14);
  assert.equal(B.t, 1, 'called over');
  B.t = 0; B.dir = 0; X.air.update(0, t, null); physics.syncMovers(0);
});

test('the antenna sellers’ mast: from the gallery’s open rail, a climb to its deck at 60 m and on to the nest at 76 m', () => {
  const xm = (MAST.x0 + MAST.x1) / 2, zm = (MAST.z0 + MAST.z1) / 2;
  assert.ok(Math.abs(floorAt(xm, MAST.deck, MAST.z0 + 0.6) - MAST.deck) < 0.05, 'the deck solid');
  assert.ok(Math.abs(floorAt(xm, MAST.nest, zm) - MAST.nest) < 0.05, 'the nest solid');
  assert.ok(MAST.nest - MAST.deck <= 20 && MAST.deck - 44 <= 20, 'each climb well within a climb’s grip (~30 m)');
  // its face beside the gallery, the gallery’s rail open there
  const hit = physics.rayHit(V(XM, 45, zm), V(-1, 0, 0), 4);
  assert.ok(hit && Math.abs(hit.point.x - MAST.x1) < 0.05, 'its face right off the gallery’s edge, nothing between');
  assert.ok(X.air.sights.some((s) => s.name === 'the antenna sellers’ mast' && s.at.y === MAST.nest), 'a place to stop, at the top');
  const look = A.allInteractables().find((e) => e.id === 'mast');
  assert.ok(look && look.distance({ pos: V(xm, MAST.nest, zm) }) < look.range, 'and something to look at from it');
});

test('down out of the square and home: the stair, the old street under the grilles, the passage, the stair up, the screen lanes, the ship', () => {
  const line = level.lines.find((l) => l.name === 'the old market and the screen lanes');
  assert.ok(line && line.auto === false, 'a leading line the last stage names home');
  const Q = QUESTS.find((q) => q.id === 'bazaar.signal');
  assert.equal(Q.stages.at(-1).home, 'the old market and the screen lanes');
  const door = level.temple.outside.door.at, ship = level.spawn;
  const hit = L.lineFor(door.toArray(), ship.toArray(), [line], { reach: { a: 80, b: 125 } });
  assert.ok(hit && hit.metres < 1.6 * L.dist(door.toArray(), ship.toArray()), `not a long way round (${hit?.metres} m for ${Math.round(L.dist(door.toArray(), ship.toArray()))})`);
  // walked, from in front of the silent tower down into the old street and out through the lanes
  const pts = [];
  pts.push(V(0, 0, -216));
  for (let z = STAIRWELL.z0 + 0.5; z < STAIRWELL.z1; z += 0.875) pts.push(V(0, physics.groundAt(0, 0.5, z, 10), z));
  for (const p of line.points.slice(line.points.findIndex((q) => q[2] === -199.4))) pts.push(on(p));
  const home = walk(pts, V(0, 0, -219));
  assert.equal(home.reached, pts.length, `walked home (${home.reached} of ${pts.length}, stopped at ${home.pos.toArray().map((v) => v.toFixed(1))})`);
  // the old street a storey under the avenue, the avenue solid over it, the grilles too
  assert.ok(OLD.floor <= -5, 'a storey down');
  for (const z of [-195, -170, -130]) assert.ok(Math.abs(floorAt(0, 0, z)) < 1e-6, `the avenue over it at ${z}`);
  for (const g of GRILLES) assert.ok(Math.abs(floorAt(3, 0, g.z)) < 1e-6, `the grille at ${g.z} holds you`);
  assert.ok(Math.abs(floorAt(ROUND.x + 1, 0, ROUND.z)) < 1e-6, 'the round grille too');
  assert.ok(Math.abs(floorAt(0, OLD.floor, -150) - OLD.floor) < 1e-6, 'and the old street’s floor under them');
  assert.equal(level.ground.heightAt(0, -150), OLD.floor - 0.5, 'the ground goes down there');
  assert.equal(level.ground.heightAt(0, -250), 0, 'and is the street everywhere else');
});

test('seen from where they are met: the galleries from beside Sel, the basket from the square, the tower’s balcony from the old street’s stair foot', () => {
  const sel = level.signal.places.selLanding.clone().add(V(0, 1.7, 0));
  assert.ok(sees(sel, V(AIR.x1 + 0.1, 11.3, 50)), 'the lantern gallery’s rail from beside Sel');
  assert.ok(sees(sel, V(AIR.x1, 1.5, STAIRS[0].z0 - 2)), 'and the foot of the stair up to it');
  assert.ok(sees(V(-10, 1.7, -224), V(BASKET.from[0], 46, BASKET.from[2]).lerp(V(...BASKET.to), 0.5)), 'the basket’s cable over the square from its corner');
  assert.ok(sees(V(0, OLD.floor + 1.7, STAIRWELL.z1 + 1), V(0, 44.6, -230), 4), 'the cream balcony up through the stairwell from the old street');
  assert.ok(sees(V(XM, 45.7, -125), V(-8, 46, -236)), 'the balcony from the antenna gallery');
});

test('the screen lanes: walled with screens both sides, a picture running ahead toward the square, then home, and one face on every screen', () => {
  // walled: from the lanes’ middle at eye height, a screen on each side but where a dead end opens
  let n = 0, walled = 0;
  for (const g of X.lanes.segs) for (let t = 1.5; t < g.len - 1.5; t += 2.5) {
    const p = V(g.a.x + g.dir.x * t, 1.4, g.a.y + g.dir.y * t);
    for (const s of [-1, 1]) {
      n++;
      const d = physics.rayDistance(p.clone(), V(g.n.x * s, 0, g.n.y * s), LANE.half + 0.6);
      if (d < LANE.half + 0.3) walled++;
    }
  }
  assert.ok(walled / n > 0.8, `the screens wall the lanes (${walled} of ${n})`);
  assert.ok(X.lanes.slots.length > 120, `screens at eye height (${X.lanes.slots.length})`);
  // the picture: ten metres or so ahead, toward the old market before the broadcast
  const P = { pos: V(), onGround: true };
  const at = (s) => { const g = X.lanes.segs.find((q) => s >= q.s0 && s <= q.s0 + q.len); return V(g.a.x + g.dir.x * (s - g.s0), 0.1, g.a.y + g.dir.y * (s - g.s0)); };
  P.pos.copy(at(120));
  X.lanes.update(0.1, 0, P);
  const s0 = alongLanes(X.lanes.picture.position.x, X.lanes.picture.position.z).s;
  assert.ok(s0 < 115 && s0 > 100, `before the tower speaks it leads toward the square (${s0.toFixed(0)} m along, you at 120)`);
  // the tower speaks: one face on every screen, and the picture leads home
  A.game.set('bazaar.broadcast.on', true);
  try {
    assert.ok(X.lanes.face.visible && !X.lanes.screens.visible, 'every screen the same face');
    X.lanes.update(0.1, 0, P);
    const s1 = alongLanes(X.lanes.picture.position.x, X.lanes.picture.position.z).s;
    assert.ok(s1 > 125 && s1 < 140, `then it leads home (${s1.toFixed(0)} m along)`);
  } finally { A.game.set('bazaar.broadcast.on', false); }
  assert.ok(!X.lanes.face.visible && X.lanes.screens.visible, 'and back');
  // the lanes keep clear of the towers either side and of the makers’ court
  for (const [x, z] of LANES) assert.ok(!(Math.abs(z - 15) < 20 && x < 35), `${x}, ${z} off the avenue`);
  const court = level.finds?.courts?.bazaar;
  if (court?.box) assert.ok(alongLanes(court.box.x ?? court.box[0], court.box.z ?? court.box[2]).off > 20, 'clear of the makers’ court');
});

test('places to stop, each with a look in two lines, every line with a tone', () => {
  for (const name of ['the lantern sellers’ gallery', 'the sign painters’ gallery', 'the antenna sellers’ gallery', 'the antenna sellers’ mast', 'the first stall', 'the round grille', 'the screen-mender’s bench'])
    assert.ok(level.sights.some((s) => s.name === name), `${name}`);
  for (const [id, at] of [['firststall', X.old.places.firstStall], ['mender', X.lanes.places.mender]]) {
    const look = A.allInteractables().find((e) => e.id === id);
    assert.ok(look && look.distance({ pos: at.clone() }) < look.range, `${id}: something to look at`);
    const say = THINGS[id].talk.nodes.look.say;
    assert.ok(say.length <= 3 && say.every((l) => parseLine(typeof l === 'string' ? l : l.text).explicit), `${id}: terse, with tones`);
  }
  const sel = QUESTS.find((q) => q.id === 'bazaar.signal');
  assert.ok(sel, 'the quest');
});

test('the market’s fragments are where they were, none on the new ways', () => {
  for (const [x, y, z] of FRAGMENTS.bazaar) {
    assert.ok(Math.abs(floorAt(x, y, z) - y) < 0.05, `the spot at ${x}, ${y}, ${z} still stands`);
    assert.ok(alongLanes(x, z).off > 8, 'off the screen lanes');
    assert.ok(!(Math.abs(x) < OLD.x + 2 && z > OLD.z0 - 2 && z < OLD.z1 + 2 && y < 1), 'off the old market');
    assert.ok(!(x > AIR.x0 - 1 && x < AIR.x1 + 1), 'off the galleries');
  }
});

test('the new pieces stand as they are drawn (the contact audit on them), within their collision budget', () => {
  const keep = new Set(mine());
  const exclude = [];
  scene.traverse((o) => { if (o.isMesh && !keep.has(o)) exclude.push(o); });
  const r = auditContact({ physics, scene, exclude, max: 12000 });
  const bad = r.groups.filter((g) => ours.test(g.name ?? '') && g.issue !== 'unseen floor');
  const n = bad.reduce((s, g) => s + g.n, 0);
  assert.ok(r.checked.walk > 300, `drawn tops checked: ${r.checked.walk}`);
  assert.ok(n <= 8, `${n} contact samples off on them\n${formatContact(r)}`);
  // (the only floor not drawn: the sheet under the grilles' bars, so you see down through them)
  const unseen = r.groups.filter((g) => g.issue === 'unseen floor');
  for (const g of unseen) for (const p of [g.at].flat()) if (p && Array.isArray(p) && Math.abs(p[1]) < 0.1) assert.ok(GRILLES.some((q) => Math.abs(p[2] - q.z) < q.half + 0.2) || Math.hypot(p[0] - ROUND.x, p[2] - ROUND.z) < ROUND.r + 0.3, `an unseen floor at ${p} is a grille’s`);
  const tris = {};
  for (const m of keep) if (!m.userData.noCollide && m.visible) { const k = m.name.match(ours)[1]; tris[k] = (tris[k] ?? 0) + (m.geometry.index ? m.geometry.index.count : m.geometry.attributes.position.count) / 3; }
  const CAP = { 'market in the air': 4500, 'old market': 12000, 'screen lanes': 6500 };
  for (const [k, cap] of Object.entries(CAP)) assert.ok((tris[k] ?? 0) > 0 && tris[k] <= cap, `${k}: ${tris[k]} triangles (cap ${cap})`);
});
