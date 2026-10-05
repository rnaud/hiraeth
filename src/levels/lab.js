import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeMaterial, MODE_TERRAIN, MODE_STRATA, MODE_WATER } from '../materials.js';
import { Terrain, jitter, soften } from '../world.js';
import { textGeometry } from '../story/sign-text.js';
import { colourScript } from '../timeofday.js';
import { WILDLIFE } from '../wildlife/species.js';
import { RoomKit } from './lab-kit.js';
import { ROOMS } from './lab-rooms.js';
import { FACE_PRESETS } from '../morph.js';
import { TONE_EXPRESSIONS } from '../expression.js';
import { TRAVELLER } from '../traveller.js';

// ---------------------------------------------------------------------------
// The Lab: a developer's world for looking at the game's surfaces, faces and
// worlds, away from any story (?level=lab, or the worlds list, L). The hub is
// a pale grey floor under a plain sky with two galleries and a row of doors:
//
//   the materials row  pedestals along -z, each with a sphere, a cube and a knot
//                      in one surface (LAB_MATERIALS), its name cut in the plinth;
//                      a swimming pool and a cloud at the ends of the row
//   the faces gallery  giant villagers (4x) in an arc along +z, facing the hub, every face
//                      variant with an expression, its name on the floor (LAB_FACES), so the
//                      faces' ink can be studied close up (content.js)
//   the doors          an arc of little doorways behind the faces, one per world,
//                      its name over the lintel (LAB_DOORS)
//
// Each door leads to a biome room (src/levels/lab-rooms.js): a compact sample
// of that world, its ground, sky, light and ink, its rocks, buildings, plants,
// creatures and people. The rooms lie far apart on a ring round the hub
// (ROOM_RING), so only the one you are in is drawn: the others' groups are
// hidden, their plants and creatures are past their drawing distance, their
// people past theirs. Walking into a door is a quick fade and you come out at
// your own pace; inside a room the sky, haze, planets, hour and ink style
// switch to its world's (atmo and zoneAt), and a door behind you leads home.
//
// Add a surface to LAB_MATERIALS to see it beside the others in every light
// (the time of day still runs: the sun and the shadows move over the row).
// ---------------------------------------------------------------------------

const FLOOR = '#d9d6cf';

/** The surfaces on show: a name and makeMaterial options. */
export const LAB_MATERIALS = [
  { name: 'flat', o: { color: '#e6875f', flat: true } },
  { name: 'smooth', o: { color: '#e6875f' } },
  { name: 'rock strata', o: { color: '#c98f64', color2: '#b0714e', color3: '#8f5a3e', mode: MODE_STRATA, strataSize: 0.8 } },
  { name: 'cracked', o: { color: '#25386c', flat: true, pattern: 'cracks' } },
  { name: 'facade', o: { color: '#f3ead8', color2: '#d8cfbd', flat: true, pattern: 'facade' } },
  { name: 'tiles', o: { color: '#c8673f', flat: true, pattern: 'tiles' } },
  { name: 'leaves', o: { color: '#5e7a3a', flat: true, pattern: 'leaves' } },
  { name: 'brush', o: { color: '#8a6fb8', scrub: true } },
  { name: 'grid', o: { color: '#f4f0e6', grid: 1 } },
  { name: 'glyphs', o: { color: '#e9dcc4', flat: true, grid: 0.9, glyphs: true } },
  { name: 'glow', o: { color: '#70e7df', flat: true, glow: 1 } },
  { name: 'lamp', o: { color: '#ffd27a', glow: 1 } },
  { name: 'steel', o: { metal: 'steel' } },
  { name: 'brushed', o: { metal: 'steel', brushed: true } },
  { name: 'chrome', o: { metal: 'chrome' } },
  { name: 'brass', o: { metal: 'brass' } },
  { name: 'copper', o: { metal: 'copper' } },
  { name: 'iron', o: { metal: 'iron' } },
  { name: 'painted', o: { metal: 'painted', color: '#3f6fb0' } },
  { name: 'dissolve', o: { color: '#25386c', flat: true, dissolve: '#fff4d6' } },
];

const SPACING = 9;

/**
 * The faces gallery: giant villagers (4x) on plinths in an arc behind the spawn, facing the hub,
 * every face variant (morph.js FACE_PRESETS and the traveller's own) once, each with an expression
 * (expression.js TONE_EXPRESSIONS), men and women, so the faces' ink (face-ink.js) can be studied
 * close up. Their names are on the floor in front of them. { variant, tone, kind, head, palette,
 * at: [x, z], facing (rad), face, expression }
 */
const FACE_RING = { radius: 46, from: -64, to: 64 };
/** The walkway in front of the giants, at the height of their faces (m): radii, height, the ramp up to it (at a = 0). */
export const FACE_WALK = { inner: 41.4, outer: 43.9, height: 5.1, ramp: { length: 15, width: 3, half: 2.4 } };
const SKINS = ['#e8c6a8', '#c58c64', '#f0d2b8', '#8a5a3c', '#d9a98a', '#a8714c'];
const CLOTHES = [{ cloak: '#d8a24a', cloth: '#f3ead8', legs: '#2b2f45' }, { cloak: '#8a6fb8', cloth: '#e2d3b4', legs: '#2b2f45' },
  { cloak: '#5fb7ad', cloth: '#5a4a3a', legs: '#3a3a3a' }, { cloak: '#c8483a', cloth: '#f3ead8', legs: '#2b211f' }];
export const LAB_FACES = [
  { variant: 'As modelled', tone: 'neutral', kind: 'm', head: 'short' },
  { variant: 'As modelled', tone: 'happy', kind: 'f', head: 'bob' },
  { variant: 'Gaunt elder', tone: 'solemn', kind: 'm', head: 'bald' },
  { variant: 'Round, young', tone: 'playful', kind: 'f', head: 'twin' },
  { variant: 'Sharp', tone: 'angry', kind: 'm', head: 'crop' },
  { variant: 'Broad', tone: 'surprised', kind: 'm', head: 'curls' },
  { variant: 'The traveller\'s', tone: 'curious', kind: 'm', head: 'swept' },
  { variant: 'Wide-eyed', tone: 'scared', kind: 'f', head: 'long' },
  { variant: 'Freckled', tone: 'sad', kind: 'f', head: 'bun' },
  { variant: 'Weathered', tone: 'tired', kind: 'm', head: 'tonsure' },
  { variant: 'Sharp', tone: 'shout', kind: 'f', head: 'tail' },
  { variant: 'Gaunt elder', tone: 'whisper', kind: 'f', head: 'braid' },
].map((g, i, all) => {
  const a = THREE.MathUtils.degToRad(FACE_RING.from + ((FACE_RING.to - FACE_RING.from) * i) / (all.length - 1)), R = FACE_RING.radius;
  return {
    ...g, at: [Math.sin(a) * R, Math.cos(a) * R], facing: a + Math.PI,
    face: g.variant === 'The traveller\'s' ? TRAVELLER.face : FACE_PRESETS[g.variant], expression: TONE_EXPRESSIONS[g.tone],
    palette: { ...CLOTHES[i % CLOTHES.length], skin: SKINS[i % SKINS.length] },
  };
});

// ---------------------------------------------------------------------------- the rooms' layout
/** The biome rooms lie on a ring this far from the hub (m): ~1.5 km apart, well past what is drawn. */
export const ROOM_RING = 2600;
/** A room's centre in the world. */
export const roomCentre = (i) => {
  const a = (i / ROOMS.length) * Math.PI * 2;
  return new THREE.Vector3(Math.sin(a) * ROOM_RING, 0, Math.cos(a) * ROOM_RING);
};
const ROOM_SIZE = 420, ROOM_REACH = 160;   // the room's ground (m), and how far from its centre you may stray
const arriveOf = (room) => room.arrive ?? [0, 74];
/** You come out of a door this far in front of it, so the camera behind you clears its frame. */
const DOOR_BACK = 11;
/** The doors of the hub: an arc behind the faces, one per world (centre of the threshold, and the way it faces). */
export const LAB_DOORS = ROOMS.map((room, i) => {
  const a = THREE.MathUtils.degToRad(-95 + (190 * i) / (ROOMS.length - 1)), R = 64;
  return { id: room.id, title: room.title, x: Math.sin(a) * R, z: Math.cos(a) * R, heading: a + Math.PI };   // its front faces the hub's centre
});
const hubHeight = (x, z) => Math.max(0, Math.hypot(x, z) - 160) * 0.08;   // a shallow bowl beyond the galleries
/** A room's people, in the world (content.js puts them in the Lab, dressed for their world). */
export const LAB_PEOPLE = ROOMS.flatMap((room, i) => {
  const c = roomCentre(i);
  return room.people.map((p) => ({
    at: [c.x + p.at[0], c.z + p.at[1]], y: c.y + (p.y ?? room.ground?.height(p.at[0], p.at[1]) ?? room.floor ?? 0), world: room.id,
    radius: p.radius ?? 3, palette: p.palette ?? {}, head: p.head, lines: p.lines,
  }));
});

const Y = new THREE.Vector3(0, 1, 0), Z = new THREE.Vector3(0, 0, 1);
const PASS = { in: 0.18, out: 0.45 };   // s: the fade into a door, and out of it
const HUB_ZONE = { name: 'The Lab', preset: 'Viridel', hour: 11 };
const HUB_ATMO = { tint: [1, 1, 1], fog: 0.35, name: 'The Lab' };

export function createLab(scene) {
  const hub = new THREE.Group();
  hub.name = 'Lab hub';
  scene.add(hub);
  const terrain = new Terrain({
    size: 1200, seg: 60, height: hubHeight,
    material: { color: FLOOR, color2: '#cfccc4', color3: '#c4c0b6', mode: MODE_TERRAIN },
  });
  hub.add(terrain.mesh);
  const ink = makeMaterial({ color: '#2b211f', flat: true });
  const stone = makeMaterial({ color: '#efece6', flat: true });
  const movers = [];
  const lights = [], noShadow = [];

  // ---- the materials row: a pedestal, a sphere, a cube and a knot each, the name on the plinth
  const shapes = [
    new THREE.SphereGeometry(1, 32, 20).translate(0, 1, 0),
    new THREE.BoxGeometry(1.5, 1.5, 1.5).translate(0, 0.75, 0),
    new THREE.TorusKnotGeometry(0.62, 0.22, 96, 12).translate(0, 1.1, 0),
  ];
  const dissolving = [];
  LAB_MATERIALS.forEach((m, i) => {
    const x = (i - (LAB_MATERIALS.length - 1) / 2) * SPACING, z = -24;
    const mat = makeMaterial({ ...m.o, key: `lab.${m.name}` });
    if (mat.uniforms.uDissolve) dissolving.push(mat);
    const base = new THREE.Mesh(new THREE.BoxGeometry(7.2, 0.6, 3.2).translate(0, 0.3, 0), stone);
    base.position.set(x, 0, z);
    hub.add(base);
    shapes.forEach((g, k) => {
      const s = new THREE.Mesh(g, mat);
      s.position.set(x + (k - 1) * 2.4, 0.6, z);
      hub.add(s);
      if (k === 2) movers.push((t) => { s.rotation.y = t * 0.3 + i; });
    });
    const label = new THREE.Mesh(textGeometry(m.name, { width: Math.min(6.4, m.name.length * 0.62), depth: 0.03 }), ink);
    label.position.set(x, 0.3, z + 1.62);
    hub.add(label);
  });
  // the dissolve sample comes apart and back, over and over
  movers.push((t) => { for (const m of dissolving) m.uniforms.uDissolve.value.set(0.5 + 0.5 * Math.sin(t * 0.7), 0.09, 0.6, 2.6); });

  // ---- water: a swimming pool at the end of the row (src/water.js, src/swim.js). A ramp up to
  // its rim, a beach to wade in at the near end, 3.8 m of water at the far end, a rock breaking the
  // surface and one just under it, a low wall to climb out over and a high one to climb, and a
  // tower in the deep corner to jump from (a 10 m drop into the deep end)
  {
    const PX = 86, PZ = -30, HW = 14, HD = 10, WY = 4.0;
    const box = (w, h, d, x, y, z, rz = 0, mat = stone) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      m.position.set(x, y, z); m.rotation.z = rz;
      hub.add(m);
      return m;
    };
    const x0 = PX - HW, x1 = PX + HW, z0 = PZ - HD, z1 = PZ + HD;
    box(x1 - x0 + 2, 0.2, z1 - z0 + 2, PX, 0.1, PZ);                       // the floor
    box(x1 - x0 + 2, 5.6, 1, PX, 2.8, z0 - 0.5);                           // the far wall: too high to pull out over
    box(x1 - x0 + 2, 4.4, 1, PX, 2.2, z1 + 0.5);                           // the near wall: low, climb out over it
    box(1, 4.2, z1 - z0 + 2, x1 + 0.5, 2.1, PZ);                           // the deep end
    // the beach, inside the near end: from the rim down to the floor
    const bl = Math.hypot(10.5, 4.0), ba = Math.atan2(4.0, 10.5);
    box(bl, 0.5, z1 - z0, x0 + 5.25, 2.1 - 0.25 / Math.cos(ba), PZ, -ba);
    box(2, 4.2, z1 - z0 + 2, x0 - 1, 2.1, PZ);                             // the rim at the top of the beach
    // and the ramp up to it from the hub's floor
    const rl = Math.hypot(12, 4.2), ra = Math.atan2(4.2, 12);
    box(rl, 0.5, 6, x0 - 2 - 6, 2.1 - 0.25 / Math.cos(ra), PZ, ra);
    // a rock breaking the surface, one just under it (stand on it), a tower to jump from
    const rock = (r, x, y, z) => { const m = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 0), stone); m.position.set(x, y, z); m.rotation.set(0.4, x, 0.2); hub.add(m); };
    rock(1.7, PX + 5, WY - 0.6, PZ - 4);
    rock(1.3, PX - 1, WY - 1.5, PZ + 4);
    box(1.6, 14, 1.6, x1 - 2.5, 7, z0 + 2.5);
    box(3.6, 0.4, 3.6, x1 - 3.5, 14.2, z0 + 3.5);
    const water = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0).rotateX(-Math.PI / 2), makeMaterial({ color: '#4c8fb0', color2: '#8fc7d9', mode: MODE_WATER, key: 'lab.water' }));
    water.position.set(PX, WY, PZ);
    water.userData.noCollide = true;
    hub.add(water);
    const label = new THREE.Mesh(textGeometry('water', { width: 3.2, depth: 0.03 }), ink);
    label.position.set(x0 - 1, 4.25, PZ + 4.5);
    label.rotation.set(-Math.PI / 2, 0, -Math.PI / 2);   // (read from the ramp)
    hub.add(label);
  }
  // ---- grass: a meadow beyond the pool, its blades round the camera (src/flora-grass.js)
  const meadowAt = { x: ((LAB_MATERIALS.length + 1) / 2) * SPACING + 22, z: -24, w: 16, d: 11, h: 0.3 };
  const meadowMat = { color: '#9cc57a', color2: '#b4d38c', color3: '#8fae55', mode: MODE_TERRAIN, ticks: true, key: 'lab.meadow' };
  {
    const M = meadowAt;
    const plot = new THREE.Mesh(new THREE.BoxGeometry(M.w, M.h, M.d).translate(0, M.h / 2, 0), makeMaterial(meadowMat));
    plot.position.set(M.x, 0, M.z);
    hub.add(plot);
    const label = new THREE.Mesh(textGeometry('grass', { width: 3.2, depth: 0.03 }), ink);
    label.position.set(M.x, 0.1, M.z + M.d / 2 + 0.2);
    hub.add(label);
  }
  // ---- a cloud: lobes in flat white, floating over the start of the row
  {
    const lobes = [];
    for (let k = 0; k < 9; k++) {
      const a = k * 2.39996, r = 1.2 + (k % 3) * 1.1;
      lobes.push(new THREE.IcosahedronGeometry(1.6 + (k % 2) * 0.9, 1).translate(Math.cos(a) * r * 1.6, (k % 3) * 0.5, Math.sin(a) * r * 0.7).toNonIndexed());
    }
    const g = soften(jitter(mergeGeometries(lobes), 0.12, 1.3, 4), 0.06);
    g.computeVertexNormals();
    const cloud = new THREE.Mesh(g, makeMaterial({ color: '#ffffff', color2: '#e3e8ee', key: 'lab.cloud' }));
    const startX = -((LAB_MATERIALS.length + 1) / 2) * SPACING - 4;
    cloud.position.set(startX, 7, -24);
    cloud.userData.noCollide = true;
    hub.add(cloud);
    movers.push((t) => { cloud.position.y = 7 + Math.sin(t * 0.4) * 0.4; });
    const label = new THREE.Mesh(textGeometry('cloud', { width: 3.2, depth: 0.03 }), ink);
    label.position.set(startX, 0.05, -21);
    label.rotation.x = -Math.PI / 2;
    hub.add(label);
  }
  // ---- the faces gallery: plinths where the giant villagers stand (content.js puts them on them),
  // and a walkway at the height of their faces in front of them (FACE_WALK), up a ramp from the
  // hub, with a low rail on both sides: walk along it face to face with each, its face and
  // expression written on the walkway in front of it
  for (const g of LAB_FACES) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.4, 0.4, 24).translate(0, 0.2, 0), stone);
    p.position.set(g.at[0], 0, g.at[1]);
    hub.add(p);
  }
  {
    const W = FACE_WALK, mid = (W.inner + W.outer) / 2, wide = W.outer - W.inner;
    const arc = (a0, a1) => {
      const n = Math.ceil(Math.abs(a1 - a0) / 4);
      for (let i = 0; i < n; i++) {
        const a = THREE.MathUtils.degToRad(a0 + ((a1 - a0) * (i + 0.5)) / n), len = (THREE.MathUtils.degToRad(Math.abs(a1 - a0)) / n) * W.outer + 0.15;
        const seg = (r, w, h, y) => {
          const m = new THREE.Mesh(new THREE.BoxGeometry(len * (r / W.outer), h, w), stone);
          m.position.set(Math.sin(a) * r, y, Math.cos(a) * r);
          m.rotation.y = a;   // (its length along the arc)
          hub.add(m);
        };
        seg(mid, wide, 0.4, W.height - 0.2);                      // the walk
        seg(W.inner + 0.1, 0.2, 0.9, W.height + 0.45);            // the rails
        seg(W.outer - 0.1, 0.2, 0.9, W.height + 0.45);
      }
    };
    const end = FACE_RING.to + 4;
    arc(-end, -W.ramp.half);
    arc(W.ramp.half, end);
    // the ramp: straight up from the hub's floor to the walk's inner edge, at a = 0
    const rl = Math.hypot(W.ramp.length, W.height), ra = Math.atan2(W.height, W.ramp.length);
    const ramp = new THREE.Mesh(new THREE.BoxGeometry(W.ramp.width, 0.4, rl), stone);
    ramp.position.set(0, W.height / 2 - 0.2, W.inner - W.ramp.length / 2 + 0.3);
    ramp.rotation.x = -ra;
    hub.add(ramp);
    // where it meets the walk: a landing across the gap the arcs leave
    const land = new THREE.Mesh(new THREE.BoxGeometry(2 * Math.sin(THREE.MathUtils.degToRad(W.ramp.half)) * W.outer + 0.4, 0.4, wide), stone);
    land.position.set(0, W.height - 0.2, mid);
    hub.add(land);
    const rail = new THREE.Mesh(new THREE.BoxGeometry(land.geometry.parameters.width, 0.9, 0.2), stone);
    rail.position.set(0, W.height + 0.45, W.outer - 0.1);
    hub.add(rail);
    const sign = new THREE.Mesh(textGeometry('faces', { width: 2.6, depth: 0.03 }), ink);
    sign.rotation.x = -Math.PI / 2;
    sign.position.set(0, 0.05, W.inner - W.ramp.length - 1.6);
    sign.rotation.z = Math.PI;   // (read walking up the ramp)
    hub.add(sign);
    for (const g of LAB_FACES) {
      const text = `${g.variant.toLowerCase()} · ${g.tone}`;
      const label = new THREE.Mesh(textGeometry(text, { width: Math.min(wide - 0.5, text.length * 0.12), depth: 0.02 }), ink);
      label.rotation.x = -Math.PI / 2;
      const holder = new THREE.Group();
      holder.add(label);
      holder.rotation.y = g.facing;   // (the text's top toward the giant: read from the walk)
      const a = g.facing - Math.PI;
      holder.position.set(Math.sin(a) * mid, W.height + 0.02, Math.cos(a) * mid);
      hub.add(holder);
    }
  }

  // ---- doorways: posts, a lintel and a glowing veil, the name on a board above (front faces local +z).
  // A set of doors is merged into a few meshes (frames, boards, names, veils), so the hub's eleven
  // cost four draw calls, not forty-four.
  const frameMat = makeMaterial({ color: '#e9dcc0', color2: '#d8c7a6', color3: '#c9b8a0', mode: MODE_STRATA, strataSize: 0.8, flat: true, grid: 0.6, glyphs: true });
  const boardMat = makeMaterial({ color: '#f6f1e6', flat: true });
  const veilMat = makeMaterial({ color: '#ffffff', vertexColors: true, glow: 0.85, side: THREE.DoubleSide });
  const W = 2.2, H = 3.4;
  const _dm = new THREE.Matrix4(), _dq = new THREE.Quaternion(), _dc = new THREE.Color();
  const doors = () => ({ frame: [], board: [], text: [], veil: [] });
  function doorway(set, x, y, z, heading, label, veil) {
    _dm.compose(new THREE.Vector3(x, y, z), _dq.setFromAxisAngle(Y, heading), new THREE.Vector3(1, 1, 1));
    const at = (g) => (g.index ? g.toNonIndexed() : g).applyMatrix4(_dm);
    for (const g of [
      new THREE.BoxGeometry(0.6, H, 0.8).translate(-W / 2 - 0.3, H / 2, 0),
      new THREE.BoxGeometry(0.6, H, 0.8).translate(W / 2 + 0.3, H / 2, 0),
      new THREE.BoxGeometry(W + 1.6, 0.6, 1).translate(0, H + 0.3, 0),
      new THREE.BoxGeometry(W + 2.2, 0.3, 2.4).translate(0, 0.05, 0),   // the doorstep
    ]) set.frame.push(at(g));
    const v = at(new THREE.PlaneGeometry(W, H).translate(0, H / 2, 0));
    _dc.set(veil);
    v.setAttribute('color', new THREE.Float32BufferAttribute(Array.from({ length: v.attributes.position.count }, () => [_dc.r, _dc.g, _dc.b]).flat(), 3));
    set.veil.push(v);
    const tw = Math.max(1.2, label.length * 0.34), bw = Math.max(W + 1.6, tw + 0.7);
    set.board.push(at(new THREE.BoxGeometry(bw, 0.95, 0.16).translate(0, H + 1.1, 0.1)));
    set.text.push(at(textGeometry(label, { width: tw, depth: 0.04 }).translate(0, H + 1.1, 0.2)));
  }
  function buildDoors(set, parent) {
    const strip = (list, keep = []) => list.map((g) => { for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal' && !keep.includes(k)) g.deleteAttribute(k); return g; });
    parent.add(new THREE.Mesh(mergeGeometries(strip(set.frame)), frameMat), new THREE.Mesh(mergeGeometries(strip(set.board)), boardMat));
    const text = new THREE.Mesh(mergeGeometries(strip(set.text)), ink), v = new THREE.Mesh(mergeGeometries(strip(set.veil, ['color'])), veilMat);
    text.userData.noCollide = v.userData.noCollide = true;
    parent.add(text, v);
  }
  const hubDoors = doors();

  // ---- the biome rooms, far out on their ring, and the doors between them and the hub
  const rooms = [], portals = [], flora = [], wildlife = [];
  // a point k m behind a hub door's threshold (negative: in front of it, toward the hub's centre)
  const hubDoorAt = (d, k) => new THREE.Vector3(d.x - Math.sin(d.heading) * k, 0, d.z - Math.cos(d.heading) * k);
  ROOMS.forEach((def, i) => {
    const centre = roomCentre(i);
    const group = new THREE.Group();
    group.name = `Lab room: ${def.title}`;
    group.position.copy(centre);
    scene.add(group);
    const ground = def.ground ? new Terrain({ size: ROOM_SIZE, seg: 120, height: def.ground.height, material: def.ground.material }) : null;
    if (ground) group.add(ground.mesh);
    const kit = new RoomKit({ group, ground, centre, seed: 7001 + i * 31 });
    def.build(kit, def);
    kit.finish();
    lights.push(...kit.lights);
    noShadow.push(...kit.noShadow);
    movers.push(...kit.movers.map((fn) => (t) => { if (group.visible) fn(t); }));
    const H = (x, z) => (ground ? ground.heightAt(x, z) : def.floor ?? 0);
    // the way in (you arrive facing into the room) and the door home behind you
    const [ax, az] = arriveOf(def);
    const floorAt = (x, z) => (def.stands || !ground ? def.floor ?? 0 : H(x, z));
    const doorY = floorAt(ax, az + DOOR_BACK) - (def.stands || !ground ? 0.4 : 0.05);
    const homeDoor = doors();
    doorway(homeDoor, ax, doorY, az + DOOR_BACK, Math.PI, 'The Lab', '#e9edf0');
    buildDoors(homeDoor, group);
    const sky = def.sky?.script;
    const room = {
      def, i, centre, group, ground, H,
      arrive: new THREE.Vector3(centre.x + ax, centre.y + floorAt(ax, az) + (def.stands || !ground ? 1.2 : 0.3), centre.z + az),
      heading: Math.PI,
      zone: { name: `The Lab · ${def.title}`, preset: 'Moebius print', look: def.look, planets: def.sky?.planets ?? [], hour: def.hour },
      atmo: { tint: def.atmo.tint, fog: def.atmo.fog, name: `The Lab · ${def.title}`, script: sky ? colourScript(sky) : undefined },
      killY: def.killY ?? -60,
    };
    rooms.push(room);
    // the hub's door to it, and its own door home
    const d = LAB_DOORS[i];
    doorway(hubDoors, d.x, 0, d.z, d.heading, def.title, sky?.day[0] ?? '#e9edf0');
    const home = new THREE.Vector3(centre.x + ax, room.arrive.y, centre.z + az + DOOR_BACK + 0.3);
    portals.push(
      { at: hubDoorAt(d, 0.3).setY(1), pos: hubDoorAt(d, 0.3).setY(1), to: room.arrive.clone(), toUp: Y.clone(), heading: room.heading, label: `door to ${def.title}`, room },
      { at: home.clone(), pos: home.clone(), to: hubDoorAt(d, -DOOR_BACK).setY(0.3), toUp: Y.clone(), heading: d.heading, label: 'door to the Lab', room: null },
    );
    // its world's plants over the room's disc (flora.js) and two or three of its creatures (wildlife.js)
    if (def.flora) {
      const f = def.flora;
      const regions = f.rects ? f.rects.map(([x0, x1, z0, z1]) => ({ x0: centre.x + x0, x1: centre.x + x1, z0: centre.z + z0, z1: centre.z + z1, w: 1, band: f.band }))
        : [{ x: centre.x, z: centre.z, r0: f.r0 ?? 12, r: f.r ?? 94, w: 1, band: f.band }];
      flora.push({ world: def.id, seed: 900 + i, patches: f.patches, sparse: f.sparse, water: f.water, ray: !!f.band, regions });
    }
    const anchorY = def.stands || !ground ? (def.floor ?? 0) : H(0, 0);
    for (const sp of WILDLIFE[def.id] ?? []) {
      const p = new THREE.Vector3(centre.x, centre.y + anchorY, centre.z + (def.stands ? 18 : 0));
      wildlife.push({ ...sp, count: Math.min(sp.count, 4), anchors: () => [{ p, r: def.id === 'incal' ? [50, 88] : [10, def.stands ? 55 : 80], w: 1 }] });
    }
  });

  buildDoors(hubDoors, hub);

  // which room a point is in (null: the hub)
  const roomAt = (x, z) => {
    if (x * x + z * z < 1000 * 1000) return null;
    for (const r of rooms) if ((x - r.centre.x) ** 2 + (z - r.centre.z) ** 2 < 700 * 700) return r;
    return null;
  };
  const ground = {
    mesh: terrain.mesh,
    heightAt(x, z) {
      const r = roomAt(x, z);
      if (!r) return terrain.heightAt(x, z);
      return r.ground ? r.centre.y + r.ground.heightAt(x - r.centre.x, z - r.centre.z) : -Infinity;
    },
  };
  const floraAvoid = (x, z, rad) => {
    const r = roomAt(x, z);
    if (!r) return false;
    const lx = x - r.centre.x, lz = z - r.centre.z, [ax, az] = arriveOf(r.def);
    if (Math.abs(lx - ax) < 9 + rad && lz > az - 14 && lz < az + DOOR_BACK + 6) return true;   // the way in, and the door home
    return !!r.def.avoid?.(lx, lz, rad);
  };

  // grass blades (flora-grass.js): on the hub's meadow, and in the rooms whose ground is grassy
  const grassFields = [{
    heightAt: (x, z) => (Math.abs(x - meadowAt.x) < meadowAt.w / 2 - 0.3 && Math.abs(z - meadowAt.z) < meadowAt.d / 2 - 0.3 ? meadowAt.h : -Infinity),
    color: new THREE.Color(meadowMat.color), color2: new THREE.Color(meadowMat.color2),
    inside: (x, z) => !roomAt(x, z) && Math.abs(x - meadowAt.x) < 70 && Math.abs(z - meadowAt.z) < 70,
    mask: false,   // (the plot is in the collision: no built-on mask)
  }];
  for (const r of rooms) {
    const u = r.ground?.mesh.material.uniforms;
    if (!u?.uTicks.value) continue;
    grassFields.push({
      heightAt: (x, z) => r.centre.y + r.ground.heightAt(x - r.centre.x, z - r.centre.z),
      color: u.uColor.value, color2: u.uColor2.value, water: r.def.flora?.water,
      inside: (x, z) => roomAt(x, z) === r,
    });
  }

  // what is drawn: the room you are in, or the hub. The others are hidden and their matrices
  // frozen: every frame's scene.updateMatrixWorld() (which three.js forces down the whole tree)
  // skips them, a dozen rooms and ~600 objects that nothing moves while they're hidden (their
  // movers wait for group.visible). Each is brought up to date as it hides (show), so the
  // collision bake and anything else reading them find them where they are.
  const freeze = (g) => {
    const base = g.updateMatrixWorld;
    g.updateMatrixWorld = function (force) { if (this.visible) base.call(this, force); };
  };
  let shown;
  const show = (room) => {
    if (room === shown) return;
    shown = room;
    for (const [g, on] of [[hub, !room], ...rooms.map((r) => [r.group, r === room])]) {
      if (!on && g.visible !== false) g.updateMatrixWorld(true);
      g.visible = on;
    }
  };
  freeze(hub);
  for (const r of rooms) freeze(r.group);
  show(null);

  let passing = null, cooldown = 0, hop = 0;
  // [ and ] (L3 and R3 on a pad) hop between the hub and the rooms without walking to the doors
  if (typeof window !== 'undefined') window.addEventListener('keydown', (e) => {
    if (e.repeat || e.target?.closest?.('input, textarea, select')) return;
    if (e.code === 'BracketRight') hop = 1;
    else if (e.code === 'BracketLeft') hop = -1;
  });
  return {
    id: 'lab',
    ground,
    spawn: new THREE.Vector3(0, 0, 4),
    /** Hop to the next (+1) or previous (-1) room, the hub between the last and the first ([ ], L3 / R3). */
    jump: (d) => { hop = d; },
    spawnHeading: Math.PI,   // facing the materials
    camYaw: 0,
    features: { mount: false, wind: false, jetpack: true, climb: true },
    defaults: { hour: 11, preset: 'Viridel', cloudShadows: 0 },
    killY: -Infinity,
    limit: ROOM_RING + 600,
    shipSite: { x: 0, z: -78, heading: 0 },   // behind the materials row, clear of the doors
    lights, noShadow,
    rooms,
    navigationPortals: portals,
    flora,
    wildlife,
    floraAvoid,
    grassFields,
    roomAt,
    unsafe: (p) => { const r = roomAt(p.x, p.z); return !!r?.def.unsafe?.(new THREE.Vector3(p.x - r.centre.x, p.y - r.centre.y, p.z - r.centre.z), (x, z) => r.H(x, z)); },
    sky: {
      script: {
        day: ['#e9edf0', '#f6f7f8', '#c9ccd0', '#ffffff', '#fff6dc'],
        dusk: ['#e6dccb', '#f2e6d2', '#b8ab96', '#fff0d6', '#ffe6c0'],
        night: ['#2e3238', '#4a5058', '#2e3238', '#c8c4bc', '#f2f0e6'],
      },
    },
    atmo: (x, z) => roomAt(x, z)?.atmo ?? HUB_ATMO,
    zoneAt: (p) => roomAt(p.x, p.z)?.zone ?? HUB_ZONE,
    update(dt, t, ctx) {
      for (const m of movers) m(t);
      const player = ctx?.player;
      if (!player) return;
      const p = player.pos, here = roomAt(p.x, p.z);
      show(here);
      cooldown = Math.max(cooldown - dt, 0);
      // through a door: a quick fade, then out the other side at your own pace, the camera behind you
      if (passing) {
        passing.t += dt;
        if (!passing.done && passing.t >= PASS.in) {
          passing.done = true;
          const { to, heading } = passing;
          player.teleport(to, Y, Z);
          player.heading = heading;
          player.vel.set(Math.sin(heading) * passing.speed, 0, Math.cos(heading) * passing.speed);
          if (ctx.rig) { ctx.rig.yaw = heading + Math.PI; ctx.rig.target?.copy(to); }
          show(roomAt(to.x, to.z));
          ctx.fade?.(0, PASS.out);
        }
        if (passing.t >= PASS.in + PASS.out) passing = null;
        return;
      }
      const go = (to, heading, speed = 0) => {
        passing = { to, heading, t: 0, done: false, speed };
        ctx.fade?.(0.95, PASS.in);
        if (!ctx.fade) passing.t = PASS.in;   // (no screen to fade: straight through)
        cooldown = 1.4;
      };
      if (cooldown === 0 && !player.riding) {
        for (const po of portals) {
          if (Math.hypot(p.x - po.at.x, p.z - po.at.z) < 1.3 && Math.abs(p.y - po.at.y) < 2.6) {
            go(po.to, po.heading, Math.min(4, Math.max(2, Math.hypot(player.vel.x, player.vel.z))));
            break;
          }
        }
      }
      // a hop: the next (or previous) room in the list, the hub before the first and after the last
      if (hop && !passing) {
        const n = rooms.length, i = here ? rooms.indexOf(here) : n, j = (i + hop + n + 1) % (n + 1);
        hop = 0;
        if (j === n) go(new THREE.Vector3(0, 0, 4), Math.PI); else go(rooms[j].arrive, rooms[j].heading);
      }
      // strayed off a room (over its banks, or off its edge into the cloud): back at its door
      if (!passing && here && (Math.hypot(p.x - here.centre.x, p.z - here.centre.z) > ROOM_REACH || p.y - here.centre.y < here.killY)) go(here.arrive, here.heading);
    },
  };
}
