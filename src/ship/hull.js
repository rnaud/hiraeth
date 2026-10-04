import * as THREE from 'three';
import {
  shell, holeReveal, holeFrame, latitudeRing, meridian, sector, polar, tangentFrame, surfacePoly, blob, arcStroke, surfaceRibbon,
} from './geo.js';

// The ship's outside: a round hull with panel lines, a terracotta belt,
// portholes, antennae, four landing legs, a hatch with a telescoping ramp
// and, on the flank, the scorch from the impact: three dots over an arc.

export const R = 13;            // outer hull radius
export const RI = 12.6;         // inner hull radius
export const DECK = -9;         // floor height (ship-local, from the hull centre)
export const CEIL = DECK + 4;   // ceiling height
export const LIFT = 13.5;       // hull centre above the ground when parked on its legs (deck 4.5 m up)
export const HATCH_A = Math.PI / 2;
export const HATCH = { a0: HATCH_A - 0.105, a1: HATCH_A + 0.105, y0: DECK, y1: DECK + 2.75 };
export const WINDOW = { a0: Math.PI - 0.55, a1: Math.PI + 0.55, y0: DECK + 1.05, y1: DECK + 3.45 };
export const HINGE_R = 10.1;    // the ramp's hinge: the outer edge of the threshold
export const LEG_A = [Math.PI / 4, (3 * Math.PI) / 4, (5 * Math.PI) / 4, (7 * Math.PI) / 4];
export const SCAR = { a: 2.25, y: -2.4 };   // where the glyph is scorched (front quarter, below the belt)

const rAt = (r, y) => Math.sqrt(Math.max(r * r - y * y, 0));
const Y = new THREE.Vector3(0, 1, 0);
export const adiff = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));

/** A cylinder between two points. */
export function strut(p, q, r0, r1 = r0, seg = 7) {
  const d = new THREE.Vector3().subVectors(q, p);
  const g = new THREE.CylinderGeometry(r1, r0, d.length(), seg, 1);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(Y, d.clone().normalize()));
  g.translate((p.x + q.x) / 2, (p.y + q.y) / 2, (p.z + q.z) / 2);
  return g;
}

/**
 * Build the exterior into `batch`. Returns the moving parts' geometry
 * builders (door, ramp) and the leg feet.
 * @param o { legs: 'down' | 'up' | 'broken', footY(a) -> ship-local foot height, portGlass }
 */
export function buildHull(batch, o = {}) {
  const legs = o.legs ?? 'down';
  // shells: the outside, and the inside only where the rooms are (between floor and ceiling)
  batch.add('hull', shell({ r: R, holes: [HATCH, WINDOW], aSeg: 80, tSeg: 44 }));
  batch.add('wallIn', shell({ r: RI, holes: [HATCH, WINDOW], aSeg: 80, tSeg: 60, inward: true, yMin: DECK - 0.6, yMax: CEIL + 0.6 }));
  batch.add('trim', holeReveal(HATCH, RI, R));
  batch.add('trim', holeReveal(WINDOW, RI, R, 16));
  batch.add('teal', holeFrame(HATCH, R + 0.02, 0.16));
  batch.add('dark', holeFrame(WINDOW, R + 0.02, 0.2, 16));
  batch.add('dark', holeFrame(WINDOW, RI - 0.02, 0.12, 16));
  // window mullions (in the middle of the hull's thickness)
  for (let k = 1; k < 6; k++) {
    const a = WINDOW.a0 + ((WINDOW.a1 - WINDOW.a0) * k) / 6;
    batch.add('dark', meridian((R + RI) / 2, a, WINDOW.y0, WINDOW.y1, 0.07, 6));
  }
  batch.add('dark', latitudeRing((R + RI) / 2, (WINDOW.y0 + WINDOW.y1) / 2 + 0.55, 0.05, WINDOW.a0, WINDOW.a1, 24));

  // the belt and the panel seams
  batch.add('band', sector({ r0: R - 0.45, r1: R + 0.32, a0: 0, a1: Math.PI * 2, y0: -0.75, y1: 0.75, seg: 96 }));
  batch.add('dark', latitudeRing(R + 0.33, 0, 0.06));
  for (const y of [5.6, 10.2]) batch.add('seam', latitudeRing(rAt(R, y) + 0.02, y, 0.07));
  batch.add('seam', latitudeRing(rAt(R, -3.6) + 0.02, -3.6, 0.07));
  batch.add('seam', latitudeRing(rAt(R, -11.4) + 0.02, -11.4, 0.07));
  for (let k = 0; k < 16; k++) {
    const a = (k / 16) * Math.PI * 2;
    batch.add('seam', meridian(R + 0.02, a, 0.8, k % 2 ? 10.2 : 12.2, 0.06, 18));
    if (adiff(a, HATCH_A) > 0.35 && adiff(a, Math.PI) > 0.7)
      batch.add('seam', meridian(R + 0.02, a, -11.4, -3.6, 0.06, 12));
  }
  // the crown: a cap ring, the mast, a bent whip antenna, a small dish and three lights
  batch.add('band', sector({ r0: 0, r1: 3.4, a0: 0, a1: Math.PI * 2, y0: 12.25, y1: 12.75, seg: 32 }));
  batch.add('dark', sector({ r0: 0, r1: 1.2, a0: 0, a1: Math.PI * 2, y0: 12.7, y1: 13.4, seg: 16 }));
  batch.add('dark', strut(new THREE.Vector3(0, 13.3, 0), new THREE.Vector3(0, 18.5, 0), 0.16, 0.06));
  batch.add('dark', strut(new THREE.Vector3(0, 16.2, 0), new THREE.Vector3(1.4, 16.9, 0), 0.05));
  batch.add('dark', strut(new THREE.Vector3(0, 15.2, 0), new THREE.Vector3(-1.1, 15.6, 0.4), 0.05));
  batch.add('glowRed', new THREE.SphereGeometry(0.28, 10, 8).translate(0, 18.7, 0));
  {
    const p = polar(rAt(R, 9.5) - 0.2, -2.2, 9.5), q = polar(rAt(R, 9.5) + 2.2, -2.2, 12.5);
    batch.add('dark', strut(p, q, 0.12, 0.09));
    batch.add('dark', strut(q, polar(rAt(R, 9.5) + 3.3, -2.0, 14.6), 0.04));   // the whip
    const dish = new THREE.SphereGeometry(1.5, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2.4);
    dish.rotateX(Math.PI).applyQuaternion(new THREE.Quaternion().setFromUnitVectors(Y, q.clone().normalize().add(new THREE.Vector3(0, 0.6, 0)).normalize().negate()));
    batch.add('teal', dish.translate(q.x, q.y, q.z));
    batch.add('dark', strut(q, q.clone().add(q.clone().normalize().add(new THREE.Vector3(0, 0.6, 0)).normalize().multiplyScalar(1.1)), 0.05));
  }
  for (let k = 0; k < 3; k++) batch.add('glowTeal', new THREE.SphereGeometry(0.2, 8, 6).translate(...polar(2.6, (k / 3) * Math.PI * 2 + 0.4, 12.85).toArray()));
  // thrusters underneath: three bells and a ring
  batch.add('dark', sector({ r0: 2.2, r1: 4.2, a0: 0, a1: Math.PI * 2, y0: -12.9, y1: -12.2, seg: 32 }));
  for (let k = 0; k < 3; k++) {
    const p = polar(2.6, (k / 3) * Math.PI * 2 + 1.0, -12.6);
    batch.add('dark', new THREE.CylinderGeometry(0.75, 1.15, 1.3, 12, 1, true).translate(p.x, p.y - 0.6, p.z));
    batch.add('thrust', new THREE.CircleGeometry(0.7, 12).rotateX(Math.PI / 2).translate(p.x, p.y - 0.5, p.z));
  }

  // portholes: an inked ring and dark glass outside, a sky-lit disc inside (rooms at deck height)
  const port = (a, y, rr, inside) => {
    const T = tangentFrame(a, y, R);
    const ring = []; const glass = [];
    for (let i = 0; i < 20; i++) { const t = (i / 20) * Math.PI * 2; ring.push([Math.cos(t) * rr, Math.sin(t) * rr]); glass.push([Math.cos(t) * rr * 0.72, Math.sin(t) * rr * 0.72]); }
    const ringIn = ring.map(([u, v]) => [u * 0.72, v * 0.72]);
    batch.add('teal', surfaceRibbon(T, [...ring, ring[0]], [...ringIn, ringIn[0]], 0.07));
    batch.add('portGlass', surfacePoly(T, glass, 0.05));
    if (inside) {
      const Ti = tangentFrame(a, y, RI);
      batch.add('portIn', surfacePoly(Ti, glass, -0.05));
      batch.add('dark', surfaceRibbon(Ti, [...ring, ring[0]], [...ringIn, ringIn[0]], -0.06));
    }
  };
  for (const a of [-0.196, 0.196, 4.516, 4.909, 0.982, 2.16]) port(a, DECK + 2.05, 0.55, true);   // between the seams
  for (let k = 0; k < 12; k++) port((k / 12) * Math.PI * 2 + 0.26, 3.4, 0.42, false);

  // the scar: a scorched halo, three dots over an arc (the glyph), and soot streaks
  {
    const T = tangentFrame(SCAR.a, SCAR.y, R);
    batch.add('scorch', surfacePoly(T, blob(4.2, 3.1, 28, 0.32, 2.1), 0.035));
    batch.add('soot', surfacePoly(T, blob(3.1, 2.3, 24, 0.28, 4.7), 0.05));
    for (const [u, v] of [[-1.25, 1.0], [0, 1.45], [1.25, 1.0]]) batch.add('ink', surfacePoly(T, blob(0.42, 0.42, 14, 0.12, u * 3 + 1), 0.07));
    // the arc bows up under the dots (∩), as the glyph is drawn everywhere else, not a smile
    const [outer, inner] = arcStroke(0, -1.6, 2.1, Math.PI * 0.18, Math.PI * 0.82, 0.5, 24);
    batch.add('ink', surfaceRibbon(T, outer, inner, 0.07));
    for (const [u, len, w] of [[-2.6, 2.4, 0.18], [2.4, 1.8, 0.14], [-0.6, 1.6, 0.12]]) {
      const o2 = [[u - w, -0.8], [u - w * 0.4, -0.8 - len]], i2 = [[u + w, -0.8], [u + w * 0.4, -0.8 - len]];
      batch.add('soot', surfaceRibbon(T, o2, i2, 0.06));
    }
  }

  // landing legs
  const feet = [];
  for (const a of LEG_A) {
    if (legs === 'up') {
      // stowed: just the hip housings
      batch.add('dark', strut(polar(rAt(R, -6.5) - 0.6, a, -6.5), polar(rAt(R, -8.5) + 0.5, a, -8.5), 0.55, 0.45));
      continue;
    }
    const broken = legs === 'broken';
    const fy = o.footY ? o.footY(a) : -LIFT;
    const hip = polar(rAt(R, -6.6) - 0.5, a, -6.6);
    const knee = polar(R + 2.2, a, broken ? -7.4 : -9.6);
    const foot = polar(R + 3.0, a, broken ? -10.4 : fy + 0.35);
    batch.add('dark', strut(hip, knee, 0.42, 0.36));
    batch.add('band', new THREE.SphereGeometry(0.5, 10, 8).translate(knee.x, knee.y, knee.z));
    batch.add('dark', strut(knee, foot, 0.3, 0.26));
    batch.add('trim', strut(polar(rAt(R, -10.2) - 0.4, a, -10.2), knee.clone().lerp(foot, 0.4), 0.14));   // the piston
    if (!broken) {
      batch.add('dark', new THREE.CylinderGeometry(1.15, 1.3, 0.35, 14).translate(foot.x, fy + 0.17, foot.z));
      feet.push(new THREE.Vector3(foot.x, fy, foot.z));
    }
  }

  // threshold under the hatch, out to the hinge
  {
    const g = sector({ r0: RI - 0.5, r1: HINGE_R, a0: HATCH.a0 - 0.01, a1: HATCH.a1 + 0.01, y0: DECK - 0.3, y1: DECK, seg: 4 });
    batch.add('floorDark', g);
  }
  return { feet };
}

/** The hatch door: a curved panel over the doorway (outside and inside skins). Rotate about z to slide it up. */
export function doorGeometry() {
  const pad = 0.004;
  const out = shell({ r: R + 0.05, patch: { a0: HATCH.a0 - 0.02, a1: HATCH.a1 + 0.02, y0: HATCH.y0 - 0.1, y1: HATCH.y1 + 0.12 }, tSeg: 80 });
  const inn = shell({ r: RI - 0.05, patch: { a0: HATCH.a0 + pad, a1: HATCH.a1 - pad, y0: HATCH.y0 + 0.02, y1: HATCH.y1 }, tSeg: 80, inward: true });
  return { out, inn };
}

/** The ramp: a plank with rails and chevrons, hinge at the origin, running out along +x, top at y = 0. */
export function rampGeometry(L, W = 1.9) {
  const plank = new THREE.BoxGeometry(L, 0.2, W).translate(L / 2, -0.1, 0);
  const rails = [];
  for (const s of [-1, 1]) {
    rails.push(new THREE.BoxGeometry(L, 0.12, 0.12).translate(L / 2, 0.9, s * (W / 2 - 0.06)));
    for (let k = 0; k <= Math.floor(L / 2.2); k++) rails.push(new THREE.BoxGeometry(0.09, 0.9, 0.09).translate(Math.min(0.3 + k * 2.2, L - 0.2), 0.45, s * (W / 2 - 0.06)));
  }
  const stripes = [];
  for (let x = 0.8; x < L - 0.4; x += 1.1) stripes.push(new THREE.BoxGeometry(0.28, 0.03, W * 0.7).translate(x, 0.015, 0));
  return { plank, rails, stripes };
}
