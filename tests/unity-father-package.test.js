// #658: a repository-backed editor could find Father while installed players
// omitted his GLB. Tie the actual runtime URL to the native copy inventory.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { unityApi, unityMinApi, unityBundleInfo, unityDecision } from '../scripts/release-info.mjs';

const read = f => readFileSync(new URL('../' + f, import.meta.url));
const text = f => read(f).toString('utf8');
const BUILD = 'unity/Hiraeth/Assets/HiraethJS/Editor/BridgeBuild.cs';

test('the actual Father loader asset is included in Common native package copying', () => {
  const loader = text('src/characters/father-v1.js');
  const asset = loader.match(/loadAsync\(`\$\{base\}([^`]+)`\)/)?.[1];
  assert.equal(asset, 'characters/father-v1/model.glb');
  const common = text(BUILD).split('static void Common()')[1]?.split('TravellerV2();')[0];
  assert.ok(common, 'read the actual Common copy block');
  const inventory = [...common.matchAll(/\("([^"]+)", new\[\] \{([^}]+)\}\)/g)]
    .flatMap(([, dir, names]) => [...names.matchAll(/"([^"]+)"/g)].map(([, name]) => `${dir}/${name}`));
  assert.equal(inventory.filter(f => f === asset).length, 1, 'required runtime asset copied exactly once');
  assert.match(common, /Path\.Combine\(Application\.streamingAssetsPath, "hiraeth-js", "public", from\)/);
  assert.match(common, /File\.Copy\(Path\.Combine\(Repo, "public", from, f\), Path\.Combine\(d, f\), true\)/);
  // A missing file must fail the package build, not silently preserve fallback.
  assert.doesNotMatch(common, /if\s*\(File\.Exists\(Path\.Combine\(Repo, "public", from, f\)/);
  const bytes = read('public/' + asset);
  assert.equal(bytes.readUInt32LE(0), 0x46546c67);
  assert.equal(bytes.readUInt32LE(4), 2);
  assert.equal(bytes.readUInt32LE(8), bytes.length);
  const gltf = JSON.parse(bytes.toString('utf8', 20, 20 + bytes.readUInt32LE(12)));
  assert.ok(gltf.skins?.length && gltf.images?.length, 'existing rigged textured identity');
  for (const image of gltf.images) assert.ok(Number.isInteger(image.bufferView), 'texture travels in GLB');
  for (const buffer of gltf.buffers) assert.equal(buffer.uri, undefined, 'no uncopied external geometry');
});

test('API 4 installed players request the binary that contains Father, while current players accept scripts', () => {
  const minimum = unityMinApi(), api = unityApi();
  assert.ok(minimum >= 5 && minimum <= api);
  const bundle = unityBundleInfo({ build: 15010, version: 'test', updates: true });
  assert.equal(bundle.minUnity, minimum);
  const manifest = { ...bundle, sha256: 'a'.repeat(64) };
  assert.equal(unityDecision(manifest, { unity: 4, current: 15000 }), 'player');
  assert.equal(unityDecision(manifest, { unity: api, current: 15000 }), 'stage');
});
