// Builds the traveller's levels of detail off the main thread (traveller-lod.js): plain arrays in, index lists out.
import { MeshoptSimplifier } from 'three/addons/libs/meshopt_simplifier.module.js';
import { simplifyLevels } from './traveller-lod-core.js';

self.onmessage = async ({ data: { id, input, ratios } }) => {
  let levels = null;
  try { await MeshoptSimplifier.ready; levels = simplifyLevels(MeshoptSimplifier, input, ratios); } catch (e) { levels = null; }
  self.postMessage({ id, levels }, levels ? levels.map((l) => l.index.buffer) : []);
};
