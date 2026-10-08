// Vael II's story as data: "The Bell Under the Cloud" (docs/story-bible.md).
//
// The monastery bell on the rose cliff has not rung since the cloud rose.
// The sky stones and the floating island have hung over the cloud for longer
// than anyone remembers ("since my mother's day", Aube says; "long ago"). The
// monks believe the bell's ringing kept everything else down: thirty years ago,
// the night the cloud rose, the bell stopped and everything loose fell *up*
// (tiles, pebbles, a goat, the bell's own clapper, which the floating island
// took). The night the light went over, the bell hummed by itself and the
// little things fell up again (Tiv's cairn). Bring it back, ring the bell, and the cloud settles a little,
// and the floating stones come down a little; nobody can say which caused
// which. The bell's one note is the keepsake (a *song*): it sounds from the
// tank when you shoot, in every world, from then on.
//
// Side quests: carry Mother Ysolde's letter across the long aqueduct to her
// sister Ondine, who walked to the plain thirty years ago (and look at the
// face carved on the lone tower, the same calm face that sleeps in the
// desert: the giants were here too); and boost-jump up the sky stones by the
// great table to fetch the three stones that fell up off Tiv's cairn, then
// set them back on it, widest first.
//
// Flags (game-state.js): arzach2.aube.heard, arzach2.calix.asked,
// arzach2.clapper.hung, arzach2.bell.rung, arzach2.bell.note (the tank sings
// the note when you shoot), arzach2.rumour.light, arzach2.face.seen,
// arzach2.cairn.placed (0..3), arzach2.cairn.last ('ok' | 'fell'),
// arzach2.cairn.<stone> (picked up); clue.arzach2.desert; arzach2.tiles.cleared
// (the tiles shoved off the clapper); arzach2.lamp.notch (0..7, 0 = facing the
// rose cliff), arzach2.lamp.lit, arzach2.lamp.answered (Ysolde saw it).
// Items: clapper, letter, cairn.wide, cairn.round, cairn.egg.

const Q = 'arzach2.bell';

export const ITEMS = { clapper: 'the bell’s clapper', letter: 'Mother Ysolde’s letter', 'cairn.wide': 'a wide flat stone', 'cairn.round': 'a round stone', 'cairn.egg': 'a little egg-shaped stone' };

/** The three stones that fell up off the cairn, where they lie (indices into the sky stones) and the order they stack in. */
export const CAIRN_STONES = [
  { id: 'cairn.wide', sky: 2, r: 0.95, sy: 0.42, egg: 0 },
  { id: 'cairn.round', sky: 5, r: 0.7, sy: 0.7, egg: 0.05 },
  { id: 'cairn.egg', sky: 8, r: 0.48, sy: 1.15, egg: 0.25 },
];

// ------------------------------------------------------------------ quests
export const QUESTS = [
  {
    id: Q, title: 'The Bell Under the Cloud', world: 'arzach2', main: true,
    outro: 'The bell rang. The cloud settled a little. So did the stones.',
    stages: [
      { id: 'aube', text: 'A hermit keeps the edge of the start plateau. Ask her about the cloud', label: 'Sister Aube', flag: 'arzach2.aube.heard', at: 'aube' },
      { id: 'monastery', text: 'Ride the bird up to the white monastery on the rose cliff', label: 'The monastery', goto: 'monastery', radius: 45, vertical: 20, at: 'monastery' },
      { id: 'calix', text: 'Find Brother Calix, keeper of the silent bell', label: 'Brother Calix', flag: 'arzach2.calix.asked', at: 'calix' },
      { id: 'clapper', text: 'Fetch the bell’s clapper from the floating island’s church, and bring it to Calix', label: 'The clapper', bring: 'clapper', at: 'clapper', to: 'calix' },
      { id: 'ring', text: 'Ring the bell: pull the rope at the foot of the bell tower', label: 'The bell rope', flag: 'arzach2.bell.rung', at: 'rope' },
      { id: 'listen', text: 'Listen with Brother Calix', label: 'Brother Calix', talk: 'calix', at: 'calix' },
    ],
  },
  {
    id: 'arzach2.letter', title: 'A Letter Across the Aqueduct', world: 'arzach2',
    outro: 'Ondine read it twice. Then she sat down and laughed.',
    stages: [
      { id: 'carry', text: 'Carry Mother Ysolde’s letter across the long aqueduct to her sister Ondine, on the peach plain', label: 'Ondine, on the plain', bring: 'letter', to: 'ondine' },
      // (new: saves already at 'face' skip it, and can still light the lamp)
      { id: 'lamp', text: 'Answer for Ondine with the old signal lamp on the tower’s plinth: turn its mirror to the carved bell (push the tiller from the side: switch the gun to push with {key:mode}, then aim and shoot), and light it with a shot', label: 'The signal lamp', flag: 'arzach2.lamp.answered', at: 'lamp' },
      { id: 'face', text: 'Look at the face carved on the lone tower’s plinth', label: 'The face on the tower', flag: 'arzach2.face.seen', at: 'face' },
    ],
  },
  {
    id: 'arzach2.cairn', title: 'The Cairn That Fell Up', world: 'arzach2',
    outro: 'The cairn stands. Tiv says it hums when the wind is right.',
    stages: [
      { id: 'gather', text: 'Climb the sky stones by the great table (jump, then jump again in the air) and fetch the cairn’s three stones', label: 'A cairn stone', at: 'cairnStone',
        when: (q) => ['cairn.wide', 'cairn.round', 'cairn.egg'].filter((s) => q.has(s)).length + (q.game.flag('arzach2.cairn.placed') ?? 0) >= 3 },
      { id: 'stack', text: 'Set the stones back on Tiv’s cairn, widest first', label: 'Tiv’s cairn', flag: 'arzach2.cairn.placed', value: 3, at: 'cairn' },
    ],
  },
];

// ------------------------------------------------------------------ the people
export const PEOPLE = {
  ysolde: {
    id: 'ysolde', name: 'Mother Ysolde', title: 'who writes the letters', color: '#e9d7b0', voice: 0.85, kind: 'f', age: 'elder', scale: 0.95,
    palette: { cloak: '#f3ead8', lining: '#6a3a4a', cloth: '#6a3a4a', legs: '#4a3a2a', hat: '#f3ead8', hair: '#e8dcc0' }, head: 'hood', cape: 1.45, look: { prop: 'bell', body: 'scarf', mask: 'glasses' },
    lines: ['~scared~ Mind the cliff, child.', '~sad~ Thirty years of letters, and not one sent.', '~surprised~ Is that a bird? A real one?'],
    talk: {
      entry: [
        { if: { quest: 'arzach2.letter', done: true }, node: 'after' },
        { if: { quest: 'arzach2.letter', reached: 'face' }, node: 'answered' },
        { if: { quest: 'arzach2.letter', reached: 'lamp' }, node: 'watching' },
        { if: { has: 'letter' }, node: 'waiting' },
        { node: 'hello' },
      ],
      nodes: {
        hello: {
          say: ["~playful~ A visitor on a bird! The last rider walked down the aqueduct and never wrote. I hope the bird gave you better references.", "~sad~ I’m Ysolde. I write to my sister every winter. Thirty letters. None sent. They’re in a box under my bed, in order."],
          choices: [
            { text: '~curious~ Why not?', goto: 'why' },
            { text: '~curious~ Where is your sister?', goto: 'where' },
          ],
        },
        why: { say: ["~tired~ Ondine left. I stayed. We both insisted the other was wrong. Then the cloud rose, leaving only the aqueduct between us. I no longer trust my knees on it."], choices: [{ text: '~happy~ I could carry one.', goto: 'carry' }, { text: '~curious~ Where is she?', goto: 'where' }] },
        where: { say: ["~sad~ She lives out on *the peach plain, near the lone tower*. She went to study its age. Some evenings she waves at me from there."], choices: [{ text: '~happy~ I could carry a letter.', goto: 'carry' }, { text: '~curious~ What happened to the bell?', goto: 'bell' }] },
        carry: {
          say: ["~happy~ You’ll take a letter? This one, then. The shortest. It took thirty years to cut out the unnecessary bits.", "~playful~ Take *the long aqueduct past the needles* to the plain. And don’t read it. Or at least have the decency to pretend you didn’t."],
          do: [{ give: 'letter' }, { start: 'arzach2.letter' }],
          choices: [{ text: '~neutral~ I’ll bring it to her.', end: true }],
        },
        bell: { say: ["~playful~ Ask *Brother Calix at the monastery*. His bell stopped when the cloud rose. Which caused which? Ondine and I used to argue it over supper. I’ve missed the arguing."], choices: [{ text: '~happy~ I could carry a letter to your sister.', goto: 'carry' }, { text: '~happy~ Thank you.', end: true }] },
        waiting: { say: ["~scared~ Still carrying it? Good. No, bad. Take it to Ondine! *The aqueduct is past the needles.*"], choices: [{ text: '~neutral~ On my way.', end: true }] },
        watching: { say: ["~scared~ She has it? Don’t tell me what she said. I’ll watch *the tower* from our wall tonight. Just in case."], choices: [{ text: '~neutral~ Keep watching.', end: true }] },
        answered: { say: [
          { if: { flag: 'arzach2.lamp.answered' }, text: "~happy~ Her tower lamp lit up! I answered the old way: three long flashes, one short. My hands still knew it." },
          { if: { flag: 'arzach2.lamp.answered' }, text: "~playful~ I flashed back. No need to tell me what my letter said. I was there for the writing." },
          { if: { not: { flag: 'arzach2.lamp.answered' } }, text: "~happy~ What did she say? No, wait. She waved with both arms tonight. Let me keep that for a moment." }], choices: [{ text: '~happy~ She laughed.', goto: 'laughed' }, { text: '~happy~ (smile)', end: true }] },
        laughed: { say: ["~happy~ She laughed? Good. Next winter I’ll deliver the letter myself. You may remind me I said that."], choices: [{ text: '~neutral~ Goodbye, Mother.', end: true }] },
        after: { say: ["~happy~ I’ve started another letter. *Come for supper.* Three words, and I mean every one.", { if: { flag: 'arzach2.bell.rung' }, text: "~happy~ She said she’d come when the bell rang. It rang. I’ve laid two places at supper. Then took one away. Then put it back." }], choices: [{ text: '~happy~ She’ll come.', end: true }] },
      },
    },
  },
  tiv: {
    // (a novice of ten: docs/makehuman.md stage 3)
    id: 'tiv', name: 'Tiv', title: 'a novice who balances stones', color: '#9fc3c4', voice: 1.4, kind: 'm', scale: 0.85, age: 'child', years: 10,
    palette: { cloak: '#9fc3c4', lining: '#2b211f', cloth: '#f3ead8', legs: '#4a3a2a', hat: '#f3ead8', hair: '#6e4a32' }, head: 'hair', cape: 0.55, look: { prop: 'none', body: 'none' },
    lines: ['~whisper~ Shh, it’s nearly balanced.', '~surprised~ They fell UP. Up!', '~neutral~ Widest first. Always widest first.'],
    talk: {
      entry: [
        { if: { quest: 'arzach2.cairn', done: true }, node: 'after' },
        { if: { quest: 'arzach2.cairn', active: true }, node: 'again' },
        { node: 'hello' },
      ],
      nodes: {
        hello: {
          say: ["~scared~ Mind that stone! It’s the foot of my cairn. At present, it is also the entire cairn.", "~surprised~ It used to reach my head. The night the light went over, the bell hummed and my stones fell *up*. I had prepared for down."],
          choices: [
            { text: '~curious~ Up where?', goto: 'where' },
            { text: '~playful~ Stones don’t fall up.', goto: 'dont' },
          ],
        },
        dont: { say: ["~angry~ Look beyond the table! My three stones landed on *those little sky stones*. Calix says they forgot which way was down. I wish they’d asked."], choices: [{ text: '~neutral~ I’ll fetch them.', goto: 'fetch' }, { text: '~curious~ Up where?', goto: 'where' }] },
        where: { say: ["~playful~ Climb *the sky stones beside this table*. Jump from one to the next, then *jump again in mid-air*. I tried. I fell in the cloud and it put me back. Twice."], choices: [{ text: '~neutral~ I’ll fetch them.', goto: 'fetch' }] },
        fetch: {
          say: ["~happy~ Bring all three: the flat stone, the round one, and the little egg. Then stack them *widest first*. A cairn needs sensible feet."],
          do: { start: 'arzach2.cairn' },
          choices: [{ text: '~playful~ Widest first.', end: true }],
        },
        again: { say: [{ if: { flag: 'arzach2.cairn.last', is: 'fell' }, text: "~angry~ Flat stone below, round stone next, egg on top. Feet, belly, head! Would you stand on your head in this wind?" }, { if: { not: { flag: 'arzach2.cairn.last', is: 'fell' } }, text: "~neutral~ Find my three stones *on the sky stones*. Double-jump between them. Bring them back and stack them *widest first*." }],
          choices: [{ text: '~neutral~ Got it.', end: true }] },
        after: {
          say: ["~happy~ It stands! And it hums. I don’t remember teaching it that.", "~playful~ Calix calls a cairn a prayer in stone. I think mine is a thank-you. With feet."],
          choices: [{ text: '~happy~ It looks very nice.', end: true }],
        },
      },
    },
  },
};

/** The level's own people (Vael II's npcs, by index). */
export const LOCALS = [
  {
    id: 'aube', name: 'Sister Aube', title: 'hermit of the edge', color: '#b9a7d8', voice: 0.9,
    talk: {
      entry: [{ if: { flag: 'arzach2.bell.rung' }, node: 'after' }, { if: { flag: 'arzach2.aube.heard' }, node: 'again' }, { node: 'hello' }],
      nodes: {
        hello: {
          say: ["~playful~ Did you come out of the cloud? No? From above it? Good. I like to know which direction to worry about.", "~scared~ I’m Aube. I keep this hermitage and watch the cloud. It has crept higher since I was young. I mark it every spring, on the same stalk."],
          choices: [
            { text: '~curious~ Why is it higher?', goto: 'why' },
            { text: '~curious~ What are the floating stones?', goto: 'stones' },
          ],
        },
        why: {
          say: ["~solemn~ The monks say their bell held the world down. They say everything loose fell up when it stopped, and the cloud followed. They think *ringing it* will lower the cloud.", "~tired~ It has been silent for thirty years. Ask *Brother Calix at the monastery* why. You’ll need the bird to reach him."],
          do: { set: { 'arzach2.aube.heard': true } },
          choices: [{ text: '~neutral~ I’ll go up to the monastery.', goto: 'go' }, { text: '~curious~ What are the floating stones?', goto: 'stones' }],
        },
        stones: { say: ["~curious~ The sky stones were floating long before the bell stopped. They were here in my mother’s day. Monks have a talent for leaving out inconvenient stones."], choices: [{ text: '~curious~ Why is the cloud higher?', goto: 'why' }] },
        go: { say: ["~neutral~ *Whistle for the bird* with {key:call}, out in the open. Fly *south-west to the white monastery on the rose cliff*. Stay clear of the cloud."], choices: [{ text: '~happy~ Thank you, Sister.', end: true }] },
        again: { say: ["~playful~ Calix is at *the white monastery, on the south-western rose cliff*. He still tends the bell, every morning, whether it rings or not."], choices: [{ text: '~happy~ Thank you.', end: true }] },
        after: { say: ["~surprised~ The cloud has dropped! A whole hand’s width. I can see the table stalks again!", "~solemn~ Come back and ring it sometime. I’d like a better view before I die."], choices: [{ text: '~neutral~ I will.', end: true }] },
      },
    },
  },
  {
    id: 'calix', name: 'Brother Calix', title: 'keeper of the silent bell', color: '#f3ead8', voice: 0.7,
    talk: {
      entry: [
        { if: { quest: Q, done: true }, node: 'after' },
        { if: { quest: Q, stage: 'listen' }, node: 'listen' },
        { if: { has: 'clapper' }, node: 'clapper' },
        { if: { flag: 'arzach2.clapper.hung' }, node: 'rope' },
        { if: { flag: 'arzach2.calix.asked' }, node: 'again' },
        { node: 'hello' },
      ],
      nodes: {
        hello: {
          say: ["~happy~ Welcome, welcome. You’ve come about the bell, I expect. Everyone who climbs this far has.", "~sad~ Thirty years silent, up in that belfry. I oil the yoke every morning. A bell should be ready when its day comes."],
          choices: [
            { text: '~curious~ Why doesn’t it ring?', goto: 'why' },
            { text: '~neutral~ Sister Aube says the cloud rose when it stopped.', goto: 'why' },
          ],
        },
        why: {
          say: ["~neutral~ It lost its *clapper*, the bronze piece that strikes inside. When the cloud rose, loose things fell up. Tiles. The clapper. A goat. A difficult morning.", "~sad~ The clapper landed *before the church door on the floating island*. I can see it through my glass. Every morning, just out of reach."],
          do: { set: { 'arzach2.calix.asked': true } },
          choices: [{ text: '~happy~ I do. I’ll bring it back.', goto: 'bring' }, { text: '~curious~ What’s that mark on the bell?', goto: 'mark' }],
        },
        mark: {
          say: ["~solemn~ We call this mark *the Three Notes*. {glyph} The founders put it on their bells. We’ve forgotten the notes. We kept the name.", "~whisper~ But the night the singing light passed, this bell hummed without a clapper. One long note, answering the sky.", "~solemn~ The blue chest *on the balanced stones* answered too. A founders’ bell-chest, with a pale star on top. They say it opens for travellers from beyond the reach of our bells."],
          do: { set: { 'arzach2.rumour.light': true } },
          choices: [{ text: '~surprised~ A light that sang? That was the night my ship was struck.', goto: 'light' }, { text: '~neutral~ I’ll bring the clapper back.', goto: 'bring' }],
        },
        light: { say: ["~solemn~ Then we heard the same light. *Bring back the clapper.* Perhaps the bell has more to say."], choices: [{ text: '~neutral~ I’ll bring it.', goto: 'bring' }] },
        bring: { say: ["~neutral~ Fly *east to the floating island*. Look for *the church with two towers*. The bronze clapper is outside its door. Mind the edge; the island tilts."], choices: [{ text: '~neutral~ I’ll be back.', end: true }] },
        again: { say: ["~neutral~ *East, on the floating island.* Find *the two-towered church*. The clapper lies at its door."], choices: [{ text: '~curious~ What’s that mark on the bell?', goto: 'mark' }, { text: '~neutral~ On my way.', end: true }] },
        clapper: {
          say: ["~surprised~ You found it! Still bright where it struck the bell. Here, let me hold it. Thirty years. It’s heavier than I remembered.", "~playful~ (Calix scrambles up the belfry stairs. Hammering follows, with a few words that do not sound like prayers.)", "~scared~ It’s fitted. Now *pull the rope at the tower’s foot*. You do it. My hands won’t stop shaking."],
          do: [{ take: 'clapper' }, { set: { 'arzach2.clapper.hung': true } }, { advance: [Q, 'clapper'] }],
          choices: [{ text: '~neutral~ I’ll ring it.', end: true }],
        },
        rope: { say: ["~neutral~ *Pull the rope at the tower’s foot*, on the plateau side. Give it a proper pull."], choices: [{ text: '~neutral~ All right.', end: true }] },
        listen: {
          say: ["~whisper~ (Calix closes his eyes. The bell’s note travels through the stone beneath your feet.)", "~happy~ The cloud moved down. A little, but down. Thirty years, and it still knows the way.", "~solemn~ Listen to your tank. It has caught the bell’s note. When you use the fluid, you’ll hear it again. Take that with you."],
          do: [{ set: { 'arzach2.bell.note': true } }, { advance: [Q, 'listen'] },
            { keepsake: { id: 'arzach2.song', level: 'arzach2', name: 'The bell’s note', kind: 'song', text: 'One low note, and the cloud settling a hand’s width under it. It sounds from the tank now whenever you shoot.' } }],
          choices: [{ text: '~happy~ Thank you, Brother.', end: true }],
        },
        after: { say: ["~playful~ I ring it at dawn and dusk. Things settle a little each time. I still watch for the goat."], choices: [{ text: '~happy~ (laugh)', end: true }] },
      },
    },
  },
  {
    id: 'ondine', name: 'Ondine', title: 'who walked to the plain', color: '#e9a17f', voice: 1.0,
    talk: {
      entry: [{ if: { has: 'letter' }, node: 'letter' }, { if: { quest: 'arzach2.letter', stage: 'lamp' }, node: 'lamp' }, { if: { quest: 'arzach2.letter', started: true }, node: 'after' }, { node: 'hello' }],
      nodes: {
        hello: {
          say: ["~surprised~ Hello! Someone out on the plain! Heading for the tower? It’s a long walk. I’ve made it every day for thirty years.", "~playful~ I’m Ondine. Thirty years studying how old it is. All I’ve established is that we’re both older now."],
          choices: [
            { text: '~curious~ What’s so special about the tower?', goto: 'tower' },
            { text: '~neutral~ Your sister is at the monastery.', goto: 'sister' },
          ],
        },
        tower: { say: ["~solemn~ Look at *the face carved in its base*. The monastery didn’t make that. It was here long before them, with the same mark on its brow."], choices: [{ text: '~neutral~ I’ll look.', end: true }] },
        sister: { say: ["~sad~ My sister Ysolde still writes letters she won’t send. Her lamp burns half the night every winter. I know her thinking light."], choices: [{ text: '~curious~ What’s at the tower?', goto: 'tower' }] },
        letter: {
          say: ["~surprised~ For me? That’s her writing. She still crosses her sevens. I’d know them anywhere.", "~happy~ (Ondine reads the letter twice. Then she sits on the warm ground and laughs, wiping her eyes.)", "~happy~ *You were right about the tower. I was right about the bell. Come home for supper.* Thirty years, and she still keeps my place."],
          do: [{ take: 'letter' }, { advance: ['arzach2.letter', 'carry'] }],
          next: 'clue',
        },
        clue: {
          say: ["~happy~ Tell her I’ll come when the bell rings. Actually, help me answer her myself. We used to signal across the plain.",
            "~playful~ Use *the signal lamp on the tower’s base*. *Push its tiller from the side* until the mirror faces *the carved bell*, toward the rose cliff. Then *light it*. My arms won’t turn it anymore."],
          next: 'giants',
        },
        giants: {
          say: ["~solemn~ Before you leave, see *the carved face*. A travellers’ book shows the same face half buried in a red desert. Giants walked there. I think they walked here too."],
          choices: [{ text: '~neutral~ I’ll light the lamp.', end: true }],
        },
        lamp: { say: [{ if: { flag: 'arzach2.lamp.lit' }, text: "~curious~ It’s burning! Now *push the tiller from the side*. Turn the mirror toward *the carved bell* so Ysolde can see it." },
          { if: { not: { flag: 'arzach2.lamp.lit' } }, text: "~playful~ *Push the lamp’s tiller sideways*, aim its mirror at *the carved bell*, then *light it*. She’ll be watching from the monastery wall." }],
          choices: [{ text: '~neutral~ All right.', end: true }] },
        after: { say: [{ if: { flag: 'arzach2.lamp.answered' }, text: "~happy~ Her window answered the moment we lit ours. All these years, and she was watching too." }, { if: { flag: 'arzach2.bell.rung' }, text: "~happy~ I heard the bell! That means supper. I’ll set out at first light, and I won’t stop at the tower." }, { if: { not: { flag: 'arzach2.bell.rung' } }, text: "~playful~ I said I’d come when the bell rings. Now I find myself rather hoping it will." }],
          choices: [{ text: '~neutral~ Goodbye, Ondine.', end: true }] },
      },
    },
  },
];

// The scenery you can look at.
export const THINGS = {
  face: {
    id: 'face', name: 'The face on the tower', title: 'carved into the plinth', color: '#f4ecdc', voice: 0.6,
    talk: { nodes: { look: {
      say: ["~solemn~ The tower’s base bears a sleeping face as tall as you. You know it: the masked head in *the desert’s southern dunes*. On its brow: {glyph}",
        "~curious~ Time has worn the carving smooth. The face looks as though it could wake without breaking the stone."],
      do: { set: { 'arzach2.face.seen': true, 'clue.arzach2.desert': true } },
      choices: [{ text: '~solemn~ (remember it)', end: true }],
    } } },
  },
  lamp: {
    id: 'lamp', name: 'The signal lamp', title: 'on the tower’s plinth', color: '#c99a52', voice: 0.6,
    talk: {
      entry: [{ if: { flag: 'arzach2.lamp.answered' }, node: 'answered' }, { node: 'look' }],
      nodes: {
        look: {
          say: ["~neutral~ A bronze signal lamp sits on a turntable, a polished mirror behind it and a wooden tiller at its back. The oil still smells sweet.",
            { if: { flag: 'arzach2.lamp.notch', is: 0 }, text: "~curious~ There are eight notches. The mirror faces *the notch with a carved bell*: north, toward the monastery." },
            { if: { not: { flag: 'arzach2.lamp.notch', is: 0 } }, text: "~curious~ The mirror points away from *the carved bell*. *Push the tiller sideways* to turn it toward that notch and the monastery." },
            { if: { not: { flag: 'arzach2.lamp.lit' } }, text: "~neutral~ The wick needs a light. *Shoot it*: aim with {key:aim}, fire with {key:fire}." }],
          choices: [{ text: '~neutral~ (step back)', end: true }],
        },
        answered: { say: ["~solemn~ The signal lamp faces the rose cliff. A tiny light answers from a monastery window."], choices: [{ text: '~neutral~ (step back)', end: true }] },
      },
    },
  },
  tiles: {
    id: 'tiles', name: 'Fallen-up tiles', title: 'before the church door', color: '#c9765c', voice: 0.6,
    talk: { nodes: { look: {
      say: ["~neutral~ Fallen roof tiles pin the clapper down. One bright bronze end sticks out.",
        "~neutral~ *Push the tiles aside* to free it: switch the gun to push with {key:mode}, then aim and shoot."],
      choices: [{ text: '~neutral~ (step back)', end: true }],
    } } },
  },
  bell: {
    id: 'bellrope', name: 'The bell rope', title: 'at the foot of the tower', color: '#8a5a3a', voice: 0.6,
    talk: { nodes: { look: {
      say: ["~neutral~ You pull. The bell swings and the wood creaks. Without its clapper, that is the whole performance.", '~sad~ *It has no clapper*.'],
      choices: [{ text: '~neutral~ (let go of the rope)', end: true }],
    } } },
  },
  cairn: {
    id: 'cairn', name: 'Tiv’s cairn', title: 'on the great table', color: '#efe4cf', voice: 0.6,
    talk: {
      entry: [{ if: { flag: 'arzach2.cairn.placed', is: 3 }, node: 'done' }, { node: 'look' }],
      nodes: {
        look: {
          say: [{ if: { flag: 'arzach2.cairn.placed', is: 0 }, text: "~sad~ Only the base remains, with smooth patches where the missing stones stood." },
            { if: { flag: 'arzach2.cairn.placed', is: 1 }, text: "~neutral~ The flat stone sits firmly on the base. A promising start." },
            { if: { flag: 'arzach2.cairn.placed', is: 2 }, text: "~neutral~ The round stone balances on the flat one. It wobbles, but stays." }],
          choices: [
            { text: '~neutral~ Set down the wide flat stone.', if: { has: 'cairn.wide' }, do: { emit: ['arzach2:cairn', 'cairn.wide'] }, goto: 'result' },
            { text: '~neutral~ Set down the round stone.', if: { has: 'cairn.round' }, do: { emit: ['arzach2:cairn', 'cairn.round'] }, goto: 'result' },
            { text: '~whisper~ Set down the little egg.', if: { has: 'cairn.egg' }, do: { emit: ['arzach2:cairn', 'cairn.egg'] }, goto: 'result' },
            // (holding all three, the stones are the only answers: B / Esc still steps back)
            { text: '~neutral~ (step back)', if: { not: { all: [{ has: 'cairn.wide' }, { has: 'cairn.round' }, { has: 'cairn.egg' }] } }, end: true },
          ],
        },
        result: {
          say: [{ if: { flag: 'arzach2.cairn.last', is: 'ok' }, text: '~happy~ It settles with a small click, and stays.' },
            { if: { flag: 'arzach2.cairn.last', is: 'fell' }, text: "~tired~ The stone slides back into your hands. *Widest first*: flat stone, round stone, egg." }],
          choices: [{ text: '~happy~ (look at it)', if: { flag: 'arzach2.cairn.placed', is: 3 }, goto: 'done' }],
          next: 'look',
        },
        done: { say: ["~solemn~ Flat stone, round stone, little egg. The cairn holds. Wind draws one low note from it."], choices: [{ text: '~neutral~ (step back)', end: true }] },
      },
    },
  },
};
