import * as THREE from 'three';
import { makeMaterial } from './materials.js';

// Ground warnings (issue #758, docs/systems/foes.md "Ground warnings"): what a few attacks draw on the ground, inked
// into it after the author's picked sheets (references/effects/<id>/sheet-1.jpg), never a flat disc floating over it.
//
//   lob    a thrown rock, a spat glob (attack.lob): the projectile's own shadow at the landing spot, small and soft
//          (hatched round its edge) and then darker and crisper as the wind-up runs out, a thin red-orange inked ring
//          tightening round it onto the hit radius with four ticks pointing in, and at the impact a burst of grit
//          strokes inside exactly that ring.
//   area   a blast about to go off (attack.selfDestruct: the crawler): a dashed inked ring at the blast's radius, the
//          grass round it inked leaning outward, radial hatching growing in from the ring, the zone turning warm
//          orange just before, then a blast flower whose petals reach exactly to the ring.
//   wave   a shockwave running out over the ground (attack.wave: the hulk's stomp, the quake, the toll): the wave
//          itself, a knee-high curl of sand and air with a red-orange crest, speed lines inked on the ground behind
//          it, grit thrown off it. Its footprint is the hit's band (r ± width); it is not drawn where it cannot hit
//          (a step more than SHOCK_STEP up or down from where it started). At its reach it leaves a scored ring that fades
//          and settling dust (the picked sheet's last panel).
//
// Every stroke is drawn on the ground under it (the physics' groundAt, cached on a grid round each warning, so a
// ring on a slope or a stair follows it); everything is four instanced meshes with a colour an instance (strokes,
// discs, the wave's curl, its crest), plain makeMaterial surfaces: no shader of their own, so the engines draw them as
// they draw the Rings (engine/mirror.js instances). Warnings are touched each frame by what draws them (Foes.anim, a
// guardian's tells, the shocks) and let go when not touched; their state objects are pooled, the instance buffers
// fixed in size.

/** The look (sRGB): the ink, the red-orange accent, the warm orange, the soft shadow, the tint, the blast, the dust. */
export const GW_TONE = {
  ink: '#2b211f', accent: '#d9472b', warm: '#f08a3a', soft: '#a2968a', tint: '#f4a971',
  petal: '#ec6a3c', heart: '#f9c98a', dust: '#f3d3ae', crest: '#e0583a',
};
/** The lob's mark: the ring starts this much wider than the hit (×R), the shadow this share of R small → big. */
export const LOB = { wide: 0.45, tight: 0.9, ring: 36, dashUntil: 0.3, ticksFrom: 0.25, shadow: [0.18, 0.36], hatch: 10, burst: 0.4, grit: 14 };
/** The area's mark: segments, hatch lines, leaning blades, when the hatching grows and the orange comes, the flower. */
export const AREA = { ring: 48, hatch: 48, lean: 24, fill: [0.35, 0.75], warm: 0.72, flower: 0.45, petals: 12 };
/** The wave's curl: height (m, knee-high), segment length (m), at least / at most, speed lines, the step it skips. */
export const SHOCK = { height: 0.55, seg: 0.45, min: 24, max: 96, lines: 24, grow: 0.15, fade: 0.2, scar: 1.1 };
/** A wave is not drawn where the ground is this far up or down from where it started (it does not hit there). */
export const SHOCK_STEP = 1.2;
/** How far over the ground the strokes sit (m), by layer. */
const LIFT = { tint: 0.02, hatch: 0.026, shadow: 0.03, ring: 0.034, flower: 0.045 };
/** The ground's cache: cell (m) and how many cells before it is cleared. */
export const CELL = 0.5, CELLS = 6000;
/** The instance buffers' sizes. */
export const CAP = { strokes: 1536, discs: 96, curls: 480 };

const _m = new THREE.Matrix4(), _x = new THREE.Vector3(), _y = new THREE.Vector3(), _z = new THREE.Vector3(), _c = new THREE.Color();
const smooth = THREE.MathUtils.smoothstep, lerp = THREE.MathUtils.lerp;
const TONES = {};
const tone = (hex) => (TONES[hex] ??= new THREE.Color(hex));
const mix = (a, b, t) => _c.copy(tone(a)).lerp(tone(b), Math.min(1, Math.max(0, t)));

/** The lob's ring radius at wind-up progress k (never inside the hit's radius R; exactly R from LOB.tight on). */
export const lobRing = (R, k) => R * (1 + LOB.wide * (1 - smooth(k, 0, LOB.tight)));
/** The lob's shadow radius at k. */
export const lobShadow = (R, k) => R * lerp(LOB.shadow[0], LOB.shadow[1], smooth(k, 0, 1));
/** How far in from the ring the area's hatching has grown (share of R) at k. */
export const areaFill = (k) => smooth(k, AREA.fill[0], AREA.fill[1]) * 0.85;
/** The wave's curl height at radius r of a wave from r0 to reach (grows in, fades out). */
export function shockHeight(r, r0, reach) {
  const span = Math.max(0.01, reach - r0), u = (r - r0) / span;
  return SHOCK.height * smooth(u, 0, SHOCK.grow) * (1 - smooth(u, 1 - SHOCK.fade, 1));
}

/** The curl's cross-section (z across the front, -1 behind .. 1 ahead; y up, 0..1). */
const PROFILE = [[-1, 0], [-0.55, 0.25], [-0.1, 0.62], [0.3, 0.92], [0.62, 1], [0.88, 0.86], [0.98, 0.62], [0.86, 0.45]];
function extrude(points, off = 0) {
  const pos = [], idx = [];
  points.forEach(([z, y], i) => {
    // (nudged out along the profile's normal: the crest sits on the curl, never in it)
    const a = points[Math.max(0, i - 1)], b = points[Math.min(points.length - 1, i + 1)];
    const tz = b[0] - a[0], ty = b[1] - a[1], l = Math.hypot(tz, ty) || 1;
    const nz = ty / l, ny = -tz / l, zz = z + nz * off, yy = y + Math.abs(ny) * off;
    pos.push(-0.5, yy, zz, 0.5, yy, zz);
    if (i) { const j = i * 2; idx.push(j - 2, j - 1, j, j - 1, j + 1, j); }
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}
export const curlGeometry = () => extrude(PROFILE);
export const crestGeometry = () => extrude(PROFILE.slice(3), 0.04);

function pool(parent, geo, mat, cap, name) {
  const mesh = new THREE.InstancedMesh(geo, mat, cap);
  mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
  mesh.count = 0; mesh.visible = false; mesh.frustumCulled = false; mesh.name = name;
  mesh.userData.noCollide = true; mesh.userData.dynamic = true; mesh.castShadow = false; mesh.receiveShadow = false;
  parent.add(mesh);
  return { mesh, cap, n: 0 };
}

export class GroundWarnings {
  /**
   * parent: the scene (or a group in it); groundAt(x, fromY, z, maxDrop): the ground's height (physics.groundAt);
   * drops(): the tool's drop pool for grit (optional).
   */
  constructor(parent, { groundAt = null, drops = null } = {}) {
    this.groundAt = groundAt; this.drops = drops;
    this.strokes = pool(parent, new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), makeMaterial({ color: '#ffffff', flat: true, glow: 0.6, line: 0.25, side: THREE.DoubleSide, key: 'gw-strokes' }), CAP.strokes, 'ground-warning-strokes');
    this.discs = pool(parent, new THREE.CircleGeometry(1, 28).rotateX(-Math.PI / 2), makeMaterial({ color: '#ffffff', flat: true, glow: 0.45, line: 0.25, side: THREE.DoubleSide, key: 'gw-discs' }), CAP.discs, 'ground-warning-discs');
    this.curls = pool(parent, curlGeometry(), makeMaterial({ color: '#ffffff', flat: true, glow: 0.35, side: THREE.DoubleSide, key: 'gw-curl' }), CAP.curls, 'ground-warning-curl');
    this.crests = pool(parent, crestGeometry(), makeMaterial({ color: '#ffffff', flat: true, glow: 0.7, side: THREE.DoubleSide, key: 'gw-crest' }), CAP.curls, 'ground-warning-crest');
    this.live = new Map();     // key → warning (touched this frame or let go)
    this.free = [];            // pooled warnings
    this.bursts = []; this.freeBursts = [];
    this.cells = new Map();
    this.frame = 0; this.idle = 0;
    this.stats = { warnings: 0, bursts: 0, strokes: 0, discs: 0, curls: 0, rays: 0, made: 0 };
  }

  /** A warning for `key` (an object: the foe, a shock), made or taken from the pool, touched this frame. */
  touch(key, kind, sub = 0) {
    let byKey = this.live.get(key);
    if (!byKey) this.live.set(key, (byKey = []));
    let w = byKey[sub];
    if (!w || w.kind !== kind) {
      w = byKey[sub] = this.free.pop() ?? (this.stats.made++, { at: new THREE.Vector3() });
      w.kind = kind; w.k = 0; w.r = 0; w.r0 = 0; w.R = 1; w.width = 0.5; w.reach = 1; w.tone = null; w.peak = 0;
    }
    w.seen = this.frame;
    return w;
  }
  /** A lob's landing mark for key (the i-th of a volley) at `at`, hit radius R, wind-up progress k. */
  lob(key, at, R, k, i = 0) { const w = this.touch(key, 'lob', i); w.at.copy(at); w.R = R; w.k = k; w.peak = Math.max(w.peak, k); return w; }
  /** An area about to blow (radius R) at `at`, progress k. */
  area(key, at, R, k) { const w = this.touch(key, 'area', 0); w.at.copy(at); w.R = R; w.k = k; w.peak = Math.max(w.peak, k); return w; }
  /** A shockwave from `at` now at radius r (from r0 out to reach, its front ± width), its crest's tone. */
  shock(key, at, r, { r0 = 1, reach = 8, width = 0.55, tone: t = null } = {}) {
    const w = this.touch(key, 'shock', 0); w.at.copy(at); w.r = r; w.r0 = r0; w.reach = reach; w.width = width; w.tone = t; return w;
  }
  /** Is anything drawn for key now (a test's question; the foes' `marked`). */
  has(key) { return this.of(key).length > 0; }
  /** What key draws now (touched this frame, or drawn by the last update): its warnings (kind, r, R, k). */
  of(key) { return (this.live.get(key) ?? []).filter((w) => w && w.seen >= this.frame - 1); }

  /** The impact of a lob (grit inside its ring), an area's blast (the flower to its ring) or a wave spent at its reach (a scored ring), at `at`, radius R. */
  impact(kind, at, R) {
    const b = this.freeBursts.pop() ?? { at: new THREE.Vector3() };
    b.kind = kind; b.at.copy(at); b.R = R; b.t = 0; b.life = kind === 'area' ? AREA.flower : kind === 'wave' ? SHOCK.scar : LOB.burst; b.seed = Math.random() * 6.283;
    this.bursts.push(b);
    const D = typeof this.drops === 'function' ? this.drops() : this.drops;
    if (D?.add) {
      const n = kind === 'area' ? 18 : kind === 'wave' ? 24 : 12, gy = this.on(at.x, at.z, at.y) + 0.1;
      for (let i = 0; i < n; i++) {
        const a = Math.random() * 6.283, s = kind === 'wave' ? R * (0.92 + Math.random() * 0.08) : Math.random() * R * 0.8;
        D.add({ pos: _x.set(at.x + Math.sin(a) * s, gy, at.z + Math.cos(a) * s), vel: _y.set(Math.sin(a) * (1 + Math.random() * 2), 2 + Math.random() * 3, Math.cos(a) * (1 + Math.random() * 2)), drag: 2, grav: 9, size: 0.04 + Math.random() * 0.05, life: 0.55, color: i % 3 ? '#cdb89a' : GW_TONE.ink });
      }
    }
  }

  /** The ground's height at x, z near refY (cached on CELL, bilinear between cells): NaN where there is none near it. */
  height(x, z, refY) {
    const fx = x / CELL, fz = z / CELL, ix = Math.floor(fx), iz = Math.floor(fz), tx = fx - ix, tz = fz - iz;
    const a = this.cell(ix, iz, refY), b = this.cell(ix + 1, iz, refY), c = this.cell(ix, iz + 1, refY), d = this.cell(ix + 1, iz + 1, refY);
    return lerp(lerp(a, b, tx), lerp(c, d, tx), tz);
  }
  /** The ground's height at x, z, or the warning's own level where there is none near it (a mark over a ledge's edge). */
  on(x, z, refY) { const h = this.height(x, z, refY); return Number.isFinite(h) ? h : refY; }
  cell(ix, iz, refY) {
    const band = Math.floor(refY / 3), key = `${ix},${iz},${band}`;
    let h = this.cells.get(key);
    if (h !== undefined) return h;
    if (this.cells.size > CELLS) this.cells.clear();
    const g = this.groundAt ? (this.stats.rays++, this.groundAt(ix * CELL, refY + 2, iz * CELL, 6)) : NaN;
    h = Number.isFinite(g) && Math.abs(g - refY) < 2.5 ? g : NaN;   // (nothing under it near its level: a ledge, a drop)
    this.cells.set(key, h);
    return h;
  }

  /** One inked stroke on the ground from (ax, az) to (bx, bz), w wide. */
  stroke(ax, az, bx, bz, refY, w, color, lift = LIFT.ring) {
    const S = this.strokes;
    if (S.n >= S.cap) return;
    const ha = this.on(ax, az, refY), hb = this.on(bx, bz, refY);
    _x.set(bx - ax, hb - ha, bz - az);
    const len = _x.length();
    if (len < 1e-4) return;
    _x.divideScalar(len);
    _z.set(-_x.z, 0, _x.x).normalize();             // (across, level)
    _y.crossVectors(_z, _x).normalize();             // (up, off the slope)
    _m.makeBasis(_x.multiplyScalar(len), _y, _z.multiplyScalar(w));
    _m.setPosition((ax + bx) / 2, (ha + hb) / 2 + lift, (az + bz) / 2);
    S.mesh.setMatrixAt(S.n, _m); S.mesh.setColorAt(S.n, color); S.n++;
  }
  /** A stroke from radius r1 to r2 along the angle a round (cx, cz). */
  radial(cx, cz, refY, a, r1, r2, w, color, lift) {
    const s = Math.sin(a), c = Math.cos(a);
    this.stroke(cx + s * r1, cz + c * r1, cx + s * r2, cz + c * r2, refY, w, color, lift);
  }
  /** A ring of n segments at radius r round (cx, cz); dashed: every other one. */
  ring(cx, cz, refY, r, n, w, color, dashed = false, lift = LIFT.ring) {
    const step = (Math.PI * 2) / n;
    for (let i = 0; i < n; i++) {
      if (dashed && i % 2) continue;
      const a0 = i * step, a1 = a0 + step * (dashed ? 0.9 : 1.04);
      this.stroke(cx + Math.sin(a0) * r, cz + Math.cos(a0) * r, cx + Math.sin(a1) * r, cz + Math.cos(a1) * r, refY, w, color, lift);
    }
  }
  /** A flat ellipse on the ground (rx across its yaw, rz along), tilted to the slope under it. */
  disc(x, z, refY, rx, rz, yaw, color, lift = LIFT.shadow, tilt = 0) {
    const D = this.discs;
    if (D.n >= D.cap) return;
    const e = Math.max(0.2, Math.max(rx, rz) * 0.6);
    const h = this.on(x, z, refY), hx = this.on(x + e, z, refY) - this.on(x - e, z, refY), hz = this.on(x, z + e, refY) - this.on(x, z - e, refY);
    const up = _y.set(-hx / (2 * e), 1, -hz / (2 * e)).normalize();
    const s = Math.sin(yaw), c = Math.cos(yaw);
    _z.set(s, 0, c); _x.crossVectors(up, _z).normalize(); _z.crossVectors(_x, up).normalize();
    if (tilt) { _z.addScaledVector(up, Math.tan(tilt)).normalize(); up.crossVectors(_z, _x).normalize(); }
    _m.makeBasis(_x.multiplyScalar(rx), up, _z.multiplyScalar(rz));
    _m.setPosition(x, h + lift, z);
    D.mesh.setMatrixAt(D.n, _m); D.mesh.setColorAt(D.n, color); D.n++;
  }

  drawLob(w) {
    const { at, R, k } = w, cx = at.x, cz = at.z, y = at.y;
    const rr = lobRing(R, k), e = smooth(k, 0, 1);
    // the shadow: soft (pale, hatched round it) to crisp (ink, no hatching)
    const sr = lobShadow(R, k);
    this.disc(cx, cz, y, sr, sr * 0.85, 0.6, mix(GW_TONE.soft, GW_TONE.ink, e * e));
    const soft = 1 - smooth(k, 0.2, 0.85);
    if (soft > 0.02) {
      const pr = sr * (1 + 0.9 * soft), n = LOB.hatch, col = mix(GW_TONE.soft, GW_TONE.ink, e * 0.6);
      for (let i = 0; i < n; i++) {
        // parallel strokes across the penumbra (a fixed slant, as a pen would), clipped to its ellipse
        const u = (i + 0.5) / n * 2 - 1, half = Math.sqrt(Math.max(0, 1 - u * u)) * pr;
        const ox = u * pr * 0.7071, oz = -u * pr * 0.7071;
        this.stroke(cx + ox - half * 0.7071, cz + oz - half * 0.7071, cx + ox + half * 0.7071, cz + oz + half * 0.7071, y, 0.018 + 0.012 * soft, col, LIFT.hatch);
      }
    }
    // the ring tightening onto the hit, dashed at first, its ink under it once it is drawn
    const dashed = k < LOB.dashUntil, col = mix('#e89a6a', GW_TONE.accent, smooth(k, 0, 0.6));
    if (!dashed) this.ring(cx, cz, y, rr + 0.05, LOB.ring, 0.022, tone(GW_TONE.ink), false, LIFT.hatch);
    this.ring(cx, cz, y, rr, LOB.ring, lerp(0.045, 0.075, e), col, dashed);
    if (k > LOB.ticksFrom) {
      const tk = smooth(k, LOB.ticksFrom, 0.5);
      for (let i = 0; i < 4; i++) this.radial(cx, cz, y, Math.PI / 4 + i * Math.PI / 2, rr + 0.14 * tk, rr - 0.24 * R * tk, 0.06, col, LIFT.flower);
    }
  }

  drawArea(w) {
    const { at, R, k } = w, cx = at.x, cz = at.z, y = at.y;
    const warm = smooth(k, AREA.warm, 0.95), lean = smooth(k, 0, 0.6), fill = areaFill(k);
    const ink = tone(GW_TONE.ink);
    // the zone turning warm orange just before (grown out from the middle)
    const tint = smooth(k, AREA.warm, 0.92);
    if (tint > 0.01) this.disc(cx, cz, y, R * tint, R * tint, 0, tone(GW_TONE.tint), LIFT.tint);
    // the ring: dashed ink, then solid red-orange
    // (dashed and faint while it only smoulders, solid once the hatching grows in from it)
    this.ring(cx, cz, y, R, AREA.ring, lerp(0.03, 0.06, k), warm > 0.5 ? tone(GW_TONE.accent) : ink, k < AREA.fill[0]);
    // the grass at its edge leaning outward
    for (let i = 0; i < AREA.lean; i++) {
      const a = (i + 0.5) / AREA.lean * Math.PI * 2 + 0.07 * Math.sin(i * 7.3);
      this.radial(cx, cz, y, a, R + 0.14, R + 0.14 + (0.12 + 0.08 * (i % 3) / 2) * (0.3 + 0.7 * lean), 0.016, ink, LIFT.hatch);
    }
    // the radial hatching growing in from the ring
    if (fill > 0.01) {
      const col = mix(GW_TONE.ink, GW_TONE.accent, warm);
      for (let i = 0; i < AREA.hatch; i++) {
        const a = (i / AREA.hatch) * Math.PI * 2, f = fill * (i % 2 ? 0.72 : 1);
        this.radial(cx, cz, y, a, R * 0.98, R * (1 - f), 0.02, col, LIFT.hatch);
      }
    }
  }

  drawShock(w) {
    const { at, r, width } = w, y = at.y;
    const h = shockHeight(r, w.r0, w.reach);
    if (h <= 0.005 || r <= 0.05) return;
    const C = this.curls, X = this.crests, n = Math.min(SHOCK.max, Math.max(SHOCK.min, Math.round((Math.PI * 2 * r) / SHOCK.seg)));
    const step = (Math.PI * 2) / n, seg = 2 * r * Math.sin(step / 2) * 1.08;
    const body = tone(GW_TONE.dust), crest = tone(w.tone ?? GW_TONE.crest);
    for (let i = 0; i < n && C.n < C.cap; i++) {
      const a = i * step, s = Math.sin(a), c = Math.cos(a);
      const px = at.x + s * r, pz = at.z + c * r, g = this.height(px, pz, y);
      if (!(Math.abs(g - y) <= SHOCK_STEP)) continue;   // (it does not hit up there or down there, or over a drop: not drawn)
      const near = (h) => (Math.abs(h - g) <= SHOCK_STEP ? h : g);
      const gf = near(this.height(px + s * width, pz + c * width, y)), gb = near(this.height(px - s * width, pz - c * width, y));
      const ga = near(this.height(at.x + Math.sin(a + step) * r, at.z + Math.cos(a + step) * r, y)), gc = near(this.height(at.x + Math.sin(a - step) * r, at.z + Math.cos(a - step) * r, y));
      _x.set(c * seg, (ga - gc) / 2, -s * seg);   // tangent (turning clockwise from above, +x of the profile)
      _z.set(s * 2 * width, gf - gb, c * 2 * width).multiplyScalar(0.5);   // across the front, outward (±width)
      // (lumpy, as the sheet's rolling curl: each segment its own height and a little ahead or behind, fixed round the ring)
      const lump = 0.88 + 0.12 * Math.sin(i * 0.9 + 1.3), wob = 0.05 * width * Math.sin(i * 1.7);
      _y.crossVectors(_z, _x).normalize().multiplyScalar(h * lump);
      if (_y.y < 0) _y.negate();
      _m.makeBasis(_x, _y, _z); _m.setPosition(px + s * wob, g + 0.01, pz + c * wob);
      C.mesh.setMatrixAt(C.n, _m); C.mesh.setColorAt(C.n, body); C.n++;
      X.mesh.setMatrixAt(X.n, _m); X.mesh.setColorAt(X.n, crest); X.n++;
    }
    // speed lines inked on the ground behind it
    const L = Math.min(1.4, r - width - w.r0), ink = tone(GW_TONE.ink);
    if (L > 0.1) for (let i = 0; i < SHOCK.lines; i++) {
      const a = (i + 0.37 * (i % 3)) / SHOCK.lines * Math.PI * 2, back = r - width - 0.1;
      this.radial(at.x, at.z, y, a, back, back - L * (i % 2 ? 0.6 : 1), 0.02, ink, LIFT.hatch);
    }
    // grit thrown off its crest, a little each frame
    const D = typeof this.drops === 'function' ? this.drops() : this.drops;
    if (D?.add && h > 0.15) for (let i = 0; i < 2; i++) {
      const a = Math.random() * 6.283, s = Math.sin(a), c = Math.cos(a);
      D.add({ pos: _x.set(at.x + s * r, y + h * 0.9, at.z + c * r), vel: _z.set(s * 2.5, 1.5 + Math.random() * 1.5, c * 2.5), drag: 2.5, grav: 8, size: 0.04 + Math.random() * 0.04, life: 0.45, color: i || Math.random() < 0.6 ? '#cdb89a' : GW_TONE.ink });
    }
  }

  drawBurst(b) {
    const u = b.t / b.life, { at, R } = b, y = at.y;
    if (b.kind === 'lob') {
      // grit strokes flung out from the middle, every one inside the ring; the ring itself, still, fading thin
      const out = smooth(u, 0, 0.5), fade = 1 - smooth(u, 0.5, 1);
      this.ring(at.x, at.z, y, R, LOB.ring, 0.07 * fade + 0.01, tone(GW_TONE.accent));
      for (let i = 0; i < LOB.grit; i++) {
        const a = b.seed + (i / LOB.grit) * Math.PI * 2 + 0.2 * Math.sin(i * 5.1), far = R * (0.55 + 0.4 * ((i * 7) % 5) / 4);
        const r2 = far * (0.35 + 0.65 * out), r1 = Math.max(0.05, r2 - (0.18 + 0.2 * fade) * R);
        this.radial(at.x, at.z, y, a, r1, Math.min(r2, R * 0.97), 0.035 * fade + 0.01, i % 4 ? tone(GW_TONE.ink) : tone(GW_TONE.accent), LIFT.flower);
      }
      return;
    }
    if (b.kind === 'wave') {
      // the wave spent at its reach: a scored ring in the ground, a second fainter inside it, scuffs across them, fading
      const fade = 1 - smooth(u, 0.25, 1), w = 0.05 * fade;
      if (w < 0.004) return;
      const ink = mix(GW_TONE.dust, GW_TONE.ink, fade);
      this.ring(at.x, at.z, y, R, SHOCK.max, w, ink, false, LIFT.hatch);
      this.ring(at.x, at.z, y, R - 0.3, SHOCK.max, w * 0.6, ink, true, LIFT.hatch);
      for (let i = 0; i < SHOCK.lines; i++) {
        const a = b.seed + (i / SHOCK.lines) * Math.PI * 2;
        this.radial(at.x, at.z, y, a, R - 0.45, R + 0.08 + 0.1 * (i % 3), w * 0.7, ink, LIFT.hatch);
      }
      return;
    }
    // the blast flower: petals out to exactly the ring, a pale heart, then gone
    const grow = smooth(u, 0, 0.35), fall = 1 - smooth(u, 0.6, 1), s = grow * fall;
    if (s <= 0.01) return;
    const P = AREA.petals;
    for (let i = 0; i < P; i++) {
      const a = b.seed + (i / P) * Math.PI * 2, len = R * (i % 2 ? 0.42 : 0.5) * s, mid = R * grow - len;
      this.disc(at.x + Math.sin(a) * mid, at.z + Math.cos(a) * mid, y, R * 0.16 * s, len, a, tone(GW_TONE.petal), LIFT.flower + (i % 2) * 0.006, 0.3);
    }
    this.disc(at.x, at.z, y, R * 0.45 * s, R * 0.45 * s, 0, tone(GW_TONE.heart), LIFT.flower + 0.014);
    this.ring(at.x, at.z, y, R * grow, AREA.ring, 0.05 * fall, tone(GW_TONE.ink));
  }

  /** Once a frame, after everything has touched its warnings: draw them, let go of the untouched, age the bursts. */
  update(dt) {
    for (const P of [this.strokes, this.discs, this.curls, this.crests]) P.n = 0;
    let warnings = 0;
    for (const [key, list] of this.live) {
      let kept = false;
      for (let i = 0; i < list.length; i++) {
        const w = list[i];
        if (!w) continue;
        if (w.seen !== this.frame) { this.free.push(w); list[i] = null; continue; }
        kept = true; warnings++;
        if (w.kind === 'lob') this.drawLob(w); else if (w.kind === 'area') this.drawArea(w); else this.drawShock(w);
      }
      if (!kept) this.live.delete(key);
    }
    for (const b of this.bursts) { b.t += dt; if (b.t < b.life) this.drawBurst(b); }
    for (let i = this.bursts.length - 1; i >= 0; i--) if (this.bursts[i].t >= this.bursts[i].life) this.freeBursts.push(...this.bursts.splice(i, 1));
    for (const P of [this.strokes, this.discs, this.curls, this.crests]) {
      const M = P.mesh, was = M.count;
      M.count = P.n; M.visible = P.n > 0;
      if (P.n || was) {
        M.instanceMatrix.clearUpdateRanges(); M.instanceMatrix.addUpdateRange(0, Math.max(1, P.n) * 16); M.instanceMatrix.needsUpdate = true;
        M.instanceColor.clearUpdateRanges(); M.instanceColor.addUpdateRange(0, Math.max(1, P.n) * 3); M.instanceColor.needsUpdate = true;
      }
    }
    // (nothing drawn a while: the ground's cache goes, as the world may have changed under it)
    this.idle = warnings || this.bursts.length ? 0 : this.idle + dt;
    if (this.idle > 2 && this.cells.size) this.cells.clear();
    Object.assign(this.stats, { warnings, bursts: this.bursts.length, strokes: this.strokes.n, discs: this.discs.n, curls: this.curls.n });
    this.frame++;
  }

  /** One tiny instance of each drawn, so their programs compile with the rest (Foes.prewarm's group, then disposed). */
  prewarm() {
    _m.makeScale(1e-3, 1e-3, 1e-3);
    for (const P of [this.strokes, this.discs, this.curls, this.crests]) { P.mesh.setMatrixAt(0, _m); P.mesh.setColorAt(0, tone(GW_TONE.ink)); P.mesh.count = 1; P.mesh.visible = true; }
  }
  /** Everything let go at once (a fight's end, a level's): back to the pool. */
  clear() {
    for (const list of this.live.values()) for (const w of list) if (w) this.free.push(w);
    this.live.clear();
    this.freeBursts.push(...this.bursts); this.bursts.length = 0;
    this.cells.clear();
  }
  dispose() {
    this.clear();
    for (const P of [this.strokes, this.discs, this.curls, this.crests]) { P.mesh.removeFromParent(); P.mesh.geometry.dispose(); P.mesh.dispose?.(); }
  }
}
