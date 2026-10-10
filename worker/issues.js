// The private notebook: GitHub is the store; neither credential reaches the page.
// Set HIRAETH_ISSUES_TOKEN (this repo, Issues read/write) and HIRAETH_NOTES_PASSWORD
// with Wrangler secrets. Missing configuration fails closed. docs/systems/notes.md.
export const REPOSITORY = 'rnaud/hiraeth';
export const COOKIE = '__Host-hiraeth-notes';
// Renew on each visit; keep the password out of browser storage.
const SESSION_SECONDS = 400 * 24 * 60 * 60;
const encoder = new TextEncoder();
const API = `https://api.github.com/repos/${REPOSITORY}/issues`;

function json(data, status = 200, headers = {}) {
  return Response.json(data, { status, headers: {
    'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...headers,
  } });
}
const failure = (status, error) => json({ error }, status);
const cookie = (value, age = SESSION_SECONDS) => `${COOKIE}=${value}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${age}`;
const configured = (env) => typeof env.HIRAETH_ISSUES_TOKEN === 'string' && env.HIRAETH_ISSUES_TOKEN.length > 0
  && typeof env.HIRAETH_NOTES_PASSWORD === 'string' && env.HIRAETH_NOTES_PASSWORD.length > 0
  && typeof env.NOTES_LOGIN_LIMITER?.limit === 'function'
  && typeof env.NOTES_WRITE_LIMITER?.limit === 'function';

async function signingKey(password) {
  return crypto.subtle.importKey('raw', encoder.encode(password), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}
// A human password must not be enough to forge a cookie offline. Derive a
// purpose-specific key from the server-only GitHub token and password together.
async function sessionKey(env) {
  const material = await crypto.subtle.sign('HMAC', await signingKey(env.HIRAETH_ISSUES_TOKEN), encoder.encode(`hiraeth-notes:session-key:v2:${env.HIRAETH_NOTES_PASSWORD}`));
  return crypto.subtle.importKey('raw', material, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}
function sessionBytes(origin, expiry) { return encoder.encode(`hiraeth-notes:v2:${origin}:${expiry}`); }
async function issueSession(env, origin, now) {
  const expiry = Math.floor(now / 1000) + SESSION_SECONDS;
  const signature = await crypto.subtle.sign('HMAC', await sessionKey(env), sessionBytes(origin, expiry));
  return `${expiry}.${Array.from(new Uint8Array(signature), (b) => b.toString(16).padStart(2, '0')).join('')}`;
}
async function signedIn(request, env, now) {
  const value = (request.headers.get('Cookie') ?? '').split(';').map((x) => x.trim()).find((x) => x.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1);
  const match = /^(\d{10})\.([a-f0-9]{64})$/.exec(value ?? '');
  const seconds = Math.floor(now / 1000);
  if (!match || +match[1] <= seconds || +match[1] > seconds + SESSION_SECONDS) return false;
  const signature = Uint8Array.from(match[2].match(/../g), (b) => parseInt(b, 16));
  return crypto.subtle.verify('HMAC', await sessionKey(env), signature, sessionBytes(new URL(request.url).origin, match[1]));
}
async function rateLimit(binding) {
  try {
    // One author notebook: sharing a key prevents IP rotation at the same edge
    // from resetting the budget. Cloudflare counters are per location, not global.
    if ((await binding.limit({ key: 'notebook' })).success === true) return null;
    return json({ error: 'Please wait a minute before trying again.' }, 429, { 'Retry-After': '60' });
  } catch { return failure(503, 'The notebook is temporarily unavailable. Please try again later.'); }
}
async function samePassword(given, expected) {
  if (typeof given !== 'string' || given.length > 1024) return false;
  const key = await signingKey(expected), bytes = encoder.encode(given);
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(expected));
  return crypto.subtle.verify('HMAC', key, signature, bytes);
}

// Bound streamed bodies too, not just Content-Length (which need not be supplied).
async function readJson(request) {
  if (request.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase() !== 'application/json') throw new Error('json');
  const reader = request.body?.getReader();
  if (!reader) throw new Error('json');
  const chunks = []; let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 20000) { await reader.cancel(); throw new Error('large'); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  try { return JSON.parse(new TextDecoder().decode(bytes)); } catch { throw new Error('json'); }
}

function issueView(issue) {
  return {
    number: issue.number, title: issue.title,
    url: `https://github.com/${REPOSITORY}/issues/${issue.number}`,
    createdAt: issue.created_at, updatedAt: issue.updated_at,
    labels: (issue.labels ?? []).map((l) => typeof l === 'string' ? l : l.name).filter((l) => typeof l === 'string'),
    comments: issue.comments ?? 0,
  };
}
async function github(fetcher, env, url, options = {}) {
  return fetcher(url, { ...options, redirect: 'manual', signal: AbortSignal.timeout(12000), headers: {
    Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'Hiraeth-Notes', Authorization: `Bearer ${env.HIRAETH_ISSUES_TOKEN}`,
    ...(options.body ? { 'Content-Type': 'application/json' } : {}),
  } });
}
function githubFailure(response, writing = false) {
  // Never forward upstream bodies (or authentication details) to the client.
  if (response.status === 429 || response.status === 403 && (response.headers.get('Retry-After') || response.headers.get('X-RateLimit-Remaining') === '0')) {
    return failure(429, 'The notebook is busy. Please wait a minute before trying again.');
  }
  if ([401, 403, 404, 410].includes(response.status)) return failure(503, 'The notebook connection needs attention. Keep this page open to keep your draft.');
  if (response.status === 422) return failure(422, 'This note could not be saved. Please check the text and try again.');
  return failure(502, writing ? 'We could not confirm whether the note was saved. Refresh the list before trying again.' : 'The notes could not be loaded. Please try again.');
}

export async function handleIssues(request, env, fetcher = fetch, now = Date.now()) {
  const url = new URL(request.url), session = url.pathname === '/api/notes/session';
  if (!session && url.pathname !== '/api/notes/issues') return failure(404, 'Not found.');
  const allowed = session ? ['GET', 'POST', 'DELETE'] : ['GET', 'POST'];
  if (!allowed.includes(request.method)) return json({ error: 'Method not allowed.' }, 405, { Allow: allowed.join(', ') });
  // SameSite cookies plus explicit Origin validation: no public token-backed write proxy.
  if (request.method !== 'GET' && request.headers.get('Origin') !== url.origin) return failure(403, 'Please open the notebook directly to make changes.');
  if (!configured(env)) return failure(503, 'The notebook is not connected yet. Please come back after setup.');
  if (session && request.method === 'DELETE') return json({ authenticated: false }, 200, { 'Set-Cookie': cookie('', 0) });
  if (session && request.method === 'POST') {
    const limited = await rateLimit(env.NOTES_LOGIN_LIMITER);
    if (limited) return limited;
  }

  let body;
  if (request.method === 'POST') {
    try { body = await readJson(request); }
    catch (e) { return failure(e.message === 'large' ? 413 : 400, e.message === 'large' ? 'Please keep each note to one short line.' : 'Please send valid JSON.'); }
  }
  if (session && request.method === 'POST') {
    if (!await samePassword(body?.password, env.HIRAETH_NOTES_PASSWORD)) return failure(401, 'That password did not match.');
    return json({ authenticated: true }, 200, { 'Set-Cookie': cookie(await issueSession(env, url.origin, now)) });
  }
  const authenticated = await signedIn(request, env, now);
  if (session) return json({ authenticated }, 200, authenticated
    ? { 'Set-Cookie': cookie(await issueSession(env, url.origin, now)) } : {});
  if (!authenticated) return failure(401, 'Please unlock your notebook again. Your draft is still here.');
  if (request.method === 'POST') {
    const limited = await rateLimit(env.NOTES_WRITE_LIMITER);
    if (limited) return limited;
  }

  try {
    if (request.method === 'GET') {
      const pageText = url.searchParams.get('page') ?? '1';
      if (!/^[1-9]\d{0,3}$/.test(pageText)) return failure(400, 'Invalid page.');
      const page = Number(pageText);
      const response = await github(fetcher, env, `${API}?state=open&sort=created&direction=desc&per_page=50&page=${page}`);
      if (!response.ok) return githubFailure(response);
      const issues = await response.json();
      if (!Array.isArray(issues)) return failure(502, 'The notes could not be loaded. Please try again.');
      return json({ issues: issues.filter((i) => !i.pull_request).map(issueView), nextPage: /rel="next"/.test(response.headers.get('Link') ?? '') ? page + 1 : null });
    }
    const text = body?.text;
    if (text !== undefined && (typeof text !== 'string' || !text.trim() || text.length > 4000 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(text))) {
      return failure(400, 'Write a note, up to 4,000 characters.');
    }
    const title = text === undefined ? body?.title : text.trim().split(/\r?\n/)[0].trim().slice(0, 256);
    const description = text === undefined ? 'Added from the Hiraeth notebook.' : `${text.trim()}\n\nAdded from the Hiraeth notebook.`;
    if (typeof title !== 'string' || !title.trim() || title.trim().length > 256 || /[\r\n\u0000-\u001f\u007f]/.test(title)) {
      return failure(400, 'Write one line, up to 256 characters.');
    }
    const response = await github(fetcher, env, API, { method: 'POST', body: JSON.stringify({ title: title.trim(), body: description }) });
    if (!response.ok) return githubFailure(response, true);
    const issue = await response.json();
    if (!Number.isSafeInteger(issue.number)) return failure(502, 'We could not confirm whether the note was saved. Refresh the list before trying again.');
    return json({ issue: issueView(issue) }, 201);
  } catch {
    return failure(502, request.method === 'POST'
      ? 'We could not confirm whether the note was saved. Refresh the list before trying again.'
      : 'The notes could not be loaded. Please check your connection and try again.');
  }
}
