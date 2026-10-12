// The combat review's measurements (.claude/skills/combat-review/SKILL.md): the Arena (?level=arena) driven in a MUTED
// headless Chrome on the real GPU, every foe kind the game has called in turn (src/foe-spawner.js SPAWN_KINDS, through
// Foes.setPractice: no game code changed), a scripted player standing still in front of it:
//
//   telegraphs     how long each wind-up lasts as seen (the foe's state 'wind', per attack), against its tuning
//   frequency      attacks a minute, and the health a minute a still player loses (his health kept topped up)
//   time to kill   each move's blows (scripts/combat-review/lib.mjs movesFrom: the light combo, the charged cut, the
//                  air cut, the riposte, the dash cut, the gun's modes) dealt through Foes.hurt with the move's damage
//                  and source, so armour, shells, weak points and immunities answer as in play; blows × the move's cycle
//   contact sheet  each kind at the height of its wind-up, tiled (docs/audits/combat-v<version>/telegraphs.webp)
//   guardians      each guardian in an Arena ring, phase by phase, held at 85 % of the phase's first move (guardians.webp;
//                  --guardians no to skip)
//
// The guardians are read from their temples' defs (src/temples/*.js: any export with phases and attacks) and scored
// from their tuning; they are reviewed by playing their temples (the Arena has no ring for them).
//
//   node .claude/skills/combat-review/arena.mjs <out-dir> [--kinds blot,crab] [--watch 24] [--version 1.4]
//   PORT (default 5333; never 5173), CDP (Chrome's debugging port, default 5391)
// Writes <out-dir>/combat.json, <out-dir>/telegraphs.png (and .webp if cwebp is there) and <out-dir>/combat.md (the
// scored tables, ready to paste into docs/audits/combat-v<version>.md).
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tempDir, ownProcess } from '../../../scripts/temp-dirs.mjs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { deflateSync, crc32 } from 'node:zlib';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const args = process.argv.slice(2), arg = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const OUT = resolve(args[0] && !args[0].startsWith('--') ? args[0] : join(tmpdir(), 'combat-review'));
const WATCH = +arg('watch', 24), W = 1280, H = 720, GROUP = arg('group', null);   // (--group role|world: the foes' table in parts)
const PORT = Number(process.env.PORT ?? 5333), CDP = Number(process.env.CDP ?? 5391);
if (PORT === 5173) throw new Error('5173 is the author’s own dev server: pick another PORT');
mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { decodePNG } = await import(join(ROOT, 'scripts/png.mjs'));
const L = await import(join(ROOT, 'scripts/combat-review/lib.mjs'));
const VERSION = arg('version', (await import(join(ROOT, 'src/changelog.js'))).CHANGELOG?.[0]?.v ?? 'x');

/** The scored tables (combat.md), from the scored foes and guardians. */
function report(scored, gScored, MOVES, WATCH) {
  const s = (x) => (x === null || x === undefined ? '-' : x);
  return [
    `## Foes (${scored.length} kinds, the Arena, a still player, ${WATCH} s each)`, '',
    // (a large roster, run in batches with --kinds: --group role|world splits the table, a heading each)
    ...Object.entries(GROUP ? L.groupRows(scored, GROUP) : { '': scored }).flatMap(([g, rows]) => [...(g ? [`### ${GROUP === 'world' ? 'First fielded in' : 'Role'}: ${g}`, ''] : []),
      L.table(['kind', 'read', 'counter', 'space', 'fair', 'identity', 'combines', '**total**', 'wind seen (s)', 'attacks/min', 'health/min', ...MOVES.map((m) => `ttk ${m.id}`)],
        rows.map((r) => [r.name, r.score.readability, r.score.counterplay, r.score.space, r.score.fairness, r.score.identity, r.score.combines, `**${r.score.total}**`,
          s(r.windSeen?.toFixed(2)), r.attacksPerMin, r.damagePerMin, ...MOVES.map((m) => (r.ttk[m.id]?.dead ? `${r.ttk[m.id].s}${r.ttk[m.id].from === 'behind' ? ' (behind)' : ''}` : r.ttk[m.id] ? '∞' : '-'))])), '']),
    ...(scored.some((r) => r.free) ? ['## Puppeteers: their strings on a host, and freeing it', '',
      'Called in with its escort; the s until its strings drop on a creature, the driven host watched (its wind-ups, its attacks a minute, the harm a minute a still player takes), the strings then cut as a hit on the rope does, and the s until it strings again. To free it: the wait for the strings, then the first blow of a move that cuts one.', '',
      L.table(['kind', 'host', 'strung after (s)', 'host wind driven (s)', 'host attacks/min driven', 'harm/min driven', 'free with the air cut (s)', 'free with an ember (s)', 'strung again after (s)', 'ttk best (s)'],
        scored.filter((r) => r.free).map((r) => { const F = r.free; const best = Math.min(...Object.values(r.ttk).filter((x) => x?.dead).map((x) => x.s));
          return F.error ? [r.name, F.error] : [r.name, F.host, F.strung, s(F.hostWind), F.hostAttacksPerMin, F.harmPerMin, s(F.cut?.air), s(F.cut?.fire), F.again ?? `not in 15${F.ranOut ? ' (ran out)' : ''}`, Number.isFinite(best) ? best : '∞']; })), ''] : []),
    ...(scored.some((r) => Object.keys(r.live ?? {}).length) ? ['## Rollers: the moves dealt live (it rolls up between blows)', '',
      'Its share of the watch spent rolled up (Foe.rolling: a cut, a shot, an ember glance off the shell), and each move dealt every cycle while it fights, against the time to kill above (dealt on it at rest).', '',
      L.table(['kind', 'rolled up (share)', ...['shoot', 'fire', 'push', 'combo'].flatMap((id) => [`${id} live (s)`, `${id} at rest (s)`, `${id} glanced`])],
        scored.filter((r) => Object.keys(r.live ?? {}).length).map((r) => [r.name, r.rollShare, ...['shoot', 'fire', 'push', 'combo'].flatMap((id) => { const v = r.live[id]; return [v?.dead ? v.s : v ? '∞' : '-', r.ttk[id]?.dead ? r.ttk[id].s : '∞', v ? `${v.glanced} of ${v.landed + v.glanced}` : '-']; })])), ''] : []),
    `## Guardians (${gScored.length}, from their tuning)`, '',
    L.table(['guardian', 'world', 'read', 'counter', 'space', 'fair', 'phases', '**total**', 'why'],
      gScored.map((g) => [g.name, g.world, g.score.readability, g.score.counterplay, g.score.space, g.score.fairness, g.score.phases, `**${g.score.total}**`, g.score.why])), '',
    '## Why each foe scored as it did', '',
    ...scored.map((r) => `- **${r.name}**: ${Object.entries(r.score.why).map(([k, v]) => `${k}: ${v}`).join('; ')}.`),
  ].join('\n');
}

// --rescore <combat.json>: the scores and the tables again from a run's numbers (after the rubric changed), no browser
if (arg('rescore')) {
  const { readFileSync } = await import('node:fs');
  const J = JSON.parse(readFileSync(resolve(arg('rescore')), 'utf8'));
  const roles = {}; for (const f of J.foes) roles[f.facts.role] = (roles[f.facts.role] ?? 0) + 1;
  // (--moves-now: the times to kill again from each run's blows with the moves timed as lib.mjs times them now; the
  // tuning the run had is in its moves, so only the timing changes)
  if (args.includes('--moves-now')) {
    const tun = J.tuning ?? await (async () => { const b = await import(join(ROOT, 'src/fluid-blade.js')), t = await import(join(ROOT, 'src/fluid-tool.js')), k = await import(join(ROOT, 'src/fluid-kit.js'));
      return { BLADE: b.BLADE, SWINGS: b.SWINGS, CHARGE: b.CHARGE, AIR: b.AIR, RIPOSTE: b.RIPOSTE, DASH: b.DASH, FLUID: t.FLUID, MODES: k.MODES }; })();
    const now = L.movesFrom(tun); J.moves = J.moves.map((m) => ({ ...m, ...(m.hits ? { cycles: now.find((x) => x.id === m.id)?.cycles, cooldown: now.find((x) => x.id === m.id)?.cooldown } : {}) }));
    for (const r of J.foes) for (const m of J.moves) { const t = r.ttk[m.id], cyc = r.winds && Object.values(r.winds).length ? (J.watch / Object.values(r.winds).reduce((a, b) => a + b, 0)) : 3; if (t?.dead) t.s = L.openingTime(L.timeToKill({ ...t, hits: t.landed + (t.from === 'behind' ? 0 : t.wasted) }, m, cyc), t, m, cyc); } }
  J.foes = J.foes.map((r) => ({ ...r, score: L.scoreKind(r.facts, r, r.worlds ?? 0, roles[r.facts.role]) }));
  J.guardians = J.guardians.map((g) => ({ ...g, score: L.scoreGuardian(g) }));
  writeFileSync(join(OUT, 'combat.json'), JSON.stringify(J, null, 2));
  writeFileSync(join(OUT, 'combat.md'), report(J.foes, J.guardians, J.moves, J.watch));
  console.log(`rescored into ${OUT}`);
  process.exit(0);
}

// ---------------------------------------------------------------- the guardians, from their temples (node)
const guardians = [];
for (const f of readdirSync(join(ROOT, 'src/temples')).filter((f) => /^[a-z0-9]+\.js$/.test(f) && !/^(boss|guardians|kit|logic|pieces|runtime|index|hints|migrate)\.js$/.test(f))) {
  try {
    const m = await import(pathToFileURL(join(ROOT, 'src/temples', f)).href);
    for (const [k, v] of Object.entries(m)) if (v && typeof v === 'object' && Array.isArray(v.phases) && v.attacks && (v.kind === 'organic' || v.kind === 'robot')) guardians.push({ world: f.replace('.js', ''), export: k, ...L.guardianFacts(`${f.replace('.js', '')}.${k}`, v) });
  } catch (e) { guardians.push({ world: f, error: String(e).slice(0, 160) }); }
}

// ---------------------------------------------------------------- the browser
const { createServer } = await import(join(ROOT, 'node_modules/vite/dist/node/index.js'));
const server = await createServer({ root: ROOT, configFile: join(ROOT, 'vite.config.js'), logLevel: 'error', clearScreen: false,
  server: { port: PORT, strictPort: true, host: '127.0.0.1', hmr: false, watch: null } });
await server.listen();
const BASE = `http://127.0.0.1:${PORT}/`;
const profile = tempDir('combat-review-chrome-');
const proc = ownProcess(spawn(process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', ['--headless=new', '--mute-audio', '--autoplay-policy=user-gesture-required',
  `--remote-debugging-port=${CDP}`, `--user-data-dir=${profile}`, '--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--no-first-run', `--window-size=${W},${H}`, '--force-device-scale-factor=1',
  '--disable-background-timer-throttling', '--disable-renderer-backgrounding', 'about:blank'], { stdio: 'ignore' }));
process.on('exit', () => { try { proc.kill('SIGKILL'); } catch {} });   // (never leave a Chrome behind on a shared machine)
process.on('uncaughtException', (e) => { console.error(e); process.exit(1); });
let tabs; for (let i = 0; i < 80 && !tabs; i++) { try { tabs = (await (await fetch(`http://localhost:${CDP}/json`)).json()).filter?.((t) => t.webSocketDebuggerUrl); if (!tabs?.length) tabs = null; } catch { await sleep(250); } }
if (!tabs) throw new Error(`no Chrome on debugging port ${CDP} (set CDP to a free port)`);
const ws = new WebSocket(tabs.find((t) => t.type === 'page').webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r));
let id = 0; const waits = new Map(), errors = [];
ws.addEventListener('message', (m) => { const d = JSON.parse(m.data); if (d.id && waits.has(d.id)) { waits.get(d.id)(d); waits.delete(d.id); }
  if (d.method === 'Runtime.exceptionThrown') errors.push((d.params.exceptionDetails?.exception?.description ?? '').slice(0, 200)); });
const send = (method, params = {}) => new Promise((res) => { const i = ++id; waits.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (e) => { const d = await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true }); if (d.result?.exceptionDetails) throw new Error(`page: ${d.result.exceptionDetails.exception?.description?.slice(0, 300)}`); return d.result?.result?.value; };
await send('Page.enable'); await send('Runtime.enable'); await send('Emulation.setFocusEmulationEnabled', { enabled: true });
await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false });

await send('Page.navigate', { url: `${BASE}manifest.webmanifest` }); await sleep(250);
await ev(`localStorage.clear(); localStorage.setItem('hiraeth.muted','1');
  localStorage.setItem('hiraeth.settings.v1', JSON.stringify({ quality: 'medium', music: 0, effects: 0, voices: 0, volume: 0, enemies: 'normal' }));
  localStorage.setItem('hiraeth.game.v1', JSON.stringify({ flags: { 'prologue.done': true, 'item.backpack': true, 'items.v': 2, 'foes.seen': true }, keepsakes: [] })); true`);
await send('Page.navigate', { url: `${BASE}?level=arena` });
let up = false;
for (let tries = 0; tries < 2 && !up; tries++) {
  if (tries) await send('Page.reload');
  for (let i = 0; i < 900 && !up; i++) { up = (await ev('!!window.__hiraethBooted && !!window.player && !!window.foes').catch(() => false)) === true; if (!up) await sleep(100); }
}
if (!up) throw new Error('the Arena never booted');
await sleep(2500);

// the page's side: the kinds and their tuning, the moves, a still player whose health is kept up and whose hurts are counted
const setup = await ev(`(async () => {
  const { FOES } = await import('/src/foes.js');
  const { SPAWN_KINDS } = await import('/src/foe-spawner.js');
  const blade = await import('/src/fluid-blade.js'), tool = await import('/src/fluid-tool.js'), kit = await import('/src/fluid-kit.js');
  const { ROSTERS } = await import('/src/foe-worlds.js');
  window.sound?.setVolumes?.(0, 0);
  window.__fl = await import('/src/flurry.js');   // (the lock-on look: the blow that comes soonest)
  if (window.weather) { window.weather.mode = 'clear'; window.weather.intensity = 0; }
  const s = document.createElement('style'); s.textContent = '#toast, #inputs, #foe-spawner { visibility: hidden !important; }'; document.head.appendChild(s);
  const P = window.player, hurt = P.hurt.bind(P);
  window.__dmg = [];
  // (every hurt counted; topped up after it so a still player is never knocked out: two blows at once, a shatter's ring
  // on top of a roll, left him out cold and every kind after him had nobody to fight)
  P.hurt = (d, why) => { window.__dmg.push({ t: performance.now(), d, why }); const r = hurt(d, why); if (P.hearts < 1.5 && !P.dead) P.hearts = P.maxHearts; return r; };
  window.__keep = setInterval(() => { if (P.health < 0.7) P.health = 1; }, 50);
  const plain = (o) => JSON.parse(JSON.stringify(o, (k, v) => (typeof v === 'function' ? undefined : v)));
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const alive = (k) => foes.list.filter((x) => x.alive && x.dead === undefined && (!k || x.kind === k));
  /**
   * A puppeteer driving a host (combat-v1.18 rec. 4): called in with its escort, the s until its strings drop on a creature
   * (possessed), how the driven host fights (its wind-ups and its attacks a minute while driven, watched \`drive\` s), then the
   * strings cut as a hit on the rope does (Foes.cutStrings: what the air cut, the boomerang and an ember call), and the s
   * until it strings again. null if it never strung within \`cap\` s.
   */
  window.__free = async (kind, escort, drive = 8, cap = 15) => {
    if (player.dead || player.down) player.restart();
    foes.setPractice(kind); if (escort) foes.spawnKind(escort, { n: 1, dist: 7 });
    window.__dmg.length = 0;
    const t0 = performance.now(); let host = null;
    while (!host && performance.now() - t0 < cap * 1000) { await wait(40); host = alive().find((x) => x.possessed?.by?.kind === kind) ?? null; if (!foes.lock) foes.lock = alive(kind)[0] ?? null; }
    if (!host) return null;
    const strung = (performance.now() - t0) / 1000;
    const winds = [], d0 = window.__dmg.length, t1 = performance.now(); let prev = host.state, wStart = null;
    while (performance.now() - t1 < drive * 1000 && host.possessed && host.alive) {
      await wait(30);
      if (host.state === 'wind' && prev !== 'wind') wStart = performance.now();
      if (host.state !== 'wind' && prev === 'wind' && wStart) winds.push((performance.now() - wStart) / 1000);
      prev = host.state;
    }
    const drove = (performance.now() - t1) / 1000, stillDriven = !!host.possessed;
    const harm = window.__dmg.slice(d0).reduce((a, d) => a + d.d, 0);
    if (stillDriven) foes.cutStrings(host);
    const freed = !host.possessed;
    const t2 = performance.now(); let again = null;
    while (again === null && performance.now() - t2 < cap * 1000) { await wait(40); if (alive().some((x) => x.possessed?.by?.kind === kind)) again = (performance.now() - t2) / 1000; }
    foes.list.slice().forEach((x) => foes.remove(x));
    return { host: host.kind, strung: +strung.toFixed(2), drove: +drove.toFixed(2), ranOut: !stillDriven, freed, again: again === null ? null : +again.toFixed(2),
      hostWind: winds.length ? +(winds.sort((a, b) => a - b)[Math.floor(winds.length / 2)]).toFixed(2) : null, hostAttacksPerMin: +(winds.length / Math.max(drove, 1e-3) * 60).toFixed(1), harmPerMin: +(harm / Math.max(drove, 1e-3) * 60).toFixed(2) };
  };
  /**
   * A move dealt live (a scripted player trading from where he stands): the foe fights as it likes and a blow goes in every
   * move's cycle (\`cycles\`: each blow's own s), so a roller rolled up glances them off its shell as it would in play. The s
   * until it is dead (null: not in \`cap\` s), the blows that landed and the ones that glanced.
   */
  window.__live = async (kind, m, cap = 40) => {
    if (player.dead || player.down) player.restart();
    foes.setPractice(kind); await wait(250);
    const f = alive(kind)[0]; if (!f) return null;
    // (from its first wind-up on: dealt on it while it sits, it dies before it ever rolls)
    for (let w = 0; w < 300 && f.state !== 'wind'; w++) { foes.lock = f; await wait(40); }
    let landed = 0, glanced = 0, i = 0; const t0 = performance.now();
    while (f.alive && f.dead === undefined && performance.now() - t0 < cap * 1000) {
      foes.lock = f;
      const dir = f.pos.clone().sub(player.pos).setY(0).normalize(), hp = f.hp, rolled = !!f.rolling;
      foes.hurt(f, m.mode, dir, { damage: m.hits ? m.hits[i % m.hits.length] : m.damage, source: m.source, breaks: !!m.breaks, air: m.source === 'air', ...(m.hits ? { combo: i % m.hits.length } : {}) });
      if (!f.alive || f.hp < hp) landed++; else { glanced++; if (rolled) f.__rolledGlance = (f.__rolledGlance ?? 0) + 1; }
      await wait(1000 * (m.cycles ? m.cycles[i % m.cycles.length] : m.cycle)); i++;
    }
    const dead = !f.alive || f.dead !== undefined, s = (performance.now() - t0) / 1000, rolledGlances = f.__rolledGlance ?? 0;
    foes.list.slice().forEach((x) => foes.remove(x));
    return { dead, s: dead ? +s.toFixed(2) : null, landed, glanced, rolledGlances };
  };
  const { rosterOf } = await import('/src/foe-worlds.js');
  const worlds = {}; for (const w of Object.keys(ROSTERS)) { const R = rosterOf(w); for (const k of new Set([R.first, ...Object.keys(R.wild ?? {}), ...(R.guards ?? []), ...(R.temple ?? []), ...(R.shade > 0 ? ['shade'] : [])])) (worlds[k] ??= []).push(w); }
  // a kind that only comes out of another (a golem's splinters) fights where its parent does
  for (const [k, D] of Object.entries(FOES)) if (D.splits?.kind) worlds[D.splits.kind] = [...new Set([...(worlds[D.splits.kind] ?? []), ...(worlds[k] ?? [])])];
  return { hearts: P.maxHearts ?? 1, kinds: SPAWN_KINDS.filter((k) => FOES[k]), defs: plain(Object.fromEntries(SPAWN_KINDS.map((k) => [k, FOES[k]]))), worlds,
    tuning: plain({ BLADE: blade.BLADE, SWINGS: blade.SWINGS, CHARGE: blade.CHARGE, AIR: blade.AIR, RIPOSTE: blade.RIPOSTE, DASH: blade.DASH, FLUID: tool.FLUID, MODES: kit.MODES }),
    extra: plain({ GUARD: blade.GUARD, EVADE: blade.EVADE, LOCK: (await import('/src/foes.js')).LOCK }) };
})()`);
// --packs route|desert,arzach…: the difficulty curve instead: each world's packs (src/foe-worlds.js packOf, seeded, in the
// world's skins) watched against the still player, then scored with each kind's time to kill from a kinds run (--ttk)
const PACKS = arg('packs') ? (arg('packs') === 'route' ? (await import(join(ROOT, 'src/levels/names.js'))).ORDER : arg('packs').split(',')) : null;
const KINDS = PACKS && !arg('kinds') ? [] : (arg('kinds') ?? setup.kinds.join(',')).split(',').filter((k) => setup.kinds.includes(k));
const MOVES = L.movesFrom(setup.tuning);
console.log(`${KINDS.length} kinds, ${guardians.length} guardians, ${MOVES.length} moves`);

const shots = [];
const results = [];
for (const kind of KINDS) {
  // ---- watch it fight a still player: a group kind as its group (the practice calls in its `group`: a skitter flock of
  // eight, three moths), every member watched, and a support with what it supports (def.escort: the jelly and a blot,
  // as the Arena's aloneWave); the wind-ups and the attacks a minute are its own kind's, the harm all of it
  await ev(`(() => { if (player.dead || player.down) player.restart(); foes.setPractice(${JSON.stringify(kind)}); const e = foes.list.find((x) => x.kind === ${JSON.stringify(kind)})?.def.escort; if (e) foes.spawnKind(e, { n: 1, dist: 7 }); window.__dmg.length = 0; player.health = 1; return true; })()`);
  await sleep(600);
  const t0 = Date.now(), samples = [];
  let shot = null;
  while (Date.now() - t0 < WATCH * 1000) {
    const s = await ev(`(() => { const all = foes.list.filter((x) => x.alive && x.dead === undefined && x.kind === ${JSON.stringify(kind)}); if (!all.length) return null;
      if (!foes.lock || !all.includes(foes.lock)) foes.lock = all[0];
      const now = performance.now();
      return all.map((f) => ({ id: (f.__watch ??= Math.random().toString(36).slice(2)), t: now, state: f.state, k: f.k ?? 0, atk: f.atk?.id ?? 'strike', d: f.pos.distanceTo(player.pos), roll: !!f.rolling, host: !!f.hosting })); })()`);
    if (s) samples.push(...s);
    if (!shot && s?.some((m) => m.state === 'wind' && m.k > 0.45)) {
      // (framed side-on for the contact sheet: the camera held off the winding one's flank, level with its middle and far
      // enough for its whole body, then given back: a wind-up reads by its silhouette, which a view from behind the
      // traveller hides)
      await ev(`(() => { const f = foes.list.find((x) => x.alive && x.kind === ${JSON.stringify(kind)} && x.state === 'wind') ?? foes.list.find((x) => x.alive); if (!f) return false;
        const V = THREE.Vector3, h = f.heading ?? 0, fw = new V(Math.sin(h), 0, Math.cos(h)), r = new V(fw.z, 0, -fw.x);
        const box = f.model?.group ? new THREE.Box3().setFromObject(f.model.group) : null, size = box && !box.isEmpty() ? box.getSize(new V()) : new V(2, 2, 2);
        const H = Math.max(1, size.y), span = Math.max(size.x, size.y, size.z, 1.5), mid = f.pos.clone().add(new V(0, H * 0.5, 0));
        const eye = mid.clone().addScaledVector(r, span * 1.15 + 1.6).add(new V(0, span * 0.2, 0));
        foes.lock = null;   // (no lock-on mark over it)
        const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(eye, mid, new V(0, 1, 0)));
        const base = window.__camBase ??= THREE.PerspectiveCamera.prototype.updateMatrixWorld;
        camera.updateMatrixWorld = function (force) { this.position.copy(eye); this.quaternion.copy(q); return base.call(this, force); };
        return true; })()`);
      await sleep(90);
      shot = Buffer.from((await send('Page.captureScreenshot', { format: 'png' })).result.data, 'base64');
      await ev('(() => { delete camera.updateMatrixWorld; return true; })()');
    }
    await sleep(40);
  }
  const dmg = await ev('window.__dmg.splice(0)');
  // wind-ups: runs of 'wind' samples, member by member
  const winds = [], strikes = {}, members = [...new Set(samples.map((s) => s.id))];
  for (const id of members) {
    const own = samples.filter((s) => s.id === id);
    for (let i = 0, start = null; i < own.length; i++) {
      const w = own[i].state === 'wind';
      if (w && start === null) start = i;
      if ((!w || i === own.length - 1) && start !== null) {
        const a = own[start].atk, dur = (own[i].t - own[start].t) / 1000;
        if (dur > 0.05) { winds.push({ atk: a, dur }); strikes[a] = (strikes[a] ?? 0) + 1; }
        start = null;
      }
    }
  }
  const span = samples.length ? (samples.at(-1).t - samples[0].t) / 60000 : 1;   // (attacks a minute: the whole group's)
  // ---- time to kill with each move (a fresh one each time, struck from in front)
  const ttk = {};
  for (const m of MOVES) {
    const r = await ev(`(async () => {
      foes.setPractice(${JSON.stringify(kind)}); await new Promise((r) => setTimeout(r, 250));
      const f = foes.list.find((x) => x.alive && x.kind === ${JSON.stringify(kind)}); if (!f) return null;
      let landed = 0, wasted = 0, hits = 0, dead = false, from = 'front';
      for (let i = 0; i < 40 && !dead; i++) {
        hits++;
        // from in front; if six blows in a row do nothing (a shell, a shadow), from behind, as a player would flank it
        if (from === 'front' && landed === 0 && wasted >= 6) from = 'behind';
        const dir = from === 'front' ? f.pos.clone().sub(player.pos).setY(0).normalize() : new THREE.Vector3(Math.sin(f.heading ?? 0), 0, Math.cos(f.heading ?? 0));
        ${m.stunned ? 'f.stunned = Math.max(f.stunned ?? 0, 1);' : ''}
        if (f.def.clapper) f.open = Math.max(f.open ?? 0, 1);   // (a clapper-only foe: struck in its opening, as a player waits for it)
        const hp = f.hp, r = foes.hurt(f, ${JSON.stringify(m.mode)}, dir, { damage: ${m.hits ? `[${m.hits}][i % ${m.hits.length}]` : m.damage}, source: ${JSON.stringify(m.source)}, breaks: ${!!m.breaks}, air: ${m.source === 'air'}${m.hits ? `, combo: i % ${m.hits.length}` : ''} });   // (as the blade sends them: the air cut's air, the swing's place in the combo)
        if (!f.alive) { dead = true; break; }
        if (r && f.hp < hp) landed++; else wasted++;
        await new Promise((r) => setTimeout(r, 30));
      }
      foes.list.slice().forEach((x) => foes.remove(x));
      const opens = f.def.clapper ? Math.max(0, ...f.def.attacks.map((a) => a.opens ?? 0)) : 0;
      return { hits, landed: landed + (dead ? 1 : 0), wasted, dead, from, opens };
    })()`);
    const cycle = winds.length ? (span * 60) / winds.length : 3;
    // (a clapper-only foe, the bell walker: its blows only in its openings, each one an attack cycle's wait for its drop: L.openingTime)
    ttk[m.id] = r ? { ...r, s: L.openingTime(L.timeToKill({ ...r, hits: r.landed + (r.from === 'behind' ? 0 : r.wasted) }, m, cycle), r, m, cycle) } : null;   // (a flank costs no blows: only the ones that land, from behind)
  }
  // ---- a roller (an attack that rolls up: Foe.rolling): rolled up, a cut, a shot, an ember glance off its shell, so the
  // gun's times above (dealt on one at rest) under-read it: each ranged move dealt live too, every cycle, while it fights
  const D = setup.defs[kind], rolls = (D.attacks ?? [D.attack]).some((a) => a?.rolls);
  const rollShare = samples.length ? +(samples.filter((x) => x.roll).length / samples.length).toFixed(2) : 0;
  const live = {};
  if (rolls) for (const m of MOVES.filter((x) => ['shoot', 'fire', 'push', 'combo'].includes(x.id))) {
    live[m.id] = await ev(`__live(${JSON.stringify(kind)}, ${JSON.stringify(m)}, ${+arg('live-cap', 40)})`).catch((e) => ({ error: String(e).slice(0, 120) }));
    console.log(`${kind.padEnd(10)} live ${m.id}: ${JSON.stringify(live[m.id])}`);
  }
  // ---- a puppeteer (the marionette): its strings on a host, the host driven, then freed (the strings cut) and strung again
  let free = null;
  if (D.puppeteer) {
    free = await ev(`__free(${JSON.stringify(kind)}, ${JSON.stringify(D.escort ?? null)}, ${+arg('drive', 8)})`).catch((e) => ({ error: String(e).slice(0, 120) }));
    // (to free it: the strings' wait, then one blow on a rope with the quickest move that cuts one: the air cut, an ember)
    const cutters = MOVES.filter((m) => m.id === 'air' || m.id === 'fire');
    if (free && !free.error) free.cut = Object.fromEntries(cutters.map((m) => [m.id, +(free.strung + (m.cycles ? m.cycles[0] : m.cycle)).toFixed(2)]));
    console.log(`${kind.padEnd(10)} free: ${JSON.stringify(free)}`);
  }
  const row = {
    kind, name: setup.defs[kind].name, rollShare, live, free,
    windSeen: L.median(winds.map((w) => w.dur)), winds: Object.fromEntries(Object.entries(strikes)),
    windByAttack: Object.fromEntries([...new Set(winds.map((w) => w.atk))].map((a) => [a, +L.median(winds.filter((w) => w.atk === a).map((w) => w.dur)).toFixed(2)])),
    attacksPerMin: +(winds.length / span).toFixed(1),
    // (hurts come in hearts since v1.5: a share of a fresh bar, so 1.0 is still a full bar a minute, as in v1.4's report)
    damagePerMin: +(dmg.reduce((a, d) => a + d.d, 0) / (setup.hearts || 1) / span).toFixed(2), hurts: dmg.length,
    closest: samples.length ? +Math.min(...samples.map((s) => s.d)).toFixed(1) : null,
    ttk,
  };
  results.push(row);
  if (shot) shots.push({ kind, png: shot });
  console.log(`${kind.padEnd(10)} wind ${row.windSeen?.toFixed(2) ?? '-'} s · ${row.attacksPerMin}/min · ${row.damagePerMin} health/min · ttk combo ${ttk.combo?.s ?? '-'} charge ${ttk.charge?.s ?? '-'} shoot ${ttk.shoot?.s ?? '-'}`);
}
// ---------------------------------------------------------------- the difficulty curve (--packs): each world's packs
// Packs 2.. of a visit (src/foe-worlds.js packOf, seeded so two runs field the same packs), each kind in the world's skin,
// set round the still player 6-10 m out and watched --pack-watch s: the hearts a minute it loses and the attacks a minute
// of the whole pack; each pack's time to kill is the sum of its members' from a kinds run (--ttk <combat.json>).
if (PACKS) {
  const NPACK = +arg('pack-count', 4), PW = +arg('pack-watch', 20);
  const TTK = arg('ttk') ? JSON.parse((await import('node:fs')).readFileSync(resolve(arg('ttk')), 'utf8')) : null;
  const { heartsOnArrival } = L, { SHOPS } = await import(join(ROOT, 'src/shop.js')), { ORDER } = await import(join(ROOT, 'src/levels/names.js'));
  const packRows = [];
  let meta = null;
  // --pack-look still|lock: the still traveller looks where he stands (the measure before), or the lock-on camera turns to
  // each striker as a player would (the foe whose blow comes soonest, else the nearest: foes.lock, which turns the camera),
  // so a pack's off-screen members aren't held back by the turns' rule (one off the screen waits while another strikes)
  const LOOK = arg('pack-look', 'still'), CLEAR = args.includes('--pack-clear'), CLEAR_CAP = +arg('clear-cap', 90);
  // --clear-dodge (with --pack-clear): the pack cleared a second time by the same traveller hopping back at every blow due
  // inside the perfect dodge's window (src/flurry.js), so the flurries chain as often as main.js lets them (combat-v1.47's
  // question: chained flurries against a late pack); the row's clearDodge has the s, the hearts, the hops and the flurries
  const DODGE = CLEAR && args.includes('--clear-dodge'), FLURRY_REST = 7000, DODGE_WATCH = +arg('dodge-watch', 0);
  // --pack-clear: then the same pack placed again and cleared by a scripted traveller: he locks on the nearest, walks to it
  // and deals its best move from the kinds run (--ttk: the fastest that kills it, the riposte left out) at that move's
  // cadence, from behind where the kinds run had to flank it, while the pack fights back: the s to clear it and the hearts
  // it took (his health kept up, every hurt counted)
  const placePack = (world, j) => ev(`(async () => {
      const { packOf, WORLDS, BUDGET } = await import('/src/foe-worlds.js'), { skinned } = await import('/src/enemies/archetypes.js');
      let s = ${(j + 1) * 7919 + world.length * 104729}; const rng = () => ((s = (s * 16807) % 2147483647) / 2147483647);
      const kinds = packOf(${j + 1}, ${JSON.stringify(world)}, rng);
      if (player.dead || player.down) player.restart();
      foes.setPractice(''); foes.list.slice().forEach((x) => foes.remove(x)); foes.lock = null;
      const P = player, h = P.heading ?? 0;
      kinds.forEach((k, i) => { const id = WORLDS[${JSON.stringify(world)}] ? skinned(k, ${JSON.stringify(world)}) : k;
        const at = foes.openSpot(id, P.pos, h + (i - (kinds.length - 1) / 2) * 0.5, 6 + (i % 3) * 2, 20, 40), f = foes.add(id, at);
        f.heading = Math.atan2(P.pos.x - at.x, P.pos.z - at.z); f.provoked = true; });
      foes.stage = WORLDS[${JSON.stringify(world)}]?.stage;   // (the world's turns: TURNS, more strikers at once late on)
      window.__dmg.length = 0; P.health = 1;
      const T = WORLDS[${JSON.stringify(world)}];
      return { kinds, stage: T?.stage ?? null, budget: T ? T.budget ?? BUDGET[Math.min(BUDGET.length - 1, T.stage)] : null, strikers: foes.strikers }; })()`);
  // each kind's best move from the kinds run (for --pack-clear), and how far it reaches
  const bestMove = (k) => {
    const r = TTK?.foes?.find((x) => x.kind === k); if (!r) return null;
    const [id, t] = Object.entries(r.ttk).filter(([id, x]) => x?.dead && id !== 'riposte').sort((x, y) => x[1].s - y[1].s)[0] ?? [];
    const m = MOVES.find((x) => x.id === id); if (!m) return null;
    return { ...m, from: t.from, reach: m.mode === 'blade' ? (id === 'dash' ? 6 : (setup.tuning.BLADE.reach ?? 2.2) + 0.6) : 12 };
  };
  if (CLEAR) await ev(`(() => {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const key = (type, code) => window.dispatchEvent(new KeyboardEvent(type, { code, key: code === 'Space' ? ' ' : code.slice(3).toLowerCase(), bubbles: true }));
    window.__clear = async (best, cap, dodge = false, strike = true) => {
      const P = player, V = THREE.Vector3, t0 = performance.now(), d0 = window.__dmg.length, up = new V(0, 1, 0);
      const fl = window.__fl, feel = await import('/src/feel.js'), FL = fl.FLURRY;
      const next = new Map(); let blows = 0, glanced = 0, walked = 0, last = t0, hops = 0, flurries = [], inFlurry = 0, was = 0;
      while (performance.now() - t0 < cap * 1000) {
        const left = foes.list.filter((x) => x.alive && x.dead === undefined);
        if (!left.length) break;
        const now = performance.now(), dt = Math.min(0.1, (now - last) / 1000); last = now;
        // (--clear-dodge: a perfect hop whenever a blow is due inside its window, as dodge.mjs presses it: the game's own
        // keys, so main.js decides whether a flurry opens and how long; the flurries' own lengths are read back)
        const fLeft = feel.flurryLeft();
        if (fLeft > 0 && !was) flurries.push({ at: +((now - t0) / 1000).toFixed(2), s: +feel.feelState().flurryFor.toFixed(2) });
        if (fLeft > 0) inFlurry += dt; was = fLeft > 0;
        if (dodge && !fLeft && P.onGround && !P.hopping) {
          const T = left.map((x) => fl.foeThreat(x, P, foes.env.slow?.() ?? 1)).find((T) => T && T.near && T.t <= fl.dodgeLead(T.wind, foes.gentle) * 0.75);
          if (T) { key('keydown', 'KeyS'); await new Promise(requestAnimationFrame); key('keydown', 'Space'); await new Promise(requestAnimationFrame); await new Promise(requestAnimationFrame);
            key('keyup', 'Space'); key('keyup', 'KeyS'); hops++; continue; }
        }
        const f = left.sort((a, b) => a.pos.distanceTo(P.pos) - b.pos.distanceTo(P.pos))[0], m = best[f.kind];
        foes.lock = f;
        const to = f.pos.clone().sub(P.pos).setY(0), d = to.length();
        if (!m) { foes.remove(f); continue; }   // (a kind the kinds run never killed: left out, counted below)
        const reach = fLeft > 0 && m.mode === 'blade' ? Math.max(m.reach, FL.reach) : m.reach;   // (in a flurry the cut pulls you in)
        if (P.hopping) { await wait(30); continue; }   // (mid-hop: no walking)
        if (d > reach) {   // (walked to it, a run's pace, on the ground)
          const step = Math.min(d - m.reach * 0.8, 6 * dt), at = P.pos.clone().addScaledVector(to.normalize(), step);
          const y = physics.groundAt(at.x, at.y + 2, at.z, 6); if (Number.isFinite(y)) at.y = y;
          P.teleport(at, up, to.clone()); P.heading = Math.atan2(to.x, to.z); walked += step;
        } else if (strike && now >= (next.get(f) ?? 0)) {
          const i = f.__blow ?? 0, dir = m.from === 'behind' ? new V(Math.sin(f.heading ?? 0), 0, Math.cos(f.heading ?? 0)) : to.normalize(), hp = f.hp;
          if (m.stunned) f.stunned = Math.max(f.stunned ?? 0, 1);
          if (f.def.clapper) f.open = Math.max(f.open ?? 0, 1);
          foes.hurt(f, m.mode, dir, { damage: m.hits ? m.hits[i % m.hits.length] : m.damage, source: m.source, breaks: !!m.breaks, air: m.source === 'air', ...(m.hits ? { combo: i % m.hits.length } : {}) });
          blows++; if (f.alive && !(f.hp < hp)) glanced++;
          // (in a flurry the combo chains without its rest: its cooldown × FLURRY.cool)
          const cyc = m.cycles ? m.cycles[i % m.cycles.length] : m.cycle, rest = fLeft > 0 && m.cooldown && m.cycles && i % m.cycles.length === m.cycles.length - 1 ? m.cooldown * (1 - FL.cool) : 0;
          f.__blow = i + 1; next.set(f, now + 1000 * (cyc - rest));
        }
        await wait(30);
      }
      const left = foes.list.filter((x) => x.alive && x.dead === undefined).length, s = (performance.now() - t0) / 1000;
      const harm = window.__dmg.slice(d0).reduce((a, x) => a + x.d, 0);
      return { cleared: !left, s: +s.toFixed(1), left, hearts: +harm.toFixed(2), blows, glanced, walked: +walked.toFixed(1), ...(dodge ? { hops, flurries, inFlurry: +inFlurry.toFixed(1) } : {}) };
    };
    return true; })()`);
  for (const world of PACKS) for (let j = 0; j < NPACK; j++) {
    const pack = await placePack(world, j).then((r) => { meta = r; return r.kinds; });
    await sleep(400);
    const t0 = Date.now(), samples = [];
    while (Date.now() - t0 < PW * 1000) {
      const s = await ev(`(() => { const now = performance.now(), live = foes.list.filter((x) => x.alive && x.dead === undefined);
        ${LOOK === 'lock' ? `{ const T = (f) => window.__fl?.foeThreat?.(f, player)?.t ?? Infinity;
          const by = live.slice().sort((a, b) => (T(a) - T(b)) || (a.pos.distanceTo(player.pos) - b.pos.distanceTo(player.pos)))[0];
          if (by) { foes.lock = by; player.heading = Math.atan2(by.pos.x - player.pos.x, by.pos.z - player.pos.z); } }` : ''}
        return live.map((f) => ({ id: (f.__watch ??= Math.random().toString(36).slice(2)), t: now, state: f.state })); })()`);
      if (s?.length) samples.push(...s);
      await sleep(60);
    }
    const dmg = await ev('window.__dmg.splice(0)');
    let winds = 0;
    for (const id of new Set(samples.map((s) => s.id))) { const own = samples.filter((s) => s.id === id); for (let i = 1; i < own.length; i++) if (own[i].state === 'wind' && own[i - 1].state !== 'wind') winds++; }
    const span = samples.length ? Math.max(1e-3, (samples.at(-1).t - samples[0].t) / 60000) : PW / 60;
    const ttkOf = (k, pick) => { const r = TTK?.foes?.find((x) => x.kind === k); if (!r) return null; return pick(r.ttk); };
    const best = (t) => Math.min(...Object.values(t).filter((x) => x?.dead).map((x) => x.s));
    // (a group's time is the group's: the kinds run kills one of it, so each member counts)
    const sum = (pick) => pack.reduce((a, k) => a + (ttkOf(k, pick) ?? NaN), 0);
    const row = { world, n: j + 1, pack, stage: meta.stage, budget: meta.budget, strikers: meta.strikers, heartsPerMin: +(dmg.reduce((a, d) => a + d.d, 0) / span).toFixed(2), attacksPerMin: +(winds / span).toFixed(1),
      ttkBest: +sum(best).toFixed(1), ttkCombo: +sum((t) => (t.combo?.dead ? t.combo.s : Infinity)).toFixed(1) };
    if (CLEAR) {
      const best = Object.fromEntries([...new Set(pack)].map((k) => [k, bestMove(k)]));
      await placePack(world, j); await sleep(300);
      row.clear = await ev(`__clear(${JSON.stringify(best)}, ${CLEAR_CAP})`).catch((e) => ({ error: String(e).slice(0, 120) }));
      row.clear.unknown = Object.entries(best).filter(([, m]) => !m).map(([k]) => k);   // (no best move from the kinds run: removed, not fought)
      await ev('(() => { foes.list.slice().forEach((x) => foes.remove(x)); foes.lock = null; return true; })()');
      if (DODGE) {   // (the same pack again, cleared with a perfect hop at every blow: the flurry chained as often as the game lets it)
        await sleep(FLURRY_REST);   // (main.js's wait before another flurry, and its chain, run out)
        await placePack(world, j); await sleep(300);
        row.clearDodge = await ev(`__clear(${JSON.stringify(best)}, ${CLEAR_CAP}, true)`).catch((e) => ({ error: String(e).slice(0, 120) }));
        await ev('(() => { foes.list.slice().forEach((x) => foes.remove(x)); foes.lock = null; return true; })()');
        if (DODGE_WATCH) {   // (and the chain itself: --dodge-watch s of hopping at every blow, no cut, the pack never thinned)
          await sleep(FLURRY_REST); await placePack(world, j); await sleep(300);
          row.dodgeWatch = await ev(`__clear(${JSON.stringify(best)}, ${DODGE_WATCH}, true, false)`).catch((e) => ({ error: String(e).slice(0, 120) }));
          await ev('(() => { foes.list.slice().forEach((x) => foes.remove(x)); foes.lock = null; return true; })()');
        }
      }
    }
    row.look = LOOK;
    packRows.push(row);
    console.log(`${world.padEnd(10)} pack ${j + 1}: ${pack.join(', ')} · ${row.heartsPerMin} hearts/min · ${row.attacksPerMin} attacks/min · ttk ${row.ttkBest} s${row.clear ? ` · cleared in ${row.clear.s} s, ${row.clear.hearts} hearts` : ''}${row.clearDodge ? ` · dodging: ${row.clearDodge.s} s, ${row.clearDodge.hearts} hearts, ${row.clearDodge.hops} hops, ${row.clearDodge.flurries?.length} flurries (${row.clearDodge.inFlurry} s in them)` : ''}${row.dodgeWatch ? ` · chain watch ${row.dodgeWatch.s} s: ${row.dodgeWatch.flurries?.length} flurries [${row.dodgeWatch.flurries?.map((x) => x.s).join(' ')}], ${row.dodgeWatch.inFlurry} s in them, ${row.dodgeWatch.hearts} hearts` : ''}`);
  }
  const hearts = heartsOnArrival(SHOPS, ORDER);
  const { WORLDS, BUDGET } = await import(join(ROOT, 'src/foe-worlds.js'));
  const curve = L.curveTable(packRows, { hearts, WORLDS, BUDGET, order: PACKS, startHearts: setup.hearts });
  writeFileSync(join(OUT, 'packs.json'), JSON.stringify({ version: VERSION, date: new Date().toISOString(), watch: PW, packs: packRows, curve }, null, 2));
  writeFileSync(join(OUT, 'curve.md'), L.curveMarkdown(curve));
  console.log(L.curveMarkdown(curve));
}

await ev('(() => { foes.setPractice(""); clearInterval(window.__keep); return true; })()').catch(() => {});

// ---------------------------------------------------------------- the guardians, phase by phase (a second sheet)
// Each guardian called into a ring (src/arena-guardians.js), its meter set to each phase's start, held at 85 % of
// that phase's first move's wind-up and seen from the side: guardians.png / .webp, a row each, a column a phase.
const gShots = [];
if (arg('guardians', PACKS ? 'no' : 'yes') !== 'no') {
  const list = await ev(`(async () => { const { GUARDIANS } = await import('/src/arena-guardians.js'); return GUARDIANS.map((G) => ({ id: G.id, phases: G.def.phases.filter((p) => !p.weary).map((p, i, all) => ({ from: i ? all[i - 1].to : 0, atk: p.attacks[0] })) })); })()`);
  for (const G of list) for (const [i, ph] of G.phases.entries()) {
    await ev(`(async () => {
      foes.setPractice(''); foes.list.slice().forEach((x) => foes.remove(x));
      const V = THREE.Vector3, { ArenaGuardians } = await import('/src/arena-guardians.js');
      window.__ag?.dismiss(); cancelAnimationFrame(window.__agTick ?? 0);
      // (always from the same open sand, facing away from the ship: src/levels/arena.js)
      { const y = physics.groundAt(-14, 20, -14, 60); player.teleport(new V(-14, Number.isFinite(y) ? y : 0, -14), new V(0, 1, 0), new V(Math.sin(Math.PI * 0.75), 0, Math.cos(Math.PI * 0.75))); player.heading = Math.PI * 0.75; }
      const A = window.__ag = new ArenaGuardians({ scene, player, physics, sound: null, notice() {} });
      const g = A.call('${G.id}'), m = g.model, f = new V(Math.sin(m.heading), 0, Math.cos(m.heading)), r = new V(f.z, 0, -f.x);
      player.teleport(m.pos.clone().addScaledVector(f, 9).setY(m.pos.y), new V(0, 1, 0), f.clone().negate());
      g.meter = ${ph.from}; g.floor = ${ph.from}; g.state = 'fight';
      const a = { id: '${ph.atk}', ...g.def.attacks['${ph.atk}'] }, w = a.wind ?? a.telegraph;
      g.attack = a; g.at = w * 0.85; g.struck = false; g.windFor = w; g.view = { ...a, id: a.pose ?? '${ph.atk}' }; g.attackK = 0.85;
      g.attackH = m.heading; g.attackAt.copy(a.at === 'player' ? player.pos : m.pos.clone().addScaledVector(f, 6)).setY(g.arena.y);
      if (a.lob && a.volley > 1 && g.spreadMarks) g.spreadMarks(a);
      const fight = g.fight.bind(g); g.fight = (dt, t, P) => fight(0, t, P);
      const tick = () => { A.update(1 / 60, performance.now() / 1000); window.__agTick = requestAnimationFrame(tick); }; tick();
      const H = m.height ?? 4, eye = m.pos.clone().addScaledVector(r, 22).addScaledVector(f, 9).add(new V(0, 6, 0)), at = m.pos.clone().addScaledVector(f, 3).add(new V(0, H * 0.45, 0));
      const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(eye, at, new V(0, 1, 0)));
      const base = THREE.PerspectiveCamera.prototype.updateMatrixWorld;
      camera.updateMatrixWorld = function (force) { this.position.copy(eye); this.quaternion.copy(q); return base.call(this, force); };
      return true; })()`);
    await sleep(1600);
    gShots.push({ kind: `${G.id}.${i}.${ph.atk}`, png: Buffer.from((await send('Page.captureScreenshot', { format: 'png' })).result.data, 'base64') });
    console.log(`guardian ${G.id} phase ${i}: ${ph.atk}`);
  }
  await ev('(() => { window.__ag?.dismiss(); cancelAnimationFrame(window.__agTick ?? 0); return true; })()').catch(() => {});
}

// ---------------------------------------------------------------- the contact sheet (a PNG written here: no dependency)
function encodePNG(w, h, rgb) {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 3 + 1)] = 0; rgb.copy(raw, y * (w * 3 + 1) + 1, y * w * 3, (y + 1) * w * 3); }
  const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc32(td) >>> 0); return Buffer.concat([len, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
function sheet(shots, name, cols = 4) {
  if (!shots.length) return;
  const tw = 320, th = 180, rows = Math.ceil(shots.length / cols), out = Buffer.alloc(cols * tw * rows * th * 3, 255);
  shots.forEach(({ png }, i) => {
    const { pixels, channels, width, height } = decodePNG(png), ox = (i % cols) * tw, oy = Math.floor(i / cols) * th;
    for (let y = 0; y < th; y++) for (let x = 0; x < tw; x++) {
      const sx = Math.floor((x * width) / tw), sy = Math.floor((y * height) / th), s = (sy * width + sx) * channels, d = ((oy + y) * cols * tw + ox + x) * 3;
      out[d] = pixels[s]; out[d + 1] = pixels[s + 1]; out[d + 2] = pixels[s + 2];
    }
  });
  writeFileSync(join(OUT, `${name}.png`), encodePNG(cols * tw, rows * th, out));
  spawnSync('cwebp', ['-quiet', '-q', '72', join(OUT, `${name}.png`), '-o', join(OUT, `${name}.webp`)]);
}
sheet(shots, 'telegraphs');
sheet(gShots, 'guardians', 3);

// ---------------------------------------------------------------- the scores
const roles = {};
const facts = Object.fromEntries(KINDS.map((k) => [k, L.kindFacts(k, setup.defs[k])]));
for (const F of Object.values(facts)) roles[F.role] = (roles[F.role] ?? 0) + 1;
const scored = results.map((r) => ({ ...r, facts: facts[r.kind], worlds: (setup.worlds[r.kind] ?? []).length, worldList: setup.worlds[r.kind] ?? [], score: L.scoreKind(facts[r.kind], r, (setup.worlds[r.kind] ?? []).length, roles[facts[r.kind].role]) }));
const gScored = guardians.filter((g) => !g.error).map((g) => ({ ...g, score: L.scoreGuardian(g) }));
const md = report(scored, gScored, MOVES, WATCH);
writeFileSync(join(OUT, 'combat.md'), md);
writeFileSync(join(OUT, 'combat.json'), JSON.stringify({ version: VERSION, date: new Date().toISOString(), watch: WATCH, tuning: setup.tuning, moves: MOVES, extra: setup.extra, foes: scored, guardians: gScored, guardianErrors: guardians.filter((g) => g.error), errors: errors.slice(0, 8), contact: shots.map((x) => x.kind), guardianSheet: gShots.map((x) => x.kind) }, null, 2));
console.log(`combat.md, combat.json and the contact sheet in ${OUT}`);
ws.close(); proc.kill('SIGTERM'); await sleep(800); rmSync(profile, { recursive: true, force: true });
await server.close();
process.exit(0);
