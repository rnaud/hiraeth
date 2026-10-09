import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeMaterial } from './materials.js';
import { buildInterior } from './interior-kit.js';
import { SHOPS, SHELF } from './shop.js';
import { crystalGeometry } from './chimes.js';

// A shop in a world (docs/systems/interiors.md, "A shop"): the interior kit's building (src/interior-kit.js)
// furnished as a shop: a counter across the room with the wares laid out on it (as many flasks as the shelf
// holds, a heart container and a magic cell for each one left), shelves of jars behind, strings of chimes (the
// small floating crystals, threaded on cords) hanging by the door, lattice windows. The keeper stands behind the counter (src/story/shops.js spawns them);
// the counter's front is where E looks at the wares (the shop panel, src/shop-panel.js).
//
//   const shop = buildShop(scene, { def: SHOPS.qanat, slot: 0, door: { at, heading }, front: { ... } });
//   level.portals.push(...shop.portals); level.lights.push(...shop.lights); level.shops = [shop];
//   shop.keeper  { at, heading }      where the keeper stands
//   shop.counter { at, look }         where you stand to look at the wares, and what the camera looks at
//   shop.show(view)                   the wares on the counter as the shop's stock is (src/shop.js Shop.view)

/** The room: 8 × 7 m, 4.2 m high, the door in its +z wall; the counter's line across it (local z). */
export const SHOP_ROOM = { w: 8, d: 7, h: 4.2, counter: -0.9, keeper: -2.05 };

/** A heart's outline, about 1 m across (centred, point down). */
function heartShape() {
  const s = new THREE.Shape();
  s.moveTo(0, -0.5);
  s.bezierCurveTo(-0.1, -0.38, -0.5, -0.12, -0.5, 0.14);
  s.bezierCurveTo(-0.5, 0.38, -0.32, 0.5, -0.2, 0.5);
  s.bezierCurveTo(-0.08, 0.5, 0, 0.42, 0, 0.32);
  s.bezierCurveTo(0, 0.42, 0.08, 0.5, 0.2, 0.5);
  s.bezierCurveTo(0.32, 0.5, 0.5, 0.38, 0.5, 0.14);
  s.bezierCurveTo(0.5, -0.12, 0.1, -0.38, 0, -0.5);
  return s;
}
const lathe = (pts, seg = 12) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(Math.max(r, 0.001), y)), seg);

export function buildShop(scene, { def = SHOPS.qanat, slot = 0, door, front = {}, label = def.name, wall = { color: '#f1e1c6', color2: '#e8d0ad', grid: 0 }, floor = '#b98a62' }) {
  const R = SHOP_ROOM;
  const interior = buildInterior(scene, {
    id: `shop.${def.id}`, label, doorLabel: 'shop door', slot, door,
    front: { sign: 'CHIMES & CURES', signSub: def.keeper ? `${def.keeper[0].toUpperCase()}${def.keeper.slice(1)}, weigher of chimes` : '', ...front },
    room: {
      w: R.w, d: R.d, h: R.h, wall, floor, ceiling: '#d9bf98', lamp: '#f2c54b',
      // lattice windows in the side walls (the sun through them lays bright patches on the floor) and one by the door
      windows: [{ side: 'left', x: R.d / 2 + 0.4, y: 1.25, w: 1.3, h: 1.5 }, { side: 'right', x: R.d / 2 - 0.4, y: 1.25, w: 1.3, h: 1.5 }, { side: 'front', x: 1.6, y: 1.2, w: 1.1, h: 1.3 }],
      furniture: [
        ['shelf', -2.3, -R.d / 2 + 0.35, 0, '#8a5a3c'], ['shelf', 2.3, -R.d / 2 + 0.35, 0, '#8a5a3c'],
        ['rug', 0, 1.5, 0, '#c8483a', '#c8483a'], ['pot', -R.w / 2 + 0.6, R.d / 2 - 0.7], ['pot', R.w / 2 - 0.6, -R.d / 2 + 0.6],
        ['bench', -R.w / 2 + 0.55, 0.9, Math.PI / 2, '#a8754e'],
      ],
    },
  });
  const L = interior.local, grp = interior.room.group;
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

  // ---- the wares on the counter, one mesh per piece so what is sold goes from the display
  const top = 1.04, display = { potion: [], heart: [], magic: [] };
  const piece = (geos, color, o = {}) => { const m = new THREE.Mesh(mergeGeometries(geos), makeMaterial({ color, flat: true, ...o })); m.userData.noCollide = true; grp.add(m); return m; };
  // the flasks: corked, red to the shoulder (as many as the shelf holds)
  for (let i = 0; i < SHELF.potions; i++) {
    const x = -1.95 + i * 0.26, z = cz + 0.05 + (i % 2) * 0.12;
    const red = piece([lathe([[0.01, 0], [0.1, 0.02], [0.11, 0.12], [0.05, 0.2], [0.035, 0.21]], 12).translate(x, top, z)], '#d9503f');
    red.add(piece([new THREE.CylinderGeometry(0.035, 0.03, 0.08, 8).translate(x, top + 0.25, z)], '#b07a45'));
    display.potion.push(red);
  }
  // the heart containers: a red heart on a little cushion each
  const heart = new THREE.ExtrudeGeometry(heartShape(), { depth: 0.12, bevelEnabled: true, bevelSize: 0.04, bevelThickness: 0.04, bevelSegments: 2, curveSegments: 10 }).translate(0, 0, -0.06).scale(0.26, 0.26, 0.26);
  for (let i = 0; i < 3; i++) {
    const x = -0.35 + i * 0.35;
    const h = piece([heart.clone().translate(x, top + 0.26, cz + 0.05)], '#d9503f');
    h.add(piece([new THREE.BoxGeometry(0.28, 0.07, 0.24).translate(x, top + 0.035, cz + 0.05)], '#8a6fb8'));
    display.heart.push(h);
  }
  // the magic cells: a teal glowing vial in a brass cradle each
  for (let i = 0; i < 3; i++) {
    const x = 1.05 + i * 0.3;
    const v = piece([new THREE.CapsuleGeometry(0.055, 0.16, 4, 10).translate(x, top + 0.2, cz + 0.05)], '#70e7df', { glow: 0.7 });
    v.add(piece([new THREE.TorusGeometry(0.08, 0.018, 5, 14).rotateX(Math.PI / 2).translate(x, top + 0.07, cz + 0.05), new THREE.CylinderGeometry(0.07, 0.09, 0.05, 10).translate(x, top + 0.025, cz + 0.05)], '#d6a13e'));
    display.magic.push(v);
  }
  // more light than the one lamp: over the counter (the wares and the keeper's face) and by the door
  for (const [x, y, z, r] of [[0, 2.3, cz + 1.0, 4.2], [0, 2.4, R.d / 2 - 1.0, 4]]) { const p = L(x, y, z); interior.lights.push(new THREE.Vector4(p.x, p.y, p.z, r)); }
  const keeperAt = L(0, 0.05, R.keeper), counterAt = L(0, 0.05, cz + 1.0);
  const shop = {
    def, interior, id: def.id, label,
    portals: interior.portals, lights: interior.lights,
    keeper: { at: keeperAt, heading: 0 },   // (facing the door, +z: the room is built unturned)
    counter: { at: counterAt, look: L(0, top + 0.2, cz) },
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
  shop.show(def.wares.map((w) => ({ id: w.id, stock: w.id === 'potion' ? SHELF.potions : w.stock ?? 0 })));
  return shop;
}
