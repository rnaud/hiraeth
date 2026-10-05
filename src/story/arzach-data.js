// Vael's story as data: "The Waiting Bird" (docs/story-bible.md).
//
// A silent country. The bird waits for a rider who left the lone tower long
// ago, and nobody here says much: people point, draw in the sand, hum. The
// bird and the stones speak through what they do. Oïa watches the tower
// from beside the bird; when you ride to it and climb to its one window you
// find the rider's room: a map of the sky stones painted on the wall (the
// rider walked away to Vael II), and, on a nail by the window, the rider's
// bone whistle with a feather tied to it, left for whoever came next.
// Blow it, and the bird comes, and bows: wherever there is sky, she will
// come when you call (a keepsake of the kind *person*: a promise).
//
// Side quests: the three feathers the bird shed across the spires the night
// the light went over (the third is held by the stone hand), and the stone
// hand's knuckles, which ring when the fluid strikes them in the right order
// (smallest to tallest).
//
// Flags (game-state.js): arzach.watcher.met, arzach.glyph.drawn, arzach.rode,
// arzach.window.seen, arzach.bird.called, arzach.bird.promise, arzach.rumour.light,
// arzach.feather.<i> (picked up), arzach.feathers.given, arzach.hand.rung;
// clue.arzach.arzach2 (the map of the sky stones); bird.promise (the bird will
// come in any world with sky). Items: whistle, feather (up to three).

const Q = 'arzach.bird';

export const ITEMS = { whistle: 'the rider’s bone whistle', feather: 'a long white feather' };

// ------------------------------------------------------------------ quests
export const QUESTS = [
  {
    id: Q, title: 'The Waiting Bird', world: 'arzach', main: true,
    outro: 'She comes when you call. She chose to.',
    stages: [
      { id: 'watcher', text: 'Someone sits by the bird, watching the lone tower. Sit with her', label: 'Oïa, watching the tower', flag: 'arzach.watcher.met', at: 'oia' },
      { id: 'ride', text: 'The bird keeps turning toward the lone tower. Ride her (E beside her)', label: 'The bird', flag: 'arzach.rode', at: 'bird' },
      { id: 'tower', text: 'Fly to the lone tower and land on its balcony (Space flaps, S pulls up)', label: 'The tower’s balcony', goto: 'balcony', radius: 21, vertical: 12, at: 'balcony' },
      { id: 'window', text: 'Climb the stone steps round the tower to its one window', label: 'The window', flag: 'arzach.window.seen', at: 'window' },
      { id: 'call', text: 'Blow the rider’s whistle (E)', label: 'The bird', flag: 'arzach.bird.called', at: 'bird' },
      { id: 'promise', text: 'The bird is coming. Wait for her', label: 'The bird', flag: 'arzach.bird.promise', at: 'bird' },
    ],
  },
  {
    id: 'arzach.feathers', title: 'Shed Feathers', world: 'arzach',
    outro: 'Three bright feathers flash in her wing.',
    stages: [
      { id: 'find', text: 'Find the three feathers the bird shed: two on the spires’ caps, one held by the stone hand', label: 'A shed feather', at: 'feather', when: (q) => (q.game.flag('item.feather') ?? 0) >= 3 || q.game.flag('arzach.feathers.given') },
      { id: 'give', text: 'Bring the three feathers back to the bird', label: 'The bird', flag: 'arzach.feathers.given', at: 'bird' },
    ],
  },
  {
    id: 'arzach.hand', title: 'The Stone Hand', world: 'arzach',
    outro: 'The hand rang, and gave.',
    stages: [
      { id: 'ring', text: 'Ring the stone hand’s knuckles in the right order: shoot them (G, or left click while aiming)', label: 'The stone hand', flag: 'arzach.hand.rung', at: 'hand' },
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
          say: ["~solemn~ (Oïa watches *the lone tower* across the plain. You wait for her to look at you. She does not.)", "~solemn~ (She points to the bird, then to the tower. The bird gives you the same look. Apparently this is your invitation.)"],
          do: { set: { 'arzach.watcher.met': true } },
          choices: [
            { text: '~curious~ Who lived in the tower?', goto: 'rider' },
            { text: '~whisper~ (sit with her, and say nothing)', goto: 'silence' },
          ],
        },
        silence: {
          say: ["~whisper~ (You sit beside her. The bird shuffles closer. All three of you watch the tower.)", "~happy~ (Oïa almost smiles. You seem to have said the right thing.)"],
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
          say: ["~solemn~ (She nods. In the sand she draws three dots over an arc.) {glyph}", "~neutral~ (She points to the bird’s three toes and curved heel.) Her track.", "~whisper~ (Below it she draws a chest with *a star on its lid*. She points *north, to the needle spire*: look for the chest up there.)"],
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
        go: { say: ["~neutral~ (She points to *the bird*, then traces a spiral up an imaginary tower: ride over, then climb.)"], choices: [{ text: '~neutral~ (nod)', end: true }] },
        again: {
          say: [{ if: { flag: 'arzach.window.seen' }, text: "~curious~ (Oïa checks your empty hands. She points back at the tower’s window.)" },
            { if: { not: { flag: 'arzach.window.seen' } }, text: "~neutral~ (A finger toward *the bird*. Another toward *the tower*. Her directions have not changed.)" }],
          choices: [{ text: '~curious~ Who lived in the tower?', goto: 'rider', if: { not: { flag: 'arzach.glyph.drawn' } } }, { text: '~neutral~ (nod)', end: true }],
        },
        whistle: {
          say: ["~solemn~ (She sees the whistle. For the first time, she forgets the tower.)", "~whisper~ (She brushes the feather tied to it, then nods.) *Blow*."],
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
      "~happy~ (He waves with both arms, then points to the bird and flaps them. A clear improvement on your wave.)",
      { if: { not: { quest: 'arzach.hand', done: true } }, say: ['~scared~ (You glance at the tower. He shakes his head hard and hugs himself: too high, too cold.)', '~playful~ (Then he points at the stone hand out on the plain and taps his own knuckles, the smallest first, up to the tallest, and grins.)'] },
      "~playful~ (He opens his mouth wide. An impressive amount of nothing comes out.)",
      '~angry~ (He turns his back on you, folds his arms and becomes a spire. The spire would like you to go away.)',
      { if: { not: { flag: 'box.arzach.hush' } }, say: '~curious~ (He draws a square in the sand with a star on its lid, points north at the needle spire, and mimes climbing it. He falls off on purpose.)' },
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
          say: ['~whisper~ Shh.', "~whisper~ (Her ear rests against a standing stone. One raised finger asks you to wait.)", "~whisper~ Listen. The stones have hummed since the light passed."],
          choices: [
            { text: '~curious~ What light?', goto: 'light' },
            { text: '~curious~ The bird knows the way?', goto: 'bird' },
          ],
        },
        light: {
          say: ["~solemn~ (She hums a rising note and draws its path across the sky. Her finger turns sharply at the end.)", "~solemn~ The light sang. The stones answered. The bird cried."],
          do: { set: { 'arzach.rumour.light': true } },
          choices: [{ text: '~surprised~ That was the night my ship fell.', goto: 'ship' }, { text: '~curious~ The bird cried?', goto: 'cried' }],
        },
        ship: { say: ["~solemn~ (She studies you.) You heard it too.", '~neutral~ (She puts her ear back to the stone.)'], choices: [{ text: '~curious~ The bird cried?', goto: 'cried' }, { text: '~neutral~ (leave her to listen)', end: true }] },
        cried: {
          say: ["~sad~ She shook all night. Lost feathers. (Senn plucks at her sleeve.)", "~neutral~ *Two spires. Their flat tops.* (She points.) The third feather is in *the stone hand*."],
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
    id: 'hollin', name: 'Hollin', title: 'who keeps the hand', color: '#b0705a', voice: 0.65,
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
        fluid: { say: ["~playful~ (He points at *your tank*, then the knuckles. Three teeth appear in a very confident grin.)"], choices: [{ text: '~curious~ What happens when it rings?', goto: 'gives' }, { text: '~neutral~ I’ll try.', end: true }] },
        gives: { say: ["~solemn~ (He closes his fist around nothing, then opens it as though offering a gift.)", '~solemn~ Gives.'], choices: [{ text: '~neutral~ I’ll try.', end: true }] },
        again: {
          say: ["~tired~ (Hollin repeats the order: *little, first, ring, middle*. He waits for you to copy him.)", '~neutral~ Small to tall.'],
          choices: [{ text: '~neutral~ (nod)', end: true }],
        },
        after: { say: ["~happy~ (He opens his hand toward you. A gift received, a lesson learned.)", "~happy~ Heard it. At last."], choices: [{ text: '~neutral~ (nod)', end: true }] },
      },
    },
  },
];

// The scenery you can look at.
export const THINGS = {
  window: {
    id: 'window', name: 'The window', title: 'in the lone tower', color: '#34405e', voice: 0.6,
    talk: {
      entry: [{ if: { flag: 'arzach.window.seen' }, node: 'again' }, { node: 'look' }],
      nodes: {
        look: {
          say: ["~whisper~ A round room. A narrow bed. An upturned cup. Someone left it ready to come back to.",
            "~neutral~ A painted map shows *floating sky stones*, a monastery and a bell. A dotted route follows an aqueduct to a tower on a peach-coloured plain.",
            "~sad~ A *bone whistle with a white feather* hangs beside the window. Its cord is worn from being tied and untied."],
          do: [{ set: { 'arzach.window.seen': true, 'clue.arzach.arzach2': true } }, { give: 'whistle' }],
          choices: [{ text: '~solemn~ (take the whistle)', end: true }],
        },
        again: { say: ["~solemn~ The rider’s map still catches the sun: *sky stones, a monastery, a bell*. A route to another world."], choices: [{ text: '~neutral~ (step back)', end: true }] },
      },
    },
  },
  drawing: {
    id: 'drawing', name: 'A drawing in the sand', title: 'by Oïa’s stone', color: '#d9c9a8', voice: 0.6,
    talk: { nodes: { look: { say: ["~neutral~ Oïa’s drawing: three dots over an arc. {glyph} She calls it the bird’s track.", "~sad~ The wind is already rubbing it out."], choices: [{ text: '~neutral~ (step back)', end: true }] } } },
  },
  palm: {
    id: 'palm', name: 'The stone hand', title: 'reaching out of the plain', color: '#efe6d2', voice: 0.6,
    talk: {
      entry: [{ if: { flag: 'arzach.hand.rung' }, node: 'open' }, { node: 'look' }],
      nodes: {
        look: {
          say: ["~solemn~ A stone hand taller than a house. In its palm is the mark from your ship: {glyph}", "~neutral~ Four smooth knuckles rise above you. *A white feather* is caught between the fingers."],
          do: { start: 'arzach.hand' },
          choices: [{ text: '~curious~ (rap a knuckle)', goto: 'strike' }, { text: '~neutral~ (step back)', end: true }],
        },
        strike: {
          say: ["~neutral~ Your fist makes no sound. Try your fluid: *aim and shoot a knuckle*.", "~curious~ The four notes need an order. *Hollin, beside the hand*, can show you."],
          choices: [{ text: '~neutral~ (step back)', end: true }],
        },
        open: { say: ["~scared~ The mark glows in the palm. Was that finger always bent?"], choices: [{ text: '~neutral~ (step back)', end: true }] },
      },
    },
  },
};

/** The four knuckles, from the thumb side (index, middle, ring, little), and the order they ring in: smallest to tallest. */
export const KNUCKLE_ORDER = [3, 0, 2, 1];
