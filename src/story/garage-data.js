// The Sealed Hangar's story as data: "The Major Forgot" (docs/story-bible.md).
//
// Major Brask built this pocket universe and forgot why. His people keep
// the machines turning out of habit, and pass a signal round the three zones
// every day, a brass tube that ticks, that nobody can read: the clerk on the
// plateau gives it to the relay box in the upside-down quarter, the relay
// stamps it and sends it on to the ring, and Lune in the ring holds it up to
// the slit's light and sends it back round. You carry it, the whole round,
// and Lune sends you to the one place nobody looks: the Major's old desk, at
// the far edge of the upside-down slab. His note is there (a keepsake of the
// kind *knowing*), and on its back, his sums: the signal's ticks are a place,
// a wheel under sand that turns one tooth a year (the Buried Machine).
//
// Side quests: three machines stopped the night the light went over (the
// windmill on the plateau, the lamp pump in the upside-down, the ring's
// turbine); a shot of fluid restarts each. And Pip's ball: push it up the
// ring's curve, where down keeps turning under you, and through the portal to
// the plateau, where down stays down.
//
// Flags (game-state.js): garage.signal.given, garage.signal.stamped,
// garage.signal.read (Lune), garage.note.read, garage.machine.<mill|pump|turbine>,
// garage.machines.told, garage.ball.through, garage.rumour.light; clue.garage.buried.
// Items: signal.

const Q = 'garage.signal';

export const ITEMS = { signal: 'the signal (a brass tube that ticks)' };
export const MACHINES = { mill: 'the windmill', pump: 'the lamp pump', turbine: 'the ring’s turbine' };

// ------------------------------------------------------------------ quests
export const QUESTS = [
  {
    id: Q, title: 'The Major Forgot', world: 'garage', main: true,
    outro: "The signal led to the Major’s note and the coordinates of a buried wheel. He never settled what his own world was for.",
    stages: [
      { id: 'clerk', text: 'Everyone here is busy with something. Ask the clerk at the signal board by the path', label: 'Ambroise, at the signal board', flag: 'garage.signal.given', at: 'ambroise' },
      { id: 'relay', text: 'Carry the signal through the portal to the upside-down quarter, and post it in the relay box', label: 'The relay box', flag: 'garage.signal.stamped', at: 'relay' },
      { id: 'ring', text: 'Take the stamped signal on through the next portal, to Lune in the ring', label: 'Lune, in the ring', bring: 'signal', to: 'lune' },
      { id: 'note', text: 'Find the Major’s old desk, at the far edge of the upside-down slab, where nobody looks', label: 'The Major’s desk', flag: 'garage.note.read', at: 'desk' },
    ],
  },
  {
    id: 'garage.machines', title: 'Three Stopped Machines', world: 'garage',
    outro: "All three machines run again. Ottla can hear each one from the windmill.",
    stages: [
      { id: 'fix', text: 'Restart the three stopped machines with a shot of fluid: the windmill, the lamp pump in the upside-down, the ring’s turbine', label: 'A stopped machine', at: 'machine',
        when: (q) => ['mill', 'pump', 'turbine'].every((m) => q.game.flag(`garage.machine.${m}`)) },
      { id: 'tell', text: 'Tell Ottla the machines are turning', label: 'Ottla, by the windmill', talk: 'ottla', at: 'ottla' },
    ],
  },
  {
    id: 'garage.ball', title: 'Pip’s Ball', world: 'garage',
    outro: 'The ball went where down stays down.',
    stages: [
      { id: 'push', text: 'Push Pip’s ball up the ring’s curve and through the portal on the wall (C, middle click, or RB / R1)', label: 'Pip’s ball', flag: 'garage.ball.through', at: 'ball' },
      { id: 'tell', text: 'Tell Pip her ball got through', label: 'Pip', talk: 'pip', at: 'pip' },
    ],
  },
];

// ------------------------------------------------------------------ the people
export const PEOPLE = {
  ambroise: {
    id: 'ambroise', name: 'Ambroise', title: 'clerk of the round', color: '#62c3c9', voice: 1.0, kind: 'm',
    palette: { cloak: '#62c3c9', lining: '#2b211f', cloth: '#f3ead8', legs: '#34405e', hat: '#34405e', hair: '#2b211f' }, head: 'hat', cape: 0.55, look: { mask: 'monocle', body: 'toolbelt', prop: 'none', build: 'slim', height: 0.99 },
    lines: ['~playful~ Tick, tick. Tick.', '~tired~ The round goes at noon. Or whenever.', "~scared~ Don’t drop the signal. We have no form for that."],
    talk: {
      entry: [
        { if: { quest: Q, done: true }, node: 'after' },
        { if: { flag: 'garage.signal.given' }, node: 'again' },
        { node: 'hello' },
      ],
      nodes: {
        hello: {
          say: ["~playful~ Welcome! Everyone new stands there looking alarmed. I’m Ambroise. You’ll find up is locally administered.", "~neutral~ I’m clerk of the round. The signal travels from this board to the upside-down relay, then the ring, then back here. I send it out every day."],
          choices: [
            { text: '~curious~ What does the signal say?', goto: 'say' },
            { text: '~curious~ Who decided that?', goto: 'who' },
          ],
        },
        say: { say: ["~happy~ Nobody knows what it says! We are wonderfully consistent about that. The Major wrote it, then forgot how to read it."], choices: [{ text: '~curious~ Who is the Major?', goto: 'who' }, { text: '~curious~ Can I carry it?', goto: 'carry' }] },
        who: {
          say: ["~sad~ Major Brask built this place. Plateau, ring, portals. Possibly us. Then he forgot why, went for a walk, and hasn’t returned.", "~playful~ We keep it running for him. Stopping would involve a meeting."],
          choices: [{ text: '~curious~ Can I carry the signal round?', goto: 'carry' }, { text: '~neutral~ Goodbye.', end: true }],
        },
        carry: {
          say: ["~surprised~ You’d like to carry it? Voluntarily? Here. Keep it ticking. Nobody has established how, so doing nothing should suffice.", "~neutral~ Take the portal behind the start to the upside-down. Put the signal in the relay box by the path. Then carry it onward to *the ring*."],
          do: [{ give: 'signal' }, { set: { 'garage.signal.given': true } }],
          choices: [{ text: '~neutral~ Through the portal, the relay box, the ring.', end: true }],
        },
        again: {
          say: [{ if: { has: 'signal' }, text: "~playful~ Still ticking? Excellent. You remain qualified." }, { if: { not: { has: 'signal' } }, text: "~happy~ Someone else is doing the round. I think this is leisure. Should I sit down?" }],
          choices: [{ text: '~curious~ What does the board show?', goto: 'board' }, { text: '~happy~ See you, Ambroise.', end: true }],
        },
        board: { say: ["~tired~ Nine lamps blink the signal. Eleven years watching them and I know every blink. Understanding is apparently a separate department."], choices: [{ text: '~neutral~ See you.', end: true }] },
        after: { say: ["~happy~ The board has stopped blinking. Now it shows three dots above an arc. {glyph} A doorway with three lamps. A considerable improvement in legibility.", "~happy~ We still do the round. Now we know what we’re carrying. Makes the paperwork feel almost personal."], choices: [{ text: '~happy~ On purpose is good.', end: true }] },
      },
    },
  },
  ottla: {
    id: 'ottla', name: 'Ottla', title: 'mechanic of everything', color: '#e6875f', voice: 0.9, kind: 'f',
    palette: { cloak: '#e6875f', lining: '#2b211f', cloth: '#3f8f8a', legs: '#34405e', hat: '#d8a24a', hair: '#a8552e' }, head: 'wrap', cape: 0, look: { prop: 'wrench', body: 'toolbelt', mask: 'browgoggles' },
    lines: ['~angry~ Hand me that… no. That one.', '~neutral~ It’s not broken. It’s thinking.', '~curious~ Three of them. All at once. In one night.'],
    talk: {
      entry: [
        { if: { quest: 'garage.machines', done: true }, node: 'after' },
        { if: { quest: 'garage.machines', stage: 'tell' }, node: 'tell' },
        { if: { quest: 'garage.machines', active: true }, node: 'again' },
        { node: 'hello' },
      ],
      nodes: {
        hello: {
          say: ["~angry~ Hands off the windmill. I’m Ottla. I decide when it’s broken. It has been lobbying for the title.", "~scared~ Three machines stopped that night: *this windmill*, *the upside-down lamp pump*, and *the ring turbine*. No broken parts. I’ve checked everything twice."],
          choices: [
            { text: '~curious~ What night?', goto: 'night' },
            { text: '~neutral~ Can I help?', goto: 'help' },
          ],
        },
        night: { say: ["~playful~ Lune heard the ring’s slit sing. I slept through it, under the pump. Woke up to three silent machines. Worst morning of my career."], choices: [{ text: '~neutral~ Can I help?', goto: 'help' }, { text: '~curious~ What’s that mark on the great machine?', goto: 'mark' }] },
        mark: { say: ["~playful~ We call these *the maker’s rivets*. {glyph} The Major put them on machines, portals, apparently behind my ear. That last one is not open to inspection.", "~curious~ There’s a *blue star-box on the keep wall* too. The Major found it already marked. Said it was for the next traveller. That sounds inconveniently like you."], choices: [{ text: '~neutral~ Can I help with the machines?', goto: 'help' }, { text: '~playful~ I won’t.', end: true }] },
        help: {
          say: ["~neutral~ Try your fluid. *Shoot each machine in its moving parts.* The colour may start it again. Worth a try before I dismantle the universe."],
          do: { start: 'garage.machines' },
          choices: [{ text: '~neutral~ The windmill, the pump, the turbine.', end: true }],
        },
        again: { say: ["~neutral~ Shoot the windmill’s blades, the upside-down pump’s flywheel, and the ring turbine’s paddles. One good splash each."], choices: [{ text: '~neutral~ On it.', end: true }] },
        tell: {
          say: ["~happy~ All three! I can hear them from here. Don’t tell me every turbine sounds alike. I know that rattle.", "~sad~ Thank you. I kept waiting for them to restart on their own. It’s easy to lose years doing that here."],
          do: [{ advance: ['garage.machines', 'tell'] }],
          choices: [{ text: '~happy~ They just needed a little colour.', end: true }],
        },
        after: { say: ["~happy~ Running nicely. A little grease, a little attention. That’s most of caring for anything, really."], choices: [{ text: '~neutral~ (listen)', end: true }] },
      },
    },
  },
  lune: {
    id: 'lune', name: 'Lune', title: 'who reads the signal', color: '#a99be0', voice: 1.1, kind: 'f',
    palette: { cloak: '#a99be0', lining: '#2b211f', cloth: '#f3ead8', legs: '#34405e', hat: '#f2c54b', hair: '#e8dcc0' }, head: 'hood', cape: 1.25, look: { mask: 'goggles' },
    lines: ['~playful~ Look up. No, the other up.', '~neutral~ The light comes in through the slit at noon.', '~curious~ Everything here is down, just a different down.'],
    talk: {
      entry: [
        { if: { quest: Q, done: true }, node: 'after' },
        { if: { all: [{ has: 'signal' }, { flag: 'garage.signal.stamped' }] }, node: 'signal' },
        { if: { has: 'signal' }, node: 'unstamped' },
        { if: { quest: Q, stage: 'note' }, node: 'desk' },
        { node: 'hello' },
      ],
      nodes: {
        hello: {
          say: ["~surprised~ Welcome to the ring. Your feet seem to have reached an agreement with the floor. Good start.", "~neutral~ I’m Lune. I inspect the signal at noon. Hold it to the slit, look through it, send it on. Until today, that counted as reading it."],
          choices: [
            { text: '~curious~ Has anything strange happened here?', goto: 'light' },
            { text: '~curious~ Why is the turbine stopped?', goto: 'light' },
          ],
        },
        light: {
          say: ["~whisper~ I was beside the turbine when the singing light crossed the slit. Low and slow. The metal sang back to it.", "~scared~ Then the light turned. Deliberately, it seemed. By morning, our turbine and Ottla’s other two machines had stopped."],
          do: { set: { 'garage.rumour.light': true } },
          choices: [{ text: '~neutral~ My ship was struck that night.', goto: 'ship' }, { text: '~neutral~ (look up at the slit)', end: true }],
        },
        ship: { say: ["~curious~ It struck you that night? Then the turn mattered. Looking for you, or changing course after it hit you? I can’t tell.", "~curious~ The slit’s rim still pulls at our compasses. Your ship’s scar has the same pull. I checked. Hard evidence; comforting stuff."], choices: [{ text: '~neutral~ (look up at the slit)', end: true }] },
        unstamped: { say: ["~surprised~ The signal needs its stamp first. *Use the relay in the upside-down.* Then bring it back to me. The stamp opens the holes the light shines through."], choices: [{ text: '~tired~ Back to the upside-down, then.', end: true }] },
        signal: {
          say: ["~surprised~ You carried it all the way here? Good. Let’s finally see what we’ve been passing around.", "~solemn~ (Lune holds the tube to the slit. Nine dots of light fall on the floor between you.)", "~curious~ These are a reference. Numbers pointing to a place. The Major left his working notes somewhere."],
          do: [{ take: 'signal' }, { set: { 'garage.signal.read': true } }, { advance: [Q, 'ring'] }],
          next: 'where',
        },
        where: {
          say: ["~neutral~ Try his desk at the far edge of the upside-down slab. He liked to think there. I prefer my thinking with a railing."],
          choices: [{ text: '~neutral~ The desk at the slab’s edge.', end: true }, { text: '~curious~ Has anything strange happened here?', goto: 'light', if: { not: { flag: 'garage.rumour.light' } } }],
        },
        desk: { say: ["~neutral~ *The far edge of the upside-down slab.* Go back through *the ring’s wall portal*, cross the plateau, then use *the first portal*."], choices: [{ text: '~happy~ Thank you, Lune.', end: true }] },
        after: { say: ["~happy~ I still examine it at noon. Knowing the answer has made it more interesting, oddly enough."], choices: [{ text: '~happy~ It is.', end: true }] },
      },
    },
  },
  pip: {
    id: 'pip.garage', name: 'Pip', title: 'who doesn’t trust down', color: '#f2c54b', voice: 1.7, kind: 'f', scale: 0.7, age: 'child', years: 9,
    palette: { cloak: '#f2c54b', lining: '#2b211f', cloth: '#e88fa6', legs: '#34405e', hat: '#62c3c9', hair: '#6e4a32' }, head: 'hair', cape: 0.55,
    lines: ['~angry~ Down keeps MOVING.', '~shout~ Push it! Go on!', '~curious~ Is it still a ball upside down?'],
    talk: {
      entry: [
        { if: { quest: 'garage.ball', done: true }, node: 'after' },
        { if: { quest: 'garage.ball', stage: 'tell' }, node: 'through' },
        { if: { quest: 'garage.ball', active: true }, node: 'again' },
        { node: 'hello' },
      ],
      nodes: {
        hello: {
          say: ["~shout~ Careful on the curve! Down follows your feet here. I like down to make a commitment.", "~sad~ My ball needs to reach *the portal on the wall*. Beyond it is the plateau, where things stay put. But the wall is UP."],
          choices: [
            { text: '~happy~ I’ll push it up for you.', goto: 'push' },
            { text: '~curious~ Why does your ball want to go?', goto: 'why' },
          ],
        },
        why: { say: ["~sad~ It rolls away and comes back round behind me. Over and over. It has travelled farther than I have."], choices: [{ text: '~happy~ I’ll push it up for you.', goto: 'push' }] },
        push: {
          say: ["~happy~ Use your fluid’s *Push* gently. Roll the ball up the curve into *the wall portal*. Then it’ll reach the plateau!"],
          do: { start: 'garage.ball' },
          choices: [{ text: '~neutral~ Up the curve, through the portal.', end: true }],
        },
        again: { say: ["~shout~ Push it up the curve toward the wall portal! If it rolls all the way round, I’ll put it back. We’ve had practice."], choices: [{ text: '~neutral~ Got it.', end: true }] },
        through: {
          say: ["~surprised~ Through! It went through! Somewhere, my ball is sitting perfectly still. Lucky ball.", "~playful~ You just walked up the curve. No screaming. Do you charge for lessons?"],
          do: [{ advance: ['garage.ball', 'tell'] }],
          choices: [{ text: '~playful~ Very new.', end: true }],
        },
        after: { say: ["~sad~ I’ll follow it someday. Perhaps being scared is something you can carry through a door."], choices: [{ text: '~happy~ I hope you do.', end: true }] },
      },
    },
  },
};

/** The level's own people (content.js garage npcs, by index): the errands keep their places. */
export const LOCALS = [
  {
    id: 'clemence', name: 'Clemence', title: 'who remembers the Major', color: '#e6875f', voice: 1.05,
    talk: { listen: [
      ["~playful~ Mind your footing. Gravity here takes requests.", '~sad~ I knew the Major before he built all this, when he was just a man with a pencil and too many ideas. He built it all, and then he forgot.'],
      '~sad~ He remembered how, every rivet. But why he’d made a world in a garage, with three kinds of down and a ring you can walk round forever, that he lost.',
      '~tired~ Where did he go? For a walk, round the ring, I expect. He hasn’t been back. Or he has, and none of us noticed. He was like that.',
      '~solemn~ {glyph} His thumbprint, I called it. He said he’d found it scratched on a stone in his first garage, and copied it onto everything since. For luck. Or for somebody.',
      { after: { flag: 'garage.note.read' }, say: ['~sad~ You found his desk. You have the look of somebody who has read his handwriting. “That is the point.” Yes. That sounds like him.', '~solemn~ He never knew what he wanted it for. Not knowing, and doing it anyway, carefully: that was how he could bear to build something so big.'] },
      { if: { flag: 'garage.note.read' }, say: '~solemn~ There’s a wheel under a desert somewhere that turns one tooth a year, he told me once. If you go, tell it the Hangar is still turning.' },
    ] },
  },
  {
    id: 'nikko', name: 'Nikko', title: 'who greases the gears', color: '#62c3c9', voice: 1.2,
    talk: { listen: [
      "~shout~ Don’t lean on the gears. They complain to me afterwards.",
      '~happy~ I grease the great machine. All of it. By the time I get to the top, the bottom wants greasing again. Best job in the world: it never ends.',
      '~happy~ What does it do? It turns. Isn’t that enough? Ottla says it keeps the portals open, Ambroise says it keeps the signal ticking. I say it keeps us busy.',
      { if: { not: { quest: 'garage.machines', done: true } }, say: '~neutral~ A machine that’s stopped? *Give it a shot, right in the works*. Wakes them right up. Works on people too, but they complain more.' },
      '~angry~ Mind your boots. You’re standing in my grease.',
      { after: { flag: 'temple.garage.done' }, say: '~surprised~ The clock over the First Garage keeps true time now. I set my oil can by it. My oil can has never been so happy.' },
    ] },
  },
  {
    id: 'ferrol', name: 'Ferrol', title: 'who walked round the ring', color: '#f2c54b', voice: 0.8,
    talk: { listen: [
      "~tired~ I walked the whole ring once. Came back to my own footprints. They looked more rested than I did.",
      { if: { not: { flag: 'garage.note.read' } }, say: '~whisper~ I saw a desk once, at *the far edge of the upside-down*, with a lamp on it, still lit. Nobody sitting there. You don’t go near a desk like that. It might be waiting for you.' },
      '~neutral~ On the ring, down is outward. Jump, and the world curls up to meet you. Don’t think about it while you’re doing it.',
      '~tired~ Leave me be. I’m resting my feet. They walked a whole world.',
      { if: { not: { flag: 'box.garage.level' } }, say: '~curious~ There’s a box on top of *the keep’s south wall*. I saw it from the ring, upside down. Climb the wall, if you’ve the arms for it.' },
      { after: { flag: 'world.garage.done' }, say: '~happy~ They say the Major’s signal went out at last. Wherever it’s going, I hope it walks faster than I do.' },
    ] },
  },
];

// The scenery you can look at.
export const THINGS = {
  relay: {
    id: 'relay', name: 'The relay box', title: 'in the upside-down quarter', color: '#a99be0', voice: 0.6,
    talk: {
      entry: [{ if: { flag: 'garage.signal.stamped' }, node: 'again' }, { if: { has: 'signal' }, node: 'post' }, { node: 'empty' }],
      nodes: {
        post: {
          say: ["~neutral~ The relay swallows the ticking tube. A whirr, a pause, then the heavy clunk of a stamp.", "~neutral~ The tube returns warm, stamped with three dots over an arc. A tag reads *NEXT: THE RING*."],
          do: { set: { 'garage.signal.stamped': true } },
          choices: [{ text: '~neutral~ (take the signal)', end: true }],
        },
        empty: { say: ["~neutral~ An empty relay slot. Its label gives clear instructions: *SIGNAL FROM THE BOARD. NEXT STOP: THE RING.*"], choices: [{ text: '~neutral~ (step back)', end: true }] },
        again: { say: ["~neutral~ The relay lamp blinks in time with the signal."], choices: [{ text: '~neutral~ (step back)', end: true }] },
      },
    },
  },
  note: {
    id: 'note', name: 'The Major’s desk', title: 'at the slab’s far edge', color: '#fff6dc', voice: 0.6,
    talk: {
      entry: [{ if: { flag: 'garage.note.read' }, node: 'again' }, { node: 'read' }],
      nodes: {
        read: {
          say: ["~solemn~ A desk at the slab’s edge. The lamp is on, the chair pushed back. A cog holds down one sheet of paper.",
            "~solemn~ The Major’s careful handwriting: *I built it to see what I would do with it. I still don’t know. That is the point.*",
            "~surprised~ The back shows nine ticks, coordinates, and a wheel under sand. *One tooth a year. Go and see it turn.* Added later: *Went. Saw. Came back.*"],
          do: [{ set: { 'garage.note.read': true, 'clue.garage.buried': true } },
            { keepsake: { id: 'garage.knowing', level: 'garage', name: 'The Major’s note', kind: 'knowing', text: '“I built it to see what I would do with it. I still don’t know. That is the point.”' } }],
          choices: [{ text: '~solemn~ (fold it, and keep it)', end: true }],
        },
        again: { say: ["~neutral~ The Major’s lamp still burns beside his note. On its back: coordinates for the wheel beneath the sand."], choices: [{ text: '~neutral~ (step back)', end: true }] },
      },
    },
  },
};

/** The glyph on the signal board's nine lamps: three dots over an arc. */
export const BOARD_GLYPH = [1, 1, 1, 0, 1, 0, 1, 0, 1];   // (the arc bows up, ∩: its top in the middle row, its feet below)
/** The signal itself, as the board blinks it: nine lamps per beat, a loop of beats. */
export const SIGNAL = [
  [1, 0, 1, 0, 1, 0, 1, 0, 1], [0, 1, 0, 1, 0, 1, 0, 1, 0], [1, 1, 0, 0, 1, 0, 0, 1, 1], [0, 0, 1, 1, 0, 1, 1, 0, 0],
  [1, 0, 0, 1, 1, 0, 0, 0, 1], [0, 1, 1, 0, 0, 0, 1, 1, 0], [1, 1, 1, 0, 0, 0, 1, 0, 1], [0, 0, 0, 1, 1, 1, 0, 1, 0],
];
