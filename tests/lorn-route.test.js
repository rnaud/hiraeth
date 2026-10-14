// Lorn's route through its explorations (issue #188; docs/systems/worlds.md, "Lorn: one route through the roots, the
// drowned wood and the keepers' canopy"): the Crystal's veins under the water (src/lorn-veins.js), the drowned wood the
// crossing ends in (src/lorn-flood.js) and the keepers' village up in the trunks (src/lorn-canopy.js), walked, ridden
// and looked at as the player would.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

await import('./register-gadgets.js');
const { builtWorld, quiet } = await import('./built-worlds.js');
const { Player } = await import('../src/player.js');
const { CANOPY, CLEARINGS } = await import('../src/lorn-wood-data.js');
const { LIT_VEIN } = await import('../src/lorn-veins.js');
const { CHANNEL, raceLines } = await import('../src/lorn-flood.js');
const { KEEPERS_STAKES, WATER_WAY_SOUTH } = await import('../src/lorn-crossing.js');
const { PATH_POINTS, DARK_POOLS } = await import('../src/levels/perdide2.js');

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const segDist = (x, z, [ax, az], [bx, bz]) => {
  const ex = bx - ax, ez = bz - az, L = ex * ex + ez * ez, t = Math.max(0, Math.min(1, ((x - ax) * ex + (z - az) * ez) / L));
  return Math.hypot(x - ax - ex * t, z - az - ez * t);
};
const lineDist = (x, z, pts) => { let d = Infinity; for (let i = 1; i < pts.length; i++) d = Math.min(d, segDist(x, z, pts[i - 1], pts[i])); return d; };
const pathDist = (x, z) => Math.min(...PATH_POINTS.map((p) => Math.hypot(p.x - x, p.z - z)));
const W = builtWorld('perdide');
const { level, physics } = W;

/** The traveller walking: each frame toward aim(P) (a point, or null to stop); → the frames' positions. */
function walk(from, aim, { seconds = 60, sprint = false } = {}) {
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
    quiet(() => P.update(1 / 60, { KeyW: true, ...(sprint ? { ShiftLeft: true } : {}) }, yaw + Math.PI));
    trail.push(P.pos.clone());
  }
  return { P, trail };
}

/** Up a stair: from its foot, each frame toward its middle a little further round than where he is. */
function climbStair(H, from) {
  const angleOf = (p) => Math.atan2(p.z - H.cz, p.x - H.cx);
  let a = H.a0;
  return walk(from, (P) => {
    // (how far round he has come: the angle unwrapped from the last, along the stair's way round)
    let d = angleOf(P.pos) - (a % (Math.PI * 2));
    d = ((d + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    a += d;
    if ((a - H.a1) * H.dir >= -0.02 && P.onGround && Math.abs(P.pos.y - H.y1) < 0.4) return null;
    return H.at(a + H.dir * 0.35);
  }, { seconds: 90 });
}

test('Lorn’s canopy: the stair from the lit path’s bank winds up its trunk to the deck, 70 m up, walked (not climbed)', () => {
  const C = level.canopy, [S1] = C.stairs;
  assert.ok(pathDist(C.foot.x, C.foot.z) < 4, `the stair's foot is on the path's bank (${pathDist(C.foot.x, C.foot.z).toFixed(1)} m)`);
  // the boardwalk to the first plank, then round and up
  const start = S1.at(S1.a0 + S1.dir * 0.05);
  const r0 = walk(C.foot, (P) => (P.pos.distanceTo(start) < 1.2 ? null : start), { seconds: 15 });
  assert.ok(r0.P.pos.distanceTo(start) < 1.6, `along the boardwalk to the stair (${r0.P.pos.distanceTo(start).toFixed(2)} m off)`);
  const r = climbStair(S1, r0.P.pos.clone());
  const P = r.P;
  assert.ok(P.onGround && Math.abs(P.pos.y - CANOPY.deck) < 0.4, `up on the deck (ended at ${P.pos.y.toFixed(2)})`);
  assert.ok(!r.trail.some((p, i) => i && r.trail[i - 1].y - p.y > 1.5), 'never fell off it');
  assert.ok(!P.climbing, 'walked, not climbed');
});

test('Lorn’s canopy: every rope bridge is walked across, deck to deck and to the cap square, and none drops you', () => {
  const C = level.canopy;
  assert.equal(C.bridges.length, CANOPY.bridges.length);
  for (const B of C.bridges) {
    const a = B.points[0].clone().lerp(B.points[1], 0.2), b = B.points.at(-1), end = b.clone().add(b.clone().sub(B.points.at(-2)).setY(0).normalize().multiplyScalar(1.5));
    const { P, trail } = walk(a, (Q) => (Math.hypot(Q.pos.x - end.x, Q.pos.z - end.z) < 0.8 ? null : end), { seconds: 30 });
    assert.ok(Math.hypot(P.pos.x - end.x, P.pos.z - end.z) < 1.2, `${B.from} → ${B.to}: across (${Math.hypot(P.pos.x - end.x, P.pos.z - end.z).toFixed(2)} m short)`);
    assert.ok(Math.min(...trail.map((p) => p.y)) > CANOPY.deck - 1.8, `${B.from} → ${B.to}: on the planks all the way (lowest ${Math.min(...trail.map((p) => p.y)).toFixed(2)})`);
  }
});

test('Lorn’s canopy: the second stair goes on up the tallest trunk to the lookout, 120 m up, the Great Crystal in sight from it', () => {
  const C = level.canopy, S2 = C.stairs[1];
  const from = S2.at(S2.a0 - S2.dir * 0.4).setY(CANOPY.deck);
  const { P } = climbStair(S2, from);
  assert.ok(P.onGround && Math.abs(P.pos.y - CANOPY.lookout) < 0.4, `up at the lookout (ended at ${P.pos.y.toFixed(2)})`);
  const g = physics.groundAt(C.lookout.x, C.lookout.y + 1, C.lookout.z, 3);
  assert.ok(Math.abs(g - CANOPY.lookout) < 0.1, `room to stand at the lookout (${g})`);
  // the reveal: the Great Crystal's tip in sight from the lookout's rail, over and between the wood's crowns
  const eye = C.lookout.clone().setY(CANOPY.lookout + 1.6), tip = level.crystal.tip, dir = tip.clone().sub(eye), L = dir.length();
  const hit = physics.rayHit(eye, dir.normalize(), L - 10);
  assert.ok(!hit, `the Great Crystal seen from the lookout (blocked at ${hit?.distance?.toFixed?.(0)} m)`);
});

test('Lorn’s canopy: the winch’s jetty hangs right over the second dark pool, its lamp in sight from the path below', () => {
  const C = level.canopy, w = C.winch, D = DARK_POOLS[1];
  assert.ok(Math.hypot(w.sheave.x - D.x, w.sheave.z - D.z) < 0.5, 'the cord drops onto the pool');
  const g = physics.groundAt(w.at.x, w.at.y + 1, w.at.z, 3);
  assert.ok(Math.abs(g - CANOPY.deck) < 0.1, `room to stand at the drum (${g})`);
  // from the path beside the pool, looking up: the lamp hanging under the jetty
  const eye = V(D.x, 2.2, D.z).add(V(-3, 0, 2)), lamp = w.lamp().clone(), dir = lamp.clone().sub(eye), L = dir.length();
  assert.ok(!physics.rayHit(eye, dir.normalize(), L - 1.5), 'the lamp seen from the pool');
  // let down, it settles into the pool (the story lights the pool then: tests/story-perdide2.test.js)
  let down = 0;
  w.lower(() => down++);
  for (let i = 0; i < 60 * 12 && !down; i++) C.update(1 / 60);
  assert.equal(down, 1, 'it came down');
  assert.ok(w.down && w.lamp().y < Math.max(D.y ?? 0, 0) + 2.5, `in the pool (${w.lamp().y.toFixed(2)})`);
  w.raise();
  for (let i = 0; i < 60 * 14 && w.moving; i++) C.update(1 / 60);
  assert.ok(!w.down && w.lamp().y > CANOPY.deck - 10, 'and wound up again');
});

test('Lorn’s canopy: the wood’s own trunks and giants keep out of the village', () => {
  const T = Object.values(CANOPY.trunks);
  for (const t of level.trunks) for (const k of T) assert.ok(Math.hypot(t.x - k.x, t.z - k.z) > k.r + t.r * 2.3 + 5, `a wood trunk at ${t.x.toFixed(0)}, ${t.z.toFixed(0)} in the keepers' trunk's room`);
  // nothing solid across a bridge's way at hand height and over
  for (const B of level.canopy.bridges) for (const p of B.points) {
    const push = physics.pushCapsule(p.clone().setY(p.y + 0.02), 0.3, 0.4, 1.7, V(), V(0, 1, 0));
    if (push) assert.fail(`something in the way on ${B.from} → ${B.to} at ${p.x.toFixed(1)}, ${p.z.toFixed(1)}`);
  }
});

test('Lorn’s veins: the lit vein runs from the Great Crystal across the crossing beside the keepers’ stakes; the groves where they meet ring', () => {
  const v = level.veins;
  assert.ok(Math.hypot(LIT_VEIN[0][0] - level.crystal.pos.x, LIT_VEIN[0][1] - level.crystal.pos.z) < 5, 'from the Crystal');
  // from where it meets the stakes, it keeps beside them (within 12 m) to Hollin's island
  const leg = KEEPERS_STAKES.way.slice(KEEPERS_STAKES.way.findIndex(([x]) => x === -64)).map(([x, z]) => [x, z]);
  for (const [x, z] of LIT_VEIN.slice(5)) assert.ok(lineDist(x, z, leg) < 12, `the lit vein at ${x}, ${z} keeps by the stakes (${lineDist(x, z, leg).toFixed(1)} m)`);
  // drawn by the water itself, under its surface (nothing to ride into), from the map: along the lit vein over the open
  // water, and nowhere on dry ground
  const water = W.scene.getObjectByName('Lorn’s water');
  assert.ok(water.material.defines.WATER_VEINS && water.material.uniforms.uVeinMap.value === v.map.texture, 'the water draws the veins');
  const P = v.veins[0];
  let over = 0, open = 0;
  for (const p of P) if (W.level.ground.heightAt(p.x, p.z) < -0.6) { open++; if (v.map.at(p.x, p.z) > 0.5) over++; }
  assert.ok(open > 40 && over / open > 0.9, `the lit vein under the open water (${over} of ${open})`);
  for (const [x, z] of [[-100, -400], [0, 0], [200, -400]]) if (W.level.ground.heightAt(x, z) > 0.2) assert.equal(v.map.at(x, z), 0, `no vein on the ground at ${x}, ${z}`);
  assert.ok(v.map.size >= 512 && v.map.texel <= 0.65, `the map's texel ${v.map.texel.toFixed(2)} m`);
  assert.equal(W.scene.getObjectByName('The roots of the crystal').children.filter((o) => o.isMesh && !o.name.startsWith('The ringing groves')).length, 0, 'no ribbons laid on the water');
  // the groves stand off the stakes and the courses, and ring when you come by
  for (const G of v.groves) {
    assert.ok(lineDist(G.at.x, G.at.z, KEEPERS_STAKES.way) > 9, `a grove off the stakes (${lineDist(G.at.x, G.at.z, KEEPERS_STAKES.way).toFixed(1)} m)`);
    for (const r of raceLines()) assert.ok(lineDist(G.at.x, G.at.z, r) > 12, 'a grove off the race courses');
  }
  const m = v.materials.grove.uniforms.uGlow;
  v.update(1, 0, V(500, 0, 500));
  const quietGlow = m.value;
  for (let i = 0; i < 30; i++) v.update(1 / 30, i / 30, v.groves[0].at.clone().add(V(4, 0, 0)));
  assert.ok(m.value > quietGlow + 0.2, `the grove rings as you pass (${quietGlow.toFixed(2)} → ${m.value.toFixed(2)})`);
});

test('Lorn’s drowned wood: trunks out of the open water closer and closer toward the wood, the skiff’s way along the stakes clear under the root gates', () => {
  const f = level.flood;
  assert.ok(f.trunks.length >= 30, `drowned trunks ${f.trunks.length}`);
  const north = f.trunks.filter((t) => t.z > -290).length, south = f.trunks.filter((t) => t.z < -330).length;
  assert.ok(south > north * 2, `closer and closer toward the wood (${north} north of -290, ${south} south of -330)`);
  for (const t of f.trunks) {
    assert.ok(lineDist(t.x, t.z, CHANNEL) > t.r + 6, `a drowned trunk at ${t.x.toFixed(0)}, ${t.z.toFixed(0)} off the stakes' channel`);
    assert.ok(lineDist(t.x, t.z, WATER_WAY_SOUTH) > t.r + 8, 'off the water-way');
    for (const r of raceLines()) assert.ok(lineDist(t.x, t.z, r) > t.r + 8, 'off the race courses');
  }
  // the skiff's way: along the stakes from the open water to Hollin's island, nothing solid at the hull's height (a
  // capsule a skiff wide, from just over the water to a seated rider's head), through the drowned wood (south of -425 the
  // wood's own roots by Hollin's island, as they were)
  let n = 0;
  for (let i = 1; i < CHANNEL.length; i++) {
    const [ax, az] = CHANNEL[i - 1], [bx, bz] = CHANNEL[i], L = Math.hypot(bx - ax, bz - az);
    for (let s = 0; s < L; s += 2) {
      const x = ax + (bx - ax) * (s / L), z = az + (bz - az) * (s / L);
      if (physics.groundAt(x, 3, z, 6) > 0.3) continue;   // (over the cave island's moss and Hollin's: walked, not sailed)
      // (beside the stakes' poles, which the skiff steers past: 2.5 m to the side of their line)
      const d = V(bx - ax, 0, bz - az).normalize(), p = V(x - d.z * 2.5, 0.4, z + d.x * 2.5);
      const push = physics.pushCapsule(p, 1.1, 0.1, 2.4, V(), V(0, 1, 0));
      if (push && z < -200 && z > -425) assert.fail(`the skiff's way blocked at ${p.x.toFixed(1)}, ${p.z.toFixed(1)}`);
      n++;
    }
  }
  assert.ok(n > 100, `skiff samples ${n}`);
  for (const G of f.gates) assert.ok(G.clear > 6, `a root gate high enough to sail under (${G.clear.toFixed(1)} m)`);
});

test('Lorn’s drowned wood: the clearings off the lit path, reached by water, each with its pause', () => {
  const f = level.flood;
  assert.equal(f.clearings.length, CLEARINGS.length);
  for (const C of CLEARINGS) {
    const d = pathDist(C.x, C.z);
    assert.ok(d > 40 && d < 150, `${C.id}: off the path, in reach of it (${d.toFixed(0)} m)`);
    // open water round it: deeper than you wade (the skiff, or a swim)
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2, x = C.x + Math.cos(a) * (C.r - 2), z = C.z + Math.sin(a) * (C.r - 2);
      assert.ok(level.ground.heightAt(x, z) < -1.2, `${C.id}: water round it at ${x.toFixed(0)}, ${z.toFixed(0)}`);
    }
    assert.ok(level.sights.some((s) => Math.hypot(s.at.x - C.x, s.at.z - C.z) < 4), `${C.id}: something to stop for`);
  }
  // the egg isle's mound and the heron's stump stand out of the water, solid: you can land on them
  const eggs = CLEARINGS.find((c) => c.id === 'eggs'), heron = CLEARINGS.find((c) => c.id === 'heron');
  assert.ok(physics.groundAt(eggs.x + 4, 6, eggs.z + 3, 8) > 0.4, 'the egg isle stands out of the water');
  assert.ok(physics.groundAt(heron.x, 12, heron.z, 12) > 5, 'the heron’s stump');
});

test('Lorn’s canopy: at the winch, letting the keepers’ lamp down lights the second dark pool (one of three), as shooting it does', async () => {
  const A = await import('./playthrough-agent.js');
  A.game.reset();
  const G = A.loadWorld('perdide');
  try {
    const w = G.level.canopy.winch;
    G.at(w.at.clone());
    const e = A.allInteractables().find((x) => x.id === 'canopyWinch');
    assert.ok(e && e.enabled(), 'the winch can be turned');
    assert.equal(e.prompt(), 'let down the lamp');
    assert.ok(e.distance(G.player) < e.range, 'in reach from the deck beside the drum');
    assert.ok(!A.game.flag('perdide2.pool.1'), 'the pool dark');
    e.use();
    for (let i = 0; i < 30 * 12 && !A.game.flag('perdide2.pool.1'); i++) G.step(1);
    assert.ok(A.game.flag('perdide2.pool.1'), 'the second pool lit by the lamp');
    assert.equal(A.game.flag('perdide2.pools.lit'), 1, 'one of three');
    assert.ok(A.game.flag('perdide2.pool.1.lamp') && w.down, 'the lamp left down in it');
    assert.ok(G.toasts.some((t) => /keepers’ lamp settles into the pool/.test(t)), G.toasts.join(' | '));
    assert.equal(e.prompt(), 'wind up the lamp');
  } finally { G.dispose(); A.game.reset(); }
});

test('Lorn’s deep water is swum (issue #355): jumped or fallen into, you swim, never put back on the bank; the skiff waits afloat off the landing, a wade from the beach', async () => {
  const { Waters } = await import('../src/water.js');
  const { SKIFF_AT } = await import('../src/levels/perdide.js');
  const waters = new Waters(W.scene, { physics, drops: false });
  const deep = V(29.7, 0, 29.7);   // (off the landing island's north-east shore)
  assert.ok(level.unsafe(deep.clone().setY(0)), 'deep water, unsafe on foot');
  for (const h of [0.6, 4, 12]) {
    const P = new Player(physics, { health: false, unsafe: level.unsafe, water: waters, killY: level.killY });
    P.lastSafe.copy(level.spawn);
    P.pos.copy(deep).setY(h); P.onGround = false;
    let back = false;
    for (let i = 0; i < 4 * 60; i++) { quiet(() => P.update(1 / 60, {}, 0)); if (P.pos.distanceTo(level.spawn) < 3) { back = true; break; } }
    assert.ok(!back && P.swim, `from ${h} m over it: swimming (${P.pos.toArray().map((v) => v.toFixed(1))})`);
  }
  // the skiff: afloat where the level keeps it, not on the grass by the landing
  const P = new Player(physics, { health: false, mount: level.mount, mountAt: level.mountAt });
  const S = P.mount;
  assert.ok(Math.hypot(S.pos.x - SKIFF_AT.x, S.pos.z - SKIFF_AT.z) < 0.01, 'where the level keeps it');
  assert.ok(level.ground.heightAt(S.pos.x, S.pos.z) < -0.6, `in the water (its bed ${level.ground.heightAt(S.pos.x, S.pos.z).toFixed(2)} m)`);
  assert.ok(!level.unsafe(S.pos.clone().setY(0)), 'shallow enough beside the beach to wade out to');
  let shore = Infinity;
  for (let r = 1; r < 15 && shore === Infinity; r += 0.5) for (let a = 0; a < 24; a++) if (level.ground.heightAt(S.pos.x + Math.sin(a / 24 * Math.PI * 2) * r, S.pos.z + Math.cos(a / 24 * Math.PI * 2) * r) > 0.1) { shore = r; break; }
  assert.ok(shore < 8, `the beach ${shore} m off`);
  assert.ok(S.pos.distanceTo(level.spawn) < 60, `in reach of the landing (${S.pos.distanceTo(level.spawn).toFixed(0)} m)`);
});
