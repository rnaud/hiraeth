// The Arena's warm-up for a kind (#797, #800): after the Arena's load (which warms every kind in every skin its run may
// bring, ARENA_KINDS), each skin of the kind brought in as a foe; the programs compiled at its arrival (renderer.info) and
// its arrival frames' times (the add and the next 30 frames drawn by hand, the loop held). No new program and no long
// frame: it was warmed.
//
//   PORT=5475 CDP=5476 node references/enemy-redesign-2026-10-30/trials/familyA-tripo/warm-check.mjs <kind> [quality high]
//
// Muted: hiraeth.muted=1 and every volume 0 before the page loads (the Sound constructor reads them), checked after boot.
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../../..');
const [kind = 'toad', QUALITY = 'high'] = process.argv.slice(2);
if (process.env.PORT === '5173') throw new Error('never 5173');
const { serve, chrome } = await import(pathToFileURL(join(ROOT, 'scripts/changelog-shots.mjs')).href);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const server = await serve(ROOT);
const c = await chrome();
try {
  await c.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
  const base = `http://127.0.0.1:${process.env.PORT}/`;
  await c.send('Page.navigate', { url: `${base}manifest.webmanifest` }); await sleep(300);
  await c.ev(`localStorage.clear(); localStorage.setItem('hiraeth.muted', '1');
    localStorage.setItem('hiraeth.game.v1', JSON.stringify({ flags: { 'prologue.done': true, 'item.backpack': true, 'items.v': 2 }, keepsakes: [] }));
    localStorage.setItem('hiraeth.settings.v1', JSON.stringify({ quality: '${QUALITY}', showFps: false, music: 0, effects: 0, voices: 0, soundV: 1 })); true`);
  await c.send('Page.navigate', { url: `${base}?level=arena` });
  for (let i = 0; i < 400; i++) { try { if (await c.ev('!!window.__hiraethBooted && !!window.foes && !!window.renderFrame')) break; } catch { /* loading */ } await sleep(250); }
  await sleep(3000);
  const mute = await c.ev(`(() => { const s = window.sound; return { muted: !!s?.muted, master: s?.masterLevel?.() }; })()`);
  if (!mute.muted || mute.master !== 0) throw new Error('not muted: ' + JSON.stringify(mute));
  await c.ev('(window.cinematicReview = { paused: true }, window.foes.waves = false, window.foes.own = true, true)');
  const out = await c.ev(`(async () => {
    const { foes, renderer, THREE } = window, skins = Object.keys((await import('/src/enemies/skins.js')).SKINS[(await import('/src/enemies/archetypes.js')).archetypeOfKind(${JSON.stringify(kind)})]);
    for (const x of [...foes.list]) foes.remove(x);
    const rows = [];
    for (const skin of skins) {
      const p0 = renderer.info.programs.length, t0 = performance.now();
      const f = foes.add(${JSON.stringify(kind)} + '@' + skin, new THREE.Vector3(0, 0, -4));
      const add = performance.now() - t0; f.provoked = true; f.dist = 4;
      const frames = [];
      for (let i = 0; i < 30; i++) { const t = performance.now(); foes.look(f, 1 / 60); window.renderFrame(); frames.push(performance.now() - t); }
      rows.push({ skin, body: f.model.toad ?? f.model.tripo ?? f.model.shellback ?? 'own', addMs: +add.toFixed(2), programs: renderer.info.programs.length - p0, firstFrameMs: +frames[0].toFixed(1), worstFrameMs: +Math.max(...frames).toFixed(1), medianMs: +frames.slice().sort((a, b) => a - b)[15].toFixed(1) });
      foes.remove(f);
    }
    return rows;
  })()`);
  console.log(JSON.stringify({ kind, quality: QUALITY, mute, rows: out }, null, 1));
} finally {
  await c.close?.(); await server.close?.();
}
