import * as THREE from 'three';
import { mulberry32 } from './noise.js';
import { house, tree, beam } from './levels/moon-foundry-kit.js';
import { bar } from './levels/antennas-kit.js';

// ---------------------------------------------------------------------------
// Inside the moons (issue #193, the author's pick of the level explorations: references/levels/The Moon Foundry/
// environment/explorations/inside-the-moons/; docs/systems/worlds.md "The Moon Foundry: inside the moons, the cranes and
// the night pour"). The broken moon's courtyard is only the first of its neighbourhood: a stair street climbs its inner
// curve from the courtyard's floor round the back of the shell, landing by landing, a little house with an orange door
// on each, pots and washing lines, round crater windows in the shell beside its flights looking out and down over the
// whole floor. From its top landing a hanging bridge goes out to a spiral stair hung under the crown, and the spiral
// comes up through a round hatch onto a deck on the moon's crown, 62 m over the floor, where the high walk leaves for
// the old hoist's signal box (src/foundry-cranes.js).
//
// All in the moon's own frame (its centre the origin, x and z as the world's; an azimuth a is the direction
// (sin a, cos a), as the courtyard's: src/levels/moon-foundry-kit.js courtyard).
//
//   streetPlan(ri, fy)          the street's landings, flights, top, bridge, spiral and crown deck; its crater windows and
//                               the hatch; the walking line (pure: the tests walk it, the courtyard keeps its houses off it)
//   cutHoles(geos, holes)       round holes in a moon's shell (indexed geometry): vertices inside pulled to the rim
//   buildStreet(plan, o)        the parts by role (the kit's roles), its lit windows and its lamps
// ---------------------------------------------------------------------------

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const TAU = Math.PI * 2;
/** The street: from the azimuth a0 round to a1, `flights` flights up to `top` (m over the moon's centre). */
export const STREET = { a0: 1.2, a1: 5.2, flights: 9, top: 12, slope: 0.66, half: 1.2, rise: 0.22 };
/** The spiral under the crown: its steps from r0 to r1, two turns up to the crown's deck at `top`; the hatch and the deck round it. */
export const SPIRAL = { r0: 0.7, r1: 3.3, turns: 2, top: 30.6, rise: 0.22, open: 0.3 };
export const HATCH = { r: 4.2, deck: 6.6 };
/** The crater windows: on the shell beside these flights, r m round. */
export const WINDOWS = { flights: [1, 3, 5, 7], r: 3, high: [[3.4, 0.95, 3], [4.4, 0.85, 3]] };

const wallR = (ri, y) => Math.sqrt(Math.max(0, ri * ri - y * y));
/** Where the street runs at a height: 5 m in from the wall (where the wall leans in, from it 4 m higher up). */
export const streetRho = (ri, y) => Math.min(wallR(ri, y), wallR(ri, y + 4)) - 5;
const at = (a, r, y) => V(Math.sin(a) * r, y, Math.cos(a) * r);

/** The street laid out (pure). ri: the shell's inner radius; fy: the courtyard's floor (over the centre). */
export function streetPlan(ri, fy) {
  const S = STREET, N = S.flights, dA = (S.a1 - S.a0) / N, dY = (S.top - fy) / N;
  const landings = [], flights = [];
  for (let k = 0; k < N; k++) {
    const a = S.a0 + k * dA, y = fy + k * dY, rho = streetRho(ri, y), arc = dA * rho;
    const run = Math.min(dY / S.slope, arc - 1.6), land = arc - run;
    landings.push({ k, a0: a, a1: a + land / rho, y, rho, len: land });
    flights.push({ k, a0: a + land / rho, a1: a + dA, y0: y, y1: y + dY, n: Math.ceil(dY / S.rise) });
  }
  // the top landing, and the hanging bridge from its inner edge to the spiral's foot (along its middle azimuth)
  const top = { k: N, a0: S.a1, a1: S.a1 + 0.26, y: S.top, rho: streetRho(ri, S.top) };
  top.len = (top.a1 - top.a0) * top.rho;
  landings.push(top);
  const aB = (top.a0 + top.a1) / 2;
  const bridge = { a: aB, r0: SPIRAL.r1 - 0.2, r1: top.rho - S.half + 0.2, y: S.top };
  // the spiral: two turns up from the bridge's end to the crown's deck, its last third of a turn open overhead (headroom)
  const P = SPIRAL, n = Math.ceil((P.top - S.top) / P.rise), th0 = aB, th1 = aB + P.turns * TAU;
  const spiral = { n, th0, th1, y0: S.top, y1: P.top, step: (P.top - S.top) / n, dth: (th1 - th0) / n };
  const crown = { y: P.top, landing: [th1, th1 + (1 - P.open) * TAU], hatch: HATCH.r, deck: HATCH.deck };
  // the walking line: up the street's middle, over the bridge, round the spiral's middle, out onto the deck
  const line = [];
  for (let k = 0; k <= N; k++) {
    const L = landings[k];
    line.push(at((L.a0 + L.a1) / 2, L.rho, L.y).toArray());
    if (k === N) break;
    const F = flights[k];
    for (let j = 1; j <= 3; j++) { const u = j / 4, y = F.y0 + (F.y1 - F.y0) * u; line.push(at(F.a0 + (F.a1 - F.a0) * u, streetRho(ri, y), y).toArray()); }
  }
  line.push(at(aB, bridge.r1 - 0.4, S.top).toArray(), at(aB, (bridge.r0 + bridge.r1) / 2, S.top).toArray(), at(aB, bridge.r0 + 0.6, S.top).toArray());
  const mid = (P.r0 + P.r1) / 2 + 0.1;
  for (let i = 4; i <= n; i += 4) line.push(at(th0 + spiral.dth * i, mid, S.top + spiral.step * i).toArray());
  line.push(at(th1 + 0.35, mid, P.top).toArray());
  // the crater windows: on the wall beside the chosen flights, a little over the flight's middle
  const windows = WINDOWS.flights.map((k) => {
    const F = flights[k], a = (F.a0 + F.a1) / 2, y = (F.y0 + F.y1) / 2 + 2.2;
    return { dir: at(a, wallR(ri, y), y).normalize(), r: WINDOWS.r, a, y };
  });
  for (const [a, el, r] of WINDOWS.high) windows.push({ dir: V(Math.sin(a) * Math.cos(el), Math.sin(el), Math.cos(a) * Math.cos(el)), r, a, y: ri * Math.sin(el), high: true });
  return { landings, flights, top, bridge, spiral, crown, windows, hatch: { dir: V(0, 1, 0), r: HATCH.r }, line, fy, ri };
}

/**
 * Each hole's middle moved onto the middle of the shell's nearest triangle (geo: its outer sheet, indexed): a hole a
 * little wider than the shell's triangles, round a triangle's middle, takes its whole neighbourhood out and opens, every
 * vertex inside lying off its axis (cutHoles pulls each out along its own bearing). Returns the holes.
 */
export function snapHoles(holes, geo) {
  const P = geo.attributes.position, I = geo.index.array, a = V(), b = V(), c = V();
  for (const h of holes) {
    let best = null, bd = Infinity;
    for (let t = 0; t < I.length; t += 3) {
      a.fromBufferAttribute(P, I[t]); b.fromBufferAttribute(P, I[t + 1]); c.fromBufferAttribute(P, I[t + 2]);
      const m = a.add(b).add(c).normalize(), d = m.angleTo(h.dir);
      if (d < bd) { bd = d; best = m.clone(); }
    }
    if (best) h.dir.copy(best);
  }
  return holes;
}
/**
 * Round holes through a moon's shell (each { dir, r } at radius R: its half angle r / R): every vertex inside one pulled
 * out to its rim (keeping its distance from the centre), every triangle wholly inside dropped. Indexed geometries,
 * changed in place; returns them.
 */
export function cutHoles(geos, holes, R) {
  const H = holes.map((h) => ({ dir: h.dir.clone().normalize(), ang: Math.asin(Math.min(1, h.r / R)) }));
  const q = V(), axis = V(), tmp = V();
  for (const g of geos) {
    if (!g?.index) continue;
    const P = g.attributes.position, inside = new Int8Array(P.count).fill(-1);
    for (let i = 0; i < P.count; i++) {
      q.fromBufferAttribute(P, i);
      const len = q.length();
      if (len < 1e-6) continue;
      for (let h = 0; h < H.length; h++) {
        const ang = q.angleTo(H[h].dir);
        if (ang >= H[h].ang) continue;
        inside[i] = h;
        // turn it away from the hole's axis to the rim, about the axis square to both
        axis.crossVectors(H[h].dir, q);
        if (axis.lengthSq() < 1e-10) axis.set(1, 0, 0).cross(H[h].dir);
        axis.normalize();
        tmp.copy(H[h].dir).applyAxisAngle(axis, H[h].ang).multiplyScalar(len);
        P.setXYZ(i, tmp.x, tmp.y, tmp.z);
        break;
      }
    }
    const I = g.index.array, keep = [];
    for (let t = 0; t < I.length; t += 3) {
      const a = inside[I[t]], b = inside[I[t + 1]], c = inside[I[t + 2]];
      if (a >= 0 && a === b && b === c) continue;
      keep.push(I[t], I[t + 1], I[t + 2]);
    }
    g.setIndex(keep);
    P.needsUpdate = true;
    g.computeVertexNormals();
  }
  return geos;
}

/** A ring sector, solid: from azimuth a0 to a1, radius r0 to r1, height y0 to y1 (flat faces, plain geometry). */
export function sector(a0, a1, r0, r1, y0, y1, seg = Math.max(1, Math.ceil(Math.abs(a1 - a0) / 0.12))) {
  const pos = [];
  const quad = (A, B, C, D) => pos.push(...A, ...B, ...C, ...A, ...C, ...D);
  const p = (a, r, y) => [Math.sin(a) * r, y, Math.cos(a) * r];
  for (let i = 0; i < seg; i++) {
    const s = a0 + ((a1 - a0) * i) / seg, e = a0 + ((a1 - a0) * (i + 1)) / seg;
    quad(p(s, r0, y1), p(s, r1, y1), p(e, r1, y1), p(e, r0, y1));   // top
    quad(p(s, r0, y0), p(e, r0, y0), p(e, r1, y0), p(s, r1, y0));   // bottom
    quad(p(s, r1, y0), p(e, r1, y0), p(e, r1, y1), p(s, r1, y1));   // outer
    quad(p(s, r0, y0), p(s, r0, y1), p(e, r0, y1), p(e, r0, y0));   // inner
  }
  quad(p(a0, r0, y0), p(a0, r1, y0), p(a0, r1, y1), p(a0, r0, y1));
  quad(p(a1, r0, y0), p(a1, r0, y1), p(a1, r1, y1), p(a1, r1, y0));
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  // (wound either way by the sign of a1 - a0: both faces drawn by the caller's double-sided material where it matters)
  g.computeVertexNormals();
  return g;
}
const roles = () => ({ plank: [], rail: [], strut: [], rust: [], rust2: [], dark: [], wall: [], wall2: [], roofing: [], glow: [], leaf: [], trunk: [], floor: [], steel: [], edge: [] });
const push = (out, parts) => { for (const [k, v] of Object.entries(parts)) if (Array.isArray(v) && out[k]) out[k].push(...v.filter((g) => g?.isBufferGeometry)); };

/**
 * The street, the bridge, the spiral, the crown's deck, the windows' collars, in the moon's frame. o: { R, thick, seed }.
 * { parts (by role, solid), loose (drawn only: washing, plants, hangers), windows (lit), lamps ([x, y, z, r]) }.
 */
export function buildStreet(plan, { R, thick, seed = 1, walkAz = 1.35 } = {}) {
  const S = STREET, out = roles(), loose = roles(), rng = mulberry32(seed * 977 + 13), lit = [], lamps = [];
  const { ri } = plan, h = S.half;
  const railAlong = (pts, o = out) => {
    for (let i = 1; i < pts.length; i++) o.rail.push(bar(pts[i - 1].clone().add(V(0, 1, 0)), pts[i].clone().add(V(0, 1, 0)), 0.04, 0.04, 4));
    for (let i = 0; i < pts.length; i += 3) o.rail.push(bar(pts[i], pts[i].clone().add(V(0, 1, 0)), 0.035, 0.035, 3));
    if ((pts.length - 1) % 3) o.rail.push(bar(pts.at(-1), pts.at(-1).clone().add(V(0, 1, 0)), 0.035, 0.035, 3));
  };
  // ---- the landings: a slab out to the wall, a corbel under it against the wall; a house on each long enough
  const houses = [];
  plan.landings.forEach((L, k) => {
    if (k > 0) {
      const outer = Math.min(wallR(ri, L.y), wallR(ri, L.y - 0.45)) - 0.12;
      out.floor.push(sector(L.a0 - 0.01, L.a1 + 0.01, L.rho - h, outer, L.y - 0.45, L.y));
      const cOut = Math.min(wallR(ri, L.y), wallR(ri, L.y - 2.4)) - 0.15;
      out.rust2.push(sector(L.a0 + 0.02, L.a1 - 0.02, cOut - 1.4, cOut, L.y - 2.4, L.y - 0.45));
      // (the top landing's rail open where the hanging bridge leaves it)
      const gap = k === plan.landings.length - 1 ? [plan.bridge.a - 1.4 / L.rho, plan.bridge.a + 1.4 / L.rho] : null;
      for (const [s0, s1] of gap ? [[L.a0, gap[0]], [gap[1], L.a1]] : [[L.a0, L.a1]]) {
        const edge = []; for (let j = 0; j <= 2; j++) edge.push(at(s0 + ((s1 - s0) * j) / 2, L.rho - h + 0.08, L.y));
        railAlong(edge);
      }
    }
    // a little house wall-side, its orange door to the street; pots by the rail
    const room = Math.min(wallR(ri, L.y), wallR(ri, L.y + 3.6)) - 0.6 - (L.rho + h + 0.2);
    if (k > 0 && k < plan.landings.length - 1 && L.len >= 3.8 && room > 2.2) {
      const am = (L.a0 + L.a1) / 2, d = Math.min(3.2, room), r = L.rho + h + 0.2 + d / 2, p = at(am, r, L.y);
      const floors = L.y < -7 && Math.min(wallR(ri, L.y), wallR(ri, L.y + 6.6)) - 0.6 - (L.rho + h + 0.2) > d ? 2 : 1;
      const H = house({ x: p.x, y: L.y, z: p.z, w: Math.min(4.4, L.len - 0.6), d, floors, yaw: Math.atan2(-p.x, -p.z), seed: seed * 31 + k, lit: 0.7, tone: k % 2, pitched: false, balcony: 0.6, detail: 0.85 });
      push(out, H);
      lit.push(...H.windows);
      if (H.windows[0]) lamps.push([...H.windows[0], 4]);
      // its door painted orange
      const door = at(am, r - d / 2 - 0.06, L.y + 1.1);
      out.wall.push(new THREE.PlaneGeometry(1.0, 2.1).rotateY(Math.atan2(-p.x, -p.z)).translate(door.x, door.y, door.z));
      houses.push({ k, at: p, top: H.top, d, w: Math.min(4.4, L.len - 0.6), am });
    }
    if (k > 0 && k < plan.landings.length - 1) {
      const pa = (L.a0 + L.a1) / 2 + (rng() - 0.5) * 0.04, pp = at(pa, L.rho - h + 0.55, L.y);
      out.wall2.push(new THREE.CylinderGeometry(0.32, 0.24, 0.55, 10).translate(pp.x, L.y + 0.27, pp.z));
      push(loose, tree(pp.x, L.y + 0.5, pp.z, 0.55 + rng() * 0.3, seed * 7 + k, 0.7));
    }
  });
  // ---- the flights: curved steps, a soffit under them, a rail on the open side
  for (const F of plan.flights) {
    const pts = [];
    for (let i = 1; i <= F.n; i++) {
      const u = (i - 0.5) / F.n, a = F.a0 + (F.a1 - F.a0) * u, y = F.y0 + ((F.y1 - F.y0) * i) / F.n, rho = streetRho(ri, y), da = (F.a1 - F.a0) / F.n;
      out.plank.push(sector(a - da * 0.6, a + da * 0.6, rho - h, rho + h, y - 0.4, y, 1));
      if (i % 3 === 1 || i === F.n) pts.push(at(a, rho - h + 0.08, y));
    }
    railAlong(pts);
    // the soffit: a slab under the steps, in a few straight pieces
    for (let j = 0; j < 4; j++) {
      const u0 = j / 4, u1 = (j + 1) / 4, y0 = F.y0 + (F.y1 - F.y0) * u0 - 0.55, y1 = F.y0 + (F.y1 - F.y0) * u1 - 0.55;
      const a = at(F.a0 + (F.a1 - F.a0) * u0, streetRho(ri, y0 + 0.55), y0), b = at(F.a0 + (F.a1 - F.a0) * u1, streetRho(ri, y1 + 0.55), y1);
      out.rust2.push(beam(a, b, h * 2 - 0.2, 0.3));
    }
  }
  // ---- washing lines across the flights, house to house
  for (let i = 1; i < houses.length; i++) {
    const A = houses[i - 1], B = houses[i];
    if (B.k - A.k > 2) continue;
    const pa = at(A.am + 0.05, A.at.length() - A.d / 2 + 0.1, 0).setY(A.at.y + 3.3), pb = at(B.am - 0.05, B.at.length() - B.d / 2 + 0.1, 0).setY(B.at.y + 2.9);
    loose.strut.push(bar(pa, pb, 0.02, 0.02, 3));
    for (let j = 1; j < 6; j++) {
      const p = pa.clone().lerp(pb, j / 6), w = 0.45 + rng() * 0.3, hh = 0.5 + rng() * 0.45, yaw = Math.atan2(pb.x - pa.x, pb.z - pa.z) + Math.PI / 2;
      loose[j % 3 === 0 ? 'wall' : 'wall2'].push(new THREE.PlaneGeometry(w, hh).rotateY(yaw).translate(p.x, p.y - hh / 2 - 0.05, p.z));
    }
  }
  // ---- the hanging bridge from the top landing to the spiral's foot, its landing round the newel
  {
    const B = plan.bridge, a = at(B.a, B.r1, B.y), b = at(B.a, B.r0, B.y), side = V(Math.cos(B.a), 0, -Math.sin(B.a));
    out.plank.push(beam(a.clone().add(V(0, -0.15, 0)), b.clone().add(V(0, -0.15, 0)), 2.2, 0.3));
    for (const e of [-1, 1]) {
      const pts = []; for (let j = 0; j <= 6; j++) pts.push(a.clone().lerp(b, j / 6).addScaledVector(side, e * 1.05));
      railAlong(pts);
      // hung from the shell over it by rods
      for (let j = 1; j < 6; j += 2) { const p = a.clone().lerp(b, j / 6).addScaledVector(side, e * 1.05), top = wallR(ri, 0) > 0 ? Math.sqrt(Math.max(0, ri * ri - p.x * p.x - p.z * p.z)) - 0.3 : B.y + 10; loose.strut.push(bar(p, V(p.x, top, p.z), 0.03, 0.03, 3)); }
    }
    out.plank.push(sector(plan.spiral.th0 - 0.45, plan.spiral.th0 + 0.12, SPIRAL.r0, SPIRAL.r1, B.y - 0.3, B.y));
  }
  // ---- the spiral under the crown: its newel hung from the hatch's rim, its steps, the outer rail
  {
    const P = plan.spiral, sp = SPIRAL, pts = [];
    out.rust.push(new THREE.CylinderGeometry(0.62, 0.62, P.y1 - P.y0 + 1.6, 14).translate(0, (P.y0 + P.y1) / 2 - 0.5, 0));
    out.dark.push(new THREE.CylinderGeometry(0.16, 0.2, 1.3, 8).translate(0, P.y1 + 0.6, 0), new THREE.SphereGeometry(0.3, 8, 6).translate(0, P.y1 + 1.35, 0));
    for (let i = 1; i <= P.n; i++) {
      const th = P.th0 + P.dth * (i - 0.5), y = P.y0 + P.step * i;
      out.plank.push(sector(th - P.dth * 0.62, th + P.dth * 0.62, sp.r0 - 0.1, sp.r1, y - 0.3, y, 1));
      if (i % 3 === 0) pts.push(at(th, sp.r1 - 0.1, y));
    }
    railAlong(pts);
    // its foot hangs under the bridge's landing: a boss; three rods from the newel's head out to the hatch's rim
    out.dark.push(new THREE.SphereGeometry(0.9, 12, 8).translate(0, P.y0 - 1.3, 0));
    for (let j = 0; j < 3; j++) { const a = j * TAU / 3 + 0.4; loose.strut.push(bar(V(0, P.y1 - 0.4, 0), at(a, HATCH.r + 0.2, P.y1 - 1.6), 0.06, 0.06, 4)); }
  }
  // ---- the crown's deck: a landing over the hatch but for the spiral's last turns, a ring of planks round it, rails
  {
    const C = plan.crown, [l0, l1] = C.landing;
    out.plank.push(sector(l0, l1, 0.55, HATCH.r + 0.2, C.y - 0.3, C.y));
    out.plank.push(sector(0, TAU, HATCH.r, HATCH.deck, C.y - 0.3, C.y, 28));
    // posts down to the shell under the ring
    for (let j = 0; j < 10; j++) { const a = (j / 10) * TAU, r = (HATCH.r + HATCH.deck) / 2, s = Math.sqrt(R * R - r * r) - 0.2; out.dark.push(new THREE.BoxGeometry(0.3, C.y - 0.3 - s, 0.3).translate(Math.sin(a) * r, (C.y - 0.3 + s) / 2, Math.cos(a) * r)); }
    // the open stairwell's rail (the ring's inner edge over the last turns, and its edge along the landing's start)
    const well = []; for (let j = 0; j <= 8; j++) well.push(at(l1 + ((l0 + TAU - l1) * j) / 8, HATCH.r + 0.05, C.y));
    railAlong(well);
    railAlong([at(l1, 0.7, C.y), at(l1, HATCH.r, C.y)]);
    // the hatch's collar through the shell, its lid standing open
    out.rust.push(new THREE.CylinderGeometry(HATCH.r, HATCH.r, C.y - 0.1 - (ri - 0.7), 36, 1, true).translate(0, (C.y - 0.1 + ri - 0.7) / 2, 0));
    out.dark.push(new THREE.CylinderGeometry(HATCH.r + 0.15, HATCH.r + 0.15, 0.18, 20).rotateX(-1.75).translate(0, C.y + HATCH.r * 0.98, -HATCH.deck - 0.1));
    // the ring's outer rail, open where the high walk leaves (toward the hoist: o.walk, its azimuth)
    const ring = []; for (let j = 0; j <= 20; j++) ring.push(at(walkAz + 0.32 + ((TAU - 0.64) * j) / 20, HATCH.deck - 0.08, C.y));
    railAlong(ring);
  }
  // ---- the crater windows' collars: a thick ivory ring through the shell
  for (const w of plan.windows) {
    const q = new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), w.dir), len = R - ri + 0.9;
    const collar = new THREE.CylinderGeometry(w.r, w.r, len, 20, 1, true).applyQuaternion(q);
    const c = w.dir.clone().multiplyScalar((R + ri) / 2 + 0.05);
    out.edge.push(collar.translate(c.x, c.y, c.z));
  }
  return { parts: out, loose, windows: lit, lamps, houses };
}
