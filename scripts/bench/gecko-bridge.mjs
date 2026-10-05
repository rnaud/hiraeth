// Driving a page in GeckoView from this Mac without DevTools: GeckoView's remote debugging speaks
// Firefox's own protocol, not Chrome's, so instead the page itself takes the bench's work. Every page
// the server gives a Gecko engine (its user agent says Firefox) starts with
//   <script src="/__bridge/init.js">
// which runs the scripts the bench would have added before the page's own (INSTRUMENT, as
// Page.addScriptToEvaluateOnNewDocument does), then long-polls this server for expressions to
// evaluate and posts their values back (JSON, as Runtime.evaluate's returnByValue), with its console
// errors and warnings. GeckoPage has the Page interface android-engines.mjs uses (send, eval, goto,
// waitFor, close), so the same page logic (web-page.mjs) runs in both engines.
//   const bridge = new Bridge(); http.createServer((q, s) => bridge.handle(q, s) || serveTheRest(q, s))
import { sleep } from './lib.mjs';

/** the page's side (a classic script, before the page's modules) */
const CLIENT = `(() => {
  if (window.__bridgeSid) return;
  const BR = new URL(document.currentScript.src).origin + '/__bridge';
  const sid = window.__bridgeSid = Math.random().toString(36).slice(2);
  const post = (path, body) => fetch(BR + path, { method: 'POST', body: JSON.stringify(body) });
  for (const [k, type] of [['error', 'error'], ['warn', 'warning']]) {
    const o = console[k];
    console[k] = function (...a) { post('/log', { sid, type, text: a.map((x) => (x && x.stack) || String(x)).join(' ').slice(0, 400) }).catch(() => 0); return o.apply(this, a); };
  }
  addEventListener('error', (e) => post('/log', { sid, type: 'exception', text: String(e.message) + ' ' + (e.filename || '') + ':' + e.lineno }).catch(() => 0));
  addEventListener('unhandledrejection', (e) => post('/log', { sid, type: 'exception', text: String((e.reason && e.reason.stack) || e.reason).slice(0, 400) }).catch(() => 0));
  const run = async (job) => {
    let out;
    try { const v = await (0, eval)(job.expr); out = { id: job.id, value: v === undefined ? null : v }; }
    catch (e) { out = { id: job.id, error: String((e && e.stack) || e) }; }
    let s;
    try { s = JSON.stringify(out); } catch (e) { s = JSON.stringify({ id: job.id, error: 'unserialisable: ' + e }); }
    fetch(BR + '/result', { method: 'POST', body: s }).catch(() => 0);
  };
  (async () => {
    for (;;) {
      try {
        const r = await fetch(BR + '/poll?sid=' + sid + '&url=' + encodeURIComponent(location.href), { cache: 'no-store' });
        if (r.status === 200) for (const job of await r.json()) run(job);
      } catch { await new Promise((r) => setTimeout(r, 500)); }
    }
  })();
})();`;

const CORS = { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' };
const body = (req) => new Promise((r) => { let s = ''; req.on('data', (d) => { s += d; }); req.on('end', () => r(s)); });

export class Bridge {
  constructor() {
    this.init = '';            // what runs before the page's own scripts
    this.sid = null; this.url = null; this.seen = 0;   // the newest page that polled
    this.queue = new Map();    // sid → jobs waiting for its poll
    this.polls = new Map();    // sid → the poll waiting for jobs
    this.pending = new Map();  // job id → { res, rej }
    this.next = 0;
    this.log = null;           // (type, text)
  }
  /** a tag for the HTML of a Gecko engine's request, else null (Chrome and the WebView get the page as it is) */
  tagFor(req) { return /Firefox\//.test(req.headers['user-agent'] ?? '') ? '<script src="/__bridge/init.js"></script>' : null; }
  /** @return true when the request was the bridge's */
  handle(req, res) {
    const u = new URL(req.url, 'http://x');
    if (!u.pathname.startsWith('/__bridge/')) return false;
    if (req.method === 'OPTIONS') { res.writeHead(204, { ...CORS, 'Access-Control-Allow-Headers': '*' }).end(); return true; }
    const what = u.pathname.slice('/__bridge/'.length);
    if (what === 'init.js') { res.writeHead(200, { ...CORS, 'Content-Type': 'text/javascript' }).end(CLIENT + '\n' + this.init); return true; }
    if (what === 'poll') {
      const sid = u.searchParams.get('sid');
      if (sid !== this.sid) { this.sid = sid; this.seen++; }
      this.url = u.searchParams.get('url');
      const q = this.queue.get(sid);
      if (q?.length) { this.queue.delete(sid); res.writeHead(200, { ...CORS, 'Content-Type': 'application/json' }).end(JSON.stringify(q)); return true; }
      this.take(sid)?.writeHead(204, CORS).end();
      const t = setTimeout(() => this.take(sid, res)?.writeHead(204, CORS).end(), 15000);
      this.polls.set(sid, { res, t });
      res.on('close', () => this.take(sid, res));
      return true;
    }
    if (what === 'result' || what === 'log') {
      body(req).then((s) => {
        res.writeHead(204, CORS).end();
        let m; try { m = JSON.parse(s); } catch { return; }
        if (what === 'log') { this.log?.(m.type, m.text); return; }
        const p = this.pending.get(m.id); if (!p) return;
        this.pending.delete(m.id);
        if ('error' in m) p.rej(new Error(m.error)); else p.res(m.value);
      });
      return true;
    }
    res.writeHead(404, CORS).end();
    return true;
  }
  /** the poll waiting for `sid` (only if it is `res`, when given), no longer waiting */
  take(sid, res = null) {
    const p = this.polls.get(sid);
    if (!p || (res && p.res !== res)) return null;
    this.polls.delete(sid); clearTimeout(p.t);
    return p.res.writableEnded ? null : p.res;
  }
  /** evaluate an expression in the newest page */
  run(expr, timeout = 600000) {
    const sid = this.sid;
    if (!sid) return Promise.reject(new Error('no page yet'));
    const id = ++this.next;
    const job = { id, expr };
    const poll = this.take(sid);
    if (poll) poll.writeHead(200, { ...CORS, 'Content-Type': 'application/json' }).end(JSON.stringify([job]));
    else this.queue.set(sid, [...(this.queue.get(sid) ?? []), job]);
    return new Promise((res, rej) => {
      const t = setTimeout(() => { this.pending.delete(id); rej(new Error('eval timeout')); }, timeout);
      this.pending.set(id, { res: (v) => { clearTimeout(t); res(v); }, rej: (e) => { clearTimeout(t); rej(e); } });
    });
  }
  /** wait for a page (a new one, after `seen`) to poll; its URL must start with `prefix` */
  async waitPage(prefix = '', after = this.seen, timeout = 120000) {
    const t0 = Date.now();
    while (Date.now() - t0 < timeout) { if (this.seen > after && (this.url ?? '').startsWith(prefix)) return this.sid; await sleep(100); }
    throw new Error(`no page on ${prefix} came up`);
  }
}

/** the Page interface (scripts/handheld-perf/lib.mjs) over the bridge */
export class GeckoPage {
  constructor(bridge) { this.bridge = bridge; this.closed = false; this.pending = new Map(); bridge.log = (type, text) => this.log?.(type, text); }
  async send(method, params = {}) {
    if (method === 'Page.addScriptToEvaluateOnNewDocument') this.bridge.init = params.source;
    return {};   // (Runtime.enable and the like: nothing to do)
  }
  on() {}
  async eval(fn, arg, { timeout = 600000 } = {}) {
    const expr = typeof fn === 'function' ? `(${fn})(${JSON.stringify(arg ?? null)})` : fn;
    return this.bridge.run(expr, timeout);
  }
  async goto(url) {
    const seen = this.bridge.seen;
    // (a moment later, so the answer gets out before the page goes)
    await this.bridge.run(`setTimeout(() => { location.href = ${JSON.stringify(url)}; }, 300), true`, 10000);
    await this.bridge.waitPage(url.replace(/[?#].*$/, ''), seen);
    for (let i = 0; i < 200; i++) { try { if ((await this.eval('document.readyState', null, { timeout: 5000 })) !== 'loading') return; } catch { /* */ } await sleep(250); }
  }
  async waitFor(expr, timeout = 240000, every = 500) {
    const t0 = Date.now();
    while (Date.now() - t0 < timeout) { try { if (await this.eval(expr, null, { timeout: 10000 })) return; } catch { /* */ } await sleep(every); }
    throw new Error('waitFor timeout: ' + expr);
  }
  close() { this.closed = false; }
}
