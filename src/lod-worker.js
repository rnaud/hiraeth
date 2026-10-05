// Builds levels of detail off the main thread (src/lod.js LodManager): packed arrays in, clustered arrays out.
import { cluster } from './lod-core.js';

self.onmessage = ({ data: { id, packed, cell, minRatio } }) => {
  let r = null;
  try { r = cluster(packed, cell, minRatio); } catch (e) { r = null; }
  const transfer = r ? [r.pos.buffer, r.index.buffer, ...new Set(r.attrs.map((a) => a.array.buffer))] : [];
  self.postMessage({ id, r }, transfer);
};
