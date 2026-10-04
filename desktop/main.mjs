import { app, BrowserWindow, net, protocol } from 'electron';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

// A fixed origin and profile keep saves independent of the installed build.
app.setName('Memento');   // (saves stay in the old 'moebius' profile folder, set just below)
app.setPath('userData', path.join(app.getPath('appData'), 'moebius'));
protocol.registerSchemesAsPrivileged([{ scheme: 'moebius', privileges: {
  standard: true, secure: true, supportFetchAPI: true, corsEnabled: true,
} }]);
if (process.platform === 'linux') app.commandLine.appendSwitch('ozone-platform', 'x11');

if (!app.requestSingleInstanceLock()) app.quit();
else {
  let window;
  app.on('second-instance', () => { window?.restore(); window?.focus(); });
  // Electron waits for an ESM entry point to finish evaluating before ready.
  // Do not top-level-await whenReady(), which would deadlock startup.
  app.whenReady().then(async () => {
  const root = fileURLToPath(new URL('./game/', import.meta.url));
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
    icon: path.join(root, 'icons/icon-512.png'),
    webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true },
  });
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
  await window.loadURL('moebius://game/index.html');
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
