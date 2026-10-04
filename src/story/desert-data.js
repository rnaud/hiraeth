// The desert's story as data: "The Tree That Drinks" (docs/story-bible.md).
//
// Once a year the old city's burning tree drinks: water rises from beneath
// the giants and the fire burns cool and many-coloured. Pilgrims walk the
// circuit round the city until it does. This year the water has not risen:
// a rib of the giant whose heart lies under the city has fallen across the
// channel. Push it clear and the water rises, the tree drinks, and the jar
// Ama gave you fills with living water: power for the ship.
//
// How the three connect (said by nobody all at once): the giants carried the
// water across the desert from the swamp of lights, and lay down where they
// could go no further; the water they carried pooled in their hearts; the
// tree grew from this giant's heart and the people built Qanat round it.
// The tree drinks what the giants left.
//
// Conversations: see src/story/dialogue.js for the format. Quests: see
// src/story/quests.js. Flags (game-state.js): desert.* below.

const Q = 'desert.power';

export const ITEMS = { jar: 'Ama’s drinking jar', water: 'a jar of living water', drum: 'Teo’s drum', cord: 'Oum’s knotted cord' };

// ------------------------------------------------------------------ quests
export const QUESTS = [
  {
    id: Q, title: 'The Tree That Drinks', world: 'desert', main: true,
    outro: 'The ship hums. The tree drank, and so did you.',
    stages: [
      // the backpack was thrown out in the crash: its box lies down the dune, at the end of the debris (src/boxes/placements.js)
      { id: 'pack', text: 'Something was thrown from the ship in the crash. Find what fell', label: 'What fell from the ship', flag: 'item.backpack', at: 'box.desert.backpack' },
      { id: 'camps', text: 'The ship is dead. Follow the smoke to the pilgrims’ camps', label: 'The pilgrims’ camps', flag: 'desert.camps.seen', at: 'camps' },
      { id: 'ama', text: 'Ask Ama, keeper of the fires, where to find power', label: 'Ama, keeper of the fires', flag: 'desert.jar.given', at: 'ama' },
      { id: 'speaker', text: 'Find the Speaker at the head of the procession', label: 'The Speaker', flag: 'desert.speaker.heard', at: 'speaker' },
      { id: 'well', text: 'Look into the dry well at the burning tree’s roots', label: 'The dry well', flag: 'desert.well.seen', at: 'well' },
      { id: 'down', text: 'Find the way beneath the giant, outside the back gate', label: 'The giant’s skull', flag: 'desert.cave.seen', at: 'caveIn' },
      { id: 'channel', text: 'The pool is low: something blocks the channel. Push it clear', label: 'The blocked channel', flag: 'desert.channel.open', at: 'bone' },
      { id: 'fill', text: 'Fill Ama’s jar in the risen pool', label: 'The pool', flag: 'desert.jar.filled', at: 'pool' },
      { id: 'ship', text: 'Bring the living water to the ship', label: 'Your ship', flag: 'desert.ship.fed', at: 'ship' },
    ],
  },
  {
    id: 'desert.drum', title: 'Teo’s Drum', world: 'desert',
    outro: 'Teo plays again. The camp keeps time.',
    stages: [
      { id: 'find', text: 'Find Teo’s drum, blown away under the old ribcage south of the start', label: 'Teo’s drum', bring: 'drum', at: 'drum', to: 'teo' },
      { id: 'return', text: 'Bring the drum back to Teo at the fire', label: 'Teo, at the fire', bring: 'drum', to: 'teo' },
    ],
  },
  {
    id: 'desert.ilo', title: 'Ilo Wants to See', world: 'desert',
    outro: 'Ilo will tell it better than it happened.',
    stages: [
      { id: 'lead', text: 'Take Ilo to the giant’s skull outside the back gate', label: 'The giant’s skull', flag: 'desert.ilo.atSkull', at: 'skull' },
      { id: 'below', text: 'Go down alone, then tell Ilo what you saw', label: 'Ilo, at the skull', talk: 'ilo', at: 'ilo', secret: true },
    ],
  },
  {
    id: 'desert.oum', title: 'The One Who Fell Behind', world: 'desert',
    outro: 'Oum sits by the fire. She saw the light fall.',
    stages: [
      { id: 'find', text: 'Find old Oum, who fell behind the procession in the western dunes', label: 'Old Oum', talk: 'oum', at: 'oum' },
      { id: 'lead', text: 'Walk with Oum to the camps (she is slow; stay close)', label: 'The camps, with Oum', flag: 'desert.oum.home', at: 'camps' },
    ],
  },
  {
    id: 'desert.mask', title: 'The Mask in the Sand', world: 'desert',
    outro: 'It does not wake. But it saw you.',
    stages: [
      { id: 'go', text: 'Visit the masked head that sleeps in the southern dunes', label: 'The masked head', goto: 'mask', radius: 30, at: 'mask' },
    ],
  },
];

// ------------------------------------------------------------------ the people
// palettes: cloak / cloth / legs / hat / hair (buildCharacter + Humanoid)
export const PEOPLE = {
  ama: {
    id: 'ama', name: 'Ama', title: 'keeper of the fires', color: '#c8483a', voice: 1.05, kind: 'f',
    palette: { cloak: '#c8483a', lining: '#2b211f', cloth: '#5a4a3a', legs: '#2b2f45', hat: '#f3ead8', hair: '#2b211f' }, head: 'wrap', cape: 1.25,
    lines: ['Mind the sparks.', 'Sit, if you like. Fires are for everyone.', 'The jar is for the drinking.'],
    talk: {
      entry: [
        { if: { quest: Q, done: true }, node: 'after' },
        { if: { flag: 'desert.channel.open' }, node: 'drinking' },
        { if: { flag: 'desert.jar.given' }, node: 'again' },
        { node: 'hello' },
      ],
      nodes: {
        hello: {
          say: ['A stranger, walking in from where the sky-ball fell. Sit. Nobody goes thirsty at my fires.', 'I am Ama. I keep the fires for the pilgrims while they walk the circuit.'],
          choices: [
            { text: 'My ship has no power. I need to find some.', goto: 'power' },
            { text: 'Who are all these people?', goto: 'who' },
            { text: 'What is that tree? It’s burning.', goto: 'tree' },
          ],
        },
        who: {
          say: ['Pilgrims, from every oasis between here and the salt. Once a year we come to Qanat to watch the tree drink.', 'The water rises from beneath the giants, the fire turns cool, and we all drink from the same jar. This year we have walked eleven days, and the water has not risen.'],
          choices: [
            { text: 'Rises from where?', goto: 'giants' },
            { text: 'I need power for my ship.', goto: 'power' },
          ],
        },
        tree: {
          say: ['It has always burned. My grandmother’s grandmother saw it burn. It eats nothing, it never falls.', 'Once a year it drinks, and then it burns in every colour. You’ll see. If it drinks this year.'],
          choices: [
            { text: 'And if it doesn’t?', goto: 'giants' },
            { text: 'I need power for my ship.', goto: 'power' },
          ],
        },
        giants: {
          say: ['Ask the Speaker; he knows the old words. I only know the fires.', 'He walks at the head of the procession. You’ll hear the drum before you see him.'],
          choices: [{ text: 'I need power for my ship.', goto: 'power' }, { text: 'Thank you, Ama.', end: true }],
        },
        power: {
          say: ['Power. Hm. The only power in this desert is the water that makes the tree drink. When it rises, everything wakes: the fire, the people, the old stones.', 'Here. A drinking jar. If the water rises, fill it. We’ll need it for the drinking anyway, and maybe it will wake your ball too.', 'Find the Speaker. If anyone knows why the water is late, it’s him.'],
          do: [{ give: 'jar' }, { set: { 'desert.jar.given': true } }],
          choices: [
            { text: 'Where is the Speaker?', goto: 'where' },
            { text: 'I’ll bring it back full.', end: true },
          ],
        },
        where: { say: ['Walking the circuit round the walls, like everyone. Follow the banners. Listen for the drum.'], choices: [{ text: 'Thank you.', end: true }] },
        again: {
          say: [{ if: { has: 'water' }, text: 'Your jar is heavy. Full? Then go, wake your ball. And thank you.' }, { if: { not: { has: 'water' } }, text: 'Still looking? The Speaker walks the circuit. The well is at the tree’s roots, past the gate.' }],
          choices: [
            { text: 'Have you seen anything strange lately?', goto: 'rumour', once: true },
            { text: 'Who is that boy staring at the fire?', if: { quest: 'desert.drum', started: false }, goto: 'teo' },
            { text: 'See you, Ama.', end: true },
          ],
        },
        rumour: { say: ['Strange? A ball fell out of the sky with someone in it. That will do for this year.', 'Old Oum says she saw a light fall the night before. She saw it sing, she says. Oum sees a lot of things.'], choices: [{ text: 'Where is Oum?', goto: 'oum' }, { text: 'Thanks.', end: true }] },
        oum: { say: ['Behind, as always. She fell behind the procession somewhere in the western dunes. Someone should fetch her, but nobody wants to lose their place in the circuit.'], do: { start: 'desert.oum' }, choices: [{ text: 'I’ll look for her.', end: true }] },
        teo: { say: ['Teo, our drummer. The wind took his drum on the way here, and he took his face off with it. Talk to him; it might help.'], choices: [{ text: 'I will.', end: true }] },
        drinking: {
          say: ['It drinks! Look at it, every colour. I knew you were good luck the moment you fell on us.', 'Fill the jar, if you haven’t. Then go and wake your ball.'],
          choices: [{ text: 'It was a bone in the channel. A giant’s rib.', goto: 'rib' }, { text: 'I will.', end: true }],
        },
        rib: { say: ['A rib. The giant is still breaking, then, even asleep under us. The Speaker will want a word for that.'], choices: [{ text: 'Goodbye, Ama.', end: true }] },
        after: {
          say: ['The pilgrims will walk home singing about the stranger who woke the water. They’ll get it all wrong. That’s how songs work.'],
          choices: [{ text: 'Keep the fires going, Ama.', end: true }],
        },
      },
    },
  },

  teo: {
    id: 'teo', name: 'Teo', title: 'a drummer without a drum', color: '#e6875f', voice: 1.25, kind: 'm',
    palette: { cloak: '#e6875f', lining: '#2b211f', cloth: '#3f6f6a', legs: '#4a3a2a', hat: '#d8a24a', hair: '#4a3226' }, head: 'hair', cape: 0,
    lines: ['…', 'Nobody keeps time like a drum.', 'Hands, no drum. Useless hands.'],
    talk: {
      entry: [
        { if: { quest: 'desert.drum', done: true }, node: 'after' },
        { if: { has: 'drum' }, node: 'back' },
        { if: { quest: 'desert.drum', active: true }, node: 'waiting' },
        { node: 'hello' },
      ],
      nodes: {
        hello: {
          say: ['Don’t mind me. I’m just a drummer with nothing to drum.', 'The wind took it. Eleven days walking and on the last night a gust lifted my drum off the camel and rolled it away like a wheel. Under the old bones, south of here. By the time I ran after it, it was dark.'],
          choices: [
            { text: 'I’ll look for it.', do: { start: 'desert.drum' }, goto: 'thanks' },
            { text: 'Can’t you play something else?', goto: 'else' },
            { text: 'Sorry, Teo.', end: true },
          ],
        },
        else: { say: ['Sefa says I can tap on a jar. A jar! The procession walks to the drum. Without it they walk out of step and step on each other’s heels.'], choices: [{ text: 'I’ll look for your drum.', do: { start: 'desert.drum' }, goto: 'thanks' }, { text: 'Bye.', end: true }] },
        thanks: { say: ['Really? It’s red, with a ring of shells. Under the great ribcage, south, past the place where your ball fell. Probably full of sand.'], choices: [{ text: 'I’ll bring it back.', end: true }] },
        waiting: { say: ['South, under the ribcage of the old beast. Red, with shells. You can’t miss it, unless the wind moved it again.'], choices: [{ text: 'On my way.', end: true }] },
        back: {
          say: ['That’s… that’s it! Sand in the shells and all.', 'Listen. Listen to this.'],
          do: [{ take: 'drum' }, { advance: 'desert.drum' }, { set: { 'desert.teo.drumming': true } },
            { keepsake: { id: 'desert.song', level: 'desert', name: 'Teo’s walking rhythm', kind: 'song', text: 'Dum, tek-dum. The rhythm a whole procession walks to. Teo says it is older than the city.' } }],
          next: 'played',
        },
        played: { say: ['That’s the walking rhythm. Every pilgrim’s feet know it. Take it with you, it doesn’t get smaller for being shared.'], choices: [{ text: 'Thank you, Teo.', end: true }] },
        after: { say: ['Dum, tek-dum. Can you hear how the circuit keeps step again?'], choices: [{ text: 'I can.', end: true }] },
      },
    },
  },

  sefa: {
    id: 'sefa', name: 'Sefa', title: 'oud player', color: '#8a6fb8', voice: 0.95, kind: 'f',
    palette: { cloak: '#8a6fb8', lining: '#2b211f', cloth: '#e2d3b4', legs: '#2b2f45', hat: '#62c3c9', hair: '#2b211f' }, head: 'hair', cape: 0.55,
    lines: ['♪', 'Stay a while. The song’s better with a listener.', 'You walk like you’re carrying something.'],
    talk: {
      entry: [{ if: { flag: 'desert.channel.open' }, node: 'feast' }, { if: { flag: 'met.sefa' }, node: 'again' }, { node: 'hello' }],
      nodes: {
        hello: {
          say: ['You stopped to listen. Most people walk past musicians as if we were weather.', 'I play what the listener is missing. Hear that? That’s your tune, not mine. You brought it with you.'],
          choices: [{ text: 'My tune?', goto: 'tune' }, { text: 'What do you play for the drinking?', goto: 'drinking' }, { text: 'Keep playing.', end: true }],
        },
        tune: { say: ['Everyone has one. Yours is a long way from home, and it keeps looking over its shoulder.'], choices: [{ text: 'Maybe it does.', end: true }] },
        drinking: { say: ['When the tree drinks we play all night, every song we know, in every colour. Bako cries every year, and says it’s the smoke.'], choices: [{ text: 'I hope it drinks.', end: true }] },
        again: { say: ['Back for more? Sit. Bako’s about to get it wrong in a beautiful way.'], choices: [{ text: '(listen)', end: true }] },
        feast: { say: ['Can you hear it? The tree is drinking, and the songs are all coming back at once.'], choices: [{ text: '(listen)', end: true }] },
      },
    },
  },

  bako: {
    id: 'bako', name: 'Bako', title: 'ney player', color: '#5fb7ad', voice: 0.75, kind: 'm',
    palette: { cloak: '#5fb7ad', lining: '#2b211f', cloth: '#5a4a3a', legs: '#3a3a3a', hat: '#f3ead8', hair: '#b0a89a' }, head: 'hat', cape: 0,
    lines: ['Hm.', 'Hmmm-hm.', '(he hums)'],
    talk: {
      nodes: {
        hello: {
          say: ['Hm. You’re the one from the ball. The ball with the burn on it.'],
          choices: [{ text: 'You saw the burn?', goto: 'burn' }, { text: 'What’s that flute?', goto: 'ney' }, { text: '(leave him to his music)', end: true }],
        },
        burn: { say: ['Three dots over a curve. {glyph} Like between the giant’s eyes, out past the back gate. Like on the old stones. Hm. Somebody signs their work.'], choices: [{ text: 'Who?', goto: 'who' }, { text: 'Thank you.', end: true }] },
        who: { say: ['If I knew that I wouldn’t need a flute. Hm-hm.'], choices: [{ text: '(leave him to his music)', end: true }] },
        ney: { say: ['A ney. Reed from the oasis at the salt. It only knows one song, and every year it plays it differently.'], choices: [{ text: 'Play it for me.', end: true }] },
      },
    },
  },

  ilo: {
    id: 'ilo', name: 'Ilo', title: 'too curious', color: '#f2c54b', voice: 1.7, kind: 'f', scale: 0.7,
    palette: { cloak: '#f2c54b', lining: '#2b211f', cloth: '#c8483a', legs: '#4a3a2a', hat: '#e6875f', hair: '#6e4a32' }, head: 'hair', cape: 0.55,
    lines: ['Are you from the sky?', 'I’m not allowed past the back gate.', 'Bet you can’t catch me!'],
    talk: {
      entry: [
        { if: { quest: 'desert.ilo', done: true }, node: 'after' },
        { if: { all: [{ quest: 'desert.ilo', stage: 'below' }, { flag: 'desert.cave.seen' }] }, node: 'tell' },
        { if: { quest: 'desert.ilo', stage: 'below' }, node: 'go' },
        { if: { quest: 'desert.ilo', stage: 'lead' }, node: 'come' },
        { node: 'hello' },
      ],
      nodes: {
        hello: {
          say: ['You fell out of the sky! I saw! Did it hurt? Is it hot inside the ball? Do you have a mother?', 'Listen. I know a secret. The giant outside the back gate has its mouth open, and the old people go in, and they come out wet. Wet! In the desert!', 'I want to see. But I’m not allowed past the back gate. Not alone.'],
          choices: [
            { text: 'Come with me, then. Stay close.', do: [{ start: 'desert.ilo' }, { set: { 'desert.ilo.following': true } }], goto: 'yes' },
            { text: 'Wet? Where exactly?', goto: 'where' },
            { text: 'Better ask your parents.', goto: 'parents' },
          ],
        },
        where: { say: ['In its mouth! Under the giant’s head, outside the back gate. The one with the three-dot mark on its forehead.'], choices: [{ text: 'Come with me, then.', do: [{ start: 'desert.ilo' }, { set: { 'desert.ilo.following': true } }], goto: 'yes' }, { text: 'Thanks, Ilo.', end: true }] },
        parents: { say: ['My mother is walking the circuit. She’ll walk until the tree drinks. That could be FOREVER.'], choices: [{ text: 'All right. Come with me.', do: [{ start: 'desert.ilo' }, { set: { 'desert.ilo.following': true } }], goto: 'yes' }, { text: 'Sorry, Ilo.', end: true }] },
        yes: { say: ['Yes! Yes yes. I’ll be quiet. I’m very quiet. Go, go!'], choices: [{ text: '(go)', end: true }] },
        come: { say: ['Keep going! The back gate is through the city, past the tree. I’m right behind you.'], choices: [{ text: '(go)', end: true }] },
        go: { say: ['I’ll wait right here, on the lip. Somebody has to keep watch. Go on, go down! Then tell me everything.'], choices: [{ text: 'I’ll be back.', end: true }] },
        tell: {
          say: ['You went! What’s down there? Tell me tell me tell me.'],
          choices: [
            { text: 'A pool of water in every colour, inside the giant’s chest. The tree’s roots drink from it.', do: [{ advance: 'desert.ilo' }, { set: { 'desert.ilo.told': 'true' } }], goto: 'truth' },
            { text: 'A sleeping monster. It sniffed me.', do: [{ advance: 'desert.ilo' }, { set: { 'desert.ilo.told': 'monster' } }], goto: 'monster' },
            { text: 'It’s a secret. You’ll see it yourself when you’re older.', do: [{ advance: 'desert.ilo' }, { set: { 'desert.ilo.told': 'secret' } }], goto: 'secret' },
          ],
        },
        truth: { say: ['Inside the giant… so the giant is the well. The giant IS the well! I’m going to draw it. I’m going to draw it on everything.'], choices: [{ text: '(smile)', end: true }] },
        monster: { say: ['I KNEW it. I knew it! I’m telling everyone. I’m telling the Speaker!'], choices: [{ text: '(oh no)', end: true }] },
        secret: { say: ['Hmph. Fine. But I’m going to be older really soon.'], choices: [{ text: '(laugh)', end: true }] },
        after: { say: [{ if: { flag: 'desert.ilo.told', is: 'monster' }, text: 'Nobody believes me about the monster. They will.' }, { if: { not: { flag: 'desert.ilo.told', is: 'monster' } }, text: 'When I’m big I’ll go down there myself. Then I’ll tell YOU things.' }], choices: [{ text: 'I’d like that.', end: true }] },
      },
    },
  },

  speaker: {
    id: 'speaker', name: 'The Speaker', title: 'who leads the procession', color: '#f3ead8', voice: 0.7, kind: 'm', scale: 1.08,
    palette: { cloak: '#f3ead8', lining: '#c8483a', cloth: '#e2d3b4', legs: '#5a4a40', hat: '#c8483a', hair: '#e8dcc0' }, head: 'hat', cape: 1.45,
    lines: ['Round, and round, and round.', 'Keep the step.', 'The tree is patient. So are we.'],
    talk: {
      entry: [
        { if: { quest: Q, done: true }, node: 'after' },
        { if: { flag: 'desert.channel.open' }, node: 'drinking' },
        { if: { flag: 'desert.speaker.heard' }, node: 'again' },
        { node: 'hello' },
      ],
      nodes: {
        hello: {
          say: ['Walk with me a moment; the circuit doesn’t stop for strangers. Though for you, it seems, it does.', 'You want to know why we walk. Everyone asks. We walk because the tree is thirsty, and walking is the only thing we know how to do about it.'],
          choices: [
            { text: 'Why is the tree thirsty?', goto: 'old' },
            { text: 'Ama says you know the old words.', goto: 'old' },
          ],
        },
        old: {
          say: ['The old words say: *the giants came down from the swamp of lights, carrying the water, and walked until they could not.* Where they lay down, the water stayed in them.', 'One of them lies beneath Qanat. The tree grows from its heart. Once a year the water rises in it, through the roots, up to the well, and the tree drinks.', 'This year it hasn’t. Either the tree has stopped wanting, or the giant has stopped giving. The old words don’t say which is worse.'],
          do: { set: { 'desert.speaker.heard': true } },
          choices: [
            { text: 'Where does the water come up?', goto: 'well' },
            { text: 'The swamp of lights?', goto: 'swamp' },
            { text: 'What happens if it never drinks?', goto: 'never' },
          ],
        },
        well: { say: ['At the well, in the tree’s roots, inside the walls. Go and look; it’s dry as a bone. Some say the old people once went down to the water itself, beneath the giant. Nobody remembers the way. Or nobody admits it.'], choices: [{ text: 'I’ll look.', end: true }, { text: 'The swamp of lights?', goto: 'swamp' }] },
        swamp: { say: ['A place of glowing water and plants that sing. Far, very far; farther than walking. Maybe you’ve flown over it, in your ball.'], do: { set: { 'clue.desert.perdide': true } }, choices: [{ text: 'Not yet.', goto: 'well' }] },
        never: { say: ['Then we walk until we forget why. Then we keep walking anyway, because by then the walking is the reason.'], choices: [{ text: 'Where does the water come up?', goto: 'well' }] },
        again: {
          say: ['Still here, little star? The well is at the tree’s roots. Beyond the back gate, the giant’s head watches the dunes. Make of that what you can.'],
          choices: [
            { text: 'Have you seen an old woman who fell behind?', if: { quest: 'desert.oum', done: false }, goto: 'oum' },
            { text: 'Have you heard of a masked head in the sand?', if: { quest: 'desert.mask', started: false }, goto: 'mask' },
            { text: 'Walk on, Speaker.', end: true },
          ],
        },
        oum: { say: ['Oum. She walks the circuit at her own pace, which is no pace at all. West, in the dunes. Bring her if you can; the drinking needs everyone.'], do: { start: 'desert.oum' }, choices: [{ text: 'I’ll find her.', end: true }] },
        mask: { say: ['The sleeping face, south, past the bones. Another giant, they say, who lay down face up so it could watch the sky. It does not wake. Go and look at it, if you like being looked at.'], do: { start: 'desert.mask' }, choices: [{ text: 'I will.', end: true }] },
        drinking: {
          say: ['It drinks. It drinks! Listen: every drum in the circuit has found the same step.', 'You went beneath the giant. I can see the colours on your hands. Don’t tell me what you saw. I’d rather keep the old words a little longer.'],
          choices: [{ text: 'A rib had fallen across the water.', goto: 'rib' }, { text: 'Your secret is safe.', end: true }],
        },
        rib: { say: ['Then the giant is still dying, slowly, under our feet. And still giving. That’s a word I’ll add to the old ones.'], choices: [{ text: 'Walk on, Speaker.', end: true }] },
        after: { say: ['When you’re far away and someone asks what the desert gave you, say: water, a jar, a step to walk to. Don’t say power. It sounds so small.'], choices: [{ text: 'I’ll remember.', end: true }] },
      },
    },
  },

  oum: {
    id: 'oum', name: 'Oum', title: 'who fell behind', color: '#b7a0cf', voice: 0.85, kind: 'f', scale: 0.94,
    palette: { cloak: '#b7a0cf', lining: '#2b211f', cloth: '#e2d3b4', legs: '#5a4a40', hat: '#f3ead8', hair: '#e8dcc0' }, head: 'wrap', cape: 1.45,
    lines: ['Eh? Who’s there?', 'My feet are older than the city.', 'Wait for me!'],
    talk: {
      entry: [
        { if: { quest: 'desert.oum', done: true }, node: 'home' },
        { if: { quest: 'desert.oum', stage: 'lead' }, node: 'walking' },
        { node: 'hello' },
      ],
      nodes: {
        hello: {
          say: ['Ah. Someone who walks faster than me. That’s everyone, child; don’t look so pleased.', 'I fell behind the circuit. Then I fell behind the people who fell behind. Now I’m behind nobody. That’s a kind of first place.'],
          choices: [
            { text: 'Walk with me to the camps. I’ll go slowly.', do: [{ start: 'desert.oum' }, { stage: ['desert.oum', 'lead'] }, { set: { 'desert.oum.following': true } }], goto: 'yes' },
            { text: 'Ama says you saw a light fall.', goto: 'light' },
          ],
        },
        light: {
          say: ['I did. The night before your ball came down. A light crossed the whole sky, slow, and it sang. Like a bowl you strike with a stone, but long, long.', 'Then it turned. Stars don’t turn, child. And then your ball came down after it, burning.'],
          do: { set: { 'desert.rumour.light': true } },
          choices: [{ text: 'It struck my ship.', goto: 'struck' }, { text: 'Walk with me to the camps.', do: [{ start: 'desert.oum' }, { stage: ['desert.oum', 'lead'] }, { set: { 'desert.oum.following': true } }], goto: 'yes' }],
        },
        struck: { say: ['Then it was looking for you, or you were in its way. Either is a story. Let me lean on your arm and I’ll tell you which I prefer.'], choices: [{ text: 'Come, then.', do: [{ start: 'desert.oum' }, { stage: ['desert.oum', 'lead'] }, { set: { 'desert.oum.following': true } }], goto: 'yes' }] },
        yes: { say: ['Slowly, mind. If you run, I’ll sit down and you can come back for me.'], choices: [{ text: '(walk slowly)', end: true }] },
        walking: { say: ['We’re going the right way, I hope? I can smell Ama’s fires. She burns too much thornwood.'], choices: [{ text: 'Not far now.', end: true }] },
        home: {
          say: ['Look at that. A seat by the fire and a stranger to thank. Here, take this cord. One knot for every circuit I walked. I lost count at forty.'],
          do: [{ give: 'cord' }, { set: { 'desert.oum.thanked': true } }],
          next: 'home2',
        },
        home2: { say: ['When you meet that singing light again, and you will, ask it why it turned.'], choices: [{ text: 'I will, Oum.', end: true }] },
      },
    },
  },

  hessa: {
    id: 'hessa', name: 'Hessa', title: 'keeper of the well', color: '#62c3c9', voice: 0.95, kind: 'f',
    palette: { cloak: '#62c3c9', lining: '#2b211f', cloth: '#f3ead8', legs: '#2b2f45', hat: '#f3ead8', hair: '#4a3226' }, head: 'hood', cape: 1.45,
    lines: ['The well is dry. Don’t lean on it.', 'Every year I sweep the well for the water. Every year.', 'The stele tells it better than me.'],
    talk: {
      entry: [{ if: { flag: 'desert.channel.open' }, node: 'full' }, { node: 'hello' }],
      nodes: {
        hello: {
          say: ['I keep the well. That means I sweep it, and wait, and sweep it again. The water comes up through the roots, here, every year. This year it’s only dust.', 'Read the stele, if you can read stone. The giants carry the water to the tree. That’s all it says. That’s all it needs to say.'],
          choices: [
            { text: 'Where does the water come from?', goto: 'from' },
            { text: 'What’s the mark above the carving?', goto: 'glyph' },
            { text: 'I’ll let you sweep.', end: true },
          ],
        },
        from: { say: ['From below. From the giant. Its head lies outside the back gate; its heart lies under our feet. The old keepers went down through its mouth to clean the channel, so my grandmother said. Nobody has gone down in my lifetime.'], choices: [{ text: 'Through its mouth?', goto: 'mouth' }] },
        mouth: { say: ['Propped open with carved stones. Children dare each other to touch the teeth. Don’t tell Ilo I told you.'], choices: [{ text: 'I won’t.', end: true }] },
        glyph: { say: ['{glyph} The keepers call it the Giver’s mark. The pilgrims from the salt call it the Eye That Fell. The children call it the bird. Nobody knows who put it there first.'], choices: [{ text: 'Where does the water come from?', goto: 'from' }, { text: 'Thank you, Hessa.', end: true }] },
        full: { say: ['Look at it. Look! It came up through the roots in every colour, like it used to. I didn’t even have time to finish sweeping.'], choices: [{ text: 'It was waiting for someone to clear the way.', end: true }] },
      },
    },
  },

  marrow: {
    id: 'marrow', name: 'Marrow', title: 'salvager and liar', color: '#dca273', voice: 1.0, kind: 'm',
    palette: { cloak: '#dca273', lining: '#2b211f', cloth: '#34405e', legs: '#4a3a2a', hat: '#d8a24a', hair: '#2b211f' }, head: 'hat', cape: 0.9,
    lines: ['Bones, glass, bits of sky. Cheap.', 'Everything that falls belongs to somebody. Usually me.', 'Psst. Sky-person.'],
    talk: {
      nodes: {
        hello: {
          say: ['Sky-person! I’ve been out to your ball already. Don’t look like that, I didn’t take anything. Much.', 'There’s a burn on the side of it. Not a scrape; a burn, in a shape. Three dots over a curve. {glyph}'],
          choices: [
            { text: 'What does it mean?', goto: 'mean' },
            { text: 'What do you sell?', goto: 'sell' },
            { text: 'Stay away from my ship.', end: true },
          ],
        },
        mean: { say: ['It means somebody signs their work. The same mark is on the giants, on the old stones, on the gates. I’ve seen it on things that fell out of the sky before, too. Never on anything that was still warm.'], choices: [{ text: 'Things that fell before?', goto: 'before' }, { text: 'Thanks, Marrow.', end: true }] },
        before: { say: ['Bits, mostly. A shard of glass that hums when it rains. A bowl that rings by itself. Things that sing don’t fall by accident, sky-person. That’s my professional opinion, free of charge.'], choices: [{ text: 'Thanks, Marrow.', end: true }] },
        sell: { say: ['Today? Rumours. The tree hasn’t drunk because the giant’s holding its breath. The water’s late because the Speaker walks the wrong way round. The ball fell because you sneezed. Pick one.'], choices: [{ text: 'I’ll pass.', end: true }] },
      },
    },
  },
};

// The scenery you can look at: same panel, a different voice.
export const THINGS = {
  well: {
    id: 'well', name: 'The dry well', title: 'at the tree’s roots', color: '#5a4a40', voice: 0.6,
    talk: {
      entry: [{ if: { flag: 'desert.channel.open' }, node: 'full' }, { node: 'dry' }],
      nodes: {
        dry: {
          say: ['The well is swept clean and bone dry. Far below the stones, you hear something: water, moving slowly, a long way down, as if it can’t find the way up.', 'Roots as thick as your arm go down the shaft. The stones round the rim are carved with kneeling figures, all facing the back gate.'],
          do: { set: { 'desert.well.seen': true } },
          choices: [{ text: '(look toward the back gate)', end: true }],
        },
        full: { say: ['The well is brimming. The water turns slowly in every colour, and the roots are drinking it.'], choices: [{ text: '(watch it)', end: true }] },
      },
    },
  },
  stele: {
    id: 'stele', name: 'The stele', title: 'carved stone', color: '#e9dcc0', voice: 0.6,
    talk: { nodes: { read: {
      say: ['Three tall figures, bent under jars, walk toward a burning tree. Water runs at their feet. Above them, the mark: {glyph}', 'Someone has rubbed the giants’ faces smooth with their thumbs, over a very long time.'],
      do: { set: { 'desert.stele.read': true } }, choices: [{ text: '(step back)', end: true }],
    } } },
  },
  brow: {
    id: 'brow', name: 'The giant’s brow', title: 'the fallen giant', color: '#f2ead6', voice: 0.6,
    talk: { nodes: { look: {
      say: ['The skull is bigger than a house. Between its eyes, worn into the bone, the mark: {glyph} It glows faintly, like the water in a jar held up to the sun.', 'Between the teeth, carved stones prop the jaw open. Cool air breathes out of the dark.'],
      do: { set: { 'desert.brow.seen': true } }, choices: [{ text: '(go on)', end: true }],
    } } },
  },
  mural: {
    id: 'mural', name: 'The mural', title: 'in the giant’s chest', color: '#e9dcc0', voice: 0.6,
    talk: { nodes: { look: {
      say: ['Giants, lying down one after another, end to end. From each of them a stream runs out, and all the streams run to a tree.', 'It looks less like a picture of something that happened than like a set of instructions.'],
      do: [{ set: { 'desert.mural.read': true } }, { keepsake: { id: 'desert.knowing', level: 'desert', name: 'What the giants left', kind: 'knowing', text: 'The giants carried the water. The tree drinks what they left.' } }],
      choices: [{ text: '(remember it)', end: true }],
    } } },
  },
  bone: {
    id: 'bone', name: 'The fallen rib', title: 'across the channel', color: '#f2ead6', voice: 0.6,
    talk: { nodes: { look: {
      say: ['A rib, as long as three people, has broken from the arch above and fallen across the stone channel. Behind it, water stands bright and trapped; in front of it, the channel is dry.', 'It’s far too heavy to lift by hand. But it might roll, with a strong enough shove of the fluid. (*Push*: C, middle click, or B / ○.)'],
      choices: [{ text: '(step back)', end: true }],
    } } },
  },
};

// What crowd people say when you stop beside them (balloons), and their
// short conversations (E) by where they are.
export const LINES = {
  procession: ['We walk the circuit until the tree drinks.', 'Keep the step, stranger!', 'Seven times round, then seven again.', 'My grandmother walked this circuit. Hers too.', 'The water rises from beneath the giants. Every year.', 'Listen to the drum. It keeps our feet together.', 'Are you here for the drinking?', 'Don’t stop in the middle, you’ll get trodden on.'],
  drinking: ['It drinks! It drinks!', 'Every colour! Look!', 'One more circuit, for joy!', 'I told you it would.', 'Sing, everyone!'],
  camp: ['Ama’s fires never go out.', 'The tree is late this year.', 'Did you see the light that fell? It sang.', 'Eleven days we walked.', 'Sit, sit.', 'Who are you, then?', 'Sefa plays better when someone listens.'],
  gate: ['We wait here for the Speaker’s word.', 'The well is dry. Imagine.', 'Mind the steps, they’re older than the walls.'],
};

/** Short conversations for people in the crowd, by where they stand. Picked by their seed. */
export const CROWD_TALK = {
  procession: [
    { name: 'A pilgrim', title: 'walking the circuit', talk: { nodes: {
      hello: { say: ['Walk beside me, if you like; just don’t stop. We walk the circuit round Qanat until the tree drinks.'], choices: [{ text: 'Why walk round and round?', goto: 'why' }, { text: 'Walk on.', end: true }] },
      why: { say: ['So it knows we’re waiting. A tree can’t see, but it can hear feet. Seven times round for every year it has drunk. We’ve lost count, of course.'], choices: [{ text: 'Walk on.', end: true }] },
    } } },
    { name: 'A banner bearer', title: 'in the procession', talk: { nodes: {
      hello: { say: ['This banner has walked the circuit eighty years. The cloth’s been changed nine times, the pole twice. Same banner.'], choices: [{ text: 'What’s on it?', goto: 'what' }, { text: 'Walk on.', end: true }] },
      what: { say: ['The Giver’s mark, three dots and a curve. {glyph} My father said it’s the giants’ eyes, looking up. My mother said it’s rain over a hill. They argued about it every circuit.'], choices: [{ text: 'Walk on.', end: true }] },
    } } },
    { name: 'A tired walker', title: 'in the procession', talk: { nodes: {
      hello: { say: ['Eleven days across the dunes and now round and round. My feet have opinions. But it’s the drinking. You don’t miss the drinking.'], choices: [{ text: 'What happens at the drinking?', goto: 'what' }, { text: 'Walk on.', end: true }] },
      what: { say: ['The water comes up through the roots, the fire goes cool and every colour, and everyone drinks a mouthful from the same jar. Then we sing until the jar is empty and the morning comes.'], choices: [{ text: 'Walk on.', end: true }] },
    } } },
  ],
  drinking: [
    { name: 'A pilgrim', title: 'singing', talk: { nodes: { hello: { say: ['It drank! Did you see? Every colour, just like my grandmother said. One more circuit, for joy!'], choices: [{ text: 'Walk on.', end: true }] } } } },
  ],
  camp: [
    { name: 'A pilgrim', title: 'by the fire', talk: { nodes: {
      hello: { say: ['Warm yourself. Ama’s fires are the only thing in this desert that’s never late.'], choices: [{ text: 'Is something late?', goto: 'late' }, { text: 'Thanks.', end: true }] },
      late: { say: ['The water. The drinking. Us, getting home. Eleven days walking for a dry well.'], choices: [{ text: 'Thanks.', end: true }] },
    } } },
    { name: 'A trader', title: 'resting', talk: { nodes: {
      hello: { say: ['You came out of the sky-ball? Then you saw the light that fell before it. Everyone’s talking about it. A singing light. I heard it, I swear. Like a bowl rubbed with a wet finger.'], choices: [{ text: 'Where did it fall?', goto: 'where' }, { text: 'Thanks.', end: true }] },
      where: { say: ['It didn’t fall. That’s the strange thing. It went down behind the dunes and then it went up again.'], choices: [{ text: 'Thanks.', end: true }] },
    } } },
    { name: 'A child', title: 'bored', talk: { nodes: {
      hello: { say: ['Have you seen Ilo? She said she’d show me the giant’s teeth. She’s always saying things.'], choices: [{ text: 'I’ll keep an eye out.', end: true }] },
    } } },
  ],
  gate: [
    { name: 'A pilgrim', title: 'at the gate', talk: { nodes: {
      hello: { say: ['We wait at the gate for the Speaker to call us in to the drinking. Every year he calls. This year he just keeps walking.'], choices: [{ text: 'Thanks.', end: true }] },
    } } },
  ],
};
