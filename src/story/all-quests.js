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
import { QUESTS as underwater } from './underwater-people.js';
import { QUESTS as moonfoundry } from './moonfoundry-people.js';
import { QUESTS as spacecity } from './spacecity-people.js';
import { QUESTS as lantern } from './lantern-data.js';
import { QUESTS as nightmail } from './night-train-data.js';
import { QUEST as tDesert } from '../temples/desert-data.js';
import { QUEST as tIncal } from '../temples/incal-data.js';
import { QUEST as tArzach } from '../temples/arzach-data.js';
import { QUEST as tArzach2 } from '../temples/arzach2-data.js';
import { QUEST as tGarage } from '../temples/garage-data.js';
import { QUEST as tBuried } from '../temples/buried-data.js';
import { QUEST as tEdena } from '../temples/edena-data.js';
import { QUEST as tSpheres } from '../temples/spheres-data.js';
import { QUEST as tPerdide } from '../temples/perdide-data.js';
import { QUEST as tPerdide2 } from '../temples/perdide2-data.js';
import { QUEST as tBazaar } from '../temples/bazaar-data.js';
import { QUEST as tUnderwater } from '../temples/underwater-data.js';
import { QUEST as tMoonfoundry } from '../temples/moonfoundry-data.js';
import { QUEST as tSpacecity } from '../temples/spacecity-data.js';

// The temples' quests are built at run time from their words (src/temples/index.js setupOneTemple: the
// world is the QUEST's own, or the temple's id); their ids, titles and outros are here.
const TEMPLE_QUESTS = Object.entries({
  desert: tDesert, incal: tIncal, arzach: tArzach, arzach2: tArzach2, garage: tGarage, buried: tBuried, edena: tEdena,
  spheres: tSpheres, perdide: tPerdide, perdide2: tPerdide2, bazaar: tBazaar, underwater: tUnderwater, moonfoundry: tMoonfoundry, spacecity: tSpacecity,
}).map(([id, Q]) => ({ id: Q.id, title: Q.title, world: Q.world ?? id, outro: Q.outro }));

/** [{ id, title, world, outro, failOutro }] of every world's quests (the Lantern's, the night mail's, the temples'). */
export const ALL_QUESTS = [desert, incal, arzach, arzach2, garage, buried, edena, spheres, perdide, perdide2, bazaar, underwater, moonfoundry, spacecity, lantern, nightmail, TEMPLE_QUESTS]
  .flat().map(({ id, title, world, outro, failOutro }) => ({ id, title, world, outro, failOutro }));
