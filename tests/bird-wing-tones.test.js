// Vael's bird shimmering in flight (issue #489): her wings' feathers lie in stacks a few millimetres apart, and every
// third one was another tone. Each change of tone is a colour edge the ink pass draws (post.js inkLines, the albedo
// boundary; Unity's Composite.shader the same), so the riding camera, behind her and nearly level with her wings, saw a
// bundle of thin parallel lines one or two pixels apart crawl across each wing with every beat. The tones now go by row
// (the primaries one tone, the secondaries another, the coverts a third), so no two feathers stacked closer than
// WING_TONE_GAP carry different tones, and only the few row boundaries are inked.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { buildBird, WING_TONE_GAP } from '../src/bird.js';

/**
 * In each of the wings' joints, the share of one tone's vertices that have a feather of another tone
 * within `gap` m straight above or below them (the joint's own up: the feathers lie across it).
 */
function stackedTones(gap) {
  const b = buildBird();
  // (the tail's fan keeps its alternate tones: seen from the saddle it lies open, each feather several pixels wide)
  const groups = b.wings.flatMap((w) => [w.shoulder, w.elbow]);
  const ray = new THREE.Raycaster(), up = new THREE.Vector3(0, 1, 0), down = new THREE.Vector3(0, -1, 0), p = new THREE.Vector3();
  let hits = 0, total = 0;
  for (const g of groups) {
    const meshes = g.children.filter((c) => c.isMesh);
    for (const m of meshes) {
      // (each joint's meshes hold their feathers in the joint's own frame: the batching baked each feather's place in)
      const others = meshes.filter((o) => o.material !== m.material).map((o) => new THREE.Mesh(o.geometry, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide })));
      if (!others.length) continue;
      const pos = m.geometry.attributes.position;
      for (let i = 0; i < pos.count; i += 2) {
        p.fromBufferAttribute(pos, i);
        total++;
        let near = false;
        for (const dir of [up, down]) {
          ray.set(p, dir); ray.far = gap; ray.near = 1e-5;
          if (ray.intersectObjects(others, false).length) { near = true; break; }
        }
        if (near) hits++;
      }
    }
  }
  return { share: hits / Math.max(total, 1), hits, total };
}

test('no two of the bird\'s feathers stacked closer than WING_TONE_GAP are of different tones (issue #489)', () => {
  assert.ok(WING_TONE_GAP >= 0.01, 'the gap is at least a centimetre');
  const { share, hits, total } = stackedTones(WING_TONE_GAP);
  // (where two rows' feathers cross, a few vertices next to the crossing line are that close, a line that stays put:
  // 1.4 % of them; the tones feather by feather, before, 4.1 %)
  assert.ok(share < 0.025, `${hits} of ${total} feather vertices have another tone within ${WING_TONE_GAP} m (${(share * 100).toFixed(1)} %)`);
});
