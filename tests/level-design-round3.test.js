// The level design audit's third round (docs/audits/level-design-v1.16.md): the desert's keepers' stair out of the
// giant's chest to a hatch in Qanat's back lane (one way), and Vael's first minutes (Oïa by the landing points up the
// standing stones to the riders' mast, past which the Aerie shows).
import test from 'node:test';
import assert from 'node:assert/strict';

await import('./register-gadgets.js');
const A = await import('./playthrough-agent.js');
const { HATCH } = await import('../src/desert-city.js');
const { MAST } = await import('../src/vael-ways.js');
const { ROUTE } = await import('./playthrough-worlds.js');
const { PEOPLE: VAEL, THINGS: VAEL_THINGS } = await import('../src/story/arzach-data.js');
const { game } = await import('../src/game-state.js');

test('the desert: the keepers’ stair climbs from the cave’s floor to its doorway, and comes up at the hatch in the back lane', () => {
  const W = A.loadWorld('desert');
  try {
    const Q = W.level.qanat, cave = Q.cave;
    // a walk from the pool's edge up the stair to its doorway, on what is built
    const from = cave.local(0, 0.05, -16);
    const walk = A.walkTo(W, from, cave.stairTop, { cell: 0.5, rise: 0.6, near: 1.2 });
    assert.ok(walk.ok, `up the stair to the doorway (closest ${walk.closest?.toFixed?.(1)} m)`);
    // the hatch: on the city's floor in the back lane, halfway from the terraces to the back gate, under 80 m from the well
    const out = Q.hatch.out, g = W.physics.groundAt(out.x, out.y + 3, out.z, 6);
    assert.ok(Number.isFinite(g) && Math.abs(g - out.y) < 0.4, `you come up standing on the lane (${g?.toFixed?.(2)} vs ${out.y.toFixed(2)})`);
    assert.ok(HATCH.z < -31 && HATCH.z > -60, 'between the terraces and the back gate');
    const well = Q.city.wellLook;
    assert.ok(Math.hypot(out.x - well.x, out.z - well.z) < 80, 'a short walk to the well, past nothing you walked before');
    // one way: no doorway down at the hatch, so the skull's mouth stays the way in
    assert.ok(!W.level.portals.some((p) => p.at.distanceTo(out) < 6));
    // from the hatch the well is a walk over the city's floor
    const toWell = A.walkTo(W, out, well, { cell: 1, near: 4 });
    assert.ok(toWell.ok, `from the hatch to the well (closest ${toWell.closest?.toFixed?.(1)} m)`);
  } finally { W.dispose(); }
});

test('the desert: out by the skull’s mouth instead, watching the well rise passes the way up over', () => {
  game.reset();
  const W = A.loadWorld('desert');
  try {
    const { quests } = W;
    game.set('quest.desert.power', 'up');
    game.set('desert.well.watched', true);
    for (let i = 0; i < 3; i++) quests.update(null);
    assert.notEqual(quests.stage('desert.power'), 'up');
    assert.notEqual(quests.stage('desert.power'), 'rise');
  } finally { W.dispose(); game.reset(); }
});

test('Vael: the route starts with Oïa by the landing; she points up the standing stones to the riders’ mast, which shows over the slope', () => {
  const R = ROUTE.find((r) => r.id === 'arzach');
  assert.equal(R.play[0].act, 'meetOia');
  const said = JSON.stringify(VAEL.oia.talk.nodes.go) + JSON.stringify(VAEL.oia.talk.nodes.again);
  assert.match(said, /white streamer/, 'she points at it');
  assert.ok(VAEL_THINGS.mast, 'it can be looked at');
  const W = A.loadWorld('arzach');
  try {
    const m = W.level.arzach.mast, ground = W.level.ground;
    assert.ok(Math.abs(m.at.y - ground.heightAt(MAST.x, MAST.z)) < 0.5, 'standing on the sand');
    const oia = W.npcs.find((n) => n.def?.id === 'oia');
    assert.ok(oia && oia.pos.distanceTo(W.level.spawn) < 30, 'Oïa beside the landing');
    // the mast's top over the slope from the landing: no sand between the eye and it
    const eye = W.level.spawn.clone().add(A.V(0, 1.7, 0));
    let clear = true;
    for (let k = 1; k < 40; k++) { const p = eye.clone().lerp(m.top, k / 40); if (ground.heightAt(p.x, p.z) > p.y) clear = false; }
    assert.ok(clear, 'seen from the landing');
    // and from its foot the Aerie's door is in sight over the crest
    const door = W.level.temple.outside.door.at, foot = m.at.clone().add(A.V(0, 1.7, 0));
    let seen = true;
    for (let k = 1; k < 40; k++) { const p = foot.clone().lerp(door.clone().add(A.V(0, 4, 0)), k / 40); if (ground.heightAt(p.x, p.z) > p.y) seen = false; }
    assert.ok(seen, 'the white house shows from the mast');
  } finally { W.dispose(); }
});
