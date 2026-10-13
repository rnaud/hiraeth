import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { shoulders, besideAnchor, tagPlace, TALK } from '../src/talk-prompt.js';

// Issue #241: "Button prompts to talk to people should be right next to them just below shoulder level, not above their heads."
const bone = (x, y, z) => ({ getWorldPosition: (out) => Object.assign(out, { x, y, z }) });
const person = (o = {}) => ({ pos: { x: 0, y: 0, z: 0 }, object: { scale: { y: 1 }, visible: true }, ...o });
const UP = { x: 0, y: 1, z: 0 };

test('the anchor is the rig\'s shoulders, just below them, never over the head', () => {
  const p = person({ humanoid: { b: { upperarm_l: bone(0.2, 1.42, 0), upperarm_r: bone(-0.2, 1.42, 0) } } });
  const b = shoulders(p, UP);
  assert.ok(b.l && b.r);
  assert.ok(Math.abs(b.l.y - (1.42 - TALK.below)) < 1e-9, 'a little under the joint');
  // seen from the front (the camera's right is −x for someone facing +z toward it): out past the shoulder on that side
  const a = besideAnchor(b, { x: -1, y: 0, z: 0 }, 1);
  assert.ok(a.x < -0.2, 'outside the shoulder');
  assert.ok(a.y < 1.42 && a.y > 1.1, 'at shoulder height, not at 2.15 m over the head');
  // the other side
  assert.ok(besideAnchor(b, { x: -1, y: 0, z: 0 }, -1).x > 0.2);
});

test('seen side on (the shoulders in a line with the view), it still stands clear of the body', () => {
  const p = person({ humanoid: { b: { upperarm_l: bone(0, 1.42, 0.2), upperarm_r: bone(0, 1.42, -0.2) } } });
  const a = besideAnchor(shoulders(p, UP), { x: 1, y: 0, z: 0 }, 1);
  assert.ok(a.x >= TALK.half, 'at least half a body out');
});

test('no rig: by their height (standing, seated, scaled); an alien under its face', () => {
  assert.equal(shoulders(person(), UP).mid.y, TALK.stand);
  assert.equal(shoulders(person({ seat: {} }), UP).mid.y, TALK.seat);
  assert.ok(Math.abs(shoulders(person({ object: { scale: { y: 2 } } }), UP).mid.y - 2 * TALK.stand) < 1e-9);
  const alien = person({ S: { radius: 1.2 }, faceAt: () => ({ x: 0, y: 2.7, z: 0 }) });
  const b = shoulders(alien, UP);
  assert.ok(b.mid.y < 2.7 && b.half >= 0.9);
});

test('the tag reads outward from the anchor and flips off the screen\'s edge', () => {
  const view = { w: 730, h: 410 };   // (the Retroid's CSS size)
  const r = tagPlace(300, 200, 120, 26, view, 1);
  assert.equal(r.side, 1); assert.equal(r.left, 300 + TALK.gap); assert.equal(r.top, 200 - 13);
  const l = tagPlace(300, 200, 120, 26, view, -1);
  assert.equal(l.left, 300 - TALK.gap - 120);
  const edge = tagPlace(680, 200, 120, 26, view, 1);
  assert.equal(edge.side, -1, 'near the right edge: the other side');
  assert.ok(edge.left + 120 <= 680);
  const top = tagPlace(300, 2, 120, 26, view, 1);
  assert.ok(top.top >= TALK.margin, 'inside the screen top to bottom');
});

test('the story places a person\'s prompt beside them; things keep theirs above', () => {
  const src = readFileSync(new URL('../src/story/index.js', import.meta.url), 'utf8');
  assert.match(src, /beside: \(\) => shoulders\(npc, UP, _sh\)/);
  assert.match(src, /tagPlace\(sx, sy/);
  assert.doesNotMatch(src, /\(npc\.seat \? 1\.4 : 2\.15\)/, 'no longer over the head');
  assert.match(src, /translate\(-50%, -100%\)/, 'a thing\'s prompt still hangs over it');
});
