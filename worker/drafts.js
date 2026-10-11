// Screenshot drafts (issue #8): the debug menu on a handheld captures the frame and what the game knows about where it
// is, and saves it as a draft the Notes page lists, to be written up and sent as an issue later, from any device.
// Drafts are not issues: they live in the Worker's own store (a Durable Object, NotesDrafts, one for the notebook)
// until the Notes page sends one to GitHub. docs/systems/notes.md "Screenshot drafts".
//
// The game runs on another origin (the Android app, GitHub Pages, the Deck) and holds no password: a device is paired
// once. It asks for a code (POST pair), shows it, and polls (GET pair); the author types the code on the signed-in Notes
// page (POST pair/approve), and the device collects a device token: drafts-write only, signed like the session cookie
// from both secrets (rotating either revokes every device). With it, the device may POST drafts, and nothing else.
//
//   POST   /api/notes/pair                 any origin             → { code, secret, expires }
//   GET    /api/notes/pair?code=&secret=   any origin             → { status: 'waiting' } | { token }
//   POST   /api/notes/pair/approve         the notebook (cookie)  { code } → { ok }
//   POST   /api/notes/drafts               any origin, Bearer     { text, context, shot } → { draft: { id } }
//   GET    /api/notes/drafts               the notebook (cookie)  → { drafts: [...] }
//   POST   /api/notes/drafts/<id>/publish  the notebook (cookie)  { text } → { issue }
//   DELETE /api/notes/drafts/<id>          the notebook (cookie)  → { ok }
//   GET    /api/notes/shots/<id>.jpg       anyone with the link (an unguessable id: the issue on GitHub shows it)

export const DRAFT_LIMITS = {
  body: 200000,        // bytes in a draft's request (the notes' own: 20,000)
  shot: 90000,         // bytes of JPEG (stored base64, under a Durable Object value's 128 KiB)
  text: 4000,          // characters, as a note
  context: 2000,       // characters of the game's state, as JSON
  drafts: 50,          // drafts kept at once
};
const PAIR_SECONDS = 10 * 60;
const DEVICE_SECONDS = 400 * 24 * 60 * 60;
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const encoder = new TextEncoder();
const hex = (bytes) => Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, '0')).join('');
const randomHex = (n) => hex(crypto.getRandomValues(new Uint8Array(n)));

/** The answers a device on another origin may read (no credentials cross: the token is a header). */
export const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Authorization, Content-Type', 'Access-Control-Max-Age': '86400' };
function json(data, status = 200, headers = {}) {
  return Response.json(data, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...headers } });
}

/** The notebook's store: the Durable Object's storage behind a small get / put / delete / list (tests pass a Map's). */
export function doStore(namespace) {
  const stub = namespace.get(namespace.idFromName('notebook'));
  const call = async (op) => {
    const r = await stub.fetch('https://notes-drafts/op', { method: 'POST', body: JSON.stringify(op), headers: { 'Content-Type': 'application/json' } });
    if (!r.ok) throw new Error('store');
    return (await r.json()).value;
  };
  return {
    get: (key) => call({ op: 'get', key }),
    put: (key, value) => call({ op: 'put', key, value }),
    delete: (key) => call({ op: 'delete', key }),
    list: (prefix) => call({ op: 'list', prefix }),
  };
}
/** A store in memory (the tests'; also what doStore's object keeps). */
export function memoryStore(map = new Map()) {
  return {
    map,
    get: async (key) => map.get(key) ?? null,
    put: async (key, value) => { map.set(key, value); return true; },
    delete: async (key) => map.delete(key),
    list: async (prefix) => [...map.entries()].filter(([k]) => k.startsWith(prefix)).map(([key, value]) => ({ key, value })),
  };
}

/** The Durable Object: the notebook's drafts, pairings and shots, as keys and values (wrangler.jsonc, a SQLite class). */
export class NotesDrafts {
  constructor(state) { this.storage = state.storage; }
  async fetch(request) {
    let op;
    try { op = await request.json(); } catch { return Response.json({ error: 'bad op' }, { status: 400 }); }
    const s = this.storage;
    if (op.op === 'get') return Response.json({ value: (await s.get(op.key)) ?? null });
    if (op.op === 'put') { await s.put(op.key, op.value); return Response.json({ value: true }); }
    if (op.op === 'delete') return Response.json({ value: await s.delete(op.key) });
    if (op.op === 'list') return Response.json({ value: [...(await s.list({ prefix: op.prefix, limit: 200 })).entries()].map(([key, value]) => ({ key, value })) });
    return Response.json({ error: 'bad op' }, { status: 400 });
  }
}

// ------------------------------------------------------------------ device tokens
async function deviceKey(env) {
  const base = await crypto.subtle.importKey('raw', encoder.encode(env.HIRAETH_ISSUES_TOKEN), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const material = await crypto.subtle.sign('HMAC', base, encoder.encode(`hiraeth-notes:device-key:v1:${env.HIRAETH_NOTES_PASSWORD}`));
  return crypto.subtle.importKey('raw', material, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}
const deviceBytes = (device, expiry) => encoder.encode(`hiraeth-notes:device:v1:${device}:${expiry}`);
export async function deviceToken(env, now, device = randomHex(8)) {
  const expiry = Math.floor(now / 1000) + DEVICE_SECONDS;
  return `${device}.${expiry}.${hex(await crypto.subtle.sign('HMAC', await deviceKey(env), deviceBytes(device, expiry)))}`;
}
export async function deviceFrom(request, env, now) {
  const m = /^Bearer ([a-f0-9]{16})\.(\d{10})\.([a-f0-9]{64})$/.exec(request.headers.get('Authorization') ?? '');
  if (!m || +m[2] <= Math.floor(now / 1000)) return null;
  const sig = Uint8Array.from(m[3].match(/../g), (b) => parseInt(b, 16));
  return await crypto.subtle.verify('HMAC', await deviceKey(env), sig, deviceBytes(m[1], m[2])) ? m[1] : null;
}
async function sha(text) { return hex(await crypto.subtle.digest('SHA-256', encoder.encode(text))); }
function pairCode() {
  const b = crypto.getRandomValues(new Uint8Array(6));
  return Array.from(b, (x) => CODE_ALPHABET[x % CODE_ALPHABET.length]).join('');
}

// ------------------------------------------------------------------ what a draft may hold
const CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;
/** A JPEG's bytes from base64, or null (not a JPEG, or too big). */
export function shotBytes(b64) {
  if (typeof b64 !== 'string' || !/^[A-Za-z0-9+/]+={0,2}$/.test(b64) || b64.length > Math.ceil(DRAFT_LIMITS.shot / 3) * 4) return null;
  let bin;
  try { bin = atob(b64); } catch { return null; }
  if (bin.length > DRAFT_LIMITS.shot || bin.charCodeAt(0) !== 0xff || bin.charCodeAt(1) !== 0xd8 || bin.charCodeAt(2) !== 0xff) return null;
  return bin.length;
}
/** The game's state, kept as plain short strings and numbers (nothing that could be markup on the page). */
export function cleanContext(c) {
  if (!c || typeof c !== 'object' || Array.isArray(c)) return {};
  const out = {};
  for (const [k, v] of Object.entries(c).slice(0, 24)) {
    if (!/^[a-z][a-zA-Z0-9]{0,23}$/.test(k)) continue;
    if (typeof v === 'number' && Number.isFinite(v)) out[k] = Math.round(v * 100) / 100;
    else if (typeof v === 'string' && !CONTROL.test(v)) out[k] = v.slice(0, 200);
    else if (typeof v === 'boolean') out[k] = v;
  }
  return JSON.stringify(out).length <= DRAFT_LIMITS.context ? out : {};
}
/** The issue a draft becomes: its text, the screenshot (served from here), and the game's state under it. */
export function draftIssue(draft, text, origin) {
  const body = [text.trim()];
  if (draft.shot) body.push(`![Screenshot](${origin}/api/notes/shots/${draft.shot}.jpg)`);
  const ctx = Object.entries(draft.context ?? {});
  if (ctx.length) body.push(`<details><summary>Where it was</summary>\n\n${ctx.map(([k, v]) => `- ${k}: \`${String(v).replace(/`/g, "'")}\``).join('\n')}\n\n</details>`);
  body.push('Added from a Hiraeth screenshot draft.');
  return { title: text.trim().split(/\r?\n/)[0].trim().slice(0, 256), body: body.join('\n\n') };
}
const draftView = (d, origin) => ({ id: d.id, createdAt: d.createdAt, text: d.text, context: d.context, device: d.device, shot: d.shot ? `${origin}/api/notes/shots/${d.shot}.jpg` : null });

async function readBody(request, limit) {
  if (request.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase() !== 'application/json') throw new Error('json');
  const reader = request.body?.getReader();
  if (!reader) throw new Error('json');
  const chunks = []; let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > limit) { await reader.cancel(); throw new Error('large'); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size); let o = 0;
  for (const c of chunks) { bytes.set(c, o); o += c.length; }
  try { return JSON.parse(new TextDecoder().decode(bytes)); } catch { throw new Error('json'); }
}

/**
 * The drafts' routes (worker/issues.js hands them over; its secrets, limiters and session check are passed in).
 * @param o { signedIn: () => Promise<bool>, rateLimit(binding), github(url, options), githubFailure(response), issueView(issue), store }
 */
export async function handleDrafts(request, env, o, now = Date.now()) {
  const url = new URL(request.url), path = url.pathname.slice('/api/notes/'.length);
  const device = path === 'pair' || (path === 'drafts' && request.method === 'POST');
  const fail = (status, error, extra = {}) => json({ error }, status, device ? { ...CORS, ...extra } : extra);
  if (device && request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  const store = o.store;
  if (!store) return fail(503, 'Screenshot drafts are not set up on this notebook yet.');

  // a shot, by its unguessable id (the issue on GitHub shows it; nothing else is readable without the notebook)
  const shot = /^shots\/([a-f0-9]{32})\.jpg$/.exec(path);
  if (shot) {
    if (request.method !== 'GET') return fail(405, 'Method not allowed.');
    const b64 = await store.get(`shot:${shot[1]}`);
    if (!b64) return fail(404, 'Not found.');
    const bin = atob(b64), bytes = Uint8Array.from(bin, (ch) => ch.charCodeAt(0));
    return new Response(bytes, { headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': 'public, max-age=31536000, immutable', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'" } });
  }

  // ---- the device: pairing, then drafts
  if (path === 'pair' && request.method === 'POST') {
    const limited = await o.rateLimit(env.NOTES_WRITE_LIMITER);
    if (limited) { for (const [k, v] of Object.entries(CORS)) limited.headers.set(k, v); return limited; }
    const code = pairCode(), secret = randomHex(16), expires = Math.floor(now / 1000) + PAIR_SECONDS;
    await store.put(`pair:${code}`, { secret: await sha(secret), expires, token: null });
    return json({ code, secret, expires }, 201, CORS);
  }
  if (path === 'pair' && request.method === 'GET') {
    const code = url.searchParams.get('code') ?? '', secret = url.searchParams.get('secret') ?? '';
    if (!/^[A-Z2-9]{6}$/.test(code) || !/^[a-f0-9]{32}$/.test(secret)) return fail(400, 'Invalid pairing.');
    const p = await store.get(`pair:${code}`);
    if (!p || p.expires <= Math.floor(now / 1000) || p.secret !== await sha(secret)) return fail(404, 'That pairing code has expired. Ask for a new one.');
    if (!p.token) return json({ status: 'waiting' }, 200, CORS);
    await store.delete(`pair:${code}`);   // (collected once)
    return json({ token: p.token }, 200, CORS);
  }
  if (path === 'drafts' && request.method === 'POST') {
    const who = await deviceFrom(request, env, now);
    if (!who) return fail(401, 'This device is not paired with the notebook.');
    const limited = await o.rateLimit(env.NOTES_WRITE_LIMITER);
    if (limited) { for (const [k, v] of Object.entries(CORS)) limited.headers.set(k, v); return limited; }
    let body;
    try { body = await readBody(request, DRAFT_LIMITS.body); } catch (e) { return fail(e.message === 'large' ? 413 : 400, e.message === 'large' ? 'That draft is too big.' : 'Please send valid JSON.'); }
    const text = typeof body?.text === 'string' ? body.text.trim() : '';
    if (text.length > DRAFT_LIMITS.text || CONTROL.test(text)) return fail(400, 'Write a note, up to 4,000 characters.');
    if (body?.shot !== undefined && body?.shot !== null && !shotBytes(body.shot)) return fail(400, 'The screenshot must be a JPEG, up to 90 KB.');
    if ((await store.list('draft:')).length >= DRAFT_LIMITS.drafts) return fail(507, 'The notebook already holds 50 drafts. Send or delete some first.');
    const id = randomHex(16), shotId = body?.shot ? randomHex(16) : null;
    if (shotId) await store.put(`shot:${shotId}`, body.shot);
    await store.put(`draft:${id}`, { id, createdAt: new Date(now).toISOString(), text, context: cleanContext(body?.context), device: who, shot: shotId });
    return json({ draft: { id } }, 201, CORS);
  }
  if (device) return fail(405, 'Method not allowed.');

  // ---- the notebook (the signed-in page, same origin)
  const approve = path === 'pair/approve', one = /^drafts\/([a-f0-9]{32})(\/publish)?$/.exec(path);
  if (!approve && path !== 'drafts' && !one) return json({ error: 'Not found.' }, 404);
  const allowed = approve || one?.[2] ? ['POST'] : one ? ['DELETE'] : ['GET'];
  if (!allowed.includes(request.method)) return json({ error: 'Method not allowed.' }, 405, { Allow: allowed.join(', ') });
  if (request.method !== 'GET' && request.headers.get('Origin') !== url.origin) return json({ error: 'Please open the notebook directly to make changes.' }, 403);
  if (!await o.signedIn()) return json({ error: 'Please unlock your notebook again.' }, 401);
  if (request.method === 'GET') {
    const list = (await store.list('draft:')).map((x) => x.value).filter(Boolean).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    return json({ drafts: list.map((d) => draftView(d, url.origin)) });
  }
  if (request.method === 'DELETE') {
    const d = await store.get(`draft:${one[1]}`);
    if (!d) return json({ error: 'That draft is gone already.' }, 404);
    if (d.shot) await store.delete(`shot:${d.shot}`);
    await store.delete(`draft:${one[1]}`);
    return json({ ok: true });
  }
  const limited = await o.rateLimit(env.NOTES_WRITE_LIMITER);
  if (limited) return limited;
  let body;
  try { body = await readBody(request, 20000); } catch (e) { return json({ error: e.message === 'large' ? 'Please keep each note to 4,000 characters.' : 'Please send valid JSON.' }, e.message === 'large' ? 413 : 400); }
  if (approve) {
    const code = typeof body?.code === 'string' ? body.code.trim().toUpperCase() : '';
    const p = /^[A-Z2-9]{6}$/.test(code) && await store.get(`pair:${code}`);
    if (!p || p.expires <= Math.floor(now / 1000)) return json({ error: 'That code was not found or has expired. Ask the device for a new one.' }, 404);
    await store.put(`pair:${code}`, { ...p, token: await deviceToken(env, now) });
    return json({ ok: true });
  }
  // publish: the draft becomes an issue, and goes from the drafts (its shot stays: the issue shows it)
  const d = await store.get(`draft:${one[1]}`);
  if (!d) return json({ error: 'That draft is gone already.' }, 404);
  const text = typeof body?.text === 'string' ? body.text.trim() : '';
  if (!text || text.length > DRAFT_LIMITS.text || CONTROL.test(text)) return json({ error: 'Write a note, up to 4,000 characters.' }, 400);
  try {
    const response = await o.github(o.api, { method: 'POST', body: JSON.stringify(draftIssue(d, text, url.origin)) });
    if (!response.ok) return o.githubFailure(response, true);
    const issue = await response.json();
    if (!Number.isSafeInteger(issue.number)) return json({ error: 'We could not confirm whether the note was saved. Refresh the list before trying again.' }, 502);
    await store.delete(`draft:${one[1]}`);
    return json({ issue: o.issueView(issue) }, 201);
  } catch {
    return json({ error: 'We could not confirm whether the note was saved. Refresh the list before trying again.' }, 502);
  }
}
