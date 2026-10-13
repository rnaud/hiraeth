// The hosts of the games played in the worlds (issue #248): every game, trial and makers' run placed in a world
// starts from someone (or, where nobody could stand, a thing of that place) who says in a line or two what it is,
// in the place's own story, and offers it: Play or Not now. Nothing starts by itself.
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
    say: ['~neutral~ The giants left their water in the Still Oasis, and strange fish came to live in it.', '~playful~ Three minutes on my pier. Strike when the float goes under, and don’t snap the line.'],
    lines: ['~neutral~ They bite at dusk. And at noon. And whenever.'],
  }),
  canyon: P({
    id: 'host.canyon', name: 'Darro', title: 'who races the Rose Canyon', color: '#c9703e', kind: 'm',
    palette: { cloak: '#c9703e', lining: '#2b211f', cloth: '#3f4f5a', legs: '#4a3a2a', hat: '#e8c66a', hair: '#3a2a20' }, head: 'bandana', look: { mask: 'browgoggles', body: 'toolbelt' },
    say: ['~playful~ Qanat’s salvagers race old hoverbikes round the Rose Canyon. Three laps, two chasms.', '~neutral~ Hit the kickers fast. The drifts and the banks will slow you.'],
    lines: ['~playful~ The canyon’s faster than it looks.'],
  }),
  rings: P({
    id: 'host.rings', name: 'Ilka', title: 'who keeps the brass hoops', color: '#d8a24a', kind: 'f',
    palette: { cloak: '#d8a24a', lining: '#2b211f', cloth: '#6b4a36', legs: '#3a3330', hat: '#71d7cf', hair: '#4a3226' }, head: 'wrap', look: { mask: 'glasses' },
    say: ['~curious~ The makers hung brass hoops among the needles. Nobody knows what for, so we fly through them.', '~neutral~ Twenty rings in order on race-tuned jets. Each ring fills the tank a little.'],
    lines: ['~curious~ Twenty hoops. I’ve counted twice.'],
  }),
  wingdrop: P({
    id: 'host.wingdrop', name: 'Zayd', title: 'who painted the mesa', color: '#b8432e', kind: 'm',
    palette: { cloak: '#b8432e', lining: '#2b211f', cloth: '#f2e6c8', legs: '#4a3a2a', hat: '#e8c66a', hair: '#2b211f' }, head: 'headcloth', look: { body: 'scarf' },
    say: ['~playful~ The pilgrims painted a mark on the mesa’s top for the birds. We land on it instead.', '~neutral~ Three drops. Open your wings, ride the warm air up, and touch down on the middle softly.'],
    lines: ['~playful~ Land soft. The paint chips.'],
  }),
  gallery: P({
    id: 'host.gallery', name: 'Fitz', title: 'who calls the shooting gallery', color: '#c8483a', kind: 'm',
    palette: { cloak: '#c8483a', lining: '#2b211f', cloth: '#f4ece0', legs: '#2b2f45', hat: '#e8c66a', hair: '#2b211f' }, head: 'brim', look: { body: 'neckerchief', build: 'heavy' },
    say: ['~shout~ Roll up! Painted fish, ink blots and bells, and a minute on the clock!', '~playful~ Splash every target you can. A miss breaks your streak, and so does splashing a parasol.'],
    lines: ['~shout~ Roll up, roll up!', '~playful~ A minute. Any minute you like.'],
  }),
  drums: P({
    id: 'host.drums', name: 'Hamid', title: 'who keeps the camps’ drums', color: '#8a5a3a', kind: 'm',
    palette: { cloak: '#8a5a3a', lining: '#2b211f', cloth: '#e2d3b4', legs: '#4a3a2a', hat: '#c9974a', hair: '#2b211f' }, head: 'wrap', look: { robe: 0.4 },
    say: ['~happy~ Every night of the procession, the camps drum the old song round the fire.', '~playful~ Sit with us. Strike each beat as it rolls into the ring, and we dance.'],
    lines: ['~happy~ Dum, tek, tek. Dum, tek.'],
  }),
  sketchhunt: P({
    id: 'host.sketchhunt', name: 'Vesna', title: 'who draws the market', color: '#62c3c9', kind: 'f',
    palette: { cloak: '#62c3c9', lining: '#2b211f', cloth: '#f4ece0', legs: '#3a3330', hat: '#ff5fa2', hair: '#2b211f' }, head: 'beret', look: { body: 'satchel' },
    say: ['~curious~ The market changes faster than its signs. I draw it before it does.', '~playful~ Six things on a list, three minutes. Frame each one well, then sketch it.'],
    lines: ['~curious~ Hold still. No, the other way.'],
  }),
  ski: P({
    id: 'host.ski', name: 'Tarek', title: 'who made the sand-skis', color: '#e8a24a', kind: 'm',
    palette: { cloak: '#e8a24a', lining: '#2b211f', cloth: '#3f6f6a', legs: '#4a3a2a', hat: '#f2e6c8', hair: '#3a2a20' }, head: 'headcloth', look: { body: 'scarf' },
    say: ['~playful~ Qanat’s children slide down the Long Dune on boards. I made skis.', '~neutral~ Pass between every pair of poles. Tuck for speed, and land your spins.'],
    lines: ['~playful~ Downhill is the easy part.'],
  }),
  platformer: P({
    id: 'host.platformer', name: 'Sister Clem', title: 'who counts the fallen-up stones', color: '#f4efe2', kind: 'f',
    palette: { cloak: '#f4efe2', lining: '#2b211f', cloth: '#c9b08a', legs: '#6b5a4a', hat: '#f6c84e', hair: '#6b5a4a' }, head: 'hood', look: { prop: 'bell' },
    say: ['~solemn~ When the cloud rose, small stones fell up with everything else. They make a path to the makers’ gate.', '~neutral~ Jump from stone to stone to the gate. A fall costs a life.'],
    lines: ['~solemn~ One hundred and four stones. One fewer each spring.'],
  }),

  // ---------------------------------------------------------------- the trials (src/trials/data.js)
  'trial-desert': P({
    id: 'host.trial-desert', name: 'Nadir', title: 'who rides the dune line', color: '#f0a54a', kind: 'm',
    palette: { cloak: '#f0a54a', lining: '#2b211f', cloth: '#5a3640', legs: '#4a3a2a', hat: '#e8d9b8', hair: '#2b211f' }, head: 'wrap', look: { mask: 'browgoggles' },
    say: ['~playful~ The salvagers ride the dunes down into the basin, gate to gate. Most come back.', '~neutral~ On your hoverbike, through every gate to the bottom, against the clock.'],
    lines: ['~playful~ Sand in the teeth means you’re fast.'],
  }),
  'trial-arzach': P({
    id: 'host.trial-arzach', name: 'Ysolt', title: 'who watches the wind ladder', color: '#9fd6ee', kind: 'f',
    palette: { cloak: '#9fd6ee', lining: '#2b211f', cloth: '#e6e2d8', legs: '#5a5a6a', hat: '#e6e2d8', hair: '#d8d0c0' }, head: 'hood',
    say: ['~whisper~ The wind climbs here in two columns. The riders climbed them once, with their birds.', '~whisper~ Open your wings. Up the columns, through the rings.'],
    lines: ['~whisper~ …'],
  }),
  'trial-arzach2': P({
    id: 'host.trial-arzach2', name: 'Brother Felix', title: 'who keeps the riders’ round', color: '#c9b08a', kind: 'm',
    palette: { cloak: '#c9b08a', lining: '#2b211f', cloth: '#f4efe2', legs: '#6b5a4a', hat: '#c9b08a', hair: '#6b5a4a' }, head: 'bald', look: { prop: 'staff' },
    say: ['~solemn~ The riders flew a round of the stones before they crossed the cloud. Nobody has since.', '~neutral~ Ride the bird round the Needles, the Table and the Monastery, through every gate.'],
    lines: ['~solemn~ The bird remembers the way.'],
  }),
  'trial-perdide': P({
    id: 'host.trial-perdide', name: 'Wil', stand: { side: 0.4, ahead: 5 }, title: 'who races the reed-cutters', color: '#7fd0b8', kind: 'm',
    palette: { cloak: '#7fd0b8', lining: '#2b211f', cloth: '#5a6a3a', legs: '#3a3a2a', hat: '#c9b08a', hair: '#3a2a20' }, head: 'straw',
    say: ['~playful~ The reed-cutters race their skiffs round the makers’ buoys when the crystal is quiet.', '~neutral~ Steer through every gate, round the lake and back. A gust in the sail goes faster.'],
    lines: ['~playful~ Mind the plants. They mind you.'],
  }),
  'trial-perdide2': {
    object: true, name: 'The race buoy', prompt: 'read the race buoy', color: '#9fe8d8',
    say: ['~neutral~ (A keepers’ bell hangs in the buoy, the lamp-mark cut under it: two laps of the lagoon, rung off from here.)', '~solemn~ (A tally is scratched below. The newest time is forty years old.)'],
  },
  'trial-edena': P({
    id: 'host.trial-edena', name: 'Linden', title: 'who waters the sleeping eyes', color: '#c8e88a', kind: 'f',
    palette: { cloak: '#c8e88a', lining: '#2b211f', cloth: '#f2e6c8', legs: '#4a5a3a', hat: '#e8c2f0', hair: '#4a3226' }, head: 'sunhat', look: { prop: 'flower' },
    say: ['~curious~ The white builders left eyes asleep in the garden. A splash wakes them, for a moment.', '~neutral~ Wake all eight, as quick as you can.'],
    lines: ['~neutral~ We tend the garden. Mostly it tends itself.'],
  }),
  'trial-incal': P({
    id: 'host.trial-incal', name: 'Ostra', stand: { side: -1 }, title: 'a courier who won’t pay for cabs', color: '#ffd36a', kind: 'f',
    palette: { cloak: '#ffd36a', lining: '#2b211f', cloth: '#3a4a5a', legs: '#2b2f45', hat: '#62c3c9', hair: '#2b211f' }, head: 'cap', look: { body: 'satchel' },
    say: ['~playful~ Couriers who won’t pay for a cab ride the air pillar up from the middle terrace.', '~neutral~ Wings open: up the pillar and through the gates to the rim.'],
    lines: ['~playful~ Cabs are for people with time.'],
  }),
  'trial-glassdunes': P({
    id: 'host.trial-glassdunes', name: 'Opal', title: 'a glassworker who flies the waves', color: '#d6a94a', kind: 'f',
    palette: { cloak: '#d6a94a', lining: '#2b211f', cloth: '#3f8f6a', legs: '#4a3a2a', hat: '#cfe9e0', hair: '#3a2a20' }, head: 'headcloth', look: { mask: 'glasses' },
    say: ['~playful~ On festival days we fly the slalom between the glass waves. They’ve never fallen on anyone.', '~neutral~ Glide the gates, and climb the warm columns when you sink.'],
    lines: ['~playful~ The glass hums when you fly close.'],
  }),
  'trial-buried': P({
    id: 'host.trial-buried', name: 'Tibor', title: 'who dives the canyon on Tooth Day', color: '#c98d4f', kind: 'm',
    palette: { cloak: '#c98d4f', lining: '#2b211f', cloth: '#3a3330', legs: '#2e2a28', hat: '#b8603a', hair: '#2b211f' }, head: 'flatcap', look: { body: 'muffler' },
    say: ['~neutral~ On Tooth Day the dome folk dive the canyon on wings, for luck.', '~neutral~ Down through the gates, then up the column at its end to climb out.'],
    lines: ['~neutral~ One tooth a year. One dive a day.'],
  }),
  'trial-spheres': P({
    id: 'host.trial-spheres', name: 'Aurel', title: 'who walks the round of the spheres', color: '#e8c2f0', kind: 'm',
    palette: { cloak: '#e8c2f0', lining: '#2b211f', cloth: '#f4efe2', legs: '#5a5a6a', hat: '#a8e6ee', hair: '#d8d0c0' }, head: 'hair',
    say: ['~solemn~ Each sphere remembers a sound. We walk a round of them, to remember with them.', '~neutral~ On foot, gate to gate round the garden, against the clock.'],
    lines: ['~solemn~ That one remembers rain.'],
  }),
  'trial-underwater': P({
    id: 'host.trial-underwater', name: 'Gil', title: 'who races the sealed tubes', color: '#6fc8d8', kind: 'm',
    palette: { cloak: '#6fc8d8', lining: '#2b211f', cloth: '#e8d9b8', legs: '#2b2f45', hat: '#f0c06a', hair: '#2b211f' }, head: 'beanie',
    say: ['~playful~ The lamp boys race the tubes when the whales are quiet. Lately that’s every night.', '~neutral~ Run the tubes gate to gate, and mind the turns.'],
    lines: ['~sad~ The whales used to watch us race.'],
  }),
  'trial-moonfoundry': P({
    id: 'host.trial-moonfoundry', name: 'Ansgar', title: 'who ran the pour times', color: '#e89a5a', kind: 'm',
    palette: { cloak: '#e89a5a', lining: '#2b211f', cloth: '#3a3330', legs: '#2e2a28', hat: '#d98c58', hair: '#6b5a4a' }, head: 'skullcap', look: { body: 'toolbelt' },
    say: ['~tired~ The founders’ runners carried the pour times round the floor. Nobody needs them now.', '~neutral~ Round the floor, gate to gate, before the pour cools.'],
    lines: ['~tired~ My knees remember every pour.'],
  }),
  'trial-spacecity': P({
    id: 'host.trial-spacecity', name: 'Pia', title: 'who runs the oil bills', color: '#f0c06a', kind: 'f',
    palette: { cloak: '#f0c06a', lining: '#2b211f', cloth: '#5a3640', legs: '#3a3330', hat: '#e8d9b8', hair: '#2b211f' }, head: 'bun', look: { body: 'satchel' },
    say: ['~playful~ Couriers run the bills across the bridges before the islands drift another hand’s width.', '~neutral~ Every gate in order. Don’t step off into the dark.'],
    lines: ['~playful~ Lamp oil waits for nobody.'],
  }),
  'trial-bazaar': P({
    id: 'host.trial-bazaar', name: 'Quill', title: 'who hangs the signs', color: '#ff5fa2', kind: 'm',
    palette: { cloak: '#ff5fa2', lining: '#2b211f', cloth: '#2b2f45', legs: '#3a3330', hat: '#62c3c9', hair: '#2b211f' }, head: 'peak', look: { body: 'toolbelt' },
    say: ['~shout~ The sign-hangers fly the avenue every market night! Under the signs, through the gates!', '~neutral~ Wings open. Climb the warm columns when you sink.'],
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
