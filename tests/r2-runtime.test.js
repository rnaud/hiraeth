import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../worker/update-download.js';
import { runtimeJson, split } from '../scripts/deck-runtime.mjs';
import { publishRuntime, s3Store } from '../scripts/r2-deck.mjs';
import { readFileSync } from 'node:fs';

const origin = 'https://hiraeth.alexandria-rnaud.workers.dev';
const path = '/updates/steam-deck-123.tar.gz.000';
const data = Buffer.from('the runtime bytes');
function bucket() {
  const reads = [];
  const meta = { size: data.length, etag: 'abc', httpEtag: '"abc"' };
  return { reads, async head(key) { return key === path.slice(1) || key === 'updates/steam-deck.json' ? meta : null; },
    async get(key, options) {
      reads.push({ key, options });
      const range = options.range;
      return { ...meta, body: range ? data.subarray(range.offset, range.offset + range.length) : data };
    } };
}
function request(store, pathname = path, options = {}) {
  return worker.fetch(new Request(origin + pathname, options), {
    RELEASE_ASSETS: store, ASSETS: { fetch: () => new Response('static', { status: 404 }) },
  });
}

test('R2 serves existing Deck URLs, streaming GET, metadata-only HEAD and conditional reads', async () => {
  const store = bucket();
  const response = await request(store);
  assert.equal(response.status, 200);
  assert.equal(await response.text(), data.toString());
  assert.equal(response.headers.get('Content-Length'), String(data.length));
  assert.equal(response.headers.get('ETag'), '"abc"');
  assert.match(response.headers.get('Cache-Control'), /immutable/);
  assert.deepEqual(store.reads[0].options.onlyIf, { etagMatches: 'abc' });
  const head = await request(store, path, { method: 'HEAD' });
  assert.equal(head.body, null);
  assert.equal(store.reads.length, 1);
  const unchanged = await request(store, path, { headers: { 'If-None-Match': 'W/"abc"' } });
  assert.equal(unchanged.status, 304);
  assert.equal(store.reads.length, 1);
  const manifest = await request(store, '/updates/steam-deck.json');
  assert.equal(manifest.headers.get('Cache-Control'), 'no-cache');
  assert.equal(manifest.headers.get('Content-Type'), 'application/json');
});

test('R2 downloads resume with bounded and suffix ranges; stale validators get the full body', async () => {
  const store = bucket();
  for (const [range, expected] of [['bytes=4-10', data.subarray(4, 11)], ['bytes=-5', data.subarray(-5)], ['bytes=4-', data.subarray(4)]]) {
    const res = await request(store, path, { headers: { Range: range } });
    assert.equal(res.status, 206);
    assert.equal(await res.text(), expected.toString());
    assert.equal(Number(res.headers.get('Content-Length')), expected.length);
  }
  for (const range of ['bytes=999-', 'bytes=8-2', 'bytes=-0']) {
    assert.equal((await request(store, path, { headers: { Range: range } })).status, 416);
  }
  const res = await request(store, path, { headers: { Range: 'bytes=4-6', 'If-Range': '"old"' } });
  assert.equal(res.status, 200);
  assert.equal(await res.text(), data.toString());
});

test('R2 exposes only the Deck feed and handles missing, unbound and concurrent changes safely', async () => {
  const store = bucket();
  assert.equal((await request(store, path, { method: 'PUT' })).status, 405);
  assert.equal((await request(store, '/updates/steam-deck-999.tar.gz.000')).status, 404);
  assert.equal(await (await request(store, '/updates/private-secret')).text(), 'static');
  assert.equal((await request(undefined)).status, 503);
  store.get = async () => ({ etag: 'changed' });
  assert.equal((await request(store)).status, 503);
});

function memoryStore() {
  const objects = new Map(), writes = [];
  return { objects, writes, get: async key => objects.get(key) ?? null,
    put: async (key, bytes) => { writes.push(key); objects.set(key, bytes); } };
}
const runtime = (build = 123) => ({ manifest: runtimeJson({ build, version: '2.36', data, key: 'key', size: 8 }), parts: split(data, 8) });

test('S3 uses scoped credentials, retries interrupted reads and never treats denial as a missing object', async () => {
  const requests = [], waits = [];
  const responses = [new Response(null, { status: 503 }), new Response(data),
    new Response(null, { status: 404 }), new Response(null, { status: 403 }),
    new Response(null, { status: 200 })];
  const store = s3Store({ accountId: 'a'.repeat(32), tokenId: 'b'.repeat(32), token: 'test-token',
    fetcher: async req => { requests.push(req); return responses.shift(); }, sleep: async ms => waits.push(ms) });
  assert.deepEqual(await store.get('updates/steam-deck.json'), data);
  assert.deepEqual(waits, [1000]);
  assert.equal(await store.get('updates/missing'), null);
  await assert.rejects(store.get('updates/denied'), /403/);
  assert.equal(requests.length, 4, 'access denial must not retry or become a missing object');
  await store.put('updates/test part', data, 'application/octet-stream');
  const uploaded = requests.at(-1);
  assert.equal(uploaded.url, `https://${'a'.repeat(32)}.r2.cloudflarestorage.com/hiraeth-assets/updates/test%20part`);
  assert.match(uploaded.headers.get('Authorization'), /Credential=b{32}\/\d+\/auto\/s3\/aws4_request/);
  assert.equal(uploaded.redirect, 'error');
  assert.equal(uploaded.headers.get('Content-Type'), 'application/octet-stream');
  assert.deepEqual(Buffer.from(await uploaded.arrayBuffer()), data);
  assert.doesNotMatch([...uploaded.headers].flat().join(' '), /test-token/);
  let attempts = 0;
  const interrupted = s3Store({ accountId: 'a'.repeat(32), tokenId: 'b'.repeat(32), token: 'test-token',
    fetcher: async () => { attempts++; throw Error('secret must not appear in error'); }, sleep: async () => {} });
  await assert.rejects(interrupted.get('updates/part'), /^Error: R2 GET failed for updates\/part: transfer interrupted$/);
  assert.equal(attempts, 3);
  assert.throws(() => s3Store({ accountId: '', tokenId: '', token: '' }), /Set CLOUDFLARE/);
});

test('migration verifies bytes and keeps the manifest unpublished until every R2 part is readable', async () => {
  const store = memoryStore(), input = runtime();
  await publishRuntime(input, store);
  assert.equal(store.writes.at(-1), 'updates/steam-deck.json');
  assert.equal(store.writes.length, input.parts.length + 1);
  assert.deepEqual(JSON.parse(store.objects.get('updates/steam-deck.json')), input.manifest);
  store.writes.length = 0;
  await publishRuntime(input, store);
  assert.deepEqual(store.writes, ['updates/steam-deck.json'], 'retry reuses identical immutable parts');
  await publishRuntime(runtime(124), store);
  assert.ok(store.objects.has('updates/steam-deck-123.tar.gz.000'), 'old clients can finish downloading');
  await assert.rejects(publishRuntime(input, store), /roll back/);
});

test('bad source, conflicting build or failed readback never advances the R2 feed', async () => {
  const store = memoryStore(), input = runtime();
  await assert.rejects(publishRuntime({ ...input, parts: [Buffer.from('corrupt')] }, store), /manifest/);
  assert.equal(store.writes.length, 0);
  const wrongUrl = { ...input.manifest, parts: input.manifest.parts.map(() => 'https://other.example/part') };
  await assert.rejects(publishRuntime({ ...input, manifest: wrongUrl }, store), /URL/);
  store.objects.set('updates/steam-deck-123.tar.gz.000', Buffer.from('other'));
  await assert.rejects(publishRuntime(input, store), /immutable/);
  assert.equal(store.writes.length, 0);
  const failed = memoryStore();
  failed.get = async () => null;
  await assert.rejects(publishRuntime(input, failed), /verification failed/);
  assert.ok(!failed.writes.includes('updates/steam-deck.json'));
  const good = memoryStore();
  await publishRuntime(input, good);
  await assert.rejects(publishRuntime({ ...input, manifest: { ...input.manifest, key: 'other' } }, good), /different content/);
});

test('the production Worker binding and routing keep R2 independent of static assets', () => {
  const config = readFileSync(new URL('../wrangler.jsonc', import.meta.url), 'utf8');
  assert.match(config, /"binding": "RELEASE_ASSETS", "bucket_name": "hiraeth-assets"/);
  assert.match(config, /"run_worker_first": \["\/updates\/steam-deck\*"/);
  const workflow = readFileSync(new URL('../.github/workflows/cloudflare.yml', import.meta.url), 'utf8');
  assert.match(workflow, /name: Publish a requested Steam Deck runtime to R2\n        if: github.event_name == 'workflow_dispatch' && inputs.build_deck_runtime/);
  assert.match(workflow, /rm dist\/updates\/steam-deck\*/);
  assert.doesNotMatch(workflow, /--reuse-only/);
  const migration = workflow.split('\n  migrate-runtime:')[1];
  assert.match(migration, /if: github.event_name == 'workflow_dispatch' && inputs.migrate_deck_runtime/);
  assert.match(migration, /run: node scripts\/r2-deck.mjs --migrate/);
  assert.doesNotMatch(migration, /wrangler deploy|npm run build|--build-only/);
});
