// The Underwater City's people with something to do (on the route since v1.40: src/levels/names.js ORDER), placed by
// src/levels/underwater.js (UNDERWATER_CONTENT npcs), their side quests defined by src/story/underwater.js. The world's
// thread is its temple, the Whale-House (src/temples/underwater.js, Anselme at its door): Maelle in the Whale Gallery
// tells you why the whales keep away, and what they sang once they came back (the way on: the City-Shaft). Every line
// carries a tone; a talk's answers stay at three a node at most.

/** What the Underwater City gives you to keep (src/story/underwater.js, when the Whale-House's keeper is calmed). */
export const KEEPSAKE = {
  id: 'underwater.whalesong', level: 'underwater', kind: 'song', name: 'The whales’ answer',
  text: 'The song the whales sang against the glass the morning they came back: the light’s one note first, then their own, long and low, and the cups in Coralie’s café rattling in their saucers.',
};

/** The things carried for the side quests. */
export const ITEMS = { kelpcutting: 'a glow-kelp cutting' };

export const QUESTS = [
  {
    id: 'underwater.kelp', title: 'A Cutting for the Crown', world: 'underwater',
    outro: 'Fabre’s window box glows green now, sixty metres up the column.',
    stages: [
      { id: 'lift', text: 'Take Mireille’s glow-kelp cutting up the lift in the Plaza’s column to the Crown', label: 'The lift in the column', goto: 'crown', radius: 11, vertical: 6, at: 'lift' },
      { id: 'fabre', text: 'Give the cutting to Fabre, who keeps the Crown’s lamps', label: 'Fabre, in the Crown', talk: 'fabre', at: 'fabre' },
    ],
  },
  {
    id: 'underwater.lamps', title: 'Lamps for the Whales', world: 'underwater',
    outro: 'Maelle says a lamp at the top of the city is a fine thing for a whale to see. She would know.',
    stages: [
      { id: 'maelle', text: 'Tell Maelle, down in the Whale Gallery, that the Crown’s lamps are lit for the whales', label: 'Maelle, in the Whale Gallery', talk: 'maelle', at: 'maelle', via: 'the tube down to the Whale Gallery' },
    ],
  },
];

export const PEOPLE = {
  mireille: {
    id: 'mireille', name: 'Mireille', title: 'who grows the glow-kelp', color: '#5f8f7a', voice: 1.05, kind: 'f',
    head: 'wrap', cape: 0.6,
    lines: ['~happy~ Glow-kelp. It lights the troughs and it lights the soup.', '~tired~ Every trough watered, every frond counted. Twice.', '~curious~ Mind the troughs. The kelp likes a visitor, not a boot.'],
    talk: {
      entry: [
        { if: { quest: 'underwater.kelp', done: true }, node: 'after' },
        { if: { quest: 'underwater.kelp', active: true }, node: 'waiting' },
        { node: 'hello' },
      ],
      nodes: {
        hello: {
          say: ['~happy~ Mireille. I grow the glow-kelp. Every lamp in the city has a frond of mine in it somewhere.',
            '~curious~ You came down the lock, didn’t you? Then you’ve got young knees. Would you take something up the column for me?'],
          choices: [
            { text: '~neutral~ Up the column?', goto: 'column' },
            { text: '~neutral~ Not now.', end: true },
          ],
        },
        column: {
          say: ['~neutral~ Old *Fabre keeps the lamps in the Crown*, at the top of the column in the Plaza. He asked for a cutting for his window box years ago.',
            '~playful~ I keep meaning to go. The lift makes my ears pop. *Take the lift at the column’s foot.* It goes all the way up.'],
          choices: [
            { text: '~happy~ I’ll take it up.', do: [{ start: 'underwater.kelp' }, { give: 'kelpcutting' }], goto: 'go' },
            { text: '~neutral~ Another time.', end: true },
          ],
        },
        go: { say: ['~happy~ Keep it wet. Tell him it likes the dark and hates the cold, like him.'], choices: [{ text: '~neutral~ I’ll tell him.', end: true }] },
        waiting: { say: ['~curious~ Up the lift in the Plaza’s column, to the Crown. Fabre will be fussing with his lamps.'], choices: [{ text: '~neutral~ On my way.', end: true }] },
        after: {
          say: ['~happy~ He sent word down the column: it glows. He says it’s the first green thing he’s owned since he was a boy.',
            { if: { not: { flag: 'temple.underwater.done' } }, text: '~sad~ The kelp leans toward the glass at night, the way it used to when the whales came by. It’s still waiting for them.' },
            { if: { flag: 'temple.underwater.done' }, text: '~surprised~ And the whales are back. The kelp leans all one way when they sing. Look at it.' }],
          choices: [{ text: '~neutral~ Goodbye, Mireille.', end: true }],
        },
      },
    },
  },

  fabre: {
    id: 'fabre', name: 'Fabre', title: 'who keeps the Crown’s lamps', color: '#e3b06a', voice: 0.8, kind: 'm',
    head: 'hat', cape: 0.4,
    lines: ['~neutral~ Six lamps round the Crown. I light them at dusk so the city can see where its top is.', '~curious~ Look up. That’s the surface. I’ve never been through it.', '~tired~ The lift again. Up and down, up and down.'],
    talk: {
      entry: [
        { if: { quest: 'underwater.kelp', stage: 'fabre' }, node: 'cutting' },
        { if: { quest: 'underwater.lamps', done: true }, node: 'after' },
        { if: { quest: 'underwater.lamps', active: true }, node: 'waiting' },
        { if: { quest: 'underwater.kelp', done: true }, node: 'lamps' },
        { node: 'hello' },
      ],
      nodes: {
        hello: {
          say: ['~neutral~ Fabre. I keep the Crown’s lamps, at the top of the column. Up here you can almost touch the surface.',
            '~curious~ You came from up there, didn’t you? Through it. What does it look like from the other side?'],
          choices: [
            { text: '~happy~ Bright. Very wide. Dry.', goto: 'sky' },
            { text: '~neutral~ Like your ceiling, from above.', goto: 'sky' },
          ],
        },
        sky: { say: ['~solemn~ I’ve looked at the underneath of it for fifty years. I like to think the top is just as good.'], choices: [{ text: '~neutral~ It is.', end: true }] },
        cutting: {
          say: ['~surprised~ Is that Mireille’s kelp? She remembered. (He takes the cutting in both hands and settles it in the window box under the glass.)',
            '~happy~ Look at it go green. The first thing I’ve grown in fifty years that isn’t a beard.'],
          do: [{ take: 'kelpcutting' }, { advance: ['underwater.kelp', 'fabre'] }],
          choices: [{ text: '~neutral~ She says it hates the cold.', goto: 'cold' }],
        },
        cold: { say: ['~playful~ Then we’ll get on.', '~neutral~ Here. Now that you know the way up: there’s something else.'], choices: [{ text: '~curious~ What is it?', goto: 'lamps' }] },
        lamps: {
          say: ['~solemn~ I’ve lit the Crown’s lamps every dusk since the whales went away. For them, so they can find the city again.',
            '~curious~ Maelle listens for them in the Whale Gallery, down the slope past the Plaza. *Go down and tell her the lamps are lit.* She’ll know if they’ve seen them.'],
          choices: [
            { text: '~neutral~ I’ll tell her.', if: { quest: 'underwater.lamps', started: false }, do: { start: 'underwater.lamps' }, end: true },
            { text: '~neutral~ Goodbye, Fabre.', end: true },
          ],
        },
        waiting: { say: ['~neutral~ Down the lift, east through the Plaza, down the tube to the Gallery. Maelle will be by the glass.'], choices: [{ text: '~neutral~ Going.', end: true }] },
        after: {
          say: [{ if: { not: { flag: 'temple.underwater.done' } }, text: '~neutral~ She said they’ll see them when they’re ready to look. That’s the sort of thing Maelle says.' },
            { if: { flag: 'temple.underwater.done' }, text: '~happy~ A whale came right up to the Crown at dusk. It looked at the lamps, and then at me, and then it sang. I didn’t know what to do, so I waved.' }],
          choices: [{ text: '~neutral~ Goodbye, Fabre.', end: true }],
        },
      },
    },
  },

  maelle: {
    id: 'maelle', name: 'Maelle', title: 'who listens to the whales', color: '#2f8a8f', voice: 1.0, kind: 'f',
    head: 'hood', cape: 1.0,
    lines: ['~whisper~ Shh. Listen. That far hum, under the hum of the glass.', '~sad~ They keep away now. They used to come so close the glass shook.', '~solemn~ The deep is listening. It always is.'],
    talk: {
      entry: [
        { if: { quest: 'underwater.lamps', stage: 'maelle' }, node: 'lamps' },
        { if: { flag: 'temple.underwater.done' }, node: 'after' },
        { if: { flag: 'met.maelle' }, node: 'again' },
        { node: 'hello' },
      ],
      nodes: {
        hello: {
          say: ['~whisper~ Maelle. I listen to the whales. This gallery hangs over the deep: they used to come up out of it and sing against the glass.',
            '~sad~ The night the sky rang, a light came down through the sea, singing one note. The whales sang it back, all of them at once. Then they went away, and they haven’t come back.',
            '~solemn~ And the glass has hummed that one note ever since, all over the city. You can feel it in your teeth.'],
          do: { set: { 'met.maelle': true, 'underwater.rumour.light': true } },
          choices: [
            { text: '~curious~ Why did they go?', goto: 'why' },
            { text: '~neutral~ Can anything bring them back?', goto: 'house' },
          ],
        },
        why: { say: ['~whisper~ Something in the Whale-House calls them off. It used to call them in. The makers built it to talk to them, long before the city.'], choices: [{ text: '~curious~ The Whale-House?', goto: 'house' }] },
        house: {
          say: ['~neutral~ *The Whale-House*, the makers’ old sounding-house on the sea floor north of the Plaza. *The last tube runs out to its door.* Old Anselme sits by it.',
            '~solemn~ Whatever listens in there has been singing the light’s note back to the whales for months. Go and ask it to stop.'],
          choices: [{ text: '~neutral~ I’ll go.', if: { quest: 'temple.underwater', started: false }, do: { start: 'temple.underwater' }, end: true }, { text: '~neutral~ I’ll go and look.', end: true }],
        },
        again: { say: ['~whisper~ North of the Plaza, down the last tube. The Whale-House. Listen at its door before you go in.'], choices: [{ text: '~neutral~ I’m going.', end: true }] },
        lamps: {
          say: ['~curious~ Fabre’s lamps? Every dusk, all these months?',
            { if: { not: { flag: 'temple.underwater.done' } }, text: '~solemn~ Then when they come back, they’ll find the top of the city lit. Tell him that’s a fine thing for a whale to see.' },
            { if: { flag: 'temple.underwater.done' }, text: '~happy~ Tell him they saw. The big one turned toward the column last night and sang at it for an hour.' }],
          do: { advance: ['underwater.lamps', 'maelle'] },
          choices: [{ text: '~neutral~ I’ll tell him.', end: true }],
        },
        // (the route's way on: the City-Shaft, the light that went up a well)
        after: {
          say: ['~happy~ Listen. (Against the glass, close enough to fog it, a whale is singing: long, low, and then a high clear note at the end.)',
            '~solemn~ That high note is the light’s. They kept it. They sang it to me first, as if to say sorry, and then their own song after it.',
            '~curious~ The old ones in the pod say where it went: up out of the sea, and on to a city built down a well, where a light hangs that nobody looks at.'],
          do: { set: { 'clue.underwater.incal': true } },
          choices: [
            { text: '~curious~ A city down a well?', goto: 'well' },
            { text: '~neutral~ Goodbye, Maelle.', end: true },
          ],
        },
        well: { say: ['~playful~ Whales don’t give directions. They give songs. But that one sounded like falling a long way, and landing somewhere bright.'], choices: [{ text: '~neutral~ I’ll find it.', end: true }] },
      },
    },
  },
};

/** What the Gallery and the city say once the whales are back. */
export const LINES_AFTER = ['~happy~ Hear that? Right against the glass.', '~surprised~ They’re back!', '~solemn~ (she leans her forehead on the glass, listening)', '~playful~ The cups are rattling again.'];
