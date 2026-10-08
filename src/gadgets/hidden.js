import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeMaterial } from '../materials.js';
import { textGeometry, glyphGeometry } from '../story/sign-text.js';

// Hidden things only the seeing lens shows (docs/systems/gadgets.md, "The seeing lens"). A world tags what it
// hides with `revealable(object, o)` while it builds (the object is kept out of the baked collision and
// hidden), and the lens (src/gadgets/lens.js) adopts every one in its scene:
//
//   revealable(mesh, { solidWhenSeen: true })   a ghost path: drawn and stood on only while the lens is up
//   revealable(mesh, { illusion: true })        a false floor: drawn always, never solid, gone under the lens
//   revealable(mesh, { message: '…', id })      writing on a wall: shown under the lens; read once (a notice)
//   buried(object, at, { id, message })          a cache under the sand: a mark through the lens, a stomp
//                                                (the spring boots) brings it up
//
// and builders for the common ones, in the lens's ink (pale teal, faintly lit, drawn in blue under the glass):
//
//   ghostPath(parent, points, o) · ghostBridge(parent, a, b, o) · hiddenWriting(parent, at, facing, text, o)
//
// The registry is module-wide and outlives a world: the lens takes only the entries under its own scene.

/** Everything tagged so far (any scene). */
export const HIDDEN = [];

/** How the lens's secrets look: the makers' glass ink, faintly lit (gHatch glow: halos in the bloom). */
export const GHOST = { color: '#46c9bb', glow: 0.72, writing: '#7fe9dc' };
let ghostMat = null, writingMat = null;
export const ghostMaterial = () => (ghostMat ??= makeMaterial({ color: GHOST.color, flat: true, glow: GHOST.glow }));
export const writingMaterial = () => (writingMat ??= makeMaterial({ color: GHOST.writing, flat: true, glow: 0.9 }));

const loose = (o) => { o.traverse((m) => { m.userData.noCollide = true; }); return o; };

/**
 * Tag something only the lens shows. o.solidWhenSeen: stood on while the lens is up (a stand-in collider is
 * added and taken away); o.illusion: the reverse, drawn until the lens looks at it, never solid; o.message
 * (with o.id): words read once when seen up close; o.kind: what the lens's marks call it.
 */
export function revealable(object, { solidWhenSeen = false, illusion = false, id = null, message = null, kind = null, mark = !!message, range = 14 } = {}) {
  loose(object);
  if (!illusion) object.visible = false;
  const e = { object, solidWhenSeen, illusion, id, message, mark, range, kind: kind ?? (solidWhenSeen ? 'path' : illusion ? 'illusion' : message ? 'writing' : 'sight'), handle: null, solid: false, shown: illusion, k: 0 };
  object.userData.revealable = e;
  HIDDEN.push(e);
  return e;
}

/** A cache buried at `at`: hidden, marked through the lens, brought up by a stomp (unearth). */
export function buried(object, at, { id = null, message = null, depth = 1.4 } = {}) {
  const e = revealable(object, { id, message, kind: 'buried', mark: true, range: 60 });
  e.at = at.clone(); e.depth = depth; e.unearthed = false; e.rise = 0;
  object.position.copy(at).add(new THREE.Vector3(0, -depth, 0));
  return e;
}

/** Those of the registry in `scene` (an object's chain of parents ends at it). */
export function hiddenIn(scene, list = HIDDEN) {
  return list.filter((e) => { let o = e.object; while (o.parent) o = o.parent; return o === scene; });
}

/**
 * Bring up what is buried within r of `at` (a stomp): its object rises out of the sand and stays. Returns the
 * entries unearthed. Pure but for the entries' state.
 */
export function unearth(list, at, r = 2.2) {
  const out = [];
  for (const e of list) {
    if (e.kind !== 'buried' || e.unearthed) continue;
    if (Math.hypot(e.at.x - at.x, e.at.z - at.z) > r || Math.abs(e.at.y - at.y) > 3) continue;
    e.unearthed = true; e.rise = 0; e.object.visible = true; out.push(e);
  }
  return out;
}

/** A buried cache's rise after unearthing (0 → 1 over ~0.7 s, a little overshoot): the height under its spot. */
export function riseHeight(t, depth) {
  const k = Math.min(1, Math.max(0, t / 0.7));
  const ease = 1 - (1 - k) ** 3;
  return -depth * (1 - ease) + Math.sin(Math.PI * k) * 0.25;
}

// ------------------------------------------------------------------ builders

/**
 * A ghost path: a plank at each of `points` (world or parent-local), turned along the way, `width` across;
 * solid only while the lens is up. Returns its entry.
 */
export function ghostPath(parent, points, { width = 1.6, depth = 1.5, thick = 0.18, id = null, message = null, illusion = false, posts = true, material = null } = {}) {
  const parts = [];
  const pts = points.map((p) => (p.isVector3 ? p.clone() : new THREE.Vector3(...p)));
  pts.forEach((p, i) => {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    const yaw = Math.atan2(b.x - a.x, b.z - a.z);
    parts.push(new THREE.BoxGeometry(width, thick, depth).rotateY(yaw).translate(p.x, p.y - thick / 2, p.z).toNonIndexed());
    // its rails: thin ink posts at the corners, drawn like a blueprint's construction lines
    if (posts) for (const s of [-1, 1]) {
      const ox = Math.cos(yaw) * s * (width / 2 - 0.06), oz = -Math.sin(yaw) * s * (width / 2 - 0.06);
      parts.push(new THREE.BoxGeometry(0.06, 0.55, 0.06).translate(p.x + ox, p.y + 0.27, p.z + oz).toNonIndexed());
    }
  });
  const mesh = new THREE.Mesh(mergeGeometries(parts), material ?? ghostMaterial());
  mesh.name = illusion ? 'False floor' : 'Ghost path';
  parent.add(mesh);
  return revealable(mesh, { solidWhenSeen: !illusion, illusion, id, message, kind: illusion ? 'illusion' : 'path' });
}

/** A ghost bridge from a to b: `n` planks, sagging `sag` m at the middle. */
export function ghostBridge(parent, a, b, { n = null, sag = 0.6, ...o } = {}) {
  const A = a.isVector3 ? a : new THREE.Vector3(...a), B = b.isVector3 ? b : new THREE.Vector3(...b);
  const L = A.distanceTo(B), count = n ?? Math.max(2, Math.round(L / 1.55));
  const pts = [];
  for (let i = 0; i < count; i++) {
    const t = (i + 0.5) / count;
    pts.push(A.clone().lerp(B, t).add(new THREE.Vector3(0, -sag * 4 * t * (1 - t), 0)));
  }
  // (the planks just meet: a gap between two, however thin, is one a step's ground ray can fall through)
  return ghostPath(parent, pts, { depth: (L / count) * 1.02, ...o });
}

/**
 * Writing only the lens shows: block letters (and the makers' mark above them) at `at`, facing `facing`
 * (a direction, or a yaw in radians), `width` m wide. The message is read once (a notice) when seen close.
 */
export function hiddenWriting(parent, at, facing, text, { width = 2.4, id = null, message = null, mark = true, range = 14 } = {}) {
  const g = textGeometry(text, { width, depth: 0.03 });
  const h = g.userData.height ?? width * 0.2;
  const parts = [g.index ? g.toNonIndexed() : g];
  if (mark) { const m = glyphGeometry(Math.min(1.1, width * 0.35), 0.03).translate(0, h / 2 + width * 0.16, 0); parts.push(m.index ? m.toNonIndexed() : m); }
  const mesh = new THREE.Mesh(mergeGeometries(parts.map((p) => { for (const k of Object.keys(p.attributes)) if (k !== 'position' && k !== 'normal') p.deleteAttribute(k); return p; })), writingMaterial());
  mesh.name = 'Hidden writing';
  mesh.position.copy(at.isVector3 ? at : new THREE.Vector3(...at));
  mesh.rotation.y = typeof facing === 'number' ? facing : Math.atan2(facing.x, facing.z);
  parent.add(mesh);
  return revealable(mesh, { id, message: message ?? text, mark: true, range });
}

/** A stand-in collider for an entry: the same meshes, not flagged noCollide (physics.addCollider leaves those out). */
export function solidOf(object) {
  object.updateMatrixWorld(true);
  const g = new THREE.Group();
  object.traverse((m) => { if (m.isMesh) { const c = new THREE.Mesh(m.geometry); c.matrixAutoUpdate = false; c.matrix.copy(m.matrixWorld); c.matrixWorld.copy(m.matrixWorld); g.add(c); } });
  g.updateMatrixWorld = function () { for (const c of this.children) c.matrixWorld.copy(c.matrix); };
  return g;
}

/** Make an entry solid or not (its collider made once, then put in and taken out of physics.extras). */
export function setSolid(physics, e, on) {
  if (!physics || e.solid === on) return;
  if (on) {
    if (!e.handle) e.handle = physics.addCollider?.(solidOf(e.object)) ?? null;
    else if (physics.extras && !physics.extras.includes(e.handle)) physics.extras.push(e.handle);
  } else if (e.handle) physics.removeCollider?.(e.handle);
  e.solid = on;
}
