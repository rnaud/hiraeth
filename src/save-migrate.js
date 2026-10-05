// Old saves, brought up to date when they load (src/game-state.js calls migrateFlags).
//
// People with the same name in two worlds used to share one id, so meeting one
// marked the other as met too (the credits, the mother's "who did you meet"). The
// later one of each pair now has an id of its own, '<name>.<world>'. A save that
// met "hask" before cannot say which Hask it was: if the player has been to the
// renamed person's world, they are taken to have met them too (a little generous,
// never wrong the other way). Clemence's id was an old name (malvina): renamed outright.
//
// Each step runs once per save (flag `save.migrated` holds the last step done).

export const RENAMED_PEOPLE = [
  { from: 'hask', to: 'hask.buried', world: 'buried' },
  { from: 'ossa', to: 'ossa.buried', world: 'buried' },
  { from: 'pip', to: 'pip.garage', world: 'garage' },
  { from: 'lio', to: 'lio.edena', world: 'edena' },
  { from: 'hollin', to: 'hollin.perdide2', world: 'perdide2' },
  { from: 'pim', to: 'pim.perdide2', world: 'perdide2' },
  { from: 'aube', to: 'aube.spheres', world: 'spheres' },
  { from: 'ivo', to: 'ivo.perdide', world: 'perdide' },
];
/** Ids that were only ever one person's: every flag moves over. */
export const MOVED_PEOPLE = [{ from: 'malvina', to: 'clemence' }];

/** The player has been to this world: its story has started (its quests or its own flags). */
export function visited(flags, world) {
  const a = `quest.${world}.`, b = `${world}.`, c = `world.${world}.`;
  return Object.keys(flags).some((k) => k.startsWith(a) || k.startsWith(b) || k.startsWith(c));
}

const STEPS = [
  // 1: the people who shared an id
  (flags) => {
    for (const { from, to, world } of RENAMED_PEOPLE) {
      if (flags[`met.${from}`] && flags[`met.${to}`] === undefined && visited(flags, world)) flags[`met.${to}`] = true;
    }
    for (const { from, to } of MOVED_PEOPLE) {
      for (const k of Object.keys(flags)) {
        for (const p of ['met.', 'said.']) {
          if (k === `${p}${from}` || k.startsWith(`${p}${from}.`)) {
            const nk = p + to + k.slice(p.length + from.length);
            if (flags[nk] === undefined) flags[nk] = flags[k];
            delete flags[k];
          }
        }
      }
    }
  },
];

/** The step a fresh save starts at (src/game-state.js reset): nothing to migrate. */
export const MIGRATED = () => STEPS.length;

/** Bring a save's flags up to date (in place). Returns true if anything ran. */
export function migrateFlags(flags) {
  if (!flags) return false;
  const done = flags['save.migrated'] ?? 0;
  if (done >= STEPS.length) return false;
  // a brand-new game has nothing to migrate
  if (!Object.keys(flags).length) { flags['save.migrated'] = STEPS.length; return false; }
  for (let i = done; i < STEPS.length; i++) STEPS[i](flags);
  flags['save.migrated'] = STEPS.length;
  return true;
}
