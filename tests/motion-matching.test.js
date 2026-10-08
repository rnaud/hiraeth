import test from 'node:test';
import assert from 'node:assert/strict';
import { MotionMatcher } from '../src/motion-match.js';
import { loadAssets } from './gait-sim.js';

test('a loop tail builds its pose query from the same clip, never the next packed segment', async () => {
  const { lib } = await loadAssets();
  const db = lib.motion.db, mm = new MotionMatcher(db);
  const seg = db.segments.find((s) => s.loop && s.end < db.n);
  mm.cur = seg.end - 0.1;
  mm.sample = () => {};
  mm.jump = () => {};
  mm.update(0, { vel: { x: 0, z: 1 }, want: { x: 0, z: 1 } }, 1, { force: true });
  for (let d = 0; d < 15; d++) assert.ok(Math.abs(mm.query[d] - db.feat[(seg.end - 1) * db.F + d]) < 1e-5);
});

