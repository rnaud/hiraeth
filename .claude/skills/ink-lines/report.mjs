// The ink-lines audit's report (.claude/skills/ink-lines/SKILL.md): capture.mjs's report.json (and the one before a
// fix, if given) as tables: each scene's score at each resolution, the worst pictures with their failing checks, and
// the measures that matter most (plants' ink, the traveller's eyes, the lines' width on small things, the shimmer),
// before → after. Prints markdown, or writes it into --out (the measured part of docs/audits/ink-lines-v<version>.md:
// the findings and fixes are written by hand round it, between the markers).
//
//   node .claude/skills/ink-lines/report.mjs <after>/report.json [--before <before>/report.json] [--out docs/audits/ink-lines-v1.34.md]
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const L = await import(join(resolve(dirname(fileURLToPath(import.meta.url)), '../../..'), 'scripts/ink-lines/lib.mjs'));

const args = process.argv.slice(2), arg = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const A = JSON.parse(readFileSync(args[0], 'utf8')), B = arg('before') ? JSON.parse(readFileSync(arg('before'), 'utf8')) : null;
// (graded again with the rubric as it is now: a capture keeps its measures, the rubric may have moved since)
for (const R of [A, B].filter(Boolean)) { const ref = R.rows.find((x) => x.res === 'desk1080' && x.scene === 'portrait-1'); for (const row of R.rows) if (row.metrics) Object.assign(row, L.grade(row, row.metrics.eyes ? ref : null)); }
const RES = Object.keys(A.resolutions), SCENES = [...new Set(A.rows.map((r) => r.scene))];
const find = (R, s, r) => R?.rows.find((x) => x.scene === s && x.res === r);
const f = (v, d = 2) => (Number.isFinite(v) ? v.toFixed(d) : '–');
const pct = (v) => (Number.isFinite(v) ? `${(v * 100).toFixed(1)} %` : '–');
const ba = (b, a, fmt = f) => (B ? `${fmt(b)} → ${fmt(a)}` : fmt(a));
const refShare = (R) => { const r = R?.rows.find((x) => x.res === 'desk1080' && x.scene === 'portrait-1'); return r?.metrics?.eyes ? r.metrics.eyes.reduce((s, e) => s + e.share, 0) / r.metrics.eyes.length : NaN; };
const eyeG = (R, row) => (row?.metrics?.eyes?.length ? row.metrics.eyes.reduce((s, e) => s + e.share, 0) / row.metrics.eyes.length / refShare(R) : NaN);
const eyeD = (row) => (row?.metrics?.eyes?.length ? row.metrics.eyes.reduce((s, e) => s + e.density, 0) / row.metrics.eyes.length : NaN);
const mean = (R) => { const v = R.rows.map((r) => r.score).filter(Number.isFinite); return v.reduce((a, b) => a + b, 0) / Math.max(v.length, 1); };

const out = [];
out.push(`Captured ${A.date.slice(0, 10)} at ${A.commit}${B ? ` (before: ${B.commit})` : ''}; ${A.rows.length} pictures, ${A.seconds} s.`, '');
out.push(`**Mean score** (of 5, every scene at every resolution): ${B ? `${f(mean(B))} → ` : ''}**${f(mean(A))}**`, '');
out.push('### Scores (of 5) by scene and resolution', '');
out.push(`| scene | ${RES.join(' | ')} |`, `|---|${RES.map(() => '---').join('|')}|`);
for (const s of SCENES) out.push(`| ${s} | ${RES.map((r) => ba(find(B, s, r)?.score, find(A, s, r)?.score)).join(' | ')} |`);
out.push('', '### Plants: ink share / near-black share / line width (median, p90 px) / height on screen', '');
out.push(`| scene | res | ink | dark | width | height px |`, '|---|---|---|---|---|---|');
for (const s of SCENES.filter((s) => A.rows.find((r) => r.scene === s)?.kind === 'foliage')) for (const r of RES) {
  const a = find(A, s, r)?.metrics, b = find(B, s, r)?.metrics;
  if (!a?.object?.n) continue;
  out.push(`| ${s} | ${r} | ${ba(b?.inkShare, a.inkShare, pct)} | ${ba(b?.darkShare, a.darkShare, pct)} | ${B ? `${b?.width?.median ?? '–'}/${b?.width?.p90 ?? '–'} → ` : ''}${a.width?.median ?? '–'}/${a.width?.p90 ?? '–'} | ${a.object.h} |`);
}
out.push('', '### The traveller: face height on screen (brow to chin), the eyes\' dark as a share of the face against the 1 m portrait at desk1080 (× ref: 1 keeps its proportion), their density (dark over the opening), the darkest eye pixel against the cheek (0 black), his near-black share', '');
out.push(`| scene | res | face px | eyes × ref | eye density | darkest | dark share |`, '|---|---|---|---|---|---|---|');
for (const s of SCENES.filter((s) => s.startsWith('portrait'))) for (const r of RES) {
  const a = find(A, s, r), b = find(B, s, r);
  if (!a?.metrics) continue;
  const dk = (row) => (row?.metrics?.eyes?.length ? Math.min(...row.metrics.eyes.map((e) => e.darkest)) : NaN);
  out.push(`| ${s} | ${r} | ${f(a.metrics.facePx, 0)} | ${ba(eyeG(B, b), eyeG(A, a), (v) => f(v, 1))} | ${ba(eyeD(b), eyeD(a))} | ${ba(dk(b), dk(a))} | ${ba(b?.metrics?.darkShare, a.metrics.darkShare, pct)} |`);
}
out.push('', '### The whole frame: ink share, line width (median px), shimmer (change / pops a half pixel over)', '');
out.push(`| scene | res | frame ink | width | shimmer |`, '|---|---|---|---|---|');
for (const s of SCENES) for (const r of RES) {
  const a = find(A, s, r)?.metrics, b = find(B, s, r)?.metrics;
  if (!a) continue;
  out.push(`| ${s} | ${r} | ${ba(b?.frameInk, a.frameInk, pct)} | ${ba(b?.frameWidth?.median, a.frameWidth?.median, (v) => (v ?? '–'))} | ${ba(b?.shimmer?.change, a.shimmer?.change)} / ${ba(b?.shimmer?.pops, a.shimmer?.pops)} |`);
}
const worst = A.rows.filter((r) => Number.isFinite(r.score)).sort((a, b) => a.score - b.score).slice(0, 12);
out.push('', '### The worst pictures (failing and borderline checks)', '');
for (const r of worst) out.push(`- ${r.scene} @ ${r.res}: ${f(r.score)} — ${Object.entries(r.checks).filter(([, c]) => c.verdict < 1).map(([k, c]) => `${k} ${c.value}${c.verdict === 0 ? ' ✗' : ' ~'}`).join(', ') || 'all pass'}`);
const errs = A.rows.filter((r) => r.error);
if (errs.length) out.push('', '### Errors', '', ...errs.map((r) => `- ${r.scene} @ ${r.res}: ${r.error}`));
const md = out.join('\n') + '\n';

const dest = arg('out');
if (!dest) process.stdout.write(md);
else {
  const BEGIN = '<!-- ink-lines:measured -->', END = '<!-- /ink-lines:measured -->';
  const prev = existsSync(dest) ? readFileSync(dest, 'utf8') : `# Ink lines at every distance and resolution\n\n${BEGIN}\n${END}\n`;
  const i = prev.indexOf(BEGIN), j = prev.indexOf(END);
  writeFileSync(dest, i >= 0 && j > i ? prev.slice(0, i + BEGIN.length) + '\n' + md + prev.slice(j) : prev + `\n${BEGIN}\n${md}${END}\n`);
  console.log(`measures written into ${dest}`);
}
