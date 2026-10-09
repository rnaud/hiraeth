import * as THREE from 'three';
import { MODE_STRATA } from '../materials.js';
import { createNoise2D, mulberry32 } from '../noise.js';
import { V, tube, put, smoothstep, PERSON, CLEAN_SKY } from './reference-kit.js';
import { cloudSea } from './reference-vael2.js';
import { BURIED_SPOTS } from './buried.js';
import { greebles } from './greeble-kit.js';
import { formAxis } from '../form.js';

const wrapped = (g) => formAxis(g, 'wrap');   // a cylinder made about y: its strokes wrap round it

// ---------------------------------------------------------------------------
// The Buried Machine's reference sheets (references/levels/The Buried Machine/environment/IMG_3789 … 3792): pale cream
// dunes under a sage sky with domed huts and pipe elbows breaking the surface, a trench lined with
// pipes, a rust canyon of tanks and walls pierced by great ovals, a teal drum open to the sky, a city
// hanging upside down overhead and a colossal ring of arches carrying a town. One scene builder
// (machineScene) does them all; each panel is a view (reference-views.js describes the fields).
//
// The sheets shade every surface in a darker tone of its own colour, as albedo × a pale grey-green
// (the dunes' shade a sage grey, the rust a deep rust, the teal a deep teal): no flat print here.
// ---------------------------------------------------------------------------

const sheet = (name) => ({ name: `The Buried Machine / ${name}.JPG`, size: [1024, 1024], url: new URL(`../../references/levels/The Buried Machine/environment/${name}.JPG`, import.meta.url).href });
export const BURIED_SHEETS = Object.fromEntries(['IMG_3789', 'IMG_3790', 'IMG_3791', 'IMG_3792'].map((n) => [n, sheet(n)]));

/** The sheets' ink: shade the surface's own colour darkened (no warm grey, no flat print), a clean sky. */
export const BURIED_LOOK = { ...CLEAN_SKY, uShadeKeep: 0, uShadowFlat: 0, ...BURIED_SPOTS };
/** The shade's tint: the dunes' shade over their light (#aab9a1 over #fde8c4), which darkens the rust as the sheets do. */
const TINT = '#abc7c6';
const SKY = {
  sage: ['#99a89b', '#b4bea6', TINT, '#ffffff', '#fff6dc'],
  cream: ['#fdeed2', '#fdf1da', TINT, '#ffffff', '#fff6dc'],
  blue: ['#a9dbe3', '#c3eef2', TINT, '#ffffff', '#fff6dc'],
};
const nM = createNoise2D(37891), nN = createNoise2D(37892);

function materials(kit) {
  const DS = THREE.DoubleSide;
  // (form: the tanks', drums' and towers' strokes wrap round them, src/form.js)
  const strata = (c1, c2, c3, o = {}) => kit.mat({ color: c1, color2: c2, color3: c3, mode: MODE_STRATA, strataSize: 4, flat: true, strataHatch: 0, form: true, ...o });
  return {
    rust: strata('#c4613f', '#b35a3a', '#cf7450', { side: DS, detail: 'built' }),
    rustPale: strata('#d98a62', '#cf7e58', '#e29a72', { side: DS, detail: 'built' }),
    rustDark: kit.mat({ color: '#8a4636', flat: true, metal: 'iron', refl: 0.12 }),
    rustGrid: kit.mat({ color: '#c4613f', flat: true, grid: 3.2, plates: true, side: DS }),
    teal: strata('#3f6f72', '#386669', '#4a7b7c', { side: DS, grid: 4, detail: 'built' }),
    tealDark: kit.mat({ color: '#2b5258', flat: true, side: DS }),
    tealPale: kit.mat({ color: '#9fb39a', flat: true, side: DS }),
    green: strata('#9fae96', '#94a38c', '#aab9a1', { side: DS, detail: 'built' }),
    lilac: strata('#a0888a', '#97807f', '#ab9393', { side: DS }),
    cream: strata('#efd8c2', '#e8cfb6', '#f4e0cc', { side: DS }),
    pipe: kit.mat({ color: '#cdd5c6', metal: 'painted' }),
    pipeBlue: kit.mat({ color: '#8e9aae', metal: 'painted' }),
    flange: kit.mat({ color: '#a9b4a8', flat: true, metal: 'steel' }),
    dome: kit.mat({ color: '#e2c4b5', weathered: 0.4 }),
    domeSage: kit.mat({ color: '#bcc39f', weathered: 0.4 }),
    dark: kit.mat({ color: '#34405e', flat: true }),
    city: [kit.mat({ color: '#3d5c66', flat: true }), kit.mat({ color: '#2f4a52', flat: true }), kit.mat({ color: '#4f6a78', flat: true, grid: 5 })],
    town: [kit.mat({ color: '#ecd2bc', flat: true, pattern: 'facade', windows: 0.3 }), kit.mat({ color: '#e5c5af', flat: true }), kit.mat({ color: '#d9b49c', flat: true })],
    boxes: [kit.mat({ color: '#b86a4c', flat: true }), kit.mat({ color: '#a55a42', flat: true }), kit.mat({ color: '#c98a6a', flat: true }), kit.mat({ color: '#7f8c86', flat: true })],
    glowPeach: kit.mat({ color: '#ffc4a6', glow: 0.85, flat: true }),
    glowAqua: kit.mat({ color: '#c4f1ee', glow: 0.75, flat: true }),
    lamp: kit.mat({ color: '#fff0c8', glow: 0.9, flat: true }),
    window: kit.mat({ color: '#f6c97e', glow: 0.8, flat: true }),
    cloud: kit.mat({ color: '#fff1dd', shade: 0.55, hatch: 0, spot: 0, line: 0.45, lineTint: 1 }),
    pinkCloud: kit.mat({ color: '#fbe1d0', shade: 0.55, hatch: 0, spot: 0, line: 0.45, lineTint: 1 }),
    cloak: kit.mat({ color: PERSON.cloak, flat: true }),
    // the oval tunnel's luminous inside (IMG_3791 p4), the moon (IMG_3792 p3), the ledge's layered rock (IMG_3792 p5)
    aquaIn: kit.mat({ color: '#c3ece6', glow: 0.35, flat: true, side: DS }),
    aquaMid: kit.mat({ color: '#94cfca', glow: 0.15, flat: true }),
    moon: kit.mat({ color: '#efe9f2', glow: 0.7, flat: true, spot: 0, line: 0.5, lineTint: 1 }),
    crater: kit.mat({ color: '#d6cfdf', glow: 0.6, flat: true, spot: 0, line: 0.25, lineTint: 1 }),
    ledgeRock: kit.mat({ color: '#a5b3a1', color2: '#96a593', color3: '#b4c0b0', mode: MODE_STRATA, strataSize: 1.3, flat: true, pattern: 'cracks', strataHatch: 0.6 }),
    vault: strata('#7f9a88', '#738e7d', '#8ba592', { side: DS, detail: 'built' }),
    slate: strata('#a3b4c2', '#97a9b8', '#afbfcb', { side: DS, grid: 4, detail: 'built' }),
  };
}

// ---------------------------------------------------------------- builders (the view's own frame)
/** A domed hut half sunk in the dune: a drum, its dome, a dark door, a little chimney. */
function hut(kit, M, { x, z, r = 3, h = 2.4, yaw = 0, sage = false }) {
  const y = kit.base(x, z, r) - 0.6, m = sage ? M.domeSage : M.dome;
  kit.add(m, new THREE.CylinderGeometry(r, r * 1.04, h, 18).translate(x, y + h / 2, z));
  kit.add(m, new THREE.SphereGeometry(r * 1.02, 18, 8, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.85, 1).translate(x, y + h, z));
  kit.add(M.flange, new THREE.TorusGeometry(r * 1.02, r * 0.05, 4, 24).rotateX(Math.PI / 2).translate(x, y + h, z), { solid: false });
  kit.add(M.dark, put(new THREE.BoxGeometry(r * 0.5, h * 0.7, 0.3), x + Math.sin(yaw) * r, y + h * 0.35, z + Math.cos(yaw) * r, yaw), { solid: false });
  kit.add(M.pipe, new THREE.CylinderGeometry(r * 0.08, r * 0.08, r * 0.8, 8).translate(x + r * 0.4, y + h + r * 0.85, z - r * 0.2), { solid: false });
}

/** A pipe along points (local [x, y, z], y over the ground), flanges at its joints; half buried where y < 0. */
function pipe(kit, M, pts, r, { blue = false, ground = true } = {}) {
  const P = pts.map(([x, y, z]) => V(x, (ground ? kit.H(x, z) : 0) + y, z));
  kit.add(blue ? M.pipeBlue : M.pipe, tube(P, r, 12 * pts.length, 14));
  for (const p of P.slice(1, -1)) {
    const i = P.indexOf(p), q = P[Math.min(i + 1, P.length - 1)], d = (i === P.length - 1 ? p.clone().sub(P[i - 1]) : q.clone().sub(p)).normalize();
    const g = new THREE.TorusGeometry(r * 1.05, r * 0.14, 5, 18);
    g.lookAt(d); g.translate(p.x, p.y, p.z);
    kit.add(M.flange, g, { solid: false });
  }
}

/** A bank of pipes along a wall: rows of horizontal pipes from (x0, z0) to (x1, z1), stacked from y0 up to y1. */
function pipeBank(kit, M, { x0, z0, x1, z1, y0, y1, r = 1.2, blue = true, seed = 1 }) {
  const rng = mulberry32(seed);
  for (let y = y0 + r; y < y1; y += r * (2.1 + rng() * 0.6)) {
    const rr = r * (0.7 + rng() * 0.6), off = (rng() - 0.5) * r;
    pipe(kit, M, [[x0, y, z0 + off], [x1, y + (rng() - 0.5) * 0.5, z1 + off]], rr, { blue: rng() < 0.7 === blue, ground: false });
    if (rng() < 0.4) { const t = rng(), px = x0 + (x1 - x0) * t, pz = z0 + (z1 - z0) * t; pipe(kit, M, [[px, y, pz + r], [px, y + r * 3, pz + r]], rr * 0.7, { ground: false }); }
  }
}

/** A pipe through corner points (local, absolute y) with tight elbows: each corner rounded within 1.6 r, a flange at each bend. */
function bent(kit, M, pts, r, mat = M.pipeBlue) {
  const P = [];
  for (let i = 0; i < pts.length; i++) {
    const p = V(...pts[i]);
    if (i === 0 || i === pts.length - 1) { P.push(p); continue; }
    const a = V(...pts[i - 1]), b = V(...pts[i + 1]), da = a.clone().sub(p), db = b.clone().sub(p);
    const k = Math.min(r * 1.6, da.length() * 0.45, db.length() * 0.45);
    P.push(p.clone().addScaledVector(da.normalize(), k), p.clone().addScaledVector(da.clone().add(db.normalize()).normalize(), k * 0.3), p.clone().addScaledVector(db, k));
    const g = new THREE.TorusGeometry(r * 1.12, r * 0.16, 4, 14);
    g.lookAt(da); const f = p.clone().addScaledVector(da, k * 1.05); g.translate(f.x, f.y, f.z);
    kit.add(M.flange, g, { solid: false, shadow: false });
  }
  const c = new THREE.CatmullRomCurve3(P, false, 'centripetal');
  kit.add(mat, new THREE.TubeGeometry(c, Math.max(8, Math.round(c.getLength() / 0.6)), r, 10, false), { shadow: false });
}

/**
 * The trench's pipe mass (IMG_3789 p1): a trench from (x0, z0) to (x1, z1), w wide, its floor `deep`
 * under the dune, packed with pipes: long runs along it at several levels, inverted U-bends rising from
 * the dark floor and dropping back, risers capped with flanges, a few elbows climbing over the lip.
 */
function pipeMass(kit, M, { x0, z0, x1, z1, w, deep, seed = 1, density = 1 }) {
  const rng = mulberry32(seed), L = Math.hypot(x1 - x0, z1 - z0), ax = (x1 - x0) / L, az = (z1 - z0) / L, nx = -az, nz = ax;
  const at = (s, u) => [x0 + ax * s + nx * u, z0 + az * s + nz * u];
  const top = (s, u) => { const [x, z] = at(s, u); return kit.H(x, z); };
  const P = (s, u, y) => { const [x, z] = at(s, u); return [x, y, z]; };
  // the dark floor and back between them (where the spot blacks sit)
  for (let s = 0; s < L; s += 6) { const [x, z] = at(s + 3, 0); kit.add(M.tealDark, put(new THREE.BoxGeometry(6.2, 1, w * 0.9), x, top(s + 3, 0) - 0.6, z, Math.atan2(ax, az) + Math.PI / 2), { solid: false, shadow: false }); }
  // long runs along the trench
  for (let i = 0; i < Math.round(9 * density); i++) {
    const u = (rng() - 0.5) * w * 0.8, f = rng(), r = 0.35 + rng() * 0.5, pts = [];
    for (let s = 2; s <= L - 2; s += L / 6) pts.push(P(s, u, top(s, u) + 0.4 + f * (deep - 2.5)));
    bent(kit, M, pts, r, rng() < 0.75 ? M.pipeBlue : M.pipe);
  }
  // inverted U-bends, along the trench or across it, and risers with flanged caps
  for (let s = 1.5; s < L - 2; s += (1.2 + rng() * 1.6) / density) {
    const far = rng() < 0.55, u = far ? -w * (0.3 + rng() * 0.17) : (rng() - 0.5) * w * 0.85, r = 0.3 + rng() * 0.45, h = deep * (far ? 0.6 + rng() * 0.4 : 0.3 + rng() * 0.55), y0 = top(s, u) + 0.2, k = rng();
    if (k < 0.45) { const d = 2 + rng() * 4; bent(kit, M, [P(s, u, y0), P(s, u, y0 + h), P(s + d, u, y0 + h), P(s + d, u, y0)], r); }
    else if (k < 0.75) { const d = (rng() < 0.5 ? -1 : 1) * (2 + rng() * 3), u2 = Math.max(-w * 0.45, Math.min(w * 0.45, u + d)); bent(kit, M, [P(s, u, y0), P(s, u, y0 + h), P(s, u2, y0 + h), P(s, u2, y0)], r); }
    else {
      const [x, y, z] = P(s, u, y0);
      kit.add(M.pipeBlue, new THREE.CylinderGeometry(r, r, h, 10).translate(x, y + h / 2, z), { shadow: false });
      kit.add(M.flange, new THREE.CylinderGeometry(r * 1.35, r * 1.35, 0.35, 12).translate(x, y + h, z), { solid: false, shadow: false });
      if (rng() < 0.5) kit.add(M.flange, new THREE.CylinderGeometry(r * 0.5, r * 0.5, 0.6, 8).translate(x, y + h + 0.45, z), { solid: false, shadow: false });
    }
  }
  // elbows climbing over the lip onto the sand
  for (let i = 0; i < Math.round(4 * density); i++) {
    const s = 3 + rng() * (L - 6), e = rng() < 0.5 ? -1 : 1, u = e * w * 0.42, r = 0.6 + rng() * 0.4, yt = top(s, e * (w * 0.5 + 3));
    bent(kit, M, [P(s, u, top(s, u) + 0.5), P(s, u, yt + 1.4), P(s, e * (w * 0.5 + 4), yt + 1.4), P(s, e * (w * 0.5 + 4), yt - 0.5)], r, M.pipe);
  }
}

/**
 * A wall pierced by ovals: w wide, h high, t thick, its face at (x, y0, z) turned by yaw; holes
 * [[cx, cy, rx, ry]…] in the wall's own frame (cx from its middle, cy from its foot), each rimmed.
 */
function ovalWall(kit, M, { x, z, y0 = 0, w, h, t = 3, yaw = 0, holes = [], mat = 'rust', rim = 'rustDark', fill = null, fine = 1.6 }) {
  // an oval reaching the floor is a doorway: cut into the wall's outline (its sides straight down), not a hole
  const door = holes.find(([, cy, , ry]) => cy - ry < 0.6);
  const sh = new THREE.Shape();
  sh.moveTo(-w / 2, 0);
  if (door) {
    const [cx, cy, rx, ry] = door, top = Math.max(cy, ry * 0.5);
    sh.lineTo(cx - rx, 0); sh.lineTo(cx - rx, top);
    sh.absellipse(cx, top, rx, ry, Math.PI, 0, true);
    sh.lineTo(cx + rx, 0);
  }
  sh.lineTo(w / 2, 0); sh.lineTo(w / 2, h); sh.lineTo(-w / 2, h); sh.lineTo(-w / 2, 0);
  for (const hole of holes) {
    if (hole === door) continue;
    const [cx, cy, rx, ry] = hole, p = new THREE.Path();
    p.absellipse(cx, cy, rx, ry, 0, Math.PI * 2, true);
    sh.holes.push(p);
  }
  const g = new THREE.ExtrudeGeometry(sh, { depth: t, bevelEnabled: false, curveSegments: 40 }).translate(0, 0, -t / 2);
  kit.add(M[mat], put(g, x, y0, z, yaw));
  // the sheets' small machinery climbing the wall's foot on its near face (greeble-kit.js), in columns that stop
  // short of the ovals
  if (fine) {
    const G = greebles(x * 3 + z), col = 6, foot = h * 0.28;
    for (let c = -w / 2; c < w / 2 - 1; c += col) {
      let top = foot;
      for (const [cx, cy, rx, ry] of holes) if (c + col > cx - rx && c < cx + rx) top = Math.min(top, cy - ry - 0.6);
      if (top < 1.5) continue;
      G.patch(new THREE.Vector3(c, 0.2, t / 2), new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1), Math.min(col, w / 2 - c), top, { density: fine, scale: 1, depth: 1 });
    }
    const m = G.merged();
    for (const [k, mm] of [['metal', 'rustDark'], ['dark', mat], ['pale', 'pipe']]) if (m[k]) kit.add(M[mm], put(m[k], x, y0, z, yaw), { solid: false });
  }
  for (const hole of holes) {
    const [cx, cy, rx, ry] = hole, at = [x + Math.cos(yaw) * cx, z - Math.sin(yaw) * cx];
    if (hole === door) {
      const top = Math.max(cy, ry * 0.5);
      kit.add(M[rim], put(new THREE.TorusGeometry(1, 0.05, 6, 48, Math.PI).scale(rx, ry, 1), at[0], y0 + top, at[1], yaw), { solid: false });
      continue;
    }
    kit.add(M[rim], put(new THREE.TorusGeometry(1, 0.05, 6, 48).scale(rx, ry, 1), at[0], y0 + cy, at[1], yaw), { solid: false });
    if (fill) kit.add(M[fill], put(new THREE.CircleGeometry(1, 40).scale(rx, ry, 1), at[0], y0 + cy, at[1], yaw), { solid: false });
  }
}

/** A tank: a tall cylinder with rings and a cap. */
function tank(kit, M, { x, z, r, h, y = null, mat = 'rust' }) {
  const y0 = y ?? kit.base(x, z, r) - 0.5;
  kit.add(M[mat], wrapped(new THREE.CylinderGeometry(r, r, h, 20)).translate(x, y0 + h / 2, z));
  for (let k = 1; k < h / 7; k++) kit.add(M.rustDark, new THREE.TorusGeometry(r * 1.01, 0.18, 4, 24).rotateX(Math.PI / 2).translate(x, y0 + k * 7, z), { solid: false });
  kit.add(M.rustDark, new THREE.SphereGeometry(r, 16, 6, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.3, 1).translate(x, y0 + h, z));
}

/** Machinery against a wall: boxes, little tanks, hatches, a few lamps, along a line from (x0, z0) to (x1, z1); `fine`: the small work's density (0: none). */
function machinery(kit, M, { x0, z0, x1, z1, y0 = 0, y1 = 20, depth = 4, n = 30, seed = 1, mats = ['rust', 'rustPale', 'rustDark'], lamps = 0, fine = 1.2 }) {
  const rng = mulberry32(seed), L = Math.hypot(x1 - x0, z1 - z0), yaw = Math.atan2(x1 - x0, z1 - z0) + Math.PI / 2;
  for (let i = 0; i < n; i++) {
    const t = rng(), px = x0 + (x1 - x0) * t, pz = z0 + (z1 - z0) * t, w = 1 + rng() * L * 0.08, hh = 1 + rng() * (y1 - y0) * 0.35, d = depth * (0.3 + rng() * 0.7);
    const y = y0 + rng() * (y1 - y0 - hh);
    const g = rng() < 0.3 ? new THREE.CylinderGeometry(d / 2, d / 2, hh, 12).translate(0, hh / 2, 0) : new THREE.BoxGeometry(w, hh, d).translate(0, hh / 2, 0);
    kit.add(M[mats[Math.floor(rng() * mats.length)]], put(g, px, y, pz, yaw));
  }
  // and the sheets' small machinery over and between them (greeble-kit.js): pipe runs, valves, conduits, casings,
  // on the wall face at `depth` behind the line, facing the camera's side of it
  if (fine) {
    const u = new THREE.Vector3(x1 - x0, 0, z1 - z0).normalize(), nrm = new THREE.Vector3(-u.z, 0, u.x);
    if (nrm.x * -x0 + nrm.z * -z0 < 0) nrm.negate();
    const G = greebles(seed * 13 + 7);
    G.patch(new THREE.Vector3(x0, y0, z0).addScaledVector(nrm, -depth * 0.5), u, new THREE.Vector3(0, 1, 0), nrm, L, y1 - y0, { density: fine, scale: Math.max(0.7, (y1 - y0) / 30), depth: depth * 0.8 });
    const m = G.merged();
    if (m.metal) kit.add(M.rustDark, m.metal, { solid: false });
    if (m.dark) kit.add(M[mats[0]], m.dark, { solid: false });
    if (m.pale) kit.add(M.pipe, m.pale, { solid: false });
  }
  for (let i = 0; i < lamps; i++) {
    const t = rng(), px = x0 + (x1 - x0) * t, pz = z0 + (z1 - z0) * t;
    kit.add(M.lamp, new THREE.SphereGeometry(0.35, 8, 6).translate(px, y0 + rng() * (y1 - y0), pz), { solid: false });
  }
}

/** The drum: an open cylinder (inner face drawn) r wide from y0 to y1, ribbed, slit windows, arches at its foot. */
function drum(kit, M, { x, z, r, y0 = 0, y1, mat = 'teal', slits = 18, lit = 0.3, seed = 3, gap = 0, inside = 0, roof = 0, vault = 5, off = 0, roofShadow = true, ribs = true }) {
  // gap (rad): the side toward +z left open (a drum entered through its wall)
  const rng = mulberry32(seed), h = y1 - y0;
  kit.add(M[mat], wrapped(new THREE.CylinderGeometry(r, r, h, 56, 1, true, gap / 2, Math.PI * 2 - gap)).translate(x, y0 + h / 2, z));
  kit.add(M[mat], wrapped(new THREE.CylinderGeometry(r + 4, r + 4, h, 56, 1, true, gap / 2, Math.PI * 2 - gap)).translate(x, y0 + h / 2, z));
  kit.add(M.tealDark, new THREE.RingGeometry(r, r + 4, 56, 1, gap / 2, Math.PI * 2 - gap).rotateX(-Math.PI / 2).translate(x, y1, z), { solid: false });
  for (let i = 0; i < slits; i++) {
    const a = gap / 2 + (i / slits) * (Math.PI * 2 - gap), sx = x + Math.sin(a) * (r - 0.05), sz = z + Math.cos(a) * (r - 0.05);
    const sh = h * (0.12 + rng() * 0.1), sy = y0 + h * (0.25 + rng() * 0.5);
    kit.add(rng() < lit ? M.window : M.dark, put(new THREE.BoxGeometry(1.6, sh, 0.3), sx, sy, sz, a), { solid: false });
    if (ribs) kit.add(M.tealDark, put(new THREE.BoxGeometry(1.2, h, 0.8), x + Math.sin(a + 0.09) * (r - 0.4), y0 + h / 2, z + Math.cos(a + 0.09) * (r - 0.4), a), { solid: false });
  }
  if (ribs) for (let k = 1; k < 4; k++) kit.add(M.tealDark, new THREE.TorusGeometry(r - 0.3, 0.5, 4, 56).rotateX(Math.PI / 2).translate(x, y0 + (h * k) / 4, z), { solid: false });
  if (inside) drumInside(kit, M, rng, { x, z, r, y0, y1, gap, mat, inside });
  if (roof && !off) {   // vaulted over, an oculus in the middle (IMG_3789 p5)
    kit.add(M[mat], new THREE.CylinderGeometry(roof, r + 4, vault, 64, 1, true).translate(x, y1 + vault / 2, z), { solid: false, shadow: roofShadow });
    kit.add(M.tealDark, new THREE.TorusGeometry(roof, 1.1, 6, 64).rotateX(Math.PI / 2).translate(x, y1 + vault, z), { solid: false, shadow: false });
    for (let i = 0; i < 24; i++) {   // the vault's ribs, running in to the oculus
      const a = (i / 24) * Math.PI * 2, p0 = V(x + Math.sin(a) * (r - 0.5), y1, z + Math.cos(a) * (r - 0.5)), p1 = V(x + Math.sin(a) * roof, y1 + vault - 0.3, z + Math.cos(a) * roof);
      kit.add(M.tealDark, tube([p0, p1], 0.5, 2, 4), { solid: false, shadow: false });
    }
  } else if (roof) {   // a ceiling, its oculus `off` m toward the far side (-z: IMG_3791 p6, seen from in the drum)
    const sh = new THREE.Shape(); sh.absarc(0, 0, r + 4, 0, Math.PI * 2, false);
    const hole = new THREE.Path(); hole.absarc(0, -off, roof, 0, Math.PI * 2, true); sh.holes.push(hole);
    kit.add(M[mat], new THREE.ShapeGeometry(sh, 48).rotateX(Math.PI / 2).translate(x, y1, z), { solid: false, shadow: roofShadow });
    kit.add(M.tealDark, new THREE.TorusGeometry(roof, 1.2, 6, 64).rotateX(Math.PI / 2).translate(x, y1 - 0.6, z - off), { solid: false, shadow: false });
    const rng2 = mulberry32(seed + 7);
    for (let i = 0; i < 70; i++) {   // the ceiling's machinery, hanging from it
      const a = rng2() * Math.PI * 2, rr = Math.sqrt(rng2()) * r, px = x + Math.sin(a) * rr, pz = z + Math.cos(a) * rr;
      if (Math.hypot(px - x, pz - z + off) < roof + 2) continue;
      const w = 1.5 + rng2() * 5, hh = 0.6 + rng2() * 3;
      kit.add(rng2() < 0.5 ? M.tealDark : M[mat], put(new THREE.BoxGeometry(w, hh, w * (0.5 + rng2())), px, y1 - hh / 2, pz, rng2() * 3), { solid: false, shadow: false });
    }
  }
}

/**
 * A drum's inside (IMG_3791 p6, IMG_3792 p3): tiers of arcades round the wall (dark arched bays, a
 * few lit, pilasters between, a cornice at each tier), and machinery clinging to it, boxes and little
 * tanks standing in, some with a lit window: the dense small work the sheets draw at every height.
 */
function drumInside(kit, M, rng, { x, z, r, y0, y1, gap, mat, inside }) {
  const nd = { solid: false, shadow: false }, dark = mat === 'teal' ? 'tealDark' : 'tealDark', body = mat;
  const inward = (a, rr, y) => [x + Math.sin(a) * rr, y, z + Math.cos(a) * rr];
  const arch = (w, h) => { const sh = new THREE.Shape(); sh.moveTo(-w / 2, 0); sh.lineTo(w / 2, 0); sh.lineTo(w / 2, h - w / 2); sh.absarc(0, h - w / 2, w / 2, 0, Math.PI, false); sh.lineTo(-w / 2, 0); return new THREE.ShapeGeometry(sh, 6); };
  const open = (a) => { const t = ((a % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2); return t > gap / 2 && t < Math.PI * 2 - gap / 2; };
  for (let y = y0 + 0.5, tier = 0; y < y1 - 6; tier++) {
    const th = tier === 0 ? Math.min(12, (y1 - y0) * 0.22) : 6 + rng() * 5, bays = Math.round((Math.PI * 2 * r) / (th * 0.75));
    for (let i = 0; i < bays; i++) {
      const a = gap / 2 + ((i + 0.5) / bays) * (Math.PI * 2 - gap);
      if (!open(a)) continue;
      const w = th * 0.42, lit = rng() < 0.12;
      kit.add(lit ? M.window : M.dark, put(arch(w, th * 0.78), ...inward(a, r - 0.12, y), a + Math.PI), nd);
      kit.add(M[dark], put(new THREE.BoxGeometry(th * 0.12, th, 0.9), ...inward(a + Math.PI / bays, r - 0.45, y + th / 2), a), nd);
    }
    kit.add(M[dark], new THREE.CylinderGeometry(r - 0.6, r - 0.6, 0.7, 64, 1, true, gap / 2, Math.PI * 2 - gap).translate(x, y + th + 0.35, z), nd);
    y += th + 0.7;
  }
  // the sheets' dense small machinery over the inside wall (greeble-kit.js): strips between the bays' piers, pipes
  // and casings whose gaps the spot blacks fill
  if (inside > 0) {
    const G = greebles(x * 7 + z), strips = Math.round((Math.PI * 2 * r) / 9), V3 = (a, b, c) => new THREE.Vector3(a, b, c);
    for (let i = 0; i < strips; i++) {
      const a = gap / 2 + ((i + 0.5) / strips) * (Math.PI * 2 - gap);
      if (!open(a)) continue;
      const dx = Math.sin(a), dz = Math.cos(a), t = V3(dz, 0, -dx), w = 4;
      G.patch(V3(x + dx * (r - 0.15), y0 + 0.5, z + dz * (r - 0.15)).addScaledVector(t, -w / 2), t, V3(0, 1, 0), V3(-dx, 0, -dz), w, (y1 - y0) * 0.9, { density: 2 * inside, scale: Math.max(0.8, r / 34), depth: 0.8 });
    }
    const m = G.merged();
    if (m.metal) kit.add(M[body], m.metal, nd);
    if (m.dark) kit.add(M[dark], m.dark, nd);
    if (m.pale) kit.add(M.pipe, m.pale, nd);
  }
  const n = Math.round(r * 5 * inside);
  for (let i = 0; i < n; i++) {
    const a = rng() * Math.PI * 2;
    if (!open(a)) continue;
    const y = y0 + Math.pow(rng(), 1.3) * (y1 - y0) * 0.92, w = 1 + rng() * 3.5, h = 1 + rng() * 4, d = 0.6 + rng() * 2.4, rr = r - d / 2 - 0.3;
    if (rng() < 0.25) kit.add(M[body], wrapped(new THREE.CylinderGeometry(d / 2, d / 2, h, 10)).translate(...inward(a, rr, y + h / 2)), nd);
    else kit.add(rng() < 0.5 ? M[dark] : M[body], put(new THREE.BoxGeometry(w, h, d), ...inward(a, rr, y), a), nd);
    if (rng() < 0.3) kit.add(M.window, put(new THREE.PlaneGeometry(w * 0.3, h * 0.25), ...inward(a, rr - d / 2 - 0.03, y + h * 0.6), a + Math.PI), nd);
  }
}

/**
 * One hanging tower of the city, from (x, y, z) down `len`, r its radius: tiers narrowing as they go
 * down, a band at each step, boxes on the shafts, a bulb near its end (an onion dome upside down) and a
 * spike, now and then an aerial or a cable dangling from the tip.
 */
function hangingTower(kit, M, rng, x, y, z, r, len, mat) {
  const nd = { solid: false, shadow: false }, tiers = 2 + Math.floor(rng() * 3), sides = rng() < 0.4 ? 8 : 12;
  let yy = y, rr = r;
  for (let t = 0; t < tiers; t++) {
    const th = (len * 0.72 / tiers) * (0.75 + rng() * 0.5);
    kit.add(M.city[mat], new THREE.CylinderGeometry(rr, rr * (0.8 + rng() * 0.15), th, sides).translate(x, yy - th / 2, z), nd);
    for (let k = 0; k < 2 + Math.floor(rng() * 3); k++) {   // boxes and pods on the shaft
      const a = rng() * Math.PI * 2, s = rr * (0.25 + rng() * 0.3), by = yy - th * (0.15 + rng() * 0.7);
      kit.add(M.city[(mat + 1) % 3], put(new THREE.BoxGeometry(s, s * (1 + rng() * 2), s), x + Math.cos(a) * rr * 0.95, by, z + Math.sin(a) * rr * 0.95, -a), nd);
    }
    yy -= th;
    kit.add(M.city[1], new THREE.CylinderGeometry(rr * 1.15, rr * 1.15, Math.max(0.6, rr * 0.12), sides).translate(x, yy, z), nd);
    rr *= 0.8 + rng() * 0.12;
  }
  // the bulb, then the spike
  const br = rr * (1.4 + rng() * 0.5);
  kit.add(M.city[mat], new THREE.SphereGeometry(br, 14, 9).scale(1, 0.8, 1).translate(x, yy - br * 0.7, z), nd);
  yy -= br * 1.35;
  const sp = len * (0.05 + rng() * 0.08);
  kit.add(M.city[(mat + 2) % 3], new THREE.ConeGeometry(br * 0.55, sp, 10).rotateX(Math.PI).translate(x, yy - sp / 2, z), nd);
  if (rng() < 0.45) { const l = len * (0.15 + rng() * 0.35); kit.add(M.dark, new THREE.CylinderGeometry(Math.max(0.08, r * 0.02), Math.max(0.08, r * 0.02), l, 4).translate(x + br * 0.3, yy - sp * 0.5 - l / 2, z), nd); }
}

/**
 * The hanging city (IMG_3789 p2, IMG_3790 p2, IMG_3791 p2): a disc at y, and under it its towers
 * hanging in clusters, a tall one in each with lesser ones packed round it, longest in the middle;
 * squat blocks fill the underside between them, cables sag from cluster to cluster.
 */
function hangingCity(kit, M, { x, y, z, R, depth, n = 220, seed = 5 }) {
  const rng = mulberry32(seed), nd = { solid: false, shadow: false };
  kit.add(M.city[0], new THREE.CylinderGeometry(R, R * 0.96, R * 0.06, 48).translate(x, y + R * 0.03, z), nd);
  for (let i = 0; i < n * 0.5; i++) {   // the underside's blocks
    const a = rng() * Math.PI * 2, rr = Math.sqrt(rng()) * R * 0.95, w = R * (0.04 + rng() * 0.08), h = depth * (0.04 + rng() * 0.1) * (1 - 0.6 * rr / R);
    kit.add(M.city[Math.floor(rng() * 3)], put(new THREE.BoxGeometry(w, h, w * (0.6 + rng() * 0.8)), x + Math.cos(a) * rr, y - h / 2, z + Math.sin(a) * rr, rng() * 3), nd);
  }
  const clusters = [], nc = Math.max(5, Math.round(n / 22));
  for (let i = 0; i < nc * 4 && clusters.length < nc; i++) {
    const a = rng() * Math.PI * 2, rr = Math.pow(rng(), 0.7) * R * 0.85, cx = x + Math.cos(a) * rr, cz = z + Math.sin(a) * rr, cr = R * (0.075 + rng() * 0.06) * (1.2 - 0.5 * rr / R);
    if (clusters.some((c) => Math.hypot(c.x - cx, c.z - cz) < (c.r + cr) * 2.1)) continue;
    clusters.push({ x: cx, z: cz, r: cr, len: depth * (1 - 0.6 * rr / R) * (0.6 + rng() * 0.4) });
  }
  for (const c of clusters) {
    const mat = Math.floor(rng() * 3);
    hangingTower(kit, M, rng, c.x, y, c.z, c.r, c.len, mat);
    for (let k = 0, m = 3 + Math.floor(rng() * 4); k < m; k++) {   // the lesser towers packed round it
      const a = (k / m) * Math.PI * 2 + rng() * 0.6, d = c.r * (1.15 + rng() * 0.5), r = c.r * (0.3 + rng() * 0.3);
      hangingTower(kit, M, rng, c.x + Math.cos(a) * d, y, c.z + Math.sin(a) * d, r, c.len * (0.3 + rng() * 0.45), (mat + k) % 3);
    }
  }
  for (let i = 0; i < clusters.length; i++) {   // cables slung between neighbouring clusters
    const p = clusters[i], q = clusters[(i + 1) % clusters.length], yp = y - p.len * 0.3, yq = y - q.len * 0.3;
    const mid = V((p.x + q.x) / 2, Math.min(yp, yq) - Math.hypot(p.x - q.x, p.z - q.z) * 0.15, (p.z + q.z) / 2);
    kit.add(M.dark, new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(V(p.x, yp, p.z), mid, V(q.x, yq, q.z)), 16, Math.max(0.15, R * 0.003), 4), nd);
  }
}

/** The colossal ring: arches round a circle (cx, cz) of radius R, from angle a0 to a1 (rad), deck at y with a town on it. */
function ring(kit, M, { cx, cz, R, y, W = 30, a0 = 0, a1 = Math.PI * 2, arches = 40, seed = 7, mat = 'cream' }) {
  const rng = mulberry32(seed), n = arches, da = (a1 - a0) / n;
  for (let i = 0; i < n; i++) {
    const a = a0 + (i + 0.5) * da, px = cx + Math.sin(a) * R, pz = cz + Math.cos(a) * R, span = R * da;
    // a pier and the arch over the bay: a slab pierced by an arch opening
    const sh = new THREE.Shape();
    sh.moveTo(-span / 2, -y); sh.lineTo(span / 2, -y); sh.lineTo(span / 2, W * 0.4); sh.lineTo(-span / 2, W * 0.4); sh.lineTo(-span / 2, -y);
    const hole = new THREE.Path(), hw = span * 0.36;
    hole.moveTo(-hw, -y); hole.lineTo(-hw, -W * 0.6); hole.absarc(0, -W * 0.6, hw, Math.PI, 0, true); hole.lineTo(hw, -y); hole.lineTo(-hw, -y);
    sh.holes.push(hole);
    const g = new THREE.ExtrudeGeometry(sh, { depth: W, bevelEnabled: false, curveSegments: 10 }).translate(0, 0, -W / 2);
    kit.add(M[mat], put(g, px, y, pz, a + Math.PI / 2), { solid: false, shadow: false });
    // the town on its deck
    for (let k = 0; k < 3; k++) {
      const h = 2 + rng() * 8, bw = 3 + rng() * span * 0.25, o = (rng() - 0.5) * W * 0.7, t = (rng() - 0.5) * span * 0.8;
      kit.add(M.town[Math.floor(rng() * M.town.length)], put(new THREE.BoxGeometry(bw, h, 4 + rng() * 6), px + Math.cos(a) * t + Math.sin(a) * o, y + W * 0.4 + h / 2, pz - Math.sin(a) * t + Math.cos(a) * o, a + Math.PI / 2), { solid: false, shadow: false });
    }
  }
}

/** A derrick or a hanging machine: a capsule body with platforms, antennae, a pipe; s its scale. */
function machine(kit, M, { x, y = null, z, s = 1, mat = 'rust', mast = 0, pipeTo = null }) {
  const y0 = y ?? kit.base(x, z, 2 * s);
  if (mast) kit.add(M[mat], wrapped(new THREE.CylinderGeometry(1.2 * s, 2 * s, mast, 10)).translate(x, y0 + mast / 2, z));
  const yb = y0 + mast;
  kit.add(M[mat], wrapped(new THREE.CylinderGeometry(3 * s, 3 * s, 8 * s, 16)).translate(x, yb + 4 * s, z));
  kit.add(M[mat], new THREE.SphereGeometry(3 * s, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2).translate(x, yb + 8 * s, z));
  kit.add(M[mat], new THREE.ConeGeometry(2.2 * s, 4 * s, 12).rotateX(Math.PI).translate(x, yb - 2 * s, z));
  for (const k of [0.3, 0.7]) kit.add(M.rustDark, new THREE.CylinderGeometry(5.5 * s, 5.5 * s, 0.4 * s, 18).translate(x, yb + k * 8 * s, z), { solid: false });
  kit.add(M[mat], new THREE.BoxGeometry(2.5 * s, 3 * s, 2.5 * s).translate(x + 4 * s, yb + 5 * s, z), { solid: false });
  for (const dx of [-1, 0.6]) kit.add(M.dark, new THREE.CylinderGeometry(0.1 * s, 0.1 * s, 6 * s, 4).translate(x + dx * s, yb + 11 * s, z), { solid: false });
  if (pipeTo) pipe(kit, M, [[x, yb + 9 * s, z], [x, pipeTo[1], z], pipeTo], 0.8 * s, { ground: false });
}

/**
 * A recessed portal (IMG_3792 p3): n stone rings, one in front of the other, each a wall with a round-
 * headed opening a step wider than the last, their voussoir joints drawn on the reveals; a vault over
 * them keeps the cave in shade. z the innermost ring's middle, hw / spring its opening's half-width
 * and the height its arch springs from.
 */
function archPortal(kit, M, { z, n = 6, hw = 3, spring = 5, step = 0.8, depth = 2, mat = 'vault' }) {
  for (let i = 0; i < n; i++) {
    const zi = z + i * depth, h = hw + i * step, sp = spring + i * step * 0.6, W = h + 40, top = sp + h + 3;
    const sh = new THREE.Shape();
    sh.moveTo(-W, -1); sh.lineTo(-h, -1); sh.lineTo(-h, sp); sh.absarc(0, sp, h, Math.PI, 0, true); sh.lineTo(h, -1); sh.lineTo(W, -1); sh.lineTo(W, top); sh.lineTo(-W, top); sh.lineTo(-W, -1);
    kit.add(M[mat], new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: false, curveSegments: 24 }).translate(0, 0, zi - depth / 2), { solid: false });
    // the joints on the reveal this ring shows round the next one's opening
    const f = zi + depth / 2 + 0.02, rm = h + step / 2;
    for (let j = 1; j < 14; j++) {
      const t = (Math.PI * j) / 14;
      kit.add(M.dark, new THREE.BoxGeometry(0.07, step, 0.04).rotateZ(t - Math.PI / 2).translate(Math.cos(t) * rm, sp + Math.sin(t) * rm, f), { solid: false, shadow: false });
    }
    for (let y = 1.1 + (i % 2) * 0.6; y < sp; y += 1.3) for (const e of [-1, 1]) kit.add(M.dark, new THREE.BoxGeometry(step, 0.07, 0.04).translate(e * rm, y, f), { solid: false, shadow: false });
  }
  kit.add(M[mat], new THREE.BoxGeometry(120, 4, 40).translate(0, spring + hw + n * step * 1.6 + 2, z + n * depth + 6), { solid: false });
}

/** The moon: a pale disc facing the camera's eye (local), R its radius, a few craters on it. */
function moon(kit, M, c, R, eye = V(0, 1.7, 0), seed = 9) {
  const rng = mulberry32(seed), to = eye.clone().sub(c), nd = { solid: false, shadow: false };
  kit.add(M.moon, new THREE.CircleGeometry(R, 48).lookAt(to).translate(c.x, c.y, c.z), nd);
  for (let i = 0; i < 11; i++) {
    const a = rng() * Math.PI * 2, d = Math.sqrt(rng()) * R * 0.75, r = R * (0.05 + rng() * 0.13);
    kit.add(M.crater, new THREE.CircleGeometry(r, 18).translate(Math.cos(a) * d, Math.sin(a) * d, 0.5 + i * 0.05).lookAt(to).translate(c.x, c.y, c.z), nd);
  }
}

/**
 * The oval tunnel's inside (IMG_3791 p4): an oval tube from the wall at z going back `len`, pale and
 * lit from within, ribs along it, rounded machine forms and pipes along its sides, a brighter far end.
 */
function ovalTunnel(kit, M, { x, y, z, rx, ry, len, seed = 1 }) {
  const rng = mulberry32(seed), nd = { solid: false, shadow: false };
  kit.add(M.aquaIn, new THREE.CylinderGeometry(1, 1, len, 40, 1, true).scale(rx, 1, ry).rotateX(Math.PI / 2).translate(x, y, z - len / 2), nd);
  for (let i = 1; i < 5; i++) kit.add(M.aquaMid, new THREE.TorusGeometry(1, 0.035, 4, 40).scale(rx * 0.99, ry * 0.99, 1).translate(x, y, z - i * len / 5), nd);
  for (let i = 0; i < 14; i++) {
    const t = rng() * Math.PI * 2, s = 0.7 + rng() * 1.6, zz = z - 2 - rng() * (len - 6);
    kit.add(M.aquaMid, new THREE.SphereGeometry(s, 12, 8).scale(1, 1.4 + rng(), 0.9).translate(x + Math.cos(t) * rx * 0.82, y + Math.sin(t) * ry * 0.82, zz), nd);
  }
  for (const e of [-1, 1]) for (let i = 0; i < 3; i++) kit.add(M.aquaMid, new THREE.CylinderGeometry(0.22, 0.22, ry * 1.5, 6).translate(x + e * rx * (0.62 + i * 0.08), y, z - 3 - i * 4 - rng() * 3), nd);
  kit.add(M.glowAqua, new THREE.CircleGeometry(1, 40).scale(rx, ry, 1).translate(x, y, z - len + 0.1), nd);
}

/**
 * A ledge of layered rock (IMG_3792 p5): slabs stacked one on another, each jutting out a step past
 * the one above it, their edges broken, sloping down to the right of the view.
 */
function rockLedge(kit, M, { x, z, y, w, d, layers = 6, seed = 1, drop = 1.1, reach = 2, yaw = 0 }) {
  const rng = mulberry32(seed);
  for (let i = 0; i < layers; i++) {
    const top = y - i * drop, right = x + w / 2 + i * reach, t = i === layers - 1 ? 24 : drop + 0.9;
    const sh = new THREE.Shape(), back = -d / 2, front = d / 2, pts = 12;
    sh.moveTo(x - w * 2, back);
    for (let k = 0; k <= pts; k++) {
      const v = back + (front - back) * (k / pts), bulge = Math.sin((k / pts) * Math.PI) * 1.4;
      sh.lineTo(right + bulge + (rng() - 0.5) * 2.2 + Math.sin(k * 1.7 + i) * 0.8, v);
    }
    sh.lineTo(x - w * 2, front); sh.lineTo(x - w * 2, back);
    // (the shape lies in x, z-from-the-ledge's middle; extruded upward)
    const g = new THREE.ExtrudeGeometry(sh, { depth: t, bevelEnabled: true, bevelThickness: 0.3, bevelSize: 0.55, bevelSegments: 2, curveSegments: 4 }).rotateX(Math.PI / 2).translate(-x, top - 0.3, 0).rotateY(yaw).translate(x, 0, z);
    kit.add(M.ledgeRock, g, { solid: false });
  }
}

/** A figure in the sheets' violet that isn't a person of content.js (on a ledge, in a drum). */
const figureAt = (x, y, z) => (k, M) => {
  const f = new THREE.Mesh(new THREE.ConeGeometry(0.45, 1.7, 8).translate(0, 0.85, 0), M.cloak);
  f.add(new THREE.Mesh(new THREE.SphereGeometry(0.24, 8, 6).translate(0, 1.78, 0), M.cloak));
  f.position.set(x, y, z);
  k.group.add(f);
};

/**
 * A panel's scene. o: { huts, pipes: [[pts, r, blue]…], banks, walls, tanks, machinery, drums, cities, rings,
 * machines, clouds, extra(kit, M) }
 */
function machineScene(kit, v, o) {
  const M = materials(kit);
  for (const h of o.huts ?? []) hut(kit, M, h);
  for (const [pts, r, blue] of o.pipes ?? []) pipe(kit, M, pts, r, { blue });
  for (const b of o.banks ?? []) pipeBank(kit, M, b);
  for (const w of o.walls ?? []) ovalWall(kit, M, w);
  for (const t of o.tanks ?? []) tank(kit, M, t);
  for (const m of o.machinery ?? []) machinery(kit, M, m);
  for (const d of o.drums ?? []) drum(kit, M, d);
  for (const c of o.cities ?? []) hangingCity(kit, M, c);
  for (const r of o.rings ?? []) ring(kit, M, r);
  for (const m of o.machines ?? []) machine(kit, M, m);
  for (const c of [o.clouds ?? []].flat()) cloudSea(kit, M, { at: [v.camera.eye[0], v.camera.eye[2]], yaw: v.camera.yaw ?? 0, deck: false, seed: o.seed ?? 1, ...c });
  o.extra?.(kit, M);
}

// ---------------------------------------------------------------- grounds
const DUNE = { color: '#fde8c4', color2: '#fbe2ba', color3: '#f4d6a8', ripples: true };
const RUST = { color: '#ef9070', color2: '#e7866a', color3: '#d97a5c' };
const TEALG = { color: '#5f8c88', color2: '#58837f', color3: '#6a9692' };
/** Soft dunes: swells rising with the distance, a ridge `ridge` m ahead, and trenches cut ([x0, z0, x1, z1, w, depth]…). */
const dunes = (o = {}) => ({
  height: (x, z) => {
    const d = Math.hypot(x, z);
    let h = 1.2 * nM(x * 0.012, z * 0.012) + 0.3 * nN(x * 0.05, z * 0.05) + smoothstep(100, 900, d) * 18 * (0.6 + 0.4 * nN(x * 0.002, z * 0.002));
    if (o.slope) h += o.slope[0] * x + o.slope[1] * z;
    for (const [x0, z0, x1, z1, w, depth] of o.trenches ?? []) {
      const dx = x1 - x0, dz = z1 - z0, L2 = dx * dx + dz * dz, t = Math.min(Math.max(((x - x0) * dx + (z - z0) * dz) / L2, 0), 1);
      const dd = Math.hypot(x - x0 - t * dx, z - z0 - t * dz);
      h -= depth * (1 - smoothstep(w * 0.5, w * 0.5 + 3, dd)) * smoothstep(0, 0.04, t) * smoothstep(1, 0.96, t);
    }
    return h;
  },
  material: DUNE, rings: { r1: 2600 },
});
/** A floor (rust or teal) for the canyon and the drum, flat with a little grain. */
const floor = (mat = RUST, y = 0) => ({ height: (x, z) => y + 0.15 * nM(x * 0.08, z * 0.08), material: mat, rings: { r1: 2400 } });

const view = (o) => ({ sky: SKY.sage, look: BURIED_LOOK, fog: 0.4, ...o });
const CLOAKED = { palette: PERSON, head: 'hood' };

export const BURIED_VIEWS = [
  // ===================================================================== IMG_3789
  view({
    id: '3789-domes-trench', title: 'The domes on the ridge, the pipes in the trench', sheet: 'IMG_3789', panel: 1, where: 'top left', crop: [39, 31, 312, 467],
    camera: { eye: [0, 16, 10], yaw: 0, fov: 60, horizon: 0.3 },
    sun: { side: -120, el: 45 }, sky: SKY.cream,
    ground: dunes({ slope: [-0.12, 0.1], trenches: [[-26, -12, 40, -32, 16, 10]] }),
    people: [{ at: [-7, -40], facing: 0.3, ...CLOAKED }],
    build(kit, v) {
      machineScene(kit, v, {
        seed: 37891,
        huts: [{ x: -14, z: -95, r: 3.5 }, { x: -1, z: -100, r: 3.8 }, { x: 14, z: -110, r: 5 }],
        extra(k, M) { pipeMass(k, M, { x0: -26, z0: -12, x1: 40, z1: -32, w: 16, deep: 10, seed: 37891, density: 2.6 }); },
      });
    },
  }),
  view({
    id: '3789-city-ring', title: 'The ring and the city hanging over it', sheet: 'IMG_3789', panel: 2, where: 'top right, wide', crop: [366, 31, 625, 467],
    camera: { eye: [0, 2, 0], yaw: 0, fov: 60, pitch: 26 },
    sun: { side: 150, el: 55 },
    ground: dunes(),
    build(kit, v) {
      machineScene(kit, v, {
        seed: 37892,
        rings: [{ cx: 0, cz: -170, R: 260, y: 70, W: 34, a0: Math.PI * 0.55, a1: Math.PI * 1.45, arches: 22 }],
        cities: [{ x: 0, y: 400, z: -240, R: 230, depth: 400, n: 300 }],
        clouds: { y: 30, near: 280, far: 900, n: 30, size: [30, 50], spread: 40 },
      });
    },
  }),
  view({
    id: '3789-rust-ovals', title: 'Ovals in the rust walls', sheet: 'IMG_3789', panel: 3, where: 'bottom left', crop: [37, 520, 311, 467],
    camera: { eye: [0, 1.7, 0], yaw: 0, fov: 62, horizon: 0.82 },
    sun: { side: 150, el: 60 },
    ground: floor(RUST),
    build(kit, v) {
      machineScene(kit, v, {
        seed: 37893,
        walls: [{ x: -2, z: -60, w: 70, h: 60, t: 4, holes: [[-8, 32, 9, 13], [3, 12, 5, 8]] }, { x: -2, z: -140, w: 90, h: 60, t: 4, holes: [[6, 22, 8, 16]] }],
        tanks: [{ x: 19, z: -38, r: 5, h: 70 }, { x: 25, z: -50, r: 4, h: 64 }, { x: 13, z: -70, r: 4, h: 50 }],
        machinery: [{ x0: -16, z0: -5, x1: -16, z1: -58, y0: 0, y1: 24, depth: 5, n: 50, seed: 5 }, { x0: -18, z0: -10, x1: -18, z1: -58, y0: 0, y1: 60, depth: 3, n: 30, seed: 6, mats: ['rustDark', 'rust'] }],
        clouds: { y: 30, near: 200, far: 600, n: 14, size: [20, 34], spread: 20 },
      });
    },
  }),
  view({
    id: '3789-arch-floater', title: 'Under the great arch, the machine floating by', sheet: 'IMG_3789', panel: 4, where: 'bottom middle', crop: [367, 520, 286, 467],
    camera: { eye: [0, 1.7, 0], yaw: 0, fov: 60, horizon: 0.82 },
    sun: { side: -150, el: 55 },
    ground: floor({ color: '#e9a28f', color2: '#e29a88', color3: '#d98d7c' }),
    people: [{ at: [2.5, -9], facing: 0.1, ...CLOAKED }],
    build(kit, v) {
      machineScene(kit, v, {
        seed: 37894,
        walls: [{ x: 10, z: -30, w: 90, h: 80, t: 6, holes: [[12, 22, 26, 40], [-13, 26, 4, 8]], mat: 'lilac', rim: 'tealDark' }],
        machines: [{ x: 14, y: 28, z: -140, s: 2.2 }],
        clouds: { y: 6, near: 150, far: 700, n: 30, size: [20, 36], spread: 25, yaw: 15 },
        extra(k, M) { k.add(M.glowPeach, put(new THREE.CircleGeometry(1, 40).scale(4, 8, 1), -3, 1.7 + 24.3, -26.9), { solid: false }); },
      });
    },
  }),
  view({
    id: '3789-oculus-canyon', title: 'The drum open to the sky, from the canyon', sheet: 'IMG_3789', panel: 5, where: 'bottom right', crop: [672, 520, 315, 467],
    camera: { eye: [0, 1.7, 0], yaw: 0, fov: 64, horizon: 0.82 },
    sun: { side: 160, el: 60 },
    ground: floor(RUST),
    build(kit, v) {
      machineScene(kit, v, {
        seed: 37895,
        drums: [{ x: 0, z: -92, r: 30, y1: 58, mat: 'slate', lit: 0.1, inside: 0.8, gap: 1.7, roof: 17, vault: 8, roofShadow: false }],
        walls: [{ x: 0, z: -40, w: 80, h: 70, t: 4, holes: [[0, 30, 21, 30]], mat: 'rust' }],
        machinery: [{ x0: -14, z0: -2, x1: -14, z1: -38, y0: 0, y1: 50, depth: 5, n: 50, seed: 7 }, { x0: 14, z0: -2, x1: 14, z1: -38, y0: 0, y1: 50, depth: 5, n: 50, seed: 8 }],
        tanks: [{ x: -17, z: -20, r: 4, h: 60 }],
        clouds: { y: 260, near: 300, far: 700, n: 20, size: [30, 50], spread: 30 },
      });
    },
  }),
  // ===================================================================== IMG_3790
  view({
    id: '3790-domes-pipes', title: 'Domes and pipe elbows in the dunes', sheet: 'IMG_3790', panel: 1, where: 'top left', crop: [27, 30, 312, 474],
    camera: { eye: [0, 7, 0], yaw: 0, fov: 56, horizon: 0.5 },
    sun: { side: -130, el: 45 }, sky: SKY.cream,
    ground: dunes(),
    build(kit, v) {
      machineScene(kit, v, {
        seed: 37901,
        huts: [{ x: -10, z: -75, r: 3.5 }, { x: -3, z: -76, r: 3.5, sage: true }, { x: 4, z: -48, r: 3.5, sage: true }, { x: 7, z: -27, r: 3, sage: true }],
        pipes: [[[[-16, -0.3, -30], [-10, 1.6, -30], [-3, 0.6, -24]], 1.2, false], [[[-6, 0.4, -40], [1, 1.4, -42], [6, 0.3, -37]], 1.0, false],
          [[[2, -0.4, -10], [6, 1.4, -11], [14, 1.4, -14]], 1.6, false], [[[-12, 0.2, -14], [-8, 1.0, -12], [-3, 0.2, -12]], 1.2, false]],
      });
    },
  }),
  view({
    id: '3790-city-tip', title: 'The tip of the hanging city', sheet: 'IMG_3790', panel: 2, where: 'top middle', crop: [358, 31, 309, 473],
    camera: { eye: [0, 2, 0], yaw: 0, fov: 66, pitch: 32 },
    sun: { side: 150, el: 55 },
    ground: dunes(),
    build(kit, v) {
      machineScene(kit, v, {
        seed: 37902,
        cities: [{ x: -10, y: 420, z: -220, R: 140, depth: 230, n: 220 }],
        clouds: { y: 40, near: 200, far: 700, n: 24, size: [34, 60], spread: 30, yaw: 20 },
      });
    },
  }),
  view({
    id: '3790-tube-mouth', title: 'Out of the great tube over the rust city', sheet: 'IMG_3790', panel: 3, where: 'top right', crop: [685, 30, 311, 473],
    camera: { eye: [-22, 4, -10], yaw: 28, fov: 66, horizon: 0.5 },
    sun: { side: 120, el: 50 }, sky: SKY.blue,
    ground: floor(RUST, -90),
    build(kit, v) {
      machineScene(kit, v, {
        seed: 37903,
        extra(k, M) {
          k.add(M.teal, wrapped(new THREE.CylinderGeometry(40, 40, 90, 64, 1, true)).rotateX(Math.PI / 2).translate(0, 4, -20), { solid: false });
          k.add(M.tealDark, new THREE.TorusGeometry(40, 2.2, 6, 64).translate(0, 4, -65), { solid: false });
          // the city far below: blocks to the horizon
          const rng = mulberry32(3790);
          for (let i = 0; i < 700; i++) {
            const a = (rng() - 0.5) * 1.6 + 0.4, d = 90 + Math.pow(rng(), 0.7) * 700, x = Math.sin(a) * d, z = -60 - Math.cos(a) * d, h = 4 + rng() * 26, w = 5 + rng() * 14;
            k.add(M.boxes[Math.floor(rng() * M.boxes.length)], new THREE.BoxGeometry(w, h, w * (0.6 + rng())).translate(x, -90 + h / 2, z), { solid: false, shadow: false });
          }
        },
        clouds: { y: 60, near: 250, far: 900, n: 30, size: [30, 50], spread: 30, yaw: 30 },
      });
    },
  }),
  view({
    id: '3790-canyon-arch', title: 'A child before the arch in the rust canyon', sheet: 'IMG_3790', panel: 4, where: 'bottom left', crop: [30, 522, 311, 469],
    camera: { eye: [0, 1.7, 0], yaw: 0, fov: 60, horizon: 0.75 },
    sun: { side: -160, el: 60 }, sky: SKY.blue,
    ground: floor(RUST),
    people: [{ at: [1, -6], facing: 0, ...CLOAKED }],
    build(kit, v) {
      machineScene(kit, v, {
        seed: 37904,
        walls: [{ x: -2, z: -40, w: 60, h: 50, t: 5, holes: [[-7, 10, 6.5, 11]] }],
        tanks: [{ x: 10, z: -30, r: 4, h: 50, mat: 'rustPale' }, { x: 17, z: -24, r: 4, h: 60, mat: 'rustPale' }],
        machinery: [{ x0: -11, z0: -2, x1: -11, z1: -36, y0: 0, y1: 40, depth: 4, n: 40, seed: 9, mats: ['rust', 'rustPale'] }],
        extra(k, M) { k.add(M.rust, new THREE.BoxGeometry(18, 6, 30).translate(-12, 28, -18)); },
      });
    },
  }),
  view({
    id: '3790-oval-derrick', title: 'The derrick through the oval', sheet: 'IMG_3790', panel: 5, where: 'bottom middle', crop: [359, 522, 311, 469],
    camera: { eye: [0, 1.7, 0], yaw: 0, fov: 60, horizon: 0.7 },
    sun: { side: -120, el: 45 }, sky: SKY.blue,
    ground: dunes({ slope: [0.06, 0] }),
    build(kit, v) {
      machineScene(kit, v, {
        seed: 37905,
        walls: [{ x: 0, z: -8, w: 40, h: 40, t: 2, holes: [[3.5, 6, 5, 12]], mat: 'green', rim: 'teal' }],
        machines: [{ x: 22, z: -120, s: 2, mast: 60, mat: 'green' }, { x: 6, z: -170, s: 1.2, mast: 20, mat: 'green' }],
        extra(k, M) { for (const [x, y] of [[-2.6, 5], [-2.5, 3.4], [-2.7, 1.8], [-2.4, 6.6]]) k.add(M.lamp, new THREE.SphereGeometry(0.12, 8, 6).translate(x, y, -6.9), { solid: false }); },
      });
    },
  }),
  view({
    id: '3790-teal-porthole', title: 'The porthole in the teal hall', sheet: 'IMG_3790', panel: 6, where: 'bottom right', crop: [690, 522, 310, 469],
    camera: { eye: [0, 1.7, 0], yaw: 0, fov: 60, horizon: 0.5 },
    sun: { side: 160, el: 30 },
    ground: floor(TEALG),
    build(kit, v) {
      machineScene(kit, v, {
        seed: 37906,
        walls: [{ x: 0, z: -30, w: 70, h: 60, t: 3, holes: [[0, 9, 7, 7]], mat: 'teal', rim: 'tealPale' }],
        machinery: [{ x0: -24, z0: -28, x1: 24, z1: -28, y0: 0, y1: 40, depth: 3, n: 90, seed: 11, mats: ['teal', 'tealDark'], lamps: 6 }, { x0: -14, z0: -2, x1: -14, z1: -28, y0: 0, y1: 30, depth: 4, n: 30, seed: 12, mats: ['teal', 'tealDark'] }, { x0: 14, z0: -2, x1: 14, z1: -28, y0: 0, y1: 30, depth: 4, n: 30, seed: 13, mats: ['teal', 'tealDark'] }],
        extra(k, M) { k.add(M.tealDark, new THREE.BoxGeometry(40, 2, 32).translate(0, 32, -14), { solid: false }); },
        clouds: { y: 10, near: 160, far: 500, n: 22, size: [16, 30], spread: 10 },
      });
    },
  }),
  // ===================================================================== IMG_3791
  view({
    id: '3791-domes-pipeline', title: 'Domes past the pipeline', sheet: 'IMG_3791', panel: 1, where: 'top left', crop: [39, 35, 305, 475],
    camera: { eye: [0, 6, 0], yaw: 0, fov: 62, pitch: -18 },
    sun: { side: -120, el: 50 },
    ground: dunes({ trenches: [[-40, -12, 40, -12, 8, 5]] }),
    build(kit, v) {
      machineScene(kit, v, {
        seed: 37911,
        huts: [{ x: -26, z: -120, r: 3 }, { x: -5, z: -125, r: 4 }, { x: 6, z: -122, r: 4.5 }],
        pipes: [[[[-40, -0.5, -10], [40, -0.5, -10]], 1.3, true], [[[-40, -0.2, -13], [40, -0.2, -13]], 1.1, true], [[[-40, 0.2, -7], [10, 0.2, -7], [14, 2, -6], [14, 6, -8]], 1.2, true], [[[-6, -1, -14], [-6, 2.5, -10], [-2, 3, -6]], 1, false]],
        clouds: { y: 30, near: 220, far: 700, n: 26, size: [40, 70], spread: 30, yaw: 15 },
      });
    },
  }),
  view({
    id: '3791-city-spire', title: 'The spire of the hanging city over the domes', sheet: 'IMG_3791', panel: 2, where: 'top middle', crop: [355, 33, 305, 474],
    camera: { eye: [0, 2, 0], yaw: 0, fov: 64, horizon: 0.93 },
    sun: { side: 150, el: 55 },
    ground: dunes(),
    build(kit, v) {
      machineScene(kit, v, {
        seed: 37912,
        cities: [{ x: 10, y: 560, z: -420, R: 120, depth: 260, n: 200 }],
        huts: [{ x: -30, z: -260, r: 4 }, { x: 10, z: -280, r: 5 }, { x: 60, z: -300, r: 4 }],
        clouds: { y: 4, near: 500, far: 1400, n: 40, size: [40, 70], spread: 30 },
      });
    },
  }),
  view({
    id: '3791-disc-tower', title: 'The disc town round the pink tower', sheet: 'IMG_3791', panel: 3, where: 'top right', crop: [670, 31, 313, 474],
    camera: { eye: [0, 10, 0], yaw: 0, fov: 64, horizon: 0.6 },
    sun: { side: 140, el: 50 },
    ground: floor(RUST, -120),
    build(kit, v) {
      machineScene(kit, v, {
        seed: 37913,
        extra(k, M) {
          k.add(M.rustPale, wrapped(new THREE.CylinderGeometry(70, 66, 6, 56)).translate(0, -3, -130));
          k.add(M.teal, wrapped(new THREE.CylinderGeometry(55, 30, 60, 40, 1, true)).translate(0, -36, -130), { solid: false });
          k.add(M.rustPale, wrapped(new THREE.CylinderGeometry(9, 10, 160, 24)).translate(4, 70, -140));
          k.add(M.teal, new THREE.TorusGeometry(80, 4, 6, 64, Math.PI).translate(0, 120, -110), { solid: false });
          const rng = mulberry32(3791);
          for (let i = 0; i < 120; i++) { const a = rng() * Math.PI * 2, r = 20 + rng() * 46, h = 2 + rng() * 9; k.add(M.town[Math.floor(rng() * 3)], new THREE.BoxGeometry(4 + rng() * 6, h, 4 + rng() * 6).translate(Math.sin(a) * r, h / 2, -130 + Math.cos(a) * r), { solid: false }); }
          for (const sx of [-1, 1]) k.add(M.rustPale, new THREE.BoxGeometry(14, 200, 40).translate(sx * 52, 40, -50));
        },
        clouds: { y: -30, near: 160, far: 700, n: 30, size: [24, 40], spread: 30 },
      });
    },
  }),
  view({
    id: '3791-rust-mirror', title: 'The glowing oval in the rust wall', sheet: 'IMG_3791', panel: 4, where: 'bottom left', crop: [42, 520, 303, 460],
    camera: { eye: [0, 1.7, 0], yaw: -8, fov: 60, horizon: 0.6 },
    sun: { side: 150, el: 50 },
    ground: floor({ color: '#d77d5c', color2: '#cf7454', color3: '#c46a4c', grid: 1.4 }),
    build(kit, v) {
      machineScene(kit, v, {
        seed: 37914,
        walls: [{ x: 2, z: -14, w: 40, h: 40, t: 2, holes: [[-1, 6, 4.5, 7.5], [7.5, 4.5, 1, 1.4]], mat: 'rust', rim: 'glowAqua' }],
        machinery: [{ x0: -14, z0: -3, x1: -14, z1: -13, y0: 0, y1: 30, depth: 2, n: 20, seed: 15, mats: ['rustDark', 'rust'] }],
        extra(k, M) {
          ovalTunnel(k, M, { x: 1, y: 6, z: -15, rx: 4.4, ry: 7.4, len: 26, seed: 3791 });
        },
      });
    },
  }),
  view({
    id: '3791-oval-derrick', title: 'The aqua oval and the derrick', sheet: 'IMG_3791', panel: 5, where: 'bottom middle', crop: [356, 519, 307, 460],
    camera: { eye: [0, 1.7, 0], yaw: 0, fov: 58, horizon: 0.75 },
    sun: { side: -110, el: 45 },
    ground: dunes({ slope: [0.04, 0] }),
    build(kit, v) {
      machineScene(kit, v, {
        seed: 37915,
        walls: [{ x: -1, z: -10, w: 14, h: 40, t: 2.4, holes: [[-1, 11, 5, 12]], mat: 'tealPale', rim: 'teal', fill: 'glowAqua' }],
        machines: [{ x: 16, z: -110, s: 1.8, mast: 40, mat: 'teal' }],
        clouds: { y: 2, near: 200, far: 800, n: 30, size: [24, 44], spread: 20, yaw: 15 },
      });
    },
  }),
  view({
    id: '3791-oculus-traveller', title: 'The traveller in the drum', sheet: 'IMG_3791', panel: 6, where: 'bottom right', crop: [673, 518, 312, 461],
    camera: { eye: [0, 1.7, 0], yaw: 0, fov: 64, pitch: 12 },
    sun: { side: 170, el: 60 },
    ground: floor({ color: '#c6dce4', color2: '#bcd3dc', color3: '#d1e5ea' }),
    people: [{ at: [0.6, -5], facing: 3.1, ...CLOAKED }],
    build(kit, v) {
      machineScene(kit, v, {
        seed: 37916,
        drums: [{ x: 0, z: -30, r: 40, y1: 34, mat: 'teal', lit: 0.5, slits: 30, inside: 1.3, roof: 14, off: 22 }],
        clouds: { y: 120, near: 300, far: 700, n: 30, size: [30, 50], spread: 25 },
      });
    },
  }),
  // ===================================================================== IMG_3792
  view({
    id: '3792-dunes-city', title: 'The dunes, the pillar, the city and the ring', sheet: 'IMG_3792', panel: 1, where: 'top, wide', crop: [25, 28, 971, 300],
    camera: { eye: [0, 2, 0], yaw: 0, fov: 32, horizon: 0.55 },
    sun: { side: -130, el: 45 }, sky: ['#fdeed2', '#e7e6c8', TINT, '#ffffff', '#fff6dc'],
    ground: dunes({ slope: [0, 0.02] }),
    build(kit, v) {
      machineScene(kit, v, {
        seed: 37921,
        huts: [{ x: -62, z: -110, r: 3.6 }, { x: -46, z: -116, r: 3, sage: true }, { x: -30, z: -125, r: 3.4 }, { x: -24, z: -128, r: 2.4 }],
        pipes: [[[[-58, 2, -112], [-52, 6, -112], [-48, 6, -110], [-48, 1, -108]], 1.4, false], [[[-36, 3, -120], [-36, 9, -120], [-32, 9, -120]], 1.0, false]],
        cities: [{ x: 120, y: 120, z: -380, R: 110, depth: 70, n: 160 }],
        rings: [{ cx: 380, cz: -260, R: 160, y: 60, W: 26, a0: -Math.PI * 0.9, a1: -Math.PI * 0.4, arches: 8 }],
        clouds: { y: 6, near: 400, far: 1200, n: 30, size: [30, 60], spread: 25, yaw: 20 },
        extra(k, M) { k.add(M.cream, new THREE.CylinderGeometry(2.4, 3.2, 90, 14).translate(-6, k.H(-6, -120) + 40, -120)); },
      });
    },
  }),
  view({
    id: '3792-tube-up', title: 'Up the great tube to the sky', sheet: 'IMG_3792', panel: 2, where: 'middle left, wide', crop: [25, 340, 645, 325],
    camera: { eye: [0, 0, 0], yaw: 0, fov: 54, pitch: 62 },
    sun: { side: 160, el: 60 }, sky: ['#a9c4b9', '#b9cdc1', TINT, '#ffffff', '#fff6dc'],
    ground: floor(RUST, -20),
    build(kit, v) {
      machineScene(kit, v, {
        seed: 37922,
        extra(k, M) {
          k.add(M.rustPale, wrapped(new THREE.CylinderGeometry(60, 60, 260, 64, 1, true)).translate(0, 120, -60), { solid: false });
          const rng = mulberry32(3792);
          for (let i = 0; i < 500; i++) {
            const a = rng() * Math.PI * 2, y = rng() * 230, w = 3 + rng() * 9, h = 3 + rng() * 9;
            k.add(M.boxes[Math.floor(rng() * M.boxes.length)], put(new THREE.BoxGeometry(w, h, 2 + rng() * 6), Math.sin(a) * 58, y, -60 + Math.cos(a) * 58, a), { solid: false, shadow: false });
          }
          for (let j = 1; j < 6; j++) k.add(M.rust, new THREE.TorusGeometry(59, 1.4, 4, 64).rotateX(Math.PI / 2).translate(0, j * 40, -60), { solid: false, shadow: false });
          k.add(M.lamp, new THREE.SphereGeometry(4, 10, 8).translate(10, 900, -260), { solid: false, shadow: false });
        },
        clouds: { y: 420, near: 300, far: 800, n: 20, size: [40, 70], spread: 30 },
      });
    },
  }),
  view({
    id: '3792-arch-moon', title: 'The moon over the drum, through the green arch', sheet: 'IMG_3792', panel: 3, where: 'right, tall', crop: [683, 341, 315, 654],
    camera: { eye: [0, 1.7, 0], yaw: 0, fov: 70, pitch: 14 },
    sun: { side: 170, el: 60 }, sky: ['#c9c3d6', '#d9d3e2', TINT, '#ffffff', '#fff6dc'],
    // (the cave's mouth opens a little above the drum's floor; the moon, a great pale disc, hangs in its far wall)
    ground: { ...floor(TEALG), height: (x, z) => 0.15 * nM(x * 0.08, z * 0.08) - 8 * smoothstep(-13, -16, z) },
    build(kit, v) {
      machineScene(kit, v, {
        seed: 37923,
        drums: [{ x: 0, z: -62, r: 40, y0: -8, y1: 130, mat: 'slate', lit: 0.6, slits: 0, gap: 1.0, inside: 0.5, ribs: false }],
        machinery: [{ x0: -30, z0: -86, x1: 30, z1: -86, y0: -8, y1: 2, depth: 7, n: 90, seed: 17, mats: ['teal', 'tealDark', 'green'], lamps: 26 },
          { x0: -26, z0: -40, x1: 26, z1: -76, y0: -8, y1: -2, depth: 7, n: 80, seed: 18, mats: ['teal', 'tealDark', 'green'], lamps: 20 }],
        extra(k, M) {
          archPortal(k, M, { z: -12, n: 6, hw: 3.2, spring: 10.5, step: 0.8, depth: 1.9 });
          moon(k, M, V(-2, 37, -96), 16);
        },
      });
    },
  }),
  view({
    id: '3792-portal-ring', title: 'Walking into the ring of light', sheet: 'IMG_3792', panel: 4, where: 'bottom left', crop: [25, 678, 321, 318],
    camera: { eye: [0, 1.7, 0], yaw: 0, fov: 54, horizon: 0.6 },
    sun: { side: 175, el: 25 },
    ground: floor({ color: '#c8cdb4', color2: '#bfc5ab', color3: '#d1d6be' }),
    people: [{ at: [0.4, -7], facing: 3.1, ...CLOAKED }],
    build(kit, v) {
      machineScene(kit, v, {
        seed: 37924,
        walls: [{ x: 0, z: -24, w: 40, h: 26, t: 3, holes: [[0, 6.5, 5.5, 5.5]], mat: 'green', rim: 'glowPeach', fill: 'glowPeach' }],
        extra(k, M) {
          for (const sx of [-1, 1]) k.add(M.green, new THREE.BoxGeometry(2, 24, 30).translate(sx * 8, 12, -9));
          k.add(M.green, new THREE.BoxGeometry(18, 2, 30).translate(0, 18, -9), { solid: false });
          k.add(M.lamp, put(new THREE.TorusGeometry(6.3, 0.35, 6, 48), 0, 6.5, -22.3, 0), { solid: false });
        },
      });
    },
  }),
  view({
    id: '3792-hanging-capsule', title: 'The capsule hanging from its pipe', sheet: 'IMG_3792', panel: 5, where: 'bottom middle', crop: [359, 678, 310, 318],
    camera: { eye: [0, 0, 0], yaw: 0, fov: 50, horizon: 0.75 },
    sun: { side: -140, el: 45 },
    ground: { height: (x, z) => -6 + 4 * smoothstep(-6, -16, x) - 0.15 * Math.max(0, -z) - 200 * smoothstep(-20, -40, z) * smoothstep(-25, -5, x), material: { color: '#b9c3aa', color2: '#aeb99f', color3: '#c3ccb5', pattern: 'cracks' }, rings: { r1: 2400 } },
    build(kit, v) {
      machineScene(kit, v, {
        seed: 37925,
        machines: [{ x: -4, y: 12, z: -60, s: 1.4, mat: 'green', pipeTo: [-40, 22, -60] }],
        clouds: { y: -6, near: 120, far: 700, n: 30, size: [24, 44], spread: 25, yaw: 20 },
        extra(k, M) { rockLedge(k, M, { x: -16, z: -14, y: 2.2, w: 20, d: 16, layers: 7, drop: 0.8, reach: 1.5, yaw: 0.45, seed: 3792 }); },
      });
    },
  }),
];

/** The world's sheets and views (the registry, reference-worlds.js, loads them by these names). */
export { BURIED_SHEETS as SHEETS, BURIED_VIEWS as VIEWS };
