// The Moon Foundry's people with something to do (on the route since v1.40, after the Buried Machine: src/levels/names.js
// ORDER), placed by src/levels/moon-foundry.js (MOONFOUNDRY_CONTENT npcs), their errands defined by src/story/moonfoundry.js.
// The world's thread is its temple, the Casting-House (src/temples/moonfoundry.js, Ilse at its door with the founders'
// ledger); these are the foundry's folk and its visitors: Bertil at the last furnace (who cast the mark for a lone woman's
// ship: the light's trace, kept from the world's days as a detour), Ottilie who mends in the workers' quarter, and Wen of
// the Buried Machine, counting moons. Every line carries a tone.

/** What the Moon Foundry gives you to keep (src/story/moonfoundry.js, when the Last Founder is stopped). */
export const KEEPSAKE = {
  id: 'moonfoundry.moon', level: 'moonfoundry', kind: 'thing', name: 'A pocket moon',
  text: 'The last moon the Casting-House poured, no bigger than a plum: ivory, cratered, still faintly warm. Ilse says the founders made the first ones this size, to see if they would hold their light.',
};

/** The things carried for the errands. */
export const ITEMS = { ladlehook: 'Bertil’s mended ladle-hook' };

export const QUESTS = [
  // the foundry's own main quest (v1.48, issue #101): Hedda's little moon on the apron, that nobody here poured; the hung
  // moons seen from the old hoist, all turned one way; and in at the Casting-House's door (src/story/moonfoundry.js)
  {
    id: 'moonfoundry.moons', title: 'Nobody Poured It', world: 'moonfoundry', main: true,
    outro: 'Every hung moon on the floor faces the Casting-House. Whatever pours at night pours in there.',
    stages: [
      { id: 'hedda', text: 'Hear Hedda out by her mould', label: 'Hedda, on the apron', flag: 'moonfoundry.hedda.heard', at: 'hedda' },
      { id: 'hoist', text: 'Climb the old hoist to its first deck', label: 'The old hoist’s first deck', goto: 'hoistDeck', radius: 4.5, vertical: 3, at: 'hoistDeck' },
      { id: 'house', text: 'Go in at the Casting-House’s door', label: 'The Casting-House’s door', flag: 'temple.moonfoundry.entered', at: 'temple.moonfoundry.door' },
    ],
  },
  {
    id: 'moonfoundry.count', title: 'Thirty-One Moons', world: 'moonfoundry',
    outro: 'Thirty-two, from the top of the pillar, written into the founders’ ledger. Wen has started again from one.',
    stages: [
      { id: 'climb', text: 'Climb the pillar and count the moons', label: 'The lookout on the pillar', goto: 'lookout', radius: 9, vertical: 5, at: 'lookout' },
      { id: 'ilse', text: 'Give the count to Ilse at the Casting-House', label: 'Ilse, at the Casting-House', talk: 'ilse', at: 'ilse' },
    ],
  },
  {
    id: 'moonfoundry.hook', title: 'The Ladle-Hook', world: 'moonfoundry',
    outro: 'Bertil’s ladle hangs straight again. He says it pours a little kinder.',
    stages: [
      { id: 'bertil', text: 'Take the ladle-hook to Bertil', label: 'Bertil, at the last furnace', talk: 'bertil', at: 'bertil' },
    ],
  },
];

export const PEOPLE = {
  // Hedda pours the small moons on the apron, by the ship: she opens the foundry's main quest
  hedda: {
    id: 'hedda', name: 'Hedda', title: 'who pours the small moons', color: '#d9a07c', voice: 1.05, kind: 'f',
    head: 'wrap', cape: 0.3,
    lines: ['~happy~ A small one, for somebody’s bell-tower. Still warm. Don’t touch.', '~curious~ Every so often somebody orders a moon. We say yes before we think.'],
    talk: {
      entry: [
        { if: { flag: 'temple.moonfoundry.done' }, node: 'after' },
        { if: { flag: 'moonfoundry.hedda.heard' }, node: 'again' },
        { node: 'hello' },
      ],
      nodes: {
        hello: {
          say: ['~neutral~ Hedda. I pour the small moons. Bell-tower moons, garden moons. This one, though. I didn’t pour this one.',
            '~curious~ It came down the rails at dawn, glowing, and settled in my mould like it lived there. Nobody here poured it. Nobody here was awake.'],
          choices: [
            { text: '~curious~ Then who poured it?', goto: 'who' },
            { text: '~playful~ I’ll let it settle in first.', end: true },
          ],
        },
        who: {
          say: ['~solemn~ The night the singing went over, every hung moon on the floor turned on its hook. They’ve faced the same way since.',
            '~neutral~ *Climb the old hoist*, the iron tower past the moon in the claws, to its first deck, and look at them. Whatever they face pours at night.'],
          do: { set: { 'moonfoundry.hedda.heard': true } },
          choices: [{ text: '~neutral~ I’ll climb it.', end: true }],
        },
        again: { say: ['~neutral~ The old hoist, the iron tower past the moon in the claws. Its first deck. Look at the moons.'], choices: [{ text: '~neutral~ Going.', end: true }] },
        after: {
          say: ['~happy~ No moon came down the rails this morning. My mould’s empty, and I don’t know what to do with my hands.'],
          choices: [{ text: '~neutral~ Goodbye, Hedda.', end: true }],
        },
      },
    },
  },

  ottilie: {
    id: 'ottilie', name: 'Ottilie', title: 'who mends in the quarter', color: '#c9703e', voice: 1.1, kind: 'f',
    head: 'wrap', cape: 0.4,
    lines: ['~neutral~ Bring it here, I’ll mend it. Kettles, hinges, hearts. Mostly kettles.', '~tired~ Every hook in the foundry bends the same way eventually.', '~playful~ The polishing drum was a kitchen before it was my workshop. It still smells of soup.'],
    talk: {
      entry: [
        { if: { quest: 'moonfoundry.hook', done: true }, node: 'after' },
        { if: { quest: 'moonfoundry.hook', active: true }, node: 'waiting' },
        { node: 'hello' },
      ],
      nodes: {
        hello: {
          say: ['~neutral~ Ottilie. I mend things. This one’s Bertil’s ladle-hook: the old crane bent it pouring a bell last winter.',
            '~curious~ He won’t come for it. Says he’s too busy keeping the furnace warm. You look like you walk about. Would you take it?'],
          choices: [
            { text: '~happy~ I’ll take it to him.', do: [{ start: 'moonfoundry.hook' }, { give: 'ladlehook' }], goto: 'go' },
            { text: '~neutral~ I’m walking the other way.', end: true },
          ],
        },
        go: { say: ['~playful~ *The last furnace, across the floor toward the mouth.* Follow the warm. Tell him it’s straighter than he is.'], choices: [{ text: '~neutral~ I’ll tell him.', end: true }] },
        waiting: { say: ['~neutral~ The furnace, east of the aisle. He’ll be warming his hands, pretending to work.'], choices: [{ text: '~neutral~ Going.', end: true }] },
        after: {
          say: [{ if: { not: { flag: 'temple.moonfoundry.done' } }, text: '~happy~ He sent a pot of soup back with a boy. That’s Bertil for thank you.' },
            { if: { flag: 'temple.moonfoundry.done' }, text: '~surprised~ The floor doesn’t shake at night any more. I slept straight through. I’d forgotten what that was like.' }],
          choices: [{ text: '~neutral~ Goodbye, Ottilie.', end: true }],
        },
      },
    },
  },

  // Bertil at the last furnace: the light's trace (the plate he cast for a lone woman's ship), and the hook's end
  bertil: {
    id: 'bertil', name: 'Bertil', title: 'who pours at the last furnace', color: '#c8693c', voice: 0.85, kind: 'm',
    head: 'hat', cape: 0.3,
    lines: ['~happy~ Warm your hands. The furnace does not mind.', '~whisper~ If you listen at the mouth you can hear it talking to itself.'],
    talk: {
      entry: [
        { if: { quest: 'moonfoundry.hook', stage: 'bertil' }, node: 'hook' },
        { if: { flag: 'sight.moonfoundry.bertil' }, node: 'again' },
        { node: 'hello' },
      ],
      nodes: {
        hello: {
          say: ['~neutral~ Years back I cast a plate for a ship’s nose, for a woman who asked nicely and paid in advance.',
            '~curious~ She drew it in soot on the floor: {glyph}. *So they’ll know me,* she said.',
            '~solemn~ I didn’t ask who they were. I poured it twice to get the arc right.'],
          do: { set: { 'sight.moonfoundry.bertil': true } },
          choices: [{ text: '~curious~ Where did she go?', goto: 'where' }, { text: '~neutral~ Goodbye, Bertil.', end: true }],
        },
        where: { say: ['~neutral~ Up. Same as everyone who lands on the apron. She looked back at the moons the whole way out to her ship.'], choices: [{ text: '~neutral~ Goodbye.', end: true }] },
        again: {
          say: [{ if: { not: { flag: 'temple.moonfoundry.done' } }, text: '~whisper~ At night the old Casting-House pours by itself. I hear the moulds crack from here. Ilse says it’s the founders’ machine, still at it.' },
            { if: { flag: 'temple.moonfoundry.done' }, text: '~happy~ Quiet, the Casting-House, at last. My furnace sounds lonely without it. I’ve started talking to it more.' }],
          choices: [{ text: '~neutral~ Goodbye, Bertil.', end: true }],
        },
        hook: {
          say: ['~surprised~ My ladle-hook! Straight as a rail. (He hangs it on the crane and lets the ladle swing.)',
            '~happy~ She’s a marvel, Ottilie. Don’t tell her I said so. Tell her the soup’s on me.'],
          do: [{ take: 'ladlehook' }, { advance: ['moonfoundry.hook', 'bertil'] }],
          choices: [{ text: '~playful~ She says it’s straighter than you.', goto: 'straighter' }],
        },
        straighter: { say: ['~playful~ Everything is. I’ve been leaning toward this furnace for forty years.'], choices: [{ text: '~neutral~ Goodbye, Bertil.', end: true }] },
      },
    },
  },

};

/** The visitors: their words here (their bodies and names are their own world's: Wen, src/story/buried-data.js). */
export const VISITORS = {
  // Wen of the Buried Machine, on holiday, counting moons from the courtyard of the broken one
  wen: {
    lines: ['~happy~ Thirty-one moons on the floor. I counted twice.', '~neutral~ This one cracked in the casting, they say. Good thing, too: it makes a lovely street.'],
    talk: {
      entry: [
        { if: { quest: 'moonfoundry.count', done: true }, node: 'after' },
        { if: { quest: 'moonfoundry.count', active: true }, node: 'waiting' },
        { node: 'hello' },
      ],
      nodes: {
        hello: {
          say: ['~happy~ At home I count the great wheel’s teeth. Here I count moons, on holiday. Thirty-one, not counting the far ones.',
            '~curious~ Only I can’t see behind the cradle from this walkway, and my knees won’t do ladders. Somebody should count from the pillar. The one with the moon on top.'],
          choices: [
            { text: '~neutral~ I’ll climb up and count.', do: { start: 'moonfoundry.count' }, goto: 'go' },
            { text: '~curious~ Who were they for?', goto: 'who' },
          ],
        },
        who: { say: ['~solemn~ Nobody knows. Somebody’s sky, somewhere, waiting for them. Ilse at the Casting-House says the ledger knows. She won’t say what it says.'], choices: [{ text: '~neutral~ I’ll count them for you.', do: { start: 'moonfoundry.count' }, goto: 'go' }, { text: '~neutral~ Goodbye, Wen.', end: true }] },
        go: { say: ['~happy~ *The pillar east of the floor, under the moon on top.* There are rungs up its side, and a little lookout at the top. Count slowly. Moons hate being rushed. Then *give the count to Ilse* at the Casting-House: she keeps the ledger.'], choices: [{ text: '~neutral~ Slowly.', end: true }] },
        waiting: { say: ['~curious~ The pillar east of the floor, the lookout under its moon. Then Ilse, by the Casting-House, for the ledger. I’ll wait. I’m good at waiting. Ask the wheel.'], choices: [{ text: '~neutral~ Going.', end: true }] },
        after: {
          say: [{ if: { not: { flag: 'temple.moonfoundry.done' } }, text: '~whisper~ At night the hung ones turn on their hooks, all toward the same place. Like they’re looking for where they should go.' },
            { if: { flag: 'temple.moonfoundry.done' }, text: '~happy~ Thirty-two, Ilse says you made it, and the last one’s on its hook now, finished. I counted it twice to be polite.' }],
          do: { set: { 'moonfoundry.rumour.light': true } },
          choices: [{ text: '~neutral~ Goodbye, Wen.', end: true }],
        },
      },
    },
  },
};

/** What the foundry's folk say once the Casting-House is quiet. */
export const LINES_AFTER = ['~happy~ The floor’s quiet at night now.', '~surprised~ The last moon’s on its hook!', '~solemn~ (she looks up at the hung moons, turning slowly)', '~playful~ Thirty-two. Somebody tell Wen.'];
