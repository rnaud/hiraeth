import * as THREE from 'three';
import { createNoise2D, fbm, mulberry32, smoothstep } from '../noise.js';
import { makeMaterial, MODE_TERRAIN } from '../materials.js';
import { Terrain } from '../world.js';
import { stepped } from '../load-steps.js';
import { RoomKit } from './lab-kit.js';
import { mergeWithMaterials, restKey } from '../vertex-material.js';
import { PEOPLE as BURIED_PEOPLE } from '../story/buried-data.js';
import { PEOPLE as SPHERES_PEOPLE } from '../story/spheres-data.js';
import {
  moon, courtyard, lipFloor, bowl, cradle, hangRig, pillar, roof, gantry, house, tree, jibCrane, pourStream, beam, bar, moveParts,
  MF_LOOK, MF_DAY, MF_DUSK, MF_NIGHT, MF_TONES,
} from './moon-foundry-kit.js';
import { trussStair, lathe } from './antennas-kit.js';

// ---------------------------------------------------------------------------
// The Moon Foundry (?level=moonfoundry): an abandoned monumental workshop where miniature moons were made, after its
// reference sheets (references/The Moon Foundry/; its views in the References, reference-moonfoundry.js; the shapes in
// moon-foundry-kit.js; docs/systems/worlds.md "The Moon Foundry"). Off the route: no story to follow, a few people.
//
//   the apron      the ship lands on the open ground south of the hangar's mouth
//   the hangar     a vast roof on rust pillars, open on every side (HALL), the floor in great slabs, rails in it
//   the aisle      north from the mouth between the workstations, a gantry's stair at its side
//   the hung moon  a moon hung from the roof by its crown (HUNG); a second further back (HUNG2)
//   the cradle     a cratered moon in an orange cradle's claws (CRADLE)
//   the furnace    the last warm furnace (FURNACE): its glowing mouth, a ladle pouring molten metal into a small mould
//   the quarter    the workers' homes made in the old machinery, west of the aisle (QUARTER)
//   the gantry     a railed walkway 11 m up from the aisle's stair north to the broken moon, a branch to the bowl
//   the courtyard  the great moon broken open like an eggshell (COURT): a little inhabited courtyard in it, its houses,
//                  trees, a terrace and its stair; the gantry comes in over its lip
//   the bowl       the lower half of a shell in its cradle, a garden and two houses on its deck (BOWL)
//   the pillar moon a moon set on top of a tall pillar, a lookout house below it (PMOON)
//   beyond         more moons in their cradles and on their cranes far off in the haze, drawn only
//
// Solid as drawn where it can be walked or touched: the floor, the pillars and their ladders, the cradles, the moons,
// the houses, the machinery dressing on them, the gantries' decks, rails and legs, the stairs, the courtyard and the
// bowl's deck, the furnace. Drawn only: the roof (out of reach), the cables, the trusses' web, the trees, the pour.
// ---------------------------------------------------------------------------

const T = MF_TONES;
export const HALL = { x0: -170, x1: 170, z0: -292, z1: 46, roof: 88 };
export const SHIP = { x: 0, z: 120 };
export const MOUTH = 46;
export const COURT = { x: 0, z: -190, R: 30, yc: 32, yaw: 0.25, angle: 0.85, thick: 0.8 };
/** The broken moon's hole (toward the mouth, a little east) and its courtyard's floor, just over the lip. */
export const COURT_DIR = new THREE.Vector3(Math.sin(COURT.yaw), 0.05, Math.cos(COURT.yaw)).normalize();
export const COURT_Y = COURT.yc + lipFloor(COURT.R - COURT.thick, COURT_DIR, COURT.angle);
/** The gantry's deck: at the courtyard's floor, so it walks straight in; the stair up to it from the aisle. */
export const G = COURT_Y;
export const STAIR = { x: 14, z0: 18 };   // (its foot at z0 on the floor, its top G / 0.62 m further north)
export const HUNG = { x: -52, z: -40, R: 19, y: 50 };
export const HUNG2 = { x: -116, z: -226, R: 22, y: 56 };
export const CRADLE = { x: 64, z: -92, R: 20, yc: 22.5 };
export const BOWL = { x: -88, z: -150, R: 16, cut: 0.22 };
export const PMOON = { x: 108, z: -210, R: 12, h: 40 };
export const FURNACE = { x: 70, z: -14, r: 6.5, h: 9 };
export const QUARTER = { x: -102, z: -46, r: 26 };
export const LIMIT = 330;

const noise = createNoise2D(91101), noiseB = createNoise2D(91102);
/** The ground: the hangar's floor level, the apron, the plain outside rolling gently up into low hills far off. */
export function height(x, z) {
  const out = Math.max(HALL.x0 - 30 - x, x - HALL.x1 - 30, HALL.z0 - 30 - z, z - (SHIP.z + 60), 0);
  let h = smoothstep(0, 120, out) * (fbm(noise, x * 0.006, z * 0.006, 3) * 2.5 + 1.2);
  const e = Math.hypot(x, (z + 120) * 0.9);
  h += smoothstep(520, 760, e) * (14 + fbm(noiseB, x * 0.004, z * 0.004, 3) * 12);
  return h;
}

/** Where the gantry goes: [x, y, z] points of its deck (the main way, then the branch to the bowl). */
function gantryWays(court, bowlDeck) {
  const sx = STAIR.x, top = STAIR.z0 - G / 0.62;   // (the stair's top on the deck)
  const lip = court.lip, side = court.side;
  const main = [[sx, G, top], [sx, G, -96], [lip.x + side.x * 26, G, lip.z + side.z * 26], [lip.x + side.x * 0.5, G, lip.z + side.z * 0.5]];
  const b = bowlDeck, fork = [sx, G, -128];
  const branch = [fork, [b.x + b.rim + 10, G, -128], [b.x + b.rim - 0.6, G, b.z]];
  return { main, branch, top };
}

/** The gantry's ways, laid out (pure: the pillars keep clear of them, the tests walk them). */
const HOR = new THREE.Vector3(COURT_DIR.x, 0, COURT_DIR.z).normalize();
export const WAYS = gantryWays({ lip: new THREE.Vector3(COURT.x + HOR.x * (COURT.R + 0.6), COURT_Y, COURT.z + HOR.z * (COURT.R + 0.6)), side: HOR }, { x: BOWL.x, z: BOWL.z, rim: Math.sqrt(BOWL.R ** 2 - (BOWL.R * BOWL.cut) ** 2) });
/** How near (m) a point is to a way ([x, y, z] points). */
function nearWay(pts, x, z) {
  let best = Infinity;
  for (let i = 1; i < pts.length; i++) {
    const [ax, , az] = pts[i - 1], [bx, , bz] = pts[i], dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / L2));
    best = Math.min(best, Math.hypot(x - ax - dx * t, z - az - dz * t));
  }
  return best;
}

// ------------------------------------------------------------------ content: a few people from elsewhere and the foundry's own
export const MOONFOUNDRY_CONTENT = {
  weather: [],
  story: {
    title: 'THE MOON FOUNDRY',
    intro: 'A workshop for making moons, left unfinished. The moons still hang where the cranes stopped. People live in the old machinery now, and one furnace is still warm.',
    outro: 'From the gantry the whole floor shows: moons on their hooks, moons in their claws, one broken open with a street inside it. Nobody finished them. Nobody minds.',
    label: 'the courtyard in the broken moon', goal: [COURT.x, 'ground', COURT.z], radius: 8, manual: true,   // (no beacon: nothing to do here but look)
  },
  relics: { spots: [], names: [] },
  npcs: [
    // Dun of the Buried Machine, at the last furnace; Wen, counting moons from the courtyard; Emrys of the Garden of Spheres on the bowl
    { ...BURIED_PEOPLE.dun, at: [FURNACE.x - 9, FURNACE.z + 6], radius: 1.5, world: 'buried', lang: 'buried',
      lines: ['~happy~ One furnace still breathing. I came to see a chimney that works.', '~neutral~ Stand back from the pour. It spits.'],
      talk: { listen: [
        '~neutral~ Dun. I keep the domes breathing, under the sand. I heard there was a chimney here that never went out, and I had to see it.',
        '~curious~ They keep this one lit for the warmth. Nobody pours a moon any more. They pour door handles and soup pots and the odd bell.',
        '~playful~ The ladle tips by itself every so often. I asked who works it. Everyone pointed at someone else.',
        { after: 'met.dun', say: '~happy~ Still warm. Mind your eyebrows.' },
      ] } },
    { ...BURIED_PEOPLE.wen, at: [COURT.x + COURT_DIR.x * 8 + 3, COURT.z + COURT_DIR.z * 8], y: COURT_Y + 0.05, radius: 1.5, world: 'buried', lang: 'buried',
      lines: ['~happy~ Thirty-one moons on the floor. I counted twice.', '~neutral~ This one cracked in the casting, they say. Good thing, too: it makes a lovely street.'],
      talk: { listen: [
        '~happy~ Wen, who counts the teeth. I count moons now, on holiday. Thirty-one, not counting the far ones.',
        '~curious~ Nobody knows who the moons were for. Somebody’s sky, somewhere, waiting for them.',
        '~whisper~ At night the hung ones turn a little on their hooks. Very slowly. Like they are looking for where they should go.',
      ] } },
    { ...SPHERES_PEOPLE.ivo, at: [BOWL.x + 4, BOWL.z + 3], y: G + 0.05, radius: 1.5, world: 'spheres', lang: 'spheres',
      lines: ['~curious~ Our spheres grow. These were built. I can’t decide which is stranger.', '~happy~ You can see the whole floor from up here.'],
      talk: { listen: [
        '~curious~ Emrys, from the Garden of Spheres. I climb the white hill at home. Here I climb gantries.',
        '~playful~ They planted a garden in half a moon. At home we would call that a very good idea that took too long.',
        '~neutral~ Follow the walkway north and it goes straight into the broken one. There’s a whole street in there.',
      ] } },
    // the foundry's own folk
    { at: [QUARTER.x + 6, QUARTER.z + 4], radius: 3, lang: 'buried', lines: ['~happy~ We live in the old machines. They keep the rain off and they hum at night.', '~neutral~ That drum was a polishing wheel once. Now it is my kitchen.'] },
    { at: [QUARTER.x - 8, QUARTER.z - 6], radius: 2, lang: 'buried', lines: ['~curious~ You came in from the apron? Most people come by the rails.', '~tired~ Sweeping a floor this size is not a job. It is a way of life.'] },
    { at: [CRADLE.x - 20, CRADLE.z + 10], radius: 3, lang: 'buried', lines: ['~solemn~ The claws still hold. Nobody has told them to let go.', '~playful~ My grandmother polished that moon. One crater a day. She got to nine.'] },
    { at: [10, 30], radius: 2, lang: 'buried', lines: ['~neutral~ Mind the rails on the floor. Nothing runs on them, but they trip you.', '~surprised~ A ship on the apron! We usually only get pigeons and inspectors.'] },
    { at: [FURNACE.x + 4, FURNACE.z + 12], radius: 2, lang: 'buried', lines: ['~happy~ Warm your hands. The furnace does not mind.', '~whisper~ If you listen at the mouth you can hear it talking to itself.'] },
  ],
};

/** The level's colours: a pale blue-mint day, a peach dusk, an indigo night where the homes and the furnace glow. */
export const MOONFOUNDRY_SKY = { day: MF_DAY, dusk: MF_DUSK, night: MF_NIGHT };

// ------------------------------------------------------------------ building
const SOLID = { solid: true, shadow: true }, SOLID_NS = { solid: true, shadow: false }, LOOSE = { solid: false, shadow: true }, LOOSE_NS = { solid: false, shadow: false };
/** The world in cells, each its own kit (its own meshes, so the camera's frustum culls them). */
const CELL = 115;
/** The least width (px) a thin bar is drawn (materials.js S_THIN). */
export const THIN = 1.5;

// (built in steps, src/load-steps.js: the game's load gives the main thread back between them)
export function* buildMoonFoundry(scene) {
  const rng = mulberry32(91100), R = (a, b) => a + rng() * (b - a);
  const terrain = yield* Terrain.make({
    size: 1700, seg: 200, height,   // (8.5 m: the hangar's floor is flat; the plain outside is gentle)
    material: { color: T.floor, color2: T.floor2, color3: T.floor3, mode: MODE_TERRAIN, hatch: 0.15 },
  });
  scene.add(terrain.mesh);
  const H = (x, z) => terrain.heightAt(x, z);
  const root = new THREE.Group();
  root.name = 'The Moon Foundry';
  scene.add(root);

  // ---- the kits by cell, and the materials
  const kits = new Map(), opts = new Map(), lights = [], noShadow = [];
  const kitAt = (x, z) => {
    const k = `${Math.floor(x / CELL)},${Math.floor(z / CELL)}`;
    if (!kits.has(k)) {
      const group = new THREE.Group(); group.name = `cell ${k}`; root.add(group);
      kits.set(k, { kit: new RoomKit({ group, ground: terrain, centre: new THREE.Vector3(), seed: 91100 + kits.size }), vm: new Map() });
    }
    return kits.get(k);
  };
  const first = kitAt(0, 0).kit;
  const mat = (o) => { const m = first.mat(o); opts.set(m, o); return m; };
  const DS = THREE.DoubleSide;
  // two surfaces drawn by tone (vertex-material.js): the moons' ivory and the machinery's and homes' oranges
  const IVORY = { shade: 0.42, hatch: 0.25, line: 0.85 }, METAL = { shade: 0.38, hatch: 0.38, detail: 'built', detailDensity: 0.4 };
  const M = {
    ivory: Object.fromEntries(['ivory', 'ivory2', 'crater', 'edge', 'wall3'].map((k) => [k, mat({ color: T[k], ...IVORY })])),
    metal: Object.fromEntries(['rust', 'rust2', 'rust3', 'wall', 'wall2', 'roofing'].map((k) => [k, mat({ color: T[k], ...METAL })])),
    inner: mat({ color: T.inner, shade: 0.2, hatch: 0.6, side: DS }),
    plated: mat({ color: T.plated, shade: 0.4, hatch: 0.3, plates: 2.4 }),
    dark: mat({ color: T.dark, shade: 0.3, hatch: 0.3, side: DS }),
    gDark: mat({ color: T.dark, shade: 0.3, hatch: 0.3 }),
    steel: mat({ color: T.steel, shade: 0.5, hatch: 0.3 }),
    ceiling: mat({ color: T.ceiling, shade: 0.5, hatch: 0.2, grid: 2.4, side: DS }),
    strut: mat({ color: T.strut, flat: true, thin: THIN }),
    rail: mat({ color: T.strut, flat: true, thin: THIN }),
    plank: mat({ color: T.plank, flat: true }),
    glow: mat({ color: T.glow, glow: 0.62, flat: true, side: DS }),
    lamp: mat({ color: '#ffe2a0', glow: 0.95, flat: true }),
    hot: mat({ color: T.molten2, glow: 0.9, flat: true, side: DS }),
    leaf: [mat({ color: T.leaf, pattern: 'leaves', hatch: 1.1, shade: 0.5, spot: 0, line: 0.7, lineTint: 0.6 }), mat({ color: T.leaf2, pattern: 'leaves', hatch: 1.1, shade: 0.5, spot: 0, line: 0.7, lineTint: 0.6 })],
    trunk: mat({ color: T.trunk, flat: true, thin: THIN }),
    floor: mat({ color: T.floor, shade: 0.4, hatch: 0.15, grid: 9 }),   // (the slabs: no terrain ink, no pebbles: the sheets' floor is clean)
    line: mat({ color: '#9a8f7c', flat: true }),
  };
  const FLORA = new Set([...M.leaf, M.trunk]);
  // a merged-by-tone surface: kept per cell and solid flag, merged at the end with its material values per vertex
  const addVM = (cell, m, g, solid, shadow = true) => {
    const k = `${restKey(m)}|${solid ? 1 : 0}|${shadow ? 1 : 0}`;
    if (!cell.vm.has(k)) cell.vm.set(k, { solid, shadow, items: [] });
    if (!g.attributes.normal) g.computeVertexNormals();
    const n = g.index ? g.toNonIndexed() : g;
    for (const a of Object.keys(n.attributes)) if (a !== 'position' && a !== 'normal') n.deleteAttribute(a);
    cell.vm.get(k).items.push({ geometry: n, x: 0, y: 0, z: 0, rotY: 0, material: m });
  };
  /**
   * A builder's parts (world space) added by role into the cell at (x, z). tones: { shell, crater, rust, rust2, wall, … }
   * a tone name for a role drawn by tone; solid: whether its structure is walked against (dressing, trees, glow, struts never).
   */
  const put = (x, z, parts, { solid = true, shadow = true, tones = {}, inner = M.inner } = {}) => {
    const C = kitAt(x, z), k = C.kit;
    for (const [role, list] of Object.entries(parts)) {
      if (!Array.isArray(list) || !list[0]?.isBufferGeometry) continue;
      for (const g of list) {
        if (!g?.isBufferGeometry) continue;
        switch (role) {
          case 'shell': case 'crater': case 'edge': case 'floor': addVM(C, M.ivory[tones[role] ?? { shell: 'ivory', crater: 'crater', edge: 'edge', floor: 'wall3' }[role]], g, solid, shadow); break;
          case 'rust': case 'rust2': case 'wall': case 'wall2': case 'roofing': addVM(C, M.metal[tones[role] ?? role], g, solid, shadow); break;
          case 'inner': k.add(inner, g, { solid, shadow: false }); break;
          case 'dark': k.add(M.dark, g, { solid, shadow }); break;
          case 'steel': k.add(M.steel, g, { solid, shadow }); break;
          case 'ceiling': k.add(M.ceiling, g, LOOSE_NS); break;
          case 'strut': k.add(M.strut, g, LOOSE_NS); break;
          case 'rail': k.add(M.rail, g, { solid, shadow: false }); break;
          case 'plank': k.add(M.plank, g, { solid, shadow }); break;
          case 'glow': k.add(M.glow, g, LOOSE_NS); break;
          case 'leaf': k.add(M.leaf[(Math.round(g.attributes.position.getX(0)) & 1)], g, LOOSE_NS); break;
          case 'trunk': k.add(M.trunk, g, LOOSE_NS); break;
          // (the machinery dressing: solid as drawn where its face is, so a climber goes up over it, not into it)
          case 'gMetal': addVM(C, M.metal.rust3, g, solid, false); break;
          case 'gDark': k.add(M.gDark, g, { solid, shadow: false }); break;
          case 'gPale': addVM(C, M.metal.rust2, g, solid, false); break;
          default: break;
        }
      }
    }
  };
  const lamp = (x, y, z, r) => lights.push(new THREE.Vector4(x, y, z, r));
  const V = (x, y, z) => new THREE.Vector3(x, y, z);

  // ---------------------------------------------------------------- the floor: slabs drawn over the hangar's level ground, the aisle's lines, the rails
  yield;
  for (let x = HALL.x0; x < HALL.x1; x += CELL / 2) for (let z = HALL.z0; z < HALL.z1 + 20; z += CELL / 2) {
    const w = Math.min(CELL / 2, HALL.x1 - x), d = Math.min(CELL / 2, HALL.z1 + 20 - z);
    kitAt(x + w / 2, z + d / 2).kit.add(M.floor, new THREE.PlaneGeometry(w, d, 2, 2).rotateX(-Math.PI / 2).translate(x + w / 2, 0.025, z + d / 2), LOOSE_NS);
  }
  // the aisle's painted edges, and rails in the floor running north from the mouth
  for (const x of [-11, 11]) kitAt(x, 0).kit.add(M.line, new THREE.PlaneGeometry(0.35, MOUTH + 120).rotateX(-Math.PI / 2).translate(x, 0.04, MOUTH - (MOUTH + 120) / 2), LOOSE_NS);
  for (const [x, z0, z1] of [[-30, MOUTH + 30, -150], [-27.6, MOUTH + 30, -150], [36, MOUTH + 30, -60], [38.4, MOUTH + 30, -60], [-60, -100, -280], [-57.6, -100, -280]]) {
    for (let z = z0; z > z1; z -= 60) { const L = Math.min(60, z - z1); kitAt(x, z - L / 2).kit.add(M.steel, new THREE.BoxGeometry(0.14, 0.08, L).translate(x, 0.04, z - L / 2), LOOSE_NS); }
  }

  // ---------------------------------------------------------------- the roof: girders and its dark ceiling, by cell; the pillars holding it
  yield;
  for (let x = HALL.x0; x < HALL.x1 - 1; x += 85) for (let z = HALL.z0; z < HALL.z1 - 1; z += 84.5) {
    const P = roof({ x0: x, x1: x + 85, z0: z, z1: z + 84.5, y: HALL.roof, bay: 21.25, depth: 3.6, web: 4, cables: 7, seed: x * 3 + z, detail: 0.8 });
    put(x + 42, z + 42, P, { solid: false, shadow: false });
    yield;
  }
  // (the roof's front: a deep fascia girder over the mouth)
  put(0, MOUTH, { steel: [beam(V(HALL.x0, HALL.roof - 1.6, MOUTH), V(HALL.x1, HALL.roof - 1.6, MOUTH), 1.2, 4.5)] }, { solid: false, shadow: false });
  const stations = [HUNG, CRADLE, { x: COURT.x, z: COURT.z, R: COURT.R + 8 }, { x: BOWL.x, z: BOWL.z, R: BOWL.R + 6 }, { x: PMOON.x, z: PMOON.z, R: 14 }, { x: FURNACE.x, z: FURNACE.z, R: 16 }, { x: QUARTER.x, z: QUARTER.z, R: QUARTER.r }, HUNG2];
  const pillars = [];
  for (const x of [-150, -100, -50, 50, 100, 150]) for (const z of [30, -50, -128, -206, -280]) {
    if (stations.some((s) => Math.hypot(s.x - x, s.z - z) < (s.R ?? 10) + 8) || (Math.abs(x) < 30 && z > -150) || nearWay(WAYS.main, x, z) < 8 || nearWay(WAYS.branch, x, z) < 8) continue;
    pillars.push([x, z]);
  }
  for (const [i, [x, z]] of pillars.entries()) {
    const P = pillar({ h: HALL.roof - 3.4, r: 2.6, seed: i + 1, detail: 0.7, pipes: 2 + (i % 3), platform: i % 3 ? 0 : 0.6, dressing: 0.8, rings: 6 });
    put(x, z, moveParts(P, (g) => g.translate(x, 0, z)), { tones: { rust: i % 4 ? 'rust' : 'rust3' } });
    if (i % 3 === 0) yield;
  }

  // ---------------------------------------------------------------- the hung moons: from the roof by their crowns
  yield;
  for (const [i, h] of [HUNG, HUNG2].entries()) {
    const P = moon({ R: h.R, seg: 56, craters: 38, seed: 31 + i, detail: 0.85 });
    put(h.x, h.z, moveParts(P, (g) => g.translate(h.x, h.y, h.z)), { tones: { shell: i ? 'ivory2' : 'ivory' } });
    put(h.x, h.z, moveParts(hangRig({ R: h.R, top: HALL.roof - 3.6 - h.y, cables: 2, seed: 7 + i, detail: 0.8 }), (g) => g.translate(h.x, h.y, h.z)));
  }

  // ---------------------------------------------------------------- the moon in its cradle's claws
  yield;
  {
    const c = CRADLE, P = moon({ R: c.R, seg: 56, craters: 60, seed: 41, detail: 0.85 });
    put(c.x, c.z, moveParts(P, (g) => g.translate(c.x, c.yc, c.z)));
    put(c.x, c.z, moveParts(cradle({ R: c.R, yc: c.yc, arms: 4, rot: 0.4, seed: 42, detail: 0.8 }), (g) => g.translate(c.x, 0, c.z)));
  }

  // ---------------------------------------------------------------- the broken moon and its courtyard (walked into from the gantry)
  yield;
  const C = COURT, cdir = COURT_DIR.clone(), thick = C.thick;
  const CM = moon({ R: C.R, seg: 72, craters: 70, seed: 51, cut: { dir: cdir, angle: C.angle, ragged: 0.2, thick, sill: 0.7 } });
  put(C.x, C.z, moveParts(CM, (g) => g.translate(C.x, C.yc, C.z)));
  const CY = courtyard({ R: C.R, thick, hole: CM.hole, toward: cdir, houses: 9, trees: 8, seed: 52, lit: 0.55, detail: 0.9 });
  put(C.x, C.z, moveParts(CY, (g) => g.translate(C.x, C.yc, C.z)));
  for (const w of CY.windows.slice(0, 6)) lamp(C.x + w[0], C.yc + w[1], C.z + w[2], 4);
  const courtY = C.yc + CY.fy;
  put(C.x, C.z, moveParts(cradle({ R: C.R, yc: C.yc, arms: 5, rot: 0.9, seed: 53, detail: 0.85, drum: 0.5, skip: [Math.atan2(cdir.z, cdir.x), C.angle * 0.9] }), (g) => g.translate(C.x, 0, C.z)));
  // the lip: where the gantry comes in, a threshold of planks over the shell's edge onto the courtyard's floor
  const hor = V(cdir.x, 0, cdir.z).normalize();
  const lip = V(C.x + hor.x * (CY.floorR - 0.4), courtY, C.z + hor.z * (CY.floorR - 0.4));
  const court = { lip: V(C.x + hor.x * (C.R + 0.6), courtY, C.z + hor.z * (C.R + 0.6)), side: hor };
  put(C.x, C.z, { plank: [beam(lip.clone().add(V(0, -0.15, 0)), court.lip.clone().add(hor.clone().multiplyScalar(1.2)).add(V(0, -0.15, 0)), 3.2, 0.3)] });
  if (G - courtY > 0.05 || courtY - G > 0.05) console.warn?.(`moon foundry: the courtyard floor is at ${courtY.toFixed(2)}, the gantry at ${G}`);

  // ---------------------------------------------------------------- the bowl in its cradle, its garden deck at the gantry's height
  yield;
  const B = BOWL, cutY = B.R * B.cut, by = G - cutY;   // (its deck level with its rim and the gantry)
  const BW = bowl({ R: B.R, cutY, seed: 61, houses: 2, trees: 4, lit: 0.5, detail: 0.85, below: 0 });
  put(B.x, B.z, moveParts(BW, (g) => g.translate(B.x, by, B.z)), { tones: {} });
  // (the bowl's shell plated: its own material)
  for (const g of BW.shell) kitAt(B.x, B.z).kit.add(M.plated, g, SOLID);
  BW.shell.length = 0;
  for (const w of BW.windows.slice(0, 3)) lamp(B.x + w[0], by + w[1], B.z + w[2], 4);
  put(B.x, B.z, moveParts(cradle({ R: B.R, yc: by, arms: 4, rot: 0.2, seed: 62, detail: 0.8, drum: 0.85 }), (g) => g.translate(B.x, 0, B.z)));
  const bowlDeck = { x: B.x, z: B.z, y: by + BW.deckY, rim: BW.rimR };

  // ---------------------------------------------------------------- the gantry: the stair up from the aisle, the way north, the branch to the bowl
  yield;
  const ways = WAYS;
  if (Math.abs(bowlDeck.rim - Math.hypot(ways.branch.at(-1)[0] - B.x, ways.branch.at(-1)[2] - B.z) - 0.6) > 0.05) console.warn?.('moon foundry: the branch misses the bowl\'s rim');
  {
    const sx = STAIR.x;
    const S = trussStair([sx, 0, STAIR.z0], [sx, G, ways.top], { w: 2, rise: 0.22 });
    put(sx, STAIR.z0, { plank: S.plank, rail: S.frame });
    // a landing at the stair's top
    put(sx, ways.top, { plank: [new THREE.BoxGeometry(3.6, 0.3, 3).translate(sx, G - 0.15, ways.top - 1.2)] });
    const fork = ways.branch[0];
    for (const [pts, o] of [[ways.main, { w: 3.2, gaps: [[fork[0] - 1.6, fork[2], 1.6]] }], [ways.branch.map((p, i) => (i ? p : [p[0] - 1.6, p[1], p[2]])), { w: 2.6 }]]) {
      const GQ = gantry(pts.map((p) => [...p]), { ground: H, span: 15, truss: 1.4, detail: 0.8, ...o });
      // (the legs never under the moon's lip: the last stretch hangs from the rest)
      const mid = pts[Math.floor(pts.length / 2)];
      put(mid[0], mid[2], GQ);
      for (let i = 1; i < pts.length; i++) { const a = pts[i - 1], b = pts[i]; for (let t = 0.25; t < 1; t += 0.5) { const p = [a[0] + (b[0] - a[0]) * t, a[2] + (b[2] - a[2]) * t]; kitAt(p[0], p[1]).kit.add(M.lamp, new THREE.SphereGeometry(0.22, 8, 6).translate(p[0], G + 2.6, p[1]), LOOSE_NS); kitAt(p[0], p[1]).kit.add(M.strut, bar(V(p[0], G + 1.05, p[1]), V(p[0], G + 2.45, p[1]), 0.04, 0.04, 4), LOOSE_NS); lamp(p[0], G + 2.6, p[1], 7); } }
    }
  }

  // ---------------------------------------------------------------- the moon on its pillar, its lookout house
  yield;
  {
    const p = PMOON, P = pillar({ h: p.h, r: 3.2, seed: 71, detail: 0.8, platform: 0.78, pipes: 3, rings: 5 });
    put(p.x, p.z, moveParts(P, (g) => g.translate(p.x, 0, p.z)));
    put(p.x, p.z, moveParts(moon({ R: p.R, seg: 48, craters: 26, seed: 72, detail: 0.8 }), (g) => g.translate(p.x, p.h + p.R * 0.92, p.z)), { tones: { shell: 'ivory2' } });
    const Hh = house({ x: p.x, y: p.h * 0.78, z: p.z + 6.2, w: 4, d: 3, floors: 1, yaw: 0, seed: 73, lit: 0.6, pitched: true });
    put(p.x, p.z, Hh, { solid: false });
    for (const w of Hh.windows) lamp(...w, 3);
  }

  // ---------------------------------------------------------------- the last furnace: its drum, the glowing mouth, the ladle's pour into a mould
  yield;
  const F = FURNACE, pour = { stream: null, mould: null, phase: 0 };
  {
    const k = kitAt(F.x, F.z);
    put(F.x, F.z, { rust: [lathe([[F.r * 1.15, 0], [F.r * 1.1, 1], [F.r, 1.4], [F.r, F.h], [F.r * 0.55, F.h + 3.5], [1.4, F.h + 5], [1.4, F.h + 5.2]], 28).translate(F.x, 0, F.z)] }, { tones: { rust: 'rust3' } });
    put(F.x, F.z, { dark: [new THREE.CylinderGeometry(1.2, 1.2, HALL.roof - F.h - 8, 12, 1, true).translate(F.x, F.h + 5 + (HALL.roof - F.h - 8) / 2, F.z)] });
    // its mouth, toward the aisle (west): a glowing arch in a dark frame, the hot floor in front of it
    const ma = Math.PI, mx = F.x + Math.cos(ma) * (F.r + 0.05), mz = F.z + Math.sin(ma) * (F.r + 0.05);
    k.kit.add(M.hot, new THREE.PlaneGeometry(2.6, 2.4).rotateY(-Math.PI / 2).translate(mx - 0.02, 1.9, mz), LOOSE_NS);
    for (const [dy, dz, h, w] of [[3.3, 0, 0.5, 3.6], [1.9, 1.55, 3.3, 0.5], [1.9, -1.55, 3.3, 0.5]]) put(F.x, F.z, { dark: [new THREE.BoxGeometry(0.5, h, w).translate(mx - 0.15, dy, mz + dz)] });   // (the mouth's dark frame)
    k.kit.add(M.hot, new THREE.CircleGeometry(1.6, 18).rotateX(-Math.PI / 2).scale(1, 1, 0.6).translate(mx - 2.2, 0.05, mz), LOOSE_NS);
    lamp(mx - 1.5, 2, mz, 12);
    // the jib crane over the mould, the ladle on its hook, tipped; the pour falling from its lip into the mould
    // (west of the furnace, toward the aisle: the jib points south, the ladle hangs over the mould in front of the mouth)
    const jx = F.x - 17, jz = F.z - 2, jc = jibCrane({ h: 12, jib: 10, seed: 74, hook: 3.5, detail: 0.8 });
    put(jx, jz, moveParts(jc, (g) => g.rotateY(-Math.PI / 2).translate(jx, 0, jz)), { solid: false });
    put(jx, jz, { rust2: [new THREE.BoxGeometry(3.4, 1.2, 3.4).translate(jx, 0.6, jz)] });   // (its plinth: you walk round the mast's foot)
    const lx = jx, lz = jz + 8, ly = 6.2;
    // (tipped toward +x: its rim on that side comes down to the lip it pours from)
    const ladle = lathe([[0.2, -1.2], [1.3, -1.0], [1.6, 0], [1.7, 0.9], [1.5, 0.95]], 20).rotateZ(-0.5).translate(lx, ly, lz);
    put(lx, lz, { rust: [ladle] }, { solid: false, tones: { rust: 'rust3' } });
    // its rim and the bail it hangs by, from the rim's sides up to the hook
    put(lx, lz, { dark: [new THREE.TorusGeometry(1.6, 0.12, 5, 20).rotateX(Math.PI / 2).translate(0, 0.93, 0).rotateZ(-0.5).translate(lx, ly, lz), bar(V(lx, ly + 0.9, lz - 1.6), V(lx, ly + 2.3, lz), 0.07, 0.07, 5), bar(V(lx, ly + 0.9, lz + 1.6), V(lx, ly + 2.3, lz), 0.07, 0.07, 5)] }, { solid: false });
    k.kit.add(M.hot, new THREE.CircleGeometry(1.35, 16).rotateX(-Math.PI / 2).rotateZ(-0.5).translate(lx - 0.2, ly + 0.55, lz), LOOSE_NS);
    const lipX = lx + 1.8, lipY = ly + 0.05, drop = lipY - 2.65;
    const S = pourStream({ drop, r: 0.32, rings: 22 });
    const geo = new THREE.BufferGeometry().copy(mergeStream(S.segs));
    geo.translate(lipX, lipY, lz);
    const cols = new Float32Array(geo.attributes.position.count * 3).fill(1);
    geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    const stream = new THREE.Mesh(geo, makeMaterial({ color: '#ffffff', glow: 0.92, flat: true, vertexColors: true, spot: 0 }));
    stream.userData.noCollide = true; stream.name = 'the pour';
    scene.add(stream); noShadow.push(stream);
    pour.stream = stream; pour.step = S.step; pour.top = lipY;
    // the mould: a small new moon half sunk in the floor, its seam glowing where the metal goes in
    put(lipX, lz, { rust2: [new THREE.SphereGeometry(2.6, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.62).translate(lipX, 0, lz)] });
    k.kit.add(M.hot, new THREE.TorusGeometry(0.6, 0.14, 6, 16).rotateX(Math.PI / 2).translate(lipX, 2.62, lz), LOOSE_NS);
    lamp(lipX, 3.2, lz, 8);
    pour.mould = [lipX, lz];
    // crates and ingots about it
    for (const [dx, dz, s] of [[-10, -3, 1.1], [-11, -1.6, 0.8], [-9, 4, 0.9], [6, 9, 1.2], [7.6, 9.4, 0.8]]) put(F.x + dx, F.z + dz, { plank: [new THREE.BoxGeometry(s, s * 0.8, s).translate(F.x + dx, s * 0.4, F.z + dz)] });
  }

  // ---------------------------------------------------------------- the workers' quarter: homes in the old machinery
  yield;
  {
    const Q = QUARTER, homes = [];
    // a great old polishing drum lying on its side, made a home: windows and a door cut in it
    {
      const x = Q.x - 10, z = Q.z - 14, r = 5.2, L = 13;
      put(x, z, { rust2: [new THREE.CylinderGeometry(r, r, L, 26).rotateZ(Math.PI / 2).translate(x, r - 0.4, z)] }, { tones: { rust2: 'rust2' } });
      for (const e of [-1, 1]) put(x, z, { dark: [new THREE.CylinderGeometry(r * 1.06, r * 1.06, 0.5, 26).rotateZ(Math.PI / 2).translate(x + e * (L / 2 - 0.3), r - 0.4, z)] });
      const k = kitAt(x, z).kit;
      for (const dx of [-4, -1.5, 1.5, 4]) k.add(M.glow, new THREE.PlaneGeometry(1, 1.1).translate(x + dx, r - 0.4, z + r + 0.03), LOOSE_NS);
      k.add(M.dark, new THREE.PlaneGeometry(1.1, 2.1).translate(x, 1.05, z + Math.sqrt(r * r - (r - 1.45) ** 2) + 0.03), LOOSE_NS);
      lamp(x, r + 0.6, z + r + 1, 6);
      homes.push([x, z, 8]);
    }
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2 + 0.4, d = Q.r * (0.55 + (i % 2) * 0.3), x = Q.x + Math.cos(a) * d, z = Q.z + Math.sin(a) * d;
      if (homes.some(([hx, hz, hr]) => Math.hypot(hx - x, hz - z) < hr + 4)) continue;
      const yaw = Math.atan2(Q.x - x, Q.z - z);
      const Hh = house({ x, y: 0, z, w: R(4.2, 6.5), d: R(3.6, 5), floors: 1 + (i % 3 === 0 ? 1 : 0), yaw, seed: 80 + i, lit: 0.55, tone: i % 3 === 1 ? 1 : 0, pitched: i % 2 === 0 });
      put(x, z, Hh);
      for (const w of Hh.windows.slice(0, 2)) lamp(...w, 4);
      homes.push([x, z, 4]);
    }
    for (let i = 0; i < 9; i++) {
      const a = rng() * Math.PI * 2, d = R(4, Q.r * 0.95), x = Q.x + Math.cos(a) * d, z = Q.z + Math.sin(a) * d;
      if (homes.some(([hx, hz, hr]) => Math.hypot(hx - x, hz - z) < hr + 1.5)) continue;
      put(x, z, tree(x, 0, z, R(1.4, 2.4), 90 + i, 0.85));
    }
    // a lamp post in the little square, crates, a bench
    const k = kitAt(Q.x, Q.z).kit;
    put(Q.x, Q.z, { dark: [bar(V(Q.x, -0.2, Q.z), V(Q.x, 3.6, Q.z), 0.09, 0.07, 6)] });
    k.add(M.lamp, new THREE.SphereGeometry(0.3, 10, 8).translate(Q.x, 3.8, Q.z), LOOSE_NS);
    lamp(Q.x, 3.8, Q.z, 10);
    for (const [dx, dz, s] of [[3, -4, 0.9], [3.8, -3.2, 0.7], [-4, 3, 1]]) put(Q.x + dx, Q.z + dz, { plank: [new THREE.BoxGeometry(s, s * 0.8, s).translate(Q.x + dx, s * 0.4, Q.z + dz)] });
    put(Q.x, Q.z, { plank: [new THREE.BoxGeometry(2.4, 0.12, 0.8).translate(Q.x + 4, 0.45, Q.z + 3)] });
  }

  // ---------------------------------------------------------------- along the aisle: lamps on posts, crates, spare plates of shell lying about
  yield;
  for (let z = MOUTH - 6; z > -150; z -= 22) for (const s of [-1, 1]) {
    const x = s * 13;
    if (Math.abs(x - STAIR.x) < 3 && z < STAIR.z0 + 4 && z > ways.top - 4) continue;
    put(x, z, { dark: [bar(V(x, -0.2, z), V(x, 3.4, z), 0.07, 0.06, 6)] });
    kitAt(x, z).kit.add(M.lamp, new THREE.SphereGeometry(0.24, 8, 6).translate(x, 3.6, z), LOOSE_NS);
    lamp(x, 3.6, z, 8);
  }
  for (let i = 0; i < 26; i++) {
    const x = R(HALL.x0 + 10, HALL.x1 - 10), z = R(HALL.z0 + 10, MOUTH - 5);
    if (Math.abs(x) < 16 || stations.some((s) => Math.hypot(s.x - x, s.z - z) < (s.R ?? 10) + 4) || pillars.some(([px, pz]) => Math.hypot(px - x, pz - z) < 6)) continue;
    if (i % 3 === 0) {
      // a spare plate of shell: a piece of a moon lying on the floor, its curve up
      // (a fragment of a dome, convex side up: its rim on the floor)
      const Rs = R(14, 26), th = R(0.18, 0.3), g = new THREE.SphereGeometry(Rs, 14, 4, 0, R(0.6, 1.4), 0, th).translate(0, -Rs * Math.cos(th) - 0.05, 0).rotateY(rng() * 6.3);
      put(x, z, { shell: [g.translate(x, 0, z)] }, { tones: { shell: 'ivory2' } });
    } else for (let k = 0; k < 3; k++) { const s = R(0.8, 1.4); put(x, z, { plank: [new THREE.BoxGeometry(s, s * 0.8, s).rotateY(rng()).translate(x + k * 1.3, s * 0.4, z + (k % 2) * 0.9)] }); }
  }

  // ---------------------------------------------------------------- beyond the hangar: moons far off on their cradles and cranes (drawn only)
  yield;
  const far = [];
  {
    const spheres = [], stands = [], frng = mulberry32(91140);
    const cN = new THREE.Color(T.ivory3), cF = new THREE.Color('#e6e6da'), cR = new THREE.Color('#d9a07c'), cRF = new THREE.Color('#e2d4c6');
    const m4 = (x, y, z, sx, sy, sz) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion(), new THREE.Vector3(sx, sy, sz));
    for (let i = 0; i < 70; i++) {
      const a = frng() * Math.PI * 2, d = 380 + Math.pow(frng(), 0.7) * 520, x = Math.cos(a) * d, z = Math.sin(a) * d - 120;
      if (z > SHIP.z + 40 && Math.abs(x) < 300) continue;   // (the apron's side stays open: the way in)
      const k = smoothstep(380, 900, d), Rr = 10 + frng() * 34, g0 = H(x, z) - 0.5, hung = frng() < 0.4;
      const cy = g0 + (hung ? Rr * 1.6 + 10 : Rr * 1.08);
      spheres.push([m4(x, cy, z, Rr, Rr, Rr), cN.clone().lerp(cF, k)]);
      if (hung) stands.push([m4(x + Rr * 1.2, g0, z, 3 + Rr * 0.08, cy + Rr + 14 - g0, 3 + Rr * 0.08), cR.clone().lerp(cRF, k)]);
      else stands.push([m4(x, g0, z, Rr * 0.6, Rr * 0.3, Rr * 0.6), cR.clone().lerp(cRF, k)]);
      if (i % 3 === 0) stands.push([m4(x + (frng() - 0.5) * 80, g0, z + (frng() - 0.5) * 80, 2.6, 50 + frng() * 30, 2.6), cR.clone().lerp(cRF, k)]);
    }
    const farMat = makeMaterial({ color: '#ffffff', shade: 0.5, hatch: 0.15, line: 0.45, lineTint: 0.6 });
    const pole = new THREE.CylinderGeometry(1, 1, 1, 12).translate(0, 0.5, 0);
    for (const [geo, list, name] of [[new THREE.SphereGeometry(1, 28, 16), spheres, 'far moons'], [pole, stands, 'far stands']]) {
      geo.deleteAttribute('uv');
      const m = new THREE.InstancedMesh(geo, farMat, list.length);
      list.forEach(([mx, c], i) => { m.setMatrixAt(i, mx); m.setColorAt(i, c); });
      m.userData.noCollide = true; m.userData.floats = true; m.name = name;
      m.computeBoundingSphere();
      scene.add(m); noShadow.push(m); far.push(m);
    }
  }

  // ---------------------------------------------------------------- finishing: each cell's meshes, the tones merged per vertex
  yield;
  for (const Cc of kits.values()) {
    Cc.kit.finish();
    for (const m of Cc.kit.group.children) if (FLORA.has(m.material)) m.userData.flora = true;   // (walked through, as the flora is: contact-audit.js)
    noShadow.push(...Cc.kit.noShadow);
    lights.push(...Cc.kit.lights);
    for (const g of Cc.vm.values()) {
      const m = new THREE.Mesh(mergeWithMaterials(g.items), makeMaterial({ ...opts.get(g.items[0].material), perVertex: true }));
      if (!g.solid) m.userData.noCollide = true;
      if (!g.shadow) noShadow.push(m);
      m.name = `surfaces${g.solid ? ' (solid)' : ''}`;
      Cc.kit.group.add(m);
    }
    yield;
  }
  yield;

  const spawn = new THREE.Vector3(0, H(0, SHIP.z - 26) + 0.05, SHIP.z - 26);   // (clear of the ship's hull and ramp, the camera too)
  // the furnace's drone: strongest at its mouth, gone across the floor
  const humAt = (p) => 0.75 * smoothstep(34, 4, Math.hypot(p.x - F.x, p.z - F.z));
  // where a person stands: on the courtyard's floor, the bowl's deck, or the ground
  const placeAt = (p) => {
    if (Math.hypot(p.x - COURT.x, p.z - COURT.z) < COURT.R) return 'The courtyard in the broken moon';
    if (Math.hypot(p.x - BOWL.x, p.z - BOWL.z) < BOWL.R && p.y > G - 2) return 'The bowl garden';
    if (p.y > G - 2) return 'The gantry';
    if (Math.hypot(p.x - F.x, p.z - F.z) < 22) return 'The last furnace';
    if (Math.hypot(p.x - QUARTER.x, p.z - QUARTER.z) < QUARTER.r + 6) return 'The workers’ quarter';
    if (p.z > MOUTH) return 'The apron';
    return 'The Moon Foundry';
  };
  // the pour: its bands march down the stream (three hot tones, printed, not a light), slower by night it is all that glows
  const tones = [T.molten3, T.molten, T.molten2].map((c) => new THREE.Color(c));
  const updatePour = (t) => {
    const P = pour.stream.geometry.attributes.position, Cl = pour.stream.geometry.attributes.color, band = pour.step * 2.2;
    for (let i = 0; i < P.count; i++) {
      const y = pour.top - P.getY(i), k = Math.floor((y - t * 2.4) / band), c = tones[((k % 3) + 3) % 3];
      Cl.setXYZ(i, c.r, c.g, c.b);
    }
    Cl.needsUpdate = true;
  };
  return {
    id: 'moonfoundry',
    ground: terrain,
    collision: { strategy: 'SAH' },
    spawn,
    spawnHeading: Math.PI,
    camYaw: 0,
    limit: LIMIT,
    shipSite: { x: SHIP.x, z: SHIP.z, heading: Math.PI },   // (its ramp toward the hangar's mouth)
    features: { mount: false, wind: false, jetpack: false, climb: true },
    defaults: { hour: 10.5, preset: 'Moebius print', cloudShadows: 0, look: MF_LOOK },
    sky: { script: MOONFOUNDRY_SKY, planets: [{ az: 200, el: 34, size: 3.2, color: '#f2e6cc', craters: true }, { az: 120, el: 22, size: 1.1, color: '#e6dccb', craters: true }] },
    killY: -Infinity,
    lights,
    noShadow,
    reactions: false,   // (nothing grows on the floor: reactive-world.js)
    far,
    court: { x: COURT.x, z: COURT.z, y: courtY, floorR: CY.floorR, lip, terrace: CY.terrace }, bowlDeck, ways, pillars,
    life: {
      flocks: [{ count: 12, color: '#3a3438', size: 0.45, radius: 80, height: [30, 56], speed: 0.4, seed: 91 }],
      motes: { count: 60, color: '#fff2d6', size: 0.04, glow: 0.2, rise: 0.015, wind: [0.04, 0.01] },
    },
    atmo: (x, z, y) => ({ tint: [1, 1, 1], fog: 0.8, name: placeAt({ x, y: y ?? 0, z }) }),
    hum: humAt,
    crowdLines: [
      '~neutral~ Nothing runs on the rails any more. We walk on them, mostly.',
      '~happy~ Morning light comes in under the roof and the moons go pink. Best hour of the day.',
      '~curious~ Who were the moons for? Somebody ordered thirty-one of them and never came.',
      '~tired~ Up and down that stair all day. The view is the only wage.',
      '~playful~ I live in a crater. Well, beside one. It is a very good address.',
      '~whisper~ Don’t stand under the hung ones at night. They creak.',
      '~solemn~ My father poured the last full moon. It is the one in the claws, there.',
      '~neutral~ Mind the ladle, it tips when it likes.',
    ],
    crowdSpots() {
      const r = mulberry32(9191), VV = (x, y, z) => new THREE.Vector3(x, y, z), size = () => 2 + Math.floor(r() * 3);
      const groups = [], walks = [], edges = [];
      for (const x of [-6, 6]) walks.push({ path: [VV(x, 0, MOUTH + 20), VV(x, 0, -140)], n: 6, pair: 0.4 });
      walks.push({ path: ways.main.map((p) => VV(p[0], G, p[2])).slice(0, 3), n: 4, pair: 0.3 });
      walks.push({ path: Array.from({ length: 13 }, (_, i) => { const a = (i / 12) * Math.PI * 2; return VV(QUARTER.x + Math.cos(a) * 12, 0, QUARTER.z + Math.sin(a) * 12); }), n: 4, pair: 0.4, loop: true });
      walks.push({ path: [VV(-20, 0, 20), VV(-60, 0, -10), VV(-70, 0, -90), VV(-40, 0, -130)], n: 4, pair: 0.3 });
      walks.push({ path: [VV(24, 0, 30), VV(48, 0, 0), VV(36, 0, -50), VV(30, 0, -130)], n: 4, pair: 0.3 });
      for (let i = 0; i < 3; i++) groups.push({ at: VV(QUARTER.x + (r() - 0.5) * 14, 0, QUARTER.z + (r() - 0.5) * 14), n: size() });
      groups.push({ at: VV(FURNACE.x - 14, 0, FURNACE.z + 3), n: 3 });
      groups.push({ at: VV(COURT.x + hor.x * 4 - 3, courtY, COURT.z + hor.z * 4), n: 2 });
      groups.push({ at: VV(CRADLE.x - 22, 0, CRADLE.z + 2), n: 2 });
      for (let z = -20; z > -90; z -= 22) if (r() < 0.6) edges.push({ at: VV(STAIR.x - 1.5, G, z), heading: -Math.PI / 2, pose: 'rail' });
      for (const sp of [...groups, ...walks, ...edges]) sp.lines = this.crowdLines;
      return { groups, walks, edges, avoid: [], farMax: 220, costume: 'moonfoundry', palette: { cloaks: ['#d98c58', '#e8d2a8', '#9cc9b4', '#c9703e', '#7f93a3'] },
        clear: [{ x: spawn.x, z: spawn.z, r: 6 }, { x: SHIP.x, z: SHIP.z, r: 22 }] };
    },
    update(dt, t) {
      for (const Cc of kits.values()) for (const m of Cc.kit.movers) m(t);
      updatePour(t);
    },
  };
}
export const createMoonFoundry = stepped(buildMoonFoundry);

/** The pour's rings as one geometry (positions and normals, indexed rings unrolled). */
function mergeStream(list) {
  const pos = [], nrm = [];
  for (const g of list) {
    const n = g.index ? g.toNonIndexed() : g;
    if (!n.attributes.normal) n.computeVertexNormals();
    pos.push(...n.attributes.position.array); nrm.push(...n.attributes.normal.array);
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  return out;
}
