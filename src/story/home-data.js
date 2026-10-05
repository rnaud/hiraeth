// Home's words (src/story/home.js runs them; src/levels/home.js builds the place).
//
// Lou, the traveller's daughter, seven and a half: lively, curious, draws on
// everything. She lives in the small house across the yard with Aunt Tove (the
// mother's younger sister) while her father travels; he writes her a card from
// every world, and she draws each one (her drawings: src/levels/home-drawings.js)
// and makes a copy of every keepsake he tells her about for her shelf. Her lines
// follow how many keepsakes he has brought (keepsakeBand) and the newest world
// he has written from (DRAWING_LINES). Moustache is her dog: scruffy, medium,
// white whiskers under his nose, follows whoever came home last.
//
// The round house is the parents' (dark, still): THINGS has what you can look at
// there. The stone in the yard: HOMAGE has the quiet lines when you kneel there.
//
// Flags: home.lou.met, home.tove.met, home.flowers (kinds on the stone),
// home.stone (token ids on the stone), home.lou.drawing (her drawing on the
// stone, from the ending), home.visits.

/** How many keepsakes he has brought, as Lou sees it: 0 a few, 1 a good many, 2 lots, 3 everything. */
export function keepsakeBand(n) { return n < 6 ? 0 : n < 11 ? 1 : n < 17 ? 2 : 3; }

const count = (ctx) => ctx.game.keepsakes?.()?.length ?? 0;
const band = (b) => (ctx) => keepsakeBand(count(ctx)) === b;
const done = (w) => (ctx) => !!ctx.game.flag(`world.${w}.done`) || (ctx.game.keepsakes?.() ?? []).some((k) => k.level === w);
const carrying = (ctx) => !!ctx.game.flag('home.flower.held');
const ended = (ctx) => !!ctx.game.flag('ending.done');

/** What Lou says about her drawing of each world (her newest one first). */
export const DRAWING_LINES = {
  desert: '~happy~ That’s the giants in the desert. They’re lying down because they’re tired from carrying all the water. I gave them a sun.',
  incal: '~curious~ That’s the city that goes down and down. I did all the lamps. Do people really live at the bottom? Do they get any sky?',
  arzach: '~surprised~ That’s the bird as big as a house! And that’s you on her back. You’re small because she’s big.',
  arzach2: '~curious~ Stones in the sky, and a bell. I didn’t know what a bell sounds like in the sky, so I drew it loud.',
  garage: '~playful~ That’s the Major’s machine. I gave it a big wheel. Tove says machines don’t need faces, so I didn’t give it one. It’s sad.',
  buried: '~curious~ The machine under the ground, with its teeth. And a lamp, so nobody is scared down there.',
  edena: '~happy~ The garden that ate the ships. I like it best. Can we make ours eat something? Not the house.',
  spheres: '~curious~ Round things on a round place. That’s all I knew from your card, so I drew them round.',
  perdide: '~sad~ The wood where it always rains. I did a lot of rain. Then I felt sorry for it and added the crystal.',
  perdide2: '~whisper~ The three lamps in the deep wood. You have to whisper about that one. I don’t know why. I just do.',
  bazaar: '~happy~ The tower that listens! I put people round it, listening too. Everybody’s ears are big.',
};

export const PEOPLE = {
  lou: {
    id: 'lou', name: 'Lou', title: 'your daughter, seven and a half', color: '#f2c54b', voice: 1.6, kind: 'f', age: 'child', scale: 0.72,
    palette: { cloak: '#f2c54b', lining: '#2b211f', cloth: '#f2c54b', legs: '#c8483a', hat: '#e6875f', hair: '#8a5638' }, head: 'curls', cape: 0, look: { trim: 'dots', body: 'none', prop: 'none', mask: 'none', robe: 0.48 },
    lines: ['~happy~ Moustache! Come here! No, the other way!', '~playful~ Stand still. I’m drawing you.', '~curious~ Is the ship hot? Can I touch it?', '~happy~ I picked the yellow ones. Don’t tell Tove.'],
    talk: {
      entry: [
        { if: (ctx) => !ctx.game.flag('home.lou.met'), node: 'hello' },
        { if: (ctx) => !ctx.npc?.greetedThisVisit && !ended(ctx), node: 'back' },
        { if: carrying, node: 'flower' },
        { node: 'again' },
      ],
      nodes: {
        hello: {
          say: ['~shout~ You came! You came, you came!', '~playful~ Tove said you would and I said you wouldn’t and I was wrong. That’s allowed.', '~curious~ What did you bring? Did you bring anything? Show me.'],
          do: { set: { 'home.lou.met': true } },
          choices: [{ text: '~happy~ I brought a lot. Look.', goto: 'brought' }, { text: '~whisper~ Come here first.', goto: 'hug' }],
        },
        back: {
          say: ['~happy~ You’re back again! Moustache knew. He sat by the ring all morning.', '~curious~ What did you bring this time?'],
          choices: [{ text: '~happy~ Look.', goto: 'brought' }, { text: '~whisper~ Come here first.', goto: 'hug' }],
        },
        hug: {
          say: ['~happy~ (She runs into your knees so hard you nearly sit down in the grass, and holds on.)', '~curious~ Now what did you bring?'],
          next: 'brought',
        },
        brought: {
          say: [
            { text: '~sad~ That’s all? You were gone for ever.', if: band(0) },
            { text: '~playful~ It’s all right. Things are heavy. I’d have brought a stone.', if: band(0) },
            { text: '~surprised~ A song AND words AND a thing? Tove! He brought a thing!', if: band(1) },
            { text: '~happy~ I made one of each for my shelf, from your cards. You can check if I got them right.', if: band(1) },
            { text: '~surprised~ That many? You’ll need a bigger ship.', if: band(2) },
            { text: '~happy~ My shelf is nearly full. I had to put the Major’s one next to my socks.', if: band(2) },
            { text: '~surprised~ That’s everything there is! You brought the whole sky home.', if: band(3) },
            { text: '~playful~ My shelf is full. Tove says it’s a museum now. I charge one button to come in.', if: band(3) },
          ],
          choices: [{ text: '~happy~ Show me your drawings.', goto: 'drawings' }, { text: '~solemn~ Have you been to see them? The stone.', goto: 'stone' }],
        },
        drawings: {
          say: [
            '~happy~ They’re on the wall, by the door. One for every card you sent.',
            { text: DRAWING_LINES.bazaar, if: done('bazaar') },
            { text: DRAWING_LINES.perdide2, if: (ctx) => done('perdide2')(ctx) && !done('bazaar')(ctx) },
            { text: DRAWING_LINES.arzach, if: (ctx) => done('arzach')(ctx) && !done('perdide2')(ctx) && !done('bazaar')(ctx) },
            { text: DRAWING_LINES.desert, if: (ctx) => !done('arzach')(ctx) && !done('perdide2')(ctx) && !done('bazaar')(ctx) },
            '~whisper~ There’s one I’m doing now. That one’s secret. It’s for them.',
          ],
          choices: [{ text: '~solemn~ Have you been to see them?', goto: 'stone' }, { text: '~happy~ I’ll go and look.', end: true }],
        },
        stone: {
          say: ['~solemn~ Every Sunday. Tove does the weeds and I do the flowers.', '~curious~ You can pick some from the garden. The yellow ones are best. Grandma liked the yellow ones.',
            '~sad~ Grandpa didn’t like anything. But he kept my drawings in his chair. I saw.'],
          choices: [{ text: '~solemn~ I’ll take them some flowers.', end: true }],
        },
        flower: {
          say: ['~happy~ You picked one! Is it for them? Put it at the front, where they can see.'],
        },
        again: {
          say: [
            { text: '~playful~ Moustache ate a sock today. A whole one. It came out again, don’t worry.', if: (ctx) => count(ctx) % 3 === 0 && !ended(ctx) },
            { text: '~curious~ Is it true there are worlds where it rains all the time? Where do they keep the dry?', if: (ctx) => count(ctx) % 3 === 1 && !ended(ctx) },
            { text: '~happy~ I’m going to be a traveller. But the kind that comes back every Sunday.', if: (ctx) => count(ctx) % 3 === 2 && !ended(ctx) },
            { text: '~whisper~ The reel is still on the stone. Sometimes I go and look at it. I don’t touch it. Can we listen to the bit where you’re small again?', if: ended },
            { text: '~curious~ When you go again, will you write? You always write.', if: ended },
          ],
          choices: [{ text: '~happy~ Show me your drawings.', goto: 'drawings' }, { text: '~playful~ What do you want to be when you’re big?', goto: 'big', once: true }],
        },
        big: {
          say: ['~solemn~ Big.', '~playful~ And a traveller. With a dog. And I’ll write every single day, even when nothing happens. Especially then.'],
        },
      },
    },
  },
  tove: {
    id: 'tove', name: 'Aunt Tove', title: 'your mother’s sister', color: '#8a6fb8', voice: 1.08, kind: 'f', scale: 0.96,
    palette: { cloak: '#8a6fb8', lining: '#2b211f', cloth: '#5f8fb8', legs: '#34405e', hat: '#e6875f', hair: '#b9b0a8' }, head: 'bun', cape: 0.85, look: { body: 'scarf', trim: 'hem', prop: 'none', mask: 'none' },
    lines: ['~neutral~ Mind the beans. They bite.', '~happy~ There’s soup. There’s always soup.', '~tired~ That dog will be the end of me.'],
    talk: {
      entry: [
        { if: (ctx) => !ctx.game.flag('home.tove.met'), node: 'hello' },
        { if: carrying, node: 'flower' },
        { node: 'again' },
      ],
      nodes: {
        hello: {
          say: ['~happy~ There he is. Thinner. They don’t feed you out there.', '~solemn~ She’s talked of nothing else since your last card. She drew your ship forty times. The dog is in most of them.',
            '~neutral~ Go and see your mother and father when you’re ready. The flowers are Lou’s doing. She won’t let me near them.'],
          do: { set: { 'home.tove.met': true } },
          choices: [{ text: '~sad~ I should have come back sooner.', goto: 'sooner' }, { text: '~curious~ How has she been?', goto: 'lou' }],
        },
        sooner: {
          say: ['~solemn~ Yes. And now you have. Both of those are true, love.', '~sad~ They knew about her, you know. Your mother crossed the yard every morning to do her hair. Your father pretended he didn’t watch from the window.',
            '~whisper~ Sit with them a while. Then come in and eat.'],
        },
        lou: {
          say: ['~playful~ Loud. Clever. Draws on everything, the walls included. She’s you, mostly.', '~happy~ The dog walks her to the stone and back. I think he misses your father too. Your father used to walk him, at the end.'],
        },
        flower: {
          say: ['~happy~ One of Lou’s yellow ones. She’ll pretend to be cross. She won’t be.'],
        },
        again: {
          say: [
            { text: '~neutral~ The soup’s on. It’s always on. It doesn’t get better, only hotter.', if: (ctx) => !ended(ctx) },
            { text: '~solemn~ Their door sticks. It always did. Push, then lift.', if: (ctx) => !ended(ctx) },
            { text: '~happy~ You look lighter. Not thinner. Lighter.', if: ended },
            { text: '~neutral~ Go when you have to. We’ll be here. The lamp’s easy to keep.', if: ended },
          ],
          choices: [{ text: '~curious~ How has she been?', goto: 'lou' }],
        },
      },
    },
  },
};

/** Things to look at: the round house's memories, and Lou's things in the small house. */
export const THINGS = {
  photo: {
    id: 'home.photo', name: 'A photo', title: 'on the side table', color: '#c9a35a',
    talk: { nodes: { look: { say: ['~solemn~ (The two of them in front of the house, young, squinting into the sun. Between them, you at seven, scowling at whoever held the camera.)',
      '~whisper~ (Someone has dusted the glass. Lou, probably. Only the glass.)'] } } },
  },
  chair: {
    id: 'home.chair', name: 'Your father’s chair', title: 'turned to the window', color: '#8a3f36',
    talk: { nodes: { look: { say: ['~solemn~ (His chair, turned to the round window. The cushion still holds the shape of him. His cap on the arm.)',
      '~sad~ (Down the side of the cushion, folded small: a child’s drawings. A round ship. A dog with a moustache. A man in a hood, waving.)',
      '~whisper~ (He kept them where he sat.)'] } } },
  },
  scarf: {
    id: 'home.scarf', name: 'Your mother’s scarf', title: 'on the stand by the door', color: '#5fb7ad',
    talk: { nodes: { look: { say: ['~solemn~ (Her scarf, on the stand by the door, where she left it for the next time she went out. Teal on one side, orange on the other.)',
      '~whisper~ (It still smells of the garden.)'] } } },
  },
  recorder: {
    id: 'home.recorder', name: 'The recorder', title: 'under the mast', color: '#6e7d8c',
    talk: { nodes: { look: { say: ['~solemn~ (The old house recorder, the cable from the mast still in its back. One spindle bare. Its spool is the reel: you have carried it all this way.)',
      { text: '~whisper~ (The little light is out. Nobody will leave a message on it again.)', if: (ctx) => !ended(ctx) },
      { text: '~whisper~ (The little light is out. The reel is on the stone now, where it can hear them.)', if: ended }] } } },
  },
  window: {
    id: 'home.window', name: 'The round window', title: 'the lamp in it, out', color: '#4a5a8a',
    talk: { nodes: { look: { say: ['~solemn~ (The round window. Her lamp is still on its table under it, the wick black. From here you can see the ring where the ship stands, and the whole of the sky.)',
      '~whisper~ (He stood here at the end, and said he heard something singing.)'] } } },
  },
  shelf: {
    id: 'home.shelf', name: 'Lou’s shelf', title: 'a copy of every keepsake', color: '#f2c54b',
    talk: { nodes: { look: { say: ['~happy~ (Lou’s shelf: a copy of every keepsake you wrote to her about, in clay and paper and string, each with a label in crayon.)',
      { text: '~playful~ (The labels say what they are, mostly. One says THE SAD WOOD ONE.)', if: (ctx) => count(ctx) >= 6 },
      { text: '~happy~ (There is room left on it. She has dusted the empty places too.)', if: (ctx) => count(ctx) < 17 }] } } },
  },
  wall: {
    id: 'home.drawings', name: 'Lou’s drawings', title: 'one for every card', color: '#c8483a',
    talk: { nodes: { look: { say: ['~happy~ (Lou’s drawings, pinned by the door: one for every world you wrote to her from. Crayon, pressed hard. The sky is always very blue.)',
      '~playful~ (In every one of them there is a small figure in a red hood, somewhere, waving.)'] } } },
  },
  seat: {
    id: 'home.seat', name: 'The window seat', title: 'Lou’s lookout', color: '#c8483a',
    talk: { nodes: { look: { say: ['~solemn~ (The window seat. From here you can see the ring, and the path, and the whole of the sky over it.)',
      '~whisper~ (Tove says Lou sat here every evening, watching for a light coming down.)'] } } },
  },
};

/** The stone: what comes to you when you kneel there (by what you bring). */
export const HOMAGE = {
  arrive: '~solemn~ (You kneel by the stone. The grass is cool. The two rings, overlapping like the moons, and their names under them.)',
  flower: (name) => `~solemn~ (You lay ${name} at the front, where they can see it.)`,
  tokens: '~solemn~ (You set down what you have found since. There is still room on the slab.)',
  empty: '~solemn~ (Your hands are empty. You rest one on the stone. It is warm from the day.)',
  quiet: [
    '~whisper~ (The wind in the grass. Somewhere behind you, Lou is telling the dog a long story.)',
    '~whisper~ (Two moons over the hill. The washing moves on the line.)',
    '~whisper~ (The lamp by their door is lit. Tove keeps it.)',
  ],
  say: ['~whisper~ Hello, you two.', '~whisper~ I’m here.', '~whisper~ It’s me again.'],
  lou: '~whisper~ (Lou comes and stands beside you, and doesn’t say anything at all, which is a first.)',
};

/** At the ending, Lou at the stone (src/story/ending.js tombLines, ctx.lou). */
export const LOU_AT_STONE = {
  run: '~shout~ You came! Tove! He came!',
  bring: '~whisper~ I brought something too. It’s for them.',
  drawing: '~solemn~ (Lou props her drawing against the stone: the round house, the two of them, and the two of you, holding hands.)',
  after: '~whisper~ Was that you? The little one, waving?',
  you: '~whisper~ That was me.',
};

/** Moustache, petted (a toast, now and then). */
export const PETTED = [
  '~happy~ Moustache leans his whole weight into your hand.',
  '~happy~ Moustache sits on your foot, so you can’t leave.',
  '~playful~ Moustache sneezes, delighted with himself.',
  '~happy~ Moustache thumps his tail on the ground, twice, three times.',
];
