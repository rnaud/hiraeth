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
  return { id, name: entry.name, garments: Object.keys(m.parts), from: id, hides: [...m.hides], skinCut: m.skinCut ?? [] };
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
  const tris = (g) => g.index.count / 3;
  return { body: bodyG, clothes: clothesG, triangles: { body: tris(bodyG), clothes: tris(clothesG) }, culled: { body: (body.index?.count ?? 0) / 3 - bodyIdx.length / 3, skin: (skin.index?.count ?? 0) / 3 - skinIdx.length / 3 } };
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
    this.meshes = [this.make(d.body, 'body', plan), this.make(d.clothes, 'clothes', plan)];
    for (const m of this.meshes) this.parent.add(m);
    this.worn = { id, plan, triangles: d.triangles.body + d.triangles.clothes, draws: this.meshes.length, culled: d.culled };
    return this.worn;
  }

  next() {
    const ids = this.ids();
    return this.wear(ids[(ids.indexOf(this.worn?.id) + 1) % ids.length]);
  }
}
