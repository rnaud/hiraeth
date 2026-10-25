// Preserve the former play-suite membership; new eligible sequences default to main.
import { FIGHTS } from './sequences-fights.js';
const OUTDOORS = new Set(['hoverbike', 'skull-cave', 'pits', 'grass-splats', 'bird', 'splat', 'decals']);
export const wasPlaySequence = (s) => !s.id.startsWith('moment-') && s.id !== 'opening' && s.id !== 'hold' && s.id !== 'plumb-talk' && !FIGHTS.has(s.id);
export function playPartition(s) {
  if (!wasPlaySequence(s)) return null;
  if (s.id.startsWith('game-')) return 'games';
  return OUTDOORS.has(s.id) ? 'outdoors' : 'main';
}
