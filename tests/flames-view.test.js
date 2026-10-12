import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Flames, COOL_FIRE } from '../src/story/flames.js';
import { setView, clearView } from '../src/motion-kit/view.js';

// A fire's tongues are moved only while it is in the camera's last view (src/story/flames.js Flames.update, issue
// #111): out of it they are left as they are, and the frame it is seen again they are where they would have been had
// they moved every frame, the palette's turn included (the time kept while unseen).
const tongues = () => [{ at: new THREE.Vector3(0, 0, 0), h: 1.2, r: 0.3 }, { at: new THREE.Vector3(0.2, 0, 0.1), h: 0.8, r: 0.2, core: 1 }];
function fire() {
  const scene = new THREE.Scene(), parent = new THREE.Group();
  parent.position.set(40, 0, 0); scene.add(parent);
  const f = new Flames(parent, tongues(), { seed: 3 });
  scene.updateMatrixWorld(true);
  return f;
}
const arrays = (f) => ['position', 'normal', 'color'].map((k) => Array.from(f.geo.attributes[k].array));

test('a fire out of view keeps still, and comes into view as if it had burned all along', () => {
  const ref = fire(), lazy = fire();
  ref.setPalette(COOL_FIRE); lazy.setPalette(COOL_FIRE);
  const cam = new THREE.PerspectiveCamera(50, 1.5, 0.1, 500);
  const look = (x) => { cam.position.set(0, 1, 0); cam.lookAt(x, 1, 0); cam.updateMatrixWorld(); setView(cam); };
  try {
    let t = 0, skipped = 0, compared = 0;
    for (let f = 0; f < 240; f++) {
      const dt = 1 / 60; t += dt;
      look(f % 120 < 60 ? 1 : -1);   // (half the time towards the fire at x 40, half away)
      clearView(); ref.update(dt, t);   // (no view: always moved, as before)
      look(f % 120 < 60 ? 1 : -1);
      const before = lazy.geo.attributes.position.version;
      lazy.update(dt, t);
      if (lazy.geo.attributes.position.version === before) { skipped++; continue; }
      assert.deepEqual(arrays(lazy), arrays(ref), `frame ${f}: the same tongues, the same colours`);
      compared++;
    }
    assert.ok(skipped >= 100 && compared >= 100, `${skipped} frames still, ${compared} compared`);
    assert.ok(Math.abs(lazy.mix - ref.mix) < 1e-9, 'the palette turned as far');
  } finally { clearView(); }
});

test('with no view set (node, tests, a page without the game\'s loop) every fire moves every frame', () => {
  const f = fire();
  const v = f.geo.attributes.position.version;
  f.update(1 / 60, 1); f.update(1 / 60, 2);
  assert.equal(f.geo.attributes.position.version, v + 2);
});
