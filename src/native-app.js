// The Android app around the game (android/.../MainActivity.java, WebBundles.java,
// AppShellPlugin.java). In a browser all of this is a no-op.
//
// - The boot heartbeat: markBooted() after the first frame sets
//   window.__moebiusBooted. A downloaded web build that doesn't get there in
//   time is dropped by the app, which goes back to the game in the APK.
// - Which build is running (settings: "web build 14 · app 12"), and a game
//   toast plus a "restart now" button when a downloaded update is ready (the
//   app applies it by itself on the next launch).
// - Pause and resume: the app sends moebius:pause / moebius:resume (and the
//   page turns hidden, which stops the frame loop); the sound is suspended
//   meanwhile and comes back after the screen unlocks. On a handheld nothing
//   reaches the page as a key or a click, so the sound also starts on the
//   first controller input.

import { nativePad } from './native-pad.js';

const shell = (win) => (win?.Capacitor?.isNativePlatform?.() && win.Capacitor.nativePromise ? win.Capacitor : null);
const ask = (win, method) => shell(win)?.nativePromise('AppShell', method).catch(() => null) ?? Promise.resolve(null);

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
 * @param {{ sound?: { ctx?: AudioContext, start(): void }, label?: () => HTMLElement | null, toast?: (text: string) => void }} hooks
 */
export function installAppShell({ sound, label = () => null, toast = () => {} } = {}, win = globalThis.window) {
  if (!shell(win)) return null;
  let info = null, told = 0;
  const show = () => {
    const el = label();
    if (!el || !info) return;
    el.hidden = false;
    el.textContent = buildLabel(info);
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
  const ready = () => {
    if (!info?.ready || told === info.ready) return;
    told = info.ready;
    const text = `Update ready${info.readyVersion ? ` (v${info.readyVersion})` : ''} — restart to apply`;
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
