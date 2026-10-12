// The level design audit v1.59's last blind legs and its low pull (issue #233; docs/systems/worlds.md "Two blind legs
// guided, and places off the way"): the Floating City's way down to the anchor (the moorers' stair-lamp; the walk round
// by the bridges, not over the void), Lorn's crystal cave left by its south mouth, and four places off the way each in
// the City Floating in Space and the Garden of Spheres (src/levels/space-city-detours.js, src/levels/spheres-detours.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

await import('./register-gadgets.js');
const { builtWorld } = await import('./built-worlds.js');
const { walkTo } = await import('./playthrough-agent.js');
const L = await import('../scripts/level-design/lib.mjs');
const { CAVE, CAVE_MOUTH, inCave } = await import('../src/levels/perdide.js');
const { KEEPERS_STAKES } = await import('../src/lorn-crossing.js');
const { STAIR_LAMP, UNDER } = await import('../src/levels/space-city-ways.js');
const { CABLES } = await import('../src/temples/spacecity.js');
const { DETOURS: CITY_LOOKS } = await import('../src/story/spacecity-people.js');
const { DETOURS: GARDEN_LOOKS } = await import('../src/story/spheres-data.js');
const { toneOf } = await import('../src/story/tone.js');

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

test('a leg over the void follows the line its stage names however far round the bridges take it; others keep their slack', () => {
  // (a leg 100 m straight, its named line 230 m round: too far round for a walk, not for a leg that cannot be walked straight)
  const line = { name: 'round', points: [[0, 0, 0], [0, 0, 60], [100, 0, 60], [100, 0, 0]] };
  const stops = (overVoid) => [{ label: 'a', pos: [0, 0, -5] }, { label: 'b', pos: [100, 0, -5], via: 'round', ...(overVoid ? { overVoid } : {}) }];
  assert.equal(L.followLines(stops(false), [line])[1].line, undefined, 'over the ground: too far round');
  const [, b] = L.followLines(stops(true), [line]);
  assert.equal(b.line, 'round', 'over the void: walked round');
  assert.ok(!('overVoid' in b), 'the mark is the audit’s own, not the path’s');
});

test('Lorn’s crystal cave is left by its south mouth, where the keepers’ stakes lead out to the Hush-House’s door', () => {
  const W = builtWorld('perdide'), { level, physics } = W;
  const heart = [CAVE.x, CAVE.y, CAVE.z];
  assert.ok(inCave(...heart), 'the cave’s heart is inside it');
  assert.ok(!inCave(...CAVE_MOUTH), 'its mouth stop is just outside');
  const door = level.temples.find((t) => t.id === 'perdide').outside.door.at;
  assert.ok(!inCave(door.x, door.y, door.z), 'the Hush-House’s door is outside it');
  assert.deepEqual(level.mouths.map((m) => m.name), ['the crystal cave’s south mouth']);
  assert.ok(level.mouths[0].inside(heart) && !level.mouths[0].inside([door.x, door.y, door.z]));
  // (the stakes start just inside it: the first within 20 m of the mouth, on the tube's axis)
  const [sx, sz] = KEEPERS_STAKES.way[0];
  assert.ok(Math.hypot(sx - CAVE_MOUTH[0], sz - CAVE_MOUTH[2]) < 20, 'the stakes start by the mouth');
  // (and it is walked: the heart to the mouth down the tube, the mouth to the door round the shell)
  const at = (p) => { const g = physics.groundAt(p[0], p[1] + 3, p[2], 8); return V(p[0], Number.isFinite(g) ? g : p[1], p[2]); };
  for (const [a, b, what] of [[heart, CAVE_MOUTH, 'the heart to the mouth'], [CAVE_MOUTH, [door.x, door.y, door.z], 'the mouth to the door']]) {
    const r = walkTo(W, at(a), at(b), { cell: 2, near: 4 });
    assert.ok(r.ok, `${what}: walked (closest ${r.closest.toFixed(1)} m)`);
  }
});

test('the moorers’ stair-lamp marks the head of the way down off the Towers’ north edge, clear of the great cable', () => {
  const { level, physics } = builtWorld('spacecity');
  const b = level.beacons.find((q) => q.name === 'the moorers’ stair-lamp');
  assert.ok(b, 'a beacon for the audit');
  assert.ok(Math.hypot(b.top[0] - UNDER.stair.x, b.top[2] - UNDER.stair.z) < 0.1 && b.top[1] > UNDER.deck + 25, 'over the stair’s mast, well over the Towers’ roofs');
  // (the mast is solid: something there to stand against, not a light in the air)
  assert.ok(physics.rayDistance(V(STAIR_LAMP.x + 3, UNDER.deck + 15, STAIR_LAMP.z), V(-1, 0, 0), 4) < 3, 'the mast stands');
  // (the great cable from the Mooring-House's roof to the Towers' pipe stack passes it by)
  const roof = level.temples.find((t) => t.id === 'spacecity').outside.top, end = V(...CABLES[0]);
  for (let k = 0; k <= 1; k += 0.02) { const p = roof.clone().lerp(end, k); if (p.y < STAIR_LAMP.y + 2) assert.ok(Math.hypot(p.x - STAIR_LAMP.x, p.z - STAIR_LAMP.z) > 4, `the cable clear of the mast at ${k.toFixed(2)}`); }
  // (the way down named by the cables' stage starts on the Balcony now, where Madame Sel sends you on)
  const down = level.lines.find((l) => l.name === 'down to the anchor');
  assert.ok(Math.hypot(down.points[0][0], down.points[0][2] - -172) < 3, 'from the Balcony');
});

for (const [world, LOOKS, ids] of [['spacecity', CITY_LOOKS, ['telescope', 'sapling', 'coil', 'bench']], ['spheres', GARDEN_LOOKS, ['cairn', 'names', 'arcade', 'lantern']]]) {
  test(`${world}: four places off the way, each stood at on clear ground with one line to look at`, () => {
    const W = builtWorld(world), { level, physics } = W;
    assert.deepEqual(level.detours.map((d) => d.id), ids);
    for (const d of level.detours) {
      const def = LOOKS[d.id];
      assert.ok(def?.prompt && def.talk.nodes.look.say.length === 1, `${d.id}: one line`);
      assert.ok(toneOf(def.talk.nodes.look.say[0]), `${d.id}: its line has a tone`);
      assert.ok(level.sights.some((s) => s.name === d.name), `${d.id}: a sight for the audit`);
      const g = physics.groundAt(d.stand.x, d.stand.y + 2, d.stand.z, 4);
      assert.ok(Number.isFinite(g) && Math.abs(g - d.stand.y) < 0.6, `${d.id}: ground where you stand (${g?.toFixed?.(2)} for ${d.stand.y.toFixed(2)})`);
      assert.equal(physics.pushCapsule(V(d.stand.x, g + 0.05, d.stand.z), 0.35, 0.6, 1.9), null, `${d.id}: room to stand`);
    }
    // (walked to from the landing, on the ground and the islands: the stack's tiers are walked up their stairs elsewhere,
    // tests/spacecity-ways.test.js, their stairs narrower than this walk's grid)
    const spawn = level.spawn;
    for (const d of level.detours.filter((q) => q.stand.y < 20)) {
      const r = walkTo(W, V(spawn.x, physics.groundAt(spawn.x, spawn.y + 2, spawn.z, 4), spawn.z), d.stand, { cell: 2, near: 4 });
      assert.ok(r.ok, `${d.id}: walked to from the landing (closest ${r.closest.toFixed(1)} m)`);
    }
  });
}
