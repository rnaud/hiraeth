import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { inflateRawSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { tempDir } from '../scripts/temp-dirs.mjs';
import { unityEffects } from '../scripts/engine-bundle.mjs';
import { sfxFiles } from '../src/sfx.js';
import { writeUnityUpdate } from '../scripts/web-update.mjs';
const hash = data => createHash('sha256').update(data).digest('hex');

test('the OTA effect subset contains every assigned take and exact manifest bytes', () => {
  const to = tempDir('hiraeth-effects-subset-');
  const result = unityEffects({ to });
  assert.equal(result.n, sfxFiles().length + 1);
  for (const name of ['manifest.json', ...sfxFiles()]) {
    assert.equal(hash(readFileSync(join(to, name))), hash(readFileSync(new URL(`../public/sfx/${name}`, import.meta.url))), name);
  }
});

test('a strict API4 script update cannot be published without its assigned effect set', async () => {
  const dir = tempDir('hiraeth-effects-missing-'), out = tempDir('hiraeth-effects-update-');
  writeFileSync(join(dir, 'hiraeth.cjs'), '// test bundle');
  writeFileSync(join(dir, 'bundle.json'), JSON.stringify({ build: 9999, minUnity: 4 }));
  mkdirSync(join(dir, 'public', 'sfx'), { recursive: true });
  await assert.rejects(writeUnityUpdate({ out, dir, build: 9999 }), /missing assigned effect public\/sfx\/manifest.json/);
});

function unzip(buf) {
  const end = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  const count = buf.readUInt16LE(end + 10);
  let at = buf.readUInt32LE(end + 16);
  const out = {};
  for (let i = 0; i < count; i++) {
    assert.equal(buf.readUInt32LE(at), 0x02014b50);
    const method = buf.readUInt16LE(at + 10), csize = buf.readUInt32LE(at + 20), size = buf.readUInt32LE(at + 24);
    const nlen = buf.readUInt16LE(at + 28), xlen = buf.readUInt16LE(at + 30), clen = buf.readUInt16LE(at + 32);
    const local = buf.readUInt32LE(at + 42), name = buf.toString('utf8', at + 46, at + 46 + nlen);
    assert.equal(buf.readUInt32LE(local), 0x04034b50);
    const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    const body = buf.subarray(start, start + csize);
    out[name] = method === 8 ? inflateRawSync(body) : Buffer.from(body);
    assert.equal(out[name].length, size, name);
    at += 46 + nlen + xlen + clen;
  }
  return out;
}


test('the actual API4 OTA archive retains all assigned audio bytes and excludes unrelated public assets', async () => {
  const dir = tempDir('hiraeth-effects-complete-'), out = tempDir('hiraeth-effects-archive-');
  writeFileSync(join(dir, 'hiraeth.cjs'), '// complete effect archive fixture');
  writeFileSync(join(dir, 'bundle.json'), JSON.stringify({ build: 9998, minUnity: 4 }));
  unityEffects({ to: join(dir, 'public', 'sfx') });
  mkdirSync(join(dir, 'public', 'models'), { recursive: true });
  writeFileSync(join(dir, 'public', 'models', 'unrelated.glb'), 'not part of compact sound delivery');
  const manifest = await writeUnityUpdate({ out, dir, build: 9998, partSize: 32 * 1024 * 1024 });
  const archive = readFileSync(join(out, 'unity-9998.zip'));
  const files = unzip(archive), names = Object.keys(files);
  const expected = ['manifest.json', ...sfxFiles()].map(name => `public/sfx/${name}`).sort();
  assert.equal(sfxFiles().length, 105, 'the current assigned bank is fully represented');
  assert.deepEqual(names.filter(name => name.startsWith('public/')).sort(), expected);
  assert.ok(!names.includes('public/models/unrelated.glb'));
  for (const name of expected) assert.equal(hash(files[name]), hash(readFileSync(join(dir, name))), name);
  assert.equal(JSON.parse(files['bundle.json']).minUnity, 4);
  assert.equal(manifest.minUnity, 4);
});
