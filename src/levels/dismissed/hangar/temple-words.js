// (Kept as the Hangar had them until October 2026, when the house moved to the Glass Dunes as the Clock-House and
// its words were written again there: src/temples/garage-data.js. Nothing reads this file; it is kept to reuse.)
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
    lines: ['~neutral~ Tick. Tock. Tick… no, that one’s wrong too.', "~tired~ Every clock wound. Eleven different times. Excellent variety.", "~curious~ Know the time? Neither do the clocks."],
    talk: {
      entry: [
        { if: { flag: 'temple.garage.done' }, node: 'after' },
        { if: { flag: 'temple.garage.entered' }, node: 'inside' },
        { if: { flag: 'met.wim' }, node: 'again' },
        { node: 'hello' },
      ],
      nodes: {
        hello: {
          say: ["~neutral~ Wim. Clock-winder. Hold still while I count… No. That one’s wrong too. I wind every clock on this plateau each morning.",
            "~solemn~ That’s *the First Garage*. The Major found it here before building the rest. Kept his first car in the porch and copied the mark from its door.",
            "~sad~ The works below set the pace for this whole world. They jolted when the singing light passed. Three machines stopped. Something underneath has been winding tighter ever since."],
          do: { set: { 'met.wim': true } },
          choices: [
            { text: '~neutral~ I’ll go down and look.', do: { start: 'temple.garage' }, goto: 'go' },
            { text: '~curious~ Winding itself up?', goto: 'winding' },
            { text: '~neutral~ Goodbye, Wim.', end: true },
          ],
        },
        winding: {
          say: ["~whisper~ Listen against the rim at night. Springs straining. A clock wound past its patience.", "~solemn~ Clemence calls it *the Foreman*. Brask’s notes say it’s always right. He wrote that before it began doing this."],
          choices: [{ text: '~neutral~ I’ll go down and look.', do: { start: 'temple.garage' }, goto: 'go' }, { text: '~neutral~ Goodbye.', end: true }],
        },
        go: {
          say: ["~neutral~ *The door under the clock.* Unlocked. The Major said locks require knowing what you mean to keep. He rarely got that far.",
            "~curious~ Look for a tool that makes you faster. The clocks inside demand several things before the first one fades. Ordinary speed won’t do."],
          choices: [{ text: '~happy~ Quicker. Got it.', end: true }],
        },
        again: {
          say: ["~neutral~ *Through the door under the clock.* Follow the ticking."],
          choices: [{ text: '~neutral~ I’m going.', if: { quest: 'temple.garage', started: false }, do: { start: 'temple.garage' }, end: true }, { text: '~neutral~ Goodbye.', end: true }],
        },
        inside: {
          say: ['~surprised~ You went in! Is it all clocks, inside?', '~curious~ And the Foreman? Is it as tall as they say?'],
          choices: [
            { text: "~solemn~ It needs six numbers lit together.", goto: 'six' },
            { text: '~neutral~ I’m going back.', end: true },
          ],
        },
        six: { say: ["~curious~ Six targets before they reset. Your tank takes too long to refill normally.", "~neutral~ Find the makers’ warm little device inside. It should speed up the work."], choices: [{ text: '~neutral~ I’ll look.', end: true }] },
        after: {
          say: ["~surprised~ Listen. A steady tick. (The hands above the door move. Great wheels turn inside the cliff.)",
            "~happy~ Every clock agrees! I checked twice. Ottla cried and blamed oil in her eye. Ambroise says even the board blinks tidily.",
            "~solemn~ I’ll still wind them each morning. Now I’ll know when morning is."],
          choices: [
            { text: '~solemn~ It was wound wrong. I set it right.', goto: 'right' },
            { text: '~happy~ What time is it, Wim?', goto: 'time' },
            { text: '~neutral~ Goodbye, Wim.', end: true },
          ],
        },
        right: { say: ["~solemn~ The strain is gone. It kept our time for longer than anyone here remembers. Let it have a moment between ticks."], choices: [{ text: '~neutral~ Goodbye, Wim.', end: true }] },
        time: { say: ["~happy~ (Wim laughs at the clock.) The correct time. I’d forgotten that was an option."], choices: [{ text: '~neutral~ Goodbye.', end: true }] },
      },
    },
  },
};

/** What the plateau says once the Foreman keeps time. */
export const LINES_AFTER = ['~happy~ Tick, tock, all together.', '~surprised~ They all agree!', '~solemn~ (she listens to the clock, smiling)', '~playful~ I checked them twice.'];
