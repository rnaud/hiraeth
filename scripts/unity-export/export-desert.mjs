// Export the web game's desert for the Unity port (unity/Memento).
//
//   node scripts/unity-export/export-desert.mjs [outDir]
//
// Builds the desert headlessly exactly as the game does at load (build-world.mjs:
// the level, the ship, the story's people, the makers' boxes, the hoverbike, the
// flora), then writes into outDir (default unity/Memento/Assets/StreamingAssets/desert):
//
//   world.bin   every static surface, merged by material and by 256 m tile, in
//               Unity's frame (x mirrored, winding flipped); the collision mesh;
//               the terrain heightfield; the moving things (bike, chest, rib, water…)
//   world.json  where each block lives in world.bin, the materials (makeMaterial
//               options read back from the shader uniforms), the time-of-day table
//               (the palette the post pass uses at each hour), the story places, the
//               people (palettes, routes, seats), the procession route, the flames
//               and the local lights
//   story.json  the desert's words: people and their conversations, quests,
//               things, crowd lines (src/story/desert-data.js as data)
//
// Coordinates: three.js is right-handed, Unity left-handed. Everything is mirrored
// across x (x -> -x), as glTFast does for the traveller's glb; headings h become
// Unity yaw -h. The shaders mirror world positions back before every procedural
// pattern, so the dunes, strata and ripples land exactly where they do on the web.
import { buildDesertWorld } from './build-world.mjs';
import { writeFileSync, mkdirSync, copyFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(process.argv[2] ?? resolve(here, '../../unity/Memento/Assets/StreamingAssets/desert'));
const TILE = 256;
const t0 = Date.now();
const W = await buildDesertWorld();
const { THREE, scene, level, physics, ship, npcs, rt, boxes, crowd, bike, flora, CONTENT } = W;
const Q = level.qanat;
console.log(`built the desert in ${Date.now() - t0} ms`);

// ---------------------------------------------------------------- the binary blob
const chunks = []; let offset = 0;
const blob = (typed) => {
  const buf = Buffer.from(typed.buffer, typed.byteOffset, typed.byteLength);
  const at = offset; chunks.push(buf); offset += buf.length;
  const pad = (4 - (buf.length % 4)) % 4; if (pad) { chunks.push(Buffer.alloc(pad)); offset += pad; }
  return { at, n: typed.length };
};

// ---------------------------------------------------------------- materials
const matIds = new Map(); const materials = [];
const col = (c) => (c ? [+c.r.toFixed(5), +c.g.toFixed(5), +c.b.toFixed(5)] : null);
function materialOf(m) {
  if (matIds.has(m)) return matIds.get(m);
  const u = m.uniforms ?? {};
  const v = (k, d = 0) => (u[k] ? (typeof u[k].value === 'number' ? u[k].value : u[k].value) : d);
  const e = {
    id: materials.length,
    name: m.name || '',
    color: col(u.uColor?.value ?? m.color), color2: col(u.uColor2?.value ?? m.color), color3: col(u.uColor3?.value ?? m.color),
    mode: v('uMode'), flat: v('uFlat'), strataSize: v('uStrataSize', 4), grid: v('uGrid'), glyphs: v('uGlyphs'),
    biomes: v('uBiomes'), ripples: v('uRipples'), sandInk: v('uSandInk'), ticks: v('uTicks'), glow: v('uGlow'),
    folds: v('uFolds'), scrub: v('uScrub'), pattern: v('uPattern'), figure: v('uFigure'), suit: v('uSuit'),
    palette: (u.uPaletteSize?.value ?? 0) > 0 ? u.uPalette.value.slice(0, u.uPaletteSize.value).map(col) : [],
    side: m.side ?? 0,            // 0 front, 1 back, 2 double
    sway: u.uSway?.value ?? 0,
    strataObject: m.defines?.STRATA_OBJECT ? 1 : 0,
    vertexColors: m.vertexColors ? 1 : 0,
    plain: u.uMode ? 0 : 1,        // not one of the G-buffer materials (a MeshBasicMaterial): flat colour, self-lit
  };
  // the people's uniforms (three space, as the shader reads them): outfit zones, skin, gloves, the
  // tunic's print, the face's landmarks / expression / drawing, the eyeballs, the suit's creases, glass, metal
  for (const [k, name] of [['outfit', 'uOutfit'], ['skin', 'uSkin'], ['glove', 'uGlove'], ['trim', 'uTrim'], ['face', 'uFace'], ['mood', 'uMood'], ['mood2', 'uMood2'],
    ['faceKit', 'uFaceKit'], ['faceKit2', 'uFaceKit2'], ['eyeC', 'uEyeC'], ['eyeR', 'uEyeR'], ['eyeLook', 'uEyeLook'], ['creases', 'uCreases'], ['limbs', 'uLimbs'],
    ['glass', 'uGlass'], ['glassCenter', 'uGlassCenter'], ['metal', 'uMetal'], ['hero', 'uHero'],
    // the fluid (FLUID: the tank, the hose, a glob, the wings) and a makers' box coming apart (DISSOLVE)
    // the recordings' hologram (src/ship/hologram.js): how a person is redrawn in light
    ['holoKind', 'uKind'], ['holoCut', 'uCut'], ['holoTint', 'uTint'],
    ['fluidA', 'uFluidA'], ['fluidB', 'uFluidB'], ['fluidBox', 'uFluidBox'], ['fluidTones', 'uFluidTones'], ['dissolve', 'uDissolve'], ['dissolveColor', 'uDissolveColor']]) {
    const x = u[name]?.value;
    if (x === undefined || x === null) continue;
    e[k] = typeof x === 'number' ? x : Array.isArray(x) ? x.flatMap((q) => q.toArray()).map((v) => +v.toFixed(5)) : x.isColor ? col(x) : x.toArray().map((v) => +v.toFixed(5));
  }
  if (m.defines?.FLUID) e.fluid = 1;
  if (m.defines?.DISSOLVE) e.dissolveOn = 1;
  materials.push(e); matIds.set(m, e.id);
  return e.id;
}

// ---------------------------------------------------------------- what is not static
const skip = new Set();     // roots left out of the static world
const objects = [];         // moving / toggled things, exported in their own frame
for (const n of npcs) { if (n.object) skip.add(n.object); if (n.cape?.mesh) skip.add(n.cape.mesh); }
const near = (o, x, z, r = 3) => Math.hypot(o.position.x - x, o.position.z - z) < r;
const { STORY } = await import('../../src/desert-sites.js');
const dyn = {
  bike: bike.object,
  bone: Q.cave.bone,
  wellWater: Q.city.wellWater,
  pool: Q.cave.pool,
  stream: Q.cave.stream,
  drum: W.storyRoots.find((r) => near(r, STORY.drum.x, STORY.drum.z)),
  tarp: W.storyRoots.find((r) => r.isMesh && r.material?.side === THREE.DoubleSide && near(r, bike.pos.x, bike.pos.z, 6)),
};
for (const b of boxes.list) dyn[`box:${b.id}`] = b.parts.root;
// the ship moves in the prologue (it streaks across the sky and ploughs into the dunes); its copy out in
// space (the bunk room you wake in, the cockpit with the recording) and the starfield round it come and go
dyn.ship = ship.parked.group;
if (ship.spaceCopy) { dyn['ship:space'] = ship.spaceCopy.model.group; dyn.space = ship.spaceCopy.space; }
if (ship.crashSite) dyn['ship:crash'] = ship.crashSite.group;
// (drawn as moving things, but where they rest they are walls and floors like the rest)
const solidRoots = new Set([ship.parked.group, ship.spaceCopy?.model.group, ship.crashSite?.group].filter(Boolean));
const solid = (o) => { for (let p = o; p; p = p.parent) if (solidRoots.has(p)) return true; return false; };
for (const [k, o] of Object.entries(dyn)) if (o) skip.add(o); else console.warn(`no ${k}`);
// the procession's banners and lanterns (crowd props, moved every frame) and the story's crowd figures
for (const r of W.storyRoots) if ((r.position.lengthSq() === 0 && !r.name.startsWith('Item box')) || r.name === 'Box beacons') skip.add(r);
// the flora: the game fills its instances by the camera every frame (flora.js); here, every plant at once
for (const set of flora?.sets ?? []) {
  const m = set.mesh, n = set.M.length / 16;
  m.instanceMatrix = new THREE.InstancedBufferAttribute(set.M, 16);
  m.instanceColor = new THREE.InstancedBufferAttribute(set.C, 3);
  m.count = n;
  m.userData.dynamic = false;
}
if (flora?.collider) { scene.add(flora.collider); flora.collider.updateMatrixWorld(true); }
const isSkipped = (o) => { for (let p = o; p; p = p.parent) if (skip.has(p)) return true; return false; };
const noCollide = (o, stop = null) => { for (let p = o; p && p !== stop; p = p.parent) if (p.userData.noCollide) return true; return false; };
const hidden = (o, stop = null) => { for (let p = o; p && p !== stop; p = p.parent) if (!p.visible) return true; return false; };

// ---------------------------------------------------------------- geometry
const _m = new THREE.Matrix4(), _n = new THREE.Matrix3(), _p = new THREE.Vector3(), _q = new THREE.Vector3(), _c = new THREE.Color();
const _pos = new THREE.Vector3(), _quat = new THREE.Quaternion(), _scl = new THREE.Vector3();
class Bucket {
  constructor(mat) { this.mat = mat; this.P = []; this.N = []; this.C = []; this.U = []; this.F = []; this.S = []; this.I = []; this.sway = false; }
  get count() { return this.P.length / 3; }
}
/** Append one mesh (or one instance), transformed by M into the bucket, mirrored into Unity's frame. */
function append(bk, geo, M, { color = null, group = null, swayK = 0, vertexColors = false } = {}) {
  const pa = geo.attributes.position, na = geo.attributes.normal, ca = vertexColors ? geo.attributes.color : null, ua = geo.attributes.uv, fa = geo.attributes.aFold;
  _n.getNormalMatrix(M);
  M.decompose(_pos, _quat, _scl);
  const s = Math.cbrt(Math.abs(_scl.x * _scl.y * _scl.z)) || 1;
  const base = bk.count;
  const idx = geo.index ? geo.index.array : null;
  const start = group ? group.start : 0, cnt = group ? group.count : (idx ? idx.length : pa.count);
  // the vertices this group touches (all of them, for simplicity, when indexed)
  for (let i = 0; i < pa.count; i++) {
    _p.fromBufferAttribute(pa, i).applyMatrix4(M);
    bk.P.push(-_p.x, _p.y, _p.z);
    if (na) { _q.fromBufferAttribute(na, i).applyMatrix3(_n).normalize(); bk.N.push(-_q.x, _q.y, _q.z); } else bk.N.push(0, 1, 0);
    let r = 1, g = 1, b = 1;
    if (ca && ca.itemSize >= 3) { r = ca.getX(i); g = ca.getY(i); b = ca.getZ(i); }
    if (color) { r *= color.r; g *= color.g; b *= color.b; }
    bk.C.push(r, g, b);
    if (ua) bk.U.push(ua.getX(i), ua.getY(i)); else bk.U.push(0, 0);
    if (fa) bk.F.push(fa.getX(i), fa.getY(i)); else bk.F.push(0, 0);
    if (swayK) {
      // the plant's wind bend (materials.js SWAY): world displacement = bend * uSway * y² / s,
      // the brush lean = shove * 0.45 * min(y s, 1.4) / s; anchored at the instance's origin
      const y = Math.max(pa.getY(i), 0);
      bk.S.push(-_pos.x, _pos.z, swayK * y * y / s, 0.45 * Math.min(y * s, 1.4) / s);
      bk.sway = true;
    } else bk.S.push(0, 0, 0, 0);
  }
  const flip = M.determinant() < 0;   // (a mirrored object keeps its outside out)
  for (let k = start; k < start + cnt; k += 3) {
    const a = idx ? idx[k] : k, b = idx ? idx[k + 1] : k + 1, c = idx ? idx[k + 2] : k + 2;
    // mirroring x flips the winding: swap back, unless the object was mirrored already
    if (flip) bk.I.push(base + a, base + b, base + c); else bk.I.push(base + a, base + c, base + b);
  }
}
function writeBucket(bk) {
  const out = { material: bk.mat, vertices: bk.count, indices: bk.I.length };
  out.pos = blob(new Float32Array(bk.P)).at; out.nrm = blob(new Float32Array(bk.N)).at;
  out.col = blob(new Float32Array(bk.C)).at; out.uv = blob(new Float32Array(bk.U)).at;
  out.fold = blob(new Float32Array(bk.F)).at;
  if (bk.sway) out.sway = blob(new Float32Array(bk.S)).at;
  out.idx = blob(new Uint32Array(bk.I)).at;
  let mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
  for (let i = 0; i < bk.P.length; i += 3) for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], bk.P[i + k]); mx[k] = Math.max(mx[k], bk.P[i + k]); }
  out.bounds = [...mn.map((v) => +v.toFixed(2)), ...mx.map((v) => +v.toFixed(2))];
  return out;
}
/** The meshes under root (or the whole scene), as buckets by material (and tile, for the world). */
function collect(root, frame, { tiles = false, filter = () => true } = {}) {
  const buckets = new Map();
  const bucket = (mat, x, z) => {
    const key = tiles ? `${mat}:${Math.floor(x / TILE)}:${Math.floor(z / TILE)}` : `${mat}`;
    let b = buckets.get(key);
    if (!b || b.count > 600000) { if (b) buckets.set(key + ':' + buckets.size, b); b = new Bucket(mat); buckets.set(key, b); }
    return b;
  };
  const inv = frame ? new THREE.Matrix4().copy(frame).invert() : null;
  root.traverse((o) => {
    if (!o.isMesh || !filter(o)) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    const geo = o.geometry;
    if (!geo?.attributes?.position) return;
    if (!geo.attributes.normal) geo.computeVertexNormals();
    const groups = Array.isArray(o.material) && geo.groups.length ? geo.groups : [null];
    for (const g of groups) {
      const m = g ? mats[g.materialIndex] : mats[0];
      if (!m || m.visible === false) continue;
      if (m.type === 'ShaderMaterial' && !m.uniforms?.uMode) continue;   // the tree's fire shells (exported as flames)
      if (m.defines?.CROWD) continue;
      const id = materialOf(m);
      const sway = m.uniforms?.uSway?.value ?? 0;
      const place = (M, color) => {
        const L = inv ? _m.multiplyMatrices(inv, M) : M;
        _p.setFromMatrixPosition(L);
        append(bucket(id, -_p.x, _p.z), geo, L, { color, group: g, swayK: sway, vertexColors: !!m.vertexColors });
      };
      if (o.isInstancedMesh) {
        const M = new THREE.Matrix4();
        for (let i = 0; i < o.count; i++) {
          o.getMatrixAt(i, M); M.premultiply(o.matrixWorld);
          if (o.instanceColor) o.getColorAt(i, _c);
          place(M, o.instanceColor ? _c.clone() : null);
        }
      } else place(o.matrixWorld.clone(), null);
    }
  });
  return [...buckets.values()].filter((b) => b.I.length).map(writeBucket);
}

// the static world: everything but the terrain (its own heightfield) and the moving things
const terrain = level.ground;
const isDynamicFx = (o) => { for (let p = o; p; p = p.parent) if (p.userData.dynamic && (p.isInstancedMesh || p.name === 'Flame' || p.name === 'Smoke column')) return true; return false; };
const statics = collect(scene, null, { tiles: true, filter: (o) => o !== terrain.mesh && !isSkipped(o) && !hidden(o) && !isDynamicFx(o) });
console.log(`static: ${statics.length} chunks, ${statics.reduce((s, c) => s + c.indices / 3, 0)} triangles, ${materials.length} materials`);

// collision: what physics.js bakes (every mesh not under noCollide), minus the moving things
const colP = [], colI = [];
scene.traverse((o) => {
  if (!o.isMesh || o === terrain.mesh || (isSkipped(o) && !solid(o)) || noCollide(o)) return;
  const geo = o.geometry; if (!geo?.attributes?.position) return;
  const add = (M) => {
    const base = colP.length / 3, pa = geo.attributes.position;
    for (let i = 0; i < pa.count; i++) { _p.fromBufferAttribute(pa, i).applyMatrix4(M); colP.push(-_p.x, _p.y, _p.z); }
    const idx = geo.index?.array, n = idx ? idx.length : pa.count;
    for (let k = 0; k < n; k += 3) { const a = idx ? idx[k] : k, b = idx ? idx[k + 1] : k + 1, c = idx ? idx[k + 2] : k + 2; colI.push(base + a, base + c, base + b); }
  };
  if (o.isInstancedMesh) { const M = new THREE.Matrix4(); for (let i = 0; i < o.count; i++) { o.getMatrixAt(i, M); M.premultiply(o.matrixWorld); add(M); } }
  else add(o.matrixWorld);
});
// in 256 m tiles (smaller meshes cook faster and more robustly), each triangle both ways round
// (physics.js casts against both sides; PhysX meshes are one-sided)
const colTiles = new Map();
for (let t = 0; t < colI.length; t += 3) {
  const a = colI[t], b = colI[t + 1], c = colI[t + 2];
  const cx = (colP[a * 3] + colP[b * 3] + colP[c * 3]) / 3, cy = (colP[a * 3 + 1] + colP[b * 3 + 1] + colP[c * 3 + 1]) / 3, cz = (colP[a * 3 + 2] + colP[b * 3 + 2] + colP[c * 3 + 2]) / 3;
  const key = `${Math.floor(cx / TILE)}:${Math.floor(cy / TILE)}:${Math.floor(cz / TILE)}`;
  let tl = colTiles.get(key); if (!tl) colTiles.set(key, (tl = { P: [], I: [] }));
  const base = tl.P.length / 3;
  for (const v of [a, b, c]) tl.P.push(colP[v * 3], colP[v * 3 + 1], colP[v * 3 + 2]);
  tl.I.push(base, base + 1, base + 2, base, base + 2, base + 1);
}
const collision = [...colTiles.values()].map((tl) => ({ vertices: tl.P.length / 3, indices: tl.I.length, pos: blob(new Float32Array(tl.P)).at, idx: blob(new Uint32Array(tl.I)).at }));
console.log(`collision: ${colI.length / 3} triangles in ${collision.length} tiles`);

// the terrain: heights on the grid (three's index layout; Unity mirrors x when it builds the mesh)
const terrainOut = { size: terrain.size, seg: terrain.seg, n: terrain.n, heights: blob(terrain.heights).at, material: materialOf(terrain.mesh.material) };

// ---------------------------------------------------------------- the moving things
const V3 = (v) => [+(-v.x).toFixed(4), +v.y.toFixed(4), +v.z.toFixed(4)];
const Q4 = (q) => [+q.x.toFixed(6), +(-q.y).toFixed(6), +(-q.z).toFixed(6), +q.w.toFixed(6)];   // mirrored across x
for (const [name, o] of Object.entries(dyn)) {
  if (!o) continue;
  o.updateMatrixWorld(true);
  const pos = new THREE.Vector3(), quat = new THREE.Quaternion(), scl = new THREE.Vector3();
  o.matrixWorld.decompose(pos, quat, scl);
  const frame = new THREE.Matrix4().compose(pos, quat, new THREE.Vector3(1, 1, 1));
  const parts = collect(o, frame);   // (collect uses the module's scratch vectors: keep our own)
  objects.push({ name, position: V3(pos), rotation: Q4(quat), scale: [scl.x, scl.y, scl.z].map((v) => +v.toFixed(4)), visible: !hidden(o), parts });
}

// ---------------------------------------------------------------- the look: time of day and the print preset
const { createPost, PRESETS } = await import('../../src/post.js');
const { applyTimeOfDay, colourScript } = await import('../../src/timeofday.js');
const { sharedUniforms } = await import('../../src/materials.js');
const post = createPost(); const U = post.uniforms;
const preset = PRESETS[level.defaults.preset];
const script = colourScript(level.sky.script);
const hours = [];
for (let h = 0; h < 24; h += 0.25) {
  const light = new THREE.Vector3();
  applyTimeOfDay(h, light, U, null, script);
  hours.push({ h, skyTop: col(U.uSkyTop.value), skyHorizon: col(U.uSkyHorizon.value), shadowTint: col(U.uShadowTint.value), lightTint: col(U.uLightTint.value), sunColor: col(U.uSunColor.value),
    light: V3(light), sunDisc: V3(U.uSunDisc.value), moonDisc: V3(U.uMoonDisc.value), flatten: +U.uFlatten.value.toFixed(4), night: +U.uNight.value.toFixed(4), moonVis: +U.uMoonVis.value.toFixed(4) });
}
const look = {
  hour: level.defaults.hour, preset: level.defaults.preset,
  post: { ...Object.fromEntries(Object.entries(U).filter(([, x]) => typeof x.value === 'number').map(([k, x]) => [k, x.value])), ...preset, ink: col(U.uInk.value) },
  shared: Object.fromEntries(Object.entries(sharedUniforms).filter(([, x]) => typeof x.value === 'number').map(([k, x]) => [k, x.value])),
  hours,
  planets: level.sky.planets ?? [],
  biomes: (await import('../../src/biome.js')).BIOMES,
};
for (const k of Object.keys(preset)) look.shared[k] = preset[k] ?? look.shared[k];

// ---------------------------------------------------------------- the story's places and people
const city = Q.city, camps = Q.camps, cave = Q.cave, giant = Q.giant, ledge = city.ledge;
const places = {
  spawn: V3(level.spawn), spawnHeading: -level.spawnHeading,
  shipSite: V3(new THREE.Vector3(ship.site.x, ship.site.ground, ship.site.z)), shipHeading: -ship.site.heading, shipRamp: V3(ship.rampFoot),
  cityCenter: V3(city.center), cityGate: V3(city.gate), backGate: V3(city.backGate), cityTop: city.top, cityYaw: -city.yaw,
  well: V3(city.well), wellLook: V3(city.wellLook), stele: V3(city.stele), treeBase: V3(city.treeBase), crown: V3(city.crown),
  plinthStair: V3(city.plinthStair), stairTop: V3(city.stairTop),
  ledgeBox: V3(ledge.box), ledgeYaw: -ledge.yaw, ledgeHeight: ledge.height, ledgeFoot: V3(ledge.foot), nourBench: V3(ledge.bench.at),
  camps: V3(camps.center), fire: V3(camps.fires[0]), fires: camps.fires.map(V3),
  giantDoor: V3(giant.door), giantYaw: -giant.yaw, giantBrow: V3(giant.brow),
  caveOrigin: V3(cave.origin), caveInside: V3(cave.inside), caveExit: V3(cave.exit), pool: V3(cave.poolCenter), poolR: cave.poolR,
  poolLevels: cave.levels, bone: V3(cave.bone.position), boneAside: cave.boneAside ? V3(cave.boneAside.pos ?? cave.boneAside) : null, mural: V3(cave.mural),
  drum: V3(new THREE.Vector3(STORY.drum.x, terrain.heightAt(STORY.drum.x, STORY.drum.z) + 0.3, STORY.drum.z)),
  oumStone: V3(new THREE.Vector3(STORY.pilgrim.x, terrain.heightAt(STORY.pilgrim.x, STORY.pilgrim.z), STORY.pilgrim.z)),
  mask: V3(new THREE.Vector3(-20, terrain.heightAt(-20, -372), -372)),
  bike: V3(bike.pos), bikeHeading: -bike.heading,
  boxes: boxes.list.map((b) => ({ id: b.id, item: b.item, pos: V3(b.pos), yaw: -b.yaw, name: b.def?.name ?? b.item })),
};
const people = npcs.map((n) => ({
  id: n.def?.id ?? n.id, name: n.def?.name, title: n.def?.title, kind: n.def?.kind ?? n.kind ?? 'm', scale: n.object?.scale?.y ?? 1,
  palette: n.def?.palette ?? n.palette, head: n.def?.head, cape: n.def?.cape ?? 0, color: n.def?.color,
  pos: V3(n.pos), heading: -(n.heading ?? 0), route: (n.route ?? []).map(V3), seat: n.seat ?? null, speed: n.speed ?? 1, lines: n.def?.lines ?? n.lines ?? [],
}));
const proc = crowd.route?.('procession');
const crowdOut = {
  people: crowd.people.map((p) => ({ pos: V3(p.pos), heading: -(p.heading ?? 0), spot: p.spot?.id ?? null, role: p.role ?? null, kind: p.kind ?? null, pose: p.pose ?? null,
    walk: p.walk ? { route: crowd.routes.indexOf(p.walk.route), u: p.walk.u, side: p.walk.side, dir: p.walk.dir, speed: p.walk.speed } : null })),
  routes: crowd.routes.map((r) => ({ id: r.id, points: r.pts.map(V3), loop: !!r.loop, total: r.total, keepRight: r.keepRight, column: r.column ? { speed: r.column.speed, lead: r.column.lead, lanes: r.column.lanes, gap: r.column.gap } : null })),
  procession: proc ? crowd.routes.indexOf(proc) : -1,
};
const fires = [];
const flameOf = (f, name) => {
  if (!f) return;
  if (f.tongues) { f.mesh.updateMatrixWorld(true); f.mesh.parent.updateMatrixWorld(true); fires.push({ name, kind: 'tongues', parent: f.mesh.parent.matrixWorld.toArray(), tongues: f.tongues.map((t) => ({ at: [t.at.x, t.at.y, t.at.z], h: t.h, r: t.r, phase: t.phase, lean: [t.lean.x, t.lean.y, t.lean.z], core: t.core })), palette: f.palA.map(col) }); }
  else if (f.group) { f.group.updateMatrixWorld(true); f.group.getWorldPosition(_p); fires.push({ name, kind: 'body', at: V3(_p), width: f.width, height: f.height, palette: f.palA.map(col), pace: f.pace }); }
};
flameOf(city.flames, 'tree');
for (const [i, f] of (Q.fires ?? []).entries()) flameOf(f.flames ?? f, `fire${i}`);
const lights = level.lights.filter((l) => l.y > -1e4).map((l) => [-l.x, l.y, l.z, l.w]);
// smoke and embers (src/story/flames.js): the burning tree's landmark column, its embers, the camp fires' smoke
const hex = (c) => '#' + c.getHexString();
const fx = { column: null, embers: [], smokes: [] };
{
  const c = city.smoke;
  if (c) fx.column = { at: V3(c.at), count: c.items.length, height: c.height, drift: c.drift, base: c.base, top: c.top, period: c.period, palette: c.palA.map(hex), tint: hex(c.tint), glow: c.material.uniforms.uGlow?.value ?? 0.92, wind: V3(c.wind) };
  const e = city.embers;
  if (e) fx.embers.push({ sources: e.sources.map(V3), count: e.items.length, rise: e.rise, life: e.life, spread: e.spread, size: e.mesh.geometry.parameters?.radius ?? 0.6, color: hex(e.mesh.material.uniforms.uColor.value) });
  scene.traverse((o) => {
    if (!o.isInstancedMesh || !o.userData.dynamic || o.name) return;
    const g = o.geometry?.parameters;
    // (the camp fires' Smoke: an icosahedron of detail 1, glow 0.8)
    if (o.geometry.type === 'IcosahedronGeometry' && g?.detail === 1 && Math.abs((o.material.uniforms?.uGlow?.value ?? 0) - 0.8) < 1e-3) fx.smokes.push({ count: o.count, color: hex(o.material.uniforms.uColor.value) });
  });
}
// (made in camp order: the fires' order) at 1 m over each fire, as desert-city.js places them
fx.smokes.forEach((sm, i) => { const f = camps.fires[i]; if (!f) return; const big = sm.count >= 18; Object.assign(sm, { at: V3(new THREE.Vector3(f.x, f.y + 1, f.z)), height: big ? 26 : 16, size: big ? 1.25 : 0.9 }); });

// the ship's places and the prologue's path (src/ship/cinematics.js PrologueDirector)
const shipOut = (() => {
  const { PrologueDirector } = W.shipDirector;
  const d = new PrologueDirector(ship);
  const P = (m) => Object.fromEntries(Object.entries(m.interior.points).map(([k, v]) => [k, v?.isVector3 ? V3(v) : Array.isArray(v) ? v.map(V3) : -v]));
  const frame = (g) => { g.updateMatrixWorld(true); const p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3(); g.matrixWorld.decompose(p, q, s); return { pos: V3(p), rot: Q4(q) }; };
  return {
    rest: V3(ship.restPos), restRot: Q4(ship.restQuat), parked: frame(ship.parked.group), space: ship.spaceCopy ? frame(ship.spaceCopy.model.group) : null,
    points: P(ship.parked), spacePoints: ship.spaceCopy ? P(ship.spaceCopy.model) : null,
    hinge: V3(ship.hinge), rampFoot: V3(ship.rampFoot), outDir: V3(ship.outDir), heading: -ship.site.heading,
    crash: ship.site.crash ? { travel: -ship.site.crash.travel, length: ship.site.crash.length } : null,
    T: V3(d.T), N: V3(d.N), touch: V3(d.touch), S0: V3(d.S0), S1: V3(d.S1), R: W.shipHull.R, DECK: W.shipHull.DECK, HATCH_A: -W.shipHull.HATCH_A,
    // the holo table's planet (src/ship/holotable.js: drawn as approach.js draws a world; its size, its look)
    holoTable: { planetR: W.shipTable.planetR, world: 'desert' },
  };
})();

const world = {
  version: 1, exported: new Date().toISOString(), tile: TILE,
  frame: 'Unity: x mirrored from three.js (x -> -x), y up, metres; headings are Unity yaw in radians',
  materials, chunks: statics, collision, terrain: terrainOut, objects, look, places, people, crowd: crowdOut, fires, lights, fx,
  // the weather it can have (content.js; main.js: a sandstorm in the desert) and the life in it (motes, footprints)
  weather: { kinds: CONTENT.desert.weather ?? [], stormColor: '#e3c58f' }, life: { motes: level.life?.motes ?? null, footprints: level.life?.footprints ?? null },
  // walking into one puts you at its other end (the skull's mouth and the cave passage, doorways into rooms)
  portals: (level.portals ?? []).filter((p) => p.at && p.to).map((p) => ({ at: V3(p.at), r: p.r ?? 1.5, to: V3(p.to), heading: -(p.heading ?? 0), label: p.label ?? '' })),
  ship: { site: places.shipSite, ramp: places.shipRamp, ...shipOut },
  flora: { count: flora?.count ?? 0 },
};

// ---------------------------------------------------------------- the people, dressed (people.mjs)
const { exportPeople } = await import('./people.mjs');
const tp = Date.now();
const dressed = await exportPeople({ W, blob, materialOf });
world.figures = dressed;
console.log(`people: ${dressed.people.length} dressed, ${dressed.geometries.length} geometries, ${Date.now() - tp} ms`);

// ---------------------------------------------------------------- the words
const data = await import('../../src/story/desert-data.js');
const calls = await import('../../src/story/calls.js');
const { callTimeline } = await import('../../src/ship/prologue.js');
const sig = await import('../../src/story/signature.js');
const { LEVELS } = await import('../../src/levels/index.js');
const { ORDER } = await import('../../src/levels/names.js');
const story = { prologue: { call: calls.PROLOGUE_CALL, timeline: callTimeline(calls.PROLOGUE_CALL), crash: sig.CRASH_LINE, map: sig.MAP_LINE, stages: (await import('../../src/ship/prologue.js')).PROLOGUE_STAGES.map((s) => ({ ...s, dur: Number.isFinite(s.dur) ? s.dur : -1 })) },
  worlds: LEVELS.map((l) => ({ id: l.id, title: l.title, blurb: l.blurb ?? '', source: l.source ?? '' })), order: ORDER ?? LEVELS.map((l) => l.id),
  quests: data.QUESTS, people: data.PEOPLE, things: data.THINGS, lines: data.LINES, items: data.ITEMS, villagers: data.VILLAGERS, villagerTalk: data.VILLAGER_TALK, murmurs: data.MURMURS, crowdTalk: data.CROWD_TALK,
  // the galactic map (starmap.js): the strike's signature per world and its legend, the planets' looks (planets.js)
  map: { signature: sig.SIGNATURE_WORLDS, legend: sig.SIGNATURE_LEGEND, legendShort: sig.SIGNATURE_LEGEND_SHORT, planets: (await import('../../src/ship/planets.js')).PLANETS } };
const fnCount = JSON.stringify(story, (k, v) => (typeof v === 'function' ? '[fn]' : v)).split('[fn]').length - 1;
if (fnCount) console.warn(`story: ${fnCount} functions left out (only data travels)`);

// ---------------------------------------------------------------- reference plans for the Unity port's voice (tests: VoiceTests.cs)
{
  const V = await import('../../src/story/voice.js');
  const lines = [['~happy~ Welcome, traveller! The fire is warm.', { id: 'ama', kind: 'f', scale: 0.91 }], ['~sad~ The well has been dry for a long time…', { id: 'hessa', voice: 0.7, kind: 'f' }],
    ['~curious~ Who are the Givers? Why a star?', { id: 'you', voice: 1.0, kind: 'm' }], ['~angry~ Hey! Mind where you push!', { seed: 'crowd:12' }], ['(She laughs.) ~solemn~ Come down, child.', { id: 'nour', name: 'Nour', title: 'the eldest' }]];
  world.voiceReference = lines.map(([text, person]) => {
    const { parseLine } = { parseLine: (t) => t };
    const plan = V.planLine(text, { voice: V.voiceOf(person), lang: 'desert' });
    const short = V.planLine(text, { voice: V.voiceOf(person), lang: 'desert', max: 9 });
    return { text, person, voice: V.voiceOf(person), plain: plan.text, tone: plan.tone, total: plan.total, n: plan.syllables.length, shortN: short.syllables.length,
      syllables: plan.syllables.map((x) => ({ t: x.t, dur: x.dur, f0: x.f0, gain: x.gain, vowel: x.vowel, cons: x.cons })) };
  });
}

mkdirSync(OUT, { recursive: true });
writeFileSync(resolve(OUT, 'world.bin'), Buffer.concat(chunks));
writeFileSync(resolve(OUT, 'world.json'), JSON.stringify(world));
writeFileSync(resolve(OUT, 'story.json'), JSON.stringify(story, null, 1));
// the people: the traveller and the Quaternius bodies with their animation library, as they are (glTFast loads them)
const ANIM = resolve(OUT, '../anim');
mkdirSync(ANIM, { recursive: true });
for (const f of ['traveller.glb', 'human_m.glb', 'human_f.glb', 'ual.glb']) copyFileSync(resolve(here, '../../public/anim', f), resolve(ANIM, f));
console.log(`wrote ${OUT}: world.bin ${(offset / 1e6).toFixed(1)} MB, ${objects.length} objects, ${people.length} people, ${fires.length} fires, ${Date.now() - t0} ms`);
