// The level design audit v1.85's Lorn and Vael findings (docs/audits/level-design-v1.85.md, issue #476): the walks to
// Lorn's rebuilt Hush-House steer by something again (its crown crystal over the spires' island, the keepers' stakes
// back on its shore), the Lamp-House is in sight from where the saucer is looked into, and Vael's two loners (the
// scarf's makers' box, left in the cloud when its stack moved, and the riders' halfway stone) have neighbours: the box
// on Tiv's stack on the great table's west rim, toward the halfway stone. Checked as the audit's own rays see it
// (scripts/level-design/audit.mjs: the collision, then the terrain under the ray) and with its own measures (lib.mjs).
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

await import('./register-gadgets.js');
const A = await import('./playthrough-agent.js');
const { CAVE_MOUTH } = await import('../src/levels/perdide.js');
const { STEPS_STAKE } = await import('../src/lorn-crossing.js');
const { lineFor, lonelyFor } = await import('../scripts/level-design/lib.mjs');

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const flat = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const EYE = 1.7;
/** The first thing a ray from a to b meets (the collision, then the terrain under it), or null: b is in sight. */
function blocker(W, a, b, { near = 3 } = {}) {
  const d = a.distanceTo(b), dir = b.clone().sub(a).normalize();
  // (as the audit's rays do, what the eye stands inside, within 1.5 m of it, is stepped through: the splinter's crystal)
  const o = a.clone();
  let left = d, hit = W.physics.rayHit(o, dir, left);
  for (let k = 0; k < 6 && hit && d - left + hit.distance < 1.5; k++) { o.addScaledVector(dir, hit.distance + 0.3); left -= hit.distance + 0.3; hit = W.physics.rayHit(o, dir, left); }
  if (hit && hit.distance < left - near) return hit.point;
  const G = W.level.ground, H = G?.heightAt ? (x, z) => G.heightAt(x, z) : null;
  if (H) for (let s = 6; s < d - near; s += 6) { const p = a.clone().addScaledVector(dir, s); if (p.y < H(p.x, p.z) - 0.3) return p; }
  return null;
}
const eyeAt = (p) => V(p.x, p.y + EYE, p.z);
const lineOf = (L, name) => (typeof L.lines === 'function' ? L.lines() : L.lines).find((l) => l.name === name);
const beaconOf = (L, name) => (typeof L.beacons === 'function' ? L.beacons() : L.beacons).find((b) => b.name === name);
const sightOf = (L, name) => (typeof L.sights === 'function' ? L.sights() : L.sights).find((s) => s.name === name);
const aimOf = (b) => V(b.top[0], b.top[1] - 0.2 * b.height, b.top[2]);   // (the audit's aim: a fifth down from its top)
const arr = (p) => [p.x, p.y, p.z];

test('Lorn (issue #476): the rebuilt Hush-House’s crown crystal is in sight from the fallen splinter, over the spires’ island', () => {
  globalThis.location = { search: '?level=perdide' };
  const W = A.loadWorld('perdide');
  try {
    const house = W.level.temples.find((t) => t.id === 'perdide').outside, crown = beaconOf(W.level, 'the Hush-House’s crown crystal');
    assert.ok(crown, 'the audit reads the crown crystal as a landmark');
    assert.ok(crown.top[1] - crown.height > house.top - 3, 'it stands on the house’s top, over the tower');
    assert.ok(Math.hypot(crown.top[0] - house.door.at.x, crown.top[2] - house.door.at.z) < 80, 'within the audit’s 80 m of the door: a landmark by it');
    const splinter = A.objectiveAt(W, 'splinter');
    assert.ok(splinter && flat(splinter, house.door.at) > 300, 'the leg from the splinter is a long one');
    const hit = blocker(W, eyeAt(splinter), aimOf(crown));
    assert.equal(hit, null, `from the splinter the crown is hidden by something at ${hit?.toArray().map((v) => v.toFixed(0))}`);
    // drawn only: the rays go into it, and nobody can stand on it
    assert.equal(W.physics.rayHit(V(crown.top[0], crown.top[1] + 3, crown.top[2]), V(0, -1, 0), 3 + crown.height * 0.5), null, 'nothing solid in the crystal');
  } finally { W.dispose(); }
});

test('Lorn (issue #476): the keepers’ stakes lead from the crystal cave’s south mouth round the house’s shore to its steps, each float in sight of the next', () => {
  globalThis.location = { search: '?level=perdide' };
  const W = A.loadWorld('perdide');
  try {
    const L = W.level, door = L.temples.find((t) => t.id === 'perdide').outside.door.at, S = L.crossing.stakes.stakes;
    const mouth = V(...CAVE_MOUTH), line = lineOf(L, 'the keepers’ stakes');
    // the audit's leading line for the leg (legGuidance: from within 60 m of its start, at most 1.8 times the leg)
    const leg = Math.hypot(door.x - mouth.x, door.z - mouth.z);
    const hit = lineFor(arr(mouth), arr(door), [line], { reach: { a: 60, b: Infinity }, slack: 1.8 });
    assert.ok(hit, 'the stakes carry the leg from the mouth to the door');
    assert.ok(hit.metres < 1.7 * leg, `along them ${hit.metres} m for a ${leg.toFixed(0)} m leg`);
    // from the mouth to the steps: on the island's moss or its shallows, never up on the house's terrace
    const steps = S.findIndex((p) => flat(p, V(STEPS_STAKE.x, 0, STEPS_STAKE.z)) < 1);
    assert.ok(steps > 2, 'the stakes reach the steps');
    for (const p of S.slice(1, steps)) {
      const x = p.x + 1.2, z = p.z, g = W.physics.groundAt(x, 40, z, 80), h = L.ground.heightAt(x, z);   // (beside its pole)
      assert.ok(!Number.isFinite(g) || g < Math.max(h, 0) + 0.6, `stake at (${p.x.toFixed(0)}, ${p.z.toFixed(0)}) stands on the moss or in the water, not on the terrace (${g?.toFixed(1)} over ${h.toFixed(1)})`);
    }
    const float = (p) => V(p.x, p.y + 0.45, p.z);
    for (let i = 1; i <= steps; i++) {
      const from = V(S[i - 1].x + 1.5, Math.max(L.ground.heightAt(S[i - 1].x + 1.5, S[i - 1].z), 0) + 0.5 + EYE, S[i - 1].z);
      assert.equal(blocker(W, from, float(S[i])), null, `float ${i} in sight from stake ${i - 1}`);
    }
  } finally { W.dispose(); }
});

test('Lorn (issue #476): from where the saucer is looked into, off its rim, the Lamp-House’s door is in sight', () => {
  globalThis.location = { search: '?level=perdide' };
  const W = A.loadWorld('perdide');
  try {
    const seen = A.objectiveAt(W, 'saucerSeen'), saucer = A.objectiveAt(W, 'saucer');
    const lamp = W.level.temples.find((t) => t.id === 'perdide2').outside.door.at;
    assert.ok(seen && saucer && flat(seen, saucer) < 11, 'within the saucer’s reach (look into it from 11 m)');
    const eye = V(seen.x, Math.max(W.level.ground.heightAt(seen.x, seen.z), 0) + EYE, seen.z);
    assert.equal(blocker(W, eye, V(lamp.x, lamp.y + 2, lamp.z)), null, 'the Lamp-House’s door from the saucer’s rim');
  } finally { W.dispose(); }
});

test('Vael (issue #476): the scarf’s makers’ box sits on Tiv’s stack on the great table, a neighbour to Tiv and to the riders’ halfway stone', () => {
  globalThis.location = { search: '?level=arzach' };
  const W = A.loadWorld('arzach');
  try {
    const S = W.level.arzach2.tivStack, box = W.boxes.list.find((b) => b.id === 'arzach2.scarf');
    assert.ok(S && box?.pos, 'the stack and its box');
    assert.ok(box.pos.distanceTo(S.top) < 1.5, `on the stack’s top stone (${box.pos.distanceTo(S.top).toFixed(1)} m off)`);
    assert.ok(S.top.y - S.foot.y > 20, 'a teetering climb');
    assert.ok(Math.abs(S.foot.y - W.physics.groundAt(S.foot.x, S.foot.y + 0.5, S.foot.z, 3)) < 1.2, 'its foot on the great table');
    // neither is a loner (the audit: 150 m from anything at a run): the box by Tiv, the halfway stone by the box
    const lonely = lonelyFor(), tiv = A.objectiveAt(W, 'tiv'), halfway = sightOf(W.level, 'the riders’ halfway stone').at;
    assert.ok(box.pos.distanceTo(tiv) < lonely, `the box ${box.pos.distanceTo(tiv).toFixed(0)} m from Tiv`);
    assert.ok(box.pos.distanceTo(halfway) < lonely, `the halfway stone ${box.pos.distanceTo(halfway).toFixed(0)} m from the box`);
    // and the stack in sight from the halfway stone, over the cloud
    assert.equal(blocker(W, V(halfway.x, halfway.y + EYE, halfway.z), S.top.clone().add(V(0, -3, 0))), null, 'the stack from the halfway stone');
  } finally { W.dispose(); }
});
