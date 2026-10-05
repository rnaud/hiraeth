// Vael II's temple words (src/temples/arzach2.js builds the belfry): the local
// who points you there, and what she says after. Conversation format:
// src/story/dialogue.js. Every line carries a tone (src/story/tone.js).

export const QUEST = {
  id: 'temple.arzach2', title: 'The Founders’ Belfry', world: 'arzach2',
  outro: 'The Cloud-Mother is calm, and the stones that fell up have come down.',
  find: 'A tower rises out of the cloud beside the plateau where you landed: cross the bridge from the west rim',
  gadget: 'Find what the founders left inside their belfry',
  keeper: 'Something huge cries at the top of the belfry. Go up to it',
};

export const PEOPLE = {
  ysel: {
    id: 'ysel', name: 'Ysel', title: 'who keeps the founders’ bridge', color: '#d99072', voice: 1.08, kind: 'f',
    palette: { cloak: '#efe2cc', lining: '#d99072', cloth: '#f4efe2', legs: '#93abcc', hat: '#f4efe2', hair: '#4a3a2a' }, head: 'wrap', cape: 1.1,
    lines: ['~whisper~ Hush. Listen. There: she is crying again.', '~neutral~ Mind the bridge. It has no rail on the cloud side.', '~solemn~ The founders built it before the monastery.'],
    talk: {
      entry: [
        { if: { flag: 'temple.arzach2.done' }, node: 'after' },
        { if: { flag: 'temple.arzach2.entered' }, node: 'inside' },
        { if: { flag: 'met.ysel' }, node: 'again' },
        { node: 'hello' },
      ],
      nodes: {
        hello: {
          say: ['~whisper~ You came down out of the sky. Sister Aube will have said something rude about it. I keep this bridge. Nobody crosses it, so it is a quiet job.',
            '~solemn~ That is *the founders’ belfry*. They built it before the monastery, to keep the stones down: a bell in every room, they say, and the stones stayed where they were put.',
            '~sad~ The bells stopped, and the stones fell up. And since then something lives in the top of it that cries. Every evening. Like a bell with nothing to ring it.'],
          do: { set: { 'met.ysel': true } },
          choices: [
            { text: '~neutral~ I’ll go in.', do: { start: 'temple.arzach2' }, goto: 'go' },
            { text: '~curious~ What cries up there?', goto: 'cries' },
            { text: '~neutral~ Goodbye, Ysel.', end: true },
          ],
        },
        cries: {
          say: ['~solemn~ The Cloud-Mother, Brother Calix calls her. A whale of the air. The founders kept her, to carry the cloud away in the mornings.', '~sad~ When the stones fell up she went up with them, and she has never come down. I think she is lost in there.'],
          choices: [{ text: '~neutral~ I’ll go in.', do: { start: 'temple.arzach2' }, goto: 'go' }, { text: '~neutral~ Maybe she needs a bell.', goto: 'bell' }],
        },
        bell: { say: ['~curious~ A bell? There are bells in every room in there. All silent. Bring her one that rings, then.', '~whisper~ Nobody here has one small enough to carry.'], choices: [{ text: '~neutral~ I’ll go in.', do: { start: 'temple.arzach2' }, goto: 'go' }] },
        go: {
          say: ['~neutral~ Across the bridge, *the door on the gallery*. The cloud is a long way down. Mind it.', '~whisper~ If you hear her, don’t shout at her. Nothing that cries likes to be shouted at.'],
          choices: [{ text: '~happy~ I’ll be gentle.', end: true }],
        },
        again: {
          say: ['~neutral~ The belfry door is across the bridge, on the gallery.'],
          choices: [{ text: '~neutral~ I’m going.', if: { quest: 'temple.arzach2', started: false }, do: { start: 'temple.arzach2' }, end: true }, { text: '~neutral~ Goodbye.', end: true }],
        },
        inside: {
          say: ['~surprised~ You went in! Did the bells ring?', '~curious~ And her? Did you see her?'],
          choices: [
            { text: '~solemn~ She’s frightened, and stuck up there.', goto: 'stuck' },
            { text: '~neutral~ I’m going back.', end: true },
          ],
        },
        stuck: { say: ['~sad~ Thirty years stuck. The same as the bell.', '~solemn~ Ring for her, sky-child. Somebody should.'], choices: [{ text: '~neutral~ I will.', end: true }] },
        after: {
          say: ['~surprised~ The stones! Did you see? All over the sky, the stones that fell up are coming down. One landed on the monastery’s kitchen roof. Brother Calix laughed. I have never heard him laugh.',
            '~happy~ And she came out of the belfry this morning and swam away over the cloud, slow, like she had somewhere to be. The cloud followed her a little way.',
            '~solemn~ I think the founders would have liked you.'],
          choices: [
            { text: '~solemn~ She only needed a note to answer.', goto: 'note' },
            { text: '~happy~ Keep the bridge, Ysel.', end: true },
          ],
        },
        note: { say: ['~solemn~ We all do, I think. Thirty years the monastery rang for nobody, and nobody answered.', '~happy~ Now somebody has.'], choices: [{ text: '~neutral~ Goodbye, Ysel.', end: true }] },
      },
    },
  },
};

/** What the plateau says once the stones have come down. */
export const LINES_AFTER = ['~surprised~ The stones are coming down!', '~happy~ She swam away over the cloud!', '~solemn~ The belfry is quiet now. A good quiet.', '~playful~ One landed on the kitchen roof.'];
