import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createNoise2D, fbm, smoothstep } from '../noise.js';
import { makeMaterial, MODE_TERRAIN, MODE_STRATA } from '../materials.js';
import { Terrain, jitter } from '../world.js';
import { game } from '../game-state.js';
import { items } from '../items.js';
import { buildItemModel } from '../boxes/model.js';
import { tokenList } from '../story/ending.js';

// ---------------------------------------------------------------------------
// Home: where the route begins (src/story/ending.js). Hidden, like the
// Atelier: it opens on the galactic map once enough worlds are done.
//
// A small round house on a small round hill at dusk: a cream dome with its
// round window dark and the antenna the old recorder sent through, a tall
// umbrella tree, a washing line, a stone path from the landing ring to the
// door, and two moons over a valley of peach grass and lilac mesas. Nobody
// lives there now. In the front yard stands the parents' stone (buildTomb):
// a round-topped headstone over a low slab, where the traveller sets the
// tokens he brought (src/ship/homecoming.js frames it with HOME_SPOTS). Once
// the ending is done the slab keeps them (tokenModel, tombSlots).
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
  npcs: [],   // nobody lives there now (the stone: buildTomb)
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

/** The tokens to show on the slab once the ending is done (from what you carry). */
export function tokensNow(g = game) {
  return tokenList(g.keepsakes?.() ?? [], items.owned());
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
  group.updateMatrixWorld(true);
  const stand = group.localToWorld(new THREE.Vector3(0, 0, HOME_SPOTS.tombStand));
  return {
    group, tokens,
    stand, heading: HOME_SPOTS.tombYaw + Math.PI,   // the traveller faces the stone
    slots: (n) => tombSlots(n),
    /** Set a token model down on slot i of n (tomb-local). */
    add(mesh, i, n) { const p = tombSlots(n)[i]; if (p) mesh.position.copy(p); mesh.rotation.y = (i * 1.7) % 1 - 0.5; mesh.traverse((o) => { o.userData.noCollide = true; }); tokens.add(mesh); return mesh; },
    clear() { for (const c of [...tokens.children]) tokens.remove(c); },
    /** Everything on it at once (coming back after the ending). */
    fill(list) { this.clear(); list.forEach((t, i) => this.add(tokenModel(t), i, list.length)); if (list.length) this.addReel(); },
    /** The reel, set down last, at the front. */
    addReel() { const r = reelModel(); r.position.copy(REEL_AT); tokens.add(r); return r; },
  };
}

export function createHome(scene) {
  const terrain = new Terrain({
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

  // ---------------------------------------------------------- the house
  {
    const { x, z } = HOME_SPOTS.house;
    add(new THREE.CylinderGeometry(10, 10.6, 0.9, 40), stone, x, 0.45, z);
    const dome = add(new THREE.SphereGeometry(8.4, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.86, 1), cream, x, 0.9, z);
    void dome;
    add(new THREE.TorusGeometry(8.42, 0.28, 8, 48).rotateX(Math.PI / 2), mat('#5fb7ad', { flat: true }), x, 1.6, z);   // the painted band
    // the door (facing the landing ring, -z): an arch of ink in a frame of terracotta
    const door = mergeGeometries([new THREE.BoxGeometry(2.0, 2.6, 0.6).translate(0, 1.3, 0).toNonIndexed(),
      new THREE.CylinderGeometry(1.0, 1.0, 0.6, 20, 1, false, 0, Math.PI).rotateX(Math.PI / 2).rotateZ(Math.PI / 2).translate(0, 2.6, 0).toNonIndexed()]);
    add(door, ink, x, 0.9, HOME_SPOTS.door.z - 0.15);
    const frame = mergeGeometries([new THREE.BoxGeometry(2.7, 3.0, 0.4).translate(0, 1.5, 0).toNonIndexed(),
      new THREE.CylinderGeometry(1.35, 1.35, 0.4, 20, 1, false, 0, Math.PI).rotateX(Math.PI / 2).rotateZ(Math.PI / 2).translate(0, 3.0, 0).toNonIndexed()]);
    add(frame, terracotta, x, 0.9, HOME_SPOTS.door.z + 0.12);
    // the round window, the lamp behind it out
    const az = 0.55, el = 0.42;
    const dir = new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el) * 0.86, -Math.cos(az) * Math.cos(el));
    const at = new THREE.Vector3(x, 0.9, z).add(new THREE.Vector3(dir.x * 8.47, dir.y * 8.47, dir.z * 8.47));
    const win = add(new THREE.CircleGeometry(1.5, 32), mat('#4a5a8a', { flat: true }), at.x, at.y, at.z);   // dark: nobody lives here now
    win.lookAt(at.clone().add(new THREE.Vector3(dir.x, dir.y / 0.74, dir.z)));
    win.userData.noCollide = true;
    const ring = add(new THREE.TorusGeometry(1.55, 0.18, 8, 32), iron, 0, 0, 0);
    ring.position.copy(win.position); ring.quaternion.copy(win.quaternion);
    // the lamp by the door
    add(new THREE.CylinderGeometry(0.08, 0.08, 2.6, 6), iron, x + 2.2, 0.9 + 1.3, HOME_SPOTS.door.z - 0.6);
    add(new THREE.SphereGeometry(0.3, 12, 8), mat('#ffe6b0', { glow: 1 }), x + 2.2, 0.9 + 2.75, HOME_SPOTS.door.z - 0.6);
    lights.push(new THREE.Vector4(x + 2.2, 3.4, HOME_SPOTS.door.z - 1.2, 8));
    // the antenna on top: a mast and a little dish turned to the sky, the old recorder's
    add(new THREE.CylinderGeometry(0.12, 0.18, 6, 8), iron, x - 1.5, 7.2 + 3, z + 1);
    const dish = add(new THREE.ConeGeometry(1.4, 0.7, 20, 1, true), mat('#f3ead8', { side: THREE.DoubleSide, metal: 'painted' }), x - 1.5, 13.4, z + 1);
    dish.rotation.set(Math.PI + 0.6, 0, 0.3);
    const blink = add(new THREE.SphereGeometry(0.16, 8, 6), mat('#e6503a', { glow: 1 }), x - 1.5, 13.3 + 0.1, z + 1);
    movers.push((t) => { blink.visible = Math.sin(t * 2.2) > -0.2; });
    // the annex: a small dome for the store
    add(new THREE.SphereGeometry(3.6, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.9, 1), mat('#efe0c4'), x + 10.5, 0, z + 3);
    add(new THREE.TorusGeometry(3.62, 0.18, 6, 32).rotateX(Math.PI / 2), terracotta, x + 10.5, 0.7, z + 3);
    // a bench by the door, where somebody sits to watch the sky
    add(new THREE.BoxGeometry(3, 0.25, 0.9), mat('#8a5a3c', { flat: true }), x - 5.2, 0.9 + 0.75, HOME_SPOTS.door.z + 0.9).rotation.y = 0.35;
    for (const s of [-1, 1]) add(new THREE.BoxGeometry(0.25, 0.75, 0.8), mat('#8a5a3c', { flat: true }), x - 5.2 + s * 1.3 * Math.cos(0.35), 0.9 + 0.37, HOME_SPOTS.door.z + 0.9 - s * 1.3 * Math.sin(0.35));
  }

  // ---------------------------------------------------------- the yard
  // the landing ring, where the ship stands
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
  for (let i = 0; i < 9; i++) {
    const k = i / 8, z = -4 + k * 27.5, x = Math.sin(k * 3) * 0.8;
    const s = add(new THREE.CylinderGeometry(0.9 + (i % 3) * 0.12, 1, 0.16, 10), stone, x + (i % 2 ? 0.5 : -0.5), 0.05, z);
    s.rotation.y = i;
    smallProps.push(s);
  }
  // a low curved wall round the yard, open towards the ring
  {
    const parts = [];
    const r = 26, c = HOME_SPOTS.house;
    for (let a = 0.5; a <= Math.PI * 2 - 0.5; a += 0.105) {   // a: from the front (-z) round; the front stays open
      parts.push(new THREE.BoxGeometry(2.8, 1.1, 0.9).rotateY(-a).translate(c.x + Math.sin(a) * r, 0.55, c.z - Math.cos(a) * r).toNonIndexed());
    }
    add(mergeGeometries(parts), stone);
  }
  // the washing line: three cloths in the colours of the backpack's first fluid
  {
    const p0 = new THREE.Vector3(-12, 0, 18), p1 = new THREE.Vector3(-20, 0, 30);
    for (const p of [p0, p1]) add(new THREE.CylinderGeometry(0.1, 0.12, 3.4, 6), mat('#8a5a3c', { flat: true }), p.x, 1.7, p.z);
    const line = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, p0.distanceTo(p1), 4), ink);
    line.position.copy(p0).lerp(p1, 0.5).setY(3.3);
    line.lookAt(p1.x, 3.3, p1.z); line.rotateX(Math.PI / 2);
    line.userData.noCollide = true;
    scene.add(line);
    ['#5fd0c6', '#8a6fb8', '#f2c54b'].forEach((c, i) => {
      const cloth = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.9).translate(0, -0.95, 0), mat(c, { side: THREE.DoubleSide, flat: true }));
      cloth.position.copy(p0).lerp(p1, 0.25 + i * 0.25).setY(3.28);
      cloth.lookAt(cloth.position.clone().add(new THREE.Vector3(p1.z - p0.z, 0, -(p1.x - p0.x))));
      cloth.userData.noCollide = true;
      scene.add(cloth);
      const base = cloth.rotation.x;
      movers.push((t) => { cloth.rotation.x = base + Math.sin(t * 1.3 + i) * 0.12; });
    });
  }
  // the parents' stone in the front yard, and the tokens on it once you have been home
  const tomb = buildTomb(scene, mat);
  if (game.flag('ending.done')) tomb.fill(tokensNow());
  // shrubs, round as the house
  for (const [x, z, r, c] of [[-9.5, 22.5, 1.4, teal], [7, 21, 1.1, tealDark], [14, 26, 1.6, teal], [-15, 40, 1.8, tealDark], [16, 42, 1.3, lilac], [-4, 45, 2.0, teal], [22, 10, 1.2, lilac], [-22, 8, 1.5, teal]]) {
    const g = new THREE.SphereGeometry(r, 14, 10);
    jitter(g, 0.12 * r, 1.4, x * 7 + z);
    smallProps.push(add(g, c, x, H(x, z) + r * 0.7, z));
  }

  // ---------------------------------------------------------- the umbrella tree
  {
    const x = -13, z = 36, y = H(x, z);
    const trunk = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.6, 7, 0.2), new THREE.Vector3(-0.4, 14, -0.3), new THREE.Vector3(0.8, 21, 0)]);
    add(new THREE.TubeGeometry(trunk, 16, 0.45, 8, false), mat('#8a5a3c'), x, y, z);
    const canopy = mergeGeometries([new THREE.CylinderGeometry(7.5, 8.5, 1.1, 28).translate(0.8, 21.4, 0).toNonIndexed(),
      new THREE.CylinderGeometry(4.2, 5, 0.9, 22).translate(-0.6, 15.5, 1).toNonIndexed()]);
    add(canopy, mat('#3f9f98', { color2: '#5fb7ad' }), x, y, z);
    add(new THREE.CylinderGeometry(8.6, 8.6, 0.25, 28), mat('#f2c49a', { flat: true }), x + 0.8, y + 20.75, z);   // the canopy's pale underside
  }

  // ---------------------------------------------------------- far away: mesas, lilac with distance
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

  return {
    id: 'home',
    ground: terrain,
    spawn: new THREE.Vector3(9, H(9, -1), -1),
    spawnHeading: Math.PI,
    camYaw: 0,
    shipSite: { ...HOME_SPOTS.ship },
    tomb,
    features: { mount: false, wind: true, jetpack: false, climb: true, sky: true },
    limit: Infinity,
    killY: -Infinity,
    lights,
    smallProps,
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
    update(dt, t) { for (const m of movers) m(t); },
  };
}
