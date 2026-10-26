// The game's type (issue #128, docs/systems/ui.md "Type"): one face for everything a player reads, the title face
// for names and headings, and the monospace only in the debug and dev panels and on a machine's screen in the world.
// A monospace face coming back into the cue, a notice, a card, a minigame or the menus fails here.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setWordMeasure, wordWidth, chunkSvg } from '../src/story/scripts.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const read = (p) => readFileSync(join(ROOT, p), 'utf8');
/** A line that sets a monospace face (a font or a family naming one), or the mono's variable or constant. */
const MONO = /font[^\n]*(monospace|\bMenlo\b|\bConsolas\b|Courier New)|--face-mono|MONO_FACE/i;

/** Where the mono may stay, and why. Nothing else under src/ (nor index.html beyond its one readout) may use it. */
const MONO_OK = {
  'src/typefaces.js': 'where the faces are named',
  'src/debug-back.js': 'the dev pages’ way back to the Debug menu',
  'src/world-picker.css': 'the Debug menu',
  'src/foe-spawner.js': 'the foe spawner, a dev tool',
  'src/serendipity-page/main.js': 'the serendipity map, a dev page',
  'src/hitbox-overlay.js': 'the hitbox overlay, a dev tool',
  'src/input-display.js': 'the input display: raw button and axis numbers, to check a controller',
  'src/levels/references.js': 'the References, the author’s reference level',
  'src/levels/reference-picker.js': 'the References’ list of views',
  'src/levels/arcade.js': 'the Arcade’s score board, a machine’s screen in the world',
  'src/characters/outfit-page.js': 'the outfits test page’s readout of draws and triangles, a dev page',
  'src/pose-report.js': 'the F8 pose report, a debug readout of the traveller’s animator for screenshots',
  'src/ship/portrait.js': 'the ship’s console screen (NO POWER, the reel’s date stamp), a machine’s screen in the world',
};

function files(dir, out = []) {
  for (const n of readdirSync(join(ROOT, dir))) {
    const p = join(dir, n);
    if (statSync(join(ROOT, p)).isDirectory()) files(p, out);
    else if (/\.(js|css|html)$/.test(n)) out.push(p);
  }
  return out;
}

test('no monospace in what a player reads: the HUD, the notices, the cards, the minigames, the menus, the conversations', () => {
  const bad = files('src').filter((p) => !MONO_OK[p] && MONO.test(read(p)));
  assert.deepEqual(bad, [], `monospace in player-facing code (use var(--face), or FACE from src/typefaces.js): ${bad.join(', ')}`);
  for (const p of Object.keys(MONO_OK)) assert.ok(MONO.test(read(p)), `${p} has no mono any more: take it off the list`);
});

test('index.html: the faces and sizes named once, the mono for the frame-time readout alone', () => {
  const html = read('index.html');
  for (const v of ['--face:', '--face-title:', '--face-mono:', '--type:', '--type-s:']) assert.ok(html.includes(v), v);
  const lines = html.split('\n').filter((l) => MONO.test(l));
  assert.equal(lines.length, 2, lines.join('\n'));
  assert.ok(lines.some((l) => /^\s*--face-mono:/.test(l)) && lines.some((l) => /#fps \{.*var\(--face-mono\)/.test(l)), 'the definition and #fps');
});

test('the core screens are set in the game’s face and sized from the screen’s height', () => {
  const html = read('index.html');
  const rule = (src, sel) => src.match(new RegExp(`${sel.replace(/[.#()[\]]/g, (c) => `\\${c}`)} \\{([^}]*)\\}`))?.[1] ?? '';
  for (const sel of ['#cue', '#toast', '#prompt', '#restart .sheet', '.balloon']) {
    const r = rule(html, sel);
    assert.match(r, /var\(--face\)/, `${sel} in the face`);
    assert.match(r, /var\(--type(-s)?\)/, `${sel} sized by --type`);
  }
  assert.match(rule(html, '#dialogue'), /var\(--dlg\)\/1\.4 var\(--face\)/, 'the compact conversation retains screen-relative sizing and the game face');
  assert.match(rule(read('src/minigames/kit/minigames.css'), '#minigame'), /var\(--type-s\)\/1\.45 var\(--face\)/, 'the minigames');
  assert.match(read('src/menus.css'), /\.fullmenu \{[^}]*var\(--type-s\)\/1\.45 var\(--face\)/, 'the settings');
  assert.match(read('src/hud-styles/box-card.js'), /#boxcard \{[^}]*var\(--type-s\)\/1\.4 var\(--face\)/, 'the item card');
});

test('a script’s word is as wide as its English in the panel’s face (measured), 1ch a letter where nothing measures', () => {
  assert.equal(wordWidth('stone'), '5ch');
  try {
    setWordMeasure((t, bold) => [...t].length * (bold ? 0.6 : 0.5));
    assert.equal(wordWidth('stone'), '2.500em');
    assert.equal(wordWidth('stone', true), '3.000em');
    assert.match(chunkSvg('stone', 'desert', {}), /width:2\.500em/);
    assert.match(chunkSvg('stone', 'desert', { bold: true }), /width:3\.000em/);
  } finally { setWordMeasure(null); }
  assert.match(chunkSvg('stone', 'desert', {}), /width:5ch/);
});

test('the dev panels keep the mono; their reasons are written', () => {
  for (const [p, why] of Object.entries(MONO_OK)) assert.ok(why.length > 8, relative('.', p));
});

// Issue #556 (the post-audit Unity check): the Unity build's HUD (the JS bridge's uGUI, BridgeHud) set a minigame's flashes
// (the chime pirates' place names, "Finish!", "+3 s"), the gadget marks' numbers and the chimes' count in the monospace the
// page left behind in #423; the page sets them in its face (minigames.css .mg-flash, #gadget-marks .m b, #health .chimes).
// The mono stays only where the bridge warms it and on the gadget wheel's glyphs (symbols, drawn over its pictures).
test('the Unity build\'s HUD sets what a player reads in the page\'s face: no monospace in the JS bridge\'s words', () => {
  const dir = 'unity/Hiraeth/Assets/HiraethJS/Runtime';
  const MONO_UNITY_OK = [/Warm\(Ui\.Mono\)/, /MakeDisc\(gWheel, "slot"/];
  const bad = [];
  for (const n of readdirSync(join(ROOT, dir)).filter((f) => f.endsWith('.cs'))) {
    read(join(dir, n)).split('\n').forEach((l, i) => { if (/Ui\.Mono\b/.test(l) && !MONO_UNITY_OK.some((r) => r.test(l))) bad.push(`${n}:${i + 1}: ${l.trim().slice(0, 120)}`); });
  }
  assert.deepEqual(bad, []);
  const hud = read(join(dir, 'BridgeHud.cs'));
  assert.match(hud, /"mg flash"[\s\S]{0,300}Ui\.Label\(box\.rt, "text", Ui\.Sans/, 'a minigame\'s flash in the page\'s face');
  assert.match(hud, /"chimes", Ui\.SansHeavy/, 'the chimes\' count in the face at its heavy weight, as #health .chimes');
});
