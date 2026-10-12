import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeMaterial, sharedUniforms } from './materials.js';
import { LightShaft } from './veil.js';
import { chestMound, MOUND } from './boxes/mound.js';

// The light that goes down (issue #169, the author's pick "light-down": references/levels/The City-Shaft/environment/
// explorations/light-down/). The depths have no sun, so the city passed it down: a great mirror on the rim by the red
// stair catches the sun and throws it across the shaft to a chain of mirrors on the bell quarter's terraces, each on a
// round brass deck out over the void, each throwing it on down to the next, to a little square on the bottom terrace by
// the Upward Shrine. Since the Lodestar faded, three of them have been knocked round on their rings: the light stops at
// the first, which throws it at the wall instead, a bright coin that wanders as the loose frame creaks in the updraft.
// Follow the beam down, and turn each mirror's crank (a notch at a time, eight round) until its beam lands on the next
// mirror; when the last throws it onto the square, the light reaches the bottom: stalls come out into it, and the
// makers' chest that has sat cold in the shade there opens (src/boxes/placements.js incal.sunglass).
//
// The quest (src/story/light-down.js, incal-data.js incal.beam): starts as you come near a mirror; the scout finds the
// mirror the light has stopped at; reaching the lit square ends it. Flags: incal.beam.<id> (a mirror's notch, 0 aligned),
// incal.beam.lit (the light reaches the bottom).
//
//   MIRRORS, BEAM_END, NOTCHES, DECK     where they stand (angle round the shaft, level) and how they are built
//   mirrorPlaces(terraces, R) → [{ id, deck, glass, crank, y, a, r0, start, turnable }]   (pure)
//   endPlace(terraces) → { at, dais, chest }                                        (pure: the lit square)
//   traceBeam(from, dir, shape, max) → { to, normal, hit }                          (pure: where a beam stops)
//   chainOf(places, end, notches, shape, sway) → { segs, stop, done }               (pure: the light's way down)
//   mirrorRailGaps(t) → [{ a, half }]     the railing's gaps where a deck's gangway joins a terrace (src/levels/incal.js)
//   buildShaftMirrors(scene, { terraces, shape, veils }) → { places, end, set(notches), chain(), update(), lights, line, clear }

const TAU = Math.PI * 2;
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const norm = (a) => ((a % TAU) + TAU) % TAU;
const inSector = (t, a) => norm(a - t.a0) <= t.a1 - t.a0;

/**
 * The mirrors, top to bottom: the great mirror on the rim (it follows the sun by itself), then the four on the bell
 * quarter's terraces (angle round the shaft, level), with the notch each is left at (0: its beam on the next mirror).
 * The beams between them clear the spire, its rings and bridges, the viaducts and every terrace (tests/shaft-mirrors.test.js).
 */
export const MIRRORS = [
  { id: 'rim', y: 200, a: 0.95, great: true },
  { id: 'upper', y: 92, a: 3.28, start: 5 },
  { id: 'middle', y: -86, a: 3.45, start: 6 },
  { id: 'lower', y: -150, a: 3.2, start: 0 },   // (kept its notch all these years: the light jumps it once the one above is turned)
  { id: 'deep', y: -218, a: 3.42, start: 4 },
];
/** The lit square on the bottom terrace: its angle, how far in from the terrace's edge (m), and the chest's rise. */
export const BEAM_END = { y: -290, a: 3.4, inset: 10 };
/** The makers' chest's mound on the square: the major chests' own (issue #162, src/boxes/mound.js: a smooth ramp up, no steps). */
export const RISE = MOUND;
export const NOTCHES = 8;
/** A mirror's deck: how far out over the void from the terrace's edge its middle stands, its radius, the gangway's width, the glass's radius and height. The rim's: out from the shaft's lip, its glass's. */
export const DECK = { out: 5.6, r: 2.8, gangway: 2.4, glass: 1.5, height: 3.3, rim: { r: 266, glass: 3, height: 5.8 } };
/** The sun's way into the rim's mirror (a direction toward the sun: high, over the far side). */
export const SUN = V(-0.35, 1, 0.25).normalize();

const P3 = (a, r, y) => V(Math.cos(a) * r, y, Math.sin(a) * r);
const out = (a) => V(-Math.cos(a), 0, -Math.sin(a));   // toward the shaft's middle

/** Where each mirror stands: its deck's middle, its glass, where you stand to its crank, its terrace's edge. */
export function mirrorPlaces(terraces, R = 260) {
  return MIRRORS.map((m) => {
    if (m.great) {
      const r = DECK.rim.r, deck = P3(m.a, r, m.y);
      return { ...m, deck, glass: deck.clone().setY(m.y + DECK.rim.height), crank: P3(m.a, r + 3.2, m.y), r0: R, turnable: false, start: 0 };
    }
    const t = terraces.find((s) => s.y === m.y && inSector(s, m.a));
    if (!t) return null;
    const r = t.r0 - DECK.out, deck = P3(m.a, r, m.y);
    return { ...m, deck, glass: deck.clone().setY(m.y + DECK.height), crank: P3(m.a, r + 1.5, m.y), edge: P3(m.a, t.r0 + 1.5, m.y), r0: t.r0, turnable: true, start: m.start ?? 0 };
  }).filter(Boolean);
}
/** The lit square: its middle on the bottom terrace, the chest's rise there, and the chest on top (facing the void). */
export function endPlace(terraces) {
  const t = terraces.find((s) => s.y === BEAM_END.y && inSector(s, BEAM_END.a));
  if (!t) return null;
  const at = P3(BEAM_END.a, t.r0 + BEAM_END.inset, t.y), face = Math.atan2(-Math.cos(BEAM_END.a), -Math.sin(BEAM_END.a));
  return { at, r0: t.r0, y: t.y, target: at.clone().add(V(0, 0.4, 0)).addScaledVector(out(BEAM_END.a), -1.2), chest: { at: at.clone().setY(t.y + RISE.h).toArray(), face } };
}
/** The railing's gaps on a terrace sector where a mirror's gangway comes in: [{ a, half (rad) }]. Pure. */
export function mirrorRailGaps(t) {
  return MIRRORS.filter((m) => !m.great && m.y === t.y && inSector(t, m.a)).map((m) => ({ a: m.a, half: (DECK.gangway / 2 + 0.7) / t.r0 }));
}

/**
 * Where a beam from `from` along `dir` stops (pure): the shaft's wall, a terrace's slab or the houses on it, the
 * spire, its rings and bridges, a viaduct, the lake. shape: { R, BOTTOM, terraces, bridges, viaducts, SPIRE_R, SPIRE_RING, LEVELS }.
 * `skip` m at the start are not tested (the mirror's own deck). Returns { to, normal (the surface's, toward the beam), hit }.
 */
export function traceBeam(from, dir, shape, max = 700, { step = 1.5, skip = 4 } = {}) {
  const d = dir.clone().normalize(), p = V();
  const { R, TOP = 200, BOTTOM, terraces = [], bridges = [], viaducts = [], SPIRE_R = 24, SPIRE_RING = 48, LEVELS = [] } = shape;
  for (let s = skip; s <= max; s += step) {
    p.copy(from).addScaledVector(d, s);
    const r = Math.hypot(p.x, p.z), a = Math.atan2(p.z, p.x);
    if (p.y < BOTTOM) return { to: p.clone().setY(BOTTOM), normal: V(0, 1, 0), hit: 'lake' };
    if (r > R - 0.5) {
      if (p.y < TOP + 0.1) return p.y > TOP - 1.5 ? { to: p.clone().setY(TOP), normal: V(0, 1, 0), hit: 'rim' } : { to: p.clone(), normal: V(-p.x / r, 0, -p.z / r), hit: 'wall' };
      continue;   // (over the rim's plain: open air)
    }
    if (r < SPIRE_R + 1 && p.y < 330) return { to: p.clone(), normal: V(p.x / r, 0, p.z / r), hit: 'spire' };
    for (const y of LEVELS) if (r < SPIRE_RING && p.y < y + 0.2 && p.y > y - 4) return { to: p.clone(), normal: V(0, 1, 0), hit: 'ring' };
    for (const t of terraces) {
      if (!inSector(t, a)) continue;
      if (r >= t.r0 - 0.2 && p.y < t.y + 0.2 && p.y > t.y - 7) return { to: p.clone().setY(Math.max(p.y, t.y)), normal: V(0, 1, 0), hit: 'terrace' };
      if (r >= t.r0 + 12 && p.y >= t.y && p.y < t.y + 14) return { to: p.clone(), normal: V(-p.x / r, 0, -p.z / r), hit: 'houses' };
    }
    for (const b of bridges) {
      if (p.y > b.y + 0.2 || p.y < b.y - 2.7 || r < SPIRE_RING - 1 || r > b.r0 + 2) continue;
      const side = Math.abs(-Math.sin(b.phi) * p.x + Math.cos(b.phi) * p.z);
      if (side < 3.7 && Math.cos(b.phi) * p.x + Math.sin(b.phi) * p.z > 0) return { to: p.clone(), normal: V(0, 1, 0), hit: 'bridge' };
    }
    // a viaduct: its deck (16 m wide, 4 deep, its top at v.y) and the flattened half-ring of its arch under it, 24 m wide,
    // dipping from the deck's ends to some 78 m under its middle (src/levels/incal.js)
    for (const v of viaducts) {
      const side = Math.abs(Math.sin(v.a) * p.x + Math.cos(v.a) * p.z), along = Math.cos(v.a) * p.x - Math.sin(v.a) * p.z, h = v.span / 2;
      if (Math.abs(along) > h + 2) continue;
      if (side < 8.5 && p.y < v.y + 0.2 && p.y > v.y - 4.5) return { to: p.clone(), normal: V(0, 1, 0), hit: 'viaduct' };
      const yc = v.y - 4 - 0.32 * Math.sqrt(Math.max(0, h * h - along * along));
      if (side < 12.5 && Math.abs(p.y - yc) < 2.2) return { to: p.clone(), normal: V(0, 1, 0), hit: 'arch' };
    }
  }
  return { to: from.clone().addScaledVector(d, max), normal: d.clone().negate(), hit: null };
}

/** A notch turns a mirror's beam this far round the vertical from its true line (rad). */
const notchTurn = (n) => (((n % NOTCHES) + NOTCHES) % NOTCHES) * (TAU / NOTCHES);
/** The way a mirror's beam leaves at `notch`, given the true line to its target (the line turned round the vertical). */
export function beamDir(line, notch, sway = 0) {
  const a = notchTurn(notch) + sway, c = Math.cos(a), s = Math.sin(a);
  return V(line.x * c - line.z * s, line.y, line.x * s + line.z * c).normalize();
}

/**
 * The light's way down (pure): from the sun into the rim's mirror, then mirror to mirror while each is at notch 0, to
 * the lit square. `notches`: id → notch. The first mirror off its notch throws the light at whatever it meets (`sway`:
 * the loose frame's creak, rad). Returns { segs: [{ from, to, i, stray, hit }], stop (the index of the mirror the light
 * stopped at, -1 when it reached the square), done, dirs: [the way each lit mirror throws it] }.
 */
export function chainOf(places, end, notches, shape, sway = 0) {
  const segs = [], dirs = [];
  for (let i = 0; i < places.length; i++) {
    const m = places[i], next = places[i + 1], target = next ? next.glass : end.target;
    const line = target.clone().sub(m.glass);
    const n = m.turnable ? (notches[m.id] ?? m.start) : 0;
    if (n % NOTCHES === 0) {
      dirs.push(line.clone().normalize());
      segs.push({ from: m.glass.clone(), to: target.clone(), i, stray: false, hit: next ? 'mirror' : 'square' });
      if (!next) return { segs, stop: -1, done: true, dirs };
      continue;
    }
    const d = beamDir(line, n, sway), tr = traceBeam(m.glass, d, shape, 700, { skip: 3 });
    dirs.push(d);
    segs.push({ from: m.glass.clone(), to: tr.to, i, stray: true, hit: tr.hit, normal: tr.normal });
    return { segs, stop: i, done: false, dirs };
  }
  return { segs, stop: -1, done: true, dirs };
}

/** Is the straight way between two points clear of the city (the tests: every true line of the chain)? */
export function clearBetween(a, b, shape, { skip = 4, end = 4 } = {}) {
  const len = a.distanceTo(b), tr = traceBeam(a, b.clone().sub(a), shape, len - end, { skip });
  return tr.hit === null;
}

const flat0 = (g) => { g = g.index ? g.toNonIndexed() : g; for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k); if (!g.attributes.normal) g.computeVertexNormals(); return g; };

export function buildShaftMirrors(scene, { terraces, shape, veils = null }) {
  const R = shape.R;
  const places = mirrorPlaces(terraces, R), end = endPlace(terraces);
  const root = new THREE.Group(); root.name = 'The light that goes down';
  scene.add(root);
  const brass = makeMaterial({ color: '#d8a24a', flat: true, metal: 'brass' });   // (the shaft's brass: src/shaft-ways.js, one batch)
  const deckMat = makeMaterial({ color: '#b9895a', color2: '#a8784c', flat: true, grid: 1.1 });
  const steel = makeMaterial({ color: '#7f93a3', flat: true, metal: 'steel' });
  const glassMat = makeMaterial({ color: '#e8f2f4', flat: true, glow: 0.18, refl: 0.7 });
  const dullMat = makeMaterial({ color: '#8fa3ad', flat: true, glow: 0.04, refl: 0.4 });
  const shineMat = makeMaterial({ color: '#fff4d2', flat: true, glow: 0.95, key: 'incal.mirror.shine' });
  const stone = makeMaterial({ color: '#efe5cc', flat: true });
  // the decks, gangways, rails and struts of every mirror: one mesh you stand on, one of thin brass you don't
  const solid = [], thin = [];
  const heads = [];
  for (const m of places) {
    const f = Math.atan2(m.deck.x, m.deck.z);   // local +z points out toward the wall
    const at = (x, y, z) => new THREE.Matrix4().makeRotationY(f).setPosition(m.deck.x, m.y, m.deck.z).multiply(new THREE.Matrix4().makeTranslation(x, y, z));
    const g = (geo, x, y, z) => geo.applyMatrix4(at(x, y, z));
    if (m.great) {
      // the great mirror on the rim: a round brass plinth, a tall fork, a crank wheel on its side
      solid.push(g(new THREE.CylinderGeometry(2.6, 3.0, 0.8, 16), 0, 0.4, 0));
      solid.push(g(new THREE.CylinderGeometry(0.8, 1.1, 2.6, 10), 0, 2.0, 0));
      for (const s of [-1, 1]) thin.push(g(new THREE.BoxGeometry(0.4, 3.6, 0.5), s * (DECK.rim.glass + 0.35), DECK.rim.height - 0.6, 0));
      thin.push(g(new THREE.BoxGeometry(2 * DECK.rim.glass + 1.1, 0.5, 0.6), 0, 3.3, 0));
      thin.push(g(new THREE.TorusGeometry(0.7, 0.08, 4, 14).rotateY(Math.PI / 2), DECK.rim.glass + 0.9, DECK.rim.height - 1.2, 0));
    } else {
      // the deck: a round platform out over the void on struts to the slab's face, a gangway in to the terrace's edge
      solid.push(g(new THREE.CylinderGeometry(DECK.r, DECK.r, 0.4, 18), 0, -0.2, 0));
      const len = DECK.out - DECK.r + 1.2;
      solid.push(g(new THREE.BoxGeometry(DECK.gangway, 0.36, len), 0, -0.18, DECK.r - 0.4 + len / 2));
      for (let k = 0; k < 14; k++) {   // a rail of brass posts round the deck, open toward the gangway
        const b = (k / 14) * TAU; if (Math.abs(Math.atan2(Math.sin(b), Math.cos(b))) < 0.6) continue;
        thin.push(g(new THREE.CylinderGeometry(0.04, 0.04, 1.05, 4), Math.sin(b) * (DECK.r - 0.15), 0.52, Math.cos(b) * (DECK.r - 0.15)));
      }
      thin.push(g(new THREE.TorusGeometry(DECK.r - 0.15, 0.045, 4, 28, TAU - 1.2).rotateX(Math.PI / 2).rotateY(-Math.PI / 2 - 0.6 + Math.PI), 0, 1.05, 0));
      for (const s of [-1, 1]) thin.push(g(new THREE.CylinderGeometry(0.09, 0.09, 6.4, 5).rotateX(0.75), s * 1.6, -2.6, DECK.out - 2.6));   // struts down to the slab's face
      // the stand: a post with a crank wheel, the fork the glass turns in
      thin.push(g(new THREE.CylinderGeometry(0.28, 0.4, 0.5, 10), 0, 0.25, -0.2));
      thin.push(g(new THREE.CylinderGeometry(0.14, 0.18, DECK.height - 0.6, 8), 0, (DECK.height - 0.6) / 2 + 0.3, -0.2));
      thin.push(g(new THREE.TorusGeometry(0.42, 0.05, 4, 14), 0, 1.1, 1.0));   // the crank wheel, toward the gangway
      thin.push(g(new THREE.BoxGeometry(0.08, 0.08, 1.2), 0, 1.1, 0.4));
    }
    // the head: a yaw group on the post, a tilt group in it, the glass facing its +z
    const r = m.great ? DECK.rim.glass : DECK.glass;
    const yaw = new THREE.Group(); yaw.position.copy(m.glass);
    const tilt = new THREE.Group(); yaw.add(tilt);
    const rim = new THREE.Mesh(mergeGeometries([new THREE.TorusGeometry(r, r * 0.07, 5, 28), new THREE.CircleGeometry(r * 1.02, 28).rotateY(Math.PI).translate(0, 0, -0.04),
      ...[-1, 1].map((s) => new THREE.CylinderGeometry(r * 0.06, r * 0.06, r * 0.5, 6).rotateZ(Math.PI / 2).translate(s * r * 1.12, 0, 0))].map(flat0)), brass);
    const face = new THREE.Mesh(new THREE.CircleGeometry(r * 0.96, 28).translate(0, 0, 0.02), m.turnable ? dullMat : glassMat);
    for (const o of [rim, face]) { o.userData.noCollide = true; tilt.add(o); }   // (still between cranks: the static batches draw them)
    root.add(yaw);
    heads.push({ m, yaw, tilt, face });
  }
  // the lit square's rise: a low round mound of pale stone with a smooth slope all round (no step), the chest on top
  const deckMesh = new THREE.Mesh(mergeGeometries(solid.map(flat0)), deckMat); deckMesh.name = 'The mirrors’ decks';
  const thinMesh = new THREE.Mesh(mergeGeometries(thin.map(flat0)), brass); thinMesh.name = 'The mirrors’ stands'; thinMesh.userData.noCollide = true;
  if (end) {
    const [drawn, solid] = chestMound(end.at.x, end.at.y, end.at.z, { seg: 32 });
    const mound = new THREE.Mesh(drawn, stone); mound.name = 'The makers’ mound'; mound.userData.noCollide = true;
    const proxy = new THREE.Mesh(solid, stone); proxy.visible = false; proxy.name = 'The makers’ mound collision';
    root.add(mound, proxy);
  }
  root.add(deckMesh, thinMesh);

  // the beams: a soft wash each (src/veil.js) and a thin bright core; the coin of light where a stray one lands
  const coreMat = makeMaterial({ color: '#fff1c2', flat: true, glow: 1, key: 'incal.beam.core' });
  const coreGeo = new THREE.CylinderGeometry(1, 1, 1, 6, 1, true).translate(0, 0.5, 0);
  const beams = places.map(() => {
    const shaft = veils ? new LightShaft(veils, root, { color: '#fff1c2', alpha: [0.14, 0.22], inner: 0.45, near: 4 }) : null;
    const core = new THREE.Mesh(coreGeo, coreMat);
    core.userData.noCollide = true; core.userData.dynamic = true; core.castShadow = false; core.frustumCulled = false;
    root.add(core);
    return { shaft, core };
  });
  const coinMat = makeMaterial({ color: '#fff1c2', flat: true, glow: 0.9, side: THREE.DoubleSide, key: 'incal.beam.coin' });
  const coin = new THREE.Mesh(new THREE.CircleGeometry(2.4, 24), coinMat);
  coin.userData.noCollide = true; coin.userData.dynamic = true; coin.castShadow = false;
  root.add(coin);
  const pool = new THREE.Mesh(new THREE.CircleGeometry(7.5, 32).rotateX(-Math.PI / 2), makeMaterial({ color: '#fff0c4', flat: true, glow: 0.35, key: 'incal.beam.pool' }));
  pool.userData.noCollide = true; pool.userData.dynamic = true; pool.castShadow = false; pool.visible = false;
  if (end) { pool.position.copy(end.at).add(V(0, 0.04, 0)); root.add(pool); }
  // what comes out into the light on the square once it gets there: two stalls under striped awnings, a washing line
  const life = new THREE.Group(); life.name = 'The lit square’s stalls'; life.visible = false;
  if (end) {
    const f = Math.atan2(end.at.x, end.at.z);
    const at = (x, z) => P3(BEAM_END.a, end.r0 + BEAM_END.inset + x, end.y).add(V(-Math.sin(BEAM_END.a) * z, 0, Math.cos(BEAM_END.a) * z));
    const wood = makeMaterial({ color: '#8a5a3c', flat: true });
    const cloths = ['#c8483a', '#f2c54b', '#5fb7ad'].map((c) => makeMaterial({ color: c, flat: true, side: THREE.DoubleSide }));
    for (const [x, z, ci] of [[3, -7, 0], [3.5, 7, 1]]) {
      const p = at(x, z), g = new THREE.Group(); g.position.copy(p); g.rotation.y = f;
      g.add(new THREE.Mesh(mergeGeometries([new THREE.BoxGeometry(2.6, 1, 1.4).translate(0, 0.5, 0), ...[[-1.2, -0.6], [1.2, -0.6], [-1.2, 0.6], [1.2, 0.6]].map(([a, b]) => new THREE.CylinderGeometry(0.05, 0.05, 2.5, 4).translate(a, 1.25, b))].map(flat0)), wood));
      g.add(new THREE.Mesh(flat0(new THREE.CylinderGeometry(0.01, 2.1, 0.7, 4, 1, true).rotateY(Math.PI / 4).scale(1, 1, 0.75).translate(0, 2.8, 0)), cloths[ci]));
      life.add(g);
    }
    const a = at(-1, -9).setY(end.y + 4.2), b = at(-1, 9).setY(end.y + 4.2), mid = a.clone().lerp(b, 0.5); mid.y -= 0.8;
    const line = new THREE.Mesh(new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(a, mid, b), 10, 0.03, 4), wood);
    life.add(line);
    for (let k = 1; k < 9; k++) {
      const u = k / 9, p = new THREE.Vector3().lerpVectors(a, b, u); p.y -= Math.sin(Math.PI * u) * 0.8;
      const w = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.9).translate(0, -0.45, 0), cloths[k % 3]);
      w.position.copy(p); w.rotation.y = f + Math.PI / 2; life.add(w);
    }
    life.traverse((o) => { o.userData.noCollide = true; });
    root.add(life);
  }
  const coinLight = new THREE.Vector4(0, -1e5, 0, 0), squareLight = new THREE.Vector4(0, -1e5, 0, 0);

  const st = { notches: Object.fromEntries(places.map((m) => [m.id, m.start])), chain: null, lit: false, k: 1 };
  const UP = V(0, 1, 0), _q = new THREE.Quaternion(), _n = V();
  /** Turn a head to throw light arriving along `inDir` out along `outDir`. */
  const aim = (h, inDir, outDir) => {
    _n.copy(outDir).sub(inDir).normalize();   // (the glass's normal halves the angle between where the light comes from and where it goes)
    h.yaw.rotation.y = Math.atan2(_n.x, _n.z);
    h.tilt.rotation.x = -Math.asin(THREE.MathUtils.clamp(_n.y, -1, 1));
  };
  const setBeam = (b, from, to, k) => {
    const len = from.distanceTo(to);
    b.core.position.copy(from);
    b.core.quaternion.setFromUnitVectors(UP, _n.copy(to).sub(from).normalize());
    b.core.scale.set(0.24, len, 0.24);
    b.core.visible = k > 0.02;
    b.core.updateMatrixWorld();
    if (b.shaft) { b.shaft.set(from, 1.9, to, 1.4); b.shaft.fade(k); b.shaft.visible = k > 0.02; }
  };
  const hideBeam = (b) => { b.core.visible = false; if (b.shaft) { b.shaft.visible = false; } };
  /** Lay the chain out for the mirrors' notches (sway: the loose one's creak). */
  const lay = (sway = 0) => {
    const c = chainOf(places, end, st.notches, shape, sway);
    st.chain = c;
    // every head: lit ones throw the light where the chain says; dark ones sit at their notch, as if lit from above
    places.forEach((m, i) => {
      const prev = i ? places[i - 1].glass : m.glass.clone().addScaledVector(SUN, 100);
      const inDir = m.glass.clone().sub(prev).normalize();
      const target = places[i + 1]?.glass ?? end?.target ?? m.glass;
      // (the loose one's head is drawn at its notch: only its beam creaks, so the heads stay still between cranks)
      const outDir = i === c.stop ? beamDir(target.clone().sub(m.glass), st.notches[m.id]) : c.dirs[i] ?? beamDir(target.clone().sub(m.glass), m.turnable ? st.notches[m.id] : 0);
      if (!heads[i].set || heads[i].set.distanceToSquared(outDir) > 1e-8) { aim(heads[i], inDir, outDir); heads[i].set = outDir.clone(); }
      heads[i].face.material = i <= (c.done ? places.length : c.stop) ? (m.turnable ? shineMat : glassMat) : (m.turnable ? dullMat : glassMat);
    });
    beams.forEach((b, i) => { const s = c.segs[i]; if (s) setBeam(b, s.from, s.to, st.k); else hideBeam(b); });
    const stray = c.segs.find((s) => s.stray);
    if (stray) {
      coin.visible = st.k > 0.02;
      coin.position.copy(stray.to).addScaledVector(stray.normal, 0.15);
      coin.quaternion.setFromUnitVectors(V(0, 0, 1), stray.normal);
      coinLight.set(coin.position.x, coin.position.y, coin.position.z, 10 * st.k);
    } else { coin.visible = false; coinLight.set(0, -1e5, 0, 0); }
    st.lit = c.done;
    pool.visible = c.done && st.k > 0.02; life.visible = c.done;
    if (c.done && end) squareLight.set(end.at.x, end.at.y + 3, end.at.z, 22 * st.k); else squareLight.set(0, -1e5, 0, 0);
    return c;
  };
  lay();

  return {
    root, places, end, heads, beams, coin, pool, life,
    lights: [coinLight, squareLight],
    /** The chain as a line for the level design audit: the rim's mirror, each mirror's deck, the square. */
    line: [...places.map((m) => [m.deck.x, m.y, m.deck.z]), ...(end ? [[end.at.x, end.y, end.at.z]] : [])],
    /** No house, tree or prop on a deck's gangway or the square (the level's clearings). */
    clear: [...places.map((m) => ({ x: (m.edge ?? m.deck).x, y: m.y, z: (m.edge ?? m.deck).z, r: m.great ? 6 : 8 })), ...(end ? [{ x: end.at.x, y: end.y, z: end.at.z, r: 9 }] : [])],
    /** The mirrors' notches (id → 0..7): the chain laid out again. Returns the chain. */
    set(notches) { Object.assign(st.notches, notches); return lay(); },
    notch: (id) => st.notches[id],
    chain: () => st.chain,
    lit: () => st.lit,
    /** Per frame: the loose mirror creaks in the updraft (its stray beam and coin wander); the beams fade with the day. */
    update(dt, t) {
      const k = 1 - THREE.MathUtils.smoothstep(sharedUniforms.uNight?.value ?? 0, 0.2, 0.8);
      const moved = Math.abs(k - st.k) > 0.01;
      st.k = k;
      const stray = st.chain?.segs.some((s) => s.stray);
      // (the stray beam traced again five times a second: it creaks slowly, and a trace is a few thousand tests)
      if (moved || (stray && (st.clock = (st.clock ?? 0) + dt) > 0.2)) { st.clock = 0; lay(stray ? Math.sin(t * 0.37) * 0.05 + Math.sin(t * 0.13 + 1.2) * 0.03 : 0); }
    },
  };
}
