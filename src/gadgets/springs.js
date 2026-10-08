import * as THREE from 'three';
import { inkMat, INK } from './kit.js';
import { targetsInCone } from '../targets.js';
import { hitStop, kick } from '../feel.js';
import { HIDDEN, hiddenIn, unearth } from './hidden.js';

// Spring boots (docs/systems/gadgets.md, "Spring boots"): coiled brass springs strapped under the boots. Hold
// the use button on the ground to crouch and wind them (the coils squash, a ring of ink dashes fills round the
// feet), let go to launch: straight up for a full wind (SPRING.fullH m), arced forward if the stick points.
// Press again just before touching down and they bounce you on, higher each time (BOUNCE.max in a chain);
// press higher up and you stomp down instead (STOMP: cracked floors break, foes and crates near are thrown,
// what is buried comes up). No landing on them hurts.

export const SPRING = {
  wind: 0.85,          // s to wind them fully
  minH: 2.4, fullH: 14.3,   // m: the hop of a tap, the height of a full wind (a little over 14: the frame steps take a little)
  arc: 0.62,           // share of the height kept when launched forward
  fwd: 11,             // m/s forward at a full wind (forward launch)
  gravity: 32,         // the traveller's (src/player.js GRAVITY)
  guard: 2.4,          // the landing's fall guard while they carry you (FALL.tumble × this: nothing they do hurts)
  rest: 0.09, out: 0.34, squash: 0.035,   // m: the coils' length standing, in the air, wound fully
};
export const BOUNCE = { window: 0.42, gain: 0.22, max: 3 };      // s before touching down a press arms a bounce; height gained a bounce; bounces in a chain
export const STOMP = { min: 1.6, hang: 0.14, speed: 38, radius: 4.5, breakR: 1.6, power: 12 };

const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _u = new THREE.Vector3(), _q = new THREE.Quaternion();
const _Y = new THREE.Vector3(0, 1, 0);

/** The height a launch reaches: the wind's, raised by each bounce of a chain. Pure. */
export const launchHeight = (charge, chain = 0) => (SPRING.minH + (SPRING.fullH - SPRING.minH) * THREE.MathUtils.clamp(charge, 0, 1)) * (1 + BOUNCE.gain * Math.min(chain, BOUNCE.max));

/**
 * A launch's velocity: up to launchHeight (v = √(2 g h)); along `move` (a unit-or-less direction in the
 * ground's plane) the arc goes forward, lower. Pure.
 */
export function launchVelocity(charge, move = null, up = _Y, chain = 0, out = new THREE.Vector3()) {
  const m = move ? Math.min(1, move.length()) : 0;
  const h = launchHeight(charge, chain) * (m > 0.2 ? THREE.MathUtils.lerp(1, SPRING.arc, m) : 1);
  out.copy(up).multiplyScalar(Math.sqrt(2 * SPRING.gravity * h));
  if (m > 0.2) out.addScaledVector(_v.copy(move).addScaledVector(up, -move.dot(up)).normalize(), SPRING.fwd * (0.45 + 0.55 * charge) * m);
  return out;
}

/** Seconds until a body h m above the ground, going up at vu m/s, lands under gravity g. Pure. */
export function timeToLand(h, vu, g = SPRING.gravity) {
  if (!(h > 0)) return 0;
  if (!Number.isFinite(h)) return Infinity;
  return (vu + Math.sqrt(vu * vu + 2 * g * h)) / g;
}

/** What a press in the air does: 'bounce' (armed: just before landing, in a spring's flight), 'stomp' (high enough), or null. Pure. */
export function airPress(tLand, h, flight) {
  if (flight && tLand <= BOUNCE.window) return 'bounce';
  if (h >= STOMP.min && tLand > BOUNCE.window * 0.6) return 'stomp';
  return flight ? 'bounce' : null;
}

/** One step of the coils' wobble: a damped spring about 0 (x the stretch, v its speed). Pure. */
export function coilWobble(s, dt, { k = 260, c = 9 } = {}) {
  const a = -k * s.x - c * s.v;
  s.v += a * dt; s.x += s.v * dt;
  return s;
}

/** A helix of brass wire, 1 m tall along +y from 0 (scaled to its length), `turns` round, radius r. */
function coilGeometry(r = 0.07, turns = 5, wire = 0.013) {
  const pts = [];
  for (let i = 0; i <= turns * 16; i++) { const t = i / (turns * 16), a = t * turns * Math.PI * 2; pts.push(new THREE.Vector3(Math.cos(a) * r, t, Math.sin(a) * r)); }
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), turns * 16, wire, 5, false);
}

function springModel() {
  const g = new THREE.Group();
  const brass = inkMat('#d6a94a', { metal: 'brass' }), leather = inkMat('#7a4a2e'), dark = inkMat('#3a3330'), red = inkMat('#c8483a');
  // a boot's sole plate, a strap over it with a buckle, and two coils under it
  g.add(new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.025, 0.27).translate(0, 0.12, 0), dark));
  g.add(new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.012, 5, 14, Math.PI).scale(1, 1.3, 1).rotateY(Math.PI / 2).translate(0, 0.13, 0.04), leather));
  g.add(new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.012).translate(0.064, 0.19, 0.04), brass));
  g.add(new THREE.Mesh(new THREE.BoxGeometry(0.115, 0.01, 0.03).translate(0, 0.106, -0.1), red));
  for (const z of [-0.07, 0.07]) {
    const c = new THREE.Mesh(coilGeometry(0.04, 4, 0.008), brass);
    c.scale.set(1, 0.1, 1); c.position.set(0, 0.005, z);
    g.add(c);
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.012, 12).translate(0, 0.004, z), dark));
  }
  return g;
}

/** Their sounds (the game's synth). */
const sfx = {
  wind(s, k) { const t = s?.ctx?.currentTime; if (t == null) return; s.burst(t, { dur: 0.03, type: 'bandpass', freq: 1400 + 1600 * k, q: 5, vol: 0.035 }); },
  full(s) { const t = s?.ctx?.currentTime; if (t == null) return; s.sweep(t, 1250, 1240, 0.18, 0.05, 'triangle'); s.sweep(t, 1760, 1750, 0.14, 0.03, 'triangle'); },
  boing(s, chain = 0, k = 1) {
    const t = s?.ctx?.currentTime; if (t == null) return;
    const p = 1 + chain * 0.18;
    // the spring's twang: a quick rise that wobbles down, twice
    s.sweep(t, 150 * p, 520 * p, 0.09, 0.14 * k, 'triangle');
    s.sweep(t + 0.08, 480 * p, 260 * p, 0.12, 0.09 * k, 'triangle');
    s.sweep(t + 0.18, 300 * p, 420 * p, 0.1, 0.05 * k, 'sine');
    s.sweep(t + 0.27, 400 * p, 330 * p, 0.12, 0.03 * k, 'sine');
    s.burst(t, { dur: 0.06, type: 'lowpass', freq: 600, q: 0.8, vol: 0.12 * k });
  },
  land(s, k = 1) { const t = s?.ctx?.currentTime; if (t == null) return; s.burst(t, { dur: 0.09, type: 'lowpass', freq: 520, q: 0.8, vol: 0.12 * k }); s.sweep(t + 0.01, 340, 240, 0.14, 0.05 * k, 'triangle'); },
  drop(s) { const t = s?.ctx?.currentTime; if (t == null) return; s.sweep(t, 900, 160, 0.3, 0.06, 'sawtooth'); s.burst(t, { dur: 0.3, type: 'highpass', freq: 2400, q: 0.5, vol: 0.05, rate: 1.4 }); },
  stomp(s) {
    const t = s?.ctx?.currentTime; if (t == null) return;
    s.sweep(t, 120, 38, 0.45, 0.4);
    s.burst(t, { dur: 0.4, type: 'lowpass', freq: 520, q: 0.6, vol: 0.32, rate: 0.5 });
    s.burst(t + 0.05, { dur: 0.6, type: 'lowpass', freq: 240, q: 0.5, vol: 0.16, rate: 0.35 });
    s.sweep(t + 0.04, 260, 520, 0.12, 0.05, 'triangle');
  },
};

/** A ring of dust (cream puffs thrown out round the feet, each shrinking away) and a ring of speed strokes. */
class Dust {
  constructor(parent) {
    this.group = new THREE.Group(); this.group.userData.noCollide = true; parent.add(this.group);
    this.mats = [inkMat('#f1e2c2', { glow: 0.3 }), inkMat('#dcc49a', { glow: 0.2 })];
    this.puff = new THREE.IcosahedronGeometry(1, 1);
    this.stroke = new THREE.BoxGeometry(0.05, 0.05, 1).translate(0, 0, 0.5);
    this.inkM = inkMat(INK);
    this.ringG = new THREE.TorusGeometry(1, 0.035, 4, 48).rotateX(Math.PI / 2);
    this.live = []; this.pool = [];
  }
  add(at, up = _Y, size = 1) {
    let r = this.pool.pop();
    if (!r) {
      r = { g: new THREE.Group(), puffs: [], strokes: [] };
      for (let i = 0; i < 12; i++) { const m = new THREE.Mesh(this.puff, this.mats[i % 2]); m.userData.noCollide = true; r.g.add(m); r.puffs.push(m); }
      for (let i = 0; i < 10; i++) { const m = new THREE.Mesh(this.stroke, this.inkM); m.userData.noCollide = true; r.g.add(m); r.strokes.push(m); }
      r.ring = new THREE.Mesh(this.ringG, this.inkM); r.ring.userData.noCollide = true; r.g.add(r.ring);
      r.g.userData.noCollide = true;
    }
    r.t = 0; r.size = size; r.life = 0.65 + size * 0.15;
    r.g.position.copy(at); r.g.quaternion.setFromUnitVectors(_Y, up); r.g.visible = true;
    r.a0 = Math.random() * 6;
    this.group.add(r.g); this.live.push(r);
    return r;
  }
  update(dt) {
    for (const r of this.live) {
      r.t += dt;
      const k = r.t / r.life, S = r.size;
      r.puffs.forEach((p, i) => {
        const a = r.a0 + (i / r.puffs.length) * Math.PI * 2, rad = S * (0.35 + 1.25 * (1 - (1 - Math.min(1, k * 1.6)) ** 2));
        p.position.set(Math.cos(a) * rad, 0.08 + 0.18 * S * Math.min(1, k * 2), Math.sin(a) * rad);
        const s = S * (0.16 + 0.04 * S) * (1 + 0.3 * Math.sin(i * 2.1)) * Math.min(1, k * 8) * Math.max(0, 1 - k);
        p.visible = s > 0.005; p.scale.setScalar(Math.max(0.001, s));
      });
      // a ring of ink running out over the ground (the shock of it), thinning as it goes
      const rk = Math.min(1, k * 2.2), rr = S * (0.4 + 1.9 * (1 - (1 - rk) ** 2));
      r.ring.visible = rk < 1 && S > 1;
      r.ring.position.y = 0.03; r.ring.scale.set(rr, Math.max(0.05, 1 - rk), rr);
      r.strokes.forEach((m, i) => {
        const a = r.a0 + 0.3 + (i / r.strokes.length) * Math.PI * 2, rad = S * (0.5 + 1.6 * Math.min(1, k * 2.6)), len = S * 0.55 * Math.max(0, 1 - k * 2.4);
        m.visible = len > 0.02;
        m.position.set(Math.cos(a) * rad, 0.06, Math.sin(a) * rad);
        m.rotation.set(0, Math.atan2(Math.cos(a), Math.sin(a)), 0);
        m.scale.set(1, 1, Math.max(0.001, len));
      });
    }
    for (let i = this.live.length - 1; i >= 0; i--) { const r = this.live[i]; if (r.t >= r.life) { r.g.visible = false; r.g.removeFromParent(); this.live.splice(i, 1); this.pool.push(r); } }
  }
  dispose() { this.group.removeFromParent(); this.puff.dispose(); this.stroke.dispose(); this.ringG.dispose(); }
}

export default {
  id: 'springs', name: 'Spring boots', glyph: '⌇', order: 80,
  text: 'Two coils of the makers’ brass strapped under the boots, wound by crouching. They throw you higher than any wall in a village, and no landing on them hurts.',
  use: 'Hold Y / △ (T, or the middle mouse button) on the ground to crouch and wind them; let go to spring up (fully wound, fourteen metres), or forward if you point the stick. Press again just before you land to bounce on higher, up to three times. Press it high in the air to stomp down: it breaks cracked floors, throws foes and crates back and brings up what is buried.',
  model: () => springModel(),
  create(ctx) { return new Springs(ctx); },

  /** Its bay: a staircase of blocks 4, 8 and 12 m up and a 20 m tower past them; a cracked roof over a little room. */
  yard(kit) {
    kit.flag('#b5651d');
    kit.block([3, 4, 3], [-4.6, 2, -2.6]);
    kit.block([3, 8, 3], [-1.2, 4, -7.4]);
    kit.block([3, 12, 3], [3.4, 6, -9.6]);
    kit.block([3.2, 20, 3.2], [-5.4, 10, -10.4]);
    kit.lamp([-5.4, 20, -10.4]);
    kit.lamp([3.4, 12, -9.6]);
    // a ring to aim for on top of each, so the course reads from the ground
    for (const [x, y, z] of [[-4.6, 4, -2.6], [-1.2, 8, -7.4], [3.4, 12, -9.6]]) kit.block([1.6, 0.06, 1.6], [x, y + 0.03, z], { mat: 'red' });
    // a little room roofed with a cracked slab: stomp through it to the lamp inside
    const R = { x: 4.4, z: 2.2, h: 2.6, w: 3.6 };
    for (const [x, z, w, d] of [[0, -R.w / 2, R.w + 0.3, 0.3], [0, R.w / 2, R.w + 0.3, 0.3], [-R.w / 2, 0, 0.3, R.w], [R.w / 2, 0, 0.3, R.w]]) kit.block([w, R.h, d], [R.x + x, R.h / 2, R.z + z], { mat: 'pale' });
    kit.cracked([R.w + 0.3, R.w + 0.3, 0.4], [R.x, R.h + 0.2, R.z], { lay: true, regrow: 14 });
    kit.lamp([R.x - 1.1, 0, R.z - 1.1]);
  },
};

class Springs {
  constructor(ctx) {
    this.ctx = ctx;
    this.state = 'idle';   // idle · wind · air · hang · pound
    this.charge = 0; this.chain = 0; this.armed = false; this.t = 0; this.time = 0;
    this.move = new THREE.Vector3(); this.flightDir = new THREE.Vector3();
    this.wob = { x: 0, v: 0 };
    this.len = SPRING.rest;
    this.equipped = false;
    // the coils under the boots, the wind ring round the feet, the dust
    const brass = inkMat('#d6a94a', { metal: 'brass' });
    const geo = coilGeometry(0.075, 5, 0.014);
    this.coils = [0, 1].map(() => { const m = new THREE.Mesh(geo, brass); m.userData.noCollide = true; m.visible = false; m.frustumCulled = false; ctx.fx?.add(m); return m; });
    this.ring = new THREE.Group(); this.ring.userData.noCollide = true; this.ring.visible = false;
    this.dashMat = [inkMat(INK), inkMat('#f2c54b', { glow: 1 })];
    this.dashes = [];
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2, m = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.035, 0.07), this.dashMat[0]);
      m.position.set(Math.sin(a) * 0.95, 0.04, Math.cos(a) * 0.95); m.rotation.y = a; m.userData.noCollide = true;
      this.ring.add(m); this.dashes.push(m);
    }
    ctx.fx?.add(this.ring);
    this.dust = ctx.fx ? new Dust(ctx.fx) : null;
    this.feet = [new THREE.Vector3(), new THREE.Vector3()];
  }

  get P() { return this.ctx.player; }
  up() { return this.P?.frame?.up ?? _Y; }
  canUse() {
    const P = this.P;
    return !!P && !P.ride && !P.down && !P.dead && !P.climbing && !P.mantle && !P.swim && !P.jetFlight;
  }
  /** How high over the ground, and how soon he lands. */
  air() {
    const P = this.P, up = this.up();
    let h = P._groundH;
    if (!Number.isFinite(h)) { const g = this.ctx.physics?.groundAt?.(P.pos.x, P.pos.y + 0.5, P.pos.z, 200); h = Number.isFinite(g) ? P.pos.y - g : Infinity; }
    return { h, tLand: timeToLand(h, P.vel.dot(up)) };
  }

  equip() { this.equipped = true; this.ctx.sfx?.equip?.(this.ctx.sound); }
  equipQuiet() { this.equipped = true; }
  unequip() { this.equipped = false; this.cancel(); }
  cancel() {
    if (this.state === 'wind') this.state = 'idle';
    this.charge = 0; this.armed = false;
  }

  press() {
    const P = this.P;
    if (!this.canUse()) return;
    if (P.onGround && (this.state === 'idle' || this.state === 'wind')) { this.state = 'wind'; this.charge = 0; this.windT = 0; return; }
    if (P.onGround) return;
    if (this.state === 'hang' || this.state === 'pound') return;
    const { h, tLand } = this.air();
    const what = airPress(tLand, h, this.state === 'air');
    if (what === 'bounce') { this.armed = true; this.armedAt = this.time; }
    else if (what === 'stomp') this.startStomp();
  }
  hold(dt) {
    if (this.state !== 'wind') return;
    const was = this.charge;
    this.charge = Math.min(1, this.charge + dt / SPRING.wind);
    this.windT = (this.windT ?? 0) - dt;
    if (this.charge < 1 && this.windT <= 0) { this.windT = 0.07; sfx.wind(this.ctx.sound, this.charge); }
    if (was < 1 && this.charge >= 1) sfx.full(this.ctx.sound);
  }
  release() {
    if (this.state !== 'wind') return;
    if (!this.canUse() || !this.P.onGround) { this.state = 'idle'; this.charge = 0; return; }
    this.launch(this.charge, 0, this.move);
  }

  /** Off the ground: up (and along `move`), the coils thrown out, a ring of dust. */
  launch(charge, chain = 0, move = null) {
    const P = this.P, up = this.up();
    const vel = launchVelocity(charge, move, up, chain, _w);
    if (chain > 0 && this.flightDir.lengthSq() > 0.01) vel.addScaledVector(this.flightDir, 1);   // (a bounce keeps the way you were going)
    P.vel.copy(vel);
    P.onGround = false; P._carry = true; P._jumped = true;
    if (P.frame?.headingOf && move && move.lengthSq() > 0.04) P.heading = P.frame.headingOf(move);
    this.flightDir.copy(vel).addScaledVector(up, -vel.dot(up));
    this.state = 'air'; this.chain = chain; this.armed = false; this.charge = 0;
    this.guardOn();
    this.wob.v += 9; this.stretch = 1;
    this.dust?.add(_v.copy(P.pos).addScaledVector(up, 0.03), up, 0.8 + 0.5 * charge + 0.2 * chain);
    sfx.boing(this.ctx.sound, chain, 0.6 + 0.4 * charge);
    this.ctx.game?.emit?.('gadget:spring', { chain, charge, height: launchHeight(charge, chain) });
  }

  startStomp() {
    const P = this.P;
    this.state = 'hang'; this.t = 0; this.armed = false;
    this.guardOn();
    P.vel.set(0, 0, 0); P._carry = true;
    sfx.drop(this.ctx.sound);
  }

  /**
   * While they carry him no landing hurts: the fall guard raised (src/player.js FALL), each frame before he
   * moves (the charms set it again every frame, src/boxes/effects.js), given back on landing.
   */
  guardOn() {
    const P = this.P;
    if (!this.guarding) { this.guarding = true; this.savedGuard = P.fallGuard; }
    this.guardNow();
  }
  guardNow() { const P = this.P; if (this.guarding && P) P.fallGuard = Math.max(P.fallGuard ?? 1, SPRING.guard); }
  guardOff() {
    const P = this.P;
    if (!this.guarding) return;
    this.guarding = false;
    if (P.fallGuard === Math.max(this.savedGuard ?? 1, SPRING.guard)) { if (this.savedGuard === undefined) delete P.fallGuard; else P.fallGuard = this.savedGuard; }
  }

  /** Before the traveller moves: winding, he stands (the stick only says where the launch goes); the stomp's hang and drop. */
  control(dt, input = {}) {
    const P = this.P;
    if (!P) return;
    this.guardNow();
    if (this.state === 'wind') {
      if (!P.onGround || !this.canUse()) { this.state = 'idle'; this.charge = 0; return; }
      const f = input.stick ? input.stick.y : (input.KeyW ? 1 : 0) - (input.KeyS ? 1 : 0);
      const s = input.stick ? input.stick.x : (input.KeyD ? 1 : 0) - (input.KeyA ? 1 : 0);
      this.move.set(0, 0, 0);
      const cam = this.ctx.camera;
      if ((f || s) && cam) {
        const up = this.up(), fw = cam.getWorldDirection(_u); fw.addScaledVector(up, -fw.dot(up)).normalize();
        const right = _v.crossVectors(fw, up).normalize();
        this.move.copy(fw).multiplyScalar(f).addScaledVector(right, s);
        if (this.move.length() > 1) this.move.normalize();
      }
      for (const k of ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space']) if (k in input) input[k] = false;
      if (input.stick) input.stick = null;
      P.vel.multiplyScalar(Math.exp(-14 * dt));
    } else if (this.state === 'hang') {
      this.t += dt;
      P.vel.set(0, 0, 0).addScaledVector(this.up(), SPRING.gravity * dt);   // (held still at the top: gravity given back)
      if (this.t >= STOMP.hang) { this.state = 'pound'; P.vel.copy(this.up()).multiplyScalar(-STOMP.speed); }
    } else if (this.state === 'pound') {
      P.vel.copy(this.up()).multiplyScalar(-STOMP.speed);
      P._carry = true;
    }
  }

  update(dt, paused = false) {
    if (paused) { this.draw(dt); return; }
    const P = this.P;
    this.time += dt;
    if (!P) return;
    // something else took him: a ride, a climb, water, the jets
    if (this.state !== 'idle' && this.state !== 'wind' && (P.ride || P.climbing || P.swim || P.jetFlight || P.dead || P.down)) { this.state = 'idle'; this.chain = 0; this.guardOff(); }
    if ((this.state === 'air' || this.state === 'pound') && P.onGround) this.land();
    else if (this.state === 'idle' && this.guarding && P.onGround) this.guardOff();
    this.draw(dt);
  }

  land() {
    const P = this.P, up = this.up();
    const at = _u.copy(P.pos);
    if (this.state === 'pound') {
      this.state = 'idle'; this.chain = 0;
      this.stomp(at.clone(), up);
      this.guardOff();
      return;
    }
    const recent = this.armed && this.time - this.armedAt <= BOUNCE.window + 0.12;
    if (recent && this.chain < BOUNCE.max) { this.launch(1, this.chain + 1, null); return; }
    this.state = 'idle'; this.chain = 0; this.armed = false;
    this.wob.v -= 7;
    this.dust?.add(_v.copy(P.pos).addScaledVector(up, 0.03), up, 0.9);
    sfx.land(this.ctx.sound, 1);
    this.guardOff();
  }

  /** The stomp: what is near is thrown (foes knocked back, crates up), cracked floors break, what is buried comes up. */
  stomp(at, up = _Y) {
    const { ctx } = this, out = { foes: 0, things: 0, broken: 0, unearthed: 0 };
    for (const r of targetsInCone(at, _Y, STOMP.radius, Math.PI, ctx.physics)) {
      const T = r.target, d = at.distanceTo(T.position()), k = Math.max(0, 1 - d / STOMP.radius);
      if (k <= 0) continue;
      const dir = r.dir.clone().addScaledVector(up, -r.dir.dot(up));
      if (dir.lengthSq() < 1e-4) dir.set(1, 0, 0);
      dir.normalize();
      if (T.kind === 'foe') {
        T.onHit?.('push', r.point, dir, { shove: 6 * k, strength: k, source: 'stomp', mode: 'stomp' });
        const f = T.foe;
        if (f?.alive) { f.vel.copy(dir).multiplyScalar((f.kind === 'machine' ? 5 : 13) * k); f.stunned = Math.max(f.stunned ?? 0, 0.5 * k); }
        out.foes++;
      } else if (T.kind === 'prop') {
        T.prop.impulse(_v.copy(dir).multiplyScalar(STOMP.power * 0.5 * k).addScaledVector(up, STOMP.power * 0.7 * k));
        out.things++;
      } else if (T.onHit?.('push', r.point, dir, { strength: k, shove: 2.5 * k, source: 'stomp', mode: 'stomp' })) out.things++;
    }
    out.broken = ctx.world?.breakAt?.(_w.copy(at).addScaledVector(up, -0.3), STOMP.breakR) ?? 0;
    out.unearthed = unearth(ctx.scene ? hiddenIn(ctx.scene) : HIDDEN, at, 2.4).length;
    this.wob.v -= 14;
    this.dust?.add(_v.copy(at).addScaledVector(up, 0.03), up, 2.4);
    if (!out.broken) ctx.tool?.splats?.add?.(at, up, INK, '#3b3350', 1.6, 7);   // (a star of ink stamped on the ground, unless it gave way: the fluid tool's splats)
    sfx.stomp(ctx.sound);
    hitStop(0.06); kick(0.55);
    ctx.game?.emit?.('gadget:stomp', { at: at.clone(), ...out });
    return out;
  }

  /** The coils under the boots (lifting him by their length), the squash of the wind, the ring, the dust. */
  draw(dt) {
    const P = this.P, up = this.up();
    this.dust?.update(dt);
    const worn = this.ctx.game?.flag?.('gadget.equipped') === 'springs' || this.state !== 'idle';
    const show = worn && P && !P.ride && P.object?.visible !== false && !P.swim && !P.climbing;
    coilWobble(this.wob, Math.min(dt, 1 / 30));
    // the coils' length: standing, wound, flying
    const want = this.state === 'wind' ? THREE.MathUtils.lerp(SPRING.rest, SPRING.squash, this.charge)
      : (this.state === 'air' || this.state === 'hang') && !P?.onGround ? SPRING.out : this.state === 'pound' ? SPRING.out * 0.8 : SPRING.rest;
    this.len += (want - this.len) * (1 - Math.exp(-(this.state === 'wind' ? 30 : 12) * dt));
    const L = Math.max(0.02, this.len * (1 + THREE.MathUtils.clamp(this.wob.x, -0.6, 0.8)));
    for (const c of this.coils) c.visible = !!show;
    // squash winding, stretch on the launch (the whole figure, round its feet)
    const O = P?.object;
    if (O && O.scale) {
      this._base ??= O.scale.clone();
      this.stretch = Math.max(0, (this.stretch ?? 0) - dt * 4);
      const sq = this.state === 'wind' ? 0.16 * this.charge : 0;
      const st = this.stretch * 0.12 + Math.max(0, -this.wob.x) * 0.05;
      const sy = 1 - sq + st, sx = 1 + sq * 0.45 - st * 0.4;
      if (show || this._scaled) {
        O.scale.set(this._base.x * sx, this._base.y * sy, this._base.z * sx);
        this._scaled = Math.abs(sy - 1) > 1e-3;
      }
    }
    if (!show) { this.ring.visible = false; return; }
    // he stands on the coils: the figure lifted by their length
    if (O?.position) { O.position.addScaledVector(up, L); O.updateMatrixWorld(true); }
    const B = P.humanoid?.b;
    const right = _v.set(1, 0, 0);
    if (P.frame?.dir) { const d = P.frame.dir(P.heading, _w); right.crossVectors(d, up).normalize(); }
    for (let i = 0; i < 2; i++) {
      const bone = B?.[i ? 'foot_l' : 'foot_r'];
      const f = this.feet[i];
      if (bone) bone.getWorldPosition(f); else f.copy(P.pos).addScaledVector(right, i ? -0.12 : 0.12).addScaledVector(up, L);
      // the coil hangs from the sole down its length (the sole a little under the ankle's bone)
      const c = this.coils[i];
      c.position.copy(f).addScaledVector(up, -0.07 - L);
      c.quaternion.setFromUnitVectors(_Y, up);
      c.scale.set(1, L, 1);
    }
    // the wind ring: dashes lit one by one round the feet as they wind (gold when full)
    this.ring.visible = this.state === 'wind';
    if (this.ring.visible) {
      this.ring.position.copy(P.pos).addScaledVector(up, 0.02);
      this.ring.quaternion.setFromUnitVectors(_Y, up);
      const n = Math.round(this.charge * this.dashes.length), full = this.charge >= 1;
      const pulse = full ? 1 + 0.12 * Math.sin(this.time * 24) : 1 - 0.25 * this.charge;
      this.ring.scale.setScalar(pulse);
      this.dashes.forEach((m, i) => { m.visible = i < n || full; m.material = full ? this.dashMat[1] : this.dashMat[0]; });
    }
  }

  hud() {
    if (this.state === 'wind') return { count: Math.round(this.charge * 4), max: 4, note: this.charge >= 1 ? 'wound' : 'winding' };
    if (this.state === 'air' && this.chain) return { count: this.chain, max: BOUNCE.max, note: 'bounce' };
    return {};
  }

  dispose() {
    this.guardOff();
    for (const c of this.coils) c.removeFromParent();
    this.ring.removeFromParent(); this.dust?.dispose();
  }
}
