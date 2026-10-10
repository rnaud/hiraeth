// Lorn II's story as data: "The Lamps Are Kept" (docs/story-bible.md).
//
// In the deep wood the people keep the pools lit for travellers who never
// come. Two did, once, forty years ago: Odile and Talo, who had left
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

import { ORDER } from '../levels/names.js';

const Q = 'perdide2.lamps';

// The promise to Hollin is one of the choices the stone remembers (src/story/ending.js choicesMade): it
// costs the coming back. Made (`perdide2.promise` 'yes'), it notes how many worlds were done
// (`perdide2.promise.worlds`); coming back to him after finishing another (or after the first
// homecoming) keeps it (`perdide2.promise.kept`), and if Ilen has told you where Odile and Talo went
// (src/story/lantern-data.js), you can tell him.
const worldsDone = (g) => ORDER.filter((w) => g.flag(`world.${w}.done`)).length;
/** He promised, and has been somewhere else since: Hollin sees him come back. */
export const promiseDue = (ctx) => ctx.game.flag('perdide2.promise') === 'yes' && !ctx.game.flag('perdide2.promise.kept')
  && (worldsDone(ctx.game) > (ctx.game.flag('perdide2.promise.worlds') ?? 99) || !!ctx.game.flag('ending.done'));

export const ITEMS = { latch: 'Pim’s dome latch', lamp: 'a moss lamp' };
/** The keepsake the main quest's end gives (src/story/perdide2.js): its words follow what you told Hollin (flag perdide2.promise). */
export const keepsakeFor = (promise) => ({ id: 'perdide2.person', level: 'perdide2', name: 'Hollin’s lamps', kind: 'person',
  text: promise === 'yes' ? 'A promise to Hollin, keeper of the lamps: you will come back to the deep wood one day, so that once the lamps were lit for someone who came.'
    : 'Hollin, keeper of the lamps, asked you to come back one day. You didn’t promise. The pools will be lit either way.' });

// ------------------------------------------------------------------ quests
export const QUESTS = [
  {
    id: Q, title: 'The Lamps Are Kept', world: 'perdide2', main: true,
    outro: 'Hollin has welcomed a traveller at last. He hopes you will visit again; the pools will stay lit either way.',
    stages: [
      { id: 'hollin', text: 'Someone is waiting on the island. Talk to the old lamp-keeper', label: 'Hollin, the lamp-keeper', flag: 'perdide2.hollin.met', at: 'hollin' },
      // (for the level design audit: the pools are done at the last one, `ends`; Hollin is met at the root cave, where he has
      //  walked down to, `stands`; and he sends you home by the water-way, `home`)
      { id: 'pools', text: 'Relight the three dark pools along the path: shoot them with your fluid', label: 'A dark pool', when: (q) => (q.game.flag('perdide2.pools.lit') ?? 0) >= 3, at: 'darkPool', ends: 'lastPool' },
      { id: 'answer', text: 'Something answered from across the water. Whistle for the skiff and go and see', label: 'The light across the water', flag: 'perdide2.saucer.seen', at: 'saucer' },
      { id: 'tell', text: 'Tell Hollin what you found. He has walked down to the root cave to see the lights', label: 'Hollin, at the root cave', flag: 'perdide2.hollin.told', at: 'hollin', stands: 'hollinEnd', home: 'the water-way' },
    ],
  },
  {
    id: 'perdide2.latch', title: 'The Moss-Dome Latch', world: 'perdide2',
    outro: 'Pim’s door shuts, and opens, and shuts again. She is delighted.',
    stages: [
      { id: 'find', text: 'Find Pim’s latch: “on the big roof”, the glass dome further down the path', label: 'Pim’s latch', bring: 'latch', at: 'latch', to: 'pim' },
      { id: 'return', text: 'Bring the latch back to Pim by the moss domes', label: 'Pim, by the moss domes', bring: 'latch', to: 'pim' },
      { id: 'shut', text: 'Shoot the lamp above Pim’s door to shrink the moss, then push the door shut (switch the gun to push with {key:mode}, then aim and shoot)', label: 'Pim’s door', flag: 'perdide2.pim.door', at: 'pimDoor' },
    ],
  },
  {
    id: 'perdide2.skiff', title: 'Whose Skiff?', world: 'perdide2',
    outro: 'The skiff is Fen’s, and Fen says it is yours now, for as long as you need it.',
    stages: [
      { id: 'owner', text: 'Find the skiff’s owner: Bram thinks it’s the hermit in the far dome, out on the deep water', label: 'The far dome', talk: 'fen', at: 'fen' },
      { id: 'home', text: 'Light Fen’s bow-post lamp. Step off the skiff onto his landing, then push it into the berth (switch the gun to push with {key:mode}, then aim and shoot)', label: 'Fen’s berth', flag: 'perdide2.skiff.home', at: 'fenBerth' },
    ],
  },
];

const P = (cloak, cloth, extra = {}) => ({ cloak, lining: '#2b211f', cloth, legs: '#2f3a4f', ...extra });

// ------------------------------------------------------------------ the level's own people
// CONTENT.perdide2.npcs (src/levels/perdide2.js): kind by index (spawnNPCs: even m, odd f).
export const KEEPERS = [
  {
    at: [-8, 10], radius: 2, palette: P('#f2a07a', '#3e5a6a'), look: { prop: 'lamppole' },
    lines: ["~neutral~ Follow the lit pools to the root cave, especially after dark.", '~surprised~ A traveller. A traveller!', '~playful~ The eggs are warm. Don’t ask what’s inside.'],
    id: 'hollin.perdide2', name: 'Hollin', title: 'keeper of the lamps', color: '#f2a07a', voice: 0.8,
    talk: {
      entry: [
        { if: [{ quest: Q, done: true }, promiseDue], node: 'came' },
        { if: { quest: Q, done: true }, node: 'after' },
        { if: { quest: Q, stage: 'tell' }, node: 'tell' },
        { if: { quest: Q, stage: 'answer' }, node: 'answer' },
        { if: { quest: Q, stage: 'pools' }, node: 'again' },
        { node: 'hello' },
      ],
      nodes: {
        hello: {
          say: ["~surprised~ A traveller? An actual traveller? Stay there a moment. I’ve imagined this quite differently.", "~happy~ Hollin. Forty years keeping these pools lit, and you’re my first visitor. I should have prepared a greeting. That was plenty of time."],
          choices: [
            { text: '~curious~ Why light pools for nobody?', goto: 'why' },
            { text: '~neutral~ I’m just passing through.', goto: 'passing' },
          ],
        },
        passing: { say: ["~happy~ Passing through! Of course. That’s what the path is for. Lovely to have it confirmed."], choices: [{ text: '~curious~ Why do you light the pools?', goto: 'why' }] },
        why: {
          say: ["~solemn~ Two travellers survived a sky-boat crash here long ago. Stayed a season. When they left, they asked us to keep a light for them.", "~solemn~ We lit a whole path, in case they forgot the way. We call it *keeping the Welcome*."],
          choices: [{ text: '~curious~ The Welcome?', goto: 'glyph' }, { text: '~sad~ And they never came back.', goto: 'dark' }],
        },
        glyph: {
          say: ["~neutral~ {glyph} *The Welcome.* Three lamps above a hull. We paint it beside the pools: someone here expects you.", "~solemn~ It’s on *the blue star-chest on the root arch* too. We dust that one. Opening it is apparently somebody else’s privilege."],
          do: { set: { 'perdide2.glyph.heard': true } },
          choices: [{ text: '~solemn~ I’ve seen that mark. It’s burned into my ship.', goto: 'mark' }, { text: '~sad~ And the travellers never came back.', goto: 'dark' }],
        },
        mark: { say: ["~curious~ The mark’s on your ship? Perhaps someone expected you long before we did."], choices: [{ text: '~curious~ And the two travellers?', goto: 'dark' }] },
        dark: {
          say: ["~sad~ They haven’t returned. And the night the light passed, *three pools went dark*. Ordinary water won’t wake them.",
            { if: { not: { flag: 'perdide2.pools.lit' } }, text: "~curious~ Your tank glows. Our lamps need water that carries light. Could we try yours?" },
            { if: { not: { flag: 'perdide2.pools.lit' } }, text: "~happy~ Shoot fluid into the three dark pools between here and the root cave. That may relight them." },
            { if: { flag: 'perdide2.pools.lit' }, text: "~surprised~ You’ve already started! I saw new colours and blamed my eyes. *Light whichever pools are still dark.*" }],
          do: { set: { 'perdide2.hollin.met': true } },
          choices: [{ text: '~neutral~ I’ll light them.', end: true }, { text: '~curious~ What happened the night the sky rang?', goto: 'rang' }],
        },
        rang: { say: ["~playful~ Ask Robin beside the second dark pool, past the glass dome. She saw it happen. I was asleep. At my age, one defends a successful night’s sleep."], choices: [{ text: '~neutral~ I’ll light your pools.', end: true }] },
        again: {
          say: [{ if: { flag: 'perdide2.pools.lit', is: 1 }, text: "~surprised~ One pool lit! Two still need your fluid." },
            { if: { flag: 'perdide2.pools.lit', is: 2 }, text: "~happy~ Two burning! The last is *beside the root cave at the path’s end*." },
            { if: { not: { flag: 'perdide2.pools.lit' } }, text: "~sad~ Find the three unlit pools on the way to the root cave. Shoot each with your fluid." }],
          choices: [{ text: '~curious~ What happened the night the sky rang?', goto: 'rang' }, { text: '~neutral~ On my way.', end: true }],
        },
        answer: { say: ["~surprised~ The deep pool answered? By the sky-boat? *Whistle for the skiff and investigate.* I’ll meet you at *the root cave*."], choices: [{ text: '~neutral~ Meet you there.', end: true }] },
        tell: {
          say: ["~happy~ Every pool is burning again. Those three have colours we’ve never seen. The path will remember your visit.", '~curious~ Tell me. What’s in the boat?'],
          choices: [
            { text: "~solemn~ Two worn seats. Odile and Talo’s names. And a drawing of their garden, with white pyramids.", goto: 'names', if: { flag: 'perdide2.saucer.seen' } },
            { text: '~neutral~ I haven’t been out to it yet.', end: true, if: { not: { flag: 'perdide2.saucer.seen' } } },
          ],
        },
        names: {
          say: ["~sad~ Odile and Talo. Yes. Those were their names.", "~tired~ So that was the garden they drew. Forty years I’ve kept their light, and I never knew what they were trying to get back to.", "~happy~ Perhaps they reached it. I can hope that, even if they never come here again."],
          next: 'promise',
        },
        promise: {
          say: ["~solemn~ Would you visit again someday? You wouldn’t need an errand.", "~sad~ I’d like to see someone arrive by a path they already know. Just once. Think before you say it. I’ll watch the path if you do."],
          choices: [
            { text: '~solemn~ I’ll come back. I promise.', do: [{ set: { 'perdide2.promise': 'yes', 'perdide2.hollin.told': true } }, (ctx) => ctx.game.set('perdide2.promise.worlds', worldsDone(ctx.game))], goto: 'thanks' },
            { text: '~sad~ I can’t promise that.', do: [{ set: { 'perdide2.promise': 'maybe', 'perdide2.hollin.told': true } }], goto: 'maybe' },
          ],
        },
        thanks: { say: ["~happy~ Then I’ll watch for you. No deadline. The pools will be ready.", "~solemn~ I’ll keep the pool by the landing for you, then. Promises keep a long time out here, if someone trims the wick.", "~happy~ Go home by water tonight. I’ve lit *the water-way*, the old lamps for boats: out through the gate by the lagoon, round the deep water. Your skiff knows it."], choices: [{ text: '~neutral~ Goodbye, Hollin.', end: true }] },
        came: {
          say: ["~surprised~ You came back. By a path you already knew. (He has to sit down on a root to look at you properly.)", "~happy~ Forty years I lit these for somebody to come back. It turns out it only takes the once."],
          do: { set: { 'perdide2.promise.kept': true } },
          choices: [
            { text: '~solemn~ I found where Odile and Talo went.', goto: 'found', if: { any: [{ flag: 'finale.hollin' }, { flag: 'finale.met' }] } },
            { text: '~happy~ I said I would.', end: true },
          ],
        },
        found: {
          do: { set: { 'perdide2.hollin.found': true } },
          say: ["~solemn~ (You tell him: the lantern on its island, the woman who kept it with them, the two stones on the point.)", "~sad~ They got there. And kept a light at the end of it. Of course they did.", "~happy~ Then my lamps were lit for travellers who arrived somewhere. That’s all I ever wanted for them."],
          choices: [{ text: '~neutral~ Goodbye, Hollin.', end: true }],
        },
        maybe: { say: ["~solemn~ You don’t have to promise. Come if you can. A welcome isn’t a debt.", "~neutral~ Go home by water, at least. I’ve lit *the water-way*, the old lamps for boats, out through the gate by the lagoon."], choices: [{ text: '~neutral~ Goodbye, Hollin.', end: true }] },
        after: {
          say: ["~happy~ The lights are on. Whenever you come, they’ll be on."],
          choices: [
            // Ilen's news, if he didn't hear it when the promise was kept (or no promise was made): Odile and Talo
            { text: '~solemn~ I found where Odile and Talo went.', if: { all: [{ any: [{ flag: 'finale.hollin' }, { flag: 'finale.met' }] }, { not: { flag: 'perdide2.hollin.found' } }] }, goto: 'found' },
            // he knows who Ilen was (the mother's recording) and hasn't found her yet
            { text: '~sad~ I had a sister. She went out like Odile and Talo, before I was born, and never came home.', if: { all: [{ flag: 'calls.ilen.told' }, { not: { flag: 'finale.met' } }, { not: { flag: 'perdide2.hollin.ilen' } }] }, goto: 'sister' },
            { text: '~neutral~ I will.', end: true },
          ],
        },
        sister: {
          say: ["~solemn~ Then someone at home kept a light for her, I expect. People do, long after they say they’ve stopped.",
            "~happy~ And a light kept for somebody is never quite wasted. I’ve had forty years to check."],
          do: { set: { 'perdide2.hollin.ilen': true } },
          choices: [{ text: '~neutral~ Goodbye, Hollin.', end: true }],
        },
      },
    },
  },
  {
    at: [-24, -126], radius: 2, palette: P('#3f6a6a', '#a49cc8'), shy: true,
    lines: ['~neutral~ We live in the domes. The moss keeps them cool.', "~playful~ The latch is on the roof. I put it somewhere safe again.", "~scared~ Don’t look at the door. It can tell."],
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
          say: ["~scared~ A stranger! Don’t tell Hollin yet. He’ll start polishing lamps that are already clean.", "~playful~ I’m Pim. That mossy dome is mine. The door closes very nicely, then immediately reconsiders."],
          choices: [
            { text: '~curious~ Reconsiders?', goto: 'latch' },
            { text: '~curious~ What are the domes?', goto: 'domes' },
          ],
        },
        domes: { say: ["~neutral~ We found these domes and moved in. Moss keeps them cool. Nobody lives in the glass one down the path. Lovely view, terrible privacy."], choices: [{ text: '~curious~ And your door?', goto: 'latch' }, { text: '~curious~ Have you seen anything strange?', goto: 'strange' }] },
        latch: {
          say: ["~sad~ I left my latch on top of the glass dome farther down the path. Needed both hands to hold on. Came down with both hands and no latch.", "~scared~ I won’t climb it again. Being round is an unreasonable quality in a roof."],
          choices: [{ text: '~neutral~ I’ll fetch it.', do: { start: 'perdide2.latch' }, goto: 'thanks' }, { text: '~sad~ That’s a shame.', end: true }],
        },
        thanks: { say: ["~playful~ It’s *a shell ring with a hook*, right at the top. Bring it down more gracefully than I came down, please."], choices: [{ text: '~neutral~ I’ll be careful.', end: true }] },
        waiting: { say: ["~neutral~ The glass dome down the path. On its roof. Careful: the ribs are slippery."], choices: [{ text: '~neutral~ Going.', end: true }] },
        strange: { say: ["~playful~ You’re the strangest thing lately. Before you, the pools went dark when the sky sang. Robin saw it. She has an exhausting commitment to being awake."], choices: [{ text: '~curious~ And your door?', goto: 'latch', if: { quest: 'perdide2.latch', started: false } }, { text: '~neutral~ Bye, Pim.', end: true }] },
        back: {
          say: ['~surprised~ My latch! You went all the way up?', '~happy~ There, on it goes. Now: shut. Shut… Oh, come on.', "~sad~ The latch fits, but moss has grown into the frame. The door still won’t move."],
          do: [{ take: 'latch' }, { advance: 'perdide2.latch' }],
          choices: [{ text: '~curious~ Can’t we pull the moss out?', goto: 'moss' }, { text: '~neutral~ Let me try the door.', end: true }],
        },
        moss: {
          say: ["~neutral~ Pulling it out won’t last. Moss grows toward darkness and shrinks from light.", "~sad~ *The moss lamp above my door* kept it clear. That went out with the pools.", "~playful~ Try *shooting the lamp with your fluid*. Once the moss shrinks, *push the door shut*."],
          choices: [{ text: '~neutral~ I’ll wake it.', end: true }],
        },
        stuck: {
          say: [{ if: { not: { flag: 'perdide2.pim.lamp' } }, text: "~sad~ *Relight the lamp above the door first.* The moss won’t release the frame in the dark." },
            { if: { flag: 'perdide2.pim.lamp' }, text: "~happy~ The moss is shrinking! Now *push the door shut*." }],
          choices: [{ text: '~curious~ Why won’t it shut?', goto: 'moss', if: { not: { flag: 'perdide2.pim.lamp' } } }, { text: '~neutral~ On it.', end: true }],
        },
        after: { say: ['~playful~ Shut. Open. Shut. I’ve been doing it all evening.', '~happy~ Keep the moss lamp somewhere dark. It likes that.'], choices: [{ text: '~happy~ (smile)', end: true }] },
      },
    },
  },
  {
    at: [-22, -406], radius: 2, palette: P('#f6b08a', '#3a4560'),
    lines: ['~neutral~ The skiff is moored in the shallows by the cave.', '~neutral~ Whistle and it will come. It knows the deep water.', '~playful~ Sitting is a skill. I’ve trained for years.', '~tired~ Root cave. Still here.'],
    id: 'bram', name: 'Bram', title: 'who minds the cave mouth', color: '#f6b08a', voice: 0.95,
    talk: {
      entry: [{ if: { flag: 'met.bram' }, node: 'again' }, { node: 'hello' }],
      nodes: {
        hello: {
          say: ["~tired~ Root cave. End of the path. Beyond it, mostly more root than path.", "~playful~ Bram. I watch the entrance. Sitting is an important part of my method."],
          choices: [
            { text: '~curious~ Whose skiff is that?', goto: 'skiff' },
            { text: '~curious~ What’s in the cave?', goto: 'cave' },
          ],
        },
        again: {
          say: ["~tired~ Still here. Cave too. A stable working relationship."],
          choices: [
            { text: '~curious~ Where did the two travellers go?', goto: 'two' },
            { text: '~curious~ Whose skiff is that?', goto: 'skiff', if: { quest: 'perdide2.skiff', started: false } },
            { text: '~neutral~ Bye, Bram.', end: true },
          ],
        },
        skiff: {
          say: ["~neutral~ The skiff comes when you whistle and returns when you’re done. It’s been moored here longer than I’ve kept watch.", "~neutral~ Ask *Fen in the far dome*, on the deep water *between here and the saucer’s pool*. Take the skiff; visiting him requires a boat."],
          do: { start: 'perdide2.skiff' },
          choices: [{ text: '~neutral~ I’ll ask him.', end: true }],
        },
        cave: { say: ["~playful~ The cave glows all the way back. The two travellers slept there before leaving. Dry, warm, good roof. I see their reasoning."], choices: [{ text: '~curious~ Whose skiff is that?', goto: 'skiff' }, { text: '~curious~ Where did the two travellers go?', goto: 'two' }] },
        two: { say: ["~neutral~ They borrowed Fen’s skiff and crossed the swamp toward the Great Crystal. Days later the boat came back alone. Nobody here knows where they went next."], choices: [{ text: '~curious~ Whose skiff is that?', goto: 'skiff' }, { text: '~neutral~ Bye, Bram.', end: true }] },
      },
    },
  },
];

// ------------------------------------------------------------------ the story's own people
export const PEOPLE = {
  wick: {
    id: 'wick', name: 'Robin', title: 'a young lamp-keeper', color: '#ffd6a0', voice: 1.35, kind: 'f', age: 'teen', years: 15,
    palette: { cloak: '#ffd6a0', lining: '#2b211f', cloth: '#3a6a58', legs: '#2f3a4f', hat: '#f2a07a', hair: '#2b211f' }, head: 'hair', cape: 0.55, look: { prop: 'lantern' },
    lines: ['~angry~ It won’t take my light.', '~shout~ Splash it! Go on!', '~neutral~ Mind the eggs.'],
    talk: {
      entry: [
        { if: { quest: 'perdide2.lamps', done: true }, node: 'after' },
        { if: { flag: 'perdide2.pool.1' }, node: 'lit' },
        { if: { flag: 'met.wick' }, node: 'again' },
        { node: 'hello' },
      ],
      nodes: {
        hello: {
          say: ["~angry~ I’ve poured buckets into this pool. Nothing! Hollin says it needs water that remembers light. I’d settle for water that remembers to work."],
          choices: [
            { text: '~curious~ What happened to it?', goto: 'night' },
            { text: '~neutral~ Let me try.', end: true },
          ],
        },
        again: { say: ['~tired~ Still dark. Go on, *try yours*.'], choices: [{ text: '~curious~ What happened to it?', goto: 'night' }, { text: '~neutral~ (aim at the pool)', end: true }] },
        night: {
          say: ["~whisper~ I was filling my bucket when the singing light came over the wood. Low enough to light the leaves from underneath.", "~scared~ Three pools went out as it passed. One, two, three. Then the light climbed away."],
          do: { set: { 'perdide2.rumour.light': true } },
          choices: [{ text: '~solemn~ Something like that passed my ship.', goto: 'ship' }, { text: '~neutral~ I’ll light it again.', end: true }],
        },
        ship: { say: ["~playful~ You heard it sing too? Good. Tell Hollin. He’s very certain about things he slept through."], choices: [{ text: '~solemn~ It sang.', end: true }] },
        after: { say: ["~happy~ Every pool lit. Hollin walked down to the root cave faster than I’ve ever seen him walk.", "~playful~ He says he wasn’t hurrying. He was."], choices: [{ text: '~happy~ Goodbye, Robin.', end: true }] },
        lit: {
          say: ["~surprised~ You lit it! And look at those colours. The pool’s borrowed your whole journey.", "~happy~ I’ll brighten the lamps ahead. Follow the pools; I’ll make sure you can see them!"],
          choices: [{ text: '~curious~ What happened the night the sky rang?', goto: 'night', if: { not: { flag: 'perdide2.rumour.light' } } }, { text: '~happy~ Thank you, Robin.', end: true }],
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
          say: ["~surprised~ A visitor? Over all that deep water? What brought you—", "~happy~ My skiff! Teal, white stripe. I’d recognise her anywhere. Forty years since I last saw her here."],
          choices: [
            { text: '~curious~ It’s yours?', goto: 'mine' },
            { text: '~neutral~ It was moored at the root cave.', goto: 'mine' },
          ],
        },
        mine: {
          say: ["~tired~ I lent her to Odile and Talo after their saucer crashed. They stayed a season, waiting for the singing light to return.", "~sad~ They fished, watched from the saucer, then gave up waiting and crossed the swamp. The skiff came back to the cave without them. I heard. Never went to fetch her."],
          do: [{ set: { 'perdide2.fen.told': true } }, { start: 'perdide2.skiff' }],
          choices: [
            { text: '~curious~ Where did they go?', goto: 'where' },
            { text: '~curious~ Do you want it back?', goto: 'back' },
          ],
        },
        where: {
          say: ["~solemn~ They wanted to ask the Great Crystal about the light. If the Singer wouldn’t return, they’d visit its fallen piece.", "~sad~ Afterwards? Odile drew a garden with white pyramids inside the saucer. Didn’t want to forget it. Where they went from here, nobody told me."],
          do: { set: { 'clue.perdide2.edena': true } },
          choices: [{ text: '~curious~ Do you want your skiff back?', goto: 'back' }],
        },
        back: {
          say: ["~playful~ Want her back? What would I do, start visiting people? I’ve spent years cultivating a difficult address.", "~happy~ Use her while you’re here. But bring her past now and then. I’d like to watch her sail."],
          do: [{ advance: ['perdide2.skiff', 'owner'] }],
          choices: [{ text: '~happy~ Thank you, Fen.', goto: 'berth' }],
        },
        berth: {
          say: ["~solemn~ Could you bring her into *the berth between those two posts*? Just once. For an old man.", "~sad~ I kept the bow-post lamp lit until I heard she’d settled at the cave. Then I stopped. Perhaps I shouldn’t have.", "~playful~ First *shoot the bow-post lamp to light it*. Then step onto my landing and push the skiff into the berth. She won’t dock in darkness, or while you’re steering."],
          choices: [{ text: '~happy~ I’ll bring it home.', end: true }],
        },
        waiting: {
          say: [{ if: { not: { flag: 'perdide2.fen.lamp' } }, text: "~neutral~ *Shoot the lamp on the bow post.* Your fluid woke the pools; it should wake this too." },
            { if: { flag: 'perdide2.fen.lamp' }, text: "~happy~ Lamp’s burning! Now step onto the landing and push the skiff between the posts." }],
          choices: [{ text: '~curious~ Why won’t it just come in?', goto: 'proud' }, { text: '~neutral~ On it.', end: true }],
        },
        proud: { say: ["~playful~ Light the berth, get off, give her a nudge. She likes the last bit to appear voluntary."], choices: [{ text: '~neutral~ A nudge, then.', end: true }] },
        after: { say: [{ if: { flag: 'perdide2.skiff.home' }, text: "~happy~ Home under her old lamp. I’ll keep it lit this time." }, "~happy~ Still quick. Still better at turning left. Some things are reassuringly themselves."], choices: [{ text: '~happy~ Goodbye, Fen.', end: true }] },
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
          say: ["~neutral~ The saucer sits half submerged. Its little lamp repeats three short flashes and one long.", "~solemn~ Burned across its side is the same mark as your ship’s scar: {glyph}", "~sad~ Two worn seats. ODILE and TALO scratched into the console. A faded drawing shows umbrella trees, white pyramids, and a green crash furrow: Viridel.", "~solemn~ Their escape saucer. They left the garden to follow the Singer, and it struck them again here."],
          do: [{ set: { 'perdide2.saucer.seen': true, 'clue.perdide2.edena': true } }],
          choices: [{ text: '~solemn~ (remember the garden)', end: true }],
        },
        again: { say: ["~sad~ The lamp repeats its signal. Behind the canopy, their drawing of home is fading."], choices: [{ text: '~solemn~ (look a while)', end: true }] },
      },
    },
  },
  pool: {
    id: 'darkPool', name: 'A dark pool', title: 'gone out', color: '#3a4560', voice: 0.6,
    talk: { nodes: { look: {
      say: ["~sad~ Cold water, grey eggs. A Welcome mark is painted beside the unlit pool: {glyph}", "~neutral~ *Shoot the pool with glowing fluid* to relight it: aim with {key:aim}, fire with {key:fire}."],
      choices: [{ text: '~neutral~ (step back)', end: true }],
    } } },
  },
};

export const LINES = {
  lit: ['~shout~ The pools! Look!', '~shout~ A traveller, lighting the lamps!', '~happy~ Hollin will cry.', '~shout~ Keep to the lit path!'],
};
