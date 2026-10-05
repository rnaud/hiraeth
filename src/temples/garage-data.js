// The Sealed Hangar's temple words (src/temples/garage.js builds the First
// Garage): the local who points you there, and what she says after. The
// Hangar's people keep the Major's machines turning out of habit; Wim winds
// his clocks. Conversation format: src/story/dialogue.js. Every line carries a tone.

export const QUEST = {
  id: 'temple.garage', title: 'The First Garage', world: 'garage',
  outro: 'The Clockwork Foreman keeps the right time again, and everything under the plateau ticks in step.',
  find: 'On the plateau’s rim, past the windmill, a round stair-house of the makers wears a stopped clock over its door: the First Garage',
  gadget: 'Find what the makers left in the First Garage',
  keeper: 'Something at the bottom of the house is winding itself up, and up, and up. Go down to it',
};

export const PEOPLE = {
  wim: {
    id: 'wim', name: 'Wim', title: 'who winds the clocks', color: '#d8a24a', voice: 1.08, kind: 'f',
    palette: { cloak: '#62c3c9', lining: '#d8a24a', cloth: '#f3ead8', legs: '#34405e', hat: '#e88fa6', hair: '#8a5638' }, head: 'hair', cape: 0.5,
    lines: ['~neutral~ Tick. Tock. Tick… no, that one’s wrong too.', '~tired~ Every clock on the plateau, every morning. None of them agree.', '~curious~ Do you know what time it is? Nobody here does.'],
    talk: {
      entry: [
        { if: { flag: 'temple.garage.done' }, node: 'after' },
        { if: { flag: 'temple.garage.entered' }, node: 'inside' },
        { if: { flag: 'met.wim' }, node: 'again' },
        { node: 'hello' },
      ],
      nodes: {
        hello: {
          say: ['~neutral~ Hold still, I’m counting. (She listens to the stopped clock over the door, and sighs.) No. Still wrong. I’m Wim. I wind the Major’s clocks, every one on the plateau, every morning.',
            '~solemn~ That’s the *First Garage*. The Major found it here when he made the place, or it found him. He kept his first car in its porch. He copied the mark off its door, for luck.',
            '~sad~ Everything here takes its beat from the works under it: the mill, the pumps, the ring. The night the light went over, it jumped. Three machines stopped. And something down there has been winding itself up ever since.'],
          do: { set: { 'met.wim': true } },
          choices: [
            { text: '~neutral~ I’ll go down and look.', do: { start: 'temple.garage' }, goto: 'go' },
            { text: '~curious~ Winding itself up?', goto: 'winding' },
            { text: '~neutral~ Goodbye, Wim.', end: true },
          ],
        },
        winding: {
          say: ['~whisper~ You can hear it at night, if you put your ear to the rim. Springs. Like a clock that’s wound too tight and won’t strike.', '~solemn~ The Foreman, Clemence calls it. The Major’s notes say: *don’t argue with it, it’s always right*. It isn’t, any more.'],
          choices: [{ text: '~neutral~ I’ll go down and look.', do: { start: 'temple.garage' }, goto: 'go' }, { text: '~neutral~ Goodbye.', end: true }],
        },
        go: {
          say: ['~neutral~ The door under the clock. It isn’t locked. Nothing here is locked; the Major said locks are for people who know what they want to keep.',
            '~curious~ If the clocks in there want something all at once, they’ll want it faster than you can give it. Clocks are like that. Find whatever makes you quicker.'],
          choices: [{ text: '~happy~ Quicker. Got it.', end: true }],
        },
        again: {
          say: ['~neutral~ Under the clock. (She points with her winding key.)'],
          choices: [{ text: '~neutral~ I’m going.', if: { quest: 'temple.garage', started: false }, do: { start: 'temple.garage' }, end: true }, { text: '~neutral~ Goodbye.', end: true }],
        },
        inside: {
          say: ['~surprised~ You went in! Is it all clocks, inside?', '~curious~ And the Foreman? Is it as tall as they say?'],
          choices: [
            { text: '~solemn~ Six numbers on its face. All at once, it wants.', goto: 'six' },
            { text: '~neutral~ I’m going back.', end: true },
          ],
        },
        six: { say: ['~curious~ Six at once. And your tank fills in its own sweet time, I’ve watched it.', '~neutral~ The makers leave things lying about for people in a hurry. Look for something warm.'], choices: [{ text: '~neutral~ I’ll look.', end: true }] },
        after: {
          say: ['~surprised~ Listen. (She holds up a hand. Over the door the clock is ticking, and its hands are moving, and down in the cliff the great wheels are turning.) Listen to that.',
            '~happy~ Every clock on the plateau agrees with it. I went round and checked them all, twice. Ambroise says the board has never blinked so tidily. Ottla cried, and said it was oil in her eye.',
            '~solemn~ I’ll still wind them. In the mornings. Just to hear them all say the same thing.'],
          choices: [
            { text: '~solemn~ It was wound wrong. I set it right.', goto: 'right' },
            { text: '~happy~ What time is it, Wim?', goto: 'time' },
            { text: '~neutral~ Goodbye, Wim.', end: true },
          ],
        },
        right: { say: ['~solemn~ Then it can rest a little, between ticks. It kept the time here longer than anyone has been keeping anything.'], choices: [{ text: '~neutral~ Goodbye, Wim.', end: true }] },
        time: { say: ['~happy~ (She looks at the clock over the door, and laughs.) The right one. For the first time since I was born, the right one.'], choices: [{ text: '~neutral~ Goodbye.', end: true }] },
      },
    },
  },
};

/** What the plateau says once the Foreman keeps time. */
export const LINES_AFTER = ['~happy~ Tick, tock, all together.', '~surprised~ They all agree!', '~solemn~ (she listens to the clock, smiling)', '~playful~ I checked them twice.'];
