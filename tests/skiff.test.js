// Issue #514: "The boat shouldn't be able to go through the small crystals in Lorn, also my face is in the middle of the
// sail." Lorn's skiff (src/levels/perdide.js buildSkiff) is a Hoverbike, solid only as a capsule 0.85 m round its middle
// (src/bike.js RADIUS): its bow, stern and the float off its side ran through the ringing groves' thin spikes. Its hull
// (SKIFF_HULL, Hoverbike.hull) is solid now. Its lateen sail stood on the centreline, through the rider sitting behind
// the mast; it is sheeted out over the starboard side (SKIFF_SHEET), clear of him however the boat turns.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Hoverbike } from '../src/bike.js';
import { buildSkiff, SKIFF_HULL, SKIFF_SHEET } from '../src/levels/perdide.js';

/** Open water with one thin crystal spike standing out of it at (x, z), r across: a physics as src/physics.js answers. */
function spikeAt(x, z, R = 0.2) {
  return {
    groundAt: () => -4, rayDistance: () => Infinity, embedded: () => false,
    pushCapsule(p, r, bottom, top, out = new THREE.Vector3()) {
      const dx = p.x - x, dz = p.z - z, d = Math.hypot(dx, dz);
      if (d >= r + R) return null;
      const k = (r + R - d) / (d || 1);
      out.set(dx * k, 0, dz * k);
      p.add(out);
      return out;
    },
  };
}
const skiffOn = (physics) => new Hoverbike(physics, { build: buildSkiff, floor: 0.15, kind: 'skiff' });
/** Full ahead from (x, 0) toward +z for `s` seconds; the furthest the float's front (or the bow) got. */
function drive(boat, x, s = 4) {
  boat.place(x, 0, 0, null);
  for (let i = 0; i < s * 60; i++) boat.update(1 / 60, { KeyW: true });
  return boat.pos;
}

test('#514: the skiff\'s hull is solid end to end: the float and the bow stop at a thin crystal spike', () => {
  assert.equal(skiffOn(spikeAt(0, 0)).hull, SKIFF_HULL, 'the skiff has its hull');
  // the spike on the float's line, 10 m ahead: the middle would pass it by 1.55 m, so before it ran straight through
  const end = drive(skiffOn(spikeAt(1.55, 10)), 0);
  assert.ok(end.z < 10 - 1.2, `the float stops at the spike (the boat's middle at z ${end.z.toFixed(2)})`);
  // on the centre line, its bow stops there too (the middle's capsule alone let the bow 1.3 m into it)
  const bow = drive(skiffOn(spikeAt(0, 10)), 0);
  assert.ok(bow.z + 2.1 < 10, `the bow stops short of it (its prow at z ${(bow.z + 2.1).toFixed(2)})`);
  // and the old capsule alone still lets it through (what the hull adds)
  const bare = new Hoverbike(spikeAt(1.55, 10), { build: () => ({ ...buildSkiff(), hull: null }), floor: 0.15, kind: 'skiff' });
  assert.ok(drive(bare, 0).z > 12, 'without the hull it would sail through');
});

test('#514: the sail is sheeted out clear of the rider\'s head and shoulders, however the boat turns', () => {
  const s = buildSkiff();
  // where the traveller sits (measured in the running game, in the body's frame): his head, his shoulders
  const rider = [new THREE.Vector3(0, 0.94, -0.36), new THREE.Vector3(0.25, 0.7, -0.4), new THREE.Vector3(-0.25, 0.7, -0.4)];
  let sail = null, rig = null;
  s.body.traverse((o) => { if (o.isMesh && o.parent !== s.body && o.material?.side === THREE.DoubleSide) { sail = o; rig = o.parent; } });
  assert.ok(sail && rig, 'the sail on its rig');
  for (const yawRate of [-6, 0, 6]) for (const speed of [0, 30]) for (const time of [0, 0.2, 0.45]) {
    s.animate(1 / 60, { speed, yawRate, time, bank: 0 });
    assert.ok(rig.rotation.y >= SKIFF_SHEET.min - 0.031, `sheeted out at least ${SKIFF_SHEET.min} (${rig.rotation.y.toFixed(2)})`);
    s.root.updateMatrixWorld(true);
    const pos = sail.geometry.attributes.position, m = sail.matrixWorld, tri = new THREE.Triangle(), q = new THREE.Vector3();
    let near = Infinity;
    for (let i = 0; i < pos.count; i += 3) {
      tri.set(...[0, 1, 2].map((k) => new THREE.Vector3().fromBufferAttribute(pos, i + k).applyMatrix4(m)));
      for (const p of rider) near = Math.min(near, tri.closestPointToPoint(p, q).distanceTo(p));
    }
    assert.ok(near > 0.3, `sail and boom ${near.toFixed(2)} m from him (yaw rate ${yawRate}, speed ${speed})`);
  }
});
