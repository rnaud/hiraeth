import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

// Qanat's main gate had a stone half-arch hanging in the sky over the pilgrims' camps, joined to
// nothing: the gate's inner arch was a clone of the outer one after it had been moved into place
// (desert-city.js T moves a geometry in place), moved again, so it hung 15 m up and 64 m out.
// Everything drawn as the city's own stands inside its round wall or on the gate in it.

globalThis.document ??= { createElement: () => ({ getContext: () => null, style: {} }), body: {}, getElementById: () => null, querySelector: () => null };
const { createDesert } = await import('../src/levels/desert.js');
const { STORY } = await import('../src/desert-sites.js');

const scene = new THREE.Scene();
createDesert(scene);
let city = null;
scene.traverse((o) => { if (!city && o.name === 'Old city of Qanat') city = o; });
const C = STORY.city, toLocal = new THREE.Matrix4().makeRotationY(-C.yaw);

/** The city's drawn vertices in its own frame (+z toward the main gate), with how far each is from the centre. */
function drawn() {
  const out = [], v = new THREE.Vector3();
  for (const m of city.children) {
    if (!m.isMesh || !m.visible) continue;
    const P = m.geometry.attributes.position;
    for (let i = 0; i < P.count; i++) {
      v.fromBufferAttribute(P, i);
      v.x -= C.x; v.z -= C.z;
      v.applyMatrix4(toLocal);
      out.push({ x: v.x, y: v.y, z: v.z, d: Math.hypot(v.x, v.z) });
    }
  }
  return out;
}

test('nothing of Qanat\'s own hangs outside its wall: the gate\'s arches are on the gate', () => {
  assert.ok(city, 'the city kit');
  const pts = drawn();
  assert.ok(pts.length > 1000);
  const R = 64;   // the wall's radius (desert-city.js)
  const out = pts.filter((p) => p.d > R + 9);
  assert.equal(out.length, 0, `drawn past the wall: ${out.slice(0, 4).map((p) => `(${p.x.toFixed(1)}, ${p.y.toFixed(1)}, ${p.z.toFixed(1)})`).join(' ')}`);
  // both faces of the gate carry their arch: stone round the opening, 7.8 m up, on either side of the gate
  const arch = (face) => pts.filter((p) => Math.abs(p.z - (R + face)) < 1.2 && Math.abs(p.x) < 6.4 && p.y > 7.5 && p.y < 14.5).length;
  assert.ok(arch(3.2) > 20 && arch(-3.2) > 20, `the outer and the inner arch (${arch(3.2)}, ${arch(-3.2)})`);
});
