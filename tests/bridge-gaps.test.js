// Issue #428 (bridge parity 1, "loud gaps"): what the web game uses that the Unity bridge doesn't carry can't slip in
// silently any more. Before #394 the father's hologram (a scene the page drew over its picture), the charge card (page
// HTML), a shader with no port and main.js's armTool were all missing in Unity and nothing said so. Every material
// (gathered by running every world and minigame in the engines' bundle, as the bridge sees them), every shader site,
// extra pass, page element and piece of main.js's wiring must be named in engine/bridge-gaps.js: handled (where), web
// only (why) or a known gap (its issue). docs/systems/engine-bridge.md, "Loud gaps"; docs/systems/bridge-gaps.md.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  ROOT, REPORT, gatherShaders, gatherPasses, gatherDom, gatherHost, gatherMaterials, bridgeParts, compare, checkEntries, reportMarkdown,
} from '../scripts/bridge-gaps.mjs';
import { portMaterial, unmapped, unmappedKey } from '../engine/unity/port-format.js';

const HOW = 'name it in engine/bridge-gaps.js: handled (where the bridge does it), web-only (why) or gap (its issue); then node scripts/bridge-gaps.mjs';

function verdict(kind, r) {
  const lines = [
    ...r.unlisted.map((u) => `new, not in the list: ${u.key}${u.count ? ` (${u.count} sites)` : ''}${u.where ? ` (in ${u.where.slice(0, 4).join(', ')})` : ''}${u.names?.length ? ` '${u.names.join("', '")}'` : ''}`),
    ...r.counts.map((c) => `${c.key}: ${c.now} sites, the list says ${c.was} (does Unity carry the new one? then move the count)`),
    ...r.stale.map((k) => `listed, no longer found: ${k} (take it out of the list)`),
    ...r.bad.map((b) => `handled by a screen part the bridge never reads: ${b}`),
  ];
  assert.equal(lines.length, 0, `${kind}:\n  ${lines.join('\n  ')}\n(${HOW})`);
}

test('every entry of the list says its status, why or where, and a gap its issue', () => {
  assert.deepEqual(checkEntries(), []);
});

test('the shaders the game makes: each one ported, web only or a known gap', () => verdict('shaders', compare('shaders', gatherShaders())));
test('the passes and scenes besides the main picture: each one drawn by the bridge, web only or a known gap', () => verdict('passes', compare('passes', gatherPasses())));
test('the page elements the systems build, and the screen parts the bridge never reads', () => verdict('dom', compare('dom', gatherDom(), { parts: bridgeParts() })));
test('what main.js sets up that engine/game.js doesn\'t (#427\'s list)', () => verdict('host', compare('host', gatherHost())));

test('the screen parts the bridge draws are read from its C# (the charge card among them, issue #394)', () => {
  const parts = bridgeParts();
  for (const p of ['charge', 'dialogue', 'cue', 'prompt', 'drums', 'cine']) assert.ok(parts.has(p), p);
});

test('a material the port has no shader for is a recorded gap, said once, not a silent Surface (issue #428)', () => {
  const spec = { type: 'shader', name: 'made-up', u: { uNew: 1, uAlso: [1, 2, 3] }, defines: {} };
  const warn = console.warn, said = [];
  console.warn = (m) => said.push(String(m));
  try { portMaterial(spec, 1); portMaterial(spec, 2); } finally { console.warn = warn; }
  const key = unmappedKey(spec);
  assert.equal(key, 'shader:uAlso,uNew');
  assert.equal(unmapped.get(key)?.n, 2);
  assert.equal(said.filter((m) => m.includes(key)).length, 1, 'said once');
  assert.equal(unmappedKey({ type: 'other', three: 'MeshLambertMaterial' }), 'three:MeshLambertMaterial');
  // (one the port has: no gap)
  const before = unmapped.size;
  assert.equal(portMaterial({ type: 'shader', u: { uPal: new Array(15).fill(0) }, defines: {} }, 3).port, 'flame');
  assert.equal(unmapped.size, before);
});

test('every material of every world and minigame, as the bridge sees it: ported, or named in the list', async () => {
  const found = await gatherMaterials();
  assert.ok(found.size > 20, `the run saw the materials (${found.size} kinds)`);
  verdict('materials', compare('materials', found));
});

test('docs/systems/bridge-gaps.md is the list\'s (node scripts/bridge-gaps.mjs)', () => {
  assert.equal(readFileSync(join(ROOT, REPORT), 'utf8'), reportMarkdown());
});
