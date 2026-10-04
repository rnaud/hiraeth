// The Garden of Spheres' story as data: "What the Spheres Remember"
// (docs/story-bible.md).
//
// The spheres came down long ago, and each one remembers one sound: the last
// thing it heard before it fell, the listeners say. They only remember for
// someone who stops: stand still beside one and it plays its sound. Three of
// them still remember anything you can hear: the pearl by the lake (a glass
// bell), the sphere west of the arch (far voices singing one note), and the
// great one among the pillars in the east (a drum: dum, tek-dum, and many
// feet in sand; the desert's procession drum, though nobody here has ever
// heard of the desert). Carry the three sounds down the avenue to the round
// plaza and the pole, which hums while the great sphere is on the horizon,
// sounds them together: the chord is the keepsake.
//
// The glyph is "the Footprint" here (on the underside of every sphere, where
// it touches the ground). Ume, who keeps the pole, heard the singing light
// sing the pole's own note. Flags (game-state.js): spheres.* below;
// clue.spheres.desert (one sphere remembers the desert's drum).

const Q = 'spheres.listen';

export const ITEMS = { pebble: 'a mirrored pebble' };
export const SOUNDS = {
  bell: { name: 'a bell of glass', part: 'bell', text: 'a bell of glass, struck once, ringing on and on' },
  chant: { name: 'far voices', part: 'chant', text: 'voices, a long way off, singing one note together' },
  drum: { name: 'a walking drum', part: 'drum', text: 'a drum: dum, tek-dum, and the shuffle of many feet in sand' },
};
export const KEEPSAKE = { id: 'spheres.song', level: 'spheres', name: 'The chord of the spheres', kind: 'song', text: 'A glass bell, far voices and a walking drum, sounding together at the pole on the round plaza while the great sphere stood on the horizon.' };
export const LISTEN_TIME = 4;   // s of standing still beside a sphere

// ------------------------------------------------------------------ quests
export const QUESTS = [
  {
    id: Q, title: 'What the Spheres Remember', world: 'spheres', main: true,
    outro: 'Three sounds, carried to the pole, sounding together.',
    stages: [
      { id: 'aube', text: 'Talk to Aube, the listener, in the umbrella grove', label: 'Aube, the listener', flag: 'spheres.aube.heard', at: 'aube' },
      { id: 'listen', text: 'Listen at the three spheres that remember: stand still beside each until it plays its sound', label: 'A sphere that remembers', flag: 'spheres.heard.three', at: 'sphere' },
      { id: 'plaza', text: 'Carry the sounds down the avenue, through the sphere-arch, to the round plaza', label: 'The round plaza', goto: 'plaza', radius: 22, at: 'plaza' },
      { id: 'pole', text: 'Stand still by the humming pole and listen', label: 'The humming pole', flag: 'spheres.chord.heard', at: 'pole' },
      { id: 'ume', text: 'Tell Ume, who keeps the pole, what you heard', label: 'Ume, on the plaza', talk: 'ume', at: 'ume' },
    ],
  },
  {
    id: 'spheres.pebble', title: 'The Lake’s Reflection', world: 'spheres',
    outro: 'The pole sees the sky twice now.',
    stages: [
      { id: 'glint', text: 'Splash the glint in the still water off the lake’s south shore (shoot)', label: 'The glint in the lake', flag: 'spheres.pebble.out', at: 'glint' },
      { id: 'pick', text: 'Pick up the mirrored pebble the lake gave back', label: 'The mirrored pebble', flag: 'spheres.pebble.taken', at: 'pebble' },
      { id: 'carry', text: 'Carry the lake’s reflection to the plaza and set it at the pole’s foot', label: 'The pole’s foot', flag: 'spheres.pebble.placed', at: 'pole' },
    ],
  },
  {
    id: 'spheres.avenue', title: 'That Kind of Road', world: 'spheres',
    outro: 'You walked the whole avenue slowly. The cypresses noticed.',
    stages: [
      { id: 'walk', text: 'Walk the avenue from the sphere-arch to the plaza without running or jumping', label: 'The avenue', flag: 'spheres.avenue.walked', at: 'avenue' },
      { id: 'tell', text: 'Tell Cael you walked it', label: 'Cael, on the avenue', talk: 'cael', at: 'cael' },
    ],
  },
];

// ------------------------------------------------------------------ the people
export const PEOPLE = {
  aube: {
    id: 'aube', name: 'Aube', title: 'the listener', color: '#9fd0c8', voice: 1.0, kind: 'f',
    palette: { cloak: '#f3efe2', lining: '#2b211f', cloth: '#9fd0c8', legs: '#7f9a90', hat: '#f6efd0', hair: '#3d2a22', face: '#e8dcc8' }, head: 'wrap', cape: 1.2,
    lines: ['The spheres came down long ago. Nobody minds them now.', 'Follow the pale path. It goes through the arch.', 'Shh. Stand still.'],
    talk: {
      entry: [
        { if: { quest: Q, done: true }, node: 'after' },
        { if: { flag: 'spheres.heard.three' }, node: 'three' },
        { if: { flag: 'spheres.aube.heard' }, node: 'again' },
        { node: 'hello' },
      ],
      nodes: {
        hello: {
          say: ['You walk like someone who has somewhere to be. Here, nobody does. I’m Aube. I listen to the spheres.', 'They came down long ago, out of the sky, and lay where they fell. Nobody minds them now. But each one remembers one sound, the last thing it heard before it came down.'],
          choices: [
            { text: 'How do you hear it?', goto: 'how' },
            { text: 'What sounds do they remember?', goto: 'what' },
            { text: 'Where did they come from?', goto: 'from' },
          ],
        },
        how: {
          say: ['You stop. That’s all. Stand beside one and keep still, and it remembers, for you. They don’t remember for people who are passing.', 'Three of them still remember anything you can hear: the pearl by the lake, the one west of the arch, and the big one among the pillars, far to the east.'],
          do: { set: { 'spheres.aube.heard': true } },
          choices: [{ text: 'And then?', goto: 'then' }, { text: 'I’ll go and listen.', end: true }],
        },
        then: { say: ['Then carry what you heard down the avenue to the round plaza. The pole there hums while the great sphere is on the horizon. Ume keeps it. She says if you bring it three sounds, it will play them back together.'], choices: [{ text: 'I’ll go and listen.', end: true }] },
        what: { say: ['Each one something different. A bell. Singing. One of them remembers a drum, which is strange: nobody here has ever owned a drum. We whistle.'], choices: [{ text: 'How do I hear them?', goto: 'how' }] },
        from: { say: ['From the sky. From the great one on the horizon, some say: seeds it dropped. From somewhere with bells and drums, I’d say, which is not here.'], choices: [{ text: 'How do I hear them?', goto: 'how' }] },
        again: {
          say: [
            { if: { flag: 'spheres.heard.bell' }, text: 'You heard the pearl’s bell. Good. It rings longer for the second listener.' },
            { if: { flag: 'spheres.heard.chant' }, text: 'You heard the singing in the one west of the arch. It made you stand straighter; I can see.' },
            { if: { flag: 'spheres.heard.drum' }, text: 'A drum, from the big one among the pillars. A drum. Where would a sphere have heard a drum?' },
            { if: { not: { any: [{ flag: 'spheres.heard.bell' }, { flag: 'spheres.heard.chant' }, { flag: 'spheres.heard.drum' }] } }, text: 'The pearl by the lake, the one west of the arch, the big one in the east. Stand beside each, and keep still.' },
          ],
          choices: [{ text: 'I’m listening.', end: true }],
        },
        three: { say: ['All three? Then go: down the pale path, through the arch, along the avenue. Walk slowly. Ume will be at the pole.'], choices: [{ text: 'I will.', end: true }] },
        after: { say: ['You carried them to the pole and it played them back. I heard it from here, very faint. I’ll be listening to that for years.'], choices: [{ text: 'So will I.', end: true }] },
      },
    },
  },

  nell: {
    id: 'nell', name: 'Nell', title: 'who looks into the lake', color: '#a9c9c4', voice: 1.15, kind: 'f',
    palette: { cloak: '#a9c9c4', lining: '#2b211f', cloth: '#f6efd0', legs: '#5a6a6a', hat: '#f3efe2', hair: '#2b211f' }, head: 'hood', cape: 0.9,
    lines: ['Look into the lake. The garden is twice as large there.', 'Upside down is just another way up.', 'There. Did you see it glint?'],
    talk: {
      entry: [
        { if: { quest: 'spheres.pebble', done: true }, node: 'after' },
        { if: { quest: 'spheres.pebble', active: true }, node: 'waiting' },
        { node: 'hello' },
      ],
      nodes: {
        hello: {
          say: ['Look into the lake. The garden is twice as large there. Half of it is upside down, but you get used to that.', 'I’m Nell. I look. Everything in the lake is only a reflection, except one thing.'],
          choices: [{ text: 'Except what?', goto: 'except' }, { text: 'Twice as large?', goto: 'twice' }],
        },
        twice: { say: ['The pyramid, the white houses, the cypresses: all of them twice. The sphere on the far shore is two spheres touching at the waterline. When I was little I thought that was where spheres came from.'], choices: [{ text: 'Except one thing, you said?', goto: 'except' }] },
        except: {
          say: ['A pebble. A pebble that is a mirror all the way through, lying under the water off this shore. It glints, there, see? Every morning.', 'I can’t reach it; the water is cold and so am I. Give the glint a splash, and the lake might give it back. Then carry it to the plaza and set it at the foot of the pole, so the pole can see the sky twice.'],
          choices: [{ text: 'I’ll try.', do: { start: 'spheres.pebble' }, goto: 'try' }, { text: 'Maybe later.', end: true }],
        },
        try: { say: ['A splash. Not a shove; you’d only make waves. The lake doesn’t like being pushed.'], choices: [{ text: 'A splash.', end: true }] },
        waiting: {
          say: [
            { if: { flag: 'spheres.pebble.taken' }, text: 'You have it! Don’t look into it too long; it shows you the sky behind you. Down the avenue, to the pole’s foot.' },
            { if: { not: { flag: 'spheres.pebble.taken' } }, text: 'The glint, off this shore. Give it a splash.' },
          ],
          choices: [{ text: 'On my way.', end: true }],
        },
        after: { say: ['I felt it, when you set it down. The lake went still all at once, as if it were listening to something far away.'], choices: [{ text: 'It was.', end: true }] },
      },
    },
  },

  ivo: {
    id: 'ivo', name: 'Ivo', title: 'who climbs the white hill', color: '#f2c5b0', voice: 1.25, kind: 'm',
    palette: { cloak: '#f2c5b0', lining: '#2b211f', cloth: '#4f6b3a', legs: '#3a3a3a', hat: '#f6efd0', hair: '#4a3226' }, head: 'hair', cape: 0.5,
    lines: ['Climb the white hill. From the middle terrace you can step out onto the great canopy.', 'Have you looked under a sphere?', 'The view! The VIEW.'],
    talk: {
      nodes: {
        hello: {
          say: ['Climb the white hill! From the middle terrace you can step right out onto the great canopy. Nobody believes me until they do it.', 'I’m Ivo. I climb things. Have you ever looked under a sphere?'],
          choices: [
            { text: 'Under a sphere?', goto: 'under' },
            { text: 'Seen anything strange lately?', goto: 'strange' },
            { text: 'I’ll climb the hill.', end: true },
          ],
        },
        under: {
          say: ['Where they touch the ground. I crawled under the pearl by the lake once, flat on my back. There’s a mark there, pressed into it, like where a foot came down. {glyph}', 'Three dots over an arc. We call it the Footprint. Every sphere has one, underneath, where nobody looks. Except me.', 'Sometimes there’s a blue box near a Footprint, with a star on the lid. A left-behind. Ume says they’re presents. Ume says everything is a present.'],
          choices: [{ text: 'Whose footprint?', goto: 'whose' }],
        },
        whose: { say: ['Something that walked through the sky putting spheres down, I suppose, the way you’d put down cups. Some say the great one on the horizon, and that one day it will come back and collect them.'], choices: [{ text: 'Seen anything strange lately?', goto: 'strange' }, { text: 'Thanks, Ivo.', end: true }] },
        strange: { say: ['Ask Ume, at the plaza. She says the pole hummed on its own three nights ago, with the great sphere dark. She doesn’t say things like that. I say things like that.'], choices: [{ text: 'Thanks, Ivo.', end: true }] },
      },
    },
  },

  cael: {
    id: 'cael', name: 'Cael', title: 'who walks the avenue', color: '#b7c46a', voice: 0.75, kind: 'm', scale: 1.04,
    palette: { cloak: '#b7c46a', lining: '#2b211f', cloth: '#f3efe2', legs: '#4a5a3a', hat: '#f6efd0', hair: '#e8dcc0' }, head: 'hat', cape: 1.3,
    lines: ['The cypresses lead to the rings.', 'Walk slowly. It is that kind of road.', 'Slowly. Slower.'],
    talk: {
      entry: [
        { if: { quest: 'spheres.avenue', done: true }, node: 'after' },
        { if: { flag: 'spheres.avenue.walked' }, node: 'walked' },
        { if: { quest: 'spheres.avenue', active: true }, node: 'waiting' },
        { node: 'hello' },
      ],
      nodes: {
        hello: {
          say: ['The cypresses lead to the rings. Walk slowly. It is that kind of road.', 'I’m Cael. I walk it, up and down, every day. It takes me most of the morning. It could take a running man a minute, and he would never find out how long it is.'],
          choices: [
            { text: 'How long is it?', goto: 'long' },
            { text: 'What happens if you walk it slowly?', goto: 'slowly' },
          ],
        },
        long: { say: ['Exactly as long as it takes you. That’s the answer. Nobody likes it.'], choices: [{ text: 'What happens if you walk it slowly?', goto: 'slowly' }] },
        slowly: {
          say: ['The little white bells along the edges open as you pass. The cypresses lean in to see who’s coming. Run, or jump about, and the bells shut and you’re just someone on a path.', 'Try it. From the arch to the plaza. Don’t run. Don’t jump. It isn’t a test. Well. It is a small test.'],
          choices: [{ text: 'I’ll walk it.', do: { start: 'spheres.avenue' }, goto: 'go' }, { text: 'Maybe later.', end: true }],
        },
        go: { say: ['Start at the arch. I’ll be somewhere along it, being slow.'], choices: [{ text: '(walk slowly)', end: true }] },
        waiting: { say: ['From the arch to the plaza, slowly. If you ran, start again at the arch. Nobody minds. The road doesn’t count.'], choices: [{ text: '(walk slowly)', end: true }] },
        walked: {
          say: ['You walked it. All of it. I saw the bells open behind you, all the way down.', 'Now you know how long the avenue is. Most people never find out.'],
          do: { advance: ['spheres.avenue', 'tell'] },
          choices: [{ text: 'It was long.', goto: 'longer' }, { text: 'It was short.', goto: 'shorter' }],
        },
        longer: { say: ['Good. Long is the right answer, for a first time.'], choices: [{ text: 'Goodbye, Cael.', end: true }] },
        shorter: { say: ['Then you walked it slower than I do. I’ll have to try harder.'], choices: [{ text: 'Goodbye, Cael.', end: true }] },
        after: { say: ['Slowly. It is that kind of road. You know now.'], choices: [{ text: 'I know.', end: true }] },
      },
    },
  },

  ume: {
    id: 'ume', name: 'Ume', title: 'who keeps the pole', color: '#f6efd0', voice: 0.8, kind: 'f', scale: 0.96,
    palette: { cloak: '#f6efd0', lining: '#2b211f', cloth: '#a9c9c4', legs: '#5a6a6a', hat: '#e0d4bc', hair: '#e8dcc0' }, head: 'wrap', cape: 1.45,
    lines: ['Hear it? The pole hums while the great sphere is up.', 'Bring it something to sing.', 'Hm-mm-mm.'],
    talk: {
      entry: [
        { if: { quest: Q, done: true }, node: 'after' },
        { if: { flag: 'spheres.chord.heard' }, node: 'chord' },
        { if: { flag: 'spheres.heard.three' }, node: 'ready' },
        { if: { flag: 'met.ume' }, node: 'again' },
        { node: 'hello' },
      ],
      nodes: {
        hello: {
          say: ['Hear it? The pole hums while the great sphere is on the horizon. Hm-mm-mm. I’m Ume. I keep it. Keeping it means mostly listening to it.', 'Aube sends people down the avenue with sounds for it. Most never bring any. You can’t carry a sound you didn’t stop for.'],
          choices: [
            { text: 'Why does the pole hum?', goto: 'why' },
            { text: 'Have you heard anything strange?', goto: 'strange' },
          ],
        },
        why: { say: ['Because the great sphere is there, the way a bowl hums when you set another bowl beside it. When the great sphere sets, it stops. Mostly.'], choices: [{ text: 'Mostly?', goto: 'strange' }] },
        strange: {
          say: ['Three nights ago it hummed with the great sphere set and dark. I came out to see why. A light was going over, very high, singing: singing the pole’s own note, exactly. The old listeners had a name for such a thing: an Answerer.', 'It turned. Right over the plaza, it turned, as if the pole had answered it and it wanted to know who. Then it went on. I haven’t slept well since.'],
          do: { set: { 'spheres.rumour.light': true } },
          choices: [{ text: 'It struck my ship.', goto: 'struck' }, { text: 'I’ll bring the pole three sounds.', end: true }],
        },
        struck: { say: ['Did it? Then it was looking, and it found you. I’m glad it didn’t find the pole. It is only a pole.'], choices: [{ text: 'I’ll bring it three sounds.', end: true }] },
        again: { say: ['The pearl by the lake, the one west of the arch, the big one in the east. Stop beside each. Then bring them here.'], choices: [{ text: 'I will.', end: true }] },
        ready: { say: ['You stopped for all three. I can tell; you’re walking like a bell. Stand by the pole, there, close, and keep still. Let it hear what you carried.'], choices: [{ text: '(stand by the pole)', end: true }] },
        chord: {
          say: ['There. All three at once. Did you hear it? The bell and the voices and that drum.', 'The spheres remember the last thing they heard before they came down. So somewhere there is a glass bell, and people singing, and a whole crowd walking to a drum in sand. They passed over all of it, once, on their way here.'],
          do: { set: { 'clue.spheres.desert': true } },
          choices: [{ text: 'I know that drum. It’s from the desert.', if: { any: [{ flag: 'desert.teo.drumming' }, { flag: 'world.desert.done' }] }, goto: 'desert' }, { text: 'Where is that?', goto: 'where' }],
        },
        desert: { say: ['From the desert? Then you’ve walked under where they flew. And now you’ve carried its drum back here, the long way round.', 'Take the chord with you. It’s yours as much as theirs, now.'], do: [{ advance: [Q, 'ume'] }, { keepsake: KEEPSAKE }], next: 'end' },
        where: { say: ['I don’t know. Somewhere with bells, and singers, and sand. If you’ve been anywhere with sand and a drum, you’ve walked under where they flew.', 'Take the chord with you. It’s yours as much as theirs, now.'], do: [{ advance: [Q, 'ume'] }, { keepsake: KEEPSAKE }], next: 'end' },
        end: { say: ['Hm-mm-mm. The pole will be humming that for a week.'], choices: [{ text: 'Thank you, Ume.', end: true }] },
        after: { say: ['Still humming it. Listen.'], choices: [{ text: '(listen)', end: true }] },
      },
    },
  },
};

export const THINGS = {
  pebble: {
    id: 'pebble', name: 'The mirrored pebble', title: 'at the pole’s foot', color: '#cfe6ea', voice: 0.6,
    talk: { nodes: { look: {
      say: ['You set the pebble at the foot of the pole. It is a mirror all the way through: in it the pole goes up and up, and the sky goes down and down.', 'The hum changes, very slightly, as if there were water in it now.'],
      do: { set: { 'spheres.pebble.placed': true } },
      choices: [{ text: '(step back)', end: true }],
    } } },
  },
};
