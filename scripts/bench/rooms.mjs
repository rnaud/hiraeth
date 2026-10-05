// The rooms off the map, world by world (the portals into rooms built far over the map: the desert's cave
// and chambers, every temple's rooms): what a frame draws in each with the interior culling
// (perf.js InteriorCuller) and without it, looking in from the door and back out through it, with
// screenshots of both ways (the look must not change).
//   npx vite build && node scripts/bench/serve.mjs --port 6851 &
//   node scripts/bench/rooms.mjs --url http://localhost:6851/ [--preset handheld] [--levels desert,edena] [--shots dir]
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { options, viewpoints, sleep } from './lib.mjs';
import { launch } from './browser.mjs';
import { SCALE, prepareStorage, conditions } from './web-page.mjs';

const opt = options();
const BASE = (opt.url ?? 'http://localhost:6851/').replace(/\/?$/, '/');
const preset = opt.preset ?? 'handheld';
const LEVELS = (typeof opt.levels === 'string' ? opt.levels : 'desert,edena,incal,arzach,arzach2,garage,buried,bazaar,perdide,perdide2,spheres').split(',');
const shots = typeof opt.shots === 'string' ? resolve(opt.shots) : null;
if (shots) mkdirSync(shots, { recursive: true });
const VP = viewpoints();

const profile = resolve(`/tmp/.chrome-rooms-${process.pid}`);
const { ctx, page } = await launch({ w: 1280, h: 720, profile });
const ev = (fn, arg) => page.evaluate(fn, arg);
page.on('pageerror', (e) => console.error('page error:', String(e).slice(0, 200)));
await page.goto(BASE + 'manifest.webmanifest');
await prepareStorage(ev, preset);
const out = [];
for (const id of LEVELS) {
  await page.goto(BASE + '?level=' + id, { waitUntil: 'load' });
  try { await page.waitForFunction(() => window.__moebiusBooted && window.renderFrame && window.player, null, { timeout: 300000, polling: 100 }); } catch { console.log(id, 'did not boot'); continue; }
  await sleep(3000);
  await conditions(ev, { hour: VP.hour, weather: VP.weather, scale: SCALE[preset] ?? 1 });
  const rooms = await ev(() => {
    const seen = [];
    for (const p of level.portals ?? []) {
      if (!p.to || p.toUp || !(p.to.y - (terrain.heightAt?.(p.to.x, p.to.z) ?? p.to.y) > 200)) continue;
      if (seen.some((s) => Math.hypot(s.to[0] - p.to.x, s.to[1] - p.to.y, s.to[2] - p.to.z) < 5)) continue;
      seen.push({ label: p.label ?? p.temple ?? 'room', to: p.to.toArray(), heading: p.heading ?? 0 });
    }
    return { rooms: seen, culler: interiorCull.rooms.length };
  });
  console.log(`\n${id}: ${rooms.rooms.length} rooms off the map (the culler knows ${rooms.culler})`);
  for (const [k, r] of rooms.rooms.entries()) {
    for (const look of ['in', 'out']) {
      await ev(({ r, look }) => {
        const f = [Math.sin(r.heading), 0, Math.cos(r.heading)], t = r.to, s = look === 'in' ? 1 : -1;
        window.__benchPlace(t, r.heading);
        const eye = look === 'in' ? [t[0] - f[0] * 3.5, t[1] + 2.2, t[2] - f[2] * 3.5] : [t[0] + f[0] * 3, t[1] + 1.7, t[2] + f[2] * 3];
        window.__benchSet(eye, [t[0] + s * f[0] * 14, t[1] + 1.2, t[2] + s * f[2] * 14], 60);
        return 1;
      }, { r, look });
      await sleep(2000);
      const m = {};
      for (const mode of ['on', 'off']) {
        await ev((mode) => { if (mode === 'off') { window.__ir = interiorCull.rooms; interiorCull.rooms = []; } return 1; }, mode);
        await sleep(400);
        m[mode] = await ev(() => {
          const gl = renderer.getContext(), px = new Uint8Array(4);
          const run = (n) => { const t0 = performance.now(); for (let i = 0; i < n; i++) renderFrame(); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); return (performance.now() - t0) / n; };
          run(8); const a = [run(12), run(12), run(12)].sort((x, y) => x - y);
          frameStats.calls = frameStats.tris = frameStats.n = 0; for (let i = 0; i < 4; i++) renderFrame();   // (the shadow maps take turns)
          return { ms: +a[1].toFixed(2), calls: Math.round(frameStats.calls / 4), ktris: Math.round(frameStats.tris / 4000), inside: !!interiorCull.active };
        });
        if (shots) await page.screenshot({ path: join(shots, `${id}-${k}-${look}-${mode}.png`) });
        await ev((mode) => { if (mode === 'off') interiorCull.rooms = window.__ir; return 1; }, mode);
      }
      console.log(`  ${String(k).padStart(2)} ${r.label.slice(0, 28).padEnd(28)} ${look.padEnd(3)} culled: ${JSON.stringify(m.on)}  as before: ${JSON.stringify(m.off)}`);
      out.push({ level: id, room: k, label: r.label, look, ...m });
    }
  }
}
if (opt.out) writeFileSync(resolve(opt.out), JSON.stringify(out, null, 1) + '\n');
await ctx.close();
rmSync(profile, { recursive: true, force: true });
process.exit(0);
