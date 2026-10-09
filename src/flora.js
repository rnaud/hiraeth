import { registerHazard, cylinderHazard, HAZARD_DPS } from './hazards.js';
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeMaterial } from './materials.js';
import { mulberry32, createNoise2D } from './noise.js';
import { biomeWeights } from './biome.js';
import { SPECIES } from './flora-species.js';
import { farLevel, farSide } from './lod.js';
import { runSteps } from './load-steps.js';

// Flora: every world's own plants, growing in clumps (src/flora-species.js draws them).
//
// Placement (clusterScatter, pure): patch centres are thrown like darts, kept apart and
// thinned by a slow noise (fertile ground and bare ground). Each patch is a dense clump of
// one species, thickest at its heart, with a few companions at its rim; the large plants
// stand in small groves with their companions at their feet. A few loners grow between.
//
// The ground (buildFlora): heightfield worlds take the terrain, the others (the City-Shaft
// rim, the Hangar plateau, the Sky Stones) cast a ray down onto the real geometry. A plant
// only grows on open, gentle ground: not under a roof or a rock, not on a slope or in deep
// water, not on the paths, buildings or story places a level marks (level.floraAvoid), and
// not where people stand, boxes and relics wait, or the ship lands (the keep list).
//
// Drawing: one InstancedMesh per species, refilled from the 32 m cells in view within the
// species' distance (small plants go first; times the preset's floraFar). The Handheld preset
// grows fewer small plants (floraDensity). Large plants get a collision cylinder each.

export const FLORA_CELL = 32;
const SMALL = 1.45;

/** How far a plant of this height (m) is drawn (m), at floraFar = 1. */
export const farFor = (h, large) => (large ? 420 : h < 0.45 ? 60 : h < 1.3 ? 95 : h < 2.6 ? 150 : 230);

// ------------------------------------------------------------------ worlds: where the flora grows
// regions: { x, z, r, r0, a0, a1, w } (a disc, ring or sector round x, z) or { x0, x1, z0, z1, w };
//          band: [ymin, ymax] for ray-cast ground. patches: how many clumps.
// zone(x, z) -> { [species id]: weight multiplier } (e.g. the desert's regions).
export const FLORA_WORLDS = {
  desert: { seed: 11, patches: 380, sparse: 0.08, regions: [{ x: 0, z: 0, r0: 28, r: 420, w: 2.2 }, { x: 0, z: 0, r0: 420, r: 1420, w: 3 }],
    zone: (x, z) => { const b = biomeWeights(x, z); b.gold = Math.max(0, 1 - b.rose - b.salt); return { 'desert.totem': 0.3 + 1.6 * b.rose, 'desert.sentinel': 0.4 + b.gold, 'desert.star': 0.4 + 1.8 * b.salt, 'desert.barrel': 0.5 + b.rose + b.gold, 'desert.whip': 0.3 + b.gold, 'desert.lamp': 0.5 + b.rose }; } },
  incal: { seed: 12, ray: true, patches: 70, sparse: 0.05, regions: [{ x: 0, z: 0, r0: 266, r: 420, a0: -0.75, a1: 0.75, w: 1, band: [198, 202] }] },
  arzach: { seed: 13, patches: 300, sparse: 0.08, regions: [{ x: 0, z: 0, r0: 30, r: 360, w: 1.5 }, { x: 0, z: 0, r0: 360, r: 1250, w: 3 }] },
  arzach2: { seed: 14, ray: true, patches: 120, sparse: 0.06, regions: [{ x: 0, z: 0, r0: 10, r: 84, w: 1, band: [34, 48] }, { x0: -1100, x1: 1100, z0: -1160, z1: -930, w: 4, band: [20, 90] }] },
  garage: { seed: 15, ray: true, patches: 56, sparse: 0.06, regions: [{ x: 0, z: 0, r0: 44, r: 190, w: 1, band: [-3, 3] }] },
  buried: { seed: 16, patches: 240, sparse: 0.08, regions: [{ x: 0, z: 60, r0: 16, r: 320, w: 1.5 }, { x: 0, z: 60, r0: 320, r: 900, w: 3 }] },
  edena: { seed: 17, patches: 420, sparse: 0.1, regions: [{ x: 0, z: 0, r0: 10, r: 300, w: 1.3 }, { x: 0, z: 0, r0: 300, r: 1300, w: 3 }] },
  spheres: { seed: 18, patches: 260, sparse: 0.08, regions: [{ x: 0, z: -60, r0: 0, r: 260, w: 1.4 }, { x: 0, z: -200, r0: 240, r: 700, w: 2.5 }] },
  perdide: { seed: 19, patches: 320, sparse: 0.08, water: 0, regions: [{ x: 0, z: 0, r0: 18, r: 300, w: 1.4 }, { x: 0, z: 0, r0: 300, r: 1100, w: 3 }] },
  perdide2: { seed: 20, patches: 230, sparse: 0.08, water: 0, regions: [{ x: 0, z: -150, r0: 0, r: 760, w: 1 }] },
  // home: the hill outside the yard wall, and a little along its inside (the yard itself is the family's: home.js floraAvoid)
  home: { seed: 22, patches: 180, sparse: 0.08, regions: [{ x: 0, z: 34, r0: 21, r: 25.2, w: 0.25 }, { x: 0, z: 20, r0: 34, r: 320, w: 3 }] },
  bazaar: { seed: 21, ray: true, patches: 64, sparse: 0.1, regions: [{ x0: 17.5, x1: 26.5, z0: -330, z1: 100, w: 1, band: [-1, 1.6] }, { x0: -26.5, x1: -17.5, z0: -330, z1: 100, w: 1, band: [-1, 1.6] }] },
};

// ------------------------------------------------------------------ placement (pure)
const TAU = Math.PI * 2;

function pickRegion(regions, rng) {
  let total = 0;
  for (const g of regions) total += g.w ?? 1;
  let u = rng() * total;
  for (const g of regions) { u -= g.w ?? 1; if (u <= 0) return g; }
  return regions[regions.length - 1];
}
function pointIn(g, rng) {
  if (g.x0 !== undefined) return [g.x0 + rng() * (g.x1 - g.x0), g.z0 + rng() * (g.z1 - g.z0)];
  const r0 = g.r0 ?? 0, a = g.a0 !== undefined ? g.a0 + rng() * (g.a1 - g.a0) : rng() * TAU;
  const r = Math.sqrt(r0 * r0 + rng() * (g.r * g.r - r0 * r0));   // even over the ring's area
  return [g.x + Math.cos(a) * r, g.z + Math.sin(a) * r];
}
function pickWeighted(list, weight, rng) {
  let total = 0;
  const w = (s) => { const v = weight(s); return v > 0 ? v : 0; };   // (NaN counts as none)
  for (const s of list) total += w(s);
  if (!(total > 0)) return null;
  let u = rng() * total;
  for (const s of list) { u -= w(s); if (u <= 0) return s; }
  return list[list.length - 1];
}

/**
 * Plants in clumps.
 * @param o.species   the world's species (flora-species.js)
 * @param o.regions   where (see FLORA_WORLDS)
 * @param o.patches   how many clumps
 * @param o.sparse    loners between the clumps, as a share of all plants
 * @param o.density   1 = full; the Handheld preset grows fewer small plants (large ones stay)
 * @param o.accept    (x, z, species, region) -> ground y, or null where it can't grow
 * @param o.zone      (x, z) -> { [id]: weight } local preference (optional)
 * @param o.seed
 * @returns [{ sp, x, y, z, height, yaw, tiltX, tiltZ, patch }]
 */
export function clusterScatter({ species, regions, patches = 100, sparse = 0.08, density = 1, accept = () => 0, zone = null, seed = 1 }) {
  const rng = mulberry32(seed), noise = createNoise2D(seed * 7 + 3);
  const out = [], centres = [];
  const big = new Map();   // large plants by 8 m cell: everything keeps clear of their trunks
  const bigKey = (x, z) => `${Math.floor(x / 8)},${Math.floor(z / 8)}`;
  const nearBig = (x, z, r) => {
    const cx = Math.floor(x / 8), cz = Math.floor(z / 8);
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (const b of big.get(`${cx + i},${cz + j}`) ?? []) if (Math.hypot(b.x - x, b.z - z) < b.r + r) return true;
    return false;
  };
  const small = species.filter((s) => !s.large);
  const byId = new Map(species.map((s) => [s.id, s]));
  const plant = (sp, x, z, region, patch, local) => {
    const y = accept(x, z, sp, region);
    if (y === null || y === undefined || !Number.isFinite(y)) return false;
    const clear = sp.large ? sp.collide[0] * 1.5 + 1.2 : sp.spacing * 0.35;
    if (nearBig(x, z, clear)) return false;
    for (const p of local) if ((p.x - x) ** 2 + (p.z - z) ** 2 < (p.sp === sp ? sp.spacing ** 2 : (sp.spacing * 0.45) ** 2)) return false;
    const [lo, hi] = sp.size, t = rng();
    const p = { sp, x, y, z, height: lo + (hi - lo) * (sp.large ? t : 0.75 * t * t + 0.25 * rng()), yaw: rng() * TAU,
      tiltX: sp.large ? 0 : (rng() - 0.5) * 0.14, tiltZ: sp.large ? 0 : (rng() - 0.5) * 0.14, patch };
    out.push(p);
    local.push(p);
    if (sp.large) { const k = bigKey(x, z); (big.get(k) ?? big.set(k, []).get(k)).push({ x, z, r: sp.collide[0] * 1.5 }); }
    return true;
  };

  // patch centres: darts kept apart, thinned by noise
  for (let tries = 0; centres.length < patches && tries < patches * 30; tries++) {
    const region = pickRegion(regions, rng), [x, z] = pointIn(region, rng);
    const fertile = 0.5 + 0.5 * noise(x / 140, z / 140);
    if (rng() > 0.25 + 0.75 * fertile) continue;
    const pref = zone?.(x, z) ?? null;
    const lead = pickWeighted(species, (s) => (s.weight ?? 1) * (pref?.[s.id] ?? 1), rng);
    if (!lead) continue;
    const R = lead.spread * (0.7 + rng() * 0.6);
    if (centres.some((c) => Math.hypot(c.x - x, c.z - z) < (c.R + R) * 1.1)) continue;
    const y = accept(x, z, lead, region);   // a clump starts only where its first plant can grow
    if (y === null || y === undefined || !Number.isFinite(y)) continue;
    centres.push({ x, z, R, lead, region });
  }

  // the clumps: dense at the heart, a few companions round the rim
  centres.forEach((c, patch) => {
    const local = [], lead = c.lead;
    const [n0, n1] = lead.patch;
    const want = Math.max(1, Math.round((n0 + rng() * (n1 - n0)) * (lead.large ? 1 : density)));
    for (let k = 0, placed = 0; placed < want && k < want * 5; k++) {
      const a = rng() * TAU, d = c.R * Math.pow(rng(), 0.8) * (placed === 0 ? 0.3 : 1);
      if (plant(lead, c.x + Math.cos(a) * d, c.z + Math.sin(a) * d, c.region, patch, local)) placed++;
    }
    if (!local.length) return;
    const mates = (lead.with ?? []).map((id) => byId.get(id)).filter(Boolean);
    const pool = mates.length ? mates : small.filter((s) => s !== lead);
    const kinds = Math.min(pool.length, lead.large ? 2 : 1 + (rng() < 0.5 ? 1 : 0));
    for (let m = 0; m < kinds; m++) {
      const mate = pool[(m + Math.floor(rng() * pool.length)) % pool.length];
      const n = Math.max(1, Math.round((mate.patch[0] + rng() * (mate.patch[1] - mate.patch[0])) * (lead.large ? 0.8 : 0.35) * density));
      for (let k = 0, placed = 0; placed < n && k < n * 4; k++) {
        const a = rng() * TAU, d = c.R * (lead.large ? 0.3 + rng() * 1.0 : 0.6 + rng() * 0.8);
        if (plant(mate, c.x + Math.cos(a) * d, c.z + Math.sin(a) * d, c.region, patch, local)) placed++;
      }
    }
  });

  // loners between the clumps
  const loners = Math.round(out.length * sparse);
  for (let i = 0, tries = 0; i < loners && tries < loners * 6 && small.length; tries++) {
    const region = pickRegion(regions, rng), [x, z] = pointIn(region, rng);
    if (plant(small[Math.floor(rng() * small.length)], x, z, region, -1, [])) i++;
  }
  return out;
}

// ------------------------------------------------------------------ where nothing grows
/**
 * The places plants must leave clear, as [{ x, z, r }]: the spawn, the ship's landing site and
 * ramp, everyone standing about, the boxes, the relics, the story's goal, the doorways and portals,
 * and the world's responsive plants or screens.
 */
export function floraKeep({ level = {}, content = {}, ship = null, npcs = [], crowd = null, boxes = null, reactiveWorld = null } = {}) {
  const keep = [];
  const add = (x, z, r) => { if (Number.isFinite(x) && Number.isFinite(z)) keep.push({ x, z, r }); };
  if (level.spawn) add(level.spawn.x, level.spawn.z, 10);
  if (ship?.site) add(ship.site.x, ship.site.z, 20);
  if (ship?.rampFoot) add(ship.rampFoot.x, ship.rampFoot.z, 8);
  for (const s of content.npcs ?? []) add(s.at?.[0], s.at?.[1], 4);
  for (const n of npcs) { const p = n.home ?? n.object?.position; if (p) add(p.x, p.z, 3.5); }
  for (const p of crowd?.people ?? []) { const h = p.home ?? p.pos; if (h) add(h.x, h.z, 1.6); }
  for (const b of boxes?.list ?? []) if (b.pos) add(b.pos.x, b.pos.z, 5);
  for (const s of content.relics?.spots ?? []) {
    const a = Array.isArray(s) ? s : s.at;
    if (a) add(a[0], a.length === 2 ? a[1] : a[2], 3);
  }
  const goal = content.story?.goal;
  if (goal) add(goal[0], goal[2], Math.max(6, (content.story.radius ?? 6) * 0.6));
  for (const p of level.portals ?? []) { if (p.at) add(p.at.x, p.at.z, 6); if (p.to) add(p.to.x, p.to.z, 6); }
  for (const p of level.navigationPortals ?? []) { if (p.at) add(p.at.x, p.at.z, 6); if (p.to) add(p.to.x, p.to.z, 6); }
  for (const n of reactiveWorld?.nodes ?? []) add(n.pos.x, n.pos.z, Math.max(1.6, n.reach ?? 0));   // (a flower: its petals' reach awake)
  return keep;
}

// ------------------------------------------------------------------ building it in a world
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3();
const DOWN = new THREE.Vector3(0, -1, 0), UP = new THREE.Vector3(0, 1, 0);
const _o = new THREE.Vector3(), _d = new THREE.Vector3();

/** The world's species, built once: geometry, nominal height (its top), material. */
function prepare(list) {
  return list.map((sp) => {
    const geo = sp.build();
    geo.computeBoundingBox();
    const h = geo.boundingBox.max.y;
    const mat = makeMaterial({ color: '#ffffff', vertexColors: true, ...(sp.glow ? { glow: sp.glow } : {}), ...(sp.sway ? { sway: sp.sway / (h * h), swayH: h, swayLarge: !!sp.large } : {}) });
    // the small ones are drawn a size up: Moebius' meadows are bold, and a 30 cm flower is lost under the ink
    const k = sp.large ? 1 : SMALL;
    return { ...sp, size: sp.size.map((v) => v * k), spacing: sp.spacing * k, spread: sp.spread * (sp.large ? 1 : 1.2), geo, h, mat };
  });
}

/**
 * Grow this world's flora. Call once the level, its collision, the ship and the people
 * are in place (main.js).
 * @param o.keep     [{ x, z, r }] places nothing may grow (people, boxes, relics, the ship, the spawn)
 * @param o.density  the preset's floraDensity
 * @returns {Flora|null}
 */
export function buildFlora(o) { return runSteps(buildFloraSteps(o)); }
/** buildFlora a part and a species a step (src/load-steps.js). */
export function* buildFloraSteps({ scene, level, levelId, physics, keep = [], density = 1 }) {
  // a level may grow several worlds' flora (level.flora: [{ world, regions, patches, sparse, seed, water, zone }],
  // the Lab's biome rooms); otherwise it is the world's own (FLORA_WORLDS)
  const parts = (level.flora ?? (FLORA_WORLDS[levelId] ? [{ ...FLORA_WORLDS[levelId], world: levelId }] : [])).filter((p) => SPECIES[p.world]?.length);
  if (!parts.length) return null;
  const t0 = performance.now();
  const species = [], plants = [], why = {};
  for (const part of parts) {
    const own = prepare(SPECIES[part.world]);
    species.push(...own);
    yield;
    plants.push(...growPart({ part, species: own, level, physics, keep, density, why }));
    yield;
  }
  const flora = yield* Flora.make(scene, species, plants);
  flora.buildMs = performance.now() - t0;
  flora.why = why;
  return flora;
}

/** One world's plants over its regions (buildFlora). */
function growPart({ part: world, species, level, physics, keep, density, why }) {
  const heightAt = level.ground?.heightAt?.bind(level.ground);
  const water = world.water ?? -Infinity;
  const avoid = level.floraAvoid ?? (() => false);
  const blocked = (x, z, r) => {
    for (const k of keep) if ((k.x - x) ** 2 + (k.z - z) ** 2 < (k.r + r) ** 2) return true;
    return avoid(x, z, r);
  };
  const ray = (x, y, z, dir, far) => physics?.rayHit?.(_o.set(x + 1.3e-4, y, z + 2.7e-4), dir, far) ?? null;
  // the ground where a plant would stand, or null
  const slopeOk = (x, z, sp) => {
    const e = 0.8, sx = heightAt(x + e, z) - heightAt(x - e, z), sz = heightAt(x, z + e) - heightAt(x, z - e);
    return Math.max(Math.abs(sx), Math.abs(sz)) / (2 * e) <= (sp.slope ?? (sp.large ? 0.32 : 0.5));
  };
  // (why: why plants didn't grow, by reason, for tuning and the tests)
  const no = (k) => { why[k] = (why[k] ?? 0) + 1; return null; };
  const groundAt = (x, z, sp, region) => {
    const base = heightAt?.(x, z) ?? -Infinity;
    const top = world.ray ? region.band[1] + 1 : base + 6;
    if (!Number.isFinite(top)) return no('void');
    const hit = ray(x, top, z, DOWN, world.ray ? top - region.band[0] : 6);
    let y;
    if (hit && !(hit.point.y < base + 0.25)) {
      // standing on something built: in the heightfield worlds that's a rock, a roof, a step (no
      // plants there); in the others it is the ground itself (the rim, the plateau, the stone tables)
      if (!world.ray || hit.normal.y < 0.92) return no('built');
      y = hit.point.y;
    } else {
      if (!Number.isFinite(base)) return no('void');
      if (!slopeOk(x, z, sp)) return no('slope');
      y = world.ray && hit ? Math.max(base, hit.point.y) : base;   // (a pavement a hand above the ground)
    }
    if (world.ray && (y < region.band[0] || y > region.band[1])) return no('band');
    if (y < water - (sp.wade ?? 0) + (sp.wade ? 0 : 0.15)) return no('water');
    if (level.unsafe?.(_p.set(x, y, z)) && !sp.wade) return no('unsafe');
    // nothing overhead: not inside a house, under a bridge, a ledge or an awning
    if (ray(x, y + 0.3, z, UP, sp.large ? 9 : 4)) return no('roof');
    if (sp.large) {
      // a big plant needs room round its trunk
      const r = sp.collide[0] * 1.6 + 0.6;
      for (let k = 0; k < 4; k++) {
        _d.set(Math.cos(k * Math.PI / 2), 0, Math.sin(k * Math.PI / 2));
        if (ray(x, y + 1.2, z, _d, r)) return no('crowded');
      }
    }
    return y;
  };
  const accept = (x, z, sp, region) => {
    const r = sp.large ? sp.collide[0] + 2.5 : 0.4;
    if (blocked(x, z, r)) return no(sp.large ? 'keep (large)' : 'keep');
    return groundAt(x, z, sp, region);
  };
  return clusterScatter({ species, regions: world.regions, patches: world.patches, sparse: world.sparse, density, accept, zone: world.zone, seed: world.seed });
}

const _fr = new THREE.Frustum(), _pm = new THREE.Matrix4(), _sph = new THREE.Sphere(), _box = new THREE.Box3();

/**
 * A world's plants, drawn one InstancedMesh per species. The plants are filed by 32 m cell;
 * whenever the set of cells worth drawing changes (in view and within the species' distance,
 * or close enough behind you that their shadows fall into view), those cells' plants are copied
 * into the mesh. So the flora costs one draw call per species per pass, wherever you are.
 * Cells far enough that a coarser copy of the plant (lod.js farLevel) differs by under the
 * preset's lodPx pixels go into a second mesh with that copy (a second draw call, far fewer
 * triangles).
 */
export class Flora {
  constructor(scene, species, plants) { runSteps(this.steps(scene, species, plants)); }

  /** Built a species a step: `yield* Flora.make(...)` (its far copy is a simplification, the slow part). */
  static *make(scene, species, plants) {
    const f = Object.create(Flora.prototype);
    yield* f.steps(scene, species, plants);
    return f;
  }

  *steps(scene, species, plants) {
    this.root = new THREE.Group();
    this.root.name = 'Flora';
    this.root.userData.noCollide = true;
    this.root.matrixAutoUpdate = false;
    scene.add(this.root);
    this.species = species;
    this.plants = plants;
    this.sets = [];
    this.small = [];      // left out of the far shadow pass
    this.noShadow = [];   // ground cover: no shadow at all
    this.drawn = 0;
    const bySp = new Map(species.map((sp) => [sp, []]));
    for (const p of plants) bySp.get(p.sp).push(p);
    for (const [sp, list] of bySp) {
      if (!list.length) continue;
      yield;
      const n = list.length, M = new Float32Array(n * 16), C = new Float32Array(n * 3), cells = new Map();
      list.forEach((p, i) => {
        const k = p.height / sp.h;
        _e.set(p.tiltX, p.yaw, p.tiltZ, 'YXZ');
        _m.compose(_p.set(p.x, p.y - 0.04 * k, p.z), _q.setFromEuler(_e), _s.set(k * (0.92 + 0.16 * ((i * 0.618) % 1)), k, k * (0.92 + 0.16 * ((i * 0.382) % 1))));
        _m.toArray(M, i * 16);
        const v = 0.9 + 0.1 * ((i * 0.7548) % 1);   // a touch lighter or darker, plant to plant
        C[i * 3] = C[i * 3 + 1] = C[i * 3 + 2] = v;
        const key = `${Math.floor(p.x / FLORA_CELL)},${Math.floor(p.z / FLORA_CELL)}`;
        let cell = cells.get(key);
        if (!cell) cells.set(key, (cell = { ids: [], min: new THREE.Vector3(Infinity, Infinity, Infinity), max: new THREE.Vector3(-Infinity, -Infinity, -Infinity) }));
        cell.ids.push(i);
        cell.min.min(_p.set(p.x, p.y, p.z));
        cell.max.max(_p.set(p.x, p.y + p.height, p.z));
      });
      for (const cell of cells.values()) {
        cell.c = cell.min.clone().add(cell.max).multiplyScalar(0.5);
        cell.r = cell.min.distanceTo(cell.max) / 2 + sp.size[1] * 0.6;   // (a plant leans out of its cell)
      }
      const mesh = new THREE.InstancedMesh(sp.geo, sp.mat, n);
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3).setUsage(THREE.DynamicDrawUsage);
      mesh.count = 0;
      mesh.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, -1e5, 0), 0);
      mesh.frustumCulled = true;
      mesh.matrixAutoUpdate = false;
      Object.assign(mesh.userData, { noCollide: true, dynamic: true, flora: sp.id });
      mesh.name = sp.id;
      this.root.add(mesh);
      const set = { sp, mesh, M, C, cells: [...cells.values()], far: farFor((sp.size[0] + sp.size[1]) / 2, sp.large), behind: sp.large ? 110 : 40, key: '', lod: null };
      this.sets.push(set);
      // the far copy: at most 55 % of the triangles, from detail no bigger than a twelfth of the plant
      yield;
      const lv = farLevel(sp.geo, { maxCell: Math.max(sp.size[0], sp.size[1]) / 12 });
      if (lv) {
        const far = new THREE.InstancedMesh(lv.geometry, sp.mat, n);
        far.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        far.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3).setUsage(THREE.DynamicDrawUsage);
        Object.assign(far, { count: 0, frustumCulled: true, matrixAutoUpdate: false, name: `${sp.id} far`, boundingSphere: new THREE.Sphere(new THREE.Vector3(0, -1e5, 0), 0) });
        Object.assign(far.userData, { noCollide: true, dynamic: true, flora: sp.id });
        this.root.add(far);
        let k = 0;
        for (const p of list) k = Math.max(k, p.height / sp.h);
        set.lod = { mesh: far, cell: lv.cell * k * 1.08 };   // (the widest plant's cell, in metres)
      }
      for (const m of set.lod ? [mesh, set.lod.mesh] : [mesh]) {
        if (!sp.large) this.small.push(m);
        if (sp.shadow === false) this.noShadow.push(m);
      }
    }
    // collision: a cylinder round each large plant's trunk (small ones you walk through);
    // spiny ones (sp.hurts) prick you if you brush them or try to climb them (src/hazards.js)
    yield;
    const cols = [];
    this.hazards = [];
    for (const p of plants) {
      if (!p.sp.large) continue;
      const k = p.height / p.sp.h, [r, h] = p.sp.collide;
      cols.push(new THREE.CylinderGeometry(r * k, r * k * 1.1, h * k, 7, 1).translate(p.x, p.y + (h * k) / 2 - 0.3, p.z));
      if (p.sp.hurts) this.hazards.push(registerHazard(cylinderHazard({ kind: p.sp.hurts, x: p.x, z: p.z, y0: p.y - 0.3, y1: p.y + h * k * 1.1, r: r * k * 1.1 + 0.55, dps: HAZARD_DPS.spikes })));
    }
    this.collider = null;
    if (cols.length) {
      this.collider = new THREE.Mesh(mergeGeometries(cols.map((g) => g.toNonIndexed())), new THREE.MeshBasicMaterial());
      this.collider.visible = false;
      this.collider.name = 'flora collision';
    }
  }

  get count() { return this.plants.length; }
  get largeCount() { return this.plants.filter((p) => p.sp.large).length; }
  get meshes() { return this.sets.flatMap((s) => (s.lod ? [s.mesh, s.lod.mesh] : [s.mesh])); }

  /**
   * Once a frame before rendering: each species draws its cells in view within its distance
   * (× k, the preset's floraFar) and those just behind you (for their shadows). A mesh is only
   * rewritten when its set of cells changes. lod: { pxPerRad, px } puts the cells far enough
   * into the far copy (px = 0 or no lod: everything at full detail).
   */
  update(camera, k = 1, lod = null) {
    _pm.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    _fr.setFromProjectionMatrix(_pm);
    const cam = camera.position;
    let drawn = 0;
    for (const set of this.sets) {
      const far = set.far * k, behind = Math.min(set.behind, far), live = [];
      const dLod = set.lod && lod?.px > 0 ? (set.lod.cell * lod.pxPerRad) / lod.px : Infinity;
      for (const cell of set.cells) {
        const d = cam.distanceTo(cell.c) - cell.r;
        if (d > far || (d > behind && !_fr.intersectsSphere(_sph.set(cell.c, cell.r)))) continue;
        cell.lod = dLod < far && farSide(cell.lod, d, dLod);
        live.push(cell);
      }
      let key = `${live.length}`;
      for (const cell of live) key += cell.lod ? `,f${cell.ids[0]}` : `,${cell.ids[0]}`;
      if (key !== set.key) {
        if (set.lod) { this.fill(set.lod.mesh, set, live.filter((c) => c.lod)); live.splice(0, live.length, ...live.filter((c) => !c.lod)); }
        this.fill(set.mesh, set, live);
        set.key = key;
      }
      drawn += set.mesh.count + (set.lod?.mesh.count ?? 0);
    }
    this.drawn = drawn;
    return drawn;
  }

  fill(mesh, set, live) {
    const { M, C } = set, IM = mesh.instanceMatrix.array, IC = mesh.instanceColor.array;
    let n = 0;
    _box.makeEmpty();
    for (const cell of live) {
      for (const i of cell.ids) {
        IM.set(M.subarray(i * 16, i * 16 + 16), n * 16);
        IC.set(C.subarray(i * 3, i * 3 + 3), n * 3);
        n++;
      }
      _box.expandByPoint(_p.copy(cell.c).addScalar(cell.r)).expandByPoint(_p.copy(cell.c).addScalar(-cell.r));
    }
    mesh.count = n;
    if (n) _box.getBoundingSphere(mesh.boundingSphere);
    else mesh.boundingSphere.set(_p.set(0, -1e5, 0), 0);
    for (const a of [mesh.instanceMatrix, mesh.instanceColor]) { a.clearUpdateRanges(); a.addUpdateRange(0, n * a.itemSize); a.needsUpdate = true; }
  }
}
