// Compose a world marker with the game's default catalogue. The implementation also
// accepts an explicit list in marker-core.js so focused checks need only their games.
import { GAMES } from '../index.js';
import { placeGameMarker as placeMarker } from './marker-core.js';
export { gameMarkerModel, signPlate } from './marker-core.js';

export function placeGameMarker(world, gameId, pos, options = {}) {
  const { games = GAMES, ...rest } = options;
  return placeMarker(world, gameId, pos, { ...rest, games });
}
