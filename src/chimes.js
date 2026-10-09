import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeMaterial } from './materials.js';
import { CRYSTAL_ATTR } from './crystal-shader.js';
import { ARCHETYPES, BUILT } from './enemies/archetypes.js';

// Chimes, the currency (docs/systems/items.md, "Chimes"): small floating crystals, splinters of the singing
// mineral that ring like struck glass (brass discs until October 2026). The wallet is
// src/resources.js (resources.chimes, addChimes, spend, the 'wallet' event); this module is where they come
// from and how they lie in the world:
//
//   dropAmount({ kind }, rng)             what a foe cut down leaves (DROP_OF by kind: the old kinds', and each
//                                         built archetype's own drop, src/enemies/archetypes.js), a little spread
//   dropPolicy(level)                     'on' | 'training' (the Arena: into the wallet, not counted as earned)
//                                         | 'off' (a game's own foes: Ink tide; or level.foes.chimes false)
//   PURSE                                 the one-time purses: a temple's guardian, a makers' run's first finish
//   pieceValues(n)                        the pieces a drop scatters (ones; fives for a big drop)
//   ChimeField                            the pieces: pop out in a little arc, bounce, hover and turn, glint;
//                                         walked over (PIECE.take) or drawn in (PIECE.magnet) they are picked
//                                         up; left, they blink (PIECE.blink) and are gone after PIECE.life s
//   ChimeView                             draws a field (instanced shards, clusters for the fives, glints; the
//                                         crystal shader: src/crystal-shader.js)

/** What a foe of each kind leaves, in chimes (a fraction is a chance of one: the swarm's six blots, the splinters). */
export const DROP_OF = {
  swarm: 0.5, moth: 1,                                 // the small ones, that come in groups
  blot: 2, spitter: 3, drone: 4,
  stalker: 5, machine: 6,
  shade: 8, golem: 8, slag: 8,                         // the heavy ones
  // the built archetypes: the shellback crab 5, the horn lizard 4, the lamp tripod 6, the antler hound 4 (the blot's 2 as ever)
  ...Object.fromEntries(BUILT.map((a) => [ARCHETYPES[a].kind, ARCHETYPES[a].drop])),
};
/** The one-time purses: each temple's guardian resolved (and each sparring bout in the Arena's ring), a makers' run's first finish. */
export const PURSE = { guardian: 40, run: 15 };
/** The spread round a drop's base (±), never under one. */
export const SPREAD = 0.25;

/** Chimes a foe cut down leaves: { kind }. rng in [0, 1). */
export function dropAmount({ kind = null } = {}, rng = Math.random) {
  const base = DROP_OF[kind] ?? 1;
  if (base < 1) return rng() < base ? 1 : 0;
  return Math.max(1, Math.round(base * (1 - SPREAD + rng() * SPREAD * 2)));
}

/** Whether foes drop chimes in this level: 'off' (a game's own foes, or level.foes.chimes false), 'training' (the Arena's waves and list), 'on'. */
export function dropPolicy(level) {
  const F = level?.foes ?? {};
  if (F.chimes === false || F.own) return 'off';
  if (F.chimes === 'training' || F.waves) return 'training';
  return 'on';
}

/** The pieces a drop of n chimes scatters: ones, and for a big drop (PIECE.fiveFrom and over) fives first. */
export function pieceValues(n) {
  n = Math.max(0, Math.floor(n));
  if (n < PIECE.fiveFrom) return Array(n).fill(1);
  return [...Array(Math.floor(n / 5)).fill(5), ...Array(n % 5).fill(1)];
}

/**
 * The pieces' tuning (m, s). flight: s in the air; spread: m out from where it fell; rise: m the arc goes up;
 * hover: m of air under its lowest point at rest (the centre is higher by pieceBelow: a five's foot reaches further down
 * than a one's), the middle of its bob; wait: s before it can be picked up (it is seen popping out first); magnet:
 * m from the traveller's middle it is drawn in from; take: m it is picked up at; pull: m/s² drawn in; life: s
 * on the ground; blink: s before the end it blinks; glint: s between a piece's glints; turn: rad/s it turns at rest;
 * bob: its rise and fall at rest [m, rad/s].
 */
export const PIECE = {
  flight: [0.45, 0.7], spread: [0.5, 1.7], rise: [1.1, 1.9], bounce: 0.22, bounceT: 0.24, hover: 0.4,
  wait: 0.45, magnet: 2.4, take: 0.65, pull: 30, life: 30, blink: 5, glint: [1.6, 3.6], max: 160, fiveFrom: 10,
  turn: 1.7, bob: [0.045, 1.9],
};

/** Whether a piece is drawn this moment: always, but in its last PIECE.blink s it blinks, faster towards the end. */
export function pieceVisible(p) {
  if (p.phase === 'pull') return true;
  const left = PIECE.life - p.age;
  if (left > PIECE.blink) return true;
  const rate = left > PIECE.blink / 2 ? 5 : 10;   // (blinks a second)
  return Math.floor(p.age * rate * 2) % 2 === 0;
}

const lerp = (a, b, k) => a + (b - a) * k;

let _below = null;
/**
 * How far below its centre a piece's lowest point lies as it hovers (tilted by CRYSTAL.tilt; its turn round the
 * vertical changes nothing): the one's shard, the five's cluster, worked out once from their geometry (m).
 */
export function pieceBelow(value = 1) {
  _below ??= Object.fromEntries([[1, crystalGeometry()], [5, clusterGeometry()]].map(([v, g]) => {
    g.rotateZ(CRYSTAL.tilt); g.computeBoundingBox(); g.dispose();
    return [v, -g.boundingBox.min.y];
  }));
  return value > 1 ? _below[5] : _below[1];
}
/** A piece's centre over the ground at rest (the middle of its bob): PIECE.hover of air under its lowest point. */
export const restHeight = (value = 1) => PIECE.hover + pieceBelow(value);

/** The pieces lying in the world (pure: plain vectors; tested in node). */
export class ChimeField {
  /**
   * @param o.groundAt (x, y, z) → the ground's height under a point near y, or null (then it lands where it fell)
   * @param o.rng      [0, 1)
   * @param o.onTake   (piece) when one is picked up (main.js: into the wallet, the sound, the HUD)
   */
  constructor({ groundAt = null, rng = Math.random, onTake = () => {} } = {}) {
    Object.assign(this, { groundAt, rng, onTake });
    this.list = [];
  }

  /** Scatter n chimes from `at` (a foe's feet, a guardian's). `training`: the Arena's (carried on each piece). Returns the pieces. */
  drop(at, n, { training = false } = {}) {
    const out = [], r = this.rng;
    for (const value of pieceValues(n)) {
      if (this.list.length >= PIECE.max) this.list.shift();
      const a = r() * Math.PI * 2, d = lerp(PIECE.spread[0], PIECE.spread[1], r()) * (value > 1 ? 1.2 : 1);
      const to = new THREE.Vector3(at.x + Math.sin(a) * d, at.y, at.z + Math.cos(a) * d);
      const g = this.groundAt?.(to.x, at.y, to.z), up = new THREE.Vector3(0, 1, 0);
      if (Number.isFinite(g) && Math.abs(g - at.y) < 4) {
        to.y = g;   // (no ledge far below or above: it stays at the foe's height)
        // the ground's slope there (two more probes, once: its patch of shade lies on it)
        const gx = this.groundAt(to.x + 0.25, g, to.z), gz = this.groundAt(to.x, g, to.z + 0.25);
        if (Number.isFinite(gx) && Number.isFinite(gz) && Math.abs(gx - g) < 0.25 && Math.abs(gz - g) < 0.25) up.set(g - gx, 0.25, g - gz).normalize();
      }
      const p = {
        value, training: !!training, phase: 'fly', age: 0, t: 0,
        from: new THREE.Vector3(at.x, at.y + 0.6, at.z), to, rest: to.clone(), up, lift: restHeight(value),
        flight: lerp(PIECE.flight[0], PIECE.flight[1], r()), rise: lerp(PIECE.rise[0], PIECE.rise[1], r()),
        pos: new THREE.Vector3(at.x, at.y + 0.6, at.z), speed: 0, spin: r() * Math.PI * 2, glintIn: lerp(PIECE.glint[0], PIECE.glint[1], r()), glint: 0,
      };
      this.list.push(p); out.push(p);
    }
    return out;
  }

  /**
   * One frame. `player`: the traveller's feet (a point), or null (can't pick up: knocked out, in a scene).
   * `height`: from the feet to the traveller's middle (where pieces are drawn to). Returns the pieces picked up.
   */
  update(dt, player = null, { height = 0.9 } = {}) {
    const taken = [];
    const mid = player ? _mid.set(player.x, player.y + height, player.z) : null;
    for (const p of this.list) {
      p.age += dt; p.t += dt;
      p.spin += dt * (p.phase === 'pull' ? 14 : PIECE.turn);
      if (p.phase === 'fly') {
        const u = Math.min(1, p.t / p.flight);
        p.pos.set(lerp(p.from.x, p.to.x, u), lerp(p.from.y, p.to.y + p.lift, u) + 4 * p.rise * u * (1 - u), lerp(p.from.z, p.to.z, u));
        if (u >= 1) { p.phase = 'bounce'; p.t = 0; }
      } else if (p.phase === 'bounce') {
        const u = Math.min(1, p.t / PIECE.bounceT);
        p.pos.set(p.to.x, p.to.y + p.lift + 4 * PIECE.bounce * u * (1 - u), p.to.z);
        if (u >= 1) { p.phase = 'rest'; p.t = 0; }
      } else if (p.phase === 'rest') {
        p.pos.set(p.to.x, p.to.y + p.lift + Math.sin(p.age * PIECE.bob[1] + p.spin * 0.1) * PIECE.bob[0], p.to.z);
        p.glintIn -= dt;
        if (p.glintIn <= 0) { p.glint = 0.3; p.glintIn = lerp(PIECE.glint[0], PIECE.glint[1], this.rng()); }
      }
      p.glint = Math.max(0, p.glint - dt);
      if (!mid || p.age < PIECE.wait) continue;
      const d = p.pos.distanceTo(mid), feet = Math.hypot(p.pos.x - player.x, p.pos.z - player.z);
      // walked over (round the feet, up to the middle), or drawn in from the magnet's reach
      const over = feet < PIECE.take && p.pos.y > player.y - 0.5 && p.pos.y < player.y + height * 2;
      if (over || d < PIECE.take) { p.done = true; taken.push(p); continue; }
      if (p.phase !== 'pull' && d < PIECE.magnet) { p.phase = 'pull'; p.speed = 2; }
      if (p.phase === 'pull') {
        p.speed += PIECE.pull * dt;
        const step = Math.min(d, p.speed * dt);
        p.pos.addScaledVector(_dir.subVectors(mid, p.pos).normalize(), step);
        if (p.pos.distanceTo(mid) < PIECE.take * 0.5) { p.done = true; taken.push(p); }
      }
    }
    // the ones left too long go; the ones picked up, into the wallet
    this.list = this.list.filter((p) => !p.done && (p.phase === 'pull' || p.age < PIECE.life));
    for (const p of taken) this.onTake(p);
    return taken;
  }

  clear() { this.list = []; }
  /** Chimes lying about (the pieces' values). */
  get lying() { return this.list.reduce((s, p) => s + p.value, 0); }
}
const _mid = new THREE.Vector3(), _dir = new THREE.Vector3();

/**
 * The drops wired to the game's events (main.js; tests): 'foe:burst' scatters a foe's chimes where it fell (not
 * one lost out of the world or into deep water, none when the policy is 'off'); 'temple:resolved' a guardian's
 * purse, once per temple (flag res.purse.<id>); 'guardian:spar' (the Arena's ring) a purse each bout, as
 * training. `purseAt(pos)`: where a purse lands (main.js: on the floor between the guardian and you).
 * Returns a function that unhooks them.
 */
export function connectDrops(game, field, { policy = 'on', purseAt = (pos) => pos, sound = null, rng = Math.random } = {}) {
  const training = policy === 'training';
  const offs = [
    game.on('foe:burst', (e) => {
      if (policy === 'off' || e?.lost || !e?.pos) return;
      const n = dropAmount(e, rng);
      if (n) { field.drop(e.pos, n, { training }); sound?.chimeScatter?.(); }
    }),
    game.on('temple:resolved', ({ id, pos } = {}) => {
      const k = `res.purse.${id}`;
      if (!id || game.flag(k)) return;
      game.set(k, true);
      field.drop(purseAt(pos), PURSE.guardian); sound?.chimeScatter?.(true);
    }),
    game.on('guardian:spar', ({ pos } = {}) => {
      if (policy === 'off' || !pos) return;
      field.drop(purseAt(pos), PURSE.guardian, { training: true }); sound?.chimeScatter?.(true);
    }),
  ];
  return () => offs.forEach((off) => off?.());
}

// ------------------------------------------------------------------ the look
// Since October 2026 a chime is a floating crystal (references/Core Objects/Currency/Small Floating Crystal/
// reference-4.jpeg, the author's pick): a blunt, weathered shard of translucent cyan mineral with broad uneven
// facets and a pale lavender seam inside. It hovers tilted and turns, a light in it, and rings like struck glass
// when it is taken (audio.js crystalTing). A five is a little cluster: a larger, paler shard with two small ones
// grown at its foot. At first 3.4 cm long, too small to read from a few steps; since the same day the size of the
// brass coin it replaced (COIN), drawn by its own shader (src/crystal-shader.js).

/** The brass chime it replaced (until October 2026): a disc 0.12 m in radius (bevel aside), a five 1.45 × as wide. */
export const COIN = { r: 0.12, bevel: 0.0072, five: 1.45 };
/**
 * The crystal's size (m): a one's length (as tall, tilted, as the coin was wide), a five's (the cluster as much larger
 * as the coin's five), the hover's tilt, a glint's reach, and `twinkle`: the glint's share lit at rest (a faint spark;
 * it swells to the whole glint now and then, as the light catches an edge).
 */
export const CRYSTAL = { one: 0.275, five: 0.38, tilt: 0.42, glint: 0.09, twinkle: 0.1 };
/** The tones (vertex colours: the faces of a shard; the instance colour tints the whole: a five paler). */
export const CRYSTAL_TONES = { face: '#63d3e4', light: '#a9eef4', shade: '#3aa9c6', seam: '#b9a7e8' };
export const CHIME_TONES = { 1: '#ffffff', 5: '#e4fbff' };

const rand = (seed) => () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };

/**
 * One crystal shard (m), its long axis along +y, centred: an uneven six-sided prism whose ends close in blunt,
 * chisel-like points (not a needle), each face flat (its own normal: the facets print as planes). Vertex
 * colours: the faces cyan, lighter toward the light and darker away, the two faces of the seam lavender.
 * aCrystal (the crystal shader's, src/crystal-shader.js): xyz each corner's barycentric weight in its triangle,
 * a quad's diagonal held at 1 (no edge line across a facet), w the shard's length.
 * `length` the shard's length, `seed` its own unevenness. Non-indexed: position, normal, color, aCrystal.
 */
export function crystalGeometry(length = CRYSTAL.one, seed = 7) {
  const r = rand(seed * 7919 + 13), L = length, W = L * 0.27, sides = 6;
  // the girdle: two rings of six, each corner a little in or out (the weathered, asymmetric facets)
  const ring = (y, k) => Array.from({ length: sides }, (_, i) => {
    const a = (i / sides) * Math.PI * 2 + (r() - 0.5) * 0.35, w = W * k * (0.78 + r() * 0.4);
    return new THREE.Vector3(Math.cos(a) * w, y, Math.sin(a) * w * 0.82);
  });
  const lo = ring(-L * (0.2 + r() * 0.06), 1), hi = ring(L * (0.16 + r() * 0.06), 0.92);
  // blunt ends: a short chisel edge (two points) rather than a single tip
  const top = [new THREE.Vector3(W * 0.2, L * 0.5, (r() - 0.5) * W * 0.2), new THREE.Vector3(-W * 0.18, L * 0.47, (r() - 0.5) * W * 0.2)];
  const bot = [new THREE.Vector3(W * 0.14, -L * 0.5, (r() - 0.5) * W * 0.2), new THREE.Vector3(-W * 0.16, -L * 0.46, (r() - 0.5) * W * 0.2)];
  const C = CRYSTAL_TONES, sun = new THREE.Vector3(-0.5, 0.75, 0.45).normalize(), seamAt = Math.floor(r() * sides);
  const tris = [], centre = new THREE.Vector3();
  // (inner: the corner across from a quad's diagonal, whose barycentric weight is held at 1)
  const tri = (a, b, c, seam, inner = null) => {
    const n = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a)).normalize();
    // (facing outward: away from the shard's middle)
    if (n.dot(centre.copy(a).add(b).add(c).divideScalar(3)) < 0) { [b, c] = [c, b]; n.negate(); }
    const lit = n.dot(sun), tone = new THREE.Color(seam ? C.seam : C.face);
    if (!seam) tone.lerp(new THREE.Color(lit > 0 ? C.light : C.shade), Math.min(1, Math.abs(lit) * 0.9));
    tris.push([a, b, c, n, tone, [a, b, c].indexOf(inner)]);
  };
  for (let i = 0; i < sides; i++) {
    const j = (i + 1) % sides, seam = i === seamAt || i === (seamAt + 1) % sides;
    tri(lo[i], hi[i], hi[j], seam, hi[i]); tri(lo[i], hi[j], lo[j], seam, lo[j]);   // the prism's sides (their diagonal lo[i]–hi[j])
    // the top's and the foot's facets, each corner closing on the nearer point of the chisel
    const ti = hi[i].x >= 0 ? 0 : 1, tj = hi[j].x >= 0 ? 0 : 1, bi = lo[i].x >= 0 ? 0 : 1, bj = lo[j].x >= 0 ? 0 : 1;
    tri(hi[i], hi[j], top[ti]); if (ti !== tj) tri(hi[j], top[tj], top[ti]);
    tri(lo[i], lo[j], bot[bi]); if (bi !== bj) tri(lo[j], bot[bj], bot[bi]);
  }
  const P = new Float32Array(tris.length * 9), N = new Float32Array(tris.length * 9), K = new Float32Array(tris.length * 9), B = new Float32Array(tris.length * 12);
  tris.forEach(([a, b, c, n, col, inner], t) => [a, b, c].forEach((v, k) => {
    const o = t * 9 + k * 3, bary = [0, 0, 0, L];
    bary[k] = 1; if (inner >= 0) bary[inner] = 1;
    P.set([v.x, v.y, v.z], o); N.set([n.x, n.y, n.z], o); K.set([col.r, col.g, col.b], o); B.set(bary, t * 12 + k * 4);
  }));
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(P, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(N, 3));
  g.setAttribute('color', new THREE.BufferAttribute(K, 3));
  g.setAttribute(CRYSTAL_ATTR, new THREE.BufferAttribute(B, 4));
  return g;
}

/** A five: a larger shard (CRYSTAL.five long) with two small ones grown out at its foot, leaning away. */
export function clusterGeometry(length = CRYSTAL.five) {
  const big = crystalGeometry(length, 11);
  const a = crystalGeometry(length * 0.52, 23).rotateZ(0.75).translate(length * 0.17, -length * 0.26, length * 0.03);
  const b = crystalGeometry(length * 0.44, 31).rotateZ(-0.6).rotateY(1.9).translate(-length * 0.14, -length * 0.3, -length * 0.08);
  return mergeGeometries([big, a, b]);
}

/** A glint: a flat four-point star (the light catching an edge). */
export function glintGeometry(r = CRYSTAL.glint) {
  const s = new THREE.Shape(), k = r * 0.16;
  s.moveTo(0, r); s.lineTo(k, k); s.lineTo(r, 0); s.lineTo(k, -k); s.lineTo(0, -r); s.lineTo(-k, -k); s.lineTo(-r, 0); s.lineTo(-k, k); s.closePath();
  return new THREE.ShapeGeometry(s);
}

/**
 * The patch of shade under each piece (since the crystals cast no shadow, nothing else shows the air under them: a
 * floating thing with no shadow reads as lying on the ground). r: its radius under a one (m; a five's as much
 * larger as the crystal); dark: the ground's colour at its middle, multiplied; span: m above its rest at which it is
 * gone (it shrinks and fades as the piece bobs, bounces or flies up); lift: m off the ground along its slope; far:
 * m from the camera at which it has faded out (a few pixels across, it would only be a smudge).
 */
export const BLOB = { r: 0.18, dark: 0.5, span: 1.2, lift: 0.015, far: 45 };

/**
 * Where a piece's patch of shade lies (pure): out.pos (on the ground under it), out.up (the ground's slope), out.r
 * (m) and out.k (its strength, 0 none … 1). None for a piece being drawn in; in flight, under its path, fading as it
 * rises; at rest, a little smaller and fainter at the top of the bob.
 */
export function blobOf(p, out = { pos: new THREE.Vector3(), up: new THREE.Vector3(), r: 0, k: 0 }) {
  out.k = 0; out.r = 0;
  if (p.phase === 'pull') return out;
  if (p.phase === 'fly') {
    const u = Math.min(1, p.t / p.flight);
    out.pos.set(p.pos.x, lerp(p.from.y - 0.6, p.to.y, u), p.pos.z);
    out.up.set(0, 1, 0).lerp(p.up ?? _Y, u).normalize();
  } else { out.pos.copy(p.to); out.up.copy(p.up ?? _Y); }
  const above = p.pos.y - out.pos.y - (p.lift ?? restHeight(p.value));   // (over its rest: -bob … +bob at rest)
  const k = THREE.MathUtils.clamp(1 - (above + PIECE.bob[0]) / BLOB.span, 0, 1);
  const grow = p.phase === 'fly' ? Math.min(1, 0.4 + p.t * 3) : 1;
  out.k = k * grow;
  out.r = BLOB.r * (p.value > 1 ? CRYSTAL.five / CRYSTAL.one : 1) * (0.7 + 0.3 * k);
  return out;
}

/**
 * The patches' material: drawn into the G-buffer as the jump's shadow is (src/jump-shadow.js), multiplied into it,
 * but only the colour, softly (the light term, normals, depth and flags times one): no cast shadow's hard edge for
 * the ink pass to outline, just the ground a little darker under the crystal, fading out at its rim. Per instance:
 * the strength in instanceColor.r; it fades out from BLOB.far * 0.6 to BLOB.far from the camera.
 */
export function blobMaterial() {
  return new THREE.ShaderMaterial({
    name: 'chime-blob',
    glslVersion: THREE.GLSL3,
    uniforms: { uDark: { value: BLOB.dark }, uFar: { value: BLOB.far } },
    vertexShader: /* glsl */ `uniform float uFar;
      out vec2 vSpot;
      out float vK;
      void main() {
        vSpot = position.xz;
        vec4 p = vec4(position, 1.0);
        vK = 1.0;
        #ifdef USE_INSTANCING
        p = instanceMatrix * p;
        #endif
        #ifdef USE_INSTANCING_COLOR
        vK = instanceColor.r;
        #endif
        vec4 mv = modelViewMatrix * p;
        vK *= 1.0 - smoothstep(uFar * 0.6, uFar, -mv.z);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `precision highp float;
      uniform float uDark;
      in vec2 vSpot;
      in float vK;
      layout(location = 0) out highp vec4 gAlbedoLight;
      layout(location = 1) out highp vec4 gNormalDepth;
      layout(location = 2) out highp vec4 gHatch;
      void main() {
        float r2 = dot(vSpot, vSpot);
        if (r2 >= 1.0 || vK <= 0.0) discard;
        float s = (1.0 - r2) * (1.0 - r2) * vK;   // (soft all the way out: dark in the middle, nothing at the rim)
        gAlbedoLight = vec4(vec3(1.0 - (1.0 - uDark) * s), 1.0);
        gNormalDepth = vec4(1.0);
        gHatch = vec4(1.0);
      }`,
    transparent: true, depthWrite: false, depthTest: true, side: THREE.DoubleSide,
    blending: THREE.CustomBlending, blendEquation: THREE.AddEquation,
    blendSrc: THREE.DstColorFactor, blendDst: THREE.ZeroFactor,
    blendSrcAlpha: THREE.DstAlphaFactor, blendDstAlpha: THREE.ZeroFactor,
    polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3,
  });
}

/** The crystals' material: the vertex colours under the crystal shader (src/crystal-shader.js), never black in shade. */
export const crystalLook = () => makeMaterial({ color: '#ffffff', vertexColors: true, crystal: true, spot: 0, key: 'chime-crystal' });

/**
 * Draws a ChimeField: the ones' shards and the fives' clusters (an instanced mesh each, one material: the crystal
 * shader), hovering tilted and turning round the vertical, with a faint spark facing the camera that swells into a
 * glint now and then.
 */
export class ChimeView {
  constructor(parent, max = PIECE.max) {
    const mat = crystalLook();
    const mesh = (geo, n) => { const m = new THREE.InstancedMesh(geo, mat, n); m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3); return m; };
    this.crystals = mesh(crystalGeometry(), max);
    this.clusters = mesh(clusterGeometry(), Math.ceil(max / 2));
    this.glints = new THREE.InstancedMesh(glintGeometry(), makeMaterial({ color: '#f4fdff', flat: true, glow: 1, side: THREE.DoubleSide, key: 'chime-glint' }), max);
    // the patch of shade on the ground under each (one more draw for the whole field: BLOB, blobOf)
    const disc = new THREE.CircleGeometry(1, 20).rotateX(-Math.PI / 2);
    this.blobs = new THREE.InstancedMesh(disc, blobMaterial(), max);
    this.blobs.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3);
    this.blobs.renderOrder = 6;
    this._blob = { pos: new THREE.Vector3(), up: new THREE.Vector3(), r: 0, k: 0 };
    // (no shadow: a crystal gives light rather than blocking it, and unculled as they are they would be drawn again in
    // every shadow pass, ~90 draws a frame in the desert for a field of them: shadows.js selfLitSkips)
    for (const m of this.meshes) { m.frustumCulled = false; m.count = 0; m.userData.noCollide = true; m.userData.castShadow = false; m.name = 'Chimes'; parent?.add(m); }
    this.blobs.name = 'Chimes shade';
    this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._t = new THREE.Quaternion(); this._s = new THREE.Vector3(); this._c = new THREE.Color();
  }
  get meshes() { return [this.crystals, this.clusters, this.glints, this.blobs]; }
  /** camera: the glints face it. */
  update(field, camera = null) {
    let i = 0, f = 0, j = 0, b = 0;
    for (const p of field.list) {
      if (!pieceVisible(p)) continue;
      const five = p.value > 1, s = five ? CRYSTAL.five / CRYSTAL.one : 1;
      const grow = p.phase === 'fly' ? Math.min(1, 0.4 + p.t * 3) : p.phase === 'pull' ? 0.85 : 1;
      // tilted, turning round the vertical (the tilt precesses: the shard's ends trace a small cone)
      this._q.setFromAxisAngle(_Y, p.spin).multiply(this._t.setFromAxisAngle(_Z, CRYSTAL.tilt));
      this._m.compose(p.pos, this._q, this._s.setScalar(grow));
      const into = five ? this.clusters : this.crystals, k = five ? f++ : i++;
      into.setMatrixAt(k, this._m);
      into.setColorAt(k, this._c.set(CHIME_TONES[p.value] ?? CHIME_TONES[1]));
      const sh = blobOf(p, this._blob);
      if (sh.k > 0.01) {
        this._m.compose(sh.pos.addScaledVector(sh.up, BLOB.lift), this._t.setFromUnitVectors(_Y, sh.up), this._s.set(sh.r, 1, sh.r));
        this.blobs.setMatrixAt(b, this._m);
        this.blobs.setColorAt(b++, this._c.setRGB(sh.k, sh.k, sh.k));
      }
      if (p.phase !== 'pull') {
        // the spark: CRYSTAL.twinkle of the glint at rest (breathing a little), the whole glint as the light catches it
        const g = Math.max(CRYSTAL.twinkle * (0.8 + 0.2 * Math.sin(p.age * 3 + p.spin)), p.glint > 0 ? Math.sin((1 - p.glint / 0.3) * Math.PI) : 0) * grow;
        // (at its upper end, as it turns, a little toward the camera)
        _gp.copy(p.pos).add(_off.set(0, CRYSTAL.one * 0.42 * s, 0).applyQuaternion(this._q).multiplyScalar(grow));
        if (camera) { _gp.addScaledVector(_off.subVectors(camera.position, _gp).normalize(), CRYSTAL.one * 0.2 * s); this._q.copy(camera.quaternion); } else this._q.identity();
        this._m.compose(_gp, this._q, this._s.setScalar(Math.max(0.01, g * s)));
        this.glints.setMatrixAt(j++, this._m);
      }
    }
    this.crystals.count = i; this.clusters.count = f; this.glints.count = j; this.blobs.count = b;
    for (const m of this.meshes) m.instanceMatrix.needsUpdate = true;
    for (const m of [this.crystals, this.clusters, this.blobs]) if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }
  dispose() {
    for (const m of this.meshes) { m.removeFromParent(); m.geometry.dispose(); m.dispose?.(); }
    this.blobs.material.dispose();
  }
}
const _gp = new THREE.Vector3(), _off = new THREE.Vector3(), _Y = new THREE.Vector3(0, 1, 0), _Z = new THREE.Vector3(0, 0, 1);
