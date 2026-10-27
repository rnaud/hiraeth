import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeMaterial } from './materials.js';
import { staticFlame } from './story/flames.js';
import { rough } from './desert-hearth.js';
import { STORY, RIDE } from './desert-sites.js';

// The pilgrims' road: the old way down from Qanat's main gate to the landing, west of the straight way in, marked
// with cairns of stacked stones, each with a little clay lamp on top. It bends out over the dunes past Oum's stone and
// over the shoulder of the last big dune, where the pilgrims' resting stone looks back at the tree, then down to the
// ship from the west (level design audit v1.15: the walk from the tree back to the ship was the way you came; this is
// the second way home. v1.46: since the ship came down nearer the city, issue #71, the road ran on to the old landing,
// 150 m short of it; it turns down to the ship now). While the tree is cold the lamps are dead; when it burns, Qanat lights them
// one after another from the gate down to your ship (src/story/desert-road.js), the road home for its guest.
//
//   const road = buildPilgrimsRoad(scene, terrain)  →  { points, cairns: [{ at, top, flame, light }], rest, avoid(x, z, r) }

/** The cairns, [x, z], from just west of the main gate down to the ship. */
export const LEGACY_ROAD = [[168, 352], [128, 340], [90, 318], [55, 290], [28, 255], [16, 226], [4, 192], [30, 166], [58, 160]];
/** The road to the ship in front of the camps (issue #706, src/ship/sites.js): past the resting stone it turns east over the
 *  dunes and comes down to the ship's west end, its last cairn 35 m from the ramp's foot (it ran on north to the berth west
 *  of the walls before). */
export const ROAD = [[168,352],[128,340],[90,318],[55,290],[28,255],[16,226],[4,192],[36,214],[70,238],[100,256],[114,266]];
export const CONTROLLED_ROAD = ROAD;
/** The resting stone on the last dune's shoulder, between the 7th and 8th cairns ([x, z]; it faces the tree). */
export const REST = { x: 10, z: 178 };
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

export function buildPilgrimsRoad(scene, terrain, { tree = V(230, 0, 400), points = ROAD } = {}) {
  const H = (x, z) => terrain.heightAt(x, z);
  const stone = makeMaterial({ color: '#cdb38f', color2: '#bfa27c', flat: true });
  const clay = makeMaterial({ color: '#b86a43', flat: true });
  const flameMat = makeMaterial({ color: '#ffd27a', glow: 1, flat: true, key: 'desert.road.flame' });
  const stones = [], lamps = [], cairns = [];
  points.forEach(([x, z], i) => {
    const y = H(x, z), turn = i * 1.7;
    let h = 0;
    // four or five flat stones, each a little smaller and turned, leaning a touch (a pilgrim stacked them by hand)
    const n = 4 + (i % 2);
    for (let k = 0; k < n; k++) {
      const r = 0.62 - k * 0.1, t = r * 0.62;
      const g = rough(new THREE.IcosahedronGeometry(r, 0).scale(1.25, 0.62, 1), 0.035, 3, i * 7 + k)
        .rotateY(turn + k * 0.9).translate(x + Math.sin(k * 2.1 + i) * 0.05, y + h + t * 0.5 - 0.12, z + Math.cos(k * 1.7 + i) * 0.05);
      stones.push(g);
      h += t * 0.82;
    }
    // the lamp: a little clay bowl on the top stone, a wick
    const top = V(x, y + h - 0.1, z);
    lamps.push(new THREE.LatheGeometry([[0.03, 0], [0.16, 0.02], [0.2, 0.1], [0.17, 0.14]].map(([r, yy]) => new THREE.Vector2(r, yy)), 9).translate(top.x, top.y, top.z).toNonIndexed());
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.42, 6).translate(0, 0.32, 0), flameMat);
    flame.position.copy(top); flame.userData.noCollide = true; flame.visible = false; flame.name = 'Cairn lamp flame';
    staticFlame(flame, [V(0, 0.11, 0)], { r: 0.12, h: 0.42 });   // (lit, it burns: issue #77)
    scene.add(flame);
    cairns.push({ at: V(x, y, z), top, flame, light: new THREE.Vector4(top.x, top.y + 0.4, top.z, 0) });
  });
  // the resting stone: a broad slab worn smooth on two low stones, turned to the tree, on the last dune's crest
  const ry = H(REST.x, REST.z), face = Math.atan2(tree.x - REST.x, tree.z - REST.z);
  const at = (lx, ly, lz) => V(REST.x + Math.cos(face) * lx + Math.sin(face) * lz, ry + ly, REST.z - Math.sin(face) * lx + Math.cos(face) * lz);
  for (const lx of [-1.0, 1.0]) { const p = at(lx, 0.22, 0); stones.push(rough(new THREE.BoxGeometry(0.55, 0.6, 0.6), 0.04, 2, lx > 0 ? 3 : 4).rotateY(face).translate(p.x, p.y, p.z)); }
  { const p = at(0, 0.6, 0); stones.push(rough(new THREE.BoxGeometry(2.8, 0.22, 0.85), 0.03, 1.4, 9).rotateY(face).translate(p.x, p.y, p.z)); }
  // pilgrims' tokens tied to a stake beside it: strips of cloth, faded
  const stake = at(1.9, 0, -0.2), cloth = makeMaterial({ color: '#c8483a', flat: true, side: THREE.DoubleSide }), cream = makeMaterial({ color: '#f3ead8', flat: true, side: THREE.DoubleSide });
  const wood = makeMaterial({ color: '#8a6a4a', flat: true });
  const stakeMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 1.6, 5).translate(stake.x, stake.y + 0.8, stake.z), wood);
  scene.add(stakeMesh);
  for (let k = 0; k < 4; k++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.55).translate(0, -0.27, 0).rotateY(face + k * 1.3).rotateZ(0.25), k % 2 ? cream : cloth);
    m.position.set(stake.x, stake.y + 1.45 - k * 0.06, stake.z); m.userData.noCollide = true;
    scene.add(m);
  }
  const group = new THREE.Group(); group.name = 'The pilgrims’ road';
  const s = new THREE.Mesh(mergeGeometries(stones.map((g) => (g.index ? g.toNonIndexed() : g))), stone); s.name = 'The pilgrims’ cairns';
  const l = new THREE.Mesh(mergeGeometries(lamps), clay); l.userData.noCollide = true;
  group.add(s, l);
  scene.add(group);
  const rest = { at: at(0, 0, 0.9), look: at(0, 0.7, 0), seat: at(0, 0.71, 0), heading: face };
  const clear = [...cairns.map((c) => ({ x: c.at.x, z: c.at.z, r: 1.6 })), { x: REST.x, z: REST.z, r: 3.2 }, { x: stake.x, z: stake.z, r: 0.8 }];
  return {
    group, cairns, rest, clear,
    /** The road as a line, [x, y, z] from the gate down to the landing (the level design audit follows it home). */
    points: cairns.map((c) => [c.at.x, c.at.y, c.at.z]),
    /** Nothing grows on a cairn or the resting stone. */
    avoid: (x, z, r = 0) => clear.some((c) => Math.hypot(x - c.x, z - c.z) < c.r + r),
  };
}

// ------------------------------------------------------------------ the riders' red strips
// Riders tie a strip of red cloth on the way to the red rocks (the tusk gate's cairn has one: src/story/desert-data.js
// rideTusks). Along the straight ride out, from Marrow's hollow to the tusk gate, poles with a red strip each, about
// every 80 m (6 m tall, a long strip streaming from the top as the salt-carrier's pennant), beside the way that the
// salt-carrier's shade, the anchor and the wreck stand on (src/desert-sites.js RIDE): what the eye follows out of the
// hollow, where nothing of the Hearth shows (level design audit v1.46: the hollow → the Hearth was 1.6 km and blind).
//
//   const strips = buildRiderStrips(scene, terrain)  →  { points: [[x, y, z], …], avoid(x, z, r) }

/** How far along the ride (0 the hollow, 1 the Hearth) the strips stand: past the hollow's rim to before the tusk gate, not on the ride's stops. */
export const STRIPS = (() => {
  const out = [], stops = Object.values(RIDE).map((r) => r.f);
  for (let f = 0.04; f < 0.8; f += 0.05) if (stops.every((g) => Math.abs(g - f) > 0.02)) out.push(+f.toFixed(3));
  return out;
})();

export function buildRiderStrips(scene, terrain) {
  const a = STORY.bike, b = STORY.hearth, dx = b.x - a.x, dz = b.z - a.z, L = Math.hypot(dx, dz), side = [-dz / L, dx / L];
  // (the ride's own materials: src/desert-hearth.js, the salt-carrier's pennant and poles)
  const cloth = makeMaterial({ color: '#c8483a', flat: true, side: THREE.DoubleSide }), wood = makeMaterial({ color: '#8a6a4a', flat: true, side: THREE.DoubleSide });
  const poles = [], rags = [], points = [], clear = [];
  STRIPS.forEach((f, i) => {
    const off = (i % 2 ? 1 : -1) * 4.5;   // (either side of the way, in turn: nothing in the bike's path)
    const x = a.x + dx * f + side[0] * off, z = a.z + dz * f + side[1] * off, y = terrain.heightAt(x, z);
    const lean = Math.sin(i * 2.3) * 0.06;
    poles.push(new THREE.CylinderGeometry(0.07, 0.1, 6, 5).translate(0, 2.9, 0).rotateZ(lean).translate(x, y, z).toNonIndexed());
    // the strip, knotted near the top and streaming downwind, a little twisted
    for (let k = 0; k < 3; k++) rags.push(new THREE.PlaneGeometry(2.8 - k * 0.7, 0.5 - k * 0.1).translate(1.4 - k * 0.35, 0, 0).rotateX(0.4 + k * 0.7).rotateZ(-0.1 - k * 0.08).rotateY(i * 0.7).translate(x, y + 5.6 - k * 0.15, z).toNonIndexed());
    points.push([x, y, z]);
    clear.push({ x, z, r: 1 });
  });
  const group = new THREE.Group(); group.name = 'The riders’ red strips';
  const strip = (gs) => mergeGeometries(gs.map((g) => { g.deleteAttribute('uv'); return g; }));
  const p = new THREE.Mesh(strip(poles), wood), r = new THREE.Mesh(strip(rags), cloth);
  p.name = 'The strips’ stakes'; r.name = 'The red strips';
  p.userData.noCollide = r.userData.noCollide = true;   // (thin: ridden past, not into)
  group.add(p, r);
  scene.add(group);
  return { group, points, clear, avoid: (x, z, rr = 0) => clear.some((c) => Math.hypot(x - c.x, z - c.z) < c.r + rr) };
}

// ------------------------------------------------------------------ the Givers' field-stone
// On the dunes between the Rose House and the ship, a boundary stone of Qanat's old fields, carved with a channel:
// what the walk home from the House passes (level design audit v1.46: it came back the way it went, past nothing new).
// Once the House's water runs, the field beside it grows green (src/temples/desert.js change: its plot).
//
//   const stone = buildFieldStone(scene, terrain)  →  { at, look, heading, avoid(x, z, r) }

/** Where it stands, [x, z]; its carved face looks up the dunes toward the House (`toward`). */
export const FIELD_STONE = { x: 300, z: 268, toward: [518, 378] };

/** For the berth before the camps (issue #706): halfway along the straight walk from the House's door to the ramp. */
export const CONTROLLED_FIELD_STONE = { x: 346, z: 320, toward: [518, 378] };

export function buildFieldStone(scene, terrain, site = FIELD_STONE) {
  const { x, z } = site, y = terrain.heightAt(x, z), face = Math.atan2(site.toward[0] - x, site.toward[1] - z);
  const stone = makeMaterial({ color: '#cdb38f', color2: '#bfa27c', flat: true }), clay = makeMaterial({ color: '#b86a43', flat: true });
  const at = (lx, ly, lz) => V(x + Math.cos(face) * lx + Math.sin(face) * lz, y + ly, z - Math.sin(face) * lx + Math.cos(face) * lz);
  // a slab standing to a man's shoulder, leaning a little, its top worn round by the wind, its foot in the sand
  const slab = rough(new THREE.CylinderGeometry(0.5, 0.62, 2, 6, 3).scale(1.1, 1, 0.42), 0.09, 1.1, 21).rotateZ(0.07).rotateY(face).translate(x, y + 0.8, z);
  // the carving on its face: a channel running down from a little round cistern, three rows of shoots beside it
  const cut = [], f = (lx, ly) => at(lx, ly, 0.24);
  cut.push(new THREE.BoxGeometry(0.08, 1.1, 0.04).rotateY(face).translate(f(0, 0).x, y + 0.75, f(0, 0).z));
  cut.push(new THREE.CylinderGeometry(0.14, 0.14, 0.04, 8).rotateX(Math.PI / 2).rotateY(face).translate(f(0, 0).x, y + 1.42, f(0, 0).z));
  for (const ly of [0.45, 0.7, 0.95]) cut.push(new THREE.BoxGeometry(0.22, 0.04, 0.04).rotateY(face).translate(f(0.26, 0).x, y + ly, f(0.26, 0).z));
  const g = new THREE.Group(); g.name = 'The Givers’ field-stone';
  const flatten = (q) => { q = q.index ? q.toNonIndexed() : q; q.deleteAttribute('uv'); return q; };
  const s = new THREE.Mesh(slab, stone), k = new THREE.Mesh(mergeGeometries(cut.map(flatten)), clay);
  k.userData.noCollide = true;
  g.add(s, k);
  scene.add(g);
  return { group: g, at: at(0, 0, 1.4), look: at(0, 1.1, 0.25), heading: face, clear: [{ x, z, r: 2 }], avoid: (px, pz, r = 0) => Math.hypot(px - x, pz - z) < 2 + r };
}
