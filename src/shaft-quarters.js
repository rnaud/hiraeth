import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeMaterial, MODE_STRATA } from './materials.js';
import { mulberry32 } from './noise.js';

// The City-Shaft's quarters (issue #169, the author's pick "rim-quarters": references/levels/The City-Shaft/environment/
// explorations/rim-quarters/). The rim walk went round one long curve of the same terrace; now the ring is four quarters
// you tell apart from across the pit and on the promenade, each with its own shape, colour and life:
//
//   the hanging gardens     green spilling over the terraces' edges, ivy in sheets up the wall, falls of water off
//                           the edges (Nima's corner and the first drops: the top of the walk)
//   the cab-wrights' cliff  the wall a pink cliff, cabs parked in holes in it like birds in a cliff, ochre cranes out
//                           over the void (the middle drops, Perrine's halfway stall)
//   the bell quarter        bronze bells hung out over the void on red beams under small green roofs, swinging in
//                           the updraft, prayer ribbons, tall red banners down the wall (the Upward Shrine's quarter and
//                           the mirrors' chain: a sound to walk toward)
//   the balcony market      balconies built out over the void on struts and cables under striped awnings, bunting
//                           between them, the wall rose (under the rim by the ship and the cab rank: what the cab
//                           ride home flies over); you walk out onto them
//
// Little geometry (the Steam Deck's hardest world): every prop is a few boxes, merged per quarter, level and material
// into still meshes the static batches draw (src/static-batch.js); the bells are one instanced mesh (they swing). Every
// material keeps its colour in the shade (shadeFlat 0, as the trees), or the shaft's flat blue shade would make the
// four one blue-grey again. Nothing here draws from the town's numbers (its own rng), so the city round it keeps its
// layout. The balconies stand at spots worked out from a terrace sector alone (balconySpots: pure), so the town's
// railing leaves a gap where each joins the promenade (src/levels/incal.js).
//
//   quarterAt(angle) → the quarter round the shaft at that angle
//   edgeSpots(terrace, quarter, step, { clear }) → [{ a, x, z, y, r0 }]   (pure: spots along a sector's inner edge)
//   balconySpots(terrace, clear) → the market's balconies on a sector (pure: the railing's gaps, the tests)
//   buildShaftQuarters(scene, { terraces, R, clear }) → { quarters, lod, bells, balconies, sights, nearestBell, update }

const TAU = Math.PI * 2;
const norm = (a) => ((a % TAU) + TAU) % TAU;
/** The quarters round the shaft (world angle, atan2(z, x); a1 past TAU wraps). */
export const QUARTERS = [
  { id: 'gardens', name: 'The hanging gardens', a0: 0.2, a1: 1.75 },
  { id: 'cabs', name: 'The cab-wrights’ cliff', a0: 1.75, a1: 2.85 },
  { id: 'bells', name: 'The bell quarter', a0: 2.85, a1: 4.3 },
  { id: 'market', name: 'The balcony market', a0: 4.3, a1: 0.2 + TAU },
];
/** How far round from the quarter's start an angle lies (0..TAU). */
const into = (q, a) => norm(a - q.a0);
export const inQuarter = (q, a) => into(q, a) < q.a1 - q.a0;
export const quarterAt = (a) => QUARTERS.find((q) => inQuarter(q, a)) ?? QUARTERS[0];
/** The spacing of each quarter's props (m) and their sizes. */
export const PROPS = {
  vines: { step: 3.6 }, shrubs: { step: 6 }, falls: { per: 2 }, ivy: { per: 7 },
  holes: { step: 15, w: 10, h: 5, row: 13 }, cranes: { step: 40, jib: 13, mast: 15 },
  bells: { step: 18, out: 8.5, h: 6.2, bell: 1.7 }, banners: { step: 24 },
  balconies: { step: 28, w: 7, out: 5.2, deck: 0.35 },
};

/**
 * Spots along a terrace sector's inner edge inside a quarter, `step` m apart, none within `margin` m of the sector's
 * ends nor within a clearing ({ x, y, z, r }: the story's places, the drops' landings, the mirrors' decks). Pure.
 */
export function edgeSpots(t, q, step, { clear = [], margin = 9, phase = 0.5 } = {}) {
  const out = [], span = t.a1 - t.a0, da = step / t.r0;
  for (let u = (phase * step) / t.r0; u < span; u += da) {
    const a = t.a0 + u;
    if (!inQuarter(q, a) || u * t.r0 < margin || (span - u) * t.r0 < margin) continue;
    const x = Math.cos(a) * t.r0, z = Math.sin(a) * t.r0;
    if (clear.some((c) => Math.abs(c.y - t.y) < 4 && Math.hypot(c.x - x, c.z - z) < c.r + step * 0.3)) continue;
    out.push({ a: norm(a), x, z, y: t.y, r0: t.r0 });
  }
  return out;
}
/** The market's balconies on a terrace sector (the railing leaves a gap at each: src/levels/incal.js). Pure. */
export const balconySpots = (t, clear = []) => edgeSpots(t, QUARTERS[3], PROPS.balconies.step, { clear, phase: 0.35 });
/** The half-width (rad) of a balcony's gap in the railing, on a terrace edge at r0. */
export const balconyGap = (r0) => (PROPS.balconies.w / 2 + 0.6) / r0;
/** The part of a terrace sector's ring inside a quarter: [from, to] (world angles, unwrapped), or null. */
export function spanIn(q, t) {
  const s0 = into(q, t.a0), len = t.a1 - t.a0, qlen = q.a1 - q.a0;
  for (const b of [s0, s0 - TAU]) { const lo = Math.max(0, b), hi = Math.min(qlen, b + len); if (hi - lo > 0.05) return [q.a0 + lo, q.a0 + hi]; }
  return null;
}

// local frame at an edge spot: +x out toward the wall (radially), +z along the ring (the way the angle grows), y up
const frameAt = (a, r, y) => new THREE.Matrix4().makeBasis(new THREE.Vector3(Math.cos(a), 0, Math.sin(a)), new THREE.Vector3(0, 1, 0), new THREE.Vector3(-Math.sin(a), 0, Math.cos(a))).setPosition(Math.cos(a) * r, y, Math.sin(a) * r);
const box = (w, h, d, x, y, z) => new THREE.BoxGeometry(w, h, d).translate(x, y, z);
/** A stick from a to b (local [x, y, z]), t thick. */
const stick = (a, b, t) => {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), len = A.distanceTo(B);
  const g = new THREE.BoxGeometry(t, len, t);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.clone().sub(A).normalize()));
  return g.translate((A.x + B.x) / 2, (A.y + B.y) / 2, (A.z + B.z) / 2);
};
/** A flat triangle list (a gable's strip, a pennant) from points. */
const tris = (pts) => { const g = new THREE.BufferGeometry().setFromPoints(pts.map((p) => (p.isVector3 ? p : new THREE.Vector3(...p)))); g.computeVertexNormals(); return g; };
const clean = (g) => { g = g.index ? g.toNonIndexed() : g; for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k); if (!g.attributes.normal) g.computeVertexNormals(); return g; };

export function buildShaftQuarters(scene, { terraces, R = 260, clear = [] } = {}) {
  const rng = mulberry32(16901);
  // (few kinds of material, differing in their colours only, so the static batches draw each kind in one go)
  const mat = (o) => makeMaterial({ flat: true, shadeFlat: 0, ...o });
  const M = {
    leaf: mat({ color: '#5f8a3e', color2: '#7a9c48', pattern: 'leaves', side: THREE.DoubleSide }),
    leaf2: mat({ color: '#4c7a3c', pattern: 'leaves', side: THREE.DoubleSide }),
    ivy: mat({ color: '#6f9a4c', color2: '#5a8a44', pattern: 'leaves', side: THREE.BackSide }),
    water: mat({ color: '#e4f4f2', side: THREE.DoubleSide }),
    cliff: mat({ color: '#e08f74', color2: '#d07a62', color3: '#eaa892', mode: MODE_STRATA, strataSize: 5, side: THREE.BackSide }),
    hole: mat({ color: '#2a2f4a' }),
    ochre: mat({ color: '#d9a03a' }),
    cab: mat({ color: '#f2c54b' }),
    cab2: mat({ color: '#f3ead8' }),
    glass: mat({ color: '#9fd0d8' }),
    wood: mat({ color: '#8a5a3c', timber: true }),
    copper: mat({ color: '#5fa58e' }),
    bronze: mat({ color: '#c99436', metal: 'brass' }),
    lacquer: mat({ color: '#b8403a', side: THREE.DoubleSide }),
    gold: mat({ color: '#e2b04a', side: THREE.DoubleSide }),
    rope: mat({ color: '#c9b596' }),
    ribbon: ['#c8483a', '#f2c54b', '#5fb7ad', '#e6875f'].map((c) => mat({ color: c, side: THREE.DoubleSide })),
    deck: mat({ color: '#c98a5a', color2: '#b97a4c' }),
    steel: mat({ color: '#7f93a3' }),
    cream: mat({ color: '#f6ecd6', side: THREE.DoubleSide }),
    rose: mat({ color: '#ea9f88', color2: '#e08c75', color3: '#f0b7a3', mode: MODE_STRATA, strataSize: 4, side: THREE.BackSide }),
  };
  const root = new THREE.Group(); root.name = 'The quarters';
  scene.add(root);
  const lod = [], sights = [], bells = [], balconies = [], quarters = QUARTERS.map((q) => ({ ...q, spots: [] }));
  // buckets: one mesh per quarter, level and material (collide: false keeps it out of the collision)
  const buckets = new Map();
  const put = (q, y, m, geo, frame = null, { collide = false } = {}) => {
    const k = `${q.id}@${y}:${m.uuid}:${collide}`;
    if (!buckets.has(k)) buckets.set(k, { q, y, mat: m, collide, geos: [] });
    const g = clean(geo);
    buckets.get(k).geos.push(frame ? g.applyMatrix4(frame) : g);
  };
  const levels = [...new Set(terraces.map((t) => t.y))].sort((a, b) => b - a);
  const above = (y) => { const i = levels.indexOf(y); return i > 0 ? levels[i - 1] : y + 60; };
  const below = (y) => { const i = levels.indexOf(y); return i < levels.length - 1 ? levels[i + 1] : y - 80; };
  const [G, C, B, K] = quarters;
  // (what is on the shaft's wall collides as drawn: the wall is climbed, and a climber stays on the cliff, the banners
  //  and the parked cabs, not inside them; the leaves are foliage, walked and climbed through: the contact audit)
  const WALL = { collide: true };
  const FLORA = new Set([M.leaf, M.leaf2, M.ivy]);
  /** A piece of the shaft's wall seen from inside: angle a0 to a1, y0 to y1, at radius r (ragged: its top and foot jittered). */
  const wallPiece = (a0, a1, y0, y1, r, { ragged = 0, rows = 1 } = {}) => {
    const segs = Math.max(2, Math.ceil(((a1 - a0) * r) / 7));
    const g = new THREE.CylinderGeometry(r, r, y1 - y0, segs, rows, true, Math.PI / 2 - a1, a1 - a0).translate(0, (y0 + y1) / 2, 0);
    if (ragged) {
      const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const y = p.getY(i);
        if (Math.abs(y - y1) < 0.01) p.setY(i, y - rng() * ragged * (y1 - y0));
        else if (Math.abs(y - y0) < 0.01) p.setY(i, y + rng() * ragged * (y1 - y0));
      }
    }
    return g;
  };

  for (const t of terraces) {
    const up = above(t.y), lo = below(t.y);
    // ---------------------------------------------------------------- the hanging gardens
    // vines down the slab's inner face all along, shrubs spilling over its lip; a fall or two off the edge
    for (const s of edgeSpots(t, G, PROPS.vines.step, { clear, margin: 4 })) {
      const w = 2.6 + rng() * 2.4, L = 8 + rng() * 14, m = frameAt(s.a, s.r0 - 0.25, s.y + 0.4);
      const g = new THREE.PlaneGeometry(w, L, 2, 3).translate(0, -L / 2, 0).rotateY(Math.PI / 2);
      const p = g.attributes.position;   // (a ragged hem: the strands hang to different lengths)
      for (let i = 0; i < p.count; i++) if (p.getY(i) < -L + 0.1) p.setY(i, p.getY(i) + rng() * L * 0.45);
      put(G, t.y, rng() < 0.5 ? M.leaf : M.leaf2, g, m);
    }
    for (const s of edgeSpots(t, G, PROPS.shrubs.step, { clear, margin: 6, phase: 0.2 })) {
      const r = 1.2 + rng() * 1.0;
      put(G, t.y, M.leaf2, new THREE.IcosahedronGeometry(r, 0).scale(1.3, 0.75, 1.3).translate(0.9, r * 0.45, 0), frameAt(s.a, s.r0, s.y));
    }
    {
      const spots = edgeSpots(t, G, 40, { clear, margin: 20, phase: 0.6 });
      for (const s of spots.filter((_, i) => i % 3 === 1).slice(0, PROPS.falls.per)) {
        const L = Math.min(t.y - lo - 2, 40 + rng() * 20), w = 3 + rng() * 1.6;
        put(G, t.y, M.water, new THREE.PlaneGeometry(w, L, 1, 2).translate(0, -L / 2 + 0.6, 0).rotateY(Math.PI / 2), frameAt(s.a, s.r0 - 0.6, s.y));
        put(G, t.y, M.leaf, box(1.4, 0.8, w + 2, 0.2, 0.35, 0), frameAt(s.a, s.r0, s.y));   // (the lip it spills from)
        // (its foot, where it lands on the terrace below: the quarter's sight is one of them)
        const under = terraces.find((u) => u.y === lo && norm(s.a - u.a0) <= u.a1 - u.a0 && u.r0 < s.r0 - 1);
        if (under) { const r = Math.max(under.r0 + 3, s.r0 + 1); G.spots.push({ kind: 'fall', at: new THREE.Vector3(Math.cos(s.a) * r, under.y, Math.sin(s.a) * r), y: under.y, a: s.a }); }
      }
    }
    // the wall's ivy over the terrace's houses: big ragged sheets of green, the quarter's colour from across the pit
    {
      const sp = spanIn(G, t);
      if (sp) for (let k = 0; k < PROPS.ivy.per; k++) {
        const w = 0.12 + rng() * 0.16, a0 = sp[0] + rng() * Math.max(0.01, sp[1] - sp[0] - w), y0 = t.y + 8 + rng() * 10, y1 = Math.min(up - 8, y0 + 18 + rng() * 26);
        if (y1 > y0 + 6) put(G, t.y, M.ivy, wallPiece(a0, a0 + w, y0, y1, R - 0.7 - k * 0.05, { ragged: 0.3, rows: 2 }));
      }
    }
    // ---------------------------------------------------------------- the cab-wrights' cliff
    // the wall over the terrace's houses a pink cliff, holes in it in rows with a cab parked in most, nose out;
    // ochre cranes on the edge, their jibs out over the void
    {
      const sp = spanIn(C, t), top = up - 10, bot = t.y + 20;
      if (sp && top > bot + 8) {
        put(C, t.y, M.cliff, wallPiece(sp[0], sp[1], bot, top, R - 0.6, { ragged: 0.08 }), null, WALL);
        const H = PROPS.holes, fake = { ...t, r0: R };   // (along the wall itself)
        for (let row = bot + H.h; row < top - H.h / 2; row += H.row) for (const s of edgeSpots(fake, C, H.step, { clear, margin: 10, phase: rng() })) {
          if (rng() < 0.3) continue;
          const m = frameAt(s.a, R - 1.1, row);
          put(C, t.y, M.hole, new THREE.PlaneGeometry(H.w, H.h).rotateY(-Math.PI / 2), m, WALL);
          put(C, t.y, M.ochre, box(2.0, 0.4, H.w + 0.8, -0.8, -H.h / 2 - 0.2, 0), m, WALL);   // the sill
          if (rng() < 0.72) {
            const cm = rng() < 0.6 ? M.cab : M.cab2, k = 1.5;
            put(C, t.y, cm, box(4.6 * k, 1.3 * k, 2.1 * k, -2.0, -H.h / 2 + 1.0, 0), m, WALL);
            put(C, t.y, cm, new THREE.CylinderGeometry(0.4 * k, 1.05 * k, 1.0 * k, 4, 1).rotateY(Math.PI / 4).scale(1.6, 1, 0.8).translate(-1.6, -H.h / 2 + 2.6, 0), m, WALL);
            put(C, t.y, M.glass, box(0.08, 0.8, 2.2, -5.5, -H.h / 2 + 1.3, 0), m, WALL);
          }
        }
      }
    }
    for (const s of edgeSpots(t, C, PROPS.cranes.step, { clear, margin: 12 })) {
      const P = PROPS.cranes, m = frameAt(s.a, s.r0, s.y), mast = P.mast * (0.8 + rng() * 0.4), jib = P.jib * (0.8 + rng() * 0.4);
      const turn = (rng() - 0.5) * 0.9;   // (each jib turned its own way out over the void, round its mast)
      const jm = m.clone().multiply(new THREE.Matrix4().makeTranslation(1.8, 0, 0)).multiply(new THREE.Matrix4().makeRotationY(turn)).multiply(new THREE.Matrix4().makeTranslation(-1.8, 0, 0));
      put(C, t.y, M.ochre, box(0.8, mast, 0.8, 1.8, mast / 2, 0), m, { collide: true });
      put(C, t.y, M.ochre, box(jib + 3, 0.7, 0.7, 1.8 - jib / 2 + 1, mast, 0), jm);
      put(C, t.y, M.ochre, stick([1.8, mast + 2.2, 0], [1.8 - jib + 1, mast + 0.3, 0], 0.08), jm);   // the jib's stay
      put(C, t.y, M.ochre, box(0.3, 2.4, 0.3, 1.8, mast + 1.2, 0), jm);
      put(C, t.y, M.steel, box(1.8, 1.4, 1.4, 1.8 + 1.8, mast - 0.2, 0), jm);   // the counterweight
      put(C, t.y, M.steel, box(0.06, 7, 0.06, 1.8 - jib + 1, mast - 3.5, 0), jm);
      put(C, t.y, M.cab, box(0.8, 0.6, 0.6, 1.8 - jib + 1, mast - 7.2, 0), jm);   // the hook's block
      if (C.spots.length < 2 && t.y > -100) C.spots.push({ kind: 'crane', at: new THREE.Vector3(Math.cos(s.a) * (s.r0 + 4), s.y, Math.sin(s.a) * (s.r0 + 4)), y: s.y });
    }
    // ---------------------------------------------------------------- the bell quarter
    // a red beam out over the void from a post on the promenade's edge, a little green roof at its end, the bell under
    // it; tall red lacquer banners with a gold edge and a gold sun down the wall behind the houses
    for (const s of edgeSpots(t, B, PROPS.bells.step, { clear, margin: 8 })) {
      const P = PROPS.bells, m = frameAt(s.a, s.r0, s.y), out = P.out * (0.85 + rng() * 0.3), h = P.h, size = P.bell * (0.7 + rng() * 0.6);
      put(B, t.y, M.wood, box(0.55, h + 0.8, 0.55, 1.2, (h + 0.8) / 2, 0), m, { collide: true });
      put(B, t.y, M.lacquer, box(out + 1.8, 0.5, 0.5, 1.0 - out / 2, h, 0), m);
      put(B, t.y, M.wood, stick([1.2, h - 2.6, 0], [-2.0, h - 0.1, 0], 0.26), m);
      put(B, t.y, M.copper, new THREE.ConeGeometry((2.5 * size) / P.bell, 1.4, 4, 1).rotateY(Math.PI / 4).translate(1.2 - out, h + 1.1, 0), m);
      put(B, t.y, M.gold, new THREE.ConeGeometry(0.28, 1.1, 4).translate(1.2 - out, h + 2.2, 0), m);
      put(B, t.y, M.rope, stick([1.2 - out, h - 0.2, 0], [0.4, 1.1, 0.15], 0.05), m);   // the rope, tied off at the railing
      for (const k of [0.3, 0.55, 0.78]) {   // prayer ribbons streaming off the beam
        const x = 1.2 - out * k, L = 1.8 + rng() * 2.2;
        put(B, t.y, M.ribbon[Math.floor(rng() * 4)], new THREE.PlaneGeometry(0.3, L).translate(x, h - L / 2, 0.26), m);
      }
      bells.push({ at: new THREE.Vector3(1.2 - out, h - 0.1, 0).applyMatrix4(m), y: t.y, a: s.a, phase: rng() * TAU, size });
    }
    {
      const sp = spanIn(B, t);
      if (sp) for (let a = sp[0] + 0.03; a < sp[1] - 0.03; a += PROPS.banners.step / R) {
        const h = Math.min(up - t.y - 12, 24 + rng() * 18), w = 5 + rng() * 2;
        if (h < 10 || rng() < 0.25) continue;
        const m = frameAt(a, R - 0.9, up - 9);
        put(B, t.y, M.lacquer, new THREE.PlaneGeometry(w, h).translate(0, -h / 2, 0).rotateY(-Math.PI / 2), m, WALL);
        put(B, t.y, M.gold, box(0.3, 0.5, w + 0.8, -0.2, 0, 0), m, WALL);
        put(B, t.y, M.gold, new THREE.CircleGeometry(w * 0.32, 12).rotateY(-Math.PI / 2).translate(-0.08, -h * 0.35, 0), m, WALL);   // (a gold sun: the Those Who Look Up's)
      }
    }
    // ---------------------------------------------------------------- the balcony market
    // decks out over the void, flush with the promenade, on two struts and two cables, a striped awning and a counter,
    // bunting strung from post to post; the wall behind them rose
    let prev = null;
    for (const s of balconySpots(t, clear)) {
      const P = PROPS.balconies, m = frameAt(s.a, s.r0, s.y), o = P.out, w = P.w, ci = Math.floor(rng() * 4);
      put(K, t.y, M.deck, box(o + 0.6, P.deck, w, -o / 2 + 0.3, -P.deck / 2, 0), m, { collide: true });
      put(K, t.y, M.wood, box(0.12, 1.0, w, -o + 0.1, 0.5, 0), m, { collide: true });   // the rail on its void side
      for (const sz of [-1, 1]) {
        put(K, t.y, M.wood, box(o - 0.4, 1.0, 0.12, -o / 2, 0.5, sz * (w / 2 - 0.06)), m, { collide: true });
        put(K, t.y, M.steel, stick([-o + 0.3, -P.deck, sz * (w / 2 - 0.4)], [-0.15, -6.5, sz * (w / 2 - 1)], 0.2), m);   // a strut to the slab's face
        put(K, t.y, M.steel, stick([-o + 0.3, 0.9, sz * (w / 2 - 0.3)], [1.4, 6.2, sz * (w / 2 - 0.3)], 0.06), m);       // a cable up to the post
        put(K, t.y, M.wood, box(0.25, 6.4, 0.25, 1.4, 3.2, sz * (w / 2 - 0.3)), m, { collide: true });
        put(K, t.y, M.wood, box(0.1, 2.6, 0.1, -o + 0.6, 1.3, sz * (w / 2 - 0.4)), m);
      }
      // the awning: a gable of cloth over the deck, its ridge along the ring, in stripes of a colour and cream
      const n = 6, ax = -o / 2 + 0.3, half = (o + 0.6) / 2 + 0.3;
      for (let k = 0; k < n; k++) {
        const z0 = -w / 2 + (k / n) * w, z1 = z0 + w / n;
        for (const sx of [-1, 1]) put(K, t.y, k % 2 ? M.cream : M.ribbon[ci], tris([[ax, 3.6, z0], [ax + sx * half, 2.6, z0], [ax + sx * half, 2.6, z1], [ax, 3.6, z0], [ax + sx * half, 2.6, z1], [ax, 3.6, z1]]), m);
      }
      put(K, t.y, M.wood, box(1.0, 1.0, w * 0.55, -o + 1.5, 0.5, 0), m, { collide: true });
      for (let q = 0; q < 3; q++) put(K, t.y, M.ribbon[(ci + q + 1) % 4], new THREE.IcosahedronGeometry(0.24, 0).translate(-o + 1.5, 1.2, (q - 1) * 0.8), m);   // goods on the counter
      // bunting from the last balcony's post to this one's (near enough: the same stretch of edge)
      const post = new THREE.Vector3(1.4, 6.0, -(w / 2 - 0.3)).applyMatrix4(m);
      if (prev && prev.distanceTo(post) < PROPS.balconies.step * 1.4) {
        const pts = [], N = 10;
        for (let k = 0; k <= N; k++) { const u = k / N, p = prev.clone().lerp(post, u); p.y -= Math.sin(Math.PI * u) * 1.6; pts.push(p); }
        for (let k = 0; k < N; k++) put(K, t.y, M.ribbon[(ci + k) % 4], tris([pts[k], pts[k + 1], pts[k].clone().lerp(pts[k + 1], 0.5).add(new THREE.Vector3(0, -0.9, 0))]));
      }
      prev = new THREE.Vector3(1.4, 6.0, w / 2 - 0.3).applyMatrix4(m);
      balconies.push({ at: new THREE.Vector3(-o / 2 + 0.3, 0, 0).applyMatrix4(m), y: t.y, a: s.a, r0: s.r0, gap: balconyGap(s.r0) });
    }
    {
      const sp = spanIn(K, t), top = up - 10, bot = t.y + 16;
      if (sp && top > bot + 8) put(K, t.y, M.rose, wallPiece(sp[0], sp[1], bot, top, R - 0.6, { ragged: 0.12 }), null, WALL);
    }
  }
  // merged: one mesh per quarter, level and material; the far ones drop out when you are far above or below them
  const groups = new Map();
  for (const { q, y, mat: m, collide, geos } of buckets.values()) {
    const key = `${q.id}@${y}`;
    if (!groups.has(key)) {
      const g = new THREE.Group(); g.name = `${q.name}, ${y} m`;
      root.add(g); groups.set(key, g); lod.push({ obj: g, y, far: 330 });
    }
    const mesh = new THREE.Mesh(mergeGeometries(geos), m);
    mesh.geometry.computeBoundingSphere();
    mesh.userData.tiled = true;   // (already grouped: tileScene leaves it alone)
    if (!collide) mesh.userData.noCollide = true;
    if (FLORA.has(m)) mesh.userData.flora = true;
    groups.get(key).add(mesh);
  }
  // the bells: one instanced mesh (they swing), a lathe of bronze with a lip
  const prof = [[0.02, 0.05], [0.5, 0], [0.62, -0.15], [0.66, -0.7], [0.82, -1.25], [1.0, -1.45], [0.95, -1.52], [0.02, -1.4]].map(([r, y]) => new THREE.Vector2(r, y));
  const bellGeo = new THREE.LatheGeometry(prof, 10);
  bellGeo.computeVertexNormals();
  const bellMesh = new THREE.InstancedMesh(bellGeo, M.bronze, Math.max(1, bells.length));
  bellMesh.count = bells.length;
  bellMesh.name = 'The bell quarter’s bells';
  bellMesh.userData.noCollide = true; bellMesh.userData.tiled = true; bellMesh.userData.drawFar = Infinity;
  bellMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  root.add(bellMesh);
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3();
  const pose = (b, k) => { _e.set(Math.sin(k) * 0.12, -b.a, Math.cos(k * 0.7) * 0.05, 'YXZ'); _q.setFromEuler(_e); _s.setScalar(b.size); _m.compose(b.at, _q, _s); };
  bells.forEach((b, i) => { pose(b, b.phase); bellMesh.setMatrixAt(i, _m); });
  bellMesh.computeBoundingSphere();
  // each quarter's sight (the level design audit's places): one by the walk, the quarter's own
  // (the gardens' sight: the foot of the fall nearest the middle of the drops' way down through them, 1.42 rad at 36 m,
  //  a leg of the walk with nothing by it: the level design audit, issue #169)
  G.sight = G.spots.slice().sort((p, q) => Math.hypot(p.y - 36, (p.a - 1.42) * 200) - Math.hypot(q.y - 36, (q.a - 1.42) * 200))[0] ?? null;
  C.sight = C.spots[0] ?? null;
  const bb = bells.find((b) => b.y < -200);
  const S0 = (b) => (b ? terraces.find((t) => t.y === b.y && norm(b.a - t.a0) <= t.a1 - t.a0).r0 + 4 : 0);   // (on the promenade by its post)
  const br = S0(bb);
  B.sight = bb ? { kind: 'bell', at: new THREE.Vector3(Math.cos(bb.a) * br, bb.y, Math.sin(bb.a) * br), y: bb.y } : null;
  const toShip = (b) => Math.abs(Math.atan2(Math.sin(b.a), Math.cos(b.a)));   // (the market's sight: the high balcony nearest the ship's side)
  const kb = balconies.filter((b) => b.y > 140).sort((p, q) => toShip(p) - toShip(q))[0];
  K.sight = kb ? { kind: 'balcony', at: kb.at.clone(), y: kb.y } : null;
  const names = { gardens: 'the gardens’ falls', cabs: 'the cab-wrights’ crane', bells: 'the great bells', market: 'the balcony market' };
  for (const q of quarters) if (q.sight) sights.push({ name: names[q.id], at: q.sight.at.clone(), quarter: q.id });
  root.updateMatrixWorld(true);

  return {
    root, quarters, lod, sights, bells, balconies, bellMesh,
    /** The quarter at a point (its angle round the shaft). */
    at: (x, z) => quarterAt(Math.atan2(z, x)),
    /** The bell nearest a point (the bells' sound walks toward it), or null. */
    nearestBell(p) { let best = null, d = Infinity; for (const b of bells) { const e = b.at.distanceToSquared(p); if (e < d) { d = e; best = b; } } return best; },
    /** Per frame: the bells near the camera swing in the updraft. */
    update(dt, t, camera) {
      if (!camera || !bells.length || !bellMesh.visible) return;
      const c = camera.position;
      let any = false;
      for (let i = 0; i < bells.length; i++) {
        const b = bells[i];
        if (Math.abs(b.at.y - c.y) > 60 || b.at.distanceToSquared(c) > 140 * 140) continue;
        pose(b, b.phase + t * (0.9 + (i % 3) * 0.17));
        bellMesh.setMatrixAt(i, _m); any = true;
      }
      if (any) bellMesh.instanceMatrix.needsUpdate = true;
    },
  };
}
