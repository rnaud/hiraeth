import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// The Glass Dunes' ways (the merged worlds' follow-ups, October 2026: the v1.39 level design audit found its places
// bunched by the ship and the Clock-House, two makers' boxes alone 180 m from anything, 7 m of height between its lowest
// and highest place, and the walk back from the Clock-House the way you came). No rng: the basin round them stays as it
// was. Drawn with the dunes' own materials (src/levels/glass-dunes.js M: the pole's wood, the floats' glowing glass), so
// no new look and no new shader.
//
//   the float-posts      poles with one of the glassworkers' green floats on each, from the Clock-House's door west along
//                        the warm flow and north up to the landing flat: the carriers set them out to bring the clocks'
//                        oil home after dark. Halfway, the float-blowers' rack, a frame of floats left to cool. The way
//                        home Wim sends you by.
//   the wave's cairn     on the frozen wave's crest, 33 m over the valley, a cairn of cracked floats round a pole with a
//                        long streamer: where the carriers climb to count the camps' lights. The basin's one high place
//                        (from it: both camps, the Clock-House, the breaking wave, the ship).
//
//   buildFloatPosts(scene, M, terrain) → { points, rack }
//   buildWaveCairn(scene, M, physics-free top) → { at, wave(t) }

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const nonIdx = (g) => (g.index ? g.toNonIndexed() : g);

/** The float-posts, [x, z]: from beside the Clock-House's door to the landing flat's west side. */
export const FLOAT_POSTS = [[104, 94], [84, 104], [62, 108], [40, 113], [18, 122], [-2, 136], [-18, 156], [-26, 178], [-18, 200]];
/** The float-blowers' rack, by the sixth post. */
export const FLOAT_RACK = { x: 6, z: 134, yaw: 0.6 };
/** The wave's cairn on the frozen wave's crest (src/levels/glass-dunes.js GLASS_RIDGES 'wave'; its top found by a ray). */
export const WAVE_CAIRN = { x: 20, z: 31 };

export function buildFloatPosts(scene, M, terrain) {
  const poles = [], floats = [];
  const points = [];
  FLOAT_POSTS.forEach(([x, z], i) => {
    const y = terrain.heightAt(x, z), h = 2.6 + (i % 3) * 0.3;
    poles.push(nonIdx(new THREE.CylinderGeometry(0.07, 0.1, h, 5).translate(x, y + h / 2 - 0.2, z)));
    poles.push(nonIdx(new THREE.TorusGeometry(0.2, 0.04, 4, 8).rotateX(Math.PI / 2).translate(x, y + h - 0.1, z)));
    floats.push(nonIdx(new THREE.IcosahedronGeometry(0.36, 1).translate(x, y + h + 0.24, z)));
    points.push([x, y + 0.5, z]);
  });
  // the rack: two trestles and three bars, a float hung under each bar (drawn: you walk round it)
  const { x, z, yaw } = FLOAT_RACK, y = terrain.heightAt(x, z);
  const rack = [], hung = [];
  const frame = new THREE.Matrix4().compose(V(x, y, z), new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), yaw), V(1, 1, 1));
  for (const s of [-1.6, 1.6]) for (const k of [-1, 1]) rack.push(new THREE.CylinderGeometry(0.05, 0.06, 2.2, 4).rotateX(k * 0.3).translate(s, 1.05, k * 0.32));
  for (const [bh, bz] of [[2.05, 0], [1.4, 0.36], [1.4, -0.36]]) rack.push(new THREE.CylinderGeometry(0.04, 0.04, 3.4, 4).rotateZ(Math.PI / 2).translate(0, bh, bz));
  for (let i = 0; i < 7; i++) hung.push(new THREE.IcosahedronGeometry(0.2 + (i % 3) * 0.05, 1).translate(-1.3 + i * 0.43, 1.75 - (i % 2) * 0.62, (i % 2 ? 0.36 : 0) * (i % 4 < 2 ? 1 : -1)));
  const g = new THREE.Group();
  g.name = 'The float-posts';
  const poleMesh = new THREE.Mesh(mergeGeometries([...poles, ...rack.map((q) => nonIdx(q).applyMatrix4(frame))]), M.pole);
  const floatMesh = new THREE.Mesh(mergeGeometries([...floats, ...hung.map((q) => nonIdx(q).applyMatrix4(frame))]), M.float);
  // (the poles collide as drawn; the floats on them are drawn only, within a hand of the poles' tops)
  floatMesh.userData.noCollide = true;
  g.add(poleMesh, floatMesh);
  scene.add(g);
  return { points, rack: V(x, y + 0.5, z) };
}

export function buildWaveCairn(scene, M, top) {
  const { x, z } = WAVE_CAIRN;
  const y = top;
  const stones = [], floats = [];
  // cracked floats heaped round the pole's foot, the pole, a crossbar, the streamer off it
  for (let i = 0; i < 9; i++) { const a = i * 0.7, r = 0.5 + (i % 3) * 0.22; floats.push(nonIdx(new THREE.IcosahedronGeometry(0.3 + (i % 2) * 0.08, 0).translate(x + Math.cos(a) * r, y + 0.2 + Math.floor(i / 4) * 0.35, z + Math.sin(a) * r))); }
  stones.push(nonIdx(new THREE.CylinderGeometry(0.06, 0.08, 5, 5).translate(x, y + 2.4, z)), nonIdx(new THREE.CylinderGeometry(0.04, 0.04, 1.4, 4).rotateZ(Math.PI / 2).translate(x, y + 4.4, z)));
  const L = 9, tail = new THREE.PlaneGeometry(L, 0.7, 16, 1).translate(L / 2, 0, 0);
  { const p = tail.attributes.position; for (let i = 0; i < p.count; i++) { const u = p.getX(i) / L; p.setY(i, p.getY(i) * (1 - 0.8 * u)); p.setZ(i, Math.sin(u * 7) * 0.4 * u); } tail.computeVertexNormals(); }
  const streamer = new THREE.Mesh(tail, M.cloth[0]);
  streamer.position.set(x, y + 4.7, z); streamer.rotation.y = 0.9;
  const g = new THREE.Group();
  g.name = 'The wave’s cairn';
  const pole = new THREE.Mesh(mergeGeometries(stones), M.pole), heap = new THREE.Mesh(mergeGeometries(floats), M.float);
  for (const m of [heap, streamer]) m.userData.noCollide = true;
  g.add(pole, heap, streamer);
  scene.add(g);
  const base = streamer.rotation.y;
  return { at: V(x + 1.2, y + 0.5, z), top: V(x, y + 5, z), wave: (t) => { streamer.rotation.y = base + Math.sin(t * 0.8) * 0.15; streamer.rotation.x = Math.sin(t * 1.4) * 0.2; } };
}
