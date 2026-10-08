// The site serves the reference sheets and the changelog's pictures; the devices never carry them: the over-the-air
// zip skips them (scripts/web-update.mjs), and the APK and the Deck package strip them (scripts/site-only.mjs).
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { siteOnly, fetchedOnDemand, leftOff, stripSiteOnly } from '../scripts/site-only.mjs';
import { SOUNDTRACKS } from '../src/soundtracks.js';
import { ON_DEVICE_THEMES } from '../src/music-store.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('the reference sheets and the changelog pictures are site-only; the game is not', () => {
  for (const f of ['assets/IMG_3808-DAtVrONv.JPG', 'assets/reference-3-BW3qq2D9.jpeg', 'changelog-media/1.0/sightings-after.webp', 'changelog-media', '_headers'])
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
    writeFileSync(join(d, 'music/incal.mp3'), Buffer.alloc(300)); writeFileSync(join(d, 'music/manifest.json'), '{}');
    const r = await stripSiteOnly(d);
    assert.equal(r.files, 3); assert.equal(r.bytes, 1800);
    assert.ok(!existsSync(join(d, 'assets/IMG_3801-C_OsWSdk.JPG')) && !existsSync(join(d, 'changelog-media')) && !existsSync(join(d, 'music/incal.mp3')));
    assert.ok(existsSync(join(d, 'assets/index-abc.js')) && existsSync(join(d, 'music/desert.mp3')) && existsSync(join(d, 'music/manifest.json')));
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('the recorded themes are fetched on demand, all but the desert\'s (the first world, offline from the first session)', () => {
  assert.deepEqual(ON_DEVICE_THEMES, ['desert.mp3']);
  assert.equal(SOUNDTRACKS.desert, 'desert.mp3');
  for (const file of new Set(Object.values(SOUNDTRACKS))) {
    const rel = `music/${file}`;
    assert.equal(fetchedOnDemand(rel), file !== 'desert.mp3', rel);
    assert.equal(leftOff(rel), file !== 'desert.mp3', rel);
    assert.ok(!siteOnly(rel), `${rel}: a device does need it (once), it is not the site's alone`);
  }
  for (const f of ['music/manifest.json', 'sfx/step-1.mp3', 'music', 'assets/music-abc.js']) assert.ok(!leftOff(f), f);
  for (const f of ['assets/IMG_3808-DAtVrONv.JPG', 'changelog-media']) assert.ok(leftOff(f), f);
});

test('the APK and the Deck package strip them before packing', () => {
  assert.match(read('.github/workflows/android.yml'), /node scripts\/site-only\.mjs dist[\s\S]*npx cap sync android/);
  assert.match(read('scripts/package-steam-deck.mjs'), /!leftOff\(fromDist\(src\)\)/);
  assert.match(read('scripts/site-only.mjs'), /export async function stripSiteOnly\(dist, skip = leftOff\)/);
  // the site lets the devices fetch the themes (another origin): CORS on /music/*
  assert.match(read('public/_headers'), /^\/music\/\*\n\s+Access-Control-Allow-Origin: \*$/m);
  // a bundled game still finds them, on the site (src/levels/reference-sheets.js)
  assert.match(read('src/levels/reference-sheets.js'), /export function sheetSrc/);
});
