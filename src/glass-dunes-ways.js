import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeMaterial } from './materials.js';
import { SmokeColumn } from './story/flames.js';

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
//   the west posts       the same poles and floats, from the landing flat west by the giants' south end, up the red cleft
//                        and out by its arch, down the folded ravine, through the prism crossings to the pearl city, and
//                        from its east stair through the gap to the north camp: Fenna set them out to walk the old road by
//                        (issue #475: the west was off every path). WEST_POSTS; the line runs on over the pearl city's
//                        plaza between its stairs (WEST_LINE).
//
//   buildFloatPosts(scene, M, terrain, { posts, rack, name }) → { points, rack }
//   buildWaveCairn(scene, M, physics-free top) → { at, wave(t) }

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const nonIdx = (g) => (g.index ? g.toNonIndexed() : g);

/** The float-posts, [x, z]: from beside the Clock-House's door to the landing flat's west side. */
export const FLOAT_POSTS = [[104, 94], [84, 104], [62, 108], [40, 113], [18, 122], [-2, 136], [-18, 156], [-26, 178], [-18, 200]];
/**
 * The west posts, [x, z] (issue #475): every one on open sand 3-5 m beside the walk (none under the prism crossings'
 * bridge), in two runs: from the landing flat to the pearl city's south stair, and from its east stair to the north camp.
 */
export const WEST_POSTS = [
  [[-22, 254], [-42, 274], [-60, 291], [-87, 295], [-115, 298], [-143, 302], [-174, 315], [-196, 325], [-224, 325], [-241, 306],
    [-241, 278], [-240, 238], [-240, 214], [-265, 205], [-293, 205], [-321, 205], [-333, 180], [-333, 152], [-333, 124], [-333, 92],
    [-333, 64], [-330, 35], [-333, 15], [-333, -13], [-333, -41], [-333, -111]],
  [[-273, -226], [-248, -213], [-212, -200], [-185, -193], [-142, -187], [-114, -185], [-86, -184], [-60, -183], [-32, -183]],
];
/** The float-blowers' rack, by the sixth post. */
export const FLOAT_RACK = { x: 6, z: 134, yaw: 0.6 };
/** The breaker's cairn on the breaking wave's crest, at its highest (90 m), walked up to along its back from its east foot. */
export const BREAKER_CAIRN = { x: -80, z: -236 };
/** The wave's cairn on the frozen wave's crest (src/levels/glass-dunes.js GLASS_RIDGES 'wave'; its top found by a ray). */
export const WAVE_CAIRN = { x: 20, z: 31 };

export function buildFloatPosts(scene, M, terrain, { posts = FLOAT_POSTS, rack: withRack = true, name = 'The float-posts' } = {}) {
  const poles = [], floats = [];
  const points = [];
  posts.forEach(([x, z], i) => {
    const y = terrain.heightAt(x, z), h = 2.6 + (i % 3) * 0.3;
    poles.push(nonIdx(new THREE.CylinderGeometry(0.07, 0.1, h, 5).translate(x, y + h / 2 - 0.2, z)));
    poles.push(nonIdx(new THREE.TorusGeometry(0.2, 0.04, 4, 8).rotateX(Math.PI / 2).translate(x, y + h - 0.1, z)));
    floats.push(nonIdx(new THREE.IcosahedronGeometry(0.36, 1).translate(x, y + h + 0.24, z)));
    points.push([x, y + 0.5, z]);
  });
  // the rack: two trestles and three bars, a float hung under each bar (drawn: you walk round it)
  const { x, z, yaw } = FLOAT_RACK, y = terrain.heightAt(x, z);
  const rack = [], hung = [];
  if (!withRack) {
    const g = new THREE.Group();
    g.name = name;
    const poleMesh = new THREE.Mesh(mergeGeometries(poles), M.pole), floatMesh = new THREE.Mesh(mergeGeometries(floats), M.float);
    floatMesh.userData.noCollide = true;
    g.add(poleMesh, floatMesh);
    scene.add(g);
    return { points, rack: null };
  }
  const frame = new THREE.Matrix4().compose(V(x, y, z), new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), yaw), V(1, 1, 1));
  for (const s of [-1.6, 1.6]) for (const k of [-1, 1]) rack.push(new THREE.CylinderGeometry(0.05, 0.06, 2.2, 4).rotateX(k * 0.3).translate(s, 1.05, k * 0.32));
  for (const [bh, bz] of [[2.05, 0], [1.4, 0.36], [1.4, -0.36]]) rack.push(new THREE.CylinderGeometry(0.04, 0.04, 3.4, 4).rotateZ(Math.PI / 2).translate(0, bh, bz));
  for (let i = 0; i < 7; i++) hung.push(new THREE.IcosahedronGeometry(0.2 + (i % 3) * 0.05, 1).translate(-1.3 + i * 0.43, 1.75 - (i % 2) * 0.62, (i % 2 ? 0.36 : 0) * (i % 4 < 2 ? 1 : -1)));
  const g = new THREE.Group();
  g.name = name;
  const poleMesh = new THREE.Mesh(mergeGeometries([...poles, ...rack.map((q) => nonIdx(q).applyMatrix4(frame))]), M.pole);
  const floatMesh = new THREE.Mesh(mergeGeometries([...floats, ...hung.map((q) => nonIdx(q).applyMatrix4(frame))]), M.float);
  // (the poles collide as drawn; the floats on them are drawn only, within a hand of the poles' tops)
  floatMesh.userData.noCollide = true;
  g.add(poleMesh, floatMesh);
  scene.add(g);
  return { points, rack: V(x, y + 0.5, z) };
}

export function buildWaveCairn(scene, M, top, { at = WAVE_CAIRN, name = 'The wave’s cairn', tall = false } = {}) {
  const { x, z } = at;
  const y = top, k = tall ? 1.6 : 1;   // (the breaker's taller, its streamer longer: seen over the valley from the landing)
  const stones = [], floats = [];
  // cracked floats heaped round the pole's foot, the pole, a crossbar, the streamer off it
  for (let i = 0; i < 9; i++) { const a = i * 0.7, r = 0.5 + (i % 3) * 0.22; floats.push(nonIdx(new THREE.IcosahedronGeometry(0.3 + (i % 2) * 0.08, 0).translate(x + Math.cos(a) * r, y + 0.2 + Math.floor(i / 4) * 0.35, z + Math.sin(a) * r))); }
  stones.push(nonIdx(new THREE.CylinderGeometry(0.06 * k, 0.08 * k, 5 * k, 5).translate(x, y + 2.4 * k, z)), nonIdx(new THREE.CylinderGeometry(0.04, 0.04, 1.4, 4).rotateZ(Math.PI / 2).translate(x, y + 4.4 * k, z)));
  const L = 9 * k, tail = new THREE.PlaneGeometry(L, 0.7 * k, 16, 1).translate(L / 2, 0, 0);
  { const p = tail.attributes.position; for (let i = 0; i < p.count; i++) { const u = p.getX(i) / L; p.setY(i, p.getY(i) * (1 - 0.8 * u)); p.setZ(i, Math.sin(u * 7) * 0.4 * u); } tail.computeVertexNormals(); }
  const streamer = new THREE.Mesh(tail, M.cloth[0]);
  streamer.position.set(x, y + 4.7 * k, z); streamer.rotation.y = 0.9;
  const g = new THREE.Group();
  g.name = name;
  const pole = new THREE.Mesh(mergeGeometries(stones), M.pole), heap = new THREE.Mesh(mergeGeometries(floats), M.float);
  for (const m of [heap, streamer]) m.userData.noCollide = true;
  g.add(pole, heap, streamer);
  scene.add(g);
  const base = streamer.rotation.y;
  return { at: V(x + 1.2, y + 0.5, z), top: V(x, y + 5 * k, z), wave: (t) => { streamer.rotation.y = base + Math.sin(t * 0.8) * 0.15; streamer.rotation.x = Math.sin(t * 1.4) * 0.2; } };
}

// The way up to the breaker's cairn (level design audit v1.49, issue #134: the cairn stood 368 m off the path, hard to
// pick out from the landing, a lone trip with nothing on the way). The carriers keep a kiln burning by the cairn, its
// smoke the basin's one column, standing over the far cliffs from the landing and the Clock-House. From beside the
// Clock-House's door a row of amber-floated posts runs north along the east ridge's foot to the breaking wave's east
// foot and up its long back to the cairn; on the way, what the carriers leave: their float-sledge, a shade with its water
// jar, and the wind-glass, a frame of floats that knock together in the wind. No rng.
//
//   buildCairnWay(scene, M, terrain, crestAt) → { points, posts, kiln, smoke, sights, update(dt, t, ctx) }

/** The posts' way up, [x, z]: on the sand from the Clock-House's door to the breaker's east foot, then up its back. */
export const CAIRN_WAY = {
  sand: [[106, 86], [100, 60], [110, 30], [128, 0], [140, -40], [148, -80], [158, -125], [172, -170], [184, -194]],
  every: 28, back: 18,
  sledge: [114, 24, 0.5], shade: [137, -18, -0.3], windGlass: [146, -56, 0.2],
  // (issue #561: the half-buried court, 279 m off the path and 157 m from anything, the Glass Dunes' last remote dead end)
  // where the way passes nearest the court the carriers leave their oil jars, and a short row of the same posts runs east
  // from them to the court's sand: `court` [x, z] from the fork to its mouth (src/glass-dunes-quarter.js COURT), `jars` [x, z, yaw]
  jars: [163, -121, 1.2], court: [[166, -127], [188, -134], [210, -141], [231, -147]],
};

/** Where the posts stand along a way ([x, z]), one every `every` m, the way's own ends included. */
export function postsAlong(way, every) {
  const out = [way[0]];
  let carry = 0;
  for (let i = 1; i < way.length; i++) {
    const [ax, az] = way[i - 1], [bx, bz] = way[i], L = Math.hypot(bx - ax, bz - az);
    for (let s = every - carry; s < L; s += every) out.push([ax + (bx - ax) * (s / L), az + (bz - az) * (s / L)]);
    carry = (carry + L) % every;
  }
  const end = way.at(-1), last = out.at(-1);
  if (Math.hypot(end[0] - last[0], end[1] - last[1]) > every * 0.4) out.push(end); else out[out.length - 1] = end;
  return out;
}

export function buildCairnWay(scene, M, terrain, crestAt) {
  const W = CAIRN_WAY, H = (x, z) => terrain.heightAt(x, z), up = (x, z) => crestAt(x, z) ?? H(x, z);
  const amber = makeAmber(), poles = [], floats = [], rags = [], posts = [];
  // the sand part, then the back: from the east foot straight up toward the cairn (the walk up it, tests/merged-ways.test.js)
  const foot = W.sand.at(-1), top = [BREAKER_CAIRN.x + 6, BREAKER_CAIRN.z + 1];
  const spots = [...postsAlong(W.sand, W.every), ...postsAlong([foot, top], W.back).slice(1)];
  // (issue #561) and the court's row, off the way at the carriers' oil jars
  const spur = [];
  [...spots, ...W.court].forEach(([x, z], i) => {
    const y = up(x, z), h = 2.9 + (i % 2) * 0.3;
    poles.push(nonIdx(new THREE.CylinderGeometry(0.07, 0.1, h + 0.4, 5).translate(x, y + h / 2 - 0.2, z)));
    floats.push(nonIdx(new THREE.IcosahedronGeometry(0.4, 1).translate(x, y + h + 0.28, z)));
    // a rag of the cairn's streamer tied under each float, so the row reads as the cairn's
    rags.push(nonIdx(new THREE.PlaneGeometry(0.9, 0.22).translate(0.45, 0, 0).rotateY(0.9 + i * 0.3).translate(x, y + h - 0.25, z)));
    (i < spots.length ? posts : spur).push(V(x, y + h + 0.28, z));
  });
  // the carriers' float-sledge: two runners, a bed of slats, three floats roped on
  const S = W.sledge, sy = H(S[0], S[1]), sm = new THREE.Matrix4().compose(V(S[0], sy, S[1]), new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), S[2]), V(1, 1, 1));
  const sled = [], sledFloats = [];
  for (const s of [-0.55, 0.55]) sled.push(new THREE.BoxGeometry(0.12, 0.14, 2.6).translate(s, 0.07, 0), new THREE.BoxGeometry(0.12, 0.3, 0.12).rotateX(0.7).translate(s, 0.2, 1.35));
  for (let k = 0; k < 5; k++) sled.push(new THREE.BoxGeometry(1.3, 0.06, 0.32).translate(0, 0.3, -1 + k * 0.5));
  for (let k = 0; k < 3; k++) sledFloats.push(new THREE.IcosahedronGeometry(0.34, 1).translate(-0.3 + (k % 2) * 0.6, 0.65, -0.7 + k * 0.6));
  // the shade: four poles, a cloth over them, a water jar under it
  const D = W.shade, dy = H(D[0], D[1]), dm = new THREE.Matrix4().compose(V(D[0], dy, D[1]), new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), D[2]), V(1, 1, 1));
  const shade = [], jar = [];
  for (const [px, pz, ph] of [[-1.4, -1.1, 2.4], [1.4, -1.1, 2.4], [-1.4, 1.1, 2.0], [1.4, 1.1, 2.0]]) shade.push(new THREE.CylinderGeometry(0.05, 0.06, ph, 4).translate(px, ph / 2, pz));
  const awning = new THREE.PlaneGeometry(3.2, 2.6).rotateX(-Math.PI / 2 + 0.16).translate(0, 2.25, 0);
  jar.push(new THREE.CylinderGeometry(0.28, 0.22, 0.6, 8).translate(0.4, 0.3, 0.2), new THREE.CylinderGeometry(0.12, 0.16, 0.16, 8).translate(0.4, 0.68, 0.2));
  // (issue #561) the carriers' oil jars by the fork: three clay jars roped round a short post, two floats on it
  const J = W.jars, jy = H(J[0], J[1]), jm = new THREE.Matrix4().compose(V(J[0], jy, J[1]), new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), J[2]), V(1, 1, 1));
  const oil = [], oilPost = [new THREE.CylinderGeometry(0.06, 0.08, 1.9, 5).translate(0, 0.95, 0)], oilFloats = [];
  for (const [ox, oz, r, hh] of [[0.55, 0.1, 0.34, 0.9], [-0.35, 0.45, 0.3, 0.8], [-0.2, -0.5, 0.28, 0.7]]) oil.push(new THREE.CylinderGeometry(r * 0.7, r * 0.55, hh, 8).translate(ox, hh / 2, oz), new THREE.SphereGeometry(r, 8, 6).scale(1, 0.7, 1).translate(ox, hh * 0.62, oz), new THREE.CylinderGeometry(0.1, 0.13, 0.18, 6).translate(ox, hh + 0.12, oz));
  oilPost.push(new THREE.TorusGeometry(0.62, 0.025, 3, 16).rotateX(Math.PI / 2).translate(0, 0.45, 0));
  for (const fy of [1.95, 1.62]) oilFloats.push(new THREE.IcosahedronGeometry(fy > 1.9 ? 0.34 : 0.26, 1).translate(fy > 1.9 ? 0 : 0.22, fy + 0.2, 0));
  // the wind-glass: a gallows frame, a row of floats on strings under its bar, knocking together
  const G = W.windGlass, gy = H(G[0], G[1]), gm = new THREE.Matrix4().compose(V(G[0], gy, G[1]), new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), G[2]), V(1, 1, 1));
  const frame = [new THREE.CylinderGeometry(0.06, 0.08, 3, 5).translate(-1.4, 1.5, 0), new THREE.CylinderGeometry(0.06, 0.08, 3, 5).translate(1.4, 1.5, 0), new THREE.CylinderGeometry(0.04, 0.04, 3.1, 4).rotateZ(Math.PI / 2).translate(0, 2.95, 0)];
  const chimes = new THREE.Group();
  chimes.position.set(0, 2.95, 0);
  for (let k = 0; k < 6; k++) {
    const len = 0.7 + (k % 3) * 0.3, f = new THREE.Group();
    f.position.x = -1.1 + k * 0.44;
    f.add(new THREE.Mesh(nonIdx(new THREE.CylinderGeometry(0.01, 0.01, len, 3).translate(0, -len / 2, 0)), M.pole), new THREE.Mesh(nonIdx(new THREE.IcosahedronGeometry(0.17 + (k % 2) * 0.05, 1).translate(0, -len - 0.12, 0)), M.float));
    chimes.add(f);
  }
  const gGroup = new THREE.Group();
  gGroup.applyMatrix4(gm);
  gGroup.add(new THREE.Mesh(mergeGeometries(frame.map(nonIdx)), M.pole), chimes);
  // the kiln by the cairn: a squat dome of fired sand with a glowing mouth, its smoke the column over the basin
  const kx = BREAKER_CAIRN.x + 4, kz = BREAKER_CAIRN.z + 3.5, ky = up(kx, kz);
  const kiln = [new THREE.SphereGeometry(1.3, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.9, 1).translate(kx, ky - 0.1, kz), new THREE.CylinderGeometry(0.35, 0.45, 1.1, 8).translate(kx, ky + 1.5, kz)];
  const mouth = new THREE.CircleGeometry(0.42, 10, 0, Math.PI).translate(0, 0.02, 0).rotateY(-0.6).translate(kx + Math.sin(-0.6) * 1.22, ky, kz + Math.cos(-0.6) * 1.22);
  const g = new THREE.Group();
  g.name = 'The way up to the breaker’s cairn';
  const meshes = [
    new THREE.Mesh(mergeGeometries([...poles, ...[...sled, ...shade].map((q, k) => nonIdx(q).applyMatrix4(k < sled.length ? sm : dm)), ...oilPost.map((q) => nonIdx(q).applyMatrix4(jm))]), M.pole),
    new THREE.Mesh(mergeGeometries([...floats, ...sledFloats.map((q) => nonIdx(q).applyMatrix4(sm)), ...oilFloats.map((q) => nonIdx(q).applyMatrix4(jm))]), amber),
    new THREE.Mesh(mergeGeometries(oil.map((q) => nonIdx(q).applyMatrix4(jm))), M.kiln),
    new THREE.Mesh(mergeGeometries(rags), M.cloth[3]),
    new THREE.Mesh(nonIdx(awning).applyMatrix4(dm), M.cloth[1]),
    new THREE.Mesh(mergeGeometries(jar.map((q) => nonIdx(q).applyMatrix4(dm))), M.kiln),
    new THREE.Mesh(mergeGeometries(kiln.map(nonIdx)), M.kiln),
    new THREE.Mesh(nonIdx(mouth), makeMaterial({ color: '#ffb46a', glow: 1, flat: true })),
  ];
  // (drawn only, all of it: thin things you walk round, as the float-posts' floats; they keep the contact audit's samples)
  for (const m of [...meshes, ...gGroup.children, ...chimes.children.flatMap((c) => c.children)]) m.userData.noCollide = true;
  g.add(...meshes, gGroup);
  scene.add(g);
  // the smoke: pale, a little warm from the kiln, leaning off north-east on the wind over the far cliffs
  const smoke = new SmokeColumn(scene, V(kx, ky + 2.1, kz), { count: 110, height: 120, drift: 130, base: 1.6, top: 9, period: 80, palette: ['#f4efe2', '#ebe6d6', '#e3e9dc', '#f1e6d2'], tint: '#ffd9a8', glow: 0.92 });
  smoke.mesh.name = 'The breaker’s smoke';
  let acc = 0, frame_ = 0;
  return {
    points: posts.map((p) => [p.x + 1.2, p.y - 3, p.z]), posts, kiln: V(kx, ky, kz), smoke,
    sights: [
      { name: 'the carriers’ float-sledge', at: V(S[0], sy + 0.5, S[1]) },
      { name: 'the carriers’ shade', at: V(D[0], dy + 0.5, D[1]) },
      { name: 'the wind-glass', at: V(G[0], gy + 0.5, G[1]) },
    ],
    // (issue #561) the court's row off the way: its posts' floats, the line from the oil jars to the court's sand (a line of
    // its own for the level design audit), and the jars, a place to stop at
    court: { posts: spur, points: [[J[0], jy + 0.5, J[1]], ...spur.map((p) => [p.x + 1.2, p.y - 3, p.z])], jars: { name: 'the carriers’ oil jars', at: V(J[0], jy + 0.5, J[1]) } },
    update(dt, t, ctx) {
      // (the chimes swing and knock; the smoke moves every other frame, as the desert's camp smoke)
      chimes.children.forEach((f, k) => { f.rotation.z = Math.sin((t ?? 0) * 1.7 + k * 1.3) * 0.18; f.rotation.x = Math.sin((t ?? 0) * 1.1 + k) * 0.1; });
      acc += dt; if (frame_++ % 2) return; smoke.update(acc, t ?? 0, ctx?.player?.wind ?? null, ctx?.camera ?? null); acc = 0;
    },
  };
}

/** The way's floats: the kiln's amber, not the float-posts' green (the way home is green, the way up warm). */
function makeAmber() { return makeMaterial({ color: '#f2b36a', glow: 0.8 }); }
