import { loadMinigameModules } from './minigame-modules.js';
// The serendipity map (serendipity.html, src/serendipity-page/; issue #381; docs/systems/dev-tools.md "The serendipity
// map"): a debug page beside the others, and its data collector finding things of interest in every world it offers,
// each world built as the page builds it (world.js buildWorld: the level, the story's quests and people, the boxes).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import './register-gadgets.js';
import './playthrough-agent.js';   // (its little DOM: the story never needs a real page)
import { buildWorld, mapWorlds } from '../src/serendipity-page/world.js';
import { collectMarkers, emptiness, countByKind, walkTo, KINDS } from '../src/serendipity-page/collect.js';
import { collectGames } from '../src/minigames/kit/registry.js';
import { ORDER } from '../src/levels/names.js';
import { FRAGMENTS } from '../src/fragments-data.js';
import { PAGES } from '../src/world-picker.js';
import { BUILD_INPUT } from '../scripts/build-input.mjs';

// the games' signs, as the game has them (src/minigames/index.js reads them by import.meta.glob, which node has not)
const GAMES = collectGames(await loadMinigameModules(), () => {});

test('the serendipity map is a debug page beside the others', () => {
  assert.ok(PAGES.some((p) => p.href === 'serendipity.html' && p.label === 'Serendipity map'), 'Debug → Pages → Serendipity map');
  assert.ok(BUILD_INPUT.serendipity?.endsWith('serendipity.html'), 'built with the site');
  const html = readFileSync(new URL('../serendipity.html', import.meta.url), 'utf8');
  assert.match(html, /src="\/src\/serendipity-page\/main\.js"/);
  const main = readFileSync(new URL('../src/serendipity-page/main.js', import.meta.url), 'utf8');
  assert.ok(main.indexOf('slots.sandbox(') < main.indexOf("import('./world.js')"), 'the save sandboxed before any world module reads it');
  assert.equal(new Set(KINDS.map((k) => k.key)).size, KINDS.length);
});

test('the world picker: every world but the dev rooms, the route first', () => {
  const ids = mapWorlds().map((w) => w.id);
  assert.deepEqual(ids.slice(0, ORDER.length), ORDER);
  for (const dev of ['lab', 'arena', 'shadows', 'arcade', 'references', 'gadgetyard']) assert.ok(!ids.includes(dev), dev);
  for (const w of ['home', 'lantern']) assert.ok(ids.includes(w), w);
});

test('its data collector finds things of interest in every world, from the game\'s own data', () => {
  const lines = [];
  for (const { id } of mapWorlds()) {
    const W = buildWorld(id);
    const { markers, landing } = collectMarkers(W, { games: GAMES });
    const n = countByKind(markers);
    assert.ok(markers.length >= 3, `${id}: ${markers.length} markers`);
    assert.ok(landing && landing.every(Number.isFinite), `${id}: the landing`);
    assert.equal(n.landing, 1, `${id}: one landing`);
    for (const m of markers) {
      assert.ok(KINDS.some((k) => k.key === m.kind), `${id}: kind ${m.kind}`);
      assert.ok(m.pos.every(Number.isFinite), `${id}: ${m.kind} "${m.name}" at ${m.pos}`);
      assert.ok(m.name, `${id}: a ${m.kind} with no name`);
    }
    if (ORDER.includes(id)) {
      // a route world has its temple, its main quest, its people and its fragments
      for (const k of ['temple', 'main', 'person', 'shard']) assert.ok(n[k] > 0, `${id}: no ${k}`);
      assert.ok(n.shard >= FRAGMENTS[id].length, `${id}: every fragment of light`);
      assert.ok(markers.filter((m) => m.kind === 'main').every((m) => m.quest), `${id}: each main step names its quest`);
      // the walkable ground from the landing, and how empty it gets
      const E = emptiness(W, markers, { landing });
      assert.ok(E.reached > 50, `${id}: ${E.reached} cells walked`);
      assert.ok(E.worst && E.worst.metres >= 0, `${id}: the emptiest spot`);
      assert.ok(E.share >= 0 && E.share <= 1);
      assert.ok(walkTo(E, landing) !== null, `${id}: the landing on the walked ground`);
      lines.push(`${id}: ${markers.length} (${Object.entries(n).filter(([, v]) => v).map(([k, v]) => `${k} ${v}`).join(', ')}), emptiest ${E.worst.metres} m`);
    } else lines.push(`${id}: ${markers.length}`);
  }
  console.log(lines.join('\n'));
});
