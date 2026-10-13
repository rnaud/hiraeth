// The parts of a merged mesh, named for the z-fighting finder (issue #286). A world merges its pieces into a mesh a
// material (bazaar.js add, lab-kit.js RoomKit, spheres.js add …), and the finder could say no more than "Mesh#144 ×
// Mesh#146". In node, before the world is built, nameParts() notes where each geometry was made (the lines of src/
// that made it: a lazy stack, read only for what is listed) and, at every mergeGeometries, which triangles came from
// which piece; partOf(geometry, triangle) then says where a merged triangle was made, and the line's comment says
// what it is. Nothing in the game changes: the audit's hooks are on this process's three alone.
//
//   await nameParts()                        (before the world's modules load: audit.mjs, list-temple.mjs)
//   partOf(geometry, i)                      the i-th triangle's maker, a lazy { toString() } or null
//   describe(part)                           'island (space-city-kit.js:178) < … — the slab, its deck a paving plate over it'
import * as THREE from 'three';
import { register } from 'node:module';
import { readFileSync } from 'node:fs';

const MADE = new WeakMap();    // geometry -> Error (its stack, formatted when read)
const PARTS = new WeakMap();   // merged geometry -> [[first triangle, Error]…]
const OF = new WeakMap();      // a position attribute -> { made, parts } (a geometry rebuilt on a copy of another's positions keeps its maker)
let on = false;

const tris = (g) => (g.index ? g.index.count : g.attributes.position?.count ?? 0) / 3;
function stamp(g) {
  if (MADE.has(g)) return;
  const n = Error.stackTraceLimit; Error.stackTraceLimit = 40;
  const e = new Error(); Error.stackTraceLimit = n;
  MADE.set(g, e);
}

/** Note where geometries are made and what a merge is made of (node only, once). */
export async function nameParts() {
  if (on) return; on = true;
  const P = THREE.BufferGeometry.prototype;
  const setAttribute = P.setAttribute, copy = P.copy, toNonIndexed = P.toNonIndexed;
  P.setAttribute = function (name, a) {
    if (name === 'position') {
      const o = OF.get(a);
      if (o) { if (o.made) MADE.set(this, o.made); if (o.parts) PARTS.set(this, o.parts); } else { stamp(this); OF.set(a, { made: MADE.get(this) }); }
    }
    return setAttribute.call(this, name, a);
  };
  const A = THREE.BufferAttribute.prototype, clone = A.clone;
  A.clone = function () { const r = clone.call(this); if (OF.has(this)) OF.set(r, OF.get(this)); return r; };
  P.copy = function (src) { const r = copy.call(this, src); if (MADE.has(src)) MADE.set(this, MADE.get(src)); if (PARTS.has(src)) PARTS.set(this, PARTS.get(src)); return r; };
  P.toNonIndexed = function () {
    const r = toNonIndexed.call(this);
    if (MADE.has(this)) MADE.set(r, MADE.get(this));
    if (PARTS.has(this)) PARTS.set(r, PARTS.get(this));   // (the same triangles in the same order)
    if (r.attributes.position) OF.set(r.attributes.position, { made: MADE.get(r), parts: PARTS.get(r) });
    return r;
  };
  globalThis.__zfightMerged = (out, geos) => {
    if (!out) return;
    const parts = [];
    let at = 0;
    for (const g of geos) {
      const inner = PARTS.get(g);
      if (inner) for (const [k, e] of inner) parts.push([at + k, e]);
      else parts.push([at, MADE.get(g) ?? null]);
      at += tris(g);
    }
    PARTS.set(out, parts);
    if (out.attributes.position) OF.set(out.attributes.position, { made: MADE.get(out), parts });
  };
  // (mergeGeometries is an ES export: the loader hands this process a copy of three's BufferGeometryUtils that tells us)
  register('data:text/javascript,' + encodeURIComponent(`
    export async function load(url, ctx, next) {
      const r = await next(url, ctx);
      if (!url.split('?')[0].endsWith('/utils/BufferGeometryUtils.js')) return r;
      const src = String(r.source).replace('function mergeGeometries(', 'function mergeGeometries__(') +
        '\\nfunction mergeGeometries(g, u) { const r = mergeGeometries__(g, u); globalThis.__zfightMerged?.(r, g); return r; }\\n';
      return { ...r, source: src, shortCircuit: true };
    }`));
}

/** Who made the i-th triangle of this geometry (a merged one's piece, or the geometry itself): an Error or null. */
export function partOf(g, i) {
  const parts = PARTS.get(g);
  if (!parts) return MADE.get(g) ?? null;
  let lo = 0, hi = parts.length - 1;
  while (lo < hi) { const m = (lo + hi + 1) >> 1; if (parts[m][0] <= i) lo = m; else hi = m - 1; }
  return parts[lo][1];
}

const files = new Map();
const lineOf = (file, n) => { if (!files.has(file)) { try { files.set(file, readFileSync(file, 'utf8').split('\n')); } catch { files.set(file, []); } } return files.get(file)[n - 1] ?? ''; };
/** The comment that says what a line makes: its own, or the comment lines just over it (or over the line before). */
function commentOver(file, n) {
  const said = (s) => { const i = s.indexOf('//'); return i >= 0 && !/['"`]/.test(s.slice(0, i).replace(/'[^']*'|"[^"]*"|`[^`]*`/g, '')) ? s.slice(i + 2).replace(/^[\s-]+/, '').trim().replace(/^\(|\)$/g, '').slice(0, 90) : null; };
  const own = said(lineOf(file, n));
  if (own) return own;
  for (let k = n - 1; k > Math.max(0, n - 3); k--) { const s = lineOf(file, k); if (/^\s*\/\//.test(s)) return said(s); }
  return '';
}
/** A part's maker, as a short line: its frames in src/ (innermost first, up to three) and the comment over the first. */
export function describe(e) {
  if (!e) return '';
  const frames = [];
  for (const l of String(e.stack).split('\n').slice(1)) {
    const m = l.match(/at (?:(\S+) \()?(?:file:\/\/)?(\/[^)]*?\/(?:src|tests)\/([^):?]+))(?:\?[^:]*)?:(\d+):\d+\)?$/);
    if (!m) continue;
    frames.push({ fn: m[1] ?? '', path: m[2], file: m[3], line: +m[4] });
    if (frames.length >= 3) break;
  }
  if (!frames.length) return '';
  // (the line that says what the piece is: the first frame that isn't a one-line helper's (add, box, put …))
  const say = frames.find((f) => !/^(add|box|slab|beam|tube|put|cyl|sphere|mergeable|prep|clean|extruded|keep|tint)$/.test(f.fn.split('.').pop())) ?? frames[0];
  const c = commentOver(say.path, say.line);
  return frames.map((f) => `${f.fn ? f.fn.split('.').pop() + ' ' : ''}${f.file}:${f.line}`).join(' < ') + (c ? ` — ${c}` : '');
}
