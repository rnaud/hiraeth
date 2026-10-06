import { app, BrowserWindow, net, powerSaveBlocker, protocol } from 'electron';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { existsSync, writeFileSync } from 'node:fs';
import path from 'node:path';

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
if (process.platform === 'linux') app.commandLine.appendSwitch('ozone-platform', 'x11');

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
  protocol.handle('moebius', (request) => {
    const url = new URL(request.url);
    const relative = decodeURIComponent(url.pathname).replace(/^\/+/, '') || 'index.html';
    const target = path.resolve(root, relative);
    if (url.hostname !== 'game' || !target.startsWith(root)) return new Response('Forbidden', { status: 403 });
    return net.fetch(pathToFileURL(target).href);
  });
  window = new BrowserWindow({
    title: 'Memento', width: 1280, height: 800, fullscreen: true,
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
