// Manual publication or one-time migration only. Web deployments never call this script.
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
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

// Wrangler uses the existing Cloudflare login or Actions token; no S3 credentials needed.
export async function wranglerStore(directory) {
  const run = promisify(execFile);
  const cli = fileURLToPath(new URL('../node_modules/wrangler/bin/wrangler.js', import.meta.url));
  let sequence = 0;
  const command = async args => {
    for (let attempt = 1; ; attempt++) {
      try { return await run(process.execPath, [cli, 'r2', 'object', ...args, '--remote'], { timeout: 180_000 }); }
      catch (error) {
        if (/The specified key does not exist/.test(error.stderr + error.stdout)) return null;
        if (attempt >= 3) throw Error(`R2 command failed: ${error.stderr || error.message}`);
        await new Promise(resolve => setTimeout(resolve, attempt * 1000));
      }
    }
  };
  return {
    async get(key) {
      const file = join(directory, `get-${sequence++}`);
      try {
        const result = await command(['get', `${BUCKET}/${key}`, '--file', file]);
        return result ? await readFile(file) : null;
      } finally { await rm(file, { force: true }); }
    },
    async put(key, data, type) {
      const file = join(directory, `put-${sequence++}`);
      try {
        await writeFile(file, data);
        await command(['put', `${BUCKET}/${key}`, '--file', file, '--content-type', type]);
      } finally { await rm(file, { force: true }); }
      console.log(`Stored ${key} (${data.length} bytes)`);
    },
  };
}

async function main(args) {
  const temporary = await mkdtemp(join(tmpdir(), 'hiraeth-r2-'));
  try {
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
    await publishRuntime(runtime, await wranglerStore(temporary));
    console.log(`Verified runtime ${runtime.manifest.build} in ${BUCKET}; the existing download URLs are unchanged.`);
  } finally { await rm(temporary, { recursive: true, force: true }); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).catch(error => { console.error(error.message); process.exitCode = 1; });
}
