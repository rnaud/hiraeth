// The page's way to the app in GeckoView (android/.../MainActivity.java). GeckoView has no
// addJavascriptInterface or evaluateJavascript: this content script holds a native port (the
// activity's MessageDelegate, "memento") and talks to the page through DOM events, with a small
// script of the page's own that gives it what Capacitor gives it in the WebView:
//   - window.Capacitor: isNativePlatform() and nativePromise(plugin, method, args), answered by
//     the app (AppShell.java: info, check, download, restart, openApk);
//   - window.__nativePad(name, axes, buttons), called with the handheld's controls (GamepadBridge);
//   - DOM events from the app: moebius:pause, moebius:resume, moebius:webupdate (with its detail);
//     window.__moebiusAway follows pause / resume, and an event sent with an id is answered once
//     the page has handled it (MainActivity waits for the pause's answer before deactivating).
// The app may ask whether the page has booted (window.__moebiusBooted: WebBundles' watchdog), and
// hears when the saves copied from the WebView have been written (AssetServer's import script).
const PAGE = `(() => {
  let n = 0; const wait = new Map();
  window.addEventListener('memento:reply', (e) => {
    const { id, ok, value } = JSON.parse(e.detail); const w = wait.get(id); if (!w) return;
    wait.delete(id); if (ok) w[0](value); else w[1](new Error(value));
  });
  window.addEventListener('memento:pad', (e) => { const [id, axes, buttons] = JSON.parse(e.detail); window.__nativePad?.(id, axes, buttons); });
  window.addEventListener('memento:event', (e) => {
    const [name, detail] = JSON.parse(e.detail);
    // (kept for the page's guard, src/audio-guard.js: a page that starts while the app is away stays silent)
    if (name === 'moebius:pause') window.__moebiusAway = true;
    else if (name === 'moebius:resume') window.__moebiusAway = false;
    window.dispatchEvent(detail == null ? new Event(name) : new CustomEvent(name, { detail }));
  });
  window.Capacitor = {
    isNativePlatform: () => true, getPlatform: () => 'android', engine: 'gecko',
    nativePromise: (plugin, method, args) => new Promise((res, rej) => {
      const id = ++n; wait.set(id, [res, rej]);
      window.dispatchEvent(new CustomEvent('memento:call', { detail: JSON.stringify({ id, plugin, method, args: args ?? {} }) }));
    }),
  };
})();`;
const s = document.createElement('script');
s.textContent = PAGE;
(document.head ?? document.documentElement).appendChild(s);
s.remove();

const port = browser.runtime.connectNative('memento');
window.addEventListener('memento:call', (e) => port.postMessage({ call: JSON.parse(e.detail) }));
window.addEventListener('memento:imported', (e) => port.postMessage({ imported: String(e.detail ?? '') }));
port.onMessage.addListener((m) => {
  if (m.pad) window.dispatchEvent(new CustomEvent('memento:pad', { detail: JSON.stringify([m.pad.id, m.pad.axes, m.pad.buttons]) }));
  else if (m.reply) window.dispatchEvent(new CustomEvent('memento:reply', { detail: JSON.stringify(m.reply) }));
  else if (m.event) {
    // (dispatched synchronously: the page's handlers have run, its sound suspended, when the answer goes)
    window.dispatchEvent(new CustomEvent('memento:event', { detail: JSON.stringify([m.event, m.detail ?? null]) }));
    if (m.id) port.postMessage({ answer: m.id, value: true });
  }
  else if (m.ask === 'booted') port.postMessage({ answer: m.id, value: window.wrappedJSObject.__moebiusBooted === true });
});
