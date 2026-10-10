import * as THREE from 'three';

// A foe's body as the blade meets it (docs/systems/foes.md, "The body the blade meets", v1.35): the boxes of the drawn
// model's own parts, carried by the joints that move them, instead of one sphere at the top of the body. A crab's
// shell and pincers, a heron's stilts and neck, a moth's wings, a bell's bronze: each part's box, in its own frame, as
// the kit poses it (src/motion-kit/). The fluid blade's swept segment is tested against them (src/fluid-blade.js
// strike); the soft aim reads where the body is (aimSpan); the hitbox overlay draws them (src/hitboxes.js, 'box').
//
//   bodyParts(model)                         → [{ o, box }]: o the mesh or joint, box its local Box3 (cached on the model)
//   bodyTouch(model, before, after, margin)  → the contact point (world) where the swept blade first meets the body, or null
//   bodySpan(model, out)                     → { lo, hi, centre, radius } the drawn body's world height span and bounds
//
// Left out: what is not the body (smoke, mist, a halo, the ward's thread of light, a harpoon's line, a ripple on the
// sand: NON_BODY by the material's name, or userData.noHurt), and anything hidden (a cracked shell's dome, a sheathed
// harpoon). Tiny parts under MIN_PART are left out too (an eye's glint, a rivet): they add tests and no reach.

/** Parts whose material is one of these (src/enemies/plans/kit.js `mat(name)`/`own(name)`) are not the body. */
export const NON_BODY = /^(smoke|smoke2|smokeHi|mist|halo|glow|ward|beam|stream|line|pool|ripple|thread|sand)(Build)?$/;
/** A part smaller than this across (m) is left out. */
export const MIN_PART = 0.05;

const nameOf = (mat) => {
  const c = mat?.userData?.cacheKey;
  // (the material cache's key holds the options it was made with, the part's own `key` among them)
  const k = typeof c === 'string' ? (c.startsWith('arch.') ? c : /"key":"(arch\.[^"]+)"/.exec(c)?.[1]) : null;
  if (!k) return '';
  const p = k.split('.');
  return /^\d+$/.test(p.at(-1)) ? p[2] : p.at(-1);   // (own: arch.<a>.<name>.<n>; mat: arch.<a>.<skin>.<name>)
};
const bodyMaterial = (mat) => !NON_BODY.test(nameOf(Array.isArray(mat) ? mat[0] : mat));

/** The model's body parts: every mesh's box (a skinned mesh: each joint's own box), cached on the model. */
export function bodyParts(model) {
  if (model._body) return model._body;
  const out = [], size = new THREE.Vector3();
  model.group.updateMatrixWorld(true);
  model.group.traverse((o) => {
    if (!o.isMesh || o.userData.noHurt || !bodyMaterial(o.material)) return;
    if (o.isSkinnedMesh && o.userData.boneBoxes) {
      const { bones, local } = o.userData.boneBoxes;
      bones.forEach((b, i) => { if (!local[i].isEmpty() && local[i].getSize(size).length() >= MIN_PART) out.push({ o: b, box: local[i].clone(), mesh: o }); });
      return;
    }
    if (!o.geometry) return;
    if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    const box = o.geometry.boundingBox;
    if (box.isEmpty() || box.getSize(size).length() < MIN_PART) return;
    out.push({ o, box: box.clone(), mesh: o });
  });
  model._body = out;
  return out;
}

/** Is the part drawn now (it and every parent up to the model's root visible)? */
function shown(part, root) {
  for (let o = part.mesh; o && o !== root.parent; o = o.parent) if (!o.visible) return false;
  if (part.o !== part.mesh) for (let o = part.o; o && o !== root.parent; o = o.parent) if (!o.visible) return false;
  return true;
}

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _sa = new THREE.Vector3(), _sb = new THREE.Vector3();
const _lo = new THREE.Vector3(), _hi = new THREE.Vector3(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _e = new THREE.Vector3();

/** Does the segment p→q (local) cross the box [lo, hi]? The entry parameter in 0..1, or -1. (slabs) */
export function segmentBox(p, q, lo, hi) {
  let t0 = 0, t1 = 1;
  for (const k of ['x', 'y', 'z']) {
    const d = q[k] - p[k];
    if (Math.abs(d) < 1e-9) { if (p[k] < lo[k] || p[k] > hi[k]) return -1; continue; }
    let a = (lo[k] - p[k]) / d, b = (hi[k] - p[k]) / d;
    if (a > b) { const t = a; a = b; b = t; }
    t0 = Math.max(t0, a); t1 = Math.min(t1, b);
    if (t0 > t1) return -1;
  }
  return t0;
}

/**
 * Where the blade, swept from `before` to `after` ({ a: the cup, b: the point }, world), first meets the drawn body:
 * each part's box grown by `margin` (m, in the world: the blade's own width and the touch's give), in sweep steps of at
 * most 0.1 m so a fast cut can't pass through. The contact point (world, `out`), or null.
 */
export function bodyTouch(model, before, after, margin = 0.12, out = new THREE.Vector3()) {
  const parts = bodyParts(model), root = model.group;
  if (!parts.length || !root.visible) return null;
  const steps = Math.max(1, Math.ceil(Math.max(before.a.distanceTo(after.a), before.b.distanceTo(after.b)) / 0.1));
  let any = false;
  for (const P of parts) {
    P.on = shown(P, root);
    if (!P.on) continue;
    any = true;
    const m = P.o.matrixWorld, e = m.elements;
    // the margin in the part's own units (its world scale undone along each axis)
    const sx = Math.hypot(e[0], e[1], e[2]) || 1, sy = Math.hypot(e[4], e[5], e[6]) || 1, sz = Math.hypot(e[8], e[9], e[10]) || 1;
    (P.inv ??= new THREE.Matrix4()).copy(m).invert();
    (P.g ??= new THREE.Vector3()).set(margin / sx, margin / sy, margin / sz);
  }
  if (!any) return null;
  for (let i = 0; i <= steps; i++) {
    _a.lerpVectors(before.a, after.a, i / steps); _b.lerpVectors(before.b, after.b, i / steps);
    for (const P of parts) {
      if (!P.on) continue;
      _sa.copy(_a).applyMatrix4(P.inv); _sb.copy(_b).applyMatrix4(P.inv);
      _lo.copy(P.box.min).sub(P.g); _hi.copy(P.box.max).add(P.g);
      const t = segmentBox(_sa, _sb, _lo, _hi);
      if (t < 0) continue;
      // (the point on the blade where it enters, pulled onto the part's own box: where the cut meets it)
      _p.lerpVectors(_sa, _sb, t).clamp(P.box.min, P.box.max);
      return out.copy(_p).applyMatrix4(P.o.matrixWorld);
    }
  }
  return null;
}

/**
 * The drawn body's world bounds now: the height span (lo, hi) of its parts' boxes, their centre and a radius round it
 * that holds them all (the coarse test, the soft aim). Into `out`.
 */
export function bodySpan(model, out = { lo: 0, hi: 0, centre: new THREE.Vector3(), radius: 0 }) {
  const parts = bodyParts(model), root = model.group, box = (out._box ??= new THREE.Box3()).makeEmpty();
  for (const P of parts) {
    if (!shown(P, root)) continue;
    const b = P.box, m = P.o.matrixWorld;
    for (let k = 0; k < 8; k++) box.expandByPoint(_s.set(k & 1 ? b.max.x : b.min.x, k & 2 ? b.max.y : b.min.y, k & 4 ? b.max.z : b.min.z).applyMatrix4(m));
  }
  if (box.isEmpty()) { out.lo = out.hi = root.position.y; out.centre.copy(root.position); out.radius = 0; return out; }
  out.lo = box.min.y; out.hi = box.max.y;
  box.getCenter(out.centre); out.radius = box.getSize(_s).length() / 2;
  return out;
}

/** The parts as world boxes for the hitbox overlay: [{ m: the part's world matrix, box: its local box }]. */
export function bodyBoxes(model) {
  const root = model.group;
  return bodyParts(model).filter((P) => shown(P, root)).map((P) => ({ m: P.o.matrixWorld, box: P.box }));
}

/**
 * How far its front reaches out from its middle at the height a swing passes (`lo`..`hi` m over its feet), as built (its
 * rest pose, the model's own frame, at its size): the cut's pull stands you that far plus MAGNET.ideal off it (a heron's stilts
 * are near its middle; a crab's shell is wide). Cached on the model.
 */
export function bodyReach(model, lo = 0.5, hi = 1.7) {
  if (model._reach != null) return model._reach;
  const g = model.group, parts = bodyParts(model), inv = new THREE.Matrix4(), m = new THREE.Matrix4(), q = new THREE.Vector3();
  g.updateMatrixWorld(true);
  inv.copy(g.matrixWorld).invert();
  const s = g.scale.x || 1;
  let r = 0;
  for (const P of parts) {
    m.multiplyMatrices(inv, P.o.matrixWorld);
    for (let k = 0; k < 8; k++) {
      q.set(k & 1 ? P.box.max.x : P.box.min.x, k & 2 ? P.box.max.y : P.box.min.y, k & 4 ? P.box.max.z : P.box.min.z).applyMatrix4(m);
      const y = q.y * s;
      if (y < lo || y > hi) continue;
      r = Math.max(r, q.z * s);   // (its front: it turns to face you to fight)
    }
  }
  model._reach = r;
  return r;
}
