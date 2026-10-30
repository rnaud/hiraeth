// #800: a foe in its own worlds, for a before/after made by hand (the game's body as the game builds it: no trial
// stand-in). For each world: the world loaded as a player lands in it (High, 1280×720, 10:00, clear, muted: hiraeth.muted
// and every volume 0 before the page loads, checked after boot), its foes cleared, one foe of the kind in that world's
// skin set on the ground ahead of the traveller (solid: provoked and lit), and pinned cameras: three-quarter, flank, the
// head close; in the first world also the pounce's coil and leap (`--attack id`). PNGs into <out>, and shots.json.
//   PORT=5481 CDP=5482 node references/enemy-redesign-2026-10-30/trials/world-shot.mjs <out> <kind> <world,world…> [--attack pounce] [--quality high]
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const ROOT = process.env.ROOT ?? join(dirname(fileURLToPath(import.meta.url)), '../../..');
const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const [OUT, KIND, WORLDS_ARG] = args;
if (!OUT || !KIND || !WORLDS_ARG) throw new Error('usage: world-shot.mjs <out> <kind> <worlds> [--attack id] [--quality high]');
if (process.env.PORT === '5173' || !process.env.PORT) throw new Error('PORT in 5400–5499, never 5173');
const ATTACK = opt('--attack', null), QUALITY = opt('--quality', 'high'), AHEAD = +opt('--ahead', 8);
const { serve, chrome } = await import(pathToFileURL(join(ROOT, 'scripts/changelog-shots.mjs')).href);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
mkdirSync(OUT, { recursive: true });
const server = await serve(ROOT);
const log = { root: ROOT, kind: KIND, quality: QUALITY, worlds: {} };
try {
  for (const [wi, world] of WORLDS_ARG.split(',').entries()) {
    const c = await chrome();
    try {
      await c.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
      const base = `http://127.0.0.1:${process.env.PORT}/`;
      await c.send('Page.navigate', { url: `${base}manifest.webmanifest` }); await sleep(300);
      await c.ev(`localStorage.clear(); localStorage.setItem('hiraeth.muted', '1');
        localStorage.setItem('hiraeth.game.v1', JSON.stringify({ flags: { 'prologue.done': true, 'item.backpack': true, 'items.v': 2 }, keepsakes: [] }));
        localStorage.setItem('hiraeth.settings.v1', JSON.stringify({ quality: ${JSON.stringify(QUALITY)}, showFps: false, music: 0, effects: 0, voices: 0, soundV: 1 })); true`);
      await c.send('Page.navigate', { url: `${base}?level=${world}` });
      for (let i = 0; i < 600; i++) { try { if (await c.ev('!!window.__hiraethBooted && !!window.foes && !!window.player && !!window.renderFrame')) break; } catch { /* loading */ } await sleep(250); }
      await sleep(3000);
      const mute = await c.ev(`(() => { const s = window.sound; return { muted: !!s?.muted, master: s?.masterLevel?.(), ctxGain: s?.master?.gain?.value ?? null }; })()`);
      if (!mute.muted || mute.master !== 0) throw new Error('not muted: ' + JSON.stringify(mute));
      const info = await c.ev(`(() => {
        const { THREE, camera, foes, player, physics } = window;
        window.sound?.setVolumes?.(0, 0);
        const p = window.preset?.(); if (p) p.dynamic = null;
        if (window.sky) { window.sky.hour = 10; window.sky.speed = 0; window.updateSky?.(); }
        if (window.weather) { window.weather.mode = 'clear'; window.weather.intensity = 0; }
        const hide = document.createElement('style'); hide.textContent = 'body > *:not(canvas) { visibility: hidden !important; } canvas { visibility: visible !important; }'; document.head.appendChild(hide);
        foes.waves = false; foes.setPractice?.(null);
        for (const x of [...foes.list]) foes.remove(x);
        foes.update = () => {};   // (nothing else comes in, nothing moves it: the pictures pose it by hand)
        player.hurt = () => {}; player.knockDown = () => false; player.flinch = () => {};
        const V = THREE.Vector3, up = new V(0, 1, 0);
        const h = player.heading, fwd = new V(Math.sin(h), 0, Math.cos(h));
        const A = player.pos.clone().addScaledVector(fwd, ${AHEAD}); A.y = physics.groundAt(A.x, A.y + 6, A.z, 20) ?? A.y;
        // (the foe faces back toward the traveller; cameras round it in its own frame)
        const fh = h + Math.PI, ff = new V(Math.sin(fh), 0, Math.cos(fh));
        const cam = (yaw, dist, pitch, lookY, ahead = 0) => { const d = ff.clone().applyAxisAngle(up, yaw), at = A.clone().addScaledVector(ff, ahead).add(new V(0, lookY, 0)); return { eye: at.clone().addScaledVector(d, dist * Math.cos(pitch)).add(new V(0, dist * Math.sin(pitch), 0)), at }; };
        const cams = { q: cam(0.75, 8, 0.12, 1.0), flank: cam(Math.PI / 2, 8, 0.08, 0.95), head: cam(0.7, 3, 0.1, 1.5, 0.7), wide: cam(0.6, 14, 0.16, 1.1), pool: cam(0.7, 4.5, 0.42, 0.15, 0.3) };
        const pin = { eye: cams.q.eye.clone(), at: cams.q.at.clone(), fov: 35 };
        const baseUM = THREE.PerspectiveCamera.prototype.updateMatrixWorld, m = new THREE.Matrix4();
        camera.updateMatrixWorld = function (force) { this.position.copy(pin.eye); this.quaternion.setFromRotationMatrix(m.lookAt(pin.eye, pin.at, up)); if (this.fov !== pin.fov) { this.fov = pin.fov; this.updateProjectionMatrix(); } return baseUM.call(this, force); };
        const f = foes.add(${JSON.stringify(KIND)}, A.clone(), { tier: 0 }); f.heading = fh; f.provoked = true; f.dist = 3; f.stunned = 0; f.lit = 99;
        window.__s = { A, fh, cams, pin, f };
        const meshes = []; f.model.group.traverseVisible((o) => { if (o.isMesh) meshes.push(o.name || '?'); });
        return { skin: f.skin ?? f.model.skin, at: A.toArray().map((x) => +x.toFixed(2)), trial: f.model.trial ?? null, meshes: meshes.length, name: f.model.group.name };
      })()`);
      await sleep(1200);
      await c.ev('(window.cinematicReview = { paused: true }, true)');
      await sleep(300);
      const shot = async () => Buffer.from((await c.send('Page.captureScreenshot', { format: 'png' })).data, 'base64');
      const pose = (camName, dt, state = 'idle', k = 0) => c.ev(`(() => { const { foes } = window, S = window.__s, f = S.f, cam = S.cams[${JSON.stringify(camName)}];
        S.pin.eye.copy(cam.eye); S.pin.at.copy(cam.at);
        const atk = ${JSON.stringify(ATTACK)} && ${JSON.stringify(state)} !== 'idle' ? f.def.attacks.find((a) => a.id === ${JSON.stringify(ATTACK)}) : null;
        f.dist = 3; f.state = ${JSON.stringify(state)}; f.atk = atk; f.k = ${k}; f.pos.copy(S.A); f.heading = S.fh; f.alt = 0; foes.look(f, ${dt}); window.renderFrame(); return true; })()`);
      for (let i = 0; i <= 90; i++) await pose('q', i ? 1 / 60 : 0);
      for (const view of ['q', 'flank', 'head', 'wide']) { await pose(view, 0); await sleep(150); writeFileSync(join(OUT, `${world}-${view}.png`), await shot()); }
      if (ATTACK && wi === 0) {
        // (the wind-up run through to its coil at 0.8, then the strike's leap at 0.35)
        for (let i = 0; i <= 48; i++) await pose('flank', 1 / 60, 'wind', Math.min(0.8, i / 60));
        await sleep(150); writeFileSync(join(OUT, `${world}-${ATTACK}-coil.png`), await shot());
        for (let i = 0; i <= 6; i++) await pose('flank', 1 / 60, 'strike', i / 6 * 0.35);
        await sleep(150); writeFileSync(join(OUT, `${world}-${ATTACK}-leap.png`), await shot());
        // (a shadowy foe's shadow form: lying in wait, unprovoked; the head view)
        await c.ev('(() => { const f = window.__s.f; f.provoked = false; f.watcher = false; f.lit = 0; return true; })()');
        for (let i = 0; i <= 60; i++) await pose('pool', 1 / 60);
        await sleep(150); writeFileSync(join(OUT, `${world}-pool.png`), await shot());
      }
      log.worlds[world] = { ...info, mute, errors: c.errors.slice(0, 5) };
      console.log(world, JSON.stringify(info));
    } finally { await c.close(); }
  }
  writeFileSync(join(OUT, 'shots.json'), JSON.stringify(log, null, 1));
} finally { await server.close(); }
