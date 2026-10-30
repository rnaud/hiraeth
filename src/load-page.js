// The loading screen's words and its bar (issue #506): under the turning pen, the stage's line as before ("sketching
// the desert…", "mixing the inks…"), a smaller line saying why this part takes the time, and an inked bar that moves
// with the load's real steps (main.js setStep, src/load-steps.js; the engines' stamps, engine/game.js). Shared by the
// page and the engines (Unity's BridgeHud.Loading draws what onStage hands it).
//
// The bar: each step's share of a typical load, from the steps' times on the Mac (docs/systems/performance.md, "The
// loading page", the desert's and a fight temple's runs). It moves when a step begins, never back; a step a world
// doesn't have is passed over. A step's line is kept until another step has one of its own.

// What it says (issue #791): "Loading" alone, small in the corner of a black screen, the bar beside it; the stages' lines
// and the why lines below still go to the log, the title's hold and the engines, but are not shown. A line that is no
// stage of the load (a failure: "Sound effects couldn’t load.") is shown whole, so it can be read.
export const LOAD_WORD = 'Loading';

/** The words the loading mark shows for the load's last line: "Loading" while it goes, a failure's line as it is. */
export function loadWords(line) {
  const l = String(line ?? '').trim();
  if (!l || l === 'ready' || stageIndex(l) >= 0 || /^loading\b/i.test(l)) return LOAD_WORD;
  return l;
}

/** The four stages (main.js stage()), in order: the start of each stage's line, and the steps it runs, [name, weight]. */
export const LOAD_PLAN = [
  { stage: 'sketching', steps: [['world', 900], ['openings', 15]] },
  { stage: 'inking', steps: [['bake', 180], ['level init', 3], ['water', 2], ['buried flora', 2], ['ship', 85], ['reactive', 40], ['tiling', 80]] },
  { stage: 'waking', steps: [['player', 3], ['assets wait', 25], ['traveller', 200], ['sound, tool', 170], ['npcs', 100], ['crowd', 40], ['crowd pool', 35], ['story', 300], ['flora', 130], ['grass', 5], ['wildlife, foes', 10], ['rest', 40]] },
  { stage: 'mixing', steps: [['near detail', 30], ['batches', 250], ['surfaces', 450], ['post', 30], ['water', 20], ['shadows', 30], ['first use', 20], ['passage', 350], ['late surfaces', 40]] },
];

/** Why a step takes its time, in the game's words: short, lower case, as the stage's line. */
export const LOAD_WHY = {
  world: 'laying out the ground and the walls',
  bake: 'the walls learn where you can’t walk',
  traveller: 'dressing the traveller',
  'sound, tool': 'tuning the sounds',
  npcs: 'everyone to their places',
  story: 'remembering what happened here',
  flora: 'the plants take root',
  batches: 'gathering the still things into a few strokes',
  surfaces: 'teaching the graphics card this world’s light, slowest the first time',
  shadows: 'the sun learns every shape’s shadow',
  passage: 'a first look round, so nothing stutters later',
};

const TOTAL = LOAD_PLAN.reduce((a, s) => a + s.steps.reduce((b, [, w]) => b + w, 0), 0);
// (where each stage's steps begin, as a share of the whole)
const STARTS = (() => {
  const out = []; let at = 0;
  for (const s of LOAD_PLAN) { out.push(at); at += s.steps.reduce((b, [, w]) => b + w, 0); }
  return out;
})();

/** The stage a stage's line belongs to (its first word: "sketching the desert…" is 'sketching'), its index, or -1. */
export function stageIndex(line) {
  const w = String(line ?? '').trim().split(/\s+/)[0]?.toLowerCase();
  return LOAD_PLAN.findIndex((s) => s.stage === w);
}

/** How far the load is (0-1) when `step` of the stage whose line is `line` begins ('' or none: the stage's start; 'ready': 1). */
export function loadShare(line, step = '') {
  if (line === 'ready') return 1;
  const i = stageIndex(line);
  if (i < 0) return 0;
  let at = STARTS[i];
  if (step) {
    const steps = LOAD_PLAN[i].steps, k = steps.findIndex(([n]) => n === step);
    if (k < 0) return at / TOTAL;
    for (let j = 0; j < k; j++) at += steps[j][1];
  }
  return Math.min(1, at / TOTAL);
}

/**
 * The loading screen's state as the load goes: progress.stage(line) at each stage, progress.step(name) at each step;
 * each returns { line, why, p } (p never goes back), and `onChange` gets it too.
 */
export function loadProgress(onChange = () => {}) {
  let line = '', why = '', p = 0;
  const out = () => { const s = { line, why, p }; try { onChange(s); } catch { /* a screen gone */ } return s; };
  return {
    stage(l) { line = l; p = Math.max(p, loadShare(l)); return out(); },
    step(name) {
      if (LOAD_WHY[name]) why = LOAD_WHY[name];
      p = Math.max(p, loadShare(line, name));
      return out();
    },
    get state() { return { line, why, p }; },
  };
}
