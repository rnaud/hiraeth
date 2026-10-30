// #800 phase 2a fixes: the shellback's two close checks in the real Arena (High, 10:00, clear, muted), each variant
// (current | direct | tripo) a row:
//   gaze  the traveller stood off to its left, then its right, 4 m out; the foe idle, provoked (it has noticed him),
//         settled 1.5 s each, so its eyes (and the face that follows them) have eased to him: the full view, then the
//         face close, for each side (gaze.webp)
//   snap  the near pincer close up through the snap: rest, mid wind, open at the top of the wind, the chop, shut, the
//         recovery (snap.webp)
// The game loop held and each frame posed by hand (foes.look, then renderFrame), as baseline-shots.mjs does.
//   PORT=5480 CDP=5481 node references/enemy-redesign-2026-10-30/trials/shellback-tripo/closeups.mjs <out-dir> [current,direct,tripo] [--tag before]
import { mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../../..');
const argv = process.argv.slice(2), ti = argv.indexOf('--tag'), TAG = ti >= 0 ? argv.splice(ti, 2)[1] : '';
const [OUT, LIST = 'current,direct,tripo'] = argv, VARIANTS = LIST.split(',');
if (!process.env.PORT || process.env.PORT === '5173') throw new Error('PORT in 5400–5499, never 5173');
const { serve, chrome } = await import(pathToFileURL(join(ROOT, 'scripts/changelog-shots.mjs')).href);
const sharp = createRequire(join(ROOT, 'package.json'))('sharp');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
mkdirSync(OUT, { recursive: true });
const server = await serve(ROOT);
const c = await chrome();
const label = (text, w) => Buffer.from(`<svg width="${w}" height="22"><rect width="${w}" height="22" fill="#f4ecd8" opacity="0.88"/><text x="6" y="16" font-family="Helvetica" font-size="13" fill="#3a2e22">${text}</text></svg>`);
const tile = async (buf, crop, w, h, text) => sharp(await sharp(buf).extract(crop).resize(w, h).toBuffer()).composite([{ input: label(text, w), top: 0, left: 0 }]).png().toBuffer();
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
  const mute = await c.ev(`(() => { const s = window.sound; return { muted: !!s?.muted, master: s?.masterLevel?.() }; })()`);
  if (!mute.muted || mute.master !== 0) throw new Error('not muted: ' + JSON.stringify(mute));
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
    const V = THREE.Vector3, pin = { eye: new V(), at: new V(), fov: 35 };
    const baseUM = THREE.PerspectiveCamera.prototype.updateMatrixWorld, m = new THREE.Matrix4(), up = new V(0, 1, 0);
    camera.updateMatrixWorld = function (force) { this.position.copy(pin.eye); this.quaternion.setFromRotationMatrix(m.lookAt(pin.eye, pin.at, up)); if (this.fov !== pin.fov) { this.fov = pin.fov; this.updateProjectionMatrix(); } return baseUM.call(this, force); };
    window.__c = { A: new V(0, 0, -2), pin, f: null };
    return true;
  })()`);
  await sleep(800);
  await c.ev('(window.cinematicReview = { paused: true }, true)');
  const shot = async () => Buffer.from((await c.send('Page.captureScreenshot', { format: 'png' })).data, 'base64');
  const spawn = (v) => c.ev(`(async () => {
    const { foes } = window, C = window.__c;
    for (const x of [...foes.list]) foes.remove(x);
    await window.__trial.use('crab', ${JSON.stringify(v)});
    const f = foes.add('crab@arzach2', C.A.clone()); f.heading = 0; f.provoked = true; f.stunned = 0; C.f = f; foes.look(f, 0);
    return f.model.trial ?? 'current';
  })()`);
  // (the traveller placed, the foe posed for n frames: idle, or through an attack at game time t)
  const pose = (opts) => c.ev(`(() => {
    const { foes, player, THREE } = window, C = window.__c, f = C.f, o = ${JSON.stringify(opts)};
    C.pin.eye.set(...o.eye); C.pin.at.set(...o.at); C.pin.fov = o.fov ?? 35;
    const a = f.def.attacks.find((x) => x.id === 'snap');
    for (let i = 0; i < (o.frames ?? 1); i++) {
      f.pos.copy(C.A); f.heading = 0; f.dist = player.pos.distanceTo(f.pos);
      if (o.t == null) { f.state = 'idle'; f.atk = null; f.k = 0; }
      else {
        const st = a.strike ?? 0.3, rc = a.recover ?? f.def.recover, u = o.t;
        if (f.atk !== a) { f.atk = a; f.attackH = 0; }
        const phase = u < a.wind ? 'wind' : u < a.wind + st ? 'strike' : 'recover';
        f.state = phase; f.k = phase === 'wind' ? u / a.wind : phase === 'strike' ? (u - a.wind) / st : 0; f.timer = phase === 'recover' ? rc - (u - a.wind - st) : f.def.recover;
      }
      foes.look(f, i ? 1 / 60 : 0);
      f.model.group.updateMatrixWorld(true);   // (as a drawn frame does: the gaze reads its host's last matrix)
    }
    window.renderFrame();
    const snap = f.def.attacks.find((x) => x.id === 'snap');
    return { watching: !!f.gaze?.watching, yaw: (f.model.gaze ?? []).map((E) => +E.yaw.toFixed(2)), him: player.pos.toArray().map((x) => +x.toFixed(2)), wind: snap.wind, strike: snap.strike ?? 0.3, recover: snap.recover ?? f.def.recover, tip: f.model.tell('snap').getWorldPosition(new THREE.Vector3()).toArray().map((x) => +x.toFixed(2)) };
  })()`);
  // (the traveller put somewhere: the loop let run a moment, so his body is drawn there, then held again)
  const place = async (him) => {
    await c.ev(`(() => { const { player, THREE } = window, C = window.__c, h = new THREE.Vector3(...${JSON.stringify(him)}); player.teleport(h, new THREE.Vector3(0, 1, 0), C.A.clone().sub(h).setY(0).normalize()); window.cinematicReview.paused = false; return true; })()`);
    await sleep(900);
    await c.ev('(window.cinematicReview.paused = true, true)');
  };
  const A = [0, 0, -2], gazeRows = [], snapRows = [];
  for (const v of VARIANTS) {
    const built = await spawn(v);
    // gaze: him to its left (+x: the foe faces +z) and to its right, 4 m out and a little ahead; the camera in front
    const tiles = [];
    for (const [side, sx] of [['left', 1], ['right', -1]]) {
      const him = [A[0] + sx * 3.4, 0, A[2] + 2.2];
      await place(him);
      const info = await pose({ eye: [A[0] - sx * 1.2, 2.2, A[2] + 8.5], at: [A[0] + sx * 1.2, 0.9, A[2]], frames: 100 });
      await sleep(120);
      const wide = await shot();
      await pose({ eye: [A[0], 1.05, A[2] + 3.2], at: [A[0], 0.8, A[2] + 0.6], fov: 32 });
      await sleep(120);
      const close = await shot();
      console.log(v, side, JSON.stringify(info));
      tiles.push(await tile(wide, { left: 160, top: 60, width: 960, height: 600 }, 480, 300, `${v} · him to its ${side}${info.watching ? ' (noticed)' : ''}`));
      tiles.push(await tile(close, { left: 240, top: 80, width: 800, height: 500 }, 480, 300, `${v} · face, him to its ${side}`));
    }
    gazeRows.push(tiles);
    // the snap close: the camera off its near pincer's side, a little ahead
    await place([A[0] - 0.6, 0, A[2] + 4]);
    const info = await pose({ eye: [A[0] + 0.5, 1.0, A[2] + 5], at: [A[0] + 0.5, 0.75, A[2] + 0.8], frames: 40 });
    const T = [0, info.wind * 0.5, info.wind * 0.97, info.wind + info.strike * 0.35, info.wind + info.strike * 0.97, info.wind + info.strike + info.recover * 0.5];
    const NAMES = ['rest', 'wind ½', 'top of wind', 'chop', 'shut', 'recover'];
    // (two views a moment: in front of its near pincer, and side on to it, where the jaw's gap shows)
    const VIEW = { front: { eye: [A[0] + 1.6, 1.1, A[2] + 4.2], at: [A[0] - 0.2, 0.75, A[2] + 0.8] }, side: { eye: [A[0] + 3.3, 1.75, A[2] + 1.3], at: [A[0] + 0.5, 0.8, A[2] + 1.0] } };
    const row = [], side = [];
    let last = 0;
    for (const [i, t] of T.entries()) {
      // (posed through the clip at 60 Hz up to t, so its eased parts are where the game would have them)
      for (let u = last; u < t - 1e-6; u += 1 / 60) await pose({ t: u, ...VIEW.front, fov: 30, frames: 2 });
      await pose({ t, ...VIEW.front, fov: 30, frames: 1 });
      last = t;
      await sleep(80);
      row.push(await tile(await shot(), { left: 240, top: 60, width: 800, height: 600 }, 320, 240, `${v} · ${NAMES[i]} ${t.toFixed(2)} s`));
      await pose({ t, ...VIEW.side, fov: 30, frames: 1 });
      await sleep(80);
      side.push(await tile(await shot(), { left: 240, top: 60, width: 800, height: 600 }, 320, 240, `${v} · side · ${NAMES[i]}`));
    }
    snapRows.push(row, side);
    console.log(v, built, 'gaze + snap');
  }
  const sheet = async (rows, w, h, name) => {
    const comp = rows.flatMap((r, j) => r.map((input, i) => ({ input, left: i * w, top: j * h })));
    const file = join(OUT, `crab-${name}${TAG ? '-' + TAG : ''}.webp`);
    await sharp({ create: { width: w * rows[0].length, height: h * rows.length, channels: 3, background: '#f4ecd8' } }).composite(comp).webp({ quality: 78 }).toFile(file);
    console.log(file);
  };
  await sheet(gazeRows, 480, 300, 'gaze');
  await sheet(snapRows, 320, 240, 'snap');
  if (c.errors.length) console.log('page errors', c.errors.slice(0, 5));
} finally { await c.close(); await server.close(); }
