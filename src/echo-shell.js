import { game as sharedGame } from './game-state.js';
import { items as sharedItems } from './items.js';

// The echo shell (src/items.js 'echo', found in the Signal Market's
// Undertower, src/temples/bazaar.js): it catches the last of the makers'
// notes sung near the traveller and plays it back on demand.
//
//   game event 'note' { pos, note, degree, color, label, reach? }   something sang (a singing stone, the
//                                                                    First Sign's one word: src/temples/pieces.js
//                                                                    EchoStone, bazaar.js); within `reach` (18 m)
//                                                                    of the traveller, the shell keeps it
//   shell.play()                                                     V / RS · R3 (src/boxes/effects.js ring):
//                                                                    plays what it holds, game event 'echo'
//                                                                    { pos, note }; EchoEar and the First Sign listen
//   shell.held                                                       { note, degree, color, label } or null
//
// Kept in the save (game flag `echo.held`): a note carried out of a room is still in the shell after a reload.

export const ECHO = { reach: 18, cool: 1.0 };

export function createEchoShell({ player, game = sharedGame, items = sharedItems, sound = null, toast = () => {} }) {
  let cool = 0;
  const told = new Set();
  const shell = {
    get held() { return game.flag('echo.held') ?? null; },
    /** Something sang near you: the shell keeps it (if you carry it, and it is within earshot). */
    hear({ pos, note, degree = 0, color = '#ffffff', label = 'a note', reach = ECHO.reach } = {}) {
      if (!items.has('echo') || !player || !pos || !note) return false;
      if (player.pos.distanceTo(pos) > reach) return false;
      const was = shell.held;
      game.set('echo.held', { note, degree, color, label });
      if (!was || was.note !== note) {
        sound?.critter?.('blip', 0.5);
        const key = told.size ? 'again' : 'first';
        if (!told.has(key)) { told.add(key); toast(key === 'first' ? `The shell catches ${label} and holds it. V (or RS / R3) plays it back.` : `The shell holds ${label} now.`); }
      }
      return true;
    },
    /** Play back what it holds, where you stand. Returns true if it did. */
    play() {
      const h = shell.held;
      if (!items.has('echo') || !player || player.hidden || cool > 0) return false;
      if (!h) { if (!told.has('empty')) { told.add('empty'); toast('The shell is quiet. It holds nothing yet: let something sing near it.'); } return false; }
      cool = ECHO.cool;
      sound?.orbNote?.(h.degree ?? 0, player.pos, { soft: true, size: 0.6 });
      game.emit('echo', { pos: player.pos.clone(), note: h.note, degree: h.degree, color: h.color });
      return true;
    },
    update(dt) { cool = Math.max(0, cool - dt); },
    dispose() { off?.(); },
  };
  const off = game.on?.('note', (e) => shell.hear(e));
  return shell;
}
