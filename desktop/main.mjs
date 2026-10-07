import { app, BrowserWindow, net, powerSaveBlocker, protocol } from 'electron';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { deckUpdates, RESTART_EXIT } from './deck-updates.mjs';

/**
 * The runtime's level, like Android's NATIVE_API: raise it when this file or Electron changes in a way
 * the web game relies on. Content updates (web.json's minDesktop, scripts/web-update.mjs) need it, so
 * an older runtime keeps the game it carries until its own package is updated (scripts/steam-deck/deck.py).
 */
export const DESKTOP_API = 1;
/** A downloaded game that doesn't reach its first frame in this long goes back to the packaged one, for good. */
const BOOT_TIMEOUT_MS = 60_000;

// A fixed origin and profile keep saves independent of the installed build.
app.setName('Memento');   // (saves stay in the old 'moebius' profile folder, set just below)
app.setPath('userData', path.join(app.getPath('appData'), 'moebius'));
protocol.registerSchemesAsPrivileged([{ scheme: 'moebius', privileges: {
  standard: true, secure: true, supportFetchAPI: true, corsEnabled: true,
} }]);
/**
 * Linux's window system: X11 under gamescope (Gaming Mode, whose games run on its Xwayland), the
 * desktop's own Wayland elsewhere. On SteamOS 3.8's Desktop Mode (Plasma 6 on Wayland, Mesa 26.1) X11
 * through Xwayland crashed the GPU process and the window never showed.
 */
export function ozonePlatform(env = process.env) {
  const gamescope = !!env.GAMESCOPE_WAYLAND_DISPLAY || env.XDG_CURRENT_DESKTOP === 'gamescope';
  return env.WAYLAND_DISPLAY && !gamescope ? 'wayland' : 'x11';
}
if (process.platform === 'linux') app.commandLine.appendSwitch('ozone-platform', ozonePlatform());
/**
 * How Chromium draws (MOEBIUS_GPU, from deck.py, which tries them in turn while the game doesn't come
 * up): 'gl' as Electron picks it (ANGLE on OpenGL), 'vulkan' (ANGLE on Vulkan), 'software'.
 */
export function gpuSwitches(mode) {
  if (mode === 'vulkan') return [['use-angle', 'vulkan']];
  if (mode === 'software') return [['disable-gpu'], ['enable-unsafe-swiftshader']];
  return [];
}
for (const [name, value] of gpuSwitches(process.env.MOEBIUS_GPU)) app.commandLine.appendSwitch(name, value);
/** deck.py's launcher: this exit asks it for the next way to draw (GPU_MODES, RETRY_EXIT in deck.py). */
const RETRY_EXIT = 75;
/** A GPU process that crashes this often won't draw the game: quit for the next way to draw. */
const GPU_CRASHES = 2;

const packaged = fileURLToPath(new URL('./game/', import.meta.url));
/**
 * The game to serve: the content update deck.py picked and pinned for this launch (MOEBIUS_GAME, a
 * verified web bundle from the game's site), unless it failed before; else the packaged game.
 */
function pickGame(dir = process.env.MOEBIUS_GAME) {
  if (!dir) return null;
  const root = path.resolve(dir) + path.sep;
  if (!existsSync(path.join(root, 'index.html')) || existsSync(path.join(root, '.failed'))) return null;
  return root;
}

if (!app.requestSingleInstanceLock()) app.quit();
else {
  let window;
  app.on('second-instance', () => { window?.restore(); window?.focus(); });
  // Electron waits for an ESM entry point to finish evaluating before ready.
  // Do not top-level-await whenReady(), which would deadlock startup.
  app.whenReady().then(async () => {
  let download = pickGame(), root = download ?? packaged;
  // the settings' Updates section, when deck.py launched us (MOEBIUS_ROOT: the install it updates)
  const appDir = path.dirname(fileURLToPath(import.meta.url));
  const buildOf = (file, key) => { try { return JSON.parse(readFileSync(file, 'utf8'))[key] || 0; } catch { return 0; } };
  const running = {
    runtime: buildOf(path.join(appDir, 'build.json'), 'build'),
    get web() { return root === packaged ? buildOf(path.join(appDir, 'content.json'), 'web') : buildOf(path.join(root, 'bundle.json'), 'build'); },
    get bundle() { return root !== packaged; },
  };
  const updates = process.env.MOEBIUS_ROOT ? deckUpdates({
    root: process.env.MOEBIUS_ROOT, deckPy: path.join(appDir, 'deck.py'), python: process.env.MOEBIUS_PYTHON || 'python3',
    running, desktop: DESKTOP_API,
  }) : null;
  const answer = async (method) => {
    if (!updates || !['info', 'check', 'download', 'restart'].includes(method)) return new Response('Not on this app', { status: 404 });
    try {
      const body = await updates[method]();
      // (deck.py launches again into the update once the page has its answer)
      if (method === 'restart') setTimeout(() => app.exit(RESTART_EXIT), 150);
      return new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
    } catch (error) {
      return new Response(String(error?.message ?? error), { status: 500 });
    }
  };
  protocol.handle('moebius', (request) => {
    const url = new URL(request.url);
    if (url.hostname === 'game' && url.pathname.startsWith('/__app/')) return answer(url.pathname.slice('/__app/'.length));
    const relative = decodeURIComponent(url.pathname).replace(/^\/+/, '') || 'index.html';
    const target = path.resolve(root, relative);
    if (url.hostname !== 'game' || !target.startsWith(root)) return new Response('Forbidden', { status: 403 });
    return net.fetch(pathToFileURL(target).href);
  });
  window = new BrowserWindow({
    // (MOEBIUS_HIDDEN: a test run on a desktop that mustn't take over its screen, driven over remote debugging)
    title: 'Memento', width: 1280, height: 800, fullscreen: process.env.MOEBIUS_HIDDEN !== '1', show: process.env.MOEBIUS_HIDDEN !== '1',
    autoHideMenuBar: true, backgroundColor: '#fffaf0',
    icon: path.join(packaged, 'icons/icon-512.png'),
    webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true },
  });
  // a game is played with the sticks, not the touchscreen: the screen stays on (no dimming, no sleep)
  // while it runs, in Gaming Mode and on the desktop alike
  powerSaveBlocker.start('prevent-display-sleep');
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith('moebius://game/')) event.preventDefault();
  });
  window.webContents.session.setPermissionRequestHandler((_contents, permission, callback) => {
    callback(permission === 'fullscreen' || permission === 'pointerLock');
  });
  app.on('window-all-closed', () => app.quit());
  // deck.py watches for a window that never comes (Electron hung as it started) and for a GPU that
  // keeps crashing: both send it to the next way to draw, and to Steam's library when none works
  if (process.env.MOEBIUS_READY) {
    window.webContents.once('did-finish-load', () => {
      try { writeFileSync(process.env.MOEBIUS_READY, `${process.pid}\n`); } catch { /* the watchdog decides */ }
    });
    let gpuCrashes = 0;
    app.on('child-process-gone', (_event, details) => {
      if (details.type !== 'GPU' || details.reason === 'clean-exit') return;
      console.error(`GPU process gone (${details.reason}, ${details.exitCode}) drawing with ${process.env.MOEBIUS_GPU ?? 'gl'}`);
      if (++gpuCrashes >= GPU_CRASHES) app.exit(RETRY_EXIT);
    });
  }
  if (process.env.MOEBIUS_SMOKE === '1') {
    window.webContents.on('console-message', (_event, ...args) => console.log(...args));
    window.webContents.on('render-process-gone', (_event, details) => { console.error(details); app.exit(1); });
  }
  // A downloaded game is watched until it boots once (window.__moebiusBooted, src/native-app.js), then
  // trusted (.good). One that doesn't get there, or crashes first, is marked .failed and the packaged
  // game takes over at the same origin, so the saves are the same.
  let fallBack = null;
  if (download && !existsSync(path.join(download, '.good'))) {
    const mark = (name) => { try { writeFileSync(path.join(download, name), new Date().toISOString() + '\n'); } catch { /* read-only: just fall back */ } };
    let settled = false, waited = 0;
    fallBack = (why) => {
      if (settled) return;
      settled = true;
      console.error(`The downloaded game ${download} ${why}: back to the packaged game.`);
      mark('.failed');
      root = packaged;
      window.loadURL('moebius://game/index.html').catch(() => {});
    };
    // (seconds counted by the timer, not the clock: a Deck put to sleep while it boots doesn't count)
    const watch = setInterval(async () => {
      if (settled) { clearInterval(watch); return; }
      let up = false;
      try { up = await window.webContents.executeJavaScript('window.__moebiusBooted === true'); } catch { /* loading */ }
      if (up) { settled = true; clearInterval(watch); mark('.good'); }
      else if ((waited += 1000) >= BOOT_TIMEOUT_MS) { clearInterval(watch); fallBack(`didn't start within ${BOOT_TIMEOUT_MS / 1000} s`); }
    }, 1000);
    window.webContents.on('render-process-gone', () => { clearInterval(watch); fallBack('crashed before it started'); });
  }
  // the settings know what is new without a press, as on Android (deck.py's own update runs at launch too)
  if (updates) setTimeout(() => updates.check().catch(() => {}), 20_000);
  try { await window.loadURL('moebius://game/index.html'); }
  catch (error) { if (fallBack && root !== packaged) fallBack(`didn't load (${error.message})`); else throw error; }
  // CI exercises the packaged browser, local protocol, WebGL and game loading: the title
  // screen first (the game opens on it), then a world straight from ?level= (no save picked).
  if (process.env.MOEBIUS_SMOKE === '1') {
    const deadline = Date.now() + 120_000;
    const until = (js) => new Promise((resolve, reject) => {
      const check = setInterval(async () => {
        try {
          if (await window.webContents.executeJavaScript(js)) { clearInterval(check); resolve(); }
          else if (Date.now() > deadline) { clearInterval(check); reject(new Error(`timed out waiting for: ${js.trim()}`)); }
        } catch (error) { clearInterval(check); reject(error); }
      }, 1000);
    });
    try {
      await until(`Boolean(document.querySelector('#title, .title-screen, [data-title]') || document.querySelector('canvas'))`);
      console.log('MOEBIUS_SMOKE_TITLE');
      await window.loadURL('moebius://game/index.html?level=desert');
      await until(`Boolean(document.querySelector('canvas') && (!document.querySelector('#loading') || document.querySelector('#loading').classList.contains('done')))`);
      console.log('MOEBIUS_SMOKE_OK');
      app.exit(0);
    } catch (error) { console.error(error); app.exit(1); }
  }
  }).catch((error) => { console.error(error); app.exit(1); });
}
