import * as THREE from 'three';
import { MODE_STRATA } from './materials.js';
import { crystalGeometry } from './chimes.js';
import { buckets, archWall, archShape, archSheet, archFrame, flask, vial, bell, feather, gear, bulb, cord, block, stick, cloth, lathe, heartGeo } from './shop-kit.js';

// Every route world's shopfront (docs/systems/interiors.md, "A shop in every world"), each built to the author's
// picked reference (references/shops/<world>/sheet-*.jpg, the prompts in docs/design/shop-prompts.md): the
// desert's is the interior kit's plastered house (src/interior-kit.js buildShopfront); the others are here, one
// builder each, in their world's own architecture and colours, with a picture for a sign (no lettering: each
// world writes its own way) and a few wares in view.
//
// Every front has the same frame as buildShopfront's: the threshold at the origin on the ground, +z out of the
// door, the body behind it (into -z) sunk into the ground, solid (you can climb it). Its door is an opening
// about 2.3–2.5 m high and 1.3–1.5 m wide with the lit inside showing through it (a self-lit sheet) and a solid
// back behind that: a step into it is the way in (src/interiors.js portalPair). Each returns the same object as
// buildShopfront: { group, door, heading, lights, local, size }.
//
//   buildStyledFront(scene, { at, heading, style: 'hoodoo' })      (src/shop-world.js placeShop calls it)

const INK = '#2b211f', RED = '#d9503f', CORK = '#b07a45', TEAL = '#70e7df', BRASS = '#d6a13e', LIT = '#ffd9a0';
const strata = (color2, size = 1.6) => ({ mode: MODE_STRATA, color2, color3: '#f6e6d6', strataSize: size, weathered: true });

/** A few wares on a shelf at height y: flasks, a heart (on what holds it) and a magic cell, along x from x0. */
function wares(B, x0, y, z, { flasks = 2, heart = 'cushion', step = 0.3, holder = '#8a6fb8' } = {}) {
  let x = x0;
  for (let i = 0; i < flasks; i++, x += step * 0.8) { const f = flask(x, y, z); B.add(RED, f.glass, { soft: true }); B.add(CORK, f.cork, { soft: true }); }
  x += step * 0.3;
  if (heart) {
    B.add(RED, heartGeo(0.22).translate(x, y + 0.22, z), { soft: true });
    if (heart === 'cushion') B.add(holder, block(0.26, 0.07, 0.22, x, y, z), { soft: true });
    if (heart === 'box') { B.add(holder, block(0.34, 0.1, 0.26, x, y, z), { soft: true }); B.add(holder, block(0.34, 0.24, 0.03, x, y, z - 0.13), { soft: true }); }
    if (heart === 'jar') {   // (a bell jar drawn as its brass frame: the heart shows through)
      B.add(holder, new THREE.CylinderGeometry(0.15, 0.16, 0.04, 12).translate(x, y + 0.02, z), { soft: true });
      for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + 0.6; B.add(BRASS, stick([x + Math.cos(a) * 0.13, y + 0.04, z + Math.sin(a) * 0.13], [x + Math.cos(a) * 0.1, y + 0.44, z + Math.sin(a) * 0.1], 0.008), { soft: true }); }
      B.add(BRASS, new THREE.TorusGeometry(0.1, 0.012, 4, 14).rotateX(Math.PI / 2).translate(x, y + 0.44, z), { soft: true });
      B.add(BRASS, new THREE.SphereGeometry(0.03, 6, 4).translate(x, y + 0.5, z), { soft: true });
    }
    if (heart === 'basket') { B.add(holder, lathe([[0.1, 0], [0.15, 0.04], [0.16, 0.16]], 10).translate(x, y, z), { soft: true }); B.add(holder, lathe([[0.17, 0], [0.12, 0.05], [0.01, 0.07]], 10).translate(x + 0.05, y + 0.36, z), { soft: true }); }
    x += step;
  }
  const v = vial(x, y, z); B.add(TEAL, v.glow, { soft: true, glow: 0.7 }); B.add(BRASS, v.brass, { soft: true });
}

/** Stripes of an awning: `n` slats from the wall at height y0 (z z0) out and down to y1 at z1, `w` wide at x. */
function stripes(B, colors, { x = 0, w = 3, y0 = 2.9, z0 = 0.05, y1 = 2.45, z1 = 1.5, n = 9, hem = 0.18 }) {
  const ang = Math.atan2(y0 - y1, z1 - z0), L = Math.hypot(y0 - y1, z1 - z0);
  for (let i = 0; i < n; i++) {
    const g = new THREE.BoxGeometry(w / n, 0.04, L).rotateX(ang).translate(x - w / 2 + (i + 0.5) * (w / n), (y0 + y1) / 2, (z0 + z1) / 2);
    B.add(colors[i % 2], g, { soft: true });
    B.add(colors[i % 2], new THREE.BoxGeometry((w / n) * 0.9, hem, 0.03).translate(x - w / 2 + (i + 0.5) * (w / n), y1 - hem / 2, z1), { soft: true });
  }
}

/** A point on a dome (centre c, radius r, squashed `sy` in height) seen at (x, y): { p, n } (its outward normal). */
function onDome(c, r, x, y, sy = 1) {
  const dy = (y - c[1]) / sy, rr = Math.sqrt(Math.max(0, r * r - dy * dy - x * x));
  const p = new THREE.Vector3(x, y, c[2] + rr), n = new THREE.Vector3(x, dy, rr).normalize();
  return { p, n };
}
/** Turn a piece built facing +z to face `n`, and put it at p. */
function facing(g, p, n) {
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), n));
  return g.translate(p.x, p.y, p.z);
}
/** The lit inside through a door or window (a self-lit sheet just inside the opening). */
function lit(B, w, h, x, y, z, o = {}) { B.add(o.color ?? LIT, archSheet(w, h, o).translate(x, y, z), { soft: true, glow: 0.85 }); }

// ------------------------------------------------------------------ the fronts

export const FRONTS = {
  /**
   * Vael, the Wind-Shelf: a shelter carved into the foot of a bone-white hoodoo with a mushroom cap and an ochre
   * band, its round-arched door in a carved face, an ochre cloth on a pole for an awning, wares hung on cords from
   * the cap, and for a sign a cord with a white feather and a small crystal.
   */
  hoodoo(B) {
    const bone = '#eee4d6', ochre = '#dc9f52', peach = '#e9a57f', cz = -3.7;
    B.add(bone, lathe([[3.1, -3.5], [2.9, 0.3], [2.65, 1.8], [2.2, 3.2], [1.85, 4.2], [1.8, 4.5], [0.01, 4.5]], 22).translate(0, 0, cz), strata('#e2cdb6', 1.1));
    B.add(bone, lathe([[0.01, 4.25], [1.9, 4.25], [4.2, 4.5], [4.75, 4.85], [4.65, 5.2], [3.9, 5.65], [2.3, 5.95], [0.01, 6.05]], 26).translate(0, 0, cz), strata('#e6d4bf', 0.9));
    B.add(ochre, new THREE.CylinderGeometry(4.73, 4.7, 0.16, 30, 1, true).translate(0, 5.0, cz), { soft: true, side: THREE.DoubleSide });
    // the carved face with its door (an arch), solid behind
    B.add(bone, archWall(3.4, 3.7, 0.7, { arch: true, door: { w: 1.5, h: 2.5, arch: true } }), strata('#e2cdb6', 1.1));
    B.add(bone, new THREE.ExtrudeGeometry(archShape(3.4, 3.7), { depth: 1.7, bevelEnabled: false }).translate(0, 0, -2.4));
    B.add(bone, block(3.6, 1.6, 2.6, 0, -1.6, -1.2));
    lit(B, 1.5, 2.5, 0, 0, -0.68, { color: '#f4cfa4' });
    for (const g of archFrame(1.5, 2.5, { t: 0.08, d: 0.04 })) B.add(ochre, g, { soft: true });
    // a stone shelf beside the door with the sand tray (prices are drawn in it)
    B.add(bone, block(1.0, 0.14, 0.62, -1.95, 0.86, 0.1)); B.add(bone, block(0.7, 0.86, 0.4, -1.95, 0, 0.0));
    B.add('#d8b48a', new THREE.CylinderGeometry(0.24, 0.26, 0.04, 16).translate(-1.95, 1.02, 0.12), { soft: true });
    for (const k of [-1, 0, 1]) B.add(INK, new THREE.BoxGeometry(0.12, 0.01, 0.015).translate(-1.95 + k * 0.03, 1.045, 0.08 + k * 0.05), { soft: true });
    // the awning: ochre cloth from a leaning pole to the cap, a guy rope
    B.add('#cdb89a', stick([-3.6, -0.3, 2.7], [-3.4, 3.0, 2.5], 0.05));
    B.add(INK, stick([-3.4, 3.0, 2.5], [-4.4, 0, 3.4], 0.01), { soft: true });
    B.add(ochre, cloth([-3.45, 2.3, 2.55], [-3.4, 3.0, 2.5], [0.3, 4.3, 0.95], [-2.3, 4.35, -0.5]), { soft: true });
    // wares hung on cords from the cap, turning in the wind
    for (const [x, y, z, what] of [[1.0, 2.8, 0.35, 'flask'], [1.55, 2.55, 0.25, 'heart'], [2.1, 2.9, 0.1, 'vial'], [0.7, 3.1, 0.6, 'flask']]) {
      B.add(INK, cord(x, 4.4, y + 0.3, z), { soft: true });
      if (what === 'flask') { const f = flask(x, y, z); B.add(RED, f.glass, { soft: true }); B.add(CORK, f.cork, { soft: true }); }
      if (what === 'heart') { B.add(RED, heartGeo(0.24).translate(x, y + 0.15, z), { soft: true }); for (const a of [-0.1, 0, 0.1]) B.add(INK, stick([x + a, y + 0.3, z], [x + a * 1.6, y + 0.02, z], 0.006), { soft: true }); }
      if (what === 'vial') { const v = vial(x, y, z); B.add(TEAL, v.glow, { soft: true, glow: 0.7 }); B.add(BRASS, v.brass, { soft: true }); }
    }
    // the sign: one long cord from the cap, a small crystal and a white feather turning on it
    B.add(INK, cord(2.75, 4.45, 2.6, 0.25), { soft: true });
    B.add(null, crystalGeometry(0.22, 11).translate(2.75, 2.95, 0.25));
    B.add('#fbf7ee', feather(2.75, 2.75, 0.25, 0.7, 0.4), { soft: true, side: THREE.DoubleSide });
    // a few boulders at its foot
    for (const [x, z, s] of [[3.2, 0.6, 0.6], [-3.0, -1.0, 0.8], [2.6, -2.4, 0.9]]) B.add(bone, new THREE.DodecahedronGeometry(s, 0).scale(1.4, 0.45, 1).translate(x, s * 0.15, z));
    return { lights: [[0, 2.2, 0.8, 6]], size: { w: 9, d: 8, h: 6 } };
  },

  /**
   * Vael II, the Almonry: a hatch in the monastery's gatehouse, rose stone with two round towers under conical
   * slate roofs; an arched door beside the hatch, its counter-board let down under a slate canopy, and over it a
   * carved beam hung with seven bronze bells, the shop's only sign.
   */
  almonry(B) {
    const rose = '#e4a99f', rose2 = '#d4958c', slate = '#7d7e9e', wood = '#9a6a46', bronze = '#c4903e';
    const W = 7, H = 5.4;
    B.add(rose, archWall(W, H, 0.7, { door: { w: 1.5, h: 2.5, x: -1.6, arch: true }, windows: [{ w: 1.8, h: 1.5, x: 1.5, y: 1.05, arch: true }] }), { ...strata(rose2, 1.0), grid: 0.75 });
    B.add(rose, block(W, H + 1.6, 3.6, 0, -1.6, -2.5), { ...strata(rose2, 1.0), grid: 0.75 });
    B.add(rose2, block(W + 0.3, 0.35, 4.0, 0, H, -2.3));
    for (let i = 0; i < 7; i++) B.add(rose2, block(0.5, 0.45, 0.4, -W / 2 + 0.4 + i * 1.03, H + 0.35, 0.0));
    lit(B, 1.5, 2.5, -1.6, 0, -0.68);
    lit(B, 1.8, 1.5, 1.5, 1.05, -0.68, { color: '#f2c78e' });
    for (const g of archFrame(1.5, 2.5, { t: 0.18, d: 0.12 })) B.add(rose2, g.translate(-1.6, 0, 0));
    // the counter-board on its brackets, the slate canopy, the bell beam with its seven bells
    B.add(wood, block(2.2, 0.09, 0.62, 1.5, 0.98, 0.24));
    for (const s of [-1, 1]) B.add(INK, stick([1.5 + s * 0.85, 0.55, 0.02], [1.5 + s * 0.85, 0.98, 0.5], 0.025), { soft: true });
    B.add(slate, new THREE.BoxGeometry(2.6, 0.08, 1.25).rotateX(0.5).translate(1.5, 3.05, 0.42), { soft: true });
    B.add(wood, block(2.8, 0.13, 0.16, 1.5, 2.62, 0.22), { soft: true });
    for (let i = 0; i < 7; i++) { const x = 0.35 + i * 0.38, r = 0.075 + (i % 3) * 0.018; B.add(INK, cord(x, 2.62, 2.5, 0.24), { soft: true }); B.add(bronze, bell(x, 2.52, 0.24, r), { soft: true }); }
    wares(B, 0.75, 1.07, 0.3, { flasks: 3, heart: 'box', holder: '#a8754e', step: 0.32 });
    // the round towers either side with their slate cones and slit windows
    for (const s of [-1, 1]) {
      B.add(rose, new THREE.CylinderGeometry(1.15, 1.2, 8.4, 18).translate(s * 3.75, 2.6, -1.5), { ...strata(rose2, 1.0), grid: 0.75 });
      B.add(slate, new THREE.ConeGeometry(1.5, 2.2, 18).translate(s * 3.75, 7.9, -1.5));
      B.add(INK, block(0.14, 0.6, 0.1, s * 3.75, 4.3, -0.33), { soft: true });
    }
    return { door: -1.6, lights: [[-1.6, 2.3, 0.7, 6], [1.5, 2.2, 0.9, 5]], size: { w: 10, d: 5, h: 8 } };
  },

  /**
   * Lorn, Nettle's Float: a raft-house of grey weathered planks and bound reed bundles on a deck of floats,
   * a steep thatch, a landing stage with its mooring post, a violet crystal lantern under the eave, the Hush
   * painted over the door (three drops over a closed mouth) and for a sign a cord of knots hung with crystals
   * and a carved flask.
   */
  raft(B) {
    const grey = '#9b968b', grey2 = '#8b867b', reed = '#bba468', thatch = '#b39a5d', plank = '#8f8473';
    B.add(plank, block(7.2, 0.45, 6.6, 0, -0.45, -2.7), { grid: 0.35 });
    for (const z of [-5.6, -2.7, 0.2]) B.add(reed, new THREE.CylinderGeometry(0.32, 0.32, 7.4, 10).rotateZ(Math.PI / 2).translate(0, -0.6, z));
    B.add(plank, block(2.4, 0.3, 1.8, 0.4, -0.3, 1.45), { grid: 0.35 });
    B.add('#6e5a44', stick([1.45, -1.2, 2.2], [1.45, 1.05, 2.2], 0.09));
    // the house: a front of planks with its door and a round window, reed bundles at the corners, the body behind
    B.add(grey, archWall(5.4, 2.9, 0.25, { door: { w: 1.4, h: 2.3, x: -0.7 }, windows: [{ w: 0.85, x: 1.4, y: 1.0, round: true }] }), { grid: 0.3 });
    B.add(grey2, block(5.4, 2.9, 3.9, 0, 0, -2.2), { grid: 0.3 });
    lit(B, 1.4, 2.3, -0.7, 0, -0.23, { arch: false, color: '#e7c98e' });
    lit(B, 0.85, 0.85, 1.4, 1.425, -0.23, { round: true, color: '#c9a6ff' });
    for (const [x, z] of [[-2.75, 0.05], [2.75, 0.05], [-2.75, -4.1], [2.75, -4.1]]) B.add(reed, new THREE.CylinderGeometry(0.2, 0.22, 3.0, 8).translate(x, 1.5, z));
    // the steep thatch, its eave out over the door
    const roof = new THREE.Shape(); roof.moveTo(-3.3, 0); roof.lineTo(3.3, 0); roof.lineTo(0, 2.7); roof.lineTo(-3.3, 0);
    B.add(thatch, new THREE.ExtrudeGeometry(roof, { depth: 5.2, bevelEnabled: false }).translate(0, 2.85, -4.55), { grid: 0.25 });
    // the violet crystal lantern from the eave, the Hush over the door
    B.add(INK, cord(-2.1, 2.9, 2.45, 0.5), { soft: true });
    B.add('#b48cff', lathe([[0.01, 0], [0.11, 0.08], [0.13, 0.22], [0.06, 0.34], [0.01, 0.36]], 7).translate(-2.1, 2.1, 0.5), { soft: true, glow: 1 });
    for (const k of [-1, 0, 1]) B.add('#3e7f86', new THREE.SphereGeometry(0.06, 8, 6).scale(0.8, 1.2, 0.4).translate(-0.7 + k * 0.17, 2.52, 0.02), { soft: true });
    B.add('#3e7f86', new THREE.BoxGeometry(0.32, 0.035, 0.03).translate(-0.7, 2.4, 0.02), { soft: true });
    // a shelf under the eave with nets of jars and the wares
    B.add(plank, block(1.6, 0.08, 0.5, 1.55, 0.95, 0.35));
    for (const s of [-1, 1]) B.add(plank, block(0.08, 0.95, 0.4, 1.55 + s * 0.7, 0, 0.35));
    wares(B, 0.95, 1.03, 0.4, { flasks: 2, heart: 'basket', holder: '#a88a52', step: 0.32 });
    for (const x of [0.9, 1.3, 1.7, 2.1]) B.add(INK, stick([x, 2.7, 0.3], [x + 0.2, 1.5, 0.45], 0.006), { soft: true });
    for (const [x, c] of [[1.0, '#7f9a5a'], [1.5, '#b07ab0'], [2.0, '#c9a24a']]) B.add(c, lathe([[0.01, 0], [0.09, 0.02], [0.1, 0.2], [0.07, 0.24]], 8).translate(x, 2.0, 0.42), { soft: true });
    // the sign: a pole with a cord of knots, crystals threaded on it and a carved wooden flask at its end
    B.add('#6e5a44', stick([3.05, -0.5, 0.9], [3.05, 3.5, 0.9], 0.06));
    B.add('#6e5a44', stick([3.05, 3.4, 0.9], [3.75, 3.4, 0.9], 0.04));
    B.add(INK, cord(3.7, 3.4, 1.9, 0.9, 0.012), { soft: true });
    for (let k = 0; k < 5; k++) B.add('#c9b07a', new THREE.SphereGeometry(0.04, 6, 4).translate(3.7, 3.25 - k * 0.27, 0.9), { soft: true });
    for (const k of [0, 1]) B.add(null, crystalGeometry(0.16, 3 + k).translate(3.7, 3.05 - k * 0.45, 0.9));
    B.add('#a8764c', lathe([[0.01, 0], [0.12, 0.04], [0.13, 0.18], [0.05, 0.28], [0.04, 0.36]], 8).translate(3.7, 1.55, 0.9), { soft: true });
    return { door: -0.7, lights: [[-2.1, 2.2, 0.6, 7], [-0.7, 2.1, 0.8, 5]], size: { w: 8, d: 7, h: 5.6 } };
  },

  /**
   * Lorn II, the Welcome-Shelf: a moss dome with a blue door in a stone surround, a brass porthole, a stall under
   * a blue-and-cream striped awning with its table of flasks, three little lamps on a cord over the door (the
   * Welcome) under a carved boat-shaped board, a lamp-post by the path.
   */
  mossdome(B) {
    const moss = '#8aa05a', stone = '#9a9a86', blue = '#4f6f9e', cream = '#efe6d0', wood = '#7a5232', c = [0, -0.9, -5.4], R = 4.8;
    B.add(moss, new THREE.SphereGeometry(R, 28, 12, 0, Math.PI * 2, 0, Math.PI / 2).translate(c[0], c[1], c[2]), { weathered: true });
    B.add(moss, new THREE.CylinderGeometry(R, R, 1.2, 28, 1, true).translate(c[0], c[1] - 0.6, c[2]));
    B.add(stone, archWall(2.1, 2.8, 0.6, { arch: true, door: { w: 1.3, h: 2.3, arch: true } }), { grid: 0.45 });
    B.add(stone, new THREE.ExtrudeGeometry(archShape(2.1, 2.8), { depth: 1.6, bevelEnabled: false }).translate(0, 0, -2.2));
    B.add(stone, block(2.3, 1.4, 2.2, 0, -1.4, -1.0));
    lit(B, 1.3, 2.3, 0, 0, -0.58, { color: '#ffd59a' });
    B.add(blue, block(1.25, 2.15, 0.07, -1.75, 0, 0.12), { soft: true });   // (the blue door, open against the wall)
    B.add(BRASS, new THREE.TorusGeometry(0.17, 0.03, 5, 14).translate(-1.75, 1.4, 0.17), { soft: true });
    // the porthole on the dome's right
    { const { p, n } = onDome(c, R, 2.9, 1.6); B.add(BRASS, facing(new THREE.TorusGeometry(0.5, 0.09, 6, 18), p, n), { soft: true }); B.add('#ffd98a', facing(new THREE.CircleGeometry(0.45, 18), p.clone().addScaledVector(n, 0.02), n), { soft: true, glow: 0.8 }); }
    // the Welcome: three little lamps over the door, the carved boat-shaped board above them
    B.add(INK, stick([-1.4, 3.1, 0.25], [0, 2.95, 0.35], 0.01), { soft: true }); B.add(INK, stick([0, 2.95, 0.35], [1.4, 3.1, 0.25], 0.01), { soft: true });
    for (const x of [-0.75, 0, 0.75]) { B.add(INK, cord(x, 3.02, 2.84, 0.33), { soft: true }); B.add('#ffe39a', lathe([[0.01, 0], [0.08, 0.03], [0.09, 0.16], [0.05, 0.22]], 6).translate(x, 2.62, 0.33), { soft: true, glow: 1 }); }
    B.add(wood, new THREE.SphereGeometry(1, 14, 6, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2).scale(1.3, 0.3, 0.2).translate(0, 3.55, 0.45), { soft: true });
    B.add(wood, block(2.7, 0.06, 0.42, 0, 3.52, 0.45), { soft: true });
    // the stall: four poles, a striped awning, a table with a blue cloth and the wares, shelves of bottles behind
    for (const [x, z] of [[1.55, 0.15], [4.15, 0.15], [1.55, 1.75], [4.15, 1.75]]) B.add(wood, stick([x, 0, z], [x, 2.75, z], 0.05));
    stripes(B, [blue, cream], { x: 2.85, w: 2.8, y0: 2.75, z0: 0.05, y1: 2.35, z1: 1.85, n: 9 });
    B.add(wood, block(2.4, 0.8, 0.9, 2.85, 0, 1.0));
    B.add('#8fb0d6', block(2.5, 0.06, 1.0, 2.85, 0.8, 1.0), { soft: true });
    wares(B, 1.95, 0.86, 1.05, { flasks: 4, heart: 'jar', holder: '#a8754e', step: 0.3 });
    B.add(wood, block(2.4, 0.06, 0.35, 2.85, 1.45, 0.35)); B.add(wood, block(2.4, 0.06, 0.35, 2.85, 1.95, 0.35));
    for (let i = 0; i < 6; i++) B.add('#cfe3e6', lathe([[0.01, 0], [0.08, 0.02], [0.09, 0.14], [0.03, 0.22]], 7).translate(1.9 + i * 0.38, 1.51, 0.38), { soft: true });
    // a lamp-post by the path
    B.add(wood, stick([-2.7, -0.4, 1.0], [-2.7, 2.8, 1.0], 0.05));
    B.add('#ffe39a', lathe([[0.01, 0], [0.1, 0.03], [0.11, 0.24], [0.05, 0.32]], 6).translate(-2.7, 2.8, 1.0), { soft: true, glow: 1 });
    return { lights: [[0, 2.8, 0.7, 7], [-2.7, 3.0, 1.0, 6], [2.85, 2.2, 1.0, 5]], size: { w: 9, d: 9, h: 4 } };
  },

  /**
   * Viridel, Clover's Potting House: a lean-to of wood and glass built against a fallen white builders' slab under
   * an umbrella tree, a green-and-cream striped awning, a brass scroll bracket hanging a flask in a ring with a
   * leaf, a ladder of shelves with pots and flasks, a stone pedestal with a heart in a pot, flowers.
   */
  potting(B) {
    const white = '#f2efe6', wood = '#a87a4e', glass = '#cfe6e0', green = '#7fae6a', cream = '#f3ecd8', terra = '#c8673f';
    // the builders' slab: a white wedge leaning back, panelled
    const slab = new THREE.Shape(); slab.moveTo(-1.2, -1.4); slab.lineTo(-4.6, 6.8); slab.lineTo(-6.4, 6.8); slab.lineTo(-8.4, -1.4); slab.lineTo(-1.2, -1.4);
    B.add(white, new THREE.ExtrudeGeometry(slab, { depth: 10, bevelEnabled: false }).rotateY(-Math.PI / 2).translate(5, 0, 0), { grid: 1.3 });
    // the glasshouse: a front of glass in a wooden frame with its door and window, a sloping glass roof to the slab
    B.add(glass, archWall(4.4, 2.8, 0.15, { door: { w: 1.3, h: 2.3, x: -0.9 }, windows: [{ w: 1.6, h: 1.2, x: 1.1, y: 0.9 }] }), { glow: 0.1 });
    B.add(glass, block(4.4, 2.8, 2.6, 0, 0, -1.45), { glow: 0.1 });
    B.add(glass, new THREE.BoxGeometry(4.4, 0.08, 3.6).rotateX(0.62).translate(0, 3.85, -1.35), { glow: 0.1 });
    for (const x of [-2.2, -1.6, -0.2, 0.3, 1.9, 2.2]) B.add(wood, block(0.09, 2.85, 0.1, x, 0, 0.03), { soft: true });
    B.add(wood, block(4.5, 0.1, 0.12, 0, 2.8, 0.03), { soft: true });
    for (const x of [-2.2, -0.7, 0.7, 2.2]) B.add(wood, new THREE.BoxGeometry(0.08, 0.08, 3.6).rotateX(0.62).translate(x, 3.9, -1.32), { soft: true });
    lit(B, 1.3, 2.3, -0.9, 0, -0.13, { arch: false, color: '#fff0c8' });
    lit(B, 1.6, 1.2, 1.1, 0.9, -0.13, { arch: false, color: '#e9f6dc' });
    stripes(B, [green, cream], { x: 0, w: 4.6, y0: 2.75, z0: 0.08, y1: 2.35, z1: 1.3, n: 11 });
    // the brass scroll bracket: a ring with a flask, a leaf at the arm's end
    B.add(BRASS, stick([2.5, 3.2, 0.05], [2.5, 3.2, 1.25], 0.035), { soft: true });
    B.add(BRASS, new THREE.TorusGeometry(0.16, 0.025, 5, 14, Math.PI * 1.5).rotateY(Math.PI / 2).translate(2.5, 3.0, 0.3), { soft: true });
    B.add(BRASS, new THREE.TorusGeometry(0.34, 0.03, 6, 20).rotateY(Math.PI / 2).translate(2.5, 2.72, 1.05), { soft: true });
    { const f = flask(2.5, 2.55, 1.05, 1.1); B.add('#9fc58a', f.glass, { soft: true }); B.add(CORK, f.cork, { soft: true }); }
    B.add(green, feather(2.5, 3.32, 1.35, 0.42, Math.PI / 2), { soft: true, side: THREE.DoubleSide });
    // a ladder of shelves at the right with pots and flasks
    for (const x of [2.75, 3.95]) B.add(wood, stick([x, 0, 0.6], [x, 2.3, 0.35], 0.04));
    for (const y of [0.6, 1.25, 1.9]) {
      B.add(wood, block(1.35, 0.05, 0.38, 3.35, y, 0.5 - y * 0.1));
      for (let i = 0; i < 3; i++) {
        const x = 2.95 + i * 0.4, z = 0.5 - y * 0.1;
        if ((i + Math.round(y * 2)) % 2) { const f = flask(x, y + 0.05, z); B.add(RED, f.glass, { soft: true }); B.add(CORK, f.cork, { soft: true }); }
        else { B.add(terra, new THREE.CylinderGeometry(0.12, 0.09, 0.18, 8).translate(x, y + 0.14, z), { soft: true }); B.add(green, new THREE.SphereGeometry(0.15, 7, 5).translate(x, y + 0.32, z), { soft: true }); }
      }
    }
    // the pedestal by the path: a heart in a pot of moss, a magic cell in its cradle
    B.add(white, new THREE.CylinderGeometry(0.42, 0.48, 0.85, 14).translate(-2.9, 0.42, 0.9));
    B.add(terra, new THREE.CylinderGeometry(0.22, 0.16, 0.14, 10).translate(-3.05, 0.92, 0.9), { soft: true });
    B.add(RED, heartGeo(0.26).translate(-3.05, 1.14, 0.9), { soft: true });
    { const v = vial(-2.7, 0.85, 0.9); B.add(TEAL, v.glow, { soft: true, glow: 0.7 }); B.add(BRASS, v.brass, { soft: true }); }
    for (const [x, z, col] of [[-2.3, 1.5, '#e98fb0'], [-3.6, 1.4, '#f2c94c'], [3.0, 1.6, '#e98fb0'], [-1.9, 0.6, '#e98fb0'], [1.9, 1.1, '#f6f0e0']]) for (let k = 0; k < 4; k++) B.add(col, new THREE.SphereGeometry(0.09, 6, 4).translate(x + Math.sin(k * 2.1) * 0.25, 0.35 + (k % 2) * 0.15, z + Math.cos(k * 2.1) * 0.2), { soft: true });
    // the umbrella tree it was built under
    B.add('#9a8a72', stick([-4.2, -0.5, -0.6], [-3.4, 5.2, -1.8], 0.32));
    B.add('#9a8a72', stick([-3.6, 4.0, -1.5], [-1.6, 5.8, -1.2], 0.14));
    B.add('#9a8a72', stick([-3.5, 4.5, -1.7], [-5.6, 5.9, -2.6], 0.14));
    B.add('#8fb86a', new THREE.SphereGeometry(4.6, 18, 8).scale(1, 0.22, 0.85).translate(-3.2, 6.3, -1.6), { soft: true });
    return { door: -0.9, lights: [[-0.9, 2.3, 0.6, 6], [1.1, 1.8, 0.6, 4]], size: { w: 10, d: 9, h: 7 } };
  },

  /**
   * The City-Shaft, Fausta's Basket-Shop: a narrow three-storey cream house with a terracotta roof and green
   * shutters, a rose-striped awning over its shop window and the wares on a shelf under it, a wooden crane
   * from the top floor with baskets on a rope, a wrought-iron bracket hanging a mortar and a flask.
   */
  basket(B) {
    const cream = '#efe2c8', terra = '#c9694a', green = '#7c9a78', wood = '#8f6440', iron = '#3d3a3a';
    const W = 4.6, H = 9.4, wins = [[-1.1, 3.5], [1.1, 3.5], [-1.1, 6.3], [1.1, 6.3]];
    B.add(cream, archWall(W, H, 0.4, { door: { w: 1.3, h: 2.4, x: -1.1, arch: true }, windows: [{ w: 1.7, h: 1.4, x: 1.05, y: 0.95 }, ...wins.map(([x, y]) => ({ w: 0.9, h: 1.4, x, y }))] }), strata('#e2cfb2', 1.4));
    B.add(cream, block(W, H + 1.4, 4.2, 0, -1.4, -2.5), strata('#e2cfb2', 1.4));
    B.add(terra, new THREE.ConeGeometry(3.75, 1.7, 4).rotateY(Math.PI / 4).scale(1, 1, 0.98).translate(0, H + 0.85, -2.3), { grid: 0.4 });
    lit(B, 1.3, 2.4, -1.1, 0, -0.38);
    lit(B, 1.7, 1.4, 1.05, 0.95, -0.38, { arch: false, color: '#f6d89c' });
    for (const [x, y] of wins) {
      lit(B, 0.9, 1.4, x, y, -0.38, { arch: false, color: '#9fb3c9' });
      for (const s of [-1, 1]) B.add(green, block(0.45, 1.45, 0.06, x + s * 0.7, y - 0.02, 0.05), { soft: true });
    }
    for (const g of archFrame(1.3, 2.4, { t: 0.12, d: 0.08 })) B.add(green, g.translate(-1.1, 0, 0), { soft: true });
    stripes(B, ['#d9796a', '#f3e6d6'], { x: 1.05, w: 2.0, y0: 2.75, z0: 0.05, y1: 2.35, z1: 1.0, n: 7 });
    B.add(wood, block(2.0, 0.08, 0.55, 1.05, 0.92, 0.25));
    wares(B, 0.35, 1.0, 0.3, { flasks: 3, heart: 'box', holder: '#8a5a3c', step: 0.32 });
    // the crane from the top floor, its pulley and a rope with two baskets
    B.add(wood, stick([1.6, 8.6, -0.2], [3.9, 9.1, 0.8], 0.11));
    B.add(wood, stick([2.2, 7.6, 0.02], [3.2, 8.9, 0.5], 0.07));
    B.add(iron, new THREE.CylinderGeometry(0.18, 0.18, 0.06, 12).rotateZ(Math.PI / 2).translate(3.85, 8.95, 0.8), { soft: true });
    B.add(INK, cord(3.85, 8.85, 3.0, 0.8, 0.012), { soft: true });
    for (const y of [5.6, 3.2]) B.add('#c7a56a', lathe([[0.18, 0], [0.25, 0.05], [0.28, 0.3]], 10).translate(3.85, y - 0.3, 0.8), { soft: true });
    // the iron bracket: a mortar and a flask hanging off the corner
    B.add(iron, stick([-2.3, 3.3, 0.02], [-2.3, 3.3, 1.0], 0.03), { soft: true });
    B.add(iron, stick([-2.3, 2.9, 0.02], [-2.3, 3.3, 0.6], 0.02), { soft: true });
    B.add('#5a4a3e', lathe([[0.08, 0], [0.2, 0.05], [0.24, 0.22], [0.22, 0.24]], 10).translate(-2.3, 2.75, 0.62), { soft: true });
    { const f = flask(-2.3, 2.55, 0.95, 1.2); B.add(RED, f.glass, { soft: true }); B.add(CORK, f.cork, { soft: true }); }
    B.add(INK, cord(-2.3, 3.3, 2.95, 0.62), { soft: true }); B.add(INK, cord(-2.3, 3.3, 2.85, 0.95), { soft: true });
    B.add('#8a8a86', stick([-2.15, -0.5, 0.05], [-2.15, H, 0.05], 0.05), { soft: true });   // (a drainpipe)
    return { door: -1.1, lights: [[-1.1, 2.3, 0.6, 6], [1.05, 2.0, 0.7, 5]], size: { w: 6, d: 5, h: 11 } };
  },

  /**
   * The Sealed Hangar, the Quartermaster's Hatch: a cabin of riveted sage-green plate with rounded corners, a door
   * and a serving hatch with a rolled shutter under a corrugated awning on struts, its counter-board with a rack of
   * flasks, a gear-and-flask stencil for a sign, pipes with a valve wheel, crates and a drum, a chimney.
   */
  kiosk(B) {
    const sage = '#a8b59b', sage2 = '#97a58a', pale = '#c9ccc4', rust = '#b8644a', crate = '#c9b48a', stencil = '#6d7468';
    B.add(sage, archWall(4.8, 3.1, 0.3, { door: { w: 1.3, h: 2.3, x: -1.5 }, windows: [{ w: 2.3, h: 1.2, x: 1.0, y: 1.0 }] }), { plates: true });
    B.add(sage, block(5.6, 3.4, 4.0, 0, -0.2, -2.3), { plates: true });
    B.add(sage2, block(5.8, 0.9, 4.2, 0, -1.1, -2.2));
    for (const z of [-0.33, -4.27]) for (const s of [-1, 1]) B.add(sage2, new THREE.CylinderGeometry(0.35, 0.35, 3.4, 10).translate(s * 2.62, 1.5, z));
    B.add(sage2, block(5.7, 0.25, 4.1, 0, 3.2, -2.3));
    lit(B, 1.3, 2.3, -1.5, 0, -0.28, { arch: false });
    lit(B, 2.3, 1.2, 1.0, 1.0, -0.28, { arch: false, color: '#f2d39a' });
    for (const g of archFrame(1.3, 2.3, { t: 0.1, d: 0.06, arch: false })) B.add(sage2, g.translate(-1.5, 0, 0), { soft: true });
    // the rolled shutter, the corrugated awning on its struts, the counter-board on brackets
    B.add(pale, new THREE.CylinderGeometry(0.12, 0.12, 2.4, 10).rotateZ(Math.PI / 2).translate(1.0, 2.32, 0.1), { soft: true });
    for (let i = 0; i < 8; i++) B.add(i % 2 ? pale : '#b9bcb4', new THREE.BoxGeometry(0.36, 0.04, 1.3).rotateX(0.32).translate(-0.25 + i * 0.36, 2.55, 0.62), { soft: true });
    for (const x of [-0.2, 2.2]) B.add('#55605a', stick([x, 1.95, 0.02], [x, 2.36, 1.2], 0.025), { soft: true });
    B.add(pale, block(2.8, 0.09, 0.6, 1.0, 0.95, 0.27));
    for (const x of [-0.2, 2.2]) B.add('#55605a', stick([x, 0.5, 0.02], [x, 0.95, 0.5], 0.025), { soft: true });
    B.add('#55605a', block(0.9, 0.02, 0.22, 0.25, 1.04, 0.3), { soft: true });
    for (const x of [-0.05, 0.15, 0.35, 0.55]) { const f = flask(x, 1.06, 0.3, 1.05); B.add(RED, f.glass, { soft: true }); B.add(CORK, f.cork, { soft: true }); B.add('#55605a', new THREE.TorusGeometry(0.12, 0.008, 3, 10).rotateX(Math.PI / 2).translate(x, 1.17, 0.3), { soft: true }); }
    wares(B, 1.05, 1.04, 0.3, { flasks: 0, heart: 'box', holder: '#5f7a9a', step: 0.42 });
    // the stencil: a gear round a flask, on the side and over the door
    for (const [g, p] of [[gear(0.95, 10, 0.02, 0.74).rotateY(-Math.PI / 2), [-2.82, 1.7, -2.2]], [gear(0.42, 10, 0.02, 0.74), [-1.5, 2.72, 0.02]]]) B.add(stencil, g.translate(...p), { soft: true });
    B.add(stencil, lathe([[0.01, 0], [0.32, 0.03], [0.34, 0.3], [0.12, 0.62], [0.1, 0.8]], 10).scale(1, 1, 0.04).rotateY(-Math.PI / 2).translate(-2.83, 1.32, -2.2), { soft: true });
    B.add(stencil, lathe([[0.01, 0], [0.15, 0.015], [0.16, 0.14], [0.06, 0.29], [0.05, 0.37]], 10).scale(1, 1, 0.04).translate(-1.5, 2.54, 0.03), { soft: true });
    // pipes with a valve wheel, crates and a drum on the left, a chimney on the roof
    B.add(rust, stick([-3.4, -0.5, -0.9], [-3.4, 4.6, -0.9], 0.16));
    B.add(rust, stick([-3.4, 3.4, -0.9], [-2.8, 3.4, -1.6], 0.14));
    B.add('#c9973e', new THREE.TorusGeometry(0.3, 0.04, 5, 12).rotateY(Math.PI / 2).translate(-3.2, 1.6, -0.9), { soft: true });
    B.add(crate, block(1.2, 0.8, 0.9, -3.6, 0, 0.6)); B.add(crate, block(1.0, 0.7, 0.8, -3.5, 0.8, 0.55));
    B.add('#5b78a8', new THREE.CylinderGeometry(0.4, 0.4, 0.95, 14).translate(-2.5, 0.47, 1.0));
    B.add('#7d8478', new THREE.CylinderGeometry(0.14, 0.16, 1.3, 10).translate(-1.4, 3.95, -1.8));
    B.add('#7d8478', new THREE.ConeGeometry(0.28, 0.25, 10).translate(-1.4, 4.7, -1.8));
    return { door: -1.5, lights: [[1.0, 2.0, 0.6, 6], [-1.5, 2.2, 0.6, 5]], size: { w: 8, d: 5, h: 5 } };
  },

  /**
   * The Buried Machine, Mott's Tooth-Counter: a riveted grey-blue iron dome half sunk in the sand, an oval door in
   * a thick frame, a lit porthole, a ring of pipe and a chimney on top, a rust-orange canvas awning on iron struts,
   * a huge rusty gear tooth for a sign on a chain, a shelf of wares by the door.
   */
  rivetdome(B) {
    const iron = '#a8b5c8', iron2 = '#8f9db2', rust = '#c4683a', canvas = '#d9774a', c = [0, -0.8, -5.1], R = 4.1;
    B.add(iron, new THREE.SphereGeometry(R, 28, 12, 0, Math.PI * 2, 0, Math.PI / 2).translate(...c), { plates: true });
    B.add(iron, new THREE.CylinderGeometry(R, R, 1.4, 28, 1, true).translate(c[0], c[1] - 0.7, c[2]));
    for (let i = 0; i < 8; i++) B.add(iron2, new THREE.TorusGeometry(R + 0.03, 0.05, 4, 20, Math.PI / 2).rotateY(i * Math.PI / 4).translate(...c), { soft: true });
    B.add(iron2, new THREE.TorusGeometry(R * 0.72, 0.06, 4, 28).rotateX(Math.PI / 2).translate(c[0], c[1] + R * 0.69, c[2]), { soft: true });
    // the oval door: a thick arched frame proud of the dome, solid behind
    B.add(iron, archWall(2.6, 3.4, 1.0, { arch: true, door: { w: 1.4, h: 2.5, arch: true } }), { plates: true });
    B.add(iron, new THREE.ExtrudeGeometry(archShape(2.6, 3.4), { depth: 1.1, bevelEnabled: false }).translate(0, 0, -2.1));
    B.add(iron, block(2.8, 1.4, 2.2, 0, -1.4, -1.0));
    lit(B, 1.4, 2.5, 0, 0, -0.98, { color: '#ffcf8a' });
    for (const g of archFrame(1.4, 2.5, { t: 0.12, d: 0.08 })) B.add(iron2, g, { soft: true });
    // the porthole, the ring of pipe and the chimney on top
    { const { p, n } = onDome(c, R, -2.6, 1.3); B.add(BRASS, facing(new THREE.TorusGeometry(0.48, 0.09, 6, 18), p, n), { soft: true }); B.add('#ffd98a', facing(new THREE.CircleGeometry(0.42, 18), p.clone().addScaledVector(n, 0.02), n), { soft: true, glow: 0.85 }); }
    B.add(iron2, new THREE.TorusGeometry(1.45, 0.17, 6, 20).rotateX(Math.PI / 2).translate(c[0], c[1] + R - 0.25, c[2]));
    B.add(iron, new THREE.CylinderGeometry(1.1, 1.2, 0.35, 18).translate(c[0], c[1] + R, c[2]));
    B.add(iron2, new THREE.CylinderGeometry(0.16, 0.16, 2.2, 10).translate(1.6, 3.4, -4.4));
    // the awning: canvas on iron struts, over the door and the shelf
    B.add(canvas, cloth([-2.9, 3.05, -1.5], [1.2, 3.05, -1.5], [1.2, 2.55, 1.35], [-2.9, 2.55, 1.35]), { soft: true });
    for (const x of [-2.9, 1.2]) B.add('#5f6a7e', stick([x, 1.9, -1.35], [x, 2.55, 1.35], 0.03), { soft: true });
    // the gear tooth on its chain, the shelf of wares
    B.add(INK, cord(-1.6, 2.75, 2.25, 0.35), { soft: true });
    B.add(rust, gear(0.38, 9, 0.12, 0.3).translate(-1.6, 1.85, 0.35), { soft: true });
    B.add('#8f9db2', block(1.7, 0.07, 0.5, -2.45, 0.95, 0.3));
    for (const s of [-1, 1]) B.add('#5f6a7e', stick([-2.45 + s * 0.75, 0, 0.3], [-2.45 + s * 0.75, 0.95, 0.3], 0.03));
    wares(B, -3.15, 1.02, 0.32, { flasks: 2, heart: 'jar', holder: '#a8742a', step: 0.33 });
    return { lights: [[0, 2.3, 0.8, 6], [-2.6, 1.6, -1.6, 4]], size: { w: 9, d: 9, h: 5 } };
  },

  /**
   * The Garden of Spheres, the Listening Stall: a round white pavilion on a low plinth, a colonnade under a wide
   * flat-rimmed dome, a rotunda behind with its arched door, a pale blue cloth swag and a row of little glass bells
   * between the front columns, a white disc and a tuning fork for a sign, a round counter of wares.
   */
  pavilion(B) {
    const white = '#f3efe8', white2 = '#e6e0d6', blue = '#a9cde0', cz = -4.0;
    B.add(white2, new THREE.CylinderGeometry(5.4, 5.5, 1.3, 32).translate(0, -1.27 + 0.65 - 0.1, cz));
    B.add(white, new THREE.CylinderGeometry(4.9, 4.9, 1.2, 32).translate(0, -0.58, cz));
    B.add(white, new THREE.CylinderGeometry(3.2, 3.2, 3.6, 28).translate(0, 1.8, cz - 0.15), strata(white2, 2));
    B.add(white, archWall(2.4, 3.3, 0.6, { arch: true, door: { w: 1.35, h: 2.4, arch: true } }), strata(white2, 2));
    B.add(white, new THREE.ExtrudeGeometry(archShape(2.4, 3.3), { depth: 1.1, bevelEnabled: false }).translate(0, 0, -1.7));
    lit(B, 1.35, 2.4, 0, 0, -0.58, { color: '#fff1d6' });
    for (const g of archFrame(1.35, 2.4, { t: 0.12, d: 0.08 })) B.add(white2, g, { soft: true });
    // the colonnade and the dome with its wide rim
    for (const a of [-1.2, -0.7, -0.27, 0.27, 0.7, 1.2]) {
      const x = Math.sin(a) * 4.4, z = cz + Math.cos(a) * 4.4;
      B.add(white, new THREE.CylinderGeometry(0.17, 0.2, 3.5, 12).translate(x, 1.75, z));
      B.add(white2, block(0.5, 0.18, 0.5, x, 3.45, z));
    }
    B.add(white, new THREE.CylinderGeometry(5.1, 5.0, 0.32, 32).translate(0, 3.78, cz));
    B.add(white, new THREE.SphereGeometry(3.4, 24, 10, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.6, 1).translate(0, 3.9, cz));
    // the blue swag and the row of glass bells between the front columns
    const fx = Math.sin(0.27) * 4.4, fz = cz + Math.cos(0.27) * 4.4;
    B.add(blue, cloth([-fx - 0.4, 3.35, fz], [fx + 0.4, 3.35, fz], [fx, 2.95, fz + 0.05], [0, 2.75, fz + 0.1]), { soft: true });
    B.add(blue, cloth([-fx - 0.4, 3.35, fz], [0, 2.75, fz + 0.1], [-fx, 2.95, fz + 0.05]), { soft: true });
    B.add(BRASS, stick([-fx, 2.6, fz], [fx, 2.6, fz], 0.015), { soft: true });
    for (let i = 0; i < 6; i++) B.add('#dcefee', bell(-fx + 0.35 + i * ((fx * 2 - 0.7) / 5), 2.55, fz, 0.08), { soft: true, glow: 0.2 });
    // the sign: a white disc on a brass bracket, a tuning fork over the door
    B.add(BRASS, stick([-2.4, 2.9, -0.6], [-2.4, 2.9, 0.3], 0.025), { soft: true });
    B.add(white, new THREE.CylinderGeometry(0.42, 0.42, 0.05, 20).rotateZ(Math.PI / 2).translate(-2.4, 2.45, 0.2), { soft: true });
    B.add(white2, new THREE.TorusGeometry(0.28, 0.02, 4, 18).rotateY(Math.PI / 2).translate(-2.37, 2.45, 0.2), { soft: true });
    for (const s of [-1, 1]) B.add(BRASS, stick([s * 0.12, 3.02, 0.06], [s * 0.12, 3.45, 0.06], 0.025), { soft: true });
    B.add(BRASS, new THREE.TorusGeometry(0.12, 0.025, 4, 10, Math.PI).rotateZ(Math.PI).translate(0, 3.02, 0.06), { soft: true });
    B.add(BRASS, stick([0, 2.9, 0.06], [0, 2.62, 0.06], 0.03), { soft: true });
    // a round counter of wares in the colonnade, right of the door
    B.add(white, new THREE.CylinderGeometry(0.6, 0.65, 0.95, 18).translate(2.3, 0.47, 0.6));
    wares(B, 1.95, 0.96, 0.65, { flasks: 2, heart: 'cushion', holder: '#cfc7b8', step: 0.24 });
    return { lights: [[0, 2.6, 0.5, 6], [2.3, 2.4, 0.8, 4]], size: { w: 11, d: 11, h: 6 } };
  },

  /**
   * The Signal Market, Pashka's Cure-Stall: a stall in the foot of a coral tower, a teal front with the stall's
   * window and an arched door, a long teal counter of flasks, a heart in a glass case and vials, a wide red conical
   * awning hung with bulbs, and over it the illuminated board: a heart and a flask among lit bulbs.
   */
  stall(B) {
    const coral = '#e48a76', coral2 = '#d2776a', teal = '#5aa79c', teal2 = '#478e84', cream = '#f3e6c8', awn = '#e0654f', cz = -5.9, R = 5.0;
    B.add(coral, new THREE.CylinderGeometry(R, R + 0.1, 10.5, 30).translate(0, 4.0, cz), { plates: true });
    for (const y of [4.6, 7.4]) B.add(coral2, new THREE.TorusGeometry(R + 0.05, 0.12, 5, 30).rotateX(Math.PI / 2).translate(0, y, cz));
    B.add(teal, archWall(6.0, 3.6, 0.7, { door: { w: 1.4, h: 2.4, x: 1.95, arch: true }, windows: [{ w: 3.0, h: 1.6, x: -1.15, y: 1.1 }] }), { plates: true });
    B.add(teal, block(6.0, 3.6 + 1.4, 1.6, 0, -1.4, -1.5));
    lit(B, 1.4, 2.4, 1.95, 0, -0.68, { color: '#ffd9a0' });
    lit(B, 3.0, 1.6, -1.15, 1.1, -0.68, { arch: false, color: '#f6dc9e' });
    for (const g of archFrame(1.4, 2.4, { t: 0.12, d: 0.08 })) B.add(teal2, g.translate(1.95, 0, 0), { soft: true });
    B.add(BRASS, new THREE.TorusGeometry(0.2, 0.04, 5, 14).translate(1.95, 3.0, 0.08), { soft: true });
    // the counter: teal cabinets with a cream top, the wares in a row
    B.add(teal, block(3.4, 0.95, 0.75, -1.15, 0, 0.38));
    B.add(cream, block(3.55, 0.07, 0.85, -1.15, 0.95, 0.38));
    for (const x of [-2.3, -1.15, 0.0]) B.add(teal2, block(0.95, 0.6, 0.02, x, 0.18, 0.77), { soft: true });
    B.add('#a8754e', block(1.05, 0.12, 0.3, -2.2, 1.02, 0.4), { soft: true });
    for (let i = 0; i < 5; i++) { const f = flask(-2.6 + i * 0.2, 1.1, 0.4, 0.9); B.add(RED, f.glass, { soft: true }); B.add(CORK, f.cork, { soft: true }); }
    B.add('#f3cbc6', block(0.42, 0.36, 0.32, -1.25, 1.02, 0.4), { soft: true, glow: 0.15 });
    B.add(RED, heartGeo(0.24).translate(-1.25, 1.2, 0.4), { soft: true });
    for (let i = 0; i < 3; i++) { const v = vial(-0.55 + i * 0.28, 1.02, 0.4); B.add(TEAL, v.glow, { soft: true, glow: 0.7 }); B.add(BRASS, v.brass, { soft: true }); }
    // the wide conical awning round the tower, its bulbs, and the illuminated board over it
    B.add(awn, new THREE.CylinderGeometry(R + 0.2, R + 2.6, 0.9, 30, 1, true, -0.62, 1.24).translate(0, 3.55, cz), { soft: true, side: THREE.DoubleSide });
    for (let i = 0; i < 7; i++) { const a = -0.5 + i * (1.0 / 6), r = R + 2.0, x = Math.sin(a) * r, z = cz + Math.cos(a) * r; B.add(INK, cord(x, 3.3, 2.95, z), { soft: true }); B.add('#fff2b0', bulb(x, 2.9, z, 0.08), { soft: true, glow: 1 }); }
    B.add(teal, block(4.8, 1.8, 0.3, 0, 4.15, -0.75));
    B.add(cream, block(1.9, 1.35, 0.05, -1.25, 4.37, -0.58), { soft: true, glow: 0.35 });
    B.add(cream, block(1.9, 1.35, 0.05, 1.25, 4.37, -0.58), { soft: true, glow: 0.35 });
    B.add(RED, heartGeo(0.95).translate(-1.25, 5.05, -0.5), { soft: true });
    B.add(RED, lathe([[0.01, 0], [0.38, 0.05], [0.42, 0.45], [0.14, 0.8], [0.12, 1.0]], 14).scale(1, 1, 0.15).translate(1.25, 4.55, -0.5), { soft: true });
    B.add(BRASS, new THREE.TorusGeometry(0.22, 0.05, 5, 14).translate(0, 5.05, -0.55), { soft: true });
    for (let i = 0; i < 14; i++) { const t = i / 13, x = -2.25 + t * 4.5; for (const y of [4.25, 5.85]) B.add('#fff2b0', bulb(x, y, -0.55, 0.07), { soft: true, glow: 1 }); }
    return { door: 1.95, lights: [[-1.15, 2.5, 1.3, 6], [0, 5.0, 0.6, 8], [1.95, 2.2, 0.7, 5]], size: { w: 10, d: 11, h: 11 } };
  },
};

/** A world's shopfront (FRONTS[style]) at `at`, its door turned to `heading`; buildShopfront's shape. */
export function buildStyledFront(scene, { at, heading = 0, style }) {
  const make = FRONTS[style];
  if (!make) throw new Error(`no shopfront "${style}"`);
  const grp = new THREE.Group();
  grp.position.copy(at);
  grp.rotation.y = heading;
  grp.name = `shopfront.${style}`;
  const B = buckets();
  const made = make(B);
  // (a builder draws its front round its own middle; its door may stand to one side (made.door, x): the front is
  // set over so that the door is at `at`, where the way in is)
  const inner = new THREE.Group();
  inner.position.x = -(made.door ?? 0);
  grp.add(inner);
  B.build(inner);
  scene.add(grp);
  grp.updateMatrixWorld(true);
  const wp = (x, y, z) => grp.localToWorld(new THREE.Vector3(x, y, z));
  const lights = (made.lights ?? []).map(([x, y, z, r]) => { const p = inner.localToWorld(new THREE.Vector3(x, y, z)); return new THREE.Vector4(p.x, p.y, p.z, r); });
  return { group: grp, door: wp(0, 0, 0), heading, lights, local: wp, size: made.size ?? { w: 8, d: 7, h: 5 }, style, offset: -(made.door ?? 0) };
}

/** The styles there are (every route world's but the desert's, whose front is the kit's own). */
export const FRONT_STYLES = Object.keys(FRONTS);
