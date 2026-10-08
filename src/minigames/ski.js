// Dune skiing (docs/systems/minigames.md): the traveller on sand-skis down a long dune, through the
// gates, against the clock. The slope is one height function (courseHeight): a valley that wanders
// down a kilometre of dune, rollers, lips to jump off, and a run-out past the finish. The skier is
// its own little body on that function (skiStep: pure, tests/minigames.test.js): gravity along the
// slope, the skis' edges turning the sideways slide into speed (a carve keeps its momentum), a tuck
// that cuts the drag, a skid that brakes, a pop off the ground, spins in the air and landings that
// are clean or are not.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeMaterial, MODE_TERRAIN, MODE_STRATA } from '../materials.js';
import { Terrain } from '../world.js';
import { arenaLevel } from './kit/world.js';
import { Dots } from '../fluid-tool.js';

// ------------------------------------------------------------------ the slope
export const COURSE = {
  startZ: 560, finishZ: -520,     // the run goes down the slope toward -z
  lips: [395, 150, -75, -300],   // (each at the end of a steep pitch: the speed is there to fly)
  gateEvery: 62, gateWidth: 10, gateOffset: 12, penalty: 3,
};
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/** The course's middle line at z (it wanders from side to side). */
export const centerX = (z) => 34 * Math.sin(z / 150) + 12 * Math.sin(z / 61 + 1.3);

/** The fall line's height at z: a steady fall with rollers, a plateau at the start, a run-out past the finish. */
export function fallLine(z, C = COURSE) {
  const S = C.startZ, F = C.finishZ - 12;
  const q = z > S ? S + 18 * Math.tanh((z - S) / 18) : z < F ? F - 45 * Math.tanh((F - z) / 45) : z;
  const roll = (7 * Math.sin(z / 90) + 3.5 * Math.sin(z / 37 + 2)) * smooth(F - 30, F + 60, z) * smooth(S + 10, S - 50, z);
  return 0.215 * q + roll;
}

/** A lip's kick at z (d: across the course): a ramp up to the lip, then the slope drops away. */
export function lipKick(z, d, C = COURSE) {
  let r = 0;
  for (const L of C.lips) {
    const t = z - L;   // (> 0 before the lip: the run comes from +z)
    if (t > 16 || t < -4.5) continue;
    const k = t >= 0 ? (1 - t / 16) ** 2 : 1 + t / 4.5;
    r += 3.1 * k * Math.max(0, 1 - (d / 64) ** 2);
  }
  return r;
}

/** The dune's height anywhere: the fall line, the valley's walls, the lips, the dunes beyond. */
export function courseHeight(x, z, C = COURSE) {
  const d = x - centerX(z);
  const wall = 26 * (1 - Math.exp(-(d * d) / (2 * 40 * 40)));
  const out = smooth(48, 95, Math.abs(d));
  const dunes = out * (9 * Math.sin(x / 47 + z / 73) + 6 * Math.sin(x / 23 - z / 31 + 1) + 14 * smooth(90, 260, Math.abs(d)));
  return fallLine(z, C) + wall + dunes + lipKick(z, d, C);
}

/** The gates down the course: alternating sides, none on a lip's ramp. */
export function courseGates(C = COURSE) {
  const gates = [];
  let side = 1;
  for (let z = C.startZ - 50; z > C.finishZ + 25; z -= C.gateEvery) {
    let gz = z;
    for (const L of C.lips) if (Math.abs(gz - L) < 22) gz = L - 26;   // (just past the lip's landing, not on its ramp)
    gates.push({ z: gz, x: centerX(gz) + side * C.gateOffset, w: C.gateWidth, side });
    side = -side;
  }
  return gates;
}

/** Did a run from z0 to z1 (going down: z0 > z1) cross the gate's line, and between its poles? */
export function crossGate(g, x0, z0, x1, z1) {
  if (!(z0 > g.z && z1 <= g.z)) return null;
  const t = (z0 - g.z) / (z0 - z1), x = x0 + (x1 - x0) * t;
  return Math.abs(x - g.x) <= g.w / 2 ? 'pass' : 'miss';
}

// ------------------------------------------------------------------ the skier (pure)
export const SKI = {
  g: 24,            // m/s² (a little more than the world's: a snappier fall)
  mu: 0.03,         // the sand's friction under the skis
  drag: 0.011,      // air, standing (per m: × speed²; ~75 km/h down the average slope)
  tuckDrag: 0.0052, // air, tucked (~105 km/h)
  brake: 7,         // m/s² the skid takes off, at a full brake
  turn: 2.4,        // rad/s, the stick full over at speed
  turnSlow: 3.2,    // rad/s at a crawl (stepping round)
  tuckTurn: 0.55,   // a tuck turns this much less
  grip: 9,          // 1/s: how fast the edges kill the sideways slide
  skidGrip: 2.0,    // 1/s while braking (a skid)
  keep: 0.8,        // of the sideways speed the edges turn into forward speed (a carve keeps its momentum)
  pop: 6.4,         // m/s up, the pop off the ground
  spin: 6.5,        // rad/s turning in the air
  clean: 0.62,      // cos of the worst clean landing (the skis within ~52° of where you fly)
  maxSpeed: 36,
};

export function newSkier(x, z, heading, ground) {
  return { x, y: ground(x, z), z, vx: 0, vy: 0, vz: 0, heading, air: false, airT: 0, spin: 0, lean: 0, crouch: 0.3, turnRate: 0, slide: 0, speed: 0 };
}

const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

/** The ground's slope at (x, z): dh/dx, dh/dz. */
export function slopeAt(ground, x, z, e = 0.5) {
  return { gx: (ground(x + e, z) - ground(x - e, z)) / (2 * e), gz: (ground(x, z + e) - ground(x, z - e)) / (2 * e) };
}

/**
 * One step of the skier on the ground function: S changes in place; returns what happened
 * ([{ kind: 'pop' | 'air' | 'land', clean, spins, impact, airT }]).
 * inp: { x (-1..1 carve; > 0 right), tuck (0..1), brake (0..1), jumpPressed }
 */
export function skiStep(S, inp, dt, ground, K = SKI) {
  const ev = [];
  const tuck = inp.tuck ?? 0, brake = inp.brake ?? 0, steer = inp.x ?? 0;
  const want = S.air ? 0.55 : Math.max(tuck * 0.95, brake * 0.5, 0.28 + 0.25 * Math.abs(steer));
  S.crouch += (want - S.crouch) * (1 - Math.exp(-9 * dt));
  if (!S.air) {
    const { gx, gz } = slopeAt(ground, S.x, S.z);
    const n2 = 1 + gx * gx + gz * gz;
    let sp = Math.hypot(S.vx, S.vz);
    // the edges: the stick turns the skis, harder at a crawl, less in a tuck
    const rate = (K.turnSlow + (K.turn - K.turnSlow) * Math.min(sp / 12, 1)) * (1 - K.tuckTurn * tuck);
    S.turnRate = -steer * rate;
    S.heading = wrap(S.heading + S.turnRate * dt);
    const dx = Math.sin(S.heading), dz = Math.cos(S.heading), nx = dz, nz = -dx;
    let u = S.vx * dx + S.vz * dz, w = S.vx * nx + S.vz * nz;
    const grip = K.grip + (K.skidGrip - K.grip) * brake;
    const w2 = w * Math.exp(-grip * dt);
    u += Math.sign(u || 1) * (Math.abs(w) - Math.abs(w2)) * (K.keep * (1 - brake));   // (the slide turned into speed: the carve)
    S.slide = Math.abs(w2);
    w = w2;
    S.vx = u * dx + w * nx; S.vz = u * dz + w * nz;
    // the slope's pull, then the sand and the air
    S.vx += (-K.g * gx / n2) * dt; S.vz += (-K.g * gz / n2) * dt;
    sp = Math.hypot(S.vx, S.vz);
    if (sp > 1e-6) {
      const dec = K.mu * K.g + (K.drag + (K.tuckDrag - K.drag) * tuck) * sp * sp + K.brake * brake;
      const k = Math.max(0, Math.min(sp - dec * dt, K.maxSpeed)) / sp;
      S.vx *= k; S.vz *= k;
    }
    const x1 = S.x + S.vx * dt, z1 = S.z + S.vz * dt, h1 = ground(x1, z1);
    const vg = gx * S.vx + gz * S.vz;                    // the ground's rise under you, going this way
    const yb = S.y + vg * dt - 0.5 * K.g * dt * dt;      // where a body thrown along the ground would be
    if (inp.jumpPressed) {
      S.air = true; S.airT = 0; S.spin = 0;
      S.vy = Math.max(vg, 0) + K.pop; S.y = Math.max(h1, S.y) + S.vy * dt;
      ev.push({ kind: 'pop' });
    } else if (yb > h1 + 0.04) {
      S.air = true; S.airT = 0; S.spin = 0;   // the ground fell away faster than you can follow it: off a lip
      S.y = yb; S.vy = vg - K.g * dt;
      ev.push({ kind: 'air' });
    } else {
      S.vy = (h1 - S.y) / dt; S.y = h1;
    }
    S.x = x1; S.z = z1;
    const lean = Math.max(-0.7, Math.min(0.7, -S.turnRate * Math.hypot(S.vx, S.vz) / K.g));
    S.lean += (lean - S.lean) * (1 - Math.exp(-8 * dt));
  } else {
    S.airT += dt;
    S.vy -= K.g * dt;
    S.x += S.vx * dt; S.z += S.vz * dt; S.y += S.vy * dt;
    const dh = -steer * K.spin * dt;   // the stick spins you
    S.heading = wrap(S.heading + dh); S.spin += dh;
    S.turnRate = dh / dt;
    S.lean += (0 - S.lean) * (1 - Math.exp(-5 * dt));
    const h1 = ground(S.x, S.z);
    if (S.y <= h1) {
      const { gx, gz } = slopeAt(ground, S.x, S.z);
      const vg = gx * S.vx + gz * S.vz;   // how fast the ground falls under you
      const impact = Math.max(0, vg - S.vy);
      const sp = Math.hypot(S.vx, S.vz), dir = Math.atan2(S.vx, S.vz);
      let diff = wrap(S.heading - dir);
      const backwards = Math.cos(diff) < -K.clean;   // (landed tail first: still clean, the skis turned round)
      if (backwards) { S.heading = wrap(S.heading + Math.PI); diff = wrap(S.heading - dir); }
      const clean = sp < 3 || Math.cos(diff) >= K.clean;
      const spins = Math.floor((Math.abs(S.spin) + 0.6) / (Math.PI * 2));
      if (clean) S.heading = wrap(dir + diff * 0.3);
      else { S.heading = dir; S.vx *= 0.35; S.vz *= 0.35; }
      ev.push({ kind: 'land', clean, spins, impact, airT: S.airT });
      S.air = false; S.y = h1; S.vy = vg; S.spin = 0;
    }
  }
  S.speed = Math.hypot(S.vx, S.vz);
  return ev;
}

// ------------------------------------------------------------------ the course, built
const INK = '#2b211f';
const tag = (m) => { m.userData.noCollide = true; return m; };

function* buildSki(scene) {
  const terrain = yield* Terrain.make({
    size: 1400, seg: 560, height: (x, z) => courseHeight(x, z),
    material: { color: '#efd29b', color2: '#f5e1b6', color3: '#dca57a', mode: MODE_TERRAIN, ripples: true, sandInk: true },
  });
  scene.add(terrain.mesh);
  yield;
  const H = (x, z) => terrain.heightAt(x, z);
  const ink = makeMaterial({ color: INK, flat: true });
  const wood = makeMaterial({ color: '#a8683f', color2: '#8c5533' });
  const cloth = { red: makeMaterial({ color: '#d9643a', side: THREE.DoubleSide }), blue: makeMaterial({ color: '#3f5fae', side: THREE.DoubleSide }),
    cream: makeMaterial({ color: '#f7ecd2', side: THREE.DoubleSide }), passed: makeMaterial({ color: '#71d7cf', glow: 0.6, side: THREE.DoubleSide }),
    missed: makeMaterial({ color: '#8f8577', side: THREE.DoubleSide }) };
  const stone = makeMaterial({ color: '#c9a27e', color2: '#b98d6a', color3: '#9c7457', mode: MODE_STRATA, strataSize: 6 });

  // the gates: two poles, each with a pennant, alternating rust and cobalt down the course
  const gates = courseGates();
  const pole = new THREE.CylinderGeometry(0.07, 0.09, 3.4, 6).translate(0, 1.7, 0);
  const pennant = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([0, 3.35, 0, 0, 2.25, 0, 1.45, 2.8, 0.0], 3));
  pennant.computeVertexNormals();
  gates.forEach((g, i) => {
    const grp = new THREE.Group();
    const colour = i % 2 ? cloth.blue : cloth.red;
    g.flags = [];
    for (const s of [-1, 1]) {
      const x = g.x + s * g.w / 2, y = H(x, g.z);
      const p = tag(new THREE.Mesh(pole, ink)); p.position.set(x, y - 0.1, g.z);
      const f = tag(new THREE.Mesh(pennant, colour)); f.position.set(x, y - 0.1, g.z); f.rotation.y = s < 0 ? Math.PI : 0;   // (each pennant flies outward)
      grp.add(p, f); g.flags.push(f);
    }
    g.colour = colour;
    scene.add(grp);
  });
  yield;

  // the lips: a striped stake at each end and a ridge of darker sand along the crest, so you see them coming
  const crest = makeMaterial({ color: '#d6ab72', color2: '#c99d66', flat: true });
  for (const L of COURSE.lips) {
    const cx = centerX(L), seg = [];
    for (let d = -40; d < 40; d += 2) {
      const x0 = cx + d, x1 = x0 + 2, y0 = H(x0, L), y1 = H(x1, L);
      const b = new THREE.BoxGeometry(Math.hypot(2, y1 - y0) + 0.05, 0.03, 0.32).rotateZ(Math.atan2(y1 - y0, 2)).translate((x0 + x1) / 2, (y0 + y1) / 2 + 0.02, L);
      seg.push(b.toNonIndexed());
    }
    scene.add(tag(new THREE.Mesh(mergeGeometries(seg), crest)));
    for (const s of [-1, 1]) {
      const x = cx + s * 30, y = H(x, L);
      const st = tag(new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 3.6, 6).translate(0, 1.8, 0), s > 0 ? cloth.red : cloth.cream));
      st.position.set(x, y, L);
      scene.add(st);
    }
  }

  // the start: a wooden gate on the plateau, a banner across
  const startArch = (z, w, h, colA, colB, bands) => {
    const grp = new THREE.Group(), cx = centerX(z), y = H(cx, z);
    for (const s of [-1, 1]) {
      const p = tag(new THREE.Mesh(new THREE.BoxGeometry(0.5, h, 0.5).translate(0, h / 2, 0), wood));
      p.position.set(cx + s * w / 2, H(cx + s * w / 2, z) - 0.2, z);
      grp.add(p);
    }
    const bw = w / bands;
    for (let i = 0; i < bands; i++) {
      const b = tag(new THREE.Mesh(new THREE.BoxGeometry(bw, 1.3, 0.12), i % 2 ? colA : colB));
      b.position.set(cx - w / 2 + bw * (i + 0.5), y + h - 0.9, z);
      grp.add(b);
    }
    scene.add(grp);
    return grp;
  };
  startArch(COURSE.startZ - 2, 14, 5.2, cloth.red, cloth.cream, 7);
  startArch(COURSE.finishZ, 34, 7.5, makeMaterial({ color: INK, side: THREE.DoubleSide }), cloth.cream, 12);
  yield;

  // mesas and needles beyond the dunes (the desert's own: strata, far off, for the eye to run toward)
  const rocks = [];
  const mesa = (x, z, r, h) => { const y = H(x, z); rocks.push(new THREE.CylinderGeometry(r * 0.82, r, h, 14, 4).translate(x, y + h / 2 - 4, z).toNonIndexed()); };
  mesa(-300, -660, 60, 150); mesa(290, -640, 55, 190); mesa(190, -700, 38, 170); mesa(-340, -200, 50, 120); mesa(340, 120, 60, 140);
  for (let i = 0; i < 18; i++) {
    const z = COURSE.startZ - 30 - i * 60, s = i % 2 ? 1 : -1, x = centerX(z) + s * (78 + (i * 37) % 40);
    const h = 9 + (i * 13) % 14;
    rocks.push(new THREE.CylinderGeometry(1.2 + (i % 3), 2.4 + (i % 4), h, 7).translate(x, H(x, z) + h / 2 - 1, z).toNonIndexed());
  }
  scene.add(tag(new THREE.Mesh(mergeGeometries(rocks), stone)));
  yield;

  const course = { gates, H, cloth, startZ: COURSE.startZ, finishZ: COURSE.finishZ };
  return arenaLevel({
    ground: terrain, name: 'The Long Dune', hour: 14.6,
    spawn: new THREE.Vector3(centerX(COURSE.startZ - 6), H(centerX(COURSE.startZ - 6), COURSE.startZ - 6), COURSE.startZ - 6),
    features: { mount: false, wind: true, jetpack: false, climb: false },
    course,
  });
}

// ------------------------------------------------------------------ the traveller on skis
function skiModel() {
  const g = new THREE.Group();
  const top = makeMaterial({ color: '#ef8a52', color2: '#d9643a' }), base = makeMaterial({ color: '#2b211f', flat: true });
  for (const s of [-1, 1]) {
    const ski = new THREE.Group();
    const board = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.03, 1.7), top);
    const sole = new THREE.Mesh(new THREE.BoxGeometry(0.115, 0.012, 1.7).translate(0, -0.02, 0), base);
    const tip = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.03, 0.26), top);
    tip.position.set(0, 0.06, 0.92); tip.rotation.x = -0.55;
    ski.add(board, sole, tip);
    ski.position.set(s * 0.11, 0.035, 0.08);
    g.add(ski);
  }
  g.traverse((o) => { o.userData.noCollide = true; });
  return g;
}

const _m = new THREE.Matrix4(), _up = new THREE.Vector3(), _f = new THREE.Vector3(), _r = new THREE.Vector3(), _q = new THREE.Quaternion();

/** The traveller's pose on the skis (the rig the body follows: src/player.js buildCharacter), crouch 0..1, lean (rad, > 0 right). */
function poseSkier(player, S, dt, t) {
  const c = player.char, k = S.crouch;
  const th1 = -(0.3 + 0.85 * k), th2 = 0.55 + 1.15 * k;   // the hips forward, the knees bent
  const drop = 0.5 * Math.cos(th1) + 0.48 * Math.cos(th1 + th2);
  for (let i = 0; i < 2; i++) {
    const side = i ? -1 : 1;
    c.legs[i].rotation.set(th1 + (S.air ? side * 0.06 : 0), 0, side * 0.05);
    c.knees[i].rotation.x = th2;
    c.feet[i].rotation.set(-(th1 + th2) + 0.05, 0, 0);
  }
  c.body.position.set(0, drop - 0.96 + 0.02, 0);
  c.body.rotation.set(0, 0, S.lean);
  c.torso.rotation.set(0.22 + 0.55 * k, 0, -S.lean * 0.25);
  const flap = S.air ? Math.sin(t * 9) * 0.08 : 0;
  c.arms[0].rotation.set(-0.5 - 0.6 * k + flap, 0, -0.45 + 0.2 * k - S.lean * 0.3);
  c.arms[1].rotation.set(-0.5 - 0.6 * k - flap, 0, 0.45 - 0.2 * k - S.lean * 0.3);
  c.elbows[0].rotation.x = c.elbows[1].rotation.x = -0.5 - 0.7 * k;
  c.head.rotation.set(-0.15 - 0.45 * k, 0, -S.lean * 0.3);
  c.hatTip.rotation.x = -0.4 - Math.min(S.speed / 30, 1) * 0.6 + Math.sin(t * 22) * 0.06;
  for (const fl of c.flames) fl.visible = false;
  player._gait = null;
}

/** Where the body stands: on the skis, square to the slope (in the air, level), facing along them. */
function placeSkier(player, S, ground, dt) {
  const { gx, gz } = slopeAt(ground, S.x, S.z, 0.9);
  const want = S.air ? _up.set(0, 1, 0) : _up.set(-gx, 1, -gz).normalize();
  player._skiUp = (player._skiUp ?? new THREE.Vector3(0, 1, 0)).lerp(want, 1 - Math.exp(-12 * dt)).normalize();
  const U = player._skiUp;
  _f.set(Math.sin(S.heading), 0, Math.cos(S.heading)).addScaledVector(U, -_f.dot(U)).normalize();
  _r.crossVectors(U, _f);
  _m.makeBasis(_r, U, _f);
  player.object.quaternion.setFromRotationMatrix(_m);
  player.object.position.set(S.x, S.y, S.z);
  player.pos.set(S.x, S.y, S.z);
  player.vel.set(S.vx, S.vy, S.vz);
  player.heading = S.heading;
  player.onGround = !S.air;
}

// ------------------------------------------------------------------ the spray of sand
// (short inked dashes in the sand's tones, thrown off the edges: the fluid tool's own dots, src/fluid-tool.js)
const SAND = ['#e7c38a', '#d9ae73', '#f2dcae', '#b98d5a'];
const _sp = new THREE.Vector3(), _sv = new THREE.Vector3(), _UP = new THREE.Vector3(0, 1, 0);

// ------------------------------------------------------------------ the game
function start(ctx) {
  const { player, camera, level, sfx } = ctx;
  const C = level.course, ground = C.H;
  const z0 = C.startZ - 6;
  const S = newSkier(centerX(z0), z0, Math.PI, ground);
  const skis = skiModel();
  player.object.add(skis);
  const spray = new Dots(ctx.scene, 260, makeMaterial({ color: '#ffffff', flat: true, key: 'ski-spray' }));
  (level.noShadow ??= []).push(spray.mesh);
  // the gates back to their colours
  for (const g of C.gates) { g.state = null; for (const f of g.flags) f.material = g.colour; }
  const run = { passed: 0, missed: 0, top: 0, longest: 0, takeoff: null, spins: 0, done: false };
  const cam = { pos: new THREE.Vector3(S.x, S.y + 4, S.z + 10), look: new THREE.Vector3(S.x, S.y + 1, S.z - 12) };
  let t = 0;
  const _look = new THREE.Vector3(), _want = new THREE.Vector3();

  function updateCamera(dt, snap = false) {
    const sp = S.speed, k = Math.min(sp / 34, 1);
    // behind the skis and the way you go, a little higher in the air
    const vdir = sp > 2 ? Math.atan2(S.vx, S.vz) : S.heading;
    // past the line the camera swings round to the front, as the skier skids to a stop (a finish's shot)
    run.swing = run.done ? Math.min(1, (run.swing ?? 0) + dt / 2.2) : 0;
    const a = vdir + wrap(S.heading - vdir) * 0.35 + 2.3 * smooth(0, 1, run.swing);
    const back = 6.4 + 2.6 * k, up = 2.5 + 0.8 * k + (S.air ? 0.6 : 0);
    _want.set(S.x - Math.sin(a) * back, S.y + up, S.z - Math.cos(a) * back);
    const floor = ground(_want.x, _want.z) + 1.3;
    if (_want.y < floor) _want.y = floor;
    _look.set(S.x + Math.sin(a) * (5 + 6 * k), S.y + 0.6, S.z + Math.cos(a) * (5 + 6 * k));
    const f = snap ? 1 : 1 - Math.exp(-7 * dt);
    cam.pos.lerp(_want, f);
    cam.look.lerp(_look, snap ? 1 : 1 - Math.exp(-10 * dt));
    camera.position.copy(cam.pos);
    camera.up.set(0, 1, 0);
    camera.lookAt(cam.look);
    ctx.setFov(58 + 16 * k);
  }

  function landed(e) {
    if (run.takeoff) {
      const d = Math.hypot(S.x - run.takeoff.x, S.z - run.takeoff.z);
      run.longest = Math.max(run.longest, d);
      run.takeoff = null;
      if (e.clean && d > 14) ctx.flash(`${d.toFixed(0)} m jump`, 'good', 1.0);
    }
    sfx.land(Math.min(e.impact / 12, 1));
    if (!e.clean) { ctx.flash('Sloppy landing', 'bad'); ctx.kick(0.7); return; }
    if (e.impact > 6) ctx.kick(Math.min(e.impact / 20, 0.6));
    if (e.spins > 0) {
      run.spins += e.spins;
      ctx.flash(`${e.spins * 360}°! −${e.spins} s`, 'good', 1.3);
      ctx.addTime(-e.spins, '');   // (a spin landed clean takes a second off for each turn)
    }
  }

  updateCamera(0, true);
  placeSkier(player, S, ground, 1);
  poseSkier(player, S, 0, 0);
  ctx.status('0 km/h');

  return {
    update(dt, inp, { live, phase }) {
      t += dt;
      const moving = live || phase === 'finishing';
      if (moving) {
        // past the finish: a long skid to a stop
        const ii = run.done ? { x: 0, tuck: 0, brake: 0.8, jumpPressed: false } : inp;
        const x0 = S.x, z0p = S.z;
        for (const e of skiStep(S, ii, dt, ground)) {
          if (e.kind === 'pop' || e.kind === 'air') { run.takeoff = { x: S.x, z: S.z }; if (e.kind === 'pop') sfx.jump(); }
          if (e.kind === 'land') landed(e);
        }
        run.top = Math.max(run.top, S.speed);
        if (!run.done) {
          for (const g of C.gates) {
            if (g.state) continue;
            const r = crossGate(g, x0, z0p, S.x, S.z);
            if (!r) continue;
            g.state = r;
            for (const f of g.flags) f.material = r === 'pass' ? C.cloth.passed : C.cloth.missed;
            if (r === 'pass') { run.passed++; sfx.gate(); }
            else { run.missed++; sfx.miss(); ctx.addTime(COURSE.penalty, `Missed a gate · +${COURSE.penalty} s`); }
          }
          if (z0p > C.finishZ && S.z <= C.finishZ) {
            run.done = true;
            const n = C.gates.length;
            ctx.finish({ lines: [
              `Gates ${run.passed} of ${n}${run.missed ? ` · ${run.missed} missed (+${run.missed * COURSE.penalty} s)` : ' · every one'}`,
              `Top speed ${Math.round(run.top * 3.6)} km/h · longest jump ${run.longest.toFixed(0)} m`,
              ...(run.spins ? [`Spins landed: ${run.spins} (−${run.spins} s)`] : []),
            ] });
          }
        }
      }
      // the sand thrown up by the edges: the harder the carve or the skid, the more
      if (!S.air && S.speed > 4) {
        const k = Math.min(1, S.slide / 4 + S.speed / 60 + (inp.brake ?? 0) * 0.6);
        const nEmit = Math.random() < k * 1.8 ? 1 + Math.floor(k * 5) : 0;
        const dx = Math.sin(S.heading), dz = Math.cos(S.heading), side = Math.sign(S.turnRate || 1);
        for (let i = 0; i < nEmit; i++) {
          const out = 2 + 4 * Math.random();
          _sp.set(S.x - dx * 0.6 + dz * 0.12 * side, S.y + 0.06, S.z - dz * 0.6 - dx * 0.12 * side);
          _sv.set(S.vx * 0.55 + dz * side * out + (Math.random() - 0.5), 1.5 + 3.5 * Math.random() * k, S.vz * 0.55 - dx * side * out + (Math.random() - 0.5));
          spray.add({ pos: _sp, vel: _sv, grav: 14, drag: 2.5, size: 0.009 + 0.012 * Math.random(), stretch: 4, life: 0.35 + 0.4 * Math.random(), color: SAND[(Math.random() * SAND.length) | 0] });
        }
        if (ctx.wind && Math.random() < k * 0.7) ctx.wind.emit(S.x - dx * 1.2, S.z - dz * 1.2, S.vx * 0.3 + dz * side * 3, S.vz * 0.3 - dx * side * 3);
      }
      spray.list = spray.list.filter((d) => d.pos.y > ground(d.pos.x, d.pos.z) + 0.02);   // (a grain back on the sand is gone, not sunk into it)
      spray.update(dt, _UP);
      placeSkier(player, S, ground, dt);
      poseSkier(player, S, dt, t);
      player.humanoid?.update();
      player.humanoid?.resetFeet();
      player.humanoid?.updateEyes?.(dt, null);
      player.updateCloth?.(dt);
      updateCamera(dt);
      ctx.speed(Math.max(0, Math.min(1, (S.speed - 17) / 18)));
      ctx.status(`${Math.round(S.speed * 3.6)} km/h`);
    },
    end() {
      skis.removeFromParent();
      spray.mesh.removeFromParent();
      const i = level.noShadow.indexOf(spray.mesh); if (i >= 0) level.noShadow.splice(i, 1);
      ctx.speed(0);
      player._skiUp = null;
    },
  };
}

export default {
  id: 'ski', order: 1,
  name: 'Dune skiing',
  blurb: 'Sand-skis down the Long Dune: carve between the gates, tuck for speed, fly off the lips.',
  rules: 'Pass between the poles of every gate (a missed one costs 3 s) and cross the line at the bottom. Fastest run wins; a spin landed clean takes a second off.',
  controls: {
    pad: [['Left stick', 'carve left / right'], ['RT / R2', 'tuck: less drag, wider turns'], ['LT / L2', 'skid to brake'], ['A / ×', 'pop off the ground (off a lip: big air)'], ['Left stick in the air', 'spin'], ['Menu', 'pause']],
    keys: [['A  D', 'carve left / right'], ['Shift', 'tuck: less drag, wider turns'], ['S', 'skid to brake'], ['Space', 'pop off the ground (off a lip: big air)'], ['A  D in the air', 'spin'], ['Esc', 'pause']],
    touch: [['Stick', 'carve; pull back to brake'], ['Jump', 'pop'], ['Stick in the air', 'spin']],
  },
  score: { kind: 'time' },
  hud: { timer: true },
  color: '#d9643a',
  build: buildSki,
  start,
};
