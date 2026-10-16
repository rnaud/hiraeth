// The sound QC's scenarios (.claude/skills/sound-qc/SKILL.md): a player's hands in the engines' build of the game
// (scripts/sound-qc/drive.mjs), in the desert with its foes on. steps: [frames, { key: down }] at 30 frames a second
// (a key stays as set until changed); the press is the first step's first frame; each(g, f): every frame (f from 0).
// The keys: src/bindings.js KEYS (blade F, guard Ctrl, evade Alt, jump Space, lock Tab, scout Q, potion: the pad's).

const V = (g, x, y, z) => new g.player.pos.constructor(x, y, z);
const foeAhead = (dist) => (g) => { g.foes.spawnKind('blot', { n: 1, dist }); };

export const SCENARIOS = {
  walk: { steps: [[40, { KeyW: true }], [10, { KeyW: false }]] },
  sprint: { steps: [[40, { KeyW: true, ShiftLeft: true }], [10, { KeyW: false, ShiftLeft: false }]] },
  jump: { steps: [[2, { Space: true }], [40, { Space: false }]] },
  fall: { setup: (g) => { const p = g.player; p.teleport(p.pos.clone().add(V(g, 0, 7, 0)), p.frame.up.clone(), V(g, 0, 0, 1)); }, steps: [[60, {}]] },
  evade: { steps: [[2, { AltLeft: true }], [30, { AltLeft: false }]] },
  combo: { steps: [[2, { KeyF: true }], [8, { KeyF: false }], [2, { KeyF: true }], [8, { KeyF: false }], [2, { KeyF: true }], [40, { KeyF: false }]] },
  hit: { setup: foeAhead(2.2), steps: [[2, { KeyF: true }], [30, { KeyF: false }]] },
  guard: { steps: [[30, { ControlLeft: true }], [30, { ControlLeft: false }]] },
  lock: { setup: foeAhead(6), steps: [[2, { Tab: true }], [20, { Tab: false }]] },
  hurt: { steps: [[31, {}]], each: (g, f) => { if (f === 0) g.player.hurt(1, 'foe'); } },
  knockout: { steps: [[61, {}]], each: (g, f) => { if (f === 0) { g.player.hearts = 0.25; g.player.hurt(1, 'foe'); } } },
  // (the engines have no potion key: the pad's D-pad ←, the 'potion' action, combat.drink())
  potion: { setup: (g) => { g.player.hearts = 1; }, steps: [[70, {}]], each: (g, f) => { if (f === 0) g.combat?.drink?.(); } },
  low: { setup: (g) => { g.player.hearts = 0.75; }, steps: [[90, {}]] },
  scout: { steps: [[2, { KeyQ: true }], [30, { KeyQ: false }]] },
};
