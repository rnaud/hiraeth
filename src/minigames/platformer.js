// Sky steps, the platformer (docs/systems/minigames.md): a 2.5D course seen from the side, floating
// stones over the desert. The traveller runs and jumps along one plane (z = 0) with a platformer's tuning:
// coyote time, a buffered jump, a jump as high as the button is held. Stones that drift, stones that
// crumble under you, springs, glyph coins, checkpoints, three lives, and the makers' gate at the end.
//
// The course is data (COURSE) and its world is pure (PlatWorld: the movers, the crumbling stones, the
// coins; platStep: the body), so tests/minigames.test.js can play it through with a simple bot.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeMaterial, MODE_TERRAIN, MODE_STRATA } from '../materials.js';
import { Terrain } from '../world.js';
import { arenaLevel } from './kit/world.js';

// ------------------------------------------------------------------ the body (pure)
export const PLAT = {
  run: 8.6,          // m/s, top speed
  accel: 70,         // m/s² on the ground
  airAccel: 42,      // m/s² in the air
  friction: 60,      // m/s² stopping on the ground with no stick
  gravity: 40,       // m/s² going up with the button held
  fallGravity: 66,   // falling, or going up with the button let go (a short hop)
  jumpV: 15.2,       // m/s, the jump's start
  cut: 0.5,          // the rise kept when the button is let go early (variable height)
  coyote: 0.11,      // s after running off an edge that a jump still counts
  buffer: 0.13,      // s before landing that a press waits for the ground
  maxFall: 28,
  spring: 26.5,      // m/s, a spring's throw
  half: 0.32,        // the body's half width
  height: 1.7,
};

export function newBody(x, y) {
  return { x, y, vx: 0, vy: 0, onGround: true, coyoteT: 0, bufferT: 0, jumping: false, ground: null, facing: 1, airT: 0 };
}

const overlapX = (B, s, K) => B.x + K.half > s.x0 && B.x - K.half < s.x1;

/**
 * One step of the body among the solids ([{ x0, x1, y0, y1, oneWay, vx, vy }]: boxes; a oneWay stone
 * is landed on from above only). B changes in place; returns what happened
 * ([{ kind: 'jump' | 'land' | 'bonk' | 'spring' | 'coyote', … }]).
 * inp: { x (-1..1), jump (held), jumpPressed }
 */
export function platStep(B, inp, dt, solids, K = PLAT) {
  const ev = [];
  // carried by what you stand on (a drifting stone)
  if (B.onGround && B.ground) { const g = B.ground; B.x += g.dx ?? (g.vx ?? 0) * dt; B.y += g.dy ?? (g.vy ?? 0) * dt; }
  // run
  const want = (inp.x ?? 0) * K.run;
  const acc = B.onGround ? (Math.abs(want) < 0.01 ? K.friction : K.accel) : K.airAccel;
  const dv = want - B.vx;
  B.vx += Math.sign(dv) * Math.min(Math.abs(dv), acc * dt);
  if (Math.abs(inp.x ?? 0) > 0.2) B.facing = Math.sign(inp.x);
  // the jump: a press waits a moment for the ground (buffer); the ground waits a moment for a press (coyote)
  if (inp.jumpPressed) B.bufferT = K.buffer;
  else B.bufferT = Math.max(0, B.bufferT - dt);
  if (!B.onGround) B.coyoteT = Math.max(0, B.coyoteT - dt);
  if (B.bufferT > 0 && (B.onGround || B.coyoteT > 0)) {
    if (!B.onGround) ev.push({ kind: 'coyote' });
    B.vy = K.jumpV + Math.max(0, B.ground?.vy ?? 0);
    B.onGround = false; B.ground = null; B.coyoteT = 0; B.bufferT = 0; B.jumping = true;
    ev.push({ kind: 'jump' });
  }
  // the height of the jump: let go early and the rise is cut
  if (B.jumping && !inp.jump && B.vy > 0) { B.vy *= K.cut; B.jumping = false; }
  if (B.vy <= 0) B.jumping = false;
  if (!B.onGround) {
    const g = B.vy > 0 && inp.jump ? K.gravity : K.fallGravity;
    B.vy = Math.max(-K.maxFall, B.vy - g * dt);
    B.airT += dt;
  }
  // across, then up / down, each pushed out of the boxes
  B.x += B.vx * dt;
  for (const s of solids) {
    if (s.oneWay || s.gone) continue;
    if (B.y < s.y1 - 0.02 && B.y + K.height > s.y0 && overlapX(B, s, K)) {
      if (B.vx > 0 || B.x < (s.x0 + s.x1) / 2) B.x = s.x0 - K.half; else B.x = s.x1 + K.half;
      B.vx = 0;
    }
  }
  const y0 = B.y;
  if (!B.onGround) B.y += B.vy * dt;
  let landed = null;
  for (const s of solids) {
    if (s.gone || !overlapX(B, s, K)) continue;
    const top = s.y1;
    // standing on it, or landing on it: from above its top (a stone moving up meets the feet)
    const above = y0 >= top - 0.06 - Math.max(0, (s.vy ?? 0) * dt) - 1e-6;
    if (above && B.y <= top && B.vy <= (s.vy ?? 0) + 1e-6) {
      if (!landed || top > landed.y1) landed = s;
    } else if (!s.oneWay && B.vy > 0 && y0 + K.height <= s.y0 + 1e-6 && B.y + K.height > s.y0) {
      B.y = s.y0 - K.height; B.vy = 0; B.jumping = false; ev.push({ kind: 'bonk' });
    }
  }
  if (B.onGround) {
    // still on the ground? (it may have crumbled, or you ran off its end)
    const s = B.ground;
    const still = s && !s.gone && overlapX(B, s, K) && Math.abs(B.y - s.y1) < 0.25;
    if (still) { B.y = s.y1; B.vy = 0; }
    else {
      const other = landed;
      if (other && Math.abs(B.y - other.y1) < 0.25) { B.ground = other; B.y = other.y1; }
      else { B.onGround = false; B.ground = null; B.coyoteT = K.coyote; B.vy = Math.min(B.vy, 0); B.airT = 0; }
    }
  } else if (landed) {
    const impact = -B.vy;
    B.y = landed.y1; B.vy = 0; B.onGround = true; B.ground = landed; B.jumping = false;
    ev.push({ kind: 'land', impact, on: landed, airT: B.airT });
    B.airT = 0;
    if (B.bufferT > 0 && !landed.spring) {   // (pressed just before landing: off again at once)
      B.vy = K.jumpV; B.onGround = false; B.ground = null; B.bufferT = 0; B.jumping = true;
      ev.push({ kind: 'jump', buffered: true });
    }
  }
  // a spring under the feet (landed on, or walked onto): thrown up, higher with the button held
  if (B.onGround) {
    for (const s of solids) {
      if (!s.spring || s.gone || !overlapX(B, s, K) || Math.abs(B.y - s.y1) > 0.35) continue;
      B.vy = K.spring; B.onGround = false; B.ground = null; B.jumping = false; B.bufferT = 0;
      ev.push({ kind: 'spring', on: s });
      break;
    }
  }
  return ev;
}

// ------------------------------------------------------------------ the course (data)
// stones: [x0, x1, top, kind, extra]  kind: 'block' (solid, deep), 'float' (one-way slab), 'move' ({ dx, dy, period }),
// 'crumble', 'spring' (a spring set in a slab); coins: [x, y]; checkpoints: x; the goal: x
export const COURSE = {
  stones: [
    [-8, 10, 0, 'block'],
    [13, 17, 1.6, 'float'], [20, 24, 3.2, 'float'],
    [27, 37, 2, 'block'],
    [34.4, 36.2, 2, 'spring'],
    [40, 46, 9, 'float'],
    [49, 53, 7, 'move', { dx: 4.5, dy: 0, period: 4.2 }],
    [59, 69, 6, 'block'],
    [72, 75, 7, 'crumble'], [77.5, 80.5, 8, 'crumble'], [83, 86, 9, 'crumble'],
    [89, 97, 7, 'block'],
    [100, 104, 7.2, 'move', { dx: 0, dy: 4, period: 5 }],
    [107, 112, 12.2, 'float'],
    [115.5, 118.5, 11.5, 'float'], [122, 125, 10.5, 'float'],
    [129, 140, 8, 'block'],
    [137, 138.8, 8, 'spring'],
    [143, 148, 15, 'float'],
    [152, 156, 14, 'move', { dx: 5, dy: 0, period: 4.6 }],
    [165, 168, 13.2, 'crumble'], [171, 174, 12.4, 'crumble'],
    [177.5, 196, 10, 'block'],
  ],
  coins: [
    [5, 1.6], [7, 1.6], [15, 3.4], [22, 5], [29.5, 3.6], [31.5, 4.2], [33.5, 3.6],
    [35.3, 6], [35.3, 8.2], [38, 10.6], [42, 10.6], [44, 10.6], [51, 9.2], [55, 10], [58, 9.4],
    [63, 7.6], [65, 7.6], [67, 7.6], [73.5, 8.8], [79, 9.8], [84.5, 10.8], [91, 8.6], [94, 8.6],
    [102, 9], [102, 11.5], [109.5, 14], [117, 13.4], [120, 14.4], [123.5, 12.4], [131, 9.6], [134, 9.6],
    [137.9, 13], [137.9, 16], [140.5, 18], [145.5, 16.8], [154, 16], [160, 17.2], [166.5, 15], [172.5, 14.2], [182, 11.6],
  ],
  checkpoints: [0, 64, 133],
  goal: 190,
  killY: -9,
  lives: 3,
};

export const coinValue = 10, lifeBonus = 50;
/** The time's bonus at the goal: fast runs score more (nothing past par). */
export const timeBonus = (t, par = 60) => Math.max(0, Math.round((par - t) * 6));

/**
 * The course's world, pure: its stones where they are now (the movers move, the crumbling ones shake
 * and fall and come back), its coins. solids() is what platStep collides with.
 */
export class PlatWorld {
  constructor(C = COURSE) {
    this.C = C;
    this.t = 0;
    this.stones = C.stones.map(([x0, x1, top, kind, o = {}], i) => ({
      i, kind, x0, x1, y1: top, y0: kind === 'block' ? top - 40 : top - (kind === 'spring' ? 0.5 : 0.9),
      oneWay: kind !== 'block', spring: kind === 'spring', base: { x0, x1, top }, move: kind === 'move' ? o : null,
      vx: 0, vy: 0, crumble: kind === 'crumble' ? { t: -1, gone: 0 } : null, gone: false,
    }));
    // a spring stands on its stone: one step higher, so you land on it, not the stone round it
    for (const s of this.stones) if (s.spring) { s.y1 += 0.15; s.y0 = s.y1 - 0.5; }
    this.coins = C.coins.map(([x, y], i) => ({ i, x, y, taken: false }));
  }
  solids() { return this.stones; }
  /** Step the movers and the crumbling stones; `standing`: the stone the body stands on (it starts to crumble). */
  update(dt, standing = null) {
    this.t += dt;
    for (const s of this.stones) {
      if (s.move) {
        const { dx = 0, dy = 0, period = 4 } = s.move, w = (Math.PI * 2) / period;
        const ox = dx * Math.sin(this.t * w), oy = dy * Math.sin(this.t * w);
        s.vx = dx * w * Math.cos(this.t * w); s.vy = dy * w * Math.cos(this.t * w);
        const px = s.x0, py = s.y1;
        s.x1 = s.base.x1 + ox; s.x0 = s.base.x0 + ox; s.y1 = s.base.top + oy; s.y0 = s.y1 - 0.9;
        s.dx = s.x0 - px; s.dy = s.y1 - py;   // (how far it went this step: what it carries you)
      }
      const c = s.crumble;
      if (c) {
        if (s === standing && c.t < 0 && !s.gone) c.t = 0;
        if (c.t >= 0 && !s.gone) { c.t += dt; if (c.t >= CRUMBLE.shake) { s.gone = true; c.gone = 0; } }
        else if (s.gone) { c.gone += dt; if (c.gone >= CRUMBLE.back) { s.gone = false; c.t = -1; } }
      }
    }
  }
  /** Coins within reach of the body: taken (returned). */
  take(B, K = PLAT) {
    const got = [];
    for (const c of this.coins) {
      if (c.taken) continue;
      if (Math.abs(c.x - B.x) < 0.75 && c.y > B.y - 0.3 && c.y < B.y + K.height + 0.35) { c.taken = true; got.push(c); }
    }
    return got;
  }
  /** The checkpoint reached (the furthest one passed), as an x. */
  checkpointAt(x) { let best = this.C.checkpoints[0]; for (const c of this.C.checkpoints) if (x >= c - 0.5) best = Math.max(best, c); return best; }
  /** Where a checkpoint puts you back: on the stone under it. */
  spawnAt(cx) {
    const s = this.stones.find((q) => q.kind === 'block' && cx >= q.x0 && cx <= q.x1) ?? this.stones[0];
    return { x: cx, y: s.y1 };
  }
}
export const CRUMBLE = { shake: 0.55, back: 3.2 };

/** The highest stone top under x at or below y (for the feet and the shadow). */
export function topBelow(world, x, y, K = PLAT) {
  let best = -Infinity;
  for (const s of world.stones) if (!s.gone && x + 0.05 > s.x0 && x - 0.05 < s.x1 && s.y1 <= y + 0.05 && s.y1 > best) best = s.y1;
  return best;
}

/**
 * A simple player (the tests play the course through with it; the screenshots too): run right; at a stone's end
 * jump for the next when it is in reach; in the air steer for it. mem: {} kept between calls.
 */
export function botInput(W, B, mem) {
  const inp = { x: 1, jump: true, jumpPressed: false };
  if (!B.onGround) {
    const n = mem.target;
    if (n && B.vy < 4) { const c = (n.x0 + n.x1) / 2, d = c - B.x; inp.x = Math.abs(d) < 0.4 ? 0 : Math.sign(d) * Math.min(1, Math.abs(d)); if (B.x < n.x0 + 0.3) inp.x = 1; }
    return inp;
  }
  mem.target = null;
  inp.jump = false;   // (on the ground the button is let go: each jump is a fresh press)
  const s = B.ground; if (!s) return inp;
  const spring = W.stones.find((q) => q.spring && q.x0 >= s.x0 - 0.01 && q.x1 <= s.x1 + 0.01 && q.x1 > B.x);
  if (spring) { mem.target = W.stones.filter((q) => q.x0 > s.x1 - 0.5 && q !== spring).sort((a, b) => a.x0 - b.x0)[0]; return inp; }
  const ahead = W.stones.filter((q) => !q.gone && q !== s && q.x0 > s.x0 + 0.2 && !q.spring).sort((a, b) => a.x0 - b.x0);
  const n = ahead[0];
  if (!n) return inp;
  const edge = s.x1 - B.x, gap = n.x0 - s.x1, dh = n.y1 - s.y1;
  const reach = dh > 1.5 ? 3.4 : 4.6;
  const okNow = gap < reach && dh < 2.6 && (n.vx ?? 0) > -3;
  if (!okNow) { inp.x = edge < 0.9 ? 0 : 1; return inp; }
  if (edge < 0.7 || (gap < -0.5 && dh > 0.4 && edge < 2.5)) { inp.jumpPressed = inp.jump = true; mem.target = n; }
  return inp;
}

// ------------------------------------------------------------------ the course, built
const INK = '#2b211f';
const DEPTH = 3.2;   // the stones' depth along z (the plane runs through their middle)

function stoneGeometry(s) {
  const w = s.x1 - s.x0, h = s.kind === 'block' ? 14 : s.y1 - s.y0;
  // a block: a pillar of stone down into the haze; a slab: a thick, slightly bevelled stone
  const g = s.kind === 'block' ? new THREE.CylinderGeometry(1, 0.86, 1, 8, 1).scale(w * 0.5 / Math.cos(Math.PI / 8), h, DEPTH * 0.55).rotateY(Math.PI / 8)
    : new THREE.CylinderGeometry(1, 0.7, 1, 8, 1).scale(w * 0.5 / Math.cos(Math.PI / 8), h, DEPTH * 0.5).rotateY(Math.PI / 8);
  // (the flat top at y = 0, the body below)
  g.translate(0, -h / 2, 0);
  return g;
}

function* buildPlatformer(scene) {
  // far below: the desert, its dunes in the haze
  const terrain = yield* Terrain.make({
    size: 1600, seg: 160, height: (x, z) => -70 + 9 * Math.sin(x / 61 + z / 45) + 6 * Math.sin(x / 23 - z / 37) + 14 * Math.sin(z / 140),
    material: { color: '#efd29b', color2: '#f5e1b6', color3: '#dca57a', mode: MODE_TERRAIN, ripples: true, sandInk: true },
  });
  scene.add(terrain.mesh);
  yield;
  const world = new PlatWorld();
  const mats = {
    block: makeMaterial({ color: '#d8b48c', color2: '#c99d76', color3: '#a77b5c', mode: MODE_STRATA, strataSize: 1.1 }),
    float: makeMaterial({ color: '#e6cfae', color2: '#d4b48e', color3: '#b38f6d', mode: MODE_STRATA, strataSize: 0.6 }),
    crumble: makeMaterial({ color: '#c98f6a', color2: '#b0775a', color3: '#8f5c44', mode: MODE_STRATA, strataSize: 0.35, cracks: 1 }),
    move: makeMaterial({ color: '#7f9aa2', color2: '#6d878f', color3: '#5a7078', metal: 'iron' }),
    top: makeMaterial({ color: '#f3e2bf', color2: '#ead3a8' }),
    glow: makeMaterial({ color: '#71d7cf', glow: 1, flat: true }),
    ink: makeMaterial({ color: INK, flat: true }),
    coin: makeMaterial({ color: '#f2c54b', glow: 0.85, flat: true }),
    spring: makeMaterial({ color: '#d9643a' }),
    coil: makeMaterial({ color: '#c99d48', metal: 'brass' }),
    cloth: makeMaterial({ color: '#d9643a', side: THREE.DoubleSide }),
    reached: makeMaterial({ color: '#71d7cf', glow: 0.6, side: THREE.DoubleSide }),
    wood: makeMaterial({ color: '#a8683f', color2: '#8c5533' }),
  };
  const nodes = [];
  for (const s of world.stones) {
    const grp = new THREE.Group();
    if (s.spring) {
      // a spring: a coil and a red cap set in its slab
      const w = s.x1 - s.x0;
      const coil = new THREE.Mesh(new THREE.TorusGeometry(w * 0.3, 0.06, 6, 18).rotateX(Math.PI / 2), mats.coil);
      const coil2 = coil.clone(); coil.position.y = -0.3; coil2.position.y = -0.14;
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(w * 0.42, w * 0.46, 0.14, 14).translate(0, -0.03, 0), mats.spring);
      grp.add(coil, coil2, cap);
      grp.userData.cap = cap;
    } else {
      const body = new THREE.Mesh(stoneGeometry(s), mats[s.kind] ?? mats.float);
      const lid = new THREE.Mesh(new THREE.BoxGeometry(s.x1 - s.x0 - 0.1, 0.12, DEPTH * 0.82).translate(0, -0.05, 0), s.kind === 'move' ? mats.ink : mats.top);
      grp.add(body, lid);
      if (s.kind === 'crumble') {   // a crumbling stone: a crack drawn down its face, in ink
        const w = s.x1 - s.x0, pts = [];
        for (let k = 0; k <= 6; k++) pts.push(new THREE.Vector3((k % 2 ? 0.18 : -0.12) * w * 0.4 + (k - 3) * 0.05, -0.12 - k * 0.11, DEPTH * 0.5 + 0.01));
        const crack = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 18, 0.035, 4), mats.ink);
        const crack2 = crack.clone(); crack2.position.x = w * 0.28; crack2.scale.set(-0.8, 0.7, 1);
        grp.add(crack, crack2);
      }
      if (s.kind === 'move') {   // the makers' drifting slab: a glowing line along its face
        const strip = new THREE.Mesh(new THREE.BoxGeometry(s.x1 - s.x0 - 0.6, 0.08, 0.05).translate(0, -0.45, DEPTH * 0.5 + 0.02), mats.glow);
        grp.add(strip);
      }
    }
    grp.position.set((s.x0 + s.x1) / 2, s.y1, 0);
    // (the drifting and crumbling stones are drawn where the world has them; the feet stand on PlatWorld, not the collision)
    grp.traverse((o) => { if (s.move || s.crumble || s.spring) o.userData.noCollide = true; });
    scene.add(grp);
    nodes.push(grp);
  }
  yield;
  // the coins: a ring and the makers' stroke through it, glowing gold
  const coinGeo = mergeGeometries([new THREE.TorusGeometry(0.3, 0.07, 6, 18), new THREE.BoxGeometry(0.1, 0.42, 0.08)]);
  const coins = world.coins.map((c) => { const m = new THREE.Mesh(coinGeo, mats.coin); m.position.set(c.x, c.y, 0); m.userData.noCollide = true; scene.add(m); return m; });
  // the checkpoints: a post with a banner (teal once reached); the first is where you start
  const flags = COURSE.checkpoints.map((x, i) => {
    const sp = world.spawnAt(x), g = new THREE.Group();
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 3.2, 6).translate(0, 1.6, 0), mats.ink);
    const cloth = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.7).translate(0.58, 2.7, 0), i === 0 ? mats.reached : mats.cloth);
    g.add(post, cloth); g.position.set(x, sp.y, -1.1);
    g.traverse((o) => { o.userData.noCollide = true; });
    scene.add(g);
    return { g, cloth };
  });
  // the makers' gate at the end: two pillars, a lintel, a lamp over it
  {
    const sp = world.spawnAt(COURSE.goal), g = new THREE.Group();
    for (const s of [-1, 1]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.6, 5.2, 0.6).translate(s * 1.9, 2.6, 0), mats.block); g.add(p); }
    g.add(new THREE.Mesh(new THREE.BoxGeometry(5, 0.7, 0.8).translate(0, 5.4, 0), mats.block));
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.45, 14, 10).translate(0, 6.3, 0), mats.glow);
    g.add(lamp);
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.9).translate(0.85, 7.6, 0), mats.cloth);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.4, 6).translate(0, 7.0, 0), mats.ink);
    g.add(flag, pole);
    g.position.set(COURSE.goal, sp.y, -0.6);
    scene.add(g);
  }
  yield;
  // behind the course: stones that fell up, high in the sky (above the path, so none reads as a step), and
  // mesas on the desert far below
  const back = [];
  for (let i = 0; i < 16; i++) {
    const x = -70 + i * 19 + ((i * 37) % 11), z = -130 - ((i * 53) % 170), y = 30 + ((i * 29) % 34) + i * 0.6, r = 3 + ((i * 17) % 5) * 1.4;
    back.push(new THREE.CylinderGeometry(r, r * 0.45, r * 1.7, 7, 1).translate(x, y, z).toNonIndexed());
    back.push(new THREE.BoxGeometry(r * 1.6, r * 0.3, r * 1.4).translate(x, y + r * 0.85, z).toNonIndexed());
  }
  const mesas = [];
  for (const [x, z, r, h] of [[-120, -560, 70, 52], [70, -640, 90, 64], [260, -600, 60, 46], [420, -700, 100, 58]]) mesas.push(new THREE.CylinderGeometry(r * 0.85, r, h, 12, 3).translate(x, -70 + h / 2, z).toNonIndexed());
  const far = makeMaterial({ color: '#efdcc0', color2: '#e3cba9', color3: '#cdb08e', mode: MODE_STRATA, strataSize: 0.9 });   // (paler than the course's stones: the eye stays on the path)
  const backMesh = new THREE.Mesh(mergeGeometries(back), far); backMesh.userData.noCollide = true;
  const mesaMesh = new THREE.Mesh(mergeGeometries(mesas), mats.block); mesaMesh.userData.noCollide = true;
  scene.add(backMesh, mesaMesh);

  return arenaLevel({
    ground: terrain, name: 'The Sky Steps', hour: 17.2,
    spawn: new THREE.Vector3(0, 0, 0),
    plat: { world, nodes, coins, flags, mats },
    sky: {
      script: {
        day: ['#8fb3c9', '#f1d9bd', '#9aa6d3', '#fff3e2', '#ffeccc'],
        dusk: ['#7f8fc8', '#f2c49a', '#8a7fb8', '#ffe0c0', '#ffe2b8'],
        night: ['#1d2a52', '#4a5a8a', '#3d4380', '#8e9ccc', '#f2f0e6'],
      },
      planets: [{ el: 24, az: 200, size: 9, color: '#e9d7c0', ring: 0.6 }],
    },
  });
}

// ------------------------------------------------------------------ the game
const _q = new THREE.Quaternion();

function start(ctx) {
  const { player, camera, level, sfx } = ctx;
  const P = level.plat, W = new PlatWorld();   // (a fresh world each run: the coins back, the stones whole)
  const C = COURSE;
  let lives = C.lives, check = C.checkpoints[0], coins = 0, dying = 0, t = 0, heading = Math.PI / 2;
  const sp = W.spawnAt(check);
  const B = newBody(sp.x, sp.y);
  ctx.setLives(lives, C.lives);
  for (const m of P.coins) m.visible = true;
  P.flags.forEach((f, i) => { f.cloth.material = i === 0 ? P.mats.reached : P.mats.cloth; });
  const cam = { pos: new THREE.Vector3(B.x + 3, B.y + 3, 20), look: new THREE.Vector3(B.x + 3, B.y + 1.6, 0) };
  // the feet stand on the course's stones, as they are drawn (src/feet.js asks heightAbove / groundNormal)
  const feet = {
    heightAbove: (p, up, step = 0) => p.y - topBelow(W, p.x, p.y + step),
    groundNormal: (x, y, z, out = new THREE.Vector3()) => out.set(0, 1, 0),
    groundAt: (x, y) => topBelow(W, x, y),
  };
  const feet0 = player._feetGround;
  player._feetGround = feet;
  const prevStep = player.onStep;
  player.onStep = (p) => ctx.sound?.step?.(Math.abs(B.vx));   // (no prints in the air: a step's sound)

  function updateCamera(dt, snap = false) {
    cam.lead = (cam.lead ?? 0) + ((B.vx * 0.32 + B.facing * 1.6) - (cam.lead ?? 0)) * (1 - Math.exp(-2.5 * dt));
    // (the height follows the feet, ahead of a rise: a spring's throw is seen to its top)
    const ty = B.y + (B.onGround ? 0 : Math.max(-3, Math.min(4.5, B.vy * 0.25)));
    const ly = cam.ly = snap || cam.ly === undefined ? ty : cam.ly + (ty - cam.ly) * (1 - Math.exp(-(B.onGround || Math.abs(ty - cam.ly) > 2.5 ? 4.5 : 1.6) * dt));
    const want = new THREE.Vector3(B.x + cam.lead, ly + 2.8, 18.5);
    const look = new THREE.Vector3(B.x + cam.lead, ly + 1.4, 0);
    const k = snap ? 1 : 1 - Math.exp(-6 * dt);
    cam.pos.lerp(want, k); cam.look.lerp(look, k);
    camera.position.copy(cam.pos); camera.up.set(0, 1, 0); camera.lookAt(cam.look);
    ctx.setFov(36);
  }

  function respawn() {
    const s = W.spawnAt(check);
    Object.assign(B, newBody(s.x, s.y));
    heading = Math.PI / 2;
    updateCamera(0, true);
  }

  function pose(dt) {
    // face along the run, a little toward the camera
    const want = B.facing > 0 ? Math.PI / 2 - 0.32 : -Math.PI / 2 + 0.32;
    heading += Math.atan2(Math.sin(want - heading), Math.cos(want - heading)) * (1 - Math.exp(-16 * dt));
    player.pos.set(B.x, B.y, 0);
    player.vel.set(B.vx, B.onGround ? 0 : B.vy, 0);
    player.heading = heading;
    player.onGround = B.onGround;
    player._groundH = B.y - topBelow(W, B.x, B.y);
    player._moveDir = (player._moveDir ?? new THREE.Vector3()).set(Math.abs(B.vx) > 0.3 ? Math.sign(B.vx) : 0, 0, 0);
    player._wantSpeed = Math.abs(B.vx);
    (player._ridden ??= new THREE.Vector3()).set(B.onGround && B.ground?.move ? B.ground.vx * dt : 0, B.onGround && B.ground?.move ? B.ground.vy * dt : 0, 0);   // (a drifting stone takes the held feet along)
    player.finishFrame(dt, Math.abs(B.vx));
  }

  updateCamera(0, true);
  pose(1 / 60);
  ctx.status(`0 pts · ◈ 0/${W.coins.length}`);

  return {
    update(dt, inp, { live }) {
      t += dt;
      W.update(dt, B.onGround ? B.ground : null);
      if (dying > 0) {
        dying -= dt;
        if (dying <= 0) {
          if (lives <= 0) ctx.finish({ failed: true, title: 'Out of lives', score: coins * coinValue, lines: [`Glyphs ${coins} of ${W.coins.length}`] });
          else respawn();
        }
      } else if (live) {
        for (const e of platStep(B, inp, dt, W.solids())) {
          if (e.kind === 'jump') { sfx.jump(); player._jumped = player._jumpedNow = true; }
          if (e.kind === 'land') { player._impact = Math.min(1, e.impact / 30); if (e.impact > 8) sfx.land(Math.min(e.impact / 30, 1)); if (e.on.crumble) sfx.crumble(); }
          if (e.kind === 'spring') { sfx.spring(); ctx.kick(0.25); P.nodes[e.on.i].userData.cap && (P.nodes[e.on.i].userData.bounce = 1); }
          if (e.kind === 'bonk') ctx.kick(0.2);
        }
        if (B.onGround) player._jumped = false;
        for (const c of W.take(B)) { coins++; ctx.addScore(coinValue); sfx.coin(coins); P.coins[c.i].visible = false; }
        const cp = W.checkpointAt(B.x);
        if (cp > check && B.onGround) {
          check = cp; sfx.checkpoint(); ctx.flash('Checkpoint', 'good');
          const i = C.checkpoints.indexOf(cp); if (i >= 0) P.flags[i].cloth.material = P.mats.reached;
        }
        if (B.y < C.killY) {
          lives--; ctx.setLives(lives); dying = 0.9; sfx.hurt(); ctx.kick(0.5);
          ctx.flash(lives > 0 ? 'Fell!' : 'Out of lives', 'bad');
        }
        if (B.x >= C.goal && B.onGround) {
          const tb = timeBonus(ctx.time), lb = lives * lifeBonus;
          ctx.addScore(tb + lb);
          ctx.finish({ lines: [`Glyphs ${coins} of ${W.coins.length} (${coins * coinValue})`, `Lives left ${lives} (+${lb})`, `Time ${ctx.time.toFixed(1)} s (+${tb})`] });
        }
      }
      // the stones as the world has them: the drifting ones move, the crumbling ones shake, drop, come back
      for (const s of W.stones) {
        const n = P.nodes[s.i];
        if (s.move) n.position.set((s.x0 + s.x1) / 2, s.y1, 0);
        if (s.crumble) {
          const c = s.crumble;
          if (s.gone) { n.position.y = s.y1 - c.gone * c.gone * 9; n.visible = c.gone < 1.4; }
          else if (c.t >= 0) { n.visible = true; n.position.set((s.x0 + s.x1) / 2 + Math.sin(t * 60) * 0.05 * (c.t / CRUMBLE.shake), s.y1 - c.t * 0.1, 0); }
          else { n.visible = true; n.position.set((s.x0 + s.x1) / 2, s.y1, 0); }
        }
        if (s.spring) {
          const b = n.userData.bounce = Math.max(0, (n.userData.bounce ?? 0) - dt * 4);
          n.userData.cap.position.y = 0.12 * Math.sin(b * Math.PI);
        }
      }
      for (const m of P.coins) if (m.visible) m.rotation.y += dt * 2.4;
      if (dying > 0) { player.object.visible = Math.floor(dying * 12) % 2 === 0; }
      else player.object.visible = true;
      pose(dt);
      updateCamera(dt);
      ctx.status(`${ctx.score} pts · ◈ ${coins}/${W.coins.length}`);
    },
    world: W, body: B,   // (for the tests and the screenshots' bot: botInput)
    end() {
      player._feetGround = feet0;
      player.onStep = prevStep;
      player.object.visible = true;
      ctx.setLives(null);
    },
  };
}

export default {
  id: 'platformer', order: 2,
  name: 'Sky steps',
  blurb: 'A run along stones floating over the desert: seen from the side, jump from one to the next to the makers’ gate.',
  rules: 'Reach the gate at the far end. Glyphs score, so do the lives you keep and a quick run. A fall costs a life; you start again from the last banner.',
  controls: {
    pad: [['Left stick', 'run'], ['A / ×', 'jump (hold it to jump higher)'], ['A / × held on a spring', 'thrown higher'], ['Menu', 'pause']],
    keys: [['A  D  or  ← →', 'run'], ['Space', 'jump (hold it to jump higher)'], ['Space held on a spring', 'thrown higher'], ['Esc', 'pause']],
    touch: [['Stick', 'run'], ['⤒', 'jump (hold it to jump higher)']],
  },
  touchButtons: ['jump'],
  score: { kind: 'points', unit: 'pts' },
  hud: { timer: true, score: true },
  color: '#71d7cf',
  // (its arcade sign on Vael II: the start plateau's west rim, looking out at the stone columns and tables in
  // the cloud, facing back across the plateau; the height given: the ground from high up is not the plateau's there)
  markers: [{ level: 'arzach2', at: [-52, 40.33, -61], heading: Math.atan2(52, 61) }],
  build: buildPlatformer,
  start,
};
