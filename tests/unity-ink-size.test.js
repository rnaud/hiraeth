// Issue #538: the Rose House's lit circuits drew as thin brown lines in Unity, the web's as bright orange ones: the
// G-buffers were the same, but the Unity composite never had the web's "ink lines by the size of what they draw" (post.js
// INK_SIZE, v1.34): on a sliver (a pixel that differs from both its neighbours across: a lit line two pixels wide, a stem, a
// far petal) the pen line keeps off, so the line's own colour shows. Unity inked the circuit's own pixels. Its composite now
// does the web's 1a, with INK_SIZE's numbers (but not its frameK: see the shader).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { INK_SIZE } from '../src/post.js';

const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const C = read('unity/Hiraeth/Assets/Hiraeth/Shaders/Composite.shader'), WEB = read('src/post.js');
const f3 = (x) => x.toFixed(3), f2 = (x) => x.toFixed(2);

test('the kernels as before: the web\'s frameK left out on purpose (no gain measured, every handheld\'s lines thinner)', () => {
  assert.doesNotMatch(C.replace("not the web's frameK", ''), /frameK/);
  for (const k of ['lerp(silW, inW, 0.5) * _PixelRatio, true', 'eS = inkLines(euv, silW * _PixelRatio, false', 'eI = inkLines(euv, inW * _PixelRatio, true']) assert.ok(C.includes(k), k);
});

test('slivers: each kernel says how far its pixel differs on both sides across, as the web\'s', () => {
  const pairs = [
    ['gSliver = vec4(max(min(nf.x, nf.y), min(nf.z, nf.w)), c.w, 0.0, 0.0);', 'gSliver = float4(max(min(nf.x, nf.y), min(nf.z, nf.w)), c.w, 0.0, 0.0);'],
    ['gSliver.z = max(min(d1, d2), min(d3, d4));', 'gSliver.z = max(min(d1, d2), min(d3, d4));'],
    ['gSliver.w = max(min(dq.x, dq.y), min(dq.z, dq.w)) * step(1e-3, uAlbedoEdges);', 'gSliver.w = max(min(dq.x, dq.y), min(dq.z, dq.w)) * step(1e-3, _AlbedoEdges);'],
  ];
  for (const [w, u] of pairs) { assert.ok(WEB.includes(w), `web: ${w}`); assert.ok(C.includes(u), `Unity: ${u}`); }
  assert.match(C, /static float4 gSliver;/);
  assert.match(C, /slS = gSliver; eI = inkLines\(euv, inW \* _PixelRatio, true, nearD2, ownK2\); slI = gSliver;/, 'each kernel\'s own, read right after it');
});

test('1a: the line keeps off a sliver, carries a kernel\'s coverage, lightens beside a thin shape (INK_SIZE\'s numbers)', () => {
  const a = C.slice(C.indexOf('// ---- 1a.'), C.indexOf('// ---- 1c.'));
  assert.ok(a.length > 100, '1a, before 1c as on the web');
  assert.ok(a.includes(`ink *= clamp(_PixelRatio * ${f2(INK_SIZE.alphaAt)}, ${f2(INK_SIZE.minAlpha)}, 1.0);`));
  assert.ok(a.includes(`smoothstep(${f3(INK_SIZE.step[0])}, ${f3(INK_SIZE.step[1])}, (slS.x - slS.y) / slS.y)`));
  assert.ok(a.includes('max(smoothstep(_NormalThresh, _NormalThresh * 1.5, slI.z), smoothstep(0.08, 0.14, slI.w))'));
  assert.ok(a.includes(`ink *= lerp(1.0, ${f2(INK_SIZE.onSliver)}, max(sD * eS.x, sI * max(eI.y, eI.z)) / max(ink, 1e-3));`));
  assert.ok(a.includes(`ink *= lerp(1.0, ${f2(INK_SIZE.farSide)}, max(back.x, 0.5 * back.y));`));
  assert.ok(a.includes('float da = tN(ownK.xy + dk).w, db = tN(ownK.xy + 3.0 * dk).w;'));
  // (the web's, for the same: its numbers from INK_SIZE)
  assert.ok(WEB.includes('ink *= mix(1.0, ${INK_SIZE.onSliver.toFixed(2)}, max(sD * eS.x, sI * max(eI.y, eI.z)) / max(ink, 1e-3));'));
});
