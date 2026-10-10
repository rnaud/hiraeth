// The night mail, as data: a side quest given in the Signal Market that takes you aboard the Overnight Train
// (docs/story-bible.md, "The night mail"; the story alive: src/story/night-train.js).
//
// At the market's south end, past the landing, a spur of rail runs out into the dark to a night halt: a platform, a
// lamp, a bell. The Overnight Train has no address; for forty years the halt has been its post office. Edda keeps the
// lamp there and sorts the night mail. Her grandmother Mireille boarded the night Edda was born, "to see where the plain
// ends", and never got off: a postcard comes back to the halt every year, never a word more. This year Edda has
// written back, and she can't leave the lamp. Ring the bell, board, find Mireille (up on the roofs of the long tail, by
// the chalk mark she keeps: the train's trace, sightings-detours.js), give her the letter, ask Ambrose the conductor to
// stop at the market's halt, step off, and bring Edda the answer.
//
// Flags: nightmail.rang (the bell rung, the train called), nightmail.stop (Ambrose asked: the train brakes into the halt).
// Items: letter (Edda's letter), reply (Mireille's answer). Quest stages: edda, board, find, mireille, stop, off, home.

export const Q = 'bazaar.nightmail';
export const ITEMS = { letter: 'Edda’s letter', reply: 'Mireille’s answer' };

export const QUESTS = [
  {
    id: Q, title: 'The Night Mail', world: 'bazaar', major: true,
    outro: 'Mireille’s answer is pinned up under the halt’s lamp. Edda reads it every night, before the bell.',
    stages: [
      { id: 'edda', text: 'Someone keeps a lamp at the night halt past the market’s south gate', label: 'Edda, at the night halt', talk: 'edda' },
      { id: 'board', text: 'Ring the halt’s bell and board the Overnight Train', label: 'The halt’s bell', at: 'bell' },
      { id: 'find', text: 'Find Mireille aboard: ask the conductor', label: 'Ambrose, the conductor', talk: 'ambrose' },
      { id: 'mireille', text: 'Give Mireille Edda’s letter, up on the roofs of the long tail', label: 'Mireille, on the last carriage’s roof', bring: 'letter', to: 'mireille' },
      { id: 'stop', text: 'Ask the conductor to stop at the market’s halt', label: 'Ambrose, the conductor', talk: 'ambrose' },
      { id: 'off', text: 'Step down onto the platform when the train halts', label: 'The platform', at: 'stepOff' },
      { id: 'home', text: 'Bring Edda her grandmother’s answer', label: 'Edda, at the night halt', bring: 'reply', to: 'edda' },
    ],
  },
];

// ------------------------------------------------------------------ the people
export const PEOPLE = {
  edda: {
    id: 'edda', name: 'Edda', title: 'who keeps the night halt', color: '#e8a24a', voice: 1.08, kind: 'f', scale: 0.95, lang: 'bazaar',
    palette: { cloak: '#e8a24a', lining: '#5a4a7a', cloth: '#f4e6c8', legs: '#3e3a5a', hat: '#5a4a7a', hair: '#2a2030' }, head: 'cap', cape: 1.0,
    lines: ['~neutral~ Night mail. Mind the lamp.', '~curious~ Is that the bell? No. Not yet.', '~tired~ Forty years of postcards. One a year.'],
    talk: {
      entry: [
        { if: { quest: Q, done: true }, node: 'after' },
        { if: { all: [{ quest: Q, stage: 'home' }, { has: 'reply' }] }, node: 'answer' },
        { if: { quest: Q, stage: ['board', 'find', 'mireille', 'stop', 'off', 'home'] }, node: 'again' },
        { node: 'hello' },
      ],
      nodes: {
        hello: {
          say: ['~neutral~ Night mail. Mind the lamp, it’s older than the market.',
            '~curious~ You came down the spur on purpose? Nobody does. The halt’s for the train, and the train’s for nobody.',
            '~neutral~ Edda. I keep the lamp and I sort what comes in for the Overnight Train. It has no address, you see. We’re its post office.'],
          choices: [
            { text: '~curious~ Mail for a train?', goto: 'mail' },
            { text: '~curious~ Who rides it?', goto: 'who' },
          ],
        },
        mail: {
          say: ['~happy~ People write to the people aboard. The train slows through here once a night, and I hand the sack up to the conductor.',
            '~sad~ And once a year a postcard comes down for me. A drawing of the plain, and one line. My grandmother’s.'],
          choices: [{ text: '~curious~ Your grandmother?', goto: 'mireille' }],
        },
        who: {
          say: ['~whisper~ Sleepers, mostly. Some boarded so long ago they’ve stopped counting stations.',
            '~sad~ My grandmother is one of them.'],
          choices: [{ text: '~curious~ Tell me about her.', goto: 'mireille' }],
        },
        mireille: {
          say: ['~solemn~ Mireille. She boarded the night I was born. To see where the plain ends, she wrote. Forty years ago.',
            '~sad~ Every year one postcard. Never a question. I never wrote back: she never stayed anywhere long enough to have an address.',
            '~neutral~ This year I wrote. It’s here. But I can’t leave the lamp, and the conductor only takes sacks, not people’s words.'],
          choices: [{ text: '~neutral~ I’ll take it to her.', goto: 'take' }, { text: '~curious~ What does it say?', goto: 'says' }],
        },
        says: {
          say: ['~playful~ That’s between me and her. It’s not a long letter.', '~sad~ It took me forty years to write, that’s all.'],
          choices: [{ text: '~neutral~ I’ll take it to her.', goto: 'take' }],
        },
        take: {
          say: ['~surprised~ You would? Then *ring the bell on the platform*: the train stops for the bell, it has to.',
            '~neutral~ *Ask Ambrose the conductor* for her. He knows everyone aboard by the cup they drink from.',
            '~happy~ And come back down at *the market’s halt*. Ambrose stops here if you ask him nicely.',
            '~playful~ Your ship? The porters will have it up on the landing wagon before the bell stops ringing. The night train carries ships for nothing.'],
          do: [{ stage: [Q, 'board'] }, { give: 'letter' }],
          choices: [{ text: '~neutral~ I’ll ring the bell.', end: true }],
        },
        again: {
          say: [{ if: { quest: Q, stage: 'board' }, text: '~neutral~ *The bell*, on the post by the lamp. The train comes when it’s rung.' },
            { if: { not: { quest: Q, stage: 'board' } }, text: '~curious~ You’re back? Did you find her? No, the letter’s still in your coat. Go on.' }],
          choices: [{ text: '~neutral~ On my way.', end: true }],
        },
        answer: {
          say: ['~surprised~ That’s her hand. That’s her hand on the envelope.',
            '~whisper~ (Edda reads it under the lamp, twice. She folds it very small.)',
            '~happy~ She says the plain doesn’t end. She says she’ll get off at the market’s halt next spring, to see if the lamp is still lit.',
            '~solemn~ It will be.'],
          do: [{ take: 'reply' }, { advance: [Q, 'home'] }],
          choices: [{ text: '~happy~ Keep it lit.', end: true }],
        },
        after: {
          say: ['~happy~ Spring, she said. I’ve started counting nights instead of postcards.', '~neutral~ The bell’s there if you want another ride. Ambrose doesn’t mind.'],
          choices: [{ text: '~neutral~ Goodnight, Edda.', end: true }],
        },
      },
    },
  },
  ambrose: {
    id: 'ambrose', name: 'Ambrose', title: 'the conductor', color: '#3a4a7a', voice: 0.82, kind: 'm', age: 'elder', scale: 1.02, lang: 'bazaar',
    palette: { cloak: '#2e3a6a', lining: '#c89a5a', cloth: '#f4ece0', legs: '#22284a', hat: '#2e3a6a', hair: '#d8d0c0' }, head: 'cap', cape: 0.9,
    lines: ['~neutral~ Tickets? No. Nobody has a ticket. Welcome aboard.', '~happy~ Mind the porches at speed.', '~solemn~ Next stop: wherever someone asks.'],
    talk: {
      entry: [
        { if: { quest: Q, stage: 'find' }, node: 'find' },
        { if: { quest: Q, stage: 'mireille' }, node: 'where' },
        { if: { quest: Q, stage: 'stop' }, node: 'stop' },
        { if: { quest: Q, stage: 'off' }, node: 'braking' },
        { node: 'hello' },
      ],
      nodes: {
        hello: {
          say: ['~neutral~ Ambrose. I conduct. Mostly I pour tea and count the sleepers in the long tail.',
            '~curious~ Nobody gets on, and nobody gets off. Except you, apparently. Want a stop? I can ring ahead.'],
          choices: [
            { text: '~neutral~ Stop at the market’s halt.', do: [{ set: { 'nightmail.stop': true } }], goto: 'ringing' },
            { text: '~neutral~ Not yet.', end: true },
          ],
        },
        find: {
          say: ['~surprised~ Mireille? Somebody’s come for Mireille?',
            '~neutral~ She doesn’t sit inside. Forty years, and she’s never once taken a seat. She rides *the roofs of the long tail*, at the very back.',
            '~playful~ Out past the landing wagon, *up the ladder on the porch*, and walk till the rails run out behind you. Hold on to your hat.'],
          do: [{ advance: [Q, 'find'] }],
          choices: [{ text: '~neutral~ The roofs. Right.', end: true }],
        },
        where: {
          say: ['~neutral~ *The very back*, on the roofs. You’ll see the chalk before you see her.'],
          choices: [{ text: '~neutral~ Thanks.', end: true }],
        },
        stop: {
          say: ['~curious~ She gave you something for the halt? Then the halt it is.',
            '~shout~ (Ambrose leans out of the window and pulls a cord. Far ahead, the whistle answers.)',
            '~neutral~ We’ll be braking in a minute. *Step down on the station side* once we stop: the platform’s on your right going forward.'],
          do: [{ set: { 'nightmail.stop': true } }, { advance: [Q, 'stop'] }],
          choices: [{ text: '~happy~ Thank you, Ambrose.', end: true }],
        },
        ringing: {
          say: ['~shout~ (Ambrose pulls the cord. Far ahead, the whistle answers.)', '~neutral~ The market’s halt, then. *Step down on the station side* when we stop.'],
          choices: [{ text: '~neutral~ Thank you.', end: true }],
        },
        braking: {
          say: ['~neutral~ Feel that? Braking. *The station side*, when we’ve stopped. Mind the gap.'],
          choices: [{ text: '~neutral~ Right.', end: true }],
        },
      },
    },
  },
  mireille: {
    id: 'mireille', name: 'Mireille', title: 'who rides the roofs', color: '#c86a5a', voice: 0.9, kind: 'f', age: 'elder', scale: 0.92, lang: 'bazaar',
    palette: { cloak: '#c86a5a', lining: '#4a3a5a', cloth: '#e8dcc8', legs: '#4a3a5a', hat: '#e8dcc8', hair: '#f0ece4' }, head: 'wrap', cape: 1.5,
    lines: ['~whisper~ Sit, if you like. Hold on.', '~happy~ Look at it go.', '~solemn~ The chalk again. Every night.'],
    talk: {
      entry: [
        { if: { quest: Q, stage: 'mireille' }, node: 'hello' },
        { if: { quest: Q, reached: 'stop' }, node: 'after' },
        { node: 'stranger' },
      ],
      nodes: {
        stranger: {
          say: ['~neutral~ (An old woman sits cross-legged on the last roof, a stub of chalk in her hand, watching the rails run out behind.)',
            '~happy~ You found the best seat. Sit, if you like. Hold on.'],
          choices: [{ text: '~curious~ The chalk mark?', goto: 'chalk' }, { text: '~neutral~ Goodnight.', end: true }],
        },
        hello: {
          say: ['~curious~ A visitor, up here? Ambrose must have sent you. He thinks I’ll fall off one of these nights.',
            '~neutral~ (You hold out the letter. She looks at the hand on the envelope for a long time before she takes it.)'],
          choices: [{ text: '~neutral~ It’s from Edda.', goto: 'letter' }],
        },
        letter: {
          say: ['~whisper~ Edda. She was this big. She was an hour old.',
            '~sad~ (She reads it with her back to the wind, holding the page flat with both hands.)',
            '~sad~ Forty years of postcards. I never asked her anything, in case she didn’t answer.',
            '~solemn~ (She writes on the back of the letter with the chalk, folds it, and gives it back to you.) Take her that. And tell Ambrose to stop at the market. Tell him I said so.'],
          do: [{ take: 'letter' }, { give: 'reply' }, { advance: [Q, 'mireille'] }],
          choices: [{ text: '~curious~ The mark you chalk up here?', goto: 'chalk' }, { text: '~neutral~ I’ll take it to her.', end: true }],
        },
        chalk: {
          say: ['~neutral~ It was here the night I boarded. Old chalk, nearly gone. I drew it over so it wouldn’t be.',
            '~curious~ I don’t know who drew it first. Somebody who rode up here, and wanted to be seen from the sky, I think.',
            '~playful~ So I keep it. A train should have one thing nobody can explain.'],
          choices: [{ text: '~neutral~ Goodnight, Mireille.', end: true }],
        },
        after: {
          say: [{ if: { has: 'reply' }, text: '~neutral~ Go on, go on. Ambrose, then the halt. She’ll be waiting by the lamp. She always is, I expect.' },
            { if: { not: { has: 'reply' } }, text: '~happy~ Spring. I said spring. I’ll have to get off this thing and remember how stairs work.' }],
          choices: [{ text: '~neutral~ Goodnight.', end: true }],
        },
      },
    },
  },
};

/** The halt's bell and the step down, as things to look at (their words when they can't be used yet). */
export const THINGS = {
  bell: { id: 'nightmail.bell', name: 'The halt’s bell', talk: { nodes: { look: { say: ['~neutral~ (A brass bell on a post by the lamp, its rope worn pale. A card under it: RING FOR THE NIGHT TRAIN. IT WILL STOP.)'] } } } },
  timetable: { id: 'nightmail.timetable', name: 'The timetable', talk: { nodes: { look: { say: ['~curious~ (A timetable under glass. Every column says the same thing: WHEN RUNG.)'] } } } },
  platform: { id: 'nightmail.platform', name: 'The platform', talk: { nodes: { look: { say: ['~neutral~ (The train hasn’t stopped yet. The plain runs past under the step.)'] } } } },
};

/** What the train's passengers say once the bell has rung for you (crowd lines: toned). */
export const BOARDING_LINES = [
  '~surprised~ Someone got on! At a halt! I saw it.',
  '~curious~ You’re the one with the letter? The whole carriage knows.',
  '~whisper~ Mireille? On the roofs. She always is.',
];
