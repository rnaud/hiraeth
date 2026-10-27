import * as THREE from 'three';
import { ARRIVAL_VIEWS } from './arrival-views.js';

// The first arrival in each world (issue #327: "the landing view and the first exit out of the ship should show a
// beautiful view of the landscape with points of interest visible"). Two views per route world, picked from the
// world's own data (its landmarks: the temple, the town, the beacons) and its sightlines, offline, by
// scripts/arrival-views.mjs into src/ship/arrival-views.js:
//   wide   the establishing shot of the first landing: big sky, the world's landmarks laid out in depth, the ship
//          coming down small into the frame from above (cinematics.js ArrivalDirector, its 'wide' stage)
//   exit   the first step out of the ship: the heading the traveller turns to at the foot of the ramp and the
//          camera's first framing behind him, a little high, with a slow drift into it (ship.js Ship.reveal); control
//          is his at once, and the drift gives way the moment he moves or turns the camera
// Plain numbers ([x, y, z], radians, degrees of fov), so the Unity bridge can play the same views (export-world.mjs
// writes them with the ship's points). Each plays once per world per save (WIDE_FLAG, VIEW_FLAG). Later arrivals
// are the short arrival as before. tests/arrival-view.test.js builds every route world and projects its landmarks
// into both views.

/**
 * The establishing descent: the ship gliding in nose first from `from` m up and up to `back` m behind where it rests
 * (as far as keeps it in the frame: wideBack) to a hover `to` m over its spot, in `dur` s; then, in the landing's low
 * shot, straight down those last `to` m on its jets in `land` s (issue #354, src/ship/flight.js landingPose).
 */
export const WIDE = { dur: 6.4, from: 150, to: 30, land: 2.8, back: 240, hold: 0.3 };
/** The wide's glide as src/ship/flight.js landingPose flies it, `back` m out. */
export const wideFlight = (back = WIDE.back) => ({ back, high: WIDE.from, hover: WIDE.to, glide: WIDE.dur, hold: WIDE.hold, drop: WIDE.land - WIDE.hold, flare: 0.12 });
/**
 * How far behind its spot (m, along the bow `fwd`) the wide's glide starts: the longest of a few for which the ship is
 * in the frame from 40 % of the way in (it may fly into the frame from its edge before that), in front of the lens
 * all the way and never within 40 m of it. 40 when none does.
 */
export function wideBack(view, rest, fwd, aspect = ASPECT) {
  const c = viewCamera(view, aspect), P = V(view.pos);
  for (const b of [WIDE.back, 190, 150, 110, 80, 60]) {
    let ok = true;
    for (let s = 0; s <= 1.001 && ok; s += 0.05) {
      const f = (1 - s) * (1 - s), p = [rest[0] - fwd[0] * b * f, rest[1] + WIDE.to + (WIDE.from - WIDE.to) * f, rest[2] - fwd[2] * b * f];
      const at = screenOf(c, p);
      ok = at.front && V(p).distanceTo(P) > 40 && (s < 0.4 || inFrame(at));
    }
    if (ok) return b;
  }
  return 40;
}
/** The first step out: the camera drifts from `swing` rad round and `rise` rad higher, `back` m further out, into the rig's own framing at `pitch`, over `dur` s. */
export const REVEAL = { dur: 3.6, pitch: 0.24, rise: 0.2, back: 5, swing: 0.4 };
/** The first framing's pitches tried, the rig's slight high angle first (src/player.js: + is the camera over him, looking down). */
export const EXIT_PITCHES = [0.24, 0.14, 0.04, -0.08, -0.2, -0.32];
/** The rig's open framing (src/player.js OPEN_DIST, OPEN_LOOK; the game's lens, main.js), for scoring the exit's view (kept equal by the test). */
export const RIG = { arm: 4.8, look: 1.7, fov: 55 };
export const ASPECT = 16 / 9;
/** The save's flags: the establishing descent seen in a world, its first step out seen. */
export const WIDE_FLAG = (id) => `arrival.wide.${id}`;
export const VIEW_FLAG = (id) => `arrival.view.${id}`;

const V = (a) => new THREE.Vector3(a[0], a[1], a[2]);
const A = (p) => (p == null ? null : p.isVector3 ? [p.x, p.y, p.z] : Array.isArray(p) ? p.slice(0, 3) : Number.isFinite(p.x) ? [p.x, p.y ?? 0, p.z] : null);

// ------------------------------------------------------------------ the landmarks
// Each world's points of interest for its first views, from its level's data: { name, top: [x, y, z], height, w, main }.
// `main` ones must be in both views (the test checks them); the others count toward the pick by their weight.
const beacon = (level, prefix) => {
  const all = (typeof level.beacons === 'function' ? level.beacons() : level.beacons) ?? [];
  return all.filter((b) => b.name.startsWith(prefix) && b.height > 0).map((b) => ({ name: b.name, top: A(b.top), height: b.height }));
};
/** The temple's door, as a landmark: the house round it stands `height` m over it (its top where the exterior names one). */
const temple = (level, id, name, height = 14) => {
  const ts = level.temples ?? (level.temple ? [level.temple] : []);
  const t = id ? ts.find((x) => x.id === id) : level.temple;
  const O = t?.outside, d = A(O?.door?.at);
  if (!d) return [];
  const h = Number.isFinite(O.top) && O.top > d[1] + 3 ? Math.min(60, O.top - d[1]) : height;
  return [{ name, top: [d[0], d[1] + h, d[2]], height: h }];
};
/** Several of a kind (the sundial's needles, the forest's pillars) as one landmark: the middle of them, as tall as the tallest. */
const cluster = (name, list) => {
  if (!list.length) return [];
  const n = list.length, c = [0, 1, 2].map((i) => list.reduce((s, b) => s + b.top[i], 0) / n);
  const h = Math.max(...list.map((b) => b.height));
  return [{ name, top: [c[0], Math.max(...list.map((b) => b.top[1])), c[2]], height: h, spread: Math.max(...list.map((b) => Math.hypot(b.top[0] - c[0], b.top[2] - c[2]))) }];
};
const one = (list, o) => list.slice(0, 1).map((m) => ({ ...m, ...o }));
const mk = (list, o = {}) => list.map((m) => ({ w: 1, ...m, ...o }));

/** Per route world: its landmarks for the first views (names as the players know them where the data has one). */
export const MARKS = {
  desert: (L) => {
    const cr = L.qanat?.city?.crown;
    return [
      ...(cr ? mk([{ name: 'Qanat and its great dark tree', top: [cr.x, cr.y, cr.z], height: Math.max(20, cr.y - (L.ground?.heightAt?.(cr.x, cr.z) ?? cr.y - 40)) }], { main: true, w: 3 }) : []),
      ...mk(temple(L, null, 'the Rose House'), { w: 2 }),
      ...mk(beacon(L, 'the giant’s hand'), { w: 1.5 }),
    ];
  },
  arzach: (L) => [
    ...mk(beacon(L, 'the lone tower'), { main: true, w: 3, ground: true }),
    ...mk(temple(L, 'arzach', 'the Aerie'), { w: 1.5 }),
    ...mk(beacon(L, 'the riders’ gate'), { w: 1.5 }),
    ...mk(cluster('the sundial', beacon(L, 'a needle of the sundial')), { w: 2 }),
  ],
  perdide: (L) => [
    ...mk(beacon(L, 'the Great Crystal'), { main: true, w: 3 }),
    ...mk(beacon(L, 'the cave’s crown'), { w: 1.5 }),
    ...mk(beacon(L, 'the keepers’ light'), { w: 1.5 }),
    ...mk(temple(L, 'perdide', 'the crystal temple'), { w: 1 }),
  ],
  edena: (L) => [
    ...mk(beacon(L, 'the Greenhouse’s glass spire'), { main: true, w: 3 }),
    ...mk(temple(L, null, 'the Greenhouse’s door'), { w: 1 }),
  ],
  // (since issue #572 the ship lands on the sea port over the city: from up there the sea hides the city, and the lift's
  // house on the deck is the way down)
  underwater: (L) => [
    ...mk(beacon(L, 'the sea port’s lift'), { main: true, w: 3 }),
  ],
  incal: (L) => [
    ...mk(beacon(L, 'the Lodestar'), { main: true, w: 3 }),
    ...mk(beacon(L, 'Lio’s dispatch mast'), { w: 1.5 }),
    ...mk(temple(L, null, 'the temple’s door'), { w: 1 }),
  ],
  glassdunes: (L) => [
    ...mk(beacon(L, 'the Clock-House'), { main: true, w: 3, height: 26 }),
    ...mk(beacon(L, 'the wave’s cairn'), { w: 1.5 }),
    ...mk(beacon(L, 'the breaker’s smoke'), { w: 1.5 }),
  ],
  buried: (L) => [
    ...mk(beacon(L, 'the canyon stack’s steam'), { main: true, w: 3, ground: true }),
    ...mk(beacon(L, 'Fisk’s flag'), { w: 1.5 }),
    ...mk(temple(L, null, 'the temple’s door'), { w: 1.5 }),
  ],
  moonfoundry: (L) => {
    const lk = L.lookout, cr = L.crane;
    return [
      ...mk(temple(L, null, 'the Casting-House'), { main: true, w: 3 }),
      ...(lk ? mk([{ name: 'the lookout moon', top: [lk.x, lk.y + 14, lk.z], height: lk.y + 14 }], { w: 2 }) : []),
      ...(cr ? mk([{ name: 'the last furnace’s crane', top: [cr.x, cr.y + 18, cr.z], height: 18 }], { w: 1.5 }) : []),
    ];
  },
  spheres: (L) => {
    const S = L.spheres, orb = (o, name) => (o ? [{ name, top: [o.x, o.y + o.R, o.z], height: 2 * o.R }] : []);
    return [
      ...mk(cluster('the forest of pillars', beacon(L, 'a pillar of the forest')), { main: true, w: 3 }),
      ...mk(orb(S?.great, 'the great sphere on the horizon'), { w: 2 }),
      ...mk(orb(S?.listen?.bell, 'the sphere of the bell'), { w: 1 }),
      ...mk(temple(L, null, 'the temple’s door'), { w: 1.5 }),
    ];
  },
  spacecity: (L) => [
    ...mk(beacon(L, 'the stack’s lamp'), { main: true, w: 3 }),
    ...mk(one(beacon(L, 'the Mooring-House'), { height: 24 }), { w: 2 }),
    ...mk(beacon(L, 'the Balcony’s lamp-mast'), { w: 1 }),
    ...mk(beacon(L, 'the Market’s lamp-mast'), { w: 1 }),
  ],
  bazaar: (L) => [
    ...mk(beacon(L, 'the silent tower’s mast'), { main: true, w: 3, ground: true }),
    ...mk(beacon(L, 'the needle behind the square'), { w: 1.5, ground: true }),
    ...mk(temple(L, null, 'the temple’s door'), { w: 1 }),
  ],
};

/**
 * Where the establishing shot's camera may stand, per world, where the default (140-250 m off the ship, 22-110 m up)
 * reads badly: on the Underwater City's sea port and in the Moon Foundry's haze it stands nearer and lower (far off is
 * only blue, or white); in the Signal Market high over the roofs (from the street its towers fill the frame).
 */
export const VIEW_OPTS = {
  // (down the ramp the camps' lane runs straight to the gate and the tree: the first view looks along it, issue #706)
  desert: { exitTurn: 0.15 },
  underwater: { dists: [90, 130, 170], heights: [16, 28, 40] },
  moonfoundry: { dists: [90, 120, 160], heights: [16, 28, 42], haze: 220 },
  bazaar: { dists: [200, 280, 360], heights: [170, 230, 290] },
};
const DISTS = [140, 190, 250], HEIGHTS = [22, 40, 65, 110];

/** The landmarks of a world for its first views (an empty list for a world with none named). */
export function marksOf(id, level, groundAt = null) {
  return (MARKS[id]?.(level) ?? []).map((m) => {
    // (a beacon's height is its own tip, a spire, a mast, the steam: `ground` ones stand on the ground under them, the tower all of it)
    if (!m.ground || !groundAt) return m;
    const g = groundAt(m.top[0], m.top[2]);
    return Number.isFinite(g) && g < m.top[1] - m.height ? { ...m, height: m.top[1] - g } : m;
  }).filter((m) => m.top && m.top.every(Number.isFinite) && m.height > 0);
}

/** Where a landmark is aimed at: points down it from just under its top (a tall one's top may be out of the frame, its body in). */
export const AIM_AT = [0.05, 0.3, 0.6, 0.9];
export function aims(m) {
  return AIM_AT.map((k) => [m.top[0], m.top[1] - k * m.height, m.top[2]]);
}
/** Which of a landmark's aim points have a clear line from `pos`. */
export const sightLines = (pos, m, los) => aims(m).map((a) => los(pos, a));
/** A landmark in a camera's frame (any aim point in it), and seen (an aim point in it with a clear line). vis: sightLines' answer. */
export function seenIn(cam, m, vis, { figure = false, margin = 0.9 } = {}) {
  let inF = false, seen = false;
  aims(m).forEach((a, i) => {
    const s = screenOf(cam, a);
    if (!inFrame(s, { x: margin, top: Math.min(0.86, margin), bottom: -Math.min(0.86, margin) })) return;
    inF = true;
    if (vis[i] && !(figure && behindFigure(s))) seen = true;
  });
  return { inFrame: inF, seen };
}
/** Behind the traveller himself in the rig's framing (his head over the middle of the frame, his body under it). */
export const behindFigure = (s) => Math.abs(s.x) < 0.12 && s.y < 0.16;

// ------------------------------------------------------------------ framing
/** A camera for a view { pos, look, fov } (fov vertical, degrees). */
export function viewCamera(v, aspect = ASPECT) {
  const c = new THREE.PerspectiveCamera(v.fov, aspect, 0.3, 6000);
  c.position.copy(V(v.pos));
  c.up.set(0, 1, 0);
  c.lookAt(V(v.look));
  c.updateMatrixWorld(true);
  c.updateProjectionMatrix();
  return c;
}
const _p = new THREE.Vector3(), _bb = new THREE.Box3(), _sz = new THREE.Vector3();
/** Where p falls on the screen of camera c: [x, y] in -1..1 (NDC), and whether it is in front. */
export function screenOf(c, p) {
  _p.copy(V(p)).applyMatrix4(c.matrixWorldInverse);
  const front = _p.z < -0.3;
  _p.applyMatrix4(c.projectionMatrix);
  return { x: _p.x, y: _p.y, front };
}
/** In the frame, inside a margin (the letterbox bars and the subtitles keep off the edges). */
export const inFrame = (s, { x = 0.9, top = 0.86, bottom = -0.86 } = {}) => s.front && Math.abs(s.x) <= x && s.y <= top && s.y >= bottom;

/**
 * What a view shows of the landmarks: for each, its body in the frame and seen (a clear line to its body or its top).
 * los(a, b): a clear line from a to b (arrays).
 */
export function framed(view, marks, los, { camera = null, aspect = ASPECT, figure = false } = {}) {
  const c = camera ?? viewCamera(view, aspect);
  const pos = A(c.position);
  return marks.map((m) => {
    const r = seenIn(c, m, sightLines(pos, m, los), { figure }), sb = screenOf(c, aims(m)[1]);
    return { name: m.name, main: !!m.main, inFrame: r.inFrame, seen: r.seen, at: [+sb.x.toFixed(2), +sb.y.toFixed(2)] };
  });
}

/**
 * A line-of-sight test against a world's collision and terrain (arrays in): the ray's first hit at least `tol` m past b
 * or near it (the landmark itself is hit), and the terrain under the ray all the way. physics: { rayDistance, base? }.
 */
export function losOf(physics, heightAt = physics.base?.heightAt ? (x, z) => physics.base.heightAt(x, z) : null) {
  const o = new THREE.Vector3(), d = new THREE.Vector3();
  // (a terrain the eye is under is not this world's ground: the Underwater City's answers its sea's ceiling there)
  const over = (a) => { const h = heightAt?.(a[0], a[2]); return !Number.isFinite(h) || h < a[1]; };
  const blockedByTerrain = (a, b, len, tol) => {
    if (!heightAt || !over(a)) return false;
    const step = Math.max(3, len / 160);
    for (let s = step; s < len - tol; s += step) {
      const k = s / len, x = a[0] + (b[0] - a[0]) * k, y = a[1] + (b[1] - a[1]) * k, z = a[2] + (b[2] - a[2]) * k;
      const h = heightAt(x, z);
      if (Number.isFinite(h) && h > y + 0.3) return true;
    }
    return false;
  };
  const los = (a, b) => {
    o.set(a[0], a[1], a[2]); d.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    const len = d.length();
    if (len < 1) return true;
    d.divideScalar(len);
    const tol = Math.max(8, 0.04 * len);
    if (physics.rayDistance(o, d, len) < len - tol) return false;
    return !blockedByTerrain(a, b, len, tol);
  };
  /** The first hit along a ray (collision or terrain), m, or Infinity. */
  const hit = (a, dir, far) => {
    o.set(a[0], a[1], a[2]); d.set(dir[0], dir[1], dir[2]).normalize();
    let best = physics.rayDistance(o, d, far);
    if (heightAt && over(a)) {
      const step = 4;
      for (let s = step; s < Math.min(best, far); s += s < 60 ? step : s < 300 ? 8 : 16) {
        const h = heightAt(a[0] + d.x * s, a[2] + d.z * s);
        if (Number.isFinite(h) && h > a[1] + d.y * s) { best = s; break; }
      }
    }
    return best;
  };
  return { los, hit };
}

/**
 * What the sightlines are cast against: what is drawn, not only what is walked into (a tower without a collider still
 * hides what is behind it): every opaque mesh shown, less glass (the Underwater City's domes and tubes hide nothing, as
 * scripts/level-design/audit.mjs sees them), water and the sky; small instanced things (a few hundred at most: the
 * trees, not the grass) too. Baked into a Physics of its own (the class passed in: src/physics.js), the terrain as the
 * world's. Offline only (scripts/arrival-views.mjs, the test).
 */
export function sightPhysics(scene, level, Physics) {
  scene.updateMatrixWorld(true);
  const proxy = new THREE.Scene(), sphere = new THREE.Sphere();
  const shown = (o) => { for (let p = o; p; p = p.parent) if (p.visible === false) return false; return true; };
  const solid = (m) => m && !m.transparent && m.depthWrite !== false && m.visible !== false && !(m.uniforms?.uGlass?.value > 0);
  scene.traverse((o) => {
    if (!o.isMesh || !o.geometry?.attributes?.position || !shown(o)) return;
    // (instanced: the big ones, Lorn's stalks, the trees; never the grass and the tufts)
    if (o.isInstancedMesh) {
      o.geometry.boundingSphere ?? o.geometry.computeBoundingSphere();
      if (o.userData.dynamic || o.count > 4000 || o.geometry.boundingSphere.radius * o.matrixWorld.getMaxScaleOnAxis() < 2) return;
    }
    if (o.isSkinnedMesh || o.userData.dynamic) return;
    if (![].concat(o.material).every(solid)) return;
    o.geometry.boundingSphere ?? o.geometry.computeBoundingSphere();
    sphere.copy(o.geometry.boundingSphere).applyMatrix4(o.matrixWorld);
    if (!(sphere.radius < 2500)) return;   // (the sky's dome)
    // (a sheet as wide as the world, the Underwater City's sea overhead, a lake's top: seen through or under)
    o.geometry.boundingBox ?? o.geometry.computeBoundingBox();
    const sz = _bb.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld).getSize(_sz);
    if (sz.y < 3 && sz.x > 400 && sz.z > 400) return;
    const p = o.isInstancedMesh ? new THREE.InstancedMesh(o.geometry, o.material, o.count) : new THREE.Mesh(o.geometry, o.material);
    if (o.isInstancedMesh) { p.instanceMatrix = o.instanceMatrix; p.count = o.count; }
    p.matrixAutoUpdate = false; p.matrix.copy(o.matrixWorld);
    proxy.add(p);
  });
  return new Physics(proxy, level.ground?.heightAt ? level.ground : null);
}

/**
 * A grid of rays through a view's frame: `blocked`, the share hitting something within `near` m that stands over `wall`
 * (a tower in front, a wall, a cliff, the dune's slope: not the ground it looks down on); `sky`, the share of the top
 * third open to the sky; `open`, the share of the whole frame that is (a big sky: Moebius's).
 */
export function clutter(view, hit, { near = 60, cols = 16, rows = 9, aspect = ASPECT, wall = -Infinity } = {}) {
  const c = viewCamera(view, aspect), pos = A(c.position);
  let blocked = 0, sky = 0, skyN = 0, open = 0;
  const dir = new THREE.Vector3();
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const x = -1 + (2 * i + 1) / cols, y = -1 + (2 * j + 1) / rows;
    dir.set(x, y, 0.5).unproject(c).sub(c.position).normalize();
    const h = hit(pos, [dir.x, dir.y, dir.z], 3000);
    const far = !Number.isFinite(h) || h >= 3000;
    if (!far && h < near && pos[1] + dir.y * h > wall) blocked++;
    if (far) open++;
    if (j >= rows - 3) { skyN++; if (far) sky++; }
  }
  return { blocked: blocked / (cols * rows), sky: skyN ? sky / skyN : 0, open: open / (cols * rows) };
}

// ------------------------------------------------------------------ picking the views
const yawTo = (a, b) => Math.atan2(b[0] - a[0], b[2] - a[2]);

/**
 * The establishing shot of the first landing. ship: { rest: [x, y, z] } (where it stands), marks, { los, hit },
 * ground(x, z). The camera stands off the ship, 22-80 m over the ground, and looks out over it at the landmarks: the
 * ship comes down into the frame from above (WIDE.from to WIDE.to m over its rest). Scored by the landmarks it shows
 * (by weight, the main ones a must), the ship in the frame, nothing near filling it, and the sky's share.
 */
export function pickWide({ rest, marks, los, hit, ground, aspect = ASPECT, dists = DISTS, heights = HEIGHTS, haze = Infinity }) {
  const W = marks.reduce((s, m) => s + m.w, 0) || 1;
  const cx = marks.reduce((s, m) => s + m.top[0] * m.w, 0) / W, cz = marks.reduce((s, m) => s + m.top[2] * m.w, 0) / W;
  const toMarks = marks.length ? yawTo(rest, [cx, 0, cz]) : 0;
  // (under a ceiling, the Underwater City's sea: the ship seen coming down under it, the camera under it too)
  const roof = rest[1] + 12 + hit([rest[0], rest[1] + 12, rest[2]], [0, 1, 0], 400);
  const shipLow = [rest[0], rest[1] + WIDE.to, rest[2]], shipMid = [rest[0], Math.min(rest[1] + 110, roof - 6), rest[2]], shipSeen = [rest[0], rest[1] + 12, rest[2]];
  const cands = [];
  for (let ai = 0; ai < 18; ai++) {
    const a = toMarks + Math.PI + ((ai % 2 ? 1 : -1) * Math.ceil(ai / 2) * Math.PI) / 9;   // behind the ship first, then round
    for (const D of dists) for (const H of heights) {
      const x = rest[0] + Math.sin(a) * D, z = rest[2] + Math.cos(a) * D;
      const g = ground(x, z);
      if (!Number.isFinite(g)) continue;
      const y = Math.min(Math.max(g, rest[1]) + H, roof - 6);
      if (y < g + 8) continue;
      const pos = [x, y, z];
      // (not inside anything: a clear line to the ship as it comes down, and nothing just over the lens)
      if (!los(pos, shipSeen) || !los(pos, shipMid)) continue;
      if (hit(pos, [0, 1, 0], 40) < 40) continue;
      const vis = marks.map((m) => sightLines(pos, m, los));
      cands.push({ pos, vis, a });
    }
  }
  const views = [];
  for (const c of cands) {
    const toShip = yawTo(c.pos, rest);
    for (const dy of [-0.3, -0.15, 0, 0.15, 0.3]) for (const pitch of [-0.1, -0.03, 0.04, 0.1]) for (const fov of [46, 54]) {
      const yaw = toShip + dy, dist = 200;
      const look = [c.pos[0] + Math.sin(yaw) * Math.cos(pitch) * dist, c.pos[1] + Math.sin(pitch) * dist, c.pos[2] + Math.cos(yaw) * Math.cos(pitch) * dist];
      const view = { pos: c.pos, look, fov };
      const cam = viewCamera(view, aspect);
      const sLow = screenOf(cam, shipLow), sMid = screenOf(cam, shipMid);
      if (!inFrame(sLow, { x: 0.75, top: 0.5, bottom: -0.7 }) || !inFrame(sMid, { x: 0.8, top: 0.85, bottom: -0.7 })) continue;
      let s = 0, mains = 0, mainSeen = 0;
      marks.forEach((m, i) => {
        const r = seenIn(cam, m, c.vis[i], { margin: 0.8 });   // (kept off the edges: the drift moves the frame a little)
        // (in a haze, what is far off counts for less: it is barely drawn)
        const w = m.w * Math.exp(-Math.max(0, Math.hypot(m.top[0] - c.pos[0], m.top[2] - c.pos[2]) - 80) / haze);
        if (m.main) mains++;
        if (r.seen) { s += w; if (m.main) mainSeen++; } else if (r.inFrame) s += 0.15 * w;
      });
      if (mainSeen < mains) s -= 4;
      // a small ship off the middle (the rule of thirds), and the frame balanced: the ship and what is seen not all to one side
      s += 0.4 * (1 - Math.abs(Math.abs(sLow.x) - 0.3) / 0.7);
      const xs = [sLow.x, ...marks.map((m, i) => (seenIn(cam, m, c.vis[i], { margin: 0.8 }).seen ? screenOf(cam, aims(m)[1]).x : null)).filter((x) => x != null)];
      s -= 3 * Math.max(0, Math.abs(xs.reduce((a, b) => a + b, 0) / xs.length) - 0.15);
      views.push({ view, s, sLow });
    }
  }
  views.sort((a, b) => b.s - a.s);
  let best = null;
  for (const v of views.slice(0, 60)) {
    // (in front of the ship: anything standing over its landing ground nearer than it is, a tower, a roof, a mesa's side)
    const dShip = Math.hypot(rest[0] - v.view.pos[0], rest[1] - v.view.pos[1], rest[2] - v.view.pos[2]);
    const cl = clutter(v.view, hit, { near: 0.85 * dShip, aspect, wall: rest[1] + 8 });
    // (and a wall of things just past it, a wood's trunks, a row of towers, filling a third of the frame: less)
    const mass = clutter(v.view, hit, { near: 1.6 * dShip, aspect, wall: rest[1] + 15, cols: 12, rows: 7 }).blocked;
    const s = v.s - 14 * cl.blocked - 4 * Math.max(0, mass - 0.12) + 0.6 * cl.sky + 3 * Math.min(cl.open, 0.5);
    cl.mass = mass;
    if (!best || s > best.s) best = { ...v, s, clutter: cl };
  }
  if (!best) return null;
  const r = (n) => Math.round(n * 10) / 10;
  // a slow drift across the frame while it holds (3 % of the distance to the ship, sideways, and down a little): the
  // way that keeps the most of what it shows in the frame at its end, the main ones all (else only down)
  const toShip = yawTo(best.view.pos, rest), side = [Math.cos(toShip), 0, -Math.sin(toShip)];
  const D = Math.hypot(rest[0] - best.view.pos[0], rest[2] - best.view.pos[2]);
  const endOf = (d) => ({ pos: best.view.pos.map((p, i) => p + d[i]), look: best.view.look.map((p, i) => p + d[i]), fov: best.view.fov });
  const keeps = (d) => {
    const f = framed(endOf(d), marks, los, { aspect });
    return f.every((m) => !m.main || m.seen) ? f.filter((m) => m.seen).length : -1;
  };
  const drifts = [1, -1].map((k) => [side[0] * 0.03 * D * k, -3, side[2] * 0.03 * D * k]).concat([[0, -3, 0]]);
  const drift = drifts.reduce((a, b) => (keeps(b) > keeps(a) ? b : a));
  return { pos: best.view.pos.map(r), look: best.view.look.map(r), fov: best.view.fov, drift: drift.map(r), score: +best.s.toFixed(2), clutter: best.clutter };
}

/** The rig's framing behind someone standing at `stand` facing `heading`, pitched `pitch` (the camera behind and over him). */
export function rigView(stand, heading, pitch = REVEAL.pitch, { arm = RIG.arm, swing = 0, back = 0, rise = 0 } = {}) {
  const look = [stand[0], stand[1] + RIG.look + Math.max(0, -pitch) * 1.4, stand[2]];   // (CameraRig.lookHeight: higher looking up)
  const yaw = heading + Math.PI + swing, p = pitch + rise, cp = Math.cos(p), L = arm + back;
  const pos = [look[0] + Math.sin(yaw) * cp * L, look[1] + Math.sin(p) * L, look[2] + Math.cos(yaw) * cp * L];
  return { pos, look, fov: RIG.fov };
}

/**
 * The first step out: the heading at the foot of the ramp whose framing (the rig behind him, a little high) shows the
 * most of the landmarks with nothing near filling the frame; and the side the drift into it comes from (`swing`, the
 * side with room). stand: where he stops ([x, y, z]); out: the heading he walks out on (preferred a little, ties).
 */
export function pickExit({ stand, out = 0, marks, los, hit, aspect = ASPECT, away = null, exitTurn = Math.PI }) {
  let best = null;
  for (let i = 0; i < 48; i++) {
    const heading = out + (i * Math.PI * 2) / 48;
    // (a world whose way on lies straight down the ramp keeps its first view on it: `exitTurn` rad either side at most)
    if (Math.abs(Math.atan2(Math.sin(heading - out), Math.cos(heading - out))) > exitTurn + 1e-9) continue;
    // (a little high, as the rig stands in the open; lower where the main landmark stands high over the landing: the
    //  City-Shaft's Lodestar, the market's silent tower)
    for (const pitch of EXIT_PITCHES) {
      const view = rigView(stand, heading, pitch);
      const cam = viewCamera(view, aspect);
      let s = 0, mains = 0, mainSeen = 0;
      for (const m of marks) {
        const r = seenIn(cam, m, sightLines(view.pos, m, los), { figure: true });
        if (m.main) mains++;
        if (r.seen) { s += m.w; if (m.main) mainSeen++; }
      }
      if (mainSeen < mains) s -= 4;
      if (s + 1 < (best?.s ?? -Infinity)) continue;
      const cl = clutter(view, hit, { near: 30, aspect, wall: stand[1] + 0.6, cols: 12, rows: 7 });
      s += -5 * cl.blocked + 0.8 * cl.sky - 0.15 * (1 - Math.cos(heading - out)) - 3 * Math.abs(pitch - REVEAL.pitch);
      if (!best || s > best.s) best = { heading, pitch, s, clutter: cl };
    }
  }
  if (!best) return null;
  // the drift comes in from the side with room (its start never in a wall), away from the ship's ramp (`away`: its hinge)
  let swing = 0;
  const start = (sw) => rigView(stand, best.heading, best.pitch, { swing: sw, back: REVEAL.back, rise: REVEAL.rise });
  const off = (sw) => (away ? Math.hypot(start(sw).pos[0] - away[0], start(sw).pos[2] - away[2]) : 0);
  const sides = [REVEAL.swing, -REVEAL.swing].sort((a, b) => off(b) - off(a));
  for (const sw of [...sides, sides[0] / 2, sides[1] / 2]) {
    const v = start(sw);
    const len = Math.hypot(v.pos[0] - v.look[0], v.pos[1] - v.look[1], v.pos[2] - v.look[2]);
    const dir = [(v.pos[0] - v.look[0]) / len, (v.pos[1] - v.look[1]) / len, (v.pos[2] - v.look[2]) / len];
    if (hit(v.look, dir, len + 1) > len + 0.8) { swing = sw; break; }
  }
  const a = Math.atan2(Math.sin(best.heading), Math.cos(best.heading));
  return { heading: +a.toFixed(3), pitch: best.pitch, swing, score: +best.s.toFixed(2), clutter: best.clutter };
}

// ------------------------------------------------------------------ at play
/**
 * The first views for a world's parked ship, or null: none picked for it, or the ship no longer stands where they
 * were picked (a level changed since scripts/arrival-views.mjs ran; the test says so first).
 */
export function arrivalViews(id, restPos) {
  const v = ARRIVAL_VIEWS[id];
  if (!v || !restPos) return null;
  // (where it stands on the ground: the desert's crashed ship, dug in for the prologue, stands on the same site)
  if (Math.hypot(v.ship[0] - restPos.x, v.ship[2] - restPos.z) > 3) return null;
  return v;
}
/** Where he stops at the foot of the ramp on the first step out, turned to the view: two steps out, then one toward it. */
export function exitStops(rampFoot, outDir, heading) {
  const a = rampFoot.clone().addScaledVector(outDir, 2);
  const b = a.clone().add(new THREE.Vector3(Math.sin(heading), 0, Math.cos(heading)).multiplyScalar(1.2));
  return [a, b];
}

/**
 * Any input that is his (cuts the first step out's drift short): a new key or button (not one held as it began, `held`:
 * the skip), the stick or the look stick pushed, a trigger pulled. ctl: the merged controls (src/controller.js).
 */
export function anyInput(ctl, held = new Set()) {
  for (const [k, v] of Object.entries(ctl ?? {})) {
    if (k === 'Escape') continue;
    if (v === true && !held.has(k)) return true;
    if (typeof v === 'number' && Math.abs(v) > 0.25) return true;
    if (v && typeof v === 'object' && Math.hypot(v.x ?? 0, v.y ?? 0) > 0.25) return true;
  }
  return false;
}
