// The shooting gallery (docs/systems/minigames.md): a fairground stall of the Signal Market, played on
// foot with the fluid gun (aim LT / L2, fire RT / R2). Painted wooden cutouts slide along two brass
// rails, ink-blot figures pop up behind a low fence (and, among them, the market's own folk, who must
// not be splashed), plates spin on their sticks and two bells swing from the beam. A minute; every hit
// in a row raises the multiplier, a miss or a friend splashed ends it; the golden ones are worth the
// most. The stallkeeper calls it all from the side of the booth, in the market's patter.
//
// The rules are pure (scoreHit, comboMult, ShotLedger, GalleryDirector: tests/minigames-gallery.test.js);
// the booth, the targets and the keeper are drawn here.

import * as THREE from 'three';
import { makeMaterial } from '../materials.js';
import { registerTarget } from '../targets.js';
import { textGeometry } from '../story/sign-text.js';
import { planLine, voiceOf } from '../story/voice.js';
import { stripTone } from '../story/tone.js';
import { arenaLevel } from './kit/world.js';
import { lendTool, standAt } from './kit/onfoot.js';
import { WorldLabels } from './kit/labels.js';

// ------------------------------------------------------------------ the rules (pure)
export const GALLERY = {
  time: 60,                 // s, the round
  final: 15,                // the last seconds: the golds come out more, the rails run faster
  points: { rail: 10, fast: 15, popup: 25, plate: 20, bell: 30, gold: 100, friend: -50 },
  comboEvery: 3,            // hits in a row for each step of the multiplier
  comboMax: 5,
  shotLife: 1.5,            // s: a shot that has met no target by then has missed
  tank: { max: 6, delay: 1.0 },   // the stall's tank: six shots, full again a second after the last
};

/** The multiplier for the next hit, after `streak` hits in a row: ×1 for the first three, ×2 for the next three, … */
export const comboMult = (streak, G = GALLERY) => Math.min(G.comboMax, 1 + Math.floor(Math.max(0, streak) / G.comboEvery));

export const newRun = () => ({ score: 0, streak: 0, bestStreak: 0, maxMult: 1, hits: 0, misses: 0, friends: 0, golds: 0, bells: 0, plates: 0, shots: 0 });

/**
 * A shot's outcome on the run (changed in place): kind 'rail' | 'fast' | 'popup' | 'plate' | 'bell' |
 * 'gold' | 'friend' | 'miss'. Returns { points, mult, up (the multiplier rose), broke (a streak ended) }.
 */
export function scoreHit(run, kind, G = GALLERY) {
  if (kind === 'miss') {
    run.misses++;
    const broke = run.streak >= G.comboEvery;
    run.streak = 0;
    return { points: 0, mult: 1, up: false, broke };
  }
  if (kind === 'friend') {
    run.friends++;
    const before = run.score;
    run.score = Math.max(0, run.score + G.points.friend);
    run.streak = 0;
    return { points: run.score - before, mult: 1, up: false, broke: true };
  }
  const mult = comboMult(run.streak, G), points = (G.points[kind] ?? 10) * mult;
  run.score += points;
  run.hits++;
  run.streak++;
  run.bestStreak = Math.max(run.bestStreak, run.streak);
  const next = comboMult(run.streak, G);
  run.maxMult = Math.max(run.maxMult, next);
  if (kind === 'gold') run.golds++;
  if (kind === 'bell') run.bells++;
  if (kind === 'plate') run.plates++;
  return { points, mult, up: next > mult, broke: false };
}

/** Shots in flight: each one fired is a hit when a target takes it, a miss when none has by `life` s. */
export class ShotLedger {
  constructor(life = GALLERY.shotLife) { this.life = life; this.out = []; }
  fired(t) { this.out.push(t); }
  /** A target was hit: the oldest shot in flight was it (false: none was, a hit from before the round). */
  hit() { return this.out.shift() !== undefined; }
  /** The misses at time t (the shots out longer than their life). */
  update(t) { let n = 0; while (this.out.length && t - this.out[0] > this.life) { this.out.shift(); n++; } return n; }
}

const lerp = (a, b, k) => a + (b - a) * k;
const clamp01 = (v) => Math.max(0, Math.min(1, v));

/** How busy the stall is at t s into the round: the gaps between targets, how long the figures stay up, the friends' share. */
export function galleryPlan(t, G = GALLERY) {
  const k = clamp01(t / G.time), last = t > G.time - G.final;
  return {
    k, last,
    railEvery: [lerp(2.0, 1.1, k), lerp(2.6, 1.3, k)],   // s between the cutouts on the back rail, the middle one
    railSpeed: [1.7 * (last ? 1.25 : 1), 2.6 * (last ? 1.25 : 1)],   // m/s
    popEvery: lerp(2.0, 0.95, k),
    popUp: lerp(1.9, 1.15, k),                       // s a figure stays up
    friendShare: lerp(0.2, 0.34, k),                 // of the figures that pop up
    railFriend: t > 20 ? 0.18 : 0,                   // of the middle rail's cutouts (a parasol among the fish)
    goldEvery: last ? 4 : 9,
  };
}

/** Which targets come out when: step(dt) → [{ kind: 'rail', row, shape, gold, friend } | { kind: 'popup', slot, friend, up }]. */
export class GalleryDirector {
  constructor(rng = Math.random, G = GALLERY) {
    this.rng = rng; this.G = G; this.t = 0;
    this.next = { rail: [0.15, 1.1], pop: 0.9, gold: 6.5 };
    this.slots = [0, 0, 0, 0];   // s each pop-up slot is still busy
  }
  step(dt) {
    const r = this.rng, out = [];
    this.t += dt;
    const P = galleryPlan(this.t, this.G);
    for (let i = 0; i < this.slots.length; i++) this.slots[i] = Math.max(0, this.slots[i] - dt);
    let gold = false;
    if ((this.next.gold -= dt) <= 0) { gold = true; this.next.gold = P.goldEvery * (0.8 + 0.4 * r()); }
    for (const row of [0, 1]) {
      if ((this.next.rail[row] -= dt) > 0) continue;
      const friend = row === 1 && r() < P.railFriend;
      out.push({ kind: 'rail', row, shape: friend ? 'auntie' : r() < 0.5 ? 'fish' : 'bird', gold: false, friend, speed: P.railSpeed[row] });
      this.next.rail[row] = P.railEvery[row] * (0.75 + 0.5 * r());
    }
    if (gold) { const row = r() < 0.5 ? 0 : 1; out.push({ kind: 'rail', row, shape: r() < 0.5 ? 'fish' : 'bird', gold: true, friend: false, speed: P.railSpeed[row] * 1.6 }); }   // (quick: it overtakes the others)
    if ((this.next.pop -= dt) <= 0) {
      const n = P.k > 0.5 && r() < 0.4 ? 2 : 1;
      for (let j = 0; j < n; j++) {
        const free = this.slots.map((b, i) => (b === 0 ? i : -1)).filter((i) => i >= 0);
        if (!free.length) break;
        const slot = free[Math.floor(r() * free.length)], friend = r() < P.friendShare;
        this.slots[slot] = P.popUp + 0.7;
        out.push({ kind: 'popup', slot, friend, shape: friend ? (r() < 0.5 ? 'auntie' : 'cat') : 'blot', up: P.popUp });
      }
      this.next.pop = P.popEvery * (0.7 + 0.6 * r());
    }
    return out;
  }
}

/** A pendulum's swing (rad) at t: amplitude a, period T, phase p. */
export const swing = (t, a, T = 2.4, p = 0) => a * Math.sin((2 * Math.PI * t) / T + p);

// ------------------------------------------------------------------ the stallkeeper's patter
// (every line toned: src/story/tone.js; the market's own patter for the voice, src/story/voice.js)
export const KEEPER_LINES = {
  start: ['~shout~ Step up, step up! One minute, one tank, every target you can splash!', '~playful~ Ink blots only, traveller. Mind the parasols!', '~shout~ Roll up! The gallery of the Signal Market never closes!'],
  combo: ['~surprised~ Three in a row! The crowd is waking up!', '~happy~ Look at that hand! Steady as a signal mast!', '~shout~ Again! Again!', '~playful~ Are you sure you have never done this before?', '~happy~ Now that is how the market shoots!'],
  friend: ['~angry~ Not Auntie Lumé! She has a parasol!', '~sad~ Oh, the poor cat. Ink blots, traveller, ink blots.', '~scared~ Careful! Those are my customers!', '~angry~ We do not splash the regulars!'],
  gold: ['~surprised~ Gold! Gold on the rail!', '~happy~ A golden one! The whole market heard that.', '~shout~ Gold! Somebody fetch the good prizes!'],
  bell: ['~playful~ Ring it again, they love the bell.', '~happy~ Hear that? Ding! That is a winner’s bell.'],
  plate: ['~shout~ There go my good plates!', '~playful~ Plates are cheaper than cups. Keep going.'],
  misses: ['~playful~ The targets are in front of you, traveller.', '~tired~ The back wall thanks you for the paint.', '~curious~ Is the tank pointing the right way round?'],
  final: ['~shout~ Last round! The golds come out to play!'],
  ten: ['~shout~ Ten seconds! Everything you have!'],
  idle: ['~shout~ Fish of the moons, birds of the signal, blots of the deep! All for you!', '~curious~ Did you see the bells? Nobody ever rings both.', '~playful~ The plates spin faster when nobody is looking.'],
  good: ['~happy~ A fine score! Your name goes up on the board.', '~surprised~ What a round! I will be telling the tram drivers about this.'],
  meh: ['~neutral~ Not bad. Come back when the lanterns are lit.', '~playful~ A warm-up round. The next one is the real one.'],
};
const KEEPER_VOICE = voiceOf({ id: 'gallery-keeper', name: 'the stallkeeper', kind: 'm', voice: 0.86 });

// ------------------------------------------------------------------ the booth
const INK = '#2b211f';
const MARKET_DAY = ['#a4d7d1', '#e1e6c6', '#70969e', '#fff1cf', '#ffe1ae'];   // (the Signal Market's sky: src/levels/bazaar.js)
const MARKET_LOOK = { uHatch: 0.18, uLineWidth: 0.85, uWobble: 0.1, uHazeLayers: [90, 1.8, 0.12, 4], uHazeTone: [0.96, 0.91, 0.8, 0.7] };
const PRINT = { shadeFlat: 0.85 };
/** Where the traveller stands, behind the counter (facing -z, into the booth), and how far he may wander there. */
export const STAND = { at: new THREE.Vector3(0, 0, 1.7), x: 3.4, z: [1.05, 3.3] };
const RAILS = [{ y: 3.35, z: -12.1, span: 6.3 }, { y: 2.1, z: -9.7, span: 6.3 }];
const POP = { z: -7.3, y: 0.36, xs: [-4.5, -1.5, 1.5, 4.5] };
const PLATES = [[-5.1, 4.75, -12.9], [-1.7, 5.05, -12.9], [1.7, 5.05, -12.9], [5.1, 4.75, -12.9]];
const BELLS = [{ x: -3.5, z: -5.4, top: 6.35, len: 1.15, T: 2.3, p: 0 }, { x: 3.5, z: -5.4, top: 6.35, len: 1.15, T: 2.6, p: 1.7 }];
const KEEPER_AT = new THREE.Vector3(-5.4, 0, -2.4);

const mat = (color, o = {}) => makeMaterial({ color, flat: true, ...PRINT, ...o });
const solid = (geo, m, x, y, z) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); return o; };
const deco = (o) => { o.traverse((c) => { c.userData.noCollide = true; }); return o; };

function shapeMesh(shape, m, depth = 0.05) {
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 14 });
  g.translate(0, 0, -depth / 2);
  return new THREE.Mesh(g, m);
}
const circle = (r, x = 0, y = 0) => { const s = new THREE.Shape(); s.absarc(x, y, r, 0, Math.PI * 2, false); return s; };
const disc = (r, m, x, y, z = 0.04, seg = 20) => { const o = new THREE.Mesh(new THREE.CircleGeometry(r, seg), m); o.position.set(x, y, z); return o; };

let PAINT = null;
function paints() {
  if (PAINT) return PAINT;
  const d = (c, o = {}) => mat(c, { side: THREE.DoubleSide, ...o });
  PAINT = {
    teal: d('#5fb7ad'), tealDark: d('#3f7f86'), coral: d('#f0a083'), sand: d('#e4bd83'), lilac: d('#b9a9c5'), cream: d('#f7ecd2'),
    red: d('#c8483a'), ink: d(INK), white: d('#fbf4e2'), blot: d('#3b3350'), blotLite: d('#6d4fa8'), pink: d('#ed80b0'), skin: d('#e8b48a'),
    orange: d('#e9a53c'), blue: d('#3f5fae'), gold: d('#f2c54b', { glow: 0.45 }), goldDeep: d('#d8a24a', { glow: 0.3 }), wood: mat('#b98d5a', { side: THREE.DoubleSide }),
  };
  return PAINT;
}

/** A bullseye painted on a cutout: rings, red and cream. */
function bullseye(P, r = 0.16, z = 0.03) {
  const g = new THREE.Group();
  g.add(disc(r, P.red, 0, 0, z), disc(r * 0.68, P.cream, 0, 0, z + 0.002), disc(r * 0.36, P.red, 0, 0, z + 0.004));
  return g;
}

/** A painted wooden cutout, facing +z, about a metre across: 'fish', 'bird', 'blot', 'auntie', 'cat' (gold: all gilt). */
export function cutout(shape, { gold = false } = {}) {
  const P = paints(), g = new THREE.Group();
  const body = gold ? P.gold : null;
  if (shape === 'fish') {
    const s = new THREE.Shape(); s.absellipse(0, 0, 0.44, 0.25, 0, Math.PI * 2, false);
    const tail = new THREE.Shape(); tail.moveTo(0.36, 0); tail.lineTo(0.66, 0.24); tail.lineTo(0.6, 0); tail.lineTo(0.66, -0.24); tail.closePath();
    const fin = new THREE.Shape(); fin.moveTo(-0.1, 0.2); fin.lineTo(0.12, 0.42); fin.lineTo(0.2, 0.2); fin.closePath();
    g.add(shapeMesh(s, body ?? P.teal), shapeMesh(tail, gold ? P.goldDeep : P.sand), shapeMesh(fin, gold ? P.goldDeep : P.tealDark));
    g.add(disc(0.055, P.white, -0.27, 0.06), disc(0.03, P.ink, -0.28, 0.06, 0.042));
    for (const x of [-0.05, 0.08, 0.21]) { const b = new THREE.Mesh(new THREE.PlaneGeometry(0.025, 0.3 - Math.abs(x) * 0.5), gold ? P.goldDeep : P.tealDark); b.position.set(x, 0, 0.032); g.add(b); }
    const be = bullseye(P, 0.12); be.position.x = 0.02; g.add(be);
  } else if (shape === 'bird') {
    const wing = new THREE.Shape(); wing.moveTo(-0.15, 0.05); wing.quadraticCurveTo(0.15, 0.62, 0.48, 0.38); wing.quadraticCurveTo(0.2, 0.18, 0.18, 0.02); wing.closePath();
    const beak = new THREE.Shape(); beak.moveTo(-0.44, 0.24); beak.lineTo(-0.66, 0.17); beak.lineTo(-0.43, 0.12); beak.closePath();
    const tail = new THREE.Shape(); tail.moveTo(0.25, -0.05); tail.lineTo(0.56, 0.08); tail.lineTo(0.52, -0.2); tail.closePath();
    g.add(shapeMesh(circle(0.3, 0, 0), body ?? P.coral), shapeMesh(circle(0.17, -0.3, 0.2), body ?? P.coral), shapeMesh(beak, gold ? P.goldDeep : P.orange),
      shapeMesh(tail, gold ? P.goldDeep : P.lilac));
    const w = shapeMesh(wing, gold ? P.goldDeep : P.lilac); w.position.z = 0.03; g.add(w);
    g.add(disc(0.05, P.white, -0.33, 0.24, 0.035), disc(0.026, P.ink, -0.35, 0.24, 0.04));
    const be = bullseye(P, 0.11, 0.06); be.position.set(0.02, -0.06, 0); g.add(be);
  } else if (shape === 'blot') {
    const s = new THREE.Shape();
    for (let i = 0; i <= 40; i++) {
      const a = (i / 40) * Math.PI * 2, r = 0.42 * (1 + 0.13 * Math.sin(5 * a + 0.4) + 0.06 * Math.sin(9 * a));
      if (i === 0) s.moveTo(Math.cos(a) * r, Math.sin(a) * r); else s.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    g.add(shapeMesh(s, body ?? P.blot));
    for (const x of [-0.14, 0.14]) g.add(disc(0.1, P.white, x, 0.08), disc(0.05, P.red, x + 0.02, 0.06, 0.042));
    const teeth = new THREE.Shape(); teeth.moveTo(-0.2, -0.12);
    for (let i = 0; i < 6; i++) { teeth.lineTo(-0.2 + (i + 0.5) * 0.4 / 6, -0.2); teeth.lineTo(-0.2 + (i + 1) * 0.4 / 6, -0.12); }
    teeth.lineTo(-0.2, -0.12);
    const t = shapeMesh(teeth, P.cream, 0.01); t.position.z = 0.03; g.add(t);
    const drip = shapeMesh(circle(0.07, 0.24, -0.42), body ?? P.blot); g.add(drip);
  } else if (shape === 'auntie') {
    // the market's Auntie Lumé under her parasol: friends are pastel and smiling
    const dress = new THREE.Shape(); dress.moveTo(-0.12, 0.1); dress.lineTo(0.12, 0.1); dress.lineTo(0.3, -0.62); dress.lineTo(-0.3, -0.62); dress.closePath();
    const para = new THREE.Shape(); para.moveTo(-0.52, 0.42); para.quadraticCurveTo(0, 0.95, 0.52, 0.42);
    for (let i = 5; i >= 0; i--) para.quadraticCurveTo(-0.52 + (i + 0.5) * 1.04 / 6, 0.5, -0.52 + i * 1.04 / 6, 0.42);
    g.add(shapeMesh(dress, P.pink), shapeMesh(circle(0.14, 0, 0.24), P.skin));
    const pm = shapeMesh(para, P.teal); pm.position.z = 0.02; g.add(pm);
    const stick = new THREE.Mesh(new THREE.PlaneGeometry(0.025, 0.55), P.ink); stick.position.set(0.18, 0.3, 0.035); g.add(stick);
    g.add(disc(0.02, P.ink, -0.05, 0.27), disc(0.02, P.ink, 0.05, 0.27));
    const smile = new THREE.Mesh(new THREE.RingGeometry(0.05, 0.068, 12, 1, Math.PI * 1.15, Math.PI * 0.7), P.ink); smile.position.set(0, 0.23, 0.04); g.add(smile);
    for (const y of [-0.18, -0.38]) { const band = new THREE.Mesh(new THREE.PlaneGeometry(0.4 + (-y) * 0.3, 0.05), P.cream); band.position.set(0, y, 0.03); g.add(band); }
  } else if (shape === 'cat') {
    const head = circle(0.32, 0, 0);
    const ears = new THREE.Shape(); ears.moveTo(-0.3, 0.12); ears.lineTo(-0.24, 0.46); ears.lineTo(-0.06, 0.28); ears.closePath();
    const ear2 = new THREE.Shape(); ear2.moveTo(0.3, 0.12); ear2.lineTo(0.24, 0.46); ear2.lineTo(0.06, 0.28); ear2.closePath();
    g.add(shapeMesh(head, P.orange), shapeMesh(ears, P.orange), shapeMesh(ear2, P.orange));
    g.add(disc(0.07, P.cream, -0.11, 0.04), disc(0.07, P.cream, 0.11, 0.04), disc(0.035, P.ink, -0.11, 0.04, 0.042), disc(0.035, P.ink, 0.11, 0.04, 0.042));
    g.add(disc(0.04, P.pink, 0, -0.07));
    for (const s of [-1, 1]) for (const dy of [-0.08, -0.13]) { const w = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.012), P.ink); w.position.set(s * 0.2, dy, 0.035); w.rotation.z = s * (dy + 0.1) * 2; g.add(w); }
    const bow = new THREE.Mesh(new THREE.PlaneGeometry(0.26, 0.09), P.teal); bow.position.set(0, -0.3, 0.03); g.add(bow);
  }
  g.traverse((o) => { o.userData.noCollide = true; });
  return g;
}

/** The stallkeeper: a round barker in a striped waistcoat and a straw boater, a brass speaking-trumpet in his hand. */
function keeperModel() {
  const g = new THREE.Group();
  const coat = mat('#c8483a'), stripe = mat('#f5dfab'), skin = mat('#e8b48a'), dark = mat(INK), straw = mat('#ebce98'), trousers = mat('#465c65');
  const brass = makeMaterial({ color: '#c99758', metal: 'brass' });
  for (const s of [-1, 1]) { const leg = solid(new THREE.CylinderGeometry(0.11, 0.12, 0.85, 8), trousers, s * 0.16, 0.43, 0); g.add(leg); g.add(solid(new THREE.BoxGeometry(0.2, 0.09, 0.32), dark, s * 0.16, 0.04, 0.06)); }
  const body = new THREE.Group(); body.position.y = 0.85; g.add(body);
  const belly = new THREE.Mesh(new THREE.SphereGeometry(0.42, 16, 12), coat); belly.scale.set(1, 1.15, 0.9); belly.position.y = 0.42; body.add(belly);
  for (const x of [-0.18, 0, 0.18]) { const st = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.82, 0.02), stripe); st.position.set(x, 0.42, 0.38 - Math.abs(x) * 0.35); st.rotation.y = -x * 0.9; body.add(st); }
  const head = new THREE.Group(); head.position.y = 1.0; body.add(head);
  head.add(new THREE.Mesh(new THREE.SphereGeometry(0.25, 16, 12), skin));
  head.add(solid(new THREE.SphereGeometry(0.07, 10, 8), skin, 0, -0.01, 0.24));
  for (const s of [-1, 1]) {
    head.add(solid(new THREE.SphereGeometry(0.03, 8, 6), dark, s * 0.09, 0.07, 0.21));
    const m = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.028, 6, 12, Math.PI * 0.8), dark);
    m.position.set(s * 0.085, -0.07, 0.22); m.rotation.set(0, 0, s > 0 ? Math.PI * 1.1 : -0.1 + Math.PI * 0.1); head.add(m);
  }
  const hat = new THREE.Group(); hat.position.y = 0.2; head.add(hat);
  hat.add(solid(new THREE.CylinderGeometry(0.4, 0.4, 0.03, 20), straw, 0, 0, 0));
  hat.add(solid(new THREE.CylinderGeometry(0.22, 0.24, 0.16, 18), straw, 0, 0.09, 0));
  hat.add(solid(new THREE.CylinderGeometry(0.245, 0.245, 0.05, 18), mat('#3f5fae'), 0, 0.04, 0));
  hat.rotation.z = 0.12;
  const arms = [];
  for (const s of [-1, 1]) {
    const sh = new THREE.Group(); sh.position.set(s * 0.4, 0.68, 0); body.add(sh);
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.085, 0.6, 8), coat); arm.position.y = -0.3; sh.add(arm);
    sh.add(solid(new THREE.SphereGeometry(0.08, 8, 6), skin, 0, -0.62, 0));
    sh.rotation.z = s * 0.25;
    arms.push(sh);
  }
  const horn = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.035, 0.55, 14, 1, true), brass);
  horn.material.side = THREE.DoubleSide;
  horn.rotation.x = Math.PI / 2; horn.position.set(0, -0.68, 0.24);
  arms[1].add(horn);
  // a little crate to stand on
  g.add(solid(new THREE.BoxGeometry(0.9, 0.3, 0.7), mat('#a8683f'), 0, -0.15, 0));
  g.position.y = 0.3;
  deco(g);
  return { group: g, body, head, arms, hat };
}

function bellModel() {
  const brass = makeMaterial({ color: '#d8a24a', metal: 'brass' }), rope = mat('#8c5533');
  const pts = [[0.02, 0.36], [0.09, 0.34], [0.15, 0.26], [0.17, 0.1], [0.22, -0.06], [0.3, -0.16], [0.31, -0.2], [0.0, -0.2]].map(([x, y]) => new THREE.Vector2(x, y));
  const g = new THREE.Group();
  const bell = new THREE.Mesh(new THREE.LatheGeometry(pts, 18), brass); bell.material.side = THREE.DoubleSide;
  const clap = solid(new THREE.SphereGeometry(0.06, 8, 6), mat(INK), 0, -0.2, 0);
  const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 1, 5), rope);
  g.add(bell, clap, cord);
  return deco(Object.assign(g, { bell, cord, clap }));
}

function plateModel() {
  const P = paints(), g = new THREE.Group();
  const plate = new THREE.Group();
  plate.add(new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.34, 0.045, 26), P.cream));
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.37, 0.026, 5, 26), P.blue); rim.rotation.x = Math.PI / 2; rim.position.y = 0.022; plate.add(rim);
  const c = new THREE.Mesh(new THREE.CircleGeometry(0.11, 16), P.blue); c.rotation.x = -Math.PI / 2; c.position.y = 0.024; plate.add(c);
  for (let i = 0; i < 6; i++) { const d = new THREE.Mesh(new THREE.CircleGeometry(0.035, 8), P.red); const a = (i / 6) * Math.PI * 2; d.rotation.x = -Math.PI / 2; d.position.set(Math.cos(a) * 0.21, 0.024, Math.sin(a) * 0.21); plate.add(d); }
  g.add(plate);
  return deco(Object.assign(g, { plate }));
}

function* buildGallery(scene) {
  const P = paints();
  const paving = mat('#a4c1be', { grid: 10 }), board = mat('#c99758', { grid: 4 }), plaster = mat('#f0a083', { grid: 12, weathered: 0.7 });
  const tealWall = mat('#88b4b5', { grid: 9, weathered: 0.7 }), dark = mat('#3a535b', { metal: 'painted' }), cream = mat('#f5dfab');
  const brass = makeMaterial({ color: '#c99758', metal: 'brass' }), glow = mat('#fff0bd', { glow: 0.85 }), red = mat('#c8483a');
  const parts = new THREE.Group(); parts.name = 'The gallery';
  // the street: paving all round; the booth's own boards inside
  parts.add(solid(new THREE.BoxGeometry(140, 2, 140), paving, 0, -1, 0));
  const boards = solid(new THREE.BoxGeometry(15, 0.04, 14.5), board, 0, 0.02, -7.6); boards.userData.noCollide = true; parts.add(boards);
  // the booth: a backdrop, two side walls, the frame up front with its striped valance, a sign of lit bulbs
  parts.add(solid(new THREE.BoxGeometry(16, 7.4, 0.4), tealWall, 0, 3.7, -14.9));
  for (const s of [-1, 1]) parts.add(solid(new THREE.BoxGeometry(0.5, 7.4, 11.2), plaster, s * 7.75, 3.7, -9.4));
  for (const s of [-1, 1]) parts.add(solid(new THREE.BoxGeometry(0.6, 7.4, 0.6), dark, s * 7.6, 3.7, -3.6));
  parts.add(solid(new THREE.BoxGeometry(16, 0.5, 0.7), dark, 0, 7.15, -3.6));
  yield;
  // the backdrop's painting: a pale moon, a ringed planet, dunes and the market's towers, in flat colour
  const back = new THREE.Group(); back.position.set(0, 0, -14.68); parts.add(back);
  back.add(disc(1.9, mat('#f5dfab'), -3.6, 5.1, 0.01, 40));
  const ringed = disc(0.9, mat('#e9a53c'), 4.6, 5.6, 0.012, 32); back.add(ringed);
  const ring = new THREE.Mesh(new THREE.RingGeometry(1.2, 1.38, 40), mat('#f7ecd2')); ring.position.set(4.6, 5.6, 0.014); ring.scale.y = 0.32; ring.rotation.z = 0.25; back.add(ring);
  for (const [x, w, h, c] of [[-6.2, 1.4, 4.6, '#94a9bd'], [-4.6, 1.0, 3.4, '#b9a9c5'], [5.6, 1.6, 4.1, '#94a9bd'], [3.9, 0.9, 2.9, '#b9a9c5'], [6.9, 0.8, 2.6, '#ebce98']]) {
    const t = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat(c)); t.position.set(x, h / 2 + 0.6, 0.016); back.add(t);
  }
  const dune = (y, amp, c, z, ph) => { const s = new THREE.Shape(); s.moveTo(-8, 0); for (let i = 0; i <= 32; i++) { const x = -8 + i * 0.5; s.lineTo(x, y + amp * Math.sin(x * 0.7 + ph) + amp * 0.5 * Math.sin(x * 1.7)); } s.lineTo(8, 0); s.closePath(); const m = new THREE.Mesh(new THREE.ShapeGeometry(s), mat(c)); m.position.z = z; back.add(m); };
  dune(2.6, 0.35, '#ebce98', 0.02, 0.3); dune(1.6, 0.3, '#e4bd83', 0.022, 2.1); dune(0.8, 0.22, '#d8a24a', 0.024, 4.2);
  for (let i = 0; i < 22; i++) back.add(disc(0.035 + (i % 3) * 0.015, mat('#fbf4e2', { glow: 0.5 }), -7 + ((i * 3.7) % 14), 4.2 + ((i * 1.3) % 2.6), 0.018, 6));
  // the rails: brass rods across the booth, the ends behind painted wings
  RAILS.forEach((R, i) => {
    const rod = solid(new THREE.CylinderGeometry(0.04, 0.04, 15, 8).rotateZ(Math.PI / 2), brass, 0, R.y - 0.62, R.z - 0.05); parts.add(rod);
    const shelf = solid(new THREE.BoxGeometry(15, 0.08, 0.32), board, 0, R.y - 0.72, R.z - 0.05); parts.add(shelf);
    for (const s of [-1, 1]) {
      const wing = solid(new THREE.BoxGeometry(1.5, 1.7, 0.12), i ? P.coral : P.tealDark, s * 6.9, R.y - 0.1, R.z + 0.35);
      parts.add(wing);
      const star = new THREE.Mesh(new THREE.CircleGeometry(0.32, 5), P.cream); star.position.set(s * 6.9, R.y, R.z + 0.42); parts.add(star);
    }
  });
  // the pop-ups' fence: a low painted board of dunes, and the plates' sticks
  const fence = solid(new THREE.BoxGeometry(14.6, 0.8, 0.1), P.sand, 0, 0.4, POP.z + 0.32); parts.add(fence);
  for (let i = 0; i < 14; i++) parts.add(solid(new THREE.BoxGeometry(0.5, 0.25, 0.02), i % 2 ? P.teal : P.coral, -6.8 + i * 1.04, 0.66, POP.z + 0.38));
  for (const [x, y, z] of PLATES) parts.add(solid(new THREE.CylinderGeometry(0.025, 0.03, y, 6), dark, x, y / 2, z));
  // the bells' beam
  parts.add(solid(new THREE.BoxGeometry(15, 0.24, 0.3), board, 0, BELLS[0].top + 0.1, BELLS[0].z));
  yield;
  // up front: the striped valance, the sign and its bulbs, the counter
  for (let i = 0; i < 16; i++) {
    const v = solid(new THREE.BoxGeometry(1, 0.7, 0.06), i % 2 ? cream : red, -7.5 + i, 6.55, -3.22);
    parts.add(v);
    const sc = new THREE.Mesh(new THREE.CircleGeometry(0.5, 12, Math.PI, Math.PI), i % 2 ? cream : red); sc.position.set(-7.5 + i, 6.2, -3.18); parts.add(sc);
  }
  const sign = solid(new THREE.BoxGeometry(10.4, 1.3, 0.25), dark, 0, 7.75, -3.6); parts.add(sign);
  const letters = new THREE.Mesh(textGeometry('SHOOTING GALLERY', { width: 8.2, depth: 0.05 }), mat('#fff0bd', { glow: 0.7 })); letters.position.set(0, 7.78, -3.44); parts.add(letters);
  const bulbs = [];
  for (let i = 0; i < 26; i++) {
    const top = i < 13, k = (i % 13) / 12;
    const b = solid(new THREE.SphereGeometry(0.075, 8, 6), glow, -5 + k * 10, top ? 8.48 : 7.08, -3.44); parts.add(b); bulbs.push(b);
  }
  const counter = solid(new THREE.BoxGeometry(9.4, 1.06, 0.85), board, 0, 0.53, 0.42); parts.add(counter);
  parts.add(solid(new THREE.BoxGeometry(9.6, 0.08, 1.0), dark, 0, 1.1, 0.42));
  for (let i = 0; i < 9; i++) parts.add(solid(new THREE.BoxGeometry(0.98, 0.86, 0.03), i % 2 ? P.cream : P.red, -4.2 + i * 1.05, 0.5, 0.86));
  // on the counter: the stall's spare tanks, a prize jar
  for (const [x, c] of [[-3.8, '#52c8cf'], [-3.45, '#966ede'], [3.6, '#ef7e62']]) {
    parts.add(solid(new THREE.CylinderGeometry(0.11, 0.13, 0.36, 10), mat(c, { glow: 0.35 }), x, 1.32, 0.35));
    parts.add(solid(new THREE.CylinderGeometry(0.05, 0.05, 0.08, 8), brass, x, 1.54, 0.35));
  }
  parts.add(solid(new THREE.SphereGeometry(0.24, 12, 10), mat('#a4d7d1', { glow: 0.25 }), 4.2, 1.4, 0.4));
  // prizes on the side walls' shelves: round plush moons and stars
  for (const s of [-1, 1]) for (let r = 0; r < 2; r++) {
    parts.add(solid(new THREE.BoxGeometry(0.4, 0.06, 6.5), board, s * 7.35, 4.4 + r * 1.2, -9.5));
    for (let i = 0; i < 6; i++) {
      const c = ['#ed80b0', '#71d7cf', '#f2c54b', '#b9a9c5', '#83cf71', '#ef7e62'][(i + r * 2 + (s > 0 ? 3 : 0)) % 6];
      parts.add(solid(new THREE.SphereGeometry(0.2 + (i % 2) * 0.06, 10, 8), mat(c), s * 7.3, 4.65 + r * 1.2 + (i % 2) * 0.05, -12.2 + i * 1.05));
    }
  }
  yield;
  // the market round the stall: shopfronts, awnings, a lamp post or two (a street of the Signal Market)
  const shopCols = ['#f0a083', '#e4bd83', '#8dbbb9', '#94a9bd', '#ebce98'];
  const shop = (x, z, w, h, yaw, i) => {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = yaw;
    g.add(solid(new THREE.BoxGeometry(w, h, 4), mat(shopCols[i % 5], { grid: 12, weathered: 0.7 }), 0, h / 2, 0));
    for (let r = 1; r < h / 3.2; r++) for (let c = 0; c < Math.floor(w / 2.6); c++) g.add(solid(new THREE.BoxGeometry(1.1, 1.4, 0.06), dark, -w / 2 + 1.5 + c * 2.6, r * 3.2 + 1.1, 2.02));
    const aw = solid(new THREE.BoxGeometry(w * 0.8, 0.12, 1.8), i % 2 ? red : mat('#5fb7ad'), 0, 3.1, 2.6); aw.rotation.x = 0.3; g.add(aw);
    g.add(solid(new THREE.BoxGeometry(w * 0.6, 0.8, 0.1), mat('#fbf4e2', { glow: 0.3 }), 0, h - 1.4, 2.05));
    parts.add(g);
  };
  shop(-16, -6, 10, 14, Math.PI / 2, 0); shop(-16, 8, 9, 18, Math.PI / 2, 1); shop(16, -6, 10, 12, -Math.PI / 2, 2); shop(16, 8, 9, 20, -Math.PI / 2, 3);
  shop(-8, 20, 12, 16, Math.PI, 4); shop(6, 20, 12, 22, Math.PI, 0); shop(0, -24, 30, 26, 0, 3);
  for (const [x, z] of [[-9.5, 4], [9.5, 4], [-9.5, -12], [9.5, -12]]) {
    parts.add(solid(new THREE.CylinderGeometry(0.08, 0.1, 4.6, 8), dark, x, 2.3, z));
    parts.add(solid(new THREE.SphereGeometry(0.28, 12, 10), glow, x, 4.75, z));
  }
  // a string of lanterns from the booth's corners out to the street
  for (const s of [-1, 1]) for (let i = 0; i < 7; i++) {
    const k = i / 6, x = s * (7.6 + k * 1.9), z = -3.6 + k * 7.6, y = 7.2 - Math.sin(k * Math.PI) * 0.9 - k * 2.4;
    parts.add(solid(new THREE.SphereGeometry(0.13, 8, 6), mat(['#f2c54b', '#ed80b0', '#71d7cf'][i % 3], { glow: 0.8 }), x, y, z));
  }
  scene.add(parts);
  // (the booth's walls and the counter are solid; the paintings and the bulbs need no collision)
  for (const o of [...back.children, letters, ...bulbs]) o.userData.noCollide = true;
  yield;
  // the moving parts that stay from round to round: the keeper, the bells, the plates
  const keeper = keeperModel();
  keeper.group.position.copy(KEEPER_AT).setY(0.3);
  keeper.group.rotation.y = Math.atan2(STAND.at.x - KEEPER_AT.x, STAND.at.z - KEEPER_AT.z);
  scene.add(keeper.group);
  const bells = BELLS.map((B) => { const m = bellModel(); scene.add(m); return { ...B, model: m, amp: 0.18, cool: 0, flash: 0 }; });
  const plates = PLATES.map(([x, y, z], i) => { const m = plateModel(); m.position.set(x, y + 0.02, z); scene.add(m); return { at: new THREE.Vector3(x, y + 0.04, z), model: m, spin: 7 + i * 1.3, down: 0 }; });
  return arenaLevel({
    ground: { heightAt: () => 0 }, name: 'The gallery', hour: 16.2, look: MARKET_LOOK,
    spawn: STAND.at.clone(),
    sky: { script: { day: MARKET_DAY, dusk: ['#9dabc3', '#ffc5a2', '#887b9e', '#ffd6aa', '#ffe5c2'], night: ['#1d2a52', '#4a5a8a', '#3d4380', '#8e9ccc', '#f2f0e6'] } },
    atmo: () => ({ tint: [1, 1, 1], fog: 0.65, name: 'The gallery' }),
    foes: { wild: false },
    // (the afternoon sun from over the traveller's shoulder, into the booth: its paint in the light, not the shade)
    lightAt(p, dir) { dir.set(0.28, 0.82, 0.5).normalize(); },
    stall: { keeper, bells, plates, bulbs },
  });
}

// ------------------------------------------------------------------ a round
const _v = new THREE.Vector3(), _w = new THREE.Vector3();

function start(ctx) {
  const { player, camera, level, sfx, sound, tool, rig } = ctx;
  const S = level.stall;
  const giveBack = lendTool(tool, GALLERY.tank);
  standAt(player, STAND.at, Math.PI, rig, 0);
  if (rig) rig.pitch = 0.02;
  const words = new WorldLabels(camera);
  const say = words.balloon();
  const run = newRun(), ledger = new ShotLedger(), director = new GalleryDirector();
  const moving = [];      // the cutouts out now (on the rails, up behind the fence)
  const offs = [];
  const root = ctx.add(deco(new THREE.Group()));
  let t = 0, clock = 0, said = 0, idleT = 8, missRun = 0, saidFinal = false, saidTen = false, done = false;
  const fx = {
    ok: () => !!sound?.ctx && !sound.muted && sound.fx,
    wood(k = 0) { if (!fx.ok()) return; sound.burst(sound.ctx.currentTime, { dur: 0.06, type: 'bandpass', freq: 1400 + k * 120, q: 3, vol: 0.2 }); sfx.coin(k); },
    clack() { if (fx.ok()) sound.burst(sound.ctx.currentTime, { dur: 0.05, type: 'bandpass', freq: 650, q: 2.5, vol: 0.09 }); },
    smash() { if (!fx.ok()) return; sound.burst(sound.ctx.currentTime, { dur: 0.32, type: 'highpass', freq: 2600, q: 0.8, vol: 0.16, rate: 1.4 }); sfx.coin(4); },
  };

  // the keeper: a line now (the important ones push past a quiet one), spoken in the market's patter
  function call(kind, force = false) {
    const list = KEEPER_LINES[kind];
    if (!list?.length || (!force && t - said < 3.2)) return;
    const line = list[Math.floor(Math.random() * list.length)];
    said = t; idleT = 9 + Math.random() * 5;
    say.show(stripTone(line), 2.2 + stripTone(line).length * 0.035);
    S.keeper.talk = 1.6;
    try { sound?.speak?.(planLine(line, { voice: KEEPER_VOICE, lang: 'bazaar', max: 9 }), { channel: 'balloon', gain: 0.9 }); } catch { /* (no voice: the balloon says it) */ }
  }

  // a hit on anything: the score, the words at the point, the keeper's say
  function scored(kind, point, label = null) {
    const counted = ctx.phase === 'play';
    ledger.hit();
    if (!counted) return null;   // (the 3-2-1 and the coast after the bell: practice, not points)
    missRun = 0;
    const r = scoreHit(run, kind);
    ctx.setScore(run.score);
    if (kind === 'friend') {
      words.pop(point, `${r.points}`, 'bad', 1.2); sfx.miss(); ctx.kick?.(0.25);
      ctx.flash('Not the friends!', 'bad'); call('friend', true);
      return r;
    }
    words.pop(point, `+${r.points}`, kind === 'gold' ? 'gold' : '', kind === 'gold' ? 1.3 : 0.9);
    if (label) words.pop(_v.copy(point).add(_w.set(0, 0.5, 0)), label, 'gold', 1.2);
    if (r.up) { words.pop(_v.copy(point).add(_w.set(0, -0.45, 0)), `×${comboMult(run.streak)}`, 'combo', 1.1); sfx.gate(); if (comboMult(run.streak) >= 2) call('combo', comboMult(run.streak) >= 3); }
    return r;
  }

  // ------------------------------------------------ the cutouts
  function spawn(e) {
    const shape = e.gold ? (e.shape === 'auntie' ? 'bird' : e.shape) : e.shape;
    const art = cutout(shape, { gold: e.gold });
    art.scale.setScalar(1.25);
    const g = new THREE.Group(); g.add(art); root.add(g);
    const m = { e, g, art, alive: true, hitT: 0, t: 0, kind: e.friend ? 'friend' : e.gold ? 'gold' : e.kind === 'popup' ? 'popup' : e.row === 1 ? 'fast' : 'rail', pos: new THREE.Vector3() };
    if (e.kind === 'rail') {
      const R = RAILS[e.row];
      m.dir = e.row === 0 ? 1 : -1;
      m.x = -m.dir * (R.span + 0.6);
      art.position.y = 0.05;
      if (m.dir < 0) art.scale.x = -1;   // (they swim and fly the way they go)
      g.position.set(m.x, R.y, R.z);
      // a stick down to the rail
      const stick = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.6, 0.03), paints().wood); stick.position.y = -0.38; g.add(stick);
    } else {
      g.position.set(POP.xs[e.slot], POP.y, POP.z);
      art.position.y = 0.78;
      const stick = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.5, 0.04), paints().wood); stick.position.y = 0.25; g.add(stick);
      g.rotation.x = -Math.PI / 2;   // (lying back behind the fence)
      m.upFor = e.up;
      fx.clack();
    }
    deco(g);
    if (e.gold) {
      m.sparkle = 0;
      if (e.kind === 'rail') words.pop(_v.set(m.x, RAILS[e.row].y + 0.7, RAILS[e.row].z), 'GOLD!', 'gold', 1.0);
      call('gold');
    }
    m.off = registerTarget({ kind: 'gallery', friend: !!e.friend, gold: !!e.gold, radius: e.kind === 'popup' ? 0.58 : 0.55,
      position: () => art.getWorldPosition(m.pos),
      enabled: () => m.alive && (e.kind !== 'popup' || g.rotation.x > -0.5),
      onHit: (mode, point) => {
        if (!m.alive || done) return false;
        m.alive = false; m.hitT = 0;
        const r = scored(m.kind, point ?? m.pos);
        if (m.kind !== 'friend') fx.wood(Math.min(run.streak, 8));
        if (m.kind === 'gold') sfx.checkpoint();
        chips(point ?? m.pos, m.kind === 'gold' ? ['#f2c54b', '#fff0bd', '#d8a24a'] : m.kind === 'friend' ? ['#ed80b0', '#88b4b5', '#e8b48a'] : m.e.shape === 'blot' ? ['#3b3350', '#6d4fa8', '#2b211f'] : ['#5fb7ad', '#f0a083', '#e4bd83']);
        return !!r;
      } });
    moving.push(m);
  }

  /** Paint chips and drops off a hit (the fluid tool's own dots). */
  function chips(at, tones, n = 18) {
    for (let i = 0; i < n; i++) tool?.drops?.add({ pos: at, vel: _v.randomDirection().multiplyScalar(1.5 + Math.random() * 3).add(_w.set(0, 2.2, 1.2)), drag: 2, grav: 9, size: 0.035 + Math.random() * 0.04, stretch: 1.5, life: 0.5 + Math.random() * 0.4, color: tones[i % tones.length] });
  }

  /** A cutout gone: off the targets, out of the scene, its shapes freed (the paints are shared). */
  function drop(m) { m.off(); m.g.removeFromParent(); m.g.traverse((o) => o.geometry?.dispose()); }

  function updateMoving(dt) {
    for (const m of moving) {
      m.t += dt;
      const e = m.e;
      if (m.alive) {
        if (e.kind === 'rail') {
          const R = RAILS[e.row];
          m.x += m.dir * e.speed * dt;
          m.g.position.x = m.x;
          m.art.position.y = 0.05 + Math.abs(Math.sin(m.t * (e.row ? 5 : 3.6))) * 0.1;
          m.art.rotation.z = Math.sin(m.t * 3) * 0.08;
          if (Math.abs(m.x) > R.span + 0.7 && m.t > 1) m.gone = true;
        } else {
          // up, a while, back down
          const rise = 0.16, k = m.t < rise ? m.t / rise : m.t < rise + m.upFor ? 1 : 1 - (m.t - rise - m.upFor) / rise;
          m.g.rotation.x = -Math.PI / 2 * (1 - Math.max(0, Math.min(1, k)));
          if (m.t > m.upFor + rise * 2) m.gone = true;
          if (Math.abs(m.t - rise - m.upFor) < dt) fx.clack();
        }
        if (e.gold && Math.random() < dt * 14) tool?.glow?.add({ pos: m.art.getWorldPosition(_v), vel: _w.randomDirection().multiplyScalar(0.6), drag: 2, size: 0.04, life: 0.5, color: '#fff0bd', grow: true });
      } else {
        // hit: knocked flat backward with a spin
        m.hitT += dt;
        const k = Math.min(1, m.hitT / 0.28);
        if (e.kind === 'rail') { m.art.rotation.x = -k * Math.PI / 2; m.g.position.x += m.dir * e.speed * dt * (1 - k); }
        else m.g.rotation.x = -k * Math.PI / 2;
        m.art.rotation.y += dt * 9 * (1 - k);
        if (m.hitT > 0.5) m.gone = true;
      }
    }
    for (const m of moving) if (m.gone) drop(m);
    for (let i = moving.length - 1; i >= 0; i--) if (moving[i].gone) moving.splice(i, 1);
  }

  // ------------------------------------------------ the plates and the bells (they stay in the booth)
  for (const p of S.plates) {
    p.down = 0; p.model.visible = true; p.model.scale.setScalar(1); p.shards?.forEach((s) => s.removeFromParent()); p.shards = [];
    offs.push(registerTarget({ kind: 'gallery', radius: 0.4, position: () => p.at, enabled: () => p.down === 0 && p.model.visible,
      onHit: (mode, point) => {
        if (p.down || done) return false;
        p.down = 5.5;
        p.model.visible = false;
        scored('plate', point ?? p.at);
        fx.smash();
        if (Math.random() < 0.3) call('plate');
        const P = paints();
        for (let i = 0; i < 7; i++) {
          const s = new THREE.Mesh(new THREE.CircleGeometry(0.14, 3, i, 1.2), i % 3 ? P.cream : P.blue);
          s.position.copy(p.at); s.userData.vel = new THREE.Vector3((Math.random() - 0.5) * 4, 2 + Math.random() * 3, 1 + Math.random() * 2.5); s.userData.spin = new THREE.Vector3(Math.random() * 12, Math.random() * 12, 0);
          deco(s); root.add(s); p.shards.push(s);
        }
        return true;
      } }));
  }
  for (const b of S.bells) {
    b.amp = 0.18; b.cool = 0; b.flash = 0;
    offs.push(registerTarget({ kind: 'gallery', radius: 0.42, position: () => b.model.bell.getWorldPosition(b.at ??= new THREE.Vector3()), enabled: () => b.cool === 0,
      onHit: (mode, point) => {
        if (b.cool || done) return false;
        b.cool = 1.3; b.flash = 1; b.amp = Math.min(0.62, b.amp + 0.24);
        scored('bell', point ?? b.at);
        sound?.bell?.();
        if (Math.random() < 0.35) call('bell');
        return true;
      } }));
  }

  function updateStall(dt) {
    for (const p of S.plates) {
      if (p.down > 0) {
        p.down = Math.max(0, p.down - dt);
        if (p.down === 0) { p.model.visible = true; p.grow = 0; sfx.coin(1); for (const sh of p.shards) { sh.removeFromParent(); sh.geometry.dispose(); } p.shards = []; }
      }
      if (p.grow !== undefined && p.grow < 1) { p.grow = Math.min(1, p.grow + dt * 3); p.model.scale.setScalar(0.2 + 0.8 * p.grow); }
      p.model.plate.rotation.y += p.spin * dt;
      p.model.plate.rotation.x = 0.95 + Math.sin(t * 2.1 + p.spin) * 0.08;   // (tipped toward the counter: its face to the shooter)
      p.model.plate.rotation.z = Math.cos(t * 1.7 + p.spin) * 0.05;
      for (const s of p.shards) {
        const v = s.userData.vel; v.y -= 9.8 * dt; s.position.addScaledVector(v, dt);
        s.rotation.x += s.userData.spin.x * dt; s.rotation.y += s.userData.spin.y * dt;
        if (s.position.y < 0.05) { s.position.y = 0.05; v.multiplyScalar(0.3); v.y = 0; s.userData.spin.multiplyScalar(0.2); }
      }
    }
    for (const b of S.bells) {
      b.cool = Math.max(0, b.cool - dt);
      b.flash = Math.max(0, b.flash - dt * 2.5);
      b.amp += (0.18 - b.amp) * (1 - Math.exp(-0.35 * dt));
      const a = swing(t, b.amp, b.T, b.p);
      const x = b.x + Math.sin(a) * b.len, y = b.top - Math.cos(a) * b.len;
      b.model.position.set(x, y, b.z);
      b.model.rotation.z = a;
      b.model.cord.position.y = b.len / 2 + 0.2; b.model.cord.scale.y = b.len;
      b.model.clap.position.x = Math.sin(t * 9) * 0.05 * b.flash;
      b.model.bell.scale.setScalar(1 + b.flash * 0.15);
    }
    // the bulbs chase round the sign
    S.bulbs.forEach((bl, i) => { bl.visible = ((i + Math.floor(t * 6)) % 3) !== 0; });
    // the keeper: bobs as he talks, the trumpet up to his mouth
    const K = S.keeper;
    K.talk = Math.max(0, (K.talk ?? 0) - dt);
    const talk = Math.min(1, K.talk * 2);
    K.body.position.y = 0.85 + Math.abs(Math.sin(t * 9)) * 0.04 * talk + Math.sin(t * 1.4) * 0.01;
    K.body.rotation.z = Math.sin(t * 0.9) * 0.04;
    K.arms[1].rotation.x = -1.5 * talk - 0.1;
    K.arms[1].rotation.z = 0.25 - 0.5 * talk;
    K.arms[0].rotation.z = -0.25 - 0.6 * talk * (0.5 + 0.5 * Math.sin(t * 6));
    K.head.rotation.x = -0.15 * talk;
    say.place(_v.copy(K.group.position).add(_w.set(0.9, 2.75, 0.4)));
  }

  // the shots: counted as they leave the glove; a shot that meets nothing is a miss
  offs.push(tool?.state?.on?.('tool:fire', (e) => { if (e?.mode === 'shoot' && ctx.phase === 'play') { ledger.fired(clock); run.shots++; } }) ?? (() => {}));

  call('start', true);

  return {
    update(dt, inp, { live, phase }) {
      t += dt;
      if (live) {
        clock += dt;
        for (const e of director.step(dt)) spawn(e);
        const misses = ledger.update(clock);
        for (let i = 0; i < misses; i++) {
          const r = scoreHit(run, 'miss');
          missRun++;
          if (r.broke) { ctx.flash('Combo broken', 'bad', 0.9); sfx.miss(); }
        }
        if (missRun >= 3) { call('misses'); missRun = 0; }
        if (!saidFinal && clock > GALLERY.time - GALLERY.final) { saidFinal = true; call('final', true); ctx.flash('Last round: golds out!', 'good big', 1.6); }
        if (!saidTen && clock > GALLERY.time - 10) { saidTen = true; call('ten', true); }
        if ((idleT -= dt) <= 0) call('idle');
        if (clock >= GALLERY.time && !done) {
          done = true;
          const acc = run.shots ? Math.round((run.hits + run.friends) / run.shots * 100) : 0;
          call(run.score >= 900 ? 'good' : 'meh', true);
          ctx.finish({ title: 'Time!', lines: [
            `Hits ${run.hits} · misses ${run.misses} · ${acc}% of ${run.shots} shots on a target`,
            `Best run ${run.bestStreak} in a row · top multiplier ×${run.maxMult}`,
            `Golds ${run.golds} · bells rung ${run.bells} · plates broken ${run.plates}`,
            run.friends ? `Friends splashed: ${run.friends} (−${-GALLERY.points.friend} each)` : 'Not one friend splashed',
          ] });
        }
      }
      updateMoving(dt);
      updateStall(dt);
      words.update(dt);
      // the traveller stays behind the counter
      const p = player.pos;
      if (!player.dead) {
        const x = Math.max(-STAND.x, Math.min(STAND.x, p.x)), z = Math.max(STAND.z[0], Math.min(STAND.z[1], p.z));
        if (x !== p.x || z !== p.z) { p.x = x; p.z = z; player.object?.position.set(p.x, p.y, p.z); }
      }
      // the status: the multiplier and the stall's six shots
      const mult = comboMult(run.streak), ink = tool?.reserve ? `${'●'.repeat(tool.reserve.charges)}${'○'.repeat(Math.max(0, tool.reserve.max - tool.reserve.charges))}` : '';
      ctx.status(phase === 'intro' ? null : `${run.score} pts${mult > 1 ? ` ×${mult}` : ''}  ${ink}`);
    },
    end() {
      for (const m of moving) drop(m);
      moving.length = 0;
      for (const off of offs) off?.();
      for (const p of S.plates) { p.shards?.forEach((s) => s.removeFromParent()); p.shards = []; p.model.visible = true; }
      words.dispose();
      giveBack();
    },
  };
}

export default {
  id: 'gallery', order: 3,
  name: 'The shooting gallery',
  blurb: 'A fairground stall of the Signal Market: painted fish and birds on the rails, ink blots popping up, plates, bells, and a minute on the clock.',
  rules: 'Splash every target you can in 60 s. Hits in a row raise the multiplier (×2 after three, up to ×5); a miss ends the run. Gold is worth 100. Never splash the market’s folk with their parasols and cats: −50.',
  drives: false,
  controls: {
    pad: [['LT / L2', 'aim'], ['RT / R2', 'fire (six shots, full again a second after the last)'], ['Right stick', 'look'], ['Left stick', 'step along the counter'], ['Menu', 'pause']],
    keys: [['Right mouse / R', 'aim'], ['Left mouse', 'fire (six shots, full again a second after the last)'], ['Mouse', 'look'], ['WASD', 'step along the counter'], ['Esc', 'pause']],
    touch: [['Aim and ◎', 'fire'], ['Drag', 'look']],
  },
  score: { kind: 'points', unit: 'pts' },
  hud: { timer: true, score: true, countdown: GALLERY.time },
  color: '#f2c54b',
  build: buildGallery,
  start,
};
