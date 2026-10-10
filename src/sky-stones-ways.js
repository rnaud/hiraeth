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

export function buildLanternStones(scene) {
  const stone = makeMaterial({ color: '#f3ead8', color2: '#f0e4cf', color3: '#f5ede0', flat: true });
  const iron = makeMaterial({ color: '#3c4660', flat: true });
  const dark = makeMaterial({ color: '#8a7a62', flat: true });
  const lamp = makeMaterial({ color: '#ffd9a0', glow: 1 });
  const rock = [], crook = [], glass = [];
  const tops = [];
  LANTERN_STONES.forEach(([x, y, z], i) => {
    const r = 2.6 + (i % 3) * 0.5;
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
  rocks.name = 'The lantern stones';
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
  return { points: LANTERN_STONES.map((p) => [p[0], p[1] + 2, p[2]]), sight: tops[3].clone(), stones: tops, group: g, lit, update };
}
