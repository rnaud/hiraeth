import * as THREE from 'three';
import { makeMaterial } from './materials.js';
import { CRYSTAL_ATTR, CRYSTAL_GLOW_ATTR } from './crystal-shader.js';
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
//   TIERS, tierOf(value)                  the pieces' worths, like rupees: 1 cyan, 5 jade, 10 amber, 20 coral,
//                                         50 violet, 100 pearl (one shard, its colour, size and glow by worth)
//   pieceValues(n)                        the pieces a drop scatters (the fewest, by tier)
//   ChimeField                            the pieces: pop out in a little arc, bounce, hover and turn, glint;
//                                         walked over (PIECE.take) or drawn in (PIECE.magnet) they are picked
//                                         up; left, they blink (PIECE.blink) and are gone after PIECE.life s
//   ChimeView                             draws a field (one instanced mesh for every tier, the glints and the
//                                         drawn-in pieces' trails, the shade patches; the crystal shader:
//                                         src/crystal-shader.js)

/** What a foe of each kind leaves, in chimes (a fraction is a chance of one: a swarm's skitters). */
export const DROP_OF = {
  drone: 4, machine: 6,
  shade: 8, golem: 8, slag: 8,                         // the heavy ones
  // the built archetypes (their `drop`): the skitter ½, the moth 1, the blot 2, the toad and the heron 3, the root knot 5…
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

/**
 * The pieces' worths (since October 2026, like Zelda's rupees; a five was a paler cluster before): one shard design,
 * each worth its own colour, a little larger and glowing brighter the more it is worth, glinting more often. The
 * colours go round the Moebius palette and step in lightness too (cyan, jade, amber, coral, violet, pearl), so the
 * size and the glow tell them apart where the hue does not. size: × CRYSTAL.one; glow: 0 … 1 (the inner light's
 * strength over a one's, the glint's size and how often it comes).
 */
export const TIERS = [
  { value: 1, name: 'cyan', color: '#44d2ec', size: 1, glow: 0 },
  { value: 5, name: 'jade', color: '#52e07e', size: 1.08, glow: 0.2 },
  { value: 10, name: 'amber', color: '#ffc63a', size: 1.16, glow: 0.4 },
  { value: 20, name: 'coral', color: '#ff7560', size: 1.25, glow: 0.6 },
  { value: 50, name: 'violet', color: '#9d74ff', size: 1.36, glow: 0.8 },
  { value: 100, name: 'pearl', color: '#fff8e6', size: 1.5, glow: 1 },
];
const TIER_OF = new Map(TIERS.map((t) => [t.value, t]));
/** A piece's tier by its worth (a worth between tiers: the highest under it). */
export const tierOf = (value = 1) => TIER_OF.get(value) ?? [...TIERS].reverse().find((t) => t.value <= value) ?? TIERS[0];

/** The pieces a drop of n chimes scatters: the fewest, by tier (8: a five and three ones; a guardian's 40: two twenties). */
export function pieceValues(n) {
  n = Math.max(0, Math.floor(n));
  const out = [];
  for (let i = TIERS.length - 1; i >= 0; i--) for (const v = TIERS[i].value; n >= v; n -= v) out.push(v);
  return out;
}

/**
 * The pieces' tuning (m, s). flight: s in the air; spread: m out from where it fell; rise: m the arc goes up;
 * hover: m of air under its lowest point at rest (the centre is higher by pieceBelow: a larger tier's end reaches
 * further down), the middle of its bob; wait: s before it can be picked up (it is seen popping out first); magnet:
 * m from the traveller's middle it is drawn in from; take: m it is picked up at; pull: m/s² drawn in; drift: m/s it
 * sets off at; swirl: how far its path curves (the sideways share at the magnet's edge, nothing by the end); life: s
 * on the ground; blink: s before the end it blinks; glint: s between a piece's glints (a pearl's 0.65 × that); turn:
 * rad/s it turns at rest, spin: drawn in; bob: its rise and fall at rest [m, rad/s]; trail: the drawn-in piece's
 * trail of light [points, s between them].
 */
export const PIECE = {
  flight: [0.45, 0.7], spread: [0.5, 1.7], rise: [1.1, 1.9], bounce: 0.18, bounceT: 0.24, hover: 0.2,
  wait: 0.45, magnet: 2.4, take: 0.65, pull: 30, drift: 1.2, swirl: 0.9, life: 30, blink: 5, glint: [1.6, 3.6], max: 160,
  turn: 1.1, spin: 6, bob: [0.035, 1.9], trail: [12, 0.028],
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
 * vertical changes nothing): the shard's, worked out once from its geometry, times its tier's size (m).
 */
export function pieceBelow(value = 1) {
  if (_below === null) { const g = crystalGeometry().rotateZ(CRYSTAL.tilt); g.computeBoundingBox(); g.dispose(); _below = -g.boundingBox.min.y; }
  return _below * tierOf(value).size;
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
      const a = r() * Math.PI * 2, d = lerp(PIECE.spread[0], PIECE.spread[1], r()) * (value > 1 ? 1.15 : 1);
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
      p.spin += dt * (p.phase === 'pull' ? PIECE.spin : PIECE.turn);
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
        if (p.glintIn <= 0) { p.glint = 0.3; p.glintIn = lerp(PIECE.glint[0], PIECE.glint[1], this.rng()) * (1 - 0.35 * tierOf(p.value).glow); }
      }
      p.glint = Math.max(0, p.glint - dt);
      if (!mid || p.age < PIECE.wait) continue;
      const d = p.pos.distanceTo(mid), feet = Math.hypot(p.pos.x - player.x, p.pos.z - player.z);
      // walked over (round the feet, up to the middle), or drawn in from the magnet's reach
      const over = feet < PIECE.take && p.pos.y > player.y - 0.5 && p.pos.y < player.y + height * 2;
      if (over || d < PIECE.take) { p.done = true; taken.push(p); continue; }
      if (p.phase !== 'pull' && d < PIECE.magnet) { p.phase = 'pull'; p.speed = PIECE.drift; p.swirl = this.rng() < 0.5 ? -1 : 1; p.trail = []; p.trailT = 0; }
      if (p.phase === 'pull') {
        // drifting in on a gentle curve (sideways at first, straight at the end), faster and faster, a trail of light behind
        p.speed += PIECE.pull * dt;
        const step = Math.min(d, p.speed * dt);
        _dir.subVectors(mid, p.pos).normalize();
        _side.set(-_dir.z, 0, _dir.x).multiplyScalar(p.swirl * PIECE.swirl * Math.min(1, d / PIECE.magnet) ** 2);
        p.pos.addScaledVector(_dir.add(_side).normalize(), step);
        if ((p.trailT -= dt) <= 0) {
          p.trailT = PIECE.trail[1];
          const v = p.trail.length >= PIECE.trail[0] ? p.trail.pop() : new THREE.Vector3();
          p.trail.unshift(v.copy(p.pos));
        }
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
const _mid = new THREE.Vector3(), _dir = new THREE.Vector3(), _side = new THREE.Vector3();

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
// Since October 2026 a chime is a floating crystal. Its design is the author's pick of 9 October,
// references/Core Objects/Currency/Floating Chime/one/sheet-1.jpg ("love the design but they are too big"), with
// the small single crystal of five/sheet-1.jpg and the field of field/sheet-1.jpg ("love this"): a long, blunt,
// weathered shard of translucent mineral, thickest a little above its middle, many broad uneven flat facets, a flat
// little cap at the top and a blunt point below, a lavender seam running its length and a warm light at its heart.
// It floats upright (a slight lean), turning slowly, over its own small soft lavender shadow, and rings like struck
// glass when it is taken (audio.js crystalTing). Every worth is the same shard in its own colour (TIERS). Before:
// a 3.4 cm splinter, then a 27.5 cm shard leaning 0.42 rad (the brass coin's size, COIN) with a paler cluster for a
// five; drawn by its own shader (src/crystal-shader.js).

/** The brass chime the crystals replaced (until October 2026): a disc 0.12 m in radius (bevel aside), a five 1.45 × as wide. */
export const COIN = { r: 0.12, bevel: 0.0072, five: 1.45 };
/**
 * The crystal's size (m): a one's length (20 cm: the author found the coin-sized 27.5 cm too big; tried by eye from the
 * game's camera, 7 m behind the traveller, on the desert's sand, 16 cm read as a fleck and 18 cm barely; at 20 cm it is
 * still a shard there, over its shadow; a hundred is 30 cm), `girth` its widest radius
 * over its length (a long shard, about 3 × as long as wide), the hover's lean (`tilt`, rad), a glint's reach, and
 * `twinkle`: the glint's share lit at rest (a faint spark; it swells to the whole glint now and then, as the light
 * catches an edge).
 */
export const CRYSTAL = { one: 0.3, girth: 0.18, tilt: 0.12, glint: 0.09, twinkle: 0.1 };
/**
 * The tones (vertex colours: the faces of a shard). CRYSTAL_TONES: cyan with the lavender seam, for the crystals
 * drawn in the plain material (the shop's strings of chimes and its signs); CRYSTAL_NEUTRAL: the field's, pale greys
 * the instance colour (its tier) tints, the seam left to the crystal shader (its faces' negative length).
 */
export const CRYSTAL_TONES = { face: '#63d3e4', light: '#a9eef4', shade: '#3aa9c6', seam: '#b9a7e8' };
export const CRYSTAL_NEUTRAL = { face: '#f2f2f2', light: '#ffffff', shade: '#d4d4d4', seam: '#f2f2f2' };

const rand = (seed) => () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };

/**
 * One crystal shard (m), its long axis along +y, centred: a seven-sided shard in three bands of broad uneven facets,
 * the middle one long (each corner a little in or out, each ring twisted a little and off the axis: weathered, not
 * cut), its sides nearly parallel through its middle, closing in a small flat cap at the top and a blunt point below.
 * Each face flat (its own normal: the facets print as planes). One column of facets is the seam. Vertex colours: `tones`' face lighter toward the
 * light and darker away, the seam's column its seam tone.
 * aCrystal (the crystal shader's, src/crystal-shader.js): xyz each corner's barycentric weight in its triangle, the
 * corners across a hidden edge held at 1 (a quad's diagonal, the cap's spokes: no edge line across a facet), w the
 * shard's length, negative on the seam's faces.
 * Non-indexed: position, normal, color, aCrystal.
 */
export function crystalGeometry(length = CRYSTAL.one, seed = 7, tones = CRYSTAL_TONES) {
  const r = rand(seed * 7919 + 13), L = length, W = L * CRYSTAL.girth, sides = 7;
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  // the facets' columns: one set of angles for every ring, each uneven
  const turn = r() * Math.PI * 2, angles = Array.from({ length: sides }, (_, i) => turn + (i / sides) * Math.PI * 2 + (r() - 0.5) * 0.45);
  // (each ring twisted a little against the next, and its corners up or down: the facets uneven polygons, no ladder of rings)
  const ring = (y, k, dx, { jitter = 0.24, dy = 0.08, twist = (r() - 0.5) * 0.8 } = {}) => angles.map((a) => {
    const w = W * k * (1 - jitter / 2 + r() * jitter), b = a + twist + (r() - 0.5) * 0.14;
    return V(dx * L + Math.cos(b) * w, y * L + (r() - 0.5) * dy * L, Math.sin(b) * w * 0.82);
  });
  // the bands, foot to top (the rings a little off the axis: the shard leans and bows a touch), the cap flat
  const rings = [ring(-0.32, 0.8, -0.015), ring(0.1, 1.0, 0.02), ring(0.37, 0.84, 0.01), ring(0.5, 0.46, 0.0, { jitter: 0.12, dy: 0, twist: 0 })];
  const capMid = V(0, L * 0.5, 0), foot = V((r() - 0.5) * W * 0.25, -L * 0.5, (r() - 0.5) * W * 0.25);
  const sun = V(-0.5, 0.75, 0.45).normalize(), seamAt = Math.floor(r() * sides);
  const tris = [], centre = V(0, 0, 0);
  // (held: the corners across a hidden edge, whose barycentric weight is held at 1)
  const tri = (a, b, c, seam, held = []) => {
    const n = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a)).normalize();
    // (facing outward: away from the shard's middle)
    if (n.dot(centre.copy(a).add(b).add(c).divideScalar(3)) < 0) { [b, c] = [c, b]; n.negate(); }
    const lit = n.dot(sun), tone = new THREE.Color(seam ? tones.seam : tones.face);
    tone.lerp(new THREE.Color(lit > 0 ? tones.light : tones.shade), Math.min(1, Math.abs(lit) * (seam ? 0.15 : 0.9)));
    tris.push([a, b, c, n, tone, held.map((h) => [a, b, c].indexOf(h)), seam]);
  };
  for (let i = 0; i < sides; i++) {
    const j = (i + 1) % sides, seam = i === seamAt;
    for (let k = 0; k < rings.length - 1; k++) {
      const lo = rings[k], hi = rings[k + 1];
      tri(lo[i], hi[i], hi[j], seam, [hi[i]]); tri(lo[i], hi[j], lo[j], seam, [lo[j]]);   // (the band's quad: its diagonal lo[i]–hi[j] hidden)
    }
    const cap = rings[rings.length - 1];
    tri(cap[i], cap[j], capMid, false, [cap[i], cap[j]]);   // the cap: one flat facet (its spokes hidden)
    tri(rings[0][i], rings[0][j], foot, seam);                                 // the blunt point below
  }
  const P = new Float32Array(tris.length * 9), N = new Float32Array(tris.length * 9), K = new Float32Array(tris.length * 9), B = new Float32Array(tris.length * 12);
  tris.forEach(([a, b, c, n, col, held, seam], t) => [a, b, c].forEach((v, k) => {
    const o = t * 9 + k * 3, bary = [0, 0, 0, seam ? -L : L];
    bary[k] = 1; for (const h of held) bary[h] = 1;
    P.set([v.x, v.y, v.z], o); N.set([n.x, n.y, n.z], o); K.set([col.r, col.g, col.b], o); B.set(bary, t * 12 + k * 4);
  }));
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(P, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(N, 3));
  g.setAttribute('color', new THREE.BufferAttribute(K, 3));
  g.setAttribute(CRYSTAL_ATTR, new THREE.BufferAttribute(B, 4));
  return g;
}

/** A glint: a flat four-point star (the light catching an edge; small, the drawn-in piece's trail of light). */
export function glintGeometry(r = CRYSTAL.glint) {
  const s = new THREE.Shape(), k = r * 0.16;
  s.moveTo(0, r); s.lineTo(k, k); s.lineTo(r, 0); s.lineTo(k, -k); s.lineTo(0, -r); s.lineTo(-k, -k); s.lineTo(-r, 0); s.lineTo(-k, k); s.closePath();
  return new THREE.ShapeGeometry(s);
}

/**
 * The patch of shade under each piece (since the crystals cast no shadow, nothing else shows the air under them: a
 * floating thing with no shadow reads as lying on the ground). r: its radius under a one (m; a tier's times its size);
 * dark: how far the ground goes to `tint` at its middle (a lavender shade, as the reference's); core: the share of
 * its radius at full strength before the soft rim; span: m above its rest at which it is gone (it shrinks and fades as
 * the piece bobs, bounces or flies up); lift: m off the ground along its slope; far: m from the camera at which it has
 * faded out (a few pixels across, it would only be a smudge).
 */
export const BLOB = { r: 0.14, dark: 0.6, tint: '#7a66a8', core: 0.55, span: 0.8, lift: 0.015, far: 45 };

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
  out.r = BLOB.r * tierOf(p.value).size * (0.7 + 0.3 * k);
  return out;
}

/**
 * The patches' material: drawn into the G-buffer as the jump's shadow is (src/jump-shadow.js), but only the colour,
 * softly (normals, depth, flags and the light term left as they are: no cast shadow's hard edge for the ink pass to
 * outline), the ground going toward a lavender shade under the crystal (BLOB.tint), full in its middle and fading
 * out over its rim. Per instance: the strength in instanceColor.r; it fades out from BLOB.far * 0.6 to BLOB.far from
 * the camera.
 */
export function blobMaterial() {
  return new THREE.ShaderMaterial({
    name: 'chime-blob',
    glslVersion: THREE.GLSL3,
    uniforms: { uDark: { value: BLOB.dark }, uTint: { value: new THREE.Color(BLOB.tint) }, uCore: { value: BLOB.core }, uFar: { value: BLOB.far } },
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
      uniform vec3 uTint;
      uniform float uCore;
      in vec2 vSpot;
      in float vK;
      layout(location = 0) out highp vec4 gAlbedoLight;
      layout(location = 1) out highp vec4 gNormalDepth;
      layout(location = 2) out highp vec4 gHatch;
      void main() {
        float r = length(vSpot);
        if (r >= 1.0 || vK <= 0.0) discard;
        float s = (1.0 - smoothstep(uCore, 1.0, r)) * vK * uDark;   // (a soft-edged patch: full in the middle, nothing at the rim)
        gAlbedoLight = vec4(uTint, s);   // (blended over the ground's colour by s; its light term, in alpha, kept)
        gNormalDepth = vec4(0.0);        // (alpha 0: left as they are)
        gHatch = vec4(0.0);
      }`,
    transparent: true, depthWrite: false, depthTest: true, side: THREE.DoubleSide,
    blending: THREE.CustomBlending, blendEquation: THREE.AddEquation,
    blendSrc: THREE.SrcAlphaFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
    blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor,
    polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3,
  });
}

/** The crystals' material: the vertex colours under the crystal shader (src/crystal-shader.js), never black in shade. */
export const crystalLook = () => makeMaterial({ color: '#ffffff', vertexColors: true, crystal: true, spot: 0, key: 'chime-crystal' });

/** How many points of the drawn-in pieces' trails are drawn at most (with the glints: the same draw). */
export const TRAIL_MAX = 120;

/**
 * Draws a ChimeField: every piece, whatever its worth, in one instanced mesh (the crystal shader; its tier's colour
 * in the instance colour, its size in the instance's scale, its glow in the aChimeGlow instance attribute), hovering
 * upright with a slight lean and turning round the vertical, with a faint spark facing the camera that swells into a
 * glint now and then (larger, and more often, the more it is worth); a piece being drawn in glows and leaves a trail
 * of small lights (the glints' mesh); and the patches of shade.
 */
export class ChimeView {
  constructor(parent, max = PIECE.max) {
    this.crystals = new THREE.InstancedMesh(crystalGeometry(CRYSTAL.one, 7, CRYSTAL_NEUTRAL), crystalLook(), max);
    this.crystals.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3);
    this.glow = new THREE.InstancedBufferAttribute(new Float32Array(max), 1);
    this.crystals.geometry.setAttribute(CRYSTAL_GLOW_ATTR, this.glow);
    this.glints = new THREE.InstancedMesh(glintGeometry(), makeMaterial({ color: '#f4fdff', flat: true, glow: 1, side: THREE.DoubleSide, key: 'chime-glint' }), max + TRAIL_MAX);
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
  get meshes() { return [this.crystals, this.glints, this.blobs]; }
  /** camera: the glints face it. */
  update(field, camera = null) {
    let i = 0, j = 0, b = 0;
    const glints = this.glints, cap = glints.instanceMatrix.count;
    for (const p of field.list) {
      if (!pieceVisible(p)) continue;
      const T = tierOf(p.value), s = T.size, pulled = p.phase === 'pull';
      const grow = p.phase === 'fly' ? Math.min(1, 0.4 + p.t * 3) : pulled ? 0.85 : 1;
      // upright with a slight lean, turning round the vertical (the lean precesses: its ends trace a small cone)
      this._q.setFromAxisAngle(_Y, p.spin).multiply(this._t.setFromAxisAngle(_Z, CRYSTAL.tilt));
      this._m.compose(p.pos, this._q, this._s.setScalar(grow * s));
      this.crystals.setMatrixAt(i, this._m);
      this.crystals.setColorAt(i, this._c.set(T.color));
      this.glow.setX(i++, T.glow + (pulled ? 1 : 0));   // (drawn in: it lights up)
      const sh = blobOf(p, this._blob);
      if (sh.k > 0.01) {
        this._m.compose(sh.pos.addScaledVector(sh.up, BLOB.lift), this._t.setFromUnitVectors(_Y, sh.up), this._s.set(sh.r, 1, sh.r));
        this.blobs.setMatrixAt(b, this._m);
        this.blobs.setColorAt(b++, this._c.setRGB(sh.k, sh.k, sh.k));
      }
      const face = camera ? camera.quaternion : _I;
      if (!pulled && j < cap) {
        // the spark: CRYSTAL.twinkle of the glint at rest (breathing a little), the whole glint as the light catches it
        const g = Math.max(CRYSTAL.twinkle * (0.8 + 0.2 * Math.sin(p.age * 3 + p.spin)), p.glint > 0 ? Math.sin((1 - p.glint / 0.3) * Math.PI) : 0) * grow;
        // (on a facet a little above its middle, as it turns, a little toward the camera)
        _gp.copy(p.pos).add(_off.set(0, CRYSTAL.one * 0.16 * s, 0).applyQuaternion(this._q).multiplyScalar(grow));
        if (camera) _gp.addScaledVector(_off.subVectors(camera.position, _gp).normalize(), CRYSTAL.one * 0.2 * s);
        this._m.compose(_gp, face, this._s.setScalar(Math.max(0.01, g * s * (1 + 0.5 * T.glow))));
        glints.setMatrixAt(j++, this._m);
      } else if (p.trail) {
        // drawn in: a trail of small lights behind it, fading
        for (let k = 1; k < p.trail.length && j < cap; k++) {
          this._m.compose(p.trail[k], face, this._s.setScalar(s * (1 - k / PIECE.trail[0])));
          glints.setMatrixAt(j++, this._m);
        }
      }
    }
    this.crystals.count = i; glints.count = j; this.blobs.count = b;
    for (const m of this.meshes) m.instanceMatrix.needsUpdate = true;
    this.crystals.instanceColor.needsUpdate = true; this.blobs.instanceColor.needsUpdate = true; this.glow.needsUpdate = true;
  }
  dispose() {
    for (const m of this.meshes) { m.removeFromParent(); m.geometry.dispose(); m.dispose?.(); }
    this.blobs.material.dispose();
  }
}
const _gp = new THREE.Vector3(), _off = new THREE.Vector3(), _Y = new THREE.Vector3(0, 1, 0), _Z = new THREE.Vector3(0, 0, 1), _I = new THREE.Quaternion();
