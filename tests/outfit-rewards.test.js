// The games' prizes (issue #668, src/minigames/kit/rewards.js): nine of the Wardrobe's outfits won at the games played
// in the main route's worlds. The mapping (each game real, placed in a main-route world, its outfit one of the
// Wardrobe's, its host saying what it is), the award (each kind of goal; never a failed run), replaying (never given
// twice, never taken back), the save (kept across a reload, the outfit worn after it; an old save keeps what it wore)
// and the runner (the results card shows the prize once; the start card names it until it is won).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import vm from 'node:vm';

globalThis.matchMedia ??= () => ({ matches: false });
globalThis.window ??= new EventTarget();
const R = await import('../src/minigames/kit/rewards.js');
const { OUTFIT_REWARDS, outfitFlag, rewardFor, rewardOfOutfit, meetsGoal, awardOutfit, outfitWon, howToWin, prizeRule } = R;
const { OUTFITS, chosenOutfit, chooseOutfit, OUTFIT_KEY, wardrobeData } = await import('../src/wardrobe.js');
const { HOSTS } = await import('../src/story/hosts-data.js');
const { hostTalk } = await import('../src/minigames/kit/hosts.js');
const { ORDER, SIDE, worldFor } = await import('../src/levels/names.js');
const { GameState } = await import('../src/game-state.js');
const { migrateFlags, migrateOutfits668 } = await import('../src/save-migrate.js');
const { parseLine, TONES } = await import('../src/story/tone.js');

const src = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const state = (flags = {}) => ({ flags, flag: (k) => flags[k], set: (k, v) => { flags[k] = v; } });
const memory = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), m }; };

/** Where each game's sign stands: the level that places it (src/levels/<world>.js), or the game's own `markers`. */
function placedIn(game) {
  const own = src(`src/minigames/${game}.js`).match(/markers:\s*\[\{\s*level:\s*'([a-z0-9]+)'/);
  if (own) return own[1];
  for (const w of ['desert', 'bazaar', 'arzach']) {
    const level = src(`src/levels/${w}.js`);
    if (new RegExp(`'${game}'`).test(level) && /placeGameMarker/.test(level)) return w;
  }
  return null;
}

test('the mapping: nine games of the main route, each its own outfit of the Wardrobe, none of a discarded world', () => {
  assert.equal(OUTFIT_REWARDS.length, 9);
  assert.equal(new Set(OUTFIT_REWARDS.map((r) => r.game)).size, 9, 'one prize a game');
  assert.equal(new Set(OUTFIT_REWARDS.map((r) => r.outfit)).size, 9, 'one game an outfit');
  for (const r of OUTFIT_REWARDS) {
    const o = OUTFITS.find((x) => x.id === r.outfit);
    assert.ok(o && o.id !== 'default', `${r.outfit}: an outfit of the Wardrobe`);
    assert.equal(o.name, r.name, `${r.outfit}: the Wardrobe's name`);
    assert.deepEqual(o.unlock, { flag: outfitFlag(r.outfit) }, `${r.outfit}: won by its flag`);
    assert.ok(existsSync(new URL(`../data/characters/traveller-v2/outfits/${r.outfit}/`, import.meta.url)), `${r.outfit}: existing art (no new outfit made)`);
    assert.ok(existsSync(new URL(`../src/minigames/${r.game}.js`, import.meta.url)), `${r.game}: a game`);
    assert.match(src(`src/minigames/${r.game}.js`), new RegExp(`id: '${r.game}'`));
    const world = worldFor(placedIn(r.game));
    assert.ok(ORDER.includes(world) && !SIDE.includes(world), `${r.game}: placed in a main-route world (${world})`);
    assert.equal(Object.keys(r.goal).length, 1, `${r.game}: one goal`);
    assert.ok(['finish', 'points', 'passed'].includes(Object.keys(r.goal)[0]));
    assert.match(howToWin(r), /^Won at .+: .+\.$/);
    assert.doesNotMatch(r.where, /Yusra|Kamal|Aziza|Zayd|Fitz|Hamid|Vesna|Tarek|Clem/, 'where, never who');
  }
  // the helper games and the pirates stay out (their own rewards), and the free outfits stay free
  for (const g of ['cistern', 'elderflight', 'pirates', 'waves', 'canyon-rival', 'lens-vault']) assert.equal(rewardFor(g), null, g);
  assert.ok(OUTFITS.filter((o) => !o.unlock).length >= 6, 'his own clothes and some outfits from the start');
  assert.equal(rewardOfOutfit('pearl-diver').game, 'fishing');
});

test('the hosts say what the prize is, in a toned line, until it is won', () => {
  for (const r of OUTFIT_REWARDS) {
    const line = HOSTS[r.game]?.prize;
    assert.ok(line, `${r.game}: its host has a prize line`);
    const { tone, text } = parseLine(line);
    assert.ok(TONES.includes(tone) && tone !== 'neutral' || /^~neutral~/.test(line), `${r.game}: toned`);
    assert.ok(text.length < 90, `${r.game}: terse`);
  }
  const g = state();
  const talk = hostTalk(HOSTS.fishing, () => {}, { name: 'Fishing', prizeWon: () => outfitWon(g, 'pearl-diver') });
  const said = talk.talk.nodes.offer.say;
  const prize = said.find((s) => typeof s === 'object' && s.text === HOSTS.fishing.prize);
  assert.ok(prize, 'the last page: the prize');
  assert.equal(prize.if(), true, 'said before it is won');
  g.set(outfitFlag('pearl-diver'), true);
  assert.equal(prize.if(), false, 'not once won');
  assert.ok(!('prize' in talk), 'the line is not a field of the person');
  // Kamal's three laps (src/story/bike-wager.js): his won page says it until the courier's coat is won
  assert.match(src('src/story/bike-wager.js'), /\{ text: prize, if: \{ not: \{ flag: won \} \} \}/);
  // the story hands each host whether its prize is won
  assert.match(src('src/story/index.js'), /prizeWon: prize \? \(\) => outfitWon\(game, prize\.outfit\) : null/);
  // the games that mark a good run of their own
  assert.match(src('src/minigames/drums.js'), /passed: rank\(acc\) !== 'D' && !auto\.on/);
  assert.match(src('src/minigames/sketchhunt.js'), /passed: !!all/);
});

test('the award: each kind of goal, never a failed run', () => {
  assert.equal(meetsGoal({ finish: true }, { value: 61.2 }), true);
  assert.equal(meetsGoal({ finish: true }, { value: 61.2, failed: true }), false, 'out of lives: no');
  assert.equal(meetsGoal({ points: 8 }, { value: 8 }), true, 'the mark itself counts');
  assert.equal(meetsGoal({ points: 8 }, { value: 7.9 }), false);
  assert.equal(meetsGoal({ points: 900 }, { value: 1200, failed: true }), false);
  assert.equal(meetsGoal({ passed: true }, { value: 3000, passed: false }), false, 'the score alone is not the game\'s mark');
  assert.equal(meetsGoal({ passed: true }, { value: 10, passed: true }), true);
  for (const r of OUTFIT_REWARDS) {
    const g = state();
    const good = r.goal.points !== undefined ? { value: r.goal.points } : { value: 1, passed: true };
    assert.equal(awardOutfit(g, r.game, { ...good, failed: true }), null, `${r.game}: a failed run wins nothing`);
    assert.equal(awardOutfit(g, r.game, good), r, `${r.game}: won`);
    assert.equal(g.flags[outfitFlag(r.outfit)], true);
  }
  assert.equal(awardOutfit(state(), 'pirates', { value: 9999 }), null, 'a game without a prize');
});

test('replaying: the prize is given once, never again, never taken back', () => {
  const g = state();
  assert.equal(awardOutfit(g, 'gallery', { value: 640 }), null, 'below the mark');
  assert.equal(outfitWon(g, 'lamplighter'), false);
  assert.equal(awardOutfit(g, 'gallery', { value: 950 }).outfit, 'lamplighter');
  const after = { ...g.flags };
  assert.equal(awardOutfit(g, 'gallery', { value: 1400 }), null, 'a better run: nothing more');
  assert.equal(awardOutfit(g, 'gallery', { value: 100 }), null, 'a worse one: nothing taken');
  assert.deepEqual(g.flags, after);
  assert.equal(outfitWon(g, 'lamplighter'), true);
  assert.equal(prizeRule(rewardFor('gallery'), g), '', 'the start card stops naming it');
  assert.match(prizeRule(rewardFor('gallery'), state()), /^The prize: the lamplighter’s outfit, to score 900 in the minute\.$/);
});

test('the save: a prize won stays won across a reload, wearable from the Wardrobe; an old save keeps the outfit it wore', () => {
  const storage = memory();
  const a = new GameState(storage);
  a.reset();
  assert.equal(chooseOutfit(a, 'pearl-diver'), false, 'not his yet');
  assert.ok(awardOutfit(a, 'fishing', { value: 9.4 }));
  assert.equal(chooseOutfit(a, 'pearl-diver'), true, 'won: worn from the Wardrobe');
  const b = new GameState(storage);   // (the page loaded again)
  assert.equal(outfitWon(b, 'pearl-diver'), true);
  assert.equal(chosenOutfit(b), 'pearl-diver');
  assert.equal(wardrobeData({ state: b, v2: true }).outfits.find((o) => o.id === 'pearl-diver').unlocked, true);
  assert.equal(awardOutfit(b, 'fishing', { value: 12 }), null, 'replayed after the reload: not given twice');
  // a save from before the prizes (step 30): the outfit it wears is kept as won, the others wait for their game
  const old = { 'save.migrated': 29, 'wardrobe.outfit': 'glider-pilot', 'world.desert.done': true };
  migrateFlags(old);
  assert.equal(old[outfitFlag('glider-pilot')], true);
  assert.equal(old[outfitFlag('lamplighter')], undefined);
  assert.equal(chosenOutfit(state(old)), 'glider-pilot', 'still wearing it');
  assert.deepEqual(migrateOutfits668({ 'wardrobe.outfit': 'salt-pilgrim' }), { 'wardrobe.outfit': 'salt-pilgrim' }, 'a free outfit needs nothing');
  assert.deepEqual(migrateOutfits668({}), {});
});

// the shared runner (web and engines: engine/trials.js makes the same one), without its browser-only imports
const runnerSrc = src('src/minigames/kit/runner.js').replace(/^import .*;\n/gm, '').replace(/^export \{.*;\n/gm, '').replace(/^export /gm, '');
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const Runner = vm.runInNewContext(`${runnerSrc}\n({ MinigameRunner, prizeHtml, plainHtml });`, {
  NO_INPUT: {}, readInput: () => ({}), escapeHtml: esc, FINISH_WAIT: 1.7, awardOutfit, rewardFor, prizeRule,
  recordScore: () => ({ best: null, isNew: false, first: true, plays: 1 }), bestScore: () => null, scoreDef: (d) => d,
});

test('the runner: the results card shows the prize the first run that wins it, and only that one (web and engines)', () => {
  const g = state();
  const run = (def, result) => {
    const r = Object.create(Runner.MinigameRunner.prototype);
    Object.assign(r, { def, host: { state: g }, phase: 'play', clock: 0, penalty: 0, points: 0, sfx: { finish() {}, lose() {} }, flash() {} });
    r.finish(result);
    return r.result;
  };
  const fishing = { id: 'fishing', score: { kind: 'points', unit: 'kg' } };
  assert.equal(run(fishing, { score: 5.1 }).prize, null, 'short of the mark');
  const won = run(fishing, { score: 8.6, html: '<p>journal</p>' });
  assert.equal(won.prize.outfit, 'pearl-diver');
  assert.match(won.html, /^<p>journal<\/p><div class="mg-prize">/, 'after the game\'s own block');
  assert.equal(Runner.plainHtml(won.html), 'journal\nNew outfit\nPearl diver\nYours. Wear it from the Wardrobe (Menu).', 'the engines\' card: its extra lines');
  const again = run(fishing, { score: 11 });
  assert.equal(again.prize, null, 'replayed: no second prize');
  assert.doesNotMatch(String(again.html ?? ''), /mg-prize/);
  assert.equal(g.flags[outfitFlag('pearl-diver')], true, 'and nothing lost');
  // a run that failed: no prize; the drum circle's mark
  const sky = { id: 'platformer', score: { kind: 'points' } };
  assert.equal(run(sky, { score: 300, failed: true }).prize, null);
  assert.equal(run(sky, { score: 300 }).prize.outfit, 'gravity-ranger');
  const drums = { id: 'drums', score: { kind: 'points' } };
  assert.equal(run(drums, { score: 9000, passed: false }).prize, null);
  assert.equal(run(drums, { score: 900, passed: true }).prize.outfit, 'festival-traveller');
  // the start card names it until won (its rules, which the engines' card draws too)
  assert.match(runnerSrc, /const rules = \[d\.rules, prizeRule\(rewardFor\(d\.id\), S\)\]\.filter\(Boolean\)\.join\(' '\)/);
  assert.match(runnerSrc, /text: d\.blurb, rules,/);
});

test('the engines\' Wardrobe (engine/menus.js, drawn by the Unity bridge): a prize not won is locked, its strip says where it is won', async () => {
  const { EngineMenus } = await import('../engine/menus.js');
  const g = state();
  const m = new EngineMenus({ sources: { wardrobe: () => wardrobeData({ state: g, v2: true, sword: false }) }, wardrobe: { preview() {}, wear() {}, leave() {} } });
  m.show('game', 'wardrobe');
  const at = OUTFITS.findIndex((o) => o.id === 'pearl-diver');
  for (let i = 0; i < at; i++) m.navigate(0, 1);
  const v = m.view();
  assert.equal(v.rows[at][0].text, 'Pearl diver');
  assert.equal(v.rows[at][0].locked, true);
  assert.equal(v.strip.sub, 'Not yours yet · Won at the Desert’s mineral basin: land 8 kg of fish.');
  assert.equal(v.strip.act, '', 'nothing to wear yet');
  g.set(outfitFlag('pearl-diver'), true);
  m.changed();
  const after = m.view();
  assert.equal(after.rows[at][0].locked, false, 'won: his');
});
