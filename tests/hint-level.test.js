// Hints: off / subtle (the default) / full (src/hint-level.js, docs/systems/hints.md). The author's playtest:
// "Way too many hints in the game, I don't want handholding and obvious prompts." Every kind of help goes
// through the one setting; subtle teaches only the genuinely new verbs, once, and helps when asked after a struggle.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { HINT_LEVELS, DEFAULT_HINTS, HINT_POLICY, hintLevel, setHintLevel, hintsFor, tip, quietOr, hintLinesOpen, STRUGGLE } from '../src/hint-level.js';
import { openHint, Struggle, BOSS_HINTS } from '../src/temples/hints.js';
import { t } from '../src/i18n.js';

const src = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
/** ui.js reads matchMedia and window at import: a bare stand-in for the test. */
async function ui() {
  globalThis.matchMedia ??= () => ({ matches: false });
  globalThis.window ??= new EventTarget();
  return import('../src/ui.js');
}

test('three levels, subtle by default; an unknown value is the default', () => {
  assert.deepEqual(HINT_LEVELS, ['off', 'subtle', 'full']);
  assert.equal(DEFAULT_HINTS, 'subtle');
  assert.equal(hintLevel(), 'subtle');
  assert.equal(setHintLevel('full'), 'full');
  assert.equal(setHintLevel('loud'), 'subtle');
  assert.equal(hintLevel(), 'subtle');
});

test('what each level lets through: subtle keeps only the first-time teaching and the asked-for help', () => {
  for (const kind of Object.keys(HINT_POLICY)) {
    assert.equal(hintsFor(kind, 'full'), true, `full: ${kind}`);
    assert.equal(hintsFor(kind, 'off'), false, `off: ${kind}`);
  }
  assert.deepEqual(Object.keys(HINT_POLICY).filter((k) => hintsFor(k, 'subtle')), ['teach', 'puzzle']);
  assert.equal(tip('Ink 5 of 8.', 'subtle'), '');
  assert.equal(tip('Ink 5 of 8.', 'full'), 'Ink 5 of 8.');
  assert.equal(quietOr('The crates rock.', 'The crates rock. Shove them.', 'subtle'), 'The crates rock.');
  assert.equal(quietOr('The crates rock.', 'The crates rock. Shove them.', 'off'), 'The crates rock.');
  assert.equal(quietOr('The crates rock.', 'The crates rock. Shove them.', 'full'), 'The crates rock. Shove them.');
});

test('a guardian\'s fight: the drone\'s hints never at once on subtle; one line opens after each stretch of struggle', () => {
  const hint = { id: 'desert.0', lines: BOSS_HINTS.desert.phases[0], at: () => null };
  assert.equal(openHint(hint, 0, 'subtle').lines.length, 0, 'asked at once: it only watches');
  assert.equal(openHint(hint, STRUGGLE[0], 'subtle').lines.length, 1, 'the nudge');
  assert.equal(openHint(hint, STRUGGLE[1], 'subtle').lines.length, 2);
  assert.equal(openHint(hint, STRUGGLE[2], 'subtle'), hint, 'all three after a long struggle');
  assert.equal(openHint(hint, 0, 'full'), hint, 'full: at once');
  assert.equal(openHint(hint, 1e6, 'off').lines.length, 0, 'off: never');
  assert.equal(openHint(null, 100, 'full'), null);
  assert.equal(hintLinesOpen(STRUGGLE[0] - 1, 'subtle'), 0);
  // the struggle is counted per phase: a new phase starts over
  const s = new Struggle();
  s.tick('desert.0', 30); s.tick('desert.0', 30);
  assert.equal(s.t, 30, 'the first tick of a phase starts its clock');
  s.tick('desert.1', 5);
  assert.equal(s.t, 0, 'a new phase: from nothing');
  s.tick(null, 5);
  assert.equal(s.id, null);
  // and the lines never name a key in prose: a {key:…}, taken out unless hints are full
  for (const [id, H] of Object.entries(BOSS_HINTS)) for (const p of H.phases) for (const l of p) assert.ok(!/\bY \/ △|\bV,/.test(l), `${id}: ${l}`);
});

test('the setting: in the menu (Game), saved, and settings from before it start on subtle once', async () => {
  const { migrateSettings, applyAccess } = await ui();
  assert.match(src('src/ui.js'), /row\(t\('set\.hints'\), opts\('hints', HINT_LEVELS\)\)/);
  for (const lv of HINT_LEVELS) assert.ok(t(`set.hints.${lv}`) && t(`set.hints.${lv}`) !== `set.hints.${lv}`, lv);
  assert.deepEqual(migrateSettings({ music: 0.5, hudV: 1 }), { music: 0.5, hudV: 1, hints: 'subtle', hintsV: 1 }, 'before the setting: the new default');
  assert.equal(migrateSettings({ hudV: 1, hints: 'full', hintsV: 1 }).hints, 'full', 'chosen since: kept');
  assert.equal(migrateSettings({ hudV: 1, hints: 'off', hintsV: 1 }).hints, 'off');
  assert.equal(migrateSettings({ hudV: 1, hints: true }).hints, 'full', 'an on / off from a test build: full');
  assert.equal(migrateSettings({ hudV: 1, hints: false }).hints, 'off');
  assert.equal(migrateSettings({ hudV: 1, hints: 'loud', hintsV: 1 }).hints, 'subtle', 'nonsense: the default');
  // applyAccess hands it on, as it does the language

  applyAccess({ hints: 'off', lang: 'en' }, null);
  assert.equal(hintLevel(), 'off');
  applyAccess({ hints: 'subtle', lang: 'en' }, null);
  assert.equal(hintLevel(), 'subtle');
});

test('every channel goes through the setting', () => {
  const main = src('src/main.js');
  assert.match(main, /getHint: \(\) => openHint\(guardianHint\(level\.temple\), struggle\.t\)/, 'the drone in a fight');
  assert.match(main, /game\.on\('scout:ping', \(e\) => \{ if \(e\?\.why && \(!hintsFor\('nudge'\) \|\| ship\.cinema\.noticeBusy\(\)\)\) return;/, 'a world\'s own ping (the jets): a nudge');
  assert.match(main, /!hintsFor\('teach'\)\) return;/, 'the potion: taught once');
  assert.match(main, /updateHazards\(dt, player, \{ notice: \(t\) => \{ if \(hintsFor\('tip'\)\) showToast\(t\); \} \}\)/, 'fire and spines');
  assert.match(src('src/player.js'), /this\.opts\.edgeHint && hintsFor\('tip'\)/, 'the world\'s edge');
  assert.match(src('src/story/quests.js'), /hintsFor\('objective'\)/, 'a quest\'s next step');
  assert.match(src('src/foes.js'), /if \(!note \|\| this\.own \|\| !hintsFor\('tip'\)\) return;/, 'how to beat each foe');
  assert.match(src('src/gadgets/index.js'), /said\.has\(key\) && !hintsFor\('tip'\)/, 'a gadget\'s status, once');
  assert.match(src('src/boxes/effects.js'), /id === 'bell' && hintsFor\('tip'\)/, 'the bell after its card');
  assert.match(src('src/prompt-keys.js'), /if \(!teach && !hintsFor\('keys'\)\) \{ s = quietKeys\(s\)/, 'keys in lines');
  assert.match(src('src/first-steps.js'), /hintsFor\('teach', this\.level\(\)\)/, 'the first steps');
  assert.match(src('index.html'), /#prompt\.glyph \{/, 'the quiet glyph');
});
