// The v2 traveller in the game (issue #493): the Blender rebuild (data/characters/traveller-v2/, copied into the build by
// scripts/traveller-v2-ship.mjs) drawn on his usual skeleton and animation: the game's traveller since v1.88 (the
// author's decision, 2026-10-20). B3 stays reachable for comparison (?traveller=b3, or the dev menu's Traveller tab).
//
// What it does, on the game's traveller (createTraveller's, B3, whose humanoid, hands, feet and clips stay):
// - loadTravellerV2 fetches the models beside B3's (characters/traveller.js loadTraveller), dressTravellerV2 dresses
//   him as createTraveller builds him; wearTravellerV2 fetches then dresses (the dev menu's switch);
// - binds every skinned mesh of the GLB (and of an outfit's GLB) to humanoid.body.skeleton by bone name (bindParts);
// - dresses him through the Wardrobe (outfits.js): the body's hidden areas for the outfit worn culled, his skin
//   piece's skinCut left out, the draw groups joined (body + skin, the garments: two draws, plus the game's head);
// - drives the default clothes' thigh-lift keys (thighLift_l / _r, pass 5) each time they are drawn, from each
//   thigh's forward swing (the manifest's `drivers`: 0 at 25 degrees, 1 at 80; ThighLift);
// - moves the default's shirt as cloth (traveller-v2-cloth.js: B3's solver), trims his hand under the fluid glove
//   (Humanoid.wearGlove's skins) and gives his body and clothes far levels (traveller-lod.js), following his outfit;
// - keeps the game's own portrait head (head-v3: the asset the v2 head was made from) with its drawn face, eye paint
//   and speech: the GLB's Head and Hair (re-UV'd onto the atlas, their face ink not re-baked, #473) are not drawn;
// - puts B3's body, its cloth and its cloth's shadow away.
import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Wardrobe } from './outfits.js';
import { makeReviewInkMaterial } from './tripo-material.js';
import { makeV2Cloth, V2_CLOTH } from './traveller-v2-cloth.js';
import { CLOTH_HOST } from './tripo-cloth.js';
import { lodMeshes } from './traveller-lod.js';
import { store } from '../platform.js';

/** Where the models are, under the site's base: data/ on the dev server, copied into the build (vite.config.js). */
export const DIR = 'data/characters/traveller-v2/';
export const ROOT = `${import.meta.env?.BASE_URL ?? '/'}${DIR}`;
export async function json(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
  // (a server that answers a missing file with its index page: not JSON)
  try { return await r.json(); } catch { throw new Error(`${url}: not found`); }
}

// ------------------------------------------------------------------ the switch
/** v2 or B3, and v2's outfit: ?traveller=b3 (or v2) and &outfit=<id> in the address win; else the dev menu's choice,
 * kept on this device. On (v2) unless B3 is asked for. */
export const travellerSetting = {
  key: 'hiraeth.travellerV2',
  get(search = typeof location !== 'undefined' ? location.search : '') {
    let on = true, outfit = 'default';
    try {
      const kept = store.get(this.key);
      if (kept) { on = kept !== 'off'; if (on) outfit = kept; }
      const q = new URLSearchParams(search);
      if (q.has('traveller')) on = q.get('traveller') !== 'b3';
      if (q.get('outfit')) outfit = q.get('outfit');
    } catch { /* (no storage: v2) */ }
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
export function v2Wardrobe(model, { list, baseManifest, base, root = ROOT }, shared = { materials: new Map(), parts: new Map() }, { cloth = false } = {}) {
  const h = model.humanoid;
  // (what follows his outfit: the shirt's cloth, the glove's trim, his far levels; model.v2State)
  const state = (model.v2State ??= { cloth: null, meshes: [] });
  // the cloth: the default's shirt, where this page moves it (the game: updateCloth) and no engine took it over
  const clothOn = cloth && !CLOTH_HOST.offload;
  const wantsCloth = (plan) => clothOn && plan.from === 'base' && plan.garments.includes(V2_CLOTH.garment);
  const skeleton = h.body.skeleton, bindMatrix = h.body.bindMatrix, parent = h.body.parent;
  const inkOf = (src) => {
    const m = new T.Mesh(new T.BufferGeometry(), src);
    m.userData.inkShade = { hatch: 0.2 };
    return makeReviewInkMaterial(m);
  };
  const material = (src) => {
    if (!shared.materials.has(src)) shared.materials.set(src, inkOf(src));
    return shared.materials.get(src);
  };
  const sourceMat = { base: base.Body.material };   // (the base's single-sided atlas: the body, his skin, the default's clothes)
  const wardrobe = new Wardrobe({
    list, baseManifest, parent,
    base: Object.fromEntries(Object.entries(base).map(([n, p]) => [n, p.geometry])),
    make(geometry, role, plan) {
      const src = role === 'body' || plan.from === 'base' ? sourceMat.base : sourceMat[plan.from];
      // (clothes with cloth: their own material, its shader patched by the cloth: traveller-v2-cloth.js)
      const own = role === 'clothes' && wantsCloth(plan);
      const mesh = new T.SkinnedMesh(geometry, own ? inkOf(src) : material(src));
      mesh.name = `TravellerV2.${role}`;
      mesh.frustumCulled = false;
      mesh.castShadow = model.mesh.castShadow;
      mesh.receiveShadow = model.mesh.receiveShadow;
      mesh.layers.mask = model.mesh.layers.mask;
      mesh.userData.noSplat = true;
      mesh.userData.noCollide = true;
      // (its far levels collapse across the atlas's seams and the hems: characters/traveller-lod-core.js lodInput)
      mesh.userData.lodFlags = ['Permissive'];
      mesh.userData.lodMinTris = 1000;   // (his body culled under the default's clothes: 2.5 k, worth levels too)
      // (finer steps than B3's: his clothes are one 50 k draw where B3 had a body and an overshirt, so a level between
      // B3's keeps him at or under B3's triangles at every distance)
      mesh.userData.lodRatios = [0.5, 0.4, 0.3, 0.22, 0.16, 0.12, 0.08, 0.05];
      mesh.bind(skeleton, bindMatrix);
      // (pass 5: the default's clothes lift off a thigh swung forward; an outfit without the keys has none)
      if (mesh.morphTargetDictionary) mesh.userData.thighLift = new ThighLift(mesh, baseManifest.drivers, h.char.root).attach();
      return mesh;
    },
    undress(meshes) {
      state.cloth?.dispose();
      state.cloth = null;
      const gone = new Set(meshes);
      if (h.noShadow) h.noShadow.splice(0, h.noShadow.length, ...h.noShadow.filter((o) => !gone.has(o)));
      if (h.glove?.skins) h.glove.skins = h.glove.skins.filter((o) => !gone.has(o));
      if (model.shadowCasters) model.shadowCasters.length = 0;
      state.meshes = [];
    },
    dressed(meshes, worn) {
      state.meshes = meshes;
      // the fluid glove (built on B3's hand, humanoid.wearGlove): his hand and any sleeve or glove of the outfit
      // under it left out while it is worn
      if (h.glove?.skins) { h.glove.skins.push(...meshes); if (h.glove.on) h.glove.show(true); }
      // the shirt swings (the default's): its shadow drawn the same shape, the clothes out of the shadow passes
      const range = worn.ranges?.[V2_CLOTH.garment];
      if (wantsCloth(worn.plan) && range) {
        const clothes = meshes[1];
        state.cloth = makeV2Cloth(clothes, range);
        if (state.cloth.shadow) {
          (h.noShadow ??= []).push(clothes);
          (model.shadowCasters ??= []).push(state.cloth.shadow);
        }
        h.char.root.updateMatrixWorld(true);
        state.cloth.update(0, 'rest', false);
      }
      // his far levels follow the meshes drawn (characters/traveller-lod.js)
      model.lod?.track?.(lodMeshes(model));
    },
  });
  // his B3 body and its cloth put away (as they were: model.b3Away, for a side-by-side); the portrait head stays
  const away = [model.mesh, model.cloth?.garment, model.cloth?.underlayer, model.cloth?.innerShirt].filter(Boolean);
  model.b3Away ??= { meshes: away.map((m) => [m, m.visible]), shadowCasters: [...(model.shadowCasters ?? [])], noShadow: [...(h.noShadow ?? [])], updateCloth: model.updateCloth };
  for (const m of away) m.visible = false;
  // (its cloth's worker let go: B3's overshirt is no longer stepped; a side-by-side steps it here if it must)
  model.cloth?.dispose?.();
  if (model.shadowCasters) model.shadowCasters.length = 0;
  // (B3's own garment out of the shadow lists: put away, it is neither drawn nor stepped)
  if (h.noShadow && model.cloth?.garment) h.noShadow.splice(0, h.noShadow.length, ...h.noShadow.filter((o) => o !== model.cloth.garment));
  // each frame (Player.updateCloth): v2's shirt, not B3's put-away overshirt
  model.updateCloth = (dt, reset = false) => {
    const c = state.cloth;
    if (!c) return null;
    h.char.root.updateMatrixWorld(true);
    if (reset) c.update(0, 'rest', false);
    return c.update(dt, 'game', model.clothEnabled !== false);
  };
  const load = async (id) => {
    if (id === 'default' || wardrobe.outfits[id]) return;
    if (!shared.parts.has(id)) {
      shared.parts.set(id, (async () => {
        const entry = list.outfits.find((o) => o.id === id);
        if (!entry) throw new Error(`no outfit "${id}"`);
        const manifest = await json(root + entry.dir + 'manifest.json');
        return { manifest, parts: await loadParts(root + entry.dir + manifest.glb, skeleton.bones) };
      })());
    }
    const { manifest, parts } = await shared.parts.get(id);
    put(id, manifest, parts);
  };
  /** An outfit's parts, bound already (bindParts), added at once. */
  const put = (id, manifest, parts) => {
    sourceMat[id] = Object.values(parts)[0].material;
    wardrobe.add(id, manifest, Object.fromEntries(Object.entries(parts).map(([n, p]) => [n, p.geometry])));
  };
  return { wardrobe, load, put };
}

/** The list of outfits (outfits.json), fetched once. */
let listing = null;
export const outfitList = () => (listing ??= json(ROOT + 'outfits.json').catch((e) => { listing = null; throw e; }));

/**
 * What dressing him as v2 needs, fetched (loadTraveller asks for it with B3's own, characters/traveller.js): the list,
 * the base manifest and GLB, and the outfit's when it is not the default. Binding waits for his skeleton
 * (dressTravellerV2). base: the site's base URL.
 */
export async function loadTravellerV2(base = import.meta.env?.BASE_URL ?? '/', { outfit = 'default' } = {}) {
  const root = `${base}${DIR}`;
  const [list, baseManifest] = await Promise.all([json(root + 'outfits.json'), json(root + 'manifest.json')]);
  const entry = list.outfits.find((o) => o.id === outfit && o.dir);
  const loader = new GLTFLoader();
  const [baseGltf, worn] = await Promise.all([
    loader.loadAsync(root + list.base),
    entry ? json(root + entry.dir + 'manifest.json').then(async (manifest) => ({ id: entry.id, manifest, gltf: await loader.loadAsync(root + entry.dir + manifest.glb) })) : null,
  ]);
  return { root, list, baseManifest, baseGltf, outfit: worn ?? { id: 'default' } };
}

/**
 * The game's traveller dressed as v2 from loadTravellerV2's sources, at once (createTraveller does it while it builds
 * him: the title, the game, the films, the studio). The cloth on in a page (an engine's VM: the shirt skinned). Returns model.v2: { wardrobe, list, wear(id) }
 * (wear: async, loads an outfit the first time).
 */
export function dressTravellerV2(model, sources, { cloth = typeof window !== 'undefined' } = {}) {
  const { root, list, baseManifest, baseGltf, outfit } = sources;
  const bones = model.humanoid.body.skeleton.bones;
  const shared = { materials: new Map(), parts: new Map() };
  const base = bindParts(baseGltf, bones, list.base);
  const { wardrobe, load, put } = v2Wardrobe(model, { list, baseManifest, base, root }, shared, { cloth });
  // (the outfit fetched with the base: bound and added at once, no wait)
  if (outfit?.gltf) {
    const parts = bindParts(outfit.gltf, bones, outfit.id);
    shared.parts.set(outfit.id, Promise.resolve({ manifest: outfit.manifest, parts }));
    put(outfit.id, outfit.manifest, parts);
  }
  wardrobe.wear(outfit?.gltf ? outfit.id : 'default');
  model.humanoid.tankAt = null;   // (the makers' battery at v2's own place: fluid-tool.js TANK.at, off his shirt)
  model.v2 = {
    wardrobe, list, put,
    async wear(next) { await load(next); return wardrobe.wear(next); },
  };
  return model.v2;
}

/**
 * The game's traveller dressed as v2 in `outfit`, fetched first (the dev menu's switch on a traveller built as B3).
 * Everything is fetched before B3 is put away, so a failure (no models) leaves him as he was. Dressed already: that
 * outfit worn. Returns model.v2 ({ wardrobe, list, wear(id) }).
 */
export async function wearTravellerV2(model, { outfit = 'default', cloth = typeof window !== 'undefined' } = {}) {
  if (model.v2) { await model.v2.wear(outfit); return model.v2; }
  return dressTravellerV2(model, await loadTravellerV2(undefined, { outfit }), { cloth });
}
