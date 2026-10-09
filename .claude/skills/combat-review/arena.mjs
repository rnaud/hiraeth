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
import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { deflateSync, crc32 } from 'node:zlib';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const args = process.argv.slice(2), arg = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const OUT = resolve(args[0] && !args[0].startsWith('--') ? args[0] : join(tmpdir(), 'combat-review'));
const WATCH = +arg('watch', 24), W = 1280, H = 720;
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
    L.table(['kind', 'read', 'counter', 'space', 'fair', 'identity', 'combines', '**total**', 'wind seen (s)', 'attacks/min', 'health/min', ...MOVES.map((m) => `ttk ${m.id}`)],
      scored.map((r) => [r.name, r.score.readability, r.score.counterplay, r.score.space, r.score.fairness, r.score.identity, r.score.combines, `**${r.score.total}**`,
        s(r.windSeen?.toFixed(2)), r.attacksPerMin, r.damagePerMin, ...MOVES.map((m) => (r.ttk[m.id]?.dead ? `${r.ttk[m.id].s}${r.ttk[m.id].from === 'behind' ? ' (behind)' : ''}` : r.ttk[m.id] ? '∞' : '-'))])), '',
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
const profile = mkdtempSync(join(tmpdir(), 'combat-review-chrome-'));
const proc = spawn(process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', ['--headless=new', '--mute-audio', '--autoplay-policy=user-gesture-required',
  `--remote-debugging-port=${CDP}`, `--user-data-dir=${profile}`, '--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--no-first-run', `--window-size=${W},${H}`, '--force-device-scale-factor=1',
  '--disable-background-timer-throttling', '--disable-renderer-backgrounding', 'about:blank'], { stdio: 'ignore' });
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
await ev(`localStorage.clear(); localStorage.setItem('moebius.muted','1');
  localStorage.setItem('moebius.settings.v1', JSON.stringify({ quality: 'medium', music: 0, effects: 0, voices: 0, volume: 0, enemies: 'normal' }));
  localStorage.setItem('moebius.game.v1', JSON.stringify({ flags: { 'prologue.done': true, 'item.backpack': true, 'items.v': 2, 'foes.seen': true }, keepsakes: [] })); true`);
await send('Page.navigate', { url: `${BASE}?level=arena` });
let up = false;
for (let tries = 0; tries < 2 && !up; tries++) {
  if (tries) await send('Page.reload');
  for (let i = 0; i < 900 && !up; i++) { up = (await ev('!!window.__moebiusBooted && !!window.player && !!window.foes').catch(() => false)) === true; if (!up) await sleep(100); }
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
  if (window.weather) { window.weather.mode = 'clear'; window.weather.intensity = 0; }
  const s = document.createElement('style'); s.textContent = '#toast, #inputs, #foe-spawner { visibility: hidden !important; }'; document.head.appendChild(s);
  const P = window.player, hurt = P.hurt.bind(P);
  window.__dmg = [];
  P.hurt = (d, why) => { window.__dmg.push({ t: performance.now(), d, why }); return hurt(d, why); };
  window.__keep = setInterval(() => { if (P.health < 0.7) P.health = 1; }, 50);
  const plain = (o) => JSON.parse(JSON.stringify(o, (k, v) => (typeof v === 'function' ? undefined : v)));
  const { rosterOf } = await import('/src/foe-worlds.js');
  const worlds = {}; for (const w of Object.keys(ROSTERS)) { const R = rosterOf(w); for (const k of new Set([R.first, ...Object.keys(R.wild ?? {}), ...(R.guards ?? []), ...(R.temple ?? []), ...(R.shade > 0 ? ['shade'] : [])])) (worlds[k] ??= []).push(w); }
  // a kind that only comes out of another (a golem's splinters) fights where its parent does
  for (const [k, D] of Object.entries(FOES)) if (D.splits?.kind) worlds[D.splits.kind] = [...new Set([...(worlds[D.splits.kind] ?? []), ...(worlds[k] ?? [])])];
  return { hearts: P.maxHearts ?? 1, kinds: SPAWN_KINDS.filter((k) => FOES[k]), defs: plain(Object.fromEntries(SPAWN_KINDS.map((k) => [k, FOES[k]]))), worlds,
    tuning: plain({ BLADE: blade.BLADE, SWINGS: blade.SWINGS, CHARGE: blade.CHARGE, AIR: blade.AIR, RIPOSTE: blade.RIPOSTE, DASH: blade.DASH, FLUID: tool.FLUID, MODES: kit.MODES }),
    extra: plain({ GUARD: blade.GUARD, EVADE: blade.EVADE, LOCK: (await import('/src/foes.js')).LOCK }) };
})()`);
const KINDS = (arg('kinds') ?? setup.kinds.join(',')).split(',').filter((k) => setup.kinds.includes(k));
const MOVES = L.movesFrom(setup.tuning);
console.log(`${KINDS.length} kinds, ${guardians.length} guardians, ${MOVES.length} moves`);

const shots = [];
const results = [];
for (const kind of KINDS) {
  // ---- watch it fight a still player
  await ev(`(() => { foes.setPractice(${JSON.stringify(kind)}); window.__dmg.length = 0; player.health = 1; return true; })()`);
  await sleep(600);
  const t0 = Date.now(), samples = [];
  let shot = null;
  while (Date.now() - t0 < WATCH * 1000) {
    const s = await ev(`(() => { const f = foes.list.find((x) => x.alive && x.kind === ${JSON.stringify(kind)}); if (!f) return null;
      if (!foes.lock || foes.lock !== f) foes.lock = f;
      return { t: performance.now(), state: f.state, k: f.k ?? 0, atk: f.atk?.id ?? 'strike', d: f.pos.distanceTo(player.pos) }; })()`);
    if (s) samples.push(s);
    if (!shot && s?.state === 'wind' && s.k > 0.45) shot = Buffer.from((await send('Page.captureScreenshot', { format: 'png' })).result.data, 'base64');
    await sleep(40);
  }
  const dmg = await ev('window.__dmg.splice(0)');
  // wind-ups: runs of 'wind' samples
  const winds = [], strikes = {};
  for (let i = 0, start = null; i < samples.length; i++) {
    const w = samples[i].state === 'wind';
    if (w && start === null) start = i;
    if ((!w || i === samples.length - 1) && start !== null) {
      const a = samples[start].atk, dur = (samples[i].t - samples[start].t) / 1000;
      if (dur > 0.05) { winds.push({ atk: a, dur }); strikes[a] = (strikes[a] ?? 0) + 1; }
      start = null;
    }
  }
  const span = samples.length ? (samples.at(-1).t - samples[0].t) / 60000 : 1;
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
        const hp = f.hp, r = foes.hurt(f, ${JSON.stringify(m.mode)}, dir, { damage: ${m.hits ? `[${m.hits}][i % ${m.hits.length}]` : m.damage}, source: ${JSON.stringify(m.source)}, breaks: ${!!m.breaks} });
        if (!f.alive) { dead = true; break; }
        if (r && f.hp < hp) landed++; else wasted++;
        await new Promise((r) => setTimeout(r, 30));
      }
      foes.list.slice().forEach((x) => foes.remove(x));
      return { hits, landed: landed + (dead ? 1 : 0), wasted, dead, from };
    })()`);
    const cycle = winds.length ? (span * 60) / winds.length : 3;
    ttk[m.id] = r ? { ...r, s: L.timeToKill({ ...r, hits: r.landed + (r.from === 'behind' ? 0 : r.wasted) }, m, cycle) } : null;   // (a flank costs no blows: only the ones that land, from behind)
  }
  const row = {
    kind, name: setup.defs[kind].name,
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
await ev('(() => { foes.setPractice(""); clearInterval(window.__keep); return true; })()').catch(() => {});

// ---------------------------------------------------------------- the guardians, phase by phase (a second sheet)
// Each guardian called into a ring (src/arena-guardians.js), its meter set to each phase's start, held at 85 % of
// that phase's first move's wind-up and seen from the side: guardians.png / .webp, a row each, a column a phase.
const gShots = [];
if (arg('guardians', 'yes') !== 'no') {
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
const scored = results.map((r) => ({ ...r, facts: facts[r.kind], worlds: (setup.worlds[r.kind] ?? []).length, score: L.scoreKind(facts[r.kind], r, (setup.worlds[r.kind] ?? []).length, roles[facts[r.kind].role]) }));
const gScored = guardians.filter((g) => !g.error).map((g) => ({ ...g, score: L.scoreGuardian(g) }));
const md = report(scored, gScored, MOVES, WATCH);
writeFileSync(join(OUT, 'combat.md'), md);
writeFileSync(join(OUT, 'combat.json'), JSON.stringify({ version: VERSION, date: new Date().toISOString(), watch: WATCH, moves: MOVES, extra: setup.extra, foes: scored, guardians: gScored, guardianErrors: guardians.filter((g) => g.error), errors: errors.slice(0, 8), contact: shots.map((x) => x.kind), guardianSheet: gShots.map((x) => x.kind) }, null, 2));
console.log(`combat.md, combat.json and the contact sheet in ${OUT}`);
ws.close(); proc.kill('SIGTERM'); await sleep(800); rmSync(profile, { recursive: true, force: true });
await server.close();
process.exit(0);
