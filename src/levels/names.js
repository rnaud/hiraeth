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
  waterfall: 'The City Behind the Waterfall',
  atelier: 'The Atelier',
  mangrove: 'The White Mangrove',
  saltharbour: 'The Salt Harbour',
  home: 'Home',
  glassdunes: 'The Glass Dunes',
  underwater: 'The Underwater City',
};

// the route, world by world (src/story/route.js). The wings come first (Vael's Aerie, the second world,
// where the winds lift them); the jets wait in the later half (the City-Shaft's Warden's Well), and the
// worlds that want them (the Hangar, the Buried Machine, the Signal Market) come after it.
export const ORDER = ['desert', 'arzach', 'arzach2', 'perdide', 'perdide2', 'edena', 'incal', 'garage', 'buried', 'spheres', 'bazaar'];
// the worlds off the route: on the ship's map from the start, never needed on the way home (no story to follow)
export const SIDE = ['mangrove', 'glassdunes', 'waterfall', 'saltharbour', 'underwater'];
// a world that follows another's story is only charted once that one is done (Vael II: the bird's promise)
export const AFTER = { arzach2: 'arzach' };
