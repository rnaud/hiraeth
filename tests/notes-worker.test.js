import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handleIssues, COOKIE, REPOSITORY } from '../worker/issues.js';
import worker from '../worker/update-download.js';

const origin = 'https://notebook.example';
const allow = { limit: async () => ({ success: true }) };
const env = { HIRAETH_ISSUES_TOKEN: 'test-github-token', HIRAETH_NOTES_PASSWORD: 'testpw', NOTES_LOGIN_LIMITER: allow, NOTES_WRITE_LIMITER: allow };
const now = Date.UTC(2026, 9, 10);
const noFetch = () => { throw new Error('GitHub must not be called'); };
const request = (path = 'issues', { method = 'GET', body, cookie, headers = {}, ...other } = {}) => new Request(`${origin}/api/notes/${path}`, {
  method, ...(body === undefined ? {} : { body: typeof body === 'string' ? body : JSON.stringify(body) }),
  headers: { ...(method !== 'GET' ? { Origin: origin, 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}), ...headers }, ...other,
});
async function login(options = {}) {
  const response = await handleIssues(request('session', { method: 'POST', body: { password: env.HIRAETH_NOTES_PASSWORD }, ...options }), env, noFetch, now);
  assert.equal(response.status, 200);
  return response.headers.get('Set-Cookie').split(';')[0];
}
const fixture = (number, title = 'Crabs have too much health') => ({ number, title, created_at: '2026-10-10T12:00:00Z', labels: [{ name: 'combat' }], comments: 2 });

test('missing secrets fail closed while the existing static site still works', async () => {
  for (const config of [{}, { ...env, HIRAETH_NOTES_PASSWORD: '' }, { ...env, HIRAETH_ISSUES_TOKEN: '' }, { ...env, NOTES_LOGIN_LIMITER: undefined }, { ...env, NOTES_WRITE_LIMITER: undefined }]) {
    const response = await handleIssues(request(), config, noFetch, now);
    assert.equal(response.status, 503);
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
  }
  const assets = { fetch: () => new Response('game') };
  assert.equal(await (await worker.fetch(new Request(`${origin}/`), { ASSETS: assets })).text(), 'game');
  assert.equal((await worker.fetch(request(), { ASSETS: assets })).status, 503);
});

test('password login produces a secure HttpOnly host cookie, and logout clears it', async () => {
  const response = await handleIssues(request('session', { method: 'POST', body: { password: env.HIRAETH_NOTES_PASSWORD } }), env, noFetch, now);
  const set = response.headers.get('Set-Cookie');
  for (const s of [COOKIE, 'HttpOnly', 'Secure', 'SameSite=Strict', 'Path=/', 'Max-Age=34560000']) assert.ok(set.includes(s), s);
  assert.deepEqual(await response.json(), { authenticated: true });
  const session = await handleIssues(request('session', { cookie: set.split(';')[0] }), env, noFetch, now);
  assert.deepEqual(await session.json(), { authenticated: true });
  const logout = await handleIssues(request('session', { method: 'DELETE' }), env, noFetch, now);
  assert.match(logout.headers.get('Set-Cookie'), /Max-Age=0/);
  assert.equal((await handleIssues(request('session', { method: 'POST', body: { password: 'wrong' } }), env, noFetch, now)).status, 401);
});

test('unauthenticated, forged, expired, other-origin and password-rotated cookies cannot read or create issues', async () => {
  const valid = await login();
  const [name, value] = valid.split('=');
  const forged = `${name}=${value.slice(0, -1)}${value.endsWith('0') ? '1' : '0'}`;
  for (const c of [undefined, forged, `${name}=0.abc`]) {
    for (const method of ['GET', 'POST']) assert.equal((await handleIssues(request('issues', { cookie: c, method, ...(method === 'POST' ? { body: { title: 'note' } } : {}) }), env, noFetch, now)).status, 401);
  }
  assert.equal((await handleIssues(request('issues', { cookie: valid }), env, noFetch, now + 401 * 86400000)).status, 401);
  assert.equal((await handleIssues(request('issues', { cookie: valid }), { ...env, HIRAETH_NOTES_PASSWORD: `${env.HIRAETH_NOTES_PASSWORD}-rotated` }, noFetch, now)).status, 401);
  assert.equal((await handleIssues(request('issues', { cookie: valid }), { ...env, HIRAETH_ISSUES_TOKEN: 'rotated-token' }, noFetch, now)).status, 401);
  const differentOrigin = new Request('https://other.example/api/notes/issues', { headers: { Cookie: valid } });
  assert.equal((await handleIssues(differentOrigin, env, noFetch, now)).status, 401);
});

test('every write rejects foreign or missing Origin and rejects non-JSON bodies', async () => {
  const c = await login();
  for (const [path, method] of [['session', 'POST'], ['session', 'DELETE'], ['issues', 'POST']]) {
    for (const value of ['https://evil.example', 'null', '']) {
      assert.equal((await handleIssues(request(path, { method, cookie: c, headers: { Origin: value }, ...(method === 'POST' ? { body: { title: 'foo' } } : {}) }), env, noFetch, now)).status, 403);
    }
  }
  assert.equal((await handleIssues(request('issues', { method: 'POST', cookie: c, body: 'title=test', headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }), env, noFetch, now)).status, 400);
  assert.equal((await handleIssues(request('issues', { method: 'POST', cookie: c, body: '{bad' }), env, noFetch, now)).status, 400);
});

test('short passwords cannot forge sessions without the server token', async () => {
  const expiry = Math.floor(now / 1000) + 3600;
  const encode = (s) => new TextEncoder().encode(s);
  const key = await crypto.subtle.importKey('raw', encode(env.HIRAETH_NOTES_PASSWORD), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  for (const version of ['v1', 'v2']) {
    const signature = await crypto.subtle.sign('HMAC', key, encode(`hiraeth-notes:${version}:${origin}:${expiry}`));
    const hex = Buffer.from(signature).toString('hex');
    assert.equal((await handleIssues(request('issues', { cookie: `${COOKIE}=${expiry}.${hex}` }), env, noFetch, now)).status, 401);
  }
});

test('rate limits cover correct and wrong logins and authenticated writes, and fail closed', async () => {
  let calls = 0;
  const limiter = { limit: async ({ key }) => { assert.equal(key, 'notebook'); calls++; return { success: false }; } };
  for (const password of [env.HIRAETH_NOTES_PASSWORD, 'wrong']) {
    const response = await handleIssues(request('session', { method: 'POST', body: { password } }), { ...env, NOTES_LOGIN_LIMITER: limiter }, noFetch, now);
    assert.equal(response.status, 429);
    assert.equal(response.headers.get('Retry-After'), '60');
    assert.equal(response.headers.get('Set-Cookie'), null);
  }
  const c = await login();
  const limitedEnv = { ...env, NOTES_WRITE_LIMITER: limiter };
  assert.equal((await handleIssues(request('issues', { method: 'POST', cookie: c, body: { title: 'note' } }), limitedEnv, noFetch, now)).status, 429);
  assert.equal(calls, 3);
  const broken = { limit: async () => { throw new Error('binding unavailable'); } };
  assert.equal((await handleIssues(request('session', { method: 'POST', body: { password: env.HIRAETH_NOTES_PASSWORD } }), { ...env, NOTES_LOGIN_LIMITER: broken }, noFetch, now)).status, 503);
  assert.equal((await handleIssues(request('issues', { method: 'POST', cookie: c, body: { title: 'note' } }), { ...env, NOTES_WRITE_LIMITER: broken }, noFetch, now)).status, 503);
});

test('listing is fixed to Hiraeth, excludes PRs, and preserves pagination without returning secrets', async () => {
  const c = await login();
  const response = await handleIssues(request('issues?page=2&repo=evil/repo', { cookie: c }), env, async (url, options) => {
    assert.equal(url, `https://api.github.com/repos/${REPOSITORY}/issues?state=open&sort=created&direction=desc&per_page=50&page=2`);
    assert.equal(options.headers.Authorization, `Bearer ${env.HIRAETH_ISSUES_TOKEN}`);
    assert.equal(options.redirect, 'manual');
    return Response.json([fixture(5), { ...fixture(6), pull_request: {} }], { headers: { Link: '<https://api.github.com/repos/rnaud/hiraeth/issues?page=3>; rel="next"' } });
  }, now);
  const data = await response.json();
  assert.equal(data.nextPage, 3);
  assert.deepEqual(data.issues.map((i) => i.number), [5]);
  assert.deepEqual(data.issues[0].labels, ['combat']);
  assert.doesNotMatch(JSON.stringify(data), /test-github-token|test-only-notebook/);
  for (const page of ['0', '-1', 'abc', '1.5', '10000']) assert.equal((await handleIssues(request(`issues?page=${page}`, { cookie: c }), env, noFetch, now)).status, 400);
});

test('one line creates exactly one issue; the client cannot choose repository, labels or assignees', async () => {
  let calls = 0;
  const title = '<img src=x onerror=alert(1)> is a literal note';
  const response = await handleIssues(request('issues', { method: 'POST', cookie: await login(), body: { title: `  ${title}  `, repo: 'evil/repo', labels: ['urgent'], assignees: ['other'] } }), env, async (url, options) => {
    calls++;
    assert.equal(url, `https://api.github.com/repos/${REPOSITORY}/issues`);
    assert.equal(options.method, 'POST');
    assert.deepEqual(JSON.parse(options.body), { title, body: 'Added from the Hiraeth notebook.' });
    return Response.json(fixture(7, title), { status: 201 });
  }, now);
  assert.equal(calls, 1); assert.equal(response.status, 201);
  assert.equal((await response.json()).issue.title, title);
});

test('invalid or oversized titles and streamed request bodies are rejected before GitHub', async () => {
  const c = await login();
  for (const title of ['', '   ', 'two\nlines', 'a\rb', 'a\u0000b', 'x'.repeat(257), 123, null]) {
    assert.equal((await handleIssues(request('issues', { method: 'POST', cookie: c, body: { title } }), env, noFetch, now)).status, 400);
  }
  // A chunked body, without Content-Length, must still be bounded.
  const streamed = new Request(`${origin}/api/notes/issues`, { method: 'POST', duplex: 'half', headers: { Origin: origin, Cookie: c, 'Content-Type': 'application/json' }, body: new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(4097)); controller.close(); } }) });
  assert.equal((await handleIssues(streamed, env, noFetch, now)).status, 413);
});

test('upstream errors are safe and uncertain writes are never retried', async () => {
  const c = await login();
  for (const [status, expected] of [[302, 502], [401, 503], [403, 503], [404, 503], [422, 422], [429, 429], [500, 502]]) {
    const response = await handleIssues(request('issues', { cookie: c }), env, async () => new Response('secret upstream detail', { status }), now);
    assert.equal(response.status, expected);
    assert.doesNotMatch(await response.text(), /secret upstream/);
  }
  let calls = 0;
  const response = await handleIssues(request('issues', { method: 'POST', cookie: c, body: { title: 'test' } }), env, async () => { calls++; throw new Error('token detail'); }, now);
  assert.equal(response.status, 502); assert.equal(calls, 1);
  assert.match((await response.json()).error, /Refresh the list before trying again/);
  assert.equal((await handleIssues(request('unknown'), env, noFetch, now)).status, 404);
  assert.equal((await handleIssues(request('issues', { method: 'PUT' }), env, noFetch, now)).status, 405);
});


test('remembered devices renew on visits, including existing 30-day cookies', async () => {
  const c = await login();
  const later = now + 300 * 86400000;
  const response = await handleIssues(request('session', { cookie: c }), env, noFetch, later);
  assert.equal((await response.json()).authenticated, true);
  const renewed = response.headers.get('Set-Cookie').split(';')[0];
  assert.notEqual(renewed, c);
  assert.equal((await (await handleIssues(request('session', { cookie: renewed }), env, noFetch, now + 500 * 86400000)).json()).authenticated, true);
  // Issue an authentic old-format 30-day cookie: the signing format is unchanged.
  const bytes = (s) => new TextEncoder().encode(s);
  const importKey = (raw) => crypto.subtle.importKey('raw', raw, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const material = await crypto.subtle.sign('HMAC', await importKey(bytes(env.HIRAETH_ISSUES_TOKEN)), bytes(`hiraeth-notes:session-key:v2:${env.HIRAETH_NOTES_PASSWORD}`));
  const expiry = Math.floor(now / 1000) + 30 * 86400;
  const signature = await crypto.subtle.sign('HMAC', await importKey(material), bytes(`hiraeth-notes:v2:${origin}:${expiry}`));
  const old = `${COOKIE}=${expiry}.${Buffer.from(signature).toString('hex')}`;
  const upgraded = await handleIssues(request('session', { cookie: old }), env, noFetch, now);
  assert.equal((await upgraded.json()).authenticated, true);
  assert.match(upgraded.headers.get('Set-Cookie'), /Max-Age=34560000/);
  const guest = await handleIssues(request('session'), env, noFetch, now);
  assert.equal(guest.headers.get('Set-Cookie'), null);
});
