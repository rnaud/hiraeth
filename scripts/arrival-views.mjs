// Picks each route world's first views (issue #327, src/ship/arrival-view.js): the establishing shot of the first
// landing and the first step out's heading, from the world's landmarks and its sightlines, and writes them to
// src/ship/arrival-views.js. Run it again when a world's landing or landmarks move (tests/arrival-view.test.js fails
// first).
//
// The picking runs in the game itself, in a headless, muted Chrome against a Vite server of this checkout (its own
// port, never 5173): the ship stands where the game puts it, and the sightlines are cast against everything the game
// draws (its models too, which node never loads: two worlds' ships stand elsewhere in node for want of them).
//
//   node scripts/arrival-views.mjs [--worlds desert,arzach] [--check] [--port 6327]
// --check: picks and prints, writes nothing.
import { writeFileSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { viteCacheDir } from './temp-dirs.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2), arg = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const PORT = +arg('port', 6327);
if (PORT === 5173) throw new Error('5173 is the author’s own dev server');
const { ORDER } = await import(join(ROOT, 'src/levels/names.js'));
const { ARRIVAL_VIEWS } = await import(join(ROOT, 'src/ship/arrival-views.js'));
const { chrome } = await import(join(ROOT, 'scripts/cinematics-qc.mjs'));
const ids = (arg('worlds') ?? ORDER.join(',')).split(',').filter(Boolean);
const out = { ...ARRIVAL_VIEWS };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// what runs in the page, once the world has booted (window.scene, window.level, window.physics, window.ship: main.js)
const PICK = (id) => `(async () => {
  const AV = await import('/src/ship/arrival-view.js'), { Physics } = await import('/src/physics.js');
  const scene = window.scene, level = window.level, physics = window.physics, ship = window.ship;
  const { los, hit } = AV.losOf(AV.sightPhysics(scene, level, Physics));
  const rest = ship.restPos.toArray();
  // (over a sea, its surface: the Underwater City's sea port, issue #572)
  const ground = (x, z) => { const g = ship.groundAt(x, z, rest[1] + 300), s = ship.viewGround?.(x, z); return Number.isFinite(s) ? Math.max(g, s) : g; };
  // (the ground round a landmark's foot: the lowest of four points 20 m off it, its own top answering straight over it)
  const footAt = (x, z) => Math.min(...[[20, 0], [-20, 0], [0, 20], [0, -20]].map(([dx, dz]) => physics.groundAt(x + dx, 1500, z + dz, 3000)).filter(Number.isFinite));
  const marks = AV.marksOf(${JSON.stringify(id)}, level, footAt);
  const wide = AV.pickWide({ rest, marks, los, hit, ground, ...AV.VIEW_OPTS[${JSON.stringify(id)}] });
  const stand = ship.rampFoot.clone().addScaledVector(ship.outDir, 2).toArray();
  const exit = AV.pickExit({ stand, out: ship.site.heading, marks, los, hit, away: ship.hinge.toArray(), ...AV.VIEW_OPTS[${JSON.stringify(id)}] });
  const wf = wide ? AV.framed(wide, marks, los) : [];
  const ef = exit ? AV.framed(AV.rigView(stand, exit.heading, exit.pitch), marks, los, { figure: true }) : [];
  return JSON.stringify({ rest, stand, wide, exit, shaft: !!ship.site?.shaft, marks: marks.map((m) => ({ name: m.name, main: !!m.main })), wf, ef });
})()`;

const { createServer } = await import('vite');
const server = await createServer({ root: ROOT, configFile: join(ROOT, 'vite.config.js'), cacheDir: viteCacheDir('arrival-views'), logLevel: 'error', clearScreen: false,
  server: { port: PORT, strictPort: true, host: '127.0.0.1', hmr: false, watch: null } });
await server.listen();
const c = await chrome({ size: [960, 540] });
const base = `http://127.0.0.1:${PORT}/`;
const r1 = (n) => Math.round(n * 10) / 10;
try {
  for (const id of ids) {
    const t0 = Date.now();
    await c.send('Page.navigate', { url: `${base}manifest.webmanifest` }); await sleep(200);
    // (the game's own review mute as well as Chrome's: AGENTS.md, silent browser review)
    await c.ev(`localStorage.clear(); localStorage.setItem('hiraeth.muted', '1'); localStorage.setItem('hiraeth.settings.v1', JSON.stringify({ quality: 'low', showFps: false, music: 0, effects: 0, voices: 0, soundV: 1 })); true`);
    await c.send('Page.navigate', { url: `${base}index.html?level=${id}&defer=0` });
    let up = false;
    for (let i = 0; i < 4 * 300 && !up; i++) { try { up = await c.ev('!!window.__hiraethBooted && !!window.ship && !!window.physics'); } catch { /* loading */ } if (!up) await sleep(250); }
    if (!up) { console.log(`${id}: never came up (${c.errors.at(-1) ?? 'no error'})`); continue; }
    await sleep(1500);
    const R = JSON.parse(await c.ev(PICK(id)));
    const names = (f) => f.filter((m) => m.seen).map((m) => m.name);
    const { wide, exit } = R;
    console.log(`${id.padEnd(12)} wide ${wide ? `${wide.score} [${names(R.wf).join('; ')}] near ${Math.round(wide.clutter.blocked * 100)} % open ${Math.round(wide.clutter.open * 100)} %` : 'NONE'}`);
    console.log(`${''.padEnd(12)} exit ${exit ? `${exit.score} [${names(R.ef).join('; ')}] near ${Math.round(exit.clutter.blocked * 100)} % open ${Math.round(exit.clutter.open * 100)} % pitch ${exit.pitch} swing ${exit.swing}` : 'NONE'}  (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
    const missing = R.marks.filter((m) => m.main && (!R.wf.find((f) => f.name === m.name)?.seen || !R.ef.find((f) => f.name === m.name)?.seen));
    if (missing.length) console.log(`${''.padEnd(12)} MAIN NOT SEEN: ${missing.map((m) => m.name).join(', ')}`);
    out[id] = {
      ship: R.rest.map(r1), stand: R.stand.map(r1),
      wide: wide && { pos: wide.pos, look: wide.look, fov: wide.fov, drift: wide.drift },
      exit: exit && { heading: exit.heading, pitch: exit.pitch, swing: exit.swing },
      marks: { wide: names(R.wf), exit: names(R.ef) },
      ...(R.shaft ? { shaft: true } : {}),   // (a roofed dock: straight down its hatch, no glide in along the bow; issue #731)
    };
    await c.send('Page.navigate', { url: 'about:blank' }); await sleep(300);
  }
} finally { await c.close(); await server.close(); }

if (!args.includes('--check')) {
  const file = join(ROOT, 'src/ship/arrival-views.js');
  const head = readFileSync(file, 'utf8').split('\n').filter((l) => l.startsWith('//')).join('\n');
  const body = Object.entries(out).map(([k, v]) => `  ${k}: ${JSON.stringify(v)},`).join('\n');
  writeFileSync(file, `${head}\nexport const ARRIVAL_VIEWS = {\n${body}\n};\n`);
  console.log(`wrote ${file}`);
}
process.exit(0);
