// The traveller's outfits on the Blender rebuild (issue #540; docs/systems/characters.md, "Outfits"): the v2
// traveller (data/characters/traveller-v2/traveller.glb, issue #493) is a body, his skin piece (hands,
// forearms, ankles), a head and hair, and garments, all on the game's 53 bones. An outfit is a set of
// garments (the default's in that GLB, any other in its own GLB under outfits/<id>/) and the body areas
// they hide. Dressing him: the outfit's garments joined into one draw, the body's triangles in the hidden
// areas left out and his skin piece's under the outfit's sleeves and puttees (its skinCut), joined into
// another. Swapping takes the old draws away and puts the new ones on, live, on the same skeleton.
// The outfits are listed in data/characters/traveller-v2/outfits.json. Web only, a test page's
// (outfits.html): the game still draws B3.
import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/** The attributes the joined draws keep (every part has them; the rest are authoring data). */
export const KEEP_ATTRIBUTES = ['position', 'normal', 'uv', 'skinIndex', 'skinWeight'];

/** The outfits of the list (outfits.json) with what each draws and hides, from the base manifest and each
 * outfit's own (null for one not loaded yet). */
export function planOutfit(list, baseManifest, outfitManifests, id) {
  const entry = list.outfits.find((o) => o.id === id);
  if (!entry) throw new Error(`no outfit "${id}"`);
  if (entry.id === 'default' || !entry.dir) {
    const d = baseManifest.outfits.default;
    return { id, name: entry.name, garments: d.parts.filter((p) => baseManifest.parts[p]?.kind === 'garment'), from: 'base', hides: [...d.hides], skinCut: [] };
  }
  const m = outfitManifests[id];
  if (!m) throw new Error(`outfit "${id}" is not loaded`);
  return { id, name: entry.name, garments: Object.keys(m.parts), from: id, hides: [...m.hides], skinCut: m.skinCut ?? [], swing: swingSpecOf(m) };
}

/** An outfit's skirt swing (#547), if it asks for one: its manifest's `swing`, or the report of the `swing`
 * relief op on one of its pieces (outfit.py records each op's report under fit.<piece>.relief). */
export function swingSpecOf(m) {
  if (m.swing) return m.swing;
  for (const f of Object.values(m.fit ?? {})) if (f?.relief?.swing?.garments) return f.relief.swing;
  return null;
}

/** The index of the areas named in `hides`, as the body's area attribute numbers them (the base manifest's
 * `areas`, sorted, the attribute holding each vertex's place in that list; -1 never hidden). */
export function hiddenAreaSet(areas, hides) {
  const out = new Set();
  for (const a of hides) {
    const i = areas.indexOf(a);
    if (i < 0) throw new Error(`no body area "${a}"`);
    out.add(i);
  }
  return out;
}

/** A triangle index without the triangles whose three verts are all in hidden areas (as the previews and
 * the Blender build count them). index: array-like of vertex indices; area: per vertex its area number. */
export function cullByArea(index, area, hidden) {
  const out = [];
  for (let i = 0; i < index.length; i += 3) {
    const a = index[i], b = index[i + 1], c = index[i + 2];
    if (hidden.has(Math.round(area[a])) && hidden.has(Math.round(area[b])) && hidden.has(Math.round(area[c]))) continue;
    out.push(a, b, c);
  }
  return out;
}

const inBox = (box, x, y) => Math.abs(x) >= box.absx[0] && Math.abs(x) <= box.absx[1] && y >= box.y[0] && y <= box.y[1];

/** A triangle index without the triangles lying wholly in one of the boxes (an outfit's skinCut: boxes in the
 * game's rest frame, x mirrored). position: xyz per vertex, flat. */
export function cutByBoxes(index, position, boxes) {
  if (!boxes?.length) return Array.from(index);
  const out = [];
  for (let i = 0; i < index.length; i += 3) {
    const t = [index[i], index[i + 1], index[i + 2]];
    if (boxes.some((b) => t.every((k) => inBox(b, position[k * 3], position[k * 3 + 1])))) continue;
    out.push(...t);
  }
  return out;
}

/** A copy of a geometry with only the kept attributes and the given index (or its own). */
export function slimGeometry(g, index = null) {
  const out = new T.BufferGeometry();
  for (const name of KEEP_ATTRIBUTES) if (g.attributes[name]) out.setAttribute(name, g.attributes[name]);
  const idx = index ?? (g.index ? Array.from(g.index.array) : [...Array(g.attributes.position.count).keys()]);
  out.setIndex(idx);
  return out;
}

const areaOf = (g) => g.attributes._area ?? g.attributes._AREA;

/** What dressing him in a plan draws: { body, clothes } geometries (the body with his skin piece, the
 * garments), each one draw, and their triangles. base / outfit: { name: BufferGeometry } of the sources. */
export function dress(plan, baseManifest, base, outfits) {
  const hidden = hiddenAreaSet(baseManifest.areas, plan.hides);
  const body = base.Body;
  const bodyIdx = cullByArea(body.index ? body.index.array : [...Array(body.attributes.position.count).keys()], areaOf(body).array, hidden);
  const skin = base.Skin;
  const skinIdx = cutByBoxes(skin.index ? skin.index.array : [...Array(skin.attributes.position.count).keys()], skin.attributes.position.array, plan.skinCut);
  const src = plan.from === 'base' ? base : outfits[plan.from];
  const missing = plan.garments.filter((n) => !src?.[n]);
  if (missing.length) throw new Error(`outfit "${plan.id}" lacks ${missing.join(', ')}`);
  const bodyG = mergeGeometries([slimGeometry(body, bodyIdx), slimGeometry(skin, skinIdx)]);
  const clothesG = mergeGeometries(plan.garments.map((n) => slimGeometry(src[n])));
  // where each garment's verts lie in the joined draw (in order: mergeGeometries appends them)
  const ranges = {};
  let at = 0;
  for (const n of plan.garments) { const c = src[n].attributes.position.count; ranges[n] = [at, c]; at += c; }
  const tris = (g) => g.index.count / 3;
  return { body: bodyG, clothes: clothesG, ranges, triangles: { body: tris(bodyG), clothes: tris(clothesG) }, culled: { body: (body.index?.count ?? 0) / 3 - bodyIdx.length / 3, skin: (skin.index?.count ?? 0) / 3 - skinIdx.length / 3 } };
}

// ------------------------------------------------------------------ a skirt's swing (issue #547)
//
// A long skirt (the salt pilgrim's robe and tunic) skinned to the thighs lifts like a board with each knee.
// Its swing instead (as scripts/blender/traveller/outfit_kit.py, "a skirt's swing", which builds the same
// rule into Blender for its checks and previews): four panels (front and back, left and right) of two bones
// each, hip to knee and knee to hem, hung from the pelvis on the hips' axis. Each bone's angle (forward
// positive, about the body's left-right axis) hangs plumb, a share of the pelvis' lean, carried by a damped
// spring (it lags, swings back, settles; the body's acceleration swings it), unless its leg pushes it: a
// front panel never behind its thigh and shin, a back one never in front of them. The bones are added to the
// clothes' own skeleton (the game's bones and these eight), the skirt's verts weighted onto them from their
// rest position. Off for an outfit whose manifest does not ask for it.

export const SWING_PANELS = ['fl', 'fr', 'bl', 'br'];
const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/** One rest vertex (the game's frame: x left, y up, z forward) of `garment`: how much the swing takes
 * (mix, 0 over the hips, 1 down the skirt) and its eight weights (fl upper, fl lower, fr…, rows sum to 1). */
export function skirtSwingWeights(x, y, z, spec, garment) {
  const g = spec.garments[garment];
  const mix = sm(spec.mix[0], spec.mix[1], y);
  const lo = sm(spec.knee[0], spec.knee[1], y);
  const soft = spec.blend * (g.slitTop == null ? 1 : sm(g.slitTop, g.slitTop + spec.soften, y));
  // (the panels part where the slits are: the back one's x, the sides' z; an unslit skirt's at its middle)
  const dz = z - (g.sideZ ? g.sideZ[x > 0 ? 0 : 1] : spec.centre);
  const dx = x - (g.backX ?? 0);
  const f = soft > 1e-6 ? sm(-soft, soft, dz) : (dz > 0 ? 1 : 0);
  const left = soft > 1e-6 ? sm(-soft, soft, dx) : (dx > 0 ? 1 : 0);
  const fl = x > 0 ? 1 : 0;
  const shares = [f * fl, f * (1 - fl), (1 - f) * left, (1 - f) * (1 - left)];
  const w = [];
  for (const s of shares) w.push(s * (1 - lo), s * lo);
  return { mix, w };
}

/** The skirt's verts of a joined draw re-weighted onto the swing's bones (numbered from `first`): each vert's
 * own weights (1 - mix) and the swing's (mix), the four largest kept, normalised. ranges: { garment: [start,
 * count] } (dress()). Returns how many verts it moved. */
export function weightSkirts(geometry, spec, ranges, first) {
  const pos = geometry.attributes.position, si = geometry.attributes.skinIndex, sw = geometry.attributes.skinWeight;
  let moved = 0;
  for (const [name, [start, count]] of Object.entries(ranges)) {
    if (!spec.garments[name]) continue;
    for (let i = start; i < start + count; i++) {
      const { mix, w } = skirtSwingWeights(pos.getX(i), pos.getY(i), pos.getZ(i), spec, name);
      if (mix <= 1e-4) continue;
      const acc = new Map();
      for (let k = 0; k < 4; k++) {
        const x = sw.getComponent(i, k) * (1 - mix);
        if (x > 0) acc.set(si.getComponent(i, k), (acc.get(si.getComponent(i, k)) ?? 0) + x);
      }
      w.forEach((x, k) => { if (x * mix > 0) acc.set(first + k, (acc.get(first + k) ?? 0) + x * mix); });
      const top = [...acc].sort((a, b) => b[1] - a[1]).slice(0, 4);
      const s = top.reduce((n, [, x]) => n + x, 0);
      for (let k = 0; k < 4; k++) {
        si.setComponent(i, k, top[k]?.[0] ?? 0);
        sw.setComponent(i, k, top[k] ? top[k][1] / s : 0);
      }
      moved++;
    }
  }
  si.needsUpdate = sw.needsUpdate = true;
  return moved;
}

const MAX_SWING_SPEED = 10;   // rad/s: a panel never whips faster (a teleport, a snapped pose)
const PUSH_CARRY = 0.35;      // the share of a pushing leg's speed a panel keeps when the leg stops
const MIN_SWING_STEP = 1 / 240;   // s: the driver steps the swing once a frame, not each matrix update
const _m = new T.Matrix4(), _n = new T.Matrix4(), _q = new T.Quaternion(), _v = new T.Vector3(), _w = new T.Vector3();
/** A direction's angle forward of straight down, about the x axis (the game's frame: z forward). */
const pitch = (d) => Math.atan2(d.z, -d.y);

/** A turn of a bone hanging down (the game's frame) as a down-pointing bone's own channels, as Blender's
 * SWING_TWIST_Y (its local x = -x, y = -y, z = +z): x its swing forward, z sideways (to +x), y its twist
 * about its length. */
export function swingTwist(q) {
  const tw = Math.atan2(-q.y, q.w) * 2;                    // twist about (0, -1, 0)
  const n = Math.hypot(q.w, q.y) || 1;
  const t = new T.Quaternion(0, q.y / n, 0, q.w / n);
  const s = q.clone().multiply(t.invert());                 // swing = q · twist⁻¹
  if (s.w < 0) s.set(-s.x, -s.y, -s.z, -s.w);
  const half = Math.acos(Math.min(1, s.w)), sin = Math.sin(half);
  const k = sin > 1e-9 ? (2 * half) / sin : 2;
  return { x: -s.x * k, y: Math.atan2(Math.sin(tw), Math.cos(tw)), z: s.z * k };
}

/**
 * The swing of an outfit's skirts on a skeleton: `bones` (eight T.Bones, not in the scene: their world
 * matrices written here, each frame) to add to the clothes' skeleton, their inverses identity. bindMatrix:
 * the clothes mesh's (the game's frame at bind). update(dt) steps it from the skeleton's pose.
 */
export class SkirtSwing {
  constructor(spec, skeleton, bindMatrix) {
    this.spec = spec;
    this.skeleton = skeleton;
    this.bind = bindMatrix.clone();
    this.bindInv = bindMatrix.clone().invert();
    const byName = (n) => {
      const i = skeleton.bones.findIndex((b) => b.name === n);
      if (i < 0) throw new Error(`swing: no bone ${n}`);
      return i;
    };
    this.ix = { pelvis: byName(spec.bones.pelvis), thigh: spec.bones.thigh.map(byName), calf: spec.bones.calf.map(byName) };
    // the legs' rest directions (the game's frame), from their bind poses
    const rest = (i) => new T.Vector3().setFromMatrixPosition(_m.copy(skeleton.boneInverses[i]).invert()).applyMatrix4(this.bindInv);
    this.rest = [0, 1].map((s) => ({ thigh: rest(this.ix.calf[s]).sub(rest(this.ix.thigh[s])).normalize(), shin: new T.Vector3(0, -1, 0) }));
    this.pelvisRest = rest(this.ix.pelvis);
    this.bones = [];
    for (const p of SWING_PANELS) for (const k of ['u', 'l']) {
      const b = new T.Bone();
      b.name = `swing_${p}_${k}`;
      b.matrixAutoUpdate = false;
      b.matrixWorldAutoUpdate = false;
      this.bones.push(b);
    }
    this.state = this.bones.map(() => ({ a: 0, v: 0 }));
    this.push = this.bones.map(() => 0);
    this.prev = null;
    this.accel = 0;
  }

  /** The skinning delta of bone i in the game's frame at bind (bind⁻¹ · world · inverse · bind). */
  _delta(i, out) {
    out.multiplyMatrices(this.skeleton.bones[i].matrixWorld, this.skeleton.boneInverses[i]);
    return out.premultiply(this.bindInv).multiply(this.bind);
  }

  /** The angles the legs give, relative to the pelvis (as Blender's SWING_TWIST_Y channels of each bone's
   * own turn: x forward positive): p the plumb's lean; per side the thigh's forward swing t, its sideways
   * swing z and its twist y, and the knee's bend c (the calf's forward swing on the thigh; t + c the shin's). */
  measure() {
    const P = this._delta(this.ix.pelvis, new T.Matrix4());
    const Pinv = P.clone().invert();
    // plumb: the world's down (in the frame the clothes were bound in) seen from the pelvis' rest
    _q.setFromRotationMatrix(P).invert();
    const p = pitch(_w.set(0, -1, 0).transformDirection(this.bindInv).applyQuaternion(_q));
    const legs = [0, 1].map((s) => {
      const Tm = this._delta(this.ix.thigh[s], new T.Matrix4());
      const Cm = Tm.clone().invert().multiply(this._delta(this.ix.calf[s], new T.Matrix4()));
      const th = swingTwist(_q.setFromRotationMatrix(Tm.premultiply(Pinv)));
      const ca = swingTwist(_q.setFromRotationMatrix(Cm));
      return { t: th.x, z: th.z, y: th.y, c: ca.x };
    });
    return { p, legs, P };
  }

  /** The static rule (Blender's drivers): each bone's hang, and its push (the bound its leg sets). */
  static targets(spec, p, legs, upper) {
    const out = [];
    SWING_PANELS.forEach((panel, k) => {
      const { t, c } = legs[panel[1] === 'l' ? 0 : 1];
      const front = panel[0] === 'f';
      const U = upper ? upper[k] : (front ? Math.max(spec.hang * p, t) : Math.min(spec.hang * p, t));
      out.push({ hang: spec.hang * p, push: t, front }, { hang: spec.lowerHang * (p - U), push: front ? t + c - U : Math.max(t + c - U, -spec.lowerReach), front });
    });
    return out;
  }

  /** One step of dt seconds (clamped; sub-stepped): the springs, the pushes, then the bones' matrices. */
  update(dt) {
    const { p, legs, P } = this.measure();
    // the body's acceleration along its own forward axis (smoothed): a start swings the panels back
    const pos = _v.copy(this.pelvisRest).applyMatrix4(P);
    const fwd = _w.set(0, 0, 1).transformDirection(P).setY(0).normalize();   // (level: not his bob)
    if (this.prev && dt > 0) {
      const vel = pos.clone().sub(this.prev.pos).divideScalar(dt);
      const jump = vel.length() > 20;
      const acc = jump ? 0 : vel.clone().sub(this.prev.vel).divideScalar(dt).dot(fwd);
      this.accel += (Math.max(-30, Math.min(30, acc)) - this.accel) * Math.min(1, dt / 0.08);
      this.prev = { pos: pos.clone(), vel: jump ? new T.Vector3() : vel };
    } else this.prev = { pos: pos.clone(), vel: new T.Vector3() };
    const S = this.spec.spring;
    const total = Math.min(dt, 1 / 20);
    const from = this.legs ?? legs, fromP = this.p ?? p;
    const n = Math.max(1, Math.ceil(total / (1 / 120)));
    const step = total / n;
    for (let s = 1; s <= n; s++) {
      // the legs and the lean eased across the frame's sub-steps (a push never jumps)
      const f = s / n;
      const lg = legs.map((l, k) => ({ t: from[k].t + (l.t - from[k].t) * f, c: from[k].c + (l.c - from[k].c) * f }));
      const pp = fromP + (p - fromP) * f;
      // uppers first, then the lowers from them
      for (const upperPass of [true, false]) {
        const upper = upperPass ? null : [0, 2, 4, 6].map((i) => this.state[i].a);
        const tg = SkirtSwing.targets(this.spec, pp, lg, upper);
        for (let k = 0; k < 4; k++) {
          const i = 2 * k + (upperPass ? 0 : 1);
          const st = this.state[i], g = tg[i];
          const [w, z] = upperPass ? S.upper : S.lower;
          st.v += (w * w * (g.hang - st.a) - 2 * z * w * st.v - (upperPass ? S.inertia * this.accel / 0.45 : 0)) * step;
          st.v = Math.max(-MAX_SWING_SPEED, Math.min(MAX_SWING_SPEED, st.v));
          st.a += st.v * step;
          // the leg's push: a hard bound; pushed, the panel moves with the leg (and flies on when it stops)
          const pv = Math.max(-MAX_SWING_SPEED, Math.min(MAX_SWING_SPEED, (g.push - this.push[i]) / step));
          if (g.front ? st.a < g.push : st.a > g.push) { st.a = g.push; st.v = g.front ? Math.max(st.v, PUSH_CARRY * pv) : Math.min(st.v, PUSH_CARRY * pv); }
          this.push[i] = g.push;
        }
      }
    }
    this.legs = legs;
    this.p = p;
    this._write(P);
  }

  /** Poses the bones as the static rule alone (no spring): what Blender's drivers give. */
  settle() {
    const { p, legs, P } = this.measure();
    const up = SkirtSwing.targets(this.spec, p, legs).filter((_, i) => i % 2 === 0).map((g) => (g.front ? Math.max(g.hang, g.push) : Math.min(g.hang, g.push)));
    const tg = SkirtSwing.targets(this.spec, p, legs, up);
    tg.forEach((g, i) => { this.state[i].a = i % 2 === 0 ? up[i / 2] : (g.front ? Math.max(g.hang, g.push) : Math.min(g.hang, g.push)); this.state[i].v = 0; this.push[i] = g.push; });
    this.legs = legs;
    this.p = p;
    this._write(P);
  }

  /** Each bone's world matrix: the pelvis' delta, then the upper's turns about its hip joint (with its
   * thigh sideways and about its length, then its own swing forward) and the lower's about its knee. */
  _write(P) {
    const [hy, hz] = this.spec.pivot, ky = this.spec.kneePivot;
    const about = (x, y, z, R) => _n.makeTranslation(x, y, z).multiply(R).multiply(new T.Matrix4().makeTranslation(-x, -y, -z));
    const E = new T.Euler();
    for (let k = 0; k < 4; k++) {
      const U = this.state[2 * k].a, L = this.state[2 * k + 1].a;
      const x = SWING_PANELS[k][1] === 'l' ? this.spec.hipX : -this.spec.hipX;
      const leg = this.legs[SWING_PANELS[k][1] === 'l' ? 0 : 1];
      // (Blender's euler XYZ in the bone's axes, x = -x, y = -y, z = +z: Rz(z) · Ry(-y) · Rx(-U) here)
      const up = P.clone().multiply(about(x, hy, hz, _m.makeRotationFromEuler(E.set(-U, -leg.y, leg.z, 'ZYX'))));
      const lo = up.clone().multiply(about(x, ky, hz, _m.makeRotationX(-L)));
      this.bones[2 * k].matrixWorld.multiplyMatrices(this.bind, up).multiply(this.bindInv);
      this.bones[2 * k + 1].matrixWorld.multiplyMatrices(this.bind, lo).multiply(this.bindInv);
    }
  }

  /** The angles now (radians, forward positive): fl upper, fl lower, fr… */
  angles() { return this.state.map((s) => s.a); }
}

/** Puts a swing on a clothes mesh bound to the game's skeleton: its skirts re-weighted, the mesh rebound to
 * that skeleton with the swing's bones added, and a driver (an empty under the pelvis, updated after the
 * legs each time the scene's matrices are) that steps it. Returns the swing (dispose() takes it off). */
export function attachSwing(mesh, spec, ranges, { now = () => performance.now() / 1000 } = {}) {
  const sk = mesh.skeleton;
  const swing = new SkirtSwing(spec, sk, mesh.bindMatrix);
  weightSkirts(mesh.geometry, spec, ranges, sk.bones.length);
  const skeleton = new T.Skeleton([...sk.bones, ...swing.bones], [...sk.boneInverses, ...swing.bones.map(() => new T.Matrix4())]);
  mesh.bind(skeleton, mesh.bindMatrix);
  const pelvis = sk.bones[swing.ix.pelvis];
  const driver = new T.Object3D();
  driver.name = 'SkirtSwing';
  driver.userData.swing = swing;
  let last = null;
  driver.updateMatrixWorld = function (force) {
    T.Object3D.prototype.updateMatrixWorld.call(this, force);
    const t = now();
    // (the scene's matrices are updated several times a frame: one step a frame, at most)
    if (last === null) { swing.settle(); last = t; } else if (t - last >= MIN_SWING_STEP) { swing.update(t - last); last = t; }
  };
  pelvis.add(driver);
  swing.settle();
  swing.dispose = () => { driver.parent?.remove(driver); };
  return swing;
}

/**
 * The traveller's wardrobe: wears one outfit at a time under `parent`. make(geometry, role, plan) returns the
 * mesh to add (a SkinnedMesh bound to his skeleton, with its material); wear(id) takes the last outfit's
 * meshes off (and frees their geometry) and puts the new ones on.
 */
export class Wardrobe {
  constructor({ list, baseManifest, base, outfitManifests = {}, outfits = {}, parent, make }) {
    Object.assign(this, { list, baseManifest, base, outfitManifests, outfits, parent, make });
    this.worn = null;
    this.meshes = [];
  }

  /** An outfit's sources once loaded: its manifest and { name: geometry }. */
  add(id, manifest, geometries) {
    this.outfitManifests[id] = manifest;
    this.outfits[id] = geometries;
  }

  ids() { return this.list.outfits.map((o) => o.id); }

  wear(id) {
    const plan = planOutfit(this.list, this.baseManifest, this.outfitManifests, id);
    const d = dress(plan, this.baseManifest, this.base, this.outfits);
    for (const m of this.meshes) { m.parent?.remove(m); m.geometry.dispose(); }
    this.swing?.dispose();
    this.meshes = [this.make(d.body, 'body', plan), this.make(d.clothes, 'clothes', plan)];
    for (const m of this.meshes) this.parent.add(m);
    // (#547) an outfit that asks for it: its skirts swing (bones of their own on the clothes' skeleton)
    const clothes = this.meshes[1];
    this.swing = plan.swing && clothes.isSkinnedMesh && clothes.skeleton ? attachSwing(clothes, plan.swing, d.ranges) : null;
    // (a swinging skirt shows its inside: that outfit's clothes drawn on both faces)
    if (this.swing && plan.swing.doubleSided && clothes.material) { clothes.material.side = T.DoubleSide; clothes.material.needsUpdate = true; }
    this.worn = { id, plan, triangles: d.triangles.body + d.triangles.clothes, draws: this.meshes.length, culled: d.culled, swing: !!this.swing };
    return this.worn;
  }

  next() {
    const ids = this.ids();
    return this.wear(ids[(ids.indexOf(this.worn?.id) + 1) % ids.length]);
  }
}
