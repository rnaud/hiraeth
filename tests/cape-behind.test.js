import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

// "Nour's cape blows in front of her instead of behind" (issues #59, #64): walking up to you and stopping short, her
// cloak swung on forward over the forearms she holds her staff with, and the arms' rule (the cloth goes out over an
// arm, never between it and the body: cape.js OVER) kept its back panel out in front of them for good. The back
// panel now only goes round an arm; and the ambient wind never blows a cape out in front of whoever wears it.
const { Cape, behindWind, resetDrapes } = await import('../src/cape.js');

const V = (x, y, z) => new THREE.Vector3(x, y, z);

test('the ambient wind on a cape: what blows toward the way the wearer faces is turned to blow behind', () => {
  const up = V(0, 1, 0), fwd = V(0, 0, 1);
  assert.deepEqual(behindWind(V(0, 0, 2), fwd, up).toArray(), [0, 0, -2]);   // (at their back: out behind instead of over the front)
  assert.deepEqual(behindWind(V(1.5, 0, 0), fwd, up).toArray(), [1.5, 0, 0]);   // (from the side: as it is)
  assert.deepEqual(behindWind(V(0, 0, -1), fwd, up).toArray(), [0, 0, -1]);   // (in the face: it streams behind already)
  const w = behindWind(V(1, 0, 1), V(0, 0.3, 1), up);
  assert.ok(Math.abs(w.x - 1) < 1e-9 && Math.abs(w.z + 1) < 1e-9 && Math.abs(w.y) < 1e-9, `the wearer's lean is no matter (${w.toArray()})`);
});

test('an arm under the cloak lifts the cloth of the sides and the front over it, never the back panel’s', () => {
  resetDrapes();
  const scene = new THREE.Scene(), anchor = new THREE.Object3D();
  anchor.position.y = 0.75; scene.add(anchor); scene.updateMatrixWorld(true);
  const cape = new Cape(scene, anchor, { cols: 10, rows: 8, length: 1.3, bottom: 0.45 });
  // the back panel: the columns within 45° of straight behind
  const back = [...cape.backCol].map((b, c) => (b ? c : -1)).filter((c) => c >= 0);
  assert.ok(back.length >= 2 && back.length < cape.cols / 2, `${back.length} of ${cape.cols} columns`);
  for (const c of back) assert.ok(cape.local[c * 3 + 2] < 0);
  // a forearm held out in front at the waist; a point of cloth between it and the body, just above it
  const arm = { a: V(0.1, 1.15, 0.2), b: V(0.1, 1.15, 0.45), r: 0.05, over: true };
  const s = { up: V(0, 1, 0), floor: V(), capsules: [arm] };
  const at = (c) => {
    cape.reset();
    const i = (4 * cape.cols + c) * 3;
    cape.p[i] = 0.1; cape.p[i + 1] = 1.2; cape.p[i + 2] = 0.12;   // (in the wedge the arm shades toward the body, outside the arm itself)
    cape.capsulesAt(s.capsules, null, 1);
    cape.collide(s);
    return cape.p[i + 2];
  };
  const front = cape.backCol.indexOf(0);
  assert.ok(at(front) > 0.2, 'the front panel’s cloth goes out over the arm');
  const zb = at(back[0]);
  assert.ok(Math.abs(zb - 0.12) < 1e-6, `the back panel’s stays where it is: it only goes round the arm (${zb})`);
  cape.dispose(scene);
});
