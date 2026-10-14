// The night mail, as data: a side quest given in the Signal Market that takes you aboard the Overnight Train
// (docs/story-bible.md, "The night mail"; the story alive: src/story/night-train.js).
//
// At the market's south end, past the landing, a spur of rail runs out into the dark to a night halt: a platform, a
// lamp, a bell. The Overnight Train has no address; for forty years the halt has been its post office. Edda keeps the
// lamp there and sorts the night mail. Her grandmother Solange boarded the night Edda was born, "to see where the plain
// ends", and never got off: a postcard comes back to the halt every year, never a word more. This year Edda has
// written back, and she can't leave the lamp. Ring the bell, board, find Solange (up on the roofs of the long tail, by
// the chalk mark she keeps: the train's trace, sightings-detours.js), give her the letter (she pulls the cord for the
// market's halt herself). Her answer in your hand is the errand done (issue #279: reaching the goal completes the
// quest): you step off at the halt, and Edda reads it when you pass her lamp, no step of it (it was "Step off when the
// train halts", "Bring Edda her grandmother's answer": a report-back; src/save-migrate.js step 27 moves a save on
// either to done, the answer still in his coat). Edda says where Solange rides, and Solange stops the train: Ambrose
// the conductor is someone you meet aboard, not a stop of the quest (it was Edda → Ambrose → Solange → Ambrose, one
// person sending you to the next, issue #85; src/save-migrate.js step 15 moves a save at 'find' or 'stop').
//
// Flags: nightmail.rang (the bell rung, the train called), nightmail.stop (a stop asked: the train brakes into the halt),
// nightmail.read (Edda has read the answer). Items: letter (Edda's letter), reply (Solange's answer, until Edda reads
// it). Quest stages: edda, board, mireille.

export const Q = 'bazaar.nightmail';
export const ITEMS = { letter: 'Edda’s letter', reply: 'Solange’s answer' };

export const QUESTS = [
  {
    id: Q, title: 'The Night Mail', world: 'bazaar', major: true,
    outro: 'Solange wrote back in chalk, on the back of Edda’s letter, and pulled the cord for the market’s halt.',
    // (her answer in your hand is the end, issue #279: Edda reads it when you pass, no step of it)
    stages: [
      { id: 'edda', text: 'Hear Edda out at the night halt', label: 'Edda, at the night halt', talk: 'edda' },
      { id: 'board', text: 'Ring the bell and board the train', label: 'The halt’s bell', at: 'bell' },
      { id: 'mireille', text: 'Give Solange the letter, on the last roof', label: 'Solange, on the last carriage’s roof', bring: 'letter', to: 'mireille' },
    ],
  },
];

// ------------------------------------------------------------------ the people
export const PEOPLE = {
  edda: {
    id: 'edda', name: 'Edda', title: 'who keeps the night halt', color: '#e8a24a', voice: 1.08, kind: 'f', scale: 0.95, lang: 'bazaar',
    palette: { cloak: '#e8a24a', lining: '#5a4a7a', cloth: '#f4e6c8', legs: '#3e3a5a', hat: '#5a4a7a', hair: '#2a2030' }, head: 'cap', cape: 0,
    lines: ['~neutral~ Night mail. Mind the lamp.', '~curious~ Is that the bell? No. Not yet.', '~tired~ Forty years of postcards. One a year.'],
    talk: {
      entry: [
        // (the answer in your coat: she reads it when you pass, once)
        { if: { all: [{ has: 'reply' }, { not: { flag: 'nightmail.read' } }] }, node: 'answer' },
        { if: { quest: Q, done: true }, node: 'after' },
        { if: { quest: Q, stage: ['board', 'mireille'] }, node: 'again' },
        { node: 'hello' },
      ],
      nodes: {
        hello: {
          say: ['~neutral~ Night mail. Mind the lamp, it’s older than the market.',
            '~curious~ You came down the spur on purpose? Nobody does. The halt’s for the train, and the train’s for nobody.',
            '~neutral~ I keep the lamp, and I sort what comes in for the Overnight Train. It has no address, you see. We’re its post office.'],
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
          say: ['~solemn~ Solange. She boarded the night I was born. To see where the plain ends, she wrote. Forty years ago.',
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
            '~neutral~ She never sits inside. She rides *the roofs of the long tail*, at the very back, by a chalk mark.',
            '~happy~ If she writes back, the train stops at *the market’s halt* when someone asks.',
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
          do: [{ take: 'reply' }, { set: { 'nightmail.read': true } }],
          choices: [{ text: '~happy~ Keep it lit.', end: true }],
        },
        after: {
          say: ['~happy~ Spring, she said. I’ve started counting nights instead of postcards.', '~neutral~ The bell’s there if you want another ride. Ambrose doesn’t mind.'],
          choices: [{ text: '~happy~ Count them to spring, then.', end: true }],
        },
      },
    },
  },
  ambrose: {
    id: 'ambrose', name: 'Ambrose', title: 'the conductor', color: '#3a4a7a', voice: 0.82, kind: 'm', age: 'elder', scale: 1.02, lang: 'bazaar',
    palette: { cloak: '#2e3a6a', lining: '#c89a5a', cloth: '#f4ece0', legs: '#22284a', hat: '#2e3a6a', hair: '#d8d0c0' }, head: 'cap', cape: 0,
    lines: ['~neutral~ Tickets? No. Nobody has a ticket. Welcome aboard.', '~happy~ Mind the porches at speed.', '~solemn~ Next stop: wherever someone asks.'],
    talk: {
      entry: [
        { if: { all: [{ quest: Q, stage: 'mireille' }, { has: 'letter' }] }, node: 'find' },
        { if: { flag: 'nightmail.stop' }, node: 'braking' },
        { node: 'hello' },
      ],
      nodes: {
        hello: {
          say: ['~neutral~ Tickets? Nobody has one; I conduct anyway. Mostly I pour tea and count the sleepers in the long tail.',
            '~curious~ Nobody gets on, and nobody gets off. Except you, apparently. Want a stop? I can ring ahead.'],
          choices: [
            { text: '~neutral~ Stop at the market’s halt.', do: [{ set: { 'nightmail.stop': true } }], goto: 'ringing' },
            { text: '~neutral~ Not yet.', end: true },
          ],
        },
        find: {
          say: ['~surprised~ A letter? For Solange? Somebody’s written to Solange?',
            '~neutral~ She doesn’t sit inside. Forty years, and she’s never once taken a seat. She rides *the roofs of the long tail*, at the very back.',
            '~playful~ Out past the landing wagon, *up the ladder on the porch*, and walk till the rails run out behind you. Hold on to your hat.'],
          choices: [{ text: '~neutral~ The roofs. Right.', end: true }],
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
    // (Solange since v1.43: she was a second Mireille, with the Underwater City's kelp grower's id, so meeting one marked
    //  the other; src/save-migrate.js step 12)
    id: 'solange', name: 'Solange', title: 'who rides the roofs', color: '#c86a5a', voice: 0.9, kind: 'f', age: 'elder', scale: 0.92, lang: 'bazaar',
    palette: { cloak: '#c86a5a', lining: '#4a3a5a', cloth: '#e8dcc8', legs: '#4a3a5a', hat: '#e8dcc8', hair: '#f0ece4' }, head: 'wrap', cape: 1.5,
    lines: ['~whisper~ Sit, if you like. Hold on.', '~happy~ Look at it go.', '~solemn~ The chalk again. Every night.'],
    talk: {
      entry: [
        { if: { quest: Q, stage: 'mireille' }, node: 'hello' },
        { if: { quest: Q, done: true }, node: 'after' },
        { node: 'stranger' },
      ],
      nodes: {
        stranger: {
          say: ['~neutral~ (An old woman sits cross-legged on the last roof, a stub of chalk in her hand, watching the rails run out behind.)',
            '~happy~ You found the best seat. Sit, if you like. Hold on.'],
          choices: [{ text: '~curious~ The chalk mark?', goto: 'chalk' }, { text: '~playful~ (sit, and hold on)', end: true }],
        },
        hello: {
          say: ['~curious~ A visitor, up here? Nobody climbs up but me. Ambrose thinks I’ll fall off one of these nights.',
            '~neutral~ (You hold out the letter. She looks at the hand on the envelope for a long time before she takes it.)'],
          choices: [{ text: '~neutral~ It’s from Edda.', goto: 'letter' }],
        },
        letter: {
          say: ['~whisper~ Edda. She was this big. She was an hour old.',
            '~sad~ (She reads it with her back to the wind, holding the page flat with both hands.)',
            '~sad~ Forty years of postcards. I never asked her anything, in case she didn’t answer.',
            '~solemn~ (She writes on the back of the letter with the chalk, folds it, and gives it back to you.) Take her that.',
            '~neutral~ (She reaches for the cord along the roof and pulls it twice. Far ahead, the whistle answers.) The market’s halt, in a minute. *Step down on the station side.*'],
          do: [{ take: 'letter' }, { give: 'reply' }, { set: { 'nightmail.stop': true } }, { advance: [Q, 'mireille'] }],
          choices: [{ text: '~curious~ The mark you chalk up here?', goto: 'chalk' }, { text: '~neutral~ I’ll take it to her.', end: true }],
        },
        chalk: {
          say: ['~neutral~ It was here the night I boarded. Old chalk, nearly gone. I drew it over so it wouldn’t be.',
            '~curious~ I don’t know who drew it first. Somebody who rode up here, and wanted to be seen from the sky, I think.',
            '~playful~ So I keep it. A train should have one thing nobody can explain.'],
          choices: [{ text: '~neutral~ Then keep it.', end: true }],
        },
        after: {
          say: [{ if: { has: 'reply' }, text: '~neutral~ Go on, go on. Down the ladder, and off at the halt. She’ll be waiting by the lamp. She always is, I expect.' },
            { if: { not: { has: 'reply' } }, text: '~happy~ Spring. I said spring. I’ll have to get off this thing and remember how stairs work.' }],
          choices: [{ text: '~happy~ (wave, and start for the ladder)', end: true }],
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
  '~whisper~ Solange? On the roofs. She always is.',
];
