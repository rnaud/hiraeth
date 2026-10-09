import * as THREE from 'three';
import { makeMaterial } from '../materials.js';
import { Paint } from '../vehicle-kit.js';
import { DECK, CEIL, HALF_W, WALL_IN, HATCH, HATCH_A, OPENINGS, STATIONS, sectionAt, Quads, holedPatch, reveal, addShape } from './hull.js';
import { familyDrawing, motherNote, homePhoto, starChart } from './art.js';

// The ship's rooms, inside the angular hull (docs/systems/ship.md, "The blockout"). The main room follows the
// layout the author picked in the reference lab (references/The Travellers Ship/Interior - Lab/sheet-1.jpg):
// one long room open onto the cockpit, seen from its aft end. One deck, from the bow:
//   - the cockpit (z -9 .. -6.1): the dash under the windshield, two seats side by side, an overhead panel;
//   - the main room (-6.1 .. 2.55), open to the cockpit through a wide frame: the holo table in the middle,
//     in the crook of the curved console whose tail runs aft to the voicemail (the button, the projector, the
//     little screen); the galley along the port wall forward of the hatch, an L round the frame's corner, a
//     tool board over it; coats and packs on hooks aft of the hatch; along the starboard wall a chest of
//     drawers by the frame, the bunk in its arched alcove (under the window), kit on hooks, the lockers;
//   - the back room (2.55 .. 6.75) through a doorway: the sofa, a small table with three mismatched seats,
//     the desk, the chest of drawers, clothes on hooks, books under straps, the portholes;
//   - the hold (6.75 .. 9.95): lockers, crates strapped down, the tool board, the engine room's hatch.
// Doorways are 1.6 m wide and 2.28 m high, the ceiling 2.35 m: the traveller's capsule (2.2 m) and the
// camera's tight arm pass. The deck is one flat plane at y = DECK (an invisible collider under the drawn
// floor); anything on it lower than his step (a bed, a stool) gets an invisible block BLOCK_H tall over its
// footprint, so walking the deck never lifts you. All in ship-local coordinates (src/ship/hull.js: x to
// starboard, z aft, the origin on the deck at the hatch).

const PI = Math.PI, TAU = PI * 2;
/** The rooms along the ship (z ranges), and the doorways between them (x half width). */
export const ROOMS = {
  cockpit: { z0: -9.0, z1: -6.1 },
  main: { z0: -6.1, z1: 2.55 },
  cabin: { z0: 2.55, z1: 6.75 },
  hold: { z0: 6.75, z1: 9.95 },
};
export const DOORWAY = { half: 0.8, h: 2.28 };
/** The cockpit's frame: open this wide (x half width) into the main room. */
export const FRAME_HALF = 1.6;
/** How near the cockpit point counts as "at the console". */
export const CONSOLE_R = 1.5;
/** The dash: its front edge (z), top (y over the deck) and how far it reaches across (x half width). */
export const DASH = { z0: -8.95, z1: -8.05, h: 1.0, half: 2.6 };
/** The holo table: where it stands, its radius and height, the planet's size and height over the deck. */
export const TABLE = { x: 0.2, z: -3.1, r: 0.58, h: 0.92, planetR: 0.3, planetY: 1.58 };
/**
 * The curved console round the holo table (the reference's "J"): a ring from `ri` to `ro` round the table's port
 * half (from its aft side, round the port side, to its forward side), `h` high, and its tail running aft from the
 * ring's aft end to `tailZ`, `tailHalf` either side of the table's line, rounded at the end. The voicemail sits on
 * the tail's end.
 */
export const CONSOLE = { ri: 0.95, ro: 1.35, h: 0.95, tailZ: -0.95, tailHalf: 0.36 };
/** The recordings' projector on the console's tail (ship-local): the parents rise over it. */
export const PROJECTOR = new THREE.Vector3(TABLE.x + 0.08, DECK + CONSOLE.h + 0.07, -1.1);
/** The voicemail button, on the rounded end of the console's tail, at his right hand (it blinks while a message waits). */
export const VOICEMAIL = new THREE.Vector3(TABLE.x + 0.2, DECK + CONSOLE.h + 0.14, -0.8);
/** Where he stands to play the recordings: behind the console's tail, facing forward over it (heading PI). */
export const VOICE_STAND = new THREE.Vector3(PROJECTOR.x, DECK, 0.15);
/** How near the holo table counts as "at the table" (it opens the galactic map). */
export const TABLE_R = 1.6;
/** Height of the invisible blocks over low furniture: over the step, under the camera's line of sight. */
export const BLOCK_H = 1.1;
/** The galley counter's front (x, along the port wall: the open deck is between it and the console). */
export const GALLEY_X = -(WALL_IN - 0.65);
/** The bunk's alcove in the starboard wall: its arched front at x, from z0 to z1 (the window over the bed). */
export const ALCOVE = { x: WALL_IN - 1.08, z0: -4.55, z1: -2.0, top: 2.05 };

const H = (h) => DECK + h;
const V = (x, y, z) => new THREE.Vector3(x, y, z);
/** A geometry whose rotateX / Y / Z turn it about its own centre (x, y, z), not the ship's origin. */
const pivoted = (g, x, y, z) => {
  for (const ax of ['X', 'Y', 'Z']) {
    const f = g[`rotate${ax}`].bind(g);
    g[`rotate${ax}`] = (a) => { g.translate(-x, -y, -z); f(a); g.translate(x, y, z); return g; };
  }
  return g;
};
/** A box w x h x d standing on y (its bottom), centred on x, z (it turns about its centre). */
const box = (w, h, d, x = 0, y = 0, z = 0) => pivoted(new THREE.BoxGeometry(w, h, d).translate(x, y + h / 2, z), x, y + h / 2, z);
const cyl = (r0, r1, h, x = 0, y = 0, z = 0, seg = 12) => pivoted(new THREE.CylinderGeometry(r1, r0, h, seg).translate(x, y + h / 2, z), x, y + h / 2, z);
const tube = (pts, r, seg = 16) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), seg, r, 5, false);
/** A ring's sector on the deck: round (cx, cz) from radius r0 to r1, angles a0 .. a1 (x = cos, z = sin), from y up hgt. */
function ring(cx, cz, r0, r1, a0, a1, y, hgt, seg = 28) {
  const sh = new THREE.Shape(), pt = (r, a) => [cx + Math.cos(a) * r, -(cz + Math.sin(a) * r)];
  sh.moveTo(...pt(r1, a0));
  for (let i = 1; i <= seg; i++) sh.lineTo(...pt(r1, a0 + ((a1 - a0) * i) / seg));
  for (let i = seg; i >= 0; i--) sh.lineTo(...pt(r0, a0 + ((a1 - a0) * i) / seg));
  sh.closePath();
  // (the shape's (x, y) is the deck's (x, -z); extruded up)
  return new THREE.ExtrudeGeometry(sh, { depth: hgt, bevelEnabled: false }).rotateX(-PI / 2).translate(0, y, 0);
}
/** An opening's outline in a wall's (z, y) plane: rounded top corners (r), small bottom ones, grown by `grow`. */
function roundedRect({ z0, z1, y0, y1 }, r, grow = 0) {
  const out = [], rb = 0.1 + grow, rt = r + grow;
  const a = z0 - grow, b = z1 + grow, lo = y0 - grow, hi = y1 + grow;
  const corner = (cz, cy, rr, from) => { for (let i = 0; i <= 6; i++) { const t = from + (i / 6) * (PI / 2); out.push([cz + Math.cos(t) * rr, cy + Math.sin(t) * rr]); } };
  corner(b - rb, lo + rb, rb, -PI / 2); corner(b - rt, hi - rt, rt, 0); corner(a + rt, hi - rt, rt, PI / 2); corner(a + rb, lo + rb, rb, PI);
  return out;
}
/**
 * A panel in a side wall's plane at x (depth into +x), its outline `outer` ([z0, z1, y0, y1], or a list of (z, y)),
 * with the rounded opening `open` (roundedRect) cut through it: the bunk alcove's arched front.
 */
function archPanel(x, depth, outer, open, r) {
  const pts = outer.length === 4 && typeof outer[0] === 'number' ? [[outer[0], outer[2]], [outer[1], outer[2]], [outer[1], outer[3]], [outer[0], outer[3]]] : outer;
  const sh = new THREE.Shape(pts.map(([u, v]) => new THREE.Vector2(u, v)));
  sh.holes.push(new THREE.Path(roundedRect(open, r).map(([u, v]) => new THREE.Vector2(u, v))));
  // (the shape's (u, v) is the wall's (z, y); extruded along -x by the turn, then moved to x .. x + depth)
  return new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: false }).rotateY(-PI / 2).translate(x + depth, DECK, 0);
}

// the props' flat colours (one vertex-coloured mesh, src/vehicle-kit.js Paint)
const C = {
  paper: '#f7efdc', cream: '#f3ead8', wood: '#a8754f', woodDark: '#7d5338', teal: '#5fb7ad', dark: '#34405e', ink: '#2b211f',
  orange: '#e6875f', red: '#c8483a', rust: '#b5643c', yellow: '#f2c54b', blue: '#4f8fa8', green: '#7fa86a', leaf: '#4f6b34',
  steel: '#9aa7ad', khaki: '#b59a6a', plum: '#8a5a7a', sky: '#9fd3e0', brass: '#c9a24a', coral: '#e98a6f',
};

/** A frame on a flat wall: centre c, normal n (x along the wall, y up, z out of it). */
function wallFrame(c, n, tilt = 0) {
  const u = new THREE.Vector3().crossVectors(V(0, 1, 0), n).normalize();
  const v = new THREE.Vector3().crossVectors(n, u).normalize();
  return new THREE.Matrix4().makeBasis(u, v, n).multiply(new THREE.Matrix4().makeRotationZ(tilt)).setPosition(c);
}
/** On a side wall of the rooms (side -1 port, 1 starboard), at z, height h, `off` into the room. */
const sideFrame = (side, z, h, off = 0.02, tilt = 0) => wallFrame(V(side * (WALL_IN - off), H(h), z), V(-side, 0, 0), tilt);
/** On a cross wall at z, facing `dir` (+1 aft, -1 forward), at x, height h. */
const crossFrame = (z, dir, x, h, off = 0.02, tilt = 0) => wallFrame(V(x, H(h), z + dir * off), V(0, 0, dir), tilt);

function picture(group, tex, m, w, hgt) {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, hgt), makeMaterial({ color: '#ffffff', map: tex ?? undefined, flat: true, glow: 0.3 }));
  mesh.applyMatrix4(m);
  mesh.userData.noCollide = true;
  group.add(mesh);
  return mesh;
}

/** The cockpit's inner skin at z: the eight points of its ring (floor corner up the starboard wall, over the top, down port). */
function innerRing(z) {
  const s = sectionAt(z), w = s[3][0] - 0.4;
  const R = [[w, 0], [w, s[4][1]], [s[5][0] - 0.4, s[5][1] - 0.3], [s[6][0] - 0.3, s[6][1] - 0.3]];
  return [...R.map(([x, y]) => V(x, y, z)), ...R.slice().reverse().map(([x, y]) => V(-x, y, z))];
}
/** The cockpit floor's half width at z (the inner walls narrowing toward the nose). */
export const cockpitHalf = (z) => sectionAt(Math.min(z, ROOMS.main.z0))[3][0] - 0.4;

export function buildInterior(batch, group, o = {}) {
  void o;
  const deco = new THREE.Group();    // pictures: seen, not collided with
  deco.userData.noCollide = true;
  group.add(deco);
  const paint = new Paint();
  /** A prop in flat colour, through a matrix (drawn only: small things, never in the way). */
  const P = (geo, color, m) => { if (m) geo.applyMatrix4(m); paint.add(geo, color); return geo; };
  /** An invisible block: keeps you off something too low to be a wall (you walk round it, never up onto it). */
  const block = (geo) => batch.add('collider', geo);
  const Q = {};
  const q = (k) => (Q[k] ??= new Quads());
  const z0 = ROOMS.cockpit.z0, zEnd = ROOMS.hold.z1;

  // ------------------------------------------------------------ floor, ceiling, walls
  // one flat plane for walking on (an invisible slab), the drawn floor in it: the cockpit's (narrowing to the
  // nose), the main room's boards, the cabin's and the hold's
  {
    const zs = [z0, STATIONS[2].z, ROOMS.main.z0];
    for (let i = 0; i < zs.length - 1; i++) {
      const a = cockpitHalf(zs[i]), b = cockpitHalf(zs[i + 1]);
      for (const key of ['floor', 'collider']) {
        const y = key === 'collider' ? DECK - 0.002 : DECK;
        q(key === 'floor' ? 'floorDark' : 'collider').quad(V(-a, y, zs[i]), V(a, y, zs[i]), V(b, y, zs[i + 1]), V(-b, y, zs[i + 1]), V(0, 1, 0));
      }
    }
    batch.add('collider', box(WALL_IN * 2, 0.2, zEnd - ROOMS.main.z0, 0, DECK - 0.2, (zEnd + ROOMS.main.z0) / 2));
    batch.add('floor', box(WALL_IN * 2, 0.02, ROOMS.cabin.z0 - ROOMS.main.z0, 0, DECK - 0.02, (ROOMS.cabin.z0 + ROOMS.main.z0) / 2));
    batch.add('floorDark', box(WALL_IN * 2, 0.02, zEnd - ROOMS.cabin.z0, 0, DECK - 0.02, (zEnd + ROOMS.cabin.z0) / 2));
    // the ceiling over the main body
    q('ceiling').quad(V(-WALL_IN, CEIL, ROOMS.main.z0), V(WALL_IN, CEIL, ROOMS.main.z0), V(WALL_IN, CEIL, zEnd), V(-WALL_IN, CEIL, zEnd), V(0, -1, 0));
    batch.add('collider', box(WALL_IN * 2, 0.1, zEnd - ROOMS.main.z0, 0, CEIL, (zEnd + ROOMS.main.z0) / 2));
  }
  // the rooms' side walls (x = ±WALL_IN), round the same openings as the hull
  for (const side of [-1, 1]) {
    const x = side * WALL_IN, n = V(-side, 0, 0);
    const ops = OPENINGS.filter((p) => p.side === side);
    const zs = new Set([ROOMS.main.z0, zEnd]), ys = new Set([0, CEIL]);
    for (const p of ops) { zs.add(p.z0); zs.add(p.z1); if (p.y0 > 0) ys.add(p.y0); if (p.y1 < CEIL) ys.add(p.y1); }
    const Z = [...zs].sort((a, b) => a - b), Yv = [...ys].sort((a, b) => a - b);
    for (let i = 0; i < Z.length - 1; i++) for (let j = 0; j < Yv.length - 1; j++) {
      const zc = (Z[i] + Z[i + 1]) / 2, yc = (Yv[j] + Yv[j + 1]) / 2;
      if (ops.some((p) => zc > p.z0 && zc < p.z1 && yc > p.y0 && yc < p.y1)) continue;
      q('wallIn').quad(V(x, Yv[j], Z[i]), V(x, Yv[j], Z[i + 1]), V(x, Yv[j + 1], Z[i + 1]), V(x, Yv[j + 1], Z[i]), n);
    }
    for (const p of ops) {
      if (p.kind === 'port') {
        const sh = new THREE.Shape();
        sh.moveTo(p.z0, p.y0); sh.lineTo(p.z1, p.y0); sh.lineTo(p.z1, p.y1); sh.lineTo(p.z0, p.y1); sh.closePath();
        const hole = new THREE.Path(); hole.absarc(p.z, p.y, p.r, 0, TAU, true); sh.holes.push(hole);
        addShape(Q, 'wallIn', new THREE.ShapeGeometry(sh, 16), (u, v) => V(x, v, u), n);
        batch.add('dark', new THREE.TorusGeometry(p.r + 0.04, 0.045, 6, 20).rotateY(PI / 2).translate(x - side * 0.02, p.y, p.z));
        continue;
      }
      // a frame round each opening inside
      const f = 0.08, x2 = x - side * 0.015;
      const isDoor = p.kind === 'door';
      const A = [V(x2, p.y0, p.z0), V(x2, p.y0, p.z1), V(x2, p.y1, p.z1), V(x2, p.y1, p.z0)];
      const E = [V(x2, p.y0 - (isDoor ? 0 : f), p.z0 - f), V(x2, p.y0 - (isDoor ? 0 : f), p.z1 + f), V(x2, Math.min(CEIL - 0.01, p.y1 + f), p.z1 + f), V(x2, Math.min(CEIL - 0.01, p.y1 + f), p.z0 - f)];
      for (let k = 0; k < 4; k++) if (!(isDoor && k === 0)) q(isDoor ? 'teal' : 'trim').quad(E[k], E[(k + 1) % 4], A[(k + 1) % 4], A[k], n);
    }
  }
  // the cockpit's skin: the inner walls narrowing to the nose, the windshield's inside, the panes' reveals
  {
    const zs = [z0, STATIONS[2].z, ROOMS.main.z0], rings = zs.map(innerRing);
    const outer = STATIONS.map((st) => [...st.v.map(([x, y]) => V(x, y, st.z)), ...st.v.slice().reverse().map(([x, y]) => V(-x, y, st.z))]);
    for (let i = 0; i < 2; i++) {
      const A = rings[i], B = rings[i + 1];
      for (let e = 0; e < 7; e++) {
        const Pq = [A[e], A[e + 1], B[e + 1], B[e]];
        const mid = Pq.reduce((s, p) => s.add(p), V(0, 0, 0)).multiplyScalar(0.25);
        const hint = V(0, 1.1, mid.z).sub(mid);   // facing in
        if (e === 3 && i === 0) {
          // the windshield's two panes (the outer face: S1 -> S2, src/ship/hull.js)
          const oa = outer[1], ob = outer[2];
          for (const s of [1, -1]) {
            const c0 = V(0, A[3].y, A[3].z), c1 = V(0, B[3].y, B[3].z);
            const Hp = [c0, s > 0 ? A[3] : A[4], s > 0 ? B[3] : B[4], c1];
            const rim = holedPatch(q('wallIn'), Hp, [0.07, 0.9, 0.08, 0.92], hint);
            const oc0 = V(0, oa[6].y, oa[6].z), oc1 = V(0, ob[6].y, ob[6].z);
            const Ho = [oc0, s > 0 ? oa[6] : oa[7], s > 0 ? ob[6] : ob[7], oc1];
            const orim = [[0.07, 0.08], [0.9, 0.08], [0.9, 0.92], [0.07, 0.92]].map(([u, v]) => bil(Ho, u, v));
            reveal(q('trim'), orim, rim);
          }
          continue;
        }
        if ((e === 1 || e === 5) && i === 1) {
          // the side panes (outer: band 4 between S2 and S3)
          const rim = holedPatch(q('wallIn'), Pq, [0.08, 0.9, 0.1, 0.86], hint);
          const oe = e === 1 ? 4 : 8, oa = outer[2], ob = outer[3];
          const Ho = [oa[oe], oa[oe + 1], ob[oe + 1], ob[oe]];
          const orim = [[0.08, 0.1], [0.9, 0.1], [0.9, 0.86], [0.08, 0.86]].map(([u, v]) => bil(Ho, u, v));
          reveal(q('trim'), orim, rim);
          continue;
        }
        q(e === 0 || e === 6 ? 'wallIn' : 'ceiling').quad(...Pq, hint);
      }
    }
    // the front wall behind the dash
    const F = rings[0], c = F.reduce((s, p) => s.add(p), V(0, 0, 0)).multiplyScalar(1 / F.length);
    for (let i = 0; i < F.length; i++) q('wallIn').tri(c, F[i], F[(i + 1) % F.length], V(0, 0, 1));
  }
  // the cockpit's frame: wide open into the main room, and the bulkhead over it up to the cockpit's higher roof
  {
    const z = ROOMS.main.z0;
    for (const s of [-1, 1]) {
      batch.add('wall', box(WALL_IN - FRAME_HALF, CEIL, 0.16, s * (WALL_IN + FRAME_HALF) / 2, DECK, z));
      batch.add('teal', box(0.12, CEIL, 0.2, s * FRAME_HALF, DECK, z));
    }
    // (the bulkhead's top follows the cockpit's skin: up the walls, along the shoulders, under the roof)
    const r = innerRing(z).filter((p) => p.y > CEIL), sh = new THREE.Shape();
    sh.moveTo(-WALL_IN, CEIL); sh.lineTo(WALL_IN, CEIL);
    for (const p of r) sh.lineTo(p.x, p.y + 0.02);
    sh.closePath();
    batch.add('wall', new THREE.ExtrudeGeometry(sh, { depth: 0.16, bevelEnabled: false }).translate(0, 0, z - 0.08));
    batch.add('teal', box(FRAME_HALF * 2 + 0.12, 0.1, 0.2, 0, CEIL - 0.1, z));
  }
  // the doorways to the cabin and the hold, and the hold's aft wall with the engine room's hatch
  for (const z of [ROOMS.cabin.z0, ROOMS.hold.z0]) {
    for (const s of [-1, 1]) {
      batch.add('wall', box(WALL_IN - DOORWAY.half, CEIL, 0.14, s * (WALL_IN + DOORWAY.half) / 2, DECK, z));
      batch.add('trim', box(0.1, DOORWAY.h, 0.18, s * (DOORWAY.half + 0.05), DECK, z));
    }
    batch.add('wall', box(DOORWAY.half * 2, CEIL - DOORWAY.h, 0.14, 0, H(DOORWAY.h), z));
    batch.add('trim', box(DOORWAY.half * 2 + 0.2, 0.06, 0.18, 0, H(DOORWAY.h) - 0.03, z));
  }
  batch.add('wall', box(WALL_IN * 2, CEIL, 0.14, 0, DECK, zEnd));
  batch.add('dark', box(1.1, 1.7, 0.06, 0, H(0.15), zEnd - 0.09));                // the engine room's hatch (shut)
  batch.add('metal', box(0.9, 1.5, 0.04, 0, H(0.25), zEnd - 0.12));
  batch.add('btnC', box(0.12, 0.12, 0.04, 0.55, H(1.1), zEnd - 0.13));
  P(box(0.5, 0.06, 0.06, 0, 1.75, zEnd - 0.12), C.yellow);
  for (const x of [-0.3, 0.3]) P(cyl(0.03, 0.03, 0.12, x, 1.0, zEnd - 0.2, 6).rotateX(PI / 2), C.brass);

  // ------------------------------------------------------------ the cockpit
  // the dash: a cream body under the windshield, a dark top with the instruments, teal repair panels
  {
    const { z0: dz0, z1: dz1, h, half } = DASH;
    const hw = (z) => Math.min(half, cockpitHalf(z) - 0.05);
    const a = hw(dz0), b = hw(dz1);
    const dq = q('cream');
    const pts = (y, inset = 0) => [V(-a + inset, y, dz0), V(a - inset, y, dz0), V(b - inset, y, dz1), V(-b + inset, y, dz1)];
    const lo = pts(DECK), hi = pts(H(h - 0.08));
    for (let k = 0; k < 4; k++) dq.quad(lo[k], lo[(k + 1) % 4], hi[(k + 1) % 4], hi[k], hi[k].clone().add(hi[(k + 1) % 4]).multiplyScalar(0.5).sub(V(0, hi[k].y, (dz0 + dz1) / 2)));
    const top = pts(H(h - 0.08)), top2 = pts(H(h));
    for (let k = 0; k < 4; k++) q('dark').quad(top[k], top[(k + 1) % 4], top2[(k + 1) % 4], top2[k], top[k].clone().add(top[(k + 1) % 4]).multiplyScalar(0.5).sub(V(0, top[k].y, (dz0 + dz1) / 2)));
    q('panel').quad(...top2, V(0, 1, 0));
    { const zm = (dz0 + dz1) / 2; block(box(a * 2, BLOCK_H, zm - dz0, 0, DECK, (dz0 + zm) / 2)); block(box(hw(zm) * 2, BLOCK_H, dz1 - zm + 0.1, 0, DECK, (zm + dz1 + 0.1) / 2)); }
    // teal repaired panels on its face, brass switches and buttons, dials
    for (const x of [-1.7, -0.6, 1.3]) batch.add('teal', box(0.7, 0.42, 0.02, x, H(0.35), dz1 + 0.01));
    const cols = ['btnA', 'btnB', 'btnC'];
    for (let row = 0; row < 2; row++) for (let k = 0; k < 15; k++) {
      const x = -b + 0.3 + (k / 14) * (b * 2 - 0.6), z = dz1 - 0.12 - row * 0.22;
      if (Math.abs(x) < 0.36 || (k * 5 + row * 3) % 7 === 0) continue;
      batch.add(cols[(k + row) % 3], box(0.08, 0.04, 0.08, x, H(h), z));
    }
    for (const x of [-1.9, -1.3, 1.5, 2.0]) {
      P(cyl(0.11, 0.11, 0.03, 0, 0, 0, 14).rotateX(-PI / 2 + 0.5).translate(x, H(h + 0.1), dz0 + 0.25), C.cream);
      P(box(0.015, 0.09, 0.01).rotateX(0.5).rotateZ(0.7 - x).translate(x, H(h + 0.08), dz0 + 0.24), C.ink);
      P(cyl(0.125, 0.125, 0.02, 0, 0, 0, 14).rotateX(-PI / 2 + 0.5).translate(x, H(h + 0.095), dz0 + 0.235), C.brass);
    }
    // the throttles, a cluster of brass levers
    for (const x of [-0.75, -0.62, -0.49]) { P(box(0.03, 0.26, 0.03, x, h, dz1 - 0.3).rotateX(0.25), C.ink); P(new THREE.SphereGeometry(0.045, 8, 6).translate(x, h + 0.27, dz1 - 0.24), C.brass); }
    // the father's old flight cap, a child's drawing under it, a mug, the mother's little figure
    batch.add('cushion', new THREE.SphereGeometry(0.15, 12, 6, 0, TAU, 0, PI / 2).scale(1, 0.6, 1.1).translate(1.95, H(h), dz1 - 0.3));
    batch.add('cushion', box(0.16, 0.015, 0.12, 1.95, H(h), dz1 - 0.12).rotateY(0.1));
    P(box(0.34, 0.004, 0.26, 1.85, h + 0.002, dz1 - 0.3).rotateY(-0.2), C.paper);
    P(cyl(0.045, 0.05, 0.1, -1.6, h, dz1 - 0.25, 10), C.orange);
    P(cyl(0.05, 0.035, 0.14, 2.25, h, dz1 - 0.55, 8), C.red);
    P(new THREE.SphereGeometry(0.045, 8, 6).translate(2.25, h + 0.18, dz1 - 0.55), C.yellow);
  }
  // the middle of the dash: a round scope in a brass ring, a dark screen either side
  {
    const z = DASH.z1 - 0.32;
    batch.add('dark', cyl(0.25, 0.22, 0.05, 0, H(DASH.h), z, 24));
    batch.add('band', new THREE.TorusGeometry(0.22, 0.02, 6, 28).rotateX(PI / 2).translate(0, H(DASH.h + 0.05), z));
    batch.add('btnB', cyl(0.15, 0.15, 0.012, 0, H(DASH.h + 0.05), z, 20));
    for (const s of [-1, 1]) batch.add('btnB', box(0.34, 0.2, 0.02, s * 0.5, H(DASH.h + 0.02), z - 0.12).rotateX(-0.5));
  }
  // two seats side by side, turned a little toward the middle (the picked layout: pilot and a second seat)
  const seatMs = [-1, 1].map((s) => new THREE.Matrix4().makeRotationY(s * 0.08).setPosition(s * 0.95, DECK, -7.35));
  for (const [i, seatM] of seatMs.entries()) {
    const S = (g) => g.applyMatrix4(seatM);
    batch.add('dark', S(cyl(0.16, 0.26, 0.42, 0, 0, 0, 10)));
    batch.add('cushion', S(box(0.62, 0.16, 0.6, 0, 0.42)));
    batch.add('cushion', S(box(0.62, 0.86, 0.16, 0, 0.55, 0.32).rotateX(0.12)));
    batch.add('cushion', S(box(0.4, 0.24, 0.12, 0, 1.36, 0.42)));                 // the headrest
    for (const s of [-1, 1]) batch.add('dark', S(box(0.07, 0.07, 0.48, s * 0.35, 0.72, 0.02)));
    block(S(box(0.72, BLOCK_H, 0.72, 0, 0, 0.05)));
    if (i === 0) P(S(box(0.42, 0.07, 0.28, 0.05, 0.58, 0.0).rotateY(0.2)), C.paper);   // a flight log left on the pilot's
  }
  // the overhead panel hanging from the cockpit's roof between the seats: switches, two small dials
  {
    const y = H(2.42), z0p = -7.75, z1p = -6.55;
    batch.add('cream', box(0.9, 0.16, z1p - z0p, 0, y, (z0p + z1p) / 2));
    batch.add('dark', box(0.92, 0.03, z1p - z0p + 0.02, 0, y - 0.03, (z0p + z1p) / 2));
    for (const x of [-0.3, 0.3]) batch.add('dark', box(0.05, 0.9, 0.05, x, y + 0.16, (z0p + z1p) / 2));
    for (let k = 0; k < 8; k++) batch.add(['btnA', 'btnC', 'btnB'][k % 3], box(0.05, 0.02, 0.05, -0.32 + (k % 4) * 0.21, y - 0.04, z0p + 0.25 + Math.floor(k / 4) * 0.5));
    for (const x of [-0.2, 0.2]) P(cyl(0.07, 0.07, 0.02, x, 2.38, z1p - 0.25, 12), C.cream);
  }
  // the instrument racks either side of the cockpit, by the frame: screens, dials, switches
  for (const s of [-1, 1]) {
    const z = -6.55, x = s * (cockpitHalf(z) - 0.22);
    batch.add('metal', box(0.4, 2.1, 0.8, x, DECK, z));
    batch.add('btnB', box(0.02, 0.36, 0.56, x - s * 0.21, H(1.45), z));             // a screen (dark without power)
    for (let k = 0; k < 4; k++) batch.add(['btnA', 'btnC'][k % 2], box(0.03, 0.06, 0.06, x - s * 0.21, H(0.95), z - 0.24 + k * 0.16));
    for (let k = 0; k < 2; k++) P(cyl(0.08, 0.08, 0.03, 0, 0, 0, 14).rotateZ(PI / 2).translate(x - s * 0.22, 1.15, z - 0.18 + k * 0.36), C.cream);
  }
  picture(deco, familyDrawing(), wallFrame(V(-1.95, H(1.35), DASH.z0 + 0.12), V(0.25, 0.5, 1).normalize(), 0.08), 0.36, 0.27);   // tucked by the instruments

  // ------------------------------------------------------------ the main room
  // The layout of the picked sheet (references/The Travellers Ship/Interior - Lab/sheet-1.jpg), seen from the aft
  // end: the cockpit straight ahead through the frame; on the left (port) the galley forward of the hatch, coats
  // and packs aft of it; in the middle the holo table in the crook of the curved console, its tail coming aft
  // with the voicemail on it; on the right (starboard) a chest of drawers, the bunk's arched alcove, kit on hooks,
  // the lockers.
  // the holo table: a foot, a column, a drum flaring out to the rim, glass lit with the ship's power
  {
    const { x, z, r, h } = TABLE;
    batch.add('dark', cyl(0.46, 0.4, 0.08, x, DECK, z, 24));
    batch.add('dark', cyl(0.2, 0.2, 0.66, x, H(0.08), z, 14));
    batch.add('metal', cyl(0.34, r, 0.18, x, H(h - 0.18), z, 32));
    batch.add('cream', new THREE.TorusGeometry(r - 0.02, 0.07, 6, 36).rotateX(PI / 2).translate(x, H(h), z));
    batch.add('core', cyl(r - 0.06, r - 0.06, 0.012, x, H(h - 0.01), z, 32));     // the glass (src/ship/ship.js lights it)
    batch.add('dark', cyl(0.11, 0.09, 0.05, x, H(h), z, 14));
    batch.add('glowTeal', cyl(0.06, 0.06, 0.012, x, H(h + 0.05), z, 12));
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * TAU + 0.5;
      const p = V(x + Math.sin(a) * 0.08, H(h + 0.06), z + Math.cos(a) * 0.08), pt = V(x + Math.sin(a) * TABLE.planetR * 0.75, H(TABLE.planetY - TABLE.planetR * 0.6), z + Math.cos(a) * TABLE.planetR * 0.75);
      batch.add('glowTeal', tube([p, p.clone().lerp(pt, 0.5).add(V(Math.sin(a) * 0.02, 0, Math.cos(a) * 0.02)), pt], 0.006, 6));
    }
    for (let k = 0; k < 6; k++) {
      const a = 1.2 + k * 0.16;   // (on the open side, where you stand)
      batch.add(['btnA', 'btnB', 'btnC'][k % 3], box(0.05, 0.02, 0.05, x + Math.sin(a) * (r - 0.12), H(h), z + Math.cos(a) * (r - 0.12)));
    }
    block(cyl(r + 0.03, r + 0.03, BLOCK_H, x, DECK, z, 20));
    // the round rug under it, coral with a cream border (the sheet's coral disc round the table's foot)
    batch.add('rug', cyl(1.75, 1.75, 0.012, x, DECK, z, 40));
    batch.add('rugInner', cyl(1.6, 1.6, 0.014, x, DECK, z, 40));
  }
  // the curved console: a ring round the table's port half, the tail running aft from its aft end to the
  // voicemail; cream sides, a dark top with instruments, a teal kick strip
  {
    const { x: cx, z: cz } = TABLE, { ri, ro, h, tailZ, tailHalf: th } = CONSOLE;
    const a0 = PI / 2, a1 = PI * 1.5;   // (from the table's aft side round the port side to its forward side)
    batch.add('locker', ring(cx, cz, ri, ro, a0, a1, DECK, h - 0.06));
    batch.add('dark', ring(cx, cz, ri - 0.03, ro + 0.04, a0, a1, H(h - 0.06), 0.06));
    batch.add('panel', ring(cx, cz, ri + 0.03, ro - 0.03, a0, a1, H(h), 0.006));
    batch.add('teal', ring(cx, cz, ro - 0.01, ro + 0.012, a0, a1, DECK, 0.12));
    batch.add('teal', box(0.02, h - 0.14, ro - ri - 0.06, cx + 0.01, H(0.04), cz - (ri + ro) / 2));   // the forward end's panel
    // the tail: a straight run aft from the ring's aft end, rounded at its end
    const tz0 = cz + ri, tl = tailZ - tz0;
    batch.add('locker', box(th * 2, h - 0.06, tl, cx, DECK, tz0 + tl / 2));
    batch.add('locker', new THREE.CylinderGeometry(th, th, h - 0.06, 20, 1, false, -PI / 2, PI).translate(cx, H((h - 0.06) / 2), tailZ));
    batch.add('dark', box(th * 2 + 0.07, 0.06, tl, cx, H(h - 0.06), tz0 + tl / 2));
    batch.add('dark', new THREE.CylinderGeometry(th + 0.035, th + 0.035, 0.06, 20, 1, false, -PI / 2, PI).translate(cx, H(h - 0.03), tailZ));
    batch.add('panel', box(th * 2 - 0.06, 0.006, tl, cx, H(h), tz0 + tl / 2));
    batch.add('teal', box(th * 2 + 0.024, 0.12, tl, cx, DECK, tz0 + tl / 2));
    for (const s of [-1, 1]) for (let k = 0; k < 3; k++) P(box(0.02, h - 0.24, 0.02, cx + s * (th + 0.005), 0.14, tz0 + 0.2 + k * (tl - 0.3) / 2), C.ink);   // its doors
    for (const s of [-1, 1]) P(box(0.03, 0.03, 0.14, cx + s * (th + 0.02), h - 0.2, tz0 + tl / 2), C.steel);
    // instruments along the ring's top: buttons, little tilted screens facing the table, dials
    for (let k = 0; k < 14; k++) {
      const a = a0 + 0.12 + (k / 13) * (a1 - a0 - 0.24), rr = ri + 0.12 + (k % 2) * 0.16;
      const x = cx + Math.cos(a) * rr, z = cz + Math.sin(a) * rr;
      if (k % 4 === 1) { batch.add('btnB', box(0.26, 0.16, 0.02, 0, 0, 0).rotateX(-0.6).rotateY(-a - PI / 2).translate(x, H(h + 0.08), z)); continue; }
      if (k % 4 === 3) { P(cyl(0.07, 0.07, 0.03, x, h, z, 12), C.cream); P(cyl(0.08, 0.08, 0.02, x, h - 0.005, z, 12), C.brass); continue; }
      batch.add(['btnA', 'btnC'][k % 2], box(0.06, 0.025, 0.06, x, H(h), z).rotateY(-a));
    }
    // a lamp on a gooseneck over the forward end, a mug and a log on the ring
    {
      const a = a1 - 0.25, x = cx + Math.cos(a) * (ro - 0.12), z = cz + Math.sin(a) * (ro - 0.12);
      P(tube([V(x, h, z), V(x, h + 0.35, z + 0.05), V(x + 0.15, h + 0.5, z + 0.15)], 0.012, 8), C.dark);
      P(cyl(0.1, 0.05, 0.12, x + 0.17, h + 0.42, z + 0.17, 10), C.yellow);
    }
    P(cyl(0.04, 0.045, 0.09, cx - ri - 0.2, h, cz - 0.3, 10), C.teal);
    P(box(0.3, 0.012, 0.22, cx - ri - 0.18, h, cz + 0.35).rotateY(0.3), C.paper);
    // on the tail: the voicemail and the projector at its end, the little screen by them, papers, a handset on its cable
    batch.add('vmailHalo', cyl(0.3, 0.3, 0.006, VOICEMAIL.x, H(h), VOICEMAIL.z, 28));   // the pool of light it throws on the console
    batch.add('dark', box(0.26, 0.09, 0.24, VOICEMAIL.x, H(h), VOICEMAIL.z));
    batch.add('band', new THREE.TorusGeometry(0.11, 0.022, 6, 24).rotateX(PI / 2).translate(VOICEMAIL.x, H(h + 0.095), VOICEMAIL.z));
    batch.add('vmail', new THREE.SphereGeometry(0.095, 18, 9, 0, TAU, 0, PI / 2).scale(1, 0.75, 1).translate(VOICEMAIL.x, H(h + 0.09), VOICEMAIL.z));
    {
      const p = V(PROJECTOR.x, H(h), PROJECTOR.z);
      batch.add('dark', cyl(0.27, 0.24, 0.06, p.x, p.y, p.z, 24));
      batch.add('band', new THREE.TorusGeometry(0.24, 0.02, 6, 28).rotateX(PI / 2).translate(p.x, p.y + 0.06, p.z));
      batch.add('glowTeal', cyl(0.15, 0.15, 0.02, p.x, p.y + 0.06, p.z, 20));
    }
    P(box(0.24, 0.006, 0.32, cx - 0.16, h + 0.003, tz0 + 0.25).rotateY(0.25), C.paper);
    P(box(0.2, 0.006, 0.28, cx - 0.1, h + 0.01, tz0 + 0.4).rotateY(-0.2), C.cream);
    P(box(0.16, 0.05, 0.08, cx + 0.22, h, tz0 + 0.2).rotateY(0.4), C.orange);
    P(tube([V(cx + 0.22, h + 0.03, tz0 + 0.2), V(cx + th + 0.06, h - 0.1, tz0 + 0.35), V(cx + th + 0.04, h - 0.4, tz0 + 0.55), V(cx + th - 0.02, h - 0.2, tz0 + 0.75)], 0.008, 12), C.ink);
  }
  // the little screen on the console's tail, turned to where he stands: the map, the reel's date stamp
  const scr = { c: V(TABLE.x - 0.24, H(CONSOLE.h + 0.29), -1.8), r: 0.2 };   // (low and to one side: the busts' faces stand clear over it)
  const standPt = VOICE_STAND.clone();
  const screenNormal = V(standPt.x - scr.c.x, 0.35, standPt.z - scr.c.z).normalize();
  {
    const q = new THREE.Quaternion().setFromUnitVectors(V(0, 0, 1), screenNormal);
    const at = (g, back = 0) => g.applyQuaternion(q).translate(scr.c.x - screenNormal.x * back, scr.c.y - screenNormal.y * back, scr.c.z - screenNormal.z * back);
    batch.add('cream', at(new THREE.BoxGeometry(0.56, 0.48, 0.18), 0.07));                  // the set: a boxy cream front,
    batch.add('cream', at(new THREE.BoxGeometry(0.38, 0.32, 0.22), 0.26));                  // the tube's back tapering behind it
    for (let k = 0; k < 4; k++) P(at(new THREE.BoxGeometry(0.26, 0.012, 0.01).translate(0, -0.09 + k * 0.06, 0), 0.375), C.ink);   // its vents
    batch.add('dark', at(new THREE.TorusGeometry(scr.r + 0.03, 0.04, 6, 32)));
    batch.add('dark', at(new THREE.BoxGeometry(0.46, 0.4, 0.02), 0.03));
    batch.add('dark', cyl(0.11, 0.14, 0.05, scr.c.x, H(CONSOLE.h), scr.c.z + 0.04, 12));     // its swivel
    for (const s of [-1, 1]) P(at(new THREE.CylinderGeometry(0.025, 0.025, 0.03, 8).rotateX(PI / 2).translate(s * 0.17, -0.2, 0)), C.brass);   // two knobs under the screen
  }
  // the galley along the port wall forward of the hatch, an L round the frame's corner: cupboards with coral doors,
  // the stove with the kettle on it, the sink, cups and a teapot; the tool board over it, cupboards either side
  {
    const xw = -WALL_IN, x0 = GALLEY_X, gz0 = -5.38, gz1 = -1.05, h = 0.92, zf = ROOMS.main.z0 + 0.08, xr = -1.9;
    batch.add('locker', box(x0 - xw, h - 0.05, gz1 - gz0, (x0 + xw) / 2, DECK, (gz0 + gz1) / 2));
    batch.add('wood', box(x0 - xw + 0.05, 0.05, gz1 - gz0 + 0.04, (x0 + xw) / 2 + 0.025, H(h - 0.05), (gz0 + gz1) / 2));
    // the L: along the frame's wall, as far as the frame's post
    batch.add('locker', box(xr - xw, h - 0.05, gz0 - zf, (xr + xw) / 2, DECK, (zf + gz0) / 2));
    batch.add('wood', box(xr - xw + 0.04, 0.05, gz0 - zf + 0.05, (xr + xw) / 2 + 0.02, H(h - 0.05), (zf + gz0) / 2 + 0.025));
    for (let k = 0; k <= 7; k++) P(box(0.02, h - 0.14, 0.02, x0 + 0.01, 0.06, gz0 + ((gz1 - gz0) * k) / 7), C.ink);
    for (let k = 0; k < 7; k++) {
      const z = gz0 + ((gz1 - gz0) * (k + 0.5)) / 7;
      if (k % 3 !== 1) batch.add('cushion', box(0.02, 0.5, 0.46, x0 + 0.01, H(0.18), z));     // the coral doors
      P(box(0.04, 0.04, 0.16, x0 + 0.03, 0.72, z), C.steel);
    }
    for (let k = 0; k < 2; k++) {
      const x = xw + 0.42 + k * 0.66;
      batch.add('cushion', box(0.5, 0.5, 0.02, x, H(0.18), gz0 + 0.01));
      P(box(0.16, 0.04, 0.04, x, 0.72, gz0 + 0.03), C.steel);
    }
    // the stove: a dark plate, two rings, the kettle on one
    batch.add('dark', box(0.5, 0.03, 0.6, x0 - 0.3, H(h), -4.55));
    for (const z of [-4.7, -4.4]) P(cyl(0.1, 0.1, 0.012, x0 - 0.28, h + 0.03, z, 14), C.red);
    P(new THREE.SphereGeometry(0.13, 12, 8, 0, TAU, 0, PI / 2).scale(1, 1.1, 1).translate(x0 - 0.28, h + 0.04, -4.7), C.steel);
    P(tube([V(x0 - 0.18, h + 0.08, -4.7), V(x0 - 0.06, h + 0.14, -4.7), V(x0 - 0.02, h + 0.2, -4.7)], 0.016, 6), C.steel);
    P(tube([V(x0 - 0.38, h + 0.16, -4.7), V(x0 - 0.28, h + 0.3, -4.7), V(x0 - 0.18, h + 0.16, -4.7)], 0.01, 8), C.ink);
    // the sink, a tap
    batch.add('metal', box(0.4, 0.03, 0.55, x0 - 0.3, H(h), -3.15));
    P(tube([V(xw + 0.05, h + 0.02, -3.15), V(xw + 0.1, h + 0.3, -3.15), V(xw + 0.3, h + 0.28, -3.15)], 0.02, 6), C.steel);
    // two cups, a teapot, bread, plates, a jar of herbs, a pot of utensils
    for (const [z, c] of [[-2.1, C.cream], [-1.85, C.teal]]) P(cyl(0.04, 0.045, 0.09, x0 - 0.22, h, z, 10), c);
    P(cyl(0.08, 0.1, 0.14, x0 - 0.35, h, -2.45, 12), C.coral);
    P(box(0.24, 0.1, 0.12, x0 - 0.35, h, -3.8).rotateY(0.2), C.khaki);
    for (let k = 0; k < 3; k++) P(cyl(0.12, 0.12, 0.012, x0 - 0.4, h + k * 0.014, -1.45, 16), C.paper);
    P(cyl(0.06, 0.06, 0.16, xw + 0.5, h, zf + 0.3, 10), C.green);
    P(cyl(0.06, 0.05, 0.14, x0 - 0.45, h, -4.05, 10), C.orange);
    for (let k = 0; k < 3; k++) P(cyl(0.008, 0.008, 0.22, x0 - 0.45 + (k - 1) * 0.02, h + 0.06, -4.05, 4).rotateZ((k - 1) * 0.2), C.steel);
    // the tool board over the counter: pegboard, tools on their outlines, a shelf of jars
    const bz0 = -4.25, bz1 = -2.65;
    batch.add('panel', box(0.03, 0.62, bz1 - bz0, xw + 0.03, H(1.12), (bz0 + bz1) / 2));
    for (let k = 0; k < 7; k++) P(box(0.03, 0.22 + (k % 3) * 0.07, 0.04, xw + 0.06, 1.3 - (k % 3) * 0.04, bz0 + 0.15 + k * 0.21).rotateX((k % 2 ? 0.25 : -0.2)), [C.red, C.steel, C.yellow, C.dark][k % 4]);
    batch.add('wood', box(0.2, 0.03, bz1 - bz0, xw + 0.1, H(1.8), (bz0 + bz1) / 2));
    for (let k = 0; k < 6; k++) P(cyl(0.045, 0.045, 0.12, xw + 0.1, 1.83, bz0 + 0.15 + k * 0.26, 8), [C.yellow, C.leaf, C.orange, C.cream][k % 4]);
    // herbs drying under the shelf
    for (let k = 0; k < 3; k++) P(new THREE.ConeGeometry(0.05, 0.2, 5).rotateX(PI).translate(xw + 0.18, 1.68, bz0 + 0.4 + k * 0.4), C.leaf);
    // the cupboards over the counter either side of the board, and over the L (rounded doors, the Main Interior reference)
    for (const [za, zb] of [[zf, bz0 - 0.05], [bz1 + 0.05, gz1]]) {
      batch.add('locker', box(0.42, 0.62, zb - za, xw + 0.21, H(1.55), (za + zb) / 2));
      for (let z = za + 0.35; z < zb - 0.1; z += 0.6) P(box(0.03, 0.03, 0.12, xw + 0.435, 1.62, z), C.steel);
      P(box(0.02, 0.56, 0.02, xw + 0.425, 1.58, (za + zb) / 2), C.ink);
    }
    batch.add('locker', box(xr - xw - 0.42, 0.62, 0.42, (xr + xw + 0.42) / 2, H(1.55), zf + 0.21));
    P(box(0.02, 0.56, 0.02, (xr + xw + 0.42) / 2, 1.58, zf + 0.425), C.ink);
    picture(deco, motherNote(), sideFrame(-1, -1.5, 1.32, 0.01, 0.04), 0.3, 0.25);
  }
  // aft of the hatch on the port wall: coats and a pack on hooks, a second pack on the floor, boots
  {
    const xw = -WALL_IN;
    P(box(0.05, 0.05, 0.95, xw + 0.04, 1.85, 1.95), C.wood);
    P(box(0.14, 0.95, 0.36, xw + 0.1, 0.9, 1.62).rotateX(0.04), C.green);
    P(box(0.165, 0.12, 0.12, xw + 0.1, 1.35, 1.66), C.paper);                         // a patch
    P(box(0.26, 0.5, 0.38, xw + 0.16, 1.25, 2.12), C.orange);                         // the pack on its hook
    P(box(0.28, 0.16, 0.4, xw + 0.18, 1.62, 2.12), C.rust);
    P(box(0.06, 0.4, 0.06, xw + 0.31, 1.3, 2.0), C.khaki);
    for (const z of [1.62, 2.12]) P(cyl(0.02, 0.02, 0.06, xw + 0.06, 1.85, z, 5).rotateZ(PI / 2), C.brass);
    P(box(0.34, 0.44, 0.3, xw + 0.3, 0, 2.15).rotateY(0.25), C.khaki);                // the pack on the floor
    P(box(0.36, 0.14, 0.32, xw + 0.3, 0.42, 2.15).rotateY(0.25), C.woodDark);
    for (const z of [0.95, 1.12]) P(box(0.28, 0.14, 0.1, xw + 0.35, 0, z), C.woodDark);   // boots by the hatch
    block(box(0.62, BLOCK_H, 0.95, xw + 0.31, DECK, 1.95));
  }
  // starboard, by the frame: a chest of drawers with a lamp, a box and a book on it
  {
    const xw = WALL_IN, z = -5.45;
    batch.add('wood', box(0.55, 0.82, 0.9, xw - 0.28, DECK, z));
    for (let d = 1; d < 3; d++) P(box(0.02, 0.02, 0.84, xw - 0.555, (0.82 * d) / 3, z), C.woodDark);
    for (let d = 0; d < 3; d++) P(box(0.04, 0.035, 0.14, xw - 0.57, 0.82 * (d + 0.5) / 3, z), C.brass);
    block(box(0.6, BLOCK_H, 0.95, xw - 0.3, DECK, z));
    P(cyl(0.08, 0.1, 0.05, xw - 0.25, 0.82, z - 0.25, 10), C.dark);
    P(cyl(0.012, 0.012, 0.3, xw - 0.25, 0.86, z - 0.25, 4), C.dark);
    P(cyl(0.13, 0.07, 0.15, xw - 0.25, 1.12, z - 0.25, 10), C.yellow);
    P(box(0.3, 0.2, 0.26, xw - 0.3, 0.82, z + 0.18).rotateY(0.2), C.woodDark);
    P(box(0.22, 0.05, 0.3, xw - 0.3, 1.02, z + 0.18).rotateY(-0.1), C.blue);
    picture(deco, starChart(), crossFrame(ROOMS.main.z0 + 0.08, 1, 2.35, 1.6, 0.0, 0.02), 0.72, 0.54);
  }
  // the bunk in its arched alcove in the starboard wall, head aft, the window over it (the hull's starboard
  // window): a wooden frame with drawers under, a thick mattress, the coral blanket rumpled, pillows; inside the
  // alcove teal, a shelf of books, photographs pinned up, a reading lamp, jackets on a hook at its foot
  const bed = { x0: ALCOVE.x + 0.1, x1: WALL_IN, z0: ALCOVE.z0 + 0.1, z1: ALCOVE.z1 - 0.1 };
  {
    const { x: ax, z0: az0, z1: az1, top } = ALCOVE, w = WALL_IN - ax;
    // the arched front: a wall with a rounded opening, a teal rim round it
    const open = { z0: az0 + 0.1, z1: az1 - 0.1, y0: 0.34, y1: top };
    batch.add('wall', archPanel(ax, 0.1, [az0, az1, 0, CEIL], open, 0.5));
    batch.add('teal', archPanel(ax - 0.012, 0.012, roundedRect(open, 0.5, 0.07), open, 0.5));
    // the cheeks and the hood inside, lined teal
    for (const z of [az0 + 0.05, az1 - 0.05]) batch.add('wall', box(w, CEIL, 0.1, ax + w / 2, DECK, z));
    batch.add('cream', box(w, CEIL - top, az1 - az0, ax + w / 2, H(top), (az0 + az1) / 2));
    for (const [z, d] of [[az0 + 0.105, 1], [az1 - 0.105, -1]]) batch.add('teal', box(w - 0.12, top - 0.6, 0.01, ax + 0.06 + w / 2, H(0.58), z + d * 0.0));
    batch.add('teal', box(0.01, 0.6, az1 - az0 - 0.2, WALL_IN - 0.012, H(0.58), (az0 + az1) / 2));
    // the bed
    const bx = (bed.x0 + bed.x1) / 2, bz = (bed.z0 + bed.z1) / 2, bw = bed.x1 - bed.x0, bl = bed.z1 - bed.z0;
    batch.add('wood', box(bw, 0.36, bl, bx, DECK, bz));
    for (const z of [bz - bl / 4, bz + bl / 4]) { batch.add('wood', box(0.02, 0.2, bl / 2 - 0.1, ax - 0.012, H(0.07), z)); P(box(0.03, 0.04, 0.16, ax - 0.03, 0.17, z), C.brass); }   // drawers under it
    batch.add('cream', box(bw - 0.06, 0.2, bl - 0.08, bx, H(0.36), bz));
    batch.add('rugInner', box(bw - 0.02, 0.12, 1.25, bx - 0.02, H(0.54), bz - 0.3).rotateY(0.03));
    batch.add('rugInner', box(bw - 0.12, 0.15, 0.5, bx - 0.05, H(0.56), bed.z0 + 0.35).rotateX(0.1));   // kicked-off end
    batch.add('rug', box(0.55, 0.13, 0.5, bx - 0.15, H(0.6), bz + 0.25).rotateY(-0.4).rotateX(0.06));
    batch.add('pillow', box(bw - 0.25, 0.15, 0.42, bx, H(0.58), bed.z1 - 0.3).rotateY(0.04));
    batch.add('cream', box(0.5, 0.13, 0.36, bx + 0.12, H(0.68), bed.z1 - 0.32).rotateY(-0.12));
    block(box(bw, BLOCK_H, bl, bx, DECK, bz));
    // a shelf of books on the back wall forward of the window
    batch.add('wood', box(0.24, 0.03, 0.62, WALL_IN - 0.12, H(1.42), az0 + 0.46));
    batch.add('wood', box(0.24, 0.03, 0.62, WALL_IN - 0.12, H(1.78), az0 + 0.46));
    const bookC = [C.red, C.blue, C.khaki, C.green, C.plum, C.orange, C.teal, C.paper];
    for (let k = 0; k < 11; k++) P(box(0.17, 0.2 + ((k * 7) % 5) * 0.025, 0.05, WALL_IN - 0.12, k < 6 ? 1.45 : 1.81, az0 + 0.2 + (k % 6) * 0.095).rotateX(k % 6 === 5 ? 0.25 : 0), bookC[k % bookC.length]);
    // photographs pinned on the aft cheek over the pillow, a reading lamp
    for (const [x, h, t, c] of [[ax + 0.35, 1.3, 0.06, C.paper], [ax + 0.62, 1.45, -0.08, C.sky], [ax + 0.85, 1.22, 0.05, C.yellow]]) {
      P(box(0.18, 0.22, 0.004, 0, -0.11, 0), c, crossFrame(az1 - 0.1, -1, x, h, 0.006, t));
      P(box(0.13, 0.12, 0.003, 0, -0.1, 0.003), C.blue, crossFrame(az1 - 0.1, -1, x, h, 0.006, t));
    }
    picture(deco, homePhoto(), crossFrame(az1 - 0.1, -1, ax + 0.6, 1.78, 0.008, 0.03), 0.34, 0.26);
    P(cyl(0.012, 0.012, 0.25, WALL_IN - 0.1, 1.55, az1 - 0.3, 4).rotateX(-0.5), C.dark);
    P(cyl(0.1, 0.05, 0.12, WALL_IN - 0.12, 1.62, az1 - 0.42, 10), C.yellow);
    // jackets on a hook at its foot
    P(box(0.6, 0.05, 0.05, ax + 0.6, 1.92, az0 + 0.14), C.wood);
    for (const [x, c] of [[ax + 0.42, C.teal], [ax + 0.72, C.rust]]) {
      P(box(0.3, 0.85, 0.12, x, 1.06, az0 + 0.2).rotateZ(0.03), c);
      P(box(0.12, 0.12, 0.125, x + 0.05, 1.4, az0 + 0.2), C.paper);                   // a patch
    }
    // slippers by it
    P(box(0.28, 0.07, 0.12, ax - 0.3, 0, az1 - 0.4).rotateY(0.3), C.red);
    P(box(0.28, 0.07, 0.12, ax - 0.36, 0, az1 - 0.6).rotateY(-0.2), C.red);
  }
  const bedC = V((bed.x0 + bed.x1) / 2, DECK, (bed.z0 + bed.z1) / 2);
  // kit on hooks between the alcove and the lockers: a net bag, a coil of rope, a lantern
  {
    const xw = WALL_IN;
    P(box(0.05, 0.05, 0.75, xw - 0.04, 1.9, -1.45), C.wood);
    P(box(0.3, 0.55, 0.3, xw - 0.18, 1.18, -1.7).rotateX(0.05), C.khaki);
    for (let k = 0; k < 4; k++) P(box(0.31, 0.012, 0.31, xw - 0.18, 1.25 + k * 0.12, -1.7), C.woodDark);   // its net
    P(new THREE.TorusGeometry(0.17, 0.045, 6, 14).rotateY(PI / 2).translate(xw - 0.08, 1.55, -1.25), C.orange);
    P(cyl(0.07, 0.08, 0.2, xw - 0.14, 1.55, -1.05, 8), C.brass);
    block(box(0.38, BLOCK_H, 0.9, xw - 0.19, DECK, -1.45));
  }
  // the lockers along the starboard wall aft, a pack hanging on one
  {
    const x = WALL_IN - 0.3, lz0 = -0.95, lz1 = 2.4;
    batch.add('locker', box(0.6, 2.2, lz1 - lz0, x, DECK, (lz0 + lz1) / 2));
    for (let k = 0; k <= 5; k++) P(box(0.02, 2.05, 0.02, x - 0.305, 0.08, lz0 + ((lz1 - lz0) * k) / 5), C.ink);
    for (let k = 0; k < 5; k++) {
      const z = lz0 + ((lz1 - lz0) * (k + 0.5)) / 5;
      P(box(0.04, 0.2, 0.04, x - 0.33, 1.1, z + 0.22), C.steel);
      for (let v = 0; v < 3; v++) P(box(0.02, 0.025, 0.3, x - 0.31, 1.85 + v * 0.06, z), C.ink);
    }
    batch.add('teal', box(0.02, 0.5, 0.4, x - 0.31, H(0.3), lz0 + 0.33));
    P(box(0.24, 0.5, 0.36, x - 0.45, 1.1, 1.15), C.steel);                           // a grey pack on a door's hook
    P(box(0.26, 0.16, 0.38, x - 0.46, 1.5, 1.15), C.dark);
  }
  // pipes and skylights over the main room (the sheet's ceiling): two fat pipes along the middle, two panes
  {
    for (const x of [-0.55, -0.35]) {
      P(new THREE.CylinderGeometry(0.05, 0.05, ROOMS.cabin.z0 - ROOMS.main.z0 - 0.3, 8).rotateX(PI / 2).translate(x, CEIL - 0.09, (ROOMS.cabin.z0 + ROOMS.main.z0) / 2), x < -0.4 ? C.steel : C.coral);
    }
    for (let z = ROOMS.main.z0 + 0.8; z < ROOMS.cabin.z0; z += 1.7) P(box(0.32, 0.03, 0.05, -0.45, 2.27, z), C.steel);
    for (const [x, z] of [[1.0, -5.2], [1.0, -0.4]]) {
      batch.add('dark', box(0.92, 0.04, 0.72, x, H(CEIL - 0.04), z));
      batch.add('portIn', new THREE.PlaneGeometry(0.78, 0.58).rotateX(PI / 2).translate(x, H(CEIL - 0.045), z));
      batch.add('dark', box(0.03, 0.03, 0.58, x, H(CEIL - 0.07), z));
    }
  }

  // ------------------------------------------------------------ the back room
  // the sofa along the port wall under its porthole: low, deep, a blanket over its arm
  {
    const xw = -WALL_IN, sz0 = 2.95, sz1 = 4.45;
    batch.add('wood', box(0.78, 0.3, sz1 - sz0, xw + 0.39, DECK, (sz0 + sz1) / 2));
    batch.add('cushion', box(0.72, 0.16, sz1 - sz0 - 0.1, xw + 0.42, H(0.3), (sz0 + sz1) / 2));
    batch.add('cushion', box(0.2, 0.62, sz1 - sz0, xw + 0.1, H(0.3), (sz0 + sz1) / 2));
    for (const z of [sz0 + 0.06, sz1 - 0.06]) batch.add('wood', box(0.78, 0.6, 0.12, xw + 0.39, DECK, z));
    batch.add('blanket', box(0.8, 0.05, 0.5, xw + 0.4, H(0.6), sz1 - 0.3).rotateY(0.04));
    batch.add('pillow', box(0.14, 0.4, 0.4, xw + 0.25, H(0.46), sz0 + 0.4).rotateY(0.3));
    block(box(0.86, BLOCK_H, sz1 - sz0, xw + 0.43, DECK, (sz0 + sz1) / 2));
    P(box(0.24, 0.04, 0.3, xw + 0.5, 0.47, 3.9).rotateY(0.5), C.blue);           // a book left open on it
  }
  // the small table with three mismatched seats (block: you walk round it)
  {
    const tx = -1.35, tz = 5.65;
    batch.add('wood', cyl(0.45, 0.45, 0.04, tx, H(0.74), tz, 18));
    batch.add('dark', cyl(0.05, 0.05, 0.72, tx, DECK, tz, 8));
    batch.add('dark', cyl(0.3, 0.3, 0.03, tx, DECK, tz, 14));
    const seats = [[tx - 0.62, tz - 0.2, 'cushion'], [tx + 0.1, tz + 0.66, 'wood'], [tx + 0.6, tz - 0.3, 'blanket']];
    for (const [x, z, k] of seats) {
      batch.add(k, cyl(0.2, 0.2, 0.06, x, H(0.44), z, 12));
      for (let l = 0; l < 3; l++) { const a = (l / 3) * TAU; batch.add('dark', cyl(0.02, 0.02, 0.44, x + Math.sin(a) * 0.14, DECK, z + Math.cos(a) * 0.14, 5)); }
    }
    batch.add('wood', box(0.36, 0.5, 0.05, tx + 0.1, H(0.5), tz + 0.86));          // one with a back
    P(cyl(0.04, 0.045, 0.09, tx + 0.1, 0.78, tz - 0.1, 10), C.yellow);             // a cup left on it
    P(box(0.22, 0.01, 0.3, tx - 0.15, 0.78, tz + 0.1).rotateY(0.4), C.paper);
    block(cyl(0.95, 0.95, BLOCK_H, tx, DECK, tz, 18));
  }
  potPlant(batch, V(-2.75, DECK, 6.35), 0.8);
  // the desk and the chest of drawers along the starboard wall, books held under elastic straps over them
  {
    const xw = WALL_IN;
    batch.add('wood', box(0.6, 0.05, 1.3, xw - 0.3, H(0.74), 3.45));
    for (const z of [2.9, 4.0]) batch.add('wood', box(0.55, 0.74, 0.05, xw - 0.3, DECK, z));
    // the chair, a jacket over it
    batch.add('wood', box(0.42, 0.05, 0.42, xw - 0.8, H(0.45), 3.4));
    batch.add('wood', box(0.05, 0.45, 0.42, xw - 1.0, H(0.47), 3.4));
    for (const [dx, dz] of [[-0.18, -0.18], [-0.18, 0.18], [0.18, -0.18], [0.18, 0.18]]) batch.add('dark', box(0.04, 0.45, 0.04, xw - 0.8 + dx, DECK, 3.4 + dz));
    batch.add('blanket', box(0.1, 0.5, 0.44, xw - 1.04, H(0.5), 3.4).rotateX(0.03));
    block(box(0.95, BLOCK_H, 1.4, xw - 0.48, DECK, 3.45));
    // on the desk: papers, a pen, a cup, a lamp, the photo of home
    P(box(0.32, 0.004, 0.42, xw - 0.32, 0.795, 3.3).rotateY(0.15), C.paper);
    P(cyl(0.04, 0.045, 0.09, xw - 0.2, 0.79, 3.85, 10), C.cream);
    P(cyl(0.08, 0.1, 0.05, xw - 0.15, 0.79, 2.95, 10), C.dark);
    P(cyl(0.12, 0.06, 0.14, xw - 0.18, 1.05, 2.95, 10), C.yellow);
    P(cyl(0.01, 0.01, 0.22, xw - 0.15, 0.82, 2.95, 4), C.dark);
    // the chest of drawers
    batch.add('wood', box(0.55, 0.95, 0.9, xw - 0.28, DECK, 4.65));
    for (let d = 1; d < 4; d++) P(box(0.02, 0.02, 0.84, xw - 0.555, (0.95 * d) / 4, 4.65), C.woodDark);
    for (let d = 0; d < 4; d++) P(box(0.04, 0.035, 0.14, xw - 0.57, 0.95 * (d + 0.5) / 4, 4.65), C.brass);
    block(box(0.6, BLOCK_H, 0.95, xw - 0.3, DECK, 4.65));
    // the shelf of books under straps over the desk
    batch.add('wood', box(0.3, 0.04, 1.4, xw - 0.15, H(1.45), 3.45));
    const bookC = [C.red, C.blue, C.khaki, C.green, C.plum, C.orange, C.teal, C.paper];
    for (let k = 0; k < 14; k++) P(box(0.2, 0.22 + ((k * 7) % 5) * 0.025, 0.05 + (k % 3) * 0.015, xw - 0.14, 1.49, 2.85 + k * 0.085).rotateX(k % 6 === 5 ? 0.18 : 0), bookC[k % bookC.length]);
    for (const z of [3.1, 3.8]) P(box(0.24, 0.02, 0.025, xw - 0.14, 1.62, z), C.ink);
    picture(deco, homePhoto(), sideFrame(1, 4.65, 1.45, 0.02, 0.05), 0.4, 0.3);
    picture(deco, familyDrawing(), sideFrame(1, 3.45, 1.95, 0.02, -0.05), 0.46, 0.34);
  }
  // the clothes on hooks, patched, aft of the drawers; a bag on the floor
  {
    const xw = WALL_IN;
    P(box(0.05, 0.05, 1.3, xw - 0.04, 1.95, 5.85), C.wood);
    for (const [z, c, l] of [[5.35, C.khaki, 1.0], [5.7, C.rust, 1.15], [6.05, C.teal, 0.95], [6.35, C.plum, 1.05]]) {
      P(box(0.16, l, 0.32, xw - 0.12, 1.95 - l, z).rotateX(0.03), c);
      P(box(0.165, 0.12, 0.12, xw - 0.12, 1.4, z + 0.05), C.paper);                 // a patch
    }
    P(box(0.4, 0.34, 0.3, xw - 0.35, 0, 6.3).rotateY(0.3), C.blue);
    block(box(0.45, BLOCK_H, 1.4, xw - 0.22, DECK, 5.85));
  }

  // ------------------------------------------------------------ the hold
  {
    const z0h = ROOMS.hold.z0 + 0.12, z1h = ROOMS.hold.z1 - 0.12;
    for (const s of [-1, 1]) {
      const x = s * (WALL_IN - 0.3);
      batch.add('locker', box(0.6, 2.2, z1h - z0h - 0.9, x, DECK, (z0h + z1h) / 2 + 0.45));
      for (let k = 0; k <= 4; k++) P(box(0.02, 2.05, 0.02, x - s * 0.305, 0.08, z0h + 0.9 + ((z1h - z0h - 0.9) * k) / 4), C.ink);
      for (let k = 0; k < 4; k++) P(box(0.04, 0.2, 0.04, x - s * 0.33, 1.1, z0h + 1.05 + ((z1h - z0h - 0.9) * (k + 0.4)) / 4), C.steel);
    }
    // crates strapped down in the middle, a coil of rope, spare parts
    for (const [x, z, w, h, d, r] of [[-0.9, 8.6, 0.8, 0.6, 0.7, 0.1], [-0.85, 8.65, 0.6, 0.45, 0.55, -0.2], [0.95, 8.4, 0.9, 0.7, 0.8, -0.05]]) {
      const y = x === -0.85 ? 0.6 : 0;
      batch.add('crate', box(w, h, d, x, H(y), z).rotateY(0));
      P(box(w + 0.02, 0.05, 0.06, x, y + h * 0.5, z).rotateY(r * 0.1), C.yellow);
    }
    block(box(1.0, BLOCK_H, 0.9, -0.9, DECK, 8.6));
    block(box(1.0, BLOCK_H, 0.9, 0.95, DECK, 8.4));
    P(new THREE.TorusGeometry(0.22, 0.06, 6, 14).rotateX(PI / 2).translate(0.9, 0.78, 8.4), C.khaki);
    // the tool board on the forward wall, by the doorway
    batch.add('panel', box(1.3, 0.9, 0.04, -2.0, H(1.1), ROOMS.hold.z0 + 0.09));
    for (let k = 0; k < 6; k++) P(box(0.05, 0.3 + (k % 3) * 0.08, 0.03, -2.5 + k * 0.2, 1.35, ROOMS.hold.z0 + 0.13).rotateZ((k % 2 ? 0.2 : -0.15)), [C.red, C.steel, C.yellow][k % 3]);
    P(cyl(0.2, 0.2, 0.12, 2.2, 0, ROOMS.hold.z0 + 0.45, 12), C.dark);
  }

  // ------------------------------------------------------------ conduits under the ceiling, lamps
  {
    for (const x of [-1.9, 1.9]) P(new THREE.CylinderGeometry(0.035, 0.035, zEnd - ROOMS.main.z0 - 0.4, 6).rotateX(PI / 2).translate(x, CEIL - 0.08, (zEnd + ROOMS.main.z0) / 2), C.teal);
    P(box(0.24, 0.06, zEnd - ROOMS.main.z0 - 0.4, 2.6, CEIL - 0.1, (zEnd + ROOMS.main.z0) / 2), C.steel);
    for (let z = ROOMS.main.z0 + 0.6; z < zEnd; z += 1.6) P(box(0.08, 0.1, 0.08, 2.6, CEIL - 0.16, z), C.ink);
  }
  const lampSpots = [
    ['cockpit', V(-1.0, CEIL - 0.25, ROOMS.main.z0 + 0.35), 6], ['table', V(TABLE.x - 0.2, CEIL - 0.25, TABLE.z - 0.75), 6.5], ['galley', V(-2.1, CEIL - 0.25, -3.0), 5.5],
    ['aft', V(-1.3, CEIL - 0.25, 1.2), 6], ['cabin', V(-0.6, CEIL - 0.25, 4.7), 6], ['hold', V(0, CEIL - 0.25, 8.3), 5.5],
  ];
  const lamps = [];
  for (const [name, p, r] of lampSpots) {
    batch.add('dark', cyl(0.02, 0.02, 0.2, p.x, p.y + 0.06, p.z, 4));
    batch.add('lamp', new THREE.SphereGeometry(0.15, 12, 8).translate(p.x, p.y, p.z));
    batch.add('dark', new THREE.SphereGeometry(0.22, 12, 6, 0, TAU, 0, PI / 2.2).translate(p.x, p.y + 0.07, p.z));
    lamps.push({ name, p, r });
  }

  for (const [k, g] of Object.entries(Q)) if (!g.empty) batch.add(k, g.geo());
  const props = paint.mesh({ glow: 0.18 });
  props.name = 'ship-props';
  props.userData.noCollide = true;
  group.add(props);

  const tableC = V(TABLE.x, DECK, TABLE.z);
  return {
    deco, lamps, props,
    screen: { centre: scr.c, normal: screenNormal, radius: scr.r - 0.03 },
    points: {
      wakeEye: V(bedC.x - 0.05, H(0.86), bed.z1 - 0.4),
      wakeLook: V(ALCOVE.x - 0.4, H(1.75), ALCOVE.z0 + 0.7),   // (up at the alcove's arch and out, from the pillow)
      wakeSit: V(bedC.x - 0.1, H(1.25), bed.z1 - 0.55),         // sitting up on the bed, still inside the alcove
      wakeRoom: V(-0.6, H(1.4), TABLE.z - 0.4),                // where he looks sitting up: the holo table, the galley beyond
      bunkStand: V(ALCOVE.x - 0.62, DECK, ALCOVE.z1 + 0.2),    // out of the alcove at the pillow's end
      bunkStandHeading: PI,                                    // facing forward: the room, the table, the console's tail at the left
      cockpit: standPt.clone(),                                // (the voicemail: behind the console's tail, facing forward)
      cockpitHeading: PI,
      projector: PROJECTOR.clone(),                       // where the recordings' hologram stands
      seat: V(0, 0.45, 0).applyMatrix4(seatMs[0]),
      table: V(TABLE.x, H(TABLE.planetY), TABLE.z),       // the holo table's planet (src/ship/holotable.js)
      tableFoot: tableC,
      hatchIn: V(-(WALL_IN - 0.9), DECK, (HATCH.z0 + HATCH.z1) / 2),
      hatchHeading: HATCH_A,
      threshold: V(-(WALL_IN + HALF_W) / 2, DECK, (HATCH.z0 + HATCH.z1) / 2),   // in the doorway (stepping out)
      aboard: V(-1.4, DECK, 0.45),                        // a few steps in from the hatch (clear of the voicemail's reach)
      voicemail: VOICEMAIL.clone(),                       // the voicemail button on the console (it blinks while a message waits)
    },
  };
}

const bil = (P, u, v) => P[0].clone().multiplyScalar((1 - u) * (1 - v)).addScaledVector(P[1], u * (1 - v)).addScaledVector(P[2], u * v).addScaledVector(P[3], (1 - u) * v);

function potPlant(batch, p, s = 1) {
  batch.add('pot', new THREE.CylinderGeometry(0.28, 0.2, 0.5, 10).scale(s, s, s).translate(p.x, p.y + 0.25 * s, p.z));
  for (let k = 0; k < 5; k++) {
    const a = k * 1.3, lean = 0.25 + (k % 2) * 0.2;
    batch.add('leaf', new THREE.ConeGeometry(0.14, 0.9, 5).translate(0, 0.45, 0).rotateZ(lean).scale(s, s, s).rotateY(a).translate(p.x, p.y + 0.45 * s, p.z));
  }
  batch.add('collider', new THREE.CylinderGeometry(0.34 * s, 0.34 * s, BLOCK_H, 10).translate(p.x, DECK + BLOCK_H / 2, p.z));
}

/** Whether a ship-local point is in the rooms (on or over the deck, under the ceiling, inside the walls). */
export function inRooms(l, { margin = 0.3 } = {}) {
  if (l.y < DECK - 0.8 || l.y > CEIL + 0.9) return false;
  if (l.z < ROOMS.cockpit.z0 - margin || l.z > ROOMS.hold.z1 + margin) return false;
  const half = l.z < ROOMS.main.z0 ? cockpitHalf(l.z) : WALL_IN;
  return Math.abs(l.x) < half + margin;
}
