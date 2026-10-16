import * as THREE from 'three';
import { doorOf } from './thresholds.js';

// Walked through a doorway (issue #389, the author: "when I walk through a door the character hits a wall before
// teleporting me to the other place. we should have an animation where the character keeps walking in"). A way through
// (a level's `portals`, src/passage.js) took you at its edge and then left you walking on your own for the light's lead
// and the paper's sweep (0.44 s): into the back of a shop's recess, a temple's closed hall door or a passage's end, where
// you stood against the wall (or started climbing it) until the paper covered the screen. Now the door takes you:
//
//   1. in: the controls are taken, the traveller walks on through the doorway at the pace he had (a stroll at the least,
//      a sprint at a sprint), steered onto the door's middle line so the frame never catches him; the light and the paper
//      are timed to the room ahead (a sprint into a shallow doorway hurries the paper and eases the pace to fit), so the
//      move always happens before he could touch what is beyond, and he is eased to a halt short of it should the move
//      wait (the far side still being drawn);
//   2. across: the passage's move carries him mid-stride (carryAcross), the paper on the screen;
//   3. out: on the far side, just inside, he walks two or three steps in off the door while the paper sweeps away and
//      the camera eases round behind him; then the controls are back. Moving the stick another way, or any button,
//      gives them back at once; nothing ahead (a wall close in front) and he simply stands there with them.
//
// It never keeps them: knocked down, dead, mounted, climbing, swimming, or DOOR_WALK.longest after it began, it lets go.
// A door that won't take you (`when`) says why and is never walked into (main.js; the passage does not start).
//
//   const walk = new DoorWalk({ player, physics, rig })                         main.js / engine/game.js, once
//   const { lead, cover } = walk.enter(portal, { lead, cover })                 a way through walked into
//   passage.go({ ..., lead, cover, onMove: () => walk.arrive() })
//   player.update(dt, walk.input(ctl, dt, camYaw), camYaw)                      each frame, before he moves

export const DOOR_WALK = {
  pace: [2.4, 8.2],     // m/s: the walk in at the pace you had: a stroll at the least, a sprint at a sprint (player.js RUN)
  shortest: 0.24,       // s: the light and the paper at their quickest before the move (a sprint into a shallow doorway)
  keep: 0.75,           // of his pace at the least through a doorway too shallow for it (the rest of it walked into its back, unseen)
  body: 0.45,           // m: the traveller's radius (src/player.js CAPSULE)
  clear: 0.12,          // m: kept between him and whatever is ahead
  heights: [0.75, 1.3, 1.9],   // m over his feet: the rays that look ahead (over a step's height, under his head's)
  look: 5,              // m: how far
  timing: 0.47,         // s: the light's lead and the paper's sweep (src/thresholds.js THRESHOLD.lead, src/passage.js PASSAGE.cover), a frame or three
  centre: 2.2,          // 1/s per m off it: how firmly the walk steers onto the door's middle line
  arrive: 0.5,          // s: the steps in off the door on the far side
  arrivePace: [2.6, 4.6],   // m/s: those steps (a sprint comes in at a run)
  camera: 5,            // 1/s: the camera easing round behind him on the far side
  skip: 0.9,            // rad: a stick turned this far off the walk (or a button) gives the controls back at once
  longest: 2.5,         // s: whatever happens, the controls are back by then
};

const Y = new THREE.Vector3(0, 1, 0);
const MOVE_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ShiftLeft', 'ShiftRight', 'stick']);
const NONE = Object.freeze({});
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _d = new THREE.Vector3(), _e = new THREE.Vector3(), _o = new THREE.Vector3(), _p = new THREE.Vector3();

/** The buttons held now (truthy, not the stick and the move keys). */
function buttons(ctl) {
  const out = new Set();
  for (const k in ctl ?? {}) if (ctl[k] === true && !MOVE_KEYS.has(k)) out.add(k);
  return out;
}

/** Where the stick (or the keys) asks to go, in the world, against the camera's yaw (src/player.js update); null when nothing. */
export function wantedDir(ctl, camYaw, frame, out = new THREE.Vector3()) {
  let f = (ctl.KeyW || ctl.ArrowUp ? 1 : 0) - (ctl.KeyS || ctl.ArrowDown ? 1 : 0);
  let s = (ctl.KeyD || ctl.ArrowRight ? 1 : 0) - (ctl.KeyA || ctl.ArrowLeft ? 1 : 0);
  if (ctl.stick && (ctl.stick.x || ctl.stick.y)) { f = ctl.stick.y; s = ctl.stick.x; }
  if (Math.hypot(f, s) < 0.3) return null;
  const R = frame?.right ?? _a.set(1, 0, 0), F = frame?.fwd ?? _b.set(0, 0, 1);
  out.set(0, 0, 0).addScaledVector(R, -Math.sin(camYaw) * f + Math.cos(camYaw) * s).addScaledVector(F, -Math.cos(camYaw) * f - Math.sin(camYaw) * s);
  return out.lengthSq() > 1e-6 ? out.normalize() : null;
}

export class DoorWalk {
  /** @param o.rig the camera rig (its yaw eased round behind on the far side), or null */
  constructor({ player, physics = null, rig = null } = {}) {
    Object.assign(this, { player, physics, rig });
    this.phase = null;     // null | 'enter' | 'arrive'
    this.t = 0; this.total = 0;
    this.walks = 0;        // (how many: tests, the dev panel)
  }

  get active() { return !!this.phase; }

  /** He can be walked through now: on his feet on the ground, nothing else holding him. */
  canWalk() {
    const P = this.player;
    return !!P && P.onGround && !P.climbing && !P.swim && !P.riding && !P.ride && !P.gliding && !P.jetFlight && !P.down && !P.dead && !P.mantle && !P.boarding;
  }

  /**
   * Metres he can walk along `dir` before he would touch anything (Infinity: nothing within `far`): rays from his knees,
   * chest and head, less his body's radius. Going into a door (`door`), what is round its opening is not in the way: a
   * hit over its lintel (the wall over a sunken door, seen from the top of its steps) or on its floor is left out; what
   * stands in the opening (a door shut behind a way out) and what lies beyond it count.
   */
  room(dir, far = DOOR_WALK.look, door = null) {
    const P = this.player, ph = this.physics, C = DOOR_WALK;
    if (!ph?.rayDistance) return Infinity;
    const U = P.frame?.up ?? Y;
    let best = Infinity;
    for (const h of C.heights) {
      _p.copy(P.pos).addScaledVector(U, h);
      const d = ph.rayDistance(_p, dir, far + C.body + C.clear);
      if (!Number.isFinite(d)) continue;
      if (door) {
        const y = _p.addScaledVector(dir, d).sub(door.at).dot(U);
        if (y > (door.h ?? 3) - 0.1 || y < 0.3) continue;
      }
      best = Math.min(best, d);
    }
    return best - C.body - C.clear;
  }

  /**
   * How near a way through takes him: its own radius, or sooner, going into it, when what is beyond its opening is too
   * close to walk on at his pace for the light and the paper (a shop's shallow recess, a lift's booth, a sprint into a
   * temple's door): then at once, so he keeps his pace through it. Only square in its opening (not along the wall
   * beside it) and on the near side of it.
   */
  reach(portal, timing = DOOR_WALK.timing) {
    const P = this.player, r = portal.r ?? 1.2;
    if (!portal.at || !this.canWalk()) return r;
    const U = P.frame?.up ?? Y;
    const hv = _a.copy(P.vel).addScaledVector(U, -P.vel.dot(U)), hs = hv.length();
    if (hs < 0.5) return r;
    const need = Math.max(hs, DOOR_WALK.pace[0]) * timing;
    const to = _b.subVectors(portal.at, P.pos).addScaledVector(U, -_b.dot(U));
    const d = to.length();
    if (d > r + need || d < 1e-3 || to.dot(hv) < 0.8 * d * hs) return r;   // (too far yet, or not going into it)
    const door = this.doorOf(portal);
    const dir = _c.copy(hv).multiplyScalar(1 / hs);
    if (door) {
      const n = _d.set(Math.sin(door.yaw), 0, Math.cos(door.yaw));
      const side = _o.subVectors(P.pos, door.at).dot(n);
      if (Math.abs(side) < 0.05 || Math.sign(side) === Math.sign(_o.subVectors(portal.at, door.at).dot(n))) return r;   // (on its far side or in it: its own radius)
      const across = _o.crossVectors(U, n).normalize();
      if (Math.abs(_e.subVectors(P.pos, door.at).dot(across)) > Math.max(0.3, door.w / 2 - DOOR_WALK.body)) return r;   // (beside it: a wall, not a door)
      dir.copy(n).multiplyScalar(-Math.sign(side));
    }
    return this.room(dir, need + 0.5, door) < need ? Infinity : r;
  }

  /** Where a portal's opening is (src/thresholds.js: its light's, else measured once), or null in the open. */
  doorOf(portal) {
    const door = portal?._threshold?.door ?? (portal ? (portal._walkDoor ??= doorOf(portal, this.physics)) : null);
    return door && !door.column && door.yaw != null ? door : null;
  }

  /**
   * A way through walked into: take the controls and walk him on through it. `lead` and `cover` (s) are the passage's
   * light and paper; returned as they must be for the room ahead. Not on his feet (in the air, swimming): the old way,
   * the controls his, the timings as they were.
   */
  enter(portal, { lead = 0, cover = 0.22 } = {}) {
    const P = this.player, C = DOOR_WALK;
    this.end();
    if (!this.canWalk()) return { lead, cover, walked: false };
    const U = P.frame?.up ?? Y;
    const hv = _a.copy(P.vel).addScaledVector(U, -P.vel.dot(U));
    const hs = hv.length();
    const door = this.doorOf(portal);
    const dir = new THREE.Vector3();
    if (door) {
      // across the door: from the side he is on to the other (on its line: the way he is going, or into the way's point)
      const n = _b.set(Math.sin(door.yaw), 0, Math.cos(door.yaw));
      const side = _o.subVectors(P.pos, door.at).dot(n);
      let sg = Math.abs(side) > 0.2 ? -Math.sign(side) : Math.sign(hv.dot(n) || _o.subVectors(portal.at, door.at).dot(n) || 1);
      dir.copy(n).multiplyScalar(sg);
    } else if (hs > 0.3) dir.copy(hv).normalize();
    else if (portal?.at) dir.subVectors(portal.at, P.pos).addScaledVector(U, -_o.subVectors(portal.at, P.pos).dot(U));
    if (dir.lengthSq() < 1e-6) P.frame?.dir ? P.frame.dir(P.heading, dir) : dir.set(Math.sin(P.heading), 0, Math.cos(P.heading));
    dir.addScaledVector(U, -dir.dot(U)).normalize();
    let pace = THREE.MathUtils.clamp(hs, C.pace[0], C.pace[1]);
    // the light and the paper fitted to the room ahead: never long enough at his pace to reach what is beyond
    const room = Math.max(0, this.room(dir, DOOR_WALK.look, door));
    const frame = 1 / 60, slack = 3 * frame;   // (the passage moves a frame after the sheet arrives, and each of its phases starts on a frame)
    let T = lead + cover + slack;
    if (pace * T > room) {
      const want = Math.max(C.shortest, room / pace);
      if (want < T) {
        let cut = T - want;
        const fromLead = Math.min(lead, cut); lead -= fromLead; cut -= fromLead;
        cover = Math.max(cover - cut, C.shortest - frame);
        T = lead + cover + slack;
      }
      // (no slower than most of his pace: what is left is met under the paper, walked into rather than pushed out of)
      pace = Math.max(Math.min(pace, room / T), C.keep * pace);
    }
    const through = pace * T > room + C.clear;
    this.phase = 'enter';
    this.t = 0; this.total = 0; this.T = T;
    this.door = door;
    this.dir = dir; this.pace = pace; this.pace0 = Math.max(hs, C.pace[0]);
    this.held = null;
    this.walks++;
    P.doorWalk = { dir: dir.clone(), pace, through };
    return { lead, cover, walked: true, through };
  }

  /**
   * Each frame before the traveller moves: the input he gets. Walked: none of the stick's (he goes where the door
   * takes him; his own `doorWalk` says the way and the pace); on the far side the stick is read for a skip.
   */
  input(ctl, dt, camYaw = 0) {
    if (!this.phase) return ctl;
    const P = this.player, C = DOOR_WALK, D = P.doorWalk;
    this.t += dt; this.total += dt;
    if (!D || P.dead || P.down || P.riding || P.ride || P.climbing || P.swim || P.mantle || this.total > C.longest) { this.end(); return ctl; }
    const U = P.frame?.up ?? Y;
    if (this.phase === 'enter') {
      // onto the door's middle line (the frame never catches a shoulder)
      D.dir.copy(this.dir);
      if (this.door) {
        const across = _b.crossVectors(U, this.dir).normalize();
        const off = _o.subVectors(P.pos, this.door.at).dot(across);
        D.dir.addScaledVector(across, THREE.MathUtils.clamp(-off * C.centre, -0.6, 0.6)).normalize();
      }
      // (his pace to the move, fitted to the room beyond the door as he came into it; past it, the far side still being
      // drawn, a halt in a few frames behind the paper)
      D.pace = this.t < this.T ? this.pace : this.pace * Math.max(0, 1 - (this.t - this.T) * 8);
      this.hold(D.pace);
      if (!this.held) this.held = buttons(ctl);
      return NONE;
    }
    // the far side: a few steps in off the door, the camera round behind; any other wish of the stick's ends it
    const want = wantedDir(ctl, camYaw, P.frame, _a);
    const pressed = [...buttons(ctl)].some((k) => !this.held?.has(k));
    if (pressed || (want && want.angleTo(this.dir) > C.skip)) { this.end(); return ctl; }
    this.held = new Set([...(this.held ?? [])].filter((k) => ctl[k]));   // (a button let go and pressed again is a press)
    const room = Math.max(0, this.room(this.dir));
    if (this.t >= C.arrive || room < 0.05) { this.end(); return ctl; }
    D.dir.copy(this.dir);
    D.pace = Math.min(this.pace, room / Math.max(C.arrive - this.t, 0.15));
    this.hold(D.pace);
    if (this.rig) {
      const behind = (P.frame?.headingOf ? P.frame.headingOf(this.dir) : Math.atan2(this.dir.x, this.dir.z)) + Math.PI;
      this.rig.yaw += wrap(behind - this.rig.yaw) * (1 - Math.exp(-C.camera * dt));
    }
    return NONE;
  }

  /** His speed over the ground no more than `pace` (the spring of his steering is slower than a door's stop). */
  hold(pace) {
    const P = this.player, U = P.frame?.up ?? Y;
    const vu = P.vel.dot(U), hv = _o.copy(P.vel).addScaledVector(U, -vu), hs = hv.length();
    if (hs > pace && hs > 1e-6) P.vel.copy(hv.multiplyScalar(pace / hs)).addScaledVector(U, vu);
  }

  /** At the move (the passage's onMove): on the far side, facing in, the steps in off the door. */
  arrive() {
    if (this.phase !== 'enter') return;
    const P = this.player, C = DOOR_WALK, U = P.frame?.up ?? Y;
    const dir = P.frame?.dir ? P.frame.dir(P.heading, new THREE.Vector3()) : new THREE.Vector3(Math.sin(P.heading), 0, Math.cos(P.heading));
    dir.addScaledVector(U, -dir.dot(U)).normalize();
    const pace = THREE.MathUtils.clamp(this.pace0, C.arrivePace[0], C.arrivePace[1]);
    this.phase = 'arrive'; this.t = 0; this.dir = dir; this.pace = pace; this.door = null;
    if (this.room(dir) < 0.3) { this.end(); return; }   // (a wall close in front: he stands there, the controls his)
    // still walking, at the pace of the steps in (the paper hid the halt, if the far side kept him waiting)
    const vu = P.vel.dot(U);
    P.vel.copy(dir).multiplyScalar(pace).addScaledVector(U, vu);
    P.doorWalk = { dir: dir.clone(), pace };
  }

  /** The controls back. */
  end() {
    if (this.player?.doorWalk) this.player.doorWalk = null;
    this.phase = null; this.door = null; this.held = null;
  }
}
