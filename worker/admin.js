// Origin-bound, one-hour sessions for the Pages admin; the password never reaches storage.
export const ADMIN_ORIGINS = new Set(['https://hiraeth.my', 'https://rnaud.github.io', 'https://hiraeth.alexandria-rnaud.workers.dev']);
const TTL = 3600, encoder = new TextEncoder();
const hex = bytes => Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, '0')).join('');
const unhex = text => Uint8Array.from(text.match(/../g), b => parseInt(b, 16));
const key = secret => crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
const configured = env => !!(env.HIRAETH_NOTES_PASSWORD && env.HIRAETH_ISSUES_TOKEN && env.NOTES_LOGIN_LIMITER?.limit);
export function adminOrigin(request) {
  const url = new URL(request.url), origin = request.headers.get('Origin') || url.origin;
  return ADMIN_ORIGINS.has(origin) || (origin === url.origin && ['127.0.0.1', 'localhost'].includes(url.hostname)) ? origin : null;
}
export function adminCors(request) {
  const origin = adminOrigin(request);
  return origin ? { 'Access-Control-Allow-Origin': origin, Vary: 'Origin', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization' } : {};
}
const json = (request, body, status = 200) => Response.json(body, { status, headers: { ...adminCors(request), 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' } });
async function sessionKey(env) {
  const material = await crypto.subtle.sign('HMAC', await key(env.HIRAETH_ISSUES_TOKEN), encoder.encode(`hiraeth-admin-key:v1:${env.HIRAETH_NOTES_PASSWORD}`));
  return crypto.subtle.importKey('raw', material, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}
const message = (origin, value) => encoder.encode(`hiraeth-admin:v1:${origin}:${value}`);
export async function adminSignedIn(request, env, now = Date.now()) {
  if (!configured(env)) return false;
  const origin = adminOrigin(request), seconds = Math.floor(now / 1000);
  const match = /^Bearer (\d{10})\.([a-f0-9]{32})\.([a-f0-9]{64})$/.exec(request.headers.get('Authorization') ?? '');
  if (!origin || !match || +match[1] <= seconds || +match[1] > seconds + TTL) return false;
  return crypto.subtle.verify('HMAC', await sessionKey(env), unhex(match[3]), message(origin, `${match[1]}.${match[2]}`));
}
async function body(request) {
  if (request.headers.get('Content-Type')?.split(';')[0].trim() !== 'application/json') throw Error('json');
  const reader = request.body?.getReader(); if (!reader) throw Error('json');
  let text = '', size = 0; const decoder = new TextDecoder();
  try { for (;;) { const part = await reader.read(); if (part.done) break; size += part.value.length;
    if (size > 4096) { await reader.cancel(); throw Error('size'); } text += decoder.decode(part.value, { stream: true });
  } } finally { reader.releaseLock(); }
  return JSON.parse(text + decoder.decode());
}
export async function handleAdmin(request, env, now = Date.now()) {
  if (new URL(request.url).pathname !== '/api/admin/session') return json(request, { error: 'Not found' }, 404);
  if (!adminOrigin(request)) return json(request, { error: 'Origin not allowed' }, 403);
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: adminCors(request) });
  if (!['POST', 'GET'].includes(request.method)) return json(request, { error: 'Method not allowed' }, 405);
  if (!configured(env)) return json(request, { error: 'Admin access is not configured' }, 503);
  try {
    if (request.method === 'GET') return json(request, { authenticated: await adminSignedIn(request, env, now) });
    if (!request.headers.get('Origin')) return json(request, { error: 'Open the admin page to sign in' }, 403);
    if (!(await env.NOTES_LOGIN_LIMITER.limit({ key: 'notebook' })).success) return json(request, { error: 'Please wait a minute before trying again' }, 429);
    let data; try { data = await body(request); } catch { return json(request, { error: 'Invalid sign-in request' }, 400); }
    const password = data?.password;
    if (typeof password !== 'string' || password.length > 1024) return json(request, { error: 'Incorrect password' }, 401);
    const passwordKey = await key(env.HIRAETH_NOTES_PASSWORD);
    const expected = await crypto.subtle.sign('HMAC', passwordKey, encoder.encode(env.HIRAETH_NOTES_PASSWORD));
    if (!await crypto.subtle.verify('HMAC', passwordKey, expected, encoder.encode(password))) return json(request, { error: 'Incorrect password' }, 401);
    const expires = Math.floor(now / 1000) + TTL, value = `${expires}.${crypto.randomUUID().replaceAll('-', '')}`;
    const signature = await crypto.subtle.sign('HMAC', await sessionKey(env), message(adminOrigin(request), value));
    return json(request, { authenticated: true, token: `${value}.${hex(signature)}`, expires: expires * 1000 });
  } catch { return json(request, { error: 'Admin access is temporarily unavailable' }, 503); }
}
