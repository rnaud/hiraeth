import * as THREE from 'three';
import { makeMaterial } from '../materials.js';
import { Paint } from '../vehicle-kit.js';
import { DECK, CEIL, HALF_W, WALL_IN, HATCH, HATCH_A, OPENINGS, STATIONS, sectionAt, Quads, holedPatch, reveal, addShape } from './hull.js';
import { familyDrawing, motherNote, homePhoto, starChart } from './art.js';

// The ship's rooms, inside the angular hull (docs/systems/ship.md, "The blockout"). One deck, from the bow:
//   - the cockpit (z -9 .. -6.1): the dash under the windshield, the pilot's seat left of centre, the
//     recordings' projector and the voicemail button on the dash, the round call screen on its stalk;
//   - the main room (-6.1 .. 2.55), open to the cockpit through a wide frame: the holo table at the front,
//     the galley along the starboard wall under its window, the hatch, the entry bench and lockers on the
//     port wall, a sofa under the slot window, a small table with three mismatched seats;
//   - the sleeping cabin (2.55 .. 6.75) through a doorway: the bed in its alcove, the desk, the chest of
//     drawers, clothes on hooks, books under straps, the portholes;
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
/** The recordings' projector on the dash (ship-local): the parents rise over it. */
export const PROJECTOR = new THREE.Vector3(0, DECK + 1.07, -8.25);
/** The voicemail button, at the dash's front edge right of the pilot's seat (it blinks while a message waits). */
export const VOICEMAIL = new THREE.Vector3(0.8, DECK + 1.14, -8.2);
/** The holo table: where it stands, its radius and height, the planet's size and height over the deck. */
export const TABLE = { x: 0, z: -2.6, r: 0.62, h: 0.92, planetR: 0.3, planetY: 1.58 };
/** How near the holo table counts as "at the table" (it opens the galactic map). */
export const TABLE_R = 1.6;
/** Height of the invisible blocks over low furniture: over the step, under the camera's line of sight. */
export const BLOCK_H = 1.1;
/** The galley counter's front (x) and the entry furniture's front (x): the open deck is between. */
export const GALLEY_X = WALL_IN - 0.65, ENTRY_X = -(WALL_IN - 0.45);

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
      if (Math.abs(x - PROJECTOR.x) < 0.42 || (Math.abs(x - VOICEMAIL.x) < 0.3 && row === 0) || (k * 5 + row * 3) % 7 === 0) continue;
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
  // the voicemail at the front of the dash: a small dark box with a big round lamp on it in a brass ring
  // (its own material, 'vmail': it blinks while a message waits, src/ship/ship.js)
  batch.add('vmailHalo', cyl(0.34, 0.34, 0.006, VOICEMAIL.x, H(DASH.h), VOICEMAIL.z, 28));   // the pool of light it throws on the dash
  batch.add('dark', box(0.32, 0.09, 0.28, VOICEMAIL.x, H(DASH.h), VOICEMAIL.z));
  batch.add('band', new THREE.TorusGeometry(0.125, 0.024, 6, 24).rotateX(PI / 2).translate(VOICEMAIL.x, H(DASH.h + 0.095), VOICEMAIL.z));
  batch.add('vmail', new THREE.SphereGeometry(0.11, 18, 9, 0, TAU, 0, PI / 2).scale(1, 0.75, 1).translate(VOICEMAIL.x, H(DASH.h + 0.09), VOICEMAIL.z));
  // the recordings' projector in the middle of the dash: a dark drum, a brass rim, a lens
  {
    const p = V(PROJECTOR.x, H(DASH.h), PROJECTOR.z);
    batch.add('dark', cyl(0.3, 0.26, 0.06, p.x, p.y, p.z, 24));
    batch.add('band', new THREE.TorusGeometry(0.26, 0.022, 6, 28).rotateX(PI / 2).translate(p.x, p.y + 0.06, p.z));
    batch.add('glowTeal', cyl(0.16, 0.16, 0.02, p.x, p.y + 0.06, p.z, 20));
  }
  // the pilot's seat, left of centre, turned a little toward the middle
  const seatM = new THREE.Matrix4().makeRotationY(-0.15).setPosition(-1.15, DECK, -7.35);
  {
    const S = (g) => g.applyMatrix4(seatM);
    batch.add('dark', S(cyl(0.16, 0.26, 0.42, 0, 0, 0, 10)));
    batch.add('cushion', S(box(0.66, 0.16, 0.64, 0, 0.42)));
    batch.add('cushion', S(box(0.66, 0.9, 0.16, 0, 0.55, 0.34).rotateX(0.12)));
    batch.add('cushion', S(box(0.42, 0.24, 0.12, 0, 1.38, 0.44)));                 // the headrest
    for (const s of [-1, 1]) batch.add('dark', S(box(0.07, 0.07, 0.5, s * 0.37, 0.72, 0.02)));
    block(S(box(0.76, BLOCK_H, 0.76, 0, 0, 0.05)));
    P(S(box(0.42, 0.07, 0.28, 0.05, 0.58, 0.0).rotateY(0.2)), C.paper);         // a flight log left on it
  }
  // the jump seat, folded against the starboard wall
  batch.add('dark', box(0.08, 0.5, 0.5, cockpitHalf(-6.7) - 0.06, H(0.45), -6.7));
  batch.add('cushion', box(0.12, 0.48, 0.44, cockpitHalf(-6.7) - 0.15, H(0.5), -6.7));
  // the round call screen on its stalk at the right of the dash, turned to the pilot: the map, the reel's date stamp
  const scr = { c: V(1.6, H(1.68), -7.95), r: 0.36 };
  const cockpitPt = V(0.25, DECK, -6.95);
  const screenNormal = V(cockpitPt.x - scr.c.x, 0.25, cockpitPt.z - scr.c.z).normalize();
  {
    batch.add('dark', box(0.08, scr.c.y - H(DASH.h), 0.08, scr.c.x, H(DASH.h), scr.c.z));
    const look = new THREE.Matrix4().lookAt(V(0, 0, 0), screenNormal, V(0, 1, 0));
    const bez = new THREE.TorusGeometry(scr.r + 0.04, 0.06, 6, 32).applyMatrix4(new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion().setFromUnitVectors(V(0, 0, 1), screenNormal)));
    batch.add('dark', bez.translate(scr.c.x, scr.c.y, scr.c.z));
    const back = new THREE.CylinderGeometry(scr.r + 0.06, scr.r + 0.06, 0.07, 32).rotateX(PI / 2).applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V(0, 0, 1), screenNormal));
    batch.add('dark', back.translate(scr.c.x - screenNormal.x * 0.05, scr.c.y - screenNormal.y * 0.05, scr.c.z - screenNormal.z * 0.05));
    void look;
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
  // the holo table: a foot, a column, a drum flaring out to the rim, glass lit with the ship's power
  {
    const { x, z, r, h } = TABLE;
    batch.add('dark', cyl(0.46, 0.4, 0.08, x, DECK, z, 24));
    batch.add('dark', cyl(0.2, 0.2, 0.66, x, H(0.08), z, 14));
    batch.add('metal', cyl(0.36, r, 0.18, x, H(h - 0.18), z, 32));
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
      const a = 2.6 + k * 0.16;
      batch.add(['btnA', 'btnB', 'btnC'][k % 3], box(0.05, 0.02, 0.05, x + Math.sin(a) * (r - 0.12), H(h), z + Math.cos(a) * (r - 0.12)).rotateY(0));
    }
    block(cyl(r + 0.03, r + 0.03, BLOCK_H, x, DECK, z, 20));
    // the rug under it, coral with a cream border (the Main Interior reference)
    batch.add('rug', box(2.4, 0.012, 4.6, 0, DECK, -1.3));
    batch.add('rugInner', box(2.1, 0.014, 4.3, 0, DECK, -1.3));
  }
  // the galley along the starboard wall: the counter (cupboards, drawers), the stove, the sink, the kettle and
  // cups, the cupboards over it either side of its window, a pantry at the forward end
  {
    const x0 = GALLEY_X, xw = WALL_IN, gz0 = -5.6, gz1 = -1.0, h = 0.92;
    batch.add('locker', box(xw - x0, h - 0.05, gz1 - gz0, (x0 + xw) / 2, DECK, (gz0 + gz1) / 2));
    batch.add('wood', box(xw - x0 + 0.05, 0.05, gz1 - gz0 + 0.04, (x0 + xw) / 2 - 0.025, H(h - 0.05), (gz0 + gz1) / 2));
    for (let k = 0; k <= 7; k++) P(box(0.02, h - 0.14, 0.02, x0 - 0.01, 0.06, gz0 + ((gz1 - gz0) * k) / 7), C.ink);
    for (let k = 0; k < 7; k++) {
      const z = gz0 + ((gz1 - gz0) * (k + 0.5)) / 7;
      if (k % 3 === 1) batch.add('cushion', box(0.02, 0.5, 0.5, x0 - 0.01, H(0.18), z));     // the coral doors
      P(box(0.04, 0.04, 0.16, x0 - 0.03, 0.72, z), C.steel);
    }
    // the stove: a dark plate, two rings, the kettle
    batch.add('dark', box(0.5, 0.03, 0.6, x0 + 0.3, H(h), -4.6));
    for (const z of [-4.75, -4.45]) P(cyl(0.1, 0.1, 0.012, x0 + 0.28, h + 0.03, z, 14), C.red);
    P(cyl(0.11, 0.09, 0.18, x0 + 0.28, h + 0.04, -4.75, 12), C.steel);
    P(tube([V(x0 + 0.18, h + 0.16, -4.75), V(x0 + 0.08, h + 0.2, -4.75), V(x0 + 0.04, h + 0.24, -4.75)], 0.015, 6), C.steel);
    // the sink under the window, a tap
    batch.add('metal', box(0.4, 0.03, 0.55, x0 + 0.3, H(h), -3.0));
    P(tube([V(xw - 0.05, h + 0.02, -3.0), V(xw - 0.1, h + 0.3, -3.0), V(xw - 0.3, h + 0.28, -3.0)], 0.02, 6), C.steel);
    // two cups, a teapot, bread, plates, a jar of herbs
    for (const [z, c] of [[-2.0, C.cream], [-1.75, C.teal]]) P(cyl(0.04, 0.045, 0.09, x0 + 0.22, h, z, 10), c);
    P(cyl(0.08, 0.1, 0.14, x0 + 0.35, h, -2.4, 12), C.coral);
    P(box(0.24, 0.1, 0.12, x0 + 0.35, h, -3.75).rotateY(0.2), C.khaki);
    for (let k = 0; k < 3; k++) P(cyl(0.12, 0.12, 0.012, x0 + 0.4, h + k * 0.014, -1.4, 16), C.paper);
    P(cyl(0.06, 0.06, 0.16, x0 + 0.5, h, -5.2, 10), C.green);
    // the cupboards over the counter, either side of the window (rounded doors, the Main Interior reference)
    for (const [za, zb] of [[gz0, -3.9], [-2.1, gz1]]) {
      batch.add('locker', box(0.42, 0.62, zb - za, xw - 0.21, H(1.55), (za + zb) / 2));
      for (let z = za + 0.35; z < zb - 0.1; z += 0.6) P(box(0.03, 0.03, 0.12, xw - 0.435, 1.62, z), C.steel);
      P(box(0.02, 0.56, 0.02, xw - 0.425, 1.58, (za + zb) / 2), C.ink);
    }
    // herbs drying under the window's head, a shelf of jars
    for (let k = 0; k < 4; k++) P(new THREE.ConeGeometry(0.06, 0.22, 5).rotateX(PI).translate(xw - 0.2, 1.88, -3.5 + k * 0.33), C.leaf);
    picture(deco, motherNote(), sideFrame(1, -1.55, 1.55, 0.01, 0.04), 0.36, 0.3);
    // the pantry at the forward end, by the cockpit frame: tall, with notes on it
    batch.add('locker', box(0.62, 2.2, 0.5, xw - 0.31, DECK, -5.85));
    P(box(0.02, 2.0, 0.02, xw - 0.62, 0.1, -5.85), C.ink);
    P(box(0.2, 0.24, 0.004, 0, -0.12, 0), C.yellow, wallFrame(V(xw - 0.625, H(1.6), -5.75), V(-1, 0, 0), 0.08));
  }
  // the small table with three mismatched seats, starboard aft (block: you walk round it)
  {
    const tx = 2.0, tz = 1.35;
    batch.add('wood', cyl(0.5, 0.5, 0.04, tx, H(0.74), tz, 18));
    batch.add('dark', cyl(0.05, 0.05, 0.72, tx, DECK, tz, 8));
    batch.add('dark', cyl(0.3, 0.3, 0.03, tx, DECK, tz, 14));
    const seats = [[tx - 0.75, tz - 0.25, 'cushion'], [tx - 0.1, tz + 0.78, 'wood'], [tx + 0.62, tz - 0.55, 'blanket']];
    for (const [x, z, k] of seats) {
      batch.add(k, cyl(0.2, 0.2, 0.06, x, H(0.44), z, 12));
      for (let l = 0; l < 3; l++) { const a = (l / 3) * TAU; batch.add('dark', cyl(0.02, 0.02, 0.44, x + Math.sin(a) * 0.14, DECK, z + Math.cos(a) * 0.14, 5)); }
    }
    batch.add('wood', box(0.36, 0.5, 0.05, tx - 0.1, H(0.5), tz + 0.98));          // one with a back
    P(cyl(0.04, 0.045, 0.09, tx + 0.1, 0.78, tz - 0.1, 10), C.yellow);             // a cup left on it
    P(box(0.22, 0.01, 0.3, tx - 0.15, 0.78, tz + 0.1).rotateY(0.4), C.paper);
    block(cyl(1.25, 1.25, BLOCK_H, tx, DECK, tz, 18));
  }
  // the entry along the port wall: lockers forward of the hatch, the worn bench beside it, coats on hooks, boots
  {
    const xw = -WALL_IN, lz0 = -5.6, lz1 = -3.0;
    batch.add('locker', box(0.6, 2.2, lz1 - lz0, xw + 0.3, DECK, (lz0 + lz1) / 2));
    for (let k = 0; k <= 4; k++) P(box(0.02, 2.05, 0.02, xw + 0.605, 0.08, lz0 + ((lz1 - lz0) * k) / 4), C.ink);
    for (let k = 0; k < 4; k++) {
      const z = lz0 + ((lz1 - lz0) * (k + 0.5)) / 4;
      P(box(0.04, 0.2, 0.04, xw + 0.63, 1.1, z + 0.18), C.steel);
      for (let v = 0; v < 3; v++) P(box(0.02, 0.025, 0.3, xw + 0.61, 1.85 + v * 0.06, z), C.ink);
    }
    batch.add('teal', box(0.02, 0.5, 0.4, xw + 0.61, H(0.3), -3.4));
    // the bench: a worn cushion on a wooden box, a bag on it
    const bz0 = -2.75, bz1 = -1.05;
    batch.add('wood', box(0.5, 0.42, bz1 - bz0, xw + 0.25, DECK, (bz0 + bz1) / 2));
    batch.add('cushion', box(0.48, 0.08, bz1 - bz0 - 0.08, xw + 0.25, H(0.42), (bz0 + bz1) / 2));
    P(box(0.3, 0.26, 0.4, xw + 0.28, 0.5, -2.2).rotateY(0.2), C.khaki);
    block(box(0.62, BLOCK_H, bz1 - bz0 + 0.1, xw + 0.31, DECK, (bz0 + bz1) / 2));
    // coats on hooks over it
    P(box(0.04, 0.05, 1.5, xw + 0.04, 1.8, -1.9), C.wood);
    for (const [z, c] of [[-2.5, C.rust], [-2.0, C.teal], [-1.45, C.khaki]]) {
      P(box(0.14, 0.95, 0.36, xw + 0.1, 0.88, z).rotateX(0.04), c);
      P(cyl(0.02, 0.02, 0.06, xw + 0.06, 1.8, z, 5).rotateZ(PI / 2), C.brass);
    }
    for (const z of [-2.55, -2.35]) P(box(0.28, 0.14, 0.1, xw + 0.65, 0, z), C.woodDark);   // boots by the bench
    picture(deco, homePhoto(), sideFrame(-1, -1.85, 2.08, 0.06, -0.03), 0.42, 0.31);
  }
  // the sofa aft of the hatch, under the slot window: low, deep, a blanket over its arm
  {
    const xw = -WALL_IN, sz0 = 0.85, sz1 = 2.35;
    batch.add('wood', box(0.78, 0.3, sz1 - sz0, xw + 0.39, DECK, (sz0 + sz1) / 2));
    batch.add('cushion', box(0.72, 0.16, sz1 - sz0 - 0.1, xw + 0.42, H(0.3), (sz0 + sz1) / 2));
    batch.add('cushion', box(0.2, 0.62, sz1 - sz0, xw + 0.1, H(0.3), (sz0 + sz1) / 2));
    for (const z of [sz0 + 0.06, sz1 - 0.06]) batch.add('wood', box(0.78, 0.6, 0.12, xw + 0.39, DECK, z));
    batch.add('blanket', box(0.8, 0.05, 0.5, xw + 0.4, H(0.6), sz1 - 0.3).rotateY(0.04));
    batch.add('pillow', box(0.14, 0.4, 0.4, xw + 0.25, H(0.46), sz0 + 0.4).rotateY(0.3));
    block(box(0.86, BLOCK_H, sz1 - sz0, xw + 0.43, DECK, (sz0 + sz1) / 2));
    P(box(0.24, 0.04, 0.3, xw + 0.5, 0.47, 1.9).rotateY(0.5), C.blue);           // a book left open on it
  }
  // a pot plant by the cockpit frame, the star chart on the frame's back
  potPlant(batch, V(-2.6, DECK, -5.75), 0.8);
  picture(deco, starChart(), crossFrame(ROOMS.main.z0 + 0.08, 1, -2.4, 1.6, 0.0, 0.02), 0.72, 0.54);

  // ------------------------------------------------------------ the sleeping cabin
  // the bed in its alcove along the port wall, head aft: a wooden frame, a thick mattress, the rust-red
  // blanket rumpled, two pillows; an arched hood over it (the Living Quarters reference)
  const bed = { x0: -WALL_IN, x1: -WALL_IN + 1.62, z0: 4.4, z1: 6.62 };
  {
    const bx = (bed.x0 + bed.x1) / 2, bz = (bed.z0 + bed.z1) / 2, bw = bed.x1 - bed.x0, bl = bed.z1 - bed.z0;
    batch.add('wood', box(bw, 0.36, bl, bx, DECK, bz));
    batch.add('cream', box(bw - 0.1, 0.22, bl - 0.12, bx, H(0.36), bz - 0.02));
    batch.add('blanket', box(bw - 0.04, 0.12, 1.3, bx + 0.02, H(0.56), bz - 0.32).rotateY(0.03));
    batch.add('blanket', box(bw - 0.2, 0.16, 0.5, bx + 0.1, H(0.58), bed.z0 + 0.35).rotateX(0.1));   // kicked-off end
    batch.add('blanket', box(0.6, 0.14, 0.55, bx + 0.25, H(0.62), bz + 0.2).rotateY(-0.4).rotateX(0.06));
    batch.add('pillow', box(0.62, 0.15, 0.45, bx - 0.35, H(0.6), bed.z1 - 0.35));
    batch.add('pillow', box(0.62, 0.15, 0.45, bx + 0.38, H(0.6), bed.z1 - 0.38).rotateY(0.05));
    batch.add('cream', box(0.9, 0.06, 0.7, bx, H(0.58), bz + 0.3).rotateY(0.25));
    batch.add('wood', box(bw + 0.04, 1.0, 0.1, bx, DECK, bed.z1 - 0.02));           // the headboard
    block(box(bw + 0.08, BLOCK_H, bl + 0.06, bx, DECK, bz));
    // the hood: a cream cheek at the foot and an arched canopy over it, the alcove's inside teal
    batch.add('cream', box(bw + 0.08, 0.1, bl + 0.1, bx, H(1.92), bz));
    batch.add('teal', box(0.04, 1.4, bl, bed.x0 + 0.02, H(0.5), bz));
    batch.add('cream', box(0.3, 1.92, 0.12, bed.x1 - 0.1, DECK, bed.z0 - 0.06));
    // slippers by it, a reading lamp, photographs pinned in the alcove
    P(box(0.12, 0.07, 0.28, bed.x1 + 0.3, 0, bed.z1 - 0.7).rotateY(0.3), C.red);
    P(box(0.12, 0.07, 0.28, bed.x1 + 0.48, 0, bed.z1 - 0.62).rotateY(-0.2), C.red);
    P(cyl(0.012, 0.012, 0.3, bed.x0 + 0.12, 1.5, bed.z1 - 0.3, 4).rotateZ(0.5), C.dark);
    P(cyl(0.1, 0.05, 0.12, bed.x0 + 0.28, 1.58, bed.z1 - 0.3, 10), C.yellow);
    for (const [z, h, t, c] of [[4.95, 1.25, 0.06, C.paper], [5.35, 1.38, -0.08, C.sky], [5.95, 1.2, 0.05, C.paper], [4.6, 1.42, -0.04, C.yellow]]) {
      P(box(0.18, 0.22, 0.004, 0, -0.11, 0), c, sideFrame(-1, z, h, 0.06, t));
      P(box(0.13, 0.12, 0.003, 0, -0.1, 0.003), C.blue, sideFrame(-1, z, h, 0.06, t));
    }
  }
  const bedC = V((bed.x0 + bed.x1) / 2, DECK, (bed.z0 + bed.z1) / 2);
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
    ['cockpit', V(0, CEIL - 0.25, ROOMS.main.z0 - 0.2), 6], ['table', V(0, CEIL - 0.25, -3.2), 7], ['galley', V(2.2, CEIL - 0.25, -4.2), 5.5],
    ['entry', V(-2.0, CEIL - 0.25, -0.6), 6], ['cabin', V(-0.6, CEIL - 0.25, 4.7), 6], ['hold', V(0, CEIL - 0.25, 8.3), 5.5],
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
      wakeEye: V(bedC.x - 0.1, H(0.86), bed.z1 - 0.42),
      wakeLook: V(bedC.x + 0.9, H(1.7), bed.z0 - 0.2),     // (up at the alcove's hood and the cabin, from the pillow)
      wakeRoom: V(0.2, H(1.4), ROOMS.cabin.z0 - 0.5),      // where he looks sitting up: the doorway, the main room beyond
      bunkStand: V(bed.x1 + 0.65, DECK, 5.2),
      bunkStandHeading: Math.atan2(0 - (bed.x1 + 0.65), ROOMS.cabin.z0 - 5.2),   // toward the doorway
      cockpit: cockpitPt.clone(),
      cockpitHeading: PI,
      projector: PROJECTOR.clone(),                       // where the recordings' hologram stands
      seat: V(0, 0.45, 0).applyMatrix4(seatM),
      table: V(TABLE.x, H(TABLE.planetY), TABLE.z),       // the holo table's planet (src/ship/holotable.js)
      tableFoot: tableC,
      hatchIn: V(-(WALL_IN - 0.9), DECK, (HATCH.z0 + HATCH.z1) / 2),
      hatchHeading: HATCH_A,
      threshold: V(-(WALL_IN + HALF_W) / 2, DECK, (HATCH.z0 + HATCH.z1) / 2),   // in the doorway (stepping out)
      aboard: V(-0.9, DECK, 0.2),                         // a few steps in from the hatch
      voicemail: VOICEMAIL.clone(),                       // the voicemail button on the dash (it blinks while a message waits)
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
