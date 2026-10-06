import test from 'node:test';
import assert from 'node:assert/strict';
import { tentTaps } from '../src/shadows.js';
import { makeMaterial, SHADOW_CUT, shadowCut } from '../src/materials.js';

// Cast shadows' edges (docs/systems/rendering.md, "Smooth cast-shadow edges"): the shadow lookup's tent filter,
// the steepened lit fraction the toon threshold cuts, and the spot tier following the shade's antialiased edge.

// The per-texel weights a lookup at uv (texel units, centres at i + 0.5) gives, as the shader reads them: each
// tap a bilinear comparison at base + o (base the nearest texel corner minus a half), its distance from uv
// scaled by spread.
function texelWeights(uv, taps, spread = 1) {
  const base = Math.floor(uv + 0.5), st = uv + 0.5 - base, W = new Map();
  for (const t of tentTaps(st, taps)) {
    const c = uv + (base - 0.5 + t.o - uv) * spread - 0.5, i = Math.floor(c), f = c - i;
    W.set(i, (W.get(i) ?? 0) + t.w * (1 - f));
    W.set(i + 1, (W.get(i + 1) ?? 0) + t.w * f);
  }
  return W;
}
// a shadow edge at texel 10 (texels under 10 in shadow): the lit fraction at uv
const litAt = (uv, taps, spread) => { let s = 0; for (const [i, w] of texelWeights(uv, taps, spread)) if (i >= 10) s += w; return s; };

test('tentTaps: weights sum to one, taps stay inside the tent', () => {
  for (const taps of [4, 9]) for (const st of [0, 0.13, 0.5, 0.77, 1]) {
    const T = tentTaps(st, taps);
    assert.equal(T.length, taps < 5 ? 2 : 3);
    assert.ok(Math.abs(T.reduce((a, t) => a + t.w, 0) - 1) < 1e-12);
    for (const t of T) assert.ok(t.w > 0 && Math.abs(t.o) <= (taps < 5 ? 1.5 : 2.5));
  }
});

test('the lit fraction moves smoothly across texel borders: no step for the toon threshold to cut into the edge', () => {
  for (const taps of [4, 9]) {
    // continuous everywhere (crossing a texel corner, where base and st jump, included)
    let prev = litAt(8, taps), maxJump = 0;
    for (let uv = 8.001; uv < 12; uv += 0.001) { const v = litAt(uv, taps); maxJump = Math.max(maxJump, Math.abs(v - prev)); prev = v; }
    assert.ok(maxJump < 0.004, `${taps} taps: largest change over a thousandth of a texel ${maxJump}`);
    // and it rises the whole way across the edge (monotone): the cut lands once
    let last = -1;
    for (let uv = 7; uv < 13; uv += 0.01) { const v = litAt(uv, taps); assert.ok(v >= last - 1e-9); last = v; }
    assert.ok(Math.abs(litAt(10, taps) - 0.5) < 1e-9, 'half lit right on the edge');
  }
});

test('the filter is the same wherever the map window lies: a cascade moved by whole texels reads exactly the same', () => {
  for (const taps of [4, 9]) for (const spread of [1, 1.7, 2.5]) for (const uv of [9.3, 10.2, 10.81]) {
    const a = litAt(uv, taps, spread);
    // the window moved by k texels: the point and the edge move by k together
    for (const k of [1, 7, -3]) {
      let s = 0; for (const [i, w] of texelWeights(uv + k, taps, spread)) if (i >= 10 + k) s += w;
      assert.ok(Math.abs(s - a) < 1e-9, `spread ${spread}, uv ${uv}, moved ${k}: ${s} vs ${a}`);
    }
  }
});

test('the toon threshold cuts the steepened lit fraction near its half, whatever the facing (shadows keep their size)', () => {
  assert.ok(SHADOW_CUT >= 2 && SHADOW_CUT <= 4);
  // materials.js: L = mix(min(lambert, 0.38), lambert, sh); the shade starts under 0.5
  const cutAt = (lambert) => { let lo = 0, hi = 1; for (let k = 0; k < 40; k++) { const m = (lo + hi) / 2; const L = 0.38 + (lambert - 0.38) * shadowCut(m); if (L < 0.5) lo = m; else hi = m; } return lo; };
  for (const lambert of [0.55, 0.7, 0.88, 1]) {
    const c = cutAt(lambert);
    assert.ok(Math.abs(c - 0.5) < 0.12, `lambert ${lambert}: cut at ${c.toFixed(3)} of the filter`);
  }
  // unsteepened, a sunny face cut a shadow at a quarter: most of the filter's width eaten away
  assert.ok(Math.abs((0.5 - 0.38) / (0.88 - 0.38) - 0.24) < 1e-9);
  const f = makeMaterial({ color: '#888', key: 't.shadow.edges' }).fragmentShader;
  assert.ok(f.includes(`(shadowLit(wp, n, ndl, px) - 0.5) * ${SHADOW_CUT.toFixed(1)} + 0.5`), 'getShadow steepens the lookup');
  assert.ok(f.includes('w0 = 4.0 - 3.0 * st') && f.includes('w0 = 3.0 - 2.0 * st'), 'both tents (9 and 4 taps) in the shader');
  assert.ok(f.includes('(uv + (base + o - uv) * spread) * inv'), 'spread about the point, on the map grid');
});

test("the spot tier's cast-shadow darkening follows the shade's antialiased edge, not a hard step at its middle", async () => {
  const { createPost } = await import('../src/post.js');
  const src = createPost().scene.children[0].material.fragmentShader;
  assert.ok(src.includes('uSpot.x > 0.0 && lit < 0.99'), 'the branch takes the edge band in');
  assert.ok(/\* \(1\.0 - uFlatten\) \* \(1\.0 - lit\);/.test(src), 'its strength fades with the light across the edge');
  assert.ok(!src.includes('uSpot.x > 0.0 && lit < 0.5'));
});
