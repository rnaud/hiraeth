import * as THREE from 'three';

// The lock camera's framing of a guardian (issue #359, the author: "During guardian encounters when locked in I should be
// able to always see the guardian, myself in full body and the floor. Right now with the mother snapper I cut off after
// the torso"; docs/systems/movement-and-camera.md "Locked on a guardian: both of you framed"). Locked on a guardian, the
// camera's arm and its height are chosen from the two bounding boxes (the traveller's and the guardian's, and the floor
// between them) so all of it fits in the frame with a margin; and the view is turned to the middle of what it frames.
// Pure helpers, used by CameraRig.update (src/player.js) and the camera QC (scripts/camera-qc/sim-guardians.mjs).

/**
 * `margin` of the frame's half-size kept clear round what is framed; the camera's height over the look point tried in
 * `pitches` (rad, the lowest first), its arm from `arm[0]` to `arm[1]` m by `step`; an arm past `prefer` m is taken only
 * if no higher camera fits nearer; the solve redone every `every` s (the eased box between), the arm and the height
 * eased after it on a critically damped spring (`rate` /s; the arm coming in at `rateIn`, before the wall it turns
 * toward is behind it), the view turned after what it frames at `look` /s, the arm's root `lift` m higher (over the low
 * things round him: a plinth, a spout), a point beside the lens counted `side` rad off at most (frameAim); where no arm
 * the room allows fits it all, the lens widened up to `fov`° (eased at `fovRate` /s), the whole fit eased in and out at `in` /s; the room behind
 * read `around` the arm's way (rad) and where the lock's turn takes it `ahead` s on (at most `aheadMax` rad), kept `wall`
 * m short of what it meets; the traveller's box `body` m either way of
 * his axis and `height` tall, the guardian's body `round` of its box's half-width round its middle (framePoints); its
 * box kept within `box` × its model's size (guardianBox).
 */
export const LOCK_FRAME = { margin: 0.1, pitches: [0.24, 0.32, 0.4, 0.5, 0.62, 0.76], arm: [4.5, 16], step: 0.5, prefer: 11, every: 0.1, around: [-0.5, -0.25, 0, 0.25, 0.5], ahead: 0.7, aheadMax: 1.1, wall: 1, rate: 2.2, rateIn: 8, look: 8, lift: 0.6, side: 1.2, fov: 68, fovRate: 2, nearZ: 0.3, near: [2.4, 3.6], nearRate: 1.2, in: 1.8, body: 0.35, height: 1.8, round: 0.8, box: 4 };

/**
 * Locked on any other foe (issue #752, the author: "When locked on enemies I should see the whole enemy and myself and the
 * ground like Zelda botw"): the same fit, nearer and higher. BotW's targeting camera stands behind Link a little higher
 * than the free one, looking down onto the ground between the two, pulled back for a big foe and hardly at all for a
 * small one, its field of view kept; so a foe's fit starts at a steeper height (`pitches`: 0.3 rad, the free camera's
 * 0.16), its arm at most `arm[1]` m and preferably under `prefer`, the look point `lift` m up, and the lens widened by
 * at most `fov`°; only in the open (the close-in framing under `open[0]` to start, over `open[1]` to stop: CameraRig.update).
 * The guardians keep LOCK_FRAME (their arenas, their size). docs/systems/movement-and-camera.md
 * "Locked on any foe: the BotW framing".
 */
export const LOCK_FRAME_FOE = { ...LOCK_FRAME, pitches: [0.3, 0.36, 0.43, 0.52, 0.62, 0.2, 0.1], arm: [4.5, 10], prefer: 7, lift: 0.3, fov: 62, margin: 0.12, box: 2.5, corners: true, open: [0.1, 0.25], hold: 0.15, low: 0.75 };

const _v = new THREE.Vector3(), _r0 = new THREE.Vector3(), _f0 = new THREE.Vector3(), _rt = new THREE.Vector3(), _up = new THREE.Vector3(), _cam = new THREE.Vector3(), _dir = new THREE.Vector3();

/**
 * The points a guardian's framing keeps in view (into `out`, reused): the traveller's box (his feet at `feet`, `body` m
 * either way, `height` tall); the guardian's body as the round thing it is, not its box's corners (they stand out past
 * any body: a box framed corner to corner pushed the camera back for nothing): its box's middle `round` × its half-width
 * either side across the line from it to him, at its foot, its middle and its top, and its foot's near side; and the
 * floor halfway between you at his feet's height; and under a flyer, the ground at its footing (`box.ground`). Level
 * frames only.
 */
export function framePoints(feet, box, out = [], F = LOCK_FRAME) {
  let n = 0;
  const put = (x, y, z) => { (out[n] ??= new THREE.Vector3()).set(x, y, z); n++; };
  for (let k = 0; k < 8; k++) put(feet.x + (k & 1 ? F.body : -F.body), feet.y + (k & 2 ? F.height : 0), feet.z + (k & 4 ? F.body : -F.body));
  const cx = (box.min.x + box.max.x) / 2, cz = (box.min.z + box.max.z) / 2, R = F.round * Math.max(box.max.x - box.min.x, box.max.z - box.min.z) / 2;
  let tx = feet.x - cx, tz = feet.z - cz;
  const L = Math.hypot(tx, tz) || 1; tx /= L; tz /= L;
  // (a foe's box is near its body, LOCK_FRAME_FOE.corners: its eight corners, so the whole of its drawn body is framed)
  if (F.corners) for (let k = 0; k < 8; k++) put(k & 1 ? box.max.x : box.min.x, k & 2 ? box.max.y : box.min.y, k & 4 ? box.max.z : box.min.z);
  else {
    for (const y of [box.min.y, (box.min.y + box.max.y) / 2, box.max.y]) { put(cx - tz * R, y, cz + tx * R); put(cx + tz * R, y, cz - tx * R); }
    put(cx + tx * R, box.min.y, cz + tz * R);
  }
  put((feet.x + cx) / 2, feet.y, (feet.z + cz) / 2);
  // (a flyer: the ground under it as well, where its shadow falls: `box.ground`, its footing, foeBox)
  if (box.ground != null && box.min.y > box.ground + 0.3) put(cx, box.ground, cz);
  out.length = n;
  return out;
}

/**
 * Where a camera at `cam` looks to frame `pts`: the middle of their spread round it (across, about `U`, from the level
 * direction `ahead`; and up and down), and how full of them the frame is then (`fill`: the largest of |x| / tan(half
 * the fov across) and |y| / tan(half the fov up), 1 at the frame's edge). Too tall for the frame, the lowest points
 * are kept (his feet, the floor): the frame stands on them and its top is what is lost. `low` (0..1) sets what fits
 * that far down from the middle toward the frame's foot (a foe's framing, LOCK_FRAME_FOE.low: the two of you in its
 * lower part and the land and the sky over you, BotW's, not looking down at the sand). Writes the look into `dir`.
 */
export function frameAim(cam, pts, ahead, U, tanV, aspect, dir = new THREE.Vector3(), margin = LOCK_FRAME.margin, low = 0) {
  _f0.copy(ahead).addScaledVector(U, -ahead.dot(U)).normalize();
  _r0.crossVectors(_f0, U).normalize();
  let a0 = Infinity, a1 = -Infinity, e0 = Infinity, e1 = -Infinity;
  for (const p of pts) {
    _v.subVectors(p, cam);
    const x = _v.dot(_r0), z = _v.dot(_f0), y = _v.dot(U);
    // (a point well off to the side, beside the lens, counts as at most `side` rad off: it cannot be framed anyway)
    const a = THREE.MathUtils.clamp(Math.atan2(x, z), -LOCK_FRAME.side, LOCK_FRAME.side), e = Math.atan2(y, Math.hypot(x, z));
    a0 = Math.min(a0, a); a1 = Math.max(a1, a); e0 = Math.min(e0, e); e1 = Math.max(e1, e);
  }
  const half = Math.atan(tanV * (1 - margin)), tanH = tanV * aspect;
  let ac = (a0 + a1) / 2, ec = e1 - e0 > 2 * half ? e0 + half : THREE.MathUtils.lerp((e0 + e1) / 2, e0 + half, low);
  // (then twice more on the picture itself: a point off to the side lands lower on the screen than its angle says, so
  // centred by angles, his feet at a corner of the frame fell out of it)
  let fill = 0;
  for (let it = 0; it < 3; it++) {
    dir.copy(_f0).multiplyScalar(Math.cos(ac) * Math.cos(ec)).addScaledVector(_r0, Math.sin(ac) * Math.cos(ec)).addScaledVector(U, Math.sin(ec)).normalize();
    _rt.crossVectors(dir, U).normalize(); _up.crossVectors(_rt, dir);
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, behind = false;
    for (const p of pts) {
      _v.subVectors(p, cam);
      // (a point beside or behind the lens cannot be in the picture: it counts as `nearZ` m ahead, so the frame still
      // leans its way, and the look does not jump as a point comes round past the lens's side)
      let z = _v.dot(dir);
      if (z < LOCK_FRAME.nearZ) { behind = true; z = LOCK_FRAME.nearZ; }
      const x = _v.dot(_rt) / z, y = _v.dot(_up) / z;
      x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
    }
    if (!(x1 >= x0)) return { dir, fill: Infinity };
    fill = behind ? Infinity : Math.max(Math.abs(x0), Math.abs(x1), 0) / tanH;
    fill = Math.max(fill, Math.abs(y0) / tanV, Math.abs(y1) / tanV);
    if (it === 2) break;
    const room = tanV * (1 - margin), yc = y1 - y0 > 2 * room ? y0 + room : THREE.MathUtils.lerp((y0 + y1) / 2, y0 + room, low);
    ac += Math.atan((x0 + x1) / 2); ec += Math.atan(yc);
  }
  return { dir, fill };
}

/**
 * The arm and the camera's height that frame `pts` from the look point `look`, the camera behind it along the level
 * direction `back` (from the look point toward the camera): of LOCK_FRAME's heights the lowest whose nearest arm that
 * fits (at least `minArm`, at most `room[i]`, the room behind the look point at that height) is no longer than
 * `prefer`, else the one with the shortest such arm, else (nothing fits: a cramped room) the fullest view that is
 * least overfull. Returns { pitch, arm, fill }.
 */
export function solveFrame(look, back, U, pts, tanV, aspect, minArm, room, F = LOCK_FRAME) {
  let best = null, nearest = null, least = null;
  for (let i = 0; i < F.pitches.length; i++) {
    const p = F.pitches[i], top = Math.min(F.arm[1], room?.[i] ?? Infinity);
    _dir.copy(back).multiplyScalar(Math.cos(p)).addScaledVector(U, Math.sin(p));
    for (let d = Math.min(Math.max(minArm, F.arm[0]), top); d <= top + 1e-6; d += F.step) {
      _cam.copy(look).addScaledVector(_dir, d);
      const { fill } = frameAim(_cam, pts, _v.copy(_dir).negate(), U, tanV, aspect, undefined, F.margin, F.low ?? 0);
      if (fill <= 1 - F.margin) {
        if (d <= F.prefer && !best) best = { pitch: p, arm: d, fill };
        if (!nearest || d < nearest.arm - 1e-6) nearest = { pitch: p, arm: d, fill };
        break;
      }
      if (!least || fill < least.fill) least = { pitch: p, arm: d, fill };
      if (d + F.step > top + 1e-6 && d < top - 1e-6) d = top - F.step;   // (and the longest the room allows)
    }
    if (best) break;
  }
  return best ?? nearest ?? least ?? { pitch: F.pitches[0], arm: minArm, fill: Infinity };
}

/**
 * A guardian's box as the framing reads it: its model's bounds (Box3.setFromObject) measured every `every` s round
 * where its body is (`model.pos`), kept within LOCK_FRAME.box × its size of it (a long reach, a cast-off part), and
 * placed round `at` (the lock's steady stand-in: it moves smoothly), into `out` ({ min, max }).
 */
const _boxes = new WeakMap(), _b = new THREE.Box3();
export function guardianBox(model, at, out, now, every = 0.25, F = LOCK_FRAME) {
  let c = _boxes.get(model);
  if (!c || now - c.t > every || now < c.t) {
    c ??= { min: new THREE.Vector3(), max: new THREE.Vector3(), t: 0 };
    c.t = now;
    model.group.updateMatrixWorld?.(true);
    _b.setFromObject(model.group);
    const r = (model.radius ?? 3) * F.box / 2, h = (model.height ?? 4) * F.box / 2, p = model.pos;
    if (_b.isEmpty()) _b.set(_v.set(-r / 2, 0, -r / 2).add(p), _cam.set(r / 2, model.height ?? 4, r / 2).add(p));
    c.min.set(Math.max(_b.min.x - p.x, -r), Math.max(_b.min.y - p.y, -h), Math.max(_b.min.z - p.z, -r));
    c.max.set(Math.min(_b.max.x - p.x, r), Math.min(_b.max.y - p.y, h), Math.min(_b.max.z - p.z, r));
    _boxes.set(model, c);
  }
  out.min.copy(at).add(c.min); out.max.copy(at).add(c.max);
  out.ground = null; out.F = F;
  return out;
}

/**
 * Any other foe's box as the framing reads it (issue #752): its drawn body's bounds (src/foe-body.js bodySpan: its parts as
 * posed, not the trails and drops round it), measured every `every` s round its footing (`f.pos`), kept within
 * LOCK_FRAME_FOE.box × its radius and height of it (grown at once, shrunk by `hold` of the way a measure), placed round `at` (the lock's own point: f.pos), and its footing as
 * `ground` (a flyer's shadow: framePoints). `span` the body's measure (bodySpan, passed in: node's tests give their own).
 * Into `out` ({ min, max, ground, F }).
 */
const _foeBoxes = new WeakMap(), _bmin = new THREE.Vector3(), _bmax = new THREE.Vector3();
export function foeBox(f, at, out, now, span, every = 0.25, F = LOCK_FRAME_FOE) {
  const m = f.model;
  let c = m ? _foeBoxes.get(m) : null;
  if (!c || now - c.t > every || now < c.t) {
    c ??= { min: new THREE.Vector3(), max: new THREE.Vector3(), t: 0 };
    c.t = now;
    const r = Math.max(0.4, f.def?.radius ?? 0.6), h = Math.max(0.5, (f.chest?.y ?? f.pos.y + 1) - f.pos.y + r);
    let b = null;
    if (m?.group && span) { try { m.group.updateMatrixWorld?.(true); b = span(m)._box; } catch { b = null; } }
    if (!b || b.isEmpty()) { c.min.set(-r, 0, -r); c.max.set(r, h, r); }
    else {
      const R = r * F.box + 0.5, H = h * F.box + 0.5, p = f.pos;
      _bmin.set(Math.max(b.min.x - p.x, -R), Math.max(b.min.y - p.y, -0.5), Math.max(b.min.z - p.z, -R));
      _bmax.set(Math.min(b.max.x - p.x, R), Math.min(b.max.y - p.y, H), Math.min(b.max.z - p.z, R));
      // (grown at once, shrunk slowly, `hold` of the way each measure: a club swung up over its head between two
      // measures, or a wing beat, stays in the box, and the camera doesn't breathe in and out with every swing)
      if (!c.set) { c.min.copy(_bmin); c.max.copy(_bmax); c.set = true; }
      else {
        c.min.min(_bmin).lerp(_bmin, F.hold); c.max.max(_bmax).lerp(_bmax, F.hold);
        c.min.min(_bmin); c.max.max(_bmax);
      }
    }
    if (m) _foeBoxes.set(m, c);
  }
  out.min.copy(at).add(c.min); out.max.copy(at).add(c.max);
  out.ground = at.y; out.F = F;
  return out;
}
