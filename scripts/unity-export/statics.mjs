// The static world for the Unity port, cut and simplified the way the web game draws it (main.js at load):
//
//  - draw units as perf.js tileScene leaves them: each mesh on its own; a big one (150 k triangles) in
//    260 m tiles, a wide one (20 k, wider than 66 m) in 110 m tiles, by triangle; a big InstancedMesh
//    (300 instances, or 48 and 30 k triangles, wider than 66 m) in 110 m tiles of instances (the "small"
//    tiles: hidden past the preset's propFar, kept out of the far shadow map). Each unit is merged into
//    world space (Unity's frame) as the export always was, so the look is unchanged;
//  - each unit's levels of detail as lod.js LodManager builds them, baked: cells of 2^j units of the
//    mesh (x its world scale and its largest instance), j from the finest worth it (4 cm, r / 4000) to
//    0.35 r, by lod-core.js cluster (the seams between tiles of one mesh locked), each level kept only
//    if it drops a fifth of the triangles of the one before (and of the full one, minRatio 0.8);
//  - the small single meshes perf.js SmallCuller hides by their size on screen (radius under 3 m, not
//    self-lit);
//  - the flora (flora.js): per species its plant at full detail and in the far copy (lod.js farLevel), and
//    every plant as an instance filed by 32 m cell, with the species' distance, the reach behind for shadows, the far copy's
//    cell, small or large, shadow or none.
//
// exportStatics(...) returns { chunks, flora }: the units for world.json "chunks" (level 0 is the chunk as
// before; "lods" the coarser levels; "unit" what the Unity side needs to pick and cull it) and the flora.
import { cluster } from '../../src/lod-core.js';

const TILE = 260, PROP_TILE = 110, MIN_CELL = 0.04, SMALL_R = 3;

export function exportStatics({ THREE, scene, filter, materialOf, blob, terrainMesh = null, flora = null, noShadow = [], log = console.log }) {
  const _m = new THREE.Matrix4(), _n = new THREE.Matrix3(), _p = new THREE.Vector3(), _q = new THREE.Vector3(), _c = new THREE.Color();
  const _pos = new THREE.Vector3(), _quat = new THREE.Quaternion(), _scl = new THREE.Vector3(), _s = new THREE.Sphere(), _b = new THREE.Box3();
  const triCount = (g, group) => (group ? group.count : g.index ? g.index.count : g.attributes.position.count) / 3;
  const shadowless = new Set();
  for (const r of noShadow) r?.traverse?.((o) => shadowless.add(o));

  class Bucket {
    constructor(mat) { this.mat = mat; this.P = []; this.N = []; this.C = []; this.U = []; this.F = []; this.S = []; this.I = []; this.sway = false; this.lock = []; }
    get count() { return this.P.length / 3; }
  }
  /**
   * Append one mesh (or instance) through M into the bucket, mirrored into Unity's frame: the triangles
   * `tris` (indices into the group's range; all of them if null), only the vertices they use.
   * lockOf(v): the source vertex is on a seam (it keeps its place in every level).
   */
  function append(bk, geo, M, { color = null, group = null, swayK = 0, vertexColors = false, tris = null, lockOf = null } = {}) {
    const pa = geo.attributes.position, na = geo.attributes.normal, ca = vertexColors ? geo.attributes.color : null, ua = geo.attributes.uv, fa = geo.attributes.aFold;
    _n.getNormalMatrix(M);
    M.decompose(_pos, _quat, _scl);
    const s = Math.cbrt(Math.abs(_scl.x * _scl.y * _scl.z)) || 1;
    const idx = geo.index ? geo.index.array : null;
    const start = group ? group.start : 0, cnt = group ? group.count : (idx ? idx.length : pa.count);
    const remap = new Map();
    const vert = (i) => {
      let r = remap.get(i);
      if (r !== undefined) return r;
      r = bk.count; remap.set(i, r);
      _p.fromBufferAttribute(pa, i).applyMatrix4(M);
      bk.P.push(-_p.x, _p.y, _p.z);
      if (na) { _q.fromBufferAttribute(na, i).applyMatrix3(_n).normalize(); bk.N.push(-_q.x, _q.y, _q.z); } else bk.N.push(0, 1, 0);
      let cr = 1, cg = 1, cb = 1;
      if (ca && ca.itemSize >= 3) { cr = ca.getX(i); cg = ca.getY(i); cb = ca.getZ(i); }
      if (color) { cr *= color.r; cg *= color.g; cb *= color.b; }
      bk.C.push(cr, cg, cb);
      if (ua) bk.U.push(ua.getX(i), ua.getY(i)); else bk.U.push(0, 0);
      if (fa) bk.F.push(fa.getX(i), fa.getY(i)); else bk.F.push(0, 0);
      if (swayK) {
        // the plant's wind bend (materials.js SWAY), anchored at the instance's origin
        const y = Math.max(pa.getY(i), 0);
        bk.S.push(-_pos.x, _pos.z, swayK * y * y / s, 0.45 * Math.min(y * s, 1.4) / s);
        bk.sway = true;
      } else bk.S.push(0, 0, 0, 0);
      bk.lock.push(lockOf && lockOf(i) ? 1 : 0);
      return r;
    };
    const flip = M.determinant() < 0;   // (a mirrored object keeps its outside out)
    const one = (k) => {
      const a = idx ? idx[k] : k, b = idx ? idx[k + 1] : k + 1, c = idx ? idx[k + 2] : k + 2;
      const va = vert(a), vb = vert(b), vc = vert(c);
      // mirroring x flips the winding: swap back, unless the object was mirrored already
      if (flip) bk.I.push(va, vb, vc); else bk.I.push(va, vc, vb);
    };
    if (tris) for (const t of tris) one(start + t * 3);
    else for (let k = start; k < start + cnt; k += 3) one(k);
  }
  function writeGeo(g) {
    const out = { vertices: g.P.length / 3, indices: g.I.length };
    out.pos = blob(new Float32Array(g.P)).at; out.nrm = blob(new Float32Array(g.N)).at;
    out.col = blob(new Float32Array(g.C)).at; out.uv = blob(new Float32Array(g.U)).at;
    out.fold = blob(new Float32Array(g.F)).at;
    if (g.sway) out.sway = blob(new Float32Array(g.S)).at;
    out.idx = blob(new Uint32Array(g.I)).at;
    return out;
  }
  function boundsOf(P) {
    const mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
    for (let i = 0; i < P.length; i += 3) for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], P[i + k]); mx[k] = Math.max(mx[k], P[i + k]); }
    return [mn, mx];
  }
  const r2 = (v) => +v.toFixed(2);

  /** A unit's levels: lod-core cluster over its merged arrays, cell 2^j × sc (m), j from jmin to jmax. */
  function levels(bk, sc, jmin, jmax, stats) {
    const out = [];
    if (!(jmax >= jmin)) return out;
    const full = bk.I.length / 3;
    const packed = {
      pos: Float32Array.from(bk.P), tri: Uint32Array.from(bk.I),
      attrs: [
        { name: 'normal', itemSize: 3, array: Float32Array.from(bk.N) }, { name: 'color', itemSize: 3, array: Float32Array.from(bk.C) },
        { name: 'uv', itemSize: 2, array: Float32Array.from(bk.U) }, { name: 'aFold', itemSize: 2, array: Float32Array.from(bk.F) },
        ...(bk.sway ? [{ name: 'sway', itemSize: 4, array: Float32Array.from(bk.S) }] : []),
      ],
      lock: bk.lock.some((x) => x) ? Uint8Array.from(bk.lock) : null,
    };
    let prev = full;
    for (let j = jmin; j <= jmax; j++) {
      const t0 = Date.now();
      const r = cluster(packed, 2 ** j * sc, 0.8);
      stats.ms += Date.now() - t0;
      if (!r || r.tris > prev * 0.8) continue;   // (not worth it: too close to the level before)
      const A = (n) => r.attrs.find((a) => a.name === n)?.array;
      const g = { P: r.pos, N: A('normal'), C: A('color'), U: A('uv'), F: A('aFold'), S: A('sway'), I: r.index, sway: bk.sway };
      out.push({ j, ...writeGeo(g) });
      stats.levels++; stats.tris += r.tris;
      prev = r.tris;
    }
    return out;
  }

  // ---- 1. the draw units (perf.js tileScene's rules)
  const units = [];
  const unitOf = (mat, kind, extra = {}) => { const u = { bk: new Bucket(mat), kind, ...extra }; units.push(u); return u; };
  const instScale = (o) => {
    let s = 0; const M = new THREE.Matrix4();
    for (let i = 0; i < o.count; i++) { o.getMatrixAt(i, M); M.decompose(_pos, _quat, _scl); s = Math.max(s, Math.abs(_scl.x), Math.abs(_scl.y), Math.abs(_scl.z)); }
    return s || 1;
  };
  scene.updateMatrixWorld(true);
  scene.traverse((o) => {
    if (!o.isMesh || o === terrainMesh || !filter(o) || o.userData.flora) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    const geo = o.geometry;
    if (!geo?.attributes?.position) return;
    if (!geo.attributes.normal) geo.computeVertexNormals();
    const groups = Array.isArray(o.material) && geo.groups.length ? geo.groups : [null];
    if (!geo.boundingSphere) geo.computeBoundingSphere();
    const k = o.matrixWorld.getMaxScaleOnAxis();
    const noShadowHere = shadowless.has(o);
    // (lod.js collect: single-material meshes, no morphs, not flagged dynamic)
    const lodable = !Array.isArray(o.material) && !Object.keys(geo.morphAttributes ?? {}).length && !o.userData.dynamic && (geo.groups?.length ?? 0) <= 1 && !o.userData.noLod
      && o.material?.allowOverride !== false && !o.material?.wireframe;
    for (const g of groups) {
      const m = g ? mats[g.materialIndex] : mats[0];
      if (!m || m.visible === false) continue;
      if (m.type === 'ShaderMaterial' && !m.uniforms?.uMode && !m.uniforms?.uColor) continue;   // the tree's fire shells (exported as flames), the approach planet
      if (m.defines?.CROWD) continue;
      const id = materialOf(m);
      const sway = m.uniforms?.uSway?.value ?? 0;
      const glow = m.uniforms?.uGlow?.value ?? 0;
      const each = triCount(geo, g);
      const opts = { group: g, swayK: sway, vertexColors: !!m.vertexColors };
      const r = geo.boundingSphere?.radius ?? 0;
      const common = { glow, shadow: !noShadowHere && glow < 0.8, drawFar: o.userData.drawFar ?? null, lodable: lodable && each >= 48, r, sc: k, src: o };
      if (o.isInstancedMesh) {
        if (!o.count) continue;
        const total = o.count * each;
        o.computeBoundingSphere();
        const spread = o.boundingSphere.radius * k;
        const inst = instScale(o);
        const tiled = (o.count > 300 || (o.count >= 48 && total >= 30000)) && spread > PROP_TILE * 0.6;
        const M = new THREE.Matrix4(), byTile = new Map();
        for (let i = 0; i < o.count; i++) {
          o.getMatrixAt(i, M); M.premultiply(o.matrixWorld);
          _p.setFromMatrixPosition(M);
          const key = tiled ? `${Math.floor(_p.x / PROP_TILE)},${Math.floor(_p.z / PROP_TILE)}` : 'all';
          let u = byTile.get(key);
          if (!u) byTile.set(key, (u = unitOf(id, tiled ? 'itile' : 'inst', { ...common, sc: k * inst, small: tiled, lodable: common.lodable && total >= 400 })));
          if (o.instanceColor) o.getColorAt(i, _c);
          append(u.bk, geo, M.clone(), { ...opts, color: o.instanceColor ? _c.clone() : null });
        }
      } else {
        const spread = r * k;
        const size = each >= 150000 ? TILE : each >= 20000 && spread > PROP_TILE * 0.6 ? PROP_TILE : 0;
        if (!size) {
          unitOf(id, 'mesh', { ...common, lodable: common.lodable && each >= 400, prop: spread < SMALL_R && glow < 0.8 && o.frustumCulled !== false ? spread : 0 });
          append(units[units.length - 1].bk, geo, o.matrixWorld, opts);
          continue;
        }
        // tiles by triangle (tileTriangles), the vertices on their seams locked
        const pa = geo.attributes.position, idx = geo.index ? geo.index.array : null;
        const start = g ? g.start : 0, cnt = g ? g.count : (idx ? idx.length : pa.count);
        const byTile = new Map(), owner = new Int32Array(pa.count).fill(-1), seam = new Uint8Array(pa.count);
        let tileN = 0; const tileId = new Map();
        for (let t = 0, k3 = start; k3 < start + cnt; k3 += 3, t++) {
          const a = idx ? idx[k3] : k3, b = idx ? idx[k3 + 1] : k3 + 1, c = idx ? idx[k3 + 2] : k3 + 2;
          _p.fromBufferAttribute(pa, a).add(_q.fromBufferAttribute(pa, b)).add(_q.fromBufferAttribute(pa, c)).multiplyScalar(1 / 3).applyMatrix4(o.matrixWorld);
          const key = `${Math.floor(_p.x / size)},${Math.floor(_p.z / size)}`;
          let list = byTile.get(key);
          if (!list) { byTile.set(key, (list = [])); tileId.set(key, tileN++); }
          list.push(t);
          const ti = tileId.get(key);
          for (const v of [a, b, c]) { if (owner[v] < 0) owner[v] = ti; else if (owner[v] !== ti) seam[v] = 1; }
        }
        for (const [, list] of byTile) {
          const u = unitOf(id, 'tile', { ...common, lodable: common.lodable && list.length >= 48 });
          append(u.bk, geo, o.matrixWorld, { ...opts, tris: list, lockOf: byTile.size > 1 ? (v) => seam[v] : null });
        }
      }
    }
  });

  // ---- 2. the flora (flora.js Flora): per species its plant (full and far copy, in its own space) and every
  // plant as an instance (a 3 x 4 matrix and a tint, in Unity's frame), filed by 32 m cell: the Unity side
  // draws each species' cells in view within its distance as the web does (one draw, and one for the far copies)
  const floraOut = [];
  let fullFlora = 0;
  const S = new THREE.Matrix4().makeScale(-1, 1, 1), I4 = new THREE.Matrix4();
  for (const set of flora?.sets ?? []) {
    const sp = set.sp, m = set.mesh, M = new THREE.Matrix4();
    const id = materialOf(sp.mat);
    const farGeo = set.lod?.mesh?.geometry ?? null;
    const vc = !!sp.mat.vertexColors;
    const full = new Bucket(id); append(full, sp.geo, I4, { vertexColors: vc });
    const far = farGeo ? new Bucket(id) : null; if (far) append(far, farGeo, I4, { vertexColors: vc });
    const rows = [], cols = [], cells = [];
    for (const cell of set.cells) {
      const start = rows.length / 12;
      for (const i of cell.ids) {
        M.fromArray(set.M, i * 16).premultiply(m.matrixWorld);
        const U = new THREE.Matrix4().multiplyMatrices(S, M).multiply(S).elements;   // (column-major)
        for (let r = 0; r < 3; r++) rows.push(U[r], U[4 + r], U[8 + r], U[12 + r]);
        cols.push(set.C[i * 3], set.C[i * 3 + 1], set.C[i * 3 + 2]);
      }
      cells.push({ c: [-cell.c.x, cell.c.y, cell.c.z].map(r2), r: r2(cell.r), start, count: cell.ids.length });
    }
    floraOut.push({ species: sp.id, material: id, sway: sp.mat.uniforms?.uSway?.value ?? 0, far: set.far, behind: set.behind, lodCell: +(set.lod?.cell ?? 0).toFixed(4),
      small: sp.large ? 0 : 1, shadow: sp.shadow === false ? 0 : 1, count: rows.length / 12,
      geo: writeGeo(full), farGeo: far ? writeGeo(far) : null, rows: blob(new Float32Array(rows)).at, cols: blob(new Float32Array(cols)).at, cells });
    fullFlora += full.I.length / 3 * (rows.length / 12);
  }

  // ---- 3. written: level 0 as the chunk it always was, the coarser levels, what the Unity side picks them by
  const stats = { ms: 0, levels: 0, tris: 0 };
  const out = [];
  let full = 0;
  const kinds = {};
  for (const u of units) {
    if (!u.bk.I.length) continue;
    const g = writeGeo(u.bk);
    const [mn, mx] = boundsOf(u.bk.P);
    const c = [(mn[0] + mx[0]) / 2, (mn[1] + mx[1]) / 2, (mn[2] + mx[2]) / 2];
    let rad = 0;
    for (let i = 0; i < u.bk.P.length; i += 3) rad = Math.max(rad, Math.hypot(u.bk.P[i] - c[0], u.bk.P[i + 1] - c[1], u.bk.P[i + 2] - c[2]));
    const tris = u.bk.I.length / 3;
    full += tris;
    // (lod.js collect: e.min / e.max in the mesh's own units; levels finer than 4 cm save nothing)
    let lods = [], jmin = 0, jmax = -1;
    if (u.lodable && tris >= 400) {   // (lod.js: minTris 400, minEach 48)
      const rr = u.kind === 'tile' ? rad / u.sc : u.r;   // (a tile: its own bounds, as tileTriangles gave it)
      jmin = Math.max(Math.floor(Math.log2(Math.max(rr / 4000, 1e-4))), Math.floor(Math.log2(MIN_CELL / u.sc)));
      jmax = Math.floor(Math.log2(Math.max(rr * 0.35, 1e-4)));
      lods = levels(u.bk, u.sc, jmin, jmax, stats);
    }
    kinds[u.kind] = (kinds[u.kind] ?? 0) + 1;
    out.push({
      material: u.bk.mat, ...g, bounds: [...mn, ...mx].map(r2),
      unit: { kind: u.kind, sphere: [...c, rad].map(r2), sc: +u.sc.toFixed(5), shadow: u.shadow ? 1 : 0, small: u.small ? 1 : 0, prop: u.prop ? r2(u.prop) : 0, drawFar: u.drawFar ?? 0,
        ...(lods.length ? { jmin, jmax } : {}) },
      ...(lods.length ? { lods } : {}),
    });
  }
  log(`static: ${out.length} units (${Object.entries(kinds).map(([k, n]) => `${n} ${k}`).join(', ')}), ${full} triangles; ${stats.levels} levels (${stats.tris} triangles) in ${stats.ms} ms; flora: ${floraOut.length} species, ${floraOut.reduce((s, f) => s + f.count, 0)} plants, ${fullFlora} triangles`);
  return { chunks: out, flora: floraOut };
}
