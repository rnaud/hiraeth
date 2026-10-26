// The screen while you play holds nothing at rest (docs/systems/ui.md, "Nothing on the screen"). What used
// to sit in the status box comes only when it matters, then fades:
//   - the cue (index.html #cue): one short line at the top, first in the hints' stack (issue #306: every hint one look,
//     one place, src/hint-look.js), for what the use button does
//     right here when it has no person or thing to float over (the ship's hatch and console, a
//     lens), and a region's name as you cross into it; nothing while riding (no list of a
//     vehicle's buttons as you get on: the settings' Controls page has them);
//   - the hearts, the magic bar and the potion (index.html #health: heartsSvg, magicHud) while a heart is
//     missing, the bar is spending or refilling, or a fight is on; the chimes beside them, and the block
//     for a moment whenever they change (walletTick counts them up); the stamina wheel while not full
//     (main.js, ui.js ToolHud), each lingering a moment (Fader);
//   - the objective: the scout finds it (Q, D-pad →: src/scout.js) and the cue says its goal over its
//     next step (findSummary); the game menu's Quests panel shows the same for every quest (src/game-menu.js).
import { page } from './platform.js';
import { CueState } from './hud-state.js';
import { renderCue } from './hud-view.js';
export * from './hud-state.js';
export * from './hud-view.js';

/** Browser cue: shared state publication plus DOM rendering and resize layout. */
export class Cue extends CueState {
  constructor(el = page.byId('cue')) {
    super({ enabled: !!el, render: (...args) => renderCue(el, ...args) });
    this.el = el;
    if (el && typeof globalThis.ResizeObserver === 'function') {
      this.sizeObserver = new ResizeObserver(() => this.onChange?.()); this.sizeObserver.observe(el);
    }
  }
  dispose() { this.sizeObserver?.disconnect(); }
}
