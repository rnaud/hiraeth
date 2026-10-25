// Split the existing audit, not its assertions: every active world, prologue and every minigame still runs.
import assert from 'node:assert/strict';
import { LEVELS } from '../src/levels/index.js';
import { isDiscarded } from '../src/levels/names.js';
import { gatherMaterials, compare } from '../scripts/bridge-gaps.mjs';

export function materialScopes() {
  const worlds = LEVELS.filter(level => !isDiscarded(level.id)).map(level => level.id);
  return {
    'worlds-a': { worlds: [...worlds.filter((_, i) => i % 2 === 0), 'prologue'], games: [] },
    'worlds-b': { worlds: worlds.filter((_, i) => i % 2 === 1), games: [] },
    minigames: { worlds: [], games: null }, // null retains gatherMaterials' complete bundled game discovery.
  };
}

// Actual scoped inventories observed each key here. The contract requires exactly all GAPS.materials keys,
// once each; each runtime partition must observe its assigned keys. A disappearing/moved witness fails loudly.
export const REQUIRED_MATERIAL_KEYS = {
  "worlds-a": [
    "uniform:uPortraitHairAmount",
    "uniform:uPortrait",
    "uniform:uIris",
    "patch:fragment:farDepth",
    "define:METAL_BRUSHED",
    "define:S_BIOMES",
    "define:S_STRATA",
    "define:S_CRACKS",
    "define:S_PLATES",
    "define:S_WEATHER",
    "define:S_EYE",
    "define:S_TILES",
    "define:S_FACADE",
    "uniform:uVertexColors",
    "define:CROWD",
    "uniform:uKeyScale",
    "define:GARMENT",
    "uniform:uClothG",
    "uniform:uGarmentCapB",
    "uniform:uGrassLod"
  ],
  "worlds-b": [
    "uniform:uPortraitFaceAmount",
    "uniform:uExpression",
    "uniform:uHeadBall",
    "patch:fragment:nacre",
    "shader:uColor,uGlow",
    "define:S_SANDINK",
    "define:S_GLYPHS",
    "define:S_SCRUB",
    "define:S_DETAIL",
    "define:S_MAP",
    "define:S_FOLDS",
    "define:S_LEAVES",
    "define:S_GLASS",
    "uniform:uPalette",
    "define:FACE_KEYS",
    "uniform:uKeyWidth",
    "uniform:uGarmentRigid",
    "uniform:uGarmentSim",
    "define:SWAY",
    "uniform:uGrassLook"
  ],
  "minigames": [
    "uniform:uHeadView",
    "uniform:uGaze",
    "patch:fragment:landmarkStone",
    "patch:fragment+vertex:splat",
    "define:S_RIPPLES",
    "define:S_TERRAIN",
    "define:S_GRID",
    "define:S_WATERMODE",
    "define:S_PATCH",
    "define:S_FIGURE",
    "define:S_VEIL",
    "define:S_TICKS",
    "define:SURFACE_SPEC",
    "uniform:uVeins",
    "uniform:uKeyW",
    "define:FACE_PART",
    "uniform:uClothP",
    "uniform:uGarmentCapA",
    "uniform:uGrassView"
  ]
};

export function partitionComparison(id, found) {
  assert.ok(Object.hasOwn(REQUIRED_MATERIAL_KEYS, id), 'known material audit partition');
  const result = compare('materials', found);
  // Preserve all actual unlisted/count/bad findings. Only stale keys owned by another independently
  // checked partition are excluded here; the exact-union contract makes global stale detection complete.
  return { ...result, stale: result.stale.filter(key => REQUIRED_MATERIAL_KEYS[id].includes(key)) };
}

const HOW = 'name it in engine/bridge-gaps.js: handled (where the bridge does it), web-only (why) or gap (its issue); then node scripts/bridge-gaps.mjs';

function verdict(kind, r) {
  const lines = [
    ...r.unlisted.map((u) => `new, not in the list: ${u.key}${u.count ? ` (${u.count} sites)` : ''}${u.where ? ` (in ${u.where.slice(0, 4).join(', ')})` : ''}${u.names?.length ? ` '${u.names.join("', '")}'` : ''}`),
    ...r.counts.map((c) => `${c.key}: ${c.now} sites, the list says ${c.was} (does Unity carry the new one? then move the count)`),
    ...r.stale.map((k) => `listed, no longer found: ${k} (take it out of the list)`),
    ...r.bad.map((b) => `handled by a screen part the bridge never reads: ${b}`),
  ];
  assert.equal(lines.length, 0, `${kind}:\n  ${lines.join('\n  ')}\n(${HOW})`);
}

export async function auditMaterials(id) {
  const scope = materialScopes()[id];
  assert.ok(scope, 'known material audit scope');
  const found = await gatherMaterials(scope);
  assert.ok(found.size > 0, `${id}: audit observed materials`);
  verdict('materials ' + id, partitionComparison(id, found));
}
