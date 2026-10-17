// Issue #430: when each piece of the HUD shows is one table (src/hud-shows.js), which the engines' HUD asks (BridgeHud.cs
// On / Part, sent as the state's `shows`), and the page's own CSS rules that hide them are all in it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { HUD_HIDES, HUD_ELEMENTS, HUD_CLASSES, hudShows } from '../src/hud-shows.js';

const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');

/** The page's rules that hide a HUD piece under a body class: [{ state, part }] (`body.talking #prompt { visibility: hidden }`). */
function cssHides() {
  const css = [read('index.html'), read('src/gadgets/hud.js'), read('src/minigames/kit/minigames.css')].join('\n').replace(/\/\*[\s\S]*?\*\//g, '');
  const out = [];
  for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const decl = m[2];
    if (!/visibility:\s*hidden|opacity:\s*0\s*[;}]|opacity:\s*0$|display:\s*none/.test(decl)) continue;
    for (const sel of m[1].split(',')) {
      const k = sel.trim().match(/^body\.([a-z-]+)(:not\(\.mg-onfoot\))?\s+([#.][a-z-]+)\s*$/);
      if (!k || !HUD_CLASSES[k[1]] || !HUD_ELEMENTS[k[3]]) continue;
      out.push({ state: HUD_CLASSES[k[1]], part: HUD_ELEMENTS[k[3]], onFootKeeps: !!k[2], sel: sel.trim() });
    }
  }
  return out;
}

test('every page rule that hides a HUD piece under a body class is in the table (src/hud-shows.js)', () => {
  const rules = cssHides();
  assert.ok(rules.length >= 15, `the page's rules found: ${rules.length}`);
  const missing = rules.filter((r) => !HUD_HIDES[r.state].includes(r.part)).map((r) => r.sel);
  assert.deepEqual(missing, []);
  // (and the ones the page hides in a conversation, the table hides too: the voicemail's E drew only while the HUD was on)
  for (const p of ['cue', 'health', 'keys', 'stamina', 'prompt', 'balloons', 'gadget']) assert.ok(rules.some((r) => r.state === 'talking' && r.part === p), `body.talking hides ${p}`);
});

test('hudShows: the parts hidden now, from the screen\'s state', () => {
  assert.deepEqual(hudShows({}), {});
  // a conversation: the prompt, the balloons and the hints gone; the toast stays (the page's)
  const talk = hudShows({ dialogue: { text: 'hi' } });
  assert.equal(talk.prompt, false); assert.equal(talk.balloons, false); assert.equal(talk.cue, false);
  assert.equal(talk.toast, undefined);
  // a ship's scene with the HUD off: the cue gone, the prompt the scene's own (the voicemail's E, issue #394) and the health as the page's
  const off = hudShows({ cine: { hud: false, bars: true } });
  assert.equal(off.cue, false); assert.equal(off.prompt, undefined); assert.equal(off.health, undefined);
  // walked through: the cue back
  assert.equal(hudShows({ cine: { hud: false, bars: true, walk: true } }).cue, undefined);
  // a run: the cue and the prompt gone, the stamina too unless it is played on foot
  assert.equal(hudShows({ minigame: { on: true } }).stamina, false);
  assert.equal(hudShows({ minigame: { on: true, onFoot: true } }).stamina, undefined);
  // photo mode's keys in the cue's strip over a run
  assert.equal(hudShows({ minigame: { on: true }, photo: { hint: 'P' } }).cue, undefined);
});

test('BridgeHud asks the table: no part drawn under conditions of its own (issue #430)', () => {
  const cs = read('unity/Hiraeth/Assets/HiraethJS/Runtime/BridgeHud.cs');
  const draw = cs.slice(cs.indexOf('        void Draw()'), cs.indexOf('// ---------------------------------------------------------------- the take-off'));
  assert.match(draw, /shows = state\.O\("shows"\)/);
  assert.doesNotMatch(draw, /\bfree\b|\bbool hud\b/, 'the old conditions (free, hud) are gone');
  const game = read('engine/unity/game.js');
  assert.match(game, /shows: hudShows\(scr\.state\)/);
});
