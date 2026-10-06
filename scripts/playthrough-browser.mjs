// The play-through's browser pass (docs/systems/testing.md): what needs the real page, in a headless,
// muted Chrome driven over the DevTools protocol (no dependency: Node's own WebSocket), against a dev
// server of the game. The node play-through (tests/playthrough.test.js) plays every world's story; this
// checks the parts that only the page has:
//
//   1. a new game: the title screen, the prologue (skipped as a player does, holding Esc), and the
//      desert: no quest on landing, the drone finds Marrow by the ship;
//   2. an old save from before the save slots and the reorder (the jets and the City-Shaft done, a
//      message waiting): the title's Continue resumes it in the City-Shaft; the voicemail plays the
//      waiting message; the holo table opens the galactic map, charting the new route; travel asks,
//      the ship takes off and the next page is Vael, arriving by a landing (no crash); Vael's opening
//      talk is what the drone finds; the bird is nowhere;
//   3. save and load: back to the title and Continue: Vael again, the save as it was.
//
//   node scripts/playthrough-browser.mjs [--port 6101] [--url http://localhost:6101/] [--out dir]
//
// It starts its own vite dev server on --port unless --url is given (CI: `npx vite preview --port …`
// after a build, then --url). Chrome: $CHROME, or the usual install path. Sound: --mute-audio, and the
// game's own volumes at 0. Exits 1 if a check fails; screenshots go to --out.
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };
const PORT = +arg('port', 6101), CDP = PORT + 1;
const OUT = resolve(arg('out', join(tmpdir(), 'memento-playthrough')));
const CHROME = process.env.CHROME ?? ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/chromium'].find((p) => existsSync(p));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
mkdirSync(OUT, { recursive: true });

// ------------------------------------------------------------------ the server and the browser
let server = null;
let URL_ = arg('url', null);
if (!URL_) {
  server = spawn('npx', ['vite', '--port', String(PORT), '--strictPort', '--host', '127.0.0.1'], { stdio: ['ignore', 'pipe', 'pipe'], cwd: resolve(import.meta.dirname, '..') });
  URL_ = `http://127.0.0.1:${PORT}/`;
  for (let i = 0; i < 120; i++) { try { if ((await fetch(URL_)).ok) break; } catch { /* not yet */ } await sleep(500); }
}
const profile = mkdtempSync(join(tmpdir(), 'memento-chrome-'));
const chrome = spawn(CHROME, ['--headless=new', '--mute-audio', `--remote-debugging-port=${CDP}`, `--user-data-dir=${profile}`, '--window-size=1280,720',
  '--no-first-run', '--no-default-browser-check', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--enable-unsafe-swiftshader', 'about:blank'], { stdio: 'ignore' });

let ws, id = 0;
const waits = new Map();
const send = (method, params = {}) => new Promise((res, rej) => { const i = ++id; waits.set(i, [res, rej]); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (expr) => {
  const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(`${expr.slice(0, 80)}: ${r.exceptionDetails.exception?.description ?? JSON.stringify(r.exceptionDetails)}`);
  return r.result.value;
};
const until = async (expr, secs = 90, what = expr) => {
  for (let t = 0; t < secs * 4; t++) { try { if (await ev(expr)) return true; } catch { /* the page is between loads */ } await sleep(250); }
  throw new Error(`timed out waiting for ${what}`);
};
let shots = 0;
const shot = async (name) => {
  const r = await send('Page.captureScreenshot', { format: 'png' });
  const f = join(OUT, `${String(++shots).padStart(2, '0')}-${name}.png`);
  writeFileSync(f, Buffer.from(r.data, 'base64'));
  return f;
};
const results = [];
const check = (ok, text) => { results.push({ ok: !!ok, text }); console.log(`${ok ? '  ok  ' : '  FAIL'} ${text}`); };
const key = async (code, type = 'keyDown') => send('Input.dispatchKeyEvent', { type, code, key: code === 'Escape' ? 'Escape' : code.replace(/^Key/, '').toLowerCase(), windowsVirtualKeyCode: code === 'Escape' ? 27 : 0 });

// the save from before the slots and the reorder: the desert and the City-Shaft (the old second world) done, the jets, message 2 waiting
const OLD_SAVE = {
  flags: {
    'prologue.done': true, 'charge.given': true, 'charge.card': true, 'save.migrated': 1, 'items.v': 2, 'item.backpack': true, 'box.desert.backpack': true,
    'tool.empty': false, 'tool.colours': 2, 'desert.quest.v': 3, 'quest.desert.power': 'done', 'world.desert.done': true, 'desert.tree.lit': true, 'desert.ship.fed': true,
    'ship.powered': true, 'ship.launched': true, 'ship.level': 'incal', 'calls.1': true, 'signature.told': true,
    'quest.incal.light': 'done', 'world.incal.done': true, 'incal.lit': true, 'item.jetpack': true, 'box.incal.temple.jetpack': true, 'temple.incal.gadget': true, 'temple.incal.entered': true,
    'quest.temple.incal': 'keeper', 'quest.tracked': 'temple.incal',
  },
  keepsakes: [
    { id: 'desert.knowing', level: 'desert', name: 'What the giants left', kind: 'knowing', text: 'The giants carried the water. The tree drinks what they left.', t: 1 },
    { id: 'incal.word', level: 'incal', name: 'Look up once a day', kind: 'word', text: '“Look up once a day.”', t: 2 },
  ],
};
const OLD_JOURNAL = { relics: {}, stories: { desert: { t: 1 }, incal: { t: 2 } }, seen: { desert: 1, incal: 1 } };
const QUIET = `localStorage.setItem('moebius.muted', '1'); localStorage.setItem('moebius.settings.v1', JSON.stringify({ music: 0, effects: 0, voices: 0, quality: 'low' }));`;

const fresh = async (setup) => {
  await send('Page.navigate', { url: `${URL_}?blank` }); await sleep(300);
  await ev(`localStorage.clear(); ${QUIET} ${setup ?? ''} true`);
};
const inGame = (secs = 150) => until('!!window.__moebiusBooted && !!window.storyRt && !!window.ship && !!window.game', secs, 'the world to load');
const titleContinue = async () => {
  await send('Page.navigate', { url: URL_ });
  await until(`!!document.querySelector('[data-a="continue"]')`, 60, 'the title screen');
  await sleep(600);
  await ev(`document.querySelector('[data-a="continue"]').click(), true`);
  await inGame();
};

try {
  let tabs;
  for (let i = 0; i < 60; i++) { try { tabs = await (await fetch(`http://127.0.0.1:${CDP}/json`)).json(); break; } catch { await sleep(250); } }
  ws = new WebSocket(tabs.find((t) => t.type === 'page').webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener('open', r));
  ws.addEventListener('message', (m) => { const d = JSON.parse(m.data); if (d.id && waits.has(d.id)) { const [res, rej] = waits.get(d.id); waits.delete(d.id); d.error ? rej(new Error(d.error.message)) : res(d.result); } });
  await send('Page.enable'); await send('Runtime.enable');
  // the volumes at 0 before any of the game runs, on every page
  await send('Page.addScriptToEvaluateOnNewDocument', { source: `try { ${QUIET} } catch {}` });

  // ---------------------------------------------------------------- 1. a new game
  console.log('1. a new game: the title, the prologue, the desert');
  await fresh();
  await send('Page.navigate', { url: URL_ });
  await until(`!!document.querySelector('[data-a="new"], [data-a="continue"], .slot.empty .pick, [data-a]')`, 60, 'the title screen');
  await sleep(500);
  const started = await ev(`(() => { const b = document.querySelector('[data-a="new"]') ?? document.querySelector('.slot.empty .pick') ?? document.querySelector('[data-a]'); b?.click(); return b?.dataset.a ?? b?.className ?? null; })()`);
  await sleep(800);
  await ev(`(() => { const b = document.querySelector('.slot.empty .pick'); b?.click(); return true; })()`);   // (Saves: the first empty slot, if it asks)
  await inGame();
  check(await ev(`window.ship.playing`), `the prologue plays on a new game (started with "${started}")`);
  await shot('prologue');
  // skip it as a player does: hold Esc
  for (let k = 0; k < 6 && (await ev('window.ship.playing')); k++) { await key('Escape'); await sleep(2200); await key('Escape', 'keyUp'); await sleep(400); }
  await until(`!window.ship.playing || window.game.flag('prologue.done')`, 120, 'the prologue to end');
  await until(`!window.ship.playing`, 60, 'the last of the prologue');
  await sleep(1500);
  check(await ev(`window.game.flag('prologue.done') === true`), 'the prologue is done');
  check(await ev(`window.quests.isStarted('desert.power') === false`), 'no quest on landing');
  const ob1 = await ev(`window.storyRt.objective()?.label ?? null`);
  check(ob1 === 'Marrow, by your ship', `the drone finds Marrow by the ship (“${ob1}”)`);
  check(await ev(`!window.items.has('backpack')`), 'a bare back: no backpack yet');
  console.log(`  ${await shot('desert-landing')}`);

  // ---------------------------------------------------------------- 2. an old save, the voicemail, the map, travel
  console.log('2. an old save from before the slots and the reorder: the City-Shaft done, the jets, a message waiting');
  await fresh(`localStorage.setItem('moebius.game.v1', ${JSON.stringify(JSON.stringify(OLD_SAVE))}); localStorage.setItem('moebius.journal.v1', ${JSON.stringify(JSON.stringify(OLD_JOURNAL))});`);
  await titleContinue();
  await until('!window.ship.playing', 60, 'the arrival');
  check(await ev(`window.ship.levelId`) === 'incal', `Continue resumes it where the ship stood: ${await ev('window.ship.levelId')}`);
  check(await ev(`window.items.has('jetpack') && window.items.has('backpack')`), 'it keeps the backpack and the jets');
  check(await ev(`window.game.flag('box.incal.temple.jetpack') === true`), 'the Warden’s Well chest stays open');
  check(await ev(`localStorage.getItem('moebius.s1.game.v1') !== null`), 'the save moved into slot 1');
  // the voicemail: message 2 waits (two worlds done, one heard)
  check(await ev(`window.ship.waitingCall()`) === 2, `the voicemail has message 2 waiting (${await ev('window.ship.waitingCall()')})`);
  check(await ev(`!!window.ship.messageWaiting?.()`), 'the voicemail button blinks');
  await ev(`window.ship.useConsole(), true`);
  await sleep(1000);
  check(await ev(`window.ship.playing`), 'the dash plays it');
  await shot('voicemail');
  for (let k = 0; k < 40 && (await ev('window.ship.playing')); k++) { await key('Escape'); await sleep(1600); await key('Escape', 'keyUp'); await sleep(300); }
  await until('!window.ship.playing', 60, 'the message to end');
  check(await ev(`window.game.flag('calls.2') === true`), 'message 2 heard');
  check(await ev(`window.ship.waitingCall() === null`), 'nothing more waiting');
  // the holo table: the map, charting the new route
  await ev(`window.ship.useTable(), true`);
  await sleep(600);
  check(await ev(`window.ship.map.open`), 'the holo table opens the galactic map');
  const known = await ev(`window.ship.map.entries.filter((e) => e.known).map((e) => e.id)`);
  check(JSON.stringify(known) === JSON.stringify(['desert', 'arzach', 'perdide', 'incal']), `it charts the new route on from the old save: ${known.join(', ')}`);
  console.log(`  ${await shot('galactic-map')}`);
  const i = await ev(`window.ship.map.entries.findIndex((e) => e.id === 'arzach')`);
  await ev(`window.ship.map.select(${i}), window.ship.map.go(), true`);
  await sleep(400);
  check(await ev(`window.ship.map.asking?.id === 'arzach'`), 'travel asks first');
  await ev(`window.ship.map.answer(true), true`);
  check(await ev(`window.ship.playing`), 'the ship takes off');
  await until(`location.search.includes('level=arzach')`, 120, 'the jump to Vael');
  await inGame();
  check(await ev(`window.ship.levelId === 'arzach' && window.ship.playing`), 'arriving in Vael by ship');
  const arrival = await ev(`window.ship.cinematic?.constructor?.name ?? null`);
  check(arrival === 'ArrivalDirector', `a landing, not a crash (${arrival})`);
  await sleep(2500);
  await shot('arrival');
  await until('!window.ship.playing', 120, 'the landing to end');
  await sleep(1500);
  const ob2 = await ev(`window.storyRt.objective()?.label ?? null`);
  check(/Oïa/.test(ob2 ?? ''), `the drone finds Oïa, who opens Vael’s quest (“${ob2}”)`);
  check(await ev(`!window.quests.isStarted('arzach.bird')`), 'Vael’s quest waits for its first talk');
  check(await ev(`!window.player.mount || (window.player.mount.dormant && !window.player.mount.object.visible)`), 'the bird is nowhere until her call');
  check(await ev(`window.boxes.list.filter((b) => b.fallback).length === 0`), 'no fallback box by the ship');
  console.log(`  ${await shot('vael')}`);

  // ---------------------------------------------------------------- 3. save and load
  console.log('3. save and load: back to the title and Continue');
  await ev(`window.game.set('playthrough.mark', 1), true`);
  await sleep(4000);   // (the position is saved every few seconds)
  await titleContinue();
  await until('!window.ship.playing', 60, 'the world');
  check(await ev(`window.ship.levelId`) === 'arzach', `Continue resumes in Vael (${await ev('window.ship.levelId')})`);
  check(await ev(`window.game.flag('playthrough.mark') === 1 && window.game.flag('calls.2') === true && window.items.has('jetpack')`), 'the save as it was');
  console.log(`  ${await shot('reloaded')}`);
} catch (e) {
  check(false, `stopped: ${e.message}`);
  try { console.log(`  ${await shot('stopped')}`); } catch { /* */ }
} finally {
  ws?.close();
  chrome.kill();
  server?.kill();
  await sleep(300);
  rmSync(profile, { recursive: true, force: true });
}
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed; screenshots in ${OUT}`);
process.exit(failed.length ? 1 : 0);
