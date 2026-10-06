// Does a conversation's portrait draw the person, or an empty circle? (TODO.md, Dialogue: "the
// speaker's portrait circle shows empty on the Retroid".) Opens a world in a headless, muted Chrome
// at a graphics preset and device pixel ratio, starts a talk, and measures the chip's image: its
// size, how many distinct colours it holds and how much of it the commonest colour takes. A drawn
// person is hundreds of colours with no colour over about half; an empty capture is one or none.
//
//   npx vite build && node scripts/bench/serve.mjs &
//   node scripts/portrait-check.mjs [--url http://localhost:5245/] [--level desert]
//     [--preset high|handheld|low] [--dpr 1|2|3] [--out dir]
//
// The Retroid runs Chrome 154 on an Adreno; this runs the same Chrome on the Mac's GPU, so it tells
// a software fault (the preset, the pixel ratio, the portrait's own path) from a driver one.
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };
const BASE = arg('url', 'http://localhost:5245/').replace(/\/?$/, '/');
const LEVEL = arg('level', 'desert'), PRESET = arg('preset', 'handheld'), DPR = +arg('dpr', 2);
const OUT = resolve(arg('out', join(tmpdir(), 'memento-portrait')));
const CDP = +arg('cdp', 6361);
const CHROME = process.env.CHROME ?? ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome'].find((p) => existsSync(p));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
mkdirSync(OUT, { recursive: true });

const profile = mkdtempSync(join(tmpdir(), 'memento-portrait-'));
const chrome = spawn(CHROME, ['--headless=new', '--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--mute-audio',
  '--window-size=1280,720', `--force-device-scale-factor=${DPR}`, '--no-first-run', '--no-default-browser-check',
  '--disable-background-timer-throttling', '--disable-renderer-backgrounding', `--remote-debugging-port=${CDP}`,
  `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' });

let ws, id = 0; const waits = new Map();
const send = (m, p = {}) => new Promise((res, rej) => { const i = ++id; waits.set(i, [res, rej]); ws.send(JSON.stringify({ id: i, method: m, params: p })); });
const ev = async (e) => {
  const r = await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(`${e.slice(0, 80)}: ${r.exceptionDetails.exception?.description}`);
  return r.result.value;
};
const until = async (e, secs = 240) => { for (let t = 0; t < secs * 4; t++) { try { if (await ev(e)) return true; } catch { /* loading */ } await sleep(250); } throw new Error(`timed out: ${e}`); };
const QUIET = `localStorage.setItem('moebius.muted','1'); localStorage.setItem('moebius.settings.v1', JSON.stringify({ music: 0, effects: 0, voices: 0, quality: '${PRESET}' }));`;
let bad = 0;
try {
  let tabs;
  for (let i = 0; i < 80; i++) { try { tabs = await (await fetch(`http://127.0.0.1:${CDP}/json`)).json(); break; } catch { await sleep(250); } }
  ws = new WebSocket(tabs.find((t) => t.type === 'page').webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener('open', r));
  ws.addEventListener('message', (m) => { const d = JSON.parse(m.data); if (d.id && waits.has(d.id)) { const [res, rej] = waits.get(d.id); waits.delete(d.id); d.error ? rej(new Error(d.error.message)) : res(d.result); } });
  await send('Page.enable'); await send('Runtime.enable');
  await send('Page.addScriptToEvaluateOnNewDocument', { source: `try { ${QUIET} } catch {}` });
  await send('Page.navigate', { url: `${BASE}?blank` }); await sleep(400);
  await ev(`localStorage.clear(); ${QUIET} true`);
  await send('Page.navigate', { url: `${BASE}?level=${LEVEL}&items=all` });
  await until('!!window.__moebiusBooted && !!window.storyRt && !!window.npcs');
  await sleep(4000);
  const gl = await ev(`(() => { const g = document.createElement('canvas').getContext('webgl2'); const d = g?.getExtension('WEBGL_debug_renderer_info'); return d ? g.getParameter(d.UNMASKED_RENDERER_WEBGL) : 'none'; })()`);
  console.log(`${gl}; the ${PRESET} preset at ${DPR}× — ${LEVEL}`);
  const who = await ev(`(() => {
    const ns = window.npcs.filter((n) => n.def).sort((a, b) => a.pos.distanceTo(window.player.pos) - b.pos.distanceTo(window.player.pos));
    return ns.slice(0, 4).map((n) => n.def.id);
  })()`);
  for (const id of who) {
    await ev(`(() => { const n = window.npcs.find((x) => x.def?.id === '${id}'); window.__npc = n; window.player.pos.copy(n.pos).add(new window.THREE.Vector3(1.6, 0, 1.6)); return true; })()`);
    await sleep(900);
    await ev(`window.storyRt.dialogue.start(window.__npc.def, window.__npc), true`);
    await sleep(1600);
    const r = await ev(`(async () => {
      const img = document.querySelector('#dialogue .dlg-chip img');
      if (!img || img.hidden || !img.src) return { drawn: false, why: img ? (img.hidden ? 'the panel fell back to the initial (the capture came back empty)' : 'no image') : 'no chip' };
      const b = new Image(); b.src = img.src; await b.decode();
      const c = document.createElement('canvas'); c.width = b.width; c.height = b.height;
      c.getContext('2d').drawImage(b, 0, 0);
      const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      const n = new Map();
      for (let i = 0; i < d.length; i += 4) { const k = (d[i] >> 3) + ',' + (d[i + 1] >> 3) + ',' + (d[i + 2] >> 3); n.set(k, (n.get(k) ?? 0) + 1); }
      const top = [...n.values()].sort((a, b2) => b2 - a)[0] / (c.width * c.height);
      return { drawn: true, w: c.width, h: c.height, colours: n.size, top: +top.toFixed(3) };
    })()`);
    const ok = r.drawn && r.colours > 24 && r.top < 0.8;
    if (!ok) bad++;
    console.log(`  ${ok ? 'ok  ' : 'EMPTY'} ${id}: ${r.drawn ? `${r.w}×${r.h}, ${r.colours} colours, the commonest ${(r.top * 100).toFixed(0)}%` : r.why}`);
    await ev(`window.storyRt.dialogue.close?.(), true`);
    await sleep(400);
  }
  const shot = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(join(OUT, `portrait-${LEVEL}-${PRESET}-dpr${DPR}.png`), Buffer.from(shot.data, 'base64'));
  console.log(join(OUT, `portrait-${LEVEL}-${PRESET}-dpr${DPR}.png`));
} finally {
  try { ws?.close(); } catch { /* closed */ }
  chrome.kill();
}
process.exit(bad ? 1 : 0);
