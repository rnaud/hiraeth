// The guard, the parry and the evade against every attack (.claude/skills/combat-review/SKILL.md "Guard, parry and evade";
// combat-v1.4's review, docs/systems/foes.md): the Arena (?level=arena) in a MUTED headless Chrome, each kind called in turn
// (Foes.setPractice; a group kind as its group, a support with its escort), locked on, a still player whose health and
// fluid are kept up. Each time one of its blows comes (src/flurry.js foeThreat: the s until it lands, the player in its
// way), one try: the guard raised (the game's input, Ctrl: held until the blow is done) or the evade (Alt: tapped) at a
// set lead before it lands, from LEADS, every lead once for each of its attacks, and what came of it read from the
// player's own hooks (Player.guard: 'perfect' a parry, true a block; Player.dodge: an evade's i-frames swallowed it;
// Player.hurt: it got through). So each attack shows from how far ahead the guard holds, where the parry's window lies
// and where the evade's, as the game times them (GUARD.perfect, EVADE.iframes), against its wind-up as seen.
//
//   node .claude/skills/combat-review/defend.mjs [<out-dir>] [--kinds blot,crab] [--per 45] [--group role|world]
//        [--guard 0.5,0.3,0.2,0.12,0.06] [--evade 0.35,0.25,0.15,0.08,0.03]
//   PORT (default 5337; never 5173), CDP (default 5395)
// Writes <out-dir>/defend.json and defend.md (a table a kind and attack: its wind-up, each lead's outcome; grouped by the
// kind's role or by the worlds that field it, for a large roster run in batches with --kinds). No game code is changed.
import { spawn } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tempDir, ownProcess } from '../../../scripts/temp-dirs.mjs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const args = process.argv.slice(2), arg = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const OUT = resolve(args[0] && !args[0].startsWith('--') ? args[0] : join(tmpdir(), 'combat-defend'));
const PORT = Number(process.env.PORT ?? 5337), CDP = Number(process.env.CDP ?? 5395), PER = +arg('per', 45), GROUP = arg('group', 'role');
const LEADS = { guard: arg('guard', '0.5,0.3,0.2,0.12,0.06').split(',').map(Number), evade: arg('evade', '0.35,0.25,0.15,0.08,0.03').split(',').map(Number) };
if (PORT === 5173) throw new Error('5173 is the author’s own dev server: pick another PORT');
mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const L = await import(join(ROOT, 'scripts/combat-review/lib.mjs'));

const profile = tempDir('combat-defend-chrome-');
const { createServer } = await import(join(ROOT, 'node_modules/vite/dist/node/index.js'));
const server = await createServer({ root: ROOT, configFile: join(ROOT, 'vite.config.js'), ...(process.env.VITE_CACHE ? { cacheDir: process.env.VITE_CACHE } : {}), logLevel: 'error', clearScreen: false, server: { port: PORT, strictPort: true, host: '127.0.0.1', hmr: false, watch: null } });
await server.listen();
const proc = ownProcess(spawn(process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', ['--headless=new', '--mute-audio', '--autoplay-policy=user-gesture-required',
  `--remote-debugging-port=${CDP}`, `--user-data-dir=${profile}`, '--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--no-first-run', '--window-size=1280,720', '--force-device-scale-factor=1',
  '--disable-background-timer-throttling', '--disable-renderer-backgrounding', 'about:blank'], { stdio: 'ignore' }));
const done = async (code = 0) => { try { proc.kill('SIGKILL'); } catch {} try { await server.close(); } catch {} try { rmSync(profile, { recursive: true, force: true }); } catch {} process.exit(code); };   // (never leave a Chrome behind on a shared machine)
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
await ev(`localStorage.clear(); localStorage.setItem('hiraeth.muted','1');
  localStorage.setItem('hiraeth.settings.v1', JSON.stringify({ quality: 'low', music: 0, effects: 0, voices: 0, volume: 0, enemies: 'normal', hints: 'off' }));
  localStorage.setItem('hiraeth.game.v1', JSON.stringify({ flags: { 'prologue.done': true, 'item.backpack': true, 'items.v': 2, 'foes.seen': true }, keepsakes: [] })); true`);
await send('Page.navigate', { url: `http://127.0.0.1:${PORT}/?level=arena` });
let up = false; for (let i = 0; i < 900 && !up; i++) { up = (await ev('!!window.__hiraethBooted && !!window.player && !!window.foes').catch(() => false)) === true; if (!up) await sleep(100); }
if (!up) { console.error('the Arena never booted'); await done(1); }
await sleep(2000);

// the page's side: a still player kept up (health, hearts, the fluid the guard spends), his hooks read, one try a blow
const setup = await ev(`(async () => {
  window.__fl = await import('/src/flurry.js');
  const { FOES } = await import('/src/foes.js'), { SPAWN_KINDS } = await import('/src/foe-spawner.js'), { ROSTERS, rosterOf } = await import('/src/foe-worlds.js');
  const blade = await import('/src/fluid-blade.js');
  window.sound?.setVolumes?.(0, 0);
  const P = player;
  window.__keep = setInterval(() => { if (P.health < 0.7) P.health = 1; if (P.hearts < 1.5 && !P.dead) P.hearts = P.maxHearts; const R = window.tool?.reserve; if (R && R.level < R.max) R.level = R.max; }, 50);
  window.__out = [];
  const hook = (name, kind) => { const own = P[name]; if (typeof own !== 'function') return false; P[name] = function (...a) { const r = own.apply(this, a); window.__out.push({ t: performance.now(), kind, r }); return r; }; return true; };
  const hooked = { guard: hook('guard', 'guard'), dodge: hook('dodge', 'dodge'), hurt: hook('hurt', 'hurt') };
  const frame = () => new Promise((r) => requestAnimationFrame(r));
  const threatOf = (kind) => { for (const f of foes.list.filter((x) => x.alive && x.dead === undefined && x.kind === kind)) { const T = __fl.foeThreat(f, P, foes.env.slow?.() ?? 1, f.possessed ? 0.8 : 1); if (T?.near) return { T, f }; } return null; };
  /** One try against the kind's next blow: pick(atk) says which action and lead (null: let this one pass). */
  window.__try = async (kind, pick, wait = 8) => {
    const t0 = performance.now();
    while (performance.now() - t0 < wait * 1000) {
      await frame();
      const s = threatOf(kind);
      if (!s) continue;
      foes.lock = s.f;
      const atk = s.T.a?.id ?? 'strike', choice = pick(atk);
      if (!choice) { // (let it pass: wait for it to land)
        while (threatOf(kind)) await frame();
        continue;
      }
      // wait for the lead (it may be past already: the try is still made, at the lead it is)
      let T = s.T;
      while (T && T.t > choice.lead) { await frame(); const q = threatOf(kind); if (!q) { T = null; break; } T = q.T; }
      if (!T) continue;
      const at = T.t, wind = T.wind, n0 = window.__out.length;
      if (choice.action === 'guard') input.ControlLeft = true; else input.AltLeft = true;
      await frame(); await frame();
      if (choice.action === 'evade') input.AltLeft = false;
      // until the blow is done (no threat from it now) and a little after, the guard held
      const t1 = performance.now();
      while (performance.now() - t1 < 1500 && threatOf(kind)) await frame();
      for (let i = 0; i < 10; i++) await frame();
      input.ControlLeft = false; input.AltLeft = false;
      const got = window.__out.slice(n0);
      const outcome = got.some((x) => x.kind === 'guard' && x.r === 'perfect') ? 'parry' : got.some((x) => x.kind === 'guard' && x.r) ? 'block'
        : got.some((x) => x.kind === 'dodge' && x.r) ? 'evaded' : got.some((x) => x.kind === 'hurt') ? 'hit' : 'missed';
      for (let i = 0; i < 24; i++) await frame();   // (the guard's rearm, the evade's rest: GUARD.rearm, EVADE.rest)
      return { atk, wind: +wind.toFixed(2), action: choice.action, lead: choice.lead, pressedAt: +at.toFixed(3), outcome };
    }
    return null;
  };
  const worlds = {}; for (const w of Object.keys(ROSTERS)) { const R = rosterOf(w); for (const k of new Set([R.first, ...Object.keys(R.wild ?? {}), ...(R.guards ?? []), ...(R.temple ?? [])])) (worlds[k] ??= []).push(w); }
  const plain = (o) => JSON.parse(JSON.stringify(o, (k, v) => (typeof v === 'function' ? undefined : v)));
  return { hooked, kinds: SPAWN_KINDS.filter((k) => FOES[k]), defs: plain(Object.fromEntries(SPAWN_KINDS.map((k) => [k, FOES[k]]))), worlds, GUARD: plain(blade.GUARD), EVADE: plain(blade.EVADE) };
})()`);
if (!setup.hooked.guard || !setup.hooked.dodge) console.warn(`the player's hooks: ${JSON.stringify(setup.hooked)} (the guard or the evade isn't read)`);
const KINDS = (arg('kinds') ?? setup.kinds.join(',')).split(',').filter((k) => setup.kinds.includes(k));
const PLAN = [...LEADS.guard.map((lead) => ({ action: 'guard', lead })), ...LEADS.evade.map((lead) => ({ action: 'evade', lead }))];
console.log(`${KINDS.length} kinds, ${PLAN.length} tries an attack (guard at ${LEADS.guard.join(', ')} s; evade at ${LEADS.evade.join(', ')} s before the blow)`);

const results = [];
for (const kind of KINDS) {
  const D = setup.defs[kind];
  const harmful = (D.attacks ?? [D.attack]).filter((a) => a && !a.ward && !a.mend && !a.possess && (a.damage > 0 || a.knock || a.grab || a.tether || a.blind || a.slip || a.blur || a.shove || a.wave)).map((a) => a.id ?? 'strike');
  await ev(`(() => { if (player.dead || player.down) player.restart(); if (level.spawn) player.teleport(level.spawn.clone().add(new THREE.Vector3(0, 0.1, 0)), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, -1)); foes.lock = null; foes.setPractice(${JSON.stringify(kind)}); const e = foes.list.find((x) => x.kind === ${JSON.stringify(kind)})?.def.escort; if (e) foes.spawnKind(e, { n: 1, dist: 7 }); return true; })()`);
  await sleep(500);
  const tried = Object.fromEntries(harmful.map((a) => [a, []])), t0 = Date.now();
  // (the page asks which try comes next for the attack it sees: the first of the plan not yet made for it)
  while (Date.now() - t0 < PER * 1000 && Object.values(tried).some((x) => x.length < PLAN.length)) {
    const next = JSON.stringify(Object.fromEntries(Object.entries(tried).map(([a, xs]) => [a, PLAN[xs.length] ?? null])));
    const r = await ev(`__try(${JSON.stringify(kind)}, (atk) => (${next})[atk] ?? null, ${Math.min(10, PER)})`).catch((e) => ({ error: String(e).slice(0, 160) }));
    if (!r) continue;   // (nothing came in that wait: wait again, within --per)
    if (r.error) { console.log(kind, r.error); break; }
    (tried[r.atk] ??= []).push(r);
  }
  await ev('(() => { foes.setPractice(""); foes.list.slice().forEach((x) => foes.remove(x)); foes.lock = null; input.ControlLeft = false; input.AltLeft = false; return true; })()');
  const role = L.kindFacts(kind, D).role, worlds = setup.worlds[kind] ?? [];
  for (const [atk, tries] of Object.entries(tried)) {
    const a = (D.attacks ?? [D.attack]).find((x) => (x?.id ?? 'strike') === atk) ?? {};
    const row = { kind, name: D.name, role, worlds, atk, wind: a.wind ?? null, onParry: a.onParry ?? null, tries, ...L.defenceWindows(tries) };
    results.push(row);
    console.log(`${kind.padEnd(10)} ${atk.padEnd(10)} ${tries.map((t) => `${t.action[0]}${t.lead}:${t.outcome}`).join(' ')}`);
  }
}
await ev('(() => { clearInterval(window.__keep); return true; })()').catch(() => {});
writeFileSync(join(OUT, 'defend.json'), JSON.stringify({ date: new Date().toISOString(), leads: LEADS, GUARD: setup.GUARD, EVADE: setup.EVADE, results, errors: errors.slice(0, 8) }, null, 2));
writeFileSync(join(OUT, 'defend.md'), L.defenceMarkdown(results, { leads: LEADS, group: GROUP }));
console.log(L.defenceMarkdown(results, { leads: LEADS, group: GROUP }));
console.log(`written to ${OUT}`);
await done(0);
