// The cave of the giant's heart after the author's playtest (v1.45):
//  #68 the lift valve's chest stays shut until the pool has filled your tank, and the cave lets you out only with the
//      double jump it gives: the keepers' stair's lower flight lies fallen, the entrance passage's way up is a landing
//      over the drop, and the cave's walls are not to be climbed. The skull's mouth won't take you down without the
//      backpack (nothing down there would bring you back up).
//  #81 the chest stands somewhere that matters, clear of clutter: its own dais by the pool at the stair's foot, in a
//      shaft of light.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

await import('./register-gadgets.js');
const A = await import('./playthrough-agent.js');
const { CAVE_LEDGES, HATCH } = await import('../src/desert-city.js');
const { JUMP, STEP, GRAVITY } = await import('../src/player.js');
const { DOUBLE_JUMP } = await import('../src/jump.js');
const { game } = await import('../src/game-state.js');
const { items } = await import('../src/items.js');

const W = A.loadWorld('desert');
const Q = W.level.qanat, cave = Q.cave, V = A.V;
test.after(() => W.dispose());

test('the ledges: over a jump from anything standing on the floor, under a double jump', () => {
  const jump = (JUMP * JUMP) / (2 * GRAVITY) + STEP, dj = jump + (DOUBLE_JUMP.up * DOUBLE_JUMP.up) / (2 * GRAVITY);
  for (const [name, h] of [['the stair’s first block', CAVE_LEDGES.stair], ['the passage’s landing', CAVE_LEDGES.landing]]) {
    assert.ok(h > CAVE_LEDGES.rubble + jump + 0.3, `${name} (${h} m) out of a jump’s reach (${jump.toFixed(2)} m, from the fallen blocks ${CAVE_LEDGES.rubble} m)`);
    assert.ok(h < dj - 1, `${name} in the double jump’s (${dj.toFixed(2)} m)`);
  }
  // as built: the stair's first standing block and the landing stand where the numbers say
  const first = HATCH.stair.foot - (HATCH.stair.fallen + 0.5) * ((HATCH.stair.foot - HATCH.stair.ledge) / 8);
  const p = cave.local(0, 12, first), stairTop = W.physics.groundAt(p.x, p.y, p.z, 20) - cave.origin.y;
  assert.ok(Math.abs(stairTop - CAVE_LEDGES.stair) < 0.05, `the first block’s top ${stairTop.toFixed(2)} m`);
  const l = cave.local(0, 8, 37.6), landing = W.physics.groundAt(l.x, l.y, l.z, 20) - cave.origin.y;
  assert.ok(Math.abs(landing - CAVE_LEDGES.landing) < 0.05, `the landing’s top ${landing.toFixed(2)} m`);
  // the fallen blocks, the dais and the chest on it: none high enough to jump from onto either
  for (let z = HATCH.stair.foot + 3; z > HATCH.stair.foot - 9; z -= 0.5) for (let x = -5; x <= 5; x += 0.5) {
    const q = cave.local(x, 3.5, z), y = W.physics.groundAt(q.x, q.y, q.z, 6) - cave.origin.y;
    if (Math.abs(x) <= 1.6 && z < HATCH.stair.foot - HATCH.stair.fallen * 1.0) continue;   // (the stair itself)
    assert.ok(!(y > CAVE_LEDGES.rubble + 0.05 && y < CAVE_LEDGES.stair - 0.05 && (!cave.chest || Math.hypot(x, z - cave.chest.dais.z + cave.origin.z) > cave.chest.r + 0.3)),
      `something ${y.toFixed(2)} m high at ${x}, ${z} by the stair: a step up to it`);
  }
});

test('the way out: not on foot or with a jump, from the floor to the passage up or the keepers’ stair; with the double jump, both', () => {
  const from = cave.local(0, 0.05, 20);
  // (slope: the steep foot of the dome is no ground: the walk would hop up it where no one stands)
  for (const [name, to] of [['the passage up', cave.exit], ['the keepers’ stair', cave.stairTop]]) {
    assert.ok(!A.walkTo(W, from, to, { cell: 0.5, rise: A.RISE.jump, near: 1.2, slope: 0.6 }).ok, `${name}: not without the double jump`);
    assert.ok(A.walkTo(W, from, to, { cell: 0.5, rise: A.RISE.doublejump, near: 1.2, slope: 0.6 }).ok, `${name}: with it`);
  }
  // you come down onto the landing and drop into the cave from it
  assert.ok(cave.inside.y - cave.origin.y > CAVE_LEDGES.landing - 0.1, 'the way in comes out on the landing');
  assert.ok(A.walkTo(W, cave.inside, from, { cell: 0.5, rise: A.RISE.jump, near: 1.5 }).ok, 'and down into the cave');
});

test('the cave’s walls are not climbed: a no-climb zone round the whole room and its passage, nowhere else', () => {
  const P = W.physics;
  assert.ok(W.level.noClimb?.length && P.noClimbZones === W.level.noClimb);
  for (const [x, y, z] of [[0, 2, 30], [0, 2, -27], [29, 3, 0], [-29, 3, 0], [3.4, 3, 36], [10, 15, 10]]) assert.ok(P.noClimbNear(cave.local(x, y, z)), `${x}, ${y}, ${z} in the cave`);
  assert.ok(!P.noClimbNear(Q.city.center.clone().setY(Q.city.center.y + 2)), 'Qanat’s walls are climbed as ever');
  assert.ok(!P.noClimbNear(Q.giant.skull), 'and the skull outside');
});

test('the skull’s mouth: not without the backpack (its `refuse` said instead); with it, down onto the landing', () => {
  const mouth = W.level.portals.find((p) => p.label === 'giant’s mouth');
  assert.ok(mouth?.when && mouth.refuse);
  const had = items.has('backpack');
  items.revoke?.('backpack');
  if (!items.has('backpack')) assert.equal(mouth.when(), false, 'no way down with empty hands');
  items.grant('backpack');
  assert.equal(mouth.when(), true);
  if (!had) items.revoke?.('backpack');
  assert.ok(mouth.to.distanceTo(cave.inside) < 0.1);
});

test('the lift valve’s chest (#68): shut and silent until the pool has filled the tank', () => {
  const box = W.boxes.list.find((b) => b.id === 'desert.lift');
  // shut until the pool has filled the tank
  game.reset(); items.grant('backpack'); game.set('tool.empty', true);
  assert.equal(box.ready(), false, 'shut with an empty tank');
  game.set('desert.channel.open', true);
  assert.equal(box.ready(), false, 'shut while the pool rises and the tank is dry');
  game.set('desert.pool.tinted', true); game.set('tool.empty', false);
  assert.equal(box.ready(), true, 'it hums back at the full tank');
  game.reset();
});
