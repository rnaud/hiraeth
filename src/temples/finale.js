import * as THREE from 'three';
import { sightClear } from '../story/film.js';
import { purseSpot } from '../chimes.js';

// A temple's ending, filmed (issue #366: "Temples should end on a cinematic. Cinematic should have the level's music
// playing."). Every house ends the same way once its guardian is resolved: one shape, four panels, its details read
// from the house itself (its guardian, its arena, the door that opens on `{ resolved: true }`), with the few houses
// that need it nudged by FINALES below. It plays as a moment (src/story/moment.js: the ship's camera and Cinema, the
// letterbox, the skip tag; B / ○, Menu, Esc or a tap skips it), once per save (`temple.<id>.finale`), and the world's
// recorded theme comes in under it (Sound.musicCue: src/music-moments.js), as the game's other moments bring it.
//
//   A  keeper  the guardian at rest, a slow arc round it with him beside it (its own resolution plays out)
//   B  reward  low on the floor where its purse fell, the chimes rising, the guardian beyond
//   C  house   high and wide over its hall, the house's glyphs lighting up (rt.litWant: runtime.js eases them)
//   D  way     the way out: the door that waited for the guardian sinking open (held shut until this panel), him
//              turned to it
//
// The state it shows is the house's own: the door is opened at D's beat and for sure in onEnd (a skip or a failure lands
// the same), the glyphs ease back by themselves. When it can't play (no ship's camera: a test, a bench; a scene up), the
// door opens at once as it always did. The toasts the resolution says (the guardian's line, what changed outside) wait
// for its end (cinema.held).

export const FINALE = {
  keeper: 3.2,     // s of each panel
  reward: 2.4,
  house: 2.6,
  way: 2.8,
  doorLead: 0.5,   // s into D before the door starts down (it sinks in 1.8 s: pieces.js Door)
  glow: 0.35,      // how much brighter the house's glyphs come up (uGlow)
};
export const finaleLength = (F = FINALE) => F.keeper + F.reward + F.house + F.way;
export const finaleFlag = (id) => `temple.${id}.finale`;

/**
 * Per house: what it shows (`beat`, for the docs and the tests) and the few nudges a house needs:
 *   side    which way the keeper's arc turns (+1 / -1; default +1)
 *   door    the way out's element, where the house has more than one door that opens on the guardian
 *   wide    the house panel's distance out from the arena's middle, as a share of its radius (default 0.8)
 *   high    the house panel's height over the floor, as a share of the arena's radius (default 0.55)
 */
export const FINALES = {
  desert: { beat: 'the Keeper breathes out over the dry spout; the Rose House’s way up sinks open' },
  incal: { beat: 'the warden sags, its eye dark; the Warden’s Well’s way out opens over the shaft' },
  arzach2: { beat: 'the Cloud-Mother sighs her cloud away; the Founders’ Belfry’s high door opens' },
  spheres: { beat: 'the Echo takes his hand and is still; the Footprint’s way out opens' },
  buried: { beat: 'the Tooth-Warden locks up and the engine runs; the Engine-House’s way out opens' },
  perdide2: { beat: 'the Lampless folds its wings; the Lamp-House’s way out opens under the lamp' },
  perdide: { beat: 'the Mother Snapper sleeps; the Hush-House’s crystals hum and its way out opens' },
  arzach: { beat: 'the Elder rides the wind up out of the roost; the Aerie’s way out opens' },
  garage: { beat: 'the Foreman’s hands come round to the right time; the Clock-House’s way out opens' },
  edena: { beat: 'the Gardener closes its eyes among the beds; the Greenhouse’s way out opens' },
  bazaar: { beat: 'the First Sign says its line once and listens; the Undertower’s way out opens' },
  spacecity: { beat: 'the Anchor-Warden is still; the Mooring-House’s way out opens', high: 0.35 },   // (under the skin's floating plates)
  moonfoundry: { beat: 'the Last Founder stops with one moon cast; the Casting-House’s way out opens', door: 'd5' },
  underwater: { beat: 'the Listener settles on its shell; the Whale-House’s way out opens' },
};

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const UP = V(0, 1, 0);
const smooth = (t) => { t = Math.min(1, Math.max(0, t)); return t * t * (3 - 2 * t); };
const flat = (v) => { v.y = 0; const l = v.length(); return l > 1e-6 ? v.divideScalar(l) : v.set(0, 0, 1); };
const sameOpens = (o) => !!o && typeof o === 'object' && Object.keys(o).length === 1 && o.resolved === true;

/** The way out: the door whose condition is the guardian resolved (the nearest the arena's middle, or FINALES' own). */
export function wayOut(rt) {
  const F = FINALES[rt.id] ?? {}, els = rt.logic?.def?.elements ?? {};
  if (F.door && rt.piece?.(F.door)) return { id: F.door, piece: rt.piece(F.door) };
  const c = rt.guardian?.arena?.center ?? rt.arrival?.pos ?? V();
  let best = null;
  for (const [id, e] of Object.entries(els)) {
    if (e.type !== 'door' || !sameOpens(e.opens)) continue;
    const p = rt.piece?.(id);
    if (!p?.group) continue;
    const d = p.group.position.distanceTo(c);
    if (!best || d < best.d) best = { id, piece: p, d };
  }
  return best ? { id: best.id, piece: best.piece } : null;
}

/** A point kept inside the house (its bounds, `pad` m in from every side), in world space. */
function inside(rt, p, pad = 0.8) {
  const B = rt.bounds, K = rt.kit;
  if (!B || !K?.local) return p;
  const l = K.local(p);
  l.x = THREE.MathUtils.clamp(l.x, B.min.x + pad, B.max.x - pad);
  l.y = THREE.MathUtils.clamp(l.y, B.min.y + pad, B.max.y - pad);
  l.z = THREE.MathUtils.clamp(l.z, B.min.z + pad, B.max.z - pad);
  return K.world(l.x, l.y, l.z);
}

const _ray = new THREE.Raycaster();
/**
 * How far from `from` toward `to` the first drawn surface of the house is (Infinity: none): its rooms are drawn by
 * meshes the colliders don't all follow (a wall high over a passage's mouth is drawn, not solid), so the moment's own
 * pull-in (physics.rayDistance) can't see them. Nothing see-through, hidden, or in `skip` (the keeper, the way's door).
 */
export function drawnHit(rt, from, to, skip = []) {
  const d = from.distanceTo(to);
  if (!rt?.root || d < 0.3) return Infinity;
  _ray.set(from, to.clone().sub(from).divideScalar(d));
  _ray.near = 0.15; _ray.far = d;
  const shown = (o) => { for (let q = o; q; q = q.parent) { if (!q.visible || skip.includes(q)) return false; } return true; };
  for (const h of _ray.intersectObject(rt.root, true)) {
    const mat = Array.isArray(h.object.material) ? h.object.material[0] : h.object.material;
    if (!h.object.isMesh || mat?.transparent || mat?.visible === false || !shown(h.object)) continue;
    return h.distance;
  }
  return Infinity;
}
/** `pos`, brought in toward `look` to stand clear of the first drawn surface between them (`min` m from `look` at least). */
function clearOf(rt, look, pos, skip, min = 1.5) {
  const d = look.distanceTo(pos), hit = drawnHit(rt, look, pos, skip);
  return hit >= d ? pos : look.clone().lerp(pos, Math.max(min, hit - 0.6) / d);
}

/**
 * The keeper's drawn body as it stands now: the world box of its shown, opaque meshes (a skinned one posed, an
 * instanced one with its instances), empty when it has none. Its petals, leaves, wings, shell and legs reach well past
 * its `radius` (the Mother Snapper's leaves 13 m across, the Lampless's wings 19 m, the Listener's shell 12 m high):
 * the cinematics QC of v1.85 found B filmed through them in most houses and A in the wings and the shell (#528, #529).
 */
export function keeperBox(m, out = new THREE.Box3()) {
  out.makeEmpty();
  const g = m?.group;
  if (!g) return out;
  g.updateMatrixWorld(true);
  const t = new THREE.Box3();
  g.traverseVisible((o) => {
    if (!o.isMesh) return;
    const mat = Array.isArray(o.material) ? o.material[0] : o.material;
    if (mat?.transparent || mat?.visible === false) return;
    if (o.boundingBox !== undefined) { o.computeBoundingBox(); t.copy(o.boundingBox); }   // (skinned, instanced: their own)
    else { if (!o.geometry?.boundingBox) o.geometry?.computeBoundingBox(); if (!o.geometry?.boundingBox) return; t.copy(o.geometry.boundingBox); }
    t.applyMatrix4(o.matrixWorld);
    if ([t.min.x, t.min.y, t.min.z, t.max.x, t.max.y, t.max.z].every(Number.isFinite)) out.union(t);
  });
  return out;
}

/** Turns (radians, toward `side`) tried for A's arc and B's lens when the first is blocked: the smallest first. */
const ARC_TURNS = [0, 0.35, -0.35, 0.7, -0.7, 1.05, -1.05, 1.4, -1.4, 1.75, -1.75, 2.1, -2.1, 2.6, -2.6, Math.PI];
/** His body, as the finale's lenses keep out of it (m): its height, its reach round his feet, and how far B's lens stands off him (closer, he filled a third of the panel). */
const HIM = { h: 1.9, r: 0.5, clear: 2.6 };
const HOUSE_TURNS = [0, 0.3, -0.3, 0.6, -0.6, 0.9, -0.9, 1.2, -1.2, 1.6, -1.6, 2.0, -2.0, 2.4, -2.4];
/**
 * Does a shaft of light of the house (a piece's cone(): Sunbeam's, from its louvre to its pool) stand between `a` and
 * `b`? Its wash lies over whatever is behind it (src/veil.js LightShaft): a keeper seen through one is drawn pale, as
 * if see-through (the Greenhouse's Gardener under its sun, #529).
 */
export function shaftBetween(rt, a, b) {
  const d = a.distanceTo(b), q = V(), ax = V();
  for (const p of rt.pieces ?? []) {
    const s = p.cone?.();
    if (!s) continue;
    const L = ax.subVectors(s.bottom, s.top).length();
    if (L < 1e-3) continue;
    ax.divideScalar(L);
    for (let x = 0.5; x < d - 0.5; x += 0.4) {
      q.copy(a).lerp(b, x / d).sub(s.top);
      const t = q.dot(ax);
      if (t < 0 || t > L) continue;
      if (q.addScaledVector(ax, -t).length() < s.rTop + (s.rBottom - s.rTop) * (t / L)) return true;
    }
  }
  return false;
}
/**
 * The pieces whose shaft of light stands between `p` and any of a keeper's body (`b`: its middle and its box's corners
 * drawn a third in): a film hushes them while it looks through them (FILM_HUSH). The Greenhouse's sun falls on the
 * Gardener's own bed: from the high wide, whichever way, it washed half of it pale (#529).
 */
export function washes(rt, p, b) {
  const o = b.getCenter(V()), pts = [o];
  for (let i = 0; i < 8; i++) pts.push(V(i & 1 ? b.max.x : b.min.x, i & 2 ? b.max.y : b.min.y, i & 4 ? b.max.z : b.min.z).lerp(o, 0.35));
  return (rt.pieces ?? []).filter((piece) => piece.cone?.() && pts.some((q) => shaftBetween({ pieces: [piece] }, p, q)));
}
/** The share of a shaft's wash left while a film looks through it at the keeper. */
export const FILM_HUSH = 0.15;
/** m/s a calmed keeper walks on to its rest (boss.js update: walk(dt, rest, 1.8)). */
const REST_WALK = 1.8;
/** rad/s it turns to the way it walks (boss.js walk → turnTo(…, 2.5)). */
const TURN_RATE = 2.5;
const REWARD_TURNS =[0, 0.4, -0.4, 0.8, -0.8, 1.2, -1.2, 1.6, -1.6];
/** Is `p` in the frame of a lens at `pos` looking at `look` (vertical fov `fov`°, inside the letterbox)? */
function inFrameOf(pos, look, fov, p, aspect = ASPECT) {
  const f = look.clone().sub(pos).normalize(), r = f.clone().cross(UP).normalize(), u = r.clone().cross(f);
  const q = p.clone().sub(pos), z = q.dot(f);
  if (z < 0.2) return false;
  const tn = Math.tan(THREE.MathUtils.degToRad(fov / 2));
  return Math.abs(q.dot(u) / z / tn) < 0.78 && Math.abs(q.dot(r) / z / (tn * aspect)) < 0.92;
}

/**
 * m a lens keeps clear of the keeper's box (lens); the share of the frame its box may fill at most in A (ndc); in B,
 * how far past the frame's edges its box may run, the keeper's lower part framed beyond the purse (beyond).
 */
export const KEEP = { lens: 0.6, ndc: 0.95, beyond: 1.15 };
const ASPECT = 16 / 9;
/** The vertical fov (degrees) a lens at `pos` looking at `look` needs for the whole of `box` in its frame (KEEP.ndc). */
export function fitFov(pos, look, box, aspect = ASPECT, ndc = KEEP.ndc) {
  const f = look.clone().sub(pos).normalize(), r = f.clone().cross(UP).normalize(), u = r.clone().cross(f);
  let need = 0;
  const q = V();
  for (let i = 0; i < 8; i++) {
    q.set(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z).sub(pos);
    const z = q.dot(f);
    if (z < 0.2) return 180;
    need = Math.max(need, Math.abs(q.dot(u)) / z / ndc, Math.abs(q.dot(r)) / z / (ndc * aspect));
  }
  return THREE.MathUtils.radToDeg(2 * Math.atan(need));
}

/**
 * The four panels for a house as it stands now (the guardian where it settled, him where he is): { shots, at } with
 * `at` the frames' targets by panel (for the tests: what each must have in its frame), or null without a guardian.
 * Every lens is kept out of the keeper's drawn body (keeperBox) and, in A and B, set where it sees its subject
 * (sightClear: the house's colliders and drawn surfaces, and in B the keeper's own body).
 */
export function finaleShots(rt, F = FINALE) {
  const G = rt.guardian, P = rt.player;
  if (!G?.model?.pos || !G.arena) return null;
  const H = FINALES[rt.id] ?? {}, side = H.side ?? 1;
  const m = G.model, A = G.arena, c = A.center.clone().setY(A.y);
  const gh = m.height ?? 3, gr = m.radius ?? 2.6;
  // the keeper's body: its drawn box (a column of its radius and height where it has none drawn: a test's stand-in)
  const KB = keeperBox(m);
  if (KB.isEmpty()) KB.set(V(m.pos.x - gr, m.floats ? m.pos.y - gh / 2 : m.pos.y, m.pos.z - gr), V(m.pos.x + gr, m.floats ? m.pos.y + gh / 2 : m.pos.y + gh, m.pos.z + gr));
  // (calmed, it walks on to its rest as the film plays, boss.js update(): turned to the way there, REST_WALK m/s
  // along it, then round to its restHeading. Its body as it will stand, turned and moved, is what each panel's lens
  // keeps out of over that panel's time: reachOf)
  const p0 = m.pos.clone(), rest = m.rest ? V(m.rest.x, m.pos.y, m.rest.z) : V(A.center.x, m.pos.y, A.center.z);
  const go = Math.hypot(rest.x - p0.x, rest.z - p0.z), h0 = m.heading ?? 0;
  const walks = go > 0.5, hWalk = walks ? Math.atan2(rest.x - p0.x, rest.z - p0.z) : h0, tArrive = walks ? go / REST_WALK : 0;
  const hRest = m.restHeading ?? hWalk;
  const toward = (a, b, k) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * k;
  const headingAt = (t) => (t < tArrive ? toward(h0, hWalk, Math.min(1, t * TURN_RATE)) : toward(hWalk, hRest, 1 - Math.exp(-(t - tArrive))));
  const at = (t) => p0.clone().lerp(rest, walks ? Math.min(1, t / tArrive) : 0);
  const boxAt = (t, turning = true) => {
    const p = at(t), turn = turning ? headingAt(t) - h0 : 0, cs = Math.cos(turn), sn = Math.sin(turn), b = new THREE.Box3();
    for (const x of [KB.min.x, KB.max.x]) for (const z of [KB.min.z, KB.max.z]) {
      const lx = x - p0.x, lz = z - p0.z;
      b.expandByPoint(V(p.x + lx * cs + lz * sn, KB.min.y + p.y - p0.y, p.z - lx * sn + lz * cs));
    }
    b.max.y = KB.max.y + p.y - p0.y;
    return b;
  };
  // (and as it stood when the film started: a keeper already at rest, as in play, stays there)
  const reachOf = (t0, t1, turning = true) => { const b = boxAt(0, turning).union(boxAt(t0, turning)); for (let t = t0 + 0.25; t < t1; t += 0.25) b.union(boxAt(t, turning)); return b.union(boxAt(t1, turning)).expandByScalar(KEEP.lens); };
  const tB = F.keeper, tC = F.keeper + F.reward, tD = tC + F.house;
  const KA = reachOf(0, tB), KR = reachOf(tB, tC), KC = reachOf(tC, tD), KD = reachOf(tD, finaleLength(F));
  const kOff = KB.getCenter(V()).sub(m.pos);
  if (!m.floats) kOff.y = Math.min(kOff.y, gh * 0.45);   // (a tall body framed a little low: its face, not the ceiling over it)
  const body = () => m.pos.clone().add(kOff);
  const me = P?.pos?.clone?.() ?? c.clone().addScaledVector(V(0, 0, 1), A.r * 0.5);
  const way = wayOut(rt), skip = [m.group, way?.piece?.group].filter(Boolean);
  const sight = { physics: rt.physics ?? null, roots: [rt.root].filter(Boolean) };
  const inKeeper = (p, K) => K.containsPoint(p);
  const solid = (p) => !!rt.physics?.embedded?.(p);   // (a lens inside a collider: the Warden's Well's B, #528)
  /** Does he stand in the way of a lens at `p` looking at `q` (his body: an upright 1.9 m, HIM.r round)? */
  const besideHim = (p, q) => {
    if (!P?.pos) return false;
    const d = p.distanceTo(q), x = V();
    for (let s = 0; s <= d; s += 0.15) {
      x.copy(p).lerp(q, s / d);
      if (x.y > P.pos.y - 0.1 && x.y < P.pos.y + HIM.h && Math.hypot(x.x - P.pos.x, x.z - P.pos.z) < HIM.r) return true;
    }
    return false;
  };
  /** `pos` brought in toward `look` to stand short of the keeper's body (`through`: anywhere on the line between; else the lens alone, lifted over it). */
  const _r = new THREE.Ray(), _h = V();
  const pastKeeper = (look, pos, min, K, through = true) => {
    if (!through) return inKeeper(pos, K) ? inside(rt, pos.clone().setY(K.max.y + 0.5), 0.5) : pos;
    const d = look.distanceTo(pos);
    if (inKeeper(look, K) || d < 1e-3) return pos;
    _r.set(look, pos.clone().sub(look).divideScalar(d));
    const hit = _r.intersectBox(K, _h);
    return hit && look.distanceTo(hit) < d ? look.clone().lerp(pos, Math.max(min, look.distanceTo(hit) - 0.8) / d) : pos;
  };
  // A: the keeper whole, from behind him and a little round (him small in the foreground), the lens drifting on round
  const toMe = flat(me.clone().sub(m.pos)), dMe = Math.hypot(me.x - m.pos.x, me.z - m.pos.z);
  const a = Math.atan2(toMe.x, toMe.z) + side * 0.35;
  const half = KB.getSize(V()).multiplyScalar(0.5);
  const fit = 2.6 * (Math.max(gh * 0.6, gr * 0.9, Math.hypot(half.x, half.z) * 0.8) + 1);   // (out far enough for the whole of it in a 46° lens)
  const r = THREE.MathUtils.clamp(Math.max(fit, dMe + 4), 7, Math.max(7, A.r * 0.95));
  const lift = gh * 0.4 + 1.2;
  // (kept clear of the house's drawn walls along the whole arc: the shortest reach of three points on it; then, of
  // the arcs swung round the keeper and lifted, the first whose lens stays out of its body and of solids, sees it and
  // has the whole of it in a lens of 68° at most: the Lampless's wings and the Listener's shell filled the frame, #529.
  // A shaft of light in the way is hushed as it plays: washes, FILM_HUSH)
  const b0 = body();
  const arcAt = (a1, rad, k, up) => inside(rt, V(m.pos.x + Math.sin(a1 + side * 0.3 * k) * rad, A.y + lift + up + 0.5 * k, m.pos.z + Math.cos(a1 + side * 0.3 * k) * rad));
  let arc = null;
  for (const up of [0, 2.5, 5, 8]) {
    for (const turn of ARC_TURNS) {
      const a1 = a + side * turn;
      const needOf = (lens) => Math.max(...lens.map((p, i) => { const b = boxAt(F.keeper * i / 2, false), o = b.getCenter(V()); o.y = b0.y; return fitFov(p, o, b); }));
      // (the cheap tests first, on the arc before it is brought in: a lens in its body or wider than the best so far
      // stays so nearer in; the raycasts, most of the cost, only for the rest)
      const far = [0, 0.5, 1].map((k) => arcAt(a1, r, k, up));
      if (far.some((p) => inKeeper(p, KA)) || (arc && needOf(far) >= arc.need)) continue;
      const reach = Math.min(r, ...far.map((p) => clearOf(rt, b0, p, skip, 4).distanceTo(b0) * (r / Math.max(1e-3, p.distanceTo(b0)))));
      const lens = [0, 0.5, 1].map((k) => arcAt(a1, reach, k, up));
      const need = needOf(lens);
      if ((arc && need >= arc.need) || lens.some((p) => inKeeper(p, KA))) continue;
      if (lens.some((p) => solid(p) || !sightClear(p, b0, { ...sight, skip, near: 1 }))) continue;
      arc = { a1, reach, up, need };
      if (need <= 68) break;
    }
    if (arc?.need <= 68) break;
  }
  arc ??= { a1: a, reach: r, up: 0, need: 46 };
  // (a keeper too big for its hall at this reach: a wider lens, to keep the whole of it)
  const fov0 = THREE.MathUtils.clamp(Math.max(arc.need + 3, THREE.MathUtils.radToDeg(2 * Math.atan((fit / 2.6) / Math.max(1, arc.reach))) * 1.15), 46, 71);
  const keeper = (t) => {
    const k = smooth(t / F.keeper);
    return { pos: arcAt(arc.a1, arc.reach, k, arc.up), look: body(), fov: fov0 - 3 * k };
  };
  // B: the purse, on the floor between him and it, short of its body (the hosts' purseAt: chimes.js purseSpot): low
  // over it from his side, the keeper beyond. (Of the lenses round it, swung, drawn back and lifted, the first out of
  // the keeper's body and of solids, off him, that sees the purse past everything, the keeper's own body too)
  const toG = flat(m.pos.clone().sub(me));
  const purse = purseSpot(me, m.pos, KB);
  { const g = rt.physics?.groundAt?.(purse.x, purse.y + 2, purse.z, 8); purse.y = Number.isFinite(g) ? g : Math.max(me.y, A.y); }   // (on the floor as the chimes fall: ChimeField's groundAt)
  const across = V(-toG.z, 0, toG.x).multiplyScalar(side);
  const rewardLook = purse.clone().addScaledVector(toG, 0.5).addScaledVector(UP, 0.35);
  const chimes = purse.clone().addScaledVector(UP, 0.3), bB = at(F.keeper + F.reward / 2).add(kOff);
  const boxB = boxAt((tB + tC) / 2);
  const near = (p) => inside(rt, p, 0.5);
  // (the look raised toward the keeper `lean` of the way, the purse low in the frame and the keeper over it)
  // (`clear`: brought in clear of the house's drawn walls, clearOf: a raycast of the house; the search asks it only of
  // the lenses that pass the cheap tests first, its raycasts being most of its cost)
  const reward = (turn, back, up, lean = 0, clear = true) => {
    const sw = (v) => { const s = Math.sin(turn), k = Math.cos(turn), x = v.x - purse.x, z = v.z - purse.z; return near(V(purse.x + x * k + z * s, v.y, purse.z - x * s + z * k)); };
    const look = rewardLook.clone().lerp(bB, lean);
    const f = sw(purse.clone().addScaledVector(toG, -2.0 - back).addScaledVector(across, 0.9).addScaledVector(UP, 0.6 + up));
    const t = sw(purse.clone().addScaledVector(toG, -1.5 - back).addScaledVector(across, 0.7).addScaledVector(UP, 0.5 + up));
    if (!clear) return { look, ends: [f, t] };
    return { look, ends: [clearOf(rt, look, f, [way?.piece?.group].filter(Boolean), 1), clearOf(rt, look, t, [way?.piece?.group].filter(Boolean), 1)] };
  };
  // (a lens that frames the purse at the foot of the frame with the keeper beyond it, a good part of its body in the
  // frame (KEEP.beyond): from close in by the purse its body was a wall filling the panel, the purse a pink speck, #528;
  // its lens as long as that lets it: the purse as big as it can be)
  const fovB = (p, look) => THREE.MathUtils.clamp(fitFov(p, look, boxB, ASPECT, KEEP.beyond) + 2, 30, 52);
  // (its body over the whole panel first; where it turns round by the purse as it walks on and no lens near is out of
  // that, its body unturned. Never through him: the purse at his feet, filmed from behind him, was his legs)
  const KRmid = reachOf(tB, tC, false);
  // (the cheap tests, by geometry alone, then the raycasts: solids and the sight of the chimes)
  const cheapOk = (p, look, K, strict) => {
    if (inKeeper(p, K) || p.distanceTo(look) < 1.2 || (P?.pos && Math.hypot(p.x - P.pos.x, p.z - P.pos.z) < HIM.clear) || besideHim(p, chimes)) return false;
    const fov = fovB(p, look) - 4;
    return inFrameOf(p, look, fov, chimes) && inFrameOf(p, look, fov, bB) && (!strict || fitFov(p, look, boxB, ASPECT, KEEP.beyond) <= 52);
  };
  const threeOf = (ends) => [ends[0], ends[0].clone().lerp(ends[1], 0.5), ends[1]];
  const rewardOk = ({ ends, look }, K, strict) => threeOf(ends).every((p) => cheapOk(p, look, K, strict))
    && threeOf(ends).every((p) => !solid(p) && sightClear(p, chimes, { ...sight, skip: [way?.piece?.group].filter(Boolean), near: 0.25 }));
  let rewardPick = null;
  search: for (const K of [KR, KRmid]) for (const strict of [true, false]) for (const back of [0, 1.5, 3, 4.5, 6.5, 9, 12]) for (const up of [0, 0.8, 1.8, 3, 5]) for (const lean of [0.25, 0.45]) {
    for (const turn of REWARD_TURNS) {
      const raw = reward(side * turn, back, up, lean, false);
      if (!threeOf(raw.ends).every((p) => cheapOk(p, raw.look, K, strict))) continue;
      const e = reward(side * turn, back, up, lean);
      if (rewardOk(e, K, strict)) { rewardPick = e; break search; }
    }
  }
  const outOf = (p) => {
    if (!inKeeper(p, KRmid)) return p;
    const d = V(p.x - m.pos.x, 0, p.z - m.pos.z), l = d.length() || 1;
    _r.set(p, d.divideScalar(l));
    return near(_r.intersectBox(KRmid, _h) ? _h.clone().addScaledVector(d, 0.3) : p);
  };
  const { look: rewardAt, ends: [rewardFrom, rewardTo] } = rewardPick ?? (() => { const e = reward(0, 0, 0); return { look: e.look, ends: e.ends.map(outOf) }; })();
  // the way out
  const door = way?.piece?.group?.position?.clone() ?? rt.doorOut?.clone() ?? c.clone().addScaledVector(V(0, 0, 1), A.r);
  const dh = way?.piece?.h ?? 6;
  const toHall = flat(c.clone().sub(door));
  // C: the house, high and wide over the arena, from the side away from the way out
  const wide = (H.wide ?? 0.8) * A.r, high = (H.high ?? 0.55) * A.r + 3;
  const houseLook = c.clone().addScaledVector(toHall, -0.25 * A.r).addScaledVector(UP, 1.5);
  // (swung round the hall, the smallest turn first, until both ends and the middle see the house, out of the keeper's
  // body and of solids)
  const house = (turn) => {
    const dir = V(toHall.x * Math.cos(turn) + toHall.z * Math.sin(turn), 0, -toHall.x * Math.sin(turn) + toHall.z * Math.cos(turn));
    return [[wide, high], [wide * 0.92, high + 1.4]].map(([w, h]) => pastKeeper(houseLook, clearOf(rt, houseLook, inside(rt, c.clone().addScaledVector(dir, w).addScaledVector(UP, h)), skip, 6), 6, KC, false));
  };
  const houseOk = (e) => [e[0], e[0].clone().lerp(e[1], 0.5), e[1]].every((p) => !inKeeper(p, KC) && !solid(p)
    && sightClear(p, houseLook, { ...sight, skip, near: 3 }));
  let houseEnds = null;
  for (const turn of HOUSE_TURNS) { const e = house(side * turn); if (houseOk(e)) { houseEnds = e; break; } }
  const [houseFrom, houseTo] = houseEnds ?? house(0);
  // D: the door straight on from the hall's side (it may stand at the end of a passage off the arena), as it sinks
  const yaw = way?.piece?.group?.rotation?.y;
  const n = Number.isFinite(yaw) ? V(Math.sin(yaw), 0, Math.cos(yaw)) : toHall.clone();
  if (n.dot(toHall) < 0) n.negate();
  // (from as far back as the passage lets it, up to 11 m: the door whole, with its frame and the walls round it)
  const doorLook = door.clone().addScaledVector(n, 0.9).addScaledVector(UP, dh * 0.4);   // (in front of its slab: the lens's ray starts outside the shut door's block)
  const wayFrom = pastKeeper(doorLook, clearOf(rt, doorLook, inside(rt, door.clone().addScaledVector(n, 11).addScaledVector(UP, 2.3)), skip, 4), 4, KD);
  const back = wayFrom.distanceTo(doorLook);
  const wayTo = pastKeeper(doorLook, clearOf(rt, doorLook, inside(rt, door.clone().addScaledVector(n, Math.max(4, back - 1.6)).addScaledVector(UP, 2.1)), skip, 3.5), 3.5, KD);
  const shots = [
    { dur: F.keeper, from: keeper, ease: 'linear' },
    { dur: F.reward, from: { pos: rewardFrom, look: rewardAt, fov: fovB(rewardFrom, rewardAt) }, to: { pos: rewardTo, look: rewardAt, fov: fovB(rewardTo, rewardAt) - 4 } },
    { dur: F.house, from: { pos: houseFrom, look: houseLook, fov: 58 }, to: { pos: houseTo, look: houseLook, fov: 56 } },
    { dur: F.way, from: { pos: wayFrom, look: doorLook, fov: 54 }, to: { pos: wayTo, look: doorLook, fov: 52 } },
  ];
  return { shots, way, at: { keeper: body, reward: purse, house: houseLook, way: door }, axis: n, box: boxAt(finaleLength(F)), reach: { A: KA, B: KR, C: KC, D: KD }, picked: { arc, reward: !!rewardPick, house: !!houseEnds }, bodyAt: boxAt };
}

/**
 * Play a house's ending (from runtime.js onBossResolved, before the way out opens). Returns the moment, or null when it
 * can't play (then nothing is held: the door opens at once). `moments` the story's MomentStage, `sound` the game's.
 */
export function playFinale(rt, { moments = null, sound = null, game = rt.game, F = FINALE } = {}) {
  if (!moments?.play || !rt?.guardian) return null;
  const flag = finaleFlag(rt.id);
  if (game?.flag?.(flag)) return null;
  const film = finaleShots(rt, F);
  if (!film) return null;
  const { shots, way, at } = film;
  const L = rt.logic;
  let held = false;
  const letGo = () => { if (!held) return; held = false; L.force(way.id, null); rt.applyDoors(); };
  const tD = F.keeper + F.reward + F.house + F.doorLead;
  const log = (rt.finaleLog = { id: rt.id, picked: film.picked, started: false, music: null, door: way?.id ?? null, opened: false, skipped: null, ended: false });
  const m = moments.play({
    id: `temple.${rt.id}.finale`, flag, shots,
    behind: { avoid: () => keeperBox(rt.guardian.model) },   // (the follow camera back behind him, out of the keeper's body: the Listener's shell, #529)
    beats: [{ t: tD, run: () => { letGo(); log.opened = true; } }],
    onStart: (mo) => {
      log.started = true;
      // the way out held until its panel (the logic resolved a moment ago: the door would sink at once)
      if (way && !L.isOpen(way.id)) { L.force(way.id, false); held = true; }
      // the world's recorded theme, faded in under it (src/music-moments.js; the procedural score's moment where there is none)
      sound?.musicCue?.('moment');
      log.music = { cued: !!sound?.musicCue, track: !!sound?.trackBuffer, on: sound?.trackOn ?? null };
      mo.face = at.reward.clone();
    },
    onFrame: (mo, t) => {
      // he turns to the keeper, then to the way out
      mo.face = t < F.keeper + F.reward ? at.keeper() : at.way;
      mo.eyes = mo.shotI === 3 ? at.way.clone().addScaledVector(UP, 2) : at.keeper();
      // the house's glyphs come up over C and D (runtime.js eases them back after)
      rt.litWant = t >= F.keeper + F.reward ? 1 : 0;
      // (a shaft of light between the lens and the keeper hushed while it looks through it: the keeper whole, #529)
      const cam = mo.camera();
      const hushed = cam && mo.shotI < 3 ? [...washes(rt, cam.pos, film.bodyAt(t)), ...washes(rt, cam.pos, film.bodyAt(0))] : [];
      const cut = mo.shotI !== log.shot;   // (on a cut, at once: no fade seen in the new panel)
      log.shot = mo.shotI;
      for (const p of rt.pieces ?? []) if ('hush' in p) { p.hush = hushed.includes(p) ? FILM_HUSH : 1; if (cut) p._hush = p.hush; }
      if (log.music && sound?.trackOn !== undefined) log.music.on = sound.trackOn;
    },
    onEnd: (mo, skipped) => {
      letGo(); log.opened = true;
      for (const p of rt.pieces ?? []) if ('hush' in p) p.hush = 1;
      rt.litWant = 0;
      log.skipped = !!skipped; log.ended = true;
      if (typeof console !== 'undefined') console.info?.(`[temple finale] ${rt.id} ${skipped ? 'skipped' : 'watched'}; theme ${log.music?.track ? (log.music.on ? 'playing' : 'cued') : 'cued (no recording loaded)'}`);
    },
  });
  if (!m) { rt.finaleLog = null; return null; }
  rt.game?.emit?.('temple:finale', { id: rt.id });
  return m;
}
