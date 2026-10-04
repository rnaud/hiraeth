import * as THREE from 'three';

// Where the camera stands during a conversation, so that nothing is in the way.
//
//   pickTwoShot({ a, b, faceA, faceB, up, aspect, from, sight, people })   talking to someone
//   pickLookShot({ a, head, target, up, aspect, from, sight, people })      looking at a thing
//
// Both try a fan of candidate eyes (sides, angles round the pair, distances,
// heights; over the shoulder as the last resort) and score each one: a wall,
// a tree, a rock or the ground between a face and the eye costs a lot, a
// bystander in the line of sight costs a little less, an eye pressed against
// geometry costs too, and every step away from the ideal framing costs a bit.
// The cheapest wins: { eye, look, cost, kind }.
//
// `sight` is what the level offers (see sightOf): ray(from, to) → the free
// length along the segment, room(p, r) → whether a ball of radius r fits.
// `people` are bystanders' feet positions (capsules 0.4 m wide, 1.9 m tall).

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _d = new THREE.Vector3();
const _s1 = new THREE.Vector3(), _s2 = new THREE.Vector3(), _lo = new THREE.Vector3(), _hi = new THREE.Vector3();
const UPY = new THREE.Vector3(0, 1, 0);

/** The level's line of sight: the collision BVH plus the heightfield (dunes). */
export function sightOf(physics) {
  const base = physics?.base ?? null;
  const dir = new THREE.Vector3(), probe = new THREE.Vector3(), push = new THREE.Vector3();
  return {
    /** Free length from `from` toward `to` (the full length when nothing is in the way). */
    ray(from, to) {
      dir.subVectors(to, from);
      const len = dir.length();
      if (len < 1e-4) return 0;
      dir.divideScalar(len);
      let d = physics?.rayDistance ? physics.rayDistance(from, dir, len) : Infinity;
      if (base) {
        // the terrain is not in the BVH: walk the segment against it
        const n = Math.min(24, Math.ceil(len / 0.6));
        for (let i = 1; i <= n; i++) {
          const t = (i / n) * len;
          if (t >= d) break;
          probe.copy(from).addScaledVector(dir, t);
          if (probe.y < base.heightAt(probe.x, probe.z) + 0.15) { d = Math.max(0, t - len / n); break; }
        }
      }
      return Math.min(d, len);
    },
    /** Does a ball of radius r fit at p (not pressed into a wall, not under the ground)? */
    room(p, r = 0.3) {
      if (base && p.y < base.heightAt(p.x, p.z) + r) return false;
      if (!physics?.pushCapsule) return true;
      probe.copy(p);
      const out = physics.pushCapsule(probe, r, -r, r, push);
      return !out || out.length() < r * 0.35;
    },
  };
}

/** Closest distance between segments p1-q1 and p2-q2. */
function segDist(p1, q1, p2, q2) {
  const d1 = _a.subVectors(q1, p1), d2 = _b.subVectors(q2, p2), r = _c.subVectors(p1, p2);
  const A = d1.dot(d1), E = d2.dot(d2), F = d2.dot(r);
  let s, t;
  if (A < 1e-9 && E < 1e-9) return r.length();
  if (A < 1e-9) { s = 0; t = THREE.MathUtils.clamp(F / E, 0, 1); }
  else {
    const C = d1.dot(r);
    if (E < 1e-9) { t = 0; s = THREE.MathUtils.clamp(-C / A, 0, 1); }
    else {
      const B = d1.dot(d2), den = A * E - B * B;
      s = den > 1e-9 ? THREE.MathUtils.clamp((B * F - C * E) / den, 0, 1) : 0;
      t = (B * s + F) / E;
      if (t < 0) { t = 0; s = THREE.MathUtils.clamp(-C / A, 0, 1); }
      else if (t > 1) { t = 1; s = THREE.MathUtils.clamp((B - C) / A, 0, 1); }
    }
  }
  _s1.copy(p1).addScaledVector(d1, s);
  _s2.copy(p2).addScaledVector(d2, t);
  return _s1.distanceTo(_s2);
}

/** How much a line of sight (from → to) passes through bystanders. */
function crowdOn(from, to, people, up) {
  let n = 0;
  for (const p of people) {
    const d = segDist(from, to, _lo.copy(p).addScaledVector(up, 0.25), _hi.copy(p).addScaledVector(up, 1.85));
    if (d < 0.5) n += 1 - d / 0.5 + 0.5;
  }
  return n;
}

/**
 * Score one eye: what stands between it and the things that must be seen.
 * `sees` are [point, margin, bodies]: the line from the eye to the point must be
 * free (the margin is how much may be missing at the point's end: the object
 * itself), and must not pass through the bodies (feet positions) of the people
 * in the shot (the traveller's back hiding the other's face, or the thing).
 */
function score(eye, sees, { sight, people, up }) {
  let cost = 0, blocked = 0;
  const why = [];
  for (const [p, margin = 0.15, bodies = null, reach = null, heads = null] of sees) {
    const len = p.distanceTo(eye);
    const free = sight ? sight.ray(eye, p) : len;
    // (`reach`: only this far from the eye must be clear; beyond it is the thing's own side)
    const need = Math.min(len - margin, typeof reach === 'function' ? reach(eye) : reach ?? Infinity);
    if (free < need) { blocked++; cost += 6 + 8 * (1 - free / need); }
    if (people?.length) cost += 2.5 * crowdOn(eye, p, people, up);
    let hidden = 0;
    if (bodies) for (const f of bodies) {
      const d = segDist(eye, p, _lo.copy(f).addScaledVector(up, 0.3), _hi.copy(f).addScaledVector(up, 1.78));
      if (d < 0.5) hidden += 3.5 + 5 * (1 - d / 0.5);
    }
    // a head in the foreground (over the shoulder): the line passes beside it, not through it
    if (heads) for (const h of heads) {
      const d = segDist(eye, p, h, h);
      if (d < 0.45) hidden += 3.5 + 5 * (1 - d / 0.45);   // (the helmet bubble is big)
    }
    cost += hidden;
    why.push([+free.toFixed(2), +len.toFixed(2), +hidden.toFixed(2)]);
  }
  const room = !sight || sight.room(eye, 0.28);
  if (!room) cost += 4;
  return { cost, blocked, why, room };
}

/** The eye pulled in toward `from` until the line is clear (the last resort for a blocked shot). */
export function pullIn(eye, from, sight, keep = 0.3) {
  if (!sight) return eye;
  const len = from.distanceTo(eye);
  const free = sight.ray(from, eye);
  if (free >= len - 0.05) return eye;
  return eye.lerpVectors(from, eye, Math.max(0, free - keep) / len);
}

const portraitPull = (aspect) => THREE.MathUtils.clamp(1.25 / (aspect || 1.6), 1, 2.3);

/**
 * Talking to someone: both faces in frame, the camera off to the side of the
 * line between them, a little behind the traveller's shoulder.
 * @param a, b         the traveller's and the other's feet
 * @param faceA, faceB their faces (default: 1.55 m over the feet)
 * @param from         where the camera is now (prefers that side)
 * @param prefer       { side, i } a previous pick, kept unless clearly worse
 */
export function pickTwoShot({ a, b, faceA = null, faceB = null, up = UPY, aspect = 1.6, from = null, sight = null, people = [], prefer = null }) {
  const fa = faceA ?? a.clone().addScaledVector(up, 1.55), fb = faceB ?? b.clone().addScaledVector(up, 1.55);
  const mid = a.clone().lerp(b, 0.5).addScaledVector(up, 1.45);
  const across = new THREE.Vector3().subVectors(b, a); across.addScaledVector(up, -across.dot(up));
  const sep = Math.max(across.length(), 0.8);
  if (across.lengthSq() < 1e-6) across.set(1, 0, 0);
  across.normalize();
  const side = new THREE.Vector3().crossVectors(up, across).normalize();
  const dist = (2.0 + sep * 1.0) * portraitPull(aspect);
  const phi0 = Math.atan2(sep * 0.3, dist);
  const here = from && side.dot(_d.subVectors(from, mid)) < 0 ? -1 : 1;
  const look = () => mid.clone().addScaledVector(across, 0.06 * sep).addScaledVector(up, -0.75);
  const cands = [];
  // the two-shot round both sides: angles toward the traveller's back (phi > 0) or the other's
  for (const s of [here, -here]) {
    for (const [phi, pc] of [[phi0, 0], [phi0 + 0.35, 0.5], [phi0 - 0.3, 0.7], [phi0 + 0.7, 1.1], [phi0 + 1.0, 1.8]]) {
      for (const [k, kc] of [[1, 0], [0.75, 0.6], [0.55, 1.3]]) {
        for (const [h, hc] of [[0.4, 0], [1.1, 0.5], [0.05, 0.6]]) {
          const dir = _a.copy(side).multiplyScalar(s * Math.cos(phi)).addScaledVector(across, -Math.sin(phi));
          const eye = mid.clone().addScaledVector(dir, dist * k).addScaledVector(up, h * Math.min(1, k + 0.2));
          cands.push({ eye, look: look(), pref: pc + kc + hc + (s === here ? 0 : 0.3), kind: 'two', side: s });
        }
      }
    }
  }
  // over the traveller's shoulder, then over theirs: close, nothing can come between
  // (looking past the near one's head, which must not hide the far one's face)
  for (const s of [here, -here]) {
    for (const [w, h, wc] of [[0.55, 0.2, 0], [0.8, 0.15, 0.3], [0.45, 0.55, 0.5]]) {
      const ots = fa.clone().addScaledVector(across, -1.15).addScaledVector(side, s * w).addScaledVector(up, h);
      cands.push({ eye: ots, look: fb.clone().addScaledVector(up, -0.35), pref: 4 + wc, kind: 'shoulder', side: s, near: fa, far: fb });
      const rev = fb.clone().addScaledVector(across, 1.15).addScaledVector(side, s * w).addScaledVector(up, h);
      cands.push({ eye: rev, look: fa.clone().addScaledVector(up, -0.35), pref: 5 + wc, kind: 'shoulder', side: s, near: fb, far: fa });
    }
  }
  return best(cands, (c) => (c.kind === 'two' ? [[fa, 0.15, [b]], [fb, 0.15, [a]], [mid]] : [[c.far, 0.15, null, null, [c.near]], [c.near, 0.5]]), { sight, people, up, prefer }, mid);
}

/**
 * Looking at a thing: the camera behind the traveller's shoulder, looking
 * past them at it.
 * @param a       the traveller's feet;  head: their head
 * @param target  what they look at
 */
export function pickLookShot({ a, head = null, target, up = UPY, aspect = 1.6, fov = 50, from = null, sight = null, people = [], prefer = null, facing = null }) {
  const hd = head ?? a.clone().addScaledVector(up, 1.6);
  const fwd = new THREE.Vector3().subVectors(target, a); fwd.addScaledVector(up, -fwd.dot(up));
  if (fwd.lengthSq() < 0.04) {
    // right overhead or underfoot: whichever way they face
    if (facing) fwd.copy(facing); else fwd.set(up.y > 0.9 ? 0 : 1, 0, up.y > 0.9 ? 1 : 0);
    fwd.addScaledVector(up, -fwd.dot(up));
  }
  fwd.normalize();
  const right = new THREE.Vector3().crossVectors(fwd, up).normalize();
  const here = from && right.dot(_d.subVectors(from, hd)) < 0 ? -1 : 1;
  const pull = Math.min(portraitPull(aspect), 1.5);
  const far = target.distanceTo(hd), big = far > 7;   // (a giant thing far off: stand further back, wider of the shoulder)
  const cands = [];
  for (const s of [here, -here]) {
    for (const [back, bc] of big ? [[2.4, 0], [1.8, 0.4], [3.2, 0.5], [1.3, 0.9]] : [[1.7, 0], [1.3, 0.5], [0.95, 1.1], [2.3, 0.6]]) {
      for (const [sh, shc] of big ? [[0.8, 0], [0.55, 0.3], [1.1, 0.3]] : [[0.6, 0], [0.42, 0.3], [0.85, 0.4]]) {
        for (const [h, hc] of [[0.3, 0], [0.6, 0.4], [0.05, 0.5]]) {
          const eye = hd.clone().addScaledVector(fwd, -back * pull).addScaledVector(right, s * sh).addScaledVector(up, h);
          cands.push({ eye, pref: bc + shc + hc + (s === here ? 0 : 0.25), kind: 'look', side: s });
        }
      }
    }
    // from beside them (in a corridor, or with their back to a wall)
    for (const [w, wc] of [[1.3, 2.5], [0.8, 3.2]]) {
      const eye = hd.clone().addScaledVector(right, s * w).addScaledVector(fwd, -0.35).addScaledVector(up, 0.25);
      cands.push({ eye, pref: wc, kind: 'beside', side: s });
    }
  }
  const vfov = THREE.MathUtils.degToRad(fov || 50);
  for (const c of cands) {
    // the thing a little above the middle of the frame, clear of the panel...
    const toT = new THREE.Vector3().subVectors(target, c.eye), dist = toT.length();
    const dir = toT.divideScalar(dist).clone();
    const down = _a.copy(up).negate().addScaledVector(dir, up.dot(dir)), dl = down.length();
    if (dl > 1e-3) dir.multiplyScalar(Math.cos(0.1)).addScaledVector(down, Math.sin(0.1) / dl);
    // ...and the traveller still in it when the thing is high above (or far below) them:
    // turned toward their head until it is no more than 0.3 of the view from the middle
    const toH = _b.subVectors(hd, c.eye).normalize(), th = Math.acos(THREE.MathUtils.clamp(dir.dot(toH), -1, 1));
    const turn = Math.min(th - 0.3 * vfov, 0.42 * vfov - 0.1);
    if (turn > 0) {
      const w = _c.copy(toH).addScaledVector(dir, -dir.dot(toH)), wl = w.length();
      if (wl > 1e-3) dir.multiplyScalar(Math.cos(turn)).addScaledVector(w, Math.sin(turn) / wl).normalize();
    }
    c.look = c.eye.clone().addScaledVector(dir, dist);
  }
  // the thing itself may stop the ray short of its centre (a statue, a box): a third of the way of grace
  const margin = Math.max(0.6, far * 0.35);
  // and whatever stands past the traveller is on the thing's side (its plinth, the rest of a
  // giant hand): only the line from the camera to just past them has to be clear
  const reach = (eye) => eye.distanceTo(hd) + 0.3;
  return best(cands, () => [[hd], [target, margin, [a], reach]], { sight, people, up, prefer }, hd);
}

function best(cands, seesOf, o, anchor) {
  let pick = null;
  for (const c of cands) {
    const r = score(c.eye, seesOf(c), o);
    c.cost = r.cost + c.pref;
    c.blocked = r.blocked;
    c.why = r.why; c.room = r.room;
    if (o.prefer && c.kind === o.prefer.kind && c.side === o.prefer.side && c.eye.distanceTo(o.prefer.eye) < 0.6) c.cost -= 1.2;   // (no cutting for a hair)
    if (!pick || c.cost < pick.cost) pick = c;
  }
  // nothing clear anywhere: the least blocked, pulled in to where the line is free
  pick.anchor = pick.near ?? anchor;   // (a line the pick was scored on: the camera is pulled in along it, never through a wall)
  if (pick.blocked) pullIn(pick.eye, pick.anchor, o.sight);
  pick.all = cands;   // (for the dev tools: what else was tried, and why not)
  return pick;
}
