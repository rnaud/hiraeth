import * as THREE from 'three';
import { makeMaterial } from './materials.js';

/**
 * The hit burst (issue #713; docs/systems/foes.md, "Feel"): where a cut lands, an inked burst for a few frames, so it reads
 * at once that the blow connected. Breath of the Wild marks a landed hit with a bright star of light at the contact for a
 * few frames, the world frozen a moment under it, the foe flashing; its heavy blows bigger, with a streak along the cut.
 * Hiraeth's in Moebius's ink: amber and gold rays round a tiny cream core, each ray cut out of a black one a little bigger (an inked
 * edge), flat and turned to the camera; a heavy blow (the combo's third, the charged cut, the riposte) more rays, longer,
 * with a long inked streak along the blade's way through the point. Its clock is the traveller's (FluidTool.update's dt),
 * so a hit-stop holds its first, biggest frame on the screen through the freeze, then it bursts out and is gone.
 *
 * One InstancedMesh (makeMaterial, flat, one draw for every burst on screen: cheap on a handheld; mirrored to the engines
 * as the rings are), each ray a tapered flat needle. Its look and timing: HIT_BURST.
 */
export const HIT_BURST = {
  max: 6,                                           // bursts at once (the oldest gives way)
  light: { rays: 18, reach: 1.05, life: 0.14, core: 0.14, streak: 0, flecks: 5 },
  heavy: { rays: 25, reach: 1.6, life: 0.22, core: 0.18, streak: 5.8, flecks: 7 },
  pop: 0.72,                                        // the rays' length on the first frame (of their full)
  grow: 0.3,                                        // the share of its life over which the rays reach their full length
  width: 0.095,                                       // a ray's width (of its length)
  rim: [1.18, 1.035],                                 // the ink behind a ray: its width, its length (times the ray's)
  into: 0.35,                                       // drawn this share of the way from the contact into the struck body's middle (fluid-blade.js)
  toward: 0.45,                                     // the share of the way to the camera it is drawn at, shrunk to match: the same size on
                                                    // the screen, in front of the body it struck and of the traveller (the camera
                                                    // behind him), as Breath of the Wild's star is drawn over everything
  tones: { ink: '#392936', light: '#ffc32b', amber: '#ef7924', core: '#fff3cf' },   // the ink, the rays, the core
};
const H_DIAGONAL = 2.4;   // (rad, as burstPieces turns: a falling diagonal through the point)
const PER = 2 * (HIT_BURST.heavy.rays + HIT_BURST.heavy.flecks) + 4 + 4;      // instances one burst may take: the rays and their ink, the core's four, the streak's two halves and their ink

/** A flat diamond in xy, from its foot at the origin to its point at y = 1, `1` wide at 8 % of the way: facing +z. */
function diamond() {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0.5, 0.08, 0, 0, 1, 0, -0.5, 0.08, 0], 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1], 3));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  return g;
}

/**
 * The pieces of a burst `age` s old (pure: tests): each { kind: 'ink'|'light'|'core', angle (rad, in the screen's plane,
 * 0 up), from (m out from the centre to its foot), length, width (m), lift (m toward the camera) }; [] once it is over.
 */
export function burstPieces(b, age, H = HIT_BURST) {
  const S = b.heavy ? H.heavy : H.light, k = age / S.life;
  if (!(k >= 0) || k >= 1) return [];
  const out = [], size = b.size ?? 1;
  const grow = Math.min(1, H.pop + (1 - H.pop) * (k / H.grow));
  const axis = b.cut ?? b.spin;
  // A dense, irregular fan of needles, not evenly sized petals. The longest needle follows the blade.
  // Width is independent of length, so a long ray stays sharp instead of turning into a broad kite.
  const pair = (a, from, len, w, tone, extra = {}) => {
    out.push({ kind: 'ink', angle: a, from: from - len * (H.rim[1] - 1) * 0.25, length: len * H.rim[1], width: w * H.rim[0], lift: 0, ...extra });
    out.push({ kind: 'light', tone, angle: a, from, length: len, width: w, lift: 0.01, ...extra });
  };
  if (k < 0.68) for (let i = 0; i < S.rays; i++) {
    const noise = (b.jitter?.[i] ?? Math.sin(i * 12.9898) * 0.5) + 0.5;
    const a = axis + (i / S.rays) * Math.PI * 2 + (i ? (noise - 0.5) * Math.PI * 1.5 / S.rays : 0);
    const fan = 0.65 + 0.35 * Math.max(0, Math.cos(a - axis));
    // Two unequal shoulders support the leading spike: one long needle alone reads like a pointer.
    const length = i === 0 ? 1.55 : i === 1 ? 1.12 : i === S.rays - 2 ? 0.96 : (0.24 + noise * 0.76) * fan;
    const len = S.reach * size * length * grow * (1 - 0.5 * k);
    const w = S.reach * size * H.width * (i === 0 ? 1.15 : 0.35 + noise * 0.65) * (1 - k / 0.68);
    pair(a, S.reach * size * 0.015, len, w, i % 3 === 1 ? 'amber' : 'light');
  }
  // Detached amber slivers travel out after contact; they outlast the central flash, then shrink away.
  for (let i = 0; i < S.flecks; i++) {
    const noise = (b.jitter?.[i + 3] ?? Math.sin((i + 3) * 12.9898) * 0.5) + 0.5;
    const a = axis - 1.4 + i * 2.8 / Math.max(1, S.flecks - 1) + (noise - 0.5) * 0.4;
    const travel = 1 - (1 - k) ** 3; // fast release, slowing tail rather than uniform radial motion
    const len = S.reach * size * (0.12 + noise * 0.18) * Math.min(1, (1 - k) / 0.25);
    pair(a, S.reach * size * (0.65 + noise * 0.45 + travel * 0.9), len, len * 0.3, i % 2 ? 'amber' : 'light', { fleck: true });
  }
  // the core: a small four-pointed cream star, full on the first frame, gone by half its life
  const c = Math.max(0, 1 - k * 2);
  if (c > 0) for (let i = 0; i < 4; i++) out.push({ kind: 'core', angle: b.spin + Math.PI / 4 + (i * Math.PI) / 2, from: 0, length: S.core * size * c, width: S.core * size * c * 0.55, lift: 0.02 });
  // a heavy blow: a long thin streak along the cut, through the point (two spindles back to back), thinning out
  if (k < 0.68 && S.streak > 0 && b.cut !== null && b.cut !== undefined) {
    const half = 0.5 * S.streak * size * (0.8 + 0.2 * Math.min(1, k / H.grow)), w = 0.025 * size * (1 - k / 0.68);
    for (const a of [b.cut, b.cut + Math.PI]) {
      out.push({ kind: 'ink', angle: a, from: -0.03, length: half + 0.06, width: w * 1.3, lift: 0, streak: true });
      out.push({ kind: 'light', angle: a, from: 0, length: half, width: w, lift: 0.01, streak: true });
    }
  }
  return out;
}

export class HitBursts {
  /** parent: the group it is drawn in; camera: the view it turns to (read each frame: a getter or the camera). */
  constructor(parent, camera, H = HIT_BURST) {
    this.H = H; this.camera = camera; this.list = [];
    const max = H.max * PER;
    this.mesh = new THREE.InstancedMesh(diamond(), makeMaterial({ color: '#ffffff', flat: true, glow: 0.45, line: 0.25, lineTint: 0.35 }), max);
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3);
    this.mesh.name = 'Hit bursts'; this.mesh.frustumCulled = false; this.mesh.count = 0; this.mesh.userData.noCollide = true;
    parent?.add(this.mesh);
    this.colors = Object.fromEntries(Object.entries(H.tones).map(([k, c]) => [k, new THREE.Color(c)]));
    this._m = new THREE.Matrix4(); this._r = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._p = new THREE.Vector3();
    this._x = new THREE.Vector3(); this._y = new THREE.Vector3(); this._z = new THREE.Vector3(); this._d = new THREE.Vector3();
  }

  cam() { return typeof this.camera === 'function' ? this.camera() : this.camera; }

  /**
   * A burst where a cut landed: `at` (the contact), `heavy` (the combo's third, the charged cut, the riposte), `cut` (the
   * blade's way through it in the world, a vector: the heavy streak lies along it as seen), `size` (1 as tuned).
   */
  add({ at, heavy = false, cut = null, size = 1 }) {
    if (!at) return null;
    if (this.list.length >= this.H.max) this.list.shift();
    const S = heavy ? this.H.heavy : this.H.light;
    const b = { at: at.clone(), heavy, size, age: 0, spin: Math.random() * Math.PI * 2, jitter: Array.from({ length: S.rays }, () => Math.random() - 0.5), cutDir: cut?.clone?.() ?? null, cut: null };
    this.list.push(b);
    return b;
  }

  /** The burst's angle in the screen's plane for a world direction (0 up, + to the left), or null. */
  screenAngle(dir, cam) {
    if (!dir || dir.lengthSq() < 1e-8 || !cam) return null;
    this._x.setFromMatrixColumn(cam.matrixWorld, 0); this._y.setFromMatrixColumn(cam.matrixWorld, 1);
    const x = dir.dot(this._x), y = dir.dot(this._y);
    return Math.hypot(x, y) < 1e-6 ? null : Math.atan2(-x, y);
  }

  update(dt) {
    if (!this.list.length && !this.mesh.count) return;
    for (const b of this.list) b.age += dt;
    this.list = this.list.filter((b) => b.age < (b.heavy ? this.H.heavy : this.H.light).life);
    const cam = this.cam();
    let i = 0;
    if (cam && this.list.length) {
      cam.updateMatrixWorld?.();
      this._q.setFromRotationMatrix(this._r.extractRotation(cam.matrixWorld));
      const eye = this._p.setFromMatrixPosition(cam.matrixWorld);
      for (const b of this.list) {
        // (the streak along the blade's way as seen; a cut straight at or away from the camera, or none given: a falling diagonal)
        if (b.cut === null) b.cut = this.screenAngle(b.cutDir, cam) ?? H_DIAGONAL;
        const toCam = this._d.subVectors(eye, b.at), dist = toCam.length();
        if (dist > 1e-4) toCam.divideScalar(dist);
        const near = 1 - this.H.toward;   // (drawn nearer, smaller: as big on the screen)
        for (const piece of burstPieces(b, b.age, this.H)) {
          if (i >= this.mesh.instanceMatrix.count) break;
          // centre: the contact, drawn toward the camera; turned to the camera, then the piece's angle in that plane
          this._z.copy(b.at).addScaledVector(toCam, dist * this.H.toward + piece.lift * near);
          this._m.makeRotationFromQuaternion(this._q);
          this._m.multiply(this._r.makeRotationZ(piece.angle));
          this._m.multiply(this._r.makeTranslation(0, piece.from * near, 0));
          this._m.multiply(this._r.makeScale(Math.max(1e-4, piece.width * near), Math.max(1e-4, piece.length * near), 1));
          this._m.setPosition(this._x.setFromMatrixPosition(this._m).add(this._z));
          this.mesh.setMatrixAt(i, this._m);
          this.mesh.setColorAt(i, this.colors[piece.tone ?? piece.kind]);
          i++;
        }
      }
    }
    this.mesh.count = i;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.instanceColor.needsUpdate = true;
  }

  /** (tests, a scene's end) */
  clear() { this.list = []; this.mesh.count = 0; }
  dispose() { this.clear(); this.mesh.geometry.dispose(); this.mesh.removeFromParent(); }
}
