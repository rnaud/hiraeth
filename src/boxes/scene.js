import * as THREE from 'three';
import { buildItemModel, buildSparkles, fluidMaterials, BOX } from './model.js';

// Opening a box, the way Link opens a chest (and the way Moebius drew the
// traveller kneeling over his box, lit from below by its light):
//
//   approach  the camera cuts to a low three-quarter shot; the traveller is
//             set square in front of the box, facing it
//   kneel     down on one knee, the hands go to the lid's front edge
//   crack     the lid lifts a finger's width: light leaks out, the box hums
//   lift      it swings up and over; flat bright rays fan out of the box and light
//             the face from below
//   rise      cut to the front: the item rises out of the light and hovers in
//             front of the chest, turning slowly, with a little sparkle; fanfare
//   card      what it is, what it does: E, click or tap to go on
//   out       the item is granted and flies to the traveller; up off the knee;
//             the camera blends back to the game's
//
// Esc (or the skip button, or B / ○) jumps straight to the card; on the card
// it dismisses it. Nothing here can trap the player: every way of pressing on
// ends it, and an error ends it too (the item is still granted).
//
// cam: { shot({ pos, look, fov }), release(blend), hud(show), bars(on) } (main.js
// routes it to the ship's cinematic camera; tests pass nothing).

export const TIMES = { approach: 0.6, kneel: 1.0, crack: 0.9, lift: 1.1, rise: 1.5 };
const ORDER = ['approach', 'kneel', 'crack', 'lift', 'rise', 'card', 'out'];
export const OUT_TIME = 1.3;
export const CARD_MIN = 0.5;   // s the card is up before a press counts (no accidental dismissals)
const LID_OPEN = 1.95;         // rad the lid swings back (past upright: a backdrop behind the item)
const smooth = (t) => { t = THREE.MathUtils.clamp(t, 0, 1); return t * t * (3 - 2 * t); };
const easeOut = (t) => 1 - Math.pow(1 - THREE.MathUtils.clamp(t, 0, 1), 3);
const UP = new THREE.Vector3(0, 1, 0);

export class BoxScene {
  /**
   * @param o { box (a box record from createBoxes), def (ITEMS entry), item id, player, cam, sound, card,
   *            groundAt(x, z, fromY), onGrant(), onEnd() }
   */
  constructor(o) {
    Object.assign(this, o);
    this.phase = null; this.t = 0; this.done = false; this.k = 0;
    this.F = new THREE.Vector3(Math.sin(o.box.yaw), 0, Math.cos(o.box.yaw));   // the box's front
    this.S = new THREE.Vector3(Math.cos(o.box.yaw), 0, -Math.sin(o.box.yaw));  // its local +x (the kneeling traveller's right)
    this.look = new THREE.Vector3();
    this.camPos = new THREE.Vector3();
  }

  /** Box-local point (x right, y up, z front) to world. */
  P(x, y, z, out = new THREE.Vector3()) {
    const b = this.box.pos;
    return out.set(b.x + this.S.x * x + this.F.x * z, b.y + y, b.z + this.S.z * x + this.F.z * z);
  }

  start() {
    const P = this.player, b = this.box;
    // square in front of the box, facing it
    const stand = this.P(0, 0, 0.95);
    const g = this.groundAt?.(stand.x, stand.z, b.pos.y + 1.5);
    stand.y = Number.isFinite(g) && Math.abs(g - b.pos.y) < 1.2 ? g : b.pos.y;
    if (P) {
      P.pos.copy(stand);
      P.vel?.set(0, 0, 0);
      P.heading = b.yaw + Math.PI;
      if (P.object) {
        P.object.position.copy(P.pos);
        P.frame?.quaternion?.(P.heading, P.object.quaternion);
      }
    }
    this.ground = stand.y;
    // the item, inside the box for now
    this.model = buildItemModel(this.item);
    this.model.visible = false;
    this.fluid = fluidMaterials(this.model);
    this.sparkles = buildSparkles();
    this.sparkles.visible = false;
    b.scene?.add(this.model, this.sparkles);
    this.cam?.hud?.(false);
    this.cam?.bars?.(true);
    this.card?.scene(true);
    this.enter('approach');
  }

  enter(phase) {
    this.phase = phase; this.t = 0;
    const s = this.sound;
    if (phase === 'crack') s?.boxCreak?.();
    if (phase === 'lift') { s?.boxBurst?.(); this.box.parts.rays.visible = true; }
    if (phase === 'rise') { this.model.visible = true; this.sparkles.visible = true; s?.fanfare?.(); this.fanfared = true; }
    if (phase === 'card') { this.card?.show(this.def); this.cardT = 0; }
    if (phase === 'out') {
      this.card?.hide();
      this.cam?.release?.(1.2);
      if (!this.granted) { this.granted = true; this.onGrant?.(); }
      this.from = this.model.position.clone();
      s?.chime?.();
    }
  }

  /** Esc / skip: straight to the card (on the card: go on). */
  skip() {
    if (this.done) return;
    if (this.phase === 'card') return this.dismiss(true);
    if (this.phase === 'out') return;
    if (!this.fanfared) this.sound?.fanfare?.();
    this.fanfared = true;
    this.box.parts.rays.visible = true;
    this.model.visible = true; this.sparkles.visible = true;
    this.enter('card');
    this.cardT = CARD_MIN;   // (a skip already pressed: the next press dismisses)
  }

  /** E / click on the card. force: skip the minimum time. */
  dismiss(force = false) {
    if (this.phase !== 'card') return false;
    if (!force && this.cardT < CARD_MIN) return false;
    this.enter('out');
    return true;
  }

  /** Per frame, after the player's own update. Returns true while it plays. */
  update(dt) {
    if (this.done) return false;
    try { this.frame(dt); } catch (e) {
      console.warn('box scene failed; ending it', e);
      if (!this.granted) { this.granted = true; this.onGrant?.(); }
      this.end();
    }
    return !this.done;
  }

  frame(dt) {
    this.t += dt;
    const T = TIMES, ph = this.phase;
    if (ph === 'card') this.cardT += dt;
    if (T[ph] !== undefined && this.t >= T[ph]) this.enter(ORDER[ORDER.indexOf(ph) + 1]);
    const at = ORDER.indexOf(this.phase), t = this.t;
    const B = this.box, parts = B.parts;
    const past = (p) => at > ORDER.indexOf(p);
    // ---- the lid: a crack, then the swing back
    let lid = 0;
    if (this.phase === 'crack') lid = 0.12 * smooth(t / T.crack) + 0.015 * Math.sin(t * 40) * (t < 0.5 ? 1 : 0);
    else if (this.phase === 'lift') lid = 0.12 + (LID_OPEN - 0.12) * easeOut(t / T.lift);
    else if (past('lift') || this.phase === 'rise') lid = LID_OPEN;
    if (this.phase === 'out') lid = LID_OPEN;
    parts.lid.rotation.z = lid;
    // ---- light: leaking at the seam, then pouring out
    const pour = this.phase === 'crack' ? 0.35 * smooth(t / T.crack) : at >= ORDER.indexOf('lift') ? (this.phase === 'out' ? 1 - smooth(t / OUT_TIME) : this.phase === 'lift' ? 0.35 + 0.65 * easeOut(t / 0.5) : 1) : 0;
    B.glow = Math.max(B.glow ?? 0, 0);
    B.sceneLight = pour;
    parts.glowFloor.visible = pour > 0.01;
    // rays: grow out of the mouth and shimmer
    const rk = this.phase === 'lift' ? easeOut(t / T.lift) : this.phase === 'out' ? 1 - smooth(t / (OUT_TIME * 0.8)) : at > ORDER.indexOf('lift') ? 1 : 0;
    parts.rays.visible = rk > 0.01;
    const time = (this.clock = (this.clock ?? 0) + dt);
    if (parts.rays.visible) {
      for (const r of parts.rays.children) r.scale.set(1, Math.max(1e-3, r.userData.len * rk * (0.82 + 0.18 * Math.sin(time * 2.6 + r.userData.phase))), 1);
    }
    // ---- the traveller: kneel, hands to the lid
    let kneel = 0, reach = 0;
    if (this.phase === 'approach') kneel = 0;
    else if (this.phase === 'kneel') { kneel = smooth(t / T.kneel); reach = smooth((t - 0.45) / 0.55); }
    else if (this.phase === 'crack') { kneel = 1; reach = 1; }
    else if (this.phase === 'lift') { kneel = 1; reach = 1 - 0.6 * smooth((t - 0.25) / 0.6); }
    else if (this.phase === 'rise' || this.phase === 'card') { kneel = 1; reach = 0.4; }
    else if (this.phase === 'out') { const u = smooth((t - 0.45) / 0.8); kneel = 1 - u; reach = 0.4 * (1 - u); }
    this.k = kneel;
    // the hands: under the lid's free edge (the right hand) and its middle (the left) while it
    // lifts, then resting on the box's front corners
    const a = Math.min(lid, 1.1), W = BOX.w, ex = (r) => -W / 2 + W * r * Math.cos(a), ey = (r) => BOX.h + W * r * Math.sin(a) + 0.03;
    const rest = this.phase === 'rise' || this.phase === 'card' || this.phase === 'out' || (this.phase === 'lift' && t > 0.45);
    const hands = rest ? [this.P(0.3, BOX.h + 0.05, BOX.d / 2 + 0.02), this.P(-0.3, BOX.h + 0.05, BOX.d / 2 + 0.02)]
      : [this.P(ex(0.95), ey(0.95), BOX.d / 2 - 0.04), this.P(ex(0.45), ey(0.45), BOX.d / 2 + 0.01)];
    // ---- the item: rises out of the light and hovers before the chest
    const hover = this.P(0, 0.9, 0.38);
    if (this.model.visible) {
      if (this.phase === 'rise') this.model.position.copy(this.P(0, 0.25, 0)).lerp(hover, easeOut(t / T.rise));
      else if (this.phase === 'card') this.model.position.copy(hover);
      else if (this.phase === 'out') {
        const u = smooth(t / 0.6), chest = this.P(0, 0.8, 0.9);
        this.model.position.copy(this.from).lerp(chest, u);
        this.model.scale.setScalar(Math.max(1e-3, 1 - u));
        if (u >= 1) this.model.visible = false;
      }
      this.model.position.y += Math.sin(time * 2.2) * 0.02;
      this.model.rotation.set(0.15 * Math.sin(time * 0.9), time * 1.1, 0);
      for (const m of this.fluid) { m.uniforms.uFluidA.value.set(1, 4, time, 0); }
      // sparkles orbit and twinkle
      const sp = this.sparkles;
      sp.visible = this.model.visible && this.phase !== 'out';
      sp.position.copy(this.model.position);
      for (const s of sp.children) {
        const u = s.userData, ang = u.a + time * u.sp;
        s.position.set(Math.cos(ang) * u.r, u.y * 0.35 + Math.sin(time * 1.3 + u.ph) * 0.05, Math.sin(ang) * u.r);
        s.scale.setScalar(Math.max(1e-3, Math.pow(Math.max(0, Math.sin(time * 3.1 + u.ph)), 3) * 1.6));
      }
    }
    // ---- pose the traveller (after its own update this frame)
    const P = this.player, H = P?.humanoid;
    if (H?.kneel && kneel > 0.001) {
      P.object?.updateMatrixWorld?.(true);
      const fwd = new THREE.Vector3(-this.F.x, 0, -this.F.z);
      const look = this.model.visible ? this.model.position : this.P(0, BOX.h, 0.1);
      H.kneel(kneel, { up: P.frame?.up ?? UP, fwd, ground: this.ground, look, hands, reach });
    }
    // ---- the camera
    this.camera(dt, time);
    if (this.phase === 'out' && this.t >= OUT_TIME) this.end();
  }

  camera(dt, time) {
    const cam = this.cam;
    if (!cam?.shot || this.phase === 'out') return;
    const at = ORDER.indexOf(this.phase);
    let pos, look, fov;
    if (at < ORDER.indexOf('rise')) {
      // A: low three-quarter from the traveller's right, pushing in
      const since = (this.phaseStart('approach') ?? 0);
      const k = 1 - 0.16 * smooth(since / 3.6);
      pos = this.P(3.5 * k, 0.95, 0.35 + 0.45 * k);
      look = this.P(0, 0.72, 0.5);
      fov = 40;
    } else {
      // B: in front of the traveller, beyond the box and a little to the right: the face lit from
      // below, the item before the chest, the rays fanning out over the ground, the lid up on the left
      const since = this.phaseStart('rise') ?? 0;
      const k = 1 - 0.17 * smooth(since / 5);
      pos = this.P(0.8 * k, 1.12 - 0.05 * (1 - k), -2.7 * k);
      look = this.P(0, 0.8, 0.55);
      fov = 42;
    }
    // a breath of handheld drift
    pos.x += Math.sin(time * 0.7) * 0.012; pos.y += Math.sin(time * 0.9) * 0.01;
    cam.shot({ pos, look, fov });
  }

  /** Seconds since a phase began (counting the phases after it), for the camera pushes. */
  phaseStart(name) {
    const i = ORDER.indexOf(name), j = ORDER.indexOf(this.phase);
    if (j < i) return null;
    let s = this.t;
    for (let k = i; k < j; k++) s += TIMES[ORDER[k]] ?? 0;
    return s;
  }

  end() {
    if (this.done) return;
    this.done = true;
    this.model?.removeFromParent(); this.sparkles?.removeFromParent();
    const parts = this.box?.parts;
    if (parts) { parts.rays.visible = false; parts.glowFloor.visible = false; }
    if (this.box) this.box.sceneLight = 0;
    if (this.cam?.release && this.phase !== 'out') this.cam.release(0.8);
    this.cam?.bars?.(false);
    this.cam?.hud?.(true);
    this.card?.scene(false);
    this.onEnd?.();
  }
}
