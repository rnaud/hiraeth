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
//             'drift' | 'wade' | 'sit' | 'root' | 'trundle' | 'stand' | 'toll' | 'walk' | 'circle' | 'wander' | 'pace'),
//             wild (wildlife: it fights only when provoked), provoke (m: closer and it fights), shy (m: it backs away),
//             alarm (m: one of its own provoked near it provokes it), hunts (the share that hunt at all)
//   sound     its hurt and burst family (combat-v1.4 rec. 2; src/audio.js plays two sets for now)
//   drop      chimes it leaves (src/chimes.js DROP_OF)
//   was       the old kinds it replaces or folds in
//   art       'pending': its fresh reference sheet (docs/design/enemy-roster-prompts.md) is not matched yet; the
//             built body follows the doc's description and the best existing references until it is
//             'sheet-N': the built body is drawn to its picked sheet, references/enemy-archetypes/<id>/sheet-N.jpg
//             { main, alt }: drawn to both its sheets, sheet-1.jpg in the main skin's world (main), sheet-2.jpg in
//             the alternate's (alt): its palettes too (scripts/enemy-roster/compare.mjs sets them side by side)
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
//   onParry         'flip' | 'cut' | 'chip' | 'reflect' (a perfect parry sends the bolt back at it) | 'ground' (a perfect
//                   parry ploughs a flyer into the ground, open: the sky ray's skim)
//   attack.up       only while it is up out of the sand (a burrower: the worm's spit stones, its dive); a `surface`
//                   attack of a burrower only while it is under; attack.dives: it goes back under after it
//   attack.encircle { r0, r1, speed }: through the wind-up it spirals round where you stood from r0 to r1 m, at speed ×
//                   its own, its body a wall behind it (Foes.corral), and the ring closes on you (the centipede)
//   attack.slip     s your lock-on slips (the moth's dust); attack.draft: m/s down, the glide broken (the ray's downdraft)
//   attack.ward / attack.mend   a support's move on a neighbour, not on you (the jelly: ward { time, range }, mend { hp, range })
//   segmented       plated: a cut from behind or the side does half and never staggers it; its head, turned in for the
//                   ring, takes a cut double (the centipede); shed { kind, n, below, segments }: cut from behind under
//                   `below` of its health, its tail segments break off as `n` of `kind`, once
//   support         it keeps near its neighbours, not you (the jelly); lanterns: how many wards it can hold (a shot or
//                   the boomerang pops one: takes.shoot 'pop'); escort: what comes with it alone in the Arena
//   calm.joins      it joins any fight near it, not only its own kind's (the jelly never starts one: provoke 0)
//   attack.tell / attack.counter   what the body does in the wind-up, and what answers it (the gallery says them)
// batch 3 (v1.12):
//   hops            it moves hop by hop (the toad: its body lands each hop, src/enemies/plans/hopper.js)
//   attack.choke    a shot while it winds this up (its throat swollen) bursts it early: it chokes, stunned (the toad)
//   attack.leave 'spores'   a lob leaves a patch of spores where it lands that slows you (Foes.updateHazards)
//   attack.leap     { height }: the strike is a leap onto where you stood (placed there, within `range`); the air
//                   cut meets it in the air: double, and it lands on its back (the toad's belly flop)
//   onParry 'open'  any guard knocks it aside and leaves it open a while, longer on a perfect one (the heron's bill)
//   topples         a charged cut at its legs topples it: down a while, cuts double, its head in reach (the heron)
//   flock           { ring, one }: it rings you at `ring` m between darts and only one of its kind strikes at a
//                   time (the skitters); attack.pile: n of its flock climb onto it into a heap that topples onto
//                   you (the push scatters it: Foes.pile); calm.linger: s you must stay within `provoke` m
//   rooted          it can't be knocked back (the root knot); attack.ground: only on your feet (a jump clears it);
//                   attack.blur: s your sight is blurred by spores, whichever way you look
// batch 4 (v1.16), the machines:
//   stout           light cuts never stagger it, even early in a wind-up (the furnace brute, the bell walker: heavy breakers)
//   attack.wave     a quake or a ring of sound running out over the ground (jump it); wave.count: that many, wave.every s apart
//   attack.leaveLife  s its slag stays (the cart's pour); jams: s a bomb on its tracks keeps it from turning (the cart)
//   attack.reverse  m it backs up through the wind-up (the cart's ram); attack.stall: s it stands stunned if a wall stops it
//   attack.opens    s it sits open after the strike (the bell's drop: tipped toward you, the clapper in reach)
//   clapper         only the clapper takes harm: a cut, a bomb glance off the bell unless it sits open or is stilled (the bell)
//   attack.whistle  the bell-note whistle sounded near it as it winds this up chokes it: it sits open (Foes.bellNote)
// batch 5 (v1.17), the late spirits and the roller:
//   attack.feint    the share of the wind-up its body spends on a fake (the shade's: the cut begun, stopped halfway, the
//                   sword dropped to the hip for the thrust); the body's alone, the mind winds the real move up in full
//   lights          an ember lights it solid a while (f.lit); attack.dark: only while it is not lit (the shade's step)
//   attack.at 'beside'  it comes up at your side (the shade's step through its shadow)
//   attack.rolls    it rolls through the strike: no harm reaches it then (a glance: the pearl roller); onParry 'bounce':
//                   any guard bounces it off stunned (longer on a perfect one); attack.bounces: the walls it bounces off
//                   back at you before the next one stalls it; attack.shatter { speed, reach, damage, width }: it breaks
//                   at the strike's end (or on the wall) in a ring that runs out over the ground (its last roll)
//   puppeteer       it drives others (the marionette): attack.possess { range, time }: it drops strings onto a creature
//                   near it (a calm one too): the creature's eyes go black, its wind-ups shorter, light blows never stagger
//                   it, until the strings are cut (the blade, the boomerang, an ember: Foes.possess) or run out;
//                   attack.alone: only while it holds nothing and there is nothing near to hold (the dance)
//   attack.lift     m/s a line that catches you lifts you off your feet (the marionette's yank)

const S = (o) => ({ recover: 1.2, cool: [1.3, 2.3], hit: 0.4, sight: 17, giveUp: 40, ...o });

export const ARCHETYPES = {
  // ----------------------------------------------------------------------------- creatures (wildlife)
  crab: {
    name: 'shellback crab', family: 'creature', plan: 'walker', planNo: 1, role: 'tank', tier: 2, ranged: false,
    status: 'built', kind: 'crab', was: ['salt crab'], sound: 'shell', drop: 5, art: { main: 'arzach2', alt: 'saltharbour' },
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
    status: 'built', kind: 'skitter', was: ['blot swarm'], sound: 'chitin', drop: 0.5, art: { main: 'desert', alt: 'moonfoundry' },
    moves: ['ripple rush', 'pile'], answers: ['push', 'ember', 'the combo’s sweeping third swing'],
    idle: 'grazes in a loose flock; scatters in a ripple when you run at it, and comes back; fights only if you stay in the middle of it',
    def: S({
      name: 'skitter', hp: 1, radius: 0.32, height: 0.22, speed: 5.4, sight: 16, giveUp: 40, reach: 4.6, light: true, group: 8,
      flock: { ring: 4, one: true },   // (it rings you at 4 m and only one darts in at a time)
      tone: '#e0a64e', takes: { shoot: 1, fire: 1, push: 1 },
      calm: { mode: 'flock', wild: true, provoke: 3.2, linger: 2.2, shy: 6, alarm: 9 },
      attacks: [
        { id: 'rush', name: 'ripple rush', shape: 'lane', width: 1.1, range: 4.6, damage: 0.25, wind: 0.6, strike: 0.32, contact: 0.05, lunge: 4.4, sweep: true, min: 2.2, max: 4.6, weight: 3,
          tell: 'it rears up on its back legs, its front legs raised, and clicks', counter: 'a light swing ends it; the push ends one' },
        // the pile: three or four climb onto each other into a wobbling heap, then it topples onto you (Foes.pile)
        { id: 'pile', name: 'pile', shape: 'ring', radius: 1.7, ahead: 1.5, damage: 0.5, wind: 1.2, strike: 0.36, contact: 0.6, lunge: 1.6, pile: 3, min: 1, max: 3.6, weight: 1,
          tell: 'three or four climb onto each other into a wobbling heap', counter: 'evade, or the push scatters the heap' },
      ],
      recover: 0.8, cool: [0.9, 1.9], hit: 0.2,
    }),
    note: 'Skitters graze in a flock and run from you if you charge them; stand in the middle of one and they ring you, darting in one at a time. One cut, one shot or a push ends each; when three climb into a heap, push it apart or step aside.',
  },
  centipede: {
    name: 'ring centipede', family: 'creature', plan: 'centipede', planNo: 3, role: 'trapper', tier: 3, ranged: false,
    status: 'built', kind: 'centipede', was: [], sound: 'chitin', drop: 6, art: 'sheet-1',
    moves: ['ring', 'pincer lunge', 'segment shed'], answers: ['wings or jets out of the ring', 'air cut on the head', 'parry', 'the push breaks the ring'],
    idle: 'suns coiled on warm rocks and unrolls slowly when you pass',
    def: S({
      name: 'ring centipede', hp: 6, radius: 0.75, height: 0.55, speed: 4.4, sight: 18, giveUp: 40, reach: 6, heavy: true, segmented: true, breaks: true,
      tone: '#d8b048', takes: { shoot: 0, fire: 1, push: 0 }, weak: { bomb: 1.5 },
      calm: { mode: 'coil', wild: true, provoke: 6, alarm: 10 },
      shed: { kind: 'skitter', n: 2, below: 0.67, segments: 2 },
      attacks: [
        // the ring: it spirals round you, its body a wall closing behind it, and tightens; out over its back with the
        // wings or the jets, or break it (the push, a cut on its head as it turns in)
        { id: 'ring', name: 'ring', shape: 'ring', at: 'target', radius: 2.0, damage: 0.75, knock: 5, wind: 2.3, instant: true, encircle: { r0: 4, r1: 1.15, speed: 1.7 }, min: 2.2, max: 6, weight: 2,
          tell: 'its head lifts and turns inward, its legs ripple faster and the circle starts to close', counter: 'out over its back with the wings or jets before it closes; the push breaks it; its head, turned in, takes a cut double' },
        { id: 'lunge', name: 'pincer lunge', shape: 'ring', radius: 1.5, ahead: 1.4, damage: 0.75, wind: 0.95, strike: 0.26, contact: 0.5, lunge: 2.6, max: 3.2, weight: 1.5,
          tell: 'the head rears and the front segments bunch up like a spring', counter: 'parry and riposte, or evade to the side' },
      ],
      recover: 1.5, cool: [1.5, 2.6], hit: 0.45,
    }),
    note: 'A ring centipede: it runs round you and closes its body into a ring. Get out over its back with the wings or the jets before the ring closes, push it apart, or cut its head as it turns in. Its plated back shrugs off cuts; only the head counts.',
  },
  toad: {
    name: 'bellows toad', family: 'creature', plan: 'hopper', planNo: 5, role: 'lobber', tier: 1, ranged: true,
    status: 'built', kind: 'toad', was: ['spitting blot (its lobber role)'], sound: 'soft', drop: 3, art: { main: 'perdide', alt: 'incal' },
    moves: ['spore lob', 'volley', 'belly flop'], answers: ['a shot in the swollen throat', 'air cut', 'closing in'],
    idle: 'sits by water with its throat pulsing, croaking in chorus; fights only within 4 m or if one near it is hurt',
    def: S({
      name: 'bellows toad', hp: 3, radius: 0.85, height: 1.1, speed: 2.4, sight: 18, giveUp: 38, reach: 11, keep: 6.5, perch: true, hops: true,
      tone: '#b49ad6', takes: { shoot: 1, fire: 1 },
      calm: { mode: 'sit', wild: true, provoke: 4, alarm: 10 },
      attacks: [
        // its throat swells see-through with the glob inside, it rears back and lobs it (a landing mark: the one
        // exception); the glob leaves spores that slow you; a shot in the swollen throat bursts it early (choke)
        { id: 'lob', name: 'spore lob', shape: 'ring', at: 'target', instant: true, lob: true, radius: 1.5, damage: 0.5, wind: 1.2, track: 0.45, choke: true, leave: 'spores', min: 3, max: 11, weight: 2,
          tell: 'its throat swells to twice its size and turns see-through, the glob showing inside; it rears back', counter: 'walk out of the mark; a shot in the swollen throat bursts it early and it chokes' },
        { id: 'volley', name: 'volley', shape: 'ring', at: 'target', instant: true, lob: true, spread: [-3, 0, 3], radius: 1.2, damage: 0.5, wind: 1.45, choke: true, leave: 'spores', min: 4, max: 11, weight: 1.5, skins: ['incal', 'waterfall'],
          tell: 'its throat swells fuller still, three globs crowding in it', counter: 'step out of the row of marks, or shoot the throat' },
        // the belly flop: a deep crouch, legs shaking, then a leap onto where you stood; landing, a ring of shock
        { id: 'flop', name: 'belly flop', shape: 'ring', radius: 1.7, damage: 0.75, wind: 0.95, strike: 0.62, contact: 0.95, leap: { height: 2.6 }, range: 6, track: 0.55, wave: { speed: 7, reach: 6, damage: 0.5, width: 0.55 }, min: 1.4, max: 6, weight: 1.5,
          tell: 'a deep crouch, its legs shaking', counter: 'jump the shockwave; in the air the air cut meets it (double, and it lands on its back)' },
      ],
      recover: 1.3, cool: [1.5, 2.5], hit: 0.35,
    }),
    note: 'A bellows toad keeps its distance and lobs: when its throat swells see-through, walk out of the mark, or shoot the throat and it chokes on its own glob. When it crouches deep and shakes, it is about to flop onto you: jump the ring, or meet it in the air with the air cut.',
  },
  lizard: {
    name: 'horn lizard', family: 'creature', plan: 'quadruped', planNo: 6, role: 'flanker', tier: 2, ranged: false,
    status: 'built', kind: 'lizard', was: [], sound: 'soft', drop: 4, art: { main: 'incal', alt: 'bazaar' },
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
    status: 'built', kind: 'heron', was: [], sound: 'soft', drop: 3, art: { main: 'desert', alt: 'arzach' },
    moves: ['spear', 'sweep', 'wing buffet'], answers: ['dash cut inside its reach', 'charged cut at a leg topples it', 'parry the spear'],
    idle: 'wades and fishes, stabbing at the water; walks off if you come near; fights only if you corner it',
    def: S({
      name: 'stilt heron', hp: 4, radius: 0.6, height: 1.3, speed: 2.6, sight: 18, giveUp: 34, reach: 5.2, topples: true,
      tone: '#5fbfb0', takes: { shoot: 1, fire: 1 },
      calm: { mode: 'wade', wild: true, provoke: 2.8, shy: 7, alarm: 8 },
      attacks: [
        // the spear: the neck drawn back into a tight S, the body leaning back; then it straightens all at once
        { id: 'spear', name: 'spear', shape: 'lane', width: 0.9, range: 5.2, damage: 0.5, wind: 0.9, strike: 0.2, contact: 0.6, lunge: 1.0, track: 0.35, min: 2.2, max: 5.2, weight: 2, onParry: 'open',
          tell: 'the neck draws back into a tight S, the bill pointed at you, the body leaning back', counter: 'evade to the side; a parry knocks the bill aside and leaves its head open' },
        // under it: one foot lifted high, then a stamp as the other leg turns it round
        { id: 'sweep', name: 'sweep', shape: 'ring', at: 'self', radius: 2.3, damage: 0.5, knock: 4, wind: 1.0, strike: 0.3, contact: 0.55, max: 2.2, weight: 1.5,
          tell: 'one foot lifts high, its weight on the other', counter: 'get out from under it; the charged cut at a leg topples it' },
        { id: 'buffet', name: 'wing buffet', shape: 'cone', range: 3.6, angle: 0.8, damage: 0.25, shove: 8, wind: 0.8, strike: 0.3, contact: 0.45, max: 3.6, weight: 1.5, skins: ['arzach'],
          tell: 'its folded wings flare wide and draw back', counter: 'guard, or ride it out on the wings' },
      ],
      recover: 1.3, cool: [1.4, 2.4], hit: 0.4,
    }),
    note: 'A stilt heron holds a space with its bill: when its neck draws back into an S, step to the side, or guard and knock the bill away. Get in under it and cut its legs; a charged cut at a leg topples it.',
  },
  roller: {
    name: 'pearl roller', family: 'creature', plan: 'roller', planNo: 16, role: 'charger', tier: 2, ranged: false,
    status: 'built', kind: 'roller', was: [], sound: 'shell', drop: 4, art: { main: 'garage', alt: 'spheres' },
    moves: ['bowl', 'ricochet', 'last roll'], answers: ['guard: it bounces off stunned (then the charged cut into its foot)', 'walls: sidestep it into one', 'the bubble (it floats, helpless)'],
    idle: 'grazes moss in slow glistening trails, and pulls in if you touch it',
    def: S({
      name: 'pearl roller', hp: 4, radius: 0.8, height: 0.9, speed: 2.4, sight: 16, giveUp: 30, reach: 9,
      tone: '#e8d7f0', takes: { shoot: 1, fire: 1 },
      calm: { mode: 'graze', wild: true, provoke: 2.4, alarm: 8 },
      attacks: [
        // its eye stalks sink and the shell rocks back on its foot three times; then it pulls in and rolls along a lane,
        // bouncing off a wall once (the next stalls it, stunned); rolling, nothing harms it; a guard bounces it off stunned
        { id: 'bowl', name: 'bowl', shape: 'lane', width: 1.6, range: 9, damage: 0.75, knock: 5, wind: 1.0, strike: 1.0, contact: 0.05, lunge: 9, sweep: true, rolls: true, bounces: 1, stall: 3, onParry: 'bounce', min: 2.5, max: 9, weight: 2,
          tell: 'its eye stalks sink and the shell rocks back and forth on its foot, three times', counter: 'guard it and it bounces off stunned; or sidestep it into a wall' },
        { id: 'ricochet', name: 'ricochet', shape: 'lane', width: 1.6, range: 9, damage: 0.75, knock: 5, wind: 1.0, strike: 1.0, contact: 0.05, lunge: 9, sweep: true, rolls: true, bounces: 2, stall: 3, onParry: 'bounce', min: 2.5, max: 9, weight: 1.5, skins: ['spheres', 'spacecity'],
          tell: 'the same rocking, faster, and its spiral glows', counter: 'guard it; keep away from the walls it bounces off at you' },
        // at a quarter of its health: it spins in place, glowing, rolls at you and shatters in a ring of pearl
        { id: 'last', name: 'last roll', shape: 'lane', width: 1.8, range: 10, damage: 0.75, knock: 6, wind: 1.6, strike: 1.1, contact: 0.05, lunge: 10, sweep: true, rolls: true, onParry: 'bounce', shatter: { speed: 6, reach: 4.5, damage: 0.5, width: 0.55 }, below: 0.25, min: 1.5, max: 9, weight: 6,
          tell: 'it pulls in and spins in place, faster and faster, its spiral glowing', counter: 'evade at the last moment and jump its ring; or let it hit a wall: it breaks there alone' },
      ],
      recover: 1.4, cool: [1.6, 2.8], hit: 0.4,
    }),
    note: 'A pearl roller grazes alone until you hit it or come too close. When its eye stalks sink and its shell rocks, it is about to roll at you: guard (LB / L1) and it bounces off stunned, or sidestep it into a wall. Rolling, nothing hurts it. Hurt badly, it spins up and shatters: jump the ring.',
  },
  rootknot: {
    name: 'root knot', family: 'creature', plan: 'tentacled', planNo: 12, role: 'grappler', tier: 2, ranged: false,
    status: 'built', kind: 'rootknot', was: ['root stalker'], sound: 'roots', drop: 5, art: { main: 'perdide', alt: 'perdide2' },
    moves: ['grip', 'lash', 'spore puff'], answers: ['bloom glob (asleep, cuts double)', 'ember ×2', 'parry on the lash', 'jump the roots'],
    idle: 'stands rooted among the mushrooms and stumps; its cap turns to follow you',
    def: S({
      name: 'root knot', hp: 5, radius: 0.95, height: 1.5, speed: 1.6, sight: 16, giveUp: 30, reach: 6.5, heavy: true, rooted: true, breaks: true,
      tone: '#9fd86a', takes: { shoot: 1, fire: 2, push: 0, bloom: 'hold' },
      calm: { mode: 'root', wild: true, provoke: 3.6, alarm: 8 },
      attacks: [
        // two arms plunged into the soil, the cap tipped at you; then the soil heaves along the ground (a root running
        // under it, its body) and bursts up under you: caught, you are dragged in to the lash
        { id: 'grip', name: 'grip', shape: 'lane', width: 1.2, range: 6.5, damage: 0.25, wind: 1.0, strike: 0.45, contact: 0.85, grab: { time: 1.1, pull: 6 }, ground: true, then: 'lash', track: 0.3, min: 2.4, max: 6.5, weight: 2, onParry: 'cut',
          tell: 'it sinks two arms into the soil in front of it, its cap tipping toward you', counter: 'jump or evade sideways as the soil heaves at you; caught, a cut or stilling frees you' },
        { id: 'lash', name: 'lash', shape: 'cone', range: 2.9, angle: 1.0, damage: 0.5, wind: 0.75, strike: 0.26, contact: 0.5, max: 2.8, weight: 1.5, onParry: 'chip',
          tell: 'two arms coil back high', counter: 'guard; a parry cuts the arm' },
        { id: 'puff', name: 'spore puff', shape: 'ring', at: 'self', radius: 3.4, damage: 0, blur: 2, instant: true, wind: 1.0, max: 3.2, weight: 1, skins: ['perdide2'],
          tell: 'it squats and its cap shudders, the gills swelling', counter: 'step back out of the cloud' },
      ],
      recover: 1.5, cool: [1.6, 2.6], hit: 0.5,
    }),
    note: 'A root knot holds you for the others: when it plunges two arms into the ground, jump or step aside as the soil heaves at you, or its roots drag you in. It can’t be knocked back; a bloom glob puts it to sleep (cuts land double) and embers burn it.',
  },
  jelly: {
    name: 'lantern jelly', family: 'creature', plan: 'floater', planNo: 11, role: 'support', tier: 2, ranged: true,
    status: 'built', kind: 'jelly', was: [], sound: 'soft', drop: 4, art: 'sheet-1',
    moves: ['ward', 'mend', 'sting curtain'], answers: ['shot (each lantern)', 'boomerang', 'air cut when it sinks', 'the push knocks it off a mend'],
    idle: 'drifts with the wind in slow herds; never starts a fight',
    def: S({
      name: 'lantern jelly', hp: 3, radius: 0.75, height: 0.6, hover: 3.6, speed: 2.2, sight: 18, giveUp: 40, reach: 9, support: true, lanterns: 3, flinchy: true,
      tone: '#f2a45c', takes: { shoot: 'pop', fire: 1, push: 0 }, escort: 'blot',
      calm: { mode: 'drift', wild: true, provoke: 0, alarm: 14, joins: true },
      attacks: [
        { id: 'ward', name: 'ward', shape: 'ring', at: 'self', radius: 0.6, damage: 0, wind: 1.0, instant: true, ward: { time: 10, range: 9 }, max: 9, weight: 3,
          tell: 'a lantern swells and its bell pulses faster', counter: 'a shot or the boomerang pops the lantern, and the ward with it' },
        { id: 'mend', name: 'mend', shape: 'ring', at: 'self', radius: 0.6, damage: 0, wind: 1.5, instant: true, mend: { hp: 1.5, range: 8 }, max: 9, weight: 2, skins: ['perdide2', 'spheres', 'underwater', 'fallenring'],
          tell: 'it drifts down out of the air over a hurt one, low enough to reach', counter: 'the air cut or the push, while it is low' },
        { id: 'curtain', name: 'sting curtain', shape: 'ring', at: 'self', radius: 2.2, damage: 0.5, wind: 0.9, strike: 2.0, contact: 0.15, max: 2.2, weight: 2,
          tell: 'the bell clenches, its threads drawn up', counter: 'step out from under it' },
      ],
      recover: 1.4, cool: [1.4, 2.6], hit: 0.35,
    }),
    note: 'A lantern jelly keeps the others going: a thread of light from one of its lanterns halves the harm to the foe it holds. Shoot its lanterns (or throw the boomerang) to pop them, and catch it with the air cut when it sinks to mend one. Don’t stand under it.',
  },
  moth: {
    name: 'signal moth', family: 'creature', plan: 'flyer', planNo: 13, role: 'disruptor', tier: 2, ranged: true,
    status: 'built', kind: 'moth', was: ['sign moth'], sound: 'paper', drop: 1, art: 'sheet-1',
    moves: ['flash', 'dart', 'dust'], answers: ['push', 'fan’s gust', 'a light swing', 'shot'],
    idle: 'circles lamps and signs and sits on them in rows; fights near its lit sign',
    def: S({
      name: 'signal moth', hp: 1, radius: 0.5, height: 0.4, hover: 1.6, speed: 4.2, sight: 18, reach: 6.5, flinchy: true, light: true, group: 3, breaks: true,
      tone: '#ff5fa2', takes: { shoot: 1, fire: 1, push: 1 },
      calm: { mode: 'circle', wild: true, provoke: 5, alarm: 12 },
      attacks: [
        { id: 'flash', name: 'flash', shape: 'cone', at: 'self', instant: true, range: 6.5, angle: 0.5, damage: 0.25, blind: 1.5, wind: 1.0, min: 1.8, max: 6.5, weight: 2,
          tell: 'its wings snap open flat toward you and the eye-spots burn brighter, with a rising whine', counter: 'turn the camera away or guard' },
        { id: 'dart', name: 'dart', shape: 'lane', width: 1.2, range: 5, damage: 0.25, wind: 0.6, strike: 0.3, contact: 0.8, dive: true, max: 4.5,
          tell: 'its wings fold back along its body and it rears, nose high', counter: 'one light blow, or the push' },
        { id: 'dust', name: 'dust', shape: 'ring', at: 'self', instant: true, radius: 2.2, damage: 0, slip: 3, wind: 1.0, max: 2, skins: ['perdide2', 'antennas'],
          tell: 'it hovers right over you, fluttering, dust sifting off its wings', counter: 'step out from under it, or the push' },
      ],
      recover: 1.2, cool: [1.4, 2.6], hit: 0.25,
    }),
    note: 'Signal moths come in threes: when their wings snap open, turn away or guard (LB / L1), or the flash blinds you. One cut, one shot or a gust ends each.',
  },
  ray: {
    name: 'sky ray', family: 'creature', plan: 'glider', planNo: 14, role: 'air striker', tier: 1, ranged: false,
    status: 'built', kind: 'ray', was: ['winged blot'], sound: 'soft', drop: 3, art: 'sheet-1',
    moves: ['skim', 'tail lash', 'downdraft'], answers: ['parry grounds it', 'air cut as it passes low', 'wings or jets'],
    idle: 'circles in the thermals over cliffs and lands on warm rock with its wings spread flat',
    def: S({
      name: 'sky ray', hp: 3, radius: 0.9, height: 0.3, hover: 3.6, speed: 4.6, sight: 24, giveUp: 45, reach: 10,
      tone: '#b98674', takes: { shoot: 1, fire: 1 },
      calm: { mode: 'circle', wild: true, provoke: 7, alarm: 12 },
      attacks: [
        { id: 'skim', name: 'skim', shape: 'lane', width: 1.8, range: 10, damage: 0.75, wind: 1.2, strike: 0.6, contact: 0.15, dive: true, sweep: true, min: 3, max: 10, weight: 2, onParry: 'ground',
          tell: 'it banks round onto its line at you, wings swept back, with a rising whistle', counter: 'a parry grounds it (open a while); or evade' },
        { id: 'lash', name: 'tail lash', shape: 'cone', range: 2.8, angle: 0.9, damage: 0.5, wind: 0.75, strike: 0.24, contact: 0.5, max: 2.8, rear: true, back: true,
          tell: 'its whip tail lifts high behind it', counter: 'guard' },
        { id: 'draft', name: 'downdraft', shape: 'ring', at: 'self', radius: 3, damage: 0.25, wind: 1.1, strike: 0.6, contact: 0.3, draft: 7, max: 2.6, skins: ['arzach', 'arzach2'],
          tell: 'it stalls right over you, its wings rising high', counter: 'get out from under it, or the air cut up into it' },
      ],
      recover: 1.6, cool: [1.6, 2.6], hit: 0.3,
    }),
    note: 'A sky ray comes in low along a line: when it banks round and sweeps its wings back, guard (LB / L1) at the last moment and it ploughs into the ground, open; or step off its line. Cut it as it passes low.',
  },
  worm: {
    name: 'mound worm', family: 'creature', plan: 'burrower', planNo: 15, role: 'ambusher', tier: 1, ranged: false,
    status: 'built', kind: 'worm', was: ['dune ray'], sound: 'soft', drop: 4, art: 'sheet-1',
    moves: ['erupt', 'spit stones', 'dive'], answers: ['flush it out (stomp, gust, bomb, a cut at the fin)', 'air cut onto the mound', 'cut it while it is up'],
    idle: 'its mound wanders the dunes slowly, surfacing to eat thorn bushes; ignores you unless you stand on it',
    def: S({
      name: 'mound worm', hp: 4, radius: 0.8, height: 1.1, speed: 4.2, sight: 20, giveUp: 45, reach: 9, burrow: true,
      tone: '#c98d4f', takes: { shoot: 1, fire: 1 },
      calm: { mode: 'wander', wild: true, provoke: 2.6 },
      attacks: [
        { id: 'erupt', name: 'erupt', shape: 'ring', at: 'target', track: 0.6, radius: 1.8, damage: 0.75, wind: 1.3, knock: 5, surface: true, instant: true, max: 9, weight: 2,
          tell: 'its mound circles you, stops and trembles, and the fin sinks', counter: 'move off the spot: up, it stays up a while, open' },
        { id: 'spit', name: 'spit stones', shape: 'cone', range: 6.5, angle: 0.45, damage: 0.5, wind: 1.0, strike: 0.35, contact: 0.4, min: 3.2, max: 7, up: true, weight: 1.5,
          tell: 'it rears back and swells, its rings bunching', counter: 'guard' },
        { id: 'dive', name: 'dive', shape: 'ring', at: 'self', radius: 2.3, damage: 0.25, knock: 4, wind: 0.95, strike: 0.3, contact: 0.5, max: 2.4, up: true, dives: true,
          tell: 'it leans over toward you and the teeth round its mouth spin', counter: 'step back' },
      ],
      recover: 1.9, cool: [1.2, 2.2],
    }),
    note: 'A mound worm swims under the sand: when its mound stops and trembles and the fin sinks, move: it bursts up where you stood. Up, it stays a while to fight: cut it then. Cut the fin, drop a bomb or a stomp, or come down on the mound with the air cut to flush it out.',
  },
  // ----------------------------------------------------------------------------- possessed machines (always hostile)
  tripod: {
    name: 'lamp tripod', family: 'machine', plan: 'machine', planNo: 18, role: 'sniper', tier: 2, ranged: true,
    status: 'built', kind: 'tripod', was: ['makers’ machine (its sentinel role)'], sound: 'metal', drop: 6, art: { main: 'incal', alt: 'underwater' },
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
    status: 'built', kind: 'cart', was: ['slag walker'], sound: 'slag', drop: 8, art: { main: 'garage', alt: 'moonfoundry' },
    possession: 'boiling over: ink froths over the crucible’s rim, a column of black smoke with two eyes',
    moves: ['pour', 'ram', 'trail'], answers: ['a plain shot cools its crust (cuts ×2)', 'a bomb on its tracks (it can’t turn)', 'the combo from behind', 'a wall stalls its ram'],
    idle: 'trundles its old route between the furnaces, pouring into moulds that are no longer there',
    def: S({
      name: 'crucible cart', hp: 6, radius: 1.1, height: 1.0, speed: 2.0, sight: 16, giveUp: 30, reach: 8, heavy: true, breaks: true,
      trail: { every: 1.5, r: 0.7, life: 4.5 }, douse: 4, jams: 5, tracks: true,
      tone: '#ff8a2e', sound: 'machine', takes: { shoot: 1, fire: 0 }, weak: { bomb: 1.5 },
      calm: { mode: 'trundle', provoke: 10, round: 6 },
      attacks: [
        // the crucible tips toward you on its trunnions, the lip glowing; a cone of burning slag that stays a while
        { id: 'pour', name: 'pour', shape: 'cone', range: 4.6, angle: 0.55, damage: 0.75, wind: 1.2, strike: 0.6, contact: 0.4, leave: 'cone', leaveLife: 6, max: 4.6, weight: 2,
          tell: 'its crucible tips toward you on its trunnions, the lip glowing and the smoke leaning the same way', counter: 'get behind it or to the side of the lip; the slag stays a while: keep off it' },
        // it backs up, its tracks spinning in place and spitting gravel; then a charge along a line (a wall stalls it)
        { id: 'ram', name: 'ram', shape: 'lane', width: 2.0, range: 8, damage: 0.75, knock: 5, wind: 1.3, strike: 0.9, contact: 0.05, lunge: 10, sweep: true, reverse: 1.2, stall: 1.8, min: 3, max: 8, weight: 1.3,
          tell: 'it backs up, its tracks spinning in place and spitting gravel behind it', counter: 'evade out of its line; let it ram a wall and it stalls, open' },
      ],
      recover: 1.5, cool: [1.5, 2.5], hit: 0.5,
    }),
    note: 'A crucible cart makes ground you can’t stand on: when its crucible tips toward you, get behind it or to the side of the lip, and keep off the slag it pours and drips. A plain shot cools its crust (cuts land double), a bomb on its tracks jams them, and a wall stops its ram cold.',
  },
  bell: {
    name: 'bell walker', family: 'machine', plan: 'siege', planNo: 19, role: 'siege', tier: 3, ranged: true,
    status: 'built', kind: 'bell', was: [], sound: 'metal', drop: 8, art: { main: 'bazaar', alt: 'saltharbour' },
    possession: 'the clapper is the spirit, swinging inside the bell; ink drips from its mouth',
    moves: ['toll', 'drop', 'opening'], answers: ['the bell-note whistle chokes its toll', 'strike the clapper while it sits open', 'jump the rings', 'guard its drop (it tips open)'],
    idle: 'stands in a square and tolls the hours, softly',
    def: S({
      name: 'bell walker', hp: 6, radius: 1.3, height: 2.6, speed: 1.1, sight: 22, giveUp: 30, reach: 12, heavy: true, stout: true, clapper: true, breaks: true,
      tone: '#d8b048', sound: 'machine', takes: { shoot: 0, fire: 0 },
      calm: { mode: 'toll', provoke: 12 },
      attacks: [
        // reared back on its rear legs, the clapper swinging higher three times; then BONG: three rings over the ground
        { id: 'toll', name: 'toll', shape: 'ring', at: 'self', radius: 2.4, damage: 0.5, wind: 1.6, strike: 0.5, contact: 0.25, wave: { speed: 6.5, reach: 12, damage: 0.5, width: 0.6, count: 3, every: 0.7 }, whistle: true, max: 12, weight: 2,
          tell: 'it rears back on its rear legs and the clapper swings higher, three times', counter: 'jump each ring as it reaches you (a guard doesn’t stop them); answer its note with the bell-note whistle and the toll chokes' },
        // its legs straighten and the bell rises a metre; it slams its rim down where you stand, then tips up toward you
        { id: 'drop', name: 'drop', shape: 'ring', radius: 2.0, damage: 1, knock: 6, wind: 1.2, strike: 0.55, contact: 0.92, leap: { height: 1.3 }, range: 4.5, track: 0.5, opens: 2.5, onParry: 'open', max: 4.5, weight: 2.5,
          tell: 'its legs straighten and the bell rises a metre over it', counter: 'evade out from under it; then it tips up toward you: strike the clapper' },
      ],
      recover: 1.6, cool: [1.8, 2.8], hit: 0.5,
    }),
    note: 'A bell walker: only the clapper inside it takes harm. When it rears back and the clapper swings, jump each ring of its toll, or answer its note with the bell-note whistle and it chokes. When the bell rises, step out from under it: after it slams down it tips up toward you, open. Strike the clapper then.',
  },
  drone: {
    name: 'ring drone', family: 'machine', plan: 'hover', planNo: 13, role: 'tether', tier: 3, ranged: true,
    status: 'built', kind: 'drone', was: ['rust drone'], sound: 'metal', drop: 4, art: { main: 'incal', alt: 'spheres' },
    possession: 'a caught cloud between its plates, leaking at the gaps, two eyes drifting in it',
    moves: ['harpoon', 'ram', 'hide'], answers: ['guard the harpoon (the line is cut)', 'stilling (it drops)', 'magnet glove (it is metal)', 'the hook pulls it down'],
    idle: 'circles its old post polishing a dome that isn’t there; drifts after anything that shines',
    def: S({
      name: 'ring drone', hp: 3, radius: 0.7, height: 0.8, hover: 1.7, speed: 3.2, sight: 20, reach: 9.5, keep: 4, metal: true, breaks: true,
      tone: '#b8924e', sound: 'machine', takes: { shoot: 0, fire: 0 },
      calm: { mode: 'circle', provoke: 14 },
      attacks: [
        // the plates part and slow, a reel slides out between them clicking; the harpoon flies along a line and reels you in
        { id: 'harpoon', name: 'harpoon', shape: 'lane', width: 1.1, range: 9.5, damage: 0.5, wind: 1.1, strike: 0.3, contact: 0.7, tether: { time: 0.9, pull: 7.5 }, min: 3, max: 9.5, weight: 2, onParry: 'cut',
          tell: 'its plates part and slow, and a reel with a harpoon slides out between them, clicking round', counter: 'guard it and the line is cut (the drone dazed); evade; caught, a cut or stilling frees you' },
        // the plates lock and spin up, whining higher, as it rises rocked back; then it dives at you
        { id: 'ram', name: 'ram', shape: 'lane', width: 1.4, range: 6, damage: 0.5, wind: 0.95, strike: 0.35, contact: 0.8, dive: true, max: 6, weight: 1.2, onParry: 'cut',
          tell: 'its plates lock together and spin up, whining higher, as it rises rocked back', counter: 'guard it (a perfect parry dazes it); or evade' },
      ],
      recover: 1.4, cool: [1.6, 2.6], hit: 0.35,
    }),
    note: 'A ring drone hangs out of the blade’s reach and pulls you about: when its plates part and a harpoon slides out, guard (LB / L1) to cut the line, or evade. Stilled it drops; the magnet glove or the hook pulls it down to be cut. It hides between strikes.',
  },
  brute: {
    name: 'furnace brute', family: 'machine', plan: 'brute', planNo: 8, role: 'heavy', tier: 3, ranged: false,
    status: 'built', kind: 'brute', was: ['glass golem', 'makers’ machine (its slam and quake)'], sound: 'metal', drop: 8, art: { main: 'perdide2', alt: 'glassdunes' },
    possession: 'ink in the cracks: the hull cracked like a dropped jar, the dark seeping from every seam',
    moves: ['slam', 'hurl', 'sweep'], answers: ['riposte (×2 on the stunned)', 'bombs ×2 crack the hull', 'charged cut on a glowing crack', 'jump the quake'],
    idle: 'stands where it stopped working, rusted mid-task; wakes with a groan when you come close',
    def: S({
      name: 'furnace brute', hp: 8, radius: 1.15, height: 2.4, speed: 1.7, sight: 18, giveUp: 32, reach: 12, heavy: true, stout: true, breaks: true,
      tone: '#a77bff', sound: 'machine', takes: { shoot: 0, fire: 0 }, weak: { bomb: 2 },
      calm: { mode: 'stand', provoke: 7 },
      attacks: [
        // both fists high over the top of its body, the torso arching back, the veins blazing; down, and a quake runs out
        { id: 'slam', name: 'slam', shape: 'ring', radius: 2.1, ahead: 1.9, damage: 1, knock: 6, wind: 1.3, strike: 0.32, contact: 0.6, wave: { speed: 7, reach: 8, damage: 0.5, width: 0.55 }, max: 3.6, weight: 2, onParry: 'chip',
          tell: 'both fists rise high over the top of its body, the torso arching back and the cracks blazing violet', counter: 'evade to the side and jump the quake; a perfect parry chips it (a crack bursts)' },
        // it bends over and tears a slab out of the ground, straightens with it high over its shoulder, and throws it
        { id: 'hurl', name: 'hurl', shape: 'ring', at: 'target', instant: true, lob: true, radius: 1.7, damage: 0.75, wind: 1.5, track: 0.5, min: 4.5, max: 12, weight: 1.5,
          tell: 'it bends over and tears a slab out of the ground, then straightens with it held high over its shoulder', counter: 'walk out of the mark where it will land' },
        // one arm swung back behind it, the shoulder turning; then a backhand across its front
        { id: 'sweep', name: 'sweep', shape: 'cone', range: 3.6, angle: 1.3, damage: 0.75, knock: 5, wind: 1.05, strike: 0.3, contact: 0.5, max: 3.4, weight: 1.2,
          tell: 'one arm swings back behind it, its shoulder turning away', counter: 'duck under it with an evade, or guard' },
      ],
      recover: 1.6, cool: [1.6, 2.6], hit: 0.55,
    }),
    note: 'A furnace brute: light cuts don’t stagger it. When both fists rise over its head, get to its side and jump the quake that runs out; a perfect parry chips its hull. When it tears up a slab, walk out of the mark. Bombs crack it twice as deep, and a riposte on the stunned lands double.',
  },
  // ----------------------------------------------------------------------------- spirits (the dark itself)
  blot: {
    name: 'ink blot', family: 'spirit', plan: 'blob', planNo: 20, role: 'rusher', tier: 1, ranged: true,
    status: 'built', kind: 'blot', was: ['ink blot', 'spitting blot (its spit)'], sound: 'ink', drop: 2, art: { main: 'desert', alt: 'garage' },
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
    status: 'built', kind: 'shade', was: ['shade'], sound: 'ink', drop: 8, art: { main: 'perdide2', alt: 'eclipse' },
    manifestation: 'a cloak of smoke worn by nothing; the sword is poured ink',
    moves: ['cut', 'feint and thrust', 'step through the shade'], answers: ['parry and riposte', 'ember (lit, it is solid: no step, and it burns)', 'an evade sideways from the thrust'],
    idle: 'walks a path it walked in life and stops at doorways',
    def: S({
      name: 'shade', hp: 5, radius: 0.45, height: 1.3, speed: 3.0, sight: 18, giveUp: 40, reach: 7, clamber: true, lights: true,
      tone: '#3b2a5c', takes: { shoot: 1, fire: 2 },
      calm: { mode: 'pace', provoke: 5, round: 5, wait: 2.5 },
      attacks: [
        // the sword drawn back over its shoulder, the body turning away, the hood turning to keep you in sight; the cut across
        { id: 'cut', name: 'cut', shape: 'cone', range: 2.9, angle: 0.9, damage: 0.5, wind: 0.9, strike: 0.24, contact: 0.55, max: 2.8, weight: 2,
          tell: 'the sword drawn back over its shoulder, its hood turning to keep you in sight', counter: 'parry, then riposte' },
        // it starts the cut and stops halfway, the hood tilting; the sword drops to its hip; then the thrust, low and straight
        { id: 'feint', name: 'feint and thrust', shape: 'lane', width: 1.0, range: 3.6, damage: 0.75, wind: 1.3, strike: 0.22, contact: 0.5, lunge: 1.4, feint: 0.45, min: 1.2, max: 3.4, weight: 1.5,
          tell: 'it starts the cut and stops halfway, its hood tilting; the sword drops to its hip and it sinks', counter: 'evade sideways; or a parry timed on the thrust (not on the cut it never makes)' },
        // it sinks into its own shadow, the pool slides round beside you, it pours up out of it there and cuts; lit, it can't
        { id: 'step', name: 'step through the shade', shape: 'ring', at: 'beside', instant: true, radius: 1.3, track: 0.6, damage: 0, blink: true, dark: true, wind: 1.0, then: 'recut', min: 3.5, max: 7, weight: 1.2,
          tell: 'its cloak collapses into a pool of shadow, and the pool slides round beside you', counter: 'turn and guard; an ember lights it solid and it can’t step at all' },
        { id: 'recut', chain: true, shape: 'cone', range: 2.6, angle: 0.9, damage: 0.5, wind: 0.55, strike: 0.22, contact: 0.5 },
      ],
      recover: 1.1, cool: [1.2, 2.2], hit: 0.4,
    }),
    note: 'A shade fights like you: parry its cut (LB / L1 as it lands) and riposte. When its cut stops halfway and the sword drops to its hip, it is about to thrust: evade sideways. When its cloak sinks into a pool, it comes up beside you; an ember lights it solid, and then it can’t step.',
  },
  hound: {
    name: 'antler hound', family: 'spirit', plan: 'quadruped', planNo: 6, role: 'stalker', tier: 4, ranged: false,
    status: 'built', kind: 'hound', was: ['shadow hound'], sound: 'ink', drop: 4, art: { main: 'spheres', alt: 'mangrove' },
    manifestation: 'a shadow cast by nothing: it runs as a flat shadow and rises out of it into a body',
    moves: ['pounce', 'step behind', 'antler rake'], answers: ['ember (solid, and it burns: 2)', 'the lantern', 'parry'],
    idle: 'shadows lie under trees and arches where there shouldn’t be any; one stands up and watches you go; not every one hunts',
    def: S({
      name: 'antler hound', hp: 3, radius: 0.55, height: 1.15, speed: 5.6, sight: 22, giveUp: 45, reach: 7, phase: true, group: 2, clamber: true,
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
    status: 'built', kind: 'marionette', was: [], sound: 'paper', drop: 8, art: { main: 'spheres', alt: 'bazaar' },
    manifestation: 'the puppeteer: strings rise into a knot of smoke and drop onto other things',
    moves: ['strings', 'yank', 'dance'], answers: ['cut the strings it drops (the air cut, the boomerang, an ember): the creature goes free', 'air cut, wings or jets to its body', 'evade the yank; a guard cuts its line'],
    idle: 'hangs still under bridges, cranes and arches, swaying like a coat on a hook',
    def: S({
      name: 'marionette', hp: 4, radius: 0.5, height: 1.4, hover: 1.1, speed: 2.4, sight: 20, giveUp: 40, reach: 12, keep: 5, puppeteer: true,
      tone: '#8a6cc8', takes: { shoot: 1, fire: 2 }, escort: 'crab',
      calm: { mode: 'hang', provoke: 9 },
      attacks: [
        // both arms lift, the fingers curl, two strings unspool down from its hands onto a creature near it: driven
        { id: 'strings', name: 'strings', shape: 'ring', at: 'self', radius: 0.6, damage: 0, wind: 1.2, instant: true, possess: { range: 12, time: 14 }, max: 12, weight: 3,
          tell: 'it lifts both arms, its fingers curling, and two strings unspool down from its hands', counter: 'cut the strings (the air cut, the boomerang, an ember): the creature drops free' },
        // one arm rises and a string swings out toward you; caught, you are lifted off your feet toward it
        { id: 'yank', name: 'yank', shape: 'lane', width: 1.2, range: 9, damage: 0.25, wind: 1.0, strike: 0.3, contact: 0.6, tether: { time: 0.7, pull: 8 }, lift: 4.5, min: 2.5, max: 9, weight: 2, onParry: 'cut',
          tell: 'one arm rises high and a string swings out toward you', counter: 'evade; a guard cuts the line; caught, a cut frees you' },
        // alone, with nothing to hold: it drops low and its legs jerk up together; then it whirls, kicking; slack after
        { id: 'dance', name: 'dance', shape: 'ring', at: 'self', radius: 2.4, damage: 0.5, knock: 4, wind: 0.95, strike: 0.6, contact: 0.5, alone: true, recover: 2.4, max: 3.2, weight: 2,
          tell: 'it drops low on its strings and its legs jerk up together', counter: 'guard; after the whirl it hangs slack, open' },
      ],
      recover: 1.4, cool: [1.4, 2.6], hit: 0.4,
    }),
    note: 'A marionette drives the creatures round it: when it lifts its arms and strings unspool from its hands, it is dropping them onto a creature, whose eyes go black. Cut the strings (an air cut, the boomerang, an ember) and the creature drops free. Its body hangs out of easy reach: jump for it, or wait for its dance and cut it while it hangs slack.',
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
