import * as THREE from 'three';
import { makeMaterial } from './materials.js';

// Swoosh trails on the foes' attacks (issue #663, docs/systems/foes.md "Swoosh trails"): the striking part of a foe
// (the claw, the fist, the head its `tell` names: the part its charge glow sits on) lays an inked ribbon behind it as it
// moves through an attack, so the swing's path stays on screen a moment after the part has gone through it. Three looks,
// read from the attack's own timing (trailPhase), never a clock of their own:
//
//   wind     the wind-up: a thin ink stroke as the part rears back into its pose (it is held still after POSE_DONE, so
//            the stroke has gone by the strike: the stillness before the blow stays still)
//   active   the strike until its hit is checked (Foe.attackPhase 'active'): the widest ribbon, a warm danger colour
//            with a hot cream edge on its leading side; what it covers is the dangerous part of the swing
//   spent    the strike's follow-through after the hit is checked: still laid, narrower, the same colours
//   (recover, or the blow broken off: nothing laid; what is there thins away over TRAIL.fade)
//
// A ribbon is a strip of two lanes along the part's path: its edge lane (the part's own side, TRAIL.edge of the width)
// and its body lane (toward the foe's chest), laid flat in the plane the part swings through. It fades by thinning, never
// by transparency (flat ink colours, as the slash arc: src/slash-arc.js), so the Unity bridge draws it as it is. One
// pool of ribbons for every foe (TRAIL.max), each two meshes on four shared materials; nothing is made per attack.
//
//   const T = new AttackTrails(parent);
//   T.follow(f, trailPhase(f), tip, chest, size);   each frame per foe (Foes.look), after its pose
//   T.update(dt);                                     once a frame
//   T.drop(f); T.dispose()

export const TRAIL = {
  samples: 24,                       // points a ribbon keeps along its path
  step: 0.035,                       // m the part moves before a new point is laid
  life: { wind: 0.2, active: 0.3, spent: 0.22 },   // s a point lasts, by the phase it was laid in (the ribbon's tail)
  width: { wind: 0.1, active: 0.46, spent: 0.26 },  // m, × the foe's size (TRAIL_SIZE)
  edge: 0.32,                        // share of the width its edge lane takes
  fade: 0.28,                        // s a ribbon thins away once nothing lays it (the recovery)
  max: 10,                           // ribbons in play at most (the oldest released one taken first)
  tones: {                           // [body, edge]
    wind: ['#1a1520', '#4b3a62'],    // ink, a dusk violet edge
    active: ['#e8633a', '#ffe7b0'],  // a warm danger red-orange, a hot cream edge
  },
};

/** The part's size factor for a foe's ribbon width (a small skitter's thin, a brute's broad). */
export const trailSize = (def) => THREE.MathUtils.clamp((def?.radius ?? 0.6) / 0.6, 0.6, 1.8);

/**
 * The ribbon's phase this frame from the foe's attack timing (pure: tests): 'wind' through a wind-up, 'active' through
 * the strike until its hit is checked (Foe.attackPhase), 'spent' after it, null when nothing is laid (recovering,
 * stunned, chasing, an instant attack: a lob, a flash, a blink, whose projectile or flash is its own sign).
 */
export function trailPhase(f) {
  const a = f?.atk ?? f?.def?.attack;
  if (!f || !a || f.stunned > 0 || f.dying || f.dead !== undefined || a.instant || a.surface || a.blink) return null;
  if (f.state === 'wind') return a.lob ? null : 'wind';
  if (f.state === 'strike') return f.contacted ? 'spent' : 'active';
  return null;
}
/** The look a phase is drawn in: the wind-up's ink, or the blow's warm colours (active and spent alike). */
export const trailLook = (phase) => (phase === 'wind' ? 'wind' : 'active');

/** A point's width over its life (pure): full when laid, thinning to nothing at its end. */
export function trailTaper(age, life) {
  if (!(life > 0) || age >= life) return 0;
  const k = Math.max(0, age) / life;
  return (1 - k) ** 1.3;
}

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _m = new THREE.Vector3(), _s = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0);

/** A strip of `n` points (two edges each) on its own geometry, a shared material: { mesh, pos, geo }. */
function strip(n, look, lane, order) {
  const pos = new Float32Array(n * 2 * 3), nrm = new Float32Array(n * 2 * 3);
  for (let i = 0; i < n * 2; i++) nrm[i * 3 + 1] = 1;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  const idx = [];
  for (let i = 0; i < n - 1; i++) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  g.setIndex(idx);
  const [color, glow] = lane === 'edge' ? [TRAIL.tones[look][1], look === 'wind' ? 0.25 : 0.95] : [TRAIL.tones[look][0], look === 'wind' ? 0 : 0.55];
  const mesh = new THREE.Mesh(g, makeMaterial({ color, flat: true, glow, side: THREE.DoubleSide, key: `attack-trail-${look}-${lane}` }));
  mesh.name = `attack trail ${look} ${lane}`; mesh.frustumCulled = false; mesh.visible = false; mesh.renderOrder = order;
  mesh.userData.noCollide = true; mesh.userData.dynamic = true; mesh.userData.castShadow = false;   // (a swoosh casts no shadow)
  return { mesh, pos, geo: g };
}

/** One ribbon: the points laid (a ring of TRAIL.samples), its two lanes in its look. */
class Ribbon {
  constructor(parent, look) {
    const n = TRAIL.samples;
    this.look = look;
    this.body = strip(n, look, 'body', 3);
    this.edge = strip(n, look, 'edge', 4);
    this.group = new THREE.Group(); this.group.name = `attack trail (${look})`; this.group.userData.noCollide = true;
    this.group.add(this.body.mesh, this.edge.mesh);
    parent?.add(this.group);
    // per point: the part (x, y, z), the way to the body (unit x, y, z), its width (m), its age (s) and life (s)
    this.tip = new Float32Array(n * 3); this.side = new Float32Array(n * 3);
    this.w = new Float32Array(n); this.age = new Float32Array(n); this.life = new Float32Array(n);
    this.reset();
  }
  reset() { this.n = 0; this.head = 0; this.owner = null; this.released = true; this.fadeT = 0; this.last = null; this.shown = false; this.body.mesh.visible = this.edge.mesh.visible = false; }
  /** Lay a point: the part at `tip`, its body toward `side` (unit), `w` m wide, lasting `life` s. */
  lay(tip, side, w, life) {
    const n = TRAIL.samples, i = this.head;
    this.tip[i * 3] = tip.x; this.tip[i * 3 + 1] = tip.y; this.tip[i * 3 + 2] = tip.z;
    this.side[i * 3] = side.x; this.side[i * 3 + 1] = side.y; this.side[i * 3 + 2] = side.z;
    this.w[i] = w; this.age[i] = 0; this.life[i] = life;
    this.head = (i + 1) % n; this.n = Math.min(n, this.n + 1);
    (this.last ??= new THREE.Vector3()).copy(tip);
  }
  /** The live points, oldest first (indices into the ring). */
  *order() { const n = TRAIL.samples; for (let j = 0; j < this.n; j++) yield (this.head - this.n + j + n) % n; }
  /** The width point `i` is drawn at now: its own, tapering with its age, the whole ribbon thinning once released. */
  widthOf(i) { return this.w[i] * trailTaper(this.age[i], this.life[i]) * (this.released ? Math.max(0, 1 - this.fadeT / TRAIL.fade) : 1); }
  /** Its age (dt), what is drawn: false once nothing of it is left. */
  step(dt) {
    for (const i of this.order()) this.age[i] += dt;
    if (this.released) this.fadeT += dt;
    // (the oldest points gone: off the ring)
    while (this.n && this.age[(this.head - this.n + TRAIL.samples) % TRAIL.samples] >= this.life[(this.head - this.n + TRAIL.samples) % TRAIL.samples]) this.n--;
    const alive = this.n >= 2 && !(this.released && this.fadeT >= TRAIL.fade);
    if (!alive) { this.body.mesh.visible = this.edge.mesh.visible = false; this.shown = false; if (this.released) this.n = 0; return false; }
    const E = TRAIL.edge;
    let o = 0;
    for (const i of this.order()) {
      const w = this.widthOf(i), x = this.tip[i * 3], y = this.tip[i * 3 + 1], z = this.tip[i * 3 + 2];
      const sx = this.side[i * 3], sy = this.side[i * 3 + 1], sz = this.side[i * 3 + 2];
      const P = this.body.pos, Q = this.edge.pos, we = w * E;
      // body lane: from the edge line in to its inner edge; edge lane: from the part to the edge line (no overlap)
      P[o * 6] = x + sx * we; P[o * 6 + 1] = y + sy * we; P[o * 6 + 2] = z + sz * we;
      P[o * 6 + 3] = x + sx * w; P[o * 6 + 4] = y + sy * w; P[o * 6 + 5] = z + sz * w;
      Q[o * 6] = x; Q[o * 6 + 1] = y; Q[o * 6 + 2] = z;
      Q[o * 6 + 3] = x + sx * we; Q[o * 6 + 4] = y + sy * we; Q[o * 6 + 5] = z + sz * we;
      o++;
    }
    // (the rest of the strip folded onto its last point: nothing drawn there, no draw range, which the bridge ignores)
    for (const L of [this.body.pos, this.edge.pos]) for (let j = o; j < TRAIL.samples; j++) L.copyWithin(j * 6, (o - 1) * 6, o * 6);
    for (const L of [this.body, this.edge]) {
      L.geo.attributes.position.needsUpdate = true;
      L.mesh.visible = true;
    }
    this.shown = true;
    return true;
  }
  /** The ribbon's drawn length (m along the part's path, tests). */
  get length() { let d = 0, p = null; for (const i of this.order()) { if (this.widthOf(i) <= 0) continue; const q = _m.set(this.tip[i * 3], this.tip[i * 3 + 1], this.tip[i * 3 + 2]); if (p) d += p.distanceTo(q); (p ??= new THREE.Vector3()).copy(q); } return d; }
  /** Its widest point now (m, tests). */
  get widest() { let w = 0; for (const i of this.order()) w = Math.max(w, this.widthOf(i)); return w; }
  dispose() { this.group.removeFromParent(); this.body.geo.dispose(); this.edge.geo.dispose(); }
}

/**
 * The way from the part toward the body, square to the part's motion (the plane it swings through); if the part moves
 * straight at or away from the body (a lunge, a head-butt), up.
 */
export function trailSide(tip, chest, motion, out = new THREE.Vector3()) {
  out.copy(chest).sub(tip);
  const m = motion.lengthSq() > 1e-10 ? _s.copy(motion).normalize() : null;
  if (m) out.addScaledVector(m, -out.dot(m));
  if (out.lengthSq() < 0.04 * 0.04) {
    out.copy(_up);
    if (m) out.addScaledVector(m, -out.dot(m));
    if (out.lengthSq() < 1e-8) out.set(1, 0, 0);
  }
  return out.normalize();
}

export class AttackTrails {
  constructor(parent, max = TRAIL.max) {
    this.parent = parent; this.max = max;
    this.ribbons = [];   // (made as needed, up to max; kept and reused)
    this.of = new Map();   // foe → its ribbon being laid
  }

  /** A ribbon in `look` for `f`: a free one of that look, else a new one (up to max), else the most faded. */
  take(f, look) {
    let R = this.ribbons.find((r) => r.look === look && r.released && !r.shown);
    if (!R && this.ribbons.length < this.max) { R = new Ribbon(this.parent, look); this.ribbons.push(R); }
    if (!R) {
      const free = this.ribbons.filter((r) => r.look === look && r.released);
      R = free.sort((a, b) => b.fadeT - a.fadeT)[0];
      if (!R) {   // (every one of that look still being laid: the pool's oldest of any look made over)
        const any = this.ribbons.filter((r) => r.released).sort((a, b) => b.fadeT - a.fadeT)[0];
        if (!any) return null;
        any.dispose(); this.ribbons.splice(this.ribbons.indexOf(any), 1);
        R = new Ribbon(this.parent, look); this.ribbons.push(R);
      }
    }
    R.reset(); R.owner = f; R.released = false;
    this.of.set(f, R);
    return R;
  }

  /**
   * Each frame per foe, after its pose: `phase` (trailPhase), the striking part's place `tip`, its chest, its size
   * (trailSize). Lays a point when the part has moved TRAIL.step; a phase of another look starts a new ribbon from where
   * the last one ends; no phase releases it (it thins away).
   */
  follow(f, phase, tip, chest, size = 1) {
    let R = this.of.get(f);
    if (!phase) { if (R) this.release(f); return null; }
    const look = trailLook(phase);
    if (R && R.look !== look) {
      const from = R.n ? R.last.clone() : null, side = R.n ? _b.fromArray(R.side, ((R.head - 1 + TRAIL.samples) % TRAIL.samples) * 3).clone() : null;
      this.release(f);
      R = this.take(f, look);
      if (R && from) R.lay(from, side, TRAIL.width[phase] * size, TRAIL.life[phase]);
    }
    R ??= this.take(f, look);
    if (!R) return null;
    if (R.last && R.last.distanceTo(tip) < TRAIL.step) return R;
    const side = trailSide(tip, chest, R.last ? _a.copy(tip).sub(R.last) : _a.set(0, 0, 0), _b);
    R.lay(tip, side, TRAIL.width[phase] * size, TRAIL.life[phase]);
    return R;
  }

  /** `f`'s ribbon let go: it thins away (its recovery, or the foe gone). */
  release(f) { const R = this.of.get(f); if (R) { R.released = true; R.owner = null; this.of.delete(f); } }
  drop(f) { this.release(f); }

  update(dt) { for (const R of this.ribbons) if (R.n) R.step(dt); }

  /** Ribbons drawn now (tests, the perf note). */
  get drawn() { return this.ribbons.filter((r) => r.shown).length; }
  dispose() { for (const R of this.ribbons) R.dispose(); this.ribbons = []; this.of.clear(); }
}
