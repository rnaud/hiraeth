// The site serves the reference sheets and the changelog's pictures; the devices never carry them: the over-the-air
// zip skips them (scripts/web-update.mjs), and the APK and the Deck package strip them (scripts/site-only.mjs).
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { siteOnly, stripSiteOnly } from '../scripts/site-only.mjs';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('the reference sheets and the changelog pictures are site-only; the game is not', () => {
  for (const f of ['assets/IMG_3808-DAtVrONv.JPG', 'assets/reference-3-BW3qq2D9.jpeg', 'changelog-media/1.0/sightings-after.webp', 'changelog-media'])
    assert.ok(siteOnly(f), f);
  for (const f of ['assets/index-abc123.js', 'music/desert.mp3', 'sfx/step-1.mp3', 'thumbs/desert.jpg', 'item-pictures/lens.webp', 'assets/eyes-x1.png', 'index.html'])
    assert.ok(!siteOnly(f), f);
});

test('stripSiteOnly takes them out of a built dist/ and leaves the rest', async () => {
  const d = mkdtempSync(join(tmpdir(), 'site-only-'));
  try {
    mkdirSync(join(d, 'assets')); mkdirSync(join(d, 'changelog-media/1.0'), { recursive: true }); mkdirSync(join(d, 'music'));
    writeFileSync(join(d, 'assets/IMG_3801-C_OsWSdk.JPG'), Buffer.alloc(1000));
    writeFileSync(join(d, 'changelog-media/1.0/a-after.webp'), Buffer.alloc(500));
    writeFileSync(join(d, 'assets/index-abc.js'), 'x'); writeFileSync(join(d, 'music/desert.mp3'), 'x');
    const r = await stripSiteOnly(d);
    assert.equal(r.files, 2); assert.equal(r.bytes, 1500);
    assert.ok(!existsSync(join(d, 'assets/IMG_3801-C_OsWSdk.JPG')) && !existsSync(join(d, 'changelog-media')));
    assert.ok(existsSync(join(d, 'assets/index-abc.js')) && existsSync(join(d, 'music/desert.mp3')));
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('the APK and the Deck package strip them before packing', () => {
  assert.match(read('.github/workflows/android.yml'), /node scripts\/site-only\.mjs dist[\s\S]*npx cap sync android/);
  assert.match(read('scripts/package-steam-deck.mjs'), /siteOnly\(fromDist\(src\)\)/);
  // a bundled game still finds them, on the site (src/levels/reference-sheets.js)
  assert.match(read('src/levels/reference-sheets.js'), /export function sheetSrc/);
});
