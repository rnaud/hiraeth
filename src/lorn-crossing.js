import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeMaterial } from './materials.js';

// Lorn's crossing (the merged worlds' follow-ups, October 2026). The crystal swamp and the Deep Wood are one world since
// v1.39, joined by 120 m of open water north of the landing island; nothing stood on it, so the skiff crossed 350 m with
// nothing on the way from the crystal cave to Hollin, and came home from the root cave the way it went. What the
// lamp-keepers left on the water between the swamp and their wood. No rng: the worlds round them stay as they were.
// Built after both temples (src/levels/perdide.js), so the audits' samples of what stood before stay where they were.
//
//   the keepers' light   a lamp tower on three stilts in the open water between the swamp and the wood, its lamp 18 m
//                        up: the light the keepers set where the swamp's water meets the wood's. Hollin still fills it
//                        each evening. The crossing's weenie: seen from the landing and from the cave island, lit.
//   the ferry bell       a bell on a post in the shallows off the landing island's north-west shore, rung for the
//                        keepers' boat in the days the egg-gatherers went up to the wood.
//   the water-way south  the water-way's lamps (src/deep-wood-ways.js) carried on south from the Deep Wood's island over
//                        the open water and down the channel east of the landing island, with the keepers' lamp-boat
//                        moored halfway: the way home by water ends at your ship now. Lit with the rest of the water-way.
//
//   buildKeepersLight(scene, terrain) → { at, top, lamp, height }
//   buildFerryBell(scene, terrain)    → { at }
//   buildWaterWaySouth(scene, terrain) → { points, boat, lit(on) }

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const nonIdx = (g) => (g.index ? g.toNonIndexed() : g);

/** The keepers' light, in the open water on the line from the crystal cave to Hollin's island. */
export const KEEPERS_LIGHT = { x: -44, z: -330, deck: 16, h: 25 };
/** The ferry bell, in the shallows off the landing island's north-west shore. */
export const FERRY_BELL = { x: -50, z: -206 };
/** The water-way's lamps south of the Deep Wood's island ([x, z]), and the lamp-boat moored halfway. */
export const WATER_WAY_SOUTH = [[40, -452], [58, -396], [66, -338], [62, -280], [60, -222], [58, -166]];
export const LAMP_BOAT = { x: 70, z: -306, heading: 0.15 };

// (the water-way's own materials, src/deep-wood-ways.js: no new look)
const mats = () => ({
  wood: makeMaterial({ color: '#3a3446', flat: true }),
  dark: makeMaterial({ color: '#6a5a5e', flat: true }),
  lamp: makeMaterial({ color: '#f2a07a', glow: 1 }),
});

export function buildKeepersLight(scene, terrain) {
  const { x, z, deck, h } = KEEPERS_LIGHT;
  const { wood, lamp } = mats();
  const parts = [], glass = [];
  const floor = Math.min(terrain.heightAt(x, z), 0) - 0.5;
  // three stilts splayed out from under the deck, braced twice on the way up
  for (let i = 0; i < 3; i++) {
    const a = i * (Math.PI * 2 / 3) + 0.4, fx = x + Math.cos(a) * 4.2, fz = z + Math.sin(a) * 4.2, tx = x + Math.cos(a) * 1.6, tz = z + Math.sin(a) * 1.6;
    const foot = V(fx, floor, fz), top = V(tx, deck, tz), len = foot.distanceTo(top);
    const g = new THREE.CylinderGeometry(0.28, 0.4, len, 6).translate(0, len / 2, 0);
    g.applyMatrix4(new THREE.Matrix4().lookAt(V(), top.clone().sub(foot), V(0, 0, 1)).multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2)));
    parts.push(nonIdx(g.translate(foot.x, foot.y, foot.z)));
    for (const k of [0.35, 0.7]) {
      const b = i === 2 ? 0 : i + 1, a2 = b * (Math.PI * 2 / 3) + 0.4;
      const p = foot.clone().lerp(top, k), q = V(x + Math.cos(a2) * (4.2 - 2.6 * k), floor + (deck - floor) * k, z + Math.sin(a2) * (4.2 - 2.6 * k));
      const d = p.distanceTo(q);
      const br = new THREE.CylinderGeometry(0.1, 0.1, d, 4).translate(0, d / 2, 0);
      br.applyMatrix4(new THREE.Matrix4().lookAt(V(), q.clone().sub(p), V(0, 0, 1)).multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2)));
      parts.push(nonIdx(br.translate(p.x, p.y, p.z)));
    }
  }
  // the deck, a rail post at each corner of its hexagon, the lamp-room's six posts and its roof
  parts.push(nonIdx(new THREE.CylinderGeometry(3.2, 3.2, 0.4, 6).translate(x, deck + 0.2, z)));
  for (let i = 0; i < 6; i++) {
    const a = i * Math.PI / 3;
    parts.push(nonIdx(new THREE.CylinderGeometry(0.07, 0.07, 1.1, 4).translate(x + Math.cos(a) * 3, deck + 0.95, z + Math.sin(a) * 3)));
    parts.push(nonIdx(new THREE.CylinderGeometry(0.09, 0.09, 4.2, 4).translate(x + Math.cos(a) * 1.7, deck + 2.5, z + Math.sin(a) * 1.7)));
  }
  parts.push(nonIdx(new THREE.ConeGeometry(2.6, 2.6, 6).translate(x, deck + 5.9, z)), nonIdx(new THREE.CylinderGeometry(0.06, 0.06, 1.8, 4).translate(x, deck + 7.9, z)));
  // a ladder up the first stilt's side, from the water to the deck (drawn: you reach the deck on the wings or the jump)
  const lad = [];
  for (const s of [-0.3, 0.3]) lad.push(nonIdx(new THREE.CylinderGeometry(0.04, 0.04, deck - floor, 4).translate(x + 2.2 + s, (deck + floor) / 2, z + 2.6)));
  for (let k = 1; k < (deck - floor) / 0.6; k++) lad.push(nonIdx(new THREE.BoxGeometry(0.6, 0.04, 0.05).translate(x + 2.2, floor + k * 0.6, z + 2.6)));
  // the lamp: a tall glass the keepers' coral, lit (Hollin fills it each evening)
  glass.push(nonIdx(new THREE.CylinderGeometry(1.25, 1.25, 3, 6).translate(x, deck + 2.3, z)));
  const g = new THREE.Group();
  g.name = 'The keepers’ light';
  const body = new THREE.Mesh(mergeGeometries(parts), wood);
  body.userData.castShadow = true;
  const ladder = new THREE.Mesh(mergeGeometries(lad), wood), light = new THREE.Mesh(mergeGeometries(glass), lamp);
  for (const m of [ladder, light]) m.userData.noCollide = true;
  g.add(body, ladder, light);
  scene.add(g);
  return { at: V(x, 0.5, z), top: V(x, deck + 8.8, z), lamp: V(x, deck + 2.3, z), height: h };
}

export function buildFerryBell(scene, terrain) {
  const { x, z } = FERRY_BELL;
  const { wood } = mats();
  const iron = makeMaterial({ color: '#2f2a3a', flat: true });   // (Wendel's egg-lamps' iron, src/lorn-ways.js)
  const g0 = Math.min(terrain.heightAt(x, z), 0);
  const post = [nonIdx(new THREE.CylinderGeometry(0.18, 0.24, 5.2 - g0, 6).translate(x, (5.2 + g0) / 2, z)), nonIdx(new THREE.BoxGeometry(1.6, 0.2, 0.2).translate(x + 0.7, 5, z))];
  const bell = [nonIdx(new THREE.ConeGeometry(0.42, 0.6, 8, 1, true).translate(x + 1.3, 4.45, z)), nonIdx(new THREE.CylinderGeometry(0.02, 0.02, 2.8, 4).translate(x + 1.3, 2.9, z))];
  const g = new THREE.Group();
  g.name = 'The ferry bell';
  const p = new THREE.Mesh(mergeGeometries(post), wood), b = new THREE.Mesh(mergeGeometries(bell), iron);
  b.userData.noCollide = true;
  g.add(p, b);
  scene.add(g);
  return { at: V(x, 0.5, z) };
}

export function buildWaterWaySouth(scene, terrain) {
  const { wood, dark, lamp } = mats();
  const posts = [], glass = [];
  // (the water-way's lamp on its post, src/deep-wood-ways.js lampAt)
  WATER_WAY_SOUTH.forEach(([x, z], i) => {
    const top = 2.8 + ((i + 1) % 2) * 0.5, g = Math.min(terrain.heightAt(x, z), 0);
    posts.push(nonIdx(new THREE.CylinderGeometry(0.16, 0.22, top - g + 0.8, 6).translate(x, (top + g - 0.8) / 2, z)));
    posts.push(nonIdx(new THREE.ConeGeometry(0.5, 0.45, 6).translate(x, top + 0.95, z)));
    glass.push(nonIdx(new THREE.CylinderGeometry(0.32, 0.32, 0.75, 6).translate(x, top + 0.38, z)));
  });
  // the lamp-boat: a long hull, a cabin box, a lamp on a pole over its bow, moored to the lamp beside it
  const B = LAMP_BOAT, hull = [];
  const frame = new THREE.Matrix4().compose(V(B.x, 0.05, B.z), new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), B.heading), V(1, 1, 1));
  hull.push(new THREE.BoxGeometry(2, 0.14, 6.4).translate(0, 0.07, 0));
  for (const sx of [-1, 1]) hull.push(new THREE.BoxGeometry(0.12, 0.6, 6.4).translate(sx, 0.36, 0));
  for (const sz of [-1, 1]) hull.push(new THREE.BoxGeometry(2, 0.6, 0.12).rotateX(sz * 0.45).translate(0, 0.4, sz * 3.25));
  hull.push(new THREE.BoxGeometry(1.5, 1.1, 1.8).translate(0, 0.7, -1.2), new THREE.BoxGeometry(1.8, 0.12, 2.1).translate(0, 1.3, -1.2));
  hull.push(new THREE.CylinderGeometry(0.06, 0.06, 2.6, 5).translate(0, 1.4, 2.6), new THREE.ConeGeometry(0.42, 0.4, 6).translate(0, 2.95, 2.6));
  hull.push(new THREE.CylinderGeometry(0.025, 0.025, 4, 4).rotateZ(Math.PI / 2 - 0.25).translate(-2.6, 0.9, 1.6));
  const boatGlass = nonIdx(new THREE.CylinderGeometry(0.28, 0.28, 0.6, 6).translate(0, 2.45, 2.6).applyMatrix4(frame));
  const g = new THREE.Group();
  g.name = 'The water-way south';
  // the posts collide as drawn (the skiff bumps them); the lamps are drawn only, within a hand of the posts' tops; the
  // boat rides the water over its floor (the clipping and contact audits: afloat on purpose)
  const woodMesh = new THREE.Mesh(mergeGeometries(posts), wood);
  const boatMesh = new THREE.Mesh(mergeGeometries(hull.map((q) => nonIdx(q).applyMatrix4(frame))), wood);
  boatMesh.name = 'The lamp-boat'; boatMesh.userData.noCollide = true; boatMesh.userData.floats = true;
  const glassGeo = mergeGeometries([...glass, boatGlass]);
  const unlit = new THREE.Mesh(glassGeo, dark), litGlass = new THREE.Mesh(glassGeo, lamp);
  litGlass.visible = false;
  for (const m of [unlit, litGlass]) m.userData.noCollide = true;
  unlit.userData.floats = true; litGlass.userData.floats = true;
  g.add(woodMesh, boatMesh, unlit, litGlass);
  scene.add(g);
  const lit = (on) => { litGlass.visible = !!on; unlit.visible = !on; };
  const points = WATER_WAY_SOUTH.map(([x, z]) => [x, Math.max(terrain.heightAt(x, z), 0) + 0.5, z]);
  return { points, boat: V(B.x, 0.5, B.z), lit };
}
