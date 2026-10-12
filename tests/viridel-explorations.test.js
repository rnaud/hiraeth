// Viridel's three explorations, one way through the world (issue #189; docs/systems/worlds.md "Viridel: the fallen
// things, the nursery and the water stair"): from Odile and Talo's ship past the fallen things (the round ship under its
// hill, the dish pond, the split meteor, the builders' machine; the valley's walls a crater's rim), along the Greenhouse
// water past the pyramid nursery (rows by age, the builders' mark from the old one's top), and up the water stair to the
// Greenhouse on its hill, its sluice-gates opened on the way, each flooding the bed below.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

await import('./register-gadgets.js');
const A = await import('./playthrough-agent.js');
const L = await import('../scripts/level-design/lib.mjs');
const { auditContact, formatContact } = await import('../src/contact-audit.js');
const { STAIR, HILL, fromStair } = await import('../src/viridel-stair.js');
const { AGES } = await import('../src/viridel-nursery.js');
const { WRECKS } = await import('../src/viridel-wrecks.js');
const { CRATER } = await import('../src/levels/edena.js');
const { THINGS } = await import('../src/story/edena-data.js');
const { QUEST } = await import('../src/temples/edena-data.js');
const { GREENHOUSE_WATER } = await import('../src/viridel-ways.js');
const { trialsFor } = await import('../src/trials/data.js');
const { createChallenges } = await import('../src/trials/index.js');
const { GameState } = await import('../src/game-state.js');

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const flat = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

globalThis.location = { search: '?level=edena' };
const W = A.loadWorld('edena');
const { level, physics, scene } = W, E = level.edena, ground = (x, z) => level.ground.heightAt(x, z);
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
function walk(points, from) {
  const P = new A.Player(physics, { health: false, climb: false });
  P.has = () => false;
  P.respawn(from.clone().add(V(0, 0.3, 0)));
  let reached = 0;
  for (const to of points) {
    let i = 0;
    for (; i < 60 * 25 && flat(P.pos, to) > 0.8; i++) {
      const heading = Math.atan2(to.x - P.pos.x, to.z - P.pos.z);
      P.heading = heading;
      physics.syncMovers?.(1 / 60);
      P.update(1 / 60, { KeyW: true }, heading + Math.PI);
    }
    if (flat(P.pos, to) > 0.8 || Math.abs(P.pos.y - to.y) > 1.2) break;
    reached++;
  }
  return { reached, pos: P.pos.clone() };
}
const ours = /^The (water stair|pyramid nursery|round ship|dish pond|split meteor|builders’ machine|Greenhouse water|fallen things)/;
const mine = () => { const out = []; scene.traverse((o) => { if (o.isMesh && ours.test(o.name ?? '')) out.push(o); }); return out; };

test('one way up: from the fallen ship along the Greenhouse water and up the water stair to the Greenhouse’s door', () => {
  const line = level.lines.find((l) => l.name === 'the Greenhouse water');
  assert.ok(line && line.auto !== false, 'a leading line the audit follows by itself');
  const P = line.points;
  const scar = W.quests.where(W.quests.def('edena.garden').stages.at(-1));
  const a = [scar.x, scar.y, scar.z], b = door.toArray();
  const hit = L.lineFor(a, b, [line]);
  assert.ok(hit, `the leg from the scorch to the Greenhouse is walked along it (${Math.round(L.dist(a, P.at(-1)))} m from its end, ${Math.round(L.dist(b, P[0]))} m from its start)`);
  assert.ok(hit.metres < 1.4 * L.dist(a, b), `not a long way round (${hit.metres} m for ${Math.round(L.dist(a, b))})`);
  // it passes the three: a wreck, the nursery and the stair are all beside it
  const near = (p, r) => P.some((q) => Math.hypot(q[0] - p.x, q[2] - p.z) < r);
  assert.ok(near(V(WRECKS.round.x, 0, WRECKS.round.z), 60) && near(V(WRECKS.dish.x, 0, WRECKS.dish.z), 45), 'past the fallen things');
  assert.ok(E.nursery.pyramids.filter((p) => near(p, 60)).length > 10, 'past the nursery');
  assert.ok(near(E.stair.foot, 5) && near(E.stair.top, 5), 'up the stair');
  assert.equal(QUEST.find, 'Follow the water up to the Greenhouse', 'the one-line hint says so');
  for (const [x, z] of trialsFor('edena')[0]?.eyes ?? []) for (const [id, w] of Object.entries(WRECKS)) assert.ok(Math.hypot(x - w.x, z - w.z) > (w.r ?? w.len / 2) + (w.gap ?? 0) + 3, `the eye garden’s post at ${x}, ${z} clear of the ${id}`);
});

test('the Greenhouse stands on its hill, the water stair up its flank: the beds over the ground, the hill’s top flush', () => {
  const site = V(HILL.x, 0, HILL.z);
  assert.ok(ground(site.x, site.z) - ground(STAIR.dir[0] * 160 + HILL.x, STAIR.dir[1] * 160 + HILL.z) > 15, 'the hill stands over the meadow');
  assert.ok(Math.abs(door.y - E.stair.top.y) < 3, `the stair comes out by the door (${(door.y - E.stair.top.y).toFixed(1)} m)`);
  for (const b of E.stair.beds) for (const [u0, u1, s0, s1] of b.rects) for (let i = 0.5; i < 6; i++) for (let j = 0.5; j < 6; j++) {
    const p = fromStair(u0 + ((u1 - u0) * i) / 6, 0, s0 + ((s1 - s0) * j) / 6);
    assert.ok(ground(p.x, p.z) < b.y - 0.2, `the ground under bed ${b.k + 1} (${(ground(p.x, p.z) - b.y).toFixed(2)})`);
    assert.ok(physics.groundAt(p.x, b.y + 3, p.z, 6) > b.y - 0.1, `bed ${b.k + 1} solid where you stand`);
  }
  assert.equal(E.stair.beds.length, STAIR.beds);
  assert.ok(E.stair.levels.rise > 3 && E.stair.levels.rise < 4.5, `a wall a bed (${E.stair.levels.rise.toFixed(1)} m: higher than a jump)`);
});

test('the water stair is walked up and down with its gates open, and a shut gate stops a traveller who cannot climb', () => {
  const S = E.stair, way = S.line.map((p) => V(p[0], p[1] - 0.3, p[2]));
  const from = S.foot.clone().add(V(-STAIR.dir[0] * -6, 0, -STAIR.dir[1] * -6));
  from.y = ground(from.x, from.z);
  for (const G of S.gates) S.setOpen(G.k, true, true);
  physics.syncMovers?.(0);
  try {
    const up = walk(way, from);
    assert.equal(up.reached, way.length, `walked up the whole stair (${up.reached} of ${way.length} points, stopped at ${up.pos.toArray().map((v) => v.toFixed(1))})`);
    const down = walk([...way].reverse(), way.at(-1));
    assert.equal(down.reached, way.length, `and down again (${down.reached} of ${way.length})`);
    // the first gate shut: the way stops at its board
    S.setOpen(0, false, true);
    physics.syncMovers?.(0);
    const G = S.gates[0], stop = walk(way, from);
    assert.ok(stop.reached < way.length && stop.pos.y < G.at.y + 0.5 && flat(stop.pos, G.at) < 4, `stopped at the shut gate (${stop.pos.toArray().map((v) => v.toFixed(1))})`);
  } finally {
    for (const g of S.gates) S.setOpen(g.k, false, true);
    physics.syncMovers?.(0);
  }
});

test('turning a sluice wheel lifts its board, floods the bed below over its stepping stones and opens it in flower', () => {
  const S = E.stair, G = S.gates[1];
  const wheel = A.allInteractables().find((e) => e.id === 'edena.sluice.2');
  assert.ok(wheel && wheel.prompt === 'turn the sluice wheel' && wheel.enabled(), 'a wheel to turn at the top of its flight');
  assert.ok(wheel.distance({ pos: G.stand }) < wheel.range, 'at hand from the top step');
  wheel.use();
  assert.equal(A.game.flag('edena.sluice.2'), true, 'it stays open (its flag)');
  assert.ok(!wheel.enabled(), 'turned once');
  const bed = S.beds[G.bed], B = S.blooms[G.bed];
  assert.equal(B.k, 0, 'its bed shut in bud before');
  for (let i = 0; i < 60 * 20; i++) S.update(1 / 60);
  assert.ok(G.board.position.y > G.at.y + 3.2, 'the board hangs under its lintel');
  const water = S.floods[G.k];
  assert.ok(water.visible && water.userData.water && water.position.y > bed.y + 0.25, 'the bed under water');
  assert.ok(bed.stones.every((p) => p.y < water.position.y - 0.05), 'its stepping stones under');
  assert.ok(B.k > 0.95 && B.fm.count > 30, `in flower (${B.fm.count})`);
  assert.ok(S.pours[G.k].visible, 'its water pouring down the wall');
  S.setOpen(G.k, false, true);
  A.game.set('edena.sluice.2', false);
});

test('the fallen things: a round ship under a hill, its hatch into a lit cabin; a dish pond; a split meteor; a machine to climb', () => {
  assert.deepEqual(E.wrecks.crowded, [], 'nothing of the meadow’s scatter where they lie');
  const R = E.wrecks.pieces.round;
  assert.ok(physics.groundAt(R.hill.x, R.hill.y + 40, R.hill.z, 60) - ground(R.hill.x, R.hill.z) > 8, 'the hill stands 8 m and more over the meadow');
  const into = level.portals.find((p) => p.label === 'the round ship’s hatch' && p.to.y > 1000);
  assert.ok(into && flat(into.at, R.hatch) < 1.5, 'its hatch is a way in');
  assert.ok(level.portals.some((p) => p.label === 'the round ship’s hatch' && p.at.y > 1000 && flat(p.to, R.hatch) < 4), 'and back out');
  const look = A.allInteractables().find((e) => e.id === 'edena.roundship');
  assert.ok(look && look.distance({ pos: R.drawing.clone() }) < look.range, 'something to look at inside');
  assert.ok(THINGS.roundship.talk.nodes.look.say.length <= 2, 'in two lines');
  const D = E.wrecks.pieces.dish;
  assert.ok(D.water > ground(WRECKS.dish.x, WRECKS.dish.z) - 1, 'the dish’s water over the meadow');
  for (const id of ['the round ship’s tree', 'the dish pond', 'the split meteor', 'the builders’ machine']) assert.ok(level.sights.some((s) => s.name === id), `${id}: a place to stop`);
  // the machine climbed: its top 8 m and more over the meadow round it
  const M = E.wrecks.pieces.machine;
  const lo = Math.min(...[0, 1, 2, 3, 4, 5, 6, 7].map((i) => ground(M.top.x + Math.cos(i * 0.785) * 10, M.top.z + Math.sin(i * 0.785) * 10)));
  assert.ok(M.top.y - lo > 8, `its top ${(M.top.y - lo).toFixed(1)} m over the meadow round it`);
  assert.ok(Math.abs(physics.groundAt(M.top.x, M.top.y + 3, M.top.z, 6) - M.top.y) < 0.6, 'solid on top');
});

test('the valley is a crater: its wall round the meadow on every side, seen from the tallest tree’s crown', () => {
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2, r = CRATER.r1 + 20;
    assert.ok(ground(Math.cos(a) * r, Math.sin(a) * r) - ground(Math.cos(a) * 900, Math.sin(a) * 900) > 120, `the wall at ${Math.round((a * 180) / Math.PI)}°`);
  }
  const eye = E.tall.crown.clone().add(V(0, 1.7, 0));
  const rim = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => { const a = (i / 8) * Math.PI * 2, r = (CRATER.r0 + CRATER.r1) / 2; const p = V(Math.cos(a) * r, 0, Math.sin(a) * r); p.y = ground(p.x, p.z) + 5; return p; });
  assert.ok(rim.filter((p) => sees(eye, p, 30)).length >= 6, 'the rim seen nearly all round from the crown');
  assert.ok(THINGS.lookout.talk.nodes.note.say.some((l) => /crater/.test(l)), 'Talo’s note says so');
});

test('the nursery: pyramids by age along the walk, the old one’s stair walked up, and from its top the builders’ mark', () => {
  const by = (age) => E.nursery.pyramids.filter((p) => p.age === age);
  assert.deepEqual(E.nursery.skipped, [], 'nothing left out for something in the way');
  for (const [age, n] of [['seedling', 30], ['sprout', 6], ['shed', 4], ['house', 7], ['great', 3], ['old', 1]]) assert.ok(by(age).length >= n, `${age}: ${by(age).length}`);
  // each age a different climb: the sprout a step, the shed a stair, the house a ledge to jump, the great a climb
  assert.ok(AGES.sprout.rise < 0.6 && AGES.shed.rise < 0.6 && AGES.house.rise > 1 && AGES.house.rise < 2.6 && AGES.great.rise < 2.6, 'steps by age');
  const O = E.nursery.old;
  assert.ok(O.top.y - O.ground > 40, `the old one ${Math.round(O.top.y - O.ground)} m`);
  const stair = [];
  for (let z = O.stairFoot.z; z < O.z - 3; z += 1.5) stair.push(V(O.x, physics.groundAt(O.x, O.top.y + 5, z, 80), z));
  const foot = V(O.x, 0, O.stairFoot.z - 4); foot.y = ground(foot.x, foot.z);
  const up = walk([...stair, O.top.clone()], foot);
  assert.equal(up.reached, stair.length + 1, `walked up its stair to the top (${up.reached} of ${stair.length + 1}, at ${up.pos.toArray().map((v) => v.toFixed(1))})`);
  // from the top: the three great ones and the arc of houses
  const eye = O.top.clone().add(V(0, 1.7, -2));
  for (const g of by('great')) assert.ok(sees(eye, V(g.x, g.top - 1, g.z)), `a dot of the mark seen (${g.x.toFixed(0)}, ${g.z.toFixed(0)})`);
  assert.ok(by('house').filter((h) => sees(eye, V(h.x, h.top - 1, h.z))).length >= 5, 'and the arc');
  const look = A.allInteractables().find((e) => e.id === 'edena.oldpyramid');
  assert.ok(look && look.distance({ pos: O.top.clone() }) < look.range, 'a look out from the top');
  assert.ok(THINGS.oldpyramid.talk.nodes.look.say.some((l) => /three dots over an arc/.test(l)), 'the mark named');
});

test('seen from where they are met: the old pyramid and the great ones from the walk, the round ship’s tree from the water, the spire from the stair’s foot', () => {
  const on = (x, z) => V(x, ground(x, z) + 1.7, z);
  const O = E.nursery.old, mid = E.nursery.pyramids.find((p) => p.age === 'great' && Math.abs(p.x - 48) < 2);
  assert.ok(sees(on(89, 186), V(O.x + 3.7, O.top.y - 2, O.z - 3.7), 1.5), 'the old one’s top step from the walk by the stair’s foot');
  assert.ok(sees(on(91, 112), V(mid.x, mid.top - 2, mid.z)), 'a great one too');
  const R = E.wrecks.pieces.round;
  assert.ok(sees(on(104, -100), R.top.clone().add(V(0, 10, 0))), 'the round ship’s tree from the water');
  const s = level.temple.outside.spire;
  assert.ok(sees(E.stair.foot.clone().add(V(0, 1.7, 0)), s.lantern), 'the Greenhouse’s spire from the foot of the stair');
});

test('the new pieces stand as they are drawn (the contact audit on them), within their collision budget', () => {
  const keep = new Set(mine());
  const exclude = [];
  scene.traverse((o) => { if (o.isMesh && !keep.has(o)) exclude.push(o); });
  const r = auditContact({ physics, scene, exclude, max: 12000 });
  const bad = r.groups.filter((g) => ours.test(g.name ?? ''));
  const n = bad.reduce((s, g) => s + g.n, 0);
  assert.ok(r.checked.walk > 300, `drawn tops checked: ${r.checked.walk}`);
  assert.ok(n <= 6, `${n} contact samples off on them\n${formatContact(r)}`);
  // collision: the triangles they add to the bake, by piece
  const tris = {};
  for (const m of keep) if (!m.userData.noCollide) { const k = m.name.match(ours)[1]; tris[k] = (tris[k] ?? 0) + (m.geometry.index ? m.geometry.index.count : m.geometry.attributes.position.count) / 3; }
  const CAP = { 'water stair': 9000, 'pyramid nursery': 9000, 'round ship': 6000, 'dish pond': 3000, 'split meteor': 1500, 'builders’ machine': 1200, 'Greenhouse water': 9000 };
  for (const [k, cap] of Object.entries(CAP)) assert.ok((tris[k] ?? 0) > 0 && tris[k] <= cap, `${k}: ${tris[k]} triangles (cap ${cap})`);
});

// (last: it builds the makers' runs into this world, as the game does)
test('the Greenhouse water keeps clear of the makers’ runs on the meadow: nothing of the vine walk or the glass climb over it', () => {
  const C = createChallenges({ levelId: 'edena', scene, physics, player: { pos: V(), vel: V(), heading: 0, respawn() {} }, items: { has: () => true, grant() {} }, game: new GameState(), surfaceAt: () => null, npcs: [] });
  assert.ok(C.list.length >= 2, 'its makers’ runs built');
  const curve = new THREE.CatmullRomCurve3(GREENHOUSE_WATER.map(([x, z]) => V(x, 0, z)), false, 'centripetal');
  for (const p of curve.getSpacedPoints(Math.round(curve.getLength() / 2))) {
    const h = ground(p.x, p.z), g = physics.groundAt(p.x, h + 14, p.z, 18);
    assert.ok(g - h < 0.8, `nothing stands over the channel at ${p.x.toFixed(0)}, ${p.z.toFixed(0)} (${(g - h).toFixed(1)} m)`);
  }
  // (and the vine walk is there to be missed: its third deck stands 5 m beside the channel's way through its middle gap)
  assert.ok(physics.groundAt(108, 30, 1, 60) - ground(108, 1) > 2, 'the vine walk’s decks are in the physics');
});
