// The Sealed Hangar's finds, as they stood in its world until October 2026 (the world was dismissed:
// src/levels/names.js DISMISSED, docs/systems/worlds.md "Merged and dismissed worlds"). The live tables moved
// on: its temple (the First Garage, now the Clock-House), its boxes, its court, its jets trial and its makers'
// run went to the Glass Dunes (src/boxes/placements.js glassdunes, src/finds/courts.js, src/trials/). Kept
// here whole, so the Hangar can be built with them again (its level reads HANGAR_COURTS) and so nothing of it
// is lost.

/** Its boxes (src/boxes/placements.js format). */
export const HANGAR_PLACEMENTS = [
    // on the keep's south curtain wall, facing the spawn (a 14 m climb)
    // It held the quick coil until the First Garage was built (src/temples/garage.js): the coil is its key now, and
    // the wall keeps the brass level, a gift in the open (a new box: saves that opened the coil's find it there)
    { id: 'garage.level', item: 'level', at: [8, 14, 24], toward: [0, 120],
      hint: 'A makers’ box stands on top of the keep’s south curtain wall. Climb the wall',
      note: 'The top of the keep’s south curtain wall.' },
    // the First Garage (src/temples/garage.js): in its round chamber over the winding well. The coil is the key to the
    // rest: the banks of six eyes that wake only together (two tanks in one breath), the Foreman's six numerals
    { id: 'garage.temple.coil', item: 'coil', temple: 'garage', site: (level) => level.temple?.gadgetSite,
      note: 'Inside the First Garage on the plateau’s rim west of the keep, in the round chamber over the winding well.' },
    // the makers' court (src/finds/courts.js): the gadget, with what it is for round it
    { id: 'garage.magnet', item: 'magnet', site: (level) => level.finds?.court?.box ?? null, beacon: 160, gadget: true,
      hint: 'A makers’ court stands on the plain west of the landing, an iron block on a pillar. A box waits at its edge',
      note: 'In the makers’ court on the plain west of the landing: a plate only metal presses, an iron block across a gap. The Hangar’s brass pumps pull you up too.' },
];

/** Its makers' court (src/finds/courts.js format). */
export const HANGAR_COURTS = { garage: { gadget: 'magnet', at: [-86, 120], y: 0 } };

/** Its trial (src/trials/data.js format). */
export const HANGAR_TRIAL = {
    id: 'trial-garage', world: 'garage', mode: 'jets', name: 'Pillar slalom', color: '#d6a94a',
    blurb: 'A slalom of the plain’s pillars on the jets, low and fast.',
    rules: 'Fly through every ring in order, round the pillars and back over the plain.',
    marker: [18, 108], start: [24, null, 100], heading: 3.1, speed: 12,
    gates: [[-30, 14, 60, 8], [-60, 20, 0, 8], [-30, 30, -60, 8], [60, 32, -100, 8], [140, 30, -80, 8], [150, 16, 10, 8], [80, 14, 60, 8], [30, 12, 90, 9]],
    reward: 'lodestone',
};

/** Its makers' run (src/trials/kit-data.js format). */
export const HANGAR_KIT = {
    id: 'kit-garage', world: 'garage', mode: 'kit', course: 'discrun', name: 'Disc run', color: '#62c3c9',
    blurb: 'The First Garage’s riding discs stood out on the plain east of the clerk’s board: two islands and a landing on blocks over the plain, a disc shuttling across each gap, and a bank of eyes at the end.',
    rules: 'Ride the discs over to the landing: step on as one comes to you, step off at the far side. On the landing, wake all three eyes with the fluid in one breath. Down on the plain, or on your wings, and the run is over.',
    origin: [52, 6, 38], yaw: Math.PI / 2,
    marker: [4.6, -7.6], start: [0, 0.6], heading: 0, par: 54,
    needs: ['backpack'], lacks: 'The eyes at its end want the fluid gun.',
    onFoot: true, noWings: true, offFeet: 'Feet only: the discs carry you over, not the wings or the jets.',
    fall: { after: 0, below: -2, from: 8, words: 'Down on the plain' },
    voice: {
      who: 'clemence', name: 'Clemence', from: 'who remembers the Major',
      first: '~happy~ The Major rode discs like those to his desk every morning, and was late every morning. You were not.',
      beaten: '~surprised~ Under the makers’ own mark! The Major would have written that down, and lost the paper.',
      again: '~playful~ Round again? The discs don’t mind. They have nowhere else to be either.',
    },
};
