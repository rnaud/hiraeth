// The sequences, the web against Unity beat by beat (issue #429; engine/sequences.js, docs/systems/engine-bridge.md
// "Sequences"): every sequence played in muted headless Chrome against its own Vite (the page's own clock, Chrome's keys,
// each beat photographed and its state probed), in the engines' bundle in node (the state stream alone), and in the Unity
// editor's batch run (-sequence <id>: Unity's pictures, its state in the log); then each beat's pictures side by side with
// their SSIM, the three streams against each other, one sheet a sequence, an overview and a report.
//
//   node scripts/unity-compare/sequences.mjs [all] [ids,…] [--out dir]    everything, the Unity runs under the build lock
//   node scripts/unity-compare/sequences.mjs web [ids,…] [--out dir]      the web's pictures and stream (<out>/web, web.json)
//   node scripts/unity-compare/sequences.mjs engine [ids,…] [--out dir]   the engines' stream in node (engine.json)
//   node scripts/unity-compare/sequences.mjs unity [ids,…] [--out dir]    Unity's pictures and stream (<out>/unity, unity.json)
//   node scripts/unity-compare/sequences.mjs sheet [--out dir]            the sheets and the report from what is there
//   node scripts/unity-compare/sequences.mjs record [--out dir]           the web's stream as the test's (tests/sequences-web.json)
// SIZE (both sides' screen, default 1280x720; 960x720 the Retroid's 4:3), PORT (the web's Vite, default 5429; never 5173), MAX_LOAD (25: waits while the 1-minute load is over it), LOCK (the Unity
// build lock, default .local-tools/handoff/unity-build.lock of the main checkout). Default out: output/sequences/<sha>.
import { spawnSync, execSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync, rmSync, copyFileSync } from 'node:fs';
import { dirname, join, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SEQUENCES, webQuery, compareStreams, listedDiff } from '../../engine/sequences.js';
import { STREAM_DIFFS } from '../../engine/bridge-gaps.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
export const FIXTURE = join(ROOT, 'tests/sequences-web.json');
const argv = process.argv.slice(2), arg = (n, d) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : d; };
const pos = argv.filter((a, i) => !a.startsWith('--') && !argv[i - 1]?.startsWith('--'));
const MODES = ['all', 'web', 'engine', 'unity', 'sheet', 'record'];
const mode = MODES.includes(pos[0]) ? pos.shift() : 'all';
const ids = pos[0] ? pos[0].split(',') : null;
const picked = SEQUENCES.filter((s) => !ids || ids.includes(s.id));
const sha = execSync('git rev-parse --short HEAD', { cwd: ROOT }).toString().trim();
const OUT = resolve(arg('out', join(ROOT, 'output/sequences', sha)));
const MAX_LOAD = +(process.env.MAX_LOAD ?? 25);
// (SIZE=960x720: the web's page that size, as SCREEN=960x720 has Unity's: the Retroid's 4:3 side by side, issue #264)
const SIZE = String(process.env.SIZE ?? '1280x720').split('x').map(Number);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const load = () => +execSync('uptime').toString().match(/load averages?:\s*([\d.]+)/)[1];
const rest = async () => { while (load() > MAX_LOAD) { console.log(`load ${load()}: resting`); await sleep(60000); } };
const readJson = (f, d = {}) => (existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : d);
/** Merge a side's new results into its stream file (a run of a few sequences keeps the others). */
const keep = (file, res) => writeFileSync(file, JSON.stringify({ ...readJson(file), ...res }, null, 1));

// ------------------------------------------------------------------ the web
const KEYS = { KeyE: ['e', 69], KeyQ: ['q', 81], KeyP: ['p', 80], KeyN: ['n', 78], KeyF: ['f', 70], KeyW: ['w', 87], KeyJ: ['j', 74], Tab: ['Tab', 9], Space: [' ', 32], Enter: ['Enter', 13], Escape: ['Escape', 27], Digit1: ['1', 49], Digit2: ['2', 50], ShiftLeft: ['Shift', 16] };

async function web() {
  const PORT = Number(process.env.PORT ?? 5429);
  if (PORT === 5173) throw new Error('5173 is the author\'s own dev server');
  const dir = join(OUT, 'web');
  mkdirSync(dir, { recursive: true });
  await rest();
  const { chrome } = await import('../cinematics-qc.mjs');
  const { viteCacheDir } = await import('../temp-dirs.mjs');
  const { createServer } = await import('vite');
  const server = await createServer({ root: ROOT, configFile: join(ROOT, 'vite.config.js'), cacheDir: viteCacheDir('sequences'), logLevel: 'error', clearScreen: false,
    server: { port: PORT, strictPort: true, host: '127.0.0.1', hmr: false, watch: null } });
  await server.listen();
  const base = `http://127.0.0.1:${PORT}/`;
  const res = {};
  try {
    for (const seq of picked) {
      const c = await chrome({ size: SIZE });
      const out = (res[seq.id] = { beats: [], errors: [] });
      const t0 = Date.now();
      try {
        await c.send('Page.navigate', { url: `${base}manifest.webmanifest` }); await sleep(300);
        await c.ev(`localStorage.clear(); sessionStorage.clear(); localStorage.setItem('hiraeth.settings.v1', JSON.stringify({ quality: 'high', showFps: false })); true`);
        await c.send('Page.navigate', { url: `${base}${webQuery(seq.setup)}` });
        let up = false;
        for (let i = 0; i < 900 && !up; i++) { try { up = await c.ev('!!window.__hiraethBooted && !document.getElementById("loading")'); } catch { /* loading */ } if (!up) await sleep(250); }
        if (!up) throw new Error(`the page never came up: ${c.errors.at(-1) ?? ''}`);
        // (a review: the page stages its cinematic itself, src/cinematics-page/runtime.js startReview)
        if (seq.setup.review) for (let i = 0; i < 240; i++) { const st = await c.ev('window.cinematicReview?.status ?? ""'); if (/^(Playing|Could not)/.test(st)) { if (st.startsWith('Could')) out.errors.push(st); break; } await sleep(250); }
        // (the module fetched again once if Vite was still optimizing a dependency: a fresh server's first page can miss it)
        await c.ev(`(async () => { let S; try { S = await import('/engine/sequences.js'); } catch { await new Promise((r) => setTimeout(r, 1500)); S = await import('/engine/sequences.js?again'); } window.__seqM = S; S.mapAtOnce?.(); window.__seqG = S.webGame(window); window.__seq = new S.SequenceRun(window.__seqG, S.sequenceById(${JSON.stringify(seq.id)})); window.__seqT = window.clock(); window.__seqR = performance.now(); return true; })()`);
        const pause = (on) => c.ev(`(() => { window.cinematicReview = Object.assign(window.cinematicReview ?? {}, { paused: ${on} }); return true; })()`);
        for (;;) {
          if (Date.now() - t0 > 420000) { out.errors.push('timed out'); break; }
          // (the game's own clock, but the page's while a menu holds the game still: the menus' beats wait in real time)
          const r = await c.ev(`(() => { const now = window.clock(), real = performance.now(), held = !!(window.menu?.open || window.journal?.open || window.minigame?.paused || document.getElementById('changelog')?.classList.contains('open'));
            const dt = Math.max(0, Math.min(0.25, held ? (real - window.__seqR) / 1000 : now - window.__seqT)); window.__seqT = now; window.__seqR = real; const r = window.__seq.tick(dt);
            // (the page's CSS fades and pops on the same clock: headless Chrome draws slowly, the game's time ran at a
            // fraction of the wall's and the transitions ran ahead, the take-off's warp card whole a beat early, issue #264)
            for (const a of document.getAnimations()) { if (a.playState === 'running') a.pause(); if (a.playState === 'paused') a.currentTime = (a.currentTime ?? 0) + dt * 1000; }
            if (r?.record) { window.cinematicReview = Object.assign(window.cinematicReview ?? {}, { paused: true }); return { record: r.record.name, late: r.late, t: +window.__seq.time.toFixed(2), probe: window.__seqM.probe(window.__seqG) }; }
            return r ? { keys: r.keys, done: r.done } : null; })()`);
          if (r?.done) break;
          for (const [code, down] of r?.keys ?? []) {
            const [key, vk] = KEYS[code] ?? [code, 0];
            await c.send('Input.dispatchKeyEvent', { type: down ? 'keyDown' : 'keyUp', key, code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk, text: down && key.length === 1 ? key : undefined });
          }
          if (r?.record) {
            await sleep(250);   // (the paused frame drawn)
            const shot = await c.send('Page.captureScreenshot', { format: 'png' });
            writeFileSync(join(dir, `web-${seq.id}-${r.record}.png`), Buffer.from(shot.data, 'base64'));
            out.beats.push({ beat: r.record, t: r.t, late: r.late, ...r.probe });
            await pause(false);
          }
          await sleep(40);
        }
        out.errors.push(...(await c.ev('window.__seq.errors')));
      } catch (e) { out.errors.push(String(e?.message ?? e)); }
      out.pageErrors = c.errors.slice(0, 10);
      await c.close();
      console.log(`web ${seq.id}: ${out.beats.length} beats in ${((Date.now() - t0) / 1000).toFixed(0)} s${out.errors.length ? ` (${out.errors.join('; ')})` : ''}`);
      keep(join(OUT, 'web.json'), { [seq.id]: out });
    }
  } finally { await server.close(); }
  return res;
}

// ------------------------------------------------------------------ the engines' bundle in node
async function engine() {
  const { runAll } = await import('../../engine/sequence-run.mjs');
  const res = await runAll(picked.map((s) => s.id), { log: (m) => { if (/:/.test(m)) console.log(`engine ${m}`); } });
  keep(join(OUT, 'engine.json'), res);
  return res;
}

// ------------------------------------------------------------------ Unity
const LOCK = process.env.LOCK ?? '/Users/anf/projects/moebius/.local-tools/handoff/unity-build.lock';
async function takeLock() {
  for (;;) {
    // (held as a file, or as a directory with an `owner` file: unity.mjs's form, which read as a file threw EISDIR)
    const holder = () => { try { return readFileSync(LOCK, 'utf8').trim(); } catch { try { return readFileSync(join(LOCK, 'owner'), 'utf8').trim(); } catch { return ''; } } };
    try { writeFileSync(LOCK, `sequences.mjs (#429) pid ${process.pid} ${new Date().toISOString()}\n`, { flag: 'wx' }); return; } catch { console.log(`the Unity lock is held: ${holder()}; waiting`); await sleep(60000); }
  }
}
const giveLock = () => { try { if (readFileSync(LOCK, 'utf8').includes(`pid ${process.pid} `)) rmSync(LOCK); } catch { /* gone */ } };
process.on('SIGINT', () => { giveLock(); process.exit(130); });

async function unity() {
  const dir = join(OUT, 'unity');
  mkdirSync(dir, { recursive: true });
  const res = {};
  for (const seq of picked) {
    await rest();
    await takeLock();
    const t0 = Date.now();
    try {
      // (-screen: the camera drawn into a 1280 × 720 screen all along, not the editor's 4:3 batch window: the menus were laid
      // out for that window's 960 units and photographed at the left of a 1280 picture, six Items tiles a row, issue #264;
      // SCREEN=960x720 photographs the Retroid's 4:3)
      spawnSync(join(ROOT, 'scripts/unity-js-run.sh'), [`seq-${seq.id}`, '-sequence', seq.id, '-out', dir, '-quality', 'high', '-screen', process.env.SCREEN ?? process.env.SIZE ?? '1280x720'],
        { cwd: ROOT, env: { ...process.env, LIMIT: process.env.LIMIT ?? '600', TAIL: '5' }, encoding: 'utf8' });
    } finally { giveLock(); }
    const log = join(ROOT, `output/engine-bridge/unity-seq-${seq.id}.log`), out = (res[seq.id] = { beats: [], errors: [] });
    if (existsSync(log)) {
      copyFileSync(log, join(dir, `${seq.id}.log`));
      for (const l of readFileSync(log, 'utf8').split('\n')) {
        const m = l.match(/\[unity\] seq (\S+) (\S+) (\{.*\})\s*$/);
        if (m && m[1] === seq.id) { try { out.beats.push(JSON.parse(m[3])); } catch { out.errors.push(`${m[2]}: the log's line cut`); } }
        const e = l.match(/\[unity\] seq error: (.*)/) ?? l.match(/(C# Exception.*|\[unity\] the game failed.*)/);
        if (e) out.errors.push(e[1].slice(0, 200));
      }
    } else out.errors.push('no log');
    console.log(`unity ${seq.id}: ${out.beats.length} of ${seq.beats.length} beats in ${((Date.now() - t0) / 1000).toFixed(0)} s${out.errors.length ? ` (${out.errors.slice(0, 3).join('; ')})` : ''}`);
    keep(join(OUT, 'unity.json'), { [seq.id]: out });
  }
  return res;
}

// ------------------------------------------------------------------ the sheets and the report
async function sheet() {
  const sharp = (await import('sharp')).default;
  const { raw, ssim } = await import('./measure.mjs');
  const W = readJson(join(OUT, 'web.json')), U = readJson(join(OUT, 'unity.json')), E = readJson(join(OUT, 'engine.json'));
  const sheets = join(OUT, 'sheets');
  mkdirSync(sheets, { recursive: true });
  const esc = (s) => String(s ?? '').replace(/[&<>]/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[m]);
  const pic = (side, id, beat) => join(OUT, side, `${side}-${id}-${beat}.png`);
  const tile = async (f, w, h) => (existsSync(f) ? sharp(f).resize(w, h, { fit: 'fill' }).removeAlpha().png().toBuffer()
    : sharp({ create: { width: w, height: h, channels: 3, background: '#3a2020' } }).png().toBuffer());
  const scores = {};
  const unify = (s) => Object.fromEntries(Object.entries(s).map(([k, v]) => [k, { beats: v.beats ?? [] }]));
  const diffU = compareStreams(unify(W), unify(U)), diffE = compareStreams(unify(W), unify(E));
  const overRows = [];
  for (const seq of SEQUENCES) {
    if (!W[seq.id] && !U[seq.id]) continue;
    const rows = [], Wd = 640, Hd = Math.round(640 * SIZE[1] / SIZE[0]), LAB = 28, beats = seq.beats.map((b) => b.name);
    scores[seq.id] = {};
    for (const [i, b] of beats.entries()) {
      const a = pic('web', seq.id, b), u = pic('unity', seq.id, b);
      let s = null;
      if (existsSync(a) && existsSync(u)) s = +ssim(await raw(a, 256, 144, true), await raw(u, 256, 144, true), 256, 144).toFixed(3);
      scores[seq.id][b] = s;
      const top = LAB * 2 + i * (Hd + LAB) + LAB;
      rows.push({ input: await tile(a, Wd, Hd), left: 0, top }, { input: await tile(u, Wd, Hd), left: Wd + 8, top });
    }
    const total = LAB * 2 + beats.length * (Hd + LAB);
    const labels = beats.map((b, i) => {
      const d = diffU.filter((x) => x.seq === seq.id && x.beat === b && !listedDiff(STREAM_DIFFS, x)).map((x) => x.key).slice(0, 6).join(' ');
      return `<text x="8" y="${LAB * 2 + i * (Hd + LAB) + 20}" font-size="17" font-family="Helvetica" fill="#eee">${i + 1}. ${esc(b)} · SSIM ${scores[seq.id][b] ?? '—'}${d ? ` · ${esc(d)}` : ''}</text>`;
    }).join('');
    const svg = `<svg width="${Wd * 2 + 8}" height="${total}" xmlns="http://www.w3.org/2000/svg"><text x="8" y="36" font-size="22" font-family="Helvetica" font-weight="bold" fill="#fff">${esc(seq.title)}: web (left) · Unity (right)</text>${labels}</svg>`;
    await sharp({ create: { width: Wd * 2 + 8, height: total, channels: 3, background: '#161616' } }).composite([{ input: Buffer.from(svg), left: 0, top: 0 }, ...rows]).jpeg({ quality: 72 }).toFile(join(sheets, `${seq.id}.jpg`));
    overRows.push({ seq, beats });
  }
  // the overview: a row a sequence, each beat's web over Unity
  const tw = 192, th = 108, lw = 230, maxB = Math.max(1, ...overRows.map((r) => r.beats.length)), rh = th * 2 + 14;
  const comp = [], labels = [];
  for (const [r, { seq, beats }] of overRows.entries()) {
    labels.push(`<text x="6" y="${r * rh + 24}" font-size="14" font-family="Helvetica" font-weight="bold" fill="#fff">${esc(seq.id)}</text>`);
    for (const [i, b] of beats.entries()) {
      comp.push({ input: await tile(pic('web', seq.id, b), tw, th), left: lw + i * (tw + 4), top: r * rh }, { input: await tile(pic('unity', seq.id, b), tw, th), left: lw + i * (tw + 4), top: r * rh + th + 2 });
      labels.push(`<text x="${lw + i * (tw + 4) + 3}" y="${r * rh + 13}" font-size="11" font-family="Helvetica" fill="#ff0" stroke="#000" stroke-width="0.4">${esc(b)} ${scores[seq.id][b] ?? ''}</text>`);
    }
  }
  const OW = lw + maxB * (tw + 4), OH = Math.max(1, overRows.length * rh);
  comp.push({ input: Buffer.from(`<svg width="${OW}" height="${OH}" xmlns="http://www.w3.org/2000/svg">${labels.join('')}</svg>`), left: 0, top: 0 });
  await sharp({ create: { width: OW, height: OH, channels: 3, background: '#161616' } }).composite(comp).jpeg({ quality: 70 }).toFile(join(OUT, 'overview.jpg'));
  // the report
  const L = [`# Sequences, the web against Unity (${sha})`, '', `Overview: ${relative(OUT, join(OUT, 'overview.jpg'))}; a sheet a sequence in sheets/. SSIM of each beat's pictures (grey, 256 × 144; 1 the same).`,
    'The streams: what the screen shows as data (engine/sequences.js probe), the web\'s against Unity\'s and against the engines\' bundle in node; differences named in engine/bridge-gaps.js STREAM_DIFFS are marked.', ''];
  L.push('| sequence | beats (web / Unity / node) | lowest SSIM | unlisted differences (Unity) | errors |', '|---|---|---|---|---|');
  for (const seq of SEQUENCES) {
    if (!scores[seq.id]) continue;
    const s = Object.entries(scores[seq.id]).filter(([, v]) => v != null).sort((a, b) => a[1] - b[1]);
    const n = diffU.filter((x) => x.seq === seq.id && !listedDiff(STREAM_DIFFS, x)).length;
    const err = [...(W[seq.id]?.errors ?? []), ...(U[seq.id]?.errors ?? [])].slice(0, 2).join('; ');
    L.push(`| ${seq.id} | ${W[seq.id]?.beats?.length ?? 0} / ${U[seq.id]?.beats?.length ?? 0} / ${E[seq.id]?.beats?.length ?? 0} | ${s[0] ? `${s[0][1]} (${s[0][0]})` : '—'} | ${n} | ${esc(err).slice(0, 120)} |`);
  }
  for (const [name, D] of [['Unity', diffU], ['the engines\' bundle in node', diffE]]) {
    L.push('', `## The web against ${name}`, '');
    for (const seq of SEQUENCES) {
      const ds = D.filter((x) => x.seq === seq.id);
      if (!ds.length) continue;
      L.push(`**${seq.id}**`, '');
      for (const d of ds) { const e = listedDiff(STREAM_DIFFS, d); L.push(`- ${d.beat}: \`${d.key}\` web ${JSON.stringify(d.web)?.slice(0, 140)} · ${name === 'Unity' ? 'Unity' : 'node'} ${JSON.stringify(d.engine)?.slice(0, 140)}${e ? ` (listed: ${e.status}${e.issue ? ` #${e.issue}` : ''})` : ' **(unlisted)**'}`); }
      L.push('');
    }
  }
  writeFileSync(join(OUT, 'report.md'), L.join('\n'));
  writeFileSync(join(OUT, 'scores.json'), JSON.stringify(scores, null, 1));
  console.log(`the overview: ${join(OUT, 'overview.jpg')}\nthe report: ${join(OUT, 'report.md')}`);
}

/** The web's stream as the test's fixture: what tests/sequences.test.js holds the engines' bundle to. */
function record() {
  const W = readJson(join(OUT, 'web.json'));
  const was = readJson(FIXTURE, { sequences: {} });
  const seqs = { ...was.sequences };
  for (const [id, v] of Object.entries(W)) if (v.beats?.length) seqs[id] = { beats: v.beats.map(({ t, late, ...b }) => ({ ...b, late })) };
  writeFileSync(FIXTURE, `${JSON.stringify({ recorded: new Date().toISOString().slice(0, 10), sha, how: 'node scripts/unity-compare/sequences.mjs web [ids] && node scripts/unity-compare/sequences.mjs record', sequences: seqs }, null, 2)}\n`);   // (two spaces, as the fixture is kept)
  console.log(`wrote ${relative(ROOT, FIXTURE)}: ${Object.keys(seqs).length} sequences`);
}

mkdirSync(OUT, { recursive: true });
if (mode === 'web' || mode === 'all') await web();
if (mode === 'engine' || mode === 'all') await engine();
if (mode === 'unity' || mode === 'all') await unity();
if (mode === 'sheet' || mode === 'all') await sheet();
if (mode === 'record') record();
console.log(`out: ${OUT}`);
process.exit(0);
