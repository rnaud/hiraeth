// The two helper prototypes' pages and their sandboxed save (issue #339; src/guardian-help/index.js plays them). Kept
// apart and light: src/boot.js seeds the save from here before the game loads, with nothing of the game's drawn yet.

import { slots } from '../save-slots.js';

/** Each prototype: its world, its temple, its name and line (the Debug menu's row), what is owned for it. */
export const HELP = {
  elder: { level: 'arzach', temple: 'arzach', name: 'Fly with the Elder', blurb: 'the Aerie’s Roost: glide beside her and catch the stone feathers she sheds',
    items: ['backpack', 'gun', 'sword', 'shield', 'lift', 'glider'] },
  keeper: { level: 'desert', temple: 'desert', name: 'Water for the Keeper', blurb: 'the Rose House’s cistern: a water cannon fills its jars and brings the flow back',
    items: ['backpack', 'gun', 'sword', 'shield', 'lift'] },
};

/** The prototype a page asks for (?guardianHelp=elder | keeper), or null. */
export const helpKind = (query) => { const k = query?.get?.('guardianHelp'); return k && HELP[k] ? k : null; };
/** The page that plays one. */
export const helpHref = (kind) => `?level=${HELP[kind].level}&guardianHelp=${kind}`;

/** A sandboxed save for it (before the game reads one): the items, the gun in hand, the prologue done, the temple not yet calmed. */
export async function seedGuardianHelp(kind) {
  const H = HELP[kind];
  if (!H) return;
  slots.sandbox();
  const { game } = await import('../game-state.js');
  game.data = { flags: { 'prologue.done': true, 'ship.powered': true, 'ship.launched': true, 'gadget.equipped': 'gun',
    ...Object.fromEntries(H.items.map((id) => [`item.${id}`, 1])) }, keepsakes: [] };
  game.save();
}
