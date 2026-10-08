import * as THREE from 'three';
import { inkMat, INK, PAPER, aimRay } from './kit.js';
import { rayWorld } from '../fluid-tool.js';
import { makeMaterial } from '../materials.js';
import { addScreen } from '../wind-screens.js';

// The ink bridge pen (docs/systems/gadgets.md, "The ink bridge pen"): hold the use button and a line of ink
// runs out from your feet the way you aim (sweep the aim and it bends, tip it up and it climbs, never steeper
// than PEN.climb); let go and the line sets into a plank of ink, solid to walk on (and to drive on: it is a
// collider like any other, physics.addCollider), hand-drawn and cross-hatched. It stands PEN.life seconds,
// then wears away from both ends. Aim up steeply as you start and the pen draws a short wall across your
// way instead: it stops foes and bombs, and a temple's gust (src/wind-screens.js). The pen holds PEN.ink
// metres of ink; it flows back while you are not drawing.

export const PEN = {
  ink: 24, refill: 2.5, refillDelay: 0.8,   // m of ink; m/s back; s after drawing before it flows
  max: 16, min: 1.2,                        // m: the longest line; shorter than min is not kept (the ink comes back)
  speed: 11,                                // m/s the line runs out
  seg: 0.5,                                 // m between the line's points
  width: 1.5, thick: 0.2,                   // m: the plank
  climb: 0.49, dive: -0.35, bias: 0.12,     // rad: the steepest ramp up (28°) and down; the aim's tip added
  turn: 1.8,                                // rad/s the line bends at most
  over: 0.45,                               // m: a kerb no higher than this over the line, it runs through
  wallAim: 0.6,                             // rad: aimed up past this as you start, a wall
  wallH: 2.6, wallT: 0.3, wallMax: 7, wallAt: 3, wallCost: 1.4,   // m tall, thick, long; m ahead; ink per m
  life: 12, fade: 2, warn: 2.5, keep: 3,    // s it stands; s to wear away; s of warning; at most this many at once
};

const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _u = new THREE.Vector3(), _q = new THREE.Vector3();
const _Y = new THREE.Vector3(0, 1, 0), _m = new THREE.Matrix4();

// ------------------------------------------------------------------ the maths (pure: tests/recall-bridge.test.js)

/** The line's tip angle from the aim's (radians up): a little lifted, never steeper than the pen allows. */
export const penPitch = (aim, { bias = PEN.bias, climb = PEN.climb, dive = PEN.dive } = {}) => THREE.MathUtils.clamp(aim + bias, dive, climb);

/** A heading turned toward `want` by at most `max` radians. */
export function turnToward(cur, want, max) {
  const d = Math.atan2(Math.sin(want - cur), Math.cos(want - cur));
  return cur + THREE.MathUtils.clamp(d, -max, max);
}

/** The direction of a heading (0: +z) tipped up by `pitch`. */
export const headingDir = (yaw, pitch, out = new THREE.Vector3()) => out.set(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));

/** Ink back after dt: { ink, wait } (it waits `delay` s after drawing, then flows at `rate`). */
export function refillInk(ink, wait, dt, { max = PEN.ink, rate = PEN.refill, delay = PEN.refillDelay } = {}) {
  if (wait > 0) return { ink, wait: Math.max(0, wait - dt) };
  return { ink: Math.min(max, ink + rate * dt), wait: 0 };
}

/**
 * The order the segments wear away in, last first: [middle …, ends]. A plank drawn in this order and
 * cut short by drawRange loses its two ends together, one segment each in turn.
 */
export function fadeOrder(n) {
  return Array.from({ length: n }, (_, i) => i).sort((a, b) => Math.min(b, n - 1 - b) - Math.min(a, n - 1 - a) || a - b);
}

/** Along a path of points: each point's frame { t (along), a (across), b (the plank's up) } with `up`. */
export function pathFrames(points, up = _Y, mode = 'bridge') {
  const n = points.length, out = [];
  for (let i = 0; i < n; i++) {
    const t = new THREE.Vector3().subVectors(points[Math.min(n - 1, i + 1)], points[Math.max(0, i - 1)]);
    if (t.lengthSq() < 1e-10) t.set(0, 0, 1); else t.normalize();
    if (mode === 'wall') {
      // a wall: across it is up, its thickness level
      const flat = t.clone().addScaledVector(up, -t.dot(up)).normalize();
      out.push({ t: flat, a: up.clone(), b: new THREE.Vector3().crossVectors(up, flat).normalize() });
    } else {
      const a = new THREE.Vector3().crossVectors(t, up);
      if (a.lengthSq() < 1e-8) a.set(1, 0, 0); else a.normalize();
      out.push({ t, a, b: new THREE.Vector3().crossVectors(a, t).normalize() });
    }
  }
  return out;
}

/** The shape's extents in its frame: across (a0..a1) and through (b0..b1). */
export const extentsOf = (mode) => (mode === 'wall' ? { a0: -0.45, a1: PEN.wallH, b0: -PEN.wallT / 2, b1: PEN.wallT / 2 } : { a0: -PEN.width / 2, a1: PEN.width / 2, b0: -PEN.thick, b1: 0 });

/** A box per segment (its collision: straight, solid), in `order`, the first `keep` of them, merged. */
export function colliderGeometry(points, frames, ext, order = null, keep = Infinity) {
  const list = (order ?? points.slice(1).map((_, i) => i)).slice(0, keep), parts = [];
  for (const i of list) {
    const p0 = points[i], p1 = points[i + 1];
    const t = _v.subVectors(p1, p0), L = t.length();
    if (L < 1e-4) continue;
    t.divideScalar(L);
    const fa = frames[i].a.clone().add(frames[i + 1].a).normalize(), fb = frames[i].b.clone().add(frames[i + 1].b).normalize();
    // (the frame made square to this segment, right-handed: the box's x along it, y through, z across)
    const B = fb.addScaledVector(t, -fb.dot(t)).normalize(), A = _w.crossVectors(t, B).normalize();
    const sa = Math.sign(A.dot(fa)) || 1;
    const c = _u.copy(p0).add(p1).multiplyScalar(0.5).addScaledVector(B, (ext.b0 + ext.b1) / 2).addScaledVector(A, sa * (ext.a0 + ext.a1) / 2);
    const g = new THREE.BoxGeometry(L + 0.06, ext.b1 - ext.b0, ext.a1 - ext.a0);
    g.applyMatrix4(_m.makeBasis(t, B, A).setPosition(c));
    parts.push(g.toNonIndexed());
  }
  if (!parts.length) return null;
  const pos = [];
  for (const g of parts) pos.push(...g.attributes.position.array);
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  return out;
}

// ------------------------------------------------------------------ the look: a hand-drawn plank

const wob = (i, k, seed) => Math.sin(i * 0.93 + k * 4.1 + seed) * 0.6 + Math.sin(i * 2.37 + k * 1.7 + seed * 1.9) * 0.4;

/**
 * The plank (or wall) as drawn, and its ink strokes, one segment after another: positions per segment
 * contiguous, so a segment is a run of the index. Returns { deck, strokes } BufferGeometries, each with
 * userData.runs [[start, count] per segment] (index ranges).
 */
export function inkGeometry(points, frames, ext, { mode = 'bridge', seed = 1 } = {}) {
  const n = points.length - 1;
  const D = { pos: [], runs: [] }, S = { pos: [], runs: [] };
  const corner = (i, a, b, out = new THREE.Vector3()) => out.copy(points[i]).addScaledVector(frames[i].a, a).addScaledVector(frames[i].b, b);
  // the outward test: a quad's winding turned to face away from the segment's middle
  const quad = (arr, p0, p1, p2, p3, mid) => {
    const nrm = _q.subVectors(p1, p0).cross(_v.subVectors(p2, p0));
    const out = _w.addVectors(p0, p2).multiplyScalar(0.5).sub(mid);
    if (nrm.dot(out) < 0) { const t = p1; p1 = p3; p3 = t; }
    arr.push(p0.x, p0.y, p0.z, p1.x, p1.y, p1.z, p2.x, p2.y, p2.z, p0.x, p0.y, p0.z, p2.x, p2.y, p2.z, p3.x, p3.y, p3.z);
  };
  const W = mode === 'wall' ? 0.035 : 0.03;   // wobble, m
  const C = (i) => {
    const w0 = wob(i, 0, seed) * W, w1 = wob(i, 1, seed) * W, w2 = wob(i, 2, seed) * W;
    return [corner(i, ext.a0 - w0, ext.b1), corner(i, ext.a1 + w1, ext.b1), corner(i, ext.a1 + w1, ext.b0 - w2), corner(i, ext.a0 - w0, ext.b0 - w2)];
  };
  // a stroke: a thin band from u0 to u1 on the face (lifted off it by `lift` along `nrm`), `w` wide
  const stroke = (arr, a, b, nrm, w, mid) => {
    const d = _u.subVectors(b, a), side = new THREE.Vector3().crossVectors(d, nrm).normalize().multiplyScalar(w / 2);
    const lift = nrm.clone().multiplyScalar(0.012);
    const p0 = a.clone().add(side).add(lift), p1 = b.clone().add(side).add(lift), p2 = b.clone().sub(side).add(lift), p3 = a.clone().sub(side).add(lift);
    quad(arr, p0, p1, p2, p3, mid.clone().addScaledVector(nrm, -10));
  };
  const along = [0];
  for (let i = 1; i <= n; i++) along.push(along[i - 1] + points[i].distanceTo(points[i - 1]));
  let prev = C(0);
  for (let i = 0; i < n; i++) {
    const next = C(i + 1), [a0, a1, a2, a3] = prev, [b0, b1, b2, b3] = next;
    const mid = new THREE.Vector3().addVectors(points[i], points[i + 1]).multiplyScalar(0.5)
      .addScaledVector(frames[i].b, (ext.b0 + ext.b1) / 2).addScaledVector(frames[i].a, (ext.a0 + ext.a1) / 2);
    let s0 = D.pos.length / 3;
    quad(D.pos, a0, a1, b1, b0, mid);   // top (b1)
    quad(D.pos, a3, a2, b2, b3, mid);   // under (b0)
    quad(D.pos, a0, b0, b3, a3, mid);   // side a0
    quad(D.pos, a1, b1, b2, a2, mid);   // side a1
    quad(D.pos, a0, a1, a2, a3, mid);   // its ends (closed: a plank wearing away stays a solid)
    quad(D.pos, b0, b1, b2, b3, mid);
    D.runs.push([s0, D.pos.length / 3 - s0]);
    // the ink: along the edges of the top, across at the joints, and hatching down the faces
    s0 = S.pos.length / 3;
    const fb = frames[i].b, fa = frames[i].a, L = points[i].distanceTo(points[i + 1]);
    if (mode === 'wall') {
      // both faces hatched: long diagonals of one hand running on from segment to segment, and the other
      // way across them toward the foot (cross-hatched where the wall meets the ground), a stroke missed here and there
      const H = ext.a1 - ext.a0, sp = 0.3, s0a = along[i], s1a = along[i + 1];
      for (const [face, sgn, p, q, p1, q1] of [[fb, 1, a0, a1, b0, b1], [fb, -1, a3, a2, b3, b2]]) {
        const nrm = face.clone().multiplyScalar(sgn);
        for (const [slope, top] of [[0.9, H - 0.2], [-0.9, H * 0.42]]) {
          for (let j = -40; j < 60; j++) {
            const h0 = j * sp + slope * s0a, h1 = j * sp + slope * s1a;
            if (Math.min(h0, h1) < 0.5 || Math.max(h0, h1) > top || wob(i, j * 3.1 + slope, seed) > 0.72) continue;
            const A = new THREE.Vector3().lerpVectors(p, q, h0 / H), B = new THREE.Vector3().lerpVectors(p1, q1, h1 / H);
            stroke(S.pos, A, B, nrm, 0.016 + 0.006 * Math.abs(wob(j, i, seed)), mid);
          }
        }
      }
      stroke(S.pos, a1, b1, fa, 0.05, mid);   // the wall's top edge, inked
    } else {
      // two pen lines along the top, a little in from its edges, and the joint across
      for (const e of [0.12, 0.88]) {
        const A = new THREE.Vector3().lerpVectors(a0, a1, e + wob(i, e * 7, seed) * 0.015), B = new THREE.Vector3().lerpVectors(b0, b1, e + wob(i + 1, e * 7, seed) * 0.015);
        stroke(S.pos, A, B, fb, 0.035, mid);
      }
      if (i % 2 === 0) stroke(S.pos, new THREE.Vector3().lerpVectors(a0, a1, 0.08), new THREE.Vector3().lerpVectors(a0, a1, 0.92), fb, 0.03, mid);
      // hatching on the top's edges (short diagonals in from each edge) and down both sides
      for (let h = 0; h < 3; h++) {
        const u = (h + 0.5) / 3;
        for (const [e0, e1] of [[0, 0.1], [1, 0.9]]) {
          const A = new THREE.Vector3().lerpVectors(a0, a1, e0).lerp(new THREE.Vector3().lerpVectors(b0, b1, e0), u);
          const B = new THREE.Vector3().lerpVectors(a0, a1, e1).lerp(new THREE.Vector3().lerpVectors(b0, b1, e1), Math.min(1, u + (i % 2 ? 0.25 : -0.25)));
          stroke(S.pos, A, B, fb, 0.022, mid);
        }
        for (const [p, q, r, s, nrm] of [[a0, a3, b0, b3, fa.clone().negate()], [a1, a2, b1, b2, fa]]) {
          const A = new THREE.Vector3().lerpVectors(p, r, u - 0.12), B = new THREE.Vector3().lerpVectors(q, s, u + 0.12);
          stroke(S.pos, A, B, nrm, 0.025, mid);
        }
      }
    }
    S.runs.push([s0, S.pos.length / 3 - s0]);
    prev = next;
  }
  const make = (X) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(X.pos, 3));
    g.computeVertexNormals();
    g.userData.runs = X.runs;
    g.setIndex(Array.from({ length: X.pos.length / 3 }, (_, i) => i));
    return g;
  };
  return { deck: make(D), strokes: make(S) };
}

/** The index of a geometry re-laid in a segment order (the first `keep` of them drawn). */
function layIndex(g, order, keep = order.length) {
  const runs = g.userData.runs, idx = [];
  for (const i of order) { const [s, c] = runs[i]; for (let k = 0; k < c; k++) idx.push(s + k); }
  g.setIndex(idx);
  g.userData.ends = [];
  let acc = 0;
  for (const i of order) { acc += runs[i][1]; g.userData.ends.push(acc); }
  g.setDrawRange(0, keep ? g.userData.ends[Math.min(keep, order.length) - 1] : 0);
  return g;
}
const showFirst = (g, k) => g.setDrawRange(0, k > 0 ? g.userData.ends[Math.min(k, g.userData.ends.length) - 1] : 0);

// ------------------------------------------------------------------ the pen

function penModel() {
  const g = new THREE.Group();
  const lacquer = inkMat('#23305a'), brass = inkMat('#d6a94a', { metal: 'brass' }), nib = inkMat('#e3bd5a', { metal: 'brass' }), ink = inkMat(INK), pale = inkMat(PAPER);
  // along +y: the nib at the bottom (y < 0), the barrel and its cap's end above
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.019, 0.017, 0.17, 14).translate(0, 0.06, 0), lacquer));
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.012, 14).translate(0, 0.15, 0), brass));
  g.add(new THREE.Mesh(new THREE.SphereGeometry(0.019, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2).translate(0, 0.156, 0), lacquer));
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.0195, 0.0195, 0.008, 14).translate(0, -0.02, 0), brass));
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.012, 0.04, 14).translate(0, -0.045, 0), ink));
  // the clip
  g.add(new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.1, 0.008).translate(0, 0.1, 0.022), brass));
  // the nib: a flattened point with its slit and breather hole
  const point = new THREE.ConeGeometry(0.014, 0.06, 14).rotateX(Math.PI).scale(1, 1, 0.4).translate(0, -0.095, 0);
  g.add(new THREE.Mesh(point, nib));
  g.add(new THREE.Mesh(new THREE.BoxGeometry(0.0015, 0.04, 0.008).translate(0, -0.1, 0), ink));
  g.add(new THREE.Mesh(new THREE.SphereGeometry(0.003, 6, 4).translate(0, -0.08, 0.006), pale));
  g.rotation.set(0.25, 0, -0.6);
  return g;
}

/** The pen's sounds (the game's synth): the nib scratching, the ink setting, the plank wearing away. */
const now = (s) => (s?.ctx ? s.ctx.currentTime : null);
export const penSfx = {
  scratch(s) { const t = now(s); if (t == null) return; s.burst(t, { dur: 0.05, type: 'bandpass', freq: 3800 + Math.random() * 900, q: 2.5, vol: 0.035, rate: 1.3 }); },
  set(s) { const t = now(s); if (t == null) return; s.sweep(t, 240, 520, 0.22, 0.07, 'triangle'); s.burst(t, { dur: 0.14, type: 'lowpass', freq: 600, q: 0.9, vol: 0.14, rate: 0.6 }); },
  fade(s) { const t = now(s); if (t == null) return; s.burst(t, { dur: 0.5, type: 'bandpass', freq: 1600, q: 0.7, vol: 0.04, rate: 0.5 }); },
  empty(s) { const t = now(s); if (t == null) return; s.sweep(t, 520, 380, 0.14, 0.05, 'triangle'); },
};

export default {
  id: 'bridge', name: 'Ink bridge pen', glyph: '✒', order: 60,
  text: 'A fountain pen as long as your forearm, its barrel lacquered night blue. What it draws in the air holds for a little while: long enough to walk across.',
  use: 'Hold Y / △ (T, or the middle mouse button): a line of ink runs out from your feet the way you aim; sweep the aim to bend it, tip it up for a ramp. Let go and it sets into a plank you can walk on, up to 16 m long, for twelve seconds before it wears away from the ends. Aim up steeply as you start to draw a short wall instead (it stops foes and gusts). The ink flows back while you are not drawing.',
  model: penModel,
  create(ctx) { return new Pen(ctx); },

  /** Its bay: a tower with steps, an 8 m gap to a second, a ramp's rise to a higher third with a lamp on it. */
  yard(kit) {
    kit.flag('#23305a');
    kit.block([4, 4, 4], [-4.5, 2, -2.5]);
    kit.steps([-4.5, 0, 4.2], 4);
    kit.block([3, 4, 3], [7, 2, -2.5]);
    kit.block([3, 6.5, 3], [7, 3.25, -11]);
    kit.lamp([7, 6.5, -11]);
    // a short wall's place: a gap in a low wall to close (try it against the pen's own course)
    kit.block([3, 1.2, 0.5], [-5.5, 0.6, -10]);
    kit.block([3, 1.2, 0.5], [0.5, 0.6, -10]);
  },
};

class Pen {
  constructor(ctx) {
    this.ctx = ctx;
    this.ink = PEN.ink; this.wait = 0; this.state = 'idle';
    this.bridges = []; this.made = 0;
    this.points = []; this.tip = new THREE.Vector3(); this.yaw = 0; this.pitch = 0; this.len = 0; this.done = false; this.mode = 'bridge';
    this.ray = { origin: new THREE.Vector3(), dir: new THREE.Vector3() };
    this.group = new THREE.Group(); this.group.name = 'Ink bridges';
    ctx.scene?.add(this.group);
    // the line while it is drawn: dots of ink along it and its edges
    const N = 420;
    this.dots = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 6, 4), inkMat(INK), N);
    this.dots.count = 0; this.dots.frustumCulled = false; this.dots.userData.noCollide = true; this.dotMax = N;
    ctx.fx?.add(this.dots);
    this.pen = penModel(); this.pen.scale.setScalar(3.2); this.pen.visible = false;
    this.pen.traverse((o) => { o.userData.noCollide = true; });
    ctx.fx?.add(this.pen);
    this.scratchT = 0; this._dm = new THREE.Matrix4();
    // a few materials of its own, one per plank standing (they pale as it wears)
    this.mats = Array.from({ length: PEN.keep + 1 }, (_, i) => ({
      deck: makeMaterial({ color: '#f1e3c2', color2: '#e8d6ae', flat: true, key: `ink-bridge-deck-${i}` }),
      ink: makeMaterial({ color: INK, flat: true, key: `ink-bridge-ink-${i}` }),
      used: false,
    }));
  }

  get aiming() { return this.state === 'draw'; }
  canUse() {
    const P = this.ctx.player;
    return !!P && !P.ride && !P.down && !P.dead && !P.climbing && !P.mantle && !P.swim?.under;
  }

  equip() { this.ctx.sfx?.equip?.(this.ctx.sound); }
  unequip() { if (this.state === 'draw') this.abandon(); }
  cancel() { if (this.state === 'draw') this.abandon(); }

  aimNow() {
    const { camera, player: P } = this.ctx;
    aimRay(camera, P, this.ray);
    const d = this.ray.dir;
    return { yaw: Math.atan2(d.x, d.z), pitch: Math.asin(THREE.MathUtils.clamp(d.y, -1, 1)) };
  }

  press() {
    if (!this.canUse()) return;
    if (this.ink < PEN.min) { this.ctx.notice?.('The pen is dry: its ink flows back in a moment.', 'pen-dry'); penSfx.empty(this.ctx.sound); return; }
    const P = this.ctx.player, a = this.aimNow();
    this.mode = a.pitch > PEN.wallAim ? 'wall' : 'bridge';
    this.yaw = a.yaw; this.pitch = penPitch(a.pitch); this.len = 0; this.done = false; this.spent = 0; this.over = 0; this.aloft = false;
    this.state = 'draw';
    if (this.mode === 'bridge') {
      // from the feet, a step ahead: its top level with them
      const start = new THREE.Vector3(P.pos.x + Math.sin(a.yaw) * 0.35, P.pos.y, P.pos.z + Math.cos(a.yaw) * 0.35);
      this.points = [start]; this.tip.copy(start);
      const w = this.steer(a); this.yaw = w.yaw; this.pitch = w.pitch;
    } else { this.half = 0; this.wallYaw = a.yaw; this.points = []; }
  }
  hold(dt) { if (this.state === 'draw') this.grow(dt); }
  release() {
    if (this.state !== 'draw') return;
    const ok = this.mode === 'wall' ? this.half * 2 >= PEN.min : this.len >= PEN.min;
    if (!ok) { this.abandon(); this.ctx.notice?.('Hold Y / △ to draw the line out, then let go.', 'pen-short'); return; }
    if (this.mode === 'bridge' && this.tip.distanceTo(this.points[this.points.length - 1]) > 0.05) this.points.push(this.tip.clone());
    this.set(this.points.map((p) => p.clone()), this.mode);
    this.state = 'idle'; this.points = []; this.dots.count = 0; this.pen.visible = false;
    this.ctx.hud?.reticle?.(null);
    this.wait = PEN.refillDelay;
  }
  /** Let go of a line never set: its ink comes back. */
  abandon() {
    this.ink = Math.min(PEN.ink, this.ink + (this.spent ?? 0));
    this.state = 'idle'; this.points = []; this.dots.count = 0; this.pen.visible = false;
    this.ctx.hud?.reticle?.(null);
  }

  /** The line runs on (the bridge's tip along the aim; the wall's ends apart). */
  grow(dt) {
    const { physics, player: P } = this.ctx, a = this.aimNow();
    this.wait = PEN.refillDelay;
    if (this.mode === 'wall') {
      this.wallYaw = turnToward(this.wallYaw, a.yaw, PEN.turn * 1.5 * dt);
      const want = Math.min(PEN.wallMax / 2, this.half + PEN.speed * 0.5 * dt), cost = (want - this.half) * 2 * PEN.wallCost;
      if (cost > 0 && this.ink > 0) { const k = Math.min(1, this.ink / cost); this.half += (want - this.half) * k; this.ink -= cost * k; this.spent += cost * k; }
      this.points = this.wallPoints(P.pos, this.wallYaw, this.half);
      return;
    }
    if (this.done) return;
    // toward what the reticle is on (a ledge across the gap), or along the aim when it is on nothing near
    const w = this.steer(a);
    this.yaw = turnToward(this.yaw, w.yaw, PEN.turn * dt);
    this.pitch += (w.pitch - this.pitch) * (1 - Math.exp(-6 * dt));
    let d = Math.min(PEN.speed * dt, PEN.max - this.len, this.ink);
    if (d <= 1e-4) { this.done = true; return; }
    const dir = headingDir(this.yaw, this.pitch, _v);
    // what it runs into: there it ends (on a ledge, its end laid on top)
    // (cast a hand above the line: the ground it starts on, level with its top, is not in its way)
    let hit = rayWorld(physics, _u.copy(this.tip).addScaledVector(_Y, 0.08), dir, d);
    // (a kerb or a low sill, no higher than a step over the line: it runs on through it, and you step over)
    if (hit) {
      const top = physics?.groundAt?.(hit.point.x + dir.x * 0.06, this.tip.y + PEN.over, hit.point.z + dir.z * 0.06, PEN.over + 0.3);
      if (Number.isFinite(top) && top - this.tip.y < PEN.over - 0.02 && hit.normal.y < 0.5) hit = null;
    }
    const to = _w.copy(this.tip).addScaledVector(dir, hit ? hit.distance : d);
    const g = physics?.groundAt?.(to.x, to.y + 0.3, to.z, 0.6);
    if (hit || (Number.isFinite(g) && g > to.y + 0.05 && this.len > 0.6)) {
      if (Number.isFinite(g) && g > to.y - 0.3) to.y = g;
      d = Math.max(0, this.tip.distanceTo(to));
      this.done = true;
    }
    this.tip.copy(to);
    this.len += d; this.ink -= d; this.spent += d;
    // laid onto a ledge level with it: once it has run a little way over solid ground, it is there (only once
    // it has left the ground it started on: drawn on along a plank, or along a floor, it runs on)
    if (!Number.isFinite(g) || g < to.y - 0.3) this.aloft = true;
    this.over = this.aloft && Number.isFinite(g) && g > to.y - 0.12 ? (this.over ?? 0) + d : 0;
    if (this.over > 0.4) this.done = true;
    const last = this.points[this.points.length - 1];
    if (this.tip.distanceTo(last) >= PEN.seg) this.points.push(this.tip.clone());
    if (this.len >= PEN.max - 1e-3 || this.ink <= 1e-3) this.done = true;
    this.scratchT -= dt;
    if (this.scratchT <= 0) { this.scratchT = 0.07; penSfx.scratch(this.ctx.sound); }
  }

  /** Where the line heads: at the point under the aim when it is ahead of the tip, else the aim's own way. */
  steer(a) {
    const hit = rayWorld(this.ctx.physics, this.ray.origin, this.ray.dir, 60);
    if (hit) {
      const d = _q.subVectors(hit.point, this.tip), flat = Math.hypot(d.x, d.z);
      if (flat > 1.2) return { yaw: Math.atan2(d.x, d.z), pitch: THREE.MathUtils.clamp(Math.atan2(d.y, flat), PEN.dive, PEN.climb) };
    }
    return { yaw: a.yaw, pitch: penPitch(a.pitch) };
  }

  /** A wall's base line: across the aim, `at` m ahead, its points on the ground. */
  wallPoints(from, yaw, half) {
    const physics = this.ctx.physics, n = Math.max(1, Math.ceil((half * 2) / PEN.seg)), out = [];
    const cx = from.x + Math.sin(yaw) * PEN.wallAt, cz = from.z + Math.cos(yaw) * PEN.wallAt;
    const ax = Math.cos(yaw), az = -Math.sin(yaw);
    for (let i = 0; i <= n; i++) {
      const s = -half + (i / n) * half * 2, x = cx + ax * s, z = cz + az * s;
      const g = physics?.groundAt?.(x, from.y + 2, z, 6);
      out.push(new THREE.Vector3(x, Number.isFinite(g) ? g : from.y, z));
    }
    return out;
  }

  /** The line set into ink: drawn, solid, standing PEN.life seconds. */
  set(points, mode) {
    if (points.length < 2) return null;
    // at most PEN.keep standing: the oldest starts wearing away (and one already going is taken at once)
    const standing = this.bridges.filter((x) => !x.fading);
    if (standing.length >= PEN.keep) standing[0].t = Math.max(standing[0].t, PEN.life);
    while (this.bridges.length > PEN.keep || !this.mats.some((m) => !m.used)) this.remove(this.bridges[0]);
    const frames = pathFrames(points, _Y, mode), ext = extentsOf(mode);
    const { deck, strokes } = inkGeometry(points, frames, ext, { mode, seed: (this.made++ % 17) * 1.37 });
    const n = points.length - 1, order = fadeOrder(n), draw = Array.from({ length: n }, (_, i) => i);
    // first drawn in from the start (or out from the middle, a wall), then worn away from both ends
    const inOrder = mode === 'wall' ? order.slice() : draw;
    layIndex(deck, inOrder, 0); layIndex(strokes, inOrder, 0);
    const slot = this.mats.find((m) => !m.used) ?? this.mats[0];
    slot.used = true;
    slot.deck.uniforms.uColor.value.set('#f1e3c2'); slot.ink.uniforms.uColor.value.set(INK);
    const mesh = new THREE.Mesh(deck, slot.deck), smesh = new THREE.Mesh(strokes, slot.ink);
    for (const m of [mesh, smesh]) { m.userData.noCollide = true; m.frustumCulled = false; this.group.add(m); }
    const b = { mode, points, frames, ext, n, order, inOrder, mesh, smesh, slot, t: 0, shown: 0, kept: n, fading: false, handle: null, screens: new Map() };
    this.solid(b, n);
    if (mode === 'wall') for (let i = 0; i < n; i++) b.screens.set(i, addScreen({ a: points[i], b: points[i + 1], bottom: Math.min(points[i].y, points[i + 1].y) - 0.3, top: Math.max(points[i].y, points[i + 1].y) + PEN.wallH }));
    this.bridges.push(b);
    penSfx.set(this.ctx.sound);
    // a splash of ink along it as it sets
    const drops = this.ctx.tool?.drops;
    if (drops) for (let i = 0; i < Math.min(60, n * 4); i++) {
      const p = points[Math.floor(Math.random() * (n + 1))];
      drops.add({ pos: p.clone().addScaledVector(_Y, -0.1), vel: new THREE.Vector3().randomDirection().multiplyScalar(2).addScaledVector(_Y, 1.5), drag: 2, grav: 12, size: 0.04 + Math.random() * 0.05, stretch: 2, life: 0.4 + Math.random() * 0.4, color: INK });
    }
    this.ctx.game?.emit?.('gadget:bridge', { mode, length: points[0].distanceTo(points[n]) });
    return b;
  }

  /** Its collision: the boxes of the segments still standing (the middle `keep` of them in its fade order). */
  solid(b, keep) {
    const ph = this.ctx.physics;
    if (b.handle) { ph?.removeCollider?.(b.handle); b.handle = null; }
    if (!keep || !ph?.addCollider) return;
    const g = colliderGeometry(b.points, b.frames, b.ext, b.order, keep);
    if (!g) return;
    b.handle = ph.addCollider(new THREE.Mesh(g), { noClimb: b.mode === 'wall' });   // (a wall stops you and foes: it is not climbed)
  }

  remove(b) {
    const i = this.bridges.indexOf(b);
    if (i >= 0) this.bridges.splice(i, 1);
    if (b.handle) this.ctx.physics?.removeCollider?.(b.handle);
    for (const off of b.screens.values()) off();
    b.mesh.removeFromParent(); b.smesh.removeFromParent();
    b.mesh.geometry.dispose(); b.smesh.geometry.dispose();
    b.slot.used = false;
  }

  update(dt, paused = false) {
    if (paused) return;
    if (this.state !== 'draw') ({ ink: this.ink, wait: this.wait } = refillInk(this.ink, this.wait, dt));
    if (this.state === 'draw' && !this.canUse()) this.abandon();
    // the line being drawn: its dots, the pen at its tip, the camera over the shoulder
    if (this.state === 'draw') this.drawLine();
    for (const b of this.bridges.slice()) this.age(b, dt);
  }

  drawLine() {
    const pts = this.mode === 'bridge' ? [...this.points, this.tip] : this.points;
    const ext = extentsOf(this.mode);
    let n = 0;
    const put = (p, s) => { if (n >= this.dotMax) return; this._dm.makeScale(s, s, s).setPosition(p); this.dots.setMatrixAt(n++, this._dm); };
    if (pts.length >= 2) {
      const frames = pathFrames(pts, _Y, this.mode);
      for (let i = 0; i < pts.length - 1; i++) {
        const L = pts[i].distanceTo(pts[i + 1]), k = Math.max(1, Math.round(L / 0.22));
        for (let j = 0; j < k; j++) {
          const u = j / k;
          _q.lerpVectors(pts[i], pts[i + 1], u);
          const f = frames[i];
          put(_q, 0.055);
          for (const e of this.mode === 'wall' ? [ext.a1, ext.a1 * 0.5] : [ext.a0, ext.a1]) put(_u.copy(_q).addScaledVector(f.a, e), 0.04);
        }
      }
    }
    this.dots.count = n; this.dots.instanceMatrix.needsUpdate = true;
    // the pen: at the tip (a wall: at its far end), nib down to the line
    const tip = this.mode === 'bridge' ? this.tip : pts[pts.length - 1] ? _w.copy(pts[pts.length - 1]).addScaledVector(_Y, PEN.wallH) : null;
    const P = this.ctx.player;
    if (tip) {
      this.pen.visible = true;
      this.pen.position.copy(tip).addScaledVector(_Y, 0.32);
      this.pen.rotation.set(0.25, (this.mode === 'bridge' ? this.yaw : this.wallYaw) + Math.PI, -0.5);
      if (Math.random() < 0.3) this.ctx.tool?.drops?.add?.({ pos: tip.clone(), vel: new THREE.Vector3(0, -1, 0), drag: 1, grav: 12, size: 0.04, stretch: 2.5, life: 0.5, color: INK });
      const len = this.mode === 'bridge' ? this.len : this.half * 2;
      const what = this.mode === 'wall' ? 'wall' : Math.abs(this.pitch) > 0.1 ? 'ramp' : 'bridge';
      this.ctx.hud?.reticle?.(tip, len >= PEN.min ? 'ok' : 'far', `${len.toFixed(1)} m · ${what}`);
      this.ctx.aimAt?.(tip, this.ray.dir);
    } else this.pen.visible = false;
    if (!P) this.pen.visible = false;
  }

  /** A plank's life: drawn in, standing (it pales before it goes), then worn away from both ends. */
  age(b, dt) {
    b.t += dt;
    if (b.shown < b.n) {
      // drawn in quickly (a third of a second for the whole)
      b.shown = Math.min(b.n, b.shown + dt * Math.max(b.n * 3, 20));
      showFirst(b.mesh.geometry, Math.ceil(b.shown)); showFirst(b.smesh.geometry, Math.ceil(b.shown));
      if (b.shown >= b.n) { layIndex(b.mesh.geometry, b.order); layIndex(b.smesh.geometry, b.order); }
    }
    const left = PEN.life - b.t;
    if (left < PEN.warn && left > 0) {
      // the ink drying: the plank pales and the strokes go grey, a drop falls now and then
      const k = 1 - left / PEN.warn;
      b.slot.deck.uniforms.uColor.value.set('#f1e3c2').lerp(_c.set('#fbf6ea'), k);
      b.slot.ink.uniforms.uColor.value.set(INK).lerp(_c.set('#8d8271'), k * 0.8);
      if (Math.random() < dt * 6) { const p = b.points[Math.floor(Math.random() * b.points.length)]; this.ctx.tool?.drops?.add?.({ pos: _q.copy(p).addScaledVector(_Y, -PEN.thick), vel: new THREE.Vector3(0, -0.5, 0), drag: 1, grav: 12, size: 0.035, stretch: 2.5, life: 0.6, color: INK }); }
    }
    if (b.t >= PEN.life) {
      if (!b.fading) { b.fading = true; penSfx.fade(this.ctx.sound); }
      const keep = Math.max(0, Math.ceil(b.n * (1 - (b.t - PEN.life) / PEN.fade)));
      if (keep !== b.kept) {
        b.kept = keep;
        showFirst(b.mesh.geometry, keep); showFirst(b.smesh.geometry, keep);
        this.solid(b, keep);
        // (a wall's shelter goes with the segments that wore away)
        const still = new Set(b.order.slice(0, keep));
        for (const [i, off] of b.screens) if (!still.has(i)) { off(); b.screens.delete(i); }
      }
      if (keep === 0) this.remove(b);
    }
  }

  hud() {
    const pips = 6, per = PEN.ink / pips;
    return { count: Math.floor((this.ink + 1e-6) / per), max: pips, refill: this.ink < PEN.ink ? (this.ink % per) / per : 0 };
  }

  dispose() {
    for (const b of this.bridges.slice()) this.remove(b);
    this.group.removeFromParent(); this.dots.removeFromParent(); this.pen.removeFromParent();
  }
}
const _c = new THREE.Color();
