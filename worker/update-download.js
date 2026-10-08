// Keep existing Android/Deck zip URLs while storing each asset below 25 MiB.
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
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
    headers.set('Content-Length', String(end - start + 1));
    if (request.method === 'HEAD') return new Response(null, { headers });
    let part = Math.floor(start / partSize), reader, offset = part * partSize;
    const body = new ReadableStream({
      async pull(controller) {
        try {
          while (offset <= end) {
            if (!reader) {
              const partUrl = new URL(`/updates/${parts[part++]}`, url);
              const response = await env.ASSETS.fetch(new Request(partUrl));
              if (!response.ok || !response.body) throw new Error('Update part unavailable');
              reader = response.body.getReader();
            }
            const { done, value } = await reader.read();
            if (done) { reader.releaseLock(); reader = null; continue; }
            const from = Math.max(0, start - offset), to = Math.min(value.length, end + 1 - offset);
            offset += value.length;
            if (to > from) { controller.enqueue(value.subarray(from, to)); return; }
          }
          await reader?.cancel();
          controller.close();
        } catch (error) { await reader?.cancel(); controller.error(error); }
      },
      async cancel(reason) { await reader?.cancel(reason); },
    });
    return new Response(body, { status, headers });
  },
};
