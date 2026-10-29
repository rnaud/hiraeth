// Only the public Deck feed is exposed. Other objects in this bucket remain private.
export const isRuntimePath = path => /^\/updates\/steam-deck(?:\.json|-\d+\.tar\.gz\.\d{3})$/.test(path);

export async function handleRuntime(request, env) {
  if (!['GET', 'HEAD'].includes(request.method)) return new Response(null, { status: 405, headers: { Allow: 'GET, HEAD' } });
  const key = new URL(request.url).pathname.slice(1);
  if (!env.RELEASE_ASSETS) return new Response('Runtime storage unavailable', { status: 503 });
  // HEAD never reads the body. Range reads stream directly from R2 without buffering.
  const meta = await env.RELEASE_ASSETS.head(key);
  if (!meta) return new Response('Not found', { status: 404 });
  const headers = new Headers({
    'Content-Type': key.endsWith('.json') ? 'application/json' : 'application/octet-stream',
    'Cache-Control': key.endsWith('.json') ? 'no-cache' : 'public, max-age=31536000, immutable',
    'ETag': meta.httpEtag,
    'Accept-Ranges': 'bytes',
    'Content-Length': String(meta.size),
    'X-Content-Type-Options': 'nosniff',
  });
  if (request.headers.get('If-None-Match')?.split(',').map(s => s.trim().replace(/^W\//, '')).some(s => s === '*' || s === meta.httpEtag)) {
    headers.delete('Content-Length');
    return new Response(null, { status: 304, headers });
  }
  if (request.method === 'HEAD') return new Response(null, { headers });
  let range, status = 200;
  const match = /^bytes=(\d*)-(\d*)$/.exec(request.headers.get('Range') ?? '');
  const ifRange = request.headers.get('If-Range');
  if (match && (match[1] || match[2]) && (!ifRange || ifRange === meta.httpEtag)) {
    const start = match[1] ? Number(match[1]) : Math.max(0, meta.size - Number(match[2]));
    const end = match[1] && match[2] ? Math.min(Number(match[2]), meta.size - 1) : meta.size - 1;
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end) {
      return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${meta.size}` } });
    }
    range = { offset: start, length: end - start + 1 };
    status = 206;
    headers.set('Content-Range', `bytes ${start}-${end}/${meta.size}`);
    headers.set('Content-Length', String(range.length));
  }
  // A conditional read prevents a concurrently published manifest from using stale metadata.
  const object = await env.RELEASE_ASSETS.get(key, { onlyIf: { etagMatches: meta.etag }, ...(range ? { range } : {}) });
  if (!object || !('body' in object)) return new Response('Runtime changed; retry', { status: 503, headers: { 'Retry-After': '1' } });
  return new Response(object.body, { status, headers });
}
