// The temple design audit's measurements (.claude/skills/temple-design-qc/SKILL.md), in node, read-only
// against the game: every temple's rooms are built as the game builds them (src/temples/runtime.js, its
// layout, with no world round it), the pieces the layout places are recorded, and the puzzle graph is
// measured (scripts/temple-design/lib.mjs): locks and keys, mechanics taught / tested / twisted, steps
// that combine two verbs, how far each key is from its lock (rooms, metres, line of sight through the
// temple's own walls and shut doors), backtracking, reversible state, the guardian's link to the gadget,
// an obviousness score per step, and how alike the temples' shapes are.
//
//   node scripts/temple-design/audit.mjs [<out-dir>] [--temples desert,incal]
// Writes <out-dir>/report.json, <out-dir>/<id>-plan.svg (a top-down plan, lock → key lines coloured by how
// obvious each step is) and <out-dir>/views.json (camera views of each temple's most obvious steps, for
// scripts/design-qc/capture.mjs). Default <out-dir>: the system's temp folder.
import { mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { measureTemples } from './measure.mjs';

const args = process.argv.slice(2), arg = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const OUT = resolve(args[0] && !args[0].startsWith('--') ? args[0] : join(tmpdir(), 'temple-design'));
mkdirSync(OUT, { recursive: true });

const { report, views, plans } = await measureTemples({ temples: arg('temples')?.split(','), log: console.log });
for (const [id, svg] of Object.entries(plans)) writeFileSync(join(OUT, `${id}-plan.svg`), svg);
writeFileSync(join(OUT, 'report.json'), JSON.stringify(report, null, 2));
writeFileSync(join(OUT, 'views.json'), JSON.stringify({ views }, null, 2));
writeFileSync(join(OUT, 'rules.json'), JSON.stringify(Object.fromEntries(report.temples.map((t) => [t.id, t.rules])), null, 2));
console.log('\nthe redesign’s rules (docs/design/temple-redesign.md), most broken first:');
for (const t of [...report.temples].sort((a, b) => b.rules.count - a.rules.count)) console.log(`${t.id.padEnd(11)} ${String(t.rules.count).padStart(3)}  ${Object.entries(t.rules.by).map(([k, n]) => `${k} ${n}`).join(', ')}`);
console.log('\nscores (1-5): structure, teach/test/twist, combination, non-obvious, decoupling, dungeon item, guardian exam, identity, curve → mean');
for (const t of report.temples) console.log(`${t.id.padEnd(10)} ${Object.values(t.scores.criteria).map((c) => c.score).join('  ')}  → ${t.scores.total}   (most alike: ${t.mostAlike.id} ${Math.round(t.mostAlike.sim * 100)} %)`);
console.log(`\nreport.json, plans and views.json in ${OUT}`);
process.exit(0);
