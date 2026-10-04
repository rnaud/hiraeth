import * as THREE from 'three';
import { makeMaterial } from '../materials.js';
import { sector, radialWall, polar, placeAt, tangentFrame } from './geo.js';
import { R, RI, DECK, CEIL, HATCH_A } from './hull.js';
import { familyDrawing, motherNote, homePhoto, starChart } from './art.js';

// The ship's one deck, laid out like a small round house around the
// (dead) reactor column:
//   - a ring corridor curving round the core,
//   - the bunk room at the back (+z): the traveller's queen bed, a desk, drawings,
//   - the galley and stores to port (-x): a round table for three, jars, crates,
//   - the entry hall to starboard (+x): coats, boots, the hatch,
//   - the cockpit at the front (-z): the big curved window, console and screen.
// All in ship-local coordinates (deck floor at y = DECK).

const PI = Math.PI;
export const CORE_R = 1.35, RING_R = 3.4;
// how near the cockpit point counts as "at the console": the pilot's seat stands on the
// way in (r 5.2-6.7), so walking straight at the dash stops about 1.7 m short of it
export const CONSOLE_R = 2.3;
/** How far out the recordings' projector stands on the dash (ship-local radius, m). */
export const PROJECTOR_R = 7.95;
export const ROOM = { bunk: 0, hall: HATCH_A, cockpit: PI, galley: PI * 1.5 };
const rAt = (r, y) => Math.sqrt(Math.max(r * r - y * y, 0));
const H = (h) => DECK + h;
const box = (w, h, d, x = 0, y = 0, z = 0) => new THREE.BoxGeometry(w, h, d).translate(x, y + h / 2, z);
const cyl = (r0, r1, h, x = 0, y = 0, z = 0, seg = 12) => new THREE.CylinderGeometry(r1, r0, h, seg).translate(x, y + h / 2, z);

/** A picture hung on the inner hull, facing into the room. */
function hullPicture(group, tex, a, h, w, hgt, lift = 0.06, tilt = 0) {
  const T = tangentFrame(a, H(h), RI);
  const c = T(0, 0, -lift);
  const n = c.clone().normalize().negate();          // into the room
  const u = new THREE.Vector3(Math.cos(a), 0, -Math.sin(a)).negate();
  const v = new THREE.Vector3().crossVectors(n, u).normalize();
  const m = new THREE.Matrix4().makeBasis(u, v, n).multiply(new THREE.Matrix4().makeRotationZ(tilt)).setPosition(c);
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, hgt), makeMaterial({ color: '#ffffff', map: tex ?? undefined, flat: true, glow: 0.3 }));
  mesh.applyMatrix4(m);
  mesh.userData.noCollide = true;
  group.add(mesh);
  return mesh;
}

/** A picture on a flat wall: centre, normal, up. */
function flatPicture(group, tex, c, n, w, hgt, tilt = 0, mat = null) {
  const up = new THREE.Vector3(0, 1, 0);
  const u = new THREE.Vector3().crossVectors(up, n).normalize();
  const v = new THREE.Vector3().crossVectors(n, u).normalize();
  const m = new THREE.Matrix4().makeBasis(u, v, n).multiply(new THREE.Matrix4().makeRotationZ(tilt)).setPosition(c);
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, hgt), mat ?? makeMaterial({ color: '#ffffff', map: tex ?? undefined, flat: true, glow: 0.3 }));
  mesh.applyMatrix4(m);
  mesh.userData.noCollide = true;
  group.add(mesh);
  return mesh;
}

export function buildInterior(batch, group, o = {}) {
  const deco = new THREE.Group();    // pictures, lamps, the mobile: seen, not collided with
  deco.userData.noCollide = true;
  group.add(deco);
  const floorR = rAt(RI, DECK) + 0.3;
  // floor and ceiling discs, a darker ring under the corridor, the corridor's guide line
  batch.add('floor', sector({ r0: RING_R, r1: floorR, a0: 0, a1: PI * 2, y0: DECK - 0.3, y1: DECK, seg: 64 }));
  batch.add('floorDark', sector({ r0: 0, r1: RING_R, a0: 0, a1: PI * 2, y0: DECK - 0.3, y1: DECK + 0.001, seg: 48 }));
  batch.add('ceiling', sector({ r0: 0, r1: rAt(RI, CEIL) + 0.3, a0: 0, a1: PI * 2, y0: CEIL, y1: CEIL + 0.3, seg: 64 }));
  batch.add('teal', sector({ r0: 2.32, r1: 2.44, a0: 0, a1: PI * 2, y0: DECK, y1: DECK + 0.012, seg: 64 }));

  // the reactor column: dark base and cap, a glass drum that glows when the ship has power
  batch.add('dark', sector({ r0: 0, r1: CORE_R + 0.15, a0: 0, a1: PI * 2, y0: DECK, y1: H(0.55), seg: 24 }));
  batch.add('dark', sector({ r0: 0, r1: CORE_R + 0.15, a0: 0, a1: PI * 2, y0: H(3.45), y1: CEIL, seg: 24 }));
  batch.add('core', new THREE.CylinderGeometry(CORE_R - 0.25, CORE_R - 0.25, 2.9, 20, 1).translate(0, H(2.0), 0));
  for (let k = 0; k < 8; k++) batch.add('trim', box(0.12, 2.9, 0.12, ...polar(CORE_R - 0.12, (k / 8) * PI * 2 + 0.2, 0).toArray()).translate(0, H(0.55), 0));
  for (const h of [1.3, 2.7]) batch.add('band', sector({ r0: CORE_R - 0.28, r1: CORE_R - 0.08, a0: 0, a1: PI * 2, y0: H(h), y1: H(h + 0.12), seg: 24 }));

  // the corridor wall, with a doorway into each room (wider into the cockpit)
  const doors = [[ROOM.bunk, 0.25], [ROOM.hall, 0.25], [ROOM.cockpit, 0.36], [ROOM.galley, 0.25]];
  const sorted = doors.map(([a, w]) => [a - w, a + w]).sort((p, q) => p[0] - q[0]);
  for (let i = 0; i < sorted.length; i++) {
    const a0 = sorted[i][1], a1 = i + 1 < sorted.length ? sorted[i + 1][0] : sorted[0][0] + PI * 2;
    batch.add('ringWall', sector({ r0: RING_R - 0.11, r1: RING_R + 0.11, a0, a1, y0: DECK, y1: CEIL }));
    batch.add('ringWall', sector({ r0: RING_R - 0.11, r1: RING_R + 0.11, a0: sorted[i][0], a1: sorted[i][1], y0: H(2.75), y1: CEIL }));
    batch.add('teal', sector({ r0: RING_R - 0.16, r1: RING_R + 0.16, a0: sorted[i][0] - 0.03, a1: sorted[i][1] + 0.03, y0: H(2.75), y1: H(2.9) }));
  }
  batch.add('trim', sector({ r0: RING_R - 0.13, r1: RING_R + 0.13, a0: 0, a1: PI * 2, y0: DECK, y1: H(0.18), seg: 64 }));
  // radial walls between the rooms, out to the hull
  for (const a of [PI / 4, (3 * PI) / 4, (5 * PI) / 4, (7 * PI) / 4]) {
    batch.add('wall', radialWall({ a, r0: RING_R, rs: RI, y0: DECK, y1: CEIL }));
    batch.add('trim', radialWall({ a, r0: RING_R, rs: RI, y0: DECK, y1: H(0.18), t: 0.28 }));
  }

  // ---------------------------------------------------------------- the bunk room (+z)
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
  }
  const bedPt = (x, y, z) => new THREE.Vector3(x, y, z).applyMatrix4(bed);
  // the desk with a lamp, books and a toy model of the ship
  const desk = placeAt(8.1, -0.42, DECK);
  {
    const D = (g) => g.applyMatrix4(desk);
    batch.add('wood', D(box(1.4, 0.06, 0.62, 0, 0.74)));
    for (const [x, z] of [[-0.62, -0.25], [0.62, -0.25], [-0.62, 0.25], [0.62, 0.25]]) batch.add('wood', D(box(0.06, 0.74, 0.06, x, 0, z)));
    batch.add('wood', D(box(0.45, 0.04, 0.45, 0, 0.44, -0.75)));
    batch.add('wood', D(box(0.06, 0.44, 0.06, 0, 0, -0.75)));
    batch.add('cushion', D(box(0.18, 0.04, 0.26, -0.45, 0.8)));
    batch.add('blanket', D(box(0.16, 0.05, 0.24, -0.43, 0.84).rotateY(0.2)));
    batch.add('pillow', D(box(0.17, 0.04, 0.25, -0.46, 0.89).rotateY(-0.1)));
    batch.add('hull', D(new THREE.SphereGeometry(0.16, 12, 10).translate(0.35, 1.06, 0.05)));       // the toy ship
    batch.add('band', D(new THREE.CylinderGeometry(0.165, 0.165, 0.03, 12).translate(0.35, 1.06, 0.05)));
    batch.add('dark', D(box(0.03, 0.12, 0.03, 0.35, 0.8, 0.05)));
    batch.add('dark', D(box(0.16, 0.03, 0.16, 0.35, 0.8, 0.05)));
  }
  // drawings on the hull wall, a rug, the planet mobile, a pot plant
  // the wall over the desk: the family drawing, a photo of home, the star chart they made together
  hullPicture(deco, familyDrawing(), -0.46, 1.75, 1.05, 0.79, 0.06, 0.06);
  hullPicture(deco, homePhoto(), -0.2, 1.6, 0.62, 0.47, 0.06, -0.08);
  hullPicture(deco, starChart(), -0.64, 2.3, 0.7, 0.53, 0.06, -0.04);
  hullPicture(deco, familyDrawing(), 0.22, 2.05, 0.6, 0.45, 0.06, 0.1);
  batch.add('rug', new THREE.CylinderGeometry(1.4, 1.4, 0.02, 24).translate(...polar(5.6, 0.05, DECK + 0.012).toArray()));
  batch.add('rugInner', new THREE.CylinderGeometry(0.9, 0.9, 0.022, 24).translate(...polar(5.6, 0.05, DECK + 0.014).toArray()));
  {
    const m = polar(5.6, 0.05, CEIL);
    const mob = new THREE.Group();
    const cord = makeMaterial({ color: '#2b211f' });
    mob.add(new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.6).translate(0, -0.3, 0), cord));
    mob.add(new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.03, 0.03).translate(0, -0.6, 0), cord));
    const cols = ['#f2c54b', '#5fb7ad', '#e6875f'];
    [-0.55, 0, 0.55].forEach((x, i) => {
      mob.add(new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.3 + i * 0.15).translate(x, -0.6 - (0.3 + i * 0.15) / 2, 0), cord));
      mob.add(new THREE.Mesh(new THREE.SphereGeometry(0.11 + i * 0.03, 10, 8).translate(x, -0.6 - (0.3 + i * 0.15) - 0.1, 0), makeMaterial({ color: cols[i] })));
    });
    mob.position.copy(m);
    deco.add(mob);
    group.userData.mobile = mob;
  }
  potPlant(batch, polar(4.4, -0.62, DECK));

  // ---------------------------------------------------------------- the galley (-x)
  const gA = ROOM.galley;
  {
    const t = polar(6.0, gA, DECK);
    batch.add('wood', cyl(0.82, 0.82, 0.06, t.x, DECK + 0.74, t.z, 24));
    batch.add('dark', cyl(0.12, 0.12, 0.74, t.x, DECK, t.z, 8));
    batch.add('dark', cyl(0.45, 0.5, 0.05, t.x, DECK, t.z, 16));
    const stoolCols = ['cushion', 'blanket', 'pillow'];   // three stools, three colours: the family's
    for (let k = 0; k < 3; k++) {
      const s = t.clone().add(polar(1.15, gA + (k - 1) * 2.1 + PI, 0));
      batch.add('wood', cyl(0.22, 0.22, 0.05, s.x, DECK + 0.46, s.z, 12));
      batch.add(stoolCols[k], cyl(0.2, 0.2, 0.05, s.x, DECK + 0.51, s.z, 12));
      batch.add('dark', cyl(0.05, 0.05, 0.46, s.x, DECK, s.z, 6));
    }
    // a fruit bowl and two cups
    batch.add('teal', new THREE.SphereGeometry(0.24, 12, 8, 0, PI * 2, PI / 2, PI / 2).translate(t.x, DECK + 1.04, t.z));
    for (const [dx, dz, c] of [[0.06, 0.03, 'fruitA'], [-0.08, 0.02, 'fruitB'], [0, -0.08, 'fruitA']]) batch.add(c, new THREE.SphereGeometry(0.09, 8, 6).translate(t.x + dx, DECK + 0.9, t.z + dz));
    for (const [dx, dz] of [[0.42, 0.25], [-0.35, -0.38]]) batch.add('cream', cyl(0.06, 0.07, 0.11, t.x + dx, DECK + 0.8, t.z + dz, 8));
  }
  // the counter and the shelf above it, hugging the hull
  batch.add('wood', sector({ r0: 7.55, r1: 8.6, a0: gA - 0.42, a1: gA + 0.42, y0: DECK, y1: H(0.9) }));
  batch.add('cream', sector({ r0: 7.45, r1: 8.65, a0: gA - 0.43, a1: gA + 0.43, y0: H(0.9), y1: H(0.96) }));
  batch.add('wood', sector({ r0: 8.85, r1: 9.75, a0: gA - 0.38, a1: gA + 0.38, y0: H(1.72), y1: H(1.8) }));
  {
    const jarCols = ['fruitA', 'teal', 'fruitB', 'cream', 'blanket', 'fruitA', 'teal', 'pillow'];
    for (let k = 0; k < 8; k++) {
      const a = gA - 0.32 + (k / 7) * 0.64, p = polar(9.3, a, H(1.8));
      const hgt = 0.18 + ((k * 7) % 5) * 0.04;
      batch.add(jarCols[k], cyl(0.09, 0.1, hgt, p.x, p.y, p.z, 10));
      batch.add('dark', cyl(0.07, 0.07, 0.03, p.x, p.y + hgt, p.z, 10));
    }
    const k = polar(8.05, gA + 0.18, H(0.96));   // the kettle
    batch.add('band', new THREE.SphereGeometry(0.2, 12, 10).scale(1, 0.85, 1).translate(k.x, k.y + 0.17, k.z));
    batch.add('dark', cyl(0.03, 0.05, 0.06, k.x, k.y + 0.32, k.z, 8));
    batch.add('band', new THREE.CylinderGeometry(0.02, 0.04, 0.25, 6).rotateZ(1.0).translate(k.x + 0.2, k.y + 0.22, k.z));
    const st = polar(8.1, gA - 0.25, H(0.96));   // a stove ring
    batch.add('dark', cyl(0.25, 0.25, 0.03, st.x, st.y, st.z, 16));
  }
  // stores: crates stacked by the wall, a sack
  for (const [r, a, h, s, rot] of [[7.6, 5.28, 0, 0.75, 0.1], [7.7, 5.08, 0, 0.7, -0.2], [7.65, 5.2, 0.72, 0.6, 0.35], [6.5, 5.33, 0, 0.55, 0.6]]) {
    batch.add('crate', box(s, s * 0.95, s).rotateY(rot).translate(...polar(r, a, DECK + h).toArray()));
    batch.add('dark', box(s + 0.02, 0.06, s + 0.02, 0, s * 0.45, 0).rotateY(rot).translate(...polar(r, a, DECK + h).toArray()));
  }
  batch.add('cream', new THREE.SphereGeometry(0.42, 10, 8).scale(1, 0.75, 0.9).translate(...polar(6.6, 4.18, DECK + 0.3).toArray()));
  // herbs drying from the ceiling
  for (let k = 0; k < 4; k++) {
    const p = polar(7.0, gA - 0.25 + k * 0.17, CEIL);
    deco.add(meshOf(new THREE.ConeGeometry(0.1, 0.45, 6).rotateX(PI).translate(p.x, p.y - 0.62, p.z), '#7fa86a'));
    deco.add(meshOf(new THREE.CylinderGeometry(0.008, 0.008, 0.4).translate(p.x, p.y - 0.2, p.z), '#2b211f'));
  }
  // the note, pinned to the wall by the door
  {
    const a = (7 * PI) / 4 - 0.002, c = polar(5.2, a, H(1.55));
    const n = new THREE.Vector3(Math.cos(a), 0, -Math.sin(a)).negate();   // galley side
    c.addScaledVector(n, 0.13);
    flatPicture(deco, motherNote(), c, n, 0.42, 0.35, 0.05);
  }

  // ---------------------------------------------------------------- the entry hall (+x)
  {
    const benchA = PI / 4 + 0.09;
    batch.add('wood', box(0.5, 0.45, 2.1).applyMatrix4(placeAt(6.3, benchA, DECK)));
    batch.add('cushion', box(0.46, 0.08, 2.0, 0, 0.45).applyMatrix4(placeAt(6.3, benchA, DECK)));
    // boots under the bench, coat and helmet on the far wall
    for (const z of [-0.2, 0.15]) batch.add('dark', box(0.2, 0.3, 0.32, 0.6, 0, z).applyMatrix4(placeAt(5.2, benchA + 0.1, DECK)));
    const wa = (3 * PI) / 4 - 0.035, nT = new THREE.Vector3(Math.cos(wa), 0, -Math.sin(wa)).negate();
    for (let k = 0; k < 3; k++) {
      const p = polar(5.0 + k * 0.9, wa, H(1.85));
      batch.add('dark', box(0.08, 0.08, 0.08).translate(p.x, p.y - 0.04, p.z).translate(nT.x * 0.05, 0, nT.z * 0.05));
    }
    const coat = polar(5.0, wa - 0.03, H(0.75));
    batch.add('blanket', box(0.62, 1.05, 0.16).rotateY(wa + PI / 2).translate(coat.x, coat.y, coat.z).translate(nT.x * 0.06, 0, nT.z * 0.06));
    const scarf = polar(5.9, wa - 0.03, H(1.05));
    batch.add('cushion', box(0.18, 0.78, 0.07).rotateY(wa + PI / 2).translate(scarf.x, scarf.y, scarf.z).translate(nT.x * 0.04, 0, nT.z * 0.04));
    const shelf = polar(7.0, wa - 0.05, H(1.5));
    batch.add('wood', box(0.9, 0.05, 0.4).rotateY(wa + PI / 2).translate(shelf.x, shelf.y, shelf.z));
    batch.add('cream', new THREE.SphereGeometry(0.26, 14, 10).translate(shelf.x, shelf.y + 0.3, shelf.z));      // a spare helmet
    batch.add('dark', new THREE.SphereGeometry(0.2, 12, 8).scale(1, 0.8, 0.6).translate(shelf.x + nT.x * 0.12, shelf.y + 0.3, shelf.z + nT.z * 0.12));
    // the welcome mat and the hazard stripes at the door
    batch.add('rug', box(2.4, 0.02, 1.5).rotateY(HATCH_A).translate(...polar(7.6, HATCH_A, DECK + 0.011).toArray()));
    for (let k = -2; k <= 2; k++) batch.add('fruitA', box(0.14, 0.012, 1.7).rotateY(HATCH_A + 0.5).translate(...polar(8.6, HATCH_A + k * 0.03, DECK + 0.006).toArray()));
    // the hatch's control box with three lit buttons
    const cb = tangentFrame(HATCH_A - 0.2, H(1.35), RI)(0, 0, -0.12);
    batch.add('dark', box(0.3, 0.42, 0.3).translate(cb.x, cb.y - 0.21, cb.z));
    for (let k = 0; k < 3; k++) batch.add(k === 1 ? 'btnB' : 'btnA', box(0.07, 0.07, 0.07).translate(cb.x - Math.sin(HATCH_A - 0.2) * 0.17, cb.y + 0.07 - k * 0.11, cb.z - Math.cos(HATCH_A - 0.2) * 0.17));
    // a photo of home on the wall by the door
    const pa = PI / 4 + 0.002, pn = new THREE.Vector3(Math.cos(pa), 0, -Math.sin(pa));
    flatPicture(deco, homePhoto(), polar(5.6, pa, H(1.7)).addScaledVector(pn, 0.13), pn, 0.6, 0.45, -0.03);
    potPlant(batch, polar(4.3, (3 * PI) / 4 - 0.25, DECK));
  }

  // ---------------------------------------------------------------- the cockpit (-z)
  const cA = ROOM.cockpit;
  batch.add('panel', sector({ r0: 7.35, r1: 8.35, a0: cA - 0.5, a1: cA + 0.5, y0: DECK, y1: H(0.92) }));
  batch.add('dark', sector({ r0: 7.25, r1: 9.65, a0: cA - 0.52, a1: cA + 0.52, y0: H(0.62), y1: H(1.0) }));
  batch.add('cream', sector({ r0: 7.2, r1: 7.4, a0: cA - 0.52, a1: cA + 0.52, y0: H(0.92), y1: H(1.02) }));
  {
    // buttons, dials and levers on the dash
    const cols = ['btnA', 'btnB', 'btnC'];
    for (let row = 0; row < 3; row++) for (let k = 0; k < 13; k++) {
      if ((k * 5 + row * 3) % 7 === 0 || (k === 6 && row > 0)) continue;   // (the middle: the projector)
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
    // a little figure on the dash (the mother's), and the father's old flight cap
    const fig = polar(7.5, cA + 0.42, H(1.02));
    batch.add('cushion', cyl(0.06, 0.04, 0.16, fig.x, fig.y, fig.z, 8));
    batch.add('pillow', new THREE.SphereGeometry(0.05, 8, 6).translate(fig.x, fig.y + 0.2, fig.z));
    const cap = polar(7.55, cA - 0.44, H(1.02));
    batch.add('blanket', new THREE.SphereGeometry(0.16, 12, 6, 0, PI * 2, 0, PI / 2).translate(cap.x, cap.y, cap.z));
    batch.add('blanket', box(0.18, 0.02, 0.14).rotateY(cA - 0.44).translate(...polar(7.35, cA - 0.44, H(1.02)).toArray()));
  }
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
  }
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
  // the star chart on the side wall
  {
    const a = (5 * PI) / 4 - 0.002, n = new THREE.Vector3(Math.cos(a), 0, -Math.sin(a)).negate();
    flatPicture(deco, starChart(), polar(5.9, a, H(1.75)).addScaledVector(n, 0.13), n, 0.9, 0.68, 0.02);
  }

  // ---------------------------------------------------------------- lamps
  const lampSpots = [
    ['bunk', 5.6, 0.05], ['hall', 6.2, HATCH_A], ['galley', 6.0, ROOM.galley], ['cockpit', 5.4, PI],
    ['ring1', 2.4, PI / 4], ['ring2', 2.4, (5 * PI) / 4],
  ];
  const lamps = [];
  for (const [name, r, a] of lampSpots) {
    const p = polar(r, a, CEIL - 0.55);
    batch.add('dark', cyl(0.02, 0.02, 0.4, p.x, p.y + 0.15, p.z, 4));
    batch.add('lamp', new THREE.SphereGeometry(0.2, 12, 8).translate(p.x, p.y, p.z));
    batch.add('dark', new THREE.SphereGeometry(0.3, 12, 6, 0, PI * 2, 0, PI / 2.2).translate(p.x, p.y + 0.1, p.z));
    lamps.push({ name, p, r: name.startsWith('ring') ? 10 : 15 });
  }

  // the gentle guide for the walk to the cockpit: floor chevrons along the corridor
  const guide = new THREE.Group();
  guide.userData.noCollide = true;
  const chevMat = makeMaterial({ color: '#f2c54b', glow: 1, tag: `guide-${o.tag ?? ''}` });
  const route = [];
  for (let k = 0; k <= 9; k++) route.push(polar(2.4, -0.25 - (k / 9) * (PI - 0.6), DECK));
  const chevrons = [];
  for (let i = 0; i < route.length - 1; i++) {
    const p = route[i], q = route[i + 1];
    const g = new THREE.Group();
    const arm = new THREE.BoxGeometry(0.06, 0.012, 0.36);
    g.add(new THREE.Mesh(arm.clone().rotateY(0.6).translate(0.1, 0, 0.12), chevMat), new THREE.Mesh(arm.clone().rotateY(-0.6).translate(-0.1, 0, 0.12), chevMat));
    g.position.copy(p).lerp(q, 0.5).setY(DECK + 0.02);

    g.rotation.set(0, Math.atan2(q.x - p.x, q.z - p.z), 0);
    guide.add(g);
    chevrons.push(g);
  }
  guide.visible = false;
  group.add(guide);

  return {
    deco, guide, chevrons, lamps,
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
      hatchIn: polar(8.1, HATCH_A, DECK),
      hatchHeading: HATCH_A,
      route: [polar(5.2, -0.1, DECK), polar(3.4, -0.1, DECK), ...route.slice(1), polar(3.4, PI, DECK), polar(6.4, PI, DECK)],
    },
  };
}

function meshOf(geo, color) { const m = new THREE.Mesh(geo, makeMaterial({ color })); m.userData.noCollide = true; return m; }

function potPlant(batch, p) {
  batch.add('pot', new THREE.CylinderGeometry(0.28, 0.2, 0.5, 10).translate(p.x, p.y + 0.25, p.z));
  for (let k = 0; k < 5; k++) {
    const a = k * 1.3, lean = 0.25 + (k % 2) * 0.2;
    batch.add('leaf', new THREE.ConeGeometry(0.14, 0.9, 5).translate(0, 0.45, 0).rotateZ(lean).rotateY(a).translate(p.x, p.y + 0.45, p.z));
  }
}

export { R };
