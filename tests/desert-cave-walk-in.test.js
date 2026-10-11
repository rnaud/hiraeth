// Issue #6: just inside the skull cave, past the landing, an invisible wall stopped you. The rough dome kept a wedge of
// its foot across the doorway (triangles from the vertex column on the passage's axis out to 4.85 m, their centres 3.2 m
// out, past the door's 3.0 m cut: ea27b25e), facing the cave, so unseen from the passage and solid all the same.
// These walk the real Player (its controller and the level's physics, not a ray): from the landing into the cave on
// every heading a player would try, walking and running, and round the whole cave floor, failing where it stops with
// nothing drawn ahead.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

await import('./register-gadgets.js');
const A = await import('./playthrough-agent.js');
const { items } = await import('../src/items.js');

const W = A.loadWorld('desert');
const cave = W.level.qanat.cave, P = W.player, V = A.V, o = cave.origin;
test.after(() => W.dispose());
items.grant('backpack');   // (the way down the skull's mouth wants it: the normal state on arriving here)
W.scene.updateMatrixWorld(true);

const DT = 1 / 60;
// camYaw for a world heading (camYaw 0 walks +z, a quarter turn +x)
const dirOf = (yaw) => V(Math.sin(yaw), 0, Math.cos(yaw));
const loc = (p) => p.clone().sub(o).toArray().map((v) => v.toFixed(2)).join(', ');
function place(p, yaw) {
  P.teleport(p.clone(), V(0, 1, 0), V(0, 0, -1));
  for (let i = 0; i < 15; i++) P.update(DT, {}, yaw);
}

// what the player sees: the drawn meshes round the cave (the collision itself is never drawn)
const L0 = new THREE.Layers(), shown = (m) => { for (let q = m; q; q = q.parent) if (!q.visible) return false; return true; };
const seen = [];
W.scene.traverse((m) => {
  if (!m.isMesh || !shown(m) || !m.layers.test(L0)) return;
  m.geometry.computeBoundingSphere();
  const s = m.geometry.boundingSphere.clone().applyMatrix4(m.matrixWorld);
  if (s.center.distanceTo(o) < s.radius + 45) seen.push(m);
});
const ray = new THREE.Raycaster();
// (from the capsule's middle and its two sides, at the feet, the knees, the chest and the head: what it rubs against)
const drawnAhead = (p, d, far = 1.6) => [-0.45, 0, 0.45].some((sd) => [0.1, 0.3, 0.6, 0.9, 1.5].some((h) => {
  ray.set(p.clone().add(V(-d.z * sd, h, d.x * sd)), d); ray.far = far;
  return ray.intersectObjects(seen, false).length > 0;
}));

test('from the landing into the cave: walking or running, straight in or angled, nothing stops you in the doorway', () => {
  const stuck = [];
  for (const run of [false, true]) for (let deg = -60; deg <= 60; deg += 15) {
    const yaw = Math.PI + (deg * Math.PI) / 180;
    place(cave.inside, yaw);
    let i = 0;
    for (; i < 60 * 8 && P.pos.z - o.z > 24; i++) P.update(DT, { KeyW: true, ShiftLeft: run }, yaw);
    if (P.pos.z - o.z > 24) stuck.push(`${run ? 'running' : 'walking'} ${deg}°: stopped at ${loc(P.pos)}`);
  }
  assert.deepEqual(stuck, [], 'into the cave from the landing (cave-local x, y, z)');
});

test('round the cave floor and its passage: nowhere stopped with nothing drawn ahead', () => {
  const bad = [];
  const starts = [];
  for (let x = -26; x <= 26; x += 4) for (let z = -26; z <= 26; z += 4) if (Math.hypot(x, z) <= 28) starts.push([x, z]);
  for (const x of [-1.5, 0, 1.5]) for (const z of [26, 29, 31, 33]) starts.push([x, z]);   // (the doorway and the passage's floor)
  for (const [x, z] of starts) {
    const top = cave.local(x, 3, z), g = W.physics.groundAt(top.x, top.y, top.z, 6);   // (the floor, the pool's bed, a rock: not the ribs' tops)
    if (!Number.isFinite(g)) continue;
    for (let k = 0; k < 8; k++) {
      const yaw = (k * Math.PI) / 4, d = dirOf(yaw);
      place(V(top.x, g + 0.05, top.z), yaw);
      const last = P.pos.clone();
      for (let i = 0; i < 90; i++) {
        P.update(DT, { KeyW: true }, yaw);
        if (i % 15 !== 14) continue;
        if (Math.hypot(P.pos.x - last.x, P.pos.z - last.z) < 0.15 && P.onGround && !P.swim) {
          if (!drawnAhead(P.pos, d)) bad.push(`from ${x}, ${z} heading ${k * 45}°: stopped at ${loc(P.pos)}`);
          break;
        }
        last.copy(P.pos);
      }
    }
  }
  assert.deepEqual(bad, [], 'stopped by something not drawn (cave-local x, y, z)');
});
