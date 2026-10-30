// #800 phase 2: the trial variants of the four trial foes (current | direct | Tripo), switched in a running game page
// (the trial page, arena.html beside this; the capture and bench scripts import it into the plain Arena page).
// `use(kind, variant)` stands the variant's builder in for the archetype's (src/enemies/plans/index.js
// TRIAL_BUILDERS) and forgets the bodies the game built ahead of it, so the next foe of that kind is built in it.
// 'current' takes the stand-in away: the game's own body. The game's roster never sees any of this.
import { TRIAL_BUILDERS } from '/src/enemies/plans/index.js';
import { shellbackModel } from '/src/enemies/plans/shellback.js';
import { broadHoundModel } from '/src/enemies/plans/broad-hound.js';
import { duneMummerModel } from '/src/enemies/plans/dune-mummer.js';

// (this folder's URL: not new URL('./', import.meta.url), which Vite rewrites to the folder without its slash)
const here = import.meta.url.replace(/[?#].*$/, '').replace(/[^/]*$/, '');
/** What each trial foe has, and what is built so far. */
export const TRIALS = {
  crab: { concept: 'shellback', skin: 'arzach2', direct: true, tripo: true },
  hound: { concept: 'hound', skin: 'eclipse', direct: true, tripo: true },
  brute: { concept: 'keep-brute', skin: 'perdide2', direct: false, tripo: false },
  mummer: { concept: 'keep-mummer', skin: 'desert', direct: true, tripo: true },
};
const sources = {};
/** The Tripo bodies' sources, loaded once. */
async function tripoBuilder(kind) {
  if (kind !== 'crab') return null;
  const { loadTripoShellback, tripoShellbackModel } = await import('./shellback-tripo/model.js');
  sources.crab ??= await loadTripoShellback(`${here}shellback-tripo/`);
  return (skin) => tripoShellbackModel(skin, sources.crab);
}
async function tripoHound() {
  const { loadTripoHound, tripoHoundModel } = await import('./hound-tripo/model.js');
  sources.hound ??= await loadTripoHound(`${here}hound-tripo/`);
  return (skin) => tripoHoundModel(skin, sources.hound);
}
const BUILD = { crab: { direct: async () => shellbackModel, tripo: () => tripoBuilder('crab') } };
BUILD.hound = { direct: async () => broadHoundModel, tripo: tripoHound };
// the dune mummer (#800 phase 2): direct in src/enemies/plans/dune-mummer.js, Tripo in mummer-tripo/
BUILD.mummer = { direct: async () => duneMummerModel, tripo: async () => {
  const { loadTripoMummer, tripoMummerModel } = await import('./mummer-tripo/model.js');
  sources.mummer ??= await loadTripoMummer(`${here}mummer-tripo/`);
  return (skin) => tripoMummerModel(skin, sources.mummer);
} };

/** The variant a kind is built in now. */
export const chosen = {};
/** Build `kind`'s next bodies in `variant` ('current' | 'direct' | 'tripo'). Resolves to whether it has that variant. */
export async function use(kind, variant, foes = window.foes) {
  if (variant === 'current') { delete TRIAL_BUILDERS[kind]; chosen[kind] = 'current'; }
  else {
    const fn = await BUILD[kind]?.[variant]?.();
    if (!fn) return false;
    TRIAL_BUILDERS[kind] = fn; chosen[kind] = variant;
  }
  // (the bodies built ahead for a kind are of the builder it had: forgotten)
  for (const k of [...(foes?.spares?.keys?.() ?? [])]) if (k.split('@')[0] === kind) foes.spares.delete(k);
  return true;
}
/** Load every built variant's source now (the Tripo GLB), so a builder is ready the moment a foe is added. */
export async function preload() { for (const [kind, t] of Object.entries(TRIALS)) if (t.tripo) await BUILD[kind].tripo(); }

/**
 * What one body costs as built: its drawn meshes (one pass; a batch counts once), triangles, materials, textures
 * (their pixels as RGBA8 with mips: × 4/3), its source's bytes.
 */
export function inventory(group) {
  const mats = new Set(), tex = new Set();
  let meshes = 0, tris = 0, skinned = 0;
  group.traverseVisible((o) => {
    if (!o.isMesh || o.layers.mask === 0) return;   // (a part drawn by its batch: src/part-batch.js turns its layers off)
    meshes++; if (o.isSkinnedMesh) skinned++;
    const g = o.geometry; tris += (g.index ? g.index.count : g.attributes.position.count) / 3 * (o.isInstancedMesh ? o.count : 1);
    // (its own textures only: the house's shared hatch and shadow maps are the scene's)
    for (const m of [].concat(o.material)) { mats.add(m); const t = m.uniforms?.uMap?.value ?? m.map; if (t?.isTexture) tex.add(t); }
  });
  let texBytes = 0;
  for (const t of tex) { const im = t.image; if (im?.width) texBytes += im.width * im.height * 4 * 4 / 3; }
  return { meshes, skinned, triangles: Math.round(tris), materials: mats.size, textures: tex.size, textureMB: +(texBytes / 2 ** 20).toFixed(2) };
}
