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
// for the listen-only talks of the people outside the quests (src/story/dialogue.js pickListen)
const LIT = { flag: 'desert.tree.lit' }, RISEN = { flag: 'desert.channel.open' }, DONE = { flag: 'world.desert.done' };
const TEMPLE = { flag: 'temple.desert.done' }, BACKPACK = { flag: 'item.backpack' };

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
    outro: 'The ship hums. The tree drank, and burns again, and so do you.',
    stages: [
      // the ship is dark and the traveller's back is bare: past the camps and the procession, into the city
      { id: 'city', text: 'The ship is dark. Walk to the city under the great dark tree', label: 'Qanat, under the dark tree', flag: 'desert.city.entered', at: 'cityGate' },
      // the makers' chest on its ledge up the great tree's trunk, beside the dry well (src/boxes/placements.js): the backpack
      { id: 'box', text: 'Something is humming on a ledge up the great tree’s trunk. Climb up to it', label: 'The ledge on the tree', flag: 'item.backpack', at: 'box.desert.backpack' },
      // Qanat gathers; Nour, the eldest, comes to see who opened it (src/story/desert.js, the reaction); the tank is empty
      { id: 'elder', text: 'The chest opened, and the tank in it is empty. Speak with Nour, the eldest of Qanat', label: 'Nour, the eldest', flag: 'desert.elder.heard', at: 'nour' },
      { id: 'well', text: 'Listen at the dry well, as Nour asked', label: 'The dry well', flag: 'desert.well.seen', at: 'well' },
      { id: 'ama', text: 'Ask Ama at the camp fires for the drinking jar', label: 'Ama, keeper of the fires', flag: 'desert.jar.given', at: 'ama' },
      { id: 'speaker', text: 'Find the Speaker at the head of the procession: the old words know the way down', label: 'The Speaker', flag: 'desert.speaker.heard', at: 'speaker' },
      { id: 'down', text: 'Find the way beneath the giant, outside the back gate', label: 'The giant’s skull', flag: 'desert.cave.seen', at: 'caveIn' },
      // the rib is far too heavy for arms and the tank is empty: the keepers' pole levers it off (src/story/desert.js);
      // a full tank (an older save) can still push it
      { id: 'channel', text: 'The pool is dry: a fallen rib blocks the channel, too heavy for your arms. Find a way to shift it', label: 'The blocked channel', flag: 'desert.channel.open', at: 'rib' },
      { id: 'fill', text: 'The pool is rising. Wade in: fill your empty tank, and Ama’s jar', label: 'The pool', flag: 'desert.jar.filled', at: 'pool' },
      // back in the city: the water climbs the roots and fills the well while you watch, and the tree stays cold
      { id: 'rise', text: 'The water is climbing the roots. Go back to the well at the tree’s foot', label: 'The well, filling', flag: 'desert.well.watched', at: 'well' },
      { id: 'spark', text: 'The tree drank, and stands cold. Ask Nour why it will not burn', label: 'Nour, the eldest', flag: 'desert.spark.heard', at: 'nour' },
      // the Givers' Hearth is far out in the red rocks: Marrow's hoverbike first (src/story/desert-bike.js)
      { id: 'bike', text: 'The Givers’ Hearth is farther than walking. Find something faster: Marrow, at the camps, hid a hoverbike', label: 'Something faster than walking', flag: 'desert.bike.found', at: 'bikeWay' },
      { id: 'hearth', text: 'Ride south-east to the Givers’ Hearth in the red rocks, from marked stone to marked stone', label: 'The Givers’ Hearth', flag: 'desert.hearth.seen', at: 'hearth' },
      // (src/desert-hearth.js: dark; the stone pulses behind a grille; a shove of fluid rolls the weight that lifts it)
      { id: 'stone', text: 'In the Hearth’s dark, the spark-stone glows behind a stone grille. Find what lifts it, and take the stone', label: 'The spark-stone', flag: 'desert.stone.taken', at: 'sparkStone' },
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
      { id: 'eyes', text: 'Sand has drifted over the mask’s eyes. Wash both clear before the wind fills them again (shoot: G, or left click while aiming)', label: 'The mask’s eyes', flag: 'desert.mask.eyes', at: 'maskEyes' },
    ],
  },
];

// ------------------------------------------------------------------ the people
// palettes: cloak / cloth / legs / hat / hair (buildCharacter + Humanoid)
export const PEOPLE = {
  ama: {
    id: 'ama', name: 'Ama', title: 'keeper of the fires', color: '#c8483a', voice: 1.05, kind: 'f',
    palette: { cloak: '#c8483a', lining: '#2b211f', cloth: '#5a4a3a', legs: '#2b2f45', hat: '#f3ead8', hair: '#2b211f' }, head: 'wrap', cape: 1.25,
    lines: ['~neutral~ Mind the sparks.', '~happy~ Sit, if you like. Fires are for everyone.', '~neutral~ The jar is for the drinking.'],
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
          say: ['~happy~ A stranger, walking in from where the sky-ball fell. Sit. Nobody goes thirsty at my fires.', '~neutral~ I am Ama. I keep the fires for the pilgrims while they walk the circuit.'],
          choices: [
            { text: '~neutral~ My ship has no power. I need to find some.', goto: 'early' },
            { text: '~curious~ What is that great dark tree?', goto: 'tree' },
          ],
        },
        early: {
          say: ['~playful~ Power? Not at my fires, sky-stranger. I only have fire, and these days that is more than the tree has.', '~neutral~ Go into *the city*, under the great tree, up *the steps to it*. *Old Nour* sits there, under a chest nobody can open, up on the trunk. It has been humming since the night the light sang. Whatever a sky-ball needs, she’ll know where to start.'],
          choices: [{ text: '~neutral~ I’ll go to the city.', end: true }, { text: '~curious~ Who are all these people?', goto: 'who' }],
        },
        sent: {
          say: ['~surprised~ Nour sent you? Then it’s serious. She hasn’t sent anyone anywhere since my wedding.', '~playful~ And you’re wearing the chest’s… whatever it is. An empty jar of glass, on your back. Well. It suits you.'],
          next: 'power',
        },
        who: {
          say: ['~neutral~ Pilgrims, from every oasis between here and the salt. Once a year we come to Qanat to watch the tree drink.', '~sad~ The water rises from beneath the giants, the tree’s fire turns cool and every colour, and we all drink from the same jar. This year we walked eleven days, and the water has not risen, and the fire is out.'],
          choices: [
            { text: '~curious~ Rises from where?', goto: 'giants' },
            { text: '~neutral~ I need power for my ship.', goto: 'early' },
          ],
        },
        tree: {
          say: ['~solemn~ The tree of Qanat. It always burned: my grandmother’s grandmother saw it burn. It ate nothing, it never fell. It burned on the water it drank.', '~sad~ The night the light went over singing, it went out. Like a lamp in a draught. Eleven days we walked to watch it drink, and we came to a cold tree.'],
          choices: [
            { text: '~curious~ And if it doesn’t?', goto: 'giants' },
            { text: '~neutral~ I need power for my ship.', goto: 'early' },
          ],
        },
        giants: {
          say: ['~neutral~ *Ask the Speaker*; he knows the old words. I only know the fires.', '~neutral~ He walks at *the head of the procession*. You’ll hear the drum before you see him.'],
          choices: [{ text: '~neutral~ I need power for my ship.', goto: 'early' }, { text: '~happy~ Thank you, Ama.', end: true }],
        },
        power: {
          say: ['~neutral~ Power. Hm. The only power in this desert is the water that makes the tree drink, and burn. When it rises, everything wakes: the fire, the people, the old stones.', '~happy~ Here. *The drinking jar*. If the water rises, fill it. We’ll need it for the drinking anyway, and maybe it will wake your ball too.', '~neutral~ *Find the Speaker*. If anyone knows the old way down to the water, it’s him.'],
          do: [{ give: 'jar' }, { set: { 'desert.jar.given': true } }],
          choices: [
            { text: '~curious~ Where is the Speaker?', goto: 'where' },
            { text: '~happy~ I’ll bring it back full.', end: true },
          ],
        },
        where: { say: ['~neutral~ Walking the circuit round the walls, like everyone. *Follow the banners*. Listen for the drum.'], choices: [{ text: '~curious~ Who is that boy staring at the fire?', if: { quest: 'desert.drum', started: false }, goto: 'teo' }, { text: '~happy~ Thank you.', end: true }] },
        again: {
          say: [{ if: { has: 'water' }, text: '~happy~ Your jar is heavy. Full? Then go, wake your ball. And thank you.' }, { if: { not: { has: 'water' } }, text: '~neutral~ Still looking? The Speaker walks the circuit. *The giant’s head* is out past *the back gate*.' }],
          choices: [
            { text: '~curious~ Have you seen anything strange lately?', goto: 'rumour', once: true },
            { text: '~happy~ See you, Ama.', end: true },
          ],
        },
        rumour: { say: ['~playful~ Strange? A ball fell out of the sky with someone in it. That will do for this year.', '~playful~ Old Oum says she saw a light go over the night before. She saw it sing, she says. Oum sees a lot of things.'], choices: [{ text: '~curious~ Where is Oum?', goto: 'oum' }, { text: '~neutral~ Thanks.', end: true }] },
        oum: { say: ['~tired~ Behind, as always. She fell behind the procession somewhere in *the western dunes*. Someone should fetch her, but nobody wants to lose their place in the circuit.'], do: { start: 'desert.oum' }, choices: [{ text: '~neutral~ I’ll look for her.', end: true }] },
        teo: { say: ['~sad~ Teo, our drummer. The wind took his drum on the way here, and he took his face off with it. Talk to him; it might help.'], choices: [{ text: '~neutral~ I will.', end: true }] },
        // the water is up, the tree drank, and it is still cold
        drank: {
          say: ['~surprised~ The water rose! Hessa says the well is brimming. And the tree is still cold. I took a torch to it myself: the bark only hissed at me.', '~neutral~ *Fill the jar*, if you haven’t. And ask Nour what the tree wants. She always knows. It’s very annoying.'],
          choices: [{ text: '~neutral~ It was a bone in the channel. A giant’s rib.', goto: 'rib' }, { text: '~neutral~ I’ll ask her.', end: true }],
        },
        // the spark-stone lit it
        drinking: {
          say: ['~happy~ It burns! Look at it, every colour. I knew you were good luck the moment you fell on us.', '~neutral~ Your jar is glowing too. Go and wake your ball.'],
          choices: [{ text: '~neutral~ It was a stone from the Givers’ Hearth.', goto: 'stone' }, { text: '~neutral~ I will.', end: true }],
        },
        stone: { say: ['~surprised~ From the red rocks? On that bike of Marrow’s? Don’t tell him it was useful. He’ll put the price up on everything.'], choices: [{ text: '~happy~ Goodbye, Ama.', end: true }] },
        rib: { say: ['~solemn~ A rib. The giant is still breaking, then, even asleep under us. The Speaker will want a word for that.'], choices: [{ text: '~neutral~ Goodbye, Ama.', end: true }] },
        after: {
          say: ['~playful~ The pilgrims will walk home singing about the stranger who woke the water. They’ll get it all wrong. That’s how songs work.'],
          choices: [{ text: '~happy~ Keep the fires going, Ama.', end: true }],
        },
      },
    },
  },

  teo: {
    id: 'teo', name: 'Teo', title: 'a drummer without a drum', color: '#e6875f', voice: 1.25, kind: 'm',
    palette: { cloak: '#e6875f', lining: '#2b211f', cloth: '#3f6f6a', legs: '#4a3a2a', hat: '#d8a24a', hair: '#4a3226' }, head: 'hair', cape: 0,
    lines: ['~sad~ …', '~sad~ Nobody keeps time like a drum.', '~angry~ Hands, no drum. Useless hands.'],
    talk: {
      entry: [
        { if: { quest: 'desert.drum', done: true }, node: 'after' },
        { if: { has: 'drum' }, node: 'back' },
        { if: { quest: 'desert.drum', active: true }, node: 'waiting' },
        { node: 'hello' },
      ],
      nodes: {
        hello: {
          say: ['~sad~ Don’t mind me. I’m just a drummer with nothing to drum.', '~sad~ The wind took it. Eleven days walking and on the last night a gust lifted my drum off the camel and rolled it away like a wheel. *Under the old bones, south of here.* By the time I ran after it, it was dark.'],
          choices: [
            { text: '~happy~ I’ll look for it.', do: { start: 'desert.drum' }, goto: 'thanks' },
            { text: '~curious~ Can’t you play something else?', goto: 'else' },
          ],
        },
        else: { say: ['~angry~ Sefa says I can tap on a jar. A jar! The procession walks to the drum. Without it they walk out of step and step on each other’s heels.'], choices: [{ text: '~neutral~ I’ll look for your drum.', do: { start: 'desert.drum' }, goto: 'thanks' }, { text: '~neutral~ Bye.', end: true }] },
        thanks: { say: ['~surprised~ Really? It’s *red, with a ring of shells*. *Under the great ribcage, south*, past the place where your ball fell. Probably full of sand.'], choices: [{ text: '~happy~ I’ll bring it back.', end: true }] },
        waiting: { say: ['~neutral~ *South, under the ribcage of the old beast.* Red, with shells. You can’t miss it, unless the wind moved it again.'], choices: [{ text: '~neutral~ On my way.', end: true }] },
        back: {
          say: ['~surprised~ That’s… that’s it! Sand in the shells and all.', '~happy~ Listen. Listen to this.'],
          do: [{ take: 'drum' }, { advance: 'desert.drum' }, { set: { 'desert.teo.drumming': true } },
            { keepsake: { id: 'desert.song', level: 'desert', name: 'Teo’s walking rhythm', kind: 'song', text: 'Dum, tek-dum. The rhythm a whole procession walks to. Teo says it is older than the city.' } }],
          next: 'played',
        },
        played: { say: ['~happy~ That’s the walking rhythm. Every pilgrim’s feet know it. Take it with you, it doesn’t get smaller for being shared.'], choices: [{ text: '~happy~ Thank you, Teo.', end: true }] },
        after: { say: ['~happy~ Dum, tek-dum. Can you hear how the circuit keeps step again?'], choices: [{ text: '~happy~ I can.', end: true }] },
      },
    },
  },

  sefa: {
    id: 'sefa', name: 'Sefa', title: 'oud player', color: '#8a6fb8', voice: 0.95, kind: 'f',
    palette: { cloak: '#8a6fb8', lining: '#2b211f', cloth: '#e2d3b4', legs: '#2b2f45', hat: '#62c3c9', hair: '#2b211f' }, head: 'hair', cape: 0.55,
    lines: ['~happy~ ♪', '~happy~ Stay a while. The song’s better with a listener.', '~curious~ You walk like you’re carrying something.'],
    talk: { listen: [
      ['~playful~ You stopped to listen. Most people walk past musicians as if we were weather.', '~whisper~ I play what the listener is missing. Hear that? That’s your tune, not mine. You brought it with you.'],
      '~sad~ Everyone has a tune. Yours is a long way from home, and it keeps looking over its shoulder.',
      '~playful~ When the tree drinks we play all night, every song we know. Bako cries every year, and says it’s the smoke.',
      '~whisper~ Shh. This is the good bit.',
      { after: RISEN, if: { not: LIT }, say: '~sad~ The water’s up, and the tree is still cold. I’ve been playing it something warm. It doesn’t seem to listen.' },
      { after: LIT, say: '~happy~ Can you hear it? The tree is burning, and the songs are all coming back at once.' },
      { after: DONE, say: '~playful~ I made a song about you. It’s terrible. Everyone is singing it.' },
    ] },
  },

  bako: {
    id: 'bako', name: 'Bako', title: 'ney player', color: '#5fb7ad', voice: 0.75, kind: 'm',
    palette: { cloak: '#5fb7ad', lining: '#2b211f', cloth: '#5a4a3a', legs: '#3a3a3a', hat: '#f3ead8', hair: '#b0a89a' }, head: 'hat', cape: 0,
    lines: ['~tired~ Hm.', '~happy~ Hmmm-hm.', '~neutral~ (he hums)'],
    talk: { listen: [
      '~neutral~ Hm. You’re the one from the ball. The ball with the burn on it.',
      ['~curious~ Three dots over a curve, on your ball. {glyph} Like between the giant’s eyes, out past the back gate.', '~playful~ Somebody signs their work. If I knew who, I wouldn’t need a flute. Hm-hm.'],
      { say: ['~neutral~ A ney. Reed from the oasis at the salt. It only knows one song, and every year it plays it differently.', '~happy~ (He plays it for you.)'], do: { emit: ['music:solo', { who: 'bako' }] } },
      { if: { not: RISEN }, say: '~whisper~ Old keepers’ saying: where the giant’s eyes are marked, its mouth is a door. Hm.' },
      '~tired~ Hm. (He shuts his eyes. That is the end of the conversation.)',
      { after: DONE, say: '~happy~ Hm! (He plays something that sounds very much like a ball falling out of the sky, and laughs.)', do: { emit: ['music:solo', { who: 'bako' }] } },
    ] },
  },

  ilo: {
    id: 'ilo', name: 'Ilo', title: 'too curious', color: '#f2c54b', voice: 1.7, kind: 'f', scale: 0.7,
    palette: { cloak: '#f2c54b', lining: '#2b211f', cloth: '#c8483a', legs: '#4a3a2a', hat: '#e6875f', hair: '#6e4a32' }, head: 'hair', cape: 0.55,
    lines: ['~curious~ Are you from the sky?', '~sad~ I’m not allowed past the back gate.', '~playful~ Bet you can’t catch me!'],
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
          say: ['~surprised~ You fell out of the sky! I saw! Did it hurt? Is it hot inside the ball? Do you have a mother?', '~whisper~ Listen. I know a secret. The giant outside *the back gate* has *its mouth open*, and the old people go in, and they come out wet. Wet! In the desert!', '~sad~ I want to see. But I’m not allowed past the back gate. Not alone.'],
          choices: [
            { text: '~neutral~ Come with me, then. Stay close.', do: [{ start: 'desert.ilo' }, { set: { 'desert.ilo.following': true } }], goto: 'yes' },
            { text: '~curious~ Wet? Where exactly?', goto: 'where' },
          ],
        },
        where: { say: ['~happy~ In its mouth! *Under the giant’s head, outside the back gate*. The one with the three-dot mark on its forehead.'], choices: [{ text: '~neutral~ Come with me, then.', do: [{ start: 'desert.ilo' }, { set: { 'desert.ilo.following': true } }], goto: 'yes' }, { text: '~neutral~ Better ask your parents.', goto: 'parents' }] },
        parents: { say: ['~angry~ My mother is walking the circuit. She’ll walk until the tree drinks. That could be FOREVER.'], choices: [{ text: '~neutral~ All right. Come with me.', do: [{ start: 'desert.ilo' }, { set: { 'desert.ilo.following': true } }], goto: 'yes' }, { text: '~sad~ Sorry, Ilo.', end: true }] },
        yes: { say: ['~happy~ Yes! Yes yes. I’ll be quiet. I’m very quiet. Go, go!'], choices: [{ text: '~neutral~ (go)', end: true }] },
        come: { say: ['~happy~ Keep going! The back gate is *through the city, past the tree*. I’m right behind you.'], choices: [{ text: '~neutral~ (go)', end: true }] },
        go: { say: ['~playful~ I’ll wait right here, on the lip. Somebody has to keep watch. Go on, go down! Then tell me everything.'], choices: [{ text: '~neutral~ I’ll be back.', end: true }] },
        tell: {
          say: ['~curious~ You went! What’s down there? Tell me tell me tell me.'],
          choices: [
            { text: '~solemn~ A pool of water in every colour, inside the giant’s chest. The tree’s roots drink from it.', if: { flag: 'desert.channel.open' }, do: [{ advance: 'desert.ilo' }, { set: { 'desert.ilo.told': 'true' } }], goto: 'truth' },
            { text: '~solemn~ A pool inside the giant’s chest, dry as the well, and a fallen rib across the channel. The tree’s roots hang into it, waiting.', if: { not: { flag: 'desert.channel.open' } }, do: [{ advance: 'desert.ilo' }, { set: { 'desert.ilo.told': 'true' } }], goto: 'truth' },
            { text: '~playful~ A sleeping monster. It sniffed me.', do: [{ advance: 'desert.ilo' }, { set: { 'desert.ilo.told': 'monster' } }], goto: 'monster' },
            { text: '~whisper~ It’s a secret. You’ll see it yourself when you’re older.', do: [{ advance: 'desert.ilo' }, { set: { 'desert.ilo.told': 'secret' } }], goto: 'secret' },
          ],
        },
        truth: { say: ['~surprised~ Inside the giant… so the giant is the well. The giant IS the well! I’m going to draw it. I’m going to draw it on everything.'], choices: [{ text: '~happy~ (smile)', end: true }] },
        monster: { say: ['~shout~ I KNEW it. I knew it! I’m telling everyone. I’m telling the Speaker!'], choices: [{ text: '~scared~ (oh no)', end: true }] },
        secret: { say: ['~angry~ Hmph. Fine. But I’m going to be older really soon.'], choices: [{ text: '~happy~ (laugh)', end: true }] },
        after: { say: [{ if: { flag: 'desert.ilo.told', is: 'monster' }, text: '~angry~ Nobody believes me about the monster. They will.' }, { if: { not: { flag: 'desert.ilo.told', is: 'monster' } }, text: '~playful~ When I’m big I’ll go down there myself. Then I’ll tell YOU things.' }], choices: [{ text: '~happy~ I’d like that.', end: true }] },
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
          say: ['~solemn~ Walk with me a moment; the circuit doesn’t stop for strangers. Though for you, it seems, it does.', '~neutral~ You came down after the singing light. Go to Qanat, under the great tree, and up *the steps to it*. *Nour, our eldest*, keeps a chest there that has hummed every night since. When it is quiet again, come and walk with me.'],
          choices: [{ text: '~neutral~ I’ll go to the city.', end: true }, { text: '~curious~ Why do you walk round and round?', goto: 'hello' }],
        },
        hello: {
          say: ['~solemn~ Walk with me a moment; the circuit doesn’t stop for strangers. Though for you, it seems, it does.', '~sad~ You want to know why we walk. Everyone asks. We walk because the tree is thirsty, and cold, and walking is the only thing we know how to do about it.'],
          choices: [
            { text: '~curious~ Why is the tree cold?', if: { not: { flag: 'desert.elder.heard' } }, goto: 'old' },
            { text: '~neutral~ Nour says the old words know the way down to the water.', if: { flag: 'desert.elder.heard' }, goto: 'old' },
            { text: '~neutral~ Walk on, Speaker.', end: true },
          ],
        },
        old: {
          say: ['~solemn~ The old words say: *the giants came down from the swamp of lights, carrying the water, and walked until they could not.* Where they lay down, the water stayed in them.', '~solemn~ One of them lies beneath Qanat. The tree grows from its heart. Once a year the water rises in it, through the roots, up to the well, and the tree drinks, and its fire burns cool and in every colour.', '~sad~ This year it hasn’t. And the night the light sang over us, the fire went out. Either the tree has stopped wanting, or the giant has stopped giving. The old words don’t say which is worse.'],
          do: { set: { 'desert.speaker.heard': true } },
          choices: [
            { text: '~curious~ Is there a way down to the water?', goto: 'way' },
            { text: '~scared~ What happens if it never drinks?', goto: 'never' },
          ],
        },
        way: {
          say: ['~solemn~ There is a line nobody sings any more, because nobody knows what it means: “*Where the giant’s eyes are marked, its mouth is a door.*”', '~playful~ The giant’s head lies *outside the back gate*, face down in the sand, with the Givers’ mark between its eyes. *Its jaw is propped open* with carved stones. Make of that what you can, little star. I am too old to fit.'],
          choices: [{ text: '~neutral~ I’ll go and look.', end: true }, { text: '~curious~ The swamp of lights?', goto: 'swamp' }],
        },
        well: { say: ['~neutral~ At the well, in the tree’s roots, inside the walls. It’s dry as a bone. The old people once went down to the water itself, *beneath the giant*. Nobody remembers the way. Or nobody admits it.'], choices: [{ text: '~curious~ Is there a way down?', goto: 'way' }, { text: '~curious~ The swamp of lights?', goto: 'swamp' }] },
        swamp: { say: ['~curious~ A place of glowing water and plants that sing. Far, very far; farther than walking. Maybe you’ve flown over it, in your ball.'], do: { set: { 'clue.desert.perdide': true } }, choices: [{ text: '~neutral~ Not yet.', goto: 'well' }] },
        never: { say: ['~tired~ Then we walk until we forget why. Then we keep walking anyway, because by then the walking is the reason.'], choices: [{ text: '~curious~ Where does the water come up?', goto: 'well' }] },
        again: {
          say: ['~neutral~ Still here, little star? The well is at the tree’s roots. Beyond the back gate, *the giant’s head* watches the dunes. Make of that what you can.'],
          choices: [
            { text: '~neutral~ Tell me the line about the giant’s mouth again.', goto: 'way' },
            { text: '~curious~ Have you seen an old woman who fell behind?', if: { quest: 'desert.oum', done: false }, goto: 'oum' },
            { text: '~curious~ Have you heard of a masked head in the sand?', if: { all: [{ quest: 'desert.oum', done: true }, { quest: 'desert.mask', started: false }] }, goto: 'mask' },
            { text: '~neutral~ Walk on, Speaker.', end: true },
          ],
        },
        oum: { say: ['~playful~ Oum. She walks the circuit at her own pace, which is no pace at all. *West, in the dunes.* Bring her if you can; the drinking needs everyone.'], do: { start: 'desert.oum' }, choices: [{ text: '~curious~ And a masked head in the sand?', if: { quest: 'desert.mask', started: false }, goto: 'mask' }, { text: '~neutral~ I’ll find her.', end: true }] },
        mask: { say: ['~solemn~ *The sleeping face, south, past the bones.* Another giant, they say, who lay down face up so it could watch the sky. It does not wake. Go and look at it, if you like being looked at.'], do: { start: 'desert.mask' }, choices: [{ text: '~neutral~ I will.', end: true }] },
        // the water is up and the tree is cold: the second old line
        cold: {
          say: ['~solemn~ The water rose and the tree drank, and it does not burn. There is an old line for that too, little star: “*The fire was carried, and the fire must be carried.*”',
            '~neutral~ The fire-bearers walked *south-east, to the red rocks*, and set marked stones along the way so the next ones would not get lost. Some still stand. *Nour* knows the rest; she has always known more than she says.'],
          choices: [{ text: '~neutral~ A rib had fallen across the water.', goto: 'rib' }, { text: '~neutral~ Walk on, Speaker.', end: true }],
        },
        carried: { say: ['~surprised~ That light in your hands. The fire that was carried. Walk on, little star; *the well is waiting*. I will keep the step for you.'], choices: [{ text: '~neutral~ Walk on, Speaker.', end: true }] },
        drinking: {
          say: ['~happy~ It burns. It burns! Listen: every drum in the circuit has found the same step.', '~solemn~ You went beneath the giant, and out to the red rocks. I can see the colours on your hands. Don’t tell me what you saw. I’d rather keep the old words a little longer.'],
          choices: [{ text: '~neutral~ A rib had fallen across the water.', goto: 'rib' }, { text: '~whisper~ Your secret is safe.', end: true }],
        },
        rib: { say: ['~solemn~ Then the giant is still dying, slowly, under our feet. And still giving. That’s a word I’ll add to the old ones.'], choices: [{ text: '~neutral~ Walk on, Speaker.', end: true }] },
        after: { say: ['~solemn~ When you’re far away and someone asks what the desert gave you, say: water, a jar, a step to walk to. Don’t say power. It sounds so small.'], choices: [{ text: '~solemn~ I’ll remember.', end: true }] },
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
          say: ['~playful~ Ah. Someone who walks faster than me. That’s everyone, child; don’t look so pleased.', '~playful~ I fell behind the circuit. Then I fell behind the people who fell behind. Now I’m behind nobody. That’s a kind of first place.'],
          choices: [
            { text: '~happy~ Walk with me to the camps. I’ll go slowly.', do: [{ start: 'desert.oum' }, { stage: ['desert.oum', 'lead'] }, { set: { 'desert.oum.following': true } }], goto: 'yes' },
            { text: '~curious~ Ama says you saw a light go over.', goto: 'light' },
          ],
        },
        light: {
          say: ['~solemn~ I did. The night before your ball came down. A light crossed the whole sky, slow, and it sang. Like a bowl you strike with a stone, but long, long.', '~whisper~ Then it turned. Stars don’t turn, child. Under it, the tree of Qanat went dark, like a lamp somebody blew out. And in the morning your ball came down after it, burning.'],
          do: { set: { 'desert.rumour.light': true } },
          choices: [{ text: '~neutral~ It struck my ship.', goto: 'struck' }, { text: '~neutral~ Walk with me to the camps.', do: [{ start: 'desert.oum' }, { stage: ['desert.oum', 'lead'] }, { set: { 'desert.oum.following': true } }], goto: 'yes' }],
        },
        struck: { say: ['~playful~ Then it was looking for you, or you were in its way. Either is a story. Let me lean on your arm and I’ll tell you which I prefer.'], choices: [{ text: '~happy~ Come, then.', do: [{ start: 'desert.oum' }, { stage: ['desert.oum', 'lead'] }, { set: { 'desert.oum.following': true } }], goto: 'yes' }] },
        yes: { say: ['~playful~ Slowly, mind. If you run, I’ll sit down and you can come back for me.'], choices: [{ text: '~neutral~ (walk slowly)', end: true }] },
        walking: { say: ['~curious~ We’re going the right way, I hope? I can smell Ama’s fires. She burns too much thornwood.'], choices: [{ text: '~happy~ Not far now.', end: true }] },
        home: {
          say: ['~happy~ Look at that. A seat by the fire and a stranger to thank. Here, take this cord. One knot for every circuit I walked. I lost count at forty.'],
          do: [{ give: 'cord' }, { set: { 'desert.oum.thanked': true } }],
          next: 'home2',
        },
        home2: { say: ['~solemn~ When you meet that singing light again, and you will, ask it why it turned.'], choices: [{ text: '~happy~ I will, Oum.', end: true }] },
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
          say: ['~neutral~ Mind the chest, stranger. It belongs to the Givers, and they have not come back for it.', '~playful~ It has not opened for anyone in living memory. Not for me, not for my mother, not for the Speaker, who tried with a knife when he was young and foolish, which was a long time ago.', '~solemn~ The old words say it opens only for “*one who fell from the sky*”.'],
          choices: [
            { text: '~playful~ I fell from the sky. This morning.', goto: 'fell' },
            { text: '~curious~ Who are the Givers?', goto: 'givers' },
            { text: '~sad~ Why is the tree so dark?', goto: 'dark' },
          ],
        },
        dark: {
          say: ['~sad~ It went out. Its fire is the water it drinks, burning; it had burned since before there was a city round it. The night the light crossed the sky singing, the chest sang back, and the tree went out like a lamp in a draught.',
            '~solemn~ We have had dry years before. We have never had a cold one.'],
          choices: [{ text: '~playful~ I fell from the sky that night. Well, the morning after.', goto: 'fell' }, { text: '~curious~ Who are the Givers?', goto: 'givers' }],
        },
        fell: { say: ['~tired~ So you did. The whole desert saw the smoke. And the night before, a light crossed the sky singing, and this chest sang back all night long. I did not sleep. Neither did it.', '~playful~ Well. Go on, then. *Climb up and try it*. If it bites you, I will say I warned you.'], choices: [{ text: '~neutral~ (try the chest)', end: true }] },
        // it opened: the reaction (desert.js brings her over and opens this on her own)
        opened: {
          say: [
            { if: { flag: 'desert.shrine.gathered' }, text: '~surprised~ It opened. It opened! Sixty years I have sat under that chest, and my mother before me, and it never once so much as creaked.' },
            { if: { not: { flag: 'desert.shrine.gathered' } }, text: '~playful~ The chest stands open, and empty, and you climb down wearing what was in it. So. It opened for you, and nobody was there to see. That is just like the Givers.' },
            '~solemn~ The old words say: “The Givers’ chest opens for one who fell from the sky.” We took it for a riddle. Then a light crossed the sky singing, the chest hummed all night, and in the morning your ball came down burning.',
          ],
          choices: [
            { text: '~curious~ What is this thing on my back?', goto: 'pack' },
            { text: '~curious~ Who are the Givers?', goto: 'givers' },
            { text: '~scared~ My ship has no power. Can you help me?', goto: 'power' },
          ],
        },
        givers: {
          say: ['~solemn~ The ones who made the giants walk. Everything they made, they marked: three dots over an arch. {glyph} On the giants’ brows, on the stele, on that chest.', '~solemn~ Nobody has seen a Giver. We have only what they left behind, and what they left behind is mostly gifts: the water, the giants who carried it, and *chests with a star on the lid*, for travellers who would come a long way after them.'],
          choices: [
            { text: '~curious~ Why a star?', goto: 'star' },
            { text: '~scared~ My ship has no power. Can you help me?', if: { flag: 'item.backpack' }, goto: 'power' },
            { text: '~playful~ I fell from the sky, you know.', if: { not: { flag: 'item.backpack' } }, goto: 'fell' },
          ],
        },
        star: { say: ['~sad~ Because that is what a traveller looks like from far off: a small light, a long way from home. The chest waits for one. You look like one, too. Lost, and shining a little.'], choices: [{ text: '~curious~ Are there other chests?', goto: 'others' }, { text: '~neutral~ My ship has no power.', if: { flag: 'item.backpack' }, goto: 'power' }, { text: '~neutral~ (back)', if: { not: { flag: 'item.backpack' } }, goto: 'givers' }] },
        others: { say: ['~solemn~ The old words say the Givers walked further than the desert, further than walking. If there are other places, there are other chests, wherever their giants lay down. *Look for the star*. It looks for you, too.'], choices: [{ text: '~neutral~ My ship has no power.', if: { flag: 'item.backpack' }, goto: 'power' }, { text: '~neutral~ (back)', if: { not: { flag: 'item.backpack' } }, goto: 'givers' }] },
        struck: { say: ['~neutral~ Struck, fell. The sky does not care which. Marrow says there is a mark burned on your ball: three dots over an arch. The Givers’ mark.', '~curious~ Whatever struck you knew their sign. Or it was one of their gifts, too, and lost its way. I am too old to know which, and too curious to stop wondering.'], choices: [{ text: '~curious~ Who are the Givers?', goto: 'givers' }, { text: '~scared~ My ship has no power. Can you help me?', goto: 'power' }] },
        // the traveller's translator: she notices it (docs/story-bible.md, "The translator")
        ear: { say: ['~curious~ Do you? I hear you, child: clicks and hums, like a pot coming to the boil. Then that little thing at your ear hums back at me, and somehow we both know what was meant.', '~playful~ Your people made a thing that listens for you. The Givers would have liked them. Keep it close. Out here everybody talks, and nobody talks like you.'], choices: [{ text: '~angry~ I didn’t fall. Something struck my ship.', goto: 'struck' }, { text: '~scared~ My ship has no power. Can you help me?', goto: 'power' }] },
        pack: { say: [{ if: { flag: 'tool.empty' }, text: '~playful~ A tank, of the Givers’ glass. And empty as my purse. Sixty years I guarded an empty jar. Don’t tell Hessa.' },
          { if: { not: { flag: 'tool.empty' } }, text: '~playful~ A tank of living water. Look at it move. The same water the giants carried, I would wager my teeth, and I have four left.' },
          '~neutral~ The Givers made it to be worn, and to be filled. *Where the water is, it fills*, and then it will push what your arms cannot. *Find the water first*, child.'], choices: [{ text: '~curious~ How is it I understand you?', goto: 'ear' }, { text: '~scared~ My ship has no power. Can you help me?', goto: 'power' }] },
        power: {
          say: ['~solemn~ Power. For your ball. Hm. In this desert there is one power: the water that rises under the tree once a year, and makes it drink, and burn. When it rises, everything wakes: the fire, the people, the old stones.', '~curious~ This year it has not risen, the tree has gone cold, and the pilgrims walk round and round the walls, waiting. Perhaps the chest knew. Perhaps it opened now because the water needs someone to fetch it.'],
          choices: [
            { text: '~solemn~ Then I’ll find out why the water hasn’t risen.', goto: 'quest' },
            { text: '~sad~ Why me? I only want to get home.', goto: 'why' },
          ],
        },
        why: { say: ['~neutral~ Everyone who comes a long way only wants to get home. That is how you can tell they came a long way.', '~solemn~ *Wake the water* and your ball wakes with it. Then go home, if home is still where you want to go.'], choices: [{ text: '~curious~ All right. Where do I start?', goto: 'quest' }] },
        quest: {
          say: ['~playful~ Good. Listen, then. I am old, so I will say it once, and twice if you look lost.', '~neutral~ *Listen at the well* first, there, at the roots. Put your ear to the rim. Hessa, my granddaughter, will tell you what she hears every night.', '~neutral~ Then go out to *Ama at the fires* and ask her for *the drinking jar*: if the water rises, someone must carry it. And walk with *the Speaker at the head of the procession*. He keeps the old words, and the old words know the way down to the water.'],
          do: [{ set: { 'desert.elder.heard': true } }, { track: Q }],
          choices: [
            { text: '~neutral~ The well, Ama’s jar, the Speaker.', goto: 'go' },
            { text: '~scared~ And if the old words don’t help?', goto: 'down' },
          ],
        },
        go: { say: ['~playful~ Twice was not needed. Go on, little star. Qanat will be watching you; try to look as if you know where you are going.'], choices: [{ text: '~happy~ Thank you, Nour.', end: true }] },
        down: { say: ['~solemn~ Then *look between the giant’s eyes*, outside the back gate. Everything the Givers made, they marked. Even you, now, it seems.'], choices: [{ text: '~happy~ Thank you, Nour.', end: true }] },
        again: {
          say: ['~playful~ *The well, Ama’s jar, the Speaker’s old words.* In that order, if you like order. I never did.'],
          choices: [
            { text: '~neutral~ Tell me about the Givers again.', goto: 'givers' },
            { text: '~neutral~ Goodbye, Nour.', end: true },
          ],
        },
        // the water is up, the well is full, and the tree is cold: the spark-stone (the second errand)
        cold: {
          say: ['~sad~ You did it, child. The water came up the roots, the well is brimming, and the tree drank. And look at it. Cold. Not a spark.',
            '~solemn~ My grandmother told me this, and I thought it was a story for children: living water does not burn by itself. The Givers lit the tree once, long ago, with a stone they carried from their hearth: *the spark-stone*. Nothing else lights it. Not a torch, not Ama’s fires, not anything you carry.',
            '~curious~ The keepers put the stone back where the Givers kept it: *the Givers’ Hearth*, a cave in *the red rocks, far to the south-east*. They set *marked stones* along the way.'],
          do: [{ set: { 'desert.spark.heard': true } }, { track: Q }],
          choices: [
            { text: '~curious~ How far is it?', goto: 'far' },
            { text: '~solemn~ I’ll bring the stone back.', goto: 'bring' },
          ],
        },
        far: { say: ['~playful~ Farther than walking. The old keepers took three days there and three back, and they were younger than me.', '~neutral~ *Marrow, at the camps*, sells everything that falls out of the sky. Ask him for *something faster than feet*.'], choices: [{ text: '~solemn~ I’ll bring the stone back.', goto: 'bring' }] },
        bring: { say: ['~solemn~ Then *set it in the well*, in the water at the roots. And come back with all your fingers. The Givers’ fire hurts nobody, they say; I have never met a fire that read the saying.'], choices: [{ text: '~happy~ Thank you, Nour.', end: true }] },
        sparkAgain: {
          say: ['~neutral~ *South-east, in the red rocks*, from marked stone to marked stone: the Givers’ Hearth. Too far for feet. *Marrow* has a thing that is faster than feet, or says he does.'],
          choices: [{ text: '~neutral~ Tell me about the Givers again.', goto: 'givers' }, { text: '~neutral~ Goodbye, Nour.', end: true }],
        },
        stone: {
          say: ['~surprised~ That light in your hands… The spark-stone. My grandmother’s story, warm in a stranger’s hands.', '~solemn~ *Set it in the well*, child, in the water at the roots. Go on. Before I lose my nerve and keep it.'],
          choices: [{ text: '~neutral~ (go to the well)', end: true }],
        },
        drinking: { say: ['~happy~ The tree drinks, and burns, and the chest is empty, and an old woman has lived to see all three. *Go and wake your ball*, child. Before I start to cry and Hessa sees.'], choices: [{ text: '~happy~ Goodbye, Nour.', end: true }] },
        after: { say: ['~happy~ When you find the next chest, tell it Qanat says hello. I think they are all one family. Like the giants. Like us.'], choices: [{ text: '~happy~ I will, Nour.', end: true }] },
      },
    },
  },

  hessa: {
    id: 'hessa', name: 'Hessa', title: 'keeper of the well', color: '#62c3c9', voice: 0.95, kind: 'f',
    palette: { cloak: '#62c3c9', lining: '#2b211f', cloth: '#f3ead8', legs: '#2b2f45', hat: '#f3ead8', hair: '#4a3226' }, head: 'hood', cape: 1.45, look: { prop: 'basket' },
    lines: ['~angry~ The well is dry. Don’t lean on it.', '~tired~ Every year I sweep the well for the water. Every year.', '~neutral~ The stele tells it better than me.'],
    talk: {
      entry: [{ if: { flag: 'desert.tree.lit' }, node: 'burning' }, { if: { flag: 'desert.channel.open' }, node: 'full' }, { node: 'hello' }],
      nodes: {
        hello: {
          say: [{ if: { flag: 'desert.elder.heard' }, text: '~neutral~ Grandmother sent you to listen? Then listen. *Put your ear to the rim*, after dark it’s loudest.' }, '~tired~ I keep the well. That means I sweep it, and wait, and sweep it again. The water comes up through the roots, here, every year, and the tree burns on it. This year it’s only dust, and the tree went out.', '~solemn~ *Read the stele*, if you can read stone. The giants carry the water to the tree. That’s all it says. That’s all it needs to say.'],
          choices: [
            { text: '~curious~ Where does the water come from?', goto: 'from' },
            { text: '~curious~ What’s the mark above the carving?', goto: 'glyph' },
          ],
        },
        chest: {
          say: [{ if: { not: { flag: 'item.backpack' } }, text: '~playful~ The Givers’ ledge. The chest on it was here before the city; we built the city round the tree, and the tree grew up round the ledge… well. My grandmother Nour keeps the chest. I keep the well. Neither of them does anything.' },
            { if: { not: { flag: 'item.backpack' } }, text: '~tired~ It has hummed every night since the light sang. Grandmother says it’s waiting for someone. Grandmother says a lot of things.' },
            { if: { flag: 'item.backpack' }, text: '~playful~ The Givers’ ledge. Sixty years my grandmother sat under that chest, and it opened for you on a Tuesday. She’ll be insufferable.' }],
          choices: [{ text: '~curious~ Where does the water come from?', goto: 'from' }, { text: '~happy~ Thank you, Hessa.', end: true }],
        },
        from: { say: ['~neutral~ From below. From the giant. Its head lies outside the back gate; its heart lies under our feet. The old keepers went down *through its mouth* to clean the channel, so my grandmother Nour says; she saw them go when she was a girl. Nobody has gone down in my lifetime.'], choices: [{ text: '~surprised~ Through its mouth?', goto: 'mouth' }] },
        mouth: { say: ['~whisper~ Propped open with carved stones. Children dare each other to touch the teeth. Don’t tell Ilo I told you.'], choices: [{ text: '~playful~ I won’t.', end: true }] },
        glyph: { say: ['~neutral~ {glyph} The keepers call it the Givers’ mark. The pilgrims from the salt call it the Eye That Fell. The children call it the bird. Nobody knows who put it there first.'], choices: [{ text: '~curious~ And what is up on the tree’s trunk?', goto: 'chest' }, { text: '~curious~ Where does the water come from?', goto: 'from' }] },
        full: { say: ['~happy~ Look at it. Look! It came up through the roots in every colour, like it used to. I didn’t even have time to finish sweeping.', '~sad~ And the tree drinks it, and stays cold. Ask Grandmother. Grandmother always knows.'], choices: [{ text: '~happy~ It was waiting for someone to clear the way.', end: true }] },
        burning: { say: ['~happy~ It burns from the roots up, and the well with it, and it doesn’t even singe the broom. I’m putting the broom down. I’m not picking it up all year.'], choices: [{ text: '~happy~ You’ve earned it, Hessa.', end: true }] },
      },
    },
  },

  marrow: {
    id: 'marrow', name: 'Marrow', title: 'salvager and liar', color: '#dca273', voice: 1.0, kind: 'm',
    palette: { cloak: '#dca273', lining: '#2b211f', cloth: '#34405e', legs: '#4a3a2a', hat: '#d8a24a', hair: '#2b211f' }, head: 'hat', cape: 0.9,
    lines: ['~shout~ Bones, glass, bits of sky. Cheap.', '~playful~ Everything that falls belongs to somebody. Usually me.', '~whisper~ Psst. Sky-person.'],
    talk: {
      entry: [
        { if: { quest: 'desert.bike', stage: 'ask' }, node: 'bike' },
        { if: { quest: 'desert.bike', stage: ['find', 'wake'] }, node: 'bikeWhere' },
        { if: { all: [{ flag: 'desert.bike.found' }, { not: { flag: 'desert.marrow.bike' } }] }, node: 'bikeAfter' },
        { node: 'hello' },
      ],
      nodes: {
        hello: {
          say: ['~playful~ Sky-person! I’ve been out to your ball already. Don’t look like that, I didn’t take anything. Much.', '~whisper~ There’s a burn on the side of it. Not a scrape; a burn, in a shape. Three dots over a curve. {glyph}'],
          choices: [
            { text: '~curious~ What does it mean?', goto: 'mean' },
            { text: '~curious~ Got anything faster than walking?', if: { all: [{ quest: 'desert.bike', started: false }, { not: { flag: 'desert.bike.found' } }] }, goto: 'bike' },
            { text: '~angry~ Stay away from my ship.', end: true },
          ],
        },
        // the hoverbike (quest desert.bike): he found it, hid it, and can't start it
        bike: {
          say: ['~playful~ Faster than walking? Sky-person, you have come to the right liar.',
            '~whisper~ A hoverbike. It fell off a caravan, or out of the sky; it didn’t say which. I dragged it into *the hollow with the red rag*, out between here and your ball, and threw *a tarp* over it.',
            '~sad~ It won’t start for me. It coughs and sulks. It runs on something I haven’t got. Maybe you have, or will.'],
          do: { stage: ['desert.bike', 'find'] },
          choices: [{ text: '~happy~ I’ll go and dig it out.', end: true }, { text: '~curious~ What do you want for it?', goto: 'price' }],
        },
        price: { say: ['~playful~ Nothing. It ate half my tarp. Ride past the camps fast and loud now and then, so people know where it came from.'], choices: [{ text: '~happy~ Deal.', end: true }] },
        bikeWhere: { say: ['~neutral~ *The hollow with the red rag*, between the camps and your ball. Pull the tarp off. If it won’t wake, it’s hungry, not dead: feed it from a full tank.'], choices: [{ text: '~neutral~ Thanks, Marrow.', end: true }, { text: '~curious~ What do you sell?', goto: 'sell' }] },
        bikeAfter: { say: ['~happy~ I heard it from here! Like a kettle with ambitions. Look after it; it’s the most honest thing I ever found.'], do: { set: { 'desert.marrow.bike': true } }, choices: [{ text: '~playful~ It has opinions.', end: true }, { text: '~curious~ What do you sell?', goto: 'sell' }] },
        mean: { say: ['~solemn~ It means somebody signs their work. The same mark is on the giants, on the old stones, on the gates. I’ve seen it on things that fell out of the sky before, too. Never on anything that was still warm.'], choices: [{ text: '~curious~ Things that fell before?', goto: 'before' }, { text: '~neutral~ Thanks, Marrow.', end: true }] },
        before: { say: ['~playful~ Bits, mostly. A shard of glass that hums when it rains. A bowl that rings by itself. Things that sing don’t fall by accident, sky-person. That’s my professional opinion, free of charge.',
          '~curious~ Here’s another, also free: since your ball came down, my compass points at it instead of north. Whatever burned that mark left a pull in the metal.'], choices: [{ text: '~curious~ What do you sell, then?', goto: 'sell' }, { text: '~neutral~ Thanks, Marrow.', end: true }] },
        sell: { say: ['~playful~ Today? Rumours. The tree hasn’t drunk because the giant’s holding its breath. The water’s late because the Speaker walks the wrong way round. The ball fell because you sneezed. Pick one.'], choices: [{ text: '~tired~ I’ll pass.', end: true }] },
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
          say: ['~neutral~ The well is swept clean and bone dry. Far below the stones, you hear something: water, moving slowly, a long way down, as if it can’t find the way up.', '~solemn~ Roots as thick as your arm go down the shaft. The stones round the rim are carved with kneeling figures, *all facing the back gate*.'],
          do: { set: { 'desert.well.seen': true } },
          choices: [{ text: '~neutral~ (look toward the back gate)', end: true }],
        },
        full: { say: ['~solemn~ The well is brimming. The water turns slowly in every colour, and the roots are drinking it.', '~sad~ Above you the great tree stands as cold and dark as before. The water is there; something to light it is not.'], choices: [{ text: '~neutral~ (watch it)', end: true }] },
        burning: { say: ['~solemn~ The well is brimming, and cool fire runs up out of the water along the roots, into the trunk, up to the crown. Your hand in it feels only water.'], choices: [{ text: '~neutral~ (watch it)', end: true }] },
      },
    },
  },
  stele: {
    id: 'stele', name: 'The stele', title: 'carved stone', color: '#e9dcc0', voice: 0.6,
    talk: { nodes: { read: {
      say: ['~solemn~ Three tall figures, bent under jars, walk toward a burning tree. Water runs at their feet. Above them, the mark: {glyph}', '~curious~ Behind the third, small, a figure carries something round and bright in both hands, held up high, like a lamp.', '~solemn~ Someone has rubbed the giants’ faces smooth with their thumbs, over a very long time.'],
      do: { set: { 'desert.stele.read': true } }, choices: [{ text: '~neutral~ (step back)', end: true }],
    } } },
  },
  brow: {
    id: 'brow', name: 'The giant’s brow', title: 'the fallen giant', color: '#f2ead6', voice: 0.6,
    talk: { nodes: { look: {
      say: ['~solemn~ The skull is bigger than a house. Between its eyes, worn into the bone, the mark: {glyph} It glows faintly, like the water in a jar held up to the sun.', '~whisper~ Between the teeth, carved stones prop the jaw open. Cool air breathes out of the dark.'],
      do: { set: { 'desert.brow.seen': true } }, choices: [{ text: '~neutral~ (go on)', end: true }],
    } } },
  },
  mural: {
    id: 'mural', name: 'The mural', title: 'in the giant’s chest', color: '#e9dcc0', voice: 0.6,
    talk: { nodes: { look: {
      say: ['~solemn~ Giants, lying down one after another, end to end. From each of them a stream runs out, and all the streams run to a tree.', '~curious~ It looks less like a picture of something that happened than like a set of instructions.'],
      do: [{ set: { 'desert.mural.read': true } }, { keepsake: { id: 'desert.knowing', level: 'desert', name: 'What the giants left', kind: 'knowing', text: 'The giants carried the water. The tree drinks what they left.' } }],
      choices: [{ text: '~solemn~ (remember it)', end: true }],
    } } },
  },
  drumStuck: {
    id: 'drumStuck', name: 'Teo’s drum', title: 'under the old ribcage', color: '#c8483a', voice: 0.6,
    talk: { nodes: { look: {
      say: ['~neutral~ A red drum with a ring of shells round its skin, standing on its rim like a wheel. It rolled in here and wedged itself against the foot of a rib.', '~neutral~ Then a knuckle of the giant’s spine rolled down after it and shut it in. You pull; the drum doesn’t move. *The bone* has to go, and not toward the rib.'],
      choices: [{ text: '~neutral~ (step back)', end: true }],
    } } },
  },
  knuckle: {
    id: 'knuckle', name: 'A knuckle of bone', title: 'from the giant’s spine', color: '#f2ead6', voice: 0.6,
    talk: { nodes: { look: {
      say: ['~neutral~ A knuckle of the old spine, as big as a sheep, round as a boulder. It pins Teo’s drum against the rib behind it.', '~neutral~ Shoved straight at the rib, it would only crush the drum. Shoved *from the side*, it might roll. (*Push*: C, middle click, or RB / R1.)'],
      choices: [{ text: '~neutral~ (step back)', end: true }],
    } } },
  },
  maskEyes: {
    id: 'maskEyes', name: 'The sleeping mask', title: 'in the southern dunes', color: '#f3ead8', voice: 0.55,
    talk: { nodes: { look: {
      say: ['~solemn~ The sand slides off its face. Two dark eyes, each as long as a boat, look up past you at the sky, the way they have for longer than the city has stood.', '~whisper~ Far down in each eye, something glints. The glints turn, very slowly, and find you.'],
      choices: [{ text: '~solemn~ (look back at it)', end: true }],
    } } },
  },
  bone: {
    id: 'bone', name: 'The fallen rib', title: 'across the channel', color: '#f2ead6', voice: 0.6,
    talk: { nodes: { look: {
      say: ['~neutral~ A rib, as long as three people, has broken from the arch above and fallen across the stone channel. The channel runs back from it into a crack in the wall. It is dry, but the stone under the rib is dark and damp.', '~neutral~ It’s far too heavy to lift by hand. But it might roll, with a strong enough shove of the fluid (*push*: C, middle click, or RB / R1), or with something long to lever it.'],
      choices: [{ text: '~neutral~ (step back)', end: true }],
    } } },
  },
  // the Givers' Hearth (src/desert-hearth.js, src/story/desert.js): the weight that lifts the grille, the grille itself
  weight: {
    id: 'weight', name: 'A stone ball', title: 'in a groove on a plinth', color: '#c9b8a0', voice: 0.6,
    talk: { nodes: { look: {
      say: ['~neutral~ A ball of grey stone, waist high, resting in a groove that runs along the top of a plinth to a dark hole at its end. A bronze chain runs out of the hole and up the wall, across the roof, to the grille in front of the glow.',
        '~neutral~ It is far too heavy for your hands. *A shove of the fluid* might roll it (*push*: C, middle click, or RB / R1).'],
      choices: [{ text: '~neutral~ (step back)', end: true }],
    } } },
  },
  grille: {
    id: 'grille', name: 'The grille', title: 'in front of the glow', color: '#c9974a', voice: 0.6,
    talk: { nodes: { look: {
      say: ['~neutral~ Stone bars, close as fingers, over a hollow in the wall. Behind them something round glows, fades, and glows again, slow as breathing.', '~curious~ A chain runs up from the bars into the dark of the roof. Something, somewhere, holds them down.'],
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
    camp: ['~shout~ The city’s that way, sky-stranger. *Under the big dark tree*!', '~happy~ Go on in! Nour will want to see you.', '~neutral~ Through the big gate and *up to the tree*.', '~surprised~ You’re the one from the ball? Nour’s chest has been humming all morning.'],
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

// People outside the quests only talk, and you only listen (src/story/dialogue.js pickListen): one
// entry a talk, the next one the next time; an `after` is news, said first once it holds.
export const VILLAGER_TALK = {
  name: 'Someone from Qanat', title: 'of Qanat', color: '#e6875f', voice: 1.0,
  talk: { listen: [
    { if: { not: BACKPACK }, say: '~playful~ That’s *the Givers’ chest, on the tree’s ledge*. It never opens. Nour sits under it, in case. Climb the root and look, if you like; it hums at people.' },
    { if: { not: BACKPACK }, say: '~whisper~ The chest hums louder when you’re near. Don’t tell Nour I said so, she’ll make you sit with her all day.' },
    { after: BACKPACK, say: '~playful~ I was there when it opened! Well. Near. I heard it. My grandmother is going to say she saw it, and she was asleep.' },
    '~tired~ I’ve work to do, sky-stranger. Qanat doesn’t sweep itself. Well. Mim sweeps it.',
    '~solemn~ Qanat is the city that didn’t sink. Every dune out there remembers one that did.',
    { after: LIT, say: '~happy~ It burns from the roots up and doesn’t singe a leaf. My grandmother always said so. I thought she was being poetic.' },
    { after: DONE, say: '~playful~ Your ball’s awake? Then you’ll go. Everyone goes. Come back for the drinking.' },
  ] },
};

/** What people in the crowd say when you stop and listen, by where they stand. Picked by their seed. */
export const CROWD_TALK = {
  procession: [
    { name: 'A pilgrim', title: 'walking the circuit', talk: { listen: [
      '~neutral~ Walk beside me, if you like; just don’t stop. We walk the circuit round Qanat until the tree drinks, and burns again.',
      ['~solemn~ A tree can’t see, but it can hear feet.', '~solemn~ Seven times round for every year it has drunk. We lost count long ago.'],
      '~angry~ You’re in my step. Walk or get out of the way, sky-stranger.',
      { if: { not: TEMPLE }, say: '~curious~ See the rose stone humped in the dunes *east of the walls*? The Givers’ House, my mother called it. Its door looks at Qanat, as if it’s waiting to be let in.' },
      { after: RISEN, if: { not: LIT }, say: '~surprised~ The well’s full and we still walk. The tree hasn’t burned. A circuit isn’t over until it’s over.' },
      { after: DONE, say: '~happy~ The drinking came! Eleven days I walked for it, and I’d walk eleven more.' },
    ] } },
    { name: 'A banner bearer', title: 'in the procession', talk: { listen: [
      '~happy~ This banner has walked the circuit eighty years. The cloth’s been changed nine times, the pole twice. Same banner.',
      ['~playful~ The Givers’ mark, three dots and an arc. {glyph}', '~playful~ My father said it’s the giants’ eyes, looking up. My mother said it’s rain over a hill. They argued every circuit. Happiest couple in the oasis.'],
      '~tired~ Carry a banner for forty circuits and you learn which way the wind blows. Today: into my face.',
      '~neutral~ *Follow the banners* and you’ll find the Speaker. Follow the drum and you’ll find him sooner.',
      { after: TEMPLE, say: '~surprised~ They say the old fields round Qanat are going green. Green! I’ll need a new banner. This one’s the colour of sand.' },
    ] } },
    { name: 'A tired walker', title: 'in the procession', talk: { listen: [
      '~tired~ Eleven days across the dunes, a cold tree at the end of them, and now round and round. My feet have opinions.',
      ['~happy~ At the drinking the fire goes cool and every colour, and everyone drinks a mouthful from the same jar.', '~happy~ Then we sing until the jar is empty and the morning comes.'],
      '~tired~ No, I don’t want to hear about your ship. I want to hear about a chair.',
      '~whisper~ Mind the cactus by the road, the sand candelabra. It looks friendly. It isn’t.',
      { after: DONE, say: '~happy~ My feet have stopped complaining. They’re too busy dancing.' },
    ] } },
  ],
  drinking: [
    { name: 'A pilgrim', title: 'singing', talk: { listen: [
      '~happy~ It burns! Did you see? Every colour, just like my grandmother said. One more circuit, for joy!',
      '~shout~ Drink, sky-stranger! Everyone drinks from the same jar. Even the ones who fell out of the sky.',
      '~playful~ Thirty years I’ve sung this song, and tonight I found out I’ve had the words wrong. I’m keeping my words.',
      '~happy~ Look at the colours on the walls. Exactly as my grandmother said. And she exaggerated everything else.',
    ] } },
  ],
  camp: [
    { name: 'A pilgrim', title: 'by the fire', talk: { listen: [
      '~happy~ Warm yourself. Ama’s fires are the only thing in this desert that’s never late.',
      { if: { not: LIT }, say: '~angry~ Everything else is late. The water, the drinking, the fire, us getting home. Eleven days walking for a dry well and a cold tree.' },
      '~whisper~ Ama burns too much thornwood. Don’t tell her I said so, or I’ll get the smoky side for a week.',
      '~playful~ Sit down or move on, stranger. You’re standing in my warm.',
      { after: LIT, say: '~happy~ The tree burns again, and Ama still feeds her fires. Habit. I’d do the same.' },
    ] } },
    { name: 'A trader', title: 'resting', talk: { listen: [
      ['~surprised~ You came out of the sky-ball? Then you saw the light that went over before it. It sang, like a bowl rubbed with a wet finger.', '~whisper~ It didn’t come down. It dipped low behind the dunes, as if it was looking for something, and climbed away again.'],
      { if: { not: { flag: 'desert.bike.found' } }, say: '~whisper~ Marrow hides what he finds. There’s a hollow *between your ball and the camps*, with *a red rag on a pole*. Ask him what’s under the tarp. Then don’t pay what he asks.' },
      '~playful~ I sell salt to people who walk past the salt flats to get here. Business is a kind of faith.',
      '~curious~ East of the camps there’s a ring of old ledges with glass on top. *The Sleeping Observatory*. People sketch it. Nobody knows what it watched.',
      { after: DONE, say: '~happy~ Business is good. Happy people buy salt. I don’t know why. I don’t ask.' },
    ] } },
    { name: 'A child', title: 'bored', talk: { listen: [
      '~tired~ Have you seen Ilo? She said she’d show me the giant’s teeth. She’s always saying things.',
      ['~playful~ Ilo says the sleeping face looks at you if you *wash the sand off its eyes*.', '~whisper~ Both eyes, quick, before the wind fills them again. I’m not allowed.'],
      '~angry~ Go away, I’m guarding this rock.',
      '~curious~ Is it true that up in the sky you fall up? I knew it.',
      { after: TEMPLE, say: '~surprised~ You went in the rose-stone house? Was it dark? Was something thirsty? Ilo said something in there was thirsty.' },
    ] } },
  ],
  gate: [
    { name: 'A pilgrim', title: 'at the gate', talk: { listen: [
      { if: { not: LIT }, say: '~scared~ We wait at the gate for the Speaker to call us in to the drinking. Every year he calls. This year he just keeps walking.' },
      '~neutral~ Mind the steps up to the tree. They’re older than the walls, and they know it.',
      { if: { not: RISEN }, say: '~whisper~ The kneeling figures on the well’s rim all face *the back gate*. Hessa says it means nothing. Hessa sweeps them every day, so she’d know.' },
      { if: { not: { flag: 'box.desert.star' } }, say: '~playful~ There’s a box on a roof *just inside the gate*, I swear, with a pale star on the lid. Climb the house wall, if your knees are younger than mine.' },
      '~tired~ Stand there if you like. I’ve been standing here three days. It isn’t interesting.',
      { after: DONE, say: '~happy~ The Speaker called us in! First time in my life I’ve been glad to stop waiting.' },
    ] } },
  ],
};
