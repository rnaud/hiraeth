// The desert's story as data: "The Tree That Drinks" (docs/story-bible.md, LORE.md).
//
// The old city's great tree burns on living water: once a year the water
// rises from beneath the giants, the tree drinks, and its fire burns cool and
// many-coloured for the drinking. This year the water has not risen (a rib
// of the giant whose heart lies under the city has fallen across the
// channel), and the night the singing light went over, the tree's fire went
// out. It stands cold over the walls when the traveller comes.
//
// It starts in the city. The traveller steps out of a dark ship with nothing
// on their back and walks to Qanat under its great dark tree. Beside the dry
// well, a few metres up the trunk, a ledge juts out, and on it sits the
// makers' chest that has not opened in living memory ("it opens for one who
// fell from the sky"). It opens for the traveller: the backpack, its tank
// empty. Qanat gathers and Nour, the eldest, who has kept the chest for sixty
// years, sends them on: the well, Ama's jar, the Speaker's old words, the way
// down. In the giant's chest the rib is far too heavy for arms, and the empty
// tank pushes nothing: the old keepers' pole levers it off (desert.js). The
// pool rises, the tank and the jar fill, and the water climbs the roots into
// the city's well. The tree drinks, and stays cold: living water only burns
// from the Givers' own spark. Nour sends the traveller for the spark-stone,
// in the Givers' Hearth far out in the red rocks: farther than walking, so
// first Marrow's hoverbike (desert-bike.js), then the ride from marked stone
// to marked stone, the Hearth's dark and its grille (desert-hearth.js), the
// stone carried home and set in the full well. The tree catches, cool and in
// every colour, and the jar's water with it: power for the ship.
//
// How the three connect (said by nobody all at once): the giants carried the
// water across the desert from the swamp of lights, and lay down where they
// could go no further; the water they carried pooled in their hearts; the
// tree grew from this giant's heart and the people built Qanat round it.
// The tree drinks what the giants left.
//
// Conversations: see src/story/dialogue.js for the format. Quests: see
// src/story/quests.js. Flags (game-state.js): desert.* below.

const Q = 'desert.power';

export const ITEMS = { jar: 'Ama’s drinking jar', water: 'a jar of living water', drum: 'Teo’s drum', cord: 'Oum’s knotted cord', pole: 'the keepers’ pole', stone: 'the spark-stone' };

/**
 * The stages of the spark-stone's errand, between the full well and the ship: a save from before it
 * (desert.quest.v < 3) whose tree was already burning (the channel open, or the ship fed) skips them
 * (src/story/desert.js migrateDesertQuest, and the skip in setupDesert).
 */
export const SPARK_STAGES = ['rise', 'spark', 'bike', 'hearth', 'stone', 'light'];

/**
 * Saves from before the backpack's box moved into the city (the stages were
 * pack, camps, ama, speaker, well, down, channel, fill, ship): where an old
 * stage goes now. Everyone short of the cave goes to meet Nour; the steps
 * they already did advance at once on their flags (jar, Speaker, well).
 */
export const STAGE_MIGRATION = { pack: 'city', camps: 'city', ama: 'elder', speaker: 'elder', well: 'elder' };

// ------------------------------------------------------------------ quests
export const QUESTS = [
  {
    id: Q, title: 'The Tree That Drinks', world: 'desert', main: true,
    outro: 'The tree burns again, the jar glows, and your ship has power. Qanat can celebrate; you can fly.',
    stages: [
      // the ship is dark and the traveller's back is bare: past the camps and the procession, into the city
      { id: 'city', text: 'The ship is dark. Walk to the city under the great dark tree', label: 'Qanat, under the dark tree', flag: 'desert.city.entered', at: 'cityGate' },
      // the makers' chest on its ledge up the great tree's trunk, beside the dry well (src/boxes/placements.js): the backpack
      { id: 'box', text: 'Something is humming on a ledge up the great tree’s trunk. Climb up to it', label: 'The ledge on the tree', flag: 'item.backpack', at: 'box.desert.backpack' },
      // Qanat gathers; Nour, the eldest, comes to see who opened it (src/story/desert.js, the reaction); the tank is empty
      { id: 'elder', text: 'The chest opened, and the tank in it is empty. Speak with Nour, the eldest of Qanat', label: 'Nour, the eldest', flag: 'desert.elder.heard', at: 'nour' },
      { id: 'well', text: 'Listen at the dry well, as Nour asked', label: 'The dry well', flag: 'desert.well.seen', at: 'well' },
      { id: 'ama', text: 'Ask Ama at the camp fires for the drinking jar', label: 'Ama, keeper of the fires', flag: 'desert.jar.given', at: 'ama' },
      { id: 'speaker', text: 'Ask the Speaker at the front of the procession how to reach the underground water', label: 'The Speaker', flag: 'desert.speaker.heard', at: 'speaker' },
      { id: 'down', text: 'Find the way beneath the giant, outside the back gate', label: 'The giant’s skull', flag: 'desert.cave.seen', at: 'caveIn' },
      // the rib is far too heavy for arms and the tank is empty: the keepers' pole levers it off (src/story/desert.js);
      // a full tank (an older save) can still push it
      { id: 'channel', text: 'The pool is dry. Find the old keepers’ pole by the mural and use the carved post to lever the fallen rib off the channel', label: 'The blocked channel', flag: 'desert.channel.open', at: 'rib' },
      { id: 'fill', text: 'The pool is rising. Wade in: fill your empty tank, and Ama’s jar', label: 'The pool', flag: 'desert.jar.filled', at: 'pool' },
      // back in the city: the water climbs the roots and fills the well while you watch, and the tree stays cold
      { id: 'rise', text: 'The water is climbing the roots. Go back to the well at the tree’s foot', label: 'The well, filling', flag: 'desert.well.watched', at: 'well' },
      { id: 'spark', text: 'The tree drank, and stands cold. Ask Nour why it will not burn', label: 'Nour, the eldest', flag: 'desert.spark.heard', at: 'nour' },
      // the Givers' Hearth is far out in the red rocks: Marrow's hoverbike first (src/story/desert-bike.js)
      { id: 'bike', text: 'Ask Marrow at the camps about his hidden hoverbike. You need it for the long journey to the Givers’ Hearth', label: 'Something faster than walking', flag: 'desert.bike.found', at: 'bikeWay' },
      { id: 'hearth', text: 'Ride south-east to the Givers’ Hearth in the red rocks, from marked stone to marked stone', label: 'The Givers’ Hearth', flag: 'desert.hearth.seen', at: 'hearth' },
      // (src/desert-hearth.js: dark; the stone pulses behind a grille; a shove of fluid rolls the weight that lifts it)
      { id: 'stone', text: 'Push the stone ball along its groove to lift the Hearth’s grille, then climb up and take the spark-stone', label: 'The spark-stone', flag: 'desert.stone.taken', at: 'sparkStone' },
      { id: 'light', text: 'Bring the spark-stone back to Qanat and set it in the full well at the tree’s roots', label: 'The well at the tree', flag: 'desert.tree.lit', at: 'well' },
      { id: 'ship', text: 'The tree burns, and the water in Ama’s jar burns with it. Bring it to the ship', label: 'Your ship', flag: 'desert.ship.fed', at: 'ship' },
    ],
  },
  {
    id: 'desert.drum', title: 'Teo’s Drum', world: 'desert',
    outro: 'Teo plays again. The camp keeps time.',
    stages: [
      // (src/story/desert-errands.js: the drum is jammed against a rib's foot by a knuckle of spine; shove the knuckle off sideways)
      { id: 'find', text: 'Find Teo’s drum, blown away under the old ribcage south of the start', label: 'Teo’s drum', goto: 'drum', radius: 9, at: 'drum' },
      { id: 'free', text: 'The drum is jammed against a rib by a fallen knuckle of bone. Shift the knuckle from the side (heave it, or push: C, middle click, or RB / R1) and pick the drum up', label: 'Teo’s drum', bring: 'drum', at: 'drum', to: 'teo' },
      { id: 'return', text: 'Bring the drum back to Teo at the fire', label: 'Teo, at the fire', bring: 'drum', to: 'teo' },
    ],
  },
  {
    id: 'desert.ilo', title: 'Ilo Wants to See', world: 'desert',
    outro: 'Ilo will tell it better than it happened.',
    stages: [
      { id: 'lead', text: 'Take Ilo to the giant’s skull outside the back gate', label: 'The giant’s skull', flag: 'desert.ilo.atSkull', at: 'skull' },
      { id: 'below', text: 'Go down alone, then tell Ilo what you saw', label: 'Ilo, at the skull', talk: 'ilo', at: 'ilo', secret: true },
    ],
  },
  {
    id: 'desert.oum', title: 'The One Who Fell Behind', world: 'desert',
    outro: 'Oum sits by the fire. She saw the light go over, and turn, and climb away.',
    stages: [
      { id: 'find', text: 'Find old Oum, who fell behind the procession in the western dunes', label: 'Old Oum', talk: 'oum', at: 'oum' },
      { id: 'lead', text: 'Walk with Oum to the camps (she is slow; stay close)', label: 'The camps, with Oum', flag: 'desert.oum.home', at: 'camps' },
    ],
  },
  {
    // the hoverbike isn't yours from the start: Marrow salvaged it and hid it under a tarp in a
    // hollow (src/story/desert.js, "the hoverbike"); it runs on the backpack's fluid, so it wakes only once the
    // tank has been filled at the giant's pool
    id: 'desert.bike', title: 'Something Faster Than Walking', world: 'desert',
    outro: 'The hoverbike hums under you. Whistle, and it comes.',
    stages: [
      { id: 'ask', text: 'Ask Marrow the salvager, at the camps, for something faster than walking', label: 'Marrow, at the camps', talk: 'marrow', at: 'marrow' },
      { id: 'find', text: 'Find what Marrow hid under a tarp: the hollow with a red rag on a pole, between your ship and the camps', label: 'The tarp in the hollow', flag: 'desert.bike.uncovered', at: 'bike' },
      { id: 'wake', text: 'It runs on fluid. Wake the hoverbike with a full tank', label: 'The hoverbike', flag: 'desert.bike.found', at: 'bike' },
    ],
  },
  {
    id: 'desert.mask', title: 'The Mask in the Sand', world: 'desert',
    outro: 'It does not wake. But it saw you.',
    stages: [
      { id: 'go', text: 'Visit the masked head that sleeps in the southern dunes', label: 'The masked head', goto: 'mask', radius: 30, at: 'mask' },
      // (src/story/desert-errands.js: a lid of sand over each eye; the wind sifts it back after a few seconds)
      { id: 'eyes', text: 'Sand has drifted over the mask’s eyes. Wash both clear before the wind fills them again (shoot: aim with R, right click or LT / L2, then G, a click or RT / R2)', label: 'The mask’s eyes', flag: 'desert.mask.eyes', at: 'maskEyes' },
    ],
  },
];

// ------------------------------------------------------------------ the people
// palettes: cloak / cloth / legs / hat / hair (buildCharacter + Humanoid)
export const PEOPLE = {
  ama: {
    id: 'ama', name: 'Ama', title: 'keeper of the fires', color: '#c8483a', voice: 1.05, kind: 'f',
    palette: { cloak: '#c8483a', lining: '#2b211f', cloth: '#5a4a3a', legs: '#2b2f45', hat: '#f3ead8', hair: '#2b211f' }, head: 'wrap', cape: 1.25,
    lines: ["~neutral~ Mind the sparks. They’ve no manners.", "~happy~ Sit. There’s room, if everyone admits it.", "~neutral~ One drinking jar. Plenty of thirsty people."],
    talk: {
      entry: [
        { if: { quest: Q, done: true }, node: 'after' },
        { if: { flag: 'desert.tree.lit' }, node: 'drinking' },
        { if: { flag: 'desert.channel.open' }, node: 'drank' },
        { if: { flag: 'desert.jar.given' }, node: 'again' },
        { if: { flag: 'desert.elder.heard' }, node: 'sent' },
        { node: 'hello' },
      ],
      nodes: {
        hello: {
          say: ["~happy~ You walked away from that crash? Sit down. I’m Ama. At my fire we offer water before questions. Usually.", "~neutral~ I keep the pilgrims fed and the fires burning while they circle the city. The walking is their department."],
          choices: [
            { text: '~neutral~ My ship has no power. I need to find some.', goto: 'early' },
            { text: '~curious~ What is that great dark tree?', goto: 'tree' },
          ],
        },
        early: {
          say: ["~playful~ Ship power? I’ve got cooking fire. Your ship would need to be a very large kettle.", "~neutral~ Go into *Qanat* and climb *the steps to the great tree*. Find *Nour beneath the chest on its trunk*. That chest started humming when the light passed. She may know why."],
          choices: [{ text: '~neutral~ I’ll go to the city.', end: true }, { text: '~curious~ Who are all these people?', goto: 'who' }],
        },
        sent: {
          say: ["~surprised~ Nour sent you? She hasn’t dispatched anyone since my wedding. We still discuss that.", "~playful~ And the chest gave you… a glass tank. Empty. A very ancient sort of generosity."],
          next: 'power',
        },
        who: {
          say: ["~neutral~ Pilgrims. We come from the oases once a year for *the Drinking*, when Qanat’s tree draws up its water.", "~sad~ The tree burns in every colour, and we share a drink from one jar. This year: eleven days walking, a dry well, and no fire. Nobody planned a meal for disappointment."],
          choices: [
            { text: '~curious~ Rises from where?', goto: 'giants' },
            { text: '~neutral~ I need power for my ship.', goto: 'early' },
          ],
        },
        tree: {
          say: ["~solemn~ Qanat’s tree used to burn without consuming its wood. The water in its roots fed the fire. It had burned longer than anyone remembered.", "~sad~ That night, the singing light passed and the tree’s fire went out. We arrived to find it cold."],
          choices: [
            { text: '~curious~ And if it doesn’t?', goto: 'giants' },
            { text: '~neutral~ I need power for my ship.', goto: 'early' },
          ],
        },
        giants: {
          say: ["~neutral~ Ask *the Speaker*. He keeps the old accounts. I keep people from fainting during them.", "~neutral~ He leads *the procession around the walls*. Follow the banners to the front."],
          choices: [{ text: '~neutral~ I need power for my ship.', goto: 'early' }, { text: '~happy~ Thank you, Ama.', end: true }],
        },
        power: {
          say: ["~neutral~ The tree’s water is the only fuel I know here. Once its fire is restored, perhaps the water will power your ship too.", "~happy~ Take *the drinking jar*. Fill it when you find the water. We need some for the Drinking, and you need some for that ship.", "~neutral~ Find *the Speaker at the procession’s head*. He knows the old route underground."],
          do: [{ give: 'jar' }, { set: { 'desert.jar.given': true } }],
          choices: [
            { text: '~curious~ Where is the Speaker?', goto: 'where' },
            { text: '~happy~ I’ll bring it back full.', end: true },
          ],
        },
        where: { say: ["~neutral~ *Follow the banners around the city walls*. The Speaker is at the front."], choices: [{ text: '~curious~ Who is that boy staring at the fire?', if: { quest: 'desert.drum', started: false }, goto: 'teo' }, { text: '~happy~ Thank you.', end: true }] },
        again: {
          say: [{ if: { has: 'water' }, text: "~happy~ Jar’s full? Good. Once the tree burns, that water should wake your ship." }, { if: { not: { has: 'water' } }, text: "~neutral~ The Speaker leads the procession. And *the giant’s skull is beyond the back gate*, if you’re looking for the way underground." }],
          choices: [
            { text: '~curious~ Have you seen anything strange lately?', goto: 'rumour', once: true },
            { text: '~happy~ See you, Ama.', end: true },
          ],
        },
        rumour: { say: ["~playful~ Strange lately? A person fell out of the sky in a ball and asked me for fuel. Fairly full week.", "~playful~ Oum saw the singing light the night before your crash. Ask her. She notices things the rest of us hurry past."], choices: [{ text: '~curious~ Where is Oum?', goto: 'oum' }, { text: '~neutral~ Thanks.', end: true }] },
        oum: { say: ["~tired~ She fell behind *in the western dunes*. Go find her, would you? The procession has been very poor at noticing who isn’t in it."], do: { start: 'desert.oum' }, choices: [{ text: '~neutral~ I’ll look for her.', end: true }] },
        teo: { say: ["~sad~ Teo lost his drum. Since then we’ve had nothing but a man explaining how much better a drum would be."], choices: [{ text: '~neutral~ I will.', end: true }] },
        // the water is up, the tree drank, and it is still cold
        drank: {
          say: ["~surprised~ The well is full! But the tree won’t burn. I tried a torch. It hissed at me. I’m accustomed to better manners from firewood.", "~neutral~ *Fill the jar*, then *ask Nour how to light the tree*. She’ll be delighted to know something I don’t."],
          choices: [{ text: '~neutral~ It was a bone in the channel. A giant’s rib.', goto: 'rib' }, { text: '~neutral~ I’ll ask her.', end: true }],
        },
        // the spark-stone lit it
        drinking: {
          say: ["~happy~ It burns! Every colour! I had my doubts when you arrived on fire yourself, but you’ve made a fine recovery.", "~neutral~ Your jar’s glowing. *Take it to the ship.*"],
          choices: [{ text: '~neutral~ It was a stone from the Givers’ Hearth.', goto: 'stone' }, { text: '~neutral~ I will.', end: true }],
        },
        stone: { say: ["~surprised~ Marrow’s bike got you there? Don’t praise it where he can hear. He’ll start charging for the breeze."], choices: [{ text: '~happy~ Goodbye, Ama.', end: true }] },
        rib: { say: ["~solemn~ A fallen rib blocked it? All these years, and the giant is still coming apart beneath us. I’ll tell the Speaker."], choices: [{ text: '~neutral~ Goodbye, Ama.', end: true }] },
        after: {
          say: ["~playful~ They’ll sing about you all the way home. You’ll be twelve feet tall by the second oasis. Don’t take it personally."],
          choices: [{ text: '~happy~ Keep the fires going, Ama.', end: true }],
        },
      },
    },
  },

  teo: {
    id: 'teo', name: 'Teo', title: 'a drummer without a drum', color: '#e6875f', voice: 1.25, kind: 'm',
    palette: { cloak: '#e6875f', lining: '#2b211f', cloth: '#3f6f6a', legs: '#4a3a2a', hat: '#d8a24a', hair: '#4a3226' }, head: 'hair', cape: 0,
    lines: ["~sad~ No drum. Plenty of complaints available.", "~sad~ A procession needs a beat.", "~angry~ These hands were hired as a pair. We need the drum."],
    talk: {
      entry: [
        { if: { quest: 'desert.drum', done: true }, node: 'after' },
        { if: { has: 'drum' }, node: 'back' },
        { if: { quest: 'desert.drum', active: true }, node: 'waiting' },
        { node: 'hello' },
      ],
      nodes: {
        hello: {
          say: ["~sad~ Teo. Drummer. Currently providing only the first half of the service.", "~sad~ The wind rolled my drum off a camel on our last night crossing. It went *south, under the old ribcage*, past your crash site. Too dark to fetch it then."],
          choices: [
            { text: '~happy~ I’ll look for it.', do: { start: 'desert.drum' }, goto: 'thanks' },
            { text: '~curious~ Can’t you play something else?', goto: 'else' },
          ],
        },
        else: { say: ["~angry~ Sefa offered me a jar. A jar! The procession needs a rhythm, not a man arguing with pottery."], choices: [{ text: '~neutral~ I’ll look for your drum.', do: { start: 'desert.drum' }, goto: 'thanks' }, { text: '~neutral~ Bye.', end: true }] },
        thanks: { say: ["~surprised~ You’ll look? Red drum, shells around the rim. South, under the great ribcage, beyond your ship. Ignore any sand pretending to be part of it."], choices: [{ text: '~happy~ I’ll bring it back.', end: true }] },
        waiting: { say: ["~neutral~ *South past your ship, beneath the ribcage.* Red, ring of shells. That’s my drum."], choices: [{ text: '~neutral~ On my way.', end: true }] },
        back: {
          say: ["~surprised~ That’s it! Even the shells are still there!", "~happy~ Listen. My hands have been rehearsing this reunion."],
          do: [{ take: 'drum' }, { advance: 'desert.drum' }, { set: { 'desert.teo.drumming': true } },
            { keepsake: { id: 'desert.song', level: 'desert', name: 'Teo’s walking rhythm', kind: 'song', text: 'Dum, tek-dum. The rhythm a whole procession walks to. Teo says it is older than the city.' } }],
          next: 'played',
        },
        played: { say: ["~happy~ The walking rhythm. Everybody’s feet know it. Take the tune with you. Finally, luggage with no weight."], choices: [{ text: '~happy~ Thank you, Teo.', end: true }] },
        after: { say: ["~happy~ Hear them keeping step? Not a single heel being trodden on. My finest work."], choices: [{ text: '~happy~ I can.', end: true }] },
      },
    },
  },

  sefa: {
    id: 'sefa', name: 'Sefa', title: 'oud player', color: '#8a6fb8', voice: 0.95, kind: 'f',
    palette: { cloak: '#8a6fb8', lining: '#2b211f', cloth: '#e2d3b4', legs: '#2b2f45', hat: '#62c3c9', hair: '#2b211f' }, head: 'hair', cape: 0.55,
    lines: ['~happy~ ♪', "~happy~ Stay for a tune. Leaving halfway makes it self-conscious.", "~curious~ You keep glancing behind you."],
    talk: {
      entry: [{ if: { flag: 'desert.tree.lit' }, node: 'feast' }, { if: { flag: 'desert.channel.open' }, node: 'cold' }, { if: { flag: 'met.sefa' }, node: 'again' }, { node: 'hello' }],
      nodes: {
        hello: {
          say: ["~playful~ You stopped! I was beginning to think I’d been mistaken for a decorative bush.", "~whisper~ I’m Sefa. I try to play what suits the listener. Yours keeps wandering away from the last note."],
          choices: [{ text: '~curious~ My tune?', goto: 'tune' }, { text: '~happy~ Keep playing.', end: true }],
        },
        tune: { say: ["~sad~ You look far from home. I can play something cheerful, if you’d rather. Music isn’t a diagnosis."], choices: [{ text: '~curious~ What do you play for the drinking?', goto: 'drinking' }, { text: '~sad~ Maybe it does.', end: true }] },
        drinking: { say: ["~playful~ At the Drinking we play all night. Bako cries and blames the smoke. The fire could write a formal denial.", "~sad~ No smoke this year. He’ll need a new explanation."], choices: [{ text: '~neutral~ I hope it drinks.', end: true }] },
        again: { say: ["~playful~ Back? Sit down. Bako’s about to make a mistake worth hearing."], choices: [{ text: '~neutral~ (listen)', end: true }] },
        cold: { say: ["~sad~ The water’s back, but not the fire. I’ve tried a cheerful tune. Apparently trees prefer a more practical approach."], choices: [{ text: '~neutral~ (listen)', end: true }] },
        feast: { say: ["~happy~ Now that’s a proper Drinking! Fire, water, and more songs than we can agree to play."], choices: [{ text: '~neutral~ (listen)', end: true }] },
      },
    },
  },

  bako: {
    id: 'bako', name: 'Bako', title: 'ney player', color: '#5fb7ad', voice: 0.75, kind: 'm',
    palette: { cloak: '#5fb7ad', lining: '#2b211f', cloth: '#5a4a3a', legs: '#3a3a3a', hat: '#f3ead8', hair: '#b0a89a' }, head: 'hat', cape: 0,
    lines: ['~tired~ Hm.', '~happy~ Hmmm-hm.', '~neutral~ (he hums)'],
    talk: {
      nodes: {
        hello: {
          say: ["~neutral~ You’re from the round ship. I saw the burn on its side."],
          choices: [{ text: '~surprised~ You saw the burn?', goto: 'burn' }, { text: '~curious~ What’s that flute?', goto: 'ney' }],
        },
        burn: { say: ["~curious~ Three dots above an arc. {glyph} Same mark as the giant’s forehead *beyond the back gate*. Whoever made it had a signature."], choices: [{ text: '~curious~ Who?', goto: 'who' }, { text: '~neutral~ Thank you.', end: true }] },
        who: { say: ["~playful~ If I knew who, I’d tell you. Flute players are allowed to be puzzled too."], choices: [{ text: '~curious~ Will you play something?', do: { emit: ['music:solo', { who: 'bako' }] }, end: true }, { text: '~neutral~ (leave him to his music)', end: true }] },
        ney: { say: ["~neutral~ A ney. Cut from an oasis reed. Same tune for years. I change; it politely adjusts."], choices: [{ text: '~happy~ Play it for me.', do: { emit: ['music:solo', { who: 'bako' }] }, end: true }, { text: '~neutral~ (leave him to his music)', end: true }] },
      },
    },
  },

  ilo: {
    id: 'ilo', name: 'Ilo', title: 'too curious', color: '#f2c54b', voice: 1.7, kind: 'f', scale: 0.7,
    palette: { cloak: '#f2c54b', lining: '#2b211f', cloth: '#c8483a', legs: '#4a3a2a', hat: '#e6875f', hair: '#6e4a32' }, head: 'hair', cape: 0.55,
    lines: ["~curious~ Were the clouds soft?", "~sad~ They won’t let me past the back gate alone.", "~playful~ Bet I can get there first!"],
    talk: {
      entry: [
        { if: { quest: 'desert.ilo', done: true }, node: 'after' },
        { if: { all: [{ quest: 'desert.ilo', stage: 'below' }, { flag: 'desert.cave.seen' }] }, node: 'tell' },
        { if: { quest: 'desert.ilo', stage: 'below' }, node: 'go' },
        { if: { quest: 'desert.ilo', stage: 'lead' }, node: 'come' },
        { node: 'hello' },
      ],
      nodes: {
        hello: {
          say: ["~surprised~ You fell from the sky! Were you steering? Was that the plan? I’m Ilo. I have more questions.", "~whisper~ Secret: there’s a way inside the giant *beyond the back gate*. *Through its mouth*. Old people used to come out wet. Imagine wasting a secret on old people!", "~sad~ I want to see the entrance. But I need someone to go with me."],
          choices: [
            { text: '~neutral~ Come with me, then. Stay close.', do: [{ start: 'desert.ilo' }, { set: { 'desert.ilo.following': true } }], goto: 'yes' },
            { text: '~curious~ Wet? Where exactly?', goto: 'where' },
          ],
        },
        where: { say: ["~happy~ Past the back gate, into the giant’s open mouth. The skull with three dots on its forehead. Hard to confuse with a normal door."], choices: [{ text: '~neutral~ Come with me, then.', do: [{ start: 'desert.ilo' }, { set: { 'desert.ilo.following': true } }], goto: 'yes' }, { text: '~neutral~ Better ask your parents.', goto: 'parents' }] },
        parents: { say: ["~angry~ Mum won’t stop walking until the tree drinks. Trees are extremely slow at making arrangements."], choices: [{ text: '~neutral~ All right. Come with me.', do: [{ start: 'desert.ilo' }, { set: { 'desert.ilo.following': true } }], goto: 'yes' }, { text: '~sad~ Sorry, Ilo.', end: true }] },
        yes: { say: ["~happy~ Yes! I’ll be quiet. Starting in a minute. Come on!"], choices: [{ text: '~neutral~ (go)', end: true }] },
        come: { say: ["~happy~ Through the city, past the tree, out the back gate! I’m following. Look how responsibly I’m following!"], choices: [{ text: '~neutral~ (go)', end: true }] },
        go: { say: ["~playful~ I’ll wait here by the mouth. Someone has to watch for teeth moving. Go down, then tell me what’s there!"], choices: [{ text: '~neutral~ I’ll be back.', end: true }] },
        tell: {
          say: ["~curious~ You’re back! Tell me everything. Start with the biggest thing."],
          choices: [
            { text: "~solemn~ A pool of coloured water inside the giant’s chest. The tree’s roots drink from it.", if: { flag: 'desert.channel.open' }, do: [{ advance: 'desert.ilo' }, { set: { 'desert.ilo.told': 'true' } }], goto: 'truth' },
            { text: "~solemn~ A pool, dry as the well. A fallen rib blocks its water channel. The tree’s roots hang above it.", if: { not: { flag: 'desert.channel.open' } }, do: [{ advance: 'desert.ilo' }, { set: { 'desert.ilo.told': 'true' } }], goto: 'truth' },
            { text: '~playful~ A sleeping monster. It sniffed me.', do: [{ advance: 'desert.ilo' }, { set: { 'desert.ilo.told': 'monster' } }], goto: 'monster' },
            { text: '~whisper~ It’s a secret. You’ll see it yourself when you’re older.', do: [{ advance: 'desert.ilo' }, { set: { 'desert.ilo.told': 'secret' } }], goto: 'secret' },
          ],
        },
        truth: { say: ["~surprised~ The giant carries the well INSIDE it! I need something to draw on. Something enormous."], choices: [{ text: '~happy~ (smile)', end: true }] },
        monster: { say: ["~shout~ A MONSTER! I knew it! I’m telling the Speaker before anyone makes it less interesting!"], choices: [{ text: '~scared~ (oh no)', end: true }] },
        secret: { say: ['~angry~ Hmph. Fine. But I’m going to be older really soon.'], choices: [{ text: '~happy~ (laugh)', end: true }] },
        after: { say: [{ if: { flag: 'desert.ilo.told', is: 'monster' }, text: '~angry~ Nobody believes me about the monster. They will.' }, { if: { not: { flag: 'desert.ilo.told', is: 'monster' } }, text: "~playful~ When I’m big, I’ll go down myself. Then you can wait up here and ask questions." }], choices: [{ text: '~happy~ I’d like that.', end: true }] },
      },
    },
  },

  speaker: {
    id: 'speaker', name: 'The Speaker', title: 'who leads the procession', color: '#f3ead8', voice: 0.7, kind: 'm', scale: 1.08,
    palette: { cloak: '#f3ead8', lining: '#c8483a', cloth: '#e2d3b4', legs: '#5a4a40', hat: '#c8483a', hair: '#e8dcc0' }, head: 'hat', cape: 1.45, look: { prop: 'staff', body: 'mantle', robe: 0.08 },
    lines: ['~solemn~ Round, and round, and round.', '~neutral~ Keep the step.', '~solemn~ The tree is patient. So are we.'],
    talk: {
      entry: [
        { if: { quest: Q, done: true }, node: 'after' },
        { if: { flag: 'desert.tree.lit' }, node: 'drinking' },
        { if: { has: 'stone' }, node: 'carried' },
        { if: { flag: 'desert.channel.open' }, node: 'cold' },
        { if: { flag: 'desert.speaker.heard' }, node: 'again' },
        { if: { quest: Q, stage: ['city', 'box'] }, node: 'early' },
        { node: 'hello' },
      ],
      nodes: {
        early: {
          say: ["~solemn~ Walk beside me. I lead the procession. We make room for strangers, though rarely ones who arrive quite so loudly.", "~neutral~ Go up Qanat’s steps to Nour at the great tree. Her chest has hummed since the light passed. Start there, then come back to me."],
          choices: [{ text: '~neutral~ I’ll go to the city.', end: true }, { text: '~curious~ Why do you walk round and round?', goto: 'hello' }],
        },
        hello: {
          say: ["~solemn~ Walk with me a little. Speaking is easier when our feet agree on a pace.", "~sad~ We circle the city until the tree drinks. It is a way to wait together. This year, we have had much practice."],
          choices: [
            { text: '~curious~ Why is the tree cold?', if: { not: { flag: 'desert.elder.heard' } }, goto: 'old' },
            { text: '~neutral~ Nour says the old words know the way down to the water.', if: { flag: 'desert.elder.heard' }, goto: 'old' },
            { text: '~neutral~ Walk on, Speaker.', end: true },
          ],
        },
        old: {
          say: ["~solemn~ The old songs say *giants carried water from the swamp of lights*. They walked until they could go no farther. The water remained inside them.", "~solemn~ Qanat stands above one giant. The tree grows from its heart. Water rises through its roots into our well and feeds the tree’s fire.", "~sad~ This year the water did not rise. Then the singing light passed, and the fire went out. We need to understand both."],
          do: { set: { 'desert.speaker.heard': true } },
          choices: [
            { text: '~curious~ Is there a way down to the water?', goto: 'way' },
            { text: '~scared~ What happens if it never drinks?', goto: 'never' },
          ],
        },
        way: {
          say: ["~solemn~ One old verse gives the route: *Where the giant’s eyes are marked, its mouth is a door.* I believe that means exactly what it says.", "~playful~ Find *the marked skull outside the back gate*. Carved stones hold its jaw open. *Go through the mouth* to reach the water below."],
          choices: [{ text: '~neutral~ I’ll go and look.', end: true }, { text: '~curious~ The swamp of lights?', goto: 'swamp' }],
        },
        well: { say: ["~neutral~ The well is at the tree’s roots. Its supply lies beneath the giant. The old keepers went down there to tend it."], choices: [{ text: '~curious~ Is there a way down?', goto: 'way' }, { text: '~curious~ The swamp of lights?', goto: 'swamp' }] },
        swamp: { say: ["~curious~ The swamp of lights: glowing water and singing plants, far beyond this desert. Farther than our feet can take us."], do: { set: { 'clue.desert.perdide': true } }, choices: [{ text: '~neutral~ Not yet.', goto: 'well' }] },
        never: { say: ["~tired~ Then we must learn something new. Walking is a comfort, but the tree cannot drink footsteps."], choices: [{ text: '~curious~ Where does the water come up?', goto: 'well' }] },
        again: {
          say: ["~neutral~ The well is beneath the tree. The underground entrance is the giant’s mouth, beyond the back gate. May the route be easier than the verse."],
          choices: [
            { text: '~neutral~ Tell me the line about the giant’s mouth again.', goto: 'way' },
            { text: '~curious~ Have you seen an old woman who fell behind?', if: { quest: 'desert.oum', done: false }, goto: 'oum' },
            { text: '~curious~ Have you heard of a masked head in the sand?', if: { all: [{ quest: 'desert.oum', done: true }, { quest: 'desert.mask', started: false }] }, goto: 'mask' },
            { text: '~neutral~ Walk on, Speaker.', end: true },
          ],
        },
        oum: { say: ["~playful~ Oum fell behind *in the western dunes*. Walk her back, if you can. The Drinking should include everyone who made the journey."], do: { start: 'desert.oum' }, choices: [{ text: '~curious~ And a masked head in the sand?', if: { quest: 'desert.mask', started: false }, goto: 'mask' }, { text: '~neutral~ I’ll find her.', end: true }] },
        mask: { say: ["~solemn~ There is *a sleeping face south, beyond the bones*. Another giant, looking upward. Go see it. You may get the uneasy sense it sees you too."], do: { start: 'desert.mask' }, choices: [{ text: '~neutral~ I will.', end: true }] },
        // the water is up and the tree is cold: the second old line
        cold: {
          say: ["~solemn~ The well is full but the fire is out. We have an old verse: *The fire must be carried.* You’ll need something to light the tree.",
            "~neutral~ The fire-bearers travelled *south-east into the red rocks*, leaving marked stones along the route. *Ask Nour*. She knows what they brought back."],
          choices: [{ text: '~neutral~ A rib had fallen across the water.', goto: 'rib' }, { text: '~neutral~ Walk on, Speaker.', end: true }],
        },
        carried: { say: ["~surprised~ The spark-stone. You found it. *Take it to the well*. We’ll keep the procession moving until the tree burns."], choices: [{ text: '~neutral~ Walk on, Speaker.', end: true }] },
        drinking: {
          say: ["~happy~ The tree burns! Listen to the drums. Nobody had to tell them when to begin.", "~solemn~ Under the giant, out to the red rocks, and back. The old route still works. I’ll need a new verse for your part."],
          choices: [{ text: '~neutral~ A rib had fallen across the water.', goto: 'rib' }, { text: '~whisper~ Your secret is safe.', end: true }],
        },
        rib: { say: ["~solemn~ A fallen rib blocked the water. Then we were waiting above a repair that needed doing. I will remember that."], choices: [{ text: '~neutral~ Walk on, Speaker.', end: true }] },
        after: { say: ["~solemn~ When they ask what you found here, tell them about the people as well as the fuel. We did, after all, lend you a jar."], choices: [{ text: '~solemn~ I’ll remember.', end: true }] },
      },
    },
  },

  oum: {
    id: 'oum', name: 'Oum', title: 'who fell behind', color: '#b7a0cf', voice: 0.85, kind: 'f', age: 'elder', scale: 0.94,
    palette: { cloak: '#b7a0cf', lining: '#2b211f', cloth: '#e2d3b4', legs: '#5a4a40', hat: '#f3ead8', hair: '#e8dcc0' }, head: 'wrap', cape: 1.45, look: { prop: 'staff' },
    lines: ['~surprised~ Eh? Who’s there?', '~tired~ My feet are older than the city.', '~shout~ Wait for me!'],
    talk: {
      entry: [
        { if: { quest: 'desert.oum', done: true }, node: 'home' },
        { if: { quest: 'desert.oum', stage: 'lead' }, node: 'walking' },
        { node: 'hello' },
      ],
      nodes: {
        hello: {
          say: ["~playful~ Someone faster than me. That narrows it down to everybody. I’m Oum. Offer an arm before you offer advice.", "~playful~ I fell behind the procession, then behind the stragglers. Now there’s nobody ahead close enough to hurry me. A peaceful promotion."],
          choices: [
            { text: '~happy~ Walk with me to the camps. I’ll go slowly.', do: [{ start: 'desert.oum' }, { stage: ['desert.oum', 'lead'] }, { set: { 'desert.oum.following': true } }], goto: 'yes' },
            { text: '~curious~ Ama says you saw a light go over.', goto: 'light' },
          ],
        },
        light: {
          say: ["~solemn~ The night before your ship fell, a light crossed the dunes, singing one long note. I was awake. Old knees make excellent witnesses.", "~whisper~ It turned over Qanat, and the tree went dark. Then it climbed away. Your ship came down the next morning."],
          do: { set: { 'desert.rumour.light': true } },
          choices: [{ text: '~neutral~ It struck my ship.', goto: 'struck' }, { text: '~neutral~ Walk with me to the camps.', do: [{ start: 'desert.oum' }, { stage: ['desert.oum', 'lead'] }, { set: { 'desert.oum.following': true } }], goto: 'yes' }],
        },
        struck: { say: ["~playful~ It hit you? Then I’m glad you can walk beside me. We can wonder why it turned on the way back."], choices: [{ text: '~happy~ Come, then.', do: [{ start: 'desert.oum' }, { stage: ['desert.oum', 'lead'] }, { set: { 'desert.oum.following': true } }], goto: 'yes' }] },
        yes: { say: ["~playful~ *Stay close and walk slowly.* If you run off, I’ll sit. I have no objection to sitting."], choices: [{ text: '~neutral~ (walk slowly)', end: true }] },
        walking: { say: ["~curious~ That smells like Ama’s fires. Too much thornwood. We’re going the right way."], choices: [{ text: '~happy~ Not far now.', end: true }] },
        home: {
          say: ["~happy~ A seat by the fire. Thank you. Take this cord: one knot for each circuit I walked. Lost count at forty, but kept tying."],
          do: [{ give: 'cord' }, { set: { 'desert.oum.thanked': true } }],
          next: 'home2',
        },
        home2: { say: ["~solemn~ If you find that singing light again, ask why it turned. Then come tell an old woman who noticed."], choices: [{ text: '~happy~ I will, Oum.', end: true }] },
      },
    },
  },

  // the eldest of Qanat, Hessa's grandmother, who has kept the makers' chest company from her bench under its ledge for sixty years
  nour: {
    id: 'nour', name: 'Nour', title: 'the eldest of Qanat', color: '#3b4f8a', voice: 0.72, kind: 'f', scale: 0.93,
    palette: { cloak: '#2f437a', lining: '#dcecf2', cloth: '#e2d3b4', legs: '#5a4a40', hat: '#f3ead8', hair: '#ece4d2' }, head: 'wrap', cape: 1.45, look: { mask: 'veil', prop: 'staff', robe: 0.06 },
    lines: ['~neutral~ Mind the chest, child.', '~tired~ Sixty years I have sat with it.', '~curious~ It hums more when you are near. Did you notice?'],
    talk: {
      entry: [
        { if: { quest: Q, done: true }, node: 'after' },
        { if: { flag: 'desert.tree.lit' }, node: 'drinking' },
        { if: { has: 'stone' }, node: 'stone' },
        { if: { flag: 'desert.spark.heard' }, node: 'sparkAgain' },
        { if: { flag: 'desert.channel.open' }, node: 'cold' },
        { if: { flag: 'desert.elder.heard' }, node: 'again' },
        { if: { flag: 'item.backpack' }, node: 'opened' },
        { node: 'shut' },
      ],
      nodes: {
        // before it opens
        shut: {
          say: ["~neutral~ Careful of the chest. I’m Nour. I’ve been keeping it company longer than you’ve been keeping your knees.", "~playful~ Never opened in living memory. The Speaker tried a knife when he was young. The chest won. We rarely mention it. Except to visitors.", "~solemn~ They say it opens for *one who fell from the sky*. At last, a qualification someone here may possess."],
          choices: [
            { text: '~playful~ I fell from the sky. This morning.', goto: 'fell' },
            { text: '~curious~ Who are the Givers?', goto: 'givers' },
            { text: '~sad~ Why is the tree so dark?', goto: 'dark' },
          ],
        },
        dark: {
          say: ["~sad~ The tree burns on living water. Or it did, until the singing light passed. The chest answered it all night. The tree’s fire went out.",
            '~solemn~ We have had dry years before. We have never had a cold one.'],
          choices: [{ text: '~playful~ I fell from the sky that night. Well, the morning after.', goto: 'fell' }, { text: '~curious~ Who are the Givers?', goto: 'givers' }],
        },
        fell: { say: ["~tired~ You certainly fell from the sky. We saw the smoke. And this chest sang the night before, as if it knew to expect you.", "~playful~ Climb the root to its ledge and try the chest. If it bites, we will both have learned something."], choices: [{ text: '~neutral~ (try the chest)', end: true }] },
        // it opened: the reaction (desert.js brings her over and opens this on her own)
        opened: {
          say: [
            { if: { flag: 'desert.shrine.gathered' }, text: "~surprised~ It opened! Sixty years I sat here. My mother before me. Not so much as a squeak until you arrived." },
            { if: { not: { flag: 'desert.shrine.gathered' } }, text: "~playful~ And you’re wearing its gift. Typical Givers. Centuries to prepare a surprise, no instructions attached." },
            "~solemn~ We thought *one who fell from the sky* was a riddle. Then the light sang, the chest answered, and you crashed. I dislike how neatly that fits.",
          ],
          choices: [
            { text: '~curious~ What is this thing on my back?', goto: 'pack' },
            { text: '~curious~ Who are the Givers?', goto: 'givers' },
            { text: '~scared~ My ship has no power. Can you help me?', goto: 'power' },
          ],
        },
        givers: {
          say: ["~solemn~ We call them *the Givers*. They made the giants walk and put this mark on their work. {glyph} Giants, carved stones, chests. Same signature.", "~solemn~ Nobody alive has seen one. We know their work: water, the giants that carried it, and *star-marked chests* left for travellers."],
          choices: [
            { text: '~curious~ Why a star?', goto: 'star' },
            { text: '~scared~ My ship has no power. Can you help me?', if: { flag: 'item.backpack' }, goto: 'power' },
            { text: '~playful~ I fell from the sky, you know.', if: { not: { flag: 'item.backpack' } }, goto: 'fell' },
          ],
        },
        star: { say: ["~sad~ A star is what a traveller looks like far away. A little light, a long way from home. A kind choice of label for a gift."], choices: [{ text: '~curious~ Are there other chests?', goto: 'others' }, { text: '~neutral~ My ship has no power.', if: { flag: 'item.backpack' }, goto: 'power' }, { text: '~neutral~ (back)', if: { not: { flag: 'item.backpack' } }, goto: 'givers' }] },
        others: { say: ["~solemn~ Look for *the star on old blue chests* wherever you travel. The Givers went much farther than our desert."], choices: [{ text: '~neutral~ My ship has no power.', if: { flag: 'item.backpack' }, goto: 'power' }, { text: '~neutral~ (back)', if: { not: { flag: 'item.backpack' } }, goto: 'givers' }] },
        struck: { say: ["~neutral~ Marrow saw the burn on your ship. Three dots over an arc. The Givers’ sign, left by the thing that struck you.", "~curious~ Perhaps the Singer is one of their machines. Perhaps it copies them. I don’t know, child. Age is not the same as access to the manual."], choices: [{ text: '~curious~ Who are the Givers?', goto: 'givers' }, { text: '~scared~ My ship has no power. Can you help me?', goto: 'power' }] },
        // the traveller's translator: she notices it (docs/story-bible.md, "The translator")
        ear: { say: ["~curious~ Your translator? I hear clicks and hums, then the little thing at your ear answers. Somehow we understand each other. A fine piece of listening.", "~playful~ Keep it safe. Everyone out here has something to say, and none of us says it quite like you."], choices: [{ text: '~angry~ I didn’t fall. Something struck my ship.', goto: 'struck' }, { text: '~scared~ My ship has no power. Can you help me?', goto: 'power' }] },
        pack: { say: [{ if: { flag: 'tool.empty' }, text: "~playful~ An empty tank! Sixty years guarding a jar with nothing in it. Hessa must never hear how I described that." },
          { if: { not: { flag: 'tool.empty' } }, text: "~playful~ Living water in Givers’ glass. Like the water the giants carried. I’d wager a tooth. I’m down to four, so take that seriously." },
          "~neutral~ *Stand in water to fill the backpack.* Its fluid can push things your arms cannot. First, we need to find the water."], choices: [{ text: '~curious~ How is it I understand you?', goto: 'ear' }, { text: '~scared~ My ship has no power. Can you help me?', goto: 'power' }] },
        power: {
          say: ["~solemn~ To power your ship, we need the tree’s living water and its fire. Both have failed us this year.", "~curious~ Perhaps that is why the chest opened now. We need someone who can go below and put things right. Conveniently, you need fuel."],
          choices: [
            { text: '~solemn~ Then I’ll find out why the water hasn’t risen.', goto: 'quest' },
            { text: '~sad~ Why me? I only want to get home.', goto: 'why' },
          ],
        },
        why: { say: ["~neutral~ You want to get home. I understand. Help us get our water back, and we’ll help you leave.", "~solemn~ Restore the tree’s water and fire. Then take some glowing water to your ship."], choices: [{ text: '~curious~ All right. Where do I start?', goto: 'quest' }] },
        quest: {
          say: ["~playful~ Three things first. I’ll say them slowly. For you, naturally.", "~neutral~ *Listen at the dry well beside the tree.* Hessa, my granddaughter, keeps it. Ask her about the sound below.", "~neutral~ Then get the drinking jar from Ama at the camp fires. After that, ask *the Speaker at the procession’s head* how to reach the water underground."],
          do: [{ set: { 'desert.elder.heard': true } }, { track: Q }],
          choices: [
            { text: '~neutral~ The well, Ama’s jar, the Speaker.', goto: 'go' },
            { text: '~scared~ And if the old words don’t help?', goto: 'down' },
          ],
        },
        go: { say: ["~playful~ That’s it. Well, jar, Speaker. Go on. The city is watching. Walking confidently will satisfy most of them."], choices: [{ text: '~happy~ Thank you, Nour.', end: true }] },
        down: { say: ["~solemn~ Look for the mark between the giant’s eyes beyond the back gate. Its open mouth leads below. Even the oldest verse should eventually give directions."], choices: [{ text: '~happy~ Thank you, Nour.', end: true }] },
        again: {
          say: ["~playful~ Listen at the well, get Ama’s jar, then speak to the procession leader. Come back if you need me to say it a third time."],
          choices: [
            { text: '~neutral~ Tell me about the Givers again.', goto: 'givers' },
            { text: '~neutral~ Goodbye, Nour.', end: true },
          ],
        },
        // the water is up, the well is full, and the tree is cold: the spark-stone (the second errand)
        cold: {
          say: ["~sad~ The water’s back. You did that. But the tree is cold. It needs its fire restored separately.",
            "~solemn~ My grandmother spoke of *a spark-stone*. The Givers first lit the tree with it. Ordinary flame won’t work. We need that stone.",
            "~curious~ It was returned to the Givers’ Hearth, a cave in the red rocks far south-east. Follow *the marked stones* to find it."],
          do: [{ set: { 'desert.spark.heard': true } }, { track: Q }],
          choices: [
            { text: '~curious~ How far is it?', goto: 'far' },
            { text: '~solemn~ I’ll bring the stone back.', goto: 'bring' },
          ],
        },
        far: { say: ["~playful~ Too far for a sensible walk. The old keepers took three days each way. I recommend a less historic method.", "~neutral~ Ask *Marrow at the camps* about *a hoverbike*. He’s been suspiciously pleased with something under a tarp."], choices: [{ text: '~solemn~ I’ll bring the stone back.', goto: 'bring' }] },
        bring: { say: ["~solemn~ Bring the spark-stone back and *place it in the full well*. And bring all your fingers. Legends are careless about fingers."], choices: [{ text: '~happy~ Thank you, Nour.', end: true }] },
        sparkAgain: {
          say: ["~neutral~ Get Marrow’s bike, then follow marked stones south-east to the red rocks. Find the spark-stone in *the Givers’ Hearth*."],
          choices: [{ text: '~neutral~ Tell me about the Givers again.', goto: 'givers' }, { text: '~neutral~ Goodbye, Nour.', end: true }],
        },
        stone: {
          say: ["~surprised~ The spark-stone. Warm. Real. My grandmother would have wanted to hold it.", "~solemn~ Put it into the well at the tree’s roots. Go on. I’ve spent enough of my life keeping things in boxes."],
          choices: [{ text: '~neutral~ (go to the well)', end: true }],
        },
        drinking: { say: ["~happy~ The chest opened, the water rose, the tree burns. I stayed alive long enough. *Take your jar to the ship*, child. Let an old woman have a moment."], choices: [{ text: '~happy~ Goodbye, Nour.', end: true }] },
        after: { say: ["~happy~ When another chest opens for you, think of us. Qanat will be here. Hessa will probably still be sweeping."], choices: [{ text: '~happy~ I will, Nour.', end: true }] },
      },
    },
  },

  hessa: {
    id: 'hessa', name: 'Hessa', title: 'keeper of the well', color: '#62c3c9', voice: 0.95, kind: 'f',
    palette: { cloak: '#62c3c9', lining: '#2b211f', cloth: '#f3ead8', legs: '#2b2f45', hat: '#f3ead8', hair: '#4a3226' }, head: 'hood', cape: 1.45, look: { prop: 'basket' },
    lines: ["~angry~ The well’s dry. The rim still needs looking after.", "~tired~ Sweep. Wait. Sweep what arrived while I waited.", "~neutral~ Read the stele. Stone gets interrupted less."],
    talk: {
      entry: [{ if: { flag: 'desert.tree.lit' }, node: 'burning' }, { if: { flag: 'desert.channel.open' }, node: 'full' }, { node: 'hello' }],
      nodes: {
        hello: {
          say: [{ if: { flag: 'desert.elder.heard' }, text: "~neutral~ Nour sent you? *Listen at the well’s rim.* There’s water below. Loudest after dark." }, "~tired~ Hessa. Keeper of the well. Usually the water rises through these roots and feeds the tree’s fire. This year I’m keeping dust.", "~solemn~ *The carved stele beside us* shows the giants carrying water to the tree. Useful history, if someone remembers the maintenance."],
          choices: [
            { text: '~curious~ Where does the water come from?', goto: 'from' },
            { text: '~curious~ What’s the mark above the carving?', goto: 'glyph' },
          ],
        },
        chest: {
          say: [{ if: { not: { flag: 'item.backpack' } }, text: "~playful~ *The Givers’ chest on the tree’s ledge.* Grandmother Nour keeps it; I keep the well. Both have become extremely quiet responsibilities." },
            { if: { not: { flag: 'item.backpack' } }, text: "~tired~ The chest started humming after the singing light passed. Grandmother says it’s expecting someone. I asked whether they’d bring water." },
            { if: { flag: 'item.backpack' }, text: "~playful~ Sixty years Grandmother waited. You arrive, it opens. She’ll be telling this story until the sun wears out." }],
          choices: [{ text: '~curious~ Where does the water come from?', goto: 'from' }, { text: '~happy~ Thank you, Hessa.', end: true }],
        },
        from: { say: ["~neutral~ The supply is *inside the giant*. Its head lies beyond the back gate. Old keepers used to *enter its mouth* and clear the water channel. Nobody’s done that in my lifetime."], choices: [{ text: '~surprised~ Through its mouth?', goto: 'mouth' }] },
        mouth: { say: ["~whisper~ Carved stones hold the jaw open. The children dare each other to touch the teeth. Please don’t add yourself to my list of worries."], choices: [{ text: '~playful~ I won’t.', end: true }] },
        glyph: { say: ["~neutral~ {glyph} We call it the Givers’ mark. Salt pilgrims call it the Eye That Fell. Children call it a bird. None of us knows who carved it first."], choices: [{ text: '~curious~ And what is up on the tree’s trunk?', goto: 'chest' }, { text: '~curious~ Where does the water come from?', goto: 'from' }] },
        full: { say: ["~happy~ Water! Through the roots, every colour! Look at my well. I’d forgotten how it could look.", "~sad~ But the tree is still cold. *Ask Nour about lighting it.* Grandmother has been waiting to explain something."], choices: [{ text: '~happy~ It was waiting for someone to clear the way.', end: true }] },
        burning: { say: ["~happy~ Fire from the roots to the crown! And it doesn’t burn the broom. I’m taking that as permission to put it down."], choices: [{ text: '~happy~ You’ve earned it, Hessa.', end: true }] },
      },
    },
  },

  marrow: {
    id: 'marrow', name: 'Marrow', title: 'salvager and liar', color: '#dca273', voice: 1.0, kind: 'm',
    palette: { cloak: '#dca273', lining: '#2b211f', cloth: '#34405e', legs: '#4a3a2a', hat: '#d8a24a', hair: '#2b211f' }, head: 'hat', cape: 0.9,
    lines: ["~shout~ Bones! Glass! Authenticated bits of sky!", "~playful~ Finders keepers. I find that very reasonable.", "~whisper~ Sky-person. Excellent timing. For me."],
    talk: {
      entry: [
        { if: { quest: 'desert.bike', stage: 'ask' }, node: 'bike' },
        { if: { quest: 'desert.bike', stage: ['find', 'wake'] }, node: 'bikeWhere' },
        { if: { all: [{ flag: 'desert.bike.found' }, { not: { flag: 'desert.marrow.bike' } }] }, node: 'bikeAfter' },
        { node: 'hello' },
      ],
      nodes: {
        hello: {
          say: ["~playful~ Sky-person! Marrow, salvager. I inspected your ship. Entirely professional curiosity. Please don’t count the loose screws while I’m here.", "~whisper~ There’s a mark burned into the hull. Three dots and an arc. {glyph} That didn’t come from landing in sand."],
          choices: [
            { text: '~curious~ What does it mean?', goto: 'mean' },
            { text: '~curious~ Got anything faster than walking?', if: { all: [{ quest: 'desert.bike', started: false }, { not: { flag: 'desert.bike.found' } }] }, goto: 'bike' },
            { text: '~angry~ Stay away from my ship.', end: true },
          ],
        },
        // the hoverbike (quest desert.bike): he found it, hid it, and can't start it
        bike: {
          say: ["~playful~ Faster than walking? You’ve come to the right liar. Specialist, I meant.",
            "~whisper~ A *hoverbike*, under a tarp in the hollow with the red rag. Between the camps and your ship. Its previous ownership is charmingly unclear.",
            "~sad~ It won’t run for me. Needs a fuel I don’t have. That tank of yours looks promising."],
          do: { stage: ['desert.bike', 'find'] },
          choices: [{ text: '~happy~ I’ll go and dig it out.', end: true }, { text: '~curious~ What do you want for it?', goto: 'price' }],
        },
        price: { say: ["~playful~ Free. It ate my tarp. Ride it past the camp occasionally so I can claim the success from a safe distance."], choices: [{ text: '~happy~ Deal.', end: true }] },
        bikeWhere: { say: ["~neutral~ Red-rag hollow, between camps and ship. Remove the tarp. Wake the bike with *a full fluid tank*."], choices: [{ text: '~neutral~ Thanks, Marrow.', end: true }, { text: '~curious~ What do you sell?', goto: 'sell' }] },
        bikeAfter: { say: ["~happy~ I heard it start! A kettle with ambitions. Look after it. I’m becoming attached to the idea that I helped."], do: { set: { 'desert.marrow.bike': true } }, choices: [{ text: '~playful~ It has opinions.', end: true }, { text: '~curious~ What do you sell?', goto: 'sell' }] },
        mean: { say: ["~solemn~ Same mark as the giants and old gates. I’ve found it on fallen sky-metal before. Yours is the first example still warm from arrival."], choices: [{ text: '~curious~ Things that fell before?', goto: 'before' }, { text: '~neutral~ Thanks, Marrow.', end: true }] },
        before: { say: ["~playful~ Humming glass. A bowl that rings alone. Things like that. I suspect the singing matters. Professional suspicion, complimentary today.",
          "~curious~ Also, my compass points at your ship now. Whatever made the scar magnetised the metal. That observation actually is free."], choices: [{ text: '~curious~ What do you sell, then?', goto: 'sell' }, { text: '~neutral~ Thanks, Marrow.', end: true }] },
        sell: { say: ["~playful~ Rumours. The giant’s holding its breath. The Speaker walks the wrong way. Your ship sneezed. Three prices, one standard of evidence."], choices: [{ text: '~tired~ I’ll pass.', end: true }] },
      },
    },
  },
};

// The scenery you can look at: same panel, a different voice.
export const THINGS = {
  well: {
    id: 'well', name: 'The dry well', title: 'at the tree’s roots', color: '#5a4a40', voice: 0.6,
    talk: {
      entry: [{ if: { flag: 'desert.tree.lit' }, node: 'burning' }, { if: { flag: 'desert.channel.open' }, node: 'full' }, { node: 'dry' }],
      nodes: {
        dry: {
          say: ["~neutral~ The well is dry. Far below, water is moving. It hasn’t reached the roots.", "~solemn~ Thick roots descend into the shaft. Carved figures around the rim *face the back gate*."],
          do: { set: { 'desert.well.seen': true } },
          choices: [{ text: '~neutral~ (look toward the back gate)', end: true }],
        },
        full: { say: ["~solemn~ Coloured water fills the well. The roots drink steadily.", "~sad~ The tree remains dark. Water alone hasn’t relit its fire."], choices: [{ text: '~neutral~ (watch it)', end: true }] },
        burning: { say: ["~solemn~ Cool flame travels from the full well up the roots and into the crown. Beneath the fire, the water is still cool to touch."], choices: [{ text: '~neutral~ (watch it)', end: true }] },
      },
    },
  },
  stele: {
    id: 'stele', name: 'The stele', title: 'carved stone', color: '#e9dcc0', voice: 0.6,
    talk: { nodes: { read: {
      say: ["~solemn~ Three giants carry jars toward a burning tree. Streams flow at their feet. Above them: {glyph}", "~curious~ A smaller figure follows, carrying a round light in both hands.", "~solemn~ Generations of fingers have worn the giants’ carved faces smooth."],
      do: { set: { 'desert.stele.read': true } }, choices: [{ text: '~neutral~ (step back)', end: true }],
    } } },
  },
  brow: {
    id: 'brow', name: 'The giant’s brow', title: 'the fallen giant', color: '#f2ead6', voice: 0.6,
    talk: { nodes: { look: {
      say: ["~solemn~ A house-sized skull, with {glyph} glowing faintly between its eyes.", "~whisper~ Carved stones hold its mouth open. Cool air comes from the passage between the teeth."],
      do: { set: { 'desert.brow.seen': true } }, choices: [{ text: '~neutral~ (go on)', end: true }],
    } } },
  },
  mural: {
    id: 'mural', name: 'The mural', title: 'in the giant’s chest', color: '#e9dcc0', voice: 0.6,
    talk: { nodes: { look: {
      say: ["~solemn~ The mural shows giants lying end to end. Streams run from their bodies toward a tree.", "~curious~ A record of the water’s route. Perhaps also instructions for keeping it flowing."],
      do: [{ set: { 'desert.mural.read': true } }, { keepsake: { id: 'desert.knowing', level: 'desert', name: 'What the giants left', kind: 'knowing', text: 'The giants carried the water. The tree drinks what they left.' } }],
      choices: [{ text: '~solemn~ (remember it)', end: true }],
    } } },
  },
  drumStuck: {
    id: 'drumStuck', name: 'Teo’s drum', title: 'under the old ribcage', color: '#c8483a', voice: 0.6,
    talk: { nodes: { look: {
      say: ["~neutral~ Teo’s red drum lies under the rib, its shell-ring dusty but intact.", "~neutral~ A fallen spinal bone pins it in place. Pulling won’t free it. *Move the bone sideways*, away from the drum."],
      choices: [{ text: '~neutral~ (step back)', end: true }],
    } } },
  },
  knuckle: {
    id: 'knuckle', name: 'A knuckle of bone', title: 'from the giant’s spine', color: '#f2ead6', voice: 0.6,
    talk: { nodes: { look: {
      say: ["~neutral~ A heavy round bone traps the drum against the rib behind it.", "~neutral~ *Push the bone from the side* to roll it clear: C, middle click or RB / R1. Pushing toward the rib would crush the drum."],
      choices: [{ text: '~neutral~ (step back)', end: true }],
    } } },
  },
  maskEyes: {
    id: 'maskEyes', name: 'The sleeping mask', title: 'in the southern dunes', color: '#f3ead8', voice: 0.55,
    talk: { nodes: { look: {
      say: ["~solemn~ Sand washes from the mask’s eyes. They have been staring at the sky longer than Qanat has stood.", "~whisper~ A glint inside each eye turns toward you."],
      choices: [{ text: '~solemn~ (look back at it)', end: true }],
    } } },
  },
  bone: {
    id: 'bone', name: 'The fallen rib', title: 'across the channel', color: '#f2ead6', voice: 0.6,
    talk: { nodes: { look: {
      say: ["~neutral~ A fallen rib blocks the dry channel. Behind it, a crack in the wall is damp. The water is trapped on the other side.", "~neutral~ Too heavy to lift. Find *the keepers’ pole by the mural* and lever it over the carved post. With a filled tank, *Push* also works: C, middle click or RB / R1."],
      choices: [{ text: '~neutral~ (step back)', end: true }],
    } } },
  },
  // the Givers' Hearth (src/desert-hearth.js, src/story/desert.js): the weight that lifts the grille, the grille itself
  weight: {
    id: 'weight', name: 'A stone ball', title: 'in a groove on a plinth', color: '#c9b8a0', voice: 0.6,
    talk: { nodes: { look: {
      say: ["~neutral~ A stone ball rests in a groove leading to a hole. A bronze chain connects the mechanism to the grille guarding the light.",
        "~neutral~ *Push the ball along the groove* with fluid: C, middle click or RB / R1."],
      choices: [{ text: '~neutral~ (step back)', end: true }],
    } } },
  },
  grille: {
    id: 'grille', name: 'The grille', title: 'in front of the glow', color: '#c9974a', voice: 0.6,
    talk: { nodes: { look: {
      say: ["~neutral~ The spark-stone glows behind a close-set stone grille.", "~curious~ A chain leads from the grille across the ceiling. Follow it to the mechanism that lifts the bars."],
      choices: [{ text: '~neutral~ (step back)', end: true }],
    } } },
  },
};

// What crowd people say when you stop beside them (balloons), and their
// short conversations (E) by where they are.
export const LINES = {
  procession: ['~solemn~ We walk the circuit until the tree drinks, and burns again.', '~shout~ Keep the step, stranger!', '~tired~ Seven times round, then seven again.', '~happy~ My grandmother walked this circuit. Hers too.', '~neutral~ The water rises from beneath the giants. Every year.', '~happy~ Listen to the drum. It keeps our feet together.', '~curious~ Are you here for the drinking?', '~angry~ Don’t stop in the middle, you’ll get trodden on.'],
  // the tree lit again (src/story/desert.js: the procession's lines once it burns)
  drinking: ['~shout~ It burns! It burns!', '~surprised~ Every colour! Look!', '~happy~ One more circuit, for joy!', '~playful~ I told you it would.', '~shout~ Sing, everyone!'],
  camp: ['~neutral~ Ama’s fires never go out. Not like some.', '~scared~ The tree went out. I never thought I’d see it.', '~curious~ Did you see the light that fell? It sang.', '~tired~ Eleven days we walked.', '~happy~ Sit, sit.', '~curious~ Who are you, then?', '~playful~ Sefa plays better when someone listens.'],
  gate: ['~neutral~ We wait here for the Speaker’s word.', '~sad~ The well is dry and the tree is cold. Imagine.', '~neutral~ Mind the steps, they’re older than the walls.'],
  // until the chest is open: everyone points the stranger on toward the city and the tree (desert.js mixes these in)
  waveOn: {
    camp: ['~shout~ The city’s that way, sky-stranger. *Under the big dark tree*!', '~happy~ Go on in! Nour will want to see you.', '~neutral~ Through the big gate and *up to the tree*.', "~surprised~ You’re from the ship? Nour’s chest has been humming since you arrived."],
    procession: ['~shout~ Qanat’s ahead, stranger, under the great tree!', '~angry~ Keep the step, or go on to the city. Not both!', '~solemn~ The tree is waiting. Something is.'],
    gate: ['~neutral~ Go on up to *the tree*. Something there is humming.', '~neutral~ Nour is up *under the tree*. Mind the steps.', '~happy~ Up the stairs, stranger. Everyone’s waiting to see.'],
  },
};

/** The people of Qanat who gather when the chest opens (desert.js places them; they share a short conversation). */
export const VILLAGERS = [
  { id: 'qanat.weaver', name: 'Tamra', title: 'a weaver of Qanat', kind: 'f', palette: { cloak: '#e88fa6', lining: '#2b211f', cloth: '#f3ead8', legs: '#4a3a2a', hat: '#f3ead8', hair: '#4a3226' }, head: 'wrap', cape: 0.9, lines: ['~curious~ Is it humming louder?', '~whisper~ Don’t touch it, they say.'] },
  { id: 'qanat.potter', name: 'Idris', title: 'a potter of Qanat', kind: 'm', palette: { cloak: '#dca273', lining: '#2b211f', cloth: '#5a4a3a', legs: '#2b2f45', hat: '#d8a24a', hair: '#2b211f' }, head: 'hat', cape: 0, lines: ['~solemn~ Sixty years Nour has sat there.', '~neutral~ Hm.'] },
  { id: 'qanat.boy', name: 'Kito', title: 'who follows Ilo about', kind: 'm', scale: 0.78, palette: { cloak: '#62c3c9', lining: '#2b211f', cloth: '#c8483a', legs: '#4a3a2a', hat: '#e6875f', hair: '#6e4a32' }, head: 'hair', cape: 0.55, lines: ['~curious~ Are you going to open it?', '~playful~ Ilo says you’re from the sky.'] },
  { id: 'qanat.baker', name: 'Lula', title: 'who bakes for the pilgrims', kind: 'f', palette: { cloak: '#f2c54b', lining: '#2b211f', cloth: '#5a4a3a', legs: '#2b2f45', hat: '#f3ead8', hair: '#b0a89a' }, head: 'hood', cape: 1.25, lines: ['~happy~ Flour on my hands, mind.', '~surprised~ The chest hummed when you came in.'] },
  { id: 'qanat.guard', name: 'Haro', title: 'who guards the steps', kind: 'm', palette: { cloak: '#8a6fb8', lining: '#2b211f', cloth: '#e2d3b4', legs: '#3a3a3a', hat: '#c8483a', hair: '#4a3226' }, head: 'hat', cape: 1.25, lines: ['~neutral~ Steady, stranger.', '~tired~ I only guard the steps.'] },
  { id: 'qanat.sweeper', name: 'Mim', title: 'who sweeps the terraces', kind: 'f', palette: { cloak: '#5fb7ad', lining: '#2b211f', cloth: '#f3ead8', legs: '#5a4a40', hat: '#f3ead8', hair: '#e8dcc0' }, head: 'wrap', cape: 1.45, lines: ['~tired~ Every day I sweep these steps.', '~surprised~ Look at the tree!'] },
];
/** What they say as they gather (balloons), and when the traveller first comes near the chest. */
export const MURMURS = {
  near: ['~whisper~ Look, the one from the sky-ball.', '~whisper~ It’s humming louder. Listen.', '~curious~ Is that the one who fell?', '~surprised~ The chest, listen to the chest!'],
  gather: ['~shout~ It opened!', '~surprised~ The Givers’ chest… it’s open!', '~shout~ Fetch Nour! Somebody wake Nour!', '~solemn~ For the sky-stranger. It opened for the sky-stranger.', '~playful~ Sixty years and it opens on a Tuesday.', '~curious~ Did you see the light come out?'],
  nour: ['~surprised~ Eh? What—', '~angry~ Let me through. Let an old woman through.', '~surprised~ It opened. It opened!', '~shout~ Come down, child! Come down and let an old woman look at you.'],
  // the spark-stone in the well: the tree catches (src/story/desert.js)
  lit: ['~shout~ It burns! It burns!', '~surprised~ Look at the colours!', '~happy~ It’s cool! The fire’s cool, feel it!', '~shout~ Ring the bells! Somebody ring the bells!', '~solemn~ It came back. It came back.', '~playful~ I said it would. I said so.'],
};
export const VILLAGER_TALK = {
  name: 'Someone from Qanat', title: 'of Qanat', color: '#e6875f', voice: 1.0,
  talk: { entry: [{ if: { flag: 'item.backpack' }, node: 'open' }, { node: 'shut' }], nodes: {
    shut: { say: ["~playful~ *The chest on the tree’s ledge.* Nour’s waited years to see it open. Climb up and try. At least it’ll give her something new to discuss."], choices: [{ text: '~neutral~ Thanks.', end: true }] },
    open: { say: ["~playful~ I was there when it opened! Nearby. Within hearing distance. My grandmother’s account puts her closer, and she was asleep."], choices: [{ text: '~happy~ (smile)', end: true }] },
  } },
};

/** Short conversations for people in the crowd, by where they stand. Picked by their seed. */
export const CROWD_TALK = {
  procession: [
    { name: 'A pilgrim', title: 'walking the circuit', talk: { nodes: {
      hello: { say: ["~neutral~ Walk with us. We circle Qanat until the tree drinks and burns again. Company makes the waiting easier."], choices: [{ text: '~curious~ Why walk round and round?', goto: 'why' }, { text: '~neutral~ Walk on.', end: true }] },
      why: { say: ["~solemn~ Seven circuits for every year it drank. We lost count. Now we walk so everyone knows we’re still waiting together."], choices: [{ text: '~neutral~ Walk on.', end: true }] },
    } } },
    { name: 'A banner bearer', title: 'in the procession', talk: { nodes: {
      hello: { say: ["~happy~ Eighty-year-old banner. Nine new cloths, two new poles. The important bit is apparently the carrying."], choices: [{ text: '~curious~ What’s on it?', goto: 'what' }, { text: '~neutral~ Walk on.', end: true }] },
      what: { say: ["~playful~ {glyph} The Givers’ mark. Father saw a giant looking up. Mother saw rain above a hill. Thirty years married, no shortage of conversation."], choices: [{ text: '~neutral~ Walk on.', end: true }] },
    } } },
    { name: 'A tired walker', title: 'in the procession', talk: { nodes: {
      hello: { say: ["~tired~ Eleven days across the dunes to a cold tree. Now more walking. My feet would like representation at the next decision."], choices: [{ text: '~curious~ What happens at the drinking?', goto: 'what' }, { text: '~neutral~ Walk on.', end: true }] },
      what: { say: ["~happy~ Water fills the roots, the tree burns in cool colours, and we share the drinking jar. Then songs until morning. Worth the sore feet."], choices: [{ text: '~neutral~ Walk on.', end: true }] },
    } } },
  ],
  drinking: [
    { name: 'A pilgrim', title: 'singing', talk: { nodes: { hello: { say: ["~happy~ Every colour! The tree burns! One more circuit. This one because I want to!"], choices: [{ text: '~happy~ Walk on.', end: true }] } } } },
  ],
  camp: [
    { name: 'A pilgrim', title: 'by the fire', talk: { nodes: {
      hello: { say: ["~happy~ Come to Ama’s fire. Reliable heat. A rare luxury this year."], choices: [{ text: '~curious~ Is something late?', goto: 'late' }, { text: '~neutral~ Thanks.', end: true }] },
      late: { say: ["~angry~ The water’s late, the festival’s late, and we’ll be late home. The sand, of course, arrived early."], choices: [{ text: '~neutral~ Thanks.', end: true }] },
    } } },
    { name: 'A trader', title: 'resting', talk: { nodes: {
      hello: { say: ["~surprised~ I heard the singing light the night before your ship fell. Like a wet finger round a bowl. The whole sky rang."], choices: [{ text: '~curious~ Where did it come down?', goto: 'where' }, { text: '~neutral~ Thanks.', end: true }] },
      where: { say: ["~whisper~ It never landed. Dipped low, turned, then climbed away. I watched until it vanished."], choices: [{ text: '~neutral~ Thanks.', end: true }] },
    } } },
    { name: 'A child', title: 'bored', talk: { nodes: {
      hello: { say: ["~tired~ Ilo promised to show me the giant’s teeth. Seen her? I should have asked whether she’d actually been there."], choices: [{ text: '~neutral~ I’ll keep an eye out.', end: true }] },
    } } },
  ],
  gate: [
    { name: 'A pilgrim', title: 'at the gate', talk: { nodes: {
      hello: { say: ["~scared~ We’re waiting for the Speaker to call us to the Drinking. Every year he calls. This year he keeps walking."], choices: [{ text: '~neutral~ Thanks.', end: true }] },
    } } },
  ],
};
