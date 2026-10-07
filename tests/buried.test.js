import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createBuried, BURIED_CONTENT, OCULUS, canyonX, floorAt, WHEEL} from '../src/levels/buried.js';
import {Physics} from '../src/physics.js';
import {Player} from '../src/player.js';
import {auditContact, formatContact} from '../src/contact-audit.js';
import {SPIN} from '../src/story/buried.js';
import {CONTENT, ORDER} from '../src/levels/content.js';
import {LEVELS} from '../src/levels/index.js';

const scene = new THREE.Scene(), level = createBuried(scene), physics = new Physics(scene, level.ground);
level.init(physics);   // (the great wheel's turning collider, the Engine-House's doors)

test('the buried machine builds as a jetpack level and is registered', () => {
  assert.equal(level.id, 'buried');
  assert.equal(level.features.jetpack, true);
  assert.equal(level.features.climb, true);
  assert.ok(ORDER.includes('buried'));
  assert.equal(CONTENT.buried, BURIED_CONTENT);
  assert.ok(LEVELS.some((l) => l.id === 'buried' && l.create === createBuried));
  assert.equal(level.sky.script.day.length, 5);
  assert.equal(typeof level.atmo(0, 0, 0).name, 'string');
  level.update(0.016, 1, {});
});

test('spawn stands on solid sand', () => {
  const {x, y, z} = level.spawn;
  const ground = physics.groundAt(x, y + 5, z);
  assert.ok(Number.isFinite(ground));
  assert.ok(Math.abs(ground - y) < 0.05, `spawn ground ${ground} vs ${y}`);
  // nothing solid in the first steps toward the canyon
  assert.equal(physics.rayHit(new THREE.Vector3(x, y + 1, z), new THREE.Vector3(0, 0, -1), 10), null);
});

test('the canyon floor is open from the ramp to the oculus doorway', () => {
  for (let z = -160; z >= OCULUS.z + OCULUS.r + 4; z -= 6) {
    const xs = [-1, 0, 1].map((k) => canyonX(z) + k * 6);
    for (const x of xs) {
      const g = physics.groundAt(x, -10, z, 40);
      assert.ok(Math.abs(g + 34) < 0.5, `floor at ${x.toFixed(1)},${z}: ${g}`);
    }
  }
  // into the drum through the arched door
  // (a little off-centre: the oculus lamp stands in the middle of the drum)
  const hit = physics.rayHit(new THREE.Vector3(OCULUS.x - 5, -31, OCULUS.z + 60), new THREE.Vector3(0, 0, -1), 80);
  assert.ok(!hit || hit.point.z < OCULUS.z - OCULUS.r + 8, `doorway blocked at ${hit?.point.z}`);
});

test('five relics rest on reachable structures, open to the sky', () => {
  const {spots, names} = BURIED_CONTENT.relics;
  assert.equal(spots.length, 5);
  assert.equal(names.length, 5);
  for (const s of spots) {
    const [x, z] = s;
    const top = physics.groundAt(x, 1e4, z, 2e4);
    assert.ok(Number.isFinite(top), `relic surface at ${x},${z}`);
    assert.ok(top - level.ground.heightAt(x, z) > 1.5, `relic at ${x},${z} sits on a structure, not the sand`);
    assert.ok(top < 120, `relic at ${x},${z} within jetpack reach: ${top}`);
    // standing room: the surface is roughly level and nothing is directly above it
    const n = physics.groundNormal(x, top + 1, z);
    assert.ok(n.y > 0.7, `relic surface at ${x},${z} is walkable (n.y ${n.y.toFixed(2)})`);
    assert.equal(physics.rayHit(new THREE.Vector3(x, top + 0.3, z), new THREE.Vector3(0, 1, 0), 500), null);
  }
});

test('the story is a quest (manual page); the balcony inside the oculus is still reachable and open to the sky', () => {
  const {goal, manual} = BURIED_CONTENT.story;
  assert.equal(manual, true, 'the page closes when the wheel has turned (src/story/buried.js)');
  assert.ok(Math.hypot(goal[0] - WHEEL.x, goal[2] - WHEEL.z) < 1, 'the page frames the great wheel');
  const y = physics.groundAt(OCULUS.x, 1e4, OCULUS.z - 31, 2e4);
  assert.ok(Math.abs(y - OCULUS.balcony) < 0.01, `balcony surface ${y}`);
  // the drum is open to the sky above the lamp in its centre
  assert.equal(physics.rayHit(new THREE.Vector3(OCULUS.x, -28, OCULUS.z), new THREE.Vector3(0, 1, 0), 2000), null);
});

test('the great wheel breaks the dunes east of the canyon: a solid rim you can stand on, clear of the canyon', () => {
  const {wheel} = level.buried;
  assert.ok(wheel.top - wheel.ground > 25, `the arc rises ${(wheel.top - wheel.ground).toFixed(1)} m out of the sand`);
  const top = physics.groundAt(wheel.centre.x, 1e4, wheel.centre.z, 2e4) - wheel.centre.y;
  assert.ok(top > wheel.R - 0.05 && top < wheel.R + wheel.tooth + 0.05, `the rim's top is solid (${top.toFixed(2)} over the axle)`);
  // the canyon floor beside it stays open
  const z = wheel.centre.z, g = physics.groundAt(canyonX(z), 0, z, 60);
  assert.ok(Math.abs(g + 34) < 0.5, `canyon floor beside the wheel ${g}`);
});

test('static collision stays within budget; the hanging city and ring are not collidable', () => {
  // (the trench's pipes, tanks and ribs, the drum's rail, windows and porthole and the Engine-House's
  // gantry, embers and bands collide as they are drawn since the contact audit, docs/systems/movement.md
  // "Contact": 51 k → ~123 k, the BVH 24 → 45 ms to bake, ground rays 15 → 17 ms, capsule pushes unchanged;
  // since its third pass the sand skirts' triangles drawn over the ground (sand-drifts.js misfits), most of
  // them in the canyon: ~124 k → ~171 k, the bake +15 ms, queries unchanged within noise)
  assert.ok(physics.triangles < 185000, `static collision budget: ${physics.triangles}`);
  // overhead city: a ray straight up from the dunes meets nothing
  assert.equal(physics.rayHit(new THREE.Vector3(-70, 20, -170), new THREE.Vector3(0, 1, 0), 2000), null);
});

test('the sand round the great wheel can slide away: the heights, the collision and the normals follow, and it comes back', () => {
  const W = level.buried.wheel, T = level.ground;
  assert.ok(W.sand.length > 20, 'a patch of the dunes round the wheel');
  const at = [W.centre.x + W.face.x * 6, W.centre.z + W.face.z * 6];   // (out past the hub, which collides as drawn)
  const h0 = T.heightAt(...at);
  W.clear(1);
  const h1 = T.heightAt(...at);
  assert.ok(h0 - h1 > 8 && h0 - h1 < 11, `a hollow along its face (${(h0 - h1).toFixed(2)} m)`);
  assert.ok(Math.abs(physics.groundAt(at[0], h0 + 20, at[1], 60) - h1) < 1e-6, 'the collision follows');
  // the patched normals are the ones three.js computes for the whole mesh
  const geo = T.mesh.geometry, mine = geo.attributes.normal.array.slice();
  geo.computeVertexNormals();
  const ref = geo.attributes.normal.array;
  let worst = 0;
  for (const v of W.sand) for (let k = 0; k < 3; k++) worst = Math.max(worst, Math.abs(mine[v.i * 3 + k] - ref[v.i * 3 + k]));
  assert.ok(worst < 1e-5, `normals match (${worst})`);
  // a hollow you can walk out of: no slope in it steeper than about 40 degrees
  let steep = 1;
  for (const v of W.sand) steep = Math.min(steep, ref[v.i * 3 + 1]);
  assert.ok(steep > 0.75, `gentle sides (${steep.toFixed(2)})`);
  W.clear(0);
  assert.ok(Math.abs(T.heightAt(...at) - h0) < 1e-6, 'and it comes back');
});

// The great wheel turns for ever once the story turns it: it collides as drawn and turns with it
// (physics.addMover; docs/systems/movement.md, "Contact").
const spinTo = (a) => { level.buried.wheel.spin.rotation.z = a; physics.syncMovers(1 / 60); };
const nearWheel = (p) => { const W = level.buried.wheel; return Math.hypot(p.x - W.centre.x, p.z - W.centre.z) < W.R + W.tooth + 4 && p.y > W.ground - 2; };

test('the great wheel collides as drawn at every angle it turns to: teeth, spokes and rim, no still disc', () => {
  const W = level.buried.wheel;
  assert.ok(W.collider?.moving, 'a moving collider');
  try {
    for (const a of [0, -0.37, -1.3, -2.71]) {
      spinTo(a);
      const r = auditContact({ physics, scene, region: nearWheel, cell: 0.8, max: 6000, solids: [] });
      const off = (k) => r.groups.filter((g) => g.issue === k && /Extrude|Torus|Cylinder|wheel/i.test(g.name) || (g.issue === k && g.name === 'collision with nothing drawn')).reduce((n, g) => n + g.n, 0);
      assert.ok(r.checked.top > 100 && r.checked.wall > 100, `angle ${a}: ${JSON.stringify(r.checked)}`);
      for (const k of ['feet sink', 'feet hover', 'climbs inside', 'climbs off', 'unseen floor']) assert.ok(off(k) <= 2, `angle ${a}: ${k} ${off(k)}\n${formatContact(r)}`);
      // a ray down through a gap between two teeth falls to the root of the gap; through a tooth it stops on the tooth
      const dir = new THREE.Vector3(W.face.z, 0, -W.face.x);   // along the wheel's plane
      const tops = [];
      for (let k = -30; k <= 30; k++) {
        const x = W.centre.x + dir.x * k * 0.25, z = W.centre.z + dir.z * k * 0.25;
        tops.push(physics.groundAt(x, W.top + 5, z, 60) - W.centre.y);
      }
      assert.ok(Math.max(...tops) > W.R + W.tooth - 0.3 && Math.min(...tops) < W.R + 0.3, `angle ${a}: teeth and gaps over the top (${Math.min(...tops).toFixed(2)}..${Math.max(...tops).toFixed(2)})`);
    }
  } finally { spinTo(0); }
});

test('standing on the turning wheel carries you round with it; a spoke sweeps you aside, not through you', () => {
  const W = level.buried.wheel;
  const P = new Player(physics, { health: false });
  try {
    spinTo(0);
    // on the arc's top, a little toward the side it turns down to: the rim under the feet moves at SPIN · R
    const along = new THREE.Vector3(W.face.z, 0, -W.face.x);
    const start = W.centre.clone().addScaledVector(along, -2);
    start.y = physics.groundAt(start.x, W.top + 5, start.z, 60);
    P.respawn(start.clone().setY(start.y + 0.05));
    for (let f = 0; f < 20; f++) P.update(1 / 60, {}, 0);
    assert.ok(P.onGround && Math.abs(P.pos.y - start.y) < 0.1, `stands on the rim (${(P.pos.y - start.y).toFixed(2)})`);
    // the wheel turns at its working speed for two seconds; the traveller stands still on it
    let a = 0;
    const r0 = Math.hypot(P.pos.x - W.centre.x, P.pos.z - W.centre.z, P.pos.y - W.centre.y);
    const p0 = P.pos.clone();
    for (let f = 0; f < 120; f++) {
      a -= SPIN / 60;
      W.spin.rotation.z = a;
      physics.syncMovers(1 / 60);
      P.update(1 / 60, {}, 0);
    }
    const moved = P.pos.distanceTo(p0), want = SPIN * 2 * r0;
    assert.ok(P.onGround, 'still on the wheel');
    assert.ok(Math.abs(moved - want) < want * 0.35, `carried ${moved.toFixed(2)} m (the rim moved ${want.toFixed(2)} m)`);
    assert.ok(Math.abs(Math.hypot(P.pos.x - W.centre.x, P.pos.z - W.centre.z, P.pos.y - W.centre.y) - r0) < 0.4, 'on the rim, not sunk into it');
    // a spoke (seven, the first along the wheel's local +x) is solid where it is drawn, and gone once it turns on
    // (a capsule 0.2 m off its face, the side the domes are on: within reach of the face, so pushed out)
    const spoke = (k, r, a) => W.spin.localToWorld(new THREE.Vector3(Math.cos((k / 7) * Math.PI * 2 + a) * r, Math.sin((k / 7) * Math.PI * 2 + a) * r, W.T / 2 + 0.2));
    spinTo(0);
    const at = spoke(2, 25, 0);
    assert.ok(at.y > W.ground + 2, 'the third spoke stands out of the sand');
    assert.ok(physics.pushCapsule(at.clone().setY(at.y - 0.9), 0.4, 0.6, 1.8), 'a capsule in the spoke is pushed out');
    spinTo(-0.45);
    assert.equal(physics.pushCapsule(at.clone().setY(at.y - 0.9), 0.4, 0.6, 1.8), null, 'and the same place is open once the spoke has turned past');
    const now = spoke(2, 25, 0);   // (the spoke in the turned wheel's own frame)
    assert.ok(physics.pushCapsule(now.setY(now.y - 0.9), 0.4, 0.6, 1.8), 'where the spoke is now');
  } finally { spinTo(0); }
});

test('the cross-walls’ opening rims collide as drawn, and the way through them is the bare floor, no sand banked across it', () => {
  const { passages, walls } = level.buried, T = level.ground;
  assert.equal(passages.length, walls.length);
  for (const p of passages) {
    assert.ok(p.half > 5, `the way through is ${(2 * p.half).toFixed(1)} m wide`);
    // (the wall's frame: u along it, v through it)
    const at = (u, v) => [p.x + u * p.c + v * p.s, p.z - u * p.s + v * p.c];
    for (let v = -9; v <= 9; v += 0.5) for (let u = -(p.half - 1.5); u <= p.half - 1.5; u += 1) {
      const [x, z] = at(u, v);
      assert.ok(T.drifts.fieldAt(x, z) < 1e-6, `sand ${T.drifts.fieldAt(x, z).toFixed(2)} m deep in the way through at u ${u.toFixed(1)}, v ${v}`);
      // (nothing over the canyon's floor plate, 6 cm over the sand: the rim's foot is beside the way, under the floor across it)
      const g = physics.groundAt(x, floorAt(z) + 3, z, 6) - floorAt(z);
      assert.ok(g > 0 && g < 0.1, `the floor of the way through at u ${u.toFixed(1)}, v ${v}: ${g.toFixed(2)} m over the floor`);
    }
    // the rim stands 0.9 m proud of both faces, solid: a ray at it across the face meets it
    for (const side of [-1, 1]) {
      const [x, z] = at(p.half + 4, side * 3.7);
      const [x1, z1] = at(0, side * 3.7);
      const o = new THREE.Vector3(x1, floorAt(z1) + 1.2, z1), d = new THREE.Vector3(x - x1, 0, z - z1).normalize();
      const hit = physics.rayHit(o, d, 20);
      assert.ok(hit && hit.distance < p.half + 0.5, `the rim's side across the way through (${hit?.distance.toFixed(2)} m, the way ${p.half.toFixed(1)} m)`);
    }
  }
  // the traveller walks straight through each, on the floor all the way, with nothing to step over
  for (const p of passages) {
    const P = new Player(physics, { health: false }), yaw = Math.atan2(p.s, p.c);
    const from = new THREE.Vector3(p.x + 14 * p.s, 0, p.z + 14 * p.c);
    from.y = physics.groundAt(from.x, floorAt(from.z) + 3, from.z, 6);
    P.respawn(from);
    let worst = 0;
    for (let f = 0; f < 60 * 8; f++) {
      P.update(1 / 60, { KeyW: true }, yaw);
      if (P.onGround) worst = Math.max(worst, P.pos.y - floorAt(P.pos.z));
    }
    const v = (P.pos.x - p.x) * p.s + (P.pos.z - p.z) * p.c;
    assert.ok(v < -10, `came out the far side (${v.toFixed(1)} m past the wall)`);
    assert.ok(worst < 0.1, `on the floor all the way (up to ${worst.toFixed(2)} m over it)`);
  }
  // and next to them, against the walls' faces out of the opening, sand is still banked
  let banked = 0;
  for (const p of passages) for (const u of [p.half + 6, p.half + 10]) for (const side of [-1, 1]) {
    const x = p.x + u * p.c + side * 4.2 * p.s, z = p.z - u * p.s + side * 4.2 * p.c;
    if (T.drifts.fieldAt(x, z) > 0.05) banked++;
  }
  assert.ok(banked >= 2, `sand against the walls beside the openings (${banked} of 8)`);
});
