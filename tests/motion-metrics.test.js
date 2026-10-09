// The walk-cycle measures (scripts/motion-audit/metrics.mjs) on hand-made gaits: a planted foot that never slides,
// a stick leg dragged along with the body, a knee that bends, tripod groups vs each side in phase.
import test from 'node:test';
import assert from 'node:assert/strict';
import { rangeOf, contactMask, footSlide, travelled, cadence, reach, jointAngle, correlation, gaitGroups, walkReport } from '../scripts/motion-audit/metrics.mjs';

const N = 240, DT = 1 / 60, SPEED = 2;
const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) <= eps, `${a} vs ${b}`);

/**
 * A planted-foot gait: the body walks at SPEED along +z; each foot holds its place on the ground for `stance` of
 * a cycle, then swings ahead in an arc (lifted `lift`) to land a stride ahead. `phase` offsets the leg.
 */
function plantedFoot(phase, { x = 0.5, cycle = 1, stance = 0.6, lift = 0.15 } = {}) {
  const stride = SPEED * cycle, out = [];
  for (let i = 0; i < N; i++) {
    const t = i * DT, u = (((t / cycle + phase) % 1) + 1) % 1, n = Math.floor(t / cycle + phase);
    const plantZ = n * stride - phase * stride;   // (where this step's foot is planted)
    if (u < stance) out.push([x, 0, plantZ]);
    else { const s = (u - stance) / (1 - stance), e = s * s * s * (s * (6 * s - 15) + 10); out.push([x, Math.sin(Math.PI * s) * lift, plantZ + e * stride]); }   // (up first, then over: smootherstep)
  }
  return out;
}
const bodyPath = (h = 0.6) => Array.from({ length: N }, (_, i) => [0, h, SPEED * i * DT]);
const hipsFor = (x, h = 0.6) => Array.from({ length: N }, (_, i) => [x, h, SPEED * i * DT]);

test('rangeOf, travelled and correlation', () => {
  assert.deepEqual(rangeOf([3, -1, 2]), { min: -1, max: 3, span: 4 });
  assert.deepEqual(rangeOf([]), { min: 0, max: 0, span: 0 });
  near(travelled(bodyPath()), SPEED * (N - 1) * DT);
  near(correlation([1, 2, 3], [2, 4, 6]), 1);
  near(correlation([1, 2, 3], [3, 2, 1]), -1);
  assert.equal(correlation([1, 1, 1], [1, 2, 3]), 0);
});

test('a planted foot does not slide; a stick foot dragged with the body slides the whole way', () => {
  const planted = footSlide(plantedFoot(0));
  assert.ok(planted.slide < 0.02 * travelled(bodyPath()), `planted slide ${planted.slide}`);   // (only the lift-off and touchdown's last mm)
  assert.ok(planted.share > 0.5 && planted.share < 0.75, `share ${planted.share}`);
  // a leg swung as a rigid pendulum under a moving body, its foot never far off the ground: it skates along
  const dragged = Array.from({ length: N }, (_, i) => [0.5, 0.01 * Math.abs(Math.sin(i * DT * 7)), SPEED * i * DT + Math.sin(i * DT * 7) * 0.2]);
  const d = footSlide(dragged);
  assert.equal(d.share, 1);
  assert.ok(d.slide > travelled(bodyPath()) * 0.9, `slide ${d.slide}`);
  assert.equal(cadence(dragged, N * DT), 0);   // (never lifts: no steps at all)
});

test('contact, cadence and lift of a stepping foot', () => {
  const f = plantedFoot(0.25), on = contactMask(f);
  assert.ok(on.some(Boolean) && on.some((x) => !x));
  near(cadence(f, N * DT), 1, 0.26);   // (one step a second, give or take the run's ends)
});

test('reach: a stick leg keeps its length, a bending knee changes it; jointAngle reads the bend', () => {
  const hip = hipsFor(0.5);
  const stick = hip.map(([x, y, z], i) => { const a = Math.sin(i * DT * 7) * 0.3; return [x, y - Math.cos(a) * 0.6, z + Math.sin(a) * 0.6]; });
  near(reach(hip, stick).span, 0, 1e-9);
  const r = reach(hip, plantedFoot(0));
  assert.ok(r.span > 0.2, `planted reach span ${r.span}`);
  near(jointAngle([0, 1, 0], [0, 0, 0], [0, -1, 0]), Math.PI);
  near(jointAngle([0, 1, 0], [0, 0, 0], [1, 0, 0]), Math.PI / 2);
});

test('gait groups: a tripod on six legs vs each side in phase', () => {
  // legs ordered L0, R0, L1, R1, L2, R2; a tripod is L0 R1 L2 against R0 L1 R2
  const xs = [-0.5, 0.5, -0.5, 0.5, -0.5, 0.5];
  const tri = [0, 0.5, 0.5, 0, 0, 0.5].map((p, k) => plantedFoot(p, { x: xs[k], stance: 0.5 }));
  const hips = xs.map((x) => hipsFor(x));
  assert.deepEqual(gaitGroups(tri, hips), [[0, 3, 4], [1, 2, 5]]);
  const sided = [0, 0.5, 0, 0.5, 0, 0.5].map((p, k) => plantedFoot(p, { x: xs[k], stance: 0.5 }));
  assert.deepEqual(gaitGroups(sided, hips), [[0, 2, 4], [1, 3, 5]]);
});

test('walkReport: the totals of a good gait and a skating one', () => {
  const xs = [-0.5, 0.5, -0.5, 0.5];
  const hips = xs.map((x) => hipsFor(x)), body = bodyPath();
  const good = walkReport({ feet: [0, 0.5, 0.5, 0].map((p, k) => plantedFoot(p, { x: xs[k] })), hips, body, seconds: N * DT });
  assert.ok(good.slidePerMetre < 0.02, `good ${good.slidePerMetre}`);
  assert.ok(good.reachSpan > 0.2 && good.lift > 0.1);
  assert.deepEqual(good.groups, [[0, 3], [1, 2]]);
  const skate = walkReport({ feet: hips.map((h) => h.map(([x, , z], i) => [x, 0, z + Math.sin(i * DT * 7) * 0.2])), hips, body, seconds: N * DT });
  assert.ok(skate.slidePerMetre > 0.9, `skate ${skate.slidePerMetre}`);
  near(skate.reachSpan, Math.hypot(0.6, 0.2) - 0.6, 1e-3);   // (a stick swung ±0.2 m changes its reach only by its tilt)
});
