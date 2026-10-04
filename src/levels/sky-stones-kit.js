import * as THREE from 'three';
import { createNoise2D, mulberry32, lerp } from '../noise.js';

// The Sky Stones' rock builders (Vael II, src/levels/arzach2.js): mushroom tables,
// needle spires, boulders, all as position-only geometry ready to merge. Shared with
// the title screen's vista (src/title-vista.js), which raises a few of them out of
// its own sea of cloud. Pure geometry: no materials, no scene.

export const TAU = Math.PI * 2;
export const nA = createNoise2D(1975), nB = createNoise2D(2112), nC = createNoise2D(77);


/** Keep only positions (non-indexed) so everything merges. */
export function clean(g) {
  const n = g.index ? g.toNonIndexed() : g;
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', n.getAttribute('position').clone());
  return out;
}
const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler();
export function place(g, x, y, z, ry = 0, sx = 1, sy = sx, sz = sx, rx = 0, rz = 0) {
  _q.setFromEuler(_e.set(rx, ry, rz));
  return g.applyMatrix4(_m4.compose(new THREE.Vector3(x, y, z), _q, new THREE.Vector3(sx, sy, sz)));
}
/** Lumpy displacement along the direction from the origin (position-based, so seams stay welded). */
export function lumpy(g, amt, freq, seed = 0) {
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const k = 1 + amt * (nA(x * freq + seed, y * freq - z * freq * 0.7) * 0.7 + nB(z * freq * 2.1 - seed, y * freq * 2.1 + x) * 0.3);
    p.setXYZ(i, x * k, y * k, z * k);
  }
  return g;
}

/**
 * A closed rock body made of horizontal rings. Each ring is {y, r, ox, oz};
 * shape(a, ring) -> [radius multiplier, y offset] gives the outline, flutes
 * and ribs. The profile runs from the foot, up the side, under any overhang,
 * over the rim and onto the top, so every face points outward.
 */
export function solid(rings, seg, shape, { top = null, bottom = null } = {}) {
  const P = rings.map((rg) => {
    const ring = [];
    for (let j = 0; j < seg; j++) {
      const a = (j / seg) * TAU;
      const [m, dy] = shape ? shape(a, rg) : [1, 0];
      ring.push([rg.ox + Math.cos(a) * rg.r * m, rg.y + dy, rg.oz + Math.sin(a) * rg.r * m]);
    }
    return ring;
  });
  const pos = [];
  const tri = (a, b, c) => pos.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
  for (let i = 0; i < P.length - 1; i++) {
    for (let j = 0; j < seg; j++) {
      const j2 = (j + 1) % seg;
      const a = P[i][j], b = P[i][j2], c = P[i + 1][j], d = P[i + 1][j2];
      tri(a, c, b); tri(b, c, d);
    }
  }
  if (top) { const L = P[P.length - 1]; for (let j = 0; j < seg; j++) tri(L[j], top, L[(j + 1) % seg]); }
  if (bottom) { const F = P[0]; for (let j = 0; j < seg; j++) tri(F[j], F[(j + 1) % seg], bottom); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  return g;
}

/**
 * Mushroom table / plateau: an eroded, fluted stalk, a wide cap with a
 * ribbed (radiating) underside, a rounded rim and a gently domed top.
 * off shifts the cap relative to the stalk for one-sided overhangs.
 */
export function table(o) {
  const { x, z, R, stalk, top, base = -120, dome = 1, seed = 0, rib = 0, ribK = 24, flute = 0.08, fluteK = 11,
    outline = 0.14, waist = 0.12, foot = 1.25, neckR = 1, seg = 112, colSeg = 18, ledges = 0 } = o;
  const capT = o.capT ?? R * 0.16, under = o.under ?? R * 0.22, off = o.off ?? [0, 0];
  const neckY = top - capT - under;
  const rings = [];
  const NS = ledges ? 14 : 8;
  for (let i = 0; i <= NS; i++) {
    const t = i / NS;
    const step = ledges * (i % 2 ? 1 : -0.4) * (0.5 + 0.5 * nC(i * 1.7, seed));   // strata ledges
    rings.push({ y: lerp(base, neckY, t) + (i % 2 || i === NS ? 0 : ledges * 30 * nC(i, seed + 3)), r: stalk * (lerp(foot, neckR, Math.pow(t, 0.7)) - waist * Math.sin(Math.PI * t) + step), ox: 0, oz: 0, kind: 's', u: t });
  }
  const NU = 10;
  for (let i = 1; i <= NU; i++) {
    const u = i / NU, w = Math.pow(u, 0.8);
    rings.push({ y: neckY + under * Math.pow(u, 1.9), r: lerp(stalk * neckR * 1.04, R, Math.pow(u, 0.7)), ox: off[0] * w, oz: off[1] * w, kind: 'u', u });
  }
  const [ox, oz] = off;
  rings.push({ y: top - capT * 0.55, r: R * 1.015, ox, oz, kind: 'c' });
  rings.push({ y: top - capT * 0.14, r: R * 0.975, ox, oz, kind: 'c' });
  for (const k of [0.9, 0.72, 0.5, 0.26]) rings.push({ y: top + dome * (1 - k * k), r: R * k, ox, oz, kind: 't' });
  const stalkLine = (ca, sa, y) => 1 + 0.13 * nB(ca * 1.4 + seed + y * 0.006, sa * 1.4 + y * 0.011);
  const capLine = (ca, sa) => 1 + outline * nA(ca * 1.1 + seed, sa * 1.1 - seed) + outline * 0.35 * nB(ca * 3 + seed, sa * 3 - seed);
  const shape = (detail) => (a, rg) => {
    const ca = Math.cos(a), sa = Math.sin(a);
    if (rg.kind === 's') {
      const fl = detail ? 1 - flute * Math.pow(0.5 + 0.5 * Math.sin(fluteK * a + 2.5 * nA(ca + seed, sa + rg.y * 0.02)), 3) : 1;
      return [stalkLine(ca, sa, rg.y) * fl, 0];
    }
    if (rg.kind === 'u') {
      const m = lerp(stalkLine(ca, sa, rg.y), capLine(ca, sa), Math.pow(rg.u, 0.6));
      const dy = detail && rib && rg.u < 0.7 ? -rib * Math.pow(Math.abs(Math.sin(ribK * a)), 0.6) * Math.sin(Math.PI * rg.u / 0.7) * (0.55 + 0.45 * nB(ca * 5 + seed, sa * 5)) : 0;
      return [m, dy];
    }
    return [capLine(ca, sa), 0];
  };
  const apex = [x + ox, top + dome, z + oz];
  const vis = place(solid(rings, seg, shape(true), { top: [ox, top + dome, oz] }), x, 0, z);
  // the collision copy keeps every other stalk / underside ring
  const coarse = rings.filter((rg, i) => rg.kind === 'c' || rg.kind === 't' || i % 2 === 0 || i === NS || i === rings.length - 1);
  const col = place(solid(coarse, colSeg, shape(false), { top: [ox, top + dome, oz] }), x, 0, z);
  // a slightly shrunken copy that casts the shadow, so the cap never shadows its own rim
  const inner = coarse.map((rg) => ({ ...rg, r: rg.r * 0.95, y: rg.y - Math.min(0.8, R * 0.03) }));
  const shadow = place(solid(inner, colSeg, shape(false), { top: [ox, top + dome * 0.9, oz] }), x, 0, z);
  return { vis, col, shadow, apex };
}

/** A needle spire: slender, lumpy, vertically fluted, with shoulders. */
export function needle(o) {
  const { x, y, z, H, R, seed = 0, seg = 16, rings = 24, flute = 0.16, lean = 0.06 } = o;
  const rng = mulberry32(Math.floor(seed * 1000) + 7);
  const k = 4 + Math.floor(rng() * 4);
  const sh = [[0.2 + rng() * 0.3, 0.12 + rng() * 0.2], [0.5 + rng() * 0.3, 0.08 + rng() * 0.15]];
  const la = rng() * TAU;
  // a stalagmite-like taper: a flared foot, waxy shoulders, a blunt rounded tip
  const prof = (t) => {
    let r = (1 + 0.45 * Math.pow(1 - t, 10)) * (1 - 0.86 * Math.pow(t, 1.15));
    for (const [t0, s] of sh) r *= 1 + s * Math.exp(-(((t - t0) / 0.06) ** 2));
    return r;
  };
  const make = (sg, nr, detail) => {
    const rs = [{ y: -R * 0.8, r: R * 1.35, ox: 0, oz: 0, t: 0 }];
    for (let i = 0; i < nr; i++) {
      const t = (i / nr) * 0.985;
      const bend = lean * H * t * t;
      const tip = t > 0.93 ? Math.sqrt(Math.max(1 - ((t - 0.93) / 0.07) ** 2, 0.08)) : 1;
      rs.push({ y: t * H, r: R * prof(t) * tip, ox: Math.cos(la) * bend, oz: Math.sin(la) * bend, t });
    }
    const shape = (a, rg) => {
      const ca = Math.cos(a), sa = Math.sin(a);
      let m = 1 + 0.15 * nA(ca * 1.5 + seed * 3, sa * 1.5 + rg.t * 7);
      if (detail) {
        m += 0.07 * nB(ca * 3 + seed, sa * 3 + rg.t * 16);
        m *= 1 - flute * (1 - rg.t * 0.6) * Math.pow(0.5 + 0.5 * Math.cos(k * a + 1.6 * nB(rg.t * 2.5, seed * 5)), 3);
      }
      return [m, 0];
    };
    const bend = lean * H;
    return place(solid(rs, sg, shape, { top: [Math.cos(la) * bend, H * 0.997, Math.sin(la) * bend] }), x, y, z);
  };
  return { vis: make(seg, rings, true), col: make(6, 5, false), tip: [x, y + H, z] };
}

/** Rounded boulder / egg. */
export function boulder(r, sx, sy, sz, egg = 0, seed = 0, detail = true) {
  const g = detail ? new THREE.SphereGeometry(1, 14, 10) : new THREE.IcosahedronGeometry(1, 0);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const yy = p.getY(i), k = 1 - egg * yy;
    p.setXYZ(i, p.getX(i) * k, yy, p.getZ(i) * k);
  }
  lumpy(g, detail ? 0.1 : 0.05, 1.3, seed);
  g.scale(r * sx, r * sy, r * sz);
  return clean(g);
}
