import * as THREE from 'three';
import { inkMat, INK, PAPER, aimRay, traceAim, assistPick } from './kit.js';
import { rayWorld } from '../fluid-tool.js';
import { registerTarget, targetsInCone } from '../targets.js';
import { hazardAt } from '../hazards.js';
import { thinRing } from '../thin.js';
import { kick } from '../feel.js';

// The bubble wand (docs/systems/gadgets.md, "The bubble wand"): hold the use button to aim (the reticle shows
// what it would catch), let go to blow a bubble. It flies out along the aim (toward a foe, a crate or a bomb
// it finds near the line) and engulfs the first thing it meets, floating it up slowly for BUBBLE.life seconds:
// a foe is helpless inside, a crate is lifted to a ledge, a bomb's fuse is sealed until it pops. Aimed at your
// own feet, or pressed in the air, it engulfs the traveller: he floats gently up and drifts with the stick a
// while, then sinks back down. Another press pops it early (and so does jump, from inside). Spikes, fire, a
// blade or an ember glob pop it too. Nothing is transparent in this renderer (the G-buffer has no blending), so
// a bubble is drawn as Moebius would: a thin ink rim, a band of pastel shimmer, a white highlight.

export const BUBBLE = {
  range: 14,          // m: how far the aim looks for something to catch
  assist: { cone: 0.17, near: 1.4 },   // rad round the aim, or m of its line, a foe, a crate or a bomb is found within (in sight)
  speed: 10,          // m/s an empty bubble is blown out at
  home: 13,           // m/s it flies to what the aim found
  drag: 1.4,          // 1/s an empty bubble slows
  free: 3,            // s an empty bubble floats before it pops
  life: 6,            // s a thing is carried
  rise: 1.25,         // m/s up
  maxRise: 7,         // m above where it was caught
  drift: 0.7,         // m/s along the way it was blown
  pad: 0.35,          // m of bubble round what it holds
  cool: 0.35,         // s between bubbles
  fuse: 0.3,          // s left on a bomb's fuse once its bubble pops
  grow: 0.28,         // s to blow it to its full size
  fall: 3.5,          // m: a foe dropped from higher than this lands hard (a cut)
  heavy: ['machine'], // too heavy to lift: the bubble pops on it
  self: { life: 5.5, rise: 1.5, maxRise: 7, drift: 2.6, sink: 1.3, sinkFor: 6, r: 1.15, lift: 0.95 },
};
const PASTELS = ['#f4b6c8', '#b8ead2', '#c9b8ef', '#f6e3a1', '#b4dcf2', '#f7c9a8'];
const GRAVITY = 32;   // (the traveller's, src/player.js: given back while he floats)

/** What the game says when a bubble bursts on a foe too heavy to lift, worded for what it burst on. Pure. */
export const HEAVY_WORDS = {
  machine: 'Too heavy for a bubble: it bursts on the machine’s shell.',
  brute: 'Too heavy for a bubble: it bursts on the brute’s cracked hull.',
  crab: 'Too heavy for a bubble: it bursts on the crab’s salt-crusted shell.',
  cart: 'Too heavy for a bubble: it hisses and bursts on the cart’s hot crucible.',
  bell: 'Too heavy for a bubble: it bursts with a ring on the bell’s bronze.',
};
export const heavyWords = (kind, name) => HEAVY_WORDS[kind] ?? `Too heavy for a bubble: it bursts on the ${name ?? 'foe'}.`;

const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _u = new THREE.Vector3(), _q = new THREE.Vector3();
const _Y = new THREE.Vector3(0, 1, 0);

/** How fast a bubble rises at height h over where it caught its load: full speed low down, a hover at its top. Pure. */
export function riseSpeed(h, { rise = BUBBLE.rise, maxRise = BUBBLE.maxRise } = {}) {
  return rise * THREE.MathUtils.clamp((maxRise - h) / 1.5, 0, 1);
}

/** A bubble's radius round a thing of radius `size` (kind 'self': the traveller; 'free': nothing in it yet). Pure. */
export function bubbleRadius(kind, size = 0.5) {
  if (kind === 'self') return BUBBLE.self.r;
  if (kind === 'free') return 0.55;
  return Math.max(0.5, size + BUBBLE.pad);
}

/** Is the traveller blowing it round himself? In the air, or the aim pointed down at his own feet. Pure. */
export const wantsSelf = (dir, up, airborne) => !!airborne || dir.dot(up) < -0.72;

/** Where a traveller's float is at time t: 'rise' (up and drifting), 'sink' (time up: down, gently), 'pop'. Pure. */
export function selfPhase(t, S = BUBBLE.self) {
  return t < S.life ? 'rise' : t < S.life + S.sinkFor ? 'sink' : 'pop';
}

/** The traveller's velocity along up while he floats (h: metres over where it began, phase from selfPhase). Pure. */
export function selfLift(h, phase, S = BUBBLE.self) {
  if (phase === 'sink') return -S.sink;
  if (phase === 'pop') return 0;
  return riseSpeed(h, S);
}

// ------------------------------------------------------------------ sounds (the game's synth, src/audio.js)
const now = (s) => (s?.ctx ? s.ctx.currentTime : null);
export const bubbleSfx = {
  /** blown: a soft breath through the loop */
  blow(s) { const t = now(s); if (t == null) return; s.burst(t, { dur: 0.26, type: 'bandpass', freq: 1300, q: 0.8, vol: 0.05, rate: 0.9 }); s.sweep(t + 0.04, 320, 640, 0.2, 0.035); },
  /** it closes round something: a round wet plop */
  plop(s, vol = 1) { const t = now(s); if (t == null || vol < 0.03) return; s.sweep(t, 170, 560, 0.09, 0.14 * vol); s.sweep(t + 0.08, 560, 300, 0.07, 0.05 * vol); },
  /** it pops: a bright tick and a spatter of drops */
  pop(s, vol = 1) {
    const t = now(s); if (t == null || vol < 0.03) return;
    s.burst(t, { dur: 0.035, type: 'highpass', freq: 3200, q: 0.7, vol: 0.14 * vol, rate: 1.8 });
    s.sweep(t, 1500, 2700, 0.05, 0.05 * vol, 'triangle');
    for (let i = 0; i < 3; i++) s.burst(t + 0.05 + i * 0.03 + Math.random() * 0.02, { dur: 0.015, type: 'bandpass', freq: 3600 + i * 600, q: 3, vol: 0.04 * vol });
  },
  /** a float running out: a thin wobble */
  wobble(s) { const t = now(s); if (t == null) return; s.sweep(t, 700, 520, 0.18, 0.025, 'triangle'); },
};

// ------------------------------------------------------------------ the look

/** A ring of radius R in its own plane, drawn at least `px` pixels wide (src/thin.js). */
function ringMesh(R, tube, mat, arc = Math.PI * 2, seg = 48) {
  const g = thinRing(new THREE.TorusGeometry(R, tube, 3, seg, arc), R, seg, 3, arc);
  const m = new THREE.Mesh(g, mat); m.userData.noCollide = true;
  return m;
}

/** A bubble as an ink drawing: a thin rim, a band of pastel arcs inside it, a tilted meridian, a highlight. Radius 1. */
function bubbleLook() {
  const g = new THREE.Group(); g.userData.noCollide = true; g.name = 'Bubble';
  const face = new THREE.Group(); g.add(face);   // (turned to the camera every frame)
  face.add(ringMesh(1, 0.014, inkMat(INK, { thin: 1.4 })));
  const band = new THREE.Group(); face.add(band);
  // (wide enough that the colour reads between the post pass's own lines round it)
  PASTELS.forEach((c, i) => { const a = ringMesh(0.92, 0.065, inkMat(c, { glow: 0.7 }), Math.PI / 3 + 0.02, 10); a.rotation.z = (i / PASTELS.length) * Math.PI * 2; band.add(a); });
  const inner = new THREE.Group(); face.add(inner);
  [0, 2, 4].forEach((k) => { const a = ringMesh(0.8, 0.04, inkMat(PASTELS[(k + 3) % 6], { glow: 0.6 }), 1.1, 10); a.rotation.z = (k / 6) * Math.PI * 2 + 0.6; inner.add(a); });
  const merid = ringMesh(0.97, 0.011, inkMat('#ffffff', { glow: 0.6, thin: 1 }));
  face.add(merid);
  const hi = ringMesh(0.72, 0.045, inkMat('#ffffff', { glow: 1 }), 0.95, 10); hi.rotation.z = 1.85; face.add(hi);
  const glint = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), inkMat('#ffffff', { glow: 1 }));
  glint.position.set(-0.36, 0.56, 0.05); glint.userData.noCollide = true; face.add(glint);
  return { group: g, face, band, inner, merid };
}

/** The wand: a turned wooden handle, a brass loop with a film of soap across it, a little pot of soap. ~0.3 m. */
function wandModel() {
  const g = new THREE.Group();
  const wood = inkMat('#b9824e'), dark = inkMat('#6c4428'), brass = inkMat('#d6a94a', { metal: 'brass' }), film = inkMat('#d9c8f2', { glow: 0.35 });
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.016, 0.2, 8).translate(0, 0.1, 0), wood));
  g.add(new THREE.Mesh(new THREE.SphereGeometry(0.02, 8, 6).translate(0, 0, 0), dark));
  g.add(new THREE.Mesh(new THREE.TorusGeometry(0.018, 0.006, 5, 12).rotateX(Math.PI / 2).translate(0, 0.17, 0), brass));
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.04, 5).translate(0, 0.215, 0), brass));
  g.add(new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.007, 6, 24).translate(0, 0.29, 0), brass));
  g.add(new THREE.Mesh(new THREE.CircleGeometry(0.05, 20).translate(0, 0.29, 0.001), film));
  g.add(new THREE.Mesh(new THREE.CircleGeometry(0.05, 20).rotateY(Math.PI).translate(0, 0.29, -0.001), film));
  // the pot of soap at its foot, a cork in it
  const pot = new THREE.Group(); pot.position.set(0.09, -0.02, 0);
  pot.add(new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.04, 0.07, 12), inkMat('#9fd6cf')));
  pot.add(new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.022, 0.025, 8).translate(0, 0.045, 0), inkMat('#c9a27a')));
  g.add(pot);
  // and a small bubble just blown, at the loop's side
  const b = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.004, 4, 16).translate(-0.08, 0.34, 0), inkMat(INK));
  g.add(b);
  g.add(new THREE.Mesh(new THREE.TorusGeometry(0.026, 0.004, 3, 10, 2).translate(-0.08, 0.34, 0.002), inkMat(PASTELS[0], { glow: 0.5 })));
  g.rotation.set(0.15, 0, -0.35);
  return g;
}

export default {
  id: 'bubble', name: 'Bubble wand', glyph: '◯', order: 90, trigger: 'aim',
  text: 'A brass loop on a turned handle and a little pot of the makers’ soap, which never runs dry. Its bubbles are tougher than they look, and lighter than air.',
  use: 'Aim with LT / L2 (R, or the right mouse button) and blow a bubble with RT / R2 (T, or a left click). It catches the first thing it meets (a foe, a crate, a bomb) and floats it up for six seconds: foes are helpless inside, crates can be lifted onto ledges, a bomb’s fuse waits until the bubble pops. Aim at your own feet, or press it in the air, to float up yourself and drift with the stick. Press again (or jump) to pop it. Spikes, fire and blades pop it too.',
  model: wandModel,
  create(ctx) { return new Wand(ctx); },

  /** Its bay in the Gadget Yard: a ledge with a floor plate on top (lift a crate onto it), a gate it opens,
   *  a cracked boulder on a tall pillar (carry a bomb up), and a high pole to float up to. */
  yard(kit) {
    kit.flag('#c9b8ef');
    // the ledge and its plate: a crate floated up and dropped on it opens the gate of the alcove beside it
    kit.block([4, 5, 4], [-3.5, 2.5, -8]);
    const plate = kit.plate([-3.5, 5, -8], { radius: 1.35 });
    kit.block([0.8, 3.4, 4.4], [0.6, 1.7, -8.6]);
    kit.block([0.8, 3.4, 4.4], [4.4, 1.7, -8.6]);
    kit.block([4.6, 0.6, 5], [2.5, 3.7, -8.6]);
    kit.block([4.6, 3.4, 0.8], [2.5, 1.7, -11]);
    kit.lamp([2.5, 0, -9.2]);
    kit.gate([3.1, 3.2, 0.25], [2.5, 1.6, -6.4], { plates: [plate] });
    kit.crate([-1.2, 0.45, -3.6]); kit.crate([0.4, 0.45, -2.6]);
    // a cracked boulder on a pillar too tall for a thrown bomb's blast: float one up beside it
    kit.block([1.6, 6.6, 1.6], [5.8, 3.3, -2.5], { mat: 'pale' });
    kit.cracked([2, 1.8, 2], [5.8, 7.5, -2.5], { shape: 'boulder' });
    // a pole with a lamp on its cap, past what can be climbed: float yourself up and pop the bubble over it
    kit.pole([-6.5, 0, -1], 6.4);
    kit.lamp([-6.5, 6.4, -1]);
  },
};

/** One bubble: what it holds (`kind`: 'free' | 'prop' | 'foe' | 'bomb' | 'self', `thing`), where, how big. */
class Bubble {
  constructor(look) { this.look = look; this.pos = new THREE.Vector3(); this.vel = new THREE.Vector3(); this.blow = new THREE.Vector3(); this.goal = null; }
}

class Wand {
  constructor(ctx) {
    this.ctx = ctx;
    this.aiming = false; this.cool = 0;
    this.bubble = null;      // (one at a time: another press pops it)
    this.falling = [];       // foes let go up high, falling back down
    this.look = bubbleLook();
    this.look.group.visible = false;
    ctx.fx.add(this.look.group);
    this.held = wandModel(); this.held.scale.setScalar(1.4); this.held.visible = false;
    this.held.traverse((o) => { o.userData.noCollide = true; });
    ctx.fx.add(this.held);
    this.ray = { origin: new THREE.Vector3(), dir: new THREE.Vector3() };
    this.aimHit = null; this.showRet = false;
    // the bubble is a target too: a blade, an ember glob or plain fluid pops it, the push and a gust blow it along
    this.offTarget = registerTarget({ kind: 'bubble', bubble: this, radius: 1, accepts: ['blade', 'fire', 'gust'],
      position: () => this.bubble?.pos ?? _v.set(0, -1e6, 0),
      enabled: () => !!this.bubble && this.bubble.kind !== 'self' && this.bubble.t > 0.15,
      onHit: (mode, point, dir, info) => this.hit(mode, dir, info) });
  }

  get up() { return this.ctx.player?.frame?.up ?? _Y; }
  canUse() {
    const P = this.ctx.player;
    return !!P && !P.ride && !P.down && !P.climbing && !P.mantle && !P.dead && !P.swim?.under;
  }
  hand(out = new THREE.Vector3()) {
    const { tool, player: P } = this.ctx;
    if (tool?.muzzle && P?.object?.visible !== false) return tool.muzzle(out);
    return out.copy(P.pos).addScaledVector(P.frame.up, 1.45);
  }

  equip() { this.ctx.sfx?.equip?.(this.ctx.sound); }
  unequip() { this.aiming = false; }
  cancel() { this.aiming = false; }
  /** The aim let go unused (LT / L2 released: src/gadgets/index.js). */
  lower() { this.aiming = false; }

  press() {
    if (this.bubble) { this.pop('pressed'); this.cool = BUBBLE.cool * 0.5; return; }   // pressed again: popped
    if (!this.canUse() || this.cool > 0) return;
    const P = this.ctx.player;
    if (!P.onGround && !P.climbing) { this.wrapSelf(); return; }   // in the air: round yourself at once
    this.aiming = true;
  }
  release() {
    if (!this.aiming) return;
    this.aiming = false;
    if (!this.canUse() || this.cool > 0 || this.bubble) return;
    const hit = this.trace();
    if (hit.self) this.wrapSelf(); else this.blowAt(hit);
  }

  /** What a bubble blown now would catch: something near the aim (a foe, a crate, a bomb), yourself (aimed at your feet), or nothing. */
  trace() {
    const { camera, player: P, physics, world } = this.ctx;
    aimRay(camera, P, this.ray);
    if (wantsSelf(this.ray.dir, this.up, false)) return { self: true, kind: 'self', point: P.pos.clone(), ok: true };
    const hit = traceAim(physics, this.ray.origin, this.ray.dir, BUBBLE.range + 4, { anchors: [] });
    const hand = this.hand(_u);
    let catchIt = null;
    if (hit.kind === 'target' && this.catchable(hit.target)) catchIt = hit.target;
    // nothing caught on the line: a foe, a crate or a bomb close to it, in sight of the wand (aim assist)
    if (!catchIt) {
      const near = Math.min(BUBBLE.range, hit.kind === 'world' ? hit.distance + 1.5 : BUBBLE.range);
      const props = (world?.props ?? []).filter((p) => p.object.visible && !p.held).map((p) => ({ pos: p.pos, r: p.r, t: { kind: 'prop', prop: p, position: () => p.pos } }));
      const bombs = (this.ctx.gadget?.('bomb')?.live ?? []).filter((b) => !b.held).map((b) => ({ pos: b.pos, r: 0.2, t: { kind: 'bomb', bomb: b, position: () => b.pos } }));
      const foes = (this.ctx.foes?.list ?? []).filter((f) => f.alive && f.chest).map((f) => ({ pos: f.chest, r: f.def?.radius ?? 0.5, t: { kind: 'foe', foe: f, position: () => f.chest } }));
      const cands = [...bombs, ...props, ...foes];
      for (let i = 0; i < 3 && !catchIt; i++) {
        const a = assistPick(this.ray.origin, this.ray.dir, cands, { range: near, cone: BUBBLE.assist.cone, near: BUBBLE.assist.near });
        if (!a) break;
        const it = a.item, d = hand.distanceTo(it.pos);
        const block = d > 0.5 ? rayWorld(physics, hand, _q.subVectors(it.pos, hand).divideScalar(d), d) : null;
        if (!block || block.point.distanceTo(it.pos) <= it.r + 0.4) catchIt = it.t;
        else cands.splice(cands.indexOf(it), 1);   // (behind something: the next nearest the line)
      }
    }
    if (catchIt) {
      const p = catchIt.position();
      const d = hand.distanceTo(p);
      return { kind: catchIt.kind === 'foe' ? 'foe' : catchIt.kind, target: catchIt, point: p.clone(), ok: d <= BUBBLE.range + 1, reach: d };
    }
    const solid = hit.kind === 'world' || hit.kind === 'target';
    return { kind: solid ? 'world' : 'none', point: hit.point, ok: solid && hand.distanceTo(hit.point) <= BUBBLE.range, reach: hand.distanceTo(hit.point) };
  }

  catchable(T) {
    if (!T) return false;
    if (T.kind === 'foe') return !!T.foe?.alive;
    if (T.kind === 'prop') return !!T.prop && !T.prop.held;
    return false;
  }

  /** A bubble blown from the wand toward `hit` (a thing found: it flies to it; else out along the aim). */
  blowAt(hit) {
    const from = this.hand(new THREE.Vector3());
    const b = this.spawn('free', from);
    const dir = _v.subVectors(hit.point, from);
    if (dir.lengthSq() < 1e-4) dir.copy(this.ray.dir);
    dir.normalize();
    b.blow.copy(dir).addScaledVector(this.up, -dir.dot(this.up)).normalize();
    if (hit.target && hit.ok) { b.goal = hit.target; b.vel.copy(dir).multiplyScalar(BUBBLE.home); }
    else b.vel.copy(dir).multiplyScalar(BUBBLE.speed);
    bubbleSfx.blow(this.ctx.sound);
    this.cool = BUBBLE.cool;
    return b;
  }

  /** A new bubble of `kind` at `at` (also the tests' way in). */
  spawn(kind, at) {
    const b = new Bubble(this.look);
    b.kind = kind; b.pos.copy(at); b.t = 0; b.r = bubbleRadius(kind); b.grow = 0; b.base = 0; b.phase = Math.random() * 6;
    b.blow.set(0, 0, 0);
    this.bubble = b;
    this.look.group.visible = true;
    return b;
  }

  /** The traveller wrapped in a bubble of his own. */
  wrapSelf() {
    const P = this.ctx.player, up = this.up;
    const b = this.spawn('self', _v.copy(P.pos).addScaledVector(up, BUBBLE.self.lift));
    b.thing = P; b.base = P.pos.dot(up); b.grow = 0.4;
    b.hurtAt = P.hurtAt;
    if (P.jetFlight) P.endJets?.();
    P.gliding = false;
    bubbleSfx.blow(this.ctx.sound); bubbleSfx.plop(this.ctx.sound);
    this.cool = BUBBLE.cool;
    this.ctx.notice?.('Floating: steer with {key:move}, press {key:gadget} again (or {key:jump}) to pop it.', 'bubble.self');
    return b;
  }

  /** An empty bubble meets `T` (a target found by the aim, or one it touched): it closes round it. */
  engulf(T) {
    const b = this.bubble, up = this.up;
    if (!b || b.kind !== 'free') return false;
    if (T.kind === 'foe') {
      const f = T.foe;
      if (!f?.alive) return false;
      if (BUBBLE.heavy.includes(f.kind) || (f.def?.heavy && !f.def?.metal)) { this.ctx.notice?.(heavyWords(f.kind, f.def?.name), `bubble.heavy.${f.kind}`); this.pop('heavy'); return false; }
      b.kind = 'foe'; b.thing = f; b.r = bubbleRadius('foe', (f.def?.radius ?? 0.5) * 1.1);
      b.lift = b.r * 0.8;
      b.pos.copy(f.pos).addScaledVector(up, b.lift);
      f.vel?.set(0, 0, 0);
      f.stunned = Math.max(f.stunned ?? 0, 0.5);
    } else if (T.kind === 'prop') {
      const p = T.prop;
      if (!p || p.held) return false;
      b.kind = 'prop'; b.thing = p; b.r = bubbleRadius('prop', Math.max(p.r, p.h) * 1.05);
      p.held = this; p.resting = false; p.vel.set(0, 0, 0);
      b.pos.copy(p.pos);
    } else if (T.kind === 'bomb') {
      const bomb = T.bomb;
      if (!bomb || bomb.held) return false;
      b.kind = 'bomb'; b.thing = bomb; b.r = bubbleRadius('bomb', 0.25);
      bomb.held = this; bomb.vel.set(0, 0, 0);
      b.pos.copy(bomb.pos);
    } else return false;
    b.base = b.pos.dot(up); b.t = 0; b.goal = null;
    b.vel.copy(b.blow).multiplyScalar(BUBBLE.drift);
    bubbleSfx.plop(this.ctx.sound, this.near(b.pos));
    this.drops(b.pos, b.r, 8, 2.5);
    return true;
  }

  /** The bubble as a target: a blade, an ember glob or a plain glob pops it; the push and a gust blow it along. */
  hit(mode, dir, info = {}) {
    const b = this.bubble;
    if (!b) return false;
    if (mode === 'push' || mode === 'gust') {
      if (dir) b.vel.addScaledVector(_w.copy(dir).addScaledVector(this.up, -dir.dot(this.up)), (mode === 'gust' ? 6 : 3.5) * (0.4 + 0.6 * (info.strength ?? 1)));
      return true;
    }
    this.pop(mode);
    return true;
  }

  /** Popped (pressed again, a hazard, a blade, time up): what it held is let go, with a splash of drops. */
  pop(why = 'time') {
    const b = this.bubble, up = this.up;
    if (!b) return;
    this.bubble = null;
    this.look.group.visible = false;
    const T = b.thing;
    if (b.kind === 'prop' && T) { T.held = null; T.vel.multiplyScalar(0.3); T.resting = false; }
    if (b.kind === 'bomb' && T) { T.held = null; T.vel.set(0, 0, 0); T.fuse = Math.min(T.fuse, BUBBLE.fuse); }
    if (b.kind === 'foe' && T?.alive) {
      const ground = this.groundUnder(T.pos);
      T.stunned = Math.max(T.stunned ?? 0, 0.6);
      if (Number.isFinite(ground) && T.pos.y > ground + 0.05) this.falling.push({ foe: T, vy: 0, from: T.pos.y, ground });
    }
    if (b.kind === 'self' && T) { T.vel.multiplyScalar(0.5); }
    bubbleSfx.pop(this.ctx.sound, this.near(b.pos));
    this.drops(b.pos, b.r, 26, 4.5);
    this.ctx.tool?.rings?.add?.({ from: b.pos, dir: this.ctx.camera ? _w.copy(this.ctx.camera.position).sub(b.pos).normalize() : up, reach: 0, r0: b.r * 0.8, r1: b.r * 1.6, life: 0.22, color: '#ffffff', thick: 0.7 });
    if (b.kind === 'self') kick(0.12);
    this.ctx.game?.emit?.('gadget:bubble', { kind: b.kind, why });
    if (why === 'spikes' || why === 'fire') this.ctx.notice?.(why === 'fire' ? 'The heat bursts the bubble.' : 'Pop: the bubble meets the spikes.', `bubble.${why}`);
  }

  /** A splash of soap drops round the bubble's skin: pastel and white, flung out, falling. */
  drops(at, r, n = 20, speed = 4) {
    const D = this.ctx.tool?.drops;
    if (!D) return;
    for (let i = 0; i < n; i++) {
      const v = _q.randomDirection();
      D.add({ pos: _u.copy(at).addScaledVector(v, r * 0.95), vel: v.clone().multiplyScalar(speed * (0.5 + Math.random() * 0.7)).addScaledVector(this.up, 1.2), drag: 2.2, grav: 9, size: 0.035 + Math.random() * 0.04, stretch: 1.8, life: 0.35 + Math.random() * 0.35, color: i % 3 === 0 ? '#ffffff' : PASTELS[i % PASTELS.length] });
    }
  }

  near(p) { const P = this.ctx.player; return P ? THREE.MathUtils.clamp(1 - P.pos.distanceTo(p) / 50, 0, 1) : 1; }
  groundUnder(p) {
    const g = this.ctx.physics?.groundAt?.(p.x, p.y + 0.5, p.z, 60);
    return Number.isFinite(g) ? g : -Infinity;
  }

  /** Before the traveller moves: floating in his own bubble, his velocity is the bubble's. */
  control(dt, input = {}) {
    const b = this.bubble, P = this.ctx.player;
    if (!b || b.kind !== 'self' || !P) return;
    // jump from inside: popped, and the press carries on (the wings may open at once)
    if (input.Space && !this._spaceHeld) { this._spaceHeld = true; this.pop('jump'); return; }
    this._spaceHeld = !!input.Space;
    const up = this.up, phase = selfPhase(b.t);
    const h = P.pos.dot(up) - b.base;
    const vu = selfLift(h, phase) + Math.sin(b.t * 2.4) * 0.12;
    const vh = _v.copy(P.vel).addScaledVector(up, -P.vel.dot(up));
    if (vh.length() > BUBBLE.self.drift) vh.setLength(BUBBLE.self.drift);
    P.vel.copy(vh).addScaledVector(up, vu + GRAVITY * dt);   // (his step takes gravity away again)
    P.onGround = false; P.gliding = false; P._carry = false;
    if (typeof P._climbCooldown === 'number') P._climbCooldown = Math.max(P._climbCooldown, 0.1);   // (against a wall it slides: no grabbing it)
    if (P.jetFlight) P.endJets?.();
  }

  update(dt, paused = false) {
    const { player: P, camera } = this.ctx, up = this.up;
    if (paused) {
      // (a conversation, a scene: floating yourself, the bubble pops and lets you down; what it carries waits in it)
      this.aiming = false; this.held.visible = false;
      if (this.showRet) { this.ctx.hud?.reticle?.(null); this.showRet = false; }
      if (this.bubble?.kind === 'self') this.pop('gone');
      return;
    }
    this.cool = Math.max(0, this.cool - dt);
    if (this.aiming && !this.canUse()) this.aiming = false;
    // aiming: the wand in hand, the reticle on what it would catch
    this.held.visible = this.aiming;
    if (this.aiming) {
      const hand = this.hand(_q);
      this.held.position.copy(hand);
      if (camera) this.held.quaternion.copy(camera.quaternion);
      this.aimHit = this.trace();
      const H = this.aimHit;
      const label = H.self ? 'yourself' : H.kind === 'foe' ? (H.ok ? 'a foe' : 'out of reach') : H.kind === 'prop' ? 'a crate' : H.kind === 'bomb' ? 'a bomb' : H.ok ? `${Math.round(H.reach)} m` : '';
      this.ctx.hud?.reticle?.(H.self ? _w.copy(P.pos).addScaledVector(up, 0.9) : H.point, H.self || (H.target && H.ok) ? 'target' : H.ok ? 'ok' : 'far', label);
      this.showRet = true;
      this.ctx.aimAt?.(H.point, this.ray.dir);
    } else if (this.showRet) { this.ctx.hud?.reticle?.(null); this.showRet = false; }
    if (this.bubble) this.updateBubble(this.bubble, dt);
    this.updateFalling(dt);
  }

  updateBubble(b, dt) {
    const { player: P, physics } = this.ctx, up = this.up;
    b.t += dt;
    b.grow = Math.min(1, b.grow + dt / BUBBLE.grow);
    const T = b.thing;
    switch (b.kind) {
      case 'free': {
        // homing on what the aim found, else out along the aim, slowing and rising a little
        if (b.goal) {
          const at = b.goal.position?.();
          if (!at || (b.goal.kind === 'foe' && !b.goal.foe?.alive)) b.goal = null;
          else {
            const to = _v.subVectors(at, b.pos), d = to.length();
            if (d < b.r + (b.goal.kind === 'foe' ? b.goal.foe.def?.radius ?? 0.5 : 0.5)) { if (this.engulf(b.goal)) break; b.goal = null; }
            else b.vel.copy(to.divideScalar(d)).multiplyScalar(BUBBLE.home);
          }
        } else {
          b.vel.multiplyScalar(Math.exp(-BUBBLE.drag * dt)).addScaledVector(up, 0.6 * dt);
          // touching anything it can hold, it closes round it
          const touch = this.touching(b);
          if (touch && this.engulf(touch)) break;
        }
        const move = _v.copy(b.vel).multiplyScalar(dt), L = move.length();
        if (L > 1e-5) {
          const hit = rayWorld(physics, b.pos, _w.copy(move).divideScalar(L), L + b.r * 0.6 * b.grow);
          if (hit) {
            // what it meets may be what it was blown at (a crate is solid): it closes round that; else it pops
            const near = b.goal && b.goal.position?.()?.distanceTo(hit.point) < 1.6 ? b.goal : this.touching(b, 1);
            if (near && this.engulf(near)) break;
            this.pop('wall'); return;
          }
          b.pos.add(move);
        }
        if (b.t > BUBBLE.free + (b.goal ? 2 : 0)) { this.pop('time'); return; }
        break;
      }
      case 'prop': {
        if (!T?.object?.visible) { this.pop('gone'); return; }
        const h = b.pos.dot(up) - b.base;
        this.drift(b, dt);
        b.vel.addScaledVector(up, riseSpeed(h) + Math.sin(b.t * 2.1 + b.phase) * 0.1 - b.vel.dot(up));
        T.vel.copy(b.vel); T.resting = false;   // (the world steps it with its own collision: src/gadgets/world.js)
        b.pos.copy(T.pos);
        break;
      }
      case 'foe': {
        if (!T?.alive) { this.pop('gone'); return; }
        const h = b.pos.dot(up) - b.base;
        this.drift(b, dt);
        b.vel.addScaledVector(up, riseSpeed(h) + Math.sin(b.t * 2.1 + b.phase) * 0.1 - b.vel.dot(up));
        this.carry(b, dt);
        // helpless inside: still, its feet off the ground, the bubble's height its own
        T.stunned = Math.max(T.stunned ?? 0, 0.3); T.vel?.set(0, 0, 0); T.state = T.state === 'wind' || T.state === 'strike' ? 'recover' : T.state;
        if (T.alt !== undefined && T.def?.hover) T.alt = 0;
        T.pos.copy(b.pos).addScaledVector(up, -b.lift);
        T.model?.group?.position.copy(T.pos).addScaledVector(up, 0.15);
        T.heading = (T.heading ?? 0) + dt * 0.9;   // (it turns slowly, helpless)
        break;
      }
      case 'bomb': {
        if (!T || !(this.ctx.gadget?.('bomb')?.live ?? [T]).includes(T)) { this.pop('gone'); return; }
        const h = b.pos.dot(up) - b.base;
        this.drift(b, dt);
        b.vel.addScaledVector(up, riseSpeed(h) + Math.sin(b.t * 2.1 + b.phase) * 0.1 - b.vel.dot(up));
        this.carry(b, dt);
        T.pos.copy(b.pos); T.vel.set(0, 0, 0);
        break;
      }
      case 'self': {
        if (!T || T.dead || T.down || T.ride || T.climbing || T.mantle || T.swim) { this.pop('gone'); return; }
        if (T.hurtAt !== b.hurtAt) { this.pop('hurt'); return; }   // (a foe's strike, a thorn: it bursts)
        const phase = selfPhase(b.t);
        if (phase === 'pop' || (phase === 'sink' && T.onGround)) { this.pop('time'); return; }
        if (phase === 'sink' && !b.warned) { b.warned = true; bubbleSfx.wobble(this.ctx.sound); }
        // (after his move: the stick's drift kept slow)
        const vh = _v.copy(T.vel).addScaledVector(up, -T.vel.dot(up));
        if (vh.length() > BUBBLE.self.drift) { vh.setLength(BUBBLE.self.drift); T.vel.copy(vh).addScaledVector(up, T.vel.dot(up)); }
        b.pos.copy(T.pos).addScaledVector(up, BUBBLE.self.lift);
        break;
      }
    }
    if (!this.bubble) return;
    // time up for what it carries; spikes, fire or an ember pop it
    if (b.kind !== 'self' && b.kind !== 'free' && b.t > BUBBLE.life) { this.pop('time'); return; }
    const danger = this.danger(b);
    if (danger) { this.pop(danger); return; }
    this.draw(b, dt);
  }

  /** Its way across: easing back to its slow drift along the way it was blown (a gust's push dies away into it). */
  drift(b, dt) {
    const up = this.up, vu = b.vel.dot(up);
    _v.copy(b.vel).addScaledVector(up, -vu);
    _w.copy(b.blow).multiplyScalar(BUBBLE.drift);
    _v.lerp(_w, 1 - Math.exp(-0.8 * dt));
    b.vel.copy(_v).addScaledVector(up, vu);
  }

  /** A foe's or a bomb's bubble moves by its velocity, sliding along what it meets (it is tough: it does not pop on a wall). */
  carry(b, dt) {
    const physics = this.ctx.physics;
    const move = _v.copy(b.vel).multiplyScalar(dt), L = move.length();
    if (L < 1e-5) return;
    const dir = _w.copy(move).divideScalar(L);
    const hit = rayWorld(physics, b.pos, dir, L + b.r * 0.7);
    if (hit) {
      const vn = b.vel.dot(hit.normal);
      if (vn < 0) b.vel.addScaledVector(hit.normal, -vn);
      move.copy(b.vel).multiplyScalar(dt);
      const again = move.length() > 1e-5 ? rayWorld(physics, b.pos, _w.copy(move).normalize(), move.length() + b.r * 0.7) : null;
      if (again) return;
    }
    b.pos.add(move);
  }

  /** Something an empty bubble touches that it can close round: a foe, a loose thing, a bomb. */
  touching(b, extra = 0) {
    for (const p of this.ctx.world?.props ?? []) if (p.object.visible && !p.held && p.pos.distanceTo(b.pos) < b.r + p.r + 0.2 + extra) return { kind: 'prop', prop: p };
    for (const bomb of this.ctx.gadget?.('bomb')?.live ?? []) if (!bomb.held && bomb.pos.distanceTo(b.pos) < b.r + 0.25 + extra) return { kind: 'bomb', bomb };
    for (const f of this.ctx.foes?.list ?? []) if (f.alive && f.dead === undefined && f.chest.distanceTo(b.pos) < b.r + f.def.radius + extra) return { kind: 'foe', foe: f };
    return null;
  }

  /** What pops it where it is: a hazard (spikes, flame), a fire burning (the fluid tool's ember, a lamp), or null. */
  danger(b) {
    const up = this.up;
    const feet = b.kind === 'self' ? b.thing.pos : _u.copy(b.pos).addScaledVector(up, -Math.min(1, b.r));
    const hz = hazardAt(feet);
    if (hz) return hz.kind === 'fire' ? 'fire' : 'spikes';
    for (const r of targetsInCone(b.pos, up, b.r + 0.6, Math.PI)) {
      const T = r.target;
      if (T.kind === 'flammable' && (T.spot?.burning > 0)) return 'fire';
      if (T.kind === 'ember' && T.burning?.()) return 'fire';
    }
    return null;
  }

  /** Drawn: turned to the camera, its pastel band turning, its skin wobbling, swelling as it is blown. */
  draw(b, dt) {
    const L = this.look, cam = this.ctx.camera;
    const s = b.r * (0.3 + 0.7 * THREE.MathUtils.smootherstep(b.grow, 0, 1));
    L.group.position.copy(b.pos);
    if (cam) L.face.quaternion.copy(cam.quaternion);
    const w = Math.sin(b.t * 5.3 + b.phase) * 0.035 * (b.kind === 'self' && selfPhase(b.t) === 'sink' ? 2.4 : 1);
    L.face.scale.set(s * (1 + w), s * (1 - w), s);
    L.band.rotation.z += dt * 0.55;
    L.inner.rotation.z -= dt * 0.8;
    L.merid.rotation.set(0.5 + Math.sin(b.t * 0.9) * 0.3, b.t * 1.3, 0);
    L.merid.scale.set(1, 0.3 + 0.12 * Math.sin(b.t * 1.7), 1);
  }

  /** Foes let go up high fall back down (they land hard from high: a cut). */
  updateFalling(dt) {
    for (let i = this.falling.length - 1; i >= 0; i--) {
      const F = this.falling[i], f = F.foe;
      if (!f.alive || this.bubble?.thing === f) { this.falling.splice(i, 1); continue; }
      F.vy -= 24 * dt;
      f.pos.y += F.vy * dt;
      f.stunned = Math.max(f.stunned ?? 0, 0.3);
      f.model?.group?.position.copy(f.pos).setY(f.pos.y + 0.15);
      if (f.pos.y <= F.ground) {
        f.pos.y = F.ground;
        this.falling.splice(i, 1);
        if (F.from - F.ground > BUBBLE.fall) {
          f.stunned = 0;   // (one cut for the fall, not a stilled foe's double)
          if (this.ctx.foes?.hurt) this.ctx.foes.hurt(f, 'blade', _v.set(0, -1, 0), { damage: 1, source: 'bubble' });
          else f.hit?.('blade', _v.set(0, -1, 0), { damage: 1 });
          this.ctx.tool?.drops && this.drops(_w.copy(f.pos).setY(f.pos.y + 0.3), 0.4, 10, 3);
          if (f.alive) f.stunned = Math.max(f.stunned ?? 0, 0.8);
        }
      }
    }
  }

  hud() {
    const b = this.bubble;
    if (!b) return { note: this.cool > 0 ? '' : 'blow' };
    if (b.kind === 'self') return { note: selfPhase(b.t) === 'sink' ? 'sinking' : `floating ${Math.max(0, Math.ceil(BUBBLE.self.life - b.t))} s` };
    if (b.kind === 'free') return { note: 'blown' };
    return { note: `${b.kind === 'prop' ? 'a crate' : b.kind === 'bomb' ? 'a bomb' : 'a foe'} · ${Math.max(0, Math.ceil(BUBBLE.life - b.t))} s` };
  }

  dispose() {
    if (this.bubble) this.pop('gone');
    this.offTarget?.();
    this.look.group.removeFromParent(); this.held.removeFromParent();
  }
}
