// The worlds' old kinds (docs/systems/foes.md, "Each world's foes"): since the enemy roster (docs/design/enemy-roster.md,
// src/enemies/archetypes.js) they ran as the stand-in bodies of archetypes not built yet, each going when its archetype
// landed (the dune ray, the sign moth and the winged blot with batch 2; the root stalker, the spitting blot and the blot
// swarm with batch 3; the glass golem, the rust drone and the slag walker with batch 4, v1.16: the furnace brute, the
// ring drone and the crucible cart). None is left: the tables stay for a stand-in that may come (KINDS, merged into
// foes.js FOES; NOTES, what the game says the first time; kindModel, a model with its own anim(f, c), called by
// Foes.look). The built archetypes' own are in src/enemies/archetypes.js and src/enemies/plans/; the shade still runs
// on its own body in src/shade.js until its rework (batch 5).
//
// An attack (foes.js Foe; src/temples/boss.js inArea for the shapes):
//   id, shape 'ring' | 'cone' | 'lane', radius / range / angle / width, damage, wind (s), strike (s), contact (0..1)
//   at        'self' (round it) | 'target' (where you stand) | 'behind' (past you);
//             unset: a ring lands `ahead` of it, a cone or a lane starts at it
//   min, max  the distances it is used at (max: the kind's reach); weight: how often; chain: only as a `then`
//   instant   resolved as the wind-up ends (no strike phase): lobs, flashes, blinks
//   lob       a lobbed or thrown projectile: the only attack with a mark on the ground (where it lands); every
//             other attack is read from the body alone (src/telegraph.js: the pose, the glow, the rising sound)
//   lunge     m travelled through the strike; dive: a flyer comes down along it; sweep: hits whatever it
//             touches on the way (a charge: within half the lane's width of its body), not one area at the contact
//   track     its aim (a lob's mark) follows you over this share of the wind-up, then holds
//   then      the id of a quick follow-up wound at once (a combo), unless it was blocked
//   knock     knocks you down; tether / grab { time, pull }: pulls you in; blind: s of white; wave: a ground
//             shockwave running out (jump it); leave: burning slag ('ring' | 'cone'); surface / blink: the foe
//             comes up at the area / steps through the shadow to it
//   onParry   'chip' (a perfect parry breaks a piece off), 'cut' (the line is cut), 'flip' (on its back),
//             'reflect' (a perfect parry sends the bolt back)
//   the archetypes' (src/enemies/archetypes.js): skins, below, rear / back, flank, far, shove
//
// A kind may say: takes { shoot, fire, push, bloom } (what each glob does: damage, or 'hold'), weak { source: × },
// heavy (sturdy: light cuts don't stop it, it shoves less), metal (the magnet glove lifts it), light (a gust ends
// it), shell (the blade glances off its front), burrow (swims under the ground), phase (a shadow while it runs),
// trail (burning slag where it walks), splits (what it breaks into), group (how many come together), noWild,
// clamber (it leaps up ledges to 2.4 m: src/foe-height.js), perch (it climbs to the high ground to shoot down).

export const KINDS = {};

/** Said once, the first time each kind comes for you (prompts in pad form: src/native-pad.js rewrites them). */
export const NOTES = {};

/** The look of a world's own foe kind: { group, parts, eyeMat, base, size, anim(f, c) }, or null (not one of these). */
export function kindModel(kind) {
  const make = MODELS[kind];
  return make ? make() : null;
}

const MODELS = {};
