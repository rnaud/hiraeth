// The creatures gallery's still camera (src/enemies/frame.js, enemies.html): it no longer rides along with the
// creature's bob and flight, it settles on everything the pose shows and then holds still.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import { GalleryFrame, GALLERY_FRAME, visibleBox } from '../src/enemies/frame.js';

const box = (x, y, z, r = 0.5) => new T.Box3(new T.Vector3(x - r, y - r, z - r), new T.Vector3(x + r, y + r, z + r));

test('a flyer bobbing and gliding on a loop: the frame settles in the first lap, then stays put', () => {
  const f = new GalleryFrame().reset('idle', box(0, 2, 0));
  const at = (t) => box(Math.sin(2 * t) * 1.5, 2 + 0.4 * Math.sin(t * 6), Math.cos(2 * t) * 0.8);   // (a lap in π s)
  const dt = 1 / 60;
  let t = 0;
  for (; t < Math.PI + 1.5; t += dt) f.grow(at(t), dt);   // a lap, and the ease's tail
  const c = f.centre.clone(), r = f.r;
  let moved = 0;
  for (let i = 0; i < 600; i++, t += dt) { f.grow(at(t), dt); moved = Math.max(moved, f.centre.distanceTo(c), Math.abs(f.r - r)); }
  assert.ok(moved < 0.01, `the camera held still after the first lap (moved ${moved.toFixed(4)} m)`);
  assert.ok(r > 1.5, 'and it frames the whole loop, not the body alone');
});

test('a new pose starts from its own box, snapped; a still pose (dt 0) snaps too', () => {
  const f = new GalleryFrame().reset('idle', box(0, 1, 0));
  f.grow(box(5, 1, 0), 1 / 60);
  assert.ok(f.centre.x < 2.5, 'eased, not jumped');
  f.reset('attack0', box(0, 3, 0));
  assert.deepEqual(f.centre.toArray(), [0, 3, 0]);
  f.grow(box(2, 3, 0), 0);
  assert.equal(f.centre.x, 1);
  assert.equal(f.height, 1);
  assert.ok(GALLERY_FRAME.ease > 0);
});

test('past the lock the camera never moves, however far the pose swings; hidden parts never count', () => {
  const f = new GalleryFrame().reset('idle', box(0, 1, 0));
  for (let t = 0; t < GALLERY_FRAME.lock + 1; t += 1 / 60) f.grow(box(0, 1, 0), 1 / 60);
  const c = f.centre.clone();
  f.grow(box(9, 1, 0), 1 / 60);
  assert.deepEqual(f.centre.toArray(), c.toArray());
  const g = new T.Group(), shown = new T.Mesh(new T.BoxGeometry(1, 1, 1)), hidden = new T.Mesh(new T.BoxGeometry(1, 1, 1));
  hidden.position.z = -12; hidden.visible = false; g.add(shown, hidden);
  assert.equal(visibleBox(g).min.z, -0.5);
});
