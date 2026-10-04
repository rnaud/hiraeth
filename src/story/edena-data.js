// Edena's story as data: "The Garden Grows Over" (docs/story-bible.md).
//
// Long ago Stel and Atan's ship fell in the south meadow. The gardeners took
// them in, gave them tea and a great deal of advice about not digging, and
// let the garden take the ship: they believe nothing that falls should be dug
// up again. Stel and Atan left one spring in their little saucer, "toward the
// deep wood where the lamps are kept" (Perdide II, where the saucer lies).
//
// The reveal, kept quiet and in the traveller's own hands: the ship's last
// log (a singing light paced them, turned, and struck), Atan's request ("look
// under the flowers on the starboard side; look, and then let it be"), and
// the veil of vines over the hull that parts when you water it rather than
// cut it. Under it is the scorch: three dots over an arc, exactly the mark
// on the traveller's own hull. Their ship was not the first. Nobody explains
// the light; Mira only says what the gardeners do with things that fall.
//
// Flags (game-state.js): edena.* below; clue.edena.struck (the same light
// struck them), clue.edena.pod (they left in the saucer for the deep wood).

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
      { id: 'ship', text: 'Find Stel and Atan’s ship, fallen in the south meadow', label: 'The fallen ship', goto: 'ship', radius: 45, at: 'ship' },
      { id: 'vey', text: 'Vey tends the vines over the ship. Ask before you touch anything', label: 'Vey, by the ship', flag: 'edena.vey.asked', at: 'vey' },
      { id: 'inside', text: 'Go in through the hatch on the ship’s flank', label: 'The overgrown hatch', flag: 'edena.cabin.seen', at: 'hatch' },
      { id: 'log', text: 'Play the ship’s last log at the cockpit panel', label: 'The cockpit panel', flag: 'edena.log.read', at: 'panel' },
      { id: 'veil', text: 'Look under the flowers on the ship’s flank, as Atan asked. Don’t cut them: water them (shoot)', label: 'The flowers on the flank', flag: 'edena.veil.open', at: 'veil' },
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
    palette: { cloak: '#f7f4ec', lining: '#2b211f', cloth: '#62c3c9', legs: '#7f9a90', hat: '#9fd6c9', hair: '#3d2a22', face: '#dfe8ec' }, head: 'wrap', cape: 1.1,
    lines: ['We tend the garden. The garden tends us.', 'The clock says it is time for tea. It always says that.', 'Mind the flowers. They mind you.'],
    talk: {
      entry: [
        { if: { quest: Q, done: true }, node: 'after' },
        { if: { quest: Q, stage: 'tell' }, node: 'tell' },
        { if: { flag: 'edena.mira.heard' }, node: 'again' },
        { node: 'hello' },
      ],
      nodes: {
        hello: {
          say: ['A ball fell into the meadow and a person came out of it. That is twice in my life. I’m Mira. I keep the water clock, which mostly means I keep it company.', 'You’ll want to know where you are. This is the garden. We tend it. That is all there is to know, and it takes a lifetime.'],
          choices: [
            { text: 'Twice? Something else fell here?', goto: 'twice' },
            { text: 'Who tends it?', goto: 'who' },
            { text: 'I’m looking for something of value.', goto: 'value' },
          ],
        },
        who: { say: ['The gardeners. Us. And the garden, which tends us back. There were others before us, the white builders who left the ruins and the pedestals. They tended it with straight lines. We prefer curved ones.'], choices: [{ text: 'Something else fell here, you said?', goto: 'twice' }] },
        value: { say: ['Then you’ve come to the wrong garden, or the right one. We don’t keep anything. Everything here is on its way to being something else.'], choices: [{ text: 'You said something else fell here?', goto: 'twice' }] },
        twice: {
          say: ['A ship, long ago, when I was small. Stel and Atan’s. It came down in the south meadow, burning, and ploughed a furrow you can still see from the tall trees.', 'They lived. We gave them tea. They stayed one spring, and then they left, and we let the garden take the ship. We don’t dig up what falls. It fell; it belongs to the ground now.'],
          do: { set: { 'edena.mira.heard': true } },
          choices: [
            { text: 'Can I see it?', goto: 'see' },
            { text: 'Where did they go?', goto: 'went' },
          ],
        },
        went: { say: ['Away, in the little round boat they kept inside the big one. Sol will tell you they’re coming back. Sol tells everyone that.'], choices: [{ text: 'Can I see their ship?', goto: 'see' }] },
        see: { say: ['Seeing isn’t digging. Go south, past the pond, where the meadow dips. Vey tends the vines there. Ask her before you touch anything; the vines are hers more than anyone’s.'], choices: [{ text: 'I’ll ask her.', end: true }] },
        again: {
          say: [
            { if: { flag: 'edena.log.read' }, text: 'You went inside. I can tell; everyone comes out of that ship walking more slowly.' },
            { if: { not: { flag: 'edena.log.read' } }, text: 'South, past the pond, where the meadow dips. Vey will be with the vines.' },
          ],
          choices: [
            { text: 'What is the water clock for?', goto: 'clock', once: true },
            { text: 'Where did Stel and Atan go?', goto: 'went' },
            { text: 'See you, Mira.', end: true },
          ],
        },
        clock: { say: ['For knowing when to water. It drips, the bowl fills, it tips, a bell rings: water the garden. Its gear has been worn smooth for years. It still rings. Mostly.'], choices: [{ text: 'See you, Mira.', end: true }] },
        tell: {
          say: ['You’ve been under the flowers. I can see it in how you’re standing.'],
          choices: [
            { text: 'There’s a scorch on their hull: three dots over an arc.', goto: 'mark' },
            { text: 'My ship has the same mark. Something struck it, on the way here.', goto: 'same' },
          ],
        },
        mark: { say: ['Yes. We knew it was there. Atan showed us, the first spring. Then he asked us to let the garden have it, and we did. We’re good at that.'], choices: [{ text: 'My ship has the same mark. Something struck it, on the way here.', goto: 'same' }] },
        same: {
          say: ['…', 'Then it wasn’t only theirs.', 'Atan called it the Singer. A light that sang as it came, and turned before it struck, as if it had been looking for something. They never learned what it was. That’s why they left: to go and ask it.'],
          do: { set: { 'clue.edena.struck': true } },
          choices: [{ text: 'Where did they go to ask?', goto: 'where' }, { text: 'What does it want?', goto: 'want' }],
        },
        where: { say: ['Toward the deep wood where the lamps are kept, Atan said. Where the pools are lit for travellers who never come. I’ve never been. Nobody here has.'], do: { set: { 'clue.edena.pod': true } }, choices: [{ text: 'What does it want?', goto: 'want' }] },
        want: {
          say: ['I don’t know. Nobody here does. I don’t think the light is ours to know.', 'But I know what we do with the things that fall on us. We tend the garden. The garden tends us.'],
          do: [{ advance: [Q, 'tell'] }, { keepsake: KEEPSAKE }, { set: { 'clue.edena.pod': true } }],
          next: 'carry',
        },
        carry: { say: ['Take that with you. It isn’t heavy. It fits in any ship.'], choices: [{ text: 'Thank you, Mira.', end: true }] },
        after: { say: ['The clock rang while you were away. Time to water. It’s always time to water.'], choices: [{ text: 'I’ll let you water.', end: true }] },
      },
    },
  },

  sol: {
    id: 'sol', name: 'Sol', title: 'who remembers them', color: '#9fd6c9', voice: 0.85, kind: 'm',
    palette: { cloak: '#9fd6c9', lining: '#2b211f', cloth: '#f7f4ec', legs: '#5a6a6a', hat: '#f2a7b5', hair: '#e8dcc0' }, head: 'hat', cape: 0.9,
    lines: ['Stel? Atan? They left in the ship.', 'They’ll be back for the tea.', 'Every flower turned east. Every one.'],
    talk: {
      entry: [{ if: { quest: Q, done: true }, node: 'after' }, { if: { flag: 'met.sol' }, node: 'again' }, { node: 'hello' }],
      nodes: {
        hello: {
          say: ['Stel? Atan? They left in the ship. The little one, I mean; the big one stayed. You’re not them, are you? No. They’d have brought cake.', 'I’m Sol. I knew them, when I was young enough to follow them about. Atan let me hold his tools. Stel let me hold Atan, when he fell off things.'],
          choices: [
            { text: 'Are they coming back?', goto: 'back' },
            { text: 'Have you seen anything strange lately?', goto: 'strange' },
            { text: 'What does the garden believe?', goto: 'believe' },
          ],
        },
        back: { say: ['Of course. They said they’d be back for the tea, and nobody says that about tea unless they mean it. It’s been a long time, I grant you. Tea keeps.'], choices: [{ text: 'Have you seen anything strange lately?', goto: 'strange' }, { text: 'Goodbye, Sol.', end: true }] },
        believe: { say: ['That nothing that falls should be dug up again. Leaves, seeds, ships, old men. You let it lie and the garden makes something of it. Vey believes it hardest. I believe it on Tuesdays.'], choices: [{ text: 'Have you seen anything strange lately?', goto: 'strange' }] },
        strange: {
          say: ['Three nights ago, a light went over, very high. Singing. A long note, like a finger round a glass. And every flower in the meadow turned to follow it, all at once, in the dark.', 'Atan had a name for a light like that. The Singer. He said it the way you’d say the name of someone who owes you money.'],
          do: { set: { 'edena.rumour.light': true } },
          choices: [{ text: 'It struck my ship.', goto: 'struck' }, { text: 'Goodbye, Sol.', end: true }],
        },
        struck: { say: ['Did it. Hm. Then you and Atan have something to talk about, when he’s back for the tea.'], choices: [{ text: 'Goodbye, Sol.', end: true }] },
        again: { say: ['Any sign of them? No. Tea keeps.'], choices: [{ text: 'Tell me about the light again.', goto: 'strange' }, { text: 'Goodbye, Sol.', end: true }] },
        after: { say: ['Mira says you saw it, under the flowers. Then you know why they went. I always knew they’d go. I always know they’ll come back. Both can be true.'], choices: [{ text: 'Both can be true.', end: true }] },
      },
    },
  },

  oro: {
    id: 'oro', name: 'Oro', title: 'who grows pyramids', color: '#f2a7b5', voice: 0.95, kind: 'm',
    palette: { cloak: '#f2a7b5', lining: '#2b211f', cloth: '#f3ead8', legs: '#5a4a40', hat: '#f3ead8', hair: '#2b211f' }, head: 'wrap', cape: 0.7,
    lines: ['The pyramids are older than the androids.', 'Slowly. Pyramids grow slowly.', 'Have you seen a little white seed?'],
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
          say: ['Oh. Hello. I wasn’t expecting anyone to speak to me; nobody speaks to the pyramid man.', 'I’m Oro. The white pyramids in the meadow: people think the androids built them. They didn’t. They grew. From seeds. I grow them. Very slowly. My first one is up to my knee.'],
          choices: [
            { text: 'Pyramids grow from seeds?', goto: 'seeds' },
            { text: 'Who were the androids?', goto: 'androids' },
          ],
        },
        seeds: {
          say: ['Of course. Little white ones, stepped, like the pyramid they’ll be. I had one ready to plant, and it rolled out of my hand and away downhill. Seeds always roll toward water. Toward the pond, then, the far shore, west of where you landed.'],
          choices: [{ text: 'I’ll look for it.', do: { start: 'edena.seed' }, goto: 'thanks' }, { text: 'Maybe later.', end: true }],
        },
        androids: {
          say: ['The white builders. They made the ruins and the pedestals and the perfect spheres, and then they stopped. Nobody knows why. They found the pyramids already here and copied them, badly, with straight lines.', 'They carved one mark on every ruin. {glyph} Three dots over an arc. We call it the Builders’ mark. They left nothing else written. Just that, everywhere, like a signature. Or an apology.'],
          choices: [{ text: 'Pyramids grow from seeds, you said?', goto: 'seeds' }],
        },
        thanks: { say: ['You will? It glows a little when someone is near; seeds like company. Bring it back and we’ll plant it together.'], choices: [{ text: 'Back soon.', end: true }] },
        waiting: { say: ['Toward water, always toward water. The pond’s far shore, west of where you landed. It glows a little when you’re near.'], choices: [{ text: 'On my way.', end: true }] },
        back: {
          say: ['My seed! You found it. Look at it, all its little steps.', '(He kneels and presses it into the meadow beside him, gently, the way you’d tuck someone in.)', 'Now it needs water. Not much. A splash, from that hand of yours.'],
          do: [{ take: 'seed' }, { advance: 'edena.seed' }, { set: { 'edena.seed.planted': true } }],
          choices: [{ text: '(splash it)', end: true }],
        },
        water: { say: ['A splash, there, on the seed. Pyramids are thirsty when they’re small.'], choices: [{ text: '(splash it)', end: true }] },
        after: { say: ['Look at it. Look at it grow! Well, it’s stopped now. That was a thousand years’ worth of growing for one splash. Your water is strange, traveller.'], choices: [{ text: 'It is.', end: true }] },
      },
    },
  },

  lio: {
    id: 'lio', name: 'Lio', title: 'who climbs', color: '#b5a7e6', voice: 1.4, kind: 'f', scale: 0.86,
    palette: { cloak: '#b5a7e6', lining: '#2b211f', cloth: '#f2c54b', legs: '#4a3a2a', hat: '#f2a7b5', hair: '#6e4a32' }, head: 'hair', cape: 0.5,
    lines: ['Climb the trees. The view is worth it.', 'I’ve been to the second canopy. Twice!', 'The crown floats. It FLOATS.'],
    talk: {
      entry: [
        { if: { quest: 'edena.tree', done: true }, node: 'after' },
        { if: { flag: 'edena.lookout.read' }, node: 'tell' },
        { if: { quest: 'edena.tree', active: true }, node: 'waiting' },
        { node: 'hello' },
      ],
      nodes: {
        hello: {
          say: ['Climb the trees! The view is worth it. I’m Lio. I’ve climbed every tree in the garden except one.', 'The tallest one, there, north-west. I’ve been up the trunk to the second canopy, twice. But the crown floats on top on little branches, and you can’t climb a branch that thin, and I can’t jump that high.'],
          choices: [
            { text: 'What’s on the crown?', goto: 'what' },
            { text: 'I can jump quite high.', goto: 'jump' },
          ],
        },
        what: { say: ['Nobody knows! Sol says Atan used to go up there, before he left. Sol says a lot of things. But from the second canopy I saw something on the crown, something square.'], choices: [{ text: 'I’ll go and look.', do: { start: 'edena.tree' }, goto: 'go' }, { text: 'Maybe later.', end: true }] },
        jump: { say: ['With that thing on your back? The fizzing one? Then go! Climb the trunk to the second canopy, run to the edge under the crown, and jump, and jump again in the air.'], choices: [{ text: 'I’ll go and look.', do: { start: 'edena.tree' }, goto: 'go' }] },
        go: { say: ['Tell me everything. If there’s treasure I want a third. A quarter. Some.'], choices: [{ text: 'Deal.', end: true }] },
        waiting: { say: ['North-west, the tallest one. Trunk, first canopy, trunk, second canopy, then up. And jump again in the air!'], choices: [{ text: 'On my way.', end: true }] },
        tell: {
          say: ['You went up! You went UP! What was there?'],
          choices: [
            { text: 'A bench, and a note from Atan. He watched the sky from up there.', do: { advance: ['edena.tree', 'tell'] }, goto: 'atan' },
            { text: 'The whole garden, and the furrow the ship cut across it.', do: { advance: ['edena.tree', 'tell'] }, goto: 'view' },
          ],
        },
        atan: { say: ['A bench! He took a BENCH up there? Atan was the best climber in the world and nobody told me. I’m going to practise jumping until I can sit on it.'], choices: [{ text: 'You will.', end: true }] },
        view: { say: ['The furrow! You can see it from up there? Like a long green stitch. That’s what Sol says. He says it’s the garden sewing up the cut.'], choices: [{ text: 'It does look like that.', end: true }] },
        after: { say: ['I jumped this high today. Well. This high. Still practising.'], choices: [{ text: 'Keep going.', end: true }] },
      },
    },
  },

  vey: {
    id: 'vey', name: 'Vey', title: 'who tends the vines', color: '#7fcfa8', voice: 0.8, kind: 'f', scale: 1.02,
    palette: { cloak: '#7fcfa8', lining: '#2b211f', cloth: '#f7f4ec', legs: '#4a5a3a', hat: '#f7f4ec', hair: '#e8dcc0' }, head: 'hood', cape: 1.4,
    lines: ['Don’t cut anything.', 'It fell. It belongs to the ground now.', 'Gently.'],
    talk: {
      entry: [
        { if: { quest: Q, done: true }, node: 'after' },
        { if: { flag: 'edena.veil.open' }, node: 'opened' },
        { if: { flag: 'edena.veil.pushed' }, node: 'pushed' },
        { if: { flag: 'edena.vey.asked' }, node: 'again' },
        { node: 'hello' },
      ],
      nodes: {
        hello: {
          say: ['Stop there. Gently. You’re standing on a root.', 'I’m Vey. I tend the vines on Stel and Atan’s ship. Forty years now. When I started you could still see the paint.'],
          choices: [
            { text: 'Mira said I should ask before I touch anything.', goto: 'ask' },
            { text: 'Why let the garden take it?', goto: 'why' },
          ],
        },
        why: { say: ['Because it fell. Everything that falls belongs to the ground. A leaf, a seed, a ship. You dig it up, you put it back in the world, and the world has to deal with it all over again. We let it rest.'], choices: [{ text: 'May I look at it?', goto: 'ask' }] },
        ask: {
          say: ['Good. You asked. Most don’t; most just stare.', 'You may look. You may go inside: the hatch is on this flank, under the arch of flowers. Going in isn’t digging. Atan used to sit in there and talk to the panel.', 'Don’t cut anything. Don’t pull anything. If the garden wants to show you something, it will.'],
          do: { set: { 'edena.vey.asked': true } },
          choices: [{ text: 'I won’t cut anything.', end: true }],
        },
        again: { say: ['The hatch is on this flank. Go in, gently. Come out the same way.'], choices: [{ text: 'Gently.', end: true }] },
        pushed: { say: ['You shoved the vines. I saw. They shoved back, didn’t they? The garden isn’t a door. Ask it, or leave it.'], choices: [{ text: 'Sorry, Vey.', end: true }] },
        opened: {
          say: ['It opened for you. Forty years I’ve tended those vines, and they never once drew aside for me.', 'I didn’t cut them, and you didn’t cut them, and they opened anyway. Hm. Maybe the garden thought you needed to see. Go on, look. Then let it close.'],
          choices: [{ text: 'I’ll look, and let it close.', end: true }],
        },
        after: { say: ['The flowers are closing over it again. They’ll be thicker next spring. That’s how it should be.'], choices: [{ text: 'That’s how it should be.', end: true }] },
      },
    },
  },
};

// The scenery you can look at: same panel, a different voice.
export const THINGS = {
  log: {
    id: 'log', name: 'The ship’s log', title: 'at the cockpit panel', color: '#34405e', voice: 0.75,
    talk: { nodes: {
      stel: {
        say: ['The panel wakes when you touch it, slowly, as if from a long sleep. A woman’s voice, tired and amused: *Stel’s log. Day ninety-one of the crossing.*', '*Atan says the hull is ringing. There’s a light pacing us off the port bow, and it’s… singing. I can hear it through the walls. It’s beautiful, actually. Atan doesn’t think so.*', '*It’s turning. It’s coming about toward us. Atan, are you…* The recording stops.'],
        next: 'atan',
      },
      atan: {
        say: ['A second entry, later. A man’s voice, with birds behind it: *Atan. We’re down, both of us, alive. The people here are gardeners. They’ve given us tea and a great deal of advice about not digging.*', '*Stel wants to mend the ship. I want to understand what hit us. It left a mark on the hull where it struck. I’ve seen that mark before, on the white ruins in the meadow.*', '*We’re taking the little saucer. If it comes back, we’d rather meet it than wait for it. Whoever finds this: look under the flowers on the flank. Look, and then let it be.*'],
        do: { set: { 'edena.log.read': true } },
        choices: [{ text: '(let the panel sleep)', end: true }],
      },
    } },
  },
  scar: {
    id: 'scar', name: 'Under the flowers', title: 'the ship’s flank', color: '#54433b', voice: 1.5,
    talk: { nodes: {
      look: {
        say: ['Under the drawn-back vines the hull is scorched, a halo of brown with soot running down from it like old tears. In the middle, burned deep into the plating: three dots over an arc.'],
        next: 'mine',
      },
      mine: {
        speaker: 'player',
        say: ['It’s the same mark. The same burn that’s on my ship’s hull. Not like it: the same.', 'Whatever struck me struck them first. A long time before me.'],
        do: { set: { 'edena.scar.seen': true } },
        choices: [{ text: '(let the flowers close)', end: true }],
      },
    } },
  },
  lookout: {
    id: 'lookout', name: 'Atan’s lookout', title: 'on the tallest tree’s crown', color: '#b5a7e6', voice: 0.75,
    talk: { nodes: {
      note: {
        say: ['A bench, worn smooth, facing east. On a post beside it someone has carved three dots over an arc, small and careful, and pinned a folded note under it.', '*From here I can watch the east, where it came from. Stel says it won’t come back. I say it turned once, it can turn again. If it does, I want to see it first. — A.*', 'Below, the whole garden. Across the south meadow runs a long green line, greener than the rest: the furrow the ship cut, grown over.'],
        do: { set: { 'edena.lookout.read': true } },
        choices: [{ text: '(watch the east for a while)', end: true }],
      },
    } },
  },
};
