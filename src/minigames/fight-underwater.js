// A fight temple (issue #341): its table is src/fight-temples/underwater.js, the template src/fight-temples/
// (docs/design/fight-temples.md). Played on foot under an isometric camera; its sign the doorway in its world, its host beside it.
import { fightTempleGame } from '../fight-temples/index.js';
import { UNDERWATER_FIGHT } from '../fight-temples/underwater.js';

export default fightTempleGame(UNDERWATER_FIGHT);
