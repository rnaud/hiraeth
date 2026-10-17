// A foe's death in the fight temples, made to read from the overhead camera 28 m off (issue #442: "the kill animation
// for enemies should be more obvious and readable in this distance"; docs/design/fight-temples.md "Readable kills").
// The world's own death runs as before (src/enemies/defeat.js: each body plan goes down its own way, then bursts in ink
// and lies a moment before its puff of smoke); in here, at the killing blow, on top of it:
//
//   knock   the body is thrown back along the blow, `knock` m/s easing out at `drag`/s (about a metre), and goes down
//           `pace` times as quickly, so it lands as the blow does (not a second later, as a slow sag lost in a crowd)
//   flash   a thin ring of the world's glow snaps out round it on the floor (`ring`), the body's own white flash (Foe.flash)
//   splash  big drops of the world's ink thrown along the blow (`drops`), the size that reads from up there
//   splat   a star of ink on the floor where it fell (`splat`): it spreads in a blink, lies `hold` s, then dries into the
//           floor's colour and shrinks away over `fade` s (no corpse to tidy: the stain is the mark of the kill)
//   sound   a wet thump (Audio.foeKill) under the foe's own cry
//
// A crowd: every kill gets its knock and its splat (cheap: two instanced meshes, `max` of each), but only `full` kills
// in any `window` s get the ring, the drops and the thump, so a cut through eight foes reads as eight marks on the floor
// without a blaze of rings, a cloud of ink or a machine-gun of sound.

import * as THREE from 'three';
import { makeMaterial } from '../materials.js';

export const KILL = {
  knock: 7, drag: 7, pace: 1.6,
  ring: { r0: 0.4, r1: 1.7, life: 0.3 },
  drops: 14, dropSize: [0.1, 0.2],
  splat: { r: 0.85, grow: 0.1, hold: 2.4, fade: 0.9 },
  full: 4, window: 0.3, max: 24,
};

/** How far (m) the body has been thrown `t` s after the blow: it eases out to knock / drag. */
export const knockAt = (t, K = KILL) => (K.knock / K.drag) * (1 - Math.exp(-K.drag * Math.max(0, t)));

/** A splat `t` s old: { s: its scale (0..1+), dry: how far it has dried into the floor (0..1), gone }. */
export function splatAt(t, S = KILL.splat) {
  if (t < S.grow) { const k = Math.max(0, t) / S.grow; return { s: 0.3 + 0.75 * (1 - (1 - k) ** 3), dry: 0, gone: false }; }
  const after = t - S.grow - S.hold;
  if (after <= 0) return { s: 1.05 - 0.05 * Math.min(1, (t - S.grow) / 0.15), dry: 0, gone: false };
  const k = Math.min(1, after / S.fade);
  return { s: 1 - 0.35 * k * k, dry: k, gone: k >= 1 };
}

/** The crowd's budget: of kills at times `times` (s, ascending), is the one at `now` among the first `full` in `window` s? */
export function fullKill(times, now, K = KILL) {
  return times.filter((x) => now - x < K.window).length < K.full;
}

/** An ink splat: a blob with `n` spikes of uneven length (unit radius), flat on the floor. */
// (a circle's fan with its rim pulled in and out: a ShapeGeometry of the same outline turned the Unity build's whole
// frame black, the circle's fan is drawn as the geysers' fills are)
function splatGeometry(n = 9, rand = mulberry(7)) {
  const pts = 4 * n, geo = new THREE.CircleGeometry(1, pts), P = geo.attributes.position;
  const radius = Array.from({ length: pts }, (_, i) => 0.55 + (i % 4 === 0 ? 0.55 + 0.6 * rand() : i % 4 === 2 ? 0.05 : 0.15 * rand()));
  for (let v = 1; v < P.count; v++) { const r = radius[(v - 1) % pts]; P.setXY(v, P.getX(v) * r, P.getY(v) * r); }   // (vertex 0 the centre; the rim's last the first again)
  geo.computeBoundingSphere();
  return geo.rotateX(-Math.PI / 2);
}
function mulberry(a) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

/**
 * The run's kills (session.js): felled(f, from) at the killing blow, update(dt) each frame, dispose() at the end.
 * env: { add (an object into the scene, removed with the run), tool (drops), sound (Audio), palette, keep(f) (a thrown
 * body put back inside the room) }.
 */
export class KillFx {
  constructor({ add, tool = null, sound = null, palette = {}, keep = null, K = KILL }) {
    this.K = K; this.keep = keep; this.tool = tool; this.sound = sound; this.P = palette;
    this.ink = new THREE.Color(palette.ink ?? '#2a2440'); this.floor = new THREE.Color(palette.floor ?? '#e6cc9c');
    const flat = (color, glow) => makeMaterial({ color, flat: true, ...(glow ? { glow } : {}), key: `kill-fx-${color}-${glow ?? 0}` });
    const mesh = (geo, mat) => {
      const m = new THREE.InstancedMesh(geo, mat, K.max);
      m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(K.max * 3), 3);
      m.frustumCulled = false; m.count = 0; m.renderOrder = 2; m.userData.noCollide = true;
      return add ? add(m) : m;
    };
    this.splats = mesh(splatGeometry(), flat('#ffffff'));
    this.rings = mesh(new THREE.RingGeometry(0.86, 1, 40).rotateX(-Math.PI / 2), flat('#ffffff', 0.6));
    this.list = []; this.ringList = []; this.fallen = []; this.times = []; this.clock = 0; this.lastSound = -Infinity;
    this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._s = new THREE.Vector3(); this._p = new THREE.Vector3(); this._c = new THREE.Color(); this._y = new THREE.Vector3(0, 1, 0);
  }

  /** The killing blow on f, struck from `from` (his feet): its knock, its marks, its sound (within the crowd's budget). */
  felled(f, from) {
    const K = this.K, now = this.clock;
    const dir = new THREE.Vector3(f.pos.x - (from?.x ?? f.pos.x), 0, f.pos.z - (from?.z ?? f.pos.z));
    if (dir.lengthSq() < 1e-6) dir.set(Math.sin(f.heading ?? 0), 0, Math.cos(f.heading ?? 0)); else dir.normalize();
    const size = Math.min(1.6, Math.max(0.7, (f.def?.radius ?? 0.5) * 1.6));
    const full = fullKill(this.times, now, K);
    this.times.push(now); this.times = this.times.filter((x) => now - x < K.window);
    // the body thrown back along the blow (not one sunk under the sand, nor one that went out of the world)
    if (!f.lost && !f.def?.burrow) this.fallen.push({ f, dir, t: 0, gone: 0, start: f.pos.clone() });
    // the splat where it fell (a little along the blow: where the body comes down); the ring within the budget
    const at = new THREE.Vector3(f.pos.x, (f.pos.y ?? 0), f.pos.z);
    if (full) { if (this.ringList.length >= K.max) this.ringList.shift(); this.ringList.push({ at: at.clone(), t: 0, size }); }
    if (this.list.length >= K.max) this.list.shift();
    this.list.push({ at: at.clone().addScaledVector(dir, 0.45), t: 0, size: size * (0.9 + 0.2 * Math.random()), turn: Math.random() * Math.PI * 2, stretch: 1.15 + 0.2 * Math.random(), dir: Math.atan2(dir.x, dir.z) });
    if (!full) return false;
    // the splash: big drops along the blow and up, in the world's ink (one of them white: the highlight)
    const tones = [this.P.ink ?? '#2a2440', this.P.inkLite ?? '#4a3d6e', this.P.ink ?? '#2a2440', '#fff6dc'];
    const chest = f.chest?.clone?.() ?? at.clone().setY(at.y + 0.6);
    const [s0, s1] = K.dropSize;
    for (let i = 0; i < K.drops; i++) {
      const v = new THREE.Vector3().randomDirection().multiplyScalar(2.5).addScaledVector(dir, 3 + Math.random() * 3);
      v.y = 2.5 + Math.random() * 3.5;
      this.tool?.drops?.add({ pos: chest, vel: v, drag: 1.6, grav: 14, size: s0 + Math.random() * (s1 - s0), stretch: 1.8, life: 0.45 + Math.random() * 0.3, color: tones[i % tones.length] });
    }
    // the thump (never two in the same few frames)
    if (now - this.lastSound > 0.06) { this.lastSound = now; this.sound?.foeKill?.(Math.min(1, size)); }
    return true;
  }

  update(dt) {
    this.clock += dt;
    const K = this.K;
    // the bodies: thrown, and going down quicker (defeat.js's clock run on by pace - 1)
    for (const b of this.fallen) {
      b.t += dt;
      const d = knockAt(b.t, K);
      b.f.pos.set(b.start.x + b.dir.x * d, b.f.pos.y, b.start.z + b.dir.z * d);
      this.keep?.(b.f);
      if (b.f.dying) b.f.dying.t += dt * (K.pace - 1);
      else b.f.model?.group?.position.set(b.f.pos.x, b.f.model.group.position.y, b.f.pos.z);   // (one that burst at once: its body where it lies)
    }
    this.fallen = this.fallen.filter((b) => b.t < 1.2 && b.f.model?.group?.parent);
    // the rings
    this.ringList = this.ringList.filter((r) => (r.t += dt) < K.ring.life);
    let i = 0;
    for (const r of this.ringList) {
      const k = r.t / K.ring.life, e = 1 - (1 - k) ** 3, rad = (K.ring.r0 + (K.ring.r1 - K.ring.r0) * e) * r.size;
      this._m.compose(this._p.set(r.at.x, r.at.y + 0.08, r.at.z), this._q.identity(), this._s.set(rad, 1, rad));
      this.rings.setMatrixAt(i, this._m);
      this.rings.setColorAt(i, this._c.set(this.P.glyph ?? '#fff1c8').lerp(this.floor, k * k));
      i++;
    }
    this.rings.count = i;
    if (i) { this.rings.instanceMatrix.needsUpdate = true; this.rings.instanceColor.needsUpdate = true; }
    // the splats
    this.list = this.list.filter((s) => !splatAt((s.t += dt), K.splat).gone);
    i = 0;
    for (const s of this.list) {
      const S = splatAt(s.t, K.splat), r = K.splat.r * s.size * S.s;
      this._q.setFromAxisAngle(this._y, s.turn);
      this._m.compose(this._p.set(s.at.x, s.at.y + 0.04, s.at.z), this._q, this._s.set(r * s.stretch, 1, r));
      this.splats.setMatrixAt(i, this._m);
      this.splats.setColorAt(i, this._c.copy(this.ink).lerp(this.floor, S.dry));
      i++;
    }
    this.splats.count = i;
    if (i) { this.splats.instanceMatrix.needsUpdate = true; this.splats.instanceColor.needsUpdate = true; }
  }

  /** (the checks) how many marks lie on the floor, how many rings are out, how many bodies are being thrown */
  get counts() { return { splats: this.list.length, rings: this.ringList.length, thrown: this.fallen.length }; }

  clear() { this.list = []; this.ringList = []; this.fallen = []; this.times = []; this.splats.count = 0; this.rings.count = 0; }
  dispose() { this.clear(); for (const m of [this.splats, this.rings]) { m.removeFromParent(); m.geometry.dispose(); } }
}
