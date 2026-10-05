// The Android app around the game (android/.../MainActivity.java, WebBundles.java,
// AppShellPlugin.java). In a browser all of this is a no-op.
//
// - The boot heartbeat: markBooted() after the first frame sets
//   window.__moebiusBooted. A downloaded web build that doesn't get there in
//   time is dropped by the app, which goes back to the game in the APK.
// - The settings' update section (src/update-panel.js, src/updates.js) asks the
//   app through callApp(): info, check, download, restart, openApk.
// - A game toast when a downloaded update is ready; the app applies it by itself
//   on the next launch, and applyReadyUpdate() (src/boot.js) applies it the next
//   time the title screen opens (nothing is running yet there).
// - Pause and resume: the app sends moebius:pause / moebius:resume (and the
//   page turns hidden, which stops the frame loop); the sound is suspended
//   meanwhile and comes back after the screen unlocks. On a handheld nothing
//   reaches the page as a key or a click, so the sound also starts on the
//   first controller input.

import { nativePad } from './native-pad.js';

const shell = (win) => (win?.Capacitor?.isNativePlatform?.() && win.Capacitor.nativePromise ? win.Capacitor : null);
const ask = (win, method) => shell(win)?.nativePromise('AppShell', method).catch(() => null) ?? Promise.resolve(null);

/** Whether the page runs in the Android app (with its AppShell plugin). */
export const inApp = (win = globalThis.window) => !!shell(win);

/** Ask the app (AppShellPlugin): rejects with the app's message, or when not in the app. */
export function callApp(method, win = globalThis.window) {
  const s = shell(win);
  return s ? s.nativePromise('AppShell', method) : Promise.reject(new Error('not in the app'));
}

const APPLIED_KEY = 'moebius.appliedUpdate';
/**
 * The title screen is the safe point for a downloaded update: nothing is running yet, so
 * switch to it there (the page reloads into the new build, at the title). Once per build per
 * session, so a switch that doesn't happen can't loop. @returns whether the page is reloading
 */
export async function applyReadyUpdate(win = globalThis.window, { timeout = 1500 } = {}) {
  if (!shell(win)) return false;
  const info = await Promise.race([ask(win, 'info'), new Promise((r) => setTimeout(() => r(null), timeout))]);
  if (!info?.ready) return false;
  try {
    if (win.sessionStorage?.getItem(APPLIED_KEY) === String(info.ready)) return false;
    win.sessionStorage?.setItem(APPLIED_KEY, String(info.ready));
  } catch { /* ignore */ }
  try { await callApp('restart', win); return true; } catch { return false; }
}

/** The heartbeat the app waits for (call it after the first frame). */
export function markBooted(win = globalThis.window) {
  if (!win) return;
  win.__moebiusBooted = true;
  win.__moebiusBootedAt = win.performance?.now?.() ?? 0;
}

/** "web build 14 · app 12" (+ the update waiting for the next launch). */
export function buildLabel(info) {
  if (!info?.web) return '';
  const ready = info.ready ? ` · update ${info.readyVersion ? `v${info.readyVersion} ` : ''}(build ${info.ready}) ready` : '';
  return `web build ${info.web}${info.bundle ? '' : ' (built in)'} · app ${info.app}${ready}`;
}

/**
 * Whether this is the newest game, from the app's last update check (apps from
 * v0.38 on report it; older ones don't, and get no line).
 */
export function updateStatus(info) {
  if (!info?.web || !info.check) return '';
  const latest = info.latest || 0;
  switch (info.check) {
    case 'ready': return `Build ${info.ready || latest} downloaded: restart to play it`;
    case 'downloading': return `Build ${latest} available, downloading…`;
    case 'current': return `Up to date (build ${info.web})`;
    case 'checking': return 'Checking for updates…';
    case 'apk': return `Build ${latest} needs a newer app: accept the app update when it is offered`;
    case 'offline': return `Offline: can't check for updates (playing build ${info.web})`;
    case 'error': return `Couldn't check for updates (playing build ${info.web})`;
    default: return '';
  }
}

/**
 * @param {{ sound?: { ctx?: AudioContext, start(): void }, label?: () => HTMLElement | null, toast?: (text: string) => void }} hooks
 */
const TOLD_KEY = 'moebius.updateToastFor';

export function installAppShell({ sound, label = () => null, toast = () => {} } = {}, win = globalThis.window) {
  if (!shell(win)) return null;
  let info = null, told = 0;
  const show = () => {
    const el = label();
    if (!el || !info) return;
    el.hidden = false;
    el.textContent = buildLabel(info);
    const st = updateStatus(info);
    if (st) { const s = win.document.createElement('div'); s.className = 'update-status'; s.textContent = st; el.append(s); }
    if (info.ready) {
      const b = win.document.createElement('button');
      b.type = 'button'; b.textContent = 'restart now'; b.style.marginLeft = '8px';
      b.addEventListener('click', () => ask(win, 'restart'));
      el.append(b);
    }
  };
  // the toast waits for the game to be up, and for the "Updated to …" toast of a fresh version to pass
  const later = (f) => {
    const at = win.__moebiusBootedAt;
    if (at === undefined) return setTimeout(() => later(f), 2000);
    setTimeout(f, Math.max(0, at + 9000 - (win.performance?.now?.() ?? Infinity)));
  };
  // once per downloaded build, not again on every world (each world is a new page)
  try { told = +(win.localStorage?.getItem(TOLD_KEY) ?? 0); } catch { /* ignore */ }
  const ready = () => {
    if (!info?.ready || told === info.ready) return;
    told = info.ready;
    try { win.localStorage?.setItem(TOLD_KEY, String(told)); } catch { /* ignore */ }
    const text = `Update ready${info.readyVersion ? ` (v${info.readyVersion})` : ''}: it starts at the title screen, or choose Restart now in the Menu`;
    later(() => toast(text));
  };
  const refresh = () => ask(win, 'info').then((i) => { if (i) { info = i; show(); ready(); } });
  refresh();
  win.addEventListener('moebius:webupdate', refresh);

  // sound: off while the app is away, back on return (also after unlocking the screen)
  const ctx = () => (sound?.ctx && sound.ctx.state !== 'closed' ? sound.ctx : null);
  const away = () => { ctx()?.suspend?.().catch?.(() => {}); };
  const back = () => { if (!win.document.hidden) ctx()?.resume?.().catch?.(() => {}); };
  win.addEventListener('moebius:pause', away);
  win.addEventListener('moebius:resume', back);
  win.document.addEventListener('visibilitychange', () => (win.document.hidden ? away() : back()));
  win.addEventListener('nativepadconnected', () => sound?.start?.());
  if (nativePad()) sound?.start?.();   // (the controller was already used during the loading screen)
  return { refresh, info: () => info };
}
