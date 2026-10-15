import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { MARK_CANDIDATES, candidateGeometry, reviewMark, activeMark } from '../src/makers-mark/candidates.js';
import { glyphGeometry } from '../src/story/sign-text.js';
import { reviewStorage } from '../src/cinematics-page/storage.js';

test('option 4 is the live glyph; alternatives require an explicit review URL', () => {
  assert.equal(reviewMark('?mark=listening'), null);
  assert.equal(reviewMark('?markReview=1&mark=unknown'), null);
  assert.equal(reviewMark('?markReview=1&mark=current'), null);
  assert.equal(reviewMark('?markReview=1&mark=listening'), 'listening');
  assert.equal(activeMark(''), 'corner');
  assert.equal(activeMark('?mark=listening'), 'corner');
  assert.equal(activeMark('?markReview=1&mark=current'), null);
  assert.equal(activeMark('?markReview=1&mark=listening'), 'listening');
  const g = glyphGeometry(2); assert.equal(g.userData.makersMark, 'corner'); g.dispose();
});
test('all five selected silhouettes remain centred, finite and within their allotted square', () => {
  assert.equal(MARK_CANDIDATES.length, 5);
  for (const mark of MARK_CANDIDATES) for (const size of [.3, 3.5, 9]) {
    const g = candidateGeometry(mark.id, size, .08);
    assert.ok([...g.attributes.position.array, ...g.attributes.normal.array].every(Number.isFinite));
    g.computeBoundingBox(); const b = g.boundingBox, s = b.getSize(new THREE.Vector3()), c = b.getCenter(new THREE.Vector3());
    assert.ok(Math.abs(Math.max(s.x,s.y)-size)<1e-5, mark.id);
    assert.ok(c.length()<1e-5, `${mark.id} is centred`);
    assert.ok(Math.abs(s.z-.08)<1e-6);
    assert.ok(s.x>size*.35 && s.y>size*.35);
    assert.ok(g.attributes.position.count>30); g.dispose();
  }
});
test('mark review storage is ephemeral even before save-slot initialization', () => {
  const a = reviewStorage('?markReview=1&mark=corner'); a.setItem('hiraeth.slot','3');
  assert.equal(a.getItem('hiraeth.slot'),'3');
  assert.equal(reviewStorage('?markReview=1').getItem('hiraeth.slot'),null);
  assert.equal(reviewStorage('?mark=corner'),null);
});
test('review mute is applied at audio construction, before later review staging', () => {
  const main = readFileSync(new URL('../src/main.js', import.meta.url),'utf8');
  assert.match(main, /new Sound\(levelId, \{ muted:[^\n]+query\.has\('markReview'\)[^\n]+true/);
});


test('curved ink follows its surface and keeps the gap between the two strokes', async () => {
  const { markOnSurface } = await import('../src/makers-mark/surface.js');
  const g = markOnSurface(2, (x,y) => new THREE.Vector3(x,y,.2*(x*x+y*y)));
  const p=g.attributes.position;
  assert.ok(p.count>100);
  for(let i=0;i<p.count;i++) assert.ok(Math.abs(p.getZ(i)-.2*(p.getX(i)**2+p.getY(i)**2))<1e-6);
  assert.ok([...g.attributes.normal.array].every(Number.isFinite));g.dispose();
});
