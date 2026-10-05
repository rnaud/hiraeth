// What a GLB's bytes go to (per mesh: indices, each attribute, the morph targets), for docs/makehuman.md:
//   node scripts/makehuman/glb-sizes.mjs public/anim/human_m.glb public/anim/human_f.glb
import { readFileSync } from 'node:fs';

for (const file of process.argv.slice(2)) {
  const b = readFileSync(file);
  const len = b.readUInt32LE(12), j = JSON.parse(b.subarray(20, 20 + len));
  const bytes = (i) => {
    if (i === undefined) return 0;
    const a = j.accessors[i];
    let n = a.bufferView !== undefined ? j.bufferViews[a.bufferView].byteLength : 0;
    if (a.sparse) n += j.bufferViews[a.sparse.indices.bufferView].byteLength + j.bufferViews[a.sparse.values.bufferView].byteLength;
    return n;
  };
  const rows = {};
  for (const m of j.meshes) for (const p of m.primitives) {
    const r = (rows[m.name] ??= { tris: 0, verts: 0, indices: 0, attributes: {}, morphs: 0, targets: 0 });
    r.tris += j.accessors[p.indices].count / 3;
    r.verts += j.accessors[p.attributes.POSITION].count;
    r.indices += bytes(p.indices);
    for (const [k, v] of Object.entries(p.attributes)) r.attributes[k] = (r.attributes[k] ?? 0) + bytes(v);
    for (const t of p.targets ?? []) { r.targets++; for (const v of Object.values(t)) r.morphs += bytes(v); }
  }
  const kb = (n) => `${(n / 1024).toFixed(0)} KB`;
  console.log(`${file}: ${kb(b.length)} (JSON ${kb(len)})`);
  for (const [name, r] of Object.entries(rows)) console.log(`  ${name}: ${r.tris} triangles, ${r.verts} vertices; indices ${kb(r.indices)}, ${Object.entries(r.attributes).map(([k, v]) => `${k} ${kb(v)}`).join(', ')}${r.targets ? `; ${r.targets} morph targets ${kb(r.morphs)}` : ''}`);
}
