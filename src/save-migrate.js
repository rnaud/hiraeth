// Old saves, brought up to date when they load (src/game-state.js calls migrateFlags).
//
// People with the same name in two worlds used to share one id, so meeting one
// marked the other as met too (the credits, the mother's "who did you meet"). The
// later one of each pair now has an id of its own, '<name>.<world>'. A save that
// met "hask" before cannot say which Hask it was (the City-Shaft's seller of views is Tobin now): if the player has been to the
// renamed person's world, they are taken to have met them too (a little generous,
// never wrong the other way). Clemence's id was an old name (malvina): renamed outright.
//
// Since the true ending came in (October 2026), a save that ended under the old rules has had its first
// homecoming (step 2).
//
// Dov's lift token used to be given outright; since it became a choice (keep it, or give it back), a save
// that has the token among its keepsakes but no `incal.token` kept it (step 3): the Lantern, Dov and the
// stone then read it as kept (src/story/ending.js choicesMade).
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
  // 2: two homecomings (src/story/ending.js). A save that saw the old ending (`ending.done`: the stone, the
  // oldest recording, the credits) has had its first homecoming: it stays done, marked 'old', and the
  // true ending waits for Ilen (the Lantern opens once the Signal Market has been heard). The reel the
  // old ending left on the stone is in his pocket again (the slab shows it only after `ending.final`);
  // the ship's log of the light over the hill waits on the voicemail (calls.js TRACE_CALL) to point the way.
  (flags) => {
    if (flags['ending.done'] && !flags['ending.first'] && !flags['ending.final']) flags['ending.first'] = 'old';
  },
  // 3: Dov's lift token, given before it was a choice: kept (the keepsake is the proof; `incal.dov.fed`
  // alone isn't: a newer save may have stopped between feeding him and choosing)
  (flags, keepsakes) => {
    if (flags['incal.token'] === undefined && keepsakes?.some((k) => k.id === 'incal.token')) flags['incal.token'] = 'kept';
  },
];

/** The step a fresh save starts at (src/game-state.js reset): nothing to migrate. */
export const MIGRATED = () => STEPS.length;

/** Bring a save's flags up to date (in place; `keepsakes` is read, never changed). Returns true if anything ran. */
export function migrateFlags(flags, keepsakes = []) {
  if (!flags) return false;
  const done = flags['save.migrated'] ?? 0;
  if (done >= STEPS.length) return false;
  // a brand-new game has nothing to migrate
  if (!Object.keys(flags).length) { flags['save.migrated'] = STEPS.length; return false; }
  for (let i = done; i < STEPS.length; i++) STEPS[i](flags, keepsakes);
  flags['save.migrated'] = STEPS.length;
  return true;
}
