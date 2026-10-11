// The City Floating in Space's people with something to do (on the route since v1.40, before the Signal Market:
// src/levels/names.js ORDER), placed by src/levels/space-city.js (SPACECITY_CONTENT npcs), their errands defined by
// src/story/spacecity.js. The world's thread is its temple, the Mooring-House on its own island (src/temples/spacecity.js,
// Joss the moorer at its door); these are the city's folk and its visitors: Tamar who minds the cables (the light's trace,
// kept from the world's days as a detour), Madame Sel and Kip of the Signal Market. Every line carries a tone.

/** What the city gives you to keep (src/story/spacecity.js, when the Anchor-Warden is resolved). */
export const KEEPSAKE = {
  id: 'spacecity.cables', level: 'spacecity', kind: 'knowing', name: 'What the cables are for',
  text: 'The cables under the islands were never holding them up. Tamar says so, and Joss, and the hum in them: they hold the islands together by listening to each other, and to whatever passes in the dark.',
};

/** The things carried for the errands. */
export const ITEMS = { selnotes: 'Madame Sel’s notes on the hum', kiplamp: 'one of Kip’s lamps' };   // (the lamp is hung: src/story/spacecity.js takes it)

export const QUESTS = [
  {
    id: 'spacecity.notes', title: 'The Planet’s Hum', world: 'spacecity',
    outro: 'Tamar laid Sel’s notes on the cable and the needle wrote the same line. The city and the planet are humming one tune.',
    stages: [
      { id: 'tamar', text: 'Take Sel’s notes to Tamar on the Towers', label: 'Tamar, on the Towers', talk: 'tamar', at: 'tamar', via: 'the Towers bridge' },
    ],
  },
  {
    id: 'spacecity.lamp', title: 'A Lamp at the Edge', world: 'spacecity',
    outro: 'Kip’s lamp hangs in the crow’s nest of the Balcony’s mast, the last light before the dark.',
    stages: [
      { id: 'hang', text: 'Hang Kip’s lamp in the mast’s crow’s nest', label: 'The crow’s nest on the Balcony’s mast', goto: 'mast', radius: 3.5, vertical: 3, at: 'mast', via: 'the Balcony bridge' },
    ],
  },
];

const KIP = {
    lines: ['~playful~ Bridges! A city of nothing but bridges! I could run messages here for ever.', '~shout~ Don’t look down. Or do, it’s great.'],
    talk: {
      entry: [
        { if: { all: [{ quest: 'spacecity.lamp', done: true }, { not: { flag: 'spacecity.kip.thanked' } }] }, node: 'hung' },
        { if: { quest: 'spacecity.lamp', done: true }, node: 'after' },
        { if: { quest: 'spacecity.lamp', active: true }, node: 'waiting' },
        { node: 'hello' },
      ],
      nodes: {
        hello: {
          say: ['~happy~ Kip, courier of the skybridges. The Market’s were the best in the world. Then I came here.',
            '~curious~ They don’t pay in fruit. They pay in lamp oil. I have nine lamps now and nowhere to put them.'],
          choices: [
            { text: '~curious~ Give me one.', goto: 'one' },
            { text: '~neutral~ Goodbye, Kip.', end: true },
          ],
        },
        one: {
          say: ['~playful~ Ha! Take it out to the edge, then. *The lamp-mast by the Balcony’s railing,* north of the Market, the last thing before nothing. Climb it and hang it in the crow’s nest.',
            '~solemn~ Somebody coming across the dark should see a light first. That’s courier’s law. I made it up, but it’s law.'],
          choices: [{ text: '~happy~ I’ll hang it.', do: [{ start: 'spacecity.lamp' }, { give: 'kiplamp' }], end: true }, { text: '~neutral~ Not now.', end: true }],
        },
        waiting: { say: ['~neutral~ The mast by the Balcony’s railing, north up the Balcony bridge. The crow’s nest. Hang it high.'], choices: [{ text: '~neutral~ Going.', end: true }] },
        hung: {
          say: ['~happy~ You hung it? I saw it come on! That little dot at the end of everything. That’s mine.'],
          do: { set: { 'spacecity.kip.thanked': true } },
          choices: [{ text: '~playful~ Eight to go.', goto: 'eight' }],
        },
        eight: { say: ['~playful~ Eight to go! I’ll have this whole city lit by the time I leave. They’ll name a bridge after me. A short one.'], choices: [{ text: '~neutral~ Goodbye, Kip.', end: true }] },
        after: {
          say: [{ if: { not: { flag: 'temple.spacecity.done' } }, text: '~curious~ The bridges creak more every night. If the islands drift any further I’ll have to jump between them. I’d like that, actually.' },
            { if: { flag: 'temple.spacecity.done' }, text: '~happy~ The bridges stopped creaking! Now I can hear my own feet. I’m very loud. Who knew.' }],
          choices: [{ text: '~neutral~ Goodbye, Kip.', end: true }],
        },
      },
    },
  };

/** The visitors from the Signal Market: their words here (their bodies and names are their own world's: src/story/bazaar-data.js). */
export const VISITORS = {
  // Madame Sel of the Signal Market, listening to the planet from the Balcony (her errand: her notes to Tamar)
  sel: {
    lines: ['~solemn~ Listen. The planet hums. Very low. You need the old tower’s ears to hear it.', '~happy~ Mind the railing, love. There’s nothing under it for a long way.'],
    talk: {
      entry: [
        { if: { quest: 'spacecity.notes', done: true }, node: 'after' },
        { if: { quest: 'spacecity.notes', active: true }, node: 'waiting' },
        { node: 'hello' },
      ],
      nodes: {
        hello: {
          say: ['~neutral~ Madame Sel. Forty years I listened to the sky from a tower in the Market. Here the sky is all round, even under your feet.',
            '~curious~ The cables under the islands aren’t tied to anything. They’re antennas. The whole city is listening to the planet, and I’ve been writing down what it hears.'],
          choices: [
            { text: '~curious~ What does it hear?', goto: 'hears' },
            { text: '~neutral~ Goodbye, Madame Sel.', end: true },
          ],
        },
        hears: {
          say: ['~solemn~ A hum, very low, and over it a line that comes and goes. I don’t know the language yet.',
            '~curious~ Tamar on the Towers minds the old cables: her grandmother hung the first. *Take her my notes.* If the cables keep the same line, I’m not going mad.'],
          choices: [
            { text: '~happy~ I’ll take them.', do: [{ start: 'spacecity.notes' }, { give: 'selnotes' }], goto: 'go' },
            { text: '~neutral~ Another time.', end: true },
          ],
        },
        go: { say: ['~neutral~ *East from the Market, up the Towers bridge.* Tamar will be under her cables, listening. Don’t whistle near them.'], choices: [{ text: '~neutral~ I won’t.', end: true }] },
        waiting: { say: ['~neutral~ The Towers, east of the Market, up the narrow bridge. Tamar.'], choices: [{ text: '~neutral~ Going.', end: true }] },
        after: {
          say: [{ if: { not: { flag: 'temple.spacecity.done' } }, text: '~happy~ The same line, she says. So the planet’s talking, and the cables are listening. I’ll learn the language yet.' },
            { if: { flag: 'temple.spacecity.done' }, text: '~surprised~ Since the cables went taut the line comes clear. It’s a broadcast, love, from far off, and I know its voice: a market with a silent tower.' }],
          choices: [{ text: '~neutral~ Goodbye, Madame Sel.', end: true }],
        },
      },
    },
  },

  // Kip, courier of the Signal Market's skybridges, on the Market Bridge, with nine lamps and nowhere to put them
  kip: KIP,
};

export const PEOPLE = {
  // Tamar who minds the cables (the light's trace: the ship with no name that hailed them with a sung note)
  tamar: {
    id: 'tamar', name: 'Tamar', title: 'who minds the cables', color: '#d98a7a', voice: 1.0, kind: 'f',
    head: 'wrap', cape: 0.7,
    lines: ['~solemn~ My grandmother hung the first cable under this island. It still hums when she visits.', '~neutral~ The Towers are older than the Market. We were here first. We say that a lot.'],
    talk: {
      entry: [
        { if: { quest: 'spacecity.notes', stage: 'tamar' }, node: 'notes' },
        { if: { flag: 'sight.spacecity.tamar' }, node: 'again' },
        { node: 'hello' },
      ],
      nodes: {
        hello: {
          say: ['~solemn~ Long ago a ship came by with no name to give: one pilot, on her own. It hailed us with a sung note instead.',
            '~curious~ The cables kept the note. The night the sky rang it came by again, fast and very high. It didn’t stop this time.',
            '~whisper~ It was going somewhere.'],
          do: { set: { 'sight.spacecity.tamar': true, 'spacecity.rumour.light': true } },
          choices: [{ text: '~curious~ And the cables since?', goto: 'since' }, { text: '~neutral~ Goodbye, Tamar.', end: true }],
        },
        since: { say: ['~sad~ They hum that note night and day. And the islands drift, a hand’s width a night. Joss at the Mooring-House says something in there is letting the cables out.'], choices: [{ text: '~neutral~ Goodbye, Tamar.', end: true }] },
        again: {
          say: [{ if: { not: { flag: 'temple.spacecity.done' } }, text: '~sad~ Feel that? The bridge creaks. Another hand’s width tonight. The Mooring-House is north of here, over the long bridge.' },
            { if: { flag: 'temple.spacecity.done' }, text: '~happy~ Taut, all of them. My grandmother would have cried. I did, a bit. Don’t tell the Market.' }],
          choices: [{ text: '~neutral~ Goodbye, Tamar.', end: true }],
        },
        notes: {
          say: ['~curious~ Sel’s notes? (She lays the paper along a cable and holds a needle to it. The needle shivers, and writes the same line, stroke for stroke.)',
            '~solemn~ The same. So the planet’s talking, and my cables have been listening all along. Tell Sel she isn’t going mad. Tell her we both are.'],
          do: [{ take: 'selnotes' }, { advance: ['spacecity.notes', 'tamar'] }],
          choices: [{ text: '~neutral~ I’ll tell her.', end: true }],
        },
      },
    },
  },

};

/** What the city says once the cables are taut. */
export const LINES_AFTER = ['~happy~ The bridges don’t creak any more!', '~surprised~ Look at the cables, all lit.', '~solemn~ (she listens to the cables hum, one clear note)', '~playful~ No more drifting. Shame, I liked the exercise.'];
