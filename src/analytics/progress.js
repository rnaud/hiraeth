// Versioned milestone estimate; never loads world/temple registries or sends save contents.
import { ORDER, TITLES, worldFor } from '../levels/names.js';
// Pinned for model 1; completion.test.js catches route changes requiring a new model.
export const STORY_WORLD_TARGET = 11;
export const STORY_FLAGS = ['prologue.done', 'ending.done', 'finale.met', 'ending.final'];
export function storyProgress(name, worlds, milestones, model = 1) {
  if (model !== 1 || typeof name !== 'string' || !Object.hasOwn(TITLES, name) || !Number.isInteger(worlds) || worlds < 0 || worlds > ORDER.length
    || !Number.isInteger(milestones) || milestones < 0 || milestones > 15) return null;
  const final = !!(milestones & 8);
  const checkpoints = [1, 2, 4].filter(bit => milestones & bit).length;
  const value = final ? 100 : Math.floor(100 * (Math.min(worlds, STORY_WORLD_TARGET) + checkpoints) / (STORY_WORLD_TARGET + 4));
  const status = final ? 'true-ending' : milestones & 4 ? 'ilen-found' : milestones & 2 ? 'homecoming' : milestones & 1 ? 'exploring' : 'prologue';
  return { type: 'progress', category: 'Story', model, name, worlds, milestones, value, status };
}
export function progressSnapshot(game, world) {
  if (!game?.flag || !world) return null;
  let stories = {};
  try { stories = JSON.parse(game.storage?.getItem('hiraeth.journal.v1') ?? '{}')?.stories ?? {}; } catch { /* older/corrupt journal */ }
  const worlds = ORDER.filter(id => game.flag(`world.${id}.done`) || stories[id]).length;
  const milestones = STORY_FLAGS.reduce((bits, key, i) => bits | (game.flag(key) ? 1 << i : 0), 0);
  return storyProgress(worldFor(world, world), worlds, milestones);
}
