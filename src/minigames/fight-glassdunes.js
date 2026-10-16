// A fight temple (issue #341): its table is src/fight-temples/glassdunes.js, the template src/fight-temples/
// (docs/design/fight-temples.md). Played on foot under an isometric camera; its sign the doorway in its world, its host beside it.
import { fightTempleGame } from '../fight-temples/index.js';
import { GLASSDUNES_FIGHT } from '../fight-temples/glassdunes.js';

export default fightTempleGame(GLASSDUNES_FIGHT);
