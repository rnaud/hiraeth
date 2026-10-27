import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handleAnalytics } from '../worker/analytics/routes.js';
import { handleIssues } from '../worker/issues.js';
import { cleanBatch } from '../src/analytics/protocol.js';
const origin = 'https://hiraeth.alexandria-rnaud.workers.dev', now = Date.now();
const payload = { v: 1, installation: '1'.repeat(32), session: '2'.repeat(32), platform: 'linux', build: '2000', events: [{ id: '3'.repeat(32), at: now, type: 'progression', category: 'World', name: 'desert', status: 'Start' }] };
const allow = { limit: async () => ({ success: true }) };
function environment() {
  const calls = [];
  return { calls, env: { ANALYTICS_LIMITER: allow, NOTES_LOGIN_LIMITER: allow, NOTES_WRITE_LIMITER: allow, HIRAETH_NOTES_PASSWORD: 'test-only', HIRAETH_ISSUES_TOKEN: 'test-key',
    ANALYTICS: { idFromName: name => name, get: name => ({ fetch: async (_, init) => { calls.push({ name, ...JSON.parse(init.body) }); return Response.json({ accepted: 1 }); } }) } } };
}
function request(path = 'events', body = payload, extra = {}) {
  return new Request(`${origin}/api/analytics/${path}`, { method: path === 'events' ? 'POST' : 'GET',
    ...(path === 'events' ? { body: JSON.stringify(body) } : {}), headers: { 'Content-Type': 'application/json', ...extra } });
}
test('all three platforms route to exactly one dataset; incoming private fields are discarded', async () => {
  const { env, calls } = environment();
  for (const platform of ['web', 'android', 'linux']) {
    const response = await handleAnalytics(request('events', { ...payload, platform, email: 'private', events: payload.events.map(e => ({ ...e, private: 'discard' })) }), env, now);
    assert.equal(response.status, 200);
  }
  assert.equal(new Set(calls.map(c => c.name)).size, 1); assert.ok(!JSON.stringify(calls).includes('private'));
});
test('public event input fails closed on origin, size, schema, configuration and rate limits', async () => {
  const { env } = environment();
  assert.equal((await handleAnalytics(request('events', payload, { Origin: 'https://evil.example' }), env)).status, 403);
  assert.equal((await handleAnalytics(request('events', { ...payload, installation: 'invalid' }), env)).status, 400);
  assert.equal((await handleAnalytics(request('events', { junk: 'x'.repeat(17000) }), env)).status, 413);
  assert.equal((await handleAnalytics(request(), {})).status, 503);
  assert.equal((await handleAnalytics(request(), { ...env, ANALYTICS_LIMITER: { limit: async () => ({ success: false }) } })).status, 429);
  assert.equal(cleanBatch({ ...payload, events: [{ ...payload.events[0], at: now + 600000 }] }, now), null);
  assert.equal(cleanBatch({ ...payload, events: Array(21).fill(payload.events[0]) }, now), null);
});
test('reports require the real private notebook cookie; collection never grants report access', async () => {
  const { env, calls } = environment();
  assert.equal((await handleAnalytics(request('report'), env)).status, 401); assert.equal(calls.length, 0);
  const login = await handleIssues(new Request(`${origin}/api/notes/session`, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify({ password: 'test-only' }) }), env);
  const cookie = login.headers.get('Set-Cookie').split(';')[0];
  assert.equal((await handleAnalytics(request('report?platform=linux&days=30', null, { Cookie: cookie }), env)).status, 200);
  assert.deepEqual(calls[0].data, { days: 30, platform: 'linux', build: '', playerPage: 0, playerSort: 'recent' });
  for (const query of ['playerPage=-1', 'playerPage=NaN', 'playerPage=0.5', 'playerSort=sql']) assert.equal((await handleAnalytics(request(`report?${query}`, null, { Cookie: cookie }), env)).status, 400);
  assert.equal((await handleAnalytics(request('report?days=999', null, { Cookie: cookie }), env)).status, 400);
  assert.equal((await handleAnalytics(request('report', null, { Cookie: cookie + 'x' }), env)).status, 401);
});
test('preflight and error responses allow only the published browser origins', async () => {
  const { env } = environment();
  const r = await handleAnalytics(new Request(`${origin}/api/analytics/events`, { method: 'OPTIONS', headers: { Origin: 'https://rnaud.github.io' } }), env);
  assert.equal(r.status, 204); assert.equal(r.headers.get('Access-Control-Allow-Origin'), 'https://rnaud.github.io');
  const report = await handleAnalytics(request('report'), env);
  assert.equal(report.headers.get('Access-Control-Allow-Origin'), null);
});
