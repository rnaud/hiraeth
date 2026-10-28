// The kit's colours (issue #341, docs/design/fight-temples.md): palettes for the makers' battery (its brass, its ceramic
// endcaps, its clip: the parts the round backpack's brass, canvas plate, cloth and straps were), the sword's water and the shield's, won one set per world's fight
// temple and chosen piece by piece in the Items panel (src/game-menu.js: the Colours row; main.js). The makers' own
// (jade and brass) is always there. Kept in the save's flags: `kit.colours.<id>` won, `kit.colour.<piece>` chosen.
//
//   unlockColours(state, 'ember')        → true the first time (the fight temple's reward)
//   chosenColour(state, 'sword')         → the palette's id in use for that piece (the makers' if none, or not won)
//   cycleColour(state, 'backpack')       → the next won palette for it, chosen and returned
//   applyKitColours(tool, state)         the worn backpack recoloured, the sword's and the shield's water retinted

import { makeMaterial, markHero } from './materials.js';
import { SWORD_TONES, swordMaterial } from './fluid-sword.js';
import { shieldMaterial } from './shield.js';

export const PIECES = ['backpack', 'sword', 'shield'];
export const PIECE_NAME = { backpack: 'Battery', sword: 'Sword', shield: 'Shield' };

/**
 * The makers' battery's own colours (src/fluid-tool.js buildFlask, issue #728; the keys kept from the backpack's parts
 * they replace): its brass rails and rims, the dark brass of its screws and lugs, the cream ceramic endcaps ('canvas')
 * and the ring sunk in their faces, the clip's olive plate ('cloth') and the hook over the belt ('leather'). What a
 * palette paints over.
 */
export const PACK_BASE = { brass: '#c8903f', brassDark: '#7d5a2e', canvas: '#e4dbbb', canvasDark: '#cdbf94', cloth: '#6f7550', leather: '#5a4030' };
const toneList = (T) => [T.cream, T.deep, T.pale, T.gold, T.base, T.light];

/**
 * The palettes: `world` the fight temple that gives it (null: always yours), `pack` the backpack's parts, `water` the
 * sword's and the shield's fluid (base and its five tones, as SWORD_TONES).
 */
export const KIT_COLOURS = [
  { id: 'makers', name: 'Makers’ jade', world: null, pack: PACK_BASE, water: SWORD_TONES },
  // the desert's Sunken Hall: ember and saffron, the burning tree's colours (src/fight-temples/desert.js)
  { id: 'ember', name: 'Ember', world: 'desert', house: 'the Sunken Hall', pack: { brass: '#d8843e', brassDark: '#8e4a2c', canvas: '#b8613c', canvasDark: '#8c432a', cloth: '#f0c45a', leather: '#4e2f22' },
    water: { base: '#e8703a', cream: '#ffe0a6', deep: '#a8382a', pale: '#ffc890', gold: '#f6c14a', light: '#fff2dc' } },
  // Vael's Wind Cloister: the riders' slate, blue-grey brass and white water (src/fight-temples/arzach.js)
  { id: 'slate', name: 'Rider’s slate', world: 'arzach', house: 'the Wind Cloister', pack: { brass: '#8f9cab', brassDark: '#55606f', canvas: '#c9cdd2', canvasDark: '#8e96a0', cloth: '#9fd6ee', leather: '#3a3f4a' },
    water: { base: '#e8f2f8', cream: '#ffffff', deep: '#7f9fb8', pale: '#cfe6f2', gold: '#9fd6ee', light: '#ffffff' } },
  // Lorn's Drowned Mill: reed green and the mill's rust (src/fight-temples/perdide.js)
  { id: 'reed', name: 'Reed and rust', world: 'perdide', house: 'the Drowned Mill', pack: { brass: '#a8643a', brassDark: '#6e3c24', canvas: '#7e9a52', canvasDark: '#5a7038', cloth: '#d8b04a', leather: '#3e2e22' },
    water: { base: '#7fd0b8', cream: '#e6f4d8', deep: '#3f7a6a', pale: '#b6e6d2', gold: '#c9a24a', light: '#f2fff8' } },
  // the Moon Foundry's Pour Floor: moon slag, ivory brass and molten water (src/fight-temples/moonfoundry.js)
  { id: 'slag', name: 'Moon slag', world: 'moonfoundry', house: 'the Pour Floor', pack: { brass: '#e8dcc4', brassDark: '#a99a86', canvas: '#5a4a4a', canvasDark: '#3a2e2e', cloth: '#ff8a3e', leather: '#2a2228' },
    water: { base: '#ff8a3e', cream: '#fff0c8', deep: '#b8432e', pale: '#ffc890', gold: '#ffd36a', light: '#fff6e0' } },
  // Viridel's Seed Vault: green glass and the eyes' light (src/fight-temples/edena.js)
  { id: 'leafglass', name: 'Leafglass', world: 'edena', house: 'the Seed Vault', pack: { brass: '#b8d8a8', brassDark: '#6a8a5a', canvas: '#eef0e6', canvasDark: '#b4bca8', cloth: '#8fd86a', leather: '#3e5a4a' },
    water: { base: '#c8f0b0', cream: '#f4ffe8', deep: '#4a8a4a', pale: '#e0f8d0', gold: '#8fd86a', light: '#ffffff' } },
  // the City-Shaft's Lift Depot: the cabs' yellow on iron (src/fight-temples/incal.js)
  { id: 'cab', name: 'Cab yellow', world: 'incal', house: 'the Lift Depot', pack: { brass: '#e8b83a', brassDark: '#9a7424', canvas: '#5a5f6a', canvasDark: '#3e424c', cloth: '#ffd36a', leather: '#1e2028' },
    water: { base: '#ffd36a', cream: '#fff6d0', deep: '#b8862a', pale: '#ffe8a0', gold: '#e8b83a', light: '#fffbe8' } },
  // the Buried Machine's Tooth Gallery: brass and the canyon's rust (src/fight-temples/buried.js)
  { id: 'brass', name: 'Brass tooth', world: 'buried', house: 'the Tooth Gallery', pack: { brass: '#c9a24a', brassDark: '#7a5a2a', canvas: '#b88a5a', canvasDark: '#6e4e34', cloth: '#ffb347', leather: '#2a2018' },
    water: { base: '#ffb347', cream: '#fff0c8', deep: '#a8642a', pale: '#ffd8a0', gold: '#c9a24a', light: '#fff6e0' } },
  // the Signal Market's Back Rooms: the signs' neon (src/fight-temples/bazaar.js)
  { id: 'neon', name: 'Signal neon', world: 'bazaar', house: 'the Back Rooms', pack: { brass: '#62c3c9', brassDark: '#2e7a80', canvas: '#6a5a7a', canvasDark: '#3a3050', cloth: '#ff5fa2', leather: '#1e1a2a' },
    water: { base: '#ff5fa2', cream: '#ffe0f0', deep: '#a82a6a', pale: '#ffb0d4', gold: '#62c3c9', light: '#fff4fa' } },
  // the Underwater City's Flooded Gallery: pearl and the sea (src/fight-temples/underwater.js)
  { id: 'pearl', name: 'Pearl and tide', world: 'underwater', house: 'the Flooded Gallery', pack: { brass: '#e8eef0', brassDark: '#9ab0b8', canvas: '#3f7a8a', canvasDark: '#2a5462', cloth: '#7fe0e8', leather: '#14202e' },
    water: { base: '#7fe0e8', cream: '#f0fcff', deep: '#2a7a8a', pale: '#c8f4f8', gold: '#e8eef0', light: '#ffffff' } },
  // the Glass Dunes' Kiln Yard: amber glass and the kiln's glow (src/fight-temples/glassdunes.js)
  { id: 'furnace', name: 'Furnace glass', world: 'glassdunes', house: 'the Kiln Yard', pack: { brass: '#d6a94a', brassDark: '#8a6a2a', canvas: '#9cc8bc', canvasDark: '#5a8a7e', cloth: '#ff9a4a', leather: '#203038' },
    water: { base: '#ffb060', cream: '#fff0d8', deep: '#c85a2a', pale: '#ffd8a8', gold: '#bfe8dc', light: '#fffaf0' } },
  // the Garden of Spheres' Quiet Orchard: dusk over the lawns (src/fight-temples/spheres.js)
  { id: 'orchard', name: 'Orchard dusk', world: 'spheres', house: 'the Quiet Orchard', pack: { brass: '#c9b08a', brassDark: '#7a6a4a', canvas: '#6a9a5a', canvasDark: '#4a6a3e', cloth: '#f4c86a', leather: '#2a2a3a' },
    water: { base: '#a8a0e8', cream: '#f4f0ff', deep: '#4a4a8a', pale: '#d0ccf4', gold: '#f4c86a', light: '#ffffff' } },
  // the City Floating in Space's Oil Exchange: lamp oil and its flame (src/fight-temples/spacecity.js)
  { id: 'lampoil', name: 'Lamp oil', world: 'spacecity', house: 'the Oil Exchange', pack: { brass: '#f0c06a', brassDark: '#9a7a3a', canvas: '#3a3a50', canvasDark: '#22223a', cloth: '#ff9a3a', leather: '#1a1a28' },
    water: { base: '#f0c06a', cream: '#fff8e0', deep: '#a8622a', pale: '#ffe0a0', gold: '#ff9a3a', light: '#fffcf0' } },
];
/** A colour as Items names it: by the house it came from (issue #483: "Ember · the Sunken Hall"); the makers' by itself. */
export const colourName = (c) => (c?.house ? `${c.name} · ${c.house}` : c?.name ?? '');
export const colourById = (id) => KIT_COLOURS.find((c) => c.id === id) ?? null;
export const colourOfWorld = (world) => KIT_COLOURS.find((c) => c.world === world) ?? null;

export const wonKey = (id) => `kit.colours.${id}`;
export const choiceKey = (piece) => `kit.colour.${piece}`;

/** The palettes won so far (the makers' first), in the table's order. */
export const wonColours = (state) => KIT_COLOURS.filter((c) => !c.world || !!state?.flag?.(wonKey(c.id))).map((c) => c.id);

/** The palette in use for a piece: the one chosen, if it is won; else the makers'. */
export function chosenColour(state, piece) {
  const id = state?.flag?.(choiceKey(piece));
  return id && wonColours(state).includes(id) ? id : 'makers';
}
/** Choose a won palette for a piece (false: not won, or no such piece). */
export function chooseColour(state, piece, id) {
  if (!PIECES.includes(piece) || !wonColours(state).includes(id)) return false;
  state.set(choiceKey(piece), id);
  return true;
}
/** The next won palette for a piece (round again after the last), chosen. */
export function cycleColour(state, piece, step = 1) {
  const won = wonColours(state), i = won.indexOf(chosenColour(state, piece));
  const id = won[(i + step + won.length) % won.length];
  chooseColour(state, piece, id);
  return id;
}
/** Win a palette (a fight temple cleared): true the first time. `wear`: chosen for every piece then. */
export function unlockColours(state, id, { wear = true } = {}) {
  const c = colourById(id);
  if (!c?.world || state.flag(wonKey(id))) return false;
  state.set(wonKey(id), true);
  if (wear) for (const p of PIECES) chooseColour(state, p, id);
  return true;
}

/** The Items panel's Colours row: a line a piece, what it wears and how many there are to choose from (null: only the makers'). */
export function coloursData(state) {
  const won = wonColours(state);
  if (won.length < 2) return null;
  return PIECES.map((piece) => ({ piece, name: PIECE_NAME[piece], colour: colourName(colourById(chosenColour(state, piece))), of: won.length, swatch: colourById(chosenColour(state, piece)).water.base }));
}

// ------------------------------------------------------------------ painting them on
/** The backpack's material swapped for its colour in the palette (null: not one of the parts a palette paints). */
function packMaterialFor(mat, from, to) {
  const key = mat?.userData?.cacheKey;
  if (!key) return null;
  let o; try { o = JSON.parse(key); } catch { return null; }
  const part = Object.keys(from).find((k) => from[k] === o.color);
  if (!part || o.glow) return null;
  return makeMaterial({ ...o, color: to[part] });
}

/**
 * The backpack worn (FluidTool.tank.group) in a palette's colours: each part of brass, canvas, cloth or leather takes
 * the palette's (its first material kept, so the makers' puts it back exactly).
 */
const heroCopies = new Map();   // (a palette's material as the traveller's own: markHero, once each)
export function paintPack(group, palette) {
  if (!group) return 0;
  let n = 0;
  // (one material, or a mesh's list of them: the straps are one mesh, leather and their brass buckles)
  const paint = (first) => {
    if (palette.id === 'makers') return first;
    const plain = packMaterialFor(first, PACK_BASE, palette.pack);
    if (!plain) return first;
    // (worn, his gear's materials are his own copies, uHero: the palette's are made his the same way)
    return first.uniforms?.uHero?.value === 1 ? heroOf(plain) : plain;
  };
  group.traverse((o) => {
    if (!o.isMesh) return;
    const first = o.userData.kitMat0 ?? o.material;
    o.userData.kitMat0 = first;
    const m = Array.isArray(first) ? first.map(paint) : paint(first);
    const same = Array.isArray(m) ? m.every((x, i) => x === o.material[i]) : m === o.material;
    if (!same) { o.material = m; n++; }
  });
  return n;
}
function heroOf(mat) {
  const probe = { isMesh: true, material: mat, traverse(f) { f(this); } };
  markHero(probe, heroCopies);
  return probe.material;
}

/** A fluid material's tones (the sword's, the shield's) set to a palette's water. */
export function paintWater(mat, water) {
  const U = mat?.uniforms;
  if (!U?.uFluidBase) return;
  U.uFluidBase.value.set(water.base);
  toneList(water).forEach((c, i) => U.uFluidTones?.value[i]?.set(c));
}

/** Everything on him in the colours chosen (main.js: at the start, and whenever a choice or the backpack changes). */
export function applyKitColours(tool, state) {
  const pal = (piece) => colourById(chosenColour(state, piece));
  paintPack(tool?.tank?.group, pal('backpack'));
  paintWater(swordMaterial(), pal('sword').water);
  paintWater(shieldMaterial(), pal('shield').water);
}
