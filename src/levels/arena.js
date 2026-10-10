import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeMaterial, MODE_TERRAIN, MODE_STRATA } from '../materials.js';
import { Terrain } from '../world.js';
import { stepped } from '../load-steps.js';
import { DESERT_WORLD_LOOK } from '../desert-sites.js';
import { placeGameMarker } from '../minigames/kit/marker.js';
import { WORLDS } from '../foe-worlds.js';
import { parseKind } from '../enemies/archetypes.js';
import { FOES } from '../foes.js';
import { FoeList } from '../foe-spawner.js';
import { gameById } from '../minigames/index.js';   // (none in node's tests: there is no glob there)
import { placeHitboxBoard } from './arena-hitbox-board.js';

// ---------------------------------------------------------------------------
// The Arena: a developer's world for the fluid blade and the foes (src/fluid-blade.js, src/foes.js),
// reached only from the worlds list (?level=arena). A real arena (v1.39): a round fighting floor of raked, packed
// sand with its ring markings (the border, the waves' ring, the centre mark and ticks), a low stone wall round it with
// three tiers of stone seats behind, two gates (north and south) under lintels, braziers burning at the gates and
// banners on poles along the top tier. Nothing grows or stands on the floor (level.keepClear: no responsive flowers,
// flora or wildlife inside the stands); the open desert beyond. All of it is a handful of merged meshes and no light.
// The foes come in waves round you, one after another, whatever the Enemies setting (level.foes.waves: src/foes.js).
// ---------------------------------------------------------------------------

/**
 * The arena's plan (m, round the origin; the gates at +z, south, behind the spawn, and -z, north):
 * floor the fighting floor's radius; wall [inner radius, height]; tiers [outer radius, height] each, stepping up
 * and out; gate the gates' half width; clear how far keepClear keeps the floor and the stands bare.
 */
export const ARENA = {
  floor: 40,
  wall: [40, 1.8],
  tiers: [[41, 1.8], [43.5, 2.7], [46, 3.6], [48.5, 4.5]],
  gate: 3.2,
  clear: 50,
  marks: { border: [38.4, 39], waves: [17.6, 18], centre: [1.5, 1.8] },
};
/** No scatter here (src/reactive-world.js, src/flora.js, src/wildlife.js read level.keepClear): the floor and the stands. */
export const arenaKeepClear = (p) => Math.hypot(p.x, p.z) < ARENA.clear;

/** The stands' cross-section (radius, height), wall face to the back, closed down to the ground. */
function standsProfile() {
  const [r0, h0] = ARENA.wall, pts = [[r0, 0], [r0, h0]];
  let y = h0;
  for (let i = 1; i < ARENA.tiers.length; i++) { const [r, h] = ARENA.tiers[i]; pts.push([ARENA.tiers[i - 1][0], y]); pts.push([ARENA.tiers[i - 1][0], h]); y = h; pts.push([r, h]); }
  pts.push([ARENA.tiers.at(-1)[0], 0]);
  // (the doubled corners dropped; from the back round to the wall's foot, so the lathe's faces look out of the stone)
  return pts.filter((p, i) => i === 0 || p[0] !== pts[i - 1][0] || p[1] !== pts[i - 1][1]).reverse();
}

/** The stone: the wall and its tiers in two arcs between the gates (flat-faced), their ends capped, the gates' piers and lintels. */
function standsGeometry() {
  const prof = standsProfile(), parts = [];
  const half = ARENA.gate / ARENA.floor + 0.02;   // (the gap's half angle at the wall)
  for (const start of [half, Math.PI + half]) {
    const len = Math.PI - 2 * half;
    parts.push(new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), 48, start, len).toNonIndexed());
    // the arc's two ends: its cross-section, faced out of it
    for (const [phi, end] of [[start, false], [start + len, true]]) {
      // (in the xy plane: x the radius, y up, facing +z; turned so x runs out along the radius at phi, it faces back
      // along the arc: right for its start; its end's is turned over, x mirrored back: the same place, facing on)
      const cap = new THREE.ShapeGeometry(new THREE.Shape(prof.map(([r, y]) => new THREE.Vector2(r, y))));
      if (end) cap.rotateY(Math.PI).scale(-1, 1, 1);
      parts.push(cap.rotateY(phi - Math.PI / 2).toNonIndexed());
    }
  }
  // the gates: a pier each side and a lintel over, the south one with steps down into it
  for (const phi of [0, Math.PI]) {
    const c = new THREE.Vector3(Math.sin(phi), 0, Math.cos(phi)), side = new THREE.Vector3(c.z, 0, -c.x);
    for (const s of [-1, 1]) {
      const at = c.clone().multiplyScalar(ARENA.floor + 1.2).addScaledVector(side, s * (ARENA.gate + 0.7));
      parts.push(new THREE.BoxGeometry(1.6, 5.6, 2.6).rotateY(phi).translate(at.x, 2.8, at.z).toNonIndexed());
      parts.push(new THREE.BoxGeometry(2.0, 0.4, 3.0).rotateY(phi).translate(at.x, 5.8, at.z).toNonIndexed());
    }
    const top = c.clone().multiplyScalar(ARENA.floor + 1.2);
    parts.push(new THREE.BoxGeometry(2 * ARENA.gate + 3.4, 1.1, 2.4).rotateY(phi).translate(top.x, 6.5, top.z).toNonIndexed());
  }
  for (const g of parts) { g.deleteAttribute('uv'); g.computeVertexNormals(); }
  return mergeGeometries(parts);
}

/**
 * The floor's markings painted into the floor (v1.41; the author: "shimmering arena ground lines when approaching or
 * walking away"): the same border, waves' ring, centre ring and cross, ticks and gate bars as markingsGeometry, drawn
 * into a texture over the floor's disc (`size` texels across its 2 × `R` m) with their edges' coverage worked out per
 * texel, multiplied into the sand's colour (makeMaterial `map`), mipmapped and filtered at a slant. A line far off now
 * thins and fades as the mip levels average it, where the strips of geometry 2 cm over the sand (v1.39) were a pixel or
 * two tall at 20 m and broke into dashes that crawled as the camera moved (their two ink edges and the colour between
 * them falling on or off the pixels): 523 changed pixels a frame on the floor walking back 4 cm a frame, 0 without them.
 * The paint is a dark umber near the ink's (it was a mid brown, #8a6a48, whose strips read as ink lines anyway): the
 * band's fill and the ink pass's lines along its edges are then one tone, and a line coming or going inside it barely
 * shows. Measured walking back 4 cm a frame (the floor's band of the screen, pixels changing a lot between frames):
 * 523 a frame with the strips, 171 painted in (230 with the old brown paint).
 * Returns a THREE.DataTexture (RGBA, the mark's colour over the sand's as a factor; white where there is none).
 */
export function markingsTexture(size = 1024, R = ARENA.floor + 0.2, { mark = '#4d3b2b', sand = '#f1dcb0' } = {}) {
  const M = ARENA.marks, px = (2 * R) / size, data = new Uint8Array(size * size * 4);
  const m = new THREE.Color(mark), s0 = new THREE.Color(sand);
  const f = [m.r / s0.r, m.g / s0.g, m.b / s0.b].map((x) => Math.min(1, x));
  // the shapes, as markingsGeometry lays them: rings [inner, outer], and rects { w, h, d, a } (w across, h along the
  // radius, centred d m out at angle a: PlaneGeometry(w, h) laid flat, moved out along +z, turned a about y)
  const rings = [M.border, M.waves, M.centre];
  const rects = [];
  for (let i = 0; i < 4; i++) rects.push({ w: 0.26, h: 2.6, d: M.centre[1] + 1.6, a: i * Math.PI / 2 });
  for (let i = 0; i < 16; i++) rects.push({ w: 0.3, h: 1.8, d: M.border[0] - 1.2, a: (i + 0.5) * Math.PI / 8 });
  for (const a of [0, Math.PI]) rects.push({ w: 2 * ARENA.gate, h: 0.5, d: M.border[1] + 0.6, a });
  for (const r of rects) { r.c = Math.cos(r.a); r.s = Math.sin(r.a); }
  const cover = (d) => Math.min(1, Math.max(0, d / px + 0.5));   // (a signed distance inside the shape, m: its share of the texel)
  for (let j = 0; j < size; j++) {
    // (the disc's uv: u along x, v up its plane, which lies as -z: CircleGeometry turned flat)
    const z = -((j + 0.5) / size * 2 - 1) * R;
    for (let i = 0; i < size; i++) {
      const x = ((i + 0.5) / size * 2 - 1) * R, r = Math.hypot(x, z);
      let k = 0;
      for (const [a, b] of rings) { if (r > a - px && r < b + px) k = Math.max(k, cover(Math.min(r - a, b - r))); }
      if (k < 1 && (r < M.centre[1] + 3.2 || r > M.border[0] - 2.4)) for (const q of rects) {   // (the rects lie only near the centre and the border)
        // (into the rect's frame: turned back by its angle; PlaneGeometry.rotateY(a) maps (x, z) to (x c + z s, -x s + z c))
        const u = x * q.c - z * q.s, v = x * q.s + z * q.c - q.d;
        if (Math.abs(u) > q.w / 2 + px || Math.abs(v) > q.h / 2 + px) continue;
        k = Math.max(k, cover(Math.min(q.w / 2 - Math.abs(u), q.h / 2 - Math.abs(v))));
      }
      const o = (j * size + i) * 4;
      data[o] = Math.round(255 * (1 - k + k * f[0])); data[o + 1] = Math.round(255 * (1 - k + k * f[1])); data[o + 2] = Math.round(255 * (1 - k + k * f[2])); data[o + 3] = 255;
    }
  }
  const t = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  // (mipmapped and filtered at a slant: far off the line is averaged into a continuous band instead of a pixel or two
  // that come and go; a faded mip chain was tried and was worse: a half-contrast band is still over the ink pass's
  // colour-edge threshold, and its two edge lines then crawled inside it)
  t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter; t.anisotropy = 8;
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; t.needsUpdate = true;
  t.name = 'arena markings';
  return t;
}

/** The floor's markings as strips of geometry over the sand (v1.39 to v1.40; kept for the markings' shape in tests). */
export function markingsGeometry() {
  const M = ARENA.marks, parts = [];
  const ring = ([a, b], n = 128) => new THREE.RingGeometry(a, b, n).rotateX(-Math.PI / 2);
  parts.push(ring(M.border), ring(M.waves, 96), ring(M.centre, 48));
  for (let i = 0; i < 4; i++) parts.push(new THREE.PlaneGeometry(0.26, 2.6).rotateX(-Math.PI / 2).translate(0, 0, M.centre[1] + 1.6).rotateY(i * Math.PI / 2));
  // sixteen ticks inward from the border, and a broad bar across each gate's mouth
  for (let i = 0; i < 16; i++) parts.push(new THREE.PlaneGeometry(0.3, 1.8).rotateX(-Math.PI / 2).translate(0, 0, M.border[0] - 1.2).rotateY((i + 0.5) * Math.PI / 8));
  for (const phi of [0, Math.PI]) parts.push(new THREE.PlaneGeometry(2 * ARENA.gate, 0.5).rotateX(-Math.PI / 2).translate(0, 0, M.border[1] + 0.6).rotateY(phi));
  return mergeGeometries(parts.map((g) => { const n = g.index ? g.toNonIndexed() : g; n.deleteAttribute('uv'); return n; }));
}

/** Braziers at the gates (bronze bowls on stone drums, a still flame in each: glowing, no light) and banner poles on the top tier. */
function furniture() {
  const bronze = [], flame = [], wood = [], red = [], teal = [];
  for (const phi of [0, Math.PI]) {
    const c = new THREE.Vector3(Math.sin(phi), 0, Math.cos(phi)), side = new THREE.Vector3(c.z, 0, -c.x);
    for (const s of [-1, 1]) {
      const at = c.clone().multiplyScalar(ARENA.floor - 1.4).addScaledVector(side, s * (ARENA.gate + 0.9));
      bronze.push(new THREE.CylinderGeometry(0.45, 0.6, 1.1, 10).translate(at.x, 0.55, at.z));
      bronze.push(new THREE.CylinderGeometry(0.75, 0.42, 0.45, 12, 1, true).translate(at.x, 1.32, at.z));
      bronze.push(new THREE.TorusGeometry(0.75, 0.06, 4, 16).rotateX(Math.PI / 2).translate(at.x, 1.55, at.z));
      flame.push(new THREE.ConeGeometry(0.42, 1.1, 7).translate(at.x, 1.95, at.z));
      flame.push(new THREE.ConeGeometry(0.24, 0.8, 6).translate(at.x + 0.18, 1.85, at.z - 0.12));
    }
  }
  // banners on poles along the top tier, red and teal by turns (none over the gates)
  const [rTop, hTop] = ARENA.tiers.at(-1);
  for (let i = 0; i < 12; i++) {
    const phi = (i + 0.5) * (Math.PI / 6), c = new THREE.Vector3(Math.sin(phi), 0, Math.cos(phi));
    const at = c.clone().multiplyScalar(rTop - 1.0);
    wood.push(new THREE.CylinderGeometry(0.09, 0.12, 6.5, 6).translate(at.x, hTop + 3.25, at.z));
    wood.push(new THREE.BoxGeometry(1.7, 0.1, 0.1).rotateY(phi).translate(at.x, hTop + 6.1, at.z));
    // the cloth hangs from the crossbar, toward the floor, a swallow-tailed end
    const s = new THREE.Shape();
    s.moveTo(-0.8, 0); s.lineTo(0.8, 0); s.lineTo(0.8, -3.4); s.lineTo(0, -2.8); s.lineTo(-0.8, -3.4); s.lineTo(-0.8, 0);
    const cloth = new THREE.ShapeGeometry(s).rotateY(phi + Math.PI).translate(at.x - c.x * 0.14, hTop + 6.0, at.z - c.z * 0.14);
    (i % 2 ? teal : red).push(cloth);
  }
  return { bronze, flame, wood, red, teal };
}

export function* buildArena(scene) {
  const query=new URLSearchParams(typeof location==='undefined'?'':location.search);
  // (enemies.html's links: ?enemy=lizard@bazaar one archetype in a skin, again and again; ?enemyWorld=bazaar that world's waves)
  const world = WORLDS[query.get('enemyWorld')] ? query.get('enemyWorld') : null;
  const kind = FOES[parseKind(query.get('enemy')).kind] ? query.get('enemy') : null;
  // the FOES list (src/foe-spawner.js): a menu of the level's, as the Arcade's board (D-pad ↓, K), and the guardians' ring
  const foeList = new FoeList();
  const terrain = yield* Terrain.make({
    size: 900, seg: 90,
    height: (x, z) => { const r = Math.hypot(x, z); return r < 150 ? 0 : (r - 150) * 0.07; },   // flat out to 150 m, a low rise at the edge: the open sky all round
    // the desert's golden sand (its ripples and inked grain), bright under the open sky
    material: { color: '#efd29b', color2: '#f5e1b6', color3: '#dca57a', mode: MODE_TERRAIN, ripples: true, sandInk: true },
  });
  scene.add(terrain.mesh);
  const stone = makeMaterial({ color: '#b9a88e', color2: '#a29177', color3: '#8f7f66', mode: MODE_STRATA, strataSize: 1.2 });
  yield;
  // the fighting floor: raked, packed sand a shade paler than the desert's, flat to the wall (drawn over the ground,
  // which stays the solid floor), and its markings on it
  // (the markings painted into it: markingsTexture, mipmapped, so far-off lines fade rather than flicker)
  const floor = new THREE.Mesh(new THREE.CircleGeometry(ARENA.floor + 0.2, 128).rotateX(-Math.PI / 2), makeMaterial({ color: '#f1dcb0', color2: '#e8cd99', key: 'arena.floor', map: markingsTexture() }));
  floor.position.y = 0.015; floor.userData.noCollide = true; floor.name = 'Arena floor';
  floor.userData.markings = true;
  // the wall and its tiers of stone seats, the two gates
  const stands = new THREE.Mesh(standsGeometry(), stone);
  stands.name = 'Arena stands';
  scene.add(floor, stands);
  yield;
  // braziers at the gates (their flames glow: no light) and the banners along the top tier, a mesh per material
  const F = furniture(), solid = [];
  const mats = {
    bronze: makeMaterial({ color: '#a9783e', flat: true, metal: 'brass', key: 'arena.bronze' }),
    flame: makeMaterial({ color: '#ffb347', flat: true, glow: 1, key: 'arena.flame' }),
    wood: makeMaterial({ color: '#5b4632', key: 'arena.wood' }),
    red: makeMaterial({ color: '#c4553a', side: THREE.DoubleSide, key: 'arena.banner.red' }),
    teal: makeMaterial({ color: '#3f9a92', side: THREE.DoubleSide, key: 'arena.banner.teal' }),
  };
  for (const [k, list] of Object.entries(F)) {
    const m = new THREE.Mesh(mergeGeometries(list.map((g) => { const n = g.index ? g.toNonIndexed() : g; n.deleteAttribute('uv'); if (n.attributes.normal) n.deleteAttribute('normal'); n.computeVertexNormals(); return n; })), mats[k]);
    m.name = `Arena ${k}`;
    if (k === 'flame' || k === 'red' || k === 'teal') m.userData.noCollide = true;
    solid.push(m);
  }
  scene.add(...solid);
  yield;
  // the arcade sign of Ink tide, the endless waves as a game with a score (src/minigames/waves.js), by the way in
  // (at the floor's edge by the south gate, facing the middle: the floor itself is kept clear)
  if (gameById('waves')) placeGameMarker({ scene, levelId: 'arena' }, 'waves', new THREE.Vector3(6.5, 0, 35.5), { heading: Math.atan2(-6.5, -35.5) });
  // the hitbox board (src/hitboxes.js), across the gate from it: show or hide the fight's hitboxes
  placeHitboxBoard(scene, new THREE.Vector3(-6.5, 0, 35.5), { heading: Math.atan2(6.5, -35.5) });

  return {
    id: 'arena',
    ground: terrain,
    spawn: new THREE.Vector3(0, 0, 6),
    spawnHeading: Math.PI,
    camYaw: 0,
    features: { mount: false, wind: false, jetpack: true, climb: true },
    defaults: { hour: 9.5, preset: 'Moebius print', cloudShadows: 0, look: DESERT_WORLD_LOOK },   // (the desert's print: bright sand, a blue sky)
    killY: -Infinity,
    keepClear: arenaKeepClear,   // (no responsive flowers, flora or wildlife on the floor or the stands)
    foes: { waves: true, chimes: 'training', ...(world ? { world } : {}), ...(kind ? { kind } : {}) },   // (chimes: into the wallet, not counted as earned: src/chimes.js)
    lendTool: { mode: null },   // (main.js: the backpack lent for the visit, so the blade and the shield are there on any save; nothing written to it)
    // the desert's print: a flat cerulean sky over cream sand
    sky: {
      script: {
        day: ['#92b6c5', '#d7dfd9', '#93a6cf', '#fff9ee', '#fff6dc'],
        dusk: ['#7f8fc8', '#f2c49a', '#8a7fb8', '#ffe0c0', '#ffe2b8'],
        night: ['#1d2a52', '#4a5a8a', '#3d4380', '#8e9ccc', '#f2f0e6'],
      },
    },
    atmo: () => ({ tint: [1, 1, 1], fog: 1.0, name: 'The Arena' }),   // (as the desert's golden dunes)
    quickMenu: foeList,   // (main.js: one of its menus; D-pad ↓ opens it, the mount's call: there is none here; main.js attaches the foes)
    dynamic: () => foeList.solids(),   // (a guardian called into its ring is solid: src/arena-guardians.js)
    update(dt, t) { foeList.update(dt, t); },
  };
}
export const createArena = stepped(buildArena);
