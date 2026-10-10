// The City-Shaft's ways down and up (src/shaft-ways.js, level design audit v1.15): the lamplighters' drops from Nima's
// corner to the shrine, each landing on its terrace and clear of houses; Perrine's stall beside the middle one; the
// climb's pad and relay lamp and Tobin's view pad near the straight ways they stand on; Wren's marker at its stop.
import test from 'node:test';
import assert from 'node:assert/strict';

await import('./register-gadgets.js');
const A = await import('./playthrough-agent.js');
const { DROPS, dropLandings, CLIMB, rimPosts, RIM_POSTS } = await import('../src/shaft-ways.js');
const { HALFWAY } = await import('../src/story/halfway.js');

const W = A.loadWorld('incal');
const { level, physics } = W;
const S = level.shaft, ways = S.ways, P = S.places;
const flat = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const lineDist = (p, a, b) => { const d = b.clone().sub(a), t = Math.max(0, Math.min(1, p.clone().sub(a).dot(d) / d.lengthSq())); return a.clone().addScaledVector(d, t).distanceTo(p); };

test('a landing on every level, from Nima’s corner down to the shrine, each on its own terrace, on open promenade', () => {
  const L = dropLandings(S.terraces);
  assert.equal(L.length, Object.keys(DROPS).length, 'every level has its landing');
  assert.deepEqual(L.map((l) => l.y), [150, ...S.LEVELS.slice(1)]);
  assert.ok(flat(L[0].at, P.nima) < 30, 'the top one by Nima');
  assert.ok(flat(L.at(-1).at, P.shrine) < 40, 'the last one by the shrine');
  for (const l of L) {
    // the painted ring is on the terrace's floor, not on a roof (no house kept on it)
    const g = physics.groundAt(l.at.x, l.y + 6, l.at.z, 10);
    assert.ok(Number.isFinite(g) && Math.abs(g - l.y) < 0.3, `landing ${l.y}: the floor (${g?.toFixed?.(2)})`);
    // and the way to the edge is open: nothing standing between the ring and the post
    for (const k of [0.25, 0.5, 0.75]) { const p = l.at.clone().lerp(l.edge, k); const h = physics.groundAt(p.x, l.y + 6, p.z, 10); assert.ok(Math.abs(h - l.y) < 0.3, `landing ${l.y}: open to the edge`); }
  }
  // landing to landing: a drop of a level and a hop round the wall the jets can make
  for (let i = 1; i < L.length; i++) assert.ok(flat(L[i].at, L[i - 1].at) < 80, `landing ${L[i].y} within a glide of the last (${flat(L[i].at, L[i - 1].at).toFixed(0)} m)`);
  assert.ok(level.lines().some((l) => l.name === 'the lamplighters’ drops' && l.points.length === L.length + 1), 'the audit follows them');
});

test('Perrine’s stall stands beside the middle landing; the climb’s pad and relay and Tobin’s view pad stand on their ways', () => {
  const mid = dropLandings(S.terraces).find((l) => l.y === -24);
  const perrine = W.npcs.find((n) => n.def?.id === 'perrine');
  assert.ok(perrine && flat(perrine.pos, mid.at) < 12 && Math.abs(perrine.pos.y - mid.y) < 1, 'Perrine behind her counter by the landing');
  assert.ok(Math.abs(HALFWAY.a - DROPS[-24]) < 0.06);
  // the climb: the straight way from the shrine up to the palace gate passes the pad and the relay
  const gate = P.palace.dov;
  assert.ok(lineDist(ways.pad.at, P.ossa, gate) < 2, 'the pad on the way up');
  assert.ok(lineDist(ways.relay.at, P.ossa, gate) < 20, `the relay lamp by the way up (${lineDist(ways.relay.at, P.ossa, gate).toFixed(1)} m)`);
  assert.ok(Math.abs(ways.relay.at.y - CLIMB.relay.y) < 0.01 && Math.hypot(ways.relay.at.x, ways.relay.at.z) < S.SPIRE_RING, 'on the spire’s ring');
  const ring = physics.groundAt(ways.relay.at.x + 2, ways.relay.at.y + 3, ways.relay.at.z, 6);
  assert.ok(Math.abs(ring - CLIMB.relay.y) < 0.3, 'standing on the ring beside it');
  // the walk back from the palace's crown to Nima passes the view pad, and you can stand on both pads
  assert.ok(lineDist(ways.view.at, P.palace.crown, P.nima) < 2, 'the view pad on the way back down');
  for (const [p, name] of [[ways.pad.stand, 'the pad'], [ways.view.stand, 'the view pad']]) {
    const g = physics.groundAt(p.x, p.y + 3, p.z, 6);
    assert.ok(Number.isFinite(g) && Math.abs(g - p.y) < 0.3, `${name} is a floor (${g?.toFixed?.(2)})`);
  }
  // Wren's talk happens at the call-lamp's stop: its marker waits there until the lamp is lit
  assert.ok(W.quests.resolve('wren').distanceTo(P.cab) < 0.5);
});

test('round 3: the rim posts lead from the Well’s door to the red stair; the upper pad keeps the relay lamp company; Basile waits by the shop', () => {
  // the posts stand on the rim's floor, clear of the cab stop, and the audit's line runs on down the stair to Nima
  const posts = rimPosts(S.TOP);
  assert.equal(posts.length, RIM_POSTS.length);
  const door = level.temple.outside.door.at;
  assert.ok(flat(posts[0].at, door) < 25, `the first by the Well’s door (${flat(posts[0].at, door).toFixed(0)} m)`);
  assert.ok(flat(posts.at(-1).at, P.stair.path[0]) < 25, 'the last by the red stair’s gate');
  for (const { at, out } of posts) {
    const g = physics.groundAt(at.x - out.x * 1.2, at.y + 5, at.z - out.z * 1.2, 8);   // (beside it, on the side away from the void)
    assert.ok(Number.isFinite(g) && Math.abs(g - S.TOP) < 0.3, `a post on the rim’s floor (${g?.toFixed?.(2)})`);
    for (const c of level.cabStops) assert.ok(flat(at, c.step) > 5, 'not on a cab stop');
  }
  for (let i = 1; i < posts.length; i++) assert.ok(flat(posts[i].at, posts[i - 1].at) < 45, `post ${i} in sight of the last`);
  const line = level.lines().find((l) => l.name === 'the lamplighters’ rim posts');
  assert.ok(line && flat({ x: line.points.at(-1)[0], z: line.points.at(-1)[2] }, P.nima) < 1, 'the line ends at Nima');
  // the upper pad: a floor, near the relay lamp (no place on the climb stands alone), off the spire
  const u = ways.upper;
  const g = physics.groundAt(u.stand.x, u.stand.y + 3, u.stand.z, 6);
  assert.ok(Number.isFinite(g) && Math.abs(g - u.stand.y) < 0.3, 'the upper pad is a floor');
  assert.ok(u.at.distanceTo(ways.relay.at) < 120, `the relay lamp within reach (${u.at.distanceTo(ways.relay.at).toFixed(0)} m)`);
  assert.ok(Math.hypot(u.at.x, u.at.z) > S.SPIRE_R + 8, 'clear of the spire');
  // Basile at the middle cab stop, beside Fausta's shop door
  const basile = W.npcs.find((n) => n.def?.id === 'basile'), shopDoor = level.shops[0].portals[0].at;
  assert.ok(basile && basile.pos.distanceTo(shopDoor) < 15 && basile.pos.distanceTo(shopDoor) > 6, `Basile by the shop (${basile?.pos.distanceTo(shopDoor).toFixed(1)} m)`);
  const stop = level.cabStops.find((c) => Math.abs(c.step.y - basile.pos.y) < 2);
  assert.ok(stop && flat(stop.step, basile.pos) < 6, 'waiting at the cab stop');
});

test.after(() => W.dispose());
