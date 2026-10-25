// The makers' spells (docs/systems/spells.md): four workings a guardian keeps at its heart, each given to the traveller
// when its house is resolved, cast with LB / L1 + RB / R1 (the guard's and the blade's buttons together; Y on the
// keyboard, the ✺ button on a touch screen), then 30 s to recover. One is chosen at a time, in the game menu's Items.
//
// Four houses spread along the route, one spell each, so the kit grows through the journey (src/levels/names.js ORDER):
//   the Aerie (Vael, 2nd world)            ward    a cage of gold rings round you: the next two blows break on it, 12 s
//   the Whale-House (the Underwater City, 5th)  tide    a slow-water dome where you stand: foes in it move at a third, 8 s
//   the Engine-House (the Buried Machine, 8th)  shards  six cutting shards circle you and cut what they touch, 6 s
//   the Mooring-House (the Floating City, 11th) veil    foes lose you: they give up the chase and pass you by, 8 s or a cut
// None of them is a gadget's twin: the shield guards the front only and only while held (the ward, all round, hands
// free); stilling freezes one foe a shot (the tide slows a crowd, a place); the bombs and the spring boots' stomp throw
// foes off (the shards stay with you and cut); the hush-cloth only quietens your steps (the veil takes you out of a
// fight already begun). The guardians are the makers' own: the tide, the shards and the veil pass over them; the ward
// still takes their blows.

/** Seconds a spell takes to recover after it is cast. */
export const SPELL_COOLDOWN = 30;

/** The press window (s) in which LB / L1 and RB / R1 count as pressed together (src/controller.js). */
export const SPELL_CHORD = 0.12;

/**
 * Each spell: its name, the HUD's glyph, its colour (and `ink`, darker, for its glyph on paper: the menu), the temple that gives it, what it does (the card and the menu's
 * line: at most 180 letters), and its tuning.
 */
export const SPELLS = {
  ward: {
    name: 'Aerie ward', glyph: '◎', color: '#f2c54b', ink: '#9a6c08', temple: 'arzach', where: 'The Aerie, Vael’s makers’ house: its guardian’s gift.',
    text: 'Gold rings close round you like a gyroscope: the next two blows, from any side, break on them. They fade after 12 s.',
    tune: { time: 12, blocks: 2, r: 0.95 },
  },
  tide: {
    name: 'Slow tide', glyph: '◔', color: '#5b9be0', ink: '#2f6db0', temple: 'underwater', where: 'The Whale-House, the drowned city’s makers’ house: its guardian’s gift.',
    text: 'A dome of slow water rises where you stand. Foes inside it move, wind up and strike at a third of their pace for 8 s.',
    tune: { time: 8, r: 8, slow: 1 / 3 },
  },
  shards: {
    name: 'Engine shards', glyph: '✦', color: '#5fd0c8', ink: '#24897f', temple: 'buried', where: 'The Engine-House, the Buried Machine’s heart: its guardian’s gift.',
    text: 'Six bright shards spin round you for 6 s and cut every foe they pass through, each foe once every half second.',
    tune: { time: 6, n: 6, r: 2.2, every: 0.5, damage: 1, reach: 0.9, spin: 3.4 },
  },
  veil: {
    name: 'Mooring veil', glyph: '◌', color: '#a58bd8', ink: '#6c4fb0', temple: 'spacecity', where: 'The Mooring-House, the floating city’s makers’ house: its guardian’s gift.',
    text: 'A curtain of light hides you: foes lose you, give up the chase and pass you by for 8 s, or until you cut.',
    tune: { time: 8, r: 1.2 },
  },
};

/** The spells in the order they are earned along the route (the menu's and the tests' order). */
export const SPELL_ORDER = ['ward', 'tide', 'shards', 'veil'];

/** temple id → the spell its resolution gives. */
export const TEMPLE_SPELL = Object.fromEntries(SPELL_ORDER.map((id) => [SPELLS[id].temple, id]));

export const isSpell = (id) => Object.hasOwn(SPELLS, id);
