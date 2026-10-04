// Perdide II's story as data: "The Lamps Are Kept" (docs/story-bible.md).
//
// In the deep wood the people keep the pools lit for travellers who never
// come. Two did, once, forty-one years ago: they climbed out of a little
// sky-boat that came down in a pool, walked the lit path to the root cave,
// and said "keep a light for us". The keepers have kept one ever since, then
// a whole path of them. The traveller is the first to come in all that time.
//
// Three pools went dark the night the sky rang, when a singing light passed
// low over the wood. Relight them with the fluid (shoot them) and the third
// is answered from across the water: the saucer half sunk in its pool
// blinks back. Inside it are two couches, two names (Stel and Atan), a
// drawing of a garden of white pyramids under umbrella trees (Edena), and
// the glyph scorched across its flank: the same light struck it. It was
// their escape pod. Tell Hollin, the old lamp-keeper, and he asks you to
// come back one day, so that once the lamps were lit for someone who came.
//
// The glyph here is "the Welcome": three lamps over a hull. They paint it
// beside every pool.
//
// Conversations: src/story/dialogue.js. Quests: src/story/quests.js.
// Flags (game-state.js): perdide2.* (see src/story/perdide2.js).

const Q = 'perdide2.lamps';

export const ITEMS = { latch: 'Pim’s dome latch', lamp: 'a moss lamp' };

// ------------------------------------------------------------------ quests
export const QUESTS = [
  {
    id: Q, title: 'The Lamps Are Kept', world: 'perdide2', main: true,
    outro: 'The pools are lit for you. Hollin will keep them lit until you come back.',
    stages: [
      { id: 'hollin', text: 'Someone is waiting on the island. Talk to the old lamp-keeper', label: 'Hollin, the lamp-keeper', flag: 'perdide2.hollin.met', at: 'hollin' },
      { id: 'pools', text: 'Relight the three dark pools along the path: shoot them with your fluid', label: 'A dark pool', when: (q) => (q.game.flag('perdide2.pools.lit') ?? 0) >= 3, at: 'darkPool' },
      { id: 'answer', text: 'Something answered from across the water. Whistle for the skiff and go and see', label: 'The light across the water', flag: 'perdide2.saucer.seen', at: 'saucer' },
      { id: 'tell', text: 'Tell Hollin what you found. He has walked down to the root cave to see the lights', label: 'Hollin, at the root cave', flag: 'perdide2.hollin.told', at: 'hollin' },
    ],
  },
  {
    id: 'perdide2.latch', title: 'The Moss-Dome Latch', world: 'perdide2',
    outro: 'Pim’s door shuts, and opens, and shuts again. She is delighted.',
    stages: [
      { id: 'find', text: 'Find Pim’s latch: “on the big roof”, the glass dome further down the path', label: 'Pim’s latch', bring: 'latch', at: 'latch', to: 'pim' },
      { id: 'return', text: 'Bring the latch back to Pim by the moss domes', label: 'Pim, by the moss domes', bring: 'latch', to: 'pim' },
    ],
  },
  {
    id: 'perdide2.skiff', title: 'Whose Skiff?', world: 'perdide2',
    outro: 'The skiff is Fen’s, and Fen says it is yours now, for as long as you need it.',
    stages: [
      { id: 'owner', text: 'Find the skiff’s owner: Bram thinks it’s the hermit in the far dome, out on the deep water', label: 'The far dome', talk: 'fen', at: 'fen' },
    ],
  },
];

const P = (cloak, cloth, extra = {}) => ({ cloak, lining: '#2b211f', cloth, legs: '#2f3a4f', ...extra });

// ------------------------------------------------------------------ the level's own people
// CONTENT.perdide2.npcs (src/levels/perdide2.js): kind by index (spawnNPCs: even m, odd f).
export const KEEPERS = [
  {
    at: [-8, 10], radius: 2, palette: P('#f2a07a', '#3e5a6a'),
    lines: ['The lit pools lead to the cave. Keep to them after dark.', 'A traveller. A traveller!', 'The eggs are warm. Don’t ask what’s inside.'],
    id: 'hollin', name: 'Hollin', title: 'keeper of the lamps', color: '#f2a07a', voice: 0.8,
    talk: {
      entry: [
        { if: { quest: Q, done: true }, node: 'after' },
        { if: { quest: Q, stage: 'tell' }, node: 'tell' },
        { if: { quest: Q, stage: 'answer' }, node: 'answer' },
        { if: { quest: Q, stage: 'pools' }, node: 'again' },
        { node: 'hello' },
      ],
      nodes: {
        hello: {
          say: ['…A traveller? On the path? Stand still, let me look at you.', 'Forty-one years I’ve kept the pools lit for travellers, and you’re the first who ever came. I’m Hollin. I don’t know what to do with my hands.'],
          choices: [
            { text: 'Why light pools for nobody?', goto: 'why' },
            { text: 'Who were you expecting?', goto: 'why' },
            { text: 'I’m just passing through.', goto: 'passing' },
          ],
        },
        passing: { say: ['Passing through! Ha. That’s what travellers do. That’s exactly what they do. Oh, I’ve waited a long time to hear somebody say that.'], choices: [{ text: 'Why do you light the pools?', goto: 'why' }] },
        why: {
          say: ['Because someone said they would come back. Two of them, long ago, climbed out of a little sky-boat that came down in the deep pool. They walked the path to the root cave, and they said: keep a light for us.', 'So we kept one. Then a whole path of them, in case they forgot the way. We call it keeping the Welcome.'],
          choices: [{ text: 'The Welcome?', goto: 'glyph' }, { text: 'And they never came back.', goto: 'dark' }],
        },
        glyph: {
          say: ['The mark: {glyph} Three lamps over a hull. We paint it by every pool so a traveller knows they’re expected.'],
          do: { set: { 'perdide2.glyph.heard': true } },
          choices: [{ text: 'I’ve seen that mark. It’s burned into my ship.', goto: 'mark' }, { text: 'And the travellers never came back.', goto: 'dark' }],
        },
        mark: { say: ['On your ship? Then you were expected too, maybe, only not by us.'], choices: [{ text: 'And the two travellers?', goto: 'dark' }] },
        dark: {
          say: ['Not yet. But listen: three pools went dark along the path. The night the sky rang, they went out, and nothing we pour in will take.',
            { if: { not: { flag: 'perdide2.pools.lit' } }, text: 'My lamps want water that remembers light. And that tank on your back is full of it, isn’t it? I can see it from here, all those colours.' },
            { if: { not: { flag: 'perdide2.pools.lit' } }, text: 'Would you? Three dark pools, between here and the root cave. Splash them. Wake them up.' },
            { if: { flag: 'perdide2.pools.lit' }, text: '…Wait. You’ve already been splashing them, haven’t you? I saw new colours on the path and thought my eyes were going. Light the rest, if any are still dark.' }],
          do: { set: { 'perdide2.hollin.met': true } },
          choices: [{ text: 'I’ll light them.', end: true }, { text: 'What happened the night the sky rang?', goto: 'rang' }],
        },
        rang: { say: ['Ask Wick, down by the glass dome. She was out with her bucket. I was asleep, which at my age is the only sensible thing to do at night.'], choices: [{ text: 'I’ll light your pools.', end: true }] },
        again: {
          say: [{ if: { flag: 'perdide2.pools.lit', is: 1 }, text: 'One’s lit! I saw it from here, a new colour on the path. Two more.' },
            { if: { flag: 'perdide2.pools.lit', is: 2 }, text: 'Two! Two lit. The last one is down by the root cave, where the path ends.' },
            { if: { not: { flag: 'perdide2.pools.lit' } }, text: 'Three dark pools, between here and the root cave. You’ll know them: cold, like eyes shut.' }],
          choices: [{ text: 'What happened the night the sky rang?', goto: 'rang' }, { text: 'On my way.', end: true }],
        },
        answer: { say: ['The deep pool answered? The sky-boat? …Go and look. Whistle up the skiff. I’m walking down to the root cave to see your lights with my own eyes.'], choices: [{ text: 'Meet you there.', end: true }] },
        tell: {
          say: ['Look at them. Every pool on the path, lit, and three in colours nobody here has ever made.', 'Tell me. What’s in the boat?'],
          choices: [
            { text: 'Two couches. Two names, Stel and Atan. And a drawing of a garden with white pyramids.', goto: 'names', if: { flag: 'perdide2.saucer.seen' } },
            { text: 'I haven’t been out to it yet.', end: true, if: { not: { flag: 'perdide2.saucer.seen' } } },
          ],
        },
        names: {
          say: ['Stel and Atan. Yes. That’s them; that’s what they called each other.', 'A garden. Somewhere far, with white pyramids. Forty-one years of lamps, and they’re in a garden.', 'I should be sad. I’m not. It sounds like a good place to have got to.'],
          next: 'promise',
        },
        promise: {
          say: ['Will you do something for me, traveller? Come back. One day. Not for anything.', 'Just so that once, the lamps were lit for someone who came.'],
          choices: [
            { text: 'I’ll come back.', do: [{ set: { 'perdide2.promise': 'yes', 'perdide2.hollin.told': true } }], goto: 'thanks' },
            { text: 'I can’t promise that.', do: [{ set: { 'perdide2.promise': 'maybe', 'perdide2.hollin.told': true } }], goto: 'maybe' },
          ],
        },
        thanks: { say: ['Then I’ll keep them lit. I was going to anyway. But now it’s for someone.'], choices: [{ text: 'Goodbye, Hollin.', end: true }] },
        maybe: { say: ['Then don’t promise. Just come, if you can. The pools will be lit either way. They always are.'], choices: [{ text: 'Goodbye, Hollin.', end: true }] },
        after: {
          say: ['The pools are lit. They’re always lit. Come when you can.'],
          choices: [{ text: 'I will.', end: true }],
        },
      },
    },
  },
  {
    at: [-24, -126], radius: 2, palette: P('#3f6a6a', '#a49cc8'), shy: true,
    lines: ['We live in the domes. The moss keeps them cool.', 'Someone left their latch on the big roof again. Me. I did.'],
    id: 'pim', name: 'Pim', title: 'who lives in a moss dome', color: '#3f6a6a', voice: 1.25,
    talk: {
      entry: [
        { if: { quest: 'perdide2.latch', done: true }, node: 'after' },
        { if: { has: 'latch' }, node: 'back' },
        { if: { quest: 'perdide2.latch', active: true }, node: 'waiting' },
        { node: 'hello' },
      ],
      nodes: {
        hello: {
          say: ['Oh! A stranger. I don’t… we don’t… Hollin will be beside himself.', 'I’m Pim. That’s my dome, the mossy one. It doesn’t shut. Well, it shuts. It doesn’t stay shut.'],
          choices: [
            { text: 'Why not?', goto: 'latch' },
            { text: 'What are the domes?', goto: 'domes' },
            { text: 'Have you seen anything strange?', goto: 'strange' },
          ],
        },
        domes: { say: ['Houses. Old ones. Nobody built them; we found them, and moved in, and put moss on them to keep them cool. The glass one down the path has ribs like a fish. Nobody lives in that one. Too bright.'], choices: [{ text: 'And your door?', goto: 'latch' }, { text: 'Bye, Pim.', end: true }] },
        latch: {
          say: ['I climbed the big roof to watch the lights, the glass dome further down the path, and I put my latch down to hold on, and then I came down without it.', 'I’m not climbing up there again. It’s very high and very round.'],
          choices: [{ text: 'I’ll fetch it.', do: { start: 'perdide2.latch' }, goto: 'thanks' }, { text: 'That’s a shame.', end: true }],
        },
        thanks: { say: ['Would you? It’s a ring of shell with a hook. Right on top. You can’t miss it, unless you fall off, which I did.'], choices: [{ text: 'I’ll be careful.', end: true }] },
        waiting: { say: ['On top of the glass dome, down the path. Mind the ribs; they’re slippery.'], choices: [{ text: 'Going.', end: true }] },
        strange: { say: ['Strange? You. Mostly you. And the night the sky rang, the pools went out. Wick saw it. Wick sees everything; she never sleeps.'], choices: [{ text: 'And your door?', goto: 'latch', if: { quest: 'perdide2.latch', started: false } }, { text: 'Bye, Pim.', end: true }] },
        back: {
          say: ['My latch! You went all the way up?', 'There. Shut. Open. Shut. Oh, that’s lovely. Listen to that click.', 'Here, take this. A moss lamp: it lights itself when it’s dark enough. It’s the only thing I’ve got that isn’t a door.'],
          do: [{ take: 'latch' }, { advance: 'perdide2.latch' }, { give: 'lamp' }],
          choices: [{ text: 'Thank you, Pim.', end: true }],
        },
        after: { say: ['Shut. Open. Shut. I’ve been doing it all evening.'], choices: [{ text: '(smile)', end: true }] },
      },
    },
  },
  {
    at: [-22, -406], radius: 2, palette: P('#f6b08a', '#3a4560'),
    lines: ['The skiff is moored in the shallows by the cave.', 'Whistle and it will come. It knows the deep water.'],
    id: 'bram', name: 'Bram', title: 'who minds the cave mouth', color: '#f6b08a', voice: 0.95,
    talk: {
      entry: [{ if: { flag: 'met.bram' }, node: 'again' }, { node: 'hello' }],
      nodes: {
        hello: {
          say: ['End of the path. The root cave. Nothing past it but roots and more roots.', 'I’m Bram. I mind the mouth, which mostly means I sit here.'],
          choices: [
            { text: 'Whose skiff is that?', goto: 'skiff' },
            { text: 'What’s in the cave?', goto: 'cave' },
            { text: 'Where did the two travellers go?', goto: 'two' },
          ],
        },
        again: {
          say: ['Still here. The cave’s still here. The roots haven’t moved.'],
          choices: [
            { text: 'Whose skiff is that?', goto: 'skiff' },
            { text: 'Where did the two travellers go?', goto: 'two' },
            { text: 'Bye, Bram.', end: true },
          ],
        },
        skiff: {
          say: ['Not ours. It’s been moored there longer than I’ve been minding. Whistle and it comes, out on the water, and it goes back when you’re done, like a dog that lives with everybody.', 'Old Fen might know. He lives in the far dome, out on the deep water past the saucer pool. Nobody visits him, on account of the deep water.'],
          do: { start: 'perdide2.skiff' },
          choices: [{ text: 'I’ll ask him.', end: true }],
        },
        cave: { say: ['Warm light, all the way to the back. It glows on its own. Hollin says the two travellers slept in there before they went on. I say it’s a cave.'], choices: [{ text: 'Whose skiff is that?', goto: 'skiff' }, { text: 'Bye, Bram.', end: true }] },
        two: { say: ['Out of the wood, the long way, through the cave and out the other side. That’s the story. Nobody’s been through since; the roots have grown over the far end.'], choices: [{ text: 'Whose skiff is that?', goto: 'skiff' }, { text: 'Bye, Bram.', end: true }] },
      },
    },
  },
];

// ------------------------------------------------------------------ the story's own people
export const PEOPLE = {
  wick: {
    id: 'wick', name: 'Wick', title: 'a young lamp-keeper', color: '#ffd6a0', voice: 1.35, kind: 'f',
    palette: { cloak: '#ffd6a0', lining: '#2b211f', cloth: '#3a6a58', legs: '#2f3a4f', hat: '#f2a07a', hair: '#2b211f' }, head: 'hair', cape: 0.55,
    lines: ['It won’t take my light.', 'Splash it! Go on!', 'Mind the eggs.'],
    talk: {
      entry: [
        { if: { flag: 'perdide2.pool.1' }, node: 'lit' },
        { if: { flag: 'met.wick' }, node: 'again' },
        { node: 'hello' },
      ],
      nodes: {
        hello: {
          say: ['I tried! I poured and poured and it won’t take. Hollin says it needs water that remembers light. Mine only remembers the bucket.'],
          choices: [
            { text: 'What happened to it?', goto: 'night' },
            { text: 'Let me try.', end: true },
          ],
        },
        again: { say: ['Still dark. Go on, try yours.'], choices: [{ text: 'What happened to it?', goto: 'night' }, { text: '(aim at the pool)', end: true }] },
        night: {
          say: ['The night the sky rang. I was out with my bucket. A light came over the wood, low, singing, like when you run your finger round a wet cup.', 'Every pool it passed over went out: pop, pop, pop. Three of them. Then it climbed and it was gone.'],
          do: { set: { 'perdide2.rumour.light': true } },
          choices: [{ text: 'Something like that hit my ship.', goto: 'ship' }, { text: 'I’ll light it again.', end: true }],
        },
        ship: { say: ['Did it sing to you too? Hollin says lights don’t sing. I say he doesn’t go out at night.'], choices: [{ text: 'It sang.', end: true }] },
        lit: {
          say: ['You lit it! Look at the colours in it. Those aren’t our colours. Those are yours.', 'I’m going to run ahead and light the rest of the path brighter for you. Watch the pools as you go!'],
          choices: [{ text: 'What happened the night the sky rang?', goto: 'night', if: { not: { flag: 'perdide2.rumour.light' } } }, { text: 'Thank you, Wick.', end: true }],
        },
      },
    },
  },
  fen: {
    id: 'fen', name: 'Fen', title: 'who lives in the far dome', color: '#9fe0d0', voice: 0.7, kind: 'm',
    palette: { cloak: '#9fe0d0', lining: '#2b211f', cloth: '#4a4f7a', legs: '#2f3a4f', hat: '#3a8f8a', hair: '#e8e2f2' }, head: 'wizard', cape: 1.25,
    lines: ['Visitors! On the deep water!', 'Is that my skiff?', 'Mind the moss.'],
    talk: {
      entry: [{ if: { quest: 'perdide2.skiff', done: true }, node: 'after' }, { node: 'hello' }],
      nodes: {
        hello: {
          say: ['Visitors! Nobody visits. Nobody can, on account of the deep water. How did you…', 'Is that my skiff? That’s my skiff! Teal, with the white stripe. I’d know it anywhere. I haven’t seen it in forty years.'],
          choices: [
            { text: 'It’s yours?', goto: 'mine' },
            { text: 'It was moored at the root cave.', goto: 'mine' },
          ],
        },
        mine: {
          say: ['Mine. I lent it, long ago, to two strangers who came out of the sky-boat in the pool there. Stel and Atan. They were waiting for a ship of their own, and the waiting took a season.', 'They used my skiff to fish, and to go and sit in the saucer of an evening, and look up. Then they gave up waiting, moored it at the cave, and walked out of the wood. Didn’t come and tell me. I don’t blame them. Deep water.'],
          do: [{ set: { 'perdide2.fen.told': true } }, { start: 'perdide2.skiff' }],
          choices: [
            { text: 'Where did they go?', goto: 'where' },
            { text: 'Do you want it back?', goto: 'back' },
          ],
        },
        where: {
          say: ['A garden, they said. A world that was all garden, with white pyramids. They had a drawing of it, in the saucer. Stel drew it, so they wouldn’t forget what they were walking toward.'],
          do: { set: { 'clue.perdide2.edena': true } },
          choices: [{ text: 'Do you want your skiff back?', goto: 'back' }],
        },
        back: {
          say: ['Back? What would I do with it? I’ve got used to the deep water. It keeps the visitors off. Mostly.', 'No. You keep it, for as long as you’re here. It likes being used. Whistle, and bring it home to me sometimes so I can see it go by.'],
          do: [{ advance: 'perdide2.skiff' }],
          choices: [{ text: 'Thank you, Fen.', end: true }],
        },
        after: { say: ['There it goes. Look at it skim. Forty years, and it still turns left better than right.'], choices: [{ text: 'Goodbye, Fen.', end: true }] },
      },
    },
  },
};

// The scenery you can look at.
export const THINGS = {
  saucer: {
    id: 'saucer', name: 'The saucer', title: 'half sunk in the deep pool', color: '#4fbcb0', voice: 0.6,
    talk: {
      entry: [{ if: { flag: 'perdide2.saucer.seen' }, node: 'again' }, { node: 'look' }],
      nodes: {
        look: {
          say: ['The saucer sits tilted in the deep pool, water lapping at its rim. Its little light blinks: three short, one long. Three short, one long.', 'Across its flank, scorched black into the teal: {glyph} Three dots over an arc. The same mark as the scar on your ship.', 'Through the canopy: two couches side by side, worn shiny. Two names scratched into the console, STEL and ATAN. And taped above them, a drawing, faded almost white: a garden of umbrella trees and white pyramids under a pale sky.', 'It isn’t a ship. It’s a lifeboat. Whatever ship it fell from was struck by the same singing light that struck yours.'],
          do: [{ set: { 'perdide2.saucer.seen': true, 'clue.perdide2.edena': true } }],
          choices: [{ text: '(remember the garden)', end: true }],
        },
        again: { say: ['The little light blinks three short, one long, as if it were still expecting an answer. The garden drawing is still there, behind the canopy.'], choices: [{ text: '(look a while)', end: true }] },
      },
    },
  },
  pool: {
    id: 'darkPool', name: 'A dark pool', title: 'gone out', color: '#3a4560', voice: 0.6,
    talk: { nodes: { look: {
      say: ['The pool is dark and cold, like an eye shut. The eggs round it are grey. Beside it, painted on a stone, the Welcome: {glyph}', 'It wants water that remembers light. (*Shoot* it: aim with the right mouse button or R, then left click or G.)'],
      choices: [{ text: '(step back)', end: true }],
    } } },
  },
};

export const LINES = {
  lit: ['The pools! Look!', 'A traveller, lighting the lamps!', 'Hollin will cry.', 'Keep to the lit path!'],
};
