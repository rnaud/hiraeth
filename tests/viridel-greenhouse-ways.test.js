// Viridel's ways to and from the Builders' Greenhouse (level design audit v1.49, issue #131; docs/systems/worlds.md
// "Viridel: the Greenhouse's spire and the long seed row"): the glass spire on its dome shows over the meadow's crest from
// Mira's water clock, and the way home from its door is the long seed row, south past the white ruins, not the meadow
// you crossed toward it.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

await import('./register-gadgets.js');
const A = await import('./playthrough-agent.js');
const { ROUTE } = await import('./playthrough-worlds.js');
const { PEOPLE } = await import('../src/temples/edena-data.js');
const { SEED_ROW, SEED_DRILL } = await import('../src/viridel-ways.js');

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const flat = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
/** As the level design audit sees: nothing the collision holds between the eye and the point, and no ground over the ray. */
function sees(W, eye, at) {
  const d = eye.distanceTo(at), dir = at.clone().sub(eye).normalize();
  if (W.physics.rayDistance(eye.clone(), dir, d) < d - 3) return false;
  for (let s = 6; s < d - 3; s += 6) { const p = eye.clone().addScaledVector(dir, s); if (W.level.ground.heightAt(p.x, p.z) > p.y + 0.3) return false; }
  return true;
}
/** How far (x, z) is from the straight walk a → b. */
const offWalk = (p, a, b) => { const dx = b.x - a.x, dz = b.z - a.z, t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / (dx * dx + dz * dz))); return Math.hypot(p.x - a.x - dx * t, p.z - a.z - dz * t); };

globalThis.location = { search: '?level=edena' };
const W = A.loadWorld('edena');
const door = W.level.temple.outside.door.at, mira = W.npcs.find((n) => n.def?.id === 'mira');
test.after(() => W.dispose());

test('the Greenhouse’s glass spire is seen over the meadow’s crest from Mira’s, where its door is not', () => {
  const s = W.level.temple.outside.spire;
  assert.ok(s && s.top.y - door.y > 40, `a spire ${Math.round(s.top.y - door.y)} m over the door`);
  const beacon = W.level.beacons().find((b) => /glass spire/.test(b.name));
  assert.ok(beacon && flat(V(...beacon.top), door) < 80, 'a beacon the audit aims at, by the door');
  assert.ok(mira, 'Mira by her water clock');
  const eye = mira.pos.clone().add(V(0, 1.7, 0));
  assert.ok(!sees(W, eye, door.clone().add(V(0, 2, 0))), 'the door itself is behind the crest');
  assert.ok(sees(W, eye, s.lantern), 'the lantern shows over it');
  assert.ok(sees(W, eye, V(s.top.x, s.top.y - s.height * 0.2, s.top.z)), 'and the spire as the audit aims at it');
});

test('the way home from the Greenhouse is the long seed row, past the seed-drill and the white ruins, not the meadow walked in', () => {
  const step = ROUTE.find((r) => r.id === 'edena').play.find((p) => p.temple);
  assert.equal(step.home, 'the long seed row', 'the route goes home along it');
  assert.ok(PEOPLE.sorrel.talk.nodes.after.say.some((l) => /long seed row/.test(l)), 'Sorrel names it once the Gardener sleeps');
  const line = W.level.lines.find((l) => l.name === 'the long seed row');
  assert.ok(line && line.auto === false, 'a way home the audit reads where it is named');
  const P = line.points.map((p) => V(...p));
  assert.ok(flat(P[0], door) < 40, `from below the Greenhouse’s steps (${flat(P[0], door).toFixed(0)} m)`);
  assert.ok(flat(P.at(-1), W.level.spawn) < 80, `to beside the landing (${flat(P.at(-1), W.level.spawn).toFixed(0)} m)`);
  // not the way in: the row's middle runs far from the straight walk from Mira to the door
  const inA = mira.pos, inB = door;
  const mid = P.slice(1, -1).map((p) => offWalk(p, inA, inB));
  assert.ok(Math.max(...mid) > 55 && mid.filter((d) => d > 40).length >= 4, `away from the way in (${mid.map((d) => d.toFixed(0)).join(', ')} m)`);
  // and what it passes is new: the seed-drill and Oro's ruins, both far from the way in
  const oro = W.npcs.find((n) => n.def?.id === 'oro');
  const drill = V(SEED_DRILL[0], 0, SEED_DRILL[1]);
  for (const [name, p] of [['the seed-drill', drill], ['Oro, by the ruins', oro.pos]]) {
    assert.ok(Math.min(...P.map((q) => flat(q, p))) < 35, `${name} beside the row`);
    assert.ok(offWalk(p, inA, inB) > 40, `${name} not on the way in`);
  }
  assert.ok(W.level.sights.some((s) => /seed-drill/.test(s.name)), 'the drill is a place to stop');
  assert.equal(SEED_ROW.length, P.length);
});

test('the seed row’s beds stand clear on the meadow, drawn only, and come up when the Gardener sleeps', () => {
  const { beds } = W.level.edena.seedRow;
  assert.ok(beds.length > 20, `${beds.length} beds`);
  for (const b of beds) {
    assert.ok(Math.abs(b.at.y - 0.4 - W.level.ground.heightAt(b.at.x, b.at.z)) < 0.01, 'on the grass');
    // (nothing the collision holds under a bed: the android garden's pedestals stand between them)
    for (const u of [-2.5, 0, 2.5]) { const x = b.at.x + Math.sin(b.yaw) * u, z = b.at.z + Math.cos(b.yaw) * u; assert.ok(W.physics.groundAt(x, 200, z, 400) - W.level.ground.heightAt(x, z) < 0.3, `bed clear at ${x.toFixed(0)}, ${z.toFixed(0)}`); }
  }
  for (const name of ['The long seed row', 'The long seed row’s earth', 'The long seed row’s marker sticks']) assert.ok(W.scene.getObjectByName(name)?.userData.noCollide, `${name}: drawn only`);
  assert.ok(!W.scene.getObjectByName('The builders’ seed-drill').userData.noCollide, 'the drill collides');
  assert.equal(W.level.temple.change.count.beds, beds.length, 'every bed comes up in the world change');
});
