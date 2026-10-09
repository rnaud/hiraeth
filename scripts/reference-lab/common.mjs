// The reference lab's shared pieces (docs/systems/reference-lab.md): aspect ratios and sizes, reading a
// reference image, the HTTP calls with their errors, and keeping the API keys out of everything we print.
//
// Server-side only (the CLI, scripts/gen-reference.mjs, and the dev server's middleware, server.mjs): the
// keys never reach the page. A key goes in a request header, never in a URL, a log line or an error.
import { readFileSync, realpathSync } from 'node:fs';
import { extname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

/** The aspect ratios the page offers (every provider takes them, mapped to its own sizes). */
export const ASPECTS = ['1:1', '3:2', '2:3', '4:3', '3:4', '16:9', '9:16', '21:9'];

/** '16:9' → { w: 16, h: 9, ratio, label }; throws on anything else. */
export function parseAspect(ar = '1:1') {
  const m = String(ar).trim().match(/^(\d{1,2}):(\d{1,2})$/);
  if (!m || +m[1] === 0 || +m[2] === 0) throw new Error(`aspect ratio "${ar}": write it as W:H, e.g. 16:9`);
  const w = +m[1], h = +m[2];
  if (w / h > 3 || h / w > 3) throw new Error(`aspect ratio "${ar}": between 1:3 and 3:1 please`);
  return { w, h, ratio: w / h, label: `${w}:${h}` };
}

/** A width and height for an aspect ratio: the long edge `long`, both multiples of `mult`. */
export function sizeFor(ar, long = 1536, mult = 16) {
  const { ratio } = parseAspect(ar);
  const round = (v) => Math.max(mult, Math.round(v / mult) * mult);
  return ratio >= 1 ? { width: round(long), height: round(long / ratio) } : { width: round(long * ratio), height: round(long) };
}

const MIME = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif', '.glb': 'model/gltf-binary', '.fbx': 'application/octet-stream' };
export const IMAGE_EXT = /\.(jpe?g|png|webp)$/i;
export const mimeOf = (path) => MIME[extname(path).toLowerCase()] ?? 'application/octet-stream';
export const extOf = (mime = '') => ({ 'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' })[String(mime).toLowerCase().split(';')[0]] ?? 'png';
export const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');

/** `rel` resolved inside `root` (a repository path), or an error: no ../ out of it, no absolute paths elsewhere. */
export function insideRoot(root, rel) {
  const abs = resolve(root, rel);
  const r = relative(resolve(root), abs);
  if (!r || r.startsWith('..') || isAbsolute(r)) throw new Error(`"${rel}" is outside the repository`);
  return { abs, rel: r.split(sep).join('/') };
}

/** A reference image from the repository: { path, name, mime, base64, bytes }. Refuses symlinks out of the root. */
export function readRef(root, path) {
  const { abs, rel } = insideRoot(root, path);
  if (!IMAGE_EXT.test(rel)) throw new Error(`"${rel}" is not a JPEG, PNG or WebP picture`);
  const real = realpathSync(abs);
  insideRoot(realpathSync(root), relative(realpathSync(root), real));
  const buf = readFileSync(real);
  return { path: rel, name: rel.split('/').pop(), mime: mimeOf(rel), base64: buf.toString('base64'), bytes: buf.length };
}

/** `text` with every secret value replaced (an error body that echoes a header, a URL someone built badly). */
export function redact(text, secrets = []) {
  let out = String(text ?? '');
  for (const s of secrets) if (s && s.length >= 6) out = out.split(s).join('[redacted]');
  return out;
}

/** A provider's failure, sorted so the page can say what to do: auth, credits, rate-limit, bad-request, server, network, timeout, blocked. */
export class ProviderError extends Error {
  constructor(provider, kind, message, { status = 0, retryAfter = 0 } = {}) {
    super(message);
    this.name = 'ProviderError';
    this.provider = provider; this.kind = kind; this.status = status; this.retryAfter = retryAfter;
  }
}

export function kindOfStatus(status) {
  if (status === 401 || status === 403) return 'auth';
  if (status === 402) return 'credits';
  if (status === 429) return 'rate-limit';
  if (status >= 500) return 'server';
  return 'bad-request';
}

const HINT = {
  auth: 'the key was refused: check it in .env.local',
  credits: 'out of credits on this account',
  'rate-limit': 'rate limited: wait a minute, or ask for fewer images',
  server: 'the provider had a problem: try again later',
  'bad-request': 'the request was refused',
  network: 'could not reach the provider',
  timeout: 'gave up waiting for the provider',
  blocked: 'the provider\'s safety filter refused it',
};

/** The message out of an error body (JSON in several shapes, or text), short and redacted. */
export function errorMessage(body, secrets) {
  let msg = body;
  try {
    const j = typeof body === 'string' ? JSON.parse(body) : body;
    msg = j?.error?.message ?? j?.error?.error ?? (typeof j?.error === 'string' ? j.error : null) ?? j?.detail?.[0]?.msg ?? (typeof j?.detail === 'string' ? j.detail : null) ?? j?.message ?? JSON.stringify(j);
  } catch { /* text */ }
  return redact(String(msg ?? '').slice(0, 400), secrets);
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Transient failures retried before giving up: a dropped connection or a server error (5xx), after these waits (ms). */
export const RETRY_WAITS = [2000, 6000];

/**
 * One HTTP call that answers JSON. A 429 is retried once after Retry-After (at most `maxWait` ms); a network
 * failure or a 5xx is retried after each of RETRY_WAITS (a dropped connection mid-generation may, rarely, bill a
 * picture twice: cheaper than a hole in the batch); any other failure becomes a ProviderError with the provider's
 * own message, redacted. ctx: { fetch, secrets, sleep, maxWait, retryWaits }
 */
export async function httpJson(provider, url, init, ctx = {}) {
  const f = ctx.fetch ?? globalThis.fetch, wait = ctx.sleep ?? sleep, secrets = ctx.secrets ?? [];
  const waits = ctx.retryWaits ?? RETRY_WAITS;
  let transient = 0;
  for (let attempt = 0; ; attempt++) {
    let res;
    try { res = await f(url, init); } catch (e) {
      if (transient < waits.length) { await wait(waits[transient++]); continue; }
      throw new ProviderError(provider, 'network', `${HINT.network} (${redact(e?.message ?? e, secrets)}; tried ${transient + 1} times)`);
    }
    if (res.ok) {
      const text = await res.text();
      try { return JSON.parse(text); } catch { throw new ProviderError(provider, 'server', 'the provider answered something that is not JSON', { status: res.status }); }
    }
    const kind = kindOfStatus(res.status);
    const retryAfter = Math.min(ctx.maxWait ?? 20000, 1000 * (Number(res.headers?.get?.('retry-after')) || 5));
    const body = await res.text().catch(() => '');
    if (kind === 'rate-limit' && attempt === 0) { await wait(retryAfter); continue; }
    if (kind === 'server' && transient < waits.length) { await wait(waits[transient++]); continue; }
    throw new ProviderError(provider, kind, `${HINT[kind]} (HTTP ${res.status}: ${errorMessage(body, secrets)})`, { status: res.status, retryAfter });
  }
}

/** A picture from a URL the provider gave (no key sent: these are signed or public) or a data: URI. */
export async function downloadImage(provider, url, ctx = {}) {
  if (String(url).startsWith('data:')) {
    const m = String(url).match(/^data:([^;,]+)?(;base64)?,(.*)$/s);
    if (!m) throw new ProviderError(provider, 'server', 'a picture came back as a broken data URI');
    return { bytes: Buffer.from(m[3], m[2] ? 'base64' : 'utf8'), mime: m[1] || 'image/png' };
  }
  const f = ctx.fetch ?? globalThis.fetch;
  let res;
  try { res = await f(url); } catch (e) { throw new ProviderError(provider, 'network', `could not download a picture (${redact(e?.message ?? e, ctx.secrets)})`); }
  if (!res.ok) throw new ProviderError(provider, kindOfStatus(res.status), `could not download a picture (HTTP ${res.status})`, { status: res.status });
  const bytes = Buffer.from(await res.arrayBuffer());
  return { bytes, mime: res.headers?.get?.('content-type') || 'image/jpeg' };
}

/** Is `url` on one of `hosts` (exact, or a subdomain) over https? A key only ever goes to its own provider's hosts. */
export function onHost(url, hosts) {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && hosts.some((h) => u.hostname === h || u.hostname.endsWith(`.${h}`));
  } catch { return false; }
}

/**
 * Poll `check()` until it returns a value (not undefined), every `every` ms, for at most `timeout` ms.
 * ctx: { sleep, now }
 */
export async function pollUntil(provider, check, { every = 1500, timeout = 300000, sleep: wait = sleep, now = Date.now } = {}) {
  const start = now();
  for (;;) {
    const v = await check();
    if (v !== undefined) return v;
    if (now() - start > timeout) throw new ProviderError(provider, 'timeout', `${HINT.timeout} (${Math.round(timeout / 1000)} s)`);
    await wait(every);
  }
}

/** Run `count` single-image calls a few at a time (the providers whose API makes one picture a call). */
export async function times(count, fn, parallel = 2) {
  const out = new Array(count);
  let next = 0;
  const worker = async () => { while (next < count) { const i = next++; out[i] = await fn(i); } };
  await Promise.all(Array.from({ length: Math.min(parallel, count) }, worker));
  return out;
}

/** The repository's root (this file is in scripts/reference-lab/). */
export const ROOT = fileURLToPath(new URL('../../', import.meta.url));
