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
//             flee { run, far, up, time, crouch }: run at it (faster than `run` m/s) inside `shy` and it flies off
//             `far` m away, `up` m high, to a new home (Foe.takeOff: the heron)
//   sound     its hurt and burst family (combat-v1.4 rec. 2): a shell's clack, glass ringing, a bellows wheezing, brass,
//             ink, cloth…; its own voice in it is src/foe-voices.js FOE_VOICES[kind] (src/audio.js foeHurt / foeBurst)
//   drop      chimes it leaves (src/chimes.js DROP_OF)
//   was       the old kinds it replaces or folds in
//   art       'pending': its fresh reference sheet (docs/design/enemy-roster-prompts.md) is not matched yet; the
//             built body follows the doc's description and the best existing references until it is
//             'sheet-N': the built body is drawn to its picked sheet, references/enemy-archetypes/<id>/sheet-N.jpg
//             { main, alt }: drawn to both its sheets, sheet-1.jpg in the main skin's world (main), sheet-2.jpg in
//             the alternate's (alt): its palettes too (scripts/enemy-roster/compare.mjs sets them side by side)
//             { reference, skin }: drawn to the enemy rebuild's approved image (#800, references/enemy-redesign-2026-10-30/), in that skin
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
//   attack.cue      a sound in its wind-up over the rising warning (src/foe-voices.js CUES, src/audio.js foeWarn): 'coil'
//                   (the hound's snarl as it coils to pounce), 'quake' (the makers' machine's rumble under its ground slam)
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
//   rooted          it can't be knocked back (the root knot); attack.ground: only on your feet (a jump clears it: the
//                   hulk's stomp; the root knot's grip until #769);
//                   attack.blur: s your sight is blurred by spores, whichever way you look
// batch 4 (v1.16), the machines:
//   stout           light cuts never stagger it, even early in a wind-up (the furnace brute, the bell walker: heavy breakers)
//   attack.wave     a quake or a ring of sound running out over the ground (jump it); wave.count: that many, wave.every s apart
//   attack.leaveLife  s its slag stays (the cart's pour); jams: s a bomb on its legs keeps it from turning (the cart)
//   attack.reverse  m it backs up through the wind-up (the cart's ram); attack.stall: s it stands stunned if a wall stops it
//   attack.opens    s it sits open after the strike (the bell's drop: tipped toward you, the clapper in reach)
//   clapper         only the clapper takes harm: a cut, a bomb glance off the bell unless it sits open or is stilled (the bell)
//   attack.whistle  the bell-note whistle sounded near it as it winds this up chokes it: it sits open (Foes.bellNote)
// batch 5 (v1.18), the late spirits and the roller:
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
    answers: ['parry (the spin flips it)', 'dash cut to its side', 'the air cut onto its clamped shell', 'bombs crack the shell', 'ember'],
    idle: 'picks along the tide line pinching at weed; backs away when you come near; fights only if you corner it',
    // (hp 3 since v1.41, was 4; the author: "they take too many hits". A heavy blow bites through its shell from the
    // front too, at half: src/foes.js SHELL)
    def: S({
      name: 'shellback crab', hp: 3, hook: 'heavy', radius: 0.85, height: 0.6, speed: 3.2, sight: 15, giveUp: 30, reach: 8, heavy: true, shell: true, breaks: true,
      tone: '#b8553a', sound: 'machine', takes: { shoot: 0, fire: 1 }, weak: { bomb: 1.5 },
      calm: { mode: 'graze', wild: true, provoke: 3.2, shy: 7, alarm: 10 }, burst: [0.75, 0.45], sideways: true,
      // its guard (issue #661, src/foe-guard.js): close in and it clamps its shell down flat, legs and stalks drawn under;
      // every blow from every side rings off it. The air cut's plunge onto its back cracks it open, onto its back; a bomb too.
      // Cut at it three times and it springs out of it into a snap.
      guard: { pose: 'tuck', arc: Math.PI, near: 2.8, hold: 2.2, rest: 2.0, blocks: 3, counter: 'snap', breaks: ['air', 'bomb'], open: 1.4, onBreak: 'flip',
        hint: 'It clamps its shell down: nothing gets in. Come down on it with an air cut.' },
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
    note: 'A shellback crab: get round its shell, or guard its spin to flip it.',
  },
  skitter: {
    name: 'skitter swarm', family: 'creature', plan: 'skitterers', planNo: 2, role: 'swarm', tier: 1, ranged: false,
    status: 'built', kind: 'skitter', was: ['blot swarm'], sound: 'chitin', drop: 0.5, art: { main: 'desert', alt: 'moonfoundry' },
    moves: ['ripple rush', 'pile'], answers: ['push', 'ember', 'the combo’s sweeping third swing'],
    idle: 'grazes in a loose flock; scatters in a ripple when you run at it, and comes back; fights only if you stay in the middle of it',
    def: S({
      name: 'skitter', hp: 1, hook: 'light', radius: 0.32, height: 0.22, speed: 5.4, sight: 16, giveUp: 40, reach: 4.6, light: true, group: 8,
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
    note: 'Skitters ring you in their flock. One hit ends each; push heaps apart.',
  },
  centipede: {
    name: 'ring centipede', family: 'creature', plan: 'centipede', planNo: 3, role: 'trapper', tier: 3, ranged: false,
    status: 'built', kind: 'centipede', was: [], sound: 'chitin', drop: 6, art: 'sheet-1',
    moves: ['ring', 'pincer lunge', 'segment shed'], answers: ['wings or jets out of the ring', 'air cut on the head', 'parry', 'the push breaks the ring'],
    idle: 'suns coiled on warm rocks and unrolls slowly when you pass',
    def: S({
      name: 'ring centipede', hp: 6, hook: 'heavy', radius: 0.75, height: 0.55, speed: 4.4, sight: 18, giveUp: 40, reach: 6, heavy: true, segmented: true, breaks: true,
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
    note: 'A ring centipede: only the head counts. Jet out before the ring closes.',
  },
  toad: {
    name: 'bellows toad', family: 'creature', plan: 'hopper', planNo: 5, role: 'lobber', tier: 1, ranged: true,
    status: 'built', kind: 'toad', was: ['spitting blot (its lobber role)'], sound: 'bellows', drop: 3, art: { main: 'perdide', alt: 'incal' },
    moves: ['spore lob', 'volley', 'belly flop'], answers: ['a shot in the swollen throat', 'air cut', 'closing in'],
    idle: 'sits by water with its throat pulsing, croaking in chorus; fights only within 4 m or if one near it is hurt',
    def: S({
      name: 'bellows toad', hp: 3, hook: 'heavy', radius: 0.85, height: 1.1, speed: 2.4, sight: 18, giveUp: 38, reach: 11, keep: 6.5, perch: true, hops: true,
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
    note: 'A bellows toad: leave its mark or shoot its throat. Jump its ring.',
  },
  lizard: {
    name: 'horn lizard', family: 'creature', plan: 'quadruped', planNo: 6, role: 'flanker', tier: 2, ranged: false,
    status: 'built', kind: 'lizard', was: [], sound: 'scale', drop: 4, art: { main: 'incal', alt: 'bazaar' },
    moves: ['blare', 'flank bite', 'tail whip'],
    answers: ['parry and riposte on the bite', 'dash cut past the blarer', 'split the pair (the hook)'],
    idle: 'basks on warm stones and blares at the others in turn; territorial near its stones, harmless away from them',
    def: S({
      name: 'horn lizard', hp: 3, hook: 'light', radius: 0.6, height: 0.55, speed: 4.6, sight: 18, giveUp: 40, reach: 7, clamber: true, group: 2, flanks: true,
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
    note: 'Horn lizards hunt in pairs: guard the blare, turn, and parry the bite.',
  },
  heron: {
    name: 'stilt heron', family: 'creature', plan: 'stilt', planNo: 7, role: 'reach', tier: 1, ranged: false,
    status: 'built', kind: 'heron', was: [], sound: 'clay', drop: 3, art: { main: 'desert', alt: 'arzach' },
    moves: ['spear', 'sweep', 'wing buffet'], answers: ['dash cut inside its reach', 'charged cut at a leg topples it', 'parry the spear'],
    idle: 'wades and fishes, stabbing at the water; walks off if you come near, flies off if you run at it; fights only if you corner it',
    def: S({
      name: 'stilt heron', hp: 4, hook: 'light', radius: 0.6, height: 1.3, speed: 2.6, sight: 18, giveUp: 34, reach: 5.2, topples: true,
      tone: '#5fbfb0', takes: { shoot: 1, fire: 1 },
      // (run at it and it flies off, to land 13 m away: its new home; only walk up and it strides away)
      calm: { mode: 'wade', wild: true, provoke: 2.8, shy: 7, alarm: 8, flee: { run: 3.2, far: 13, up: 3.6, time: 2.1, crouch: 0.45 } },
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
    note: 'A stilt heron: when its neck draws into an S, step aside. Cut its legs.',
  },
  roller: {
    name: 'pearl roller', family: 'creature', plan: 'roller', planNo: 16, role: 'charger', tier: 2, ranged: false,
    status: 'built', kind: 'roller', was: [], sound: 'shell', drop: 4, art: { main: 'garage', alt: 'spheres' },
    moves: ['bowl', 'ricochet', 'last roll'], answers: ['guard: it bounces off stunned (then the charged cut into its foot)', 'walls: sidestep it into one', 'the bubble (it floats, helpless)'],
    idle: 'grazes moss in slow glistening trails, and pulls in if you touch it',
    def: S({
      name: 'pearl roller', hp: 4, hook: 'light', radius: 0.8, height: 0.9, speed: 2.4, sight: 16, giveUp: 30, reach: 9,
      tone: '#e8d7f0', takes: { shoot: 1, fire: 1 },
      calm: { mode: 'graze', wild: true, provoke: 2.4, alarm: 8 },
      attacks: [
        // its eye stalks sink and the shell rocks back on its foot three times; then it pulls in and rolls along a lane,
        // bouncing off a wall once (the next stalls it, stunned); rolling, nothing harms it; a guard bounces it off stunned
        { id: 'bowl', name: 'bowl', shape: 'lane', width: 1.6, range: 9, damage: 0.75, knock: 5, wind: 1.0, strike: 1.0, contact: 0.05, lunge: 9, sweep: true, rolls: true, bounces: 1, stall: 3, onParry: 'bounce', min: 2.5, max: 9, weight: 2,
          tell: 'its eye stalks sink and the shell rocks back and forth on its foot, three times', counter: 'guard it and it bounces off stunned; or sidestep it into a wall' },
        { id: 'ricochet', name: 'ricochet', shape: 'lane', width: 1.6, range: 9, damage: 0.75, knock: 5, wind: 1.0, strike: 1.0, contact: 0.05, lunge: 9, sweep: true, rolls: true, bounces: 2, stall: 3, onParry: 'bounce', min: 2.5, max: 9, weight: 1.5, skins: ['spheres', 'spacecity'],
          tell: 'the same rocking, faster, and its spiral glows', counter: 'guard it; keep away from the walls it bounces off at you' },
        // at a third of its health (a quarter until v2.33: the combo skipped it, issue #722): it spins in place, glowing, rolls at you and shatters in a ring of pearl
        { id: 'last', name: 'last roll', shape: 'lane', width: 1.8, range: 10, damage: 0.75, knock: 6, wind: 1.6, strike: 1.1, contact: 0.05, lunge: 10, sweep: true, rolls: true, onParry: 'bounce', shatter: { speed: 6, reach: 4.5, damage: 0.5, width: 0.55 }, below: 0.34, min: 1.5, max: 9, weight: 6,
          tell: 'it pulls in and spins in place, faster and faster, its spiral glowing', counter: 'evade at the last moment and jump its ring; or let it hit a wall: it breaks there alone' },
      ],
      recover: 1.4, cool: [1.6, 2.8], hit: 0.4,
    }),
    note: 'A pearl roller: guard its roll to stun it, or sidestep it into a wall.',
  },
  rootknot: {
    name: 'root knot', family: 'creature', plan: 'tentacled', planNo: 12, role: 'mortar', tier: 2, ranged: true,
    status: 'built', kind: 'rootknot', was: ['root stalker'], sound: 'roots', drop: 5, art: { main: 'perdide', alt: 'perdide2' },
    moves: ['spore pod', 'seed volley', 'spore puff'], answers: ['close in: rooted, it can’t follow you or back away', 'bloom glob (asleep, cuts double)', 'ember ×2', 'walk out of the mark'],
    idle: 'stands rooted among the mushrooms and stumps; its cap turns to follow you',
    def: S({
      name: 'root knot', hp: 5, hook: 'heavy', radius: 0.95, height: 1.5, speed: 1.6, sight: 16, giveUp: 30, reach: 11, heavy: true, rooted: true, breaks: true,
      tone: '#9fd86a', takes: { shoot: 1, fire: 2, push: 0, bloom: 'hold' },
      calm: { mode: 'root', wild: true, provoke: 3.6, alarm: 8 },
      // (issue #769, the author: "make the big mushroom send projectiles not melee attacks": its grip along the ground and
      // its lash went for two lobs; each keeps its landing mark in the ground through its wind-up, src/ground-warnings.js #758)
      attacks: [
        // the spore pod: its cap tips back and its gills swell, a pod fattening under the rim; then the cap snaps forward
        // and flings the pod high onto where you stood, where it bursts into spores that slow you a while
        { id: 'pod', name: 'spore pod', shape: 'ring', at: 'target', instant: true, lob: true, radius: 1.8, damage: 0.5, wind: 1.4, track: 0.5, leave: 'spores', min: 1.5, max: 11, weight: 2,
          tell: 'its cap tips back and its gills swell, a pod of spores fattening under the rim', counter: 'walk out of the mark before the pod comes down; close in: rooted, it can’t follow' },
        // the seed volley: up on its arms, its cap shuddering, seeds rattling under the rim; then three hard seeds flung in
        // a row across where you stood
        { id: 'seeds', name: 'seed volley', shape: 'ring', at: 'target', instant: true, lob: true, spread: [-2.6, 0, 2.6], radius: 1.1, damage: 0.5, wind: 1.6, track: 0.4, min: 4, max: 11, weight: 1.5,
          tell: 'it rises up on its arms and its cap shudders, seeds rattling under the rim', counter: 'step out of the row of marks' },
        { id: 'puff', name: 'spore puff', shape: 'ring', at: 'self', radius: 3.4, damage: 0, blur: 2, instant: true, wind: 1.0, max: 3.2, weight: 1, skins: ['perdide2'],
          tell: 'it squats and its cap shudders, the gills swelling', counter: 'step back out of the cloud' },
      ],
      recover: 1.5, cool: [1.6, 2.6], hit: 0.5,
    }),
    note: 'A root knot lobs from afar: walk out of its mark, or close in.',
  },
  jelly: {
    name: 'lantern jelly', family: 'creature', plan: 'floater', planNo: 11, role: 'support', tier: 2, ranged: true,
    status: 'built', kind: 'jelly', was: [], sound: 'glass', drop: 4, art: 'sheet-1',
    moves: ['ward', 'mend', 'sting curtain'], answers: ['shot (each lantern)', 'boomerang', 'air cut when it sinks', 'the push knocks it off a mend'],
    idle: 'drifts with the wind in slow herds; never starts a fight',
    def: S({
      name: 'lantern jelly', hp: 3, hook: 'flyer', radius: 0.75, height: 0.6, hover: 3.6, speed: 2.2, sight: 18, giveUp: 40, reach: 9, support: true, lanterns: 3, flinchy: true,
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
    note: 'A lantern jelly shields the others: shoot or boomerang its lanterns.',
  },
  moth: {
    name: 'signal moth', family: 'creature', plan: 'flyer', planNo: 13, role: 'disruptor', tier: 2, ranged: true,
    status: 'built', kind: 'moth', was: ['sign moth'], sound: 'paper', drop: 1, art: 'sheet-1',
    moves: ['flash', 'dart', 'dust'], answers: ['push', 'fan’s gust', 'a light swing', 'shot'],
    idle: 'circles lamps and signs and sits on them in rows; fights near its lit sign',
    def: S({
      name: 'signal moth', hp: 1, hook: 'flyer', radius: 0.5, height: 0.4, hover: 1.6, speed: 4.2, sight: 18, reach: 6.5, flinchy: true, light: true, group: 3, breaks: true,
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
    note: 'Signal moths: when their wings snap open, turn away or guard.',
  },
  ray: {
    name: 'sky ray', family: 'creature', plan: 'glider', planNo: 14, role: 'air striker', tier: 1, ranged: false,
    status: 'built', kind: 'ray', was: ['winged blot'], sound: 'hide', drop: 3, art: 'sheet-1',
    moves: ['skim', 'tail lash', 'downdraft'], answers: ['parry grounds it', 'air cut as it passes low', 'wings or jets'],
    idle: 'circles in the thermals over cliffs and lands on warm rock with its wings spread flat',
    def: S({
      name: 'sky ray', hp: 3, hook: 'flyer', radius: 0.9, height: 0.3, hover: 3.6, speed: 4.6, sight: 24, giveUp: 45, reach: 10,
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
    note: 'A sky ray: guard late and it ploughs into the ground. Or step aside.',
  },
  worm: {
    name: 'mound worm', family: 'creature', plan: 'burrower', planNo: 15, role: 'ambusher', tier: 1, ranged: false,
    status: 'built', kind: 'worm', was: ['dune ray'], sound: 'earth', drop: 4, art: 'sheet-1',
    moves: ['erupt', 'spit stones', 'dive'], answers: ['flush it out (stomp, gust, bomb, a cut at the fin)', 'air cut onto the mound', 'cut it while it is up'],
    idle: 'its mound wanders the dunes slowly, surfacing to eat thorn bushes; ignores you unless you stand on it',
    def: S({
      name: 'mound worm', hp: 4, hook: 'heavy', radius: 0.8, height: 1.1, speed: 4.2, sight: 20, giveUp: 45, reach: 9, burrow: true,
      tone: '#c98d4f', takes: { shoot: 1, fire: 1 },
      calm: { mode: 'wander', wild: true, provoke: 2.6 },
      attacks: [
        { id: 'erupt', name: 'erupt', shape: 'ring', at: 'target', track: 0.6, radius: 1.8, damage: 0.75, wind: 1.3, knock: 5, surface: true, instant: true, max: 9, weight: 2,
          tell: 'its mound circles you, stops and trembles, and the fin sinks', counter: 'move off the spot: up, it stays up a while, open' },
        { id: 'spit', name: 'spit stones', shape: 'cone', range: 6.5, angle: 0.45, damage: 0.5, wind: 1.0, strike: 0.35, contact: 0.4, min: 3.2, max: 7, up: true, shot: true, weight: 1.5,
          tell: 'it rears back and swells, its rings bunching', counter: 'guard' },
        { id: 'dive', name: 'dive', shape: 'ring', at: 'self', radius: 2.3, damage: 0.25, knock: 4, wind: 0.95, strike: 0.3, contact: 0.5, max: 2.4, up: true, dives: true,
          tell: 'it leans over toward you and the teeth round its mouth spin', counter: 'step back' },
      ],
      recover: 1.9, cool: [1.2, 2.2],
    }),
    note: 'A mound worm: if its mound trembles, move. Cut it once it’s up.',
  },
  // ----------------------------------------------------------------------------- possessed machines (always hostile)
  tripod: {
    name: 'lamp tripod', family: 'machine', plan: 'machine', planNo: 18, role: 'sniper', tier: 2, ranged: true,
    status: 'built', kind: 'tripod', was: ['makers’ machine (its sentinel role)'], sound: 'steam', drop: 6, art: { main: 'incal', alt: 'underwater' },
    possession: 'a face at the porthole: the dark presses against the boiler’s window from inside, its steam comes out black',
    moves: ['beam and bolt', 'stamp', 'steam vent'],
    answers: ['cover breaks the beam', 'dash under it', 'magnet glove (it is metal)', 'parry sends the bolt back'],
    idle: 'patrols its old round sweeping the lamp across the walls; stops and peers at anything moving',
    def: S({
      name: 'lamp tripod', hp: 5, hook: 'heavy', radius: 0.9, height: 1.6, speed: 2.1, sight: 22, giveUp: 40, reach: 18, keep: 9, heavy: true, metal: true, breaks: true,
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
    note: 'A lamp tripod: when its light narrows, take cover or guard the bolt.',
  },
  cart: {
    name: 'crucible cart', family: 'machine', plan: 'crucible', planNo: 17, role: 'area denier', tier: 3, ranged: true,
    status: 'built', kind: 'cart', was: ['slag walker', 'welding cart'], sound: 'slag', drop: 8, art: { main: 'garage', alt: 'moonfoundry', reference: 'references/enemy-redesign-2026-10-30/keep-cart/13ed7341-1960-43e2-8f12-8b8481c2bd68-3.png', skin: 'garage' },
    possession: 'boiling over: its brew froths at the rim, and its one eye slides round the pot to find you',
    moves: ['pour', 'ram', 'trail'], answers: ['a plain shot cools its crust (cuts ×2)', 'a bomb on its legs (it can’t turn)', 'the combo from behind', 'a wall stalls its ram'],
    idle: 'plods its old route between the furnaces, pouring into moulds that are no longer there',
    def: S({
      name: 'crucible cart', hp: 6, hook: 'heavy', radius: 1.1, height: 1.0, speed: 2.0, sight: 16, giveUp: 30, reach: 8, heavy: true, breaks: true,
      trail: { every: 1.5, r: 0.7, life: 3.5 }, douse: 4, jams: 5, tracks: true,
      tone: '#ff8a2e', sound: 'machine', takes: { shoot: 1, fire: 0 }, weak: { bomb: 1.5 },
      calm: { mode: 'trundle', provoke: 10, round: 6 },
      attacks: [
        // it sits back on its hind legs and tips its rim toward you, the spout glowing; a cone of burning slag that stays a while
        { id: 'pour', name: 'pour', shape: 'cone', range: 4.6, angle: 0.55, damage: 0.75, wind: 1.2, strike: 0.6, contact: 0.4, leave: 'cone', leaveLife: 4, max: 4.6, weight: 2,
          tell: 'it sinks onto its front legs and tips its rim toward you, the spout glowing and the brew rising', counter: 'get behind it or to the side of the lip; the slag stays a while: keep off it' },
        // it backs up squatting, its feet scrabbling and spitting gravel; then a charge along a line (a wall stalls it)
        { id: 'ram', name: 'ram', shape: 'lane', width: 2.0, range: 8, damage: 0.75, knock: 5, wind: 1.3, strike: 0.9, contact: 0.05, lunge: 10, sweep: true, reverse: 1.2, stall: 1.8, min: 3, max: 8, weight: 1.3,
          tell: 'it backs up squatting low, its feet scrabbling and spitting gravel behind it', counter: 'evade out of its line; let it ram a wall and it stalls, open' },
      ],
      recover: 1.5, cool: [1.5, 2.5], hit: 0.5,
    }),
    note: 'A crucible cart: get behind it and off its slag. A shot cools its crust.',
  },
  bell: {
    name: 'bell walker', family: 'machine', plan: 'siege', planNo: 19, role: 'siege', tier: 3, ranged: true,
    status: 'built', kind: 'bell', was: ['spider-legged bell walker'], sound: 'brass', drop: 8, art: { main: 'bazaar', alt: 'saltharbour', reference: 'references/enemy-redesign-2026-10-30/keep-bell/b4852320-c23b-4bf7-a8e2-10c9ede8cabd-1.png', skin: 'bazaar' },
    possession: 'the clapper is the spirit, a black ball with two pale slit eyes hanging under the bell’s mouth; ink drips from it',
    moves: ['toll', 'drop', 'opening'], answers: ['the bell-note whistle chokes its toll', 'strike the clapper while it sits open', 'jump the rings', 'guard its drop (it tips open)'],
    idle: 'stands in a square and tolls the hours, softly',
    def: S({
      name: 'bell walker', hp: 6, hook: 'armoured', radius: 1.3, height: 2.6, speed: 1.1, sight: 22, giveUp: 30, reach: 12, heavy: true, stout: true, clapper: true, breaks: true,
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
    note: 'A bell walker: only the clapper counts. Jump each ring, or whistle back.',
  },
  drone: {
    name: 'ring drone', family: 'machine', plan: 'hover', planNo: 13, role: 'tether', tier: 3, ranged: true,
    status: 'built', kind: 'drone', was: ['rust drone'], sound: 'tin', drop: 4, art: { main: 'incal', alt: 'spheres' },
    possession: 'a caught cloud between its plates, leaking at the gaps, two eyes drifting in it',
    moves: ['harpoon', 'ram', 'hide'], answers: ['guard the harpoon (the line is cut)', 'stilling (it drops)', 'magnet glove (it is metal)', 'the hook pulls it down'],
    idle: 'circles its old post polishing a dome that isn’t there; drifts after anything that shines',
    def: S({
      name: 'ring drone', hp: 3, hook: 'flyer', radius: 0.7, height: 0.8, hover: 1.7, speed: 3.2, sight: 20, reach: 9.5, keep: 4, metal: true, breaks: true,
      tone: '#b8924e', sound: 'machine', takes: { shoot: 0, fire: 0 },
      calm: { mode: 'circle', provoke: 14 },
      attacks: [
        // the plates part and slow, a reel slides out between them clicking; the harpoon flies along a line and reels you in
        { id: 'harpoon', name: 'harpoon', shape: 'lane', width: 1.1, range: 9.5, damage: 0.5, wind: 1.1, strike: 0.3, contact: 0.7, tether: { time: 0.9, pull: 7.5 }, min: 3, max: 9.5, weight: 2, onParry: 'cut',
          tell: 'its plates part and slow, and a reel with a harpoon slides out between them, clicking round', counter: 'guard it and the line is cut (the drone dazed); evade; caught, a cut or stilling frees you' },
        // the plates lock and spin up, whining higher, as it rises rocked back; then it dives at you
        { id: 'ram', name: 'ram', shape: 'lane', width: 1.4, range: 6, damage: 0.75, wind: 0.95, strike: 0.35, contact: 0.8, dive: true, max: 6, weight: 1.2, onParry: 'cut',
          tell: 'its plates lock together and spin up, whining higher, as it rises rocked back', counter: 'guard it (a perfect parry dazes it); or evade' },
      ],
      recover: 1.4, cool: [1.6, 2.6], hit: 0.35,
    }),
    note: 'A ring drone: guard its harpoon to cut the line. Pull it down, then cut.',
  },
  brute: {
    name: 'furnace brute', family: 'machine', plan: 'brute', planNo: 8, role: 'heavy', tier: 3, ranged: false,
    status: 'built', kind: 'brute', was: ['glass golem', 'makers’ machine (its slam and quake)'], sound: 'iron', drop: 8, art: { main: 'perdide2', alt: 'glassdunes' },
    possession: 'ink in the cracks: the hull cracked like a dropped jar, the dark seeping from every seam',
    moves: ['slam', 'hurl', 'sweep'], answers: ['riposte (×2 on the stunned)', 'bombs ×2 crack the hull', 'charged cut through its raised forearms', 'jump the quake'],
    idle: 'stands where it stopped working, rusted mid-task; wakes with a groan when you come close',
    def: S({
      name: 'furnace brute', hp: 8, hook: 'heavy', radius: 1.15, height: 2.4, speed: 1.7, sight: 18, giveUp: 32, reach: 12, heavy: true, stout: true, breaks: true,
      tone: '#a77bff', sound: 'machine', takes: { shoot: 0, fire: 0 }, weak: { bomb: 2 },
      calm: { mode: 'stand', provoke: 7 },
      // its guard (issue #661, src/foe-guard.js): between its blows its forearms come up crossed before it, the cracks
      // going dark behind them; light cuts from the front ring off. The charged cut (or a bomb) smashes them apart, and it
      // reels open; or get round its side. Three cuts into the guard and it swings out of it into its backhand.
      guard: { pose: 'arms', arc: 1.05, near: 4.5, hold: 3, rest: 1.8, blocks: 3, counter: 'sweep', breaks: ['charged', 'riposte', 'bomb'], open: 1.2,
        hint: 'Its forearms are up: light cuts ring off. A charged cut smashes through, or get round its side.' },
      attacks: [
        // both fists high over the top of its body, the torso arching back, the veins blazing; down, and a quake runs out
        { id: 'slam', name: 'slam', shape: 'ring', radius: 2.1, ahead: 1.9, damage: 1, knock: 6, wind: 1.3, strike: 0.32, contact: 0.6, wave: { speed: 7, reach: 8, damage: 0.5, width: 0.55 }, max: 3.6, weight: 2, onParry: 'chip',
          tell: 'both fists rise high over the top of its body, the torso arching back and the cracks blazing violet', counter: 'evade to the side and jump the quake; a perfect parry chips it (a crack bursts)' },
        // it bends over and tears a slab out of the ground, straightens with it high over its shoulder, and throws it
        { id: 'hurl', name: 'hurl', shape: 'ring', at: 'target', instant: true, lob: true, radius: 1.7, damage: 0.75, wind: 1.5, track: 0.5, min: 4.5, max: 12, weight: 1.5,
          tell: 'it bends over and tears a slab out of the ground, then straightens with it held high over its shoulder', counter: 'walk out of the mark where it will land' },
        // one arm swung back behind it, the shoulder turning; then a backhand across its front
        { id: 'sweep', name: 'sweep', shape: 'cone', range: 3.6, angle: 1.3, damage: 0.75, knock: 5, wind: 1.05, strike: 0.3, contact: 0.5, max: 3.4, weight: 1.2, dodge: 'back',
          tell: 'one arm swings back behind it, its shoulder turning away', counter: 'back flip out of it, duck under it with an evade, or guard' },
      ],
      recover: 1.6, cool: [1.6, 2.6], hit: 0.55,
    }),
    note: 'A furnace brute: fists up? Get to its side and jump the quake.',
  },
  // the wood cutter (issue #800, the author 2026-10-30: a new enemy beside the furnace brute, not its replacement): the
  // approved reference's compact sage robot, 2.4 m (the author's 2.2–2.6 m; the brute 4.7), a barrel of a torso with an
  // ochre vent, a pale dome head with one visor slit, great sloping pauldrons, a toothed rust saw disc on its right wrist
  // (each world its own tool) and an open clamp of a hand. On the brute's rig family and its kit of moves: the brute's
  // windows, damage, hp and guard, its reach scaled to its height (src/enemies/plans/woodcutter.js woodcutterDef: the
  // slam's ring 2.1 → 1.45 m, the sweep 3.6 → 2.5 m, the slab's mark 1.7 → 1.4 m, the guard from 3.2 m). Its body is
  // Tripo's (src/enemies/plans/woodcutter-tripo.js, public/enemies/woodcutter/).
  woodcutter: {
    name: 'wood cutter', family: 'machine', plan: 'woodcutter', planNo: 32, role: 'close heavy', tier: 3, ranged: false,
    status: 'built', kind: 'woodcutter', was: [], sound: 'iron', drop: 8, art: { reference: 'references/enemy-redesign-2026-10-30/keep-brute/a1860f49-ecc5-4922-91f6-94b031e5e9a7-0.png', skin: 'perdide2' },
    possession: 'ink in its seams: the dark seeping from every joint of the barrel and out of its visor',
    moves: ['slam (saw and clamp)', 'hurl', 'sweep (the saw)'], answers: ['riposte (×2 on the stunned)', 'bombs ×2 crack the hull', 'charged cut through its raised forearms', 'jump the quake', 'get round its side: its reach is short'],
    idle: 'stands where it stopped working, rusted mid-cut, its saw still; wakes with a groan when you come close',
    def: S({
      name: 'wood cutter', hp: 8, hook: 'heavy', radius: 0.7, height: 1.45, speed: 1.7, sight: 18, giveUp: 32, reach: 12, heavy: true, stout: true, breaks: true,
      tone: '#c8922f', sound: 'machine', takes: { shoot: 0, fire: 0 }, weak: { bomb: 2 },
      calm: { mode: 'stand', provoke: 7 },
      // its guard (the brute's): forearms crossed before its visor between its blows; nearer, as its arms are shorter
      guard: { pose: 'arms', arc: 1.05, near: 3.2, hold: 3, rest: 1.8, blocks: 3, counter: 'sweep', breaks: ['charged', 'riposte', 'bomb'], open: 1.2,
        hint: 'Its forearms are up: light cuts ring off. A charged cut smashes through, or get round its side.' },
      attacks: [
        // both arms straight up over its head, the saw whining up and the vent glowing; then a deep bend onto its knees,
        // the saw's teeth and the clamp biting the ground before it, and a quake runs out
        // (land: its saw's teeth and clamp meet the ground at 0.52 of the strike, measured: the slam's weight sounds then)
        { id: 'slam', name: 'slam', shape: 'ring', radius: 1.45, ahead: 1.5, damage: 1, knock: 6, wind: 1.3, strike: 0.32, contact: 0.6, land: 0.52, wave: { speed: 7, reach: 8, damage: 0.5, width: 0.55 }, max: 2.7, weight: 2, onParry: 'chip',
          tell: 'both arms rise straight up over its head, the saw whining up and the vent glowing', counter: 'evade to the side and jump the quake; a perfect parry chips it' },
        // it bends over and tears a slab out of the ground in its clamp, straightens with it high over its shoulder, throws it
        { id: 'hurl', name: 'hurl', shape: 'ring', at: 'target', instant: true, lob: true, radius: 1.4, damage: 0.75, wind: 1.5, track: 0.5, min: 4.5, max: 12, weight: 1.5,
          tell: 'it bends over and tears a slab out of the ground with its clamp, then holds it high over its shoulder', counter: 'walk out of the mark where it will land' },
        // the saw arm swung back behind it, the shoulder turning; then a backhand across its front at chest height
        { id: 'sweep', name: 'sweep', shape: 'cone', range: 2.5, angle: 1.3, damage: 0.75, knock: 5, wind: 1.05, strike: 0.3, contact: 0.5, max: 2.4, weight: 1.2, dodge: 'back',
          tell: 'its saw arm swings back behind it, the shoulder turning away', counter: 'back flip out of it, duck under it with an evade, or guard' },
      ],
      recover: 1.6, cool: [1.6, 2.6], hit: 0.55,
    }),
    note: 'A wood cutter: saw up? Get to its side and jump the quake.',
  },
  // the makers' fencer (issue #665; docs/design/combat-botw-study.md, ranked changes 5-8): a sword-and-shield duelist that
  // fights the way you do. Its shield guards your light combo from the front; hide behind your own and it bashes it aside;
  // its overhead asks for the side hop, its sweep for the back flip; a perfect parry of its sword knocks the sword away and
  // it fights shield-only while it runs to pick it up; its leap slam hangs a second in the air. No design sheet was
  // picked: built from the roster's parts in the makers' high tech (src/enemies/plans/fencer.js).
  fencer: {
    name: 'makers’ fencer', family: 'machine', plan: 'fencer', planNo: 9, role: 'mirror', tier: 3, ranged: false,
    status: 'built', kind: 'fencer', was: [], sound: 'steel', drop: 8, art: 'pending',
    possession: 'a duelling machine of the makers’, still keeping the drill it was built for: guard, cut, bash, leap',
    moves: ['overhead and sweep', 'shield bash', 'leap slam'],
    answers: ['the charged cut through its shield', 'the dash cut to its back', 'a perfect parry knocks its sword away', 'side hop the overhead, back flip the sweep'],
    idle: 'stands at its post, sword grounded, shield on its arm; it salutes and comes on when you come near',
    def: S({
      name: 'makers’ fencer', hp: 8, hook: 'heavy', radius: 0.5, height: 1.45, speed: 3.1, sight: 18, giveUp: 34, reach: 7, metal: true, breaks: true, clamber: true, stout: true,
      tone: '#e0a03a', sound: 'machine', takes: { shoot: 1, fire: 0.5 },
      calm: { mode: 'stand', provoke: 9 },
      // its shield (src/foe-guard.js): up between its blows, square before it; your light combo, your air swings and your
      // shots ring off it from the front. The charged cut throws it wide (a bomb too); behind it, it is open
      guard: { pose: 'shield', arc: 1.15, near: 4, close: 2.2, hold: 2.6, rest: 1.6, blocks: 3, counter: 'bash', breaks: ['charged', 'riposte', 'bomb'], open: 1.0, shots: true,
        hint: 'Its shield turns your combo. A charged cut throws it wide, or get behind it.' },
      // hide behind your own guard in its reach and it bashes it aside (Foes.strike `guardBreak`)
      turtle: { after: 0.9, attack: 'bash', reach: 3.4 },
      // a perfect parry of its sword: the sword lands `dist` m off after `fly` s; it bends `pickup` s to take it back
      disarm: { dist: 3.8, fly: 0.6, pickup: 1.4 },
      attacks: [
        // the sword raised high over its head in its fist, the shield lowered; then down through it: the side hop
        { id: 'overhead', name: 'overhead', armed: true, shape: 'lane', width: 1.3, range: 3.3, damage: 0.75, wind: 1.0, strike: 0.22, contact: 0.55, lunge: 0.8, max: 3.0, weight: 2, dodge: 'side', onParry: 'disarm',
          tell: 'its sword rises high over its head, the shield lowered', counter: 'side hop; a perfect parry knocks the sword out of its hand' },
        // wound round to its right, the sword low behind its hip; then a wide sweep at your knees: the back flip
        { id: 'sweep', name: 'sweep', armed: true, shape: 'cone', range: 3.1, angle: 1.4, damage: 0.75, wind: 0.95, strike: 0.26, contact: 0.5, max: 2.9, weight: 2, dodge: 'back', onParry: 'disarm',
          tell: 'it winds round to its right, the sword low behind its hip', counter: 'back flip; a perfect parry knocks the sword out of its hand' },
        // crouched deep behind its shield; then it leaps high, hangs over you and comes down where you stood
        { id: 'leap', name: 'leap slam', armed: true, shielded: true, shape: 'ring', radius: 1.8, damage: 1, knock: 6, wind: 0.95, strike: 1.15, contact: 0.95, leap: { height: 2.6 }, range: 7, track: 0.6, min: 3.5, max: 7, weight: 1.3, dodge: 'side',
          tell: 'it crouches deep behind its shield, then leaps high and hangs over you', counter: 'side hop as it comes down; a perfect parry throws it down; an air cut meets it in the air' },
        // its answer to a guard held at it, and to blows spammed at its own: the shield's shoulder drawn back, then a bash
        { id: 'bash', name: 'shield bash', chain: true, answer: true, guardBreak: true, shielded: true, shape: 'cone', range: 2.5, angle: 0.9, damage: 0.5, knock: 5, wind: 0.75, strike: 0.2, contact: 0.5, lunge: 1.2,
          tell: 'it draws its shield back to its shoulder', counter: 'a perfect parry, or hop away: a plain guard is knocked aside' },
        // without its sword: the shield alone, shoved at you
        { id: 'shove', name: 'shield shove', unarmed: true, shielded: true, shape: 'cone', range: 2.4, angle: 1.0, damage: 0.5, knock: 4, wind: 0.95, strike: 0.2, contact: 0.5, lunge: 1.0, max: 2.4, weight: 1,
          tell: 'without its sword, it draws its shield back to its shoulder', counter: 'guard it, hop it, or cut it from behind' },
      ],
      recover: 0.85, cool: [1.2, 2.0], hit: 0.45,
    }),
    note: 'A makers’ fencer: a charged cut breaks its shield. Parry its sword away.',
  },
  // ----------------------------------------------------------------------------- spirits (the dark itself)
  blot: {
    name: 'ink blot', family: 'spirit', plan: 'blob', planNo: 20, role: 'rusher', tier: 1, ranged: true,
    status: 'built', kind: 'blot', was: ['ink blot', 'spitting blot (its spit)'], sound: 'ink', drop: 2, art: { main: 'desert', alt: 'garage' },
    manifestation: 'loose ink: no body borrowed; it splashes and pools',
    moves: ['lunge', 'lunge combo', 'spit'], answers: ['a cut breaks its coil (it teaches the combo)', 'the guard ends its combo', 'a shot washes it'],
    idle: 'pools in shade and under arches, a stain until you come near; then the stain stands up',
    def: {
      name: 'ink blot', hp: 2, hook: 'light', radius: 0.6, height: 0.55, speed: 3.4, sight: 17, giveUp: 40, reach: 2.1, flinchy: true, clamber: true,
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
    status: 'built', kind: 'shade', was: ['shade'], sound: 'cloth', drop: 8, art: { main: 'perdide2', alt: 'eclipse' },
    manifestation: 'a cloak of smoke worn by nothing; the sword is poured ink',
    moves: ['cut', 'feint and thrust', 'step through the shade'], answers: ['parry and riposte', 'ember (lit, it is solid: no step, and it burns)', 'an evade sideways from the thrust'],
    idle: 'walks a path it walked in life and stops at doorways',
    def: S({
      name: 'shade', hp: 5, hook: 'light', radius: 0.45, height: 1.3, speed: 3.0, sight: 18, giveUp: 40, reach: 7, clamber: true, lights: true,
      tone: '#3b2a5c', takes: { shoot: 1, fire: 2 },
      calm: { mode: 'pace', provoke: 5, round: 5, wait: 2.5 },
      // its guard (issue #661, src/foe-guard.js): between its blows it holds the ink sword up across its body and turns your
      // cuts from the front with it; two in a row and it answers with its cut at once: parry that, and riposte. Round its
      // side (the dash cut) it is open.
      guard: { pose: 'sword', arc: 1.0, near: 3.6, hold: 2.5, rest: 1.8, blocks: 2, counter: 'cut', breaks: ['riposte'], open: 0.9,
        hint: 'Its sword turns your cuts. Parry the cut it answers with, then riposte; or cut it from the side.' },
      attacks: [
        // the sword drawn back over its shoulder, the body turning away, the hood turning to keep you in sight; the cut across
        { id: 'cut', name: 'cut', shape: 'cone', range: 2.9, angle: 0.9, damage: 0.75, wind: 0.95, strike: 0.24, contact: 0.55, max: 2.8, weight: 2, dodge: 'back',
          tell: 'the sword drawn back over its shoulder, its hood turning to keep you in sight', counter: 'parry, then riposte' },
        // it starts the cut and stops halfway, the hood tilting; the sword drops to its hip; then the thrust, low and straight
        { id: 'feint', name: 'feint and thrust', shape: 'lane', width: 1.0, range: 3.6, damage: 0.75, wind: 1.3, strike: 0.22, contact: 0.5, lunge: 1.4, feint: 0.45, min: 1.2, max: 3.4, weight: 1.5, dodge: 'side',
          tell: 'it starts the cut and stops halfway, its hood tilting; the sword drops to its hip and it sinks', counter: 'evade sideways; or a parry timed on the thrust (not on the cut it never makes)' },
        // it sinks into its own shadow, the pool slides round beside you, it pours up out of it there and cuts; lit, it can't
        { id: 'step', name: 'step through the shade', shape: 'ring', at: 'beside', instant: true, radius: 1.3, track: 0.6, damage: 0, blink: true, dark: true, wind: 1.0, then: 'recut', min: 3.5, max: 7, weight: 1.2,
          tell: 'its cloak collapses into a pool of shadow, and the pool slides round beside you', counter: 'turn and guard; an ember lights it solid and it can’t step at all' },
        { id: 'recut', chain: true, shape: 'cone', range: 2.6, angle: 0.9, damage: 0.5, wind: 0.55, strike: 0.22, contact: 0.5 },
      ],
      recover: 1.1, cool: [1.2, 2.2], hit: 0.4,
    }),
    note: 'A shade: parry and riposte; when its sword drops to the hip, step aside.',
  },
  hound: {
    name: 'horned hound', family: 'spirit', plan: 'quadruped', planNo: 6, role: 'stalker', tier: 4, ranged: false,
    status: 'built', kind: 'hound', was: ['shadow hound', 'antler hound'], sound: 'smoke', drop: 4, art: { main: 'spheres', alt: 'mangrove' },
    manifestation: 'a shadow cast by nothing: it runs as a flat shadow and rises out of it into a body',
    moves: ['pounce', 'step behind', 'horn rake'], answers: ['ember (solid, and it burns: 2)', 'the lantern', 'parry'],
    idle: 'shadows lie under trees and arches where there shouldn’t be any; one stands up and watches you go; not every one hunts',
    def: S({
      name: 'horned hound', hp: 3, hook: 'light', radius: 0.55, height: 1.15, speed: 5.6, sight: 22, giveUp: 45, reach: 7, phase: true, group: 2, clamber: true,
      tone: '#6c4fa0', takes: { shoot: 0, fire: 2 },
      calm: { mode: 'lie', provoke: 11, hunts: 0.7, alarm: 12 },
      attacks: [
        // (wind 0.8 until v1.63: its most frequent blow, read a beat late, combat-v1.61 #260. Now a crouch, then the coil:
        // the rump up, the smoke of its mane on end, a shiver and a snarl, held to 1.0 s; and picked less often. Since #800
        // the broad-pawed body: its tail stiff for the mane)
        { id: 'pounce', name: 'pounce', shape: 'ring', radius: 1.6, ahead: 1.6, damage: 0.5, wind: 1.0, strike: 0.28, contact: 0.55, lunge: 3.2, max: 3.4, weight: 1.0, cue: 'coil',
          tell: 'it crouches, the horns dipping forward and the shoulders bunching; then it coils, rump up, its tail stiff, shivering, and snarls', counter: 'evade as it snarls, or parry and riposte' },
        { id: 'step', name: 'step behind', shape: 'ring', at: 'behind', instant: true, radius: 1.3, track: 0.5, damage: 0, blink: true, wind: 0.9, then: 'bite', min: 2.5, max: 7,
          tell: 'it sinks into its shadow, which slides round you; a growl behind you', counter: 'turn and guard; ember makes it solid at once' },
        { id: 'bite', chain: true, shape: 'cone', range: 2.3, angle: 0.8, damage: 0.5, wind: 0.55, strike: 0.2, contact: 0.5 },
        { id: 'rake', name: 'horn rake', shape: 'cone', range: 2.9, angle: 1.15, damage: 0.75, wind: 1.0, strike: 0.3, contact: 0.5, max: 2.8, below: 0.67, weight: 2,
          tell: 'its head low and to one side, the horns lowered like a plough', counter: 'step back out of the sweep, or guard' },
      ],
      recover: 1.2, cool: [1.1, 2.0],
    }),
    note: 'Horned hounds: only shadows far off. Cut as they rise, or use an ember.',
  },
  marionette: {
    name: 'marionette', family: 'spirit', plan: 'strings', planNo: 21, role: 'puppeteer', tier: 4, ranged: true,
    status: 'built', kind: 'marionette', was: [], sound: 'strings', drop: 8, art: { main: 'spheres', alt: 'bazaar' },
    manifestation: 'the puppeteer: strings rise into a knot of smoke and drop onto other things',
    moves: ['strings', 'yank', 'dance'], answers: ['cut the strings it drops (the air cut, the boomerang, an ember): the creature goes free', 'air cut, wings or jets to its body', 'evade the yank; a guard cuts its line'],
    idle: 'hangs still under bridges, cranes and arches, swaying like a coat on a hook',
    def: S({
      name: 'marionette', hp: 4, hook: 'flyer', radius: 0.5, height: 1.4, hover: 1.1, speed: 2.4, sight: 20, giveUp: 40, reach: 12, keep: 5, puppeteer: true,
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
    note: 'A marionette: cut its strings to free the creature. Jump for its body.',
  },
  // ----------------------------------------------------------------------------- batch 6 (issue #398)
  // The ember wisp (docs/design/fireball-foe.md): the dark's poor copy of the singing light, a cold shell round a borrowed
  // coal, floating out of reach; it throws its fire at you, and a cut timed as the ball arrives sends it back (src/fireballs.js).
  // Its body is its picked sheet-1 (issue #440): a bud of four ink petals round the coal, a ring of light, three drips.
  wisp: {
    name: 'ember wisp', family: 'spirit', plan: 'ember', planNo: 22, role: 'bombardier', tier: 2, ranged: true,
    status: 'built', kind: 'wisp', was: [], sound: 'ember', drop: 4, art: 'sheet-1',
    manifestation: 'a borrowed fire: petals of hardened ink folded round a stolen coal, a false flower of light mimicking the singing light',
    moves: ['fireball', 'flare'], answers: ['a cut timed as the fireball arrives sends it back (stunned, it drops: cut it)', 'a perfect parry sends it back too', 'the hook pulls it down', 'a shot douses a fireball'],
    idle: 'drifts over warm places, a lamp where no lamp should be; it turns to watch you go by',
    def: S({
      // (hover 4.2 m: out of the blade's reach; keep 7: it backs off when you close in. hp 4: three returns, or one and its cuts)
      name: 'ember wisp', hp: 4, hook: 'flyer', radius: 0.6, height: 0.5, hover: 4.2, speed: 2.6, sight: 22, giveUp: 40, reach: 14, keep: 7,
      tone: '#ff8a3e', takes: { shoot: 0, fire: 0 },
      calm: { mode: 'drift', provoke: 15 },
      attacks: [
        // the petals part, the coal swells and brightens (a crackling hum rising) and it rears back; then the ball
        // flies at you, slow, homing gently: Foes.throwBall (src/fireballs.js FIREBALL)
        { id: 'fireball', name: 'fireball', shape: 'ring', at: 'self', radius: 0.5, damage: 0, wind: 1.05, instant: true, ball: true, cue: 'kindle', min: 3.5, max: 14, weight: 3, recover: 1.0,
          tell: 'its four petals open like a flower, the coal inside swelling white-hot, and it rears back with a rising crackle', counter: 'cut the ball as it reaches you: it flies back and stuns the wisp; a perfect parry does too; or step aside at the last moment' },
        // under it: the petals clench shut and glow through their seams; then a burst of heat round it
        { id: 'flare', name: 'flare', shape: 'ring', at: 'self', radius: 3.2, damage: 0.5, knock: 4, wind: 1.0, strike: 0.25, contact: 0.4, max: 3.2, weight: 2,
          tell: 'its petals clench shut and the seams glow red', counter: 'step out from under it' },
      ],
      recover: 1.2, cool: [1.6, 2.6], hit: 0.4,
    }),
    note: 'An ember wisp: cut its fireball as it reaches you, and it flies back.',
  },
  // ----------------------------------------------------------------------------- the humanoid foes on clips (issue #724)
  // The camp tribe of docs/design/enemy-roster-v2.md, on the humanoid rig (src/enemies/humanoid-rig.js: the traveller's
  // clips retargeted onto their own proportions; docs/design/enemy-roster-v3.md). Bodies: src/enemies/plans/mummer.js.
  //   weapons     what it may carry, by weight (a mummer: one each, picked as it comes: Foe.weapon); attack.weapon: only
  //               with that one in hand; attack.armed / attack.unarmed as the fencer's (its weapon knocked away)
  //   attack.guardDisarms   a plain guard knocks the weapon out of its hand too, not only a perfect parry (the club)
  //   mask        { below, hits } its mask is knocked off (f.unmasked): under `below` of its health, by a headshot (`hits`
  //               of them: the stronger tier's metal mask takes two), a charged cut or a riposte: it drops what it holds,
  //               clutches its face and runs, then fights blind (its blows go wide)
  //   attack.horn  m round it that its call wakes (Foes.alarm), once when it first comes on and once more at half health
  //   attack.throwsAlly   the kind it picks up near it (within 5 m: def.throws, the kind it looks for) and hurls at the
  //               mark (a lob): the thrown one lands dazed (src/foes.js CARRY, Foes.carryUpdate, Foes.landThrown)
  mummer: {
    name: 'mummer', family: 'spirit', plan: 'mummer', planNo: 23, role: 'camp rank and file', tier: 1, ranged: true,
    status: 'built', kind: 'mummer', was: [], sound: 'junk', drop: 2, art: { main: 'desert', alt: 'glassdunes' },
    manifestation: 'dressed-up ink: a sack of rags stuffed with ink and a found pot for a face, playing at keeping camp',
    moves: ['its weapon’s blow (a club’s overhead whack, a spear’s jab, a bow’s volley)', 'rock (with nothing in its hands)'],
    answers: ['knock the mask off (a headshot, a charged cut, a riposte)', 'guard the club: it flies out of its hands', 'shoot the archer', 'reach the lookout before its horn'],
    idle: 'squats round a fire it does not need, rocking; one dozes on its back; a lookout keeps watch and calls the camp',
    def: S({
      name: 'mummer', hp: 2, hook: 'light', radius: 0.42, height: 1.1, speed: 3.4, sight: 17, giveUp: 34, reach: 16, clamber: true,
      tone: '#c9973f', takes: { shoot: 1, fire: 1.5 },
      calm: { mode: 'sit', provoke: 7, alarm: 14 },
      weapons: { club: 3, spear: 2, bow: 1.5 },
      mask: { below: 0.5, hits: 1 },
      // its weapon knocked away (a parried or guarded blow): it lands `dist` m off; it runs for it and bends to pick it up
      disarm: { dist: 2.8, fly: 0.5, pickup: 1.1 },
      attacks: [
        // both arms high, the club behind its mask, leaning back on its heels so its belly sticks out; a hop forward as it swings
        { id: 'whack', name: 'overhead whack', weapon: 'club', armed: true, shape: 'cone', range: 2.1, angle: 0.75, damage: 0.5, wind: 0.75, strike: 0.3, contact: 0.55, lunge: 1.3, max: 2.2, weight: 2.5, dodge: 'side', onParry: 'disarm', guardDisarms: true,
          tell: 'both arms go up, the club behind its mask; it leans back on its heels, belly out', counter: 'guard it and the club flies out of its hands; or step aside' },
        // it plants its feet, draws the pole back under its arm, the pot tipped down along it; then the jab
        { id: 'jab', name: 'spear jab', weapon: 'spear', armed: true, shape: 'lane', width: 0.8, range: 2.5, damage: 0.5, wind: 0.7, strike: 0.2, contact: 0.5, lunge: 0.6, max: 2.6, weight: 2.5, dodge: 'side', onParry: 'disarm',
          tell: 'it plants its feet and draws the pole back under its arm, the pot tipped down along it', counter: 'parry it (the pole flies), or step inside its reach' },
        // the bow held sideways, leaning back with the cord at its mask; a sharpened stick flies straight (no mark)
        { id: 'volley', name: 'volley', weapon: 'bow', armed: true, shape: 'lane', width: 0.7, range: 16, damage: 0.5, wind: 0.95, strike: 0.2, contact: 0.6, track: 0.6, min: 5, max: 16, weight: 3, onParry: 'cut',
          tell: 'it holds the bow sideways and leans back, the cord drawn to its mask', counter: 'guard the stick, shoot the archer, or close in' },
        // with nothing in its hands: it squats, digs both hands in, lifts a rock over its mask; a lob, its mark shown
        { id: 'rock', name: 'rock', unarmed: true, shape: 'ring', at: 'target', instant: true, lob: true, radius: 1.3, damage: 0.5, wind: 0.85, min: 3, max: 14, weight: 2,
          tell: 'it squats, digs both hands into the ground and lifts a rock over its mask', counter: 'walk out of the mark, or cut the rock back' },
      ],
      recover: 1.0, cool: [1.3, 2.4], hit: 0.35,
    }),
    note: 'Mummers: knock the mask off and they run. Guard a club and it flies.',
  },
  // the dune mummer (issue #800, the author 2026-10-30: "I also liked the old mummer with the helmet, we should also keep
  // both"): a new foe beside the mummer, not its replacement, drawn to the rebuild's approved image (a sage gourd that is
  // head and body at once, a cream oval mask with two black slits, big rust gauntlets and boots). The mummer's kit of moves,
  // windows, mask, weapons and disarm, copied (changing one leaves the other); its own sound (a hollow gourd's knock) and
  // plan (its own steps). Its body is Tripo's (src/enemies/plans/dune-mummer-tripo.js, public/enemies/dunemummer/).
  dunemummer: {
    name: 'gourd mummer', family: 'spirit', plan: 'dunemummer', planNo: 33, role: 'camp skirmisher', tier: 1, ranged: true,
    status: 'built', kind: 'dunemummer', was: [], sound: 'gourd', drop: 2, art: { reference: 'references/enemy-redesign-2026-10-30/keep-mummer/ad94a6b0-55ba-461e-9577-d745036565ae-1.png', skin: 'desert' },
    manifestation: 'dressed-up ink: a hollow sage gourd stuffed with ink, a cream mask with two slits for a face, playing at keeping camp',
    moves: ['its weapon’s blow (a club’s overhead whack, a spear’s jab, a bow’s volley)', 'rock (with nothing in its hands)'],
    answers: ['knock the mask off (a headshot, a charged cut, a riposte)', 'guard the club: it flies out of its hands', 'shoot the archer', 'reach the lookout before its horn'],
    idle: 'squats round a fire it does not need, rocking; keeps a stash or a lookout post for the camp',
    def: S({
      name: 'gourd mummer', hp: 2, hook: 'light', radius: 0.42, height: 1.1, speed: 3.4, sight: 17, giveUp: 34, reach: 16, clamber: true,
      tone: '#c9973f', takes: { shoot: 1, fire: 1.5 },
      calm: { mode: 'sit', provoke: 7, alarm: 14 },
      weapons: { club: 3, spear: 2, bow: 1.5 },
      mask: { below: 0.5, hits: 1 },
      // its weapon knocked away (a parried or guarded blow): it lands `dist` m off; it runs for it and bends to pick it up
      disarm: { dist: 2.8, fly: 0.5, pickup: 1.1 },
      attacks: [
        // both arms high, the club behind its mask, leaning back on its heels so its belly sticks out; a hop forward as it swings
        { id: 'whack', name: 'overhead whack', weapon: 'club', armed: true, shape: 'cone', range: 2.1, angle: 0.75, damage: 0.5, wind: 0.75, strike: 0.3, contact: 0.55, lunge: 1.3, max: 2.2, weight: 2.5, dodge: 'side', onParry: 'disarm', guardDisarms: true,
          tell: 'both arms go up, the club behind its mask; it leans back on its heels, belly out', counter: 'guard it and the club flies out of its hands; or step aside' },
        // it plants its feet, draws the pole back under its arm, the pot tipped down along it; then the jab
        { id: 'jab', name: 'spear jab', weapon: 'spear', armed: true, shape: 'lane', width: 0.8, range: 2.5, damage: 0.5, wind: 0.7, strike: 0.2, contact: 0.5, lunge: 0.6, max: 2.6, weight: 2.5, dodge: 'side', onParry: 'disarm',
          tell: 'it plants its feet and draws the pole back under its arm, the pot tipped down along it', counter: 'parry it (the pole flies), or step inside its reach' },
        // the bow held sideways, leaning back with the cord at its mask; a sharpened stick flies straight (no mark)
        { id: 'volley', name: 'volley', weapon: 'bow', armed: true, shape: 'lane', width: 0.7, range: 16, damage: 0.5, wind: 0.95, strike: 0.2, contact: 0.6, track: 0.6, min: 5, max: 16, weight: 3, onParry: 'cut',
          tell: 'it holds the bow sideways and leans back, the cord drawn to its mask', counter: 'guard the stick, shoot the archer, or close in' },
        // with nothing in its hands: it squats, digs both hands in, lifts a rock over its mask; a lob, its mark shown
        { id: 'rock', name: 'rock', unarmed: true, shape: 'ring', at: 'target', instant: true, lob: true, radius: 1.3, damage: 0.5, wind: 0.85, min: 3, max: 14, weight: 2,
          tell: 'it squats, digs both hands into the ground and lifts a rock over its mask', counter: 'walk out of the mark, or cut the rock back' },
      ],
      recover: 1.0, cool: [1.3, 2.4], hit: 0.35,
    }),
    note: 'Gourd mummers: knock off the mask and they run. Guard the club.',
  },
  mummerking: {
    name: 'mummer king', family: 'spirit', plan: 'mummerking', planNo: 24, role: 'camp chief', tier: 3, ranged: true,
    status: 'built', kind: 'mummerking', was: [], sound: 'junk', drop: 8, art: 'sheet-1',
    manifestation: 'the troupe’s big role: two or three mummers’ worth of junk in one body, the one who wears the crown in the play',
    moves: ['door-beam smash and royal swing', 'horn call', 'throw a mummer'],
    answers: ['cut down the troupe before it can throw them', 'roll through the royal swing', 'side hop the smash and cut its back', 'get out from under a thrown mummer'],
    idle: 'sits by the fire with the beam across its knees while its troupe keeps camp',
    def: S({
      name: 'mummer king', hp: 7, hook: 'heavy', radius: 0.95, height: 2.6, speed: 2.7, sight: 18, giveUp: 34, reach: 12, heavy: true, stout: true, throws: 'mummer',
      tone: '#7fae9a', takes: { shoot: 1, fire: 1.5 },
      calm: { mode: 'sit', provoke: 9, alarm: 25 },
      attacks: [
        // the beam hoisted high over its crown in both fists, leaning back; then down through it
        { id: 'smash', name: 'door-beam smash', shape: 'lane', width: 1.4, range: 3.8, damage: 1, wind: 1.1, strike: 0.3, contact: 0.55, knock: 5, lunge: 0.6, max: 3.6, weight: 2.5, dodge: 'side',
          tell: 'it hoists the door beam high over its crown in both fists and leans back', counter: 'side hop, then cut its back' },
        // the beam over its shoulder, its whole barrel twisted away from you; a wide sweep
        { id: 'swing', name: 'royal swing', shape: 'cone', range: 4, angle: 1.35, damage: 0.75, wind: 1.1, strike: 0.35, contact: 0.5, knock: 4, max: 3.9, weight: 2, dodge: 'back',
          tell: 'it hoists the beam over its shoulder and twists its whole barrel away from you', counter: 'roll through it, or the air cut over it' },
        // the long horn brought round to its cauldron: every mummer within 25 m wakes and comes
        { id: 'horn', name: 'horn call', shape: 'ring', at: 'self', radius: 0.6, damage: 0, wind: 1.2, instant: true, horn: 25, max: 12, weight: 4, recover: 0.8,
          tell: 'it brings the long brass horn round to its cauldron', counter: 'cut it before it blows, or ready for the troupe' },
        // it scoops up the nearest small mummer and holds it high over its crown, kicking; then hurls it at the mark
        { id: 'throw', name: 'throw a mummer', shape: 'ring', at: 'target', instant: true, lob: true, radius: 1.6, damage: 0.5, knock: 3, wind: 1.0, min: 3.5, max: 12, weight: 3, throwsAlly: 'mummer',
          tell: 'it bends, scoops up a mummer and holds it high over its crown, kicking', counter: 'get out from under the mark; the thrown one lands dazed' },
      ],
      recover: 1.3, cool: [1.4, 2.4], hit: 0.5,
    }),
    note: 'The mummer king: cut down its troupe, or it throws them at you.',
  },
  // ----------------------------------------------------------------------------- roster v4's monsters (issue #726)
  // docs/design/enemy-roster-v4.md: one roster met in every world, the colour its tier (a darker, banded skin: tierSkin).
  // On the humanoid rig like the mummers (src/enemies/plans/monster.js). Not on any world's roster yet: the Desert's
  // mummer camp stages them behind a site flag (src/encounters/sites.js STAGED.roster4); the Arena fields both.
  //   shrug        the first `n` light cuts of an exchange it takes on its belly: no harm, no poise worn (left alone
  //                POISE.after s, it shrugs again): the masher's first cut is never a kill (combat-v2.34 rec. 1)
  //   hangBack     m it keeps from you by what it holds (a bow, bare hands): the archers and rock throwers stay back
  //   whiffRecover s at most it recovers after a blow that missed (combat-v2.34 rec. 3)
  //   racks        an unarmed one takes a bow or a spear from a camp's rack near it (src/foes.js RACK)
  //   answerMash   { cuts, within, attack }: that many light cuts in a row, each within `within` s, and it answers at
  //                once with `attack` (the hulk's stomp: combat-v2.34 rec. 2)
  grunt: {
    name: 'grunt', family: 'monster', plan: 'monster', planNo: 25, role: 'rank and file', tier: 1, ranged: true,
    status: 'built', kind: 'grunt', was: [], sound: 'flesh', drop: 2, art: 'sheet-1',
    moves: ['club overhead and lunge', 'a bow’s volley or a spear’s jab from the camp’s rack', 'rock (with nothing in its hands)'],
    answers: ['parry the club: it flies out of its hands', 'cut it down before it reaches the rack', 'side hop the lunge and cut its back', 'shoot the archer'],
    idle: 'squats round the fire with its band, a club across its knees; one keeps a lookout',
    def: S({
      name: 'grunt', hp: 2, hook: 'light', radius: 0.45, height: 1.3, speed: 3.6, sight: 17, giveUp: 34, reach: 16, clamber: true,
      tone: '#d8503c', takes: { shoot: 1, fire: 1.5 },
      calm: { mode: 'sit', provoke: 8, alarm: 14 },
      weapons: { club: 3, none: 1.2 }, racks: true, shrug: 1, hangBack: { bow: 7, none: 6 }, whiffRecover: 0.45,
      disarm: { dist: 2.8, fly: 0.5, pickup: 1.0 },
      attacks: [
        // the club raised high over its head in both fists, leaning back on its heels, its belly out (the sheet's attack pose)
        { id: 'club', name: 'club overhead', weapon: 'club', armed: true, shape: 'cone', range: 2.1, angle: 0.75, damage: 0.5, wind: 0.8, strike: 0.3, contact: 0.55, lunge: 0.9, max: 2.2, weight: 2.5, dodge: 'side', onParry: 'disarm',
          tell: 'it heaves the club high over its head in both fists and leans back, belly out', counter: 'parry it and the club flies; or step aside' },
        // it drops low, the club cocked back by its hip, and springs at you across the gap
        { id: 'lunge', name: 'lunge', weapon: 'club', shape: 'cone', range: 1.7, angle: 0.9, damage: 0.5, wind: 0.85, strike: 0.35, contact: 0.5, lunge: 3.4, min: 2.4, max: 5.5, weight: 2, dodge: 'side',
          tell: 'it crouches low, the club cocked back by its hip', counter: 'side hop as it springs, then cut its back' },
        // the rack's spear: feet planted, the shaft drawn back under its arm
        { id: 'jab', name: 'spear jab', weapon: 'spear', armed: true, shape: 'lane', width: 0.8, range: 2.6, damage: 0.5, wind: 0.7, strike: 0.2, contact: 0.5, lunge: 0.6, max: 2.7, weight: 2.5, dodge: 'side', onParry: 'disarm',
          tell: 'it plants its feet and draws the spear back under its arm', counter: 'parry it (the spear flies), or step inside its reach' },
        // the rack's bow: side-on, the cord drawn to its ear; an arrow flies straight (no mark)
        { id: 'volley', name: 'volley', weapon: 'bow', armed: true, shape: 'lane', width: 0.7, range: 16, damage: 0.5, wind: 0.95, strike: 0.2, contact: 0.6, track: 0.6, min: 4, max: 16, weight: 3, onParry: 'cut',
          tell: 'it turns side-on and draws the cord back to its ear', counter: 'guard the arrow, shoot the archer, or close in' },
        // nothing in its hands: it digs a rock up and heaves it over its head; a lob, its mark shown
        { id: 'rock', name: 'rock', unarmed: true, shape: 'ring', at: 'target', instant: true, lob: true, radius: 1.3, damage: 0.5, wind: 0.85, min: 3, max: 14, weight: 2.5,
          tell: 'it squats, digs both hands into the ground and heaves a rock up over its head', counter: 'walk out of the mark, or cut the rock back' },
      ],
      recover: 0.7, cool: [0.6, 1.3], hit: 0.35,
    }),
    note: 'Grunts: they shrug the first cut. Parry the club and it flies.',
  },
  hulk: {
    name: 'hulk', family: 'monster', plan: 'monster', planNo: 26, role: 'the heavy', tier: 3, ranged: true,
    status: 'built', kind: 'hulk', was: [], sound: 'flesh', drop: 8, art: 'sheet-1',
    moves: ['spiked-club smash (overhead and sweep)', 'stomp', 'throw a grunt'],
    answers: ['side hop the smash and cut its back', 'roll through the sweep', 'jump the stomp', 'get out from under a thrown grunt'],
    idle: 'sits by the fire with its club across its knees while its band keeps camp',
    def: S({
      name: 'hulk', hp: 8, hook: 'heavy', radius: 1.0, height: 2.7, speed: 2.6, sight: 18, giveUp: 34, reach: 12, heavy: true, stout: true, throws: 'grunt',
      tone: '#7f8fb4', takes: { shoot: 1, fire: 1.5 },
      calm: { mode: 'sit', provoke: 9, alarm: 25 },
      answerMash: { cuts: 3, within: 1.2, attack: 'stomp' },
      attacks: [
        // the club raised high behind its horn in both fists, leaning back; then down through it
        { id: 'smash', name: 'club smash', shape: 'lane', width: 1.4, range: 4, damage: 1, wind: 1.15, strike: 0.3, contact: 0.55, knock: 5, lunge: 0.6, max: 3.8, weight: 2.5, dodge: 'side',
          tell: 'it heaves the club up behind its horn in both fists and leans back', counter: 'side hop, then cut its back' },
        // the club over its shoulder, its whole hunched back twisted away from you; a wide sweep
        { id: 'sweep', name: 'club sweep', shape: 'cone', range: 4.2, angle: 1.35, damage: 0.75, wind: 1.1, strike: 0.35, contact: 0.5, knock: 4, max: 4, weight: 2, dodge: 'back',
          tell: 'it hoists the club over its shoulder and twists its whole back away from you', counter: 'roll through it, or the air cut over it' },
        // one foot raised high, its long arms flung up; then down: the ground round it jumps (also its answer to a masher)
        { id: 'stomp', name: 'stomp', shape: 'ring', at: 'self', radius: 3, damage: 0.5, knock: 5, wind: 1.0, strike: 0.25, contact: 0.4, ground: true, max: 2.6, weight: 1.5,
          tell: 'it lifts one great foot high, its long arms flung up', counter: 'jump it, or step out of its reach' },
        // it scoops up the nearest grunt and holds it high over its horn, kicking; then hurls it at the mark
        { id: 'throw', name: 'throw a grunt', shape: 'ring', at: 'target', instant: true, lob: true, radius: 1.6, damage: 0.5, knock: 3, wind: 1.0, min: 3.5, max: 12, weight: 3, throwsAlly: 'grunt',
          tell: 'it bends, scoops up a grunt and holds it high over its horn, kicking', counter: 'get out from under the mark; the thrown one lands dazed' },
      ],
      recover: 1.2, cool: [1.3, 2.3], hit: 0.5,
    }),
    note: 'The hulk: cut it three times running and it stomps. Jump it.',
  },
  // ----------------------------------------------------------------------------- the makers' defunct droids (issue #726)
  // docs/design/enemy-roster-v4.md: one family met in every world (the world rosters come in a later batch: until then the
  // Arena alone, `v4`), drawn to their picked sheets in one material (src/enemies/plans/droid.js).
  //   guard.stings      light cuts landing in a row (each within STING.gap s of the last) that snap its guard up at once
  //                     (the sentinel's answer to a masher: two cuts, then the shield; the third is parried)
  //   attack.wakes      only offered with a sleeping foe (one not yet provoked) within its `horn` reach to wake
  //   attack.seek       m/s it walks at you through the wind-up (the crawler's fuse: it scuttles after you)
  //   attack.selfDestruct  it is gone at the strike's end: the blast is its last act (Foe.shatter, Foes.shatter)
  //   keepCasting       a hovering caster that never hides between its casts (the oracle: no dead time behind cover)
  sentinel: {
    name: 'sentinel', family: 'machine', plan: 'sentinel', planNo: 27, role: 'droid duellist', tier: 3, ranged: false,
    status: 'built', kind: 'sentinel', was: [], sound: 'ceramic', drop: 6, art: 'sheet-1', roster: 'v4',
    possession: 'a defunct guard droid of the makers’, still keeping its drill: guard, parry, thrust, cut, rush',
    moves: ['thrust and cut', 'guard, parry and riposte', 'shield bash and sudden dash'],
    answers: ['the charged cut throws its shield wide', 'get behind it: the dash cut', 'a perfect parry of its thrust or cut, then the riposte', 'stop after a cut: two in a row and its shield is up'],
    idle: 'stands at its post among the ruins, blade grounded, shield on its arm; its eye lights as you come near',
    def: S({
      name: 'sentinel', hp: 6, hook: 'heavy', radius: 0.45, height: 1.55, speed: 3.3, sight: 18, giveUp: 34, reach: 7, metal: true, breaks: true, clamber: true, stout: true,
      tone: '#ffae36', sound: 'machine', takes: { shoot: 1, fire: 0.5 },
      calm: { mode: 'stand', provoke: 8, alarm: 14 },
      // its round shield (src/foe-guard.js): up between its blows, and snapped up at once after two light cuts in a row
      // (`stings`: the masher's answer); the next blow into it is parried and answered with its riposte (blocks 1)
      guard: { pose: 'shield', arc: 1.1, near: 3.6, close: 2.0, hold: 2.0, rest: 1.5, blocks: 1, counter: 'riposte', stings: 2, breaks: ['charged', 'riposte', 'bomb'], open: 1.0, shots: true,
        hint: 'Two cuts in a row and its shield comes up; the next is parried. A charged cut throws it wide, or get behind it.' },
      // hide behind your own guard in its reach and it bashes it aside
      turtle: { after: 1.0, attack: 'bash', reach: 3 },
      attacks: [
        // the blade drawn back low at its hip, the shield forward; then straight in
        { id: 'thrust', name: 'thrust', shape: 'lane', width: 0.9, range: 3.4, damage: 0.5, wind: 0.75, strike: 0.18, contact: 0.5, lunge: 1.1, max: 3.2, weight: 2, dodge: 'side', recover: 0.6,
          tell: 'it draws the blade back low at its hip, the shield forward', counter: 'side hop; a perfect parry, then the riposte' },
        // the blade raised over its right shoulder (the sheet's wind-up); then across
        { id: 'cut', name: 'cut', shape: 'cone', range: 2.9, angle: 1.0, damage: 0.75, wind: 0.95, strike: 0.24, contact: 0.55, max: 2.8, weight: 2, dodge: 'back', recover: 0.65,
          tell: 'it raises the blade over its right shoulder', counter: 'back flip; a perfect parry, then the riposte' },
        // its shield shoulder drawn back, the chest turned away; then the bash: a plain guard is knocked aside
        { id: 'bash', name: 'shield bash', guardBreak: true, shielded: true, shape: 'cone', range: 2.4, angle: 0.9, damage: 0.5, knock: 5, wind: 0.95, strike: 0.2, contact: 0.5, lunge: 1.0, max: 2.2, weight: 1, recover: 0.7,
          tell: 'it draws its round shield back to its shoulder', counter: 'a perfect parry, or hop away: a plain guard is knocked aside' },
        // sunk low and still, the blade laid back along its side, the eye flaring; then a sudden rush through where you stood
        { id: 'dash', name: 'sudden dash', shape: 'lane', width: 1.1, range: 6.5, damage: 0.5, wind: 0.75, strike: 0.3, contact: 0.55, lunge: 5.5, min: 3.2, max: 6.5, weight: 1.6, dodge: 'side', recover: 0.8,
          tell: 'it sinks low and goes still, the blade laid back along its side, its eye flaring', counter: 'side hop out of its line' },
        // out of its guard, the answer to a blow it parried: the backhand, quick
        { id: 'riposte', name: 'riposte', chain: true, answer: true, shape: 'cone', range: 2.9, angle: 1.0, damage: 0.5, wind: 0.5, strike: 0.2, contact: 0.5, lunge: 1.2, recover: 0.6 },
      ],
      recover: 0.7, cool: [0.9, 1.6], hit: 0.4,
    }),
    note: 'A sentinel: two cuts and its shield is up. A charged cut throws it wide.',
  },
  oracle: {
    name: 'oracle', family: 'machine', plan: 'oracle', planNo: 28, role: 'droid caster', tier: 3, ranged: true,
    status: 'built', kind: 'oracle', was: [], sound: 'ceramic', drop: 6, art: 'sheet-1', roster: 'v4',
    possession: 'a defunct caster droid of the makers’: its light still gathers between its hands, its ring still turns',
    moves: ['bolt volley', 'a shield over a packmate', 'wake the sleeping droids'],
    answers: ['close in: it backs away and pulses, then it is open', 'cut the beam of its ward half-way', 'a perfect parry sends a bolt back into it', 'shoot it out of the air'],
    idle: 'hangs over a ruin’s threshold, its ring turning slowly',
    def: S({
      name: 'oracle', hp: 4, hook: 'flyer', radius: 0.45, height: 1.3, hover: 0.35, speed: 2.6, sight: 20, giveUp: 36, reach: 14, keep: 6, metal: true, lanterns: 1, keepCasting: true,
      tone: '#ffae36', sound: 'machine', takes: { shoot: 1, fire: 0.5 },
      calm: { mode: 'drift', provoke: 10, alarm: 14 },
      attacks: [
        // its hands together before its chest, a sphere of light swelling between them; three bolts, one after another
        { id: 'volley', name: 'bolt volley', shape: 'lane', width: 0.9, range: 14, damage: 0.5, wind: 1.0, strike: 0.3, contact: 0.5, track: 0.6, min: 3, max: 14, weight: 3, onParry: 'reflect', then: 'volley2',
          tell: 'its hands come together before its chest and a sphere of light swells between them', counter: 'guard or side-step each bolt; a perfect parry sends one back' },
        { id: 'volley2', chain: true, shape: 'lane', width: 0.9, range: 14, damage: 0.5, wind: 0.45, strike: 0.3, contact: 0.5, track: 0.5, onParry: 'reflect', then: 'volley3' },
        { id: 'volley3', chain: true, shape: 'lane', width: 0.9, range: 14, damage: 0.5, wind: 0.45, strike: 0.3, contact: 0.5, track: 0.5, onParry: 'reflect' },
        // one arm out to a packmate, a beam of light running to it: rings close round it (half harm, no staggers)
        { id: 'ward', name: 'ward', shape: 'ring', at: 'self', radius: 0.6, damage: 0, wind: 0.9, instant: true, ward: { time: 7, range: 12 }, max: 14, weight: 3, recover: 0.5,
          tell: 'it stretches one arm out to a packmate and a beam of light runs to it', counter: 'cut the beam half-way, or bring the oracle down' },
        // both arms thrown up, the ring spinning and flashing: every sleeping droid near it wakes
        { id: 'wake', name: 'wake', shape: 'ring', at: 'self', radius: 0.6, damage: 0, wind: 1.0, instant: true, horn: 18, wakes: true, max: 14, weight: 4, recover: 0.5,
          tell: 'it throws both arms up and its ring spins fast and flashes', counter: 'cut it before it calls, or ready for the rest' },
        // too close: arms flung down, the ring dropped round its hips; a burst round it
        { id: 'pulse', name: 'pulse', shape: 'ring', at: 'self', radius: 2.4, damage: 0.5, knock: 4, wind: 0.95, strike: 0.2, contact: 0.4, max: 2.2, weight: 2,
          tell: 'its arms fling down and out and its ring drops round its hips', counter: 'step back out of it, then cut while it recovers' },
      ],
      recover: 0.6, cool: [0.7, 1.3], hit: 0.4,
    }),
    note: 'An oracle: cut the beam of its ward, or bring it down first.',
  },
  crawler: {
    name: 'crawler', family: 'machine', plan: 'crawler', planNo: 29, role: 'droid scout', tier: 1, ranged: false,
    status: 'built', kind: 'crawler', was: [], sound: 'servo', drop: 2, art: 'sheet-1', roster: 'v4',
    possession: 'a defunct scout of the makers’, still running its rounds on four legs',
    moves: ['bite', 'call the others', 'self-destruct'],
    answers: ['cut it down before it calls', 'roll out of its blast', 'finish it during its fuse and it fizzles'],
    idle: 'runs its old rounds between the ruins, stopping to look about',
    def: S({
      name: 'crawler', hp: 2, hook: 'light', radius: 0.38, height: 0.45, speed: 4.2, sight: 16, giveUp: 34, reach: 12, metal: true, clamber: true, burst: [0.55, 0.3],
      tone: '#ffae36', sound: 'machine', takes: { shoot: 1, fire: 1 },
      calm: { mode: 'patrol', provoke: 9, alarm: 14 },
      attacks: [
        // sunk back on its hind legs, the eye tipped up at you; then it springs
        { id: 'bite', name: 'bite', shape: 'cone', range: 1.7, angle: 0.9, damage: 0.5, wind: 0.7, strike: 0.2, contact: 0.5, lunge: 1.1, max: 1.8, weight: 3, recover: 0.6,
          tell: 'it sinks back on its hind legs, its eye tipped up at you', counter: 'anything: step aside, guard, cut' },
        // reared up on its hind pair, the eye flashing, the antenna sparking: every sleeping droid near it wakes
        { id: 'call', name: 'call', shape: 'ring', at: 'self', radius: 0.5, damage: 0, wind: 0.9, instant: true, horn: 16, wakes: true, max: 12, weight: 5, recover: 0.4, cue: 'coil',
          tell: 'it rears up on its hind legs, its eye flashing, its antenna sparking', counter: 'cut it before it calls' },
        // its last: squatting braced, blinking red faster and faster as it scuttles at you; then it bursts
        { id: 'blast', name: 'self-destruct', shape: 'ring', at: 'self', radius: 2.6, damage: 1, knock: 6, wind: 1.7, strike: 0.12, contact: 0.4, below: 0.5, selfDestruct: true, seek: 3.4, max: 12, weight: 1, cue: 'kindle',
          tell: 'its eye and seams blink red, faster and faster, as it scuttles at you', counter: 'roll out of the blast; or finish it first and it fizzles' },
      ],
      recover: 0.7, cool: [0.9, 1.6], hit: 0.35,
    }),
    note: 'A crawler blinking red is about to burst: roll away, or finish it first.',
  },
  // (roster v4's third batch, issue #726: the prowler, the quick one, and the warlord, the rare elite)
  //   circles      m it circles you at while it waits out its cool (the prowler: it never stands still in reach)
  //   answerMash.evade  the answer is a back-flip out of your combo (fight.evade's hop, at once, whatever its cool), then
  //                `then` (its dart back in)
  prowler: {
    name: 'prowler', family: 'monster', plan: 'monster', planNo: 30, role: 'the quick one', tier: 2, ranged: true,
    status: 'built', kind: 'prowler', was: [], sound: 'scale', drop: 4, art: 'sheet-1',
    moves: ['darting slash (and a close slash)', 'tail sweep', 'spit'],
    answers: ['feint a swing, then cut it as it lands its flip', 'jump the tail sweep and cut its back', 'side hop the dart', 'guard the spit, or shoot it as it rears back'],
    idle: 'paces its ground, its tail swaying, tasting the air',
    def: S({
      name: 'prowler', hp: 5, hook: 'light', radius: 0.45, height: 1.8, speed: 4.8, sight: 18, giveUp: 34, reach: 12,
      tone: '#7fc65a', takes: { shoot: 1, fire: 1.5 },
      calm: { mode: 'pace', provoke: 9, round: 4, wait: 2, alarm: 16 },
      circles: 3.4, whiffRecover: 0.4,
      answerMash: { cuts: 2, within: 1.3, evade: true, then: 'dart' },
      attacks: [
        // close: the curved blade drawn back across its chest and slashed out flat
        { id: 'slash', name: 'slash', shape: 'cone', range: 1.9, angle: 0.9, damage: 0.5, wind: 0.7, strike: 0.22, contact: 0.5, lunge: 0.6, max: 2.2, weight: 2, dodge: 'side',
          tell: 'it draws the curved blade back across its chest, its head low', counter: 'guard it, or step aside and cut' },
        // crouched low on bent legs, the blade drawn back, its tail lashing (the sheet's attack pose); then it darts across the gap
        { id: 'dart', name: 'darting slash', shape: 'cone', range: 1.8, angle: 0.8, damage: 0.5, wind: 0.75, strike: 0.3, contact: 0.55, lunge: 3.6, min: 2.4, max: 5.8, weight: 2.5, dodge: 'side',
          tell: 'it crouches low on bent legs, the blade drawn back, its tail lashing', counter: 'side hop as it darts, then cut its back' },
        // it turns side-on and drops low, its tail drawn round behind it; then it spins and the tail sweeps round at your knees
        { id: 'tail', name: 'tail sweep', shape: 'ring', at: 'self', radius: 2.5, damage: 0.5, wind: 0.85, strike: 0.35, contact: 0.45, ground: true, max: 2.5, weight: 3,
          tell: 'it turns side-on and sinks, its tail drawn round low behind it', counter: 'jump it, then cut its back' },
        // its head reared back, its throat swelling; a glob of spit lobbed at the mark
        { id: 'spit', name: 'spit', shape: 'ring', at: 'target', instant: true, lob: true, radius: 1.3, damage: 0.5, wind: 0.95, min: 4, max: 11, weight: 2,
          tell: 'it rears its head back, its cream throat swelling', counter: 'walk out of the mark, or shoot it as it rears' },
      ],
      recover: 0.9, cool: [0.7, 1.4], hit: 0.35,
    }),
    note: 'The prowler: it flips back from your combo. Feint, or jump its tail.',
  },
  warlord: {
    name: 'warlord', family: 'monster', plan: 'monster', planNo: 31, role: 'the elite', tier: 4, ranged: false,
    status: 'built', kind: 'warlord', was: [], sound: 'hide', drop: 9, art: 'sheet-1',
    moves: ['glaive sweep and overhead', 'charge', 'roar (wakes its band); low, its last stand'],
    answers: ['roll through the sweep', 'side hop the overhead and cut its back', 'step aside from the charge: it stalls on a wall', 'charged cuts knock its bronze off', 'back off from its last stand'],
    idle: 'stands guard before its coffer, the glaive grounded, its band about it',
    def: S({
      name: 'warlord', hp: 12, hook: 'heavy', radius: 0.85, height: 2.5, speed: 3.2, sight: 20, giveUp: 34, reach: 14, heavy: true, stout: true,
      tone: '#b8323f', takes: { shoot: 1, fire: 1.2 },
      calm: { mode: 'stand', provoke: 10, alarm: 25 },
      whiffRecover: 0.6,
      attacks: [
        // the glaive drawn back over its shoulder in both hands, its chest turned away (the sheet's attack pose); a wide sweep
        { id: 'sweep', name: 'glaive sweep', shape: 'cone', range: 3.6, angle: 1.4, damage: 0.75, wind: 1.0, strike: 0.35, contact: 0.5, knock: 4, max: 3.5, weight: 2.5, dodge: 'back',
          tell: 'it draws the glaive back over its shoulder in both hands, its chest turned away', counter: 'roll through it, or the air cut over it' },
        // the glaive raised high over its horns, leaning back; then straight down through it
        { id: 'overhead', name: 'glaive overhead', shape: 'lane', width: 1.2, range: 4.2, damage: 1, wind: 1.1, strike: 0.3, contact: 0.55, knock: 5, lunge: 0.6, max: 4, weight: 2, dodge: 'side',
          tell: 'it raises the glaive high over its horns and leans back on its heels', counter: 'side hop, then cut its back' },
        // the glaive lowered like a lance, its head down and one foot pawing; then it charges through where you stood
        { id: 'charge', name: 'charge', shape: 'lane', width: 1.6, range: 9, damage: 0.75, knock: 6, wind: 1.2, strike: 0.8, contact: 0.05, lunge: 9, sweep: true, stall: 1.6, min: 3.5, max: 9, weight: 1.6,
          tell: 'it lowers the glaive like a lance, its horns down, and paws the ground', counter: 'step aside at the last moment; into a wall, it stalls' },
        // its arms flung wide, its chest out, its maned head thrown back: every one round it within 25 m wakes and comes
        { id: 'roar', name: 'roar', shape: 'ring', at: 'self', radius: 0.6, damage: 0, wind: 1.1, instant: true, horn: 25, max: 14, weight: 4, recover: 0.8,
          tell: 'it flings its arms wide and throws its maned head back', counter: 'cut it before it roars, or ready for its band' },
        // low (its desperation, fight.low 'last'): the glaive whirled round it twice, its whole body turning; then it sits open
        { id: 'whirl', name: 'last stand', shape: 'ring', at: 'self', radius: 3.4, damage: 1, knock: 6, wind: 1.3, strike: 0.7, contact: 0.4, opens: 1.6, below: 0.3, max: 3.2, weight: 6,
          tell: 'it plants its feet wide and swings the glaive back round behind it, roaring', counter: 'get out of its reach, then cut it while it reels' },
      ],
      recover: 1.1, cool: [1.1, 2.0], hit: 0.5,
    }),
    note: 'The warlord: knock its bronze off. When it whirls its glaive, get clear.',
  },
};

/**
 * The foes grown to the traveller (issue #741, the author: "we can just scale up all the monsters that were tiny, all the
 * bi-pedal ones should be at least my size"; and no foe under his hip, the tiny critters were too hard to hit): each drawn
 * this many times as big as it is built (its skins' scale: src/enemies/skins.js skinOf, the model's size), and its body
 * with it (grow: the hit body's and collision's radius, its height, its hover). Its attacks keep their reach from its
 * centre, which still lies past its grown body (tests/foe-heights.test.js): the mummer and the grunt to 1.8 m (he is
 * 1.75), the skitter and the crawler to his hip (0.95 m).
 */
export const GROWN = { mummer: 1.5, dunemummer: 1.5, grunt: 1.45, skitter: 1.75, crawler: 1.5 };
/** A def grown k times: its body's measures (m), not its senses, its speed or its attacks' reach. */
export function grow(def, k) {
  for (const key of ['radius', 'height', 'hover']) if (Number.isFinite(def[key])) def[key] *= k;
  return def;
}
for (const [id, k] of Object.entries(GROWN)) { ARCHETYPES[id].scale = k; grow(ARCHETYPES[id].def, k); }

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
  // (a trailing '*': its stronger tier, issue #722: 'bell@bazaar*', 'tripod*')
  let s = String(id ?? '');
  const tier = s.endsWith('*') ? 1 : 0;
  if (tier) s = s.slice(0, -1);
  const at = s.indexOf('@');
  const out = at < 0 ? { kind: s, skin: null } : { kind: s.slice(0, at), skin: s.slice(at + 1) || null };
  if (tier) out.tier = tier;
  return out;
}
/** A kind in a skin: skinned('crab', 'saltharbour') → 'crab@saltharbour'. */
export const skinned = (kind, skin) => (skin ? `${kind}@${skin}` : kind);
