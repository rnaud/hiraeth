import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createNoise2D, fbm, mulberry32, smoothstep } from '../noise.js';
import { makeMaterial, MODE_TERRAIN, MODE_STRATA, MODE_WATER } from '../materials.js';
import { Terrain, jitter, soften } from '../world.js';
import { buildRoom, portalPair } from '../interiors.js';
import { PEOPLE } from '../story/edena-data.js';
import { attachTemple } from '../temples/index.js';
import { stepped } from '../load-steps.js';
import { placeShop } from '../shop-world.js';
import { SHOPS } from '../shop.js';
import { buildRunnel, runnelDist } from '../viridel-ways.js';

// ---------------------------------------------------------------------------
// Viridel: a paradise planet with pale meadows,
// giant trees, pyramids and the clean white ruins of an android civilisation.
// Moebius at his cleanest: flat colours, thin lines, almost no hatching.
// Built for climbing: trees, pyramids and ruins can all be scaled.
// ---------------------------------------------------------------------------

const noise = createNoise2D(83);
const noiseB = createNoise2D(5);

function rolling(x, z) {
  let h = fbm(noise, x * 0.0016, z * 0.0016, 4) * 40;
  h += fbm(noiseB, x * 0.006, z * 0.006, 2) * 4;
  return h * THREE.MathUtils.lerp(0.3, 1, smoothstep(30, 200, Math.hypot(x, z)));
}
const POND_LEVEL = rolling(-120, -160);
function height(x, z) {
  let h = rolling(x, z);
  // a pond basin near the start, in a level stretch of meadow (so the water sits in a bowl, not on a slope)
  const pd = Math.hypot(x + 120, z + 160);
  h = THREE.MathUtils.lerp(h, POND_LEVEL, smoothstep(150, 100, pd));
  h -= smoothstep(90, 0, pd) * 10;
  const edge = Math.max(Math.abs(x), Math.abs(z));
  h += smoothstep(1300, 1950, edge) * (160 + fbm(noise, x * 0.004, z * 0.004, 3) * 120);
  return h;
}

// The level's people, story and relics (src/levels/content.js). The order of
// the people matters: errands deliver to the first and start from the fourth.
export const EDENA_CONTENT = {
  weather: ['rain'],
  // the story is a quest (src/story/edena-data.js): this page opens on the first
  // visit and closes when you have looked under the flowers and told Mira
  story: {
    title: 'THE GARDEN GROWS OVER',
    intro: 'An old ship lies beneath the flowers in the south meadow. The gardeners protect the wreck. Ask before exploring it.',
    outro: 'The wreck bears the same scar as your ship. Odile and Talo survived, then left in their saucer to follow the Singer toward the deep wood.',
    label: 'the fallen ship', goal: [40, 'ground', -210], radius: 28, manual: true,
  },
  relics: {
    spots: [[60, -80], [-200, 220], [180, 120], [-300, 50], [240, -300]],
    names: ['Canopy blossom', 'Pyramid capstone', 'Android sprocket', 'Glyph tablet', 'Ship rivet'],
  },
  npcs: [
    { at: [30, 30], ...PEOPLE.mira },
    { at: [-60, 60], ...PEOPLE.sol },
    { at: [150, 100], ...PEOPLE.oro, shy: true },
    { at: [-170, 190], ...PEOPLE.lio },
  ],
};

export const LEAVES = ['#7fcfa8', '#f2a7b5', '#9fd6c9', '#f6c7a0', '#b5a7e6'];
export const TRUNK = ['#c98a76', '#d9a5a0', '#b98aa8'];

// the tallest tree in the garden (Talo's lookout is on its crown) and the pond
export const TALL_TREE = { x: -118, z: 150, h: 92 };
export const POND = { x: -120, z: -160, r: 95 };
// Esk's tea terraces on the white builders' steps, down the slope into the dry hollow south-east of
// the landing, and the builders' cistern on the rise above them (src/story/terraces.js builds them:
// the quest that fails). x0..x1 downhill to uphill (four steps of `step` m), z0..z1 across; the
// lane is the middle the flood takes; the hollow is where it ends up.
export const TERRACES = { x0: 214, x1: 262, z0: -122, z1: -78, steps: 4, lane: { z0: -108, z1: -92 },
  cistern: { x0: 268, x1: 277, z0: -114, z1: -86 }, hollow: { x: 186, z: -98, r: 30 } };
const inTerraces = (x, z, r = 0) => (x > TERRACES.x0 - 4 - r && x < TERRACES.cistern.x1 + 6 + r && z > TERRACES.z0 - 8 - r && z < TERRACES.z1 + 8 + r)
  || Math.hypot(x - TERRACES.hollow.x, z - TERRACES.hollow.z) < TERRACES.hollow.r + r;   // (the dry hollow is bare: where the water ends up)

// ---------------------------------------------------------------------------
// The garden growing over Odile and Talo's ship: vines draped over the hull,
// leaves and flowers, and a thick veil of them over the scorch on the
// starboard flank. All in the ship group's own frame (hull axis = local x,
// radius 9). crashed.part(k) draws the veil aside (0 closed … 1 open).
const HULL_R = 9;
const SCAR = { x: -6, a: 0.96 };   // along the hull, and the angle round it from the top toward +z
// the hatch: along the hull (toward the nose, where the hull leans into the meadow and its flank
// stands nearly upright), its opening's half width and half height, and the sill above the grass
const HATCH = { x: 12, hw: 1.05, hh: 1.55, sill: 0.12 };
function overgrow(grp, crashed) {
  const rng = mulberry32(77);
  const R = (a, b) => a + rng() * (b - a);
  const at = (x, a, r = HULL_R) => new THREE.Vector3(x, r * Math.cos(a), r * Math.sin(a));
  const vine = makeMaterial({ color: '#4f8a5a', flat: true });
  const leafM = makeMaterial({ color: '#ffffff', flat: true });
  const leafGeo = new THREE.IcosahedronGeometry(0.5, 0).scale(1.1, 0.35, 0.7);
  const flowerGeo = mergeGeometries([new THREE.CylinderGeometry(0.42, 0.16, 0.14, 7).translate(0, 0.07, 0), new THREE.SphereGeometry(0.15, 6, 4).translate(0, 0.2, 0)].map((g) => g.toNonIndexed()));
  const tubes = [], leaves = [], flowers = [];
  // vines over the hull, avoiding the scar (the veil covers that)
  // (and the hatch: a vine stops short of its collar)
  const H = crashed.hatchSpot;
  const runs = [];
  for (let x = -25; x <= 25; x += R(5, 8)) {
    const nearScar = Math.abs(x - SCAR.x) < 4.5;
    const a0 = R(1.9, 2.2), a1 = -R(1.7, 2.2);
    let pts = [];
    for (let k = 0; k <= 16; k++) {
      const a = a0 + (a1 - a0) * (k / 16), vx = x + Math.sin(k * 0.9 + x) * 0.8;
      if (nearScar && a > SCAR.a - 0.6 && a < SCAR.a + 0.7) continue;
      if (H && Math.abs(vx - H.x) < H.hw + 0.9 && a > H.aTop - 0.12) { if (pts.length) runs.push(pts); pts = []; continue; }
      pts.push(at(vx, a, HULL_R + 0.12));
    }
    runs.push(pts);
  }
  // an arch of flowers over the hatch (Vey: "the hatch is on this flank, under the arch of flowers")
  if (H) {
    const pts = [];
    for (let k = 0; k <= 12; k++) {
      const t = (k / 12) * Math.PI, u = -Math.cos(t) * (H.hw + 1.25), v = -H.hh - 0.3 + Math.sin(t) * (2 * H.hh + 1.4);
      pts.push(at(H.x + u, H.aMid - v / H.r, H.r + 0.3));
    }
    pts.arch = true;
    runs.push(pts);
  }
  for (const pts of runs) {
    if (pts.length < 4) continue;
    tubes.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.17, 5).toNonIndexed());
    for (let k = 0; k < pts.length - 1; k++) {
      const p = pts[k].clone().lerp(pts[k + 1], 0.5), n = p.clone().setX(0).normalize();
      for (let j = 0; j < 2; j++) leaves.push({ p: p.clone().addScaledVector(n, 0.25).add(new THREE.Vector3(R(-0.7, 0.7) * (pts.arch ? 0.3 : 1), 0, 0)), n, c: rng() < 0.5 ? '#7fcfa8' : '#5fa77a', s: R(0.8, 1.3), r: rng() * 6 });
      if (rng() < (pts.arch ? 0.85 : 0.3)) flowers.push({ p: p.clone().addScaledVector(n, 0.3), n, c: rng() < 0.6 ? '#f2a7b5' : '#f2c54b', s: R(0.8, 1.2) });
    }
  }
  const orient = (o, it) => { o.position.copy(it.p); o.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), it.n); o.rotateY(it.r ?? 0); o.scale.setScalar(it.s); o.updateMatrix(); };
  const inst = (geo, mat, list) => {
    const m = new THREE.InstancedMesh(geo, mat, list.length), d = new THREE.Object3D(), c = new THREE.Color();
    list.forEach((it, i) => { orient(d, it); m.setMatrixAt(i, d.matrix); m.setColorAt(i, c.set(it.c)); });
    m.userData.noCollide = true;
    grp.add(m);
    return m;
  };
  const vines = new THREE.Mesh(mergeGeometries(tubes), vine);
  vines.userData.noCollide = true;
  grp.add(vines);
  inst(leafGeo, leafM, leaves);
  inst(flowerGeo, leafM, flowers);

  // the scorch: a halo, soot, three dots over an arch (the glyph), soot streaks running down, as on the traveller's own hull
  const uv = (u, v, lift) => { const a = SCAR.a - v / HULL_R; return at(SCAR.x + u, a, HULL_R + lift); };
  const onHull = (shape, lift, seg = 12) => {
    const g = new THREE.ShapeGeometry(shape, seg), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const q = uv(p.getX(i), p.getY(i), lift); p.setXYZ(i, q.x, q.y, q.z); }
    g.computeVertexNormals();
    return g;
  };
  const blob = (rx, ry, n, wob, seed) => { const s = new THREE.Shape(); for (let i = 0; i <= n; i++) { const a = (i / n) * Math.PI * 2, k = 1 + wob * Math.sin(a * 3 + seed) * Math.cos(a * 2 - seed); const x = Math.cos(a) * rx * k, y = Math.sin(a) * ry * k; i ? s.lineTo(x, y) : s.moveTo(x, y); } return s; };
  const disc = (x, y, r) => { const s = new THREE.Shape(); s.absarc(x, y, r, 0, Math.PI * 2, false); return s; };
  const arc = (cx, cy, r, w, a0, a1) => { const s = new THREE.Shape(); s.absarc(cx, cy, r + w / 2, a0, a1, false); s.absarc(cx, cy, r - w / 2, a1, a0, true); return s; };
  const streak = (u, len, w) => { const s = new THREE.Shape(); s.moveTo(u - w, -0.8); s.lineTo(u + w, -0.8); s.lineTo(u + w * 0.4, -0.8 - len); s.lineTo(u - w * 0.4, -0.8 - len); return s; };
  const scar = new THREE.Group();
  scar.add(new THREE.Mesh(onHull(blob(3.6, 2.7, 28, 0.3, 2.1), 0.05), makeMaterial({ color: '#9a7458', flat: true })));
  scar.add(new THREE.Mesh(mergeGeometries([onHull(blob(2.7, 2.0, 24, 0.26, 4.7), 0.08), ...[[-2.4, 2.2, 0.16], [2.2, 1.6, 0.13], [-0.5, 1.5, 0.11]].map(([u, l, w]) => onHull(streak(u, l, w), 0.09, 1))]), makeMaterial({ color: '#54433b', flat: true })));
  scar.add(new THREE.Mesh(mergeGeometries([...[[-1.2, 1.3], [0, 1.65], [1.2, 1.3]].map(([u, v]) => onHull(disc(u, v, 0.38), 0.11)), onHull(arc(0, -1.1, 1.8, 0.45, Math.PI * 0.17, Math.PI * 0.83), 0.11, 20)]), makeMaterial({ color: '#2b211f', flat: true })));
  scar.traverse((o) => { o.userData.noCollide = true; });
  grp.add(scar);

  // the veil: a thick mat of leaves, a few flowers and three vines over the scorch
  const veilItems = [];
  for (let i = 0; i < 90; i++) {
    const u = R(-3.6, 3.6), v = R(-2.8, 2.8);
    if ((u / 3.8) ** 2 + (v / 3.0) ** 2 > 1) continue;
    veilItems.push({ u, v, lift: R(0.25, 0.6), s: R(0.9, 1.5), r: rng() * 6, c: rng() < 0.5 ? '#7fcfa8' : rng() < 0.5 ? '#5fa77a' : '#9fd6c9' });
  }
  const veilFlowers = Array.from({ length: 9 }, (_, i) => ({ u: R(-2.8, 2.8), v: R(-2, 2), lift: 0.7, s: R(0.9, 1.4), r: 0, c: i % 3 ? '#f2a7b5' : '#f2c54b' }));
  const vleaves = new THREE.InstancedMesh(leafGeo, leafM, veilItems.length), vflowers = new THREE.InstancedMesh(flowerGeo, leafM, veilFlowers.length);
  vleaves.instanceMatrix.setUsage(THREE.DynamicDrawUsage); vflowers.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  for (const m of [vleaves, vflowers]) { m.userData.noCollide = true; m.userData.dynamic = true; grp.add(m); }
  const veilVines = [-1.6, 0.2, 1.9].map((u0, i) => {
    const pts = []; for (let k = 0; k <= 8; k++) { const v = -3.2 + k * 0.8; pts.push(uv(u0 + Math.sin(k + i) * 0.5, v, 0.35)); }
    const m = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 16, 0.2, 5), vine);
    m.userData.noCollide = true; grp.add(m);
    return { m, u0 };
  });
  const d = new THREE.Object3D(), col = new THREE.Color(), hullAxis = new THREE.Vector3(1, 0, 0);
  const place = (mesh, list, k, bloom) => {
    list.forEach((it, i) => {
      // drawn aside: out from the centre along the hull and round it, shrinking at the edges
      const f = 1 + 1.7 * k, u = it.u * f + Math.sign(it.u || 1) * 1.2 * k, v = it.v * (1 + 0.9 * k);
      const p = uv(u, v, it.lift + 0.2 * k), n = p.clone().setX(0).normalize();
      d.position.copy(p); d.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), n); d.rotateY(it.r + k * 1.5);
      d.scale.setScalar(it.s * (bloom ? 0.55 + 0.9 * k : 1 - 0.55 * k * Math.min(1, Math.abs(u) / 4)));
      d.updateMatrix(); mesh.setMatrixAt(i, d.matrix); mesh.setColorAt(i, col.set(it.c));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  };
  crashed.part = (k) => {
    place(vleaves, veilItems, k, false);
    place(vflowers, veilFlowers, k, true);
    for (const { m, u0 } of veilVines) { m.position.copy(hullAxis).multiplyScalar(Math.sign(u0) * 3.4 * k * k); m.scale.setScalar(1 - 0.3 * k); }
  };
  crashed.part(0);
  grp.updateMatrixWorld(true);
  crashed.scar = grp.localToWorld(uv(0, 0, 0.3));
  crashed.scarNormal = uv(0, 0, 1).sub(uv(0, 0, 0)).transformDirection(grp.matrixWorld);
}

// The cabin hatch, built into the hull in the ship group's frame: a teal collar
// round a dark doorway, its door swung open beside it. It sits round the hull
// at the angle whose sill clears the grass, so it is always on the flank, never
// floating beside it. Returns the threshold on the ground and the heading out.
function hullHatch(grp, hull, terrain, crashed) {
  const { x: HX, hw, hh, sill } = HATCH;
  grp.updateMatrixWorld(true);
  // the hull's real surface radius here (the softened capsule is a little wider than HULL_R)
  const ray = new THREE.Raycaster(), o = new THREE.Vector3(), d = new THREE.Vector3();
  const radius = (a) => {
    o.set(HX, 20 * Math.cos(a), 20 * Math.sin(a)); d.set(0, -Math.cos(a), -Math.sin(a));
    ray.set(grp.localToWorld(o.clone()), d.transformDirection(grp.matrixWorld));
    const hit = ray.intersectObject(hull, false)[0];
    return hit ? 20 - hit.distance : HULL_R;
  };
  const surf = (a, r) => grp.localToWorld(new THREE.Vector3(HX, r * Math.cos(a), r * Math.sin(a)));
  // round from the top toward +z the flank sinks into the meadow: find where the sill clears it
  const r0 = radius(1.6);
  const above = (a) => { const p = surf(a, r0); return p.y - terrain.heightAt(p.x, p.z); };
  let lo = 0.9, hi = 2.6;
  for (let i = 0; i < 32; i++) { const m = (lo + hi) / 2; if (above(m) > sill) lo = m; else hi = m; }
  const aSill = lo - 0.35 / r0, aMid = aSill - hh / r0, r = radius(aMid);
  // the hatch's own frame: x along the hull, y round it toward the top, z out of the hull
  const h = new THREE.Group();
  h.position.set(HX, r * Math.cos(aMid), r * Math.sin(aMid));
  h.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(
    new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, Math.sin(aMid), -Math.cos(aMid)), new THREE.Vector3(0, Math.cos(aMid), Math.sin(aMid))));
  const rounded = (w, ht, rad) => {
    const s = new THREE.Shape();
    s.moveTo(-w + rad, -ht); s.lineTo(w - rad, -ht); s.quadraticCurveTo(w, -ht, w, -ht + rad);
    s.lineTo(w, ht - rad); s.quadraticCurveTo(w, ht, w - rad, ht); s.lineTo(-w + rad, ht);
    s.quadraticCurveTo(-w, ht, -w, ht - rad); s.lineTo(-w, -ht + rad); s.quadraticCurveTo(-w, -ht, -w + rad, -ht);
    return s;
  };
  // the collar stands 0.25 m proud of the hull and reaches well into it (the hull curves away above and below)
  const collar = rounded(hw + 0.32, hh + 0.32, 0.7);
  collar.holes.push(rounded(hw, hh, 0.5));
  h.add(new THREE.Mesh(new THREE.ExtrudeGeometry(collar, { depth: 0.75, bevelEnabled: false, curveSegments: 6 }).translate(0, 0, -0.5),
    makeMaterial({ color: '#62c3c9', flat: true })));
  // the dark of the cabin beyond (the portal takes you in; nothing to bump into)
  const dark = new THREE.Mesh(new THREE.ShapeGeometry(rounded(hw, hh, 0.5), 6).translate(0, 0, 0.04), makeMaterial({ color: '#2b211f' }));
  dark.userData.noCollide = true;
  h.add(dark);
  // the door, swung out on its hinge along the nose-side edge, a porthole in it
  const door = new THREE.Group();
  door.position.set(hw + 0.12, 0, 0.25);
  door.rotation.y = 1.75;
  door.add(new THREE.Mesh(new THREE.ExtrudeGeometry(rounded(hw - 0.04, hh - 0.04, 0.48), { depth: 0.16, bevelEnabled: false, curveSegments: 6 }).translate(-hw, 0, 0),
    makeMaterial({ color: '#e6875f', flat: true })));
  door.add(new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.08, 5, 14).translate(-hw, hh * 0.35, 0.17), makeMaterial({ color: '#62c3c9', flat: true })));
  door.add(new THREE.Mesh(new THREE.CircleGeometry(0.34, 14).translate(-hw, hh * 0.35, 0.165), makeMaterial({ color: '#9fd6c9', glow: 0.2 })));
  h.add(door);
  grp.add(h);
  grp.updateMatrixWorld(true);
  // the threshold: on the grass just outside the sill; the way out points away from the hull, level
  const n = new THREE.Vector3(0, Math.cos(aMid), Math.sin(aMid)).transformDirection(grp.matrixWorld);
  const heading = Math.atan2(n.x, n.z);
  const foot = h.localToWorld(new THREE.Vector3(0, -hh, 0.3));
  foot.addScaledVector(new THREE.Vector3(n.x, 0, n.z).normalize(), 0.35);
  foot.y = terrain.heightAt(foot.x, foot.z);
  crashed.hatchSpot = { x: HX, hw, hh, aMid, aTop: aMid - hh / r, r };
  return { at: foot, heading };
}

/** A giant umbrella tree: a pinched trunk, a few branches, one to three flat canopies. kit: { scene, terrain, rng, pick } (createEdena; the Lab's Viridel room) */
export function edenaTree({ scene, terrain, rng, pick }, x, z, s) {
  const base = terrain.baseAt(x, z, 6 * s);
  const h = (55 + rng() * 60) * s;
  const trunk = new THREE.CylinderGeometry(2.8 * s, 5.5 * s, h, 10, 10);
  trunk.translate(0, h / 2, 0);
  jitter(trunk, 0.1, 0.05, rng() * 50);
  soften(trunk, -0.12);   // pinched waist, flaring at root and crown
  const parts = [trunk.toNonIndexed()];
  // a couple of branches
  for (let b = 0; b < 3; b++) {
    const a = rng() * Math.PI * 2, y0 = h * (0.45 + rng() * 0.3), len = (12 + rng() * 14) * s;
    const p0 = new THREE.Vector3(0, y0, 0);
    const p1 = new THREE.Vector3(Math.cos(a) * len, y0 + len * 0.6, Math.sin(a) * len);
    parts.push(new THREE.TubeGeometry(new THREE.LineCurve3(p0, p1), 4, 1.3 * s, 6).toNonIndexed());
  }
  const trunkMesh = new THREE.Mesh(mergeGeometries(parts), makeMaterial({ color: pick(TRUNK), flat: true, detail: 'organic' }));
  trunkMesh.position.set(x, base - 1, z);
  scene.add(trunkMesh);
  const leaf = pick(LEAVES);
  const layers = 1 + Math.floor(rng() * 3);
  for (let l = 0; l < layers; l++) {
    const r = (18 + rng() * 16) * s * (1 - l * 0.25);
    const g = new THREE.CylinderGeometry(r, r * 0.92, 3.5 * s, 18);
    jitter(g, 0.08, 0.2, rng() * 30);
    const disc = new THREE.Mesh(g, makeMaterial({ color: leaf, color2: pick(LEAVES), flat: true }));
    disc.position.set(x + (rng() - 0.5) * 6, base + h * (0.82 + l * 0.12), z + (rng() - 0.5) * 6);
    scene.add(disc);
  }
}

/** A white step pyramid (same kit as edenaTree). */
export function edenaPyramid({ scene, terrain, rng }, x, z, size) {
  const steps = 6 + Math.floor(rng() * 5);
  const parts = [];
  const sh = size * 0.12;
  for (let i = 0; i < steps; i++) {
    const w = size * (1 - i / steps);
    parts.push(new THREE.BoxGeometry(w, sh, w).translate(0, sh * (i + 0.5), 0));
  }
  parts.push(new THREE.BoxGeometry(size * 0.12, sh * 1.6, size * 0.12).translate(0, sh * (steps + 0.8), 0));
  const m = new THREE.Mesh(mergeGeometries(parts), makeMaterial({ color: '#f3ead8', color2: '#f2c5b0', color3: '#e7d8b6', mode: MODE_STRATA, strataSize: sh, flat: true, grid: sh }));
  m.position.set(x, terrain.baseAt(x, z, size * 0.5) - 1, z);
  m.rotation.y = rng() * Math.PI;
  scene.add(m);
}

/** Android ruins: leaning white slabs and a fallen ring (same kit, and the ruins' two materials). */
export function edenaRuins({ scene, terrain, rng, ruinMat, accent, ruins = null }, cx, cz) {
  for (let i = 0; i < 8 + Math.floor(rng() * 8); i++) {
    const x = cx + (rng() - 0.5) * 120, z = cz + (rng() - 0.5) * 120;
    const h = 8 + rng() * rng() * 70, w = 4 + rng() * 12;
    const g = new THREE.BoxGeometry(w, h, 2 + rng() * 6);
    g.translate(0, h / 2, 0);
    const m = new THREE.Mesh(g, rng() < 0.85 ? ruinMat : accent);
    m.position.set(x, terrain.baseAt(x, z, w * 0.6) - 2, z);
    m.rotation.set((rng() - 0.5) * 0.15, rng() * Math.PI, (rng() - 0.5) * 0.15);
    scene.add(m);
    ruins?.push(m);   // (the Greenhouse's world change grows flowers on them: src/temples/edena.js)
  }
  // a fallen ring
  const ring = new THREE.Mesh(new THREE.TorusGeometry(14 + rng() * 10, 2, 8, 32), ruinMat);
  ring.position.set(cx, terrain.heightAt(cx, cz) + 4, cz);
  ring.rotation.set(Math.PI / 2 - 0.3, 0, rng() * 3);
  scene.add(ring);
}

// (built in steps, src/load-steps.js: the game's load gives the main thread back between them)
export function* buildEdena(scene) {
  const rng = mulberry32(1983);
  const pick = (a) => a[Math.floor(rng() * a.length)];
  const terrain = yield* Terrain.make({
    size: 4000, seg: 420, height,
    material: { color: '#b4d896', color2: '#c9e4a8', color3: '#e2d3a8', mode: MODE_TERRAIN, ticks: true },
  });
  scene.add(terrain.mesh);
  const movers = [];
  let shipRoom = null;
  const shipPortals = [];

  // ---------------------------------------------------------- pond
  yield;
  {
    const pond = new THREE.Mesh(new THREE.CircleGeometry(95, 48).rotateX(-Math.PI / 2),
      makeMaterial({ color: '#7fc4d0', color2: '#9ad3d9', mode: MODE_WATER }));
    pond.position.set(-120, terrain.heightAt(-120, -160) + 6, -160);
    pond.userData.noCollide = true;
    scene.add(pond);
  }

  // ---------------------------------------------------------- giant umbrella trees
  // The trunk pierces a stack of flat canopies; climb the trunk and you come
  // out standing on top of a canopy.
  yield;
  const kit = { scene, terrain, rng, pick };
  const tree = (x, z, s) => edenaTree(kit, x, z, s);
  tree(60, -80, 0.6);
  tree(-60, 70, 0.8);
  yield;
  for (let i = 0; i < 46; i++) {
    yield;
    const x = (rng() * 2 - 1) * 1300, z = (rng() * 2 - 1) * 1300;
    if (Math.hypot(x, z) < 60 || Math.hypot(x + 120, z + 160) < 110) continue;
    tree(x, z, 0.6 + rng() * 0.9);
  }

  // ---------------------------------------------------------- step pyramids
  yield;
  const pyramid = (x, z, size) => edenaPyramid(kit, x, z, size);
  pyramid(-200, 220, 90);
  yield;
  for (let i = 0; i < 8; i++) pyramid((rng() * 2 - 1) * 1200, (rng() * 2 - 1) * 1200, 50 + rng() * 90);

  // ---------------------------------------------------------- android ruins (clean white, gridded)
  yield;
  const ruinMat = makeMaterial({ color: '#f7f4ec', flat: true, grid: 3, glyphs: true });
  const accent = makeMaterial({ color: '#62c3c9', flat: true, grid: 3 });
  const ruinSlabs = [];
  const ruins = (cx, cz) => edenaRuins({ ...kit, ruinMat, accent, ruins: ruinSlabs }, cx, cz);
  ruins(180, 120);
  yield;
  for (let i = 0; i < 7; i++) ruins((rng() * 2 - 1) * 1200, (rng() * 2 - 1) * 1200);

  // ---------------------------------------------------------- hero: the crashed ship
  // Odile and Talo's retro spaceship, nose-down in the meadow where the story begins.
  // The garden has begun to grow over it (overgrow, below); under the flowers on
  // its starboard flank is the scorch of what struck it (src/story/edena.js).
  yield;
  const crashed = {};
  yield;
  {
    const grp = new THREE.Group();
    const hullMat = makeMaterial({ color: '#f3ead8', color2: '#e6875f', color3: '#f3ead8', mode: MODE_STRATA, strataSize: 3.5, grid: 3, metal: 'painted' });
    const hull = new THREE.Mesh(soften(new THREE.CapsuleGeometry(9, 54, 8, 20), 0.08), hullMat);
    hull.rotation.z = Math.PI / 2;
    grp.add(hull);
    const nose = new THREE.Mesh(new THREE.ConeGeometry(8.6, 22, 20).rotateZ(-Math.PI / 2), makeMaterial({ color: '#d9643a', flat: true, metal: 'painted' }));
    nose.position.x = 44;
    grp.add(nose);
    for (let k = 0; k < 3; k++) {
      const fin = new THREE.Mesh(new THREE.BoxGeometry(16, 1.2, 12).translate(0, 0, 9), makeMaterial({ color: '#62c3c9', flat: true, metal: 'painted' }));
      fin.position.x = -30;
      fin.rotation.x = (k / 3) * Math.PI * 2;
      grp.add(fin);
    }
    const dome = new THREE.Mesh(new THREE.SphereGeometry(5, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), makeMaterial({ color: '#9fd6c9', glow: 0.25 }));
    dome.position.set(18, 8.5, 0);
    grp.add(dome);
    const x = 40, z = -210;
    grp.position.set(x, terrain.baseAt(x, z, 30) + 4, z);
    grp.rotation.set(0.2, 0.9, -0.28);
    grp.updateMatrixWorld(true);
    // a hatch in the hull opens onto the cabin (on the starboard flank, where the hull meets the meadow)
    {
      const { at: hatch, heading } = hullHatch(grp, hull, terrain, crashed);
      const room = buildRoom(scene, {
        pos: new THREE.Vector3(0, 1500, 0), w: 6, d: 16, h: 3.2,
        wall: { color: '#f3ead8', color2: '#e6875f', grid: 0.6 }, floor: '#62c3c9', ceiling: '#e9e3d4',
        windows: [{ side: 'left', x: 4, y: 1.3, w: 1.1, h: 0.9 }, { side: 'left', x: 9, y: 1.3, w: 1.1, h: 0.9 }, { side: 'right', x: 7, y: 1.3, w: 1.1, h: 0.9 }, { side: 'back', x: 3, y: 1.1, w: 4, h: 1.2 }],
        furniture: [['seat', -1.2, -6.2, Math.PI, '#d9643a'], ['seat', 1.2, -6.2, Math.PI, '#d9643a'], ['panel', 0, -7.2, Math.PI, '#34405e'],
          ['bunk', -2.4, 1.5, 0, '#8a5a3c', '#f2a7b5'], ['bunk', 2.4, 1.5, 0, '#8a5a3c', '#9fd6c9'], ['table', 0, -2.5, 0, '#e9e3d4'], ['pot', 2.4, 5.5]],
        lamp: '#9fd6e8',
      });
      shipRoom = room;
      shipPortals.push(...portalPair({ at: hatch, heading, room }));
      crashed.hatch = hatch; crashed.hatchHeading = heading;
      crashed.room = room;
      crashed.panel = room.group.localToWorld(new THREE.Vector3(0, 0, -6.4));
    }
    scene.add(grp);
    crashed.group = grp;
    crashed.centre = grp.position.clone();
    overgrow(grp, crashed);
    // debris scattered behind it
    for (let i = 0; i < 18; i++) {
      const d = new THREE.Mesh(new THREE.BoxGeometry(1 + rng() * 4, 0.6 + rng() * 2, 1 + rng() * 3), makeMaterial({ color: pick(['#f3ead8', '#e6875f', '#62c3c9']), flat: true }));
      const dx = x - 30 - rng() * 60, dz = z + (rng() - 0.5) * 40;
      d.position.set(dx, terrain.heightAt(dx, dz) + 0.3, dz);
      d.rotation.set(rng() * 3, rng() * 3, rng() * 3);
      scene.add(d);
    }
  }

  // ---------------------------------------------------------- the meadow's flowers
  // grow in clumps now, species by species (src/flora.js, after the level is built). The old
  // scatter's random draws are still taken, so everything placed after it stays where it was.
  yield;
  for (let i = 0; i < 3500 * 7; i++) rng();

  // ---------------------------------------------------------- the android garden
  // Viridel's perfect geometry: great smooth spheres half-sunk in the meadow,
  // and little ornaments on white pedestals (spheres, cones, diamonds) in flat
  // pastel colours with no texture at all.
  yield;
  {
    const white = makeMaterial({ color: '#fbf8f0' });
    const ACC = ['#f2a7b5', '#62c3c9', '#f6c7a0', '#b5a7e6', '#f2c54b', '#7fcfa8'];
    const accent = ACC.map((c) => makeMaterial({ color: c }));
    for (let i = 0; i < 9; i++) {
      const a = rng() * Math.PI * 2, r = 160 + rng() * 700;
      const x = Math.cos(a) * r, z = Math.sin(a) * r, R = 9 + rng() * 16;
      const m = new THREE.Mesh(new THREE.SphereGeometry(R, 40, 24), rng() < 0.5 ? white : pick(accent));
      m.position.set(x, terrain.heightAt(x, z) + R * (0.15 + rng() * 0.5), z);
      scene.add(m);
    }
    const byMat = new Map();
    const add = (mat, g) => { if (!byMat.has(mat)) byMat.set(mat, []); byMat.get(mat).push(g.index ? g.toNonIndexed() : g); };
    for (let i = 0; i < 70; i++) {
      // in loose rows, like a garden laid out by machines
      const row = Math.floor(i / 10), k = i % 10;
      const ca = (row / 7) * Math.PI * 2 + 0.4, cr = 120 + row * 45;
      const x = Math.cos(ca) * cr + (k - 4.5) * 9 * Math.sin(ca), z = Math.sin(ca) * cr - (k - 4.5) * 9 * Math.cos(ca);
      const base = terrain.baseAt(x, z, 2), ph = 1.5 + rng() * 2.5;
      add(white, new THREE.CylinderGeometry(1.1, 1.4, ph, 16).translate(x, base + ph / 2, z));
      const mat = pick(accent), top = base + ph, kind = rng();
      if (kind < 0.45) add(mat, new THREE.SphereGeometry(1.4, 20, 12).translate(x, top + 1.4, z));
      else if (kind < 0.75) add(mat, new THREE.ConeGeometry(1.3, 3, 16).translate(x, top + 1.5, z));
      else add(mat, new THREE.OctahedronGeometry(1.6, 0).translate(x, top + 1.6, z));
    }
    for (const [mat, list] of byMat) scene.add(new THREE.Mesh(mergeGeometries(list), mat));
  }

  // ---------------------------------------------------------- the tallest tree, and Talo's lookout on its crown
  // Climb the trunk to the two canopies; the crown floats above the upper one on
  // thin branches: a fluid boost from the upper canopy's rim lands you on it.
  yield;
  const tall = {};
  yield;
  {
    const r2 = mulberry32(915);
    const { x, z, h } = TALL_TREE;
    const base = terrain.baseAt(x, z, 9);
    const trunkMat = makeMaterial({ color: '#c98a76', flat: true, detail: 'organic' });
    const top2 = 0.86 * h;   // the upper canopy
    const trunk = new THREE.CylinderGeometry(3.6, 7.5, top2 + 1, 12, 12).translate(0, (top2 + 1) / 2, 0);
    jitter(trunk, 0.08, 0.05, 31);
    soften(trunk, -0.1);
    const parts = [trunk.toNonIndexed()];
    for (let b = 0; b < 4; b++) {
      const a = b * 1.7 + 0.4, y0 = h * (0.4 + b * 0.1), len = 16 + r2() * 8;
      parts.push(new THREE.TubeGeometry(new THREE.LineCurve3(new THREE.Vector3(0, y0, 0), new THREE.Vector3(Math.cos(a) * len, y0 + len * 0.55, Math.sin(a) * len)), 4, 1.5, 6).toNonIndexed());
    }
    const tm = new THREE.Mesh(mergeGeometries(parts), trunkMat);
    tm.position.set(x, base - 1, z);
    scene.add(tm);
    // shelf fungus up the trunk: somewhere to stand and get your breath back on the long climb
    const shelfR = (y) => 7.5 - (3.9 * y) / (top2 + 1);
    const shelves = [[16, 2.3], [31, 3.1], [45, 2.0], [66, 2.6]].map(([y, a]) => {
      const r = shelfR(y) + 4.2;
      const g = new THREE.CylinderGeometry(r, r * 0.86, 0.9, 18, 1, false, a - 1.1, 2.2).translate(0, y, 0);
      return g.toNonIndexed();
    });
    const fungus = new THREE.Mesh(mergeGeometries(shelves), makeMaterial({ color: '#f6c7a0', color2: '#f2a7b5', flat: true }));
    fungus.position.set(x, base - 1, z);
    scene.add(fungus);
    tall.shelves = [[16, 2.3], [31, 3.1], [45, 2.0], [66, 2.6]].map(([y, a]) => { const r = shelfR(y) + 2.6; return new THREE.Vector3(x + Math.sin(a) * r, base - 1 + y + 0.45, z + Math.cos(a) * r); });
    const canopy = (r, y, c1, c2, ox = 0, oz = 0) => {
      const g = new THREE.CylinderGeometry(r, r * 0.92, 3.5, 22);
      jitter(g, 0.06, 0.2, r * 7);
      const m = new THREE.Mesh(g, makeMaterial({ color: c1, color2: c2, flat: true }));
      m.position.set(x + ox, base + y, z + oz);
      scene.add(m);
      return new THREE.Vector3(x + ox, base + y + 1.75, z + oz);
    };
    tall.c1 = canopy(31, 0.6 * h, '#7fcfa8', '#9fd6c9');
    tall.c2 = canopy(22, top2, '#f2a7b5', '#f6c7a0', 1.5, -1);
    // the crown: floating on thin branches, offset over the upper canopy's eastern half
    const cr = { ox: 7, oz: -3, y: top2 + 8.5 };
    tall.crown = canopy(10, cr.y, '#b5a7e6', '#f2a7b5', cr.ox, cr.oz);
    tall.crownR = 10;
    const twigs = [];
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2;
      twigs.push(new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(new THREE.Vector3(0, top2 + 1.5, 0), new THREE.Vector3(cr.ox * 0.5 + Math.cos(a) * 3, top2 + 7, cr.oz * 0.5 + Math.sin(a) * 3), new THREE.Vector3(cr.ox + Math.cos(a) * 6, cr.y - 1.2, cr.oz + Math.sin(a) * 6)), 8, 0.35, 5).toNonIndexed());
    }
    const tw = new THREE.Mesh(mergeGeometries(twigs), trunkMat);
    tw.position.set(x, base - 1, z);
    tw.userData.noCollide = true;
    scene.add(tw);
    // Talo's lookout: a bench, a post with the glyph carved in it, and a folded note
    const L = tall.crown;
    const wood = makeMaterial({ color: '#8a5a3c', flat: true });
    const bench = new THREE.Mesh(mergeGeometries([new THREE.BoxGeometry(2.4, 0.18, 0.7).translate(0, 0.5, 0), new THREE.BoxGeometry(0.18, 0.5, 0.6).translate(-1, 0.25, 0), new THREE.BoxGeometry(0.18, 0.5, 0.6).translate(1, 0.25, 0)].map((g) => g.toNonIndexed())), wood);
    bench.position.copy(L).add(new THREE.Vector3(-2, 0, 1.5)); bench.rotation.y = 0.6;
    scene.add(bench);
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.5, 2.4, 0.5).translate(0, 1.2, 0), wood);
    post.position.copy(L).add(new THREE.Vector3(1.5, 0, -1));
    scene.add(post);
    const mark = new THREE.Mesh(mergeGeometries([[-0.13, 2.14], [0, 2.21], [0.13, 2.14]].map(([u, v]) => new THREE.CylinderGeometry(0.045, 0.045, 0.05, 8).rotateX(Math.PI / 2).translate(u, v, 0.26).toNonIndexed())
      .concat([new THREE.TorusGeometry(0.17, 0.022, 3, 12, Math.PI * 0.7).rotateZ(Math.PI * 0.15).translate(0, 1.88, 0.26).toNonIndexed()])), makeMaterial({ color: '#2b211f', flat: true }));
    mark.position.copy(post.position);
    mark.userData.noCollide = true;
    scene.add(mark);
    const note = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.5, 0.04).translate(0, 1.35, 0.27), makeMaterial({ color: '#fbf8f0', flat: true }));
    note.position.copy(post.position); note.userData.noCollide = true;
    scene.add(note);
    tall.lookout = post.position.clone().add(new THREE.Vector3(0, 0, 1.2));
    tall.base = new THREE.Vector3(x, base, z);
  }
  const pondY = terrain.heightAt(POND.x, POND.z) + 6;

  // ---------------------------------------------------------- the furrow the ship ploughed, grown over greener than the meadow
  yield;
  {
    const from = new THREE.Vector3(crashed.centre.x - 34, 0, crashed.centre.z - 2), len = 150, dir = new THREE.Vector3(-0.92, 0, -0.4).normalize();
    const side = new THREE.Vector3(dir.z, 0, -dir.x), pos = [], idx = [];
    const n = Math.ceil(len / 4);
    for (let i = 0; i <= n; i++) {
      const t = i / n, w = 9 * (1 - t * 0.7) * (0.85 + 0.15 * Math.sin(i * 1.3));
      const c = from.clone().addScaledVector(dir, t * len).addScaledVector(side, Math.sin(t * 5) * 3);
      for (const s of [-1, 0, 1]) { const p = c.clone().addScaledVector(side, s * w); pos.push(p.x, terrain.heightAt(p.x, p.z) + 0.07 + (s ? 0 : 0.03), p.z); }
      if (i) for (let k = 0; k < 2; k++) { const a = (i - 1) * 3 + k, b = a + 1, c2 = a + 3, d = c2 + 1; idx.push(a, c2, b, b, c2, d); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx); g.computeVertexNormals();
    const furrow = new THREE.Mesh(g, makeMaterial({ color: '#8cc77e', color2: '#7fbd76', color3: '#9fd08a', mode: MODE_TERRAIN, ticks: true }));
    furrow.userData.noCollide = true;
    scene.add(furrow);
  }

  // Clover's Potting House (src/shop-world.js, src/shop-fronts.js 'potting'): against a fallen builders' slab under an
  // umbrella tree, halfway from Mira's garden down to the fallen ship (the world's emptiest stretch,
  // docs/audits/level-design-v1.9.md), 11 m off the straight way, its door turned to the walkers coming down
  const shop = placeShop(scene, { def: SHOPS.potting, at: new THREE.Vector3(62, terrain.heightAt(62, -92), -92), heading: -0.75 });
  shipPortals.push(...shop.portals);

  // Mira's runnel (src/viridel-ways.js, level design audit, fourth round): from the water clock west round the meadow by
  // the pond and down to the vines over the fallen ship: the main quest's way back to Mira
  yield;
  const runnel = buildRunnel(scene, terrain);

  // (the white builders' Greenhouse in the hollow north of the ruins: src/temples/edena.js)
  yield;
  return attachTemple('edena', scene, {
    id: 'edena',
    shops: [shop],   // (src/story/shops.js: the keeper behind the counter; main.js: the shop panel)
    // the story's handles (src/story/edena.js): the crashed ship (hatch, cabin panel, the scorch
    // and the veil over it), the tallest tree and its lookout, the pond
    edena: { crashed, tall, pond: { ...POND, y: pondY }, ruins: ruinSlabs },
    // no flora in the pond, round the crashed ship or at the foot of the tallest tree (src/flora.js)
    floraAvoid: shop.avoid((x, z, r) => Math.hypot(x - POND.x, z - POND.z) < POND.r + 6 + r || crashed.centre.distanceTo(new THREE.Vector3(x, crashed.centre.y, z)) < 26 + r
      || Math.hypot(x - tall.base.x, z - tall.base.z) < 14 + r || inTerraces(x, z, r) || runnelDist(x, z) < 1 + r),
    // what the level design audit reads (scripts/level-design/audit.mjs): the runnel, a leading line followed where the
    // main quest sends you back up it; the sluice-gate and the basin on it, to look at
    lines: [{ name: 'Mira’s runnel', points: runnel.points, auto: false }],
    sights: [{ name: 'the runnel’s sluice-gate', at: runnel.sluice }, { name: 'the runnel’s basin', at: runnel.basin }],
    ground: terrain,
    spawn: new THREE.Vector3(0, terrain.heightAt(0, 0), 0),
    spawnHeading: Math.PI,
    camYaw: 0,
    features: { mount: false, wind: false, jetpack: false, climb: true },
    // ligne claire: thin even lines, flat colour, almost no hatching or dotting
    defaults: { hour: 10.5, preset: 'Moebius print', cloudShadows: 0,
      look: { uLineWidth: 1.0, uLineVary: 0.08, uWobble: 0.12, uHatch: 0.35, uDots: 0, uSkyDots: 0.35 } },
    sky: {
      script: {
        // print: deep cerulean over meadow (v0.95: the light a cream paper's, the shade a softer grey-blue, as the sheets)
        day: ['#5ea7da', '#e3efe0', '#98a6c6', '#fff8e8', '#fffbe8'],
        dusk: ['#8f9fd8', '#f6c6a8', '#8a86c8', '#ffe6d0', '#fff0d6'],
        night: ['#18264e', '#3a4c80', '#34407a', '#9ab0d8', '#f2f0e6'],
      },
      planets: [{ az: 230, el: 20, size: 12, color: '#9fd6c9', ring: 0.3 }],
    },
    killY: -Infinity,
    portals: shipPortals,
    get lights() { return [...(shipRoom ? shipRoom.lights : []), ...shop.lights]; },
    atmo: () => ({ tint: [0.98, 1.0, 1.02], fog: 0.7, name: 'Viridel' }),
    life: {
      flocks: [{ count: 16, color: '#f2a7b5', size: 1.4, radius: 70, height: [12, 40], seed: 6 },
               { count: 12, color: '#62c3c9', size: 1.2, radius: 110, height: [20, 60], speed: -0.14, seed: 8 }],
      motes: { count: 200, color: '#fffbe8', size: 0.045, rise: 0.15, wind: [0.5, 0.2] },
    },
    update(dt, t, ctx) { for (const m of movers) m(t, ctx?.player?.pos); },
  });
}
export const createEdena = stepped(buildEdena);
