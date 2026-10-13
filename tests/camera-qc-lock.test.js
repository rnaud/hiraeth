// Issue #289 (the camera QC v1.66): the Undertower's antechamber locked on was green in one run and red in the next (the
// camera over his head at 448°/s), and Qanat's shop's look point kinked. The cause of the runs differing: the QC ran on
// the browser's own frame times, and locked on the stick reads from the camera's own turn, so a millisecond in a frame
// changed where he walked and every room decision after it; one run in two ended in the corner by the hall's door. Now the
// QC steps the game 1/60 s a frame (main.js window.__stepDt), walks the antechamber by points into that corner on purpose,
// and runs it three times, the step wobbled; here the same walks in node through the real collision and the real rig
// (scripts/camera-qc/sim-lock.mjs, sim-shop.mjs), the lock camera as main.js turns it (src/foes.js lockFollow).
import test from 'node:test';
import assert from 'node:assert/strict';
import { marketWorld, anteLock, lockWalk, antechamber } from '../scripts/camera-qc/sim-lock.mjs';
import { desertWorld, shopWalk } from '../scripts/camera-qc/sim-shop.mjs';
import { analyse, LIMITS } from '../scripts/camera-qc/lib.mjs';
import { SCENARIOS, ANTE_WAY } from '../scripts/camera-qc/scenarios.mjs';

const market = marketWorld();
const pct = (x) => `${(x * 100).toFixed(1)} %`;

test('the antechamber locked on: green every run, the step even or wobbled ±25 %, never over his head, he never off the screen', () => {
  const ends = [];
  for (const [run, jitter] of [[1, 0], [2, 0.25], [3, 0.25], [4, 0.25]]) {
    const { samples } = anteLock(market, { jitter, seed: run });
    const r = analyse(samples), m = r.measures;
    assert.ok(r.green, `run ${run}: ${r.fails.join('; ')}`);
    assert.equal(m.out, 0, `run ${run}: off the screen ${pct(m.out)}`);
    assert.ok(m.rms <= LIMITS.rms, `run ${run}: roughness ${(m.rms * 100).toFixed(2)} cm`);
    // (the 448°/s frame looked straight down on his head: never steeper than 50° down)
    const steepest = Math.min(...samples.map((s) => s.fwd[1]));
    assert.ok(steepest > -0.77, `run ${run}: looked down ${(-Math.asin(steepest) * 180 / Math.PI).toFixed(0)}°`);
    // (and into the corner by the door each time: the case is in the scenario on purpose)
    const A = antechamber(market.level), c = A.mid.clone().addScaledVector(A.ax, ANTE_WAY.corner[0][0]).addScaledVector({ x: A.ax.z, y: 0, z: -A.ax.x }, ANTE_WAY.corner[0][1]);
    const inCorner = samples.filter((s) => Math.hypot(s.pos[0] - c.x, s.pos[2] - c.z) < 0.7).length / 60;
    assert.ok(inCorner > 1.5, `run ${run}: ${inCorner.toFixed(1)} s in the corner by the door`);
    ends.push(samples.at(-1).pos);
  }
  // walked by points, the way is the same every run, whatever the frames
  for (const e of ends) assert.ok(Math.hypot(e[0] - ends[0][0], e[2] - ends[0][2]) < 0.1, `ends ${ends.map((p) => p.map((v) => v.toFixed(2)).join(',')).join(' | ')}`);
});

test('strafing into the antechamber\'s corner: the look ahead that touches the wall no longer cuts the shoulder at once', () => {
  // (the browser's old ante-lock, by the stick: strafing round the blot into the corner by the jamb, the side's look
  // ahead started its ball against the wall, read no room for a frame, and the look point jumped 0.55 m; seed 4 there)
  const A = antechamber(market.level);
  const segs = [{ for: 1, lock: true }, { for: 3, stick: [0.6, 0] }, { for: 1, stick: [0, 0.5] }, { for: 1, stick: [0, -0.5] }, { for: 4, stick: [-0.6, 0] }];
  for (const seed of [1, 4, 5]) {
    const { samples } = lockWalk(market, { segs, foe: A.mid, start: A.start, yaw: Math.atan2(-A.ax.x, -A.ax.z), jitter: seed > 1 ? 0.25 : 0, seed });
    const m = analyse(samples).measures;
    assert.equal(m.lookJumps, 0, `seed ${seed}: ${m.lookJumps} look jumps`);
    assert.equal(m.pops, 0, `seed ${seed}: ${m.pops} pops`);
  }
});

test('the QC runs the antechamber three times, by points, the blot held still', () => {
  const sc = SCENARIOS.find((s) => s.name === 'ante-lock');
  assert.ok(sc.runs >= 3);
  assert.ok(sc.segs.some((s) => s.path === 'corner'), 'the corner by the door is on the way');
  assert.ok(!sc.segs.some((s) => s.stick), 'no held stick: it forks with the camera');
  assert.match(sc.setup, /f\.update = \(\) => \[\]/, 'the blot held still');
});

test('Qanat\'s shop: no look jumps round the counter and the walls, roughness under the limit', () => {
  const r = shopWalk(desertWorld()), m = r.measures;
  assert.ok(r.green, r.fails.join('; '));
  assert.equal(m.lookJumps, 0, `${m.lookJumps} look jumps`);
  assert.ok(m.rms <= LIMITS.rms, `roughness ${(m.rms * 100).toFixed(2)} cm`);
});
