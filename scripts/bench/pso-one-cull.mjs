// A traced pipeline list (BridgePso's .graphicsstate) brought to one cull mode (issue #536; docs/systems/performance.md,
// "One cull mode and one layout"): since BridgeSided, a Surface material three draws from behind or from both sides is
// drawn culling back faces, so the G-buffer states of the variants it turns (not the GPU instances', crowds', grass',
// footprints', flora's, nor the water's) that culled none or the front ones are drawn as the same state culling back faces.
// Each such state takes the render state that differs from its own by the cull mode alone; the doubles go. Until the list
// is traced again on the device, this keeps the warm-up from making pipelines no longer drawn, and has it make the ones
// drawn instead. Not for Android's list, where a two-sided mesh whose normals cross its triangles keeps its cull mode.
//   node scripts/bench/pso-one-cull.mjs <in.graphicsstate> [out.graphicsstate] [--dry 1]
import { readFileSync, writeFileSync } from 'node:fs';

const [inFile, outFile = inFile] = process.argv.slice(2).filter((a, i, all) => !a.startsWith('--') && !all[i - 1]?.startsWith('--'));
const dry = process.argv.includes('--dry');
const HASHES = /"(first|vertexLayout|renderPass|renderState)": (\d+)/g;
const c = JSON.parse(readFileSync(inFile, 'utf8').replace(HASHES, '"$1": "$2"'));
const KEEP = ['HIRAETH_CROWD', 'HIRAETH_GRASS', 'HIRAETH_PUFFS', 'HIRAETH_INSTMAT', 'HIRAETH_FLORA', 'HIRAETH_LEAN_WATER'];

/** a render state's key without its cull mode */
const states = new Map(c.m_RenderStateMap.map((x) => [x.first, x.second.renderState]));
const sansCull = (r) => JSON.stringify({ ...r, rasterState: { ...r.rasterState, cullMode: 0 } });
const back = new Map();
for (const [h, r] of states) if (r.rasterState.cullMode === 2) back.set(sansCull(r), h);

let turned = 0, merged = 0, missing = 0, before = 0, after = 0;
for (const { second: v } of c.m_VariantInfoMap) {
  before += v.graphicsStateInfoSet.length;
  const kws = v.keywordNames.split(' ').filter(Boolean);
  if (v.shaderName === 'Hiraeth/Surface' && v.passIndex === 0 && !kws.some((k) => KEEP.includes(k))) {
    for (const s of v.graphicsStateInfoSet) {
      const r = states.get(s.renderState);
      if (!r || r.rasterState.cullMode === 2 || r.depthState.depthWrite === 0) continue;   // (the water: no depth, drawn last)
      const to = back.get(sansCull(r));
      if (!to) { missing++; continue; }
      s.renderState = to; turned++;
    }
    const seen = new Set();
    const n0 = v.graphicsStateInfoSet.length;
    v.graphicsStateInfoSet = v.graphicsStateInfoSet.filter((s) => { const k = JSON.stringify(s); if (seen.has(k)) return false; seen.add(k); return true; });
    merged += n0 - v.graphicsStateInfoSet.length;
  }
  after += v.graphicsStateInfoSet.length;
}
// (render states no state uses any more go too)
const used = new Set(c.m_VariantInfoMap.flatMap((x) => x.second.graphicsStateInfoSet.map((s) => s.renderState)));
c.m_RenderStateMap = c.m_RenderStateMap.filter((x) => used.has(x.first));
console.log(`${inFile}: ${before} → ${after} states (${turned} turned to cull back faces, ${merged} doubles gone, ${missing} with no such state to take)`);
if (!dry) writeFileSync(outFile, JSON.stringify(c, null, 4).replace(/"(first|vertexLayout|renderPass|renderState)": "(\d+)"/g, '"$1": $2'));
