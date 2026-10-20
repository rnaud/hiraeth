// The v2 traveller in the game (issue #493): the Blender rebuild (data/characters/traveller-v2/) drawn on his usual
// skeleton and animation, behind a debug switch (?traveller=v2, or the dev menu's Traveller tab). The game draws B3
// by default; the author decides whether to switch (decision 3A). Web only, and the dev server's only: the models
// live in data/, which the build leaves out (the switch says so there); the Unity bridge does not draw v2.
//
// What it does, on the game's traveller (createTraveller's, B3, whose humanoid, hands, feet and clips stay):
// - binds every skinned mesh of the GLB (and of an outfit's GLB) to humanoid.body.skeleton by bone name (bindParts);
// - dresses him through the Wardrobe (outfits.js): the body's hidden areas for the outfit worn culled, his skin
//   piece's skinCut left out, the draw groups joined (body + skin, the garments: two draws, plus the game's head);
// - drives the default clothes' thigh-lift keys (thighLift_l / _r, pass 5) each time they are drawn, from each
//   thigh's forward swing (the manifest's `drivers`: 0 at 25 degrees, 1 at 80; ThighLift);
// - keeps the game's own portrait head (head-v3: the asset the v2 head was made from) with its drawn face, eye paint
//   and speech: the GLB's Head and Hair (re-UV'd onto the atlas, their face ink not re-baked, #473) are not drawn;
// - puts B3's body, its cloth, its cloth's shadow and its far levels away.
import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Wardrobe } from './outfits.js';
import { makeReviewInkMaterial } from './tripo-material.js';
import { store } from '../platform.js';

export const ROOT = `${import.meta.env?.BASE_URL ?? '/'}data/characters/traveller-v2/`;
const DEV_ONLY = '(the outfits pages and the v2 traveller run on the dev server: data/ is not in the build)';

export async function json(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url}: HTTP ${r.status} ${DEV_ONLY}`);
  // (a server that answers a missing file with its index page: not JSON)
  try { return await r.json(); } catch { throw new Error(`${url}: not found ${DEV_ONLY}`); }
}

// ------------------------------------------------------------------ the switch
/** B3 or v2, and v2's outfit: ?traveller=v2 (or b3) and &outfit=<id> in the address win; else the dev menu's choice,
 * kept on this device. Off (B3) unless asked for. */
export const travellerSetting = {
  key: 'hiraeth.travellerV2',
  get(search = typeof location !== 'undefined' ? location.search : '') {
    let on = false, outfit = 'default';
    try {
      const kept = store.get(this.key);
      if (kept) { on = kept !== 'off'; if (on) outfit = kept; }
      const q = new URLSearchParams(search);
      if (q.has('traveller')) on = q.get('traveller') === 'v2';
      if (q.get('outfit')) outfit = q.get('outfit');
    } catch { /* (no storage: B3) */ }
    return { on, outfit };
  },
  /** on: v2 with `outfit` kept on this device; off: B3. */
  set(on, outfit = 'default') { store.set(this.key, on ? outfit : 'off'); },
};

// ------------------------------------------------------------------ binding by bone name
/** A parsed GLB's skinned meshes by name: their geometry (a copy) with skinIndex renumbered to `bones` by bone name,
 * their shape keys named (the glTF's targetNames), and their material. Throws on a bone not on `bones`. */
export function bindParts(gltf, bones, what = 'GLB') {
  const out = {};
  gltf.scene.traverse((o) => {
    if (!o.isSkinnedMesh) return;
    const g = o.geometry.clone();
    const map = o.skeleton.bones.map((b) => {
      const i = bones.findIndex((t) => t.name === b.name);
      if (i < 0) throw new Error(`${what}: bone ${b.name} not on his skeleton`);
      return i;
    });
    const si = g.attributes.skinIndex;
    for (let k = 0; k < si.array.length; k++) si.array[k] = map[si.array[k]];
    si.needsUpdate = true;
    // (the names live on the mesh, its morphTargetDictionary; a geometry joined later keeps them on its attributes)
    const names = Object.entries(o.morphTargetDictionary ?? {}).sort((a, b) => a[1] - b[1]).map(([n]) => n);
    for (const list of Object.values(g.morphAttributes)) list.forEach((a, i) => { a.name = names[i] ?? String(i); });
    out[o.name] = { geometry: g, material: o.material, bones: o.skeleton.bones.map((b) => b.name) };
  });
  return out;
}

/** bindParts of a GLB fetched from `url`. */
export async function loadParts(url, bones) {
  return bindParts(await new GLTFLoader().loadAsync(url), bones, url);
}

// ------------------------------------------------------------------ the thigh-lift keys (pass 5)
const _a = new T.Vector3(), _b = new T.Vector3(), _m = new T.Matrix4();
/** A thigh's line's angle from straight down toward his front, in degrees, in his own frame (y up, z forward): as
 * scripts/blender/traveller/poses.py `swing` reads it in Blender's (z up, facing -y). */
export const pitchDeg = (d) => Math.atan2(d.z, -d.y) * 180 / Math.PI;
/** A key's value from its thigh's swing: 0 at swing[0] degrees, 1 at swing[1] (poses.py `drive`). */
export const liftOf = (deg, [from, to]) => Math.min(1, Math.max(0, (deg - from) / (to - from)));

/**
 * The thigh-lift keys of a mesh bound to his skeleton, set from the pose: each key's thigh's forward swing (its line,
 * hip to knee, in his root's frame, against the same at rest) through the manifest's `drivers`. update() reads the
 * bones' world matrices as they stand; attach() calls it each time the mesh is drawn (every pass reads one pose).
 */
export class ThighLift {
  constructor(mesh, drivers, root) {
    this.mesh = mesh;
    this.root = root;
    const bones = mesh.skeleton.bones, dict = mesh.morphTargetDictionary ?? {};
    const at = (n) => bones.findIndex((b) => b.name === n);
    // (each bone at rest, in the frame the skeleton was bound in: his root's at bind, standing at the origin)
    const rest = (i) => new T.Vector3().setFromMatrixPosition(_m.copy(mesh.skeleton.boneInverses[i]).invert());
    this.keys = Object.entries(drivers ?? {}).filter(([k]) => k in dict).map(([key, d]) => {
      const thigh = at(d.bone), knee = at(d.bone.replace('thigh', 'calf'));
      if (thigh < 0 || knee < 0) throw new Error(`thigh lift ${key}: no ${d.bone} or its calf on his skeleton`);
      return { key, index: dict[key], thigh, knee, swing: d.swing, rest: pitchDeg(rest(knee).sub(rest(thigh))), deg: 0 };
    });
  }

  /** The keys set from the pose now; returns { key: value }. */
  update() {
    const bones = this.mesh.skeleton.bones, out = {};
    _m.copy(this.root.matrixWorld).invert();
    for (const k of this.keys) {
      _a.setFromMatrixPosition(bones[k.thigh].matrixWorld).applyMatrix4(_m);
      _b.setFromMatrixPosition(bones[k.knee].matrixWorld).applyMatrix4(_m);
      k.deg = pitchDeg(_b.sub(_a)) - k.rest;
      this.mesh.morphTargetInfluences[k.index] = out[k.key] = liftOf(k.deg, k.swing);
    }
    return out;
  }

  /** Set before each draw of the mesh (the shadow passes' too). */
  attach() {
    if (!this.keys.length) return this;
    const before = this.mesh.onBeforeRender;
    this.mesh.onBeforeRender = (...a) => { this.update(); before.apply(this.mesh, a); };
    return this;
  }
}

// ------------------------------------------------------------------ dressing the game's traveller
/**
 * The game's traveller (`model`: createTraveller's) drawn as the v2 traveller: his B3 body and its cloth put away
 * (the portrait head stays) and a Wardrobe on his skeleton, its outfits in the game's ink (makeReviewInkMaterial), the
 * default clothes' thigh-lift keys driven. sources: { list, baseManifest, base: loadParts of the base GLB on his
 * bones }; shared: caches several travellers share (the outfits gallery: their skeletons number the bones alike).
 * Returns { wardrobe, load(id) }: load before wearing an outfit other than the default.
 */
export function v2Wardrobe(model, { list, baseManifest, base }, shared = { materials: new Map(), parts: new Map() }) {
  const h = model.humanoid;
  const skeleton = h.body.skeleton, bindMatrix = h.body.bindMatrix, parent = h.body.parent;
  const material = (src) => {
    if (!shared.materials.has(src)) {
      const m = new T.Mesh(new T.BufferGeometry(), src);
      m.userData.inkShade = { hatch: 0.2 };
      shared.materials.set(src, makeReviewInkMaterial(m));
    }
    return shared.materials.get(src);
  };
  const sourceMat = { base: base.Body.material };   // (the base's single-sided atlas: the body, his skin, the default's clothes)
  const wardrobe = new Wardrobe({
    list, baseManifest, parent,
    base: Object.fromEntries(Object.entries(base).map(([n, p]) => [n, p.geometry])),
    make(geometry, role, plan) {
      const src = role === 'body' || plan.from === 'base' ? sourceMat.base : sourceMat[plan.from];
      const mesh = new T.SkinnedMesh(geometry, material(src));
      mesh.name = `TravellerV2.${role}`;
      mesh.frustumCulled = false;
      mesh.castShadow = model.mesh.castShadow;
      mesh.receiveShadow = model.mesh.receiveShadow;
      mesh.layers.mask = model.mesh.layers.mask;
      mesh.userData.noSplat = true;
      mesh.userData.noCollide = true;
      mesh.bind(skeleton, bindMatrix);
      // (pass 5: the default's clothes lift off a thigh swung forward; an outfit without the keys has none)
      if (mesh.morphTargetDictionary) mesh.userData.thighLift = new ThighLift(mesh, baseManifest.drivers, h.char.root).attach();
      return mesh;
    },
  });
  // his B3 body and its cloth put away (as they were: model.b3Away, for a side-by-side); the portrait head stays
  const away = [model.mesh, model.cloth?.garment, model.cloth?.underlayer, model.cloth?.innerShirt].filter(Boolean);
  model.b3Away ??= { meshes: away.map((m) => [m, m.visible]), shadowCasters: [...(model.shadowCasters ?? [])] };
  for (const m of away) m.visible = false;
  model.clothEnabled = false;
  if (model.shadowCasters) model.shadowCasters.length = 0;
  const load = async (id) => {
    if (id === 'default' || wardrobe.outfits[id]) return;
    if (!shared.parts.has(id)) {
      shared.parts.set(id, (async () => {
        const entry = list.outfits.find((o) => o.id === id);
        if (!entry) throw new Error(`no outfit "${id}"`);
        const manifest = await json(ROOT + entry.dir + 'manifest.json');
        return { manifest, parts: await loadParts(ROOT + entry.dir + manifest.glb, skeleton.bones) };
      })());
    }
    const { manifest, parts } = await shared.parts.get(id);
    sourceMat[id] = Object.values(parts)[0].material;
    wardrobe.add(id, manifest, Object.fromEntries(Object.entries(parts).map(([n, p]) => [n, p.geometry])));
  };
  return { wardrobe, load };
}

/** The list of outfits (outfits.json), fetched once. */
let listing = null;
export const outfitList = () => (listing ??= json(ROOT + 'outfits.json').catch((e) => { listing = null; throw e; }));

/**
 * The game's traveller dressed as v2 in `outfit` (the debug switch: main.js). Everything is fetched before B3 is put
 * away, so a failure (the built site, no data/) leaves him as he was. Returns { wardrobe, wear(id) } (wear: async,
 * loads an outfit the first time).
 */
export async function wearTravellerV2(model, { outfit = 'default' } = {}) {
  const [list, baseManifest] = await Promise.all([outfitList(), json(ROOT + 'manifest.json')]);
  const base = await loadParts(ROOT + list.base, model.humanoid.body.skeleton.bones);
  const id = list.outfits.some((o) => o.id === outfit) ? outfit : 'default';
  const shared = { materials: new Map(), parts: new Map() };
  // (an outfit's GLB fetched before anything changes too)
  if (id !== 'default') {
    const entry = list.outfits.find((o) => o.id === id), manifest = await json(ROOT + entry.dir + 'manifest.json');
    shared.parts.set(id, loadParts(ROOT + entry.dir + manifest.glb, model.humanoid.body.skeleton.bones).then((parts) => ({ manifest, parts })));
    await shared.parts.get(id);
  }
  const { wardrobe, load } = v2Wardrobe(model, { list, baseManifest, base }, shared);
  await load(id);
  wardrobe.wear(id);
  model.v2 = { wardrobe, list };
  return {
    wardrobe, list,
    async wear(next) { await load(next); return wardrobe.wear(next); },
  };
}
