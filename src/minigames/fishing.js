// Fishing (docs/systems/minigames.md): a calm game at the end of a pier over the Still Oasis. Three
// minutes; cast with a power meter (hold and let go of A / ×), wait for a bite (the float bobs, rings
// spread), strike as it goes under, then play the fish in: RT / R2 reels, the line glows red when it is
// close to breaking (ease off), and the stick pulled against the fish's runs tires it and spares the
// line. Eight strange kinds live in the pond, each with its size and its ways (shallow or deep, runs
// long or short, leaps, sulks); the score is the weight landed, and a small journal (in the save) keeps
// every kind caught and its heaviest.
//
// The rules are pure (tests/minigames.test.js): castPower, castDistance, biteSchedule, hookResult,
// fightStep (the tension, the line, the fish's runs and stamina), recordCatch (the journal).

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeMaterial, MODE_TERRAIN, MODE_WATER, MODE_STRATA } from '../materials.js';
import { Terrain } from '../world.js';
import { arenaLevel } from './kit/world.js';
import { inputKind, escapeHtml } from '../prompt-keys.js';

// ------------------------------------------------------------------ the fish
/**
 * Each kind: its weight range (kg), where it lives (zone), how often it is the one that comes (chance),
 * how hard it pulls (0..1), how fast it runs (m/s), its stamina (× the time it takes to tire), how long
 * it rests and runs, how often a run turns the other way, the nibbles before it bites, the strike's
 * window (s), whether it leaps.
 */
export const SPECIES = [
  { id: 'glassfin', name: 'Glass minnow', note: 'You see its heart beating through it.', w: [0.1, 0.4], zone: 'shallow', chance: 26, pull: 0.32, speed: 2.4, stamina: 0.5, rest: [0.6, 1.4], run: [0.4, 0.9], turns: 0.55, nibbles: [0, 2], window: 0.4, len: 0.2 },
  { id: 'lantern', name: 'Lantern carp', note: 'A lamp hangs under its chin. It lights the way down.', w: [1, 3.2], zone: 'mid', chance: 20, pull: 0.55, speed: 1.6, stamina: 1.2, rest: [1.6, 3], run: [1, 2], turns: 0.25, nibbles: [1, 3], window: 0.55, len: 0.55 },
  { id: 'ribbon', name: 'Ribbon eel', note: 'It writes letters in the water, never the same twice.', w: [0.8, 2.4], zone: 'shallow', chance: 14, pull: 0.6, speed: 2.7, stamina: 0.9, rest: [0.5, 1.1], run: [0.5, 1], turns: 0.85, nibbles: [0, 1], window: 0.34, len: 1.1 },
  { id: 'whistler', name: 'Whistling perch', note: 'It whistles as it leaps. Let the line go slack when it does.', w: [0.5, 1.7], zone: 'mid', chance: 14, pull: 0.5, speed: 2.1, stamina: 1.0, rest: [1, 2.2], run: [0.7, 1.4], turns: 0.45, nibbles: [1, 2], window: 0.42, len: 0.45, leaps: 0.55 },
  { id: 'bishop', name: 'Bishop fish', note: 'It wears its mitre even at the bottom of the pond.', w: [2, 5], zone: 'deep', chance: 10, pull: 0.72, speed: 1.2, stamina: 1.8, rest: [1.5, 3], run: [2, 3.5], turns: 0.15, nibbles: [2, 3], window: 0.5, len: 0.8 },
  { id: 'skyeye', name: 'Sky-eye ray', note: 'Its one eye looks up, always, at something we cannot see.', w: [3, 6.5], zone: 'deep', chance: 8, pull: 0.7, speed: 2.5, stamina: 1.5, rest: [1.2, 2.4], run: [1.5, 2.6], turns: 0.5, nibbles: [1, 2], window: 0.46, len: 1.0 },
  { id: 'shellback', name: 'Shellback', note: 'An old shell of plates, and a fish somewhere inside it.', w: [5, 9], zone: 'deep', chance: 6, pull: 0.88, speed: 1.0, stamina: 2.3, rest: [1.4, 2.8], run: [1.6, 3], turns: 0.3, nibbles: [2, 4], window: 0.6, len: 0.9 },
  { id: 'hermit', name: 'The Old Hermit', note: 'A whiskered giant with a little house on its back. Who lives there?', w: [11, 16], zone: 'deep', chance: 2, pull: 1.0, speed: 1.9, stamina: 2.8, rest: [1, 2], run: [2, 3.2], turns: 0.4, nibbles: [3, 4], window: 0.5, len: 1.6, leaps: 0.15 },
];
export const speciesById = (id) => SPECIES.find((s) => s.id === id) ?? null;

export const SESSION = { secs: 180 };
export const FIGHT = {
  red: 0.8,        // the line glows red over this
  strain: 5,       // how fast the red strains it (× over the red, per s): 1 → it snaps
  relax: 0.7,      // and how fast it recovers
  slack: 2.2,      // s of a slack line before the fish throws the hook
  slackAt: 0.08,
  reel: 2.6,       // m/s reeled in at full RT / R2 (less as the line tightens)
  maxLine: 40, land: 1.3,
};

// ------------------------------------------------------------------ the cast (pure)
/** The power meter while A / × is held for t s: up and down, 0..1 (1.3 s a full swing). */
export function castPower(t, period = 1.3) {
  const u = ((t / period) % 2 + 2) % 2;
  return u <= 1 ? u : 2 - u;
}
/** How far the float flies at a power (m from the pier's end). */
export const castDistance = (p) => 4 + 18 * Math.max(0, Math.min(1, p));

/** A kind drawn by chance among those living at a zone (rng() 0..1). */
export function pickSpecies(zone, rng = Math.random) {
  const list = SPECIES.filter((s) => s.zone === zone || (zone === 'mid' && s.zone !== 'deep') || (zone === 'deep' && s.zone === 'mid'));
  const tot = list.reduce((a, s) => a + s.chance, 0);
  let r = rng() * tot;
  for (const s of list) { if ((r -= s.chance) <= 0) return s; }
  return list[list.length - 1];
}

/** A fish's weight, its kind's range, the heavy ones rarer (kg, one decimal). */
export function rollWeight(sp, rng = Math.random) {
  const u = rng() ** 1.6;
  return Math.round((sp.w[0] + (sp.w[1] - sp.w[0]) * u) * 10) / 10;
}

/** A fish come to the float: when it nibbles (s after it got there) and when it takes the bait. */
export function biteSchedule(sp, rng = Math.random) {
  const n = sp.nibbles[0] + Math.floor(rng() * (sp.nibbles[1] - sp.nibbles[0] + 1));
  const nibbles = [];
  let t = 0.6 + rng() * 1.2;
  for (let i = 0; i < n; i++) { nibbles.push(t); t += 0.55 + rng() * 0.7; }
  return { nibbles, bite: t + 0.3 + rng() * 0.6, window: sp.window };
}

/** The strike: pressed at t (s) for a bite at `bite` with `window` s to answer. */
export function hookResult(t, bite, window) {
  if (t < bite) return 'early';
  return t - bite <= window ? 'hooked' : 'late';
}

// ------------------------------------------------------------------ the fight (pure)
export function newFight(sp, dist, rng = Math.random) {
  return { sp, dist, tension: 0.3, stamina: 1, strain: 0, slack: 0, running: false, dir: rng() < 0.5 ? -1 : 1, left: 0.5 + rng(), t: 0, angle: 0 };
}

/**
 * One step of the fight: F changes in place; returns what happened
 * ([{ kind: 'run' | 'rest' | 'leap' | 'landed' | 'snap' | 'slip' }]).
 * inp: { reel 0..1 (RT / R2), pull -1..1 (the stick across: > 0 right) }
 */
export function fightStep(F, inp, dt, rng = Math.random, K = FIGHT) {
  const ev = [], sp = F.sp;
  F.t += dt;
  // the fish: rests, runs (one way or the other), tires
  F.left -= dt;
  if (F.left <= 0) {
    F.running = !F.running;
    const range = F.running ? sp.run : sp.rest, tired = 0.45 + 0.55 * F.stamina;
    F.left = (range[0] + rng() * (range[1] - range[0])) * (F.running ? tired : 1 / tired);
    if (F.running) {
      if (rng() < sp.turns) F.dir = -F.dir;
      ev.push({ kind: 'run', dir: F.dir });
      if (sp.leaps && rng() < sp.leaps) {
        ev.push({ kind: 'leap' });
        F.leap = 0.9;
      }
    } else ev.push({ kind: 'rest' });
  }
  const reel = Math.max(0, Math.min(1, inp.reel ?? 0));
  const against = F.running ? Math.max(-1, Math.min(1, -(inp.pull ?? 0) * F.dir)) : 0;   // (> 0: the rod held against the run)
  const P = sp.pull * (F.running ? 0.5 + 0.5 * F.stamina : 0.22);
  let target = reel * (0.22 + 0.78 * P) * (1 - 0.5 * Math.max(0, against)) + (F.running ? P * 0.38 * (1 + 0.6 * Math.max(0, -against)) : 0);
  if (F.leap > 0) {   // in the air: the line jerks, unless you give it slack
    F.leap -= dt;
    target += 0.75 * reel;
  }
  F.tension += (target - F.tension) * (1 - Math.exp(-5 * dt));
  // the line: reeled in, taken out by a run
  const out = F.running ? sp.speed * (0.35 + 0.65 * F.stamina) * (1 - 0.65 * Math.max(0, against)) : 0.15;
  const inn = reel * K.reel * (1 - 0.35 * Math.min(1, F.tension)) * (F.running ? 0.55 : 1);
  F.dist = Math.max(0, F.dist + (out - inn) * dt);
  if (F.running) F.angle += F.dir * sp.speed * 0.5 * dt / Math.max(F.dist, 3);
  F.angle = Math.max(-0.95, Math.min(0.95, F.angle));
  // it tires: faster on a tight line and held against
  F.stamina = Math.max(0, F.stamina - dt * (0.035 + 0.3 * F.tension + 0.3 * Math.max(0, against) * (F.running ? 1 : 0)) / (sp.stamina * 4));
  // the red strains the line; slack lets the fish go
  if (F.tension > K.red) F.strain += dt * (F.tension - K.red) * K.strain;
  else F.strain = Math.max(0, F.strain - dt * K.relax);
  F.slack = F.tension < K.slackAt ? F.slack + dt : 0;
  if (F.strain >= 1) ev.push({ kind: 'snap' });
  else if (F.dist > K.maxLine) ev.push({ kind: 'snap', why: 'line' });
  else if (F.slack > K.slack) ev.push({ kind: 'slip' });
  else if (F.dist <= K.land) ev.push({ kind: 'landed' });
  return ev;
}

/** A player that plays fish well: reels while the line is easy, eases off in the red, pulls against the runs. */
export function botFight(F) {
  const red = F.tension > 0.66 || F.leap > 0;
  return { reel: red ? 0 : F.running ? 0.65 : 1, pull: F.running ? -F.dir : 0 };
}

// ------------------------------------------------------------------ the journal (pure)
export const JOURNAL = 'minigame.fishing.journal';
/** A fish landed into the journal ({ id: { n, best } }): a new journal, and whether it was a new kind or a record. */
export function recordCatch(journal, id, kg) {
  const was = journal?.[id];
  const next = { ...(journal ?? {}), [id]: { n: (was?.n ?? 0) + 1, best: Math.max(was?.best ?? 0, kg) } };
  return { journal: next, isNew: !was, isRecord: !!was && kg > was.best };
}

// ------------------------------------------------------------------ the pond
export const POND = {
  shore: (th) => 27 + 3 * Math.sin(3 * th + 0.4) + 2 * Math.sin(5 * th + 1.7),
  pierEnd: 11, pierStart: 36, deck: 0.82,
  zoneAt(x, z) { const r = Math.hypot(x, z), R = POND.shore(Math.atan2(z, x)); return r < R * 0.42 ? 'deep' : r < R * 0.72 ? 'mid' : 'shallow'; },
};
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/** The ground round the oasis: the pond's bed, its beach, the dunes. */
export function oasisHeight(x, z) {
  const r = Math.hypot(x, z), R = POND.shore(Math.atan2(z, x));
  if (r < R) return -0.25 - 4.4 * smooth(0, 12, R - r);
  const out = r - R;
  return Math.min(1.4, out * 0.1) + 7 * smooth(14, 70, out) * (0.7 + 0.3 * Math.sin(x / 19 + z / 31)) + 3 * smooth(30, 90, out) * Math.sin(x / 13 - z / 17);
}

// ------------------------------------------------------------------ the oasis, built
const INK = '#2b211f';
const tag = (m) => { m.userData.noCollide = true; return m; };

function palm(x, z, y, h, lean, turn) {
  const trunk = [], fronds = [];
  let px = x, py = y, pz = z;
  const segs = 7;
  for (let i = 0; i < segs; i++) {
    const t = (i + 1) / segs, nx = x + Math.sin(turn) * lean * t * t * h, nz = z + Math.cos(turn) * lean * t * t * h, ny = y + t * h;
    const len = Math.hypot(nx - px, ny - py, nz - pz), r = 0.26 - 0.1 * t;
    const g = new THREE.CylinderGeometry(r * 0.92, r, len, 7).translate(0, len / 2, 0);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(nx - px, ny - py, nz - pz).normalize());
    g.applyQuaternion(q).translate(px, py, pz);
    trunk.push(g.toNonIndexed());
    px = nx; py = ny; pz = nz;
  }
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2 + turn, L = 3.2 + (k % 3) * 0.5;
    const g = new THREE.ConeGeometry(0.55, L, 4, 1).scale(1, 1, 0.18).translate(0, L / 2, 0).rotateX(Math.PI / 2 + 0.5 + (k % 2) * 0.25).rotateY(a).translate(px, py, pz);
    fronds.push(g.toNonIndexed());
  }
  return { trunk, fronds };
}

function* buildOasis(scene) {
  const terrain = yield* Terrain.make({
    size: 300, seg: 300, height: oasisHeight,
    material: { color: '#efd29b', color2: '#f5e1b6', color3: '#dca57a', mode: MODE_TERRAIN, ripples: true, sandInk: true },
  });
  scene.add(terrain.mesh);
  yield;
  const H = (x, z) => terrain.heightAt(x, z);
  // the water: one still body, its bed and its shore drawn by the water's own look (src/water-shader.js)
  const water = new THREE.Mesh(new THREE.CircleGeometry(36, 72).rotateX(-Math.PI / 2), makeMaterial({ color: '#4fb8b4', color2: '#9fe0d2', mode: MODE_WATER, flat: true }));
  water.userData.noCollide = true;
  scene.add(water);
  const wood = makeMaterial({ color: '#b07a4c', color2: '#946038' });
  const woodDark = makeMaterial({ color: '#7d5132', flat: true });
  const ink = makeMaterial({ color: INK, flat: true });

  // the pier: planks on posts, out from the south beach over the water
  const planks = [], posts = [];
  const P = POND;
  for (let z = P.pierEnd; z < P.pierStart; z += 0.34) planks.push(new THREE.BoxGeometry(2.3 + ((z * 7) % 1) * 0.12, 0.09, 0.3).rotateY(((z * 13) % 1 - 0.5) * 0.03).translate(0, P.deck - 0.045, z + 0.17).toNonIndexed());
  for (const side of [-1, 1]) planks.push(new THREE.BoxGeometry(0.16, 0.18, P.pierStart - P.pierEnd).translate(side * 1.05, P.deck - 0.16, (P.pierStart + P.pierEnd) / 2).toNonIndexed());
  for (let z = P.pierEnd + 0.15; z < P.pierStart; z += 3.1) for (const side of [-1, 1]) {
    const bed = H(side * 1.05, z), h = P.deck + 0.05 - bed + 0.6;
    posts.push(new THREE.CylinderGeometry(0.11, 0.13, h, 6).translate(side * 1.05, bed - 0.6 + h / 2, z).toNonIndexed());
  }
  // a mooring post with a lantern at the end, a basket for the catch
  posts.push(new THREE.CylinderGeometry(0.1, 0.12, 1.6, 6).translate(-1.0, P.deck + 0.8, P.pierEnd + 3.8).toNonIndexed());
  scene.add(tag(new THREE.Mesh(mergeGeometries(planks), wood)));   // (the deck stays out of the collision: the water's bed is baked under it, src/water.js)
  scene.add(new THREE.Mesh(mergeGeometries(posts), woodDark));
  const lamp = tag(new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 6), makeMaterial({ color: '#f6c84e', glow: 1, flat: true })));
  lamp.position.set(-1.0, P.deck + 1.72, P.pierEnd + 3.8);
  const hood = tag(new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.18, 8).translate(0, 0.16, 0), ink));
  hood.position.copy(lamp.position);
  const basket = tag(new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.2, 0.32, 10, 1, true), makeMaterial({ color: '#d8b06a', color2: '#c39a55', side: THREE.DoubleSide })));
  basket.position.set(-0.75, P.deck + 0.16, P.pierEnd + 0.9);
  scene.add(lamp, hood, basket);
  yield;

  // the palms round the shore, reeds at the water's edge, lily pads
  const trunks = [], fronds = [], reeds = [], pads = [];
  for (let i = 0; i < 17; i++) {
    const th = (i / 17) * Math.PI * 2 + Math.sin(i * 2.3) * 0.12;
    if (Math.abs(th - Math.PI / 2) < 0.22) continue;   // (not in the pier's way)
    const R = P.shore(th) + 3 + (i * 7) % 6, x = Math.cos(th) * R, z = Math.sin(th) * R;
    const p = palm(x, z, H(x, z) - 0.2, 7 + (i * 5) % 5, 0.35 + (i % 3) * 0.12, th + Math.PI + Math.sin(i) * 0.4);
    trunks.push(...p.trunk); fronds.push(...p.fronds);
  }
  for (let i = 0; i < 70; i++) {
    const th = (i / 70) * Math.PI * 2 + Math.sin(i * 7.1) * 0.05;
    if (Math.abs(th - Math.PI / 2) < 0.14) continue;
    const R = P.shore(th) - 0.6 + Math.sin(i * 3.7) * 0.8, x = Math.cos(th) * R, z = Math.sin(th) * R;
    for (let k = 0; k < 3; k++) {
      const h = 1.1 + ((i + k) * 13 % 7) * 0.12;
      reeds.push(new THREE.ConeGeometry(0.035, h, 4).translate(0, h / 2, 0).rotateZ((k - 1) * 0.16).translate(x + (k - 1) * 0.18, -0.3, z + ((k * 5) % 3 - 1) * 0.15).toNonIndexed());
    }
  }
  const padShape = new THREE.Shape();
  padShape.absarc(0, 0, 1, 0.35, Math.PI * 2 - 0.05, false); padShape.lineTo(0, 0);
  for (let i = 0; i < 26; i++) {
    const th = (i / 26) * Math.PI * 2 + Math.sin(i * 1.7) * 0.2, R = P.shore(th) * (0.62 + 0.3 * ((i * 37) % 10) / 10);
    const x = Math.cos(th) * R, z = Math.sin(th) * R;
    if (Math.abs(x) < 3 && z > 4) continue;   // (the water in front of the pier left clear)
    const s = 0.35 + ((i * 3) % 5) * 0.12;
    pads.push(new THREE.ShapeGeometry(padShape, 10).rotateX(-Math.PI / 2).scale(s, 1, s).rotateY(i * 1.3).translate(x, 0.025, z).toNonIndexed());
  }
  scene.add(tag(new THREE.Mesh(mergeGeometries(trunks), makeMaterial({ color: '#a2774f', color2: '#8a6040' }))));
  scene.add(tag(new THREE.Mesh(mergeGeometries(fronds), makeMaterial({ color: '#5f9a5a', color2: '#79b46a', side: THREE.DoubleSide }))));
  scene.add(tag(new THREE.Mesh(mergeGeometries(reeds), makeMaterial({ color: '#8fa45a', color2: '#a6b86a' }))));
  const padMesh = tag(new THREE.Mesh(mergeGeometries(pads), makeMaterial({ color: '#6fae6a', color2: '#87c27a', flat: true })));
  padMesh.userData.water = false;
  scene.add(padMesh);
  yield;

  // across the water: two leaning monoliths and a stone ring, the makers' (where the deep fish keep to)
  const stone = makeMaterial({ color: '#c9a27e', color2: '#b98d6a', color3: '#9c7457', mode: MODE_STRATA, strataSize: 2.4 });
  const rocks = [];
  rocks.push(new THREE.BoxGeometry(2.2, 11, 1.6).translate(0, 5.5, 0).rotateZ(0.12).rotateY(0.4).translate(-9, H(-9, -31) - 0.5, -31).toNonIndexed());
  rocks.push(new THREE.BoxGeometry(1.8, 8.5, 1.4).translate(0, 4.25, 0).rotateZ(-0.2).rotateY(-0.3).translate(-4.5, H(-4.5, -32.5) - 0.5, -32.5).toNonIndexed());
  rocks.push(new THREE.TorusGeometry(4.2, 0.85, 8, 28).translate(0, 4.6, 0).rotateY(0.25).translate(9, H(9, -30.5) - 1, -30.5).toNonIndexed());
  for (let i = 0; i < 6; i++) {   // (far mesas, for the eye)
    const a = -Math.PI / 2 + (i - 2.5) * 0.45, R = 120 + (i * 17) % 30, x = Math.cos(a) * R, z = Math.sin(a) * R, h = 18 + (i * 11) % 22;
    rocks.push(new THREE.CylinderGeometry(9 + (i % 3) * 4, 13 + (i % 3) * 4, h, 10).translate(x, H(x, z) + h / 2 - 2, z).toNonIndexed());
  }
  scene.add(tag(new THREE.Mesh(mergeGeometries(rocks), stone)));
  // a striped awning at the pier's foot, a crate under it
  const cloth = makeMaterial({ color: '#d9643a', side: THREE.DoubleSide }), cream = makeMaterial({ color: '#f7ecd2', side: THREE.DoubleSide });
  const aw = new THREE.Group();
  for (let k = 0; k < 6; k++) {
    const b = tag(new THREE.Mesh(new THREE.PlaneGeometry(0.6, 3.2).rotateX(-Math.PI / 2 + 0.28), k % 2 ? cream : cloth));
    b.position.set(-1.5 + k * 0.6, 2.5, 0); aw.add(b);
  }
  for (const sx of [-1.75, 1.75]) for (const sz of [-1.4, 1.4]) { const p = tag(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.6 + (sz < 0 ? 0.45 : -0.45), 5), woodDark)); p.position.set(sx, (2.6 + (sz < 0 ? 0.45 : -0.45)) / 2, sz); aw.add(p); }
  aw.position.set(3.6, H(3.6, P.pierStart + 1), P.pierStart + 1);
  scene.add(aw);
  yield;

  const end = new THREE.Vector3(0, P.deck, P.pierEnd + 0.6);
  return arenaLevel({
    ground: terrain, name: 'The Still Oasis', hour: 17.2,
    spawn: end.clone(),
    features: { mount: false, wind: true, jetpack: false, climb: false },
    oasis: { H, basket },
  });
}

// ------------------------------------------------------------------ the fish, drawn
const _V = (x, y, z) => new THREE.Vector3(x, y, z);
function eye(g, x, y, z, r = 0.035) {
  const w = new THREE.Mesh(new THREE.SphereGeometry(r, 8, 6), makeMaterial({ color: '#fbf4e2', flat: true }));
  const p = new THREE.Mesh(new THREE.SphereGeometry(r * 0.5, 6, 4), makeMaterial({ color: INK, flat: true }));
  w.position.set(x, y, z); p.position.set(x + Math.sign(x) * r * 0.6, y, z + r * 0.3);
  g.add(w, p);
}
function fin(color, pts, thick = 0.01) {
  const s = new THREE.Shape(pts.map(([a, b]) => new THREE.Vector2(a, b)));
  return new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth: thick, bevelEnabled: false }).translate(0, 0, -thick / 2), makeMaterial({ color, side: THREE.DoubleSide }));
}

/** A fish's model, about its length (m) long, nose toward +z, its back up. */
export function fishModel(sp, kg = (sp.w[0] + sp.w[1]) / 2) {
  const g = new THREE.Group(), k = Math.cbrt(kg / ((sp.w[0] + sp.w[1]) / 2)), L = sp.len * k;
  const body = (color, sx, sy, sz, opts = {}) => { const m = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10).scale(sx, sy, sz), makeMaterial({ color, ...opts })); g.add(m); return m; };
  const tail = (color, s = 1) => { const t = fin(color, [[0, 0], [0.5, 0.45], [0.38, 0], [0.5, -0.45]]); t.rotation.y = Math.PI / 2; t.scale.setScalar(L * 0.42 * s); t.position.z = -L * 0.42; g.add(t); return t; };
  switch (sp.id) {
    case 'glassfin': { body('#cdeee6', L * 0.16, L * 0.2, L * 0.5, { glow: 0.25 }); const h = new THREE.Mesh(new THREE.SphereGeometry(L * 0.06, 8, 6), makeMaterial({ color: '#e8564a', glow: 0.8, flat: true })); h.position.set(0, -L * 0.02, L * 0.08); g.add(h); tail('#a9dcd2'); eye(g, L * 0.09, L * 0.06, L * 0.3, L * 0.07); break; }
    case 'lantern': {
      body('#e9a14a', L * 0.22, L * 0.26, L * 0.5, { color2: '#d98a3a' }); tail('#d9643a');
      const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, L * 0.3, 4), makeMaterial({ color: INK, flat: true })); stalk.position.set(0, -L * 0.28, L * 0.42); stalk.rotation.x = 0.5; g.add(stalk);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(L * 0.07, 10, 6), makeMaterial({ color: '#f6e27a', glow: 1, flat: true })); lamp.position.set(0, -L * 0.42, L * 0.5); g.add(lamp);
      const top = fin('#d9643a', [[0, 0], [0.3, 0.25], [0.6, 0]]); top.rotation.y = Math.PI / 2; top.scale.setScalar(L * 0.6); top.position.set(0, L * 0.22, L * 0.15); g.add(top);
      eye(g, L * 0.15, L * 0.08, L * 0.32, L * 0.06); break;
    }
    case 'ribbon': {
      const pts = Array.from({ length: 9 }, (_, i) => _V(Math.sin(i * 0.9) * L * 0.06, 0, L * (0.5 - i / 8)));
      g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, L * 0.045, 6), makeMaterial({ color: '#8a6fd0', color2: '#a58ae0' })));
      const crest = fin('#f6c84e', [[0, 0], [1, 0.06], [1, 0], [0, 0]]); crest.rotation.y = -Math.PI / 2; crest.scale.set(L * 0.9, L, 1); crest.position.set(0, L * 0.04, L * 0.45); g.add(crest);
      eye(g, L * 0.035, L * 0.025, L * 0.46, L * 0.03); break;
    }
    case 'whistler': {
      body('#5f9fa8', L * 0.2, L * 0.24, L * 0.5, { color2: '#4e8790' }); tail('#2f6f74');
      for (let i = 0; i < 3; i++) { const b = new THREE.Mesh(new THREE.TorusGeometry(L * 0.215, L * 0.02, 4, 16), makeMaterial({ color: '#f7ecd2', flat: true })); b.position.z = L * (0.12 - i * 0.14); b.scale.y = 1.1; g.add(b); }
      const flute = new THREE.Mesh(new THREE.CylinderGeometry(L * 0.025, L * 0.04, L * 0.4, 6).rotateX(Math.PI / 2), makeMaterial({ color: '#e2b552', metal: 'brass' })); flute.position.z = L * 0.62; g.add(flute);
      eye(g, L * 0.13, L * 0.08, L * 0.32, L * 0.06); break;
    }
    case 'bishop': {
      body('#f2e6cc', L * 0.2, L * 0.25, L * 0.5); tail('#c8483a');
      const mitre = new THREE.Mesh(new THREE.ConeGeometry(L * 0.16, L * 0.5, 4).scale(1, 1, 0.45).translate(0, L * 0.25, 0), makeMaterial({ color: '#c8483a' })); mitre.position.set(0, L * 0.18, L * 0.22); g.add(mitre);
      const band = new THREE.Mesh(new THREE.BoxGeometry(L * 0.04, L * 0.38, L * 0.075), makeMaterial({ color: '#e2b552', metal: 'brass' })); band.position.set(0, L * 0.38, L * 0.22); g.add(band);
      eye(g, L * 0.14, L * 0.06, L * 0.33, L * 0.05); break;
    }
    case 'skyeye': {
      const s = new THREE.Shape([new THREE.Vector2(0, 0.5), new THREE.Vector2(0.55, 0), new THREE.Vector2(0, -0.35), new THREE.Vector2(-0.55, 0)]);
      const ray = new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth: 0.06, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 1 }).rotateX(-Math.PI / 2).scale(L, L, L), makeMaterial({ color: '#3f5fae', color2: '#5672bf' }));
      g.add(ray);
      const whip = new THREE.Mesh(new THREE.CylinderGeometry(L * 0.012, L * 0.004, L * 0.7, 4).rotateX(Math.PI / 2), makeMaterial({ color: INK, flat: true })); whip.position.z = -L * 0.6; g.add(whip);
      const e = new THREE.Mesh(new THREE.SphereGeometry(L * 0.09, 12, 8), makeMaterial({ color: '#fbf4e2', flat: true })); e.position.set(0, L * 0.08, L * 0.1); g.add(e);
      const pu = new THREE.Mesh(new THREE.SphereGeometry(L * 0.05, 8, 6), makeMaterial({ color: '#71d7cf', glow: 0.8, flat: true })); pu.position.set(0, L * 0.15, L * 0.11); g.add(pu); break;
    }
    case 'shellback': {
      body('#6f9a7a', L * 0.3, L * 0.22, L * 0.42); tail('#4f7a5a', 0.8);
      const shell = new THREE.Mesh(new THREE.DodecahedronGeometry(L * 0.36, 0).scale(1, 0.55, 1.15), makeMaterial({ color: '#c99a4e', color2: '#b0843f', flat: true })); shell.position.y = L * 0.1; g.add(shell);
      eye(g, L * 0.17, L * 0.02, L * 0.34, L * 0.05); break;
    }
    case 'hermit': {
      body('#8a7f72', L * 0.2, L * 0.17, L * 0.5, { color2: '#7a6f62' }); tail('#5f564c');
      for (const s of [-1, 1]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.004, L * 0.45, 4).rotateX(Math.PI / 2).rotateY(s * 0.6).translate(s * L * 0.12, -L * 0.04, L * 0.6), makeMaterial({ color: INK, flat: true })); g.add(w); }
      const house = new THREE.Mesh(new THREE.BoxGeometry(L * 0.13, L * 0.11, L * 0.13), makeMaterial({ color: '#f2e6cc' })); house.position.set(0, L * 0.21, -L * 0.02); g.add(house);
      const roof = new THREE.Mesh(new THREE.ConeGeometry(L * 0.12, L * 0.09, 4).rotateY(Math.PI / 4), makeMaterial({ color: '#c8483a' })); roof.position.set(0, L * 0.31, -L * 0.02); g.add(roof);
      const win = new THREE.Mesh(new THREE.PlaneGeometry(L * 0.04, L * 0.04), makeMaterial({ color: '#f6c84e', glow: 1, flat: true })); win.position.set(0, L * 0.21, L * 0.047); g.add(win);
      eye(g, L * 0.13, L * 0.03, L * 0.36, L * 0.035); break;
    }
    default: body('#aaa', L * 0.2, L * 0.25, L * 0.5);
  }
  g.traverse((o) => { o.userData.noCollide = true; });
  g.userData.len = L;
  return g;
}

/** A fish's shadow on the water, a flat printed shape (the pond is drawn opaque: we see their shapes, not them). */
function shadowModel(sp, mat) {
  const L = Math.max(0.5, sp.len * 1.6);
  const s = new THREE.Shape();
  s.moveTo(0, 0.5); s.quadraticCurveTo(0.22, 0.2, 0.08, -0.32); s.lineTo(0.2, -0.5); s.lineTo(-0.2, -0.5); s.lineTo(-0.08, -0.32); s.quadraticCurveTo(-0.22, 0.2, 0, 0.5);
  const w = sp.id === 'skyeye' || sp.id === 'shellback' ? 1.9 : sp.id === 'ribbon' ? 0.45 : 1;
  const m = new THREE.Mesh(new THREE.ShapeGeometry(s, 6).rotateX(-Math.PI / 2).scale(L * w, 1, L), mat);
  m.userData.noCollide = true; m.userData.water = false;
  return m;
}

// ------------------------------------------------------------------ the rod, the line, the float
function rodKit(scene) {
  const rodM = makeMaterial({ color: '#a8683f', color2: '#8c5533' }), lineM = makeMaterial({ color: '#3b2f2a', flat: true });
  const redM = makeMaterial({ color: '#ef5a3a', glow: 1, flat: true });
  const seg = (r0, r1, m) => { const o = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, 1, 5).translate(0, 0.5, 0), m); o.userData.noCollide = true; o.frustumCulled = false; scene.add(o); return o; };
  const rod = Array.from({ length: 6 }, (_, i) => seg(0.022 - i * 0.003, 0.019 - i * 0.003, rodM));
  const reel = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.05, 10).rotateZ(Math.PI / 2), makeMaterial({ color: '#e2b552', metal: 'brass' }));
  reel.userData.noCollide = true; scene.add(reel);
  const line = Array.from({ length: 12 }, () => seg(0.011, 0.011, lineM));
  const float = new THREE.Group();
  const top = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), makeMaterial({ color: '#ef5a3a', glow: 0.35 }));
  const bot = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 6, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), makeMaterial({ color: '#f7ecd2' }));
  const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.26, 4).translate(0, 0.16, 0), makeMaterial({ color: INK, flat: true }));
  float.add(top, bot, stick);
  float.traverse((o) => { o.userData.noCollide = true; });
  scene.add(float);
  const aim = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.15, 32).rotateX(-Math.PI / 2), makeMaterial({ color: '#f7ecd2', glow: 0.5, flat: true, side: THREE.DoubleSide }));
  aim.userData.noCollide = true; aim.userData.water = false; scene.add(aim);
  const all = [...rod, reel, ...line, float, aim];
  const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _d = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0);
  const place = (o, a, b) => { _d.subVectors(b, a); const l = _d.length(); o.position.copy(a); o.quaternion.setFromUnitVectors(_up, l > 1e-6 ? _d.divideScalar(l) : _up); o.scale.set(1, Math.max(l, 1e-4), 1); };
  return {
    all, float, aim,
    /** The rod from the hand along dir, bent toward `pull` by bend (0..1); returns the tip. */
    rod(hand, dir, pull, bend, out) {
      let p = _a.copy(hand);
      reel.position.copy(hand).addScaledVector(dir, 0.18).y -= 0.05;
      const len = [0.6, 0.5, 0.45, 0.4, 0.35, 0.3];
      for (let i = 0; i < rod.length; i++) {
        const k = ((i + 1) / rod.length) ** 1.6 * bend;
        _d.copy(dir).lerp(pull, k).normalize();
        _b.copy(p).addScaledVector(_d, len[i]);
        place(rod[i], p, _b);
        p = p.copy(_b);
      }
      return out.copy(p);
    },
    /** The line from the tip to the float, sagging as much as it is slack. */
    line(tip, end, sag, red) {
      for (let i = 0; i < line.length; i++) {
        const t0 = i / line.length, t1 = (i + 1) / line.length;
        const at = (t, v) => v.copy(tip).lerp(end, t).addScaledVector(_up, -sag * 4 * t * (1 - t));
        place(line[i], at(t0, _a), at(t1, _b));
        line[i].material = red ? redM : lineM;
      }
    },
    show(on) { for (const o of [...line, float]) o.visible = on; },
    remove() { for (const o of all) o.removeFromParent(); },
  };
}

// ------------------------------------------------------------------ the seated traveller
function poseSitting(player, S, t) {
  const c = player.char;
  c.legs[0].rotation.set(-1.5, 0, 0.1);
  c.legs[1].rotation.set(-1.5, 0, -0.1);
  const swing = Math.sin(t * 1.3) * 0.12;
  c.knees[0].rotation.x = 1.25 + swing; c.knees[1].rotation.x = 1.25 - swing;
  for (const f of c.feet) f.rotation.set(0.25, 0, 0);
  c.body.position.set(0, 0, 0);
  c.body.rotation.set(-0.02, 0, 0);
  const lean = S.lean ?? 0;
  c.torso.rotation.set(0.12 + lean * 0.3, S.twist ?? 0, 0);
  // the right arm holds the rod, the left hand works the reel (or lies on the thigh)
  const raise = S.armRaise ?? 0;
  c.arms[0].rotation.set(-0.85 - raise, 0, -0.18);
  c.elbows[0].rotation.x = -0.75 + raise * 0.25;
  const crank = S.cranking ? Math.sin(t * 14) * 0.35 : 0;
  c.arms[1].rotation.set(-0.7 + crank, 0, 0.42);
  c.elbows[1].rotation.x = -1.25 + crank * 0.5;
  c.head.rotation.set(0.05 + (S.look ?? 0), S.headTurn ?? 0, 0);
  c.hatTip.rotation.x = -0.25 + Math.sin(t * 0.9) * 0.05;
  for (const fl of c.flames) fl.visible = false;
  player._gait = null;
}

// ------------------------------------------------------------------ the HUD of its own
const CSS = `
#fishing-hud { position: fixed; inset: 0; pointer-events: none; z-index: 79; color: #2b211f; font: 13px/1.4 ui-monospace, Menlo, monospace; }
#fishing-hud .fh-journal { position: absolute; left: 16px; top: 64px; width: 210px; padding: 7px 10px 8px; background: rgba(247, 236, 210, 0.92); border: 2px solid #2b211f; box-shadow: 4px 4px 0 #2b211f; transform: rotate(-0.6deg); }
#fishing-hud .fh-journal h3 { margin: 0 0 4px; font-size: 11px; letter-spacing: 0.16em; text-transform: uppercase; }
#fishing-hud .fh-journal li { display: flex; justify-content: space-between; gap: 8px; font-size: 11px; line-height: 1.5; color: #4a3b33; }
#fishing-hud .fh-journal li.no { color: #a8988a; }
#fishing-hud .fh-journal li.now { background: #71d7cf; }
#fishing-hud .fh-journal ul { list-style: none; margin: 0; padding: 0; }
#fishing-hud .fh-bottom { position: absolute; left: 50%; bottom: 34px; transform: translateX(-50%); display: flex; flex-direction: column; align-items: center; gap: 8px; }
#fishing-hud .fh-hint { padding: 4px 12px; background: #f7ecd2; border: 2px solid #2b211f; box-shadow: 3px 3px 0 #2b211f; font-weight: 700; white-space: nowrap; }
#fishing-hud .fh-hint:empty { display: none; }
#fishing-hud .fh-hint.now { background: #f2c54b; font-size: 22px; animation: fhnow .25s ease-out; }
@keyframes fhnow { 0% { transform: scale(1.4); } 100% { transform: none; } }
#fishing-hud .fh-meter { position: relative; width: 320px; height: 22px; background: #fbf4e2; border: 2px solid #2b211f; box-shadow: 3px 3px 0 #2b211f; display: none; }
#fishing-hud .fh-meter.on { display: block; }
#fishing-hud .fh-meter i { position: absolute; left: 0; top: 0; bottom: 0; background: #71d7cf; border-right: 2px solid #2b211f; }
#fishing-hud .fh-meter.tension i { background: #9fd08a; }
#fishing-hud .fh-meter.tension.hot i { background: #ef5a3a; }
#fishing-hud .fh-meter b { position: absolute; top: -2px; bottom: -2px; border-left: 2px dashed #2b211f; }
#fishing-hud .fh-meter.tension::after { content: ''; position: absolute; left: 80%; right: 0; top: 0; bottom: 0; background: repeating-linear-gradient(45deg, rgba(217, 100, 58, 0.35) 0 4px, transparent 4px 8px); }
#fishing-hud .fh-meter span { position: absolute; left: 6px; top: 1px; font-size: 11px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; }
#fishing-hud .fh-pull { font: 900 26px/1 ui-monospace, Menlo, monospace; color: #f2c54b; -webkit-text-stroke: 2px #2b211f; paint-order: stroke fill; min-height: 26px; }
#fishing-hud .fh-catch { position: absolute; right: 5%; top: 30%; transform: rotate(-1deg); padding: 10px 20px; background: #f7ecd2; border: 2px solid #2b211f; box-shadow: 6px 6px 0 #2b211f; text-align: center; display: none; max-width: 380px; }
#fishing-hud .fh-catch.on { display: block; animation: fhnow .35s ease-out; }
#fishing-hud .fh-catch h2 { margin: 0; font-size: 20px; letter-spacing: 0.1em; text-transform: uppercase; }
#fishing-hud .fh-catch .kg { font: 900 30px/1.1 ui-monospace, Menlo, monospace; }
#fishing-hud .fh-catch .tag { display: inline-block; margin-top: 4px; padding: 1px 8px; border: 2px solid #d9643a; color: #d9643a; font-weight: 900; letter-spacing: 0.12em; transform: rotate(4deg); }
#fishing-hud .fh-catch p { margin: 4px 0 0; font-size: 11px; color: #4a3b33; }
body.touch #fishing-hud .fh-journal { display: none; }
#fishing-hud.idle .fh-bottom { display: none; }
`;
function hudDom() {
  if (!document.getElementById('fishing-css')) { const st = document.createElement('style'); st.id = 'fishing-css'; st.textContent = CSS; document.head.appendChild(st); }
  const el = document.createElement('div');
  el.id = 'fishing-hud';
  el.innerHTML = `<div class="fh-journal"></div><div class="fh-catch"></div>
    <div class="fh-bottom"><div class="fh-pull"></div><div class="fh-meter"><i></i><span></span></div><div class="fh-hint"></div></div>`;
  document.body.appendChild(el);
  return { el, journal: el.querySelector('.fh-journal'), meter: el.querySelector('.fh-meter'), fill: el.querySelector('.fh-meter i'), label: el.querySelector('.fh-meter span'),
    hint: el.querySelector('.fh-hint'), pull: el.querySelector('.fh-pull'), catch: el.querySelector('.fh-catch') };
}
const btn = (pad, key) => (inputKind() === 'pad' ? pad : inputKind() === 'touch' ? (pad === 'A / ×' ? 'Jump' : pad === 'RT / R2' ? 'the stick up' : pad) : key);

// ------------------------------------------------------------------ the game
const _UP = new THREE.Vector3(0, 1, 0);

function start(ctx) {
  const { player, camera, level, sfx } = ctx;
  const P = POND, O = level.oasis, state = ctx.state;
  const waters = () => ctx.waters ?? globalThis.waters ?? null;
  const rng = Math.random;
  const kit = rodKit(ctx.scene);
  const dom = hudDom();
  const shadowM = makeMaterial({ color: '#1f4a52', flat: true, key: 'fish-shadow' });
  let journal = state?.flag?.(JOURNAL) ?? {};
  const run = { catches: [], lost: 0, snaps: 0, kg: 0, newKinds: [], lastFish: false };
  const seat = new THREE.Vector3(0, P.deck - 0.93, P.pierEnd + 0.62);
  const pierTip = new THREE.Vector3(0, 0, P.pierEnd);
  // the pond's fish: shadows that wander their zones (the one coming to the float swims to it)
  const fishes = [];
  const zonePoint = (zone) => {
    for (let i = 0; i < 40; i++) {
      const a = rng() * Math.PI * 2, R = P.shore(a) * Math.sqrt(rng()) * 0.92, x = Math.cos(a) * R, z = Math.sin(a) * R;
      if (P.zoneAt(x, z) === zone && !(Math.abs(x) < 2.5 && z > P.pierEnd - 1)) return new THREE.Vector3(x, 0.018, z);
    }
    return new THREE.Vector3(0, 0.018, 0);
  };
  function addFish(zone = ['shallow', 'mid', 'deep', 'deep', 'mid'][fishes.length % 5]) {
    const sp = pickSpecies(zone, rng), pos = zonePoint(zone);
    const m = shadowModel(sp, shadowM); m.position.copy(pos);
    ctx.add(m);
    const f = { sp, zone, pos, heading: rng() * Math.PI * 2, mesh: m, mode: 'wander', speed: 0.4 + rng() * 0.3, turn: 0 };
    fishes.push(f);
    return f;
  }
  for (let i = 0; i < 9; i++) addFish();

  // the session's state
  const S = { phase: 'ready', t: 0, aim: 0, power: 0, holdT: 0, target: new THREE.Vector3(), from: new THREE.Vector3(), flightT: 0, flight: 0.8,
    fish: null, plan: null, at: 0, nibbleI: 0, bite: 0, fight: null, show: 0, shown: null, catchT: 0, msgT: 0, armRaise: 0, lean: 0, cranking: false };
  const floatPos = new THREE.Vector3(), tip = new THREE.Vector3(), hand = new THREE.Vector3(), rodDir = new THREE.Vector3(), pull = new THREE.Vector3();
  let t = 0, shownFish = null;
  const cam = { pos: new THREE.Vector3(2.3, P.deck + 2.2, P.pierEnd + 5.2), look: new THREE.Vector3(-0.3, 0.2, P.pierEnd - 8) };

  function drawJournal(now = null) {
    const n = SPECIES.filter((s) => journal[s.id]).length;
    dom.journal.innerHTML = `<h3>Journal · ${n} of ${SPECIES.length}</h3><ul>${SPECIES.map((s) => {
      const j = journal[s.id];
      return j ? `<li class="${s.id === now ? 'now' : ''}"><span>${escapeHtml(s.name)}</span><span>${j.best.toFixed(1)} kg</span></li>` : '<li class="no"><span>· · · · ·</span><span>?</span></li>';
    }).join('')}</ul>`;
  }
  drawJournal();
  const dirOf = (aim, out = new THREE.Vector3()) => out.set(-Math.sin(aim), 0, -Math.cos(aim));
  function hint(text, now = false) { if (dom.hint.textContent !== text) dom.hint.textContent = text; dom.hint.classList.toggle('now', now); }
  function meter(on, k = 0, label = '', cls = '') {
    dom.meter.classList.toggle('on', on);
    if (!on) return;
    dom.meter.className = `fh-meter on ${cls}`;
    dom.fill.style.width = `${Math.round(Math.max(0, Math.min(1, k)) * 100)}%`;
    if (dom.label.textContent !== label) dom.label.textContent = label;
  }
  function ring(x, z, k) { waters()?.ring?.(x, z, k); }
  function splash(pos, k) { waters()?.splash?.(pos, 0, k); }

  function toReady(msg = null, kind = '') {
    if (msg) ctx.flash(msg, kind, 1.5);
    if (S.fish) { S.fish.mode = 'wander'; S.fish.flee = 2.5; }
    S.fish = null; S.fight = null; S.plan = null;
    S.phase = 'retrieve'; S.t = 0;
  }
  function cast() {
    S.phase = 'cast'; S.t = 0;
    const d = castDistance(S.power), dir = dirOf(S.aim);
    S.target.copy(pierTip).addScaledVector(dir, d).setY(0);
    const r = Math.hypot(S.target.x, S.target.z), R = P.shore(Math.atan2(S.target.z, S.target.x)) - 1.5;
    if (r > R) S.target.multiplyScalar(R / r);
    S.from.copy(tip);
    S.flight = 0.45 + 0.45 * S.power;
    sfx.whoosh();
  }
  /** The float has settled: which fish notices it, and how long until it comes. */
  function lookForFish() {
    let best = null, bd = Infinity;
    for (const f of fishes) {
      if (f.mode !== 'wander' || (f.flee ?? 0) > 0) continue;
      const d = f.pos.distanceTo(S.target) + rng() * 3;
      if (d < 8.5 && d < bd) { best = f; bd = d; }
    }
    if (!best) { S.at = 2 + rng() * 2; return; }   // (none near: look again in a moment)
    best.mode = 'come'; best.speed = 0.9 + rng() * 0.6;
    S.fish = best;
  }

  function landFish() {
    const F = S.fight, sp = F.sp, kg = rollWeight(sp, rng);
    const r = recordCatch(journal, sp.id, kg);
    journal = r.journal;
    state?.set?.(JOURNAL, journal);
    run.catches.push({ sp, kg }); run.kg += kg;
    if (r.isNew) run.newKinds.push(sp.name);
    ctx.addScore(kg);
    sfx.coin(run.catches.length); if (r.isNew || kg >= 4) sfx.checkpoint();
    // the fish out of the water, held up on the line
    shownFish = fishModel(sp, kg);
    ctx.add(shownFish);
    S.phase = 'landed'; S.t = 0;
    dom.catch.innerHTML = `<h2>${escapeHtml(sp.name)}</h2><div class="kg">${kg.toFixed(1)} kg</div>${r.isNew ? '<div class="tag">NEW IN THE JOURNAL</div>' : r.isRecord ? '<div class="tag">HEAVIEST YET</div>' : ''}<p>${escapeHtml(sp.note)}</p>`;
    dom.catch.classList.add('on');
    drawJournal(sp.id);
    splash(floatPos, 0.9);
    // the fish is gone from the pond: another comes in from the edge
    const i = fishes.indexOf(S.fish); if (i >= 0) { fishes[i].mesh.removeFromParent(); fishes.splice(i, 1); }
    S.fish = null;
    addFish();
  }

  function finishSession() {
    if (ctx.phase !== 'play') return;
    const heavy = run.catches.slice().sort((a, b) => b.kg - a.kg)[0];
    const kinds = SPECIES.filter((s) => journal[s.id]).length;
    ctx.finish({ score: Math.round(run.kg * 10) / 10, title: 'Time!', lines: [
      `Fish landed ${run.catches.length}${heavy ? ` · heaviest: ${heavy.sp.name}, ${heavy.kg.toFixed(1)} kg` : ''}`,
      ...(run.catches.length ? [`Kinds today: ${[...new Set(run.catches.map((c) => c.sp.name))].join(', ')}`] : ['Nothing today: the pond keeps its secrets']),
      `Journal: ${kinds} of ${SPECIES.length} kinds${run.newKinds.length ? ` · new: ${run.newKinds.join(', ')}` : ''}`,
      ...(run.lost ? [`Got away: ${run.lost}${run.snaps ? ` (${run.snaps} snapped the line)` : ''}`] : []),
    ] });
  }

  function updateCamera(dt, snap = false) {
    // over the shoulder, out over the water; it leans toward the fish in a fight, closer on a catch
    const wantP = new THREE.Vector3(2.0, P.deck + 2.1, P.pierEnd + 4.9), wantL = new THREE.Vector3(-0.4, 0.1, P.pierEnd - 9);
    if (S.phase === 'fight' || S.phase === 'bite' || S.phase === 'nibble' || S.phase === 'wait' || S.phase === 'cast') { wantL.lerp(floatPos, 0.55); wantL.y = 0.2; }
    if (S.phase === 'landed') { wantP.set(1.6, P.deck + 1.5, P.pierEnd + 2.6); wantL.set(-0.1, P.deck + 0.9, P.pierEnd - 0.4); }
    const k = snap ? 1 : 1 - Math.exp(-2.2 * dt);
    cam.pos.lerp(wantP, k); cam.look.lerp(wantL, k);
    camera.position.copy(cam.pos); camera.up.set(0, 1, 0); camera.lookAt(cam.look);
    ctx.setFov(S.phase === 'landed' ? 48 : 52);
  }

  function step(dt, inp, live) {
    S.t += dt;
    const pressed = live && inp.jumpPressed, released = live && inp.jumpReleased;
    const reel = live ? Math.max(inp.tuck, inp.y > 0.3 ? inp.y : 0) : 0;
    const timeUp = live && ctx.time >= SESSION.secs;
    if (timeUp && !['fight', 'bite', 'landed'].includes(S.phase)) { finishSession(); return; }
    if (timeUp && !run.lastFish) { run.lastFish = true; ctx.flash('Time! The last fish…', 'big', 1.6); }
    switch (S.phase) {
      case 'retrieve':
        if (S.t > 0.6) { S.phase = 'ready'; S.t = 0; }
        break;
      case 'ready':
        S.aim += ((live ? inp.x * 0.6 : 0) - S.aim) * (1 - Math.exp(-6 * dt));
        if (live && inp.jump && pressed) { S.phase = 'charge'; S.holdT = 0; }
        hint(`Hold ${btn('A / ×', 'Space')} to cast · ${btn('Left stick', 'A  D')} aims`);
        break;
      case 'charge':
        S.aim += ((live ? inp.x * 0.6 : 0) - S.aim) * (1 - Math.exp(-6 * dt));
        S.holdT += dt; S.power = castPower(S.holdT);
        if (!live || released || !inp.jump) cast();
        hint(`Let go of ${btn('A / ×', 'Space')} to cast`);
        break;
      case 'cast': {
        const k = Math.min(1, S.t / S.flight);
        floatPos.lerpVectors(S.from, S.target, k); floatPos.y += Math.sin(k * Math.PI) * (1.5 + S.power * 3);
        if (k >= 1) { floatPos.copy(S.target); splash(floatPos, 0.35); ring(floatPos.x, floatPos.z, 0.6); S.phase = 'wait'; S.t = 0; S.at = 0.8 + rng(); S.fish = null; }
        hint('');
        break;
      }
      case 'wait':
        if (pressed) { toReady(); break; }
        if (!S.fish && S.t > S.at) { lookForFish(); S.t = 0; }
        if (S.fish && S.fish.pos.distanceTo(S.target) < 0.7) { S.phase = 'nibble'; S.t = 0; S.plan = biteSchedule(S.fish.sp, rng); S.nibbleI = 0; S.fish.mode = 'nibble'; }
        hint(`Waiting for a bite… (${btn('A / ×', 'Space')} reels in)`);
        break;
      case 'nibble': {
        if (pressed) { run.lost++; toReady('Too soon: it took fright', 'bad'); sfx.miss(); break; }
        const pl = S.plan;
        while (S.nibbleI < pl.nibbles.length && S.t >= pl.nibbles[S.nibbleI]) { S.nibbleI++; S.dip = 0.35; ring(floatPos.x, floatPos.z, 0.35); sfx.tick(1); }
        if (S.t >= pl.bite) { S.phase = 'bite'; S.t = 0; S.dip = 1; ring(floatPos.x, floatPos.z, 1.1); splash(floatPos, 0.25); sfx.jump(); ctx.kick(0.12); }
        hint('Something is nibbling… wait for it');
        break;
      }
      case 'bite': {
        const r = pressed ? hookResult(S.t, 0, S.plan.window) : S.t > S.plan.window ? 'late' : null;
        if (r === 'hooked') {
          S.phase = 'fight'; S.t = 0;
          S.fight = newFight(S.fish.sp, Math.max(2, floatPos.distanceTo(pierTip)), rng);
          S.fight.angle = Math.atan2(-(floatPos.x - pierTip.x), -(floatPos.z - pierTip.z));
          S.fish.mode = 'hooked';
          sfx.gate(); ctx.kick(0.3); ctx.flash('Hooked!', 'good', 0.9);
        } else if (r === 'late') { run.lost++; toReady('Too late: it took the bait', 'bad'); sfx.miss(); }
        hint(`NOW! ${btn('A / ×', 'Space')}`, true);
        break;
      }
      case 'fight': {
        const F = S.fight;
        const bot = typeof window !== 'undefined' && window.__fishBot ? botFight(F) : null;
        const evs = fightStep(F, bot ?? { reel, pull: live ? inp.x : 0 }, dt, rng);
        S.cranking = (bot ? bot.reel : reel) > 0.1;
        for (const e of evs) {
          if (e.kind === 'run') { ring(floatPos.x, floatPos.z, 0.9); sfx.whoosh(); }
          if (e.kind === 'leap') { S.leapT = 0; sfx.spring(); splash(floatPos, 0.8); }
          if (e.kind === 'landed') { landFish(); break; }
          if (e.kind === 'snap') { run.lost++; run.snaps++; sfx.hurt(); ctx.kick(0.5); removeFish(); toReady(e.why === 'line' ? 'Out of line: it is gone' : 'Snap! The line broke', 'bad'); break; }
          if (e.kind === 'slip') { run.lost++; sfx.miss(); toReady('Slack line: it slipped the hook', 'bad'); break; }
        }
        if (S.phase !== 'fight') break;
        const dir = dirOf(F.angle);
        floatPos.copy(pierTip).addScaledVector(dir, Math.max(F.dist, 0.8)).setY(-0.08);
        if (F.running && waters()) waters().touch?.('fish', floatPos.x, floatPos.z, 0.6 + F.sp.pull * 0.5, 0.28, dt);
        const hot = F.tension > FIGHT.red;
        meter(true, F.tension / 1.2 * 1.0, `line ${F.dist.toFixed(1)} m${hot ? ' · ease off!' : ''}`, `tension${hot ? ' hot' : ''}`);
        dom.pull.textContent = F.running ? (F.dir > 0 ? '◀◀ pull' : 'pull ▶▶') : '';
        hint(hot ? `Ease off: let go of ${btn('RT / R2', 'Shift')}!` : F.running ? `It runs! ${btn('Left stick', 'A  D')} against it` : `${btn('RT / R2', 'Shift  or  W')} reels in`);
        break;
      }
      case 'landed':
        if (S.t > 2.6) { dom.catch.classList.remove('on'); shownFish?.removeFromParent(); shownFish = null; S.phase = 'ready'; S.t = 0; drawJournal(); if (run.lastFish) finishSession(); }
        hint('');
        break;
    }
    if (S.phase !== 'fight') { dom.pull.textContent = ''; S.cranking = S.phase === 'retrieve'; }
    if (S.phase === 'charge') meter(true, S.power, `cast ${castDistance(S.power).toFixed(0)} m`);
    else if (S.phase !== 'fight') meter(false);
    if (S.phase !== 'fight' && S.phase !== 'bite' && run.lastFish && S.phase !== 'landed') finishSession();
  }
  function removeFish() { const i = fishes.indexOf(S.fish); if (i >= 0) { fishes[i].mesh.removeFromParent(); fishes.splice(i, 1); } S.fish = null; addFish(); }

  // the fish's shadows: wander, come to the float, dart off; the hooked one follows the line
  function moveFish(dt) {
    for (const f of fishes) {
      f.flee = Math.max(0, (f.flee ?? 0) - dt);
      let want = f.heading;
      if (f.mode === 'come' || f.mode === 'nibble') want = Math.atan2(S.target.x - f.pos.x, S.target.z - f.pos.z);
      else {
        f.turn += (rng() - 0.5) * dt * 2; f.turn *= Math.exp(-dt);
        want = f.heading + f.turn;
        // keep within the pond and the zone (gently back toward the middle)
        const r = Math.hypot(f.pos.x, f.pos.z), R = P.shore(Math.atan2(f.pos.z, f.pos.x));
        if (r > R * 0.85 || (Math.abs(f.pos.x) < 2.5 && f.pos.z > P.pierEnd - 2)) want = Math.atan2(-f.pos.x, -f.pos.z);
      }
      f.heading += Math.atan2(Math.sin(want - f.heading), Math.cos(want - f.heading)) * (1 - Math.exp(-(f.mode === 'wander' ? 1.2 : 4) * dt));
      const sp = f.mode === 'nibble' ? 0 : f.mode === 'come' ? f.speed : f.flee > 0 ? 2.8 : f.speed * 0.6;
      if (f.mode === 'hooked') f.pos.set(floatPos.x, 0.018, floatPos.z);
      else { f.pos.x += Math.sin(f.heading) * sp * dt; f.pos.z += Math.cos(f.heading) * sp * dt; }
      if (f.mode === 'nibble') { const d = Math.atan2(S.target.x - f.pos.x, S.target.z - f.pos.z); f.heading = d; f.pos.set(S.target.x - Math.sin(d) * 0.35, 0.018, S.target.z - Math.cos(d) * 0.35); }
      f.mesh.position.copy(f.pos);
      f.mesh.rotation.y = f.heading + Math.sin(t * 6 + f.pos.x) * 0.08;
      f.mesh.visible = !(f.mode === 'hooked' && S.leapT !== undefined && S.leapT < 0.9);
    }
  }

  ctx.status(`${Math.floor(SESSION.secs / 60)}:00 left · 0.0 kg`);
  player.object.position.copy(seat);
  updateCamera(0, true);

  return {
    state: S, fishes,
    update(dt, inp, { live, phase }) {
      t += dt;
      dom.el.classList.toggle('idle', !live);
      if (live || phase === 'finishing') step(dt, inp, live);
      moveFish(dt);
      // the traveller, sitting at the pier's end, legs over the water
      S.armRaise += ((S.phase === 'charge' ? 1.5 + S.power * 0.3 : S.phase === 'cast' && S.t < 0.18 ? -0.3 : S.phase === 'landed' ? 0.9 : S.phase === 'fight' ? 0.2 : 0) - S.armRaise) * (1 - Math.exp(-(S.phase === 'cast' ? 22 : 7) * dt));
      S.lean += ((S.phase === 'fight' ? -0.25 : S.phase === 'charge' ? -0.15 : 0) - S.lean) * (1 - Math.exp(-5 * dt));
      S.twist = -S.aim * 0.4;
      S.headTurn = S.phase === 'landed' ? 0.2 : -S.aim * 0.5;
      S.look = S.phase === 'landed' ? -0.2 : 0.25;
      player.object.position.copy(seat);
      player.object.quaternion.setFromAxisAngle(_UP, Math.PI);
      player.pos.copy(seat); player.vel.set(0, 0, 0); player.heading = Math.PI; player.onGround = true;
      poseSitting(player, S, t);
      player.humanoid?.update();
      player.humanoid?.resetFeet();
      player.humanoid?.updateEyes?.(dt, null);
      player.updateCloth?.(dt);
      // the rod from the hand: up over the shoulder when charging, whipped forward on the cast, bent by a fish
      const hb = player.humanoid?.b?.hand_r;
      if (hb) hb.getWorldPosition(hand); else player.char.elbows[0].children[2]?.getWorldPosition(hand) ?? hand.copy(seat).add(new THREE.Vector3(-0.3, 1.1, -0.4));
      const pitch = S.phase === 'charge' ? 1.55 + S.power * 0.45 : S.phase === 'cast' ? Math.max(0.25, 2 - S.t * 12) : S.phase === 'landed' ? 1.1 : 0.62;
      S.rodPitch = S.rodPitch === undefined ? pitch : S.rodPitch + (pitch - S.rodPitch) * (1 - Math.exp(-(S.phase === 'cast' ? 30 : 8) * dt));
      const d = dirOf(S.aim);
      rodDir.copy(d).multiplyScalar(Math.cos(S.rodPitch)).addScaledVector(_UP, Math.sin(S.rodPitch)).normalize();
      const F = S.fight;
      if (F) pull.subVectors(floatPos, hand).normalize(); else pull.copy(rodDir);
      kit.rod(hand, rodDir, pull, F ? Math.min(0.85, F.tension * 0.75) : 0, tip);
      // the float: hangs from the tip until cast; bobs on the water; dips at a nibble, goes under at the bite
      S.dip = Math.max(0, (S.dip ?? 0) - dt * (S.phase === 'bite' ? 0.2 : 2.5));
      const onWater = ['wait', 'nibble', 'bite'].includes(S.phase);
      if (onWater) floatPos.set(S.target.x, Math.sin(t * 2.1) * 0.015 - S.dip * 0.16 - (S.phase === 'bite' ? 0.12 : 0), S.target.z);
      else if (S.phase === 'ready' || S.phase === 'charge' || S.phase === 'retrieve' || (S.phase === 'landed')) floatPos.copy(tip).addScaledVector(_UP, -0.55 - Math.sin(t * 1.4) * 0.03);
      kit.float.position.copy(floatPos);
      kit.float.rotation.z = Math.sin(t * 1.7) * 0.08 + (S.phase === 'nibble' ? Math.sin(t * 13) * S.dip * 0.4 : 0);
      kit.float.visible = S.phase !== 'landed';
      if (onWater && Math.random() < dt * 0.6) ring(floatPos.x, floatPos.z, 0.18);
      const tight = F ? F.tension : S.phase === 'ready' || S.phase === 'charge' || S.phase === 'retrieve' ? 1 : 0.2;
      kit.line(tip, S.phase === 'landed' && shownFish ? shownFish.position : floatPos, (1 - Math.min(1, tight)) * Math.min(1.2, tip.distanceTo(floatPos) * 0.05), F && F.tension > FIGHT.red && Math.floor(t * 8) % 2 === 0);
      // the aim: a ring on the water where the cast will fall
      kit.aim.visible = S.phase === 'charge' || S.phase === 'ready';
      if (kit.aim.visible) {
        const dd = castDistance(S.phase === 'charge' ? S.power : 0.45);
        kit.aim.position.copy(pierTip).addScaledVector(d, dd).setY(0.03);
        kit.aim.scale.setScalar(S.phase === 'charge' ? 1 : 0.6);
      }
      // a leaping fish, out of the water in an arc
      if (F && S.leapT !== undefined && S.leapT < 0.9) {
        S.leapT += dt;
        if (!S.leaper) { S.leaper = fishModel(F.sp); ctx.add(S.leaper); }
        const k = S.leapT / 0.9;
        S.leaper.position.copy(floatPos).setY(Math.sin(k * Math.PI) * (0.8 + F.sp.len));
        S.leaper.rotation.set(-Math.cos(k * Math.PI) * 0.9, F.angle + Math.PI, Math.sin(t * 20) * 0.2);
        if (S.leapT >= 0.9) { splash(floatPos, 0.9); S.leaper.removeFromParent(); S.leaper = null; }
      } else if (S.leaper) { S.leaper.removeFromParent(); S.leaper = null; S.leapT = undefined; }
      if (!F) S.leapT = undefined;
      // the catch held up on the line before the traveller, wriggling, then into the basket
      if (shownFish) {
        const k = Math.min(1, S.t / 0.5);
        shownFish.position.set(-0.35, P.deck + 0.4 + k * 0.55 - (S.t > 2.2 ? (S.t - 2.2) * 2.5 : 0), P.pierEnd - 0.25 + (1 - k) * -2);
        shownFish.rotation.set(-Math.PI / 2 + 0.25, Math.PI * 0.5 + Math.sin(t * 2) * 0.4, Math.sin(t * 11) * 0.15 * (1 - k * 0.5));
      }
      updateCamera(dt);
      const left = Math.max(0, SESSION.secs - ctx.time);
      ctx.status(`${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, '0')} left · ${run.kg.toFixed(1)} kg`);
    },
    end() {
      kit.remove();
      dom.el.remove();
      shownFish?.removeFromParent(); S.leaper?.removeFromParent();
    },
  };
}

export default {
  id: 'fishing', order: 4,
  name: 'Fishing',
  blurb: 'Three quiet minutes at the end of a pier over the Still Oasis, and the strange fish that live in it.',
  rules: 'Cast, wait for the bite and strike as the float goes under; reel it in without breaking the line. Score the weight you land. Every kind you catch goes into your journal.',
  controls: {
    pad: [['A / × (hold, let go)', 'cast: the meter sets how far'], ['Left stick', 'aim; in a fight, pull against the fish'], ['A / ×', 'strike when the float goes under'], ['RT / R2', 'reel in (ease off when the line glows red)'], ['Menu', 'pause']],
    keys: [['Space (hold, let go)', 'cast: the meter sets how far'], ['A  D', 'aim; in a fight, pull against the fish'], ['Space', 'strike when the float goes under'], ['Shift  or  W', 'reel in (ease off when the line glows red)'], ['Esc', 'pause']],
    touch: [['Jump (hold, let go)', 'cast'], ['Jump', 'strike'], ['Stick up', 'reel in'], ['Stick across', 'pull against the fish']],
  },
  score: { kind: 'points', unit: 'kg', format: (v) => `${v.toFixed(1)} kg` },
  hud: { timer: false, score: true },
  color: '#4fb8b4',
  build: buildOasis,
  start,
};
