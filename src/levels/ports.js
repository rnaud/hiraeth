// ---------------------------------------------------------------------------
// The cities' space ports (issue #441): each city's port as data for the shared kit (src/levels/port-pad.js), drawn
// after the sheet the author picked (references/space-ports/<id>/sheet-1.jpg; the plan: docs/design/space-ports.md).
// Every port grows round the ship's present site, which does not move: `site` is the level's shipSite on its ground.
// Positions are in the hull's frame, `at: [u, v]` (u out of the hatch, v along the hull to its stern: port-pad.js), or
// `xz` in the world where a piece belongs to the city's own plan (a rim, a bridge's mouth).
//
// A port: { id, site, pad: [layers], pieces: [pieces], traffic: [craft on loops], sights, staff: [people] }. The staff
// are the level's own people (a harbourmaster with two toned lines): each level adds them to its content's npcs.
// ---------------------------------------------------------------------------

const TAU = Math.PI * 2;
/** World yaw facing from (x, z) toward (tx, tz). */
const facing = (x, z, tx, tz) => Math.atan2(tx - x, tz - z);
/** A point on a circle round (cx, cz) at angle a (0 = +z, PI/2 = +x), and the yaw facing out from its middle. */
const onRim = (cx, cz, r, a) => ({ xz: [cx + Math.sin(a) * r, cz + Math.cos(a) * r], yaw: a });

// ------------------------------------------------------------------ the City Floating in Space: the Pier port
// The Pier is a round deck (0, 122), 27 m round; the ship at (0, 128) with its hatch north toward the bridge's mouth
// (0, 95); Amaro's shop at (-16, 112), Rosa at (-5, 112). The sheet: the pale deck ringed in red, blue iron hoop cradles
// hung off its rim each with a moorer's boat, a lamp-mast and the harbour hut by the bridge, casks, boats in the dark.
const PIER = { x: 0, z: 122, r: 27 };
const SC_COL = { hoop: '#4f7d8e', brass: '#c8a050', red: '#d9705e', cream: '#f2dcc4', salmon: '#e8907a', teal: '#3e6e7a' };
export const SPACECITY_PORT = {
  id: 'spacecity',
  site: { x: 0, y: 0, z: 128, h: Math.PI },
  pad: [
    // the red bands round the deck (open at the bridge's mouth, north)
    { kind: 'arc', at: [6, 0], r: 23.6, w: 1.5, from: 0.42, to: TAU - 0.42, color: SC_COL.red },
    { kind: 'arc', at: [6, 0], r: 21.4, w: 0.45, from: 0.5, to: TAU - 0.5, color: SC_COL.red },
  ],
  pieces: [
    // the hoop cradles off the rim, each with a boat: either side of the bridge, the east side, and behind the hull (the
    // boats a little under their flying size, so the 9 m boat sits inside its hoop as on the sheet)
    { kind: 'ring', ...onRim(PIER.x, PIER.z, PIER.r - 0.6, Math.PI - 0.62), r: 4.2, color: SC_COL.hoop, trim: SC_COL.brass, craft: { model: 'skyboat', scale: 0.72, colors: { hull: SC_COL.cream, belly: SC_COL.salmon, trim: SC_COL.teal } } },
    { kind: 'ring', ...onRim(PIER.x, PIER.z, PIER.r - 0.6, Math.PI + 0.62), r: 4.2, color: SC_COL.hoop, trim: SC_COL.brass, craft: { model: 'skyboat', scale: 0.72, colors: { hull: '#9cc0c4', belly: SC_COL.cream, trim: '#c86a5a' } } },
    { kind: 'ring', ...onRim(PIER.x, PIER.z, PIER.r - 0.6, Math.PI / 2 + 0.35), r: 4.6, color: SC_COL.hoop, trim: SC_COL.brass, craft: { model: 'skyboat', scale: 0.78, colors: { hull: SC_COL.salmon, belly: SC_COL.cream, trim: SC_COL.teal } } },
    { kind: 'ring', ...onRim(PIER.x, PIER.z, PIER.r - 0.6, 0.25), r: 4.2, color: SC_COL.hoop, trim: SC_COL.brass },
    // the harbour's lamp-mast at the bridge's mouth, the harbour hut and its chalk-board log beside it
    { kind: 'mast', xz: [7.5, 99], h: 12, color: SC_COL.hoop, trim: SC_COL.brass, solid: true },
    { kind: 'kiosk', xz: [11.5, 106], yaw: facing(11.5, 106, 0, 112), w: 3.4, d: 2.8, h: 2.7, color: '#e9c8a8', roof: 'round', roofColor: '#c8604a', window: '#ffd28a', solid: true },
    { kind: 'board', xz: [8.2, 108.5], yaw: facing(8.2, 108.5, 0, 116) },
    // casks and canisters for the islands, by the hut and at the hoops
    { kind: 'cargo', xz: [15.5, 110.5], yaw: 0.4, items: ['cask', 'cask', 'crate', 'cask'], cols: 2, gap: 1.1, colors: { cask: '#8a9aa0', band: '#4a5258', crate: '#c89a70' }, solid: true },
    { kind: 'cargo', xz: [18, 141], yaw: -0.5, items: ['cask', 'cask', 'cask'], cols: 3, gap: 1.05, colors: { cask: '#d0b898', band: '#6a5a4a' }, solid: true },
    { kind: 'cargo', xz: [-12, 143], yaw: 0.2, items: ['crate', 'cask', 'crate'], cols: 3, gap: 1.3, colors: { cask: '#8a9aa0', band: '#4a5258', crate: '#c89a70' }, solid: true },
  ],
  traffic: [
    { model: 'skyboat', colors: { hull: SC_COL.cream, belly: SC_COL.salmon, trim: SC_COL.teal }, centre: [0, 0, -30], rx: 150, rz: 200, h: 30, speed: 13 },
    { model: 'skyboat', colors: { hull: '#9cc0c4', belly: SC_COL.cream, trim: '#c86a5a' }, centre: [10, 0, -40], rx: 125, rz: 165, h: 44, speed: 11, dir: -1, phase: 2.4 },
    { model: 'skyboat', colors: { hull: SC_COL.salmon, belly: SC_COL.cream, trim: SC_COL.teal }, centre: [0, 0, 60], rx: 70, rz: 95, h: 22, speed: 9, phase: 4.1 },
    { model: 'skyboat', colors: { hull: SC_COL.cream, belly: '#9cc0c4', trim: '#c86a5a' }, centre: [20, 0, 140], rx: 60, rz: 45, h: -6, speed: 7, dir: -1, phase: 1.0, scale: 0.9 },
  ],
  sights: [{ name: 'the Pier’s cradles', xz: [17, 103] }],
  staff: [
    { id: 'orla', name: 'Orla', title: 'who keeps the harbour book', color: '#4f7d8e', kind: 'f', at: [9.5, 109.5], y: 0, radius: 2, lang: 'spacecity',
      lines: ['~neutral~ Every boat in, every boat out. In chalk, so the dark can’t read it.', '~playful~ Your ship’s the biggest thing I’ve logged. I had to write small.'] },
  ],
};

// ------------------------------------------------------------------ the City-Shaft: the Rim Docks
// The ship on the east rim (331, 200, -10) with its hatch west to the shaft, 260 m round its middle (the rim's edge is
// 71 m off); three villas in front of the ramp. The sheet: lacquered pink-and-lilac cradles cantilevered over the drop,
// a gantry crane on the rim lowering crates on cables, the cabs (striped awnings) at a stand. The cradles stand either
// side of the ramp's line, the view west across the shaft to the Lodestar left clear.
const SHAFT_R = 260, SHIP_A = Math.atan2(331.1, -10.1);   // (onRim's angle: x = sin a, z = cos a)
const rimAt = (da, r = SHAFT_R - 1) => { const a = SHIP_A + da, x = Math.sin(a) * r, z = Math.cos(a) * r; return { xz: [x, z], yaw: facing(x, z, 0, 0) }; };
const SH_COL = { pink: '#e2b2c6', lilac: '#b8a6d8', blue: '#a8bcdc', brass: '#c9a24e', iron: '#6a6478' };
export const INCAL_PORT = {
  id: 'incal',
  site: { x: 331.1, y: 200, z: -10.1, h: -1.396 },
  pad: [
    // the bay's lines on the rim's paving, lilac, brass lamps at its corners
    { kind: 'rect', at: [2, 4], len: 64, wid: 30, w: 0.45, color: SH_COL.lilac },
    { kind: 'chevrons', r: 24, len: 2.6, color: SH_COL.lilac, gaps: [[20, 4, 6]] },
  ],
  pieces: [
    // the cradles over the drop either side of the ramp's line, a cab held in one
    { kind: 'cradle', ...rimAt(0.115), len: 24, w: 7.5, color: SH_COL.pink, dark: SH_COL.blue, trim: SH_COL.brass, craft: { model: 'cab', colors: { hull: '#e8a0b4' }, scale: 2 } },
    { kind: 'cradle', ...rimAt(-0.13), len: 20, w: 6.5, color: SH_COL.lilac, dark: SH_COL.pink, trim: SH_COL.brass },
    // the gantry crane on the rim, its boom out over the shaft, a crate on its way down
    { kind: 'crane', ...rimAt(-0.205, SHAFT_R + 3), h: 15, reach: 17, tilt: 0.05, color: SH_COL.pink, cab: SH_COL.lilac, dark: SH_COL.iron, load: 'crate', drop: 26, lamp: '#ffd890', solid: true },
    // the cab stand behind the hull: three cabs in the city's colours, a lamp-post and the warden's booth at its head (the
    // makers' court is behind the stern: src/finds/courts.js)
    { kind: 'craft', at: [-21, -26], yaw: Math.PI / 2, model: 'cab', colors: { hull: '#e8a0b4' }, scale: 2 },
    { kind: 'craft', at: [-21, -12], yaw: Math.PI / 2, model: 'cab', colors: { hull: '#9ec0dc' }, scale: 2 },
    { kind: 'craft', at: [-21, 2], yaw: Math.PI / 2, model: 'cab', colors: { hull: '#c4a8dc' }, scale: 2 },
    { kind: 'mast', at: [-15, -34], h: 7, color: SH_COL.iron, trim: SH_COL.brass, solid: true },
    { kind: 'kiosk', at: [-18, -44], yaw: Math.PI / 2, w: 3, d: 2.6, h: 2.8, color: SH_COL.pink, roof: 'round', roofColor: SH_COL.lilac, awning: '#e8d4dc', solid: true },
    // crates and baskets for the ration down the shaft, by the crane
    { kind: 'cargo', ...rimAt(-0.17, SHAFT_R + 6), items: ['crate', 'basket', 'crate', 'basket', 'crate', 'crate'], stack: true, colors: { crate: '#b89a72', basket: '#c8a46a', goods: '#e0b050' }, solid: true },
  ],
  sights: [{ name: 'the Rim Docks', xz: rimAt(0.115).xz }],
  staff: [
    { id: 'faro', name: 'Faro', title: 'who wardens the rim docks', color: '#b8a6d8', kind: 'm', uv: [-20, -38], y: 200, radius: 2, lang: 'incal',
      lines: ['~neutral~ The cradles are for the big haulers. Yours fits the rim.', '~solemn~ Everything that goes down the shaft goes from here. On a rope, slowly.'] },
  ],
};

// ------------------------------------------------------------------ the Signal Market: the Callsign Apron
// The ship south of the market (20, 0.3, 151), its hatch north up the avenue; Doss and Madame Sel at the apron's
// gate, the silent tower 326 m up the avenue. The sheet: sea-green paving ruled in white, the great board of
// call-signs with its clerk's window (one board dark), small craft parked on the apron, a round pad with a rail,
// crates of radios. The tower's axis up the avenue stays clear.
const SM_COL = { line: '#eef0e4', slate: '#7c8696', coral: '#d9786a', teal: '#5aa0a0', gold: '#e8bc5a' };
export const BAZAAR_PORT = {
  id: 'bazaar',
  site: { x: 19.9, y: 0.3, z: 150.9, h: -2.835 },
  pad: [
    { kind: 'rect', at: [3, 4], len: 66, wid: 32, w: 0.5, color: SM_COL.line },
    { kind: 'rect', at: [3, 4], len: 62, wid: 28, w: 0.25, color: SM_COL.line },
    { kind: 'circle', at: [-16, 40], r: 4.5, w: 0.35, color: SM_COL.line, mark: 'cross' },
    { kind: 'circle', at: [-17, -38], r: 5.6, w: 0.4, color: SM_COL.gold },
  ],
  pieces: [
    // the board of call-signs at the stern's corner, the clerk's window turned to the apron
    { kind: 'signal', at: [11, 54], yaw: -Math.PI / 2, w: 8, d: 6, h: 34, antennas: [[-2.6, -1, 9], [0.6, 1, 13], [2.8, -0.6, 7], [-0.6, -1.8, 5], [1.8, 1.8, 10]], color: SM_COL.slate, trim: '#5a6476', colors: ['#f2c870', '#f2c870', '#9ad8d8', '#f2c870'], boards: 10, dark: [7], solid: true },
    // craft parked behind the hull: a courier, the yellow walker, a grey hauler; one on the round pad by the bow
    { kind: 'craft', at: [-20, -20], yaw: Math.PI / 2 + 0.3, model: 'dart', colors: { hull: '#e8e4dc', stripe: SM_COL.coral, fin: '#5a7a9a' } },
    { kind: 'craft', at: [-19, -2], yaw: Math.PI / 2 - 0.4, model: 'buggy' },
    { kind: 'craft', at: [-20, 20], yaw: Math.PI / 2, model: 'hauler', colors: { hull: '#9ea4ae', trim: '#6a7280' } },
    { kind: 'craft', at: [-17, -38], yaw: 0.8, model: 'dart', colors: { hull: '#dcdcd4', stripe: SM_COL.teal, fin: SM_COL.coral }, scale: 0.9 },
    // crates of radios and antenna parts at the board's foot, a stall's awning over them
    { kind: 'awning', at: [-3, 46], yaw: -Math.PI / 2, w: 4.2, d: 3.2, h: 2.9, color: SM_COL.coral, under: { items: ['radio', 'radio', 'crate', 'radio', 'crate', 'radio'], cols: 3, gap: 1.2, colors: { radio: '#8a9098', crate: '#b8a07a' } }, solid: true },
    { kind: 'cargo', at: [-9, 34], yaw: 0.2, items: ['crate', 'radio', 'crate', 'crate'], cols: 2, stack: true, colors: { crate: '#a8b0b8', radio: '#7a8088' }, solid: true },
  ],
  traffic: [
    { model: 'dart', colors: { hull: '#e8e4dc', stripe: SM_COL.gold, fin: '#5a7a9a' }, centre: [10, 0, 20], rx: 70, rz: 160, h: 46, speed: 16 },
    { model: 'buggy', centre: [0, 0, 60], rx: 50, rz: 110, h: 34, speed: 10, dir: -1, phase: 2.0 },
  ],
  sights: [{ name: 'the board of call-signs', at: [11, 48] }],
  staff: [{ id: 'ludo', name: 'Ludo', title: 'who logs the call-signs', color: '#5aa0a0', kind: 'm', uv: [11, 49.2], y: 0.3, radius: 2, lang: 'bazaar',
    lines: ['~neutral~ Every ship gets a call-sign and a board. Yours is up. Third from the top.', '~curious~ The dark board? Nobody’s answered to it in thirty years. We keep it anyway.'] }],
};

// ------------------------------------------------------------------ the Underwater City: the Dock made a port
// The ship on the crown of the Dock's dome (5, 21, 134; the dome 34 m round at (0, 128), 21 m high), its hatch north;
// Bastien at the lock below. The sheet: a coral pontoon ring with brass rims round the lock's shaft, a domed cupola on
// it, round pods parked and gliding outside the glass. The ring is laid on the dome's crown on brass legs, under the
// hull, open where the ramp comes down to the dome (the sheet's ring is open where its bridge comes in); the pods loop
// round the city's domes.
const UW_COL = { coral: '#e2806e', brass: '#c8a24e', teal: '#7cc4b4', cream: '#efe4cc', glass: '#a8e0d4' };
export const UNDERWATER_PORT = {
  id: 'underwater',
  site: { x: 5.4, y: 21, z: 134, h: Math.PI },
  pad: [
    { kind: 'annulus', at: [6, 5.4], dy: -0.7, r0: 10.5, r1: 21, gap: [-1.0, 0.3], h: 0.7, color: UW_COL.coral, rim: UW_COL.brass, seams: 18, posts: 10, legs: 8, drop: 5 },
  ],
  pieces: [
    // the cupola on the ring by the stern, two pods moored, the lock's brass lamp-post
    { kind: 'kiosk', at: [12, 22], dy: 0, yaw: 0.9, w: 3.6, d: 3.6, h: 2.6, color: UW_COL.cream, roof: 'round', roofColor: UW_COL.brass, window: '#ffe2a8' },
    { kind: 'craft', at: [21, 13], dy: 0, yaw: 2.2, model: 'pod', colors: { hull: UW_COL.coral, brass: UW_COL.brass, glass: UW_COL.glass } },
    { kind: 'craft', at: [-10, 16], dy: 0, yaw: -2.4, model: 'pod', colors: { hull: UW_COL.cream, brass: UW_COL.brass, glass: UW_COL.glass } },
    { kind: 'mast', at: [-11, -6], dy: 0, h: 5.5, color: UW_COL.brass, trim: UW_COL.teal, lamp: '#ffe8b0' },
    { kind: 'cargo', at: [-10, -8], dy: 0, yaw: 0.5, items: ['cask', 'crate', 'cask', 'crate'], cols: 2, colors: { cask: UW_COL.teal, band: UW_COL.brass, crate: '#c8a882' } },
  ],
  traffic: [
    { model: 'pod', colors: { hull: UW_COL.coral, brass: UW_COL.brass, glass: UW_COL.glass }, centre: [0, 0, 20], rx: 72, rz: 150, h: 16, speed: 6 },
    { model: 'pod', colors: { hull: UW_COL.teal, brass: UW_COL.brass, glass: UW_COL.glass }, centre: [0, 0, -50], rx: 110, rz: 90, h: 34, speed: 5, dir: -1, phase: 2.2 },
    { model: 'pod', colors: { hull: UW_COL.cream, brass: UW_COL.brass, glass: UW_COL.glass }, centre: [0, 0, 128], rx: 48, rz: 48, h: 12, speed: 4, phase: 4.4, scale: 0.8 },
  ],
  sights: [{ name: 'the pontoon ring on the Dock', at: [20, 16] }],
  staff: [],   // (Bastien keeps the lock: he is its harbourmaster already)
};

// ------------------------------------------------------------------ the Glass Dunes: the Float Yard
// The ship at the valley's south (0, 0.4, 250), its hatch north; Halden by the makers' discs east of it, the Clock-House
// 186 m east. The sheet: a pale stone landing disc ringed in white, ochre canvases over racks of bottle-green glass
// floats, float-sledges on curled runners, a glass-hulled skiff. The view east to the Clock-House stays open.
const GD_COL = { stone: '#e9dfc6', edge: '#d2c3a0', line: '#fffaf0', canvas: '#d9a24a', wood: '#9a7a52', float: '#3e8a68', glass: '#4f9a72' };
export const GLASSDUNES_PORT = {
  id: 'glassdunes',
  site: { x: 0, y: 0.4, z: 250, h: Math.PI },
  pad: [
    // (flush with the ship's flat of sand, 30 m round: a slab drawn higher is walked through, src/contact-audit.js)
    { kind: 'disc', r: 29, h: 0.055, color: GD_COL.stone, edge: GD_COL.edge, line: { r: 26.5, w: 0.4, color: GD_COL.line } },
  ],
  pieces: [
    // the canvases over the racks of floats, behind the hull and by the yard's east side
    { kind: 'awning', at: [-26, -14], yaw: Math.PI, w: 9, d: 6, h: 4, color: GD_COL.canvas, pole: '#6a5040' },
    { kind: 'rack', at: [-26, -14], yaw: Math.PI, n: 6, color: GD_COL.wood, float: GD_COL.float, solid: true },
    { kind: 'awning', at: [-27, 16], yaw: Math.PI, w: 9, d: 6, h: 4, color: GD_COL.canvas, pole: '#6a5040' },
    { kind: 'rack', at: [-27, 16], yaw: Math.PI, n: 6, color: GD_COL.wood, float: '#2e7a5a', solid: true },
    { kind: 'awning', at: [28, 44], yaw: -Math.PI / 2, w: 9, d: 6, h: 4, color: GD_COL.canvas, pole: '#6a5040' },
    { kind: 'rack', at: [28, 44], yaw: -Math.PI / 2, n: 6, color: GD_COL.wood, float: GD_COL.float, solid: true },
    // the sledges, one under its own canvas, a skiff of glass drawn up by the bow
    { kind: 'craft', at: [34, 26], yaw: 0.5, model: 'sledge', colors: { wood: GD_COL.wood, float: GD_COL.float }, solid: true },
    { kind: 'craft', at: [-18, -42], yaw: 1.3, model: 'sledge', colors: { wood: GD_COL.wood, float: '#2e7a5a', canvas: GD_COL.canvas, canopy: true }, solid: true },
    { kind: 'craft', at: [-30, 38], yaw: 2.6, model: 'sledge', colors: { wood: GD_COL.wood, float: GD_COL.float }, solid: true },
    { kind: 'craft', at: [-6, 42], yaw: 1.9, model: 'skiff', colors: { glass: GD_COL.glass }, solid: true },
    { kind: 'cargo', at: [-33, 2], yaw: 0.2, items: ['float', 'float', 'float', 'crate', 'float'], cols: 3, colors: { float: GD_COL.float, crate: GD_COL.wood }, solid: true },
  ],
  traffic: [
    { model: 'skiff', colors: { glass: GD_COL.glass }, centre: [0, 0, 120], rx: 90, rz: 150, h: 26, speed: 8, scale: 1.4 },
  ],
  sights: [{ name: 'the Float Yard', at: [-26, 0] }],
  staff: [{ id: 'mabyn', name: 'Mabyn', title: 'who keeps the float yard’s tally', color: '#d9a24a', kind: 'f', uv: [24, 40], y: 0, radius: 2, lang: 'glassdunes',
    lines: ['~neutral~ Floats in, floats out. One crack and the whole sledge sings wrong.', '~playful~ That disc was here before the yard. We only swept it.'] }],
};

// ------------------------------------------------------------------ the City During the Eclipse: the Lantern Esplanade
// The ship in the sunken court south of the gate (0, 0, 96), its hatch north to the gate; Mira 74 m off. The sheet: a
// limewashed terrace, rows of tapered pylons with lanterns lit at noon, a mirror tower, gold rings on the paving where a
// ship sets down, junks with batten sails. The pylons line the hull's sides; the ramp's axis to the gate stays open.
const EC_COL = { lime: '#f1ebe0', gold: '#c9a050', lamp: '#ffd27a', rose: '#e8c4b4' };
const ecRow = (u, vs) => vs.map((v) => ({ kind: 'pylon', at: [u, v], h: 6.5, color: EC_COL.lime, brass: EC_COL.gold, lamp: EC_COL.lamp, light: v % 20 === 0, solid: true }));
export const ECLIPSE_PORT = {
  id: 'eclipse',
  site: { x: 0, y: 0, z: 96, h: Math.PI },
  pad: [
    { kind: 'studs', r: 31, n: 28, color: EC_COL.lamp, rim: EC_COL.gold, gaps: [[22, 4, 7]], lightEvery: 7 },
    { kind: 'circle', at: [21, -27], r: 5.5, w: 0.22, color: EC_COL.gold },
    { kind: 'circle', at: [21, -27], r: 3.3, w: 0.2, color: EC_COL.gold, mark: 'dot' },
    { kind: 'arc', r: 26, w: 0.3, from: 0.35, to: TAU - 0.35, color: EC_COL.gold },
  ],
  pieces: [
    ...ecRow(-17, [-36, -24, -12, 0, 12, 24, 36]),
    ...ecRow(16, [-36, -24, -12, 22, 34]),
    // (and a pair either side of the way out to the gate)
    ...ecRow(31, [-9, 9]),
    // the mirror tower at the court's corner, the lamp-bearers' baskets for the feast
    { kind: 'mirror', at: [-22, -44], yaw: 0.6, h: 13, color: EC_COL.lime, brass: EC_COL.gold, solid: true },
    { kind: 'cargo', at: [24, 38], yaw: -0.3, items: ['basket', 'basket', 'basket', 'basket', 'basket'], cols: 3, gap: 1.1, colors: { basket: '#c8a46a', goods: '#e0a050' } },
  ],
  traffic: [
    { model: 'junk', colors: { hull: EC_COL.lime, sail: '#ecdcbc' }, centre: [0, 0, -40], rx: 130, rz: 160, h: 38, speed: 7 },
    { model: 'junk', colors: { hull: EC_COL.rose, sail: '#f0e4c8' }, centre: [20, 0, 20], rx: 90, rz: 120, h: 26, speed: 6, dir: -1, phase: 3.1 },
  ],
  sights: [{ name: 'the mirror tower on the esplanade', at: [-22, -44] }],
  staff: [{ id: 'cato', name: 'Cato', title: 'who walks the ships in', color: '#e8c4b4', kind: 'm', uv: [20, -16], y: 0, radius: 2, lang: 'eclipse',
    lines: ['~solemn~ We light the lamps at noon, so a ship can find the ground in the dark.', '~whisper~ Step out slowly. The shadows here are longer than they look.'] }],
};

// ------------------------------------------------------------------ Salt Harbour: the Salt Quay
// The ship on the open salt south of the street (0, 0.5, 92), its hatch north up the street; Hesper keeps the harbour
// book 86 m off. The sheet: stakes driven into the salt with the old mooring ropes strung between them, a crane made of
// a ship's mast and boom on a terracotta tower, a sand-skiff on runners and a round hopper, sea chests.
const SH2_COL = { stake: '#8a7660', cap: '#5a4a3a', rope: '#9a865e', terra: '#c8705a', blue: '#6a8ab8', sail: '#ece0c4' };
export const SALTHARBOUR_PORT = {
  id: 'saltharbour',
  site: { x: 0, y: 0.54, z: 92, h: Math.PI },
  pad: [
    { kind: 'stakes', at: [0, 4], len: 72, wid: 40, nu: 2, nv: 4, color: SH2_COL.stake, cap: SH2_COL.cap, rope: SH2_COL.rope },
  ],
  pieces: [
    { kind: 'crane', at: [-27, 46], yaw: Math.PI * 0.75, h: 13, r: 1.8, reach: 13, tilt: 0.55, color: SH2_COL.terra, cab: '#b8604a', dark: '#6a4a3a', load: 'crate', drop: 8, solid: true },
    { kind: 'craft', at: [14, 48], yaw: 0.3, model: 'sandskiff' },
    { kind: 'craft', at: [-24, -36], yaw: 2.5, model: 'hopper', colors: { hull: SH2_COL.blue } },
    { kind: 'cargo', at: [17, -32], yaw: 0.4, items: ['chest', 'chest', 'crate', 'chest', 'crate'], cols: 3, gap: 1.5, colors: { crate: '#b89a6a' }, solid: true },
    { kind: 'awning', at: [-25, 12], yaw: Math.PI, w: 6, d: 4, h: 3, color: SH2_COL.sail, pole: '#7a6a52', under: { items: ['crate', 'basket', 'crate', 'basket'], cols: 2, colors: { crate: '#a8865a', basket: '#c8a46a', goods: '#8aa060' } } },
  ],
  traffic: [{ model: 'hopper', colors: { hull: SH2_COL.blue }, centre: [0, 0, 40], rx: 110, rz: 140, h: 24, speed: 9 }],
  sights: [{ name: 'the Salt Quay’s mast crane', at: [-27, 46] }],
  staff: [],   // (Hesper keeps the harbour book: she is the harbourmaster already)
};

// ------------------------------------------------------------------ the City Behind the Waterfall: the Falls Ledge
// The ship on the stone shelf outside the cavern's east mouth (140, 0, 2), its hatch west into the cavern, its nose north
// toward the mountain. The sheet: a wet carved shelf, a docking niche cut into the cliff (the level builds it: waterfall.js
// NICHE) with a gantry bolted over its arch and a crate on its cable, crates on its loading dock and at its foot, puddles
// and moss on the stone, two couriers parked side by side, more flying out through the slits in the falls (issue #447).
const WF_COL = { stone: '#9aa4a0', pale: '#e8e2d0', gantry: '#c8b878', moss: '#7a9a5a', stripe: '#d8843c', wet: '#c6dad8' };
const WF_NICHE = { x: 140, face: -56, dock: 1.2 };   // (waterfall.js NICHE: the arch's middle, the frame's face, the dock's top)
export const WATERFALL_PORT = {
  id: 'waterfall',
  site: { x: 140, y: 0, z: 2, h: -Math.PI / 2 },
  pad: [
    { kind: 'dashes', r: 30, n: 30, w: 0.5, color: WF_COL.pale, gaps: [[28, 4, 7]] },
    // puddles on the shelf (inside the ring and outside it, never across it), moss at the cliff's foot and along the drop
    { kind: 'blots', color: WF_COL.wet, seed: 1, xz: [[120, -14, 2.2], [104, -40, 3.4], [160, -34, 2.2], [128, 20, 1.8], [154, 40, 3.0], [100, 14, 2.0], [178, 12, 2.8], [150, -46, 1.6], [128, -44, 1.3]] },
    { kind: 'blots', color: WF_COL.moss, lift: 1.5, seed: 4, xz: [[117, -52.5, 1.8], [164, -52, 2.2], [190, -68, 2.6], [88, -66, 2.4], [120, 66, 3.4], [150, 67, 2.6], [182, 64, 3.2], [207, 40, 2.4], [207, -20, 2.8], [76, 64, 2.2]] },
  ],
  pieces: [
    { kind: 'gantry', xz: [WF_NICHE.x + 13, WF_NICHE.face], dy: 22, yaw: 0, reach: 11, drop: 9.5, color: WF_COL.gantry, dark: '#6a6a5a', cab: '#a89858', loadColor: '#a89070', lamp: '#ffe0a0' },
    { kind: 'cargo', xz: [WF_NICHE.x - 4.5, -69.5], dy: WF_NICHE.dock, yaw: 0.1, items: ['crate', 'crate', 'cask', 'crate', 'crate', 'cask'], cols: 3, stack: true, colors: { crate: '#a89070', cask: '#7a8a8a' }, solid: true },
    { kind: 'cargo', xz: [WF_NICHE.x + 5, -70], dy: WF_NICHE.dock, yaw: -0.15, items: ['crate', 'cask', 'crate'], cols: 3, colors: { crate: '#b09878', cask: '#7a8a8a' }, solid: true },
    { kind: 'cargo', xz: [126, -50], yaw: 0.2, items: ['crate', 'crate', 'crate', 'cask', 'crate'], cols: 3, stack: true, colors: { crate: '#a89070', cask: '#7a8a8a' }, solid: true },
    { kind: 'craft', at: [-22, -8], yaw: 1.4, model: 'dart', colors: { hull: WF_COL.pale, stripe: WF_COL.stripe, fin: '#4a6a9a' } },
    { kind: 'craft', at: [-24, 6], yaw: 1.7, model: 'dart', colors: { hull: WF_COL.pale, stripe: '#4a6a9a', fin: WF_COL.stripe } },
    { kind: 'awning', at: [-20, 28], yaw: Math.PI, w: 5, d: 3.6, h: 2.8, color: '#c8b890', pole: '#5a5048', under: { items: ['crate', 'cask', 'crate'], cols: 3, colors: { crate: '#a89070', cask: '#7a8a8a' } } },
  ],
  traffic: [
    { model: 'dart', colors: { hull: WF_COL.pale, stripe: WF_COL.stripe, fin: '#4a6a9a' }, centre: [180, 0, 2], rx: 110, rz: 140, h: 30, speed: 18 },
    { model: 'dart', colors: { hull: WF_COL.pale, stripe: '#4a6a9a', fin: WF_COL.stripe }, centre: [200, 0, -20], rx: 140, rz: 100, h: 18, speed: 20, dir: -1, phase: 2.5 },
  ],
  sights: [{ name: 'the ledge’s niche', xz: [WF_NICHE.x, WF_NICHE.face] }],
  staff: [{ id: 'tully', name: 'Tully', title: 'who keeps the ledge', color: '#c8b878', kind: 'm', uv: [6, -51], y: 0, radius: 2, lang: 'waterfall',
    lines: ['~neutral~ Mind the wet. The spray comes in sideways when the wind turns.', '~playful~ The couriers fly out through the gaps in the falls. Mostly through the gaps.'] }],
};

// ------------------------------------------------------------------ the Buried Machine: the freight stage
// The ship at the stokers' town (-3, 6.3, 101.5); Wen by the great dome 65 m off. A town of stokers, not a city of
// travellers: the sheet's loading stage, a rust-orange lattice crane with an ore bucket, drums of oil, crates, a box
// freighter and an ore hopper on legs.
const BM_COL = { rust: '#c06a2a', iron: '#6a5a4a', drum: '#3a3a3e', crate: '#b8783a', hull: '#b0aaa0' };
export const BURIED_PORT = {
  id: 'buried',
  site: { x: -3, y: 6.29, z: 101.5, h: -2.662 },
  pad: [
    { kind: 'rect', at: [2, 4], len: 62, wid: 30, w: 0.6, color: BM_COL.rust },
  ],
  pieces: [
    { kind: 'crane', at: [-21, 22], yaw: Math.PI, h: 15, lattice: true, w: 1.8, reach: 12, color: BM_COL.rust, cab: '#a85a24', dark: BM_COL.iron, load: 'bucket', loadColor: '#a8682e', drop: 7, lamp: '#ffc070', solid: true },
    { kind: 'cargo', at: [17, 36], yaw: 0.3, items: ['barrel', 'barrel', 'barrel', 'barrel', 'barrel', 'barrel'], cols: 3, gap: 0.95, colors: { barrel: BM_COL.drum, band: '#7a7a7a' }, solid: true },
    { kind: 'cargo', at: [-19, 38], yaw: -0.2, items: ['crate', 'crate', 'crate', 'crate'], cols: 2, gap: 1.5, stack: true, colors: { crate: BM_COL.crate, band: BM_COL.iron }, solid: true },
    { kind: 'craft', at: [-19, -10], yaw: 1.6, model: 'orecart', colors: { bucket: '#b8783a' } },
    { kind: 'craft', at: [-22, -34], yaw: Math.PI / 2 + 0.3, model: 'hauler', colors: { hull: BM_COL.hull, trim: '#7a6a5a', fin: '#9a8a7a' } },
  ],
  traffic: [],
  sights: [{ name: 'the freight stage’s crane', at: [-21, 22] }],
  staff: [{ id: 'dace', name: 'Dace', title: 'who loads the freight', color: '#c06a2a', kind: 'm', uv: [28, 22], y: 6.3, radius: 2, lang: 'buried',
    lines: ['~tired~ Oil out, teeth out. Nothing comes in but ships like yours.', '~neutral~ Stand clear of the bucket. It drops when it likes.'] }],
};

// (the staff stand 15 m and more clear of the hull's plan and its legs, as the site search keeps the ship from anyone:
// src/ship/sites.js siteAvoid, tests/ship.test.js)

/** Every city's port, by world id. */
export const PORTS = {
  spacecity: SPACECITY_PORT, incal: INCAL_PORT, bazaar: BAZAAR_PORT, underwater: UNDERWATER_PORT, glassdunes: GLASSDUNES_PORT,
  eclipse: ECLIPSE_PORT, saltharbour: SALTHARBOUR_PORT, waterfall: WATERFALL_PORT, buried: BURIED_PORT,
};

/** A point of a port's hull frame in the world ([x, z]). */
export function portAt(port, [u, v]) {
  const { x, z, h } = port.site;
  return [x + Math.sin(h) * u + Math.cos(h) * v, z + Math.cos(h) * u - Math.sin(h) * v];
}
// (the staff placed in the hull's frame, `uv`, stand at their world point)
for (const port of Object.values(PORTS)) for (const s of port.staff ?? []) if (s.uv) { s.at = portAt(port, s.uv); delete s.uv; }
