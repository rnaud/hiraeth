import * as THREE from 'three';
import { buildItemModel, buildSparkles, fluidMaterials, tickItem, BOX, BOX_SCALE, ITEM_SCALE } from './model.js';
import { ChestLight, chestLightK, chestLamp, MOUTHS } from './light.js';
import { BEATS, beatFor, timingFor, closingShot, beatPath } from './beats.js';

// Opening a box. The makers' chests are big: they wake, unlatch, rock a few times on the
// ground like a caught thing deciding, and open where they stand, their halves parting like
// petals with light pouring up out of them; what they kept rises out of the light and comes to
// float just over the traveller's open hand. The chest stays where it is, open (issue #223, the
// author: "the chests should not float up, they should open where they are, and light should
// come out from within them. Then the character should hold the item in their hand").
//
//   approach  the camera cuts to a low three-quarter shot over the traveller's right
//             shoulder; the traveller is set square in front of the box, facing it
//   wake      the star brightens, the ray races round it, it shudders and hums; its brass latch clicks
//   rise      (the name kept; nothing rises) it unlatches: light leaks at its seam (until issue #223 it
//             floated up LIFT m and hung there, turning)
//   wobble    it rocks on its foot, on the ground, rests, rocks again (WOBBLES at ROCK of their swing:
//             two or three, each a ray of light across it and a knock), then a last still moment
//   dissolve  (the name kept: it no longer comes apart) it opens where it stands (OPENING): the halves over
//             its band part on their hinges like petals (the temple's bud falls open like a flower, its jade
//             heart rising), real light pours up out of it (light.js: a soft banded column of jade and gold
//             rays, the chest full of light, motes drifting up, its lamp lighting his face; issue #285: it was
//             thin glowing blades and jade specks) and the item grows out of the light inside it, rising clear
//             of its rim; a soft swell, no creak
//   reveal    the item comes down to float just over his open right hand (he holds it out, palm up:
//             Player.offer), turning, with a little sparkle; fanfare. The chest stays open beside him
//   card      what it is, what it does: E, click or tap to go on
//   beat      the item is granted, and a short closing beat that depends on what it is (beats.js:
//             a gadget tried once, the star pinned on, a charm turned over and pocketed, a tank part
//             fitted, a finder pointing the way, a whistle played), on a closing shot in the plan;
//             the backpack has none: he wears it from the card on
//   out       the camera blends back. The item doesn't shrink away into him (it flew to his chest and
//             shrank to nothing, the author's playthrough, issue #58): granted, it is where it lives
//             (on his back, in his gear), and the one that hovered is simply gone
//
// Esc (or the skip button, or the pad's back button) jumps straight to the card; on the card
// it dismisses it, past the beat; in the beat it ends it. Nothing here can trap the player: every way of pressing on
// ends it, and an error ends it too (the item is still granted).
//
// cam: { shot({ pos, look, fov }), release(blend), hud(show), bars(on) } (main.js
// routes it to the ship's cinematic camera; tests pass nothing).

export const TIMES = { approach: 0.5, wake: 0.7, rise: 0.6, wobble: 2.7, dissolve: 1.8, reveal: 1.0 };
/** The dissolve phase in stages (shares of it): the petals part over the first `open`, the item grows from `grow` for
 *  `growFor`, the shell comes apart from `apart` to the end. */
export const OPENING = { open: 0.5, grow: 0.3, growFor: 0.55, apart: 0.55 };
const ORDER = ['approach', 'wake', 'rise', 'wobble', 'dissolve', 'reveal', 'card', 'beat', 'out'];
/**
 * The wobbles, in the wobble phase (s): when each starts, how long it rocks, how far (rad), and
 * which way it leans first. A rest between them; after the last, a still moment before it opens.
 */
export const WOBBLES = [{ at: 0.2, dur: 0.5, amp: 0.25, dir: 1 }, { at: 1.05, dur: 0.5, amp: 0.29, dir: -1 }, { at: 1.85, dur: 0.45, amp: 0.21, dir: 1 }];
/** How far the box leans at time u of a wobble (0..dur): a quick rock, side to side, settling. */
export function wobbleAngle(w, u) {
  if (u < 0 || u > w.dur) return 0;
  const k = u / w.dur;
  return w.dir * w.amp * Math.sin(k * Math.PI * 3) * Math.pow(1 - k, 1.3);
}
export const OUT_TIME = 1.3;
/** s the camera takes to push in from A to B at the reveal (a move, not a jump cut). */
export const PUSH_IN = 0.8;
export const STAND_AT = (BOX.d / 2) * BOX_SCALE + 0.9;   // m from the box centre to where the traveller stands (front side)
export const LIFT = 0;         // m the box rises before it opens: none, it opens where it stands (0.75 until issue #223)
/** How far it rocks on the ground, a share of the wobbles' swing (they were swung in the air). */
export const ROCK = 0.4;
/** Where his open hand is held out (box-local, as BEATS' holds: x his right, y up from his feet, z behind him), how far
 *  over the palm the item floats (m), and its size there (a share of its size over the chest). */
export const HAND = { at: [0.2, 1.06, -0.42], above: 0.2, scale: 0.55 };
export const CARD_MIN = 0.5;   // s the card is up before a press counts (no accidental dismissals)
/**
 * The opening's camera, one of a few plans so the 32 boxes don't all play the same shots (the QC pass):
 * each is A, before the reveal (box-local x right, y up, z front, `k` its push 1 → 0.82, `lift` the rise),
 * and B, the item revealed (`k` 1 → 0.88), with their lenses. 'shoulder' is the first one (low over his
 * right shoulder, then beside him); 'left' the same over his left; 'side' from the box's flank at its
 * height, him in profile, then from past where the box stood back at the item and his face; 'high' from
 * above his shoulder looking down on the box, then beside him. boxPlan() picks one per box.
 */
export const BOX_PLANS = {
  shoulder: { A: (k, l) => [1.7 * k, 1.15 + 0.35 * l, STAND_AT + 2.6 * k], fovA: 46, B: (k) => [1.25 * k, 1.45, STAND_AT + 0.9 * k], fovB: 44 },
  left: { A: (k, l) => [-1.7 * k, 1.15 + 0.35 * l, STAND_AT + 2.6 * k], fovA: 46, B: (k) => [-1.25 * k, 1.45, STAND_AT + 0.9 * k], fovB: 44 },
  side: { A: (k, l) => [3.3 * k, 0.75 + 0.3 * l, STAND_AT * 0.45], fovA: 44, B: (k) => [0.55, 1.5, -1.9 * k], fovB: 40 },
  high: { A: (k, l) => [1.1 * k, 2.9 + 0.2 * l, STAND_AT + 1.9 * k], fovA: 48, B: (k) => [1.25 * k, 1.45, STAND_AT + 0.9 * k], fovB: 44 },
};
/** The plan for a box: the first box keeps 'shoulder'; the others by a stable hash of the box's id. */
export function boxPlan(id = '') {
  if (!id || id === 'desert.backpack') return 'shoulder';
  let h = 2166136261;
  for (const c of String(id)) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
  const names = Object.keys(BOX_PLANS);
  return names[h % names.length];
}
const smooth = (t) => { t = THREE.MathUtils.clamp(t, 0, 1); return t * t * (3 - 2 * t); };
const easeOut = (t) => 1 - Math.pow(1 - THREE.MathUtils.clamp(t, 0, 1), 3);
const _d = new THREE.Vector3(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _e = new THREE.Euler(), _c = new THREE.Vector3(), _p = new THREE.Vector3(), _lk = new THREE.Vector3();
const _Y = new THREE.Vector3(0, 1, 0), _m = new THREE.Vector3();
const _ld = new THREE.Vector3(), _cf = new THREE.Vector3(), _of = new THREE.Vector3(), _rt = new THREE.Vector3(), _uv = new THREE.Vector3(), _hd = new THREE.Vector3(), _to = new THREE.Vector3(), _ai = new THREE.Vector3();
/** The lens's room (issues #292, #293): it stands LENS_GAP m short of a surface between him and it, and no nearer
 *  his chest than LENS_NEAR m where a swing round him (SWINGS steps of SWING_STEP rad each way) finds the room;
 *  it eases to a new swing at SWING_RATE (1/s). */
export const LENS_GAP = 0.25, LENS_NEAR = 1.3, SWING_STEP = 0.3, SWINGS = 10, SWING_RATE = 3;
/** Where his head must sit in a closing shot: within these shares of the half-frame, across and up (issue #293:
 *  the middle 80 % across; up, inside the letterbox's picture). */
export const HEAD_FRAME = { x: 0.7, y: 0.6 };
/** How far over 1 the chest's glow goes at its light's full (uBoxA.y: the linings glow with the light out of it). */
export const LINING_GLOW = 0.75;

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
    this.H = b.parts?.size?.h ?? BOX.h + BOX.lid;   // the chest's height (unscaled: its kind's)
    // the item, at the box's heart for now
    this.model = buildItemModel(this.item);
    this.model.visible = false;
    this.fluid = fluidMaterials(this.model);
    this.fill = this.dry ? 0 : 1;   // (the backpack out of its first chest: its glass dry, as it will be on his back)
    this.sparkles = buildSparkles();
    this.sparkles.visible = false;
    b.scene?.add(this.model, this.sparkles);
    // the light out of it (light.js): washes over the finished picture; drawn at nothing while it wakes, so the washes'
    // program is ready before it opens
    this.light = new ChestLight({ veils: this.veils ?? null, parent: b.scene ?? new THREE.Group(), kind: b.parts?.kind });
    this.light.warm = true;
    this.lightK = 0;
    this.cam?.hud?.(false);
    this.cam?.bars?.(true);
    this.card?.scene(true);
    // (?boxPlan=<name> forces a plan: the cinematics QC sees every plan with every closing beat)
    const forced = typeof location !== 'undefined' ? new URLSearchParams(location.search ?? '').get('boxPlan') : null;
    this.plan = BOX_PLANS[forced] ? forced : this.clearPlan(boxPlan(b.id));
    // the closing beat for what it holds, and the timings it asks for (beats.js)
    this.beat = beatFor(this.item, this.def);
    const tm = timingFor(this.plan, this.beat, { times: TIMES, wobbles: WOBBLES });
    this.times = { ...tm.times, beat: BEATS[this.beat].dur };
    this.wobbles = tm.wobbles;
    this.enter('approach');
  }

  /**
   * The box's plan if its lenses stand clear (a wall or a cliff right behind or beside a box would pull them
   * in on top of him: the walls' check below), else 'shoulder', which the walls' check has always handled.
   */
  clearPlan(name) {
    const ph = this.physics, plan = BOX_PLANS[name];
    if (!plan || name === 'shoulder' || !ph?.rayDistance) return plan ? name : 'shoulder';
    const from = this.P(0, 1.3, STAND_AT);
    for (const at of [plan.A(1, 0), plan.A(0.82, 1), plan.B(1)]) {
      const pos = this.P(...at), dir = pos.clone().sub(from), d = dir.length();
      if (ph.rayDistance(from, dir.divideScalar(d), d + 0.4) < d + 0.3) return 'shoulder';
    }
    return name;
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
    for (const c of root?.children ?? []) c.visible = k < 1;
    this.dissolved = k;
  }

  enter(phase) {
    const prev = this.phase;
    this.phase = phase; this.t = 0;
    const s = this.sound;
    if (phase === 'wake') s?.boxLatch?.();   // (a brass latch: the wooden creak it made until issue #223 read as a door)
    if (phase === 'rise') { s?.boxHum?.(1); s?.boxLatch?.(true); }
    if (phase === 'wobble') {
      this.wobbled = 0;
      // the ray's clock from here: pass rayBase + i crosses with wobble i
      const A = this.box.parts?.mats?.body?.uniforms?.uBoxA?.value;
      this.rayBase = A ? Math.ceil(A.w) + 1 : 0;
    }
    if (phase === 'dissolve') { s?.boxOpen?.(); this.model.visible = true; this.sparkles.visible = true; }
    if (phase === 'reveal') { s?.fanfare?.(); this.fanfared = true; this.revealFrom = this.model.position.clone(); }
    if (phase === 'card') { this.card?.show(this.def, { found: this.box?.place?.found ?? null }); this.cardT = 0; }
    if (phase === 'beat') {
      this.card?.hide();
      // granted now: the star is on his lapel for the look at it worn
      if (!this.granted) { this.granted = true; this.onGrant?.(); }
      this.beatFrom = this.model.position.clone();
      this.beatCamFrom = this.camPos.clone(); this.beatFovFrom = this.camFov ?? 44;
      this.acted = false; this.turn = 0;
      this.heading0 = this.player?.heading ?? 0;
      this.pointTurn = this.beat === 'point' ? this.pointAngle() : 0;
    }
    if (phase === 'out') {
      this.lightFrom = this.lightK ?? 0;   // (the light dims from wherever the card or the beat left it)
      this.beatDone = prev === 'beat';   // (played, or skipped part-way: the lens is on the closing shot)
      this.card?.hide();
      // after a beat: its closing shot faces him (or he has turned), and a blend back would swing the lens
      // through him: a cut back to play, and a short hand-back; 'fit' was shot from behind him, it blends
      // (and a cramped closing shot, moved by the room, cuts too: a blend from it swung through the wall and off him,
      //  the Givers' guard ending on an empty corner: issue #293)
      const beatOut = this.beatDone ? (this.beat === 'fit' && !this.cramped ? { blend: 0.9, time: 1.0 } : { blend: 0, time: 0.5 }) : { blend: 1.2, time: OUT_TIME };
      this.outTime = beatOut.time;
      this.cam?.release?.(beatOut.blend);
      if (!this.granted) { this.granted = true; this.onGrant?.(); }
      this.from = this.model.position.clone();
      this.model.visible = false; this.sparkles.visible = false;   // (granted: where it lives now, no copy flying off and shrinking)
      if (!this.acted) s?.chime?.();
    }
  }

  /** Esc / skip: straight to the card (on the card: go on, past the beat; in the beat: end it). */
  skip() {
    if (this.done) return;
    if (this.phase === 'card') return this.dismiss(true);
    if (this.phase === 'beat') return this.enter('out');
    if (this.phase === 'out') return;
    if (!this.fanfared) this.sound?.fanfare?.();
    this.fanfared = true;
    this.model.visible = true; this.sparkles.visible = true;
    this.lift = 1;
    this.box.parts?.setOpen?.(1);
    this.model.position.copy(this.handAt());
    this.enter('card');
    this.cardT = CARD_MIN;   // (a skip already pressed: the next press dismisses)
  }

  /** E / click on the card: on to the closing beat. force (a skip): no minimum time, and past the beat. */
  dismiss(force = false) {
    if (this.phase !== 'card') return false;
    if (!force && this.cardT < CARD_MIN) return false;
    this.enter(force || this.beat === 'none' ? 'out' : 'beat');
    return true;
  }

  /**
   * The 'point' beat's turn (rad, + to his right): toward the nearest unopened box (pointAt(), from
   * index.js), at most ~70° (the shot turns with him); straight ahead with none left.
   */
  pointAngle() {
    const at = this.pointAt?.();
    if (!at) return 0;
    const me = this.P(0, 0, STAND_AT), dx = at.x - me.x, dz = at.z - me.z;
    const lx = dx * this.S.x + dz * this.S.z, lz = dx * this.F.x + dz * this.F.z;
    if (Math.hypot(lx, lz) < 1) return 0;
    return THREE.MathUtils.clamp(Math.atan2(lx, -lz), -1.2, 1.2);
  }

  /** A point near the traveller (x his right, y up from his feet, z behind him), turned with him; box-local [x, y, z]. */
  near(x, y, z) {
    const c = Math.cos(this.turn ?? 0), s = Math.sin(this.turn ?? 0);
    return [x * c - z * s, y + (this.ground - this.box.pos.y), STAND_AT + x * s + z * c];
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
    const T = this.times ?? TIMES, ph = this.phase, WS = this.wobbles ?? WOBBLES;
    if (ph === 'card') this.cardT += dt;
    if (T[ph] !== undefined && this.t >= T[ph]) this.enter(ORDER[ORDER.indexOf(ph) + 1]);
    const at = ORDER.indexOf(this.phase), t = this.t;
    const B = this.box, parts = B.parts, root = parts.root;
    const after = (p) => at > ORDER.indexOf(p);
    const time = (this.clock = (this.clock ?? 0) + dt);
    // ---- the box: a shudder, the float, the slow turn, the wobbles, then it comes apart
    let shake = 0;
    if (this.phase === 'wake') shake = smooth(t / T.wake) * (0.6 + 0.4 * Math.sin(t * 9) ** 2);
    if (this.phase === 'rise') this.lift = easeOut(t / T.rise);
    else if (after('rise')) this.lift = 1;
    const lift = this.lift ?? 0;
    // the wobbles (like a caught thing deciding): a rock about its heart, a knock, a ray of light across it
    let lean = 0, pitch = 0, wob = -1;
    if (this.phase === 'wobble') {
      WS.forEach((w, i) => {
        const u = t - w.at;
        if (u >= 0 && u <= w.dur) { lean = wobbleAngle(w, u); pitch = 0.25 * wobbleAngle(w, u - 0.04); wob = i; }
        if (u >= 0 && this.wobbled <= i) { this.wobbled = i + 1; this.sound?.boxWobble?.(i); }
      });
    }
    this.lean = lean;
    const A = parts?.mats?.body?.uniforms?.uBoxA?.value;
    if (root) {
      // on the ground where it stands (issue #223: it floated up until then), shuddering as it wakes, rocking on its foot
      const roll = ROCK * lean, tip = ROCK * pitch * 0.5;
      const yaw = B.yaw + Math.sin(t * 31) * 0.03 * shake;
      _q.setFromEuler(_e.set(Math.sin(t * 47) * 0.02 * shake + tip, yaw, Math.sin(t * 53) * 0.02 * shake + roll, 'YXZ'));
      root.quaternion.copy(_q);
      // (it rocks on the edge of its foot that stays down, so it never sinks into the ground: the pivot is that edge)
      const half = ((this.box.parts?.size?.w ?? BOX.w) / 2) * BOX_SCALE * 0.8;
      const px = roll > 0 ? -half : half;
      _c.set(px, 0, 0).applyQuaternion(_q);
      _d.set(px, 0, 0).applyQuaternion(_q2.setFromAxisAngle(_Y, yaw));
      root.position.set(B.pos.x + _d.x, B.pos.y + LIFT * lift, B.pos.z + _d.z).sub(_c);
      // a little squash on each knock
      const knock = wob >= 0 ? Math.max(0, 1 - (t - WS[wob].at) / 0.12) : 0;
      root.scale.set(BOX_SCALE * (1 + 0.04 * knock), BOX_SCALE * (1 - 0.05 * knock), BOX_SCALE * (1 + 0.04 * knock));
    }
    if (this.phase === 'dissolve') {
      // it parts like petals, then comes apart into light
      const u = t / T.dissolve;
      parts.setOpen?.(Math.min(1, u / OPENING.open));
    }
    this.lightFrame(time, T);
    // ---- light: the marks brighten, then it pours out as it comes apart
    const pour = this.phase === 'wake' ? 0.3 * smooth(t / T.wake) : this.phase === 'rise' ? 0.3 + 0.2 * smooth(t / T.rise)
      : this.phase === 'wobble' ? 0.5 + 0.25 * Math.abs(lean) / 0.29 : this.phase === 'dissolve' ? 0.5 + 0.5 * easeOut(t / 0.6)
      : this.phase === 'beat' ? 1 - 0.35 * smooth(t / T.beat) : this.phase === 'out' ? (this.acted ? 0.65 : 1) * (1 - smooth(t / (this.outTime ?? OUT_TIME))) : after('dissolve') ? 1 : 0;
    B.sceneLight = pour;
    // ---- the ray across it: racing as it wakes and rises; one pass with each wobble; then bright
    if (A) {
      if (this.phase === 'wobble') {
        // each wobble sends one pass across it (the clock set so the pass starts with the knock)
        const w = wob >= 0 ? WS[wob] : null;
        if (w) A.w = this.rayBase + wob + 0.7 * Math.min(1, (t - w.at) / (w.dur * 0.9));
        else A.w = this.rayBase + this.wobbled - 1 + 0.85;   // (a rest: the ray has crossed, its trail fading)
        A.x = 1;
      } else if (!after('wobble')) { A.w += dt / (this.phase === 'approach' ? 2 : 0.9); A.x = 0.8 + 0.2 * pour; }
      A.y = this.phase === 'wobble' ? 0.75 + 0.25 * Math.abs(lean) / 0.29 : 0.6 + 0.4 * pour;
      // (over 1 while its light is out: the linings, the lid's underside and the inside of it, glow with it)
      if (this.lightK > 0) A.y = Math.max(A.y, 1 + LINING_GLOW * this.lightK);
    }
    // ---- its lamp: the local light that lights his face and the ground round it (main.js updateLights), swelling with
    // its light; before it opens a little, as light leaks at its seam
    if (B.light) chestLamp(B.light, this.mouth(_m), Math.min(1, pour), this.lightK);
    // ---- the item: grows out of the light inside the chest, rises clear of its rim, then comes to his open hand
    if (this.model.visible) {
      if (this.phase === 'dissolve') {
        const k = smooth((t / T.dissolve - OPENING.grow) / OPENING.growFor);
        this.model.position.lerpVectors(this.P(0, this.H * BOX_SCALE * 0.5, 0, _p), this.overRim(), smooth((t / T.dissolve - OPENING.grow) / (1 - OPENING.grow)));
        this.model.scale.setScalar(ITEM_SCALE * Math.max(1e-3, k));
      } else if (this.phase === 'reveal') {
        // over to him in a little arc, smaller, to float over the palm he holds out
        const k = smooth(t / (T.reveal * 0.85));
        this.model.position.lerpVectors(this.revealFrom ?? this.overRim(), this.handAt(), k);
        this.model.position.y += Math.sin(Math.PI * k) * 0.18;
        this.model.scale.setScalar(ITEM_SCALE * (1 + (HAND.scale - 1) * k));
      } else if (this.phase === 'card') {
        this.model.position.copy(this.handAt());
        this.model.scale.setScalar(ITEM_SCALE * HAND.scale);
      }
      tickItem(this.model, this.fluid, { time, fill: this.fill });   // (its fluid's clock, each of its own kind: the blade, the guard's)
    }
    this.offerFrame(t, T);
    if (this.phase === 'beat') this.beatFrame(t, time);
    else if (this.model.visible) {
      this.model.position.y += Math.sin(time * 2.2) * (this.phase === 'card' || this.phase === 'reveal' ? 0.015 : 0.04);
      this.model.rotation.set(0.15 * Math.sin(time * 0.9), time * 1.1, 0);
      // sparkles orbit and twinkle
      const sp = this.sparkles;
      sp.visible = this.model.visible && this.phase !== 'out';
      sp.position.copy(this.model.position);
      sp.scale.setScalar(ITEM_SCALE * (this.phase === 'card' ? HAND.scale : 1));
      for (const s of sp.children) {
        const u = s.userData, ang = u.a + time * u.sp;
        s.position.set(Math.cos(ang) * u.r, u.y * 0.35 + Math.sin(time * 1.3 + u.ph) * 0.05, Math.sin(ang) * u.r);
        s.scale.setScalar(Math.max(1e-3, Math.pow(Math.max(0, Math.sin(time * 3.1 + u.ph)), 3) * 1.6));
      }
    }
    // ---- the camera
    this.camera(dt, time);
    if (this.phase === 'out' && this.t >= (this.outTime ?? OUT_TIME)) this.end();
  }

  camera(dt, time) {
    const cam = this.cam;
    if (!cam?.shot || this.phase === 'out') return;
    const at = ORDER.indexOf(this.phase);
    let pos, look, fov;
    const plan = BOX_PLANS[this.plan] ?? BOX_PLANS.shoulder;
    if (this.phase === 'beat') {
      // the beat's closing shot, in the plan (beats.js closingShot), turned with him for 'point'; a slow push
      const T = this.times.beat, t = this.t, sh = closingShot(this.beat, this.plan, 0);
      // (the finder: from the side away from his turn, whatever the plan's side)
      if (this.beat === 'point' && Math.sign(sh.pos[0]) !== (this.pointTurn < 0 ? 1 : -1)) { sh.pos[0] = -sh.pos[0]; sh.look[0] = -sh.look[0]; }
      const toNear = (v) => { const r = this.near(v[0], v[1], v[2]); return this.P(r[0], r[1], r[2]); };
      look = toNear(sh.look);
      pos = toNear(sh.pos);
      pos.lerp(look, 0.06 * smooth(t / T));
      fov = sh.fov;
      // moved on from the card's shot where the two are near, else a cut (the card's press is the edit)
      const b = smooth(t / 0.5);
      this.beatBlend = this.beatCamFrom.lengthSq() > 0 && this.beatCamFrom.distanceTo(pos) < 2.2;
      if (b < 1 && this.beatBlend) {
        pos.lerpVectors(this.beatCamFrom, pos, b);
        fov = this.beatFovFrom + (fov - this.beatFovFrom) * b;
      }
    } else if (at < ORDER.indexOf('reveal')) {
      // A (the plan's): tilting up as the box rises and pushing in
      const since = this.phaseStart('approach') ?? 0;
      const k = 1 - 0.18 * smooth(since / 4.4), lift = this.lift ?? 0;
      pos = this.P(...plan.A(k, lift));
      look = this.heart(lift).add(_d.set(0, -0.15, 0));
      fov = plan.fovA;
    } else {
      // B: closer: the item hanging where the box was, the rays fanning out behind it
      const since = this.phaseStart('reveal') ?? 0;
      const k = 1 - 0.12 * smooth(since / 5);
      pos = this.P(...plan.B(k));
      // (between the item over his hand and the open chest: both in the shot)
      look = this.handAt(_lk).lerp(this.heart(1), 0.3);
      fov = plan.fovB;
      // moved on from where A ended, not cut, where the two are near (a metre apart, a cut read as the
      // camera jumping: the cinematics QC pass); a plan whose B is elsewhere ('side') cuts to it
      const b = smooth(since / PUSH_IN), from = this.P(...plan.A(1 - 0.18, 1));
      if (b < 1 && from.distanceTo(pos) < 2.2) {
        pos.lerpVectors(from, pos, b);
        look.y -= 0.15 * (1 - b);
        fov = plan.fovA + (plan.fovB - plan.fovA) * b;
      }
    }
    // a tall phone screen: widen the lens so the traveller, the box and the item still fit across
    const aspect = typeof innerWidth === 'number' && innerHeight > 0 ? innerWidth / innerHeight : 1.6;
    fov = Math.min(80, Math.max(fov, THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(27)) / aspect))));
    if (aspect < 1) { pos.lerp(look, -0.12); look.y -= 0.6; }   // and step back, aiming low so the subject sits above the card
    // keep out of walls, roofs and dunes, and keep him in the closing shot (issues #292, #293)
    if (this.physics) this.clearLens(pos, dt, this.phase === 'beat' && this.t <= dt * 1.5 && !this.beatBlend);
    if (this.phase === 'beat') look = this.keepHead(pos, look, fov, aspect);
    // a breath of handheld drift
    pos.x += Math.sin(time * 0.7) * 0.012; pos.y += Math.sin(time * 0.9) * 0.01;
    this.camPos.copy(pos); this.camFov = fov;
    cam.shot({ pos, look, fov });
  }

  /**
   * The lens out of the way of the room (issues #292, #293), in place. Seen from his chest (which stands clear in
   * front of the box): where a wall, a roof or a gate stands between him and the lens, the lens comes in to just short
   * of it; where that would bring it nearer him than LENS_NEAR, it swings round him (about his upright, the aim kept)
   * to the nearest side where the room is clear, eased there (a cut, `snap`, takes it at once). Then it is lifted
   * off the floor under it, never past a roof over it. Until then the lens was pulled to max(0.9, hit - 0.25): behind
   * any wall nearer than 1.15 m (the yards' alcoves: a blank frame), and a ground probe from 2 m over the lens found
   * the alcove's roof and lifted the lens onto it.
   */
  clearLens(pos, dt = 0, snap = false) {
    const ph = this.physics, from = this.P(0, 1.3, STAND_AT, _cf);
    const off = _of.subVectors(pos, from), d = off.length();
    if (!(d > 1e-3)) return pos;
    const reach = (a) => {
      const c = Math.cos(a), s = Math.sin(a);
      _ld.set(off.x * c + off.z * s, off.y, -off.x * s + off.z * c).divideScalar(d);
      return Math.min(d, ph.rayDistance(from, _ld, d + LENS_GAP) - LENS_GAP);
    };
    // the swing it wants: none if the lens stands clear enough; else the one it has if that still does; else the nearest that does
    const enough = Math.min(d, LENS_NEAR);
    let want = this.swingWant ?? 0;
    if (reach(0) >= enough) want = 0;
    else if (reach(want) < enough) {
      let best = 0, bestReach = -Infinity;
      for (let i = 1; i <= SWINGS && bestReach < enough; i++) {
        for (const a of [i * SWING_STEP, -i * SWING_STEP]) {
          const r = reach(a);
          if (r > bestReach + 0.05) { best = a; bestReach = r; }
        }
      }
      if (bestReach > reach(0) + 0.05) want = best;
      else want = 0;
    }
    this.swingWant = want;
    this.swing = snap || this.swing === undefined ? want : this.swing + (want - this.swing) * (1 - Math.exp(-SWING_RATE * dt));
    // the lens at the swing, brought in to just short of whatever stands between him and it (never past it)
    const c = Math.cos(this.swing), s = Math.sin(this.swing);
    const dir = _ld.set(off.x * c + off.z * s, off.y, -off.x * s + off.z * c).divideScalar(d);
    const hit = ph.rayDistance(from, dir, d + LENS_GAP);
    const far = hit < d + LENS_GAP ? Math.max(Math.min(d, hit - LENS_GAP), Math.min(0.35, hit * 0.5)) : d;
    pos.copy(from).addScaledVector(dir, far);
    this.cramped = Math.abs(this.swing) > 0.05 || far < d - 0.05;   // (the room moved it: no blend out from here)
    // off the floor under it: probed from as high over the lens as stands clear (at most 2 m: under a roof, the floor)
    const up = Math.min(2, ph.rayDistance(pos, _Y, 2) - 0.05);
    const g = ph.groundAt(pos.x, pos.y + Math.max(0, up), pos.z, 6);
    if (Number.isFinite(g) && pos.y < g + 0.35) pos.y = Math.min(g + 0.35, pos.y + Math.max(0, up));
    return pos;
  }

  /**
   * The closing shot's aim, turned toward his head where the lens (pulled in by a wall, swung round him) would leave it
   * outside the frame's middle (HEAD_FRAME: shares of the half-frame, across and up; issue #293: the guard's ended on an
   * empty corner, the lift valve's on the lid against the wall). Unchanged where his head is already in.
   */
  keepHead(pos, look, fov, aspect = 16 / 9) {
    const head = this.P(...this.near(0, 1.62, 0), _m);
    const ty = Math.tan(THREE.MathUtils.degToRad(fov) / 2), tx = ty * aspect;
    const inside = (aim) => {
      const f = _d.subVectors(aim, pos).normalize();
      const right = _rt.crossVectors(f, _Y).normalize(), upv = _uv.crossVectors(right, f);
      const h = _hd.subVectors(head, pos), z = h.dot(f);
      if (z <= 0.05) return false;
      return Math.abs(h.dot(right) / z) <= HEAD_FRAME.x * tx && Math.abs(h.dot(upv) / z) <= HEAD_FRAME.y * ty;
    };
    if (pos.distanceTo(head) < 0.3 || inside(look)) return look;
    // the least turn toward his head (at his head's own distance along the aim) that brings it in
    const to = _to.copy(head);
    let lo = 0, hi = 1;
    for (let i = 0; i < 12; i++) { const m = (lo + hi) / 2; if (inside(_ai.lerpVectors(look, to, m))) hi = m; else lo = m; }
    return look.clone().lerp(to, hi);
  }

  /** The open chest's mouth (world): its middle at the height its halves part (the band; the temple chest's foot). */
  mouth(out = new THREE.Vector3()) { return this.P(0, this.H * BOX_SCALE * MOUTHS[this.box.parts?.kind === 'temple' ? 'temple' : 'makers'].y, 0, out); }

  /**
   * The light out of it (light.js, issue #285): none until it opens, swelling as its halves part, settling as the item
   * rises, held through the card, dimming in the beat, gone as the scene hands back (chestLightK).
   */
  lightFrame(time, T) {
    const L = this.light;
    if (!L) return;
    const k = (this.lightK = chestLightK(this.phase, this.t, T, { open: OPENING.open, from: this.lightFrom ?? 0, outTime: this.outTime ?? OUT_TIME }));
    if (this.phase !== 'approach') L.warm = false;
    L.update({ mouth: this.mouth(_m), yaw: this.box.yaw, k, time, eye: this.camPos.lengthSq() > 0 ? this.camPos : null, scale: BOX_SCALE });
    if (L.warm) L.visible = true;   // (drawn at nothing for the first moments: its program compiled before it is needed)
  }

  /** Just clear of the open chest's rim, over its middle: where the item has risen to as it opens. */
  overRim(out = new THREE.Vector3()) { return this.P(0, this.H * BOX_SCALE + 0.3, 0, out); }

  /** Where his open hand is held out to (world): HAND.at, before him on his right. */
  handTarget(out = new THREE.Vector3()) { const r = this.near(...HAND.at); return this.P(r[0], r[1], r[2], out); }

  /** Where the item floats over his open hand: over his palm as posed, else over where it is held out to. */
  handAt(out = new THREE.Vector3()) {
    const hand = this.player?.humanoid?.b?.hand_r;
    if (hand && this.player.object?.visible !== false && (this.offerK ?? 0) > 0.5) {
      hand.getWorldPosition(out);
      // (the palm's middle, a little out along the fingers from the wrist: toward where the hand is held out)
      const tg = this.handTarget(_p);
      out.lerp(tg, 0.35);
    } else this.handTarget(out);
    return out.add(_d.set(0, HAND.above, 0));
  }

  /**
   * His right hand, held out palm up for the item (Player.offer: src/player.js poses the arm, src/hands.js opens the
   * hand): up through the reveal, held through the card, let go as the closing beat takes the item.
   */
  offerFrame(t, T) {
    const P = this.player;
    if (!P) return;
    const ph = this.phase;
    const k = ph === 'reveal' ? smooth(t / (T.reveal * 0.7)) : ph === 'card' ? 1 : ph === 'beat' ? 1 - smooth(t / 0.45) : 0;
    this.offerK = k;
    if (k <= 0.001) { if (P.offer) P.offer = null; return; }
    P.offer = { k, at: this.handTarget(P.offer?.at ?? new THREE.Vector3()) };
  }

  /** Seconds since a phase began (counting the phases after it), for the camera pushes. */
  phaseStart(name) {
    const i = ORDER.indexOf(name), j = ORDER.indexOf(this.phase);
    if (j < i) return null;
    let s = this.t;
    for (let k = i; k < j; k++) s += (this.times ?? TIMES)[ORDER[k]] ?? 0;
    return s;
  }

  /**
   * The closing beat (beats.js), per frame: the item to his hand (or lapel, lips, shoulder), the act
   * (a spray of light, a turn in the hand, a click on the pack, a thread toward a box, notes rising),
   * then away (pocketed, on the pack, worn). 'point' turns him toward where it points.
   */
  beatFrame(t, time) {
    const name = this.beat, B = BEATS[name], { toHold, toStow } = beatPath(name, t), m = this.model, sp = this.sparkles;
    const P = this.player, s = this.sound;
    // he turns (the finders): eased, the shot and his hands turning with him
    if (this.pointTurn) {
      this.turn = this.pointTurn * smooth((t - 0.3) / 0.65);
      if (P) {
        P.heading = this.heading0 - this.turn;
        if (P.object) P.frame?.quaternion?.(P.heading, P.object.quaternion);
      }
    }
    const hold = this.P(...this.near(...B.hold)), since = t - B.act;
    const stow = B.stow === 'worn' ? hold : this.P(...this.near(...B.stow));
    if (m.visible) {
      m.position.copy(this.beatFrom).lerp(hold, toHold);
      // (on the way from the hover a little arc up, so it reads as handed over, not slid)
      m.position.y += Math.sin(Math.PI * toHold) * 0.12 * (1 - toStow);
      m.position.lerp(stow, toStow);
      const sc = ITEM_SCALE * (1 + (B.scale - 1) * toHold);   // (put away at its own size, then gone: no shrinking to nothing)
      m.scale.setScalar(Math.max(1e-3, sc));
      const face = (this.box.yaw + Math.PI) - this.turn;   // (his heading: the item faces where he does)
      if (name === 'try') {
        // held out and fired once: a kick back along his arm
        const kick = since > 0 ? Math.exp(-since / 0.12) * Math.min(1, since / 0.03) : 0;
        _d.copy(this.F).multiplyScalar(0.08 * kick);
        m.position.add(_d);
        m.rotation.set(-0.25 * kick, face + 0.15 * Math.sin(time * 1.4) * (1 - toHold), 0);
      } else if (name === 'keep') {
        // turned over in his fingers, once round, a tilt as he looks at it
        const k = smooth((t - 0.35) / 0.85);
        m.rotation.set(0.5 * Math.sin(k * Math.PI), face + k * Math.PI * 2, 0.35 * Math.sin(k * Math.PI * 2));
      } else if (name === 'point') {
        m.rotation.set(-0.5 * toHold, face, 0);
      } else {
        m.rotation.set(0.1 * Math.sin(time * 1.3), face + (name === 'fit' ? (1 - toHold) * 2 : 0), 0);
      }
      if (toStow >= 1) m.visible = false;
    }
    // the act, once
    if (!this.acted && since >= 0) {
      this.acted = true;
      if (name === 'try') s?.fluidShoot?.(this.def?.kind === 'mode' ? this.item : 'shoot');
      else if (name === 'wear') s?.boxAnswer?.(1.4);
      else if (name === 'fit') s?.fluidMode?.('shoot');
      else if (name === 'keep') s?.boxAnswer?.(0.6);
      else if (name === 'point') { s?.boxAnswer?.(0.5); this.answerAt = t + 0.7; }
      else if (name === 'play') {
        if (this.item === 'bell') s?.bell?.();
        else s?.tune?.([[587.3, 1], [784, 1], [698.5, 1], [880, 2]], 0.16, 'flute', 0.1);
      }
    }
    if (this.answerAt && t >= this.answerAt) { this.answerAt = 0; s?.boxAnswer?.(0.35); }   // (far off, the box it points to answers)
    // the sparkles: each beat's light
    sp.visible = since > 0 && since < 1.1 || (since <= 0 && m.visible);
    sp.position.copy(m.visible ? m.position : stow);
    sp.scale.setScalar(ITEM_SCALE * 0.6);
    const n = sp.children.length;
    sp.children.forEach((c, i) => {
      const u = c.userData, f = i / n;
      let x = 0, y = 0, z = 0, size = 0;
      if (since <= 0) {
        // gathered close round it, twinkling, while it comes to him
        const a = u.a + time * u.sp * 1.5;
        x = Math.cos(a) * u.r * 0.6; y = u.y * 0.15; z = Math.sin(a) * u.r * 0.6;
        size = Math.pow(Math.max(0, Math.sin(time * 3.1 + u.ph)), 3) * 0.8;
      } else {
        const k = Math.min(1, since / 0.9), fade = Math.max(0, 1 - since / 1.1);
        const lx = (v) => v / (ITEM_SCALE * 0.6);   // (metres to the group's units)
        if (name === 'try' || name === 'point') {
          // a spray ahead of him (a thread for the finder, further and straighter), from the item
          const reach = name === 'point' ? 7 : 2.6, spread = name === 'point' ? 0.04 : 0.35;
          const d = reach * (1 - Math.pow(1 - k, 2)) * (0.55 + 0.45 * ((i * 7) % n) / n);
          const ax = Math.sin(u.a) * spread, ay = Math.cos(u.a * 1.3) * spread * 0.6 + (name === 'point' ? 0.05 : 0.08);
          const fw = this.near(ax, 0, -1); const o = this.near(0, 0, 0);   // his forward, box-local
          const dirx = fw[0] - o[0], dirz = fw[2] - o[2];
          // box-local to world (no translation)
          const wx = this.S.x * dirx + this.F.x * dirz, wz = this.S.z * dirx + this.F.z * dirz;
          x = lx(wx * d); y = lx(ay * d); z = lx(wz * d);
          size = (name === 'point' ? 2.6 : 3) * fade;
        } else if (name === 'play') {
          // notes rising off it, one after another, drifting
          const k2 = THREE.MathUtils.clamp((since - f * 0.6) / 0.7, 0, 1);
          x = lx(Math.sin(u.a) * 0.25 * k2); y = lx(0.55 * k2); z = lx(Math.cos(u.a) * 0.25 * k2);
          size = k2 > 0 && k2 < 1 ? 2.2 * Math.sin(k2 * Math.PI) : 0;
        } else {
          // a ring of light opening round where it went (pinned, pocketed, fitted)
          const r = 0.06 + (name === 'wear' ? 0.12 : 0.3) * easeOut(k);   // (the lapel's close-up: a small one)
          x = lx(Math.cos(u.a) * r); y = lx(u.y * 0.08); z = lx(Math.sin(u.a) * r);
          size = 2 * fade;
        }
      }
      c.position.set(x, y, z);
      c.scale.setScalar(Math.max(1e-3, size));
    });
  }

  end() {
    if (this.done) return;
    this.done = true;
    this.model?.removeFromParent(); this.sparkles?.removeFromParent();
    this.light?.dispose(); this.light = null; this.lightK = 0;   // (its washes out of the pass)
    if (this.box) { this.box.sceneLight = 0; this.box.light?.set(0, -1e5, 0, 0); }
    if (this.player?.offer) this.player.offer = null;
    // (nothing comes apart: it stays where it stood, open, and index.js leaves it so: setSpentLook)
    if (this.cam?.release && this.phase !== 'out') this.cam.release(0.8);
    this.cam?.bars?.(false);
    this.cam?.hud?.(true);
    this.card?.scene(false);
    this.sound?.boxHum?.(0);
    this.onEnd?.();
  }
}
