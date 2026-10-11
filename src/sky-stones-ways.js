import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeMaterial } from './materials.js';

// Vael II's ways home (level design audit, the fourth round: every walk back was the way out, and no leg of the
// main quest could see where it went). Both are flown on the bird, so they hang in the air. No rng: the world round
// them stays as it was.
//
//   the fallen-up tiles   the monastery's roof tiles that fell up with the clapper the night the cloud rose, still
//                         strung out in the air in drifting knots from the floating island's church back toward the
//                         bell tower, bowing south over the great table where Tiv balances his stones: the clapper's
//                         way home (the main quest's "ring" stage sends you along them).
//   the lantern stones    eight small floating stones, each with an old riders' lantern on a crook, from the rose
//                         cliff's north lip over the cloud past the Founders' Belfry to Sister Aube's hermitage by the
//                         landing: the monks lit them for riders coming home in the cloud. Dark for thirty years, they
//                         light again when the bell rings (lit(on)), and Calix sends you home along them.
//
//   buildFallenTiles(scene)   → { points, sight, update(t) }
//   buildLanternStones(scene) → { points, sight, lit(on), update(t) }

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const flat0 = (g) => { g = g.index ? g.toNonIndexed() : g; for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k); g.computeVertexNormals(); return g; };

/** The tiles' trail, [x, y, z]: from before the island church's porch, west and south over the great table, to the bell tower. */
export const TILE_TRAIL = [[222, 134, -498], [170, 124, -500], [115, 114, -490], [60, 105, -470], [10, 99, -455], [-30, 96, -447],
  [-75, 94, -410], [-125, 93, -355], [-170, 93, -300], [-205, 97, -262]];
/** The lantern stones, [x, y, z]: from the rose cliff's north lip, over the cloud past the Founders' Belfry, to Aube's hermitage. */
export const LANTERN_STONES = [[-210, 86, -182], [-186, 82, -136], [-166, 76, -100], [-148, 68, -66], [-122, 62, -40], [-95, 55, -22], [-68, 50, 4], [-48, 47, 30]];

const along = (pts, step) => {
  const curve = new THREE.CatmullRomCurve3(pts.map((p) => V(...p)), false, 'centripetal');
  const n = Math.max(2, Math.round(curve.getLength() / step));
  return curve.getSpacedPoints(n);
};

export function buildFallenTiles(scene) {
  // one curved roof tile (a half pipe, tapering), instanced in knots of nine every 22 m along the trail
  const tile = flat0(new THREE.CylinderGeometry(0.2, 0.24, 0.62, 6, 1, true, 0, Math.PI).rotateX(Math.PI / 2));
  const knots = along(TILE_TRAIL, 22);
  const per = 9, n = knots.length * per;
  const im = new THREE.InstancedMesh(tile, makeMaterial({ color: '#c9765c', flat: true, side: THREE.DoubleSide }), n);
  im.name = 'The fallen-up tiles';
  im.userData.noCollide = true; im.userData.floats = true;   // (the clipping audit: they hang in the air on purpose)
  im.frustumCulled = false;
  const base = [];
  knots.forEach((c, k) => {
    for (let i = 0; i < per; i++) {
      const a = (i / per) * Math.PI * 2 + k * 1.7, r = 1.1 + ((i * 7 + k) % 5) * 0.35;
      base.push({ at: V(c.x + Math.cos(a) * r, c.y + (((i * 3 + k) % 7) - 3) * 0.32, c.z + Math.sin(a) * r), spin: V(a, a * 1.3 + k, a * 0.7), ph: k * 0.9 + i * 0.4 });
    }
  });
  const dummy = new THREE.Object3D();
  const update = (t) => {
    base.forEach((b, i) => {
      dummy.position.set(b.at.x, b.at.y + Math.sin(t * 0.4 + b.ph) * 0.5, b.at.z);
      dummy.rotation.set(b.spin.x + t * 0.11, b.spin.y + t * 0.07, b.spin.z);
      dummy.scale.setScalar(1.6);
      dummy.updateMatrix();
      im.setMatrixAt(i, dummy.matrix);
    });
    im.instanceMatrix.needsUpdate = true;
  };
  update(0);
  scene.add(im);
  const mid = knots[Math.floor(knots.length * 0.3)];
  return { points: TILE_TRAIL.map((p) => p.slice()), sight: mid.clone(), mesh: im, update };
}

export function buildLanternStones(scene, { stones = LANTERN_STONES, name = 'The lantern stones', wide = {} } = {}) {
  const stone = makeMaterial({ color: '#f3ead8', color2: '#f0e4cf', color3: '#f5ede0', flat: true });
  const iron = makeMaterial({ color: '#3c4660', flat: true });
  const dark = makeMaterial({ color: '#8a7a62', flat: true });
  const lamp = makeMaterial({ color: '#ffd9a0', glow: 1 });
  const rock = [], crook = [], glass = [];
  const tops = [];
  stones.forEach(([x, y, z], i) => {
    const r = wide[i] ?? 2.6 + (i % 3) * 0.5;   // (a wide one: a stone to stop on, src/vael-crossing.js)
    // a flat-topped stone with a point of rock under it, a crook of iron on its top, and a lantern hung from the crook
    rock.push(flat0(new THREE.CylinderGeometry(r, r * 0.86, 1.2, 9).translate(x, y - 0.6, z)), flat0(new THREE.ConeGeometry(r * 0.86, r * 2.2, 8).rotateX(Math.PI).translate(x, y - 1.2 - r * 1.1, z)));
    const yaw = i * 0.9;
    const c = Math.cos(yaw), s = Math.sin(yaw);
    crook.push(flat0(new THREE.CylinderGeometry(0.07, 0.09, 4.2, 5).translate(x, y + 2.1, z)), flat0(new THREE.CylinderGeometry(0.06, 0.06, 1.3, 5).rotateZ(Math.PI / 2).rotateY(yaw).translate(x + c * 0.6, y + 4.1, z - s * 0.6)));
    const lx = x + c * 1.2, lz = z - s * 1.2;
    crook.push(flat0(new THREE.ConeGeometry(0.42, 0.4, 6).translate(lx, y + 3.55, lz)), flat0(new THREE.BoxGeometry(0.62, 0.08, 0.62).translate(lx, y + 2.75, lz)));
    glass.push(flat0(new THREE.CylinderGeometry(0.3, 0.3, 0.7, 6).translate(lx, y + 3.1, lz)));
    tops.push(V(x, y, z));
  });
  const rocks = new THREE.Mesh(mergeGeometries(rock), stone);
  rocks.name = name;
  const crooks = new THREE.Mesh(mergeGeometries(crook), iron);
  const glassGeo = mergeGeometries(glass);
  const unlit = new THREE.Mesh(glassGeo, dark), litGlass = new THREE.Mesh(glassGeo, lamp);
  litGlass.visible = false;
  const g = new THREE.Group();
  g.add(rocks, crooks, unlit, litGlass);
  // (the clipping and contact audits: meant to hang in the air, and flown past, not stood on)
  g.userData.noCollide = true;
  for (const m of g.children) m.userData.floats = true;
  scene.add(g);
  const lit = (on) => { litGlass.visible = !!on; unlit.visible = !on; };
  // they bob, a little out of step with the floating stones
  const update = (t) => { g.position.y = Math.sin(t * 0.3 + 1.1) * 0.9; };
  return { points: stones.map((p) => [p[0], p[1] + 2, p[2]]), sight: tops[Math.min(3, tops.length - 1)].clone(), stones: tops, group: g, lit, isLit: () => litGlass.visible, update };
}

/**
 * The clapper's lantern (level design audit, fifth round: a lit marker at the clapper, seen from the bell at bird height).
 * One of the riders' lantern stones fell up with the clapper and hangs over the island church's porch, its lantern lit
 * by the clapper's own warmth: the one light in the sky the whole time the bell is silent. It goes dark when the clapper
 * is lifted (lit(false)). Drawn three times a lantern stone's size, so the flame shows across the cloud from the cliff.
 *
 *   buildClapperLantern(scene, at) → { at, lit(on), update(t) }
 */
export function buildClapperLantern(scene, at) {
  const S = 2.4;   // (the lantern's own scale: a point of light at 550 m)
  const x = at.x - 3, y = at.y + 11, z = at.z + 2;
  const stone = makeMaterial({ color: '#f3ead8', color2: '#f0e4cf', color3: '#f5ede0', flat: true });
  const iron = makeMaterial({ color: '#3c4660', flat: true });
  const dark = makeMaterial({ color: '#8a7a62', flat: true });
  const lamp = makeMaterial({ color: '#ffd9a0', glow: 1 });
  const r = 2.2;
  const rock = mergeGeometries([flat0(new THREE.CylinderGeometry(r, r * 0.86, 1.1, 9).translate(0, -0.55, 0)), flat0(new THREE.ConeGeometry(r * 0.86, r * 2, 8).rotateX(Math.PI).translate(0, -1.1 - r, 0))]);
  const crook = mergeGeometries([flat0(new THREE.CylinderGeometry(0.08, 0.1, 3.6, 5).translate(0, 1.8, 0)), flat0(new THREE.CylinderGeometry(0.06, 0.06, 1.3, 5).rotateZ(Math.PI / 2).translate(0.6, 3.5, 0)),
    flat0(new THREE.ConeGeometry(0.42 * S, 0.4 * S, 6).translate(1.2, 3.45 - 0.2 * S, 0)), flat0(new THREE.BoxGeometry(0.62 * S, 0.08, 0.62 * S).translate(1.2, 3.45 - 1.1 * S, 0))]);
  const glassGeo = flat0(new THREE.CylinderGeometry(0.3 * S, 0.3 * S, 0.7 * S, 6).translate(1.2, 3.45 - 0.75 * S, 0));   // (hung under the crook's arm, its cap just below it)
  const g = new THREE.Group();
  g.name = 'The clapper’s lantern';
  const unlit = new THREE.Mesh(glassGeo, dark), litGlass = new THREE.Mesh(glassGeo, lamp);
  unlit.visible = false;
  g.add(new THREE.Mesh(rock, stone), new THREE.Mesh(crook, iron), unlit, litGlass);
  g.position.set(x, y, z);
  g.rotation.y = -0.7;
  // (the clipping and contact audits: it hangs in the air on purpose, out of reach)
  g.userData.noCollide = true;
  for (const m of g.children) m.userData.floats = true;
  scene.add(g);
  const lit = (on) => { litGlass.visible = !!on; unlit.visible = !on; };
  const update = (t) => { g.position.y = y + Math.sin(t * 0.35 + 0.4) * 0.6; g.rotation.y = -0.7 + Math.sin(t * 0.12) * 0.15; };
  return { at: V(x, y, z), lit, update };
}

/**
 * Where Ondine turns back (fifth round): a block set on the long aqueduct's east edge just south of the floating island,
 * its inner face scratched with tally marks in fives, row under row, one for every day she has walked out this far
 * from the plain. Collides as drawn (a parapet stone); the marks are drawn only, a finger's depth proud of its face.
 *
 *   buildOndineTally(scene, topAt) → { at }
 */
export const TALLY = { x: 218.6, z: -569 };
export function buildOndineTally(scene, topAt) {
  const { x, z } = TALLY;
  const y = topAt(x, z, 46);
  const stone = makeMaterial({ color: '#efe4cf', color2: '#e8dcc4', color3: '#f3ead8', flat: true });
  const ink = makeMaterial({ color: '#7a5a48', flat: true });
  const block = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.05, 2.6).translate(x, y + 0.52, z), stone);
  const marks = [];
  // rows of four strokes and a fifth across them, on the face toward the deck (west, -x)
  for (let row = 0; row < 5; row++) for (let k = 0; k < 6; k++) {
    const cz = z - 1.05 + k * 0.38 + (row % 2) * 0.1, cy = y + 0.9 - row * 0.17;
    for (let i = 0; i < 4; i++) marks.push(flat0(new THREE.BoxGeometry(0.012, 0.12, 0.018).translate(x - 0.405, cy, cz + i * 0.05)));
    marks.push(flat0(new THREE.BoxGeometry(0.012, 0.018, 0.24).rotateX(0.5).translate(x - 0.405, cy, cz + 0.075)));
  }
  const tally = new THREE.Mesh(mergeGeometries(marks), ink);
  tally.userData.noCollide = true;
  const g = new THREE.Group();
  g.name = 'Ondine’s tally';
  g.add(block, tally);
  scene.add(g);
  return { at: V(x - 0.8, y + 0.6, z) };
}
