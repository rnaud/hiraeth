// The fight temples played (.claude/skills/combat-review/SKILL.md "The fight temples"; docs/design/fight-temples.md):
// each world's temple (?game=fight-<world>&seed=<n>) in a MUTED headless Chrome, a scripted traveller playing it through
// with the game's own keys (window.input: the stick, F the cut, G the quick shot, Alt the roll, Tab the lock), with the
// hearts he would have on arriving in that world (scripts/combat-review/lib.mjs heartsOnArrival). No game code changed.
//
//   bot      skilled  walks to the nearest foe, cuts in reach, shoots the flyers out of reach, rolls out of a blow due in
//                     under 0.22 s (src/flurry.js foeThreat) and steps out of the hazard's lane, spot or ring
//            masher   walks in and cuts, nothing else (the floor of what a new player does)
//   measures the clear time against par and the rank, the hearts lost by cause (each foe kind, each hazard), the
//            knock-outs (each one refilled, so the run goes on to be measured), the light foes' wind-ups as seen
//            (state 'wind'), the blows a minute, the crowd standing, each room's time and harm, the frame times, the
//            page's errors (a lock pressed now and then: issue #509)
//   pictures each room at its fullest crowd, each hazard's first warning, the results card (<out>/shots/*.png)
//
//   node .claude/skills/combat-review/fight-temples.mjs <out-dir> [--worlds desert,bazaar] [--bot skilled|masher]
//        [--seed 4821] [--gentle] [--cap 420]   (cap: s of game time before a run is called stuck)
//   PORT (default 5482; never 5173), CDP (default 5483)
// Writes <out>/fight-<bot>.json and prints a line a temple.
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { tempDir, ownProcess } from '../../../scripts/temp-dirs.mjs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const args = process.argv.slice(2), arg = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const OUT = resolve(args[0] && !args[0].startsWith('--') ? args[0] : join(tmpdir(), 'combat-fight'));
const PORT = Number(process.env.PORT ?? 5482), CDP = Number(process.env.CDP ?? 5483);
if (PORT === 5173) throw new Error('5173 is the author’s own dev server: pick another PORT');
const BOT = arg('bot', 'skilled'), SEED = +arg('seed', 4821), GENTLE = args.includes('--gentle'), CAP = +arg('cap', 420);
mkdirSync(join(OUT, 'shots'), { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const { ORDER } = await import(join(ROOT, 'src/levels/names.js'));
const { SHOPS } = await import(join(ROOT, 'src/shop.js'));
const L = await import(join(ROOT, 'scripts/combat-review/lib.mjs'));
const arrive = L.heartsOnArrival(SHOPS, ORDER);
const WORLDS = arg('worlds') ? arg('worlds').split(',') : ORDER;

const { createServer } = await import(join(ROOT, 'node_modules/vite/dist/node/index.js'));
const server = await createServer({ root: ROOT, configFile: join(ROOT, 'vite.config.js'), logLevel: 'error', clearScreen: false, server: { port: PORT, strictPort: true, host: '127.0.0.1', hmr: false, watch: null } });
await server.listen();
const profile = tempDir('combat-fight-chrome-');
const proc = ownProcess(spawn(process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', ['--headless=new', '--mute-audio', '--autoplay-policy=user-gesture-required',
  `--remote-debugging-port=${CDP}`, `--user-data-dir=${profile}`, '--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--no-first-run', '--window-size=1280,720', '--force-device-scale-factor=1',
  '--disable-background-timer-throttling', '--disable-renderer-backgrounding', 'about:blank'], { stdio: 'ignore' }));
const done = async (code = 0) => { try { proc.kill('SIGKILL'); } catch {} try { await server.close(); } catch {} process.exit(code); };   // (never leave a Chrome behind on a shared machine)
process.on('uncaughtException', (e) => { console.error(e); done(1); });
let tabs; for (let i = 0; i < 80 && !tabs; i++) { try { tabs = (await (await fetch(`http://localhost:${CDP}/json`)).json()).filter?.((t) => t.webSocketDebuggerUrl); if (!tabs?.length) tabs = null; } catch { await sleep(250); } }
if (!tabs) { console.error(`no Chrome on debugging port ${CDP}`); await done(1); }
const ws = new WebSocket(tabs.find((t) => t.type === 'page').webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r));
let id = 0; const waits = new Map(); let errors = [];
ws.addEventListener('message', (m) => { const d = JSON.parse(m.data); if (d.id && waits.has(d.id)) { waits.get(d.id)(d); waits.delete(d.id); } if (d.method === "Runtime.consoleAPICalled" && String(d.params.args?.[0]?.value).startsWith("bot:")) console.log(d.params.args[0].value); if (d.method === 'Runtime.exceptionThrown') errors.push((d.params.exceptionDetails?.exception?.description ?? '').slice(0, 300)); });
const send = (method, params = {}) => new Promise((res) => { const i = ++id; waits.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (e) => { const d = await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true }); if (d.result?.exceptionDetails) throw new Error(`page: ${d.result.exceptionDetails.exception?.description?.slice(0, 300)}`); return d.result?.result?.value; };
await send('Page.enable'); await send('Runtime.enable'); await send('Emulation.setFocusEmulationEnabled', { enabled: true });
await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
const shot = async (name) => { const d = await send('Page.captureScreenshot', { format: 'png' }); if (d.result?.data) writeFileSync(join(OUT, 'shots', `${name}.png`), Buffer.from(d.result.data, 'base64')); };

// the scripted traveller, in the page: a frame at a time on requestAnimationFrame
const BOT_JS = (bot, hearts) => `(async () => {
  const R = await import('/src/fight-temples/rules.js'), H = await import('/src/fight-temples/hazards.js'), FL = await import('/src/flurry.js');
  const P = player, M = window.minigame, I = window.input;
  P.hearts = P.maxHearts;   // (his hearts on arrival: the save's res.hearts.extra; game-host.js wireHealth keeps the max to the save's every frame)
  const B = window.__bot = { done: false, t: 0, frames: [], lost: {}, knockouts: [], winds: {}, blows: 0, rolls: 0, shots: [], rooms: [], maxStanding: 0, stuck: [], lockPresses: 0, hazardsSeen: {}, notes: [] };
  // every hurt, by its cause: a foe's (the kind striking nearest him) or the hazard's own name
  const hurt0 = P.hurt.bind(P);
  P.hurt = (amount, why = 'hit') => {
    if (!(amount > 0)) return hurt0(amount, why);
    let k = why;
    if (why === 'foe') { let best = null, bd = 1e9; for (const f of foes.list) { if (!f.alive || (f.state !== 'strike' && f.state !== 'wind')) continue; const d = f.pos.distanceTo(P.pos); if (d < bd) { bd = d; best = f; } } k = 'foe:' + (best ? best.kind + (best.tough ? '(tough)' : best.gorged ? '(gorged)' : '') : '?'); }
    const was = P.hearts; hurt0(amount, why); const took = was - P.hearts;
    B.lost[k] = (B.lost[k] ?? 0) + took;
    const room = M.session.run.room; (B.rooms[room] ??= { lost: 0, t0: B.t }).lost += took;
    if (P.hearts <= 0.01 || P.dead) { B.knockouts.push({ t: +B.t.toFixed(1), room, wave: M.session.run.waveN, by: k }); P._knockout = null; if (P.down) P.down = null; P.hearts = P.maxHearts; }
  };
  const seen = new Map();   // foe -> { state, t }
  let rollT = -9, cutT = -9, cutDown = false, lastKills = 0, lastKillT = 0, lockT = 0, prevPhase = '', fullShot = new Set(), hzShot = new Set();
  const flat = (x, z) => { const u = R.screenUp(), r = R.screenRight(); return { x: x * r.x + z * r.z, y: x * u.x + z * u.z }; };
  // (the sticks are put on the keyboard's object past its proxy: a value set through it is latched to true for a frame,
  // main.js latchedInput, and a right stick of true aimed the cut at NaN)
  const put = (k, v) => Object.defineProperty(I, k, { value: v, writable: true, enumerable: true, configurable: true });
  const walk = (dx, dz) => { const d = Math.hypot(dx, dz); put('stick', d > 0.05 ? flat(dx / d, dz / d) : { x: 0, y: 0 }); };
  const _o = new THREE.Vector3();
  const off = (f) => { _o.set(f.pos.x, f.pos.y + 0.6, f.pos.z).project(camera); return Math.abs(_o.x) > 1 || Math.abs(_o.y) > 1 || _o.z > 1; };
  const want = (name) => { if (!B.shots.includes(name)) { B.shots.push(name); B.shotWanted = name; } };
  const centre = (r) => [(r.x[0] + r.x[1]) / 2, (r.z[0] + r.z[1]) / 2];
  M.begin();
  let last = performance.now();
  const step = () => { try { step1(); } catch (e) { B.err = String(e.stack ?? e).slice(0, 400); B.done = true; } };
  const step1 = () => {
    if (B.done) return;
    const now = performance.now(), dt = Math.min(0.1, (now - last) / 1000); last = now;
    if (M.phase === 'play') { B.t += dt; B.frames.push(dt * 1000); }
    const S = M.session, run = S.run, def = S.def, rooms = def.rooms, p = P.pos;
    if (M.phase === 'results' || M.phase === 'finishing' || B.t > ${CAP}) {
      put('stick', { x: 0, y: 0 }); I.KeyF = false; I.AltLeft = false; I.KeyG = false; put('lookStick', undefined);
      if (M.phase === 'results' || B.t > ${CAP}) { B.done = true; B.result = { phase: M.phase, run: { ...run }, card: M.result ? { title: M.result.title, lines: M.result.lines } : null, timedOut: B.t > ${CAP} }; return; }
      requestAnimationFrame(step); return;
    }
    if (M.phase !== 'play') { requestAnimationFrame(step); return; }
    if (!Number.isFinite(P.vel.x + P.pos.x + P.heading) && !B.nan) B.nan = +B.t.toFixed(2);
    const live = foes.list.filter((f) => f.alive && f.dead === undefined && !f.dying);
    B.maxStanding = Math.max(B.maxStanding, live.length);
    // (off the screen: a foe whose middle the iso camera does not frame; its blows begun there)
    for (const f of live) { B.foeFrames = (B.foeFrames ?? 0) + 1; if (off(f)) B.offFrames = (B.offFrames ?? 0) + 1; }
    // the wind-ups as seen (a light foe's, a gorged one's, a tough one's)
    for (const f of live) {
      const s = seen.get(f) ?? { state: '', t: 0 };
      if (f.state !== s.state) {
        if (s.state === 'wind' && f.state === 'strike') { const tag = f.kind + (f.tough ? '(tough)' : f.gorged ? '(gorged)' : ''); (B.winds[tag] ??= []).push(+(B.t - s.t).toFixed(3)); }
        if (f.state === 'wind') { B.blows++; if (off(f)) B.blowsOff = (B.blowsOff ?? 0) + 1; }
        s.state = f.state; s.t = B.t; seen.set(f, s);
      }
    }
    if (run.phase !== prevPhase) { if (run.phase === 'wait' && prevPhase) { const r = B.rooms[run.room - 1]; if (r) r.secs = +(B.t - r.t0).toFixed(1); } prevPhase = run.phase; B.waitT = 0; }
    if (run.phase === 'fight') B.rooms[run.room] ??= { lost: 0, t0: B.t };
    // pictures: the room at its fullest, the hazard's first warning
    if (run.phase === 'fight' && live.length >= Math.min(16, run.standing + run.queue) && live.length >= 8 && !fullShot.has(run.room)) { fullShot.add(run.room); want('room' + run.room + '-crowd'); }
    const hz = S.hazards.list.filter((a) => a.ri === run.room);
    for (const a of hz) { B.hazardsSeen[a.kind] = (B.hazardsSeen[a.kind] ?? 0) + 0; if (a.t > 0.45 && a.t < 0.6 && !hzShot.has(run.room)) { hzShot.add(run.room); want('room' + run.room + '-' + a.kind); } }
    // a stuck wave: nothing felled for 40 s (a foe out of reach): noted, then felled for him
    if (run.kills !== lastKills) { lastKills = run.kills; lastKillT = B.t; }
    if (run.phase === 'fight' && B.t - lastKillT > 40 && live.length) { B.stuck.push({ t: +B.t.toFixed(1), room: run.room, kinds: live.map((f) => f.kind + '@' + f.pos.y.toFixed(1)) }); for (const f of live) foes.hurt(f, 'blade', new THREE.Vector3(1, 0, 0), { damage: 99 }); lastKillT = B.t; }
    // the lock now and then (Tab): it should do nothing in here (no lock, no crash: issue #509)
    if ((lockT += dt) > 9) { lockT = 0; I.Tab = true; B.lockPresses++; } else if (I.Tab) I.Tab = false;
    let mx = 0, mz = 0, cut = false, roll = false, fire = false, aim = null;
    if (run.phase === 'reward') { const a = rooms.at(-1).altar; mx = a[0] - p.x; mz = a[1] - p.z; if ((B.waitT = (B.waitT ?? 0) + dt) > 15) { B.notes.push('walk to the altar stuck'); P.pos.set(a[0] + 0.5, P.pos.y, a[1] + 0.5); B.waitT = 0; } }
    else if (run.phase === 'wait') {
      // to the next room through its door: in front of the gap first (lined up with it), then straight through
      const to = rooms[run.room], [cx, cz] = centre(to);
      let here = R.roomAt(rooms, p.x, p.z, 0); if (here < 0) here = R.roomAt(rooms, p.x, p.z, -2.4);
      const d = def.doors.find((x) => (x.to === run.room && x.from === here) || (x.from === run.room && x.to === here)) ?? def.doors.find((x) => x.to === run.room || x.from === run.room);
      const g = R.doorGap(rooms, d), gx = (g.x[0] + g.x[1]) / 2, gz = (g.z[0] + g.z[1]) / 2;
      const out = { n: [0, -1], s: [0, 1], w: [-1, 0], e: [1, 0] }[d.side], k = d.from === run.room ? -1 : 1, nx = out[0] * k, nz = out[1] * k;   // (the way into the next room)
      const lateral = d.side === 'n' || d.side === 's' ? Math.abs(p.x - gx) : Math.abs(p.z - gz), depth = (p.x - gx) * nx + (p.z - gz) * nz;
      if (here === run.room && R.inRoom(to, p.x, p.z, 1.5)) { mx = cx - p.x; mz = cz - p.z; }
      else if (depth > -1.2 || lateral < d.w / 2 - 0.7) { mx = gx + nx * 3 - p.x; mz = gz + nz * 3 - p.z; }
      else { mx = gx - nx * 2.2 - p.x; mz = gz - nz * 2.2 - p.z; }
      // (the scripted walk caught on a corner for 20 s: noted, and put in the doorway)
      if ((B.waitT = (B.waitT ?? 0) + dt) > 20) { B.notes.push('walk stuck by room ' + run.room); P.pos.set(gx + nx * 2, P.pos.y, gz + nz * 2); B.waitT = 0; }
    } else {
      // the fight: the nearest foe
      let f = null, fd = 1e9;
      for (const x of live) { const d = Math.hypot(x.pos.x - p.x, x.pos.z - p.z); if (d < fd) { fd = d; f = x; } }
      if (f) {
        const dx = f.pos.x - p.x, dz = f.pos.z - p.z;
        aim = flat(dx / (fd || 1), dz / (fd || 1));
        const high = f.pos.y > 1.6;
        if (fd > 1.8) { mx = dx; mz = dz; }
        if (fd < 2.4 && !high) cut = true;
        if (${bot === 'skilled'} && (high || fd > 5) && fd < 16) fire = true;
        if (${bot === 'masher'} && high && fd < 2.6) cut = true;
      } else if (run.phase === 'rest' || !live.length) {
        const [cx, cz] = centre(rooms[run.room]); mx = (cx - p.x) * 0.3; mz = (cz - p.z) * 0.3;
      }
      if (${bot === 'skilled'}) {
        // a blow due now: roll away from it
        let due = null;
        for (const x of live) { const T = FL.foeThreat(x, P, 1); if (T && T.near && T.t < 0.22 && (!due || T.t < due.t)) due = { ...T, f: x }; }
        // the hazard: out of its lane, off its spot, out of the dark into a lamp's light, through the toll's ring
        for (const a of hz) {
          const room = rooms[a.ri], Hk = H.HAZARD[a.kind] ?? {}, lane = a.lane ?? {};
          if (H.ON_LANES.has(a.kind) && lane.along && H.inLane(room, lane, p.x, p.z, 0.6)) {
            const across = lane.along === 'x' ? p.z - lane.at : p.x - lane.at, s = Math.sign(across || 1);
            if (lane.along === 'x') { mx = 0; mz = s; } else { mx = s; mz = 0; }
            if (a.t > (Hk.warn ?? 1) - 0.25 && a.t < (Hk.warn ?? 1) + 0.1) roll = true;
            cut = false;
          } else if (lane.spot) {
            const [sx, sz] = lane.spot.x !== undefined ? [lane.spot.x, lane.spot.z] : lane.spot, d = Math.hypot(p.x - sx, p.z - sz);
            if (d < (Hk.radius ?? 1.8) + 0.6 && a.t < (Hk.warn ?? 1.3) + (Hk.lie ?? Hk.secs ?? 0)) { mx = (p.x - sx) || 1; mz = p.z - sz; cut = false; if (a.t > (Hk.warn ?? 1) - 0.25 && a.t < (Hk.warn ?? 1)) roll = true; }
          } else if (a.kind === 'dark' && room.hazard.lamps?.length) {
            // (into the nearest lamp's light and kept there while it is dark: the crowd comes to him)
            let best = null, bd = 1e9; for (const [lx, lz] of room.hazard.lamps) { const d = Math.hypot(lx - p.x, lz - p.z); if (d < bd) { bd = d; best = [lx, lz]; } }
            if (a.t > 0.2 && a.t < (Hk.warn ?? 1.2) + (Hk.secs ?? 3.6)) { if (bd > 1.2) { mx = best[0] - p.x; mz = best[1] - p.z; } else { mx = 0; mz = 0; } }
          } else if (a.kind === 'shade' && lane.along) {
            // (out of the band of shade the way it came from: it sweeps on past him)
            const s = Math.max(0, a.t - (Hk.warn ?? 1)) * (Hk.speed ?? 2.4), [lo, hi] = H.shadeBand(room, lane, s), v = lane.along === 'x' ? p.x : p.z;
            if (a.t > (Hk.warn ?? 1) - 0.3 && v > lo - 1 && v < hi + 1) { const back = -lane.dir; if (lane.along === 'x') { mx = back; mz = 0; } else { mx = 0; mz = back; } cut = false; }
          } else if (a.kind === 'toll' && lane.sign) {
            const d = Math.hypot(p.x - lane.sign[0], p.z - lane.sign[1]), edge = Math.max(0, a.t - (Hk.warn ?? 1)) * (Hk.speed ?? 6);
            if (a.t > (Hk.warn ?? 1) && d - edge > 0 && d - edge < 0.9) roll = true;
          }
        }
        if (due && !roll) { roll = true; mx = p.x - due.f.pos.x; mz = p.z - due.f.pos.z; }
      }
    }
    walk(mx, mz);
    put('lookStick', aim ?? undefined);
    // the cut: tapped (a press a few frames long, again to chain)
    if (cut && !cutDown && B.t - cutT > 0.11) { I.KeyF = true; cutDown = true; cutT = B.t; } else if (cutDown && B.t - cutT > 0.05) { I.KeyF = false; cutDown = false; }
    if (!cut && cutDown) { I.KeyF = false; cutDown = false; }
    I.KeyG = fire && !I.KeyG;
    if (roll && B.t - rollT > 0.8) { I.AltLeft = true; rollT = B.t; B.rolls++; } else if (I.AltLeft && B.t - rollT > 0.06) I.AltLeft = false;
    requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
  return true;
})()`;

const all = [];
for (const world of WORLDS) {
  errors = [];
  const hearts = arrive[world]?.arrival ?? 3;
  await send('Page.navigate', { url: `http://127.0.0.1:${PORT}/manifest.webmanifest` }); await sleep(250);
  await ev(`localStorage.clear(); localStorage.setItem('hiraeth.muted','1');
    localStorage.setItem('hiraeth.settings.v1', JSON.stringify({ quality: 'medium', music: 0, effects: 0, voices: 0, volume: 0, enemies: '${GENTLE ? 'gentle' : 'normal'}', hints: 'off' }));
    localStorage.setItem('hiraeth.game.v1', JSON.stringify({ flags: { 'prologue.done': true, 'item.backpack': true, 'items.v': 2, 'foes.seen': true, 'res.hearts.extra': ${hearts - 3} }, keepsakes: [] })); true`);
  const t0 = Date.now();
  await send('Page.navigate', { url: `http://127.0.0.1:${PORT}/?game=fight-${world}&seed=${SEED}` });
  // (a cold Vite on a loaded machine can miss the first boot: one reload more before giving up)
  let up = false; for (let i = 0; i < 3600 && !up; i++) { up = (await ev('!!window.__hiraethBooted && !!window.minigame?.session?.run').catch(() => false)) === true; if (!up) await sleep(100); if (i === 1800 && !up) await send('Page.reload', {}); }
  if (!up) { console.log(world, 'never booted'); all.push({ world, error: 'never booted', errors }); continue; }
  const load = (Date.now() - t0) / 1000;
  await sleep(1500);
  const tag = `${world}-${BOT}${GENTLE ? '-gentle' : ''}`;
  await shot(`${tag}-start`);
  await ev(BOT_JS(BOT, hearts));
  let B;
  for (let i = 0; ; i++) {
    await sleep(250);
    const st = await ev(`(() => { const B = window.__bot; const w = B.shotWanted; B.shotWanted = null; return { done: B.done, w, t: B.t, err: B.err, ph: minigame.session.run.phase, k: minigame.session.run.kills }; })()`).catch((e) => ({ error: String(e) }));
    if (st.error) { console.log(world, st.error); break; }
    if (st.w) await shot(`${tag}-${st.w}`);
    if (st.done) break;
    if (i > 4 * 60 * 12) { console.log(world, 'the page stopped'); break; }
  }
  await sleep(600);
  await shot(`${tag}-results`);
  B = await ev(`(() => { const B = window.__bot; const fr = B.frames.slice().sort((a, b) => a - b); const q = (k) => +(fr[Math.floor(k * (fr.length - 1))] ?? 0).toFixed(1);
    const winds = Object.fromEntries(Object.entries(B.winds).map(([k, v]) => { const s = v.slice().sort((a, b) => a - b); return [k, { n: v.length, median: s[Math.floor(s.length / 2)], min: s[0] }]; }));
    return { t: +B.t.toFixed(1), lost: B.lost, knockouts: B.knockouts, winds, blows: B.blows, rolls: B.rolls, rooms: B.rooms.map((r) => ({ secs: r.secs ?? +(B.t - r.t0).toFixed(1), lost: +r.lost.toFixed(2) })), maxStanding: B.maxStanding, stuck: B.stuck, lockPresses: B.lockPresses, notes: B.notes, offShare: +((B.offFrames ?? 0) / Math.max(1, B.foeFrames ?? 0)).toFixed(3), blowsOff: B.blowsOff ?? 0, nan: B.nan ?? null, err: B.err ?? null,
      frames: { p50: q(0.5), p95: q(0.95), p99: q(0.99) }, result: B.result, def: { name: minigame.session.def.name, par: minigame.session.def.par, rooms: minigame.session.def.rooms.map((r) => r.id + ':' + (r.hazard?.kind ?? (r.geysers ? 'geyser' : '-'))), total: minigame.session.run.total } }; })()`);
  const lostAll = Object.values(B.lost).reduce((a, b) => a + b, 0);
  const row = { world, hearts, load, bot: BOT, gentle: GENTLE, seed: SEED, ...B, lostAll: +lostAll.toFixed(2), errors: errors.slice(0, 8) };
  all.push(row);
  console.log(`${world.padEnd(12)} ${B.def.name.padEnd(22)} ${B.t}s par ${B.def.par} | hearts ${hearts} lost ${row.lostAll} KO ${B.knockouts.length} | blows ${B.blows} (${(B.blows / (B.t / 60)).toFixed(0)}/min) rolls ${B.rolls} | crowd ${B.maxStanding} | stuck ${B.stuck.length} | err ${errors.length} | ${B.result?.run?.rank ?? B.result?.phase}`);
  writeFileSync(join(OUT, `fight-${BOT}${GENTLE ? '-gentle' : ''}.json`), JSON.stringify(all, null, 2));
}
await done(0);
