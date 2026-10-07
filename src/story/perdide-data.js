// Lorn's story as data: "The Great Crystal" (docs/story-bible.md).
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
    outro: 'The splinter hums with your tank. The crystal sang a phrase like the one you heard the night your ship was struck.',
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
          say: ["~playful~ Dry landing. Sensible. Most sky visitors introduce themselves to the deep water first.", '~happy~ I’m Wendel. I keep the eggs warm and the plants hungry.'],
          choices: [
            { text: '~neutral~ I’m looking for something of value.', goto: 'value' },
            { text: '~curious~ Why keep the plants hungry?', goto: 'plants' },
          ],
        },
        eggs: {
          say: [{ if: { not: { quest: 'perdide.fireflies', done: true } }, text: "~tired~ Thirty years warming these glowing eggs. Never seen one hatch. Still, something inside needs warmth. I can provide that." },
            { if: { quest: 'perdide.fireflies', done: true }, text: "~surprised~ Fireflies! They hatch into fireflies every dusk! Thirty years, and I kept missing it. I’ve had a very educational sit-down." }],
          choices: [{ text: '~curious~ And the plants?', goto: 'plants' }, { text: '~curious~ What hums in the east?', goto: 'hum' }],
        },
        plants: {
          say: ["~neutral~ The jaw-plants snap at movement and anything thrown at them. Corm feeds them. He says that makes them guard the eggs.", '~solemn~ I say the patient are never eaten.'],
          choices: [
            { text: '~curious~ What do you mean, the patient?', goto: 'patience', if: { quest: 'perdide.patience', started: false } },
            { text: '~curious~ What hums in the east?', goto: 'hum' },
          ],
        },
        patience: {
          say: ["~neutral~ Try *the jaw-bed by the north shore*. Stand still among them. *Don’t run, shoot, or feed them.* Let them get used to you.", "~neutral~ Wait through the snapping. Once they settle, they’ll recognise you and leave you alone."],
          do: { start: 'perdide.patience' },
          choices: [{ text: '~neutral~ I’ll try it.', end: true }, { text: '~curious~ And what hums in the east?', goto: 'hum' }],
        },
        hum: {
          say: ["~neutral~ The Great Crystal is east, over the hill and through the ford. You can walk there. The water will reach your knees. It considers that polite.", "~solemn~ Rain makes it sing. Every jaw-plant shuts while it does. *Saba sits at its foot*. She thinks it fell from the sky."],
          do: { set: { 'perdide.wendel.heard': true } },
          choices: [
            { text: '~curious~ Fell from where?', goto: 'fell' },
            { text: '~neutral~ I’ll go and see.', end: true },
          ],
        },
        value: {
          say: ["~curious~ Value depends who you ask. I keep eggs. Corm loves teeth. Try *the Great Crystal, east through the ford*. Hard to overlook that one.", "~playful~ *Ask Saba beside it.* She’s spent forty years listening. Allow a little time for her reply."],
          do: { set: { 'perdide.wendel.heard': true } },
          choices: [{ text: '~curious~ What’s that mark on your staff?', goto: 'glyph' }, { text: '~neutral~ I’ll go and see.', end: true }],
        },
        fell: { say: ["~neutral~ Ask *Saba at the crystal*. I’m qualified in eggs, not enormous singing rocks."], choices: [{ text: '~curious~ What’s that mark on your staff?', goto: 'glyph' }, { text: '~neutral~ I’ll go and see.', end: true }] },
        glyph: {
          say: ["~neutral~ {glyph} *The Hush.* Three raindrops over a closed mouth. We put it on things we’d prefer the plants not to eat. Boots, eggs, small relatives.", "~solemn~ It’s carved beneath the Great Crystal too. The plants leave that alone. Mind you, it would be an ambitious meal.", "~sad~ Look for *the sky-egg on the mossy rise*: a blue star-chest covered in that mark. Plants won’t touch it. It won’t open for us."],
          do: { set: { 'perdide.glyph.heard': true } },
          choices: [{ text: '~happy~ Thank you, Wendel.', end: true }],
        },
        again: {
          say: [{ if: { quest: Q, stage: ['cross', 'saba'] }, text: "~neutral~ *East over the hill, through the ford.* Follow the hum to the crystal." },
            { if: { quest: Q, stage: 'sing' }, text: "~playful~ Waiting for rain? Your backpack seems to be carrying a useful imitation." },
            { if: { quest: Q, reached: 'listen' }, text: "~surprised~ The crystal sang! Every jaw shut at once. I could hear myself thinking. Novel experience." }],
          choices: [
            { text: '~curious~ Tell me about the eggs.', goto: 'eggs' },
            { text: '~happy~ See you, Wendel.', end: true },
          ],
        },
        patient: {
          say: ["~happy~ You waited, and the jaws opened peacefully. Look at them. All those teeth, no argument.", "~solemn~ *The patient are never eaten.* Around this particular bed, at least. Use judgment elsewhere."],
          do: [{ advance: ['perdide.patience', 'tell'] },
            { keepsake: { id: 'perdide.word', level: 'perdide', name: 'Wendel’s saying', kind: 'word', text: '“The patient are never eaten.” Wendel says it works on more than plants.' } }],
          choices: [{ text: '~solemn~ I’ll remember it.', end: true }, { text: '~playful~ Corm won’t be pleased.', goto: 'corm' }],
        },
        corm: { say: ["~playful~ Corm will feed them extra now. He hates losing a debate to someone standing still."], choices: [{ text: '~neutral~ Goodbye, Wendel.', end: true }] },
        after: {
          say: ["~solemn~ You have a piece of the crystal. Listen: it’s still singing. A good deal lighter than taking the whole thing.", '~playful~ Keep it out of the rain. Or don’t, and let it sing.'],
          choices: [
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
          say: ['~neutral~ Mm. Hello. Mind the reeds, they cut.', "~playful~ Sedge. I cut reeds. They cut back. We keep the arrangement civil."],
          choices: [
            { text: '~curious~ What’s out in the water?', goto: 'water' },
            { text: '~curious~ You look like you’ve seen something.', goto: 'light' },
          ],
        },
        again: {
          say: ['~playful~ Back? The reeds are still sharp.'],
          choices: [
            { text: '~curious~ How do I get across the water?', goto: 'water' },
            { text: '~curious~ The light you saw…', goto: 'light', if: { flag: 'perdide.rumour.light' } },
            { text: '~curious~ You look like you’ve seen something.', goto: 'light', if: { not: { flag: 'perdide.rumour.light' } } },
            { text: '~neutral~ Bye, Sedge.', end: true },
          ],
        },
        water: {
          say: ["~playful~ Deep water beyond the shallows. You can swim it, if you like reeds in your teeth. Most people come out with an improved opinion of boats.", "~neutral~ *The cave island is west, across deep water.* The Great Crystal is east, reachable on foot through the ford."],
          choices: [{ text: '~curious~ How do I get to the cave island?', goto: 'skiff' }, { text: '~happy~ Thanks.', end: true }],
        },
        skiff: {
          say: ["~neutral~ Whistle for the skiff out in the open (E, or X / □). It comes to you. Nobody owns it, though several people give it advice.", "~whisper~ Let it find the channels. It knows more than I do and boasts considerably less."],
          choices: [{ text: '~happy~ Thanks, Sedge.', end: true }],
        },
        light: {
          say: ["~whisper~ I was cutting late when the light passed. Low over the reeds, singing one high note, like a reed cut just right. I know what I saw.", "~solemn~ The Great Crystal answered without any rain. Then the light climbed away. The jaws stayed shut till morning."],
          do: { set: { 'perdide.rumour.light': true } },
          choices: [{ text: '~solemn~ I think something like it hit my ship.', goto: 'ship' }, { text: '~happy~ I believe you.', goto: 'believe' }],
        },
        ship: { say: ['~solemn~ Then it didn’t climb far enough.', "~neutral~ Ask *Saba at the Great Crystal*. She knows its songs better than anyone."], choices: [{ text: '~neutral~ I will.', end: true }] },
        believe: { say: ['~playful~ Mm. Well. That makes one of you.'], choices: [{ text: '~neutral~ Bye, Sedge.', end: true }] },
      },
    },
  },
  {
    at: [-112, 108], radius: 2, palette: P('#d6ff9a', '#3a3f5a'),
    lines: ['~curious~ Fireflies, or something else?', '~whisper~ Shh, you’ll scare them.', '~angry~ Ysse won’t let me past the lanterns.'],
    id: 'ivo.perdide', name: 'Ivo', title: 'who watches the fireflies', color: '#d6ff9a', voice: 1.45,
    talk: {
      entry: [
        { if: { quest: 'perdide.fireflies', done: true }, node: 'after' },
        { if: { quest: 'perdide.fireflies', stage: 'ivo' }, node: 'back' },
        { if: { quest: 'perdide.fireflies', active: true }, node: 'waiting' },
        { node: 'hello' },
      ],
      nodes: {
        hello: {
          say: ['~whisper~ Shh! You’ll scare them. Look, there, over the reeds.', "~sad~ Every dusk the fireflies cross the water. I want to know where they go, but I’m not allowed into the deep channel."],
          choices: [
            { text: '~neutral~ I’ll follow them.', goto: 'go' },
            { text: '~curious~ What are they?', goto: 'what' },
          ],
        },
        what: {
          say: ["~playful~ Wendel calls them crystal sparks. Corm says plant breath. Ysse says stop asking. That’s the least useful theory.", '~curious~ I think they’re going home. Everything goes home at dusk.'],
          choices: [{ text: '~happy~ Let’s find out. I’ll follow them.', goto: 'go' }, { text: '~curious~ How did you get over here?', goto: 'here' }],
        },
        here: { say: ["~tired~ Ysse brings me in her boat. I help in the cave by not touching things. I’m extremely experienced now."], choices: [{ text: '~neutral~ I’ll follow your fireflies.', goto: 'go' }, { text: '~neutral~ Bye, Ivo.', end: true }] },
        go: {
          say: ["~happy~ Follow them now, while they’re crossing. *Whistle for the skiff* to cross the water and stay close. They wait if you fall behind."],
          do: { start: 'perdide.fireflies' },
          choices: [{ text: '~neutral~ I’ll tell you where they go.', end: true }],
        },
        waiting: { say: ['~happy~ Go on! They’re waiting for you. *Over the water*, see?'], choices: [{ text: '~neutral~ Going.', end: true }] },
        back: {
          say: ['~curious~ Where? Where do they go?'],
          choices: [
            { text: "~happy~ Home. To the glowing eggs on the little island. I saw new fireflies hatch there.", goto: 'eggs' },
            { text: '~playful~ Guess.', goto: 'guess' },
          ],
        },
        guess: { say: ["~playful~ Where? The moon? A jar? Please say it’s better than a jar!"], choices: [{ text: '~neutral~ They hatch from the glowing eggs, on the little isle.', goto: 'eggs' }] },
        eggs: {
          say: ["~surprised~ The EGGS? Wendel has watched those for thirty years! Wait till I tell him!", "~curious~ Fireflies inside glowing eggs. It seems obvious once someone else has done the finding out.", "~happy~ Here, keep the fireflies I caught. A jar of them lights a skiff better than any lamp. I know where to find more now."],
          do: [{ advance: ['perdide.fireflies', 'ivo'] }, { give: 'jar' }],
          choices: [{ text: '~happy~ Thank you, Ivo.', end: true }],
        },
        after: { say: ["~playful~ Wendel sat in the mud when I told him. Says he meant to. Learning must be very slippery."], choices: [{ text: '~neutral~ Bye, Ivo.', end: true }] },
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
          say: ["~whisper~ Sit down. The crystal’s speaking, and your boots are interrupting.", "~solemn~ Saba. Forty years listening. Two hundred and twelve phrases. Now you arrive, and it hums louder. Explain yourself, if you can."],
          choices: [
            { text: '~surprised~ It hums louder because of me?', goto: 'you' },
            { text: '~curious~ Why does it sing?', goto: 'why' },
          ],
        },
        you: {
          say: ["~neutral~ It’s your tank. The crystal reacts to the fluid. Hear the pitch change when you turn?"],
          choices: [{ text: '~curious~ Why does it sing?', goto: 'why' }, { text: '~curious~ Where did it come from?', goto: 'fell' }],
        },
        why: {
          say: ["~neutral~ Rain makes it sing. Water strikes the crystal, and every jaw in the swamp closes to listen. Or out of fright. Hard to ask a closed mouth.", "~solemn~ Wendel calls it sacred. Corm calls it weather. I think it’s trying to reach something."],
          choices: [{ text: '~curious~ Calling what?', goto: 'fell' }],
        },
        fell: {
          say: ["~sad~ Our oldest story says this is a broken piece of something in the sky. It fell into the mud long ago. I think it calls to the rest of itself.", "~tired~ No rain for days. Even a good listener runs out of things to do with humming."],
          choices: [
            { text: '~neutral~ Then I’ll wait for the rain.', goto: 'rain' },
            { text: '~neutral~ I carry water. I could make it rain on it.', goto: 'rain' },
          ],
        },
        rain: {
          say: ["~curious~ You could make rain with that tank. Let’s see whether it minds the substitute.", "~neutral~ *Shoot the spires three times in quick succession.* Or wait for natural rain. I’d prefer to hear the answer before my legs go numb."],
          do: { set: { 'perdide.saba.heard': true } },
          choices: [{ text: '~curious~ What’s carved on the stone at its foot?', goto: 'glyph' }, { text: '~neutral~ (step back and look up)', end: true }],
        },
        glyph: {
          say: ["~solemn~ {glyph} *The Hush.* The carving predates us. We copied it onto eggs to protect them from the plants."],
          do: { set: { 'perdide.glyph.heard': true } },
          choices: [{ text: '~solemn~ My ship has that mark on it. Burned into the hull.', goto: 'ship' }, { text: '~neutral~ (step back)', end: true }],
        },
        ship: { say: ["~solemn~ The same mark on your ship? Then it belongs to more than this swamp. I’ll have to revise my notes."], do: { set: { 'perdide.glyph.ship': true } }, choices: [{ text: '~neutral~ (step back and look up)', end: true }] },
        waiting: {
          say: ["~playful~ *Three quick splashes on the crystal spires.* Take your time aiming; don’t take it between shots."],
          choices: [{ text: '~curious~ What’s carved on the stone at its foot?', goto: 'glyph', if: { not: { flag: 'perdide.glyph.heard' } } }, { text: '~neutral~ (look up at the spires)', end: true }],
        },
        new: {
          say: ["~surprised~ Two hundred and thirteen. That last phrase is new. Forty years, and it’s said something new."],
          choices: [
            { text: '~solemn~ I’ve heard it before. Just before something hit my ship.', goto: 'heard' },
            { text: '~curious~ What does it mean?', goto: 'mean' },
          ],
        },
        mean: { say: ["~curious~ It learned an answer. Have you heard that phrase before? You stopped breathing for a moment."], choices: [{ text: '~solemn~ Yes. Just before something hit my ship.', goto: 'heard' }] },
        heard: {
          say: ["~solemn~ The thing that struck you sang this? Then I think the crystal is a piece of it. Same song, same material.", "~solemn~ This piece fell long ago. The rest is still flying out there. Singing, turning. Perhaps searching.", "~solemn~ The crystal pulls at iron like your ship’s scar does. That may be how your ship found this place. A trace of the same thing in both.", "~neutral~ The song loosened a splinter. Look *at the foot of the spires*. Take it with you."],
          do: { set: { 'perdide.clue.ship': true } },
          choices: [{ text: '~curious~ What should I do with it?', goto: 'cave' }],
        },
        cave: {
          say: ["~neutral~ Carry it *to the crystal cave on the western island*. Ysse tends it. *Raise the splinter in the central ring* and listen for an answer."],
          choices: [{ text: '~neutral~ I will.', end: true }],
        },
        go: {
          say: [{ if: { not: { has: 'splinter' } }, text: "~playful~ *The splinter is below the spires.* Safe enough to pick up. I’m fairly sure it has no teeth." },
            { if: { has: 'splinter' }, text: "~neutral~ Whistle for the skiff, cross west to the cave island, and raise the splinter at the cave’s heart." }],
          choices: [{ text: '~neutral~ (go)', end: true }],
        },
        after: {
          say: ["~happy~ I wrote down the new phrase. Two hundred and thirteen. Tomorrow I listen for another.", "~solemn~ If you meet the Singer again, let it hear this piece. It may not know where it fell."],
          choices: [
            { text: '~solemn~ I will, Saba.', end: true },
            { text: "~curious~ Did Odile and Talo ever come here? Two travellers looking for the light?", if: { any: [{ flag: 'clue.edena.pod' }, { flag: 'clue.perdide2.edena' }] }, goto: 'two', once: true },
          ],
        },
        // Odile and Talo came this way, from the deep wood in Fen's skiff (src/story/perdide2-data.js), and went on
        two: {
          say: ["~solemn~ My first spring here. They arrived from the deep wood in a borrowed skiff, asking where the singing light had gone.", "~sad~ It gave them the usual two hundred and twelve phrases. They went east over the reeds. The skiff returned alone. I never learned where they went next."],
          choices: [{ text: '~sad~ Nobody ever does.', end: true }],
        },
      },
    },
  },

  corm: {
    id: 'corm', name: 'Corm', title: 'who feeds the plants', color: '#d9506a', voice: 1.0, kind: 'm',
    palette: { cloak: '#d9506a', lining: '#2b211f', cloth: '#5a6a3a', legs: '#4a3a2a', hat: '#6f9a5a', hair: '#4a3226' }, head: 'hat', cape: 0.55, look: { head: 'brim', under: 'locks' },
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
          say: ["~scared~ Watch Margit! And Big Ollo! The small one has no name yet. We’re waiting to see who survives suggesting one.", '~angry~ My plants. I feed them. Nobody else does.'],
          choices: [
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
          say: ["~angry~ Wendel lectures eggs. I feed plants. A fed plant guards its eggs; a hungry one considers visitors. Perfectly sound reasoning.", "~happy~ *Shoot one a splash of fluid!* Watch how eagerly it snaps. That’s appreciation."],
          choices: [{ text: '~neutral~ Maybe later.', end: true }, { text: '~neutral~ I think I’ll try Wendel’s way.', goto: 'try' }],
        },
        try: { say: ["~playful~ You’ll stand still until they like you? Fine. I’ll be over here, being interesting."], choices: [{ text: '~playful~ We’ll see.', end: true }] },
        feed: { say: ["~playful~ Fish heads, reed pith, slow moths. Once a boot. It wasn’t occupied. I checked."], choices: [{ text: '~neutral~ Wendel says not to feed them.', goto: 'wendel' }, { text: '~neutral~ Bye, Corm.', end: true }] },
        crystal: {
          say: ["~curious~ The crystal? A sky-tooth. My plants close their mouths when it sings. Professional respect.", '~playful~ Professional respect. One set of teeth to another.'],
          choices: [{ text: '~curious~ Have you ever seen it sing?', goto: 'seen' }, { text: '~neutral~ Bye, Corm.', end: true }],
        },
        seen: { say: ["~playful~ They shut every rain. And once that dry night when Sedge saw the singing light. Even I found that peculiar."], choices: [{ text: '~neutral~ Bye, Corm.', end: true }] },
        during: {
          say: ["~angry~ Ah. Wendel’s method. Being terribly dull in front of a plant.", "~playful~ One splash and they’d be delighted. You could at least wave."],
          choices: [{ text: '~neutral~ (say nothing, and stand still)', end: true }],
        },
        beaten: {
          say: ["~surprised~ They’ve opened. Peacefully. Margit looks almost… fond of you.", "~whisper~ Don’t tell Wendel I said that. I’m still feeding them. Margit expects supper."],
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
          say: ['~angry~ Mind your head. And your feet. And your elbows.', "~neutral~ I’m Ysse. I clean the cave crystals. Dust muffles their sound. Visitors generally add dust."],
          choices: [
            { text: '~curious~ Hear what?', goto: 'hear' },
            { text: '~curious~ Is there anywhere else like this?', goto: 'far' },
          ],
        },
        again: {
          say: ["~angry~ Still here? Then keep your boots off the crystals. That counts as helping."],
          choices: [
            { text: '~curious~ What’s the hollow in the middle?', goto: 'hollow' },
            { text: '~curious~ Is there anywhere else like this?', goto: 'far' },
            { text: '~neutral~ Bye, Ysse.', end: true },
          ],
        },
        hear: {
          say: ["~solemn~ They answer the Great Crystal across the swamp. I think they grew from it somehow. Related things recognise a voice."],
          choices: [{ text: '~curious~ What’s the hollow in the middle?', goto: 'hollow' }, { text: '~curious~ Is there anywhere else like this?', goto: 'far' }],
        },
        hollow: {
          say: ["~sad~ The heart is the empty ring in the middle. My mother said it was waiting for something. I keep it clean in case she was right."],
          choices: [{ text: '~curious~ Is there anywhere else like this?', goto: 'far' }, { text: '~neutral~ Bye, Ysse.', end: true }],
        },
        far: {
          say: ["~sad~ Across the swamp, in *the deep wood*, people keep pools lit for missing travellers.", "~solemn~ A small sky-boat fell there, half into a pool. No crystal that time."],
          do: { set: { 'clue.perdide.perdide2': true } },
          choices: [{ text: '~curious~ A boat from the sky…', goto: 'boat' }, { text: '~happy~ Thanks, Ysse.', end: true }],
        },
        boat: { say: ["~sad~ Two travellers survived it. They waited a season in the deep wood, then borrowed a boat and crossed the swamp. The lamp-keepers still hope they’ll return. That’s the story I heard."], choices: [{ text: '~happy~ Thanks, Ysse.', end: true }] },
        splinter: {
          say: ["~surprised~ A splinter of the Great Crystal! It finally let something go.", "~whisper~ Take it *to the ring at the cave’s heart*. Raise it there. Gently."],
          choices: [{ text: '~neutral~ (go to the heart)', end: true }, { text: '~curious~ Is there anywhere else like this?', goto: 'far', if: { not: { flag: 'clue.perdide.perdide2' } } }],
        },
        after: {
          say: ["~happy~ The whole cave is humming. Your tank too. Quite a choir you’ve started.", "~curious~ Is a singing splinter what you wanted to find out here?"],
          choices: [
            { text: '~neutral~ I came for something of value.', goto: 'value' },
            { text: '~curious~ Is there anywhere else like this?', goto: 'far', if: { not: { flag: 'clue.perdide.perdide2' } } },
          ],
        },
        value: { say: ["~tired~ Something of value. Well, listen before you decide what it’s worth."], choices: [{ text: '~neutral~ Goodbye, Ysse.', end: true }] },
      },
    },
  },
};

// The scenery you can look at: same panel, a different voice.
export const THINGS = {
  hush: {
    id: 'hush', name: 'The root stone', title: 'under the Great Crystal', color: '#a99bb0', voice: 0.6,
    talk: { nodes: { look: {
      say: ["~neutral~ Saba’s hand has polished this stone beside the crystal. An ancient carving remains: {glyph}", "~solemn~ The Hush, they call it. The same three dots and arc burned into your ship."],
      do: { set: { 'perdide.hush.seen': true } }, choices: [{ text: '~neutral~ (step back)', end: true }],
    } } },
  },
  crystal: {
    id: 'greatCrystal', name: 'The Great Crystal', title: 'humming', color: '#c7a6f2', voice: 0.6,
    talk: {
      entry: [{ if: { flag: 'perdide.crystal.sung' }, node: 'after' }, { node: 'look' }],
      nodes: {
        look: {
          say: ["~solemn~ Violet spires rise crookedly from the mud. You feel their hum in your teeth.", '~neutral~ Your tank hums back. You can feel it through the straps.'],
          choices: [{ text: '~neutral~ (step back)', end: true }],
        },
        after: { say: ["~whisper~ Under its quiet hum, the crystal repeats the new phrase. Practising, perhaps."], choices: [{ text: '~neutral~ (listen)', end: true }] },
      },
    },
  },
  heart: {
    id: 'heart', name: 'The heart of the cave', title: 'a ring of crystals', color: '#7fe0d0', voice: 0.6,
    talk: {
      entry: [{ if: { flag: 'perdide.heart.rung' }, node: 'after' }, { if: { has: 'splinter' }, node: 'ring' }, { node: 'look' }],
      nodes: {
        look: {
          say: ["~neutral~ Crystals encircle an empty space at the cave’s centre.", "~whisper~ They are cold and silent. This looks like the place to raise Saba’s splinter."],
          choices: [{ text: '~neutral~ (step back)', end: true }],
        },
        ring: {
          say: ['~neutral~ You hold up the splinter in the middle of the ring.', "~solemn~ One crystal answers, then another. Soon the whole cave sings the new phrase back to the splinter.", "~happy~ Your tank joins in. Crystal-violet climbs the hose as a new colour band. The splinter warms in your hand."],
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
      say: ["~neutral~ The fireflies settle onto glowing eggs beneath the broad cap. Their lights slip through the shells.", "~surprised~ An egg splits along a bright seam. One firefly climbs out, then a dozen. They shake themselves and lift over the water.", "~happy~ A nursery. Each dusk the fireflies return, and new ones join them."],
      do: { set: { 'perdide.nest.seen': true } }, choices: [{ text: '~neutral~ (watch them)', end: true }],
    } } },
  },
};

/** What people at the landing say in passing, by mood. */
export const LINES = {
  singing: ['~shout~ Listen! It’s singing.', '~whisper~ Hush… the jaws are shut.', '~shout~ Rain on the crystal!', '~whisper~ Shh.'],
};
