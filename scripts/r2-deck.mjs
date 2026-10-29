// Manual publication or one-time migration only. Web deployments never call this script.
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { AwsClient } from 'aws4fetch';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { liveRuntime, partName } from './deck-runtime.mjs';
import { SITE } from './content-policy.mjs';

export const BUCKET = 'hiraeth-assets';
const hash = data => createHash('sha256').update(data).digest('hex');
const manifestKey = 'updates/steam-deck.json';

export function validateRuntime(manifest, parts) {
  if (!Number.isSafeInteger(manifest.build) || manifest.build <= 0 || !manifest.version || !manifest.key ||
      !Array.isArray(manifest.parts) || !parts.length || parts.length !== manifest.parts.length) throw Error('Invalid runtime manifest');
  for (let i = 0; i < parts.length; i++) {
    if (manifest.parts[i] !== new URL(`updates/${partName(manifest.build, i)}`, SITE).href) throw Error('Unexpected runtime part URL');
  }
  const data = Buffer.concat(parts);
  if (data.length !== manifest.size || hash(data) !== manifest.sha256) throw Error('Runtime checksum mismatch');
}

/** Verify all source bytes before uploading; read back each object; advance the feed last.
 * Immutable build names cannot be overwritten with different bytes. Keep old builds for in-flight downloads.
 * Publication must use the cloudflare-production concurrency group (also for manual migrations).
 */
export async function publishRuntime({ manifest, parts }, store) {
  validateRuntime(manifest, parts);
  const old = await store.get(manifestKey);
  if (old) {
    const previous = JSON.parse(old);
    if (previous.build > manifest.build) throw Error('Refusing to roll back the runtime');
    if (previous.build === manifest.build && (previous.sha256 !== manifest.sha256 || previous.key !== manifest.key ||
        previous.size !== manifest.size || JSON.stringify(previous.parts) !== JSON.stringify(manifest.parts))) throw Error('Runtime build already exists with different content');
  }
  for (const [i, data] of parts.entries()) {
    const key = `updates/${partName(manifest.build, i)}`;
    const existing = await store.get(key);
    if (existing && !existing.equals(data)) throw Error(`Refusing to replace immutable ${key}`);
    if (!existing) {
      await store.put(key, data, 'application/octet-stream');
      const stored = await store.get(key);
      if (!stored?.equals(data)) throw Error(`R2 verification failed: ${key}`);
    }
  }
  const bytes = Buffer.from(JSON.stringify(manifest, null, 2) + '\n');
  await store.put(manifestKey, bytes, 'application/json');
  if (!(await store.get(manifestKey))?.equals(bytes)) throw Error('R2 manifest verification failed');
}

// Bucket-only permissions are supported by S3, not Cloudflare's REST object API.
// Derive the S3 secret in memory from the existing Actions token; never log credentials.
export function s3Store({ accountId = process.env.CLOUDFLARE_ACCOUNT_ID,
  tokenId = process.env.CLOUDFLARE_API_TOKEN_ID, token = process.env.CLOUDFLARE_API_TOKEN,
  fetcher = fetch, sleep = ms => new Promise(resolve => setTimeout(resolve, ms)),
} = {}) {
  if (!/^[a-f0-9]{32}$/.test(accountId ?? '') || !/^[a-f0-9]{32}$/.test(tokenId ?? '') || !token) {
    throw Error('Set CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN_ID and CLOUDFLARE_API_TOKEN for R2 publication');
  }
  const client = new AwsClient({ accessKeyId: tokenId, secretAccessKey: hash(token), service: 's3', region: 'auto' });
  const command = async (method, key, data, type) => {
    const url = `https://${accountId}.r2.cloudflarestorage.com/${BUCKET}/${key.split('/').map(encodeURIComponent).join('/')}`;
    for (let attempt = 1; ; attempt++) {
      let status;
      try {
        const request = await client.sign(url, { method, body: data,
          headers: type ? { 'Content-Type': type, 'X-Amz-Content-Sha256': hash(data) } : {},
          signal: AbortSignal.timeout(180_000), redirect: 'error' });
        const response = await fetcher(request);
        status = response.status;
        if (response.ok) return Buffer.from(await response.arrayBuffer());
        await response.body?.cancel();
        if (method === 'GET' && status === 404) return null;
      } catch { /* Retry interrupted transfers without logging signed requests or secrets. */ }
      if (attempt >= 3 || (status && status !== 429 && status < 500)) {
        throw Error(`R2 ${method} failed for ${key}: ${status ?? 'transfer interrupted'}`);
      }
      await sleep(attempt * 1000);
    }
  };
  return {
    get: key => command('GET', key),
    async put(key, data, type) {
      await command('PUT', key, data, type);
      console.log(`Stored ${key} (${data.length} bytes)`);
    },
  };
}

async function main(args) {
  const store = s3Store();
  let runtime;
  if (args.includes('--migrate')) {
    runtime = await liveRuntime(SITE, '', { reuseOnly: true });
    if (!runtime) throw Error('Could not verify the published runtime; R2 was not changed');
  } else {
    const at = args.indexOf('--from');
    if (at < 0 || !args[at + 1]) throw Error('Use --migrate or --from <dist/updates>');
    const directory = resolve(args[at + 1]);
    const manifest = JSON.parse(await readFile(join(directory, 'steam-deck.json'), 'utf8'));
    if (!Number.isSafeInteger(manifest.build) || !Array.isArray(manifest.parts)) throw Error('Invalid runtime manifest');
    const parts = await Promise.all(manifest.parts.map((_, i) => readFile(join(directory, partName(manifest.build, i)))));
    runtime = { manifest, parts };
  }
  await publishRuntime(runtime, store);
  console.log(`Verified runtime ${runtime.manifest.build} in ${BUCKET}; the existing download URLs are unchanged.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).catch(error => { console.error(error.message); process.exitCode = 1; });
}
