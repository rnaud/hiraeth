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


// A fresh match (in from the loops, or the first frame) has no clip's pose to go on. It took the database's
// average for the whole pose, velocities too (1.1 m/s ahead): a body standing still was taken for one on the
// move, matched a jog's stop (leaning back, his face 35° up) and every search after went on from it (the
// Motion page, 2026-10-09). Now the feet and the hips move as the body does.
test('a fresh match moves as the body does: standing, a standing frame; walking, a walking one', async () => {
  const { lib } = await loadAssets();
  const db = lib.motion.db, F = db.F;
  const pick = (vz, want) => {
    const mm = new MotionMatcher(db);
    mm.sample = () => {};
    let to = -1;
    mm.jump = (f) => { to = f; };
    mm.update(0, { vel: { x: 0, z: vz }, want: { x: 0, z: want }, k: 8, face: null }, 1, { force: true });
    return { hip: Math.hypot(db.rawFeat[to * F + 12], db.rawFeat[to * F + 14]), name: db.segments[db.segOf[to]].desc, q: Array.from(mm.query.slice(12, 15)) };
  };
  const still = pick(0, 0), walking = pick(1.4, 1.4);
  assert.ok(still.hip < 0.3, `standing still, a still frame (${still.name}: its hips at ${still.hip.toFixed(2)} m/s)`);
  assert.ok(Math.abs(walking.hip - 1.4) < 0.5, `walking at 1.4 m/s, a frame near that (${walking.name}: ${walking.hip.toFixed(2)} m/s)`);
});
