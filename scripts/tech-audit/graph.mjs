// Frame-time graphs from scripts/tech-audit/play.mjs recordings (docs/audits/technical-v2.28.md): per world, the frame
// interval over the minute of play, the phases shaded and named, 16.7 and 33.3 ms marked, a frame past the top drawn to
// the top with its time written; one recording or two overlaid (before grey, after in colour). Small WebP (sharp).
//   node scripts/tech-audit/graph.mjs <after.json> [--before before.json] [--worlds desert,arzach] [--top 50]
//        [--phases spin] [--out dir] [--w 900] [--h 220] [--metric buf] [--run 1]   (run: one run of ab.mjs's several; buf: MB of buffers uploaded a frame, not its time)
import { readFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';

const args = process.argv.slice(2), arg = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const after = JSON.parse(readFileSync(args[0], 'utf8')), before = arg('before') ? JSON.parse(readFileSync(arg('before'), 'utf8')) : null;
const METRIC = arg('metric', 'ms'), UNIT = METRIC === 'buf' ? 'MB uploaded' : 'frame time, ms', VAL = METRIC === 'buf' ? (f) => f.buf / 1e6 : (f) => f.ms;
const TOP = +arg('top', METRIC === 'buf' ? 40 : 50), W = +arg('w', 900), H = +arg('h', 220), OUT = arg('out', '.'), RUN = arg('run') ? +arg('run') : null, ONLY = arg('worlds')?.split(','), PH = arg('phases')?.split(',');
mkdirSync(OUT, { recursive: true });
const L = 44, R = 10, T = 22, B = 22, pw = W - L - R, ph = H - T - B;
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');

/** [t (ms from the start), ms] of a world's frames, only the phases asked for (their time kept continuous). */
function series(w) {
  let t = 0; const out = [];
  for (const f of w.frames) { if (!PH || PH.includes(f.phase)) { out.push([t, VAL(f), f.phase]); t += f.ms; } }
  return out;
}
const y = (ms) => T + ph - Math.min(ms, TOP) / TOP * ph;
function path(s, span) {
  // (one point per pixel column: the worst frame in it, so a hitch is never averaged away)
  const cols = new Map();
  for (const [t, ms] of s) { const x = Math.round(L + t / span * pw); cols.set(x, Math.max(cols.get(x) ?? 0, ms)); }
  return [...cols].map(([x, ms], i) => `${i ? 'L' : 'M'}${x},${y(ms).toFixed(1)}`).join('');
}

for (const w of after.worlds) {
  if (!w.frames || (ONLY && !ONLY.includes(w.world)) || (RUN && w.run !== RUN)) continue;
  const a = series(w), bw = before?.worlds.find((x) => x.world === w.world && (!RUN || x.run === RUN)), b = bw?.frames ? series(bw) : null;
  const span = Math.max(a.at(-1)?.[0] ?? 1, b?.at(-1)?.[0] ?? 1);
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" font-family="Helvetica,Arial" font-size="11"><rect width="100%" height="100%" fill="#fbf7ee"/>`;
  // the phases, shaded in turn and named
  let start = 0, cur = a[0]?.[2], k = 0;
  const band = (from, to, name) => { const x0 = L + from / span * pw, x1 = L + to / span * pw; svg += `<rect x="${x0}" y="${T}" width="${x1 - x0}" height="${ph}" fill="${k++ % 2 ? '#efe7d6' : '#f6f0e3'}"/><text x="${x0 + 3}" y="${T + 11}" fill="#8a7d66">${esc(name)}</text>`; };
  for (const [t, , p] of a) { if (p !== cur) { band(start, t, cur); start = t; cur = p; } }
  band(start, span, cur);
  for (const [ms, c] of METRIC === 'buf' ? [[10, '#c98b3c']] : [[16.7, '#7aa36f'], [33.3, '#c98b3c']]) svg += `<line x1="${L}" x2="${W - R}" y1="${y(ms)}" y2="${y(ms)}" stroke="${c}" stroke-dasharray="4 3"/><text x="${L - 4}" y="${y(ms) + 4}" text-anchor="end" fill="${c}">${ms}</text>`;
  svg += `<text x="${L - 4}" y="${T + 4}" text-anchor="end" fill="#555">${TOP}</text><text x="${L - 4}" y="${T + ph + 4}" text-anchor="end" fill="#555">0</text>`;
  if (b) svg += `<path d="${path(b, span)}" fill="none" stroke="#9a9a9a" stroke-width="1"/>`;
  svg += `<path d="${path(a, span)}" fill="none" stroke="#b5452f" stroke-width="1"/>`;
  // past the top: the time written by it
  const over = (s, c) => { let lastX = -99, row = 0; for (const [t, ms] of s) if (ms > TOP) { const x = L + t / span * pw + 2; row = x - lastX < 26 ? row + 1 : 0; lastX = x; svg += `<text x="${x}" y="${T + 10 + (c === '#9a9a9a' ? 11 : 0) + row * 22}" fill="${c}" font-weight="bold">${Math.round(ms)}</text>`; } };
  if (b) over(b, '#9a9a9a');
  over(a, '#b5452f');
  const s = w.summary.all, sb = bw?.summary?.all;
  const label = (x, c) => `${x.fps_mean} fps mean · 1% low ${x.low1_fps} · p99 ${x.p99} ms · worst ${x.worst} ms · stutters ${x.stutters}`;
  svg += `<text x="${L}" y="14" font-weight="bold" fill="#222">${esc(w.world)} · ${UNIT} (${after.preset}, ${after.res}${after.paced ? ', 60 Hz' : ', uncapped'})</text>`;
  svg += `<text x="${W - R}" y="14" text-anchor="end" fill="#b5452f">${esc(label(s))}</text>`;
  if (sb) svg += `<text x="${W - R}" y="${H - 6}" text-anchor="end" fill="#7a7a7a">before: ${esc(label(sb))}</text>`;
  svg += `<text x="${L}" y="${H - 6}" fill="#555">${(span / 1000).toFixed(0)} s of play</text></svg>`;
  const file = join(OUT, `${METRIC === 'buf' ? 'uploads' : 'frametime'}-${w.world}${PH ? `-${PH.join('-')}` : ''}.webp`);
  await sharp(Buffer.from(svg)).webp({ quality: 82 }).toFile(file);
  console.log(file);
}
