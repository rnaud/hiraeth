// The Lens Vault's rules (issue #382; docs/systems/minigames.md "The Lens Vault"), pure: what the arm, the lock, the
// lens and the doors do, and the vault's table (its rooms, doors, foes and the things the lens reads). The vault is
// built in lens-vault-level.js, the arm drawn in lens-vault-arm.js, the visor's HUD in lens-vault-hud.js, the run in
// lens-vault.js. Tests: tests/minigames-lens-vault.test.js.

/** The arm, the lock, the lens, the eye (m, s, rad). */
export const FPS = {
  eye: 1.62,              // the eye over the feet
  fov: 72,                // the lens's field of view (deg)
  pitch: 1.25,            // looking up or down at most
  cool: 0.2,              // s between two plain shots
  chargeAfter: 0.28,      // s held before the charge starts filling
  chargeTime: 0.95,       // s more to fill it
  speed: 34,              // a plain bolt (m/s)
  chargedSpeed: 26,
  life: 1.6,              // s a bolt flies at most
  r: 0.12, chargedR: 0.42,   // its reach round its line (the foes' bodies and the doors')
  damage: 1, chargedDamage: 4,
  lockCone: 0.32,         // rad off the middle of the view a lock may take
  lockRange: 34,
  lockTurn: 11,           // how quickly the view swings onto the lock (1/s)
  scanTime: 0.85,         // s of reading a thing under the reticle
  scanCone: 0.2, scanRange: 26,
  readFor: 6,             // s the lens's reading stays up
  bob: { step: 2.15, y: 0.045, x: 0.03, run: 7 },   // the view's bob: m a step, how far up and aside, the speed it is full at
};

/** A plain angle in -π..π. */
export const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

/**
 * The camera rig's angles for a look along d (the rig's own sense, src/player.js CameraRig: the camera sits at
 * (sin yaw cos pitch, sin pitch, cos yaw cos pitch) from what it looks at, so it looks along the opposite).
 */
export function anglesOf(d) {
  const L = Math.hypot(d.x, d.y, d.z) || 1;
  return { yaw: Math.atan2(-d.x, -d.z), pitch: Math.asin(Math.max(-1, Math.min(1, -d.y / L))) };
}
/** The way the eye looks for the rig's angles (into out, a {x, y, z}). */
export function lookDir(yaw, pitch, out = { x: 0, y: 0, z: 0 }) {
  const c = Math.cos(pitch);
  out.x = -Math.sin(yaw) * c; out.y = -Math.sin(pitch); out.z = -Math.cos(yaw) * c;
  return out;
}

/**
 * The trigger (pure): a press looses a plain bolt (when the arm is cool); held, the charge fills after `chargeAfter`
 * over `chargeTime`; let go full, the charged bolt. S: { held, heldT, charge, cool }; returns what flies: 'plain',
 * 'charged' or null.
 */
export function triggerStep(S, down, dt, F = FPS) {
  S.cool = Math.max(0, (S.cool ?? 0) - dt);
  let out = null;
  if (down && !S.held) {
    S.heldT = 0; S.charge = 0;
    if (S.cool <= 0) { out = 'plain'; S.cool = F.cool; }
  } else if (down) {
    S.heldT += dt;
    if (S.heldT > F.chargeAfter) S.charge = Math.min(1, S.charge + dt / F.chargeTime);
  } else if (S.held) {
    if (S.charge >= 1) { out = 'charged'; S.cool = F.cool; }
    S.charge = 0; S.heldT = 0;
  }
  S.held = !!down;
  return out;
}

/**
 * The lock (pure): of the candidates ({ id, pos: {x, y, z}, seen }), the one nearest the middle of the view within
 * the cone and range, `seen` (nothing in the way) a must. Returns it or null.
 */
export function pickLock(eye, dir, list, { cone = FPS.lockCone, range = FPS.lockRange } = {}) {
  let best = null, bs = Infinity;
  for (const c of list) {
    if (c.seen === false) continue;
    const dx = c.pos.x - eye.x, dy = c.pos.y - eye.y, dz = c.pos.z - eye.z, d = Math.hypot(dx, dy, dz);
    if (d < 0.5 || d > range) continue;
    const a = Math.acos(Math.max(-1, Math.min(1, (dx * dir.x + dy * dir.y + dz * dir.z) / d)));
    if (a > cone) continue;
    const s = a + d * 0.004;   // (the nearest the middle; a far one loses a tie)
    if (s < bs) { bs = s; best = c; }
  }
  return best;
}

/**
 * The lens reading (pure): held on a thing (`id`, null for none), the reading fills over scanTime; let go or moved
 * off, it empties. Read once, a thing stays read. S: { id, k }; returns the id read this frame, or null.
 */
export function scanStep(S, id, holding, dt, read = new Set(), F = FPS) {
  if (!holding || !id || read.has(id)) { S.k = Math.max(0, (S.k ?? 0) - dt * 3); if (!holding || !id) S.id = null; if (id && read.has(id)) S.id = id; return null; }
  if (S.id !== id) { S.id = id; S.k = 0; }
  S.k = Math.min(1, (S.k ?? 0) + dt / F.scanTime);
  if (S.k >= 1) { read.add(id); S.k = 0; return id; }
  return null;
}

/** Does a door take this bolt? A shot door any, the heavy door the charged one only, a sealed door none. */
export const doorTakes = (door, kind) => !door.open && (door.kind === 'shot' || (door.kind === 'charge' && kind === 'charged'));

/** The view's bob: up and down twice a stride, aside once, by how fast he walks (0 standing). */
export function bob(phase, speed, F = FPS) {
  const k = Math.min(1, Math.max(0, speed) / F.bob.run);
  return { y: -Math.abs(Math.sin(phase * Math.PI)) * F.bob.y * k + F.bob.y * k * 0.5, x: Math.sin(phase * Math.PI) * F.bob.x * k };
}

/** Where a segment a→b comes nearest a point c: the share along it (0..1) and the distance. */
export function segPoint(a, b, c) {
  const ux = b.x - a.x, uy = b.y - a.y, uz = b.z - a.z, L2 = ux * ux + uy * uy + uz * uz;
  const t = L2 > 1e-12 ? Math.max(0, Math.min(1, ((c.x - a.x) * ux + (c.y - a.y) * uy + (c.z - a.z) * uz) / L2)) : 0;
  return { t, d: Math.hypot(a.x + ux * t - c.x, a.y + uy * t - c.y, a.z + uz * t - c.z) };
}
/** Where a segment a→b enters a box ({ min, max }) grown by r: the share along it, or null. */
export function segBox(a, b, box, r = 0) {
  let t0 = 0, t1 = 1;
  for (const k of ['x', 'y', 'z']) {
    const d = b[k] - a[k], lo = box.min[k] - r, hi = box.max[k] + r;
    if (Math.abs(d) < 1e-9) { if (a[k] < lo || a[k] > hi) return null; continue; }
    let u = (lo - a[k]) / d, v = (hi - a[k]) / d;
    if (u > v) [u, v] = [v, u];
    t0 = Math.max(t0, u); t1 = Math.min(t1, v);
    if (t0 > t1) return null;
  }
  return t0;
}

/** The run's score: the time, and the lines of its results. */
export function resultLines(run) {
  const acc = run.shots ? Math.round((run.hits / run.shots) * 100) : 0;
  return [
    `Foes felled ${run.kills} of ${run.total} · charged shots ${run.charged}`,
    `Shots ${run.shots} · on target ${acc}%`,
    `The lens read ${run.read} of ${run.readable}${run.read === run.readable ? ' · every one' : ''}`,
  ];
}

// ------------------------------------------------------------------ the vault (local m: +z deeper in, y up)
/**
 * The four rooms, in order: the Lens Room (where it starts: the lens and the shot door taught), the Long Gallery (blots
 * and ring drones among its columns; its far door sealed, its lock read open), the Press (a makers' machine at the heavy
 * door only a charged shot opens), the Round Hall (the last stand: two waves). x, z: the room's middle; w, d its size
 * (a round hall: r); h its height. `foes`: what wakes as he walks in ([kind, x, z]); a second wave in `then`.
 */
export const ROOMS = [
  { id: 'lens', name: 'The Lens Room', x: 0, z: 6, w: 12, d: 12, h: 7, foes: [] },
  { id: 'gallery', name: 'The Long Gallery', x: 0, z: 28.2, w: 18, d: 22, h: 9,
    foes: [['blot', -4, 26], ['blot', 4, 30], ['blot', 0, 34], ['drone', -5, 34], ['drone', 5, 22]] },
  { id: 'press', name: 'The Press', x: 0, z: 52.4, w: 14, d: 16, h: 8,
    foes: [['machine', 0, 56], ['blot', -4, 50], ['blot', 4, 50]] },
  { id: 'round', name: 'The Round Hall', x: 0, z: 78.8, r: 13, h: 11, round: true,
    foes: [['blot', -6, 76], ['blot', 6, 76], ['blot', 0, 84], ['drone', -7, 84], ['drone', 7, 84]],
    then: [['tripod', 0, 84], ['drone', -8, 78], ['drone', 8, 78], ['blot', -4, 86], ['blot', 4, 86]] },
];
/** The doors between them (in the doorway's middle, z its plane): a shot door, the sealed one (its lock read), the heavy one. */
export const DOORS = [
  { id: 'door1', kind: 'shot', x: 0, z: 12.6, w: 4.4, h: 4.6, from: 0, to: 1 },
  { id: 'door2', kind: 'sealed', x: 0, z: 39.8, w: 4.4, h: 4.6, from: 1, to: 2, key: 'lock' },
  { id: 'door3', kind: 'charge', x: 0, z: 61.0, w: 4.4, h: 4.6, from: 2, to: 3 },
];
/** The corridors between the rooms' walls (z from, to), under a roof, 4.4 m wide. */
export const PASSAGES = [[13.2, 16.0], [40.4, 43.2], [61.6, 64.4]];
/** Where he starts, looking in (+z). */
export const START = { x: 0, z: 2.2 };

/**
 * What the lens reads: things (at: [x, y, z], r its reach) and foes by their kind. Each line in the game's voice, with
 * its tone (tests/tone.test.js). `opens`: a door its reading unseals.
 */
export const LENS = {
  mark: { name: 'The makers’ mark', at: [0, 5.6, 11.35], r: 0.9, line: '~solemn~ The makers’ mark. They signed what they meant to last.' },
  door1: { name: 'A ringed door', door: 'door1', line: '~curious~ A lit ring. It opens to anything thrown at it.' },
  lamp: { name: 'A standing lamp', at: [-4.6, 1.8, 9.5], r: 0.6, line: '~tired~ Lit before the dunes came. Nobody fills it.' },
  lock: { name: 'The eye-lock', at: [3.6, 1.7, 38.6], r: 0.65, opens: 'door2', line: '~whisper~ It reads what reads it. It has read you. It opens.' },
  door2: { name: 'A sealed door', door: 'door2', line: '~neutral~ Sealed. The lock beside it wants reading.' },
  mural: { name: 'A painted wall', at: [-6.95, 3.4, 52.4], r: 1.3, line: '~surprised~ The makers, painted with arms of water. Like yours!' },
  door3: { name: 'A heavy door', door: 'door3', line: '~neutral~ Heavy. A plain shot only splashes it. Hold, and let it build.' },
  blot: { name: 'Ink blot', foe: 'blot', line: '~scared~ Ink that learnt to want. It wants you.' },
  drone: { name: 'Ring drone', foe: 'drone', line: '~curious~ It still flies its makers’ rounds. You are not on them.' },
  machine: { name: 'Makers’ machine', foe: 'machine', line: '~solemn~ Built to keep this door. It still does.' },
  tripod: { name: 'Lamp tripod', foe: 'tripod', line: '~angry~ Its lamp is lit to find you. Keep moving.' },
};
/** Every line the lens may say (the tone test). */
export const LENS_LINES = Object.fromEntries(Object.entries(LENS).map(([k, v]) => [k, v.line]));
