import * as THREE from 'three';

// The hand-over into another space: a doorway into a room built far off the map, a cave mouth,
// a temple's door, Viridel's hatch, the Lab's doors, the Hangar's portals (README: "Doors, caves and
// portals: one hand-over, no hitch"). Every one goes the same way:
//  1. ahead of time, the destination is drawn once, unseen (WarmDraw): every mesh there into
//     tiny targets of the real passes' formats, so its geometry and textures are on the GPU and
//     the driver has built its pipelines (a mobile driver compiles a shader for real only at its
//     first draw). At load for every way through; again as you come near one, for anything new.
//  2. the cover: a sheet of paper with an inked edge sweeps across the screen (PassageCover; a
//     CSS transition, run by the compositor, so it keeps moving through a long frame);
//  3. behind it, the move (carryAcross): the traveller lands still walking, at the speed they
//     had, mid-stride: the step, the clip blend, the feet on the ground, the hands' swing and the
//     camera's place behind them are all carried over by the one rigid move from the door to the
//     arrival, rather than reset (it used to land at a dead stop with the camera snapped in close);
//  4. a few frames held while the new place settles (its grass placed, the camera's walls found),
//     then the sheet sweeps on and off the far side.

export const PASSAGE = {
  cover: 0.22,       // s: the sheet comes across
  reveal: 0.4,       // s: and goes on off the far side
  holdMin: 2,        // frames drawn at the destination, still covered, before it goes
  holdMax: 0.6,      // s: the longest it waits for the new place to settle
  warmMax: 0.5,      // s: the longest the move waits for the destination's last meshes
  perFrame: 32,      // meshes drawn a frame while warming ahead (the rest, if any, once covered)
  near: 12,          // m: this close to a way through, its destination is warmed ahead
  radius: 100,       // m round a destination that count as it
};

const Y = new THREE.Vector3(0, 1, 0), Z = new THREE.Vector3(0, 0, 1);

/** A frame as a rotation matrix: columns right (up × fwd), up, fwd (fwd made square to up). */
function basis(up, fwd, out = new THREE.Matrix4()) {
  const u = up.clone().normalize();
  const f = fwd.clone().addScaledVector(u, -fwd.dot(u));
  if (f.lengthSq() < 1e-8) f.set(1, 0, 0).addScaledVector(u, -u.x);
  f.normalize();
  const r = new THREE.Vector3().crossVectors(u, f).normalize();
  return out.makeBasis(r, u, f);
}

/**
 * The rigid move from one place to another: what stood at `from` facing `fwdFrom` (its up `upFrom`)
 * goes to `to` facing `fwdTo` (up `upTo`), and everything round it keeps its place relative to it.
 * point(v) / dir(v) move a position / turn a direction, in place.
 */
export function passageTransform({ from, upFrom = Y, fwdFrom, to, upTo = Y, fwdTo }) {
  const A = basis(upFrom, fwdFrom), B = basis(upTo, fwdTo);
  const q = new THREE.Quaternion().setFromRotationMatrix(B.multiply(A.transpose()));
  const f = from.clone(), t = to.clone();
  return {
    q, from: f, to: t,
    point: (v) => v.sub(f).applyQuaternion(q).add(t),
    dir: (v) => v.applyQuaternion(q),
  };
}

/**
 * Carry the traveller (and the camera behind them) through a way to another place.
 * @param o.to      where they land; o.up / o.fwd the frame there (default level ground, +z)
 * @param o.heading the way they face there, in that frame
 * @param o.speed   their speed there along it; null (default): the speed they had, kept
 * @returns the transform used
 */
export function carryAcross(player, rig, camera, { to, up = Y, fwd = Z, heading = 0, speed = null }) {
  const P = player, H = P.humanoid;
  const pos0 = P.pos.clone(), up0 = P.frame.up.clone();
  const face0 = P.frame.dir(P.heading, new THREE.Vector3());
  const vel0 = P.vel.clone(), ground0 = P.onGround, heading0 = P.heading;
  const camRel = rig ? rig.yaw - heading0 : 0;
  P.teleport(to, up, fwd);
  P.heading = heading;
  const face = P.frame.dir(heading, new THREE.Vector3());
  const X = passageTransform({ from: pos0, upFrom: up0, fwdFrom: face0, to, upTo: P.frame.up, fwdTo: face });
  // still walking: the same velocity turned with you (or the speed asked for, straight ahead)
  if (speed === null) P.vel.copy(X.dir(vel0));
  else P.vel.copy(face).multiplyScalar(speed);
  P.onGround = ground0;   // (the floor is found again on the first step; no frame of falling in between)
  // the animation's own memory of where it was going: no turn of the whole heading in one frame,
  // no braking and setting off again (the clip blend, the gait's phase and the stride stay as they are)
  P._lastHeading = heading;
  if (P.loco) P.loco.lastHeading = heading;
  if (P._moveDir) X.dir(P._moveDir);
  if (P._lastVel) X.dir(P._lastVel);
  if (P._stepLag?.last) X.point(P._stepLag.last);
  // the planted feet and the hands' swing: carried, not let go (a foot left behind snaps back)
  for (const k of ['l', 'r']) {
    const F = H?._feet?.[k];
    if (!F) continue;
    X.point(F.pos); X.dir(F.yaw); if (F.n) X.dir(F.n);
    if (F.step) { X.point(F.step.from); X.dir(F.step.fromYaw); }
  }
  for (const S of H?.hands?.sides ?? []) { if (S.last) X.point(S.last); if (S.vel) X.dir(S.vel); }
  // the drawn body where the next frame puts it
  if (P.object) { X.point(P.object.position); P.object.quaternion.premultiply(X.q); }
  // the camera: the same place behind and above, the same lag, the same arm (it finds the new
  // walls on its next frame: rig._lastP null is a jump, the tight-space probe runs at once)
  if (rig) {
    rig.yaw = heading + camRel;
    if (rig.target) X.point(rig.target);
    if (rig._look) X.point(rig._look);
    rig._lastP = null;
  }
  if (camera) {
    X.point(camera.position);
    camera.quaternion.premultiply(X.q);
    X.dir(camera.up);
    camera.updateMatrixWorld?.();
  }
  return X;
}

// ------------------------------------------------------------------ the destination, drawn ahead
const WARM_LAYER = 31;
const _s = new THREE.Vector3();

/**
 * Draws meshes once, unseen, into small render targets of the formats the real passes draw into
 * (the G-buffer's, a shadow map's): what a first sight would do (geometry and textures uploaded,
 * every pipeline the driver builds lazily built), without being seen. Each mesh only once.
 * Hidden ones (rooms off the map, a cave shown only when you are near, the ship's rooms) are shown
 * for the draw; the scene is drawn through a camera that sees one layer, so nothing else is.
 */
export class WarmDraw {
  /**
   * @param passes [{ target, camera, override? }]: one draw of the batch per pass
   * @param o.lodFull (mesh) => its full geometry if a level of detail stands in for it now
   */
  constructor(renderer, scene, { passes = [], lodFull = null } = {}) {
    this.renderer = renderer; this.scene = scene; this.passes = passes; this.lodFull = lodFull;
    this.done = new WeakSet();
    this.drawn = 0;
    for (const p of passes) p.camera.layers.set(WARM_LAYER);
    this._list = null; this._n = -1;
  }

  /** Every drawable mesh in the scene (cached; refreshed when the scene's children change). */
  meshes() {
    if (this._list && this._n === this.scene.children.length) return this._list;
    const list = [];
    this.scene.traverse((o) => { if ((o.isMesh || o.isPoints || o.isLine) && o.material && o.geometry?.attributes?.position) list.push(o); });
    this._n = this.scene.children.length;
    return (this._list = list);
  }

  /** Meshes not drawn yet whose bounds reach within `radius` of any of the points (world matrices as of the last frame). */
  near(points, radius = PASSAGE.radius) {
    const pts = points.filter(Boolean), out = [];
    if (!pts.length) return out;
    for (const o of this.meshes()) {
      if (this.done.has(o)) continue;
      const g = o.geometry;
      if (!g.boundingSphere) g.computeBoundingSphere();
      const bs = o.isInstancedMesh && o.boundingSphere ? o.boundingSphere : g.boundingSphere;
      if (!bs || !Number.isFinite(bs.radius)) continue;
      _s.copy(bs.center).applyMatrix4(o.matrixWorld);
      const r = bs.radius * o.matrixWorld.getMaxScaleOnAxis();
      if (r > radius * 4) continue;   // (the terrain, the sky: seen from everywhere, drawn already)
      for (const p of pts) if (_s.distanceTo(p) < radius + r) { out.push(o); break; }
    }
    return out;
  }

  /** Every mesh under these roots not drawn yet. */
  of(...roots) {
    const out = [];
    for (const r of roots) r?.traverse?.((o) => { if ((o.isMesh || o.isPoints || o.isLine) && o.material && o.geometry?.attributes?.position && !this.done.has(o)) out.push(o); });
    return out;
  }

  /** Draw them once (each pass), then put everything back as it was. Returns how many were drawn. */
  draw(list) {
    const todo = list.filter((o) => !this.done.has(o));
    if (!todo.length || !this.passes.length) return 0;
    const R = this.renderer, scene = this.scene;
    const shown = [], culled = [], swapped = [];
    for (const o of todo) {
      o.layers.enable(WARM_LAYER);
      if (o.frustumCulled) { o.frustumCulled = false; culled.push(o); }
      // (it and everything above it shown for the draw: the camera's layer leaves the rest out)
      for (let p = o; p && p !== scene; p = p.parent) if (!p.visible) { p.visible = true; shown.push(p); }
      const full = this.lodFull?.(o);
      if (full && full !== o.geometry) { swapped.push([o, o.geometry]); o.geometry = full; }
      o.updateWorldMatrix(true, false);
    }
    const prevTarget = R.getRenderTarget(), prevOverride = scene.overrideMaterial, prevAuto = scene.matrixWorldAutoUpdate;
    scene.matrixWorldAutoUpdate = false;   // (only the batch matters, and it is up to date)
    try {
      for (const pass of this.passes) {
        scene.overrideMaterial = pass.override ?? null;
        R.setRenderTarget(pass.target);
        R.render(scene, pass.camera);
      }
    } finally {
      scene.overrideMaterial = prevOverride;
      scene.matrixWorldAutoUpdate = prevAuto;
      R.setRenderTarget(prevTarget);
      for (const o of todo) { o.layers.disable(WARM_LAYER); this.done.add(o); }
      for (const o of culled) o.frustumCulled = true;
      for (const p of shown) p.visible = false;
      for (const [o, g] of swapped) o.geometry = g;
    }
    this.drawn += todo.length;
    return todo.length;
  }
}

/** The passes a WarmDraw needs for the game's pipeline: a 4 × 4 G-buffer and a 4 × 4 shadow map. */
export function warmPasses({ makeGBuffer, shadowOverride }) {
  const gb = makeGBuffer();
  gb.setSize(4, 4);
  const depthTexture = new THREE.DepthTexture(4, 4);
  depthTexture.compareFunction = THREE.LessEqualCompare;
  const sh = new THREE.WebGLRenderTarget(4, 4, { format: THREE.RedFormat, depthBuffer: true, depthTexture });
  return [
    { target: gb, camera: new THREE.PerspectiveCamera(55, 1, 0.3, 5000) },
    { target: sh, camera: new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), override: shadowOverride },
  ];
}

// ------------------------------------------------------------------ the cover
const SHEET = 124, EDGE = 12;   // vw: the sheet's width, its inked edge on each side (the paper between is the screen's width)

/** The sheet's outline: a ragged, brushed edge down each side (in the sheet's 124 × 100 box): the
 * filled shape, and the two edges alone (for the ink: not along the top and bottom of the screen). */
export function sheetPath(seed = 7) {
  let s = seed;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const side = (x0, dir) => {
    const pts = [];
    for (let y = -2; y <= 102; y += 4) pts.push([x0 + dir * (rnd() * 2.4 + Math.sin(y * 0.21 + seed) * 1.1), y]);
    return pts;
  };
  const L = side(EDGE * 0.55, 1), Rr = side(SHEET - EDGE * 0.55, -1).reverse();
  const f = (p) => `${p[0].toFixed(2)} ${p[1].toFixed(2)}`;
  const line = (pts) => `M${f(pts[0])} ${pts.slice(1).map((p) => 'L' + f(p)).join(' ')}`;
  return { fill: `${line(L)} L${f(Rr[0])} ${Rr.slice(1).map((p) => 'L' + f(p)).join(' ')} Z`, left: line(L), right: line(Rr) };
}

/**
 * The paper that sweeps across: off the left, across the whole screen (covered), off the right.
 * A CSS transform transition: the compositor runs it, so a long frame underneath doesn't stop it.
 */
export class PassageCover {
  constructor(doc = globalThis.document) {
    this.doc = doc;
    this.k = 0;
    if (!doc?.createElement) return;
    const el = (this.el = doc.createElement('div'));
    el.id = 'passage';
    el.setAttribute('aria-hidden', 'true');
    el.style.cssText = `position:fixed;top:0;left:0;height:100%;width:${SHEET}vw;z-index:7900;pointer-events:none;transform:translate3d(-${SHEET}vw,0,0);will-change:transform;visibility:hidden;contain:strict`;
    const path = sheetPath();
    const ink = 'fill="none" stroke="#2b211f" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"';
    el.innerHTML = `<svg viewBox="0 0 ${SHEET} 100" preserveAspectRatio="none" width="100%" height="100%" style="display:block;overflow:visible">
      <defs><pattern id="passage-hatch" width="1.6" height="1.6" patternUnits="userSpaceOnUse" patternTransform="rotate(35)"><line x1="0" y1="0" x2="0" y2="1.6" stroke="#2b211f" stroke-width="0.06" stroke-opacity="0.09"/></pattern></defs>
      <path d="${path.fill}" fill="#f2e7cf"/>
      <path d="${path.fill}" fill="url(#passage-hatch)"/>
      <path d="${path.left}" ${ink} stroke-width="3.2"/><path d="${path.right}" ${ink} stroke-width="3.2"/>
      <path d="${path.left}" ${ink} stroke-width="1.2" stroke-opacity="0.5" transform="translate(-0.9 0)"/><path d="${path.right}" ${ink} stroke-width="1.2" stroke-opacity="0.5" transform="translate(0.9 0)"/>
    </svg>`;
    doc.body?.appendChild(el);
    this._t = null;
  }

  _go(x, secs, ease) {
    const el = this.el;
    if (!el) return;
    el.style.visibility = 'visible';
    el.style.transition = `transform ${secs}s ${ease}`;
    el.style.transform = `translate3d(${x}vw,0,0)`;
  }

  /** Sweep in from the left until the screen is covered. */
  cover(secs = PASSAGE.cover) {
    this.k = 1;
    if (!this.el) return;
    clearTimeout(this._t);
    // from off the left (no transition back there), then across
    this.el.style.transition = 'none';
    this.el.style.transform = `translate3d(-${SHEET}vw,0,0)`;
    void this.el.getBoundingClientRect();
    this._go(-EDGE, secs, 'cubic-bezier(.5,0,.75,1)');
  }

  /** Sweep on, off the right. */
  reveal(secs = PASSAGE.reveal) {
    this.k = 0;
    if (!this.el) return;
    this._go(100, secs, 'cubic-bezier(.25,0,.5,1)');
    clearTimeout(this._t);
    this._t = setTimeout(() => { if (this.k === 0 && this.el) { this.el.style.visibility = 'hidden'; this.el.style.transition = 'none'; this.el.style.transform = `translate3d(-${SHEET}vw,0,0)`; } }, secs * 1000 + 60);
  }
}

// ------------------------------------------------------------------ the hand-over
/**
 * One hand-over at a time: go() starts it (the cover comes across), update() each frame, before
 * the traveller moves: it finishes warming the destination, makes the move once the screen is
 * covered (carry(c): carryAcross with the game's player, rig and camera), holds while the new place
 * settles (busy()), and reveals it.
 */
export class Passage {
  /**
   * @param o.cover  PassageCover (or anything with cover(secs) / reveal(secs))
   * @param o.warm   WarmDraw, or null
   * @param o.carry  (c) => void: the move itself (c: what go() was given)
   * @param o.busy   () => true while the new place is still being set up (grass being placed)
   */
  constructor({ cover = null, warm = null, carry = () => {}, busy = () => false } = {}) {
    Object.assign(this, { cover, warm, carry, busy });
    this.cur = null;
    this.ahead = [];          // meshes of a destination you are near, drawn a slice a frame
    this._aheadFor = null;
    this.moves = 0;
  }

  get active() { return !!this.cur; }
  /** True from go() until the move (the screen is covered or coming covered). */
  get covering() { return this.cur?.phase === 'cover'; }

  /** As you come near a way through: its destination drawn ahead, a slice a frame (once per place). */
  prepare(to, radius = PASSAGE.radius) {
    if (!this.warm || !to || this._aheadFor === to) return;
    this._aheadFor = to;
    this.ahead = this.warm.near([to], radius);
  }

  /**
   * Begin a hand-over. o: { to, heading, up, fwd, speed (null: kept), radius, onMove(c) }.
   * Returns false if one is already under way.
   */
  go(o) {
    if (this.cur) return false;
    const warm = this.warm ? this.warm.near([o.to], o.radius ?? PASSAGE.radius) : [];
    this.cur = { ...o, phase: 'cover', t: 0, frames: 0, warm };
    this.cover?.cover(PASSAGE.cover);
    return true;
  }

  /** Each frame, before the traveller and the camera move. Returns the phase (or null). */
  update(dt) {
    // ahead of time: a slice a frame of the place you are near
    if (!this.cur && this.ahead.length && this.warm) this.warm.draw(this.ahead.splice(0, PASSAGE.perFrame));
    const c = this.cur;
    if (!c) return null;
    c.t += dt;
    if (c.phase === 'cover') {
      if (c.warm.length) this.warm.draw(c.warm.splice(0, PASSAGE.perFrame));
      // (the frame after the sheet arrives: real time runs at least as fast as the game's clamped clock)
      const covered = c.t >= PASSAGE.cover + 1 / 60;
      if (covered && (!c.warm.length || c.t >= PASSAGE.cover + PASSAGE.warmMax)) {
        if (c.warm.length) this.warm.draw(c.warm.splice(0));   // (behind the cover by now)
        this.carry(c);
        c.onMove?.(c);
        this.moves++;
        c.phase = 'hold'; c.t = 0; c.frames = 0;
      }
    } else if (c.phase === 'hold') {
      if (++c.frames >= PASSAGE.holdMin && (!this.busy() || c.t >= PASSAGE.holdMax)) {
        this.cover?.reveal(PASSAGE.reveal);
        c.phase = 'reveal'; c.t = 0;
      }
    } else if (c.phase === 'reveal' && c.t >= PASSAGE.reveal) {
      this.cur = null;
      return 'done';
    }
    return c.phase;
  }
}
