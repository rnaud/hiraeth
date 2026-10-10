// The perfect dodge, foe by foe (.claude/skills/combat-review/SKILL.md "The perfect dodge"; docs/systems/foes.md "The back
// flip, the side hop and the flurry"): the Arena (?level=arena) in a MUTED headless Chrome, each archetype called in turn
// (Foes.setPractice) and each temple guardian into a ring (src/arena-guardians.js), locked on (R3's own Foes.cycleLock), a
// still player. When the foe's blow is due within the window (src/flurry.js: its time to land under dodgeLead of its
// wind-up, the player in its way), the keyboard presses back and jump (KeyboardEvent S, then Space: the game's own input,
// Player.hop), and the page reads whether the back flip went off and the flurry began (src/feel.js flurryLeft). With
// --side, D instead of S: the side hop.
//
//   node .claude/skills/combat-review/dodge.mjs [<out-dir>] [--kinds blot,crab] [--guardians no] [--side] [--wait 9]
//   PORT (default 5335; never 5173), CDP (default 5393)
// Writes <out-dir>/dodge.json and prints a table: each foe, the attack dodged, its wind-up, when the keys went down
// (s before it would land), the window, and whether the hop and the flurry happened. No game code is changed.
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const args = process.argv.slice(2), arg = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const OUT = resolve(args[0] && !args[0].startsWith('--') ? args[0] : join(tmpdir(), 'combat-dodge'));
const PORT = Number(process.env.PORT ?? 5335), CDP = Number(process.env.CDP ?? 5393), WAIT = +arg('wait', 9), KEY = args.includes('--side') ? 'KeyD' : 'KeyS';
if (PORT === 5173) throw new Error('5173 is the author’s own dev server: pick another PORT');
mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const { createServer } = await import(join(ROOT, 'node_modules/vite/dist/node/index.js'));
const server = await createServer({ root: ROOT, configFile: join(ROOT, 'vite.config.js'), logLevel: 'error', clearScreen: false, server: { port: PORT, strictPort: true, host: '127.0.0.1', hmr: false, watch: null } });
await server.listen();
const profile = mkdtempSync(join(tmpdir(), 'combat-dodge-chrome-'));
const proc = spawn(process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', ['--headless=new', '--mute-audio', '--autoplay-policy=user-gesture-required',
  `--remote-debugging-port=${CDP}`, `--user-data-dir=${profile}`, '--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--no-first-run', '--window-size=1280,720', '--force-device-scale-factor=1',
  '--disable-background-timer-throttling', '--disable-renderer-backgrounding', 'about:blank'], { stdio: 'ignore' });
const done = async (code = 0) => { try { proc.kill('SIGKILL'); } catch {} try { await server.close(); } catch {} process.exit(code); };   // (never leave a Chrome behind on a shared machine)
process.on('uncaughtException', (e) => { console.error(e); done(1); });
let tabs; for (let i = 0; i < 80 && !tabs; i++) { try { tabs = (await (await fetch(`http://localhost:${CDP}/json`)).json()).filter?.((t) => t.webSocketDebuggerUrl); if (!tabs?.length) tabs = null; } catch { await sleep(250); } }
if (!tabs) { console.error(`no Chrome on debugging port ${CDP}`); await done(1); }
const ws = new WebSocket(tabs.find((t) => t.type === 'page').webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r));
let id = 0; const waits = new Map(), errors = [];
ws.addEventListener('message', (m) => { const d = JSON.parse(m.data); if (d.id && waits.has(d.id)) { waits.get(d.id)(d); waits.delete(d.id); } if (d.method === 'Runtime.exceptionThrown') errors.push((d.params.exceptionDetails?.exception?.description ?? '').slice(0, 200)); });
const send = (method, params = {}) => new Promise((res) => { const i = ++id; waits.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (e) => { const d = await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true }); if (d.result?.exceptionDetails) throw new Error(`page: ${d.result.exceptionDetails.exception?.description?.slice(0, 300)}`); return d.result?.result?.value; };
await send('Page.enable'); await send('Runtime.enable'); await send('Emulation.setFocusEmulationEnabled', { enabled: true });
await send('Page.navigate', { url: `http://127.0.0.1:${PORT}/manifest.webmanifest` }); await sleep(250);
await ev(`localStorage.clear(); localStorage.setItem('moebius.muted','1');
  localStorage.setItem('moebius.settings.v1', JSON.stringify({ quality: 'low', music: 0, effects: 0, voices: 0, volume: 0, enemies: 'normal', hints: 'off' }));
  localStorage.setItem('moebius.game.v1', JSON.stringify({ flags: { 'prologue.done': true, 'item.backpack': true, 'items.v': 2, 'foes.seen': true }, keepsakes: [] })); true`);
await send('Page.navigate', { url: `http://127.0.0.1:${PORT}/?level=arena` });
let up = false; for (let i = 0; i < 900 && !up; i++) { up = (await ev('!!window.__moebiusBooted && !!window.player && !!window.foes').catch(() => false)) === true; if (!up) await sleep(100); }
if (!up) { console.error('the Arena never booted'); await done(1); }
await sleep(2000);

// the page's side: a still player kept alive; the wait for the window, the keys, what came of them
await ev(`(async () => {
  window.__fl = await import('/src/flurry.js'); window.__feel = await import('/src/feel.js'); window.__boss = await import('/src/temples/boss.js');
  const P = player; window.__keep = setInterval(() => { if (P.health < 0.7) P.health = 1; if (P.hearts < 1.5 && !P.dead) P.hearts = P.maxHearts; }, 50);
  const key = (type, code) => window.dispatchEvent(new KeyboardEvent(type, { code, key: code === 'Space' ? ' ' : code.slice(3).toLowerCase(), bubbles: true }));
  const frame = () => new Promise((r) => requestAnimationFrame(r));
  /** Wait (up to wait s) for a blow due inside the window; then press KEY + Space; what happened. */
  window.__dodgeTry = async (wait, KEY, threatOf) => {
    const t0 = performance.now();
    while (performance.now() - t0 < wait * 1000) {
      await frame();
      if (!foes.lock) foes.cycleLock();
      const T = threatOf();
      if (!T || !T.near || !(T.t <= __fl.dodgeLead(T.wind, foes.gentle) * 0.75) || !player.onGround) continue;
      const before = T.t, lead = __fl.dodgeLead(T.wind, foes.gentle), atk = T.a?.id ?? '?';
      key('keydown', KEY); await frame(); key('keydown', 'Space'); await frame(); await frame();
      const hop = player.hopping?.kind ?? null, flurry = __feel.flurryLeft() > 0;
      key('keyup', 'Space'); key('keyup', KEY);
      for (let i = 0; i < 40; i++) await frame();
      return { atk, wind: +T.wind.toFixed(2), pressedAt: +before.toFixed(3), lead: +lead.toFixed(3), hop, flurry, locked: !!foes.lock };
    }
    return { timeout: true };
  };
  return true;
})()`);

const results = [];
// (a flurry may only follow another FLURRY.time + FLURRY.again s after it began, main.js startFlurry: wait that out between foes)
let lastFlurry = 0;
const rested = async () => { const gap = 5000 - (Date.now() - lastFlurry); if (gap > 0) await sleep(gap); };
const kinds = arg('kinds') ? arg('kinds').split(',') : await ev(`(async () => { const { ARCHETYPES } = await import('/src/enemies/archetypes.js'); return [...new Set(Object.values(ARCHETYPES).map((A) => A.kind))]; })()`);
for (const kind of kinds) {
  await rested();
  await ev(`(() => { __feel.resetFeel?.(); if (player.dead || player.down) player.restart(); foes.lock = null; foes.setPractice(${JSON.stringify(kind)}); return true; })()`);
  await sleep(500);
  const r = await ev(`__dodgeTry(${WAIT}, '${KEY}', () => { const fs = foes.list.filter((f) => f.alive && f.dead === undefined && f.kind === ${JSON.stringify(kind)}); for (const f of fs) { const T = __fl.foeThreat(f, player, foes.env.slow?.() ?? 1); if (T) return T; } return null; })`).catch((e) => ({ error: String(e).slice(0, 120) }));
  if (r.hop) lastFlurry = Date.now();
  results.push({ foe: kind, ...r });
  console.log(kind.padEnd(12), JSON.stringify(r));
}
await ev('(() => { foes.setPractice(""); foes.list.slice().forEach((x) => foes.remove(x)); foes.lock = null; return true; })()');

if (arg('guardians', 'yes') !== 'no') {
  const ids = await ev(`(async () => { const { GUARDIANS } = await import('/src/arena-guardians.js'); return GUARDIANS.map((G) => G.id); })()`);
  for (const gid of ids) {
    await rested();
    const r = await ev(`(async () => {
      __feel.resetFeel?.(); if (player.dead || player.down) player.restart();
      const { ArenaGuardians } = await import('/src/arena-guardians.js');
      window.__ag?.dismiss(); cancelAnimationFrame(window.__agTick ?? 0);
      const A = window.__ag = new ArenaGuardians({ scene, player, physics, sound: null, notice() {} });
      const g = A.call('${gid}');
      let last = performance.now();
      const tick = () => { const now = performance.now(); A.update(Math.min(0.05, (now - last) / 1000) * (__feel.flurryLeft() > 0 ? 0.12 : 1), now / 1000); last = now; window.__agTick = requestAnimationFrame(tick); };
      tick();
      // into the ring, a little way from it: it wakes and comes on
      const c = A.current.ring?.position ?? g.arena.center;
      player.respawn?.(g.arena.center.clone().lerp(g.model.pos, 0.35));
      for (let i = 0; i < 300 && g.state !== 'fight'; i++) await new Promise((r) => requestAnimationFrame(r));
      foes.lock = null; foes.cycleLock();
      const res = await __dodgeTry(${WAIT + 6}, '${KEY}', () => __fl.guardianThreat(g, player));
      res.lockedGuardian = !!foes.lock?.guardian;
      A.dismiss(); cancelAnimationFrame(window.__agTick ?? 0); foes.lock = null;
      return res;
    })()`).catch((e) => ({ error: String(e).slice(0, 160) }));
    if (r.hop) lastFlurry = Date.now();
    results.push({ foe: `guardian:${gid}`, ...r });
    console.log(`guardian:${gid}`.padEnd(20), JSON.stringify(r));
  }
}
await ev('(() => { clearInterval(window.__keep); return true; })()').catch(() => {});
writeFileSync(join(OUT, 'dodge.json'), JSON.stringify({ date: new Date().toISOString(), key: KEY, results, errors: errors.slice(0, 8) }, null, 2));
const ok = results.filter((r) => r.flurry).length;
console.log(`\n${ok} of ${results.length} dodged into a flurry (${KEY === 'KeyS' ? 'the back flip' : 'the side hop'}); timeouts: ${results.filter((r) => r.timeout).map((r) => r.foe).join(', ') || 'none'}; errors: ${errors.length}`);
console.log(`written to ${join(OUT, 'dodge.json')}`);
await done(0);
