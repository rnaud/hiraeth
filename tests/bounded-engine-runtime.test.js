import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, symlinkSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { bundle, loadBundle, readGameAsset, bundleKey, keep, keptBundle } from '../engine/game-test-runtime.mjs';
import { bundle as genericBundle } from '../scripts/engine-bundle-core.mjs';
import { tempDir, removeTemp } from '../scripts/temp-dirs.mjs';

test('fixed game adapter preserves compiler bytes, runs the actual game, and rejects substituted code', async () => {
  const dir = tempDir('hiraeth-bounded-game-');
  try {
    const file = join(dir, 'game.cjs'), other = join(dir, 'generic.cjs');
    await bundle('godot', { input: 'engine/game.js', out: [file] });
    await genericBundle('godot', { input: 'engine/game.js', out: [other] });
    assert.equal(readFileSync(file, 'utf8'), readFileSync(other, 'utf8'), 'same real compiler and output');
    writeFileSync(file, 'throw Error("substituted code must not execute")');
    const { exports: B, readFile } = loadBundle(file, {}, {}, { seed: 454 });
    assert.equal(typeof B.createGame, 'function');
    assert.ok(B.SEQUENCES.some(s => s.id === 'opening'));
    assert.equal(Buffer.from(readFile('manifest.webmanifest')).toString(), readFileSync('public/manifest.webmanifest', 'utf8'));
    assert.equal(readFile('../package.json'), null, 'host reader refuses traversal');
    assert.throws(() => loadBundle(other), /bounded test runtime first/);
    await assert.rejects(bundle('godot', { input: 'src/hud.js', out: [file] }), /Fixed game test entry/);
    await assert.rejects(bundle('godot', { input: 'engine/game.js', out: [file], plugins: [] }), /Fixed game test entry/);
  } finally { removeTemp(dir); }
});

test('a kept game bundle is used only while every module it holds, the compiler and the file names are as they were', () => {
  const dir = tempDir('hiraeth-kept-bundle-'), src = tempDir('hiraeth-kept-module-');
  try {
    const module = join(src, 'module.js'); writeFileSync(module, 'export const a = 1;');
    const key = bundleKey('godot', 'engine/game.js');
    assert.notEqual(bundleKey('unity', 'engine/game.js'), key, 'each entry its own');
    keep(key, 'the compiled bytes', [module, '\0virtual-glob'], dir);
    assert.equal(keptBundle(key, dir), 'the compiled bytes');
    writeFileSync(module, 'export const a = 2;');
    assert.equal(keptBundle(key, dir), null, 'a module edited: compile again');
    writeFileSync(module, 'export const a = 1;');
    assert.equal(keptBundle(key, dir), 'the compiled bytes');
    // a new file under src/ (one a glob would take in): compile again; gone again, the kept one serves
    const added = tempDir('kept-bundle-probe-', resolve('src'));
    try { assert.equal(keptBundle(key, dir), null, 'a file added under src/'); } finally { removeTemp(added); }
    assert.equal(keptBundle(key, dir), 'the compiled bytes');
    writeFileSync(join(dir, key + '.cjs'), 'tampered bytes');
    assert.equal(keptBundle(key, dir), null, 'bytes that are not the ones kept');
    keep(key, 'other bytes', [join(src, 'missing.js')], dir);
    assert.equal(keptBundle(key, dir), null, 'a module it cannot read: nothing kept');
  } finally { removeTemp(dir); removeTemp(src); }
});

test('runtime asset reads reject absolute paths, traversal and links out of the declared roots', () => {
  for (const path of ['../package.json', 'data/../package.json', resolve('package.json'), '..\\package.json']) assert.throws(() => readGameAsset(path));
  const dir = tempDir('bounded-assets-', resolve('public'));
  try {
    const file = join(dir, 'escape'); symlinkSync(resolve('package.json'), file);
    assert.throws(() => readGameAsset(file.slice(resolve('public').length + 1)), /outside public\/data/);
  } finally { removeTemp(dir); }
});
