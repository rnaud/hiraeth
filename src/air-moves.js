import * as THREE from 'three';

// Jumps, drops, the kick off a wall and the stumble of a hard landing, from Mixamo's capture
// (moves.glb), laid over the jump's clips and its procedural layer (src/jump.js) for the traveller
// (Player.animateClips). As with the starts and stops (src/loco-moves.js), none of it changes the
// flight: jump height, timing and where you land are the controller's; each clip is played *by*
// the flight (in the air its frame is the share of the flight done, so the capture's take-off and
// landing come when the body's do) and its own rise off the floor is left out (Animator.play
// `ground`). Times are the clips' own (s), read off their contacts (data/mocap/tmp is the author's).

export const AIR = {
  // a running jump: the clip from take-off (`off`) to touching down (`land`), then on the ground at
  // `after` x real time to `end`. A standing one (under `below` m/s): its landing only, from touchdown (the game's jump goes 2.6 m up, four times the capture's: its straight-legged
  // reach held through the whole flight read as floating; the jump's own tuck stays for the air)
  jump: { clip: 'jump_up', off: 0.88, land: 1.37, end: 1.9, below: 1.5, w: 0.9 },
  run: { clip: 'forward_running_jump', off: 0.04, land: 0.66, end: 0.9, w: 0.85 },
  // a drop (off a ledge, no jump), more than `minAir` s in the air: the landing part, from `reach`
  // s before touchdown
  drop: { clip: 'jump_down_low', land: 1.37, end: 2.1, minAir: 0.22, reach: 0.25, maxSpeed: 3, w: 0.9 },
  // kicking off a wall while climbing: the push and the flight away, at `rate`
  wall: { clip: 'jump_from_wall', from: 0.22, to: 1.2, rate: 1.5, w: 0.9 },
  // a hard landing at speed (over `impact` m/s down, under the knockdown's), the stumble's lurch above the legs
  stumble: { clip: 'jogging_stumble', from: 0.32, to: 1.08, impact: 15, minSpeed: 2.6, w: 0.85 },
  after: 1.2, blendIn: 0.08, blendOut: 0.2,
};

/** The traveller's moves in the air and as he lands: update() each frame, then play(animator). */
export class AirMoves {
  constructor() {
    this.cur = null;
    this.count = { jump: 0, run: 0, drop: 0, wall: 0, stumble: 0 };
    this.wasAir = false;
  }

  /**
   * @param s.onGround  @param s.airT s in the air  @param s.tLand s to the ground (src/jump.js jumpPhase), or Infinity
   * @param s.jumped    a jump began this frame   @param s.wallKick  kicked off a wall this frame
   * @param s.speed     horizontal m/s   @param s.impact m/s into the ground on landing (this frame)
   * @param s.free      nothing else is posing the body (riding, gliding, the jets, swimming, a get-up)
   */
  update(dt, { onGround, airT = 0, tLand = Infinity, jumped = false, wallKick = false, speed = 0, impact = 0, free = true }) {
    const landed = onGround && this.wasAir;
    this.wasAir = !onGround;
    if (!free) { this.cur = null; return this; }
    if (wallKick) this.begin('wall', AIR.wall.from);
    else if (jumped && speed > AIR.jump.below) this.begin('run', AIR.run.off);
    else if (jumped) this.hop = true;
    else if (landed && !this.cur && this.hop) this.begin('jump', AIR.jump.land);
    else if (!onGround && !this.cur && !this.hop && airT > AIR.drop.minAir && speed < AIR.drop.maxSpeed && tLand < AIR.drop.reach) this.begin('drop', AIR.drop.land - tLand);
    if (onGround && !landed) this.hop = false;
    if (landed && impact > AIR.stumble.impact && speed > AIR.stumble.minSpeed && (!this.cur || this.cur.kind === 'run')) this.begin('stumble', AIR.stumble.from);
    const C = this.cur;
    if (!C) return this;
    const M = AIR[C.kind];
    if (landed) C.landed = true;
    if (C.kind === 'run') {
      if (!C.landed && !onGround) {
        // in the air: the share of the flight done
        const k = Number.isFinite(tLand) ? airT / Math.max(airT + tLand, 1e-3) : Math.min(airT / 0.8, 0.95);
        C.t = Math.max(C.t, M.off + (M.land - M.off) * THREE.MathUtils.clamp(k, 0, 0.98));
      } else C.t = Math.max(C.t, M.land) + dt * AIR.after;
      if (C.t >= M.end) C.out = true;
    } else if (C.kind === 'drop' || C.kind === 'jump') {
      if (!onGround && !C.landed) C.t = Math.max(C.t, M.land - (Number.isFinite(tLand) ? tLand : 0));
      else C.t = Math.max(C.t, M.land) + dt * AIR.after;
      if (C.t >= M.end) C.out = true;
    } else if (C.kind === 'wall') {
      C.t += dt * M.rate;
      if (C.t >= M.to || C.landed) C.out = true;
    } else if (C.kind === 'stumble') {
      C.t += dt;
      if (C.t >= M.to || !onGround) C.out = true;
    }
    C.w = C.out ? C.w - dt / AIR.blendOut : Math.min(1, C.w + dt / AIR.blendIn);
    if (C.out && C.w <= 0) this.cur = null;
    return this;
  }

  begin(kind, t) {
    this.cur = { kind, t, w: this.cur?.w ?? 0, out: false, landed: false };
    this.count[kind]++;
    return this.cur;
  }

  /** Lay this frame's move on the Animator (before its update); returns its weight. */
  play(A) {
    const C = this.cur;
    if (!C || C.w <= 0) return 0;
    const M = AIR[C.kind], w = C.w * M.w;
    // (in the air the clip's own rise is left out: the controller flies the body; the stumble is
    // laid on above the legs, which run on as they were)
    A.play(M.clip, C.t, w, { full: false, ground: true, head: true, legs: C.kind !== 'stumble' });
    return w;
  }

  state() { const C = this.cur; return C ? { kind: C.kind, t: C.t, w: C.w } : null; }
}
