import { handleIssues } from './issues.js';
// Keep existing Android/Deck zip URLs while storing each asset below 25 MiB.
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/notes/')) return handleIssues(request, env);
    if (!/^\/updates\/web-\d+\.zip$/.test(url.pathname)) return env.ASSETS.fetch(request);
    if (!['GET', 'HEAD'].includes(request.method)) return new Response(null, { status: 405, headers: { Allow: 'GET, HEAD' } });
    const indexUrl = new URL(url);
    indexUrl.pathname += '.json';
    const index = await env.ASSETS.fetch(new Request(indexUrl));
    if (index.status === 404) return env.ASSETS.fetch(request); // older, small archives
    if (!index.ok) return new Response('Update unavailable', { status: 502 });
    const { size, sha256, partSize, parts } = await index.json();
    let start = 0, end = size - 1, status = 200;
    const headers = new Headers({ 'Content-Type': 'application/zip', 'Accept-Ranges': 'bytes', ETag: `"${sha256}"`, 'Cache-Control': 'public, max-age=0, must-revalidate' });
    const range = request.headers.get('Range');
    const ifRange = request.headers.get('If-Range');
    if (request.method === 'GET' && range && (!ifRange || ifRange === headers.get('ETag'))) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(range);
      // Ignore unsupported multi-ranges; a full 200 response is safe for older clients.
      if (match && (match[1] || match[2])) {
        if (match[1]) { start = Number(match[1]); end = match[2] ? Math.min(Number(match[2]), end) : end; }
        else start = Math.max(0, size - Number(match[2]));
        if (!Number.isSafeInteger(start) || start > end) return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } });
        status = 206;
        headers.set('Content-Range', `bytes ${start}-${end}/${size}`);
      }
    }
    const length = end - start + 1;
    headers.set('Content-Length', String(length));
    if (request.method === 'HEAD') return new Response(null, { headers });
    // Whole parts are piped natively: copying 129 MB chunk by chunk in JS ran out of Worker CPU and
    // cut downloads short. FixedLengthStream also sends Content-Length, so a cut is a client error.
    const { readable, writable } = globalThis.FixedLengthStream ? new FixedLengthStream(length) : new TransformStream();
    const pump = async () => {
      for (let part = Math.floor(start / partSize); part * partSize <= end; part++) {
        const partStart = part * partSize, partEnd = Math.min(size, partStart + partSize) - 1;
        const response = parts[part] && await env.ASSETS.fetch(new Request(new URL(`/updates/${parts[part]}`, url)));
        if (!response?.ok || !response.body) throw new Error('Update part unavailable');
        if (start <= partStart && partEnd <= end) { await response.body.pipeTo(writable, { preventClose: true }); continue; }
        // only the first and last parts of a range are sliced here
        const writer = writable.getWriter();
        let offset = partStart;
        for await (const value of response.body) {
          const from = Math.max(0, start - offset), to = Math.min(value.length, end + 1 - offset);
          offset += value.length;
          if (to > from) await writer.write(value.subarray(from, to));
          if (offset > end) break;
        }
        writer.releaseLock();
      }
      await writable.close();
    };
    const done = pump().catch(error => writable.abort(error).catch(() => {}));
    ctx?.waitUntil(done);
    return new Response(readable, { status, headers });
  },
};
