// The handheld's buttons in GeckoView (the test app, com.rnaud.moebius.gecko): each control sent as a gamepad
// key event held (`adb shell input gamepad keyevent --longpress`: a press and its release within one 8 ms frame
// of PadBridge's would reach the page as no press at all), the source a gamepad, through the activity's dispatchKeyEvent and
// PadBridge as a real press is) while the desert runs, then what the page saw: the Standard Gamepad that
// src/native-pad.js serves (its name, which index went down), the layout it chose (padFaces), and whether the
// bottom button made the traveller jump. The game's sound stays at 0; the frame readout on.
//   node scripts/bench/android-pad.mjs --serve dist [--port 6253] [--level desert] [--keys DPAD_UP,BUTTON_A]
// Device rules: only com.rnaud.moebius.gecko is started and stopped, never com.rnaud.moebius; only this script's
// own port rule is added and removed.
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { createServer } from 'node:http';
import { options, sleep, ROOT } from './lib.mjs';
import { ADB } from '../handheld-perf/lib.mjs';
import { Bridge, GeckoPage } from './gecko-bridge.mjs';
import { staticHandler } from './serve.mjs';

const opt = options();
const GPKG = 'com.rnaud.moebius.gecko', GACTIVITY = `${GPKG}/com.rnaud.memento.gecko.MainActivity`;
const PORT = +(opt.port ?? 6253), BASE = `http://localhost:${PORT}/`;
const adb = (args) => {
  if (/com\.rnaud\.moebius(?![.\w])/.test(args.join(' '))) throw new Error('refusing to touch the player\'s app');
  try { return execFileSync(ADB[0], [...ADB.slice(1), ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }); } catch (e) { return String(e.stdout ?? ''); }
};
const KEYS = [['BUTTON_A', 0], ['BUTTON_B', 1], ['BUTTON_X', 2], ['BUTTON_Y', 3], ['BUTTON_L1', 4], ['BUTTON_R1', 5], ['BUTTON_L2', 6], ['BUTTON_R2', 7],
  ['BUTTON_SELECT', 8], ['BUTTON_START', 9], ['BUTTON_THUMBL', 10], ['BUTTON_THUMBR', 11], ['DPAD_UP', 12], ['DPAD_DOWN', 13], ['DPAD_LEFT', 14], ['DPAD_RIGHT', 15]];

const bridge = new Bridge();
const files = staticHandler([['/', resolve(ROOT, String(opt.serve ?? 'dist'))]], { inject: (req) => bridge.tagFor(req) });
const server = createServer((req, res) => { if (!bridge.handle(req, res)) files(req, res); });
await new Promise((r) => server.listen(PORT, r));
adb(['reverse', `tcp:${PORT}`, `tcp:${PORT}`]);
const stop = () => { adb(['shell', 'am', 'force-stop', GPKG]); adb(['reverse', '--remove', `tcp:${PORT}`]); server.close(); };
let failed = 0;
try {
  adb(['shell', 'am', 'force-stop', GPKG]); await sleep(1000);
  const seen = bridge.seen;
  adb(['shell', 'am', 'start', '-n', GACTIVITY, '--es', 'url', BASE + 'bench-blank.html']);
  await bridge.waitPage(BASE, seen);
  const page = new GeckoPage(bridge), ev = (fn, a) => page.eval(fn, a);
  await ev(() => {
    localStorage.clear();
    localStorage.setItem('moebius.game.v1', JSON.stringify({ flags: { 'prologue.done': true, 'item.backpack': true, 'items.v': 2 }, keepsakes: [] }));
    localStorage.setItem('moebius.settings.v1', JSON.stringify({ quality: 'auto', showFps: true, hudV: 1, music: 0, effects: 0, voices: 0 }));
    localStorage.setItem('moebius.muted', '1');
    return true;
  });
  await page.goto(`${BASE}?level=${opt.level ?? 'desert'}&fps=1`);
  await page.waitFor('!!(window.__moebiusBooted && window.renderFrame && window.player)', 300000, 250);
  await sleep(4000);
  await ev(() => { window.story?.closePage?.(); return true; });
  const sound = await ev(() => [window.sound?.musicVol, window.sound?.fxVol, window.sound?.voiceVol]);
  if (sound.some((v) => v > 0)) throw new Error(`sound not at 0: ${sound}`);
  // what the page sees: every pad state that arrives, and the traveller's height over the next frames
  await ev(() => {
    const W = window; W.__padLog = [];
    const orig = W.__nativePad;
    W.__nativePad = (id, axes, buttons) => { W.__padLog.push({ t: performance.now(), id, down: buttons.map((v, i) => (v > 0.5 ? i : -1)).filter((i) => i >= 0) }); return orig?.(id, axes, buttons); };
    W.__ys = []; const tick = () => { W.__ys.push(W.player.pos.y); if (W.__ys.length > 600) W.__ys.shift(); requestAnimationFrame(tick); }; tick();
    return true;
  });
  const rows = [];
  const only = typeof opt.keys === 'string' ? opt.keys.split(',') : null;
  for (const [key, want] of KEYS.filter(([k]) => !only || only.includes(k))) {
    if (key === 'BUTTON_START' || key === 'BUTTON_SELECT') continue;   // (the menus: checked last)
    await ev(() => { window.__padLog.length = 0; window.__ys.length = 0; return true; });
    adb(['shell', 'input', 'gamepad', 'keyevent', '--longpress', `KEYCODE_${key}`]);
    await sleep(900);
    const r = await ev(() => {
      const L = window.__padLog, g = navigator.getGamepads?.()[0];
      const ys = window.__ys, y0 = ys[0] ?? 0;
      return { log: L.map((x) => x.down.join('+') || '-').join(' '), states: L.length, down: [...new Set(L.flatMap((x) => x.down))], id: L[0]?.id ?? g?.id, rise: +(Math.max(...ys) - y0).toFixed(2) };
    });
    const ok = r.down.includes(want);
    if (!ok) failed++;
    rows.push({ key, want, ...r, ok });
    console.log(`${ok ? 'ok  ' : 'MISS'} ${key} → index ${want}: ${r.states} states, down ${JSON.stringify(r.down)}, the traveller rose ${r.rise} m (${r.id}; states ${r.log})`);
  }
  for (const key of ['BUTTON_START', 'BUTTON_SELECT'].filter((k) => !only || only.includes(k))) {
    await ev(() => { window.__padLog.length = 0; return true; });
    adb(['shell', 'input', 'gamepad', 'keyevent', '--longpress', `KEYCODE_${key}`]);
    await sleep(1200);
    const r = await ev(() => ({ down: [...new Set(window.__padLog.flatMap((x) => x.down))], menu: !!(window.menu?.open ?? window.menu?.isOpen?.()), paused: !!window.paused }));
    console.log(`${key}: down ${JSON.stringify(r.down)}, the menu ${r.menu ? 'open' : 'closed'}`);
    rows.push({ key, ...r });
    adb(['shell', 'input', 'gamepad', 'keyevent', '--longpress', `KEYCODE_${key}`]);   // (closed again)
    await sleep(800);
  }
  const layout = await ev(() => ({ gamepad: navigator.getGamepads?.()[0]?.id, faces: document.documentElement.dataset.padFaces ?? null, faceSetting: window.settings?.padFaces }));
  console.log(`layout: ${JSON.stringify(layout)}`);
  console.log(JSON.stringify({ rows, layout }));
} finally {
  stop();
  console.log(`done (${failed} missed); the test app stopped`);
}
process.exit(failed ? 1 : 0);
