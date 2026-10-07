import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { mulberry32 } from '../noise.js';
import { makeMaterial, MODE_STRATA } from '../materials.js';
import { Taxi } from '../taxi.js';
import { dropBuriedInstances, dropBuriedInstancesSteps } from '../physics.js';
import { soften } from '../world.js';
import { Paint, paintMaterial } from '../vehicle-kit.js';
import { Banner, Puffs } from '../life.js';
import { buildRoom } from '../interiors.js';
import { glyphGeometry, textGeometry } from '../story/sign-text.js';
import { LINES } from '../story/incal-data.js';
import { attachTemple } from '../temples/index.js';
import { stepped, runSteps } from '../load-steps.js';

// ---------------------------------------------------------------------------
// The City-Shaft: a city stacked down a 600 m pit.
// An enormous vertical pit lined with terraces, the rich at the sunny top,
// the poor in the depths, an acid lake at the bottom, a central spire with
// rings and bridges, floating landing pads and flying taxis on circular lanes.
// Traverse it with the jetpack.
// ---------------------------------------------------------------------------

const R = 260;          // shaft radius
/** Down the shaft the town fades into a pale blue haze (post.js 4b): a fog thickening under the shaft's middle (0 m). */
export const SHAFT_FOG = { uHeightFog: [0, 120, 0.002, 0.7], uHeightFogTone: [0.74, 0.83, 0.88, 0.9] };
const TOP = 200;        // rim / surface level
const BOTTOM = -380;    // acid lake
const LEVELS = [150, 92, 36, -24, -86, -150, -218, -290];
const SPIRE_R = 24;
/** The makers' pillar on the rim (the jets' box sits on it): its angle round the shaft, radius and height (m). */
export const PILLAR = { a: 0.45, r: 286, h: 14 };
const SPIRE_RING = 48;
// the story's corners (src/story/incal.js): the Upward Shrine and the call-lamp on the bottom
// terrace (world angles), Nima's corner a little way along the high terrace
const SHRINE_A = 3.155, LAMP_A = 3.2, NIMA_DA = 0.045;
// the old goods hoist on the bottom terrace, a little way past Pip (quest incal.ration): its angle, and how far it stands in from the edge
export const HOIST = { a: SHRINE_A - 0.075, inset: 1.3, reach: 4.0, height: 4.8 };

// ---------------------------------------------------------------------------
// The cabs' stops (src/taxi.js, src/story/cab.js): cabs drive themselves, and take you to these.
// Each hovers out over the void beside its terrace (at), turned along the wall; you step out onto
// the terrace (step). Only a cab that goes below the smog (Wren) stops at the bottom (depths).
const P3c = (a, r, y) => new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r);
const along = (a) => Math.atan2(-Math.sin(a), Math.cos(a));   // the heading along the wall at angle a
/** The stops, from the story's places and the terraces. */
export function shaftCabStops(places, terraces) {
  const top = terraces.find((t) => t.y === LEVELS[0]), mid = terraces.find((t) => t.y === LEVELS[3]);
  const nimaA = top.a0 + NIMA_DA + 0.035, midA = (mid.a0 + mid.a1) / 2;
  const P = places.palace;
  return [
    { id: 'rim', name: 'The rim, by the ship', at: P3c(0, R - 9, TOP + 2.4), heading: along(0), step: P3c(0, R + 3, TOP) },
    { id: 'terrace', name: 'The high terrace', at: P3c(nimaA, top.r0 - 6.5, top.y + 2.4), heading: along(nimaA), step: P3c(nimaA, top.r0 + 4, top.y) },
    { id: 'middle', name: 'The middle levels', at: P3c(midA, mid.r0 - 6.5, mid.y + 2.4), heading: along(midA), step: P3c(midA, mid.r0 + 4, mid.y) },
    { id: 'palace', name: 'The palace gate', at: P.taxi.clone(), heading: along(0), step: P3c(-0.035, 48.5, P.y) },
    { id: 'bottom', name: 'The bottom terrace, by the call-lamp', at: places.cab.clone(), heading: Math.atan2(places.lamp.x - places.cab.x, places.lamp.z - places.cab.z) + Math.PI / 2, step: places.wren.clone(), depths: true },
  ];
}
/**
 * The ways round the shaft a cab tries (src/taxi.js planRoute takes the first that is clear): out
 * from the wall to a ring of open air (rf), up or down it, round it, and in to the stop; climbing
 * first or going round first, at a few rings and a few heights between the levels' bridges.
 */
export function shaftRoutes(from, stop) {
  const cyl = (p) => ({ a: Math.atan2(p.z, p.x), y: p.y });
  const A = cyl(from), B = cyl(stop.at), list = [];
  const arc = (rf, y, a0, a1) => {
    const d = Math.atan2(Math.sin(a1 - a0), Math.cos(a1 - a0)), n = Math.max(1, Math.ceil(Math.abs(d) / 0.3));
    return Array.from({ length: n }, (_, i) => P3c(a0 + d * (i + 1) / n, rf, y));
  };
  const lo = BOTTOM + 40, hi = TOP + 160, clampY = (y) => Math.min(hi, Math.max(lo, y));
  for (const rf of [150, 120, 172, 95]) {
    const out = P3c(A.a, rf, A.y), inn = P3c(B.a, rf, B.y);
    list.push([from.clone(), out, P3c(A.a, rf, B.y), ...arc(rf, B.y, A.a, B.a), stop.at.clone()]);   // up or down first, then round
    list.push([from.clone(), out, ...arc(rf, A.y, A.a, B.a), inn, stop.at.clone()]);                 // round first, then up or down
    for (const y of [B.y + 26, B.y - 26, A.y + 26, A.y - 26].map(clampY)) {                           // round at a height between the bridges
      list.push([from.clone(), out, P3c(A.a, rf, y), ...arc(rf, y, A.a, B.a), inn, stop.at.clone()]);
    }
  }
  return list;
}

/**
 * The red stair, the way down on foot from the rim to the high terrace where Nima sweeps (the drone's
 * first find): it leaves the rim through a gap in the parapet near the makers' pillar (`top`, an angle
 * round the shaft), runs down along the shaft's wall in `flights` with landings between (each `landing`
 * m long; steps `rise` m high, `width` m wide), and comes out on a steel landing along the terrace's end
 * (`gangway` rad wide). No house is kept within `lane` m of the terrace's end, so the way to Nima is open.
 */
export const STAIR = { top: 0.5105, width: 4, flights: 5, landing: 3.5, topLanding: 4.5, rise: 0.25, gangway: 0.032, lane: 9 };

const TAU = Math.PI * 2;

// Annular sector slab, top face at y = 0, thickness t (world angle = atan2(z, x)).
export function sectorGeometry(r0, r1, a0, a1, t) {
  const shape = new THREE.Shape();
  shape.moveTo(Math.cos(a0) * r1, Math.sin(a0) * r1);
  shape.absarc(0, 0, r1, a0, a1, false);
  shape.lineTo(Math.cos(a1) * r0, Math.sin(a1) * r0);
  shape.absarc(0, 0, r0, a1, a0, true);
  const g = new THREE.ExtrudeGeometry(shape, { depth: t, bevelEnabled: false, curveSegments: Math.max(8, Math.ceil((a1 - a0) * 18)) });
  g.rotateX(Math.PI / 2); // shape (x, y) -> world (x, z); extrusion goes downward
  return g;
}

// a Mediterranean hill-town on blue-grey viaducts (after the reference plate)
// (the reference sheets' canyon is pink and cream: half the walls pink, from pale to deep)
export const PASTELS = ['#f1e6cf', '#eaa58e', '#f3ead8', '#efb7a2', '#efe2c8', '#e0937c'];   // cream and pink walls
export const RUST = ['#d9a998', '#cdb38e', '#e2b9a6', '#c9b596', '#d39c8a'];               // warmer, dustier lower down
export const ROOFS = ['#d9784f', '#c8673f', '#e08a5c', '#b9603e'];                         // terracotta
export const STEEL = { color: '#9fb2c6', color2: '#8aa0b8', color3: '#b3c3d3' };            // blue-grey structure

// (built in steps, src/load-steps.js: the game's load gives the main thread back between them)
export function* buildIncal(scene) {
  const rng = mulberry32(1977);
  const pick = (a) => a[Math.floor(rng() * a.length)];
  const movers = [];
  const lod = [];      // { obj, y, far }: hidden when the camera is that far above / below
  const small = [];    // left out of the far shadow cascade
  const banners = [];

  const strata = (c1, c2, c3, size = 6, extra = {}) =>
    makeMaterial({ color: c1, color2: c2, color3: c3, mode: MODE_STRATA, strataSize: size, ...extra });

  // merged geometry buckets (one draw per material, keeps the town cheap)
  // buckets are also split by terrace sector (curGroup), so each piece can be culled
  const buckets = new Map();
  let curGroup = 'misc', curY = TOP;
  let skip = false;            // a house in one of the story's clearings: built (same random draws) but not kept
  const clearZones = [];
  const clearEnds = [];   // { y, a, w }: no house within w m of a terrace's end at angle a (the red stair's landing, STAIR)
  const fromEnd = (x, z, a) => (((Math.atan2(z, x) - a) % TAU + TAU + Math.PI) % TAU - Math.PI) * Math.hypot(x, z);
  const nearClear = (x, y, z) => clearZones.some((c) => Math.abs(c.y - y) < 1 && Math.hypot(c.x - x, c.z - z) < c.r)
    || clearEnds.some((c) => Math.abs(c.y - y) < 1 && Math.abs(fromEnd(x, z, c.a) - c.w / 2) < c.w / 2 + 2);
  const bucket = (key, mat) => {
    if (skip) return [];
    const k = key + '@' + curGroup;
    if (!buckets.has(k)) buckets.set(k, { mat, geos: [], y: curY });
    return buckets.get(k).geos;
  };
  const placed = (g, x, y, z, rot = 0) => g.rotateY(rot).translate(x, y, z);
  const wallMat = (i) => strata(PASTELS[i % PASTELS.length], PASTELS[(i + 2) % PASTELS.length], '#f6efe0', 3.2, { pattern: 'facade', flat: true, windows: 0.5 });   // (fewer windows, as the plates)
  const roofMat = (i) => makeMaterial({ color: ROOFS[i % ROOFS.length], flat: true, pattern: 'tiles' });
  const ironMat = makeMaterial({ color: '#34405e', flat: true, metal: 'iron' });
  const doorMat = makeMaterial({ color: '#5a3a2c', flat: true });
  // the houses' small work (the reference sheets: pipes down the walls, washing on the balconies, the
  // plating under the terraces) draws from its own numbers, so the town's layout keeps its own, and
  // goes into the iron and the stalls' cloth buckets: no draws of its own
  const work = mulberry32(19772);
  const WASH = ['#c8483a', '#f2c54b', '#5fb7ad', '#e6875f'];
  const washMat = WASH.map((c) => makeMaterial({ color: c, side: THREE.DoubleSide }));   // (the same as the stalls' awnings: their buckets)

  /** A villa: block walls with a window grid, a hipped roof, a dome on a drum, or a roof garden. */
  function house(x, y, z) {
    const w = 5 + rng() * 6, d = 5 + rng() * 6, h = 5 + rng() * 9, rot = rng() * TAU, wi = Math.floor(rng() * 6), ri = Math.floor(rng() * 4);
    bucket('wall' + wi, wallMat(wi)).push(placed(new THREE.BoxGeometry(w, h, d).translate(0, h / 2, 0), x, y, z, rot));
    const kind = rng();
    if (kind < 0.5) {
      const roof = new THREE.ConeGeometry(Math.hypot(w, d) * 0.56, 2.2 + rng() * 2, 4, 1).rotateY(Math.PI / 4);
      roof.scale(w / Math.max(w, d), 1, d / Math.max(w, d));
      bucket('roof' + ri, roofMat(ri)).push(placed(roof.translate(0, h + 1.1, 0), x, y, z, rot));
    } else if (kind < 0.78) {
      const r = Math.min(w, d) * 0.36;
      bucket('wall' + wi, wallMat(wi)).push(placed(new THREE.CylinderGeometry(r, r, 2, 12).translate(0, h + 1, 0), x, y, z, rot));
      bucket('roof' + ri, roofMat(ri)).push(placed(new THREE.SphereGeometry(r * 1.05, 14, 8, 0, TAU, 0, Math.PI / 2).translate(0, h + 2, 0), x, y, z, rot));
    } else {
      bucket('wall' + wi, wallMat(wi)).push(placed(new THREE.BoxGeometry(w + 0.4, 0.9, d + 0.4).translate(0, h + 0.45, 0), x, y, z, rot));
      trees.push([x, y + h + 0.9, z, skip ? 0 : 0.6]);    // a little roof garden
    }
    // silhouette details: an arched door, a balcony, a chimney
    const face = rng() < 0.5 ? 1 : -1;
    bucket('door', doorMat).push(placed(new THREE.BoxGeometry(1.3, 2.2, 0.2).translate(0, 1.1, face * d / 2), x, y, z, rot));
    bucket('door', doorMat).push(placed(new THREE.CylinderGeometry(0.65, 0.65, 0.2, 10, 1, false, 0, Math.PI).rotateX(Math.PI / 2).rotateZ(Math.PI / 2).translate(0, 2.2, face * d / 2), x, y, z, rot));
    if (h > 7 && rng() < 0.6) {
      const by = 3.3 * Math.max(1, Math.floor(rng() * (h / 3.3 - 1))), bw = 2 + rng() * 2;
      const bx = (rng() - 0.5) * (w - bw - 0.6);
      bucket('wall' + wi, wallMat(wi)).push(placed(new THREE.BoxGeometry(bw, 0.2, 1.1).translate(bx, by, -face * (d / 2 + 0.55)), x, y, z, rot));
      bucket('iron', ironMat).push(placed(new THREE.BoxGeometry(bw, 0.06, 0.06).translate(bx, by + 0.95, -face * (d / 2 + 1.07)), x, y, z, rot));
      for (let k = 0; k <= Math.round(bw / 0.35); k++)
        bucket('iron', ironMat).push(placed(new THREE.BoxGeometry(0.04, 0.9, 0.04).translate(bx - bw / 2 + k * 0.35, by + 0.5, -face * (d / 2 + 1.07)), x, y, z, rot));
      if (work() < 0.6 && curGroup !== 'misc') for (let u = -bw / 2 + 0.3; u < bw / 2 - 0.2; u += 0.45 + work() * 0.3) {   // washing hung over the rail (not on the viaducts: no awnings there to share a draw with)
        const ci = Math.floor(work() * WASH.length), cw = 0.35 + work() * 0.3, ch = 0.5 + work() * 0.6;
        bucket('awn' + ci, washMat[ci]).push(placed(new THREE.PlaneGeometry(cw, ch).translate(bx + u, by + 0.95 - ch / 2, -face * (d / 2 + 1.12)), x, y, z, rot));
      }
    }
    if (work() < 0.28) {   // a drainpipe down a corner of the door's face, now and then a gutter along its top
      const px = (work() < 0.5 ? -1 : 1) * (w / 2 - 0.35);
      bucket('iron', ironMat).push(placed(new THREE.BoxGeometry(0.26, h, 0.26).translate(px, h / 2, face * (d / 2 + 0.13)), x, y, z, rot));
      if (work() < 0.3) bucket('iron', ironMat).push(placed(new THREE.BoxGeometry(w * 0.9, 0.22, 0.3).translate(0, h - 0.25, face * (d / 2 + 0.15)), x, y, z, rot));
    }
    if (kind < 0.5 && rng() < 0.55) {
      const cx = (rng() - 0.5) * w * 0.5, cz = (rng() - 0.5) * d * 0.5;
      bucket('wall' + wi, wallMat(wi)).push(placed(new THREE.BoxGeometry(0.7, 3.2, 0.7).translate(cx, h + 1.6, cz), x, y, z, rot));
      bucket('roof' + ri, roofMat(ri)).push(placed(new THREE.BoxGeometry(1.0, 0.25, 1.0).translate(cx, h + 3.3, cz), x, y, z, rot));
    }
  }
  const trees = [];   // [x, y, z, scale, group]
  const _push = trees.push.bind(trees);
  trees.push = (t) => _push([...t, curGroup, curY]);

  // ---------------------------------------------------------- the shaft wall
  yield;
  {
    const h = TOP - BOTTOM + 5;   // ends exactly at the rim so you can walk off the edge
    const g = new THREE.CylinderGeometry(R, R, h, 128, 1, true);
    g.translate(0, BOTTOM - 5 + h / 2, 0);
    const wall = new THREE.Mesh(g, makeMaterial({
      color: '#e6d6b8', color2: '#d9c7a6', color3: '#b3c3d3', mode: MODE_STRATA, strataSize: 9,
      grid: 4, side: THREE.BackSide,
    }));
    scene.add(wall);
  }

  // ---------------------------------------------------------- the surface around the rim
  yield;
  {
    const g = new THREE.RingGeometry(R, 2600, 160, 1);
    g.rotateX(-Math.PI / 2);
    const plain = new THREE.Mesh(g, makeMaterial({ color: '#e9dcc2', grid: 3 }));
    plain.position.y = TOP;
    scene.add(plain);
    // a low parapet with gaps around the rim
    for (let i = 0; i < 24; i++) {
      if (i % 4 === 0) continue;
      const a0 = (i / 24) * TAU, a1 = a0 + TAU / 24 * 0.9;
      const p = new THREE.Mesh(sectorGeometry(R, R + 2.5, a0, a1, 1.6), makeMaterial({ color: '#f3ead8', flat: true }));
      p.position.y = TOP + 1.6;
      scene.add(p);
    }
  }

  // ---------------------------------------------------------- towers
  function tower(x, z, baseY, height, radius, palette, opts = {}) {
    const parts = [];
    const segs = 6 + Math.floor(rng() * 3) * 2;
    let y = 0, r = radius;
    const tiers = 1 + Math.floor(rng() * 3);
    for (let t = 0; t < tiers; t++) {
      const th = (height / tiers) * (0.8 + rng() * 0.4);
      const g = soften(new THREE.CylinderGeometry(r * (0.85 + rng() * 0.15), r, th, segs, 4), 0.07);
      g.translate(0, y + th / 2, 0);
      parts.push(g);
      y += th;
      if (rng() < 0.5) { // a balcony ring
        const ring = new THREE.CylinderGeometry(r * 1.25, r * 1.25, 0.8, segs);
        ring.translate(0, y - th * 0.35, 0);
        parts.push(ring);
      }
      r *= 0.65 + rng() * 0.2;
    }
    const top = rng();
    if (opts.roof) {
      const ri = Math.floor(rng() * 4);
      bucket('roof' + ri, roofMat(ri)).push(new THREE.SphereGeometry(r * 1.25, 14, 8, 0, TAU, 0, Math.PI / 2).scale(1, 1.3, 1).translate(x, baseY + y, z));
    } else if (top < 0.35 && !opts.flatTop) {
      const dome = new THREE.SphereGeometry(r * 1.2, 14, 7, 0, TAU, 0, Math.PI / 2);
      dome.translate(0, y, 0);
      parts.push(dome);
    } else if (top < 0.6 && !opts.flatTop) {
      const bulb = new THREE.SphereGeometry(r * 1.6, 12, 8);
      bulb.scale(1, 0.75, 1);
      bulb.translate(0, y + r * 0.9, 0);
      parts.push(bulb, new THREE.CylinderGeometry(0.3, 0.3, r * 4, 4).translate(0, y + r * 2.5, 0));
    }
    const mat = strata(pick(palette), pick(palette), pick(palette), 2.5 + rng() * 3, { grid: 2.5 + rng() * 2, flat: segs <= 8 });
    const m = new THREE.Mesh(mergeGeometries(parts), mat);
    m.position.set(x, baseY, z);
    m.rotation.y = rng() * TAU;
    if (!skip) scene.add(m);
    return baseY + y;
  }

  // ---------------------------------------------------------- terraces
  yield;
  const terraces = [];
  const rails = new Map();   // terrace:eighth -> the railing's segments
  for (const [li, y] of LEVELS.entries()) {
    yield;
    const depth = li / (LEVELS.length - 1);              // 0 = top, 1 = bottom
    const width = 46 + rng() * 20;
    const r0 = R - width;
    const palette = depth < 0.45 ? PASTELS : RUST;
    const nSectors = 2 + Math.floor(rng() * 2);
    let a = rng() * TAU;
    const gap = 0.18 + rng() * 0.15;
    for (let s = 0; s < nSectors; s++) {
      const span = TAU / nSectors - gap;
      const a0 = a, a1 = a + span;
      if (s === 0 && li === 0) clearZones.push({ x: Math.cos(a0 + NIMA_DA) * (r0 + 6), y, z: Math.sin(a0 + NIMA_DA) * (r0 + 6), r: 9 });
      if (s === 0 && li === 0) clearEnds.push({ y, a: a0, w: STAIR.lane });
      if (s === 0 && li === LEVELS.length - 1) clearZones.push({ x: Math.cos(SHRINE_A) * (r0 + 8), y, z: Math.sin(SHRINE_A) * (r0 + 8), r: 12.5 });
      curGroup = `t${li}`; curY = y;
      const slab = new THREE.Mesh(sectorGeometry(r0, R, a0, a1, 7),
        strata(STEEL.color, STEEL.color2, STEEL.color3, 1.4, { flat: true, grid: 3 }));
      slab.position.y = y;
      scene.add(slab);
      terraces.push({ y, r0, a0, a1, width });
      // the plating under the overhang (the sheets' blue undersides): ribs out to the edge, boxes and
      // machinery hung under the slab, pipes slung along it
      {
        const under = y - 7, step = 20 / R;
        for (let b = a0 + step / 2; b < a1; b += step)
          bucket('iron', ironMat).push(placed(new THREE.BoxGeometry(R - r0 - 1, 1.1, 0.7).translate((R + r0) / 2, under - 0.55, 0), 0, 0, 0, -b));
        for (let k = 0; k < span * 8; k++) {
          const b = a0 + work() * span, rr = r0 + 3 + work() * (R - r0 - 6), sz = 1.2 + work() * 2.6;
          bucket('iron', ironMat).push(placed(new THREE.BoxGeometry(sz, sz * (0.4 + work() * 0.6), sz * (0.6 + work() * 0.8)).translate(rr, under - sz * 0.3, 0), 0, 0, 0, -b));
        }
        {
          const rr = r0 + 6 + work() * 12, pts = [];
          for (let k = 0; k <= 12; k++) { const b = a0 + 0.01 + (span - 0.02) * (k / 12); pts.push(new THREE.Vector3(Math.cos(b) * rr, under - 1.6, Math.sin(b) * rr)); }
          bucket('iron', ironMat).push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 28, 0.6, 4));
        }
      }

      // laundry and banners hanging off the edge
      for (let k = 0; k < Math.floor(span * 3); k++) {
        if (rng() < 0.4) continue;
        const ang = a0 + rng() * span, rr = r0 + 0.3;
        banners.push(new Banner(scene, new THREE.Vector3(Math.cos(ang) * rr, y - 5, Math.sin(ang) * rr), -ang + Math.PI / 2,
          { width: 2 + rng() * 3, height: 5 + rng() * 9, color: pick(depth < 0.45 ? PASTELS : RUST) }));
      }

      // railing along the inner edge, with openings
      const steps = Math.ceil(span * 6);
      for (let k = 0; k < steps; k++) {
        if (rng() < 0.3) continue;
        const b0 = a0 + (k / steps) * span, b1 = b0 + span / steps * 0.85;
        // (gathered by terrace and eighth of the ring, one mesh each, below: a mesh a segment was some 160
        //  draws in a view across the shaft, twice with the shadows, docs/systems/performance.md)
        const eighth = Math.floor((((b0 % TAU) + TAU) % TAU) / (TAU / 8)), key = `${li}:${eighth}`;
        if (!rails.has(key)) rails.set(key, []);
        rails.get(key).push(sectorGeometry(r0, r0 + 0.6, b0, b1, 1.2).translate(0, y + 1.2, 0));
      }

      // buildings on the terrace, below the next terrace up
      const above = li === 0 ? TOP + 60 : LEVELS[li - 1];
      const maxH = Math.max(above - y - 9, 10);
      // a packed hill-town: villas in rows, a few domed towers, cypresses and olive trees between
      const count = Math.floor(span * 130);
      for (let k = 0; k < count; k++) {
        const ang = a0 + (k + 0.5 + (rng() - 0.5) * 0.5) / count * span;
        const rad = r0 + 13 + rng() * (width - 19);   // leaves a promenade along the edge
        const x = Math.cos(ang) * rad, z = Math.sin(ang) * rad;
        const roll = rng();
        skip = nearClear(x, y, z);
        if (roll < 0.52) house(x, y, z);
        else if (roll < 0.57) tower(x, z, y, maxH * (0.45 + rng() * 0.5), 3 + rng() * 4, palette, { roof: true });
        else {   // trees grow in clumps
          const n = 1 + Math.floor(rng() * 4);
          for (let q = 0; q < n; q++) trees.push([x + (rng() - 0.5) * 6, y, z + (rng() - 0.5) * 6, 0.7 + rng() * 0.9]);
        }
        skip = false;
      }
      // a row of cypresses along the terrace edge, like a garden balustrade
      for (let k = 0; k < span * 60; k++) {
        if (rng() < 0.35) continue;
        const ang = a0 + (k / (span * 60)) * span, rad = r0 + 2.5 + rng() * 1.5;
        trees.push([Math.cos(ang) * rad, y, Math.sin(ang) * rad, 0.75 + rng() * 0.5]);
      }
    }
    a += TAU / nSectors;
  }
  // the railings, one mesh for each terrace's eighth of the ring (the same segments, the same iron)
  for (const geos of rails.values()) scene.add(new THREE.Mesh(mergeGeometries(geos), makeMaterial({ color: '#34405e', flat: true, metal: 'iron' })));

  curGroup = 'misc'; curY = TOP;
  const bridges = [];   // spire ring → terrace: { y, phi, r0 } (for the story's routes)
  // ---------------------------------------------------------- central spire
  yield;
  {
    const height = TOP + 120 - BOTTOM;
    const g = new THREE.CylinderGeometry(SPIRE_R * 0.8, SPIRE_R, height, 16);
    g.translate(0, BOTTOM + height / 2, 0);
    scene.add(new THREE.Mesh(g, strata('#f1e6cf', '#9fb2c6', '#e6cfae', 5, { grid: 4 })));
    // golden palace on top
    const palace = mergeGeometries([
      new THREE.SphereGeometry(34, 24, 12, 0, TAU, 0, Math.PI / 2).translate(0, 0, 0),
      new THREE.CylinderGeometry(36, 36, 3, 24).translate(0, -1.5, 0),
      new THREE.CylinderGeometry(1.2, 1.2, 70, 6).translate(0, 55, 0),
      new THREE.SphereGeometry(4, 12, 8).translate(0, 92, 0),
    ]);
    const pm = new THREE.Mesh(palace, makeMaterial({ color: '#f2c54b', grid: 5, metal: 'brass', refl: 0.55 }));
    pm.position.y = TOP + 120;
    scene.add(pm);
    for (let i = 0; i < 3; i++) { // orbiting rings around the needle
      const ring = new THREE.Mesh(new THREE.TorusGeometry(14 - i * 3, 0.6, 6, 40), makeMaterial({ color: '#62c3c9' }));
      ring.position.y = TOP + 120 + 50 + i * 12;
      ring.rotation.x = Math.PI / 2;
      ring.userData.noCollide = true; // moving
      scene.add(ring);
      movers.push({ obj: ring, update: (t) => { ring.rotation.y = t * (0.3 + i * 0.2); ring.rotation.x = Math.PI / 2 + Math.sin(t * 0.4 + i) * 0.3; } });
    }

    // rings around the spire at each level + bridges to the terraces
    LEVELS.forEach((y) => {
      const ring = new THREE.Mesh(sectorGeometry(SPIRE_R, SPIRE_RING, 0, TAU, 4), strata(STEEL.color, STEEL.color2, '#f1e6cf', 1.5, { flat: true, grid: 3 }));
      ring.position.y = y;
      scene.add(ring);
      const level = terraces.filter((t) => t.y === y);
      const nb = 2 + Math.floor(rng() * 2);
      for (let b = 0; b < nb; b++) {
        const t = level[b % level.length];
        const phi = t.a0 + (0.15 + rng() * 0.7) * (t.a1 - t.a0);
        const len = t.r0 - SPIRE_RING + 2;
        const mid = SPIRE_RING - 1 + len / 2;
        const g = new THREE.BoxGeometry(len, 2.5, 7);
        const m = new THREE.Mesh(g, strata(STEEL.color, STEEL.color2, STEEL.color3, 1.4, { flat: true, grid: 3.5 }));
        m.position.set(Math.cos(phi) * mid, y - 1.25, Math.sin(phi) * mid);
        m.rotation.y = -phi;
        scene.add(m);
        bridges.push({ y, phi, r0: t.r0 });
      }
    });
  }

  // ---------------------------------------------------------- floating landing pads
  yield;
  for (let i = 0; i < 34; i++) {
    yield;
    const a = rng() * TAU, rad = 70 + rng() * 115;
    const y = BOTTOM + 60 + rng() * (TOP - BOTTOM - 50);
    const r = 5 + rng() * 5;
    const g = mergeGeometries([
      new THREE.CylinderGeometry(r, r * 0.85, 1.6, 14).translate(0, -0.8, 0),
      new THREE.ConeGeometry(r * 0.6, r * 1.2, 10).rotateX(Math.PI).translate(0, -1.6 - r * 0.6, 0),
    ]);
    const m = new THREE.Mesh(g, makeMaterial({ color: pick(PASTELS), flat: true, grid: 2 }));
    m.position.set(Math.cos(a) * rad, y, Math.sin(a) * rad);
    m.userData.floats = true;   // (the clipping audit: meant to hang in the air)
    scene.add(m);
  }

  // ---------------------------------------------------------- cables across the shaft
  yield;
  const cableMat = makeMaterial({ color: '#8aa0b8' });
  yield;
  for (let i = 0; i < 26; i++) {
    yield;
    const a = rng() * TAU, b = a + Math.PI * (0.5 + rng());
    const y = BOTTOM + 40 + rng() * (TOP - BOTTOM - 40);
    const p0 = new THREE.Vector3(Math.cos(a) * R, y, Math.sin(a) * R);
    const p1 = new THREE.Vector3(Math.cos(b) * R, y + (rng() - 0.5) * 40, Math.sin(b) * R);
    const mid = p0.clone().lerp(p1, 0.5);
    mid.y -= 20 + rng() * 40;
    const curve = new THREE.QuadraticBezierCurve3(p0, mid, p1);
    scene.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 40, 0.25, 5), cableMat));
  }

  // ---------------------------------------------------------- billboards on the wall
  yield;
  const billboards = [];   // { pos, quat, w, h }: the story writes on them once the light burns again
  yield;
  for (let i = 0; i < 40; i++) {
    yield;
    const a = rng() * TAU, y = BOTTOM + 30 + rng() * (TOP - BOTTOM - 30);
    const m = new THREE.Mesh(new THREE.BoxGeometry(14 + rng() * 10, 8 + rng() * 6, 0.8),
      makeMaterial({ color: pick(['#d9784f', '#9fb2c6', '#f2c54b']), flat: true, grid: 2.2 }));   // (bills, not the makers' carving: no inscriptions)
    m.position.set(Math.cos(a) * (R - 1.2), y, Math.sin(a) * (R - 1.2));
    m.lookAt(0, y, 0);
    scene.add(m);
    billboards.push({ pos: m.position.clone(), quat: m.quaternion.clone(), w: m.geometry.parameters.width, h: m.geometry.parameters.height });
  }

  // ---------------------------------------------------------- hero: the Lodestar
  // The light Lodestar and its dark twin, turning slowly high above the palace.
  // Its story (src/story/incal.js) drives `incalRig.k`: 0 dim and flickering
  // (it has been dimming since "the night the sky rang"), 1 burning bright;
  // `flare` is a passing flash. The glyph is cut into its four lower facets,
  // the ones the city sees from below.
  yield;
  const incalRig = { k: 0, flare: 0, pos: new THREE.Vector3(0, TOP + 250, 0) };
  yield;
  {
    const grp = new THREE.Group();
    grp.position.copy(incalRig.pos);
    grp.userData.noCollide = true;
    const lightMat = makeMaterial({ color: '#fff8e8', flat: true, glow: 1, key: 'incal.light' });
    const haloMat = makeMaterial({ color: '#f2c54b', glow: 1, key: 'incal.halo' });
    const light = new THREE.Mesh(new THREE.OctahedronGeometry(14, 0).scale(1, 1.3, 1), lightMat);
    const dark = new THREE.Mesh(new THREE.OctahedronGeometry(7, 0).scale(1, 1.3, 1), makeMaterial({ color: '#2b211f', flat: true }));
    const halo = new THREE.Mesh(new THREE.TorusGeometry(26, 0.5, 6, 64), haloMat);
    halo.rotation.x = Math.PI / 2;
    const halo2 = new THREE.Mesh(new THREE.TorusGeometry(34, 0.35, 6, 72), haloMat);
    halo2.visible = false;
    // the glyph on the lower facets: centred on each face, lying in its plane
    {
      const parts = [], n = new THREE.Vector3(), q = new THREE.Quaternion(), Z = new THREE.Vector3(0, 0, 1);
      for (const [sx, sz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
        n.set(sx / 14, -1 / 18.2, sz / 14).normalize();
        const c = new THREE.Vector3(sx * 14 / 3, -18.2 / 3, sz * 14 / 3).addScaledVector(n, 0.08);
        q.setFromUnitVectors(Z, n);
        // keep the arc's "down" toward the tip below
        const g = glyphGeometry(6.5, 0.12);
        const m = new THREE.Matrix4().compose(c, q, new THREE.Vector3(1, 1, 1));
        const up = new THREE.Vector3(0, 1, 0).applyQuaternion(q), want = new THREE.Vector3(0, 1, 0).projectOnPlane(n).normalize();
        const roll = Math.atan2(new THREE.Vector3().crossVectors(up, want).dot(n), up.dot(want));
        g.applyMatrix4(new THREE.Matrix4().makeRotationZ(roll)).applyMatrix4(m);
        parts.push(g);
      }
      light.add(new THREE.Mesh(mergeGeometries(parts), makeMaterial({ color: '#8a6a3a', flat: true, metal: 'brass' })));
    }
    grp.add(light, dark, halo, halo2);
    scene.add(grp);
    const dim = new THREE.Color('#b9b2a2'), bright = new THREE.Color('#fff8e8');
    const haloDim = new THREE.Color('#9c8a5e'), haloBright = new THREE.Color('#f2c54b');
    movers.push({ update: (t) => {
      const k = incalRig.k, f = incalRig.flare;
      light.rotation.y = t * (0.3 + 0.25 * k);
      dark.position.set(Math.cos(t * 0.5) * 32, Math.sin(t * 0.7) * 8, Math.sin(t * 0.5) * 32);
      dark.rotation.y = -t * 0.6;
      halo.rotation.z = t * 0.2;
      halo2.rotation.set(Math.PI / 2 + Math.sin(t * 0.3) * 0.5, 0, -t * 0.15);
      grp.position.y = incalRig.pos.y + Math.sin(t * 0.4) * 4;
      // dim: a tired, uneven glow that sometimes gutters; bright: steady, bigger, a second halo
      const gutter = k < 0.6 ? (1 - k) * Math.max(0, Math.sin(t * 2.3) * Math.sin(t * 0.71 + 1) - 0.55) * 1.6 : 0;
      lightMat.uniforms.uColor.value.copy(dim).lerp(bright, Math.min(1, k + f));
      lightMat.uniforms.uGlow.value = THREE.MathUtils.clamp(0.42 + 0.58 * k + f - gutter, 0, 1);
      haloMat.uniforms.uColor.value.copy(haloDim).lerp(haloBright, Math.min(1, k + f));
      haloMat.uniforms.uGlow.value = THREE.MathUtils.clamp(0.3 + 0.7 * k + f, 0, 1);
      light.scale.setScalar(0.9 + 0.22 * k + 0.12 * f + (k > 0.5 ? Math.sin(t * 1.1) * 0.015 : 0));
      halo.scale.setScalar(0.85 + 0.3 * k + 0.2 * f);
      halo2.visible = k > 0.3;
      halo2.scale.setScalar(0.6 + 0.4 * k);
    } });
  }

  // ---------------------------------------------------------- mist off the water
  yield;
  const steam = new Puffs(scene, {
    count: 70, color: '#d6ece6', glow: 0.25, rise: 4, life: 12, size: 10,   // (a pale mist off the water)
    area: (r) => { const a = r() * TAU, d = Math.sqrt(r()) * (R - 20); return new THREE.Vector3(Math.cos(a) * d, BOTTOM + 1, Math.sin(a) * d); },
  });

  // ---------------------------------------------------------- the lake
  yield;
  {
    // turquoise water, as the sheets have it far down the shaft (it was an acid-green lake). A flat
    // printed tone, not the water shader: its reflection pass cost the handheld ~2 ms a frame here
    const lake = new THREE.Mesh(new THREE.CylinderGeometry(R, R, 2, 96), makeMaterial({ color: '#3fb8b4', flat: true, hatch: 0.3 }));
    lake.position.y = BOTTOM - 1;
    scene.add(lake);
  }

  // ---------------------------------------------------------- skyline around the rim
  yield;
  for (let i = 0; i < 90; i++) {
    yield;
    const a = rng() * TAU, rad = R + 40 + Math.pow(rng(), 0.7) * 900;
    const h = 30 + rng() * rng() * 260;
    if (rng() < 0.5) {   // tall white slab towers with ribbed faces
      const w = 14 + rng() * 22, hh = 60 + rng() * 220;
      bucket('slab', strata('#f4f0e6', '#e3e8ee', '#d7dee8', 4, { grid: 3.5, flat: true }))
        .push(placed(new THREE.BoxGeometry(w, hh, w * (0.6 + rng() * 0.6)).translate(0, hh / 2, 0), Math.cos(a) * rad, TOP, Math.sin(a) * rad, rng() * TAU));
    } else tower(Math.cos(a) * rad, Math.sin(a) * rad, TOP, h, 6 + rng() * 16, PASTELS, { roof: true });
  }

  // ---------------------------------------------------------- flying traffic
  // Taxis need the physics (built after the level), so they're created in init().
  yield;
  const taxiSpecs = [];
  yield;
  for (let i = 0; i < 80; i++) {
    yield;
    const color = rng() < 0.45 ? '#f2c54b' : pick(PASTELS);
    const scale = 2.0 + rng() * 0.6;
    let lane;
    if (i < 12) {
      // vertical shuttles between levels
      const a = rng() * TAU, rad = 60 + rng() * 120;
      const y0 = BOTTOM + 40 + rng() * 100, y1 = y0 + 150 + rng() * 300, sp = 0.05 + rng() * 0.08, ph = rng() * 10;
      lane = (t, taxi) => {
        const k = 0.5 - 0.5 * Math.cos(t * sp + ph);
        taxi.pos.set(Math.cos(a) * rad, y0 + (y1 - y0) * k, Math.sin(a) * rad);
        taxi.heading = Math.PI / 2 - a;
        taxi.bank = 0;
        taxi.pitch = 0;
      };
    } else {
      const rad = 60 + rng() * 170, y = BOTTOM + 30 + rng() * (TOP + 80 - BOTTOM);
      const w = (rng() < 0.5 ? -1 : 1) * (6 + rng() * 10) / rad, ph = rng() * TAU, bob = rng() * 10;
      lane = (t, taxi) => {
        const a = ph + w * t;
        taxi.pos.set(Math.cos(a) * rad, y + Math.sin(t * 0.7 + bob) * 1.5, Math.sin(a) * rad);
        taxi.heading = Math.atan2(-Math.sin(a) * w, Math.cos(a) * w); // along the lane
        taxi.bank = Math.sign(w) * 0.2;                                  // lean into the curve
        taxi.pitch = 0;
      };
    }
    taxiSpecs.push({ color, scale, lane });
  }
  const vehicles = [];
  const stallSpots = [], viaducts = [];   // kept for the crowd

  // ---------------------------------------------------------- street life: market stalls and laundry lines
  yield;
  {
    const AWN = ['#c8483a', '#f2c54b', '#5fb7ad', '#e6875f'];
    const wood = makeMaterial({ color: '#8a5a3c', flat: true });
    const cloth = AWN.map((c) => makeMaterial({ color: c, side: THREE.DoubleSide }));
    const line = makeMaterial({ color: '#c9d2dc' });
    for (const t of terraces) {
      curGroup = 't' + LEVELS.indexOf(t.y); curY = t.y;
      const span = t.a1 - t.a0;
      // stalls along the inner side of the promenade
      for (let k = 0; k < span * 6; k++) {
        if (rng() < 0.45) continue;
        const ang = t.a0 + (k + 0.5) / (span * 6) * span, rad = t.r0 + 10;
        const x = Math.cos(ang) * rad, z = Math.sin(ang) * rad, rot = -ang;
        stallSpots.push([x, t.y, z]);
        bucket('wood', wood).push(placed(mergeGeometries([
          new THREE.BoxGeometry(3, 1, 1.6).translate(0, 0.5, 0),
          ...[[-1.4, -0.7], [1.4, -0.7], [-1.4, 0.7], [1.4, 0.7]].map(([a, b]) => new THREE.CylinderGeometry(0.05, 0.05, 2.6, 4).translate(a, 1.3, b)),
        ]), x, t.y, z, rot));
        const ci = Math.floor(rng() * AWN.length);
        bucket('awn' + ci, cloth[ci]).push(placed(new THREE.CylinderGeometry(0.01, 2.2, 0.7, 4, 1, true).rotateY(Math.PI / 4).scale(1, 1, 0.7).translate(0, 2.9, 0), x, t.y, z, rot));
        // goods on the counter
        for (let q = 0; q < 4; q++) bucket('roof' + (q % 4), roofMat(q % 4)).push(new THREE.SphereGeometry(0.18 + rng() * 0.1, 6, 4).translate(x + (rng() - 0.5) * 2, t.y + 1.15, z + (rng() - 0.5) * 0.8));
      }
      // laundry lines strung across the promenade, between the edge and the houses
      for (let k = 0; k < span * 5; k++) {
        if (rng() < 0.55) continue;
        const ang = t.a0 + rng() * span, h = t.y + 4 + rng() * 2;
        const pa = new THREE.Vector3(Math.cos(ang) * (t.r0 + 1.5), h, Math.sin(ang) * (t.r0 + 1.5));
        const pb = new THREE.Vector3(Math.cos(ang + 0.012) * (t.r0 + 13), h + 1, Math.sin(ang + 0.012) * (t.r0 + 13));
        const mid = pa.clone().lerp(pb, 0.5); mid.y -= 0.6;
        bucket('line', line).push(new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(pa, mid, pb), 8, 0.03, 4));
        for (let q = 1; q < 6; q++) {
          const u = q / 6, p = new THREE.Vector3().lerpVectors(pa, pb, u); p.y -= Math.sin(Math.PI * u) * 0.6;
          const ci = Math.floor(rng() * AWN.length), w = 0.5 + rng() * 0.5, hh = 0.6 + rng() * 0.6;
          bucket('awn' + ci, cloth[ci]).push(new THREE.PlaneGeometry(w, hh).translate(0, -hh / 2, 0).rotateY(-ang).translate(p.x, p.y, p.z));
        }
      }
    }
    curGroup = 'misc'; curY = TOP;
  }

  // ---------------------------------------------------------- arched viaducts across the void
  yield;
  {
    const steel = strata(STEEL.color, STEEL.color2, STEEL.color3, 2, { grid: 4 });
    for (let i = 0; i < 4; i++) {
      const y = LEVELS[1 + i * 2] + 2, a = rng() * TAU, span = R * 2 - 30;
      viaducts.push({ y: y + 2, a, span });
      const deck = new THREE.BoxGeometry(span, 4, 16).translate(0, y, 0);
      // the arch beneath: a deep half-ring, flattened
      const arch = new THREE.TorusGeometry(span / 2, 5, 6, 40, Math.PI).rotateX(Math.PI).scale(1, 0.32, 2.4).translate(0, y - 2, 0);
      const g = mergeGeometries([deck, arch]);
      g.rotateY(a);
      const m = new THREE.Mesh(g, steel);
      scene.add(m);
      // a row of villas and trees along the deck
      for (let k = -6; k <= 6; k++) {
        const t = k / 6 * (span / 2 - 20), c = Math.cos(-a), sn = Math.sin(-a);
        if (Math.abs(t) < SPIRE_RING + 4) continue;
        const x = t * c, z = t * sn;
        if (k % 3 === 0) trees.push([x, y + 2, z, 0.9]); else house(x, y + 2, z);
      }
    }
  }

  // ---------------------------------------------------------- the megastructure overhead
  // a vast blue grid saucer hanging over the shaft, its underside ribbed and glazed
  yield;
  {
    const steel = strata('#7f97b4', '#6f88a8', '#9fb2c6', 5, { grid: 6 });
    const parts = [
      new THREE.CylinderGeometry(260, 150, 46, 64, 4).translate(0, 0, 0),
      new THREE.CylinderGeometry(200, 262, 10, 64).translate(0, 28, 0),
      new THREE.SphereGeometry(190, 40, 14, 0, TAU, 0, Math.PI / 2).scale(1, 0.32, 1).translate(0, 33, 0),
      new THREE.CylinderGeometry(70, 30, 60, 24).translate(0, -50, 0),
    ];
    const m = new THREE.Mesh(mergeGeometries(parts), steel);
    m.position.set(-290, TOP + 175, 40);   // over the far side: framed when you look across (and clear of the Lodestar, seen from the palace)
    m.userData.noCollide = true;
    scene.add(m);
  }

  // ---------------------------------------------------------- blimps (IMG_3780, IMG_3782)
  // three teardrop airships drifting slowly round the shaft, fins at the tail, a gondola under them:
  // one mesh each (painted parts), drawn only, meant to hang in the air
  yield;
  {
    const prof = [[0.01, -10], [2.2, -9], [3.6, -6.5], [4.2, -3], [4.1, 1], [3.2, 5], [1.8, 8], [0.5, 10], [0.01, 10.3]].map(([r, t]) => new THREE.Vector2(r, t));
    for (const [i, [rad, y, speed, s, col]] of [[150, 120, 0.012, 1.3, '#c9774f'], [205, -40, -0.009, 1.0, '#d9874f'], [120, 40, 0.015, 0.8, '#e2a06a']].entries()) {
      const p = new Paint();
      p.add(new THREE.LatheGeometry(prof, 16).rotateX(Math.PI / 2), col);   // (along +z)
      for (let k = 0; k < 4; k++) p.add(new THREE.BoxGeometry(0.18, 2.6, 3.4).translate(0, 2.6, -8.3).rotateZ((k * Math.PI) / 2), col);
      p.add(new THREE.BoxGeometry(1.6, 1.4, 4.5).translate(0, -4.7, 0.5), '#5a3c38');
      for (const e of [-1.6, 2.6]) p.add(new THREE.CylinderGeometry(0.05, 0.05, 1.2, 3).translate(0, -3.9, e), '#4a3a3a');
      const m = p.mesh({ smooth: true, metal: 'painted' });
      m.scale.setScalar(s);
      m.userData.noCollide = true; m.userData.floats = true;
      scene.add(m);
      small.push(m);   // (no shadow in the far cascade)
      const ph = i * 2.1;
      movers.push({ obj: m, update: (t) => {
        const a = ph + speed * t;
        m.position.set(Math.cos(a) * rad, y + Math.sin(t * 0.05 + i) * 6, Math.sin(a) * rad);
        m.rotation.y = Math.atan2(-Math.sin(a) * speed, Math.cos(a) * speed);   // (nose along its way)
      } });
      movers[movers.length - 1].update(0);
    }
  }

  // ---------------------------------------------------------- the story's places (src/story/incal.js)
  // The high terrace where Nima sweeps; the palace landing under the Lodestar
  // (a ring round the dome, a gate facing the rim, a crown round the needle);
  // the Upward Shrine on the bottom terrace, where the splinter fell, and the
  // dead taxi call-lamp at the edge beside it.
  yield;
  const P3 = (a, rad, y) => new THREE.Vector3(Math.cos(a) * rad, y, Math.sin(a) * rad);
  const places = {};
  yield;
  {
    const top = terraces.find((t) => t.y === LEVELS[0]), low = terraces.find((t) => t.y === LEVELS[LEVELS.length - 1]);
    const PY = TOP + 120;
    places.nima = P3(top.a0 + NIMA_DA, top.r0 + 6, top.y);
    places.palace = { y: PY, landing: P3(0, 46, PY), dov: P3(0.07, 47.5, PY), gate: P3(0, 51.5, PY), crown: new THREE.Vector3(0, PY + 35, 0), taxi: P3(0, 58, PY + 1.5) };
    const sa = SHRINE_A, la = LAMP_A;
    places.shrine = P3(sa, low.r0 + 7, low.y);
    places.ossa = P3(sa + 0.012, low.r0 + 10.2, low.y);
    places.pip = P3(sa - 0.03, low.r0 + 6, low.y);
    places.lamp = P3(la, low.r0 + 1.8, low.y);
    // Wren's spot over the void beside the lamp, and where you step in and out of it: far enough along
    // the edge that E there is for the cab, not the lamp (the lamp answers within 3 m)
    places.cab = P3(la - 0.02, low.r0 - 4.5, low.y + 2.4);
    places.wren = P3(la - 0.02, low.r0 + 1.2, low.y);
    places.bottom = low;
    places.lights = [];   // warm lamps along the lower terraces, lit when the Lodestar is (Vector4s: the story moves them in)
    const gold = makeMaterial({ color: '#f2c54b', grid: 5, metal: 'brass', refl: 0.55 }), steelM = strata(STEEL.color, STEEL.color2, '#f1e6cf', 1.5, { flat: true, grid: 3 });
    const cream = makeMaterial({ color: '#f3ead8', flat: true }), ink = makeMaterial({ color: '#34405e', flat: true });
    // the small things up on the palace and down at the shrine drop out when you are far above or below them
    const palaceG = new THREE.Group(), shrineG = new THREE.Group();
    scene.add(palaceG, shrineG);
    lod.push({ obj: palaceG, y: PY, far: 300 }, { obj: shrineG, y: low.y, far: 170 });
    // the palace landing: a ring round the dome, a parapet with a gap at the gate
    const landing = new THREE.Mesh(sectorGeometry(35, 52, 0, TAU, 2.2), steelM);
    landing.position.y = PY;
    scene.add(landing);
    const par = [];
    for (let i = 0; i < 24; i++) {
      if (i === 0 || i === 23) continue;
      const a0 = (i / 24) * TAU, a1 = a0 + TAU / 24 * 0.92;
      par.push(sectorGeometry(51.2, 52, a0, a1, 1.1).translate(0, PY + 1.1, 0));
    }
    // the gate: two pylons and a lintel, a seal on top
    for (const s of [-1, 1]) par.push(new THREE.BoxGeometry(1.8, 7, 1.8).translate(51.6, PY + 3.5, s * 6));
    palaceG.add(new THREE.Mesh(mergeGeometries(par.map((g) => (g.index ? g.toNonIndexed() : g)).map((g) => { g.deleteAttribute('uv'); return g; })), cream));
    // the gold: the gate's lintel, and the crown, a small round terrace on top of the dome round the needle
    palaceG.add(new THREE.Mesh(mergeGeometries([new THREE.BoxGeometry(2.2, 1.3, 14).translate(51.6, PY + 7.6, 0), new THREE.CylinderGeometry(6.5, 6.5, 1, 24).translate(0, PY + 34.5, 0)].map((g) => { g = g.toNonIndexed(); g.deleteAttribute('uv'); return g; })), gold));
    const seal = new THREE.Mesh(glyphGeometry(4, 0.3).rotateY(Math.PI / 2).translate(52.9, PY + 7.7, 0), ink);
    seal.userData.noCollide = true;
    palaceG.add(seal);
    const rail = new THREE.Mesh(new THREE.TorusGeometry(6.4, 0.08, 4, 40).rotateX(Math.PI / 2).translate(0, PY + 36, 0), cream);
    rail.userData.noCollide = true;
    palaceG.add(rail);

    // the Upward Shrine: a round dais, a bowl held up to the light, candles, the glyph on the floor
    const S = places.shrine, face = Math.atan2(-S.x, -S.z);   // facing the void (and the Lodestar, far above)
    const stone = makeMaterial({ color: '#cdb38e', flat: true }), bowlM = makeMaterial({ color: '#b5862f', flat: true, metal: 'brass' });
    const dais = [new THREE.CylinderGeometry(2.6, 2.8, 0.34, 18).translate(0, 0.17, 0), new THREE.CylinderGeometry(0.28, 0.4, 1.0, 8).translate(0, 0.84, 0)];
    const bowl = new THREE.LatheGeometry([[0.08, 0], [0.5, 0.08], [0.78, 0.3], [0.82, 0.42], [0.74, 0.4], [0.45, 0.16], [0, 0.12]].map(([r, y]) => new THREE.Vector2(r, y)), 14).translate(0, 1.32, 0);
    const m1 = new THREE.Mesh(mergeGeometries(dais.map((g) => g.toNonIndexed())), stone);
    m1.position.copy(S); m1.rotation.y = face;
    shrineG.add(m1);
    const m2 = new THREE.Mesh(bowl, bowlM);
    m2.position.copy(S); m2.userData.noCollide = true;
    shrineG.add(m2);
    const candles = [], flames = [];
    for (let i = 0; i < 11; i++) {
      const a = (i / 11) * TAU, r = 2.15 + (i % 2) * 0.2, h = 0.18 + (i % 3) * 0.08;
      candles.push(new THREE.CylinderGeometry(0.06, 0.07, h, 6).translate(Math.cos(a) * r, 0.34 + h / 2, Math.sin(a) * r));
      flames.push(new THREE.OctahedronGeometry(0.06, 0).scale(1, 1.8, 1).translate(Math.cos(a) * r, 0.34 + h + 0.1, Math.sin(a) * r));
    }
    const cm = new THREE.Mesh(mergeGeometries(candles), cream), fm = new THREE.Mesh(mergeGeometries(flames), makeMaterial({ color: '#ffd27a', glow: 1, flat: true }));
    for (const m of [cm, fm]) { m.position.copy(S); m.userData.noCollide = true; shrineG.add(m); }
    const floorGlyph = new THREE.Mesh(glyphGeometry(2.6, 0.02).rotateX(-Math.PI / 2).rotateY(face + Math.PI).translate(0, 0.36, 0.0), ink);
    floorGlyph.position.copy(S).add(new THREE.Vector3(Math.sin(face) * 1.35, 0, Math.cos(face) * 1.35));
    floorGlyph.userData.noCollide = true;
    shrineG.add(floorGlyph);
    places.bowlTop = S.clone().add(new THREE.Vector3(0, 1.62, 0));
    // the taxi call-lamp: a tall post at the edge, a round lamp gone dark, a sign that says so
    const L = places.lamp, lf = Math.atan2(-L.x, -L.z);
    const post = new THREE.Mesh(mergeGeometries([
      new THREE.CylinderGeometry(0.12, 0.18, 4.6, 6).translate(0, 2.3, 0),
      new THREE.BoxGeometry(1.4, 0.12, 0.12).translate(0.55, 4.5, 0),
      new THREE.CylinderGeometry(0.42, 0.42, 0.14, 10).translate(1.15, 4.42, 0),
    ].map((g) => g.toNonIndexed())), ink);
    post.position.copy(L); post.rotation.y = lf - Math.PI / 2;
    shrineG.add(post);
    const lampMat = makeMaterial({ color: '#5d574b', flat: true, key: 'incal.lamp' });
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.36, 12, 8), lampMat);
    head.position.set(1.15, 4.1, 0);
    head.userData.noCollide = true;
    post.add(head);
    const sign = new THREE.Mesh(textGeometry('TAXI', { width: 1.1, depth: 0.05 }), makeMaterial({ color: '#d9784f', flat: true, key: 'incal.lampSign' }));
    sign.position.set(0, 3.3, 0.2);
    sign.userData.noCollide = true;
    post.add(sign);
    places.lampHead = { mesh: head, mat: lampMat, signMat: sign.material };
    // the old goods hoist (src/story/incal.js turns it): an iron post at the edge, an arm on a sleeve
    // that swings round it, a basket hanging off the long end out over the void (Pip's mum hangs the
    // day's ration tin in it, out of the rats' reach), a weight on the short end to walk it round by,
    // and a rusted pin through the collar that holds it. Local +x points out over the void.
    {
      const H = HOIST, hp = P3(H.a, low.r0 + H.inset, low.y);
      const rust = makeMaterial({ color: '#b9603e', flat: true, metal: 'iron' }), wicker = makeMaterial({ color: '#a8743f', flat: true });
      const tinM = makeMaterial({ color: '#dfe4ea', flat: true }), labelM = makeMaterial({ color: '#d9784f', flat: true });
      const one = (list) => mergeGeometries(list.map((g) => { g = g.index ? g.toNonIndexed() : g; g.deleteAttribute('uv'); return g; }));
      const group = new THREE.Group();
      group.position.copy(hp); group.rotation.y = Math.PI - H.a;
      group.add(new THREE.Mesh(one([
        new THREE.BoxGeometry(0.9, 0.18, 0.9).translate(0, 0.09, 0),
        new THREE.CylinderGeometry(0.14, 0.2, H.height, 8).translate(0, H.height / 2, 0),
        new THREE.CylinderGeometry(0.3, 0.3, 0.26, 10).translate(0, H.height - 1.63, 0),   // the collar the arm's sleeve sits on
      ]), ink));
      // the pin: through the collar, its ring head toward the terrace's length
      const pin = new THREE.Mesh(one([new THREE.CylinderGeometry(0.075, 0.075, 1.0, 6).rotateX(Math.PI / 2), new THREE.TorusGeometry(0.17, 0.05, 5, 10).translate(0, 0, 0.62)]), rust);
      pin.position.set(0, H.height - 1.63, 0);
      group.add(pin);
      // the arm, on its sleeve: rotation.y 0 = out over the void, π = in over the terrace
      const arm = new THREE.Group();
      arm.position.y = H.height;
      const brace = Math.hypot(H.reach * 0.65, 1.25);
      arm.add(new THREE.Mesh(one([
        new THREE.CylinderGeometry(0.26, 0.26, 1.5, 10).translate(0, -0.75, 0),
        new THREE.BoxGeometry(H.reach + 1.9, 0.2, 0.2).translate((H.reach - 1.9) / 2 + 0.1, 0, 0),
        new THREE.CylinderGeometry(0.05, 0.05, brace, 5).rotateZ(-Math.atan2(H.reach * 0.65, 1.25)).translate(H.reach * 0.325, -0.65, 0),
        new THREE.TorusGeometry(0.22, 0.05, 5, 12).translate(H.reach, -0.12, 0),
        new THREE.CylinderGeometry(0.03, 0.03, 1.1, 4).translate(-1.4, -0.55, 0),
      ]), ink));
      // the weight on the short end
      const weight = new THREE.Mesh(one([new THREE.BoxGeometry(0.75, 0.8, 0.75), new THREE.BoxGeometry(0.82, 0.1, 0.82).translate(0, 0.3, 0)]), rust);
      weight.position.set(-1.4, -1.5, 0);
      arm.add(weight);
      // the basket on its cable, hanging from the pulley (a group, so it can sway)
      const hang = new THREE.Group();
      hang.position.set(H.reach, -0.34, 0);
      hang.add(new THREE.Mesh(one([
        new THREE.CylinderGeometry(0.02, 0.02, 2.34, 4).translate(0, -1.17, 0),
        new THREE.TorusGeometry(0.45, 0.03, 4, 14, Math.PI).translate(0, -2.79, 0),   // the handle
      ]), ink));
      hang.add(new THREE.Mesh(one([
        new THREE.CylinderGeometry(0.5, 0.4, 0.42, 12, 1, true).translate(0, -3.0, 0),
        new THREE.CylinderGeometry(0.4, 0.4, 0.04, 12).translate(0, -3.2, 0),
        new THREE.TorusGeometry(0.5, 0.04, 4, 14).rotateX(Math.PI / 2).translate(0, -2.79, 0),
      ]), wicker));
      const tin = new THREE.Group();
      tin.add(new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.46, 12).translate(0, -2.95, 0), tinM));
      tin.add(new THREE.Mesh(new THREE.CylinderGeometry(0.185, 0.185, 0.12, 12).translate(0, -2.8, 0), labelM));   // the label, above the rim
      hang.add(tin);
      arm.add(hang);
      group.add(arm);
      group.traverse((o) => { o.userData.noCollide = true; });
      shrineG.add(group);
      places.hoist = hp;
      places.hoistIn = P3(H.a, low.r0 + H.inset + H.reach, low.y);   // where the basket hangs, swung in
      places.hoistRig = { group, arm, pin, weight, hang, tin, pinRest: pin.position.clone() };
    }
    // keep the trees off the shrine, the lamp and the hoist
    for (const t of trees) for (const [c, r] of [[S, 9], [L, 3], [places.nima, 4], [places.hoist, 6]]) if (Math.abs(t[1] - c.y) < 1 && Math.hypot(t[0] - c.x, t[2] - c.z) < r) t[3] = 0;
  }

  // ---------------------------------------------------------- the red stair down to Nima's terrace (STAIR)
  // Terracotta flights cut into the shaft's wall on steel brackets, a red pipe rail on the void side, as the
  // plates' red stairs; a cream gate with a terracotta lintel at the rim marks where it starts. Every piece is
  // built round the shaft's axis: x the distance from it, z along the wall, then turned to its angle.
  yield;
  {
    const top = terraces.find((t) => t.y === LEVELS[0]);
    const W = STAIR.width, rIn = R - W, rc = R - W / 2, rOut = R + 0.4;
    const th0 = STAIR.top - STAIR.topLanding / 2 / rc, thA = STAIR.top + STAIR.topLanding / 2 / rc;
    const thB = top.a0 - STAIR.gangway;                      // the foot of the last flight: the landing on the terrace's end
    const drop = (TOP - top.y) / STAIR.flights, n = Math.round(drop / STAIR.rise), rise = drop / n;
    const flight = ((thB - thA) * rc - (STAIR.flights - 1) * STAIR.landing) / STAIR.flights, tread = flight / n;
    const red = makeMaterial({ color: '#d0694a', flat: true, key: 'incal.stair' });
    const pipe = makeMaterial({ color: '#b24a36', flat: true, metal: 'iron' });
    const steelS = strata(STEEL.color, STEEL.color2, STEEL.color3, 1.4, { flat: true, grid: 3 });
    const cream = makeMaterial({ color: '#f3ead8', flat: true });
    const flat0 = (g) => { g = g.index ? g.toNonIndexed() : g; g.deleteAttribute('uv'); g.deleteAttribute('normal'); return g; };
    const steps = [], brackets = [], rails = [], path = [];
    /** a block against the wall: from radius r0 to r1, z0..z1 m along the wall from angle th, top at y, h deep */
    const block = (r0, r1, th, z0, z1, y, h) => new THREE.BoxGeometry(r1 - r0, h, z1 - z0).translate((r0 + r1) / 2, y - h / 2, (z0 + z1) / 2).rotateY(-th);
    /** a steel bracket under the stair at angle th, its top at y: a wedge from the wall */
    const bracket = (th, y) => {
      const s = new THREE.Shape();
      s.moveTo(rOut, 0); s.lineTo(rIn + 0.3, 0); s.lineTo(rIn + 0.6, -0.5); s.lineTo(rOut, -3.2);
      return new THREE.ExtrudeGeometry(s, { depth: 0.7, bevelEnabled: false }).translate(0, y, -0.35).rotateY(-th);
    };
    const at = (th, r, y) => new THREE.Vector3(Math.cos(th) * r, y, Math.sin(th) * r);
    // the top landing, flush with the rim, in a gap of the parapet
    steps.push(block(rIn, R, th0, 0, STAIR.topLanding, TOP, 1.2));
    brackets.push(bracket(STAIR.top, TOP - 1.2));
    path.push(at(STAIR.top, R + 4, TOP), at(STAIR.top, rc, TOP));
    const railPts = [at(th0, rIn + 0.15, TOP + 1.0)];
    let th = thA, y = TOP;
    for (let f = 0; f < STAIR.flights; f++) {
      path.push(at(th, rc, y));
      for (let k = 0; k < n; k++) {
        const yk = y - (k + 1) * rise;
        steps.push(block(rIn, rOut, th, k * tread - 0.01, (k + 1) * tread + 0.01, yk, 1.1));
        if (k % 8 === 4) rails.push(new THREE.CylinderGeometry(0.035, 0.035, 1.0, 5).translate(rIn + 0.15, yk + 0.5, (k + 0.5) * tread).rotateY(-th));
      }
      railPts.push(at(th, rIn + 0.15, y + 1.0));
      brackets.push(bracket(th + flight / 2 / rc, y - drop / 2 - 1.1));
      th += flight / rc; y -= drop;
      path.push(at(th, rc, y));
      railPts.push(at(th, rIn + 0.15, y + 1.0));
      if (f < STAIR.flights - 1) {
        steps.push(block(rIn, rOut, th, 0, STAIR.landing, y, 1.2));
        brackets.push(bracket(th + STAIR.landing / 2 / rc, y - 1.2));
        rails.push(new THREE.CylinderGeometry(0.035, 0.035, 1.0, 5).translate(rIn + 0.15, y + 0.5, STAIR.landing / 2).rotateY(-th));
        th += STAIR.landing / rc;
        railPts.push(at(th, rIn + 0.15, y + 1.0));
      }
    }
    // the red pipe rail along the void side, a straight run per flight and landing (along the wall's curve)
    for (let i = 1; i < railPts.length; i++) {
      const a = railPts[i - 1], b = railPts[i], m = Math.max(1, Math.round(a.distanceTo(b) / 2)), pts = [];
      const ta = Math.atan2(a.z, a.x), tb = Math.atan2(b.z, b.x);
      for (let j = 0; j <= m; j++) { const u = j / m; pts.push(at(ta + (tb - ta) * u, rIn + 0.15, a.y + (b.y - a.y) * u)); }
      rails.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), m * 2, 0.05, 5));
    }
    // the steel landing along the terrace's end, with an iron parapet on its void side and at its inner end
    const gang = sectorGeometry(top.r0, R, thB, top.a0, 1.2);
    gang.translate(0, top.y, 0);
    const iron = [
      sectorGeometry(top.r0, top.r0 + 0.5, thB, top.a0, 1.1).translate(0, top.y + 1.1, 0),
      block(top.r0, rIn, thB, 0.05, 0.45, top.y + 1.1, 1.1),
      block(rIn, R, th0, 0.05, 0.4, TOP + 1.1, 1.1),   // (the top landing's far end)
    ];
    path.push(at(thB + STAIR.gangway / 2, rc - 3, top.y), at(thB + STAIR.gangway / 2, top.r0 + 6, top.y));
    // the gate at the rim: two cream pylons either side of the gap, a terracotta lintel
    const gate = [], gw = 3.1 / R;
    for (const s of [-1, 1]) gate.push(block(R + 0.4, R + 1.6, STAIR.top + s * gw, -0.6, 0.6, TOP + 4.6, 4.6));
    const lintel = block(R + 0.3, R + 1.7, STAIR.top, -3.9, 3.9, TOP + 5.4, 0.8);
    const add = (geos, mat) => { const m = new THREE.Mesh(mergeGeometries(geos.map(flat0)), mat); m.geometry.computeVertexNormals(); scene.add(m); return m; };
    add(steps, red); add([lintel], red);
    add([...brackets, gang], steelS);
    add(rails, pipe); add(iron, ironMat);
    add(gate, cream);
    places.stair = { top: at(STAIR.top, R + 4, TOP), foot: at(thB + STAIR.gangway / 2, rc - 3, top.y), path };
    // no tree on the landing or in the open strip along the terrace's end
    for (const t of trees) if (Math.abs(t[1] - top.y) < 1) { const d = fromEnd(t[0], t[2], top.a0); if (d > -10 && d < STAIR.lane + 1) t[3] = 0; }
  }

  // trees on the rim around the spawn
  yield;
  for (let k = 0; k < 160; k++) {
    yield;
    const a = (rng() - 0.5) * 0.9, rad = R + 6 + rng() * 60;
    if (k % 4 === 3) { rng(); rng(); continue; }   // a lighter grove: a quarter fewer, so the rim's people can be seen
    const x = Math.cos(a) * rad, z = Math.sin(a) * rad + (rng() - 0.5) * 20;
    if (Math.abs(z) < 16 && x < R + 40) continue;     // keep the view from the spawn open
    if (x > R + 30 && x < R + 60 && Math.abs(z) < 42) continue;   // and the walk-in villas clear
    if (Math.hypot(x - Math.cos(PILLAR.a) * PILLAR.r, z - Math.sin(PILLAR.a) * PILLAR.r) < 8) continue;   // and round the makers' pillar
    trees.push([x, TOP, z, 0.8 + rng() * 0.8]);
  }
  // ---------------------------------------------------------- trees: cypresses and round olives
  yield;
  const treeMeshes = [];   // (init drops the ones a clump put inside a house)
  yield;
  {
    const dummy = new THREE.Object3D(), color = new THREE.Color();
    // cypress: a tall flame, widest a third of the way up, tip pointed
    const prof = [[0, 0], [0.55, 0.3], [1.15, 2.2], [1.25, 3.6], [1.0, 6], [0.55, 8.2], [0.12, 9.6], [0, 10]].map(([r, y]) => new THREE.Vector2(r, y));
    const cypress = new THREE.LatheGeometry(prof, 9);
    const lobes = [];
    // (the crown held high on a tall trunk: you see the people under it, and the camera passes beneath)
    for (let k = 0; k < 7; k++) { const a = k * 2.39996, r = 0.9 + (k % 3) * 0.5; lobes.push(new THREE.IcosahedronGeometry(1.5 + (k % 2) * 0.5, 0).translate(Math.cos(a) * r, 5.4 + (k % 3) * 0.8, Math.sin(a) * r)); }
    lobes.push(new THREE.CylinderGeometry(0.22, 0.35, 5.6, 5).translate(0, 2.8, 0));
    const olive = mergeGeometries(lobes.map((g) => g.toNonIndexed()));
    olive.computeVertexNormals();
    const greens = ['#5e7a3a', '#4f6b34', '#6f8a42', '#56733f'];
    const hash01 = (i) => ((Math.sin(i * 12.9898) * 43758.5453) % 1 + 1) % 1;
    const groups = [...new Set(trees.map((t) => t[4]))];
    // (shadeFlat 0: the world prints its shadows flat in the shaft's blue (uShadowFlat below), which turned
    //  the cypresses and olives grey-blue; a material's own flat print overrides the world's, so they keep
    //  their green darkened — docs/systems/rendering.md, "Flat shadows, and a material's own")
    const treeMat = makeMaterial({ color: '#ffffff', scrub: true, pattern: 'leaves', shadeFlat: 0 });
    // umbrella pine: a bare leaning trunk under a flat layered canopy
    const pineParts = [new THREE.CylinderGeometry(0.22, 0.4, 8, 5).translate(0, 4, 0).rotateZ(0.12)];
    for (let k = 0; k < 5; k++) { const a = k * 1.9, r = k ? 1.8 : 0; pineParts.push(new THREE.IcosahedronGeometry(2.2, 0).scale(1.2, 0.42, 1.2).translate(Math.cos(a) * r + 0.95, 8.4 + (k % 2) * 0.5, Math.sin(a) * r)); }
    const pine = mergeGeometries(pineParts.map((g) => g.toNonIndexed()));
    pine.computeVertexNormals();
    const kindOf = (i) => { const h = hash01(i); return h < 0.5 ? cypress : h < 0.82 ? olive : pine; };
    // one mesh per terrace, kind and eighth of the ring: a whole terrace's trees in one mesh
    // went round the shaft, so neither the view nor the shadow map could leave any of them out
    // (up to 1.2 M triangles in the near shadow pass, most of them behind you or across the pit)
    const SECTORS = 8;
    const sectorOf = (x, z) => Math.floor((Math.atan2(z, x) / TAU + 1) * SECTORS) % SECTORS;
    for (const grp of groups) for (const geo of [cypress, olive, pine]) {
      const list = trees.filter((t, i) => t[4] === grp && kindOf(i) === geo);
      if (!list.length) continue;
      // (each tree's turn, height and green drawn in the same order as ever: the world stays as it was)
      const placed = list.map(([x, y, z, s]) => {
        dummy.position.set(x, y, z);
        dummy.rotation.set(0, rng() * TAU, 0);
        dummy.scale.set(s, s * (geo === cypress ? 0.9 + rng() * 0.8 : 1), s);
        dummy.updateMatrix();
        return { m: dummy.matrix.clone(), c: color.set(pick(greens)).clone(), sec: sectorOf(x, z) };
      });
      for (let sec = 0; sec < SECTORS; sec++) {
        const part = placed.filter((p) => p.sec === sec);
        if (!part.length) continue;
        const mesh = new THREE.InstancedMesh(geo, treeMat, part.length);
        part.forEach((p, i) => { mesh.setMatrixAt(i, p.m); mesh.setColorAt(i, p.c); });
        mesh.userData.noCollide = true;
        mesh.userData.tiled = true;           // already grouped; tileScene leaves it alone
        mesh.userData.drawFar = Infinity;     // (seen right across the shaft: not dropped with the small props, perf.js cullFar)
        mesh.computeBoundingSphere();
        lod.push({ obj: mesh, y: list[0][5], far: 260 });
        treeMeshes.push(mesh);
        small.push(mesh);
        scene.add(mesh);
      }
    }
  }

  // merge the town buckets (one mesh per material per terrace sector)
  yield;
  for (const [key, { mat, geos, y }] of buckets) {
    yield;
    if (!geos.length) continue;
    const g = mergeGeometries(geos.map((x) => (x.index ? x : x.toNonIndexed())).map((x) => { x.deleteAttribute('uv'); return x; }));
    g.computeBoundingSphere();
    const m = new THREE.Mesh(g, mat);
    m.userData.tiled = true;
    scene.add(m);
    // roofs and domes far above or below you drop out first (walls stay as silhouettes)
    if (key.startsWith('roof') && !key.endsWith('@misc')) lod.push({ obj: m, y, far: 380 });
  }

  // three villas behind the spawn you can walk into (doors face the pit)
  const roomLights = [];
  yield;
  for (const [vz, wcol] of [[-26, '#f1e6cf'], [2, '#ead7b5'], [30, '#efe2c8']]) {
    yield;
    const room = buildRoom(scene, {
      pos: new THREE.Vector3(R + 44, TOP, vz), rot: -Math.PI / 2, w: 10, d: 9, h: 4.6,
      wall: { color: wcol, color2: '#e6cfae' }, floor: '#c8673f', ceiling: '#e9dcc2',
      windows: [{ side: 'left', x: 4.5, y: 1.2, w: 1.6, h: 1.6 }, { side: 'right', x: 4.5, y: 1.2, w: 1.6, h: 1.6 }, { side: 'back', x: 5, y: 1.3, w: 2.2, h: 1.4 }, { side: 'front', x: 2, y: 1.2, w: 1.4, h: 1.4 }],
      furniture: [['table', 0, -0.5, 0], ['chair', -1.3, -0.5, Math.PI / 2], ['chair', 1.3, -0.5, -Math.PI / 2], ['bed', 3.6, -2.6, 0, '#8a5a3c', '#5fb7ad'],
        ['shelf', -3.6, -4.0, 0], ['rug', 0, 1.6, 0, '#8a5a3c', '#d8a24a'], ['pot', -4.2, 3.4]],
    });
    roomLights.push(...room.lights);
    // a terracotta roof on top, like the town below
    const roof = new THREE.Mesh(new THREE.ConeGeometry(8.2, 3.2, 4).rotateY(Math.PI / 4).scale(1.05, 1, 0.95), makeMaterial({ color: ROOFS[Math.floor(rng() * 4)], flat: true, pattern: 'tiles' }));
    roof.position.set(R + 44, TOP + 4.6 + 1.6 + 0.3, vz);
    scene.add(roof);
  }
  // the makers' pillar: a lone stone column on the rim, 130 m round from the ship, its dark blue
  // capital carved with the glyph ring. The jets' box waits on top (src/boxes/placements.js): a climb.
  yield;
  {
    const a = PILLAR.a, px = Math.cos(a) * PILLAR.r, pz = Math.sin(a) * PILLAR.r, H = PILLAR.h;
    const stone = makeMaterial({ color: '#ddd3bf', color2: '#cbbfa6', flat: true, pattern: 'cracks', key: 'incal.pillar' });
    const blue = makeMaterial({ color: '#25386c', flat: true, key: 'incal.pillar.cap' });
    const pale = makeMaterial({ color: '#9fbfdc', flat: true, glow: 0.2, key: 'incal.pillar.carve' });
    const plinth = new THREE.Mesh(new THREE.CylinderGeometry(3.6, 4.0, 1.2, 8).translate(0, 0.6, 0), stone);
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 3.0, H - 2.0, 8).translate(0, 1.2 + (H - 2.0) / 2, 0), stone);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(3.3, 2.7, 0.8, 8).translate(0, H - 0.4, 0), blue);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(2.9, 0.07, 4, 32).rotateX(Math.PI / 2).translate(0, H - 0.75, 0), pale);
    for (const m of [plinth, shaft, cap, ring]) { m.position.set(px, TOP, pz); m.rotation.y = Math.PI / 8; scene.add(m); }
  }
  // a railing and cypresses at the spawn, looking out over the town (as in the plate)
  yield;
  {
    const rail = new THREE.TubeGeometry(new THREE.LineCurve3(new THREE.Vector3(R + 0.6, TOP + 1.1, -30), new THREE.Vector3(R + 0.6, TOP + 1.1, 30)), 8, 0.12, 8);
    scene.add(new THREE.Mesh(rail, makeMaterial({ color: '#c9d2dc', metal: 'chrome' })));
    for (let k = -30; k <= 30; k += 6) scene.add(new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.1, 6).translate(R + 0.6, TOP + 0.55, k), makeMaterial({ color: '#c9d2dc', metal: 'chrome' })));
  }

  // ---------------------------------------------------------- level description
  yield;
  const spawn = new THREE.Vector3(R + 14, TOP, 0);
  // the Warden's Well, the makers' tower on the rim, and its rooms far overhead (src/temples/incal.js)
  yield;
  return attachTemple('incal', scene, {
    id: 'incal',
    // the rim's flora (src/flora.js) keeps the view from the spawn, the villas, the pillar and the trees' feet clear
    floraAvoid: (x, z, r) => (Math.abs(z) < 18 + r && x < R + 42) || (x > R + 28 && x < R + 62 && Math.abs(z) < 44)
      || Math.hypot(x - Math.cos(PILLAR.a) * PILLAR.r, z - Math.sin(PILLAR.a) * PILLAR.r) < 10 + r
      || Math.hypot(x - Math.cos(STAIR.top) * (R + 6), z - Math.sin(STAIR.top) * (R + 6)) < 8 + r   // (the red stair's gate)
      || trees.some((t) => t[3] > 0 && Math.abs(t[1] - TOP) < 1 && Math.hypot(t[0] - x, t[2] - z) < 2.2 + r),
    ground: { heightAt: () => -Infinity }, // everything walkable is real geometry
    spawn,
    spawnHeading: -Math.PI / 2,   // facing the pit
    camYaw: Math.PI / 2,
    features: { mount: false, wind: false, jetpack: true, climb: true, taxis: true },
    vehicles,
    // the city's shape, for its story (src/story/incal.js): terraces, bridges, the palace and the Lodestar
    shaft: { R, TOP, BOTTOM, LEVELS, SPIRE_R, SPIRE_RING, terraces, bridges, stallSpots, viaducts, billboards, incal: incalRig, places },
    // called once the physics exists: spawn the taxis (they collide when driven)
    init(physics) { runSteps(this.initSteps(physics)); },
    // (in steps for the game's load: the trees' check is a few thousand rays)
    *initSteps(physics) {
      // trees a clump put inside a house (or a crown through a wall) are left out
      for (const m of treeMeshes) yield* dropBuriedInstancesSteps(m, physics, [1, 3.5, 6], { ring: 0.9 });
      for (const spec of taxiSpecs) {
        const taxi = new Taxi(physics, spec.color, spec.scale, spec.lane);
        taxi.routes = shaftRoutes;
        taxi.update(0, null, 0);
        scene.add(taxi.object);
        vehicles.push(taxi);
      }
    },
    // (as its plates: barely hatched, a clean sky, the shade printed flat in the shaft's own blue as the
    //  sheets do — a pink wall's turned side goes blue, not dark pink; the trees say their own, above)
    defaults: { hour: 12.5, preset: 'Moebius print', look: { uHatch: 0.45, uCumulus: 0, uShadowFlat: 0.8, ...SHAFT_FOG } },
    sky: {
      script: {
        day: ['#8fb4da', '#eef0ea', '#93a6cf', '#fffaf0', '#fff6dc'],   // print: clear blue over a pale haze
        dusk: ['#8a8fc8', '#f4a8a0', '#8a6fb8', '#ffd2c0', '#ffe2b8'],
        night: ['#1d2250', '#4a4a8a', '#3d3a80', '#9a9ad0', '#f2f0e6'],
      },
      planets: [{ az: 210, el: 16, size: 9, color: '#e8b9c4', ring: 0.25 }],
    },
    killY: BOTTOM + 4,
    // haze thickens and turns acid-green as you descend
    atmo(x, z, y = TOP) {
      const inside = Math.hypot(x, z) < R;
      const d = inside ? THREE.MathUtils.clamp((TOP - y) / (TOP - BOTTOM), 0, 1) : 0;
      // once the Lodestar burns bright again (its story), its light reaches further down: less smog, warmer
      const lit = incalRig.k;
      const tint = [1.0 - 0.08 * d + 0.05 * d * lit, 0.92 + 0.06 * d, 0.95 - 0.12 * d - 0.02 * d * lit];
      const name = !inside ? 'The rim' : d < 0.3 ? 'Upper levels' : d < 0.65 ? 'Middle levels' : 'The depths';
      return { tint, fog: 1.6 + d * 1.6 * (1 - 0.35 * lit), name };
    },
    life: {
      flocks: [{ count: 12, color: '#f3ead8', size: 1.8, radius: 90, height: [15, 50], seed: 3 },
               { count: 10, color: '#f3ead8', size: 1.6, radius: 140, height: [-40, 10], speed: -0.1, seed: 9 }],
      motes: { count: 180, color: '#bdb4c8', size: 0.05, rise: -0.3, wind: [0.4, 0.2] },
    },
    // taxis are solid: bump into them, or land on a roof and ride along
    dynamic: () => vehicles,
    // where the cabs take you, and how they get there (src/taxi.js, src/story/cab.js)
    cabStops: shaftCabStops(places, terraces),
    cabRoutes: shaftRoutes,
    // inside the shaft the sun comes in steeper, so the terraces are lit like the plate
    lightAt(p, dir) {
      const inside = Math.hypot(p.x, p.z) < R + 20 && p.y < TOP + 40;
      if (inside && dir.y > 0.05) { dir.y += 0.9; dir.normalize(); }
    },
    smallProps: small,
    get lights() { return roomLights; },
    // The city crowd (crowd.js): strollers along every promenade, circles by the
    // parapet, at the stalls and in the lanes between the houses, people leaning
    // over the edge or sitting with their legs over the drop, more on the spire
    // rings, the viaducts and the rim round the spawn. Candidates only: the
    // crowd keeps those on clear, walkable ground.
    crowdSpots() {
      const r = mulberry32(31337), V = (x, y, z) => new THREE.Vector3(x, y, z);
      const P = (a, rad, y) => V(Math.cos(a) * rad, y, Math.sin(a) * rad);
      const inward = (p) => Math.atan2(-p.x, -p.z), outward = (p) => Math.atan2(p.x, p.z);
      const size = () => 2 + Math.floor(r() ** 1.2 * 4);
      const groups = [], walks = [], edges = [];
      const avoid = [...trees.map(([x, y, z, s]) => ({ x, y, z, r: 1.05 * s + 0.2 })), ...stallSpots.map(([x, y, z]) => ({ x, y, z, r: 1.6 }))];
      // shoppers at the stalls
      for (const [x, y, z] of stallSpots) if (r() < 0.55) {
        const d = Math.hypot(x, z), k = (d - 2.15) / d;
        groups.push({ at: V(x * k, y, z * k), n: 2 + (r() < 0.3 ? 1 : 0) });
      }
      for (const t of terraces) {
        const span = t.a1 - t.a0;
        // the promenade: between the cypress row and the market stalls
        const rw = t.r0 + 6.1, pts = [];
        for (let a = t.a0 + 0.03; a <= t.a1 - 0.03; a += 2.5 / rw) pts.push(P(a, rw, t.y));
        walks.push({ path: pts, n: Math.max(2, Math.round(span * rw / 15)), pair: 0.5, lateral: 0.6, keepRight: 0.4 });
        // circles in the gaps of the cypress row, and in the lanes between the houses
        for (let a = t.a0 + 0.02; a < t.a1 - 0.02; a += (10 + r() * 14) / t.r0) {
          const rad = r() < 0.55 ? t.r0 + 2.4 + r() * 1.6 : t.r0 + 14 + r() * (t.width - 18);
          groups.push({ at: P(a, rad, t.y), n: size() });
        }
        for (let a = t.a0 + 0.02; a < t.a1 - 0.02; a += (8 + r() * 12) / t.r0) {
          if (r() < 0.45) continue;
          const sit = r() < 0.5, p = P(a, t.r0 + (sit ? 0.22 : 1.1), t.y);
          edges.push({ at: p, heading: inward(p), pose: sit ? 'sit' : 'rail' });
        }
      }
      // the spire rings: a stroll round each, a few circles, legs over the outer edge
      for (const y of LEVELS) {
        const pts = [];
        for (let a = 0; a < TAU; a += 2.5 / 36) pts.push(P(a, 36, y));
        walks.push({ path: pts, loop: true, n: 3, pair: 0.5, lateral: 0.9 });
        for (let k = 0; k < 5; k++) groups.push({ at: P(r() * TAU, r() < 0.5 ? 29.5 : 42.5, y), n: size() });
        for (let k = 0; k < 6; k++) { const p = P(r() * TAU, SPIRE_RING - 0.22, y); edges.push({ at: p, heading: outward(p), pose: 'sit' }); }
      }
      // the viaduct decks, among their villas
      for (const v of viaducts) for (let k = 0; k < 12; k++) {
        const t = (r() - 0.5) * (v.span - 30), o = (r() - 0.5) * 12;
        groups.push({ at: V(t * Math.cos(v.a) - o * Math.sin(v.a), v.y, -t * Math.sin(v.a) - o * Math.cos(v.a)), n: size() });
      }
      // the rim: folk by the railing looking down into the city, and chatting by the villas
      for (let z = -28; z <= 28; z += 1.8 + r() * 3) if (Math.abs(z) > 3 && r() < 0.75) edges.push({ at: V(R + 1.1, TOP, z), heading: -Math.PI / 2, pose: 'rail' });
      for (let k = 0; k < 40; k++) {
        const x = R + 5 + r() * 34, z = (r() - 0.5) * 100;
        if (Math.abs(z) < 8 && x < R + 24) continue;   // the view from the spawn stays open
        groups.push({ at: V(x, TOP, z), n: size() });
      }
      for (const z of [-34, 34]) walks.push({ path: [V(R + 6, TOP, z), V(R + 36, TOP, z)], n: 2, pair: 0.6 });
      walks.push({ path: [V(R + 9, TOP, -60), V(R + 9, TOP, 60)], n: 4, pair: 0.5 });
      // who they are depends on how far down they live: the rim and the upper terraces call the
      // Lodestar a tourist story, the depths pray to it (src/story/incal-data.js; the story talks to them by zone)
      const zoneOf = (y) => (y >= TOP - 1 ? 'rim' : y >= LEVELS[1] - 1 ? 'upper' : y >= LEVELS[4] - 1 ? 'middle' : 'lower');
      for (const s of [...groups, ...walks, ...edges]) { s.id = zoneOf(s.at?.y ?? s.path[0].y); s.lines = LINES[s.id]; }
      // the story's places stay clear: the shrine and its keeper, the call-lamp, the sweeper's corner
      const keep = [[places.shrine, 3.6], [places.ossa, 1.6], [places.pip, 1.2], [places.lamp, 1.2], [places.wren, 1.4], [places.nima, 2.5], [places.hoist, 2.2], [places.hoistIn, 1.4]];
      for (const [p, rr] of keep) avoid.push({ x: p.x, y: p.y, z: p.z, r: rr });
      return { groups, walks, edges, avoid, farMax: 600, costume: 'incal', clear: [{ x: spawn.x, y: TOP, z: spawn.z, r: 4 }, ...keep.map(([p, rr]) => ({ x: p.x, y: p.y, z: p.z, r: rr + 1 }))] };
    },
    update(dt, t, ctx) {
      if (ctx?.player) Taxi.playerPos = ctx.player.pos;
      const cy = ctx?.camera?.position.y ?? ctx?.player?.pos.y ?? TOP;
      for (const l of lod) l.obj.visible = Math.abs(cy - l.y) < l.far;
      for (const m of movers) m.update(t);
      for (const b of banners) b.update(t);
      steam.update(dt);
    },
    constrainCamera(pos) {
      if (pos.y > TOP - 0.5) return;
      const d = Math.hypot(pos.x, pos.z);
      if (d > R - 3) { pos.x *= (R - 3) / d; pos.z *= (R - 3) / d; }
    },
  });
}
export const createIncal = stepped(buildIncal);
