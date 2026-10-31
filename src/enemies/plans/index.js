import { ARCHETYPES, archetypeOfKind } from '../archetypes.js';
import { skinOf } from '../skins.js';
import { shellbackCrab } from './shellback-tripo.js';
import { lizardModel } from './quadruped.js';
import { houndModel } from './hound-tripo.js';
import { tripodModel } from './tripod-tripo.js';
import { blotModel } from './blot-tripo.js';
import { centipedeModel } from './centipede-tripo.js';
import { wormModel } from './worm-tripo.js';
import { stormRay } from './storm-ray-tripo.js';
import { lampMoth } from './lamp-moth-tripo.js';
import { cloudJelly } from './cloud-jelly-tripo.js';
import { toadModel } from './toad-tripo.js';
import { heronModel } from './stilt.js';
import { skitterModel } from './skitter-tripo.js';
import { rootknotModel } from './tentacled.js';
import { bruteModel } from './brute.js';
import { droneModel } from './drone-tripo.js';
import { legacyCartModel } from './tracked.js';
import { tripoCartModel } from './cart-tripo.js';
import { legacyBellModel } from './siege.js';
import { tripoBellModel } from './bell-tripo.js';
import { shadeModel } from './humanoid.js';
import { legacyRollerModel } from './roller.js';
import { tripoRollerModel } from './roller-tripo.js';
import { marionetteModel } from './strings.js';
import { wispModel } from './ember.js';
import { fencerModel } from './fencer.js';
import { mummerModel, mummerKingModel } from './mummer.js';
import { gruntModel, hulkModel, prowlerModel, warlordModel } from './monster.js';
import { sentinelModel } from './sentinel.js';
import { oracleModel } from './oracle.js';
import { crawlerModel } from './crawler-tripo.js';
import { woodcutterModel } from './woodcutter.js';
import { tripoWoodcutterModel } from './woodcutter-tripo.js';
import { duneMummerModel } from './dune-mummer.js';
import { tripoMummerModel } from './dune-mummer-tripo.js';
import { foeSource } from '../foe-assets.js';

// One body builder per body plan (docs/design/enemy-roster.md, "Build plan"): each exposes its joints to the
// locomotion kit (src/motion-kit/) and draws the archetype in a world's skin (src/enemies/skins.js); a skin only
// recolours and dresses it. A model is { group, body, rig, parts, eyeMat, size, tones, tell(attackId), anim(f, c),
// dispose() }, drawn by src/foes.js Foes.look like the old kinds' (src/foe-kinds.js).
//
//   shellback-tripo.js plan 1  the shellback crab (issue #800: Tripo's body, public/enemies/shellback/body.glb, on the
//                 walker plan; the direct shellback.js stands in where the body is not loaded)
//   skitter-tripo.js plan 2 the skitter swarm (issue #800: Tripo's body, public/enemies/skitter/body.glb, eight legs on the
//                 skitterers plan; the legacy skitter, skitterers-legacy.js, stands in where the body is not loaded)
//   centipede.js  plan 3   the ring centipede (a spine on its own path, legs in a metachronal wave)
//   quadruped.js  plan 6   the horn lizard
//   hound-tripo.js plan 6  the horned hound (issue #800: Tripo's body, public/enemies/hound/body.glb, on the quadruped
//                 plan; the direct broad-hound.js stands in where the body is not loaded)
//   toad-tripo.js plan 5   the bellows toad (issue #800: Tripo's body, public/enemies/bellows-toad/body.glb, hop by hop on
//                 planted feet; the legacy toad, hopper-legacy.js, stands in where the body is not loaded)
//   brute.js      plan 8   the furnace brute (a slow heavy biped, its arms swinging; the hull and limbs skinned)
//   humanoid.js   plan 9   the shade (a cloak worn by nothing on two empty boots; ribbons on verlet chains)
//   stilt.js      plan 7   the stilt heron (two stilts one at a time, an S-neck of segments)
//   cloud-jelly-tripo.js plan 11  the cloud jelly (issue #800: Tripo's body, public/enemies/cloud-jelly/body.glb; the
//                 lantern jelly it replaced, lantern-jelly-legacy.js, stands in where the body is not loaded)
//   tentacled.js  plan 12  the root knot (five three-segment root-arms on FABRIK)
//   lamp-moth-tripo.js plan 13  the lamp moth (issue #800: Tripo's body, public/enemies/lamp-moth/body.glb; the signal
//                 moth it replaced, signal-moth-legacy.js, stands in where the body is not loaded)
//   drone-tripo.js plan 13 the ring drone (issue #800: Tripo's spool drone, public/enemies/drone/body.glb, two plates and
//                 a core that looks at you, hovering; the legacy ring drone, hover-legacy.js, stands in where the body is not loaded)
//   storm-ray-tripo.js plan 14  the storm ray (issue #800: Tripo's body, public/enemies/storm-ray/body.glb; the sky ray
//                 it replaced, sky-ray-legacy.js, stands in where the body is not loaded)
//   worm-tripo.js plan 15  the mound worm (issue #800: Tripo's dune worm, public/enemies/worm/body.glb, a chain of bones
//                 along its spine standing out of its hole; the legacy worm, burrower-legacy.js, stands in where it is not loaded)
//   roller-tripo.js plan 16  the pearl roller (#800: Tripo's snail, rigid parts, its foot rippling in three lengths, its
//                          shell's spin locked to the ground; roller.js legacyRollerModel, the steel snail, stands in while it loads)
//   cart-tripo.js plan 17  the crucible walker (#800: Tripo's mesh, rigid parts on four kit legs, src/enemies/foe-assets.js;
//                          tracked.js legacyCartModel, the welding cart on its tracks, stands in while the mesh loads)
//   tripod-tripo.js plan 18 the lamp tripod (issue #800: Tripo's inspection tripod, public/enemies/tripod/body.glb, three
//                 legs on the machine plan, its lamp head on its neck; the legacy tripod, piston-legacy.js, stands in
//                 where the body is not loaded)
//   bell-tripo.js plan 19  the bell walker (#800: Tripo's mesh, rigid parts on four kit legs, the spirit the clapper;
//                          siege.js legacyBellModel, the spider-legged bell, stands in while the mesh loads)
//   blot-tripo.js plan 20  the ink blot (issue #800: Tripo's body, public/enemies/blot/body.glb, a drop that squashes and
//                 stretches on two bones; the legacy blot, blob-legacy.js, stands in where the body is not loaded)
//   strings.js    plan 21  the marionette (a puppet hung on four strings from a knot of smoke, a pendulum)
//   ember.js      plan 22  the ember wisp (a stand-in: a shell in two lids round a glowing coal; issue #398)
//   fencer.js     plan 9   the makers' fencer (a machine's biped: sword and shield; issue #665)
//   mummer.js     plan 23  the mummer and the mummer king (on the humanoid rig, src/enemies/humanoid-rig.js: clips; issue #724)
//   monster.js    plans 25, 26, 30, 31  roster v4's grunt, hulk, prowler and warlord (on the humanoid rig; issue #726)
//   droid.js               the makers' defunct droids' one material family (issue #726)
//   sentinel.js   plan 27  the sentinel (a droid duellist on the humanoid rig: blade and round shield)
//   oracle.js     plan 28  the oracle (a hovering caster droid: the rig's upper body over a ceramic shell)
//   crawler-tripo.js plan 29 the crawler (issue #800: Tripo's survey crawler, public/enemies/crawler/body.glb, four legs on the
//                 kit's crawler plan, its head looking at you; the legacy dome, crawler-legacy.js, stands in where it is not loaded)
//   woodcutter-tripo.js plan 8  the wood cutter (#800: Tripo's mesh on the brute's rig family, src/enemies/foe-assets.js;
//                          woodcutter.js its direct body, standing in only while the mesh loads)
//   dune-mummer-tripo.js plan 33  the dune mummer (#800: Tripo's rigged mesh on the humanoid clip rig; dune-mummer.js
//                          its direct body, standing in only while the mesh loads)

const BUILDERS = { crab: shellbackCrab, lizard: lizardModel, hound: houndModel, tripod: tripodModel, blot: blotModel, centipede: centipedeModel, worm: wormModel, ray: stormRay, moth: lampMoth, jelly: cloudJelly,
  toad: toadModel, heron: heronModel, skitter: skitterModel, rootknot: rootknotModel, brute: bruteModel, drone: droneModel,
  shade: shadeModel, marionette: marionetteModel, wisp: wispModel, fencer: fencerModel, mummer: mummerModel, mummerking: mummerKingModel,
  grunt: gruntModel, hulk: hulkModel,
  sentinel: sentinelModel, oracle: oracleModel, crawler: crawlerModel,
  prowler: prowlerModel, warlord: warlordModel,
  cart: (skin) => { const src = foeSource('cart'); return src ? tripoCartModel(skin, src) : legacyCartModel(skin); },
  bell: (skin) => { const src = foeSource('bell'); return src ? tripoBellModel(skin, src) : legacyBellModel(skin); },
  roller: (skin) => { const src = foeSource('roller'); return src ? tripoRollerModel(skin, src) : legacyRollerModel(skin); },
  woodcutter: (skin) => { const src = foeSource('woodcutter'); return src ? tripoWoodcutterModel(skin, src) : woodcutterModel(skin); },
  dunemummer: (skin) => { const src = foeSource('dunemummer'); return src ? tripoMummerModel(skin, src) : duneMummerModel(skin); } };

/**
 * Trial bodies (issue #800): a review page (the trials folder of the enemy-redesign references) may stand another
 * builder in for an archetype's while it compares them (`TRIAL_BUILDERS.hound = broadHoundModel`). The game never sets one.
 */
export const TRIAL_BUILDERS = {};

/** The body of a built archetype's kind in a world's skin (its stronger tier's: `tier`), or null (not one: an old kind draws itself). */
export function archetypeModel(kind, world, tier = 0) {
  const a = archetypeOfKind(kind);
  if (!a || ARCHETYPES[a].status !== 'built' || !BUILDERS[a]) return null;
  return (TRIAL_BUILDERS[a] ?? BUILDERS[a])(skinOf(a, world, tier));
}
