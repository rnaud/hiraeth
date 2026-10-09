// The audits page (audits.html, src/audits-page/, scripts/audits-data.mjs; docs/systems/ui.md "The audits page"):
// the report parser on the real reports, the index, the comparisons, the navigation wiring, and that every report
// in docs/audits/ appears and stays off the devices.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { auditsData, linkFor, reportFiles, mediaFiles } from '../scripts/audits-data.mjs';
import { cellScore, compareAudits, readTable, scoreBlock, titleDate, todoSections, tableMean } from '../src/audits-page/parse.js';
import { toHtml, inline, splitRow } from '../src/audits-page/markdown.js';
import { TABS, cardHtml, parseRoute, routeHash, sparkline, tabHtml, tabsHtml, kindChips } from '../src/audits-page/view.js';
import { PAGES } from '../src/world-picker.js';
import { BUILD_INPUT } from '../vite.config.js';
import { siteOnly } from '../scripts/site-only.mjs';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const { reports, index } = auditsData();
const byId = (id) => reports.find((r) => r.id === id);

test('every report in docs/audits/ and the cinematics QC report appear, each with its score block', () => {
  const files = readdirSync(new URL('../docs/audits/', import.meta.url)).filter((f) => f.endsWith('.md'));
  assert.ok(files.length >= 9);
  for (const f of files) {
    const r = reports.find((x) => x.file === `docs/audits/${f}`);
    assert.ok(r, `${f} is on the page`);
    assert.ok(index.some((e) => e.id === r.id), `${f} is in the index`);
    assert.ok(r.hasBlock, `${f} starts with an audit-scores block (the skills write it)`);
    assert.match(r.date, /^\d{4}-\d{2}-\d{2}$/, `${f}: a full date`);
    assert.match(r.version, /^\d+(\.\d+)+$/, `${f}: a version`);
    assert.ok(r.overall != null || r.headline, `${f}: an overall score or a headline`);
    assert.ok(r.sections.length >= 3, `${f}: its sections`);
  }
  assert.deepEqual(reportFiles().slice(-1), ['docs/systems/cinematics-qc.md']);
  const cine = byId('cinematics-v1.6');
  assert.ok(cine, 'the cinematics QC report, as v1.6');
  assert.equal(index.length, reports.length);
});

test('the score tables are read from the real reports: criteria, totals, "before → after" and ✎', () => {
  const combat = byId('combat-v1.4');
  const [foes, guardians] = combat.scoreTables;
  assert.equal(foes.rows.length, 15);
  assert.deepEqual(foes.criteria.map((c) => foes.header[c]), ['read', 'counter', 'space', 'fair', 'identity', 'combines']);
  assert.equal(foes.header[foes.primary], 'total');
  assert.ok(!foes.scoreCols.some((c) => /ttk|wind|min/.test(foes.header[c])), 'the measurements are not scores');
  assert.equal(guardians.rows.length, 11);
  assert.equal(foes.rows.find((r) => r.label === 'sign moth').scores[foes.primary].value, 4.5);
  assert.ok(Math.abs((tableMean(foes) * 15 + tableMean(guardians) * 11) / 26 - combat.overall) < 0.01, 'the block\'s overall is the totals\' mean');

  const level = byId('level-design-v1.5');
  const t = level.scoreTables[0];
  assert.equal(t.rows.length, 11);
  assert.equal(t.criteria.length, 9);
  assert.equal(t.header[t.primary], 'Mean');
  const sky = t.rows.find((r) => /Sky Stones/.test(r.label));
  assert.deepEqual(sky.scores[t.header.indexOf('Wayfinding')], { value: 2, before: 1 }, '"1 ✎2": 2 by eye, 1 from the script');
  assert.deepEqual(sky.scores[t.primary], { value: 3.67, before: 3.56 });
  assert.ok(Math.abs(tableMean(t) - level.overall) < 0.01);

  const temple = byId('temple-design-v1.5');
  assert.equal(temple.scoreTables[0].rows.length, 11);
  assert.ok(Math.abs(tableMean(temple.scoreTables[0]) - temple.overall) < 0.01);

  const game = byId('game-v1.0').scoreTables[0];
  assert.equal(game.header[game.primary], 'v1.0');
  assert.equal(game.header[game.before], 'v0.97', 'the earlier version\'s column is the ghost');
  assert.ok(!game.scoreCols.includes(game.header.indexOf('#')), 'the theme\'s number is not a score');

  const dialogue = byId('dialogue-v1.0').scoreTables[0];
  assert.equal(dialogue.rows.length, 12);
  assert.equal(dialogue.header[dialogue.primary], 'Score');

  const cine = byId('cinematics-v1.6');
  const ct = cine.scoreTables.find((x) => x.rows.length > 80);
  assert.ok(ct, 'the cinematics table');
  assert.equal(ct.scoreCols.length, 2, 'tech and interest (not the length or the cuts)');
  const prologue = ct.rows.find((r) => r.id === 'prologue');
  assert.equal(prologue.verdict, 'Needs work', 'the review page\'s verdict, from the notes');
  assert.equal(Object.values(cine.verdicts).reduce((a, b) => a + b, 0), Object.keys(JSON.parse(read('docs/systems/cinematics-qc-notes.json')).notes).length);
  assert.ok(cine.sections.some((s) => /v1\.6/.test(s.title)), 'its passes are sections');

  assert.equal(byId('visual-v1.4').scoreTables.length, 0, 'the visual audit has no scores (its counts column is not one)');
  assert.deepEqual(byId('visual-v1.0').severities, { noticeable: 2, 'only when looking': 1 });
});

test('the parser\'s pieces', () => {
  assert.deepEqual(cellScore('**3.5**'), { value: 3.5 });
  assert.deepEqual(cellScore('2.00 → 1.89'), { value: 1.89, before: 2 });
  assert.deepEqual(cellScore('4 ✎3'), { value: 3, before: 4 });
  assert.equal(cellScore('11.5 s'), null);
  assert.equal(titleDate('Visual audit · v1.0 · 8 October 2026'), '2026-10-08');
  assert.equal(titleDate('Combat review, v1.4 (2026-10-09)'), '2026-10-09');
  assert.equal(titleDate('(October 2026, v1.0)'), '2026-10');
  assert.deepEqual(scoreBlock('# T\n<!-- audit-scores\noverall: 3.66 / 5\nlabel: x\n-->\n'), { overall: 3.66, of: 5, label: 'x' });
  assert.equal(scoreBlock('<!-- audit-scores\noverall: none\nheadline: h\n-->').overall, null);
  assert.deepEqual(splitRow('| a | `b|c` | d |'), ['a', '`b|c`', 'd']);
  const t = readTable(['| # | Theme | v0.97 | v1.0 |', '|---|---|---|---|', '| 1 | Core | 3 | 4 |', '| 2 | First | 2 | 3 |'], '1.0');
  assert.equal(t.header[t.labelCol], 'Theme');
  assert.equal(t.header[t.primary], 'v1.0');
});

test('the Markdown reader: nested lists, two kinds of list, pictures, captions, tables', () => {
  const html = toHtml('- a\n- **b:**\n  - one\n  - two\n\n1. x\n   - y\n2. z');
  assert.match(html, /<ul><li>a<\/li><li><b>b:<\/b><ul><li>one<\/li><li>two<\/li><\/ul><\/li><\/ul>/);
  assert.match(html, /<ol><li>x<ul><li>y<\/li><\/ul><\/li><li>z<\/li><\/ol>/);
  const link = linkFor('docs/audits/level-design-v1.5.md');
  const fig = toHtml('![The market](level-design-v1.5/bazaar-landing.webp)\n\n*The tower.*', { link });
  assert.match(fig, /<figure><img alt="The market" data-path="audits\/level-design-v1.5\/bazaar-landing.webp"[^>]*><figcaption>The tower.<\/figcaption><\/figure>/);
  assert.match(inline('[with](visual-v1.4/corner-halo-with.webp)', { link: linkFor('docs/audits/visual-v1.4.md') }), /<button class="thumb"[^>]*data-path="audits\/visual-v1.4\/corner-halo-with.webp"/);
  assert.equal(link('game-v0.97.md'), '#/game-v0.97');
  assert.equal(link('../what-makes-a-great-game.md'), 'https://github.com/rnaud/hiraeth/blob/main/docs/what-makes-a-great-game.md');
  assert.match(toHtml('| a | b |\n|---|---|\n| 1 | 2 |'), /<table><thead><tr><th>a<\/th><th>b<\/th><\/tr><\/thead><tbody><tr><td>1<\/td><td>2<\/td><\/tr><\/tbody><\/table>/);
  // every picture a report shows is one of its files (served from docs/audits/, written to dist/audits/)
  const files = new Set(mediaFiles().map((f) => `audits/${f.path}`));
  for (const r of reports) for (const s of r.sections) for (const m of s.html.matchAll(/data-path="([^"]+)"/g)) assert.ok(files.has(m[1]), `${r.id}: ${m[1]}`);
});

test('the TODO items each report produced', () => {
  assert.equal(byId('combat-v1.4').todo.open, 7);
  assert.ok(byId('level-design-v1.5').todo.open >= 5);
  assert.ok(byId('temple-design-v1.5').todo.sections[0].items.length >= 5);
  assert.ok(byId('cinematics-v1.6').todo.sections.length >= 1);
  const t = todoSections('# A (docs/audits/x.md)\n\n- [ ] one\n  more\n- [x] two\n\n# B\n\n- [ ] not it', ['docs/audits/x.md']);
  assert.deepEqual(t['docs/audits/x.md'][0].items.map((i) => [i.text, i.done]), [['one more', false], ['two', true]]);
});

test('the index: newest first, the change since the version before, comparisons', () => {
  const g = index.find((e) => e.id === 'game-v1.0');
  assert.equal(g.prev, 'game-v0.97');
  assert.equal(g.delta, 0.3);
  assert.deepEqual(g.history.map((h) => h.v), ['0.97', '1.0']);
  assert.equal(index.find((e) => e.id === 'game-v0.97').prev, null);
  for (let i = 1; i < index.length; i++) assert.ok(index[i - 1].date >= index[i].date, 'newest first');
  const c = compareAudits(byId('game-v0.97'), byId('game-v1.0'));
  assert.equal(c.rows.length, 12);
  assert.deepEqual(c.rows.find((r) => /Quality/.test(r.label)), { table: 'The scores', label: 'Quality, performance, discovery', from: 3, to: 2, delta: -1, criteria: [] });
  assert.equal(c.overall.delta, 0.3);
  const v = compareAudits(byId('visual-v1.0'), byId('visual-v1.4'));
  assert.ok(v.severities.some((s) => s.severity === 'noticeable'));
  assert.match(sparkline(g.history), /<path/);
});

test('the screens: every tab of every report draws; the pad\'s buttons and glyphs are wired', () => {
  for (const r of reports) {
    const entry = index.find((e) => e.id === r.id);
    assert.match(cardHtml(entry, r), /tabindex="0" data-nav/);
    for (const t of TABS) assert.ok(tabHtml(r, t.id, { entry, reports }).length > 20, `${r.id} ${t.id}`);
    const tabs = tabsHtml(r, 'scores');
    assert.match(tabs, /data-glyph="lb"/); assert.match(tabs, /data-glyph="rb"/);
  }
  assert.match(kindChips(index), /data-glyph="lb".*data-glyph="rb"/s);
  assert.match(tabHtml(byId('game-v1.0'), 'compare', { reports }), /v0\.97.*v1\.0/s);
  assert.match(tabHtml(byId('combat-v1.4'), 'compare', { reports }), /Only one combat audit/);
  for (const h of ['#/', '#/combat-v1.4', '#/game-v1.0/compare/game-v0.97', '#/level-design-v1.5/edits']) assert.equal(routeHash(parseRoute(h)), h);
  assert.deepEqual(parseRoute('#/game-v1.0/compare/game-v0.97'), { id: 'game-v1.0', tab: 'compare', other: 'game-v0.97' });

  const main = read('src/audits-page/main.js');
  for (const s of ['dataset.gridNav', 'menuNavigate', "'tabPrev'", "'tabNext'", "name === 'back'", "name === 'confirm'", "name === 'x'", 'installGlyphs()', 'mediaSrc(DATA_PATH)']) assert.ok(main.includes(s), `main.js: ${s}`);
  const html = read('audits.html');
  assert.match(html, /src="\/src\/audits-page\/main\.js"/);
  assert.match(html, /id="back"[^>]*href="\.\/\?worlds=1"/, 'B and the button go back to the Debug list');
  assert.match(html, /data-glyph="back"/);
  assert.match(html, /data-glyph="x"/); assert.match(html, /data-glyph="y"/);
});

test('the page is in the Debug list and the build; its data and pictures stay off the devices', () => {
  assert.ok(PAGES.some((p) => p.href === 'audits.html'), 'Debug → Audits');
  assert.ok(Object.values(BUILD_INPUT).some((p) => p.endsWith('/audits.html')), 'vite builds audits.html');
  assert.match(read('vite.config.js'), /auditsPlugin\(\)/);
  assert.ok(siteOnly('audits/audits.json'));
  assert.ok(siteOnly('audits/level-design-v1.5/bazaar-landing.webp'));
  assert.ok(!siteOnly('audits.html'), 'the page itself is small and ships');
  assert.ok(read('scripts/web-update.mjs').includes('AUDIT_FILE.test(n)'), 'the over-the-air zip leaves them out');
});
