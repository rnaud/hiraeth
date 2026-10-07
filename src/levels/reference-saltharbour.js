import * as THREE from 'three';
import { mulberry32 } from '../noise.js';
import { V, CLEAN_SKY, n1, n2, gauss } from './reference-kit.js';
import { hull, portholes, houseStack, superstructure, cloth, curtain, gangway, rope, stake, stall, archDoor, herbs, figure, SALT_LOOK, SALT_TONES } from './salt-harbour-kit.js';

// ---------------------------------------------------------------------------
// The Salt Harbour's reference pictures (references/The Salt Harbour/reference-1 … 4): huge weathered
// ships standing on their keels in a dry white salt basin, made into apartment buildings; a street
// between their immense curved hulls, white over terracotta, gangways joining the decks overhead,
// pale sailcloth shading the street, shops cut into the hulls' feet, herbs on the ledges, long
// mooring ropes staked into the salt, the open flats at the street's end, the traveller with the
// luminous pack crossing the foreground. Each picture is one composition: one view each. One scene
// builder (harbourScene) does them all (reference-views.js describes the fields).
// ---------------------------------------------------------------------------

const sheet = (n) => ({ name: `The Salt Harbour / reference-${n}.jpeg`, size: [1456, 816], url: new URL(`../../references/The Salt Harbour/reference-${n}.jpeg`, import.meta.url).href });
export const SALT_SHEETS = Object.fromEntries([1, 2, 3, 4].map((n) => [`saltharbour-${n}`, sheet(n)]));

/** The pictures' ink: the world's own look (salt-harbour-kit.js) and a clean sky. */
export const SALT_VIEW_LOOK = { ...SALT_LOOK, ...CLEAN_SKY };
/** sky top, horizon, shadow (the blue-grey of the shade on the salt), light, sun */
const SKY = {
  noon: ['#4a86cc', '#b8d2ea', '#8ea6d6', '#fff8ee', '#fff2dc'],
  pale: ['#5a8cd0', '#c4d8ec', '#94aad6', '#fff8f0', '#fff4e0'],
  warm: ['#6f9ad2', '#d0dcea', '#9aaad0', '#fff2e2', '#ffeacc'],
};

function materials(kit) {
  const T = SALT_TONES, DS = THREE.DoubleSide;
  return {
    // the hulls: plated, fine pen seams and weathering, their shade the world's flat blue-grey
    hull: kit.mat({ color: T.hull, plates: 9, hatch: 0.25, shade: 0.15 }),
    hull2: kit.mat({ color: T.hull2, plates: 10, hatch: 0.25, shade: 0.15 }),
    red: kit.mat({ color: T.red, plates: 9, hatch: 0.25, shade: 0.1 }),
    red2: kit.mat({ color: T.red2, plates: 10, hatch: 0.25, shade: 0.1 }),
    deck: kit.mat({ color: T.deck, flat: true }),
    wood: kit.mat({ color: T.wood, flat: true, pattern: 'cracks' }),
    wood2: kit.mat({ color: T.wood2, flat: true }),
    woodDark: kit.mat({ color: T.woodDark, flat: true }),
    plaster: kit.mat({ color: T.plaster, flat: true, weathered: 0.4 }),
    dark: kit.mat({ color: T.dark, flat: true }),
    glow: kit.mat({ color: T.glow, glow: 0.9, flat: true }),
    // the sailcloth: soft pale masses, a light line of their own
    cloth: kit.mat({ color: T.cloth, side: DS, shade: 0.35, hatch: 0.2, line: 0.7, lineTint: 0.6 }),
    cloth2: kit.mat({ color: T.cloth2, side: DS, shade: 0.35, hatch: 0.2, line: 0.7, lineTint: 0.6 }),
    rope: kit.mat({ color: T.rope, flat: true }),
    iron: kit.mat({ color: T.iron, flat: true }),
    pot: kit.mat({ color: T.pot, flat: true }),
    leaves: kit.mat({ color: T.leaves, pattern: 'leaves', hatch: 0.6, shade: 0.4, line: 0.7, lineTint: 0.7 }),
    goods: T.goods.map((c) => kit.mat({ color: c, flat: true })),
    cloaks: T.cloak.map((c) => kit.mat({ color: c, flat: true, figure: true })),
    skin: kit.mat({ color: T.skin, flat: true, figure: true }),
    blue: kit.mat({ color: T.travellerBlue, flat: true, figure: true }),
    brown: kit.mat({ color: T.travellerBrown, flat: true, figure: true }),
    pack: kit.mat({ color: T.pack, glow: 0.7, flat: true }),
    packRim: kit.mat({ color: '#3a4a5a', flat: true, figure: true }),
    hood: kit.mat({ color: '#2f3a52', flat: true, figure: true }),
  };
}

const NC = { solid: false, shadow: false };
const SH = { solid: false, shadow: true };
const turn = (g, yaw, x, y, z) => g.rotateY(yaw).translate(x, y, z);

/**
 * A ship on its keel at (x, z), its bow toward yaw (0: -z, away from the camera), sunk `sink` m into the salt;
 * its plating white over a terracotta bottom (`band` m), or terracotta to its top band (`red`); portholes,
 * house stacks on its flanks, shops at its feet, upper works on its deck. o: hull options + { x, z, yaw, sink,
 * red, ports, stacks: [{ t, y, side, w, floors }], doors: [{ t, side }], stalls: [{ t, side, w }], sup: [{ t, w, d,
 * tiers }], far }. Returns { H, put(p): the ship's local point into the view, on(t, y, side): { p, n } in the view }.
 */
function ship(kit, M, rng, o) {
  const yaw = (o.yaw ?? 0) + Math.PI, sink = o.sink ?? 0, H = hull(o), c = Math.cos(yaw), s = Math.sin(yaw);
  const put = (p) => V(o.x + p.x * c + p.z * s, p.y - sink, o.z - p.x * s + p.z * c);
  const dir = (n) => V(n.x * c + n.z * s, n.y, -n.x * s + n.z * c);
  const on = (t, y, side = 1) => { const a = H.at(t, y); if (side < 0) { a.p.x = -a.p.x; a.n.x = -a.n.x; } return { p: put(a.p), n: dir(a.n) }; };
  const white = o.red ? M.red : o.far ? M.hull2 : M.hull, red = o.red ? M.hull : o.far ? M.red2 : M.red;
  for (const g of H.white) kit.add(white, turn(g, yaw, o.x, -sink, o.z), { solid: !o.far, shadow: true });
  for (const g of H.red) kit.add(red, turn(g, yaw, o.x, -sink, o.z), { solid: !o.far, shadow: true });
  for (const g of H.deck) kit.add(M.deck, turn(g, yaw, o.x, -sink, o.z), SH);
  if (o.ports !== false) {
    const P = portholes(H, { rows: o.ports?.rows ?? [H.D * 0.55, H.D * 0.68, H.D * 0.8], step: o.ports?.step ?? 7, r: o.ports?.r ?? 0.7, seed: o.x + o.z, lit: o.ports?.lit ?? 0.1, t0: o.ports?.t0 ?? 0.1, t1: o.ports?.t1 ?? 0.9 });
    for (const g of P.dark) kit.add(M.dark, turn(g, yaw, o.x, -sink, o.z), NC);
    for (const g of P.glow) kit.add(M.glow, turn(g, yaw, o.x, -sink, o.z), NC);
    for (const g of P.rim) kit.add(M.iron, turn(g, yaw, o.x, -sink, o.z), NC);
  }
  // house stacks on its flanks (the street's side): storeys of cabins built out from the plating
  for (const st of o.stacks ?? []) {
    const { p, n } = on(st.t, st.y + sink, st.side ?? 1), a = Math.atan2(n.x, n.z);
    const S = houseStack({ x0: -st.w / 2, x1: st.w / 2, y0: 0, floors: st.floors ?? 4, fh: st.fh ?? 3.4, depth: st.depth ?? [2, 4.5], seed: st.seed ?? o.x * 3 + st.t * 17, lit: st.lit ?? 0.15 });
    const at = (g) => g.translate(0, 0, -(st.back ?? 1)).rotateY(a).translate(p.x, p.y, p.z);
    for (const [k, m] of [['wood', M.wood], ['plaster', M.plaster], ['dark', M.dark], ['glow', M.glow], ['cloth', M.cloth], ['pot', M.pot], ['leaves', M.leaves]]) for (const g of S[k]) kit.add(m, at(g), NC);
  }
  for (const d of o.doors ?? []) {
    const { p, n } = on(d.t, sink + (d.y ?? 0.2), d.side ?? 1), nn = V(n.x, 0, n.z).normalize(), D = archDoor(p.x, d.ground ?? 0, p.z, nn, { w: d.w ?? 3, h: d.h ?? 4.5, lit: d.lit });
    for (const g of D.dark) kit.add(M.dark, g, NC); for (const g of D.glow) kit.add(M.glow, g, NC); for (const g of D.wood) kit.add(M.woodDark, g, NC);
  }
  // herbs on ledges at the portholes: a ledge out from the plating, a planter on it
  for (const h of o.herbs ?? []) {
    const { p, n } = on(h.t, sink + h.y, h.side ?? 1), a = Math.atan2(n.x, n.z), w = h.w ?? 2;
    const Hb = herbs(0, 0.12, 0.45, 0, { w, seed: h.seed ?? h.t * 97 + h.y });
    const at = (g) => g.rotateY(a).translate(p.x, p.y, p.z);
    kit.add(M.woodDark, at(new THREE.BoxGeometry(w + 0.4, 0.14, 1.1).translate(0, 0.05, 0.35)), NC);
    for (const g of Hb.pot) kit.add(M.pot, at(g), NC); for (const g of Hb.leaves) kit.add(M.leaves, at(g), NC);
  }
  for (const st of o.stalls ?? []) {
    const { p, n } = on(st.t, sink + 1.2, st.side ?? 1), a = Math.atan2(n.x, n.z);
    shop(kit, M, { x: p.x, z: p.z, yaw: a, w: st.w ?? 4, seed: st.seed ?? o.x + st.t * 31, deep: st.deep });
  }
  // mooring ropes from its flank down to stakes in the salt, out toward `out` [dx, dz] (view frame) from the hull's foot
  if (o.moor) {
    const m = o.moor;
    for (let i = 0; i < m.n; i++) {
      const t = m.t0 + (m.t1 - m.t0) * (i + rng() * 0.6) / m.n, y = m.y0 + (m.y1 - m.y0) * rng(), a = on(t, y + sink, m.side ?? 1).p;
      const f = on(t, sink + 0.5, m.side ?? 1).p, bx = f.x + m.out[0] * (0.6 + rng() * 0.8), bz = f.z + m.out[1] * (0.6 + rng() * 0.8);
      kit.add(M.rope, rope([a.x, a.y, a.z], [bx, kit.H(bx, bz) + 0.3, bz], { sag: 0.3, r: m.r ?? 0.05 }), NC);
      for (const g of stake(bx, kit.H(bx, bz), bz, { az: Math.atan2(a.z - bz, a.x - bx), h: 0.6, lean: 0.25 })) kit.add(M.woodDark, g, NC);
    }
  }
  for (const u of o.sup ?? []) {
    const p = put(V(0, H.D - 0.6, (u.t * 2 - 1) * (H.L / 2)));
    const S = superstructure({ x: 0, y: 0, z: 0, w: u.w ?? H.B * 0.6, d: u.d ?? 20, tiers: u.tiers ?? 3, th: u.th ?? 4.4, seed: u.seed ?? o.x + u.t, red: u.red ?? 0.3, mast: u.mast ?? true });
    const at = (g) => g.rotateY(yaw).translate(p.x, p.y, p.z);
    for (const g of S.white) kit.add(white, at(g), SH); for (const g of S.red) kit.add(red, at(g), SH);
    for (const g of S.dark) kit.add(M.dark, at(g), NC); for (const g of S.glow) kit.add(M.glow, at(g), NC); for (const g of S.rail) kit.add(M.iron, at(g), NC);
  }
  return { H, put, on };
}

/** A shop at a wall's foot at (x, z), the street toward yaw (salt-harbour-kit.js stall). */
function shop(kit, M, { x, z, yaw = 0, w = 4, seed = 1, deep = 3.2 }) {
  const S = stall({ w, seed, deep, goods: M.goods.length }), at = (g) => turn(g, yaw, x, 0, z);
  for (const g of S.wood) kit.add(M.wood2, at(g), NC);
  for (const g of S.cloth) kit.add(M.cloth, at(g), NC);
  for (const g of S.dark) kit.add(M.dark, at(g), NC);
  for (const [k, list] of S.goods.entries()) for (const g of list) kit.add(M.goods[k], at(g), NC);
}
/** A resident at (x, z) facing yaw, sometimes hauling a bundle. */
function resident(kit, M, rng, x, z, { yaw = rng() * 6.3, s = 1, bundle = rng() < 0.3, y = 0 } = {}) {
  const F = figure(x, y, z, { s: s * (0.92 + rng() * 0.16), yaw, bundle }), m = M.cloaks[Math.floor(rng() * M.cloaks.length)];
  for (const g of F.cloak) kit.add(m, g, NC); for (const g of F.skin) kit.add(M.skin, g, NC); for (const g of F.bundle) kit.add(M.goods[4], g, NC);
}
/** The traveller from behind, the luminous pack on the back (its glass capsule, its rim): cloak 'blue' or 'brown'. */
function traveller(kit, M, x, z, yaw = 0, cloak = 'blue') {
  const g = new THREE.Group(), m = M[cloak];
  // a cloak flaring to the ankles over broad shoulders, the hood, boots under its hem
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.5, 1.35, 12).translate(0, 0.82, 0), m));
  g.add(new THREE.Mesh(new THREE.SphereGeometry(0.34, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2).scale(1.05, 0.55, 0.9).translate(0, 1.48, 0), m));
  g.add(new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8).scale(1, 1.15, 1.05).translate(0, 1.72, -0.02), m));
  for (const e of [-1, 1]) g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.2, 6).translate(e * 0.12, 0.1, 0.02), M.hood));
  // the pack: a round glass tank of light in a dark frame, on the back
  g.add(new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10).scale(0.95, 1.3, 0.75).translate(0, 1.12, 0.36), M.pack));
  g.add(new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.03, 4, 14).scale(0.95, 1.3, 1).translate(0, 1.12, 0.38), M.packRim));
  g.position.set(x, 0, z); g.rotation.y = yaw;
  g.traverse((q) => { q.userData.noCollide = true; });
  kit.group.add(g);
}

/**
 * A picture's scene. o: { seed, ships: [ship…], cloths: [[A, B, C, D, opts]…], curtains: [[A, B, drop, opts]…],
 * gangways: [[A, B, opts]…], ropes: [[a, b, opts]…] (a stake at each b), shops: [shop…], people: { n, x0, x1, z0, z1 },
 * residents: [[x, z, opts]…], traveller: [x, z, yaw, cloak], extra }
 */
function harbourScene(kit, v, o) {
  const M = materials(kit), rng = mulberry32(o.seed ?? 1);
  const ships = (o.ships ?? []).map((s) => ship(kit, M, rng, s));
  for (const [A, B, C, D, op] of o.cloths ?? []) kit.add(op?.alt ? M.cloth2 : M.cloth, cloth(A, B, C, D, op), SH);
  for (const [A, B, drop, op] of o.curtains ?? []) kit.add(op?.alt ? M.cloth2 : M.cloth, curtain(A, B, drop, op), SH);
  for (const [A, B, op] of o.gangways ?? []) {
    const G = gangway(A, B, op);
    for (const g of G.deck) kit.add(M.wood, g, SH); for (const g of G.wood) kit.add(M.woodDark, g, NC); for (const g of G.dark) kit.add(M.woodDark, g, NC);
    // people along it
    const n = op?.people ?? 4;
    for (let i = 0; i < n; i++) { const t = 0.1 + rng() * 0.8, p = V(...A).lerp(V(...B), t); resident(kit, M, rng, p.x, p.z, { y: p.y - (op?.sag ?? 0.4) * Math.sin(Math.PI * t), s: 1, bundle: false }); }
  }
  for (const [a, b, op] of o.ropes ?? []) {
    kit.add(M.rope, rope(a, b, op), NC);
    if (op?.stake !== false) for (const g of stake(b[0], kit.H(b[0], b[2]), b[2], { az: Math.atan2(a[2] - b[2], a[0] - b[0]) })) kit.add(M.woodDark, g, NC);
  }
  for (const s of o.shops ?? []) shop(kit, M, s);
  // free-standing house stacks (the cleft between two hulls): a plastered wall behind, the cabins out from it
  for (const st of o.stacks ?? []) {
    const S = houseStack({ x0: -st.w / 2, x1: st.w / 2, y0: st.y ?? 0, floors: st.floors ?? 6, fh: st.fh ?? 3.4, depth: st.depth ?? [2, 4.5], seed: st.seed ?? st.x * 3 + st.z, lit: st.lit ?? 0.15 });
    const at = (g) => turn(g, st.yaw ?? 0, st.x, 0, st.z);
    kit.add(M.plaster, at(new THREE.BoxGeometry(st.w + 2, (st.floors ?? 6) * (st.fh ?? 3.4) + 4, 3).translate(0, ((st.floors ?? 6) * (st.fh ?? 3.4) + 4) / 2 - 1, -1.8)), SH);
    for (const [k, m] of [['wood', M.wood], ['plaster', M.plaster], ['dark', M.dark], ['glow', M.glow], ['cloth', M.cloth], ['pot', M.pot], ['leaves', M.leaves]]) for (const g of S[k]) kit.add(m, at(g), NC);
  }
  if (o.people) for (let i = 0; i < o.people.n; i++) {
    const x = o.people.x0 + rng() * (o.people.x1 - o.people.x0), z = o.people.z0 + Math.pow(rng(), 1.3) * (o.people.z1 - o.people.z0);
    resident(kit, M, rng, x, z, { y: kit.H(x, z) });
  }
  for (const [x, z, op] of o.residents ?? []) resident(kit, M, rng, x, z, { y: kit.H(x, z), ...op });
  for (const [x, y, z, yaw, op] of o.herbs ?? []) { const Hb = herbs(x, y, z, yaw, op); for (const g of Hb.pot) kit.add(M.pot, g, NC); for (const g of Hb.leaves) kit.add(M.leaves, g, NC); }
  if (o.traveller) traveller(kit, M, o.traveller[0], o.traveller[1], o.traveller[2] ?? 0, o.traveller[3] ?? 'blue');
  o.extra?.(kit, M, rng, ships);
}

// ---------------------------------------------------------------- the salt
/**
 * The basin's floor: flat white salt, barely rolling, mounds banked here and there ([x, z, r, h]…: the drifts against
 * the hulls' feet, the rounded ridges out on the flats), the crust's cracks drawn by its material.
 */
const salt = (mounds = []) => ({
  height: (x, z) => {
    let h = 0.12 * n1(x * 0.03, z * 0.03) + 0.05 * n2(x * 0.15, z * 0.15);
    for (const [mx, mz, r, mh, sx = 1] of mounds) h += mh * gauss((x - mx) / sx, z, 0, mz, r);
    return h;
  },
  material: { color: SALT_TONES.salt, color2: SALT_TONES.salt2, color3: SALT_TONES.salt3, pattern: 'cracks', sandInk: true },
  rings: { r1: 2200 },
});

const view = (o) => ({ sky: SKY.noon, look: SALT_VIEW_LOOK, fog: 0.5, ...o });

const M1 = [[22, -40, 7, 4, 1.4], [-6, -82, 8, 6], [2, -84, 5, 4], [-30, -24, 8, 4, 1.3], [-9, -42, 5, 1.2, 2]];
const M2 = [[-6, -88, 14, 5, 2.2], [22, -40, 10, 6, 1.3], [-22, -30, 6, 2, 2], [26, -12, 8, 5, 1.2]];
const M3 = [[38, -32, 9, 5, 1.4], [14, -160, 8, 6], [-20, -30, 5, 1.5, 2]];
const M4 = [[14, -78, 9, 5, 1.8], [-14, -46, 6, 1.6, 2]];

export const SALT_VIEWS = [
  view({
    id: 'saltharbour-1-street', title: 'Between the hulls: the market in the cleft, the gangway, the ropes', sheet: 'saltharbour-1', panel: 1, where: 'the whole picture', crop: [0, 0, 1456, 816],
    camera: { eye: [0, 2.1, 0], yaw: 0, fov: 50, horizon: 0.76 },
    sun: { side: 145, el: 38 },
    ground: salt(M1),
    build(kit, v) {
      harbourScene(kit, v, {
        seed: 52001,
        traveller: [-1.1, -10.5, 0.05, 'blue'],
        ships: [
          // the left: a great white hull, its bow toward you, a shop door at its foot, houses built out from its flank
          { x: -36, z: -62, yaw: Math.PI + 0.12, L: 100, B: 40, D: 58, sink: 8, n: 2.4, tumble: 0.12, rise: [0.3, 0.55], ports: { rows: [34, 44], step: 9 },
            doors: [{ t: 0.93, side: 1, w: 4.4, h: 6.5 }] },
          // behind you, out of the frame: its shadow over the near salt
          { x: 34, z: 64, yaw: -0.3, L: 100, B: 40, D: 50, sink: 8, ports: false },
          // the middle: a white hull bow on, its upper works over the street
          { x: -6, z: -148, yaw: Math.PI - 0.08, L: 100, B: 32, D: 50, sink: 0, n: 2, tumble: 0.2, rise: [0.3, 0.7], sup: [{ t: 0.62, w: 20, d: 24, tiers: 3 }] },
          // far down the street, in the haze
          { x: 8, z: -250, yaw: Math.PI + 0.2, L: 110, B: 32, D: 42, sink: 5, far: true, sup: [{ t: 0.6, w: 20, d: 24, tiers: 3 }] },
          // the right: the terracotta hull's stern over the street, white high up, its curve down to the salt
          { x: 36, z: -100, yaw: 0.04, L: 150, B: 60, D: 70, sink: 6, red: true, top: 12, n: 2, tumble: 0.25, ports: { rows: [24, 38], step: 14, r: 0.6 },
            moor: { n: 14, t0: 0.02, t1: 0.12, y0: 16, y1: 50, side: 1, out: [-8, 10] } },
        ],
        // the houses stepping out from the left hull's flank, their fronts toward the street, the market at their feet
        stacks: [{ x: -20, z: -44, yaw: 0.55, w: 8, floors: 9, fh: 3, depth: [1.5, 3.2] }, { x: -17, z: -53, yaw: 0.5, w: 9, floors: 10, fh: 3, depth: [1.5, 3.4] }, { x: -15, z: -63, yaw: 0.45, w: 9, floors: 9, fh: 3, depth: [1.5, 3.2] }, { x: -13.5, z: -73, yaw: 0.4, w: 9, floors: 8, fh: 3 }],
        shops: [{ x: -14.5, z: -40, yaw: 0.9, w: 3.6 }, { x: -12.8, z: -45, yaw: 0.9, w: 3.6 }, { x: -11.4, z: -51, yaw: 0.9, w: 3.6 }, { x: -10.2, z: -57, yaw: 0.9, w: 3.6 }, { x: -9.2, z: -63, yaw: 0.9, w: 3.6 }],
        people: { n: 22, x0: -9, x1: -3, z0: -26, z1: -56 },
        residents: [[-4, -58, {}], [2, -70, {}]],
        cloths: [
          [[-34, 38, -30], [-14, 40, -70], [-2, 34, -62], [-14, 33, -24], { sag: 4, folds: 3, fold: 1.2, droop: 2.5, seed: 1 }],
          [[-22, 24, -36], [-10, 25, -60], [-2, 19, -50], [-12, 18, -30], { sag: 2.5, folds: 4, fold: 0.6, droop: 1.5, seed: 2 }],
          [[-22, 16, -30], [-14, 16, -40], [-9, 13, -36], [-15, 12, -26], { sag: 1, folds: 2, fold: 0.3, droop: 0.6, seed: 3, alt: true }],
          [[-30, 52, -50], [-8, 50, -96], [4, 46, -86], [-12, 44, -40], { sag: 6, folds: 3, fold: 1.6, droop: 3, seed: 4, alt: true }],
          [[-16, 30, -60], [-6, 30, -84], [0, 26, -78], [-10, 25, -56], { sag: 1.5, folds: 3, fold: 0.5, droop: 1, seed: 5 }],
        ],
        gangways: [[[-6, 44, -94], [12, 46, -70], { w: 3, sag: 0.8, people: 6 }]],
      });
    },
  }),
  view({
    id: 'saltharbour-2-canyon', title: 'The canyon of hulls, two gangways overhead, the ropes meeting in the street', sheet: 'saltharbour-2', panel: 1, where: 'the whole picture', crop: [0, 0, 1456, 816],
    camera: { eye: [0, 2.1, 0], yaw: 0, fov: 50, horizon: 0.8 },
    sun: { side: 125, el: 46 }, sky: SKY.pale,
    ground: salt(M2),
    build(kit, v) {
      harbourScene(kit, v, {
        seed: 52002,
        traveller: [6, -12, -0.3, 'brown'],
        ships: [
          // the left: a white hull's bow turned toward the street, shops under awnings at its foot, herbs on its ledges
          { x: -46, z: -40, yaw: Math.PI + 0.06, L: 150, B: 60, D: 70, sink: 10, n: 2.4, tumble: 0.16, ports: { rows: [30, 42, 52], step: 8 },
            stalls: [{ t: 0.66, side: 1, w: 5, deep: 4.5 }, { t: 0.62, side: 1, w: 5, deep: 4.5 }, { t: 0.58, side: 1, w: 4 }],
            herbs: [{ t: 0.67, y: 12, side: 1, w: 2.6 }, { t: 0.63, y: 12.5, side: 1, w: 2 }, { t: 0.56, y: 14, side: 1, w: 2 }] },
          // down the street on the left: a white hull under its terracotta upper works, bow on
          { x: -14, z: -128, yaw: Math.PI + 0.12, L: 110, B: 40, D: 64, sink: 2, n: 2.1, tumble: 0.22, top: 24, rise: [0.3, 0.7], ports: { rows: [20, 30, 48], step: 8 },
            herbs: [{ t: 0.9, y: 22, side: 1, w: 2 }] },
          { x: -20, z: -250, yaw: Math.PI + 0.2, L: 110, B: 36, D: 56, sink: 6, far: true, top: 18 },
          // the right: a white hull with a terracotta top, its flank along the street
          { x: 48, z: -76, yaw: 0, L: 160, B: 60, D: 74, sink: 10, n: 2.4, tumble: 0.18, top: 24, ports: { rows: [30, 42, 54], step: 10 },
            stalls: [{ t: 0.3, side: 1, w: 5, deep: 4.5 }, { t: 0.36, side: 1, w: 5, deep: 4.5 }, { t: 0.42, side: 1, w: 5 }],
            doors: [{ t: 0.48, side: 1, w: 3.6, h: 5.4 }],
            herbs: [{ t: 0.33, y: 16, side: 1, w: 2.6 }, { t: 0.38, y: 16, side: 1, w: 2.2 }, { t: 0.25, y: 22, side: 1, w: 2 }] },
          { x: 40, z: -240, yaw: 0.1, L: 110, B: 40, D: 60, sink: 6, far: true, top: 20 },
        ],
        gangways: [[[-8, 46, -80], [17, 50, -62], { w: 4, sag: 1, people: 8 }], [[-6, 26, -118], [16, 28, -112], { w: 3, sag: 0.8, people: 4 }], [[-6, 22, -210], [14, 22, -206], { w: 2.4, sag: 0.4, people: 0 }]],
        cloths: [
          [[-14, 64, -56], [18, 66, -46], [16, 56, -70], [-10, 54, -80], { sag: 5, folds: 3, fold: 1.4, droop: 3, seed: 7 }],
          [[-6, 28, -122], [14, 30, -116], [12, 25, -124], [-6, 24, -126], { sag: 1.5, folds: 2, fold: 0.6, droop: 1, seed: 8, alt: true }],
        ],
        ropes: [
          ...Array.from({ length: 9 }, (_, i) => [[-8 + (i % 3), 18 + i * 4, -78 - i * 2], [-1.5 + i * 0.3, 0, -52 - i * 1.4], { sag: 0.4, r: 0.05 }]),
          ...Array.from({ length: 10 }, (_, i) => [[17, 18 + i * 4.4, -50 - i * 3.6], [1 + i * 0.25, 0, -56 - i * 1.2], { sag: 0.4, r: 0.05 }]),
        ],
        people: { n: 10, x0: -8, x1: 10, z0: -30, z1: -90 },
        residents: [[-0.5, -58, { yaw: 0 }], [-10, -36, {}], [-9, -40, {}], [12, -40, {}], [11.5, -48, {}]],
      });
    },
  }),
  view({
    id: 'saltharbour-3-curtains', title: 'Under the curtains hung from the high gangway, the ship at the street\'s end', sheet: 'saltharbour-3', panel: 1, where: 'the whole picture', crop: [0, 0, 1456, 816],
    camera: { eye: [0, 2.1, 0], yaw: 0, fov: 50, horizon: 0.82 },
    sun: { side: 150, el: 30 }, sky: SKY.warm,
    ground: salt(M3),
    build(kit, v) {
      harbourScene(kit, v, {
        seed: 52003,
        traveller: [1.4, -11.5, 0.1, 'brown'],
        ships: [
          // the left: a white hull's flank, its terracotta bottom, the arcade of houses at its foot
          { x: -44, z: -60, yaw: Math.PI - 0.1, L: 160, B: 60, D: 76, sink: 8, n: 2.4, tumble: 0.14, band: 14, ports: { rows: [30, 44, 58], step: 9 },
            herbs: [{ t: 0.8, y: 10, side: 1, w: 3 }, { t: 0.75, y: 10, side: 1, w: 3 }, { t: 0.7, y: 10.5, side: 1, w: 3 }] },
          // the right: a hull bulging over the street, white over a terracotta bottom
          { x: 40, z: -50, yaw: 0.05, L: 150, B: 58, D: 72, sink: 4, n: 2, tumble: 0.25, band: 18, ports: { rows: [36, 52], step: 12 },
            moor: { n: 6, t0: 0.55, t1: 0.75, y0: 20, y1: 50, side: 1, out: [-10, 2], r: 0.14 } },
          // the ship at the street's end, its tall upper works in the haze
          { x: 8, z: -190, yaw: 0.1, L: 110, B: 40, D: 44, sink: 4, far: true, band: 8, sup: [{ t: 0.5, w: 26, d: 36, tiers: 5, th: 6 }] },
          { x: -18, z: -150, yaw: Math.PI + 0.4, L: 90, B: 34, D: 52, sink: 4, far: true },
        ],
        // the arcade along the left hull's foot: a row of low houses, their fronts to the street
        stacks: [{ x: -15, z: -18, yaw: 1.25, w: 14, floors: 2, fh: 3.4, depth: [1.6, 2.6] }, { x: -13.4, z: -33, yaw: 1.3, w: 14, floors: 2, fh: 3.4, depth: [1.6, 2.6] }, { x: -12, z: -48, yaw: 1.35, w: 14, floors: 2, fh: 3.2, depth: [1.6, 2.6] }, { x: -11, z: -63, yaw: 1.4, w: 14, floors: 2, fh: 3.2 }],
        shops: [{ x: -11.5, z: -14, yaw: 1.25, w: 4.5 }, { x: -10.6, z: -22, yaw: 1.28, w: 4.5 }, { x: -9.8, z: -31, yaw: 1.3, w: 4 }, { x: -9, z: -40, yaw: 1.32, w: 4 }, { x: -8.3, z: -50, yaw: 1.35, w: 4 }],
        gangways: [[[-14, 46, -48], [20, 48, -40], { w: 4, sag: 0.8, people: 10 }], [[-8, 22, -120], [12, 24, -118], { w: 2.6, sag: 0.4, people: 2 }]],
        curtains: [
          [[-6, 45.5, -48], [14, 47, -43], 30, { sag: 2, folds: 4, fold: 1.4, pull: [5, 2], seed: 11 }],
          [[-14, 45, -50], [-6, 45.5, -48], 34, { sag: 0.6, folds: 2, fold: 0.8, pull: [1, 1], seed: 12, alt: true }],
          [[2, 30, -90], [12, 30, -88], 16, { sag: 1, folds: 3, fold: 0.6, seed: 13 }],
          [[-6, 22, -122], [8, 24, -120], 10, { sag: 0.8, folds: 3, fold: 0.5, seed: 14, alt: true }],
        ],
        cloths: [[[-16, 54, -30], [22, 56, -24], [18, 47, -46], [-12, 46, -48], { sag: 4, folds: 3, fold: 1.4, droop: 2.5, seed: 15 }]],
        ropes: Array.from({ length: 8 }, (_, i) => [[-10 + i * 2, 44 - (i % 3), -50 + i * 0.6], [-4 + i * 1.5, 0, -30 - i * 3], { sag: 0.5, r: 0.04 }]),
        residents: [[-2.2, -38, { yaw: 0.2 }], [-0.6, -39, { yaw: 0 }], [-3, -70, {}], [-6, -24, {}], [-4.5, -28, {}]],
        people: { n: 8, x0: -7, x1: -2, z0: -20, z1: -70 },
      });
    },
  }),
  view({
    id: 'saltharbour-4-flats', title: 'The hulls\' terracotta feet, the upright ships, the open salt beyond', sheet: 'saltharbour-4', panel: 1, where: 'the whole picture', crop: [0, 0, 1456, 816],
    camera: { eye: [0, 2.1, 0], yaw: 0, fov: 50, horizon: 0.8 },
    sun: { side: 100, el: 36 }, sky: SKY.warm,
    ground: salt(M4),
    build(kit, v) {
      harbourScene(kit, v, {
        seed: 52004,
        traveller: [0.6, -11.5, 0.1, 'brown'],
        ships: [
          // the left: hulls' bows toward the street, terracotta to half their height, doors and herbs
          { x: -50, z: -76, yaw: -2.5, L: 90, B: 40, D: 52, sink: 4, n: 2.2, tumble: 0.2, band: 26, ports: { rows: [14, 34, 42], step: 7 },
            doors: [{ t: 0.95, side: 1, w: 4, h: 8 }], stalls: [{ t: 0.98, side: 1, w: 4 }], herbs: [{ t: 0.93, y: 16, side: 1, w: 2.4 }] },
          { x: -42, z: -112, yaw: -2.5, L: 90, B: 38, D: 56, sink: 4, n: 2.2, tumble: 0.2, band: 26, ports: { rows: [14, 36], step: 7 },
            doors: [{ t: 0.96, side: 1, w: 3.4, h: 6 }], herbs: [{ t: 0.93, y: 18, side: 1, w: 2 }] },
          // the upright ships: stood on their sterns, their keels' terracotta stripe running up them
          { x: -4, z: -140, yaw: -0.3, L: 110, B: 34, D: 30, sink: 4, upright: true, band: 4, ports: { rows: [10, 20], step: 9 } },
          { x: 14, z: -190, yaw: 0.2, L: 100, B: 30, D: 26, sink: 4, upright: true, band: 4, far: true },
          { x: -18, z: -220, yaw: 0.6, L: 100, B: 30, D: 26, sink: 4, upright: true, band: 4, far: true },
          // the right: a terracotta bow's flare hanging in over the corner, its forefoot cut up over the salt
          { x: 76, z: -16, yaw: 1.15, L: 120, B: 50, D: 64, sink: 0, red: true, top: 0, rise: [0.3, 0.85], ports: false },
        ],
        cloths: [
          [[-40, 34, -20], [-14, 36, -40], [-8, 30, -32], [-26, 28, -12], { sag: 3, folds: 3, fold: 1, droop: 2, seed: 21 }],
          [[-14, 44, -60], [4, 46, -80], [8, 38, -72], [-8, 36, -52], { sag: 2, folds: 3, fold: 0.8, droop: 1.5, seed: 22, alt: true }],
        ],
        curtains: [[[-8, 40, -96], [2, 42, -104], 20, { sag: 1, folds: 3, fold: 0.8, seed: 23 }]],
        gangways: [[[-20, 50, -64], [-6, 54, -126], { w: 3, sag: 1, people: 3 }]],
        ropes: Array.from({ length: 16 }, (_, i) => [[26 + i * 1.6, 46 + (i % 4) * 4, -40 + i * 0.6], [9 + i * 0.4 + (i % 3) * 0.8, 0, -26 - (i % 5) * 2.4], { sag: 2.5, r: 0.04 }]),
        residents: [[7.5, -14, { yaw: 2.6, s: 1 }], [-16, -42, {}], [-15, -46, {}], [-10, -56, {}]],
        people: { n: 5, x0: -16, x1: -6, z0: -36, z1: -60 },
      });
    },
  }),
];
export { SALT_SHEETS as SHEETS, SALT_VIEWS as VIEWS };
