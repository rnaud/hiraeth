// The fight temples' rules (docs/design/fight-temples.md, docs/systems/minigames.md "Fight temples"), pure so the
// tests can hold them: the fixed isometric camera's angle and follow, which walls stand between it and the traveller
// (seen through: a hole cut round him, issue #365), the auto-aim in the facing cone, the rooms' walls and doors from their
// rectangles, the waves (many light foes of the world's kinds, a tougher last wave), how many stand at once, the loot.
// The look and the run are in session.js and rooms.js; each world's temple is a table (desert.js).

import * as THREE from 'three';
import { SEE_LOOK } from '../materials.js';

// ------------------------------------------------------------------ the camera
/**
 * The isometric view: from the south-east (yaw: the camera's side of the traveller, as CameraRig's: +x +z), high
 * (pitch over the horizon), far and narrow (an orthographic feel: little perspective), a soft lead the way he moves.
 * `look`: the height looked at over his feet; `ease`: how quickly the view catches up (1/s); `lead` s of his speed
 * looked ahead, at most `leadMax` m. Diablo IV's (issue #365): a fixed yaw the player never turns, about 57° down
 * (v1.76 here: 0.9 rad, 51.6°, 27 m, a 30° lens), a long narrow lens; about 15.5 m of floor tall on the screen at him.
 */
export const ISO = { yaw: Math.PI / 4, pitch: 0.995, dist: 28, fov: 31, look: 0.9, ease: 5, lead: 0.32, leadMax: 2.6 };

/** From the look point toward the camera, `dist` long (the same frame as CameraRig: x = sin yaw, z = cos yaw). */
export function isoOffset(I = ISO, out = new THREE.Vector3()) {
  const c = Math.cos(I.pitch);
  return out.set(Math.sin(I.yaw) * c, Math.sin(I.pitch), Math.cos(I.yaw) * c).multiplyScalar(I.dist);
}

/** The screen's up on the ground (where W and the stick's up walk him): away from the camera, flat. */
export const screenUp = (I = ISO, out = new THREE.Vector3()) => out.set(-Math.sin(I.yaw), 0, -Math.cos(I.yaw));
/** The screen's right on the ground. */
export const screenRight = (I = ISO, out = new THREE.Vector3()) => out.set(Math.cos(I.yaw), 0, -Math.sin(I.yaw));

/**
 * The camera's look point a frame on: eased toward the traveller (`at`) and a little ahead of his flat velocity
 * (`vel`), the lead capped. `look` (a Vector3) is moved in place and returned.
 */
export function followIso(look, at, vel, dt, I = ISO) {
  const lx = (vel?.x ?? 0) * I.lead, lz = (vel?.z ?? 0) * I.lead, l = Math.hypot(lx, lz), k = l > I.leadMax ? I.leadMax / l : 1;
  const tx = at.x + lx * k, ty = at.y + I.look, tz = at.z + lz * k;
  const e = 1 - Math.exp(-I.ease * dt);
  look.x += (tx - look.x) * e; look.y += (ty - look.y) * e; look.z += (tz - look.z) * e;
  return look;
}

// ------------------------------------------------------------------ the walls seen through
/**
 * A wall or pillar in the way is seen through (issue #365; it was cut down to a stub): a hole opens in it round him,
 * `radius` m at his chest (`chest` m over his feet; a circle on the screen: materials.js SEE_HOLE, its edge a little
 * uneven), in over `in` s, closed again over `out` s once it is clear; `ring`, `heights`: the points round him the camera
 * must see (sightPoints). A pillar's hole is `pillar` times as wide: the whole of it down to its foot (a hole through a
 * pillar left its cap's corners hanging in the air).
 */
export const SEE = { radius: 3.4, in: 0.2, out: 0.3, ring: 1.6, heights: [0.4, 1.6], chest: 1.1, pillar: 4 };

const _ray = new THREE.Ray(), _hit = new THREE.Vector3(), _p = new THREE.Vector3();
/** Does the segment from `a` to `b` pass through the box (a THREE.Box3)? */
export function segmentHitsBox(a, b, box) {
  _ray.origin.copy(a); _ray.direction.subVectors(b, a);
  const L = _ray.direction.length();
  if (L < 1e-6) return box.containsPoint(a);
  _ray.direction.divideScalar(L);
  const h = _ray.intersectBox(box, _hit);
  return !!h && a.distanceTo(h) < L - 0.05;
}

/** The points the camera must see: his body (two heights) and a ring round him at his knees, `SEE.ring` out. */
export function sightPoints(at, C = SEE) {
  const pts = C.heights.map((h) => new THREE.Vector3(at.x, at.y + h, at.z));
  for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; pts.push(new THREE.Vector3(at.x + Math.cos(a) * C.ring, at.y + C.heights[0], at.z + Math.sin(a) * C.ring)); }
  return pts;
}

/** Which of the boxes (each { box }: full height) stand between the camera and any of the points: their indices. */
export function inTheWay(cam, boxes, points) {
  const out = [];
  boxes.forEach((b, i) => { if (points.some((p) => segmentHitsBox(cam, p, b.box))) out.push(i); });
  return out;
}

/** Each one's share seen through a frame on (k 0 solid … 1 the hole open), toward `want` (true: in the way): steady, `in` / `out` s. */
export function easeSee(k, want, dt, C = SEE) {
  return want ? Math.min(1, k + dt / C.in) : Math.max(0, k - dt / C.out);
}
/** The hole's size for a share (eased at both ends): what the shader is given (uSeeK). */
export const seeOpen = (k) => k * k * (3 - 2 * k);

const _ax = new THREE.Vector3(), _rel = new THREE.Vector3();
/**
 * Is the point `p` (world) of a wall cut out by the hole at `open` (0..1, seeOpen), seen from `cam`, round `at` (his
 * chest), `radius` m there? `dot` (0..1): the uneven edge's noise there (materials.js vnoise: 0 the hole at its full
 * size, 1 its edge at its most eaten in). Mirrors the shader's SEE_HOLE block (src/materials.js).
 */
export function seeHoleCuts(p, cam, at, open, { radius = SEE.radius, dot = 0, rim = SEE_LOOK.wobble } = {}) {
  if (!(open > 0.001)) return false;
  _ax.subVectors(at, cam); const L = _ax.length();
  _rel.subVectors(p, cam);
  const s = _rel.dot(_ax) / Math.max(L, 1e-4);
  if (!(s > 0 && s < L - 0.35) || p.y <= at.y - SEE_LOOK.foot) return false;   // (its foot kept)
  const R = radius * open * s / L;
  const e = _rel.addScaledVector(_ax, -s / Math.max(L, 1e-4)).length() / Math.max(R, 1e-4);
  return e < 1 - rim * dot;
}

// ------------------------------------------------------------------ the rooms
/** The walls' thickness (each room builds half of it outward on each side: two rooms side by side share a 2 m wall) and height. */
export const WALL = { t: 2, h: 3.4 };

/** Is (x, z) in a room's rectangle (shrunk by `inset`)? */
export const inRoom = (r, x, z, inset = 0) => x > r.x[0] + inset && x < r.x[1] - inset && z > r.z[0] + inset && z < r.z[1] - inset;
/** The room (its index) at (x, z), or -1. */
export const roomAt = (rooms, x, z, inset = 0) => rooms.findIndex((r) => inRoom(r, x, z, inset));

/**
 * A door's opening: on room `from`'s side `side` ('n' -z, 's' +z, 'w' -x, 'e' +x), `at` along the side from its
 * middle, `w` wide. Returns { x: [x0, x1], z: [z0, z1] }: the gap through the whole wall (both rooms' halves).
 */
export function doorGap(rooms, d, T = WALL.t) {
  const r = rooms[d.from], h = d.w / 2;
  const mx = (r.x[0] + r.x[1]) / 2 + (d.at ?? 0), mz = (r.z[0] + r.z[1]) / 2 + (d.at ?? 0);
  if (d.side === 'n') return { x: [mx - h, mx + h], z: [r.z[0] - T, r.z[0]] };
  if (d.side === 's') return { x: [mx - h, mx + h], z: [r.z[1], r.z[1] + T] };
  if (d.side === 'w') return { x: [r.x[0] - T, r.x[0]], z: [mz - h, mz + h] };
  return { x: [r.x[1], r.x[1] + T], z: [mz - h, mz + h] };
}

/**
 * The walls of every room as boxes in plan, { x: [x0, x1], z: [z0, z1], room, side }: half the wall's thickness out
 * from each side of its rectangle, the corners filled, the doors' gaps left open. A side shared with a room beside
 * it is one wall (each builds its half).
 */
export function wallBoxes(rooms, doors = [], T = WALL.t) {
  const out = [], h = T / 2;
  rooms.forEach((r, i) => {
    const gaps = doors.filter((d) => d.from === i || d.to === i).map((d) => doorGap(rooms, d, T));
    const sides = {
      n: { x: [r.x[0] - h, r.x[1] + h], z: [r.z[0] - h, r.z[0]], along: 'x' },
      s: { x: [r.x[0] - h, r.x[1] + h], z: [r.z[1], r.z[1] + h], along: 'x' },
      w: { x: [r.x[0] - h, r.x[0]], z: [r.z[0], r.z[1]], along: 'z' },
      e: { x: [r.x[1], r.x[1] + h], z: [r.z[0], r.z[1]], along: 'z' },
    };
    for (const [side, s] of Object.entries(sides)) {
      const a = s.along, o = a === 'x' ? 'z' : 'x';
      // the gaps through this side (a door's opening overlapping it across)
      const cuts = gaps.filter((g) => g[o][0] < s[o][1] - 1e-6 && g[o][1] > s[o][0] + 1e-6).map((g) => g[a]).sort((p, q) => p[0] - q[0]);
      let from = s[a][0];
      for (const c of [...cuts, [s[a][1], s[a][1]]]) {
        if (c[0] - from > 0.05) out.push({ [a]: [from, Math.min(c[0], s[a][1])], [o]: s[o].slice(), room: i, side });
        from = Math.max(from, c[1]);
      }
    }
  });
  return out;
}

// ------------------------------------------------------------------ the aim
/**
 * The cone the attacks look in (`cone`: its half angle) and how far: the blade's soft lock (`blade`, m), the gun's
 * (`gun`); anything within `near` m is taken whatever way you face.
 */
export const AIM = { cone: 0.7, blade: 6.5, gun: 18, near: 1.6, stick: 0.35, mouse: 0.04, mouseKeep: 2.5, reticle: [2.2, 7] };

/**
 * The foe to strike or shoot: within `range` (flat) and inside the cone round `dir` (flat unit), the nearest by
 * distance and angle together; else the nearest within `near` whatever way; else null. `foes`: [{ pos, alive }].
 */
export function pickTarget(from, dir, foes, { range = AIM.blade, cone = AIM.cone, near = AIM.near } = {}) {
  let best = null, score = Infinity, close = null, cd = near;
  const dl = Math.hypot(dir.x, dir.z) || 1, ux = dir.x / dl, uz = dir.z / dl;
  for (const f of foes) {
    if (!f || f.alive === false || f.phased) continue;
    const dx = f.pos.x - from.x, dz = f.pos.z - from.z, d = Math.hypot(dx, dz);
    if (d > range) continue;
    if (d < cd) { cd = d; close = f; }
    const a = d > 1e-4 ? Math.acos(Math.max(-1, Math.min(1, (dx * ux + dz * uz) / d))) : 0;
    if (a > cone) continue;
    const s = d * (1 + 1.5 * a);   // (a little off the line costs as a little further)
    if (s < score) { score = s; best = f; }
  }
  return best ?? close;
}

/** A stick (or the mouse's reticle), screen-relative ({ x right, y up }), as a direction on the ground; null at rest. */
export function stickToGround(s, dead = AIM.stick, I = ISO, out = new THREE.Vector3()) {
  if (!s || Math.hypot(s.x, s.y) < dead) return null;
  const u = screenUp(I, _p), rx = Math.cos(I.yaw), rz = -Math.sin(I.yaw);
  return out.set(rx * s.x + u.x * s.y, 0, rz * s.x + u.z * s.y).normalize();
}

// ------------------------------------------------------------------ the waves
/** The light variants' health (cuts to fell them): the world's kinds, felled in one or two. A tough one keeps its own. */
export const LIGHT_HP = { blot: 1, skitter: 1, moth: 1, worm: 2, heron: 2, toad: 2, ray: 2, crab: 2, lizard: 1, hound: 1, jelly: 1, drone: 2, rootknot: 2, cart: 2, tripod: 2, centipede: 2, marionette: 1, roller: 2, bell: 2 };
export const lightHp = (kind, hp = 2) => Math.min(hp, LIGHT_HP[kind] ?? 2);

/**
 * How many stand at once (heads: a skitter half a one): `cap`, Gentle `gentle`; how often more come up out of the
 * springs (s) and how many at a time; the breather between waves (s).
 */
export const CROWD = { cap: 24, gentle: 14, every: 0.45, burst: 3, breather: 2.4, gentleShare: 0.7, warn: 0.7, few: 3 };
// (`warn`: s a spring wells up, its ring growing, before the foes it brings come out of it: where they will be is seen
// first, issue #368; `few`: this many left and none still to come, each one is marked by a pillar of light)
export const headOf = (kind) => (kind === 'skitter' ? 0.5 : 1);

/**
 * A room's waves as lists of foes to bring on, { kind, hp, tough }: each wave of the table is [kind, n, { tough }]
 * entries; Gentle brings seven tenths of the light ones (at least one of each entry), the tough ones as they are.
 * `hpOf(kind)`: the kind's own health (src/foes.js FOES[kind].hp).
 */
export function roomWaves(room, { gentle = false, hpOf = () => 2 } = {}) {
  return (room.waves ?? []).map((w) => w.flatMap(([kind, n, o = {}]) => {
    const m = gentle && !o.tough && !o.gorged ? Math.max(1, Math.round(n * CROWD.gentleShare)) : n;
    return Array.from({ length: m }, () => ({ kind, tough: !!o.tough, gorged: !!o.gorged,
      hp: o.tough ? hpOf(kind) : o.gorged ? gorgedHp(kind, hpOf(kind), gentle) : lightHp(kind, hpOf(kind)) }));
  }));
}

/**
 * A gorged one (issue #368: the waves' elites, `{ gorged: true }` in a temple's table): a light foe swollen with the
 * ink, `scale` times its size, an ember ring at its feet, its kind's own health and `hp` more (Gentle `gentleHp`),
 * striking as hard as its kind (not halved); felled, it always leaves a heart and `chimes`, and an ember shard (FURY).
 */
export const GORGED = { hp: 2, gentleHp: 1, scale: 1.35, chimes: 4 };
export const gorgedHp = (kind, hp = 2, gentle = false) => hp + (gentle ? GORGED.gentleHp : GORGED.hp);

/**
 * The ember shard a gorged one leaves (issue #368): walked over, `secs` s of fury, every cut landing `edge` times as
 * hard and the crescent burning in the ember's tones (`tones`).
 */
export const FURY = { secs: 8, edge: 2, tones: ['#e8703a', '#ffc890', '#fff2dc'] };

/**
 * The ink geysers (issue #368: a reason to keep moving): in a room with `geysers` in its table, every `every` s of a
 * wave (the last wave `last` times as often) `n` rings of ink open on the floor, one under him and the rest near him
 * (`near` m), each filling for `warn` s before it bursts: `harm` hearts to him in it (`radius` m; a roll's i-frames
 * take him through), `damage` to every foe in it (lure them in). Gentle: `gentle` times as rarely, half the harm.
 */
export const GEYSER = { warn: 1.25, radius: 1.7, harm: 0.5, damage: 2, near: 4.5, last: 0.75, gentle: 1.6, inset: 1.6, apart: 2.6 };

/**
 * Where a round of geysers opens: one under him (`at`), the rest `near` m round him, all inside the room (`inset` in
 * from its walls), off its pillars and `apart` m from one another. `rng`: 0..1.
 */
export function geyserSpots(room, at, n, rng = Math.random, G = GEYSER) {
  const out = [];
  const ok = (x, z) => inRoom(room, x, z, G.inset) && !(room.pillars ?? []).some(([px, pz]) => Math.hypot(x - px, z - pz) < 1.4 + G.radius * 0.5)
    && out.every(([ox, oz]) => Math.hypot(x - ox, z - oz) >= G.apart);
  const clampIn = (v, [a, b]) => Math.min(b - G.inset - 0.01, Math.max(a + G.inset + 0.01, v));
  const first = [clampIn(at.x, room.x), clampIn(at.z, room.z)];
  if (n > 0 && ok(...first)) out.push(first);
  for (let tries = 0; out.length < n && tries < 120; tries++) {
    // (wider out once the near ring has no room: a corner, the pillars)
    const a = rng() * Math.PI * 2, far = G.near * (tries < 40 ? 1 : 1.6), r = G.apart * 0.8 + rng() * (far - G.apart * 0.8);
    const x = at.x + Math.cos(a) * r, z = at.z + Math.sin(a) * r;
    if (ok(x, z)) out.push([x, z]);
  }
  return out;
}

/**
 * The rank on the results (issue #368): by the hearts lost and the time against the temple's `par` (s). S: at most
 * `S.lost` lost inside par; A: at most `A.lost` inside `A.par` × par; B: at most `B.lost`; else C.
 */
export const RANK = { S: { lost: 1, par: 1 }, A: { lost: 3, par: 1.3 }, B: { lost: 6, par: Infinity } };
export function rankFor({ secs, lost }, par = 240, R = RANK) {
  for (const k of ['S', 'A', 'B']) if (lost <= R[k].lost + 1e-9 && secs <= par * R[k].par) return k;
  return 'C';
}
/** m:ss for the results. */
export const clock = (secs) => `${Math.floor(secs / 60)}:${String(Math.floor(secs % 60)).padStart(2, '0')}`;

/** How many of the waiting foes may come up now: the heads standing against the cap, at most `burst`. */
export function release(waiting, standing, cap = CROWD.cap, burst = CROWD.burst) {
  let n = 0, s = standing;
  for (const f of waiting) { if (n >= burst || s + headOf(f.kind) > cap + 1e-9) break; s += headOf(f.kind); n++; }
  return n;
}

/** Every foe a temple fields over its run (the table's whole count, for the score lines and the tests). */
export const totalFoes = (def, o = {}) => def.rooms.reduce((a, r) => a + roomWaves(r, o).reduce((b, w) => b + w.length, 0), 0);

// ------------------------------------------------------------------ the loot
/**
 * What a foe felled may leave: a heart (more likely the more you are hurt, never at full), chimes (a light one now
 * and then, a tough or gorged one always); a wave cleared, a room and the last its purses. `first`: the reward not won yet
 * (after it, a run's chimes are halved: the hall is not a mine).
 */
export const LOOT = { heart: 0.05, hurtHeart: 0.16, chime: 0.25, tough: 6, wave: 3, room: 6, finale: 25 };
export function heartChance(hearts, max, L = LOOT) {
  if (hearts >= max - 1e-9) return 0;
  return hearts <= max / 2 ? L.hurtHeart : L.heart;
}
export function chimesFor(f, rng = Math.random, first = true, L = LOOT) {
  const n = f.tough ? L.tough : f.gorged ? GORGED.chimes : rng() < L.chime ? 1 : 0;
  return first ? n : Math.floor(n / 2) + (n % 2 && rng() < 0.5 ? 1 : 0);
}
export const pursesFor = (what, first = true, L = LOOT) => { const n = L[what] ?? 0; return first ? n : Math.ceil(n / 2); };
