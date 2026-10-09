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

import { FAMILY } from '../characters/family.js';
import { ORDER } from '../levels/names.js';

/** How many keepsakes he has brought, as Lou sees it: 0 a few, 1 a good many, 2 lots, 3 everything. */
export function keepsakeBand(n) { return n < 6 ? 0 : n < 11 ? 1 : n < 17 ? 2 : 3; }

const count = (ctx) => ctx.game.keepsakes?.()?.length ?? 0;
const band = (b) => (ctx) => keepsakeBand(count(ctx)) === b;
const done = (w) => (ctx) => !!ctx.game.flag(`world.${w}.done`) || (ctx.game.keepsakes?.() ?? []).some((k) => k.level === w);
const carrying = (ctx) => !!ctx.game.flag('home.flower.held');
const ended = (ctx) => !!ctx.game.flag('ending.done');
// the true ending (src/story/ending.js): the reel's oldest recording played at the stone, Ilen home
const final = (ctx) => !!ctx.game.flag('ending.final');
const between = (ctx) => ended(ctx) && !final(ctx);
// the drawing Lou talks about: the furthest world along the route he has written from (the route's order stands in
// for "newest": the save keeps no dates), the desert's if none
const FURTHEST = [...ORDER].reverse();
const newest = (w) => (ctx) => (w === 'desert' || done(w)(ctx)) && FURTHEST.slice(0, FURTHEST.indexOf(w)).every((v) => !done(v)(ctx));

/** What Lou says about her drawing of each world (her newest one first). */
export const DRAWING_LINES = {
  desert: "~happy~ The desert giants! I drew them lying down because of all that carrying. That yellow bit is their day off.",
  incal: "~curious~ That’s the city with people at the bottom. I gave them a bit of sky. I know your card didn’t say they had one.",
  arzach: "~surprised~ The giant bird! That tiny red bit is you. I ran out of paper before I ran out of bird.",
  arzach2: "~curious~ Floating stones and a bell. Those lines mean LOUD. You have to imagine them in your ears.",
  garage: "~playful~ The Major’s machine. Tove said machines don’t need faces. I put one on the back where she won’t check.",
  buried: "~curious~ The underground wheel. All those teeth! I drew a lamp so it doesn’t bite anyone by mistake.",
  edena: "~happy~ The garden eating a ship. Can ours eat something? We could start with Tove’s bad chair.",
  spheres: "~curious~ The spheres. You said round, so I did round. Your next card needs more details.",
  perdide: "~sad~ The rainy wood. I got the paper wet on purpose. Then by accident. Then I put the crystal over the hole.",
  perdide2: "~whisper~ The lamps in the wood. I used my last yellow. They needed it more than the sun in the other drawing.",
  bazaar: "~happy~ The listening tower. I gave everyone big ears so the people at the back could hear too.",
};

export const PEOPLE = {
  lou: {
    // her body, face and look: the selected design (src/characters/family.js, references/levels/Home/characters/Lou)
    ...FAMILY.lou,
    voice: 1.6,
    // short quick steps, a run that starts early, and never quite still
    gait: { stride: 0.6, pace: 0.62, fidget: 1 },
    rest: { smile: 0.35, brow: 0.5, browTilt: 0.25 },
    lines: ["~happy~ Moustache! That’s not where I’m pointing!", "~playful~ Hold still. Your other arm is already drawn.", "~curious~ Can I touch the ship? The cool bit?", "~happy~ I picked the best flowers. They’re for Grandma."],
    talk: {
      entry: [
        { if: (ctx) => !ctx.game.flag('home.lou.met'), node: 'hello' },
        { if: (ctx) => !ctx.npc?.greetedThisVisit && !ended(ctx), node: 'back' },
        { if: carrying, node: 'flower' },
        { node: 'again' },
      ],
      nodes: {
        hello: {
          say: ["~shout~ You came! Tove! You really came!", "~playful~ Tove said you would. I said maybe. I’m glad she won this time.", "~curious~ What did you bring? Can I see? After a hug. No, before. Both."],
          do: { set: { 'home.lou.met': true } },
          choices: [{ text: '~happy~ I brought a lot. Look.', goto: 'brought' }, { text: '~whisper~ Come here first.', goto: 'hug' }],
        },
        back: {
          say: ["~happy~ Back again! Moustache knew. He waited by the ring all morning. I waited a normal amount.", "~curious~ Anything new? Show me!"],
          choices: [{ text: '~happy~ Look.', goto: 'brought' }, { text: '~whisper~ Come here first.', goto: 'hug' }],
        },
        hug: {
          say: ["~happy~ (She hits your knees at a run and holds on. You nearly sit down.)", "~curious~ All right. Now show me everything."],
          next: 'brought',
        },
        brought: {
          say: [
            { text: "~sad~ You were gone ages. I thought your bag would be bigger.", if: band(0) },
            { text: "~playful~ Never mind. You fit back in the ship. That was the important bit.", if: band(0) },
            { text: "~surprised~ A song AND words AND a thing! How did you pack the song?", if: band(1) },
            { text: "~happy~ I made copies from your cards. Come check mine. Be nice about the glue.", if: band(1) },
            { text: "~surprised~ So many! Did you leave anything out there?", if: band(2) },
            { text: "~happy~ My shelf’s nearly full. The Major has to live by my socks. He doesn’t mind. I asked.", if: band(2) },
            { text: "~surprised~ You brought everything! How did you still fit?", if: band(3) },
            { text: "~playful~ Tove calls my shelf a museum. Admission is one button. Family too. Rules are rules.", if: band(3) },
          ],
          choices: [{ text: '~happy~ Show me your drawings.', goto: 'drawings' }, { text: '~solemn~ Have you been to see them? The stone.', goto: 'stone' }],
        },
        drawings: {
          say: [
            "~happy~ By the door! One drawing for every card. I kept the cards as well.",
            ...FURTHEST.map((w) => ({ text: DRAWING_LINES[w], if: newest(w) })),
            "~whisper~ There’s another I haven’t finished. For Grandma and Grandpa. You can see it when it’s ready.",
          ],
          choices: [{ text: '~solemn~ Have you been to see them?', goto: 'stone' }, { text: '~happy~ I’ll go and look.', end: true }],
        },
        stone: {
          say: ["~solemn~ We visit their stone every Sunday. Tove weeds. I choose the flowers.", "~curious~ Pick some yellow ones from the garden. Grandma liked those best.",
            "~sad~ Grandpa said he didn’t like pictures on things. But he kept mine in his chair. So he liked them on chairs."],
          choices: [{ text: '~solemn~ I’ll take them some flowers.', end: true }],
        },
        flower: {
          say: ["~happy~ A flower for them? Put it at the front. That’s where I put mine."],
        },
        again: {
          say: [
            { text: "~playful~ Moustache stole a sock. He’s pretending he’s always had it. Don’t believe him.", if: (ctx) => count(ctx) % 3 === 0 && !ended(ctx) },
            { text: "~curious~ When a whole world is rainy, where do they dry their socks?", if: (ctx) => count(ctx) % 3 === 1 && !ended(ctx) },
            { text: "~happy~ I’ll be a traveller too. One who comes home on Sundays. Every Sunday.", if: (ctx) => count(ctx) % 3 === 2 && !ended(ctx) },
            { text: "~whisper~ Can we listen to the reel again? The bit where you’re little. You wave like me.", if: final },
            { text: "~curious~ Will you write when you go? I need things to draw.", if: final },
            { text: "~curious~ Did you find out what the singing star is yet? You promised on the stone. Once more, then you’re staying.", if: (ctx) => between(ctx) && !ctx.game.flag('finale.met') },
            { text: "~surprised~ Is she really my aunt? She doesn’t look like anyone. Then she laughs, and she looks like Grandpa.", if: (ctx) => between(ctx) && !!ctx.game.flag('finale.met') },
          ],
          choices: [{ text: '~happy~ Show me your drawings.', goto: 'drawings' }, { text: '~playful~ What do you want to be when you’re big?', goto: 'big', once: true }],
        },
        big: {
          say: ['~solemn~ Big.', "~playful~ And a traveller. With a dog. I’ll write even if nothing happens. The dog can do his bit with a paw."],
        },
      },
    },
  },
  tove: {
    // her body and look: the selected design (src/characters/family.js, references/levels/Home/characters/Aunt Tove)
    ...FAMILY.tove, voice: 1.08,
    lines: ["~neutral~ Mind the beans. They’ve taken over the path again.", "~happy~ Soup’s ready. So are the bowls. Sit down.", "~tired~ That dog has very selective hearing."],
    talk: {
      entry: [
        { if: (ctx) => !ctx.game.flag('home.tove.met'), node: 'hello' },
        { if: carrying, node: 'flower' },
        { node: 'again' },
      ],
      nodes: {
        hello: {
          say: ["~happy~ There you are. Come closer. Yes, you need feeding.", "~solemn~ Since your last card, she’s drawn your ship forty times. The dog travels in most versions. You’ll have to negotiate.",
            "~neutral~ Go to your parents’ stone when you’re ready. Lou does the flowers. A fiercely guarded appointment."],
          do: { set: { 'home.tove.met': true } },
          choices: [{ text: '~sad~ I should have come back sooner.', goto: 'sooner' }, { text: '~curious~ How has she been?', goto: 'lou' }],
        },
        sooner: {
          say: ["~solemn~ Yes. You should have. And you’re here now. We can work with now.", "~sad~ They knew Lou. Your mother crossed the yard every morning to do her hair. Your father watched from the window and pretended not to.",
            "~whisper~ Take your time with them. Then come inside. There’s a place for you at the table."],
        },
        lou: {
          say: ["~playful~ Loud. Curious. Draws on anything that holds still. Mostly you, though she finishes her pictures.", "~happy~ Moustache walks her to the stone. Your father used to walk him. I think the dog still expects that sometimes."],
        },
        flower: {
          say: ["~happy~ A yellow one. Lou chose those for your mother. She’ll be glad you’re taking it."],
        },
        again: {
          say: [
            { text: "~neutral~ Soup’s on. The longer you leave it, the more determined it gets.", if: (ctx) => !ended(ctx) },
            { text: "~solemn~ The old house door sticks. Push, then lift. Your father always meant to fix it.", if: (ctx) => !ended(ctx) },
            { text: "~happy~ You look as though you’ve put something heavy down.", if: ended },
            { text: "~neutral~ Tell Lou before you go again. Keep writing. And come back when you say you will.", if: ended },
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
    talk: { nodes: { look: { say: ["~solemn~ (Your parents stand outside the house, young and squinting. Between them, you at seven, scowling magnificently.)",
      "~whisper~ (The glass is dusted. The frame is not. About as high as Lou can reach.)"] } } },
  },
  chair: {
    id: 'home.chair', name: 'Your father’s chair', title: 'turned to the window', color: '#8a3f36',
    talk: { nodes: { look: { say: ["~solemn~ (Your father’s chair faces the round window. His cap rests on its arm.)",
      "~sad~ (Folded beside the cushion: Lou’s drawings. A ship, a dog, a hooded man waving from the edge.)",
      "~whisper~ (He kept them within reach.)"] } } },
  },
  scarf: {
    id: 'home.scarf', name: 'Your mother’s scarf', title: 'on the stand by the door', color: '#5fb7ad',
    talk: { nodes: { look: { say: ["~solemn~ (Your mother’s scarf hangs by the door. Teal outside, orange in the fold.)",
      "~whisper~ (A faint smell of the garden remains.)"] } } },
  },
  recorder: {
    id: 'home.recorder', name: 'The recorder', title: 'under the mast', color: '#6e7d8c',
    talk: { nodes: { look: { say: ["~solemn~ (The house recorder has one empty spindle. This is where you took the reel.)",
      { text: "~whisper~ (Its recording light is dark. There will be no new messages.)", if: (ctx) => !ended(ctx) },
      { text: "~whisper~ (The recorder is empty. The reel is still in your pocket.)", if: between },
      { text: "~whisper~ (The recorder is empty. The reel is outside on their stone.)", if: final }] } } },
  },
  window: {
    id: 'home.window', name: 'The round window', title: 'the lamp in it, out', color: '#4a5a8a',
    talk: { nodes: { look: { say: [{ text: "~solemn~ (Her lamp stands below the round window, wick black. From here, the landing ring is in full view.)", if: (ctx) => !final(ctx) },
      { text: "~happy~ (Her lamp is lit below the round window again. Ilen trimmed the wick. From here, the landing ring is in full view.)", if: final },
      { text: "~whisper~ (On the reel, your mother said he stood at this window one night and heard singing.)", if: (ctx) => !!ctx.game.flag('calls.beat.light.late') }] } } },
  },
  shelf: {
    id: 'home.shelf', name: 'Lou’s shelf', title: 'a copy of every keepsake', color: '#f2c54b',
    talk: { nodes: { look: { say: ["~happy~ (Clay, paper, string. Lou has made the keepsakes from your cards. Each has a crayon label.)",
      { text: "~playful~ (One label reads THE SAD WOOD ONE. It is attached very firmly.)", if: (ctx) => count(ctx) >= 6 },
      { text: "~happy~ (She has left room. The empty places are dusted too.)", if: (ctx) => count(ctx) < 17 }] } } },
  },
  wall: {
    id: 'home.drawings', name: 'Lou’s drawings', title: 'one for every card', color: '#c8483a',
    talk: { nodes: { look: { say: ["~happy~ (A drawing for every world you wrote about. Hard crayon lines. Fiercely blue skies.)",
      "~playful~ (Each includes a small red hood. You are always there, somewhere.)"] } } },
  },
  seat: {
    id: 'home.seat', name: 'The window seat', title: 'Lou’s lookout', color: '#c8483a',
    talk: { nodes: { look: { say: ["~solemn~ (From Lou’s window seat you can see the ring and the path up to the house.)",
      "~whisper~ (Tove says she watched here each evening for your ship.)"] } } },
  },
};

/** The stone: what comes to you when you kneel there (by what you bring). */
export const HOMAGE = {
  arrive: "~solemn~ (You kneel. Two carved rings overlap above their names. The grass is cool.)",
  flower: (name) => `~solemn~ (You lay ${name} at the front, where they can see it.)`,
  tokens: "~solemn~ (You set your new keepsakes beside the others. There is still room.)",
  empty: "~solemn~ (Nothing to lay down today. You rest your hand on the sun-warmed stone.)",
  quiet: [
    "~whisper~ (Behind you, Lou tells Moustache a story. He is a patient audience.)",
    "~whisper~ (Two moons above the hill. Washing stirs on the line.)",
    '~whisper~ (The lamp by their door is lit. Tove keeps it.)',
  ],
  say: ['~whisper~ Hello, you two.', '~whisper~ I’m here.', '~whisper~ It’s me again.'],
  lou: "~whisper~ (Lou stands beside you. For once, she lets the quiet stay.)",
};

/** At the ending, Lou at the stone (src/story/ending.js tombLines, ctx.lou). */
export const LOU_AT_STONE = {
  run: '~shout~ You came! Tove! He came!',
  bring: '~whisper~ I brought something too. It’s for them.',
  drawing: "~solemn~ (Lou props up her drawing: the round house, your parents, and you holding her hand.)",
  after: '~whisper~ Was that you? The little one, waving?',
  you: '~whisper~ That was me.',
};

/** Moustache, petted (a toast, now and then). */
export const PETTED = [
  '~happy~ Moustache leans his whole weight into your hand.',
  '~happy~ Moustache sits on your foot, so you can’t leave.',
  '~playful~ Moustache sneezes, delighted with himself.',
  "~happy~ Moustache thumps his tail against the ground. Then once more, to be sure.",
];
