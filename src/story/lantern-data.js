// The Lantern's story as data: "We Heard You" (docs/story-bible.md, "The Lantern"; src/story/lantern.js
// runs it, src/levels/lantern.js builds the place).
//
// Ilen, the traveller's elder sister, left home thirty years ago with the father's words ("make us
// proud, bring back something of value"). A makers' light found her ship far out and brought her in
// to the lantern, not gently: her ship never flew again (the last thing it sent home was the light's
// singing). Odile and Talo had come in on a light long before her, looking for what brought them
// down over Viridel and Lorn II; they kept the lantern, and her. They lie on the point now.
//
// The makers built the lantern to listen for anyone a long way from home and send a light to bring
// them in. When the father's broadcast finally reached her, thirty years on the old relays ("Come with
// empty hands. Just come."), she answered the only way a light can carry: she sang his own message
// back into one, with the makers' sign on it (three dots over an arc: "we heard you"), and sent it
// home. It sang over the round house (the father at the window), found nobody calling back, and went
// looking for the voice that had called her: it found it on the reel playing in the father's ship's
// cockpit, and went straight to it, singing (the traveller paused the reel to listen). It passed so close it
// drained the ship (they drink what a ship runs on as they pass) and left its sign on the hull, and he came
// down in the desert. It was trying to bring the father here; it found his son, and his son followed it.
//
// She speaks the home tongue (no translator: the first voice out there that sounds like home). She
// asks what he brought, and hears what he chose on the way (src/story/ending.js choicesMade): Dov's
// lift token, Hollin's promise, Esk's hill. Then she comes home with him (`finale.met`), and the true
// ending plays at the stone (src/ship/homecoming.js).
//
// Flags: finale.met, finale.hollin (she has asked him to tell Hollin), lantern.moment.arrive,
// world.lantern.done. Keepsake: lantern.person (Ilen herself: she walks to the stone, NOT_SET_DOWN).

const Q = 'lantern.ilen';
export const QUEST_ID = Q;

export const ITEMS = {};
/** The Lantern's keepsake: her. (It never goes on the slab: src/story/ending.js NOT_SET_DOWN.) */
export const KEEPSAKE = { id: 'lantern.person', level: 'lantern', name: 'Ilen', kind: 'person',
  text: 'Your sister. She heard him, thirty years late, and answered, and now she is coming home.' };

export const QUESTS = [
  {
    id: Q, title: 'We Heard You', world: 'lantern', main: true,
    outro: 'The singing light was Ilen’s answer. She is coming home with you.',
    stages: [
      { id: 'ilen', text: 'Walk the sand bar to the lantern. Someone is waiting at its foot', label: 'The lantern', talk: 'ilen' },
    ],
  },
];

const told = { flag: 'calls.ilen.told' };
// what he tells her he brought: each once (`finale.told.<what>`, set by its node), in either of the two nodes that ask
const untold = (k, extra) => ({ all: [{ not: { flag: `finale.told.${k}` } }, ...(extra ? [extra] : [])] });
// (three answers at most to a page: the token first, then the rest)
const BROUGHT = [
  { text: '~whisper~ I gave a man his way home. A lift token he’d carried for eleven years.', goto: 'token', if: untold('token', { flag: 'incal.token', is: 'returned' }) },
  { text: '~neutral~ I kept a lift token a guard gave me. He’d carried it eleven years.', goto: 'tokenKept', if: untold('token', { flag: 'incal.token', is: 'kept' }) },
  { text: '~solemn~ I set everything on their stone. Every keepsake.', goto: 'stone', if: untold('stone') },
];
const MORE = [
  { text: '~sad~ I broke something I couldn’t mend. A hill of tea, in Viridel.', goto: 'broke', if: untold('broke', { flag: 'edena.terraces.flooded' }) },
  { text: '~solemn~ I set everything on their stone. Every keepsake.', goto: 'stone', if: untold('stone') },
  { text: '~solemn~ Come home with me. My daughter’s there. Lou. She draws everything.', goto: 'home' },
];

export const PEOPLE = {
  ilen: {
    id: 'ilen', name: 'Ilen', title: 'who keeps the lantern', color: '#5fb7ad', voice: 0.92, kind: 'f', lang: 'home', scale: 1.0,
    // the mother's colours (her scarf at home is teal and coral), and grey coming into her hair
    palette: { cloak: '#5fb7ad', lining: '#e6875f', cloth: '#f3ead8', legs: '#465c65', hat: '#e6875f', hair: '#8a7a70' }, head: 'bun', cape: 1.1, look: { body: 'scarf', trim: 'hem', prop: 'none', mask: 'none' },
    lines: ['~whisper~ It’s singing again. It does when someone comes.', '~happy~ Mind the third stone. It rocks.', '~solemn~ Thirty years. You get used to the quiet. You never like it.'],
    talk: {
      entry: [
        { if: { flag: 'finale.met' }, node: 'after' },
        { if: { flag: 'met.ilen' }, node: 'again' },
        { node: 'hello' },
      ],
      nodes: {
        hello: {
          say: [
            '~surprised~ (A woman stands at the lantern’s step, one hand up against its light, watching you come along the bar.)',
            '~surprised~ That ship. I know that hull. He let me paint the stripe on it when I was nine.',
            '~whisper~ Say something. Anything. I want to hear if you sound like home.',
          ],
          do: { set: { 'met.ilen': true } },
          choices: [{ text: '~whisper~ Ilen?', goto: 'name' }, { text: '~neutral~ It was my father’s ship.', goto: 'was' }],
        },
        again: {
          say: ['~whisper~ You came back to the step. I’m still here. Where would I go?', '~solemn~ Sit with me. Tell me about them, slowly. I want to hear it properly this time.'],
          choices: [{ text: '~sad~ They died two years ago. Within a season of each other.', goto: 'gone' }],
        },
        name: {
          say: ['~surprised~ Nobody has said my name like that in thirty years. Like it’s an ordinary word.', '~curious~ Who are you?'],
          choices: [{ text: '~solemn~ Your brother. I was born after you left.', goto: 'brother' }],
        },
        was: {
          say: ['~sad~ Was. You said was.'],
          choices: [{ text: '~solemn~ I’m his son. Your brother. I was born after you left.', goto: 'brother' }],
        },
        brother: {
          say: [
            '~surprised~ A brother.',
            '~whisper~ (She looks at you a long time, the way you look at a drawing to see who it is of.)',
            '~sad~ You have his hands. Mum always said I had his hands.',
            '~solemn~ They’re not with you. Tell me straight. I’ve had thirty years of not knowing. I’d rather know.',
          ],
          choices: [
            { text: '~sad~ They died two years ago. Within a season of each other.', goto: 'gone' },
            { text: '~tired~ Can I sit down first? It’s a long bar.', goto: 'sit' },
          ],
        },
        sit: {
          say: [
            '~sad~ (You sit on the lantern’s step. After a moment she sits beside you, not quite touching.)',
            '~whisper~ That’s an answer too, the way you said it. Go on. When you can.',
          ],
          choices: [{ text: '~sad~ They died two years ago. Within a season of each other.', goto: 'gone' }],
        },
        gone: {
          say: [
            '~sad~ (She puts a hand flat on the lantern’s wall, all at once, as if her legs had decided something without her.)',
            '~sad~ Two years. His message took thirty to reach me, and I missed them by two.',
            '~whisper~ Did they stop waiting? You can say yes. I would have.',
          ],
          choices: [
            { text: '~solemn~ No. Mum kept a lamp lit in the round window.', goto: 'lamp' },
            { text: '~solemn~ Dad stood at the window at night and listened for singing.', goto: 'window', if: { any: [{ flag: 'calls.trace' }, { flag: 'calls.beat.light.late' }] } },
          ],
        },
        lamp: { say: ['~sad~ The round window. Of course she did.', '~whisper~ She used to leave it on for me when I was out late. I was always out late.'], next: 'light' },
        window: { say: ['~sad~ Then it got that far. It reached him, at least. I hoped it would.', '~whisper~ I didn’t know it would only make him stand at a window.'], next: 'light' },
        light: {
          say: [
            '~solemn~ (She looks past you, at the scorch along the hull. She looks at it a long time.) A light did that. A singing one.',
            '~sad~ It was mine. My answer. I’m sorry.',
          ],
          choices: [{ text: '~curious~ Your answer?', goto: 'answer' }, { text: '~angry~ It drained my ship. I came down in a desert.', goto: 'sorry' }],
        },
        sorry: {
          say: ['~sad~ I know. I’m sorry. They drink what a ship runs on as they pass. In thirty years I’ve never seen one of them be gentle.', '~solemn~ Let me tell you what it is. Then be angry, if you still want to. I’d understand.'],
          next: 'answer',
        },
        answer: {
          say: [
            '~solemn~ Talo said the makers built this lantern, to listen for anyone a long way from home and send a light to bring them in. I only know what it does.',
            '~sad~ One brought me in, thirty years ago. My ship never flew again. That’s the top half of it, there. I live in it.',
            { text: '~sad~ (You tell her what Mum’s recording said: the last sound from her ship was singing.) Then she heard the light that took me. I’m glad she heard something.', if: told },
            '~neutral~ Then Dad’s message came, crawling along the old relays. *Come with empty hands. Just come.* Thirty years on the way.',
            '~solemn~ A light can’t carry words. It carries a song. So I sang his own message into one, and put the makers’ sign on it, and sent it home.',
          ],
          choices: [{ text: '~curious~ The sign. Three dots over an arc.', goto: 'sign' }, { text: '~curious~ Then why did it come to my ship?', goto: 'why' }],
        },
        sign: {
          say: ['~solemn~ {glyph} It’s on everything they left. Every people out there has a name for it. Odile read it as *we heard you*.', '~whisper~ She might be wrong. It’s what I wanted him to hear.'],
          choices: [{ text: '~curious~ Then why did it come to my ship?', goto: 'why' }],
        },
        why: {
          say: [
            '~sad~ I sent it home. I think it got there: it sang over the house, and nobody called back. A light can’t knock.',
            '~solemn~ Then it went looking for the voice that had called me, I think. His voice, on a reel, playing in his own ship.',
            '~sad~ Talo used to say they only know straight. If he was right, it wasn’t trying to bring you down. It was trying to bring him here.',
          ],
          choices: [
            { text: '~whisper~ The reel was playing when it came. His message. I stopped it to listen.', goto: 'reel' },
            { text: '~tired~ It has a funny way of bringing people.', goto: 'funny' },
          ],
        },
        funny: {
          say: ['~sad~ (She looks at the scorch on the hull again.) It does. It brought me the same way.'],
          choices: [{ text: '~whisper~ The reel was playing when it came. His message. I stopped it to listen.', goto: 'reel' }],
        },
        reel: {
          say: ['~whisper~ Then it heard him, at the end. It did what I asked. It just found you instead.', '~solemn~ And you came after it, all this way. A light can’t make anyone do that.', '~happy~ (She laughs, and wipes her face with her sleeve.) Which is better. I didn’t know there was a you to find.'],
          choices: [
            { text: '~curious~ You said Odile. Odile and Talo?', goto: 'odile', if: { any: [{ flag: 'clue.edena.struck' }, { flag: 'perdide2.saucer.seen' }, { flag: 'clue.edena.pod' }] } },
            { text: '~curious~ You’ve been alone here all this time?', goto: 'odile' },
          ],
        },
        odile: {
          say: [
            '~solemn~ Not all of it. Odile and Talo got here first, a long time before me. Brought down twice, and the third time they came looking. Gardeners, the pair of them.',
            '~happy~ They kept the lantern, and they kept me. Talo taught me to read its song. Odile taught me to plant anything in anything.',
            '~sad~ They’re on the point now, under two stones. Talo first, then Odile, eight winters ago. I kept the lantern after.',
          ],
          choices: [
            { text: '~solemn~ Hollin still keeps the pools lit for them, in the deep wood.', goto: 'hollin', if: { flag: 'perdide2.hollin.told' } },
            { text: '~neutral~ I brought some things. Dad told me to.', goto: 'brought' },
          ],
        },
        hollin: {
          say: [
            '~surprised~ Hollin? The boy who lit the pools? Odile talked about him. He’d be old now.',
            { text: '~solemn~ You promised him you’d go back? Then go. Tell him they got here. Tell him they were happy, mostly. That’s a promise worth what it costs.', if: { flag: 'perdide2.promise', is: 'yes' } },
            { text: '~solemn~ You didn’t promise him. That’s all right. But somebody should tell him they got here.', if: { not: { flag: 'perdide2.promise', is: 'yes' } } },
          ],
          do: { set: { 'finale.hollin': true } },
          choices: [{ text: '~neutral~ I brought some things. Dad told me to.', goto: 'brought' }],
        },
        brought: {
          say: ['~playful~ Something of value. He told me too. Go on, then. What did you bring?'],
          choices: BROUGHT,
        },
        more: { say: ['~curious~ What else?'], choices: MORE },
        token: {
          say: ['~sad~ Eleven years. My first ten here, I’d have given anything for a token like that.', '~happy~ Good. Somebody should get to use one.'],
          do: { set: { 'finale.told.token': true } },
          next: 'more',
        },
        tokenKept: {
          say: ['~solemn~ Then keep it well. Somebody carried it a long way to give it to you.'],
          do: { set: { 'finale.told.token': true } },
          next: 'more',
        },
        broke: {
          say: ['~solemn~ Then you’re bringing something home after all. Dad never told us that kind weighs the most.', '~sad~ (She doesn’t say it was all right. She holds your wrist a moment, then lets go.)'],
          do: { set: { 'finale.told.broke': true } },
          next: 'more',
        },
        stone: {
          say: ['~sad~ Their stone. On the hill, under the two moons. (She closes her eyes.) Is there room on it?', '~whisper~ No. Don’t answer that. I’ll see.'],
          do: { set: { 'finale.told.stone': true } },
          next: 'more',
        },
        home: {
          say: [
            '~sad~ Home. I said that word to the lantern every night for thirty years. It never said it back.',
            '~happy~ A niece. Who draws. I’ll need a better face before she draws it.',
            '~solemn~ The lantern kept itself for a thousand years before Odile and Talo. It can keep itself a while.',
            '~happy~ Give me a moment to shut the house. I’ll meet you at your ship. His ship.',
          ],
          do: [{ set: { 'finale.met': true } }, { advance: [Q, 'ilen'] }],
          choices: [{ text: '~happy~ I’ll wait for you.', end: true }],
        },
        after: {
          say: ['~happy~ Thirty years of things in that house, and I’m taking one.', '~solemn~ Go on to the ship. I’m right behind you.'],
        },
      },
    },
  },
};

/** Ilen at home, after the true ending: the round house is hers now, its lamp lit (src/story/home.js). */
export const ILEN_HOME = {
  ...PEOPLE.ilen,
  title: 'your sister, home',
  lines: ['~happy~ Lou has drawn me nine times. I look better every time.', '~whisper~ The lamp’s lit. Mum would like that.', '~playful~ Tove says I’m allowed one chair. I chose his.'],
  talk: {
    entry: [{ node: 'home' }],
    nodes: {
      home: {
        say: [
          { text: '~happy~ I lit Mum’s lamp in the round window. It took four tries. The wick remembered.', if: { flag: 'ending.final' } },
          { text: '~solemn~ Give me a little while. Thirty years, and the stone is the first thing I’ve wanted to see twice.', if: { not: { flag: 'ending.final' } } },
          { text: '~playful~ You still owe Hollin a visit. I haven’t forgotten. Neither has he, I expect.', if: (ctx) => ctx.game.flag('perdide2.promise') === 'yes' && !ctx.game.flag('perdide2.promise.kept') },
          { text: '~happy~ Lou wants to be a traveller. The kind that comes back on Sundays. I told her that’s the best kind.', if: (ctx) => !(ctx.game.flag('perdide2.promise') === 'yes' && !ctx.game.flag('perdide2.promise.kept')) },
        ],
        choices: [{ text: '~curious~ Do you miss the lantern?', goto: 'miss', once: true }, { text: '~happy~ I’m glad you’re home.', end: true }],
      },
      miss: { say: ['~solemn~ Every night, when it gets dark and nothing sings.', '~happy~ Then Lou starts talking, and I forget to.'] },
    },
  },
};

/** The moment on first stepping onto the island: the light comes down into the lantern's crown (src/story/lantern.js). */
export const ARRIVE_LINES = [
  '~solemn~ (Overhead, the singing light. It comes down out of the dusk, slowly, the way none of them ever saw it do.)',
  '~solemn~ (It settles into the lantern’s crown, and the whole island hums the same note as your hull.)',
];
