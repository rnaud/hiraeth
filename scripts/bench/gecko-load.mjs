// scripts/load-breakdown.mjs on the handheld (--gecko): the GeckoView test app (com.rnaud.hiraeth.gecko, scripts/bench/
// gecko-apk.sh) driven through the page's bridge (gecko-bridge.mjs), shaped as load-breakdown's chrome() page, so the
// same measure() runs: the probe goes in before the page's scripts (the bridge's init), the evaluations go through
// the bridge, the memory is the app's three processes' PSS (dumpsys meminfo).
//   how   'cold'     the test app's data cleared first (`pm clear` of the test app only): a first install, no Gecko
//                    profile, no driver shader cache (EGL's blob cache lives in the app's own cache)
//         'warm'     the app stopped and started again (a relaunch: the driver's shader cache kept)
//         'session'  the same app, the page loaded again (a second world in one sitting)
//   apk   the game bundled in the test app's APK (as it ships, AssetServer on 127.0.0.1:6281), else served from the Mac
// Device rules (docs/systems/performance.md): only the test app is started, stopped or cleared, never the player's
// com.rnaud.hiraeth; only this module's own port rule is added and removed; the game's sound is at 0 (checked) and
// its frame readout on.
import { execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { Bridge, GeckoPage } from './gecko-bridge.mjs';
import { staticHandler } from './serve.mjs';
import { ADB, thermal } from '../handheld-perf/lib.mjs';

export const GPKG = 'com.rnaud.hiraeth.gecko';
const GACTIVITY = `${GPKG}/${GPKG}.MainActivity`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** adb, refusing anything that would reach the player's app or the system's settings */
export function adb(args) {
  const line = args.join(' ');
  if (/com\.rnaud\.hiraeth(?![.\w])|com\.rnaud\.moebius(?![.\w])/.test(line)) throw new Error(`refusing to touch the player's app: adb ${line}`);
  if (/\b(settings\s+put|setprop|uninstall|pm\s+(uninstall|disable))\b/.test(line)) throw new Error(`refusing: adb ${line}`);
  if (/\bpm\s+clear\b/.test(line) && !line.includes(`pm clear ${GPKG}`)) throw new Error(`refusing: adb ${line}`);
  try { return execFileSync(ADB[0], [...ADB.slice(1), ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }); } catch (e) { return String(e.stdout ?? ''); }
}
const sh = (cmd) => adb(['shell', cmd]);

/** the test app's processes: the parent (the app), its GPU process, its content processes */
function processes() {
  const list = [];
  for (const l of sh('ps -A -o PID,NAME').split('\n')) {
    const m = l.trim().match(/^(\d+)\s+(\S+)$/); if (!m) continue;
    const [pid, name] = [+m[1], m[2]];
    if (name === GPKG) list.push({ pid, role: 'parent' });
    else if (name.startsWith(GPKG + ':gpu')) list.push({ pid, role: 'gpu' });
    else if (name.startsWith(GPKG + ':tab')) list.push({ pid, role: 'tab' });
  }
  return list;
}
const pss = (pid) => { const m = sh(`dumpsys meminfo ${pid}`).match(/TOTAL PSS:\s+(\d+)/) ?? sh(`dumpsys meminfo ${pid}`).match(/TOTAL\s+(\d+)/); return m ? Math.round(+m[1] / 1024) : 0; };
/** PSS, MB: the biggest content process (the game's tab), the GPU process, the parent, and their sum */
export function memoryMB() {
  const procs = processes(), out = { tabMB: 0, gpuMB: 0, parentMB: 0 };
  for (const p of procs) { const v = pss(p.pid); if (p.role === 'tab') out.tabMB = Math.max(out.tabMB, v); else out[`${p.role}MB`] = v; }
  out.totalMB = out.tabMB + out.gpuMB + out.parentMB;
  return out;
}
export const temps = () => { const t = thermal(); return { gpuC: +t['gpuss-0'] / 1000, cpuC: +t['cpu-1-0'] / 1000, thermal: t.Thermal }; };
/** wait for the GPU to cool under startC (6 minutes at most) */
export async function coolDown(label, startC = 48) {
  const t0 = Date.now();
  let t = temps();
  while (t.gpuC > startC && Date.now() - t0 < 6 * 60000) { console.log(`${label}: GPU ${t.gpuC} °C > ${startC}: cooling…`); await sleep(20000); t = temps(); }
  return { ...t, waited: Math.round((Date.now() - t0) / 1000) };
}

/** The game's server on the Mac with the bridge (port: adb reverse), for every load of a run. */
export async function geckoServer(dist, { port = 6253, apk = false } = {}) {
  const bridge = new Bridge();
  const files = staticHandler([['/', dist]], { inject: (req) => bridge.tagFor(req) });
  const server = createServer((req, res) => { if (!bridge.handle(req, res)) files(req, res); });
  await new Promise((r) => server.listen(port, r));
  adb(['reverse', `tcp:${port}`, `tcp:${port}`]);
  const keeper = setInterval(() => { if (!adb(['reverse', '--list']).includes(`tcp:${port}`)) adb(['reverse', `tcp:${port}`, `tcp:${port}`]); }, 1500);
  const mac = `http://localhost:${port}/`;
  const base = apk ? 'http://127.0.0.1:6281/' : mac;
  let page = null, closed = false;
  process.on('exit', () => { if (!closed) { closed = true; stopApp(); adb(['reverse', '--remove', `tcp:${port}`]); } });   // (a run that fails leaves nothing running)
  const stopApp = () => adb(['shell', 'am', 'force-stop', GPKG]);
  const start = async (clear) => {
    stopApp(); await sleep(800);
    if (clear) { adb(['shell', 'pm', 'clear', GPKG]); await sleep(800); }
    const seen = bridge.seen;
    adb(['shell', 'am', 'start', '-n', GACTIVITY, ...(apk ? ['--es', 'url', 'bundled:/bench-blank.html', '--es', 'inject', `${mac}__bridge/init.js`] : ['--es', 'url', `${mac}bench-blank.html`])]);
    await bridge.waitPage(apk ? base : mac, seen, 180000);
    page = new GeckoPage(bridge);
  };
  return {
    base, bridge,
    /** a page shaped as load-breakdown's chrome(): `how` cold | warm | session */
    async open(how) {
      if (how === 'cold' || how === 'warm' || !page) await start(how === 'cold');
      const errors = [];
      page.log = (type, text) => { if (type === 'exception') errors.push(text.slice(0, 300)); };
      const ev = (expression, timeout = 180000) => page.eval(expression, null, { timeout });   // (a job sent to a page that goes is never answered)
      const send = async (method, params = {}) => {
        if (method === 'Page.addScriptToEvaluateOnNewDocument') { bridge.init = params.source; return {}; }
        if (method === 'Page.navigate') {
          if (/manifest\.webmanifest$/.test(params.url)) return {};   // (the storage is set from the blank page the app is on)
          await page.eval(`setTimeout(() => { location.href = ${JSON.stringify(params.url)}; }, 50), true`, null, { timeout: 20000 });
          return {};
        }
        if (method === 'Runtime.getHeapUsage') throw new Error('not in Gecko');
        return {};
      };
      return { send, ev, errors, close: async () => {}, processes: memoryMB, gecko: true };
    },
    /**
     * Between loads: the test app kept in front on its blank page, so nothing of the game runs (and the app that was in
     * front before, which might be the player's, stays paused behind it, not drawing while the device cools).
     */
    /** the test app up on its blank page (before the first cool-down: the app in front until then stays behind it) */
    async ensure() { if (!page) await start(false); },
    async rest() {
      if (!page) return;
      const seen = bridge.seen;
      try { await page.eval(`setTimeout(() => { location.href = ${JSON.stringify(`${base}bench-blank.html`)}; }, 50), true`, null, { timeout: 20000 }); await bridge.waitPage(base, seen, 60000); }
      catch { await start(false); }
    },
    close() { if (closed) return; closed = true; clearInterval(keeper); stopApp(); adb(['reverse', '--remove', `tcp:${port}`]); server.close(); },
  };
}
