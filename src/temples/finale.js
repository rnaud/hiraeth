import * as THREE from 'three';

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
 * The four panels for a house as it stands now (the guardian where it settled, him where he is): { shots, at } with
 * `at` the frames' targets by panel (for the tests: what each must have in its frame), or null without a guardian.
 */
export function finaleShots(rt, F = FINALE) {
  const G = rt.guardian, P = rt.player;
  if (!G?.model?.pos || !G.arena) return null;
  const H = FINALES[rt.id] ?? {}, side = H.side ?? 1;
  const m = G.model, A = G.arena, c = A.center.clone().setY(A.y);
  const gh = m.height ?? 3, gr = m.radius ?? 2.6;
  const body = () => m.pos.clone().addScaledVector(UP, m.floats ? 0 : gh * 0.45);
  const me = P?.pos?.clone?.() ?? c.clone().addScaledVector(V(0, 0, 1), A.r * 0.5);
  // A: the keeper whole, from behind him and a little round (him small in the foreground), the lens drifting on round
  const toMe = flat(me.clone().sub(m.pos)), dMe = Math.hypot(me.x - m.pos.x, me.z - m.pos.z);
  const a = Math.atan2(toMe.x, toMe.z) + side * 0.35;
  const fit = 2.6 * (Math.max(gh * 0.6, gr * 0.9) + 1);   // (out far enough for the whole of it in a 46° lens)
  const r = THREE.MathUtils.clamp(Math.max(fit, dMe + 4), 7, Math.max(7, A.r * 0.95));
  const lift = gh * 0.4 + 1.2;
  const way = wayOut(rt), skip = [m.group, way?.piece?.group].filter(Boolean);
  // (the keeper's own body, as a column: the door's view never looks through it, and no lens is ever inside it; its
  // drawn surface is left to this, a skinned body's triangles being where its bind pose was)
  const kr = gr * 1.05 + 0.4, kLo = m.floats ? m.pos.y - gh / 2 - 0.5 : m.pos.y - 0.5, kHi = (m.floats ? m.pos.y + gh / 2 : m.pos.y + gh) + 0.5;
  const inKeeper = (p) => Math.hypot(p.x - m.pos.x, p.z - m.pos.z) < kr && p.y > kLo && p.y < kHi;
  const pastKeeper = (look, pos, min, through = true) => {
    const d = look.distanceTo(pos), q = V();
    for (let s = through ? 0.3 : d; s <= d; s += 0.3) if (inKeeper(q.copy(look).lerp(pos, s / d))) return look.clone().lerp(pos, Math.max(min, s - 0.8) / d);
    return pos;
  };
  /** A point pushed out of the keeper's column, straight away from its middle. */
  const outOf = (p) => {
    if (!inKeeper(p)) return p;
    const d = V(p.x - m.pos.x, 0, p.z - m.pos.z), l = d.length() || 1;
    return inside(rt, p.clone().set(m.pos.x + (d.x / l) * (kr + 0.3), p.y, m.pos.z + (d.z / l) * (kr + 0.3)), 0.5);
  };
  // (kept clear of the house's drawn walls along the whole arc: the shortest reach of three points on it)
  const b0 = body();
  const rr = Math.min(r, ...[0, 0.5, 1].map((k) => { const ang = a + side * 0.3 * k, p = inside(rt, V(m.pos.x + Math.sin(ang) * r, A.y + lift + 0.5 * k, m.pos.z + Math.cos(ang) * r)); return clearOf(rt, b0, p, skip, 4).distanceTo(b0) * (r / Math.max(1e-3, p.distanceTo(b0))); }));
  // (a keeper too big for its hall at this reach: a wider lens, to keep the whole of it)
  const fov0 = THREE.MathUtils.clamp(THREE.MathUtils.radToDeg(2 * Math.atan((fit / 2.6) / Math.max(1, rr))) * 1.15, 46, 68);
  const keeper = (t) => {
    const k = smooth(t / F.keeper), ang = a + side * 0.3 * k, at = body();
    const pos = inside(rt, V(m.pos.x + Math.sin(ang) * rr, A.y + lift + 0.5 * k, m.pos.z + Math.cos(ang) * rr));
    return { pos, look: at, fov: fov0 - 3 * k };
  };
  // B: the purse, on the floor between him and it (main.js purseAt): low over it from his side, the keeper beyond
  const toG = flat(m.pos.clone().sub(me)), dG = Math.hypot(m.pos.x - me.x, m.pos.z - me.z);
  const purse = me.clone().addScaledVector(toG, Math.min(3.4, dG)).setY(Math.max(me.y, A.y));
  const across = V(-toG.z, 0, toG.x).multiplyScalar(side);
  const rewardLook = purse.clone().addScaledVector(toG, 0.5).addScaledVector(UP, 0.35);
  const rewardFrom = outOf(clearOf(rt, rewardLook, inside(rt, purse.clone().addScaledVector(toG, -2.0).addScaledVector(across, 0.9).addScaledVector(UP, 0.6), 0.5), skip, 1));
  const rewardTo = outOf(clearOf(rt, rewardLook, inside(rt, purse.clone().addScaledVector(toG, -1.5).addScaledVector(across, 0.7).addScaledVector(UP, 0.5), 0.5), skip, 1));
  // the way out
  const door = way?.piece?.group?.position?.clone() ?? rt.doorOut?.clone() ?? c.clone().addScaledVector(V(0, 0, 1), A.r);
  const dh = way?.piece?.h ?? 6;
  const toHall = flat(c.clone().sub(door));
  // C: the house, high and wide over the arena, from the side away from the way out
  const wide = (H.wide ?? 0.8) * A.r, high = (H.high ?? 0.55) * A.r + 3;
  const houseLook = c.clone().addScaledVector(toHall, -0.25 * A.r).addScaledVector(UP, 1.5);
  const houseFrom = pastKeeper(houseLook, clearOf(rt, houseLook, inside(rt, c.clone().addScaledVector(toHall, wide).addScaledVector(UP, high)), skip, 6), 6, false);
  const houseTo = pastKeeper(houseLook, clearOf(rt, houseLook, inside(rt, c.clone().addScaledVector(toHall, wide * 0.92).addScaledVector(UP, high + 1.4)), skip, 6), 6, false);
  // D: the door straight on from the hall's side (it may stand at the end of a passage off the arena), as it sinks
  const yaw = way?.piece?.group?.rotation?.y;
  const n = Number.isFinite(yaw) ? V(Math.sin(yaw), 0, Math.cos(yaw)) : toHall.clone();
  if (n.dot(toHall) < 0) n.negate();
  // (from as far back as the passage lets it, up to 11 m: the door whole, with its frame and the walls round it)
  const doorLook = door.clone().addScaledVector(n, 0.9).addScaledVector(UP, dh * 0.4);   // (in front of its slab: the lens's ray starts outside the shut door's block)
  const wayFrom = pastKeeper(doorLook, clearOf(rt, doorLook, inside(rt, door.clone().addScaledVector(n, 11).addScaledVector(UP, 2.3)), skip, 4), 4);
  const back = wayFrom.distanceTo(doorLook);
  const wayTo = pastKeeper(doorLook, clearOf(rt, doorLook, inside(rt, door.clone().addScaledVector(n, Math.max(4, back - 1.6)).addScaledVector(UP, 2.1)), skip, 3.5), 3.5);
  const shots = [
    { dur: F.keeper, from: keeper, ease: 'linear' },
    { dur: F.reward, from: { pos: rewardFrom, look: rewardLook, fov: 44 }, to: { pos: rewardTo, look: rewardLook, fov: 40 } },
    { dur: F.house, from: { pos: houseFrom, look: houseLook, fov: 58 }, to: { pos: houseTo, look: houseLook, fov: 56 } },
    { dur: F.way, from: { pos: wayFrom, look: doorLook, fov: 54 }, to: { pos: wayTo, look: doorLook, fov: 52 } },
  ];
  return { shots, way, at: { keeper: body, reward: purse, house: houseLook, way: door }, axis: n };
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
  const log = (rt.finaleLog = { id: rt.id, started: false, music: null, door: way?.id ?? null, opened: false, skipped: null, ended: false });
  const m = moments.play({
    id: `temple.${rt.id}.finale`, flag, shots,
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
      if (log.music && sound?.trackOn !== undefined) log.music.on = sound.trackOn;
    },
    onEnd: (mo, skipped) => {
      letGo(); log.opened = true;
      rt.litWant = 0;
      log.skipped = !!skipped; log.ended = true;
      if (typeof console !== 'undefined') console.info?.(`[temple finale] ${rt.id} ${skipped ? 'skipped' : 'watched'}; theme ${log.music?.track ? (log.music.on ? 'playing' : 'cued') : 'cued (no recording loaded)'}`);
    },
  });
  if (!m) { rt.finaleLog = null; return null; }
  rt.game?.emit?.('temple:finale', { id: rt.id });
  return m;
}
