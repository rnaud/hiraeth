// The level design audit's measurements (.claude/skills/level-design-qc/SKILL.md), in node, read-only
// against the game: each route world is built as the play-through builds it (tests/playthrough-agent.js
// loadWorld: the level with its temple, real collision, the story with its people and quests, the makers'
// boxes), its points of interest gathered, its critical path laid through the route's quests
// (tests/playthrough-worlds.js ROUTE) from the landing and back to the ship, and both measured
// (scripts/level-design/lib.mjs): spacing, the empty stretches, the walks back, remote dead ends, the
// landmarks (a height grid of the collision, tall blobs in it) and what sees them, each leg's guidance,
// height, the kinds of stop; then scored.
//
//   node scripts/level-design/audit.mjs [<out-dir>] [--worlds desert,arzach] [--cell 6]
// Writes <out-dir>/report.json, <out-dir>/<world>-map.png (+ <world>-map.svg: the same with names) and
// <out-dir>/views.json (a view from high over each world and a few along its path, for
// scripts/design-qc/capture.mjs). The sight lines use the collision (what you can stand on or bump into)
// and the terrain; things you walk through (grass, flowers, most foliage) don't block them.
import { mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const args = process.argv.slice(2), arg = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const OUT = resolve(args[0] && !args[0].startsWith('--') ? args[0] : join(tmpdir(), 'level-design'));
mkdirSync(OUT, { recursive: true });

const {measureWorlds} = await import('./measure.mjs');
const {report,views,maps}=await measureWorlds({worlds:arg('worlds')?.split(',').filter(Boolean),cellSize:arg('cell'),log:console.log});
for (const [file,bytes] of maps) writeFileSync(join(OUT,file),bytes);
writeFileSync(join(OUT, 'report.json'), JSON.stringify(report, null, 2));
writeFileSync(join(OUT, 'views.json'), JSON.stringify({ views }, null, 2));
console.log('\nscores (1-5): landmarks, wayfinding, density, spacing, loops, optional, verticality, pacing, onboarding → mean');
for (const w of report.worlds) console.log(`${w.id.padEnd(9)} ${Object.values(w.scores.criteria).map((c) => c.score).join('  ')}  → ${w.scores.total}`);
console.log(`\nreport.json, maps and views.json in ${OUT}`);
process.exit(0);
