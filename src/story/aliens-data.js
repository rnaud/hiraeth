// The non-humanoid people of the worlds (src/aliens/, docs/systems/aliens.md): the drifters of the
// Garden of Spheres, Vael's stilt-walkers, Lorn II's shellbacks and the Signal Market's murmurs.
// Bystanders, all of them: listen-only talk (src/story/dialogue.js pickListen) with hints while a
// quest is at the step they know about, the world's wisdom, a brush-off, something funny, and a
// line once the world's story is done. Every line carries a tone (src/story/tone.js): on a body
// with no face it shows as a glow, a pose and a rhythm (src/aliens/species.js TONE_BODY).
//
//   ALIENS[levelId] = [{ id, name, title, species, at: [x, z], y?, wander? (m) | route? [[x, z]…],
//                        heading?, pace?, voice, kind, color, tint?, lines (balloons), talk: { listen } }]
//   ALIEN_LINES[species] = { splashed, pushed, singed }   what they say when the fluid tool hits them
//
// (`color` is theirs for the conversation's name chip and the portrait's backdrop.)

const SPHERES = 'spheres.listen', VAEL = 'arzach.bird', LAMPS = 'perdide2.lamps', SIGNAL = 'bazaar.signal';

export const ALIENS = {
  // ------------------------------------------------------------ the Garden of Spheres: drifters
  spheres: [
    {
      id: 'ommo.drifter', name: 'Ommo', title: 'eldest of the drifters', species: 'drifter', at: [-17, -16], wander: 7,
      voice: 0.62, kind: 'm', color: '#d9b8d4', age: 'elder',
      lines: ['~solemn~ Walk softly. The grass is listening.', '~happy~ A new shape on the path. Hello, new shape.'],
      talk: { listen: [
        { if: { quest: SPHERES, stage: 'aube' }, say: ['~solemn~ You found the umbrella trees. Good. They are almost as old as I am.', '~neutral~ The spheres are Linnet’s work. Ask *Linnet, in the grove*. She talks faster than I do.'] },
        { if: { quest: SPHERES, stage: 'listen' }, say: '~whisper~ The spheres that remember hum under your feet. *Splash them* with your bright water, then keep still while they play.' },
        '~solemn~ We came down with the spheres, my mother said. They fell; we floated. We still argue about who was luckier.',
        '~solemn~ The night the light passed, every thread I have pointed the same way, like grass in a river. Then it turned, and they all fell slack.',
        '~tired~ Four hundred summers, and the plaza has never once been quite swept.',
        { after: { quest: SPHERES, done: true }, say: '~happy~ The great sphere answered. I felt it in my threads before I heard it. Thank you for the noise.' },
      ] },
    },
    {
      id: 'veil.drifter', name: 'Veil', title: 'a drifter by the lake', species: 'drifter', at: [152, -42], wander: 10,
      voice: 1.0, kind: 'f', color: '#e8c4cf', tint: { skin: '#eccfd3', rib: '#d49cab', rim: '#b8748a', glow: '#ffd9b0' },
      lines: ['~curious~ Oh. You are standing on the ground again.', '~playful~ Look how still the lake is. Look how still I am.'],
      talk: { listen: [
        '~curious~ You walk on the ground? All the time? Doesn’t it wear your feet out?',
        '~playful~ Nell says upside down is just another way up. For us it is the only way. We have tried the other.',
        '~tired~ Not now. I am watching a cloud. It has almost finished becoming a sphere.',
        '~neutral~ (She turns slowly away from you, then slowly back.) I was not leaving. I was looking at the lake.',
        { if: { quest: 'spheres.pebble', stage: 'glint' }, say: '~whisper~ Something glints in the still water off the *south shore*. It has been winking at me all morning. Splash it.' },
      ] },
    },
    {
      id: 'hum.drifter', name: 'Hum', title: 'a drifter on the plaza', species: 'drifter', at: [24, -606], wander: 8,
      voice: 0.8, kind: 'm', color: '#c9b4e0', tint: { skin: '#d9cdea', rib: '#a991c9', rim: '#8a6fb8', glow: '#ffe9b8' },
      lines: ['~neutral~ Mind the pole. It is humming to itself.', '~solemn~ This is where it turned.'],
      talk: { listen: [
        { if: { quest: SPHERES, stage: ['plaza', 'pole'] }, say: '~curious~ Ume keeps the pole. It hums when it is splashed. Go on, *splash the humming pole*. It likes you already.' },
        '~solemn~ Ume saw an Answerer turn over this plaza. So did I. I was underneath. It was very large and it did not say excuse me.',
        '~neutral~ We drift where the air is quietest. Today that is here. Tomorrow, probably, also here.',
        '~playful~ Ume says I hum off-key. I say the pole does.',
        { after: { quest: SPHERES, done: true }, say: '~happy~ Three old sounds at once, on this plaza. I will be humming that for a hundred years. Ume will hate it.' },
      ] },
    },
    {
      id: 'pell.drifter', name: 'Slow Orm', title: 'walking the avenue', species: 'drifter', at: [-17, -380], route: [[-17, -560], [-17, -380]], pace: 0.45,
      voice: 0.9, kind: 'f', color: '#d6c6a8', tint: { skin: '#ece2c8', rib: '#c9b48a', rim: '#a08a5c', glow: '#ffe2a0' },
      lines: ['~playful~ Pass me if you like. Everyone does.', '~solemn~ Slowly. It is that kind of road.'],
      talk: { listen: [
        { if: { quest: 'spheres.avenue', active: true }, say: '~whisper~ You are walking the avenue slowly too? Then we are racing. I am winning.' },
        '~solemn~ Cael says it is that kind of road. I have been on it eleven years. I am nearly at the end.',
        '~playful~ Go on, pass me. The cypresses and I will talk about you.',
        '~curious~ What is the hurry where you come from? Is something chasing it?',
      ] },
    },
  ],

  // ------------------------------------------------------------ Vael: stilt-walkers (they say very little)
  arzach: [
    {
      id: 'ivet.stilt', name: 'Ivet', title: 'a stilt-walker', species: 'stilt', at: [34, -18], y: -4.5, wander: 14,
      voice: 0.7, kind: 'f', color: '#e2c79a',
      lines: ['~neutral~ (A lantern, high up, turns to look at you.)', '~whisper~ Small.'],
      talk: { listen: [
        { if: { quest: VAEL, stage: 'watcher' }, say: '~whisper~ (It points its lantern at the woman sitting on the stone, then folds one long leg, slowly, like sitting down.) Sit.' },
        { if: { quest: VAEL, stage: 'tower' }, say: '~neutral~ (Its lantern tips toward the lone tower, then rises up its side, swaying, like a thing carried on the wind.) Up.' },
        '~neutral~ (It lowers its lantern to look at you. Then lifts it again.) Small.',
        '~playful~ (It steps over you carefully, one leg at a time, and looks back.) Low.',
        '~curious~ (It bends its long knees to bring the lantern down to your pack, and looks at the fluid a long time.) Bright.',
        { after: { quest: VAEL, done: true }, say: '~happy~ (Its lantern follows the bird across the sky, a long way.) Chose.' },
      ] },
    },
    {
      id: 'weir.stilt', name: 'Weir', title: 'who taps the stones', species: 'stilt', at: [120, -78], y: -21.7, wander: 6,
      voice: 0.55, kind: 'm', color: '#c9a67a', tint: { cloth: '#a0705a', band: '#5c3f34', glow: '#ffb35c' },
      lines: ['~neutral~ (Tap. Tap. Tap.)', '~solemn~ Listen.'],
      talk: { listen: [
        { if: { quest: 'arzach.hand', active: true }, say: '~neutral~ (It taps the ground with its feet: the lowest note, a higher one, the highest. It looks at the stone hand.) Small. Tall.' },
        '~solemn~ (It holds one foot on a stone, very still, as if listening through it.) Hums.',
        '~tired~ (It does not look down. A long leg steps around you.)',
        '~solemn~ (Its lantern dims, then flares three times, slowly.) Light. Went over. Turned. We looked up.',
      ] },
    },
    {
      id: 'oul.stilt', name: 'Oul', title: 'who watches the sky', species: 'stilt', at: [168, -250], y: 17.7, wander: 5,
      voice: 0.62, kind: 'm', color: '#eadfca', tint: { cloth: '#8f8aa8', band: '#4c4866', glow: '#ffd88a' },
      lines: ['~solemn~ (It is looking at the sky. It goes on looking at the sky.)', '~whisper~ Up.'],
      talk: { listen: [
        '~solemn~ (It tips its lantern toward the lone tower, then up, toward the sky.) Still looking.',
        '~tired~ (Its lantern does not come down. It is busy with the sky.)',
        '~curious~ (It lowers its lantern all the way to your face. Looks. Lifts it again.) Far?',
        { after: { quest: VAEL, done: true }, say: '~happy~ (Its lantern brightens as the bird goes over.) She came.' },
      ] },
    },
  ],

  // ------------------------------------------------------------ Lorn II: shellbacks
  perdide2: [
    {
      id: 'moor.shell', name: 'Moor', title: 'a shellback on the path', species: 'shell', at: [-14, -100], y: 0.4, wander: 4,
      voice: 0.58, kind: 'm', color: '#8ea27a',
      lines: ['~neutral~ Mind my foot. It is most of me.', '~tired~ Going to the cave. Set out in spring.'],
      talk: { listen: [
        { if: { quest: LAMPS, stage: 'hollin' }, say: '~neutral~ Hollin is on the island, by the big lamp. He has practised “welcome” for forty years. Let him say it.' },
        { if: { quest: LAMPS, stage: 'pools' }, say: ['~sad~ Three pools along the path went dark the night the sky rang. We all pulled in at once.', '~curious~ The pools take colours. Yours are bright ones. *Shoot the dark pools* and see.'] },
        { if: { quest: LAMPS, stage: 'answer' }, say: '~surprised~ Three short, one long, from across the water. My eyes went all the way up. *Whistle for the skiff*.' },
        '~tired~ Hurry is for people without a house. I have mine with me.',
        '~playful~ I am going to the cave. I set out in spring. Don’t wait for me.',
        '~curious~ You came over the water in a ball? (Its eyes go all the way up.) We came over the water in a hurry, once. It took a year.',
      ] },
    },
    {
      id: 'sill.shell', name: 'Sill', title: 'who lives by the moss domes', species: 'shell', at: [-24, -137], y: 0.4, wander: 3,
      voice: 0.95, kind: 'f', color: '#9d8fbf', tint: { moss: '#e6cfa6', band: '#6f8fb0', pale: '#a7b884', skin: '#e2dde9', glow: '#ffc98a' },
      lines: ['~curious~ Hello. Hello.', '~whisper~ The domes are listening. So am I.'],
      talk: { listen: [
        '~whisper~ Pim says nobody built the domes, they were found. My grandmother says otherwise. She was a very large shellback. Don’t tell Pim.',
        '~curious~ You carry your house on your back too? (It looks at your tank.) A small house. With weather in it.',
        '~neutral~ (Its eyes go up their stalks, one, then the other.) Hello. Hello.',
        '~playful~ Robin runs. Bram runs. I don’t run. I have never once been late, because I never said when.',
      ] },
    },
    {
      id: 'turl.shell', name: 'Old Turl', title: 'by the root cave', species: 'shell', at: [-12, -388], y: 0.4, wander: 3,
      voice: 0.48, kind: 'm', color: '#7d8a62', age: 'elder', tint: { moss: '#bba878', band: '#6b5687', pale: '#8f9f6e', skin: '#cbd5c2', glow: '#ffd890' },
      lines: ['~solemn~ The cave keeps its own time.', '~tired~ Mm. Another fast one.'],
      talk: { listen: [
        { if: { quest: LAMPS, stage: 'tell' }, say: '~surprised~ Hollin went past me to the *root cave*. Walking fast. I have never seen Hollin walk fast.' },
        '~solemn~ Slow is how you see everything twice.',
        '~neutral~ Bram minds the cave mouth. I mind Bram. Somebody has to.',
        '~sad~ The two who borrowed Fen’s skiff went past me, long ago. I said good evening. They said it back. That was all, and I kept it.',
        { after: { quest: LAMPS, done: true }, say: '~happy~ All the pools are lit. I counted them. It took the afternoon. Worth it.' },
      ] },
    },
  ],

  // ------------------------------------------------------------ the Signal Market: murmurs (five, speaking as one)
  bazaar: [
    {
      id: 'murmur.gate', name: 'The Tullos', title: 'five murmurs at the market gate', species: 'murmur', at: [-9, 70], wander: 6,
      voice: 1.25, kind: 'f', color: '#e9dfe9', members: 5,
      lines: ['~playful~ We heard you! We hear everyone!', '~happy~ Welcome, welcome, welcome, welcome, welcome.'],
      talk: { listen: [
        { if: { quest: SIGNAL, stage: 'sel' }, say: '~curious~ The silent tower, straight ahead. Its keeper waits at its foot, in *Signal Square*. We all say so.' },
        '~neutral~ We are not five people. We are one Tullo, five times. It saves on chairs.',
        '~playful~ We heard you coming before you landed. We hear everything. It is a lot.',
        '~tired~ We are counting ourselves. One, two, three, four… we lost count. Come back later.',
      ] },
    },
    {
      id: 'murmur.square', name: 'The Mimmis', title: 'murmurs in Signal Square', species: 'murmur', at: [-15, -205], wander: 5,
      voice: 1.1, kind: 'm', color: '#e7d6d0', members: 5, tint: { members: ['#ffffff', '#f6e2e2', '#efe7d8', '#f2dce6', '#ffffff'] },
      lines: ['~whisper~ Shh. We are listening to the tower.', '~curious~ Did you hear that? Neither did we.'],
      talk: { listen: [
        { if: { quest: SIGNAL, stage: 'kip' }, say: '~whisper~ A courier ran up to the *second skybridge*. He hums when he runs. We know a hum when we hear one.' },
        '~solemn~ The night the sky rang, the five of us said one word at once. None of us knew it. We still say it sometimes, by accident.',
        '~neutral~ The tower never talked. We liked it for that. Everything else here talks.',
        '~playful~ Sel says we finish each other’s sentences. We say we never start them alone.',
        { after: { flag: 'bazaar.broadcast.on' }, say: '~sad~ We heard the tower speak. A man, calling for someone. We keep saying it over to each other, quietly, so it lasts.' },
      ] },
    },
    {
      id: 'murmur.stall', name: 'The Zells', title: 'murmurs selling secondhand news', species: 'murmur', at: [11, -30], wander: 4,
      voice: 1.4, kind: 'f', color: '#dfe6e2', members: 4, tint: { members: ['#ffffff', '#e6f2ec', '#f0ece2', '#e9e6f6'] },
      lines: ['~shout~ News! Secondhand news! Hardly heard!', '~playful~ Only slightly repeated!'],
      talk: { listen: [
        '~shout~ News! Secondhand news! Hardly heard, only slightly repeated! Half price for things you already know!',
        '~curious~ Is that a backpack, or is it full of weather? We could sell you a smaller one.',
        '~angry~ There are four of us today. The fifth one is sulking. We are not saying where.',
        { if: { quest: SIGNAL, stage: ['tune', 'play'] }, say: '~whisper~ Up on the balcony, three bulbs. Light them all at once and the tower listens. We heard Ferro say so. Twice. Loudly.' },
      ] },
    },
  ],
};

/** What they say when the fluid tool hits them, by species. */
export const ALIEN_LINES = {
  drifter: {
    splashed: ['~surprised~ Oh! Colours, all down my threads!', '~playful~ That tickles. All the way down.', '~curious~ Was that rain? Rain is not usually purple.'],
    pushed: ['~surprised~ I am floating away… I am floating back.', '~angry~ Mind the threads!', '~scared~ Please, I am mostly air!'],
    singed: ['~surprised~ Warm! I am going up!', '~shout~ Too warm, too high!'],
  },
  stilt: {
    splashed: ['~surprised~ (Its lantern flickers.) Wet.', '~angry~ (It shakes one leg dry, then the next, then the next.)'],
    pushed: ['~scared~ (It totters, steps, steps, and stands.) Careful.', '~angry~ (Its lantern flares at you.) No.', '~surprised~ (Three quick steps back.) Oh.'],
    singed: ['~surprised~ (Its lantern flares, as if it were answering.) Hot.'],
  },
  shell: {
    splashed: ['~surprised~ Oop! (Its eyes pop back down their stalks.)', '~curious~ Is it raining sideways now?'],
    pushed: ['~scared~ Whoa… rolling… rolling…', '~angry~ I was walking! Slowly, but walking!', '~tired~ Now I have to do the whole path again.'],
    singed: ['~surprised~ Hot doorstep! Hot doorstep!'],
  },
  murmur: {
    splashed: ['~surprised~ Wet! Wet! Wet! Wet! Wet!', '~playful~ Again! No! Yes! No!'],
    pushed: ['~scared~ Scatter! No, regroup! Which one?', '~angry~ Hey! We were in order!', '~surprised~ Whee! Ow! Whee!'],
    singed: ['~shout~ Hot hot hot hot hot!'],
  },
};
