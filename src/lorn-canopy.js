import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeMaterial } from './materials.js';
import { formAxis } from './form.js';
import { jitter } from './world.js';
import { lathe, DARK_POOLS, PATH_POINTS } from './levels/perdide2.js';
import { CANOPY } from './lorn-wood-data.js';
import { Bucket, helix, ring, ribbon, rope, bar, plain } from './lorn-kit.js';

// The keepers' canopy (issue #188, the author's pick of Lorn's explorations, `keepers-canopy`: references/levels/Lorn/
// environment/explorations/keepers-canopy/). The lamp-keepers did not live on the ground: their old village is up in
// the Deep Wood's trunks over the second dark pool, 70 m up, where the lit path runs below. Built into Lorn after the
// rest (src/levels/perdide.js), on trunks of its own (src/lorn-wood-data.js CANOPY: the wood's own trunks and giants
// are left out of its room).
//
//   the stair         a ramp of planks wound round the first trunk from a boardwalk off the path's bank up to its deck
//   the decks         a ring of planks round each trunk at 70 m, railed, propped on struts; little domed huts on two,
//                     lamp-houses hanging under them and under the bridges
//   the bridges       rope bridges from deck to deck (a loop round the path, crossing over it twice) and on to the cap
//                     square: a giant Veil of the keepers' own, its cap's top level with the decks, lamp posts round it
//   the winch         on a jetty out from the winch trunk's deck, right over the second dark pool: a drum and a crank,
//                     the keepers' lamp hanging from the jetty's end on its cord. Let down, it settles into the pool and
//                     lights it (src/story/perdide2.js: the third way to light a pool, as the keepers did)
//   the lookout       a second stair on up the tallest trunk to a ring 120 m up: out over the wood's crowns to the
//                     swamp and the Great Crystal; the keepers' high lamp on its rail
// Everything you stand on is solid as drawn; the ropes you would hold are solid too (you can't walk off a bridge),
// the hangers, cords, ladders and lamps drawn only.
//
//   buildKeepersCanopy(scene, terrain, { veils }) → { foot, stairs, decks, bridges, square, winch, lookout, lamp, sights,
//     beacons, lights, update(dt) }

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const TAU = Math.PI * 2;
/** The ramps' pitch (rad) at their middle: walked, not climbed (about 27°). */
export const STAIR_SLOPE = 0.47;
/** A stair's band round its trunk: from r + IN to r + OUT. */
export const STAIR_BAND = [0.6, 3.0];
const RAIL = 1.05;

export function buildKeepersCanopy(scene, terrain, { veils = null } = {}) {
  const { deck: DECK, lookout: LOOK, deckW } = CANOPY;
  const T = CANOPY.trunks, S = CANOPY.square;
  const ground = (x, z) => terrain.heightAt(x, z);
  const mats = {
    plank: makeMaterial({ color: '#7a5e52', flat: true, timber: { axis: 'x' } }),
    beam: makeMaterial({ color: '#4a3c3a', flat: true, timber: { plank: 0, post: true } }),
    rope: makeMaterial({ color: '#5a4a44', flat: true }),
    hut: makeMaterial({ color: '#9e8f96', flat: true, grid: 1.6 }),
    roof: makeMaterial({ color: '#b39ea2', flat: true }),
    iron: makeMaterial({ color: '#2f2a3a', flat: true }),
    lamp: makeMaterial({ color: '#f2a07a', glow: 1 }),
    door: makeMaterial({ color: '#ffd6a0', glow: 0.95 }),
  };
  const solid = new Bucket(), drawn = new Bucket(), lights = [], sights = [];
  const at = (t, a, r, y) => V(t.x + Math.cos(a) * r, y, t.z + Math.sin(a) * r);
  const head = (a, b) => Math.atan2(b.z - a.z, b.x - a.x);
  const node = (id) => (T[id] ? { ...T[id], out: T[id].r + deckW, y: DECK } : { x: S.x, z: S.z, r: S.stalk, out: S.capR, y: DECK });

  // ---------------------------------------------------------- the great trunks (the wood's look, src/levels/perdide2.js)
  {
    const parts = { '#2f3a4f': [], '#3a4560': [], '#28324a': [] }, keys = Object.keys(parts);
    Object.values(T).forEach((t, k) => {
      const g0 = ground(t.x, t.z), r = t.r;
      const trunk = formAxis(new THREE.CylinderGeometry(r * 0.86, r, t.h, 14, 6, true), 'wrap').translate(0, t.h / 2, 0);
      jitter(trunk, 0.08, 0.05, 700 + k);
      // (a short flare: the stair's band starts just past it, src/lorn-wood-data.js)
      const flare = formAxis(lathe([[r * 1.35, -1.5], [r * 1.12, 0.6], [r * 1.04, 2.5], [r * 1.0, 5]], 14), 'wrap');
      for (const g of [trunk, flare]) { g.translate(t.x, g0 - 0.5, t.z); g.deleteAttribute('uv'); }
      parts[keys[k % 3]].push(trunk.toNonIndexed(), flare.toNonIndexed());
    });
    for (const [c, l] of Object.entries(parts)) if (l.length) {
      const m = new THREE.Mesh(mergeGeometries(l), makeMaterial({ color: c, flat: true, pattern: 'cracks', detail: 'organic', form: true }));
      m.name = 'The keepers’ trunks';
      m.userData.castShadow = true;
      scene.add(m);
    }
  }

  // ---------------------------------------------------------- the stairs
  const stairs = [];
  const railAlong = (pts) => {
    // posts every ~2 m and a rope at hand height along a run of points (the rail's own line)
    solid.add('rope', rope(pts.map((p) => p.clone().setY(p.y + RAIL)), 0.06));
    let acc = 0;
    for (let i = 0; i < pts.length; i++) {
      if (i) acc += pts[i].distanceTo(pts[i - 1]);
      if (i === 0 || i === pts.length - 1 || acc > 2) { acc = 0; solid.add('beam', bar(pts[i].clone().setY(pts[i].y - 0.2), pts[i].clone().setY(pts[i].y + RAIL), 0.07)); }
    }
  };
  const stair = (t, y0, y1, a0, dir) => {
    const H = helix({ cx: t.x, cz: t.z, ri: t.r + STAIR_BAND[0], ro: t.r + STAIR_BAND[1], y0, y1, a0, dir, slope: STAIR_SLOPE });
    solid.add('plank', H.geo);
    // its rail round the outside, stopping a step short of the top (you walk off it onto the deck)
    const n = Math.ceil(H.A / 0.12), pts = [];
    for (let i = 0; i <= n; i++) {
      const k = i / n, a = a0 + dir * H.A * k;
      if (H.A * (1 - k) * H.rise < 0.4) break;
      pts.push(at(t, a, H.ro - 0.12, y0 + (y1 - y0) * k));
    }
    railAlong(pts);
    // struts under it into the trunk, every quarter turn
    for (let a = 0.3; a < H.A; a += Math.PI / 2) {
      const y = y0 + (y1 - y0) * (a / H.A), aa = a0 + dir * a;
      if (y - 2.5 > ground(t.x, t.z)) drawn.add('beam', bar(at(t, aa, t.r, y - 2.8), at(t, aa, H.ro - 0.3, y - 0.35), 0.1));
    }
    stairs.push(H);
    return H;
  };
  // the first: from a boardwalk off the path's bank, round its trunk from the side facing the path up to the deck
  const near = PATH_POINTS.reduce((best, p) => (Math.hypot(p.x - T.stair.x, p.z - T.stair.z) < Math.hypot(best.x - T.stair.x, best.z - T.stair.z) ? p : best));
  const a0 = head(T.stair, near), rm = T.stair.r + (STAIR_BAND[0] + STAIR_BAND[1]) / 2;
  const S1 = stair(T.stair, 0.75, DECK, a0, 1);
  // the boardwalk: from the bank (3 m off the path's middle) out over the shallows to the ramp's first plank, on posts
  const toT = V(T.stair.x - near.x, 0, T.stair.z - near.z).normalize();
  const foot = V(near.x, 0.62, near.z).addScaledVector(toT, 3);
  const bend = at(T.stair, a0 - 0.5, rm, 0.72), start = at(T.stair, a0 + 0.02, rm, 0.77);
  {
    const mid = foot.clone().lerp(bend, 0.5).setY(0.68);
    solid.add('plank', ribbon([foot, mid, bend, start], 2.2, 0.3));
    const n = V(bend.z - foot.z, 0, -(bend.x - foot.x)).normalize();
    for (const p of [mid, bend]) for (const s of [-0.95, 0.95]) {
      const q = p.clone().addScaledVector(n, s);
      solid.add('beam', bar(V(q.x, ground(q.x, q.z) - 0.5, q.z), V(q.x, 0.4, q.z), 0.14));
    }
  }
  // the second: from the tallest trunk's deck on up to the lookout
  const tallFrom = head(T.tall, T.stair) + 1.2;   // (starting off the side away from its bridges)
  const S2 = stair(T.tall, DECK + 0.02, LOOK, tallFrom, -1);

  // ---------------------------------------------------------- the decks
  const decks = {}, bridgeHeads = {};
  for (const [a, b] of CANOPY.bridges) {
    (bridgeHeads[a] ??= []).push(head(node(a), node(b)));
    (bridgeHeads[b] ??= []).push(head(node(b), node(a)));
  }
  // the winch's jetty: out from its trunk's deck to just past the pool, over it
  const P1 = DARK_POOLS[1], jetHead = head(T.winch, P1), jetLen = Math.hypot(P1.x - T.winch.x, P1.z - T.winch.z) + 2.4;
  (bridgeHeads.winch ??= []).push(jetHead);
  for (const [id, t] of Object.entries(T)) {
    const ro = t.r + deckW;
    // where a stair comes up through it, nothing laid inside the stair's band (head room under the deck)
    const gaps = [];
    for (const H of stairs) if (H.cx === t.x && H.cz === t.z && Math.abs(H.y1 - DECK) < 0.1) {
      const back = (2.6 / H.rise) + 0.15, e = H.a1;
      gaps.push(H.dir > 0 ? [e - back, e, H.ro + 0.4] : [e, e + back, H.ro + 0.4]);
    }
    solid.add('plank', ring({ cx: t.x, cz: t.z, ri: t.r + 0.05, ro, y: DECK, th: 0.5, gaps }));
    // struts from the trunk out under the rim, and a ring beam under it
    for (let k = 0; k < 10; k++) {
      const a = (k / 10) * TAU;
      drawn.add('beam', bar(at(t, a, t.r, DECK - 6), at(t, a, ro - 0.6, DECK - 0.5), 0.14));
    }
    const ringPts = Array.from({ length: 33 }, (_, i) => at(t, (i / 32) * TAU, ro - 0.5, DECK - 0.75));
    drawn.add('beam', rope(ringPts, 0.16, 5));
    // its rail, but where a bridge or the jetty leaves it
    const heads = bridgeHeads[id] ?? [], gapA = 1.25 / ro;
    const open = (a) => heads.some((h) => Math.abs(((a - h + Math.PI * 3) % TAU) - Math.PI) < gapA);
    let run = [];
    const flush = () => { if (run.length > 1) railAlong(run); run = []; };
    const n = 72;
    let k0 = 0;
    while (k0 < n && !open((k0 / n) * TAU)) k0++;   // (start just past a gap, so no run wraps round)
    for (let i = 0; i <= n; i++) {
      const a = ((k0 + i) / n) * TAU;
      if (open(a)) flush(); else run.push(at(t, a, ro - 0.15, DECK));
    }
    flush();
    decks[id] = { x: t.x, z: t.z, y: DECK, ri: t.r, ro };
  }
  // the lookout's ring, 120 m up the tallest: a gap where its stair comes up, a rail all round
  {
    const t = T.tall, ro = t.r + 4.2, back = (2.6 / S2.rise) + 0.15, e = S2.a1;
    solid.add('plank', ring({ cx: t.x, cz: t.z, ri: t.r + 0.05, ro, y: LOOK, th: 0.4, gaps: [S2.dir > 0 ? [e - back, e, S2.ro + 0.4] : [e, e + back, S2.ro + 0.4]] }));
    railAlong(Array.from({ length: 49 }, (_, i) => at(t, (i / 48) * TAU, ro - 0.15, LOOK)));
    for (let k = 0; k < 8; k++) { const a = (k / 8) * TAU; drawn.add('beam', bar(at(t, a, t.r, LOOK - 4), at(t, a, ro - 0.5, LOOK - 0.4), 0.12)); }
  }

  // ---------------------------------------------------------- the bridges
  const bridges = [];
  for (const [a, b] of CANOPY.bridges) {
    const A = node(a), B = node(b), h = head(A, B), d = V(Math.cos(h), 0, Math.sin(h));
    const p0 = V(A.x, DECK + 0.03, A.z).addScaledVector(d, A.out - 0.4), p1 = V(B.x, DECK + 0.03, B.z).addScaledVector(d, -(B.out - 0.4));
    const L = p0.distanceTo(p1), sag = Math.min(1.4, L * 0.035), n = Math.max(6, Math.ceil(L / 1.2));
    const pts = Array.from({ length: n + 1 }, (_, i) => { const k = i / n; return p0.clone().lerp(p1, k).setY(DECK + 0.03 - sag * 4 * k * (1 - k)); });
    solid.add('plank', ribbon(pts, 1.8, 0.22));
    const side = V(-d.z, 0, d.x);
    for (const s of [-1, 1]) {
      const edge = pts.map((p) => p.clone().addScaledVector(side, s * 0.95));
      railAlong(edge);
      // the suspension ropes: from a post at each end, sagging a little deeper than the deck, hangers down to it (drawn only)
      const hang = edge.map((p, i) => { const k = i / n; return p.clone().setY(DECK + 2.2 - (sag + 1.4) * 4 * k * (1 - k)); });
      solid.add('rope', rope(hang, 0.05));   // (held, like the rail: solid)
      for (let i = 1; i < n; i += 2) drawn.add('rope', bar(edge[i].clone().setY(edge[i].y + RAIL), hang[i], 0.025, 3));
      for (const p of [edge[0], edge.at(-1)]) solid.add('beam', bar(p.clone().setY(DECK - 0.3), p.clone().setY(DECK + 2.4), 0.12));
    }
    bridges.push({ from: a, to: b, points: pts, length: L });
    // (the one over the second pool, the lit path straight below through the gaps: the sheet's look down)
    if (a === 'winch' && b === 'huts') sights.push({ name: 'the bridge over the lit path', at: pts[Math.floor(n / 2)].clone().setY(pts[Math.floor(n / 2)].y + 0.3) });
  }

  // ---------------------------------------------------------- the cap square
  let square = null;
  {
    const g0 = ground(S.x, S.z), R = S.capR, sr = S.stalk, top = DECK;
    const stalkPts = [[sr * 1.9, g0 - 1.5], [sr * 1.5, g0 + 1], [sr * 1.1, g0 + 6], [sr, g0 + 25], [sr * 0.95, top - 9], [sr * 1.4, top - 4.2]];
    const underPts = [[sr * 1.4, top - 4.2], [R * 0.55, top - 2.6], [R * 0.92, top - 1.6], [R, top - 1.2]];
    const topPts = [[R, top - 1.2], [R * 1.02, top - 0.45], [R * 0.97, top - 0.02], [R * 0.6, top + 0.2], [R * 0.3, top + 0.32], [0, top + 0.36]];
    const shift = (g) => { g.translate(S.x, 0, S.z); g.deleteAttribute('uv'); return g; };
    const stalk = shift(formAxis(lathe(stalkPts.map(([r, y]) => [r, y]), 18), 'cap')), under = shift(formAxis(lathe(underPts, 36), 'cap')), capTop = shift(formAxis(lathe(topPts, 36), 'cap'));
    // (a Veil like the wood's: the stalk and the gills half see-through, src/veil.js; its top solid and drawn whole, you stand on it)
    const veil = (c, v, glow) => makeMaterial({ color: c, flat: true, glow, shade: 0.6, hatch: 0.4, detail: 'organic', detailDensity: 0.7, form: true, ...(v ? { veil: v, line: 0.7, lineTint: 0.67 } : {}) });
    const ms = [[stalk, '#b9b3d9', 0.5, 0], [under, '#b5abe0', 0.42, 0.3], [capTop, '#ddd6f6', 0, 0.2]].map(([g, c, v, glow]) => {
      const m = new THREE.Mesh(g.toNonIndexed(), veil(c, v, glow));
      m.name = 'The cap square';
      scene.add(m);
      if (v && veils) veils.add(m, { color: c, glow, ...(g === stalk ? { alpha: 0.4 } : {}) });
      return m;
    });
    void ms;
    // lamp posts round its rim, a rope between them but where the bridge comes in
    const h = head(S, T.huts), posts = [];
    for (let k = 0; k < 14; k++) {
      const a = h + 0.35 + (k / 13) * (TAU - 0.7), p = at(S, a, R - 0.8, top - 0.05);
      posts.push(p);
      solid.add('beam', bar(p.clone().setY(p.y - 0.3), p.clone().setY(p.y + 1.8), 0.08));
      if (k % 3 === 0) { drawn.add('iron', plain(new THREE.ConeGeometry(0.3, 0.3, 6).translate(p.x, p.y + 2.05, p.z))); drawn.add('lamp', plain(new THREE.CylinderGeometry(0.18, 0.18, 0.4, 6).translate(p.x, p.y + 1.7, p.z))); }
    }
    solid.add('rope', rope(posts.map((p) => p.clone().setY(p.y + RAIL)), 0.06));
    // a bench and the keepers' brazier in the middle
    drawn.add('iron', plain(new THREE.CylinderGeometry(0.7, 0.45, 0.7, 8).translate(S.x, top + 0.7, S.z)));
    drawn.add('lamp', plain(new THREE.SphereGeometry(0.45, 8, 6).translate(S.x, top + 1.15, S.z)));
    solid.add('plank', plain(new THREE.BoxGeometry(3, 0.15, 0.7).rotateY(-h).translate(S.x + Math.cos(h + 1.6) * 4, top + 0.75, S.z + Math.sin(h + 1.6) * 4)));
    lights.push(new THREE.Vector4(S.x, top + 3, S.z, 12));
    square = { x: S.x, z: S.z, top: V(S.x, top + 0.36, S.z), rim: R };
    sights.push({ name: 'the cap square', at: V(S.x, top + 0.4, S.z) });
  }

  // ---------------------------------------------------------- huts, lamp-houses, ladders
  const hut = (t, a, r = 2.1) => {
    const c = at(t, a, t.r + deckW - 2.7, DECK);
    solid.add('hut', plain(new THREE.CylinderGeometry(r, r * 1.05, 2.3, 14, 1).translate(c.x, DECK + 1.15, c.z)));
    solid.add('roof', plain(new THREE.SphereGeometry(r * 1.12, 14, 7, 0, TAU, 0, Math.PI / 2).scale(1, 0.95, 1).translate(c.x, DECK + 2.3, c.z)));
    drawn.add('beam', plain(new THREE.CylinderGeometry(0.05, 0.05, 1.1, 4).translate(c.x, DECK + 2.3 + r * 1.05 + 0.4, c.z)));
    // its round door, lit, facing out
    const o = V(Math.cos(a), 0, Math.sin(a)), d = c.clone().addScaledVector(o, r + 0.02).setY(DECK + 0.95);
    const door = new THREE.CircleGeometry(0.62, 14);
    door.lookAt(o); door.translate(d.x, d.y, d.z);
    drawn.add('door', plain(door));
    lights.push(new THREE.Vector4(d.x + o.x * 1.5, d.y, d.z + o.z * 1.5, 7));
    return c;
  };
  const hutsAt = [hut(T.huts, head(T.huts, T.tall) + 1.6), hut(T.huts, head(T.huts, T.winch) - 1.3, 1.7), hut(T.stair, head(T.stair, T.tall) + 1.5, 1.8)];
  sights.push({ name: 'the keepers’ huts', at: hutsAt[0].clone().setY(DECK + 0.3) });
  const lampHouse = (p, drop) => {
    // an onion lamp-house hanging on its cord (drawn only): a dark cap, a glowing body, a ring round its waist
    const y = p.y - drop;
    drawn.add('rope', bar(V(p.x, y + 1.3, p.z), p, 0.025, 3));
    drawn.add('lamp', plain(lathe([[0.01, -0.9], [0.45, -0.7], [0.75, -0.2], [0.7, 0.35], [0.45, 0.75], [0.05, 1.0]], 10).translate(p.x, y, p.z)));
    drawn.add('iron', plain(new THREE.ConeGeometry(0.85, 0.7, 10).translate(p.x, y + 1.25, p.z)), plain(new THREE.TorusGeometry(0.76, 0.06, 4, 12).rotateX(Math.PI / 2).translate(p.x, y + 0.1, p.z)));
    lights.push(new THREE.Vector4(p.x, y, p.z, 6));
  };
  for (const [id, t] of Object.entries(T)) for (let k = 0; k < 3; k++) {
    const a = (k / 3) * TAU + (id.length * 0.7), r = t.r + deckW - 1.2;
    lampHouse(at(t, a, r, DECK - 0.8), 3 + ((k + id.length) % 3) * 2.2);
  }
  for (const B of bridges) lampHouse(B.points[Math.floor(B.points.length / 2)].clone().setY(B.points[Math.floor(B.points.length / 2)].y - 0.3), 2.5 + (B.length % 3));
  // the keepers' ladders up two of the trunks, from the water to the decks (drawn: the stair is the way up)
  for (const [t, a] of [[T.winch, head(T.winch, P1) + 0.9], [T.huts, head(T.huts, T.winch) + 0.6]]) {
    const g0 = ground(t.x, t.z), o = V(Math.cos(a), 0, Math.sin(a)), s = V(-o.z, 0, o.x), r = t.r * 0.93 + 0.25;
    for (const k of [-0.32, 0.32]) {
      const b0 = V(t.x, g0, t.z).addScaledVector(o, r).addScaledVector(s, k);
      drawn.add('beam', bar(b0, b0.clone().setY(DECK - 0.5), 0.05, 4));
    }
    for (let y = g0 + 0.5; y < DECK - 0.6; y += 0.6) drawn.add('beam', bar(V(t.x, y, t.z).addScaledVector(o, r).addScaledVector(s, -0.32), V(t.x, y, t.z).addScaledVector(o, r).addScaledVector(s, 0.32), 0.035, 3));
  }

  // ---------------------------------------------------------- the winch
  let winch = null;
  {
    const t = T.winch, d = V(Math.cos(jetHead), 0, Math.sin(jetHead)), side = V(-d.z, 0, d.x);
    const j0 = V(t.x, DECK, t.z).addScaledVector(d, t.r + deckW - 0.6), j1 = V(t.x, DECK, t.z).addScaledVector(d, jetLen);
    solid.add('plank', ribbon([j0, j1], 3.2, 0.45));
    for (const s of [-1, 1]) railAlong([j0, j1].map((p) => p.clone().addScaledVector(side, s * 1.45)));
    railAlong([j1.clone().addScaledVector(side, -1.45).addScaledVector(d, -0.15), j1.clone().addScaledVector(side, 1.45).addScaledVector(d, -0.15)]);
    // struts under the jetty back to the trunk
    for (const s of [-1, 1]) drawn.add('beam', bar(V(t.x, DECK - 9, t.z).addScaledVector(d, t.r).addScaledVector(side, s * 1.2), j1.clone().addScaledVector(d, -1).addScaledVector(side, s * 1.2).setY(DECK - 0.45), 0.16));
    // the pulley arm over the pool: a gallows at the jetty's end, the cord down from its sheave
    const pool = V(P1.x, DECK, P1.z), arm0 = pool.clone().addScaledVector(d, -2.2), sheave = pool.clone().setY(DECK + 3.6);
    solid.add('beam', bar(arm0.clone().addScaledVector(side, 0.9), arm0.clone().addScaledVector(side, 0.9).setY(DECK + 3.9), 0.12));
    drawn.add('beam', bar(arm0.clone().addScaledVector(side, 0.9).setY(DECK + 3.8), sheave.clone().setY(DECK + 3.8), 0.1));
    drawn.add('iron', plain(new THREE.TorusGeometry(0.32, 0.08, 5, 12).lookAt(side).translate(sheave.x, sheave.y, sheave.z)));
    // the drum on its frame, with its crank, a few metres back toward the trunk
    const drum = V(t.x, DECK, t.z).addScaledVector(d, jetLen - 6);
    solid.add('beam', ...[-1, 1].map((s) => plain(new THREE.BoxGeometry(0.25, 1.5, 0.25).translate(drum.x + side.x * s * 1.1, DECK + 0.75, drum.z + side.z * s * 1.1))));
    drawn.add('rope', plain(new THREE.CylinderGeometry(0.45, 0.45, 1.8, 12).rotateZ(Math.PI / 2).rotateY(-Math.atan2(side.z, side.x)).translate(drum.x, DECK + 1.3, drum.z)));
    drawn.add('iron', bar(drum.clone().addScaledVector(side, 1.2).setY(DECK + 1.3), drum.clone().addScaledVector(side, 1.6).setY(DECK + 1.3), 0.06),
      bar(drum.clone().addScaledVector(side, 1.6).setY(DECK + 1.3), drum.clone().addScaledVector(side, 1.6).setY(DECK + 0.75), 0.05));
    drawn.add('rope', bar(drum.clone().setY(DECK + 1.75), sheave.clone().setY(DECK + 3.75), 0.03, 3));
    // the keepers' lamp: a great coral glass in an iron cage, hanging from the sheave on its cord (it moves)
    const lampG = new THREE.Group();
    lampG.name = 'The keepers’ lamp';
    const cage = new Bucket();
    cage.add('iron', plain(new THREE.ConeGeometry(0.75, 0.6, 8).translate(0, 1.6, 0)), plain(new THREE.TorusGeometry(0.85, 0.07, 4, 14).rotateX(Math.PI / 2)), plain(new THREE.TorusGeometry(0.62, 0.06, 4, 14).rotateX(Math.PI / 2).translate(0, -1.05, 0)));
    for (let k = 0; k < 6; k++) { const a = (k / 6) * TAU; cage.add('iron', bar(V(Math.cos(a) * 0.65, -1.05, Math.sin(a) * 0.65), V(Math.cos(a) * 0.6, 1.35, Math.sin(a) * 0.6), 0.04, 3)); }
    cage.add('lamp', plain(lathe([[0.01, -1.1], [0.5, -0.95], [0.82, -0.3], [0.8, 0.5], [0.55, 1.15], [0.05, 1.35]], 12)));
    for (const m of cage.meshes(mats, { solid: false })) lampG.add(m);
    const cord = new THREE.Mesh(plain(new THREE.CylinderGeometry(0.03, 0.03, 1, 3).translate(0, -0.5, 0)), mats.rope);
    cord.userData.noCollide = true;
    cord.position.copy(sheave);
    lampG.traverse((o) => { o.userData.noCollide = true; });
    scene.add(lampG, cord);
    const upY = DECK - 7, downY = Math.max(ground(P1.x, P1.z), 0) + 1.45;
    const light = new THREE.Vector4(P1.x, upY, P1.z, 9);
    lights.push(light);
    const W = { y: upY, goal: upY, onDown: null };
    const place = () => {
      lampG.position.set(P1.x, W.y, P1.z);
      cord.scale.y = Math.max(0.1, sheave.y - (W.y + 1.6));
      light.y = W.y;
    };
    place();
    winch = {
      at: drum.clone().addScaledVector(side, -1.6).setY(DECK),   // (where you stand to turn it: beside the drum)
      drum: drum.clone().setY(DECK + 1.3), sheave, pool: V(P1.x, downY, P1.z),
      get down() { return W.y <= downY + 0.05; },
      get moving() { return W.goal !== W.y; },
      lamp: () => lampG.position,
      /** Let the lamp down (onDown: when it settles in the pool). */
      lower(onDown = null) { W.goal = downY; W.onDown = onDown; },
      raise() { W.goal = upY; W.onDown = null; },
      /** Down already (a save with the pool lit by it). */
      set(down) { W.y = W.goal = down ? downY : upY; place(); },
      update(dt) {
        if (W.y === W.goal) return;
        const sp = W.goal < W.y ? 11 : 7;
        W.y = W.goal < W.y ? Math.max(W.goal, W.y - sp * dt) : Math.min(W.goal, W.y + sp * dt);
        place();
        if (W.y === W.goal && W.goal === downY && W.onDown) { const f = W.onDown; W.onDown = null; f(); }
      },
    };
    sights.push({ name: 'the keepers’ winch', at: drum.clone().setY(DECK + 0.3) });
  }

  // ---------------------------------------------------------- the lookout's high lamp
  const toCrystal = head(T.tall, { x: 120, z: -150 }), lampTop = at(T.tall, toCrystal + 0.4, T.tall.r + 4.0, LOOK);
  solid.add('beam', bar(lampTop.clone().setY(LOOK - 0.3), lampTop.clone().setY(LOOK + 2.6), 0.1));
  drawn.add('iron', plain(new THREE.ConeGeometry(0.55, 0.5, 6).translate(lampTop.x, LOOK + 3.15, lampTop.z)));
  drawn.add('lamp', plain(new THREE.CylinderGeometry(0.38, 0.38, 0.8, 6).translate(lampTop.x, LOOK + 2.6, lampTop.z)));
  lights.push(new THREE.Vector4(lampTop.x, LOOK + 2.6, lampTop.z, 14));
  const lookout = at(T.tall, toCrystal, T.tall.r + 3.4, LOOK);   // (at the rail facing the swamp, the lamp a step aside)
  sights.push({ name: 'the keepers’ lookout', at: lookout.clone().setY(LOOK + 0.3) }, { name: 'the keepers’ stair', at: foot.clone() });

  // ---------------------------------------------------------- into the scene
  const g = new THREE.Group();
  g.name = 'The keepers’ canopy';
  for (const m of solid.meshes(mats, { name: 'The keepers’ canopy' })) g.add(m);
  for (const m of drawn.meshes(mats, { solid: false, name: 'The keepers’ canopy, drawn' })) g.add(m);
  scene.add(g);
  return {
    foot, stairs: [S1, S2], decks, bridges, square, winch, lookout, lamp: lampTop.clone().setY(LOOK + 2.6), sights, lights,
    beacons: [{ name: 'the keepers’ high lamp', top: [lampTop.x, LOOK + 3.4, lampTop.z], height: LOOK + 3.4 - ground(T.tall.x, T.tall.z) }],
    update(dt) { winch.update(dt); },
  };
}
