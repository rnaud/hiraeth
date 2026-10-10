// The audits page's dashboard (src/audits-page/themes.js, dashboard.js; docs/systems/ui.md "The audits page"):
// the latest report of every theme, the changes since the one before, each kind's parser on the real reports in
// docs/audits/, the cards' HTML and the controller's wiring.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { auditsData } from '../scripts/audits-data.mjs';
import { budgetStatus, headlineFigure, itemDeltas, itemKey, latestByTheme, PARSERS, severityCounts, tablesOf, THEME_ORDER } from '../src/audits-page/themes.js';
import { dashboardHtml, shortLabel, themeCard, trendHtml, viewTabs, VIEWS } from '../src/audits-page/dashboard.js';
import { parseRoute, routeHash } from '../src/audits-page/view.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const { reports } = auditsData();
const themes = latestByTheme(reports);
const theme = (k) => themes.find((t) => t.kind === k);
const group = (k, title) => theme(k).groups.find((g) => g.title === title);
const near = (a, b, eps = 0.011) => Math.abs(a - b) <= eps;
const avg = (v) => v.reduce((a, b) => a + b, 0) / v.length;

test('one card per theme, each its latest report (versions compared as numbers: v1.21 after v1.4)', () => {
  const kinds = [...new Set(reports.map((r) => r.kind))];
  assert.equal(themes.length, kinds.length);
  for (const k of kinds) assert.ok(theme(k), `${k} has a card`);
  for (const k of ['game', 'combat', 'level-design', 'temple-design', 'visual', 'temple-visuals', 'ink-lines', 'cinematics', 'perf']) assert.ok(THEME_ORDER.includes(k));
  assert.deepEqual(themes.map((t) => t.kind).filter((k) => THEME_ORDER.includes(k)), THEME_ORDER.filter((k) => kinds.includes(k)), 'in the dashboard\'s order');
  assert.equal(theme('visual').latest.id, 'visual-v1.21');
  assert.equal(theme('game').latest.id, 'game-v1.0');
  assert.equal(theme('cinematics').latest.id, 'cinematics-v1.6');
  for (const t of themes) {
    const same = reports.filter((r) => r.kind === t.kind);
    assert.equal(t.history.length, same.length, `${t.kind}: every version in its history`);
    assert.equal(t.history.at(-1).id, t.latest.id, `${t.kind}: the history ends with the latest`);
    const top = Math.max(...same.map((r) => +r.version.split('.')[1] + 1000 * +r.version.split('.')[0]));
    assert.equal(+t.latest.version.split('.')[1] + 1000 * +t.latest.version.split('.')[0], top, `${t.kind}: the highest version`);
  }
  // a new report of a kind becomes its card at once
  const fake = { ...reports.find((r) => r.id === 'combat-v1.22'), id: 'combat-v1.40', version: '1.40', overall: 4.6 };
  const t2 = latestByTheme([...reports, fake]).find((t) => t.kind === 'combat');
  assert.equal(t2.latest.id, 'combat-v1.40');
  assert.equal(t2.prev.id, 'combat-v1.22');
  assert.equal(t2.delta, 0.09);
});

test('the change since the one before: overall, and each item since the last time it was judged', () => {
  assert.equal(theme('combat').prev.id, 'combat-v1.18'); assert.equal(theme('combat').delta, 0.01);
  assert.equal(theme('level-design').prev.id, 'level-design-v1.20'); assert.equal(theme('level-design').delta, 0.13);
  assert.equal(theme('temple-design').delta, 0.03);
  assert.equal(theme('game').delta, 0.3);
  assert.equal(theme('dialogue').prev, null, 'the first of its kind'); assert.equal(theme('dialogue').delta, null);
  assert.equal(theme('visual').prev.id, 'visual-v1.4', 'a theme with no score still has the one before'); assert.equal(theme('visual').delta, null);
  for (const t of themes) for (let i = 1; i < t.history.length; i++) {
    const h = t.history[i], before = t.history.slice(0, i).reverse().find((x) => x.overall != null);
    if (h.overall != null && before) assert.ok(near(h.delta, h.overall - before.overall, 0.001), `${h.id}'s delta`);
  }

  const desert = group('level-design', 'Worlds').rows.find((r) => r.label === 'The Desert');
  assert.deepEqual([desert.value, desert.from, desert.fromVersion, desert.delta], [4, 3.89, '1.20', 0.11]);
  // combat v1.18 judged three archetypes: the others are compared with the batch that judged them
  const arche = group('combat', 'Archetypes').rows;
  assert.equal(arche.find((r) => r.key === 'shellback crab').fromVersion, '1.8');
  assert.equal(arche.find((r) => r.key === 'bellows toad').fromVersion, '1.13');
  assert.equal(arche.find((r) => r.key === 'shade').fromVersion, '1.18');
  assert.ok(group('combat', 'Guardians').rows.every((r) => r.fromVersion === '1.6'), 'the guardians were last scored at v1.6');
  const themesGame = group('game', 'Themes').rows;
  assert.equal(themesGame.find((r) => /^Quality/.test(r.label)).delta, -1);
  // fewer findings is better: the visual audit's counts
  const vis = group('visual', 'Findings by severity');
  assert.equal(vis.better, 'lower');
  assert.equal(vis.rows.find((r) => r.label === 'only when looking').delta, 1);

  // a renamed row is matched by its id aside, "(arzach2)"
  const now = [{ title: 'Temples', type: 'score', better: 'higher', rows: [{ ...itemKey('Belfry of the Founders (arzach2)'), label: 'x', value: 4 }] }];
  const before = [{ version: '1.0', theme: { groups: [{ title: 'Temples', type: 'score', rows: [{ ...itemKey("Founders' Belfry (arzach2)"), value: 3.5 }] }] } }];
  assert.equal(itemDeltas(now, before)[0].rows[0].delta, 0.5);
  assert.equal(itemDeltas(now, [])[0].rows[0].delta, undefined, 'nothing to compare with');
});

test('the parsers on the real reports: each kind\'s items add up to its overall', () => {
  const arche = group('combat', 'Archetypes').rows, guards = group('combat', 'Guardians').rows;
  assert.equal(arche.length, 21); assert.equal(guards.length, 11);
  assert.ok(near(avg([...arche, ...guards].map((r) => r.value)), theme('combat').latest.overall, 0.02), 'the 32 totals\' mean');
  const worlds = group('level-design', 'Worlds').rows;
  assert.equal(worlds.length, 11);
  assert.ok(near(avg(worlds.map((r) => r.value)), theme('level-design').latest.overall));
  const temples = group('temple-design', 'Temples').rows;
  assert.equal(temples.length, 11, 'the eleven temples (not the changed temples\' table)');
  assert.ok(near(avg(temples.map((r) => r.value)), theme('temple-design').latest.overall));
  assert.ok(temples.some((r) => r.alt === 'arzach2'), 'the temple\'s id is its alternative key');
  assert.equal(group('game', 'Themes').rows.length, 12);
  const areas = group('dialogue', 'Areas').rows;
  assert.equal(areas.length, 12); assert.ok(near(avg(areas.map((r) => r.value)), theme('dialogue').latest.overall));
  const scenes = group('ink-lines', 'Scenes').rows;
  assert.equal(scenes.length, 13);
  assert.ok(near(avg(scenes.map((r) => r.value)), theme('ink-lines').latest.overall), 'each scene the mean of its resolutions');
  const worldsCine = group('cinematics', 'By world').rows;
  assert.equal(worldsCine.reduce((n, r) => n + +r.text, 0), 91, 'the 91 cinematics, by world');
  assert.ok(worldsCine.some((r) => r.label === 'desert') && worldsCine.some((r) => r.label === 'prologue'));
  // (v1.39: the merged and dismissed worlds' arrivals, the Hangar's signal and recordings 10-11 out, the Glass Dunes' clock in)
  // (v1.40: the three new worlds' climaxes, chests and gifts, and recordings 10-12: 12 verdicts more, not reviewed yet)
  assert.equal(group('cinematics', 'Verdicts').rows.reduce((n, r) => n + r.value, 0), 99, 'the QC notes\' verdicts: the 91, v1.38\'s two new chests (not reviewed yet), less v1.39\'s five gone, v1.40\'s twelve');

  const perf = theme('perf');
  assert.deepEqual(perf.latest.theme.figure, { text: '2/5', sub: 'budgets over' });
  assert.deepEqual(group('perf', 'Budgets').rows.map((r) => r.status), ['over', 'over', 'unmeasured', 'ok', 'unmeasured']);
  assert.deepEqual(theme('visual').latest.theme.figure, { text: '7', sub: 'findings' });
  assert.deepEqual(group('visual', 'Findings by severity').rows.map((r) => [r.label, r.value]), [['breaks the picture', 0], ['noticeable', 2], ['only when looking', 3], ['look', 2]]);
  assert.deepEqual(theme('temple-visuals').latest.theme.figure, { text: '11/11', sub: 'temples' });
  const cost = group('temple-visuals', 'Frame time').rows;
  assert.equal(cost.length, 8); assert.match(cost[0].text, /→ .* ms$/); assert.match(cost[0].label, /· High$/);

  // every report has its theme; every scored one a score group with its rows
  for (const r of reports) {
    assert.ok(r.theme && Array.isArray(r.theme.groups), `${r.id}: a theme`);
    if (r.overall != null) assert.ok(r.theme.groups.some((g) => g.type === 'score' && g.rows.length), `${r.id}: its items`);
    else assert.ok(r.theme.figure || r.theme.groups.length, `${r.id}: a figure or items`);
    for (const g of r.theme.groups) for (const row of g.rows) if (g.type === 'score') assert.ok(row.value >= 1 && row.value <= 5, `${r.id} ${row.label}`);
  }
  assert.ok(Object.keys(PARSERS).length >= 10);
});

test('the parsers\' pieces', () => {
  assert.deepEqual(itemKey("Founders' Belfry (arzach2)"), { key: 'founders belfry', alt: 'arzach2' });
  assert.deepEqual(itemKey('the Keeper of the cistern'), { key: 'keeper of the cistern', alt: '' });
  assert.deepEqual(itemKey('lantern jelly (with its blot)'), { key: 'lantern jelly', alt: '' });
  assert.deepEqual(headlineFigure('2 of 4 budgets over (the City-Shaft)'), { text: '2/4', sub: 'budgets' });
  assert.equal(headlineFigure('no numbers'), null);
  assert.deepEqual(severityCounts('0 breaks the picture, 2 noticeable, 1 only when looking (the first baseline)'), [{ label: 'breaks the picture', value: 0 }, { label: 'noticeable', value: 2 }, { label: 'only when looking', value: 1 }]);
  assert.equal(budgetStatus('**Over** in the City-Shaft'), 'over');
  assert.equal(budgetStatus('Not measured. The last …'), 'unmeasured');
  assert.equal(budgetStatus('v1.0 is +0.3% over v0.97'), 'ok', '"over" later in the cell is not a verdict');
  const t = tablesOf('## A\n\n| x | y |\n|---|---|\n| a | 3 |\n\n```\n| not | a table |\n|---|---|\n```\n### B\n| k | v |\n|---|---|\n| b | 2 |');
  assert.deepEqual(t.map((x) => x.heading), ['A', 'B']);
  assert.equal(shortLabel("Founders' Belfry (arzach2)"), "Founders' Belfry");
});

test('the cards: score, change, items, the link to the full audit, History behind a toggle', () => {
  const html = dashboardHtml(themes);
  assert.equal((html.match(/<article class="theme/g) ?? []).length, themes.length);
  for (const t of themes) {
    const card = themeCard(t);
    assert.ok(card.includes(`href="#/${t.latest.id}"`), `${t.kind}: opens its latest report`);
    assert.ok(card.includes(`v${t.latest.version}`) && card.includes(t.latest.date), `${t.kind}: version and date`);
    if (t.history.length > 1) {
      assert.match(card, new RegExp(`data-history="${t.kind}" aria-expanded="false"`));
      assert.match(card, /data-glyph="y"/);
      assert.match(card, /class="history"[^>]* hidden/);
      for (const h of t.history) assert.ok(card.includes(`href="#/${h.id}"`), `${t.kind}: history opens ${h.id}`);
    }
  }
  assert.match(themeCard(theme('combat')), /▲ \+0\.01 <small>since v1\.18/);
  assert.match(themeCard(theme('combat')), /class="theme wide"/, 'a card of many items spans two columns');
  assert.match(themeCard(theme('dialogue')), /the first dialogue audit/);
  assert.match(themeCard(theme('perf')), /2\/4/);
  assert.doesNotMatch(themeCard(theme('combat'), { open: true }), /class="history"[^>]* hidden/);
  assert.match(trendHtml(theme('level-design').history), /<path d="M/);
  assert.equal(trendHtml([{ version: '1', overall: 3 }]), '');
  assert.match(viewTabs('latest', 31), /data-glyph="lb".*data-view="latest" aria-selected="true".*data-view="all".*31.*data-glyph="rb"/s);
  assert.deepEqual(VIEWS.map((v) => v.id), ['latest', 'all']);
});

test('routes and the controller: the dashboard by default, All audits behind LB / RB, Y a card\'s history, B back', () => {
  assert.equal(parseRoute('').view, 'latest');
  assert.equal(parseRoute('#/all').view, 'all');
  assert.equal(parseRoute('#/all').id, null);
  assert.equal(routeHash({ view: 'all' }), '#/all');
  assert.equal(routeHash(parseRoute('#/all')), '#/all');
  assert.equal(routeHash({}), '#/');
  const main = read('src/audits-page/main.js');
  for (const s of ['latestByTheme(reports)', 'drawDashboard()', 'stepView(d)', "name === 'y' && !state.route.id", 'toggleHistory(k)', "go({ view: state.view })", "if (state.route.view === 'all') return go({})", "dataset.view", 'data-view', "'h'"]) assert.ok(main.includes(s), `main.js: ${s}`);
  const html = read('audits.html');
  assert.match(html, /body\[data-view="latest"\] #index/);
  assert.match(html, /\.theme \{[^}]*box-shadow: 5px 5px 0 var\(--ink\)/, 'the house\'s offset shadow');
  assert.match(html, /\.theme-open:focus \{[^}]*outline/, 'the pad\'s focus shows');
  assert.match(read('scripts/audits-data.mjs'), /r\.theme = themeOf\(r, md\)/, 'the parsers run where the data is built');
});
