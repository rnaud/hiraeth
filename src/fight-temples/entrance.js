// A fight temple's way in, in its world (issue #384, the author: "The fight temple entrances should have a small
// building as an entrance that looks fight themed and easily recognizable"): the Blade Gate, one small makers' gatehouse,
// the same sign in every world, dressed in each world's own stone, trim and glyph colour (the table's `palette`).
//
//   a crest of two crossed blades behind a round shield with a lit ring, standing over the roof: the sign, read from afar
//   two tapering pylons with a lit slit each, a heavy lintel with a lit line, the opening dark (the ink) between them
//   a banner on each pylon with the crossed blades on it, in the world's glyph colour
//   a small chamber behind, roofed in two slabs; in front an eight-sided dais with a lit ring and a lit cross in it (the arena)
//
// Ancient high tech as the makers' temples are (panelled stone with glyphs, lit inlays, clean cuts), never organic.
// Six meshes (stone, trim, blade, banner, ink, glow: the parts of each merged), one collider; the opening's light is the ways'
// own (src/door-light.js), fitted to the opening by `userData.door` (kit/marker.js hangs it through the Thresholds).
// Front is +z; the origin on the ground at the marker's point.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeMaterial, MODE_STRATA } from '../materials.js';

/** The Blade Gate's measures (m). The opening: `w` by `h` from the sill (`sill` over the ground), its face at `face` z. */
export const ENTRANCE = {
  w: 2.4, h: 3.05, sill: 0.3,
  face: 0.62,          // the pylons' and lintel's front (the opening's light hangs here)
  inkZ: -0.3,          // the dark in the opening, this far back (the frame's depth: face - inkZ)
  dais: { z: 2.0, r: 1.85, top: 0.15 },   // the arena before it (circumradius, its flat side to the door)
  back: -3.0,          // the chamber's back wall
  crest: { y: 5.85, angle: 0.62, below: 2.0, above: 2.7, shield: 0.66 },
};

/** Geometry in the gate's frame: placed (x, y, z), turned (rx, ry, rz), non-indexed, normals and uvs kept. */
function put(geo, [x, y, z] = [0, 0, 0], [rx, ry, rz] = [0, 0, 0]) {
  const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ')), new THREE.Vector3(1, 1, 1));
  const g = (geo.index ? geo.toNonIndexed() : geo).applyMatrix4(m);
  for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
  g.clearGroups();
  return g;
}

/** A blade from its hilt's end up (y), `len` of blade: a pommel, grip, guard, a straight blade to a point, a lit fuller. */
function sword(P, len, at, rz) {
  const T = (geo, p) => P.turn(geo, p, at, rz);
  const s = new THREE.Shape();
  const w = 0.21, tip = 0.62;
  s.moveTo(-w, 0); s.lineTo(w, 0); s.lineTo(w, len - tip); s.lineTo(0, len); s.lineTo(-w, len - tip); s.closePath();
  const blade = new THREE.ExtrudeGeometry(s, { depth: 0.12, bevelEnabled: false }).translate(0, 0, -0.06);
  P.blade.push(T(blade, [0, 0.95, 0]));
  P.banner.push(T(new THREE.BoxGeometry(1.45, 0.22, 0.24), [0, 0.92, 0]));                       // the guard, in the world's colour
  P.trim.push(T(new THREE.CylinderGeometry(0.09, 0.1, 0.72, 6), [0, 0.5, 0]));                    // the grip
  P.trim.push(T(new THREE.OctahedronGeometry(0.17), [0, 0.1, 0]));                                // the pommel
  P.glow.push(T(new THREE.BoxGeometry(0.06, len - tip - 0.25, 0.14), [0, 0.95 + (len - tip) / 2 + 0.05, 0]));   // its fuller, lit through
}

/** The parts of the Blade Gate, by surface: { stone, trim, blade, ink, glow } lists of geometries in its frame. */
export function entranceParts(E = ENTRANCE) {
  const P = { stone: [], trim: [], blade: [], banner: [], ink: [], glow: [] };
  // (a part turned about z round a point: the crest's blades)
  P.turn = (geo, [x, y, z], at, rz) => {
    const g = put(geo, [x, y, z]);
    return g.applyMatrix4(new THREE.Matrix4().makeRotationZ(rz)).translate(...at);
  };
  const { w, h, sill, face, inkZ, back } = E, top = sill + h;
  const half = w / 2;
  // the footing: the building's floor, sunk deep enough for a slope
  P.stone.push(put(new THREE.BoxGeometry(5.0, 1.3, face - back + 0.1), [0, sill - 0.65, (face + back) / 2 - 0.05]));
  // the dais before it, eight-sided, a step lower; its lit ring and a lit cross on it, sunk half in
  const D = E.dais;
  P.stone.push(put(new THREE.CylinderGeometry(D.r, D.r + 0.06, D.top + 1.0, 8), [0, (D.top - 1.0) / 2, D.z], [0, Math.PI / 8, 0]));
  P.glow.push(put(new THREE.TorusGeometry(D.r * 0.78, 0.06, 4, 32).scale(1, 1, 0.5), [0, D.top, D.z], [Math.PI / 2, 0, 0]));
  for (const s of [-1, 1]) P.glow.push(put(new THREE.BoxGeometry(D.r * 1.1, 0.04, 0.09), [0, D.top, D.z], [0, s * Math.PI / 4, 0]));
  // the pylons: tapering, square, a lit slit up each front, a pointed cap
  const pyl = 0.55, pylTop = 0.45, pylH = 4.3, px = half + pyl;
  const tilt = Math.atan2(pyl - pylTop, pylH);
  for (const sx of [-1, 1]) {
    const cx = sx * (half + pyl), cz = face - pyl;
    P.stone.push(put(new THREE.CylinderGeometry(pylTop * Math.SQRT2, pyl * Math.SQRT2, pylH, 4), [cx, sill + pylH / 2, cz], [0, Math.PI / 4, 0]));
    P.trim.push(put(new THREE.ConeGeometry(pylTop * Math.SQRT2 + 0.06, 0.6, 4), [cx, sill + pylH + 0.3, cz], [0, Math.PI / 4, 0]));
    P.trim.push(put(new THREE.BoxGeometry(pyl * 2 + 0.1, 0.22, pyl * 2 + 0.1), [cx, sill + 0.09, cz]));   // its foot (sunk 2 cm: no face on the footing's)
    // the lit slit, on the face as it leans back
    const ys = sill + 0.9, ye = sill + 2.6, ym = (ys + ye) / 2, zf = cz + pyl - (ym - sill) * Math.tan(tilt);
    P.glow.push(put(new THREE.BoxGeometry(0.1, ye - ys, 0.08), [cx + sx * 0.28, ym, zf], [-tilt, 0, 0]));
    // the banner on its front, in the world's colour, a swallowtail; the crossed blades on it in ink
    const bw = 0.62, bh = 1.9, by = sill + 1.0, bz = cz + pyl - (by + bh / 2 - sill) * Math.tan(tilt) + 0.05;
    const bs = new THREE.Shape();
    bs.moveTo(-bw / 2, bh); bs.lineTo(bw / 2, bh); bs.lineTo(bw / 2, 0); bs.lineTo(0, 0.28); bs.lineTo(-bw / 2, 0); bs.closePath();
    const bx = cx - sx * 0.1;
    P.banner.push(put(new THREE.ExtrudeGeometry(bs, { depth: 0.04, bevelEnabled: false }).translate(0, 0, -0.02), [bx, by, bz], [-tilt, 0, 0]));
    P.trim.push(put(new THREE.CylinderGeometry(0.04, 0.04, bw + 0.2, 6), [bx, by + bh + 0.02, bz + 0.01], [0, 0, Math.PI / 2]));   // its rod
    for (const s of [-1, 1]) P.ink.push(put(new THREE.BoxGeometry(0.07, 0.62, 0.06), [bx, by + bh * 0.62, bz + 0.01], [-tilt, 0, s * 0.7]));
  }
  // the lintel, heavy, a little proud of the pylons, its lit line
  P.stone.push(put(new THREE.BoxGeometry(2 * px + 0.3, 0.62, 1.25), [0, top + 0.31, face - 0.57]));
  P.glow.push(put(new THREE.BoxGeometry(w * 0.9, 0.08, 0.06), [0, top + 0.31, face + 0.07]));
  P.trim.push(put(new THREE.BoxGeometry(2 * px + 0.5, 0.16, 1.4), [0, top + 0.68, face - 0.6]));   // its cap, sunk 2 cm in it
  // the chamber behind and its roof in two slabs
  const roofY = top + 0.85;
  P.stone.push(put(new THREE.BoxGeometry(2 * px - 0.4, roofY - sill, inkZ - 0.1 - back), [0, (roofY + sill) / 2, (inkZ - 0.1 + back) / 2]));
  P.trim.push(put(new THREE.BoxGeometry(2 * px, 0.3, inkZ - back + 0.3), [0, roofY + 0.13, (inkZ + back) / 2 - 0.05]));
  P.trim.push(put(new THREE.BoxGeometry(2 * px - 1.4, 0.28, inkZ - back - 0.6), [0, roofY + 0.4, (inkZ + back) / 2 - 0.05]));
  // the dark in the opening: wider and taller than the opening, its edges in the jambs and the lintel (no strip of sky)
  P.ink.push(put(new THREE.PlaneGeometry(w + 0.3, h + 0.25), [0, sill + h / 2 + 0.05, inkZ]));
  // the crest: two blades crossed behind a round shield over the lintel, the shield's lit ring and its lit heart
  const C = E.crest, cz = face - 0.45;
  P.trim.push(put(new THREE.BoxGeometry(0.6, C.y - top - 0.4, 0.4), [0, (C.y + top + 0.4) / 2 - 0.2, cz - 0.1]));   // its stem off the lintel
  for (const s of [-1, 1]) {
    // each blade's hilt end below the crossing, its point up and out (the crossing `below` along it)
    const a = s * C.angle, len = C.below + C.above - 0.95;
    const at = [Math.sin(a) * C.below, C.y - Math.cos(a) * C.below, cz + s * 0.07];
    sword(P, len, at, a);
  }
  P.trim.push(put(new THREE.CylinderGeometry(C.shield, C.shield, 0.26, 16), [0, C.y, cz + 0.3], [Math.PI / 2, 0, 0]));
  P.glow.push(put(new THREE.TorusGeometry(C.shield - 0.13, 0.055, 4, 28), [0, C.y, cz + 0.43]));
  P.ink.push(put(new THREE.CylinderGeometry(C.shield - 0.3, C.shield - 0.3, 0.08, 16), [0, C.y, cz + 0.44], [Math.PI / 2, 0, 0]));
  P.glow.push(put(new THREE.OctahedronGeometry(0.16).scale(1, 1.3, 0.5), [0, C.y, cz + 0.5]));
  delete P.turn;
  return P;
}

/** The world's materials for it (its table's palette: the walls' stone, the cap's trim, the glyph's light, the ink). */
export function entranceMaterials(P) {
  return {
    stone: makeMaterial({ color: P.wall, color2: P.wall2 ?? P.wall, color3: P.wall3 ?? P.wall, mode: MODE_STRATA, strataSize: 0.9, flat: true, grid: 1.2, glyphs: true }),
    trim: makeMaterial({ color: P.cap ?? P.wall3, flat: true }),
    blade: makeMaterial({ color: P.wall3, flat: true }),
    banner: makeMaterial({ color: P.glyph, flat: true, glow: 0.25 }),
    ink: makeMaterial({ color: P.ink, flat: true }),
    glow: makeMaterial({ color: P.glyph, flat: true, glow: 0.9 }),
  };
}

/**
 * The Blade Gate in a world's colours (def: a fight temple's table). `userData.door` is its opening for the light of a
 * way through (thresholds.js doorOf's shape, in the gate's frame); solid (kit/marker.js: a collider of its own).
 */
export function entranceModel(def) {
  const parts = entranceParts(), mats = entranceMaterials(def.palette);
  const g = new THREE.Group();
  g.name = `${def.id} entrance`;
  for (const [k, list] of Object.entries(parts)) {
    if (!list.length) continue;
    const geo = mergeGeometries(list);
    geo.computeBoundingSphere();
    const m = new THREE.Mesh(geo, mats[k]);
    m.name = k;
    if (k === 'glow' || k === 'banner') m.userData.noCollide = true;   // (the stone round them holds you)
    g.add(m);
  }
  const E = ENTRANCE;
  g.userData.door = { at: new THREE.Vector3(0, E.sill, E.face), w: E.w, h: E.h, depth: [E.face - E.inkZ, 0], side: 1, room: true };
  g.userData.lamp = null;
  g.userData.solid = true;
  g.userData.fightEntrance = true;
  return g;
}
