import { cleanBatch, validBuild } from '../../src/analytics/protocol.js';
import { adminSignedIn, adminCors, adminOrigin, ADMIN_ORIGINS } from '../admin.js';
import { handleIssues } from '../issues.js';
const ORIGINS = ADMIN_ORIGINS;
const json = (body, status = 200, headers = {}) => Response.json(body, { status, headers: {
  'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...headers,
} });
async function readBody(request) {
  if (request.headers.get('Content-Type')?.split(';')[0] !== 'application/json') throw Error('json');
  const reader = request.body?.getReader(); if (!reader) throw Error('json');
  const chunks = []; let length = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read(); if (done) break;
      length += value.byteLength;
      if (length > 16000) { await reader.cancel(); throw Error('large'); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(length); let offset = 0;
  for (const part of chunks) { bytes.set(part, offset); offset += part.length; }
  return JSON.parse(new TextDecoder().decode(bytes));
}
export async function handleAnalytics(request, env, now = Date.now()) {
  const url = new URL(request.url), events = url.pathname === '/api/analytics/events';
  if (!events && url.pathname !== '/api/analytics/report') return json({ error: 'Not found' }, 404);
  const origin = request.headers.get('Origin');
  const cors = events && origin && ORIGINS.has(origin) ? { 'Access-Control-Allow-Origin': origin, Vary: 'Origin',
    'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '86400' } : (!events && origin ? adminCors(request) : {});
  // Native clients have no Origin. Origin checks reduce accidental browser abuse, not authentication.
  if (events && origin && !ORIGINS.has(origin)) return json({ error: 'Origin not allowed' }, 403);
  if (!events && !adminOrigin(request)) return json({ error: 'Origin not allowed' }, 403);
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (request.method !== (events ? 'POST' : 'GET')) return json({ error: 'Method not allowed' }, 405, cors);
  if (!env.ANALYTICS || !env.ANALYTICS_LIMITER) return json({ error: 'Analytics is not configured' }, 503, cors);
  try {
    let data;
    if (events) {
      const budget = await env.ANALYTICS_LIMITER.limit({ key: request.headers.get('CF-Connecting-IP') ?? 'native' });
      if (!budget.success) return json({ error: 'Please retry later' }, 429, { ...cors, 'Retry-After': '60' });
      try { data = cleanBatch(await readBody(request), now); }
      catch (e) { return json({ error: 'Invalid event batch' }, e.message === 'large' ? 413 : 400, cors); }
      if (!data) return json({ error: 'Invalid event batch' }, 400, cors);
    } else {
      // Reuse the existing private notebook login; no password or raw installation IDs in reports.
      let authenticated = await adminSignedIn(request, env, now);
      // Existing same-origin notebook sessions continue working. Bearer failures never fall back to cookies.
      if (!authenticated && !request.headers.has('Authorization') && (!origin || origin === url.origin)) {
        const auth = await handleIssues(new Request(new URL('/api/notes/session', url), { headers: request.headers }), env);
        if (!auth.ok) return json({ error: 'Private reporting needs notebook login configuration' }, 503, cors);
        authenticated = (await auth.json()).authenticated;
      }
      if (!authenticated) return json({ error: 'Sign in to view analytics' }, 401, cors);
      const days = Number(url.searchParams.get('days') ?? 7), platform = url.searchParams.get('platform') ?? 'all', build = url.searchParams.get('build') ?? '';
      if (![7, 30, 90].includes(days) || !['all', 'web', 'android', 'linux'].includes(platform) || (build && !validBuild(build))) return json({ error: 'Invalid filters' }, 400, cors);
      const playerPage = Number(url.searchParams.get('playerPage') ?? 0), playerSort = url.searchParams.get('playerSort') ?? 'recent';
      if (!Number.isSafeInteger(playerPage) || playerPage < 0 || playerPage > 100000 || !['recent', 'progress', 'oldest'].includes(playerSort)) return json({ error: 'Invalid player filters' }, 400, cors);
      data = { days, platform, build, playerPage, playerSort };
    }
    const stub = env.ANALYTICS.get(env.ANALYTICS.idFromName('hiraeth-v1'));
    const response = await stub.fetch('https://analytics/internal', { method: 'POST', body: JSON.stringify({ op: events ? 'ingest' : 'report', data }) });
    if (!response.ok) return json({ error: 'Collection budget reached or storage unavailable' }, response.status === 429 ? 429 : 503, cors);
    return json(await response.json(), 200, cors);
  } catch { return json({ error: 'Analytics is temporarily unavailable' }, 503, cors); }
}
