import { test } from 'node:test';
import assert from 'node:assert/strict';
import { webTransport } from '../src/analytics/web.js';
import { cleanBatch } from '../src/analytics/protocol.js';
const at = Date.UTC(2026, 9, 27);
const event = { type: 'progression', category: 'World', status: 'Start', name: 'desert', privateText: 'not transmitted' };
function fixture(fetcher = async () => ({ ok: true })) {
  let time = at, serial = 0; const tasks = new Map(), values = new Map();
  const storage = { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value) };
  const options = { build: '2.32', storage, fetcher, now: () => time, id: () => (++serial).toString(16).padStart(32, '0'),
    later: (fn, ms) => { const id = ++serial; tasks.set(id, { fn, ms }); return id; }, cancel: id => tasks.delete(id) };
  return { transport: webTransport(options), options, tasks, values, advance: ms => time += ms };
}
test('client only stores identity after enabled activity, emits valid shared batches and strips arbitrary fields', async () => {
  const calls = [], f = fixture(async (url, options) => { calls.push(options); return { ok: true }; });
  f.transport.send(event); await f.transport.flush(); assert.equal(calls.length, 0); assert.equal(f.values.size, 0);
  f.transport.enable(true); f.transport.send(event); await f.transport.flush();
  const body = JSON.parse(calls[0].body); assert.ok(cleanBatch(body, at)); assert.equal(body.platform, 'web');
  assert.ok(!calls[0].body.includes('privateText')); assert.equal(calls[0].credentials, 'omit');
  f.transport.enable(false); f.transport.send(event); await f.transport.flush(); assert.equal(calls.length, 1);
});
test('ambiguous delivery retries identical IDs, then discards after three failures', async () => {
  const bodies = [], f = fixture(async (_, r) => { bodies.push(r.body); throw Error('offline'); });
  f.transport.enable(true); f.transport.send(event);
  for (let n = 0; n < 4; n++) await f.transport.flush();
  assert.equal(bodies.length, 3); assert.equal(new Set(bodies).size, 1);
});
test('opt-out aborts in-flight work and prevents a late response from resurrecting the queue', async () => {
  let resolve, signal, count = 0;
  const f = fixture((_, request) => { count++; signal = request.signal; return new Promise(r => { resolve = r; }); });
  f.transport.enable(true); f.transport.send(event); const pending = f.transport.flush();
  f.transport.enable(false); assert.equal(signal.aborted, true);
  resolve({ ok: false, status: 503 }); await pending; await f.transport.flush(); assert.equal(count, 1); assert.equal(f.tasks.size, 0);
});
test('queue is bounded, IDs survive retry and session expires after 30 minutes idle', async () => {
  const bodies = [], f = fixture(async (_, r) => { bodies.push(JSON.parse(r.body)); return { ok: true }; });
  f.transport.enable(true); for (let i = 0; i < 80; i++) f.transport.send(event);
  for (let i = 0; i < 4; i++) await f.transport.flush();
  assert.equal(bodies.reduce((n, b) => n + b.events.length, 0), 64);
  f.advance(1800001); f.transport.send(event); await f.transport.flush();
  assert.notEqual(bodies[0].session, bodies[4].session); assert.equal(bodies[0].installation, bodies[4].installation);
});
test('page/world transitions reuse installation and session, blocked storage remains playable', async () => {
  const bodies = [], f = fixture(async (_, r) => { bodies.push(JSON.parse(r.body)); return { ok: true }; });
  f.transport.enable(true); f.transport.send(event); await f.transport.flush();
  const next = webTransport(f.options); next.enable(true); next.send(event); await next.flush();
  assert.equal(bodies[0].session, bodies[1].session);
  assert.doesNotThrow(() => { const t = webTransport({ ...f.options, storage: { getItem() { throw Error(); }, setItem() { throw Error(); } } }); t.enable(true); t.send(event); t.enable(false); });
});
