// A view's own save (issue #793): the web's pictures load it before the page boots (scripts/changelog-shots.mjs
// `storage`: localStorage cleared, `hiraeth.game.v1` set to view.save), so a view of the Rose House with its bowl lit and
// its bridge up shows them so. The engines' batch runs at fixed views (engine/unity/game.js -views) built every view on
// the bench's save instead (the backpack found, nothing else), so the same view in Unity showed the house reset. The
// engines now start such a run from the view's save, as the page does, migrated as the page migrates a save it reads
// (src/game-state.js reload). One world is built a run: the first view with a save gives it; views with another save
// are named (`mixed`), to be shot in a run of their own.
import { migrateFlags } from '../src/save-migrate.js';

const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/** The save a run of these views starts from (the first view's `save`, { flags, keepsakes }), and the views that want another. */
export function viewSave(views = []) {
  const withSave = (views ?? []).filter((v) => v?.save?.flags);
  const save = withSave[0]?.save ?? null;
  return { save, mixed: withSave.filter((v) => !same(v.save, save)).map((v) => v.name) };
}

/** The game state made that save, as the page's storage holds it before it boots: its flags (migrated) and keepsakes. */
export function seedViewSave(state, save) {
  const flags = { ...(save?.flags ?? {}) }, keepsakes = [...(save?.keepsakes ?? [])];
  migrateFlags(flags, keepsakes);
  state.data = { ...state.data, flags, keepsakes };
  state.save?.();
  return state.data;
}
