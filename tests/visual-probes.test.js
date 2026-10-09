// The visual audit's probes, their pure logic (scripts/visual-probes/lib.mjs; .claude/skills/visual-audit/SKILL.md).
// Each is shown the bug it was made for, drawn small: it must flag it, and pass the fixed picture.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ghostCheck, stability, unstable, litRidges, floorSlits, stairRisers, cornerOf, silhouette, blobs, maskOf, spotPick, enclosurePick } from '../scripts/visual-probes/lib.mjs';

const W = 120, H = 90;
const img = (f) => { const data = new Float32Array(W * H); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) data[y * W + x] = f(x, y); return { data, w: W, h: H }; };
const person = (x, y) => x >= 50 && x < 62 && y >= 30 && y < 70;   // a figure 12 x 40 px
const sil = () => { const m = new Uint8Array(W * H); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) m[y * W + x] = person(x, y) ? 1 : 0; return m; };

test('ghostCheck: a pale copy of the person beside them in a dark mass is flagged (the white shadow)', () => {
  const dark = (x, y) => (y > 20 ? 0.9 : 0.1);   // a dark recess under the line y = 20 (the risers, the hull)
  const without = img(dark);
  // before 620c4384: each tap that landed on the person counted as open: copies of them, offset by the taps, paler
  const ghost = img((x, y) => (person(x - 14, y) || person(x, y - 10) ? 0.35 : dark(x, y)));
  const r = ghostCheck(ghost, without, sil());
  assert.ok(r.flags.includes('pale person-shaped region in the dark mask'), JSON.stringify(r));
  assert.ok(r.paleShare > 0.5);
  // after: the mask beside them as without them (inside their silhouette whatever it is)
  const fixed = img((x, y) => (person(x, y) ? 0.2 : dark(x, y)));
  assert.deepEqual(ghostCheck(fixed, without, sil()).flags, []);
  // the halo before that: a dark ring round them on open ground
  const open = img(() => 0.05), halo = img((x, y) => (!person(x, y) && x >= 44 && x < 68 && y >= 24 && y < 76 ? 0.9 : 0.05));
  assert.ok(ghostCheck(halo, open, sil()).flags.includes('dark halo round the person'));
  // a person out of view says so
  assert.ok(ghostCheck(fixed, without, new Uint8Array(W * H)).flags.includes('person hardly in view'));
});

test('ghostCheck ignores the silhouette\'s own antialiased edge and what is far from the person', () => {
  const without = img(() => 0.9);
  const edge = img((x, y) => (person(x, y) || ((x === 49 || x === 62) && y >= 30 && y < 70) ? 0.1 : x > 115 ? 0.1 : 0.9));   // its 1 px edge; a change 50 px off
  const r = ghostCheck(edge, without, sil(), { reach: 40 });
  assert.equal(r.biggestPale, 0, JSON.stringify(r));
});

test('stability: surface points whose mask comes and goes as the camera orbits are flagged (the blocks)', () => {
  // 200 points on a riser, 9 frames of a 24° orbit
  const steady = Array.from({ length: 200 }, (_, i) => Array.from({ length: 9 }, (_, f) => (i < 120 ? 0.8 + 0.03 * Math.sin(f + i) : 0)));
  const r = stability(steady);
  assert.equal(r.points, 200); assert.equal(r.dark, 120);
  assert.equal(unstable(r), false, JSON.stringify(r));
  // before c58cbcaa: on 4 taps the riser's mass was there from some sides and not others
  const blocks = steady.map((s, i) => s.map((v, f) => (i < 120 && (f + Math.floor(i / 30)) % 3 === 0 ? 0 : v)));
  const b = stability(blocks);
  assert.ok(unstable(b), JSON.stringify(b));
  assert.ok(b.flipOfDark > 0.9);
  // hidden frames (null) don't count as changes; points seen too few times are left out
  const hidden = steady.map((s) => s.map((v, f) => (f % 2 ? null : v)));
  assert.equal(unstable(stability(hidden)), false);
  assert.equal(stability([[1, null, null, null, null]]).points, 0);
});

test('litRidges: a thin lit line along a dark floor/wall join is found; a lit patch is not a line', () => {
  const seam = img((x, y) => (y === 60 && x > 10 && x < 110 ? 1 : 0.1));
  const r = litRidges(seam);
  assert.ok(r.longest >= 90, JSON.stringify(r.runs[0]));
  assert.equal(r.runs[0].dir, 'row');
  const slanted = img((x, y) => (Math.abs(y - (20 + x * 0.3)) < 1 ? 1 : 0.1));   // a seam seen at a slant: short runs
  assert.ok(litRidges(slanted, { minRun: 3 }).px > 50);
  const patch = img((x, y) => (x > 30 && x < 90 && y > 30 && y < 60 ? 1 : 0.1));
  const lamp = img((x, y) => (y === 60 && x > 10 && x < 110 ? 0.9 : 0.1));   // (a lamp-lit edge, not the sky)
  assert.equal(litRidges(lamp).longest, 0);
  assert.ok(litRidges(patch).longest < 24, JSON.stringify(litRidges(patch).runs[0]));
  const dark = img(() => 0.1);
  assert.equal(litRidges(dark).px, 0);
});

test('floorSlits: the wall stands a metre up but the foot ray goes through: a slit; a door is not one', () => {
  const rays = [
    { angle: 0, low: 17.9, high: 17.8 },     // the wall to the floor
    { angle: 1, low: null, high: 18.1 },     // under the wall: out
    { angle: 2, low: 26, high: 18 },         // under it, to the terrain outside
    { angle: 3, low: null, high: null },     // a door
    { angle: 4, low: 6.5, high: 6.6 },       // a cabinet
  ];
  assert.deepEqual(floorSlits(rays).map((s) => s.angle), [1, 2]);
});

test('stairRisers: risers in a ground profile make stairs; a slope or one step does not', () => {
  const stairs = Array.from({ length: 40 }, (_, i) => Math.floor(i / 5) * 0.37);   // a riser every 1 m (5 samples of 0.2)
  const s = stairRisers(stairs);
  assert.ok(s.stairs && s.run.length >= 7, JSON.stringify(s.run));
  const slope = Array.from({ length: 40 }, (_, i) => i * 0.05);
  assert.equal(stairRisers(slope).stairs, false);
  const curb = Array.from({ length: 40 }, (_, i) => (i > 20 ? 0.3 : 0));
  assert.equal(stairRisers(curb).stairs, false);
});

test('cornerOf: two walls square to each other meet at a corner; parallel walls do not', () => {
  const c = cornerOf({ p: [3, 1], n: [-1, 0] }, { p: [0.5, 4], n: [0, -1] });
  assert.ok(Math.abs(c.p[0] - 3) < 1e-9 && Math.abs(c.p[1] - 4) < 1e-9, JSON.stringify(c));
  assert.ok(Math.abs(c.n[0] + Math.SQRT1_2) < 1e-9 && Math.abs(c.n[1] + Math.SQRT1_2) < 1e-9);
  assert.equal(cornerOf({ p: [3, 0], n: [-1, 0] }, { p: [-3, 0], n: [1, 0] }), null);
});

test('the masks are read from the debug views as post.js writes them', () => {
  const px = (rgb) => ({ pixels: Uint8Array.from(rgb.flat()), channels: 3, width: rgb.length, height: 1 });
  // debug 10: (cast, spot, 0.2) where the spot tier ran; the final picture elsewhere (blue rarely exactly 51)
  assert.deepEqual([...maskOf(px([[10, 204, 51], [10, 204, 200], [0, 0, 52]]), spotPick).data].map((v) => +v.toFixed(2)), [0.8, 0, 0]);
  // debug 9: 1 - enclosure, white open
  assert.deepEqual([...maskOf(px([[255, 255, 255], [0, 0, 0]]), enclosurePick).data], [0, 1]);
  const a = px([[10, 10, 10], [200, 10, 10]]), b = px([[10, 10, 10], [10, 10, 10]]);
  assert.deepEqual([...silhouette(a, b)], [0, 1]);
  assert.deepEqual(blobs(Uint8Array.from([1, 1, 0, 1]), 4, 1).map((r) => r.n), [2, 1]);
});

test('personBlob keeps the person and what hangs on them, not the world moving elsewhere; noiseOf finds that motion', async () => {
  const { personBlob, noiseOf } = await import('../scripts/visual-probes/lib.mjs');
  const m = sil();
  for (let y = 10; y < 60; y++) for (let x = 95; x < 118; x++) m[y * W + x] = 1;   // a flag flapping far off
  for (let y = 40; y < 50; y++) for (let x = 63; x < 67; x++) m[y * W + x] = 1;    // the blade, apart from the hand
  const p = personBlob(m, W, H, [56, 45]);
  assert.equal(p[45 * W + 56], 1); assert.equal(p[45 * W + 64], 1, 'the blade kept');
  assert.equal(p[30 * W + 100], 0, 'the flag left out');
  const flagOnly = new Uint8Array(W * H); for (let y = 10; y < 60; y++) for (let x = 95; x < 118; x++) flagOnly[y * W + x] = 1;
  assert.equal(personBlob(flagOnly, W, H, [5, 85]).reduce((a, b) => a + b, 0), 0, 'nobody where the person should be');
  const a = img(() => 0.5), b = img((x, y) => (x > 100 && y < 20 ? 0.9 : 0.5));
  const n = noiseOf(a, b);
  assert.equal(n[5 * W + 110], 1); assert.equal(n[60 * W + 20], 0);
  // left out of the ghost check: the flag's change near the person counts for nothing
  const without = img(() => 0.9), withP = img((x, y) => (x >= 66 && x < 80 && y >= 30 && y < 70 ? 0.1 : 0.9));
  assert.ok(ghostCheck(withP, without, sil()).flags.length > 0);
  const noise = new Uint8Array(W * H); for (let y = 0; y < H; y++) for (let x = 64; x < 82; x++) noise[y * W + x] = 1;
  assert.deepEqual(ghostCheck(withP, without, sil(), { noise }).flags, []);
});
