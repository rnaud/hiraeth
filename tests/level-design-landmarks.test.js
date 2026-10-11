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
