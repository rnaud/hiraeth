// The performance audit's build sizes (.claude/skills/perf-audit/SKILL.md): what dist/ holds, by area
// (the game's code, music, sound effects, animations, bodies, pictures…), the JavaScript and CSS gzipped,
// what the first page needs before the title screen (index.html, its scripts, styles and preloads), and
// the biggest files. With --against <previous size.json>, the change for each.
//   npx vite build && node .claude/skills/perf-audit/size.mjs [--out size.json] [--against old.json]
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..'), DIST = join(ROOT, 'dist');
const args = process.argv.slice(2), arg = (n) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : undefined; };
const files = [];
const walk = (d) => { for (const f of readdirSync(d)) { const p = join(d, f), s = statSync(p); s.isDirectory() ? walk(p) : files.push({ path: relative(DIST, p), bytes: s.size }); } };
walk(DIST);

const AREAS = [
  ['music', /^music\//], ['sound effects', /^sfx\//], ['animations', /^anim\//], ['bodies and characters', /^(characters|makehuman)\//],
  ['changelog pictures (site only)', /^changelog-media\//], ['item pictures', /^item-pictures\//], ['world thumbnails', /^thumbs\//], ['icons', /^icons\//],
  ['JavaScript', /\.m?js$/], ['CSS', /\.css$/], ['HTML', /\.html$/], ['other', /./],
];
const areas = Object.fromEntries(AREAS.map(([n]) => [n, { files: 0, bytes: 0 }]));
for (const f of files) { const [n] = AREAS.find(([, re]) => re.test(f.path)); f.area = n; areas[n].files++; areas[n].bytes += f.bytes; }
const gz = (p) => gzipSync(readFileSync(join(DIST, p)), { level: 9 }).length;
for (const n of ['JavaScript', 'CSS', 'HTML']) areas[n].gzip = files.filter((f) => f.area === n).reduce((a, f) => a + gz(f.path), 0);

// (what index.html asks for before anything runs: its scripts, module preloads and styles)
const html = readFileSync(join(DIST, 'index.html'), 'utf8');
const first = [...new Set([...html.matchAll(/(?:src|href)="\.?\/?([^"]+\.(?:m?js|css))"/g)].map((m) => m[1]))].filter((p) => files.some((f) => f.path === p));
const firstLoad = { files: first.length + 1, bytes: first.reduce((a, p) => a + statSync(join(DIST, p)).size, 0) + Buffer.byteLength(html), gzip: first.reduce((a, p) => a + gz(p), 0) + gzipSync(html).length };

const total = files.reduce((a, f) => a + f.bytes, 0);
const out = { date: new Date().toISOString(), total, devices: total - areas['changelog pictures (site only)'].bytes, files: files.length, areas, firstLoad,
  biggest: [...files].sort((a, b) => b.bytes - a.bytes).slice(0, 15) };
const MB = (b) => `${(b / 2 ** 20).toFixed(2)} MB`;
const old = arg('against') ? JSON.parse(readFileSync(arg('against'), 'utf8')) : null;
const d = (now, was) => (was == null ? '' : ` (${now >= was ? '+' : ''}${MB(now - was)})`);
console.log(`dist/: ${MB(out.total)} in ${out.files} files${d(out.total, old?.total)}; on the devices (no changelog pictures): ${MB(out.devices)}${d(out.devices, old?.devices)}`);
for (const [n, a] of Object.entries(areas)) if (a.files) console.log(`  ${n.padEnd(32)} ${MB(a.bytes).padStart(10)}${a.gzip ? `  gzip ${MB(a.gzip)}` : ''}  ${a.files} files${d(a.bytes, old?.areas?.[n]?.bytes)}`);
console.log(`  first load (index.html and what it asks for): ${MB(firstLoad.bytes)}, gzip ${MB(firstLoad.gzip)}${d(firstLoad.gzip, old?.firstLoad?.gzip)}`);
console.log('  biggest:'); for (const f of out.biggest) console.log(`    ${MB(f.bytes).padStart(10)}  ${f.path}`);
if (arg('out')) writeFileSync(arg('out'), JSON.stringify(out, null, 2));
