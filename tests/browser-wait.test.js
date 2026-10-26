import test from 'node:test';
import assert from 'node:assert/strict';
import { waitUntil, cdpRequests } from '../scripts/browser-wait.mjs';

test('slow browser reads count toward the real wait deadline', async () => {
  let time = 0, reads = 0;
  await assert.rejects(waitUntil({ label: 'arrival', timeoutMs: 1000,
    now: () => time, pause: ms => { time += ms; },
    read: () => { reads++; time += 600; return false; } }), /timed out waiting for arrival/);
  assert.equal(reads, 2, 'read cost does not turn four polls per second into an unbounded loop');
  assert.equal(time, 1450, 'only the final in-flight read may finish beyond the deadline');
});

test('navigation context replacement retries but success still needs an observed condition', async () => {
  let time = 0, reads = 0;
  assert.equal(await waitUntil({ label: 'world', timeoutMs: 1000,
    now: () => time, pause: ms => { time += ms; },
    read: () => { if (++reads === 1) throw Error('context gone'); return reads === 3; } }), true);
  assert.equal(reads, 3);
  assert.equal(time, 500);
});

function connection() {
  const handlers = new Map(), timers = new Map(), sent = [];
  let serial = 0;
  const socket = { addEventListener(name, fn) { handlers.set(name, fn); }, send(message) { sent.push(JSON.parse(message)); } };
  const client = cdpRequests(socket, { timer(fn) { timers.set(++serial, fn); return serial; }, cancel(id) { timers.delete(id); } });
  return { client, timers, sent, fire: (name, data) => handlers.get(name)?.({ data: JSON.stringify(data) }) };
}

test('CDP responses clear their deadline and preserve protocol failures', async () => {
  const c = connection(), ok = c.client.send('Runtime.evaluate', { expression: 'true' });
  c.fire('message', { id: c.sent[0].id, result: { value: true } });
  assert.deepEqual(await ok, { value: true });
  assert.equal(c.timers.size, 0);
  const bad = c.client.send('Page.navigate');
  c.fire('message', { id: c.sent[1].id, error: { message: 'page failed' } });
  await assert.rejects(bad, /page failed/);
  assert.equal(c.timers.size, 0);
});

test('a stalled or closed browser rejects outstanding CDP calls instead of hanging evidence capture', async () => {
  const c = connection(), stalled = c.client.send('Page.captureScreenshot');
  [...c.timers.values()][0]();
  await assert.rejects(stalled, /Browser request timed out: Page.captureScreenshot/);
  assert.equal(c.timers.size, 0);
  const pending = c.client.send('Runtime.evaluate');
  c.fire('close');
  await assert.rejects(pending, /Browser connection closed/);
  await assert.rejects(c.client.send('Page.navigate'), /Browser connection closed/);
  assert.equal(c.timers.size, 0);
});
