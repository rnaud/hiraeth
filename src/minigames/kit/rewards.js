// The games' prizes (issue #668): outfits of the Wardrobe (src/wardrobe.js) won at the games played in the main
// route's worlds. Each game below gives one outfit, once, the first time a run meets its goal; the save keeps it as the
// flag `outfit.<id>` (src/game-state.js flags, per save slot), so it is never given twice and never taken back. The host
// says what it is before the game (src/minigames/kit/hosts.js hostTalk, the host's `prize` line in
// src/story/hosts-data.js, said until it is won), the start card's rules name it, and the results card shows it won
// (kit/runner.js finish). The Wardrobe lists the outfits not won yet with where to win them (`how`).
// Pure: no game modules (src/save-migrate.js reads it). docs/systems/minigames.md, "Outfits as prizes".
//
//   rewardFor('fishing')                    → the fishing prize ({ game, outfit, name, where, task, goal }), or null
//   rewardOfOutfit('pearl-diver')           → the same, by the outfit
//   meetsGoal(goal, { value, failed, passed })   → did this run win it?
//   awardOutfit(state, 'fishing', result)   → the prize, the first time a run wins it (the flag set); else null

/**
 * The prizes, in the Wardrobe's order of their outfits. `goal`: what a run must do (never a run that failed):
 *   { finish: true }   finish it (a race's last gate, the Sky steps' gate)
 *   { points: n }      score n or more (the fishing's kilos, the points)
 *   { passed: true }   the game's own mark of a good run (`ctx.finish({ passed })`: the drum circle's half the beats, the
 *                      sketch hunt's page full)
 * `where` says where the game is (never who hosts it); `task` what to do, in a few words.
 */
export const OUTFIT_REWARDS = [
  { game: 'wingdrop', outfit: 'glider-pilot', name: 'Glider pilot', where: 'the Desert’s hanging bridge, west shelf', task: 'score 900 over the three drops', goal: { points: 900 } },
  { game: 'gallery', outfit: 'lamplighter', name: 'Lamplighter', where: 'the Signal Market’s west pavement', task: 'score 900 in the minute', goal: { points: 900 } },
  { game: 'fishing', outfit: 'pearl-diver', name: 'Pearl diver', where: 'the Desert’s mineral basin', task: 'land 8 kg of fish', goal: { points: 8 } },
  { game: 'canyon', outfit: 'storm-courier', name: 'Storm courier', where: 'the Desert’s Two Chasms', task: 'finish the three laps', goal: { finish: true } },
  { game: 'ski', outfit: 'frost-surveyor', name: 'Frost surveyor', where: 'the Desert’s Long Dune', task: 'ski down to the finish', goal: { finish: true } },
  { game: 'sketchhunt', outfit: 'observatory-apprentice', name: 'Observatory apprentice', where: 'the Signal Market’s pavement', task: 'sketch all six on the list', goal: { passed: true } },
  { game: 'drums', outfit: 'festival-traveller', name: 'Festival traveller', where: 'the Desert pilgrims’ small fire', task: 'strike half the beats', goal: { passed: true } },
  { game: 'platformer', outfit: 'gravity-ranger', name: 'Gravity ranger', where: 'Vael’s start plateau, west rim', task: 'reach the makers’ gate', goal: { finish: true } },
  { game: 'rings', outfit: 'comet-pathfinder', name: 'Comet pathfinder', where: 'the Desert’s hanging bridge, east shelf', task: 'fly the race to its end', goal: { finish: true } },
];

/** The save's flag that says an outfit is his (won, or kept from before the prizes: src/save-migrate.js step 30). */
export const outfitFlag = (id) => `outfit.${id}`;
export const rewardFor = (game, list = OUTFIT_REWARDS) => list.find((r) => r.game === game) ?? null;
export const rewardOfOutfit = (outfit, list = OUTFIT_REWARDS) => list.find((r) => r.outfit === outfit) ?? null;
/** Has the save won this outfit? */
export const outfitWon = (state, outfit) => !!state?.flag?.(outfitFlag(outfit));

/** Did a finished run ({ value, failed, passed }) meet the goal? A failed run never does. */
export function meetsGoal(goal, result) {
  if (!goal || !result || result.failed) return false;
  if (goal.points !== undefined) return Number.isFinite(result.value) && result.value >= goal.points;
  if (goal.passed) return result.passed === true;
  return !!goal.finish;
}

/**
 * A finished run of `game`: its prize, given the first time a run meets its goal (the flag set), else null (no prize for
 * this game, the goal not met, or won before: replaying neither gives it again nor takes it).
 */
export function awardOutfit(state, game, result, list = OUTFIT_REWARDS) {
  const r = rewardFor(game, list);
  if (!r || !state?.set || outfitWon(state, r.outfit) || !meetsGoal(r.goal, result)) return null;
  state.set(outfitFlag(r.outfit), true);
  return r;
}

/** What the Wardrobe says of an outfit not won yet: where, and what to do there. */
export const howToWin = (r) => (r ? `Won at ${r.where}: ${r.task}.` : '');
/** The start card's line on the prize (nothing once won). */
export const prizeRule = (r, state) => (r && !outfitWon(state, r.outfit) ? `The prize: the ${r.name.toLowerCase()}’s outfit, to ${r.task}.` : '');
