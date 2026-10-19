// The fight in the engines (issue #264): the game's own wiring is the one game setup's (src/host/game-host.js wireFight,
// issue #435: the foes and their drops, the lock-on and its camera, the perfect dodge's flurry, the potion, the
// low-health cue and the knock-out, as main.js has them); what is here is the engines' own layer: what the page draws
// over the picture for them, as the screen's state for the engine's HUD (src/platform.js screen; BridgeHud.cs):
//   'lock'    the reticle's four arrows (src/lock-reticle.js, its view: px of the stand-in window, W × H)
//   'warn'    the markers of foes winding up out of sight (Foes.warnings' warnView: x, y -1..1)
//   'edges'   the low-health edges, the flurry's vignette, a moth's white flash (0..1 each)
//   'restart' the knock-out's card ("You were knocked out", A / × to get up)
// The guardians are the temples' own (src/temples/runtime.js, updated by the story): wireFight adds the lock and its camera.
// The world's hazards bite in wireDangers (engine/game.js), once a frame as on the page (here too before #435: twice).
//
//   const combat = makeCombat({ scene, level, levelId, content, physics, player, tool, sound, npcs, settings, camera, rig, lib, humans, waters, screen, toast, teach, health });
//   combat.update(dt, realDt, { busy, paused })   after the traveller and the rig, before the frame is drawn
//   combat.frame(realDt, busy)                    the lock's camera, after the rig
//   combat.lock() / drink() / restart()           R3 and Tab, D-pad ←, the restart's confirm
import { wireFight } from '../src/host/game-host.js';
import { flurryK } from '../src/feel.js';
import { game as sharedGame } from '../src/game-state.js';
import { t as tr } from '../src/i18n.js';

const r2 = (v) => Math.round(v * 100) / 100;

export function makeCombat({ scene, level, levelId, content, physics, player, tool, sound, npcs, settings, camera, rig, lib, humans, waters, screen, toast = () => {}, teach = toast, game = sharedGame, health = null }) {
  const F = wireFight({ scene, level, levelId, content, physics, player, tool, sound, npcs, settings, camera, rig, lib, humans, waters, game, toast, teach, health, lowParent: null });
  const { foes } = F;
  let edges = '';
  const C = {
    foes, chimes: F.chimes, potionDrops: F.potionDrops, lowHealth: F.lowHealth, lockView: F.lockView,
    /** The right stick's tilt (aiming locked on, it shifts the aim: src/lock-aim.js). */
    set padLook(fn) { F.padLook = fn; },
    get restartOpen() { return F.cardOpen; },
    knockout: (why) => F.knockout(why),
    /** R3 / Tab: lock on to a foe, then the next, then let go; false: none in reach (the camera turns behind you then, as main.js; Plumb is D-pad →). */
    lock: () => F.lock(),
    /** D-pad ←: a healing potion (main.js drinkPotion). */
    drink: () => F.drink(),
    /** The restart card's confirm: up again at the last safe place. */
    restart() {
      if (!F.restart()) return false;
      screen.set('restart', null);
      return true;
    },
    /** A foe near (LB blocks, the right stick only looks: the controller's combat()). */
    near: (r = 20) => foes.near(r),
    /** Per frame, the world's step (dt: slowed by a hit-stop or the flurry) and the real one. */
    update(dt, realDt, { busy = false, paused = false } = {}) {
      F.update(dt, busy || paused);
      // the knock-out's card
      const card = F.card(realDt, paused);
      if (card) screen.set('restart', card.open ? { text: card.text, key: 'A / ×', label: tr('restart.button') } : null);
      // the edges: one heart or less (the heartbeat's pulse), the flurry's slow time, a moth's flash
      const e = { low: r2(F.low(realDt, busy || paused)), flurry: r2(flurryK()), blind: r2(foes.blindLevel?.() ?? 0), tone: foes.blindTone ?? '#ff5fa2' };
      const ek = `${e.low}|${e.flurry}|${e.blind}`;
      if (ek !== edges) { edges = ek; screen.set('edges', e.low || e.flurry || e.blind ? e : null); }
      // the reticle and the markers of foes winding up out of sight, as the page draws them
      const R = foes.reticle?.view;
      screen.set('lock', R && foes.lock && !busy && !paused ? {
        x: r2(R.cx / R.W), y: r2(R.cy / R.H), k: r2(R.k * 720 / R.H), hollow: !!R.hollow, a: r2(R.opacity),
        arrows: R.arrows.map(([x, y, d]) => [+(x / R.H).toFixed(4), +(y / R.H).toFixed(4), Math.round(d)]),
      } : null);
      const W = foes.warnView;
      screen.set('warn', W?.length && !busy && !paused ? W.map((w) => ({ x: r2(w.x), y: r2(w.y), k: r2(w.k ?? 0), tone: w.tone })) : null);
    },
    /** The lock's camera, after the rig has placed it (main.js's frame): the traveller faces the foe, strafing round it. */
    frame(realDt, busy) { F.frame(realDt, { busy }); },
    dispose() { F.dispose(); },
  };
  return C;
}
