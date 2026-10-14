// The ink-lines audit's measures (scripts/ink-lines/lib.mjs; .claude/skills/ink-lines/SKILL.md), shown small
// pictures of what they are for: thin lines against a blob, a drawn eye against a black socket, steady lines
// against popping ones.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { strokeWidth, inkShare, darkShare, eyeMarks, shimmer, steadyMask, depthOf, DEBUG_DEPTH, objectMask, extent, grade, check } from '../scripts/ink-lines/lib.mjs';

const W = 80, H = 60;
const field = (f) => { const a = new Float32Array(W * H); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) a[y * W + x] = f(x, y); return a; };
const rgb = (f) => { const pixels = new Uint8Array(W * H * 3); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const v = f(x, y), i = (y * W + x) * 3; pixels[i] = v[0]; pixels[i + 1] = v[1]; pixels[i + 2] = v[2]; } return { pixels, channels: 3, width: W, height: H }; };

test('strokeWidth: a ring of 2 px lines reads 2 px wide, a filled blob reads wide and as a blob', () => {
  const ring = field((x, y) => { const d = Math.max(Math.abs(x - 40), Math.abs(y - 30)); return d >= 18 && d < 20 ? 1 : 0; });
  const r = strokeWidth(ring, W, H);
  assert.equal(r.median, 2);
  assert.ok(r.blobShare < 0.1, JSON.stringify(r));
  const blob = field((x, y) => (Math.abs(x - 40) < 8 && Math.abs(y - 30) < 8 ? 1 : 0));
  const b = strokeWidth(blob, W, H);
  assert.ok(b.median >= 10 && b.blobShare > 0.9, JSON.stringify(b));
});

test('objectMask, extent, inkShare and darkShare: the share of an object that is ink or near-black', () => {
  const sq = (x, y) => x >= 30 && x < 50 && y >= 20 && y < 40;
  const mask = objectMask(rgb((x, y) => (sq(x, y) ? [90, 140, 60] : [200, 190, 170])), rgb(() => [200, 190, 170]));
  const e = extent(mask, W, H);
  assert.deepEqual([e.n, e.w, e.h], [400, 20, 20]);
  const outline = field((x, y) => (sq(x, y) && !sq(x - 1, y) || sq(x, y) && !sq(x + 1, y) || sq(x, y) && !sq(x, y - 1) || sq(x, y) && !sq(x, y + 1) ? 1 : 0));
  const s = inkShare(outline, mask, W, H, 0);
  assert.ok(Math.abs(s - 76 / 400) < 1e-6, String(s));
  const full = field((x, y) => (sq(x, y) ? 1 : 0));
  assert.ok(inkShare(full, mask, W, H, 0) > 0.99);
  const dark = rgb((x, y) => (sq(x, y) && x < 40 ? [10, 10, 10] : [200, 190, 170]));
  assert.ok(Math.abs(darkShare(dark, mask, 0) - 0.5) < 1e-6);
});

test('eyeMarks: a drawn eye (a light opening, a dark iris) is lighter than a black socket of the same size', () => {
  const skin = [200, 140, 110], eye = { x: 40, y: 30, w: 6, h: 2.5, cheek: [40, 40] };
  const drawn = rgb((x, y) => { const u = (x - 40) / 6, v = (y - 30) / 2.5; if (u * u + v * v > 1) return skin; return Math.abs(x - 40) < 2 ? [30, 20, 15] : [215, 200, 180]; });
  const socket = rgb((x, y) => { const u = (x - 40) / 7.5, v = (y - 30) / 3.5; return u * u + v * v <= 1 ? [25, 18, 14] : skin; });
  const [a] = eyeMarks(drawn, [eye]), [b] = eyeMarks(socket, [eye]);
  assert.ok(a.density < 0.6, JSON.stringify(a));
  assert.ok(b.density > 1, JSON.stringify(b));
  assert.ok(b.darkest < 0.2);
});

test('shimmer: lines that slide a little change less than lines that pop', () => {
  const a = field((x) => (x === 20 ? 1 : x === 21 ? 0.4 : 0));
  const slid = field((x) => (x === 20 ? 0.7 : x === 21 ? 0.7 : 0));
  const popped = field((x) => (x === 50 ? 1 : 0));
  const s = shimmer(a, slid), p = shimmer(a, popped);
  assert.ok(s.change < p.change, `${s.change} ${p.change}`);
  assert.equal(s.pops, 0);
  assert.ok(p.pops > 0.6);
});

test('the shimmer is read over what slides under a pixel, not the parallax of things nearer than the view (#38)', () => {
  // the view looks at 180 m; a pole 10 m off stands at x 30-33, the town behind it at 180 m, the sky past it
  const depth = field((x, y) => (x >= 30 && x < 34 ? 10 : y < 10 ? DEBUG_DEPTH : 180));
  const m = steadyMask(depth, W, H, 180, { reach: 2 });
  assert.equal(m[20 * W + 60], 1, 'the town');
  assert.equal(m[5 * W + 60], 1, 'the sky (the far side of a far outline)');
  assert.equal(m[20 * W + 31], 0, 'the pole');
  assert.equal(m[20 * W + 35], 0, 'beside the pole: its outline on the far side');
  // the pole's outline slid 6 px between the two pictures: whole-frame shimmer pops, the steady part doesn't
  const a = field((x, y) => (x === 29 || (y === 40 && x > 50 && x < 70) ? 1 : 0)), b = field((x, y) => (x === 35 || (y === 40 && x > 50 && x < 70) ? 1 : 0));
  const all = shimmer(a, b), steady = shimmer(a, b, m);
  assert.ok(all.pops > 0.5, JSON.stringify(all));
  assert.equal(steady.pops, 0);
  assert.equal(steady.change, 0);
  // debug 4's grey back to metres
  const img = { pixels: new Uint8Array([255, 255, 255, 0, 0, 0]), channels: 3, width: 2, height: 1 };
  assert.deepEqual([...depthOf(img)], [DEBUG_DEPTH, 0]);
});

test('grade: the rubric passes thin lines on a small plant and fails a black one', () => {
  assert.equal(check(0.1, [0.2, 0.3]), 1);
  assert.equal(check(0.25, [0.2, 0.3]), 0.5);
  assert.equal(check(0.4, [0.2, 0.3]), 0);
  const ok = grade({ kind: 'foliage', far: true, metrics: { object: { n: 300, h: 30 }, inkShare: 0.1, darkShare: 0.08, width: { n: 40, median: 1, p90: 1 }, shimmer: { n: 50, change: 0.2, pops: 0.05 } } });
  const bad = grade({ kind: 'foliage', far: true, metrics: { object: { n: 300, h: 30 }, inkShare: 0.5, darkShare: 0.4, width: { n: 40, median: 4, p90: 6 }, shimmer: { n: 50, change: 0.7, pops: 0.4 } } });
  assert.equal(ok.score, 5);
  assert.equal(bad.score, 0);
  const eyes = (d, share) => ({ kind: 'figure', metrics: { object: { n: 900, h: 200 }, darkShare: 0.1, eyes: [{ density: d, share, h: 3 }, { density: d, share, h: 3 }] } });
  const ref = eyes(0.5, 0.002);
  assert.equal(grade(eyes(0.55, 0.0022), ref).checks.eyeGrowth.verdict, 1);
  assert.equal(grade(eyes(1.4, 0.006), ref).checks.eyeGrowth.verdict, 0);
  assert.equal(grade(eyes(1.4, 0.006), ref).checks.eyeDensity.verdict, 0);
  // a tiny face's eyes are not judged (#302: under 14 px the eye's box takes in the hair)
  const tiny = eyes(1.0, 0.009); tiny.metrics.facePx = 12; tiny.metrics.eyes.forEach((e) => { e.h = 1; e.darkest = 0; });
  const g = grade(tiny, ref).checks;
  assert.equal(g.eyeGrowth, undefined); assert.equal(g.eyeBlack, undefined); assert.equal(g.eyeDensity, undefined);
});

test('the capture finds his eyes by the head\'s own fit, not one written out (#335)', async () => {
  // (the v1 body's fit written into the capture put the B3 head's eye boxes 1.5 cm up, on the brow and the hair: a
  // "dark eye" of 1.8 against the 1.3 limit that was the hair; the eye was drawn as before)
  const { readFileSync } = await import('node:fs');
  const capture = readFileSync(new URL('../.claude/skills/ink-lines/capture.mjs', import.meta.url), 'utf8');
  const head = readFileSync(new URL('../src/characters/portrait-head.js', import.meta.url), 'utf8');
  const b3 = readFileSync(new URL('../src/characters/traveller-b3.js', import.meta.url), 'utf8');
  assert.match(head, /userData\.portraitHeadFit\s*=\s*fit/, 'makePortraitHead keeps its fit on the mesh');
  assert.match(b3, /makePortraitHead\([^)]*B3_HEAD_FIT\)/, 'the B3 body wears the head by its own fit');
  assert.ok((capture.match(/userData\.portraitHeadFit/g) ?? []).length >= 2, 'the eye boxes and the portrait camera read the fit');
  assert.doesNotMatch(capture, /\b0\.264\b|\b1\.510\b|\b1\.487\b/, 'no head fit written out in the capture');
});
