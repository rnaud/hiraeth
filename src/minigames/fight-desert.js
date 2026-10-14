// The desert's fight temple, the Sunken Hall (issue #341): its table is src/fight-temples/desert.js, the template
// src/fight-temples/ (docs/design/fight-temples.md). A fight temple is a minigame played on foot under an isometric
// camera, its sign the hall's doorway by the pilgrims' camps, its host beside it.
import { fightTempleGame } from '../fight-temples/index.js';
import { DESERT_FIGHT } from '../fight-temples/desert.js';

export default fightTempleGame(DESERT_FIGHT);
