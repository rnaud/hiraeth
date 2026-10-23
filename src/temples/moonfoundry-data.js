// The Casting-House's words (src/temples/moonfoundry.js builds it, in the Moon Foundry): the local who sends you in,
// and what she says after. The foundry folk keep the founders' casting ledger by the house's door; Petra reads it.
// She speaks the Buried Machine's tongue, as the foundry folk do (src/levels/moon-foundry.js). Conversation format:
// src/story/dialogue.js. Every line carries a tone.

export const QUEST = {
  id: 'temple.moonfoundry', title: 'The Casting-House', world: 'moonfoundry', main: true,   // (the Moon Foundry's one thread: src/story/moonfoundry.js)
  outro: 'The Last Founder has stopped with one whole moon cast, and the Casting-House is quiet at night.',
  find: 'Find the Casting-House on the hangar’s east side',
  gadget: 'Find what the founders left in the Casting-House',
  keeper: 'Go down to what still casts moons',
};

export const PEOPLE = {
  ilse: {
    id: 'ilse', name: 'Petra', title: 'who keeps the founders’ ledger', color: '#c9703e', voice: 0.96, kind: 'f', lang: 'buried',
    palette: { cloak: '#c9703e', lining: '#efe6d2', cloth: '#e8d2a8', legs: '#45403f', hat: '#7f93a3', hair: '#5a3a2c' }, head: 'hair', cape: 0,
    lines: ['~neutral~ Moon forty-one: cracked. Moon forty-two: cracked. Very consistent.', '~tired~ The ledger is heavier than it looks. So is the house.', '~curious~ You hear it at night? The rolling?'],
    talk: {
      entry: [
        { if: { flag: 'temple.moonfoundry.done' }, node: 'after' },
        { if: { flag: 'temple.moonfoundry.entered' }, node: 'inside' },
        // (Wen's count, done at the pillar's lookout: Petra writes it in when you pass, no step of it, issue #137)
        { if: { all: [{ flag: 'met.ilse' }, { quest: 'moonfoundry.count', done: true }, { not: { flag: 'moonfoundry.ilse.counted' } }] }, node: 'count' },
        { if: { flag: 'met.ilse' }, node: 'again' },
        { node: 'hello' },
      ],
      nodes: {
        count: {
          say: ['~surprised~ You counted from the pillar? Thirty-two, then. Nobody gets it right from the floor. (She writes it in.)'],
          do: { set: { 'moonfoundry.ilse.counted': true } },
          choices: [{ text: '~neutral~ And the house?', goto: 'again' }, { text: '~playful~ Write it in ink.', end: true }],
        },
        hello: {
          say: ['~neutral~ (She looks up from a ledger the size of a door.) The founders’. Somebody has to keep it, and they left a long time ago.',
            '~solemn~ That’s *the Casting-House*. The first moons were poured in there. Every page of the ledger starts at its door.',
            '~sad~ The night the singing went over, every hung moon in the hangar turned on its hook to watch it go. And since then, at night, the house pours by itself. The floor shakes.'],
          do: { set: { 'met.ilse': true } },
          choices: [
            { text: '~neutral~ I’ll go in and look.', do: { start: 'temple.moonfoundry' }, goto: 'go' },
            { text: '~curious~ It pours by itself?', goto: 'pours' },
            { text: '~neutral~ Let it pour, for now.', end: true },
          ],
        },
        pours: {
          say: ['~whisper~ Something at the bottom still works the crucible. The ledger calls it *the Last Founder*: built to cast when the founders were tired.',
            '~sad~ It casts a moon, the moon cracks, it casts another. You can hear the cracked ones roll, under the floor.'],
          choices: [{ text: '~neutral~ I’ll go in and look.', do: { start: 'temple.moonfoundry' }, goto: 'go' }, { text: '~solemn~ I’ll listen for them tonight.', end: true }],
        },
        go: {
          say: ['~neutral~ *The door under the chimney.* It isn’t locked. The founders never locked anything; they just made it heavy.',
            '~curious~ The ledger lists a *magnet glove* in the house, for drawing the iron moons along. They move for nothing else. Find it first.',
            '~neutral~ The channels carry molten iron. Shut a tap by a hub to stop the pour and drain them.'],
          choices: [{ text: '~happy~ A magnet glove. Got it.', end: true }],
        },
        again: {
          say: ['~neutral~ *The door under the chimney.* Mind the heavy moons.'],
          choices: [{ text: '~neutral~ I’m going.', if: { quest: 'temple.moonfoundry', done: false }, do: { start: 'temple.moonfoundry' }, end: true }, { text: '~neutral~ Heavy moons. Right.', end: true }],
        },
        inside: {
          say: ['~surprised~ You’ve been in! Is the crucible still warm?', '~curious~ And the Last Founder? Did you see it?'],
          choices: [
            { text: '~solemn~ It keeps a cradle it can’t fill.', goto: 'cradle' },
            { text: '~neutral~ I’m going back.', end: true },
          ],
        },
        cradle: {
          say: ['~solemn~ The ledger says a whole moon makes it stop and look. That gives you an opening.',
            '~neutral~ Use the glove to draw an iron moon into its cradle. Then splash its heart when the crucible doors open.'],
          choices: [{ text: '~neutral~ I’ll try.', end: true }],
        },
        after: {
          say: ['~surprised~ It’s quiet. No pour, no rolling. (Over the door, a small new moon hangs from the jib, turning slowly.)',
            '~happy~ It finished one. I wrote it in the ledger: *one moon, whole.* The first entry in a hundred years.',
            '~solemn~ The hung moons still face where the light went. But they’ve stopped creaking.'],
          do: { set: { 'clue.moonfoundry.spheres': true } },
          choices: [
            { text: '~curious~ What’s on the ledger’s first page?', goto: 'first' },
            { text: '~happy~ Can I see the ledger?', goto: 'ledger' },
            { text: '~happy~ One moon, whole. Good.', end: true },
          ],
        },
        // (the route's way on: the Garden of Spheres, src/story/spheres-data.js)
        first: {
          say: ['~curious~ The first moons. Small ones, cast in the house before the big ones. Sent to a garden far off, to hang over it.',
            '~sad~ They fell short. The ledger says they lie in its grass still, white and round, and the gardeners got used to them.',
            '~neutral~ If you find that garden, tell it they were meant for the sky.'],
          choices: [{ text: '~neutral~ I’ll tell it.', end: true }],
        },
        ledger: {
          say: ['~playful~ (She turns it round: columns of moons and weights, and in the margins, little drawings of hands in horseshoe gloves.) Founders’ handwriting. Terrible. I love it.'],
          choices: [{ text: '~playful~ Terrible. I love it too.', end: true }],
        },
      },
    },
  },
};

/** What the foundry says once the Last Founder has stopped. */
export const LINES_AFTER = ['~happy~ One moon, whole. I wrote it down.', '~surprised~ No pour last night. I slept!', '~solemn~ (she reads the ledger, smiling)', '~playful~ It hangs there like it’s waiting to be collected.'];
