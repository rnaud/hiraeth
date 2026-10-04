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
          say: ['~solemn~ (She doesn’t look round. She is watching *the lone tower*, far off across the plain.)', '~solemn~ (After a long while she lifts one hand and points: at the tower, at the bird, at the tower again.)'],
          do: { set: { 'arzach.watcher.met': true } },
          choices: [
            { text: '~curious~ Who lived in the tower?', goto: 'rider' },
            { text: '~whisper~ (sit with her, and say nothing)', goto: 'silence' },
          ],
        },
        silence: {
          say: ['~whisper~ (You sit. The wind moves the sand. The bird, a little way off, shifts her feet and looks at the tower too.)', '~happy~ (Oïa glances at you, and almost smiles.)'],
          choices: [{ text: '~curious~ Who lived in the tower?', goto: 'rider' }, { text: '~neutral~ (get up)', end: true }],
        },
        rider: {
          say: ['~neutral~ (She touches her shoulder where a cloak would be pinned, and makes a flapping shape with two fingers. A rider.)', '~sad~ (Then she opens her hand flat and blows across it, as if something light were carried off.)', '~sad~ Gone.'],
          choices: [{ text: '~sad~ And the bird is still waiting.', goto: 'track' }, { text: '~curious~ Gone where?', goto: 'where' }],
        },
        where: {
          say: ['~neutral~ (She points past the tower, up, to where the sky is paler. Then she shrugs: far.)'],
          choices: [{ text: '~sad~ And the bird is still waiting.', goto: 'track' }],
        },
        track: {
          say: ['~solemn~ (She nods, once. She smooths the sand in front of her and draws in it with one finger: three dots, and a curve beneath them.) {glyph}', '~neutral~ (She points at the bird’s feet: three long toes, the curved heel.) Her track.', '~whisper~ (Under the track she draws a small square with *a star on its lid*, then points *north, at the needle spire*. Something waits up there, she means. Something left for whoever climbs.)'],
          do: { set: { 'arzach.glyph.drawn': true } },
          choices: [
            { text: '~surprised~ I’ve seen that mark before. On my ship.', goto: 'mark' },
            { text: '~neutral~ I’ll go to the tower.', goto: 'go' },
          ],
        },
        mark: {
          say: ['~surprised~ (She looks at you sharply. She taps the drawing, then the stone she sits on, then points out at the great stone hand on the plain.)', '~solemn~ (Everywhere. She spreads her hands: as old as the stones. Nobody knows who walked here first.)'],
          choices: [{ text: '~neutral~ I’ll go to the tower.', goto: 'go' }],
        },
        go: { say: ['~neutral~ (She points at the bird. Then she makes a little climbing gesture with two fingers, *up and round, up and round*.)'], choices: [{ text: '~neutral~ (nod)', end: true }] },
        again: {
          say: [{ if: { flag: 'arzach.window.seen' }, text: '~curious~ (Oïa looks at your empty hands, and back at the tower. Did you find it?)' },
            { if: { not: { flag: 'arzach.window.seen' } }, text: '~neutral~ (Oïa points at *the bird, then at the tower*. Go on.)' }],
          choices: [{ text: '~curious~ Who lived in the tower?', goto: 'rider', if: { not: { flag: 'arzach.glyph.drawn' } } }, { text: '~neutral~ (nod)', end: true }],
        },
        whistle: {
          say: ['~solemn~ (She sees the whistle in your hand and goes very still.)', '~whisper~ (Then she reaches out and touches the feather tied to it, once, lightly. She nods to you.) *Blow*.'],
          choices: [{ text: '~neutral~ (nod)', end: true }],
        },
        after: {
          say: ['~happy~ (Oïa is drawing in the sand: a bird, and a small figure on its back. It isn’t the rider. It looks a little like you.)', '~solemn~ (She isn’t watching the tower any more. She is only looking at it.)'],
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
    talk: {
      nodes: {
        hello: {
          say: ['~playful~ (The boy stares at you. You tilt your head; he tilts his.)', '~playful~ (You lift a hand. He lifts a hand, exactly as high.)'],
          choices: [
            { text: '~happy~ (wave)', goto: 'wave' },
            { text: '~neutral~ (point at the tower)', goto: 'tower' },
            { text: '~curious~ Can you talk?', goto: 'talk' },
          ],
        },
        wave: { say: ['~happy~ (He waves back enormously, with both arms, then points behind you at the bird and flaps.)'], choices: [{ text: '~playful~ (flap back)', end: true }] },
        tower: { say: ['~scared~ (He shakes his head hard, hugs himself and shivers. Too high. Too cold.)', '~playful~ (Then he points at the stone hand out on the plain and taps his own knuckles, quickly, in no order at all, and laughs.)'], choices: [{ text: '~happy~ (laugh)', end: true }] },
        talk: { say: ['~playful~ (He opens his mouth very wide and says nothing at all, very loudly.)'], choices: [{ text: '~happy~ (clap)', end: true }] },
      },
    },
  },
  {
    id: 'senn', name: 'Senn', title: 'who listens to stones', color: '#d8c7a6', voice: 0.9,
    talk: {
      entry: [{ if: { quest: 'arzach.feathers', done: true }, node: 'after' }, { if: { flag: 'met.senn' }, node: 'again' }, { node: 'hello' }],
      nodes: {
        hello: {
          say: ['~whisper~ Shh.', '~whisper~ (She has her ear pressed to a standing stone. She holds up a finger: wait.)', '~whisper~ …They hum. Since the night the light went over.'],
          choices: [
            { text: '~curious~ What light?', goto: 'light' },
            { text: '~curious~ The bird knows the way?', goto: 'bird' },
            { text: '~neutral~ (leave her to listen)', end: true },
          ],
        },
        light: {
          say: ['~solemn~ (She looks up. She hums one long note, rising, and draws a slow line across the sky with her finger. At the end of it, a sharp turn.)', '~solemn~ It sang. The stones answered. The bird cried all night.'],
          do: { set: { 'arzach.rumour.light': true } },
          choices: [{ text: '~surprised~ That was the night my ship fell.', goto: 'ship' }, { text: '~curious~ The bird cried?', goto: 'cried' }],
        },
        ship: { say: ['~solemn~ (She looks at you a long moment.) Then it sang for you.', '~neutral~ (She puts her ear back to the stone.)'], choices: [{ text: '~curious~ The bird cried?', goto: 'cried' }, { text: '~neutral~ (leave her to listen)', end: true }] },
        cried: {
          say: ['~sad~ All night. Shook herself. (She plucks at her own sleeve.) Feathers everywhere.', '~neutral~ (She points at *the high flat tops of two spires*, then out at *the stone hand*.) Up there. And there. One the hand caught.'],
          do: { start: 'arzach.feathers' },
          choices: [{ text: '~happy~ I’ll find them for her.', end: true }],
        },
        bird: { say: ['~sad~ (She nods toward the tower.) Waited there. Long time. Now she waits here, and looks there.'], choices: [{ text: '~curious~ What light? You said the stones hum.', goto: 'light' }, { text: '~neutral~ (leave her to listen)', end: true }] },
        again: {
          say: ['~neutral~ (Senn lifts her ear from the stone, listens to you instead, and nods.)'],
          choices: [{ text: '~curious~ Tell me about the light again.', goto: 'light' }, { text: '~curious~ Where are the feathers?', if: { quest: 'arzach.feathers', active: true }, goto: 'cried' }, { text: '~neutral~ (leave her to listen)', end: true }],
        },
        after: { say: ['~happy~ (She touches the feathers in her own hair, then points at the bird.) Bright. Good.', '~happy~ (The stone under her hand is humming. She smiles.)'], choices: [{ text: '~whisper~ (listen with her)', end: true }] },
      },
    },
  },
  {
    id: 'hollin', name: 'Hollin', title: 'who keeps the hand', color: '#b0705a', voice: 0.65,
    talk: {
      entry: [{ if: { flag: 'arzach.hand.rung' }, node: 'after' }, { if: { quest: 'arzach.hand', active: true }, node: 'again' }, { node: 'hello' }],
      nodes: {
        hello: {
          say: ['~tired~ Hm.', '~neutral~ (An old man with very big hands. He holds one up beside the great stone hand out on the plain, as if comparing them.)', '~solemn~ Alive, once. Rang, once.'],
          choices: [
            { text: '~curious~ Rang?', goto: 'rang' },
            { text: '~curious~ Whose hand was it?', goto: 'whose' },
            { text: '~neutral~ (leave him be)', end: true },
          ],
        },
        whose: { say: ['~whisper~ (He points at the long stone body lying in the sand beyond it, the face turned to the sky. Then he shrugs.) Sleeping.'], choices: [{ text: '~curious~ You said it rang.', goto: 'rang' }] },
        rang: {
          say: ['~neutral~ (He raps his knuckles on a stone: tok, tok.) Knuckles. Like bells.', '~neutral~ (He holds up his hand and touches his fingers one at a time: the smallest first, then the first finger, then the ring finger, and the tallest last.)', '~playful~ *Small to tall*. (He mimes throwing something at the hand. Splash.)'],
          do: { start: 'arzach.hand' },
          choices: [{ text: '~curious~ With the fluid?', goto: 'fluid' }, { text: '~curious~ What happens when it rings?', goto: 'gives' }],
        },
        fluid: { say: ['~playful~ (He points at *your tank, then at the hand*, and grins with three teeth.)'], choices: [{ text: '~curious~ What happens when it rings?', goto: 'gives' }, { text: '~neutral~ I’ll try.', end: true }] },
        gives: { say: ['~solemn~ (He cups his hand. Then he opens it slowly, palm up.)', '~solemn~ Gives.'], choices: [{ text: '~neutral~ I’ll try.', end: true }] },
        again: {
          say: ['~tired~ (Hollin holds up his hand again and taps the fingers for you, slowly: *smallest, first, ring, tallest*.)', '~neutral~ Small to tall.'],
          choices: [{ text: '~neutral~ (nod)', end: true }],
        },
        after: { say: ['~happy~ (He holds up his hand and opens it, slowly, and nods at you.)', '~sad~ Rang. (He looks very pleased, and a little sad.) Long time.'], choices: [{ text: '~neutral~ (nod)', end: true }] },
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
          say: ['~whisper~ You lean in at the window. Inside is one round room, swept clean and very quiet. A narrow bed. A cup turned upside down.',
            '~neutral~ On the curved wall, painted in pale ochre: *stones floating over a sea of cloud*, dotted lines between them, a monastery on a cliff with a bell. Beneath it a small figure walks away along an aqueduct, toward a tower on a peach-coloured plain.',
            '~sad~ On a nail by the window hangs *a bone whistle with a white feather* tied to it. The cord has been knotted and unknotted many times, as if someone kept deciding, and undeciding, to leave it.'],
          do: [{ set: { 'arzach.window.seen': true, 'clue.arzach.arzach2': true } }, { give: 'whistle' }],
          choices: [{ text: '~solemn~ (take the whistle)', end: true }],
        },
        again: { say: ['~solemn~ The room is still. *The map of the sky stones* glows on the wall in the low sun: the floating stones, the monastery, the bell, the figure walking away.'], choices: [{ text: '~neutral~ (step back)', end: true }] },
      },
    },
  },
  drawing: {
    id: 'drawing', name: 'A drawing in the sand', title: 'by Oïa’s stone', color: '#d9c9a8', voice: 0.6,
    talk: { nodes: { look: { say: ['~neutral~ Three dots over a curve, drawn with one finger: {glyph} The bird’s track, Oïa says. Her toes and her heel.', '~sad~ The wind has started to soften its edges.'], choices: [{ text: '~neutral~ (step back)', end: true }] } } },
  },
  palm: {
    id: 'palm', name: 'The stone hand', title: 'reaching out of the plain', color: '#efe6d2', voice: 0.6,
    talk: {
      entry: [{ if: { flag: 'arzach.hand.rung' }, node: 'open' }, { node: 'look' }],
      nodes: {
        look: {
          say: ['~solemn~ The hand is taller than a house, the palm turned to the start of the plain. In the middle of the palm, worn shallow, the mark: {glyph}', '~neutral~ Its four knuckles are pale and smooth, as if they had been *struck many times*, long ago. Between two stone fingers *something white* flutters, out of reach.'],
          do: { start: 'arzach.hand' },
          choices: [{ text: '~curious~ (rap a knuckle)', goto: 'strike' }, { text: '~neutral~ (step back)', end: true }],
        },
        strike: {
          say: ['~neutral~ Your knuckles on the stone make no sound at all. But a splash of your fluid, from a distance, would ring it like a bell: *aim and shoot a knuckle*.', '~curious~ Four knuckles, four notes. They want *an order*. *Hollin, who keeps the hand*, would know it.'],
          choices: [{ text: '~neutral~ (step back)', end: true }],
        },
        open: { say: ['~scared~ The mark in the palm still glows faintly, like a coal. The hand has not moved. You are almost sure it has not moved.'], choices: [{ text: '~neutral~ (step back)', end: true }] },
      },
    },
  },
};

/** The four knuckles, from the thumb side (index, middle, ring, little), and the order they ring in: smallest to tallest. */
export const KNUCKLE_ORDER = [3, 0, 2, 1];
