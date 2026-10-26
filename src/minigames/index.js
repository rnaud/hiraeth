// The minigames (docs/systems/minigames.md): small games played in their own little arena (or a
// corner of a world), each one module, src/minigames/<id>.js, whose default export is the game.
// This file finds them all through Vite's glob: a new game is a new file, nothing to register.
// The shared pieces (the start card, the 3-2-1, the HUD, pause / retry / quit, the results and the
// best score kept in the save) are in src/minigames/kit/ (the runner: kit/runner.js).
//
//   import { GAMES, gameById, gameHref } from './minigames/index.js';
//   gameById('ski')           // the game's definition, or null
//   gameHref('ski', 'desert') // '?game=ski&from=desert': the page that plays it (and where Quit goes back to)

import { collectGames, gameById as lookupGame } from './kit/registry.js';
export { REQUIRED, checkGame, collectGames, gameHref } from './kit/registry.js';

let found = {};
// (node, the tests: there is no glob; they hand the modules to collectGames themselves)
try { found = import.meta.glob(['./*.js', '!./index.js'], { eager: true }); } catch { found = {}; }

/** Every game, in the order of the Games row. */
export const GAMES = collectGames(found);

export const gameById = (id, list = GAMES) => lookupGame(id, list);
