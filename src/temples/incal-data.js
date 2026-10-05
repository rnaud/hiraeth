// The City-Shaft temple's words (src/temples/incal.js builds the tower): the
// local who points you there, and what she says after. Conversation format:
// src/story/dialogue.js. Every line carries a tone (src/story/tone.js).

export const QUEST = {
  id: 'temple.incal', title: 'The Warden’s Well', world: 'incal',
  outro: 'The warden is still. The shaft breathes again, and the bottom rides its breath up to the rim.',
  find: 'The makers’ tower stands on the rim, round from the ship. Its door is open',
  gadget: 'Find what the makers left inside their tower',
  keeper: 'Something walks round and round at the top of the tower. Go up to it',
};

export const PEOPLE = {
  vell: {
    id: 'vell', name: 'Vell', title: 'who lights the rim’s lamps', color: '#25386c', voice: 0.96, kind: 'f',
    palette: { cloak: '#25386c', lining: '#f3ead8', cloth: '#9fb2c6', legs: '#34405e', hat: '#f3ead8', hair: '#5a3a2a' }, head: 'hair', cape: 0.8,
    lines: ['~neutral~ Lamps don’t light themselves. Well. These don’t.', "~curious~ Someone came to the tower? Must sweep the entrance.", '~tired~ Round and round, up there. All night.'],
    talk: {
      entry: [
        { if: { flag: 'temple.incal.done' }, node: 'after' },
        { if: { flag: 'temple.incal.entered' }, node: 'inside' },
        { if: { flag: 'met.vell' }, node: 'again' },
        { node: 'hello' },
      ],
      nodes: {
        hello: {
          say: ["~neutral~ Vell. Rim lamplighter. Mind the wick. Everyone appreciates a light until they have to stop leaning on it.",
            "~curious~ That’s *the makers’ tower*. It used to send a wind up the shaft at night, clearing the smog. The palace calls it a folly. Easy from above the smog.",
            "~whisper~ The wind stopped when the sky rang. Now something paces upstairs. Listen. I’ll try something unusual and stop talking."],
          do: { set: { 'met.vell': true } },
          choices: [
            { text: '~neutral~ I’ll go up and look.', do: { start: 'temple.incal' }, goto: 'go' },
            { text: '~curious~ What walks up there?', goto: 'walks' },
            { text: '~neutral~ Good night, Vell.', end: true },
          ],
        },
        walks: {
          say: ["~solemn~ A mechanical warden. Three legs, one lamp for an eye. Built to keep the shaft’s air moving.", "~scared~ Its eye used to be gold. Now I see red through the window slits."],
          choices: [{ text: '~neutral~ I’ll go up and look.', do: { start: 'temple.incal' }, goto: 'go' }, { text: '~neutral~ Good night, Vell.', end: true }],
        },
        go: {
          say: ["~neutral~ *The door faces your ship.* It’s open. Going in has never been the problem; wanting to has.", "~playful~ There are supposed to be old jets inside. People below could use those. Stairs are an unfair way to distribute sky."],
          choices: [{ text: '~happy~ I’ll tell you what I find.', end: true }],
        },
        again: {
          say: ["~neutral~ Enter on the side facing your ship, then climb the tower."],
          choices: [{ text: '~neutral~ I’m going.', if: { quest: 'temple.incal', started: false }, do: { start: 'temple.incal' }, end: true }, { text: '~neutral~ Goodbye.', end: true }],
        },
        inside: {
          say: ['~surprised~ You went in. Is it as tall inside as it looks?', '~curious~ And the warden?'],
          choices: [
            { text: '~solemn~ Still walking. Its eye is red.', goto: 'red' },
            { text: '~neutral~ I’m going back up.', end: true },
          ],
        },
        red: { say: ["~solemn~ Then it’s broken. Whatever you have to do, remember it once kept people breathing.", '~neutral~ Unstick it. Or stop it. Whichever it lets you.'], choices: [{ text: '~neutral~ I will.', end: true }] },
        after: {
          say: ["~surprised~ Wind from the pit! Warm air rising all the way up. I’d forgotten that smell.",
            "~happy~ There’s *an updraft beside the Upward Shrine*. People ride it to the rim. Come look at the parapet. Everyone’s looking at the sky.",
            "~solemn~ The pacing has stopped. It’s quieter here. I’m surprised to find I miss it."],
          choices: [
            { text: '~solemn~ It was stuck. I stopped it.', goto: 'stopped' },
            { text: '~happy~ Light a lamp for it, Vell.', end: true },
          ],
        },
        stopped: { say: ["~sad~ I know. It couldn’t carry on like that. Still, it worked for us longer than anyone remembers.", "~neutral~ I’ll keep its doorway lit. That much I can do."], choices: [{ text: '~neutral~ Goodbye, Vell.', end: true }] },
      },
    },
  },
};

/** What the rim says once the shaft breathes. */
export const LINES_AFTER = ['~surprised~ The wind came up the shaft!', '~happy~ The bottom rode the breath up here!', '~curious~ Did you hear? The tower stopped humming.', '~happy~ Look, they can see the sky.'];
