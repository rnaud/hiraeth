// The frames round a foe's arrival in the Arena (issue #797's measure, kept as a script for #800's bodies): the Arena
// with one kind in one skin again and again (?enemy=hound@spheres), each foe cut down 2.6 s after it came in; for each
// arrival the worst requestAnimationFrame interval from its arrival to 2.5 s after and the GPU programs made meanwhile.
// Muted headless Chrome (hiraeth.muted, every volume 0, checked), one Vite (PORT, never 5173), one Chrome (CDP).
//   PORT=5475 CDP=5476 node scripts/enemy-roster/arrivals.mjs [--commit <sha>] [--quality high|handheld] [--kinds hound@eclipse,…] [--n 3]
import { execFileSync } from 'node:child_process';
import { rmSync, symlinkSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tempDir } from '../temp-dirs.mjs';

const ROOT = resolve(fileURLToPath(new URL('../../', import.meta.url)));
const args = process.argv.slice(2), arg = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const PORT = Number(process.env.PORT ?? 5475);
if (PORT === 5173) throw new Error('5173 is the author’s own dev server');
process.env.PORT = String(PORT); process.env.CDP ??= String(PORT + 1);
const QUALITY = arg('quality', 'high'), KINDS = arg('kinds', 'hound@eclipse,hound@mangrove,hound@spheres,hound@bazaar').split(','), N = Number(arg('n', 3));
const { serve, chrome } = await import('../changelog-shots.mjs');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let dir = ROOT, work = null;
if (arg('commit')) {
  work = tempDir('hiraeth-arrivals-'); dir = join(work, 'tree');
  execFileSync('sh', ['-c', `mkdir -p "${dir}" && git archive ${arg('commit')} | tar -x -C "${dir}"`], { cwd: ROOT, stdio: ['ignore', 'ignore', 'inherit'], maxBuffer: 1 << 30 });
  symlinkSync(join(ROOT, 'node_modules'), join(dir, 'node_modules'));
}
const server = await serve(dir);
const out = [];
try {
  for (const kind of KINDS) {
    const c = await chrome();
    try {
      await c.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
      const base = `http://127.0.0.1:${PORT}/`;
      await c.send('Page.navigate', { url: `${base}manifest.webmanifest` }); await sleep(300);
      await c.ev(`localStorage.clear(); localStorage.setItem('hiraeth.muted', '1');
        localStorage.setItem('hiraeth.game.v1', JSON.stringify({ flags: { 'prologue.done': true, 'item.backpack': true, 'items.v': 2 }, keepsakes: [] }));
        localStorage.setItem('hiraeth.settings.v1', JSON.stringify({ quality: '${QUALITY}', showFps: false, music: 0, effects: 0, voices: 0, soundV: 1 })); true`);
      await c.send('Page.navigate', { url: `${base}?level=arena&enemy=${encodeURIComponent(kind)}` });
      for (let i = 0; i < 600; i++) { try { if (await c.ev('!!window.__hiraethBooted && !!window.foes && !!window.player')) break; } catch { /* loading */ } await sleep(250); }
      await sleep(2000);
      const mute = await c.ev(`(() => { const s = window.sound; return { muted: !!s?.muted, master: s?.masterLevel?.() }; })()`);
      if (!mute.muted || mute.master !== 0) throw new Error('not muted: ' + JSON.stringify(mute));
      const r = await c.ev(`new Promise((done) => {
        const { foes, player, renderer } = window;
        window.sound?.setVolumes?.(0, 0);
        player.hurt = () => {}; player.knockDown = () => false; player.flinch = () => {};
        const seen = new Set(foes.list), runs = [];
        let cur = null, last = performance.now();
        const tick = (now) => {
          const dt = now - last; last = now;
          if (!cur) { const f = foes.list.find((x) => !seen.has(x) && x.alive); if (f) { seen.add(f); cur = { f, t0: now, worst: 0, programs: renderer.info.programs.length, body: f.model.body3d ?? f.model.trial ?? 'kind' }; } }
          else {
            const t = now - cur.t0;
            if (t < 2500) cur.worst = Math.max(cur.worst, dt);
            if (t > 2600 && cur.f.alive) { foes.hurt(cur.f, 'blade', new window.THREE.Vector3(-1, 0, 0), { damage: 99, source: 'charge', breaks: true }); }
            if (t > 2700) { runs.push({ worst: +cur.worst.toFixed(1), programs: renderer.info.programs.length - cur.programs, body: cur.body }); cur = null; }
          }
          if (runs.length >= ${N} || performance.now() > start + 60000) done(runs); else requestAnimationFrame(tick);
        };
        const start = performance.now(); requestAnimationFrame(tick);
      })`);
      out.push({ kind, quality: QUALITY, commit: arg('commit') ?? 'worktree', runs: r, errors: c.errors.slice(0, 3) });
      console.log(JSON.stringify(out.at(-1)));
    } finally { await c.close(); }
  }
} finally {
  await server.close();
  if (work) rmSync(work, { recursive: true, force: true });
}
