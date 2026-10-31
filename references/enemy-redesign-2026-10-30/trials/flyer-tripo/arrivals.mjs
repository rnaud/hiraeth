// #800 family B: the Arena's warm-up held for a rebuilt foe (#797): the Arena loaded as a player's (its load warms every
// kind in every skin its run may bring), its waves stopped, then each skin of the kind brought in one at a time in
// front of the traveller as the run brings them (Foes.add, the body built ahead or kept), the worst frame from its
// arrival to 2.5 s after (requestAnimationFrame intervals) and the programs compiled round it (renderer.info).
// Muted (hiraeth.muted and every volume 0 before the page loads), High, 1280 × 720.
//
//   PORT=54xx node arrivals.mjs <kind> [--quality high|handheld] [<root>]
import { join, resolve } from 'node:path';

if (process.env.PORT === '5173') throw new Error('never 5173');
const argv = process.argv.slice(2), qi = argv.indexOf('--quality'), QUALITY = qi >= 0 ? argv.splice(qi, 2)[1] : 'high';
const [KIND, ROOT0] = argv, ROOT = resolve(ROOT0 ?? new URL('../../../..', import.meta.url).pathname);
const { serve, chrome } = await import(join(ROOT, 'scripts/changelog-shots.mjs'));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const server = await serve(ROOT), c = await chrome();
try {
  await c.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
  const base = `http://127.0.0.1:${process.env.PORT}/`;
  await c.send('Page.navigate', { url: `${base}manifest.webmanifest` }); await sleep(300);
  await c.ev(`localStorage.clear(); localStorage.setItem('hiraeth.muted', '1');
    localStorage.setItem('hiraeth.game.v1', JSON.stringify({ flags: { 'prologue.done': true, 'item.backpack': true, 'items.v': 2 }, keepsakes: [] }));
    localStorage.setItem('hiraeth.settings.v1', JSON.stringify({ quality: '${QUALITY}', showFps: false, music: 0, effects: 0, voices: 0, soundV: 1 })); true`);
  await c.send('Page.navigate', { url: `${base}?level=arena` });
  for (let i = 0; i < 400; i++) { try { if (await c.ev('!!window.__hiraethBooted && !!window.foes && !!window.player')) break; } catch { /* loading */ } await sleep(250); }
  await sleep(4000);
  const mute = await c.ev(`(() => { const s = window.sound; return { muted: !!s?.muted, master: s?.masterLevel?.() }; })()`);
  if (!mute.muted || mute.master !== 0) throw new Error('not muted: ' + JSON.stringify(mute));
  const skins = await c.ev(`(async () => { const { SKINS } = await import('/src/enemies/skins.js'); const { foes } = window;
    foes.waves = false; foes.setPractice?.(null); for (const x of [...foes.list]) foes.remove(x);
    window.player.hurt = () => {}; window.player.knockDown = () => false;
    window.__arr = { frames: [], last: performance.now() };
    const loop = (t) => { const A = window.__arr; A.frames.push([t, t - A.last]); A.last = t; requestAnimationFrame(loop); }; requestAnimationFrame(loop);
    return Object.keys(SKINS[${JSON.stringify(KIND)}]); })()`);
  const out = [];
  for (const skin of skins) {
    await sleep(1500);
    const r = await c.ev(`(async () => { const { foes, player, THREE, renderer } = window, A = window.__arr;
      const p0 = renderer.info.programs?.length ?? 0, t0 = performance.now();
      const at = player.pos.clone().add(new THREE.Vector3(Math.sin(player.heading ?? 0), 0, Math.cos(player.heading ?? 0)).multiplyScalar(6));
      const f = foes.add(${JSON.stringify(KIND)} + '@' + ${JSON.stringify(skin)}, at); const built = performance.now() - t0;
      await new Promise((r) => setTimeout(r, 2500));
      const worst = Math.max(...A.frames.filter(([t]) => t >= t0).map(([, d]) => d));
      const programs = (renderer.info.programs?.length ?? 0) - p0;
      foes.remove(f);
      return { skin: ${JSON.stringify(skin)}, add: +built.toFixed(2), worst: +worst.toFixed(1), programs, tripo: f.model?.tripo ?? null };
    })()`);
    out.push(r); console.log(JSON.stringify(r));
  }
  console.log(JSON.stringify({ kind: KIND, quality: QUALITY, worst: Math.max(...out.map((r) => r.worst)), programs: out.reduce((t, r) => t + r.programs, 0), errors: c.errors.slice(0, 3) }));
} finally { await c.close(); await server.close(); }
