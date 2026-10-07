import * as THREE from 'three';
import { makeMaterial } from './materials.js';
import { registerTarget } from './targets.js';
import { Telegraph, strikeDamage, inArea } from './temples/boss.js';
import { game as sharedGame } from './game-state.js';

// Foes (docs/systems/foes.md): the first things in the game that fight back.
//
// - **Ink blots** gather in the wilds: loose ink and scribble that drift in from the margins of the
//   drawing, away from people, the ship and the cities. They notice you, wind up a lunge (its ring
//   drawn on the ground first) and hit. The fluid blade cuts them back into ink; a shot or an ember
//   glob washes them too, stilling freezes them. Each one cut gives the tank a charge back.
// - **The makers' machines** stand in the temples' rooms: old constructs gone wrong, heavier, slower,
//   their slam drawn on the floor before it lands. The blade breaks them (fluid and ember only stagger
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
    attack: { shape: 'ring', radius: 1.7, ahead: 1.1, damage: 0.15, wind: 0.85, lunge: 1.6 },
    recover: 1.0, cool: [1.1, 2.2], hit: 0.35,
  },
  machine: {
    name: 'makers’ machine', hp: 4, radius: 0.8, height: 1.0, speed: 2.1, sight: 13, giveUp: 14, reach: 2.6,
    attack: { shape: 'cone', range: 3.3, angle: 0.8, damage: 0.22, wind: 1.15, knock: 7 },
    recover: 1.5, cool: [1.4, 2.4], hit: 0.5,
  },
};
/** Worlds with no foes at all. */
export const PEACEFUL = new Set(['home', 'lab', 'references', 'atelier', 'overnighttrain']);   // (the Arena has its own waves: level.foes; the Overnight Train has no wilds: off it is the running land)
/** Where the wilds start: this far from any person, and from where the ship lands. */
export const WILD = { people: 45, spawn: 55 };
/** The packs of ink blots: how many at once, how far out they come in, how long before the next. */
export const PACK = { size: [2, 3], first: 1, near: 18, far: 26, settle: 3, rest: [35, 55], drop: 85 };
const STILL = 3.5;   // s a stilling glob holds a foe
/** The Arena's waves (level.foes.waves: src/levels/arena.js), round and round; they come in this far out, this long after the last. */
export const WAVES = [['blot'], ['blot', 'blot', 'blot'], ['machine'], ['machine', 'machine', 'blot', 'blot']];
export const WAVE = { near: 10, far: 14, rest: 3 };

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
    this.k = 0;   // the wind-up's progress 0..1 (the telegraph's fill)
  }
  get alive() { return this.state !== 'dead'; }
  get chest() { return (this._chest ??= new THREE.Vector3()).copy(this.pos).setY(this.pos.y + this.def.height); }

  update(dt, P, env = {}) {
    const D = this.def, ev = [];
    if (!this.alive) return ev;
    this.flash = Math.max(0, this.flash - dt * 4);
    this.cool = Math.max(0, this.cool - dt);
    // a shove's slide eases out
    if (this.vel.lengthSq() > 1e-4) { this.step(this.vel.x * dt, this.vel.z * dt, env); this.vel.multiplyScalar(Math.exp(-6 * dt)); }
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
        if (d > D.reach) this.walkTo(P.pos.x, P.pos.z, D.speed, dt, env, D.reach * 0.8);
        else if (this.cool === 0) {
          this.state = 'wind'; this.timer = 0;
          const a = D.attack, f = [Math.sin(this.heading), Math.cos(this.heading)];
          // a ring lands ahead of it (the blot's lunge), a cone fans out from it (the machine's slam)
          if (a.shape === 'ring') this.attackAt.set(this.pos.x + f[0] * (a.ahead ?? 0), this.pos.y, this.pos.z + f[1] * (a.ahead ?? 0));
          else this.attackAt.copy(this.pos);
          this.attackH = this.heading;
          ev.push('warn');
        }
        break;
      }
      case 'wind': {
        const a = D.attack;
        this.timer += dt; this.k = Math.min(1, this.timer / a.wind);
        if (this.timer >= a.wind) {
          if (a.lunge) this.step(Math.sin(this.attackH) * a.lunge, Math.cos(this.attackH) * a.lunge, env);
          const hit = playerOk && P.pos.y - this.pos.y < 1.6 && inArea(a, this.attackAt, this.attackH, P.pos);
          ev.push({ type: 'strike', hit });
          this.state = 'recover'; this.timer = D.recover; this.k = 0;
        }
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
    if (mode === 'blade') dmg = info.damage ?? 1;
    else if (mode === 'shoot' || mode === 'fire') dmg = this.kind === 'blot' ? 1 : 0;
    else if (mode === 'stun') { this.stunned = STILL; this.state = this.state === 'wind' ? 'chase' : this.state; this.k = 0; this.flash = 0.6; return true; }
    if (mode === 'push' && dir) { this.vel.set(dir.x, 0, dir.z).multiplyScalar((info.shove ?? 2.4) * (this.kind === 'machine' ? 1.2 : 3)); }
    if (dir && mode !== 'push') this.vel.set(dir.x, 0, dir.z).multiplyScalar(this.kind === 'machine' ? 1.5 : 4);
    this.flash = 1;
    // a cut interrupts a wind-up (a machine only on its last third)
    if (this.state === 'wind' && (this.kind === 'blot' || this.k < 0.66)) { this.state = 'recover'; this.timer = D.hit; this.k = 0; }
    else if (this.state === 'idle' || this.state === 'home') this.state = 'chase';
    this.hp -= dmg;
    if (this.hp <= 0) { this.state = 'dead'; this.k = 0; return 'burst'; }
    return true;
  }
}

/** A wave said in words: "3 ink blots", "2 machines and 2 ink blots". */
export function waveWords(kinds) {
  const count = (k) => kinds.filter((x) => x === k).length, say = (n, one) => `${n} ${one}${n > 1 ? 's' : ''}`;
  return [count('machine') && say(count('machine'), 'machine'), count('blot') && say(count('blot'), 'ink blot')].filter(Boolean).join(' and ');
}

/** Far enough from people and the ship for the wilds: p { x, z }; people: [{ x, z }]. */
export function inWilds(p, { people = [], spawn = null } = {}) {
  if (spawn && Math.hypot(p.x - spawn.x, p.z - spawn.z) < WILD.spawn) return false;
  for (const q of people) if (Math.hypot(p.x - q.x, p.z - q.z) < WILD.people) return false;
  return true;
}

// ------------------------------------------------------------------ how they look
const INK = '#1e1a26';
function blotModel() {
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
  return { group: g, body, parts, eyes, eyeMat: eye };
}

function machineModel() {
  const g = new THREE.Group();
  const brass = makeMaterial({ color: '#a8824a', metal: 'brass', key: 'foe-brass' });
  const dark = makeMaterial({ color: '#3a3330', flat: true, key: 'foe-dark' });
  const core = makeMaterial({ color: '#70e7df', flat: true, glow: 0.9, key: 'foe-core' });
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.8, 0.8), brass); body.position.y = 1.15; g.add(body);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.32, 0.45), dark); head.position.set(0, 1.72, 0.05); g.add(head);
  const eye = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.06, 0.05), core); eye.position.set(0, 1.74, 0.29); g.add(eye);
  const heart = new THREE.Mesh(new THREE.OctahedronGeometry(0.16), core); heart.position.set(0, 1.15, 0.42); g.add(heart);
  const arms = [-1, 1].map((s) => { const a = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.9, 0.26), brass); a.geometry.translate(0, -0.4, 0); a.position.set(s * 0.68, 1.45, 0); g.add(a); return a; });
  const legs = [-1, 1].map((s) => { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 0.8, 8), dark); l.geometry.translate(0, -0.4, 0); l.position.set(s * 0.3, 0.8, 0); g.add(l); return l; });
  return { group: g, body, head, arms, legs, heart, eyeMat: core, parts: [body, head, eye, heart, ...arms, ...legs] };
}

const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0);

/** Every foe in a world: the packs of ink blots in the wilds, the machines in the temple, their looks and their targets. */
export class Foes {
  constructor({ scene, level, levelId, content = null, physics, player, tool = null, sound = null, npcs = [], settings = null, notice = null, game = sharedGame, rng = Math.random }) {
    Object.assign(this, { scene, level, levelId, physics, player, tool, sound, npcs, settings, notice, game, rng });
    this.list = []; this.group = new THREE.Group(); this.group.name = 'Foes';
    this.group.userData.noCollide = true;
    scene?.add(this.group);
    this.peaceful = PEACEFUL.has(levelId);
    this.packRest = 8; this.wildFor = 0; this.packs = 0; this.wave = 0; this.waveRest = WAVE.rest;
    this.people = (content?.npcs ?? []).filter((n) => n.at).map((n) => ({ x: n.at[0], z: n.at[1] }));
    this.env = {
      ground: (x, y, z) => { const g = physics?.groundAt?.(x, y, z, 6); return g == null || !Number.isFinite(g) ? null : g; },
      seen: (from, to) => !physics?.rayDistance || physics.rayDistance(from, _w.subVectors(_v.copy(to).setY(to.y + 1), from).normalize(), from.distanceTo(_v)) >= from.distanceTo(_v) - 0.5,
    };
    if (!this.peaceful) this.placeMachines();
  }

  /** On (the Enemies setting, not a peaceful world; the Arena's waves always). */
  get on() { return !!this.level?.foes?.waves || (!this.peaceful && this.settings?.enemies !== false); }
  get waves() { return !!this.level?.foes?.waves; }

  /** Where people are now (the spawned ones move about), and where they were placed. */
  peopleNow() {
    const out = this.people.slice();
    for (const n of this.npcs ?? []) { const o = n.object?.position; if (o) out.push({ x: o.x, z: o.z }); }
    return out;
  }

  wild(p) {
    const L = this.level;
    if (L?.temple?.inside?.(p)) return false;
    if (L?.unsafe?.(p)) return false;
    return inWilds(p, { people: this._people ?? this.peopleNow(), spawn: L?.spawn });
  }

  add(kind, at, o = {}) {
    const f = new Foe(kind, at, { rng: this.rng, ...o });
    f.model = kind === 'machine' ? machineModel() : blotModel();
    f.model.group.position.copy(at);
    this.group.add(f.model.group);
    f.tele = new Telegraph(this.group, kind === 'machine' ? '#e0703a' : '#6d4fa8');
    f.target = registerTarget({ kind: 'foe', foe: f, lock: true, radius: f.def.radius + 0.15, accepts: ['blade', 'stun', 'fire'],
      position: () => f.chest, enabled: () => f.alive && f.model.group.visible,
      onHit: (mode, point, dir, info) => this.hurt(f, mode, dir, info) });
    this.list.push(f);
    return f;
  }

  remove(f) {
    f.target?.(); f.tele?.group.removeFromParent(); f.model.group.removeFromParent();
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
    const P = this.player, phys = this.physics, n = this.packs === 0 ? PACK.first : PACK.size[0] + Math.floor(this.rng() * (PACK.size[1] - PACK.size[0] + 1));
    const base = this.rng() * Math.PI * 2;
    let made = 0;
    for (let tries = 0; tries < 24 && made < n; tries++) {
      const a = base + (tries % 6) * 0.35 + (tries > 11 ? Math.PI : 0), r = PACK.near + this.rng() * (PACK.far - PACK.near);
      const x = P.pos.x + Math.sin(a) * r, z = P.pos.z + Math.cos(a) * r;
      const y = phys ? phys.groundAt(x, P.pos.y + 25, z, 60) : P.pos.y;
      if (!Number.isFinite(y) || Math.abs(y - P.pos.y) > 5) continue;
      const at = new THREE.Vector3(x, y, z);
      if (!this.wild(at)) continue;
      this.add('blot', at);
      made++;
    }
    if (made) this.packs++;
    return made;
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
    if (f.id) this.game.set(f.id, true);
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
    if (this.waves) this.updateWaves(dt);
    const wild = !this.waves && !P.ride && !P.swim && this.wild(P.pos);
    this.wildFor = wild ? this.wildFor + dt : 0;
    this.packRest = Math.max(0, this.packRest - dt);
    const blots = this.list.filter((f) => f.kind === 'blot' && f.alive);
    if (wild && this.wildFor > PACK.settle && this.packRest === 0 && blots.length === 0) {
      if (this.spawnPack()) { this.packRest = PACK.rest[0] + this.rng() * (PACK.rest[1] - PACK.rest[0]); this.firstSeen(); }
      else this.packRest = 3;
    }
    for (const f of this.list.slice()) {
      if (f.dead !== undefined) {   // bursting: shrink away, then gone
        f.dead -= dt;
        f.model.group.scale.setScalar(Math.max(0.01, f.dead / 0.8));
        f.tele.hide();
        if (f.dead <= 0) this.remove(f);
        continue;
      }
      if (f.kind === 'blot' && !this.waves && f.pos.distanceTo(P.pos) > PACK.drop) { this.remove(f); continue; }
      // a machine only stirs while you are in its temple (the Arena's, always)
      const inTemple = f.kind !== 'machine' || this.waves || this.level?.temple?.inside?.(P.pos);
      const ev = inTemple ? f.update(dt, P, this.env) : [];
      for (const e of ev) {
        if (e === 'warn') this.sound?.foeWarn?.(f.kind);
        if (e?.type === 'strike' && e.hit) this.strike(f);
      }
      this.look(f, dt);
    }
  }

  /** A strike that caught the traveller: a bite of the bar (never all of a healthy one), a shove, a machine knocks you down. */
  strike(f) {
    const P = this.player, a = f.def.attack;
    const dmg = strikeDamage(P.health ?? 1, a.damage);
    _v.subVectors(P.pos, f.pos).setY(0);
    if (_v.lengthSq() < 1e-4) _v.set(Math.sin(f.heading), 0, Math.cos(f.heading));
    _v.normalize();
    if (a.knock) P.knockDown?.(_v.clone().multiplyScalar(a.knock).addScaledVector(_up, 3.5), { why: 'foe' });
    else P.vel?.addScaledVector(_v, 5).addScaledVector(_up, 2.5);
    P.hurt?.(dmg, 'foe');
  }

  /** The first pack: say what they are and what cuts them, once. */
  firstSeen() {
    if (this.game.flag('foes.seen')) return;
    this.game.set('foes.seen', true);
    this.notice?.('Ink blots, out in the wilds. Cut them with the fluid blade: F, or LB / L1. Each one cut gives the tank a charge back.');
  }

  /** The look follows the mind: a blot wobbles and squashes into its lunge, a machine walks and raises its arms. */
  look(f, dt) {
    const M = f.model, g = M.group, t = (this._t = (this._t ?? 0) + dt / Math.max(1, this.list.length));
    g.visible = true;
    g.position.copy(f.pos);
    g.rotation.y = f.heading;
    const moving = f.state === 'chase' || f.state === 'home';
    if (f.kind === 'blot') {
      const w = Math.sin(performance.now() / 160 + f.home.x) * 0.06;
      const squash = f.state === 'wind' ? 1 - 0.35 * f.k : 1;
      g.position.y += 0.15 + Math.abs(Math.sin(performance.now() / 260 + f.home.z)) * (moving ? 0.25 : 0.08);
      g.scale.set(1 + w + (1 - squash) * 0.5, squash - w, 1 + w + (1 - squash) * 0.5);
      M.eyeMat.uniforms.uColor.value.set(f.state === 'wind' ? '#f05a3c' : f.stunned > 0 ? '#bfe9ff' : '#f4efe0');
    } else {
      const s = performance.now() / 220;
      const walk = moving ? Math.sin(s * 2) * 0.45 : 0;
      M.legs[0].rotation.x = walk; M.legs[1].rotation.x = -walk;
      const raise = f.state === 'wind' ? -2.4 * f.k : f.state === 'recover' ? -0.3 : walk * 0.3;
      M.arms[0].rotation.x = raise; M.arms[1].rotation.x = raise;
      M.eyeMat.uniforms.uColor.value.set(f.state === 'wind' ? '#f0a04b' : f.stunned > 0 ? '#bfe9ff' : '#70e7df');
      M.heart.rotation.y += dt * (f.state === 'chase' ? 4 : 1);
      g.scale.setScalar(1);
    }
    if (f.flash > 0) g.position.x += Math.sin(performance.now() / 18) * 0.04 * f.flash;
    if (f.state === 'wind') { f.tele.show(f.def.attack, f.attackAt, f.attackH, f.pos.y); f.tele.set(f.k, performance.now() / 1000); }
    else f.tele.hide();
  }

  dispose() { for (const f of this.list.slice()) this.remove(f); this.group.removeFromParent(); }
}
