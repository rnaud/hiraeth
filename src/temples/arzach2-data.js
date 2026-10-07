// Vael II's temple words (src/temples/arzach2.js builds the belfry): the local
// who points you there, and what she says after. Conversation format:
// src/story/dialogue.js. Every line carries a tone (src/story/tone.js).

export const QUEST = {
  id: 'temple.arzach2', title: 'The Founders’ Belfry', world: 'arzach2',
  outro: 'The Cloud-Mother is calm, and the stones round the belfry have come down.',
  find: 'A tower rises out of the cloud beside the plateau where you landed: cross the bridge from the west rim',
  gadget: 'Find what the founders left inside their belfry',
  keeper: 'Something huge cries at the top of the belfry. Go up to it',
};

export const PEOPLE = {
  ysel: {
    id: 'ysel', name: 'Agathe', title: 'who keeps the founders’ bridge', color: '#d99072', voice: 1.08, kind: 'f',
    palette: { cloak: '#efe2cc', lining: '#d99072', cloth: '#f4efe2', legs: '#93abcc', hat: '#f4efe2', hair: '#4a3a2a' }, head: 'wrap', cape: 1.1,
    lines: ['~whisper~ Hush. Listen. There: she is crying again.', "~neutral~ No rail on the cloud side. Please admire it from this side.", '~solemn~ The founders built it before the monastery.'],
    talk: {
      entry: [
        { if: { flag: 'temple.arzach2.done' }, node: 'after' },
        { if: { flag: 'temple.arzach2.entered' }, node: 'inside' },
        { if: { flag: 'met.ysel' }, node: 'again' },
        { node: 'hello' },
      ],
      nodes: {
        hello: {
          say: ["~whisper~ I keep this bridge. Very few crossings. Aube may already have complained about your arrival. Don’t worry; it’s how she welcomes things.",
            "~solemn~ Across it is *the founders’ belfry*, older than the monastery. Its room bells helped keep loose stones down.",
            "~sad~ The bells stopped and loose stones rose round the belfry. Now something cries upstairs every evening. I hear it from the bridge."],
          do: { set: { 'met.ysel': true } },
          choices: [
            { text: '~neutral~ I’ll go in.', do: { start: 'temple.arzach2' }, goto: 'go' },
            { text: '~curious~ What cries up there?', goto: 'cries' },
            { text: '~neutral~ Goodbye, Agathe.', end: true },
          ],
        },
        cries: {
          say: ["~solemn~ Calix calls her *the Cloud-Mother*. An air-whale. She once carried the morning cloud away for the founders.", "~sad~ She rose with the stones and never came down. I think she’s trapped, or frightened. Perhaps both."],
          choices: [{ text: '~neutral~ I’ll go in.', do: { start: 'temple.arzach2' }, goto: 'go' }, { text: '~neutral~ Maybe she needs a bell.', goto: 'bell' }],
        },
        bell: { say: ["~curious~ There are silent bells in every room. If you find a way to ring one, try letting her hear it.", '~whisper~ Nobody here has one small enough to carry.'], choices: [{ text: '~neutral~ I’ll go in.', do: { start: 'temple.arzach2' }, goto: 'go' }] },
        go: {
          say: ["~neutral~ Cross *the bridge to the gallery door*. Mind the edge. The cloud is much farther down than it looks.", "~whisper~ If you hear her cry, approach quietly. Shouting won’t help her understand you."],
          choices: [{ text: '~happy~ I’ll be gentle.', end: true }],
        },
        again: {
          say: ["~neutral~ *Across this bridge, through the gallery door.*"],
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
          say: ["~surprised~ The loose stones are settling! One landed on the kitchen roof. Calix laughed. I expect the cook’s response will be different.",
            "~happy~ The Cloud-Mother came out this morning. Swam away across the sky. Some cloud followed her, just as the old stories said.",
            '~solemn~ I think the founders would have liked you.'],
          choices: [
            { text: '~solemn~ She only needed a note to answer.', goto: 'note' },
            { text: '~happy~ Keep the bridge, Agathe.', end: true },
          ],
        },
        note: { say: ["~solemn~ A familiar sound helped her find her way. I understand that. I’ve missed the bells too.", '~happy~ Now somebody has rung one.'], choices: [{ text: '~neutral~ Goodbye, Agathe.', end: true }] },
      },
    },
  },
};

/** What the plateau says once the stones have come down. */
export const LINES_AFTER = ['~surprised~ The stones are coming down!', '~happy~ She swam away over the cloud!', '~solemn~ The belfry is quiet now. A good quiet.', '~playful~ One landed on the kitchen roof.'];
