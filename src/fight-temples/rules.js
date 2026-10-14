// The fight temples' rules (docs/design/fight-temples.md, docs/systems/minigames.md "Fight temples"), pure so the
// tests can hold them: the fixed isometric camera's angle and follow, which walls stand between it and the traveller
// (cut down to a stub, as Diablo's are), the auto-aim in the facing cone, the rooms' walls and doors from their
// rectangles, the waves (many light foes of the world's kinds, a tougher last wave), how many stand at once, the loot.
// The look and the run are in session.js and rooms.js; each world's temple is a table (desert.js).

import * as THREE from 'three';

// ------------------------------------------------------------------ the camera
/**
 * The isometric view: from the south-east (yaw: the camera's side of the traveller, as CameraRig's: +x +z), high
 * (pitch over the horizon), far and narrow (an orthographic feel: little perspective), a soft lead the way he moves.
 * `look`: the height looked at over his feet; `ease`: how quickly the view catches up (1/s); `lead` s of his speed
 * looked ahead, at most `leadMax` m.
 */
export const ISO = { yaw: Math.PI / 4, pitch: 0.9, dist: 27, fov: 30, look: 0.9, ease: 5, lead: 0.32, leadMax: 2.6 };

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

// ------------------------------------------------------------------ the walls that come down
/** How a wall in the way comes down: to `stub` of its height, quickly (`down` 1/s), back up slowly (`up`). */
export const CUT = { stub: 0.14, down: 9, up: 2.5, ring: 1.6, heights: [0.4, 1.6] };

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

/** The points the camera must see: his body (two heights) and a ring round him at his knees, `CUT.ring` out. */
export function sightPoints(at, C = CUT) {
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

/** Each cuttable's share cut down a frame on (k 0 standing … 1 a stub), toward `want` (true: in the way). */
export function easeCut(k, want, dt, C = CUT) {
  return want ? k + (1 - k) * (1 - Math.exp(-C.down * dt)) : k * Math.exp(-C.up * dt);
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
export const LIGHT_HP = { blot: 1, skitter: 1, moth: 1, worm: 2, heron: 2, toad: 2, ray: 2, crab: 2, lizard: 1, hound: 1, jelly: 1, drone: 2, rootknot: 2 };
export const lightHp = (kind, hp = 2) => Math.min(hp, LIGHT_HP[kind] ?? 2);

/**
 * How many stand at once (heads: a skitter half a one): `cap`, Gentle `gentle`; how often more come up out of the
 * springs (s) and how many at a time; the breather between waves (s).
 */
export const CROWD = { cap: 24, gentle: 14, every: 0.45, burst: 3, breather: 2.4, gentleShare: 0.7 };
export const headOf = (kind) => (kind === 'skitter' ? 0.5 : 1);

/**
 * A room's waves as lists of foes to bring on, { kind, hp, tough }: each wave of the table is [kind, n, { tough }]
 * entries; Gentle brings seven tenths of the light ones (at least one of each entry), the tough ones as they are.
 * `hpOf(kind)`: the kind's own health (src/foes.js FOES[kind].hp).
 */
export function roomWaves(room, { gentle = false, hpOf = () => 2 } = {}) {
  return (room.waves ?? []).map((w) => w.flatMap(([kind, n, o = {}]) => {
    const m = gentle && !o.tough ? Math.max(1, Math.round(n * CROWD.gentleShare)) : n;
    return Array.from({ length: m }, () => ({ kind, tough: !!o.tough, hp: o.tough ? hpOf(kind) : lightHp(kind, hpOf(kind)) }));
  }));
}

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
 * and then, a tough one always); a wave cleared, a room and the last its purses. `first`: the reward not won yet
 * (after it, a run's chimes are halved: the hall is not a mine).
 */
export const LOOT = { heart: 0.05, hurtHeart: 0.16, chime: 0.25, tough: 6, wave: 3, room: 6, finale: 25 };
export function heartChance(hearts, max, L = LOOT) {
  if (hearts >= max - 1e-9) return 0;
  return hearts <= max / 2 ? L.hurtHeart : L.heart;
}
export function chimesFor(f, rng = Math.random, first = true, L = LOOT) {
  const n = f.tough ? L.tough : rng() < L.chime ? 1 : 0;
  return first ? n : Math.floor(n / 2) + (n % 2 && rng() < 0.5 ? 1 : 0);
}
export const pursesFor = (what, first = true, L = LOOT) => { const n = L[what] ?? 0; return first ? n : Math.ceil(n / 2); };
