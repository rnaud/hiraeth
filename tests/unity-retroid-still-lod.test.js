// The big still meshes' levels of detail in the Unity build (issue #404, round 15; docs/systems/performance.md, "Unity on the
// Retroid, round 15"): what the Retroid's GPU spent on the City-Shaft's far terraces and Lorn's far houses was their vertices,
// so a big plain mesh drawn on its own gets coarser versions of its triangles (InstLod.Simplify, on a worker thread), appended
// to its index buffer, and its submesh points at the coarsest one whose stray stays under half a pixel. The stray is measured
// through a grid of cells now (TriGrid): run here as JavaScript against a search of every triangle.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p) => readFileSync(new URL(`../unity/Hiraeth/Assets/${p}`, import.meta.url), 'utf8');
const lod = read('Hiraeth/Runtime/InstLod.cs');
const renderer = read('HiraethJS/Runtime/BridgeRenderer.cs');
const runner = read('HiraethJS/Runtime/BridgeRunner.cs');
const surface = read('Hiraeth/Shaders/Surface.shader');

const still = renderer.slice(renderer.indexOf('void StillLods()'), renderer.indexOf('static void SetStill('));

test('a big still mesh of its own: its levels made once off the main thread, past stillLodFrom', () => {
  assert.match(renderer, /public static int stillLodTris =\n#if UNITY_ANDROID && !UNITY_EDITOR\n\s+3000;\n#else\n\s+0;\n#endif/);
  // (one mesh at a time on one background thread of the lowest priority, so the script's thread keeps its cores; cached on
  // the device by the mesh's points and triangles)
  assert.match(still, /StillWork\(\(\) =>/);
  assert.match(renderer, /\{ IsBackground = true, Priority = System\.Threading\.ThreadPriority\.Lowest, Name = "Hiraeth still levels" \}/);
  assert.match(still, /if \(file == null \|\| !StillRead\(file, tri\.Length, pos\.Length, idx, err\)\)/);
  assert.match(renderer, /stillCache = System\.IO\.Path\.Combine\(Application\.temporaryCachePath, "still-lod"\)/);
  assert.match(still, /Hiraeth\.InstLod\.Simplify\.Levels\(pos, /);
  // (one submesh, no bones or shape keys, its points never moved, drawn by one node, not in a static batch)
  assert.match(still, /n\.kind != "mesh" \|\| n\.smr \|\| n\.im != null \|\| n\.batched/);
  assert.match(still, /md\.bones >= 0 \|\| md\.keys > 0 \|\| md\.subs == null \|\| md\.subs\.Length != 1/);
  assert.match(still, /d < stillLodFrom \|\| md\.subs\[0\]\.Length \/ 3 < stillLodTris \|\| md\.subs\[0\]\.Length \/ 3 > StillMaxTris \|\| meshUsers\[n\.mesh\] != 1 \|\| md\.unchunked/);
  assert.match(runner, /BridgeArgs\.Arg\("-still-lod-tris"\)/);
  assert.match(runner, /BridgeArgs\.Arg\("-still-lod-from"\)/);
});

test('the levels follow the full mesh in its index buffer; the submesh points at one, the bounds kept', () => {
  assert.match(still, /System\.Array\.Copy\(d\.md\.subs\[0\], all, l\.full\);/);
  assert.match(still, /mesh\.SetIndices\(all, MeshTopology\.Triangles, 0, false\);/);
  assert.match(still, /desc0\.indexStart = 0; desc0\.indexCount = l\.full;/);
  assert.match(renderer, /desc\.indexStart = l\.start\[k\]; desc\.indexCount = l\.count\[k\];\n\s+mesh\.SetSubMesh\(0, desc, MeshUpdateFlags\.DontRecalculateBounds \| MeshUpdateFlags\.DontValidateIndices\);/);
  // (a mesh whose points moved goes back to the full one for good)
  assert.match(still, /if \(md\.unchunked \|\| md\.mesh\.subMeshCount != 1\) \{ SetStill\(md\.mesh, l, 0\); l\.none = true; continue; \}/);
});

test('a level is drawn only where its stray is under InstLod.Px of the render\'s pixels at the bounds\' nearest point', () => {
  assert.match(still, /float d = Mathf\.Sqrt\(n\.r\.bounds\.SqrDistance\(eye\)\);/);
  assert.match(still, /for \(int k = l\.levels; k >= 1; k--\) if \(l\.err\[k\] \* sc \* pxRad \/ d < px\) \{ want = k; break; \}/);
});

test('a mesh that takes levels is left out of the static batches (their triangles would be baked at one level)', () => {
  const sb = renderer.slice(renderer.indexOf('void StaticBatch()'), renderer.indexOf('void Unbatch(Node n)'));
  assert.match(sb, /md\.subs\[0\]\.Length \/ 3 >= stillLodTris && md\.subs\[0\]\.Length \/ 3 <= StillMaxTris && MeshUsers\(n\.mesh\) == 1\) continue;/);
});

test('no new Surface variant nor pipeline state: the levels are the mesh\'s own triangles', () => {
  assert.doesNotMatch(surface, /HIRAETH_FAR\b|_FarK/);
  assert.doesNotMatch(still, /EnableKeyword|new Material/);
});

// ---- the grid's nearest triangle (InstLod.Simplify.TriGrid), as JavaScript
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const len = (a) => Math.sqrt(dot(a, a));
function pointTri(p, a, b, c) {
  const ab = sub(b, a), ac = sub(c, a), ap = sub(p, a);
  const d1 = dot(ab, ap), d2 = dot(ac, ap);
  if (d1 <= 0 && d2 <= 0) return len(ap);
  const bp = sub(p, b), d3 = dot(ab, bp), d4 = dot(ac, bp);
  if (d3 >= 0 && d4 <= d3) return len(bp);
  const vc = d1 * d4 - d3 * d2;
  if (vc <= 0 && d1 >= 0 && d3 <= 0) { const v = d1 / (d1 - d3); return len(sub(p, add(a, mul(ab, v)))); }
  const cp = sub(p, c), d5 = dot(ab, cp), d6 = dot(ac, cp);
  if (d6 >= 0 && d5 <= d6) return len(cp);
  const vb = d5 * d2 - d1 * d6;
  if (vb <= 0 && d2 >= 0 && d6 <= 0) { const w = d2 / (d2 - d6); return len(sub(p, add(a, mul(ac, w)))); }
  const va = d3 * d6 - d5 * d4;
  if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) { const w = (d4 - d3) / ((d4 - d3) + (d5 - d6)); return len(sub(p, add(b, mul(sub(c, b), w)))); }
  const den = 1 / (va + vb + vc), v2 = vb * den, w2 = vc * den;
  return len(sub(p, add(a, add(mul(ab, v2), mul(ac, w2)))));
}
function triGrid(P, T) {
  let mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
  for (const f of T) for (const v of f) for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], P[v][k]); mx[k] = Math.max(mx[k], P[v][k]); }
  const ext = sub(mx, mn), size = Math.max(...ext, 1e-4);
  const vol = Math.max(ext[0], size * 0.01) * Math.max(ext[1], size * 0.01) * Math.max(ext[2], size * 0.01);
  const h = Math.max(size / 64, Math.cbrt(vol / Math.max(T.length, 1)));
  const n = ext.map((e) => Math.min(Math.max(Math.ceil(e / h) + 1, 1), 66));
  const clamp = (x, a, b) => Math.min(Math.max(x, a), b);
  const cell = (q) => [0, 1, 2].map((k) => clamp(Math.trunc((q[k] - mn[k]) / h), 0, n[k] - 1));
  const cells = new Map(), key = (x, y, z) => (x * n[1] + y) * n[2] + z;
  T.forEach((f, i) => {
    const lo = cell([0, 1, 2].map((k) => Math.min(P[f[0]][k], P[f[1]][k], P[f[2]][k]))), hi = cell([0, 1, 2].map((k) => Math.max(P[f[0]][k], P[f[1]][k], P[f[2]][k])));
    for (let x = lo[0]; x <= hi[0]; x++) for (let y = lo[1]; y <= hi[1]; y++) for (let z = lo[2]; z <= hi[2]; z++) { const k = key(x, y, z); if (!cells.has(k)) cells.set(k, []); cells.get(k).push(i); }
  });
  return (q, enough) => {
    const c = cell(q), seen = new Set(); let best = Infinity, visited = 0;
    for (let r = 0; r <= Math.max(...n); r++) {
      for (let x = Math.max(c[0] - r, 0); x <= Math.min(c[0] + r, n[0] - 1); x++) {
        const xe = x === c[0] - r || x === c[0] + r;
        for (let y = Math.max(c[1] - r, 0); y <= Math.min(c[1] + r, n[1] - 1); y++) {
          const ye = xe || y === c[1] - r || y === c[1] + r;
          for (let z = Math.max(c[2] - r, 0); z <= Math.min(c[2] + r, n[2] - 1); z++) {
            if (!ye && z !== c[2] - r && z !== c[2] + r) continue;
            for (const i of cells.get(key(x, y, z)) ?? []) {
              if (seen.has(i)) continue; seen.add(i); visited++;
              best = Math.min(best, pointTri(q, P[T[i][0]], P[T[i][1]], P[T[i][2]]));
            }
          }
        }
      }
      if (best <= enough || best <= r * h) break;
    }
    return { best, visited };
  };
}

test('TriGrid: the nearest triangle\'s distance, the same as a search of every triangle, from far fewer', () => {
  let s = 7; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  // (a ring of small boxes' faces, as a terrace of towers: thin in y, wide in x and z; and points inside and outside it)
  const P = [], T = [];
  for (let i = 0; i < 400; i++) {
    const a = (i / 400) * Math.PI * 2, R = 300 + rnd() * 60, y = rnd() * 40;
    const o = [Math.cos(a) * R, y, Math.sin(a) * R], b = P.length;
    P.push(o, add(o, [2 + rnd() * 3, 0, 0]), add(o, [0, 3 + rnd() * 6, 0]), add(o, [0, 0, 2 + rnd() * 3]));
    T.push([b, b + 1, b + 2], [b, b + 2, b + 3], [b, b + 3, b + 1], [b + 1, b + 3, b + 2]);
  }
  const near = triGrid(P, T);
  let visited = 0;
  for (let j = 0; j < 300; j++) {
    const q = j < 200 ? add(P[Math.floor(rnd() * P.length)], [(rnd() - 0.5) * 20, (rnd() - 0.5) * 20, (rnd() - 0.5) * 20]) : [(rnd() - 0.5) * 900, (rnd() - 0.5) * 200, (rnd() - 0.5) * 900];
    let brute = Infinity; for (const f of T) brute = Math.min(brute, pointTri(q, P[f[0]], P[f[1]], P[f[2]]));
    const g = near(q, 0);
    assert.ok(Math.abs(g.best - brute) < 1e-9, `${q}: ${g.best} against ${brute}`);
    visited += g.visited;
    // (with a worst so far: never a distance under the true one, and any answer at most `enough` only when the true one is)
    const e = brute * (0.5 + rnd());
    const ge = near(q, e).best;
    assert.ok(ge >= brute - 1e-9 && (ge <= e) === (brute <= e), `${ge} ${brute} ${e}`);
  }
  assert.ok(visited / 300 < T.length / 8, `${visited / 300} triangles a query of ${T.length}`);
});

test('the C# TriGrid is the one run above', () => {
  assert.match(lod, /h = Mathf\.Max\(size \/ 64f, Mathf\.Pow\(vol \/ Mathf\.Max\(t\.Count, 1\), 1f \/ 3f\)\);/);
  assert.match(lod, /if \(!ye && z != c\.z - r && z != c\.z \+ r\) continue;/);
  assert.match(lod, /if \(best <= enough \|\| best <= r \* h\) break;/);
  assert.match(lod, /var g = new TriGrid\(P, to\);/);
});
