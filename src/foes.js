import * as THREE from 'three';
import { makeMaterial } from './materials.js';
import { registerTarget } from './targets.js';
import { Telegraph, strikeDamage, inArea } from './temples/boss.js';
import { game as sharedGame } from './game-state.js';
import { gainInk, INK_OF } from './ink.js';
import { ShadeBody, ShadePools } from './shade.js';

// Foes (docs/systems/foes.md): the first things in the game that fight back.
//
// - **Ink blots** gather in the wilds: loose ink and scribble that drift in from the margins of the
//   drawing, away from people, the ship and the cities. They compress, then lunge through a visible
//   strike and recover. The fluid blade cuts them back into ink; a shot or an ember
//   glob washes them too, stilling freezes them. Each one cut gives the tank a charge back.
// - **The makers' machines** stand in the temples' rooms: old constructs gone wrong, heavier, slower,
//   planting their feet and raising their arms before a committed slam. The blade breaks them (fluid and ember only stagger
//   them, stilling freezes them); broken, they stay broken (a flag per save).
//
// Nothing here can take a healthy bar to nothing in one blow (strikeDamage, as the guardians). The
// Enemies setting turns them all off; Home, the Lab, the References and the Atelier never have any.
//
//   const foes = new Foes({ scene, level, levelId, content, physics, player, tool, sound, npcs, settings, notice })
//   foes.update(dt, paused)            per frame
//   foes.list                          every foe alive in the world

/** Each kind's tuning. attack: the strike's area (src/temples/boss.js inArea) and what it does. */
export const FOES = {
  blot: {
    name: 'ink blot', hp: 2, radius: 0.6, height: 0.55, speed: 3.4, sight: 17, giveUp: 40, reach: 2.1,
    attack: { shape: 'ring', radius: 1.7, ahead: 1.1, damage: 0.15, wind: 0.65, strike: 0.24, contact: 0.55, lunge: 1.8 },
    recover: 1.0, cool: [1.1, 2.2], hit: 0.35,
  },
  machine: {
    name: 'makers’ machine', hp: 4, radius: 0.8, height: 1.0, speed: 2.1, sight: 13, giveUp: 14, reach: 2.6,
    attack: { shape: 'cone', range: 3.3, angle: 0.8, damage: 0.22, wind: 1.05, strike: 0.32, contact: 0.55, knock: 7 },
    recover: 1.5, cool: [1.4, 2.4], hit: 0.5,
  },
  // keeps its distance (inside `keep` it backs off) and lobs a glob of ink: the ring is drawn where you stand
  spitter: {
    name: 'spitting blot', hp: 2, radius: 0.55, height: 0.6, speed: 2.6, sight: 20, giveUp: 40, reach: 11, keep: 6.5,
    attack: { shape: 'ring', at: 'target', radius: 1.6, damage: 0.14, wind: 1.25 },
    recover: 1.3, cool: [1.6, 2.6], hit: 0.35,
  },
  // tiny and quick, five or six at once: one cut, or a push, and each is gone
  swarm: {
    name: 'blot swarm', hp: 1, radius: 0.28, height: 0.28, speed: 5.2, sight: 16, giveUp: 40, reach: 1.3,
    attack: { shape: 'ring', radius: 1.0, ahead: 0.6, damage: 0.05, wind: 0.5, strike: 0.24, contact: 0.55, lunge: 1.0 },
    recover: 0.7, cool: [0.6, 1.4], hit: 0.2,
  },
  // hovers out of the blade's reach and dives along a lane drawn on the ground; low after its dive, it can be cut
  flyer: {
    name: 'winged blot', hp: 2, radius: 0.6, height: 0.5, hover: 3.6, speed: 3.8, sight: 22, giveUp: 45, reach: 6,
    attack: { shape: 'lane', width: 1.7, range: 9, damage: 0.17, wind: 1.0, strike: 0.4, contact: 0.85, dive: true },
    recover: 1.7, cool: [1.8, 2.8], hit: 0.3,
  },
  // a person made of living shadow (src/shade.js): it walks up and cuts with a sword's swing, dripping as it goes
  shade: {
    name: 'shade', hp: 5, radius: 0.45, height: 1.15, speed: 3.0, sight: 18, giveUp: 40, reach: 2.3,
    attack: { shape: 'cone', range: 2.9, angle: 0.9, damage: 0.2, wind: 0.95, strike: 0.24, contact: 0.55 },
    recover: 1.1, cool: [1.2, 2.2], hit: 0.4,
  },
};
/** Worlds with no foes at all. */
export const PEACEFUL = new Set(['home', 'lab', 'references', 'atelier', 'overnighttrain']);   // (the Arena has its own waves: level.foes; the Overnight Train has no wilds: off it is the running land)
/** Where the wilds start: this far from any person, and from where the ship lands. */
export const WILD = { people: 45, spawn: 55 };
/** The packs of ink blots: how many at once, how far out they come in, how long before the next. */
export const PACK = { size: [2, 3], first: 1, near: 18, far: 26, settle: 3, rest: [35, 55], drop: 85 };
/** Worlds of open sky, where winged blots fly. */
export const SKY_WORLDS = new Set(['arzach', 'arzach2', 'glassdunes', 'fallenring', 'underside', 'antennas']);
/** What a pack is: the first, one blot; then blots, or blots with a spitter, a swarm, or (under open sky) a flyer. */
export function packKinds(n, levelId, rng = Math.random) {
  if (n === 0) return ['blot'];
  const r = rng(), size = PACK.size[0] + Math.floor(rng() * (PACK.size[1] - PACK.size[0] + 1));
  if (n >= 3 && r < 0.1) return ['shade'];
  if (n >= 2 && r < 0.2) return Array(6).fill('swarm');
  if (n >= 1 && r < 0.45) return ['spitter', ...Array(size - 1).fill('blot')];
  if (SKY_WORLDS.has(levelId) && r < 0.7) return ['flyer', ...Array(size - 1).fill('blot')];
  return Array(size).fill('blot');
}
const STILL = 3.5;   // s a stilling glob holds a foe
const PARRY_STUN = 2;   // s a perfect parry leaves it stunned
/** The Arena's waves (level.foes.waves: src/levels/arena.js), round and round; they come in this far out, this long after the last. */
export const WAVES = [['blot'], ['blot', 'blot', 'blot'], ['spitter', 'blot'], Array(6).fill('swarm'), ['machine'], ['shade'], ['flyer', 'flyer'], ['spitter', 'spitter', 'machine'], ['shade', 'shade', 'blot'], ['machine', 'machine', 'blot', 'blot', 'flyer']];
export const WAVE = { near: 10, far: 14, rest: 3 };
/** How many foes may wind up a strike at once (the others circle, waiting a turn); how far apart they keep. */
export const TURNS = { strikers: 2, apart: 0.3 };
/** Relics out in the wilds are guarded (placed, not by chance): a few blots gather round as you come near; cut down, they are gone for good. */
export const GUARDS = { near: 32, size: 2, ring: 3.5 };
/** The lock-on (R3 / Tab): a foe within `reach` (the nearest in front first); lost past `lose` or when it falls. */
export const LOCK = { reach: 18, lose: 26 };
/** Gentle: wind-ups this much slower, harm this much less, packs at most this big and this much rarer. */
export const GENTLE = { wind: 1.35, harm: 0.5, pack: 2, rest: 1.6 };

/**
 * One foe's mind: idle at home (a slow drift round it), chase once you come into sight, wind up its
 * strike in reach (the telegraph), strike, recover, and go home if you lead it too far. Pure logic over
 * plain vectors: env { ground(x, y, z) → y or null (no footing), seen(from, to) → true when clear }.
 * update() returns the events of the frame: 'notice', 'warn', 'strike' { hit }, 'home'.
 */
export class Foe {
  constructor(kind, at, { rng = Math.random, id = null } = {}) {
    this.kind = kind; this.def = FOES[kind]; this.id = id; this.rng = rng;
    this.home = at.clone(); this.pos = at.clone(); this.heading = rng() * Math.PI * 2;
    this.hp = this.def.hp; this.state = 'idle'; this.timer = 0; this.cool = 0.6; this.stunned = 0; this.flash = 0;
    this.attackAt = new THREE.Vector3(); this.attackH = 0; this.wander = rng() * 10; this.vel = new THREE.Vector3();
    this.recoil = 0; this.recoilDir = new THREE.Vector3(); this.heavyRecoil = false;
    this.k = 0;   // the wind-up's progress 0..1 (the telegraph's fill)
    this.alt = this.def.hover ?? 0;   // how high it flies over its footing (a flyer)
  }
  get alive() { return this.state !== 'dead'; }
  get chest() { return (this._chest ??= new THREE.Vector3()).copy(this.pos).setY(this.pos.y + this.def.height + this.alt); }

  update(dt, P, env = {}) {
    const D = this.def, ev = [];
    if (!this.alive) return ev;
    this.flash = Math.max(0, this.flash - dt * 4);
    this.recoil = Math.max(0, this.recoil - dt * (this.heavyRecoil ? 2.5 : 5));
    this.cool = Math.max(0, this.cool - dt);
    // a shove's slide eases out
    if (this.vel.lengthSq() > 1e-4) { this.step(this.vel.x * dt, this.vel.z * dt, env); this.vel.multiplyScalar(Math.exp(-6 * dt)); }
    // a flyer keeps to its height, low only while it recovers from a dive (and falls when stilled)
    if (D.hover) this.alt += ((this.stunned > 0 ? 0.3 : this.state === 'recover' ? 0.35 : D.hover) - this.alt) * (1 - Math.exp(-(this.state === 'recover' ? 1.2 : 3) * dt));
    if (this.stunned > 0) { this.stunned -= dt; return ev; }
    const dx = P.pos.x - this.pos.x, dz = P.pos.z - this.pos.z, d = Math.hypot(dx, dz);
    const away = Math.hypot(this.pos.x - this.home.x, this.pos.z - this.home.z);
    const playerOk = !P.dead && !P.down && !P.ride && Math.abs(P.pos.y - this.pos.y) < 6;
    switch (this.state) {
      case 'idle': {
        this.wander += dt * 0.4;
        const tx = this.home.x + Math.sin(this.wander) * 2.5, tz = this.home.z + Math.cos(this.wander * 0.7) * 2.5;
        this.walkTo(tx, tz, D.speed * 0.3, dt, env);
        if (playerOk && d < D.sight && (env.seen?.(this.chest, P.pos) ?? true)) { this.state = 'chase'; ev.push('notice'); }
        break;
      }
      case 'chase': {
        if (!playerOk || away > D.giveUp || d > D.sight * 2) { this.state = 'home'; ev.push('home'); break; }
        this.face(dx, dz, dt, 8);
        if (D.keep && d < D.keep) { this.step(-dx / d * D.speed * 0.8 * dt, -dz / d * D.speed * 0.8 * dt, env); this.face(dx, dz, dt, 8); }   // (too close: it backs off)
        else if (d > D.reach) this.walkTo(P.pos.x, P.pos.z, D.speed, dt, env, D.reach * 0.8);
        else if (this.cool === 0 && !(env.mayStrike?.(this) ?? true)) {
          // another is striking: circle round at a step's distance, waiting a turn
          const a = Math.atan2(this.pos.x - P.pos.x, this.pos.z - P.pos.z) + dt * 0.6 * (this.side ??= this.rng() < 0.5 ? -1 : 1), r = D.reach + 1.4;
          this.walkTo(P.pos.x + Math.sin(a) * r, P.pos.z + Math.cos(a) * r, D.speed * 0.5, dt, env);
          this.face(dx, dz, dt, 8);
        } else if (this.cool === 0) {
          this.state = 'wind'; this.timer = 0;
          const a = D.attack, f = [Math.sin(this.heading), Math.cos(this.heading)];
          // a ring lands ahead of it (the blot's lunge), a cone fans out from it (the machine's slam)
          if (a.at === 'target') this.attackAt.set(P.pos.x, this.pos.y, P.pos.z);   // (lobbed: it lands where you stood)
          else if (a.shape === 'ring') this.attackAt.set(this.pos.x + f[0] * (a.ahead ?? 0), this.pos.y, this.pos.z + f[1] * (a.ahead ?? 0));
          else this.attackAt.copy(this.pos);
          this.attackH = this.heading;
          ev.push('warn');
        }
        break;
      }
      case 'wind': {
        const a = D.attack;
        const wind = a.wind * (env.slow?.() ?? 1);
        this.timer += dt; this.k = Math.min(1, this.timer / wind);
        if (this.timer >= wind) {
          if (a.at === 'target') {
            const hit = playerOk && Math.abs(P.pos.y - this.pos.y) < 1.6 && inArea(a, this.attackAt, this.attackH, P.pos);
            ev.push({ type: 'strike', hit }); this.state = 'recover'; this.timer = D.recover; this.k = 0;
          } else { this.state = 'strike'; this.timer = 0; this.k = 0; this.contacted = false; }
        }
        break;
      }
      case 'strike': {
        const a = D.attack, before = this.k;
        this.timer += dt; this.k = Math.min(1, this.timer / (a.strike ?? 0.24));
        // Travel through the lunge over time; step() checks footing and walls.
        if (a.lunge || a.dive) {
          const ease = (x) => 1 - (1 - x) ** 2;
          const d = (a.lunge ?? a.range) * (ease(this.k) - ease(before));
          this.step(Math.sin(this.attackH) * d, Math.cos(this.attackH) * d, env);
        }
        if (a.dive) this.alt = THREE.MathUtils.lerp(D.hover, 0.35, this.k);
        if (!this.contacted && this.k >= (a.contact ?? 0.55)) {
          this.contacted = true;
          const origin = a.lunge ? this.pos : this.attackAt;
          const hit = playerOk && Math.abs(P.pos.y - this.pos.y) < 1.6 && inArea(a, origin, this.attackH, P.pos)
            && (env.seen?.(this.chest, P.pos) ?? true);
          ev.push({ type: 'strike', hit });
        }
        if (this.k >= 1) { this.state = 'recover'; this.timer = D.recover; this.k = 0; }
        break;
      }
      case 'recover': {
        this.timer -= dt;
        if (this.timer <= 0) { this.state = 'chase'; this.cool = D.cool[0] + this.rng() * (D.cool[1] - D.cool[0]); }
        break;
      }
      case 'home': {
        this.walkTo(this.home.x, this.home.z, D.speed * 0.8, dt, env, 0.5);
        this.hp = Math.min(D.hp, this.hp + dt * 0.5);
        if (away < 1) this.state = 'idle';
        else if (playerOk && d < D.sight * 0.6 && away < D.giveUp * 0.8) this.state = 'chase';
        break;
      }
    }
    return ev;
  }

  /** Its strike was blocked: it reels back, open a moment longer than after a strike. */
  staggered(perfect = false) {
    if (!this.alive) return;
    this.state = 'recover'; this.timer = this.def.recover * (perfect ? 1.8 : 0.65); this.k = 0; this.flash = 0.8;
    this.recoil = 1; this.heavyRecoil = perfect; this.recoilDir.set(-Math.sin(this.heading), 0, -Math.cos(this.heading));
    this.vel.set(-Math.sin(this.heading), 0, -Math.cos(this.heading)).multiplyScalar(this.kind === 'machine' ? 2 : 5);
  }

  face(dx, dz, dt, rate = 6) {
    const want = Math.atan2(dx, dz), da = Math.atan2(Math.sin(want - this.heading), Math.cos(want - this.heading));
    this.heading += da * (1 - Math.exp(-rate * dt));
  }

  walkTo(x, z, speed, dt, env, stopAt = 0) {
    const dx = x - this.pos.x, dz = z - this.pos.z, d = Math.hypot(dx, dz);
    if (d <= stopAt + 1e-3) return;
    this.face(dx, dz, dt);
    const s = Math.min(speed * dt, d - stopAt);
    this.step(dx / d * s, dz / d * s, env);
  }

  /** Move by (mx, mz) where there is footing no more than a step up (else stay: a wall, a drop). */
  step(mx, mz, env) {
    const nx = this.pos.x + mx, nz = this.pos.z + mz;
    if (env.canStep && !env.canStep(this.pos, nx, nz, this.def.radius)) return false;
    const y = env.ground ? env.ground(nx, this.pos.y + 1.2, nz) : this.pos.y;
    if (y == null || y - this.pos.y > 1.1 || this.pos.y - y > 3) return false;
    this.pos.set(nx, y, nz);
    return true;
  }

  /**
   * What touched it (the fluid tool's modes): the blade cuts (info.damage); a fluid or ember glob
   * washes a blot (1) and only staggers a machine; stilling holds it; the push shoves it. Returns
   * 'burst' when that was the last of it, true when it felt it.
   */
  hit(mode, dir, info = {}) {
    if (!this.alive) return false;
    const D = this.def;
    let dmg = 0;
    if (mode === 'blade') { dmg = (info.damage ?? 1) * (this.stunned > 0 ? 2 : 1); this.stunned = 0; }   // (stilled, it shatters: double)
    else if (mode === 'shoot' || mode === 'fire') dmg = this.kind === 'machine' ? 0 : 1;
    else if (mode === 'push' && this.kind === 'swarm') dmg = 1;   // (the push scatters a swarm)
    else if (mode === 'stun') { this.stunned = STILL; this.state = ['wind', 'strike'].includes(this.state) ? 'chase' : this.state; this.k = 0; this.flash = 0.6; return true; }
    if (mode === 'push' && dir) { this.vel.set(dir.x, 0, dir.z).multiplyScalar((info.shove ?? 2.4) * (this.kind === 'machine' ? 1.2 : 3)); }
    if (dir && mode !== 'push') this.vel.set(dir.x, 0, dir.z).multiplyScalar((this.kind === 'machine' ? 1.5 : 4) * (info.combo === 2 ? 2.2 : 1));   // (the heavy third swing throws them)
    this.flash = 1;
    this.recoil = 1; this.heavyRecoil = (info.damage ?? 1) >= 2;
    if (dir) this.recoilDir.copy(dir).setY(0).normalize();
    // Light cuts interrupt a blot, or the first two thirds of a machine wind-up.
    if ((this.kind === 'blot' && mode === 'blade') || (this.state === 'wind' && this.k < 0.66) || (this.heavyRecoil && this.state !== 'strike')) { this.state = 'recover'; this.timer = this.heavyRecoil ? D.hit * 2 : D.hit; this.k = 0; }
    else if (this.state === 'idle' || this.state === 'home') this.state = 'chase';
    this.hp -= dmg;
    if (this.hp <= 0) { this.state = 'dead'; this.k = 0; return 'burst'; }
    return true;
  }
}

/** A wave said in words: "3 ink blots", "2 machines and 2 ink blots". */
export function waveWords(kinds) {
  const count = (k) => kinds.filter((x) => x === k).length, say = (n, one, many = `${one}s`) => `${n} ${n > 1 ? many : one}`;
  const parts = [['machine', 'machine'], ['shade', 'shade'], ['spitter', 'spitting blot'], ['flyer', 'winged blot'], ['blot', 'ink blot']].map(([k, w]) => count(k) && say(count(k), w));
  if (count('swarm')) parts.push('a swarm');
  const list = parts.filter(Boolean);
  return list.length > 1 ? `${list.slice(0, -1).join(', ')} and ${list.at(-1)}` : list[0] ?? '';
}

/** Far enough from people and the ship for the wilds: p { x, z }; people: [{ x, z }]. */
export function inWilds(p, { people = [], spawn = null } = {}) {
  if (spawn && Math.hypot(p.x - spawn.x, p.z - spawn.z) < WILD.spawn) return false;
  for (const q of people) if (Math.hypot(p.x - q.x, p.z - q.z) < WILD.people) return false;
  return true;
}

// ------------------------------------------------------------------ how they look
const INK = '#1e1a26';
function blotModel(kind = 'blot') {
  const g = new THREE.Group();
  const ink = makeMaterial({ color: INK, flat: true, key: 'foe-ink' });
  const eye = makeMaterial({ color: '#f4efe0', flat: true, glow: 0.6, key: 'foe-eye' });
  const body = new THREE.Mesh(new THREE.IcosahedronGeometry(0.55, 1), ink);
  body.position.y = 0.55; g.add(body);
  // the scribble: drips and spikes of ink off the body, never the same twice
  const parts = [body];
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + Math.random() * 0.5, len = 0.35 + Math.random() * 0.45;
    const c = new THREE.Mesh(new THREE.ConeGeometry(0.09 + Math.random() * 0.06, len, 5), ink);
    c.position.set(Math.sin(a) * 0.45, 0.35 + Math.random() * 0.45, Math.cos(a) * 0.45);
    c.lookAt(c.position.x * 3, c.position.y - 0.6 + Math.random(), c.position.z * 3); c.rotateX(Math.PI / 2);
    g.add(c); parts.push(c);
  }
  const eyes = [-1, 1].map((s) => { const e = new THREE.Mesh(new THREE.SphereGeometry(0.075, 8, 6), eye); e.position.set(s * 0.17, 0.7, 0.46); g.add(e); return e; });
  const M = { group: g, body, parts, eyes, eyeMat: eye, base: '#f4efe0', size: 1 };
  if (kind === 'spitter') {
    // a snout to lob from, and sickly yellow-green eyes
    const snout = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.18, 0.45, 8).rotateX(Math.PI / 2), ink);
    snout.position.set(0, 0.5, 0.55); g.add(snout);
    M.eyeMat = makeMaterial({ color: '#d9f05a', flat: true, glow: 0.6, key: 'foe-eye-spit' }); M.base = '#d9f05a';
    for (const e of eyes) e.material = M.eyeMat;
    M.glob = new THREE.Mesh(new THREE.IcosahedronGeometry(0.22, 1), ink); M.glob.visible = false;
  }
  if (kind === 'flyer') {
    // wings of ink, flapping
    M.wings = [-1, 1].map((s) => { const w = new THREE.Mesh(new THREE.ConeGeometry(0.28, 1.1, 4).rotateZ(s * Math.PI / 2).scale(1, 1, 0.25), ink); w.position.set(s * 0.75, 0.6, -0.05); g.add(w); return w; });
  }
  if (kind === 'swarm') M.size = 0.45;
  g.scale.setScalar(M.size);
  return M;
}

function machineModel() {
  // a makers' construct gone wrong: a round brass shell on three spindly legs, two arms with claws, the
  // makers' glyph (three dots over an arc) glowing on its face, plates riveted round its belly
  const g = new THREE.Group();
  const brass = makeMaterial({ color: '#b08a4a', metal: 'brass', key: 'foe-brass' });
  const dark = makeMaterial({ color: '#3a3330', flat: true, key: 'foe-dark' });
  const plate = makeMaterial({ color: '#8f6f3e', metal: 'copper', key: 'foe-plate' });
  const core = makeMaterial({ color: '#70e7df', flat: true, glow: 0.9, key: 'foe-core' });
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.62, 18, 12).scale(1, 0.85, 0.95), brass); body.position.y = 1.35; g.add(body);
  const belt = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.07, 6, 24).rotateX(Math.PI / 2), plate); belt.position.y = 1.22; g.add(belt);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), dark); cap.position.y = 1.82; g.add(cap);
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.45, 4), dark); mast.position.y = 2.1; g.add(mast);
  // the glyph for an eye: three dots over an upturned arc
  const heart = new THREE.Group(); heart.position.set(0, 1.42, 0.55); g.add(heart);
  heart.add(new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.025, 4, 16, Math.PI).rotateZ(0), core));
  for (const x of [-0.12, 0, 0.12]) { const d = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 4), core); d.position.set(x, 0.22, 0); heart.add(d); }
  const arms = [-1, 1].map((s) => {
    const a = new THREE.Group(); a.position.set(s * 0.66, 1.45, 0); g.add(a);
    const up = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.05, 0.75, 6).translate(0, -0.37, 0), dark); a.add(up);
    const claw = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.26, 0.22).translate(0, -0.85, 0.04), brass); a.add(claw);
    return a;
  });
  const legs = [0, 1, 2].map((k) => {
    const ang = (k / 3) * Math.PI * 2 + Math.PI / 6, l = new THREE.Group();
    l.position.set(Math.sin(ang) * 0.32, 0.95, Math.cos(ang) * 0.32); l.rotation.y = ang; g.add(l);
    l.add(new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.03, 1.0, 5).translate(0, -0.5, 0).rotateX(-0.28), dark));
    return l;
  });
  return { group: g, body, head: cap, arms, legs, heart, eyeMat: core, parts: [body, belt, cap, mast, heart, ...arms, ...legs] };
}

const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0);

/** Every foe in a world: the packs of ink blots in the wilds, the machines in the temple, their looks and their targets. */
export class Foes {
  constructor({ scene, level, levelId, content = null, physics, player, tool = null, sound = null, npcs = [], settings = null, notice = null, camera = null, lib = null, humans = null, game = sharedGame, rng = Math.random }) {
    Object.assign(this, { scene, level, levelId, physics, player, tool, sound, npcs, settings, notice, camera, lib, humans, game, rng });   // (lib, humans: a shade's body, src/shade.js)
    this.list = []; this.group = new THREE.Group(); this.group.name = 'Foes';
    this.group.userData.noCollide = true;
    scene?.add(this.group);
    this.peaceful = PEACEFUL.has(levelId);
    this.packRest = 8; this.wildFor = 0; this.packs = 0; this.wave = 0; this.waveRest = WAVE.rest;
    this.people = (content?.npcs ?? []).filter((n) => n.at).map((n) => ({ x: n.at[0], z: n.at[1] }));
    this.env = {
      ground: (x, y, z) => { const g = physics?.groundAt?.(x, y, z, 6); return g == null || !Number.isFinite(g) ? null : g; },
      slow: () => (this.difficulty === 'gentle' ? GENTLE.wind : 1),
      canStep: (from, x, z, radius) => {
        if (!physics?.rayDistance) return true;
        _w.set(x - from.x, 0, z - from.z);
        const d = _w.length(); if (d < 1e-6) return true;
        _w.divideScalar(d); _v.copy(from).y += 0.5;
        return physics.rayDistance(_v, _w, d + radius) >= d + radius;
      },
      mayStrike: (f) => this.list.filter((x) => x !== f && x.alive && ['wind', 'strike'].includes(x.state)).length < this.strikers,
      seen: (from, to) => !physics?.rayDistance || physics.rayDistance(from, _w.subVectors(_v.copy(to).setY(to.y + 1), from).normalize(), from.distanceTo(_v)) >= from.distanceTo(_v) - 0.5,
    };
    if (!this.peaceful) this.placeMachines();
    // the relics' guards: a relic out in the wilds (src/levels/content.js relics.spots), once per save
    this.guards = this.peaceful || level?.foes?.waves || level?.foes?.own ? [] : (content?.relics?.spots ?? []).map((s, i) => {
      const a = Array.isArray(s) ? s : s.at, x = a[0], z = a.length === 2 ? a[1] : a[2];
      const y = a.length === 2 ? level?.ground?.heightAt?.(x, z) ?? 0 : a[1];
      return { i, pos: new THREE.Vector3(x, y, z), id: `foes.${levelId}.r${i}` };
    });
  }

  /** A foe alive within r metres (the controller: LB blocks rather than zooms). */
  near(r = 20) { const P = this.player; return !!P && this.on && this.list.some((f) => f.alive && f.pos.distanceTo(P.pos) < r); }

  /**
   * R3 / Tab: lock on to the nearest foe in reach (those in front of the camera first), then the next
   * one out from the traveller, then let go. Returns the foe locked (or null).
   */
  cycleLock() {
    const P = this.player, cam = this.camera;
    const fwd = cam ? cam.getWorldDirection(new THREE.Vector3()) : null;
    const cands = this.list.filter((f) => f.alive && f.dead === undefined && f.pos.distanceTo(P.pos) < LOCK.reach)
      .map((f) => ({ f, d: f.pos.distanceTo(P.pos), ahead: fwd ? _v.subVectors(f.pos, P.pos).setY(0).normalize().dot(_w.copy(fwd).setY(0).normalize()) > 0.2 : true }))
      .sort((a, b) => (b.ahead - a.ahead) || a.d - b.d);
    if (!cands.length) { this.lock = null; return null; }
    if (!this.lock) { this.lock = cands[0].f; this.sound?.fluidMode?.('stun'); return this.lock; }
    const i = cands.findIndex((c) => c.f === this.lock);
    this.lock = i >= 0 && i < cands.length - 1 ? cands[i + 1].f : i === -1 ? cands[0].f : null;
    return this.lock;
  }

  /** The locked foe as a target the blade turns to (fluid-blade.js lockTarget), or null. */
  lockTarget() { const f = this.lock; return f ? (this._lockT ??= { position: () => this.lock?.chest ?? f.chest, enabled: () => true, lock: true }) : null; }

  /** The lock holds while the foe stands and stays near; the marker over it (#foe-lock). */
  updateLock() {
    const f = this.lock, P = this.player;
    if (f && (!f.alive || f.dead !== undefined || f.pos.distanceTo(P.pos) > LOCK.lose)) this.lock = null;
    if (typeof document === 'undefined' || !this.camera) return;
    if (!this.lockEl) {
      this.lockEl = Object.assign(document.createElement('div'), { id: 'foe-lock' });
      this.lockEl.style.cssText = 'position:fixed;width:38px;height:38px;margin:-19px 0 0 -19px;border:3px solid #2b211f;border-radius:50%;box-shadow:0 0 0 3px #f2c54b, 3px 3px 0 3px #2b211f;pointer-events:none;z-index:24;display:none';
      document.body.appendChild(this.lockEl);
    }
    if (!this.lock) { this.lockEl.style.display = 'none'; return; }
    const p = this.lock.chest.clone().project(this.camera);
    const on = p.z < 1 && Math.abs(p.x) < 1.1 && Math.abs(p.y) < 1.1;
    this.lockEl.style.display = on ? '' : 'none';
    if (on) { this.lockEl.style.left = `${(p.x * 0.5 + 0.5) * 100}%`; this.lockEl.style.top = `${(0.5 - p.y * 0.5) * 100}%`; }
  }

  /** How many may strike at once. */
  get strikers() { return this.difficulty === 'gentle' ? 1 : TURNS.strikers; }

  /** The Enemies setting: 'normal', 'gentle' (half the harm, slower wind-ups, one striking at a time, smaller and rarer packs) or 'off'. */
  get difficulty() { const e = this.settings?.enemies; return e === false || e === 'off' ? 'off' : e === 'gentle' ? 'gentle' : 'normal'; }
  /** On (the Enemies setting, not a peaceful world; the Arena's waves and a game's own foes always). */
  get on() { return this.waves || (!this.peaceful && this.difficulty !== 'off'); }
  /** The foes come in waves round you: the Arena's (round its list), or a game's own (level.foes.own: it adds them itself, src/minigames/waves.js). */
  get waves() { return !!this.level?.foes?.waves || this.own; }
  get own() { return !!this.level?.foes?.own; }

  /** Where people are now (the spawned ones move about), and where they were placed. */
  peopleNow() {
    const out = this.people.slice();
    for (const n of this.npcs ?? []) { const o = n.object?.position; if (o) out.push({ x: o.x, z: o.z }); }
    return out;
  }

  wild(p) {
    const L = this.level;
    if (L?.foes?.wild === false) return false;   // (a world with no wilds: the Gadget Yard)
    if (L?.temple?.inside?.(p)) return false;
    if (L?.unsafe?.(p)) return false;
    return inWilds(p, { people: this._people ?? this.peopleNow(), spawn: L?.spawn });
  }

  add(kind, at, o = {}) {
    const f = new Foe(kind, at, { rng: this.rng, ...o });
    f.model = kind === 'machine' ? machineModel() : kind === 'shade' && this.lib && this.humans?.[0] ? this.shadeModel() : blotModel(kind);
    f.model.group.position.copy(at);
    if (!f.model.shade) this.group.add(f.model.group);
    if (f.model.glob) this.group.add(f.model.glob);
    f.tele = new Telegraph(this.group, kind === 'machine' ? '#e0703a' : kind === 'spitter' ? '#7f9a2e' : kind === 'shade' ? '#3b2a5c' : '#6d4fa8');
    f.target = registerTarget({ kind: 'foe', foe: f, lock: true, radius: f.def.radius + 0.15, accepts: ['blade', 'stun', 'fire'],
      position: () => f.chest, enabled: () => f.alive && f.model.group.visible,
      onHit: (mode, point, dir, info) => this.hurt(f, mode, dir, info) });
    this.list.push(f);
    return f;
  }

  remove(f) {
    f.target?.(); f.tele?.group.removeFromParent(); f.model.group.removeFromParent(); f.model.glob?.removeFromParent(); f.model.shade?.dispose();
    this.list.splice(this.list.indexOf(f), 1);
  }

  /** The machines: one by each of the temple's checkpoints past the first (the rooms), unless broken already. */
  placeMachines() {
    const rt = this.level?.temple, phys = this.physics;
    if (!rt?.marks?.length || !phys) return;
    const arena = rt.guardian?.arena?.center ?? rt.guardian?.model?.pos ?? null;
    rt.marks.forEach((m, i) => {
      if (i === 0) return;
      const id = `foes.${this.levelId}.m${i}`;
      if (this.game.flag(id)) return;
      if (arena && m.pos.distanceTo(arena) < 14) return;
      for (const a of [0.9, -0.9, 2.2, -2.2, Math.PI]) {
        const h = m.heading + a, x = m.pos.x + Math.sin(h) * 3.6, z = m.pos.z + Math.cos(h) * 3.6;
        const y = phys.groundAt(x, m.pos.y + 2, z, 5);
        if (!Number.isFinite(y) || Math.abs(y - m.pos.y) > 1.2) continue;
        const from = _v.copy(m.pos).setY(m.pos.y + 1), to = _w.set(x, y + 1, z);
        if (phys.rayDistance?.(from, to.clone().sub(from).normalize(), from.distanceTo(to)) < from.distanceTo(to) - 0.3) continue;
        this.add('machine', new THREE.Vector3(x, y, z), { id });
        break;
      }
    });
  }

  /** A pack of ink blots comes in, out of sight round you, where there is footing and nothing between. */
  spawnPack() {
    const P = this.player, phys = this.physics, kinds = packKinds(this.packs, this.levelId, this.rng).slice(0, this.difficulty === 'gentle' ? GENTLE.pack : 99), n = kinds.length;
    const base = this.rng() * Math.PI * 2;
    let made = 0;
    for (let tries = 0; tries < 24 && made < n; tries++) {
      const a = base + (tries % 6) * 0.35 + (tries > 11 ? Math.PI : 0), r = PACK.near + this.rng() * (PACK.far - PACK.near);
      const x = P.pos.x + Math.sin(a) * r, z = P.pos.z + Math.cos(a) * r;
      const y = phys ? phys.groundAt(x, P.pos.y + 25, z, 60) : P.pos.y;
      if (!Number.isFinite(y) || Math.abs(y - P.pos.y) > 5) continue;
      const at = new THREE.Vector3(x, y, z);
      if (!this.wild(at)) continue;
      this.add(kinds[made], at);
      made++;
    }
    if (made) this.packs++;
    return made;
  }

  /** A guarded relic you come near (in the wilds, not yet cleared, its guards not out): they gather round it. */
  updateGuards() {
    const P = this.player;
    for (const g of this.guards) {
      if (this.game.flag(g.id) || P.pos.distanceTo(g.pos) > GUARDS.near) continue;
      if (this.list.some((f) => f.guard === g && f.alive)) continue;
      if (!this.wild(g.pos)) { g.tame = true; continue; }
      for (let k = 0; k < GUARDS.size; k++) {
        const a = (k / GUARDS.size) * Math.PI * 2 + 0.7, x = g.pos.x + Math.sin(a) * GUARDS.ring, z = g.pos.z + Math.cos(a) * GUARDS.ring;
        const y = this.physics ? this.physics.groundAt(x, g.pos.y + 4, z, 12) : g.pos.y;
        const f = this.add('blot', new THREE.Vector3(x, Number.isFinite(y) ? y : g.pos.y, z));
        f.guard = g;
      }
    }
  }

  /** The Arena: once the last wave is down, a short rest, then the next round you (the list, round and round). */
  updateWaves(dt) {
    if (this.list.some((f) => f.alive)) { this.waveRest = WAVE.rest; return; }
    this.waveRest -= dt;
    if (this.waveRest > 0) return;
    const P = this.player, kinds = WAVES[this.wave % WAVES.length], base = this.rng() * Math.PI * 2;
    kinds.forEach((kind, i) => {
      const a = base + (i / kinds.length) * Math.PI * 2, r = WAVE.near + this.rng() * (WAVE.far - WAVE.near);
      const x = P.pos.x + Math.sin(a) * r, z = P.pos.z + Math.cos(a) * r;
      const y = this.physics ? this.physics.groundAt(x, P.pos.y + 20, z, 40) : P.pos.y;
      this.add(kind, new THREE.Vector3(x, Number.isFinite(y) ? y : P.pos.y, z));
    });
    this.wave++;
    this.waveRest = WAVE.rest;
    this.notice?.(`Wave ${this.wave}: ${waveWords(kinds)}.`);
  }

  /** A shade's body (src/shade.js): the game's skinned person in living shadow; the pools and drops shared by all. */
  shadeModel() {
    this.shadePools ??= new ShadePools(this.scene ?? this.group);
    const body = new ShadeBody(this.scene ?? this.group, { lib: this.lib, human: this.humans[0], pools: this.shadePools });
    return { group: body.group, shade: body, parts: [], eyeMat: null, size: 1 };
  }

  /** Where a blot (or a shade) is cut down, its ink stains the ground: a few dark pools that fade (ShadePools). */
  stain(f) {
    this.shadePools ??= new ShadePools(this.scene ?? this.group);
    const n = f.kind === 'swarm' ? 1 : f.kind === 'shade' ? 5 : 3;
    for (let i = 0; i < n; i++) this.shadePools.pools.add(new THREE.Vector3(f.pos.x + (this.rng() - 0.5) * 0.9, f.pos.y + 0.02, f.pos.z + (this.rng() - 0.5) * 0.9), this.rng() * Math.PI * 2, _up);
  }

  /** A shade's cut leaves a dark arc of shadow in the air, right to left in front of it. */
  slashTrail(f) {
    this.shadePools ??= new ShadePools(this.scene ?? this.group);
    for (let i = 0; i < 16; i++) {
      const a = f.heading + 1.1 - (i / 15) * 2.2, r = 1.3;
      const at = new THREE.Vector3(f.pos.x + Math.sin(a) * r, f.pos.y + 1.25 - i * 0.03, f.pos.z + Math.cos(a) * r);
      this.shadePools.drops.add({ pos: at, vel: new THREE.Vector3(Math.sin(a), 0, Math.cos(a)).multiplyScalar(0.6), drag: 4, grav: 2, size: 0.05 + (i % 3) * 0.01, stretch: 2, life: 0.35 + i * 0.01, color: i % 4 ? '#15121c' : '#6c4fa0' });
    }
  }

  /** In a temple, the machines meet its kit: a gust shoves them down its hall, and one standing on a plate presses it. */
  templeKit() {
    const rt = this.level?.temple;
    if (!rt?.pieces) return;
    const machines = this.list.filter((f) => f.kind === 'machine' && f.alive);
    for (const p of rt.pieces) {
      if (p.dirW && p.box && p.state === 1) for (const f of machines) {
        const l = rt.kit.local(f.pos);
        if (p.box.containsPoint(l) && !p.sheltered?.(l)) f.vel.set(p.dirW.x, 0, p.dirW.z).multiplyScalar(p.push * 0.7);
      }
      if (p.weighed && p.solid && p.id && rt.logic) {
        const on = machines.some((f) => Math.hypot(f.pos.x - p.pos.x, f.pos.z - p.pos.z) < p.r + 0.3 && Math.abs(f.pos.y - p.pos.y) < 0.8);
        if (on) rt.logic.press(p.id, 'foe'); else rt.logic.release(p.id, 'foe');
      }
    }
  }

  /** A machine comes apart: its pieces fly off, bounce on the ground, settle and fade. */
  breakApart(f) {
    const floor = f.pos.y;
    for (const part of f.model.parts) {
      this.group.attach(part);
      (this.debris ??= []).push({ o: part, floor, t: 0, vel: new THREE.Vector3((this.rng() - 0.5) * 6, 3 + this.rng() * 4, (this.rng() - 0.5) * 6), spin: new THREE.Vector3(this.rng() * 8 - 4, this.rng() * 8 - 4, this.rng() * 8 - 4) });
    }
  }

  updateDebris(dt) {
    for (const d of this.debris ?? []) {
      d.t += dt;
      d.vel.y -= 9.8 * dt;
      d.o.position.addScaledVector(d.vel, dt);
      d.o.rotation.x += d.spin.x * dt; d.o.rotation.y += d.spin.y * dt; d.o.rotation.z += d.spin.z * dt;
      if (d.o.position.y < d.floor + 0.12) { d.o.position.y = d.floor + 0.12; d.vel.y *= -0.3; d.vel.x *= 0.6; d.vel.z *= 0.6; d.spin.multiplyScalar(0.5); }
      if (d.t > 2.4) d.o.scale.multiplyScalar(Math.max(0, 1 - dt * 3));
      if (d.t > 3.4) d.o.removeFromParent();
    }
    if (this.debris) this.debris = this.debris.filter((d) => d.t <= 3.4);
  }

  /** The fluid tool touched a foe (targets.js): its mind decides; the look, the sound and the reward follow. */
  hurt(f, mode, dir, info) {
    const r = f.hit(mode, dir, info);
    if (!r) return false;
    if (mode === 'blade' || mode === 'shoot' || mode === 'fire') this.sound?.foeHurt?.(f.kind);
    if (r === 'burst') this.burst(f);
    return true;
  }

  /** Done: a blot bursts back into ink, a machine comes apart; the tank gets a charge back. */
  burst(f) {
    this.sound?.foeBurst?.(f.kind);
    const T = this.tool, at = f.chest.clone();
    const tones = f.kind === 'machine' ? ['#a8824a', '#70e7df', '#3a3330'] : [INK, '#3b3350', '#6d4fa8'];
    for (let i = 0; i < 46; i++) T?.drops?.add({ pos: at, vel: _v.randomDirection().multiplyScalar(2 + Math.random() * 6).addScaledVector(_up, 3), drag: 2, grav: 9, size: 0.05 + Math.random() * 0.06, stretch: 2, life: 0.6 + Math.random() * 0.5, color: tones[i % 3] });
    if (T?.reserve) {
      T.reserve.level = Math.min(T.reserve.max, T.reserve.level + 1);
      T.flash = 1; T.wave = Math.max(T.wave ?? 0, 0.6);
      const tank = T.tank?.group ? T.tank.group.localToWorld(_w.set(0, 0.3, 0)) : null;
      if (tank) for (let i = 0; i < 10; i++) T.glow?.add({ pos: at, vel: _v.subVectors(tank, at).multiplyScalar(1.6).add(_w.clone().randomDirection()), drag: 1, size: 0.06, life: 0.6, color: T.modeTones?.[i % 2] ?? '#52c8cf', grow: true });
    }
    if (f.kind === 'machine') this.breakApart(f);
    else this.stain(f);
    if (f.id) this.game.set(f.id, true);
    if (f.guard && !this.list.some((x) => x !== f && x.guard === f.guard && x.alive)) this.game.set(f.guard.id, true);   // (the relic's guards are gone for good)
    if (!this.level?.foes?.noInk) gainInk(INK_OF[f.kind] ?? 1, { game: this.game, notice: this.notice });   // (src/ink.js: the blade grows with it; not from a game's endless waves)
    f.dead = 0.8;   // (the look fades out over this)
    this.game.emit?.('foe:burst', { kind: f.kind });
  }

  update(dt, paused = false) {
    const P = this.player;
    if (!P) return;
    if (!this.on) { for (const f of this.list) f.model.group.visible = false; return; }
    if (paused) return;
    this._people = this.peopleNow();
    // the wilds: after a few seconds out there, a pack comes in (the first time, just one); a pack
    // left far behind dissolves; after one is cut down, a rest before the next
    if (this.waves && !this.own) this.updateWaves(dt);
    this.updateGuards();
    const wild = !this.waves && !P.ride && !P.swim && this.wild(P.pos);
    this.wildFor = wild ? this.wildFor + dt : 0;
    this.packRest = Math.max(0, this.packRest - dt);
    const blots = this.list.filter((f) => f.kind !== 'machine' && !f.guard && f.alive);   // (the wilds' own: not the temple's, not a relic's guards)
    if (wild && this.wildFor > PACK.settle && this.packRest === 0 && blots.length === 0) {
      if (this.spawnPack()) { this.packRest = (PACK.rest[0] + this.rng() * (PACK.rest[1] - PACK.rest[0])) * (this.difficulty === 'gentle' ? GENTLE.rest : 1); this.firstSeen(); }
      else this.packRest = 3;
    }
    for (const f of this.list.slice()) {
      if (f.dead !== undefined) {   // bursting: shrink away, then gone
        f.dead -= dt;
        if (f.model.shade) { f.model.shade.melt = 1 - f.dead / 0.8; f.model.shade.update(dt, f); }   // (a shade runs away into the ground)
        else f.model.group.scale.setScalar(Math.max(0.01, f.dead / 0.8));
        f.tele.hide();
        if (f.dead <= 0) this.remove(f);
        continue;
      }
      if (f.kind !== 'machine' && !this.waves && f.pos.distanceTo(P.pos) > PACK.drop) { this.remove(f); continue; }
      // a machine only stirs while you are in its temple (the Arena's, always)
      const inTemple = f.kind !== 'machine' || this.waves || this.level?.temple?.inside?.(P.pos);
      const ev = inTemple ? f.update(dt, P, this.env) : [];
      for (const e of ev) {
        if (e === 'warn') this.sound?.foeWarn?.(f.kind);
        if (e?.type === 'strike' && f.kind === 'shade') this.slashTrail(f);
        if (e?.type === 'strike' && e.hit) this.strike(f);
      }
      this.look(f, dt);
    }
    this.keepApart();
    this.warnings();
    this.updateLock();
    this.updateDebris(dt);
    this.shadePools?.update(dt);
    if (this.level?.temple?.inside?.(P.pos)) this.templeKit();
    // a fight on: the combat music comes in (src/audio.js), and touch shows its lock-on button
    const fighting = this.list.some((f) => f.alive && (['chase', 'wind', 'strike', 'recover'].includes(f.state)) && f.pos.distanceTo(P.pos) < 28);
    this.sound?.combat?.(fighting);
    if (typeof document !== 'undefined') document.body.classList.toggle('combat', fighting || !!this.lock);
  }

  /** Foes don't stand inside each other: two too close are pushed apart, half each. */
  keepApart() {
    const L = this.list;
    for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) {
      const a = L[i], b = L[j];
      if (!a.alive || !b.alive) continue;
      const dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z, d = Math.hypot(dx, dz), want = a.def.radius + b.def.radius + TURNS.apart;
      if (d >= want || d < 1e-4) continue;
      const push = (want - d) / 2 / d;
      a.step(-dx * push, -dz * push, this.env); b.step(dx * push, dz * push, this.env);
    }
  }

  /**
   * A foe winding up where you can't see it (behind the camera, off the side): a marker at the edge of
   * the screen on its side, filling as its strike comes.
   */
  warnings() {
    if (typeof document === 'undefined' || !this.camera) return;
    if (!this.warnEl) {
      this.warnEl = document.createElement('div');
      this.warnEl.id = 'foe-warn';
      this.warnEl.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:25';
      document.body.appendChild(this.warnEl);
      this.chips = [];
    }
    const cam = this.camera, fwd = cam.getWorldDirection(_w), out = this.list.filter((f) => f.alive && f.state === 'wind');
    let n = 0;
    for (const f of out) {
      const c = f.chest, ahead = _v.subVectors(c, cam.position).dot(fwd) > 0;
      const p = c.clone().project(cam);
      if (ahead && Math.abs(p.x) < 0.9 && Math.abs(p.y) < 0.85) continue;   // on the screen: its ring says it all
      let x = ahead ? p.x : -p.x, y = ahead ? p.y : -p.y;
      if (!ahead && Math.hypot(x, y) < 0.2) y = -1;   // straight behind: at the bottom
      const k = 1 / Math.max(Math.abs(x) / 0.9, Math.abs(y) / 0.82, 1e-3);
      x *= k; y *= k;
      const chip = this.chips[n] ?? (this.chips[n] = this.warnEl.appendChild(Object.assign(document.createElement('div'), { className: 'foe-chip' })));
      chip.style.cssText = `position:absolute;left:${(x * 0.5 + 0.5) * 100}%;top:${(0.5 - y * 0.5) * 100}%;width:34px;height:34px;margin:-17px 0 0 -17px;border-radius:50%;border:3px solid #2b211f;background:radial-gradient(circle, ${f.kind === 'machine' ? '#e0703a' : '#8e64d6'} ${Math.round(f.k * 70)}%, rgba(247,236,210,0.85) ${Math.round(f.k * 70) + 1}%);box-shadow:2px 2px 0 #2b211f`;
      n++;
    }
    for (let i = n; i < (this.chips?.length ?? 0); i++) this.chips[i].style.display = 'none';
  }

  /** A strike that caught the traveller: a bite of the bar (never all of a healthy one), a shove, a machine knocks you down. */
  strike(f) {
    const P = this.player, a = f.def.attack;
    // the guard took it (src/fluid-blade.js block): no harm, and the foe reels back
    const guarded = P.guard?.(f.pos);
    if (guarded) {
      f.staggered(guarded === 'perfect'); this.sound?.foeHurt?.(f.kind);
      if (guarded === 'perfect') { f.stunned = PARRY_STUN; if (!this.game.flag('foes.parried')) { this.game.set('foes.parried', true); this.notice?.('A perfect parry: raised just as the strike came, the guard costs nothing and leaves the foe stunned.'); } }
      return false;
    }
    const dmg = strikeDamage(P.health ?? 1, a.damage * (this.difficulty === 'gentle' ? GENTLE.harm : 1));
    _v.subVectors(P.pos, f.pos).setY(0);
    if (_v.lengthSq() < 1e-4) _v.set(Math.sin(f.heading), 0, Math.cos(f.heading));
    _v.normalize();
    if (a.knock) P.knockDown?.(_v.clone().multiplyScalar(a.knock).addScaledVector(_up, 3.5), { why: 'foe' });
    else { P.vel?.addScaledVector(_v, 5).addScaledVector(_up, 2.5); P.flinch?.(); }   // (a flinch from motion capture: player.js)
    P.hurt?.(dmg, 'foe');
    return true;
  }

  /** The first pack: say what they are and what cuts them, once. */
  firstSeen() {
    if (this.game.flag('foes.seen')) return;
    this.game.set('foes.seen', true);
    this.notice?.('Ink blots: watch their bodies wind up. F / RB / R1 cuts; Ctrl or Z / LB / L1 guards; Alt / X / □ evades. A last-moment guard parries. Each foe cut gives the tank a charge back.');
  }

  /** The look follows the mind: a blot wobbles and squashes into its lunge, a machine walks and raises its arms. */
  look(f, dt) {
    const M = f.model, g = M.group, t = (this._t = (this._t ?? 0) + dt / Math.max(1, this.list.length));
    g.visible = true;
    g.position.copy(f.pos);
    g.rotation.y = f.heading;
    const moving = f.state === 'chase' || f.state === 'home';
    const wind = f.state === 'wind' ? THREE.MathUtils.smoothstep(f.k, 0, 0.72) : 0;
    const strike = f.state === 'strike', recover = f.state === 'recover';
    const recovery = recover ? THREE.MathUtils.clamp(f.timer / f.def.recover, 0, 1) : 0;
    const release = strike ? THREE.MathUtils.smoothstep(f.k, 0, 0.7) : 0;
    if (M.shade) {
      M.shade.melt = Math.max(0, M.shade.melt - dt / 0.8);   // (it pours up out of the ground as it comes)
      M.shade.update(dt, f);
    } else if (f.kind !== 'machine') {
      const w = Math.sin(performance.now() / 160 + f.home.x) * 0.06;
      const stretch = strike ? Math.sin(Math.PI * f.k) : 0;
      const squash = f.state === 'wind' && !f.def.hover ? 1 - 0.35 * f.k : 1;
      g.position.y += 0.15 + f.alt + Math.abs(Math.sin(performance.now() / 260 + f.home.z)) * (moving ? 0.25 : 0.08);
      const s = M.size;
      g.scale.set((1 + w + (1 - squash) * 0.5 - stretch * 0.15) * s, (squash - w - stretch * 0.15) * s, (1 + w + stretch * 0.6) * s);
      g.rotation.x = -wind * 0.25 + stretch * 0.35;
      M.eyeMat.uniforms.uColor.value.set(f.state === 'wind' ? '#f05a3c' : f.stunned > 0 ? '#bfe9ff' : M.base);
      if (M.wings) { const flap = Math.sin(performance.now() / (f.state === 'wind' ? 60 : 110)) * 0.6; M.wings[0].rotation.z = flap; M.wings[1].rotation.z = -flap; }
      // the spitter's glob: in the air over the last half of its wind-up, down onto the drawn ring
      if (M.glob) {
        const u = f.state === 'wind' ? (f.k - 0.45) / 0.55 : -1;
        M.glob.visible = u > 0;
        if (u > 0) { M.glob.position.lerpVectors(f.chest, f.attackAt, u); M.glob.position.y += Math.sin(Math.PI * u) * 3.5 + (1 - u) * 0.2; }
      }
    } else {
      const walk = moving ? Math.sin(t * 9) * 0.45 : 0;
      M.legs.forEach((l, k) => { l.rotation.x = Math.sin(t * 9 + k * Math.PI * 2 / 3) * (moving ? 0.35 : 0) - wind * 0.16; });
      const arm = wind ? -2.6 * wind : strike ? THREE.MathUtils.lerp(-2.6, -0.45, release) : -0.45 * recovery;
      M.arms[0].rotation.x = arm; M.arms[1].rotation.x = arm * 0.85;
      M.body.rotation.y = wind * 0.3 + (strike ? 0.3 * (1 - release) : 0);
      g.rotation.x = -wind * 0.15 + (strike ? release * 0.3 : recovery * 0.3);
      g.position.y -= wind * 0.1;
      M.eyeMat.uniforms.uColor.value.set(f.state === 'wind' ? '#f0a04b' : f.stunned > 0 ? '#bfe9ff' : '#70e7df');
      M.heart.rotation.z = Math.sin(performance.now() / 300) * (f.state === 'chase' ? 0.2 : 0.05);
      g.scale.setScalar(1);
    }
    // Recoil follows the blow, then settles; a heavy impact also buckles the body.
    const r = Math.sin(f.recoil * Math.PI * 0.5), strength = f.heavyRecoil ? 0.28 : 0.12;
    g.position.addScaledVector(f.recoilDir, r * strength);
    g.rotation.x += r * strength * (f.recoilDir.x * Math.sin(f.heading) + f.recoilDir.z * Math.cos(f.heading));
    g.rotation.z = -r * strength * (f.recoilDir.x * Math.cos(f.heading) - f.recoilDir.z * Math.sin(f.heading));
    g.position.y -= f.heavyRecoil ? r * 0.14 : 0;
    if (f.state === 'wind' && f.def.attack.at === 'target') { f.tele.show(f.def.attack, f.attackAt, f.attackH, f.pos.y); f.tele.set(f.k, t); }
    else f.tele.hide(); // Melee reads from the body; ranged impacts retain their landing warning.
  }

  dispose() { for (const f of this.list.slice()) this.remove(f); this.group.removeFromParent(); this.warnEl?.remove(); this.lockEl?.remove(); this.shadePools?.dispose(); }
}
