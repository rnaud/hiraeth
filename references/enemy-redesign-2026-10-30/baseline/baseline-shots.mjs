// #800 phase 1: baseline pictures and motion strips of the four trial foes in the real game renderer (the Arena,
// High preset, 10:00, clear), every foe at the same spot, the same pinned camera and the same light, the traveller
// beside it for scale. The game loop is held (window.cinematicReview.paused) and each frame is posed and drawn by
// hand (foes.look / foes.update, then renderFrame), so the frames are evenly spaced in game time.
//
//   PORT=5462 CDP=5463 node baseline-shots.mjs <repo> <out-dir> [crab@arzach2 hound@eclipse brute@perdide2 mummer@desert]
//     [--variant current|direct|tripo|side] [--extra]      (SKIN_NAMES=1: files named <kind>-<skin>-…)
//
// Phase 2 (the trials, references/enemy-redesign-2026-10-30/trials/): --variant builds the foe in a trial variant
// (trials/variants.js `use`: the archetype's builder stood in for, in the plain Arena page), everything else the same, so
// phase 1's pictures stay the "current" column. Its files are named <foe>-<variant>-<strip>.webp. --variant side puts
// current, direct and Tripo 3 m apart in a row on one clock (the same pose at the same moment, a wider camera).
// --extra adds front, side and rear stills, and for Tripo a clay still (its texture and colours off: baked light shows).
//
// Muted: hiraeth.muted=1 and every volume 0 before the page loads (the Sound constructor reads them), checked after boot.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
const argv = process.argv.slice(2), flag = (k) => { const i = argv.indexOf(k); if (i < 0) return null; const v = argv[i + 1]; argv.splice(i, 2); return v; };
const VARIANT = flag('--variant') ?? 'current', EXTRA = argv.includes('--extra') && (argv.splice(argv.indexOf('--extra'), 1), true);
const [ROOT, OUT, ...IDS] = argv;
const FOES = IDS.length ? IDS : ['crab@arzach2', 'hound@eclipse', 'brute@perdide2', 'mummer@desert'];
const QUALITY = process.env.QUALITY ?? 'high';
const SIDE = VARIANT === 'side', LINE = SIDE ? ['current', 'direct', 'tripo'] : [VARIANT];
if (process.env.PORT === '5173') throw new Error('never 5173');
const { serve, chrome } = await import(pathToFileURL(join(ROOT, 'scripts/changelog-shots.mjs')).href);
const sharp = (await import('node:module')).createRequire(join(ROOT, 'package.json'))('sharp');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const PORT = Number(process.env.PORT);
mkdirSync(OUT, { recursive: true });
const fileOf = (name, what) => join(OUT, VARIANT === 'current' ? `${name}-${what}` : `${name}-${VARIANT}-${what}`);

const server = await serve(ROOT);
const c = await chrome();
const log = { quality: QUALITY, variant: VARIANT, foes: {} };
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
  // (the trial variants: loaded into the page, the Tripo source with them)
  if (VARIANT !== 'current') log.trial = await c.ev(`import('/references/enemy-redesign-2026-10-30/trials/variants.js').then(async (m) => { window.__trial = m; await m.preload(); return Object.keys(m.TRIALS); })`);
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
    const V = THREE.Vector3, side = ${SIDE};
    const A = new V(0, 0, -2), H = 0;   // (the foe's spot, facing +z, toward the spawn)
    const fwd = new V(Math.sin(H), 0, Math.cos(H));
    const cams = {};
    const cam = (yaw, dist, pitch, lookY) => { const d = fwd.clone().applyAxisAngle(new V(0, 1, 0), yaw); return { d, eye: A.clone().addScaledVector(d, dist * Math.cos(pitch)).add(new V(0, lookY + dist * Math.sin(pitch), 0)), at: A.clone().add(new V(0, lookY, 0)) }; };
    const far = side ? 19 : 14;   // (the row of three a wider view; one foe phase 1's)
    cams.q = cam(0.75, far, 0.12, 2.0);          // three-quarter front, the stills' and most strips' view
    cams.side = cam(Math.PI / 2, far, 0.08, 2.0); // side on, for walking and attacks
    cams.front = cam(0, 9, 0.1, 0.9); cams.flank = cam(Math.PI / 2, 9, 0.1, 0.9); cams.rear = cam(Math.PI, 9, 0.1, 0.9);   // (the --extra stills, closer)
    const pin = { eye: cams.q.eye.clone(), at: cams.q.at.clone(), fov: 35 };
    const baseUM = THREE.PerspectiveCamera.prototype.updateMatrixWorld, m = new THREE.Matrix4(), up = new V(0, 1, 0);
    camera.updateMatrixWorld = function (force) { this.position.copy(pin.eye); this.quaternion.setFromRotationMatrix(m.lookAt(pin.eye, pin.at, up)); if (this.fov !== pin.fov) { this.fov = pin.fov; this.updateProjectionMatrix(); } return baseUM.call(this, force); };
    // the traveller beside it for scale, to its left as the three-quarter camera sees it
    const r = new V(cams.q.d.z, 0, -cams.q.d.x);
    const tp = A.clone().addScaledVector(r, side ? -6.6 : -3.4).addScaledVector(cams.q.d, 0.4);
    player.teleport(tp, up, cams.q.d.clone());
    // (side by side: the row across the three-quarter view, 3 m apart; the side view sees them one behind another, so
    //  its strips stagger them along its own right instead)
    const row = side ? [-3, 0, 3] : [0];
    window.__b = { A, H, fwd, cams, pin, tp, f: null, fs: [], r, row };
    return true;
  })()`);
  await sleep(1500);   // (the traveller settles where he was put)
  await c.ev('(window.cinematicReview = { paused: true }, true)');
  await sleep(300);

  const shot = async (clip) => Buffer.from((await c.send('Page.captureScreenshot', { format: 'png', ...(clip ? { clip: { ...clip, scale: 1 } } : {}) })).data, 'base64');
  const CROP = SIDE ? { x: 0, y: 60, width: 1280, height: 600 } : { x: 240, y: 0, width: 800, height: 600 };   // (the same window for every foe: equal size)
  // the foes of one take: each in its variant, at its place in the row
  const spawn = (id) => c.ev(`(async () => {
    const { foes, THREE } = window, B = window.__b, T = window.__trial, line = ${JSON.stringify(LINE)};
    for (const x of [...foes.list]) foes.remove(x);
    B.fs = [];
    for (let i = 0; i < line.length; i++) {
      if (T) await T.use(${JSON.stringify(id)}.split('@')[0], line[i]);
      const at = B.A.clone().addScaledVector(B.r, B.row[i]);
      const f = foes.add(${JSON.stringify(id)}, at);
      f.heading = B.H; f.provoked = true; f.dist = 2; f.stunned = 0; f.__A = at; f.__variant = line[i];
      foes.look(f, 0); B.fs.push(f);
    }
    B.f = B.fs[0]; B.t = 0; B.label = null;
    return B.fs.map((f) => f.model.trial ?? 'current');
  })()`);
  for (const id of FOES) {
    const name = process.env.SKIN_NAMES ? id.replace('@', '-') : id.split('@')[0];   // (SKIN_NAMES=1: one kind's skins side by side, each its own files)
    const built = await spawn(id);
    const info = await c.ev(`(() => {
      const { THREE } = window, B = window.__b, f = B.f, T = window.__trial;
      const atk = f.def.attacks.filter((a) => !a.chain)[0];
      const box = new THREE.Box3().setFromObject(f.model.group), s = box.getSize(new THREE.Vector3());
      return { kind: f.kind, skin: f.skin ?? null, atk: atk.id, wind: atk.wind, strike: atk.strike ?? 0.3, recover: atk.recover ?? f.def.recover, size: [s.x, s.y, s.z].map((v) => +v.toFixed(2)), speed: f.def.speed,
        inventory: T ? B.fs.map((x) => T.inventory(x.model.group)) : null };
    })()`);
    log.foes[id] = { info, built, strips: {} };
    if (SIDE && built.some((b, i) => b !== LINE[i])) console.log(id, 'not every variant built:', built.join(', '));
    // one frame of a mode at game time t (s): poses the foes and draws
    const step = (mode, t, dt, camName = null) => c.ev(`(() => {
      const { foes, player, THREE } = window, B = window.__b, P = foes.player, mode = ${JSON.stringify(mode)}, t = ${t}, dt = ${dt};
      const cam = B.cams[${JSON.stringify(camName)} ?? (mode === 'walk' || mode === 'attack' ? 'side' : 'q')];
      B.pin.eye.copy(cam.eye); B.pin.at.copy(cam.at);
      // (the side camera looks along the row: in its strips the row is staggered along that camera's right)
      const sideCam = cam === B.cams.side && B.fs.length > 1;
      B.fs.forEach((f, i) => {
        const A0 = sideCam ? B.A.clone().addScaledVector(B.fwd, (1 - i) * 3.5) : f.__A;   // (side on: left to right along its walk)
        f.dist = 2;
        if (mode === 'idle' || mode === 'turn') {
          f.state = 'idle'; f.atk = null; f.k = 0; f.pos.copy(A0);
          f.heading = mode === 'turn' ? B.H + Math.min(1, t / 1.5) * Math.PI : B.H;
          f.alt = f.def.hover ?? 0;
          foes.look(f, dt);
        } else if (mode === 'walk') {
          f.state = 'chase'; f.atk = null; f.k = 0; f.heading = B.H;   // (across the side camera's view)
          const fw = new THREE.Vector3(Math.sin(f.heading), 0, Math.cos(f.heading));
          f.pos.copy(A0).addScaledVector(fw, f.def.speed * t);
          if (i === 0) { const off = fw.clone().multiplyScalar(f.def.speed * t); B.pin.eye.add(off); B.pin.at.add(off); }   // (the view follows its progress)
          f.alt = f.def.hover ?? 0;
          foes.look(f, dt);
        } else if (mode === 'attack') {
          const a = f.def.attacks.filter((x) => !x.chain)[0];
          if (a.weapon) f.weapon = a.weapon;
          const st = a.strike ?? 0.3, rc = a.recover ?? f.def.recover, cyc = a.wind + st + rc, u = Math.min(t, cyc - 1e-3);
          if (f.atk !== a) { f.atk = a; f.heading = B.H; P.pos.copy(A0).addScaledVector(B.fwd, Math.max(3, Math.min(a.max ?? f.def.reach, 6))); f.attackH = f.heading; f.placeArea(a, P); }
          const phase = u < a.wind ? 'wind' : u < a.wind + st ? 'strike' : 'recover';
          const k = phase === 'wind' ? u / a.wind : phase === 'strike' ? (u - a.wind) / st : 0;
          f.state = phase; f.k = k; f.timer = phase === 'recover' ? rc - (u - a.wind - st) : f.def.recover;
          if (a.lunge) f.pos.copy(A0).addScaledVector(B.fwd, phase === 'wind' ? 0 : a.lunge * (phase === 'strike' ? 1 - (1 - k) ** 2 : 1)); else f.pos.copy(A0);
          f.alt = f.def.hover ?? 0;
          foes.look(f, dt);
          B.label = phase + ' ' + k.toFixed(2);
        } else if (t === 0) {
          // hurt / death: the game's own reaction (Foes.hurt, then Foes.update runs it), the traveller out of its way
          f.state = 'idle'; f.atk = null; f.pos.copy(A0); f.heading = B.H; foes.look(f, 0);
          const dir = new THREE.Vector3(-1, 0, -0.4).normalize();   // (struck from its right front, the traveller's side)
          B.hp0 = f.hp;
          foes.hurt(f, 'blade', dir, mode === 'death' ? { damage: 99, source: 'charge', breaks: true } : { damage: Math.min(0.25, f.hp * 0.2), source: 'combo', combo: 0 });
          if (i === 0) B.after = { hp: f.hp, state: f.state, reel: f.reel ?? null, alive: f.alive, rag: !!f.dying?.rag, dying: !!f.dying };
        }
      });
      if ((mode === 'hurt' || mode === 'death') && t > 0) foes.update(dt);
      window.renderFrame();
      return B.label ?? null;
    })()`);
    // the still: idle, settled 1.5 s
    for (let i = 0; i <= 90; i++) await step('idle', i / 60, i ? 1 / 60 : 0);
    await sleep(120);
    writeFileSync(fileOf(name, 'still-3q.png'), await shot());
    if (EXTRA) {
      for (const view of ['front', 'flank', 'rear']) { await step('idle', 1.5, 0, view); await sleep(120); writeFileSync(fileOf(name, `still-${view}.png`), await shot()); }
      // clay: every textured or vertex-coloured part of the foes grey, untextured (the baked light check)
      await c.ev(`(() => { const B = window.__b; B.clay = []; const seen = new Set(); for (const f of B.fs) f.model.group.traverse((o) => { if (!o.isMesh) return; const m = o.material, U = m.uniforms; if (!U?.uColor || seen.has(m)) return; seen.add(m);
        B.clay.push([m, U.uColor.value.clone(), U.uHasMap?.value, m.vertexColors]); U.uColor.value.set('#c9c4ba'); if (U.uHasMap) U.uHasMap.value = 0; m.vertexColors = false; m.needsUpdate = true; }); return B.clay.length; })()`);
      await step('idle', 1.5, 0); await sleep(150); writeFileSync(fileOf(name, 'still-clay.png'), await shot());
      await step('idle', 1.5, 0, 'front'); await sleep(150); writeFileSync(fileOf(name, 'still-clay-front.png'), await shot());
      await c.ev(`(() => { for (const [m, col, map, vc] of window.__b.clay) { m.uniforms.uColor.value.copy(col); if (map !== undefined) m.uniforms.uHasMap.value = map; m.vertexColors = vc; m.needsUpdate = true; } return true; })()`);
    }
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
      if (mode === 'hurt' || mode === 'death') {   // (fresh foes each, idle a moment first)
        await spawn(id);
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
      // a strip: 4 x 2 frames (side by side: 2 x 4, wider), each labelled
      const cols = SIDE ? 2 : 4, rows = N / cols, w = Math.round(CROP.width * 0.6), h = Math.round(CROP.height * 0.6);
      const comp = await Promise.all(frames.slice(0, N).map(async (buf, i) => {
        const label = Buffer.from(`<svg width="${w}" height="22"><rect width="${w}" height="22" fill="#f4ecd8" opacity="0.85"/><text x="6" y="16" font-family="Helvetica" font-size="13" fill="#3a2e22">${mode} · ${labels[i]}${SIDE ? ' · left to right: current, direct, Tripo' : ''}</text></svg>`);
        const img = await sharp(buf).resize(w, h).composite([{ input: label, top: 0, left: 0 }]).png().toBuffer();
        return { input: img, left: (i % cols) * w, top: Math.floor(i / cols) * h };
      }));
      await sharp({ create: { width: w * cols, height: h * rows, channels: 3, background: '#f4ecd8' } }).composite(comp).webp({ quality: 70 }).toFile(fileOf(name, `${mode}.webp`));
      console.log(id, VARIANT, mode, labels.join(' | '));
    }
  }
  log.errors = c.errors.slice(0, 5);
  writeFileSync(join(OUT, VARIANT === 'current' ? 'shots.json' : `shots-${VARIANT}.json`), JSON.stringify(log, null, 1));
} finally {
  await c.close();
  await server.close();
}
