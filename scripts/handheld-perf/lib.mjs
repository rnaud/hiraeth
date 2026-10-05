// Measuring the game on an Android handheld over USB (docs/archive/retroid-measurements.md).
// A minimal DevTools-protocol client for the device's Chrome, reached through
//   adb forward tcp:9339 localabstract:chrome_devtools_remote
// with the game served from this Mac through `adb reverse tcp:5219 tcp:5219`.
// No dependencies: Node's own fetch and WebSocket.
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const SDK = process.env.ANDROID_HOME ?? `${process.env.HOME}/Library/Android/sdk`;
export const ADB = [process.env.ADB ?? `${SDK}/platform-tools/adb`, ...(process.env.ANDROID_SERIAL ? ['-s', process.env.ANDROID_SERIAL] : [])];
export const PORT = process.env.PERF_PORT ?? '5219';
export const BASE = `http://localhost:${PORT}/`;
const DT = `http://localhost:${process.env.DEVTOOLS_PORT ?? '9339'}`;
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
/** adb shell, synchronously; '' when it fails */
export const sh = (cmd) => { try { return execFileSync(ADB[0], [...ADB.slice(1), 'shell', cmd], { encoding: 'utf8' }); } catch (e) { return String(e.stdout ?? ''); } };

export class Page {
  constructor(ws) {
    this.ws = ws; this.id = 0; this.pending = new Map(); this.handlers = [];
    ws.addEventListener('message', (ev) => {
      const m = JSON.parse(ev.data);
      if (m.id && this.pending.has(m.id)) { const { res, rej } = this.pending.get(m.id); this.pending.delete(m.id); m.error ? rej(new Error(m.error.message)) : res(m.result); }
      else if (m.method) for (const h of this.handlers) h(m);
    });
  }
  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((res, rej) => { this.pending.set(id, { res, rej }); this.ws.send(JSON.stringify({ id, method, params })); });
  }
  on(f) { this.handlers.push(f); }
  /** Evaluate an expression (string) or a function with one JSON argument in the page; returns the value. */
  async eval(fn, arg, { gesture = false, timeout = 600000 } = {}) {
    const expression = typeof fn === 'function' ? `(${fn})(${JSON.stringify(arg ?? null)})` : fn;
    const r = await Promise.race([
      this.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true, userGesture: gesture }),
      sleep(timeout).then(() => { throw new Error('eval timeout'); }),
    ]);
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
    return r.result.value;
  }
  async goto(url) {
    await this.send('Page.navigate', { url });
    await sleep(1500);
    for (let i = 0; i < 200; i++) { try { if ((await this.eval('document.readyState', null, { timeout: 5000 })) !== 'loading') return; } catch { /* navigating */ } await sleep(250); }
  }
  /** Poll a boolean expression (keep it boolean: `!!x`, a big object can't be returned by value). */
  async waitFor(expr, timeout = 240000, every = 500) {
    const t0 = Date.now();
    while (Date.now() - t0 < timeout) { try { if (await this.eval(expr, null, { timeout: 10000 })) return; } catch { /* */ } await sleep(every); }
    throw new Error('waitFor timeout: ' + expr);
  }
  async screenshot(path) {
    const r = await this.send('Page.captureScreenshot', { format: 'jpeg', quality: 70 });
    writeFileSync(path, Buffer.from(r.data, 'base64'));
  }
  close() { this.ws.close(); }
}

/**
 * Our tab on the device: the one already showing the game, else open one with
 * `adb shell am start -a android.intent.action.VIEW -d http://localhost:5219/ com.android.chrome` first
 * (Chrome on Android refuses DevTools' /json/new).
 */
export async function ourPage() {
  const list = await (await fetch(`${DT}/json`)).json();
  const t = list.find((p) => p.type === 'page' && p.url.startsWith(BASE));
  if (!t) throw new Error(`no tab on ${BASE}: open one on the device first (see lib.mjs ourPage)`);
  await fetch(`${DT}/json/activate/${t.id}`);
  const ws = new WebSocket(t.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.addEventListener('open', r); ws.addEventListener('error', j); });
  const page = new Page(ws);
  await page.send('Runtime.enable');
  await page.send('Page.enable');
  page.on((m) => {
    if (m.method === 'Runtime.consoleAPICalled') page.log?.(m.params.type, m.params.args.map((a) => a.value ?? a.description ?? '').join(' '));
    else if (m.method === 'Runtime.exceptionThrown') page.log?.('exception', m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text);
  });
  page.targetId = t.id;
  return page;
}

/** Temperatures (m°C), the GPU's clock and the thermal status (Qualcomm sysfs: kgsl). */
export function thermal() {
  const out = sh('for z in /sys/class/thermal/thermal_zone*; do t=$(cat $z/type); case $t in gpuss-0|cpu-1-0|battery) echo $t $(cat $z/temp);; esac; done; echo gpufreq $(cat /sys/class/kgsl/kgsl-3d0/devfreq/cur_freq); dumpsys thermalservice | grep "Thermal Status"');
  const r = {};
  for (const l of out.trim().split('\n')) { const [k, ...v] = l.trim().split(/\s+/); r[k] = v.join(' '); }
  return r;
}

/**
 * The tab's own storage (localhost:<port> in Chrome: nothing to do with the app's saves): the prologue
 * done, no resume position (every run starts where its scenario puts it), the preset, sound off.
 */
export async function prepare(page, quality = 'handheld') {
  await page.goto(BASE + 'manifest.webmanifest');
  await page.eval((quality) => {
    if (!localStorage.getItem('perf.ready')) {
      localStorage.clear();
      localStorage.setItem('moebius.game.v1', JSON.stringify({ flags: { 'prologue.done': true, 'item.backpack': true, 'items.v': 2 }, keepsakes: [] }));
      localStorage.setItem('perf.ready', '1');
    }
    for (const k of Object.keys(localStorage)) if (/save\.v1$/.test(k)) localStorage.removeItem(k);
    const s = JSON.parse(localStorage.getItem('moebius.settings.v1') ?? '{}');
    Object.assign(s, { quality, showFps: true, hudV: 1, music: 0, effects: 0, voices: 0 });
    localStorage.setItem('moebius.settings.v1', JSON.stringify(s));
  }, quality);
}
export const fullscreen = (page) => page.eval('document.fullscreenElement ? 1 : document.documentElement.requestFullscreen().then(() => 2, () => 0)', null, { gesture: true });
