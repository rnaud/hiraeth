// The landmarks of the v1.49 level design audit's follow-ups (docs/audits/level-design-v1.49.md, issues #134-#136):
// each is in sight from the spots it is there for, as the audit's own rays see it (scripts/level-design/audit.mjs:
// the collision and the terrain under the ray), and a leading line's markers each in sight of the next.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

await import('./register-gadgets.js');
const A = await import('./playthrough-agent.js');
const { GREAT } = await import('../src/levels/perdide.js');
const { KEEPERS_LIGHT, keepersStakeSpots } = await import('../src/lorn-crossing.js');

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
const eyeAt = (p) => V(p.x, p.y + EYE, p.z);
const lineOf = (L, name) => (typeof L.lines === 'function' ? L.lines() : L.lines).find((l) => l.name === name);
const beaconOf = (L, name) => (typeof L.beacons === 'function' ? L.beacons() : L.beacons).find((b) => b.name === name);
const aimOf = (b) => V(b.top[0], b.top[1] - 0.2 * b.height, b.top[2]);   // (the audit's aim: a fifth down from its top)

test('Lorn (issue #135): the Great Crystal shows over the landing’s grove from Wendel, and the keepers’ stakes lead from the crystal cave to Hollin', () => {
  globalThis.location = { search: '?level=perdide' };
  const W = A.loadWorld('perdide');
  try {
    // the crystal: its tip aimed at from Wendel, what stops the ray is the crystal itself (its outer spires), or nothing
    const wendel = A.objectiveAt(W, 'wendel'), gc = beaconOf(W.level, 'the Great Crystal');
    assert.ok(gc && gc.height > 60, 'the Great Crystal stands as a landmark over 60 m tall');
    const hit = blocker(W, eyeAt(wendel), aimOf(gc));
    assert.ok(!hit || flat(hit, V(GREAT.x, 0, GREAT.z)) < 24, `from Wendel the crystal is hidden by something at ${hit?.toArray().map((v) => v.toFixed(0))}`);

    // the stakes: from the cave's heart to the shallows off Hollin's island, past the keepers' light
    const S = W.level.crossing.stakes.stakes, heart = A.objectiveAt(W, 'heart'), hollin = A.objectiveAt(W, 'hollin');
    assert.equal(S.length, keepersStakeSpots().length);
    assert.ok(flat(S[0], heart) < 60, `the first stake ${flat(S[0], heart).toFixed(0)} m from the cave’s heart (the audit's reach: 60 m)`);
    assert.ok(flat(S.at(-1), hollin) < 40, `the last stake ${flat(S.at(-1), hollin).toFixed(0)} m from Hollin`);
    assert.ok(Math.min(...S.map((p) => flat(p, V(KEEPERS_LIGHT.x, 0, KEEPERS_LIGHT.z)))) < 30, 'they pass the keepers’ light');
    for (let i = 1; i < S.length; i++) assert.ok(flat(S[i], S[i - 1]) < 45, `stakes ${i - 1} and ${i} ${flat(S[i], S[i - 1]).toFixed(0)} m apart`);
    // each float in sight of the next, from the skiff's eye beside it; the first from the cave's heart
    const float = (p) => V(p.x, p.y + 0.45, p.z);
    assert.equal(blocker(W, eyeAt(heart), float(S[0])), null, 'the first float is in sight from the cave’s heart');
    for (let i = 1; i < S.length; i++) {
      const from = V(S[i - 1].x + 1.5, Math.max(W.level.ground.heightAt(S[i - 1].x + 1.5, S[i - 1].z), 0) + 0.5 + EYE, S[i - 1].z);
      assert.equal(blocker(W, from, float(S[i])), null, `float ${i} in sight from stake ${i - 1}`);
    }
    assert.ok(lineOf(W.level, 'the keepers’ stakes'), 'the audit reads them as a leading line');
  } finally { W.dispose(); }
});

test('the Buried Machine (issue #136): the canyon stack’s steam shows from round Wen’s dome and up from the canyon floor, Fisk’s flag over the door from Wen, the ramp’s rope down to the stack', () => {
  globalThis.location = { search: '?level=buried' };
  const W = A.loadWorld('buried');
  try {
    const B = W.level.buried, ground = (x, z) => W.physics.groundAt(x, 60, z, 200);
    const steam = beaconOf(W.level, 'the canyon stack’s steam'), flag = beaconOf(W.level, 'Fisk’s flag');
    const canyon = A.objectiveAt(W, 'canyon'), wen = A.objectiveAt(W, 'wen');
    assert.ok(flat(V(...steam.top), canyon) < 80, 'the steam rises within 80 m of the canyon’s goal (the audit’s “landmark by it”)');
    assert.ok(B.stack.top.y > 65, `the stack’s top ${B.stack.top.y.toFixed(0)} m, over the dunes`);
    // Wen walks a round of her dome (src/story/buried.js loop: five points 7.2 m out): from the three on its south,
    // east and west sides the steam shows (from the first, on its north side, the dome itself hides the south)
    const dome = B.heroDome;
    for (const i of [1, 2, 3]) {
      const a = 0.4 + (i / 5) * Math.PI * 2, x = dome.x + Math.sin(a) * 7.2, z = dome.z + Math.cos(a) * 7.2;
      assert.equal(blocker(W, V(x, ground(x, z) + EYE, z), aimOf(steam)), null, `the steam from Wen’s round, point ${i}`);
    }
    // down on the canyon's floor, south of the stack, before the first cross-wall: looking back up the canyon
    for (const z of [-200, -230, -250]) {
      const x = B.canyonX(z), from = V(x, B.floorAt(z) + EYE, z);
      assert.equal(blocker(W, from, aimOf(steam)), null, `the steam from the canyon floor at z ${z}`);
    }
    // Fisk's flag over the Engine-House's door, from where Wen is first met (the door itself is behind a hut)
    assert.equal(blocker(W, eyeAt(wen), aimOf(flag)), null, 'Fisk’s flag from Wen');
    const door = A.objectiveAt(W, 'temple.buried.door');
    if (door) assert.ok(flat(V(...flag.top), door) < 20, 'the flag stands by the door');
    // the ramp's rope: from beside the domes down the sand ramp to the stack's foot, each stake in sight of the next
    const T = B.rope.tops;
    assert.ok(flat(T[0], wen) < 60, `the rope starts ${flat(T[0], wen).toFixed(0)} m from Wen (the audit’s reach: 60 m)`);
    assert.ok(flat(T.at(-1), canyon) < 30, `and ends ${flat(T.at(-1), canyon).toFixed(0)} m from the canyon’s goal`);
    for (let i = 1; i < T.length; i++) assert.equal(blocker(W, V(T[i - 1].x, T[i - 1].y + 0.6, T[i - 1].z), V(T[i].x, T[i].y + 0.2, T[i].z), { near: 0.5 }), null, `stake ${i} in sight of stake ${i - 1}`);
    assert.ok(lineOf(W.level, 'the ramp’s rope'), 'the audit reads it as a leading line');
  } finally { W.dispose(); }
});

test('the Garden of Spheres (issue #134): the hill path runs from the meadow path to the white hill’s stair, the belvedere shows from it, the sphere at the foot is answered by the bell, and the bell by the garden', async () => {
  globalThis.location = { search: '?level=spheres' };
  const W = A.loadWorld('spheres');
  try {
    const L = W.level, path = lineOf(L, 'the hill path').points, top = L.sights.find((s) => /belvedere/.test(s.name)).at;
    const foot = L.sights.find((s) => /white hill’s foot/.test(s.name)).at, meadow = lineOf(L, 'the meadow path').points;
    const [mx, mz] = path[0], [ex, ez] = path.at(-1);
    assert.ok(meadow.some(([x, z]) => Math.hypot(x - mx, z - mz) < 3), 'the hill path starts on the meadow path');
    assert.ok(Math.hypot(ex - top.x, ez - top.z) < 90 && top.distanceTo(foot) < 150, `it ends at the hill’s foot, the sphere ${top.distanceTo(foot).toFixed(0)} m from the deck (a loner is 150 m from anything)`);
    // the belvedere's deck, its mast and streamer over it, in sight from where the hill path leaves the meadow path and
    // from the sphere at the foot
    const H = (x, z) => W.physics.groundAt(x, 60, z, 200);
    for (const [x, z, what] of [[mx, mz, 'the hill path’s start'], [-150, -96, 'halfway along it'], [foot.x, foot.z, 'the sphere at the foot']]) {
      assert.equal(blocker(W, V(x, H(x, z) + EYE, z), V(top.x, top.y + 9, top.z)), null, `the belvedere’s mast top from ${what}`);
    }
    // splash the sphere at the foot: the bell answers from the deck; ring the bell: the garden's spheres answer it
    const { allTargets } = await import('../src/targets.js');
    const { game } = await import('../src/game-state.js');
    const hill = L.spheres.hill, notes = [];
    W.sound.orbNote = (deg, at) => { notes.push(at.clone()); };
    const hit = (o) => allTargets().find((t) => t.orb === o).onHit('shoot', null);
    assert.ok(hill.foot && hill.bell, 'the sphere and the bell are spheres the story listens to');
    hit(hill.foot);
    await new Promise((r) => setTimeout(r, 900));
    assert.ok(notes.some((p) => flat(p, V(hill.bell.x, 0, hill.bell.z)) < 1 && p.y > top.y), 'the bell answers from the belvedere');
    notes.length = 0;
    hit(hill.bell);
    await new Promise((r) => setTimeout(r, 4600));
    assert.ok(notes.length >= 10, `${notes.length} spheres answer the bell`);
    assert.ok(game.flag('spheres.belvedere.rung'), 'and the garden remembers it was rung');
  } finally { W.dispose(); }
});

test('the Glass Dunes (issue #134): the kiln’s smoke over the breaker’s cairn shows from the landing and the Clock-House, and its amber posts lead up to it', () => {
  globalThis.location = { search: '?level=glassdunes' };
  const W = A.loadWorld('glassdunes');
  try {
    const L = W.level, smoke = beaconOf(L, 'the breaker’s smoke'), cairn = L.sights.find((s) => /breaker’s cairn/.test(s.name)).at;
    const door = A.objectiveAt(W, 'temple.garage.door');
    assert.ok(flat(V(...smoke.top), cairn) < 80, 'the smoke rises by the cairn');
    // from the landing (the ship's flat) and from the Clock-House's door: the smoke's rise, over the far cliffs
    assert.equal(blocker(W, eyeAt(L.spawn), aimOf(smoke)), null, 'the smoke from the landing');
    assert.equal(blocker(W, V(door.x - 6, door.y + EYE, door.z + 8), aimOf(smoke)), null, 'the smoke from beside the Clock-House’s door');
    // the posts: from beside the door to the cairn, each float in sight of the next
    const P = L.cairnWay.posts;
    assert.ok(flat(P[0], door) < 30, `the first post ${flat(P[0], door).toFixed(0)} m from the Clock-House’s door`);
    assert.ok(flat(P.at(-1), cairn) < 15 && P.at(-1).y > cairn.y - 6, 'the last by the cairn, up on the crest');
    for (let i = 1; i < P.length; i++) {
      assert.ok(flat(P[i], P[i - 1]) < 32, `posts ${i - 1} and ${i} ${flat(P[i], P[i - 1]).toFixed(0)} m apart`);
      const b = blocker(W, V(P[i - 1].x + 1, P[i - 1].y - 1.6, P[i - 1].z), P[i], { near: 0.6 });   // (from beside post i - 1, at eye height)
      assert.equal(b, null, `post ${i}’s float in sight from post ${i - 1} (${P[i - 1].toArray().map((v) => v.toFixed(1))} to ${P[i].toArray().map((v) => v.toFixed(1))}: ${b?.toArray().map((v) => v.toFixed(1))})`);
    }
    // the carriers' things on the way: each pulls from the path, 30-150 m off it (the audit's pull band)
    for (const s of L.cairnWay.sights) {
      const d = flat(s.at, door);
      assert.ok(d > 30 && d < 150, `${s.name} ${d.toFixed(0)} m from the Clock-House’s door`);
    }
  } finally { W.dispose(); }
});

test('the Signal Market (issue #278): the silent tower’s mast stands over the street’s roofs, its lamp in sight from the landing and from Madame Sel there', async () => {
  globalThis.location = { search: '?level=bazaar' };
  const { MAST } = await import('../src/levels/bazaar.js');
  const W = A.loadWorld('bazaar');
  try {
    const L = W.level, mast = beaconOf(L, 'the silent tower’s mast');
    assert.ok(mast && flat(V(...mast.top), V(MAST.x, 0, MAST.z)) < 1, 'the audit reads the mast as a beacon');
    // over the roofs: the lamp higher than every street tower's roof and the box on it
    const roofs = Math.max(...L.streetTowers.map((t) => t.h + 14));
    assert.ok(MAST.lamp > roofs + 20, `the lamp at ${MAST.lamp} m, the street's roofs up to ${roofs.toFixed(0)} m`);
    // from the landing (the ship's ramp) and from Sel where she meets the ship, down the avenue
    assert.equal(blocker(W, eyeAt(L.spawn), aimOf(mast)), null, 'the mast’s lamp from the landing');
    assert.equal(blocker(W, eyeAt(A.objectiveAt(W, 'sel')), aimOf(mast)), null, 'from Madame Sel by the landing');
    // walked through (nothing to climb 200 m up): no collision along it
    assert.equal(W.physics.rayDistance(V(MAST.x + 0.2, 100, MAST.z + 0.2), V(0, 1, 0), 190), Infinity, 'the mast is drawn, not collided with');
  } finally { W.dispose(); }
});
