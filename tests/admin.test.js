import test from 'node:test';
import assert from 'node:assert/strict';
import { handleAdmin, adminSignedIn } from '../worker/admin.js';
import { handleAnalytics } from '../worker/analytics/routes.js';
import { adminClient, adminBase, ADMIN_SESSION_KEY } from '../src/admin/session.js';
import { productionWeb } from '../src/analytics/events.js';
const site = 'https://hiraeth.my', server = 'https://hiraeth.alexandria-rnaud.workers.dev', now = 1793110000000;
const env = () => ({ HIRAETH_NOTES_PASSWORD: 'test-password', HIRAETH_ISSUES_TOKEN: 'server-only-test-key', NOTES_LOGIN_LIMITER: { limit: async () => ({ success: true }) } });
function request(method = 'POST', data = { password: 'test-password' }, origin = site, token) {
  return new Request(`${server}/api/admin/session`, { method, headers: { Origin: origin, 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(method === 'POST' ? { body: JSON.stringify(data) } : {}) });
}
async function login(environment = env()) { return (await handleAdmin(request(), environment, now)).json(); }
test('password grants a short, origin-bound admin token; tampering, expiry and changed credentials fail closed', async () => {
  const e = env(), session = await login(e);
  assert.equal(session.expires, now + 3600000);
  assert.equal(await adminSignedIn(request('GET', null, site, session.token), e, now), true);
  for (const [token, origin, time, environment] of [
    [session.token + 'a', site, now, e], [session.token, site, now + 3600000, e],
    [session.token, server, now, e], [session.token, 'https://evil.example', now, e],
    [session.token, site, now, { ...e, HIRAETH_NOTES_PASSWORD: 'changed' }],
    [session.token, site, now, { ...e, HIRAETH_ISSUES_TOKEN: 'rotated' }],
  ]) assert.equal(await adminSignedIn(request('GET', null, origin, token), environment, time), false);
});
test('login limits, payload caps and trusted origins protect the password endpoint', async () => {
  assert.equal((await handleAdmin(request('POST', { password: 'wrong' }), env(), now)).status, 401);
  assert.equal((await handleAdmin(request('POST', { password: 'x'.repeat(5000) }), env(), now)).status, 400);
  assert.equal((await handleAdmin(request(), {}, now)).status, 503);
  assert.equal((await handleAdmin(request(), { ...env(), NOTES_LOGIN_LIMITER: { limit: async () => ({ success: false }) } }, now)).status, 429);
  const denied = await handleAdmin(request('POST', {}, 'https://evil.example'), env(), now);
  assert.equal(denied.status, 403); assert.equal(denied.headers.get('Access-Control-Allow-Origin'), null);
  const preflight = await handleAdmin(request('OPTIONS'), env(), now);
  assert.equal(preflight.status, 204); assert.equal(preflight.headers.get('Access-Control-Allow-Origin'), site);
  assert.equal(preflight.headers.get('Access-Control-Allow-Credentials'), null);
});
test('Pages token unlocks aggregate reports across origins; collection and missing tokens cannot read them', async () => {
  const e = env(); let reads = 0;
  e.ANALYTICS_LIMITER = e.NOTES_LOGIN_LIMITER;
  e.ANALYTICS = { idFromName: name => name, get: () => ({ fetch: async () => { reads++; return Response.json({ totals: { events: 3 } }); } }) };
  const session = await login(e);
  const report = token => new Request(`${server}/api/analytics/report`, { headers: { Origin: site, ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
  assert.equal((await handleAnalytics(report(), e, now)).status, 401); assert.equal(reads, 0);
  const response = await handleAnalytics(report(session.token), e, now);
  assert.equal(response.status, 200); assert.equal(response.headers.get('Access-Control-Allow-Origin'), site);
  assert.equal(response.headers.get('Cache-Control'), 'no-store'); assert.equal(reads, 1);
  assert.equal((await handleAnalytics(report(session.token), e, now + 3600000)).status, 401);
});
test('browser login, reload, expiry and logout keep passwords out of storage and URLs', async () => {
  const data = new Map(), calls = [], storage = { getItem: k => data.get(k), setItem: (k,v) => data.set(k,v), removeItem: k => data.delete(k) };
  let clock = now; const environment = env();
  const fetcher = async (url, init) => { calls.push({ url, init }); return handleAdmin(new Request(url, { ...init, headers: { ...init.headers, Origin: site } }), environment, clock); };
  const options = { fetcher, storage, base: server, now: () => clock };
  const a = adminClient(options); await a.signIn('test-password');
  assert.ok(data.has(ADMIN_SESSION_KEY)); assert.ok(!data.get(ADMIN_SESSION_KEY).includes('test-password'));
  const otherPage = adminClient(options); assert.equal(await otherPage.signedIn(), true);
  otherPage.signOut(); assert.equal(await a.signedIn(), false, 'back/forward cache cannot revive a signed-out session');
  await a.signIn('test-password');
  assert.equal(calls.every(c => !c.url.includes('token') && c.init.credentials === 'omit'), true);
  clock += 3600000; assert.equal(await a.signedIn(), false); assert.equal(data.size, 0);
  clock = now; await a.signIn('test-password'); a.signOut(); assert.equal(data.size, 0); assert.equal(await a.signedIn(), false);
});
test('primary domain collects and uses the shared server; review sessions still do not collect', () => {
  assert.equal(adminBase({ hostname: 'hiraeth.my' }), server);
  assert.equal(productionWeb({ production: true, hostname: 'hiraeth.my' }), true);
  assert.equal(productionWeb({ production: true, hostname: 'hiraeth.my', search: '?worlds=1&dev=1' }), false);
});
