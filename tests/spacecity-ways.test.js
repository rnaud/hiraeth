// The City Floating in Space's one way through its three explorations (issue #194; docs/systems/worlds.md, "The City
// Floating in Space: under the islands, the drifting bridges, the stacked quarters"): down the moorers' stair to the
// great cable's anchor under the Towers, out along its walkway to the stack, up the stack, over the broken bridge whose
// span the capstan reels home (src/levels/space-city-ways.js), walked and looked at as the player would.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

await import('./register-gadgets.js');
const { builtWorld, quiet } = await import('./built-worlds.js');
const { Player } = await import('../src/player.js');
const { walkTo } = await import('./playthrough-agent.js');
const { drawnSurfaces } = await import('../src/contact-audit.js');
const WAYS = await import('../src/levels/space-city-ways.js');
const { STACK, TIERS, STAIRS, UNDER, ANCHOR, DRIFT, CAPSTAN, STACK_BRIDGE, OPENINGS, corridors, inCorridor, towersStair } = WAYS;
const { ISLANDS, BRIDGES, SPACECITY_CONTENT } = await import('../src/levels/space-city.js');
const { CABLES } = await import('../src/temples/spacecity.js');
const { FRAGMENTS } = await import('../src/fragments-data.js');
const { HANG_PX } = await import('../src/levels/space-city-kit.js');
const { THIN_ATTR } = await import('../src/thin.js');

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const W = builtWorld('spacecity');
const { level, physics, scene } = W;
const clearAt = (p, y) => physics.pushCapsule(V(p.x, y + 0.05, p.z), 0.35, 0.6, 1.9) === null;
const reeled = (k) => { level.drift.set(k); physics.syncMovers(0); };
const lineOf = (name) => level.lines.find((l) => l.name === name);
/** Every half metre along a line's points: a deck under it at its height, the way clear. → the bad points. */
function alongLine(points, tol = 0.5) {
  const bad = [];
  for (let i = 0; i + 1 < points.length; i++) {
    const a = V(...points[i]), b = V(...points[i + 1]), n = Math.max(1, Math.ceil(a.distanceTo(b) / 0.5));
    for (let k = 0; k <= n; k++) {
      const p = a.clone().lerp(b, k / n), g = physics.groundAt(p.x, p.y + 1.2, p.z, 3);
      if (!Number.isFinite(g) || Math.abs(g - p.y) > tol || !clearAt(p, g)) bad.push(`${p.x.toFixed(1)}, ${p.y.toFixed(1)}, ${p.z.toFixed(1)} (${g?.toFixed?.(2)})`);
    }
  }
  return bad;
}
/** The traveller walking: each frame toward aim(P) (a point, or null to stop). */
function walk(from, aim, { seconds = 60 } = {}) {
  const P = new Player(physics, { health: false, unsafe: level.unsafe });
  const g = physics.groundAt(from.x, from.y + 1, from.z, 3);
  P.pos.set(from.x, Number.isFinite(g) ? g : from.y, from.z);
  P.onGround = true;
  const trail = [];
  for (let i = 0; i < 60 * seconds; i++) {
    const to = aim(P);
    if (!to) break;
    const yaw = Math.atan2(to.x - P.pos.x, to.z - P.pos.z);
    P.heading = yaw;
    quiet(() => P.update(1 / 60, { KeyW: true }, yaw + Math.PI));
    trail.push(P.pos.clone());
  }
  return { P, trail };
}
/** Along points (Vector3s) one after another, each reached within 0.9 m. */
const walkPoints = (pts, seconds = 90) => { let i = 0; return walk(pts[0], (P) => { while (i < pts.length && Math.hypot(P.pos.x - pts[i].x, P.pos.z - pts[i].z) < 0.9) i++; return i < pts.length ? pts[i] : null; }, { seconds }); };

test('the ways are built from their own dice: the city keeps its islands, its bridges but one, its people', () => {
  assert.deepEqual(W.warned.filter((w) => /NaN|error/i.test(w)), [], 'no warnings building it');
  assert.ok(!BRIDGES.some((b) => b.name === 'the Moorings bridge'), 'the Moorings bridge went: the way north is up the stack');
  assert.ok(BRIDGES.includes(STACK_BRIDGE), 'the stack bridge from where it left the Towers');
  assert.equal(Object.keys(ISLANDS).length, 9, 'the nine islands you walk as they were');
  assert.ok(SPACECITY_CONTENT.npcs.some((p) => p.id === 'tilde') && SPACECITY_CONTENT.npcs.some((p) => p.id === 'ewart'), 'a moorer at the anchor, one at the capstan');
  for (const k of ['towers', 'moorings']) assert.ok(OPENINGS[k].length, `${k}: an opening in its parapet`);
  // seven tiers one over another, 88 m from the lowest deck to the highest, the stack's lamp over it
  const ys = Object.values(TIERS).map((t) => t.y);
  assert.ok(Math.max(...ys) - Math.min(...ys) >= 85, `the stack ${Math.max(...ys) - Math.min(...ys)} m high`);
  assert.ok(level.beacons.some((b) => b.name === 'the stack’s lamp' && b.top[1] > 85), 'its lamp a landmark');
  for (const [k, T] of Object.entries(TIERS)) assert.ok(Math.abs(physics.groundAt(STACK.x + 0.3, T.y + 1.5, STACK.z + 0.2, 3) - T.y) < 0.1, `${k}: a deck at ${T.y}`);
});

test('down the moorers’ stair: from the Towers’ deck round its mast to the catwalk under the deck and the anchor, walked', () => {
  assert.deepEqual(alongLine(lineOf('down to the anchor').points.slice(4)), [], 'decks underfoot and the way clear');
  const st = towersStair();
  // the real traveller: from the deck through the parapet's opening, round and down the stair, along the catwalk to the clamp
  const pts = [V(101, 6, -101), V(101, 6, -104.5)];
  for (let k = 0; k <= 24; k++) pts.push(st.at(st.a1 + (st.a0 - st.a1) * (k / 24)));
  pts.push(V(UNDER.platform.x1 - 2.4, UNDER.y, UNDER.platform.z - 0.4), V(ANCHOR.x, ANCHOR.y, ANCHOR.z));
  const r = walkPoints(pts);
  assert.ok(r.P.pos.distanceTo(V(ANCHOR.x, ANCHOR.y, ANCHOR.z)) < 1.2 && r.P.onGround, `at the anchor (${r.P.pos.toArray().map((v) => v.toFixed(1))})`);
  assert.ok(!r.trail.some((p, i) => i && r.trail[i - 1].y - p.y > 1.2), 'never fell off it');
  assert.ok(r.trail.length > 60 * 4, `walked (${(r.trail.length / 60).toFixed(0)} s)`);
  // the cable stage is there now: a hand on it under the deck, by the clamp
  assert.ok(Math.abs(level.cableAnchor.y - ANCHOR.y) < 0.01 && level.cableAnchor.y < ISLANDS.towers.y - 7, 'the main quest’s hand on the cables, under the Towers');
});

test('the stack’s stairs: round its outside from each tier to the next, about 25°, rails both sides, walked', () => {
  for (const S of STAIRS.map(WAYS.stairOf)) {
    const pitch = Math.atan(S.rise / (S.A * S.R));
    assert.ok(pitch < 0.47 && pitch > 0.4, `${S.id}: ${(pitch * 57.3).toFixed(0)}°`);
    // its middle line clear and underfoot from the foot's landing to the top's
    const H = level.ways.stairs[S.id].H, pts = [];
    for (let k = 0; k <= 30; k++) pts.push(H.at(S.a0 + S.dir * S.A * (k / 30)).toArray());
    assert.deepEqual(alongLine(pts, 0.3), [], `${S.id}: underfoot and clear`);
    // capped: off its edges, at the rails, nobody walks into the void
    for (let k = 1; k < 10; k++) {
      const a = S.a0 + S.dir * S.A * (k / 10), p = H.at(a);
      for (const r of [S.R + STACK.hw + 0.05, S.R - STACK.hw - 0.05]) assert.ok(!clearAt(V(STACK.x + Math.cos(a) * r, 0, STACK.z + Math.sin(a) * r), p.y), `${S.id}: a rail at ${r.toFixed(1)} m, ${a.toFixed(2)}`);
    }
  }
  // the real traveller up the way to the capstan quarter: across the underhouses, up, across the lower stack, up again
  const up = lineOf('up the stack').points.map((p) => V(...p));
  const to = up.findIndex((p) => Math.abs(p.x - STACK.x) < 0.1 && Math.abs(p.z - STACK.z) < 0.1 && Math.abs(p.y - TIERS.s2.y) < 0.1);
  const r = walkPoints(up.slice(0, to + 1), 120);
  assert.ok(Math.abs(r.P.pos.y - TIERS.s2.y) < 0.4 && r.P.pos.distanceTo(up[to]) < 1.5, `up on the capstan quarter (${r.P.pos.toArray().map((v) => v.toFixed(1))})`);
  assert.ok(!r.trail.some((p, i) => i && r.trail[i - 1].y - p.y > 1.2), 'never fell off');
  assert.ok(r.trail.length > 60 * 10, `walked (${(r.trail.length / 60).toFixed(0)} s)`);
});

test('the way through: Towers → anchor → walkway → stack → broken bridge → Mooring-House, and home down the other side', () => {
  reeled(1);
  try {
    assert.deepEqual(alongLine(lineOf('up the stack').points), [], 'up: decks underfoot, the way clear');
    assert.deepEqual(alongLine(lineOf('the Lamp Rock bridges').points.slice(0, 20)), [], 'home, down the stack and over the stack bridge');
    const door = level.temples.find((t) => t.id === 'spacecity').outside.door.at;
    const legs = [[V(98, 6, -84), V(ANCHOR.x, ANCHOR.y, ANCHOR.z)], [V(ANCHOR.x, ANCHOR.y, ANCHOR.z), door], [door, V(98, 6, -84)]];
    for (const [a, b] of legs) assert.ok(walkTo({ physics, level }, a, b, { cell: 1 }).ok, `on foot from ${a.toArray().map(Math.round)} to ${b.toArray().map(Math.round)}`);
  } finally { reeled(0); }
  // the span drifted out: the broken bridge is broken
  const A = V(...DRIFT.a), door = level.temples.find((t) => t.id === 'spacecity').outside.door.at;
  assert.ok(!walkTo({ physics, level }, A, door, { cell: 1 }).ok, 'no way on foot over the broken bridge before the capstan');
  assert.ok(!Number.isFinite(physics.groundAt(level.drift.home.x, 20, level.drift.home.z, 10)), 'nothing where its span belongs');
  assert.ok(Math.abs(physics.groundAt(level.drift.away.x, 20, level.drift.away.z, 10) - level.drift.away.y) < 0.1, 'its span hangs out there, solid');
});

test('the capstan reels the span home: A / × at it, the span swings into line, the bridge is whole for good', async () => {
  const A = await import('./playthrough-agent.js');
  A.game.reset();
  const G = A.loadWorld('spacecity');
  try {
    const d = G.level.drift;
    assert.ok(!d.reeled && !d.moving, 'drifted out on arrival');
    const at = A.standNear(G, V(CAPSTAN.x, CAPSTAN.y, CAPSTAN.z).add(V(STACK.x - CAPSTAN.x, 0, STACK.z - CAPSTAN.z).setLength(2.4)), { radius: 1.5, up: 2 });
    assert.ok(at, 'room to stand at the capstan');
    G.at(at); G.step(2);
    const e = A.allInteractables().find((x) => x.id === 'stackCapstan');
    assert.ok(e && e.enabled() && e.distance(G.player) < e.range, 'the capstan, in reach');
    assert.equal(typeof e.prompt === 'function' ? e.prompt() : e.prompt, 'turn the capstan');
    e.use();
    assert.ok(d.moving, 'reeling');
    G.step(30 * 3);
    assert.ok(d.k > 0.2 && d.k < 0.8, `halfway in (${d.k.toFixed(2)})`);
    G.step(30 * 4);
    G.physics.syncMovers(0);
    assert.ok(d.reeled && A.game.flag('spacecity.drift.reeled'), 'home, and kept');
    assert.ok(!e.enabled(), 'nothing more to turn');
    assert.ok(G.toasts.some((t) => /bridge is whole/.test(t)), G.toasts.join(' | '));
    assert.ok(Math.abs(G.physics.groundAt(d.home.x, 20, d.home.z, 10) - DRIFT.mid) < 0.1, 'its deck where it belongs');
    // a save that reeled it: home from the start
    G.dispose();
    const H = A.loadWorld('spacecity');
    try { assert.ok(H.level.drift.reeled, 'reeled on load'); } finally { H.dispose(); }
  } finally { A.game.reset(); }
});

test('seen from where they are meant to be: the stack’s lamp from across the city, the city from its top, the drifted span from the broken end', () => {
  const sees = (from, to, slack = 1.5) => { const d = to.clone().sub(from), L = d.length(); return physics.rayDistance(from, d.normalize(), L) >= L - slack; };
  const lamp = level.ways.top.lamp;
  assert.ok(sees(V(36.5, 1.7, -73), lamp), 'the stack’s lamp from the Market’s end of the Towers bridge');
  assert.ok(sees(V(-7, 46, -180), lamp), 'and from the crow’s nest on the Balcony’s mast: the city’s two high places see each other');
  assert.ok(sees(V(0, 1.7, -150), lamp), 'and from the Balcony');
  // from the top, out over the city to the Market and the Balcony's mast
  // (from its rim, just inside the parapet, looking out)
  const rim = (to) => V(STACK.x, TIERS.s6.y + 1.75, STACK.z).add(to.clone().sub(V(STACK.x, 0, STACK.z)).setY(0).setLength(TIERS.s6.r - 1));
  for (const [to, what] of [[V(95, 12.5, -16), 'the Lamp Rock’s tall lamp over the Towers'], [V(-7, 47, -180), 'the crow’s nest']]) assert.ok(sees(rim(to), to), `${what}, from the stack’s top`);
  // the drifted span from the capstan; the clamp from the catwalk; the stack's foot from the walkway's start
  const brk = level.drift.ends[0].clone().add(V(0, 1.7, 0)).addScaledVector(level.drift.ends[0].clone().sub(V(...DRIFT.a)).setY(0).normalize(), -1.2);
  assert.ok(sees(brk, level.drift.away.clone().add(V(0, 1.6, 0)), 3.5), 'the span, drifted out, from the broken bridge’s end');
  assert.ok(sees(V(UNDER.platform.x0 + 1, UNDER.y + 1.6, UNDER.platform.z), V(STACK.x, TIERS.s0.y + 1.5, STACK.z + TIERS.s0.r - 2), 2), 'the underhouses from the anchor’s catwalk');
  // (the great cable from the Mooring-House's roof to the Towers stays clear of the stack: src/temples/spacecity.js CABLES)
  const roof = level.temples.find((t) => t.id === 'spacecity').outside.top, end = V(...CABLES[0]);
  for (let k = 0.1; k < 0.95; k += 0.05) { const p = roof.clone().lerp(end, k); assert.ok(Math.hypot(p.x - STACK.x, p.z - STACK.z) > 18, `the great cable clear of the stack at ${k.toFixed(2)}`); }
});

test('what hangs under the islands keeps out of the catwalks and stairs (drawn only, so it would be walked through)', () => {
  const room = corridors();
  const drawn = drawnSurfaces(scene);
  const bad = [];
  const probe = (p) => { const hit = drawn.bvh.closestPointToPoint(p, {}, 0, 0.32); if (hit && hit.distance < 0.32) bad.push(`${p.toArray().map((v) => v.toFixed(1))} (${drawn.owner?.(hit.faceIndex) ?? ''})`); };
  // the walkway's middle, the platform's, the stairs' middles at chest and head height
  const Wk = WAYS.walkway();
  for (let t = 0.1; t <= 0.9; t += 0.05) { const p = Wk[0].clone().lerp(Wk[1], t); for (const h of [1.1, 1.7]) probe(p.clone().setY(p.y + h)); }
  for (let x = UNDER.platform.x0 + 1; x < UNDER.platform.x1 - 1; x += 0.5) for (const h of [1.1, 1.7]) probe(V(x, UNDER.y + h, UNDER.platform.z));
  for (const S of STAIRS) { const H = level.ways.stairs[S.id].H, s = WAYS.stairOf(S); for (let k = 1; k < 20; k++) { const p = H.at(s.a0 + s.dir * s.A * (k / 20)); for (const h of [1.1, 1.7]) probe(p.clone().setY(p.y + h)); } }
  assert.deepEqual(bad, [], 'nothing drawn in the way');
  assert.ok(inCorridor(room, ANCHOR.x - 2, UNDER.y, UNDER.y + 2, ANCHOR.z), 'the catwalk is a corridor');
  // (and what the ways hang, the hangers, the vines, keeps the least width on small screens as the islands' pipes: issue #171)
  let thin = 0;
  for (const k of ['the anchor under the Towers', 'the stack (low)', 'the stack (high)']) scene.getObjectByName(k).traverse((o) => { if (o.isMesh && o.material?.uniforms?.uThinPx?.value === HANG_PX && o.geometry.attributes[THIN_ATTR]) thin++; });
  assert.ok(thin >= 6, `hung things drawn at least ${HANG_PX} px wide in the ways' kits (${thin} meshes)`);
});

test('the fragments of the singing light are off the new ways and still stood on', () => {
  for (const [x, y, z] of FRAGMENTS.spacecity) {
    const g = physics.groundAt(x, y + 1.5, z, 3);
    assert.ok(Number.isFinite(g) && Math.abs(g - y) < 0.3, `a fragment at ${x}, ${y}, ${z} on its deck (${g?.toFixed?.(2)})`);
    for (const l of ['down to the anchor', 'up the stack']) assert.ok(lineOf(l).points.every((p) => Math.hypot(p[0] - x, p[2] - z) > 4 || Math.abs(p[1] - y) > 4), `${x}, ${z}: off ${l}`);
  }
});
