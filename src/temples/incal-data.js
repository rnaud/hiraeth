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
    lines: ['~neutral~ Lamps don’t light themselves. Well. These don’t.', '~curious~ You came down by the tower? Nobody comes by the tower.', '~tired~ Round and round, up there. All night.'],
    talk: {
      entry: [
        { if: { flag: 'temple.incal.done' }, node: 'after' },
        { if: { flag: 'temple.incal.entered' }, node: 'inside' },
        { if: { flag: 'met.vell' }, node: 'again' },
        { node: 'hello' },
      ],
      nodes: {
        hello: {
          say: ['~neutral~ Mind the wick. I’m Vell. I light the lamps along the rim, and nobody thanks me, which is how you know it’s a real job.',
            '~curious~ That tower behind me is the makers’. The rim calls it a folly. The bottom says the makers built it to keep *the shaft breathing*: once, a wind came up the pit at night and carried the smog away.',
            '~whisper~ It stopped the night the sky rang. Since then something walks round and round at the top of it. You can hear it from here if you stop talking. Which I never do.'],
          do: { set: { 'met.vell': true } },
          choices: [
            { text: '~neutral~ I’ll go up and look.', do: { start: 'temple.incal' }, goto: 'go' },
            { text: '~curious~ What walks up there?', goto: 'walks' },
            { text: '~neutral~ Good night, Vell.', end: true },
          ],
        },
        walks: {
          say: ['~solemn~ A warden, my mother said. A machine of the makers, to keep the breath going. Three legs and one lamp for an eye.', '~scared~ Its lamp used to be gold. Now when it passes the slits it shows red.'],
          choices: [{ text: '~neutral~ I’ll go up and look.', do: { start: 'temple.incal' }, goto: 'go' }, { text: '~neutral~ Good night, Vell.', end: true }],
        },
        go: {
          say: ['~neutral~ *The door is on the side facing your ship.* It has never been shut. Nobody goes in, so nobody had to.', '~playful~ If you find the makers’ old jets in there, the bottom would like a word. They have stairs.'],
          choices: [{ text: '~happy~ I’ll tell you what I find.', end: true }],
        },
        again: {
          say: ['~neutral~ The tower’s door faces your ship. *Up* is the only way it goes.'],
          choices: [{ text: '~neutral~ I’m going.', if: { quest: 'temple.incal', started: false }, do: { start: 'temple.incal' }, end: true }, { text: '~neutral~ Goodbye.', end: true }],
        },
        inside: {
          say: ['~surprised~ You went in. Is it as tall inside as it looks?', '~curious~ And the warden?'],
          choices: [
            { text: '~solemn~ Still walking. Its eye is red.', goto: 'red' },
            { text: '~neutral~ I’m going back up.', end: true },
          ],
        },
        red: { say: ['~solemn~ Then it’s broken, not wicked. Machines don’t get wicked. They get stuck.', '~neutral~ Unstick it. Or stop it. Whichever it lets you.'], choices: [{ text: '~neutral~ I will.', end: true }] },
        after: {
          say: ['~surprised~ Did you feel it? Last night the wind came up the shaft. Up! Out of the pit, warm, smelling of rain that never got down there.',
            '~happy~ By the Upward Shrine there’s a column of it now, and the bottom folk step into it and come up to the rim like seeds on a draught. They’re standing all along the parapet looking at the sky.',
            '~solemn~ The hum in the tower has stopped. I miss it a little. Don’t tell anyone.'],
          choices: [
            { text: '~solemn~ It was stuck. I stopped it.', goto: 'stopped' },
            { text: '~happy~ Light a lamp for it, Vell.', end: true },
          ],
        },
        stopped: { say: ['~sad~ Somebody had to. It kept the breath for longer than any of us have been alive. Then it kept only itself.', '~neutral~ I’ll light the lamp by its door. That’s what lamps are for.'], choices: [{ text: '~neutral~ Goodbye, Vell.', end: true }] },
      },
    },
  },
};

/** What the rim says once the shaft breathes. */
export const LINES_AFTER = ['~surprised~ The wind came up the shaft!', '~happy~ The bottom rode the breath up here!', '~curious~ Did you hear? The tower stopped humming.', '~happy~ Look, they can see the sky.'];
