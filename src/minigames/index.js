// The minigames (docs/systems/minigames.md): small games played in their own little arena (or a
// corner of a world), each one module, src/minigames/<id>.js, whose default export is the game.
// This file finds them all through Vite's glob: a new game is a new file, nothing to register.
// The shared pieces (the start card, the 3-2-1, the HUD, pause / retry / quit, the results and the
// best score kept in the save) are in src/minigames/kit/ (the runner: kit/runner.js).
//
//   import { GAMES, gameById, gameHref } from './minigames/index.js';
//   gameById('ski')           // the game's definition, or null
//   gameHref('ski', 'desert') // '?game=ski&from=desert': the page that plays it (and where Quit goes back to)

/** What a game's definition must have (its other fields are optional: docs/systems/minigames.md). */
export const REQUIRED = ['id', 'name', 'blurb', 'rules', 'start'];

/** What is wrong with a game's definition (an empty list: nothing). */
export function checkGame(def) {
  const bad = [];
  if (!def || typeof def !== 'object') return ['not an object'];
  for (const k of REQUIRED) if (def[k] === undefined || def[k] === '') bad.push(`no ${k}`);
  if (def.id !== undefined && !/^[a-z][a-z0-9-]*$/.test(def.id)) bad.push(`id "${def.id}" is not lower-case-with-dashes`);
  if (def.start !== undefined && typeof def.start !== 'function') bad.push('start is not a function');
  if (!def.world && typeof def.build !== 'function') bad.push('neither a world (a level id) nor a build (its own arena)');
  if (def.score && !['time', 'points'].includes(def.score.kind)) bad.push(`score.kind "${def.score.kind}" is not time or points`);
  return bad;
}

/**
 * The games among a set of modules ({ path: module }, as Vite's glob gives them): each module's default
 * export that is a game, checked (a broken one is left out with a warning), one per id, in their order.
 */
export function collectGames(modules, warn = (m) => console.warn(m)) {
  const out = [], seen = new Set();
  for (const [path, mod] of Object.entries(modules ?? {})) {
    const def = mod?.default;
    if (!def || typeof def !== 'object' || !('start' in def)) continue;   // (a helper module, not a game)
    const bad = checkGame(def);
    if (bad.length) { warn(`minigame ${path}: ${bad.join(', ')}`); continue; }
    if (seen.has(def.id)) { warn(`minigame ${path}: id "${def.id}" is taken`); continue; }
    seen.add(def.id);
    out.push(def);
  }
  return out.sort((a, b) => (a.order ?? 50) - (b.order ?? 50) || a.name.localeCompare(b.name));
}

let found = {};
// (node, the tests: there is no glob; they hand the modules to collectGames themselves)
try { found = import.meta.glob(['./*.js', '!./index.js'], { eager: true }); } catch { found = {}; }

/** Every game, in the order of the Games row. */
export const GAMES = collectGames(found);

export const gameById = (id, list = GAMES) => list.find((g) => g.id === id) ?? null;

/** The page that plays a game: ?game=<id>, and the world to go back to when it is quit (from). */
export const gameHref = (id, from = null) => `?game=${encodeURIComponent(id)}${from ? `&from=${encodeURIComponent(from)}` : ''}`;
