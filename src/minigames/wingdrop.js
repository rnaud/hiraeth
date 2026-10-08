// Wing drop (docs/systems/minigames.md): three drops from high over the Painted Mesa, a bullseye painted on
// its top. You fall, open the fluid wings (A / ×) and glide down to it, riding the thermals (columns of
// rising air, drawn as ink swirls that turn upward) and threading the star gates for a bonus, and land as
// close to the centre and as gently as you can. The wind changes every drop. The glider is a body of the
// game's own (glideStep: pure, tests/wingdrop.test.js): an airspeed the stick sets (forward dives, back
// flares), a sink that grows away from the best speed, the speed traded for height as you flare.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeMaterial, MODE_TERRAIN, MODE_STRATA } from '../materials.js';
import { Terrain } from '../world.js';
import { arenaLevel } from './kit/world.js';
import { lendItems } from './kit/gear.js';
import { crossRing, rng } from './rings.js';
import { Dots } from '../fluid-tool.js';

// ------------------------------------------------------------------ the mesa and its target
export const MESA = { x: 0, z: 0, top: 62, r: 36, base: 52 };
export const TARGET = { r: 24, bull: 1.6, bands: [1.6, 6, 11, 17, 24] };
export const DROPS = 3;

const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/** The desert round the mesa (dunes), the mesa's sides, its flat top. */
export function dropHeight(x, z) {
  const d = Math.hypot(x - MESA.x, z - MESA.z);
  const sand = 2 + 4 * Math.sin(x / 61) * Math.cos(z / 47) + 2.5 * Math.sin((x - z) / 33) + 6 * smooth(250, 700, d);
  if (d <= MESA.r) return MESA.top;
  return sand;
}

// ------------------------------------------------------------------ the glider (pure)
export const WING = {
  g: 32, terminal: 44,         // m/s² falling, m/s the fastest fall
  openTime: 0.45,              // s for the wings to bloom (their hold on the air grows as they open)
  cruise: 12, dive: 21, flare: 4.5,   // m/s: the airspeed the stick asks for, neutral, full forward, full back
  accel: 0.9, decel: 1.1,      // 1/s toward it, speeding up and slowing down
  sinkMin: 2.4, sinkAt: 11.5, sinkK: 0.035, slowK: 0.012,   // the sink: least at sinkAt, growing with the square away from it (slower: mushing)
  flareK: 0.6, flareNear: 4,   // the flare (the stick back): m/s of lift for each m/s of speed over WING.flare it still has, within flareNear m of the ground (fading out by 2.5 times that)
  sinkRate: 6,                 // 1/s the fall eases to the wings'
  turn: 1.25, bank: 0.6, bankRate: 4,   // rad/s at full bank; rad; 1/s
  fallTurn: 1.2,               // rad/s turning in free fall
  autoOpen: 45,                // m over the ground: the wings open by themselves (a style lost)
};

export function newGlider(pos, heading) {
  return { pos: pos.clone(), heading, air: 0, vy: 0, vel: new THREE.Vector3(), open: false, k: 0, bank: 0, turn: 0, lift: 0, landed: null, auto: false, t: 0, inThermal: -1 };
}

/** The sink the wings settle to at an airspeed (m/s down). */
export function sinkAt(air, K = WING) {
  return K.sinkMin + (air > K.sinkAt ? K.sinkK : K.slowK) * (air - K.sinkAt) ** 2;
}

/** The thermals' lift at p (m/s up): strongest in a column's middle, nothing past its edge, fading out over its top. */
export function thermalLift(thermals, p) {
  let w = 0, which = -1;
  for (let i = 0; i < thermals.length; i++) {
    const T = thermals[i], d = Math.hypot(p.x - T.x, p.z - T.z);
    if (d >= T.r) continue;
    const k = (1 - (d / T.r) ** 3) * (1 - smooth(T.top - 30, T.top, p.y));
    if (k * T.lift > w) { w = k * T.lift; which = i; }
  }
  return { w, which };
}

/**
 * A frame of the drop (S changed): inp { x (bank, > 0 right), y (> 0 forward: dive; < 0 back: flare),
 * openPressed }, the wind ({ x, z } m/s), the thermals, the ground. Returns [{ kind: 'open' | 'land', … }].
 */
export function glideStep(S, inp, dt, { wind = { x: 0, z: 0 }, thermals = [], ground = dropHeight } = {}, K = WING) {
  const ev = [];
  if (S.landed) return ev;
  S.t += dt;
  const gy = ground(S.pos.x, S.pos.z);
  if (!S.open && !S.cliff && (inp.openPressed || S.pos.y - gy < K.autoOpen)) {
    S.open = true; S.auto = !inp.openPressed;
    S.air = Math.max(8, Math.hypot(S.vel.x - wind.x, S.vel.z - wind.z));
    ev.push({ kind: 'open', auto: S.auto, height: S.pos.y - gy });
  }
  const { w, which } = thermalLift(thermals, S.pos);
  S.lift = w; S.inThermal = which;
  const steer = clamp(inp.x ?? 0, -1, 1), pitch = clamp(inp.y ?? 0, -1, 1);
  if (!S.open) {
    // the free fall: the wind takes you, a little drift the way you face
    S.vy = Math.max(-K.terminal, S.vy - K.g * dt) + w * 0.3 * dt;
    S.heading -= steer * K.fallTurn * dt;
    S.air = 2;
  } else {
    S.k = Math.min(1, S.k + dt / K.openTime);
    const want = pitch >= 0 ? K.cruise + (K.dive - K.cruise) * pitch : K.cruise + (K.cruise - K.flare) * pitch;
    S.air += (want - S.air) * (1 - Math.exp(-(want > S.air ? K.accel : K.decel) * dt));
    // the flare (the stick back, near the ground): the speed you still have holds you up as it bleeds away
    const flare = Math.max(0, -pitch) * clamp((S.air - K.flare) * K.flareK, 0, 1) * (1 - smooth(K.flareNear, K.flareNear * 2.5, S.pos.y - gy));
    const vyWant = -sinkAt(S.air, K) * (1 - flare) + w;   // (the flare holds the sink off while the speed lasts)
    S.vy += (vyWant - S.vy) * (1 - Math.exp(-K.sinkRate * S.k * dt));
    S.bank += (steer * K.bank - S.bank) * (1 - Math.exp(-K.bankRate * dt));
    S.turn = -(S.bank / K.bank) * K.turn;
    S.heading += S.turn * dt;
  }
  const fx = Math.sin(S.heading), fz = Math.cos(S.heading);
  S.vel.set(fx * S.air + wind.x, S.vy, fz * S.air + wind.z);
  const x0 = S.pos.x, y0 = S.pos.y, z0 = S.pos.z;
  S.pos.addScaledVector(S.vel, dt);
  let g1 = ground(S.pos.x, S.pos.z);
  if (g1 > y0 + 0.5) {
    // into a cliff (the mesa's side, under its rim): thrown back off it, the wings folded
    S.pos.x = x0; S.pos.z = z0; S.air = 0; S.vy = Math.min(S.vy, -3); S.cliff = true; S.open = false; S.k = 0;   // (the wings fold: you fall)
    g1 = ground(x0, z0);
    ev.push({ kind: 'bump' });
  }
  if (S.pos.y <= g1) {
    S.pos.y = g1;
    const d = Math.hypot(S.pos.x - MESA.x, S.pos.z - MESA.z);
    S.landed = { d, vy: -S.vy, hs: Math.hypot(S.vel.x, S.vel.z), onMesa: d <= MESA.r, open: S.open, auto: S.auto };
    ev.push({ kind: 'land', ...S.landed });
  }
  return ev;
}

/**
 * A landing's score: accuracy (500 at the centre down to nothing at the target's edge, 100 more in
 * the bull), style (200 for a landing soft and slow; a hard one tumbles: no style, half the
 * accuracy), the stars (100 each); the wings opened by themselves cost 50 of the style.
 */
export function scoreLanding({ d, vy, hs, onMesa = true, auto = false }, stars = 0) {
  const onTarget = onMesa && d <= TARGET.r;
  let accuracy = onTarget ? Math.round(500 * (1 - d / TARGET.r) ** 1.2) + (d <= TARGET.bull ? 100 : 0) : onMesa ? 25 : 0;
  const tumble = vy > 7;
  const soft = clamp(1 - (vy - 1.5) / 4.5, 0, 1), slow = clamp(1 - (hs - 5) / 10, 0, 1);
  let style = tumble ? 0 : Math.round(200 * soft * (0.5 + 0.5 * slow));
  if (auto) style = Math.max(0, style - 50);
  if (tumble) accuracy = Math.round(accuracy / 2);
  const bull = onTarget && d <= TARGET.bull;
  return { accuracy, style, stars: stars * 100, total: accuracy + style + stars * 100, tumble, onTarget, bull };
}

/**
 * The plan of drop i (0..2) of a round: the wind (a new one each drop, stronger as they go), where you
 * start (high, a long glide away), the thermals between, the star gates (one high in a thermal, one off
 * the line, one on the final approach).
 */
export function dropPlan(i, seed = 1) {
  const rand = rng(seed * 101 + i * 7 + 3);
  const a = rand() * Math.PI * 2, D = 280 + 30 * i + rand() * 30;
  const start = new THREE.Vector3(MESA.x + Math.cos(a) * D, MESA.top + 130 + 15 * i, MESA.z + Math.sin(a) * D);
  const toward = new THREE.Vector3(MESA.x - start.x, 0, MESA.z - start.z).normalize();
  const side = new THREE.Vector3(toward.z, 0, -toward.x);
  // the wind: drop 1 a breeze, then stronger, from anywhere (on the last, mostly against you)
  const ws = 1.5 + 1.2 * i + rand();
  const wa = i === 2 ? Math.atan2(-toward.z, -toward.x) + (rand() - 0.5) * 1.6 : rand() * Math.PI * 2;
  const wind = { x: Math.cos(wa) * ws, z: Math.sin(wa) * ws };
  const at = (f, off) => new THREE.Vector3(start.x + (MESA.x - start.x) * f + side.x * off, 0, start.z + (MESA.z - start.z) * f + side.z * off);
  const thermals = [0.28, 0.52, 0.76].map((f, k) => {
    const p = at(f, (k % 2 ? -1 : 1) * (22 + rand() * 30));
    return { x: p.x, z: p.z, r: 15 + rand() * 6, lift: 5.2 + rand() * 1.8, top: MESA.top + 230 };
  });
  const T0 = thermals[0];
  const glideY = (f) => start.y - 30 - (start.y - 30 - MESA.top) * f * 1.05;
  const s1 = new THREE.Vector3(T0.x, start.y + 12, T0.z);                        // up a thermal
  const s2 = at(0.62, 40).setY(glideY(0.62));                                   // off the line (the second thermal is on the other side)
  const s3 = at(0.9, 0).setY(MESA.top + 11);                                      // the final approach
  const stars = [s1, s2, s3].map((c) => ({ c, n: toward.clone(), R: 4.6 }));
  return { start, heading: Math.atan2(toward.x, toward.z) + (rand() - 0.5) * 0.5, wind, thermals, stars };
}

const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

/** A pilot (the tests', the screenshots'): opens at once, glides at the target, circles off height it has too much of, flares at the end. */
export function botInput(S, plan) {
  const to = { x: MESA.x - S.pos.x, z: MESA.z - S.pos.z };
  const d = Math.hypot(to.x, to.z), h = S.pos.y - MESA.top;
  if (!S.open) return { openPressed: true };
  const want = Math.atan2(to.x, to.z);
  // the glide over the ground, into this wind: does the height carry us there, or is there too much of it?
  const gx = Math.sin(S.heading) * S.air + plan.wind.x, gz = Math.cos(S.heading) * S.air + plan.wind.z;
  const ground = Math.max(1, (gx * to.x + gz * to.z) / Math.max(d, 1));
  const need = d / ground * sinkAt(S.air);   // m of height the glide will use
  let x = clamp(-wrap(want - S.heading) * 2.5, -1, 1), y = 0;
  if (h > need + 25 && d < 120) x = 1;                       // too high: circle down
  else if (h > need + 10) y = 0.6;                            // a little high: dive
  else if (h < need - 5) y = -0.15;                           // low: the best glide
  if (h < 1.4) y = -1;                                        // the flare
  return { x, y, openPressed: false };
}

// ------------------------------------------------------------------ the arena, built
const INK = '#2b211f';
const tag = (m) => { m.userData.noCollide = true; return m; };

function* buildDrop(scene) {
  const terrain = yield* Terrain.make({
    size: 2000, seg: 400, height: (x, z) => (Math.hypot(x - MESA.x, z - MESA.z) <= MESA.r + 6 ? dropHeight(MESA.x + MESA.r + 7, MESA.z) : dropHeight(x, z)),
    material: { color: '#efcf9c', color2: '#f5e0b8', color3: '#d9a77a', mode: MODE_TERRAIN, ripples: true, sandInk: true },
  });
  scene.add(terrain.mesh);
  yield;
  const rand = rng(5);
  const rock = makeMaterial({ color: '#d6936a', color2: '#c27a52', color3: '#a1603f', mode: MODE_STRATA, strataSize: 6, strataHatch: 0.6, cracks: 0.5 });
  const pale = makeMaterial({ color: '#e9c095', color2: '#dba678', color3: '#bd875e', mode: MODE_STRATA, strataSize: 5, strataHatch: 0.5, cracks: 0.4 });
  // the Painted Mesa: its sides flared at the foot, the top flat (collidable: the feet stand on it)
  const h = MESA.top + 4;
  const mesaGeo = new THREE.CylinderGeometry(MESA.r, MESA.r * 1.35, h, 40, 10);
  const p = mesaGeo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), a = Math.atan2(z, x);
    if (y >= h / 2 - 1e-3) continue;
    const k = 1 + 0.04 * Math.sin(y * 0.5 + a * 3) + 0.03 * Math.sin(a * 7 + y * 0.13) + (Math.floor(y / 7) % 2 ? 0.02 : -0.01);
    p.setXYZ(i, x * k, y, z * k);
  }
  mesaGeo.translate(MESA.x, MESA.top - h / 2, MESA.z);
  mesaGeo.computeVertexNormals();
  scene.add(new THREE.Mesh(mesaGeo, rock));
  // the bullseye, painted on the top: bands of cream, rust and cobalt, an ink line between each
  const paints = ['#f2c54b', '#d9643a', '#f7ecd2', '#3f5fae', '#f7ecd2'];
  TARGET.bands.forEach((r, i) => {
    const r0 = i ? TARGET.bands[i - 1] : 0;
    const band = tag(new THREE.Mesh(new THREE.RingGeometry(r0, r, 64, 1).rotateX(-Math.PI / 2).translate(MESA.x, MESA.top + 0.03 + i * 0.002, MESA.z), makeMaterial({ color: paints[i], flat: true, side: THREE.DoubleSide })));
    scene.add(band);
  });
  const lines = TARGET.bands.map((r) => new THREE.RingGeometry(r - 0.12, r + 0.12, 72, 1).rotateX(-Math.PI / 2).translate(MESA.x, MESA.top + 0.05, MESA.z).toNonIndexed());
  for (let k = 0; k < 4; k++) lines.push(new THREE.PlaneGeometry(0.16, TARGET.r * 2).rotateX(-Math.PI / 2).rotateY((k * Math.PI) / 4).translate(MESA.x, MESA.top + 0.045, MESA.z).toNonIndexed());
  const ink = makeMaterial({ color: INK, flat: true, side: THREE.DoubleSide });
  scene.add(tag(new THREE.Mesh(mergeGeometries(lines), ink)));
  // the windsock at the mesa's rim
  const pole = tag(new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 7, 6).translate(0, 3.5, 0), ink));
  pole.position.set(MESA.x + MESA.r - 4, MESA.top, MESA.z + 4);
  const sock = tag(new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.25, 2.6, 10, 4, true).rotateZ(Math.PI / 2).translate(1.3, 0, 0), makeMaterial({ color: '#d9643a', side: THREE.DoubleSide })));
  const sockPivot = new THREE.Group();
  sockPivot.position.set(pole.position.x, MESA.top + 6.6, pole.position.z);
  sockPivot.add(sock);
  scene.add(pole, sockPivot);
  yield;
  // the land round it: smaller mesas, needles, far tables
  const geos = [], pales = [];
  for (let i = 0; i < 46; i++) {
    const a = rand() * Math.PI * 2, d = 160 + rand() * 700, x = MESA.x + Math.cos(a) * d, z = MESA.z + Math.sin(a) * d;
    const needle = rand() < 0.6, r = needle ? 3 + rand() * 7 : 14 + rand() * 30, hh = needle ? 30 + rand() * 90 : 20 + rand() * 60;
    const g = new THREE.CylinderGeometry(needle ? r * 0.45 : r * 0.9, r, hh, needle ? 9 : 16, 4).translate(x, dropHeight(x, z) + hh / 2 - 3, z).toNonIndexed();
    (i % 3 ? geos : pales).push(g);
  }
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2 + rand() * 0.2, d = 880 + rand() * 80, x = Math.cos(a) * d, z = Math.sin(a) * d, r = 60 + rand() * 60, hh = 80 + rand() * 120;
    pales.push(new THREE.CylinderGeometry(r * 0.8, r, hh, 14, 3).translate(x, dropHeight(x, z) + hh / 2 - 5, z).toNonIndexed());
  }
  scene.add(tag(new THREE.Mesh(mergeGeometries(geos), rock)), tag(new THREE.Mesh(mergeGeometries(pales), pale)));
  yield;
  return arenaLevel({
    ground: terrain, name: 'The Painted Mesa', hour: 10.2,
    spawn: new THREE.Vector3(MESA.x, MESA.top, MESA.z),
    features: { mount: false, wind: true, jetpack: false, climb: false },
    drop: { sockPivot, mats: { rock, pale, ink } },
  });
}

// ------------------------------------------------------------------ the thermals and the stars, drawn
/** A thermal's swirl: dashed ink helices round its column (turning, they seem to rise), as one mesh. */
function thermalModel(T, mats, seed) {
  const rand = rng(seed), geos = [[], []], pitch = 16, h = T.top - 4;
  for (let s = 0; s < 5; s++) {
    const r = T.r * (0.3 + 0.65 * rand()), ph = rand() * Math.PI * 2, dash = 5 + rand() * 4, gap = 3 + rand() * 5;
    const len = Math.hypot(2 * Math.PI * r, pitch) * (h / pitch);
    for (let u = rand() * gap; u < len; u += dash + gap) {
      const pts = [];
      for (let k = 0; k <= 4; k++) {
        const t = (u + (dash * k) / 4) / len, y = t * h, a = ph + (y / pitch) * Math.PI * 2;
        pts.push(new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r));
      }
      const fade = 1 - smooth(h * 0.7, h, (u / len) * h);
      if (fade < 0.15) continue;
      geos[s % 3 === 2 ? 1 : 0].push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 4, 0.17 * (0.4 + 0.6 * fade), 3, false).toNonIndexed());
    }
  }
  const g = new THREE.Group();
  g.add(tag(new THREE.Mesh(mergeGeometries(geos[0]), mats.swirl)), tag(new THREE.Mesh(mergeGeometries(geos[1]), mats.warm)));
  g.userData.r = T.r;
  g.position.set(T.x, 0, T.z);
  g.userData.spin = (T.lift / pitch) * Math.PI * 2;   // (turned this fast the helices rise at the thermal's lift)
  return g;
}

/** A star gate: a five-pointed star's outline in brass, glowing, facing its way through. */
function starModel(st, mats) {
  const pts = [];
  for (let k = 0; k <= 10; k++) { const a = Math.PI / 2 + (k / 10) * Math.PI * 2, r = k % 2 ? st.R * 0.48 : st.R * 1.12; pts.push(new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r, 0)); }
  const g = new THREE.Group();
  const mesh = tag(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true, 'catmullrom', 0.02), 80, 0.3, 5, true), mats.star));
  const hoop = tag(new THREE.Mesh(new THREE.TorusGeometry(st.R, 0.08, 4, 40), mats.ink));
  g.add(mesh, hoop);
  g.position.copy(st.c);
  g.lookAt(st.c.clone().add(st.n));
  g.userData.mesh = mesh;
  return g;
}

// ------------------------------------------------------------------ the sounds
function dropSounds(sound) {
  const on = () => !!sound?.ctx && !sound.muted && sound.fx;
  const note = (s) => 440 * Math.pow(2, s / 12);
  return {
    open() { if (on()) { const t = sound.ctx.currentTime; sound.burst(t, { dur: 0.5, type: 'bandpass', freq: 700, q: 0.6, vol: 0.12, rate: 0.8 }); sound.sweep(t, 220, 440, 0.4, 0.04, 'triangle'); } },
    star(k) { if (!on()) return; const t = sound.ctx.currentTime; [0, 4, 7, 12].forEach((s, i) => sound.pluck(note(s + 7 + k * 2), t + i * 0.06, 0.06, 'sine', sound.fx)); },
    lift() { if (on()) sound.sweep(sound.ctx.currentTime, 330, 660, 0.7, 0.025, 'sine'); },
    bull() { if (!on()) return; const t = sound.ctx.currentTime; [0, 7, 12, 16, 19].forEach((s, i) => sound.pluck(note(s), t + i * 0.08, 0.07, 'triangle', sound.fx)); },
  };
}

const ARROWS = ['↑', '↗', '→', '↘', '↓', '↙', '←', '↖'];
/** The wind as an arrow on the screen, the way it blows as seen from behind you (↑: with you). */
export function windArrow(wind, heading) {
  const a = wrap(Math.atan2(wind.x, wind.z) - heading);   // (0: blowing the way you face; > 0: toward your left)
  return ARROWS[((Math.round(-a / (Math.PI / 4)) % 8) + 8) % 8];
}

// ------------------------------------------------------------------ the game
const _cw = new THREE.Vector3(), _cl = new THREE.Vector3(), _v = new THREE.Vector3(), _UP = new THREE.Vector3(0, 1, 0);

function start(ctx) {
  const { player, camera, level, sfx } = ctx;
  const L = level.drop;
  const snd = dropSounds(ctx.sound);
  const giveBack = lendItems(['backpack', 'glider']);
  const seed = 1 + Math.floor(Math.random() * 1e6);
  const mats = {
    swirl: makeMaterial({ color: INK, flat: true, key: 'wd-swirl' }),
    warm: makeMaterial({ color: '#d9643a', flat: true, key: 'wd-warm' }),
    faint: makeMaterial({ color: '#efe3c8', flat: true, line: 0.25, key: 'wd-faint' }),
    faintWarm: makeMaterial({ color: '#f0c9a8', flat: true, line: 0.25, key: 'wd-faint-warm' }),
    star: makeMaterial({ color: '#f2c54b', glow: 0.8, key: 'wd-star' }),
    got: makeMaterial({ color: '#71d7cf', glow: 0.6, key: 'wd-star-got' }),
    ink: L.mats.ink,
  };
  const motes = new Dots(ctx.scene, 220, makeMaterial({ color: '#ffffff', flat: true, key: 'wd-motes' }));
  (level.noShadow ??= []).push(motes.mesh);
  const total = { points: 0, drops: [] };
  let drop = -1, plan = null, S = null, objs = [], between = 0, landedAt = 0;
  const cam = { pos: new THREE.Vector3(), look: new THREE.Vector3() };
  const gotStars = new Set();

  function begin(i) {
    drop = i;
    for (const o of objs) { o.removeFromParent(); const j = level.noShadow.indexOf(o); if (j >= 0) level.noShadow.splice(j, 1); }
    plan = dropPlan(i, seed);
    objs = [
      ...plan.thermals.map((T, k) => ctx.add(thermalModel(T, mats, seed + k * 13 + i))),
      ...plan.stars.map((st) => ctx.add(starModel(st, mats))),
    ];
    level.noShadow.push(...objs);   // (the swirls and the stars cast no shadow: air and light)
    gotStars.clear();
    S = newGlider(plan.start, plan.heading);
    between = 0;
    updateCamera(0, true);
    ctx.status(statusText());
  }

  function updateCamera(dt, snap = false) {
    const f = _v.set(Math.sin(S.heading), 0, Math.cos(S.heading));
    if (S.landed) {
      // landed: round to the front, a little above, the target under you
      const a = S.heading + Math.PI * 0.75 * Math.min(1, (landedAt += dt) / 1.6);
      _cw.set(S.pos.x - Math.sin(a) * 7, S.pos.y + 3.2, S.pos.z - Math.cos(a) * 7);
      _cl.copy(S.pos).addScaledVector(_UP, 0.9);
    } else if (!S.open) {
      // the fall: above and behind, looking down past you at the mesa far below
      _cw.copy(S.pos).addScaledVector(f, -4.5).addScaledVector(_UP, 4.5);
      _cl.copy(S.pos).addScaledVector(f, 6).addScaledVector(_UP, -8);
    } else {
      const k = Math.min(S.air / 21, 1);
      _cw.copy(S.pos).addScaledVector(f, -(6.5 + 2 * k)).addScaledVector(_UP, 2.4);
      _cl.copy(S.pos).addScaledVector(f, 9).addScaledVector(_UP, -2.2 - 2 * k);
    }
    const floor = dropHeight(_cw.x, _cw.z) + 1.4;
    if (_cw.y < floor) _cw.y = floor;
    const e = snap ? 1 : 1 - Math.exp(-5 * dt);
    cam.pos.lerp(_cw, e); cam.look.lerp(_cl, snap ? 1 : 1 - Math.exp(-8 * dt));
    camera.position.copy(cam.pos);
    _v.subVectors(cam.look, cam.pos).normalize();
    camera.up.set(0, 1, 0).applyAxisAngle(_v, -(S.open && !S.landed ? S.bank * 0.4 : 0));
    camera.lookAt(cam.look);
    ctx.setFov(S.open || S.landed ? 62 : 70);
  }

  function pose(dt) {
    player.pos.copy(S.pos);
    player.vel.copy(S.vel);
    player.heading = S.heading;
    player.onGround = !!S.landed;
    player.gliding = S.open && !S.landed;
    player.glideTurn = S.turn;
    player.jetFlight = null; player.thrusting = false; player.jetPower = 0;
    player._moveDir = (player._moveDir ?? new THREE.Vector3()).set(0, 0, 0);
    player._wantSpeed = 0;
    player.finishFrame(dt, S.landed ? 0 : Math.hypot(S.vel.x, S.vel.z));
  }

  function statusText() {
    if (!S) return '';
    const to = Math.hypot(S.pos.x - MESA.x, S.pos.z - MESA.z), h = Math.max(0, S.pos.y - MESA.top);
    const ws = Math.hypot(plan.wind.x, plan.wind.z);
    return `${total.points} pts · drop ${drop + 1}/${DROPS} · ${Math.round(to)} m off · ${Math.round(h)} m up · wind ${windArrow(plan.wind, S.heading)} ${ws.toFixed(0)} m/s · ★ ${gotStars.size}/${plan.stars.length}`;
  }

  function landed(e) {
    const r = scoreLanding(e, gotStars.size);
    total.points += r.total;
    total.drops.push(r);
    ctx.setScore(total.points);
    landedAt = 0;
    sfx.land(Math.min(1, e.vy / 8));
    if (r.tumble) { ctx.kick(0.8); ctx.flash('Tumble!', 'bad'); }
    else if (r.bull) { snd.bull(); ctx.flash("Bull's-eye!", 'good big', 1.6); }
    else if (r.onTarget) sfx.checkpoint();
    else sfx.miss();
    ctx.flash(`Drop ${drop + 1}: ${r.total} pts (aim ${r.accuracy} · style ${r.style} · stars ${r.stars})`, r.total >= 400 ? 'good' : '', 2.4);
    if (drop + 1 >= DROPS) {
      ctx.finish({ score: total.points, lines: [
        ...total.drops.map((q, k) => `Drop ${k + 1}: ${q.total} (aim ${q.accuracy}${q.bull ? ', bull' : ''} · style ${q.style}${q.tumble ? ', tumbled' : ''} · stars ${q.stars})`),
        `Stars ${total.drops.reduce((n, q) => n + q.stars / 100, 0)} of ${DROPS * 3}`,
      ] });
    } else between = 2.6;
  }

  begin(0);
  pose(1 / 60);

  return {
    /** (for a scripted pilot) */
    get state() { return { S, plan, drop }; },
    update(dt, inp, { live, phase }) {
      const moving = live || phase === 'finishing';
      const ii = live ? { x: inp.x, y: inp.y, openPressed: inp.jumpPressed } : { x: 0, y: 0, openPressed: false };
      if (moving && !S.landed) {
        const p0 = S.pos.clone(), was = S.inThermal;
        for (const e of glideStep(S, ii, dt, { wind: plan.wind, thermals: plan.thermals })) {
          if (e.kind === 'open') { snd.open(); sfx.whoosh(); if (e.auto) ctx.flash('The wings opened by themselves · −50 style', 'bad', 1.6); }
          if (e.kind === 'land') landed(e);
          if (e.kind === 'bump' && !S.bumped) { S.bumped = true; sfx.hurt(); ctx.kick(0.6); ctx.flash('Into the cliff!', 'bad'); }
        }
        if (S.inThermal >= 0 && was < 0 && S.open) snd.lift();
        plan.stars.forEach((st, k) => {
          if (gotStars.has(k) || crossRing(st, p0, S.pos) !== 'pass') return;
          gotStars.add(k);
          objs[plan.thermals.length + k].userData.mesh.material = mats.got;
          objs[plan.thermals.length + k].userData.pop = 1;
          snd.star(gotStars.size);
          ctx.flash('★ +100', 'good', 1);
        });
      }
      if (between > 0 && (between -= dt) <= 0 && live) begin(drop + 1);
      // the swirls turn (and so rise), the stars spin and pulse, the sock swings to the wind
      for (const o of objs) {
        if (o.userData.spin) {
          o.rotation.y += o.userData.spin * dt;   // (world angle = local − rotation: turning this way the helices climb)
          // inside a column the near strokes would fill the view: drawn faint (a pale hairline) while the camera is in it
          const inside = Math.hypot(camera.position.x - o.position.x, camera.position.z - o.position.z) < o.userData.r + 5;
          o.children[0].material = inside ? mats.faint : mats.swirl; o.children[1].material = inside ? mats.faintWarm : mats.warm;
        }
        else if (o.userData.mesh) {
          o.userData.mesh.rotation.z += dt * 0.8;
          if (o.userData.pop > 0) { o.userData.pop = Math.max(0, o.userData.pop - dt * 2); o.scale.setScalar(1 + 0.5 * Math.sin(Math.PI * (1 - o.userData.pop))); }
        }
      }
      L.sockPivot.rotation.y = Math.atan2(-plan.wind.z, plan.wind.x);
      // dust motes rising in the thermals near you, and drifting on the wind
      for (const T of plan.thermals) {
        if (Math.hypot(T.x - S.pos.x, T.z - S.pos.z) > 160 || Math.random() > 0.5) continue;
        const a = Math.random() * Math.PI * 2, r = Math.random() * T.r;
        _v.set(T.x + Math.cos(a) * r, S.pos.y - 30 + Math.random() * 60, T.z + Math.sin(a) * r);
        motes.add({ pos: _v, vel: new THREE.Vector3(-Math.sin(a) * 3, T.lift, Math.cos(a) * 3), size: 0.05 + Math.random() * 0.05, stretch: 3, life: 1.6, color: Math.random() < 0.6 ? INK : '#d9643a' });
      }
      motes.update(dt, _UP);
      pose(dt);
      updateCamera(dt);
      ctx.speed(S.open ? Math.max(0, Math.min(1, (S.air - 15) / 6)) : Math.min(1, -S.vy / 40));
      ctx.status(statusText());
    },
    end() {
      giveBack();
      motes.mesh.removeFromParent();
      for (const o of [motes.mesh, ...objs]) { const i = level.noShadow.indexOf(o); if (i >= 0) level.noShadow.splice(i, 1); }
      player.gliding = false; player.glideTurn = 0;
      ctx.speed(0);
    },
  };
}

export default {
  id: 'wingdrop', order: 4,
  name: 'Wing drop',
  blurb: 'Three drops from high over the Painted Mesa: open the fluid wings, ride the thermals, land on the bullseye.',
  rules: 'Land as close to the centre and as gently as you can: up to 600 for aim, 200 for style (flare just before you touch down), 100 a star gate. Thermals lift you; the wind changes every drop. Best total of three drops wins.',
  controls: {
    pad: [['A / ×', 'open the wings'], ['Left stick left / right', 'bank and turn'], ['Left stick forward', 'dive: faster, sinks more'], ['Left stick back', 'flare: slow down, lift (before landing)'], ['Menu', 'pause']],
    keys: [['Space', 'open the wings'], ['A  D', 'bank and turn'], ['W', 'dive: faster, sinks more'], ['S', 'flare: slow down, lift (before landing)'], ['Esc', 'pause']],
    touch: [['Jump', 'open the wings'], ['Stick', 'turn, dive, flare']],
  },
  score: { kind: 'points', unit: 'pts' },
  hud: { timer: false, score: true },
  color: '#71d7cf',
  build: buildDrop,
  start,
};
