import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeMaterial } from './materials.js';

// The shops' small kit (docs/systems/interiors.md, "A shop in every world"): the pieces every world's shopfront
// (src/shop-fronts.js) and every shop's room (src/shop-world.js) are drawn with, and the buckets that merge them.
//
//   const B = buckets();
//   B.add('#e8d9c4', geo)                          a solid piece in that colour (one merged mesh a colour)
//   B.add('#5fb7ad', geo, { soft: true })          walked through (noCollide): trim, cloth, wares
//   B.add('#70e7df', geo, { soft: true, glow: 0.7 })
//   B.add(null, crystalGeometry(...))              a chime crystal (the shared crystal look)
//   B.build(group)                                 one mesh a bucket, added to the group
//
// Shapes (all in metres, y up): heartShape, archShape(w, h), archWall(w, h, T, hole), lathe(pts), flask, vial,
// bell, feather, gear, bulb.

/** Only position and normal (and a crystal's colour and its own attribute): what merging needs from every piece. */
function tidy(g, keep = ['position', 'normal']) {
  let out = g.index ? g.toNonIndexed() : g;
  if (!out.attributes.normal) out.computeVertexNormals();
  for (const k of Object.keys(out.attributes)) if (!keep.includes(k)) out.deleteAttribute(k);
  return out;
}

/** Pieces sorted by look, merged into one mesh each. */
export function buckets() {
  const map = new Map();
  return {
    map,
    /** A piece: its colour (null: a chime crystal), and { soft (walked through), glow, mode / extra material options, side }. */
    add(color, geo, o = {}) {
      if (!geo) return;
      const key = color === null ? 'crystal' : JSON.stringify({ color, ...o });
      if (!map.has(key)) map.set(key, { color, o, geos: [] });
      map.get(key).geos.push(geo);
    },
    /** One mesh a bucket under `group`; returns the meshes. */
    build(group) {
      const out = [];
      for (const { color, o, geos } of map.values()) {
        const crystal = color === null;
        const keep = crystal ? Object.keys(geos[0].attributes) : ['position', 'normal'];
        const geo = mergeGeometries(geos.map((g) => tidy(g, keep)));
        if (!geo) continue;
        const { soft, ...mo } = o;
        const mat = crystal ? makeMaterial({ color: '#ffffff', vertexColors: true, glow: 0.5, key: 'chime-crystal' }) : makeMaterial({ color, flat: true, ...mo });
        const mesh = new THREE.Mesh(geo, mat);
        if (soft || crystal) mesh.userData.noCollide = true;
        group.add(mesh);
        out.push(mesh);
      }
      return out;
    },
  };
}

/** A heart's outline, about 1 m across (centred, point down). */
export function heartShape() {
  const s = new THREE.Shape();
  s.moveTo(0, -0.5);
  s.bezierCurveTo(-0.1, -0.38, -0.5, -0.12, -0.5, 0.14);
  s.bezierCurveTo(-0.5, 0.38, -0.32, 0.5, -0.2, 0.5);
  s.bezierCurveTo(-0.08, 0.5, 0, 0.42, 0, 0.32);
  s.bezierCurveTo(0, 0.42, 0.08, 0.5, 0.2, 0.5);
  s.bezierCurveTo(0.32, 0.5, 0.5, 0.38, 0.5, 0.14);
  s.bezierCurveTo(0.5, -0.12, 0.1, -0.38, 0, -0.5);
  return s;
}
/** A heart container's body, `size` m across, standing up, centred (its depth along z). */
export function heartGeo(size = 0.26) {
  return new THREE.ExtrudeGeometry(heartShape(), { depth: 0.12, bevelEnabled: true, bevelSize: 0.04, bevelThickness: 0.04, bevelSegments: 2, curveSegments: 10 }).translate(0, 0, -0.06).scale(size, size, size);
}

/** A lathe from [r, y] pairs. */
export const lathe = (pts, seg = 12) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(Math.max(r, 0.001), y)), seg);

/** An arch's outline: a rectangle `w` wide, `h` high to the crown, its top a half circle (centred on x, from y 0). */
export function archShape(w, h, path = new THREE.Shape()) {
  const r = w / 2, sh = Math.max(0.01, h - r);
  path.moveTo(-r, 0); path.lineTo(r, 0); path.lineTo(r, sh);
  path.absarc(0, sh, r, 0, Math.PI, false);
  path.lineTo(-r, 0);
  return path;
}
/** A rectangle's outline (centred on x, from y 0). */
function rectShape(w, h, path = new THREE.Shape()) {
  path.moveTo(-w / 2, 0); path.lineTo(w / 2, 0); path.lineTo(w / 2, h); path.lineTo(-w / 2, h); path.lineTo(-w / 2, 0);
  return path;
}

/**
 * A wall `w` wide and `h` high (arched on top when o.arch), `T` thick from z 0 back to z -T, with a door hole
 * { w, h, x, arch } through it (and any `windows` { w, h, x, y, arch }). Solid: the hole is open, the rest stops you.
 */
export function archWall(w, h, T, { door = null, windows = [], arch = false } = {}) {
  const outer = arch ? archShape(w, h) : rectShape(w, h);
  const holes = [];
  // (a door's hole meets the ground: the outline steps round it, a hole may not touch the edge)
  if (door) {
    const dw = door.w, dh = door.h, x = door.x ?? 0, r = dw / 2, sh = door.arch ? dh - r : dh;
    const s = new THREE.Shape();
    s.moveTo(-w / 2, 0); s.lineTo(x - r, 0); s.lineTo(x - r, sh);
    if (door.arch) s.absarc(x, sh, r, Math.PI, 0, true); else s.lineTo(x + r, sh);
    s.lineTo(x + r, 0); s.lineTo(w / 2, 0);
    if (arch) { const R = w / 2, H = Math.max(0.01, h - R); s.lineTo(w / 2, H); s.absarc(0, H, R, 0, Math.PI, false); } else { s.lineTo(w / 2, h); s.lineTo(-w / 2, h); }
    s.lineTo(-w / 2, 0);
    for (const v of windows) holes.push(windowPath(v));
    s.holes = holes;
    return new THREE.ExtrudeGeometry(s, { depth: T, bevelEnabled: false, curveSegments: 14 }).translate(0, 0, -T);
  }
  for (const v of windows) holes.push(windowPath(v));
  outer.holes = holes;
  return new THREE.ExtrudeGeometry(outer, { depth: T, bevelEnabled: false, curveSegments: 14 }).translate(0, 0, -T);
}
function windowPath(v) {
  const p = new THREE.Path(), r = v.w / 2, x = v.x ?? 0, y = v.y ?? 1;
  if (v.round) { p.absarc(x, y + r, r, 0, Math.PI * 2, false); return p; }
  const sh = v.arch ? v.h - r : v.h;
  p.moveTo(x - r, y); p.lineTo(x + r, y); p.lineTo(x + r, y + sh);
  if (v.arch) p.absarc(x, y + sh, r, 0, Math.PI, false); else p.lineTo(x - r, y + sh);
  p.lineTo(x - r, y);
  return p;
}
/** A flat sheet in an arch's (or a circle's) outline, facing +z (the lit inside seen through a hole). */
export function archSheet(w, h, { arch = true, round = false } = {}) {
  if (round) return new THREE.CircleGeometry(w / 2, 20);
  return new THREE.ShapeGeometry(arch ? archShape(w, h) : rectShape(w, h), 14);
}
/** A frame round an arched opening: two jambs and the arch, `t` wide and `d` deep, proud of z 0. */
export function archFrame(w, h, { t = 0.16, d = 0.14, arch = true } = {}) {
  const r = w / 2, sh = arch ? h - r : h, out = [];
  for (const s of [-1, 1]) out.push(new THREE.BoxGeometry(t, sh, d).translate(s * (r + t / 2), sh / 2, d / 2));
  if (arch) out.push(new THREE.TorusGeometry(r + t / 2, t / 2, 4, 16, Math.PI).scale(1, 1, d / t).translate(0, sh, d / 2));
  else out.push(new THREE.BoxGeometry(w + t * 2, t, d).translate(0, sh + t / 2, d / 2));
  return out;
}

/** A corked flask of red cure: { glass, cork } at (x, y, z) standing on y, `s` its scale (1: 25 cm tall). */
export function flask(x, y, z, s = 1) {
  return {
    glass: lathe([[0.01, 0], [0.1, 0.02], [0.11, 0.12], [0.05, 0.2], [0.035, 0.21]], 10).scale(s, s, s).translate(x, y, z),
    cork: new THREE.CylinderGeometry(0.035, 0.03, 0.08, 7).scale(s, s, s).translate(x, y + 0.25 * s, z),
  };
}
/** A magic cell: a glowing vial in a brass cradle at (x, y, z). { glow, brass } */
export function vial(x, y, z, s = 1) {
  return {
    glow: new THREE.CapsuleGeometry(0.055, 0.16, 4, 10).scale(s, s, s).translate(x, y + 0.2 * s, z),
    brass: mergeGeometries([new THREE.TorusGeometry(0.08, 0.018, 5, 14).rotateX(Math.PI / 2).translate(0, 0.07, 0), new THREE.CylinderGeometry(0.07, 0.09, 0.05, 10).translate(0, 0.025, 0)].map((g) => tidy(g))).scale(s, s, s).translate(x, y, z),
  };
}
/** A bell (open below), `r` round its mouth, hanging from y with its mouth at y - 1.3 r. */
export function bell(x, y, z, r = 0.1) {
  return lathe([[0.02, 0], [0.35, -0.05], [0.55, -0.4], [0.68, -0.95], [1, -1.3], [0.92, -1.3]].map(([a, b]) => [a * r, b * r]), 10).translate(x, y, z);
}
/** A feather, `len` long, hanging point down from y (flat in the x–y plane). */
export function feather(x, y, z, len = 0.5, turn = 0) {
  const s = new THREE.Shape(), w = len * 0.13;
  s.moveTo(0, 0); s.quadraticCurveTo(w, -len * 0.35, 0, -len); s.quadraticCurveTo(-w, -len * 0.35, 0, 0);
  return new THREE.ShapeGeometry(s, 6).rotateY(turn).translate(x, y, z);
}
/** A gear: a disc `r` round with `teeth` teeth, `t` thick (its face to +z), a hole `hole` round in the middle. */
export function gear(r = 0.5, teeth = 12, t = 0.08, hole = 0.3) {
  const s = new THREE.Shape(), n = teeth * 4;
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2, out = (i % 4 === 1 || i % 4 === 2) ? r : r * 0.82;
    if (i === 0) s.moveTo(Math.cos(a) * out, Math.sin(a) * out); else s.lineTo(Math.cos(a) * out, Math.sin(a) * out);
  }
  if (hole > 0) { const h = new THREE.Path(); h.absarc(0, 0, r * hole, 0, Math.PI * 2, true); s.holes.push(h); }
  return new THREE.ExtrudeGeometry(s, { depth: t, bevelEnabled: false, curveSegments: 8 }).translate(0, 0, -t / 2);
}
/** A small bulb (a sphere) at (x, y, z). */
export const bulb = (x, y, z, r = 0.07) => new THREE.SphereGeometry(r, 8, 6).translate(x, y, z);
/** A thin cord from (x, y0, z) down to (x, y1, z). */
export const cord = (x, y0, y1, z, r = 0.008) => new THREE.CylinderGeometry(r, r, Math.abs(y0 - y1), 4).translate(x, (y0 + y1) / 2, z);
/** A box with its foot at y (x, z its middle). */
export const block = (w, h, d, x, y, z) => new THREE.BoxGeometry(w, h, d).translate(x, y + h / 2, z);
/** A stick from a to b (two [x, y, z]), `r` thick. */
export function stick(a, b, r = 0.03, seg = 5) {
  const A = new THREE.Vector3(...a), B2 = new THREE.Vector3(...b), d = B2.clone().sub(A), L = d.length();
  const g = new THREE.CylinderGeometry(r, r, L, seg);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()));
  return g.translate((A.x + B2.x) / 2, (A.y + B2.y) / 2, (A.z + B2.z) / 2);
}
/** A flat cloth (both sides) through three or four corners ([x, y, z] each). */
export function cloth(...pts) {
  const P = pts.map((p) => new THREE.Vector3(...p));
  const tri = P.length === 3 ? [0, 1, 2] : [0, 1, 2, 0, 2, 3];
  const pos = [];
  for (const i of tri) pos.push(P[i].x, P[i].y, P[i].z);
  for (let i = tri.length - 1; i >= 0; i--) pos.push(P[tri[i]].x, P[tri[i]].y, P[tri[i]].z);   // (the back face)
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}
