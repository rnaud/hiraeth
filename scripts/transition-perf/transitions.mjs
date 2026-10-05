// The hand-overs into another space, timed (docs/systems/performance.md, "Doors, caves
// and portals"). Headless Chrome on ANGLE Metal (never SwiftShader), muted, the game's sound at 0, no vsync
// or frame-rate limit, so a frame's interval is its work. Per world: the page is loaded once, then
// the traveller is set a few metres in front of each way in or out, the camera behind, and W held:
// the walk carries them through it. Recorded from the first step to 1.5 s after the move.
//   npx vite --port 6431 --strictPort &
//   node scripts/transition-perf/transitions.mjs --preset high|handheld [--cpu 4] [--only desert]
//        [--res 1280x720] [--out file.json] [--strip dir --strip-only desert:cave-in]
// Prints, per transition, the worst frame, frames over 33 / 50 ms, the WebGL work of the worst
// frame (compiles, texture and buffer uploads), long tasks, and the continuity across the move:
// the speed before and after, the camera's offset from the traveller, the largest pose jump.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { options, sleep } from '../bench/lib.mjs';
import { PLAYWRIGHT, CHROME } from '../bench/browser.mjs';

const opt = options();
const BASE = (opt.url ?? 'http://localhost:6431/').replace(/\/?$/, '/');
const preset = opt.preset ?? 'high';
const cpuRate = +(opt.cpu ?? (preset === 'handheld' ? 4 : 1));
const [W, H] = (opt.res ?? '1280x720').split('x').map(Number);
const INSTRUMENT = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'page.js'), 'utf8');

// ---------------------------------------------------------------- the transitions, world by world
// kind 'portal': a level.portals entry, found by its label (nth: which of several with that label);
// 'nav': a level.navigationPortals entry (the Lab's doors); 'ship': the ramp and the hatch.
const WORLDS = {
  desert: [
    { id: 'doorway-in', kind: 'portal', label: null, nth: 0, skipTemple: true },
    { id: 'doorway-out', kind: 'portal', label: null, nth: 1, skipTemple: true },
    { id: 'cave-in', kind: 'portal', label: 'giant’s mouth' },
    { id: 'cave-out', kind: 'portal', label: 'passage up' },
    { id: 'hearth-in', kind: 'portal', label: 'Givers’ Hearth' },
    { id: 'hearth-out', kind: 'portal', label: 'passage out' },
    { id: 'temple-in', kind: 'portal', label: /^door of/ },
    { id: 'temple-out', kind: 'portal', label: 'way out' },
    { id: 'ship-board', kind: 'ship', dir: 'in' },
    { id: 'ship-leave', kind: 'ship', dir: 'out' },
  ],
  incal: [
    { id: 'temple-in', kind: 'portal', label: /^door of/ },
    { id: 'temple-out', kind: 'portal', label: 'way out' },
  ],
  edena: [
    { id: 'hatch-in', kind: 'portal', label: null, nth: 0, skipTemple: true },
    { id: 'hatch-out', kind: 'portal', label: null, nth: 1, skipTemple: true },
  ],
  lab: [
    { id: 'room-in', kind: 'nav', nth: 0 },
    { id: 'room-out', kind: 'nav', nth: 1 },
    { id: 'room2-in', kind: 'nav', nth: 6 },
  ],
  home: [
    { id: 'house-in', kind: 'walk', path: 'smallIn' },
    { id: 'house-out', kind: 'walk', path: 'smallOut' },
  ],
  garage: [
    { id: 'portal-a-b', kind: 'walk', path: 'garageA' },
  ],
  perdide: [
    { id: 'temple-in', kind: 'portal', label: /^door of/ },
    { id: 'temple-out', kind: 'portal', label: 'way out' },
  ],
};

// ---------------------------------------------------------------- in the page, after boot
const DRIVE = `(() => {
  const w = window, THREE = w.THREE, Y = new THREE.Vector3(0, 1, 0), D = w.__drive = {};
  w.preset().dynamic = null;   // (the render scale held: the same work before and after)
  w.sky.speed = 0; w.weather.mode = 'clear'; w.weather.intensity = 0;
  w.__tp.hook();
  const v3 = (p) => new THREE.Vector3(p.x, p.y, p.z);
  D.list = () => (w.level.portals ?? []).map((p, i) => ({ i, label: p.label ?? null, temple: p.temple ?? null, at: p.at && v3(p.at).toArray().map((x) => +x.toFixed(1)), to: p.to && v3(p.to).toArray().map((x) => +x.toFixed(1)) }));
  D.nav = () => (w.level.navigationPortals ?? []).map((p, i) => ({ i, label: p.label ?? null, at: (p.at ?? p.pos) && v3(p.at ?? p.pos).toArray().map((x) => +x.toFixed(1)), to: p.to && v3(p.to).toArray().map((x) => +x.toFixed(1)) }));
  /** Stand dist m in front of a way through (from where its partner lands you), facing it, the camera behind. */
  D.approach = (list, i, dist = 4.5) => {
    const P = list[i], at = v3(P.at ?? P.pos);
    let best = null, bd = Infinity;
    for (const Q of list) { if (Q === P || !Q.to) continue; const d = v3(Q.to).distanceTo(at); if (d < bd) { bd = d; best = Q; } }
    let dir = best && bd < 25 ? v3(best.to).sub(at).setY(0) : new THREE.Vector3(0, 0, 1);
    if (dir.lengthSq() < 0.01) dir.set(0, 0, 1);
    dir.normalize();
    const start = at.clone().addScaledVector(dir, dist);
    const g = w.physics.groundAt ? w.physics.groundAt(start.x, start.y + 2, start.z) : start.y;
    if (Number.isFinite(g) && Math.abs(g - start.y) < 3) start.y = g + 0.05;
    const heading = Math.atan2(-dir.x, -dir.z);
    w.player.teleport(start, Y, new THREE.Vector3(0, 0, 1));
    w.player.heading = heading;
    w.rig.yaw = heading + Math.PI; w.rig.pitch = 0.22; w.rig.target.copy(start); w.rig.snapTight?.(start);
    return { start: start.toArray(), at: at.toArray(), heading };
  };
  D.portalIndex = (label, nth = 0, skipTemple = false) => {
    const L = w.level.portals ?? [];
    const hits = L.map((p, i) => [p, i]).filter(([p]) => (label === null ? !p.temple || !skipTemple : label instanceof RegExp ? label.test(p.label ?? '') : p.label === label) && !(skipTemple && p.temple));
    return hits[nth]?.[1] ?? -1;
  };
  /** Stand at a start, facing a goal, the camera behind (for walks with no portal list). */
  D.stand = (start, goal) => {
    const g = w.physics.groundAt(start.x, start.y + 2, start.z); if (Number.isFinite(g) && Math.abs(g - start.y) < 3) start.y = g + 0.05;
    const heading = Math.atan2(goal.x - start.x, goal.z - start.z);
    w.player.teleport(start, Y, new THREE.Vector3(0, 0, 1)); w.player.heading = heading;
    w.rig.yaw = heading + Math.PI; w.rig.pitch = 0.22; w.rig.target.copy(start); w.rig.snapTight?.(start);
    return { start: start.toArray(), at: goal.toArray(), heading };
  };
  D.paths = {
    smallIn: () => { const S = w.level.home.small, out = S.threshold.clone().sub(S.spots.inside).setY(0).normalize(); return D.stand(S.threshold.clone().addScaledVector(out, 5), S.spots.inside.clone()); },
    smallOut: () => { const S = w.level.home.small, out = S.threshold.clone().sub(S.spots.inside).setY(0).normalize(); return D.stand(S.spots.inside.clone().addScaledVector(out, -1.5), S.threshold.clone().addScaledVector(out, 4)); },
    garageA: () => { const po = w.level.garage.portals[0], ground = po.pos.clone().setY(po.pos.y - 5.5), from = w.level.garage.aSpawn, dir = from.clone().sub(ground).setY(0).normalize(); return D.stand(ground.clone().addScaledVector(dir, 8), ground.clone()); },
  };
  D.shipStart = (dir) => {
    const s = w.ship;
    if (dir === 'in') {
      const f = s.rampFoot.clone(), h = s.site.heading;
      const start = f.clone().add(new THREE.Vector3(Math.sin(h) * 4, 0, Math.cos(h) * 4));
      const g = w.physics.groundAt(start.x, start.y + 3, start.z); if (Number.isFinite(g)) start.y = g + 0.05;
      const heading = Math.atan2(f.x - start.x, f.z - start.z);
      w.player.teleport(start, Y, new THREE.Vector3(0, 0, 1)); w.player.heading = heading; w.rig.yaw = heading + Math.PI; w.rig.target.copy(start);
      return { start: start.toArray(), heading };
    }
    return null;
  };
})();`;

// ---------------------------------------------------------------- run
const { chromium } = await import(PLAYWRIGHT);
const browser = await chromium.launch({ executablePath: CHROME, headless: true,
  // paced (the default): vsync and the frame-rate limit on, as in a player's browser, so the GPU's
  // backlog is bounded as it is there (unpaced, any call that waits for the GPU process waits for
  // several frames' worth of queued work, and the first use of anything looks far worse than it is)
  args: ['--mute-audio', '--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', ...(opt.unpaced ? ['--disable-gpu-vsync', '--disable-frame-rate-limit'] : []),
    '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows', '--enable-precise-memory-info'] });
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
await page.addInitScript(INSTRUMENT);
page.on('pageerror', (e) => console.error('pageerror', e.message));
const cdp = await ctx.newCDPSession(page);
const ev = (fn, arg) => page.evaluate(fn, arg);
await page.goto(BASE + 'manifest.webmanifest');
const glName = await ev(() => { const c = document.createElement('canvas').getContext('webgl2'); const d = c.getExtension('WEBGL_debug_renderer_info'); return c.getParameter(d.UNMASKED_RENDERER_WEBGL); });
if (/SwiftShader|llvmpipe|Software/i.test(glName)) { console.error('software rendering: ' + glName); process.exit(2); }
console.log(glName, preset, `cpu ×${cpuRate}`, `${W}×${H}`, opt.unpaced ? 'unpaced' : 'paced');

const r1 = (x) => (x == null ? x : +x.toFixed(1));
/** The figures for one recording: frames before / around / after the move. */
function analyse(rec, id) {
  const F = rec.frames;
  let jump = -1;
  for (let i = 1; i < F.length; i++) { const a = F[i - 1].p, b = F[i].p; if (Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) > 4) { jump = i; break; } }
  // (the ship: no move, the moment you are inside or out)
  if (jump < 0) for (let i = 1; i < F.length; i++) if (F[i].ins !== F[0].ins) { jump = i; break; }
  const worst = F.reduce((m, f, i) => (f.dt > (F[m]?.dt ?? -1) ? i : m), 0);
  const win = F.filter((f, i) => jump < 0 || (i >= jump - 40 && i <= jump + 90));
  const steady = F.slice(5, Math.max(6, jump - 30)).map((f) => f.dt).sort((a, b) => a - b);
  const med = steady[steady.length >> 1] ?? 0;
  // pose: the largest frame-to-frame move of a hand, a foot or the head in the body's space, per second of play
  // (over the frames round the move: from 5 before to 10 after; the typical step is a few centimetres)
  let poseJump = 0, poseAt = -1;
  for (let i = Math.max(1, jump - 5); i < (jump > 0 ? Math.min(F.length, jump + 11) : F.length); i++) {
    const a = F[i - 1].pose, b = F[i].pose; if (!a || !b || a.length !== b.length) continue;
    const step = Math.min(F[i].dt, 50) / 1000;
    for (let k = 0; k < a.length; k++) { const d = Math.hypot(a[k][0] - b[k][0], a[k][1] - b[k][1], a[k][2] - b[k][2]); if (d > poseJump) { poseJump = d; poseAt = i - jump; } }
  }
  // camera: the offset from the traveller just before and just after
  const camB = jump > 0 ? F[jump - 1].cam : null, camA = jump > 0 ? F[jump].cam : null;
  const camA5 = jump > 0 ? F[Math.min(F.length - 1, jump + 5)].cam : null;
  const speedB = jump > 0 ? F[jump - 1].speed : null, speedA = jump > 0 ? F.slice(jump, jump + 6).map((f) => f.speed) : null;
  const wf = F[worst] ?? {};
  const longMs = rec.long.reduce((s, l) => s + l.ms, 0);
  return {
    id, frames: F.length, jumpAt: jump, median: r1(med), worst: r1(wf.dt), worstAt: worst - jump,
    over33: win.filter((f) => f.dt > 33.4).length, over50: win.filter((f) => f.dt > 50).length,
    worstGl: wf.gl && Object.fromEntries(Object.entries(wf.gl).map(([k, v]) => [k, typeof v === "number" ? r1(v) : v])), worstPh: wf.ph, worstCpu: r1(wf.cpu),
    progs: jump > 0 ? [F[0].progs, F[F.length - 1].progs] : null, geo: jump > 0 ? [F[0].geo, F[F.length - 1].geo] : null,
    long: rec.long.length, longMs: Math.round(longMs), longMax: Math.round(Math.max(0, ...rec.long.map((l) => l.ms))),
    speedB, speedA, camB, camA, camA5, poseJump: +poseJump.toFixed(3), poseAt,
    fadeMax: Math.max(0, ...F.map((f) => f.fade)),
    slow: F.filter((f) => f.slow).flatMap((f) => f.slow.map((x) => ({ at: F.indexOf(f) - jump, ...x }))).sort((a, b) => b.ms - a.ms).slice(0, 12),
    lat: jump > 0 ? Math.max(0, ...F.slice(Math.max(0, jump - 40), jump + 90).map((f) => f.lat ?? 0)) : null,
    latMed: (() => { const l = F.map((f) => f.lat).filter((x) => x != null).sort((a, b) => a - b); return l[l.length >> 1] ?? null; })(),
    latAround: jump > 0 ? F.slice(Math.max(0, jump - 6), jump + 10).map((f) => f.lat ?? null) : null,
    around: jump > 0 ? F.slice(Math.max(0, jump - 6), jump + 10).map((f) => r1(f.dt)) : null,
  };
}

async function record(drive, { untilMoved = true, after = 1500, maxMs = 7000, strip = false } = {}) {
  // (recording starts once the traveller stands at the start: drive calls begin)
  const begin = async () => {
    if (strip) await ev(([w, h]) => { window.__tp.strip = { on: true, w, h, frames: [] }; }, [320, 180]);
    await ev(() => window.__tp.start());
  };
  await drive(begin);
  const t0 = Date.now();
  let moved = -1;
  while (Date.now() - t0 < maxMs) {
    await sleep(100);
    moved = await ev(() => { const F = window.__tp.frames; for (let i = 1; i < F.length; i++) { const a = F[i - 1].p, b = F[i].p; if (Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) > 4) return i; } return -1; });
    if (!untilMoved || moved > 0) break;
  }
  await sleep(after);
  await page.keyboard.up('KeyW');
  await sleep(300);
  const rec = await ev(() => window.__tp.stop());
  let png = null;
  if (strip) png = await ev(() => {
    const S = window.__tp.strip; S.on = false;
    const F = window.__tp.frames; let jump = -1;
    for (let i = 1; i < F.length; i++) { const a = F[i - 1].p, b = F[i].p; if (Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) > 4) { jump = i; break; } }
    // frames from 0.5 s before the move to 0.8 s after, one cell each, the frame time printed on it
    let t = 0; const pick = [];
    const fr = S.frames.filter((s) => s.i >= 0);
    const at = fr.findIndex((s) => s.i >= jump);
    const from = Math.max(0, at - 14), to = Math.min(fr.length, at + 22);
    for (let k = from; k < to; k++) pick.push(fr[k]);
    const cols = 6, rows = Math.ceil(pick.length / cols), cw = S.w, chh = S.h;
    const c = document.createElement('canvas'); c.width = cols * cw; c.height = rows * chh;
    const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.font = 'bold 16px sans-serif';
    pick.forEach((s, n) => {
      const cx = (n % cols) * cw, cy = Math.floor(n / cols) * chh;
      x.drawImage(s.c, cx, cy);
      const f = F[s.i] ?? {}, rel = s.i - jump;
      const dt = F[s.i + 1]?.dt;   // (the interval that follows this frame: how long it stayed on screen)
      x.fillStyle = dt > 33.4 ? '#c00' : '#000'; x.fillRect(cx, cy, 150, 22);
      x.fillStyle = '#fff'; x.fillText((rel >= 0 ? '+' : '') + rel + '  ' + (dt ? dt.toFixed(0) : '?') + ' ms', cx + 4, cy + 16);
      x.strokeStyle = '#fff'; x.strokeRect(cx + 0.5, cy + 0.5, cw - 1, chh - 1);
    });
    S.frames = [];
    return c.toDataURL('image/png');
  });
  return { rec, png };
}

const results = [];
const onlyWorld = opt.only ? new RegExp(opt.only) : null;
for (const [world, list] of Object.entries(WORLDS)) {
  if (onlyWorld && !onlyWorld.test(world)) continue;
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  await ev((q) => {
    localStorage.clear();
    localStorage.setItem('moebius.game.v1', JSON.stringify({ flags: { 'prologue.done': true, 'item.backpack': true, 'items.v': 2, 'ship.launched': true, 'ship.powered': true }, keepsakes: [] }));
    localStorage.setItem('moebius.settings.v1', JSON.stringify({ quality: q, showFps: false, music: 0, effects: 0, voices: 0 }));
  }, preset).catch(() => {});
  const t0 = Date.now();
  await page.goto(BASE + `?level=${world}`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__moebiusBooted && window.player && window.rig && window.__tp, null, { timeout: 400000, polling: 200 });
  console.log(`\n== ${world}: booted in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  await ev(DRIVE);
  if (opt.diag) await ev(() => { window.__tp.diag = true; });
  await sleep(2500);
  // the world's opening page (and anything else open) closed first
  for (let i = 0; i < 12 && await ev(() => !!(window.story?.pageOpen || window.story?.pending || window.storyRt?.busy() || document.querySelector('#page.open'))); i++) { await page.keyboard.press('Enter'); await sleep(700); }
  await sleep(1000);
  if (opt.list) { console.log(JSON.stringify(await ev(() => window.__drive.list()))); console.log(JSON.stringify(await ev(() => window.__drive.nav()))); continue; }
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpuRate });
  for (const sc of list) {
    const stripThis = opt.strip && (!opt['strip-only'] || opt['strip-only'].split(',').includes(`${world}:${sc.id}`));
    let info = null;
    const drive = async (begin) => {
      if (sc.kind === 'portal' || sc.kind === 'nav') {
        info = await ev(([sc, label]) => {
          const D = window.__drive;
          const L = sc.kind === 'nav' ? window.level.navigationPortals : window.level.portals;
          const lab = label?.re ? new RegExp(label.re) : label?.s ?? null;
          const i = sc.kind === 'nav' ? sc.nth : D.portalIndex(lab, sc.nth ?? 0, sc.skipTemple);
          if (i < 0 || !L?.[i]) return { error: 'no portal' };
          const r = { i, ...D.approach(L, i) };
          window.__tp.diagAt = r.at;
          return r;
        }, [sc, sc.label instanceof RegExp ? { re: sc.label.source } : sc.label === null || sc.label === undefined ? null : { s: sc.label }]);
        await sleep(1200);
        await begin();
        await page.keyboard.down('KeyW');
      } else if (sc.kind === 'walk') {
        info = await ev((k) => { const r = window.__drive.paths[k](); window.__tp.diagAt = r.at; return r; }, sc.path);
        await sleep(1200);
        await begin();
        await page.keyboard.down('KeyW');
      } else if (sc.kind === 'ship') {
        if (sc.dir === 'in') {
          info = await ev(() => window.__drive.shipStart('in'));
          await sleep(1200);
          await begin();
          await page.keyboard.down('KeyW');
          await sleep(700);
          await page.keyboard.up('KeyW');
          await page.keyboard.down('KeyE'); await sleep(120); await page.keyboard.up('KeyE');
        } else {
          await sleep(400);
          await begin();
          await page.keyboard.down('KeyE'); await sleep(120); await page.keyboard.up('KeyE');
        }
      }
    };
    const { rec, png } = await record(drive, { untilMoved: sc.kind !== 'ship', after: sc.kind === 'ship' ? 6000 : sc.kind === 'walk' ? 2500 : 1500, strip: stripThis });
    if (info?.error) { console.log(`${world}:${sc.id}  ${info.error}`); continue; }
    const a = analyse(rec, `${world}:${sc.id}`);
    if (sc.kind === 'ship') {
      // no move: the worst frame over the walk in or out, and the inside flag
      a.inside = await ev(() => window.ship.inside);
    }
    results.push({ world, ...a, info });
    console.log(`${a.id.padEnd(22)} worst ${String(a.worst).padStart(6)} ms @${a.worstAt}  med ${a.median}  >33: ${a.over33}  >50: ${a.over50}  long ${a.long}/${a.longMs} ms (max ${a.longMax})  gl ${JSON.stringify(a.worstGl)}  ph ${JSON.stringify(a.worstPh)}`);
    console.log(`${''.padEnd(22)} progs ${a.progs}  geo ${a.geo}  speed ${a.speedB} → ${a.speedA}  cam ${a.camB} → ${a.camA} → ${a.camA5}  pose ${a.poseJump} @${a.poseAt}  fade ${a.fadeMax}`);
    console.log(`${''.padEnd(22)} around ${a.around}`);
    console.log(`${''.padEnd(22)} gpu lag max ${a.lat} med ${a.latMed}: ${a.latAround}`);
    if (opt.diag) for (const x of a.slow) console.log(`${''.padEnd(24)}${x.ms} ms @${x.at} ${x.rt} ${x.what} [${x.mat}]${x.inst ? ' inst' : ''}${x.skin ? ' skin' : ''} v${x.verts}`);
    if (png) { mkdirSync(opt.strip, { recursive: true }); const f = join(opt.strip, `${world}-${sc.id}-${preset}.png`); writeFileSync(f, Buffer.from(png.split(',')[1], 'base64')); console.log('strip ' + f); }
    if (opt.frames) { mkdirSync(opt.frames, { recursive: true }); writeFileSync(join(opt.frames, `${world}-${sc.id}-${preset}.json`), JSON.stringify(rec)); }
    await sleep(1800);   // (the doorway's cooldown, and the world settles)
  }
}
if (opt.out) writeFileSync(opt.out, JSON.stringify({ gl: glName, preset, cpuRate, results }, null, 1));
await browser.close();
