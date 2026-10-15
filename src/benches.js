import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeMaterial } from './materials.js';
import { registerInteractable, PRIORITY } from './interact.js';
import { page } from './platform.js';
import { BENCHES, BENCH_STYLES } from './benches-data.js';

// Benches (issue #363: "I should be able to sit on the bench and look at a beautiful vista and the camera should
// move to be behind me so I can just ponder and take the view in, and the music should become louder").
// Each world has one to three, at a spot with a long view (src/benches-data.js: where, which way, how it is made).
// Walk up and E (X / □ on a pad) sits the traveller down; the camera eases round behind and above him, looking
// out where the bench looks, him small at the foot of the frame; the HUD fades (body.seated) and the world's
// music swells (Sound.seated). Any move, a jump, B / ○ or E again stands him up, and it all eases back.
//
//   createBenches({ levelId, scene, physics, level, player, sound, rig }) → Benches
//     .list                       [{ i, def, pos (the seat's top centre), face, front, group }]
//     .sitting                    the bench sat on, or null; .k the camera's blend (0 off .. 1 sat)
//     .holds()                    true while the traveller is on a bench: main.js gives him no input
//     .update(dt, input, ePressed)  before the traveller moves: settle, read the stand-up
//     .frameCamera(camera)        after the rig has placed the camera: the seated framing, blended
//     .sit(b) / .stand()          (the interactable and the inputs call these)
//   benchFraming(b, physics)      → { eye, look }: the seated shot of bench b, steeper or shorter where something is behind
//   benchSitPose(c, k)            the seated pose laid over the clip (player.overlay)

export const BENCH = {
  range: 2.4,          // m from the seat's front: the prompt shows
  seat: 0.46,          // m: the seat's top over the ground
  length: 2.1,         // m along the seat
  depth: 0.52,         // m front to back
  settle: 0.7,         // s to slide onto the seat and turn to the view
  easeIn: 2.0,         // s for the camera to come round behind and above (an arc round him)
  easeOut: 1.5,        // s back to the follow camera
  minSit: 0.9,         // s seated before a push of the stick stands him up (the push that walked him up)
  stepOff: 0.25,       // s to step forward off the seat as he stands (while the press that stood him up is held back)
  stick: 0.35,         // how far the stick must go to stand up
  hud: 0.35,           // s after sitting down the HUD fades (body.seated)
  // the seated shot: behind the bench, above it, looking out over him at the view
  cam: { back: 7.5, up: 3.0, ahead: 60, lookUp: 1.6, sway: 0.12, near: 2.4 },   // (the game's own lens: the rig's fov is kept)
};

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const UP = V(0, 1, 0);
const smooth = (t) => { t = THREE.MathUtils.clamp(t, 0, 1); return t * t * (3 - 2 * t); };
const lerp = THREE.MathUtils.lerp;
const clean = (g) => { g = g.index ? g.toNonIndexed() : g; for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k); g.computeVertexNormals(); return g; };
const box = (w, h, d, x, y, z) => clean(new THREE.BoxGeometry(w, h, d).translate(x, y, z));

/**
 * A bench's geometry, its front to +z (the way the one sitting looks), its seat's top BENCH.seat over y 0:
 * { parts: { [material key]: [geometries] }, back } (back: the backrest's height, 0 without one).
 *  - 'slab'     a stone slab on two blocks (the desert, Vael, the Glass Dunes, the Garden, the Eclipse)
 *  - 'plank'    three planks on two posts each side, a backrest of two planks (the wood worlds)
 *  - 'machined' a moulded seat on two bent hoops, a thin rail behind (the machine and the city worlds)
 */
export function benchGeometry(kind = 'slab', { length = BENCH.length, depth = BENCH.depth, seat = BENCH.seat } = {}) {
  const L = length, D = depth, S = seat, parts = { main: [], trim: [] };
  let back = 0;
  if (kind === 'plank') {
    const t = 0.05, gap = 0.025, w = (D - 2 * gap) / 3;
    for (let k = 0; k < 3; k++) parts.main.push(box(L, t, w, 0, S - t / 2, -D / 2 + w / 2 + k * (w + gap)));
    for (const x of [-L / 2 + 0.22, L / 2 - 0.22]) {
      parts.trim.push(box(0.08, S - t, 0.08, x, (S - t) / 2, D / 2 - 0.08));          // the front leg
      parts.trim.push(box(0.08, S + 0.42, 0.08, x, (S + 0.42) / 2, -D / 2 + 0.06));    // the back leg, up into the backrest
      parts.trim.push(box(0.07, 0.06, D - 0.06, x, S - t - 0.05, 0));                  // the rail under the seat
    }
    for (const y of [S + 0.16, S + 0.34]) parts.main.push(box(L, 0.1, 0.035, 0, y, -D / 2 + 0.035));
    back = S + 0.42;
  } else if (kind === 'machined') {
    const t = 0.07;
    // the seat, its front edge rolled down: a slab and a half-round lip
    parts.main.push(box(L, t, D - 0.06, 0, S - t / 2, -0.03));
    parts.main.push(clean(new THREE.CylinderGeometry(t / 2 + 0.01, t / 2 + 0.01, L, 10, 1).rotateZ(Math.PI / 2).translate(0, S - t / 2 - 0.005, D / 2 - 0.06)));
    // two hoops, the legs: bent tube from the floor up under the seat and back down
    for (const x of [-L / 2 + 0.3, L / 2 - 0.3]) {
      parts.trim.push(clean(new THREE.TorusGeometry((D - 0.12) / 2, 0.03, 6, 14, Math.PI).rotateY(Math.PI / 2).scale(1, (S - t) / ((D - 0.12) / 2), 1).translate(x, 0, -0.03)));
      parts.trim.push(box(0.05, 0.03, D - 0.1, x, 0.015, -0.03));   // its foot along the floor
    }
    // a thin back rail on two posts
    for (const x of [-L / 2 + 0.3, L / 2 - 0.3]) parts.trim.push(box(0.04, 0.4, 0.04, x, S + 0.2, -D / 2 + 0.05));
    parts.main.push(box(L - 0.2, 0.07, 0.05, 0, S + 0.38, -D / 2 + 0.05));
    back = S + 0.42;
  } else {
    // a stone slab, a hand thick, on two blocks set in from its ends
    const t = 0.16;
    parts.main.push(box(L, t, D, 0, S - t / 2, 0));
    for (const x of [-L / 2 + 0.32, L / 2 - 0.32]) parts.trim.push(box(0.34, S - t, D - 0.1, x, (S - t) / 2, 0));
  }
  return { parts, back };
}

/** The seated pose, laid over the clip (player.overlay): on a seat BENCH.seat high, his feet on the ground before it. k 0..1. */
export function benchSitPose(c, k, t = 0) {
  if (!c || k <= 0.001) return;
  const L = (o, axis, v) => { o.rotation[axis] = lerp(o.rotation[axis], v, k); };
  for (const i of [0, 1]) {
    L(c.legs[i], 'x', -1.48); L(c.legs[i], 'y', 0); L(c.legs[i], 'z', (i ? 1 : -1) * 0.06);
    L(c.knees[i], 'x', 1.5); L(c.feet[i], 'x', 0.02);
    // the hands on the thighs, the elbows soft
    L(c.arms[i], 'x', -0.62); L(c.arms[i], 'z', (i ? 1 : -1) * 0.14); L(c.elbows[i], 'x', -0.85);
  }
  // (he stands on the seat's top, as a seated person does on theirs, src/npc.js: the hips drop to it)
  c.body.position.y = lerp(c.body.position.y, -0.9, k);
  c.body.position.z = lerp(c.body.position.z, -0.06, k);
  c.body.rotation.x = lerp(c.body.rotation.x, 0, k);
  // leaning a little forward over his knees, breathing slowly, his head up to the view
  L(c.torso, 'x', 0.14 + Math.sin(t * 1.3) * 0.015);
  L(c.head, 'x', -0.1);
}

/**
 * Where bench `b` is sat from: the camera behind the bench and above it, looking out the way it faces, over his
 * head, him small in the lower part of the frame. Something solid behind (a wall, a rock) pulls it in, never under
 * BENCH.cam.near from his head.
 */
export function benchFraming(b, physics = null, C = BENCH.cam) {
  const f = b.front, head = b.pos.clone().addScaledVector(UP, 0.85);
  const ground = physics?.base?.heightAt ? (x, z) => physics.base.heightAt(x, z) : null;
  // the arm: behind and above; where something solid is behind (a wall, a trunk) a steeper, shorter one over him,
  // and failing those the first one pulled in short of what it meets
  let eye = null, first = null;
  for (const [back, up] of [[C.back, C.up], [C.back * 0.7, C.up * 1.3], [C.back * 0.45, C.up * 1.6]]) {
    const want = b.pos.clone().addScaledVector(f, -back).addScaledVector(UP, up);
    const to = want.clone().sub(head), L = to.length();
    to.divideScalar(L);
    const hit = physics?.rayDistance?.(head, to, L + 0.6) ?? Infinity;
    const under = ground && want.y < ground(want.x, want.z) + 0.8;
    if (!(hit < L + 0.6) && !under) { eye = want; break; }
    first ??= head.clone().addScaledVector(to, Math.max(Math.min(C.near, hit - 0.3), hit - 0.6));
  }
  eye ??= first;
  if (ground) eye.y = Math.max(eye.y, ground(eye.x, eye.z) + 0.8);
  const look = b.look ? b.look.clone() : b.pos.clone().addScaledVector(f, C.ahead).addScaledVector(UP, C.lookUp);
  // (a far look the bench names, as a landmark, is aimed at; the near look keeps him low in the frame either way)
  if (b.look) { const dir = look.clone().sub(eye).normalize(); look.copy(eye).addScaledVector(dir, C.ahead); }
  return { eye, look };
}

/** The world's benches: built where src/benches-data.js puts them, each on its ground, solid, with its seat to sit on. */
export function createBenches({ levelId, scene = null, physics = null, level = null, player = null, sound = null, rig = null, defs = BENCHES[levelId] ?? [] } = {}) {
  const style = { ...BENCH_STYLES.default, ...(BENCH_STYLES[levelId] ?? {}) };
  const mats = {
    main: makeMaterial({ color: style.main, flat: true, ...(style.metal ? { metal: style.metal } : {}) }),
    trim: makeMaterial({ color: style.trim ?? style.main, flat: true, ...(style.trimMetal ? { metal: style.trimMetal } : {}) }),
  };
  const list = defs.map((def, i) => {
    const [x, y0, z] = def.at;
    const seat = BENCH.seat;
    // (on the ground there: the ground under the spot written down, within a metre of it)
    const g = physics?.groundAt?.(x, y0 + 1.5, z, 4);
    const y = Number.isFinite(g) && Math.abs(g - y0) < 1 ? g : y0;
    const face = def.face, front = V(Math.sin(face), 0, Math.cos(face));
    const kind = def.kind ?? style.kind;
    const { parts, back } = benchGeometry(kind, { seat });
    const group = new THREE.Group();
    group.name = `bench.${levelId}.${i}`;
    group.position.set(x, y, z);
    group.rotation.y = face;
    for (const [k, geos] of Object.entries(parts)) if (geos.length) group.add(new THREE.Mesh(mergeGeometries(geos), mats[k]));
    scene?.add(group);
    const pos = V(x, y + seat, z);
    const look = def.look ? V(...def.look) : null;
    return { i, def, ground: y, seat, pos, face, front, kind, back, group, look, collider: null };
  });
  // solid: the seat and its legs stopped by and stood on (a seat under the step is stepped onto, as a kerb is)
  if (physics?.addCollider) for (const b of list) { b.group.updateMatrixWorld(true); b.collider = physics.addCollider(b.group, { noClimb: true }); }

  const B = {
    list, sitting: null, k: 0, t: 0, clock: 0, standing: false, shot: null,
    // (and a moment after he stands: the press that stood him up neither jumps nor dodges nor whistles)
    holds() { return !!this.sitting && (!this.standing || (!this._free && this.t < BENCH.stepOff)); },
    /** What the traveller is given of this frame's input: all of it, or while he sits only E held (so a press held on from
     *  sitting or standing never comes through as a fresh one: the mount's whistle). */
    inputFor(input = {}) { return this.holds() ? (input.KeyE ? { KeyE: true } : {}) : input; },
    /** The seat's front edge (where you walk up to it). */
    frontOf(b) { return b.pos.clone().setY(b.ground).addScaledVector(b.front, BENCH.depth / 2 + 0.35); },
    sit(b) {
      if (!player || this.sitting) return false;
      this.sitting = b; this.standing = false; this.t = 0; this._hudOn = false; this._free = false;
      this.from = player.pos.clone(); this.fromHeading = player.heading;
      player.vel?.set?.(0, 0, 0);
      this.shot = benchFraming(b, physics);
      player.overlay = (p) => benchSitPose(p.char, smooth(this.pose ?? 0), this.t);
      this.pose = 0;
      sound?.seated?.(true);
      return true;
    },
    /** Up again (abrupt: knocked off it, the pose gone and his body his own at once; the camera still eases back). */
    stand(abrupt = false) {
      if (!this.sitting || this.standing) return;
      this.standing = true; this.t = 0; this._free = abrupt;
      sound?.seated?.(false);
      page.bodyClass('seated', false); this._hudOn = false;
      // (the follow camera turned behind him the way he faces while the seated shot hides it, so the way back is short)
      if (rig && !abrupt && this.k > 0.98) rig.yaw = this.sitting.face + Math.PI;
      if (abrupt && player) {
        this.pose = 0;
        if (player.overlay) player.overlay = null;
        player.char?.body?.position.set(0, 0, 0);
      }
    },
    /** True if this frame's input asks to stand: a move, a jump, B / ○ (evade), or E again. */
    wantsUp(input = {}, ePressed = false) {
      const s = input.stick, stick = s ? Math.hypot(s.x || 0, s.y || 0) : 0;
      const keys = input.KeyW || input.KeyA || input.KeyS || input.KeyD || input.ArrowUp || input.ArrowDown || input.ArrowLeft || input.ArrowRight;
      return !!(ePressed || input.PadEvade || input.Space || input.AltLeft || keys || stick > BENCH.stick);
    },
    update(dt, input = {}, ePressed = false) {
      const b = this.sitting;
      if (!b || !player) return;
      this.t += dt; this.clock += dt;
      if (ePressed) player._eHeld = true;   // (a press while he sits is the bench's: never the whistle)
      // knocked down, riding, swimming, or put somewhere else (a doorway, a respawn): off the bench at once
      const away = this.t > BENCH.settle && Math.hypot(player.pos.x - b.pos.x, player.pos.z - b.pos.z) > 1;
      if (!this.standing && (player.down || player.dead || player.riding || player.swim || away)) this.stand(true);
      if (!this.standing) {
        // slide onto the seat, turn to the view; the pose comes in a moment later
        const s = smooth(this.t / BENCH.settle);
        player.pos.x = lerp(this.from.x, b.pos.x, s); player.pos.z = lerp(this.from.z, b.pos.z, s);
        let dh = b.face - this.fromHeading; dh = Math.atan2(Math.sin(dh), Math.cos(dh));
        player.heading = this.fromHeading + dh * s;
        player.vel?.set?.(0, 0, 0);
        this.pose = Math.min(1, Math.max(0, (this.t - 0.25) / 0.9));
        this.k = smooth(this.t / BENCH.easeIn);
        if (!this._hudOn && this.t > BENCH.hud) { this._hudOn = true; page.bodyClass('seated', true); }
        if ((this.t > BENCH.minSit && this.wantsUp(input, ePressed)) || (ePressed && this.t > 0.3)) this.stand();
      } else {
        // up again: a step forward off the seat onto the ground before it, the pose easing out, the camera coming back,
        // then the overlay goes
        if (!this._free && this.t <= BENCH.stepOff + dt) {
          const s = smooth(this.t / BENCH.stepOff), d = BENCH.depth / 2 + 0.3;
          player.pos.x = b.pos.x + b.front.x * d * s; player.pos.z = b.pos.z + b.front.z * d * s;
          player.vel?.set?.(0, 0, 0);
        }
        const k = 1 - this.t / BENCH.easeOut;
        this.pose = Math.min(this.pose, Math.max(0, 1 - this.t / 0.5));
        this.k = Math.min(this.k, smooth(k));
        if (this.k <= 0.001 && this.pose <= 0.001) {
          this.k = 0; this.pose = 0;
          if (player.overlay) player.overlay = null;
          if (player.char?.body) player.char.body.position.set(0, 0, 0);
          this.sitting = null; this.standing = false; this.shot = null;
        }
      }
    },
    /** After the rig: the seated framing, blended in by k, swung round him on an arc; a slow sway, as if breathing. */
    frameCamera(camera) {
      if (!this.shot || this.k <= 0 || !camera) return;
      const S = this.shot, k = this.k, b = this.sitting, sway = BENCH.cam.sway * Math.sin(this.clock * 0.35);
      const eye = _e.copy(S.eye).addScaledVector(b.front, sway * 0.4).add(_s.set(0, sway * 0.5, 0));
      // (round him on an arc, never through him: the bearing, height and distance from his head eased from the rig's
      //  camera to the seated shot's)
      const head = _h.copy(b.pos).addScaledVector(UP, 0.85);
      const from = _a.copy(camera.position).sub(head), to = _b.copy(eye).sub(head);
      const ra = Math.max(from.length(), 1e-3), rb = Math.max(to.length(), 1e-3);
      const ya = Math.atan2(from.x, from.z), yb = Math.atan2(to.x, to.z);
      const pa = Math.asin(THREE.MathUtils.clamp(from.y / ra, -1, 1)), pb = Math.asin(THREE.MathUtils.clamp(to.y / rb, -1, 1));
      let dy = yb - ya; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      const y = ya + dy * k, p = lerp(pa, pb, k), r = lerp(ra, rb, k);
      _q0.copy(camera.quaternion);
      camera.position.set(head.x + Math.sin(y) * Math.cos(p) * r, head.y + Math.sin(p) * r, head.z + Math.cos(y) * Math.cos(p) * r);
      // (the look: toward him at first, out over the view by the end, turned from the rig's own as it starts)
      _t.copy(head).lerp(S.look, k);
      _m.lookAt(camera.position, _t, UP);
      _q.setFromRotationMatrix(_m);
      camera.quaternion.copy(_q0).slerp(_q, k);
      camera.updateMatrixWorld();
    },
    dispose() {
      for (const off of this._offs) off();
      for (const b of list) { scene?.remove(b.group); if (b.collider) physics?.removeCollider?.(b.collider); }
      if (this.sitting) { page.bodyClass('seated', false); sound?.seated?.(false); if (player) player.overlay = null; }
    },
    _offs: [],
  };
  // walk up to one: E sits (the interact button: X / □ on a pad, printed by the prompt)
  for (const b of list) {
    const front = B.frontOf(b), tag = b.pos.clone().addScaledVector(UP, 0.7);
    B._offs.push(registerInteractable({
      id: `bench.${levelId}.${b.i}`, priority: PRIORITY.use, range: BENCH.range, prompt: 'sit', gesture: null,
      at: () => tag,
      distance: (p) => Math.hypot(p.pos.x - front.x, p.pos.z - front.z) + Math.max(0, Math.abs(p.pos.y - b.ground) - 0.8) * 4,
      enabled: () => !B.sitting && !!player && !player.riding && !player.swim && !player.climbing && player.onGround !== false,
      use: () => B.sit(b),
    }));
  }
  return B;
}
const _e = new THREE.Vector3(), _s = new THREE.Vector3(), _h = new THREE.Vector3(), _a = new THREE.Vector3(), _b = new THREE.Vector3(), _t = new THREE.Vector3();
const _q = new THREE.Quaternion(), _q0 = new THREE.Quaternion(), _m = new THREE.Matrix4();
