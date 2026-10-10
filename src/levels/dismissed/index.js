// The dismissed worlds (src/levels/names.js DISMISSED; docs/systems/worlds.md, "Merged and dismissed worlds"): off
// the route, out of the Debug menu and the level registry (src/levels/index.js LEVELS), kept whole to reuse. Each
// folder holds a world's level, its story and people, its props and its finds; its tests build it from here.
//
//   hangar/    the Sealed Hangar (`garage`): Major Brask's pocket universe. Its temple, the First Garage, went to
//              the Glass Dunes as the Clock-House (src/temples/garage.js), with its boxes, court, trial and run
//   atelier/   the Atelier (`atelier`): a blank page off the route that nothing led to

import { TITLES } from '../names.js';
import { createGarage, buildGarage } from './hangar/level.js';
import { createAtelier, buildAtelier } from './atelier/level.js';

/** The dismissed worlds as level entries (src/levels/index.js format; `replacedBy`: where a save left there wakes). */
export const DISMISSED_LEVELS = [
  {
    id: 'garage', create: createGarage, build: buildGarage, hidden: true, dismissed: true, replacedBy: 'glassdunes',
    title: TITLES.garage, source: 'a pocket universe that keeps turning',
    blurb: "Major Brask's pocket universe: portals to an upside-down quarter and a ring where gravity points outward. Machines pass a signal between these strange places.",
    moves: 'portals · shifting gravity · jetpack',
  },
  {
    id: 'atelier', create: createAtelier, build: buildAtelier, hidden: true, dismissed: true, replacedBy: null,
    title: TITLES.atelier, source: 'the last page',
    blurb: 'A blank page where every world you crossed is sketched in pencil. Someone is still drawing. Pale paper-like growths stir when you look at them.',
    moves: 'off the route: a page for the curious',
  },
];
