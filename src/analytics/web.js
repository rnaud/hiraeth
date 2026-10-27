import { ANALYTICS_ENDPOINT, cleanEvent, randomId, validId, validBuild } from './protocol.js';

// Bounded best-effort queue. Stable retry IDs prevent duplicate counts after a lost response.
// Only identity/session metadata is persisted; no offline event history.
export function webTransport({ build, endpoint = ANALYTICS_ENDPOINT, fetcher = (...a) => fetch(...a),
  storage, now = Date.now, id = randomId, later = setTimeout, cancel = clearTimeout } = {}) {
  if (!validBuild(build)) return null;
  if (!storage) { try { storage = globalThis.localStorage; } catch { /* private mode */ } }
  let enabled = false, closed = false, queue = [], timer, request, generation = 0, failures = 0, identity, session, last = 0;
  const read = key => { try { return storage?.getItem(key); } catch { return null; } };
  const write = (key, value) => { try { storage?.setItem(key, String(value)); } catch { /* memory only */ } };
  function context() {
    identity ||= read('hiraeth.analytics.id');
    if (!validId(identity)) { identity = id(); write('hiraeth.analytics.id', identity); }
    if (!session) { session = read('hiraeth.analytics.session'); last = Number(read('hiraeth.analytics.last')); }
    if (!validId(session) || now() - last > 1800000 || now() < last) { session = id(); write('hiraeth.analytics.session', session); }
    last = now(); write('hiraeth.analytics.last', last);
    return { v: 1, installation: identity, session, platform: 'web', build };
  }
  function schedule(ms = 1500) { if (enabled && !closed && !timer && !request && queue.length) timer = later(() => { timer = null; void flush(); }, ms); }
  async function flush() {
    if (!enabled || request || !queue.length) return;
    const revision = generation, first = queue[0];
    let count = 0;
    while (count < queue.length && count < 20 && queue[count].context.session === first.context.session) count++;
    const batch = queue.slice(0, count), abort = new AbortController();
    request = abort;
    const timeout = later(() => abort.abort(), 8000);
    try {
      const response = await fetcher(endpoint, { method: 'POST', credentials: 'omit', referrerPolicy: 'no-referrer',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...first.context, events: batch.map(x => x.event) }),
        signal: abort.signal, keepalive: true });
      if (revision !== generation) return;
      if (response.ok || (response.status >= 400 && response.status < 500 && response.status !== 429)) { queue.splice(0, batch.length); failures = 0; }
      else failures++;
    } catch { if (revision === generation) failures++; }
    finally {
      cancel(timeout);
      if (revision === generation) {
        request = null;
        if (failures >= 3) { queue.splice(0, batch.length); failures = 0; }
        schedule(failures ? 5000 * 2 ** failures : 1500);
      }
    }
  }
  return {
    enable(on) {
      enabled = on === true; closed = false;
      if (!enabled) { ++generation; cancel(timer); timer = null; request?.abort(); request = null; queue = []; failures = 0; }
    },
    send(e) {
      const event = cleanEvent(e);
      if (!enabled || closed || !event || queue.length >= 64) return;
      queue.push({ context: context(), event: { ...event, id: id(), at: now() } }); schedule();
    },
    flush,
    close() { closed = true; cancel(timer); timer = null; void flush(); },
  };
}
