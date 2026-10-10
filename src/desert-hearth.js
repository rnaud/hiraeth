import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeMaterial, MODE_STRATA } from './materials.js';
import { glyphGeometry } from './story/sign-text.js';
import { STORY, hearthStones, wayPlaces, WAY, ridePlaces } from './desert-sites.js';
import { taper } from './desert-city.js';

// The Givers' Hearth: where the Givers kept their fire, and the keepers put the
// spark-stone back after they lit Qanat's tree with it (src/story/desert.js has
// the errand). Far out in the red rocks south-east of Qanat, ~1.8 km away:
// farther than walking, the hoverbike's ride.
//
//   outside   a butte of rose rock with a tall chimney of stone on its top (a dark
//             slit near the tip glows at night: the stone's light, seeping up), and
//             a carved porch at its foot whose door looks back toward the city; the
//             fire-bearers' marked stones (STORY hearthStones) stand along the way
//   inside    (built far overhead, through the door, like the giant's cave) one dark
//             round hall under a low dome:
//               the stone   in a hollow in the back wall, 5 m up on a shelf you climb to,
//                           behind a stone grille; it pulses, slow as breathing, and each
//                           pulse washes the hall with light and lights old marks in the
//                           floor, which run from the passage to...
//               the weight  a stone ball in a groove along the top of a plinth, a chain
//                           running from the hole at the groove's end up the wall and over
//                           to the grille. Too heavy for hands: a shove of fluid (push)
//                           rolls it down the groove, it drops into the hole, the chain
//                           runs and the grille rises (src/story/desert.js drives it)
//               the shelf   the lower wall's face is plain rock: climb it, take the stone
//
// Everything that moves (the ball, the grille, the stone) is noCollide; the story
// moves it. Interior local frame: +z toward the passage (the way out), y up from the floor.

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
/** The carved frieze on the porch's lintel, left of the Givers' mark (porch-local x of its middle). */
const FRIEZE = { x: -2.3 };
const UP = V(0, 1, 0);
const PROXY = new THREE.MeshBasicMaterial();

function prep(g) {
  let geo = g.index ? g.toNonIndexed() : g;
  if (!geo.attributes.normal) geo.computeVertexNormals();
  for (const k of Object.keys(geo.attributes)) if (k !== 'position' && k !== 'normal') geo.deleteAttribute(k);
  return geo;
}
const box = (w, h, d, x = 0, y = 0, z = 0) => new THREE.BoxGeometry(w, h, d).translate(x, y, z);

/** A place with its own frame: batched render meshes and hidden colliders (the desert's usual kit). */
class Kit {
  constructor(root, name, origin, yaw = 0) {
    this.group = new THREE.Group(); this.group.name = name; root.add(this.group);
    this.origin = origin.clone(); this.yaw = yaw;
    this.frame = new THREE.Matrix4().compose(origin, new THREE.Quaternion().setFromAxisAngle(UP, yaw), V(1, 1, 1));
    this.batches = new Map(); this.proxies = [];
  }
  world(x, y, z) { return V(x, y, z).applyMatrix4(this.frame); }
  heading(h) { return h + this.yaw; }
  add(mat, geo) { const g = prep(geo).applyMatrix4(this.frame); if (!this.batches.has(mat)) this.batches.set(mat, []); this.batches.get(mat).push(g); return this; }
  solid(geo) { this.proxies.push(prep(geo).applyMatrix4(this.frame)); return this; }
  // (the copy is taken before add(), which transforms a non-indexed geometry in place: else the proxy is moved twice)
  both(mat, geo, proxy) { const p = proxy ?? geo.clone(); this.add(mat, geo); this.solid(p); return this; }
  flush() {
    for (const [mat, list] of this.batches) {
      const m = new THREE.Mesh(mergeGeometries(list), mat);
      m.userData.noCollide = true; m.name = `${this.group.name} (${list.length})`;
      this.group.add(m);
    }
    if (this.proxies.length) {
      const c = new THREE.Mesh(mergeGeometries(this.proxies), PROXY);
      c.visible = false; c.name = `${this.group.name} collision`;
      this.group.add(c);
    }
    this.batches.clear(); this.proxies = [];
    return this.group;
  }
}

/** Push every vertex out along its normal by a little noise (rough rock), deterministically. */
export function rough(g, amount, freq = 0.3, seed = 0) {
  g = g.index ? g.toNonIndexed() : g;
  g.computeVertexNormals();
  const p = g.attributes.position, n = g.attributes.normal;
  // weld-safe: the same position always gets the same offset
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const k = Math.sin(x * freq + seed) * Math.cos(z * freq * 1.3 - seed) + 0.5 * Math.sin((x + y + z) * freq * 2.1 + seed * 2);
    const r = Math.hypot(x, z) || 1;
    // (a dome's foot ring, y = 0, only ever goes down: lifted, it opened a slit between the floor and the wall
    // that the sun shone through, a lit seam round the hall's floor; down, it stands in the floor)
    const dy = k * amount * 0.25;
    p.setXYZ(i, x + (x / r) * k * amount, y + (Math.abs(y) < 0.01 ? -Math.abs(dy) : dy), z + (z / r) * k * amount);
  }
  void n;
  g.computeVertexNormals();
  return g;
}

/** Turn a closed shape inside out (a dome you stand in). */
function inward(g) {
  g = g.index ? g.toNonIndexed() : g;
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i += 3) {
    const ax = p.getX(i + 1), ay = p.getY(i + 1), az = p.getZ(i + 1);
    p.setXYZ(i + 1, p.getX(i + 2), p.getY(i + 2), p.getZ(i + 2));
    p.setXYZ(i + 2, ax, ay, az);
  }
  g.computeVertexNormals();
  return g;
}
/** Drop the triangles whose centre passes test(x, y, z) (a doorway cut through a wall). */
function cut(g, test) {
  g = g.index ? g.toNonIndexed() : g;
  const p = g.attributes.position, keep = [];
  for (let i = 0; i < p.count; i += 3) {
    const cx = (p.getX(i) + p.getX(i + 1) + p.getX(i + 2)) / 3, cy = (p.getY(i) + p.getY(i + 1) + p.getY(i + 2)) / 3, cz = (p.getZ(i) + p.getZ(i + 1) + p.getZ(i + 2)) / 3;
    if (!test(cx, cy, cz)) for (let k = 0; k < 3; k++) keep.push(p.getX(i + k), p.getY(i + k), p.getZ(i + k));
  }
  const o = new THREE.BufferGeometry();
  o.setAttribute('position', new THREE.Float32BufferAttribute(keep, 3));
  o.computeVertexNormals();
  return o;
}

export const HEARTH = {
  hall: 17,          // the hall's floor radius (m)
  shelf: 5,          // the shelf's height over the floor: the climb to the stone
  stone: V(0, 5.42, -15.45),     // the spark-stone in its hollow (interior local)
  grille: { at: V(0, 5, -15.12), rise: 1.75 },   // (just inside the hollow's mouth: raised, it slides up into the rock)
  ball: { r: 0.62, rest: V(-9.5, 1.3 + 0.62, -1.7), end: V(-9.5, 1.3 + 0.62, -8.3), drop: 1.5 },
  plinth: { x: -9.5, z0: -0.9, z1: -9.1, h: 1.3, w: 2.2 },
  inside: V(0, 0.05, 23.5),      // where the passage brings you in
  exit: V(0, 0, 26.6),           // walk into the dark at its end: back out
  pulse: 3.2,                    // s: the stone's breath
};

/** The Hearth outside and in. Returns its places, lights, portals and the pieces the story moves. */
export function buildDesertHearth(scene, terrain) {
  const root = new THREE.Group(); root.name = 'Givers’ Hearth'; scene.add(root);
  // (what the level design audit's third round added: put in the scene last, src/levels/desert.js, so the contact audit's
  // samples of everything built before stay where they were)
  const late = new THREE.Group(); late.name = 'Givers’ Hearth (added in v1.16)';
  const M = {
    rose: makeMaterial({ color: '#e29a7c', color2: '#c97b63', color3: '#f0c19c', flat: true, mode: MODE_STRATA, strataSize: 5 }),
    roseCarved: makeMaterial({ color: '#e7a587', color2: '#d48a6e', color3: '#f3cdb0', flat: true, mode: MODE_STRATA, strataSize: 1.2, grid: 1.4, glyphs: true }),
    marker: makeMaterial({ color: '#cdb6a6', color2: '#b99f8f', color3: '#ddcbbd', flat: true, mode: MODE_STRATA, strataSize: 0.8 }),
    ink: makeMaterial({ color: '#2b211f', flat: true }),
    // the hall is dark: deep plum rock, a floor a little lighter
    cave: makeMaterial({ color: '#33263b', color2: '#2b2032', color3: '#3d2e46', mode: MODE_STRATA, strataSize: 1.4, flat: true }),
    caveFloor: makeMaterial({ color: '#3f3046', color2: '#36293c', color3: '#4a3952', mode: MODE_STRATA, strataSize: 0.7, flat: true, side: THREE.DoubleSide }),
    carved: makeMaterial({ color: '#5a4460', color2: '#4c3852', color3: '#66506c', mode: MODE_STRATA, strataSize: 0.9, flat: true, grid: 1.2, glyphs: true }),
    stone: makeMaterial({ color: '#b9a896', flat: true }),
    bronze: makeMaterial({ color: '#c9974a', flat: true, metal: 'brass' }),
    glyph: makeMaterial({ color: '#70e7df', glow: 0.85, flat: true }),
    // the floor marks and the chimney's slit pulse with the stone (their own materials: the story sets uGlow)
    marks: makeMaterial({ color: '#ffd9a0', glow: 0.3, flat: true, key: 'hearth.marks' }),
    slit: makeMaterial({ color: '#ffcf8a', glow: 1, flat: true, key: 'hearth.slit' }),
    spark: makeMaterial({ color: '#fff1c8', glow: 1, flat: true, key: 'hearth.spark' }),
    // the way (src/story/desert-way.js sets their uGlow): the bowl's stone's mark, dull until the bowl is filled;
    // the fluid in the bowl; the bell's glint
    wayMark: makeMaterial({ color: '#70e7df', glow: 0.05, flat: true, key: 'desert.way.mark' }),
    wayFluid: makeMaterial({ color: '#7fe6dc', glow: 0.9, flat: true, key: 'desert.way.fluid' }),
    glint: makeMaterial({ color: '#fff6dc', glow: 1, flat: true, key: 'desert.way.glint' }),
  };
  const lights = [], portals = [];
  const S = STORY.hearth;

  // ================================================================ outside: the butte, its chimney, the porch
  const R0 = 36, R1 = 24, H = 68;   // (tall: it stands in high dunes, and must show over them from the way)
  const base = Math.min(...Array.from({ length: 12 }, (_, i) => { const a = i / 12 * Math.PI * 2; return terrain.heightAt(S.x + Math.sin(a) * R0, S.z + Math.cos(a) * R0); })) - 5;
  const out = new Kit(root, 'Givers’ Hearth butte', V(S.x, base, S.z), S.yaw);
  {
    // (the butte and its lip collide as they are drawn: a smooth stand-in lay up to 2.6 m inside the rough sides)
    out.both(M.rose, rough(new THREE.CylinderGeometry(R1, R0, H, 18, 6).translate(0, H / 2, 0), 1.6, 0.18, 2));
    // a lip of fallen rock round its foot
    out.both(M.rose, rough(new THREE.CylinderGeometry(R0 + 2, R0 + 7, 7, 18, 2).translate(0, 3.5, 0), 1.4, 0.3, 5));
    // the chimney: a finger of rock on the flat top, a dark slit near its tip (it glows at night: the stone below)
    const CH = { h: 38, r0: 5, r1: 2.8 };
    out.both(M.rose, rough(new THREE.CylinderGeometry(CH.r1, CH.r0, CH.h, 9, 4).translate(-4, H + CH.h / 2 - 0.5, -3), 0.5, 0.4, 7));
    out.add(M.slit, box(0.8, 5, 0.5, -4, H + CH.h - 5.5, -3 + CH.r1 + 0.75));
    out.add(M.slit, box(0.5, 5, 0.8, -4 + CH.r1 + 0.75, H + CH.h - 5.5, -3));
  }
  // the porch: a carved block standing out of the butte's foot, its doorway toward the city
  const doorR = R0 + 2.5, doorG = terrain.heightAt(...[S.x + Math.sin(S.yaw) * (doorR + 2), S.z + Math.cos(S.yaw) * (doorR + 2)]);
  const doorY = doorG - base;   // (porch-local: the threshold over the butte's base)
  {
    const z0 = R0 - 6, z1 = doorR, d = z1 - z0, zc = (z0 + z1) / 2, PH = 7.5, PW = 8;
    // the floor of the porch at the threshold, a slab out over the sand, and the block round the doorway
    out.both(M.roseCarved, box(PW, 0.6, d + 3, 0, doorY - 0.3, zc + 1.5));
    for (const s of [-1, 1]) out.both(M.roseCarved, box(2.4, PH, d, s * (PW / 2 - 1.2), doorY + PH / 2, zc));
    out.both(M.roseCarved, box(PW, 1.6, d, 0, doorY + PH - 0.8, zc));
    out.add(M.ink, new THREE.PlaneGeometry(PW - 4.8, PH - 1.6).translate(0, doorY + (PH - 1.6) / 2, z1 - 0.6));
    out.solid(box(PW - 4.8, PH - 1.6, 0.4, 0, doorY + (PH - 1.6) / 2, z1 - 1.2));
    // the Givers' mark over the door, and a pale step of fallen stones up to it
    out.add(M.glyph, glyphGeometry(1.6).translate(0, doorY + PH - 0.8, z1 + 0.05));
    // the frieze along the lintel, left of the mark: five small figures passing a light hand to hand, to a tree
    // (carved shallow: drawn on the lintel's face, which is the collider: docs/systems/story.md, "Places to stop on the way")
    {
      const fx = FRIEZE.x, parts = [], z = z1 + 0.04, y0 = doorY + PH - 1.45;
      for (let i = 0; i < 5; i++) {
        const x = fx - 1.05 + i * 0.4;
        // (two legs, a body, a head apart from it, an arm held out to the next one)
        parts.push(box(0.06, 0.3, 0.05, x - 0.05, y0 + 0.15, z), box(0.06, 0.3, 0.05, x + 0.05, y0 + 0.15, z), box(0.2, 0.34, 0.05, x, y0 + 0.46, z),
          box(0.16, 0.16, 0.05, x, y0 + 0.8, z), box(0.24, 0.05, 0.05, x + 0.18, y0 + 0.55, z));
      }
      parts.push(box(0.1, 0.8, 0.05, fx + 1.0, y0 + 0.4, z), box(0.56, 0.42, 0.05, fx + 1.0, y0 + 0.98, z));   // the tree
      out.add(M.ink, mergeGeometries(parts.map(prep)));
      out.add(M.spark, box(0.12, 0.12, 0.06, fx - 1.05 + 3 * 0.4 + 0.3, y0 + 0.6, z + 0.01));   // the light, in the fourth one's hands
    }
    for (let i = 0; i < 3; i++) out.both(M.stone, box(PW - 1 - i * 0.6, 0.35, 1.0, 0, doorY - 0.55 - i * 0.35, z1 + 3.2 + i * 1.0));
  }
  out.flush();
  const door = out.world(0, doorY, doorR + 1.2);
  const carving = out.world(FRIEZE.x, doorY + 7.5 - 0.9, doorR + 0.1), carvingFoot = out.world(-2.6, doorY, doorR + 2.4);
  const doorFront = out.world(0, doorY, doorR + 4.5);
  const chimneyTop = out.world(-4, H + 38, -3);
  // the stone's light seeps up the chimney: a warm point at the slit (the story pulses it)
  const slitLight = new THREE.Vector4(chimneyTop.x, chimneyTop.y - 5, chimneyTop.z, 30);
  lights.push(slitLight);

  // ================================================================ the fire-bearers' marked stones on the way
  const stones = hearthStones().map(([x, z], i) => {
    const y = terrain.heightAt(x, z);
    const k = new Kit(root, `Marked stone ${i + 1}`, V(x, y - 0.4, z), S.yaw + Math.sin(i * 1.7) * 0.25);
    const h = 4.2 + (i % 3) * 0.5;
    k.both(M.marker, rough(new THREE.CylinderGeometry(0.42, 0.68, h, 5, 2).translate(0, h / 2, 0), 0.06, 1.1, i));
    // the mark near its top, on both faces (toward Qanat and toward the Hearth); the bowl's stone's is dull until it is filled
    const mark = i === WAY.bowl.stone ? M.wayMark : M.glyph;
    k.add(mark, glyphGeometry(0.6).translate(0, h - 0.8, 0.5));
    k.add(mark, glyphGeometry(0.6).rotateY(Math.PI).translate(0, h - 0.8, -0.5));
    k.flush();
    return V(x, y, z);
  });

  // ================================================================ three things to stop for on the way (src/desert-sites.js wayPlaces)
  const way = {};
  {
    const P = wayPlaces(), at = (p) => V(p.x, terrain.heightAt(p.x, p.z), p.z);
    // the keepers' bowl: a bronze bowl on a low stone at the second stone's foot (fill it: src/story/desert-way.js)
    const bowlAt = at(P.bowl), bk = new Kit(root, 'The keepers’ bowl', bowlAt.clone().setY(bowlAt.y - 0.25), S.yaw);
    bk.both(M.marker, rough(new THREE.CylinderGeometry(0.55, 0.7, 0.85, 7, 1).translate(0, 0.42, 0), 0.04, 1.4, 3));
    bk.add(M.bronze, new THREE.LatheGeometry([[0.06, 0], [0.4, 0.05], [0.5, 0.2], [0.46, 0.24]].map(([r, y]) => new THREE.Vector2(r, y)), 12).translate(0, 0.85, 0));
    bk.flush();
    const fluid = new THREE.Mesh(new THREE.CircleGeometry(0.42, 14).rotateX(-Math.PI / 2), M.wayFluid);
    fluid.position.copy(bowlAt).setY(bowlAt.y - 0.25 + 0.85 + 0.19); fluid.userData.noCollide = true; fluid.visible = false;
    root.add(fluid);
    way.bowl = { at: bowlAt, top: fluid.position.clone(), fluid, stone: stones[WAY.bowl.stone] };
    // the keepers' cold camp, halfway: a ring of blackened stones, two poles leaning together, a flat stone with tallies
    const campAt = at(P.camp), ck = new Kit(root, 'The keepers’ camp', campAt.clone().setY(campAt.y - 0.1), S.yaw + 0.6);
    for (let j = 0; j < 9; j++) {
      const a = j / 9 * Math.PI * 2;
      ck.add(M.stone, rough(new THREE.IcosahedronGeometry(0.2, 0).scale(1.2, 0.7, 1).translate(Math.sin(a) * 0.85, 0.12, Math.cos(a) * 0.85), 0.03, 4, j));
    }
    ck.add(M.ink, new THREE.CircleGeometry(0.62, 12).rotateX(-Math.PI / 2).translate(0, 0.04, 0));   // the old ashes
    for (const sx of [-1, 1]) ck.add(M.stone, new THREE.CylinderGeometry(0.05, 0.06, 2.6, 5).rotateZ(sx * 0.42).translate(sx * 0.55 + 1.9, 1.2, -0.4));
    ck.both(M.marker, box(0.9, 0.22, 0.6, -1.6, 0.11, 0.6));   // the tally stone
    for (let j = 0; j < 6; j++) ck.add(M.ink, box(0.03, 0.01, 0.22, -1.9 + j * 0.1 + (j > 2 ? 0.12 : 0), 0.225, 0.6));
    ck.flush();
    way.camp = { at: campAt, look: campAt.clone().add(V(0, 0.4, 0)) };
    // the bell glinting half in the sand near the end, a few metres off the way
    const bellAt = at(P.bell), bell = new THREE.Group();
    bell.position.copy(bellAt); bell.name = 'A bell in the sand';
    const cup = new THREE.Mesh(new THREE.LatheGeometry([[0.02, 0.22], [0.08, 0.2], [0.11, 0.08], [0.15, 0]].map(([r, y]) => new THREE.Vector2(r, y)), 10), M.bronze);
    cup.rotation.set(0.9, 0, 0.3); cup.position.y = 0.02;
    const glint = new THREE.Mesh(new THREE.OctahedronGeometry(0.12, 0).scale(1, 2, 1), M.glint);
    glint.position.set(0.05, 0.22, 0.04);
    for (const m of [cup, glint]) { m.userData.noCollide = true; bell.add(m); }
    root.add(bell);
    way.bell = { at: bellAt, group: bell, glint };
  }

  // ================================================================ two stops on the straight ride out (src/desert-sites.js ridePlaces)
  const ride = {};
  {
    const P = ridePlaces(), at = (p) => V(p.x, terrain.heightAt(p.x, p.z), p.z);
    const cloth = makeMaterial({ color: '#c8483a', flat: true, side: THREE.DoubleSide }), cream = makeMaterial({ color: '#f3ead8', flat: true, side: THREE.DoubleSide });
    const wood = makeMaterial({ color: '#8a6a4a', flat: true, side: THREE.DoubleSide }), salt = makeMaterial({ color: '#f4f0e6', flat: true });
    // the salt-carrier's shade: a tall pole with a long pennant (seen over the dunes), a canted awning striped red
    // and cream on two shorter poles, her salt in blocks on a sledge, a mat (Yara sits under it: src/levels/content.js)
    const shadeAt = at(P.shade), sk = new Kit(root, 'The salt-carrier’s shade', shadeAt.clone().setY(shadeAt.y - 0.3), P.shade.heading + 0.4);
    sk.both(wood, new THREE.CylinderGeometry(0.09, 0.12, 9.5, 6).translate(-1.6, 4.75, -1.2), new THREE.CylinderGeometry(0.2, 0.2, 9.5, 6).translate(-1.6, 4.75, -1.2));
    sk.add(cloth, new THREE.PlaneGeometry(4.2, 0.9).translate(2.1, 0, 0).translate(-1.6, 8.9, -1.2));   // the pennant, streaming downwind
    for (const [x, z] of [[1.9, 1.4], [1.9, -1.4]]) sk.both(wood, new THREE.CylinderGeometry(0.06, 0.07, 2.4, 5).translate(x, 1.2, z));
    for (let i = 0; i < 5; i++) sk.add(i % 2 ? cream : cloth, new THREE.PlaneGeometry(4.1, 0.62).rotateX(-Math.PI / 2).translate(0, 0, -1.24 + i * 0.62).applyMatrix4(new THREE.Matrix4().makeRotationZ(0.22)).translate(0.1, 2.75, 0));
    sk.both(wood, box(1.0, 0.18, 2.2, -0.9, 0.12, 2.2));   // the sledge, and her salt on it
    for (let i = 0; i < 3; i++) sk.add(salt, box(0.8, 0.34, 0.6, -0.9, 0.38 + (i === 2 ? 0.34 : 0), 1.55 + (i % 2) * 0.66 + (i === 2 ? 0.33 : 0)));
    sk.add(M.ink, box(0.03, 0.02, 2.0, -1.4, 0.23, 2.2)).add(M.ink, box(0.03, 0.02, 2.0, -0.4, 0.23, 2.2));   // its runners' cords
    sk.add(cream, new THREE.PlaneGeometry(1.6, 2.2).rotateX(-Math.PI / 2).translate(0.4, 0.04, 0));   // the mat
    sk.flush();
    ride.shade = { at: shadeAt, seat: sk.world(0.4, 0, 0), pennant: sk.world(-1.6, 9, -1.2) };
    // a sand-skiff's wreck: a long hull lying on its side, half under a dune, its ribs showing at the stern, the mast
    // still standing out of it at a lean with a rag of sail (it shows a long way off), a little of its cargo spilled
    const wreckAt = at(P.wreck), wk = new Kit(root, 'A sand-skiff’s wreck', wreckAt.clone().setY(wreckAt.y - 0.5), P.wreck.heading - 1.1);
    const hull = new THREE.CylinderGeometry(0.35, 1.9, 12, 14, 3, true, Math.PI * 0.35, Math.PI * 1.3).rotateX(-Math.PI / 2).rotateZ(0.95).scale(1, 0.8, 1).translate(0, 1.1, 0);   // (open along its top, tapering to the bow)
    wk.both(wood, hull, box(3, 2.6, 11, 0, 1.3, 0));
    wk.add(cream, new THREE.CylinderGeometry(0.9, 1.93, 6, 14, 1, true, Math.PI * 1.2, 0.35).rotateX(-Math.PI / 2).rotateZ(0.95).scale(1, 0.8, 1).translate(0, 1.1, -2.4));   // a faded band of its paint
    for (let i = 0; i < 4; i++) wk.add(wood, new THREE.TorusGeometry(1.85, 0.08, 4, 10, Math.PI * 1.1).rotateZ(0.95 + Math.PI * 0.35).translate(0, 1.1, 6.3 + i * 0.75));   // the bare ribs at the stern
    const mast = new THREE.CylinderGeometry(0.1, 0.16, 11, 6).translate(0, 5.5, 0).rotateZ(-0.38).translate(0.4, 1.6, -1.5);
    wk.both(wood, mast, new THREE.CylinderGeometry(0.25, 0.25, 11, 6).translate(0, 5.5, 0).rotateZ(-0.38).translate(0.4, 1.6, -1.5));
    wk.add(cream, new THREE.PlaneGeometry(2.2, 3.4).translate(1.1, -1.7, 0).rotateZ(-0.38).translate(0.4 + Math.sin(0.38) * 10.4, 1.6 + Math.cos(0.38) * 10.4, -1.5));   // a rag of sail
    for (const [x, z, r] of [[2.9, -3.6, 0.45], [3.5, -2.4, 0.35], [-2.8, 3.5, 0.4]]) wk.both(salt, box(r * 1.6, r, r * 1.2, x, r * 0.5 + 0.5, z));   // spilled salt blocks
    wk.flush();
    ride.wreck = { at: wreckAt, look: wk.world(0.5, 2.2, -1.5), stand: wk.world(3.4, 0.5, -1.5) };
    // the skiff's stone anchor, short of halfway (level design audit, third round: Yara's shade to the wreck was 418 m with
    // nothing on it): a great ring of stone dragged loose, tipped half into the sand, the stub of its rope trailing off
    // over the dunes toward the wreck it was meant to hold
    const anchorAt = at(P.anchor), toWreck = Math.atan2(wreckAt.x - anchorAt.x, wreckAt.z - anchorAt.z);
    const ak = new Kit(late, 'The skiff’s anchor', anchorAt.clone().setY(anchorAt.y - 0.4), toWreck);
    const ring = new THREE.TorusGeometry(1.25, 0.42, 6, 14).rotateX(Math.PI / 2 - 0.5).translate(0, 0.55, 0);
    ak.both(M.marker, rough(ring, 0.06, 1.3, 11), new THREE.CylinderGeometry(1.4, 1.5, 1.2, 10).translate(0, 0.5, 0));
    const ropeGeos = [];
    for (let k = 0; k < 6; k++) {
      const z0 = 1.2 + k * 1.6, z1 = z0 + 1.6, wob = (q) => Math.sin(q * 0.9) * 0.35;
      ropeGeos.push(new THREE.CylinderGeometry(0.06, 0.06, 1.65, 4).rotateX(Math.PI / 2).translate((wob(z0) + wob(z1)) / 2, 0, (z0 + z1) / 2));
    }
    for (const g of ropeGeos) {   // (lying on the sand under it)
      g.computeBoundingBox(); const c = g.boundingBox.getCenter(V()), p = ak.world(c.x, 0, c.z);
      g.translate(0, terrain.heightAt(p.x, p.z) - ak.origin.y + 0.05, 0);
      ak.add(wood, g);
    }
    ak.flush();
    ride.anchor = { at: anchorAt, look: ak.world(0, 0.9, 0), stand: ak.world(1.9, 0, -1.2) };
    // the tusk gate, four fifths of the way, where the red rocks begin (level design audit v1.15: 518 m from the wreck
    // to the Hearth with nothing on it): two great tusks the Givers stood in the sand either side of the way, leaning in
    // until their tips cross high over it, so it shows from the wreck. In their shade a low wall of red stones to sit
    // on, a sealed jar the Givers left for whoever came this far, and a little cairn of offerings riders leave
    const gateAt = at(P.tusks), gk = new Kit(root, 'The tusk gate', gateAt.clone().setY(gateAt.y - 0.6), P.tusks.heading);
    const ivory = makeMaterial({ color: '#f2ead6' });   // (the bone of the desert's giants: src/desert-landmarks.js)
    for (const s of [-1, 1]) {
      // (each from its socket of stones, out and up, then curving in over the way; its tip past the middle; its foot set
      // in the sand where the sand is, on a dune's slope one side stands lower than the other)
      const foot = gk.world(s * 7.6, 0, 0.6 * s), gy = terrain.heightAt(foot.x, foot.z) - gk.origin.y;
      const pts = [V(s * 7.6, gy - 1.6, 0.6 * s), V(s * 7.9, Math.max(4.5, gy + 4.2), 0.3 * s), V(s * 6.2, 9.6, 0), V(s * 2.6, 13.2, -0.4 * s), V(-s * 1.8, 13.9, -0.8 * s)];
      gk.both(ivory, taper(pts, 1.25, 0.32, 22, 9));
      for (let j = 0; j < 5; j++) {
        const a = j / 5 * Math.PI * 2 + s, sx = s * 7.6 + Math.sin(a) * 1.7, sz = 0.6 * s + Math.cos(a) * 1.7, sp = gk.world(sx, 0, sz);
        gk.both(M.marker, rough(new THREE.IcosahedronGeometry(0.75, 0).scale(1.2, 0.7, 1).translate(sx, terrain.heightAt(sp.x, sp.z) - gk.origin.y + 0.1, sz), 0.08, 2, j));
      }
    }
    const gyAt = (lx, lz) => { const p = gk.world(lx, 0, lz); return terrain.heightAt(p.x, p.z) - gk.origin.y; };
    const w0 = Math.min(gyAt(1.2, -2.6), gyAt(5.6, -2.6)) - 0.4, w1 = Math.max(gyAt(1.2, -2.6), gyAt(5.6, -2.6)) + 0.5;
    gk.both(M.marker, rough(box(4.4, w1 - w0, 0.9, 3.4, (w0 + w1) / 2, -2.6), 0.06, 1.2, 7));   // the low wall in the shade (sunk where the sand slopes)
    const jar = new THREE.LatheGeometry([[0.05, 0], [0.32, 0.06], [0.42, 0.4], [0.34, 0.74], [0.16, 0.86], [0.18, 0.96], [0.02, 0.98]].map(([r, y]) => new THREE.Vector2(r, y)), 12);
    gk.both(M.marker, jar.translate(1.6, w1, -2.6));   // the Givers' jar, sealed with a stone, the eye painted on it
    gk.add(M.ink, glyphGeometry(0.3).translate(1.6, w1 + 0.4, -2.17));
    for (let j = 0; j < 4; j++) gk.add(M.stone, rough(new THREE.IcosahedronGeometry(0.34 - j * 0.06, 0).scale(1.2, 0.6, 1).translate(5.6, gyAt(5.6, -1.9) + 0.16 + j * 0.22, -1.9), 0.02, 4, j));   // the cairn
    gk.add(cloth, new THREE.PlaneGeometry(0.22, 0.9).translate(0, -0.45, 0).rotateZ(0.3).translate(5.6, gyAt(5.6, -1.9) + 1.15, -1.9));   // a strip of red cloth tied on it
    gk.flush();
    ride.tusks = { at: gateAt, look: gk.world(1.6, w1 + 0.45, -2.6), stand: gk.world(1.6, gyAt(1.6, -1.2), -1.2), top: gk.world(0, 13.6, 0) };
  }

  // ================================================================ inside: the hall
  const O = V(STORY.hearthCave.x, STORY.hearthCave.y, STORY.hearthCave.z);
  const cave = new Kit(root, 'The Givers’ Hearth (inside)', O, 0);
  const HR = HEARTH.hall;
  {
    cave.both(M.caveFloor, new THREE.CylinderGeometry(HR + 1, HR + 1, 1, 28).translate(0, -0.5, 0));
    const door = (x, y, z) => Math.abs(x) < 2.7 && y < 4.8 && z > 10;
    const dome = (seg, r) => cut(inward(rough(new THREE.SphereGeometry(r, seg, Math.round(seg / 2), 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.8, 1), 0.9, 0.22, 4)), door);
    cave.both(M.cave, dome(28, HR + 1.5), dome(14, HR + 1.5));
    // the passage from the door, and the dark at its end (the way back out)
    for (const s of [-1, 1]) cave.both(M.cave, box(1.6, 5.2, 13, s * 3.3, 2.6, 21.5));
    cave.both(M.cave, box(8.2, 1.4, 13, 0, 5.5, 21.5));
    cave.both(M.caveFloor, box(5.2, 0.5, 13, 0, -0.25, 21.5));
    cave.add(M.ink, new THREE.PlaneGeometry(5, 4.8).rotateY(Math.PI).translate(0, 2.4, 27.9));
    cave.solid(box(6, 6, 0.5, 0, 3, 28.3));

    // the back wall: a block you climb (its face plain rock, 5 m), the shelf on top, and the wall behind with the hollow
    const SH = HEARTH.shelf, A = { w: 1.4, h: 1.4, d: 0.95 };
    cave.both(M.carved, box(13, SH, 4, 0, SH / 2, -13));
    cave.both(M.carved, box((13 - A.w) / 2, 5, 2.2, -(A.w / 2 + (13 - A.w) / 4), SH + 2.5, -16.1));
    cave.both(M.carved, box((13 - A.w) / 2, 5, 2.2, A.w / 2 + (13 - A.w) / 4, SH + 2.5, -16.1));
    cave.both(M.carved, box(A.w, 5 - A.h, 2.2, 0, SH + A.h + (5 - A.h) / 2, -16.1));
    cave.both(M.carved, box(A.w, A.h, 2.2 - A.d, 0, SH + A.h / 2, -16.1 - A.d / 2));
    // the stone's cradle: a little bronze cup in the hollow
    cave.add(M.bronze, new THREE.LatheGeometry([[0.05, 0], [0.32, 0.03], [0.36, 0.16], [0.3, 0.18]].map(([r, y]) => new THREE.Vector2(r, y)), 10).translate(0, SH, -15.45));
    // the Givers' mark over the hollow, dim
    cave.add(M.glyph, glyphGeometry(0.9).translate(0, SH + 2.4, -14.95));

    // the plinth and its groove, the hole at the groove's end, the chain up the wall and over to the grille
    const P = HEARTH.plinth, pl = P.z0 - P.z1;
    cave.both(M.carved, box(P.w, P.h, pl, P.x, P.h / 2, (P.z0 + P.z1) / 2));
    for (const s of [-1, 1]) cave.add(M.stone, box(0.18, 0.22, pl - 0.2, P.x + s * 0.5, P.h + 0.11, (P.z0 + P.z1) / 2));
    cave.add(M.stone, box(1.2, 0.3, 0.2, P.x, P.h + 0.15, P.z0 + 0.15));   // the lip the ball rests against
    cave.add(M.ink, new THREE.CircleGeometry(0.75, 14).rotateX(-Math.PI / 2).translate(P.x, P.h + 0.02, P.z1 + 0.85));
    const chain = [V(P.x, P.h, P.z1 + 0.85), V(P.x - 0.4, 3.5, P.z1 - 0.6), V(P.x * 0.7, 8.5, -11.5), V(P.x * 0.3, 10.2, -13.2), V(0, 9.4, -14.6), V(0, SH + A.h + 0.9, -14.92)];
    cave.add(M.bronze, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(chain), 48, 0.07, 4));
    for (const p of [chain[2], chain[4]]) cave.add(M.bronze, new THREE.TorusGeometry(0.32, 0.08, 5, 12).translate(p.x, p.y, p.z));

    // the old marks in the floor: from the passage round to the plinth's front (they glow with the stone's breath)
    const trail = new THREE.CatmullRomCurve3([V(0.4, 0, 13), V(-2.6, 0, 9), V(-6.5, 0, 5.4), V(-9.0, 0, 1.6)]);
    for (let i = 0; i <= 9; i++) {
      const p = trail.getPointAt(i / 9), t = trail.getTangentAt(i / 9);
      cave.add(M.marks, glyphGeometry(0.75, 0.04).rotateX(-Math.PI / 2).rotateY(Math.atan2(t.x, t.z) + Math.PI).translate(p.x, 0.03, p.z));
    }
    // a few rocks fallen from the dome
    for (const [x, z, r] of [[8, 4, 1.1], [11, -6, 1.5], [-13, 6, 1.2], [5, -10, 0.8], [13, 2, 0.9]]) cave.both(M.cave, rough(new THREE.IcosahedronGeometry(r, 1).translate(x, r * 0.5, z), 0.15, 2.5, x));
  }
  cave.flush();
  const L = (x, y, z) => cave.world(x, y, z);

  // ---- the moving pieces: the grille, the ball, the stone (noCollide: the story moves them)
  const dyn = (o) => { o.traverse((c) => { c.userData.noCollide = true; c.userData.dynamic = true; }); root.add(o); return o; };
  const grille = dyn(new THREE.Group());
  grille.position.copy(L(HEARTH.grille.at.x, HEARTH.grille.at.y, HEARTH.grille.at.z));
  {
    const bars = [];
    for (let i = 0; i < 6; i++) bars.push(box(0.13, 1.5, 0.14, -0.6 + i * 0.24, 0.75, 0));
    bars.push(box(1.55, 0.14, 0.18, 0, 1.47, 0), box(1.55, 0.12, 0.16, 0, 0.5, 0));
    grille.add(new THREE.Mesh(mergeGeometries(bars.map(prep)), M.stone));
  }
  const ball = dyn(new THREE.Mesh(new THREE.IcosahedronGeometry(HEARTH.ball.r, 2), M.stone));
  ball.position.copy(L(...HEARTH.ball.rest.toArray()));
  const ballGlyph = new THREE.Mesh(glyphGeometry(0.5, 0.05).translate(0, 0, HEARTH.ball.r * 0.98), M.glyph);
  ball.add(ballGlyph);
  // the spark-stone: a rough round stone that glows from inside (warm white at its heart)
  const stone = dyn(new THREE.Group());
  stone.position.copy(L(...HEARTH.stone.toArray()));
  stone.add(new THREE.Mesh(rough(new THREE.IcosahedronGeometry(0.24, 1), 0.03, 6, 1), M.spark));
  stone.add(new THREE.Mesh(new THREE.IcosahedronGeometry(0.3, 0).scale(1, 0.9, 1.1), makeMaterial({ color: '#ffb36b', glow: 0.9, flat: true, key: 'hearth.shell' })));

  // ---- lights: dim at the door, the stone's breath at the hollow (pulsed by the story), a little by the plinth
  const stoneLight = new THREE.Vector4(...L(0, HEARTH.shelf + 0.8, -14.2).toArray(), 14);
  const plinthLight = new THREE.Vector4(...L(HEARTH.plinth.x + 1.8, 2.6, -2.5).toArray(), 6);
  const doorLight = new THREE.Vector4(...L(0, 3, 19).toArray(), 8);
  lights.push(stoneLight, plinthLight, doorLight);

  // ---- the way in and out
  const inside = L(...HEARTH.inside.toArray()), exitAt = L(...HEARTH.exit.toArray());
  const fwd = V(Math.sin(S.yaw), 0, Math.cos(S.yaw));
  portals.push(
    { at: door.clone().add(V(0, 0.4, 0)), r: 1.6, to: inside.clone(), heading: Math.PI, label: 'Givers’ Hearth' },
    { at: exitAt.clone().add(V(0, 0.5, 0)), r: 1.6, to: doorFront.clone().addScaledVector(fwd, 0.5), heading: S.yaw, label: 'passage out' },
  );

  const H_ = {
    root, site: V(S.x, doorG, S.z), door, doorFront, carving, carvingFoot, yaw: S.yaw, chimneyTop, stones, slitLight,
    origin: O, local: L, inside, exit: exitAt, group: cave.group,
    grille, grilleRest: grille.position.clone(), ball, ballRest: ball.position.clone(), ballEnd: L(...HEARTH.ball.end.toArray()),
    stone, stoneRest: stone.position.clone(), stoneLight, plinthLight, doorLight,
    shelfFront: L(0, HEARTH.shelf, -11.6), plinthFront: L(HEARTH.plinth.x, 0, HEARTH.plinth.z0 + 1.6),
    materials: { marks: M.marks, slit: M.slit, spark: M.spark, wayMark: M.wayMark, wayFluid: M.wayFluid, glint: M.glint }, way, ride,
    lights, portals, late,
    /** Show the hall only when the camera is down there; the butte is always drawn (it is a landmark). */
    update(dt, t, { camera } = {}) {
      if (!camera) return;
      const inCave = camera.position.distanceTo(O) < 220;
      cave.group.visible = inCave;
      grille.visible = inCave;
      ball.visible = inCave && !ball.userData.gone;   // (gone: it dropped into its hole, src/story/desert-spark.js)
    },
  };
  return H_;
}
