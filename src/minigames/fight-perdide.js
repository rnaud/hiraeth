// A fight temple (issue #341): its table is src/fight-temples/perdide.js, the template src/fight-temples/
// (docs/design/fight-temples.md). Played on foot under an isometric camera; its sign the doorway in its world, its host beside it.
import { fightTempleGame } from '../fight-temples/index.js';
import { PERDIDE_FIGHT } from '../fight-temples/perdide.js';

export default fightTempleGame(PERDIDE_FIGHT);
