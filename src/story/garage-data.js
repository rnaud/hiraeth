// The Airtight Garage's story as data: "The Major Forgot" (docs/story-bible.md).
//
// Major Grubert built this pocket universe and forgot why. His people keep
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
    outro: 'He built it to see what he would do with it. So did you.',
    stages: [
      { id: 'clerk', text: 'Everyone here is busy with something. Ask the clerk at the signal board by the path', label: 'Ambroise, at the signal board', flag: 'garage.signal.given', at: 'ambroise' },
      { id: 'relay', text: 'Carry the signal through the portal to the upside-down quarter, and post it in the relay box', label: 'The relay box', flag: 'garage.signal.stamped', at: 'relay' },
      { id: 'ring', text: 'Take the stamped signal on through the next portal, to Lune in the ring', label: 'Lune, in the ring', bring: 'signal', to: 'lune' },
      { id: 'note', text: 'Find the Major’s old desk, at the far edge of the upside-down slab, where nobody looks', label: 'The Major’s desk', flag: 'garage.note.read', at: 'desk' },
    ],
  },
  {
    id: 'garage.machines', title: 'Three Stopped Machines', world: 'garage',
    outro: 'They turn again. Out of habit, Ottla says. Habit is a kind of love.',
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
      { id: 'push', text: 'Push Pip’s ball up the ring’s curve and through the portal on the wall (C, middle click, or B / ○)', label: 'Pip’s ball', flag: 'garage.ball.through', at: 'ball' },
      { id: 'tell', text: 'Tell Pip her ball got through', label: 'Pip', talk: 'pip', at: 'pip' },
    ],
  },
];

// ------------------------------------------------------------------ the people
export const PEOPLE = {
  ambroise: {
    id: 'ambroise', name: 'Ambroise', title: 'clerk of the round', color: '#62c3c9', voice: 1.0, kind: 'm',
    palette: { cloak: '#62c3c9', lining: '#2b211f', cloth: '#f3ead8', legs: '#34405e', hat: '#34405e', hair: '#2b211f' }, head: 'hat', cape: 0.55,
    lines: ['~playful~ Tick, tick. Tick.', '~tired~ The round goes at noon. Or whenever.', '~scared~ Don’t drop it. Nobody knows what happens if you drop it.'],
    talk: {
      entry: [
        { if: { quest: Q, done: true }, node: 'after' },
        { if: { flag: 'garage.signal.given' }, node: 'again' },
        { node: 'hello' },
      ],
      nodes: {
        hello: {
          say: ['~playful~ Ah. You’re new. Everyone who’s new stands exactly there and looks exactly like that. Up is a matter of opinion, but you’ll get used to it.', '~neutral~ Me? I’m the clerk of the round. Every day the signal comes back to this board, and every day I send it round again: down to the upside-down, on to the ring, back to me.'],
          choices: [
            { text: '~curious~ What does the signal say?', goto: 'say' },
            { text: '~curious~ Who decided that?', goto: 'who' },
          ],
        },
        say: { say: ['~happy~ Nobody knows! Isn’t it marvellous? It ticks. The board blinks it. Lune in the ring holds it up to the light. Nobody can read it. The Major wrote it, and the Major forgot.'], choices: [{ text: '~curious~ Who is the Major?', goto: 'who' }, { text: '~curious~ Can I carry it?', goto: 'carry' }] },
        who: {
          say: ['~sad~ Major Grubert. He built all of this: the plateau, the upside-down, the ring, the portals, us, probably. Then one morning he couldn’t remember why, and he went for a walk, and he hasn’t come back.', '~playful~ We keep everything turning in case he does. Out of habit. Habit is very underrated.'],
          choices: [{ text: '~curious~ Can I carry the signal round?', goto: 'carry' }, { text: '~neutral~ Goodbye.', end: true }],
        },
        carry: {
          say: ['~surprised~ You want to? Nobody ever wants to; that’s why there’s a clerk. Here. Mind, it ticks. Don’t try to stop it ticking.', '~neutral~ Through the portal behind the start, to the upside-down. Post it in the relay box by the path there. It’ll know what to do. Then on, to the ring.'],
          do: [{ give: 'signal' }, { set: { 'garage.signal.given': true } }],
          choices: [{ text: '~neutral~ Through the portal, the relay box, the ring.', end: true }],
        },
        again: {
          say: [{ if: { has: 'signal' }, text: '~playful~ Still got it? It’s ticking a little faster, I think. It likes you.' }, { if: { not: { has: 'signal' } }, text: '~happy~ The round goes on without me, for once. Strange feeling. Like a holiday.' }],
          choices: [{ text: '~curious~ What does the board show?', goto: 'board' }, { text: '~happy~ See you, Ambroise.', end: true }],
        },
        board: { say: ['~tired~ The signal, as it goes. Nine lamps. On, off, on. I’ve watched it for eleven years and I could draw it with my eyes shut, and I still couldn’t tell you what it means.'], choices: [{ text: '~neutral~ See you.', end: true }] },
        after: { say: ['~happy~ The board stopped blinking the signal, and now it just shows that mark. Three dots, a curve. Like a face smiling with its eyes shut. I quite like it.', '~happy~ The round goes on, of course. Out of habit. But now we know we’re doing it on purpose.'], choices: [{ text: '~happy~ On purpose is good.', end: true }] },
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
          say: ['~angry~ Don’t touch the windmill. It’s not broken. It’s thinking about whether to be broken.', '~scared~ Three machines stopped in one night: this windmill, the lamp pump in the upside-down, and the big turbine in the ring. Nothing wrong with any of them. They just… stopped.'],
          choices: [
            { text: '~curious~ What night?', goto: 'night' },
            { text: '~neutral~ Can I help?', goto: 'help' },
            { text: '~curious~ What’s that mark on the great machine?', goto: 'mark' },
          ],
        },
        night: { say: ['~playful~ The night the slit in the ring sang, Lune says. I didn’t hear it. I was asleep under the pump. When I woke up, three machines had stopped, and the fourth was me.'], choices: [{ text: '~neutral~ Can I help?', goto: 'help' }] },
        mark: { say: ['~playful~ The maker’s rivets. {glyph} Three over a curve. The Major put them on everything he was proud of, Malvina says. The great machine. The portals’ footings. Me, if you look behind my ear. Don’t look behind my ear.', '~curious~ And the blue box on the keep wall, with the star. He didn’t make that one. He found it, rivets and all, and never opened it. Not mine, he said: it’s for the next one. Are you the next one?'], choices: [{ text: '~neutral~ Can I help with the machines?', goto: 'help' }, { text: '~playful~ I won’t.', end: true }] },
        help: {
          say: ['~neutral~ With that tank on your back? Maybe. Machines here run on habit and a little colour. Give each one a squirt of whatever’s in there: shoot it, right in the works. If it remembers what it’s for, it’ll start.'],
          do: { start: 'garage.machines' },
          choices: [{ text: '~neutral~ The windmill, the pump, the turbine.', end: true }],
        },
        again: { say: ['~neutral~ Shoot them right in the works. The windmill’s blades, the pump’s flywheel in the upside-down, the turbine’s paddles in the ring.'], choices: [{ text: '~neutral~ On it.', end: true }] },
        tell: {
          say: ['~happy~ I heard them. I heard all three, from here, even the ring. You can hear a machine you love from anywhere.', '~sad~ Thank you. I’d have waited for them forever. That’s the trouble with this place: forever is very easy here.'],
          do: [{ advance: ['garage.machines', 'tell'] }],
          choices: [{ text: '~happy~ They just needed a little colour.', end: true }],
        },
        after: { say: ['~happy~ Listen to that. Out of habit. Habit is a kind of love, you know. The kind that doesn’t need a reason.'], choices: [{ text: '~neutral~ (listen)', end: true }] },
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
          say: ['~surprised~ A visitor, the right way up! Well. Your way up. Everybody’s up here is a different one; that’s the ring for you.', '~neutral~ I read the signal when it comes round. Read is a big word. I hold it up to the slit at noon, and look at the light coming through it, and send it on.'],
          choices: [
            { text: '~curious~ Has anything strange happened here?', goto: 'light' },
            { text: '~curious~ Why is the turbine stopped?', goto: 'light' },
          ],
        },
        light: {
          say: ['~whisper~ The slit sang. The night before you came. I was lying on my back by the turbine, looking up at the stars through it, and a light went across, slow, slow, singing like a glass rubbed with a wet finger.', '~scared~ Then it turned. Lights don’t turn. And in the morning the turbine had stopped, and so had two other machines, Ottla says.'],
          do: { set: { 'garage.rumour.light': true } },
          choices: [{ text: '~neutral~ My ship fell that night.', goto: 'ship' }, { text: '~neutral~ (look up at the slit)', end: true }],
        },
        ship: { say: ['~curious~ Then the light was looking for something that fell. Or something fell because it looked. The Major would know. The Major would have forgotten.'], choices: [{ text: '~neutral~ (look up at the slit)', end: true }] },
        unstamped: { say: ['~surprised~ That’s the signal! But it isn’t stamped. It has to go through the relay in the upside-down first, or the light won’t come through it right. Don’t ask me why. Habit.'], choices: [{ text: '~tired~ Back to the upside-down, then.', end: true }] },
        signal: {
          say: ['~surprised~ You brought the round yourself? Nobody has done that since… nobody has done that.', '~solemn~ (She holds the tube up to the slit. Noon light comes through it in nine little dots and lies on the floor between you: on, off, on, on…)', '~curious~ Hm. That’s not a message. It’s never been a message. It’s a page number. Or a place. The Major wrote it on the back of something.'],
          do: [{ take: 'signal' }, { set: { 'garage.signal.read': true } }, { advance: [Q, 'ring'] }],
          next: 'where',
        },
        where: {
          say: ['~neutral~ He had a desk once. In the upside-down, at the very edge of the slab, where nobody goes because the edge is a long way down, or up. The Major went there to think. Go and look. I’ll keep the round going.'],
          choices: [{ text: '~neutral~ The desk at the slab’s edge.', end: true }, { text: '~curious~ Has anything strange happened here?', goto: 'light', if: { not: { flag: 'garage.rumour.light' } } }],
        },
        desk: { say: ['~neutral~ The Major’s desk: at the far edge of the upside-down slab. Back through the portal on the wall, across the plateau, through the first portal. A long way round. Everything here is.'], choices: [{ text: '~happy~ Thank you, Lune.', end: true }] },
        after: { say: ['~happy~ I still hold it up to the light at noon. I know what it says now. It’s nicer, somehow, when you know and you look anyway.'], choices: [{ text: '~happy~ It is.', end: true }] },
      },
    },
  },
  pip: {
    id: 'pip', name: 'Pip', title: 'who doesn’t trust down', color: '#f2c54b', voice: 1.7, kind: 'f', scale: 0.7,
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
          say: ['~shout~ Don’t walk up there! If you walk up the curve, down goes with you, and then the ground’s over there and the sky is in your feet.', '~sad~ My ball wants to go to the plateau. Where down stays down. Through the portal on the wall up there. But the wall is UP.'],
          choices: [
            { text: '~happy~ I’ll push it up for you.', goto: 'push' },
            { text: '~curious~ Why does your ball want to go?', goto: 'why' },
          ],
        },
        why: { say: ['~sad~ Because it rolls away from me every time. Round and round. It keeps coming back from the other side. A ball should be allowed to stop somewhere.'], choices: [{ text: '~happy~ I’ll push it up for you.', goto: 'push' }] },
        push: {
          say: ['~happy~ Really? Push it with your squirty thing, the shove one. It rolls forever here, there’s nothing to stop it, so be gentle. Up the curve, to the portal on the wall. Then it’s on the plateau!'],
          do: { start: 'garage.ball' },
          choices: [{ text: '~neutral~ Up the curve, through the portal.', end: true }],
        },
        again: { say: ['~shout~ Up the curve! Toward the portal on the wall! If it comes back round from the other side, don’t worry, I’ll put it back here.'], choices: [{ text: '~neutral~ Got it.', end: true }] },
        through: {
          say: ['~surprised~ It went through? It went THROUGH? Then it’s on the plateau, and down there down stays down, and it can stop.', '~playful~ Thank you. You walked up the curve and you didn’t even fall off. You’re very brave or very new.'],
          do: [{ advance: ['garage.ball', 'tell'] }],
          choices: [{ text: '~playful~ Very new.', end: true }],
        },
        after: { say: ['~sad~ Someday I’ll go through too. When down stops moving. Or when I stop minding.'], choices: [{ text: '~happy~ I hope you do.', end: true }] },
      },
    },
  },
};

/** The level's own people (content.js garage npcs, by index): the errands keep their places. */
export const LOCALS = [
  {
    id: 'malvina', name: 'Malvina', title: 'who remembers the Major', color: '#e6875f', voice: 1.05,
    talk: {
      entry: [{ if: { flag: 'garage.note.read' }, node: 'note' }, { node: 'hello' }],
      nodes: {
        note: {
          say: ['~sad~ You found his desk. I can tell; you have the look of somebody who has read his handwriting. “That is the point.” Yes. That sounds like him.', '~solemn~ He never did know what he wanted it for. I think that was the only way he could bear to build something so big: not knowing, and doing it anyway, carefully.'],
          choices: [{ text: '~curious~ And the wheel under the sand?', goto: 'wheel' }, { text: '~happy~ Thank you, Malvina.', end: true }],
        },
        wheel: { say: ['~solemn~ Ah. The wheel. A machine somewhere out under a desert that turns one tooth a year; people there time their lives by it, he said. He went to see it once, and came back very quiet. If you go, tell it the Garage is still turning.'], choices: [{ text: '~solemn~ I will.', end: true }] },
        hello: {
          say: ['~playful~ Up is a matter of opinion here. Down is a matter of habit.', '~sad~ I knew the Major. Knew him before he built all this, when he was just a man with a pencil and too many ideas. He built it all, and then he forgot.'],
          choices: [
            { text: '~curious~ Forgot what?', goto: 'forgot' },
            { text: '~curious~ Where did he go?', goto: 'where' },
            { text: '~curious~ What’s the mark on the great machine?', goto: 'mark' },
          ],
        },
        forgot: { say: ['~sad~ Why. He remembered how, every rivet. But why he’d made a world in a garage, with three kinds of down and a ring you can walk round forever, that he lost. It bothered him terribly. Then it stopped bothering him, which bothered me more.'], choices: [{ text: '~curious~ Where did he go?', goto: 'where' }] },
        where: { say: ['~tired~ For a walk. Round the ring, I expect. Walk far enough and you’re back, they say. He hasn’t been back. Or he has, and none of us noticed. He was like that.'], choices: [{ text: '~curious~ What’s the mark on the great machine?', goto: 'mark' }, { text: '~happy~ Thank you, Malvina.', end: true }] },
        mark: { say: ['~solemn~ His thumbprint, I called it. {glyph} He said it wasn’t his: he’d found it, scratched on a stone in his first garage, before any of this, and copied it onto everything since. For luck, he said. Or for somebody.'], choices: [{ text: '~happy~ Thank you, Malvina.', end: true }] },
      },
    },
  },
  {
    id: 'nikko', name: 'Nikko', title: 'who greases the gears', color: '#62c3c9', voice: 1.2,
    talk: {
      nodes: {
        hello: {
          say: ['~shout~ Don’t lean on the gears! They don’t like it. They tell me, after.', '~happy~ I grease the great machine. All of it. By the time I get to the top, the bottom wants greasing again. It’s the best job in the world. It never ends.'],
          choices: [{ text: '~curious~ What does the great machine do?', goto: 'does' }, { text: '~happy~ Bye, Nikko.', end: true }],
        },
        does: { say: ['~happy~ It turns. Isn’t that enough? Ottla says it keeps the portals open. Ambroise says it keeps the signal ticking. I think it keeps us busy, and that’s the most important job of all.'], choices: [{ text: '~happy~ Bye, Nikko.', end: true }] },
      },
    },
  },
  {
    id: 'ferrol', name: 'Ferrol', title: 'who walked round the ring', color: '#f2c54b', voice: 0.8,
    talk: {
      nodes: {
        hello: {
          say: ['~tired~ The ring? Walk far enough and you’re back. I did it once. Took a week. When I got back I was standing on my own footprints, and they were older than me.'],
          choices: [{ text: '~curious~ Did you see the Major?', goto: 'major' }, { text: '~neutral~ Bye.', end: true }],
        },
        major: { say: ['~whisper~ I saw a desk at the edge of the upside-down once, with a lamp on it, still lit. Nobody sitting there. I didn’t go near. You don’t go near a desk like that. It might be waiting for you.'], choices: [{ text: '~neutral~ Bye, Ferrol.', end: true }] },
      },
    },
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
          say: ['~neutral~ You post the ticking tube into the slot. The box swallows it, thinks, and whirs. A stamp comes down inside with a sound like a door closing on another floor.', '~neutral~ The tube slides out again, warm, with a fresh mark pressed into the brass: three dots over a curve. A tag clicks out beside it: *NEXT: THE RING*.'],
          do: { set: { 'garage.signal.stamped': true } },
          choices: [{ text: '~neutral~ (take the signal)', end: true }],
        },
        empty: { say: ['~neutral~ A box with a slot, a stamp, and a lamp that blinks when the round comes. Today it’s waiting. A tag on its side says: *THE SIGNAL. FROM THE BOARD. TO THE RING.*'], choices: [{ text: '~neutral~ (step back)', end: true }] },
        again: { say: ['~neutral~ The relay hums to itself. Its lamp keeps the signal’s time, on, off, on.'], choices: [{ text: '~neutral~ (step back)', end: true }] },
      },
    },
  },
  note: {
    id: 'note', name: 'The Major’s desk', title: 'at the slab’s far edge', color: '#fff6dc', voice: 0.6,
    talk: {
      entry: [{ if: { flag: 'garage.note.read' }, node: 'again' }, { node: 'read' }],
      nodes: {
        read: {
          say: ['~solemn~ A desk at the very edge of the slab, upside down to the whole universe and the right way up to you. The lamp on it is still lit. A chair, pushed back as if someone had just stood up. One sheet of paper, held down by a cog.',
            '~solemn~ In a careful hand: *I built it to see what I would do with it. I still don’t know. That is the point.*',
            '~surprised~ On the back, in a hurried hand, sums: nine ticks, a row of numbers, a sketch of a great wheel half under sand with one tooth marked, and: *turns one tooth a year — go and see it turn.*'],
          do: [{ set: { 'garage.note.read': true, 'clue.garage.buried': true } },
            { keepsake: { id: 'garage.knowing', level: 'garage', name: 'The Major’s note', kind: 'knowing', text: '“I built it to see what I would do with it. I still don’t know. That is the point.”' } }],
          choices: [{ text: '~solemn~ (fold it, and keep it)', end: true }],
        },
        again: { say: ['~neutral~ The lamp is still lit. The chair is still pushed back. On the paper’s back, the wheel under sand turns one tooth a year.'], choices: [{ text: '~neutral~ (step back)', end: true }] },
      },
    },
  },
};

/** The glyph on the signal board's nine lamps: three dots over an arc. */
export const BOARD_GLYPH = [1, 1, 1, 1, 0, 1, 0, 1, 0];
/** The signal itself, as the board blinks it: nine lamps per beat, a loop of beats. */
export const SIGNAL = [
  [1, 0, 1, 0, 1, 0, 1, 0, 1], [0, 1, 0, 1, 0, 1, 0, 1, 0], [1, 1, 0, 0, 1, 0, 0, 1, 1], [0, 0, 1, 1, 0, 1, 1, 0, 0],
  [1, 0, 0, 1, 1, 0, 0, 0, 1], [0, 1, 1, 0, 0, 0, 1, 1, 0], [1, 1, 1, 0, 0, 0, 1, 0, 1], [0, 0, 0, 1, 1, 1, 0, 1, 0],
];
