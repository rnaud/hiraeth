// Z-fighting, world by world (.claude/skills/zfight-qc/SKILL.md): each world built as the game builds it (in node,
// no GPU), every visible static mesh's triangles, and the sites where two looks share a plane (scripts/zfight/lib.mjs).
//
//   node scripts/zfight/audit.mjs [--worlds desert,incal] [--temples] [--out report.json] [--worst 8] [--within x0,y0,z0,x1,y1,z1] [--no-names]
//   node scripts/zfight/audit.mjs --ship [--worst 8]        the ship alone, parked (src/ship/ship.js: its hull and its rooms;
//                                                          every world's ship is the same one, built by main.js, not the level)
//
// A site between two meshes merged of many pieces says which pieces (scripts/zfight/names.mjs: the lines of src/ that
// made them and the comment over the line); --no-names leaves that out (a little faster).
// --temples: each world's temples alone (their insides and their exteriors), counted apart from the rest of the world.
// Prints a line per world (sites, shared m²) and the worst sites; --out writes them all as JSON.
// tests/zfight.test.js holds the counts to their baselines (ZFIGHT_BASELINE there).
import { writeFileSync } from 'node:fs';
import { nameParts, partOf, describe } from './names.mjs';
import { zfightsOf as measureWorld, shipZfights as measureShip } from './audit-core.mjs';
export { rayOver, standing, fightsIn } from './audit-core.mjs';
const naming = { nameParts, partOf, describe };
export const zfightsOf = (id, options) => measureWorld(id, options, naming);
export const shipZfights = options => measureShip(options, naming);

const args = process.argv.slice(2), arg = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };

if (import.meta.url === `file://${process.argv[1]}` && args.includes('--ship')) {
  const r = await shipZfights({ names: !args.includes('--no-names') });
  console.log(`ship         ${String(r.total.count).padStart(4)} sites, ${String(r.total.area).padStart(8)} m² shared`);
  for (const f of r.total.worst.slice(0, +arg('worst', 8))) console.log(`    ${String(f.area).padStart(7)} m²  ${f.matA} × ${f.matB}  at ${f.seen?.at.join(', ')}  n ${f.normal.join(',')}  (${f.meshA} × ${f.meshB})` + (f.parts ? f.parts.map((p, i) => `\n             ${i ? 'B' : 'A'}: ${p || '?'}`).join('') : ''));
  if (arg('out')) writeFileSync(arg('out'), JSON.stringify([r], null, 1));
} else if (import.meta.url === `file://${process.argv[1]}`) {
  const names = !args.includes('--no-names');
  if (names) await nameParts();
  const { LEVELS } = await import('../../src/levels/index.js');
  const worlds = arg('worlds')?.split(',') ?? LEVELS.filter((l) => !l.hidden).map((l) => l.id);
  const within = arg('within')?.split(',').map(Number) ?? null;
  const worst = +arg('worst', 8);
  const report = [];
  for (const w of worlds) {
    const t0 = Date.now();
    let r;
    try { r = await zfightsOf(w, { temples: args.includes('--temples') || true, within, names }); } catch (e) { console.log(`${w.padEnd(12)} failed: ${e.message}`); continue; }
    report.push(r);
    console.log(`${w.padEnd(12)} ${String(r.total.count).padStart(4)} sites, ${String(r.total.area).padStart(8)} m² shared  (${((Date.now() - t0) / 1000).toFixed(1)} s)` + Object.entries(r.temples).map(([id, s]) => `\n  temple ${id.padEnd(12)} ${String(s.count).padStart(4)} sites, ${s.area} m²`).join(''));
    for (const f of r.total.worst.slice(0, worst)) console.log(`    ${String(f.area).padStart(7)} m²  ${f.matA} × ${f.matB}  at ${f.seen?.at.join(', ')}  n ${f.normal.join(',')}  (${f.meshA} × ${f.meshB})` + (f.parts ? f.parts.map((p, i) => `\n             ${i ? 'B' : 'A'}: ${p || '?'}`).join('') : ''));
  }
  if (arg('out')) writeFileSync(arg('out'), JSON.stringify(report, null, 1));   // (every site: report[i].all)
}
