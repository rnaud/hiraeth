import { fromPattern } from './attacks.js';

// The enemy roster: 21 archetypes (docs/design/enemy-roster.md, approved 2026-10-09). Each has its own silhouette,
// body plan (src/motion-kit/plans.js), way of moving and job in a fight, and appears in several worlds in that
// world's skin (src/enemies/skins.js). Which archetypes each world fields: src/foe-worlds.js (the doc's world table).
// They replace the 100 world enemies (retired) and fold in the old kinds.
//
// An archetype:
//   name, family ('creature' | 'machine' | 'spirit'), plan (the kit's plan or the doc's plan name), planNo (the doc's
//   §4 number), role, tier (1-4: how much it asks of you alone), ranged (it hurts from afar: a lob, a beam, a flash)
//   status    'built'    on its own body (src/enemies/plans/), its tuning here (def)
//             'stand-in' not built yet: an old kind (`kind`) runs as its body meanwhile, so the world tables already
//                        field it (the doc's build plan, step 2)
//             'planned'  not built and nothing stands in: the world tables list it, spawning passes it over
//   kind      the foe kind that spawns for it (src/foes.js FOES): its own id once built, else its stand-in
//   moves     its attacks by name (the doc's); def.attacks holds the built ones' tuning
//   answers   the traveller's moves that answer it best (the doc's "Best answers"; never only the charged cut)
//   idle      how it lives when nobody fights it: calm ('graze' | 'bask' | 'patrol' | 'lie' | 'pool' | 'hang' |
//             'drift' | 'wade' | 'sit' | 'root' | 'trundle' | 'stand' | 'toll' | 'walk' | 'circle' | 'wander'),
//             wild (wildlife: it fights only when provoked), provoke (m: closer and it fights), shy (m: it backs away),
//             alarm (m: one of its own provoked near it provokes it), hunts (the share that hunt at all)
//   sound     its hurt and burst family (combat-v1.4 rec. 2; src/audio.js plays two sets for now)
//   drop      chimes it leaves (src/chimes.js DROP_OF)
//   was       the old kinds it replaces or folds in
//   art       'pending': its fresh Midjourney sheet (docs/design/enemy-roster-prompts.md) is not drawn yet; the
//             built body follows the doc's description and the best existing references until it is
//
// A built archetype's def is a foe kind's tuning (src/foe-kinds.js says what a kind and an attack may hold), with
// the archetype's additions:
//   calm            idle above, read by the Foe's mind (src/foes.js: wildlife stays calm until provoked)
//   burst [go, stop] it moves in bursts: go s, then freezes stop s (the crab's scuttle)
//   flanks          a pair works together: one comes at you, the other circles behind (the lizards)
//   attack.skins    only in these skins (a skin-only move: the crab's burrow in the Salt Harbour and Underwater)
//   attack.below    only under this share of its health (the hound's antler rake at two thirds)
//   attack.rear     only with you behind it (the lizard's tail whip); back: its area is behind it
//   attack.flank    only with it behind you, out of your sight (the lizard's flank bite)
//   attack.far      begun from beyond its reach once it has chased you that long (s: the blot's spit)
//   attack.shove    m/s you are shoved, toward its partner if it has one (the lizard's blare)
//   attack.track    a lane's aim follows you this share of the wind-up, then locks (the tripod's searchlight)
//   onParry         'flip' | 'cut' | 'chip' | 'reflect' (a perfect parry sends the bolt back at it)
//   attack.tell / attack.counter   what the body does in the wind-up, and what answers it (the gallery says them)

const S = (o) => ({ recover: 1.2, cool: [1.3, 2.3], hit: 0.4, sight: 17, giveUp: 40, ...o });

export const ARCHETYPES = {
  // ----------------------------------------------------------------------------- creatures (wildlife)
  crab: {
    name: 'shellback crab', family: 'creature', plan: 'walker', planNo: 1, role: 'tank', tier: 2, ranged: false,
    status: 'built', kind: 'crab', was: ['salt crab'], sound: 'shell', drop: 5, art: 'pending',
    moves: ['snap', 'shell spin', 'burrow and pinch'],
    answers: ['parry (the spin flips it)', 'dash cut to its side', 'bombs crack the shell', 'ember'],
    idle: 'picks along the tide line pinching at weed; backs away when you come near; fights only if you corner it',
    def: S({
      name: 'shellback crab', hp: 4, radius: 0.85, height: 0.6, speed: 3.2, sight: 15, giveUp: 30, reach: 8, heavy: true, shell: true, breaks: true,
      tone: '#b8553a', sound: 'machine', takes: { shoot: 0, fire: 1 }, weak: { bomb: 1.5 },
      calm: { mode: 'graze', wild: true, provoke: 3.2, shy: 7, alarm: 10 }, burst: [0.75, 0.45], sideways: true,
      attacks: [
        { id: 'snap', name: 'snap', shape: 'cone', range: 2.3, angle: 0.7, damage: 0.5, wind: 0.75, strike: 0.2, contact: 0.5, max: 2.2, weight: 1.5, onParry: 'chip',
          tell: 'the near pincer opens wide and draws back past the eye stalks; it plants its back legs', counter: 'guard, or step to its side; a parry chips it' },
        { id: 'spin', name: 'shell spin', shape: 'lane', width: 2.4, range: 8, damage: 0.75, wind: 1.1, strike: 0.7, contact: 0.05, lunge: 8, sweep: true, knock: 5, min: 3, max: 8, onParry: 'flip',
          tell: 'it pulls its legs under and the shell tilts up at the front, rocking', counter: 'guard it and it flips onto its back, open; or evade and it skids on' },
        { id: 'burrow', name: 'burrow and pinch', shape: 'ring', at: 'target', track: 0.6, radius: 1.5, damage: 0.5, wind: 1.2, surface: true, instant: true, min: 3, max: 7, skins: ['saltharbour', 'underwater'],
          tell: 'it sinks into the sand up to its eyes, the eye stalks swivel to you and the sand at its rim trembles', counter: 'keep moving: it springs out where you stood' },
      ],
      recover: 1.4, cool: [1.3, 2.4],
    }),
    note: 'A shellback crab: its shell turns the blade from the front. Get round it, guard (LB / L1) its spinning charge to flip it on its back, or crack the shell with a bomb. Left alone, it keeps to itself.',
  },
  skitter: {
    name: 'skitter swarm', family: 'creature', plan: 'skitterers', planNo: 2, role: 'swarm', tier: 1, ranged: false,
    status: 'stand-in', kind: 'swarm', was: ['blot swarm'], sound: 'chitin', drop: 0.5, art: 'pending',
    moves: ['ripple rush', 'pile'], answers: ['push', 'ember', 'the combo’s sweeping third swing'],
    idle: 'grazes in a loose flock; scatters in a ripple when you run at it, and comes back',
  },
  centipede: {
    name: 'ring centipede', family: 'creature', plan: 'centipede', planNo: 3, role: 'trapper', tier: 3, ranged: false,
    status: 'planned', kind: null, was: [], sound: 'chitin', drop: 6, art: 'pending',
    moves: ['ring', 'pincer lunge', 'segment shed'], answers: ['wings or jets out of the ring', 'air cut on the head', 'parry'],
    idle: 'suns coiled on warm rocks and unrolls slowly when you pass',
  },
  toad: {
    name: 'bellows toad', family: 'creature', plan: 'hopper', planNo: 5, role: 'lobber', tier: 1, ranged: true,
    status: 'stand-in', kind: 'spitter', was: ['spitting blot (its lobber role)'], sound: 'soft', drop: 3, art: 'pending',
    moves: ['spore lob', 'volley', 'belly flop'], answers: ['a shot in the swollen throat', 'air cut', 'closing in'],
    idle: 'sits by water with its throat pulsing, croaking in chorus; fights only within 4 m',
  },
  lizard: {
    name: 'horn lizard', family: 'creature', plan: 'quadruped', planNo: 6, role: 'flanker', tier: 2, ranged: false,
    status: 'built', kind: 'lizard', was: [], sound: 'soft', drop: 4, art: 'pending',
    moves: ['blare', 'flank bite', 'tail whip'],
    answers: ['parry and riposte on the bite', 'dash cut past the blarer', 'split the pair (the hook)'],
    idle: 'basks on warm stones and blares at the others in turn; territorial near its stones, harmless away from them',
    def: S({
      name: 'horn lizard', hp: 3, radius: 0.6, height: 0.55, speed: 4.6, sight: 18, giveUp: 40, reach: 7, clamber: true, group: 2, flanks: true,
      tone: '#d9925f', takes: { shoot: 1, fire: 1 },
      calm: { mode: 'bask', wild: true, provoke: 6, alarm: 14 },
      attacks: [
        { id: 'blare', name: 'blare', shape: 'cone', range: 6, angle: 0.55, damage: 0.25, wind: 1.0, strike: 0.35, contact: 0.4, shove: 7, min: 1.6, max: 6, weight: 1.5,
          tell: 'it rears onto its hind legs, its chest swelling and the horn’s bell glowing', counter: 'guard (no shove), or get behind it' },
        { id: 'bite', name: 'flank bite', shape: 'ring', radius: 1.4, ahead: 1.3, damage: 0.5, wind: 0.8, strike: 0.26, contact: 0.55, lunge: 3.4, min: 1.2, max: 6.5, flank: true, weight: 3,
          tell: 'it flattens to the ground behind you, its tail rigid, with a hiss', counter: 'evade, or parry into a riposte' },
        fromPattern('tail', { id: 'whip', name: 'tail whip', max: 3, rear: true, back: true, weight: 2,
          tell: 'its hips swing out the other way first', counter: 'jump, or step out of the sweep' }),
      ],
      recover: 1.25, cool: [1.2, 2.2],
    }),
    note: 'Horn lizards hunt in pairs: one blares at you from the front (guard, LB / L1, or it shoves you toward the other) while the other slips behind you to bite. Keep turning, and parry the bite.',
  },
  heron: {
    name: 'stilt heron', family: 'creature', plan: 'stilt', planNo: 7, role: 'reach', tier: 1, ranged: false,
    status: 'planned', kind: null, was: [], sound: 'soft', drop: 3, art: 'pending',
    moves: ['spear', 'sweep', 'wing buffet'], answers: ['dash cut inside its reach', 'charged cut at a leg topples it'],
    idle: 'wades and fishes; walks off if you come near, flies off if you run',
  },
  roller: {
    name: 'pearl roller', family: 'creature', plan: 'roller', planNo: 16, role: 'charger', tier: 2, ranged: false,
    status: 'planned', kind: null, was: [], sound: 'shell', drop: 4, art: 'pending',
    moves: ['bowl', 'ricochet', 'last roll'], answers: ['guard and bounce, then the charged cut into its foot', 'walls', 'the bubble'],
    idle: 'grazes moss in slow glistening trails, and pulls in if you touch it',
  },
  rootknot: {
    name: 'root knot', family: 'creature', plan: 'tentacled', planNo: 12, role: 'grappler', tier: 2, ranged: false,
    status: 'stand-in', kind: 'stalker', was: ['root stalker'], sound: 'roots', drop: 5, art: 'pending',
    moves: ['grip', 'lash', 'spore puff'], answers: ['bloom glob (asleep, cuts double)', 'ember ×2', 'parry on the lash'],
    idle: 'stands rooted among the mushrooms and stumps; its cap turns to follow you',
  },
  jelly: {
    name: 'lantern jelly', family: 'creature', plan: 'floater', planNo: 11, role: 'support', tier: 2, ranged: true,
    status: 'planned', kind: null, was: [], sound: 'soft', drop: 4, art: 'pending',
    moves: ['ward', 'mend', 'sting curtain'], answers: ['shot (each lantern)', 'boomerang', 'air cut when it sinks'],
    idle: 'drifts with the wind in slow herds; never starts a fight',
  },
  moth: {
    name: 'signal moth', family: 'creature', plan: 'flyer', planNo: 13, role: 'disruptor', tier: 2, ranged: true,
    status: 'stand-in', kind: 'moth', was: ['sign moth'], sound: 'paper', drop: 1, art: 'pending',
    moves: ['flash', 'dart', 'dust'], answers: ['push', 'fan’s gust', 'a light swing', 'shot'],
    idle: 'circles lamps and signs and sits on them in rows; fights near its lit sign',
  },
  ray: {
    name: 'sky ray', family: 'creature', plan: 'glider', planNo: 14, role: 'air striker', tier: 1, ranged: false,
    status: 'stand-in', kind: 'flyer', was: ['winged blot'], sound: 'soft', drop: 3, art: 'pending',
    moves: ['skim', 'tail lash', 'downdraft'], answers: ['parry grounds it', 'air cut as it passes low', 'wings or jets'],
    idle: 'circles in the thermals over cliffs and lands on warm rock with its wings spread flat',
  },
  worm: {
    name: 'mound worm', family: 'creature', plan: 'burrower', planNo: 15, role: 'ambusher', tier: 1, ranged: false,
    status: 'stand-in', kind: 'ray', was: ['dune ray'], sound: 'soft', drop: 4, art: 'pending',
    moves: ['erupt', 'spit stones', 'dive'], answers: ['flush it out (stomp, gust, bomb, a cut at the fin)', 'air cut onto the mound'],
    idle: 'its mound wanders the dunes slowly, surfacing to eat thorn bushes; ignores you unless you stand on it',
  },
  // ----------------------------------------------------------------------------- possessed machines (always hostile)
  tripod: {
    name: 'lamp tripod', family: 'machine', plan: 'machine', planNo: 18, role: 'sniper', tier: 2, ranged: true,
    status: 'built', kind: 'tripod', was: ['makers’ machine (its sentinel role)'], sound: 'metal', drop: 6, art: 'pending',
    possession: 'a face at the porthole: the dark presses against the boiler’s window from inside, its steam comes out black',
    moves: ['beam and bolt', 'stamp', 'steam vent'],
    answers: ['cover breaks the beam', 'dash under it', 'magnet glove (it is metal)', 'parry sends the bolt back'],
    idle: 'patrols its old round sweeping the lamp across the walls; stops and peers at anything moving',
    def: S({
      name: 'lamp tripod', hp: 5, radius: 0.9, height: 1.6, speed: 2.1, sight: 22, giveUp: 40, reach: 18, keep: 9, heavy: true, metal: true, breaks: true,
      tone: '#f2c54b', sound: 'machine', takes: { shoot: 0, fire: 0 },
      calm: { mode: 'patrol', provoke: 20, round: 7 },
      attacks: [
        { id: 'beam', name: 'beam and bolt', shape: 'lane', width: 1.0, range: 18, damage: 0.75, wind: 1.4, strike: 0.25, contact: 0.6, track: 0.7, min: 4, max: 18, weight: 2.5, onParry: 'reflect',
          tell: 'its searchlight finds you and holds; the light narrows and brightens and the shutter clicks', counter: 'break the line (cover); guard the bolt; a perfect parry sends it back at the lamp' },
        fromPattern('stomp', { id: 'stamp', name: 'stamp', at: 'self', radius: 2.6, max: 2.6, weight: 2,
          tell: 'one leg lifts high and its piston hisses', counter: 'evade out from under it' }),
        { id: 'vent', name: 'steam vent', shape: 'ring', at: 'self', radius: 3.4, damage: 0.5, wind: 1.0, strike: 0.4, contact: 0.35, knock: 3, max: 4,
          tell: 'its valves rattle open in a ring round the boiler', counter: 'step back out of the black steam' },
      ],
      recover: 1.6, cool: [1.6, 2.6], hit: 0.5,
    }),
    note: 'A lamp tripod snipes from far off: when its searchlight holds on you and narrows, break the line behind something or guard (LB / L1) the bolt. Get under it, or pull a leg with the magnet glove.',
  },
  cart: {
    name: 'crucible cart', family: 'machine', plan: 'tracked', planNo: 17, role: 'area denier', tier: 3, ranged: true,
    status: 'stand-in', kind: 'slag', was: ['slag walker'], sound: 'slag', drop: 8, art: 'pending',
    possession: 'boiling over: ink froths over the crucible’s rim, a column of black smoke with two eyes',
    moves: ['pour', 'ram', 'trail'], answers: ['fluid shot cools its crust', 'bombs on the tracks', 'the combo from behind'],
    idle: 'trundles its old route between the furnaces, pouring into moulds that are no longer there',
  },
  bell: {
    name: 'bell walker', family: 'machine', plan: 'siege', planNo: 19, role: 'siege', tier: 3, ranged: true,
    status: 'planned', kind: null, was: [], sound: 'metal', drop: 8, art: 'pending',
    possession: 'the clapper is the spirit, swinging inside the bell; ink drips from its mouth',
    moves: ['toll', 'drop', 'opening'], answers: ['the bell whistle', 'strike the clapper', 'jump the rings'],
    idle: 'stands in a square and tolls the hours, softly',
  },
  drone: {
    name: 'ring drone', family: 'machine', plan: 'flyer (machine)', planNo: 13, role: 'tether', tier: 3, ranged: true,
    status: 'stand-in', kind: 'drone', was: ['rust drone'], sound: 'metal', drop: 4, art: 'pending',
    possession: 'a caught cloud between its plates, leaking at the gaps, two eyes drifting in it',
    moves: ['harpoon', 'ram', 'hide'], answers: ['stilling', 'magnet glove', 'hook', 'guard the harpoon'],
    idle: 'circles its old post polishing a dome that isn’t there; drifts after anything that shines',
  },
  brute: {
    name: 'furnace brute', family: 'machine', plan: 'brute', planNo: 8, role: 'heavy', tier: 3, ranged: false,
    status: 'stand-in', kind: 'golem', was: ['glass golem', 'makers’ machine (its slam and quake)'], sound: 'metal', drop: 8, art: 'pending',
    possession: 'ink in the cracks: the hull cracked like a dropped jar, the dark seeping from every seam',
    moves: ['slam', 'hurl', 'sweep'], answers: ['riposte (×2 on the stunned)', 'bombs ×2', 'charged cut on a glowing crack'],
    idle: 'stands where it stopped working, rusted mid-task; wakes with a groan when you come close',
  },
  // ----------------------------------------------------------------------------- spirits (the dark itself)
  blot: {
    name: 'ink blot', family: 'spirit', plan: 'blob', planNo: 20, role: 'rusher', tier: 1, ranged: true,
    status: 'built', kind: 'blot', was: ['ink blot', 'spitting blot (its spit)'], sound: 'ink', drop: 2, art: 'pending',
    manifestation: 'loose ink: no body borrowed; it splashes and pools',
    moves: ['lunge', 'lunge combo', 'spit'], answers: ['a cut breaks its coil (it teaches the combo)', 'the guard ends its combo', 'a shot washes it'],
    idle: 'pools in shade and under arches, a stain until you come near; then the stain stands up',
    def: {
      name: 'ink blot', hp: 2, radius: 0.6, height: 0.55, speed: 3.4, sight: 17, giveUp: 40, reach: 2.1, flinchy: true, clamber: true,
      calm: { mode: 'pool', provoke: 9 },
      attacks: [
        { id: 'lunge', name: 'lunge', shape: 'ring', radius: 1.7, ahead: 1.1, damage: 0.5, wind: 0.7, strike: 0.24, contact: 0.55, lunge: 1.8, weight: 2,
          tell: 'it coils into a flat puddle', counter: 'anything; a cut breaks its coil' },
        // the lunge-combo: a longer coil, a lunge, and a second quick one straight after (unless the first was blocked)
        { id: 'combo', name: 'lunge combo', shape: 'ring', radius: 1.6, ahead: 1.0, damage: 0.5, wind: 0.8, strike: 0.22, contact: 0.55, lunge: 1.6, then: 'again', min: 0.8,
          tell: 'a deeper coil', counter: 'guard the first and the second never comes' },
        { id: 'again', chain: true, shape: 'ring', radius: 1.6, ahead: 1.0, damage: 0.5, wind: 0.4, strike: 0.22, contact: 0.55, lunge: 1.8 },
        // the spitting blot's spit, folded in: if you keep away, it rears up tall and thin and lobs a glob (its landing mark)
        { id: 'spit', name: 'spit', shape: 'ring', at: 'target', instant: true, lob: true, radius: 1.4, damage: 0.5, wind: 1.2, min: 4, max: 9, far: 2.2,
          tell: 'it rears up tall and thin', counter: 'step out of the mark where it lands' },
      ],
      recover: 1.0, cool: [1.1, 2.2], hit: 0.35,
    },
  },
  shade: {
    name: 'shade', family: 'spirit', plan: 'humanoid', planNo: 9, role: 'duelist', tier: 3, ranged: false,
    status: 'stand-in', kind: 'shade', was: ['shade'], sound: 'ink', drop: 8, art: 'pending',
    manifestation: 'a cloak of smoke worn by nothing; the sword is poured ink',
    moves: ['cut', 'feint and thrust', 'step through the shade'], answers: ['parry and riposte', 'ember', 'light'],
    idle: 'walks a path it walked in life and stops at doorways',
  },
  hound: {
    name: 'antler hound', family: 'spirit', plan: 'quadruped', planNo: 6, role: 'stalker', tier: 4, ranged: false,
    status: 'built', kind: 'hound', was: ['shadow hound'], sound: 'ink', drop: 4, art: 'pending',
    manifestation: 'a shadow cast by nothing: it runs as a flat shadow and rises out of it into a body',
    moves: ['pounce', 'step behind', 'antler rake'], answers: ['ember (solid, and it burns: 2)', 'the lantern', 'parry'],
    idle: 'shadows lie under trees and arches where there shouldn’t be any; one stands up and watches you go; not every one hunts',
    def: S({
      name: 'antler hound', hp: 3, radius: 0.55, height: 0.8, speed: 5.6, sight: 22, giveUp: 45, reach: 7, phase: true, group: 2, clamber: true,
      tone: '#6c4fa0', takes: { shoot: 0, fire: 2 },
      calm: { mode: 'lie', provoke: 11, hunts: 0.7, alarm: 12 },
      attacks: [
        { id: 'pounce', name: 'pounce', shape: 'ring', radius: 1.6, ahead: 1.6, damage: 0.5, wind: 0.8, strike: 0.28, contact: 0.55, lunge: 3.2, max: 3.4, weight: 1.5,
          tell: 'it crouches, the antlers dipping forward and the shoulders bunching', counter: 'evade, or parry and riposte' },
        { id: 'step', name: 'step behind', shape: 'ring', at: 'behind', instant: true, radius: 1.3, track: 0.5, damage: 0, blink: true, wind: 0.9, then: 'bite', min: 2.5, max: 7,
          tell: 'it sinks into its shadow, which slides round you; a growl behind you', counter: 'turn and guard; ember makes it solid at once' },
        { id: 'bite', chain: true, shape: 'cone', range: 2.3, angle: 0.8, damage: 0.5, wind: 0.55, strike: 0.2, contact: 0.5 },
        { id: 'rake', name: 'antler rake', shape: 'cone', range: 2.9, angle: 1.15, damage: 0.75, wind: 1.0, strike: 0.3, contact: 0.5, max: 2.8, below: 0.67, weight: 2,
          tell: 'its head low and to one side, the antlers lowered like a plough', counter: 'step back out of the sweep, or guard' },
      ],
      recover: 1.2, cool: [1.1, 2.0],
    }),
    note: 'Antler hounds: running at a distance they are only shadows and the blade passes through; close in, they are solid. Cut when they rise to strike, or light them with an ember. One that sinks into its shadow comes up behind you.',
  },
  marionette: {
    name: 'marionette', family: 'spirit', plan: 'strings', planNo: 21, role: 'puppeteer', tier: 4, ranged: true,
    status: 'planned', kind: null, was: [], sound: 'paper', drop: 8, art: 'pending',
    manifestation: 'the puppeteer: strings rise into a knot of smoke and drop onto other things',
    moves: ['strings', 'yank', 'dance'], answers: ['air cut, wings or jets to its strings', 'boomerang', 'ember'],
    idle: 'hangs still under bridges, cranes and arches, swaying like a coat on a hook',
  },
};

export const ARCHETYPE_IDS = Object.keys(ARCHETYPES);
/** The archetypes on their own bodies (src/enemies/plans/), whose tuning is here. */
export const BUILT = ARCHETYPE_IDS.filter((id) => ARCHETYPES[id].status === 'built');
/** The foe kinds the built archetypes add to src/foes.js FOES (their def), by kind. */
export const ARCHETYPE_KINDS = Object.fromEntries(BUILT.map((id) => [ARCHETYPES[id].kind, ARCHETYPES[id].def]));
/** What the game says the first time each built archetype comes for you (by kind). */
export const ARCHETYPE_NOTES = Object.fromEntries(BUILT.filter((id) => ARCHETYPES[id].note).map((id) => [ARCHETYPES[id].kind, ARCHETYPES[id].note]));
/** The kind that spawns for an archetype (its own, or its stand-in's), or null (planned: nothing yet). */
export const spawnKindOf = (id) => ARCHETYPES[id]?.kind ?? null;
/** The archetype a foe kind is (its own or the one it stands in for), or null (a kind with no place in the roster). */
export const archetypeOfKind = (kind) => ARCHETYPE_IDS.find((id) => ARCHETYPES[id].kind === kind) ?? null;
/** The kinds no archetype uses any more (the doc's retired ones): kept only for the Arena's old waves and the temples. */
export const RETIRED_KINDS = ['splinter'];

/** A foe kind with an optional skin: 'crab', 'crab@saltharbour' → { kind, skin }. */
export function parseKind(id) {
  const s = String(id ?? ''), at = s.indexOf('@');
  return at < 0 ? { kind: s, skin: null } : { kind: s.slice(0, at), skin: s.slice(at + 1) || null };
}
/** A kind in a skin: skinned('crab', 'saltharbour') → 'crab@saltharbour'. */
export const skinned = (kind, skin) => (skin ? `${kind}@${skin}` : kind);
