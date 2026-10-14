// Z-fighting (scripts/zfight, .claude/skills/zfight-qc, docs/systems/rendering.md "Z-fighting"): two faces of different
// looks in one plane flicker as the camera moves. The finder on made-up faces, and every temple held to its count:
// the Rose House at none (the author's issue #75), the others at or under their baselines (ZFIGHT_BASELINE), so a
// new room can't bring the stripes back. Lower a baseline when a fix lands; never raise one without a reason.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { trianglesOf, coplanarOverlaps, visibleSites, overlapArea, clipPolygon } from '../scripts/zfight/lib.mjs';
import { rayOver, standing, zfightsOf, shipZfights } from '../scripts/zfight/audit.mjs';
import { nameParts, partOf, describe } from '../scripts/zfight/names.mjs';
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
  // (v1.66, the zfight audit: the counts the temples had come down to, held there; were incal 47, arzach2 11, perdide2 9,
  // perdide 10, arzach 8, spacecity 5)
  desert: 0, incal: 39, arzach2: 10, spheres: 2, buried: 0, perdide2: 3, perdide: 9, arzach: 3,
  garage: 1, edena: 2, bazaar: 8,   // (v1.48: the Clock-House, the Greenhouse and the Undertower round their hubs, a rotunda's raised gap with a sill)
  spacecity: 3, moonfoundry: 20, underwater: 19,
};
/**
 * A world's own count, outside its temples, where a fix has brought it down (v1.68, issue #286; audit.mjs counts the
 * rest, docs/systems/rendering.md "Z-fighting"): the City Floating in Space 460 -> 22, its houses' windows over one
 * another, the storeys on the roofs' lips, the machinery's tops in the slabs' undersides, the pads and bridges on the decks.
 */
export const WORLD_ZFIGHT_BASELINE = { spacecity: 22 };

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
  // a shell and its inside on one geometry, front side and back side (Viridel's split meteor, zfight v1.66): never on
  // one pixel; double-sided, the inside would fight the shell
  const shell = new THREE.Mesh(new THREE.SphereGeometry(2, 12, 8, 0, Math.PI), mat('#b8a'));
  const inside = new THREE.Mesh(shell.geometry.clone(), mat('#87c', { side: THREE.BackSide }));
  const two = new THREE.Scene(); two.add(shell, inside); two.updateMatrixWorld(true);
  assert.equal(coplanarOverlaps(trianglesOf(two, { THREE })).length, 0, 'front and back of one surface: no fight');
  inside.material = mat('#87c', { side: THREE.DoubleSide });
  assert.ok(coplanarOverlaps(trianglesOf(two, { THREE })).length > 0, 'double-sided, the inside fights the shell');
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

test('every temple’s visible z-fights at or under its baseline; the Rose House has none', () => {
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
  assert.equal(report.desert, 0, 'the Rose House: none');
});

test('a merged mesh says what its pieces are: the lines that made them and their comments (scripts/zfight/names.mjs)', async () => {
  await nameParts();
  // (this process loaded three's merge already: a fresh copy of it, as the audit's world modules get)
  const { mergeGeometries } = await import(import.meta.resolve('three/addons/utils/BufferGeometryUtils.js') + '?names');
  const wall = new THREE.BoxGeometry(4, 4, 1).toNonIndexed();   // the wall
  const trim = new THREE.BoxGeometry(1, 4, 1.4).translate(1.5, 0, 0).toNonIndexed();   // the trim on it
  const g = mergeGeometries([wall, mergeGeometries([trim.clone()])]);
  const a = describe(partOf(g, 0)), b = describe(partOf(g, 12));
  assert.match(a, /zfight\.test\.js:\d+ — the wall$/, a);
  assert.match(b, /zfight\.test\.js:\d+ — the trim on it$/, b);
  // and the finder carries them to its sites
  const scene = new THREE.Scene();
  scene.add(new THREE.Mesh(mergeGeometries([wall]), mat('#c88')), new THREE.Mesh(mergeGeometries([trim]), mat('#844')));
  const f = coplanarOverlaps(trianglesOf(scene, { THREE, partOf }));
  assert.ok(f.length && f[0].parts.map(describe).some((p) => p.endsWith('the trim on it')), 'a site names its pieces');
});

test('the City Floating in Space at or under its count; the market in the air, the canyon street and the furrows none of their own (issue #286)', async () => {
  for (const [id, n] of Object.entries(WORLD_ZFIGHT_BASELINE)) {
    const r = await zfightsOf(id, { temples: false });
    assert.ok(r.total.count <= n, `${id}: ${r.total.count} z-fight sites (baseline ${n}): ${r.all.slice(0, 4).map((s) => `${s.matA} × ${s.matB} at ${s.seen.at.join(', ')}`).join('; ')} (node scripts/zfight/audit.mjs --worlds ${id} --worst 20)`);
  }
  for (const [id, name] of [['bazaar', 'The market in the air'], ['underwater', 'The canyon street'], ['spheres', 'The furrows’']]) {
    const r = await zfightsOf(id, { temples: false });
    const own = r.all.filter((s) => s.meshA.includes(name) && s.meshB.includes(name));
    assert.equal(own.length, 0, `${name}: ${own.slice(0, 4).map((s) => `${s.matA} × ${s.matB} at ${s.seen.at.join(', ')}`).join('; ')} (node scripts/zfight/audit.mjs --worlds ${id} --worst 20)`);
  }
});

// Issue #325, the author: "I see a lot of textures shimmering in my ship". The ship (every world's, built by main.js, not
// the level: node scripts/zfight/audit.mjs --ship) had 12 sites, 7 m² (the alcove's hood in the arched front and between
// its cheeks, the doorways' trims in their jambs, the console's kick band, the sofa's cushions in its arms, the cockpit
// bulkhead's underside in the ceiling): none now. Its rooms keep their hatching in shade (issue #322's second look: the
// flat tone lost the shade the author found helpful), its strokes never closer than SHIP_ROOM_HATCH_PX, clear of the
// band where strokes alias and crawl (materials.js HATCH_AA: 4 to 2.2 px apart).
test('the ship has no z-fighting, and its rooms\' hatching is too coarse to crawl (issues #325, #322)', async () => {
  const r = await shipZfights();
  assert.equal(r.total.count, 0, r.total.worst.map((f) => `${f.area} m² ${f.meshA} × ${f.meshB} at ${f.at}`).join('; '));
  const { shipMaterials, SHIP_ROOM_HATCH_PX } = await import('../src/ship/model.js');
  const { HATCH_AA } = await import('../src/materials.js');
  const M = shipMaterials('zf-test');
  assert.ok(SHIP_ROOM_HATCH_PX >= 1 / HATCH_AA[0], `${SHIP_ROOM_HATCH_PX} px: clear of the aliasing band (${1 / HATCH_AA[0]} px)`);
  for (const k of ['wall', 'wallIn', 'ceiling', 'floor', 'locker', 'wood', 'cream']) {
    assert.ok(M[k].uniforms.uShade.value.z > 0, `${k}: hatched in shade`);
    assert.equal(M[k].uniforms.uHatchPx.value, SHIP_ROOM_HATCH_PX, `${k}: its strokes kept coarse`);
  }
  assert.ok(M.hull.uniforms.uShade.value.z > 0 && M.hull.uniforms.uHatchPx.value === 0, 'the hull outside keeps the world\'s strokes');
  assert.ok(M.wall.fragmentShader.includes('uHatchPx);'), 'the spacing floor reaches the shader');
});
