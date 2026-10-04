// Perdide's story as data: "The Great Crystal" (docs/story-bible.md).
//
// The Great Crystal stands on its island east of the landing, over the ford.
// It hums all day and sings when it rains, and while it sings every
// carnivorous plant in the swamp shuts its mouth. The swamp people say it is
// a piece of something that fell. Old Saba, who has listened at its foot for
// forty years, knows its 212 phrases; the traveller's tank makes it hum
// louder. Bring it rain (wait for a shower, or splash it with the fluid) and
// it sings a 213th phrase nobody has heard: the song of the light that sang
// as it struck the ship. A splinter shakes loose; carried to the crystal cave
// on the western island, it sets the cave's crystals singing and tunes itself
// to the tank (a new colour band): a crystal splinter that harmonises with
// the tank.
//
// The glyph here is "the Hush": three drops of rain over a shut mouth. You
// paint it on anything you don't want eaten.
//
// Conversations: src/story/dialogue.js. Quests: src/story/quests.js.
// Flags (game-state.js): perdide.* (see src/story/perdide.js).

const Q = 'perdide.crystal';

export const ITEMS = { splinter: 'a singing splinter', jar: 'a jar of fireflies' };

// ------------------------------------------------------------------ quests
export const QUESTS = [
  {
    id: Q, title: 'The Great Crystal', world: 'perdide', main: true,
    outro: 'The splinter hums with your tank. The crystal remembers the light that struck your ship.',
    stages: [
      { id: 'wendel', text: 'Something hums in the east. Ask Wendel, the egg-warden at the landing', label: 'Wendel, the egg-warden', flag: 'perdide.wendel.heard', at: 'wendel' },
      { id: 'cross', text: 'Cross to the Great Crystal: south over the hill, then east through the ford', label: 'The Great Crystal', goto: 'crystalFoot', radius: 30 },
      { id: 'saba', text: 'Talk to Saba, who listens at the crystal’s foot', label: 'Saba, the Listener', flag: 'perdide.saba.heard', at: 'saba' },
      { id: 'sing', text: 'The crystal sings in the rain. Wait for a shower, or splash its spires with your fluid', label: 'The Great Crystal', flag: 'perdide.crystal.sung', at: 'crystal' },
      { id: 'listen', text: 'Ask Saba about the phrase it has never sung before', label: 'Saba, the Listener', flag: 'perdide.clue.ship', at: 'saba' },
      { id: 'splinter', text: 'Pick up the splinter the song shook loose', label: 'The fallen splinter', flag: 'perdide.splinter.taken', at: 'splinter' },
      { id: 'cave', text: 'Carry the splinter to the crystal cave on the western island (whistle for the skiff)', label: 'The heart of the crystal cave', flag: 'perdide.heart.rung', at: 'heart' },
    ],
  },
  {
    id: 'perdide.patience', title: 'Feed Nothing', world: 'perdide',
    outro: 'The patient are never eaten. The plants know you now.',
    stages: [
      { id: 'bed', text: 'Go and stand in the snapping bed on the landing’s north shore', label: 'The snapping bed', goto: 'bed', radius: 4 },
      { id: 'wait', text: 'Stand among the plants and feed them nothing. Don’t splash them; let them tire of you', label: 'The snapping bed', flag: 'perdide.patience.kept', at: 'bed' },
      { id: 'tell', text: 'Tell Wendel the plants have let you be', label: 'Wendel, the egg-warden', talk: 'wendel', at: 'wendel' },
    ],
  },
  {
    id: 'perdide.fireflies', title: 'Follow the Fireflies', world: 'perdide',
    outro: 'The fireflies hatch from the glowing eggs. Some of them follow you now.',
    stages: [
      { id: 'follow', text: 'Follow Ivo’s fireflies across the water (they wait if you fall behind)', label: 'The fireflies', flag: 'perdide.fireflies.home', at: 'fireflies' },
      { id: 'ivo', text: 'Tell Ivo where the fireflies go', label: 'Ivo, on the cave island', talk: 'ivo', at: 'ivo' },
    ],
  },
];

// palettes: cloak / cloth / legs / hat / hair (buildCharacter + Humanoid)
const P = (cloak, cloth, extra = {}) => ({ cloak, lining: '#2b211f', cloth, legs: '#2f3a4f', ...extra });

// ------------------------------------------------------------------ the people at the landing
// These three are the level's own people (CONTENT.perdide.npcs, src/levels/perdide.js): their
// order matters (the errands use it) and so does their kind (spawnNPCs: even m, odd f).
export const LANDING = [
  {
    at: [-10, -14], radius: 2, palette: P('#8a6fb8', '#3f5a4a'), look: { prop: 'basket' },
    lines: ['~neutral~ Don’t feed the plants.', '~neutral~ The crystals hum when it rains.', '~playful~ Mind the eggs. They’re warm for a reason.'],
    id: 'wendel', name: 'Wendel', title: 'egg-warden', color: '#8a6fb8', voice: 0.85,
    talk: {
      entry: [
        { if: { quest: 'perdide.patience', stage: 'tell' }, node: 'patient' },
        { if: { quest: Q, done: true }, node: 'after' },
        { if: { flag: 'perdide.wendel.heard' }, node: 'again' },
        { node: 'hello' },
      ],
      nodes: {
        hello: {
          say: ['~playful~ You came down out of the sky in a ball and you didn’t land in the deep water. That’s more sense than most visitors show.', '~happy~ I’m Wendel. I keep the eggs warm and the plants hungry.'],
          choices: [
            { text: '~curious~ What eggs?', goto: 'eggs' },
            { text: '~curious~ Why keep the plants hungry?', goto: 'plants' },
            { text: '~neutral~ Something is humming, out east.', goto: 'hum' },
            { text: '~neutral~ I’m looking for something of value.', goto: 'value' },
          ],
        },
        eggs: {
          say: [{ if: { not: { quest: 'perdide.fireflies', done: true } }, text: '~tired~ Every clutch in the swamp glows. I’ve kept them warm thirty years, and not one has ever hatched. I don’t mind. Somebody has to keep the warm things warm.' },
            { if: { quest: 'perdide.fireflies', done: true }, text: '~surprised~ Ivo says they hatch. Into fireflies. Thirty years I’ve kept them warm, and they were hatching under my nose every dusk. I’ve had to sit down twice today.' }],
          choices: [{ text: '~curious~ And the plants?', goto: 'plants' }, { text: '~curious~ What hums in the east?', goto: 'hum' }],
        },
        plants: {
          say: ['~neutral~ The jaws. They snap at anything that moves and anything that’s thrown at them. Corm feeds them; he says a fed plant guards the eggs.', '~solemn~ I say the patient are never eaten.'],
          choices: [
            { text: '~curious~ What do you mean, the patient?', goto: 'patience', if: { quest: 'perdide.patience', started: false } },
            { text: '~curious~ What hums in the east?', goto: 'hum' },
            { text: '~neutral~ Goodbye, Wendel.', end: true },
          ],
        },
        patience: {
          say: ['~neutral~ There’s a bed of them by the north shore, past the water’s edge. Go and stand in it. Don’t run, don’t splash them with that coloured water of yours. Feed them nothing.', '~neutral~ Let them snap at the air until they’re bored of you. Then they’ll know you, and they won’t snap again.'],
          do: { start: 'perdide.patience' },
          choices: [{ text: '~neutral~ I’ll try it.', end: true }, { text: '~curious~ And what hums in the east?', goto: 'hum' }],
        },
        hum: {
          say: ['~neutral~ The Great Crystal. East, over the hill and through the ford; you can walk it if you don’t mind wet knees. It hums all day.', '~solemn~ When it rains, it sings, and every jaw in the swamp shuts while it does. Old Saba sits at its foot and listens. She says it fell.'],
          do: { set: { 'perdide.wendel.heard': true } },
          choices: [
            { text: '~curious~ Fell from where?', goto: 'fell' },
            { text: '~curious~ What’s that mark on your staff?', goto: 'glyph' },
            { text: '~neutral~ I’ll go and see.', end: true },
          ],
        },
        value: {
          say: ['~curious~ Of value. Hm. The eggs, to me. The plants, to Corm. To anyone with eyes, the Great Crystal: east, over the hill, through the ford. It hums all day and sings when it rains.', '~playful~ Saba sits at its foot and listens. She’ll tell you what it’s worth. She’ll tell you whether you asked or not.'],
          do: { set: { 'perdide.wendel.heard': true } },
          choices: [{ text: '~curious~ What’s that mark on your staff?', goto: 'glyph' }, { text: '~neutral~ I’ll go and see.', end: true }],
        },
        fell: { say: ['~neutral~ Ask Saba. I only know that nothing grows that big by itself. Not even out here.'], choices: [{ text: '~curious~ What’s that mark on your staff?', goto: 'glyph' }, { text: '~neutral~ I’ll go and see.', end: true }] },
        glyph: {
          say: ['~neutral~ The Hush. {glyph} Three drops of rain over a shut mouth. You paint it on anything you don’t want eaten: eggs, boots, children.', '~solemn~ It’s carved under the Great Crystal too, older than anyone. Maybe that’s why the plants leave it alone.', '~sad~ And round the sky-egg on the mossy rise: a blue chest with a pale star, hushed all over. The plants never touch it. Nothing hatches from it, either. Not for us.'],
          do: { set: { 'perdide.glyph.heard': true } },
          choices: [{ text: '~happy~ Thank you, Wendel.', end: true }],
        },
        again: {
          say: [{ if: { quest: Q, stage: ['cross', 'saba'] }, text: '~neutral~ East, over the hill and through the ford. Follow the hum; you can’t miss a thing that size.' },
            { if: { quest: Q, stage: 'sing' }, text: '~playful~ Saba wants rain? Then she’ll wait. Unless you’ve got some on your back.' },
            { if: { quest: Q, reached: 'listen' }, text: '~surprised~ It sang? I saw the jaws shut from here, all at once, like a door closing. The whole swamp held its breath.' }],
          choices: [
            { text: '~curious~ What do you mean, the patient?', goto: 'patience', if: { quest: 'perdide.patience', started: false } },
            { text: '~curious~ Tell me about the eggs.', goto: 'eggs' },
            { text: '~curious~ What’s that mark on your staff?', goto: 'glyph', if: { not: { flag: 'perdide.glyph.heard' } } },
            { text: '~happy~ See you, Wendel.', end: true },
          ],
        },
        patient: {
          say: ['~happy~ They opened for you, didn’t they. I saw them from here: every jaw in the bed, wide and lazy, like old dogs in the sun.', '~solemn~ The patient are never eaten. Take that with you; it works on more than plants.'],
          do: [{ advance: ['perdide.patience', 'tell'] },
            { keepsake: { id: 'perdide.word', level: 'perdide', name: 'Wendel’s saying', kind: 'word', text: '“The patient are never eaten.” Wendel says it works on more than plants.' } }],
          choices: [{ text: '~solemn~ I’ll remember it.', end: true }, { text: '~playful~ Corm won’t be pleased.', goto: 'corm' }],
        },
        corm: { say: ['~playful~ Corm will sulk for a week and feed them twice as much. That’s his patience.'], choices: [{ text: '~neutral~ Goodbye, Wendel.', end: true }] },
        after: {
          say: ['~solemn~ You stood under it while it sang, and walked off with a piece of it. You’ll carry that sound for the rest of your life, I expect.', '~playful~ It’s not a bad thing to carry. Lighter than eggs.'],
          choices: [
            { text: '~curious~ What did you mean, the patient are never eaten?', goto: 'patience', if: { quest: 'perdide.patience', started: false } },
            { text: '~curious~ Tell me about the eggs.', goto: 'eggs' },
            { text: '~happy~ Keep them warm, Wendel.', end: true },
          ],
        },
      },
    },
  },
  {
    at: [-24, 12], radius: 2, palette: P('#62c3c9', '#3a3f5a'), shy: true,
    lines: ['~neutral~ Mind the reeds. They cut.', '~neutral~ The skiff comes when you whistle.', '~tired~ …'],
    id: 'sedge', name: 'Sedge', title: 'reed-cutter', color: '#62c3c9', voice: 1.15,
    talk: {
      entry: [{ if: { flag: 'met.sedge' }, node: 'again' }, { node: 'hello' }],
      nodes: {
        hello: {
          say: ['~neutral~ Mm. Hello. Mind the reeds, they cut.', '~playful~ I’m Sedge. I cut them, they cut me. It’s a fair arrangement.'],
          choices: [
            { text: '~curious~ What’s out in the water?', goto: 'water' },
            { text: '~curious~ Is there a boat?', goto: 'skiff' },
            { text: '~curious~ You look like you’ve seen something.', goto: 'light' },
            { text: '~neutral~ Sorry to bother you.', end: true },
          ],
        },
        again: {
          say: ['~playful~ Back? The reeds are still sharp.'],
          choices: [
            { text: '~curious~ Tell me about the deep water.', goto: 'water' },
            { text: '~curious~ How do I get across?', goto: 'skiff' },
            { text: '~curious~ The light you saw…', goto: 'light', if: { flag: 'perdide.rumour.light' } },
            { text: '~curious~ You look like you’ve seen something.', goto: 'light', if: { not: { flag: 'perdide.rumour.light' } } },
            { text: '~neutral~ Bye, Sedge.', end: true },
          ],
        },
        water: {
          say: ['~playful~ Deep water, mostly. Don’t wade past your chest. The swamp doesn’t keep what it doesn’t want: it’ll put you back on the last dry ground you stood on, wet and embarrassed.', '~neutral~ The cave island’s west, past the deep channel. The Great Crystal’s east; you can walk that one, through the ford.'],
          choices: [{ text: '~curious~ How do I get to the cave island?', goto: 'skiff' }, { text: '~happy~ Thanks.', end: true }],
        },
        skiff: {
          say: ['~neutral~ There’s a skiff that lives on the water. Nobody owns it; it belongs to the swamp. Whistle for it (E, out in the open) and it comes skimming.', '~whisper~ It knows the channels better than I do. Don’t tell it I said so.'],
          choices: [{ text: '~happy~ Thanks, Sedge.', end: true }],
        },
        light: {
          say: ['~whisper~ …Nobody believes me. The night before your ball came down, I was out cutting late. A light came over the reeds, low, singing. Like a wet finger round the rim of a bowl.', '~solemn~ It went over the Great Crystal, and the crystal sang back to it, out of a dry sky. Then it climbed and was gone. And every jaw in the swamp stayed shut till morning.'],
          do: { set: { 'perdide.rumour.light': true } },
          choices: [{ text: '~solemn~ I think something like it hit my ship.', goto: 'ship' }, { text: '~happy~ I believe you.', goto: 'believe' }],
        },
        ship: { say: ['~solemn~ Then it didn’t climb far enough.', '~neutral~ Ask Saba, at the crystal. If anyone knows what it was singing, she does.'], choices: [{ text: '~neutral~ I will.', end: true }] },
        believe: { say: ['~playful~ Mm. Well. That makes one of you.'], choices: [{ text: '~neutral~ Bye, Sedge.', end: true }] },
      },
    },
  },
  {
    at: [-112, 108], radius: 2, palette: P('#d6ff9a', '#3a3f5a'),
    lines: ['~curious~ Fireflies, or something else?', '~whisper~ Shh, you’ll scare them.', '~angry~ Ysse won’t let me past the lanterns.'],
    id: 'ivo', name: 'Ivo', title: 'who watches the fireflies', color: '#d6ff9a', voice: 1.45,
    talk: {
      entry: [
        { if: { quest: 'perdide.fireflies', done: true }, node: 'after' },
        { if: { quest: 'perdide.fireflies', stage: 'ivo' }, node: 'back' },
        { if: { quest: 'perdide.fireflies', active: true }, node: 'waiting' },
        { node: 'hello' },
      ],
      nodes: {
        hello: {
          say: ['~whisper~ Shh! You’ll scare them. Look, there, over the reeds.', '~sad~ Every dusk they come out all together and go off across the water. Nobody knows where. I can’t follow; I’m not allowed in the deep water.'],
          choices: [
            { text: '~neutral~ I’ll follow them.', goto: 'go' },
            { text: '~curious~ What are they?', goto: 'what' },
            { text: '~curious~ How did you get over here?', goto: 'here' },
          ],
        },
        what: {
          say: ['~playful~ Wendel says they’re sparks off the Great Crystal. Corm says they’re plant breath. Ysse says they’re none of my business.', '~curious~ I think they’re going home. Everything goes home at dusk.'],
          choices: [{ text: '~happy~ Let’s find out. I’ll follow them.', goto: 'go' }, { text: '~neutral~ Maybe they are.', end: true }],
        },
        here: { say: ['~tired~ Ysse rows me over. She keeps the crystal cave and I help. Mostly I’m not allowed to touch anything.'], choices: [{ text: '~neutral~ I’ll follow your fireflies.', goto: 'go' }, { text: '~neutral~ Bye, Ivo.', end: true }] },
        go: {
          say: ['~happy~ Really? Stay close to them; they wait if you fall behind. They go over the water, so you’ll need the skiff. Whistle!'],
          do: { start: 'perdide.fireflies' },
          choices: [{ text: '~neutral~ I’ll tell you where they go.', end: true }],
        },
        waiting: { say: ['~happy~ Go on! They’re waiting for you. Over the water, see?'], choices: [{ text: '~neutral~ Going.', end: true }] },
        back: {
          say: ['~curious~ Where? Where do they go?'],
          choices: [
            { text: '~happy~ Home. To a clutch of glowing eggs on the little isle. They hatch out of them.', goto: 'eggs' },
            { text: '~playful~ Guess.', goto: 'guess' },
          ],
        },
        guess: { say: ['~playful~ To the moon. To the Great Crystal. To the end of the world. Into a jar. Tell me!'], choices: [{ text: '~neutral~ They hatch from the glowing eggs, on the little isle.', goto: 'eggs' }] },
        eggs: {
          say: ['~surprised~ From the EGGS? Wendel’s kept eggs warm for thirty years and never seen one hatch!', '~curious~ …Fireflies. Of course. Something has to be inside a thing that glows.', '~happy~ Here. I caught some, before. You should have them; you know where they live now.'],
          do: [{ advance: ['perdide.fireflies', 'ivo'] }, { give: 'jar' }],
          choices: [{ text: '~happy~ Thank you, Ivo.', end: true }],
        },
        after: { say: ['~playful~ I told Wendel about the eggs. He sat down. In the mud. On purpose, he says.'], choices: [{ text: '~neutral~ Bye, Ivo.', end: true }] },
      },
    },
  },
];

// ------------------------------------------------------------------ the story's own people
export const PEOPLE = {
  saba: {
    id: 'saba', name: 'Saba', title: 'the Listener', color: '#c7a6f2', voice: 0.8, kind: 'f',
    palette: { cloak: '#c7a6f2', lining: '#2b211f', cloth: '#4a4566', legs: '#2f3a4f', hat: '#f3ead8', hair: '#d8d0ea' }, head: 'wrap', cape: 1.45, look: { body: 'reedcape', prop: 'staff' },
    lines: ['~whisper~ Shh. Listening.', '~neutral~ Phrase forty-one. Again.', '~curious~ Your pack is humming.'],
    talk: {
      entry: [
        { if: { quest: Q, done: true }, node: 'after' },
        { if: { quest: Q, reached: 'splinter' }, node: 'go' },
        { if: { quest: Q, stage: 'listen' }, node: 'new' },
        { if: { quest: Q, stage: 'sing' }, node: 'waiting' },
        { node: 'hello' },
      ],
      nodes: {
        hello: {
          say: ['~whisper~ Sit, if you’re going to stand there. Quietly. I’m listening.', '~solemn~ Forty years I’ve sat at its foot. I know every phrase it sings: two hundred and twelve of them. And you’re the first thing that has ever made it hum louder.'],
          choices: [
            { text: '~surprised~ It hums louder because of me?', goto: 'you' },
            { text: '~curious~ Why does it sing?', goto: 'why' },
            { text: '~neutral~ Wendel says it fell.', goto: 'fell' },
          ],
        },
        you: {
          say: ['~neutral~ That pack on your back. The water in it, all those colours. The crystal hums at it the way a dog hums at its own name.'],
          choices: [{ text: '~curious~ Why does it sing?', goto: 'why' }, { text: '~curious~ Where did it come from?', goto: 'fell' }],
        },
        why: {
          say: ['~neutral~ In the rain. Only in the rain. The rain strikes it and it rings, and all the jaws in the swamp shut while it sings.', '~solemn~ Wendel thinks it’s sacred. Corm thinks it’s weather. I think it’s calling.'],
          choices: [{ text: '~curious~ Calling what?', goto: 'fell' }],
        },
        fell: {
          say: ['~sad~ The rest of itself. It fell, you know, when my grandmother’s grandmother was small: out of the sky, singing, and stuck point-first in the mud. It has been calling ever since. Nothing ever answers.', '~tired~ And it hasn’t rained in days. The sky out here keeps its own counsel.'],
          choices: [
            { text: '~neutral~ Then I’ll wait for the rain.', goto: 'rain' },
            { text: '~neutral~ I carry water. I could make it rain on it.', goto: 'rain' },
          ],
        },
        rain: {
          say: ['~curious~ Could you? That water you carry remembers more colours than the sky does.', '~neutral~ Throw it high, at the spires. Three good splashes, close together. Or wait for the sky, if you’re patient. Either way, I want to hear what it does.'],
          do: { set: { 'perdide.saba.heard': true } },
          choices: [{ text: '~curious~ What’s carved on the stone at its foot?', goto: 'glyph' }, { text: '~neutral~ (step back and look up)', end: true }],
        },
        glyph: {
          say: ['~solemn~ The Hush. {glyph} Three drops over a shut mouth. Somebody carved it under the crystal before any of us came here. We paint it on our eggs to keep the plants off them.'],
          do: { set: { 'perdide.glyph.heard': true } },
          choices: [{ text: '~solemn~ My ship has that mark on it. Burned into the hull.', goto: 'ship' }, { text: '~neutral~ (step back)', end: true }],
        },
        ship: { say: ['~solemn~ Does it. Then it isn’t our mark at all, is it? We only borrowed it.'], do: { set: { 'perdide.glyph.ship': true } }, choices: [{ text: '~neutral~ (step back and look up)', end: true }] },
        waiting: {
          say: ['~playful~ Three good splashes on the spires, close together. Or wait for the sky to do it. I’ve waited forty years; I can wait while you aim.'],
          choices: [{ text: '~curious~ What’s carved on the stone at its foot?', goto: 'glyph', if: { not: { flag: 'perdide.glyph.heard' } } }, { text: '~neutral~ (look up at the spires)', end: true }],
        },
        new: {
          say: ['~surprised~ Did you hear that? The last phrase. Two hundred and thirteen. Forty years, and I have never heard it.'],
          choices: [
            { text: '~solemn~ I’ve heard it before. Just before something hit my ship.', goto: 'heard' },
            { text: '~curious~ What does it mean?', goto: 'mean' },
          ],
        },
        mean: { say: ['~curious~ A new phrase is an answer. Something has sung to it, and it remembers. Have you heard it before, traveller? Your face says you have.'], choices: [{ text: '~solemn~ Yes. Just before something hit my ship.', goto: 'heard' }] },
        heard: {
          say: ['~solemn~ Then that’s what it was answering. Whatever struck your ship sang the same song as this. They’re the same stuff, child: pieces of the same light.', '~solemn~ One of them fell here long ago, and stuck in the mud. One of them is still falling. You met it on the way down.', '~neutral~ Look: the song shook a splinter loose. It’s lying at the foot of the spires. Take it. It came off for you.'],
          do: { set: { 'perdide.clue.ship': true } },
          choices: [{ text: '~curious~ What should I do with it?', goto: 'cave' }],
        },
        cave: {
          say: ['~neutral~ The crystal cave, on the western island, past the deep channel. Its walls are full of this one’s kin; Ysse keeps them clean. Hold the splinter up at the heart of the cave and hear what they make of it.'],
          choices: [{ text: '~neutral~ I will.', end: true }],
        },
        go: {
          say: [{ if: { not: { has: 'splinter' } }, text: '~playful~ The splinter. At the foot of the spires. Take it, it won’t bite.' },
            { if: { has: 'splinter' }, text: '~neutral~ Take it to the cave, on the western island. Hold it up at the heart. The skiff will carry you; whistle for it.' }],
          choices: [{ text: '~neutral~ (go)', end: true }],
        },
        after: {
          say: ['~happy~ Two hundred and thirteen. I wrote it down. Now I’ll be listening for two hundred and fourteen.', '~solemn~ If you meet the rest of it out there, the falling light, sing it this. It might like to know where its other piece is.'],
          choices: [{ text: '~solemn~ I will, Saba.', end: true }],
        },
      },
    },
  },

  corm: {
    id: 'corm', name: 'Corm', title: 'who feeds the plants', color: '#d9506a', voice: 1.0, kind: 'm',
    palette: { cloak: '#d9506a', lining: '#2b211f', cloth: '#5a6a3a', legs: '#4a3a2a', hat: '#6f9a5a', hair: '#4a3226' }, head: 'hat', cape: 0.55,
    lines: ['~shout~ Careful! That’s Margit.', '~playful~ Who’s a hungry girl, then?', '~happy~ Fish heads. They love fish heads.'],
    talk: {
      entry: [
        { if: { quest: 'perdide.patience', reached: 'tell' }, node: 'beaten' },
        { if: { quest: 'perdide.patience', stage: 'wait' }, node: 'during' },
        { if: { flag: 'met.corm' }, node: 'again' },
        { node: 'hello' },
      ],
      nodes: {
        hello: {
          say: ['~scared~ Careful! Don’t step on Margit. Or Big Ollo. Or the little one, she hasn’t got a name yet; she bites.', '~angry~ My plants. I feed them. Nobody else does.'],
          choices: [
            { text: '~neutral~ Wendel says not to feed them.', goto: 'wendel' },
            { text: '~curious~ What do you feed them?', goto: 'feed' },
            { text: '~curious~ What do you think the Great Crystal is?', goto: 'crystal' },
          ],
        },
        again: {
          say: ['~happy~ Back to admire them? They’re admirable.'],
          choices: [
            { text: '~neutral~ Wendel says not to feed them.', goto: 'wendel' },
            { text: '~curious~ What do you think the Great Crystal is?', goto: 'crystal' },
            { text: '~neutral~ Bye, Corm.', end: true },
          ],
        },
        wendel: {
          say: ['~angry~ Wendel says a lot of things to eggs. A fed plant guards its eggs; a hungry plant eats whatever walks by. That’s just sense.', '~happy~ Try it! Give one a splash of that coloured water you carry. They love it. Watch them snap!'],
          choices: [{ text: '~neutral~ Maybe later.', end: true }, { text: '~neutral~ I think I’ll try Wendel’s way.', goto: 'try' }],
        },
        try: { say: ['~playful~ Standing there, being boring at them? Go on, then. They’ll snap at you till the moon comes up.'], choices: [{ text: '~playful~ We’ll see.', end: true }] },
        feed: { say: ['~playful~ Fish heads. Reed pith. Moths, when they’re slow. Once, a boot. Not mine.'], choices: [{ text: '~neutral~ Wendel says not to feed them.', goto: 'wendel' }, { text: '~neutral~ Bye, Corm.', end: true }] },
        crystal: {
          say: ['~curious~ A tooth. The sky lost a tooth and it landed here. Why else do my plants shut up when it sings?', '~playful~ Professional respect. One set of teeth to another.'],
          choices: [{ text: '~curious~ Have you ever seen it sing?', goto: 'seen' }, { text: '~neutral~ Bye, Corm.', end: true }],
        },
        seen: { say: ['~playful~ Every rain. And once without rain, the night before your ball fell. Sedge says she saw a light. Sedge sees a lot in the dark, for someone who’s always cutting her thumbs.'], choices: [{ text: '~neutral~ Bye, Corm.', end: true }] },
        during: {
          say: ['~angry~ You’re doing the Wendel thing, aren’t you. Standing there. Being boring at them.', '~playful~ Won’t work. One little splash and they’d love you forever. Go on.'],
          choices: [{ text: '~neutral~ (say nothing, and stand still)', end: true }],
        },
        beaten: {
          say: ['~surprised~ …They opened for you. Without a scrap. Look at Margit, yawning like a cat.', '~whisper~ Don’t tell Wendel I said so. I’ll feed them anyway. Somebody has to love them properly.'],
          choices: [{ text: '~playful~ Your secret’s safe.', end: true }],
        },
      },
    },
  },

  ysse: {
    id: 'ysse', name: 'Ysse', title: 'keeper of the crystal cave', color: '#7fe0d0', voice: 1.1, kind: 'f',
    palette: { cloak: '#7fe0d0', lining: '#2b211f', cloth: '#34405e', legs: '#2f3a4f', hat: '#c7a6f2', hair: '#2b211f' }, head: 'hood', cape: 1.45, look: { prop: 'lantern' },
    lines: ['~angry~ Mind your elbows.', '~neutral~ Dust makes them deaf.', '~playful~ Don’t touch. Unless you have to.'],
    talk: {
      entry: [
        { if: { quest: Q, done: true }, node: 'after' },
        { if: { has: 'splinter' }, node: 'splinter' },
        { if: { flag: 'met.ysse' }, node: 'again' },
        { node: 'hello' },
      ],
      nodes: {
        hello: {
          say: ['~angry~ Mind your head. And your feet. And your elbows.', '~neutral~ I keep the cave. I clean the crystals so they can hear. Dust makes them deaf.'],
          choices: [
            { text: '~curious~ Hear what?', goto: 'hear' },
            { text: '~curious~ What’s the hollow in the middle?', goto: 'hollow' },
            { text: '~curious~ Is there anywhere else like this?', goto: 'far' },
          ],
        },
        again: {
          say: ['~angry~ Still here? Then make yourself useful and don’t breathe on anything.'],
          choices: [
            { text: '~curious~ What’s the hollow in the middle?', goto: 'hollow' },
            { text: '~curious~ Is there anywhere else like this?', goto: 'far' },
            { text: '~neutral~ Bye, Ysse.', end: true },
          ],
        },
        hear: {
          say: ['~solemn~ The Great Crystal, when it sings. The walls hum along with it, from across the whole swamp. They’re its kin, I think: grown out of its song, the way frost grows out of cold.'],
          choices: [{ text: '~curious~ What’s the hollow in the middle?', goto: 'hollow' }, { text: '~curious~ Is there anywhere else like this?', goto: 'far' }],
        },
        hollow: {
          say: ['~sad~ The heart. A ring of them round an empty place, as if something stood there once and walked off. My mother said it’s waiting. My mother said a lot of things to crystals.'],
          choices: [{ text: '~curious~ Is there anywhere else like this?', goto: 'far' }, { text: '~neutral~ Bye, Ysse.', end: true }],
        },
        far: {
          say: ['~sad~ Not on this side of the world. On the far side, in the deep wood, there are lamp-keepers. They keep pools lit for travellers who never come.', '~solemn~ Something fell there too, they say. Not a crystal. A little boat out of the sky, half sunk in a pool.'],
          do: { set: { 'clue.perdide.perdide2': true } },
          choices: [{ text: '~curious~ A boat from the sky…', goto: 'boat' }, { text: '~happy~ Thanks, Ysse.', end: true }],
        },
        boat: { say: ['~sad~ Two people came out of it, the story goes, and walked away. Nobody’s seen them since. The lamp-keepers are still waiting.'], choices: [{ text: '~happy~ Thanks, Ysse.', end: true }] },
        splinter: {
          say: ['~surprised~ That’s a piece of it! Of the Great Crystal. It shook loose? Then it wants to be carried.', '~whisper~ Take it to the heart, there, in the ring. Hold it up. Gently.'],
          choices: [{ text: '~neutral~ (go to the heart)', end: true }, { text: '~curious~ Is there anywhere else like this?', goto: 'far', if: { not: { flag: 'clue.perdide.perdide2' } } }],
        },
        after: {
          say: ['~happy~ They’re all still humming. So is your pack. I can hear it from here.', '~curious~ Is that what you came all this way for? A splinter that sings?'],
          choices: [
            { text: '~neutral~ I came for something of value.', goto: 'value' },
            { text: '~curious~ Is there anywhere else like this?', goto: 'far', if: { not: { flag: 'clue.perdide.perdide2' } } },
          ],
        },
        value: { say: ['~tired~ Hm. Then I hope you know it when it’s in your hand. Most people don’t. Most people dust it off and sell it.'], choices: [{ text: '~neutral~ Goodbye, Ysse.', end: true }] },
      },
    },
  },
};

// The scenery you can look at: same panel, a different voice.
export const THINGS = {
  hush: {
    id: 'hush', name: 'The root stone', title: 'under the Great Crystal', color: '#a99bb0', voice: 0.6,
    talk: { nodes: { look: {
      say: ['~neutral~ A flat stone, half swallowed by the crystal’s roots, worn smooth by forty years of Saba’s hand. Carved into it, deep and old: {glyph}', '~solemn~ Three drops over a shut mouth, the swamp people say. To you it looks exactly like the scar on your ship’s hull.'],
      do: { set: { 'perdide.hush.seen': true } }, choices: [{ text: '~neutral~ (step back)', end: true }],
    } } },
  },
  crystal: {
    id: 'greatCrystal', name: 'The Great Crystal', title: 'humming', color: '#c7a6f2', voice: 0.6,
    talk: {
      entry: [{ if: { flag: 'perdide.crystal.sung' }, node: 'after' }, { node: 'look' }],
      nodes: {
        look: {
          say: ['~solemn~ Spires of violet crystal, taller than anything in the swamp, leaning out of the mud as if they were thrown there. Up close the hum gets into your teeth.', '~neutral~ Your tank hums back. You can feel it through the straps.'],
          choices: [{ text: '~neutral~ (step back)', end: true }],
        },
        after: { say: ['~whisper~ It hums again, quietly. Every so often, under the hum, you hear it try the new phrase, as if it were practising.'], choices: [{ text: '~neutral~ (listen)', end: true }] },
      },
    },
  },
  heart: {
    id: 'heart', name: 'The heart of the cave', title: 'a ring of crystals', color: '#7fe0d0', voice: 0.6,
    talk: {
      entry: [{ if: { flag: 'perdide.heart.rung' }, node: 'after' }, { if: { has: 'splinter' }, node: 'ring' }, { node: 'look' }],
      nodes: {
        look: {
          say: ['~neutral~ A ring of crystals stands round an empty place in the middle of the cave, as if something stood there once and walked off.', '~whisper~ The crystals are cold and quiet. They seem to be waiting for something.'],
          choices: [{ text: '~neutral~ (step back)', end: true }],
        },
        ring: {
          say: ['~neutral~ You hold up the splinter in the middle of the ring.', '~solemn~ For a moment nothing. Then the ring answers, one crystal after another, then the walls, the whole length of the cave, singing the two hundred and thirteenth phrase back to the splinter in your hand.', '~happy~ Your tank answers the walls. A new colour climbs the hose, crystal-violet, and the splinter grows warm. It hums the same note as your tank now. They know each other.'],
          do: [{ set: { 'perdide.heart.rung': true } },
            { keepsake: { id: 'perdide.thing', level: 'perdide', name: 'A singing splinter', kind: 'thing', text: 'A splinter of the Great Crystal that harmonises with your tank. It sings the phrase of the light that struck your ship.' } }],
          choices: [{ text: '~neutral~ (keep it)', end: true }],
        },
        after: { say: ['~whisper~ The ring hums softly now, and your splinter hums with it.'], choices: [{ text: '~neutral~ (listen)', end: true }] },
      },
    },
  },
  nest: {
    id: 'nest', name: 'The fireflies’ nest', title: 'on the little isle', color: '#f2e38f', voice: 0.6,
    talk: { nodes: { look: {
      say: ['~neutral~ The fireflies settle on a clutch of glowing eggs under the broad cap, and go in. Into the eggs: through the shell, like sparks into paper.', '~surprised~ And as you watch, an egg splits along a seam of light, and out of it climbs a firefly, then another, then a dozen, blinking, shaking off the yolk-light, and off over the water.', '~happy~ They hatch here. Every dusk they come home, and every dusk some of them are new.'],
      do: { set: { 'perdide.nest.seen': true } }, choices: [{ text: '~neutral~ (watch them)', end: true }],
    } } },
  },
};

/** What people at the landing say in passing, by mood. */
export const LINES = {
  singing: ['~shout~ Listen! It’s singing.', '~whisper~ Hush… the jaws are shut.', '~shout~ Rain on the crystal!', '~whisper~ Shh.'],
};
