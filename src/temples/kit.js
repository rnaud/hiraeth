import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeMaterial, MODE_STRATA } from '../materials.js';
import { glyphGeometry } from '../story/sign-text.js';

// The makers' architecture, as modular pieces: halls with doorways cut in
// their walls, round halls (rotundas) under an oculus, stairs, ramps,
// bridges, shafts, columns, ledges, a glyph frieze. Every temple (src/temples/<world>.js)
// is drawn with these, in its own world's palette, and inked like everything
// else (flat colours; the post pass draws the lines).
//
//   const K = new TempleKit(root, 'The Givers’ house', origin, yaw, palette);
//   K.hall({ x, z, w, d, y, h, doors: [{ side: 'n', at: 0, w: 5, h: 6 }], roof: 'oculus' })
//   K.rotunda({ x, z, y, r, h, gaps: [{ a: 0, w: 5, h: 6 }] })
//   K.stairs([x, y, z], [x, y, z], w) · K.ramp(a, b, w) · K.slab(x0, z0, x1, z1, y, t) · K.column(x, z, y, h, r)
//   K.frieze(a, b, y) (glyphs along a wall) · K.glyph([x, y, z], size, yaw)
//   K.flush()   the batched meshes (noCollide) and one hidden collision proxy
//
// Local frame: y up, +z into the temple from its entrance; metres. Render
// meshes are merged per material and never collide; collision comes from the
// proxies (the same boxes, coarser where it helps). Moving parts (doors,
// drums, platforms, bridges) are pieces (pieces.js), not part of the kit.

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const UP = V(0, 1, 0);
const PROXY = new THREE.MeshBasicMaterial({ color: '#ff00ff' });
const _q = new THREE.Quaternion(), _m = new THREE.Matrix4(), _e = new THREE.Euler();

export function prep(g) {
  let geo = g.index ? g.toNonIndexed() : g;
  if (!geo.attributes.normal) geo.computeVertexNormals();
  for (const k of Object.keys(geo.attributes)) if (k !== 'position' && k !== 'normal') geo.deleteAttribute(k);
  return geo;
}
/** rotate (XYZ Euler), scale, then move, in place */
export function T(geo, p = [0, 0, 0], r = [0, 0, 0], s = 1, order = 'XYZ') {
  _q.setFromEuler(_e.set(r[0], r[1], r[2], order));
  return geo.applyMatrix4(_m.compose(V(...p), _q, typeof s === 'number' ? V(s, s, s) : V(...s)));
}
export const box = (w, h, d, x = 0, y = 0, z = 0, ry = 0) => T(new THREE.BoxGeometry(w, h, d), [x, y, z], [0, ry, 0]);
export const lathe = (pts, seg = 20) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(Math.max(r, 0.001), y)), seg);
/** A flat ring r0..r1, `t` thick, its top at y = 0 (a ceiling round an oculus, a ledge round a shaft). */
export function annulus(r0, r1, t = 0.6, seg = 32) {
  const s = new THREE.Shape();
  s.absarc(0, 0, r1, 0, Math.PI * 2, false);
  const h = new THREE.Path();
  h.absarc(0, 0, r0, 0, Math.PI * 2, true);
  s.holes.push(h);
  const g = new THREE.ExtrudeGeometry(s, { depth: t, bevelEnabled: false, curveSegments: seg });
  return g.rotateX(Math.PI / 2);   // (x, y) -> (x, z); the extrusion goes down from y = 0
}
/** An arc of a ring, a0..a1 (radians round +y from +x toward +z), r0..r1, top at y = 0. */
export function sector(r0, r1, a0, a1, t = 0.6) {
  const s = new THREE.Shape();
  s.moveTo(Math.cos(a0) * r1, Math.sin(a0) * r1);
  s.absarc(0, 0, r1, a0, a1, false);
  s.lineTo(Math.cos(a1) * r0, Math.sin(a1) * r0);
  s.absarc(0, 0, r0, a1, a0, true);
  const g = new THREE.ExtrudeGeometry(s, { depth: t, bevelEnabled: false, curveSegments: Math.max(6, Math.ceil((a1 - a0) * 12)) });
  return g.rotateX(Math.PI / 2);
}

// Plain colours are paint: one vertex-coloured mesh for all of a temple's plain parts.
const PAINT = {};
const paintMaterial = (smooth, side) => PAINT[`${smooth}${side}`] ??= makeMaterial({ color: '#ffffff', vertexColors: true, ...(smooth ? {} : { flat: true }), ...(side === THREE.DoubleSide ? { side } : {}) });
export const paint = (color, { smooth = false, side = THREE.FrontSide } = {}) => ({ paint: new THREE.Color(color), smooth, side });
function painted(geo, c) {
  const n = geo.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
  geo.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return geo;
}

/**
 * A world's temple materials from its palette:
 *   { wall, wall2, wall3, floor, floor2, trim, dark, stone, glow (the glyphs' light), accent, sand }
 */
export function templeMaterials(P) {
  return {
    wall: makeMaterial({ color: P.wall, color2: P.wall2 ?? P.wall, color3: P.wall3 ?? P.wall, mode: MODE_STRATA, strataSize: P.strata ?? 2.2, flat: true }),
    wallGlyph: makeMaterial({ color: P.wall, color2: P.wall2 ?? P.wall, color3: P.wall3 ?? P.wall, mode: MODE_STRATA, strataSize: 1.2, flat: true, grid: 1.6, glyphs: true }),
    floor: makeMaterial({ color: P.floor, color2: P.floor2 ?? P.floor, color3: P.floor2 ?? P.floor, mode: MODE_STRATA, strataSize: 0.9, flat: true, grid: 2.4 }),
    trim: paint(P.trim),
    trimMat: makeMaterial({ color: P.trim, flat: true }),
    stoneMat: makeMaterial({ color: P.stone ?? P.trim, color2: P.wall2 ?? P.trim, color3: P.stone ?? P.trim, mode: MODE_STRATA, strataSize: 0.7, flat: true }),
    dark: paint(P.dark),
    stone: paint(P.stone ?? P.trim),
    accent: paint(P.accent ?? P.trim),
    sand: makeMaterial({ color: P.sand ?? '#e8cf9c', color2: P.sand2 ?? '#dcbd86', color3: P.sand ?? '#e8cf9c', mode: MODE_STRATA, strataSize: 0.5, flat: true, sandInk: true }),
    ink: paint('#2b211f'),
    glyph: makeMaterial({ color: P.glow ?? '#70e7df', glow: 0.85, flat: true }),
    voidM: makeMaterial({ color: P.void ?? '#2b211f', side: THREE.DoubleSide }),
  };
}

export class TempleKit {
  constructor(root, name, origin, yaw = 0, materials = null) {
    this.group = new THREE.Group(); this.group.name = name; root.add(this.group);
    this.origin = origin.clone(); this.yaw = yaw;
    this.frame = new THREE.Matrix4().compose(origin, new THREE.Quaternion().setFromAxisAngle(UP, yaw), V(1, 1, 1));
    this.inv = this.frame.clone().invert();
    this.batches = new Map(); this.proxies = [];
    this.M = materials;
  }
  /** local -> world */
  world(x, y, z) { return V(x, y, z).applyMatrix4(this.frame); }
  /** world -> local */
  local(p) { return p.clone().applyMatrix4(this.inv); }
  heading(h) { return h + this.yaw; }
  add(mat, geo) {
    let g = prep(geo).applyMatrix4(this.frame);
    if (mat.paint) { g = painted(g, mat.paint); mat = paintMaterial(mat.smooth, mat.side); }
    if (!this.batches.has(mat)) this.batches.set(mat, []);
    this.batches.get(mat).push(g);
    return this;
  }
  solid(geo) { this.proxies.push(prep(geo).applyMatrix4(this.frame)); return this; }
  // (the proxy is cloned first: add() moves a non-indexed geometry into the world in place)
  both(mat, geo, proxy) { const p = proxy ?? geo.clone(); this.add(mat, geo); this.solid(p); return this; }
  flush() {
    const meshes = [];
    for (const [mat, list] of this.batches) {
      const m = new THREE.Mesh(mergeGeometries(list), mat);
      // (named by its material, so an audit's report says which: src/contact-audit.js)
      const key = this.M ? Object.keys(this.M).find((k) => this.M[k] === mat) : null;
      m.userData.noCollide = true; m.name = `${this.group.name} (${key ?? 'painted'}, ${list.length})`;
      this.group.add(m); meshes.push(m);
    }
    if (this.proxies.length) {
      const c = new THREE.Mesh(mergeGeometries(this.proxies), PROXY);
      c.visible = false; c.name = `${this.group.name} collision`;
      this.group.add(c);
    }
    this.batches.clear(); this.proxies = [];
    return meshes;
  }

  // ---------------------------------------------------------------- pieces
  /** A floor slab, its top at y. */
  slab(x0, z0, x1, z1, y = 0, t = 0.8, mat = this.M.floor) {
    const w = Math.abs(x1 - x0), d = Math.abs(z1 - z0);
    return this.both(mat, box(w, t, d, (x0 + x1) / 2, y - t / 2, (z0 + z1) / 2));
  }
  /**
   * A straight wall from (ax, az) to (bx, bz), from y0 up h, t thick, with
   * holes [{ at: metres from a to the hole's centre, w, y0 (from the wall's foot), h }].
   */
  wall(ax, az, bx, bz, y0, h, { t = 1.2, holes = [], mat = this.M.wall, cap = true, ext = 0 } = {}) {
    let L = Math.hypot(bx - ax, bz - az);
    const dir = [(bx - ax) / L, (bz - az) / L], ry = Math.atan2(-dir[1], dir[0]);
    // ext: both ends run on by that much (a hall's corners close), holes keep their place from a
    if (ext) { ax -= dir[0] * ext; az -= dir[1] * ext; L += 2 * ext; holes = holes.map((o) => ({ ...o, at: o.at + ext })); }
    // a block of the wall: centred s metres along it, from y up hgt, w long (thick: a little proud of the wall, for trim)
    const at = (s, y, hgt, w, thick = t) => box(w, hgt, thick, ax + dir[0] * s, y0 + y + hgt / 2, az + dir[1] * s, ry);
    const H = holes.map((o) => ({ x0: o.at - o.w / 2, x1: o.at + o.w / 2, y0: o.y0 ?? 0, y1: (o.y0 ?? 0) + o.h }));
    const xs = [0, L, ...H.flatMap((o) => [o.x0, o.x1])].filter((x) => x >= 0 && x <= L).sort((a, b) => a - b);
    for (let i = 0; i < xs.length - 1; i++) {
      const a = xs[i], b = xs[i + 1];
      if (b - a < 1e-3) continue;
      const mid = (a + b) / 2;
      const cut = H.filter((o) => o.x0 <= mid && o.x1 >= mid).sort((p, q) => p.y0 - q.y0);
      let y = 0;
      for (const o of [...cut, { y0: h, y1: h }]) {
        if (o.y0 - y > 1e-3) this.both(mat, at(mid, y, o.y0 - y, b - a));
        y = Math.max(y, o.y1);
      }
    }
    // a lintel line of trim along the top, and the doorways' frames (solid: they stand proud of the wall, and a
    // climber's hands and head met them drawn but not felt: src/contact-audit.js)
    if (cap) this.both(this.M.trim, at(L / 2, h - 0.25, 0.5, L + 0.02, t + 0.24));
    for (const o of H) {
      if (o.y1 < h - 0.3) this.both(this.M.trim, at((o.x0 + o.x1) / 2, o.y1, 0.45, o.x1 - o.x0 + 1.2, t + 0.24));
      for (const s of [o.x0 - 0.3, o.x1 + 0.3]) this.both(this.M.trim, at(s, o.y0, o.y1 - o.y0, 0.6, t + 0.24));
    }
    return this;
  }
  /**
   * A rectangular hall centred on (x, z), floor at y: w (along x) by d (along z), h high.
   * doors: [{ side: 'n' (+z) | 's' (-z) | 'e' (+x) | 'w' (-x), at: offset from the side's middle, w, h, y0 }]
   * roof: true (shut), 'oculus' (a square opening over the middle), false (open to the sky)
   */
  hall({ x = 0, z = 0, w, d, y = 0, h, doors = [], roof = true, oculus = 0.35, floor = true, t = 1.2, columns = 0, frieze = true, omit = [] }) {
    const x0 = x - w / 2, x1 = x + w / 2, z0 = z - d / 2, z1 = z + d / 2;
    if (floor) this.slab(x0 - t / 2, z0 - t / 2, x1 + t / 2, z1 + t / 2, y);
    const holes = (side, L) => doors.filter((o) => o.side === side).map((o) => ({ at: L / 2 + (o.at ?? 0), w: o.w, h: o.h, y0: o.y0 ?? 0 }));
    const half = t / 2;
    const W = (side, ...a) => { if (!omit.includes(side)) this.wall(...a); };
    W('n', x0 - half, z1 + half, x1 + half, z1 + half, y, h, { t, ext: half, holes: holes('n', w + t) });
    W('s', x1 + half, z0 - half, x0 - half, z0 - half, y, h, { t, ext: half, holes: holes('s', w + t).map((o) => ({ ...o, at: w + t - o.at })) });
    W('e', x1 + half, z1 + half, x1 + half, z0 - half, y, h, { t, ext: half, holes: holes('e', d + t).map((o) => ({ ...o, at: d + t - o.at })) });
    W('w', x0 - half, z0 - half, x0 - half, z1 + half, y, h, { t, ext: half, holes: holes('w', d + t) });
    if (roof) {
      const ry = y + h + 0.4;
      if (roof === 'oculus') {
        const ow = w * oculus, od = d * oculus;
        this.both(this.M.wall, box(w + 2 * t, 0.8, (d - od) / 2 + t, x, ry, z0 - t + ((d - od) / 2 + t) / 2));
        this.both(this.M.wall, box(w + 2 * t, 0.8, (d - od) / 2 + t, x, ry, z1 + t - ((d - od) / 2 + t) / 2));
        this.both(this.M.wall, box((w - ow) / 2 + t, 0.8, od, x0 - t + ((w - ow) / 2 + t) / 2, ry, z));
        this.both(this.M.wall, box((w - ow) / 2 + t, 0.8, od, x1 + t - ((w - ow) / 2 + t) / 2, ry, z));
      } else this.both(this.M.wall, box(w + 2 * t, 0.8, d + 2 * t, x, ry, z));
    }
    if (columns) {
      for (let i = 0; i < columns; i++) {
        const cz = z0 + ((i + 0.5) / columns) * d;
        this.column(x0 + 1.6, cz, y, h, 0.7);
        this.column(x1 - 1.6, cz, y, h, 0.7);
      }
    }
    if (frieze) {
      this.frieze([x0 + 0.02, z0 + 2], [x0 + 0.02, z1 - 2], y + h * 0.72, 'e');
      this.frieze([x1 - 0.02, z0 + 2], [x1 - 0.02, z1 - 2], y + h * 0.72, 'w');
    }
    return this;
  }
  /**
   * A round hall centred on (x, z), floor at y, radius r, h high: a polygonal wall
   * of `seg` stones with gaps [{ a: angle (0 = +z, toward +x), w, h, y0 }], and an
   * annular ceiling round an oculus (oculus: its radius as a share of r; 0 shuts it).
   */
  rotunda({ x = 0, z = 0, y = 0, r, h, gaps = [], seg = 28, t = 1.4, oculus = 0.38, floor = true, frieze = true }) {
    if (floor) this.both(this.M.floor, T(new THREE.CylinderGeometry(r + t, r + t, 0.8, seg), [x, y - 0.4, z]));
    const step = (Math.PI * 2) / seg, chord = 2 * (r + t / 2) * Math.sin(step / 2) + 0.05;
    for (let i = 0; i < seg; i++) {
      const a = (i + 0.5) * step;
      const px = x + Math.sin(a) * (r + t / 2), pz = z + Math.cos(a) * (r + t / 2);
      // a gap: this stone is cut from the floor to the gap's height
      // a gap: this stone is cut from the gap's foot (y0, default the floor) to its top
      const gap = gaps.find((g) => Math.abs(Math.atan2(Math.sin(a - g.a), Math.cos(a - g.a))) * (r + t / 2) < g.w / 2);
      const spans = gap ? [[0, gap.y0 ?? 0], [(gap.y0 ?? 0) + gap.h, h]] : [[0, h]];
      for (const [s0, s1] of spans) if (s1 - s0 > 0.05) this.both(this.M.wall, T(new THREE.BoxGeometry(chord, s1 - s0, t), [px, y + s0 + (s1 - s0) / 2, pz], [0, a, 0]));
    }
    // the trim at the top, round the hall (solid: it overhangs the wall's outer face by 0.4 m, and a
    // climber used to hug the wall inside the drawn stone)
    this.both(this.M.trim, T(annulus(r - 0.1, r + t + 0.4, 0.5, seg * 2), [x, y + h, z]));
    if (oculus > 0) {
      this.both(this.M.wall, T(annulus(r * oculus, r + t, 0.9, seg * 2), [x, y + h + 0.9, z]));
      // the trim round the oculus: solid where it lies on the ceiling, as drawn; the 0.3 m it overhangs the
      // opening stays drawn-only, so the oculus is as wide to the collision as the ceiling's hole (solid, the
      // lip caught what is dropped or flown up through the oculus)
      this.both(this.M.trim, T(annulus(r * oculus - 0.3, r * oculus + 0.4, 0.4, seg * 2), [x, y + h + 1.1, z]), T(annulus(r * oculus, r * oculus + 0.4, 0.4, seg * 2), [x, y + h + 1.1, z]));
    } else if (oculus === 0) this.both(this.M.wall, T(new THREE.CylinderGeometry(r + t, r + t, 0.9, seg), [x, y + h + 0.45, z]));
    if (frieze) for (let i = 0; i < seg; i += 2) {
      const a = (i + 0.5) * step;
      if (gaps.some((g) => Math.abs(Math.atan2(Math.sin(a - g.a), Math.cos(a - g.a))) * r < g.w / 2 + 1)) continue;
      this.glyph([x + Math.sin(a) * (r - 0.03), y + h * 0.7, z + Math.cos(a) * (r - 0.03)], 1.1, a + Math.PI);
    }
    return this;
  }
  /** Straight stairs from a (the bottom's middle) to b (the top's middle), w wide, steps no taller than `rise`. */
  stairs(a, b, w, { rise = 0.32, mat = this.M.floor, sides = true } = {}) {
    const dy = b[1] - a[1], n = Math.max(1, Math.ceil(Math.abs(dy) / rise));
    const dx = b[0] - a[0], dz = b[2] - a[2], L = Math.hypot(dx, dz), yaw = Math.atan2(dx, dz);
    for (let i = 0; i < n; i++) {
      const k0 = i / n, k1 = (i + 1) / n, top = a[1] + dy * k1;
      const run = L / n, cx = a[0] + dx * (k0 + k1) / 2, cz = a[2] + dz * (k0 + k1) / 2;
      const hgt = Math.max(0.3, top - Math.min(a[1], b[1]) + 0.4);
      this.both(mat, T(new THREE.BoxGeometry(w, hgt, run + 0.02), [cx, top - hgt / 2, cz], [0, yaw, 0]));
    }
    if (sides) for (const s of [-1, 1]) {
      const ox = Math.cos(yaw) * (w / 2 + 0.3) * s, oz = -Math.sin(yaw) * (w / 2 + 0.3) * s;
      this.both(this.M.trim, T(new THREE.BoxGeometry(0.6, 0.6, Math.hypot(L, dy)), [(a[0] + b[0]) / 2 + ox, (a[1] + b[1]) / 2 + 0.3, (a[2] + b[2]) / 2 + oz], [-Math.atan2(dy, L), yaw, 0], 1, 'YXZ'));
    }
    return this;
  }
  /** A ramp (a tilted slab) from a to b, w wide. */
  ramp(a, b, w, { t = 0.6, mat = this.M.floor } = {}) {
    const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], L = Math.hypot(dx, dz);
    const len = Math.hypot(L, dy);
    return this.both(mat, T(new THREE.BoxGeometry(w, t, len), [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2 - t / 2, (a[2] + b[2]) / 2], [-Math.atan2(dy, L), Math.atan2(dx, dz), 0], 1, 'YXZ'));
  }
  /** A bridge: a walkway from a to b at their height, with low parapets. */
  bridge(a, b, w, { parapet = 0.9 } = {}) {
    this.ramp(a, b, w, { t: 0.7 });
    const dx = b[0] - a[0], dz = b[2] - a[2], L = Math.hypot(dx, dz), yaw = Math.atan2(dx, dz);
    for (const s of [-1, 1]) {
      const ox = Math.cos(yaw) * (w / 2 - 0.2) * s, oz = -Math.sin(yaw) * (w / 2 - 0.2) * s;
      this.both(this.M.trim, T(new THREE.BoxGeometry(0.4, parapet, L), [(a[0] + b[0]) / 2 + ox, (a[1] + b[1]) / 2 + parapet / 2, (a[2] + b[2]) / 2 + oz], [-Math.atan2(b[1] - a[1], L), yaw, 0], 1, 'YXZ'));
    }
    return this;
  }
  /** A round shaft (a well of stone) from y0 to y1, open at the top: its wall only. */
  shaft(x, z, r, y0, y1, { t = 1.2, seg = 20, gaps = [] } = {}) {
    return this.rotunda({ x, z, y: y0, r, h: y1 - y0, gaps, seg, t, oculus: -1, floor: false, frieze: false });
  }
  column(x, z, y, h, r = 0.7, { mat = this.M.trim } = {}) {
    // (its own lathe collides: a plain cylinder inside the drawn base and capital let you walk into them)
    this.both(mat, lathe([[r * 1.35, 0], [r * 1.35, 0.6], [r, 0.9], [r * 0.92, h - 1], [r * 1.3, h - 0.6], [r * 1.4, h]], 12).translate(x, y, z));
    return this;
  }
  /** A ledge (a shelf) along a wall: a slab, its top at y. */
  ledge(x0, z0, x1, z1, y, t = 0.9) { return this.slab(x0, z0, x1, z1, y, t, this.M.floor); }
  /** The makers' glyph, glowing, at p, facing `yaw` (0 = +z). */
  glyph(p, size = 1, yaw = 0) {
    return this.add(this.M.glyph, T(glyphGeometry(size, 0.12), [p[0], p[1], p[2]], [0, yaw, 0]));
  }
  /** A row of glyphs along a wall from a to b ([x, z]) at height y, facing into the room ('n' 's' 'e' 'w' = toward +z -z +x -x). */
  frieze(a, b, y, facing = 'n', every = 4.5) {
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.floor(L / every));
    const yaw = { n: 0, s: Math.PI, e: Math.PI / 2, w: -Math.PI / 2 }[facing] ?? 0;
    for (let i = 0; i <= n; i++) {
      const k = n ? i / n : 0.5;
      this.glyph([a[0] + (b[0] - a[0]) * k, y, a[1] + (b[1] - a[1]) * k], 1.0, yaw);
    }
    return this;
  }
}
