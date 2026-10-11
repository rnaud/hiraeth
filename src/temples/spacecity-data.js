// The Mooring-House's words (src/temples/spacecity.js builds it, on the Moorings, the City Floating in Space's own
// island north of the Towers): the moorer who points you there, and what she says after. Joss pulls the islands home
// when they wander; since the night the singing light passed they wander every night. Conversation format:
// src/story/dialogue.js. Every line carries a tone. Her last words point the way on: the planet's hum on the taut
// cables carries a market of a thousand signs, one tower silent in it (the Signal Market, the route's last world:
// the flag clue.spacecity.bazaar, src/story/spacecity.js).

export const QUEST = {
  id: 'temple.spacecity', title: 'The Mooring-House', world: 'spacecity', main: true,   // (the city's one thread: src/story/spacecity.js)
  outro: 'The Anchor-Warden has taken up its cables, and the islands of the city hold together again.',
  find: 'Find the Mooring-House north of the Towers',
  gadget: 'Find what the makers left in the Mooring-House',
  keeper: 'Go up to what lets the cables out',
};

export const PEOPLE = {
  joss: {
    id: 'joss', name: 'Joss', title: 'the moorer', color: '#4f9a98', voice: 0.98, kind: 'f',
    palette: { cloak: '#4f9a98', lining: '#e39a7f', cloth: '#efe7da', legs: '#2e3550', hat: '#d2a648', hair: '#3a2a22' }, head: 'wrap', cape: 0.7,
    lines: ['~neutral~ A hand’s width a night. I measure it every morning.', '~tired~ The Towers bridge creaked again. It has opinions about the Market.', '~playful~ Don’t lean on the cables. They lean back.'],
    talk: {
      entry: [
        { if: { flag: 'temple.spacecity.done' }, node: 'after' },
        { if: { flag: 'temple.spacecity.entered' }, node: 'inside' },
        { if: { flag: 'met.joss' }, node: 'again' },
        { node: 'hello' },
      ],
      nodes: {
        hello: {
          say: ['~neutral~ Joss. I moor. When an island wanders off, I pull it home. Lately they all wander.',
            '~solemn~ That’s *the Mooring-House*. The great capstan inside holds every cable in the city. The islands were tied to it before anyone lived on them.',
            '~sad~ The night the singing light went over, its note ran down every cable at once. Since then the islands drift apart a hand’s width a night, and the bridges creak.'],
          do: { set: { 'met.joss': true } },
          choices: [
            { text: '~neutral~ I’ll go in and look.', do: { start: 'temple.spacecity' }, goto: 'go' },
            { text: '~curious~ What is letting them drift?', goto: 'warden' },
            { text: '~neutral~ Goodbye, Joss.', end: true },
          ],
        },
        warden: {
          say: ['~whisper~ Something at the top of the house turns the capstan back. Slowly. At night you can hear the cable paying out.',
            '~neutral~ The old moorers called it *the Anchor-Warden*. It was built to hold on. Now it lets go.'],
          choices: [{ text: '~neutral~ I’ll go in and look.', do: { start: 'temple.spacecity' }, goto: 'go' }, { text: '~neutral~ Goodbye.', end: true }],
        },
        go: {
          say: ['~neutral~ *The door faces the bridge.* It isn’t locked. Nothing here is locked, except the islands. They used to be.',
            '~curious~ The makers kept a tether in there, the old moorers said: a line you throw that pulls things home. Switch to it with {key:mode}.'],
          choices: [{ text: '~happy~ A line that pulls. Got it.', end: true }],
        },
        again: {
          say: ['~neutral~ *The door that faces the bridge.* Mind the floors inside. Some of them stop short, and there is nothing under them for a long way.'],
          choices: [{ text: '~neutral~ I’m going.', if: { quest: 'temple.spacecity', started: false }, do: { start: 'temple.spacecity' }, end: true }, { text: '~neutral~ Goodbye.', end: true }],
        },
        inside: {
          say: ['~surprised~ You came back out! Did the floors hold?', '~curious~ And the capstan? Still turning the wrong way?'],
          choices: [
            { text: '~solemn~ A machine at the top is letting the cables out.', goto: 'pull' },
            { text: '~neutral~ I’m going back.', end: true },
          ],
        },
        pull: {
          say: ['~neutral~ Then pull. Anything that lets go can be pulled home, my mother said. She meant islands. She also meant my brother.',
            '~curious~ If it throws its anchors out where your line won’t reach, turn its bars first. A capstan is pushed round. Then you pull.'],
          choices: [{ text: '~neutral~ Push, then pull.', end: true }],
        },
        after: {
          say: ['~surprised~ Hear that? (A long low hum runs along the cables over the city. The lamps on them are lit, all the way out.)',
            '~happy~ The Towers bridge stopped creaking. The Market will miss the conversation.',
            '~solemn~ The note that ran down the cables has gone quiet. Something else is on them now.'],
          do: { set: { 'clue.spacecity.bazaar': true } },
          choices: [
            { text: '~curious~ What is on the cables?', goto: 'broadcast' },
            { text: '~happy~ Will they hold now?', goto: 'hold' },
            { text: '~neutral~ Goodbye, Joss.', end: true },
          ],
        },
        // (the route's way on: the Signal Market, its silent tower, src/story/bazaar-data.js)
        broadcast: {
          say: ['~whisper~ The planet’s hum, on the taut cables at night. Madame Sel says it was always there. But now there are voices in it: a market crying its wares, a thousand signs all talking at once.',
            '~curious~ And one tower among them that says nothing. You can hear the gap where it should be. Somebody ought to go and ask it why.'],
          choices: [{ text: '~neutral~ I’ll find that market.', end: true }],
        },
        hold: { say: ['~happy~ (Joss pats the nearest cable like a patient horse.) They’ll hold. I’ll still measure every morning. A moorer who trusts a cable soon has fewer islands.'], choices: [{ text: '~neutral~ Goodbye.', end: true }] },
      },
    },
  },
};

/** What the moorers say once the cables are taut. */
export const LINES_AFTER = ['~happy~ Hear them hum?', '~playful~ Not a hand’s width. Not a finger’s.', '~solemn~ (she listens to the cable, one hand on it)', '~curious~ There’s a market on the line tonight.'];
