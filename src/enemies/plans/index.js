import { ARCHETYPES, archetypeOfKind } from '../archetypes.js';
import { skinOf } from '../skins.js';
import { crabModel } from './walker.js';
import { lizardModel, houndModel } from './quadruped.js';
import { tripodModel } from './piston.js';
import { blotModel } from './blob.js';
import { centipedeModel } from './centipede.js';
import { wormModel } from './burrower.js';
import { rayModel } from './glider.js';
import { mothModel } from './flyer.js';
import { jellyModel } from './floater.js';
import { toadModel } from './hopper.js';
import { heronModel } from './stilt.js';
import { skitterModel } from './skitterers.js';
import { rootknotModel } from './tentacled.js';
import { bruteModel } from './brute.js';
import { droneModel } from './hover.js';
import { cartModel } from './tracked.js';
import { bellModel } from './siege.js';
import { shadeModel } from './humanoid.js';
import { rollerModel } from './roller.js';
import { marionetteModel } from './strings.js';

// One body builder per body plan (docs/design/enemy-roster.md, "Build plan"): each exposes its joints to the
// locomotion kit (src/motion-kit/) and draws the archetype in a world's skin (src/enemies/skins.js); a skin only
// recolours and dresses it. A model is { group, body, rig, parts, eyeMat, size, tones, tell(attackId), anim(f, c),
// dispose() }, drawn by src/foes.js Foes.look like the old kinds' (src/foe-kinds.js).
//
//   walker.js     plan 1   the shellback crab
//   skitterers.js plan 2   the skitter swarm (a flock of tiny tripods at the mid tier)
//   centipede.js  plan 3   the ring centipede (a spine on its own path, legs in a metachronal wave)
//   hopper.js     plan 5   the bellows toad (hop by hop: its body lands each hop on planted feet)
//   quadruped.js  plan 6   the horn lizard and the antler hound (one rig, two archetypes)
//   brute.js      plan 8   the furnace brute (a slow heavy biped, its arms swinging; the hull and limbs skinned)
//   humanoid.js   plan 9   the shade (a cloak worn by nothing on two empty boots; ribbons on verlet chains)
//   stilt.js      plan 7   the stilt heron (two stilts one at a time, an S-neck of segments)
//   floater.js    plan 11  the lantern jelly
//   tentacled.js  plan 12  the root knot (five three-segment root-arms on FABRIK)
//   flyer.js      plan 13  the signal moth
//   hover.js      plan 13  the ring drone (a machine's: plates spinning on a spindle, dangling arms)
//   glider.js     plan 14  the sky ray
//   burrower.js   plan 15  the mound worm
//   roller.js     plan 16  the pearl roller (a snail on its rippling foot; rolled, its spin locked to the ground)
//   tracked.js    plan 17  the crucible cart (tracks locked to the ground, a turret on a spring)
//   piston.js     plan 18  the lamp tripod
//   siege.js      plan 19  the bell walker (five spider legs, the bell and its clapper on pendulums)
//   blob.js       plan 20  the ink blot
//   strings.js    plan 21  the marionette (a puppet hung on four strings from a knot of smoke, a pendulum)

const BUILDERS = { crab: crabModel, lizard: lizardModel, hound: houndModel, tripod: tripodModel, blot: blotModel, centipede: centipedeModel, worm: wormModel, ray: rayModel, moth: mothModel, jelly: jellyModel,
  toad: toadModel, heron: heronModel, skitter: skitterModel, rootknot: rootknotModel, brute: bruteModel, drone: droneModel, cart: cartModel, bell: bellModel,
  shade: shadeModel, roller: rollerModel, marionette: marionetteModel };

/** The body of a built archetype's kind in a world's skin, or null (not one: an old kind draws itself). */
export function archetypeModel(kind, world) {
  const a = archetypeOfKind(kind);
  if (!a || ARCHETYPES[a].status !== 'built' || !BUILDERS[a]) return null;
  return BUILDERS[a](skinOf(a, world));
}
