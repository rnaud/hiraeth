import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { makeMaterial } from '../materials.js';
import { Paint, paintMaterial } from '../vehicle-kit.js';
import { sector, radialWall, polar, placeAt, tangentFrame } from './geo.js';
import { R, RI, DECK, CEIL, HATCH_A, FLOOR_R } from './hull.js';
import { familyDrawing, motherNote, homePhoto, starChart } from './art.js';

// The ship's one deck: a single round room, sized for one pilot. Built-in
// units stand round it against the curved hull (lockers, the galley counter,
// shelves, the instrument racks, crates strapped down), so the open floor in
// the middle is about 13 m across; four short ribs of wall mark out its corners:
//   - the bunk corner at the back (+z): the traveller's queen bed, a desk, a chest of drawers,
//   - the galley to port (-x): the counter, the stove, the pantry, a table for three,
//   - the entry to starboard (+x): lockers, a bench, coats, crates, the hatch,
//   - the cockpit at the front (-z): the big curved window, the dash, the pilot's seat.
// In the middle stands the holo table, the planet below turning over it
// (src/ship/holotable.js draws the planet; this file builds the table).
//
// The deck is one flat plane at y = DECK (an invisible collider disc under the
// drawn floor). Anything on it lower than the traveller's step (a bed, a stool,
// a pot) also gets an invisible block BLOCK_H tall over its footprint, so you
// walk round it instead of stepping up onto it: walking the deck never lifts you.
// All in ship-local coordinates.

const PI = Math.PI, TAU = PI * 2;
// how near the cockpit point counts as "at the console": the pilot's seat stands on the
// way in (r 5.6-6.3), so walking straight at the dash stops about 1.4 m short of it
export const CONSOLE_R = 2.3;
/** How far out the recordings' projector stands on the dash (ship-local radius, m). */
export const PROJECTOR_R = 7.95;
export const ROOM = { bunk: 0, hall: HATCH_A, cockpit: PI, galley: PI * 1.5 };
/** The voicemail button on the dash (ship-local): at its front edge, right of the pilot's seat (clear of it as you walk up). */
export const VOICEMAIL_A = PI - 0.18;
export const VOICEMAIL = polar(7.52, VOICEMAIL_A, DECK + 1.14);
/** How near the deck's centre counts as "at the holo table" (it opens the galactic map). */
export const TABLE_R = 1.75;
/** The front of the built-in units round the room (m from the centre): the open deck is inside it. */
export const UNIT_R = 7.05;
/** Where the four ribs of wall between the corners start (they run out to the hull). */
export const RIB_R = 5.8;
export const RIBS = [PI / 4, (3 * PI) / 4, (5 * PI) / 4, (7 * PI) / 4];
/** Height of the invisible blocks over low furniture: over the step, under the camera's line of sight. */
export const BLOCK_H = 1.1;
/** The holo table in the middle: its radius and height, and the planet's size and height over the deck. */
export const TABLE = { r: 0.62, h: 0.92, planetR: 0.3, planetY: 1.58 };
const rAt = (r, y) => Math.sqrt(Math.max(r * r - y * y, 0));
const H = (h) => DECK + h;
const box = (w, h, d, x = 0, y = 0, z = 0) => new THREE.BoxGeometry(w, h, d).translate(x, y + h / 2, z);
const cyl = (r0, r1, h, x = 0, y = 0, z = 0, seg = 12) => new THREE.CylinderGeometry(r1, r0, h, seg).translate(x, y + h / 2, z);
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const tube = (pts, r, seg = 16) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), seg, r, 5, false);
/** The tangent at azimuth a, toward increasing a. */
const along = (a) => V(Math.cos(a), 0, -Math.sin(a));

// the props' flat colours (one vertex-coloured mesh, src/vehicle-kit.js Paint)
const C = {
  paper: '#f7efdc', cream: '#f3ead8', wood: '#a8754f', woodDark: '#7d5338', teal: '#5fb7ad', dark: '#34405e', ink: '#2b211f',
  orange: '#e6875f', red: '#c8483a', yellow: '#f2c54b', blue: '#4f8fa8', green: '#7fa86a', leaf: '#4f6b34', pot: '#c8673f',
  steel: '#9aa7ad', khaki: '#b59a6a', plum: '#8a5a7a', sky: '#9fd3e0', rust: '#b5643c',
};

/** A frame on the inner hull at azimuth a, height h over the deck, `lift` into the room: x along, y up the curve, z out of the wall. */
function hullFrame(a, h, lift = 0.06, tilt = 0) {
  const c = tangentFrame(a, H(h), RI)(0, 0, -lift);
  const n = c.clone().normalize().negate();
  const u = along(a).negate();
  const v = new THREE.Vector3().crossVectors(n, u).normalize();
  return new THREE.Matrix4().makeBasis(u, v, n).multiply(new THREE.Matrix4().makeRotationZ(tilt)).setPosition(c);
}

/** A frame on a flat wall: centre c, normal n (x along the wall, y up). */
function wallFrame(c, n, tilt = 0) {
  const u = new THREE.Vector3().crossVectors(V(0, 1, 0), n).normalize();
  const v = new THREE.Vector3().crossVectors(n, u).normalize();
  return new THREE.Matrix4().makeBasis(u, v, n).multiply(new THREE.Matrix4().makeRotationZ(tilt)).setPosition(c);
}

/** A rib's face: the point at radius r, height h, on the side toward increasing (side 1) or decreasing (-1) azimuth. */
function ribFace(a, r, h, side, off = 0.13) {
  const n = along(a).multiplyScalar(side);
  return { c: polar(r, a, H(h)).addScaledVector(n, off), n };
}

function picture(group, tex, m, w, hgt) {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, hgt), makeMaterial({ color: '#ffffff', map: tex ?? undefined, flat: true, glow: 0.3 }));
  mesh.applyMatrix4(m);
  mesh.userData.noCollide = true;
  group.add(mesh);
  return mesh;
}

export function buildInterior(batch, group, o = {}) {
  const deco = new THREE.Group();    // pictures, the mobile: seen, not collided with
  deco.userData.noCollide = true;
  group.add(deco);
  const paint = new Paint();
  /** A prop in flat colour, through a matrix (drawn only: small things, never in the way). */
  const P = (geo, color, m) => { if (m) geo.applyMatrix4(m); paint.add(geo, color); return geo; };
  /** An invisible block: keeps you off something too low to be a wall (you walk round it, never up onto it). */
  const block = (geo) => batch.add('collider', geo);

  // ---------------------------------------------------------------- floor, ceiling, ribs
  // one flat plane for walking on, under everything drawn: the inlay round the table, a teal
  // ring, the boards. The drawn pieces meet edge to edge in the same plane, never overlapping
  batch.add('collider', sector({ r0: 0, r1: FLOOR_R, a0: 0, a1: TAU, y0: DECK - 0.2, y1: DECK, seg: 72 }));
  batch.add('floorDark', sector({ r0: 0, r1: 1.45, a0: 0, a1: TAU, y0: DECK - 0.2, y1: DECK, seg: 40 }));
  batch.add('teal', sector({ r0: 1.45, r1: 1.56, a0: 0, a1: TAU, y0: DECK - 0.2, y1: DECK, seg: 40 }));
  batch.add('floor', sector({ r0: 1.56, r1: FLOOR_R, a0: 0, a1: TAU, y0: DECK - 0.2, y1: DECK, seg: 72 }));
  batch.add('ceiling', sector({ r0: 0, r1: rAt(RI, CEIL) + 0.3, a0: 0, a1: TAU, y0: CEIL, y1: CEIL + 0.3, seg: 64 }));
  for (const a of RIBS) {
    batch.add('wall', radialWall({ a, r0: RIB_R, rs: RI, y0: DECK, y1: CEIL }));
    batch.add('trim', radialWall({ a, r0: RIB_R, rs: RI, y0: DECK, y1: H(0.18), t: 0.28 }));
    batch.add('trim', cyl(0.15, 0.15, CEIL - DECK, ...polar(RIB_R, a, DECK).toArray(), 10));   // the post at its end
    batch.add('teal', cyl(0.165, 0.165, 0.12, ...polar(RIB_R, a, H(2.4)).toArray(), 10));
  }

  // the built-in units: a body against the hull, a lid closing it to the hull at its top,
  // side panels following the hull's curve (so there is no gap behind)
  const unit = ({ key, lid = 'cream', r0 = UNIT_R, a0, a1, h }) => {
    batch.add(key, sector({ r0, r1: rAt(RI, DECK) + 0.08, a0, a1, y0: DECK, y1: H(h) }));
    batch.add(lid, sector({ r0: r0 - 0.04, r1: rAt(RI, H(h + 0.05)) + 0.12, a0: a0 - 0.006, a1: a1 + 0.006, y0: H(h), y1: H(h + 0.05) }));
    for (const a of [a0, a1]) batch.add(key, radialWall({ a, r0, rs: RI, y0: DECK, y1: H(h), t: 0.04, overlap: 0.1, steps: 6 }));
    if (h < BLOCK_H) block(sector({ r0: r0 - 0.04, r1: r0 + 0.4, a0, a1, y0: DECK, y1: H(BLOCK_H) }));
  };
  /** Door seams, knobs and vents on a unit's front: `doors` of them between a0 and a1. */
  const fronts = ({ r0 = UNIT_R, a0, a1, h, doors, knob = C.steel, vents = false, drawers = 0, seam = C.ink }) => {
    for (let k = 0; k <= doors; k++) {
      const a = a0 + ((a1 - a0) * k) / doors;
      if (k > 0 && k < doors) P(box(0.025, h - 0.12, 0.02, 0, 0.06, -0.012), seam, placeAt(r0, a, DECK));
      if (k === doors) break;
      const am = a0 + ((a1 - a0) * (k + 0.5)) / doors, w = (a1 - a0) * r0 / doors;
      const M = placeAt(r0, am, DECK);
      if (drawers) {
        for (let d = 1; d < drawers; d++) P(box(w - 0.08, 0.02, 0.02, 0, (h * d) / drawers, -0.012), seam, M);
        for (let d = 0; d < drawers; d++) P(box(0.14, 0.035, 0.04, 0, (h * (d + 0.5)) / drawers, -0.02), knob, M);
      } else P(box(0.04, 0.24, 0.04, w * 0.36 * (k % 2 ? -1 : 1), h * 0.5, -0.02), knob, M);
      if (vents) for (let v = 0; v < 3; v++) P(box(w * 0.5, 0.025, 0.02, 0, h - 0.3 - v * 0.07, -0.012), seam, M);
    }
  };

  // Reference interiors: cream overhead cupboards, teal seams and warm task lights.
  // These follow the galley's hull, above the worktop and outside the walking area.
  for (let i = 0; i < 6; i++) {
    const a = 4.36 + i * 0.125, m = placeAt(8.5, a, DECK);
    P(new RoundedBoxGeometry(0.98, 0.55, 0.7, 3, 0.07).translate(0, 2.495, 0.2), C.cream, m);
    P(box(0.85, 0.42, 0.025, 0, 2.28, -0.165), C.teal, m);
    P(box(0.78, 0.36, 0.03, 0, 2.31, -0.182), C.cream, m);
    P(box(0.13, 0.04, 0.04, 0.25, 2.35, -0.21), C.woodDark, m);
    batch.add('lamp', box(0.58, 0.025, 0.17, 0, 2.2, 0).applyMatrix4(m));
  }
  // An oval luminous ceiling panel, framed like the reference's round skylight.
  batch.add('glowTeal', new THREE.CylinderGeometry(2.3, 2.3, 0.025, 48).scale(1, 1, 0.78).translate(0, CEIL - 0.025, 0));
  batch.add('cream', new THREE.TorusGeometry(2.38, 0.12, 8, 48).rotateX(PI / 2).scale(1, 1, 0.78).translate(0, CEIL - 0.06, 0));
  batch.add('teal', new THREE.TorusGeometry(2.55, 0.045, 6, 48).rotateX(PI / 2).scale(1, 1, 0.78).translate(0, CEIL - 0.035, 0));

  // ---------------------------------------------------------------- the holo table (centre)
  {
    batch.add('dark', cyl(0.46, 0.4, 0.08, 0, DECK, 0, 24));               // the foot
    batch.add('dark', cyl(0.2, 0.2, 0.66, 0, H(0.08), 0, 14));             // the column
    batch.add('metal', cyl(0.36, TABLE.r, 0.18, 0, H(TABLE.h - 0.18), 0, 32));   // the drum, flaring out to the rim
    batch.add('cream', new THREE.TorusGeometry(TABLE.r - 0.02, 0.07, 6, 36).rotateX(PI / 2).translate(0, H(TABLE.h), 0));
    batch.add('core', cyl(TABLE.r - 0.06, TABLE.r - 0.06, 0.012, 0, H(TABLE.h - 0.01), 0, 32));   // the glass: lit with the ship's power
    batch.add('dark', cyl(0.11, 0.09, 0.05, 0, H(TABLE.h), 0, 14));       // the emitter
    batch.add('glowTeal', cyl(0.06, 0.06, 0.012, 0, H(TABLE.h + 0.05), 0, 12));
    // three little legs of light from the emitter up to the planet, and a few buttons on the rim
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * TAU + 0.5;
      const p = polar(0.08, a, H(TABLE.h + 0.06)), q = polar(TABLE.planetR * 0.75, a, H(TABLE.planetY - TABLE.planetR * 0.6));
      batch.add('glowTeal', tube([p, p.clone().lerp(q, 0.5).add(polar(0.02, a, 0)), q], 0.006, 6));
    }
    for (let k = 0; k < 6; k++) {
      const a = 2.6 + k * 0.16, p = polar(TABLE.r - 0.12, a, H(TABLE.h));
      batch.add(['btnA', 'btnB', 'btnC'][k % 3], box(0.05, 0.02, 0.05).rotateY(a).translate(p.x, p.y, p.z));
    }
    block(cyl(TABLE.r + 0.03, TABLE.r + 0.03, BLOCK_H, 0, DECK, 0, 20));
  }

  // ---------------------------------------------------------------- the ceiling: a hub, cable trays, conduits
  {
    batch.add('dark', cyl(0.85, 0.85, 0.12, 0, CEIL - 0.12, 0, 28));
    batch.add('trim', new THREE.TorusGeometry(0.6, 0.04, 6, 28).rotateX(PI / 2).translate(0, CEIL - 0.13, 0));
    for (const a of RIBS) {
      const m = (RIB_R + 0.85) / 2;
      P(box(0.32, 0.06, RIB_R - 0.85).rotateY(a).translate(...polar(m, a, CEIL - 0.06).toArray()), C.dark);
      for (let k = 0; k < 4; k++) P(box(0.36, 0.08, 0.04).rotateY(a).translate(...polar(1.4 + k * 1.2, a, CEIL - 0.08).toArray()), C.steel);
    }
    // conduits along the hull over the units (clear of the portholes and the window)
    const runs = [[-0.72, -0.28], [0.28, 0.9], [1.08, 1.4], [1.75, 2.08], [2.24, 2.5], [3.78, 4.4], [4.62, 4.8], [5.0, 5.4]];
    for (const [a0, a1] of runs) for (const [h, rr, col] of [[2.78, 0.035, C.dark], [2.86, 0.025, C.rust]]) {
      const pts = [];
      for (let i = 0; i <= 8; i++) { const a = a0 + ((a1 - a0) * i) / 8; pts.push(polar(rAt(RI, H(h)) - 0.06, a, H(h))); }
      P(tube(pts, rr, 24), col);
    }
    // loose cables slung under the ceiling from the hub, out over the corners (well over your head)
    for (const [a, r1, sag] of [[0.3, 5.4, 0.32], [1.95, 5.0, 0.26], [2.85, 5.6, 0.36], [4.35, 5.2, 0.3], [5.85, 4.8, 0.24]]) {
      const p = polar(0.85, a, CEIL - 0.06), q = polar(r1, a + 0.12, CEIL - 0.04);
      P(tube([p, p.clone().lerp(q, 0.5).add(V(0, -sag, 0)), q], 0.022, 14), C.ink);
    }
  }

  // ---------------------------------------------------------------- the bunk corner (+z)
  const bunkA = 0.5;
  const bed = placeAt(7.75, bunkA, DECK);
  {
    const B = (g) => g.applyMatrix4(bed);
    // a queen bed, unmade: a low wooden frame, a thick mattress, two pillows, the blanket kicked
    // off at the foot, a headboard at the head end (-x)
    batch.add('wood', B(box(2.15, 0.36, 1.7)));
    batch.add('cream', B(box(2.02, 0.22, 1.6, 0.02, 0.36)));
    batch.add('blanket', B(box(1.3, 0.1, 1.64, 0.3, 0.56).rotateY(0.04)));
    batch.add('blanket', B(box(0.5, 0.16, 1.5, 0.85, 0.58).rotateZ(-0.1)));    // kicked-off end
    batch.add('pillow', B(box(0.48, 0.15, 0.66, -0.74, 0.6, -0.38)));
    batch.add('pillow', B(box(0.48, 0.15, 0.66, -0.76, 0.6, 0.4).rotateY(0.04)));
    batch.add('wood', B(box(0.1, 1.15, 1.76, -1.1, 0, 0)));                 // the headboard
    // unmade: the sheet rucked up, a pillow knocked askew
    batch.add('cream', B(box(0.9, 0.06, 0.7, 0.05, 0.58, -0.3).rotateY(0.25)));
    batch.add('blanket', B(box(0.55, 0.12, 0.5, -0.1, 0.62, 0.45).rotateY(-0.35).rotateZ(0.08)));
    for (const [x, z] of [[1.0, -0.78], [1.0, 0.78]]) batch.add('wood', B(box(0.08, 0.5, 0.08, x, 0, z)));   // the foot posts
    block(B(box(2.2, BLOCK_H, 1.76)));
    // slippers by the bed, a book left open on the floor
    P(box(0.12, 0.07, 0.28, 0, 0, 0).rotateY(0.3), C.red, new THREE.Matrix4().multiplyMatrices(bed, new THREE.Matrix4().makeTranslation(-0.55, 0, -1.05)));
    P(box(0.12, 0.07, 0.28, 0, 0, 0).rotateY(-0.2), C.red, new THREE.Matrix4().multiplyMatrices(bed, new THREE.Matrix4().makeTranslation(-0.32, 0, -1.1)));
    P(box(0.34, 0.03, 0.24).rotateY(0.7), C.blue, new THREE.Matrix4().multiplyMatrices(bed, new THREE.Matrix4().makeTranslation(0.65, 0, -1.15)));
  }
  const bedPt = (x, y, z) => new THREE.Vector3(x, y, z).applyMatrix4(bed);
  // the nightstand at the head, with a lamp and a clock
  unit({ key: 'wood', a0: 0.255, a1: 0.33, r0: 8.0, h: 0.55 });
  {
    const M = placeAt(8.2, 0.29, DECK);
    P(cyl(0.07, 0.09, 0.03, 0, 0.6, 0, 10), C.dark, M);
    P(cyl(0.012, 0.012, 0.28, 0, 0.63, 0, 4), C.dark, M);
    P(cyl(0.14, 0.08, 0.14, 0, 0.88, 0, 10), C.yellow, M);
    P(box(0.1, 0.08, 0.06, 0.12, 0.6, -0.15).rotateY(0.3), C.teal, M);
  }
  // the chest of drawers under the portholes: books, a radio, a framed photo, a mug
  const chest = { a0: -0.3, a1: 0.25, r0: 7.9, h: 0.86 };
  unit({ key: 'cream', lid: 'wood', ...chest });
  fronts({ ...chest, doors: 3, drawers: 3, knob: C.wood });
  {
    const top = H(chest.h + 0.05);
    const books = [[C.red, 0.26], [C.blue, 0.3], [C.yellow, 0.22], [C.teal, 0.28], [C.plum, 0.25]];
    books.forEach(([c, hh], i) => P(box(0.06, hh, 0.22).rotateY(-0.18 + 0.02 * i).translate(...polar(8.15, -0.24 + i * 0.012, top).toArray()), c));
    P(box(0.07, 0.24, 0.22).rotateZ(0.5).rotateY(-0.12).translate(...polar(8.15, -0.165, top).toArray()), C.green);    // one leaning
    const rad = placeAt(8.2, -0.02, top);
    P(box(0.42, 0.22, 0.18), C.orange, rad);
    P(cyl(0.06, 0.06, 0.02, 0, 0, 0, 12).rotateX(PI / 2).translate(-0.1, 0.11, -0.1), C.cream, rad);
    P(box(0.12, 0.08, 0.02, 0.1, 0.1, -0.095), C.ink, rad);
    P(cyl(0.006, 0.006, 0.4, 0.15, 0.22, 0, 4).rotateZ(-0.4), C.steel, rad);
    const fr = placeAt(8.1, 0.15, top, PI * 0.1);
    P(box(0.3, 0.24, 0.03, 0, 0, 0).rotateX(-0.2), C.woodDark, fr);
    P(box(0.24, 0.18, 0.012, 0, 0.03, -0.02).rotateX(-0.2), C.sky, fr);
    P(cyl(0.05, 0.05, 0.1, ...polar(7.98, 0.08, top).toArray(), 10), C.teal);
    potPlant(batch, polar(8.25, 0.22, top), 0.55);
  }
  // the desk with a lamp, papers and a toy model of the ship, and the chair with a jacket over it
  const deskA = -0.42;
  const desk = { a0: -0.53, a1: -0.31, r0: 7.75, h: 0.78 };
  unit({ key: 'wood', lid: 'wood', ...desk });
  fronts({ ...desk, doors: 1, drawers: 2, knob: C.cream, seam: C.woodDark });
  {
    const D = (g) => g.applyMatrix4(placeAt(8.1, deskA, DECK));
    const T = (g, c) => P(D(g), c);
    T(box(0.18, 0.04, 0.26, -0.45, 0.83), C.red);
    T(box(0.16, 0.05, 0.24, -0.43, 0.87).rotateY(0.2), C.blue);
    T(box(0.4, 0.008, 0.3, 0.05, 0.83).rotateY(-0.25), C.paper);                    // papers
    T(box(0.36, 0.008, 0.28, -0.05, 0.838).rotateY(0.15), C.paper);
    T(box(0.2, 0.01, 0.02, 0.02, 0.846).rotateY(0.6), C.ink);                        // a pencil
    batch.add('hull', D(new THREE.SphereGeometry(0.16, 12, 10).translate(0.4, 1.06, 0.05)));       // the toy ship
    batch.add('band', D(new THREE.CylinderGeometry(0.165, 0.165, 0.03, 12).translate(0.4, 1.06, 0.05)));
    batch.add('dark', D(box(0.03, 0.12, 0.03, 0.4, 0.83, 0.05)));
    batch.add('dark', D(box(0.16, 0.03, 0.16, 0.4, 0.83, 0.05)));
    // an angled desk lamp
    T(cyl(0.08, 0.08, 0.03, -0.5, 0.83, 0.15, 10), C.dark);
    T(cyl(0.012, 0.012, 0.42, 0, 0, 0, 4).rotateX(0.5).translate(-0.5, 1.03, 0.07), C.dark);
    T(cyl(0.12, 0.05, 0.14, 0, 0, 0, 10).rotateX(2.2).translate(-0.5, 1.2, -0.06), C.teal);
    // the chair, turned a little from the desk, a jacket thrown over its back
    const ch = new THREE.Matrix4().multiplyMatrices(placeAt(8.1, deskA, DECK), new THREE.Matrix4().makeTranslation(0.05, 0, -0.85).multiply(new THREE.Matrix4().makeRotationY(0.35)));
    const CH = (g) => g.applyMatrix4(ch.clone());
    batch.add('wood', CH(box(0.46, 0.05, 0.46, 0, 0.44)));
    batch.add('dark', CH(cyl(0.025, 0.025, 0.44, 0, 0, 0, 6)));
    batch.add('dark', CH(cyl(0.24, 0.24, 0.03, 0, 0, 0, 10)));
    batch.add('wood', CH(box(0.44, 0.5, 0.05, 0, 0.5, -0.21)));
    for (const s of [-1, 1]) batch.add('wood', CH(box(0.04, 0.5, 0.04, s * 0.2, 0.47, -0.21)));
    // the jacket: over the top of the back, down both faces, a sleeve hanging off each side
    P(CH(box(0.5, 0.1, 0.14, 0, 0.96, -0.21)), C.khaki);
    P(CH(box(0.48, 0.42, 0.04, 0, 0.56, -0.26)), C.khaki);
    P(CH(box(0.46, 0.3, 0.04, 0, 0.66, -0.16).rotateX(0.08)), C.khaki);
    P(CH(cyl(0.05, 0.06, 0.55, 0, 0, 0, 8).rotateZ(0.15).translate(0.27, 0.42, -0.24)), C.khaki);
    P(CH(cyl(0.05, 0.06, 0.5, 0, 0, 0, 8).rotateZ(-0.1).translate(-0.27, 0.46, -0.22)), C.khaki);
    P(CH(box(0.5, 0.05, 0.05, 0, 0.99, -0.13)), C.woodDark);                 // its collar
    block(CH(box(0.56, BLOCK_H, 0.56)));
  }
  // the low bookcase by the rib, a plant on top
  const books = { a0: -0.76, a1: -0.555, r0: 7.6, h: 1.25 };
  unit({ key: 'wood', lid: 'wood', ...books });
  {
    const cols = [C.red, C.blue, C.yellow, C.teal, C.cream, C.plum, C.green, C.orange];
    for (let row = 0; row < 3; row++) {
      P(box((books.a1 - books.a0) * books.r0 - 0.06, 0.03, 0.04, 0, 0.06 + row * 0.4, -0.02), C.woodDark, placeAt(books.r0, (books.a0 + books.a1) / 2, DECK));
      for (let k = 0; k < 9; k++) {
        const a = books.a0 + 0.012 + k * 0.021, hh = 0.24 + ((k * 7 + row * 3) % 5) * 0.025;
        P(box(0.12, hh, 0.04, 0, 0.09 + row * 0.4, -0.02).rotateZ((k + row) % 6 === 0 ? 0.25 : 0), cols[(k + row * 3) % cols.length], placeAt(books.r0, a, DECK));
      }
    }
    potPlant(batch, polar(7.95, -0.66, H(books.h + 0.05)), 0.7);
  }
  // the wardrobe at the foot of the bed, a robe hanging on its door
  const ward = { a0: 0.655, a1: 0.765, r0: 7.15, h: 2.05 };
  unit({ key: 'wood', lid: 'wood', ...ward });
  fronts({ ...ward, doors: 2, knob: C.cream, seam: C.woodDark });
  {
    const M = placeAt(ward.r0, 0.735, DECK);
    P(box(0.06, 0.06, 0.08, 0, 1.68, -0.04), C.dark, M);
    P(box(0.36, 0.95, 0.07, 0, 0.75, -0.08).rotateZ(0.03), C.red, M);
    P(box(0.08, 0.6, 0.03, 0.1, 0.65, -0.12), C.cream, M);
  }
  // the drawings on the hull wall over the desk: the family, a photo of home, the star chart they made
  // together (nothing over the bed); notes pinned up round them
  picture(deco, familyDrawing(), hullFrame(-0.46, 1.75, 0.06, 0.06), 1.05, 0.79);
  picture(deco, homePhoto(), hullFrame(-0.2, 1.62, 0.06, -0.08), 0.62, 0.47);
  picture(deco, starChart(), hullFrame(-0.64, 2.3, 0.06, -0.04), 0.7, 0.53);
  picture(deco, familyDrawing(), hullFrame(0.0, 2.1, 0.06, 0.1), 0.5, 0.38);
  const note = (m, w = 0.2, h = 0.24, col = C.paper, pin = C.red) => {
    P(box(w, h, 0.004, 0, -h / 2, 0), col, m);
    for (let k = 0; k < 3; k++) P(box(w * 0.7, 0.012, 0.003, -w * 0.05, -0.06 - k * 0.05, 0.003), C.ink, m);
    P(new THREE.SphereGeometry(0.018, 6, 4).translate(0, -0.02, 0.01), pin, m);
  };
  for (const [a, h, t, c] of [[-0.31, 1.95, 0.12, C.paper], [-0.58, 1.55, -0.1, C.yellow], [-0.35, 1.32, 0.05, C.paper], [-0.08, 1.98, -0.08, C.sky]]) note(hullFrame(a, h, 0.05, t), 0.2, 0.24, c);
  batch.add('rug', new THREE.CylinderGeometry(1.15, 1.15, 0.02, 24).translate(...polar(5.1, 0.2, DECK + 0.012).toArray()));
  batch.add('rugInner', new THREE.CylinderGeometry(0.75, 0.75, 0.022, 24).translate(...polar(5.1, 0.2, DECK + 0.014).toArray()));
  // the planet mobile over the rug (one mesh: it turns)
  {
    const mp = new Paint();
    mp.add(new THREE.CylinderGeometry(0.01, 0.01, 0.6).translate(0, -0.3, 0), C.ink);
    mp.add(new THREE.BoxGeometry(1.1, 0.03, 0.03).translate(0, -0.6, 0), C.ink);
    const cols = [C.yellow, C.teal, C.orange];
    [-0.55, 0, 0.55].forEach((x, i) => {
      mp.add(new THREE.CylinderGeometry(0.006, 0.006, 0.3 + i * 0.15).translate(x, -0.6 - (0.3 + i * 0.15) / 2, 0), C.ink);
      mp.add(new THREE.SphereGeometry(0.11 + i * 0.03, 10, 8).translate(x, -0.6 - (0.3 + i * 0.15) - 0.1, 0), cols[i]);
    });
    const mob = mp.mesh({ glow: 0.18 });
    mob.position.copy(polar(4.4, 0.32, CEIL));
    mob.userData.noCollide = true;
    deco.add(mob);
    group.userData.mobile = mob;
  }

  // ---------------------------------------------------------------- the galley (-x)
  const gA = ROOM.galley;
  // the counter: cupboards under, the worktop with the stove, a sink, the kettle, bread on a board
  const counter = { a0: gA - 0.44, a1: gA + 0.43, r0: UNIT_R, h: 0.92 };
  unit({ key: 'wood', ...counter });
  fronts({ ...counter, doors: 6, knob: C.cream, seam: C.woodDark });
  {
    const top = H(counter.h + 0.05);
    const st = polar(7.55, gA - 0.25, top);   // two stove rings, a pan on one
    batch.add('dark', box(0.75, 0.03, 0.5).rotateY(gA - 0.25).translate(st.x, st.y, st.z));
    for (const d of [-0.18, 0.18]) P(cyl(0.12, 0.12, 0.012, 0, 0, 0, 16).translate(...polar(7.55, gA - 0.25 + d / 7.55, top + 0.03).toArray()), C.rust);
    const pan = polar(7.55, gA - 0.25 - 0.18 / 7.55, top + 0.042);
    P(cyl(0.15, 0.13, 0.07, pan.x, pan.y, pan.z, 14), C.dark);
    P(cyl(0.015, 0.015, 0.3, 0, 0, 0, 5).rotateZ(PI / 2).rotateY(gA - 0.25).translate(pan.x + 0.25 * Math.cos(gA - 0.25), pan.y + 0.06, pan.z - 0.25 * Math.sin(gA - 0.25)), C.dark);
    const k = polar(7.6, gA + 0.02, top);   // the kettle
    batch.add('band', new THREE.SphereGeometry(0.2, 12, 10).scale(1, 0.85, 1).translate(k.x, k.y + 0.17, k.z));
    batch.add('dark', cyl(0.03, 0.05, 0.06, k.x, k.y + 0.32, k.z, 8));
    batch.add('band', new THREE.CylinderGeometry(0.02, 0.04, 0.25, 6).rotateZ(1.0).translate(k.x + 0.2, k.y + 0.22, k.z));
    const sk = placeAt(7.65, gA + 0.2, top);   // the sink and its tap
    P(box(0.62, 0.012, 0.46), C.steel, sk);
    P(box(0.5, 0.014, 0.34), C.dark, sk);
    P(cyl(0.025, 0.025, 0.3, 0, 0, 0.3, 6), C.steel, sk);
    P(box(0.04, 0.04, 0.22, 0, 0.28, 0.2), C.steel, sk);
    const bd = placeAt(7.5, gA + 0.34, top, 0.3);   // bread on a board, a knife
    P(box(0.42, 0.03, 0.28), C.woodDark, bd);
    P(new THREE.SphereGeometry(0.12, 10, 6).scale(1.5, 0.7, 1).translate(0.02, 0.07, 0), C.khaki, bd);
    P(box(0.26, 0.01, 0.03, 0.05, 0.04, 0.11).rotateY(0.2), C.steel, bd);
    for (const [d, c] of [[-0.4, C.cream], [-0.37, C.red], [0.08, C.teal]]) P(cyl(0.05, 0.055, 0.1, ...polar(7.35, gA + d, top).toArray(), 10), c);   // mugs
    for (let i = 0; i < 4; i++) P(cyl(0.16, 0.13, 0.025, ...polar(8.0, gA - 0.36, top + i * 0.03).toArray(), 14), i % 2 ? C.cream : C.teal);   // a stack of plates
    for (const [d, c] of [[0.38, C.leaf], [0.3, C.green]]) {   // herbs in small pots
      const p = polar(8.05, gA + d, top);
      P(cyl(0.08, 0.06, 0.13, p.x, p.y, p.z, 8), C.pot);
      for (let j = 0; j < 4; j++) P(new THREE.ConeGeometry(0.04, 0.2, 4).translate(0, 0.1, 0).rotateZ(0.3).rotateY(j * 1.6).translate(p.x, p.y + 0.12, p.z), c);
    }
    // a tea towel over the cupboard door
    P(box(0.24, 0.42, 0.02, 0, 0.4, -0.04), C.red, placeAt(UNIT_R, gA - 0.1, DECK));
    P(box(0.24, 0.05, 0.02, 0, 0.62, -0.042), C.cream, placeAt(UNIT_R, gA - 0.1, DECK));
    // the jars on the back of the worktop and on the shelf above
    const jarCols = [C.orange, C.teal, C.green, C.cream, C.blue, C.orange, C.teal, C.yellow];
    batch.add('wood', sector({ r0: 9.6, r1: rAt(RI, H(1.8)) + 0.1, a0: gA - 0.38, a1: gA + 0.38, y0: H(1.72), y1: H(1.8) }));
    for (let j = 0; j < 8; j++) {
      const a = gA - 0.32 + (j / 7) * 0.64, p = polar(9.95, a, H(1.8));
      const hgt = 0.18 + ((j * 7) % 5) * 0.04;
      P(cyl(0.09, 0.1, hgt, p.x, p.y, p.z, 10), jarCols[j]);
      P(cyl(0.07, 0.07, 0.03, p.x, p.y + hgt, p.z, 10), C.dark);
      const q = polar(8.75, a + 0.02, top), hh = 0.24 + ((j * 3) % 4) * 0.06;   // bottles and tins at the back
      P(cyl(0.07, 0.07, hh, q.x, q.y, q.z, 8), jarCols[(j + 3) % 8]);
    }
  }
  // the pantry, notes and a child's drawing stuck on its door
  const pantry = { a0: 3.97, a1: 4.2, r0: UNIT_R, h: 2.05 };
  unit({ key: 'cream', lid: 'wood', ...pantry });
  fronts({ ...pantry, doors: 2, knob: C.steel });
  for (const [a, h, c, t] of [[4.03, 1.55, C.paper, 0.1], [4.09, 1.35, C.yellow, -0.15], [4.15, 1.62, C.sky, 0.05], [4.06, 1.05, C.paper, 0.2]]) {
    const n = polar(-1, a, 0).normalize();
    note(wallFrame(polar(UNIT_R - 0.01, a, H(h)), n, t), 0.17, 0.2, c, [C.red, C.teal, C.yellow][Math.round(a * 50) % 3]);
  }
  // stores: crates stacked and strapped down by the rib, a sack against them
  const crate = (r, a, y, s, rot = 0) => {
    const M = placeAt(r, a, y, rot);
    batch.add('crate', box(s, s * 0.95, s).applyMatrix4(M));
    batch.add('dark', box(s + 0.02, 0.06, s + 0.02, 0, s * 0.45, 0).applyMatrix4(M));
    P(box(s * 0.4, s * 0.2, 0.01, 0, s * 0.62, -s / 2 - 0.006), C.paper, M);   // a stencilled label
    P(box(0.07, s * 0.95 + 0.02, s + 0.03, s * 0.25, 0, 0), C.orange, M);     // the straps over it
    P(box(0.07, s * 0.95 + 0.02, s + 0.03, -s * 0.25, 0, 0), C.orange, M);
    return M;
  };
  crate(7.55, 5.27, DECK, 0.8, 0.05);
  crate(7.65, 5.4, DECK, 0.72, -0.1);
  crate(7.6, 5.33, H(0.76), 0.6, 0.3);
  for (const a of [5.22, 5.46]) P(box(0.1, 0.05, 0.1), C.dark, placeAt(7.1, a, DECK));   // floor rings for the straps
  batch.add('cream', new THREE.SphereGeometry(0.4, 10, 8).scale(1, 0.72, 0.9).translate(...polar(6.85, 5.16, DECK + 0.28).toArray()));   // a sack
  block(cyl(0.42, 0.42, BLOCK_H, ...polar(6.85, 5.16, DECK).toArray(), 12));
  // the table, three stools, three colours: the family's
  {
    const t = polar(4.7, gA, DECK);
    batch.add('wood', cyl(0.62, 0.62, 0.06, t.x, DECK + 0.74, t.z, 24));
    batch.add('dark', cyl(0.1, 0.1, 0.74, t.x, DECK, t.z, 8));
    batch.add('dark', cyl(0.4, 0.45, 0.05, t.x, DECK, t.z, 16));
    block(cyl(0.66, 0.66, BLOCK_H, t.x, DECK, t.z, 16));
    const stoolCols = ['cushion', 'blanket', 'pillow'];
    for (let k = 0; k < 3; k++) {
      const s = t.clone().add(polar(0.95, gA + (k - 1) * 2.1 + PI, 0));
      batch.add('wood', cyl(0.2, 0.2, 0.05, s.x, DECK + 0.46, s.z, 12));
      batch.add(stoolCols[k], cyl(0.18, 0.18, 0.05, s.x, DECK + 0.51, s.z, 12));
      batch.add('dark', cyl(0.04, 0.04, 0.46, s.x, DECK, s.z, 6));
      block(cyl(0.22, 0.22, BLOCK_H, s.x, DECK, s.z, 10));
    }
    // a fruit bowl, two cups, a letter
    batch.add('teal', new THREE.SphereGeometry(0.2, 12, 8, 0, TAU, PI / 2, PI / 2).translate(t.x, DECK + 1.0, t.z));
    for (const [dx, dz, c] of [[0.05, 0.03, 'fruitA'], [-0.07, 0.02, 'fruitB'], [0, -0.07, 'fruitA']]) batch.add(c, new THREE.SphereGeometry(0.08, 8, 6).translate(t.x + dx, DECK + 0.88, t.z + dz));
    for (const [dx, dz] of [[0.36, 0.2], [-0.3, -0.32]]) batch.add('cream', cyl(0.05, 0.06, 0.1, t.x + dx, DECK + 0.8, t.z + dz, 8));
    P(box(0.22, 0.005, 0.15).rotateY(0.4).translate(t.x + 0.1, DECK + 0.803, t.z + 0.32), C.paper);
  }
  // herbs drying from the ceiling
  for (let k = 0; k < 5; k++) {
    const p = polar(6.6, gA - 0.3 + k * 0.15, CEIL);
    P(new THREE.ConeGeometry(0.1, 0.45, 6).rotateX(PI).translate(p.x, p.y - 0.62, p.z), k % 2 ? C.green : C.leaf);
    P(new THREE.CylinderGeometry(0.008, 0.008, 0.4).translate(p.x, p.y - 0.2, p.z), C.ink);
  }
  // the mother's note, pinned to the rib by the galley
  {
    const { c, n } = ribFace((7 * PI) / 4, 6.5, 1.55, -1);
    picture(deco, motherNote(), wallFrame(c, n, 0.05), 0.42, 0.35);
  }

  // ---------------------------------------------------------------- the entry (+x)
  {
    // the bench along the rib, boots under it
    const benchA = PI / 4 + 0.085;
    batch.add('wood', box(0.5, 0.45, 2.1).applyMatrix4(placeAt(6.5, benchA, DECK)));
    batch.add('cushion', box(0.46, 0.08, 2.0, 0, 0.45).applyMatrix4(placeAt(6.5, benchA, DECK)));
    block(box(0.56, BLOCK_H, 2.16).applyMatrix4(placeAt(6.5, benchA, DECK)));
    for (const z of [-0.2, 0.15]) P(box(0.2, 0.3, 0.32, 0.55, 0, z), C.dark, placeAt(5.3, benchA + 0.1, DECK));   // (drawn only: you walk through boots)
    P(box(0.34, 0.24, 0.28, 0, 0.53, 0.4).rotateY(0.3), C.teal, placeAt(6.5, benchA, DECK));   // a bag left on it
    // three lockers, a helmet on top, a drawing stuck on one door
    const lock = { a0: 1.0, a1: 1.33, r0: UNIT_R, h: 2.1 };
    unit({ key: 'locker', ...lock });
    fronts({ ...lock, doors: 3, vents: true });
    batch.add('cream', new THREE.SphereGeometry(0.24, 14, 10).translate(...polar(7.45, 1.08, H(lock.h + 0.29)).toArray()));
    batch.add('dark', new THREE.SphereGeometry(0.19, 12, 8).scale(1, 0.8, 0.6).translate(...polar(7.3, 1.1, H(lock.h + 0.29)).toArray()));
    note(wallFrame(polar(UNIT_R - 0.01, 1.27, H(1.55)), polar(-1, 1.27, 0).normalize(), -0.08), 0.24, 0.2, C.paper, C.teal);
    for (let k = 0; k < 3; k++) P(box(0.12, 0.05, 0.01, 0, 1.86, -0.012), C.paper, placeAt(UNIT_R, lock.a0 + (lock.a1 - lock.a0) * (k + 0.5) / 3, DECK));
    // crates strapped down on the far side of the door, a tool board on the hull over them
    crate(7.6, 1.95, DECK, 0.9, 0.05);
    crate(7.75, 2.13, DECK, 0.78, -0.08);
    crate(7.6, 2.02, H(0.86), 0.62, 0.25);
    for (const a of [1.86, 2.22]) P(box(0.1, 0.05, 0.1), C.dark, placeAt(7.05, a, DECK));
    const tb = hullFrame(2.02, 2.15, 0.05);
    P(box(1.1, 0.7, 0.03), C.woodDark, tb);
    for (const [x, y, w, h, c] of [[-0.38, 0.05, 0.05, 0.42, C.steel], [-0.22, 0.12, 0.2, 0.05, C.red], [-0.04, 0.0, 0.05, 0.36, C.dark], [0.16, 0.08, 0.04, 0.3, C.steel], [0.34, -0.04, 0.16, 0.16, C.orange]])
      P(box(w, h, 0.03, x, y, 0.03), c, tb);
    // coat pegs on the rib by the door: the coat, a scarf, a spare helmet on a shelf
    const wa = (3 * PI) / 4, n = along(wa).negate();
    const peg = (r, h) => polar(r, wa, H(h)).addScaledVector(n, 0.11);
    for (const r of [6.25, 6.9, 7.55]) batch.add('dark', box(0.08, 0.08, 0.08).translate(...peg(r, 1.82).toArray()));
    const coat = peg(6.25, 0.75).addScaledVector(n, 0.07);
    batch.add('blanket', box(0.62, 1.05, 0.16).rotateY(wa + PI / 2).translate(coat.x, coat.y, coat.z));
    const scarf = peg(6.9, 1.05).addScaledVector(n, 0.04);
    batch.add('cushion', box(0.18, 0.78, 0.07).rotateY(wa + PI / 2).translate(scarf.x, scarf.y, scarf.z));
    const shelf = peg(7.6, 1.5).addScaledVector(n, 0.1);
    batch.add('wood', box(0.9, 0.05, 0.4).rotateY(wa + PI / 2).translate(shelf.x, shelf.y, shelf.z));
    P(new THREE.SphereGeometry(0.2, 12, 8).translate(shelf.x, shelf.y + 0.2, shelf.z), C.orange);   // a knitted hat
    // the welcome mat and the hazard stripes at the door
    batch.add('rug', box(2.2, 0.02, 1.5).rotateY(HATCH_A).translate(...polar(7.7, HATCH_A, DECK + 0.011).toArray()));
    for (let k = -2; k <= 2; k++) batch.add('fruitA', box(0.14, 0.012, 1.7).rotateY(HATCH_A + 0.5).translate(...polar(8.62, HATCH_A + k * 0.03, DECK + 0.004).toArray()));
    // the hatch's control box with three lit buttons
    const cb = tangentFrame(HATCH_A - 0.2, H(1.35), RI)(0, 0, -0.12);
    batch.add('dark', box(0.3, 0.42, 0.3).translate(cb.x, cb.y - 0.21, cb.z));
    for (let k = 0; k < 3; k++) batch.add(k === 1 ? 'btnB' : 'btnA', box(0.07, 0.07, 0.07).translate(cb.x - Math.sin(HATCH_A - 0.2) * 0.17, cb.y + 0.07 - k * 0.11, cb.z - Math.cos(HATCH_A - 0.2) * 0.17));
    // a photo of home on the rib by the door
    const ph = ribFace(PI / 4, 6.5, 1.7, 1);
    picture(deco, homePhoto(), wallFrame(ph.c, ph.n, -0.03), 0.6, 0.45);
    potPlant(batch, polar(6.4, (3 * PI) / 4 - 0.17, DECK));
  }

  // ---------------------------------------------------------------- the cockpit (-z)
  const cA = ROOM.cockpit;
  batch.add('panel', sector({ r0: 7.35, r1: 8.35, a0: cA - 0.5, a1: cA + 0.5, y0: DECK, y1: H(0.92) }));
  batch.add('dark', sector({ r0: 7.25, r1: 9.65, a0: cA - 0.52, a1: cA + 0.52, y0: H(0.62), y1: H(1.0) }));
  batch.add('cream', sector({ r0: 7.2, r1: 7.4, a0: cA - 0.52, a1: cA + 0.52, y0: H(0.92), y1: H(1.02) }));
  block(sector({ r0: 7.2, r1: 7.6, a0: cA - 0.52, a1: cA + 0.52, y0: DECK, y1: H(BLOCK_H) }));
  {
    // buttons, dials and levers on the dash
    const cols = ['btnA', 'btnB', 'btnC'];
    for (let row = 0; row < 3; row++) for (let k = 0; k < 13; k++) {
      if ((k * 5 + row * 3) % 7 === 0 || (k === 6 && row > 0) || (row === 0 && (k === 3 || k === 4))) continue;   // (the middle: the projector; the voicemail)
      const a = cA - 0.42 + (k / 12) * 0.84, p = polar(7.55 + row * 0.32, a, H(1.0));
      batch.add(cols[(k + row) % 3], box(0.09, 0.05, 0.09).rotateY(a).translate(p.x, p.y, p.z));
    }
    for (const a of [cA - 0.3, cA + 0.3]) {
      const p = polar(8.7, a, H(1.0));
      batch.add('trim', cyl(0.2, 0.2, 0.04, p.x, p.y, p.z, 16));
      batch.add('ink', box(0.03, 0.02, 0.17).rotateY(a + 0.7).translate(p.x, p.y + 0.04, p.z));
    }
    for (const a of [cA - 0.08, cA + 0.08]) {
      const p = polar(7.75, a, H(1.0));
      batch.add('dark', box(0.04, 0.32, 0.04).rotateX(0.3).translate(p.x, p.y, p.z));
      batch.add('band', new THREE.SphereGeometry(0.06, 8, 6).translate(p.x, p.y + 0.34, p.z + 0.05));
    }
    // a little figure on the dash (the mother's), the father's old flight cap, a mug, a pinned note
    const fig = polar(7.5, cA + 0.42, H(1.02));
    batch.add('cushion', cyl(0.06, 0.04, 0.16, fig.x, fig.y, fig.z, 8));
    batch.add('pillow', new THREE.SphereGeometry(0.05, 8, 6).translate(fig.x, fig.y + 0.2, fig.z));
    const cap = polar(7.55, cA - 0.44, H(1.02));
    batch.add('blanket', new THREE.SphereGeometry(0.16, 12, 6, 0, TAU, 0, PI / 2).translate(cap.x, cap.y, cap.z));
    batch.add('blanket', box(0.18, 0.02, 0.14).rotateY(cA - 0.44).translate(...polar(7.35, cA - 0.44, H(1.02)).toArray()));
    P(cyl(0.05, 0.055, 0.1, ...polar(7.42, cA + 0.3, H(1.02)).toArray(), 10), C.orange);
  }
  // the voicemail at the front of the dash: a small dark box with a big round lamp on it in a brass
  // ring (its own material, 'vmail': it blinks while a message waits, src/ship/ship.js)
  batch.add('vmailHalo', cyl(0.4, 0.4, 0.006, VOICEMAIL.x, H(1.0), VOICEMAIL.z, 28));   // the pool of light it throws on the dash
  batch.add('dark', box(0.38, 0.09, 0.32).rotateY(VOICEMAIL_A).translate(VOICEMAIL.x, H(1.0), VOICEMAIL.z));
  batch.add('band', new THREE.TorusGeometry(0.145, 0.026, 6, 24).rotateX(PI / 2).translate(VOICEMAIL.x, H(1.095), VOICEMAIL.z));
  batch.add('vmail', new THREE.SphereGeometry(0.13, 18, 9, 0, TAU, 0, PI / 2).scale(1, 0.75, 1).translate(VOICEMAIL.x, H(1.09), VOICEMAIL.z));
  // the recordings' projector in the middle of the dash: a dark drum, a brass rim, a lens
  // (the parents rise over it as a hologram, src/ship/hologram.js)
  const proj = polar(PROJECTOR_R, cA, H(1.0));
  batch.add('dark', cyl(0.34, 0.3, 0.06, proj.x, proj.y, proj.z, 24));
  batch.add('band', new THREE.TorusGeometry(0.3, 0.025, 6, 28).rotateX(PI / 2).translate(proj.x, proj.y + 0.06, proj.z));
  batch.add('glowTeal', cyl(0.16, 0.16, 0.02, proj.x, proj.y + 0.06, proj.z, 20));
  // the pilot's seat
  const seat = placeAt(5.95, cA, DECK);
  {
    const S = (g) => g.applyMatrix4(seat);
    batch.add('dark', S(cyl(0.18, 0.28, 0.42, 0, 0, 0, 10)));
    batch.add('cushion', S(box(0.72, 0.16, 0.7, 0, 0.42)));
    batch.add('cushion', S(box(0.72, 0.95, 0.16, 0, 0.55, -0.36).rotateX(-0.12)));
    for (const s of [-1, 1]) batch.add('dark', S(box(0.08, 0.08, 0.55, s * 0.4, 0.75, -0.02)));
    block(S(box(0.8, BLOCK_H, 0.8, 0, 0, -0.05)));
    P(S(box(0.5, 0.08, 0.3, 0.05, 0.58, 0.05).rotateY(0.2)), C.paper);   // a flight log left on it
  }
  // the instrument racks either side of the window: screens, dials, switches, cables up to the ceiling
  for (const [a0, a1] of [[2.41, 2.6], [3.68, 3.87]]) {
    const rk = { a0, a1, r0: UNIT_R + 0.05, h: 2.2 };
    unit({ key: 'metal', lid: 'dark', ...rk });
    const am = (a0 + a1) / 2, M = placeAt(rk.r0, am, DECK), w = (a1 - a0) * rk.r0;
    batch.add('dark', box(w - 0.18, 0.5, 0.03, 0, 1.45, -0.02).applyMatrix4(M));
    batch.add('btnB', box(w - 0.3, 0.38, 0.02, 0, 1.51, -0.035).applyMatrix4(M));   // a screen (dark without power)
    for (let k = 0; k < 3; k++) {
      P(cyl(0.09, 0.09, 0.03, 0, 0, 0, 14).rotateX(PI / 2).translate((k - 1) * 0.36, 1.15, -0.03), C.cream, M);
      P(box(0.015, 0.08, 0.01, (k - 1) * 0.36, 1.15, -0.05).rotateZ(0.6 - k * 0.5), C.ink, M);
    }
    for (let k = 0; k < 6; k++) batch.add(['btnA', 'btnC', 'btnA'][k % 3], box(0.06, 0.06, 0.04, (k - 2.5) * 0.17, 0.92, -0.025).applyMatrix4(M));
    for (let k = 0; k < 2; k++) P(box(w - 0.2, 0.02, 0.02, 0, 0.55 + k * 0.18, -0.012), C.ink, M);   // panel seams
    P(box(0.5, 0.28, 0.01, 0, 0.3, -0.008), C.dark, M);
    for (const s of [-1, 1]) P(tube([V(s * 0.3, 2.2, -0.05), V(s * 0.32, 2.45, -0.2), V(s * 0.3, CEIL - DECK - 0.05, -0.35)].map((p) => p.applyMatrix4(M)), 0.025, 8), C.ink);
    note(wallFrame(polar(rk.r0 - 0.01, am + (a0 < 3 ? 0.06 : -0.06), H(1.9)), polar(-1, am, 0).normalize(), 0.1), 0.16, 0.2, C.yellow, C.red);
  }
  // (no cable cover across the floor to the dash: it read as a line leading you to the cockpit)
  potPlant(batch, polar(6.45, 2.47, DECK), 0.85);
  // the round screen hanging from the ceiling, up out of the hologram's way: the map, the reel's date stamp
  const scr = { c: polar(7.05, cA, H(2.86)), tilt: 0.24, r: 0.48 };
  {
    const top = polar(7.05, cA, H(3.3));
    batch.add('dark', box(0.08, CEIL - top.y, 0.08).translate(top.x, top.y, top.z));
    const bez = new THREE.TorusGeometry(scr.r + 0.05, 0.07, 6, 32).rotateX(scr.tilt).rotateY(cA + PI).translate(scr.c.x, scr.c.y, scr.c.z);
    batch.add('dark', bez);
    batch.add('dark', new THREE.CylinderGeometry(scr.r + 0.07, scr.r + 0.07, 0.08, 32).rotateX(PI / 2 + scr.tilt).rotateY(cA + PI).translate(...scr.c.clone().add(polar(0.07, cA, 0)).toArray()));
  }
  const screenNormal = polar(-1, cA, 0).normalize().applyAxisAngle(new THREE.Vector3(Math.cos(cA), 0, -Math.sin(cA)), -scr.tilt);
  // the star chart on the rib
  {
    const { c, n } = ribFace((5 * PI) / 4, 6.6, 1.75, -1);
    picture(deco, starChart(), wallFrame(c, n, 0.02), 0.9, 0.68);
  }

  // ---------------------------------------------------------------- lamps
  const lampSpots = [
    ['bunk', 5.6, 0.05], ['hall', 6.2, HATCH_A], ['galley', 5.4, ROOM.galley], ['cockpit', 5.0, PI],
    ['ring1', 2.4, PI / 4], ['ring2', 2.4, (5 * PI) / 4],
  ];
  const lamps = [];
  for (const [name, r, a] of lampSpots) {
    const p = polar(r, a, CEIL - 0.55);
    batch.add('dark', cyl(0.02, 0.02, 0.4, p.x, p.y + 0.15, p.z, 4));
    batch.add('lamp', new THREE.SphereGeometry(0.2, 12, 8).translate(p.x, p.y, p.z));
    batch.add('dark', new THREE.SphereGeometry(0.3, 12, 6, 0, TAU, 0, PI / 2.2).translate(p.x, p.y + 0.1, p.z));
    lamps.push({ name, p, r: name.startsWith('ring') ? 10 : 15 });
  }

  const props = paint.mesh({ glow: 0.18 });
  props.name = 'ship-props';
  props.userData.noCollide = true;
  group.add(props);

  return {
    deco, lamps, props,
    screen: { centre: scr.c, normal: screenNormal, radius: scr.r - 0.03, tilt: scr.tilt, a: cA },
    points: {
      wakeEye: bedPt(-0.62, 0.86, 0.05),
      wakeLook: bedPt(0.6, 1.6, 0.9),   // (up at the ceiling and the room, from the pillow)
      bunkStand: bedPt(0.2, 0, -1.45),
      bunkStandHeading: Math.atan2(-Math.sin(bunkA), -Math.cos(bunkA)),
      cockpit: polar(6.55, PI, DECK),
      cockpitHeading: PI,
      projector: polar(PROJECTOR_R, cA, H(1.07)),   // where the recordings' hologram stands
      seat: new THREE.Vector3(0, 0.45, 0).applyMatrix4(seat),
      table: V(0, H(TABLE.planetY), 0),             // the holo table's planet (src/ship/holotable.js)
      hatchIn: polar(8.1, HATCH_A, DECK),
      hatchHeading: HATCH_A,
      voicemail: VOICEMAIL.clone(),                 // the voicemail button on the dash (it blinks while a message waits)
    },
  };
}

function potPlant(batch, p, s = 1) {
  batch.add('pot', new THREE.CylinderGeometry(0.28, 0.2, 0.5, 10).scale(s, s, s).translate(p.x, p.y + 0.25 * s, p.z));
  for (let k = 0; k < 5; k++) {
    const a = k * 1.3, lean = 0.25 + (k % 2) * 0.2;
    batch.add('leaf', new THREE.ConeGeometry(0.14, 0.9, 5).translate(0, 0.45, 0).rotateZ(lean).scale(s, s, s).rotateY(a).translate(p.x, p.y + 0.45 * s, p.z));
  }
  // on the deck, a block keeps you off the rim of the pot
  if (Math.abs(p.y - DECK) < 0.01) batch.add('collider', new THREE.CylinderGeometry(0.34 * s, 0.34 * s, BLOCK_H, 10).translate(p.x, DECK + BLOCK_H / 2, p.z));
}

export { R };
