// Every world's own quests, as data (their *-data.js modules hold nothing else): what the game menu's
// Quests panel needs to name a quest finished in another world. A world's story defines its quests only
// when you are there (src/story/<world>.js), so in Vael the desert's finished quest was nowhere to be
// found and the panel's Done list read "None yet" (src/game-menu-data.js questsData).
import { QUESTS as desert } from './desert-data.js';
import { QUESTS as incal } from './incal-data.js';
import { QUESTS as arzach } from './arzach-data.js';
import { QUESTS as arzach2 } from './arzach2-data.js';
import { QUESTS as garage } from '../levels/dismissed/hangar/story-data.js';
import { QUESTS as buried } from './buried-data.js';
import { QUESTS as edena } from './edena-data.js';
import { QUESTS as spheres } from './spheres-data.js';
import { QUESTS as perdide } from './perdide-data.js';
import { QUESTS as perdide2 } from './perdide2-data.js';
import { QUESTS as bazaar } from './bazaar-data.js';

/** [{ id, title, world, outro, failOutro }] of every world's quests. */
export const ALL_QUESTS = [desert, incal, arzach, arzach2, garage, buried, edena, spheres, perdide, perdide2, bazaar]
  .flat().map(({ id, title, world, outro, failOutro }) => ({ id, title, world, outro, failOutro }));
