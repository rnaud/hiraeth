// #800 family D: an expression evaluated in the running game (muted, High, 1280×720) once a level has booted: a check
// in the browser without the pictures.   PORT=54xx CDP=54xx node probe.mjs <level> '<expression>'
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../../..');
if (process.env.PORT === '5173' || !process.env.PORT) throw new Error('PORT in 5400–5499, never 5173');
const [LEVEL, EXPR] = process.argv.slice(2);
const { serve, chrome } = await import(pathToFileURL(join(ROOT, 'scripts/changelog-shots.mjs')).href);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const server = await serve(ROOT), c = await chrome();
try {
  const base = `http://127.0.0.1:${process.env.PORT}/`;
  await c.send('Page.navigate', { url: `${base}manifest.webmanifest` }); await sleep(300);
  await c.ev(`localStorage.clear(); localStorage.setItem('hiraeth.muted', '1');
    localStorage.setItem('hiraeth.game.v1', JSON.stringify({ flags: { 'prologue.done': true, 'item.backpack': true, 'items.v': 2 }, keepsakes: [] }));
    localStorage.setItem('hiraeth.settings.v1', JSON.stringify({ quality: 'high', showFps: false, music: 0, effects: 0, voices: 0, soundV: 1 })); true`);
  await c.send('Page.addScriptToEvaluateOnNewDocument', { source: `window.__warns = []; { const w = console.warn; console.warn = (...a) => { window.__warns.push(a.map(String).join(' ').slice(0, 300)); w(...a); }; } window.__fetches = []; { const f0 = window.fetch; window.fetch = (u, ...r) => { window.__fetches.push(String(u?.url ?? u).slice(0, 120) + ' @' + Math.round(performance.now())); return f0(u, ...r); }; }` });
  await c.send('Page.navigate', { url: `${base}?level=${LEVEL}` });
  for (let i = 0; i < 600; i++) { try { if (await c.ev('!!window.__hiraethBooted && !!window.foes && !!window.player')) break; } catch { /* loading */ } await sleep(250); }
  await sleep(2000);
  console.log(JSON.stringify(await c.ev(`(async () => { ${EXPR} })()`), null, 1));
  console.log('errors', JSON.stringify(c.errors.slice(0, 8)));
} finally { await c.close(); await server.close(); }
