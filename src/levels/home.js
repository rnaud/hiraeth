import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createNoise2D, fbm, smoothstep } from '../noise.js';
import { makeMaterial, MODE_TERRAIN, MODE_STRATA } from '../materials.js';
import { Terrain, jitter } from '../world.js';
import { game } from '../game-state.js';
import { items } from '../items.js';
import { buildItemModel } from '../boxes/model.js';
import { tokenList, ILEN_TOKEN } from '../story/ending.js';
import { addIndoors } from '../shelter.js';
import { Cloths, HangingCloth } from '../hanging-cloth.js';
import { buildParentsHouse, buildFamilyHouse } from './home-houses.js';
import { buildGarden, flowerGeometry, GARDEN } from './home-garden.js';
import { drawingMesh, DRAWN } from './home-drawings.js';
import { stepped } from '../load-steps.js';

// ---------------------------------------------------------------------------
// Home: where the route begins (src/story/ending.js). Hidden: it opens on the
// galactic map once enough worlds are done.
//
// A small round house on a small round hill at dusk: a cream dome with its
// round window dark and the antenna the old recorder sent through, a tall
// umbrella tree, a washing line, a stone path from the landing ring to the
// door, and two moons over a valley of peach grass and lilac mesas. Nobody
// lives in the round house now (the parents' house: dark, dusty, still; you can
// open its door and walk in). Across the yard stands the small house, the
// traveller's own, where his daughter Lou lives with Aunt Tove while he travels:
// its lamp is lit and its door open (src/levels/home-houses.js). Between the
// path and the small house, their garden (src/levels/home-garden.js). Lou, Tove
// and the dog are src/story/home.js.
//
// In the front yard stands the parents' stone (buildTomb): a round-topped
// headstone over a low slab, where the traveller sets the tokens he brought
// (src/ship/homecoming.js frames it with HOME_SPOTS). The slab keeps them
// (tokenModel, tombSlots, laidTokens), and the flowers laid there since.
//
// The washing, Lou's bunting, the landing ring's flag, the curtain in the small
// house and the mother's scarf are real cloth (src/hanging-cloth.js): pinned at
// the top, blown by the wind, pushed aside when you walk into them.
// ---------------------------------------------------------------------------

/** Where things are, for the homecoming's cameras. */
export const HOME_SPOTS = {
  house: new THREE.Vector3(0, 0, 34),     // the dome's centre on the ground
  door: new THREE.Vector3(0, 0, 25.6),    // the threshold, facing -z (the landing ring)
  father: [-1.5, 15.5],
  mother: [1.6, 16],
  meet: new THREE.Vector3(0, 0, 13),    // on the path, in front of the door
  tomb: new THREE.Vector3(-6.5, 0, 16.5),   // the parents' stone, in the front yard
  tombYaw: 2.8,                         // it faces the path, toward the landing ring (its +z)
  tombStand: 1.45,                      // m in front of it, where the traveller stands to set things down
  ship: { x: 0, z: -22, heading: 0 },     // the landing ring: the hatch faces the house
  small: new THREE.Vector3(17.5, 0, 39),  // the small house (Lou's, Tove's, yours): its centre
  smallFacing: Math.atan2(6 - 17.5, 20 - 39),   // its door looks across the yard to the garden
  lou: new THREE.Vector3(8.5, 0, 21.4),   // where Lou is when you come (by the flower border)
};

const noise = createNoise2D(77);

function height(x, z) {
  const r = Math.hypot(x, z);
  // the hilltop is flat (the house, the yard, the landing ring); the hill falls to a meadow valley,
  // and far hills rise all round (nobody walks off the edge of home)
  const meadow = fbm(noise, x * 0.006, z * 0.006, 3) * 7 + Math.sin(x * 0.013) * Math.cos(z * 0.011) * 3;
  let h = -16 * smoothstep(75, 240, r) + meadow * smoothstep(80, 200, r);
  h += smoothstep(420, 760, r) * (70 + fbm(noise, x * 0.003 + 9, z * 0.003, 3) * 40);
  return h;
}

export const HOME_CONTENT = {
  weather: [],
  story: {
    title: 'HOME',
    intro: 'A small round house on a small round hill. The lamp in the window is dark.',
    outro: 'You came home.',
    label: 'the stone in the yard', goal: [HOME_SPOTS.tomb.x, 'ground', HOME_SPOTS.tomb.z], radius: 5, manual: true,
  },
  relics: { spots: [], names: [] },
  npcs: [],   // Lou, Tove and the dog come with the story (src/story/home.js); nobody lives in the round house now
};

/** The slab's top (tomb-local height, m) and the area tokens are set on (x half-width, z from .. to). */
export const SLAB = { top: 0.34, x: 0.72, z0: -0.32, z1: 0.6 };

/**
 * Where n tokens go on the slab, in tomb-local space: rows from the front edge back to the
 * headstone, evenly spread, never closer than about 15 cm.
 */
export function tombSlots(n) {
  if (n <= 0) return [];
  const W = SLAB.x * 2, D = SLAB.z1 - SLAB.z0;
  const cols = Math.max(1, Math.min(n, Math.ceil(Math.sqrt(n * W / D))));
  const rows = Math.ceil(n / cols);
  const out = [];
  for (let i = 0; i < n; i++) {
    const r = Math.floor(i / cols), c = i % cols, inRow = Math.min(cols, n - r * cols);
    const x = inRow === 1 ? 0 : -SLAB.x + (W * (c + 0.5)) / inRow;
    const z = rows === 1 ? (SLAB.z0 + SLAB.z1) / 2 + 0.1 : SLAB.z1 - (D * (r + 0.5)) / rows;
    out.push(new THREE.Vector3(x, SLAB.top + 0.05, z));
  }
  return out;
}

const tm = (color, o = {}) => makeMaterial({ color, flat: true, ...o });
const tokenMesh = (g, geo, m, x = 0, y = 0, z = 0) => { const mesh = new THREE.Mesh(geo, m); mesh.position.set(x, y, z); mesh.userData.noCollide = true; g.add(mesh); return mesh; };

/** A small model of a token: the makers' gifts as they came out of their boxes, the keepsakes by what they are. */
export function tokenModel(t) {
  if (t.kind === 'item') { const g = buildItemModel(t.item); g.scale.setScalar(0.95); return g; }
  const g = new THREE.Group();
  g.scale.setScalar(1.35);
  g.name = `Token ${t.id}`;
  const INK = tm('#2b211f');
  if (t.id === 'buried.thing') {   // a rust gear tooth, still warm
    const tooth = new THREE.Shape();
    tooth.moveTo(-0.07, 0); tooth.lineTo(0.07, 0); tooth.lineTo(0.045, 0.09); tooth.lineTo(-0.045, 0.09); tooth.closePath();
    tokenMesh(g, new THREE.ExtrudeGeometry(tooth, { depth: 0.04, bevelEnabled: false }).translate(0, -0.04, -0.02), tm('#a8582f', { glow: 0.25 }));
  } else if (t.id === 'perdide.thing') {   // the singing splinter
    tokenMesh(g, new THREE.OctahedronGeometry(0.05, 0).scale(0.7, 2.2, 0.7).rotateZ(0.5), tm('#a99be0', { glow: 0.7 }));
  } else if (t.id === 'incal.token') {   // a lift token: a brass disc with a hole
    tokenMesh(g, new THREE.TorusGeometry(0.05, 0.022, 8, 20).rotateX(Math.PI / 2), tm('#d6a94a', { metal: 'brass' }));
  } else if (t.kind === 'song') {   // a little bell
    tokenMesh(g, new THREE.CylinderGeometry(0.025, 0.065, 0.1, 14, 1, true).translate(0, 0, 0), tm('#d6a94a', { side: THREE.DoubleSide, metal: 'brass' }));
    tokenMesh(g, new THREE.SphereGeometry(0.02, 8, 6), tm('#9c7330', { metal: 'brass' }), 0, 0.06, 0);
  } else if (t.kind === 'word') {   // a folded paper with the words on it
    tokenMesh(g, new THREE.BoxGeometry(0.16, 0.012, 0.11).rotateY(0.3), tm('#f7ecd2'), 0, -0.04, 0);
    for (let k = 0; k < 3; k++) tokenMesh(g, new THREE.BoxGeometry(0.1 - k * 0.02, 0.004, 0.008).rotateY(0.3), INK, 0, -0.032, -0.03 + k * 0.025);
  } else if (t.kind === 'person') {   // a small lamp for someone waiting
    tokenMesh(g, new THREE.CylinderGeometry(0.035, 0.045, 0.06, 12), tm('#c8673f'), 0, -0.02, 0);
    tokenMesh(g, new THREE.SphereGeometry(0.025, 10, 8).scale(1, 1.5, 1), tm('#ffd27a', { glow: 1 }), 0, 0.035, 0);
  } else if (t.kind === 'knowing') {   // a smooth pebble with the glyph
    tokenMesh(g, new THREE.SphereGeometry(0.06, 14, 10).scale(1.2, 0.5, 0.9), tm('#b9a3c9'), 0, -0.03, 0);
    for (const x of [-0.022, 0, 0.022]) tokenMesh(g, new THREE.SphereGeometry(0.008, 6, 5), INK, x, 0.0, 0.01);
  } else {   // a thing: a little carved figure
    tokenMesh(g, new THREE.CylinderGeometry(0.03, 0.04, 0.09, 8), tm('#a8754f'), 0, -0.01, 0);
    tokenMesh(g, new THREE.SphereGeometry(0.03, 10, 8), tm('#a8754f'), 0, 0.055, 0);
  }
  return g;
}

/** The reel itself: a small spool of the old recorder's tape, set down last. */
export function reelModel() {
  const g = new THREE.Group();
  g.name = 'Token reel';
  for (const y of [-0.025, 0.025]) tokenMesh(g, new THREE.CylinderGeometry(0.11, 0.11, 0.008, 24), tm('#34405e'), 0, y, 0);
  tokenMesh(g, new THREE.CylinderGeometry(0.085, 0.085, 0.045, 24), tm('#7f6250'));
  tokenMesh(g, new THREE.CylinderGeometry(0.03, 0.03, 0.06, 12), tm('#9fe0d6', { glow: 0.8 }));
  return g;
}

/** Where the reel goes: the front of the slab, in the middle (tomb-local). */
export const REEL_AT = new THREE.Vector3(0, SLAB.top + 0.035, SLAB.z1 + 0.04);

/** Everything you carry that could go on the slab (from what you carry). */
export function tokensNow(g = game) {
  return tokenList(g.keepsakes?.() ?? [], items.owned());
}

/**
 * What lies on the slab now: the tokens set down at the ending and at every visit since
 * (`home.stone`: their ids; a save from before kept only the count, `ending.tokens`).
 */
export function laidTokens(g = game) {
  const all = tokensNow(g), ids = g.flag?.('home.stone');
  if (Array.isArray(ids)) return all.filter((t) => ids.includes(t.id));
  if (!g.flag?.('ending.done')) return [];
  return all.slice(0, g.flag('ending.tokens') ?? all.length);
}

/** What the slab shows: what was laid there, and after the true ending the message Ilen set down (src/story/ending.js ILEN_TOKEN). */
export function stoneTokens(g = game) {
  return g.flag?.('ending.final') ? [...laidTokens(g), ILEN_TOKEN] : laidTokens(g);
}

/** What you carry that isn't on the slab yet (found since you were last here). */
export function unlaidTokens(g = game) {
  const laid = new Set(laidTokens(g).map((t) => t.id));
  return tokensNow(g).filter((t) => !laid.has(t.id));
}

/** Keep these as set down on the slab. */
export function layTokens(g, list) {
  const ids = new Set(laidTokens(g).map((t) => t.id));
  for (const t of list) ids.add(t.id);
  g.set('home.stone', [...ids]);
}

/** How many fresh flowers are kept on the stone (the oldest give way to the newest). */
export const STONE_FLOWERS = 9;

/** A picked flower lying down (on the slab, or in someone's hand). */
export function flowerModel(kind, seed = 1) {
  const m = new THREE.Mesh(flowerGeometry(kind, 0.5, seed), makeMaterial({ color: '#ffffff', vertexColors: true }));
  m.userData.noCollide = true;
  m.name = `flower ${kind}`;
  return m;
}

/**
 * The parents' stone: a round-topped headstone carved with two rings side by side (like the two
 * moons) and lines for their names, over a low plinth and a slab; a jar of dried flowers.
 * @returns { group (tomb-local: +z faces the path), place(meshes) , add(mesh, i, n), clear(), slots(n), stand, heading }
 */
function buildTomb(scene, mat) {
  const group = new THREE.Group();
  group.name = 'tomb';
  group.position.copy(HOME_SPOTS.tomb);
  group.rotation.y = HOME_SPOTS.tombYaw;
  scene.add(group);
  const stone = mat('#dccab0', { flat: true }), pale = mat('#efe2c4'), ink = mat('#2b211f', { flat: true });
  const add = (geo, m, x = 0, y = 0, z = 0) => { const mesh = new THREE.Mesh(geo, m); mesh.position.set(x, y, z); group.add(mesh); return mesh; };
  add(new THREE.BoxGeometry(2.0, 0.22, 1.6), stone, 0, 0.11, 0);
  add(new THREE.BoxGeometry(1.7, 0.12, 1.15), pale, 0, 0.28, 0.12);
  // the headstone: a rounded top, like the house
  const sh = new THREE.Shape();
  sh.moveTo(-0.65, 0); sh.lineTo(0.65, 0); sh.lineTo(0.65, 0.95); sh.absarc(0, 0.95, 0.65, 0, Math.PI, false); sh.lineTo(-0.65, 0);
  add(new THREE.ExtrudeGeometry(sh, { depth: 0.24, bevelEnabled: false, curveSegments: 20 }), pale, 0, 0.22, -0.72);
  // two rings carved in the arch, overlapping like the two moons over the house; their names under them
  for (const [x, y, r] of [[-0.06, 1.42, 0.13], [0.13, 1.5, 0.075]]) add(new THREE.TorusGeometry(r, 0.018, 6, 28), ink, x, y, -0.47).userData.noCollide = true;
  for (const [w, y] of [[0.78, 1.08], [0.6, 0.98], [0.34, 0.84]]) add(new THREE.BoxGeometry(w, 0.022, 0.01), ink, 0, y, -0.475).userData.noCollide = true;
  // a jar of dried flowers at the corner
  add(new THREE.CylinderGeometry(0.08, 0.1, 0.22, 10), mat('#c8673f', { flat: true }), 0.82, 0.33, 0.55).userData.noCollide = true;
  for (const [dx, dz, c] of [[0, 0, '#b9a3c9'], [0.05, 0.03, '#f2c54b'], [-0.04, 0.02, '#e6875f']]) {
    add(new THREE.CylinderGeometry(0.006, 0.006, 0.3, 4), mat('#4f6b34', { flat: true }), 0.82 + dx, 0.58, 0.55 + dz).userData.noCollide = true;
    add(new THREE.SphereGeometry(0.035, 8, 6), mat(c, { flat: true }), 0.82 + dx, 0.74, 0.55 + dz).userData.noCollide = true;
  }
  const tokens = new THREE.Group();
  tokens.userData.noCollide = true;
  group.add(tokens);
  // the fresh flowers laid since (kept: home.flowers), and what Lou left at the ending
  const flowers = new THREE.Group(), extras = new THREE.Group();
  flowers.userData.noCollide = extras.userData.noCollide = true;
  group.add(flowers, extras);
  group.updateMatrixWorld(true);
  const stand = group.localToWorld(new THREE.Vector3(0, 0, HOME_SPOTS.tombStand));
  /** Where flower i lies (tomb-local): along the slab's front edge and at its foot, crossing. */
  const flowerAt = (i) => {
    const row = i % 3, k = Math.floor(i / 3);
    // (on the base's ledge in front of the slab, the third of each three on the grass at its foot)
    return { p: new THREE.Vector3(-0.2 + k * 0.45 + row * 0.07, row === 2 ? 0.02 : 0.235 + row * 0.015, row === 2 ? 0.98 : 0.745 - row * 0.01), ry: ((i * 2.3) % 0.6) - 0.3 };
  };
  return {
    group, tokens, flowers, extras,
    stand, heading: HOME_SPOTS.tombYaw + Math.PI,   // the traveller faces the stone
    slots: (n) => tombSlots(n),
    /** Set a token model down on slot i of n (tomb-local). */
    add(mesh, i, n) { const p = tombSlots(n)[i]; if (p) mesh.position.copy(p); mesh.rotation.y = (i * 1.7) % 1 - 0.5; mesh.traverse((o) => { o.userData.noCollide = true; }); tokens.add(mesh); return mesh; },
    clear() { for (const c of [...tokens.children]) tokens.remove(c); },
    /** Everything on it at once (coming back after the ending); the reel too once the true ending has set it down. */
    fill(list, { reel = false } = {}) { this.clear(); list.forEach((t, i) => this.add(tokenModel(t), i, list.length)); if (reel) this.addReel(); },
    /** The reel, set down last, at the front. */
    addReel() { const r = reelModel(); r.position.copy(REEL_AT); tokens.add(r); return r; },
    /** A flower laid on the stone (its kind: home-garden.js FLOWERS): the newest STONE_FLOWERS stay. */
    addFlower(kind, i = flowers.children.length) {
      const m = flowerModel(kind, i);
      const { p, ry } = flowerAt(i % STONE_FLOWERS);
      m.position.copy(p); m.rotation.set(0, ry, Math.PI / 2 - 0.08); m.scale.setScalar(1.5);
      if (flowers.children.length >= STONE_FLOWERS) flowers.remove(flowers.children[0]);
      flowers.add(m);
      return m;
    },
    /** The flowers kept on it (kinds, oldest first). */
    fillFlowers(kinds = []) { for (const c of [...flowers.children]) flowers.remove(c); kinds.slice(-STONE_FLOWERS).forEach((k, i) => this.addFlower(k, i)); },
    /** Where a flower is set down (world), for the hands to reach. */
    flowerSpot(i = flowers.children.length) { return group.localToWorld(flowerAt(i % STONE_FLOWERS).p.clone()); },
    /** Lou's drawing, left at the stone at the ending (propped against the headstone). */
    addDrawing() {
      if (extras.getObjectByName('drawing family')) return null;
      const d = drawingMesh('family', 0.36, 0.27);
      d.position.set(0.42, SLAB.top + 0.15, -0.4); d.rotation.set(-0.25, 0.15, 0);
      extras.add(d);
      return d;
    },
  };
}

// (built in steps, src/load-steps.js: the game's load gives the main thread back between them)
export function* buildHome(scene) {
  const terrain = yield* Terrain.make({
    size: 1800, seg: 225, height,
    material: { color: '#eebd8e', color2: '#e3a97c', color3: '#c99a7c', mode: MODE_TERRAIN, ticks: true },
  });
  scene.add(terrain.mesh);
  const H = (x, z) => terrain.heightAt(x, z);
  const lights = [];
  const movers = [];
  const smallProps = [];
  const mat = (color, o = {}) => makeMaterial({ color, ...o });
  const add = (geo, m, x = 0, y = 0, z = 0) => { const mesh = new THREE.Mesh(geo, m); mesh.position.set(x, y, z); scene.add(mesh); return mesh; };
  const cream = mat('#f3ead8'), ink = mat('#2b211f'), iron = mat('#2b211f', { metal: 'iron' }), stone = mat('#dccab0', { flat: true }), terracotta = mat('#c8483a', { flat: true });
  const teal = mat('#5fb7ad'), tealDark = mat('#3f8f8a'), lilac = mat('#b9a3c9', { flat: true });

  // ---------------------------------------------------------- the round house (the parents'): walked into, dark and still
  yield;
  const parents = buildParentsHouse(scene, { centre: HOME_SPOTS.house.clone().setY(H(HOME_SPOTS.house.x, HOME_SPOTS.house.z)), doorZ: HOME_SPOTS.door.z, mat, lit: !!game.flag('ending.final') });
  lights.push(...parents.lights);
  movers.push((t) => parents.dust(t));
  yield;
  {
    const { x, z } = HOME_SPOTS.house;
    // the lamp by the door (Tove keeps it lit)
    add(new THREE.CylinderGeometry(0.08, 0.08, 2.6, 6), iron, x + 2.2, 0.9 + 1.3, HOME_SPOTS.door.z - 0.6);
    add(new THREE.SphereGeometry(0.3, 12, 8), mat('#ffe6b0', { glow: 1 }), x + 2.2, 0.9 + 2.75, HOME_SPOTS.door.z - 0.6);
    lights.push(new THREE.Vector4(x + 2.2, 3.4, HOME_SPOTS.door.z - 1.2, 8));
    // the antenna on top: a mast and a little dish turned to the sky, the old recorder's
    add(new THREE.CylinderGeometry(0.12, 0.18, 6, 8), iron, x - 1.5, 7.2 + 3, z + 1);
    const dish = add(new THREE.ConeGeometry(1.4, 0.7, 20, 1, true), mat('#f3ead8', { side: THREE.DoubleSide, metal: 'painted' }), x - 1.5, 13.4, z + 1);
    dish.rotation.set(Math.PI + 0.6, 0, 0.3);
    const blink = add(new THREE.SphereGeometry(0.16, 8, 6), mat('#e6503a', { glow: 1 }), x - 1.5, 13.3 + 0.1, z + 1);
    movers.push((t) => { blink.visible = Math.sin(t * 2.2) > -0.2; });
    // a bench by the door, where somebody sits to watch the sky
    add(new THREE.BoxGeometry(3, 0.25, 0.9), mat('#8a5a3c', { flat: true }), x - 5.2, 0.9 + 0.75, HOME_SPOTS.door.z + 0.9).rotation.y = 0.35;
    for (const s of [-1, 1]) add(new THREE.BoxGeometry(0.25, 0.75, 0.8), mat('#8a5a3c', { flat: true }), x - 5.2 + s * 1.3 * Math.cos(0.35), 0.9 + 0.37, HOME_SPOTS.door.z + 0.9 - s * 1.3 * Math.sin(0.35));
  }

  // ---------------------------------------------------------- the small house (Lou's and Tove's, and yours), lit
  yield;
  const small = buildFamilyHouse(scene, { centre: HOME_SPOTS.small.clone().setY(H(HOME_SPOTS.small.x, HOME_SPOTS.small.z)), heading: HOME_SPOTS.smallFacing, mat });
  lights.push(...small.lights);
  // the fire breathes
  movers.push((t) => { const f = 1 + 0.12 * Math.sin(t * 9) + 0.08 * Math.sin(t * 23); small.fire.scale.set(1, f, 1); small.lights[1].w = 6 + Math.sin(t * 7) * 0.6; });
  // Lou's shelf: a copy of every keepsake, and her drawings on the wall (one for every world you wrote to her from)
  const shelfShown = new Set(), drawingsShown = new Set();
  const furnish = () => {
    const ks = game.keepsakes?.() ?? [];
    ks.forEach((k, i) => {
      if (shelfShown.has(k.id) || i >= 24) return;
      shelfShown.add(k.id);
      const m = tokenModel({ id: k.id, kind: k.kind ?? 'thing', name: k.name });
      m.scale.multiplyScalar(2.1);   // (Lou's are chunky: clay and paper)
      m.traverse((o) => { o.userData.noCollide = true; });
      small.shelfAdd(m, i);
    });
    const worlds = DRAWN.filter((w) => game.flag?.(`world.${w}.done`) || ks.some((k) => k.level === w));
    worlds.forEach((w) => { if (drawingsShown.has(w)) return; small.wallAdd(drawingMesh(w), drawingsShown.size); drawingsShown.add(w); });
  };
  furnish();

  // ---------------------------------------------------------- the yard
  // the landing ring, where the ship stands
  yield;
  {
    const { x, z } = HOME_SPOTS.ship;
    add(new THREE.CylinderGeometry(17, 17.4, 0.3, 48), mat('#efe2c4', { flat: true }), x, 0.0, z);
    const mark = add(new THREE.RingGeometry(14.2, 15, 64).rotateX(-Math.PI / 2), terracotta, x, 0.17, z);
    mark.userData.noCollide = true;
    // the glyph, painted on the ring by someone at home: three dots over an arc
    for (const [dx, dz] of [[-2.2, 12.2], [0, 12.8], [2.2, 12.2]]) {
      const d = add(new THREE.CircleGeometry(0.55, 16).rotateX(-Math.PI / 2), ink, x + dx, 0.18, z + dz);
      d.userData.noCollide = true;
    }
  }
  // the stone path, from the ring to the door
  yield;
  for (let i = 0; i < 9; i++) {
    yield;
    const k = i / 8, z = -4 + k * 27.5, x = Math.sin(k * 3) * 0.8;
    const s = add(new THREE.CylinderGeometry(0.9 + (i % 3) * 0.12, 1, 0.16, 10), stone, x + (i % 2 ? 0.5 : -0.5), 0.05, z);
    s.rotation.y = i;
    smallProps.push(s);
  }
  // and a smaller one from the garden's gate to the small house's door
  yield;
  {
    const a = new THREE.Vector3(12.6, 0, 25.2), b = small.doorOut;
    for (let i = 1; i <= 7; i++) {
      const p = a.clone().lerp(b, i / 7);
      const s = add(new THREE.CylinderGeometry(0.42 + (i % 3) * 0.06, 0.46, 0.1, 9), stone, p.x + (i % 2 ? 0.2 : -0.2), H(p.x, p.z) + 0.02, p.z);
      s.rotation.y = i * 1.7;
      s.userData.noCollide = true;
    }
  }
  // a low curved wall round the yard, open towards the ring
  yield;
  {
    const parts = [];
    const r = 26, c = HOME_SPOTS.house;
    for (let a = 0.5; a <= Math.PI * 2 - 0.5; a += 0.105) {   // a: from the front (-z) round; the front stays open
      parts.push(new THREE.BoxGeometry(2.8, 1.1, 0.9).rotateY(-a).translate(c.x + Math.sin(a) * r, 0.55, c.z - Math.cos(a) * r).toNonIndexed());
    }
    add(mergeGeometries(parts), stone);
  }
  // ---------------------------------------------------------- the garden (src/levels/home-garden.js)
  yield;
  const garden = buildGarden(scene, { ground: H });

  // ---------------------------------------------------------- cloth: the washing, the bunting, the flag, the curtain, the scarf
  yield;
  const cloths = new Cloths({ near: 60 });
  const ground = (x, z) => H(x, z);
  // the washing line: a sheet, a shirt, Lou's dress, a towel, pegged to the line
  yield;
  {
    const p0 = new THREE.Vector3(-12, 0, 18), p1 = new THREE.Vector3(-20, 0, 30), Y = 3.3;
    for (const p of [p0, p1]) add(new THREE.CylinderGeometry(0.1, 0.12, 3.4, 6), mat('#8a5a3c', { flat: true }), p.x, 1.7, p.z);
    const line = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, p0.distanceTo(p1), 4), ink);
    line.position.copy(p0).lerp(p1, 0.5).setY(Y);
    line.lookAt(p1.x, Y, p1.z); line.rotateX(Math.PI / 2);
    line.userData.noCollide = true;
    scene.add(line);
    const along = p1.clone().sub(p0).setY(0).normalize();
    // [where along the line (0..1), width, length, colour, second colour, columns, rows]
    for (const [t, w, len, c, c2, cols, rows] of [[0.14, 1.7, 1.9, '#5fd0c6', '#4fb8b0', 9, 10], [0.36, 0.9, 1.0, '#8a6fb8', '#7a5fa8', 5, 6],
      [0.52, 0.62, 0.75, '#f2c54b', '#e8a33a', 4, 5], [0.68, 0.8, 1.2, '#c8483a', '#a8382f', 5, 7], [0.86, 1.5, 1.7, '#f3ead8', '#e6d8bc', 8, 9]]) {
      const m = p0.clone().lerp(p1, t).setY(Y - 0.03);
      const a = m.clone().addScaledVector(along, -w / 2), b = m.clone().addScaledVector(along, w / 2);
      cloths.add(new HangingCloth(scene, { a, b, length: len, cols, rows, color: c, color2: c2, pins: [0, Math.floor((cols - 1) / 2), cols - 1], droop: 0.04, floor: ground(m.x, m.z), name: 'washing' }));
    }
  }
  // Lou's bunting: from the small house's chimney to the round house's mast, pennants all along
  yield;
  {
    const A = small.room.localToWorld(new THREE.Vector3(0, 3.0 + 2.6, -4.8 + 1.0)), B = new THREE.Vector3(HOME_SPOTS.house.x - 1.35, 9.4, HOME_SPOTS.house.z + 1);
    const sag = (t) => -2.2 * Math.sin(Math.PI * t);
    const pts = Array.from({ length: 13 }, (_, i) => { const t = i / 12; return A.clone().lerp(B, t).add(new THREE.Vector3(0, sag(t), 0)); });
    const string = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.02, 4, false), ink);
    string.userData.noCollide = true;
    scene.add(string);
    const COLS = ['#c8483a', '#f2c54b', '#5fb7ad', '#8a6fb8', '#e8873a', '#f3ead8'];
    for (let i = 0; i < 11; i++) {
      const t0 = (i + 0.6) / 12.2, t1 = t0 + 0.034;
      const a = A.clone().lerp(B, t0).add(new THREE.Vector3(0, sag(t0) - 0.02, 0)), b = A.clone().lerp(B, t1).add(new THREE.Vector3(0, sag(t1) - 0.02, 0));
      cloths.add(new HangingCloth(scene, { a, b, length: 0.62, cols: 3, rows: 5, color: COLS[i % COLS.length], taper: 0.95, floor: 0, wind: 1.2, name: 'bunting' }));
    }
  }
  // the flag on the landing ring's mast: it shows which way the wind blows
  yield;
  {
    const m = new THREE.Vector3(HOME_SPOTS.ship.x + 12.5, 0, HOME_SPOTS.ship.z + 8.5);
    add(new THREE.CylinderGeometry(0.06, 0.09, 6.2, 6), mat('#f3ead8', { metal: 'painted' }), m.x, 3.1, m.z);
    add(new THREE.SphereGeometry(0.12, 8, 6), mat('#d6a94a', { metal: 'brass' }), m.x, 6.25, m.z);
    const a = new THREE.Vector3(m.x, 6.05, m.z), b = a.clone().add(new THREE.Vector3(1.9, 0, 0.4));
    cloths.add(new HangingCloth(scene, { a, b, length: 1.05, cols: 9, rows: 5, color: '#c8483a', color2: '#5fb7ad', pins: (r, c) => c === 0, wind: 3.2, gravity: 4.5, damp: 0.98, name: 'flag' }));
  }
  // the curtain in the small house, in front of the beds: two panels on the rod
  const indoorCloths = new Set();
  yield;
  {
    const { a, b, floor } = small.curtain;
    const mid = a.clone().lerp(b, 0.5), d = b.clone().sub(a).normalize();
    for (const [p, q] of [[a, mid.clone().addScaledVector(d, -0.45)], [mid.clone().addScaledVector(d, 0.45), b]]) {
      const c = cloths.add(new HangingCloth(scene, { a: p, b: q, length: 2.2, cols: 13, rows: 10, color: '#e6875f', color2: '#c8673f', floor, wind: 1, name: 'curtain', pleats: 0.07 }));
      indoorCloths.add(c);
    }
  }
  // the mother's scarf on the coat stand in the round house: still, until you brush past it
  yield;
  {
    const t = parents.spots.scarfTop, side = new THREE.Vector3(0.13, 0, 0);
    const c = cloths.add(new HangingCloth(scene, { a: t.clone().sub(side), b: t.clone().add(side), length: 1.15, cols: 4, rows: 10, color: '#5fb7ad', color2: '#e6875f', pins: [1, 2], droop: 0.02, floor: parents.floor, name: 'scarf' }));
    indoorCloths.add(c);
  }

  // the parents' stone in the front yard, and what lies on it
  const tomb = buildTomb(scene, mat);
  yield;
  {
    const laid = stoneTokens();
    if (laid.length || game.flag('ending.done')) tomb.fill(laid, { reel: !!game.flag('ending.final') });
    tomb.fillFlowers(game.flag('home.flowers') ?? []);
    if (game.flag('home.lou.drawing')) tomb.addDrawing();
  }
  // shrubs, round as the house
  yield;
  for (const [x, z, r, c] of [[-9.5, 22.5, 1.4, teal], [-15, 40, 1.8, tealDark], [-4, 45, 2.0, teal], [22, 10, 1.2, lilac], [-22, 8, 1.5, teal], [9, 46, 1.4, lilac], [24.5, 30, 1.1, tealDark]]) {
    yield;
    const g = new THREE.SphereGeometry(r, 14, 10);
    jitter(g, 0.12 * r, 1.4, x * 7 + z);
    smallProps.push(add(g, c, x, H(x, z) + r * 0.7, z));
  }

  // ---------------------------------------------------------- the umbrella tree
  yield;
  {
    const x = -13, z = 36, y = H(x, z);
    const trunk = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.6, 7, 0.2), new THREE.Vector3(-0.4, 14, -0.3), new THREE.Vector3(0.8, 21, 0)]);
    add(new THREE.TubeGeometry(trunk, 16, 0.45, 8, false), mat('#8a5a3c'), x, y, z);
    const canopy = mergeGeometries([new THREE.CylinderGeometry(7.5, 8.5, 1.1, 28).translate(0.8, 21.4, 0).toNonIndexed(),
      new THREE.CylinderGeometry(4.2, 5, 0.9, 22).translate(-0.6, 15.5, 1).toNonIndexed()]);
    add(canopy, mat('#3f9f98', { color2: '#5fb7ad' }), x, y, z);
    add(new THREE.CylinderGeometry(8.6, 8.6, 0.25, 28), mat('#f2c49a', { flat: true }), x + 0.8, y + 20.75, z);   // the canopy's pale underside
    // Lou's swing, from the lower canopy
    for (const s of [-1, 1]) add(new THREE.CylinderGeometry(0.012, 0.012, 13.2, 4), ink, x - 1.6 + s * 0.35, 15.5 - 6.6, z + 2.4).userData.noCollide = true;
    add(new THREE.BoxGeometry(0.85, 0.06, 0.3), mat('#c8483a', { flat: true }), x - 1.6, 2.3, z + 2.4).userData.noCollide = true;
  }

  // ---------------------------------------------------------- far away: mesas, lilac with distance
  yield;
  {
    const parts = [];
    for (let i = 0; i < 11; i++) {
      const a = i * 0.83 + 0.4, r = 520 + (i % 3) * 70;
      const x = Math.cos(a) * r, z = Math.sin(a) * r, w = 55 + (i % 4) * 22, h = 34 + (i % 5) * 14;
      parts.push(new THREE.CylinderGeometry(w * 0.82, w, h, 9, 1).translate(x, H(x, z) + h / 2 - 6, z).toNonIndexed());
    }
    const mesas = add(mergeGeometries(parts), mat('#b9a3c9', { color2: '#d8b7c4', color3: '#9a8fb8', mode: MODE_STRATA, strataSize: 9 }));
    mesas.userData.noCollide = true;
  }

  // ---------------------------------------------------------- indoors: no weather, and the camera comes in close
  yield;
  const indoorAt = (p) => (parents.indoor(p) ? 'parents' : small.indoor(p) ? 'small' : null);
  const offIndoors = addIndoors((p) => parents.indoor(p, 0.3) || small.indoor(p, 0.3));
  void offIndoors;   // (gone with the page: a level lives as long as it)
  yield;
  for (const c of cloths.list) c.indoor = indoorCloths.has(c);
  let wasIn = null;
  const level = {
    id: 'home',
    ground: terrain,
    spawn: new THREE.Vector3(9, H(9, -1), -1),
    spawnHeading: Math.PI,
    camYaw: 0,
    shipSite: { ...HOME_SPOTS.ship },
    tomb,
    home: { parents, small, garden, cloths, indoorAt, furnish },
    features: { mount: false, wind: true, jetpack: false, climb: true, sky: true },
    limit: Infinity,
    killY: -Infinity,
    lights,
    smallProps,
    // the grass and the flora keep off the houses, the garden's beds and the paths
    floraAvoid: (x, z, r = 0) => Math.hypot(x - HOME_SPOTS.house.x, z - HOME_SPOTS.house.z) < 11 + r || Math.hypot(x - HOME_SPOTS.small.x, z - HOME_SPOTS.small.z) < 6 + r
      || garden.inside(x, z, r + 0.3) || (Math.abs(x) < 2.2 + r && z > -5 && z < 24),
    defaults: {
      hour: 17.6, preset: 'Moebius print', cloudShadows: 0,
      look: { uLineWidth: 1.1, uLineVary: 0.2, uWobble: 0.15, uHatch: 0.55, uDots: 0, uSkyDots: 0.25 },
    },
    sky: {
      script: {
        day: ['#a9b4d8', '#f6c4ae', '#9b9cc8', '#fff6dc', '#fff0d6'],
        dusk: ['#7f8fc8', '#f2c49a', '#8a86b8', '#ffe6c0', '#ffd8a8'],     // the call screen's window: dusk blue over a peach band
        night: ['#25305a', '#4a5a8a', '#34405e', '#c8bfd8', '#f2f0e6'],
      },
      planets: [{ az: 170, el: 24, size: 9, color: '#f6efd0', craters: false }, { az: 188, el: 34, size: 4, color: '#f2c54b', craters: false }],
    },
    life: {
      flocks: [{ count: 9, color: '#2b211f', size: 0.9, radius: 70, height: [22, 46], seed: 5 }],
      motes: { count: 140, color: '#fff3d0', size: 0.04, rise: 0.08, wind: [0.3, 0.1] },
      footprints: '#c98f6a',
    },
    atmo: () => ({ tint: [1.0, 0.98, 0.98], fog: 0.5, name: 'Home' }),
    /** Indoors (either house): the rain stays out and the camera comes in over the shoulder. */
    indoorAt,
    update(dt, t, { player = null, rig = null, camera = null } = {}) {
      for (const m of movers) m(t);
      // a shut door holds you in its doorway
      if (player && parents.door.k < 0.6 && parents.inDoorway(player.pos)) {
        const out = parents.outside;
        const lim = HOME_SPOTS.door.z - 0.75;
        if (player.pos.z > lim) { player.pos.z = lim; if (player.vel) player.vel.z = Math.min(player.vel.z, 0); }
        void out;
      }
      // the camera indoors: close over the shoulder (the ship sets this in its own rooms)
      const inside = player ? indoorAt(player.pos) : null;
      if (rig && inside !== wasIn) { if (inside || wasIn) rig.indoor = !!inside; wasIn = inside; }
      cloths.update(dt, { camera, player, gust: 0.4 + 0.4 * Math.sin(t * 0.7) * Math.sin(t * 0.23), windAt: (c) => (c.indoor ? 0.04 : 1) });
    },
  };
  yield;
  return level;
}
export const createHome = stepped(buildHome);
