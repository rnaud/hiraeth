// Z-fighting (scripts/zfight, .claude/skills/zfight-qc, docs/systems/rendering.md "Z-fighting"): two faces of different
// looks in one plane flicker as the camera moves. The finder on made-up faces, and every temple held to its count:
// the Givers' House at none (the author's issue #75), the others at or under their baselines (ZFIGHT_BASELINE), so a
// new room can't bring the stripes back. Lower a baseline when a fix lands; never raise one without a reason.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { trianglesOf, coplanarOverlaps, visibleSites, overlapArea, clipPolygon } from '../scripts/zfight/lib.mjs';
import { rayOver, standing } from '../scripts/zfight/audit.mjs';
import { TEMPLES, TEMPLE_HOME, templeOf } from '../src/temples/index.js';
import { buildableById } from '../src/levels/buildable.js';
import { Z_GAP } from '../src/temples/kit.js';

const quiet = (fn) => { const w = console.warn; console.warn = () => {}; try { return fn(); } finally { console.warn = w; } };
const mat = (color, o = {}) => new THREE.MeshBasicMaterial({ color, ...o });

/**
 * Visible z-fight sites per temple, v1.44, after the kit's doorframes, sills, roofs and walls' ends were set apart
 * (before: desert 87, incal 83, arzach2 84, spheres 59, buried 72, perdide2 74, perdide 69, arzach 66, garage 59,
 * edena 43, bazaar 85, spacecity 73, moonfoundry 118, underwater 161: 1133 in all; after: 150). The Warden's Well's are
 * nearly all on its tower's foot and crown outside, in the shaft (node scripts/zfight/list-temple.mjs incal).
 */
export const ZFIGHT_BASELINE = {
  desert: 0, incal: 47, arzach2: 11, spheres: 2, buried: 0, perdide2: 9, perdide: 10, arzach: 8,
  garage: 3, edena: 4, bazaar: 12, spacecity: 5, moonfoundry: 20, underwater: 19,
};

test('the finder: two looks in one plane overlapping fight; set apart, behind, or one look, they don’t', () => {
  const scene = new THREE.Scene();
  const wall = new THREE.Mesh(new THREE.BoxGeometry(4, 4, 1), mat('#c88'));
  const trim = new THREE.Mesh(new THREE.BoxGeometry(1, 4, 1.4).translate(1.5, 0, 0), mat('#844'));   // (its side at x 2: the wall's end, coplanar)
  scene.add(wall, trim);
  let f = coplanarOverlaps(trianglesOf(scene, { THREE }));
  assert.ok(f.length >= 1 && f.some((x) => Math.abs(x.normal[0]) > 0.99), 'the trim’s side in the wall’s end');
  // set apart by the kit's gap: nothing
  trim.position.x = Z_GAP; scene.updateMatrixWorld(true);
  f = coplanarOverlaps(trianglesOf(scene, { THREE }));
  assert.ok(!f.some((x) => Math.abs(x.normal[0]) > 0.99), 'two centimetres apart, no fight');
  // one look: shades alike, nothing to see
  trim.position.x = 0; trim.material = wall.material; scene.updateMatrixWorld(true);
  assert.equal(coplanarOverlaps(trianglesOf(scene, { THREE })).length, 0, 'one material: no fight counted');
  // a polygonOffset face is drawn pulled toward the eye: it wins
  trim.material = mat('#844', { polygonOffset: true, polygonOffsetFactor: -1 });
  assert.equal(coplanarOverlaps(trianglesOf(scene, { THREE })).length, 0, 'a decal’s offset settles it');
  // the clip: two unit squares' triangles, half over each other
  assert.ok(Math.abs(clipPolygon([[0, 0], [1, 0], [1, 1], [0, 1]], [[0.5, 0], [1.5, 0], [1.5, 1], [0.5, 1]]).length - 4) < 1e-9);
  const t = (a, b, c) => ({ a, b, c });
  assert.ok(Math.abs(overlapArea(t([0, 0, 0], [2, 0, 0], [0, 2, 0]), t([0, 0, 0], [1, 0, 0], [0, 1, 0]), [0, 0, 1]) - 0.5) < 1e-6);
});

test('the finder counts only what someone could see: a fight inside a wall or under a floor is none', () => {
  const scene = new THREE.Scene();
  const floor = new THREE.Mesh(new THREE.BoxGeometry(40, 1, 40).translate(0, -0.5, 0), mat('#dca'));
  // two slabs of different stone with a shared top, side by side, and one buried 3 m under the floor
  const a = new THREE.Mesh(new THREE.BoxGeometry(4, 1, 4).translate(0, 0, 0), mat('#a55'));
  const b = new THREE.Mesh(new THREE.BoxGeometry(2, 1, 2).translate(1, 0, 0), mat('#5a5'));
  const c = new THREE.Mesh(new THREE.BoxGeometry(4, 1, 4).translate(10, -3, 0), mat('#a55'));
  const d = new THREE.Mesh(new THREE.BoxGeometry(2, 1, 2).translate(11, -3, 0), mat('#5a5'));
  scene.add(floor, a, b, c, d);
  const tris = trianglesOf(scene, { THREE });
  const all = coplanarOverlaps(tris), seen = visibleSites(all, rayOver(tris));
  assert.ok(all.some((x) => x.samples.some((s) => s.p[1] < -2)), 'the buried pair overlaps');
  assert.ok(seen.length >= 1 && seen.every((x) => x.seen.at[1] > -1), 'only the pair in the open is seen');
});

test('every temple’s visible z-fights at or under its baseline; the Givers’ House has none', () => {
  const report = {};
  for (const id of Object.keys(TEMPLES)) {
    const scene = new THREE.Scene();
    const level = quiet(() => buildableById(TEMPLE_HOME[id] ?? id).create(scene));
    const rt = templeOf(level, id) ?? level.temple;
    const tris = trianglesOf(rt.root, { THREE });
    const ray = rayOver(tris);
    const sites = visibleSites(coplanarOverlaps(tris), ray, { stand: standing(level, ray) });
    report[id] = sites.length;
    level.dispose?.();
    assert.ok(sites.length <= (ZFIGHT_BASELINE[id] ?? 0), `${id}: ${sites.length} z-fight sites (baseline ${ZFIGHT_BASELINE[id]}): ${sites.slice(0, 4).map((s) => `${s.matA} × ${s.matB} at ${rt.kit.local(new THREE.Vector3(...s.seen.at)).toArray().map((v) => v.toFixed(1))}`).join('; ')} (node scripts/zfight/list-temple.mjs ${id})`);
  }
  assert.equal(report.desert, 0, 'the Givers’ House: none');
});
