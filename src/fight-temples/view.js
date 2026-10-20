// Reading the crowd from the fight temples' iso camera (issue #534; docs/systems/minigames.md "Fight temples"), pure so
// the tests can hold it:
//   - the framing: a hazard or a geyser winding up near him and off the frame (or at its edge) draws the view toward
//     it and back a little (frameIso), so he and the nearest telegraph are both on the screen (telegraphs: where each
//     one is while it warns)
//   - the traveller in a crowd: how much of him the foes' bodies hide from the camera (hiddenShare); hidden, an inked
//     ring is drawn round him on the HUD, over whatever covers him (the screen's 'self' part: self-mark.js, BridgeHud.cs)
//   - the lock's press: no lock in here (the aim takes the foe in its cone), so R3 / Tab answers with the aim's ring
//     flashed and the lock's own tick (LOCK_ANSWER; session.js)

import * as THREE from 'three';
import { ISO, isoOffset, screenUp, screenRight } from './rules.js';
import { HAZARD, lanePoint, laneLength } from './hazards.js';

/**
 * The framing: a telegraph within `reach` m of him (flat) is framed; its middle is kept inside `margin` of the screen
 * (NDC, 0..1 from the middle: room for a pool's own width round it) and he inside `keep`, the view drawn toward it and pulled back up to `zoom` times as far
 * (`step` a try); `ease`: how quickly the view goes there (1/s) and `back` comes back once it is over.
 */
export const FRAME = { reach: 15, margin: 0.62, keep: 0.5, zoom: 1.25, step: 0.03, ease: 3.5, back: 1.4 };

const _rel = new THREE.Vector3(), _fwd = new THREE.Vector3(), _rt = new THREE.Vector3(), _up = new THREE.Vector3(), _off = new THREE.Vector3();
/**
 * Where a point falls on the iso camera's screen (NDC, x right, y up, -1..1 at the edges): the camera at `look` +
 * isoOffset × `zoom`, looking at `look`, `aspect` wide. `out`: [x, y] (y null behind the camera).
 */
export function isoProject(p, look, zoom = 1, aspect = 16 / 9, I = ISO, out = [0, 0]) {
  isoOffset(I, _off).multiplyScalar(zoom);
  _fwd.copy(_off).negate().normalize();
  _rt.set(Math.cos(I.yaw), 0, -Math.sin(I.yaw));   // (screenRight: level, so the camera's right)
  _up.crossVectors(_rt, _fwd);
  _rel.set(p.x - look.x - _off.x, p.y - look.y - _off.y, p.z - look.z - _off.z);
  const d = _rel.dot(_fwd), t = Math.tan(THREE.MathUtils.degToRad(I.fov) / 2);
  if (d <= 1e-3) { out[0] = 0; out[1] = null; return out; }
  out[0] = _rel.dot(_rt) / (d * t * aspect); out[1] = _rel.dot(_up) / (d * t);
  return out;
}

const _a = [0, 0], _b = [0, 0], _look = new THREE.Vector3(), _sr = new THREE.Vector3(), _su = new THREE.Vector3();
/**
 * The view that frames him (`at`, his feet) and a telegraph (`to`, a point on the floor): { dx, dz, zoom } added to
 * the follow's look point and its distance. Nothing to frame (null, too far, already in): { 0, 0, 1 }. From the
 * nearest zoom up, the first view that keeps both inside their margins; none: the farthest, drawn toward it as far as
 * he may go (`keep`).
 */
export function frameIso(at, to, aspect = 16 / 9, I = ISO, F = FRAME) {
  const none = { dx: 0, dz: 0, zoom: 1 };
  if (!to || Math.hypot(to.x - at.x, to.z - at.z) > F.reach) return none;
  const lookY = at.y + I.look;
  const inside = (look, z) => {
    isoProject(at, look, z, aspect, I, _a); isoProject(to, look, z, aspect, I, _b);
    return _a[1] !== null && _b[1] !== null && Math.abs(_a[0]) <= F.keep && Math.abs(_a[1]) <= F.keep && Math.abs(_b[0]) <= F.margin && Math.abs(_b[1]) <= F.margin;
  };
  _look.set(at.x, lookY, at.z);
  if (inside(_look, 1)) return none;
  screenRight(I, _sr); screenUp(I, _su);
  const sinP = Math.sin(I.pitch), t = Math.tan(THREE.MathUtils.degToRad(I.fov) / 2);
  let best = null;
  for (let z = 1; z <= F.zoom + 1e-6; z += F.step) {
    // (the shift on the screen that brings the telegraph inside its margin and keeps him inside his, each axis; then
    // made metres on the floor at the look point's scale, and checked through the true projection)
    _look.set(at.x, lookY, at.z);
    isoProject(at, _look, z, aspect, I, _a); isoProject(to, _look, z, aspect, I, _b);
    if (_b[1] === null) continue;
    const s = [0, 1].map((k) => {
      const lo = Math.max(_b[k] - F.margin, _a[k] - F.keep), hi = Math.min(_b[k] + F.margin, _a[k] + F.keep);
      return lo > hi ? (_b[k] > _a[k] ? hi : lo) : lo > 0 ? lo : hi < 0 ? hi : 0;
    });
    const h = I.dist * z * t, mx = s[0] * h * aspect, mu = s[1] * h / sinP;
    best = { dx: _sr.x * mx + _su.x * mu, dz: _sr.z * mx + _su.z * mu, zoom: z };
    _look.set(at.x + best.dx, lookY, at.z + best.dz);
    if (inside(_look, z)) return best;
  }
  return best ?? none;
}

/**
 * The hazards and geysers warning now, as points on the floor: { x, y: 0, z, k (0..1 through the warning), kind }. A spot's
 * where it is; a toll's its sign; a millstone's or a cart's the lane's head (where it comes from); a lane's other
 * hazards the point of it nearest him; the room-wide ones (the dark, the shade) are everywhere and give none.
 * `hazards`: roomHazards().list; `rooms`: the run's; `geysers`: [{ at, t }] filling (GEYSER.warn s).
 */
export function telegraphs(hazards = [], rooms = [], at = null, geysers = [], geyserWarn = 1.25) {
  const out = [];
  for (const h of hazards) {
    const H = HAZARD[h.kind];
    if (!H || !(h.t < H.warn)) continue;
    const k = Math.max(0, h.t / H.warn), L = h.lane, room = rooms[h.ri];
    if (L?.spot) out.push({ x: L.spot[0], y: 0, z: L.spot[1], k, kind: h.kind });
    else if (L?.sign) out.push({ x: L.sign[0], y: 0, z: L.sign[1], k, kind: h.kind });
    else if (L?.along && room) {
      let s = 0;
      if (h.kind !== 'stone' && h.kind !== 'cart' && at) {
        const [hx, hz] = lanePoint(room, L, 0), v = L.along === 'x' ? at.x - hx : at.z - hz;
        s = Math.max(0, Math.min(laneLength(room, L), v * L.dir));
      }
      const [x, z] = lanePoint(room, L, s);
      out.push({ x, y: 0, z, k, kind: h.kind });
    }
  }
  for (const g of geysers) if (g.t < geyserWarn) out.push({ x: g.at.x, y: 0, z: g.at.z, k: g.t / geyserWarn, kind: 'geyser' });
  return out;
}
/** The telegraph nearest him (flat), or null. */
export function nearestTelegraph(list, at) {
  let best = null, d = Infinity;
  for (const p of list) { const e = Math.hypot(p.x - at.x, p.z - at.z); if (e < d) { d = e; best = p; } }
  return best;
}

/**
 * The traveller lost in his crowd: `points` his heights over his feet (m) the camera must see; hidden when at least
 * `share` of them are behind a foe's body (each foe a column of `balls` spheres up its height, its radius × `fat`), or
 * hemmed in when `many` foes' bodies stand within `crowd` m of him (their edges: from this high a few round him swallow
 * him as surely); `in` / `out` s for the ring to come and go. The ring: `size` × his height across, round his middle.
 */
export const SELF = { points: [0.35, 0.8, 1.25, 1.65], share: 0.5, balls: 3, fat: 0.95, crowd: 1.2, many: 3, in: 0.12, out: 0.35, size: 1.25 };

/** How many of the foes' bodies (their edges) stand within SELF.crowd m of him (flat). */
export function crowdAround(at, bodies, S = SELF) {
  let n = 0;
  for (const b of bodies) if (Math.hypot(b.pos.x - at.x, b.pos.z - at.z) - (b.radius ?? 0.5) < S.crowd) n++;
  return n;
}
/** Is he lost: hidden (hiddenShare) or hemmed in (crowdAround)? */
export const lostInCrowd = (share, around, S = SELF) => share >= S.share || around >= S.many;

const _seg = new THREE.Vector3(), _c = new THREE.Vector3(), _p = new THREE.Vector3(), _pt = new THREE.Vector3(), _ball = new THREE.Vector3();
/** Does the segment from `a` to `b` pass within `r` of `c` (before it reaches `b`)? */
export function segmentNearBall(a, b, c, r) {
  _seg.subVectors(b, a); const L2 = _seg.lengthSq();
  if (L2 < 1e-8) return false;
  const u = THREE.MathUtils.clamp(_c.subVectors(c, a).dot(_seg) / L2, 0, 1);
  if (u >= 1 - 1e-4) return false;   // (beyond him: behind, not over)
  return _p.copy(a).addScaledVector(_seg, u).distanceToSquared(c) < r * r;
}
/**
 * How much of him (0..1: the share of SELF.points) the foes' bodies hide from the camera at `cam`. `bodies`:
 * [{ pos, radius, height }] (the foes standing).
 */
export function hiddenShare(cam, at, bodies, S = SELF) {
  let hid = 0;
  const near = bodies.filter((b) => b.pos.distanceToSquared(at) < 100);
  for (const h of S.points) {
    _pt.set(at.x, at.y + h, at.z);
    if (near.some((b) => {
      const r = Math.max(0.2, (b.radius ?? 0.5) * S.fat), H = b.height ?? 1;
      for (let i = 0; i < S.balls; i++) { const y = b.pos.y + Math.max(r * 0.6, H * (i + 0.5) / S.balls); if (segmentNearBall(cam, _pt, _ball.set(b.pos.x, y, b.pos.z), r)) return true; }
      return false;
    })) hid++;
  }
  return hid / S.points.length;
}

/**
 * The lock's press answered (issue #534: it did nothing, silently): the aim's ring under the foe it takes flashes,
 * `grow` times its size shrinking back over `secs`; with none in the cone, a ring goes out round him the way he aims.
 * The first press of a run also says, once, that the right stick (or the mouse) aims in here.
 */
export const LOCK_ANSWER = { grow: 1.9, secs: 0.35, ring: 2.6, line: 'No lock-on in here: {key:look} aims' };   // ({key:look}: the right stick, the mouse: issue #559)
/** The flashed ring's scale `t` s after the press (1: its own size, once over). */
export const answerScale = (t, A = LOCK_ANSWER) => (t >= A.secs || t < 0 ? 1 : 1 + (A.grow - 1) * (1 - t / A.secs) ** 2);
