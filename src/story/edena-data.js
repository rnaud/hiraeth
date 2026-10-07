// Viridel's story as data: "The Garden Grows Over" (docs/story-bible.md).
//
// Long ago Odile and Talo's ship fell in the south meadow. The gardeners took
// them in, gave them tea and a great deal of advice about not digging, and
// let the garden take the ship: they believe nothing that falls should be dug
// up again. Odile and Talo left one spring in their little saucer, "toward the
// deep wood on the far side of the swamp of lights", the way the light went
// (Lorn II, where the saucer lies: it struck them again there).
//
// The reveal, kept quiet and in the traveller's own hands: the ship's last
// log (a singing light paced them, turned, and struck), Talo's request ("look
// under the flowers on the starboard side; look, and then let it be"), and
// the veil of vines over the hull that parts when you water it rather than
// cut it. Under it is the scorch: three dots over an arc, exactly the mark
// on the traveller's own hull. Their ship was not the first. Nobody explains
// the light; Mira only says what the gardeners do with things that fall.
//
// The terraces (src/story/terraces.js): the quest you try, and fail. Esk keeps
// the tea terraces on the white builders' old steps above the dry hollow; the
// spring has sulked since the light passed. You clear her runnels, and then, at
// her asking ("a little; one turn"), open the builders' gate on the cistern
// above. It has been shut a thousand years; it gives way all at once, and the
// water takes the middle of the terraces down into the hollow. She is angry,
// you are sorry, and she says what the gardeners say about everything that
// falls. The quest ends failed (quests.fail) and the hill stays as it fell.
//
// Flags (game-state.js): edena.* below; clue.edena.struck (the same light
// struck them), clue.edena.pod (they left in the saucer for the deep wood);
// the terraces: edena.esk.asked, edena.runnel.<0-2>, edena.runnels (how many),
// edena.esk.gate, edena.gate.roots, edena.gate.turned, edena.terraces.flooded,
// and edena.<who>.flood (each gardener's word about it, once).

const Q = 'edena.garden';

export const ITEMS = { seed: 'a pyramid seed' };
// (calls home quote a word's `text` as said: src/story/calls.js)
export const KEEPSAKE = { id: 'edena.word', level: 'edena', name: 'Mira’s words', kind: 'word', text: 'We tend the garden. The garden tends us.', note: 'What Mira said when you told her about the mark under the flowers. The gardeners say it about everything, and mean it about everything.' };

// ------------------------------------------------------------------ quests
export const QUESTS = [
  {
    id: Q, title: 'The Garden Grows Over', world: 'edena', main: true,
    outro: 'You looked, and let it be. You were not the first.',
    stages: [
      { id: 'mira', text: 'Talk to Mira, who keeps the gardeners’ water clock near where you landed', label: 'Mira, the gardener', flag: 'edena.mira.heard', at: 'mira' },
      { id: 'ship', text: 'Find Odile and Talo’s ship, fallen in the south meadow', label: 'The fallen ship', goto: 'ship', radius: 45, at: 'ship' },
      { id: 'vey', text: 'Vey tends the vines over the ship. Ask before you touch anything', label: 'Vey, by the ship', flag: 'edena.vey.asked', at: 'vey' },
      { id: 'inside', text: 'Go in through the hatch on the ship’s flank', label: 'The overgrown hatch', flag: 'edena.cabin.seen', at: 'hatch' },
      { id: 'log', text: 'Play the ship’s last log at the cockpit panel', label: 'The cockpit panel', flag: 'edena.log.read', at: 'panel' },
      { id: 'veil', text: 'Look under the flowers on the ship’s flank, as Talo asked. Don’t cut them: water them (shoot)', label: 'The flowers on the flank', flag: 'edena.veil.open', at: 'veil' },
      { id: 'scar', text: 'Look at what the garden uncovered', label: 'Under the flowers', flag: 'edena.scar.seen', at: 'veilLook' },
      { id: 'tell', text: 'Tell Mira what you saw', label: 'Mira, the gardener', talk: 'mira', at: 'mira' },
    ],
  },
  {
    id: 'edena.seed', title: 'The Pyramid Seed', world: 'edena',
    outro: 'A small white pyramid stands where the seed was planted. It will take a thousand years to be big.',
    stages: [
      { id: 'find', text: 'Oro’s pyramid seed rolled away downhill, toward water: look along the pond’s far shore', label: 'The pyramid seed', bring: 'seed', at: 'seed', to: 'oro' },
      { id: 'return', text: 'Bring the seed back to Oro by the white ruins', label: 'Oro, by the ruins', bring: 'seed', to: 'oro' },
      { id: 'water', text: 'Water the planted seed (shoot)', label: 'The planted seed', flag: 'edena.seed.watered', at: 'sprout' },
    ],
  },
  {
    // the quest that fails (src/story/terraces.js): it can't be won, and it doesn't block anything
    id: 'edena.terraces', title: 'Water for the Tea Terraces', world: 'edena', major: true,
    failOutro: 'You turned the builders’ gate once, as Esk asked. It had been shut a thousand years, and it gave way; the middle of her hill went down into the hollow with the water. She asked you to leave her with it.',
    stages: [
      { id: 'esk', text: 'Esk keeps the tea terraces south-east of the landing, above the dry hollow. Go and see her', label: 'Esk, on the tea terraces', talk: 'esk', at: 'esk' },
      { id: 'runnels', text: 'Clear the three choked runnels, top terrace first: shove each clod of silt out (push: C, middle click, or RB / R1)', label: 'A choked runnel', when: (q) => (q.game.flag('edena.runnels') ?? 0) >= 3, at: 'clod' },
      { id: 'ask', text: 'Water runs, but only a trickle. Tell Esk', label: 'Esk, on the tea terraces', talk: 'esk', at: 'esk' },
      { id: 'roots', text: 'Roots have grown through the wheel of the builders’ gate, on the cistern above the terraces. Water them so they let go (shoot)', label: 'The builders’ gate', flag: 'edena.gate.roots', at: 'gate' },
      { id: 'gate', text: 'Esk asked for one turn of the gate’s wheel. Nobody has opened it in living memory. One shove (push: RB / R1)', label: 'The builders’ gate', flag: 'edena.gate.turned', at: 'gate' },
      { id: 'flood', text: 'The gate is giving way', label: 'The terraces', flag: 'edena.terraces.flooded', at: 'esk' },
      { id: 'sorry', text: 'Go down to Esk', label: 'Esk', talk: 'esk', at: 'esk' },
    ],
  },
  {
    // coming back after the terraces went (src/story/terraces.js): Esk decides there is a small job
    id: 'edena.cutting', title: 'A Cutting for the Mud', world: 'edena',
    outro: 'One tea cutting from the rows that held, pressed into the new mud where the stream runs slow. It might take.',
    stages: [
      { id: 'plant', text: 'Esk gave you a tea cutting from the rows that held. Press it into the mud below the terraces, where the stream runs slow (E, or B / ○)', label: 'The mud by the stream', flag: 'edena.cutting.planted', at: 'cutting' },
      { id: 'tell', text: 'Tell Esk the cutting is in', label: 'Esk, on the tea terraces', talk: 'esk', at: 'esk' },
    ],
  },
  {
    // Lorn II's errand ends here: the brass gear, fitted (src/story/water-clock.js)
    id: 'edena.clock', title: 'Mira’s Water Clock', world: 'edena',
    outro: 'The bowl fills, tips, and the bell rings: time to water. It always is.',
    stages: [
      { id: 'fit', text: 'Fit the brass gear into Mira’s water clock, beside her (E, or B / ○)', label: 'The water clock', flag: 'edena.clock.fitted', at: 'clock' },
      { id: 'fill', text: 'The bowl leaks: fill it with three quick splashes, so it tips and rings the bell (shoot)', label: 'The water clock’s bowl', flag: 'edena.clock.rung', at: 'clock' },
    ],
  },
  {
    id: 'edena.tree', title: 'The Tallest Tree', world: 'edena',
    outro: 'From the crown you can see the whole garden, and the long green scar the ship ploughed across it.',
    stages: [
      { id: 'climb', text: 'Climb the tallest tree, north-west of the meadow. The crown floats above the upper canopy: boost up to it from the rim', label: 'The tallest tree’s crown', flag: 'edena.lookout.read', at: 'lookout' },
      { id: 'tell', text: 'Tell Lio what is on the crown', label: 'Lio, under the trees', talk: 'lio', at: 'lio' },
    ],
  },
];

// ------------------------------------------------------------------ the people
export const PEOPLE = {
  mira: {
    id: 'mira', name: 'Mira', title: 'who keeps the water clock', color: '#62c3c9', voice: 1.05, kind: 'f',
    palette: { cloak: '#f7f4ec', lining: '#2b211f', cloth: '#62c3c9', legs: '#7f9a90', hat: '#9fd6c9', hair: '#3d2a22', face: '#dfe8ec' }, head: 'wrap', cape: 1.1, look: { body: 'garland' },
    lines: ['~solemn~ We tend the garden. The garden tends us.', "~playful~ Tea time. The clock is occasionally right by accident.", '~playful~ Mind the flowers. They mind you.'],
    talk: {
      entry: [
        { if: { all: [{ quest: 'edena.terraces', failed: true }, { not: { flag: 'edena.mira.flood' } }, { not: { quest: Q, stage: 'tell' } }] }, node: 'flood' },
        { if: { all: [{ quest: 'edena.clock', active: true }, { flag: 'edena.mira.heard' }, { not: { quest: Q, stage: 'tell' } }] }, node: 'clockNow' },
        { if: { all: [{ quest: 'edena.clock', done: true }, { not: { flag: 'edena.mira.clock' } }, { not: { quest: Q, stage: 'tell' } }] }, node: 'clockDone' },
        { if: { quest: Q, done: true }, node: 'after' },
        { if: { quest: Q, stage: 'tell' }, node: 'tell' },
        { if: { flag: 'edena.mira.heard' }, node: 'again' },
        { node: 'hello' },
      ],
      nodes: {
        // after the terraces (src/story/terraces.js): once
        flood: {
          say: ["~solemn~ Esk came by. She was too tired to be angry. That worried me more.", "~solemn~ The terraces are gone. We’ll still tend what’s left. This morning I went to water, and for a moment I forgot where the water used to go."],
          do: { set: { 'edena.mira.flood': true } },
          choices: [{ text: '~sad~ I’m sorry, Mira.', goto: 'floodSorry' }],
        },
        // Lorn II's gear (src/story/water-clock.js)
        clockNow: {
          say: [
            { if: { quest: 'edena.clock', stage: 'fit' }, text: "~happy~ A gear from Lorn’s domes! Someone remembered our clock. *Fit it to the axle*, please. My fingers are having an unhelpful day." },
            { if: { quest: 'edena.clock', stage: 'fill' }, text: "~playful~ Now *shoot three quick splashes into the bowl*. It leaks, so keep them close together. When it fills, it tips." },
          ],
          choices: [{ text: '~neutral~ (to the clock)', end: true }],
        },
        floodSorry: { say: ["~neutral~ Esk knows you meant to help. Knowing that doesn’t make the loss smaller. Give her time."], choices: [{ text: '~sad~ (nod)', end: true }] },
        hello: {
          say: ["~surprised~ A person arriving in a round ship. That’s twice now. I’m Mira. I tend the water clock. Mostly, we grow old together.", "~happy~ Welcome to the garden. We keep it alive; it feeds us. Sounds simple until you meet the weeds."],
          choices: [
            { text: '~surprised~ Twice? Something else fell here?', goto: 'twice' },
            { text: '~neutral~ I’m looking for something of value.', goto: 'value' },
          ],
        },
        who: { say: ["~playful~ We’re the gardeners. Before us came the white builders, androids who left those ruins. They liked straight lines. The roots have filed objections."], choices: [{ text: '~curious~ Something else fell here, you said?', goto: 'twice' }] },
        value: { say: ["~solemn~ Something to take home? Everything here changes. You may have to be happy with what it becomes."], choices: [{ text: '~curious~ You said something else fell here?', goto: 'twice' }, { text: '~curious~ Who tends it?', goto: 'who' }] },
        twice: {
          say: ["~neutral~ Odile and Talo’s ship crashed here when I was young. *The south meadow.* The trees still overlook the furrow it cut.", "~solemn~ They survived. We gave them tea, and they stayed a spring. After they left, we let plants cover the wreck. Here, what falls belongs to the ground."],
          do: { set: { 'edena.mira.heard': true } },
          choices: [
            { text: '~curious~ Can I see it?', goto: 'see' },
            { text: '~curious~ Where did they go?', goto: 'went' },
          ],
        },
        went: { say: ["~playful~ They left in the small saucer carried inside their ship. Sol is still expecting them back. He keeps quite a lot of tea."], choices: [{ text: '~curious~ Can I see their ship?', goto: 'see' }] },
        see: { say: ["~neutral~ Go south past the pond to the dip in the meadow. Vey tends the wreck’s vines. *Ask her before touching them.* Looking is allowed. Digging is another matter."], choices: [{ text: '~neutral~ I’ll ask her.', end: true }] },
        again: {
          say: [
            { if: { flag: 'edena.log.read' }, text: "~sad~ You’ve seen the wreck. Sit a moment. You look as though you’ve brought a question back." },
            { if: { not: { flag: 'edena.log.read' } }, text: "~neutral~ *South, beyond the pond, where the meadow dips.* Find Vey by the vines." },
          ],
          choices: [
            { text: '~curious~ Where did Odile and Talo go?', goto: 'went' },
            { text: '~happy~ See you, Mira.', end: true },
          ],
        },
        clockDone: {
          say: ["~happy~ You heard it? It rang on its own. Years, I’ve been guessing when to water.", "~playful~ Tell the dome people their old pump gear has a new job. A bossy one."],
          do: { set: { 'edena.mira.clock': true } },
          choices: [{ text: '~happy~ It suits it.', end: true }],
        },
        clock: { say: ["~playful~ It tells us when to water. The bowl fills, tips, and rings the bell. Or it did, until its gear went missing. We’ve learned to be punctual approximately."], choices: [{ text: '~happy~ See you, Mira.', end: true }] },
        tell: {
          say: ["~solemn~ You saw the mark under the flowers. Tell me."],
          choices: [
            { text: '~neutral~ There’s a scorch on their hull: three dots over an arc.', goto: 'mark' },
            { text: '~solemn~ My ship has the same mark. Something struck it, on the way here.', goto: 'same' },
          ],
        },
        mark: { say: ["~sad~ Talo showed it to us that first spring. Then he asked us to leave the ship for the garden. We did."], choices: [{ text: '~solemn~ My ship has the same mark. Something struck it, on the way here.', goto: 'same' }] },
        same: {
          say: ['~surprised~ …', '~whisper~ Then it wasn’t only theirs.', "~solemn~ Talo called it *the Singer*. A light that sang, turned, then struck their ship. They left to find out why."],
          do: { set: { 'clue.edena.struck': true } },
          choices: [{ text: '~curious~ Where did they go to ask?', goto: 'where' }, { text: '~curious~ What does it want?', goto: 'want' }],
        },
        where: { say: ["~sad~ They headed toward *the deep wood beyond the swamp of lights*. Talo tracked the Singer’s course from the tallest tree. I don’t know what they found."], do: { set: { 'clue.edena.pod': true } }, choices: [{ text: '~curious~ What does it want?', goto: 'want' }] },
        want: {
          say: ["~solemn~ I can’t tell you what the Singer wants. I wish I could.", "~solemn~ What I know is this: *we tend the garden. The garden tends us.* We can care for a place without understanding everything in it."],
          do: [{ advance: [Q, 'tell'] }, { keepsake: KEEPSAKE }, { set: { 'clue.edena.pod': true } }],
          next: 'carry',
        },
        carry: { say: ['~happy~ Take that with you. It isn’t heavy. It fits in any ship.'], choices: [{ text: '~happy~ Thank you, Mira.', end: true }] },
        after: { say: [{ if: { quest: 'edena.clock', done: true }, text: "~happy~ The clock rang. Time to water. Then tea. I find the order helps." }, { if: { not: { quest: 'edena.clock', done: true } }, text: "~happy~ Time to water, I think. The clock can’t tell me, so I guess. Then tea." }], choices: [{ text: '~curious~ What is the water clock for?', goto: 'clock', once: true }, { text: '~playful~ I’ll let you water.', end: true }] },
      },
    },
  },

  sol: {
    id: 'sol', name: 'Sol', title: 'who remembers them', color: '#9fd6c9', voice: 0.85, kind: 'm',
    palette: { cloak: '#9fd6c9', lining: '#2b211f', cloth: '#f7f4ec', legs: '#5a6a6a', hat: '#f2a7b5', hair: '#e8dcc0' }, head: 'hat', cape: 0.9,
    lines: ['~curious~ Odile? Talo? They left in the little saucer.', '~happy~ They’ll be back for the tea.', '~surprised~ Every flower turned east. Every one.'],
    talk: {
      entry: [
        { if: { all: [{ quest: 'edena.terraces', failed: true }, { not: { flag: 'edena.sol.flood' } }] }, node: 'flood' },
        { if: { quest: Q, done: true }, node: 'after' }, { if: { flag: 'met.sol' }, node: 'again' }, { node: 'hello' },
      ],
      nodes: {
        tea: {
          say: ["~happy~ Our tea comes from *Esk’s terraces, south-east of the landing*, above the dry hollow. Every cup starts there.", "~sad~ The spring has slowed since the light passed. Esk’s worried about the bushes. Go see her. She’ll pretend she isn’t glad of company."],
          do: (ctx) => { if (!ctx.quests?.isStarted('edena.terraces') && ctx.quests?.def('edena.terraces')) ctx.quests.start('edena.terraces'); },
          choices: [{ text: '~neutral~ I’ll go and see her.', end: true }],
        },
        flood: {
          say: ["~sad~ I saw the flood from here. All that water where her rows used to be.", "~tired~ We have last year’s tea. I kept saying it would keep. I’d rather have been right about something less necessary."],
          do: { set: { 'edena.sol.flood': true } },
          choices: [{ text: '~sad~ It was my doing.', goto: 'floodMine' }],
        },
        floodMine: { say: ["~solemn~ You opened an old gate because Esk needed water. Neither of you knew it would break. Sit down. Have some tea."], choices: [{ text: '~sad~ Thank you, Sol.', end: true }] },
        hello: {
          say: ["~curious~ Odile? Talo? No, sorry. Wrong traveller. They left in the little saucer. You’d know if you were them. I expect.", "~playful~ Sol. I followed them everywhere as a boy. Talo let me hold the tools. Odile let me help him up when his inventions disagreed with him."],
          choices: [
            { text: '~curious~ Are they coming back?', goto: 'back' },
            { text: '~curious~ What does the garden believe?', goto: 'believe' },
          ],
        },
        back: { say: ["~happy~ They said they’d return for tea. A promise involving refreshments ought to count for something. I’m still here, anyway."], choices: [{ text: '~curious~ Have you seen anything strange lately?', goto: 'strange' }, { text: '~curious~ Where does the tea come from?', goto: 'tea', if: { quest: 'edena.terraces', started: false } }, { text: '~neutral~ Goodbye, Sol.', end: true }] },
        believe: { say: ["~playful~ We let fallen things stay fallen. Leaves, seeds, ships. The garden finds a use for them. Vey believes that without exceptions. I have questions about fruit."], choices: [{ text: '~curious~ Have you seen anything strange lately?', goto: 'strange' }] },
        strange: {
          say: ["~whisper~ The light passed again that night. High overhead, singing. Every flower turned to follow it. In the dark. I couldn’t call that ordinary gardening.", "~playful~ Talo called it the Singer. Never fondly. More like a neighbour who’d put a hole in his roof."],
          do: { set: { 'edena.rumour.light': true } },
          choices: [{ text: '~neutral~ It struck my ship.', goto: 'struck' }, { text: '~neutral~ Goodbye, Sol.', end: true }],
        },
        struck: { say: ["~curious~ It struck you too? Then there’s something to ask Talo, if he returns. I hope he does."], choices: [{ text: '~neutral~ Goodbye, Sol.', end: true }] },
        again: { say: ['~tired~ Any sign of them? No. Tea keeps.'], choices: [{ text: '~curious~ Tell me about the light again.', goto: 'strange' }, { text: '~curious~ Where does the tea come from?', goto: 'tea', if: { quest: 'edena.terraces', started: false } }, { text: '~neutral~ Goodbye, Sol.', end: true }] },
        after: { say: ["~sad~ You know why they went now. I knew they’d leave, and I still hope they’ll come back. It’s a tiring arrangement."], choices: [{ text: '~solemn~ Both can be true.', end: true }] },
      },
    },
  },

  oro: {
    id: 'oro', name: 'Oro', title: 'who grows pyramids', color: '#f2a7b5', voice: 0.95, kind: 'm',
    palette: { cloak: '#f2a7b5', lining: '#2b211f', cloth: '#f3ead8', legs: '#5a4a40', hat: '#f3ead8', hair: '#2b211f' }, head: 'wrap', cape: 0.7,
    lines: ['~neutral~ The pyramids are older than the androids.', '~tired~ Slowly. Pyramids grow slowly.', '~scared~ Have you seen a little white seed?'],
    talk: {
      entry: [
        { if: { quest: 'edena.seed', done: true }, node: 'after' },
        { if: { quest: 'edena.seed', stage: 'water' }, node: 'water' },
        { if: { has: 'seed' }, node: 'back' },
        { if: { quest: 'edena.seed', active: true }, node: 'waiting' },
        { node: 'hello' },
      ],
      nodes: {
        hello: {
          say: ["~surprised~ Oh! You’re speaking to me. Usually people ask a question about the pyramids and walk off before the interesting part.", "~happy~ Oro. The pyramids *grow from seeds*. The androids didn’t build the originals. I grow them too. My first is knee-high. An excellent century’s work."],
          choices: [
            { text: '~surprised~ Pyramids grow from seeds?', goto: 'seeds' },
            { text: '~curious~ Who were the androids?', goto: 'androids' },
          ],
        },
        seeds: {
          say: ["~neutral~ A little white, stepped seed rolled downhill from my hand. They seek water. Look on the pond’s far shore, west of your landing."],
          choices: [{ text: '~happy~ I’ll look for it.', do: { start: 'edena.seed' }, goto: 'thanks' }, { text: '~neutral~ Maybe later.', end: true }],
        },
        androids: {
          say: ["~neutral~ The white builders were androids. They found the pyramids and sky-fallen spheres already here, then built their gardens around them. Their copies aren’t nearly as good.", "~solemn~ {glyph} We call it the Builders’ mark, but it’s older than them. It’s under the spheres too. I suspect the builders were copying something they admired.", "~whisper~ They also left blue chests with pale stars in the tree canopies. The plants grow around them, never over them. Interesting choice for a plant."],
          choices: [{ text: '~curious~ Pyramids grow from seeds, you said?', goto: 'seeds' }],
        },
        thanks: { say: ["~happy~ Please do! *The seed glows when you get close.* Bring it back. We can plant it together, and I can finally stop searching the grass."], choices: [{ text: '~happy~ Back soon.', end: true }] },
        waiting: { say: ["~neutral~ The far shore of the pond, west of the landing. Look for a faint glow as you approach."], choices: [{ text: '~neutral~ On my way.', end: true }] },
        back: {
          say: ['~happy~ My seed! You found it. Look at it, all its little steps.', "~whisper~ (Oro kneels and presses the seed gently into the soil.)", "~playful~ Now *shoot a little fluid onto the seed*. A pyramid’s first drink is an occasion."],
          do: [{ take: 'seed' }, { advance: 'edena.seed' }, { set: { 'edena.seed.planted': true } }],
          choices: [{ text: '~playful~ (splash it)', end: true }],
        },
        water: { say: ["~neutral~ *Water the seed beside me.* One splash should do."], choices: [{ text: '~playful~ (splash it)', end: true }] },
        after: { say: ["~surprised~ It grew! A century’s growth in one splash. Only nine hundred years to go."], choices: [{ text: '~playful~ I’ll come back and check.', end: true }] },
      },
    },
  },

  lio: {
    id: 'lio.edena', name: 'Lio', title: 'who climbs', color: '#b5a7e6', voice: 1.4, kind: 'f', scale: 0.86, age: 'child', years: 9,
    palette: { cloak: '#b5a7e6', lining: '#2b211f', cloth: '#f2c54b', legs: '#4a3a2a', hat: '#f2a7b5', hair: '#6e4a32' }, head: 'hair', cape: 0.5,
    lines: ['~happy~ Climb the trees. The view is worth it.', '~happy~ I’ve been to the second canopy. Twice!', '~surprised~ The crown floats. It FLOATS.'],
    talk: {
      entry: [
        { if: { quest: 'edena.tree', done: true }, node: 'after' },
        { if: { flag: 'edena.lookout.read' }, node: 'tell' },
        { if: { quest: 'edena.tree', active: true }, node: 'waiting' },
        { node: 'hello' },
      ],
      nodes: {
        hello: {
          say: ["~happy~ I’m Lio. I’ve climbed every tree here except *the tallest*. I prefer to introduce myself before admitting that.", "~sad~ It’s *north-west*. I can reach the second canopy, but the crown is too high. Those thin branches won’t hold me."],
          choices: [
            { text: '~curious~ What’s on the crown?', goto: 'what' },
            { text: '~playful~ I can jump quite high.', goto: 'jump' },
          ],
        },
        what: { say: ["~curious~ I saw something square on the crown. Sol says Talo used to sit up there. I intend to verify both statements."], choices: [{ text: '~neutral~ I’ll go and look.', do: { start: 'edena.tree' }, goto: 'go' }, { text: '~neutral~ Maybe later.', end: true }] },
        jump: { say: ["~surprised~ Your backpack can get you up! Climb to the second canopy, move beneath the crown, jump, then jump again in mid-air."], choices: [{ text: '~neutral~ I’ll go and look.', do: { start: 'edena.tree' }, goto: 'go' }] },
        go: { say: ["~playful~ Tell me what’s there. If it’s treasure, I accept payment for directions. Small payment. A description would do."], choices: [{ text: '~playful~ Deal.', end: true }] },
        waiting: { say: ["~neutral~ *Tallest tree, north-west.* Climb to the second canopy, then *double-jump to the crown*."], choices: [{ text: '~neutral~ On my way.', end: true }] },
        tell: {
          say: ['~surprised~ You went up! You went UP! What was there?'],
          choices: [
            { text: '~neutral~ A bench, and a note from Talo. He watched the sky from up there.', do: (ctx) => { const q = ctx.quests; if (!q.isStarted('edena.tree')) q.start('edena.tree', 'tell'); q.advance('edena.tree', 'tell'); }, goto: 'bench' },
            { text: '~neutral~ The whole garden, and the furrow the ship cut across it.', do: (ctx) => { const q = ctx.quests; if (!q.isStarted('edena.tree')) q.start('edena.tree', 'tell'); q.advance('edena.tree', 'tell'); }, goto: 'view' },
          ],
        },
        bench: { say: ["~surprised~ He took a BENCH up there? I haven’t even managed myself! Right. More practice."], choices: [{ text: '~happy~ You will.', end: true }] },
        view: { say: ["~curious~ You saw the whole crash furrow? Sol calls it the garden stitching the meadow together. I want to see that."], choices: [{ text: '~neutral~ It does look like that.', end: true }] },
        after: { say: ["~playful~ Got a little higher today. Measured it. Then measured again more generously."], choices: [{ text: '~happy~ Keep going.', end: true }] },
      },
    },
  },

  vey: {
    id: 'vey', name: 'Vey', title: 'who tends the vines', color: '#7fcfa8', voice: 0.8, kind: 'f', scale: 1.02,
    palette: { cloak: '#7fcfa8', lining: '#2b211f', cloth: '#f7f4ec', legs: '#4a5a3a', hat: '#f7f4ec', hair: '#e8dcc0' }, head: 'hood', cape: 1.4, look: { prop: 'flower' },
    lines: ['~angry~ Don’t cut anything.', '~solemn~ It fell. It belongs to the ground now.', '~whisper~ Gently.'],
    talk: {
      entry: [
        { if: { all: [{ quest: 'edena.terraces', failed: true }, { not: { flag: 'edena.vey.flood' } }] }, node: 'flood' },
        { if: { quest: Q, done: true }, node: 'after' },
        { if: { flag: 'edena.veil.open' }, node: 'opened' },
        { if: { flag: 'edena.veil.pushed' }, node: 'pushed' },
        { if: { flag: 'edena.vey.asked' }, node: 'again' },
        { node: 'hello' },
      ],
      nodes: {
        hello: {
          say: ['~angry~ Stop there. Gently. You’re standing on a root.', "~tired~ Vey. I’ve tended this wreck’s vines for forty years. There was still paint when I started."],
          choices: [
            { text: '~neutral~ Mira said I should ask before I touch anything.', goto: 'ask' },
            { text: '~curious~ Why let the garden take it?', goto: 'why' },
          ],
        },
        why: { say: ["~solemn~ Here we leave fallen things to the garden. It turns wreckage into soil and shelter. Digging it out undoes that work."], choices: [{ text: '~curious~ May I look at it?', goto: 'ask' }] },
        ask: {
          say: ['~happy~ Good. You asked. Most don’t; most just stare.', "~neutral~ You may look inside. The hatch is on this side, beneath the flower arch. Talo used to sit there with his recorder.", "~solemn~ *Don’t cut or pull the vines.* Find a gentler way through."],
          do: { set: { 'edena.vey.asked': true } },
          choices: [{ text: '~neutral~ I won’t cut anything.', end: true }],
        },
        again: { say: ["~neutral~ *The hatch beneath the flower arch.* Enter gently. Leave the vines intact."], choices: [{ text: '~whisper~ Gently.', end: true }] },
        pushed: { say: ["~angry~ I saw you push the vines. They pushed back. Try watering them. Force isn’t the only thing your hands can do."], choices: [{ text: '~sad~ Sorry, Vey.', end: true }] },
        opened: {
          say: ["~surprised~ They moved aside for you. Forty years tending them, and I’ve never seen that.", "~curious~ No cutting. No tearing. They made room. *Go inside and look.* Then let them close again."],
          choices: [{ text: '~solemn~ I’ll look, and let it close.', end: true }],
        },
        after: { say: ["~solemn~ The flowers are closing over the hatch. By spring they’ll be thicker. Leave them that much."], choices: [{ text: '~solemn~ That’s how it should be.', end: true }] },
        flood: {
          say: ["~angry~ I heard about the terraces. That gate had been shut longer than anyone remembered. Now we know how little we knew about it.", "~solemn~ The garden will grow over the mud. That won’t make it Esk’s old hill again."],
          do: { set: { 'edena.vey.flood': true } },
          choices: [{ text: '~sad~ I only meant to help.', goto: 'floodMeant' }],
        },
        floodMeant: { say: ["~tired~ You meant to help. So did Esk. Remember that, and remember the damage. Both matter."], choices: [{ text: '~solemn~ Both. I’ll remember.', end: true }] },
      },
    },
  },

  // the tea terraces (src/story/terraces.js): the quest you try, and fail
  esk: {
    id: 'esk', name: 'Esk', title: 'who keeps the tea terraces', color: '#9a7a4a', voice: 0.9, kind: 'f', scale: 0.98,
    palette: { cloak: '#c9a46a', lining: '#2b211f', cloth: '#5f8f5a', legs: '#5a4a3a', hat: '#f3ead8', hair: '#8a8a8a' }, head: 'wrap', cape: 0.8, look: { prop: 'basket', head: 'straw', under: 'bun' },
    lines: ['~tired~ Mind the bushes. They’re thirsty.', '~neutral~ Top row first. Always top row first.', '~sad~ The tips are going brown.'],
    linesAfter: ['~tired~ …', '~sad~ The sides held. The sides held.', '~solemn~ It belongs to the ground now.'],   // (after the flood: src/story/terraces.js)
    talk: {
      entry: [
        // coming back (a later visit): the small job, and what she says once it is done
        { if: { quest: 'edena.cutting', stage: 'tell' }, node: 'planted' },
        { if: { quest: 'edena.cutting', stage: 'plant' }, node: 'job' },
        { if: { quest: 'edena.cutting', done: true }, node: 'kept' },
        { if: { all: [{ quest: 'edena.terraces', failed: true }, { flag: 'edena.esk.back' }, { not: { quest: 'edena.cutting', started: true } }] }, node: 'back' },
        { if: { quest: 'edena.terraces', failed: true }, node: 'after' },
        { if: { quest: 'edena.terraces', stage: 'sorry' }, node: 'sorry' },
        { if: { quest: 'edena.terraces', stage: 'flood' }, node: 'flood' },
        { if: { quest: 'edena.terraces', stage: ['roots', 'gate'] }, node: 'go' },
        { if: { quest: 'edena.terraces', stage: 'ask' }, node: 'ask' },
        { if: { quest: 'edena.terraces', stage: 'runnels' }, node: 'runnels' },
        { node: 'hello' },
      ],
      nodes: {
        hello: {
          say: ["~tired~ Mind the tea bushes. They’re thirsty. I’m cross. Best not to test which is worse.", "~neutral~ Esk. These are my tea terraces. The builders made the steps; my family planted the bushes. That top row goes back to my grandmother’s grandmother."],
          choices: [
            { text: '~curious~ Why are they thirsty?', goto: 'dry' },
            { text: '~playful~ All the garden’s tea comes from here?', goto: 'teaAll' },
          ],
        },
        teaAll: { say: ["~happy~ Every cup comes from here. Sol drinks enough to count as weather."], choices: [{ text: '~curious~ And why are they thirsty?', goto: 'dry' }] },
        dry: {
          say: ["~sad~ Since the Singer passed, the spring barely runs. Silt has blocked the channels. Those brown tips mean the bushes are drying out.", "~neutral~ Use your fluid’s *Push* from the path to clear *three clods of silt*. Start at *the top terrace*, then work down. Don’t trample the beds."],
          choices: [
            { text: '~neutral~ I’ll clear them.', do: (ctx) => { const q = ctx.quests; if (!q.isStarted('edena.terraces')) q.start('edena.terraces', 'runnels'); else q.advance('edena.terraces', 'esk'); ctx.game.set('edena.esk.asked', true); }, goto: 'thanks' },
            { text: '~neutral~ Maybe later.', end: true },
          ],
        },
        thanks: { say: ["~happy~ Thank you. *Push out the silt, top channel first.* Then clear each one below it."], choices: [{ text: '~neutral~ Top first.', end: true }] },
        runnels: { say: ["~neutral~ *Top, middle, then bottom.* Push each clod out of its channel from the path."], choices: [{ text: '~neutral~ On it.', end: true }] },
        ask: {
          say: ["~happy~ There. Running water. I’d forgotten how much I missed that sound.", "~sad~ Still too little. The upper bushes will take it all. The lower rows won’t last the summer.", "~solemn~ *The builders’ cistern above us* is full. You can hear it behind the gate. Nobody has opened that gate in living memory. We leave the builders’ things alone."],
          choices: [
            { text: '~curious~ Do you want me to open it?', goto: 'askGate' },
            { text: '~neutral~ Then we leave it shut.', goto: 'leave' },
          ],
        },
        leave: {
          say: ["~tired~ We could leave it shut. Watch another row go brown. Then another next year.", "~angry~ I can’t watch that happen without trying. It’s a water gate. Surely they meant someone to use the water."],
          next: 'askGate',
        },
        askGate: {
          say: ['~scared~ …', "~solemn~ Open it *a little*. First *shoot water onto the roots around the wheel* so they loosen. Then *push the wheel once*. One turn should be enough."],
          do: [{ advance: ['edena.terraces', 'ask'] }, { set: { 'edena.esk.gate': true } }],
          choices: [{ text: '~neutral~ One turn.', end: true }],
        },
        go: { say: ["~neutral~ *At the cistern above the terraces*: water the roots around the wheel, then *push it once*. I don’t know what it will do. Nobody does."], choices: [{ text: '~neutral~ Once.', end: true }] },
        flood: { say: ["~scared~ Stop! The gate— Get off the slope! Get clear!"], choices: [{ text: '~scared~ (get back)', end: true }] },
        sorry: {
          say: ["~angry~ (Esk stares at the raw gap through her terraces. She does not turn to you.)", '~angry~ I said a little. I said one turn.'],
          choices: [
            { text: '~sad~ I only turned it once.', goto: 'once' },
            { text: '~sad~ I’m sorry, Esk.', goto: 'sorry2' },
          ],
        },
        once: {
          say: ['~angry~ I know. I watched you. I know it was once.', "~angry~ I asked you to open it. I know. I’m angry with you anyway. Give me a moment."],
          choices: [{ text: '~sad~ I’m sorry, Esk.', goto: 'sorry2' }],
        },
        sorry2: {
          say: ['~tired~ …', "~sad~ My mother planted the second row. We planted the bottom one when Sol’s knees started going. I can’t even see where they were.", '~solemn~ I know you are. I can see you are.'],
          next: 'okay',
        },
        okay: {
          say: ["~solemn~ I hear you. I’m not ready to say it’s all right. We say it belongs to the ground now. It’s harder when it’s your own hill.", "~neutral~ You can’t put the hill back. Please leave me with it for a while."],
          do: { fail: 'edena.terraces' },
          choices: [{ text: '~sad~ (go)', end: true }],
        },
        after: {
          say: [
            { if: { not: { flag: 'edena.esk.after' } }, text: "~tired~ It’s greening at the edges. A few bushes survived. There’ll be something here again. I don’t know what yet." },
            { if: { flag: 'edena.esk.after' }, text: '~neutral~ Sol says tea keeps. For once, Sol is right.' },
          ],
          do: { set: { 'edena.esk.after': true } },
          choices: [{ text: '~sad~ (nod)', end: true }],
        },
        // a later visit: she has been deciding whether there is a job for you
        back: {
          say: [
            "~tired~ You came back. I thought you might. I wasn’t sure I wanted you to.",
            "~neutral~ Three rows held at the sides. I’ve been taking cuttings from them, for the mud. It’s what you do.",
            "~solemn~ I’ve been deciding whether to give you one. I have. There’s a small job, if you want it.",
          ],
          choices: [
            { text: '~curious~ What job?', goto: 'jobGive' },
            { text: '~sad~ Are you sure you want my help?', goto: 'sure' },
          ],
        },
        sure: {
          say: ["~neutral~ No. That’s why it’s a small job.", "~tired~ You helped open the gate. You can help with what grows after. Both are true."],
          next: 'jobGive',
        },
        jobGive: {
          say: ["~neutral~ Take this cutting down *to the mud below the terraces, where the stream runs slow*. Press it in up to the second leaf. Don’t water it; the stream will.", "~solemn~ And don’t make a ceremony of it. It’s a cutting."],
          do: { start: 'edena.cutting' },
          choices: [{ text: '~neutral~ Up to the second leaf.', end: true }],
        },
        job: { say: ["~neutral~ *Down in the mud, where the stream runs slow.* Up to the second leaf."], choices: [{ text: '~neutral~ On my way.', end: true }] },
        planted: {
          say: [
            "~neutral~ It’s in? Good. It might take. It might not. The mud doesn’t know what it is yet.",
            "~solemn~ It won’t be my grandmother’s hill. It’ll be this one.",
          ],
          do: { advance: 'edena.cutting' },
          choices: [{ text: '~neutral~ This one, then.', end: true }],
        },
        kept: {
          say: ["~neutral~ (Esk looks down at the mud, where one small green thing stands by the stream.) It hasn’t died yet. I check every morning.", "~tired~ Sol says that’s how gardening starts. I told him I know how gardening starts."],
          choices: [{ text: '~happy~ (nod)', end: true }],
        },
      },
    },
  },
};


// The scenery you can look at: same panel, a different voice.
export const THINGS = {
  log: {
    id: 'log', name: 'The ship’s log', title: 'at the cockpit panel', color: '#34405e', voice: 0.75,
    talk: { nodes: {
      odile: {
        say: ["~tired~ The panel wakes under your hand. A woman speaks: *Odile’s log. Day ninety-one. Talo has found a new noise to worry about.*", "~curious~ *There’s a light off the port bow, keeping pace. The hull rings when it sings. I think it’s beautiful. Talo would like beauty a little farther from the ship.*", "~scared~ *It’s turning toward us. Talo, move us away. Talo—* The recording cuts out."],
        next: 'talo',
      },
      talo: {
        say: ["~happy~ A later entry. A man, with birds behind him: *Talo. We’re alive. Landed in a garden. They’ve given us tea and strict instructions about digging.*", "~curious~ *Odile wants the ship repaired. I want to know what hit us. There’s a mark burned into the hull. The same mark is on the white ruins here.*", "~solemn~ *We’re taking the little saucer to follow it. Whoever finds this: the mark is under the flowers on the flank. Look, but leave the vines alone.*"],
        do: { set: { 'edena.log.read': true } },
        choices: [{ text: '~whisper~ (let the panel sleep)', end: true }],
      },
    } },
  },
  scar: {
    id: 'scar', name: 'Under the flowers', title: 'the ship’s flank', color: '#54433b', voice: 1.5,
    talk: { nodes: {
      look: {
        say: ["~solemn~ The vines reveal scorched metal. Burned into its centre: three dots over an arc."],
        next: 'mine',
      },
      mine: {
        speaker: 'player',
        say: ["~surprised~ The mark on my ship. Even the burn is the same.", "~scared~ It hit them too. Long before it found me."],
        do: { set: { 'edena.scar.seen': true } },
        choices: [{ text: '~solemn~ (let the flowers close)', end: true }],
      },
    } },
  },
  lookout: {
    id: 'lookout', name: 'Talo’s lookout', title: 'on the tallest tree’s crown', color: '#b5a7e6', voice: 0.75,
    talk: { nodes: {
      note: {
        say: ["~neutral~ A smooth bench faces east. Beside it, a folded note hangs below a carved mark: three dots over an arc.", "~solemn~ *The light came from the east. Odile says it won’t return. It turned once. It can turn again. If it does, I want to be looking. — T.*", "~sad~ From the crown you see the whole garden. Greener plants trace the furrow through the south meadow, where the ship tore the ground."],
        do: { set: { 'edena.lookout.read': true } },
        choices: [{ text: '~curious~ (watch the east for a while)', end: true }],
      },
    } },
  },
};
