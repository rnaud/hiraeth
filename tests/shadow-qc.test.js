// The shadow QC's analysis (scripts/shadow-qc/lib.mjs; .claude/skills/shadow-qc/SKILL.md), on made-up probes.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { LIMITS, edgeDistances, tolerance, cascadeOf, counters, judgeFrame, judgeCharacter, verdict, table, merge } from '../scripts/shadow-qc/lib.mjs';
import { SHADOW_GLSL } from '../src/materials.js';

const src = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');

test('edge distances: a shadow\'s edge across a patch, by the grid, and a step between two surfaces is no edge', () => {
  const nu = 10, nv = 3, step = 0.1;
  const truth = [], pos = [];
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) { truth.push(i < 5 ? 1 : 0); pos.push([i * step, 0, j * step]); }
  const d = edgeDistances(nu, nv, truth, pos, step);
  assert.ok(Math.abs(d[4] - 0.05) < 1e-6 && Math.abs(d[5] - 0.05) < 1e-6, 'the two cells either side: half a step');
  assert.ok(Math.abs(d[0] - 0.45) < 1e-6 && Math.abs(d[9] - 0.45) < 1e-6, 'the ends: four steps and a half');
  // the same change across a 1 m drop (a crate's top beside the ground): not an edge
  const far = pos.map((p, k) => (k % nu >= 5 ? [p[0], 1, p[2]] : p));
  assert.ok(edgeDistances(nu, nv, truth, far, step).every((x) => x === Infinity));
});

test('the tolerance: the tent\'s reach on the cascade, widened to the pixel up to 2.5 times, the offset, the spacing', () => {
  const near = { texel: 0.1, offset: 0.3 };
  assert.ok(Math.abs(tolerance(near, 0.05, 9, 0.06) - (0.25 + 0.3 + 0.03 + LIMITS.margin)) < 1e-9);
  assert.ok(Math.abs(tolerance(near, 1, 9, 0.06) - (0.25 * 2.5 + 0.3 + 0.03 + LIMITS.margin)) < 1e-9, 'held at 2.5 texels');
  assert.ok(tolerance(near, 0.05, 4, 0.06) < tolerance(near, 0.05, 9, 0.06), 'four taps: three texels, not five');
  assert.equal(cascadeOf(1, 1), 0); assert.equal(cascadeOf(0.2, 0.9), 1); assert.equal(cascadeOf(0, 0.1), 2);
});

/** A frame of n probes, all on screen, all read from the near cascade. */
const frame = (n, o = {}) => {
  const f = (v) => new Float32Array(n).fill(v);
  return { sh: f(1), vis: f(1), px: f(0.01), sF: f(1), s0: f(1), s1: f(1), iF: f(0), i0: f(1), i1: f(1), ndl: f(0.6), ...o };
};
const CTX = { cascades: [null, { texel: 0.1, offset: 0.3 }, { texel: 1, offset: 2 }], taps: 9 };

test('one frame judged: acne, leaks, peter-panning, a caster off screen, each counted where the truth is clear', () => {
  const n = 6;
  const P = { spot: new Int8Array(n), truth: Int8Array.from([0, 0, 1, 1, 1, 1]), edge: new Float32Array(n).fill(5), reach: Float32Array.from([Infinity, Infinity, 0.2, 5, 5, 5]), spacing: new Float32Array(n).fill(0.05) };
  const F = frame(n);
  F.sh.set([0, 1, 1, 1, 0, 0]);   // 0: lit drawn dark (acne); 2: a contact drawn lit (peter); 3: drawn lit (leak or off screen); 4, 5: right
  const acc = {};
  const r = judgeFrame(P, F, null, { ...CTX, offscreen: (i) => i === 3 }, acc);
  const A = acc[0];
  assert.deepEqual([A.lit, A.acne, A.shade, A.contact, A.peter, A.off, A.offLit, A.leak], [2, 1, 4, 1, 1, 1, 1, 0]);
  assert.deepEqual(r.bad.map((b) => b[1]).sort(), ['acne', 'off', 'peter']);
  // near an edge, nothing is judged wrong; a probe the closer look finds near a narrow shadow neither
  const acc2 = {};
  judgeFrame({ ...P, edge: new Float32Array(n).fill(0.1) }, F, null, CTX, acc2);
  assert.equal(acc2[0].lit + acc2[0].shade, 0);
  const acc3 = {};
  judgeFrame(P, F, null, { ...CTX, clear: () => false }, acc3);
  assert.deepEqual([acc3[0].acne, acc3[0].peter, acc3[0].lit, acc3[0].shade], [0, 0, 1, 2], 'the wrong ones dropped, the right ones kept');
  // turned from the sun, or off screen, or a mover over it: not judged
  const acc4 = {};
  judgeFrame(P, frame(n, { ndl: new Float32Array(n).fill(0.01) }), null, CTX, acc4);
  assert.equal(acc4[0]?.lit ?? 0, 0);
  const acc5 = {};
  judgeFrame(P, F, null, { ...CTX, moved: new Uint8Array(n).fill(1) }, acc5);
  assert.equal(acc5[0], undefined);
});

test('flicker: a probe near an edge changing between frames, a pop when the cascades\' blend moved under it', () => {
  const n = 2;
  const P = { spot: new Int8Array(n), truth: Int8Array.from([1, 1]), edge: new Float32Array(n).fill(0.05), reach: new Float32Array(n).fill(5), spacing: new Float32Array(n).fill(0.05) };
  const a = frame(n, { sh: Float32Array.from([0.2, 0.2]) });
  const b = frame(n, { sh: Float32Array.from([0.7, 0.2]) });
  let acc = {};
  judgeFrame(P, b, a, CTX, acc);
  assert.deepEqual([acc[0].edge, acc[0].shimmer, acc[0].pops], [2, 1, 0]);
  acc = {};
  judgeFrame(P, frame(n, { sh: Float32Array.from([0.7, 0.2]), iF: Float32Array.from([0.3, 0]) }), a, CTX, acc);
  assert.deepEqual([acc[0].shimmer, acc[0].pops], [0, 1]);
  acc = {};
  judgeFrame(P, b, a, { ...CTX, turned: true }, acc);
  assert.equal(acc[0].edge, 0, 'the light turned: no flicker judged');
});

test('seams: in the fine map\'s fade band, the two cascades disagreeing', () => {
  const n = 2;
  const P = { spot: new Int8Array(n), truth: Int8Array.from([1, 0]), edge: new Float32Array(n).fill(0.05), reach: new Float32Array(n).fill(5), spacing: new Float32Array(n).fill(0.05) };
  const acc = {};
  judgeFrame(P, frame(n, { iF: Float32Array.from([0.4, 0.4]), sF: Float32Array.from([0, 1]), s0: Float32Array.from([1, 1]) }), null, CTX, acc);
  assert.deepEqual([acc[0].band, acc[0].seam], [2, 1]);
  // with the hero map (the traveller alone in the fine map) its band is no seam, and the near map's tolerance holds
  const acc2 = {};
  judgeFrame(P, frame(n, { iF: Float32Array.from([0.4, 0.4]), sF: Float32Array.from([0, 1]), s0: Float32Array.from([1, 1]) }), null, { ...CTX, hero: true }, acc2);
  assert.equal(acc2[0].band, 0);
});

test('the traveller\'s shadow: how much of it is drawn, how much spills, how far it starts from the foot', () => {
  const A = counters();
  const truth = Int8Array.from([1, 1, 1, 1, 0, 0, -1]), sh = Float32Array.from([0, 0, 0, 1, 0, 1, 0]), w = new Float32Array(7).fill(0.01);
  const r = judgeCharacter(truth, sh, w, [{ drawn: 0.06, truth: 0.015 }, { drawn: Infinity, truth: 0 }], A);
  assert.ok(Math.abs(r.coverage - 0.75) < 1e-9 && Math.abs(r.spill - 0.25) < 1e-9);
  assert.deepEqual(A.gaps.map((x) => +x.toFixed(3)), [0.045]);
  assert.equal(judgeCharacter(new Int8Array(3), sh, w, [], counters()), null, 'nothing of him on the ground: not judged');
});

test('the verdict: rates against the limits, only with enough probes to judge; the table and merging', () => {
  const A = merge(counters(), { ...counters(), frames: 100, lit: 10000, acne: 50, shade: 5000, contact: 1000, peter: 10, edge: 20000, shimmer: 10, gaps: [0.01] });
  const v = verdict(A);
  assert.ok(Math.abs(v.measures.acne - 0.005) < 1e-12 && !v.green && v.fails.some((f) => f.startsWith('acne')));
  assert.ok(!v.fails.some((f) => f.startsWith('peter')), '1 % of the contacts: under 5 %');
  const few = verdict({ ...counters(), lit: 50, acne: 10 });
  assert.ok(few.green, 'fifty probes are too few to call it');
  assert.match(table([['high', 'props', v]]), /\| high \| props \| \*\*red\*\*: acne 0\.50 %/);
});

test('the probes run the surfaces\' own shadow code (materials.js SHADOW_GLSL), not a copy', () => {
  assert.match(SHADOW_GLSL, /float getShadow\(/);
  assert.match(SHADOW_GLSL, /float sampleShadow\(/);
  assert.match(src('src/materials.js'), /\$\{SHADOW_GLSL\}/);
  const probes = src('scripts/shadow-qc/probes.js');
  assert.match(probes, /import \{ SHADOW_GLSL, sharedUniforms as SU \} from '\.\.\/\.\.\/src\/materials\.js'/);
  assert.match(probes, /\$\{SHADOW_GLSL\}/);
  // the skill drives the room, muted, never on the author's port
  const run = src('.claude/skills/shadow-qc/run.mjs');
  assert.match(run, /--mute-audio/);
  assert.match(run, /5173 is the author/);
  assert.match(run, /level=shadows/);
});
