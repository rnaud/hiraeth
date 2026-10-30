// How the makers' battery hangs at the traveller's side (issue #745): from his belt down his left hip, just behind his
// hanging hand (fluid-tool.js TANK.at: there his hand and forearm pass beside it standing and in every gait), and out of
// the way the moment anything of him comes to it. A sample of his own skin and clothes (his left hip and waist, both arms
// and hands, both legs and feet: the outermost vertex of each 2.4 cm cell, grouped by the bone that carries it) is skinned
// every frame and looked at from the battery: when his arm, his thigh or a foot would come into it (the sprint's arm, a
// jump's spring, the landing, a cut, a lunge) it swings on its clip, hinged at its top, by as little as clears them, out
// from his hip or along his side; when no swing clears them, or while he climbs, swims, sits, rolls, is on a ladder or is
// posed by an overlay (a bench, a kneel), it tucks away (hidden at once), and grows back on his hip once he has been clear
// of it a moment.
//
// The look is the battery's own frame (fluid-tool.js: y up the glass from its foot, +z toward him). `gap(q)` is how far a
// point of that frame is outside the battery (fluid-tool.js tankGap). Engine-free: the same JS runs in the Unity port,
// reading the bones' matrixWorld that the humanoid writes (tests/battery-hip.test.js measures it on v2 and on B3).
import * as THREE from 'three';

export const HANG = {
  margin: 0.01,        // m: the least of him allowed near the battery (it hangs 2.2 cm off his hip at rest; the sample is a cell apart)
  swingMax: 0.75,      // rad: the furthest it swings on its clip before it tucks instead
  slideMax: 0.16,      // m: the furthest it slides along his belt (a hand is 8 cm across, the battery 12)
  swingBack: 7,        // 1/s: how fast it swings (and slides) back once clear
  tuckIn: 0,           // s: tucking away (at once: shrinking, it was still in the way of what tucked it)
  tuckOut: 0.3,        // s: growing back
  hold: 0.25,          // s: clear this long before it grows back (a run of steps across a stream: not in and out)
  cell: 0.024,         // m: the sample's grid
  piece: 0.1,          // m: its pieces (passed over whole when far)
  near: 0.26,          // m: only skin this near its middle (in its frame) is looked at (it swings its foot 16 cm at most)
};

// (his hips' and waist's left side, both arms and hands and both legs and feet: a cut sweeps his right hand to his left
// hip, a lunge kicks his left foot up behind him, and a swing or a slide must not take it into his hip)
const LIMB = /^(pelvis|spine_0[12]|(thigh|calf|foot|ball)_[lr]|upperarm_[lr]|lowerarm_[lr]|hand_[lr]|(thumb|index|middle|ring|pinky)_0\d_[lr])$/;
const _m = new THREE.Matrix4(), _inv = new THREE.Matrix4(), _v = new THREE.Vector3(), _u = new THREE.Vector3(), _q = new THREE.Quaternion(), _ax = new THREE.Vector3();
/** The ways it swings (about a level axis this far round from its frame's x): out, out and forward or back, along his side. */
const DIRS = [0, Math.PI / 4, -Math.PI / 4, Math.PI / 2, -Math.PI / 2], ZERO = { a: 0, dir: 0, s: 0 };

/** True while he is posed so that his legs or his arms come round his left hip for long: it tucks away. */
export function tuckedPose(p) {
  if (!p) return false;
  return !!(p.climbing || p.mantle || p.swim || p.overlay || p.down || p.onLadder || p.combatMotion?.roll != null);
}

export class BatteryHang {
  /**
   * @param {object} o.gap     (q: Vector3 in the battery's frame) => m outside it
   * @param {number[]} o.pivot the hinge of its clip in its frame (its top, at the clip)
   */
  constructor({ gap, pivot }) {
    this.gap = gap;
    this.pivot = new THREE.Vector3(...pivot);
    this.swing = 0; this.dir = 0; this.slide = 0; this.tuck = 0; this.need = 0; this.near = 0; this.clearFor = Infinity;
    this.sample = null; this._sig = '';
    this.matrix = new THREE.Matrix4();
  }

  /** The skinned meshes of him that are drawn (his body, his clothes). */
  static meshesOf(root) {
    const out = [];
    root?.traverse((o) => { if (o.isSkinnedMesh && o.geometry?.attributes?.skinIndex) { for (let w = o; w; w = w.parent) if (w.visible === false) return; out.push(o); } });
    return out;
  }

  /**
   * Pick the sample: the outermost vertex of each cell, from every mesh of him drawn (again when they change), in groups
   * by the bone that carries each most (a group whose bone is far from the battery is passed over whole each frame).
   */
  build(root) {
    const meshes = BatteryHang.meshesOf(root);
    const sig = meshes.map((m) => m.id + ':' + m.geometry.id).join(',');
    if (sig === this._sig && this.sample) return this.sample;
    this._sig = sig;
    const cells = new Map();
    for (const m of meshes) {
      const G = m.geometry, P = G.attributes.position, J = G.attributes.skinIndex, W = G.attributes.skinWeight, bones = m.skeleton.bones;
      for (let i = 0; i < P.count; i++) {
        let best = 0, j = 0;
        for (let c = 0; c < 4; c++) { const w = W.getComponent(i, c); if (w > best) { best = w; j = J.getComponent(i, c); } }
        const name = bones[j]?.name ?? '';
        if (!LIMB.test(name)) continue;
        _v.fromBufferAttribute(P, i).applyMatrix4(m.bindMatrix);
        if (/^(pelvis|spine)/.test(name) && _v.x < 0.02) continue;   // (his hips and waist: the left half only, +x)
        const key = `${Math.floor(_v.x / HANG.cell)},${Math.floor(_v.y / HANG.cell)},${Math.floor(_v.z / HANG.cell)},${name}`;
        const out = _v.x * _v.x + _v.z * _v.z, had = cells.get(key);
        if (had && had.out >= out) continue;
        cells.set(key, { out, m, j, i, p: _v.clone() });
      }
    }
    // the groups: a mesh's points carried most by one bone, in pieces of HANG.piece (by the cell): each its middle (bind
    // space) and how far its points reach from it, and its points' places (bind space), bones and weights (4 a point)
    const groups = new Map(), pc = HANG.piece;
    for (const c of cells.values()) {
      const k = `${c.m.id}:${c.j}:${Math.floor(c.p.x / pc)},${Math.floor(c.p.y / pc)},${Math.floor(c.p.z / pc)}`;
      let g = groups.get(k);
      if (!g) { g = { m: c.m, bone: c.j, at: new THREE.Vector3(), list: [] }; groups.set(k, g); }
      g.list.push(c); g.at.add(c.p);
    }
    let total = 0;
    for (const g of groups.values()) {
      const n = g.list.length, J = g.m.geometry.attributes.skinIndex, W = g.m.geometry.attributes.skinWeight;
      g.at.divideScalar(n);
      g.p = new Float32Array(n * 3); g.b = new Uint16Array(n * 4); g.w = new Float32Array(n * 4); g.reach = 0;
      g.list.forEach((c, i) => {
        g.p[i * 3] = c.p.x; g.p[i * 3 + 1] = c.p.y; g.p[i * 3 + 2] = c.p.z;
        let sum = 0;
        for (let q = 0; q < 4; q++) { const w = W.getComponent(c.i, q); g.b[i * 4 + q] = J.getComponent(c.i, q); g.w[i * 4 + q] = w; sum += w; }
        for (let q = 0; q < 4; q++) g.w[i * 4 + q] /= sum || 1;
        g.reach = Math.max(g.reach, c.p.distanceTo(g.at));
      });
      total += n; delete g.list;
    }
    this.sample = { groups: [...groups.values()], count: total, meshes, at: new Float32Array(total * 3), mats: new Map(), base: new Map(), done: new Set() };
    return this.sample;
  }

  /**
   * Skin the sample into the battery's home frame (`toHome`: world -> its frame at its place on the hip, unswung).
   * Returns the number of points near it (in sample.at).
   */
  skin(toHome) {
    const S = this.sample;
    if (!S) return 0;
    const R = HANG.near, at = S.at, cy = this.pivot.y * 0.5, done = S.done;
    // world -> home of each mesh's bind space (home · matrixWorld · bindMatrixInverse), then of each bone's (· bone · boneInverse)
    for (const m of S.meshes) { let B = S.base.get(m); if (!B) S.base.set(m, (B = new THREE.Matrix4())); B.multiplyMatrices(toHome, m.matrixWorld).multiply(m.bindMatrixInverse); }
    done.clear();
    const boneM = (m, b) => {
      const k = m.id * 1024 + b;
      let M = S.mats.get(k);
      if (!M) S.mats.set(k, (M = new THREE.Matrix4()));
      if (!done.has(k)) { M.multiplyMatrices(m.skeleton.bones[b].matrixWorld, m.skeleton.boneInverses[b]).premultiply(S.base.get(m)); done.add(k); }
      return M.elements;
    };
    let n = 0;
    for (const g of S.groups) {
      // (a piece too far from the battery for any of its points to come into the box looked at: its middle carried by
      // its bone alone, its reach given room for the other bones' share)
      const e = boneM(g.m, g.bone), ax = g.at.x, ay = g.at.y, az = g.at.z;
      const bx = e[0] * ax + e[4] * ay + e[8] * az + e[12], by = e[1] * ax + e[5] * ay + e[9] * az + e[13], bz = e[2] * ax + e[6] * ay + e[10] * az + e[14];
      const out = g.reach * 1.3 + 0.03;
      if (Math.abs(bx) > R + out || Math.abs(bz) > R + out || Math.abs(by - cy) > R + out) continue;
      const P = g.p, B = g.b, W = g.w, cnt = P.length / 3;
      for (let i = 0; i < cnt; i++) {
        const px = P[i * 3], py = P[i * 3 + 1], pz = P[i * 3 + 2];
        let x = 0, y = 0, z = 0;
        for (let q = 0; q < 4; q++) {
          const w = W[i * 4 + q];
          if (w < 0.02) continue;
          const me = boneM(g.m, B[i * 4 + q]);
          x += w * (me[0] * px + me[4] * py + me[8] * pz + me[12]);
          y += w * (me[1] * px + me[5] * py + me[9] * pz + me[13]);
          z += w * (me[2] * px + me[6] * py + me[10] * pz + me[14]);
        }
        if (Math.abs(x) > R || Math.abs(z) > R || Math.abs(y - cy) > R) continue;
        at[n * 3] = x; at[n * 3 + 1] = y; at[n * 3 + 2] = z; n++;
      }
    }
    return n;
  }

  /**
   * The least of him outside the battery slid `s` m along his side (its frame's x) and swung by `a` rad on its clip
   * about the level axis `dir` (rad round from its frame's x: 0 its bottom out, away from him; ±π/2 along his side,
   * toward his front or his back), from its home frame's points (sample.at).
   */
  clearance(n, a, dir = 0, s = 0) {
    const at = this.sample.at, P = this.pivot;
    _q.setFromAxisAngle(_ax.set(Math.cos(dir), 0, Math.sin(dir)), -a);
    let least = Infinity;
    for (let i = 0; i < n; i++) {
      _v.set(at[i * 3] - s - P.x, at[i * 3 + 1] - P.y, at[i * 3 + 2] - P.z).applyQuaternion(_q).add(P);
      const d = this.gap(_v);
      if (d < least) least = d;
    }
    return least;
  }

  /**
   * The least move that clears him, { a, dir, s }, or null when none does: at each step out, a swing on its clip (out
   * first, then out and along his side, then along it: an arm passing behind and outside it, a swing out only meets
   * it; the way it swung last tried first), then a slide along his belt, toward his front or his back (a hand coming
   * down over its top, by its hinge, where a swing barely moves it); stepped out, then refined (too far a swing can
   * bring it into his arm behind it).
   */
  needed(n) {
    if (n === 0 || this.clearance(n, 0) >= HANG.margin) return ZERO;
    const N = 12, step = HANG.swingMax / N, slide = HANG.slideMax / N, last = this.dir;
    const dirs = [last, ...DIRS.filter((d) => d !== last)];
    const lastS = Math.sign(this.slide) || 1;
    for (let k = 1; k <= N; k++) {
      for (const dir of dirs) {
        if (this.clearance(n, k * step, dir) < HANG.margin) continue;
        let lo = (k - 1) * step, hi = k * step;
        for (let i = 0; i < 5; i++) { const m = (lo + hi) / 2; if (this.clearance(n, m, dir) >= HANG.margin) hi = m; else lo = m; }
        return { a: hi, dir, s: 0 };
      }
      for (const sg of [lastS, -lastS]) {
        if (this.clearance(n, 0, 0, sg * k * slide) < HANG.margin) continue;
        let lo = (k - 1) * slide, hi = k * slide;
        for (let i = 0; i < 5; i++) { const m = (lo + hi) / 2; if (this.clearance(n, 0, 0, sg * m) >= HANG.margin) hi = m; else lo = m; }
        return { a: 0, dir: this.dir, s: sg * hi };
      }
    }
    return null;
  }

  /**
   * This frame's hang: `home` the battery's matrix on the hip (its parent's frame, unswung), `parent` that frame's
   * object, `root` him (his meshes), `tucked` a pose that tucks it. dt 0: settle at once (a still, a test). Writes
   * this.matrix (the parent's frame) and returns it; this.tuck 1: hidden.
   */
  update(dt, { home, parent, root, tucked = false }) {
    if (!this.sample || (this._check = (this._check ?? 0) - dt) <= 0) { this.build(root); this._check = 0.5; }
    parent.updateWorldMatrix(true, false);
    _m.multiplyMatrices(parent.matrixWorld, home);
    const n = (this.near = this.skin(_inv.copy(_m).invert()));
    const need = this.needed(n);
    this.need = need ? need.a : Infinity;
    const blocked = tucked || !need;
    this.clearFor = blocked ? 0 : this.clearFor + dt;
    const now = dt <= 0;
    // the tuck: hidden at once when blocked, grown back after a while clear
    if (blocked) this.tuck = now || !HANG.tuckIn ? 1 : Math.min(1, this.tuck + dt / HANG.tuckIn);
    else if (this.clearFor >= HANG.hold || now) this.tuck = now ? 0 : Math.max(0, this.tuck - dt / HANG.tuckOut);
    // the swing and the slide: out at once, as far as clears him, the way that clears him; back on their spring (no
    // move clears him: tucked, it comes back out at its place)
    const wa = need ? need.a : 0, ws = need ? need.s : 0;
    if (need && need.a > 0 && need.dir !== this.dir) { this.dir = need.dir; this.swing = wa; }
    else if (now || wa >= this.swing || this.tuck >= 1) this.swing = wa;
    else this.swing += (wa - this.swing) * (1 - Math.exp(-HANG.swingBack * dt));
    if (now || this.tuck >= 1 || Math.abs(ws) >= Math.abs(this.slide) || Math.sign(ws) * Math.sign(this.slide) < 0) this.slide = ws;
    else this.slide += (ws - this.slide) * (1 - Math.exp(-HANG.swingBack * dt));
    if (this.swing < 1e-4) this.swing = 0;
    if (Math.abs(this.slide) < 1e-4) this.slide = 0;
    // (easing back, the swing and the slide together must still clear him: else straight to the move that does)
    if (need && (this.swing !== wa || this.slide !== ws) && this.clearance(n, this.swing, this.dir, this.slide) < 0) { this.swing = wa; this.slide = ws; this.dir = need.dir; }
    const P = this.pivot, k = Math.max(1e-3, 1 - this.tuck);
    _q.setFromAxisAngle(_ax.set(Math.cos(this.dir), 0, Math.sin(this.dir)), this.swing);
    this.matrix.copy(home).multiply(_m.makeTranslation(P.x + this.slide, P.y, P.z)).multiply(_inv.makeRotationFromQuaternion(_q))
      .multiply(_m.makeScale(k, k, k)).multiply(_inv.makeTranslation(-P.x, -P.y, -P.z));
    return this.matrix;
  }
}
