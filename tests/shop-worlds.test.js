// A shop in every route world (batch 4: src/shop-fronts.js, src/shop-world.js placeShop, src/levels/<world>.js;
// docs/systems/interiors.md "A shop in every world"): every world's front is a building you walk into (a door on
// the ground, its way clear, a solid back), and in each world as the play-through builds it (tests/playthrough-
// agent.js loadWorld: the level with its temple, real collision, the story) the shop stands on the ground by the
// way, its door clear of every other thing, the keeper behind the counter, the passage in and out, the scout,
// the camera's tight framing and the rain shelter as at every other door.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

await import('./register-gadgets.js');
const A = await import('./playthrough-agent.js');
const { ORDER } = await import('../src/levels/names.js');
const { SHOPS, shopOf } = await import('../src/shop.js');
const { FRONTS, buildStyledFront } = await import('../src/shop-fronts.js');
const { interiorAt, buildInterior } = await import('../src/interior-kit.js');
const { inTightRoom } = await import('../src/interiors.js');
const { isIndoors } = await import('../src/shelter.js');
const { viaPortal } = await import('../src/scout.js');
const { Physics } = await import('../src/physics.js');

const v = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const fwdOf = (h) => v(Math.sin(h), 0, Math.cos(h));
/** Rays at the door from `out` m in front, at three heights and a little to either side: how far each goes. */
function wayIn(physics, door, heading, out = 2.5) {
  const f = fwdOf(heading), side = v(f.z, 0, -f.x), back = f.clone().negate(), list = [];
  for (const y of [0.5, 1.2, 2.0]) for (const s of [-0.35, 0, 0.35]) list.push(physics.rayDistance(door.clone().addScaledVector(f, out).addScaledVector(side, s).add(v(0, y, 0)), back, 8));
  return list;
}

test('every world\'s front: its door on the ground at the threshold, open into a lit recess, solid either side and behind', () => {
  for (const style of Object.keys(FRONTS)) {
    const scene = new THREE.Scene();
    scene.add(new THREE.Mesh(new THREE.BoxGeometry(200, 1, 200).translate(0, -0.5, 0)));
    const heading = 0.7, at = v(20, 0, -10);
    const it = buildInterior(scene, { id: `test.${style}`, label: style, doorLabel: 'shop door', slot: 40, door: { at, heading }, front: { build: buildStyledFront, style } });
    const physics = new Physics(scene);
    assert.ok(it.front.door.distanceTo(at) < 1e-6, `${style}: the front's door is the threshold`);
    assert.ok(it.front.lights.length >= 1, `${style}: a light by the door`);
    // the way in: every ray reaches past the threshold (into the recess, to the lit sheet's solid back)
    for (const d of wayIn(physics, at, heading)) assert.ok(d > 2.55, `${style}: the doorway is open (${d.toFixed(2)} m)`);
    // and no further than the front's depth: there is a back to it
    for (const d of wayIn(physics, at, heading)) assert.ok(d < 2.5 + 3, `${style}: a solid back behind the door (${d.toFixed(2)} m)`);
    // the walls either side of the door stop you a little way off it
    const f = fwdOf(heading), side = v(f.z, 0, -f.x);
    const beside = [-1, 1].map((s) => physics.rayDistance(at.clone().addScaledVector(f, 2).addScaledVector(side, s * 1.0).add(v(0, 1.2, 0)), f.clone().negate(), 6));
    assert.ok(beside.some((d) => d < 3), `${style}: a wall beside the door (${beside.map((d) => d.toFixed(1)).join(' / ')})`);
    // a step into the doorway is the way in, landing in the room
    const into = it.portals[0];
    assert.ok(at.clone().addScaledVector(f, 0.6).distanceTo(into.at) < into.r, `${style}: a step in front of the door is the way in`);
    assert.ok(interiorAt(into.to) === it, `${style}: into its room`);
  }
});

test('every route world has its shop where the play-through builds it: on the ground, its way clear, in and out, the keeper behind the counter', () => {
  for (const world of ORDER) {
    const W = A.loadWorld(world);
    try {
      const { level, physics } = W;
      const def = shopOf(world);
      assert.ok(level.shops?.length === 1, `${world}: one shop`);
      const shop = level.shops[0];
      assert.ok(shop.def === def, `${world}: ${def.id}`);
      const { at: door, heading } = shop.interior.door, f = fwdOf(heading);
      // on the ground: the threshold where the ground is, and the step in front
      const g = physics.groundAt(door.x + f.x * 1.2, door.y + 1, door.z + f.z * 1.2, 20);
      assert.ok(Math.abs(g - door.y) < 0.35, `${world}: the door on the ground (${door.y.toFixed(2)} against ${g.toFixed(2)})`);
      // its door clear of every other thing: the rays reach into the doorway, and the doorstep and the place the
      // way out lands you are open ground a body stands in
      for (const d of wayIn(physics, door, heading)) assert.ok(d > 2.55, `${world}: nothing between the doorstep and the door (${d.toFixed(2)} m)`);
      for (const k of [1.4, 2.6]) {
        const p = door.clone().addScaledVector(f, k);
        p.y = physics.groundAt(p.x, door.y + 1, p.z, 20);
        assert.ok(Math.abs(p.y - door.y) < 0.6, `${world}: level ground ${k} m out`);
        const push = new THREE.Vector3();
        physics.pushCapsule(p.clone(), 0.35, 0.3, 1.75, push);
        assert.ok(push.length() < 0.02, `${world}: room to stand ${k} m in front of the door (pushed ${push.length().toFixed(3)})`);
      }
      // in through the door: the room far overhead, the camera tight, no rain; the keeper behind the counter
      assert.ok(level.portals.includes(shop.portals[0]) && level.portals.includes(shop.portals[1]), `${world}: its doors among the level's ways through`);
      W.at(door.clone().addScaledVector(f, 0.6).setY(g + 0.05));
      W.step(2);
      assert.ok(W.passed.includes('shop door'), `${world}: walked in`);
      const inside = W.player.pos.clone();
      assert.ok(interiorAt(inside) === shop.interior, `${world}: inside ${def.name}`);
      assert.ok(inside.y - door.y > 200, `${world}: the room off the map (main.js culls the world while you are in it)`);
      assert.ok(inTightRoom(inside) && isIndoors(inside), `${world}: the camera frames it tight, no rain falls`);
      W.step(60);   // (two seconds: past the doorways' cool-down, so the way out below takes)
      assert.ok(interiorAt(W.player.pos) === shop.interior, `${world}: still inside two seconds later (nothing sends you back out)`);
      const keeper = W.rt.shops?.list[0];
      assert.ok(keeper?.npc, `${world}: ${def.keeper} is there`);
      assert.ok(interiorAt(keeper.npc.pos) === shop.interior, `${world}: ${def.keeper} in the shop`);
      assert.ok(keeper.npc.pos.distanceTo(shop.keeper.at) < 1.5, `${world}: ${def.keeper} behind the counter`);
      // the scout routes a find out through the door, and one inside in through it
      const navs = level.navigationPortals ?? level.portals;
      assert.match(viaPortal(inside, { id: 'out', label: 'Out', position: level.spawn.clone() }, navs)?.label ?? '', /^Through the door/, `${world}: the scout's way out`);
      assert.equal(viaPortal(level.spawn.clone(), { id: 'counter', label: 'The counter', position: shop.counter.look.clone() }, navs)?.label, 'Through the shop door', `${world}: the scout's way in`);
      // and out again: in front of the same door, facing out
      W.at(shop.portals[1].at.clone());
      W.step(2);
      assert.ok(interiorAt(W.player.pos) === null, `${world}: back out (${W.passed.join(', ')})`);
      assert.ok(W.player.pos.distanceTo(door) < 3.2, `${world}: in front of the door`);
      // by the way: within reach of the landing or the world's people (docs/audits/level-design-v1.9.md)
      const near = Math.min(door.distanceTo(level.spawn), ...W.npcs.filter((n) => n.def?.id).map((n) => door.distanceTo(n.pos)));
      assert.ok(near < 200, `${world}: by the way (${near.toFixed(0)} m from the landing or a person)`);
      // nothing grows through it
      assert.ok(level.floraAvoid?.(door.x, door.z), `${world}: no plant on its doorstep`);
    } finally { W.dispose(); }
  }
});

test('the shops\' rooms never leave the world: the edge (Player opts.limit) and the Hangar\'s far-off rule spare a room off the map', async () => {
  const { readFileSync } = await import('node:fs');
  const src = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
  assert.match(src('src/player.js'), /!inTightRoom\(this\.pos, 0\.3\)\s*\n?\s*&& keepInside/, 'the world\'s edge holds no one in a room built past it');
  assert.match(src('src/levels/garage.js'), /Math\.hypot\(p\.x, p\.z\) > 900 && !interiorAt\(p\)/);
  assert.equal(Object.keys(SHOPS).length, ORDER.length);
});
