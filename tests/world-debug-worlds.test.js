// The dev menu in the route worlds (src/world-debug.js; docs/systems/dev-tools.md "The dev menu"): each world built as
// the play-through builds it (tests/playthrough-agent.js loadWorld: the level and its temple, the collision, the story
// with its people, quests and locators, the makers' boxes; it needs the story, so it builds its own instead of
// tests/built-worlds.js). In every route world the first tab's key places (the ship, the temples, the fight temple, a
// few landmarks) are landed on, on their feet; in two (every one with WORLD_DEBUG_ALL=1) every point of every kind is,
// on the ground or in its room, and its quests and cinematics listed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import './register-gadgets.js';
import { loadWorld, ORDER } from './playthrough-agent.js';
import { gatherPoints, groupPoints, landingSpot, questList, cinematicsFor, devTabs, keyPlaces } from '../src/world-debug.js';
import { collectGames } from '../src/minigames/index.js';
import { CONTENT } from '../src/levels/content.js';

// (two worlds unlike each other for every kind, the dev menu being a developer's tool: the desert's open ground over its
// terrain, the floating city's stacked platforms. WORLD_DEBUG_ALL=1 for every route world, ~30 s more)
const WORLDS = process.env.WORLD_DEBUG_ALL ? ORDER : ['desert', 'spacecity'];
// the games' signs, as the game has them (src/minigames/index.js reads them by import.meta.glob, which node has not)
const GAMES = collectGames(Object.fromEntries(await Promise.all(readdirSync(new URL('../src/minigames/', import.meta.url)).filter((f) => f.endsWith('.js') && f !== 'index.js')
  .map(async (f) => [f, await import(`../src/minigames/${f}`)]))), () => {});

test('route worlds: the key places landed on, on their feet; every kind of place in two, set down on the ground or in its room; quests and films listed', () => {
  const lines = [];
  for (const id of ORDER) {
    const W = loadWorld(id);
    try {
      const pts = gatherPoints({ levelId: id, level: W.level, quests: W.quests, npcs: W.npcs, boxes: W.boxes, content: CONTENT[id], games: GAMES });
      const opts = { portals: W.level.portals ?? [], killY: W.level.killY ?? -Infinity };
      // the first tab: few, from the world's own data
      const key = keyPlaces(pts);
      assert.ok(key.length >= 2 && key.length <= 8, `${id}: ${key.length} key places`);
      assert.ok(key.some((p) => p.key === 'ship'), `${id}: the ship`);
      assert.ok(key.some((p) => p.key === 'temple'), `${id}: its makers' temple`);
      if (GAMES.some((g) => g.fightTemple && g.markers?.some((m) => m.level === id))) assert.ok(key.some((p) => p.key === 'fight'), `${id}: its fight temple`);
      assert.equal(new Set(key.map((p) => p.label)).size, key.length, `${id}: each place once`);
      for (const p of key) {
        const s = landingSpot(W.physics, p, opts);
        assert.ok(s.ok, `${id}: nowhere to stand near ${p.label}`);
        // on its feet: solid under it, not in the air nor in the ground
        const g = W.physics.groundAt(s.pos[0], s.pos[1] + 0.6, s.pos[2], 3);
        assert.ok(Number.isFinite(g) && Math.abs(g - s.pos[1]) < 0.2, `${id}: ${p.label} set down off the ground (${g} under ${s.pos[1]})`);
      }
      lines.push(`${id}: ${key.map((p) => p.label).join(' · ')}`);
      if (!WORLDS.includes(id)) continue;
      // every kind: each point set down
      const kinds = new Set(pts.map((p) => p.kind));
      for (const k of ['landing', 'quest', 'people', 'temple', 'shop', 'run', 'find']) assert.ok(kinds.has(k), `${id}: no ${k} to teleport to`);
      assert.ok(pts.some((p) => p.kind === 'temple' && p.label.startsWith('outside ')), `${id}: the temple's entrance`);
      assert.ok(pts.filter((p) => p.kind === 'temple' && p.room).length >= 3, `${id}: the temple's rooms`);
      const bad = [];
      for (const p of pts) {
        const s = landingSpot(W.physics, p, opts);
        if (!s.ok) { bad.push(`${p.kind} "${p.label}" at ${p.pos.map((v) => (v === null ? '-' : Math.round(v))).join(' ')}`); continue; }
        // in a room: still in it (the temple, or far over the map), not dropped to the world under it
        if (p.room && p.pos[1] !== null) assert.ok(Math.abs(s.pos[1] - p.pos[1]) < 60, `${id}: ${p.label} left its room`);
      }
      assert.deepEqual(bad, [], `${id}: nowhere to stand near these`);
      const qs = questList(W.quests, id);
      assert.ok(qs.some((q) => q.main && q.stages.length >= 2), `${id}: its main quest and stages`);
      assert.ok(cinematicsFor(id).some((e) => e.how === 'here' && e.world === id), `${id}: a film of its own`);
      const tabs = devTabs({ points: pts, films: cinematicsFor(id), quests: qs });
      assert.ok(tabs.length >= 12, `${id}: ${tabs.length} tabs`);
      lines.push(`  ${pts.length} points (${groupPoints(pts).map((g) => `${g.key} ${g.points.length}`).join(', ')})`);
    } finally { W.dispose(); }
  }
  console.info(lines.join('\n'));
});
