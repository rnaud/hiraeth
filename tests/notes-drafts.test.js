// The notebook's screenshot drafts (worker/drafts.js, issue #8): a device paired once with a code, its drafts kept apart
// from the issues, listed and sent from the signed-in Notes page. A fake GitHub and a store in memory: no real issue.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handleIssues } from '../worker/issues.js';
import { memoryStore, NotesDrafts, DRAFT_LIMITS, draftIssue, cleanContext } from '../worker/drafts.js';

const origin = 'https://notebook.example';
const allow = { limit: async () => ({ success: true }) };
const env = { HIRAETH_ISSUES_TOKEN: 'test-github-token', HIRAETH_NOTES_PASSWORD: 'testpw', NOTES_LOGIN_LIMITER: allow, NOTES_WRITE_LIMITER: allow };
const now = Date.UTC(2026, 9, 11);
const noFetch = () => { throw new Error('GitHub must not be called'); };
/** A tiny JPEG's bytes (its magic and a little more), as base64. */
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 16, 74, 70, 73, 70, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0, 0xff, 0xd9]).toString('base64');
const call = (store, path, { method = 'GET', body, cookie, token, origin: from = origin, fetcher = noFetch, at = now } = {}) => handleIssues(new Request(`${origin}/api/notes/${path}`, {
  method, ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  headers: { ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(from && method !== 'GET' ? { Origin: from } : {}), ...(cookie ? { Cookie: cookie } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
}), env, fetcher, at, store);
async function login() {
  const r = await handleIssues(new Request(`${origin}/api/notes/session`, { method: 'POST', body: JSON.stringify({ password: env.HIRAETH_NOTES_PASSWORD }), headers: { Origin: origin, 'Content-Type': 'application/json' } }), env, noFetch, now);
  return r.headers.get('Set-Cookie').split(';')[0];
}
/** Pair a device: its code, approved on the notebook, its token collected. */
async function pair(store, cookie) {
  const asked = await call(store, 'pair', { method: 'POST', body: {}, origin: 'https://localhost' });
  assert.equal(asked.status, 201);
  assert.equal(asked.headers.get('Access-Control-Allow-Origin'), '*', 'a device on another origin may read it');
  const { code, secret } = await asked.json();
  assert.match(code, /^[A-Z2-9]{6}$/);
  assert.deepEqual(await (await call(store, `pair?code=${code}&secret=${secret}`)).json(), { status: 'waiting' });
  assert.equal((await call(store, 'pair/approve', { method: 'POST', body: { code: code.toLowerCase() }, cookie })).status, 200);
  const { token } = await (await call(store, `pair?code=${code}&secret=${secret}`)).json();
  assert.ok(token);
  assert.equal((await call(store, `pair?code=${code}&secret=${secret}`)).status, 404, 'collected once');
  return token;
}

test('drafts fail closed without the store or the secrets, and the preflight answers the game', async () => {
  assert.equal((await call(null, 'drafts', { method: 'POST', body: {} })).status, 503);
  const off = await handleIssues(new Request(`${origin}/api/notes/pair`, { method: 'POST' }), {}, noFetch, now, memoryStore());
  assert.equal(off.status, 503);
  const pre = await call(memoryStore(), 'pair', { method: 'OPTIONS' });
  assert.equal(pre.status, 204);
  assert.match(pre.headers.get('Access-Control-Allow-Headers'), /Authorization/);
});

test('pairing: only the notebook approves a code, and only the device that asked collects its token', async () => {
  const store = memoryStore(), cookie = await login();
  const { code, secret } = await (await call(store, 'pair', { method: 'POST', body: {} })).json();
  // not signed in, or from another origin: no approval
  assert.equal((await call(store, 'pair/approve', { method: 'POST', body: { code } })).status, 401);
  assert.equal((await call(store, 'pair/approve', { method: 'POST', body: { code }, cookie, origin: 'https://evil.example' })).status, 403);
  await call(store, 'pair/approve', { method: 'POST', body: { code }, cookie });
  // the wrong secret, or too late
  assert.equal((await call(store, `pair?code=${code}&secret=${'0'.repeat(32)}`)).status, 404);
  assert.equal((await call(store, `pair?code=${code}&secret=${secret}`, { at: now + 11 * 60000 })).status, 404, 'a code lasts ten minutes');
  assert.equal((await call(store, 'pair/approve', { method: 'POST', body: { code: 'ZZZZZZ' }, cookie })).status, 404);
});

test('a paired device saves a draft with its screenshot and state; the notebook lists it apart from the issues and sends it', async () => {
  const store = memoryStore(), cookie = await login();
  const token = await pair(store, cookie);
  // without the token (or with a forged one) nothing is saved
  assert.equal((await call(store, 'drafts', { method: 'POST', body: { shot: JPEG } })).status, 401);
  assert.equal((await call(store, 'drafts', { method: 'POST', body: { shot: JPEG }, token: `${token.slice(0, -1)}0` })).status, 401);
  const saved = await call(store, 'drafts', { method: 'POST', token, origin: 'https://localhost', body: { text: 'Screenshot · the desert', shot: JPEG, context: { level: 'desert', x: 12.345, build: 2100, preset: 'Handheld', '<b>': 'no', note: 'a\u0000b' } } });
  assert.equal(saved.status, 201);
  assert.equal(saved.headers.get('Access-Control-Allow-Origin'), '*');
  const { draft: { id } } = await saved.json();
  // the device can't read the drafts back: that is the notebook's
  assert.equal((await call(store, 'drafts', { token })).status, 401);
  const { drafts } = await (await call(store, 'drafts', { cookie })).json();
  assert.equal(drafts.length, 1);
  assert.deepEqual(drafts[0].context, { level: 'desert', x: 12.35, build: 2100, preset: 'Handheld' }, 'only plain short values');
  assert.match(drafts[0].shot, /^https:\/\/notebook\.example\/api\/notes\/shots\/[a-f0-9]{32}\.jpg$/);
  // the shot is served as a JPEG by its unguessable id
  const img = await call(store, drafts[0].shot.slice(`${origin}/api/notes/`.length));
  assert.equal(img.headers.get('Content-Type'), 'image/jpeg');
  assert.equal(Buffer.from(await img.arrayBuffer()).toString('base64'), JPEG);
  // sent: a GitHub issue with the text, the picture and the state; the draft is gone, the picture stays
  let sent = null;
  const fake = async (url, o) => { sent = { url, ...JSON.parse(o.body) }; return Response.json({ number: 120, title: sent.title, created_at: '2026-10-11T00:00:00Z', labels: [], comments: 0 }, { status: 201 }); };
  const r = await call(store, `drafts/${id}/publish`, { method: 'POST', cookie, body: { text: 'The rib clips the wall\nSee the shot.' }, fetcher: fake });
  assert.equal(r.status, 201);
  assert.equal((await r.json()).issue.number, 120);
  assert.equal(sent.title, 'The rib clips the wall');
  assert.match(sent.body, /!\[Screenshot\]\(https:\/\/notebook\.example\/api\/notes\/shots\/[a-f0-9]{32}\.jpg\)/);
  assert.match(sent.body, /level: `desert`/);
  assert.deepEqual((await (await call(store, 'drafts', { cookie })).json()).drafts, []);
  assert.equal((await call(store, drafts[0].shot.slice(`${origin}/api/notes/`.length))).status, 200, 'the issue still shows it');
});

test('a draft can be deleted, with its picture; limits hold', async () => {
  const store = memoryStore(), cookie = await login();
  const token = await pair(store, cookie);
  const { draft: { id } } = await (await call(store, 'drafts', { method: 'POST', token, body: { shot: JPEG } })).json();
  assert.equal((await call(store, `drafts/${id}`, { method: 'DELETE', cookie })).status, 200);
  assert.equal([...store.map.keys()].filter((k) => k.startsWith('shot:')).length, 0, 'its picture went with it');
  // not a JPEG, too big, or too much text
  assert.equal((await call(store, 'drafts', { method: 'POST', token, body: { shot: Buffer.from('<svg/>').toString('base64') } })).status, 400);
  const big = Buffer.alloc(DRAFT_LIMITS.shot + 10, 1); big[0] = 0xff; big[1] = 0xd8; big[2] = 0xff;
  assert.ok([400, 413].includes((await call(store, 'drafts', { method: 'POST', token, body: { shot: big.toString('base64') } })).status));
  assert.equal((await call(store, 'drafts', { method: 'POST', token, body: { text: 'x'.repeat(4001) } })).status, 400);
  // publishing needs words
  const { draft } = await (await call(store, 'drafts', { method: 'POST', token, body: { shot: JPEG } })).json();
  assert.equal((await call(store, `drafts/${draft.id}/publish`, { method: 'POST', cookie, body: { text: '  ' } })).status, 400);
  // fifty at most
  for (let i = 0; i < DRAFT_LIMITS.drafts - 1; i++) await call(store, 'drafts', { method: 'POST', token, body: {} });
  assert.equal((await call(store, 'drafts', { method: 'POST', token, body: {} })).status, 507);
});

test('the Durable Object keeps keys and values; the issue text and the state are plain', async () => {
  const map = new Map();
  const state = { storage: { get: async (k) => map.get(k), put: async (k, v) => { map.set(k, v); }, delete: async (k) => map.delete(k), list: async ({ prefix }) => new Map([...map].filter(([k]) => k.startsWith(prefix))) } };
  const o = new NotesDrafts(state);
  const op = async (body) => (await (await o.fetch(new Request('https://x/op', { method: 'POST', body: JSON.stringify(body) }))).json()).value;
  await op({ op: 'put', key: 'draft:a', value: { id: 'a' } });
  assert.deepEqual(await op({ op: 'get', key: 'draft:a' }), { id: 'a' });
  assert.deepEqual(await op({ op: 'list', prefix: 'draft:' }), [{ key: 'draft:a', value: { id: 'a' } }]);
  assert.equal(await op({ op: 'delete', key: 'draft:a' }), true);
  assert.equal(await op({ op: 'get', key: 'draft:a' }), null);
  assert.deepEqual(cleanContext({ level: 'x', deep: { a: 1 }, list: [1] }), { level: 'x' });
  const issue = draftIssue({ shot: 'f'.repeat(32), context: { level: 'desert`' } }, 'Title\nmore', origin);
  assert.equal(issue.title, 'Title');
  assert.match(issue.body, /level: `desert'`/);
});
