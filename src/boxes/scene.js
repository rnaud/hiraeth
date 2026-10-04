import * as THREE from 'three';
import { buildItemModel, buildSparkles, fluidMaterials, BOX, BOX_SCALE, ITEM_SCALE } from './model.js';

// Opening a box. The makers' chests are big, and they don't open like a lid on
// hinges: they wake, lift off the ground and come apart into light, leaving what
// they kept hovering where they stood.
//
//   approach  the camera cuts to a low three-quarter shot over the traveller's right
//             shoulder; the traveller is set square in front of the box, facing it
//   wake      light leaks from the seam, the carvings brighten, the box shudders and hums
//   rise      it lifts off the ground, turning slowly, and hangs there
//   dissolve  it comes apart from the top down (the materials' DISSOLVE block: noise,
//             a burning edge); the item grows out of the light at its centre
//   reveal    the box is gone; the item hovers, turning, with a little sparkle; fanfare
//   card      what it is, what it does: E, click or tap to go on
//   out       the item is granted and flies to the traveller; the camera blends back
//
// Esc (or the skip button, or the pad's back button) jumps straight to the card; on the card
// it dismisses it. Nothing here can trap the player: every way of pressing on
// ends it, and an error ends it too (the item is still granted).
//
// cam: { shot({ pos, look, fov }), release(blend), hud(show), bars(on) } (main.js
// routes it to the ship's cinematic camera; tests pass nothing).

export const TIMES = { approach: 0.5, wake: 0.9, rise: 1.4, dissolve: 1.6, reveal: 0.9 };
const ORDER = ['approach', 'wake', 'rise', 'dissolve', 'reveal', 'card', 'out'];
export const OUT_TIME = 1.3;
export const STAND_AT = (BOX.d / 2) * BOX_SCALE + 0.9;   // m from the box centre to where the traveller stands (front side)
export const LIFT = 0.75;      // m the box rises before it comes apart
export const CARD_MIN = 0.5;   // s the card is up before a press counts (no accidental dismissals)
const TURN = 0.6;              // rad it turns while it hangs in the air
const smooth = (t) => { t = THREE.MathUtils.clamp(t, 0, 1); return t * t * (3 - 2 * t); };
const easeOut = (t) => 1 - Math.pow(1 - THREE.MathUtils.clamp(t, 0, 1), 3);
const _d = new THREE.Vector3();

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

  /** Box-local point (x right, y up, z front; metres at the box's full size) to world. */
  P(x, y, z, out = new THREE.Vector3()) {
    const b = this.box.pos;
    return out.set(b.x + this.S.x * x + this.F.x * z, b.y + y, b.z + this.S.z * x + this.F.z * z);
  }

  start() {
    const P = this.player, b = this.box;
    // square in front of the box, facing it
    const stand = this.P(0, 0, STAND_AT);
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
    this.H = BOX.h + BOX.lid;   // the box's height (unscaled)
    // the item, at the box's heart for now
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

  /** Where the box hangs at lift k (0..1): its centre, in world space. */
  heart(k = 1, out = new THREE.Vector3()) { return this.P(0, LIFT * k + (this.H * BOX_SCALE) / 2, 0, out); }

  /** How far the box has come apart (0..1), on all its materials; it leaves the shadow pass meanwhile. */
  setDissolve(k) {
    const B = this.box, root = B.parts?.root;
    const y0 = root ? root.position.y : B.pos.y, y1 = y0 + this.H * BOX_SCALE + 0.05;
    for (const m of Object.values(B.parts?.mats ?? {})) m.uniforms.uDissolve?.value.set(k, 0.09, y0 - 0.02, y1);
    if (B.noShadow && root) {
      const i = B.noShadow.indexOf(root);
      if (k > 0 && i < 0) B.noShadow.push(root);
      if (k <= 0 && i >= 0) B.noShadow.splice(i, 1);
    }
    for (const c of root?.children ?? []) if (c !== B.parts.raysWrap) c.visible = k < 1;
    this.dissolved = k;
  }

  enter(phase) {
    this.phase = phase; this.t = 0;
    const s = this.sound;
    if (phase === 'wake') s?.boxCreak?.();
    if (phase === 'rise') s?.boxHum?.(1);
    if (phase === 'dissolve') { s?.boxBurst?.(); this.model.visible = true; this.sparkles.visible = true; }
    if (phase === 'reveal') { this.setDissolve(1); s?.fanfare?.(); this.fanfared = true; }
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
    this.model.visible = true; this.sparkles.visible = true;
    this.lift = 1;
    this.setDissolve(1);
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
    const B = this.box, parts = B.parts, root = parts.root;
    const after = (p) => at > ORDER.indexOf(p);
    const time = (this.clock = (this.clock ?? 0) + dt);
    // ---- the box: a shudder, the lift, the slow turn, then it comes apart
    let shake = 0;
    if (this.phase === 'wake') shake = smooth(t / T.wake) * (0.6 + 0.4 * Math.sin(t * 9) ** 2);
    if (this.phase === 'rise') this.lift = easeOut(t / T.rise);
    else if (after('rise')) this.lift = 1;
    const lift = this.lift ?? 0;
    if (root) {
      const bob = lift * Math.sin(time * 1.8) * 0.04;
      root.position.set(B.pos.x, B.pos.y + LIFT * lift + bob, B.pos.z);
      root.rotation.set(Math.sin(t * 47) * 0.02 * shake + lift * 0.04 * Math.sin(time * 1.1), B.yaw + TURN * smooth(lift) + Math.sin(t * 31) * 0.03 * shake, Math.sin(t * 53) * 0.02 * shake);
      parts.lid.rotation.z = Math.max(0, Math.sin(t * 23)) * 0.05 * shake;
    }
    if (this.phase === 'dissolve') this.setDissolve(smooth(t / T.dissolve));
    // ---- light: leaking at the seam, then pouring out as it comes apart
    const pour = this.phase === 'wake' ? 0.3 * smooth(t / T.wake) : this.phase === 'rise' ? 0.3 + 0.2 * smooth(t / T.rise)
      : this.phase === 'dissolve' ? 0.5 + 0.5 * easeOut(t / 0.6) : this.phase === 'out' ? 1 - smooth(t / OUT_TIME) : after('dissolve') ? 1 : 0;
    B.glow = Math.max(B.glow ?? 0, 0);
    B.sceneLight = pour;
    parts.glowFloor.visible = false;
    // (no rays now: at this height they crossed the item and the view; the light and the sparkles carry it)
    parts.rays.visible = false;
    // ---- the item: grows out of the light at the box's heart and hovers there
    const hover = this.heart(1);
    if (this.model.visible) {
      if (this.phase === 'dissolve') {
        this.model.position.copy(this.heart(lift));
        this.model.scale.setScalar(ITEM_SCALE * Math.max(1e-3, smooth((t / T.dissolve - 0.15) / 0.7)));
      } else if (this.phase === 'reveal' || this.phase === 'card') {
        this.model.position.copy(hover);
        this.model.scale.setScalar(ITEM_SCALE);
      } else if (this.phase === 'out') {
        const u = smooth(t / 0.6), chest = this.P(0, 1.2, STAND_AT);
        this.model.position.copy(this.from).lerp(chest, u);
        this.model.scale.setScalar(Math.max(1e-3, ITEM_SCALE * (1 - u)));
        if (u >= 1) this.model.visible = false;
      }
      this.model.position.y += Math.sin(time * 2.2) * 0.04;
      this.model.rotation.set(0.15 * Math.sin(time * 0.9), time * 1.1, 0);
      for (const m of this.fluid) { m.uniforms.uFluidA.value.set(1, 4, time, 0); }
      // sparkles orbit and twinkle
      const sp = this.sparkles;
      sp.visible = this.model.visible && this.phase !== 'out';
      sp.position.copy(this.model.position);
      sp.scale.setScalar(ITEM_SCALE);
      for (const s of sp.children) {
        const u = s.userData, ang = u.a + time * u.sp;
        s.position.set(Math.cos(ang) * u.r, u.y * 0.35 + Math.sin(time * 1.3 + u.ph) * 0.05, Math.sin(ang) * u.r);
        s.scale.setScalar(Math.max(1e-3, Math.pow(Math.max(0, Math.sin(time * 3.1 + u.ph)), 3) * 1.6));
      }
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
    if (at < ORDER.indexOf('reveal')) {
      // A: low, over the traveller's right shoulder, tilting up as the box rises and pushing in
      const since = this.phaseStart('approach') ?? 0;
      const k = 1 - 0.18 * smooth(since / 4.4), lift = this.lift ?? 0;
      pos = this.P(1.7 * k, 1.15 + 0.35 * lift, STAND_AT + 2.6 * k);
      look = this.heart(lift).add(_d.set(0, -0.15, 0));
      fov = 46;
    } else {
      // B: beside the traveller, closer: the item hanging where the box was, the rays fanning out behind it
      const since = this.phaseStart('reveal') ?? 0;
      const k = 1 - 0.12 * smooth(since / 5);
      pos = this.P(1.25 * k, 1.45, STAND_AT + 0.9 * k);
      look = this.heart(1);
      fov = 44;
    }
    // a tall phone screen: widen the lens so the traveller, the box and the item still fit across
    const aspect = typeof innerWidth === 'number' && innerHeight > 0 ? innerWidth / innerHeight : 1.6;
    fov = Math.min(80, Math.max(fov, THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(27)) / aspect))));
    if (aspect < 1) { pos.lerp(look, -0.12); look.y -= 0.6; }   // and step back, aiming low so the subject sits above the card
    // keep out of walls and dunes: pull in to whatever stands between the subject and the lens
    if (this.physics) {
      // (from the traveller's chest, which stands clear in front of the box, not from the aim point)
      const from = this.P(0, 1.3, STAND_AT);
      const dir = _d.subVectors(pos, from), d = dir.length();
      dir.divideScalar(d);
      const hit = this.physics.rayDistance(from, dir, d);
      if (hit < d) pos.copy(from).addScaledVector(dir, Math.max(0.9, hit - 0.25));
      const g = this.physics.groundAt(pos.x, pos.y + 2, pos.z, 6);
      if (Number.isFinite(g) && pos.y < g + 0.35) pos.y = g + 0.35;
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
    if (parts?.rays) { parts.rays.visible = false; parts.glowFloor.visible = false; }
    if (this.box) this.box.sceneLight = 0;
    if (parts?.root) this.setDissolve(1);   // it is gone for good (index.js hides the spent box)
    if (this.cam?.release && this.phase !== 'out') this.cam.release(0.8);
    this.cam?.bars?.(false);
    this.cam?.hud?.(true);
    this.card?.scene(false);
    this.sound?.boxHum?.(0);
    this.onEnd?.();
  }
}
