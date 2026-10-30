// #800 phase 2b cleanups: every world skin of the hound in the Arena (the baseline capture's spot, light and pinned
// cameras: High, 1280×720, 10:00, clear), today's body beside the Tripo one, and one sheet of them. Per skin and variant
// a three-quarter still, a flank still and a close look at the head (horns, eyes, halo, glints, drips); then
// skins.webp, a row a skin: current 3q | Tripo 3q | Tripo flank | Tripo head. Muted as the baseline capture (hiraeth.muted
// and every volume 0 before the page loads, checked after boot).
//   PORT=5481 CDP=5482 node references/enemy-redesign-2026-10-30/trials/hound-tripo/skins-shot.mjs <out-dir> [eclipse,mangrove,…] [current,tripo]
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../../..');
const [OUT, SKINS_ARG, VARIANTS_ARG = 'current,tripo'] = process.argv.slice(2);
if (!OUT) throw new Error('usage: skins-shot.mjs <out-dir> [skins] [variants]');
if (process.env.PORT === '5173' || !process.env.PORT) throw new Error('PORT in 5400–5499, never 5173');
const { SKINS } = await import(pathToFileURL(join(ROOT, 'src/enemies/skins.js')).href);
const SKIN_IDS = SKINS_ARG ? SKINS_ARG.split(',') : Object.keys(SKINS.hound), VARIANTS = VARIANTS_ARG.split(',');
const { serve, chrome } = await import(pathToFileURL(join(ROOT, 'scripts/changelog-shots.mjs')).href);
const sharp = (await import('node:module')).createRequire(join(ROOT, 'package.json'))('sharp');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
mkdirSync(OUT, { recursive: true });
const server = await serve(ROOT);
const c = await chrome();
const log = { skins: {} };
try {
  await c.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
  const base = `http://127.0.0.1:${process.env.PORT}/`;
  await c.send('Page.navigate', { url: `${base}manifest.webmanifest` }); await sleep(300);
  await c.ev(`localStorage.clear(); localStorage.setItem('hiraeth.muted', '1');
    localStorage.setItem('hiraeth.game.v1', JSON.stringify({ flags: { 'prologue.done': true, 'item.backpack': true, 'items.v': 2 }, keepsakes: [] }));
    localStorage.setItem('hiraeth.settings.v1', JSON.stringify({ quality: 'high', showFps: false, music: 0, effects: 0, voices: 0, soundV: 1 })); true`);
  await c.send('Page.navigate', { url: `${base}?level=arena` });
  for (let i = 0; i < 400; i++) { try { if (await c.ev('!!window.__hiraethBooted && !!window.foes && !!window.player && !!window.renderFrame')) break; } catch { /* loading */ } await sleep(250); }
  await sleep(3000);
  log.mute = await c.ev(`(() => { const s = window.sound; return { muted: !!s?.muted, master: s?.masterLevel?.(), ctxGain: s?.master?.gain?.value ?? null }; })()`);
  if (!log.mute.muted || log.mute.master !== 0) throw new Error('not muted: ' + JSON.stringify(log.mute));
  await c.ev(`import('/references/enemy-redesign-2026-10-30/trials/variants.js').then(async (m) => { window.__trial = m; await m.preload(); return true; })`);
  await c.ev(`(() => {
    const { THREE, camera, foes, player } = window;
    window.sound?.setVolumes?.(0, 0);
    const p = window.preset?.(); if (p) p.dynamic = null;
    if (window.sky) { window.sky.hour = 10; window.sky.speed = 0; window.updateSky?.(); }
    if (window.weather) { window.weather.mode = 'clear'; window.weather.intensity = 0; }
    const hide = document.createElement('style'); hide.textContent = 'body > *:not(canvas) { visibility: hidden !important; } canvas { visibility: visible !important; }'; document.head.appendChild(hide);
    foes.waves = false; foes.own = true; foes.setPractice?.(null);
    for (const x of [...foes.list]) foes.remove(x);
    player.hurt = () => {}; player.knockDown = () => false; player.flinch = () => {};
    const V = THREE.Vector3, A = new V(0, 0, -2), fwd = new V(0, 0, 1), up = new V(0, 1, 0);
    const cam = (yaw, dist, pitch, lookY, ahead = 0) => { const d = fwd.clone().applyAxisAngle(up, yaw), at = A.clone().addScaledVector(fwd, ahead).add(new V(0, lookY, 0)); return { d, eye: at.clone().addScaledVector(d, dist * Math.cos(pitch)).add(new V(0, dist * Math.sin(pitch), 0)), at }; };
    const cams = { q: cam(0.75, 9, 0.1, 1.0), flank: cam(Math.PI / 2, 9, 0.08, 0.95), head: cam(0.7, 2.8, 0.1, 1.62, 0.75), headSide: cam(Math.PI / 2, 2.8, 0.06, 1.62, 0.75) };
    const pin = { eye: cams.q.eye.clone(), at: cams.q.at.clone(), fov: 35 };
    const baseUM = THREE.PerspectiveCamera.prototype.updateMatrixWorld, m = new THREE.Matrix4();
    camera.updateMatrixWorld = function (force) { this.position.copy(pin.eye); this.quaternion.setFromRotationMatrix(m.lookAt(pin.eye, pin.at, up)); if (this.fov !== pin.fov) { this.fov = pin.fov; this.updateProjectionMatrix(); } return baseUM.call(this, force); };
    const r = new V(cams.q.d.z, 0, -cams.q.d.x);
    player.teleport(A.clone().addScaledVector(r, -3.4).addScaledVector(cams.q.d, 0.4), up, cams.q.d.clone());
    window.__s = { A, cams, pin, f: null };
    return true;
  })()`);
  await sleep(1500);
  await c.ev('(window.cinematicReview = { paused: true }, true)');
  await sleep(300);
  const shot = async () => Buffer.from((await c.send('Page.captureScreenshot', { format: 'png' })).data, 'base64');
  const idle = (t, dt, camName) => c.ev(`(() => { const { foes } = window, S = window.__s, f = S.f, cam = S.cams[${JSON.stringify(camName)}];
    S.pin.eye.copy(cam.eye); S.pin.at.copy(cam.at);
    f.dist = 2; f.state = 'idle'; f.atk = null; f.k = 0; f.pos.copy(S.A); f.heading = 0; f.alt = 0; foes.look(f, ${dt}); window.renderFrame(); return true; })()`);
  for (const skin of SKIN_IDS) for (const v of VARIANTS) {
    const info = await c.ev(`(async () => { const { foes } = window, S = window.__s; for (const x of [...foes.list]) foes.remove(x);
      await window.__trial.use('hound', ${JSON.stringify(v)});
      const f = foes.add('hound@${skin}', S.A.clone()); f.heading = 0; f.provoked = true; f.dist = 2; f.stunned = 0; f.lit = 99; S.f = f; foes.look(f, 0);
      const meshes = []; f.model.group.traverseVisible((o) => { if (o.isMesh) meshes.push(o.name || o.material?.name || '?'); });
      return { trial: f.model.trial ?? 'current', inventory: window.__trial.inventory(f.model.group), meshes };
    })()`);
    log.skins[`${skin}/${v}`] = info;
    for (let i = 0; i <= 90; i++) await idle(i / 60, i ? 1 / 60 : 0, 'q');
    for (const view of ['q', 'flank', 'head', 'headSide']) { await idle(1.5, 0, view); await sleep(120); writeFileSync(join(OUT, `hound-${v}-${skin}-${view}.png`), await shot()); }
    console.log(skin, v, JSON.stringify(info.inventory));
  }
  log.errors = c.errors.slice(0, 5);
  writeFileSync(join(OUT, 'skins.json'), JSON.stringify(log, null, 1));
} finally { await c.close(); await server.close(); }

// the sheet: a row a skin
const W = 400, H = 300, PAD = 24;
const COLS = [['current', 'q', { left: 340, top: 130, width: 600, height: 450 }], ['tripo', 'q', { left: 340, top: 130, width: 600, height: 450 }], ['tripo', 'flank', { left: 300, top: 110, width: 680, height: 510 }], ['tripo', 'head', { left: 300, top: 130, width: 720, height: 540 }]];
const label = (text) => Buffer.from(`<svg width="${W}" height="${PAD}"><rect width="${W}" height="${PAD}" fill="#f4ecd8"/><text x="8" y="17" font-family="Helvetica" font-size="14" fill="#3a2e22">${text}</text></svg>`);
const comp = [];
for (const [r, skin] of SKIN_IDS.entries()) for (const [k, [v, view, crop]] of COLS.entries()) {
  const f = join(OUT, `hound-${v}-${skin}-${view}.png`);
  if (!existsSync(f)) continue;
  comp.push({ input: label(`${skin} · ${v === 'current' ? 'current' : 'Tripo'} · ${view === 'q' ? 'three-quarter' : view}`), left: k * W, top: r * (H + PAD) });
  comp.push({ input: await sharp(f).extract(crop).resize(W, H).toBuffer(), left: k * W, top: r * (H + PAD) + PAD });
}
await sharp({ create: { width: W * COLS.length, height: SKIN_IDS.length * (H + PAD), channels: 3, background: '#f4ecd8' } }).composite(comp).webp({ quality: 78 }).toFile(join(OUT, 'skins.webp'));
console.log('sheet', join(OUT, 'skins.webp'));
