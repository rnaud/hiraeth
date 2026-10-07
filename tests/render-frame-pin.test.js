// One game frame's passes share one renderer frame (perf.js pinRenderFrame, docs/systems/performance.md): three.js
// updates a skeleton and uploads its bones once per frame number, so the shadow and G-buffer passes no longer
// each do it again.
import test from 'node:test';
import assert from 'node:assert/strict';
import { pinRenderFrame } from '../src/perf.js';

/** a renderer as three counts it: render() adds one to the frame, and a skeleton is updated once per frame number */
function fakeRenderer() {
  const seen = new Map();
  const r = { info: { render: { frame: 0 } }, updates: 0,
    render() { this.info.render.frame++; const f = this.info.render.frame; if (seen.get('skeleton') !== f) { seen.set('skeleton', f); this.updates++; } } };
  return r;
}

test('the passes between begin and end update a skeleton once; the next frame does again', () => {
  const r = fakeRenderer(), pin = pinRenderFrame(r);
  for (let frame = 0; frame < 5; frame++) {
    pin.begin();
    r.render(); r.render(); r.render();   // shadows, the G-buffer, the overlays
    pin.end();
  }
  assert.equal(r.updates, 5, 'once a game frame');
  const f = r.info.render.frame;
  r.render(); r.render();   // outside a frame (a capture): as three counts them
  assert.equal(r.updates, 7);
  assert.equal(r.info.render.frame, f + 2);
  pin.begin(); r.render(); pin.end();
  assert.equal(r.updates, 8, 'and after them the frames still move on');
});
