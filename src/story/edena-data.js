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
    failOutro: 'You opened the builders’ gate a little, as Esk asked, and the hill came down with the water. She said it was the garden’s now.',
    stages: [
      { id: 'esk', text: 'Esk keeps the tea terraces south-east of the landing, above the dry hollow. Go and see her', label: 'Esk, on the tea terraces', talk: 'esk', at: 'esk' },
      { id: 'runnels', text: 'Clear the three choked runnels, top terrace first: shove each clod of silt out (push: C, middle click, or RB / R1)', label: 'A choked runnel', when: (q) => (q.game.flag('edena.runnels') ?? 0) >= 3, at: 'clod' },
      { id: 'ask', text: 'Water runs, but only a trickle. Tell Esk', label: 'Esk, on the tea terraces', talk: 'esk', at: 'esk' },
      { id: 'roots', text: 'Roots have grown through the wheel of the builders’ gate, on the cistern above the terraces. Water them so they let go (shoot)', label: 'The builders’ gate', flag: 'edena.gate.roots', at: 'gate' },
      { id: 'gate', text: 'Turn the gate’s wheel a little: one shove (push)', label: 'The builders’ gate', flag: 'edena.gate.turned', at: 'gate' },
      { id: 'flood', text: 'The gate is giving way', label: 'The terraces', flag: 'edena.terraces.flooded', at: 'esk' },
      { id: 'sorry', text: 'Go down to Esk', label: 'Esk', talk: 'esk', at: 'esk' },
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
    lines: ['~solemn~ We tend the garden. The garden tends us.', '~playful~ The clock says it is time for tea. It always says that.', '~playful~ Mind the flowers. They mind you.'],
    talk: {
      entry: [
        { if: { all: [{ quest: 'edena.terraces', failed: true }, { not: { flag: 'edena.mira.flood' } }, { not: { quest: Q, stage: 'tell' } }] }, node: 'flood' },
        { if: { quest: Q, done: true }, node: 'after' },
        { if: { quest: Q, stage: 'tell' }, node: 'tell' },
        { if: { flag: 'edena.mira.heard' }, node: 'again' },
        { node: 'hello' },
      ],
      nodes: {
        // after the terraces (src/story/terraces.js): once
        flood: {
          say: ['~solemn~ Esk came by. She wasn’t angry any more by the time she got here. She was tired.', '~solemn~ We tend the garden. Some years that means letting a hill go. The clock still rang this morning: time to water. Not there. Not this year.'],
          do: { set: { 'edena.mira.flood': true } },
          choices: [{ text: '~sad~ I’m sorry, Mira.', goto: 'floodSorry' }],
        },
        floodSorry: { say: ['~neutral~ I know. Esk knows. Go gently; that’s all anyone asks here.'], choices: [{ text: '~sad~ (nod)', end: true }] },
        hello: {
          say: ['~surprised~ A ball fell into the meadow and a person came out of it. That is twice in my life. I’m Mira. I keep the water clock, which mostly means I keep it company.', '~happy~ You’ll want to know where you are. This is the garden. We tend it. That is all there is to know, and it takes a lifetime.'],
          choices: [
            { text: '~surprised~ Twice? Something else fell here?', goto: 'twice' },
            { text: '~neutral~ I’m looking for something of value.', goto: 'value' },
          ],
        },
        who: { say: ['~playful~ The gardeners. Us. And the garden, which tends us back. There were others before us, the white builders who left the ruins and the pedestals. They tended it with straight lines. We prefer curved ones.'], choices: [{ text: '~curious~ Something else fell here, you said?', goto: 'twice' }] },
        value: { say: ['~solemn~ Then you’ve come to the wrong garden, or the right one. We don’t keep anything. Everything here is on its way to being something else.'], choices: [{ text: '~curious~ You said something else fell here?', goto: 'twice' }, { text: '~curious~ Who tends it?', goto: 'who' }] },
        twice: {
          say: ['~neutral~ A ship, long ago, when I was small. Odile and Talo’s. It came down in *the south meadow*, burning, and ploughed a furrow you can still see from the tall trees.', '~solemn~ They lived. We gave them tea. They stayed one spring, and then they left, and we let the garden take the ship. We don’t dig up what falls. It fell; it belongs to the ground now.'],
          do: { set: { 'edena.mira.heard': true } },
          choices: [
            { text: '~curious~ Can I see it?', goto: 'see' },
            { text: '~curious~ Where did they go?', goto: 'went' },
          ],
        },
        went: { say: ['~playful~ Away, in the little round boat they kept inside the big one. Sol will tell you they’re coming back. Sol tells everyone that.'], choices: [{ text: '~curious~ Can I see their ship?', goto: 'see' }] },
        see: { say: ['~neutral~ Seeing isn’t digging. Go *south, past the pond, where the meadow dips*. Vey tends the vines there. *Ask her before you touch anything*; the vines are hers more than anyone’s.'], choices: [{ text: '~neutral~ I’ll ask her.', end: true }] },
        again: {
          say: [
            { if: { flag: 'edena.log.read' }, text: '~sad~ You went inside. I can tell; everyone comes out of that ship walking more slowly.' },
            { if: { not: { flag: 'edena.log.read' } }, text: '~neutral~ *South, past the pond, where the meadow dips*. Vey will be with the vines.' },
          ],
          choices: [
            { text: '~curious~ Where did Odile and Talo go?', goto: 'went' },
            { text: '~happy~ See you, Mira.', end: true },
          ],
        },
        clock: { say: ['~playful~ For knowing when to water. It drips, the bowl fills, it tips, a bell rings: water the garden. Its gear has been worn smooth for years. It still rings. Mostly.'], choices: [{ text: '~happy~ See you, Mira.', end: true }] },
        tell: {
          say: ['~solemn~ You’ve been under the flowers. I can see it in how you’re standing.'],
          choices: [
            { text: '~neutral~ There’s a scorch on their hull: three dots over an arc.', goto: 'mark' },
            { text: '~solemn~ My ship has the same mark. Something struck it, on the way here.', goto: 'same' },
          ],
        },
        mark: { say: ['~sad~ Yes. We knew it was there. Talo showed us, the first spring. Then he asked us to let the garden have it, and we did. We’re good at that.'], choices: [{ text: '~solemn~ My ship has the same mark. Something struck it, on the way here.', goto: 'same' }] },
        same: {
          say: ['~surprised~ …', '~whisper~ Then it wasn’t only theirs.', '~solemn~ Talo called it the Singer. A light that sang as it came, and turned before it struck, as if it had been looking for something. They never learned what it was. That’s why they left: to go and ask it.'],
          do: { set: { 'clue.edena.struck': true } },
          choices: [{ text: '~curious~ Where did they go to ask?', goto: 'where' }, { text: '~curious~ What does it want?', goto: 'want' }],
        },
        where: { say: ['~sad~ Toward *the deep wood on the far side of the swamp of lights*, Talo said. The way it went when it turned, he said; he worked it out from the stars, up on the tall tree. I’ve never been. Nobody here has.'], do: { set: { 'clue.edena.pod': true } }, choices: [{ text: '~curious~ What does it want?', goto: 'want' }] },
        want: {
          say: ['~solemn~ I don’t know. Nobody here does. I don’t think the light is ours to know.', '~solemn~ But I know what we do with the things that fall on us. We tend the garden. The garden tends us.'],
          do: [{ advance: [Q, 'tell'] }, { keepsake: KEEPSAKE }, { set: { 'clue.edena.pod': true } }],
          next: 'carry',
        },
        carry: { say: ['~happy~ Take that with you. It isn’t heavy. It fits in any ship.'], choices: [{ text: '~happy~ Thank you, Mira.', end: true }] },
        after: { say: ['~happy~ The clock rang while you were away. Time to water. It’s always time to water.'], choices: [{ text: '~curious~ What is the water clock for?', goto: 'clock', once: true }, { text: '~playful~ I’ll let you water.', end: true }] },
      },
    },
  },

  sol: {
    id: 'sol', name: 'Sol', title: 'who remembers them', color: '#9fd6c9', voice: 0.85, kind: 'm',
    palette: { cloak: '#9fd6c9', lining: '#2b211f', cloth: '#f7f4ec', legs: '#5a6a6a', hat: '#f2a7b5', hair: '#e8dcc0' }, head: 'hat', cape: 0.9,
    lines: ['~curious~ Odile? Talo? They left in the ship.', '~happy~ They’ll be back for the tea.', '~surprised~ Every flower turned east. Every one.'],
    talk: {
      entry: [
        { if: { all: [{ quest: 'edena.terraces', failed: true }, { not: { flag: 'edena.sol.flood' } }] }, node: 'flood' },
        { if: { quest: Q, done: true }, node: 'after' }, { if: { flag: 'met.sol' }, node: 'again' }, { node: 'hello' },
      ],
      nodes: {
        tea: {
          say: ['~happy~ From Esk’s terraces, *south-east of the landing, where the meadow drops into the dry hollow*. Every cup in the garden.', '~sad~ Thin this year, though. Since the light went over, the spring up there has sulked. Esk is beside herself. Go and see her; she likes being worried at.'],
          do: (ctx) => { if (!ctx.quests?.isStarted('edena.terraces') && ctx.quests?.def('edena.terraces')) ctx.quests.start('edena.terraces'); },
          choices: [{ text: '~neutral~ I’ll go and see her.', end: true }],
        },
        flood: {
          say: ['~sad~ Esk’s hill, eh. I saw the water from here; it came down like a white sheet hung out to dry.', '~tired~ There’s tea from last year. Tea keeps. I’ve always said so; this is the first year anybody’s glad of it.'],
          do: { set: { 'edena.sol.flood': true } },
          choices: [{ text: '~sad~ It was my doing.', goto: 'floodMine' }],
        },
        floodMine: { say: ['~solemn~ It was a door, and you opened it, and it was a very old door. Have some tea. Last year’s.'], choices: [{ text: '~sad~ Thank you, Sol.', end: true }] },
        hello: {
          say: ['~curious~ Odile? Talo? They left in the ship. The little one, I mean; the big one stayed. You’re not them, are you? No. They’d have brought cake.', '~playful~ I’m Sol. I knew them, when I was young enough to follow them about. Talo let me hold his tools. Odile let me hold Talo, when he fell off things.'],
          choices: [
            { text: '~curious~ Are they coming back?', goto: 'back' },
            { text: '~curious~ What does the garden believe?', goto: 'believe' },
          ],
        },
        back: { say: ['~happy~ Of course. They said they’d be back for the tea, and nobody says that about tea unless they mean it. It’s been a long time, I grant you. Tea keeps.'], choices: [{ text: '~curious~ Have you seen anything strange lately?', goto: 'strange' }, { text: '~curious~ Where does the tea come from?', goto: 'tea', if: { quest: 'edena.terraces', started: false } }, { text: '~neutral~ Goodbye, Sol.', end: true }] },
        believe: { say: ['~playful~ That nothing that falls should be dug up again. Leaves, seeds, ships, old men. You let it lie and the garden makes something of it. Vey believes it hardest. I believe it on Tuesdays.'], choices: [{ text: '~curious~ Have you seen anything strange lately?', goto: 'strange' }] },
        strange: {
          say: ['~whisper~ The night the light passed. It went over very high, singing. A long note, like a finger round a glass. And every flower in the meadow turned to follow it, all at once, in the dark.', '~playful~ Talo had a name for a light like that. The Singer. He said it the way you’d say the name of someone who owes you money.'],
          do: { set: { 'edena.rumour.light': true } },
          choices: [{ text: '~neutral~ It struck my ship.', goto: 'struck' }, { text: '~neutral~ Goodbye, Sol.', end: true }],
        },
        struck: { say: ['~curious~ Did it. Hm. Then you and Talo have something to talk about, when he’s back for the tea.'], choices: [{ text: '~neutral~ Goodbye, Sol.', end: true }] },
        again: { say: ['~tired~ Any sign of them? No. Tea keeps.'], choices: [{ text: '~curious~ Tell me about the light again.', goto: 'strange' }, { text: '~curious~ Where does the tea come from?', goto: 'tea', if: { quest: 'edena.terraces', started: false } }, { text: '~neutral~ Goodbye, Sol.', end: true }] },
        after: { say: ['~sad~ Mira says you saw it, under the flowers. Then you know why they went. I always knew they’d go. I always know they’ll come back. Both can be true.'], choices: [{ text: '~solemn~ Both can be true.', end: true }] },
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
          say: ['~surprised~ Oh. Hello. I wasn’t expecting anyone to speak to me; nobody speaks to the pyramid man.', '~happy~ I’m Oro. The white pyramids in the meadow: people think the androids built them. They didn’t. They grew. From seeds. I grow them. Very slowly. My first one is up to my knee.'],
          choices: [
            { text: '~surprised~ Pyramids grow from seeds?', goto: 'seeds' },
            { text: '~curious~ Who were the androids?', goto: 'androids' },
          ],
        },
        seeds: {
          say: ['~neutral~ Of course. Little white ones, stepped, like the pyramid they’ll be. I had one ready to plant, and it rolled out of my hand and away downhill. Seeds always roll toward water. Toward the pond, then, *the far shore, west of where you landed*.'],
          choices: [{ text: '~happy~ I’ll look for it.', do: { start: 'edena.seed' }, goto: 'thanks' }, { text: '~neutral~ Maybe later.', end: true }],
        },
        androids: {
          say: ['~neutral~ The white builders. They made the ruins and the pedestals, and then they stopped. Nobody knows why. They found the pyramids already here and copied them, badly, with straight lines. The great spheres in the meadow were here before them too: those came down out of the sky, the old gardeners said, and the builders laid their garden out round them.', '~solemn~ They carved one mark on every ruin. {glyph} Three dots over an arc. We call it the Builders’ mark, though I think they copied it too: it is under every one of the spheres. They left nothing else written. Just that, everywhere, like a signature. Or an apology.', '~whisper~ Nothing else but the gifts: *blue chests with a pale star*, *up in the canopies* where only a climber goes. Builders’ gifts, we call them. The garden grows round them and never over.'],
          choices: [{ text: '~curious~ Pyramids grow from seeds, you said?', goto: 'seeds' }],
        },
        thanks: { say: ['~happy~ You will? *It glows a little when someone is near*; seeds like company. Bring it back and we’ll plant it together.'], choices: [{ text: '~happy~ Back soon.', end: true }] },
        waiting: { say: ['~neutral~ Toward water, always toward water. *The pond’s far shore*, west of where you landed. It glows a little when you’re near.'], choices: [{ text: '~neutral~ On my way.', end: true }] },
        back: {
          say: ['~happy~ My seed! You found it. Look at it, all its little steps.', '~whisper~ (He kneels and presses it into the meadow beside him, gently, the way you’d tuck someone in.)', '~playful~ *Now it needs water*. Not much. A splash, from that hand of yours.'],
          do: [{ take: 'seed' }, { advance: 'edena.seed' }, { set: { 'edena.seed.planted': true } }],
          choices: [{ text: '~playful~ (splash it)', end: true }],
        },
        water: { say: ['~neutral~ *A splash, there, on the seed*. Pyramids are thirsty when they’re small.'], choices: [{ text: '~playful~ (splash it)', end: true }] },
        after: { say: ['~surprised~ Look at it. Look at it grow! Well, it’s stopped now. That was a thousand years’ worth of growing for one splash. Your water is strange, traveller.'], choices: [{ text: '~playful~ It is.', end: true }] },
      },
    },
  },

  lio: {
    id: 'lio.edena', name: 'Lio', title: 'who climbs', color: '#b5a7e6', voice: 1.4, kind: 'f', scale: 0.86,
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
          say: ['~happy~ Climb the trees! The view is worth it. I’m Lio. I’ve climbed every tree in the garden except one.', '~sad~ *The tallest one, there, north-west*. I’ve been up the trunk to the second canopy, twice. But the crown floats on top on little branches, and you can’t climb a branch that thin, and I can’t jump that high.'],
          choices: [
            { text: '~curious~ What’s on the crown?', goto: 'what' },
            { text: '~playful~ I can jump quite high.', goto: 'jump' },
          ],
        },
        what: { say: ['~curious~ Nobody knows! Sol says Talo used to go up there, before he left. Sol says a lot of things. But from the second canopy I saw something on the crown, something square.'], choices: [{ text: '~neutral~ I’ll go and look.', do: { start: 'edena.tree' }, goto: 'go' }, { text: '~neutral~ Maybe later.', end: true }] },
        jump: { say: ['~surprised~ With that thing on your back? The fizzing one? Then go! *Climb the trunk to the second canopy*, run to the edge under the crown, and jump, and *jump again in the air*.'], choices: [{ text: '~neutral~ I’ll go and look.', do: { start: 'edena.tree' }, goto: 'go' }] },
        go: { say: ['~playful~ Tell me everything. If there’s treasure I want a third. A quarter. Some.'], choices: [{ text: '~playful~ Deal.', end: true }] },
        waiting: { say: ['~neutral~ *North-west, the tallest one*. Trunk, first canopy, trunk, second canopy, then up. And *jump again in the air*!'], choices: [{ text: '~neutral~ On my way.', end: true }] },
        tell: {
          say: ['~surprised~ You went up! You went UP! What was there?'],
          choices: [
            { text: '~neutral~ A bench, and a note from Talo. He watched the sky from up there.', do: { advance: ['edena.tree', 'tell'] }, goto: 'bench' },
            { text: '~neutral~ The whole garden, and the furrow the ship cut across it.', do: { advance: ['edena.tree', 'tell'] }, goto: 'view' },
          ],
        },
        bench: { say: ['~surprised~ A bench! He took a BENCH up there? Talo was the best climber in the world and nobody told me. I’m going to practise jumping until I can sit on it.'], choices: [{ text: '~happy~ You will.', end: true }] },
        view: { say: ['~curious~ The furrow! You can see it from up there? Like a long green stitch. That’s what Sol says. He says it’s the garden sewing up the cut.'], choices: [{ text: '~neutral~ It does look like that.', end: true }] },
        after: { say: ['~playful~ I jumped this high today. Well. This high. Still practising.'], choices: [{ text: '~happy~ Keep going.', end: true }] },
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
          say: ['~angry~ Stop there. Gently. You’re standing on a root.', '~tired~ I’m Vey. I tend the vines on Odile and Talo’s ship. Forty years now. When I started you could still see the paint.'],
          choices: [
            { text: '~neutral~ Mira said I should ask before I touch anything.', goto: 'ask' },
            { text: '~curious~ Why let the garden take it?', goto: 'why' },
          ],
        },
        why: { say: ['~solemn~ Because it fell. Everything that falls belongs to the ground. A leaf, a seed, a ship. You dig it up, you put it back in the world, and the world has to deal with it all over again. We let it rest.'], choices: [{ text: '~curious~ May I look at it?', goto: 'ask' }] },
        ask: {
          say: ['~happy~ Good. You asked. Most don’t; most just stare.', '~neutral~ You may look. You may go inside: the hatch is *on this flank, under the arch of flowers*. Going in isn’t digging. Talo used to sit in there and talk to the panel.', '~solemn~ *Don’t cut anything*. Don’t pull anything. If the garden wants to show you something, it will.'],
          do: { set: { 'edena.vey.asked': true } },
          choices: [{ text: '~neutral~ I won’t cut anything.', end: true }],
        },
        again: { say: ['~neutral~ *The hatch is on this flank*. Go in, gently. Come out the same way.'], choices: [{ text: '~whisper~ Gently.', end: true }] },
        pushed: { say: ['~angry~ You shoved the vines. I saw. They shoved back, didn’t they? The garden isn’t a door. *Ask it, or leave it*.'], choices: [{ text: '~sad~ Sorry, Vey.', end: true }] },
        opened: {
          say: ['~surprised~ It opened for you. Forty years I’ve tended those vines, and they never once drew aside for me.', '~curious~ I didn’t cut them, and you didn’t cut them, and they opened anyway. Hm. Maybe the garden thought you needed to see. *Go on, look*. Then let it close.'],
          choices: [{ text: '~solemn~ I’ll look, and let it close.', end: true }],
        },
        after: { say: ['~solemn~ The flowers are closing over it again. They’ll be thicker next spring. That’s how it should be.'], choices: [{ text: '~solemn~ That’s how it should be.', end: true }] },
        flood: {
          say: ['~angry~ I heard. You opened something the builders shut. You put it back in the world, and the world had to deal with it all over again.', '~solemn~ …And it is. That’s what the world does. Go and look at the mud in a month: it will be green at the edges.'],
          do: { set: { 'edena.vey.flood': true } },
          choices: [{ text: '~sad~ I only meant to help.', goto: 'floodMeant' }],
        },
        floodMeant: { say: ['~tired~ Everybody only means to help. Esk meant it too, when she asked you. Gently, next time. Gently is slower, and it is still help.'], choices: [{ text: '~solemn~ Gently.', end: true }] },
      },
    },
  },

  // the tea terraces (src/story/terraces.js): the quest you try, and fail
  esk: {
    id: 'esk', name: 'Esk', title: 'who keeps the tea terraces', color: '#9a7a4a', voice: 0.9, kind: 'f', scale: 0.98,
    palette: { cloak: '#c9a46a', lining: '#2b211f', cloth: '#5f8f5a', legs: '#5a4a3a', hat: '#f3ead8', hair: '#8a8a8a' }, head: 'wrap', cape: 0.8, look: { prop: 'basket' },
    lines: ['~tired~ Mind the bushes. They’re thirsty.', '~neutral~ Top row first. Always top row first.', '~sad~ The tips are going brown.'],
    linesAfter: ['~tired~ …', '~sad~ The sides held. The sides held.', '~solemn~ It belongs to the ground now.'],   // (after the flood: src/story/terraces.js)
    talk: {
      entry: [
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
          say: ['~tired~ Mind the bushes. They’re thirsty, and they’re in a mood about it. So am I.', '~neutral~ I’m Esk. I keep the tea terraces. The steps are the white builders’, straight as rulers; the bushes are ours. My grandmother’s grandmother planted the top row.'],
          choices: [
            { text: '~curious~ Why are they thirsty?', goto: 'dry' },
            { text: '~playful~ All the garden’s tea comes from here?', goto: 'teaAll' },
          ],
        },
        teaAll: { say: ['~happy~ Every cup. Sol drinks most of it. Mira says it’s always time for tea, and she’s right, and this is where it comes from.'], choices: [{ text: '~curious~ And why are they thirsty?', goto: 'dry' }] },
        dry: {
          say: ['~sad~ The spring under the top terrace used to run all year. The night the light passed, it dropped to a trickle, and the runnels silted up. Look at the tips: brown.', '~neutral~ I can’t clear them without standing in the beds. You could, with that hand of yours, from the path. *Three clods of silt. Top terrace first*, or the mud only runs down into the next one.'],
          choices: [
            { text: '~neutral~ I’ll clear them.', do: (ctx) => { const q = ctx.quests; if (!q.isStarted('edena.terraces')) q.start('edena.terraces', 'runnels'); else q.advance('edena.terraces', 'esk'); ctx.game.set('edena.esk.asked', true); }, goto: 'thanks' },
            { text: '~neutral~ Maybe later.', end: true },
          ],
        },
        thanks: { say: ['~happy~ Bless you. *Shove them out*: a push, from the path. And *top first*. The water has to have somewhere to go.'], choices: [{ text: '~neutral~ Top first.', end: true }] },
        runnels: { say: ['~neutral~ *Top terrace first*. Shove the clod out of the runnel, then the one below, then the one below that. The water has to have somewhere to go.'], choices: [{ text: '~neutral~ On it.', end: true }] },
        ask: {
          say: ['~happy~ Listen. Hear that? Water in the runnels. First time since the light.', '~sad~ …It’s not enough, though. A trickle. The bottom rows won’t see a drop of it before the summer.', '~solemn~ Up on top there’s *the builders’ cistern*, behind their gate. It’s full; you can hear it if you put your ear to the stone. They shut it before anyone here was born, and nobody has touched it since. We don’t open what isn’t ours.'],
          choices: [
            { text: '~curious~ Do you want me to open it?', goto: 'askGate' },
            { text: '~neutral~ Then we leave it shut.', goto: 'leave' },
          ],
        },
        leave: {
          say: ['~tired~ …Yes. We leave it. And the bottom rows brown, and next year there’s a little less tea, and the year after.', '~angry~ Oh, I hate being wise. No. It isn’t digging. It isn’t something that fell. It’s a door, and doors are for opening.'],
          next: 'askGate',
        },
        askGate: {
          say: ['~scared~ …', '~solemn~ Yes. Open it. Gently. *A little*. Roots have grown through its wheel: *water them so they let go*, the way you’d ask, not cut. Then *one turn of the wheel*. One. Just enough to wet the top row.'],
          do: [{ advance: ['edena.terraces', 'ask'] }, { set: { 'edena.esk.gate': true } }],
          choices: [{ text: '~neutral~ One turn.', end: true }],
        },
        go: { say: ['~neutral~ *The wheel on the builders’ gate*, up on the cistern. Water the roots first. Then one turn. A little, traveller. I mean it.'], choices: [{ text: '~neutral~ A little.', end: true }] },
        flood: { say: ['~scared~ Shut it! Can you shut it? No. No, it’s gone. Get off the slope!'], choices: [{ text: '~scared~ (get back)', end: true }] },
        sorry: {
          say: ['~angry~ (She doesn’t look at you. She is looking at where the middle of the terraces was.)', '~angry~ I said a little. I said one turn.'],
          choices: [
            { text: '~sad~ I only turned it once.', goto: 'once' },
            { text: '~sad~ I’m sorry, Esk.', goto: 'sorry2' },
          ],
        },
        once: {
          say: ['~angry~ I know. I watched you. I know it was once.', '~angry~ And I asked you to. I know that too. I’m still angry with you. I’m allowed to be both.'],
          choices: [{ text: '~sad~ I’m sorry, Esk.', goto: 'sorry2' }],
        },
        sorry2: {
          say: ['~tired~ …', '~sad~ My mother planted the second row. The bottom one we put in the spring Sol’s knees went. It took the builders’ wall with it. A thousand years, that wall.', '~solemn~ I know you are. I can see you are.'],
          next: 'okay',
        },
        okay: {
          say: ['~solemn~ It’s all right. It isn’t, but it will be. It fell; it belongs to the ground now. That’s what we say about everything. I never thought I’d have to say it about my own hill.', '~neutral~ Go on, traveller. There’s nothing here for you to mend. That’s the hard part, I know.'],
          do: { fail: 'edena.terraces' },
          choices: [{ text: '~sad~ (go)', end: true }],
        },
        after: {
          say: [
            { if: { not: { flag: 'edena.esk.after' } }, text: '~tired~ The mud’s already greening at the edges. The bushes at the sides took it. Give it a few years, and a lot of mornings without tea.' },
            { if: { flag: 'edena.esk.after' }, text: '~neutral~ Sol says tea keeps. For once, Sol is right.' },
          ],
          do: { set: { 'edena.esk.after': true } },
          choices: [{ text: '~sad~ (nod)', end: true }],
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
        say: ['~tired~ The panel wakes when you touch it, slowly, as if from a long sleep. A woman’s voice, tired and amused: *Odile’s log. Day ninety-one of the crossing.*', '~curious~ *Talo says the hull is ringing. There’s a light pacing us off the port bow, and it’s… singing. I can hear it through the walls. It’s beautiful, actually. Talo doesn’t think so.*', '~scared~ *It’s turning. It’s coming about toward us. Talo, are you…* The recording stops.'],
        next: 'talo',
      },
      talo: {
        say: ['~happy~ A second entry, later. A man’s voice, with birds behind it: *Talo. We’re down, both of us, alive. The people here are gardeners. They’ve given us tea and a great deal of advice about not digging.*', '~curious~ *Odile wants to mend the ship. I want to understand what hit us. It left a mark on the hull where it struck. I’ve seen that mark before, on the white ruins in the meadow.*', '~solemn~ *We’re taking the little saucer. If it comes back, we’d rather meet it than wait for it. Whoever finds this: look under the flowers on the flank. Look, and then let it be.*'],
        do: { set: { 'edena.log.read': true } },
        choices: [{ text: '~whisper~ (let the panel sleep)', end: true }],
      },
    } },
  },
  scar: {
    id: 'scar', name: 'Under the flowers', title: 'the ship’s flank', color: '#54433b', voice: 1.5,
    talk: { nodes: {
      look: {
        say: ['~solemn~ Under the drawn-back vines the hull is scorched, a halo of brown with soot running down from it like old tears. In the middle, burned deep into the plating: three dots over an arc.'],
        next: 'mine',
      },
      mine: {
        speaker: 'player',
        say: ['~surprised~ It’s the same mark. The same burn that’s on my ship’s hull. Not like it: the same.', '~scared~ Whatever struck me struck them first. A long time before me.'],
        do: { set: { 'edena.scar.seen': true } },
        choices: [{ text: '~solemn~ (let the flowers close)', end: true }],
      },
    } },
  },
  lookout: {
    id: 'lookout', name: 'Talo’s lookout', title: 'on the tallest tree’s crown', color: '#b5a7e6', voice: 0.75,
    talk: { nodes: {
      note: {
        say: ['~neutral~ A bench, worn smooth, facing east. On a post beside it someone has carved three dots over an arc, small and careful, and pinned a folded note under it.', '~solemn~ *From here I can watch the east, where it came from. Odile says it won’t come back. I say it turned once, it can turn again. If it does, I want to see it first. — T.*', '~sad~ Below, the whole garden. Across the south meadow runs a long green line, greener than the rest: the furrow the ship cut, grown over.'],
        do: { set: { 'edena.lookout.read': true } },
        choices: [{ text: '~curious~ (watch the east for a while)', end: true }],
      },
    } },
  },
};
