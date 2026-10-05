import * as THREE from 'three';
import { buildBody, kneeOf, STILT } from './bodies.js';
import { SPECIES, TONE_BODY } from './species.js';
import { formatText } from '../story/dialogue.js';
import { speakBalloon } from '../story/voice.js';
import { toneOf } from '../story/tone.js';
import { mouthAt } from '../talk-face.js';
import { mulberry32 } from '../noise.js';

// One of the non-humanoid people (docs/systems/aliens.md). It stands in for an NPC (src/npc.js)
// wherever the game asks one: main.js updates it and places its balloon, the story makes it
// talkable (def.talk), the fluid tool hits it, the conversation frames its face (faceAt), sketches
// its portrait (portraitShot) and tells it the tone of each line it says (express).
//
// The body is its species' (bodies.js), moved by the species' motor below: no skeleton, a few
// rigid parts and the soft ones bent on the CPU near the camera. A tone shows as a glow, a pose
// and a rhythm (species.js TONE_BODY), not a face. Hit by the tool, each has its own reaction
// instead of the human ragdoll: a drifter floats back and bobs home, a stilt-walker wobbles and
// steps to catch itself, a shellback pulls in and rolls, a murmur's five scatter and hop back.

const Y = new THREE.Vector3(0, 1, 0);
const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _d = new THREE.Vector3(), _p = new THREE.Vector3(), _push = new THREE.Vector3();
const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _m = new THREE.Matrix4(), _s = new THREE.Vector3(), _e = new THREE.Euler();
const _c = new THREE.Color(), _c2 = new THREE.Color();
const damp = (a, b, r, dt) => a + (b - a) * (1 - Math.exp(-r * dt));
const wrapA = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const clamp = THREE.MathUtils.clamp;
const STUN_FOR = 3.5;
const WARM = new THREE.Color('#ff8a5c'), COLD = new THREE.Color('#9cc8ff'), FROST = new THREE.Color('#cfe6ff'), WHITE = new THREE.Color(1, 1, 1);
const MOOD_KEYS = ['glow', 'hue', 'lift', 'tempo', 'pose', 'shake', 'lean', 'spin'];

/** World → the body's own frame (origin pos, turned by heading about y). */
function toLocal(out, world, pos, heading) {
  const x = world.x - pos.x, z = world.z - pos.z, c = Math.cos(heading), s = Math.sin(heading);
  return out.set(x * c - z * s, world.y - pos.y, x * s + z * c);
}
/** The body's own frame → world. */
function toWorld(out, local, pos, heading) {
  const c = Math.cos(heading), s = Math.sin(heading);
  return out.set(pos.x + local.x * c + local.z * s, pos.y + local.y, pos.z - local.x * s + local.z * c);
}

export class Alien {
  /**
   * @param def     the person (src/story/aliens-data.js): { id, name, title, species, at, wander, route, heading, lines, talk, tint }
   * @param o.at    where they stand (a Vector3 on the ground)
   */
  constructor(scene, physics, { def, at, route = null }) {
    const S = SPECIES[def.species];
    this.S = S;
    this.alien = true;
    this.species = def.species;
    this.scene = scene;
    this.physics = physics;
    this.def = { lang: S.lang, kind: 'm', range: S.range, ...def };
    this.lines = def.lines ?? ['~neutral~ …'];
    this.pos = at.clone();
    this.home = at.clone();
    this.route = route ?? [at.clone()];
    this.wp = 1 % this.route.length;
    this.heading = def.heading ?? 0;
    this.speed = S.speed * (def.pace ?? 1);
    this.time = 0;
    this.pause = 1 + Math.random() * 3;
    this.talkTo = null;
    this.talking = false;
    this.greeted = 0;
    this.lineIdx = 0;
    this.shout = null;
    this.stunUntil = -1;
    this.startleAt = -1e9;
    this.knock = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.mood = { glow: 1, hue: 0, lift: 0, tempo: 1, pose: 0, shake: 0, lean: 0, spin: 0 };
    this.tone = 'neutral';
    this.voice = 0;          // the syllable being said now (0..1): a pulse of the glow, a bounce
    this.tint = { kind: null, until: 0, colours: null };
    this.rand = mulberry32(Math.floor((def.seed ?? hashOf(def.id)) * 4294967296) >>> 0);
    this.body = buildBody(def.species, { tint: def.tint ?? {}, count: def.members });
    this.object = new THREE.Group();
    this.object.name = `alien ${def.id}`;
    this.object.userData.noCollide = true;
    this.object.add(this.body.root);
    if (this.body.far) this.object.add(this.body.far);
    this.object.userData.alien = this;
    scene?.add(this.object);
    this.motor = new MOTORS[def.species](this);
    this.tier = 'near';
    this.groundNow(true);
    this.object.position.copy(this.pos);
    this.object.rotation.y = this.heading;
    this.motor.reset?.();
    this.balloon = typeof document !== 'undefined' ? document.createElement('div') : null;
    if (this.balloon) { this.balloon.className = 'balloon'; document.body.appendChild(this.balloon); }
  }

  // ------------------------------------------------------------------ what the game asks of a person
  stunned() { return this.time < this.stunUntil; }
  /** Where the tool aims: the middle of the body. */
  chest(out = new THREE.Vector3()) { return this.motor.centre(out); }
  /** Their face (the lantern, the bell's heart, the eyes on their stalks, the five together), in the world. */
  faceAt(out = new THREE.Vector3()) { return this.motor.faceAt ? this.motor.faceAt(out) : out.copy(this.pos).addScaledVector(Y, this.S.face); }
  /** Where the talk prompt hangs. */
  talkAt(out = new THREE.Vector3()) { return out.copy(this.pos).addScaledVector(Y, this.S.talkAt + (this.motor.rise?.() ?? 0)); }
  /** The portrait's camera: their face, seen from the side of `viewer`, a little below (src/story/index.js portrait). */
  portraitShot(viewer) {
    const look = this.faceAt(new THREE.Vector3());
    const d = _d.subVectors(viewer, this.pos).setY(0);
    if (d.lengthSq() < 1e-4) d.set(Math.sin(this.heading), 0, Math.cos(this.heading));
    d.normalize();
    const P = PORTRAIT[this.species];
    const eye = look.clone().addScaledVector(d, P.dist).add(_v.set(-d.z * P.side, P.up, d.x * P.side));
    return { eye, look: look.addScaledVector(Y, P.aim) };
  }
  /** The conversation's face for the line now said ({ speaking, tone, mouth }: src/story/dialogue.js faces()). */
  express(f) {
    if (!f) return;
    this._expressAt = this.time;
    this.tone = f.speaking || this.time - (this._spokeAt ?? -9) < 1.2 ? f.tone ?? 'neutral' : this.tone;
    if (f.speaking) this._spokeAt = this.time;
    this.voice = f.speaking ? (f.mouth ?? Math.max(0, Math.sin(this.time * 13) * 0.7)) : 0;
  }
  voicePerson() { return this.def; }
  show(on) { this.object.visible = on; }
  hide() { this.show(false); this.talking = false; this.balloon?.classList.remove('show'); }

  /**
   * The fluid tool. 'push' and 'shoot' and 'fire' play the species' reaction and a line; 'stun'
   * holds them still a few seconds, frosted.
   */
  hit(mode, dir, info) {
    if (this.time < this.stunUntil && mode !== 'stun') return;
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    const L = this.def.reactions ?? {};
    if (mode === 'stun') {
      this.stunUntil = this.time + STUN_FOR;
      this.knock.set(0, 0, 0); this.shout = null;
      this.tint = { kind: 'stun', until: this.time + STUN_FOR, colours: null };
      return;
    }
    if (dir) this.faceTo = Math.atan2(-dir.x, -dir.z);
    this.startleAt = this.time;
    this.greeted = 0;
    const k = info?.strength ?? 1;
    if (mode === 'push' && dir) {
      _d.set(dir.x, 0, dir.z);
      if (_d.lengthSq() > 1e-6) _d.normalize();
      this.motor.pushed(_d, k, info);
      this.shout = L.pushed ? { text: pick(L.pushed), until: this.time + 3 } : null;
      this.tint = { kind: null, until: 0, colours: null };
      return;
    }
    if (mode === 'fire') {
      this.motor.singed?.(k);
      this.tint = { kind: 'fire', until: this.time + 1.6, colours: null };
      this.shout = L.singed ? { text: pick(L.singed), until: this.time + 2.4 } : null;
      return;
    }
    this.motor.splashed?.(dir, k);
    this.tint = { kind: 'splash', until: this.time + 2.4, colours: info?.colours ?? ['#52c8cf', '#966ede'] };
    this.shout = L.splashed ? { text: pick(L.splashed), until: this.time + 2.2 } : null;
  }

  // ------------------------------------------------------------------ the frame
  groundNow(snap = false, dt = 1) {
    const g = this.physics?.groundAt?.(this.pos.x, this.pos.y + 2, this.pos.z, 8);
    if (Number.isFinite(g)) this.pos.y = snap ? g : damp(this.pos.y, g, 12, dt);
  }

  move(dir, speed, dt) {
    this.pos.addScaledVector(dir, speed * dt);
    this.physics?.pushCapsule?.(this.pos, this.S.radius * 0.6, 0.5, 1.8, _push);
  }

  update(dt, player, camera) {
    const camD = camera ? camera.position.distanceTo(this.pos) : 0, L = this.S.lod;
    // how much detail: full near, the simple body further off, hidden past `hide`
    const tier = camD < L.near ? 'near' : camD < L.mid ? 'mid' : camD < L.far ? 'far' : camD < L.hide ? 'distant' : 'hidden';
    if (tier !== this.tier) this.setTier(tier);
    if (tier === 'hidden') { this.talking = false; return; }
    // (further off, fewer updates: the pose every 2nd frame, then every 4th)
    const every = tier === 'near' || this.talkTo ? 1 : tier === 'mid' || tier === 'far' ? 2 : 4;
    this._acc = (this._acc ?? 0) + dt;
    this._n = ((this._n ?? 0) + 1) % every;
    if (this._n) return;
    dt = Math.min(this._acc, 0.25); this._acc = 0;
    this.time += dt;
    const stunned = this.time < this.stunUntil;
    const toPlayer = _v.subVectors(player.pos, this.pos); toPlayer.y = 0;
    const dist = toPlayer.length();
    const greetR = player.riding ? 16 : 9;
    let speed = 0, face = null;
    const startled = this.time - this.startleAt < 2.4 && this.faceTo !== undefined;
    if (stunned) {
      // held still (the motor's clock stops too: frozen mid-move)
    } else if (this.talkTo) {
      face = Math.atan2(toPlayer.x, toPlayer.z);
      this.greeted = 0;
    } else if (startled) {
      face = this.faceTo;
    } else if (dist < greetR) {
      face = Math.atan2(toPlayer.x, toPlayer.z);
      if (!this.greeted) { this.greeted = this.time; this.lineIdx = (this.lineIdx + 1) % this.lines.length; }
    } else {
      this.greeted = 0;
      if (this.pause > 0) this.pause -= dt;
      else {
        const target = this.route[this.wp];
        _w.subVectors(target, this.pos); _w.y = 0;
        const d = _w.length();
        if (d < 0.7) { this.wp = (this.wp + 1) % this.route.length; this.pause = 3 + this.rand() * 6; }
        else { _w.divideScalar(d); speed = this.speed; this.move(_w, speed, dt); face = Math.atan2(_w.x, _w.z); }
      }
    }
    // a push: carried along, dying away (each motor says how fast: a shell rolls on, a drifter floats)
    const ks = this.knock.length();
    if (ks > 0.05) { this.move(_d.copy(this.knock).divideScalar(ks), ks, dt); this.knock.multiplyScalar(Math.exp(-(this.motor.drag ?? 3) * dt)); }
    else this.knock.set(0, 0, 0);
    if (face !== null && !stunned && !this.motor.busy?.()) {
      const dh = wrapA(face - this.heading), most = (this.motor.turn ?? 1.6) * dt;
      this.heading += clamp(dh * (1 - Math.exp(-4 * dt)), -most, most);
    }
    this.groundNow(false, dt);
    this.vel.set(Math.sin(this.heading) * speed, 0, Math.cos(this.heading) * speed).add(this.knock);
    // the tone they show: the line they are saying (a conversation tells us: express), else at rest
    const live = this.talkTo || this.time - (this._expressAt ?? -9) < 0.3;
    if (!live) {
      const said = this.shout && this.time < this.shout.until ? this.shout.text : this.talking ? this.lines[this.lineIdx] : null;
      this.tone = said ? toneOf(said) : this.def.rest ?? 'neutral';
      this.voice = this._said ? mouthAt(this._said.plan, this.time - this._said.at) : 0;
    }
    const T = TONE_BODY[this.tone] ?? TONE_BODY.neutral, M = this.mood, r = stunned ? 0 : 3;
    for (const k of MOOD_KEYS) M[k] = damp(M[k], T[k] ?? (k === 'glow' || k === 'tempo' ? 1 : 0), r, dt);
    this.object.position.copy(this.pos);
    this.object.rotation.y = this.heading;
    if (!stunned) this.motor.update(dt, { speed, dist, toPlayer, player, near: tier === 'near', far: tier === 'far' || tier === 'distant', looking: this.talkTo || dist < greetR || startled });
    this.colour(dt);
    // the balloon: placed by placeBalloon() after the camera has moved
    this.talking = !this.talkTo && !this.hush && !!this.greeted && this.time - this.greeted > 0.6 && dist < greetR;
    if (this.shout && this.time < this.shout.until) this.talking = true;
  }

  setTier(tier) {
    const near = tier === 'near' || tier === 'mid';
    this.object.visible = tier !== 'hidden';
    if (this.body.far) { this.body.root.visible = near; this.body.far.visible = !near && tier !== 'hidden'; }
    this.motor.setTier?.(tier);
    if (near && this.tier !== 'near' && this.tier !== 'mid') this.motor.reset?.();
    this.tier = tier;
  }

  /** The body's and the glow's colours: their own, frosted while stilled, the fluid's for a splash, warm for an ember. */
  colour() {
    const B = this.body.mats.body.uniforms.uColor.value, G = this.body.mats.glow.uniforms.uColor.value, M = this.mood, t = this.time;
    const T = this.tint, on = T.kind && t < T.until;
    if (on && T.kind === 'stun') B.copy(FROST);
    else if (on && T.kind === 'splash') {
      const n = T.colours.length, x = (t * 1.6) % n, i = Math.floor(x), f = THREE.MathUtils.smoothstep(x - i, 0.3, 0.7), fade = clamp((T.until - t) / 0.8, 0, 1);
      _c.set(T.colours[i % n]).lerp(_c2.set(T.colours[(i + 1) % n]), f);
      B.copy(WHITE).lerp(_c.lerp(WHITE, 0.35), fade);
    } else if (on && T.kind === 'fire') B.copy(WHITE).lerp(WARM, 0.35 * clamp((T.until - t) / 0.6, 0, 1));
    else B.copy(WHITE);
    // the glow: its colour, brighter or dimmer with the tone, warmer or colder, a pulse on each syllable
    G.set(this.def.tint?.glow ?? this.S.glow);
    if (M.hue > 0) G.lerp(WARM, Math.min(0.6, M.hue)); else G.lerp(COLD, Math.min(0.6, -M.hue));
    const k = M.glow * (0.86 + 0.14 * Math.sin(t * 1.7 * M.tempo)) + this.voice * 0.45 + (on && T.kind === 'fire' ? 0.6 : 0);
    if (k > 1) G.lerp(WHITE, Math.min(0.7, (k - 1) * 0.6)); else G.multiplyScalar(Math.max(0.25, k));
    if (on && T.kind === 'stun') G.lerp(FROST, 0.6);
  }

  /** Put the balloon over the head (after the camera update; only for the one that talks). */
  placeBalloon(camera, show, lift = 0) {
    if (!this.balloon) return;
    if (!show || !this.talking) { this.balloon.classList.remove('show'); this._voiced = null; return; }
    this.faceAt(_w).addScaledVector(Y, 0.9);
    _w.project(camera);
    const on = _w.z < 1 && Math.abs(_w.x) < 1.1 && Math.abs(_w.y) < 1.1;
    if (on) {
      const line = this.shout && this.time < this.shout.until ? this.shout.text : this.lines[this.lineIdx];
      if (this._balloonLine !== line) { this._balloonLine = line; this.balloon.innerHTML = formatText(line); this._said = null; }
      if (line !== this._voiced) {
        const plan = speakBalloon(line, { person: this.voicePerson(), dist: camera.position.distanceTo(this.pos), pan: clamp(_w.x * 0.8, -0.9, 0.9) });
        if (plan) { this._voiced = line; this._said = { plan, at: this.time }; }
      }
      const w = this.balloon.offsetWidth || 200;
      const x = clamp((_w.x * 0.5 + 0.5) * window.innerWidth - 22, 6, Math.max(6, window.innerWidth - w - 6));
      this.balloon.style.transform = `translate(${x.toFixed(1)}px, ${((-_w.y * 0.5 + 0.5) * window.innerHeight - lift).toFixed(1)}px) translate(0, calc(-100% - 12px))`;
    }
    this.balloon.classList.toggle('show', on);
  }
  balloonFace() { return { speaking: false }; }

  dispose(scene = this.scene) {
    scene?.remove(this.object);
    this.balloon?.remove();
    this.object.traverse((o) => { if (o.isMesh) o.geometry.dispose(); });
    this.body.mats.body.dispose(); this.body.mats.glow.dispose();
  }
}

const hashOf = (s) => { let h = 2166136261; for (const c of String(s)) h = Math.imul(h ^ c.codePointAt(0), 16777619); return (h >>> 0) / 4294967296; };

/** The portrait camera per species: how far from the face, how far to the side, how high, where it aims (m). */
const PORTRAIT = {
  drifter: { dist: 3.1, side: 0.5, up: -0.75, aim: -0.3 },
  stilt: { dist: 1.25, side: 0.3, up: -0.25, aim: -0.05 },
  shell: { dist: 1.7, side: 0.45, up: -0.15, aim: -0.25 },
  murmur: { dist: 2.0, side: 0.4, up: 0.45, aim: -0.25 },
};

// ------------------------------------------------------------------ the motors
/** Bend a soft part's vertices from their rest places: fn(rest x, y, z, weight, out) writes the new place. */
function bend(mesh, fn) {
  const g = mesh.geometry, R = g.userData.rest, W = g.userData.w, P = g.attributes.position.array;
  for (let i = 0, n = W.length; i < n; i++) {
    fn(R[i * 3], R[i * 3 + 1], R[i * 3 + 2], W[i], _p);
    P[i * 3] = _p.x; P[i * 3 + 1] = _p.y; P[i * 3 + 2] = _p.z;
  }
  g.attributes.position.needsUpdate = true;
}

/**
 * The drifter floats: its bell pulses (a slow breath that lifts it), it bobs and slowly turns, its
 * threads trail behind as it moves and wave when it is still. Pushed, it floats back and up,
 * tumbling a little, and drifts home; a splash curls its threads up; an ember lifts it high.
 */
class DrifterMotor {
  constructor(a) {
    this.a = a; this.P = a.body.parts;
    this.phase = a.rand() * 6; this.spin = 0; this.drag = 1.1; this.turn = 0.8;
    this.rise_ = 0; this.riseV = 0;            // lifted by a push or an ember (m), springing back
    this.tilt = new THREE.Vector2(); this.tiltV = new THREE.Vector2();
    this.curl = 0; this.lag = new THREE.Vector3();
  }
  rise() { return this.rise_ + this.a.mood.lift; }
  centre(out) { return out.copy(this.a.pos).addScaledVector(Y, this.a.S.hover - 0.2 + this.rise_); }
  faceAt(out) { return this.P.body.localToWorld(out.set(0, -0.05, 0)); }   // (the bell's middle, over its heart)
  pushed(d, k) {
    this.a.knock.addScaledVector(d, 4.5 + 3 * k);
    this.riseV += 2.4 + 1.6 * k;
    // tipped away from the push, in its own frame
    toLocal(_w, _p.copy(this.a.pos).add(d), this.a.pos, this.a.heading);
    this.tiltV.x += _w.z * (1.6 + 1.0 * k); this.tiltV.y -= _w.x * (1.6 + 1.0 * k);
    this.spinV = (this.spinV ?? 0) + (Math.random() < 0.5 ? -1 : 1) * 2.5;
  }
  splashed() { this.curl = 1; this.riseV += 0.8; }
  singed() { this.riseV += 3.6; this.curl = 0.6; }
  update(dt, c) {
    const a = this.a, M = a.mood, P = this.P;
    this.phase += dt * (Math.PI * 2 / 3.4) * M.tempo * (1 + a.voice * 0.4);
    const pulse = Math.pow(Math.max(0, Math.sin(this.phase)), 2);
    // lifted, springing back down
    this.riseV += (-this.rise_ * 5 - this.riseV * 2.2) * dt; this.rise_ += this.riseV * dt;
    // tilt: a spring, leaning into its motion and toward you when curious
    const lead = Math.min(1, c.speed / 0.6) * 0.12;
    toLocal(_w, _p.copy(a.pos).add(c.toPlayer), a.pos, a.heading);
    const lean = M.lean * (c.looking ? 0.16 : 0) * (c.dist > 0.1 ? 1 : 0);
    const tx = lead + lean * clamp(_w.z / Math.max(c.dist, 0.1), -1, 1), ty = -lean * clamp(_w.x / Math.max(c.dist, 0.1), -1, 1);
    this.tiltV.x += ((tx - this.tilt.x) * 9 - this.tiltV.x * 2.4) * dt; this.tiltV.y += ((ty - this.tilt.y) * 9 - this.tiltV.y * 2.4) * dt;
    this.tilt.addScaledVector(this.tiltV, dt);
    this.spinV = damp(this.spinV ?? 0, 0, 1.2, dt);
    this.spin += dt * (0.12 * M.tempo + (M.spin ?? 0) * 0.9 + this.spinV);
    const body = P.body, shake = M.shake * 0.04 * Math.sin(a.time * 31);
    body.position.set(shake, a.S.hover + this.rise_ + M.lift + 0.1 * Math.sin(this.phase * 0.5) + pulse * 0.05, 0);
    body.rotation.set(this.tilt.x, this.spin, this.tilt.y, 'XYZ');
    // the bell breathes: it narrows and lengthens on each pulse; a happy or loud one breathes wider
    const open = 1 + 0.06 * M.pose;
    P.shell.scale.set((1 + 0.07 * pulse) * open, 1 - 0.1 * pulse, (1 + 0.07 * pulse) * open);
    P.heart.scale.setScalar(1 + 0.15 * a.voice + 0.08 * pulse);
    this.curl = damp(this.curl, 0, 0.9, dt);
    // the threads: trailing behind the motion (in the bell's own turning frame), waving, curled by a splash
    if (c.near) {
      toLocal(_w, _p.copy(a.pos).addScaledVector(a.vel, -1), a.pos, a.heading);
      const cs = Math.cos(-this.spin), sn = Math.sin(-this.spin);
      this.lag.set(_w.x * cs + _w.z * sn, 0, -_w.x * sn + _w.z * cs).multiplyScalar(0.55);
      this.lag.x -= this.tilt.y * 1.2; this.lag.z += this.tilt.x * 1.2;
      const t = a.time, curl = this.curl, droop = 1 - 0.15 * M.pose;
      bend(P.threads, (x, y, z, w, out) => {
        const w2 = w * w, wave = Math.sin(t * 1.3 * M.tempo + y * 2.2 + x * 3.1 + z * 1.7) * 0.11 * w;
        out.set(x * (1 - 0.55 * curl * w) + this.lag.x * w2 + wave, y * droop + curl * w * 1.1 + pulse * 0.12 * w, z * (1 - 0.55 * curl * w) + this.lag.z * w2 + Math.cos(t * 1.1 + y * 2 + z * 2.7) * 0.1 * w);
      });
    }
  }
}

/**
 * The stilt-walker steps one leg at a time (a wave gait): a foot swings to its place under the body
 * when it falls too far behind, lifted in an arc; the knees bend out and up between the hub and the
 * planted feet. The lantern swings on its neck and turns to look. Pushed, the body sways on its legs
 * and steps back to catch itself, the lantern swinging wide.
 */
class StiltMotor {
  constructor(a) {
    this.a = a; this.P = a.body.parts; this.drag = 3.2; this.turn = 0.9;
    this.feet = this.P.legs.map(() => ({ at: new THREE.Vector3(), from: new THREE.Vector3(), to: new THREE.Vector3(), t: 1, dur: 0.5 }));
    this.sway = new THREE.Vector3(); this.swayV = new THREE.Vector3();
    this.swing = new THREE.Vector2(); this.swingV = new THREE.Vector2();
    this.look = 0; this.nod = 0; this.next = 0; this.bob = 0; this.flinch = 0;
    this._hip = new THREE.Vector3(); this._knee = new THREE.Vector3(); this._out = new THREE.Vector3(); this._lf = new THREE.Vector3();
  }
  rise() { return this.bob; }
  centre(out) { return out.copy(this.a.pos).addScaledVector(Y, STILT.hub + 0.6); }
  faceAt(out) { return this.P.flame.getWorldPosition(out); }
  /** A foot's place under the body (world), a little ahead when walking. */
  restFoot(k, out, lead = 0) {
    const a = this.a, A = this.P.legs[k].a;
    _w.set(Math.sin(A) * STILT.spread, 0, Math.cos(A) * STILT.spread + lead);
    toWorld(out, _w, a.pos, a.heading);
    const g = a.physics?.groundAt?.(out.x, a.pos.y + 3, out.z, 8);
    out.y = Number.isFinite(g) ? g : a.pos.y;
    return out;
  }
  reset() { this.feet.forEach((f, k) => { this.restFoot(k, f.at); f.to.copy(f.at); f.t = 1; }); }
  busy() { return this.swayV.length() > 1.2; }
  pushed(d, k) {
    this.a.knock.addScaledVector(d, 2.2 + 2.2 * k);
    this.swayV.addScaledVector(d, 2.4 + 2 * k);
    toLocal(_w, _p.copy(this.a.pos).add(d), this.a.pos, this.a.heading);
    this.swingV.x += _w.z * 7; this.swingV.y -= _w.x * 7;
  }
  splashed() { this.flinch = 1; this.swingV.x += 3; }
  singed() { this.flinch = 0.6; this.bob += 0.3; this.swingV.y += 4; }
  update(dt, c) {
    const a = this.a, M = a.mood, P = this.P, tempo = M.tempo;
    // the hub: a spring of its own over the feet (a push sways it), bobbing as feet lift
    this.swayV.addScaledVector(this.sway, -10 * dt).multiplyScalar(Math.exp(-2.2 * dt));
    this.sway.addScaledVector(this.swayV, dt);
    if (this.sway.length() > 1.2) this.sway.setLength(1.2);
    this.flinch = damp(this.flinch, 0, 2, dt);
    let swinging = 0;
    for (const f of this.feet) if (f.t < 1) swinging++;
    const breathe = 0.05 * Math.sin(a.time * 1.1 * tempo);
    this.bob = damp(this.bob, M.lift * 1.4 + M.pose * 0.18 - this.flinch * 0.35 - swinging * 0.06 + breathe, 5, dt);
    toLocal(_lfHub, _p.copy(a.pos).add(this.sway), a.pos, a.heading);
    P.hub.position.set(_lfHub.x, STILT.hub + this.bob, _lfHub.z);
    P.hub.rotation.set(-this.sway.length() * 0.0 + _lfHub.z * 0.25, 0, -_lfHub.x * 0.25);
    // the lantern: a pendulum on its neck, turned to look at you, bowed when sad, lowered when curious
    this.swingV.x += (-this.swing.x * 14 - this.swingV.x * 1.6) * dt; this.swingV.y += (-this.swing.y * 14 - this.swingV.y * 1.6) * dt;
    this.swing.addScaledVector(this.swingV, dt);
    toLocal(_w, _p.copy(a.pos).add(c.toPlayer), a.pos, a.heading);
    const lookTo = c.looking ? clamp(Math.atan2(_w.x, _w.z), -1.1, 1.1) : Math.sin(a.time * 0.23) * 0.5;
    this.look = damp(this.look, lookTo, 2.5, dt);
    const nodTo = -M.pose * 0.35 + (M.lean ?? 0) * 0.35 + (c.looking ? 0.12 : 0) + a.voice * 0.12;
    this.nod = damp(this.nod, nodTo, 4, dt);
    P.neck.rotation.set(this.nod + this.swing.x * 0.6, this.look, this.swing.y * 0.6 + M.shake * 0.08 * Math.sin(a.time * 27), 'YXZ');
    P.head.rotation.set(this.swing.x * 0.5, 0, this.swing.y * 0.5);
    P.flame.scale.setScalar(0.92 + 0.12 * a.voice + 0.06 * Math.sin(a.time * 9));
    if (!c.near && c.far) return;
    // the feet: one swings at a time (two while catching itself), each to its place, a little ahead
    const lead = Math.min(c.speed, 1) * 0.55 + a.knock.length() * 0.25;
    for (let k = 0; k < this.feet.length; k++) {
      const f = this.feet[k];
      if (f.t < 1) {
        f.t = Math.min(1, f.t + dt / f.dur);
        const s = THREE.MathUtils.smootherstep(f.t, 0, 1);
        f.at.lerpVectors(f.from, f.to, s).addScaledVector(Y, Math.sin(Math.PI * f.t) * 0.5);
        if (f.t >= 1) f.at.copy(f.to);
      }
    }
    const most = this.sway.length() > 0.3 || a.knock.length() > 0.5 ? 2 : 1;
    for (let j = 0; j < this.feet.length && swinging < most; j++) {
      const k = (this.next + j) % this.feet.length, f = this.feet[k];
      if (f.t < 1) continue;
      this.restFoot(k, _p, lead);
      const off = Math.hypot(_p.x - f.at.x, _p.z - f.at.z), trigger = c.speed > 0.05 || a.knock.length() > 0.2 ? 0.45 : 0.7;
      if (off > trigger || Math.abs(this.sway.x) + Math.abs(this.sway.z) > 0.5 && off > 0.25) {
        f.from.copy(f.at); f.to.copy(_p); f.t = 0; f.dur = clamp(0.62 / tempo, 0.3, 0.9) * (a.knock.length() > 0.5 ? 0.6 : 1);
        swinging++; this.next = (k + 1) % this.feet.length;
      }
    }
    // the bones: hip on the hub, knee out and up, foot on the ground (all in the body's own frame)
    const hub = P.hub.position;
    for (let k = 0; k < this.feet.length; k++) {
      const L = P.legs[k], hip = this._hip, foot = toLocal(this._lf, this.feet[k].at, a.pos, a.heading);
      hip.set(hub.x + Math.sin(L.a) * 0.15, hub.y - 0.04, hub.z + Math.cos(L.a) * 0.15);
      _d.set(foot.x - hip.x, 0, foot.z - hip.z);
      if (_d.lengthSq() < 1e-4) _d.set(Math.sin(L.a), 0, Math.cos(L.a));
      _d.normalize(); this._out.set(_d.x, 0.75, _d.z);
      const knee = kneeOf(hip, foot, STILT.thigh, STILT.shin, this._knee, this._out);
      const B = P.limbs;
      B.thighs.setMatrixAt(k, bone(hip, knee)); B.shins.setMatrixAt(k, bone(knee, foot));
      B.knees.setMatrixAt(k, _m.makeTranslation(knee.x, knee.y, knee.z)); B.feet.setMatrixAt(k, _m.makeTranslation(foot.x, foot.y, foot.z));
    }
    for (const m of Object.values(P.limbs)) m.instanceMatrix.needsUpdate = true;
  }
}
const _lfHub = new THREE.Vector3();
/** A limb's matrix (the unit-long limb along +y) from a to b. */
function bone(a, b) {
  _d.subVectors(b, a);
  const len = _d.length();
  _q.setFromUnitVectors(Y, _d.divideScalar(Math.max(len, 1e-5)));
  return _m.compose(a, _q, _s.set(1, len, 1));
}

/**
 * The shellback glides on its foot (ripples run along it as it goes), its shell rocking a little,
 * its eyes on their stalks turned to whatever interests it. Frightened or pushed it pulls in; a
 * push rolls the shell over and over across the ground until it rocks upright and slowly comes out.
 */
class ShellMotor {
  constructor(a) {
    this.a = a; this.P = a.body.parts; this.drag = 1.6; this.turn = 0.6;
    this.inK = 0;          // pulled into the shell (0 out .. 1 in)
    this.hideFor = 0;      // s to stay in
    this.roll = 0; this.rollAxis = new THREE.Vector3(1, 0, 0); this.rolling = false;
    this.ripple = 0; this.wiggle = 0;
    // a pivot for rolling: the shell's middle
    const lean = this.P.lean, root = a.body.root;
    this.pivot = new THREE.Group(); this.pivot.position.set(0, 0.62, -0.1);
    root.remove(lean); root.add(this.pivot); this.pivot.add(lean); lean.position.set(0, -0.62, 0.1);
  }
  rise() { return 0; }
  centre(out) { return out.copy(this.a.pos).addScaledVector(Y, 0.7 * (this.a.S.scale ?? 1)); }
  faceAt(out) {
    if (this.inK > 0.7) return out.copy(this.a.pos).addScaledVector(Y, 0.9 * (this.a.S.scale ?? 1));
    return this.P.head.localToWorld(out.set(0, 0.85, 0.15));
  }
  busy() { return this.inK > 0.5; }
  pushed(d, k) {
    this.a.knock.addScaledVector(d, 3.2 + 2.6 * k);
    this.inK = Math.max(this.inK, 0.85); this.hideFor = 3.2;
    toLocal(_w, _p.copy(this.a.pos).add(d), this.a.pos, this.a.heading);
    this.rollAxis.set(_w.z, 0, -_w.x).normalize();
    this.rolling = true;
  }
  splashed() { this.hideFor = Math.max(this.hideFor, 1.2); this.wiggle = 1; }
  singed() { this.hideFor = Math.max(this.hideFor, 2); }
  update(dt, c) {
    const a = this.a, M = a.mood, P = this.P;
    // in and out: hiding while frightened, after a push; scared lines pull it half in
    this.hideFor -= dt;
    const want = this.hideFor > 0 ? 1 : M.pose < -0.7 ? 0.5 : 0;
    this.inK = damp(this.inK, want, want > this.inK ? 9 : 1.4, dt);
    // rolling: as far as it has gone (the shell's radius ~0.65 m), then righting itself
    const ks = a.knock.length();
    if (this.rolling && ks > 0.25) this.roll += (ks * dt) / (0.65 * (a.S.scale ?? 1));
    else if (this.rolling) {
      const up = Math.round(this.roll / (Math.PI * 2)) * Math.PI * 2;
      this.roll = damp(this.roll, up + Math.sin(a.time * 9) * 0.05 * Math.abs(up - this.roll), 3.5, dt);
      if (Math.abs(this.roll - up) < 0.01) { this.roll = 0; this.rolling = false; }
    }
    this.pivot.quaternion.setFromAxisAngle(this.rollAxis, this.roll);
    // gliding: ripples along the foot, a rock of the shell
    this.ripple += dt * (c.speed > 0.05 ? 7 : 1.2) * M.tempo;
    const moving = Math.min(1, c.speed / 0.3), out = 1 - this.inK;
    P.lean.rotation.z = Math.sin(this.ripple * 0.5) * 0.035 * moving + M.shake * 0.05 * Math.sin(a.time * 29);
    P.shell.position.y = 0.05 + Math.sin(this.ripple) * 0.015 * moving + (M.lift * 0.3) * out;
    P.foot.scale.set(1, 1 - 0.3 * this.inK, 1 - 0.45 * this.inK);
    if (c.near && P.foot.geometry.userData.rest) {
      const rp = this.ripple, mv = 0.5 + moving;
      bend(P.foot, (x, y, z, w, o) => { const wave = Math.sin(w * 14 - rp * 2); o.set(x * (1 + 0.04 * wave * mv), y + (y > 0.2 ? 0.02 * wave * mv : 0), z + 0.03 * wave * mv); });
    }
    // the head: stretched out walking or curious, tucked in when hiding
    const stretch = out * (1 + 0.12 * moving + 0.15 * (M.lean ?? 0) + 0.08 * M.pose);
    P.head.position.set(0, 0.3 - 0.25 * this.inK, 0.88 * (0.45 + 0.55 * stretch));
    P.head.scale.setScalar(Math.max(0.05, 0.35 + 0.65 * out));
    P.head.rotation.x = -0.15 * M.pose + 0.2 * (M.pose < 0 ? -M.pose : 0) + a.voice * 0.08;
    // the eyes: on stalks as long as its mood, turned to you when it looks, wiggling when happy or splashed
    this.wiggle = damp(this.wiggle, 0, 1.5, dt);
    toLocal(_w, _p.copy(a.pos).add(c.toPlayer).addScaledVector(Y, 1.5), a.pos, a.heading);
    const look = c.looking ? clamp(Math.atan2(_w.x, _w.z - 0.9), -1.2, 1.2) : Math.sin(a.time * 0.4) * 0.4;
    const len = Math.max(0.02, (0.62 + 0.16 * M.pose + 0.06 * a.voice) * out);
    for (const E of P.eyes) {
      const sway = Math.sin(a.time * 1.3 * M.tempo + E.s) * 0.12 + this.wiggle * 0.4 * Math.sin(a.time * 17 + E.s * 2) + (M.spin ?? 0) * 0.2 * Math.sin(a.time * 6 + E.s);
      const droop = M.pose < 0 ? -M.pose * 0.9 : 0;
      E.stalk.scale.set(1, len, 1);
      E.eye.scale.set(1, 1 / Math.max(len, 0.02), 1).multiplyScalar(0.6 + 0.4 * out);
      E.stalk.rotation.set(0.25 + droop - (c.looking ? 0.2 : 0) + (M.lean ?? 0) * 0.35, look * 0.6, -E.s * (0.26 + 0.1 * M.pose) + sway, 'YXZ');
      E.eye.rotation.set(-0.25 - droop, look * 0.4, 0);
    }
  }
}

/**
 * Murmurs: five small bulbs in a cluster, hopping together (squashing as they land), each turned
 * to what it looks at, bouncing in turn with the syllables when they speak (as one). Huddled when
 * sad or scared, all in the air when surprised, circling when playful. Pushed, the five scatter,
 * tumbling, and hop back to their places.
 */
class MurmurMotor {
  constructor(a) {
    this.a = a; this.P = a.body.parts; this.drag = 4; this.turn = 2.2;
    const n = this.P.near.count, rand = a.rand;
    this.members = Array.from({ length: n }, (_, k) => ({
      size: k === 0 ? 0.98 : 0.6 + rand() * 0.26, slot: k === 0 ? 0 : (k - 1) / (n - 1) * Math.PI * 2 + rand() * 0.4,
      ring: k === 0 ? 0.05 : 0.62 + rand() * 0.28, hop: rand(), y: 0, vy: 0, off: new THREE.Vector3(), vel: new THREE.Vector3(),
      tumble: new THREE.Vector3(), spin: new THREE.Vector3(), yaw: 0, squash: 1, flung: false,
    }));
    this.turnSlots = 0; this.beat = 0;
    const tones = a.def.tint?.members ?? ['#ffffff', '#f2e6f0', '#e8f0ec', '#f6efe0', '#ece8f8'];
    for (const m of [this.P.near, this.P.far]) this.members.forEach((M, k) => m.setColorAt(k, _c.set(tones[k % tones.length])));
    this.mesh = this.P.near;
    this.reset();
  }
  rise() { return 0; }
  centre(out) { return out.copy(this.a.pos).addScaledVector(Y, 0.4); }
  faceAt(out) { return out.copy(this.a.pos).addScaledVector(Y, 0.72); }
  setTier(t) { const far = t === 'far' || t === 'distant'; this.P.near.visible = !far; this.P.far.visible = far; this.mesh = far ? this.P.far : this.P.near; }
  reset() { for (const m of this.members) { this.slotOf(m, m.off); m.y = 0; m.vy = 0; m.flung = false; m.tumble.set(0, 0, 0); } }
  slotOf(m, out) {
    const huddle = 1 + 0.45 * Math.min(0, this.a.mood.pose);
    const ang = m.slot + this.turnSlots;
    return out.set(Math.sin(ang) * m.ring * huddle, 0, Math.cos(ang) * m.ring * huddle);
  }
  pushed(d, k) {
    toLocal(_w, _p.copy(this.a.pos).add(d), this.a.pos, this.a.heading);
    this.a.knock.addScaledVector(d, 0.8 * k);
    for (const m of this.members) {
      const s = 3 + 3 * k + Math.random() * 1.5, side = (Math.random() - 0.5) * 3;
      m.vel.set(_w.x * s - _w.z * side, 0, _w.z * s + _w.x * side);
      m.vy = 2.2 + Math.random() * 2 * k; m.flung = true;
      m.spin.set((Math.random() - 0.5) * 14, (Math.random() - 0.5) * 8, (Math.random() - 0.5) * 14);
    }
  }
  splashed() { for (const m of this.members) if (m.y <= 0.01) m.vy = 2.4 + Math.random(); }
  singed() { this.panic = 2.2; for (const m of this.members) if (m.y <= 0.01) m.vy = 3; }
  update(dt, c) {
    const a = this.a, M = a.mood;
    this.panic = Math.max(0, (this.panic ?? 0) - dt);
    this.turnSlots += dt * (0.08 + (M.spin ?? 0) * 1.6 + (this.panic > 0 ? 4 : 0));
    // a beat for the voice: each new syllable bounces the next of them
    if (a.voice > 0.55 && !this._loud) { this._loud = true; const m = this.members[this.beat++ % this.members.length]; if (m.y <= 0.02 && !m.flung) m.vy = 1.1 + a.voice; }
    if (a.voice < 0.3) this._loud = false;
    toLocal(_w, _p.copy(a.pos).add(c.toPlayer), a.pos, a.heading);
    const moving = c.speed > 0.05 || a.knock.length() > 0.3, n = this.members.length;
    for (let k = 0; k < n; k++) {
      const m = this.members[k];
      if (m.flung) {
        // scattered: flying, bouncing, rolling to a stop
        m.vy -= 9.8 * dt; m.y += m.vy * dt;
        m.off.addScaledVector(m.vel, dt);
        if (m.y <= 0) { m.y = 0; if (m.vy < -1.2) { m.vy *= -0.38; m.vel.multiplyScalar(0.6); m.spin.multiplyScalar(0.6); } else { m.vy = 0; m.vel.multiplyScalar(Math.exp(-5 * dt)); } }
        m.tumble.addScaledVector(m.spin, dt);
        if (m.y === 0 && m.vel.length() < 0.25) { m.flung = false; m.spin.set(0, 0, 0); }
      } else {
        // back to its place in the cluster, in hops
        const slot = this.slotOf(m, _d);
        if (M.lean) slot.addScaledVector(_s.set(_w.x, 0, _w.z).normalize(), 0.25 * M.lean);
        _s.subVectors(slot, m.off);
        const far = _s.length();
        const step = Math.min(far, dt * (far > 0.3 ? 2.2 : 0.8));
        if (far > 1e-4) m.off.addScaledVector(_s, step / far);
        m.tumble.x = damp(m.tumble.x, 0, 6, dt); m.tumble.z = damp(m.tumble.z, 0, 6, dt); m.tumble.y = damp(m.tumble.y, 0, 3, dt);
        m.vy -= 9.8 * dt; m.y = Math.max(0, m.y + m.vy * dt);
        if (m.y === 0) {
          if (m.vy < -1.5) m.squash = 0.7;
          m.vy = 0;
          // hop: walking, going back to their place, happy, playful, panicking, or now and then
          m.hop += dt * (moving || far > 0.3 || this.panic > 0 ? 2.4 : 0.35 + 0.5 * Math.max(0, M.pose)) * M.tempo;
          if (m.hop >= 1) { m.hop -= 1; m.vy = (moving || far > 0.3 ? 2.1 : 1.3) * (1 + 0.3 * Math.max(0, M.pose)) * (0.8 + m.size * 0.3); }
        }
      }
      m.squash = damp(m.squash, m.y > 0 ? 1.12 : 1 - 0.12 * Math.max(0, -M.pose), 9, dt);
      // where it looks: at you, else along the way, else about
      const lx = _w.x - m.off.x, lz = _w.z - m.off.z;
      const yawTo = c.looking ? Math.atan2(lx, lz) : Math.sin(a.time * 0.5 + k * 1.7) * 0.8;
      m.yaw += wrapA(yawTo - m.yaw) * (1 - Math.exp(-5 * dt));
      // tremble when scared, all up when surprised
      const shake = M.shake * 0.03 * Math.sin(a.time * 40 + k);
      _p.set(m.off.x + shake, m.y + M.lift * 0.4 * (k % 2 ? 1 : 0.6), m.off.z);
      _q.setFromEuler(_e.set(m.tumble.x - 0.12 * M.pose * 0, m.yaw + m.tumble.y, m.tumble.z));
      const s = m.size;
      _s.set(s * (2 - m.squash) ** 0.5, s * m.squash, s * (2 - m.squash) ** 0.5);
      _m.compose(_p, _q, _s);
      this.mesh.setMatrixAt(k, _m);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
}

const MOTORS = { drifter: DrifterMotor, stilt: StiltMotor, shell: ShellMotor, murmur: MurmurMotor };
