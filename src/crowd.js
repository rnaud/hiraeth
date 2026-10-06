import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeMaterial, sharedUniforms } from './materials.js';
import { CROWD_GLSL, CROWD_POSES as POSE, CROWD_ZONES as Z, CROWD_PARTS as P, CROWD_SLOTS as SLOT } from './crowd-shader.js';
import { COSTUMES, HEADS as HEADWEAR, MASKS, BODIES, PROPS, HEAD_IDS, MASK_IDS, BODY_IDS, PROP_IDS, CROWD_FRAMES, GENERIC_HAIR, tribeOf, hairCap, crowdLook, packDress, packBody, costumeWorld } from './costumes.js';
import { KNOCKOVER } from './ragdoll.js';
import { registerTarget } from './targets.js';
import { mulberry32 } from './noise.js';
import { formatText } from './story/dialogue.js';
import { speakBalloon } from './story/voice.js';
import { simplify } from './lod.js';
import { runSteps } from './load-steps.js';

// City crowds, Assassin's Creed style: everybody is simulated by one cheap
// CPU loop (positions, groups, glances, reactions), and drawn in tiers:
//
//   near  the few closest people become full NPCs (skinned body, cloth cape,
//         mocap, speech balloons), taken from a small pool and restyled to
//         match; at most a couple are swapped per frame
//   mid   up to ~70 m: one InstancedMesh of low-poly figures posed entirely
//         in the vertex shader (crowd-shader.js) from per-instance attributes;
//         rebuilt every frame with only the people in view; the closest ones
//         also cast shadows through a matching depth-only mesh
//   far   beyond: an even simpler figure, no shadows, rewritten every 4th frame;
//         past range.dist (set from the graphics preset's lodPx) the same figure
//         simplified to ~0.1 m (lod.js), where a person is a few pixels tall
//
// People stand in conversation circles (one talks, the others listen, nod and
// glance), stroll alone or in pairs along routes, lean on railings and walls,
// or sit on edges. Walking through a group parts it; they look at you and
// pause their talk. Placement comes from the level (level.crowdSpots()) and is
// checked against the collision world: only walkable, clear ground.
//
// A walk can be a procession (`column: true`): everyone goes one way round
// a loop, spread over `spread` (fractions of the route) at one `speed`, in
// `lanes` side by side, keeping their place in the column; crowd.hold(id)
// stops the whole column for a moment (someone in it is talking to you).
// Any spot may carry its own `lines` (what those people say) and `roles`
// (tags given to its first people: a drummer, a lantern bearer…).

const TIER = { off: 0, far: 1, mid: 2, near: 3 };
export const CROWD_TIER = TIER;
export const CROWD_RANGE = { nearIn: 9, nearOut: 12.5, midIn: 65, midOut: 72, shadow: 35, target: 60, far: 420, dist: Infinity };
export const CROWD_DIST_CELL = 0.1;   // m: the distant figure's detail (lod.js simplify)
/** The figures' cape rows (0 collar → 1 hem): one just under the shoulders, then down to the hem. */
export const CAPE_ROWS = { mid: [0, 0.12, 0.33, 0.6, 1], far: [0, 0.25, 1] };
export const CROWD_BUDGET = { pool: 4, swapsPerFrame: 2 };   // full NPCs cost ~0.3 ms of CPU each

const TAU = Math.PI * 2;
const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _o = new THREE.Vector3(), _d = new THREE.Vector3();
const _m = new THREE.Matrix4(), _frustum = new THREE.Frustum(), _sphere = new THREE.Sphere();
const UP = new THREE.Vector3(0, 1, 0);
const DIRS8 = Array.from({ length: 8 }, (_, i) => new THREE.Vector3(Math.cos(i * TAU / 8), 0, Math.sin(i * TAU / 8)));
const wrapA = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const damp = (k, dt) => 1 - Math.exp(-k * dt);
/**
 * The way to face someone at flat offset `v` (`d` m away), kept in `o[key]`: followed as they move,
 * but held while they stand right on top of us (an atan2 of a few centimetres swung people round
 * and back every frame as you shuffled into them).
 */
export function holdAim(o, key, v, d, near = 0.25, far = 0.7) {
  const a = Math.atan2(v.x, v.z);
  if (o[key] === undefined || !Number.isFinite(o[key])) o[key] = a;
  else o[key] += wrapA(a - o[key]) * THREE.MathUtils.smoothstep(d, near, far);
  return o[key];
}

// ------------------------------------------------------------------ looks
// (what people wear comes from their world: costumes.js)
export const CROWD_STYLE = {
  cloaks: ['#c8483a', '#5fb7ad', '#d8a24a', '#8a6fb8', '#e6875f', '#f3ead8', '#62c3c9', '#e88fa6', '#697a98', '#dca273', '#84bab3', '#c3a9cc'],
  tunics: ['#343a56', '#5a4a3a', '#3f6f6a', '#6a3a4a', '#e2d3b4', '#4a5a3a'],
  legs: ['#2b2f45', '#4a3a2a', '#2f3f3a', '#5a4a40', '#3a3a3a'],
  skins: ['#e9cfb4', '#d9a98a', '#b07a5a', '#f1dccb', '#8a5a40'],
  hair: ['#2b211f', '#4a3226', '#6e4a32', '#b0a89a', '#a8552e', '#e8dcc0'],
  hats: ['#d8a24a', '#e6875f', '#f3ead8', '#62c3c9', '#a99be0'],
};
export const STARTLE_LINES = ['~surprised~ Hey!', '~scared~ Ow! What was that?', '~angry~ Who threw that?', '~angry~ Watch it!', '~curious~ Was that you?', '~angry~ Hey, not funny!'];
// what people say when a glob of fluid splashes them, and when the push shoves them
export const SPLASH_LINES = ['~angry~ Hey! I\u2019m soaked!', '~surprised~ Ugh, it\u2019s all colours!', '~angry~ Who threw that?', '~curious~ Was that you?', '~sad~ My good cloak!', '~angry~ Hey, not funny!'];
export const SHOVE_LINES = ['~surprised~ Whoa! Watch it!', '~angry~ Oof! Hey!', '~angry~ Mind where you push!', '~scared~ Easy, traveller!', '~angry~ What was that for?'];
// an ember glob (it never burns) and a stilling glob's few seconds (fluid-kit.js STUN_SECONDS)
export const SINGE_LINES = ['~shout~ Hot! Hot!', '~surprised~ Yow! Sparks!', '~surprised~ My cloak! …it doesn’t burn?', '~angry~ Who’s throwing fire?'];
const STUN_FOR = 3.5;
/** A shove's displacement over time (0..1): knocked back fast, held a moment, then they walk back to their place. */
export const shoveCurve = (s) => (s < 0 || s > 3.6 ? 0 : s < 0.35 ? 1 - (1 - s / 0.35) ** 3 : s < 1.8 ? 1 : 1 - THREE.MathUtils.smoothstep(s, 1.8, 3.6));
export const GREET_LINES = ['~shout~ Fresh figs! Fresh figs!', '~scared~ Mind the edge, it\u2019s a long way down.', '~angry~ The taxis never stop for us lower folk.',
  '~curious~ Have you seen the light above the palace?', '~happy~ Laundry dries fast up here.', '~sad~ My grandmother never saw the sky.', '~playful~ Lovely hat.', '~neutral~ Excuse me.', '~tired~ Busy day.'];

const hexOf = (c) => new THREE.Color(c).getHex();
/** A crowd person's look: their world's costume (costumes.js) over the level's crowd colours. */
export function crowdStyle(rng, palette = {}, { world = costumeWorld(), spot = null, pos = null, kind = null } = {}) {
  return crowdLook(rng, { world, lists: palette, spot, pos, kind });
}
/** The per-instance colour, costume and body attributes: aLook0, aLook1, aDress, aBody (crowd-shader.js). */
export function packLook(s) {
  const d = packDress(s);
  return [
    new Float32Array([hexOf(s.cloak), hexOf(s.cloth), hexOf(s.legs), hexOf(s.skin)]),
    new Float32Array([hexOf(s.hat), hexOf(s.accent), hexOf(s.hair), d.w]),
    new Float32Array(d.dress),
    new Float32Array(packBody(s)),
  ];
}

// ------------------------------------------------------------------ figures
function tag(geo, part, zone, variant = 0) {
  if (geo.attributes.uv) geo.deleteAttribute('uv');
  const n = geo.attributes.position.count, a = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) { a[i * 4] = part; a[i * 4 + 1] = zone; a[i * 4 + 2] = variant; }
  geo.setAttribute('aRig', new THREE.BufferAttribute(a, 4));
  if (!geo.index) geo.setIndex([...Array(n).keys()]);
  return geo;
}
/**
 * The cape as parameters: xz = direction round the body, aRig.w = 0 collar → 1 hem (the shader places it),
 * in rows at `ts` (one just under the shoulders, where the cloth widens over them and the arms).
 */
function capeGeometry(cols, ts, gap = 0.42) {
  const pos = [], nrm = [], rig = [], idx = [], rows = ts.length;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const a = gap + (c / (cols - 1)) * (TAU - gap * 2), t = ts[r];
    pos.push(Math.sin(a), 0, Math.cos(a)); nrm.push(Math.sin(a), 0, Math.cos(a)); rig.push(P.cape, Z.cloak, SLOT.cape * 64, t);
  }
  for (let r = 0; r < rows - 1; r++) for (let c = 0; c < cols - 1; c++) {
    const a = r * cols + c, b = a + 1, d = a + cols, e = d + 1;
    idx.push(a, d, b, b, d, e);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  g.setAttribute('aRig', new THREE.Float32BufferAttribute(rig, 4));
  g.setIndex(idx);
  return g;
}
/** The robe as parameters, like the cape: xz = direction round the body, aRig.w = 0 belt → 1 hem; the last band is the accent hem. */
function robeGeometry(cols, rows) {
  const pos = [], nrm = [], rig = [], idx = [];
  const ts = rows <= 2 ? [0, 0.88, 0.88, 1] : [0, 0.3, 0.62, 0.88, 0.88, 1];
  ts.forEach((t, r) => {
    const zone = r >= ts.length - 2 ? Z.accent : Z.cloth;
    for (let c = 0; c <= cols; c++) {
      const a = (c / cols) * TAU;
      pos.push(Math.sin(a), 0, Math.cos(a)); nrm.push(Math.sin(a), 0, Math.cos(a)); rig.push(P.robe, zone, SLOT.robe * 64, t);
    }
  });
  for (let r = 0; r < ts.length - 1; r++) {
    if (ts[r] === ts[r + 1]) continue;   // the seam between the cloth and its hem band
    for (let c = 0; c < cols; c++) {
      const a = r * (cols + 1) + c, b = a + 1, d = a + cols + 1, e = d + 1;
      idx.push(a, d, b, b, d, e);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  g.setAttribute('aRig', new THREE.Float32BufferAttribute(rig, 4));
  g.setIndex(idx);
  return g;
}
const at = (g, x, y, z) => g.translate(x, y, z);
const ROLE_ZONE = { skin: Z.skin, cloak: Z.cloak, cloth: Z.cloth, legs: Z.legs, hat: Z.hat, accent: Z.accent, hair: Z.hair, lining: Z.lining,
  dark: Z.dark, metal: Z.metal, wood: Z.wood, lamp: Z.lamp };
const ids = (w) => Object.entries(w ?? {}).filter(([id, v]) => v > 0 && id !== 'none').map(([id]) => id);
/** The pieces a world's crowd can wear (every tribe's), for its figure. */
export function worldPieces(world) {
  const tribes = COSTUMES[world]?.tribes ?? [tribeOf(null)];
  // (a tribe's own pieces and stage 3's, drawn apart: costumes.js `more`)
  const keys = (...ks) => [...new Set(tribes.flatMap((t) => ks.flatMap((k) => [...ids(t[k]), ...ids(t.more?.[k])])))];
  // a bare head ('hair', 'short') is always drawn in the tribe's own hairstyles (costumes.js dressFor), a man's
  // or a woman's: those instead of the generic ones; and any man may have a beard
  const hair = tribes.flatMap((t) => (['heads', 'headsF', 'headsM'].some((k) => GENERIC_HAIR.some((h) => t[k]?.[h] > 0)) ? [...ids(t.hair?.m), ...ids(t.hair?.f)] : []));
  const heads = [...new Set([...keys('heads', 'headsF', 'headsM').filter((h) => !GENERIC_HAIR.includes(h)), ...hair])];
  return { heads, masks: [...new Set([...keys('masks'), 'beard'])], bodies: keys('body'), props: keys('props'), robe: tribes.some((t) => t.robe > 0) };
}

/**
 * Low-poly figure for the instanced tiers; 'mid' (~0.6k tris plus the world's costume pieces) or
 * 'far' (~0.15k plus the big shapes). Only the world's own costume pieces are baked in (costumes.js).
 */
export function figureGeometry(detail = 'mid', world = null) {
  const C = THREE;
  const parts = [];
  const add = (g, part, zone, variant = 0) => parts.push(tag(g, part, zone, variant));
  const W = worldPieces(world);
  const far = detail === 'far', q = far ? 0.3 : 0.5;
  const F = CROWD_FRAMES;
  const frame = (g, f) => f === 'head' ? g.scale(F.head.s, F.head.s, F.head.s).translate(0, F.head.y, F.head.z)
    : f === 'chest' ? g.translate(0, F.chest.y, 0) : g.translate(F.hand.x, F.hand.y, F.hand.z);
  const partOf = { head: P.head, chest: P.torso, hand: P.foreR };
  const costume = (list, f, slot, id) => { for (const pc of list) if (!far || pc.far) add(frame(pc.geo, f), partOf[f], ROLE_ZONE[pc.role] ?? Z.cloak, slot * 64 + id); };
  // the world's headwear, masks, shoulder pieces and props (the shader keeps the ones each person wears)
  for (const id of W.heads) {
    costume(HEADWEAR[id].parts(q), 'head', SLOT.head, HEAD_IDS.indexOf(id));
    if (HEADWEAR[id].chest) costume(HEADWEAR[id].chest(q), 'chest', SLOT.head, HEAD_IDS.indexOf(id));   // (a hood thrown back: on the shoulders)
  }
  if (W.heads.some((id) => HEADWEAR[id].cap)) costume([hairCap(q)], 'head', SLOT.hairCap, 0);
  if (!far) for (const id of W.masks) costume(MASKS[id](q), 'head', SLOT.mask, MASK_IDS.indexOf(id));
  for (const id of W.bodies) costume(BODIES[id](q), 'chest', SLOT.body, BODY_IDS.indexOf(id));
  for (const id of W.props) costume(PROPS[id](q), 'hand', SLOT.prop, PROP_IDS.indexOf(id));
  if (W.robe) parts.push(robeGeometry(far ? 6 : 10, far ? 2 : 4));
  if (far) {
    for (const s of [1, -1]) {
      add(at(new C.BoxGeometry(0.11, 0.5, 0.13), s * 0.09, 0.72, 0), s > 0 ? P.thighL : P.thighR, Z.legs);
      add(at(new C.BoxGeometry(0.1, 0.5, 0.12), s * 0.09, 0.25, 0.01), s > 0 ? P.shinL : P.shinR, Z.legs);
      add(at(new C.BoxGeometry(0.075, 0.6, 0.08), s * 0.2, 1.14, 0), s > 0 ? P.armL : P.armR, Z.cloth);
    }
    add(at(new C.CylinderGeometry(0.135, 0.165, 0.62, 6, 1, true), 0, 1.16, 0), P.torso, Z.cloth);
    add(at(new C.SphereGeometry(0.105, 6, 4).scale(0.92, 1.2, 1), 0, 1.64, 0), P.head, Z.skin);
    parts.push(capeGeometry(6, CAPE_ROWS.far));
    return finish(parts);
  }
  for (const s of [1, -1]) {
    const L = s > 0;
    add(at(new C.BoxGeometry(0.1, 0.08, 0.25), s * 0.09, 0.04, 0.045), L ? P.shinL : P.shinR, Z.boots);
    add(at(new C.CylinderGeometry(0.05, 0.042, 0.44, 6, 1, true), s * 0.09, 0.3, 0), L ? P.shinL : P.shinR, Z.legs);
    add(at(new C.CylinderGeometry(0.068, 0.052, 0.48, 6, 1, true), s * 0.09, 0.73, 0), L ? P.thighL : P.thighR, Z.legs);
    add(at(new C.CylinderGeometry(0.042, 0.036, 0.3, 5, 1, true), s * 0.2, 1.28, 0), L ? P.armL : P.armR, Z.cloth);
    add(at(new C.CylinderGeometry(0.036, 0.03, 0.25, 5, 1, true), s * 0.2, 1.005, 0), L ? P.foreL : P.foreR, Z.cloth);
    add(at(new C.CylinderGeometry(0.04, 0.04, 0.05, 5, 1, true), s * 0.2, 0.9, 0), L ? P.foreL : P.foreR, Z.cuff);
    add(at(new C.SphereGeometry(0.044, 5, 4), s * 0.2, 0.845, 0.005), L ? P.foreL : P.foreR, Z.skin);
    // an eye: a flat almond lying on the face, tilted up at the outer corner (the shader draws the white and the iris, eyes.js)
    add(at(new C.CircleGeometry(1, 10).scale(0.017, 0.0068, 1).rotateZ(s * 0.18).rotateY(s * 0.45), s * 0.031, 1.672, 0.0935), P.head, Z.eye);
  }
  // tunic: a long figure, slim waist, a short flare over the trousers
  const prof = [[0.158, 0.86], [0.15, 0.95], [0.132, 1.03], [0.15, 1.22], [0.165, 1.35], [0.12, 1.465], [0.05, 1.49]].map(([r, y]) => new C.Vector2(r, y));
  add(new C.LatheGeometry(prof, 9), P.torso, Z.cloth);
  add(at(new C.CylinderGeometry(0.142, 0.142, 0.05, 9, 1, true), 0, 0.97, 0), P.torso, Z.belt);
  add(at(new C.CylinderGeometry(0.045, 0.05, 0.13, 6, 1, true), 0, 1.5, 0), P.head, Z.skin);
  add(at(new C.SphereGeometry(0.1, 8, 6).scale(0.92, 1.22, 1.02), 0, 1.64, 0.005), P.head, Z.skin);
  add(at(new C.ConeGeometry(0.022, 0.12, 4).rotateX(Math.PI / 2 + 0.4), 0, 1.625, 0.105), P.head, Z.skin);
  // the cape and its collar
  parts.push(capeGeometry(9, CAPE_ROWS.mid));
  add(at(new C.TorusGeometry(0.19, 0.03, 4, 10).rotateX(Math.PI / 2), 0, 1.45, 0), P.torso, Z.cloak, SLOT.cape * 64);
  return finish(parts);
}
function finish(parts) {
  for (const g of parts) for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'aRig'].includes(k)) g.deleteAttribute(k);
  const g = mergeGeometries(parts);
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 1, 0), 1.6);
  return g;
}

// ------------------------------------------------------------------ placement
/** Spatial hash of circles to keep clear (trees, props, quest people). */
export class ClearMap {
  constructor(list = [], cell = 8) {
    this.cell = cell; this.map = new Map();
    for (const c of list) this.add(c);
  }
  key(i, j) { return i * 73856093 ^ j * 19349663; }
  add(c) {
    const s = this.cell, r = c.r;
    for (let i = Math.floor((c.x - r) / s); i <= Math.floor((c.x + r) / s); i++)
      for (let j = Math.floor((c.z - r) / s); j <= Math.floor((c.z + r) / s); j++) {
        const k = this.key(i, j);
        if (!this.map.has(k)) this.map.set(k, []);
        this.map.get(k).push(c);
      }
  }
  blocked(x, y, z, pad = 0) {
    const l = this.map.get(this.key(Math.floor(x / this.cell), Math.floor(z / this.cell)));
    if (!l) return false;
    for (const c of l) if ((c.x - x) ** 2 + (c.z - z) ** 2 < (c.r + pad) ** 2 && (c.y === undefined || Math.abs(c.y - y) < (c.h ?? 3))) return true;
    return false;
  }
}

/**
 * Ground under (x, z) close to height y, if a person can stand there: a floor
 * within 0.7 m, nothing overhead, no wall within `clear`, and level ground all
 * round the feet (not on an edge). Returns the floor height or NaN.
 */
export function standable(physics, x, y, z, { clear = 0.45, avoid = null, pad = 0.3, edge = true, heights = [0.4, 1.25] } = {}) {
  const g = physics.groundAt(x, y + 1.6, z, 3.5);
  if (!Number.isFinite(g) || Math.abs(g - y) > 0.7) return NaN;
  if (avoid?.blocked(x, g, z, pad)) return NaN;
  _o.set(x, g + 0.12, z);
  if (physics.rayDistance(_o, UP, 2.1) < 2.1) return NaN;
  for (const h of heights) {
    _o.set(x, g + h, z);
    for (let i = 0; i < 8; i += h < 0.9 ? 2 : 1) if (physics.rayDistance(_o, DIRS8[i], clear) < clear) return NaN;
  }
  // not inside something big and solid (a bridge's abutment on the spire ring: its walls are further than `clear`)
  if (physics.embedded?.(_o.set(x, g + 1.0, z))) return NaN;
  if (edge) for (let i = 1; i < 8; i += 2) {
    const gx = physics.groundAt(x + DIRS8[i].x * 0.32, g + 0.8, z + DIRS8[i].z * 0.32, 1.5);
    if (!Number.isFinite(gx) || Math.abs(gx - g) > 0.22) return NaN;
  }
  return g;
}

const fwdOf = (h, out = new THREE.Vector3()) => out.set(Math.sin(h), 0, Math.cos(h));

/** Check a perch: 'rail' (lean on a railing ahead), 'sit' (legs over a drop), 'kerb' (a low step ahead), 'wall' (back to a wall), 'look', or 'edge' (rail, else sit). */
export function perch(physics, spot, avoid) {
  const f = fwdOf(spot.heading, new THREE.Vector3());
  const { x, z } = spot.at, y = spot.at.y;
  const ahead = (h, d, from = 0) => physics.rayDistance(_o.set(x + f.x * from, h, z + f.z * from), f, d);
  const tryRail = () => {
    const g = standable(physics, x, y, z, { clear: 0.28, avoid, pad: 0.2 });
    if (!Number.isFinite(g)) return null;
    if (spot.rail !== undefined) return { pose: 'rail', y: g, back: 0.5 - spot.rail };   // a drawn-only railing the level vouches for
    const d = Math.min(ahead(g + 1.05, 0.95), ahead(g + 1.18, 0.95));
    return d < 0.95 && d > 0.22 ? { pose: 'rail', y: g, back: 0.5 - d } : null;
  };
  const trySit = () => {
    const g = physics.groundAt(x, y + 1.6, z, 3.5);
    if (!Number.isFinite(g) || Math.abs(g - y) > 0.7 || avoid?.blocked(x, g, z, 0.2)) return null;
    // the seat and room behind it, a long drop ahead, nothing in the way of the legs
    const gb = physics.groundAt(x - f.x * 0.35, g + 0.8, z - f.z * 0.35, 1.5);
    if (!Number.isFinite(gb) || Math.abs(gb - g) > 0.15) return null;
    const ga = physics.groundAt(x + f.x * 0.45, g + 0.2, z + f.z * 0.45, 400);
    if (Number.isFinite(ga) && ga > g - 1.6) return null;
    if (ahead(g + 0.3, 1.0) < 1.0 || ahead(g - 0.5, 0.7, 0.3) < 0.7 || physics.rayDistance(_o.set(x, g + 0.1, z), UP, 1.6) < 1.6) return null;
    return { pose: 'sit', y: g };
  };
  if (spot.pose === 'rail') return tryRail();
  if (spot.pose === 'sit') return trySit();
  if (spot.pose === 'edge') return tryRail() ?? trySit();
  if (spot.pose === 'kerb') {
    const g = physics.groundAt(x, y + 1.6, z, 3.5);
    if (!Number.isFinite(g) || Math.abs(g - y) > 0.5 || avoid?.blocked(x, g, z, 0.5)) return null;
    const gf = physics.groundAt(x + f.x * 0.55, g + 0.1, z + f.z * 0.55, 1.2);
    if (!Number.isFinite(gf) || Math.abs(g - gf - 0.3) > 0.12) return null;
    if (ahead(g - 0.15, 0.8, 0.3) < 0.8 || ahead(g + 0.6, 1.1) < 1.1) return null;
    return { pose: 'kerb', y: g };
  }
  const g = standable(physics, x, y, z, { clear: spot.pose === 'wall' ? 0.22 : 0.45, avoid });
  if (!Number.isFinite(g)) return null;
  if (spot.pose === 'wall') {
    _d.copy(f).negate();
    const d = physics.rayDistance(_o.set(x, g + 1.2, z), _d, 0.65);
    return d < 0.65 ? { pose: 'wall', y: g, back: d - 0.3 } : null;
  }
  return { pose: 'look', y: g };
}

/** Split a polyline into walkable runs (samples ~2.5 m apart, at least minRun of them): [{ pts (with ground heights), loop }]. */
export function walkablePath(physics, pts, { avoid = null, clear = 1.3, lateral = 1.1, loop = false, minRun = 5 } = {}) {
  const samples = [];
  const src = loop ? [...pts, pts[0]] : pts;
  for (let i = 0; i < src.length - 1; i++) {
    // (every 1.5 m: a pillar or a stall's post between two samples used to be walked through)
    const a = src[i], b = src[i + 1], len = a.distanceTo(b), n = Math.max(1, Math.ceil(len / 1.5));
    for (let k = 0; k < n; k++) samples.push(a.clone().lerp(b, k / n));
  }
  if (!loop) samples.push(src[src.length - 1].clone());
  const ok = samples.map((p, i) => {
    const g = standable(physics, p.x, p.y, p.z, { clear, avoid, pad: 0.5, edge: false, heights: [1.0] });   // the side checks below cover edges
    if (!Number.isFinite(g)) return false;
    // room for side by side walkers and sidesteps: ground both sides at the same height
    const q = samples[(i + 1) % samples.length], dx = q.x - p.x, dz = q.z - p.z, l = Math.hypot(dx, dz) || 1;
    for (const s of [-lateral, lateral]) {
      const x = p.x - dz / l * s, z = p.z + dx / l * s;
      const gs = physics.groundAt(x, g + 0.8, z, 1.5);
      if (!Number.isFinite(gs) || Math.abs(gs - g) > 0.25 || avoid?.blocked(x, g, z, 0.3)) return false;
      // and nothing standing in the side lane: a walker stepping aside must not pass through it
      _d.set(-dz / l * Math.sign(s), 0, dx / l * Math.sign(s));
      for (const h of [0.5, 1.4]) if (physics.rayDistance(_o.set(p.x, g + h, p.z), _d, lateral + 0.35) < lateral + 0.35) return false;
    }
    p.y = g;
    return true;
  });
  const runs = [];
  let cur = [];
  for (let i = 0; i < samples.length; i++) {
    if (ok[i]) cur.push(samples[i]);
    else { runs.push(cur); cur = []; }
  }
  runs.push(cur);
  if (loop && runs.length === 1) return [{ pts: cur, loop: true }];
  return runs.filter((r) => r.length >= minRun).map((pts) => ({ pts, loop: false }));
}

/** Turn a level's crowd spots into people: validated against the collision world. */
export function buildPeople(physics, spots, o = {}) { return runSteps(buildPeopleSteps(physics, spots, o)); }
/** buildPeople a spot at a time (each is rays through the collision): for a world's load (src/load-steps.js). */
export function* buildPeopleSteps(physics, spots, { seed = 7, clear = [] } = {}) {
  const rng = mulberry32(seed);
  const avoid = new ClearMap([...(spots.avoid ?? []), ...(spots.clear ?? []), ...clear]);
  const people = [], groups = [], routes = [];
  // looks come from their own random stream (the placement draws stay what they were)
  const world = spots.costume ?? costumeWorld(), lookRng = mulberry32(seed * 7919 + 13);
  const oldDraws = () => { if (Math.floor(rng() * 6) !== 0) rng(); for (let i = 0; i < 7; i++) rng(); };
  const person = (o) => {
    const kind = rng() < 0.5 ? 'm' : 'f';
    oldDraws();
    const s = crowdStyle(lookRng, spots.palette, { world, spot: o.spot ?? null, pos: o.pos, kind });
    // their own height on top of the tribe's size (leaning on a railing: nearly the railing's height, so the arms meet it)
    const size = (0.95 + rng() * 0.1) * s.size * (o.pose === 'rail' ? 1 + (s.height - 1) * 0.25 : s.height);
    const p = {
      id: people.length, kind, style: s, look: packLook(s), size, scale: size * (kind === 'm' ? 1.03 : 1.0),
      pos: o.pos.clone(), home: o.pos.clone(), heading: o.heading, homeHeading: o.heading,
      pose: POSE[o.pose ?? 'stand'], group: null, walk: null, seed: rng(),
      phase: rng(), cadence: 0, speed: 0, headYaw: 0, headPitch: 0, talk: 0,
      startleT: -1e9, stumbleUntil: -1e9, stunUntil: -1e9, stumbleT: 0, lookUntil: -1e9, faceUntil: -1e9, greetT: -1, speaking: false, say: '',
      offset: new THREE.Vector3(), tier: TIER.off, npc: null, unreg: null, chestV: new THREE.Vector3(),
      lines: o.lines ?? spots.lines ?? GREET_LINES, lineIdx: Math.floor(rng() * 20), shoutUntil: -1e9,
      role: o.role ?? null, spot: o.spot ?? null,
    };
    people.push(p);
    return p;
  };
  // strollers, alone or in pairs, both ways along each route (keeping right)
  for (const sp of spots.walks ?? []) {
    yield;
    const runs = walkablePath(physics, sp.path, { avoid, loop: sp.loop, lateral: sp.lateral ?? 1.1 });
    const runLen = runs.reduce((s, r) => s + r.pts.length, 0);
    for (const path of runs) {
    const pts = path.pts, cum = [0];
    for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + pts[i].distanceTo(pts[i - 1]));
    const total = path.loop ? cum[cum.length - 1] + pts[pts.length - 1].distanceTo(pts[0]) : cum[cum.length - 1];
    if (total < 8) continue;
    const lateral = sp.lateral ?? 1.1;
    const route = { pts, cum, total, loop: path.loop, keepRight: sp.keepRight ?? 0.7, lateral, id: sp.id ?? null };
    routes.push(route);
    // keep the lanes free of standing people
    for (let i = 0; i < pts.length; i += 2) avoid.add({ x: pts[i].x, y: pts[i].y, z: pts[i].z, r: lateral + 0.45 + (sp.lanes ? sp.lanes * 0.45 : 0) });
    if (sp.column && path.loop) {
      // a procession: rows of `lanes`, one way round, spread over a stretch of the loop
      const lanes = sp.lanes ?? 3, n = sp.n ?? 40, rows = Math.ceil(n / lanes);
      const [f0, f1] = sp.spread ?? [0, 0.1];
      route.column = { speed: sp.speed ?? 1.15, clock: 0, holdUntil: -1e9, lead: f1 * total, lanes, gap: sp.gap ?? 0.95 };
      let k = 0, roles = [...(sp.roles ?? [])];
      for (let r = 0; r < rows && k < n; r++) for (let l = 0; l < lanes && k < n; l++, k++) {
        const slot = f1 * total - (r / Math.max(rows - 1, 1)) * (f1 - f0) * total + (rng() - 0.5) * 0.5;
        const p = person({ pos: pts[0], heading: 0, pose: 'walk', lines: sp.lines, role: roles.shift() ?? null, spot: sp });
        p.walk = { route, u: slot, slot, dir: 1, speed: route.column.speed, side: (l - (lanes - 1) / 2) * route.column.gap * 2 - route.keepRight, step: 0, pause: 0, avoid: 0, partner: null, slow: 1 };
        placeWalker(p, 0);
      }
      continue;
    }
    const units = Math.max(1, Math.round((sp.n ?? 4) * pts.length / runLen));
    for (let k = 0; k < units; k++) {
      const pair = rng() < (sp.pair ?? 0.45);
      const u = rng() * total, dir = path.loop ? (rng() < 0.7 ? 1 : -1) : (rng() < 0.5 ? 1 : -1);
      const speed = 1.05 + rng() * 0.35;
      const unit = [];
      for (let q = 0; q < (pair ? 2 : 1); q++) {
        const p = person({ pos: pts[0], heading: 0, pose: 'walk', lines: sp.lines, spot: sp });
        p.walk = { route, u, dir, speed, side: pair ? (q ? 0.36 : -0.36) : 0, step: 0, pause: rng() * 2, avoid: 0, partner: null, slow: 1 };
        unit.push(p);
      }
      if (pair) { unit[0].walk.partner = unit[1]; unit[1].walk.partner = unit[0]; }
      for (const p of unit) placeWalker(p, 0);
    }
    }
  }
  // conversation circles
  for (const sp of spots.groups ?? []) {
    yield;
    const n = sp.n ?? 3, r = 0.42 + n * 0.17, a0 = rng() * TAU;
    const cx = sp.at.x, cz = sp.at.z;
    if (avoid.blocked(cx, sp.at.y, cz, r * 0.6)) continue;
    const mem = [];
    const roles = [...(sp.roles ?? [])];
    for (let k = 0; k < n; k++) {
      // a couple of tries per place in the circle, shuffling round a little
      for (let tryN = 0; tryN < 3; tryN++) {
        const a = a0 + (k / n) * TAU + (rng() - 0.5) * (tryN ? 1.1 : 0.5), rr = r * (0.88 + rng() * 0.24) * (tryN === 2 ? 0.8 : 1);
        const x = cx + Math.cos(a) * rr, z = cz + Math.sin(a) * rr;
        const g = standable(physics, x, sp.at.y, z, { avoid });
        if (!Number.isFinite(g)) continue;
        mem.push({ pos: new THREE.Vector3(x, g, z), heading: Math.atan2(cx - x, cz - z) + (rng() - 0.5) * 0.3 });
        break;
      }
    }
    if (mem.length < 2) continue;
    const g = { id: groups.length, center: new THREE.Vector3(cx, mem[0].pos.y, cz), r, members: [], speaker: 0, next: rng() * 4, pauseUntil: -1e9, lookUntil: -1e9 };
    for (const m of mem) { const p = person({ ...m, lines: sp.lines, role: roles.shift() ?? null, spot: sp }); p.group = g; g.members.push(p); }
    g.tag = sp.id ?? null;
    groups.push(g);
    avoid.add({ x: cx, y: g.center.y, z: cz, r: r + 0.3 });
  }
  // perches: railings, walls, kerbs and edges
  for (const sp of spots.edges ?? []) {
    yield;
    if (avoid.blocked(sp.at.x, sp.at.y, sp.at.z, 0.25)) continue;
    const ok = perch(physics, sp, avoid);
    if (!ok) continue;
    const pos = new THREE.Vector3(sp.at.x, ok.y, sp.at.z);
    if (ok.back) pos.addScaledVector(fwdOf(sp.heading, _v), -ok.back);
    const p = person({ pos, heading: sp.heading, pose: ok.pose === 'look' ? 'stand' : ok.pose, lines: sp.lines, role: sp.role ?? null, spot: sp });
    p.perch = ok.pose;
    avoid.add({ x: pos.x, y: pos.y, z: pos.z, r: 0.45 });
  }
  return { people, groups, routes };
}

/** Where a walker is on its route at its current u (with the lateral keep-right / pair / sidestep offsets). */
function placeWalker(p, dt) {
  const w = p.walk, R = w.route, pts = R.pts, cum = R.cum;
  let u = w.u;
  if (R.loop) u = ((u % R.total) + R.total) % R.total;
  else u = THREE.MathUtils.clamp(u, 0, R.total);
  // segment search from the last one
  let i = THREE.MathUtils.clamp(w.step, 0, pts.length - 1);
  while (i > 0 && cum[i] > u) i--;
  while (i < pts.length - 1 && cum[i + 1] <= u) i++;
  w.step = i;
  const a = pts[i], b = pts[(i + 1) % pts.length];
  const segLen = i + 1 < pts.length ? cum[i + 1] - cum[i] : R.total - cum[i];
  const k = segLen > 1e-6 ? (u - cum[i]) / segLen : 0;
  _v.copy(a).lerp(b, THREE.MathUtils.clamp(k, 0, 1));
  _d.subVectors(b, a); _d.y = 0;
  if (_d.lengthSq() < 1e-8) _d.set(0, 0, 1);
  _d.normalize().multiplyScalar(w.dir);
  w.fx = _d.x; w.fz = _d.z;   // (the way they walk)
  const lat = R.keepRight + w.side * w.dir + w.avoid;   // right of the walking direction
  p.pos.set(_v.x - _d.z * lat, _v.y, _v.z + _d.x * lat);
  const want = Math.atan2(_d.x, _d.z);
  p.heading += wrapA(want - p.heading) * (dt ? damp(6, dt) : 1);
}

// ------------------------------------------------------------------ instanced tiers
const BODY0 = [0, 1, 1, 0];   // a plain body (no aBody given)
class Tier {
  constructor(geometry, material, max) {
    this.max = max;
    this.geometry = geometry;
    this.attrs = {};
    for (const k of ['aAnim', 'aReact', 'aLook0', 'aLook1', 'aDress', 'aBody']) {
      const a = new THREE.InstancedBufferAttribute(new Float32Array(max * 4), 4);
      a.setUsage(THREE.DynamicDrawUsage);
      geometry.setAttribute(k, a);
      this.attrs[k] = a;
    }
    this.mesh = new THREE.InstancedMesh(geometry, material, max);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.userData.noCollide = true;
    this.mesh.userData.dynamic = true;
    this.mesh.count = 0;
    this.n = 0;
  }
  write(i, p, t) {
    const M = this.mesh.instanceMatrix.array, o = i * 16, s = p.scale, c = Math.cos(p.heading) * s, sn = Math.sin(p.heading) * s;
    M[o] = c; M[o + 1] = 0; M[o + 2] = -sn; M[o + 3] = 0;
    M[o + 4] = 0; M[o + 5] = s; M[o + 6] = 0; M[o + 7] = 0;
    M[o + 8] = sn; M[o + 9] = 0; M[o + 10] = c; M[o + 11] = 0;
    M[o + 12] = p.pos.x; M[o + 13] = p.pos.y; M[o + 14] = p.pos.z; M[o + 15] = 1;
    const A = this.attrs, j = i * 4;
    const stumbling = t < p.stumbleUntil;
    const cad = stumbling ? 0 : p.cadence;
    const an = A.aAnim.array;
    an[j] = ((p.phase - t * cad) % 1 + 1) % 1; an[j + 1] = cad; an[j + 2] = p.seed; an[j + 3] = stumbling ? POSE.stumble : p.speed > 0.05 ? POSE.walk : p.pose === POSE.walk ? POSE.stand : p.pose;
    const re = A.aReact.array;
    re[j] = p.headYaw; re[j + 1] = p.headPitch; re[j + 2] = p.talk; re[j + 3] = stumbling ? p.stumbleT : p.startleT;
    A.aLook0.array.set(p.look[0], j);
    A.aLook1.array.set(p.look[1], j);
    A.aDress.array.set(p.look[2], j);
    A.aBody.array.set(p.look[3] ?? BODY0, j);
  }
  commit(n) {
    this.n = n;
    const m = this.mesh.instanceMatrix;
    m.clearUpdateRanges(); m.addUpdateRange(0, Math.max(n, 1) * 16); m.needsUpdate = true;
    for (const a of Object.values(this.attrs)) { a.clearUpdateRanges(); a.addUpdateRange(0, Math.max(n, 1) * 4); a.needsUpdate = true; }
  }
}

function crowdDepthMaterial() {
  const m = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    uniforms: { uTime: sharedUniforms.uTime },
    vertexShader: `${CROWD_GLSL}
      void main() {
        vec3 p = position, n = normal, c;
        crowdAnimate(p, n, c);
        gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: 'void main() {}',
    side: THREE.DoubleSide,
    colorWrite: false,
  });
  m.allowOverride = false;   // keeps its own vertex animation in the shadow passes (which override every other material)
  return m;
}

// ------------------------------------------------------------------ the crowd
export class Crowd {
  /**
   * @param o.spots      level.crowdSpots() result
   * @param o.makeNPC    (kind) => NPC with assign(person) / release(): the near-tier pool (omit for no pool)
   * @param o.clear      [{ x, y, z, r }] keep these clear (quest people, the spawn)
   * @param o.built      buildPeople's result, if already worked out (in steps, during the load)
   * @param o.pooled     the near tier's bodies, if already made (alternately 'm' and 'f', as makeNPC would)
   */
  constructor(scene, physics, { spots, makeNPC = null, pool = CROWD_BUDGET.pool, clear = [], seed = 11, range = {}, built = null, pooled = null } = {}) {
    this.scene = scene;
    this.physics = physics;
    this.range = { ...CROWD_RANGE, far: spots.farMax ?? CROWD_RANGE.far, ...range };
    const t0 = typeof performance !== 'undefined' ? performance.now() : 0;
    Object.assign(this, built ?? buildPeople(physics, spots, { seed, clear }));
    this.buildMs = (typeof performance !== 'undefined' ? performance.now() : 0) - t0;
    this.rng = mulberry32(seed + 1);
    const n = this.people.length;
    const material = makeMaterial({ color: '#ffffff', crowd: true, side: THREE.DoubleSide });
    this.world = spots.costume ?? costumeWorld();
    this.mid = new Tier(figureGeometry('mid', this.world), material, Math.max(n, 1));
    // (the cape and robe are parameters the shader turns into shapes, not positions: they stay as they are)
    const farGeo = figureGeometry('far', this.world), rig = farGeo.attributes.aRig;
    const distGeo = simplify(farGeo, CROWD_DIST_CELL, { lock: Uint8Array.from({ length: rig.count }, (_, i) => (rig.getX(i) >= 9.5 ? 1 : 0)) });
    this.far = new Tier(farGeo, material, Math.max(n, 1));
    this.dist = distGeo ? new Tier(distGeo, material, Math.max(n, 1)) : null;
    // the shadow caster shares the mid tier's buffers, but draws only the closest, only in shadow passes
    this.shadow = new THREE.InstancedMesh(this.mid.geometry, crowdDepthMaterial(), Math.max(n, 1));
    this.shadow.instanceMatrix = this.mid.mesh.instanceMatrix;
    Object.assign(this.shadow, { frustumCulled: false, count: 0 });
    this.shadow.userData.noCollide = true;
    this.nShadow = 0;
    const shadowPass = (scene) => !!scene.overrideMaterial;
    this.mid.mesh.onBeforeRender = (r, scene) => { this.mid.mesh.count = shadowPass(scene) ? 0 : this.mid.n; };
    this.far.mesh.onBeforeRender = (r, scene) => { this.far.mesh.count = shadowPass(scene) ? 0 : this.far.n; };
    if (this.dist) this.dist.mesh.onBeforeRender = (r, scene) => { this.dist.mesh.count = shadowPass(scene) ? 0 : this.dist.n; };
    // only the fine and near cascades: in the km-wide one a person is less than a texel
    this.shadow.onBeforeRender = (r, scene, cam) => { this.shadow.count = shadowPass(scene) && cam.isOrthographicCamera && cam.right - cam.left < 1000 ? this.nShadow : 0; };
    scene.add(this.mid.mesh, this.far.mesh, this.shadow);
    if (this.dist) scene.add(this.dist.mesh);

    this.pool = [];
    if (pooled) pooled.forEach((npc, i) => this.pool.push({ npc, kind: i % 2 ? 'f' : 'm', person: null }));
    else if (makeNPC) for (let i = 0; i < pool; i++) this.pool.push({ npc: makeNPC(i % 2 ? 'f' : 'm'), kind: i % 2 ? 'f' : 'm', person: null });
    this.frame = 0;
    this.time = 0;
    this.playerPos = new THREE.Vector3();
    this.stats = { people: n, groups: this.groups.length, near: 0, mid: 0, far: 0, shadow: 0, targets: 0, promoted: 0, demoted: 0 };
    this.farDirty = true;
    if (typeof document !== 'undefined') {
      this.balloon = document.createElement('div');
      this.balloon.className = 'balloon';
      document.body.appendChild(this.balloon);
      this.shout = null;
    }
  }

  get npcs() { return this.pool.map((e) => e.npc); }

  /** A procession route by id. */
  route(id) { return this.routes.find((r) => r.id === id) ?? null; }
  /** Stop a procession (or a group, by its spot id) for `seconds` from now. */
  hold(id, seconds = 1) {
    const r = this.route(id);
    if (r?.column) r.column.holdUntil = Math.max(r.column.holdUntil, this.time + seconds);
    for (const g of this.groups) if (g.tag === id) { g.pauseUntil = Math.max(g.pauseUntil, this.time + seconds); g.lookUntil = Math.max(g.lookUntil, this.time + seconds); }
  }
  /**
   * Everyone (or everyone within `r` of `near`) looks at `point` for `seconds`, heads turned and
   * tilted toward it, unless you stop right beside them: a light in the sky, a broadcast.
   */
  lookAt(point, seconds = 10, { near = null, r = Infinity } = {}) {
    const until = this.time + seconds, r2 = r * r;
    for (const p of this.people) {
      if (near && p.pos.distanceToSquared(near) > r2) continue;
      p.gazeAt = point; p.gazeUntil = until + (p.seed - 0.5) * 2;
    }
  }
  /** The point at distance u along a route (wrapping on loops), and its heading. */
  routePoint(route, u, out = new THREE.Vector3()) {
    const R = route, pts = R.pts, cum = R.cum;
    u = R.loop ? ((u % R.total) + R.total) % R.total : THREE.MathUtils.clamp(u, 0, R.total);
    let lo = 0, hi = pts.length - 1;
    while (lo < hi) { const m = (lo + hi + 1) >> 1; if (cum[m] <= u) lo = m; else hi = m - 1; }
    const a = pts[lo], b = pts[(lo + 1) % pts.length];
    const seg = lo + 1 < pts.length ? cum[lo + 1] - cum[lo] : R.total - cum[lo];
    out.copy(a).lerp(b, seg > 1e-6 ? THREE.MathUtils.clamp((u - cum[lo]) / seg, 0, 1) : 0);
    out.heading = Math.atan2(b.x - a.x, b.z - a.z);
    return out;
  }
  /** The head of a procession: where the first row is now. */
  columnHead(id, ahead = 0, out = new THREE.Vector3()) {
    const r = this.route(id);
    if (!r?.column) return null;
    return this.routePoint(r, r.column.clock + r.column.lead + ahead, out);
  }
  get lowDetail() { return this.pool.some((e) => e.npc.lowDetail); }

  /** Simulate everybody, pick tiers, promote / demote, fill the instance buffers. */
  update(dt, t, player, camera) {
    this.time = t;
    this.frame++;
    this.playerPos.copy(player.pos);
    const pp = player.pos, mover = player.ride ?? player;
    const playerSpeed = Math.hypot(mover.vel?.x ?? 0, mover.vel?.z ?? 0);
    camera.updateMatrixWorld();
    const cam = camera.position;
    const low = this.lowDetail;
    const R = this.range, midIn = low ? 45 : R.midIn, midOut = low ? 50 : R.midOut;

    // ---- processions advance (unless someone in them is talking to you)
    for (const r of this.routes) if (r.column && t >= r.column.holdUntil) r.column.clock += r.column.speed * dt;

    // ---- groups: who's talking, and whether you're barging through
    for (const g of this.groups) {
      const dc = g.center.distanceToSquared(cam);
      if (dc > 120 * 120 && this.frame % 8) continue;
      if (t > g.next) {
        const alive = g.members.filter((m) => t > m.stumbleUntil);
        g.speaker = this.rng() < 0.15 || !alive.length ? -1 : g.members.indexOf(alive[Math.floor(this.rng() * alive.length)]);
        g.next = t + 2.5 + this.rng() * 4.5;
      }
      const d = Math.hypot(pp.x - g.center.x, pp.z - g.center.z);
      if (Math.abs(pp.y - g.center.y) < 2.5) {
        if (d < g.r + 1.3) { g.pauseUntil = t + 1.6; g.lookUntil = Math.max(g.lookUntil, t + 2.2); }
        else if (d < g.r + 3.5 && playerSpeed > 0.3) g.lookUntil = Math.max(g.lookUntil, t + 0.8);
      }
    }

    // ---- people
    let anyTierChange = false;
    for (const p of this.people) {
      const dCam = p.pos.distanceTo(cam);
      // far away people only move a few times a second
      let pdt = dt;
      if (dCam > 120) { p._acc = (p._acc ?? 0) + dt; if ((this.frame + p.id) % 6) { this.tierOf(p, dCam, midIn, midOut) && (anyTierChange = true); continue; } pdt = p._acc; }
      p._acc = 0;
      this.simulate(p, pdt, t, pp, playerSpeed, dCam);
      if (this.tierOf(p, dCam, midIn, midOut)) anyTierChange = true;
    }

    // ---- near tier: promote the closest, demote the ones left behind (a couple per frame)
    this.swapNear(cam, low);

    // ---- mid tier: in view only, the shadow casters first
    const proj = _m.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    _frustum.setFromProjectionMatrix(proj);
    let n = 0;
    const later = this._later ?? (this._later = []);
    later.length = 0;
    for (const p of this.people) {
      if (p.tier < TIER.mid) continue;
      _sphere.center.set(p.pos.x, p.pos.y + 0.9, p.pos.z); _sphere.radius = 1.3;
      p._vis = _frustum.intersectsSphere(_sphere);
      if (!p._vis || p.tier === TIER.near) continue;
      if (p._dCam < R.shadow) this.mid.write(n++, p, t);
      else later.push(p);
    }
    this.nShadow = n;
    for (const p of later) this.mid.write(n++, p, t);
    this.mid.commit(n);

    // ---- far tier: everybody past the mid range in (or just around) the view, rewritten every 4th
    // frame, or as soon as the camera has turned more than that margin
    const fwd = camera.getWorldDirection(_w);
    const turned = !this._farFwd || fwd.dot(this._farFwd) < 0.99;
    if (anyTierChange || this.farDirty || turned || this.frame % 4 === 0) {
      let m = 0, md = 0;
      const D = this.dist ? this.range.dist : Infinity;
      for (const p of this.people) {
        if (p.tier !== TIER.far) continue;
        _sphere.center.set(p.pos.x, p.pos.y + 0.9, p.pos.z); _sphere.radius = 2 + p._dCam * 0.15;   // ~8 deg of margin
        if (!_frustum.intersectsSphere(_sphere)) continue;
        p._dist = p._dCam > (p._dist ? D / 1.1 : D * 1.1);   // (a margin each way: nobody flickers between the two)
        if (p._dist) this.dist.write(md++, p, t); else this.far.write(m++, p, t);
      }
      this.far.commit(m);
      this.dist?.commit(md);
      this.farDirty = false;
      (this._farFwd ??= new THREE.Vector3()).copy(fwd);
    }

    // ---- the tool's targets: people in the near and mid tiers within reach
    if (this.frame % 10 === 1) this.updateTargets();

    const S = this.stats;
    S.mid = n; S.shadow = this.nShadow; S.far = this.far.n + (this.dist?.n ?? 0); S.dist = this.dist?.n ?? 0; S.near = this.pool.filter((e) => e.person).length;
    this.placeBalloon(camera);
  }

  /** Assign a tier with hysteresis; returns true if it changed to / from the far tier. */
  tierOf(p, d, midIn, midOut) {
    p._dCam = d;
    if (p.tier === TIER.near) return false;
    const prev = p.tier;
    const farMax = this.range.far;
    if (d < (prev === TIER.mid ? midOut : midIn)) p.tier = TIER.mid;
    else if (d < (prev >= TIER.far ? farMax + 10 : farMax)) p.tier = TIER.far;
    else p.tier = TIER.off;
    return (prev === TIER.far) !== (p.tier === TIER.far);
  }

  simulate(p, dt, t, pp, playerSpeed, dCam) {
    const stumbling = t < p.stumbleUntil;
    if (p.shoved) p.pos.sub(p.shoved);   // a shove is laid over the simulated place (see below)
    _v.subVectors(pp, p.pos); const dy = _v.y; _v.y = 0;
    const dPlayer = _v.length();
    const sameLevel = Math.abs(dy) < 2.5;
    const g = p.group;
    const toYou = holdAim(p, 'faceA', _v, dPlayer);   // (held while you stand on them)
    let lookAt = null, face = null;
    // greeting: the person you stop beside turns to you and says something
    const close = sameLevel && dPlayer < 2.6 && playerSpeed < 2.2 && !stumbling;
    if (close) { if (p.greetT < 0) { p.greetT = t; p.lineIdx++; } }
    else if (dPlayer > 4) p.greetT = -1;
    p.speaking = p.greetT >= 0 && t - p.greetT > 0.6 && close;
    if (t < p.shoutUntil) p.speaking = true;
    if (p.greetT >= 0) { lookAt = pp; if (p.pose !== POSE.sit && p.pose !== POSE.kerb && p.pose !== POSE.rail) face = toYou; }
    if (t < p.faceUntil && !stumbling) face = toYou;
    if (t < p.lookUntil || (g && t < g.lookUntil) || (sameLevel && dPlayer < 4 && playerSpeed > 0.3)) lookAt = pp;
    if (p.gazeAt && t < p.gazeUntil && !close) lookAt = p.gazeAt;   // everyone looking at something (crowd.lookAt)

    if (p.walk && !stumbling) {
      const w = p.walk;
      let target = w.speed;
      const col = w.route.column;
      if (col) {
        // keep your place in the procession: a little faster when behind, slower when ahead
        const T = w.route.total;
        let err = (col.clock + w.slot) - w.u;
        err -= Math.round(err / T) * T;
        target = t < col.holdUntil ? 0 : THREE.MathUtils.clamp(col.speed + err * 0.35, 0, col.speed + 0.9);
      }
      if (w.pause > 0) { w.pause -= dt; target = 0; }
      // step aside for the player coming the other way (or standing in the way), judged along the
      // way they walk (turned to greet you, their heading is you)
      if (w.fx !== undefined) _w.set(w.fx, 0, w.fz); else fwdOf(p.heading, _w);
      const ahead = _v.dot(_w), side = _v.x * -_w.z + _v.z * _w.x;   // + = player on our right
      let want = 0;
      // (whether you're in their way is judged from where they'd walk without the step: judged from
      // where it had taken them, near the edge of their lane the step took them out of it and the
      // fading step back in, a zigzag every frame; and a small margin once they're stepping)
      const side0 = side + w.avoid, m = w.stepSide ? 0.2 : 0;
      if (sameLevel && ahead > -0.5 - m && ahead < 3.2 + m && Math.abs(side0) < 1.3 + m) {
        // (the side to step to is kept while you're nearly dead ahead: turned to greet you, you
        // are always dead ahead, and the sign of a few cm flipped them left and right every frame)
        if (Math.abs(side0) > 0.3 || !w.stepSide) w.stepSide = side0 > 0 ? -1 : 1;
        want = w.stepSide * Math.min(1, w.route.lateral); target *= ahead < 1 ? 0.3 : 0.65;
      } else w.stepSide = 0;
      if (w.partner) want = w.partner.walk.avoid * 0.9 + want * 0.1;
      if (face !== null || t < p.startleT + 1.2) target = 0;
      w.avoid += (want - w.avoid) * damp(want ? 4 : 1.2, dt);
      p.speed += (target - p.speed) * damp(4, dt);
      w.u += w.dir * p.speed * dt;
      const R = w.route;
      if (!R.loop && (w.u <= 0 || w.u >= R.total)) {
        w.u = THREE.MathUtils.clamp(w.u, 0, R.total);
        w.dir = -w.dir; w.pause = 1 + this.rng() * 3;
        if (w.partner) { w.partner.walk.dir = w.dir; w.partner.walk.u = w.u; w.partner.walk.pause = w.pause; }
      }
      const h = p.heading;
      placeWalker(p, dt);
      if (face !== null) p.heading = h + wrapA(face - h) * damp(5, dt);
      // pairs chat as they walk
      if (w.partner && !lookAt && Math.sin(t * 0.7 + p.seed * 9) > 0.3) lookAt = w.partner.pos;
    } else if (p.walk || stumbling) {
      p.speed = 0;   // frozen (or a stumbling walker)
    } else {
      // standing: drift back to their spot, unless the player is pushing through. They step out of
      // your way and round you, not through you: the offset turns (its way held while you stand
      // on their spot) rather than flipping across, and grows or shrinks along it. (It aimed straight
      // away from you, so a player on their spot swung them from side to side every frame.)
      _w.subVectors(p.home, pp); _w.y = 0;
      const dh = _w.length();
      const room = 1.25;
      let len = p.offset.length();
      if (len < 0.02) p.asideA = undefined;   // back home: the next push picks its way afresh
      const away = holdAim(p, 'asideA', _w, dh, 0.15, 0.6);
      if (sameLevel && dh < room && p.pose !== POSE.sit && p.pose !== POSE.kerb) {
        let ang = len < 0.02 ? away : Math.atan2(p.offset.x, p.offset.z);
        ang += wrapA(away - ang) * damp(5, dt);
        len += (Math.min(room - dh + 0.15, 1.1) - len) * damp(7, dt);
        p.offset.set(Math.sin(ang) * len, 0, Math.cos(ang) * len);
        if (!lookAt) lookAt = pp;
      } else p.offset.multiplyScalar(1 - damp(1.3, dt));
      _o.copy(p.home).add(p.offset);
      if (p.offset.lengthSq() > 1e-4) {
        // stay on the floor and out of the walls while stepping aside
        const gy = this.physics.groundAt(_o.x, p.home.y + 0.8, _o.z, 1.5);
        if (!Number.isFinite(gy) || Math.abs(gy - p.home.y) > 0.3) { p.offset.multiplyScalar(0.8); _o.copy(p.home).add(p.offset); }
        else this.physics.pushCapsule(_o, 0.25, 0.3, 1.6);
      }
      const moved = _o.distanceTo(p.pos);
      p.pos.copy(_o);
      // their pace, smoothed: (read off a single frame it flickered between a step and nothing,
      // and the legs with it)
      const raw = dt > 0 ? Math.min(moved / dt, 2) : 0;
      p.speed += ((raw > 0.12 ? raw : 0) - p.speed) * damp(8, dt);
      if (p.speed < 0.03) p.speed = 0;
      // half turned to you as they step aside (which side you're on: kept while you're nearly in front)
      const rel = wrapA(toYou - p.homeHeading);
      if (Math.abs(rel) > 0.25 || !p.asideTurn) p.asideTurn = Math.sign(rel) || 1;
      const hw = face ?? (p.offset.lengthSq() > 0.04 ? p.homeHeading + 0.5 * p.asideTurn : p.homeHeading);
      p.heading += wrapA(hw - p.heading) * damp(face !== null ? 6 : 2.5, dt);
    }
    // shoved (the fluid push): knocked back, then they walk back to their place
    if (p.shoved || p.shoveT !== undefined) {
      const k = shoveCurve(t - p.shoveT), was = p.shoved ? p.shoved.length() : 0;
      if (k > 0) {
        p.pos.add((p.shoved ??= new THREE.Vector3()).copy(p.shoveDir).multiplyScalar(p.shoveDist * k));
        const moved = Math.abs(p.shoveDist * k - was);
        if (!stumbling && dt > 0 && moved > 0.002) p.speed = Math.max(p.speed, Math.min(moved / dt, 2));
      } else { p.shoved = null; p.shoveT = undefined; }
    }
    p.cadence = p.speed / (1.35 * p.scale);
    p.phase = (p.phase + p.cadence * dt) % 1;

    // talk: the group's speaker, unless paused by the player or a startle
    let talkT = 0;
    if (g && g.speaker >= 0 && g.members[g.speaker] === p && t > g.pauseUntil && !stumbling) talkT = 1;
    if (p.speaking) talkT = 0.8;
    p.talk += (talkT - p.talk) * damp(3, dt);
    // head: at the player, the speaker, or the partner; idle drift is in the shader
    if (!lookAt && g && g.speaker >= 0 && g.members[g.speaker] !== p) lookAt = g.members[g.speaker].pos;
    let yaw = 0, pitch = 0;
    if (lookAt && !stumbling) {
      _w.subVectors(lookAt, p.pos);
      yaw = wrapA((lookAt === pp ? toYou : Math.atan2(_w.x, _w.z)) - p.heading);
      if (Math.abs(yaw) > 1.15 && !p.walk && p.pose === POSE.stand && !stumbling) p.heading += Math.sign(yaw) * (Math.abs(yaw) - 1.15) * damp(2, dt);
      yaw = THREE.MathUtils.clamp(yaw, -1.15, 1.15);
      // eye to eye: the player's eyes are at ~1.5 m, everyone else's at their own height
      pitch = THREE.MathUtils.clamp(-Math.atan2(_w.y + (lookAt === pp ? -0.1 : 0), Math.hypot(_w.x, _w.z) + 0.3) * 0.6, -0.4, 0.4);
    }
    if (!stumbling) {
      p.headYaw += (yaw - p.headYaw) * damp(5, dt);
      p.headPitch += (pitch - p.headPitch) * damp(4, dt);
    }
  }

  swapNear(cam, low) {
    const R = this.range, nearIn = R.nearIn, nearOut = R.nearOut;
    const budget = { n: CROWD_BUDGET.swapsPerFrame };
    const cap = low ? Math.ceil(this.pool.length / 2) : this.pool.length;
    // demote: too far, or over the low-detail cap
    let active = this.pool.filter((e) => e.person);
    active.sort((a, b) => b.person._dCam - a.person._dCam);
    for (const e of active) {
      if (budget.n <= 0) break;
      // (someone knocked over keeps their body until they are up again, unless it is far away: no popping up mid-fall)
      if (e.npc.down ? e.person._dCam > nearOut + 12 : e.person._dCam > nearOut || active.filter((x) => x.person).length > cap) { this.demote(e); budget.n--; }
    }
    if (budget.n <= 0 || !this.pool.length) return;
    // promote: the closest candidates first
    const cand = [];
    for (const p of this.people) if (p.tier === TIER.mid && p._dCam < nearIn && (p._vis || p._dCam < 4)) cand.push(p);   // the few full NPCs go to people in view
    if (!cand.length) return;
    // the one you are talking to first, then by distance to the camera (how big they are on screen)
    const score = (p) => p._dCam - (p.greetT >= 0 ? 6 : 0);
    cand.sort((a, b) => score(a) - score(b));
    for (const p of cand) {
      if (budget.n <= 0) break;
      let e = this.pool.find((x) => !x.person && x.kind === p.kind);
      const used = this.pool.filter((x) => x.person).length;
      if (!e || used >= cap) {
        // swap out the farthest of the same kind if this one is clearly closer
        const worst = this.pool.filter((x) => x.person && x.kind === p.kind).sort((a, b) => score(b.person) - score(a.person))[0];
        if (!worst || score(worst.person) < score(p) + 3 || budget.n < 2) continue;
        this.demote(worst); budget.n--;
        e = worst;
      }
      this.promote(e, p); budget.n--;
    }
  }

  promote(e, p) {
    e.person = p; p.npc = e.npc; p.tier = TIER.near;
    e.npc.assign?.(p, this);
    this.stats.promoted++;
  }
  demote(e) {
    const p = e.person;
    e.npc.release?.();
    e.person = null; p.npc = null; p.tier = TIER.mid;
    this.stats.demoted++;
  }

  updateTargets() {
    const pp = this.playerPos, R2 = this.range.target ** 2;
    let n = 0;
    for (const p of this.people) {
      const want = p.tier >= TIER.mid && p.pos.distanceToSquared(pp) < R2;
      if (want && !p.unreg) {
        p.unreg = registerTarget({
          kind: 'npc', radius: 0.45, person: p, accepts: ['stun', 'fire'],
          position: () => this.chest(p),
          onHit: (mode, point, dir, info) => this.hit(p, mode, dir, info),
        });
      } else if (!want && p.unreg) { p.unreg(); p.unreg = null; }
      if (p.unreg) n++;
    }
    this.stats.targets = n;
  }

  chest(p) {
    const low = p.pose === POSE.sit || p.pose === POSE.kerb;
    return p.chestV.set(p.pos.x, p.pos.y + (low ? 0.45 : 1.15) * p.scale, p.pos.z);
  }

  /**
   * The fluid tool touched someone. 'shoot': a startled splash (a jump, a turn
   * to the traveller, a line; the group looks round). 'push': a shove, they
   * stumble back (arms flung up) and come back to their place; the group jumps
   * and steps back from them. Seated and leaning people just jump.
   */
  hit(p, mode, dir, info) {
    const t = this.time;
    if (t < p.stumbleUntil) return;
    const pick = (a) => a[Math.floor(this.rng() * a.length)];
    const upright = p.pose === POSE.stand || p.pose === POSE.walk || p.pose === POSE.wall || !!p.walk;
    if (mode === 'stun') {
      // stilled: frozen where they are, mid-gesture, for a few seconds; the others look round and jump
      p.stunUntil = p.stumbleUntil = t + STUN_FOR; p.stumbleT = t; p.talk = 0; p.shoutUntil = -1;
      p.lookUntil = t + STUN_FOR;
      for (const m of p.group?.members ?? []) if (m !== p && t >= m.stumbleUntil) { m.lookUntil = t + 3.5; m.startleT = t + 0.1 + this.rng() * 0.25; }
      return;
    }
    if (mode === 'push' && upright && p.npc && (info?.strength ?? 1) >= KNOCKOVER.strength && p.npc.knockDown?.(dir, info)) {
      // close by, with a body of their own (the near tier): knocked right over (npc.js, a ragdoll);
      // they stay "stumbling" until it has them back up (holdShove)
      p.stumbleUntil = t + 30; p.stumbleT = t; p.talk = 0;
      p.faceUntil = t + 30;
      p.say = pick(SHOVE_LINES);
      p.shoutUntil = t + 3.5;
    } else if (mode === 'push' && upright) {
      this.shove(p, dir, (info?.shove ?? 2.4) * (0.6 + 0.4 * (info?.strength ?? 1)));
      p.stumbleUntil = t + 0.9; p.stumbleT = t; p.talk = 0;
      p.faceUntil = t + 3.6;
      p.say = pick(SHOVE_LINES);
      p.shoutUntil = t + 3;
    } else {
      p.startleT = t;
      p.faceUntil = upright ? t + 2.5 : -1e9;
      p.say = pick(mode === 'push' ? SHOVE_LINES : mode === 'fire' ? SINGE_LINES : SPLASH_LINES);
      p.shoutUntil = t + 2.2;
    }
    p.lookUntil = t + 3.5;
    const g = p.group;
    if (g) {
      g.lookUntil = t + 3.5; g.pauseUntil = t + 3;
      for (const m of g.members) {
        if (m === p || t < m.stumbleUntil) continue;
        m.lookUntil = t + 3.5;
        m.startleT = t + 0.1 + this.rng() * 0.25;   // the others jump too
        if (mode === 'push' && (m.pose === POSE.stand || m.walk)) { m.faceUntil = t + 3; this.shove(m, _d.subVectors(m.pos, p.pos), 0.5); }
      }
    }
    if (p.walk?.partner) p.walk.partner.lookUntil = t + 3;
    if (!p.npc && p.say) this.shout = p;
  }

  /**
   * A near-tier body knocked over (npc.js knockDown) keeps its person where it
   * lies: the shove offset is held at the body's place `at` while `down`; once
   * it is up again the offset eases away as usual (they walk back to their
   * place) and they glare at the traveller a moment.
   */
  holdShove(p, at, down, heading) {
    const t = this.time;
    if (heading !== undefined) p.heading = heading;
    const home = _w.copy(p.pos);
    if (p.shoved) home.sub(p.shoved);
    const d = _d.subVectors(at, home); d.y = 0;
    const L = d.length();
    p.shoveDir = (p.shoveDir ?? new THREE.Vector3()).copy(L > 1e-4 ? d.divideScalar(L) : d.set(1, 0, 0));
    p.shoveDist = L;
    if (down) { p.shoveT = t - 1; p.stumbleUntil = t + 30; p.faceUntil = t + 30; }
    else { p.shoveT = t - 1.8; p.stumbleUntil = t; p.faceUntil = t + 2.5; }
  }

  /** Knock someone dist metres along dir (flattened), never into a wall. */
  shove(p, dir, dist) {
    const d = _w.set(dir.x, 0, dir.z);
    if (d.lengthSq() < 1e-6) return;
    d.normalize();
    const wall = this.physics.rayDistance?.(this.chest(p), d, dist + 0.6) ?? Infinity;
    p.shoveDir = (p.shoveDir ?? new THREE.Vector3()).copy(d);
    p.shoveDist = Math.max(0, Math.min(dist, wall - 0.6));
    p.shoveT = this.time;
  }

  /** A shout from someone in the mid tier (the near tier has the NPCs' own balloons). */
  placeBalloon(camera) {
    const b = this.balloon;
    if (!b) return;
    const p = this.shout;
    const on = p && !p.npc && this.time < p.shoutUntil && p._dCam < 45;
    if (on) {
      _w.set(p.pos.x, p.pos.y + 2.05 * p.scale, p.pos.z).project(camera);
      if (_w.z < 1 && Math.abs(_w.x) < 1.1 && Math.abs(_w.y) < 1.1) {
        if (this._balloonLine !== p.say) { this._balloonLine = p.say; b.innerHTML = formatText(p.say); }   // *highlights* as in the dialogue panel
        // the shout, heard from where they stand (a short mumble; at most a couple at once: audio.js)
        if ((this._voiced !== p || this._voicedLine !== p.say)
          && speakBalloon(p.say, { person: { seed: `crowd:${p.id}`, kind: p.kind, size: p.size }, dist: p._dCam, pan: THREE.MathUtils.clamp(_w.x * 0.8, -0.9, 0.9), max: 6 })) { this._voiced = p; this._voicedLine = p.say; }
        b.style.transform = `translate(${((_w.x * 0.5 + 0.5) * window.innerWidth).toFixed(1)}px, ${((-_w.y * 0.5 + 0.5) * window.innerHeight).toFixed(1)}px) translate(-22px, calc(-100% - 12px))`;
        b.classList.add('show');
        return;
      }
    }
    b.classList.remove('show');
  }

  dispose() {
    for (const p of this.people) p.unreg?.();
    this.scene.remove(this.mid.mesh, this.far.mesh, this.shadow);
    if (this.dist) this.scene.remove(this.dist.mesh);
    this.balloon?.remove();
  }
}
