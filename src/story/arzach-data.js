// Vael's story as data: "The Waiting Bird" (docs/story-bible.md).
//
// A silent country. The great bird has not come down since her rider left the
// lone tower long ago: she keeps to the sky over the haze, and nobody here has
// seen more of her than a shape. Nobody says much: people point, draw in the
// sand, hum. Oïa watches the tower from a stone on the plain. The wind rises up
// the tower's side, and it lifts open wings (the fluid wings: the Aerie, the
// makers' white house west of the landing, keeps a pair), up to the balcony;
// three stone steps climb from there to the sill of its one window. On the sill
// the rider left a little bone flute with a feather tied to it, for whoever came
// next; through the window, the rider's room and a map of the sky stones on the
// wall (the rider walked away to Vael II). Play the flute: five notes, her call.
// Out of the haze the bird comes down to you for the first time, and bows:
// wherever there is sky, she will come when you call (a keepsake of the kind
// *person*: a promise). Until then she is not seen and cannot be ridden
// (src/story/arzach.js: dormant).
//
// Side quests: the three feathers the bird shed across the spires the night
// the light went over (the third is held by the stone hand), and the stone
// hand's knuckles, which ring when the fluid strikes them in the right order
// (smallest to tallest).
//
// Flags (game-state.js): arzach.watcher.met, arzach.glyph.drawn, arzach.rode,
// arzach.window.seen (the flute taken), arzach.bird.called (the flute played: she is shown),
// arzach.bird.promise, arzach.rumour.light, arzach.feather.<i> (picked up), arzach.feathers.given,
// arzach.hand.rung; clue.arzach.arzach2 (the map of the sky stones); bird.promise (the bird will
// come in any world with sky). Items: whistle (the rider's flute: its id from when it was a
// whistle), feather (up to three).

const Q = 'arzach.bird';

export const ITEMS = { whistle: 'the rider’s bone flute', feather: 'a long white feather' };
/** The keepsake the main quest's end gives (src/story/arzach.js). */
export const KEEPSAKE = { id: 'arzach.person', level: 'arzach', name: 'The bird’s promise', kind: 'person', text: 'She bowed her long neck and opened her wings. Wherever there is sky, call, and she will come.' };

/**
 * The rider's call, played on the flute: [Hz, beats] (a beat RIDER_CALL_BEAT s). Low, rising, a turn,
 * and a long high note. The bird answers it (src/story/arzach.js; audio.js whistle('bird') plays it
 * whenever you call her after).
 */
export const RIDER_CALL = [[587.3, 1], [784, 1], [987.8, 1.5], [880, 0.75], [1174.7, 2.5]];
export const RIDER_CALL_BEAT = 0.22;

// ------------------------------------------------------------------ quests
export const QUESTS = [
  {
    id: Q, title: 'The Waiting Bird', world: 'arzach', main: true,
    outro: 'She comes when you call. She chose to.',
    stages: [
      // (from the Aerie, the bird's old tracks lead down to her: the way back that is not the standing stones' way up, src/vael-ways.js)
      { id: 'watcher', text: 'Someone sits on a stone on the plain, watching the lone tower, where the bird’s old tracks end. Sit with her', label: 'Oïa, watching the tower', flag: 'arzach.watcher.met', at: 'oia', via: 'the bird’s tracks' },
      { id: 'tower', text: 'The wind rises up the lone tower’s side. Jump into it and open your wings (hold {key:jump} as you fall): it lifts you to the balcony', label: 'The wind at the tower', goto: 'balcony', radius: 21, vertical: 12, at: 'wind' },
      { id: 'window', text: 'Climb the stone steps round the tower to its one window', label: 'The window', flag: 'arzach.window.seen', at: 'window' },
      { id: 'call', text: 'Play the rider’s flute', label: 'The rider’s flute', flag: 'arzach.bird.called', at: 'window' },
      { id: 'promise', text: 'Something answers from high over the haze. Wait for her', label: 'The bird', flag: 'arzach.bird.promise', at: 'bird' },
    ],
  },
  {
    id: 'arzach.feathers', title: 'Shed Feathers', world: 'arzach',
    outro: 'Three bright feathers flash in her wing.',
    stages: [
      { id: 'find', text: 'Find the three feathers the bird shed: two on the spires’ caps, one held by the stone hand', label: 'A shed feather', at: 'feather', when: (q) => (q.game.flag('item.feather') ?? 0) >= 3 || q.game.flag('arzach.feathers.given') },
      { id: 'give', text: 'Bring the three feathers back to the bird, once she has answered the rider’s call', label: 'The bird', flag: 'arzach.feathers.given', at: 'bird' },
    ],
  },
  {
    id: 'arzach.hand', title: 'The Stone Hand', world: 'arzach',
    outro: 'The hand rang, and gave.',
    stages: [
      { id: 'ring', text: 'Ring the stone hand’s knuckles smallest to tallest: aim with {key:aim} and shoot each one with {key:fire}. Kesh, by the hand, shows the order', label: 'The stone hand', flag: 'arzach.hand.rung', at: 'hand' },
    ],
  },
];

// ------------------------------------------------------------------ the people
export const PEOPLE = {
  oia: {
    id: 'oia', name: 'Oïa', title: 'who watches the tower', color: '#d8c7a6', voice: 0.8, kind: 'f',
    palette: { cloak: '#d8c7a6', lining: '#8a7a66', cloth: '#f4efe2', legs: '#8a7a66', hat: '#f4efe2', hair: '#2b211f' }, head: 'hood', cape: 1.45, look: { mask: 'beak', body: 'scarf', prop: 'staff' },
    lines: ['~tired~ …', '~sad~ (she watches the tower)', '~neutral~ (she nods)'],
    talk: {
      entry: [
        { if: { quest: Q, done: true }, node: 'after' },
        { if: { has: 'whistle' }, node: 'whistle' },
        { if: { flag: 'arzach.watcher.met' }, node: 'again' },
        { node: 'hello' },
      ],
      nodes: {
        hello: {
          say: ["~solemn~ (Oïa watches *the lone tower* across the plain. You wait for her to look at you. She does not.)", "~solemn~ (She points at the tower, then up at the empty sky over the haze, and waits. Whatever she waits for is up there. She pats the stone beside her.)"],
          do: { set: { 'arzach.watcher.met': true } },
          choices: [
            { text: '~curious~ Who lived in the tower?', goto: 'rider' },
            { text: '~whisper~ (sit with her, and say nothing)', goto: 'silence' },
          ],
        },
        silence: {
          say: ["~whisper~ (You sit beside her. High over the haze a long white shape turns once, and is gone. The two of you watch the tower.)", "~happy~ (Oïa almost smiles. You seem to have said the right thing.)"],
          choices: [{ text: '~curious~ Who lived in the tower?', goto: 'rider' }, { text: '~neutral~ (get up)', end: true }],
        },
        rider: {
          say: ["~neutral~ (She touches her shoulder, where a rider would pin a cloak, then spreads two fingers like wings.)", "~sad~ (She opens her hand and blows across it. Someone left.)", '~sad~ Gone.'],
          choices: [{ text: '~sad~ And the bird is still waiting.', goto: 'track' }, { text: '~curious~ Gone where?', goto: 'where' }],
        },
        where: {
          say: ["~neutral~ (She points beyond the tower, toward the pale sky. A shrug: she does not know where.)"],
          choices: [{ text: '~sad~ And the bird is still waiting.', goto: 'track' }],
        },
        track: {
          say: ["~solemn~ (She nods. In the sand she draws three dots over an arc.) {glyph}", "~neutral~ (She taps three toes and a curved heel, and looks up at the sky.) Her track.", "~whisper~ (Below it she draws a chest with *a star on top*. She points *north, to the needle spire*: look for the chest up there.)"],
          do: { set: { 'arzach.glyph.drawn': true } },
          choices: [
            { text: '~surprised~ I’ve seen that mark before. On my ship.', goto: 'mark' },
            { text: '~neutral~ I’ll go to the tower.', goto: 'go' },
          ],
        },
        mark: {
          say: ["~surprised~ (Her hand stops. She taps the drawing, her stone seat, then points to the enormous stone hand.)", "~solemn~ (The same mark, everywhere. She turns her palms up: she cannot tell you who made it.)"],
          choices: [{ text: '~neutral~ I’ll go to the tower.', goto: 'go' }],
        },
        go: { say: ["~neutral~ (She points at *the tower’s foot* and sweeps both hands up its side, like rising air. Then she spreads her arms: *wings*.)",
          { if: { not: { flag: 'item.glider' } }, text: "~neutral~ (She looks at your bare back, then points *west, to the white house with the stone wings* on the plain, and spreads her arms again.)" }], choices: [{ text: '~neutral~ (nod)', end: true }] },
        again: {
          say: [{ if: { flag: 'arzach.window.seen' }, text: "~curious~ (Oïa checks your empty hands. She points back at the tower’s window.)" },
            { if: { not: { flag: 'arzach.window.seen' } }, text: "~neutral~ (A finger toward *the tower’s foot*. Both hands sweeping up: the wind. Arms out: wings. Her directions have not changed.)" },
            { if: { all: [{ not: { flag: 'arzach.window.seen' } }, { not: { flag: 'item.glider' } }] }, text: "~neutral~ (Then west, to *the white house with the stone wings*. Arms out again, patiently.)" }],
          choices: [{ text: '~curious~ Who lived in the tower?', goto: 'rider', if: { not: { flag: 'arzach.glyph.drawn' } } }, { text: '~neutral~ (nod)', end: true }],
        },
        whistle: {
          say: ["~solemn~ (She sees the flute. For the first time, she forgets the tower.)", "~whisper~ (She brushes the feather tied to it, then lifts two fingers to her lips.) *Blow*."],
          choices: [{ text: '~neutral~ (nod)', end: true }],
        },
        after: {
          say: ["~happy~ (In the sand: a bird with a small rider. Oïa adds your hood.)", "~solemn~ (She looks up at the tower, then back at her drawing.)"],
          choices: [{ text: '~whisper~ (sit with her a while)', end: true }],
        },
      },
    },
  },
};

/** The level's own people (content.js arzach npcs, by index): the errands keep their places. */
export const LOCALS = [
  {
    id: 'tam', name: 'Tam', title: 'who copies you', color: '#f4efe2', voice: 1.6,
    talk: { listen: [
      ["~playful~ (The boy tilts his head when you do. You have acquired a reflection with dusty knees.)", "~playful~ (You raise a hand. His goes up exactly as far.)"],
      "~happy~ (He waves with both arms, then points up at the sky and flaps them. A clear improvement on your wave.)",
      { if: { not: { quest: 'arzach.hand', done: true } }, say: ['~scared~ (You glance at the tower. He shakes his head hard and hugs himself: too high, too cold.)', '~playful~ (Then he points at the stone hand out on the plain and taps his own knuckles, the smallest first, up to the tallest, and grins.)'] },
      "~playful~ (He opens his mouth wide. An impressive amount of nothing comes out.)",
      '~angry~ (He turns his back on you, folds his arms and becomes a spire. The spire would like you to go away.)',
      { if: { not: { flag: 'box.arzach.hush' } }, say: '~curious~ (He draws a square in the sand with a star on top, points out at the needle spire on the plain, halfway to the tower, and mimes climbing it. He falls off on purpose.)' },
      { after: { flag: 'world.arzach.done' }, say: '~happy~ (He flaps his arms, points at the sky, then at you, and bows so low his hair sweeps the sand.)' },
      { after: { flag: 'temple.arzach.done' }, say: '~surprised~ (He points west, at the white house with the stone wings, then up, where the great birds wheel again, and spins until he sits down.)' },
    ] },
  },
  {
    id: 'senn', name: 'Senn', title: 'who listens to stones', color: '#d8c7a6', voice: 0.9,
    talk: {
      entry: [{ if: { quest: 'arzach.feathers', done: true }, node: 'after' }, { if: { flag: 'met.senn' }, node: 'again' }, { node: 'hello' }],
      nodes: {
        hello: {
          say: ['~whisper~ Shh.', "~whisper~ (Her ear rests against the foot of a needle spire. One raised finger asks you to wait.)", "~whisper~ Listen. The stones have hummed since the light passed."],
          choices: [
            { text: '~curious~ What light?', goto: 'light' },
            { text: '~curious~ The bird over the haze?', goto: 'bird' },
          ],
        },
        light: {
          say: ["~solemn~ (She hums a rising note and draws its path across the sky. Her finger turns sharply at the end.)", "~solemn~ The light sang. The stones answered. The bird cried."],
          do: { set: { 'arzach.rumour.light': true } },
          choices: [{ text: '~surprised~ That was the night my ship fell.', goto: 'ship' }, { text: '~curious~ The bird cried?', goto: 'cried' }],
        },
        ship: { say: ["~solemn~ (She studies you.) You heard it too.", '~neutral~ (She puts her ear back to the stone.)'], choices: [{ text: '~curious~ The bird cried?', goto: 'cried' }, { text: '~neutral~ (leave her to listen)', end: true }] },
        cried: {
          say: ["~sad~ She shook all night. Lost feathers. (Senn plucks at her sleeve.)", "~neutral~ *Two spires. Their flat tops.* (She points straight up the spire at her back, then far off past the tower.) The third feather is in *the stone hand*."],
          do: { start: 'arzach.feathers' },
          choices: [{ text: '~happy~ I’ll find them for her.', end: true }],
        },
        bird: { say: ["~sad~ (She points at the tower.) Her rider left. She still waits."], choices: [{ text: '~curious~ What light? You said the stones hum.', goto: 'light' }, { text: '~neutral~ (leave her to listen)', end: true }] },
        again: {
          say: ["~neutral~ (Senn takes her ear from the stone. For now, you have her attention.)"],
          choices: [{ text: '~curious~ Tell me about the light again.', if: { not: { quest: 'arzach.feathers', active: true } }, goto: 'light' }, { text: '~curious~ Where are the feathers?', if: { quest: 'arzach.feathers', active: true }, goto: 'cried' }, { text: '~neutral~ (leave her to listen)', end: true }],
        },
        after: { say: ["~happy~ (She touches the feathers in her hair, then points to the bird.) Better. Thank you.", "~happy~ (The stone hums under her hand. She makes room for your ear.)"], choices: [{ text: '~whisper~ (listen with her)', end: true }] },
      },
    },
  },
  {
    id: 'hollin', name: 'Kesh', title: 'who keeps the hand', color: '#b0705a', voice: 0.65,
    talk: {
      entry: [{ if: { flag: 'arzach.hand.rung' }, node: 'after' }, { if: { quest: 'arzach.hand', active: true }, node: 'again' }, { node: 'hello' }],
      nodes: {
        hello: {
          say: ['~tired~ Hm.', "~neutral~ (The old man compares his hand with the stone one. He seems satisfied with his own.)", "~solemn~ Once, it rang. Once, it moved."],
          choices: [
            { text: '~curious~ Rang?', goto: 'rang' },
            { text: '~curious~ Whose hand was it?', goto: 'whose' },
          ],
        },
        whose: { say: ["~whisper~ (He points to the giant lying in the sand.) His. Sleeping, perhaps."], choices: [{ text: '~curious~ You said it rang.', goto: 'rang' }] },
        rang: {
          say: ["~neutral~ *Shoot the knuckles.* Four bells.", "~neutral~ (He demonstrates on his own hand: little finger, first finger, ring finger, middle finger.)", "~playful~ *Smallest to tallest.* (He mimes a splash.)"],
          do: { start: 'arzach.hand' },
          choices: [{ text: '~curious~ With the fluid?', goto: 'fluid' }, { text: '~curious~ What happens when it rings?', goto: 'gives' }],
        },
        fluid: { say: ["~playful~ (He points at *the tank on your back*, then the knuckles. Three teeth appear in a very confident grin.)"], choices: [{ text: '~curious~ What happens when it rings?', goto: 'gives' }, { text: '~neutral~ I’ll try.', end: true }] },
        gives: { say: ["~solemn~ (He closes his fist around nothing, then opens it as though offering a gift.)", '~solemn~ Gives.'], choices: [{ text: '~neutral~ I’ll try.', end: true }] },
        again: {
          say: ["~tired~ (Kesh repeats the order: *little, first, ring, middle*. He waits for you to copy him.)", '~neutral~ Small to tall.', '~playful~ (He taps one knuckle once, the next twice, and points up at the dots cut in the stone ones.)'],
          choices: [{ text: '~neutral~ (nod)', end: true }],
        },
        after: { say: ["~happy~ (He opens his hand toward you. A gift received, a lesson learned.)", "~happy~ Heard it. At last."], choices: [{ text: '~neutral~ (nod)', end: true }] },
      },
    },
  },
];

// The scenery you can look at.
export const THINGS = {
  drawing: {
    id: 'drawing', name: 'A drawing in the sand', title: 'by Oïa’s stone', color: '#d9c9a8', voice: 0.6,
    talk: { nodes: { look: { say: ["~neutral~ Oïa’s drawing: three dots over an arc. {glyph} She calls it the bird’s track.", "~sad~ The wind is already rubbing it out."], choices: [{ text: '~neutral~ (step back)', end: true }] } } },
  },
  // the fallen colossus on the plain (src/levels/arzach.js colossus): Vael says little, so the stone says it
  colossus: {
    id: 'colossus', name: 'The fallen giant', title: 'asleep on the plain', color: '#f7f1e4', voice: 0.6,
    talk: { nodes: { look: {
      say: ["~solemn~ A giant of pale stone lies on its side in the plain, one knee drawn up, as if it lay down to rest and the plain came up round it.",
        "~neutral~ Its face is turned toward the lone tower. Swallows nest in the hollow of its ear.",
        { if: { any: [{ flag: 'bird.promise' }, { flag: 'arzach.bird.called' }] }, text: "~whisper~ (When the bird goes over, her shadow crosses the stone face, and for a moment it seems to watch her go.)" },
        { if: { not: { any: [{ flag: 'bird.promise' }, { flag: 'arzach.bird.called' }] } }, text: "~whisper~ (It looks at the tower the way Oïa does: waiting, without hurry.)" }],
      do: { set: { 'arzach.colossus.seen': true } },
      choices: [{ text: '~solemn~ (sit a moment in its shade)', end: true }],
    } } },
  },
  // the ways home (src/vael-ways.js): the rider's mounting stone on the bird's tracks, the rider's roost in the sky
  mounting: {
    id: 'mounting', name: 'A mounting stone', title: 'on the bird’s old tracks', color: '#efe4cf', voice: 0.6,
    talk: { nodes: { look: {
      say: ["~curious~ A block of pale stone with three steps up its side, and an iron ring on a post, worn bright on one side by a rope.",
        "~neutral~ Over the top lies a white cloth, folded the way you would fold a saddle-cloth, the bird’s track drawn on it. {glyph}",
        "~solemn~ The great prints in the sand come up to the stone and go on down the slope toward the landing, where Oïa sits. From up here you can see the lone tower."],
      do: { set: { 'arzach.mounting.seen': true } },
      choices: [{ text: '~solemn~ (climb the steps, and look at the tower)', end: true }],
    } } },
  },
  roost: {
    id: 'roost', name: 'The rider’s roost', title: 'on a stone in the sky', color: '#f2d6c4', voice: 0.6,
    talk: { nodes: { look: {
      say: ["~surprised~ Somebody lived up here. A lean-to of two white poles and a cloth, a bedroll, a cup turned upside down so the sand would not get in.",
        "~neutral~ A ladder of rope hangs over the edge, far too short to reach anything. It was never for climbing up. A long white streamer cracks on its pole.",
        { if: { any: [{ flag: 'arzach.bird.called' }, { flag: 'bird.promise' }] }, text: "~happy~ (The bird lands beside you without being asked, and settles where the rock is worn smooth. This was her place too.)" },
        { if: { not: { any: [{ flag: 'arzach.bird.called' }, { flag: 'bird.promise' }] } }, text: "~sad~ The rock by the lean-to is worn smooth in a long hollow, the shape of something very large asleep." }],
      do: { set: { 'arzach.roost.seen': true } },
      choices: [{ text: '~solemn~ (sit by the cup a while)', end: true }],
    } } },
  },
  palm: {
    id: 'palm', name: 'The stone hand', title: 'reaching out of the plain', color: '#efe6d2', voice: 0.6,
    talk: {
      entry: [{ if: { flag: 'arzach.hand.rung' }, node: 'open' }, { node: 'look' }],
      nodes: {
        look: {
          say: ["~solemn~ A stone hand taller than a house. In its palm is the mark from your ship: {glyph}", "~neutral~ Four knuckles rise above you, each finger taller than the last. Dots are cut into each knuckle: *one, two, three, four*. *A white feather* is caught between the fingers."],
          do: { start: 'arzach.hand' },
          choices: [{ text: '~curious~ (rap a knuckle)', goto: 'strike' }, { text: '~neutral~ (step back)', end: true }],
        },
        strike: {
          say: ["~neutral~ Your fist makes no sound. Try your fluid: *aim and shoot a knuckle*.", "~curious~ The four notes need an order: the dots may count it out. *Kesh, beside the hand*, can show you."],
          choices: [{ text: '~neutral~ (step back)', end: true }],
        },
        open: { say: ["~scared~ The mark glows in the palm. Was that finger always bent?"], choices: [{ text: '~neutral~ (step back)', end: true }] },
      },
    },
  },
};

/** The four knuckles, from the thumb side (index, middle, ring, little), and the order they ring in: smallest to tallest. */
export const KNUCKLE_ORDER = [3, 0, 2, 1];

/**
 * The riddle's hints (src/story/knuckle-riddle.js): Kesh's call after the second miss, and the journal's line once
 * he has called (flag arzach.hand.hint).
 */
export const KNUCKLE_LINES = {
  miss: '~neutral~ A dull knock. The knuckles go dark again. The order is broken.',
  call: '~playful~ (Kesh, below, holds up his hand and counts on it.) Little. First. Ring. Middle. *Count the dots!*',
  glint: '~whisper~ (One knuckle catches the light, as if it were waiting to be next.)',
};
export const KNUCKLE_HINT_STEP = 'Ring the stone hand’s knuckles smallest to tallest: the little finger’s (one dot), the first finger’s (two), the ring finger’s (three), the middle finger’s (four). Aim with {key:aim} and shoot each with {key:fire}';
