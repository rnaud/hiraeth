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
      { id: 'lamp', text: 'Answer for Ondine with the old signal lamp on the tower’s plinth: turn its mirror to the carved bell (push the tiller from the side: C, middle click, or RB / R1), and light it (shoot)', label: 'The signal lamp', flag: 'arzach2.lamp.answered', at: 'lamp' },
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
    palette: { cloak: '#f3ead8', lining: '#6a3a4a', cloth: '#6a3a4a', legs: '#4a3a2a', hat: '#f3ead8', hair: '#e8dcc0' }, head: 'hood', cape: 1.45, look: { prop: 'bell', body: 'scarf' },
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
          say: ['~playful~ A visitor. On a bird. The last one who came on a bird walked off along the aqueduct and never wrote back.', '~sad~ Not that I can talk. I have written to my sister every winter for thirty years, and never sent one.'],
          choices: [
            { text: '~curious~ Why not?', goto: 'why' },
            { text: '~curious~ Where is your sister?', goto: 'where' },
          ],
        },
        why: { say: ['~tired~ Because she left, and I stayed, and we each thought the other was wrong. Then the cloud rose and the aqueduct was the only way across, and I am too old for aqueducts.'], choices: [{ text: '~happy~ I could carry one.', goto: 'carry' }, { text: '~curious~ Where is she?', goto: 'where' }] },
        where: { say: ['~sad~ Ondine walked out onto *the peach plain, toward the lone tower*. She said the tower was older than the monastery, and she wanted to know by how much. She is still out there. She waves, some evenings. I can see her from the wall.'], choices: [{ text: '~happy~ I could carry a letter.', goto: 'carry' }, { text: '~curious~ What happened to the bell?', goto: 'bell' }] },
        carry: {
          say: ['~happy~ You would? Then take this one; it is the shortest. It says what all the others said, with fewer words.', '~playful~ *Across the long aqueduct*, from the needle plateau to the plain. Don’t read it. Well. Read it if you must, but don’t tell me.'],
          do: [{ give: 'letter' }, { start: 'arzach2.letter' }],
          choices: [{ text: '~neutral~ I’ll bring it to her.', end: true }],
        },
        bell: { say: ['~playful~ *Ask Brother Calix*; it is his bell, he says, though it belongs to the whole cliff. It stopped the night the cloud rose. Or the cloud rose the night it stopped. We argue about that at supper.'], choices: [{ text: '~happy~ I could carry a letter to your sister.', goto: 'carry' }, { text: '~happy~ Thank you.', end: true }] },
        waiting: { say: ['~scared~ You still have it? Good. I mean: go on, then. *The long aqueduct is past the needles*.'], choices: [{ text: '~neutral~ On my way.', end: true }] },
        watching: { say: ['~scared~ You gave it to her? Don’t tell me what she said. I will stand on the wall tonight and *watch the tower*. In case.'], choices: [{ text: '~neutral~ Keep watching.', end: true }] },
        answered: { say: [
          { if: { flag: 'arzach2.lamp.answered' }, text: '~happy~ You gave it to her. I know you did: *the old lamp on the tower* was lit tonight, and turned to us. Three long, one short. She still signals like a novice.' },
          { if: { flag: 'arzach2.lamp.answered' }, text: '~playful~ I answered with mine. And don’t tell me what the letter said. I wrote it.' },
          { if: { not: { flag: 'arzach2.lamp.answered' } }, text: '~happy~ You gave it to her? What did she… no. Don’t tell me. I saw her wave tonight, with both arms. That is enough.' }], choices: [{ text: '~happy~ She laughed.', goto: 'laughed' }, { text: '~happy~ (smile)', end: true }] },
        laughed: { say: ['~happy~ She always did, at the wrong moments. Thank you, child. Next winter I will send one myself. Perhaps.'], choices: [{ text: '~neutral~ Goodbye, Mother.', end: true }] },
        after: { say: ['~happy~ I have started a new letter. It is very short. It says: *come for supper*.'], choices: [{ text: '~happy~ She’ll come.', end: true }] },
      },
    },
  },
  tiv: {
    id: 'tiv', name: 'Tiv', title: 'a novice who balances stones', color: '#9fc3c4', voice: 1.4, kind: 'm', scale: 0.85,
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
          say: ['~scared~ Careful! Don’t breathe on it. That’s the footing stone; it’s all that’s left of my cairn.', '~surprised~ I built it as high as my head, out here on the great table, for the brothers to see from the cliff. Then the night the light went over, the bell hummed, and the stones fell off it. *Up.* They fell up.'],
          choices: [
            { text: '~curious~ Up where?', goto: 'where' },
            { text: '~playful~ Stones don’t fall up.', goto: 'dont' },
          ],
        },
        dont: { say: ['~angry~ Tell that to them! (He points past the table’s edge.) Look: *the little sky stones*, one above the other, all the way up. My three are up there. Brother Calix says when the bell stopped, everything forgot which way was down.'], choices: [{ text: '~neutral~ I’ll fetch them.', goto: 'fetch' }, { text: '~curious~ Up where?', goto: 'where' }] },
        where: { say: ['~playful~ *On the sky stones by the table’s edge*, there, climbing round in a ring. You’d have to jump from one to the next, and then *jump again in the air*. I tried. I fell into the cloud and it put me back here, very rudely.'], choices: [{ text: '~neutral~ I’ll fetch them.', goto: 'fetch' }] },
        fetch: {
          say: ['~happy~ Really? There are three: a wide flat one, a round one, and a little egg. Bring them, and we’ll set them back. *Widest first*, or it all comes down.'],
          do: { start: 'arzach2.cairn' },
          choices: [{ text: '~playful~ Widest first.', end: true }],
        },
        again: { say: [{ if: { flag: 'arzach2.cairn.last', is: 'fell' }, text: '~angry~ It fell! *Widest at the bottom*, round in the middle, the egg on top. Like a person: feet, belly, head.' }, { if: { not: { flag: 'arzach2.cairn.last', is: 'fell' } }, text: '~neutral~ *Up the sky stones*, round and round. Jump, and jump again in the air. Then *widest first on the cairn*.' }],
          choices: [{ text: '~neutral~ Got it.', end: true }] },
        after: {
          say: ['~happy~ Look at it! Taller than before. And it hums when the wind is right, listen.', '~playful~ Brother Calix says a balanced cairn is a prayer that doesn’t need anyone to say it. I think it just looks nice.'],
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
          say: ['~playful~ You came up out of the cloud? No. Nobody comes up out of the cloud. You came down out of the sky, then. That is almost as rude.', '~scared~ I keep the hermitage at the plateau’s edge. I watch the cloud. It is higher than it was when I was young. Much higher.'],
          choices: [
            { text: '~curious~ Why is it higher?', goto: 'why' },
            { text: '~curious~ What are the floating stones?', goto: 'stones' },
          ],
        },
        why: {
          say: ['~solemn~ The brothers on the cliff say the bell kept the world down. It stopped, and everything loose fell *up*, and the cloud rose to fill the space it left. *Ring the bell*, they say, and it will all settle.', '~tired~ Nobody has rung it in thirty years. *Brother Calix* will tell you why, if you can get up there. The bird can. I can’t.'],
          do: { set: { 'arzach2.aube.heard': true } },
          choices: [{ text: '~neutral~ I’ll go up to the monastery.', goto: 'go' }, { text: '~curious~ What are the floating stones?', goto: 'stones' }],
        },
        stones: { say: ['~curious~ Stones that forgot which way was down, long before the bell stopped, whatever the brothers say. That one over the needles has been drifting since my mother’s day. Some evenings it turns, very slowly, as if it heard something.'], choices: [{ text: '~curious~ Why is the cloud higher?', goto: 'why' }] },
        go: { say: ['~neutral~ *Whistle and the bird will come*. She doesn’t like the cloud; nor do I. The monastery is *the white one, on the rose cliff, west*.'], choices: [{ text: '~happy~ Thank you, Sister.', end: true }] },
        again: { say: ['~playful~ *The white monastery, on the rose cliff, west*. Brother Calix keeps the bell. Or the bell keeps him; it has been thirty years.'], choices: [{ text: '~happy~ Thank you.', end: true }] },
        after: { say: ['~surprised~ Look at it. Look! It has gone down a whole hand since this morning. I can see the stalks of the tables again.', '~solemn~ Ring it again some day, when you pass. The cloud remembers.'], choices: [{ text: '~neutral~ I will.', end: true }] },
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
          say: ['~happy~ Peace, traveller. You have the look of someone who has been told about the bell.', '~sad~ Yes. That is it, up there in the belfry. Thirty years silent. I still oil the yoke every morning.'],
          choices: [
            { text: '~curious~ Why doesn’t it ring?', goto: 'why' },
            { text: '~neutral~ Sister Aube says the cloud rose when it stopped.', goto: 'why' },
          ],
        },
        why: {
          say: ['~neutral~ Because it has no clapper. The night the cloud rose, everything loose fell *up*: tiles, pebbles, a goat. The clapper slipped out of the bell and went up with them, and the floating island caught it.', '~sad~ It lies *on the island now, before the church door*. I have looked at it through the glass every day for thirty years. I don’t have a bird.'],
          do: { set: { 'arzach2.calix.asked': true } },
          choices: [{ text: '~happy~ I do. I’ll bring it back.', goto: 'bring' }, { text: '~curious~ What’s that mark on the bell?', goto: 'mark' }],
        },
        mark: {
          say: ['~solemn~ The Three Notes over the rim. {glyph} The founders cast them into every bell they made: three notes, over the mouth that sings them. Nobody remembers which three.', '~whisper~ Strange: the night the light went over, years after the clapper fell, the bell hummed. By itself. No clapper. One long note, answering something in the sky that sang.', '~solemn~ And the blue chest *on top of the balanced stones* hummed back. A bell-chest, the founders called those: the star on the lid, the Three Notes round it. They say a bell-chest opens only for someone who has come further than the bell can be heard.'],
          do: { set: { 'arzach2.rumour.light': true } },
          choices: [{ text: '~surprised~ A light that sang? That was the night my ship was struck.', goto: 'light' }, { text: '~neutral~ I’ll bring the clapper back.', goto: 'bring' }],
        },
        light: { say: ['~solemn~ Then the bell knew your ship before you did. Bells are like that. *Bring me its tongue*, and we will ask it what it heard.'], choices: [{ text: '~neutral~ I’ll bring it.', goto: 'bring' }] },
        bring: { say: ['~neutral~ The island floats *east of here, high over the cloud*: *the church with two towers*. The clapper is bronze, longer than your arm. Mind the edge; the island tilts when it dreams.'], choices: [{ text: '~neutral~ I’ll be back.', end: true }] },
        again: { say: ['~neutral~ *The island, east, high*. *The church with two towers*. The clapper lies before its door.'], choices: [{ text: '~curious~ What’s that mark on the bell?', goto: 'mark' }, { text: '~neutral~ On my way.', end: true }] },
        clapper: {
          say: ['~surprised~ You have it. You have it! Look at it, still bright where it struck. Give it here.', '~playful~ (He climbs the tower faster than an old monk should, and you hear him up in the belfry, muttering and hammering.)', '~scared~ There. It hangs again. Now: *the rope, at the foot of the tower*. You pull. I can’t bear to.'],
          do: [{ take: 'clapper' }, { set: { 'arzach2.clapper.hung': true } }, { advance: [Q, 'clapper'] }],
          choices: [{ text: '~neutral~ I’ll ring it.', end: true }],
        },
        rope: { say: ['~neutral~ The rope. *At the foot of the tower*, on the side facing the plateau. *Pull it as if you meant it*.'], choices: [{ text: '~neutral~ All right.', end: true }] },
        listen: {
          say: ['~whisper~ (He has his eyes shut. The last of the note is still in the stones under your feet.)', '~happy~ Did you feel it? The cloud went down. Only a little. A hand’s width. But down.', '~solemn~ Keep that note. It doesn’t belong to the bell; a bell only borrows it. It will go with you now. You will hear it, I think, whenever you let some of that colour out of your tank.'],
          do: [{ set: { 'arzach2.bell.note': true } }, { advance: [Q, 'listen'] },
            { keepsake: { id: 'arzach2.song', level: 'arzach2', name: 'The bell’s note', kind: 'song', text: 'One low note, and the cloud settling a hand’s width under it. It sounds from the tank now whenever you shoot.' } }],
          choices: [{ text: '~happy~ Thank you, Brother.', end: true }],
        },
        after: { say: ['~playful~ I ring it at dawn and at dusk now. The stones come down a little every time. In a hundred years, perhaps, the goat.'], choices: [{ text: '~happy~ (laugh)', end: true }] },
      },
    },
  },
  {
    id: 'ondine', name: 'Ondine', title: 'who walked to the plain', color: '#e9a17f', voice: 1.0,
    talk: {
      entry: [{ if: { has: 'letter' }, node: 'letter' }, { if: { quest: 'arzach2.letter', stage: 'lamp' }, node: 'lamp' }, { if: { quest: 'arzach2.letter', started: true }, node: 'after' }, { node: 'hello' }],
      nodes: {
        hello: {
          say: ['~surprised~ Oh! Someone. Walking toward the tower, I hope? It doesn’t get closer for a long time. Then all at once it does.', '~playful~ I came out here thirty years ago to find out how old it is. I still don’t know. I know how old I am, which is worse.'],
          choices: [
            { text: '~curious~ What’s so special about the tower?', goto: 'tower' },
            { text: '~neutral~ Your sister is at the monastery.', goto: 'sister' },
          ],
        },
        tower: { say: ['~solemn~ *Look at its foot* when you get there. There’s *a face carved into the plinth*, sleeping, with a mark on its brow. The monastery didn’t carve it. Nobody here did. Somebody very big did, a long time before the cloud.'], choices: [{ text: '~neutral~ I’ll look.', end: true }] },
        sister: { say: ['~sad~ Ysolde. Still writing letters she doesn’t send, I expect. She thinks I don’t know. I can see the lamp in her window every winter, burning half the night.'], choices: [{ text: '~curious~ What’s at the tower?', goto: 'tower' }] },
        letter: {
          say: ['~surprised~ A letter? From… oh. Oh, that’s her hand. Thirty years, and she still crosses her sevens.', '~happy~ (She reads it. She reads it again. Then she sits down on the warm ground and laughs until she has to wipe her eyes.)', '~happy~ It says: *You were right about the tower. I was right about the bell. Come home for supper.* That’s all. Thirty years, and that’s all. That’s everything.'],
          do: [{ take: 'letter' }, { advance: ['arzach2.letter', 'carry'] }],
          next: 'clue',
        },
        clue: {
          say: ['~happy~ Tell her I’ll come when the bell rings. No: I’ll tell her myself, tonight, the way the monks talked across the plain before the cloud.',
            '~playful~ *The old signal lamp on the plinth*, at the tower’s foot. Its mirror has to look at the rose cliff: *a little bell is cut into the stone* where it should point. *Push the tiller* from the side to turn it, then *give it a light*. My arms are too old for that tiller.'],
          next: 'giants',
        },
        giants: {
          say: ['~solemn~ And go and *look at the face on the tower* before you go. I have seen that face once before, in a book of travellers’ drawings: the same face, asleep, in a desert of red sand, half buried. The giants walked there too, the book said. So they walked here.'],
          choices: [{ text: '~neutral~ I’ll light the lamp.', end: true }],
        },
        lamp: { say: [{ if: { flag: 'arzach2.lamp.lit' }, text: '~curious~ It’s lit! Now *turn it to the cliff*: the mirror must look at *the little carved bell*. *Push the tiller* side-on; shoved straight along, it won’t budge.' },
          { if: { not: { flag: 'arzach2.lamp.lit' } }, text: '~playful~ *The signal lamp, on the plinth*. Turn its mirror to *the little carved bell*, *push the tiller* side-on, then *give it a light*. Go on. She’ll be on the wall by now.' }],
          choices: [{ text: '~neutral~ All right.', end: true }] },
        after: { say: [{ if: { flag: 'arzach2.lamp.answered' }, text: '~happy~ Did you see? Her window lit up on the cliff the moment ours did. She was watching. Thirty years, and she was watching.' }, { if: { flag: 'arzach2.bell.rung' }, text: '~happy~ I heard the bell. All the way out here, I heard it. I’ll go home for supper. Not tonight. Soon.' }, { if: { not: { flag: 'arzach2.bell.rung' } }, text: '~playful~ When the bell rings, I’ll go home for supper. That’s what I told her. Well, that’s what I told you to tell her.' }],
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
      say: ['~solemn~ A face as tall as you, carved into the plinth of the lone tower: eyes shut, mouth calm, the same calm face that sleeps in *the desert’s southern dunes*. On its brow, the mark: {glyph}',
        '~curious~ The carving is worn as soft as the dunes. Whoever made it made it from a long way up, as if they were very tall, or kneeling.'],
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
          say: ['~neutral~ An old bronze brazier on a stone turntable, with a polished mirror cupped behind it like a hand round a candle. A wooden tiller sticks out at the back. The oil in it still smells sweet.',
            { if: { flag: 'arzach2.lamp.notch', is: 0 }, text: '~curious~ Eight notches are cut round the turntable, and by one of them *a little bell is carved*. The mirror looks straight at it: north, to the rose cliff.' },
            { if: { not: { flag: 'arzach2.lamp.notch', is: 0 } }, text: '~curious~ Eight notches are cut round the turntable, and by one of them *a little bell is carved*. The mirror looks away from it, out over the empty plain. *Push the tiller* from the side to turn it.' },
            { if: { not: { flag: 'arzach2.lamp.lit' } }, text: '~neutral~ The wick is dry, but it would take a light. (*Shoot*: aim with R, right click or LT / L2, then shoot with G, a click or RT / R2.)' }],
          choices: [{ text: '~neutral~ (step back)', end: true }],
        },
        answered: { say: ['~solemn~ The lamp burns steady, its mirror turned to the rose cliff. Far off on the cliff, small as a star, a window burns back.'], choices: [{ text: '~neutral~ (step back)', end: true }] },
      },
    },
  },
  tiles: {
    id: 'tiles', name: 'Fallen-up tiles', title: 'before the church door', color: '#c9765c', voice: 0.6,
    talk: { nodes: { look: {
      say: ['~neutral~ A heap of roof tiles, the ones that fell up with the clapper, has come down on top of it. A bronze end sticks out from under them, bright where it struck.',
        '~neutral~ They are heavy and wedged tight. *A good shove would scatter them*. (*Push*: C, middle click, or RB / R1.)'],
      choices: [{ text: '~neutral~ (step back)', end: true }],
    } } },
  },
  bell: {
    id: 'bellrope', name: 'The bell rope', title: 'at the foot of the tower', color: '#8a5a3a', voice: 0.6,
    talk: { nodes: { look: {
      say: ['~neutral~ You pull. Far above, the bell swings in its open belfry, and swings back, and makes no sound at all except a wooden creak.', '~sad~ *It has no clapper*.'],
      choices: [{ text: '~neutral~ (let go of the rope)', end: true }],
    } } },
  },
  cairn: {
    id: 'cairn', name: 'Tiv’s cairn', title: 'on the great table', color: '#efe4cf', voice: 0.6,
    talk: {
      entry: [{ if: { flag: 'arzach2.cairn.placed', is: 3 }, node: 'done' }, { node: 'look' }],
      nodes: {
        look: {
          say: [{ if: { flag: 'arzach2.cairn.placed', is: 0 }, text: '~sad~ Only the footing stone is left, worn smooth where the others stood on it.' },
            { if: { flag: 'arzach2.cairn.placed', is: 1 }, text: '~neutral~ The wide flat stone sits on the footing, steady as a table.' },
            { if: { flag: 'arzach2.cairn.placed', is: 2 }, text: '~neutral~ Two stones now, the round one on the wide one, rocking very slightly in the wind.' }],
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
            { if: { flag: 'arzach2.cairn.last', is: 'fell' }, text: '~tired~ It rocks, and rocks, and slides off into your hands. *Widest first*, Tiv said.' }],
          choices: [{ text: '~happy~ (look at it)', if: { flag: 'arzach2.cairn.placed', is: 3 }, goto: 'done' }],
          next: 'look',
        },
        done: { say: ['~solemn~ Three stones on the footing, widest to smallest, and the little egg on top. In the wind the cairn hums, one low note, like a bell a long way off.'], choices: [{ text: '~neutral~ (step back)', end: true }] },
      },
    },
  },
};
