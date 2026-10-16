// A screenshot as a Notes draft from the dev menu (src/issue-draft.js, issue #8): kept on the device, the device
// paired with a code the Notes page approves, then sent; the notebook here is the real Worker (worker/issues.js) over a
// store in memory, and GitHub is never called.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ShotDrafts, shotContext, draftText, DEVICE_KEY, QUEUE_KEY, NOTES_HOST, SHOT } from '../src/issue-draft.js';
import { devTabs } from '../src/world-debug.js';
import { handleIssues } from '../worker/issues.js';
import { memoryStore } from '../worker/drafts.js';

const allow = { limit: async () => ({ success: true }) };
const env = { HIRAETH_ISSUES_TOKEN: 'test-github-token', HIRAETH_NOTES_PASSWORD: 'testpw', NOTES_LOGIN_LIMITER: allow, NOTES_WRITE_LIMITER: allow };
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 16, 74, 70, 73, 70, 0, 0xff, 0xd9]).toString('base64');
const storage = () => { const m = new Map(); return { m, getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }; };
/** The notebook: the Worker over a memory store, reached as the game reaches it (fetch to NOTES_HOST). */
function notebook() {
  const store = memoryStore(), calls = [];
  const fetch = async (url, o = {}) => {
    calls.push(`${o.method ?? 'GET'} ${new URL(url).pathname}`);
    assert.ok(url.startsWith(NOTES_HOST), url);
    assert.equal(o.credentials, 'omit', 'no cookie leaves the game');
    return handleIssues(new Request(url, o), env, () => { throw new Error('GitHub must not be called'); }, Date.now(), store);
  };
  return { store, calls, fetch };
}
async function approve(store, code) {
  const s = await handleIssues(new Request(`${NOTES_HOST}/api/notes/session`, { method: 'POST', body: JSON.stringify({ password: 'testpw' }), headers: { Origin: NOTES_HOST, 'Content-Type': 'application/json' } }), env, null, Date.now());
  const cookie = s.headers.get('Set-Cookie').split(';')[0];
  const r = await handleIssues(new Request(`${NOTES_HOST}/api/notes/pair/approve`, { method: 'POST', body: JSON.stringify({ code }), headers: { Origin: NOTES_HOST, Cookie: cookie, 'Content-Type': 'application/json' } }), env, null, Date.now(), store);
  assert.equal(r.status, 200);
}

test('the first screenshot pairs the device: it waits on the device, the Notes page approves the code, and it is sent', async () => {
  const nb = notebook(), toasts = [], timers = [];
  const local = storage();
  const d = new ShotDrafts({ fetch: nb.fetch, storage: local, toast: (t) => toasts.push(t), setTimeout: (f) => timers.push(f) });
  const context = shotContext({ levelId: 'desert', world: 'The desert', pos: { x: 1.234, y: 2, z: -3.06 }, heading: 1.57, version: '1.46', build: 2101, preset: 'Handheld', device: 'handheld', hour: 9.5, slot: 1, at: new Date(Date.UTC(2026, 9, 11)) });
  assert.deepEqual(context, { level: 'desert', world: 'The desert', x: 1.2, y: 2, z: -3.1, heading: 1.6, version: '1.46', build: 2101, preset: 'Handheld', device: 'handheld', hour: 9.5, slot: '1', at: '2026-10-11T00:00:00.000Z' });
  assert.equal(await d.save({ shot: JPEG, context }), 'pairing');
  assert.equal(d.queue().length, 1, 'kept on the device');
  const code = d.status().code;
  assert.match(code, /^[A-Z2-9]{6}$/);
  assert.ok(toasts.some((t) => t.includes(code) && /Notes page/.test(t)), 'the code is said');
  // not approved yet: still waiting
  await timers.shift()();
  assert.equal(d.status().paired, false);
  // the author enters it on the Notes page; the next poll collects the token and sends the draft
  await approve(nb.store, code);
  await timers.shift()();
  for (let i = 0; i < 20 && d.queue().length; i++) await new Promise((r) => setImmediate(r));
  assert.equal(d.status().paired, true);
  assert.ok(JSON.parse(local.getItem(DEVICE_KEY)).token);
  assert.equal(d.queue().length, 0, 'sent: nothing waits on the device');
  assert.ok(toasts.some((t) => /saved as a draft in your Notes/.test(t)));
  const drafts = [...nb.store.map.entries()].filter(([k]) => k.startsWith('draft:')).map(([, v]) => v);
  assert.equal(drafts.length, 1);
  assert.equal(drafts[0].text, draftText(context));
  assert.equal(drafts[0].context.level, 'desert');
  assert.ok(drafts[0].shot, 'with its picture');
  assert.ok(!nb.calls.some((c) => /issues/.test(c)), 'no issue filed from the game');
  // paired: the next one goes straight up
  assert.equal(await d.save({ shot: JPEG, context }), 'sent');
});

test('offline, the screenshot waits on the device; a revoked token pairs again; the queue keeps a few', async () => {
  const toasts = [];
  const local = storage();
  local.setItem(DEVICE_KEY, JSON.stringify({ token: 'not-a-real-token' }));
  const off = new ShotDrafts({ fetch: async () => { throw new TypeError('offline'); }, storage: local, toast: (t) => toasts.push(t), setTimeout: () => {} });
  assert.equal(await off.save({ shot: JPEG, context: { level: 'incal' } }), 'queued');
  assert.ok(toasts.some((t) => /when the connection is back/.test(t)));
  for (let i = 0; i < SHOT.queue + 2; i++) await off.save({ shot: JPEG, context: { level: 'incal' } });
  assert.equal(off.queue().length, SHOT.queue, 'a few at most: the oldest go');
  // back online, the old token refused: it pairs again, the drafts still waiting
  const nb = notebook();
  const on = new ShotDrafts({ fetch: nb.fetch, storage: local, toast: (t) => toasts.push(t), setTimeout: () => {} });
  assert.equal(await on.flush(), 'pairing');
  assert.equal(local.getItem(DEVICE_KEY), null, 'the refused token forgotten');
  assert.equal(on.queue().length, SHOT.queue);
  assert.ok(on.status().code);
});

test('the dev menu has the screenshot action, and says the pairing code while it waits', () => {
  assert.ok(!devTabs({}).some((t) => t.id === 'notes'), 'nothing without the notes');
  const notes = devTabs({ notes: { paired: false, code: 'ABC234', queued: 2 } }).find((t) => t.id === 'notes');
  assert.ok(notes, 'a Notes tab');
  const labels = notes.rows.map((r) => r.label);
  assert.ok(labels.includes('📷 Screenshot to a Notes draft'));
  assert.ok(labels.includes('Pairing code: ABC234'));
  assert.ok(labels.includes('↑ Send 2 waiting screenshots'));
  assert.ok(notes.rows.some((r) => r.act.do === 'shot' && !r.act.pairOnly) && notes.rows.some((r) => r.act.do === 'flush'));
  // (an engine without the page's screenshot has none)
  assert.ok(!devTabs({ notes: { paired: true }, caps: new Set(['quest']) }).some((t) => t.id === 'notes'));
});
