// The handheld's buttons in GeckoView (the test app, com.rnaud.hiraeth.gecko): each control sent as a gamepad
// key event held (`adb shell input gamepad keyevent --longpress`: a press and its release within one 8 ms frame
// of PadBridge's would reach the page as no press at all), the source a gamepad, through the activity's dispatchKeyEvent and
// PadBridge as a real press is) while the desert runs, then what the page saw: the Standard Gamepad that
// src/native-pad.js serves (its name, which index went down), the layout it chose (padFaces), and whether the
// bottom button made the traveller jump. The game's sound stays at 0; the frame readout on.
//   node scripts/bench/android-pad.mjs --serve dist [--port 6253] [--level arena] [--keys DPAD_UP,BUTTON_A]
// --real 1: the controls written into the handheld's own controller node instead (`sendevent` on the
// /dev/input/event* that has gamepad buttons and sticks, the Retroid's "Retroid Pocket Controller": the shell user
// is in the input group), so each press goes kernel → the system's key layout (Generic.kl) → the activity as a
// hardware press does, under the controller's own name (the layout guess), sticks, analog triggers and hat too.
// Every write first checks that the test app holds the focus, else it stops: nothing is sent to another app.
// The d-pad is tried both ways the node allows: the hat (ABS_HAT0X/Y) and the BTN_DPAD_* keys, which the system's
// key layout leaves unmapped (reported as "none", not a miss). Use --level arena: the desert's ?level= spawn boxes
// the traveller in (2026-10-12).
// --gecko 1 (with --real): the test app started without PadBridge: what Gecko's own Gamepad API reports.
// Device rules: only com.rnaud.hiraeth.gecko is started and stopped, never com.rnaud.hiraeth; only this script's
// own port rule is added and removed.
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { createServer } from 'node:http';
import { options, sleep, ROOT } from './lib.mjs';
import { ADB } from '../handheld-perf/lib.mjs';
import { Bridge, GeckoPage } from './gecko-bridge.mjs';
import { staticHandler } from './serve.mjs';

const opt = options();
const GPKG = 'com.rnaud.hiraeth.gecko', GACTIVITY = `${GPKG}/com.rnaud.hiraeth.gecko.MainActivity`;
const PORT = +(opt.port ?? 6253), BASE = `http://localhost:${PORT}/`;
const adb = (args) => {
  if (/com\.rnaud\.hiraeth(?![.\w])/.test(args.join(' '))) throw new Error('refusing to touch the player\'s app');
  try { return execFileSync(ADB[0], [...ADB.slice(1), ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }); } catch (e) { return String(e.stdout ?? ''); }
};
const KEYS = [['BUTTON_A', 0], ['BUTTON_B', 1], ['BUTTON_X', 2], ['BUTTON_Y', 3], ['BUTTON_L1', 4], ['BUTTON_R1', 5], ['BUTTON_L2', 6], ['BUTTON_R2', 7],
  ['BUTTON_SELECT', 8], ['BUTTON_START', 9], ['BUTTON_THUMBL', 10], ['BUTTON_THUMBR', 11], ['DPAD_UP', 12], ['DPAD_DOWN', 13], ['DPAD_LEFT', 14], ['DPAD_RIGHT', 15]];
const REAL = !!+(opt.real ?? 0), GECKO = !!+(opt.gecko ?? 0);
// --real: [name, evdev writes (type code value), what the page should get]. The face codes are Linux's (BTN_SOUTH
// 304, EAST 305, NORTH 307, WEST 308), which Generic.kl names BUTTON_A, B, X, Y.
const EV = { KEY: 1, ABS: 3 };
// (the sticks first: the d-pad opens the game's own quick menus, which then take the sticks)
const REAL_CONTROLS = [
  ['ABS_X -max (left stick left)', [[EV.ABS, 0, -32767]], { axis: 0, sign: -1, moves: true }],
  ['ABS_Y -max (left stick up)', [[EV.ABS, 1, -32767]], { axis: 1, sign: -1, moves: true }],
  ['ABS_Z +max (right stick right)', [[EV.ABS, 2, 32767]], { axis: 2, sign: 1 }],
  ['ABS_RZ -max (right stick up)', [[EV.ABS, 5, -32767]], { axis: 3, sign: -1 }],
  ['BTN_SOUTH (A)', [[EV.KEY, 304, 1]], { button: 0 }], ['BTN_EAST (B)', [[EV.KEY, 305, 1]], { button: 1 }],
  ['BTN_NORTH (X)', [[EV.KEY, 307, 1]], { button: 2 }], ['BTN_WEST (Y)', [[EV.KEY, 308, 1]], { button: 3 }],
  ['BTN_TL (L1)', [[EV.KEY, 310, 1]], { button: 4 }], ['BTN_TR (R1)', [[EV.KEY, 311, 1]], { button: 5 }],
  ['BTN_TL2 (L2)', [[EV.KEY, 312, 1]], { button: 6 }], ['BTN_TR2 (R2)', [[EV.KEY, 313, 1]], { button: 7 }],
  ['ABS_BRAKE (L2 analog)', [[EV.ABS, 10, 32767]], { button: 6 }], ['ABS_GAS (R2 analog)', [[EV.ABS, 9, 32767]], { button: 7 }],
  ['BTN_THUMBL (L3)', [[EV.KEY, 317, 1]], { button: 10 }], ['BTN_THUMBR (R3)', [[EV.KEY, 318, 1]], { button: 11 }],
  ['HAT0Y -1 (d-pad up)', [[EV.ABS, 17, -1]], { button: 12 }], ['HAT0Y +1 (d-pad down)', [[EV.ABS, 17, 1]], { button: 13 }],
  ['HAT0X -1 (d-pad left)', [[EV.ABS, 16, -1]], { button: 14 }], ['HAT0X +1 (d-pad right)', [[EV.ABS, 16, 1]], { button: 15 }],
  ['BTN_DPAD_UP', [[EV.KEY, 544, 1]], { button: 12, unmapped: true }], ['BTN_DPAD_DOWN', [[EV.KEY, 545, 1]], { button: 13, unmapped: true }],
  ['BTN_DPAD_LEFT', [[EV.KEY, 546, 1]], { button: 14, unmapped: true }], ['BTN_DPAD_RIGHT', [[EV.KEY, 547, 1]], { button: 15, unmapped: true }],
];
const releaseOf = (writes) => writes.map(([t, c]) => [t, c, 0]);
let node = null;
const focused = () => /mCurrentFocus=Window\{[^}]*com\.rnaud\.hiraeth\.gecko\//.test(adb(['shell', 'dumpsys', 'window']));
/** evdev events into the controller's node, held holdMs then `then`; only while the test app has the focus */
function write(writes, holdMs = 0, then = null) {
  if (!focused()) throw new Error('the test app does not have the focus: nothing written');
  const ev = (w) => w.map(([t, c, v]) => `sendevent ${node} ${t} ${c} ${v}`).concat(`sendevent ${node} 0 0 0`).join('; ');
  adb(['shell', ev(writes) + (then ? `; sleep ${holdMs / 1000}; ${ev(then)}` : '')]);
}
function findNode() {
  for (const block of adb(['shell', 'getevent', '-pl']).split(/(?=add device)/)) {
    const m = block.match(/add device \d+: (\S+)\s+name:\s+"([^"]+)"/);
    if (m && /BTN_GAMEPAD|BTN_SOUTH/.test(block) && /ABS_X/.test(block)) return { path: m[1], name: m[2] };
  }
  return null;
}

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
  adb(['shell', 'am', 'start', '-n', GACTIVITY, '--es', 'url', BASE + 'bench-blank.html', ...(GECKO ? ['--ez', 'pad', 'false'] : [])]);
  await bridge.waitPage(BASE, seen);
  const page = new GeckoPage(bridge), ev = (fn, a) => page.eval(fn, a);
  await ev(() => {
    localStorage.clear();
    localStorage.setItem('hiraeth.game.v1', JSON.stringify({ flags: { 'prologue.done': true, 'item.backpack': true, 'items.v': 2 }, keepsakes: [] }));
    localStorage.setItem('hiraeth.settings.v1', JSON.stringify({ quality: 'auto', showFps: true, hudV: 1, music: 0, effects: 0, voices: 0, soundV: 1 }));
    localStorage.setItem('hiraeth.muted', '1');
    return true;
  });
  await page.goto(`${BASE}?level=${opt.level ?? 'arena'}&fps=1`);
  await page.waitFor('!!(window.__hiraethBooted && window.renderFrame && window.player)', 300000, 250);
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
  if (REAL) {
    const found = findNode();
    if (!found) throw new Error('no controller node found (getevent -pl)');
    node = found.path;
    console.log(`the controller: "${found.name}" at ${node}${GECKO ? ' (no PadBridge: Gecko\'s own Gamepad API)' : ''}`);
    // what the page sees, whichever path serves it: navigator.getGamepads() every frame
    await ev(() => {
      const W = window; W.__gpLog = [];
      const poll = () => {
        for (const g of navigator.getGamepads?.() ?? []) if (g) W.__gpLog.push({ id: g.id, mapping: g.mapping, down: g.buttons.map((b, i) => (b.value > 0.5 ? i : -1)).filter((i) => i >= 0), axes: g.axes.map((a) => +a.toFixed(2)) });
        if (W.__gpLog.length > 2000) W.__gpLog.splice(0, 1000);
        requestAnimationFrame(poll);
      };
      poll(); return true;
    });
    for (const [name, writes, want] of REAL_CONTROLS.filter(([n]) => !only || only.some((k) => n.includes(k)))) {
      await ev(() => { window.__gpLog.length = 0; window.__ys.length = 0; return true; });
      const p0 = await ev(() => [window.player.pos.x, window.player.pos.z]);
      write(writes, want.moves ? 1200 : 400, releaseOf(writes));
      await sleep(700);
      const r = await ev(() => {
        const L = window.__gpLog, ys = window.__ys, y0 = ys[0] ?? 0;
        const axes = L.length ? L[0].axes.map((_, i) => { const v = L.map((x) => x.axes[i]); return -Math.min(...v) > Math.max(...v) ? Math.min(...v) : Math.max(...v); }) : [];
        return { frames: L.length, id: L[0]?.id ?? null, mapping: L[0]?.mapping ?? null, down: [...new Set(L.flatMap((x) => x.down))], axes, rise: +(Math.max(...ys) - y0).toFixed(2), pos: [window.player.pos.x, window.player.pos.z] };
      });
      const moved = +Math.hypot(r.pos[0] - p0[0], r.pos[1] - p0[1]).toFixed(2);
      const ok = want.button != null ? r.down.includes(want.button) : Math.sign(r.axes[want.axis] ?? 0) === want.sign && Math.abs(r.axes[want.axis]) > 0.5;
      if (!ok && !want.unmapped) failed++;   // (Generic.kl has no BTN_DPAD_*: no app gets them, so a d-pad that sent them would be dead everywhere)
      rows.push({ name, want, ok, ...r, moved });
      console.log(`${ok ? 'ok  ' : want.unmapped ? 'none' : 'MISS'} ${name} → ${want.button != null ? `button ${want.button}` : `axis ${want.axis} ${want.sign > 0 ? '+' : '−'}`}: down ${JSON.stringify(r.down)}, axes ${JSON.stringify(r.axes)}, rose ${r.rise} m, moved ${moved} m (${r.frames} frames, ${r.id}, ${r.mapping})`);
    }
    for (const [name, code] of [['BTN_START', 315], ['BTN_SELECT', 314]].filter(([n]) => !only || only.some((k) => n.includes(k)))) {
      await ev(() => { window.__gpLog.length = 0; return true; });
      write([[EV.KEY, code, 1]], 400, [[EV.KEY, code, 0]]);
      await sleep(1200);
      const r = await ev(() => ({ down: [...new Set(window.__gpLog.flatMap((x) => x.down))], menu: !!(window.menu?.open ?? window.menu?.isOpen?.()) }));
      console.log(`${name}: down ${JSON.stringify(r.down)}, the menu ${r.menu ? 'open' : 'closed'}`);
      rows.push({ name, ...r });
      write([[EV.KEY, code, 1]], 400, [[EV.KEY, code, 0]]);   // (closed again)
      await sleep(900);
    }
  }
  for (const [key, want] of KEYS.filter(([k]) => !REAL && (!only || only.includes(k)))) {
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
  for (const key of ['BUTTON_START', 'BUTTON_SELECT'].filter((k) => !REAL && (!only || only.includes(k)))) {
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
