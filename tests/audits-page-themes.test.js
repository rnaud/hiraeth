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
  for (const k of ['game', 'combat', 'level-design', 'temple-design', 'visual', 'temple-visuals', 'ink-lines', 'cinematics', 'quest', 'perf', 'zfight', 'shadow', 'motion', 'camera', 'procedural-animation']) assert.ok(THEME_ORDER.includes(k));
  assert.deepEqual(themes.map((t) => t.kind).filter((k) => THEME_ORDER.includes(k)), THEME_ORDER.filter((k) => kinds.includes(k)), 'in the dashboard\'s order');
  assert.equal(theme('visual').latest.id, 'visual-v1.87');
  assert.equal(theme('game').latest.id, 'game-v1.87');
  assert.equal(theme('cinematics').latest.id, 'cinematics-v1.87');   // (the fourth full pass, issue #556; the v1.6 baseline stays in docs/systems/cinematics-qc.md)
  for (const t of themes) {
    const same = reports.filter((r) => r.kind === t.kind);
    assert.equal(t.history.length, same.length, `${t.kind}: every version in its history`);
    assert.equal(t.history.at(-1).id, t.latest.id, `${t.kind}: the history ends with the latest`);
    const top = Math.max(...same.map((r) => +r.version.split('.')[1] + 1000 * +r.version.split('.')[0]));
    assert.equal(+t.latest.version.split('.')[1] + 1000 * +t.latest.version.split('.')[0], top, `${t.kind}: the highest version`);
  }
  // a new report of a kind becomes its card at once
  const fake = { ...reports.find((r) => r.id === 'combat-v1.87'), id: 'combat-v1.90', version: '1.90', overall: 4.6 };
  const t2 = latestByTheme([...reports, fake]).find((t) => t.kind === 'combat');
  assert.equal(t2.latest.id, 'combat-v1.90');
  assert.equal(t2.prev.id, 'combat-v1.87');
  assert.equal(t2.delta, 0.09);
});

test('the change since the one before: overall, and each item since the last time it was judged', () => {
  assert.equal(theme('combat').prev.id, 'combat-v1.61'); assert.equal(theme('combat').delta, 0);   // (combat-v1.87: 4.51, combat-v1.61: 4.51 in its block; issue #556)
  assert.equal(theme('level-design').prev.id, 'level-design-v1.85'); assert.equal(theme('level-design').delta, 0.05);   // (level-design-v1.87: 4.73, v1.85: 4.68, both over twelve; issue #556)
  assert.equal(theme('temple-design').prev.id, 'temple-design-v1.85'); assert.equal(theme('temple-design').delta, 0);   // (temple-design-v1.87: 4.4 after #477's three reworks, as v1.85: 4.4, both over fourteen; issue #556)
  assert.equal(theme('game').delta, 0.1);   // (game-v1.87: 4.2, game-v1.85: 4.1)
  assert.equal(theme('dialogue').prev.id, 'dialogue-v1.66'); assert.equal(theme('dialogue').delta, 0.09);   // (dialogue-v1.87: 4.18 over eleven, v1.66: 4.09 over eleven; issue #556)
  const lore = group('dialogue', 'Areas').rows.find((r) => r.label === 'Lore load');
  assert.deepEqual([lore.value, lore.from], [4, 3.5], 'an area compared with the review before (v1.87: the near names renamed, #281)');
  assert.ok(!group('dialogue', 'Areas').rows.some((r) => r.label === 'Localisation'), 'v1.53, v1.57, v1.66 and v1.87 left localisation unscored (out of scope)');
  assert.equal(theme('visual').prev.id, 'visual-v1.85', 'a theme with no score still has the one before'); assert.equal(theme('visual').delta, null);
  for (const t of themes) for (let i = 1; i < t.history.length; i++) {
    const h = t.history[i], before = t.history.slice(0, i).reverse().find((x) => x.overall != null);
    if (h.overall != null && before) assert.ok(near(h.delta, h.overall - before.overall, 0.001), `${h.id}'s delta`);
  }

  const desert = group('level-design', 'Worlds').rows.find((r) => r.label === 'The Desert');
  assert.deepEqual([desert.value, desert.from, desert.fromVersion, desert.delta], [4.22, 4.22, '1.85', 0]);   // (v1.87: unchanged since v1.85, its 263 m blind leg still)
  const viridel = group('level-design', 'Worlds').rows.find((r) => r.label === 'Viridel');
  assert.deepEqual([viridel.value, viridel.from, viridel.delta], [5, 5, 0], 'a world compared by its row\'s name (5 at v1.66, v1.85 and v1.87)');
  const dunes = group('level-design', 'Worlds').rows.find((r) => r.label === 'The Glass Dunes');
  assert.deepEqual([dunes.value, dunes.from], [4.67, 4.22], 'v1.87: the west on posts, Fenna\'s errand (#475)');
  // combat v1.87 judged the whole roster again (issue #556): each is compared with the last report that judged it (v1.61,
  // the same 22 kinds and 14 guardians; the ember wisp new); the hound back to 4.5 (v1.63's follow-up), five guardians' reach
  const arche = group('combat', 'Archetypes').rows;
  assert.equal(arche.find((r) => r.key === 'shellback crab').fromVersion, '1.61');
  assert.equal(arche.find((r) => r.key === 'bellows toad').delta, 0);
  const hound = arche.find((r) => r.key === 'antler hound');
  assert.deepEqual([hound.value, hound.fromVersion], [4.5, '1.61']); assert.ok(hound.delta > 0);
  assert.equal(arche.find((r) => r.key === 'ember wisp').delta, undefined, 'a kind no earlier report judged');
  const guardRows = group('combat', 'Guardians').rows;
  assert.ok(guardRows.every((r) => r.fromVersion === '1.61'), 'the guardians were last scored at v1.61');
  assert.ok(guardRows.find((r) => r.label === 'the Gardener').delta < 0, 'its reach past its body (#558)');
  const themesGame = group('game', 'Themes').rows;
  assert.equal(themesGame.find((r) => /^Arc/.test(r.label)).delta, 0);   // (game-v1.87: arc and pacing 4 → 4)
  assert.equal(themesGame.find((r) => /^Exploration/.test(r.label)).delta, 0);   // (game-v1.87: exploration and wayfinding 5 → 5)
  assert.equal(themesGame.find((r) => /^Quality/.test(r.label)).delta, 0);   // (game-v1.87: quality 3 → 3)
  assert.equal(themesGame.find((r) => /^Core/.test(r.label)).delta, 1);   // (game-v1.87: core experience 3 → 4, the fight temples and the fragments in the story)
  // fewer findings is better: the visual audit's counts
  const vis = group('visual', 'Findings by severity');
  assert.equal(vis.better, 'lower');
  assert.equal(vis.rows.find((r) => r.label === 'only when looking').delta, 1);   // (v1.85: 2, v1.87: 3)
  assert.equal(vis.rows.find((r) => r.label === 'look').delta, -1);   // (v1.85: 6, v1.87: 5)

  // a renamed row is matched by its id aside, "(arzach2)"
  const now = [{ title: 'Temples', type: 'score', better: 'higher', rows: [{ ...itemKey('Belfry of the Founders (arzach2)'), label: 'x', value: 4 }] }];
  const before = [{ version: '1.0', theme: { groups: [{ title: 'Temples', type: 'score', rows: [{ ...itemKey("Founders' Belfry (arzach2)"), value: 3.5 }] }] } }];
  assert.equal(itemDeltas(now, before)[0].rows[0].delta, 0.5);
  assert.equal(itemDeltas(now, [])[0].rows[0].delta, undefined, 'nothing to compare with');
});

test('the parsers on the real reports: each kind\'s items add up to its overall', () => {
  const arche = group('combat', 'Archetypes').rows, guards = group('combat', 'Guardians').rows;
  assert.equal(arche.length, 23); assert.equal(guards.length, 14);
  assert.ok(near(avg([...arche, ...guards].map((r) => r.value)), theme('combat').latest.overall, 0.02), 'the 37 totals\' mean');
  const worlds = group('level-design', 'Worlds').rows;
  assert.equal(worlds.length, 12, 'the twelve route worlds (v1.49)');
  assert.ok(near(avg(worlds.map((r) => r.value)), theme('level-design').latest.overall));
  const temples = group('temple-design', 'Temples').rows;
  assert.equal(temples.length, 14, 'the fourteen temples (v1.48; not a changed temples\' table)');
  assert.ok(near(avg(temples.map((r) => r.value)), theme('temple-design').latest.overall));
  // the fight temples' combat (issue #482): a kind of its own beside combat, its card after it, a row a fight temple
  const fights = group('combat-fight-temples', 'Temples').rows;
  assert.equal(fights.length, 12, 'the twelve fight temples (v1.85)');
  assert.ok(near(avg(fights.map((r) => r.value)), theme('combat-fight-temples').latest.overall));
  assert.equal(THEME_ORDER.indexOf('combat-fight-temples'), THEME_ORDER.indexOf('combat') + 1, 'its card beside the combat review\'s');
  assert.ok(temples.some((r) => r.alt === 'arzach2'), 'the temple\'s id is its alternative key');
  assert.equal(group('game', 'Themes').rows.length, 12);
  const areas = group('dialogue', 'Areas').rows;
  assert.equal(areas.length, 11); assert.ok(near(avg(areas.map((r) => r.value)), theme('dialogue').latest.overall));
  // the quest QC's third report (v1.87, issue #556): the fourteen places of v1.66 and the fight temples and the ports, the seven rules' mean each
  const places = group('quest', 'Items').rows;
  assert.equal(theme('quest').name, 'Quest QC');
  assert.equal(places.length, 16); assert.ok(near(avg(places.map((r) => r.value)), theme('quest').latest.overall));
  const scenes = group('ink-lines', 'Scenes').rows;
  assert.equal(scenes.length, 16, 'v1.53: the 13 of v1.34 and the three worlds that joined in v1.40');
  assert.ok(near(avg(scenes.map((r) => r.value)), theme('ink-lines').latest.overall), 'each scene the mean of its resolutions');
  const worldsCine = group('cinematics', 'By world').rows;
  assert.equal(worldsCine.reduce((n, r) => n + +r.text, 0), 112, 'the 112 cinematics of the v1.87 pass, by world (the side worlds\' arrivals left out, the temple endings in)');
  assert.ok(worldsCine.some((r) => r.label === 'desert') && worldsCine.some((r) => r.label === 'prologue'));
  // (v1.39: the merged and dismissed worlds' arrivals, the Hangar's signal and recordings 10-11 out, the Glass Dunes' clock in)
  // (v1.40: the three new worlds' climaxes, chests and gifts, and recordings 10-12: 12 verdicts more, not reviewed yet)
  // (v1.43: the merged worlds' second stories' own recordings, the bell and the lamp: 2 more; the new worlds' films reviewed)
  // (v1.44: the Rose House's two chests, the blade's and the guard's, in the ember's place, and ember mode's in the Hearth: 2 more)
  // (v1.45: ember mode comes with the gun, in its chest: its own chest's verdict gone, 1 less)
  // (v1.48: the three new worlds' makers' courts, a chest each behind its gate: 3 more)
  // (v1.52: the City-Shaft's light-down chest on the bottom terrace, issue #169: 1 more, not reviewed yet)
  // (v1.65: the Desert's tree lit, filmed from afar, issue #239: 1 more)
  // (v1.85: the fourteen temple endings on the review page and looked at, issue #490: 14 more)
  // (v1.86: the Signal Market's makers' court, a chest behind its gate at last, issue #518: 1 more, not reviewed yet)
  assert.equal(group('cinematics', 'Verdicts').rows.reduce((n, r) => n + r.value, 0), 119, 'the QC notes\' verdicts (v1.85\'s fourteen temple endings, v1.86’s Signal Market court chest; less v1.80\'s three court boxes gone, issue #375: their gadgets earned in the temples): the 91, v1.38\'s two new chests, less v1.39\'s five gone, v1.40\'s twelve, v1.43\'s two part recordings, v1.44\'s two, less v1.45\'s ember chest (with the gun now), v1.48\'s three court chests, v1.52\'s light-down chest');

  const perf = theme('perf');
  // (perf-v1.87, issue #556: the Retroid and the Deck not measured (busy with #536), High's p95 over at the desert's
  // spawn (#564), the loads not measured on a quiet machine)
  assert.deepEqual(perf.latest.theme.figure, { text: '1/6', sub: 'budgets over' });
  assert.deepEqual(group('perf', 'Budgets').rows.map((r) => r.status), ['unmeasured', 'unmeasured', 'over', 'unmeasured', 'ok', 'ok']);
  assert.deepEqual(theme('visual').latest.theme.figure, { text: '9', sub: 'findings' });
  assert.deepEqual(group('visual', 'Findings by severity').rows.map((r) => [r.label, r.value]), [['breaks the picture', 0], ['noticeable', 1], ['only when looking', 3], ['look', 5]]);
  assert.deepEqual(theme('temple-visuals').latest.theme.figure, { text: '11/11', sub: 'temples' });
  // (v1.66, issue #226: the QC skills' first reports, each its own card: a figure from the headline's "N of M", the
  // creatures' review a score a walker)
  // (v1.85, issue #467: zfight, shadow and camera ran again; v1.87, issue #556: all five, and the sound's first report)
  for (const k of ['zfight', 'shadow', 'camera', 'motion', 'procedural-animation', 'sound']) assert.equal(theme(k).latest.version, '1.87', `${k}: its v1.87 report`);
  assert.deepEqual(theme('zfight').latest.theme.figure, { text: '14/14', sub: 'temples' });
  assert.deepEqual(theme('shadow').latest.theme.figure, { text: '52/60', sub: 'spots' });
  assert.deepEqual(theme('camera').latest.theme.figure, { text: '17/17', sub: 'scenarios' });
  assert.deepEqual(theme('motion').latest.theme.figure, { text: '16/16', sub: 'node' });
  assert.deepEqual(theme('sound').latest.theme.figure, { text: '103/116', sub: 'actions' });
  const walkers = group('procedural-animation', 'Items').rows;
  assert.equal(walkers.length, 24, 'the 24 walkers (the Aerie’s new Elder measured after the rebase)');
  assert.ok(near(avg(walkers.map((r) => r.value)), theme('procedural-animation').latest.overall), 'the overall the mean of the walkers');
  assert.ok(walkers.some((r) => r.alt === 'keeper v1') && walkers.some((r) => r.alt === 'elder v1'), 'the Tripo skins by their ids');
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
  assert.match(themeCard(theme('combat')), /◆ ±0 <small>since v1\.61/);
  assert.match(themeCard(theme('combat')), /class="theme wide"/, 'a card of many items spans two columns');
  assert.match(themeCard(theme('dialogue')), /▲ \+0\.09 <small>since v1\.66/);
  assert.doesNotMatch(themeCard(theme('dialogue')), /the first dialogue audit/);
  assert.match(themeCard(theme('perf')), /2\/6/);
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
