// Each quest's overall goal, in a few plain words: what the whole quest is for, as opposed to its
// stages (the next step). The Quests panel (src/game-menu.js) and the scout's find (main.js) show
// the goal and the next step only, never the steps already done (docs/systems/ui.md, "The game menu").
// Kept apart from the worlds' quest data so a quest's wording and its goal can change on their own;
// a quest may also carry its own `goal`, which wins. Quests.goal(id) falls back to these rules:
// a temple's ("Find what the makers left in the Aerie"), a makers' box, then the quest's title.

export const QUEST_GOALS = {
  // the desert
  'desert.power': 'Wake your ship with the fire of Qanat’s great tree',
  'desert.drum': 'Bring Teo his drum, so the camp can keep time',
  'desert.ilo': 'Show Ilo the way under the giant’s skull',
  'desert.oum': 'Bring old Oum back to the camps',
  'desert.bike': 'Find something faster than walking',
  'desert.mask': 'Clear the sand from the sleeping mask’s eyes',
  // the City-Shaft
  'incal.light': 'Light the Lodestar over the palace again',
  'incal.ration': 'Get Pip’s ration tin up to the palace guard',
  'incal.pass': 'Get a pass, so the cabs stop for you',
  'incal.wren': 'Light the old call-lamp, so a cab comes down',
  // Vael
  'arzach.bird': 'Meet the bird the watcher is waiting for',
  'arzach.feathers': 'Gather the three feathers the bird shed',
  'arzach.hand': 'Make the stone hand ring',
  // Vael II
  'arzach2.bell': 'Ring the silent bell under the cloud',
  'arzach2.letter': 'Carry Mother Ysolde’s letter to her sister',
  'arzach2.cairn': 'Rebuild Tiv’s cairn',
  // the Signal Market
  'bazaar.signal': 'Make the silent tower speak again',
  'bazaar.oldsign': 'Wake the oldest sign in the market',
  'bazaar.bowl': 'Give Ummu back its listening bowl',
  // the Buried Machine
  'buried.tooth': 'Turn the great wheel one tooth for this year',
  'buried.key': 'Get Dun’s key back from the derrick',
  'buried.gauges': 'Read the canyon’s three gauges for Ket',
  'buried.window': 'Touch the warm window over the oculus',
  // the Hangar
  'garage.signal': 'Carry the signal to wherever the Major left it',
  'garage.machines': 'Start the three stopped machines again',
  'garage.ball': 'Send Zazie’s ball through the portal',
  // Viridel
  'edena.garden': 'Find out what became of Odile and Talo’s ship',
  'edena.seed': 'Bring Oro’s pyramid seed home and plant it',
  'edena.terraces': 'Bring the water back to Esk’s tea terraces',
  'edena.clock': 'Mend Mira’s water clock',
  'edena.tree': 'Climb to the crown of the tallest tree',
  // Lorn
  'perdide.crystal': 'Learn what the Great Crystal is singing',
  'perdide.patience': 'Let the snapping plants learn you',
  'perdide.fireflies': 'Follow Ivo’s fireflies home',
  // Lorn II
  'perdide2.lamps': 'Light the old lamp-keeper’s pools again',
  'perdide2.latch': 'Mend Pim’s moss-dome door',
  'perdide2.skiff': 'Find out whose skiff you have been riding',
  // the Garden of Spheres
  'spheres.listen': 'Carry what the spheres remember to the humming pole',
  'spheres.pebble': 'Bring the lake’s reflection to the pole',
  'spheres.avenue': 'Walk the whole avenue slowly',
};

/** The overall goal of a quest definition `d` (id, title, goal?), in a few words. */
export function questGoal(d) {
  if (!d) return '';
  if (d.goal) return d.goal;
  if (QUEST_GOALS[d.id]) return QUEST_GOALS[d.id];
  if (d.id?.startsWith('temple.')) return `Find what the makers left in ${String(d.title ?? 'their temple').replace(/^The /, 'the ')}`;
  if (d.id?.startsWith('box.')) return 'Find the makers’ box and open it';
  return d.title ?? '';
}
