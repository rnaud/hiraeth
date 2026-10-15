// The table of a deck-engines.mjs run: per world and engine, the warm run's fps (the median of its views' and walks',
// the worst one's), the 5 % and 1 % lows (1000 / the 95th and 99th percentile frame of all its frames), the frame's p95 /
// p99, the share of frames over 16.7 ms (under 60 fps), stalls (frames over 50 ms, and the longest), the walk's own p99 and longest, the loads (cold, warm: the web's
// navigation to its first frame, the player's launch to its world settled), the memory's
// peak (the processes' PSS; the GPU's VRAM + GTT over what was used before the launch).
//   node scripts/bench/deck-engines-summary.mjs <out dir> [--json]
import { readFileSync, existsSync, writeFileSync } from 'node:fs';

const OUT = process.argv[2];
const meta = JSON.parse(readFileSync(`${OUT}/meta.json`, 'utf8'));
const q = (a, f) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(s.length * f))] : NaN; };
const fpsOf = (raw) => raw.length / (raw.reduce((a, b) => a + b, 0) / 1000);
const r1 = (x) => (Number.isFinite(x) ? +x.toFixed(1) : null);

function memory(file, gpu0) {
  if (!existsSync(file)) return {};
  let pss = 0, gpu = 0;
  for (const l of readFileSync(file, 'utf8').trim().split('\n')) {
    const [, p, , v, g] = l.split(' ');
    if (p !== '-' && +p > pss) pss = +p;
    if (+v + +g > gpu) gpu = +v + +g;
  }
  return { pssMB: Math.round(pss / 1024), gpuMB: gpu0 ? Math.round((gpu - gpu0) / 1048576) : null };
}

function web(world) {
  const dir = `${OUT}/web/${world}-warm`, f = `${dir}/deck-worlds.json`;
  if (!existsSync(f)) return null;
  const run = JSON.parse(readFileSync(f, 'utf8')).runs[0];
  if (!run?.views) return { error: run?.error ?? 'no views' };
  const items = run.views.map((v) => ({ name: v.name, kind: v.kind, raw: v.raw.frame, draws: v.draws, js: v.cpu?.median, gpu: v.gpu?.median }));
  return { items, load: { cold: meta[`web/${world}-cold`]?.load, warm: meta[`web/${world}-warm`]?.load, page: meta[`web/${world}-warm`]?.page }, mem: memory(`${dir}/memory.txt`, meta[`web/${world}-warm`]?.gpu0) };
}

function unityLoad(dir) {
  const f = `${dir}/unity.log`;
  if (!existsSync(f)) return null;
  const t = readFileSync(f, 'utf8');
  const node = t.match(/load: first node (\d+) ms after launch/), set = t.match(/load: world settled (\d+) ms after launch[^\n]*longest (\d+) ms, (\d+) over 50 ms/);
  return { firstNode: node ? +node[1] / 1000 : null, settled: set ? +set[1] / 1000 : null, longest: set ? +set[2] : null, over50: set ? +set[3] : null };
}

function unity(world) {
  const dir = `${OUT}/unity/${world}-warm`, f = `${dir}/unity-bench.json`;
  if (!existsSync(f)) return null;
  const res = JSON.parse(readFileSync(f, 'utf8')).results;
  const last = new Map();
  for (const r of res) last.set(r.view, r);   // (each view's second pass)
  const items = [...last.values()].filter((r) => r.raw?.length).map((r) => ({ name: r.view, kind: r.view === 'walk' || /^(ride|walk)-/.test(r.view) ? 'path' : 'view', raw: r.raw, draws: r.drawn, js: r.vm, gpu: r.gpu }));
  return { items, load: { cold: unityLoad(`${OUT}/unity/${world}-cold`), warm: unityLoad(dir) }, mem: memory(`${dir}/memory.txt`, meta[`unity/${world}-warm`]?.gpu0) };
}

function row(e) {
  if (!e?.items?.length) return null;
  const all = e.items.flatMap((i) => i.raw), fps = e.items.map((i) => fpsOf(i.raw)), paths = e.items.filter((i) => i.kind === 'path').flatMap((i) => i.raw);
  return {
    fps: r1(q(fps, 0.5)), worst: r1(Math.min(...fps)), worstView: e.items[fps.indexOf(Math.min(...fps))].name,
    low5: r1(1000 / q(all, 0.95)), low1: r1(1000 / q(all, 0.99)), p95: r1(q(all, 0.95)), p99: r1(q(all, 0.99)),
    over60: r1(all.filter((x) => x > 16.7).length / all.length * 100), stalls: all.filter((x) => x > 50).length, longest: r1(Math.max(...all)), walkP99: paths.length ? r1(q(paths, 0.99)) : null, walkMax: paths.length ? r1(Math.max(...paths)) : null,
    js: r1(q(e.items.map((i) => i.js).filter(Number.isFinite), 0.5)), gpu: r1(q(e.items.map((i) => i.gpu).filter(Number.isFinite), 0.5)), draws: Math.round(q(e.items.map((i) => i.draws).filter(Number.isFinite), 0.5)),
    views: Object.fromEntries(e.items.map((i, k) => [i.name, r1(fps[k])])), load: e.load, mem: e.mem,
  };
}

const worlds = [...new Set(Object.keys(meta).map((k) => k.split('/')[1].replace(/-(cold|warm)$/, '')))];
const table = {};
for (const w of worlds) table[w] = { web: row(web(w)), unity: row(unity(w)) };
writeFileSync(`${OUT}/summary.json`, JSON.stringify(table, null, 1));
const L = (l) => (l == null ? '–' : l);
console.log('| world | engine | fps (worst view) | 5 % / 1 % low | p95 / p99 ms | under 60 % | >50 ms (longest) | walk p99 / max | load cold / warm s | PSS / GPU MB |');
console.log('|---|---|---|---|---|---|---|---|---|---|');
for (const [w, t] of Object.entries(table)) for (const eng of ['web', 'unity']) {
  const r = t[eng];
  if (!r) { console.log(`| ${w} | ${eng} | – |`); continue; }
  const ld = eng === 'web' ? `${L(r.load.cold)} / ${L(r.load.warm)}` : `${L(r.load.cold?.settled)} / ${L(r.load.warm?.settled)}`;
  console.log(`| ${w} | ${eng} | ${r.fps} (${r.worst} ${r.worstView}) | ${r.low5} / ${r.low1} | ${r.p95} / ${r.p99} | ${r.over60} | ${r.stalls} (${r.longest}) | ${L(r.walkP99)} / ${L(r.walkMax)} | ${ld} | ${L(r.mem?.pssMB)} / ${L(r.mem?.gpuMB)} |`);
}
for (const [w, t] of Object.entries(table)) if (t.web && t.unity) {
  const bad = Object.entries(t.unity.views).filter(([n, f]) => t.web.views[n] != null && f < t.web.views[n]).map(([n, f]) => `${n} ${f} < ${t.web.views[n]}`);
  console.log(`${w}: unity ${t.unity.fps} vs web ${t.web.fps}${t.unity.fps < t.web.fps ? '  ** BELOW **' : ''}${bad.length ? '; views below: ' + bad.join(', ') : ''}`);
}
