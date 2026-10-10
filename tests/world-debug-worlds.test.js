// The world debug menu in every route world (src/world-debug.js; docs/systems/dev-tools.md "The world debug menu"):
// each world built as the play-through builds it (tests/playthrough-agent.js loadWorld: the level and its temple,
// the collision, the story with its people, quests and locators, the makers' boxes; it needs the story, so it
// builds its own instead of tests/built-worlds.js), its points gathered as main.js gathers them, and every one
// landed on: solid ground near it, or its spot in a room. Its quests and cinematics listed.
import test from 'node:test';
import assert from 'node:assert/strict';
import './register-gadgets.js';
import { loadWorld, ORDER } from './playthrough-agent.js';
import { gatherPoints, groupPoints, landingSpot, questList, cinematicsFor, debugSections } from '../src/world-debug.js';
import { CONTENT } from '../src/levels/content.js';

test('every route world: teleports of every main kind, each one set down on the ground or in its room; its quests and films listed', () => {
  const counts = [];
  for (const id of ORDER) {
    const W = loadWorld(id);
    try {
      const pts = gatherPoints({ levelId: id, level: W.level, quests: W.quests, npcs: W.npcs, boxes: W.boxes, content: CONTENT[id] });
      const kinds = new Set(pts.map((p) => p.kind));
      for (const k of ['landing', 'quest', 'people', 'temple', 'shop', 'run', 'find']) assert.ok(kinds.has(k), `${id}: no ${k} to teleport to`);
      assert.ok(pts.some((p) => p.kind === 'temple' && p.label.startsWith('outside ')), `${id}: the temple's entrance`);
      assert.ok(pts.filter((p) => p.kind === 'temple' && p.room).length >= 3, `${id}: the temple's rooms`);
      const bad = [];
      for (const p of pts) {
        const s = landingSpot(W.physics, p, { portals: W.level.portals ?? [], killY: W.level.killY ?? -Infinity });
        if (!s.ok) { bad.push(`${p.kind} "${p.label}" at ${p.pos.map((v) => (v === null ? '-' : Math.round(v))).join(' ')}`); continue; }
        // in a room: still in it (the temple, or far over the map), not dropped to the world under it
        if (p.room && p.pos[1] !== null) assert.ok(Math.abs(s.pos[1] - p.pos[1]) < 60, `${id}: ${p.label} left its room`);
      }
      assert.deepEqual(bad, [], `${id}: nowhere to stand near these`);
      const qs = questList(W.quests, id);
      assert.ok(qs.some((q) => q.main && q.stages.length >= 2), `${id}: its main quest and stages`);
      assert.ok(cinematicsFor(id).some((e) => e.how === 'here' && e.world === id), `${id}: a film of its own`);
      const { sections } = debugSections({ points: pts, films: cinematicsFor(id), quests: qs });
      assert.ok(sections.length >= 9, `${id}: ${sections.length} sections`);
      counts.push(`${id} ${pts.length} (${groupPoints(pts).map((g) => `${g.key} ${g.points.length}`).join(', ')})`);
    } finally { W.dispose(); }
  }
  console.info(counts.join('\n'));
});
