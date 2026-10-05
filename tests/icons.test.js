// The app icon (docs/systems/app-icon.md): every file the Android build, the web manifest and
// index.html name is there at its size, all made from the committed capture of a References view.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { ICON, DENSITIES, SPLASH, WEB, FAVICON, ADAPTIVE, ico } from '../scripts/icons.mjs';

const RES = 'android/app/src/main/res';
const size = (path) => { const b = readFileSync(path); assert.equal(b.toString('latin1', 1, 4), 'PNG', `${path} is a PNG`); return [b.readUInt32BE(16), b.readUInt32BE(20)]; };

test('the capture the icons are made from is committed, square, and cut from a References view', () => {
  const [w, h] = size('docs/icon/capture.png');
  assert.equal(w, h);
  assert.ok(w >= 768, 'large enough for the 512 px icons');
  const views = readdirSync('src/levels').filter((f) => f.startsWith('reference-')).map((f) => readFileSync(`src/levels/${f}`, 'utf8')).join('\n');
  assert.ok(views.includes(`id: '${ICON.view}'`), `${ICON.view} is a view of the References level`);
});

test('Android: the launcher icons at every density, the adaptive icon with its three layers', () => {
  const manifest = readFileSync('android/app/src/main/AndroidManifest.xml', 'utf8');
  assert.match(manifest, /android:icon="@mipmap\/ic_launcher"/);
  assert.match(manifest, /android:roundIcon="@mipmap\/ic_launcher_round"/);
  for (const [d, k] of Object.entries(DENSITIES)) {
    for (const name of ['ic_launcher', 'ic_launcher_round']) assert.deepEqual(size(`${RES}/mipmap-${d}/${name}.png`), [48 * k, 48 * k], `${d} ${name}`);
    for (const layer of ['foreground', 'background', 'monochrome']) assert.deepEqual(size(`${RES}/mipmap-${d}/ic_launcher_${layer}.png`), [108 * k, 108 * k], `${d} ${layer}`);
  }
  for (const name of ['ic_launcher', 'ic_launcher_round']) {
    const xml = readFileSync(`${RES}/mipmap-anydpi-v26/${name}.xml`, 'utf8');
    assert.equal(xml, ADAPTIVE);
    for (const layer of ['background', 'foreground', 'monochrome']) assert.match(xml, new RegExp(`<${layer} android:drawable="@mipmap/ic_launcher_${layer}"/>`));
  }
  for (const [dir, [w, h]] of Object.entries(SPLASH)) assert.deepEqual(size(`${RES}/${dir}/splash.png`), [w, h], dir);
});

test('the web: the manifest icons, the apple-touch icon, the favicon', () => {
  for (const [name, [s]] of Object.entries(WEB)) assert.deepEqual(size(`public/icons/${name}`), [s, s], name);
  const manifest = JSON.parse(readFileSync('public/manifest.webmanifest', 'utf8'));
  for (const i of manifest.icons) {
    assert.ok(existsSync(`public/${i.src}`), i.src);
    assert.equal(i.sizes, size(`public/${i.src}`).join('x'), i.src);
  }
  assert.ok(manifest.icons.some((i) => i.purpose === 'maskable') && manifest.icons.some((i) => i.purpose === 'any'));
  const html = readFileSync('index.html', 'utf8');
  for (const [, href] of html.matchAll(/<link rel="(?:icon|apple-touch-icon)"[^>]*href="\.\/([^"]+)"/g)) assert.ok(existsSync(`public/${href}`), href);
  // the .ico: a directory of PNGs at 16, 32 and 48
  const f = readFileSync('public/favicon.ico');
  assert.equal(f.readUInt16LE(2), 1);
  assert.deepEqual([...Array(f.readUInt16LE(4)).keys()].map((i) => f[6 + 16 * i]), FAVICON);
  // the Steam Deck and Electron take the 512
  assert.match(readFileSync('desktop/main.mjs', 'utf8'), /icons\/icon-512\.png/);
});

test('ico() writes a directory the PNGs follow', () => {
  const a = Buffer.from('aaaa'), b = Buffer.from('bbbbbb');
  const out = ico([{ size: 16, data: a }, { size: 256, data: b }]);
  assert.equal(out.readUInt16LE(4), 2);
  assert.equal(out[6], 16); assert.equal(out[22], 0);   // (256 is written as 0)
  assert.equal(out.readUInt32LE(6 + 12), 38); assert.equal(out.readUInt32LE(22 + 12), 42);
  assert.equal(out.subarray(38).toString(), 'aaaabbbbbb');
});
