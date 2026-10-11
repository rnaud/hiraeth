// The Clock-House's words (src/temples/garage.js builds it, in the Glass Dunes): the local who points you there,
// and what she says after. The glassworkers keep their camps' clocks by the house in the sand; Wim winds them.
// (It was the Sealed Hangar's First Garage until October 2026, and Wim wound the Major's clocks on his plateau:
// the Hangar was dismissed, src/levels/names.js DISMISSED; the house and Wim came to the dunes. The ids stay
// 'garage': the saves' quest.temple.garage, temple.garage.*.) Conversation format: src/story/dialogue.js. Every
// line carries a tone.

export const QUEST = {
  id: 'temple.garage', title: 'The Clock-House', world: 'glassdunes', main: true,   // (the Glass Dunes' one thread: src/story/glassdunes.js)
  outro: 'The Clockwork Foreman keeps the right time again, and every clock in the dunes ticks in step.',
  find: 'East of the valley, a round stair-house of the makers stands in the sand, a stopped clock over its door: the Clock-House',
  gadget: 'Find what the makers left in the Clock-House',
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
          say: ["~neutral~ Wim. Clock-winder. Hold still while I count… No. That one’s wrong too. I wind every clock in both camps each morning.",
            "~solemn~ That’s *the Clock-House*. It stood here before the sand turned to glass, the old ones say. Or the glass came round it. Nobody agrees.",
            "~sad~ Its works set the pace for these dunes. They jolted when the singing light passed. Every clock in the camps stopped. Something underneath has been winding tighter ever since."],
          do: { set: { 'met.wim': true } },
          choices: [
            { text: '~neutral~ I’ll go down and look.', do: { start: 'temple.garage' }, goto: 'go' },
            { text: '~curious~ Winding itself up?', goto: 'winding' },
            { text: '~neutral~ Goodbye, Wim.', end: true },
          ],
        },
        winding: {
          say: ["~whisper~ Put your ear to the drum at night. Springs straining. A clock wound past its patience.", "~solemn~ The kiln-keepers call it *the Foreman*. They say it’s always right. They said that before it began doing this."],
          choices: [{ text: '~neutral~ I’ll go down and look.', do: { start: 'temple.garage' }, goto: 'go' }, { text: '~neutral~ Goodbye.', end: true }],
        },
        go: {
          say: ["~neutral~ *The door under the clock.* Unlocked. Nobody here locks anything. The glass keeps what it wants.",
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
          say: ["~surprised~ Listen. A steady tick. (The hands above the door move. The great cogs in the sand turn.)",
            "~happy~ Every clock agrees! I checked twice. The kiln-keepers laughed and blamed the smoke in their eyes.",
            "~solemn~ I’ll still wind them each morning. Now I’ll know when morning is.",
            "~happy~ Go home by *the float-posts*, the green floats on poles. The carriers set them out from my door to your landing flat."],
          do: { set: { 'clue.glassdunes.buried': true } },
          choices: [
            { text: '~curious~ What does the Foreman keep time for?', goto: 'wheel' },
            { text: '~happy~ What time is it, Wim?', goto: 'time' },
            { text: '~neutral~ Goodbye, Wim.', end: true },
          ],
        },
        // (the route's way on: the Buried Machine's great wheel, src/story/buried-data.js)
        wheel: {
          say: ["~whisper~ The old ones say the Foreman only keeps the small time. The slow time comes from somewhere else: a great wheel under a desert, far off, that turns one tooth a year.",
            "~curious~ If you ever find it, tell it the dunes keep time again. Wheels like to know."],
          choices: [{ text: '~neutral~ I’ll tell it.', end: true }],
        },
        time: { say: ["~happy~ (Wim laughs at the clock.) The correct time. I’d forgotten that was an option."], choices: [{ text: '~neutral~ Goodbye.', end: true }] },
      },
    },
  },
};

/** What the dunes say once the Foreman keeps time. */
export const LINES_AFTER = ['~happy~ Tick, tock, all together.', '~surprised~ They all agree!', '~solemn~ (she listens to the clock, smiling)', '~playful~ I checked them twice.'];
