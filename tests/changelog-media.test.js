// The interactive changelog (changelog.html, docs/systems/changelog.md): its pictures and numbers match
// real lines, the pictures exist and stay small, they never ship in the game's packages, and the page's
// filters, values and picture addresses do what they say.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CHANGELOG, lineText } from '../src/changelog.js';
import { CHANGELOG_MEDIA, MEDIA_DIR, changelogEntries, mediaFor, shotFiles, tagsOf } from '../src/changelog-media.js';
import { delta, matches, mediaSrc, valueOf, MEDIA_SITE } from '../src/changelog-page/view.js';
import { changelogMarkdown } from '../scripts/changelog-md.mjs';
import { releaseNotes } from '../scripts/release-info.mjs';
import { MEDIA_FILE, zipDir } from '../scripts/web-update.mjs';
import { BUILD_INPUT } from '../vite.config.js';

const ROOT = new URL('..', import.meta.url).pathname;
const read = (p) => readFileSync(join(ROOT, p), 'utf8');
/** A picture: under 150 KB; a before / after pair under 260 KB; the whole folder under 60 MB. */
export const MAX_FILE = 150 * 1024, MAX_PAIR = 260 * 1024, MAX_TOTAL = 60 * 1024 * 1024;

test('every media entry matches exactly one line of its version', () => {
  for (const [v, list] of Object.entries(CHANGELOG_MEDIA)) {
    const entry = CHANGELOG.find((e) => e.v === v);
    assert.ok(entry, `no version ${v}`);
    for (const m of list) {
      const hits = entry.items.filter((i) => lineText(i).startsWith(m.match));
      assert.equal(hits.length, 1, `${v}: “${m.match}” matches ${hits.length} lines`);
      assert.ok(m.shots?.length || m.numbers?.length || m.see, `${v}: “${m.match}” shows nothing`);
    }
    const names = list.flatMap((m) => (m.shots ?? []).map((s) => s.name));
    assert.equal(new Set(names).size, names.length, `${v}: a picture name used twice`);
  }
});

test('every picture exists, as WebP, and stays small', () => {
  let total = 0;
  for (const [v, list] of Object.entries(CHANGELOG_MEDIA)) for (const m of list) for (const s of m.shots ?? []) {
    assert.ok(s.caption, `${v}/${s.name}: a caption`);
    assert.ok(s.view || s.from, `${v}/${s.name}: a view to take it from, or where a picture made by hand came from`);
    let pair = 0;
    for (const f of Object.values(shotFiles(v, s)).filter(Boolean)) {
      const path = join(ROOT, f);
      assert.ok(existsSync(path), `${f} is missing: node scripts/changelog-shots.mjs --only ${v}/${s.name}`);
      const b = readFileSync(path);
      assert.equal(b.subarray(8, 12).toString(), 'WEBP', `${f} is a WebP`);
      assert.ok(b.length <= MAX_FILE, `${f} is ${(b.length / 1024).toFixed(0)} KB (at most ${MAX_FILE / 1024})`);
      pair += b.length;
    }
    assert.ok(pair <= MAX_PAIR, `${v}/${s.name}: the pair is ${(pair / 1024).toFixed(0)} KB`);
    total += pair;
  }
  assert.ok(total <= MAX_TOTAL, `the pictures are ${(total / 2 ** 20).toFixed(1)} MB in all`);
});

test('no picture in changelog-media/ that no line shows', () => {
  if (!existsSync(join(ROOT, MEDIA_DIR))) return;
  const used = new Set(Object.entries(CHANGELOG_MEDIA).flatMap(([v, list]) => list.flatMap((m) => (m.shots ?? []).flatMap((s) => Object.values(shotFiles(v, s)).filter(Boolean)))));
  for (const v of readdirSync(join(ROOT, MEDIA_DIR))) for (const f of readdirSync(join(ROOT, MEDIA_DIR, v))) {
    assert.ok(used.has(`${MEDIA_DIR}/${v}/${f}`), `${MEDIA_DIR}/${v}/${f} is shown by no line`);
  }
});

test('the pictures are the site’s alone: never in the build, the update zip, the APK or the Deck', async () => {
  assert.ok(!existsSync(join(ROOT, 'public', MEDIA_DIR)), 'not in public/ (Vite would build it into every package)');
  // the update zip (and so the Deck's and the Android app's updates) skips them even if they were in dist/
  const dist = mkdtempSync(join(tmpdir(), 'cl-media-'));
  writeFileSync(join(dist, 'index.html'), '<!doctype html>');
  mkdirSync(join(dist, MEDIA_DIR, '0.79'), { recursive: true });
  writeFileSync(join(dist, MEDIA_DIR, '0.79', 'x-after.webp'), 'RIFF');
  const skip = (n) => MEDIA_FILE.test(n);
  const { names } = await zipDir(dist, { skip });
  assert.deepEqual(names, ['index.html']);
  assert.ok(read('scripts/web-update.mjs').includes('MEDIA_FILE.test(n)'), 'writeUpdate skips them');
  assert.match(read('scripts/package-steam-deck.mjs'), /!siteOnly\(fromDist\(src\)\)/, 'the Deck package leaves them out (scripts/site-only.mjs)');
  assert.match(read('.github/workflows/android.yml'), /node scripts\/site-only\.mjs dist[\s\S]*npx cap sync android/, 'the APK leaves them out (scripts/site-only.mjs)');
  // the site gets them after the zip and the Deck's runtime are made, before the deploy
  const cf = read('.github/workflows/cloudflare.yml');
  const at = (s) => { const i = cf.indexOf(s); assert.ok(i >= 0, s); return i; };
  assert.ok(at('node scripts/web-update.mjs') < at('cp -R changelog-media dist/changelog-media'));
  assert.ok(at('node scripts/deck-runtime.mjs') < at('cp -R changelog-media dist/changelog-media'));
  assert.ok(at('cp -R changelog-media dist/changelog-media') < at('npx wrangler deploy'));
});

test('a line may carry its own pictures: the panel, changelog.md and the release notes keep its words only', () => {
  const entries = [{ v: '9.9', date: '2099-01-01', items: ['Plain words.', { text: 'With a picture.', shots: [{ name: 'x', caption: 'X', only: 'after' }], see: 'Look.' }] }];
  // (shown newest first: the line added last, at the end of its version, reads at the top)
  assert.match(changelogMarkdown(entries), /- With a picture\.\n- Plain words\.\n/);
  assert.deepEqual(releaseNotes(entries[0]), ['With a picture.', 'Plain words.']);
  const [e] = changelogEntries(entries, {});
  assert.equal(e.lines[0].text, 'With a picture.');
  assert.equal(e.lines[0].see, 'Look.');
  assert.equal(e.lines[0].shots[0].after, `${MEDIA_DIR}/9.9/x-after.webp`);
  assert.equal(e.lines[0].shots[0].before, null);
  assert.equal(mediaFor('9.9', 'Plain words.', {}), null);
  assert.equal(lineText({ text: 'a' }), 'a');
});

test('lines are tagged by their words, and the filters and the search find them', () => {
  assert.ok(tagsOf('In Vael II the needle spires…').includes('vael2'));
  assert.ok(!tagsOf('In Vael II the needle spires…').includes('vael'));
  assert.ok(tagsOf('On handhelds the City-Shaft runs smoother').includes('perf'));
  assert.ok(tagsOf('Bako’s bag hangs over his cloak').includes('characters'));
  assert.ok(tagsOf('The Steam Deck gets its own Graphics setting').includes('devices'));
  const line = { v: '0.79', text: 'The Signal Market’s back alleys are crowded', tags: tagsOf('The Signal Market’s back alleys'), shots: [{ caption: 'An alley' }], numbers: [], see: null };
  assert.ok(matches(line, { kind: 'shots', worlds: ['market'], words: 'alley' }));
  assert.ok(!matches(line, { kind: 'numbers' }));
  assert.ok(!matches(line, { worlds: ['desert'] }));
  assert.ok(!matches(line, { words: 'cloud' }));
  assert.ok(matches(line, { words: 'v0.79 alleys' }));
});

test('the numbers: ranges by their middle, the change the better way or not', () => {
  assert.equal(valueOf('17–25'), 21);
  assert.equal(valueOf(3.5), 3.5);
  assert.equal(valueOf('—'), null);
  assert.deepEqual(delta({ before: 25.7, after: 22.8 }, 'lower').good, true);
  assert.deepEqual(delta({ before: '17–25', after: '44–60' }, 'higher').good, true);
  assert.deepEqual(delta({ before: 10, after: 12 }, 'lower').good, false);
});

test('pictures beside the page on the site and a dev server, from the site in a bundled game', () => {
  const at = (href) => new URL(href);
  assert.equal(mediaSrc('changelog-media/0.79/a-after.webp', at('https://memento.alexandria-rnaud.workers.dev/changelog.html')), 'changelog-media/0.79/a-after.webp');
  assert.equal(mediaSrc('changelog-media/0.79/a-after.webp', at('http://127.0.0.1:5432/changelog.html')), 'changelog-media/0.79/a-after.webp');
  for (const app of ['http://127.0.0.1:41730/changelog.html', 'https://localhost/changelog.html', 'moebius://game/changelog.html']) {
    assert.equal(mediaSrc('changelog-media/0.79/a-after.webp', at(app)), `${MEDIA_SITE}changelog-media/0.79/a-after.webp`, app);
  }
});

test('the page is built, and the game’s changelog opens it', () => {
  assert.ok(Object.values(BUILD_INPUT).some((p) => p.endsWith('/changelog.html')), 'vite builds changelog.html');
  assert.match(read('changelog.html'), /src="\/src\/changelog-page\/main\.js"/);
  const panel = read('src/changelog.js');
  assert.match(panel, /data-a="pictures"/);
  assert.match(panel, /PICTURES_PAGE}\?embed=1/);
  assert.match(read('src/main.js'), /changelog\.pad\(name\)/, 'the controller goes to the page while it is up');
  assert.ok(statSync(join(ROOT, 'docs/systems/changelog.md')).size > 0, 'docs/systems/changelog.md');
});
