import * as THREE from 'three';
import { sightClear } from '../story/film.js';
import { purseSpot, PURSE_AT } from '../chimes.js';
import { spoken } from '../story/tone.js';

// A temple's ending, filmed (issue #366: "Temples should end on a cinematic. Cinematic should have the level's music
// playing."). Every house ends once its guardian is resolved on four panels, its details read from the house itself (its
// guardian, its arena, the door that opens on `{ resolved: true }`, what its waking changes in the hall), with FINALES
// below saying what each house shows. It plays as a moment (src/story/moment.js: the ship's camera and Cinema, the
// letterbox, the skip tag; B / ○, Menu, Esc or a tap skips it), once per save (`temple.<id>.finale`), and the world's
// recorded theme comes in under it (Sound.musicCue: src/music-moments.js), as the game's other moments bring it.
//
//   A  keeper  the guardian at rest, a slow arc round it with him beside it (its own resolution plays out)
//   B  reward  low on the floor where its purse fell, the chimes rising, the guardian beyond
//   C  house   the house's own: what the guardian's waking changes in its hall, happening now (FINALES[id].sign: the
//              cistern filling under the dry spout, the stopped clocks coming round, the tide spreading over the
//              Listener's floor…), a short move on it. Until issue #562 every house showed its hall from high up and
//              ended on the makers' mark over a door, the same shot fourteen times (the v1.87 audit: interest 3.4)
//   D  way     the way out: the door that waited for the guardian sinking open (held shut until this panel), seen from
//              inside the hall, the house round it (FINALES[id].way: how far back, how high, how far round), him
//              turned to it
//
// The state it shows is the house's own: what C shows is held back through A and B (rt.finaleK 0, the house reading
// rt.calmK: runtime.js) and comes on over C, and stays; the door is opened at D's beat and for sure in onEnd (a skip or
// a failure lands the same), the glyphs ease back by themselves. When it can't play (no ship's camera: a test, a bench;
// a scene up), the door opens at once as it always did, and the house's change is there at once. The toasts the
// resolution says (the guardian's line, what changed outside) wait for its end (cinema.held).

export const FINALE = {
  keeper: 3.2,     // s of each panel
  reward: 2.4,
  house: 2.9,
  way: 2.5,
  doorLead: 0.4,   // s into D before the door starts down (it sinks in 1.8 s: pieces.js Door)
  glow: 0.35,      // how much brighter the house's glyphs come up (uGlow), over D
};
export const finaleLength = (F = FINALE) => F.keeper + F.reward + F.house + F.way;
export const finaleFlag = (id) => `temple.${id}.finale`;

const centerOf = (o) => o?.center?.clone?.() ?? o?.group?.getWorldPosition?.(new THREE.Vector3()) ?? null;

/**
 * Per house: what it shows (`beat`, for the docs and the tests), its own panel (`sign`) and the few nudges a house needs:
 *   side    which way the keeper's arc turns (+1 / -1; default +1)
 *   door    the way out's element, where the house has more than one door that opens on the guardian
 *   sign    C, the house's own panel (issue #562): { what (one line, for the docs), at(rt) → [{ pos, r, look? }] (the
 *           subjects tried in turn, world space: what it frames and how big it is), lens { up, dist, push, rise, turn }
 *           (over it, out from it, the share it moves in, how much it rises; `turn` the way it looks from, radians
 *           round from the hall's middle), hold (a door of the house held shut until the panel lets it go), run(rt, k,
 *           dt, t) (each frame from C on, after the house's own update: k 0..1 over C, 1 after), end(rt) }
 *           Most houses draw what C shows themselves, reading rt.calmK; `run` is for a beat the film plays (a stone
 *           sung, a dish's ring).
 *   way     D's lens: { back (m from the door), up (m over its floor), turn (radians off the door's axis, toward `side`),
 *           past (false: not from behind what C showed), clear (true: the doorway framed clear of the keeper's body,
 *           its part of the frame and the keeper's apart, the keeper a small share of it, the doorway seen whole past
 *           everything drawn: the Listener's shell filled half of D and a pod stood before its door, issue #567) }
 *   stage   (the review page, src/cinematics-page/runtime.js) the house as play leaves it when its guardian is calmed
 *   reward  B's lens, where a house needs it: { away (true: close and high over the purse from the far side of it from
 *           the keeper's middle, where its drawn box takes in the floor round him: the Listener's shell) }
 */
export const FINALES = {
  desert: { beat: 'the Keeper breathes out over the dry spout; the Rose House’s way up sinks open',
    // (near: the dry spout stands in the basin's middle)
    sign: { what: 'the cistern fills: the Givers’ water rises in the dry basin under the spout',
      at: (rt) => (rt.spring ? [{ pos: rt.spring.pool.position.clone().setY(rt.spring.pool.position.y + 0.9), r: 5.5, near: 2 }] : []), lens: { up: 3.2, dist: 11, push: 0.3 } },
    way: { back: 16, up: 4.5, turn: 0.45 } },
  incal: { beat: 'the warden sags, its eye dark; the Warden’s Well’s way out opens over the shaft',
    sign: { what: 'the shaft’s breath comes back: the four great vanes in the hall’s floor spin up, their rings lit',
      at: (rt) => (rt.hallVanes ?? []).map((v) => ({ pos: v.center.clone(), r: 4.5, pri: rt.player?.pos && v.center.distanceTo(rt.player.pos) < 5 ? 1 : 0 })), lens: { up: 4.5, dist: 9, push: 0.25, rise: 1.5 } },   // (pri: not the one he stands on)
    way: { back: 14, up: 1.4, turn: -0.5 } },
  arzach2: { beat: 'the Cloud-Mother sighs her cloud away; the Founders’ Belfry’s high door opens',
    sign: { what: 'the stones that fell up come down: the hall’s hung stones sink to the floor and stay',
      at: (rt) => { const K = rt.guardian?.model ? keeperBox(rt.guardian.model) : null; return (rt.hallStones?.list ?? []).map((s) => { const to = V(s.home.x, rt.hallStones.floorY + s.r * 0.6, s.home.z); return { pos: to, r: 3, near: s.r + 0.3, skip: [s.m], pri: K && K.distanceToPoint(to) < 4 ? 1 : 0, look: (k) => s.home.clone().lerp(to, k * k), span: s.home.y - to.y }; }); },   // (pri: not the one that lands by her)
      lens: { up: 2.4, dist: 13, push: 0.15, rise: -1.5 } },
    way: { back: 13, up: 6, turn: 0.35, past: false } },   // (past: the landed stone stood over the doorway's foot)
  spheres: { beat: 'the Echo takes his hand and is still; the Footprint’s way out opens',
    sign: { what: 'the three resonant spheres on their galleries sing in turn, then all three at once',
      // (from before one gallery, across the hall: the other two on either side of the Echo, calm between them)
      at: (rt) => (rt.resonators ?? []).map((s, i, R) => { const o = R[(i + 1) % R.length]; return { pos: s.center.clone().lerp(o.center, 0.5), r: 13, near: 1, through: true, skip: [s.group, o.group].filter(Boolean) }; }),
      lens: { up: 1.5, dist: 22, push: 0.1 },
      run: (rt, k) => { rt.singAll = k >= 0.6; rt.sing = k >= 0.6 ? 0 : ((rt.finaleSubject ?? 0) + Math.min(1, Math.floor((k / 0.6) * 2))) % 3; },   // (the two in the frame in turn, then all three at once)
      end: (rt) => { rt.singAll = false; } },
    way: { back: 12, up: 2, turn: -0.6 } },
  buried: { beat: 'the Tooth-Warden locks up and the engine runs; the Engine-House’s way out opens',
    sign: { what: 'the engine runs: the great gear in the floor turns again and shrugs the ball out of its teeth',
      at: (rt) => { const g = rt.engineGear; return g ? [{ pos: g.notch(), r: 6.5 }] : []; }, lens: { up: 8, dist: 11, push: 0.2, rise: -1 } },
    // (the review page's staging, as play leaves it: its last phase is won with the ball rolled back into the teeth)
    stage: (rt) => { const b = rt.piece?.('bG'); if (!b) return; rt.logic.moveDrum('bG', 1); b.t = 1; b.v = 0; b.rest = true; b.place?.(); },
    way: { back: 15, up: 3.5, turn: 0.6 } },
  perdide2: { beat: 'the Lampless folds its wings; the Lamp-House’s way out opens under the lamp',
    sign: { what: 'the great lamp burns again: the glass globe over the hall fills with light, and the room goes gold',
      at: (rt) => (rt.lampRoom ? [{ pos: rt.lampRoom.lamp.getWorldPosition(V()), r: 7, near: 3.8, skip: [rt.lampRoom.lamp] }] : []), lens: { up: -9, dist: 14, push: 0.15, rise: 2 } },
    way: { back: 14, up: 1.2, turn: 0.3 } },
  perdide: { beat: 'the Mother Snapper sleeps; the Hush-House’s crystals hum and its way out opens',
    sign: { what: 'the frosted crystals thaw and swing again, the three in time, humming in tune over her',
      at: (rt) => { const S = rt.motherCrystals?.swings ?? []; if (!S.length) return []; const c = S.reduce((a, s) => a.add(s.center), V()).divideScalar(S.length); return [{ pos: c, r: 9, near: 2, skip: S.map((s) => s.group) }]; }, lens: { up: -6.5, dist: 13, push: 0.15 } },   // (the three together, from low under them)
    way: { back: 15, up: 2.5, turn: -0.4 } },
  arzach: { beat: 'after the Elder reaches the Old Roost, the Aerie’s wind returns and its way out opens',
    sign: { what: 'the wind comes back: both vents of the roost breathe, their columns rising to the open sky',
      at: (rt) => (rt.roostWinds ?? []).map((w) => ({ pos: w.foot.clone().setY(w.foot.y + 4), r: 4.5, pri: w.on ? 1 : 0, skip: [w.root], look: (k) => w.foot.clone().setY(w.foot.y + 2 + 9 * k) })), lens: { up: -2.5, dist: 10, push: 0.1, rise: 3.5 } },
    way: { back: 14, up: 5, turn: 0.5 } },
  garage: { beat: 'the Foreman’s hands come round to the right time; the Clock-House’s way out opens',
    sign: { what: 'the stopped clocks on the workshop’s walls start again, their hands racing round to the true time',
      at: (rt) => (rt.workshopDials ?? []).map((d) => ({ pos: d.center.clone(), r: 3 })), lens: { up: -1.5, dist: 8, push: 0.3 } },
    way: { back: 13, up: 1.5, turn: -0.45 } },
  edena: { beat: 'the Gardener closes its eyes among the beds; the Greenhouse’s way out opens',
    sign: { what: 'the builders’ water runs back into the four beds round the walls, welling up round their blooms',
      at: (rt) => (rt.bedWater ?? []).map((b) => ({ pos: b.center.clone().setY(b.center.y + 0.6), r: 3.4, near: 1.2, skip: [b.m, b.bloom].filter(Boolean) })), lens: { up: 3, dist: 8, push: 0.3 } },
    // (the review page's staging, as play leaves it: its four beds bloomed before the Gardener wakes)
    stage: (rt) => { for (const b of rt.bedWater ?? []) if (b.seed) { rt.logic.light(b.seed.id); b.seed.k = 1; b.seed.apply(); } },
    way: { back: 15, up: 3, turn: 0.4 } },
  bazaar: { beat: 'the First Sign says its line once and listens; the Undertower’s way out opens',
    sign: { what: 'its line goes round the hall: the word stones sing the rest of it, one after another',
      at: (rt) => wordStones(rt).map((s) => ({ pos: s.center.clone(), r: 4.2, near: 1.6, skip: [s.group].filter(Boolean) })), lens: { up: 2, dist: 11, push: 0.2 },
      run: (rt, k) => {
        const S = wordStones(rt);
        // (the one in the frame first, then the rest of the line round the hall: lit and heard, not said, so nothing
        // in the house hears a word: a stone's own sing() tells the dishes and the wrist's recorder)
        const first = S[rt.finaleSubject ?? 0], order = [first, ...S.filter((x) => x !== first)].filter(Boolean);
        rt.finaleSung ??= 0;
        while (rt.finaleSung < order.length && k >= 0.08 + rt.finaleSung * 0.3) { const x = order[rt.finaleSung++]; x.flash = 1.6; rt.sound?.orbNote?.(x.N?.degree ?? 0, x.center, { size: 1.0 }); }
      },
      end: (rt) => { rt.finaleSung = null; } },
    way: { back: 14, up: 4, turn: -0.5, past: false } },   // (past: the stone a wall before the lens)
  spacecity: { beat: 'the Anchor-Warden is still; the Mooring-House’s way out opens', door: 'd8',
    sign: { what: 'the gate the Warden kept: its bars rise into the lintel, and the hub’s great capstan stands beyond',
      hold: 'd7', at: (rt) => { const p = rt.piece('d7'); return p?.group ? [{ pos: p.group.position.clone().setY(p.group.position.y + 3.6), r: 4.6 }] : []; }, lens: { up: -1.4, dist: 10, push: 0.3 } },
    way: { back: 14, up: 4, turn: 0.4 } },
  moonfoundry: { beat: 'the Last Founder stops with one moon cast; the Casting-House’s way out opens', door: 'd5',
    sign: { what: 'one moon cast: the iron moon in the cradle glows from within, white-hot, and cools to iron',
      at: (rt) => { const b = rt.piece('mA'); return b ? [{ pos: centerOf(b), r: 4, near: 1.6, skip: [b.group].filter(Boolean) }] : []; }, lens: { up: 1.8, dist: 8, push: 0.3 } },
    way: { back: 15, up: 2.2, turn: -0.35 } },
  underwater: { beat: 'the Listener settles on its shell; the Whale-House’s way out opens', reward: { away: true },
    sign: { what: 'the tide comes in: the sea wells up out of the Listener’s pool and spreads over the hall’s floor, the dishes ringing',
      at: (rt) => (rt.hallTide?.edges ?? []).map((p) => ({ pos: p.clone(), r: 4.5 })), lens: { up: 2.4, dist: 9, push: 0.25 },
      run: (rt, k) => { for (const id of ['dishW', 'dishE']) { const d = rt.piece(id); const due = id === 'dishW' ? 0.3 : 0.6; if (d && k >= due && !d.finaleRung) { d.finaleRung = true; for (const e of d.ends) e.k = 1; } } },
      end: (rt) => { for (const id of ['dishW', 'dishE']) { const d = rt.piece(id); if (d) d.finaleRung = false; } } },
    way: { back: 13, up: 2.6, turn: 0.5, clear: true } },
};
/** The Undertower's word stones (the First Sign's line: bazaar.js WordStone), in the line's order. */
function wordStones(rt) { return (rt.wordStones ?? (rt.pieces ?? []).filter((p) => Number.isInteger(p.i) && typeof p.sing === 'function' && p.N)).slice().sort((a, b) => a.i - b.i); }

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
  const RB = H.reward ?? {};
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
  // (RB.away: a keeper whose drawn box takes in the purse and him beside it, the Listener's shell over him: the lens
  // out on the far side of the purse from its body's middle, close, looking down on the chimes at his feet with its foot
  // beyond, him to one side; #562)
  // (and wherever its body stood so near him that the purse fell beside him or behind him, not a step toward it, or at
  // his feet: from behind him that was his legs, the Footprint's Echo with its rings wide)
  const ahead = (purse.x - me.x) * toG.x + (purse.z - me.z) * toG.z;
  if (RB.away || ahead < PURSE_AT.near * 0.6) {
    const ctr = boxB.getCenter(V()), away = flat(purse.clone().sub(ctr));
    find: for (const dist of [5, 6.5, 4]) for (const up of [6, 7.5, 4.5]) for (const turn of [0.7, -0.7, 1.0, -1.0, 0.45, -0.45, 1.3, -1.3]) {   // (high, looking down on the purse: from low its underside hung over him)
      const dir = V(away.x * Math.cos(turn) + away.z * Math.sin(turn), 0, -away.x * Math.sin(turn) + away.z * Math.cos(turn));
      const look = chimes.clone().addScaledVector(UP, 0.4).addScaledVector(dir, -0.6);
      const f = near(purse.clone().addScaledVector(dir, dist).addScaledVector(UP, up)), t = near(purse.clone().addScaledVector(dir, dist - 1.2).addScaledVector(UP, up - 0.8));
      const ok = [f, f.clone().lerp(t, 0.5), t].every((p) => !inKeeper(p, KRmid) && !solid(p) && !(P?.pos && Math.hypot(p.x - P.pos.x, p.z - P.pos.z) < 1.4)   // (the chimes at his feet: him in the shot with them, from over his shoulder)
        && sightClear(p, chimes, { ...sight, skip: [way?.piece?.group].filter(Boolean), near: 0.25 }) && drawnHit(rt, p, chimes, [way?.piece?.group].filter(Boolean)) >= p.distanceTo(chimes) - 0.3);
      if (ok) { rewardPick = { look, ends: [f, t], away: true, dist, up, turn }; break find; }
    }
  }
  // (FINALES[id].reward: the least lift and the most lean a house's B takes: the Listener's shell, 12 m high over its
  // purse, filled the top half of the frame from low by the floor, #562)
  if (!rewardPick) search: for (const K of [KR, KRmid]) for (const strict of [true, false]) for (const back of [0, 1.5, 3, 4.5, 6.5, 9, 12]) for (const up of [0, 0.8, 1.8, 3, 5]) for (const lean of [0.25, 0.45]) {
    for (const turn of REWARD_TURNS) {
      const raw = reward(side * turn, back, up, lean, false);
      if (!threeOf(raw.ends).every((p) => cheapOk(p, raw.look, K, strict))) continue;
      const e = reward(side * turn, back, up, lean);
      if (rewardOk(e, K, strict)) { rewardPick = { ...e, back, up, lean, turn, strict }; break search; }
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
  const fovOf = (p, look, r) => THREE.MathUtils.clamp(THREE.MathUtils.radToDeg(2 * Math.atan((r * 1.25) / Math.max(1, p.distanceTo(look)))), 30, 62);
  // C: the house's own (FINALES[id].sign, issue #562): each subject in turn (the one nearest him first), the lens swung
  // round it from the hall's side and lifted until both ends of its move and its middle are out of the keeper's body
  // and of solids, in the house and clear of its drawn walls, and see it past everything (the keeper too)
  const S = H.sign ?? {}, SL = S.lens ?? {};
  const subjects = (() => { try { return S.at?.(rt) ?? []; } catch { return []; } })().filter((x) => x?.pos && [x.pos.x, x.pos.y, x.pos.z].every(Number.isFinite))
    .map((x, i) => ({ ...x, i })).sort((p, q) => (p.pri ?? 0) - (q.pri ?? 0) || p.pos.distanceTo(me) - q.pos.distanceTo(me));   // (pri: the one that changes first)
  const signSkip = [way?.piece?.group, S.hold && rt.piece?.(S.hold)?.group].filter(Boolean);
  const lookOf = (x, k) => (typeof x.look === 'function' ? x.look(k) : x.look?.clone?.() ?? x.pos.clone());
  const skipOf = (x) => [...signSkip, ...(x.skip ?? []), ...(x.through ? [m.group] : [])];   // (through: the keeper may stand in the shot, the Footprint's Echo between its spheres)
  const signOk = (ends, x) => [ends[0], ends[0].clone().lerp(ends[1], 0.5), ends[1]].every((p, j) => {
    const lk = lookOf(x, j / 2), sk = skipOf(x);
    return rt.inside?.(p) !== false && !inKeeper(p, KC) && !solid(p) && p.distanceTo(lk) > 2.8 && !besideHim(p, lk)
      && sightClear(p, lk, { ...sight, skip: sk, near: x.near ?? Math.min(1.5, x.r * 0.4) }) && drawnHit(rt, p, lk, sk) >= p.distanceTo(lk) - (x.near ?? 0.2);
  });
  let sign = null;
  pick: for (const x of subjects) {
    const base = flat(c.clone().sub(x.pos));
    if (Math.hypot(x.pos.x - c.x, x.pos.z - c.z) < 2) base.copy(flat(me.clone().sub(x.pos)));
    const d0 = SL.dist ?? THREE.MathUtils.clamp(x.r * 2.4 + 3, 5, 16), up0 = SL.up ?? x.r * 0.4 + 1;
    for (const back of [1, 0.8, 1.25, 0.6]) for (const lift of [0, 2.5, 5]) for (const turn of HOUSE_TURNS) {
      const a1 = (SL.turn ?? 0) * side + side * turn;
      const dir = V(base.x * Math.cos(a1) + base.z * Math.sin(a1), 0, -base.x * Math.sin(a1) + base.z * Math.cos(a1));
      const at0 = lookOf(x, 0), at1 = lookOf(x, 1), d = d0 * back;
      const from = inside(rt, x.pos.clone().addScaledVector(dir, d).setY(x.pos.y + up0 + lift));
      const to = inside(rt, x.pos.clone().addScaledVector(dir, d * (1 - (SL.push ?? 0.25))).setY(x.pos.y + up0 + lift + (SL.rise ?? 0)));
      const ends = [from, to];
      if (!signOk(ends, x)) continue;
      sign = { x, ends, at0, at1 };
      break pick;
    }
  }
  let houseShot, houseAt;
  if (sign) {
    const { x, ends: [p0, p1] } = sign, span = x.span ?? 0;
    const fv = (p, k) => Math.min(66, fovOf(p, lookOf(x, k), x.r) + (span ? THREE.MathUtils.radToDeg(Math.atan(span / 2 / Math.max(1, p.distanceTo(lookOf(x, k))))) * 0.3 : 0));
    const moving = typeof x.look === 'function';
    houseShot = moving
      ? { dur: F.house, ease: 'inOut', clear: false, from: (t) => ({ pos: p0, look: lookOf(x, Math.min(1, t / F.house)), fov: fv(p0, 0) }), to: (t) => ({ pos: p1, look: lookOf(x, Math.min(1, t / F.house)), fov: fv(p0, 0) - 2 }) }   // (k as the house has it: finaleK)
      : { dur: F.house, clear: false, from: { pos: p0, look: lookOf(x, 0), fov: fv(p0, 0) }, to: { pos: p1, look: lookOf(x, 1), fov: fv(p0, 0) - 4 } };   // (its lens the same or longer as it moves in: a push, not a zoom out)   // (clear: checked here, signOk: the moment's own pull-in from the look would start inside the subject's collider)
    houseAt = moving ? (k = 0.5) => lookOf(x, k) : lookOf(x, 0.5);   // (a subject that moves: where it is `k` of the way through the panel)
  } else {
    // (no subject this house can film: high over its hall, as before #562)
    const houseLook = c.clone().addScaledVector(toHall, -0.25 * A.r).addScaledVector(UP, 1.5);
    const wide = 0.8 * A.r, high = 0.55 * A.r + 3;
    const p0 = pastKeeper(houseLook, clearOf(rt, houseLook, inside(rt, c.clone().addScaledVector(toHall, wide).addScaledVector(UP, high)), skip, 6), 6, KC, false);
    houseShot = { dur: F.house, from: { pos: p0, look: houseLook, fov: 58 }, to: { pos: p0.clone().lerp(houseLook, 0.08), look: houseLook, fov: 56 } };
    houseAt = houseLook;
  }
  // D: the way out from inside the hall, the house round it (FINALES[id].way: back, up, turn), the lens out of the keeper
  // as it stands then and seeing the door past it; it moves in a little as the door sinks. (Straight on from as far
  // back as the passage lets it, as before #562, where nothing of that clears)
  const yaw = way?.piece?.group?.rotation?.y;
  const n = Number.isFinite(yaw) ? V(Math.sin(yaw), 0, Math.cos(yaw)) : toHall.clone();
  if (n.dot(toHall) < 0) n.negate();
  const doorLook = door.clone().addScaledVector(n, 0.9).addScaledVector(UP, dh * 0.4);   // (in front of its slab: the lens's ray starts outside the shut door's block)
  const WL = H.way ?? {}, doorMid = door.clone().addScaledVector(UP, dh * 0.45);
  // (its lens as wide as the doorway and its frame want, a little room round them: the hall's wall round it in the frame)
  const doorBox = new THREE.Box3().setFromPoints([door.clone().addScaledVector(V(-n.z, 0, n.x), -3.8), door.clone().addScaledVector(V(-n.z, 0, n.x), 3.8).addScaledVector(UP, dh + 0.8)]);
  const wayFov = (p) => THREE.MathUtils.clamp(fitFov(p, doorLook, doorBox, ASPECT, 0.8), 38, 56);
  // (WL.clear, issue #567: the doorway whole in the frame, nothing drawn before it, the keeper's body as it stands through
  // D apart from it on the screen and a small share of the frame)
  const doorPts = WL.clear ? [-1.2, 0, 1.2].flatMap((s) => [0.12, 0.5, 0.85].map((h) => door.clone().addScaledVector(V(-n.z, 0, n.x), s).addScaledVector(UP, dh * h).addScaledVector(n, 0.3))) : [];
  const KDbody = WL.clear ? (() => { const b = boxAt(tD); for (let t = tD + 0.25; t < finaleLength(F); t += 0.25) b.union(boxAt(t)); return b.union(boxAt(finaleLength(F))); })() : null;
  const doorClear = (p) => {
    if (!WL.clear) return true;
    if (doorPts.some((q) => drawnHit(rt, p, q, [way?.piece?.group].filter(Boolean)) < p.distanceTo(q) - 0.4)) return false;
    const cam = new THREE.PerspectiveCamera(wayFov(p), ASPECT, 0.1, 2000);
    cam.position.copy(p); cam.lookAt(doorLook); cam.updateMatrixWorld(); cam.updateProjectionMatrix();
    const dr = [Infinity, -Infinity, Infinity, -Infinity];
    for (const q of doorPts) { const v = q.clone().project(cam); if (v.z > 1) return false; dr[0] = Math.min(dr[0], v.x); dr[1] = Math.max(dr[1], v.x); dr[2] = Math.min(dr[2], v.y); dr[3] = Math.max(dr[3], v.y); }
    // (a grid of rays over the frame: none that meets the keeper's box in the doorway's part of the frame or round it, a
    // fifth of them at most anywhere)
    const m = 0.1, ray = new THREE.Ray(), q = V();
    let hit = 0, all = 0;
    for (let i = 0; i < 16; i++) for (let j = 0; j < 9; j++) {
      const x = -1 + (i + 0.5) / 8, y = -1 + (j + 0.5) / 4.5;
      ray.set(p, q.set(x, y, 0.5).unproject(cam).sub(p).normalize());
      all++;
      if (!ray.intersectsBox(KDbody)) continue;
      hit++;
      if (x > dr[0] - m && x < dr[1] + m && y > dr[2] - m && y < dr[3] + m) return false;
    }
    return hit / all <= 0.2;
  };
  const wayOk = (p) => rt.inside?.(p) !== false && !inKeeper(p, KD) && !solid(p) && p.distanceTo(doorLook) > 4
    && sightClear(p, doorLook, { ...sight, skip: [way?.piece?.group].filter(Boolean), near: 0.6 }) && drawnHit(rt, doorLook, p, skip) >= p.distanceTo(doorLook) - 0.2
    && drawnHit(rt, p, doorMid, skip) >= p.distanceTo(doorMid) - 0.4   // (and from the lens to the doorway's middle: a stone before it, the Undertower's)
    && doorClear(p);
  let wayEnds = null;
  // (first from behind what C showed, the house's own thing in the foreground and the way out beyond it: the basin, the
  // vane, the cradle, the tide; then from the hall, as FINALES[id].way says)
  if (sign && WL.past !== false) {
    const x = sign.x, from = x.pos.clone(), back = flat(from.clone().sub(door));
    past: for (const d of [3.5, 5, 2.5, 7]) for (const up of [2.2, 3.5, 1.4, 5]) for (const turn of [0, 0.3, -0.3, 0.6, -0.6]) {
      const dir = V(back.x * Math.cos(turn) + back.z * Math.sin(turn), 0, -back.x * Math.sin(turn) + back.z * Math.cos(turn));
      const p0 = inside(rt, from.clone().addScaledVector(dir, d).setY(door.y + up));
      if (p0.distanceTo(doorLook) < 7 || p0.distanceTo(doorLook) > 19 || Math.hypot(p0.x - from.x, p0.z - from.z) < x.r * 0.8 + 1) continue;   // (the door a good part of the frame; the subject not a wall before the lens)
      const p1 = p0.clone().lerp(doorLook, 0.12);
      if (wayOk(p0) && wayOk(p1) && wayOk(p0.clone().lerp(p1, 0.5))) { wayEnds = [p0, p1]; break past; }
    }
  }
  const turns = [0, 0.15, -0.15, 0.3, -0.3, 0.5, -0.5, ...(WL.clear ? [0.7, -0.7, 0.9, -0.9] : [])];
  // (and, where the keeper stands before its door, from over its body: WL.clear)
  const ups = [WL.up ?? 2.5, (WL.up ?? 2.5) + 2.5, 1.4, ...(WL.clear ? [KDbody.max.y - door.y + 1.5, KDbody.max.y - door.y + 3.5] : [])];
  if (!wayEnds) find: for (const back of [WL.back ?? 14, (WL.back ?? 14) * 0.75, (WL.back ?? 14) * 0.55]) for (const up of ups) for (const turn of turns) {
    const a1 = side * ((WL.turn ?? 0) + turn);
    const dir = V(n.x * Math.cos(a1) + n.z * Math.sin(a1), 0, -n.x * Math.sin(a1) + n.z * Math.cos(a1));
    const p0 = inside(rt, door.clone().addScaledVector(dir, back).setY(door.y + up));
    const p1 = p0.clone().lerp(doorLook, 0.16);
    if (wayOk(p0) && wayOk(p1) && wayOk(p0.clone().lerp(p1, 0.5))) { wayEnds = [p0, p1]; break find; }
  }
  const wayPicked = !!wayEnds;
  if (!wayEnds) {
    const wayFrom = pastKeeper(doorLook, clearOf(rt, doorLook, inside(rt, door.clone().addScaledVector(n, 11).addScaledVector(UP, 2.3)), skip, 4), 4, KD);
    const back = wayFrom.distanceTo(doorLook);
    wayEnds = [wayFrom, pastKeeper(doorLook, clearOf(rt, doorLook, inside(rt, door.clone().addScaledVector(n, Math.max(4, back - 1.6)).addScaledVector(UP, 2.1)), skip, 3.5), 3.5, KD)];
  }
  const [wayFrom, wayTo] = wayEnds;
  const shots = [
    { dur: F.keeper, from: keeper, ease: 'linear' },
    { dur: F.reward, from: { pos: rewardFrom, look: rewardAt, fov: rewardPick?.away ? 40 : fovB(rewardFrom, rewardAt) }, to: { pos: rewardTo, look: rewardAt, fov: (rewardPick?.away ? 40 : fovB(rewardTo, rewardAt)) - 4 } },   // (away: him and the purse, not the keeper's whole box)
    houseShot,
    { dur: F.way, clear: !wayPicked, from: { pos: wayFrom, look: doorLook, fov: wayFov(wayFrom) }, to: { pos: wayTo, look: doorLook, fov: wayFov(wayTo) - 2 } },
  ];
  if (rt.guardian.def.helper === 'elderflight') {
    // Flight already ended at the Old Roost. On return, begin with the source
    // roost's quiet vent, then show its wind restored; never film a second arrival.
    const start = typeof houseShot.from === 'function' ? houseShot.from(0) : houseShot.from;
    shots[0] = { dur: F.keeper, clear: houseShot.clear, from: start };
    // A separate portrait of the Elder: the purse is near the old low lens and
    // must not enlarge a body/reward union into a fisheye. Her articulated rig
    // owns head, crest and wings; tell rings, chimes and room effects are not
    // subjects. Keep a normal lens and find room for it instead of widening it.
    let lastPortrait = null, chosenTurn = 0;
    const portraitBounds = () => {
      // The live guardian is a wrapper. Its generated skin meshes are siblings
      // of the rig bones; traversing `rig` alone would omit the accepted skin.
      m.group.updateMatrixWorld(true);
      const inner = m.inner ?? m;
      if (!inner.meshes?.length) return keeperBox({ group: inner.rig ?? inner.group });
      const bounds = new THREE.Box3();
      for (const mesh of inner.meshes) if (mesh.visible) bounds.union(keeperBox({ group: mesh }));
      return bounds;
    };
    const portraitTarget = () => portraitBounds().getCenter(V());
    const portrait = () => {
      const bounds = portraitBounds(), look = bounds.getCenter(V());
      const whole = keeperBox(m).expandByScalar(.4);
      const safe = pos => rt.inside(pos) && !solid(pos) && !whole.containsPoint(pos)
        && fitFov(pos, look, bounds, 4 / 3, .72) <= 52
        && sightClear(pos, look, { ...sight, skip: [m.group], near: .3 });
      const accept = pos => {
        shots[1].portraitAvailable = true; shots[1].clear = false;
        return (lastPortrait = { pos, look, fov: 52 });
      };
      // A stationary checked lens avoids metre-step camera jumps as wings move.
      if (lastPortrait && safe(lastPortrait.pos)) return accept(lastPortrait.pos);
      const direction = flat(me.clone().sub(look));
      const turns = [...new Set([chosenTurn, 0, .35, -.35, .7, -.7, 1.1, -1.1, Math.PI])];
      for (const turn of turns) {
        const dir = V(direction.x * Math.cos(turn) + direction.z * Math.sin(turn), 0,
          -direction.x * Math.sin(turn) + direction.z * Math.cos(turn));
        for (let distance = 10; distance <= 40; distance += 1) {
          const pos = look.clone().addScaledVector(dir, distance).addScaledVector(UP, .5);
          if (fitFov(pos, look, bounds, 4 / 3, .72) > 52) continue;
          if (!safe(pos)) continue;
          chosenTurn = turn;
          return accept(pos);
        }
      }
      // Explicit room-view fallback, never an unqualified Elder portrait. Keep
      // the original room shot's collision policy; review requires a portrait
      // throughout the accepted Aerie pose rather than counting this as a pass.
      shots[1].portraitAvailable = false; shots[1].clear = houseShot.clear;
      return start;
    };
    shots[1] = { dur: F.reward, clear: false, from: portrait };
    shots[1].subject = () => shots[1].portraitAvailable === false ? start.look.clone() : portraitTarget();
  }
  return { shots, way, at: { opening: rt.guardian.def.helper === 'elderflight' ? shots[0].from.look : body, keeper: body, reward: purse, house: houseAt, way: door }, axis: n, box: boxAt(finaleLength(F)), reach: { A: KA, B: KR, C: KC, D: KD }, picked: { arc, reward: !!rewardPick, sign: sign ? sign.x.i : null, way: wayPicked }, sign: sign ? { skip: skipOf(sign.x), near: sign.x.near ?? Math.min(1.5, sign.x.r * 0.4) } : null, bodyAt: boxAt };
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
  const L = rt.logic, sign = FINALES[rt.id]?.sign ?? {};
  // (doors held: the way out until D's beat, and a door the house's own panel opens, until C's)
  const held = new Set();
  const letGo = (id) => { if (!held.has(id)) return; held.delete(id); L.force(id, null); rt.applyDoors(); };
  const hold = (id) => { if (id && rt.piece?.(id) && !L.isOpen(id)) { L.force(id, false); held.add(id); } };
  const tC = F.keeper + F.reward, tD = tC + F.house;
  const kOf = (t) => (t < tC ? 0 : Math.min(1, (t - tC) / F.house));
  const log = (rt.finaleLog = { id: rt.id, picked: film.picked, started: false, music: null, door: way?.id ?? null, opened: false, skipped: null, ended: false, sign: null });
  let T = 0;
  const m = moments.play({
    id: `temple.${rt.id}.finale`, flag, shots,
    behind: { avoid: () => keeperBox(rt.guardian.model) },   // (the follow camera back behind him, out of the keeper's body: the Listener's shell, #529)
    beats: [
      ...(rt.guardian.def.helper ? [{ t: tC + .15, secs: F.house - .2, line: spoken('scene', rt.id === 'desert'
        ? '~happy~ Water reaches the dry basin again.' : '~happy~ The wind returns to both vents.') }] : []),
      { t: tC + 0.35, run: () => { if (sign.hold) { letGo(sign.hold); log.held = sign.hold; } } },
      { t: tD + F.doorLead, run: () => { if (way) letGo(way.id); log.opened = true; } },
    ],
    onStart: (mo) => {
      log.started = true;
      // the way out held until its panel (the logic resolved a moment ago: the door would sink at once), and what the
      // house's own panel shows held back until it (rt.finaleK: the house reads rt.calmK)
      if (way) hold(way.id);
      hold(sign.hold);
      rt.finaleK = 0;
      rt.finaleSubject = film.picked.sign;
      rt.finaleRun = (dt, t) => { if (T >= tC) { log.sign ??= T; sign.run?.(rt, kOf(T), dt, t); } };
      // the world's recorded theme, faded in under it (src/music-moments.js; the procedural score's moment where there is none)
      sound?.musicCue?.('moment');
      log.music = { cued: !!sound?.musicCue, track: !!sound?.trackBuffer, on: sound?.trackOn ?? null };
      mo.face = at.reward.clone();
    },
    onFrame: (mo, t) => {
      T = t;
      rt.finaleK = kOf(t);
      // he turns to the keeper, then to the way out
      mo.face = t < tC ? at.keeper() : at.way;
      mo.eyes = mo.shotI === 3 ? at.way.clone().addScaledVector(UP, 2) : at.keeper();
      // the house's glyphs come up over D, the way out (runtime.js eases them back after)
      rt.litWant = t >= tD ? 1 : 0;
      // (a shaft of light between the lens and the keeper hushed while it looks through it: the keeper whole, #529)
      const cam = mo.camera();
      const hushed = cam && mo.shotI < 3 ? [...washes(rt, cam.pos, film.bodyAt(t)), ...washes(rt, cam.pos, film.bodyAt(0))] : [];
      const cut = mo.shotI !== log.shot;   // (on a cut, at once: no fade seen in the new panel)
      log.shot = mo.shotI;
      for (const p of rt.pieces ?? []) if ('hush' in p) { p.hush = hushed.includes(p) ? FILM_HUSH : 1; if (cut) p._hush = p.hush; }
      if (log.music && sound?.trackOn !== undefined) log.music.on = sound.trackOn;
    },
    onEnd: (mo, skipped) => {
      for (const id of [...held]) letGo(id);
      log.opened = true;
      for (const p of rt.pieces ?? []) if ('hush' in p) p.hush = 1;
      rt.litWant = 0;
      // (what the house's panel shows, all there: a skip lands where the film would have)
      if (T < tC + F.house) sign.run?.(rt, 1, 0, 0);
      sign.end?.(rt);
      rt.finaleK = null; rt.finaleRun = null; rt.finaleSubject = null;
      log.skipped = !!skipped; log.ended = true;
      if (typeof console !== 'undefined') console.info?.(`[temple finale] ${rt.id} ${skipped ? 'skipped' : 'watched'}; theme ${log.music?.track ? (log.music.on ? 'playing' : 'cued') : 'cued (no recording loaded)'}`);
    },
  });
  if (!m) { rt.finaleLog = null; rt.finaleK = null; rt.finaleRun = null; for (const id of [...held]) letGo(id); return null; }
  rt.game?.emit?.('temple:finale', { id: rt.id });
  return m;
}
