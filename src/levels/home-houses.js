import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeMaterial } from '../materials.js';
import { drawingMaterial } from './home-drawings.js';

// The two houses at home (src/levels/home.js), both walked into, with their
// rooms built inside the walls you see from the yard (no portals):
//
//  - the round house, the parents': the big cream dome with the round window
//    and the antenna. Dark, dusty and still: the father's chair turned to the
//    window, the mother's scarf on the stand by the door, a photo on the side
//    table, the old recorder under the mast with its spool gone (you have it),
//    dust sheets. Its door is shut until you open it.
//  - the small house across the yard, the traveller's own: a round drum with a
//    terracotta roof, where Lou lives with Aunt Tove while you travel. The lamp
//    is lit; the door stands open. A kitchen table with Lou's drawings, the
//    hearth, two beds behind a curtain, the shelf where Lou keeps a copy of
//    every keepsake you tell her about, a window seat.
//
// Both are indoors for the weather (src/shelter.js addIndoors, in home.js) and
// for the camera (CameraRig.indoor, set in home.js update).

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const nonIdx = (g) => (g.index ? g.toNonIndexed() : g);
const lerpN = (a, b, k) => a + (b - a) * k;

/**
 * A dome shell (a half sphere, squashed to `sy`) with the triangles whose centre `cut(x, y, z)`
 * says to drop taken out (a doorway). Local: centred on its base.
 */
export function domeShell(r, sy, { w = 48, h = 24, cut = null } = {}) {
  const g = nonIdx(new THREE.SphereGeometry(r, w, h, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, sy, 1));
  if (!cut) return g;
  const P = g.attributes.position.array, N = g.attributes.normal.array, keepP = [], keepN = [];
  for (let i = 0; i < P.length; i += 9) {
    // (a triangle goes if any of its corners is in the opening)
    if (cut(P[i], P[i + 1], P[i + 2]) || cut(P[i + 3], P[i + 4], P[i + 5]) || cut(P[i + 6], P[i + 7], P[i + 8])) continue;
    for (let k = 0; k < 9; k++) { keepP.push(P[i + k]); keepN.push(N[i + k]); }
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(keepP, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(keepN, 3));
  return out;
}

/** An arch outline (a rectangle with a round top) as a Shape: w wide, the straight sides `h` tall. */
function archShape(w, h, hole = null) {
  const s = new THREE.Shape();
  if (hole) {
    // a frame open at the bottom: one outline round the outside and back round the inside
    s.moveTo(-w / 2, 0); s.lineTo(-hole.w / 2, 0); s.lineTo(-hole.w / 2, hole.h); s.absarc(0, hole.h, hole.w / 2, Math.PI, 0, true);
    s.lineTo(hole.w / 2, 0); s.lineTo(w / 2, 0); s.lineTo(w / 2, h); s.absarc(0, h, w / 2, 0, Math.PI, false); s.lineTo(-w / 2, 0);
    return s;
  }
  s.moveTo(-w / 2, 0); s.lineTo(w / 2, 0); s.lineTo(w / 2, h); s.absarc(0, h, w / 2, 0, Math.PI, false); s.lineTo(-w / 2, 0);
  return s;
}

/**
 * A hinged door leaf in a frame: open(k) swings it in (0 shut .. 1 open). It is not solid
 * (the collision is built once); a shut door holds you out by itself (holds()).
 */
function doorLeaf(parent, { w, h, at, hingeSide = 1, color = '#2b211f', swing = 1.75 }) {
  const hinge = new THREE.Group();
  hinge.position.copy(at).add(V(hingeSide * w / 2, 0, 0));
  const shape = archShape(w - 0.06, h - (w - 0.06) / 2);
  const leaf = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 0.08, bevelEnabled: false, curveSegments: 14 }).translate(-hingeSide * (w / 2 - 0.03), 0, -0.04),
    makeMaterial({ color, flat: true }));
  leaf.userData.noCollide = true;
  hinge.add(leaf);
  // a round brass knob
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), makeMaterial({ color: '#d6a94a', metal: 'brass' }));
  knob.position.set(-hingeSide * (w - 0.3), 1.05, 0.08);
  knob.userData.noCollide = true;
  hinge.add(knob);
  parent.add(hinge);
  let k = 0;
  return {
    hinge, get k() { return k; },
    open(v) { k = THREE.MathUtils.clamp(v, 0, 1); hinge.rotation.y = swing * k; },   // (both ways: into the room)
  };
}

// ------------------------------------------------------------------ the round house (the parents')

/**
 * The parents' house: the dome, its doorway, the dark rooms inside.
 * @returns { door, indoor(p), spots: { chair, scarf, photo, recorder, window, inside }, lights }
 */
export function buildParentsHouse(scene, { centre, doorZ, mat }) {
  const g = new THREE.Group();
  g.name = 'the round house';
  g.position.copy(centre);
  scene.add(g);
  g.updateMatrixWorld(true);
  const R = 8.4, SY = 0.86, FLOOR = 0.9;
  const add = (geo, m, x = 0, y = 0, z = 0, parent = g) => { const mesh = new THREE.Mesh(geo, m); mesh.position.set(x, y, z); parent.add(mesh); return mesh; };
  const cream = mat('#f3ead8'), stone = mat('#dccab0', { flat: true }), terracotta = mat('#c8483a', { flat: true }), ink = mat('#2b211f');
  const DW = 1.9, DH = 2.35;   // the doorway: width, height of its straight sides (the arch adds DW / 2)
  const front = doorZ - centre.z;   // (negative: the door faces -z)
  add(new THREE.CylinderGeometry(10, 10.6, FLOOR, 40), stone, 0, FLOOR / 2, 0);
  // the dome, with a doorway cut through it
  const inDoor = (x, y, z) => z < 0 && Math.abs(x) < DW / 2 && y < DH + Math.sqrt(Math.max(0, (DW / 2) ** 2 - x * x)) + 0.05;
  const shell = domeShell(R, SY, { w: 128, h: 36, cut: inDoor });
  add(shell, cream, 0, FLOOR, 0).name = 'dome';
  // inside: the same shell, seen from within, in the dusty dark (not solid: the outside is)
  const inner = add(domeShell(R - 0.06, SY, { w: 128, h: 36, cut: inDoor }), mat('#a3937e', { side: THREE.BackSide, flat: true }), 0, FLOOR, 0);
  inner.userData.noCollide = true;
  // the painted band, broken at the doorway
  const GAP = 0.2;
  add(new THREE.TorusGeometry(R + 0.02, 0.28, 8, 64, Math.PI * 2 - GAP * 2).rotateX(Math.PI / 2).rotateY(Math.PI / 2 - GAP), mat('#5fb7ad', { flat: true }), 0, FLOOR + 0.7, 0).userData.noCollide = true;
  // the doorway: a short arched tunnel of terracotta through the shell, and the leaf in it
  const tunnel = new THREE.ExtrudeGeometry(archShape(DW + 1.0, DH, { w: DW, h: DH }), { depth: 1.9, bevelEnabled: false, curveSegments: 18 });
  add(tunnel, terracotta, 0, FLOOR, front - 0.45);
  const door = doorLeaf(g, { w: DW, h: DH + DW / 2, at: V(0, FLOOR, front + 0.35), hingeSide: 1, color: '#3b2a24', swing: 1.5 });
  door.open(0);
  // two steps up to it
  add(new THREE.BoxGeometry(3.0, 0.45, 1.1), stone, 0, 0.225, -10.3);
  // the round window: dark glass outside; inside, the dusk through it
  const az = 0.55, el = 0.42;
  const dir = V(Math.sin(az) * Math.cos(el), Math.sin(el) * SY, -Math.cos(az) * Math.cos(el));
  const at = V(dir.x * (R + 0.07), FLOOR + dir.y * (R + 0.07), dir.z * (R + 0.07));
  const win = add(new THREE.CircleGeometry(1.5, 32), mat('#4a5a8a', { flat: true }), at.x, at.y, at.z);
  win.lookAt(g.localToWorld(at.clone().add(V(dir.x, dir.y / 0.74, dir.z))));
  win.userData.noCollide = true;
  const ring = add(new THREE.TorusGeometry(1.55, 0.18, 8, 32), mat('#2b211f', { metal: 'iron' }));
  ring.position.copy(win.position); ring.quaternion.copy(win.quaternion);
  const glass = add(new THREE.CircleGeometry(1.48, 32), mat('#aeb6dc', { glow: 0.55, flat: true }), at.x * 0.968, FLOOR + (at.y - FLOOR) * 0.968, at.z * 0.968);
  glass.quaternion.copy(win.quaternion); glass.rotateY(Math.PI);
  glass.userData.noCollide = true;

  // ---------------------------------------------------------------- inside, all still
  const room = new THREE.Group();
  room.position.y = FLOOR;
  g.add(room);
  const wood = mat('#7a5440', { flat: true }), dark = mat('#5a4034', { flat: true }), sheet = mat('#e9e0cf', { flat: true }), dust = mat('#cfc3ad', { flat: true });
  const r = (geo, m, x, y, z, ry = 0) => { const o = add(geo, m, x, y, z, room); o.rotation.y = ry; return o; };
  // a rug, worn
  r(new THREE.CylinderGeometry(3.2, 3.2, 0.03, 30), mat('#a0574a', { flat: true }), 0.5, 0.015, -1).userData.noCollide = true;
  // the father's chair, turned to the round window (he stood there and heard something singing)
  const toWin = Math.atan2(dir.x, dir.z);
  const chairAt = V(dir.x * 3.4, 0, dir.z * 3.4 + 0.6);
  {
    const c = new THREE.Group();
    c.position.copy(chairAt); c.rotation.y = toWin;
    room.add(c);
    const red = mat('#8a3f36', { flat: true });
    for (const [geo, m, x, y, z] of [
      [new THREE.BoxGeometry(0.9, 0.42, 0.85), red, 0, 0.21, 0], [new THREE.BoxGeometry(0.9, 0.9, 0.2), red, 0, 0.75, -0.33],
      [new THREE.BoxGeometry(0.16, 0.62, 0.85), red, -0.47, 0.31, 0], [new THREE.BoxGeometry(0.16, 0.62, 0.85), red, 0.47, 0.31, 0],
      [new THREE.BoxGeometry(0.72, 0.12, 0.66), mat('#a14d40', { flat: true }), 0, 0.47, 0.06],
    ]) add(geo, m, x, y, z, c);
    // his cap, left on the arm
    add(new THREE.SphereGeometry(0.15, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.6, 1.1), mat('#34405e', { flat: true }), 0.47, 0.63, 0.1, c).userData.noCollide = true;
  }
  // the side table and the photo on it
  const photoAt = V(-2.6, 0, -4.6);
  r(new THREE.CylinderGeometry(0.4, 0.4, 0.05, 16), wood, photoAt.x, 0.7, photoAt.z);
  r(new THREE.CylinderGeometry(0.06, 0.12, 0.7, 8), wood, photoAt.x, 0.35, photoAt.z);
  const photo = new THREE.Group();
  photo.position.set(photoAt.x, 0.73, photoAt.z); photo.rotation.y = 0.5;
  room.add(photo);
  add(new THREE.BoxGeometry(0.34, 0.27, 0.025).translate(0, 0.14, 0).rotateX(-0.25), mat('#c9a35a', { metal: 'brass' }), 0, 0, 0, photo).userData.noCollide = true;
  add(new THREE.PlaneGeometry(0.28, 0.21).translate(0, 0.14, 0.014).rotateX(-0.25), drawingMaterial('photo'), 0, 0, 0, photo).userData.noCollide = true;
  // the coat stand by the door: the mother's scarf hangs from it (a cloth: home.js)
  const standAt = V(2.1, 0, front + 2.4);
  r(new THREE.CylinderGeometry(0.035, 0.05, 1.95, 8), dark, standAt.x, 0.975, standAt.z);
  r(new THREE.CylinderGeometry(0.28, 0.32, 0.05, 12), dark, standAt.x, 0.025, standAt.z);
  for (const a of [0, 2.1, 4.2]) r(new THREE.CylinderGeometry(0.018, 0.018, 0.22, 5).rotateZ(Math.PI / 2 - 0.5).rotateY(a), dark, standAt.x + Math.cos(a) * 0.09, 1.82, standAt.z - Math.sin(a) * 0.09).userData.noCollide = true;
  const scarfTop = g.localToWorld(V(standAt.x - 0.02, FLOOR + 1.86, standAt.z - 0.12));
  // the recorder, on a desk under the mast: the antenna's old machine, its spool gone
  const deskAt = V(-1.5, 0, 4.6);
  r(new THREE.BoxGeometry(1.7, 0.08, 0.8), wood, deskAt.x, 0.78, deskAt.z, 0.1);
  for (const [dx, dz] of [[-0.75, -0.33], [0.75, -0.33], [-0.75, 0.33], [0.75, 0.33]]) r(new THREE.BoxGeometry(0.07, 0.78, 0.07), wood, deskAt.x + dx, 0.39, deskAt.z + dz, 0.1);
  r(new THREE.BoxGeometry(0.8, 0.32, 0.48), mat('#6e7d8c', { metal: 'painted' }), deskAt.x, 0.98, deskAt.z, 0.1);
  for (const dx of [-0.2, 0.2]) {
    r(new THREE.CylinderGeometry(0.025, 0.025, 0.1, 8), mat('#2b211f', { metal: 'iron' }), deskAt.x + dx, 1.19, deskAt.z, 0.1).userData.noCollide = true;   // the spindles
  }
  r(new THREE.CylinderGeometry(0.11, 0.11, 0.03, 20), mat('#34405e', { flat: true }), deskAt.x + 0.2, 1.16, deskAt.z, 0.1).userData.noCollide = true;   // the take-up reel; the other spindle is bare
  r(new THREE.CylinderGeometry(0.03, 0.03, 0.02, 10), mat('#e6503a', { glow: 0.0 }), deskAt.x - 0.3, 1.15, deskAt.z + 0.2, 0.1).userData.noCollide = true;   // the little light, out
  // the cable up into the mast
  r(new THREE.CylinderGeometry(0.03, 0.03, 5.5, 5), ink, deskAt.x - 0.1, 3.9, deskAt.z - 0.3).userData.noCollide = true;
  // dust sheets: over the sofa, the table and the bed, all the shapes gone soft
  const draped = (w, h, d, x, z, ry) => {
    const geo = new THREE.BoxGeometry(w, h, d, 6, 3, 6);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const X = p.getX(i), Y = p.getY(i), Z = p.getZ(i);
      const sag = Y > h / 2 - 0.01 ? -0.04 * Math.sin(X * 7 + Z * 5) : 0;
      const flare = Y < -h / 2 + 0.01 ? 1.08 : 1;
      p.setXYZ(i, X * flare + Math.sin(Z * 9 + Y * 4) * 0.015, Y + sag, Z * flare);
    }
    geo.computeVertexNormals();
    return r(geo.translate(0, h / 2, 0), sheet, x, 0, z, ry);
  };
  draped(2.2, 0.85, 0.95, -4.2, 1.2, 1.2);    // the sofa
  draped(1.4, 0.8, 0.9, 3.4, 3.3, -0.4);      // the dining table
  draped(1.9, 0.6, 2.2, 1.2, 6.0, 0.15);      // the bed, at the back
  r(new THREE.BoxGeometry(0.5, 0.5, 0.5), dust, 3.0, 0.25, 4.6, 0.3);   // a box, never unpacked
  // a ring of dust round where something stood on the floor
  r(new THREE.RingGeometry(0.2, 0.32, 16).rotateX(-Math.PI / 2), dust, 0.9, 0.035, -2.4).userData.noCollide = true;
  // under the round window, her lamp on its little table: the glass dark, the wick black
  const lampAt = V(dir.x * 6.6, 0, dir.z * 6.6);
  r(new THREE.CylinderGeometry(0.45, 0.45, 0.05, 16), wood, lampAt.x, 0.82, lampAt.z);
  r(new THREE.CylinderGeometry(0.07, 0.16, 0.82, 8), wood, lampAt.x, 0.41, lampAt.z);
  r(new THREE.CylinderGeometry(0.1, 0.13, 0.12, 12), mat('#c9a35a', { metal: 'brass' }), lampAt.x, 0.91, lampAt.z).userData.noCollide = true;
  r(new THREE.SphereGeometry(0.15, 14, 10).scale(1, 1.3, 1), mat('#5a5f6e', { metal: 'chrome' }), lampAt.x, 1.13, lampAt.z).userData.noCollide = true;
  // the dresser at the back: plates and jars, dust on everything
  {
    const at = V(-5.6, 0, 3.4), ry = Math.atan2(-at.x, -at.z);
    r(new THREE.BoxGeometry(1.8, 0.95, 0.55), dark, at.x, 0.475, at.z, ry);
    r(new THREE.BoxGeometry(1.8, 1.0, 0.18), dark, at.x - Math.sin(ry) * 0.2, 1.45, at.z - Math.cos(ry) * 0.2, ry);
    const side = V(Math.cos(ry), 0, -Math.sin(ry));
    for (let k = 0; k < 5; k++) {
      const p = at.clone().addScaledVector(side, -0.68 + k * 0.34);
      if (k % 2) r(new THREE.CylinderGeometry(0.09, 0.1, 0.24, 10), mat(['#5fb7ad', '#c8673f', '#efe2c4'][k % 3], { flat: true }), p.x, 1.07, p.z).userData.noCollide = true;
      else r(new THREE.CylinderGeometry(0.17, 0.17, 0.025, 16).rotateX(Math.PI / 2 - 0.25), mat('#efe2c4', { flat: true }), p.x - Math.sin(ry) * 0.18, 1.6, p.z - Math.cos(ry) * 0.18, ry).userData.noCollide = true;
    }
  }
  // dust in the light: slow specks hanging in the air (they drift: dust.update)
  const SPECKS = 46;
  const specks = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.012, 0), mat('#fff3d0', { glow: 0.9 }), SPECKS);
  specks.userData.noCollide = true;
  specks.frustumCulled = false;
  room.add(specks);
  const seeds = Array.from({ length: SPECKS }, (_, i) => [((i * 0.618) % 1) * 2 - 1, ((i * 0.381) % 1), ((i * 0.737) % 1) * 2 - 1, i * 1.7]);
  const _sm = new THREE.Matrix4();
  const dustUpdate = (t) => {
    for (let i = 0; i < SPECKS; i++) {
      const [a, b, c, s] = seeds[i];
      // in the shaft from the round window down to the chair
      const k = b, x = lerpN(dir.x * 6.2, chairAt.x, k) + a * 0.9 + Math.sin(t * 0.13 + s) * 0.25, y = lerpN(3.4, 1.0, k) + Math.sin(t * 0.09 + s * 2) * 0.3, z = lerpN(dir.z * 6.2, chairAt.z, k) + c * 0.9 + Math.cos(t * 0.11 + s) * 0.25;
      specks.setMatrixAt(i, _sm.makeTranslation(x, y, z));
    }
    specks.instanceMatrix.needsUpdate = true;
  };
  dustUpdate(0);
  // light: only the dusk through the round window and the doorway
  const L = (x, y, z, w) => { const p = g.localToWorld(V(x, y, z)); return new THREE.Vector4(p.x, p.y, p.z, w); };
  const lights = [L(dir.x * 6.5, FLOOR + 2.6, dir.z * 6.5, 7), L(0, FLOOR + 1.8, front + 2.5, 5)];
  g.updateMatrixWorld(true);

  const W = (v) => g.localToWorld(v.clone());
  const inside = (p, margin = 0) => {
    const dx = p.x - centre.x, dz = p.z - centre.z, y = p.y - centre.y - FLOOR;
    if (y < -0.6 || y > R * SY + 0.5) return false;
    const rr = R * Math.sqrt(Math.max(0, 1 - (Math.max(0, y) / (R * SY)) ** 2));
    return Math.hypot(dx, dz) < rr - 0.25 + margin;
  };
  return {
    group: g, door, floor: centre.y + FLOOR, lights, R, front, dust: dustUpdate,
    indoor: inside,
    /** Standing in the doorway's tunnel, from outside (a shut door holds you here). */
    inDoorway: (p) => { const dx = p.x - centre.x, dz = p.z - centre.z; return Math.abs(dx) < DW / 2 + 0.2 && dz > front - 0.6 && dz < front + 1.5 && p.y < centre.y + FLOOR + 3; },
    outside: W(V(0, 0, front - 2.2)),
    threshold: W(V(0, FLOOR, front - 0.4)),
    spots: {
      chair: W(chairAt.clone().setY(FLOOR)), chairHeading: toWin,
      photo: W(photoAt.clone().setY(FLOOR + 0.8)),
      scarf: W(standAt.clone().setY(FLOOR + 1.3)), scarfTop,
      recorder: W(deskAt.clone().setY(FLOOR + 1.0)),
      window: W(V(dir.x * 5.8, FLOOR, dir.z * 5.8)), windowLook: W(at),
      inside: W(V(0, FLOOR, front + 3)),
    },
  };
}

// ------------------------------------------------------------------ the small house (Lou's and Tove's, and yours)

/**
 * The traveller's own small house: a round drum, its roof a terracotta dome, its windows lit.
 * @param o.centre (on the ground) · o.heading (the way its door faces)
 * @returns { group, door, indoor(p), floor, lights, spots, shelf: { add(mesh, i) }, wall: { add(mesh, i) } }
 */
export function buildFamilyHouse(scene, { centre, heading, mat }) {
  const g = new THREE.Group();
  g.name = 'the small house';
  g.position.copy(centre);
  g.rotation.y = heading;   // local +z: out of the door
  scene.add(g);
  const R = 4.8, T = 0.32, WALL = 3.0, FLOOR = 0.34, DOOR = 0.2;   // DOOR: the doorway's half-angle (rad)
  const add = (geo, m, x = 0, y = 0, z = 0, parent = g) => { const mesh = new THREE.Mesh(geo, m); mesh.position.set(x, y, z); parent.add(mesh); return mesh; };
  const cream = mat('#f1e3c6'), stone = mat('#d8c4a4', { flat: true }), terracotta = mat('#c8573f'), teal = mat('#5fb7ad', { flat: true }), ink = mat('#2b211f');
  add(new THREE.CylinderGeometry(R + 0.5, R + 0.7, FLOOR, 36), stone, 0, FLOOR / 2, 0);
  // the wall: a ring of blocks, open at the door and the windows (windows: [angle, half-width rad])
  const WINDOWS = [[1.05, 0.13], [-1.1, 0.13], [2.35, 0.12], [-2.4, 0.12]];
  const N = 56, parts = [], inner = [];
  for (let i = 0; i < N; i++) {
    const a = ((i + 0.5) / N) * Math.PI * 2 - Math.PI;   // 0 = +z (the door)
    if (Math.abs(a) < DOOR) continue;
    const w = (2 * Math.PI * R) / N + 0.03;
    const win = WINDOWS.find(([wa, hw]) => Math.abs(Math.atan2(Math.sin(a - wa), Math.cos(a - wa))) < hw);
    const spans = win ? [[0, 1.05], [2.15, WALL]] : [[0, WALL]];
    for (const [y0, y1] of spans) {
      const geo = new THREE.BoxGeometry(w, y1 - y0, T).translate(0, (y0 + y1) / 2 + FLOOR, 0).rotateY(a).translate(Math.sin(a) * R, 0, Math.cos(a) * R);
      parts.push(geo.toNonIndexed());
      inner.push(new THREE.BoxGeometry(w, y1 - y0, 0.02).translate(0, (y0 + y1) / 2 + FLOOR, 0).rotateY(a).translate(Math.sin(a) * (R - T / 2 - 0.012), 0, Math.cos(a) * (R - T / 2 - 0.012)).toNonIndexed());
    }
  }
  add(mergeGeometries(parts), cream).name = 'walls';
  const innerWall = add(mergeGeometries(inner), mat('#f6ead2', { flat: true }));
  innerWall.userData.noCollide = true;
  // the doorway's frame and lintel, and the band round the wall
  add(new THREE.TorusGeometry(R + 0.17, 0.12, 6, 56).rotateX(Math.PI / 2), teal, 0, FLOOR + 1.0, 0).userData.noCollide = true;
  const dw = 2 * Math.sin(DOOR) * R, dh = 2.3;
  for (const s of [-1, 1]) add(new THREE.BoxGeometry(0.22, dh, T + 0.14), terracotta, s * (dw / 2 + 0.05), FLOOR + dh / 2, R * Math.cos(DOOR) - 0.02);
  add(new THREE.BoxGeometry(dw + 0.32, WALL - dh, T + 0.14), terracotta, 0, FLOOR + (dh + WALL) / 2, R * Math.cos(DOOR) - 0.02);
  // the door stands open, swung in against the wall
  const door = doorLeaf(g, { w: dw - 0.1, h: dh, at: V(0, FLOOR, R * Math.cos(DOOR) - 0.18), hingeSide: -1, color: '#5fb7ad', swing: 2.3 });
  door.open(1);
  // windows: a deep sill and a frame, warm light behind them
  for (const [a] of WINDOWS) {
    const sill = add(new THREE.BoxGeometry(1.2, 0.06, T + 0.3), terracotta, Math.sin(a) * R, FLOOR + 1.06, Math.cos(a) * R);
    sill.rotation.y = a;
    const fr = add(new THREE.TorusGeometry(0.62, 0.07, 6, 20), terracotta, Math.sin(a) * (R + 0.17), FLOOR + 1.6, Math.cos(a) * (R + 0.17));
    fr.rotation.y = a; fr.scale.set(1.05, 0.95, 1);
    fr.userData.noCollide = true;
  }
  // the roof: a low dome, terracotta outside, cream within; the chimney out of the back
  const roof = add(new THREE.SphereGeometry(R + 0.45, 40, 12, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.48, 1), terracotta, 0, FLOOR + WALL, 0);
  roof.name = 'roof';
  const ceiling = add(new THREE.SphereGeometry(R - 0.1, 40, 12, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.44, 1), mat('#efdcbc', { side: THREE.BackSide, flat: true }), 0, FLOOR + WALL - 0.02, 0);
  ceiling.userData.noCollide = true;
  add(new THREE.CylinderGeometry(R + 0.06, R + 0.06, 0.08, 40), mat('#efdcbc', { side: THREE.BackSide, flat: true }), 0, FLOOR + WALL - 0.04, 0).userData.noCollide = true;
  add(new THREE.CylinderGeometry(0.42, 0.5, 2.6, 10), stone, 0, FLOOR + WALL + 1.6, -R + 1.0);
  add(new THREE.CylinderGeometry(0.5, 0.5, 0.18, 10), terracotta, 0, FLOOR + WALL + 2.95, -R + 1.0).userData.noCollide = true;

  // ---------------------------------------------------------------- inside
  const room = new THREE.Group();
  room.position.y = FLOOR;
  g.add(room);
  const wood = mat('#9a6a48', { flat: true }), dark = mat('#6e4a36', { flat: true });
  const r = (geo, m, x, y, z, ry = 0) => { const o = add(geo, m, x, y, z, room); o.rotation.y = ry; return o; };
  r(new THREE.CylinderGeometry(R - T / 2, R - T / 2, 0.02, 36), mat('#c99a6e', { grid: 0.7, flat: true }), 0, 0.01, 0).userData.noCollide = true;
  r(new THREE.CylinderGeometry(1.6, 1.6, 0.02, 24), mat('#5f8fb8', { flat: true }), 0.9, 0.025, 0.3).userData.noCollide = true;   // a round rug
  // the hearth at the back, the fire in it
  r(new THREE.BoxGeometry(2.0, 1.25, 0.8), stone, 0, 0.62, -R + 0.62);
  r(new THREE.BoxGeometry(0.95, 0.65, 0.3), ink, 0, 0.42, -R + 0.98).userData.noCollide = true;
  r(new THREE.BoxGeometry(1.2, WALL - 1.25, 0.6), stone, 0, 1.25 + (WALL - 1.25) / 2, -R + 0.5);
  const fire = r(new THREE.ConeGeometry(0.26, 0.5, 7), mat('#f2a33a', { glow: 1 }), 0, 0.33, -R + 1.08);
  fire.userData.noCollide = true;
  const embers = r(new THREE.SphereGeometry(0.3, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.3, 0.6), mat('#e6503a', { glow: 0.9 }), 0, 0.1, -R + 1.08);
  embers.userData.noCollide = true;
  r(new THREE.CylinderGeometry(0.17, 0.2, 0.24, 10), mat('#3b3a3f', { metal: 'iron' }), 0.65, 1.37, -R + 0.75).userData.noCollide = true;   // the kettle on the mantel
  // Moustache's basket by the hearth
  r(new THREE.CylinderGeometry(0.55, 0.45, 0.22, 14, 1, true), mat('#b07a48', { side: THREE.DoubleSide, flat: true }), 1.7, 0.11, -R + 1.5).userData.noCollide = true;
  r(new THREE.CylinderGeometry(0.48, 0.48, 0.08, 14), mat('#c8483a', { flat: true }), 1.7, 0.06, -R + 1.5).userData.noCollide = true;
  // the kitchen table, three stools; Lou's drawings and crayons on it
  const tableAt = V(1.2, 0, 0.9);
  r(new THREE.BoxGeometry(1.7, 0.08, 1.0), wood, tableAt.x, 0.76, tableAt.z, 0.25);
  for (const [dx, dz] of [[-0.75, -0.42], [0.75, -0.42], [-0.75, 0.42], [0.75, 0.42]]) {
    const c = Math.cos(0.25), s = Math.sin(0.25);
    r(new THREE.BoxGeometry(0.07, 0.76, 0.07), wood, tableAt.x + dx * c + dz * s, 0.38, tableAt.z - dx * s + dz * c);
  }
  for (const [dx, dz, h] of [[-1.2, 0.3, 0.46], [0.2, 1.0, 0.46], [0.9, -0.8, 0.36]]) {
    r(new THREE.CylinderGeometry(0.2, 0.18, 0.06, 12), dark, tableAt.x + dx, h, tableAt.z + dz);
    r(new THREE.CylinderGeometry(0.04, 0.05, h, 6), dark, tableAt.x + dx, h / 2, tableAt.z + dz);
  }
  const tableTop = (i) => ({ at: V(tableAt.x - 0.45 + (i % 3) * 0.42, 0.805 + i * 0.002, tableAt.z + (Math.floor(i / 3) % 2 ? 0.22 : -0.15)), ry: 0.25 + (i % 3) * 0.4 - 0.4 });
  for (const [k, c] of ['#c8483a', '#f2c54b', '#5fb7ad', '#8a6fb8'].entries()) r(new THREE.CylinderGeometry(0.012, 0.012, 0.12, 6).rotateZ(Math.PI / 2), mat(c, { flat: true }), tableAt.x + 0.5, 0.815, tableAt.z + 0.3 + k * 0.04, 0.6 + k * 0.3).userData.noCollide = true;
  // the drawings on the wall right of the door (the newest on the table): home.js puts them up
  const wallDrawing = (i) => {
    const a = 0.32 + (i % 4) * 0.15, row = Math.floor(i / 4);
    return { at: V(Math.sin(a) * (R - T / 2 - 0.03), 1.25 + row * 0.55, Math.cos(a) * (R - T / 2 - 0.03)), ry: a + Math.PI };
  };
  // the sleeping side, behind a curtain (a cloth: home.js): two beds
  const CURTAIN_X = -1.7;
  r(new THREE.CylinderGeometry(0.03, 0.03, 8.2, 6).rotateX(Math.PI / 2), dark, CURTAIN_X, 2.35, 0).userData.noCollide = true;
  const bed = (x, z, w, l, cover) => {
    r(new THREE.BoxGeometry(w, 0.4, l), wood, x, 0.2, z);
    r(new THREE.BoxGeometry(w - 0.06, 0.12, l * 0.78), mat(cover, { flat: true }), x, 0.46, z + l * 0.1).userData.noCollide = true;
    r(new THREE.BoxGeometry(w * 0.7, 0.12, 0.34), mat('#f6ead2', { flat: true }), x, 0.47, z - l / 2 + 0.25).userData.noCollide = true;
  };
  bed(-3.05, -1.3, 0.85, 1.6, '#f2c54b');   // Lou's
  bed(-3.0, 1.55, 1.15, 2.0, '#8a6fb8');    // Tove's
  r(new THREE.BoxGeometry(0.5, 0.5, 0.45), wood, -3.3, 0.25, 0.2);   // a chest between them
  // the shelf on the far wall: a copy of every keepsake, in clay and paper, labelled in crayon
  const SHELF_A = 2.0;   // its angle round the wall
  const shelf = new THREE.Group();
  shelf.position.set(Math.sin(SHELF_A) * (R - T / 2 - 0.25), 0, Math.cos(SHELF_A) * (R - T / 2 - 0.25));
  shelf.rotation.y = SHELF_A + Math.PI;   // facing into the room
  room.add(shelf);
  for (const y of [0.45, 1.0, 1.55, 2.1]) add(new THREE.BoxGeometry(1.9, 0.05, 0.36), wood, 0, y, 0, shelf);
  for (const x of [-0.95, 0.95]) add(new THREE.BoxGeometry(0.05, 2.2, 0.36), wood, x, 1.1, 0, shelf);
  const shelfSlot = (i) => V(-0.75 + (i % 6) * 0.3, 0.5 + Math.floor(i / 6) * 0.55, 0.02);
  // the window seat, in the window right of the door (looking out at the ring)
  const SEAT_A = WINDOWS[0][0];
  const seatAt = V(Math.sin(SEAT_A) * (R - 0.62), 0, Math.cos(SEAT_A) * (R - 0.62));
  const seat = new THREE.Group();
  seat.position.copy(seatAt); seat.rotation.y = SEAT_A;
  room.add(seat);
  add(new THREE.BoxGeometry(1.5, 0.42, 0.62), wood, 0, 0.21, 0, seat);
  add(new THREE.BoxGeometry(1.4, 0.1, 0.56), mat('#c8483a', { flat: true }), 0, 0.47, 0, seat).userData.noCollide = true;
  for (const s of [-1, 1]) add(new THREE.SphereGeometry(0.2, 10, 6).scale(1, 0.6, 0.5), mat(s > 0 ? '#f2c54b' : '#5fb7ad', { flat: true }), s * 0.5, 0.6, 0.18, seat).userData.noCollide = true;
  // the lamp, lit
  r(new THREE.CylinderGeometry(0.01, 0.01, 1.2, 4), ink, 0.3, WALL + 0.3, 0.3).userData.noCollide = true;
  const lamp = r(new THREE.SphereGeometry(0.24, 12, 8), mat('#ffe2a0', { glow: 1 }), 0.3, WALL - 0.35, 0.3);
  lamp.userData.noCollide = true;
  g.updateMatrixWorld(true);
  const L = (x, y, z, w) => { const p = room.localToWorld(V(x, y, z)); return new THREE.Vector4(p.x, p.y, p.z, w); };
  const lights = [L(0.3, WALL - 0.6, 0.3, 9), L(0, 0.6, -R + 1.4, 6), L(Math.sin(SEAT_A) * (R + 1.2), 1.6, Math.cos(SEAT_A) * (R + 1.2), 5)];
  const W = (v) => room.localToWorld(v.clone());
  const inv = new THREE.Matrix4().copy(g.matrixWorld).invert();
  const _l = new THREE.Vector3();
  const local = (p) => _l.copy(p).applyMatrix4(inv);
  return {
    group: g, room, door, floor: centre.y + FLOOR, lights, R, fire, embers,
    indoor: (p, margin = 0) => { const q = local(p); return q.y > -0.4 && q.y < FLOOR + WALL + 2 && Math.hypot(q.x, q.z) < R - T / 2 - 0.15 + margin; },
    /** Behind the curtain, on the beds' side (the curtain: home.js). */
    curtain: { a: W(V(CURTAIN_X, 2.33, -4.05)), b: W(V(CURTAIN_X, 2.33, 4.05)), floor: centre.y + FLOOR },
    doorOut: room.localToWorld(V(0, 0, R + 1.8)),
    threshold: room.localToWorld(V(0, 0, R - 0.2)),
    spots: {
      inside: W(V(0, 0, R - 1.8)), table: W(tableAt.clone().setY(0.8)), hearth: W(V(0, 0.6, -R + 1.6)), basket: W(V(1.7, 0, -R + 1.5)),
      seat: W(seatAt), seatHeading: heading + SEAT_A + Math.PI, window: W(V(Math.sin(SEAT_A) * (R + 4), 1.4, Math.cos(SEAT_A) * (R + 4))),
      shelf: room.localToWorld(shelf.position.clone().add(V(0, 1.2, 0))), drawings: W(wallDrawing(1).at), beds: W(V(-3, 0, 0.2)),
    },
    /** Put a mesh on the shelf, slot i (a copy of keepsake i). */
    shelfAdd(mesh, i) { mesh.position.copy(shelfSlot(i)); mesh.rotation.y = ((i * 1.3) % 0.8) - 0.4; shelf.add(mesh); return mesh; },
    /** Pin drawing i on the wall (i < 8), or lay it on the table. */
    wallAdd(mesh, i) {
      if (i < 8) { const d = wallDrawing(i); mesh.position.copy(d.at); mesh.rotation.set(0, d.ry, ((i * 0.37) % 0.2) - 0.1); }
      else { const t = tableTop(i - 8); mesh.position.copy(t.at); mesh.rotation.set(-Math.PI / 2, 0, t.ry); }
      room.add(mesh);
      return mesh;
    },
  };
}
