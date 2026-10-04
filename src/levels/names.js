// The worlds' names and the route's order, with no imports: the title screen and
// the save slots (src/save-slots.js) show them before any world, story or game
// state is loaded. levels/index.js and levels/content.js take them from here.

export const TITLES = {
  desert: 'The Desert',
  incal: 'The City-Shaft',
  arzach: 'Vael',
  arzach2: 'Vael II: The Sky Stones',
  garage: 'The Sealed Hangar',
  buried: 'The Buried Machine',
  edena: 'Viridel',
  spheres: 'The Garden of Spheres',
  perdide: 'Lorn',
  perdide2: 'Lorn II: The Deep Wood',
  bazaar: 'The Signal Market',
  atelier: 'The Atelier',
  home: 'Home',
};

// the route, world by world (src/story/route.js)
export const ORDER = ['desert', 'incal', 'arzach', 'arzach2', 'garage', 'buried', 'edena', 'spheres', 'perdide', 'perdide2', 'bazaar'];
