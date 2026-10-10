import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeMaterial } from './materials.js';
import { buildInterior } from './interior-kit.js';
import { SHOPS, SHELF } from './shop.js';
import { crystalGeometry } from './chimes.js';
import { buildStyledFront } from './shop-fronts.js';
import { buckets, heartGeo, lathe, flask, vial, bell, feather, gear, bulb, cord, block, stick, cloth, archSheet } from './shop-kit.js';
import { clearInstances } from './temples/index.js';

// A shop in a world (docs/systems/interiors.md, "A shop"): the interior kit's building (src/interior-kit.js)
// furnished as a shop: a counter across the room with the wares laid out on it (as many flasks as the shelf
// holds, a heart container and a magic cell for each one left), the keeper behind it (src/story/shops.js spawns
// them); the counter's front is where E looks at the wares (the shop panel, src/shop-panel.js).
//
// The desert's (Qanat, `style` qanat) is the plastered house with shelves of jars, strings of chimes by the door
// and lattice windows. Every other route world's shop (batch 4) has its own front (src/shop-fronts.js) and its
// own room (SHOP_STYLES below): the walls, floor and light of its world, its counter, what hangs from its
// ceiling and stands on its shelves, each after the author's picked reference (references/shops/<world>/).
//
//   const shop = placeShop(scene, { def: SHOPS.windshelf, at, heading })   (a level: the shop, its ground cleared)
//   level.portals.push(...shop.portals); level.lights.push(...shop.lights); level.shops = [shop];
//   floraAvoid: shop.avoid(theLevelsOwn)
//   shop.keeper  { at, heading }      where the keeper stands
//   shop.counter { at, look }         where you stand to look at the wares, and what the camera looks at
//   shop.show(view)                   the wares on the counter as the shop's stock is (src/shop.js Shop.view)

/** The room: 8 × 7 m, 4.2 m high, the door in its +z wall; the counter's line across it (local z). */
export const SHOP_ROOM = { w: 8, d: 7, h: 4.2, counter: -0.9, keeper: -2.05 };
/** The counter's top (m over the floor): where the wares stand, in every shop. */
const TOP = 1.04;

const INK = '#2b211f', RED = '#d9503f', CORK = '#b07a45', TEAL = '#70e7df', BRASS = '#d6a13e';

// ------------------------------------------------------------------ the rooms of the worlds

/** Hanging from the ceiling at (x, z): a cord with what is on it (a crystal, a feather, a bell, a lamp, a flask). */
function hang(B, R, x, z, len, what, o = {}) {
  const y = R.h - len;
  B.add(INK, cord(x, R.h, y, z), { soft: true });
  if (what === 'crystal') B.add(null, crystalGeometry(o.size ?? 0.16, o.seed ?? 5).translate(x, y - 0.05, z));
  if (what === 'feather') B.add(o.color ?? '#f6efe2', feather(x, y, z, o.size ?? 0.5, o.turn ?? 0), { soft: true, side: THREE.DoubleSide });
  if (what === 'bell') B.add(o.color ?? '#c4903e', bell(x, y, z, o.size ?? 0.1), { soft: true });
  if (what === 'lamp') B.add(o.color ?? '#ffe39a', new THREE.SphereGeometry(o.size ?? 0.2, 12, 8).translate(x, y - (o.size ?? 0.2), z), { soft: true, glow: 1 });
  if (what === 'flask') { const f = flask(x, y - 0.3, z, o.size ?? 1); B.add(o.color ?? RED, f.glass, { soft: true }); B.add(CORK, f.cork, { soft: true }); }
}
/** A row of bottles on a shelf at height y along x (x0 to x1) at depth z: colours in turn. */
function bottles(B, x0, x1, y, z, colors = [RED, '#e8e0cc'], { n = null, s = 1 } = {}) {
  const count = n ?? Math.max(2, Math.floor((x1 - x0) / (0.26 * s)));
  for (let i = 0; i < count; i++) {
    const x = x0 + (i + 0.5) * ((x1 - x0) / count), c = colors[i % colors.length];
    const g = i % 3 === 2 ? lathe([[0.01, 0], [0.08, 0.02], [0.09, 0.2], [0.07, 0.24], [0.075, 0.27]], 8) : lathe([[0.01, 0], [0.1, 0.02], [0.11, 0.12], [0.05, 0.2], [0.035, 0.24]], 8);
    B.add(c, g.scale(s, s, s).translate(x, y, z), { soft: true });
  }
}
/** A shelf board on the back wall (z), w wide at x, height y, with what stands on it. */
function shelf(B, R, x, y, w, color, fill = null) {
  const z = -R.d / 2 + 0.36;
  B.add(color, block(w, 0.06, 0.38, x, y, z));
  if (fill) bottles(B, x - w / 2 + 0.05, x + w / 2 - 0.05, y + 0.06, z, fill);
}
/** Along a side wall (s -1 left, +1 right) at depth z: a point just off it. */
const sideX = (R, s, off = 0.35) => s * (R.w / 2 - off);

/**
 * The counter across the room at z = SHOP_ROOM.counter, its top at TOP: 'box' (Haddu's: a band along its front),
 * 'curved' (its front bowed toward the door, the hoodoo's stone, the moss dome's wood, the pavilion's white), 'plank'
 * (a plank on two barrels, the raft's), and the gear teeth round the foot of the Buried Machine's.
 */
function counter(B, c) {
  const cz = SHOP_ROOM.counter, cw = c.w ?? 5.2, h = TOP - 0.08;
  if (c.shape === 'plank') {
    B.add(c.top ?? c.color, block(cw, 0.1, 0.72, 0, h - 0.02, cz));
    for (const x of [-cw / 2 + 0.7, cw / 2 - 0.7]) B.add(c.color, lathe([[0.32, 0], [0.38, 0.45], [0.32, 0.92]], 12).translate(x, 0, cz));
    for (const x of [-cw / 2 + 0.7, cw / 2 - 0.7]) for (const y of [0.18, 0.74]) B.add('#5a4a3a', new THREE.TorusGeometry(0.36, 0.025, 4, 16).rotateX(Math.PI / 2).translate(x, y, cz), { soft: true });
    return;
  }
  if (c.shape === 'curved') {
    const bulge = c.bulge ?? 0.35, s = new THREE.Shape(), n = 16;
    s.moveTo(-cw / 2, 0.33);
    for (let i = 0; i <= n; i++) { const x = -cw / 2 + (i / n) * cw; s.lineTo(x, -(0.33 + bulge * (1 - (2 * x / cw) ** 2))); }
    s.lineTo(cw / 2, 0.33); s.lineTo(-cw / 2, 0.33);
    const body = new THREE.ExtrudeGeometry(s, { depth: h, bevelEnabled: false }).rotateX(-Math.PI / 2).translate(0, 0, cz);
    B.add(c.color, body, c.mat ?? {});
    const top = new THREE.ExtrudeGeometry(s, { depth: 0.08, bevelEnabled: false }).rotateX(-Math.PI / 2).scale(1.03, 1, 1.12).translate(0, h, cz);
    B.add(c.top ?? c.color, top);
    if (c.band) B.add(c.band, new THREE.ExtrudeGeometry(s, { depth: 0.1, bevelEnabled: false }).rotateX(-Math.PI / 2).scale(1.006, 1, 1.03).translate(0, 0.55, cz), { soft: true });
    if (c.teeth) for (let i = 0; i < 11; i++) { const x = -cw / 2 + 0.3 + i * ((cw - 0.6) / 10); B.add(c.teeth, block(0.28, 0.4, 0.5, x, 0, cz + 0.33 + bulge * (1 - (2 * x / cw) ** 2) - 0.08)); }
    if (c.basin) { B.add(c.top ?? c.color, new THREE.TorusGeometry(0.38, 0.05, 6, 20).rotateX(Math.PI / 2).translate(c.basin, TOP + 0.02, cz - 0.05), { soft: true }); B.add('#9cc9de', new THREE.CircleGeometry(0.36, 20).rotateX(-Math.PI / 2).translate(c.basin, TOP + 0.03, cz - 0.05), { soft: true, glow: 0.2 }); }
    return;
  }
  B.add(c.color, block(cw, 0.96, 0.66, 0, 0, cz));
  B.add(c.top ?? c.color, block(cw + 0.2, 0.08, 0.84, 0, 0.96, cz));
  if (c.band) B.add(c.band, new THREE.BoxGeometry(cw + 0.02, 0.16, 0.02).translate(0, 0.72, cz + 0.34), { soft: true });
  if (c.panels) for (let i = 0; i < 4; i++) B.add(c.panels, new THREE.BoxGeometry(cw / 4 - 0.25, 0.55, 0.02).translate(-cw / 2 + (i + 0.5) * (cw / 4), 0.42, cz + 0.34), { soft: true });
  if (c.trim) B.add(c.trim, new THREE.BoxGeometry(cw + 0.05, 0.06, 0.04).translate(0, 0.08, cz + 0.35), { soft: true });
}

/**
 * Each world's room (the desert's, Qanat's, is the original below): `room` is src/interiors.js buildRoom's options,
 * `counter` the counter, `heart` what each heart container sits on at the counter, `dress` everything else.
 * Nothing in a room is a heart or a magic cell but the wares on the counter (they are the stock: what is sold
 * goes from the counter).
 */
export const SHOP_STYLES = {
  // Vael: a round room carved in the hoodoo, bone white with ochre bands, a round window with a curtain blowing, a
  // curved stone counter with the sand tray, niches of flasks in the back wall, feathers and crystals turning on cords
  hoodoo: {
    room: { wall: { color: '#efe5d8', color2: '#e3c9a6', grid: 0 }, floor: '#e9c8a6', ceiling: '#eadfce', lamp: '#ffe2a8',
      windows: [{ side: 'left', x: 3.5, y: 0.9, w: 2.2, h: 2.2 }] },
    counter: { shape: 'curved', color: '#ece2d4', top: '#f2eadf', band: '#dc9f52', bulge: 0.3 },
    heart: { holder: 'cloth', color: '#e9a57f' },
    dress(B, R) {
      const bz = -R.d / 2 + 0.2;
      for (const x of [-2.6, -1.6, 1.6, 2.6]) {
        B.add('#ddc8ae', archSheet(0.75, 1.3).translate(x, 1.4, bz + 0.01), { soft: true });
        B.add('#e6d6c2', block(0.75, 0.05, 0.22, x, 1.75, bz + 0.1), { soft: true });
        bottles(B, x - 0.3, x + 0.3, 1.8, bz + 0.1, [RED, '#d9c8ae'], { n: 2 });
        bottles(B, x - 0.3, x + 0.3, 1.43, bz + 0.1, ['#c98a6a', RED], { n: 2 });
      }
      B.add('#e7b878', archSheet(1.3, 2.9).translate(0, 0, bz + 0.01), { soft: true });
      for (const y of [0.7, 1.4, 2.1]) B.add('#dc9f52', block(1.3, 0.1, 0.02, 0, y, bz + 0.02), { soft: true });
      // the curtain at the round window, blowing in
      B.add('#e98f6f', cloth([-R.w / 2 + 0.25, 3.0, 1.1], [-R.w / 2 + 0.25, 3.0, 1.6], [-R.w / 2 + 1.2, 0.6, 1.4], [-R.w / 2 + 0.8, 0.5, 0.9]), { soft: true });
      // the sand tray with a price drawn in it
      B.add('#d8b48a', new THREE.CylinderGeometry(0.27, 0.29, 0.04, 18).translate(2.15, TOP + 0.02, SHOP_ROOM.counter + 0.1), { soft: true });
      for (const k of [0, 1, 2]) B.add(INK, new THREE.BoxGeometry(0.16, 0.01, 0.015).translate(2.1 + k * 0.05, TOP + 0.045, SHOP_ROOM.counter + 0.05 + k * 0.05), { soft: true });
      // feathers and crystals turning on cords from the ceiling
      for (let i = 0; i < 14; i++) {
        const x = -3.2 + (i % 7) * 1.05 + (i > 6 ? 0.5 : 0), z = i > 6 ? -2.6 : 1.3 + (i % 2) * 0.6, len = 0.7 + ((i * 7) % 5) * 0.12;
        hang(B, R, x, z, len, i % 2 ? 'feather' : 'crystal', { seed: 3 + i, turn: i * 0.9, color: i % 3 ? '#f6efe2' : '#e9b58a' });
      }
    },
  },
  // Vael II: the almoner's room, rose stone in courses, niches of wax-sealed flasks, a bronze rail of bells over the
  // counter, a table with the knotted ledger and a candle, teal lanterns on the top shelf
  almonry: {
    room: { wall: { color: '#e2aaa2', color2: '#d29890', grid: 0.9 }, floor: '#d9b2a8', ceiling: '#d6a199', lamp: '#ffd28a',
      windows: [{ side: 'left', x: 2.2, y: 2.4, w: 0.8, h: 0.8 }, { side: 'right', x: 4.6, y: 1.2, w: 1.2, h: 1.6 }] },
    counter: { shape: 'box', color: '#9a6a46', top: '#b07a50', band: '#c4903e' },
    heart: { holder: 'box', color: '#a8754e' },
    dress(B, R) {
      for (const s of [-1, 1]) for (const y of [0.55, 1.3, 2.05]) {
        const x = s * 2.3;
        B.add('#c98f86', archSheet(1.7, 0.62, { arch: false }).translate(x, y, -R.d / 2 + 0.19), { soft: true });
        shelf(B, R, x, y, 1.8, '#d6a39a', [RED, RED, '#b8473a']);
        for (let i = 0; i < 6; i++) B.add('#a8322a', new THREE.SphereGeometry(0.045, 6, 4).translate(x - 0.75 + i * 0.3, y + 0.33, -R.d / 2 + 0.36), { soft: true });   // (the wax seals)
      }
      for (let i = 0; i < 4; i++) B.add('#7fe0d0', new THREE.CylinderGeometry(0.08, 0.08, 0.3, 10).translate(-0.6 + i * 0.4, 2.95, -R.d / 2 + 0.36), { soft: true, glow: 0.6 });
      B.add('#d6a39a', block(2.2, 0.06, 0.38, 0, 2.78, -R.d / 2 + 0.36));
      // the bells over the counter on a bronze rail
      B.add('#c4903e', stick([-2.2, 2.75, SHOP_ROOM.counter - 0.1], [2.2, 2.75, SHOP_ROOM.counter - 0.1], 0.025), { soft: true });
      for (const x of [-2.2, 2.2]) B.add('#c4903e', cord(x, R.h, 2.75, SHOP_ROOM.counter - 0.1, 0.015), { soft: true });
      for (let i = 0; i < 7; i++) { const x = -1.8 + i * 0.6; B.add('#c4903e', bell(x, 2.72, SHOP_ROOM.counter - 0.1, 0.09 + (i % 3) * 0.015), { soft: true }); }
      // the ledger table: knotted cords over an open book, a candle, the seal and its wax pot
      B.add('#7a5236', block(1.6, 0.85, 0.8, 2.6, 0, 1.6));
      B.add('#f1e6cf', block(0.8, 0.05, 0.5, 2.5, 0.85, 1.6), { soft: true });
      for (let i = 0; i < 6; i++) B.add(i % 2 ? '#c9a6a0' : '#a8b4c8', stick([2.2 + i * 0.1, 0.9, 1.45], [2.2 + i * 0.1, 0.5, 2.0], 0.01), { soft: true });
      B.add('#f6ecd8', new THREE.CylinderGeometry(0.04, 0.04, 0.22, 8).translate(3.15, 0.96, 1.4), { soft: true });
      B.add('#ffd27a', new THREE.SphereGeometry(0.035, 6, 4).translate(3.15, 1.1, 1.4), { soft: true, glow: 1 });
      B.add('#5a4a4a', new THREE.CylinderGeometry(0.12, 0.1, 0.12, 10).translate(3.05, 0.91, 1.85), { soft: true });
      B.add('#f2ece0', new THREE.SphereGeometry(0.12, 8, 6).scale(1, 1.4, 0.4).translate(-R.w / 2 + 0.25, 2.6, -1.6), { soft: true });   // (a little saint in a niche)
    },
  },
  // Lorn: the raft-house: grey planks and reed bundles under the thatch, a hatch in the floor showing the water,
  // a plank counter on two barrels, knot cords hung like a ledger, nets and shelves of jars, flasks hung by their
  // necks, a violet crystal lamp and a jar of fireflies, a snapping plant in a pot with its jaws shut
  raft: {
    room: { w: 7.6, d: 6.6, h: 3.9, wall: { color: '#9d978c', color2: '#8a857b', grid: 0.32 }, floor: '#8d8579', ceiling: '#a88f5c', lamp: '#b48cff',
      windows: [{ side: 'left', x: 3.3, y: 1.2, w: 0.9, h: 0.9 }] },
    counter: { shape: 'plank', color: '#8a7a66', top: '#9b8a72', w: 4.8 },
    heart: { holder: 'basket', color: '#a88a52' },
    dress(B, R) {
      B.add('#24465c', new THREE.PlaneGeometry(1.2, 1.0).rotateX(-Math.PI / 2).translate(-2.4, 0.05, 1.9), { soft: true, glow: 0.25 });
      B.add('#5a4a3a', block(1.35, 0.06, 0.08, -2.4, 0.04, 2.45), { soft: true }); B.add('#5a4a3a', block(1.35, 0.06, 0.08, -2.4, 0.04, 1.35), { soft: true });
      for (const [x, z] of [[-R.w / 2 + 0.3, -R.d / 2 + 0.3], [R.w / 2 - 0.3, -R.d / 2 + 0.3], [-R.w / 2 + 0.3, R.d / 2 - 0.3], [R.w / 2 - 0.3, R.d / 2 - 0.3]]) B.add('#bba468', new THREE.CylinderGeometry(0.22, 0.24, R.h, 8).translate(x, R.h / 2, z));
      for (const [x, y, w] of [[-2.4, 1.2, 1.6], [-2.4, 1.9, 1.6], [2.4, 1.3, 1.6], [2.4, 2.1, 1.6], [0, 2.5, 1.4]]) shelf(B, R, x, y, w, '#7d705e', ['#7f9a5a', '#b07ab0', '#c9a24a', '#8a9a6a']);
      // knot cords hanging from a peg like a ledger
      B.add('#5a4a3a', block(1.0, 0.08, 0.08, 0.0, 2.05, -R.d / 2 + 0.25));
      for (let i = 0; i < 7; i++) { const x = -0.42 + i * 0.14, l = 0.6 + (i % 3) * 0.2; B.add('#c9b07a', cord(x, 2.05, 2.05 - l, -R.d / 2 + 0.28, 0.01), { soft: true }); for (let k = 1; k < 4; k++) B.add('#a8905a', new THREE.SphereGeometry(0.025, 5, 4).translate(x, 2.05 - k * l / 4, -R.d / 2 + 0.28), { soft: true }); }
      // flasks hung by their necks, the violet crystal lamp, the fireflies' jar, the snapping plant
      for (let i = 0; i < 5; i++) hang(B, R, 1.6 + i * 0.3, -R.d / 2 + 0.7, 0.8 + (i % 2) * 0.25, 'flask');
      B.add('#b48cff', lathe([[0.01, 0], [0.16, 0.1], [0.18, 0.32], [0.08, 0.5], [0.01, 0.52]], 7).translate(0.6, R.h - 1.2, 0.4), { soft: true, glow: 1 });
      B.add(INK, cord(0.6, R.h, R.h - 0.68, 0.4), { soft: true });
      B.add('#ffd96a', new THREE.CylinderGeometry(0.11, 0.11, 0.24, 10).translate(-0.9, TOP + 0.12, SHOP_ROOM.counter - 0.15), { soft: true, glow: 0.9 });
      B.add('#8a5a3c', new THREE.CylinderGeometry(0.16, 0.12, 0.22, 10).translate(2.1, TOP + 0.11, SHOP_ROOM.counter - 0.1));
      for (const s of [-1, 1]) B.add('#6f8a3a', new THREE.ConeGeometry(0.12, 0.3, 6).rotateZ(s * 0.5).translate(2.1 + s * 0.07, TOP + 0.38, SHOP_ROOM.counter - 0.1), { soft: true });
      // nets with jars on the right wall
      for (let i = 0; i < 5; i++) B.add(INK, stick([R.w / 2 - 0.2, 3.2, -1.5 + i * 0.5], [R.w / 2 - 0.2, 1.4, -1.2 + i * 0.5], 0.006), { soft: true });
      for (const z of [-1.3, -0.6, 0.1]) B.add('#8a9a6a', lathe([[0.01, 0], [0.1, 0.02], [0.12, 0.2], [0.08, 0.26]], 8).translate(R.w / 2 - 0.3, 1.9, z), { soft: true });
    },
  },
  // Lorn II: the moss dome: mossy walls ribbed with roots, warm lamps, a curved wooden counter with a teapot and
  // cups, an alcove of shelves with lidded jars, flasks and vials' cousins, a round window, a bed in the corner
  mossdome: {
    room: { wall: { color: '#8fa060', color2: '#7a8f52', grid: 0 }, floor: '#cfc6b4', ceiling: '#7d8f55', lamp: '#ffd98a',
      windows: [{ side: 'right', x: 2.6, y: 1.1, w: 1.6, h: 1.6 }],
      furniture: [['rug', 0, 1.6, 0, '#4f6f9e', '#4f6f9e'], ['bed', -3.2, 2.1, 0, '#8a6a4a', '#5f7aae']] },
    counter: { shape: 'curved', color: '#a0703f', top: '#b98652', band: '#d6a13e', bulge: 0.45 },
    heart: { holder: 'jar', color: '#a8754e' },
    dress(B, R) {
      for (const y of [1.3, 1.85, 2.4, 2.95]) shelf(B, R, 0, y, 4.2, '#8a5a32', y < 2 ? [RED, RED, '#efe6d0'] : ['#efe6d0', '#d8cfb6', RED]);
      B.add('#5a4a32', archSheet(4.6, 3.6).translate(0, 0.9, -R.d / 2 + 0.18), { soft: true });
      // roots arching over the walls
      for (const z of [-2.6, -0.6, 1.4]) for (const s of [-1, 1]) {
        B.add('#6a5a3a', stick([sideX(R, s, 0.22), 0, z], [sideX(R, s, 0.5), R.h - 0.1, z + 0.4], 0.09), { soft: true });
        B.add('#6a5a3a', stick([sideX(R, s, 0.5), R.h - 0.1, z + 0.4], [0, R.h - 0.08, z + 0.2], 0.07), { soft: true });
      }
      B.add('#6a5a3a', new THREE.TorusGeometry(R.w / 2 - 0.3, 0.07, 4, 24, Math.PI).scale(1, (R.h - 0.6) / (R.w / 2 - 0.3), 1).translate(0, 0.3, -R.d / 2 + 0.25), { soft: true });
      // warm lamps on the walls, a teapot and cups on the counter
      for (const [x, z] of [[-R.w / 2 + 0.3, -1.6], [R.w / 2 - 0.3, -1.6], [-R.w / 2 + 0.3, 0.8]]) B.add('#ffe39a', new THREE.SphereGeometry(0.14, 10, 8).translate(x, 2.3, z), { soft: true, glow: 1 });
      B.add('#efe6d8', new THREE.SphereGeometry(0.13, 12, 8).scale(1, 0.8, 1).translate(1.95, TOP + 0.1, SHOP_ROOM.counter + 0.05), { soft: true });
      B.add('#efe6d8', stick([2.05, TOP + 0.1, SHOP_ROOM.counter + 0.05], [2.25, TOP + 0.2, SHOP_ROOM.counter + 0.05], 0.02), { soft: true });
      for (const x of [2.35, 2.55]) B.add('#efe6d8', new THREE.CylinderGeometry(0.05, 0.04, 0.06, 8).translate(x, TOP + 0.03, SHOP_ROOM.counter + 0.25), { soft: true });
      B.add('#d6a13e', stick([-2.3, TOP, SHOP_ROOM.counter - 0.1], [-2.0, TOP + 0.9, SHOP_ROOM.counter - 0.2], 0.015), { soft: true });
      B.add('#ffe39a', new THREE.SphereGeometry(0.08, 8, 6).translate(-1.95, TOP + 0.92, SHOP_ROOM.counter - 0.2), { soft: true, glow: 1 });
    },
  },
  // Viridel: the potting house: white panelled walls under the builders' slab, a wooden workbench, shelves of
  // glass bell jars with seedlings, teal glass globes hanging with ferns, pots of plants, a watering can, the
  // makers’ mark (three dots over an arc) drawn on the back wall
  potting: {
    room: { wall: { color: '#f1eee6', color2: '#e3dfd3', grid: 1.2 }, floor: '#e8e4da', ceiling: '#f4f2ea', lamp: '#d8f4ee',
      windows: [{ side: 'left', x: 3.5, y: 0.8, w: 2.4, h: 2.4 }, { side: 'right', x: 3.5, y: 0.8, w: 1.6, h: 2.0 }],
      furniture: [['pot', -3.4, 2.7], ['pot', 3.4, 2.6], ['pot', -3.4, -0.4], ['pot', 3.4, -0.2]] },
    counter: { shape: 'box', color: '#b08458', top: '#c49a6c', panels: '#9a7048' },
    heart: { holder: 'pot', color: '#c8673f' },
    dress(B, R) {
      for (const s of [-1, 1]) for (const y of [1.5, 2.3]) {
        const x = s * 2.3, z = -R.d / 2 + 0.36;
        B.add('#e6e0d2', block(2.0, 0.05, 0.38, x, y, z));
        for (let i = 0; i < 4; i++) {
          const bx = x - 0.75 + i * 0.5;
          if ((i + (y > 2 ? 1 : 0)) % 2) { B.add('#dff1ee', lathe([[0.13, 0], [0.13, 0.26], [0.09, 0.36], [0.02, 0.39], [0.02, 0.44]], 10).translate(bx, y + 0.05, z), { soft: true, glow: 0.12 }); B.add('#6f9a5a', new THREE.ConeGeometry(0.08, 0.2, 6).translate(bx, y + 0.15, z), { soft: true }); }
          else bottles(B, bx - 0.12, bx + 0.12, y + 0.05, z, [RED, '#cfe3c0'], { n: 1 });
        }
      }
      // the makers’ mark: three little rings over an arc
      for (const k of [-1, 0, 1]) B.add('#b8b2a4', new THREE.TorusGeometry(0.08, 0.018, 4, 14).translate(k * 0.24, 3.6 + (k ? 0 : 0.06), -R.d / 2 + 0.19), { soft: true });
      B.add('#b8b2a4', new THREE.TorusGeometry(0.75, 0.022, 4, 20, Math.PI).translate(0, 2.55, -R.d / 2 + 0.19), { soft: true });
      // hanging glass globes and ferns
      for (const [x, z, what] of [[-1.6, 1.0, 'lamp'], [1.6, 1.0, 'lamp'], [-2.8, -2.2, 'fern'], [2.8, -2.2, 'fern'], [0, 2.2, 'fern']]) {
        if (what === 'lamp') hang(B, R, x, z, 0.9, 'lamp', { color: '#8fe3d8', size: 0.24 });
        else { B.add(INK, cord(x, R.h, R.h - 0.8, z), { soft: true }); B.add('#c8673f', new THREE.CylinderGeometry(0.2, 0.14, 0.18, 10).translate(x, R.h - 0.9, z), { soft: true }); B.add('#6f9a5a', new THREE.SphereGeometry(0.3, 8, 5).scale(1, 0.6, 1).translate(x, R.h - 0.72, z), { soft: true }); }
      }
      B.add('#8a9a8a', new THREE.CylinderGeometry(0.12, 0.13, 0.22, 10).translate(1.95, TOP + 0.11, SHOP_ROOM.counter), { soft: true });
      B.add('#8a9a8a', stick([2.05, TOP + 0.08, SHOP_ROOM.counter], [2.35, TOP + 0.24, SHOP_ROOM.counter], 0.02), { soft: true });
      for (const [x, c] of [[-2.35, '#e98fb0'], [2.4, '#f2c94c']]) B.add(c, new THREE.SphereGeometry(0.06, 6, 4).translate(x, TOP + 0.04, SHOP_ROOM.counter + 0.2), { soft: true });
    },
  },
  // The City-Shaft: Fausta's narrow shop: cream plaster, terracotta tiles, a marble counter with panels and a brass
  // rail, a wall of drawers and shelves of flasks with a rolling ladder, a basket on its rope over the counter with
  // a bell, tall shuttered windows over the void
  basket: {
    room: { w: 7.2, d: 7, h: 4.6, wall: { color: '#efe2cc', color2: '#e2d0b6', grid: 0 }, floor: '#c97a5a', ceiling: '#f2e8d6', lamp: '#ffe2a0',
      windows: [{ side: 'left', x: 3.2, y: 0.4, w: 1.6, h: 3.0 }] },
    counter: { shape: 'box', color: '#efe6da', top: '#f6f0e6', panels: '#ded2c0', trim: '#d6a13e', w: 4.6 },
    heart: { holder: 'box', color: '#5a3a5a' },
    dress(B, R) {
      // the wall of drawers and shelves on the right, its rolling ladder
      const rx = R.w / 2 - 0.3;
      B.add('#9c5a44', block(0.5, 1.2, 4.6, rx, 0, -1.0));
      for (let i = 0; i < 8; i++) for (let k = 0; k < 3; k++) B.add('#d6a13e', new THREE.SphereGeometry(0.025, 5, 4).translate(rx - 0.26, 0.25 + k * 0.38, -3.0 + i * 0.55), { soft: true });
      for (const y of [1.7, 2.3, 2.9, 3.5]) { B.add('#8a4a36', block(0.4, 0.05, 4.6, rx + 0.05, y, -1.0)); for (let i = 0; i < 9; i++) { const f = flask(rx, y + 0.05, -3.0 + i * 0.5, 0.95); B.add(i % 3 ? RED : '#e8e0cc', f.glass, { soft: true }); } }
      for (const s of [-1, 1]) B.add('#c9973e', stick([rx - 0.7, 0, 0.2 + s * 0.25], [rx - 0.35, 4.0, 0.2 + s * 0.25], 0.025), { soft: true });
      for (let k = 0; k < 9; k++) B.add('#c9973e', stick([rx - 0.68 + k * 0.035, 0.3 + k * 0.42, -0.05], [rx - 0.68 + k * 0.035, 0.3 + k * 0.42, 0.45], 0.015), { soft: true });
      // the basket on its rope through the ceiling, a bell on the rope
      B.add(INK, cord(0.65, R.h, TOP + 0.95, SHOP_ROOM.counter + 0.05, 0.012), { soft: true });
      B.add('#c7a56a', lathe([[0.22, 0], [0.3, 0.05], [0.34, 0.3]], 12).translate(0.65, TOP + 0.62, SHOP_ROOM.counter + 0.05), { soft: true });
      B.add('#c9973e', bell(0.65, 2.4, SHOP_ROOM.counter + 0.05, 0.07), { soft: true });
      // shutters by the tall window, a mortar on the counter, shelves behind
      for (const s of [-1, 1]) B.add('#7c9a78', block(0.06, 3.0, 0.8, -R.w / 2 + 0.22, 0.4, 0.4 + s * 1.2), { soft: true });
      B.add('#d6a13e', lathe([[0.06, 0], [0.14, 0.04], [0.16, 0.14]], 10).translate(1.9, TOP, SHOP_ROOM.counter), { soft: true });
      for (const y of [1.4, 2.1, 2.8]) shelf(B, R, -1.4, y, 2.4, '#8a4a36', [RED, '#e8e0cc', RED]);
    },
  },
  // The Sealed Hangar: the quartermaster's store: riveted grey-green plate under an arched ceiling with brass pipes,
  // a metal counter with brass trim, the stamp and the requisitions, shelf units of crates, flasks in wire racks,
  // a glass cabinet, clocks and gauges on the wall, a lamp hung over the counter
  kiosk: {
    room: { wall: { color: '#aab49e', color2: '#9aa48e', grid: 0.9 }, floor: '#a9aca2', ceiling: '#9aa492', lamp: '#ffe6a0' },
    counter: { shape: 'box', color: '#a3b09a', top: '#b4c0aa', band: '#c9973e', trim: '#c9973e' },
    heart: { holder: 'box', color: '#5f7a9a' },
    dress(B, R) {
      const bz = -R.d / 2 + 0.2;
      for (const x of [-2.4, 0, 2.4]) {
        B.add('#8e9a84', block(2.2, 3.4, 0.08, x, 0, bz));
        for (const s of [-1, 1]) B.add('#8e9a84', block(0.06, 3.4, 0.45, x + s * 1.07, 0, bz + 0.22));
        for (const y of [0.9, 1.7, 2.5]) B.add('#b4bfa8', block(2.1, 0.05, 0.42, x, y, bz + 0.24));
        for (let i = 0; i < 3; i++) B.add('#b9c4ae', block(0.55, 0.42, 0.36, x - 0.7 + i * 0.7, 2.55, bz + 0.24), { soft: true });
      }
      bottles(B, -3.3, -1.5, 1.75, bz + 0.24, [RED]);
      bottles(B, 1.5, 3.3, 0.95, bz + 0.24, [RED, RED, '#e8e0cc']);
      for (let i = 0; i < 4; i++) B.add('#7fe0b8', new THREE.CylinderGeometry(0.06, 0.06, 0.32, 8).translate(-0.6 + i * 0.4, 1.11, bz + 0.24), { soft: true, glow: 0.5 });
      B.add('#dff1ee', block(1.9, 0.75, 0.03, 0, 0.92, bz + 0.47), { soft: true, glow: 0.08 });
      // the arched ceiling's brass pipes, the clocks and gauges on the right wall
      for (const s of [-1, 1]) B.add('#c9973e', stick([s * 1.4, R.h - 0.15, -R.d / 2 + 0.2], [s * 1.4, R.h - 0.15, R.d / 2 - 0.2], 0.05), { soft: true });
      for (const z of [-1.2, 1.0]) { B.add('#f2ead8', new THREE.CylinderGeometry(0.28, 0.28, 0.05, 16).rotateZ(Math.PI / 2).translate(R.w / 2 - 0.2, 2.6, z), { soft: true }); B.add('#c9973e', new THREE.TorusGeometry(0.28, 0.03, 4, 16).rotateY(Math.PI / 2).translate(R.w / 2 - 0.2, 2.6, z), { soft: true }); }
      B.add('#c9973e', stick([R.w / 2 - 0.2, 1.2, 0.0], [R.w / 2 - 0.2, 2.2, 0.0], 0.05), { soft: true });
      // the stamp and the requisitions on the counter, the lamp over it
      B.add('#f1e6cf', block(0.5, 0.06, 0.36, 1.95, TOP, SHOP_ROOM.counter), { soft: true });
      B.add('#7a4a2a', new THREE.CylinderGeometry(0.04, 0.05, 0.12, 8).translate(2.45, TOP + 0.06, SHOP_ROOM.counter + 0.05), { soft: true });
      hang(B, R, 0, SHOP_ROOM.counter + 0.4, 1.3, 'lamp', { size: 0.16 });
    },
  },
  // The Buried Machine: inside the riveted dome: lavender-grey plate on riveted ribs, sand on the floor, a skylight,
  // a counter whose foot is a ring of gear teeth with the gear-tooth abacus on it, a shelf of tall flasks, a big
  // rusty gear and a row of small ones on hooks, brass lanterns
  rivetdome: {
    room: { wall: { color: '#a7a9c4', color2: '#9a9cb8', grid: 0 }, floor: '#e2cc9f', ceiling: '#9fa2bd', lamp: '#ffcf7a', oculus: 1.8 },
    counter: { shape: 'curved', color: '#9a8c86', top: '#b9aaa0', band: '#a8742a', bulge: 0.35, teeth: '#a8644a' },
    heart: { holder: 'jar', color: '#a8742a' },
    dress(B, R) {
      for (const z of [-2.8, -1.0, 0.8, 2.6]) { for (const s of [-1, 1]) B.add('#8d93ad', block(0.12, R.h, 0.14, sideX(R, s, 0.24), 0, z), { soft: true }); B.add('#8d93ad', block(R.w - 0.4, 0.14, 0.14, 0, R.h - 0.16, z), { soft: true }); }
      for (const x of [-3.0, -1.0, 1.0, 3.0]) B.add('#8d93ad', block(0.14, R.h, 0.12, x, 0, -R.d / 2 + 0.24), { soft: true });
      shelf(B, R, -0.3, 2.45, 4.4, '#9a8c86', [RED, RED, RED, '#e8e0cc']);
      for (let i = 0; i < 3; i++) B.add('#c9973e', new THREE.CylinderGeometry(0.1, 0.12, 0.42, 10).translate(1.2 + i * 0.35, 2.72, -R.d / 2 + 0.36), { soft: true });
      // the big rusty gear and the small ones on hooks
      B.add('#b8643a', gear(1.1, 18, 0.12, 0.2).rotateY(-Math.PI / 2).translate(R.w / 2 - 0.25, 2.2, -1.0), { soft: true });
      for (let i = 0; i < 6; i++) B.add('#b07a3a', gear(0.14, 8, 0.04, 0.3).rotateY(-Math.PI / 2).translate(R.w / 2 - 0.22, 1.25, 0.3 + i * 0.4), { soft: true });
      // the abacus of gear teeth on the counter, brass lanterns on the walls
      B.add('#8a6a3a', block(0.7, 0.04, 0.24, -1.0, TOP, SHOP_ROOM.counter - 0.1), { soft: true });
      for (let r = 0; r < 3; r++) for (let k = 0; k < 5; k++) B.add('#c9973e', new THREE.CylinderGeometry(0.035, 0.035, 0.03, 8).translate(-1.25 + k * 0.08 + r * 0.06, TOP + 0.06, SHOP_ROOM.counter - 0.18 + r * 0.08), { soft: true });
      for (const [x, z] of [[-R.w / 2 + 0.3, -1.5], [R.w / 2 - 0.3, 1.6], [-R.w / 2 + 0.3, 1.2]]) { B.add('#ffcf7a', new THREE.CylinderGeometry(0.1, 0.1, 0.28, 8).translate(x, 2.2, z), { soft: true, glow: 1 }); B.add('#c9973e', new THREE.ConeGeometry(0.14, 0.12, 8).translate(x, 2.42, z), { soft: true }); }
    },
  },
  // The Garden of Spheres: the listening room: white, open to the meadow on the left through tall windows between
  // columns, a round counter with a basin of water, tuning forks on a brass rail, glass bells on a high ledge,
  // flasks set out on a white bench
  pavilion: {
    room: { wall: { color: '#f3efe8', color2: '#e8e2d8', grid: 0 }, floor: '#ebe5da', ceiling: '#f6f2ec', lamp: '#fff1d0',
      windows: [{ side: 'left', x: 1.6, y: 0.9, w: 1.6, h: 2.5 }, { side: 'left', x: 4.4, y: 0.9, w: 1.6, h: 2.5 }] },
    counter: { shape: 'curved', color: '#f1ece4', top: '#f8f5f0', bulge: 0.55, basin: 2.15 },
    heart: { holder: 'cushion', color: '#cfc7b8' },
    dress(B, R) {
      for (const z of [-3.0, -0.2, 2.6]) B.add('#f8f5f0', new THREE.CylinderGeometry(0.16, 0.18, R.h, 12).translate(-R.w / 2 + 0.35, R.h / 2, z));
      // the tuning forks on the right wall
      B.add('#c9a24a', stick([R.w / 2 - 0.2, 2.9, -2.6], [R.w / 2 - 0.2, 2.9, 1.6], 0.02), { soft: true });
      for (let i = 0; i < 9; i++) {
        const z = -2.4 + i * 0.48, l = 0.45 + (i % 4) * 0.15;
        for (const s of [-1, 1]) B.add('#c9a24a', stick([R.w / 2 - 0.22, 2.9 - l, z + s * 0.05], [R.w / 2 - 0.22, 2.95, z + s * 0.05], 0.012), { soft: true });
        B.add('#c9a24a', stick([R.w / 2 - 0.22, 2.9 - l, z], [R.w / 2 - 0.22, 2.9 - l - 0.25, z], 0.014), { soft: true });
      }
      // the glass bells on the high ledge, flasks on the white bench along the left
      B.add('#f8f5f0', block(R.w - 1, 0.08, 0.3, 0, 3.4, -R.d / 2 + 0.33));
      for (let i = 0; i < 9; i++) B.add('#dcefee', lathe([[0.1, 0], [0.1, 0.18], [0.06, 0.26], [0.01, 0.28]], 10).translate(-3.2 + i * 0.8, 3.48, -R.d / 2 + 0.33), { soft: true, glow: 0.2 });
      B.add('#f1ece4', block(0.6, 0.45, 3.0, -R.w / 2 + 0.6, 0, 0.9));
      bottles(B, -R.w / 2 + 0.45, -R.w / 2 + 0.75, 0.45, 0.9, [RED], { n: 1 });
      for (let i = 0; i < 5; i++) { const f = flask(-R.w / 2 + 0.6, 0.45, -0.3 + i * 0.55, 1.15); B.add(RED, f.glass, { soft: true }); B.add(CORK, f.cork, { soft: true }); }
      B.add('#c9a24a', stick([-2.35, TOP, SHOP_ROOM.counter - 0.05], [-2.35, TOP + 0.35, SHOP_ROOM.counter - 0.05], 0.012), { soft: true });
    },
  },
  // The Signal Market: inside Pashka's stall: teal plate, glowing screens of hearts and flasks, red flasks hung on
  // cords, coral growing in the corners, a teal counter with lit cabinet windows, a brass lamp, a ceiling fan
  stall: {
    room: { wall: { color: '#5f9e94', color2: '#548d84', grid: 0.8 }, floor: '#e9dcc0', ceiling: '#4f8a80', lamp: '#ffd98a' },
    counter: { shape: 'box', color: '#5aa79c', top: '#cfe0d4', panels: '#f6dc9e' },
    heart: { holder: 'box', color: '#f3cbc6' },
    dress(B, R) {
      for (const [x, y, w, h] of [[-2.4, 2.3, 1.5, 0.9], [-0.7, 2.3, 1.4, 0.9], [1.6, 2.4, 1.8, 1.1], [-1.6, 1.25, 1.2, 0.7]]) {
        B.add('#bff3e6', block(w, h, 0.04, x, y, -R.d / 2 + 0.2), { soft: true, glow: 0.7 });
        B.add('#3f8f86', heartGeo(h * 0.5).scale(1, 1, 0.1).translate(x - w * 0.22, y + h / 2, -R.d / 2 + 0.24), { soft: true });
        B.add('#3f8f86', lathe([[0.01, 0], [0.12, 0.02], [0.13, 0.14], [0.05, 0.24], [0.04, 0.3]], 10).scale(h * 1.4, h * 1.4, 0.1).translate(x + w * 0.22, y + h * 0.25, -R.d / 2 + 0.24), { soft: true });
      }
      for (let i = 0; i < 8; i++) hang(B, R, -3.4 + (i % 4) * 0.35, -2.2 + Math.floor(i / 4) * 0.6, 1.1 + (i % 3) * 0.3, 'flask', { size: 1.2 });
      // coral in the corners
      for (const [x, z] of [[-R.w / 2 + 0.5, 2.6], [R.w / 2 - 0.5, -2.8], [R.w / 2 - 0.6, 2.7]]) for (let k = 0; k < 5; k++) B.add('#e48a86', new THREE.ConeGeometry(0.07, 0.9 + k * 0.15, 5).rotateZ((k - 2) * 0.3).rotateY(k).translate(x + (k - 2) * 0.12, 0.45 + k * 0.07, z), { soft: true });
      // a brass lamp, the fan, the shelves of flasks on the right
      hang(B, R, -0.4, SHOP_ROOM.counter + 0.3, 1.0, 'lamp', { size: 0.15, color: '#ffd98a' });
      for (const a of [0, Math.PI / 2]) B.add('#c9973e', new THREE.BoxGeometry(1.4, 0.03, 0.18).rotateY(a + 0.3).translate(1.6, R.h - 0.35, 1.2), { soft: true });
      for (const y of [1.2, 1.9, 2.6]) { B.add('#478e84', block(0.4, 0.05, 2.4, R.w / 2 - 0.3, y, -1.4)); for (let i = 0; i < 6; i++) { const f = flask(R.w / 2 - 0.3, y + 0.05, -2.4 + i * 0.4, 1.1); B.add(RED, f.glass, { soft: true }); B.add(CORK, f.cork, { soft: true }); } }
    },
  },
  // ---- the three worlds that joined the route in v1.40
  // The Underwater City: inside Odette's shell house: teal plaster lined warm, a round window onto the dark water with
  // a fish going by, glass floats hung in a net, a curved coral counter, jars of glow-kelp on the shelves
  bubble: {
    room: { wall: { color: '#4f8d94', color2: '#467f86', grid: 0 }, floor: '#e08a5a', ceiling: '#3d727a', lamp: '#ffcf96',
      windows: [{ side: 'right', x: 3.2, y: 1.1, w: 1.8, h: 1.8 }] },
    counter: { shape: 'curved', color: '#e89a86', top: '#f6c2b0', band: '#3d727a', bulge: 0.3 },
    heart: { holder: 'jar', color: '#3d727a' },
    dress(B, R) {
      shelf(B, R, -1.4, 2.35, 3.6, '#d98a7a', [RED, '#9fe0e4', RED]);
      for (let i = 0; i < 5; i++) B.add('#7fe0b8', new THREE.CylinderGeometry(0.09, 0.09, 0.3, 8).translate(1.2 + i * 0.36, 2.56, -R.d / 2 + 0.36), { soft: true, glow: 0.6 });
      for (let i = 0; i < 9; i++) hang(B, R, -3.2 + (i % 3) * 0.4, -2.4 + Math.floor(i / 3) * 0.45, 0.6 + (i % 2) * 0.35, 'lamp', { size: 0.12, color: '#9fe0e4' });
      // the brass diving helmet on a stand by the window, a coil of air-hose
      B.add(BRASS, new THREE.SphereGeometry(0.32, 12, 8).translate(R.w / 2 - 0.6, 1.5, 1.5), { soft: true });
      B.add('#3d727a', new THREE.CylinderGeometry(0.08, 0.12, 1.2, 8).translate(R.w / 2 - 0.6, 0.6, 1.5));
      B.add('#5a4a44', new THREE.TorusGeometry(0.35, 0.06, 6, 16).rotateX(Math.PI / 2).translate(R.w / 2 - 0.8, 0.08, 2.4), { soft: true });
      hang(B, R, -0.2, SHOP_ROOM.counter + 0.3, 1.1, 'lamp', { size: 0.16, color: '#ffcf96' });
    },
  },
  // The Moon Foundry: inside the crucible: rust walls in plates, a round floor, a slot of light from the spout, a
  // counter cast in one piece with ingots for its foot, a row of tiny unfinished moons on a shelf, a ladle on the wall
  crucible: {
    room: { wall: { color: '#b8653c', color2: '#a85a33', grid: 1.2 }, floor: '#5a4a44', ceiling: '#8a4a2e', lamp: '#ffb46a', oculus: 1.4 },
    counter: { shape: 'box', color: '#6a4a3a', top: '#8a5a3a', band: '#d6a13e', trim: '#d6a13e' },
    heart: { holder: 'box', color: '#8a5a3a' },
    dress(B, R) {
      shelf(B, R, -1.5, 2.3, 3.4, '#6a4a3a');
      for (let i = 0; i < 7; i++) B.add('#efe4cc', new THREE.SphereGeometry(0.11 + (i % 3) * 0.03, 10, 8).translate(-3.0 + i * 0.5, 2.48, -R.d / 2 + 0.36), { soft: true });
      shelf(B, R, 1.8, 1.6, 2.4, '#6a4a3a', [RED, RED, '#e8e0cc']);
      // the ladle on the right wall, ingots stacked by the counter, a brass lantern
      B.add('#4a3a33', lathe([[0.01, 0], [0.4, 0.05], [0.45, 0.4]], 12).rotateZ(Math.PI / 2).translate(R.w / 2 - 0.15, 2.0, -0.6), { soft: true, side: THREE.DoubleSide });
      B.add('#4a3a33', stick([R.w / 2 - 0.2, 2.0, -0.6], [R.w / 2 - 0.2, 3.4, 0.4], 0.04), { soft: true });
      for (let i = 0; i < 4; i++) B.add('#a8a29a', block(0.5, 0.16, 0.22, -R.w / 2 + 0.8, i * 0.17, 1.6 + (i % 2) * 0.1));
      hang(B, R, 0.3, SHOP_ROOM.counter + 0.4, 1.2, 'lamp', { size: 0.15, color: '#ffb46a' });
    },
  },
  // The City Floating in Space: inside Amaro's house: cream walls, a vaulted ceiling hung with lamps of every kind, a
  // round window full of stars, a salmon counter, jars of lamp oil on the shelves
  adobe: {
    room: { wall: { color: '#f2e2c4', color2: '#e6d2ae', grid: 0 }, floor: '#d9a07e', ceiling: '#efdcb8', lamp: '#ffe0a8',
      windows: [{ side: 'left', x: 3.0, y: 1.2, w: 1.5, h: 1.5 }] },
    counter: { shape: 'curved', color: '#e89a7e', top: '#f6dcc4', band: '#3f6f78', bulge: 0.35 },
    heart: { holder: 'basket', color: '#c98a5a' },
    dress(B, R) {
      shelf(B, R, 0, 2.3, 5.0, '#c98a5a', ['#f2c45a', RED, '#f2c45a', '#e8e0cc']);
      for (let i = 0; i < 12; i++) hang(B, R, -3.2 + (i % 6) * 1.2, -2.2 + Math.floor(i / 6) * 3.2, 0.7 + ((i * 5) % 4) * 0.2, 'lamp', { size: 0.12 + (i % 3) * 0.03, color: i % 2 ? '#ffe39a' : '#ffd0a0' });
      // stars through the round window: a dark disc with a few bright points
      B.add('#0a0f18', new THREE.CircleGeometry(0.72, 18).rotateY(Math.PI / 2).translate(-R.w / 2 + 0.06, 1.95, 3.0), { soft: true });
      for (let i = 0; i < 6; i++) B.add('#f6f2e4', new THREE.CircleGeometry(0.035, 5).rotateY(Math.PI / 2).translate(-R.w / 2 + 0.07, 1.6 + (i * 0.37) % 0.8, 2.6 + (i * 0.29) % 0.8), { soft: true, glow: 1 });
      B.add('#3f6f78', stick([-1.0, TOP, SHOP_ROOM.counter - 0.1], [-1.0, TOP + 0.4, SHOP_ROOM.counter - 0.1], 0.02), { soft: true });
      B.add('#ffe39a', new THREE.SphereGeometry(0.1, 8, 6).translate(-1.0, TOP + 0.48, SHOP_ROOM.counter - 0.1), { soft: true, glow: 1 });
    },
  },
};

// ------------------------------------------------------------------ the wares on the counter

/**
 * The wares laid out on the counter, one mesh per piece so what is sold goes from the display: corked flasks
 * (as many as the shelf holds), a heart container on what holds it (`holder`) for each of three places, and a
 * magic cell in its brass cradle for each of three.
 */
function layWares(grp, cz, holder = { holder: 'cushion', color: '#8a6fb8' }) {
  const display = { potion: [], heart: [], magic: [] };
  const piece = (geos, color, o = {}) => { const m = new THREE.Mesh(mergeGeometries(geos), makeMaterial({ color, flat: true, ...o })); m.userData.noCollide = true; grp.add(m); return m; };
  for (let i = 0; i < SHELF.potions; i++) {
    const x = -1.95 + i * 0.26, z = cz + 0.05 + (i % 2) * 0.12;
    const red = piece([lathe([[0.01, 0], [0.1, 0.02], [0.11, 0.12], [0.05, 0.2], [0.035, 0.21]], 12).translate(x, TOP, z)], RED);
    red.add(piece([new THREE.CylinderGeometry(0.035, 0.03, 0.08, 8).translate(x, TOP + 0.25, z)], CORK));
    display.potion.push(red);
  }
  const heart = heartGeo(0.26);
  for (let i = 0; i < 3; i++) {
    const x = -0.35 + i * 0.35, z = cz + 0.05, c = holder.color;
    const h = piece([heart.clone().translate(x, TOP + 0.26, z)], RED);
    if (holder.holder === 'cushion') h.add(piece([new THREE.BoxGeometry(0.28, 0.07, 0.24).translate(x, TOP + 0.035, z)], c));
    if (holder.holder === 'cloth') h.add(piece([new THREE.BoxGeometry(0.3, 0.03, 0.26).translate(x, TOP + 0.015, z)], c));
    if (holder.holder === 'box') h.add(piece([new THREE.BoxGeometry(0.3, 0.09, 0.26).translate(x, TOP + 0.045, z), new THREE.BoxGeometry(0.3, 0.26, 0.03).rotateX(-0.35).translate(x, TOP + 0.2, z - 0.16)], c));
    if (holder.holder === 'basket') h.add(piece([lathe([[0.1, 0], [0.15, 0.04], [0.16, 0.14]], 10).translate(x, TOP, z)], c));
    if (holder.holder === 'pot') h.add(piece([new THREE.CylinderGeometry(0.13, 0.1, 0.14, 10).translate(x, TOP + 0.07, z)], c));
    if (holder.holder === 'jar') {   // (a bell jar drawn as its brass frame: the heart shows through)
      h.add(piece([new THREE.CylinderGeometry(0.15, 0.16, 0.04, 12).translate(x, TOP + 0.02, z)], c));
      const bars = [0, 1, 2, 3].map((k) => { const a = k * Math.PI / 2 + 0.6; return stick([x + Math.cos(a) * 0.14, TOP + 0.04, z + Math.sin(a) * 0.14], [x + Math.cos(a) * 0.1, TOP + 0.52, z + Math.sin(a) * 0.1], 0.008); });
      h.add(piece([...bars, new THREE.TorusGeometry(0.1, 0.012, 4, 14).rotateX(Math.PI / 2).translate(x, TOP + 0.52, z), new THREE.SphereGeometry(0.03, 6, 4).translate(x, TOP + 0.58, z)].map((g) => (g.index ? g.toNonIndexed() : g)).map((g) => { for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k); return g; }), BRASS));
    }
    display.heart.push(h);
  }
  for (let i = 0; i < 3; i++) {
    const x = 1.05 + i * 0.3;
    const v = piece([new THREE.CapsuleGeometry(0.055, 0.16, 4, 10).translate(x, TOP + 0.2, cz + 0.05)], TEAL, { glow: 0.7 });
    v.add(piece([new THREE.TorusGeometry(0.08, 0.018, 5, 14).rotateX(Math.PI / 2).translate(x, TOP + 0.07, cz + 0.05), new THREE.CylinderGeometry(0.07, 0.09, 0.05, 10).translate(x, TOP + 0.025, cz + 0.05)], BRASS));
    display.magic.push(v);
  }
  return display;
}

// ------------------------------------------------------------------ Qanat's room (the first shop)

function furnishQanat(interior) {
  const R = SHOP_ROOM, grp = interior.room.group;
  const solid = [], ink = [], teal = [], brass = [], jars = [], glass = [];
  // the counter: a long box with a top proud of it, a teal band along its front
  const cz = R.counter, cw = 5.2;
  solid.push(new THREE.BoxGeometry(cw, 0.96, 0.66).translate(0, 0.48, cz));
  solid.push(new THREE.BoxGeometry(cw + 0.2, 0.08, 0.84).translate(0, 1.0, cz));
  teal.push(new THREE.BoxGeometry(cw + 0.02, 0.16, 0.02).translate(0, 0.72, cz + 0.34));
  for (const x of [-cw / 2 + 0.05, cw / 2 - 0.05]) ink.push(new THREE.BoxGeometry(0.06, 0.96, 0.68).translate(x, 0.48, cz));
  // a little brass scale at the counter's end (the chimes, crystals, are weighed)
  brass.push(new THREE.CylinderGeometry(0.14, 0.16, 0.04, 12).translate(2.15, 1.06, cz - 0.1), new THREE.CylinderGeometry(0.015, 0.015, 0.42, 6).translate(2.15, 1.27, cz - 0.1),
    new THREE.BoxGeometry(0.5, 0.02, 0.02).translate(2.15, 1.47, cz - 0.1));
  for (const s of [-1, 1]) brass.push(new THREE.CylinderGeometry(0.09, 0.06, 0.03, 10).translate(2.15 + s * 0.23, 1.33, cz - 0.1));
  // shelves of jars and flasks behind the counter, and a long board of hooks with strings of chimes
  for (const [x, y] of [[-0.9, 1.4], [0.9, 1.4], [-0.9, 2.1], [0.9, 2.1]]) {
    solid.push(new THREE.BoxGeometry(1.4, 0.06, 0.3).translate(x, y, -R.d / 2 + 0.2));
    for (let k = 0; k < 4; k++) (k % 2 ? jars : glass).push(lathe([[0.01, 0], [0.08, 0.02], [0.09, 0.14], [0.04, 0.2], [0.05, 0.24]], 8).translate(x - 0.5 + k * 0.33, y + 0.03, -R.d / 2 + 0.22));
  }
  // strings of chimes from the ceiling by the door: cords with the small crystals threaded on them, tilted this way and that
  const crystals = [];
  for (const [x, z, n] of [[-1.6, 2.6, 6], [-1.25, 2.85, 5], [1.3, 2.7, 7], [1.65, 2.5, 4]]) {
    ink.push(new THREE.CylinderGeometry(0.008, 0.008, n * 0.13 + 0.3, 4).translate(x, R.h - (n * 0.13 + 0.3) / 2, z));
    for (let k = 0; k < n; k++) crystals.push(crystalGeometry(0.05, 3 + k).rotateZ(((k % 3) - 1) * 0.35).rotateY(k * 0.7).translate(x, R.h - 0.35 - k * 0.13, z));
  }
  // the chimes' sign on the back wall, between the shelves: a big crystal on a brass plate
  brass.push(new THREE.CylinderGeometry(0.42, 0.42, 0.03, 24).rotateX(Math.PI / 2).translate(0, 3.0, -R.d / 2 + 0.2));
  crystals.push(crystalGeometry(0.62, 5).rotateZ(-0.42).scale(1, 1, 0.45).translate(0, 3.0, -R.d / 2 + 0.26));
  // the windows' lattice
  for (const s of [-1, 1]) {
    const x = s * (R.w / 2), z = -0.4;   // (both side windows' middles: src/interiors.js lays a side wall's x along -z / +z)
    ink.push(new THREE.BoxGeometry(0.07, 1.5, 0.07).translate(x, 2.0, z), new THREE.BoxGeometry(0.07, 0.07, 1.3).translate(x, 2.0, z), new THREE.BoxGeometry(0.07, 0.07, 1.3).translate(x, 1.6, z));
  }
  const add = (geos, m, noCollide = false) => { if (!geos.length) return null; const mesh = new THREE.Mesh(mergeGeometries(geos), m); if (noCollide) mesh.userData.noCollide = true; grp.add(mesh); return mesh; };
  add(solid, makeMaterial({ color: '#9a6a46', flat: true }));
  add(ink, makeMaterial({ color: '#2b211f', flat: true }), true);
  add(teal, makeMaterial({ color: '#5fb7ad', flat: true }), true);
  add(brass, makeMaterial({ color: '#d6a13e', flat: true }), true);
  add(jars, makeMaterial({ color: '#c8673f', flat: true }), true);
  add(glass, makeMaterial({ color: '#d9503f', flat: true }), true);
  add(crystals, makeMaterial({ color: '#ffffff', vertexColors: true, glow: 0.5, key: 'chime-crystal' }), true);
}

// ------------------------------------------------------------------ a shop

/**
 * A shop: its building (its world's front and room: def.style), the counter with the wares on it, the keeper's
 * place. `front` adds to the front's options (the desert's colours; a styled front takes only its style).
 */
export function buildShop(scene, { def = SHOPS.qanat, slot = 0, door, front = {}, label = def.name, wall = { color: '#f1e1c6', color2: '#e8d0ad', grid: 0 }, floor = '#b98a62' }) {
  const R = SHOP_ROOM, style = def.style && def.style !== 'qanat' ? SHOP_STYLES[def.style] : null;
  if (def.style && def.style !== 'qanat' && !style) throw new Error(`no shop style "${def.style}"`);
  const room = style ? { w: R.w, d: R.d, h: R.h, ...style.room } : {
    w: R.w, d: R.d, h: R.h, wall, floor, ceiling: '#d9bf98', lamp: '#f2c54b',
    // lattice windows in the side walls (the sun through them lays bright patches on the floor) and one by the door
    windows: [{ side: 'left', x: R.d / 2 + 0.4, y: 1.25, w: 1.3, h: 1.5 }, { side: 'right', x: R.d / 2 - 0.4, y: 1.25, w: 1.3, h: 1.5 }, { side: 'front', x: 1.6, y: 1.2, w: 1.1, h: 1.3 }],
    furniture: [
      ['shelf', -2.3, -R.d / 2 + 0.35, 0, '#8a5a3c'], ['shelf', 2.3, -R.d / 2 + 0.35, 0, '#8a5a3c'],
      ['rug', 0, 1.5, 0, '#c8483a', '#c8483a'], ['pot', -R.w / 2 + 0.6, R.d / 2 - 0.7], ['pot', R.w / 2 - 0.6, -R.d / 2 + 0.6],
      ['bench', -R.w / 2 + 0.55, 0.9, Math.PI / 2, '#a8754e'],
    ],
  };
  const interior = buildInterior(scene, {
    id: `shop.${def.id}`, label, doorLabel: 'shop door', slot, door,
    front: style ? { ...front, build: buildStyledFront, style: def.style } : { sign: 'CHIMES & CURES', signSub: def.keeper ? `${def.keeper[0].toUpperCase()}${def.keeper.slice(1)}, weigher of chimes` : '', ...front },
    room,
  });
  const L = interior.local, grp = interior.room.group, cz = R.counter;
  const size = { w: room.w, d: room.d, h: room.h };
  if (style) {
    const B = buckets();
    counter(B, style.counter);
    style.dress(B, size);
    B.build(grp);
  } else furnishQanat(interior);
  const display = layWares(grp, cz, style?.heart);
  // more light than the one lamp: over the counter (the wares and the keeper's face) and by the door
  for (const [x, y, z, r] of [[0, 2.3, cz + 1.0, 4.2], [0, 2.4, size.d / 2 - 1.0, 4]]) { const p = L(x, y, z); interior.lights.push(new THREE.Vector4(p.x, p.y, p.z, r)); }
  const keeperAt = L(0, 0.05, R.keeper), counterAt = L(0, 0.05, cz + 1.0);
  const shop = {
    def, interior, id: def.id, label, style: def.style ?? 'qanat',
    portals: interior.portals, lights: interior.lights,
    keeper: { at: keeperAt, heading: 0 },   // (facing the door, +z: the room is built unturned)
    counter: { at: counterAt, look: L(0, TOP + 0.2, cz) },
    display,
    /** Lay out what is left (a view from src/shop.js Shop.view): a flask for each potion on the shelf, a heart or a cell for each one left. */
    show(view) {
      for (const w of view ?? []) {
        const list = display[w.id];
        if (!list) continue;
        list.forEach((m, i) => { m.visible = i < w.stock; });
      }
    },
  };
  // (what the shop doesn't sell is never on its counter)
  for (const [k, list] of Object.entries(display)) if (!def.wares.some((w) => w.id === k)) for (const m of list) m.visible = false;
  shop.show(def.wares.map((w) => ({ id: w.id, stock: w.id === 'potion' ? SHELF.potions : w.stock ?? 0 })));
  return shop;
}

/**
 * A world's shop set down in its level (src/levels/<world>.js): built at the door's place `at` (on the ground)
 * turned to `heading`, in slot 0 (one shop a world), the rocks and plants instanced through its walls or on its
 * doorstep cleared. shop.clear: { x, z, r } (the ground it takes, door and doorstep); shop.avoid(fn): the level's
 * floraAvoid with the shop's ground added.
 */
export function placeShop(scene, { def, at, heading = 0, slot = 0, front = {} }) {
  const shop = buildShop(scene, { def, slot, door: { at, heading }, front });
  const f = shop.interior.front, size = f.size ?? { w: 8, d: 7 };
  const mid = f.local(f.offset ?? 0, 0, -size.d / 2 + 1.2);
  const r = Math.max(size.w, size.d) / 2 + 2.2;
  shop.clear = { x: mid.x, z: mid.z, r };
  // (and the way to its door: nothing grows across the doorstep or between the door and the path)
  const way = f.local(0, 0, 3.5);
  shop.clears = [shop.clear, { x: way.x, z: way.z, r: 4 }];
  clearInstances(scene, shop.clears, f.group);
  shop.avoid = (fn = null) => (x, z, rr = 0) => shop.clears.some((c) => Math.hypot(x - c.x, z - c.z) < c.r + rr) || !!fn?.(x, z, rr);
  return shop;
}
