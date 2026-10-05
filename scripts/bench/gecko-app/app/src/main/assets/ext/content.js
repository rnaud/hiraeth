// The page's way to the app in the GeckoView build (GeckoView has no addJavascriptInterface or
// evaluateJavascript): this content script holds a native port (MainActivity's MessageDelegate) and
// talks to the page through DOM events, with a small script of the page's own giving it what the
// WebView build has:
//   - window.Capacitor: isNativePlatform() and nativePromise(plugin, method, args), answered by the app;
//   - window.__nativePad(name, axes, buttons) called with the handheld's controls (PadBridge.java);
//   - the moebius:pause / moebius:resume events when the app leaves and comes back.
const PAGE = `(() => {
  let n = 0; const wait = new Map();
  window.addEventListener('memento:reply', (e) => {
    const { id, ok, value } = JSON.parse(e.detail); const w = wait.get(id); if (!w) return;
    wait.delete(id); if (ok) w[0](value); else w[1](new Error(value));
  });
  window.addEventListener('memento:pad', (e) => { const [id, axes, buttons] = JSON.parse(e.detail); window.__nativePad?.(id, axes, buttons); });
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
port.onMessage.addListener((m) => {
  if (m.pad) window.dispatchEvent(new CustomEvent('memento:pad', { detail: JSON.stringify([m.pad.id, m.pad.axes, m.pad.buttons]) }));
  else if (m.reply) window.dispatchEvent(new CustomEvent('memento:reply', { detail: JSON.stringify(m.reply) }));
  else if (m.event) window.dispatchEvent(new Event(m.event));
});
