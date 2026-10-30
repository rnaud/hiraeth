// #800 phase 1: baseline pictures and motion strips of the four trial foes in the real game renderer (the Arena,
// High preset, 10:00, clear), every foe at the same spot, the same pinned camera and the same light, the traveller
// beside it for scale. The game loop is held (window.cinematicReview.paused) and each frame is posed and drawn by
// hand (foes.look / foes.update, then renderFrame), so the frames are evenly spaced in game time.
//
//   PORT=5462 CDP=5463 node baseline-shots.mjs <repo> <out-dir> [crab@arzach2 hound@eclipse brute@perdide2 mummer@desert]
//
// Muted: hiraeth.muted=1 and every volume 0 before the page loads (the Sound constructor reads them), checked after boot.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
const [ROOT, OUT, ...IDS] = process.argv.slice(2);
const FOES = IDS.length ? IDS : ['crab@arzach2', 'hound@eclipse', 'brute@perdide2', 'mummer@desert'];
const QUALITY = process.env.QUALITY ?? 'high';
if (process.env.PORT === '5173') throw new Error('never 5173');
const { serve, chrome } = await import(pathToFileURL(join(ROOT, 'scripts/changelog-shots.mjs')).href);
const sharp = (await import('node:module')).createRequire(join(ROOT, 'package.json'))('sharp');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const PORT = Number(process.env.PORT);
mkdirSync(OUT, { recursive: true });

const server = await serve(ROOT);
const c = await chrome();
const log = { quality: QUALITY, foes: {} };
try {
  await c.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
  const base = `http://127.0.0.1:${PORT}/`;
  await c.send('Page.navigate', { url: `${base}manifest.webmanifest` }); await sleep(300);
  await c.ev(`localStorage.clear(); localStorage.setItem('hiraeth.muted', '1');
    localStorage.setItem('hiraeth.game.v1', JSON.stringify({ flags: { 'prologue.done': true, 'item.backpack': true, 'items.v': 2 }, keepsakes: [] }));
    localStorage.setItem('hiraeth.settings.v1', JSON.stringify({ quality: '${QUALITY}', showFps: false, music: 0, effects: 0, voices: 0, soundV: 1 })); true`);
  await c.send('Page.navigate', { url: `${base}?level=arena` });
  for (let i = 0; i < 400; i++) { try { if (await c.ev('!!window.__hiraethBooted && !!window.foes && !!window.player && !!window.renderFrame')) break; } catch { /* loading */ } await sleep(250); }
  await sleep(3000);
  log.mute = await c.ev(`(() => { const s = window.sound; return { muted: !!s?.muted, master: s?.masterLevel?.(), ctxGain: s?.master?.gain?.value ?? null }; })()`);
  if (!log.mute.muted || log.mute.master !== 0) throw new Error('not muted: ' + JSON.stringify(log.mute));
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
    const V = THREE.Vector3;
    const A = new V(0, 0, -2), H = 0;   // (the foe's spot, facing +z, toward the spawn)
    const fwd = new V(Math.sin(H), 0, Math.cos(H));
    const cams = {};
    const cam = (yaw, dist, pitch, lookY) => { const d = fwd.clone().applyAxisAngle(new V(0, 1, 0), yaw); return { d, eye: A.clone().addScaledVector(d, dist * Math.cos(pitch)).add(new V(0, lookY + dist * Math.sin(pitch), 0)), at: A.clone().add(new V(0, lookY, 0)) }; };
    cams.q = cam(0.75, 14, 0.12, 2.0);          // three-quarter front, the stills' and most strips' view
    cams.side = cam(Math.PI / 2, 14, 0.08, 2.0); // side on, for walking and attacks
    const pin = { eye: cams.q.eye.clone(), at: cams.q.at.clone(), fov: 35 };
    const baseUM = THREE.PerspectiveCamera.prototype.updateMatrixWorld, m = new THREE.Matrix4(), up = new V(0, 1, 0);
    camera.updateMatrixWorld = function (force) { this.position.copy(pin.eye); this.quaternion.setFromRotationMatrix(m.lookAt(pin.eye, pin.at, up)); if (this.fov !== pin.fov) { this.fov = pin.fov; this.updateProjectionMatrix(); } return baseUM.call(this, force); };
    // the traveller beside it for scale, to its left as the three-quarter camera sees it
    const r = new V(cams.q.d.z, 0, -cams.q.d.x);
    const tp = A.clone().addScaledVector(r, -3.4).addScaledVector(cams.q.d, 0.4);
    player.teleport(tp, up, cams.q.d.clone());
    window.__b = { A, H, fwd, cams, pin, tp, f: null };
    return true;
  })()`);
  await sleep(1500);   // (the traveller settles where he was put)
  await c.ev('(window.cinematicReview = { paused: true }, true)');
  await sleep(300);

  const shot = async (clip) => Buffer.from((await c.send('Page.captureScreenshot', { format: 'png', ...(clip ? { clip: { ...clip, scale: 1 } } : {}) })).data, 'base64');
  const CROP = { x: 240, y: 0, width: 800, height: 600 };   // (the same window for every foe: equal size)
  for (const id of FOES) {
    const name = id.split('@')[0];
    const info = await c.ev(`(() => {
      const { foes, THREE } = window, B = window.__b;
      for (const x of [...foes.list]) foes.remove(x);
      const f = foes.add(${JSON.stringify(id)}, B.A.clone());
      f.heading = B.H; f.provoked = true; f.dist = 2; f.stunned = 0;
      B.f = f; B.t = 0;
      foes.look(f, 0);
      const atk = f.def.attacks.filter((a) => !a.chain)[0];
      const box = new THREE.Box3().setFromObject(f.model.group), s = box.getSize(new THREE.Vector3());
      return { kind: f.kind, skin: f.skin ?? null, atk: atk.id, wind: atk.wind, strike: atk.strike ?? 0.3, recover: atk.recover ?? f.def.recover, size: [s.x, s.y, s.z].map((v) => +v.toFixed(2)), speed: f.def.speed };
    })()`);
    log.foes[id] = { info, strips: {} };
    // one frame of a mode at game time t (s): poses the foe and draws
    const step = (mode, t, dt) => c.ev(`(() => {
      const { foes, player, THREE } = window, B = window.__b, f = B.f, P = foes.player, mode = ${JSON.stringify(mode)}, t = ${t}, dt = ${dt};
      const cam = B.cams[mode === 'walk' || mode === 'attack' ? 'side' : 'q'];
      B.pin.eye.copy(cam.eye); B.pin.at.copy(cam.at);
      f.dist = 2;
      if (mode === 'idle' || mode === 'turn') {
        f.state = 'idle'; f.atk = null; f.k = 0; f.pos.copy(B.A);
        f.heading = mode === 'turn' ? B.H + Math.min(1, t / 1.5) * Math.PI : B.H;
        f.alt = f.def.hover ?? 0;
        foes.look(f, dt);
      } else if (mode === 'walk') {
        f.state = 'chase'; f.atk = null; f.k = 0; f.heading = B.H;   // (across the side camera's view)
        const fw = new THREE.Vector3(Math.sin(f.heading), 0, Math.cos(f.heading));
        f.pos.copy(B.A).addScaledVector(fw, f.def.speed * t);
        const off = f.pos.clone().sub(B.A); B.pin.eye.add(off); B.pin.at.add(off);   // (the view follows its progress)
        f.alt = f.def.hover ?? 0;
        foes.look(f, dt);
      } else if (mode === 'attack') {
        const a = f.def.attacks.filter((x) => !x.chain)[0];
        if (a.weapon) f.weapon = a.weapon;
        const st = a.strike ?? 0.3, rc = a.recover ?? f.def.recover, cyc = a.wind + st + rc, u = Math.min(t, cyc - 1e-3);
        if (f.atk !== a) { f.atk = a; f.heading = B.H; P.pos.copy(B.A).addScaledVector(B.fwd, Math.max(3, Math.min(a.max ?? f.def.reach, 6))); f.attackH = f.heading; f.placeArea(a, P); }
        const phase = u < a.wind ? 'wind' : u < a.wind + st ? 'strike' : 'recover';
        const k = phase === 'wind' ? u / a.wind : phase === 'strike' ? (u - a.wind) / st : 0;
        f.state = phase; f.k = k; f.timer = phase === 'recover' ? rc - (u - a.wind - st) : f.def.recover;
        if (a.lunge) f.pos.copy(B.A).addScaledVector(B.fwd, phase === 'wind' ? 0 : a.lunge * (phase === 'strike' ? 1 - (1 - k) ** 2 : 1)); else f.pos.copy(B.A);
        f.alt = f.def.hover ?? 0;
        foes.look(f, dt);
        B.label = phase + ' ' + k.toFixed(2);
      } else {
        // hurt / death: the game's own reaction (Foes.hurt, then Foes.update runs it), the traveller out of its way
        if (t === 0) {
          f.state = 'idle'; f.atk = null; f.pos.copy(B.A); f.heading = B.H; foes.look(f, 0);
          const dir = new THREE.Vector3(-1, 0, -0.4).normalize();   // (struck from its right front, the traveller's side)
          B.hp0 = f.hp;
          foes.hurt(f, 'blade', dir, mode === 'death' ? { damage: 99, source: 'charge', breaks: true } : { damage: Math.min(0.25, f.hp * 0.2), source: 'combo', combo: 0 });
          B.after = { hp: f.hp, state: f.state, reel: f.reel ?? null, alive: f.alive, rag: !!f.dying?.rag, dying: !!f.dying };
        }
        else foes.update(dt);
      }
      window.renderFrame();
      return B.label ?? null;
    })()`);
    // the still: idle, settled 1.5 s
    for (let i = 0; i <= 90; i++) await step('idle', i / 60, i ? 1 / 60 : 0);
    await sleep(120);
    writeFileSync(join(OUT, `${name}-still-3q.png`), await shot());
    // the strips: 8 frames each
    const PLAN = {
      idle: { span: 2, settle: 0 },
      walk: { span: 2, settle: 1 },
      turn: { span: 1.75, settle: 0 },
      attack: { span: info.wind + info.strike + info.recover, settle: 0, times: [0, 0.5 * info.wind, 0.75 * info.wind, 0.97 * info.wind, info.wind + 0.5 * info.strike, info.wind + 0.97 * info.strike, info.wind + info.strike + 0.35 * info.recover, info.wind + info.strike + 0.9 * info.recover] },
      hurt: { span: 1.4, settle: 0 },
      death: { span: 2.4, settle: 0 },
    };
    for (const [mode, P] of Object.entries(PLAN)) {
      if (mode === 'hurt' || mode === 'death') {   // (a fresh foe each, idle a moment first)
        await c.ev(`(() => { const { foes } = window, B = window.__b; for (const x of [...foes.list]) foes.remove(x); B.f = foes.add(${JSON.stringify(id)}, B.A.clone()); B.f.heading = B.H; B.f.provoked = true; B.label = null; return true; })()`);
        for (let i = 0; i <= 30; i++) await step('idle', i / 60, i ? 1 / 60 : 0);
      }
      if (mode === 'attack' || mode === 'turn') for (let i = 0; i <= 40; i++) await step('idle', i / 60, i ? 1 / 60 : 0);   // (facing ahead again after the turn)
      await c.ev('(window.__b.label = null, true)');
      const frames = [], labels = [];
      const N = 8, dt = 1 / 60, total = Math.round((P.settle + P.span) * 60);
      const at = new Set(P.times ? P.times.map((x) => Math.round((P.settle + x) * 60)) : Array.from({ length: N }, (_, i) => Math.round((P.settle + (P.span * i) / (N - 1)) * 60)));
      for (let i = 0; i <= total; i++) {
        const t = Math.max(0, i / 60 - P.settle);
        const lab = await step(mode, mode === 'walk' ? i / 60 : t, i ? dt : 0);
        if (at.has(i)) { await sleep(60); frames.push(await shot(CROP)); labels.push(`${t.toFixed(2)} s${lab ? ' · ' + lab : ''}`); }
      }
      if (mode === 'hurt' || mode === 'death') log.foes[id].strips[mode] = await c.ev('window.__b.after');
      // a strip: 4 x 2 frames, half size, each labelled
      const w = Math.round(CROP.width * 0.6), h = Math.round(CROP.height * 0.6);
      const comp = await Promise.all(frames.slice(0, N).map(async (buf, i) => {
        const label = Buffer.from(`<svg width="${w}" height="22"><rect width="${w}" height="22" fill="#f4ecd8" opacity="0.85"/><text x="6" y="16" font-family="Helvetica" font-size="13" fill="#3a2e22">${mode} · ${labels[i]}</text></svg>`);
        const img = await sharp(buf).resize(w, h).composite([{ input: label, top: 0, left: 0 }]).png().toBuffer();
        return { input: img, left: (i % 4) * w, top: Math.floor(i / 4) * h };
      }));
      await sharp({ create: { width: w * 4, height: h * 2, channels: 3, background: '#f4ecd8' } }).composite(comp).webp({ quality: 70 }).toFile(join(OUT, `${name}-${mode}.webp`));
      console.log(id, mode, labels.join(' | '));
    }
  }
  log.errors = c.errors.slice(0, 5);
  writeFileSync(join(OUT, 'shots.json'), JSON.stringify(log, null, 1));
} finally {
  await c.close();
  await server.close();
}
