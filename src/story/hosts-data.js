// The hosts of the games played in the worlds (issue #248): every game, trial and makers' run placed in a world
// starts from someone (or, where nobody could stand, a thing of that place) who says in a line or two what it is,
// in the place's own story, and offers it: Play or Not now. Nothing starts by itself. Each speaks in their own voice
// (issue #280): the first page in the middle of their own work, the rules in their mouth, no two opening alike.
// src/minigames/kit/hosts.js builds the talk and places them; docs/systems/minigames.md "The hosts" lists them.
//
//   <id>: { name, title, color, kind, palette, head, look?   a person, standing beside the game's sign (spawned;
//           stand?: { side, ahead }                          which side of it: src/minigames/kit/hosts.js hostStand)
//           object: true, name, prompt                       or the sign itself, read: a makers' post, a buoy
//           say: [one or two toned lines], lines: [balloons] }
// The ids are the games' (src/minigames/<id>.js), the trials' (trial-<world>, src/trials/data.js) and the makers'
// runs' (kit-<world>, src/trials/kit-data.js).

/** A person of a place, dressed in its colours. */
const P = (o) => ({ cape: 0, voice: 1, range: 3.4, tier: 'local', ...o, host: true });
/** A makers' post: the runs' own sign, its lines cut under the mark. */
const POST = (say) => ({ object: true, name: 'The makers’ post', prompt: 'read the makers’ post', color: '#c9b08a', say });

export const HOSTS = {
  // ---------------------------------------------------------------- the games' signs (src/minigames/)
  fishing: P({
    id: 'host.fishing', name: 'Yusra', title: 'who fishes the basin', color: '#3f8f8a', kind: 'f',
    palette: { cloak: '#3f8f8a', lining: '#2b211f', cloth: '#e8d9b8', legs: '#4a3a2a', hat: '#d8a24a', hair: '#2b211f' }, head: 'straw', look: { prop: 'basket' },
    say: ['~neutral~ Six this morning, and one had legs. Whatever lives in the giants’ water, it bites my hook.', '~playful~ Take the rod. Three minutes on my pier. When the float goes under, strike. Snap my line and you’re mending it.'],
    lines: ['~neutral~ They bite at dusk. And at noon. And whenever.'],
  }),
  canyon: P({
    id: 'host.canyon', name: 'Kamal', title: 'who races the Two Chasms', color: '#c9703e', kind: 'm',
    palette: { cloak: '#c9703e', lining: '#2b211f', cloth: '#3f4f5a', legs: '#4a3a2a', hat: '#e8c66a', hair: '#3a2a20' }, head: 'bandana', look: { mask: 'browgoggles', body: 'toolbelt' },
    say: ['~playful~ Rebuilt my bike twice this week. The canyon keeps the bits it likes. Three laps, two chasms. Fancy it?', '~neutral~ Hit the kickers flat out, or you’ll meet the chasm floor. The drifts and the banks eat your speed.'],
    lines: ['~playful~ The canyon’s faster than it looks.'],
  }),
  rings: P({
    id: 'host.rings', name: 'Aziza', title: 'who keeps the brass hoops', color: '#d8a24a', kind: 'f',
    palette: { cloak: '#d8a24a', lining: '#2b211f', cloth: '#6b4a36', legs: '#3a3330', hat: '#71d7cf', hair: '#4a3226' }, head: 'wrap', look: { mask: 'glasses' },
    say: ['~curious~ I polish those brass hoops every week, and I still don’t know what the makers hung them for. Do you?', '~neutral~ So we fly them. Twenty, in order, on race-tuned jets. Every hoop you pass tops your tank up a little.'],
    lines: ['~curious~ Twenty hoops. I’ve counted twice.'],
  }),
  wingdrop: P({
    id: 'host.wingdrop', name: 'Zayd', title: 'who painted the mesa', color: '#b8432e', kind: 'm',
    palette: { cloak: '#b8432e', lining: '#2b211f', cloth: '#f2e6c8', legs: '#4a3a2a', hat: '#e8c66a', hair: '#2b211f' }, head: 'headcloth', look: { body: 'scarf' },
    say: ['~playful~ I mixed the paint for the pilgrims’ bird mark up on the mesa. No bird’s landed on it. So we do.', '~neutral~ Three drops. Wings open, find the warm air, ride it up, and come down soft on the middle. Soft. It chips.'],
    lines: ['~playful~ Land soft. The paint chips.'],
  }),
  gallery: P({
    id: 'host.gallery', name: 'Fitz', title: 'who calls the shooting gallery', color: '#c8483a', kind: 'm',
    palette: { cloak: '#c8483a', lining: '#2b211f', cloth: '#f4ece0', legs: '#2b2f45', hat: '#e8c66a', hair: '#2b211f' }, head: 'brim', look: { body: 'neckerchief', build: 'heavy' },
    say: ['~shout~ Roll up, roll up! Fish, ink blots and bells, all painted by my own hand! One minute on the clock!', '~playful~ Splash all you can. A miss breaks your streak, and so does a parasol. Those are my customers.'],
    lines: ['~shout~ Roll up, roll up!', '~playful~ A minute. Any minute you like.'],
  }),
  drums: P({
    id: 'host.drums', name: 'Hamid', title: 'who keeps the camps’ drums', color: '#8a5a3a', kind: 'm',
    palette: { cloak: '#8a5a3a', lining: '#2b211f', cloth: '#e2d3b4', legs: '#4a3a2a', hat: '#c9974a', hair: '#2b211f' }, head: 'wrap', look: { robe: 0.4 },
    say: ['~happy~ I stretched these skins the night the procession set out. Every night since, the old song, round the fire.', '~playful~ Sit with us. When a beat rolls into the ring, strike it. Keep up and the whole camp gets dancing.'],
    lines: ['~happy~ Dum, tek, tek. Dum, tek.'],
  }),
  sketchhunt: P({
    id: 'host.sketchhunt', name: 'Vesna', title: 'who draws the market', color: '#62c3c9', kind: 'f',
    palette: { cloak: '#62c3c9', lining: '#2b211f', cloth: '#f4ece0', legs: '#3a3330', hat: '#ff5fa2', hair: '#2b211f' }, head: 'beret', look: { body: 'satchel' },
    say: ['~curious~ That stall sold tea yesterday. The market changes faster than its signs, so I draw it first.', '~playful~ My list: six things, three minutes. Frame each one nicely, then sketch it. You can borrow my pencil.'],
    lines: ['~curious~ Hold still. No, the other way.'],
  }),
  // the guardians' helping games (issue #339, docs/design/helper-guardians.md): by the Rose House's steps, and at the foot of
  // the Aerie's great steps (Vael speaks in single words)
  cistern: P({
    id: 'host.cistern', name: 'Nuri', title: 'who digs the Givers’ channels', color: '#62c3c9', kind: 'm',
    palette: { cloak: '#62c3c9', lining: '#2b211f', cloth: '#e8d9b8', legs: '#4a3a2a', hat: '#c47b6b', hair: '#2b211f' }, head: 'wrap', look: { prop: 'staff' },
    say: ['~tired~ I dig the sand out of the Givers’ channels every spring. Not one drop has come down them.', '~neutral~ Under the house the stones turn. Turn them ahead of the water, to every trough. The Keeper’s thirsty.'],
    lines: ['~tired~ Dig, sweep, wait. Dig again.'],
  }),
  elderflight: P({
    id: 'host.elderflight', name: 'Corra', title: 'who flew with the riders', color: '#9fd6ee', kind: 'f',
    palette: { cloak: '#9fd6ee', lining: '#2b211f', cloth: '#f4efe2', legs: '#5a5a6a', hat: '#d8a24a', hair: '#d8d0c0' }, head: 'hood',
    say: ['~solemn~ Every morning I wait for her. She won’t fly. Not alone.', '~neutral~ Her wing. Your wing. Through the gates. All the way to the Old Roost.'],
    lines: ['~whisper~ Together.'],
  }),
  // the desert's fight temple (issue #341, src/fight-temples/desert.js): by its doorway west of the camps
  'fight-desert': P({
    id: 'host.fight-desert', name: 'Wafa', title: 'who keeps watch on the sunken hall', color: '#b8613c', kind: 'f', stand: { side: -1, ahead: 1.2 },
    palette: { cloak: '#b8613c', lining: '#2b211f', cloth: '#e8d9b8', legs: '#4a3a2a', hat: '#f0c45a', hair: '#2b211f' }, head: 'wrap', look: { prop: 'staff' },
    say: ['~tired~ Third night I’ve sat on this step. The ink pools down there, and the blots breed in it. Every dusk, more.', '~solemn~ Four rooms, and a lot of them. Small ones: one cut or two. Clear them, and what the makers left on the altar is yours.'],
    lines: ['~tired~ Listen. They’re at it again.'],
  }),
  // the other worlds' fight temples (src/fight-temples/arzach.js, perdide.js, moonfoundry.js), each by its doorway
  'fight-arzach': P({
    id: 'host.fight-arzach', name: 'Sister Maud', title: 'who sweeps the riders’ cloister', color: '#9fb4c8', kind: 'f', stand: { side: -1, ahead: 1.2 },
    palette: { cloak: '#9fb4c8', lining: '#2b211f', cloth: '#f4efe2', legs: '#5a5a6a', hat: '#e6e2d8', hair: '#d8d0c0' }, head: 'hood', look: { prop: 'staff' },
    say: ['~solemn~ My cloister. The wind comes through it, and now it brings them in.', '~neutral~ Four courts. Many, small. Where the floor shows the wind, let it take them. The altar, after.'],
    lines: ['~whisper~ Listen. Wind.'],
  }),
  'fight-perdide': P({
    id: 'host.fight-perdide', name: 'Gert', title: 'who ground the reed-cutters’ meal', color: '#8e5e3a', kind: 'm', stand: { side: -1, ahead: 1.2 },
    palette: { cloak: '#8e5e3a', lining: '#2b211f', cloth: '#d8cfa8', legs: '#3a3a2a', hat: '#7e9a52', hair: '#6b5a4a' }, head: 'straw', look: { body: 'toolbelt' },
    say: ['~tired~ I ground the reed-cutters’ meal in that mill. Now it’s flooded, and the stones roll with nobody at the gear.', '~neutral~ Four rooms, ankle-deep and crawling. Where the floor goes rust, a stone’s coming. The miller’s altar is at the back.'],
    lines: ['~tired~ Hear the grinding? Nobody’s at the gear.'],
  }),
  'fight-moonfoundry': P({
    id: 'host.fight-moonfoundry', name: 'Marta', title: 'who tapped the crucibles', color: '#d98c58', kind: 'f', stand: { side: -1, ahead: 1.2 },
    palette: { cloak: '#d98c58', lining: '#2b211f', cloth: '#3a3330', legs: '#2e2a28', hat: '#e8dcc4', hair: '#4a3226' }, head: 'skullcap', look: { body: 'toolbelt' },
    say: ['~neutral~ The house still pours under our floor. Nobody taps it now, and things come down to stand in the heat.', '~solemn~ Four bays. When a channel’s rim goes bright, step off it. The great crucible’s altar is at the end.'],
    lines: ['~neutral~ Mind the channels. They don’t care who’s in them.'],
  }),
  'fight-edena': P({
    id: 'host.fight-edena', name: 'Hollis', title: 'who keeps the seed cellars', color: '#7fa86a', kind: 'm', stand: { side: -1, ahead: 1.2 },
    palette: { cloak: '#7fa86a', lining: '#2b211f', cloth: '#f2e6c8', legs: '#4a5a3a', hat: '#eef0e6', hair: '#4a3226' }, head: 'sunhat', look: { prop: 'flower' },
    say: ['~curious~ I kept the seed cellars dry for twenty years. Now the eyes in the beds wake on their own.', '~neutral~ Four rooms. When a bed’s eyes open, get off it, and bring the moths onto it. The seed safe’s altar is at the end.'],
    lines: ['~curious~ They blink at me now. They never did.'],
  }),
  'fight-incal': P({
    id: 'host.fight-incal', name: 'Ulric', title: 'who drove the depot’s cranes', color: '#e8b83a', kind: 'm', stand: { side: -1, ahead: 1.2 },
    palette: { cloak: '#e8b83a', lining: '#2b211f', cloth: '#3a4a5a', legs: '#2b2f45', hat: '#5a5f6a', hair: '#2b211f' }, head: 'cap', look: { body: 'toolbelt' },
    say: ['~tired~ I drove those cranes till the depot shut. They still drop loads, and nobody’s at the levers.', '~neutral~ Four bays. A ring on the deck means a load is coming down: step out of it. The dispatch floor’s altar is at the end.'],
    lines: ['~tired~ Hear the chains? Nobody’s up there.'],
  }),
  'fight-buried': P({
    id: 'host.fight-buried', name: 'Greta', title: 'who greased the gear-house rails', color: '#c9a24a', kind: 'f', stand: { side: -1, ahead: 1.2 },
    palette: { cloak: '#c9a24a', lining: '#2b211f', cloth: '#6e4e34', legs: '#3a2e24', hat: '#ffb347', hair: '#3a2a20' }, head: 'bandana', look: { mask: 'browgoggles' },
    say: ['~playful~ I greased those rails every morning, and the carts still run them. Empty, flat out, all day.', '~neutral~ Four rooms. When a rail’s lamp blinks, get off it and leave the crawlers on it. The tooth hall’s altar is at the end.'],
    lines: ['~playful~ Lamp’s blinking. Off the rail!'],
  }),
  'fight-bazaar': P({
    id: 'host.fight-bazaar', name: 'Lettie', title: 'who locks up the back rooms', color: '#ff5fa2', kind: 'f', stand: { side: -1, ahead: 1.2 },
    palette: { cloak: '#ff5fa2', lining: '#2b211f', cloth: '#3a3050', legs: '#2b2f45', hat: '#62c3c9', hair: '#2b211f' }, head: 'bun', look: { body: 'satchel' },
    say: ['~scared~ I lock the back rooms every night. Tonight the signs in there are ringing with the bell, and the rooms are full.', '~neutral~ Four rooms. When a sign lights, the ring comes off it: roll through it. The counting house’s altar is at the end.'],
    lines: ['~scared~ There. The bell again.'],
  }),
  'fight-underwater': P({
    id: 'host.fight-underwater', name: 'Sabine', title: 'who trims the gallery lamps', color: '#7fe0e8', kind: 'f', stand: { side: -1, ahead: 1.2 },
    palette: { cloak: '#3f7a8a', lining: '#2b211f', cloth: '#d8e4e6', legs: '#2b2f45', hat: '#7fe0e8', hair: '#2b211f' }, head: 'hood', look: { prop: 'bell' },
    say: ['~solemn~ I trimmed the gallery lamps every night. Now they gutter, and the dark comes in under the glass.', '~neutral~ Four halls. When the lamps flicker, get under one before they go out. The whale-watch altar is at the end.'],
    lines: ['~solemn~ Keep to the lamps. The dark is cold.'],
  }),
  'fight-glassdunes': P({
    id: 'host.fight-glassdunes', name: 'Ozren', title: 'who banked the kilns', color: '#d6a94a', kind: 'm', stand: { side: -1, ahead: 1.2 },
    palette: { cloak: '#d6a94a', lining: '#2b211f', cloth: '#3f8f6a', legs: '#4a3a2a', hat: '#cfe9e0', hair: '#3a2a20' }, head: 'headcloth', look: { mask: 'glasses' },
    say: ['~tired~ I banked those kilns for thirty years. The sheds are full now, and the glass floor cracks under them.', '~neutral~ Four sheds. When the tile under you goes white, get off it. The great kiln’s altar is at the end.'],
    lines: ['~tired~ Listen. Glass going.'],
  }),
  'fight-spheres': P({
    id: 'host.fight-spheres', name: 'Wenna', title: 'who tends the walled gardens', color: '#a8b878', kind: 'f', stand: { side: -1, ahead: 1.2 },
    palette: { cloak: '#a8b878', lining: '#2b211f', cloth: '#ece6d8', legs: '#4a4a3a', hat: '#f4c86a', hair: '#6b5a4a' }, head: 'sunhat', look: { prop: 'flower' },
    say: ['~whisper~ My gardens are full of hounds. They run in the spheres’ shade at dusk.', '~neutral~ Four gardens. Keep to the light: in the shade they bite and you can’t see them. The round garden’s altar is at the end.'],
    lines: ['~whisper~ Stay out of the shade.'],
  }),
  'fight-spacecity': P({
    id: 'host.fight-spacecity', name: 'Osric', title: 'who weighed the oil', color: '#f0c06a', kind: 'm', stand: { side: -1, ahead: 1.2 },
    palette: { cloak: '#8a5a3a', lining: '#2b211f', cloth: '#f0c06a', legs: '#2b2f45', hat: '#3a3a50', hair: '#2b211f' }, head: 'cap', look: { body: 'satchel' },
    say: ['~neutral~ I weighed the lamp oil at that depot till the drums started leaking. One spark and the deck burns.', '~neutral~ Four decks. When oil spreads under you, get off it before it lights. The clearing house altar is at the end.'],
    lines: ['~neutral~ Mind your feet. And the sparks.'],
  }),
  ski: P({
    id: 'host.ski', name: 'Tarek', title: 'who made the sand-skis', color: '#e8a24a', kind: 'm',
    palette: { cloak: '#e8a24a', lining: '#2b211f', cloth: '#3f6f6a', legs: '#4a3a2a', hat: '#f2e6c8', hair: '#3a2a20' }, head: 'headcloth', look: { body: 'scarf' },
    say: ['~playful~ The children slide down the Long Dune on boards. Boards! So I made skis. Nobody’s thanked me yet.', '~neutral~ Between every pair of poles. Tuck to go faster, and land your spins.'],
    lines: ['~playful~ Downhill is the easy part.'],
  }),
  platformer: P({
    id: 'host.platformer', name: 'Sister Clem', title: 'who counts the fallen-up stones', color: '#f4efe2', kind: 'f',
    palette: { cloak: '#f4efe2', lining: '#2b211f', cloth: '#c9b08a', legs: '#6b5a4a', hat: '#f6c84e', hair: '#6b5a4a' }, head: 'hood', look: { prop: 'bell' },
    say: ['~solemn~ I count them each morning: the small stones that fell up with the cloud. They make a path to the makers’ gate.', '~neutral~ Step from stone to stone to the gate. A fall costs a life. Those I don’t count.'],
    lines: ['~solemn~ One hundred and four stones. One fewer each spring.'],
  }),

  // ---------------------------------------------------------------- the trials (src/trials/data.js)
  'trial-desert': P({
    id: 'host.trial-desert', name: 'Bilal', title: 'who rides the dune line', color: '#f0a54a', kind: 'm',
    palette: { cloak: '#f0a54a', lining: '#2b211f', cloth: '#5a3640', legs: '#4a3a2a', hat: '#e8d9b8', hair: '#2b211f' }, head: 'wrap', look: { mask: 'browgoggles' },
    say: ['~playful~ Sand in your teeth yet? You will. We ride the dunes down into the basin and up out. Most of us come back.', '~neutral~ Every gate in order, down and back up. Stay on the bike: the clock won’t stop to pick you up.'],
    lines: ['~playful~ Sand in the teeth means you’re fast.'],
  }),
  'trial-arzach': P({
    id: 'host.trial-arzach', name: 'Elva', title: 'who watches the wind ladder', color: '#9fd6ee', kind: 'f',
    palette: { cloak: '#9fd6ee', lining: '#2b211f', cloth: '#e6e2d8', legs: '#5a5a6a', hat: '#e6e2d8', hair: '#d8d0c0' }, head: 'hood',
    say: ['~whisper~ Hear it? Wind, climbing in two columns. I watch them. The riders went up them once, with their birds.', '~whisper~ Wings open in the first. Up. Then the rings, in order. The second lifts you again.'],
    lines: ['~whisper~ …'],
  }),
  'trial-arzach2': P({
    id: 'host.trial-arzach2', name: 'Brother Amos', title: 'who keeps the riders’ round', color: '#c9b08a', kind: 'm',
    palette: { cloak: '#c9b08a', lining: '#2b211f', cloth: '#f4efe2', legs: '#6b5a4a', hat: '#c9b08a', hair: '#6b5a4a' }, head: 'bald', look: { prop: 'staff' },
    say: ['~solemn~ I sweep the riders’ gates each morning. Nobody has flown their round since they crossed the cloud.', '~neutral~ Take the bird round the Needles, the Table and the Monastery, every gate in order. It knows the way.'],
    lines: ['~solemn~ The bird knows the way round.'],
  }),
  'trial-perdide': P({
    id: 'host.trial-perdide', name: 'Wil', stand: { side: 0.4, ahead: 5 }, title: 'who races the reed-cutters', color: '#7fd0b8', kind: 'm',
    palette: { cloak: '#7fd0b8', lining: '#2b211f', cloth: '#5a6a3a', legs: '#3a3a2a', hat: '#c9b08a', hair: '#3a2a20' }, head: 'straw',
    say: ['~playful~ Crystal’s quiet, the reeds are cut, and my skiff’s faster than my mother’s. Race you round the makers’ buoys?', '~neutral~ Every gate in order, round the lake and back. A gust of your fan in the sail and she flies.'],
    lines: ['~playful~ Round the buoys and back. I’ll beat you.'],
  }),
  'trial-perdide2': {
    object: true, name: 'The race buoy', prompt: 'read the race buoy', color: '#9fe8d8',
    say: ['~neutral~ (A keepers’ bell hangs in the buoy, the lamp-mark cut under it: two laps of the lagoon, rung off from here.)', '~solemn~ (A tally is scratched below. The newest time is forty years old.)'],
  },
  'trial-edena': P({
    id: 'host.trial-edena', name: 'Linden', title: 'who waters the sleeping eyes', color: '#c8e88a', kind: 'f',
    palette: { cloak: '#c8e88a', lining: '#2b211f', cloth: '#f2e6c8', legs: '#4a5a3a', hat: '#e8c2f0', hair: '#4a3226' }, head: 'sunhat', look: { prop: 'flower' },
    say: ['~curious~ I water the beds, and the eyes in them open where the water lands. Only for a moment. The white builders left them.', '~neutral~ Wake all eight, any order, as quick as you can. A few sleep high up: climb for those.'],
    lines: ['~neutral~ Eight eyes in the beds. Wake them all.'],
  }),
  'trial-incal': P({
    id: 'host.trial-incal', name: 'Dagny', stand: { side: -1 }, title: 'a courier who won’t pay for cabs', color: '#ffd36a', kind: 'f',
    palette: { cloak: '#ffd36a', lining: '#2b211f', cloth: '#3a4a5a', legs: '#2b2f45', hat: '#62c3c9', hair: '#2b211f' }, head: 'cap', look: { body: 'satchel' },
    say: ['~playful~ A cab up to the rim? Robbery. I take the air pillar from the middle terrace. Free, and faster.', '~neutral~ Wings open, into the pillar, up through every ring. Steer out of its top and glide the rim for the last.'],
    lines: ['~playful~ Cabs are for people with time.'],
  }),
  'trial-glassdunes': P({
    id: 'host.trial-glassdunes', name: 'Opal', title: 'a glassworker who flies the waves', color: '#d6a94a', kind: 'f',
    palette: { cloak: '#d6a94a', lining: '#2b211f', cloth: '#3f8f6a', legs: '#4a3a2a', hat: '#cfe9e0', hair: '#3a2a20' }, head: 'headcloth', look: { mask: 'glasses' },
    say: ['~playful~ Kiln’s banked, so I’m flying. The slalom runs between the glass waves. They’ve never fallen on anyone.', '~neutral~ Ride the first column up, then the rings in order. Sinking? Find the next column. Then home down the valley.'],
    lines: ['~playful~ The glass hums when you fly close.'],
  }),
  'trial-buried': P({
    id: 'host.trial-buried', name: 'Tibor', title: 'who dives the canyon on Tooth Day', color: '#c98d4f', kind: 'm',
    palette: { cloak: '#c98d4f', lining: '#2b211f', cloth: '#3a3330', legs: '#2e2a28', hat: '#b8603a', hair: '#2b211f' }, head: 'flatcap', look: { body: 'muffler' },
    say: ['~neutral~ Tooth Day. Wings on, and down the canyon for luck. My father did it every year. Once with a goat.', '~neutral~ Through every gate to the bottom, then ride the column up and out. Don’t stop to look at the pipes.'],
    lines: ['~neutral~ One dive a day, down the canyon, for luck.'],
  }),
  'trial-spheres': P({
    id: 'host.trial-spheres', name: 'Aurel', title: 'who walks the round of the spheres', color: '#e8c2f0', kind: 'm',
    palette: { cloak: '#e8c2f0', lining: '#2b211f', cloth: '#f4efe2', legs: '#5a5a6a', hat: '#a8e6ee', hair: '#d8d0c0' }, head: 'hair',
    say: ['~solemn~ Hush. This one remembers rain. I walk the round each day, so someone remembers with them.', '~neutral~ Gate to gate, round the garden and back. Climb, jump, glide. The spheres don’t hurry, but the clock does.'],
    lines: ['~solemn~ That one remembers rain.'],
  }),
  'trial-underwater': P({
    id: 'host.trial-underwater', name: 'Gil', title: 'who races the sealed tubes', color: '#6fc8d8', kind: 'm',
    palette: { cloak: '#6fc8d8', lining: '#2b211f', cloth: '#e8d9b8', legs: '#2b2f45', hat: '#f0c06a', hair: '#2b211f' }, head: 'beanie',
    say: ['~playful~ Lamps trimmed, so we race the tubes. We wait till the whales are quiet. Lately that’s every night.', '~neutral~ Every ring, hall to hall through the glass. Take the bends tight, and don’t miss one.'],
    lines: ['~sad~ The whales used to watch us race.'],
  }),
  'trial-moonfoundry': P({
    id: 'host.trial-moonfoundry', name: 'Rudi', title: 'who ran the pour times', color: '#e89a5a', kind: 'm',
    palette: { cloak: '#e89a5a', lining: '#2b211f', cloth: '#3a3330', legs: '#2e2a28', hat: '#d98c58', hair: '#6b5a4a' }, head: 'skullcap', look: { body: 'toolbelt' },
    say: ['~tired~ Forty years I ran the pour times round this floor. The house pours by itself now. My legs still go round.', '~neutral~ Every gate in order, round the floor and back to the mouth, before the pour cools. I always made it.'],
    lines: ['~tired~ Forty years of pours. My knees feel every one.'],
  }),
  'trial-spacecity': P({
    id: 'host.trial-spacecity', name: 'Pia', title: 'who runs the oil bills', color: '#f0c06a', kind: 'f',
    palette: { cloak: '#f0c06a', lining: '#2b211f', cloth: '#5a3640', legs: '#3a3330', hat: '#e8d9b8', hair: '#2b211f' }, head: 'bun', look: { body: 'satchel' },
    say: ['~playful~ Oil bills, island to island, every evening. Late oil, dark lamps, cross customers. So I run.', '~neutral~ Every ring in order over the bridges. Mind your feet: step off, and the dark is a long way down.'],
    lines: ['~playful~ Late oil, cross customers. So I run.'],
  }),
  'trial-bazaar': P({
    id: 'host.trial-bazaar', name: 'Quill', title: 'who hangs the signs', color: '#ff5fa2', kind: 'm',
    palette: { cloak: '#ff5fa2', lining: '#2b211f', cloth: '#2b2f45', legs: '#3a3330', hat: '#62c3c9', hair: '#2b211f' }, head: 'peak', look: { body: 'toolbelt' },
    say: ['~shout~ Hung thirty signs today and every one’s crooked! Market night: we fly the avenue under the lot!', '~neutral~ Ride the column at the avenue’s head, then the rings in order. Halfway there’s another column. Use it.'],
    lines: ['~shout~ Mind the signs!'],
  }),

  // ---------------------------------------------------------------- the makers' runs (src/trials/kit-data.js)
  'kit-desert': POST(['~solemn~ (Under the makers’ mark: here the wind was kept, and let go a breath at a time.)', '~neutral~ (Walk the hall behind its screens, then wake the three eyes over the porch.)']),
  'kit-perdide': POST(['~solemn~ (Under the makers’ mark: the Hush swings over the causeway, as it swings in their house.)', '~neutral~ (Walk out to the round stone and back. A swinging crystal knocks you into the lake.)']),
  'kit-arzach': POST(['~solemn~ (Under the makers’ mark: the Aerie’s winds, stood out on the plain.)', '~neutral~ (Ride the column up, cross the gusts behind the screens, glide the gulf.)']),
  'kit-buried': POST(['~solemn~ (Under the makers’ mark: iron pillars over the furnace, as under the wheel.)', '~neutral~ (Jump pillar to pillar to the landing, then wake the door’s four eyes together.)']),
  'kit-spheres': POST(['~solemn~ (Under the makers’ mark: the Footprint’s spheres, stood out on the meadow.)', '~neutral~ (Weave past the stone spheres, then push the two white ones home onto their plates.)']),
  'kit-incal': POST(['~solemn~ (Under the makers’ mark: a balcony over the shaft, three stones over the drop.)', '~neutral~ (Roll the stone ball along it onto its plate at the far end. Don’t fall.)']),
  'kit-bazaar': POST(['~solemn~ (Under the makers’ mark: the Undertower’s singing stones, and the horns that listen.)', '~neutral~ (Past the walls of dishes, then carry each stone’s note to its horn.)']),
  'kit-edena': POST(['~solemn~ (Under the makers’ mark: the Greenhouse’s gulf, four decks over the meadow.)', '~neutral~ (Bloom each seed to grow a bridge, and bloom the flower-door open.)']),
  'kit-edena-glass': POST(['~solemn~ (Under the makers’ mark: their glass, too smooth to climb, until a vine grows up it.)', '~neutral~ (Bloom the seed at each pane’s foot, climb the vine, and on to the arch.)']),
  'kit-arzach2': POST(['~solemn~ (Under the makers’ mark: the Belfry’s bridges, fallen up over the cloud.)', '~neutral~ (Sound the bell-note by each bell to bring its stones down, then the door.)']),
  'kit-perdide2': POST(['~solemn~ (Under the makers’ mark: the Lamp-House’s dark gallery, out over the water.)', '~neutral~ (Stand by each keeper’s lamp with the lantern until its stones rise.)']),
  'kit-perdide2-orb': POST(['~solemn~ (Under the makers’ mark: the pool-orbs, rolled to the keepers’ lamps.)', '~neutral~ (Light each orb with the lantern and push it down its groove before it fades.)']),
  'kit-glassdunes': POST(['~solemn~ (Under the makers’ mark: the Clock-House’s riding discs, stood out on the sand.)', '~neutral~ (Ride the discs across the gaps, then wake the wall’s three eyes in time.)']),
  'kit-underwater': POST(['~solemn~ (Under the makers’ mark: the Whale-House’s horns, waiting for the deep note.)', '~neutral~ (Past the listening screens, then play the whale-horn’s note to each horn.)']),
  'kit-moonfoundry': POST(['~solemn~ (Under the makers’ mark: the Casting-House’s test moons and their cradles.)', '~neutral~ (Weave round the hoist frames, then push both moons home into their cradles.)']),
  'kit-spacecity': POST(['~solemn~ (Under the makers’ mark: the void’s breath, stood out from the Towers’ edge.)', '~neutral~ (Ride the breath up to the post, glide the gulf, and wake the capstan’s eyes.)']),
};
