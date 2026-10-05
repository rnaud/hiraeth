import * as THREE from 'three';
import { talkFaces } from '../talk-face.js';

// A moment: a short cinematic of its own (6–12 s) for a first time that deserves one, drawn
// like a page of a comic: a few shots ("panels", each a camera move or a hold), the letterbox,
// a line or two in the subtitles, the traveller's face and hands in the line's tone, light and
// music cues on beats, then back to you. Only once per save (its flag), skippable (B / ○, the
// Menu button, Esc, or a tap on the corner tag), and never in the way: anything that fails ends
// it at once, and when one can't play (no stage, a scene already up) the caller does what it
// always did without it. The state a moment shows is never left to it: the caller applies it
// (at a beat, and for sure in onEnd, which a skip and a failure call too).
//
//   const moments = new MomentStage({ ship, game, player, physics })     (src/story/index.js: ctx.moments)
//   moments.play({ id, flag, shots, beats, onStart, onFrame, onEnd })   → the Moment, or null: fall back
//   moments.update(dt) once a frame (the story runtime), moments.playing, moments.skip()
//
// A shot is { dur, from, to?, ease?, fov?, clear? }: `from` and `to` are frames { pos, look, fov }
// (Vector3s, or functions of the shot's time returning one, so a frame can follow something
// moving: the head of a stream, the traveller's face); no `to` holds `from`. Shots cut from one
// to the next, as panels do. Beats are { t, line?, secs?, run?(moment) }: a line goes up in the
// subtitles (src/ship/cinema.js), and while it shows the traveller says it with his face.
//
// The camera is the ship's cinematic camera (ship.shot / ship.release, as the box scene's), the
// letterbox and the subtitles are the ship's Cinema. Nothing here compiles anything: a moment
// only moves the camera and what already exists (warm what it shows before: see the desert's).

export const EASE = {
  linear: (t) => t,
  in: (t) => t * t,
  out: (t) => 1 - (1 - t) * (1 - t),
  inOut: (t) => t * t * (3 - 2 * t),
  smoother: (t) => t * t * t * (t * (t * 6 - 15) + 10),
};
const clamp01 = (t) => Math.min(1, Math.max(0, t));
const val = (v, t) => (typeof v === 'function' ? v(t) : v);

/** Seconds a run of shots takes. */
export const shotsLength = (shots) => shots.reduce((a, s) => a + (s.dur ?? 0), 0);

/** Which shot plays at time t, and how far into it: { i, shot, t (s into it), k (eased 0..1) }; past the end, the last one held. */
export function shotIndex(shots, t) {
  let t0 = 0;
  for (let i = 0; i < shots.length; i++) {
    const d = shots[i].dur ?? 0;
    if (t < t0 + d || i === shots.length - 1) {
      const local = Math.max(0, Math.min(d, t - t0)), raw = d > 0 ? clamp01(local / d) : 1;
      return { i, shot: shots[i], t: local, k: (EASE[shots[i].ease ?? 'inOut'] ?? EASE.inOut)(raw) };
    }
    t0 += d;
  }
  return null;
}

/** The camera at time t: { i, pos, look, fov } (fresh vectors). Frames given as functions are asked at the shot's own time. */
export function shotAt(shots, t, base = 50) {
  const at = shotIndex(shots, t);
  if (!at) return null;
  const s = at.shot, a = val(s.from, at.t), b = s.to ? val(s.to, at.t) : a;
  const pos = new THREE.Vector3().lerpVectors(a.pos, b.pos, at.k);
  const look = new THREE.Vector3().lerpVectors(a.look, b.look, at.k);
  const fa = a.fov ?? s.fov ?? base, fb = b.fov ?? s.fov ?? fa;
  return { i: at.i, pos, look, fov: fa + (fb - fa) * at.k };
}

const _d = new THREE.Vector3(), _m4 = new THREE.Matrix4();

/**
 * Where someone's face is and which way it looks, from their head as it is posed now (the idle
 * turns the head about: a close-up framed off the body's heading can catch an ear). The eyes'
 * bind space (src/humanoid.js updateEyes): +z out of the face. Null without a head.
 */
export function faceOf(H, out = { pos: new THREE.Vector3(), fwd: new THREE.Vector3() }) {
  const m = H?.eyeMesh, head = H?.b?.Head;
  if (!m?.skeleton || !head) return null;
  const i = m.skeleton.bones.indexOf(head);
  if (i < 0) return null;
  _m4.multiplyMatrices(head.matrixWorld, m.skeleton.boneInverses[i]).multiply(m.bindMatrix).premultiply(m.bindMatrixInverse).premultiply(m.matrixWorld);
  const c = m.material?.uniforms?.uEyeC?.value;
  out.pos.set(0, c?.y ?? 0, c?.z ?? 0).applyMatrix4(_m4);
  out.fwd.set(0, 0, 1).transformDirection(_m4);
  return out;
}

export class Moment {
  /**
   * @param o.id       a name (logs)
   * @param o.flag     the save flag that says it has played (set when it starts)
   * @param o.shots    the panels (see the top)
   * @param o.beats    [{ t, line?, secs?, run? }] in time order
   * @param o.dur      its length (default: the shots')
   * @param o.stage    { shot(s), release(blend), bars(on), hud(on), say(line, o), skipTag(on), physics?, player?, game? }
   * @param o.grace    s before a skip counts (the press that started it, mashed, must not end it)
   * @param o.onStart(m), o.onFrame(m, t, dt), o.onEnd(m, skipped)
   */
  constructor(o) {
    Object.assign(this, { beats: [], grace: 0.6, blendOut: 1.2, ...o });
    this.dur = o.dur ?? shotsLength(this.shots ?? []);
    this.t = 0; this.done = false; this.skipped = false; this._next = 0; this.line = null; this.lineT = 0;
  }

  start() {
    const S = this.stage;
    this.flag && S.game?.set(this.flag, true);   // once per save, from the start (its state is the caller's, applied anyway)
    S.bars?.(true); S.hud?.(false); S.skipTag?.(true);
    const P = S.player;
    if (P?.vel) P.vel.set(0, P.vel.y ?? 0, 0);
    this.onStart?.(this);
    this.frame(0);
  }

  /** B / Menu / Esc / the tag: to the end (after the grace; counted on the next frame, so the key that asked opens nothing else). */
  skip() {
    if (this.done || this.t < this.grace) return false;
    this._skip = true;
    return true;
  }

  /** Per frame: false once it is over. */
  update(dt) {
    if (this.done) return false;
    if (this._skip) { this.finish(true); return false; }
    this.t += dt;
    try {
      this.frame(dt);
    } catch (e) {
      console.warn(`moment ${this.id ?? ''} failed; ending it`, e);
      this.failed = true;
      this.finish(true);
      return false;
    }
    if (this.t >= this.dur) this.finish(false);
    return !this.done;
  }

  frame(dt) {
    const T = this.t, S = this.stage;
    while (this._next < this.beats.length && T >= this.beats[this._next].t) {
      const b = this.beats[this._next++];
      if (b.line) { this.line = b.line; this.lineT = b.secs ?? 3.2; S.say?.(b.line, { secs: this.lineT }); }
      b.run?.(this);
    }
    if (this.line && (this.lineT -= dt) <= 0) this.line = null;
    // the traveller says the line up with his face (and so his hands: src/hands.js talkOf); a beat may set a look of his own
    const H = S.player?.humanoid;
    // (no looking about, shading his eyes, while the panels frame him: the idle's own glance waits; src/animator.js)
    if (S.player?.animator && 'idleT' in S.player.animator) S.player.animator.idleT = 0;
    // (a look without a line, m.look: worn quietly, the mouth shut and the hands still: src/talk-face.js `look`)
    if (H && this.line?.tone) talkFaces.drive(H, { speaking: true, tone: this.line.tone });
    else if (H && this.look) talkFaces.drive(H, { look: this.look });
    this.onFrame?.(this, T, dt);
    const cam = this.camera();
    if (cam) S.shot?.(cam);
  }

  /** This frame's camera (null without shots): kept out of walls, widened on a tall screen. */
  camera() {
    if (!this.shots?.length) return null;
    const c = shotAt(this.shots, this.t);
    if (!c) return null;
    const shot = this.shots[c.i];
    this.shotI = c.i;
    const ph = this.stage.physics;
    if (ph?.rayDistance && shot.clear !== false) {
      // pull in to whatever stands between what it looks at and the lens
      const dir = _d.subVectors(c.pos, c.look), d = dir.length();
      if (d > 0.3) {
        dir.divideScalar(d);
        const hit = ph.rayDistance(c.look, dir, d);
        if (hit < d) c.pos.copy(c.look).addScaledVector(dir, Math.max(0.6, hit - 0.3));
      }
    }
    const aspect = typeof innerWidth === 'number' && innerHeight > 0 ? innerWidth / innerHeight : 1.6;
    if (aspect < 1.2) c.fov = Math.min(80, Math.max(c.fov, THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(c.fov / 2)) * 1.4 / aspect))));
    return c;
  }

  finish(skipped) {
    if (this.done) return;
    this.done = true;
    this.skipped = !!skipped;
    const S = this.stage;
    try { S.say?.(null); } catch {}
    try { S.release?.(skipped ? 0.5 : this.blendOut); } catch {}
    try { S.bars?.(false); S.hud?.(true); S.skipTag?.(false); } catch {}
    try { this.onEnd?.(this, !!skipped); } catch (e) { console.warn(`moment ${this.id ?? ''}: its end failed`, e); }
  }
}

/** The label of the skip tag (the pad's B, the keyboard's Esc, a tap). */
export function skipLabel(doc = typeof document !== 'undefined' ? document : null) {
  const b = doc?.body?.classList;
  if (b?.contains?.('controller')) return 'B / ○ skip';
  if (typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches) return 'tap to skip';
  return 'Esc skip';
}

/**
 * The world's moments: one at a time, on the ship's camera and Cinema.
 * @param o { ship (shot, release, cinema, playing, busy()), game, player, physics, quiet?() }
 */
export class MomentStage {
  constructor({ ship = null, game = null, player = null, physics = null, quiet = () => false } = {}) {
    Object.assign(this, { ship, game, player, physics, quiet });
    this.current = null;
    if (typeof window !== 'undefined' && window.addEventListener) {
      window.addEventListener('keydown', (e) => { if (e.code === 'Escape' && !e.repeat && this.playing) this.skip(); });
    }
  }

  get playing() { return !!this.current && !this.current.done; }

  /** Can a moment play now? A stage to play it on, and nothing else on screen. */
  canPlay() {
    const s = this.ship, P = this.player;
    if (!s?.shot || !s.release || !s.cinema) return false;
    if (this.playing || s.playing || s.busy?.() || s.auto) return false;
    if (P && (P.riding || P.dead || P.down || P.hidden)) return false;
    if (typeof document !== 'undefined' && document.hidden) return false;
    return !this.quiet();
  }

  /** The stage a Moment plays on (the ship's camera and Cinema). */
  stageFor() {
    const s = this.ship, C = s.cinema;
    const tag = (on) => {
      C.held = on;   // the game's toasts wait for the end (src/ship/cinema.js dark())
      C.skip?.(0, on, on ? skipLabel() : null);
      const e = C.skipEl;
      if (e && !e._moment) { e._moment = true; e.addEventListener?.('click', () => { if (this.playing) this.skip(); }); }
    };
    return {
      shot: (c) => s.shot(c), release: (b) => s.release(b), bars: (on) => C.bars?.(on), hud: (on) => C.hud?.(on),
      say: (line, o) => C.say?.(line, o), skipTag: tag, physics: this.physics, player: this.player, game: this.game,
    };
  }

  /** Play a moment (once per save: its flag); returns it, or null if it can't (then do what you did without it). */
  play(def) {
    if (def.flag && this.game?.flag(def.flag)) return null;
    if (!this.canPlay()) return null;
    let m = null;
    try {
      m = new Moment({ ...def, stage: def.stage ?? this.stageFor() });
      this.current = m;
      m.start();
    } catch (e) {
      console.warn(`moment ${def.id ?? ''} could not start`, e);
      this.current = null;
      if (m && !m.done) { m.onEnd = null; m.finish(true); }   // (the caller falls back and does it all itself)
      return null;
    }
    return m;
  }

  update(dt) {
    const m = this.current;
    if (!m) return;
    m.update(dt);
    if (m.done) this.current = null;
  }

  skip() { return this.current?.skip() ?? false; }
}
