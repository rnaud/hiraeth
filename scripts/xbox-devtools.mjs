// The Xbox app's page from the Mac, through the console's Device Portal (docs/systems/xbox.md, "Debugging on the
// console"). The portal relays WebView2's DevTools at /msedge (no flag in the app needed in Developer Mode).
//
//   node scripts/xbox-devtools.mjs js '<expression>'     → its value (JSON), evaluated in the game's page
//   node scripts/xbox-devtools.mjs console [seconds]     → the page's console for a while (default 30 s)
//   node scripts/xbox-devtools.mjs load [url] [seconds]  → open the page (default index.html?start: the save played
//                                                           last), print its console and the loading screen's stages
//                                                           until the first frame (default at most 300 s)
//   node scripts/xbox-devtools.mjs log [page|update]     → LocalState\web\page.log (or update.log), via the file API
//
// XBOX_PORTAL (default https://192.168.68.64:11443) and XBOX_PACKAGE (the installed package's full name; default:
// read from the portal) say which console. The portal's certificate is self-signed: TLS checks are off here.
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const PORTAL = process.env.XBOX_PORTAL ?? 'https://192.168.68.64:11443';
const [cmd = 'js', a1, a2] = process.argv.slice(2);
const NOISE = /Program Info Log|warning X\d{4}/;

async function packageName() {
  if (process.env.XBOX_PACKAGE) return process.env.XBOX_PACKAGE;
  const r = await (await fetch(`${PORTAL}/api/app/packagemanager/packages`)).json();
  const p = r.InstalledPackages.find((x) => x.PackageFamilyName?.startsWith('rnaud.Hiraeth'));
  if (!p) throw new Error('Hiraeth is not installed on the console');
  return p.PackageFullName;
}

async function connect() {
  const list = await (await fetch(`${PORTAL}/msedge`)).json();
  const page = list.flatMap((b) => b.targets ?? []).find((t) => t.type === 'page' && t.url.includes('hiraeth.example'));
  if (!page) throw new Error('the game\'s page is not open: is Hiraeth running?');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  let id = 0;
  const wait = new Map(), on = [];
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.id && wait.has(m.id)) { wait.get(m.id)(m); wait.delete(m.id); } else on.forEach((f) => f(m));
  };
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  const send = (method, params = {}) => new Promise((r) => { const i = ++id; wait.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  return { send, on: (f) => on.push(f), close: () => ws.close() };
}

const t0 = Date.now();
const ts = () => ((Date.now() - t0) / 1000).toFixed(1).padStart(6);
function printConsole(m) {
  if (m.method === 'Runtime.consoleAPICalled') {
    const text = m.params.args.map((a) => a.value ?? a.description).join(' ');
    if (!NOISE.test(text)) console.log(ts(), m.params.type, text.slice(0, 400));
  } else if (m.method === 'Runtime.exceptionThrown') {
    const d = m.params.exceptionDetails;
    console.log(ts(), 'exception', (d.exception?.description ?? d.text).slice(0, 400));
  }
}

if (cmd === 'log') {
  const name = `${a1 === 'update' ? 'update' : 'page'}.log`;
  const q = new URLSearchParams({ knownfolderid: 'LocalAppData', packagefullname: await packageName(), filename: name, path: '\\LocalState\\web' });
  process.stdout.write(await (await fetch(`${PORTAL}/api/filesystem/apps/file?${q}`)).text());
} else if (cmd === 'js') {
  const c = await connect();
  const r = await c.send('Runtime.evaluate', { expression: a1 ?? 'location.href', awaitPromise: true, returnByValue: true });
  console.log(JSON.stringify(r.result?.result?.value ?? r.result?.exceptionDetails ?? r.result, null, 1));
  c.close();
} else if (cmd === 'console') {
  const c = await connect();
  c.on(printConsole);
  await c.send('Runtime.enable');
  await new Promise((r) => setTimeout(r, (+a1 || 30) * 1000));
  c.close();
} else if (cmd === 'load') {
  const url = a1 ?? 'https://hiraeth.example/index.html?start';
  const max = +a2 || 300;
  const c = await connect();
  let navigated = false;
  c.on((m) => { if (navigated) printConsole(m); });   // (not what the last page had buffered)
  await c.send('Runtime.enable');
  await c.send('Page.enable');
  navigated = true;
  console.log(ts(), 'open', url);
  await c.send('Page.navigate', { url });
  let stage = '';
  while ((Date.now() - t0) / 1000 < max) {
    await new Promise((r) => setTimeout(r, 2000));
    const r = await c.send('Runtime.evaluate', { expression: `JSON.stringify({ b: window.__moebiusBooted === true, msg: document.querySelector('#loading .msg')?.textContent ?? null })`, returnByValue: true });
    const v = JSON.parse(r.result?.result?.value ?? '{}');
    if (v.msg !== stage) { stage = v.msg; console.log(ts(), '[loading screen]', stage); }
    if (v.b) { console.log(ts(), '[first frame]'); break; }
  }
  c.close();
} else {
  console.error('usage: node scripts/xbox-devtools.mjs js <expr> | console [s] | load [url] [s] | log [page|update]');
  process.exit(1);
}
process.exit(0);
