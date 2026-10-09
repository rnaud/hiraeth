import { ARCHETYPES, archetypeOfKind } from '../archetypes.js';
import { skinOf } from '../skins.js';
import { crabModel } from './walker.js';
import { lizardModel, houndModel } from './quadruped.js';
import { tripodModel } from './piston.js';
import { blotModel } from './blob.js';

// One body builder per body plan (docs/design/enemy-roster.md, "Build plan"): each exposes its joints to the
// locomotion kit (src/motion-kit/) and draws the archetype in a world's skin (src/enemies/skins.js); a skin only
// recolours and dresses it. A model is { group, body, rig, parts, eyeMat, size, tones, tell(attackId), anim(f, c),
// dispose() }, drawn by src/foes.js Foes.look like the old kinds' (src/foe-kinds.js).
//
//   walker.js     plan 1   the shellback crab
//   quadruped.js  plan 6   the horn lizard and the antler hound (one rig, two archetypes)
//   piston.js     plan 18  the lamp tripod
//   blob.js       plan 20  the ink blot

const BUILDERS = { crab: crabModel, lizard: lizardModel, hound: houndModel, tripod: tripodModel, blot: blotModel };

/** The body of a built archetype's kind in a world's skin, or null (not one: an old kind draws itself). */
export function archetypeModel(kind, world) {
  const a = archetypeOfKind(kind);
  if (!a || ARCHETYPES[a].status !== 'built' || !BUILDERS[a]) return null;
  return BUILDERS[a](skinOf(a, world));
}
