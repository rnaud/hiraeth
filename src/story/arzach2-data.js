// Arzach II's story as data: "The Bell Under the Cloud" (docs/story-bible.md).
//
// The monastery bell on the rose cliff has not rung since the cloud rose.
// The monks believe the stones fell *up* when the bell stopped: the floating
// stones, the sky stones, the island with its church. When the cloud rose,
// the bell's clapper fell up too, out of the belfry, and the floating island
// took it. Bring it back, ring the bell, and the cloud settles a little,
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
// arzach2.cairn.<stone> (picked up); clue.arzach2.desert.
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
    id: 'ysolde', name: 'Mother Ysolde', title: 'who writes the letters', color: '#e9d7b0', voice: 0.85, kind: 'f', scale: 0.95,
    palette: { cloak: '#f3ead8', lining: '#6a3a4a', cloth: '#6a3a4a', legs: '#4a3a2a', hat: '#f3ead8', hair: '#e8dcc0' }, head: 'hood', cape: 1.45,
    lines: ['Mind the cliff, child.', 'Thirty years of letters, and not one sent.', 'Is that a bird? A real one?'],
    talk: {
      entry: [
        { if: { quest: 'arzach2.letter', done: true }, node: 'after' },
        { if: { quest: 'arzach2.letter', reached: 'face' }, node: 'answered' },
        { if: { has: 'letter' }, node: 'waiting' },
        { node: 'hello' },
      ],
      nodes: {
        hello: {
          say: ['A visitor. On a bird. The last one who came on a bird walked off along the aqueduct and never wrote back.', 'Not that I can talk. I have written to my sister every winter for thirty years, and never sent one.'],
          choices: [
            { text: 'Why not?', goto: 'why' },
            { text: 'Where is your sister?', goto: 'where' },
            { text: 'What happened to the bell?', goto: 'bell' },
          ],
        },
        why: { say: ['Because she left, and I stayed, and we each thought the other was wrong. Then the cloud rose and the aqueduct was the only way across, and I am too old for aqueducts.'], choices: [{ text: 'I could carry one.', goto: 'carry' }, { text: 'Where is she?', goto: 'where' }] },
        where: { say: ['Ondine walked out onto the peach plain, toward the lone tower. She said the tower was older than the monastery, and she wanted to know by how much. She is still out there. She waves, some evenings. I can see her from the wall.'], choices: [{ text: 'I could carry a letter.', goto: 'carry' }, { text: 'Goodbye, Mother.', end: true }] },
        carry: {
          say: ['You would? Then take this one; it is the shortest. It says what all the others said, with fewer words.', 'Across the long aqueduct, from the needle plateau to the plain. Don’t read it. Well. Read it if you must, but don’t tell me.'],
          do: [{ give: 'letter' }, { start: 'arzach2.letter' }],
          choices: [{ text: 'I’ll bring it to her.', end: true }],
        },
        bell: { say: ['Ask Brother Calix; it is his bell, he says, though it belongs to the whole cliff. It stopped the night the cloud rose. Or the cloud rose the night it stopped. We argue about that at supper.'], choices: [{ text: 'Where is your sister?', goto: 'where' }, { text: 'Thank you.', end: true }] },
        waiting: { say: ['You still have it? Good. I mean: go on, then. The long aqueduct is past the needles.'], choices: [{ text: 'On my way.', end: true }] },
        answered: { say: ['You gave it to her? What did she… no. Don’t tell me. I saw her wave tonight, with both arms. That is enough.'], choices: [{ text: 'She laughed.', goto: 'laughed' }, { text: '(smile)', end: true }] },
        laughed: { say: ['She always did, at the wrong moments. Thank you, child. Next winter I will send one myself. Perhaps.'], choices: [{ text: 'Goodbye, Mother.', end: true }] },
        after: { say: ['I have started a new letter. It is very short. It says: *come for supper*.'], choices: [{ text: 'She’ll come.', end: true }] },
      },
    },
  },
  tiv: {
    id: 'tiv', name: 'Tiv', title: 'a novice who balances stones', color: '#9fc3c4', voice: 1.4, kind: 'm', scale: 0.85,
    palette: { cloak: '#9fc3c4', lining: '#2b211f', cloth: '#f3ead8', legs: '#4a3a2a', hat: '#f3ead8', hair: '#6e4a32' }, head: 'hair', cape: 0.55,
    lines: ['Shh, it’s nearly balanced.', 'They fell UP. Up!', 'Widest first. Always widest first.'],
    talk: {
      entry: [
        { if: { quest: 'arzach2.cairn', done: true }, node: 'after' },
        { if: { quest: 'arzach2.cairn', active: true }, node: 'again' },
        { node: 'hello' },
      ],
      nodes: {
        hello: {
          say: ['Careful! Don’t breathe on it. That’s the footing stone; it’s all that’s left of my cairn.', 'I built it as high as my head, out here on the great table, for the brothers to see from the cliff. Then the cloud rose, and the stones fell off it. *Up.* They fell up.'],
          choices: [
            { text: 'Up where?', goto: 'where' },
            { text: 'Stones don’t fall up.', goto: 'dont' },
            { text: 'Good luck, Tiv.', end: true },
          ],
        },
        dont: { say: ['Tell that to them! (He points past the table’s edge.) Look: the little sky stones, one above the other, all the way up. My three are up there. Brother Calix says when the bell stopped, everything forgot which way was down.'], choices: [{ text: 'I’ll fetch them.', goto: 'fetch' }, { text: 'Up where?', goto: 'where' }] },
        where: { say: ['On the sky stones by the table’s edge, there, climbing round in a ring. You’d have to jump from one to the next, and then jump again in the air. I tried. I fell into the cloud and it put me back here, very rudely.'], choices: [{ text: 'I’ll fetch them.', goto: 'fetch' }] },
        fetch: {
          say: ['Really? There are three: a wide flat one, a round one, and a little egg. Bring them, and we’ll set them back. Widest first, or it all comes down.'],
          do: { start: 'arzach2.cairn' },
          choices: [{ text: 'Widest first.', end: true }],
        },
        again: { say: [{ if: { flag: 'arzach2.cairn.last', is: 'fell' }, text: 'It fell! Widest at the bottom, round in the middle, the egg on top. Like a person: feet, belly, head.' }, { if: { not: { flag: 'arzach2.cairn.last', is: 'fell' } }, text: 'Up the sky stones, round and round. Jump, and jump again in the air. Then widest first on the cairn.' }],
          choices: [{ text: 'Got it.', end: true }] },
        after: {
          say: ['Look at it! Taller than before. And it hums when the wind is right, listen.', 'Brother Calix says a balanced cairn is a prayer that doesn’t need anyone to say it. I think it just looks nice.'],
          choices: [{ text: 'It looks very nice.', end: true }],
        },
      },
    },
  },
};

/** The level's own people (Arzach II's npcs, by index). */
export const LOCALS = [
  {
    id: 'aube', name: 'Sister Aube', title: 'hermit of the edge', color: '#b9a7d8', voice: 0.9,
    talk: {
      entry: [{ if: { flag: 'arzach2.bell.rung' }, node: 'after' }, { if: { flag: 'arzach2.aube.heard' }, node: 'again' }, { node: 'hello' }],
      nodes: {
        hello: {
          say: ['You came up out of the cloud? No. Nobody comes up out of the cloud. You came down out of the sky, then. That is almost as rude.', 'I keep the hermitage at the plateau’s edge. I watch the cloud. It is higher than it was when I was young. Much higher.'],
          choices: [
            { text: 'Why is it higher?', goto: 'why' },
            { text: 'What are the floating stones?', goto: 'stones' },
          ],
        },
        why: {
          say: ['The brothers on the cliff say: the monastery bell stopped, and the stones fell *up*, and the cloud rose to fill the space they left. Ring the bell, they say, and it will all settle.', 'Nobody has rung it in thirty years. Brother Calix will tell you why, if you can get up there. The bird can. I can’t.'],
          do: { set: { 'arzach2.aube.heard': true } },
          choices: [{ text: 'I’ll go up to the monastery.', goto: 'go' }, { text: 'What are the floating stones?', goto: 'stones' }],
        },
        stones: { say: ['Stones that forgot which way was down. That one over the needles has been drifting since my mother’s day. Some evenings it turns, very slowly, as if it heard something.'], choices: [{ text: 'Why is the cloud higher?', goto: 'why' }] },
        go: { say: ['Whistle and the bird will come. She doesn’t like the cloud; nor do I. The monastery is the white one, on the rose cliff, west.'], choices: [{ text: 'Thank you, Sister.', end: true }] },
        again: { say: ['The white monastery, on the rose cliff, west. Brother Calix keeps the bell. Or the bell keeps him; it has been thirty years.'], choices: [{ text: 'Thank you.', end: true }] },
        after: { say: ['Look at it. Look! It has gone down a whole hand since this morning. I can see the stalks of the tables again.', 'Ring it again some day, when you pass. The cloud remembers.'], choices: [{ text: 'I will.', end: true }] },
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
          say: ['Peace, traveller. You have the look of someone who has been told about the bell.', 'Yes. That is it, up there in the belfry. Thirty years silent. I still oil the yoke every morning.'],
          choices: [
            { text: 'Why doesn’t it ring?', goto: 'why' },
            { text: 'Sister Aube says the cloud rose when it stopped.', goto: 'why' },
          ],
        },
        why: {
          say: ['Because it has no clapper. The night the cloud rose, everything loose fell *up*: tiles, pebbles, a goat. The clapper slipped out of the bell and went up with them, and the floating island caught it.', 'It lies on the island now, before the church door. I have looked at it through the glass every day for thirty years. I don’t have a bird.'],
          do: { set: { 'arzach2.calix.asked': true } },
          choices: [{ text: 'I do. I’ll bring it back.', goto: 'bring' }, { text: 'What’s that mark on the bell?', goto: 'mark' }],
        },
        mark: {
          say: ['The Three Notes over the rim. {glyph} The founders cast them into every bell they made: three notes, over the mouth that sings them. Nobody remembers which three.', 'Strange: the night the light went over, years after the clapper fell, the bell hummed. By itself. No clapper. One long note, answering something in the sky that sang.', 'And the blue chest on top of the balanced stones hummed back. A bell-chest, the founders called those: the star on the lid, the Three Notes round it. They say a bell-chest opens only for someone who has come further than the bell can be heard.'],
          do: { set: { 'arzach2.rumour.light': true } },
          choices: [{ text: 'A light that sang? That was the night my ship fell.', goto: 'light' }, { text: 'I’ll bring the clapper back.', goto: 'bring' }],
        },
        light: { say: ['Then the bell knew your ship before you did. Bells are like that. Bring me its tongue, and we will ask it what it heard.'], choices: [{ text: 'I’ll bring it.', goto: 'bring' }] },
        bring: { say: ['The island floats east of here, high over the cloud: the church with two towers. The clapper is bronze, longer than your arm. Mind the edge; the island tilts when it dreams.'], choices: [{ text: 'I’ll be back.', end: true }] },
        again: { say: ['The island, east, high. The church with two towers. The clapper lies before its door.'], choices: [{ text: 'What’s that mark on the bell?', goto: 'mark' }, { text: 'On my way.', end: true }] },
        clapper: {
          say: ['You have it. You have it! Look at it, still bright where it struck. Give it here.', '(He climbs the tower faster than an old monk should, and you hear him up in the belfry, muttering and hammering.)', 'There. It hangs again. Now: the rope, at the foot of the tower. You pull. I can’t bear to.'],
          do: [{ take: 'clapper' }, { set: { 'arzach2.clapper.hung': true } }, { advance: [Q, 'clapper'] }],
          choices: [{ text: 'I’ll ring it.', end: true }],
        },
        rope: { say: ['The rope. At the foot of the tower, on the side facing the plateau. Pull it as if you meant it.'], choices: [{ text: 'All right.', end: true }] },
        listen: {
          say: ['(He has his eyes shut. The last of the note is still in the stones under your feet.)', 'Did you feel it? The cloud went down. Only a little. A hand’s width. But down.', 'Keep that note. It doesn’t belong to the bell; a bell only borrows it. It will go with you now. You will hear it, I think, whenever you let some of that colour out of your tank.'],
          do: [{ set: { 'arzach2.bell.note': true } }, { advance: [Q, 'listen'] },
            { keepsake: { id: 'arzach2.song', level: 'arzach2', name: 'The bell’s note', kind: 'song', text: 'One low note, and the cloud settling a hand’s width under it. It sounds from the tank now whenever you shoot.' } }],
          choices: [{ text: 'Thank you, Brother.', end: true }],
        },
        after: { say: ['I ring it at dawn and at dusk now. The stones come down a little every time. In a hundred years, perhaps, the goat.'], choices: [{ text: '(laugh)', end: true }] },
      },
    },
  },
  {
    id: 'ondine', name: 'Ondine', title: 'who walked to the plain', color: '#e9a17f', voice: 1.0,
    talk: {
      entry: [{ if: { has: 'letter' }, node: 'letter' }, { if: { quest: 'arzach2.letter', started: true }, node: 'after' }, { node: 'hello' }],
      nodes: {
        hello: {
          say: ['Oh! Someone. Walking toward the tower, I hope? It doesn’t get closer for a long time. Then all at once it does.', 'I came out here thirty years ago to find out how old it is. I still don’t know. I know how old I am, which is worse.'],
          choices: [
            { text: 'What’s so special about the tower?', goto: 'tower' },
            { text: 'Your sister is at the monastery.', goto: 'sister' },
          ],
        },
        tower: { say: ['Look at its foot when you get there. There’s a face carved into the plinth, sleeping, with a mark on its brow. The monastery didn’t carve it. Nobody here did. Somebody very big did, a long time before the cloud.'], choices: [{ text: 'I’ll look.', end: true }] },
        sister: { say: ['Ysolde. Still writing letters she doesn’t send, I expect. She thinks I don’t know. I can see the lamp in her window every winter, burning half the night.'], choices: [{ text: 'What’s at the tower?', goto: 'tower' }] },
        letter: {
          say: ['A letter? From… oh. Oh, that’s her hand. Thirty years, and she still crosses her sevens.', '(She reads it. She reads it again. Then she sits down on the warm ground and laughs until she has to wipe her eyes.)', 'It says: *You were right about the tower. I was right about the bell. Come home for supper.* That’s all. Thirty years, and that’s all. That’s everything.'],
          do: [{ take: 'letter' }, { advance: ['arzach2.letter', 'carry'] }],
          next: 'clue',
        },
        clue: {
          say: ['Tell her I’ll come when the bell rings. She’ll know what I mean.', 'And go and look at the face on the tower before you go. I have seen that face once before, in a book of travellers’ drawings: the same face, asleep, in a desert of red sand, half buried. The giants walked there too, the book said. So they walked here.'],
          choices: [{ text: 'I’ll look at it.', end: true }],
        },
        after: { say: [{ if: { flag: 'arzach2.bell.rung' }, text: 'I heard the bell. All the way out here, I heard it. I’ll go home for supper. Not tonight. Soon.' }, { if: { not: { flag: 'arzach2.bell.rung' } }, text: 'When the bell rings, I’ll go home for supper. That’s what I told her. Well, that’s what I told you to tell her.' }],
          choices: [{ text: 'Goodbye, Ondine.', end: true }] },
      },
    },
  },
];

// The scenery you can look at.
export const THINGS = {
  face: {
    id: 'face', name: 'The face on the tower', title: 'carved into the plinth', color: '#f4ecdc', voice: 0.6,
    talk: { nodes: { look: {
      say: ['A face as tall as you, carved into the plinth of the lone tower: eyes shut, mouth calm, the same calm face that sleeps in the desert’s southern dunes. On its brow, the mark: {glyph}',
        'The carving is worn as soft as the dunes. Whoever made it made it from a long way up, as if they were very tall, or kneeling.'],
      do: { set: { 'arzach2.face.seen': true, 'clue.arzach2.desert': true } },
      choices: [{ text: '(remember it)', end: true }],
    } } },
  },
  bell: {
    id: 'bellrope', name: 'The bell rope', title: 'at the foot of the tower', color: '#8a5a3a', voice: 0.6,
    talk: { nodes: { look: {
      say: ['You pull. Far above, the bell swings in its open belfry, and swings back, and makes no sound at all except a wooden creak.', 'It has no clapper.'],
      choices: [{ text: '(let go of the rope)', end: true }],
    } } },
  },
  cairn: {
    id: 'cairn', name: 'Tiv’s cairn', title: 'on the great table', color: '#efe4cf', voice: 0.6,
    talk: {
      entry: [{ if: { flag: 'arzach2.cairn.placed', is: 3 }, node: 'done' }, { node: 'look' }],
      nodes: {
        look: {
          say: [{ if: { flag: 'arzach2.cairn.placed', is: 0 }, text: 'Only the footing stone is left, worn smooth where the others stood on it.' },
            { if: { flag: 'arzach2.cairn.placed', is: 1 }, text: 'The wide flat stone sits on the footing, steady as a table.' },
            { if: { flag: 'arzach2.cairn.placed', is: 2 }, text: 'Two stones now, the round one on the wide one, rocking very slightly in the wind.' }],
          choices: [
            { text: 'Set down the wide flat stone.', if: { has: 'cairn.wide' }, do: { emit: ['arzach2:cairn', 'cairn.wide'] }, goto: 'result' },
            { text: 'Set down the round stone.', if: { has: 'cairn.round' }, do: { emit: ['arzach2:cairn', 'cairn.round'] }, goto: 'result' },
            { text: 'Set down the little egg.', if: { has: 'cairn.egg' }, do: { emit: ['arzach2:cairn', 'cairn.egg'] }, goto: 'result' },
            { text: '(step back)', end: true },
          ],
        },
        result: {
          say: [{ if: { flag: 'arzach2.cairn.last', is: 'ok' }, text: 'It settles with a small click, and stays.' },
            { if: { flag: 'arzach2.cairn.last', is: 'fell' }, text: 'It rocks, and rocks, and slides off into your hands. Widest first, Tiv said.' }],
          choices: [{ text: '(look at it)', if: { flag: 'arzach2.cairn.placed', is: 3 }, goto: 'done' }],
          next: 'look',
        },
        done: { say: ['Three stones on the footing, widest to smallest, and the little egg on top. In the wind the cairn hums, one low note, like a bell a long way off.'], choices: [{ text: '(step back)', end: true }] },
      },
    },
  },
};
