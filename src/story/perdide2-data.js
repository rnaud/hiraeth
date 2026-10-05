// Lorn II's story as data: "The Lamps Are Kept" (docs/story-bible.md).
//
// In the deep wood the people keep the pools lit for travellers who never
// come. Two did, once, forty-one years ago: Odile and Talo, who had left
// Viridel in their ship's little saucer to go and ask the singing light what
// it wanted. It found them again over the wood and struck the saucer too; it
// came down in the deep pool. They waited a season for it to come back, then
// borrowed Fen's skiff and went on across the swamp, toward the Great Crystal
// (a piece of the same light), saying "keep a light for us". The keepers have
// kept one ever since, then a whole path of them. The traveller is the first
// to come in all that time.
//
// Three pools went dark the night the sky rang, when a singing light passed
// low over the wood. Relight them with the fluid (shoot them) and the third
// is answered from across the water: the saucer half sunk in its pool
// blinks back. Inside it are two couches, two names (Odile and Talo), a
// drawing of the garden they came from (Viridel: white pyramids under
// umbrella trees, a green furrow across the meadow), and the glyph scorched
// across its flank: the same light struck it. Tell Hollin, the old
// lamp-keeper, and he asks you to come back one day, so that once the lamps
// were lit for someone who came.
//
// The glyph here is "the Welcome": three lamps over a hull (three dots over
// an arc that bows up, like every other world's). They paint it beside every
// pool.
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
      { id: 'shut', text: 'Pim’s door still won’t shut: moss has crept into the frame. Moss shrinks from light, and the moss lamp over her door is asleep. Then push the door to (push: C, middle click, or RB / R1)', label: 'Pim’s door', flag: 'perdide2.pim.door', at: 'pimDoor' },
    ],
  },
  {
    id: 'perdide2.skiff', title: 'Whose Skiff?', world: 'perdide2',
    outro: 'The skiff is Fen’s, and Fen says it is yours now, for as long as you need it.',
    stages: [
      { id: 'owner', text: 'Find the skiff’s owner: Bram thinks it’s the hermit in the far dome, out on the deep water', label: 'The far dome', talk: 'fen', at: 'fen' },
      { id: 'home', text: 'Bring the skiff home to its berth by Fen’s landing. His lamp on the mooring post is dark, and the skiff won’t come in to a dark berth; nor will it be sailed in: step off on the landing and nudge it (push: C, middle click, or RB / R1)', label: 'Fen’s berth', flag: 'perdide2.skiff.home', at: 'fenBerth' },
    ],
  },
];

const P = (cloak, cloth, extra = {}) => ({ cloak, lining: '#2b211f', cloth, legs: '#2f3a4f', ...extra });

// ------------------------------------------------------------------ the level's own people
// CONTENT.perdide2.npcs (src/levels/perdide2.js): kind by index (spawnNPCs: even m, odd f).
export const KEEPERS = [
  {
    at: [-8, 10], radius: 2, palette: P('#f2a07a', '#3e5a6a'), look: { prop: 'lamppole' },
    lines: ['~neutral~ The lit pools lead to the cave. Keep to them after dark.', '~surprised~ A traveller. A traveller!', '~playful~ The eggs are warm. Don’t ask what’s inside.'],
    id: 'hollin.perdide2', name: 'Hollin', title: 'keeper of the lamps', color: '#f2a07a', voice: 0.8,
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
          say: ['~surprised~ …A traveller? On the path? Stand still, let me look at you.', '~happy~ Forty-one years I’ve kept the pools lit for travellers, and you’re the first who ever came. I’m Hollin. I don’t know what to do with my hands.'],
          choices: [
            { text: '~curious~ Why light pools for nobody?', goto: 'why' },
            { text: '~neutral~ I’m just passing through.', goto: 'passing' },
          ],
        },
        passing: { say: ['~happy~ Passing through! Ha. That’s what travellers do. That’s exactly what they do. Oh, I’ve waited a long time to hear somebody say that.'], choices: [{ text: '~curious~ Why do you light the pools?', goto: 'why' }] },
        why: {
          say: ['~solemn~ Because someone said they would come back. Two of them, long ago, climbed out of a little sky-boat that came down burning in the deep pool. They stayed a season, and when they went on they said: keep a light for us.', '~solemn~ So we kept one. Then a whole path of them, in case they forgot the way. We call it keeping the Welcome.'],
          choices: [{ text: '~curious~ The Welcome?', goto: 'glyph' }, { text: '~sad~ And they never came back.', goto: 'dark' }],
        },
        glyph: {
          say: ['~neutral~ The mark: {glyph} Three lamps over a hull. We paint it by every pool so a traveller knows they’re expected.', '~solemn~ It’s carved round *the traveller’s chest on the root arch*, too, the blue one with the star. We dust it. It isn’t ours to open.'],
          do: { set: { 'perdide2.glyph.heard': true } },
          choices: [{ text: '~solemn~ I’ve seen that mark. It’s burned into my ship.', goto: 'mark' }, { text: '~sad~ And the travellers never came back.', goto: 'dark' }],
        },
        mark: { say: ['~curious~ On your ship? Then you were expected too, maybe, only not by us.'], choices: [{ text: '~curious~ And the two travellers?', goto: 'dark' }] },
        dark: {
          say: ['~sad~ Not yet. But listen: three pools went dark along the path. The night the sky rang, they went out, and nothing we pour in will take.',
            { if: { not: { flag: 'perdide2.pools.lit' } }, text: '~curious~ My lamps want water that remembers light. And that tank on your back is full of it, isn’t it? I can see it from here, all those colours.' },
            { if: { not: { flag: 'perdide2.pools.lit' } }, text: '~happy~ Would you? *Three dark pools*, between here and the root cave. *Splash them*. Wake them up.' },
            { if: { flag: 'perdide2.pools.lit' }, text: '~surprised~ …Wait. You’ve already been splashing them, haven’t you? I saw new colours on the path and thought my eyes were going. *Light the rest*, if any are still dark.' }],
          do: { set: { 'perdide2.hollin.met': true } },
          choices: [{ text: '~neutral~ I’ll light them.', end: true }, { text: '~curious~ What happened the night the sky rang?', goto: 'rang' }],
        },
        rang: { say: ['~playful~ *Ask Wick, at the second dark pool, down the path past the glass dome*. She was out with her bucket. I was asleep, which at my age is the only sensible thing to do at night.'], choices: [{ text: '~neutral~ I’ll light your pools.', end: true }] },
        again: {
          say: [{ if: { flag: 'perdide2.pools.lit', is: 1 }, text: '~surprised~ One’s lit! I saw it from here, a new colour on the path. Two more.' },
            { if: { flag: 'perdide2.pools.lit', is: 2 }, text: '~happy~ Two! Two lit. The last one is *down by the root cave*, where the path ends.' },
            { if: { not: { flag: 'perdide2.pools.lit' } }, text: '~sad~ Three dark pools, *between here and the root cave*. You’ll know them: cold, like eyes shut.' }],
          choices: [{ text: '~curious~ What happened the night the sky rang?', goto: 'rang' }, { text: '~neutral~ On my way.', end: true }],
        },
        answer: { say: ['~surprised~ The deep pool answered? The sky-boat? …Go and look. *Whistle up the skiff*. I’m walking down to *the root cave* to see your lights with my own eyes.'], choices: [{ text: '~neutral~ Meet you there.', end: true }] },
        tell: {
          say: ['~happy~ Look at them. Every pool on the path, lit, and three in colours nobody here has ever made.', '~curious~ Tell me. What’s in the boat?'],
          choices: [
            { text: '~solemn~ Two couches. Two names, Odile and Talo. And a drawing of a garden with white pyramids.', goto: 'names', if: { flag: 'perdide2.saucer.seen' } },
            { text: '~neutral~ I haven’t been out to it yet.', end: true, if: { not: { flag: 'perdide2.saucer.seen' } } },
          ],
        },
        names: {
          say: ['~sad~ Odile and Talo. Yes. That’s them; that’s what they called each other.', '~tired~ The garden they came from. They drew it so they wouldn’t forget the way home. Forty-one years of lamps, and I never knew what home looked like to them.', '~happy~ I like to think they got there in the end. I should be sad. I’m not, quite.'],
          next: 'promise',
        },
        promise: {
          say: ['~solemn~ Will you do something for me, traveller? Come back. One day. Not for anything.', '~sad~ Just so that once, the lamps were lit for someone who came.'],
          choices: [
            { text: '~solemn~ I’ll come back.', do: [{ set: { 'perdide2.promise': 'yes', 'perdide2.hollin.told': true } }], goto: 'thanks' },
            { text: '~sad~ I can’t promise that.', do: [{ set: { 'perdide2.promise': 'maybe', 'perdide2.hollin.told': true } }], goto: 'maybe' },
          ],
        },
        thanks: { say: ['~happy~ Then I’ll keep them lit. I was going to anyway. But now it’s for someone.'], choices: [{ text: '~neutral~ Goodbye, Hollin.', end: true }] },
        maybe: { say: ['~solemn~ Then don’t promise. Just come, if you can. The pools will be lit either way. They always are.'], choices: [{ text: '~neutral~ Goodbye, Hollin.', end: true }] },
        after: {
          say: ['~happy~ The pools are lit. They’re always lit. Come when you can.'],
          choices: [{ text: '~neutral~ I will.', end: true }],
        },
      },
    },
  },
  {
    at: [-24, -126], radius: 2, palette: P('#3f6a6a', '#a49cc8'), shy: true,
    lines: ['~neutral~ We live in the domes. The moss keeps them cool.', '~playful~ Someone left their latch on the big roof again. Me. I did.'],
    id: 'pim.perdide2', name: 'Pim', title: 'who lives in a moss dome', color: '#3f6a6a', voice: 1.25,
    talk: {
      entry: [
        { if: { quest: 'perdide2.latch', done: true }, node: 'after' },
        { if: { has: 'latch' }, node: 'back' },
        { if: { quest: 'perdide2.latch', stage: 'shut' }, node: 'stuck' },
        { if: { quest: 'perdide2.latch', active: true }, node: 'waiting' },
        { node: 'hello' },
      ],
      nodes: {
        hello: {
          say: ['~scared~ Oh! A stranger. I don’t… we don’t… Hollin will be beside himself.', '~playful~ I’m Pim. That’s my dome, the mossy one. It doesn’t shut. Well, it shuts. It doesn’t stay shut.'],
          choices: [
            { text: '~curious~ Why not?', goto: 'latch' },
            { text: '~curious~ What are the domes?', goto: 'domes' },
          ],
        },
        domes: { say: ['~neutral~ Houses. Old ones. Nobody built them; we found them, and moved in, and put moss on them to keep them cool. The glass one down the path has ribs like a fish. Nobody lives in that one. Too bright.'], choices: [{ text: '~curious~ And your door?', goto: 'latch' }, { text: '~curious~ Have you seen anything strange?', goto: 'strange' }] },
        latch: {
          say: ['~sad~ I climbed the big roof to watch the lights, *the glass dome further down the path*, and I put my latch down to hold on, and then I came down without it.', '~scared~ I’m not climbing up there again. It’s very high and very round.'],
          choices: [{ text: '~neutral~ I’ll fetch it.', do: { start: 'perdide2.latch' }, goto: 'thanks' }, { text: '~sad~ That’s a shame.', end: true }],
        },
        thanks: { say: ['~playful~ Would you? It’s *a ring of shell with a hook*. Right on top. You can’t miss it, unless you fall off, which I did.'], choices: [{ text: '~neutral~ I’ll be careful.', end: true }] },
        waiting: { say: ['~neutral~ *On top of the glass dome*, down the path. Mind the ribs; they’re slippery.'], choices: [{ text: '~neutral~ Going.', end: true }] },
        strange: { say: ['~playful~ Strange? You. Mostly you. And the night the sky rang, the pools went out. Wick saw it. Wick sees everything; she never sleeps.'], choices: [{ text: '~curious~ And your door?', goto: 'latch', if: { quest: 'perdide2.latch', started: false } }, { text: '~neutral~ Bye, Pim.', end: true }] },
        back: {
          say: ['~surprised~ My latch! You went all the way up?', '~happy~ There, on it goes. Now: shut. Shut… Oh, come on.', '~sad~ It won’t swing to. Look at the frame: the moss has crept right into it, all the time the door hung open.'],
          do: [{ take: 'latch' }, { advance: 'perdide2.latch' }],
          choices: [{ text: '~curious~ Can’t we pull the moss out?', goto: 'moss' }, { text: '~neutral~ Let me try the door.', end: true }],
        },
        moss: {
          say: ['~neutral~ Pull it? It only grows back sulking. Moss creeps toward the dark, and it shrinks from light.', '~sad~ My *moss lamp over the door* used to keep it back. It went out the night the sky rang, with the pools, and it hasn’t woken since.', '~playful~ Hollin says the pools wanted water that remembers light. Maybe my lamp does too. Then the door wants *a good shove*. It’s heavy.'],
          choices: [{ text: '~neutral~ I’ll wake it.', end: true }],
        },
        stuck: {
          say: [{ if: { not: { flag: 'perdide2.pim.lamp' } }, text: '~sad~ Still stuck. The moss won’t let go of the frame while it’s dark, and my *lamp over the door* is fast asleep.' },
            { if: { flag: 'perdide2.pim.lamp' }, text: '~happy~ My lamp’s awake! Look, the moss is curling back from it. Now *give the door a shove*, a good one.' }],
          choices: [{ text: '~curious~ Why won’t it shut?', goto: 'moss', if: { not: { flag: 'perdide2.pim.lamp' } } }, { text: '~neutral~ On it.', end: true }],
        },
        after: { say: ['~playful~ Shut. Open. Shut. I’ve been doing it all evening.', '~happy~ Keep the moss lamp somewhere dark. It likes that.'], choices: [{ text: '~happy~ (smile)', end: true }] },
      },
    },
  },
  {
    at: [-22, -406], radius: 2, palette: P('#f6b08a', '#3a4560'),
    lines: ['~neutral~ The skiff is moored in the shallows by the cave.', '~neutral~ Whistle and it will come. It knows the deep water.'],
    id: 'bram', name: 'Bram', title: 'who minds the cave mouth', color: '#f6b08a', voice: 0.95,
    talk: {
      entry: [{ if: { flag: 'met.bram' }, node: 'again' }, { node: 'hello' }],
      nodes: {
        hello: {
          say: ['~tired~ End of the path. The root cave. Nothing past it but roots and more roots.', '~playful~ I’m Bram. I mind the mouth, which mostly means I sit here.'],
          choices: [
            { text: '~curious~ Whose skiff is that?', goto: 'skiff' },
            { text: '~curious~ What’s in the cave?', goto: 'cave' },
          ],
        },
        again: {
          say: ['~tired~ Still here. The cave’s still here. The roots haven’t moved.'],
          choices: [
            { text: '~curious~ Where did the two travellers go?', goto: 'two' },
            { text: '~neutral~ Bye, Bram.', end: true },
          ],
        },
        skiff: {
          say: ['~neutral~ Not ours. It’s been moored there longer than I’ve been minding. Whistle and it comes, out on the water, and it goes back when you’re done, like a dog that lives with everybody.', '~neutral~ *Old Fen* might know. He lives in *the far dome*, out on the deep water back toward the saucer’s pool, this side of it. Nobody visits him, on account of the deep water.'],
          do: { start: 'perdide2.skiff' },
          choices: [{ text: '~neutral~ I’ll ask him.', end: true }],
        },
        cave: { say: ['~playful~ Warm light, all the way to the back. It glows on its own. Hollin says the two travellers slept in there, the night before they went on. I say it’s a cave.'], choices: [{ text: '~curious~ Whose skiff is that?', goto: 'skiff' }, { text: '~curious~ Where did the two travellers go?', goto: 'two' }] },
        two: { say: ['~neutral~ Out of the wood in old Fen’s skiff, across the swamp, toward the singing crystal. A few days later the skiff came back on its own and moored itself here, the way it does. That’s the story. Nobody’s followed them since.'], choices: [{ text: '~curious~ Whose skiff is that?', goto: 'skiff' }, { text: '~neutral~ Bye, Bram.', end: true }] },
      },
    },
  },
];

// ------------------------------------------------------------------ the story's own people
export const PEOPLE = {
  wick: {
    id: 'wick', name: 'Wick', title: 'a young lamp-keeper', color: '#ffd6a0', voice: 1.35, kind: 'f',
    palette: { cloak: '#ffd6a0', lining: '#2b211f', cloth: '#3a6a58', legs: '#2f3a4f', hat: '#f2a07a', hair: '#2b211f' }, head: 'hair', cape: 0.55, look: { prop: 'lantern' },
    lines: ['~angry~ It won’t take my light.', '~shout~ Splash it! Go on!', '~neutral~ Mind the eggs.'],
    talk: {
      entry: [
        { if: { flag: 'perdide2.pool.1' }, node: 'lit' },
        { if: { flag: 'met.wick' }, node: 'again' },
        { node: 'hello' },
      ],
      nodes: {
        hello: {
          say: ['~angry~ I tried! I poured and poured and it won’t take. Hollin says it needs water that remembers light. Mine only remembers the bucket.'],
          choices: [
            { text: '~curious~ What happened to it?', goto: 'night' },
            { text: '~neutral~ Let me try.', end: true },
          ],
        },
        again: { say: ['~tired~ Still dark. Go on, *try yours*.'], choices: [{ text: '~curious~ What happened to it?', goto: 'night' }, { text: '~neutral~ (aim at the pool)', end: true }] },
        night: {
          say: ['~whisper~ The night the sky rang. I was out with my bucket. A light came over the wood, low, singing, like when you run your finger round a wet cup.', '~scared~ Every pool it passed over went out: pop, pop, pop. Three of them. Then it climbed and it was gone.'],
          do: { set: { 'perdide2.rumour.light': true } },
          choices: [{ text: '~solemn~ Something like that hit my ship.', goto: 'ship' }, { text: '~neutral~ I’ll light it again.', end: true }],
        },
        ship: { say: ['~playful~ Did it sing to you too? Hollin says lights don’t sing. I say he doesn’t go out at night.'], choices: [{ text: '~solemn~ It sang.', end: true }] },
        lit: {
          say: ['~surprised~ You lit it! Look at the colours in it. Those aren’t our colours. Those are yours.', '~happy~ I’m going to run ahead and light the rest of the path brighter for you. Watch the pools as you go!'],
          choices: [{ text: '~curious~ What happened the night the sky rang?', goto: 'night', if: { not: { flag: 'perdide2.rumour.light' } } }, { text: '~happy~ Thank you, Wick.', end: true }],
        },
      },
    },
  },
  fen: {
    id: 'fen', name: 'Fen', title: 'who lives in the far dome', color: '#9fe0d0', voice: 0.7, kind: 'm',
    palette: { cloak: '#9fe0d0', lining: '#2b211f', cloth: '#4a4f7a', legs: '#2f3a4f', hat: '#3a8f8a', hair: '#e8e2f2' }, head: 'wizard', cape: 1.25,
    lines: ['~surprised~ Visitors! On the deep water!', '~surprised~ Is that my skiff?', '~neutral~ Mind the moss.'],
    talk: {
      entry: [{ if: { quest: 'perdide2.skiff', done: true }, node: 'after' }, { if: { quest: 'perdide2.skiff', stage: 'home' }, node: 'waiting' }, { node: 'hello' }],
      nodes: {
        hello: {
          say: ['~surprised~ Visitors! Nobody visits. Nobody can, on account of the deep water. How did you…', '~happy~ Is that my skiff? That’s my skiff! Teal, with the white stripe. I’d know it anywhere. I haven’t seen it in forty years.'],
          choices: [
            { text: '~curious~ It’s yours?', goto: 'mine' },
            { text: '~neutral~ It was moored at the root cave.', goto: 'mine' },
          ],
        },
        mine: {
          say: ['~tired~ Mine. I lent it, long ago, to two strangers who came out of the sky-boat in the pool there. Odile and Talo. They were waiting for the light that brought them down to come back, and the waiting took a season.', '~sad~ They used my skiff to fish, and to go and sit in the saucer of an evening, and look up. Then they gave up waiting and took it across the swamp, and it came back without them. Didn’t come and tell me. I don’t blame them. Deep water.'],
          do: [{ set: { 'perdide2.fen.told': true } }, { start: 'perdide2.skiff' }],
          choices: [
            { text: '~curious~ Where did they go?', goto: 'where' },
            { text: '~curious~ Do you want it back?', goto: 'back' },
          ],
        },
        where: {
          say: ['~solemn~ To the singing crystal over the swamp, first. If the light wouldn’t come back to them, they’d go and ask the piece of it that fell there.', '~sad~ And then home, they said. A world that was all garden, with white pyramids. Odile drew it, in the saucer, so they wouldn’t forget the way back.'],
          do: { set: { 'clue.perdide2.edena': true } },
          choices: [{ text: '~curious~ Do you want your skiff back?', goto: 'back' }],
        },
        back: {
          say: ['~playful~ Back? What would I do with it? I’ve got used to the deep water. It keeps the visitors off. Mostly.', '~happy~ No. You keep it, for as long as you’re here. It likes being used. Whistle, and bring it home to me sometimes so I can see it go by.'],
          do: [{ advance: ['perdide2.skiff', 'owner'] }],
          choices: [{ text: '~happy~ Thank you, Fen.', goto: 'berth' }],
        },
        berth: {
          say: ['~solemn~ Do it once now, would you? Its old berth is there, by my landing, between the two posts.', '~sad~ I kept the lamp on the bow post lit for it a year or two. It came back, but only as far as the cave, and waited there for them. So I let the lamp go out.', '~playful~ *Light it* for me. It won’t come in to a dark berth; it never would. And don’t sail it in: *step off on my landing and give it a nudge*. It likes to come the last bit on its own.'],
          choices: [{ text: '~happy~ I’ll bring it home.', end: true }],
        },
        waiting: {
          say: [{ if: { not: { flag: 'perdide2.fen.lamp' } }, text: '~neutral~ The lamp on the bow post, there, by the berth. Hollin’s pools took your water. My lamp might too.' },
            { if: { flag: 'perdide2.fen.lamp' }, text: '~happy~ It’s lit! Look at that. Now bring her in: *step off on my landing and nudge her* into the berth, under the lamp.' }],
          choices: [{ text: '~curious~ Why won’t it just come in?', goto: 'proud' }, { text: '~neutral~ On it.', end: true }],
        },
        proud: { say: ['~playful~ Proud. Always was. It won’t come in to the dark, and it won’t be steered the last bit. A nudge from the landing, and it thinks it was its own idea.'], choices: [{ text: '~neutral~ A nudge, then.', end: true }] },
        after: { say: [{ if: { flag: 'perdide2.skiff.home' }, text: '~happy~ She came home under the lamp. I’m keeping it lit now, in case.' }, '~happy~ There it goes. Look at it skim. Forty years, and it still turns left better than right.'], choices: [{ text: '~happy~ Goodbye, Fen.', end: true }] },
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
          say: ['~neutral~ The saucer sits tilted in the deep pool, water lapping at its rim. Its little light blinks: three short, one long. Three short, one long.', '~solemn~ Across its flank, scorched black into the teal: {glyph} Three dots over an arc. The same mark as the scar on your ship.', '~sad~ Through the canopy: two couches side by side, worn shiny. Two names scratched into the console, ODILE and TALO. And taped above them, a drawing, faded almost white: a garden of umbrella trees and white pyramids under a pale sky, a long green furrow across its meadow.', '~solemn~ It isn’t a ship. It’s the little round boat a bigger ship carries. Whoever flew it here went looking for the singing light, and it found them, and struck them, as it struck you.'],
          do: [{ set: { 'perdide2.saucer.seen': true, 'clue.perdide2.edena': true } }],
          choices: [{ text: '~solemn~ (remember the garden)', end: true }],
        },
        again: { say: ['~sad~ The little light blinks three short, one long, as if it were still expecting an answer. The garden drawing is still there, behind the canopy.'], choices: [{ text: '~solemn~ (look a while)', end: true }] },
      },
    },
  },
  pool: {
    id: 'darkPool', name: 'A dark pool', title: 'gone out', color: '#3a4560', voice: 0.6,
    talk: { nodes: { look: {
      say: ['~sad~ The pool is dark and cold, like an eye shut. The eggs round it are grey. Beside it, painted on a stone, the Welcome: {glyph}', '~neutral~ It wants water that remembers light. (*Shoot* it: aim with the right mouse button or R, then left click or G.)'],
      choices: [{ text: '~neutral~ (step back)', end: true }],
    } } },
  },
};

export const LINES = {
  lit: ['~shout~ The pools! Look!', '~shout~ A traveller, lighting the lamps!', '~happy~ Hollin will cry.', '~shout~ Keep to the lit path!'],
};
