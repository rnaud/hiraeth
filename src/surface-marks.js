// Surface marks after the picked reference sheets (issue #669), one define each so a material without one pays nothing
// (materials.js surfaceFeatures), the very GLSL the web draws; scripts/unity-export/marks-hlsl.mjs turns it into the Unity
// port's Shaders/SurfaceMarks.hlsl (tests/surface-marks.test.js checks it is current). Paving has its own module
// (src/paving-shader.js). They read the surface shader's hash, hash2, vnoise, inkLine, pebbleField, uPixelRatio and uWearLite.
//
//   S_INTERIOR   (makeMaterial({ interior })) references/surfaces/interiors/sheet-1.jpg: a shop's or a room's floor of hand-laid
//            tiles (grout a little uneven, a few tiles of another pastel), its walls painted plaster with soft repainted
//            patches over a darker dado band and a tiled skirting. In the room's own frame (src/interiors.js buildRoom:
//            floor at y = 0), so the bands sit at their heights.
//   S_SHEET  (makeMaterial({ sheet })) references/surfaces/industrial-walls/sheet-1.jpg: painted sheet-metal walls, panels
//            in courses with rows of rivets along the seams, repainted panels of another colour, thin rust streaks run
//            down from rivets.
//   S_TIMBER (makeMaterial({ timber })) references/surfaces/timber/sheet-1.jpg: worked timber, planks (or a solid post),
//            grain strokes along them, knots, nail holes, each plank its tone, now and then one painted and flaking,
//            sun-bleached tops and darker undersides.
//   S_GROUNDMID (makeMaterial({ groundMid }), on terrain) references/surfaces/open-ground/sheet-1.jpg: the ground ink's
//            middle distance (ground-ink.js draws the near): broad soft patches of another tone, a few long pen lines
//            along the fall of the slopes, and stones that still read 20–200 m off.
// Part 2 (issue #677), the same way:
//   S_SEAWALL (makeMaterial({ seaWall })) references/surfaces/sea-walls/sheet-1.jpg: the Underwater City's render, white salt
//            bloom at the foot and under ledges, a few tide lines a shade darker, green growth stains and barnacle dots in
//            the shaded foot, repaired patches of a fresher pink. In the world's frame (the foot a world height).
//   S_PALESTONE (paleStone) references/surfaces/pale-stone/sheet-1.jpg: large soft-edged blocks in courses, each its tone,
//            now and then a warmer one, worn round arrises, rain streaks hanging from a course's top, a darker damp band at
//            the foot, hairline cracks and pits near.
//   S_BURIED (buriedCity) references/surfaces/buried-city/sheet-1.jpg: the Glass Dunes' sandstone, banded and scoured by
//            the wind (soft bands, broken lines along them, lighter runs), wind-worn tops, a few sand-blasted lighter blocks,
//            and the line where the sand meets the stone.
//   S_DOMES  (domes) references/surfaces/desert-domes/sheet-1.jpg: shell domes of curved panels set in rings that follow
//            the dome (in the object's frame, its foot at the origin), raised seams, a few odd-tone panels, now and then a
//            ring painted another colour, small round vents, a band of sand-scour at the ground.
//   S_CHANNEL (channel) references/surfaces/water-channels/sheet-1.jpg: a narrow water channel along its object's x or z
//            (its middle at 0): calm flow lines along the current, a pale line of light along each edge, a darker wet lip.
// Part 3 (issue #685), the sky stones' walked tops:
//   S_ROCKTOP (rockTop) references/surfaces/open-ground/sheet-1.jpg, its rock version: on a rock's upward faces (its sides
//            keep their strata), broad soft patches of a warmer and a cooler tone, a crackled net in the warm ones with a
//            broken line along their edge, long fissures across the rock in runs, pebbles with their shadows.
// Part 4 (issue #686), the same way:
//   S_CRYSTAL (crystalFacets) references/surfaces/crystals/sheet-1.jpg: Lorn's crystals, each facet a clean flat tone of its
//            own colour (lighter toward the sky and the sun, deeper and cooler in shade), a soft inner glow brighter toward
//            the root, a pale rim along the facets' edges, now and then a facet split in two by a fine line, and near, sparse
//            pale fracture lines and tiny bright inclusions. In the facets' own frame: the geometry's uv as facetUV leaves it
//            (u in facets round the crystal, v up it from the root), so any pointed prism made by CylinderGeometry(0, r, h, n).
// Every mark goes by its size on screen, as each sheet's distance strip: the fine marks first, the joints and bands
// next, the tones last; far off a flat colour.

/** The interiors: tile (m), the dado's and the skirting's tops (m over the floor) and colours ('auto': the dado the wall's
 *  colour × dadoDark, the skirting the wall's toward skirtCream by skirtMix), the share of odd tiles. */
export const INTERIOR = { tile: 0.6, dado: 1.2, skirt: 0.32, odd: 0.09, jitter: 0.035, tone: 0.05, dadoColor: 'auto', skirtColor: 'auto', mix: 1, dadoDark: 0.74, skirtCream: [0.94, 0.9, 0.82], skirtMix: 0.65, joint: 0.42, patch: 0.045 };
/** The industrial walls: panel (m, width and course), rivets' spacing and radius (m), the share of panels repainted and of streaked ones. */
export const SHEET = { panel: [1.6, 1.25], rivet: { step: 0.2, inset: 0.06, r: 0.016 }, repaint: 0.24, tint: 0.075, rust: 0.3 };
/** Worked timber: plank width (m; 0 a solid post), grain spacing (m), knots' share of cells, painted planks' share. */
export const TIMBER = { plank: 0.24, grain: 0.045, knot: 0.22, paint: 0.1, paintColor: [0.55, 0.73, 0.7] };
/** The ground's middle distance: contour spacing (m of height), the stones' density, how strong. */
export const GROUND_MID = { contour: 3.0, stones: 0.45, amount: 1 };

/** The sea walls: tide lines' spacing (m) and how many over the foot, the share of the repaired patches and their cell (m). */
export const SEA_WALL = { tide: 1.15, lines: 4, foot: 0, patch: 0.22, cell: [2.6, 1.7], salt: [0.15, 1.1] };
/** Lorn's pale stone: a course and a block's length (m), the damp band's height (m), the warmer blocks' share. */
export const PALE_STONE = { course: 0.9, block: 1.8, damp: 0.75, warm: 0.07, streaks: 0.3, crack: 0.1 };
/** The buried city: the wind's bands (m), the sand's line over the foot (m; 0 none), its colour. */
export const BURIED_CITY = { band: 0.55, sand: 0.4, sandColor: [0.91, 0.77, 0.55], blasted: 0.12 };
/** The desert's domes: rings over a hemisphere (or a tower's ring, m), panels round the equator (or a tower), the scour band (m over the foot). */
export const DOMES = { rings: 5, panels: 22, tower: [4, 10], scour: 1.8, odd: 0.16, vent: 0.12, band: 0.22 };
/** A rock's top: the crack net's cell (m), the pebbles' density, how strong the patches. */
export const ROCK_TOP = { cell: 1.4, pebbles: 0.5, amount: 1 };
/** A water channel: its half width (m), the current's speed (m/s). */
export const CHANNEL = { half: 0.35, flow: 0.25 };

/** Lorn's crystals: the facets' tones (sky, sun, each its own), the shade's cooler tint, how high up (of its length) the
 *  root's glow reaches, the rim's lift, the share of split facets, the fractures' cell (m) and share, the inclusions'. */
export const CRYSTAL_FACETS = { sky: 0.26, sun: 0.18, tone: 0.3, shade: [0.76, 0.78, 0.98], root: 0.38, emit: 0.06, rim: 0.75, split: 0.55,
  crack: [1.3, 0.4], dots: [0.32, 0.14] };

const clamp = (v, a, b) => Math.min(Math.max(v, a), b);
const hex = (c) => {
  if (c && typeof c === 'object' && 'r' in c) return [c.r, c.g, c.b];
  const n = typeof c === 'number' ? c : parseInt(String(c).replace('#', ''), 16);
  return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255];
};
const excluded = (o) => o.glass || o.glow || o.figure || o.facePart || o.eye || o.mode === 3;

/** interior: true or { tile, dado, skirt, dadoColor, skirtColor, mix } → [uInterior, uInteriorDado, uInteriorSkirt] as arrays (zeros: none). */
export function interiorOf(o) {
  const z = [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]];
  if (!o.interior || excluded(o) || o.mode === 1) return z;
  const r = { ...INTERIOR, ...(typeof o.interior === 'object' ? o.interior : {}) };
  const m = clamp(r.mix, 0, 1), base = hex(o.color ?? '#ffffff');
  // ('auto': the dado a darker band of the wall's own colour, the skirting's tiles paler, toward cream)
  const dado = r.dadoColor === 'auto' ? base.map((v) => v * r.dadoDark) : r.dadoColor ? hex(r.dadoColor) : null;
  const skirt = r.skirtColor === 'auto' ? base.map((v, i) => v + (r.skirtCream[i] - v) * r.skirtMix) : r.skirtColor ? hex(r.skirtColor) : null;
  return [[Math.max(r.tile, 0.1), dado ? r.dado : 0, skirt ? r.skirt : 0, clamp(r.odd, 0, 1)],
    [...(dado ?? [0, 0, 0]), dado ? m : 0], [...(skirt ?? [0, 0, 0]), skirt ? m : 0]];
}
/** sheet: true or { panel: [w, h], repaint, rust } → [panel w, course h, rust, repaint] (zeros: none). */
export function sheetOf(o) {
  if (!o.sheet || excluded(o) || o.mode === 1) return [0, 0, 0, 0];
  const s = typeof o.sheet === 'object' ? o.sheet : {};
  const [w, h] = s.panel ?? SHEET.panel;
  return [Math.max(w, 0.3), Math.max(h, 0.3), clamp(s.rust ?? 1, 0, 2), clamp(s.repaint ?? 1, 0, 2)];
}
/** timber: true or { plank, axis: 'x' | 'y' | 'z' (the grain, object space), paint, post } → [plank, axis 0/1/2, paint, 1
 *  (2: a post, its end grain darker; else a board's face across the axis takes its grain along x or z)]. */
export function timberOf(o) {
  if (!o.timber || excluded(o) || o.mode === 1) return [0, 0, 0, 0];
  const t = typeof o.timber === 'object' ? o.timber : {};
  return [Math.max(t.plank ?? TIMBER.plank, 0), { x: 0, y: 1, z: 2 }[t.axis ?? 'y'] ?? 1, clamp(t.paint ?? TIMBER.paint, 0, 1), t.post ? 2 : 1];
}
/** groundMid: true or { contour, stones, amount }, terrain only → [contour, stones, amount, 1]. */
export function groundMidOf(o) {
  if (!o.groundMid || o.mode !== 1) return [0, 0, 0, 0];
  const g = { ...GROUND_MID, ...(typeof o.groundMid === 'object' ? o.groundMid : {}) };
  return [Math.max(g.contour, 0.5), clamp(g.stones, 0, 1), clamp(g.amount, 0, 2), 1];
}

/** seaWall: true or { foot (world y), tide (m), salt, growth } → [tide, foot, salt, growth] (zeros: none). */
export function seaWallOf(o) {
  if (!o.seaWall || excluded(o) || o.mode === 1) return [0, 0, 0, 0];
  const w = typeof o.seaWall === 'object' ? o.seaWall : {};
  return [Math.max(w.tide ?? SEA_WALL.tide, 0.3), w.foot ?? SEA_WALL.foot, clamp(w.salt ?? 1, 0, 2), clamp(w.growth ?? 1, 0, 2)];
}
/** paleStone: true or { course, block, foot (world y), wear } → [course, block, foot, wear] (zeros: none). */
export function paleStoneOf(o) {
  if (!o.paleStone || excluded(o) || o.mode === 1) return [0, 0, 0, 0];
  const p = typeof o.paleStone === 'object' ? o.paleStone : {};
  return [Math.max(p.course ?? PALE_STONE.course, 0.2), Math.max(p.block ?? PALE_STONE.block, 0.3), p.foot ?? 0, clamp(p.wear ?? 1, 0, 2)];
}
/** buriedCity: true or { band, foot (world y), sand (m over the foot, 0: no sand line), scour } → [band, foot, sand, scour]. */
export function buriedCityOf(o) {
  if (!o.buriedCity || excluded(o) || o.mode === 1) return [0, 0, 0, 0];
  const b = typeof o.buriedCity === 'object' ? o.buriedCity : {};
  return [Math.max(b.band ?? BURIED_CITY.band, 0.1), b.foot ?? 0, Math.max(b.sand ?? BURIED_CITY.sand, 0), clamp(b.scour ?? 1, 0, 2)];
}
/** domes: true or { rings, panels, scour, tower (a tower: rings every DOMES.tower[0] m), band: colour, share } →
 *  [[rings (a tower's: m), panels, scour (m), 1 a dome / 2 a tower], [band r, g, b, share]] (zeros: none). */
export function domesOf(o) {
  const z = [[0, 0, 0, 0], [0, 0, 0, 0]];
  if (!o.domes || excluded(o) || o.mode === 1) return z;
  const d = typeof o.domes === 'object' ? o.domes : {};
  const tower = !!d.tower;
  const band = d.band ? [...hex(d.band), clamp(d.share ?? DOMES.band, 0, 1)] : [0, 0, 0, 0];
  return [[Math.max(d.rings ?? (tower ? DOMES.tower[0] : DOMES.rings), 1), Math.max(Math.round(d.panels ?? (tower ? DOMES.tower[1] : DOMES.panels)), 3), Math.max(d.scour ?? DOMES.scour, 0), tower ? 2 : 1], band];
}
/** channel: true or { half (m), axis: 'x' | 'z' (along its object's), flow (m/s) } → [half, 0 along x / 1 along z, flow, 1]. */
export function channelOf(o) {
  if (!o.channel || o.glass || o.glow || o.figure) return [0, 0, 0, 0];
  const c = typeof o.channel === 'object' ? o.channel : {};
  return [Math.max(c.half ?? CHANNEL.half, 0.05), c.axis === 'x' ? 0 : 1, c.flow ?? CHANNEL.flow, 1];
}

/** rockTop: true or { cell, pebbles, amount }, not on terrain → [cell, pebbles, amount, 1] (zeros: none). */
export function rockTopOf(o) {
  if (!o.rockTop || excluded(o) || o.mode === 1) return [0, 0, 0, 0];
  const r = { ...ROCK_TOP, ...(typeof o.rockTop === 'object' ? o.rockTop : {}) };
  return [Math.max(r.cell, 0.3), clamp(r.pebbles, 0, 1), clamp(r.amount, 0, 2), 1];
}
/** crystalFacets: true or { rim, glow (the root's), marks (fractures and inclusions) } → [rim, glow, marks, 1] (zeros: none).
 *  Lights may have it (the crystals glow); glass, people, the ground and water never. */
export function crystalFacetsOf(o) {
  if (!o.crystalFacets || o.glass || o.figure || o.facePart || o.eye || o.mode === 1 || o.mode === 3) return [0, 0, 0, 0];
  const c = typeof o.crystalFacets === 'object' ? o.crystalFacets : {};
  return [clamp(c.rim ?? 1, 0, 2), clamp(c.glow ?? 1, 0, 2), clamp(c.marks ?? 1, 0, 2), 1];
}
/**
 * A crystal's geometry made ready for S_CRYSTAL: a CylinderGeometry(0, r, h, sides, 1)'s uv has u round it (0..1) and v up
 * it; u becomes facets (0..sides), so a facet's edges lie where u and u - v are whole numbers. Its caps, and with sides 0
 * the whole of it (a prism, a column: no facet frame), get v = -1: their tone only. Before toNonIndexed or a merge (its groups).
 */
export function facetUV(geo, sides) {
  const uv = geo.attributes.uv;
  if (!uv) return geo;
  const caps = new Set();
  if (sides > 0) for (const g of geo.groups ?? []) if (g.materialIndex > 0) for (let i = g.start; i < g.start + g.count; i++) caps.add(geo.index ? geo.index.getX(i) : i);
  for (let i = 0; i < uv.count; i++) {
    if (sides > 0 && !caps.has(i)) uv.setX(i, uv.getX(i) * sides);
    else uv.setXY(i, 0, -1);
  }
  uv.needsUpdate = true;
  return geo;
}

const f = (v) => (Number.isInteger(v) ? `${v}.0` : `${+v.toFixed(5)}`);
const R = INTERIOR, S = SHEET, T = TIMBER;

export const INTERIOR_GLSL = /* glsl */ `
  // ---------------------------------------------------------------- interiors (src/surface-marks.js INTERIOR)
  // a grout line's place: a row's or a column's line moved a few millimetres its own way
  float interiorJ(float i, float sd) { return i + ${f(R.jitter)} * (hash(vec2(i, sd)) - 0.5); }
  // A room's floor at q (m, the room's x z), fq its metres per px each way, s2 the sun's way across it in the room's x z
  // (the painted relief's): each tile's tone into alb; its grout's ink.
  float interiorFloor(vec2 q, vec2 fq, vec2 s2, inout vec3 alb) {
    vec2 g = q / uInterior.x, c = floor(g);
    float px = uInterior.x / max(max(fq.x, fq.y), 1e-6);
    if (px < 3.0) return 0.0;
    float dx = min(abs(g.x - interiorJ(c.x, 1.3)), abs(g.x - interiorJ(c.x + 1.0, 1.3))) * uInterior.x / max(fq.x, 1e-6);
    float dy = min(abs(g.y - interiorJ(c.y, 7.1)), abs(g.y - interiorJ(c.y + 1.0, 7.1))) * uInterior.x / max(fq.y, 1e-6);
    float kT = smoothstep(4.0, 10.0, px);
    vec3 m = vec3(1.0 + ${f(R.tone)} * (hash(c + 3.3) - 0.5));
    float h = hash(c + 9.1);
    if (h < uInterior.w) m *= hash(c + 5.7) < 0.5 ? vec3(0.88, 1.04, 0.96) : vec3(0.88, 0.95, 1.07);   // (a mint or a pale blue tile)
    alb *= mix(vec3(1.0), m, kT);
    // painted relief: each tile a little proud of its grout
    if (uRelief > 0.0) {
      float x0 = interiorJ(c.x, 1.3), x1 = interiorJ(c.x + 1.0, 1.3), y0 = interiorJ(c.y, 7.1), y1 = interiorJ(c.y + 1.0, 7.1);
      vec2 gr = dx < dy ? vec2(abs(g.x - x0) < abs(g.x - x1) ? -1.0 : 1.0, 0.0) : vec2(0.0, abs(g.y - y0) < abs(g.y - y1) ? -1.0 : 1.0);
      alb = reliefTone(alb, reliefEdge(min(dx, dy), gr, s2, 0.9) * smoothstep(8.0, 16.0, px) * 0.8);
    }
    return max(inkLine(dx, 0.9), inkLine(dy, 0.9)) * smoothstep(6.0, 12.0, px) * 0.85;
  }
  // A room's wall at (along, y: m over the floor), fq its metres per px: the skirting, the dado band, the plaster's
  // repainted patches into alb; the bands' edges and the skirting's joints' ink.
  float interiorWall(float along, float y, vec2 fq, inout vec3 alb) {
    float ink = 0.0, fy = max(fq.y, 1e-6), fx = max(fq.x, 1e-6);
    float kL = smoothstep(2.0, 5.0, 0.3 / fy);
    if (uInterior.z > 0.0 && y < uInterior.z) {
      alb = mix(alb, uInteriorSkirt.rgb, uInteriorSkirt.a);
      float u = along / ${f(R.joint)};
      ink = max(ink, inkLine(abs(fract(u + 0.5) - 0.5) * ${f(R.joint)} / fx, 0.8) * smoothstep(6.0, 12.0, ${f(R.joint)} / fx) * 0.6);
      alb *= 1.0 + 0.04 * (hash(vec2(floor(u), 2.7)) - 0.5) * kL;
    } else if (uInterior.y > 0.0 && y < uInterior.y) {
      alb = mix(alb, uInteriorDado.rgb, uInteriorDado.a);
    } else {
      float v = vnoise(vec2(along, y) * 0.55 + 3.1) * 0.7 + vnoise(vec2(along, y) * 1.7 + 9.2) * 0.3;
      alb *= 1.0 + ${f(R.patch)} * (smoothstep(0.56, 0.66, v) - 0.3 * smoothstep(0.3, 0.2, v));
    }
    if (uInterior.z > 0.0) ink = max(ink, inkLine(abs(y - uInterior.z) / fy, 0.9) * kL * 0.75);
    if (uInterior.y > 0.0) ink = max(ink, inkLine(abs(y - uInterior.y) / fy, 0.9) * kL * 0.75);
    return ink;
  }
`;

export const SHEET_GLSL = /* glsl */ `
  // ---------------------------------------------------------------- industrial walls (src/surface-marks.js SHEET)
  // A wall of sheet-metal panels at q (m: along, up), fq its metres per px, seed the building's, sun2 the sun's way across
  // it (along, up; the painted relief's, src/relief.js): the panels' repaints and rust into alb; the seams', rivets' and
  // streaks' ink.
  float sheetWall(vec2 q, vec2 fq, float seed, vec2 sun2, inout vec3 alb) {
    float H = uSheet.y, row = floor(q.y / H), y0 = row * H;
    float W = uSheet.x * (0.7 + 0.6 * hash(vec2(row, seed))), off = hash(vec2(row, seed + 2.3));
    float u = q.x / W + off, col = floor(u);
    float lx = (u - col) * W, ly = q.y - y0;
    vec2 fqm = max(fq, vec2(1e-6));
    float fm = max(fqm.x, fqm.y);
    float pW = W / fqm.x, pH = H / fqm.y;
    if (min(pW, pH) < 2.0) return 0.0;
    vec2 id = vec2(col, row) + seed;
    // a repainted panel (another colour, a step), and its neighbour now and then with it
    float hp = hash(vec2(floor(col * 0.5), row) + seed + 4.1);
    float kT = smoothstep(2.0, 6.0, min(pW, pH));
    if (hp < ${f(S.repaint)} * uSheet.w) {
      float t = fract(hp * 37.1);
      vec3 m = t < 0.4 ? vec3(${f(1 - S.tint)}, ${f(1 - S.tint * 0.3)}, ${f(1 + S.tint * 0.8)}) : t < 0.75 ? vec3(${f(1 + S.tint * 0.8)}, ${f(1 - S.tint * 0.3)}, ${f(1 - S.tint)}) : vec3(${f(1 + S.tint * 0.5)}, ${f(1 + S.tint * 0.4)}, ${f(1 - S.tint * 0.2)});
      alb *= mix(vec3(1.0), m, kT);
    }
    alb *= 1.0 + 0.04 * (hash(id + 0.7) - 0.5) * kT;
    // the seams
    float dxs = min(lx, W - lx) / fqm.x, dys = min(ly, H - ly) / fqm.y;
    float ink = max(inkLine(dxs, 0.9), inkLine(dys, 0.9)) * smoothstep(5.0, 10.0, min(pW, pH)) * 0.75;
    // painted relief: each panel a little proud of its seams, the rivets' domes beside their dots
    float rel = 0.0;
    if (uRelief > 0.0) rel = reliefEdge(min(dxs, dys), dxs < dys ? vec2(lx < 0.5 * W ? -1.0 : 1.0, 0.0) : vec2(0.0, ly < 0.5 * H ? -1.0 : 1.0), sun2, 0.9) * smoothstep(6.0, 12.0, min(pW, pH)) * 0.7;
    // rivets in rows along each seam, a little in from it
    float sp = ${f(S.rivet.step)}, ins = ${f(S.rivet.inset)};
    float kR = smoothstep(4.0, 8.0, sp / fm);
    if (kR > 0.0) {
      vec2 d1 = vec2(lx - (floor(lx / sp) + 0.5) * sp, min(abs(ly - ins), abs(ly - (H - ins))));
      vec2 d2 = vec2(min(abs(lx - ins), abs(lx - (W - ins))), ly - (floor(ly / sp) + 0.5) * sp);
      float dr = min(length(d1 / fqm), length(d2 / fqm));
      float rp = max(${f(S.rivet.r)} / fm, 0.6 * uPixelRatio);
      ink = max(ink, (1.0 - smoothstep(rp - 0.6, rp + 0.6, dr)) * kR * 0.8);
      if (uRelief > 0.0) {
        vec2 r1 = vec2(d1.x, ly - (ly < 0.5 * H ? ins : H - ins)) / fqm, r2 = vec2(lx - (lx < 0.5 * W ? ins : W - ins), d2.y) / fqm;
        vec2 rv = dot(r1, r1) < dot(r2, r2) ? r1 : r2;
        // (only on a rivet a few px across: on a smaller one the band outweighs the dot and post.js inks it as a smudge)
        float rr = reliefEdge(max(dr - rp, 0.0), rv / max(dr, 1e-4), sun2, 0.0) * kR * smoothstep(1.6, 3.0, rp / uPixelRatio) * 0.6;
        if (abs(rr) > abs(rel)) rel = rr;
      }
    }
    // a rust streak run down from a rivet under the panel's top seam
    float hs = hash(id + 6.3);
    if (hs < ${f(S.rust)} * uSheet.z) {
      float xs = (floor(fract(hs * 53.7) * max(floor(W / sp), 1.0)) + 0.5) * sp;
      float len = H * (0.35 + 0.55 * hash(id + 8.9)), s = (H - ins) - ly;
      if (s > 0.0 && s < len) {
        float k = 1.0 - s / len, w = mix(0.004, 0.016, k) + 0.006 * (vnoise(vec2(q.y * 9.0, id.x)) - 0.5);
        float dx = abs(lx - xs);
        float on = 1.0 - smoothstep(w, w + fqm.x, dx);
        alb *= mix(vec3(1.0), vec3(0.86, 0.72, 0.6), on * k * 0.75 * smoothstep(1.0, 3.0, 0.016 / fqm.x));
        ink = max(ink, inkLine(dx / fqm.x, 0.5) * k * 0.45 * (1.0 - smoothstep(0.006, 0.014, fm)));
      }
    }
    if (rel != 0.0) alb = reliefTone(alb, rel);
    return ink;
  }
`;

export const TIMBER_GLSL = /* glsl */ `
  // ---------------------------------------------------------------- worked timber (src/surface-marks.js TIMBER)
  // Timber at p (object space, m), its face's axis (0 x, 1 y, 2 z: the face's normal's), pf its metres per px each way, ny
  // the world normal's y: each plank's tone, a painted one, the sun on its top into alb; its joints', grain's, knots' ink.
  // (no painted relief: tried, lost in the planks' grain and hatching, issue 696)
  float timber(vec3 p, int face, vec3 pf, float ny, inout vec3 alb) {
    int ga = int(uTimber.y + 0.5);
    alb *= 1.0 + 0.07 * clamp(ny, 0.0, 1.0) - 0.08 * clamp(-ny, 0.0, 1.0);   // (sun-bleached tops, darker undersides)
    if (face == ga) {
      if (uTimber.w > 1.5) { alb *= 0.9; return 0.0; }   // (a post's end grain: a darker face)
      ga = face == 0 ? 2 : 0;   // (a board's face across the grain's axis: its grain along another)
    }
    int ca = 3 - face - ga;   // (across the grain, on this face)
    float s = ga == 0 ? p.x : ga == 1 ? p.y : p.z, t = ca == 0 ? p.x : ca == 1 ? p.y : p.z;
    float fs = max(ga == 0 ? pf.x : ga == 1 ? pf.y : pf.z, 1e-6), ft = max(ca == 0 ? pf.x : ca == 1 ? pf.y : pf.z, 1e-6);
    float ink = 0.0, Wp = uTimber.x, pi = 0.0;
    if (Wp > 0.0) {
      pi = floor(t / Wp);
      float dj = abs(fract(t / Wp + 0.5) - 0.5) * Wp / ft;
      float kJ = smoothstep(5.0, 10.0, Wp / ft);
      ink = inkLine(dj, 0.9) * kJ * 0.8;
      float hp = hash(vec2(pi, 3.9));
      alb *= 1.0 + 0.09 * (hp - 0.5) * smoothstep(3.0, 8.0, Wp / ft);
      if (hash(vec2(pi, 8.3)) < uTimber.z) {
        float flake = smoothstep(0.58, 0.64, vnoise(vec2(s * 2.6, t * 11.0)));
        alb = mix(alb, vec3(${T.paintColor.map(f).join(', ')}) * (0.95 + 0.1 * hp), 0.75 * (1.0 - flake));
      }
    }
    // grain: strokes along it, wavering, broken into long runs; near only
    float kG = 1.0 - smoothstep(0.004, 0.009, ft);
    if (kG > 0.0 && uWearLite < 0.5) {
      float sp = ${f(T.grain)};
      float wob = (vnoise(vec2(s * 1.3, t * 3.0)) - 0.5) * 0.6;
      float g = t / sp + wob, gi = floor(g + 0.5);
      float run = smoothstep(0.4, 0.55, vnoise(vec2(s * 0.9 + gi * 7.3, gi)));
      ink = max(ink, inkLine(abs(g - gi) * sp / ft, 0.55) * run * kG * 0.45);
    }
    // a knot now and then (an eye of rings), a pair of nail holes at a plank's middle every so often
    float kK = 1.0 - smoothstep(0.006, 0.014, max(fs, ft));
    if (kK > 0.0) {
      float cs = 0.7, ci = floor(s / cs);
      vec2 kid = vec2(ci, Wp > 0.0 ? pi : floor(t / 0.3));
      if (hash(kid + 1.9) < ${f(T.knot)}) {
        float tc = Wp > 0.0 ? (pi + 0.3 + 0.4 * hash(kid + 2.2)) * Wp : (kid.y + 0.5) * 0.3;
        vec2 d = vec2((s - (ci + 0.25 + 0.5 * hash(kid + 4.4)) * cs) / 0.045, (t - tc) / 0.022);
        float r = length(d), w = 1.2 / max(0.022 / ft, 1e-3);
        ink = max(ink, max(1.0 - smoothstep(0.0, w, abs(r - 1.0)), (1.0 - smoothstep(0.3, 0.3 + w, r)) * 0.8) * kK * 0.7);
      }
      if (Wp > 0.0 && hash(kid + 7.7) < 0.35) {
        vec2 d = vec2(s - (ci + 0.08) * cs, t - (pi + 0.5) * Wp);
        float dn = min(length((d - vec2(0.0, 0.05)) / max(vec2(fs, ft), 1e-6)), length((d + vec2(0.0, 0.05)) / max(vec2(fs, ft), 1e-6)));
        ink = max(ink, (1.0 - smoothstep(0.6 * uPixelRatio, 1.4 * uPixelRatio, dn)) * kK * 0.8);
      }
    }
    return ink;
  }
`;

export const GROUND_MID_GLSL = /* glsl */ `
  // ---------------------------------------------------------------- the ground's middle distance (src/surface-marks.js GROUND_MID)
  // (issue 677, the author: "the ground in Vael is fully a flat color": stronger, after the open-ground sheet's panels:
  //  patches of a paler ochre with a crackled, broken border, a few rosier ones, pebbles with their shadows near as well
  //  as far, short wind dashes near, the long lines along the slopes; flat colour far)
  // the paler patches' field (its border at 0.58, jagged by a fine octave) and the rosier ones' (under 0.3)
  float groundMidPale(vec2 p) { return vnoise(p * 0.018 + 5.3) * 0.6 + vnoise(p * 0.07 + 1.7) * 0.3 + vnoise(p * 0.55 + 3.1) * 0.1; }
  float groundMidRose(vec2 p) { return vnoise(p * 0.03 + 11.1) * 0.7 + vnoise(p * 0.11 + 4.2) * 0.3; }
  // the patches' tone into the albedo: soft over at least a few pixels, so never a colour edge post.js inks
  vec3 groundMidTone(vec2 p, vec3 alb) {
    float v1 = groundMidPale(p), v2 = groundMidRose(p);
    float w1 = max(0.012, 4.0 * fwidth(v1)), w2 = max(0.012, 4.0 * fwidth(v2));
    float k = uGroundMid.z;
    float pale = smoothstep(0.58 - w1, 0.58 + w1, v1) * k, rose = (1.0 - smoothstep(0.3 - w2, 0.3 + w2, v2)) * k;
    alb = mix(alb, vec3(0.97, 0.85, 0.64), pale * 0.42);   // (a paler sandy ochre, as the sheet's patches)
    return alb * mix(vec3(1.0), vec3(0.965, 0.935, 0.945), rose);
  }
  // The ground at p (m, x z) and height y, gm its metres per px, yfw the height's per px, slope 1 - n.y, s2 the sun's way
  // across the ground, len its shadows' length, castK how lit, nearStones 1 where the ground has no print pebbles of its
  // own (uDots): the patches' broken border, wind dashes, lines along the slopes and stones near and far: their ink.
  float groundMid(vec2 p, float y, float gm, float yfw, float slope, vec2 s2, float len, float castK, float nearStones) {
    float k = uGroundMid.z, ink = 0.0;
    float flatK = 1.0 - smoothstep(0.35, 0.6, slope);
    // the paler patches' crackled border: a broken pen line along it, near and in the middle distance
    float v1 = groundMidPale(p), f1 = max(fwidth(v1), 1e-5);
    float brk = smoothstep(0.32, 0.5, vnoise(p * 0.7 + 8.3));
    ink = max(ink, inkLine(abs(v1 - 0.58) / f1, 0.9) * brk * 0.7 * k * flatK * (1.0 - smoothstep(0.03, 0.08, gm)));
    // short wind dashes, near
    float kD = 1.0 - smoothstep(0.012, 0.03, gm);
    if (kD > 0.0) {
      vec2 dw = vec2(0.8, 0.6), dn = vec2(-0.6, 0.8);
      vec2 q = vec2(dot(p, dw), dot(p, dn)) / vec2(1.6, 0.7), c = floor(q);
      if (hash(c + 17.3) < 0.3) {
        vec2 o = (c + 0.2 + 0.6 * vec2(hash(c + 3.1), hash(c + 5.9))) * vec2(1.6, 0.7);
        vec2 r = vec2(dot(p, dw), dot(p, dn)) - o;
        float hl = 0.16 + 0.2 * hash(c + 9.7);
        float d = length(vec2(max(abs(r.x) - hl, 0.0), r.y)) / max(gm, 1e-6);
        ink = max(ink, inkLine(d, 0.6) * kD * 0.5 * k * flatK);
      }
    }
    // long pen lines along the fall of the slopes: the height's contours on rolling ground, in long runs, from ~15 m out
    float mid = smoothstep(0.012, 0.04, gm);
    float S = uGroundMid.x, cpx = S / max(yfw, 1e-6);
    float onSlope = smoothstep(0.03, 0.08, slope) * (1.0 - smoothstep(0.35, 0.5, slope));
    if (mid > 0.0 && onSlope > 0.0 && cpx > 6.0) {
      float run = smoothstep(0.5, 0.62, vnoise(p * 0.012 + 9.1));
      float d = abs(fract(y / S + 0.5) - 0.5) * cpx;
      ink = max(ink, inkLine(d, 0.8) * run * onSlope * mid * smoothstep(6.0, 14.0, cpx) * 0.6 * k);
    }
    // stones with their shadows: small pebbles near (where the ground has none of its own), stones out to ~200 m
    if (uGroundMid.y > 0.0 && gm < 0.25) {
      ink = max(ink, pebbleField(p, gm, s2, len, castK, 4.5, uGroundMid.y, vec2(0.12, 0.3), 91.0) * max(mid, nearStones) * flatK);
      if (nearStones > 0.0) ink = max(ink, pebbleField(p, gm, s2, len, castK, 1.1, min(uGroundMid.y * 0.9, 0.6), vec2(0.045, 0.12), 57.0) * nearStones * flatK);
    }
    return ink;
  }
`;


const W = SEA_WALL, P = PALE_STONE, B = BURIED_CITY, D = DOMES;

export const SEA_WALL_GLSL = /* glsl */ `
  // ---------------------------------------------------------------- the Underwater City's walls (src/surface-marks.js SEA_WALL)
  // a soft noise over a wall in the world's frame, any way it faces (no seam round a dome)
  float seaN(vec3 p, float s) { return vnoise(p.xz * s + p.y * s * vec2(0.37, -0.61)); }
  // A sea-weathered wall at p (world), fw its metres per px along x, y, z, n its world normal, sun the sun's way across the
  // ground: salt, tide lines, growth stains and repaired patches into alb; the tide lines', barnacles' and patches' ink.
  float seaWall(vec3 p, vec3 fw, vec3 n, vec2 sun, inout vec3 alb) {
    float h = p.y - uSeaWall.y, fy = max(fw.y, 1e-6), fm = max(max(fw.x, fw.z), fy), ink = 0.0;
    float up = 1.0 - smoothstep(0.55, 0.8, abs(n.y));
    // tide lines: a few over the foot, each its own height, in long runs, a shade darker, a fine line on top near
    float T = uSeaWall.x, k = floor(h / T + 0.5);
    if (k >= 1.0 && k <= ${f(W.lines)}) {
      float y0 = (k + 0.3 * (hash(vec2(k, 4.1)) - 0.5)) * T + 0.18 * (seaN(p + k * 3.1, 0.35) - 0.5);
      float run = smoothstep(0.22, 0.4, seaN(p + vec3(k * 5.7, 0.0, 1.3), 0.21));
      float bw = 0.07 + 0.07 * seaN(p + k, 1.3), d = h - y0;
      float on = (1.0 - smoothstep(bw * 0.5, bw, abs(d))) * run * up;
      alb *= mix(vec3(1.0), vec3(0.86, 0.82, 0.78), on * smoothstep(0.6, 2.0, bw / fy) * (1.1 - 0.15 * k));
      ink = max(ink, inkLine(abs(d - bw) / fy, 0.7) * run * up * 0.6 * (1.0 - smoothstep(0.02, 0.05, fy)));
    }
    // white salt bloom gathered at the foot and under the ledges, mottled; gone far
    float above = step(-0.4, h);
    float salt = (1.0 - smoothstep(${f(W.salt[0])}, ${f(W.salt[1])} + 0.5 * seaN(p, 0.6), h)) * above;
    salt = max(salt, smoothstep(-0.25, -0.65, n.y) * 0.7);
    float mott = smoothstep(0.3, 0.72, seaN(p + 2.7, 2.3));
    alb = mix(alb, vec3(0.97, 0.96, 0.92), salt * mott * 0.5 * uSeaWall.z * (1.0 - smoothstep(0.025, 0.07, fm)));
    // green growth stains in the shaded foot, and barnacle dots in them near
    float away = smoothstep(0.1, -0.45, dot(normalize(n.xz + vec2(1e-5)), sun));
    float g = (1.0 - smoothstep(0.3, 2.0, h)) * above * away * up * smoothstep(0.52, 0.74, seaN(p + 9.1, 0.8)) * uSeaWall.w;
    alb = mix(alb, alb * vec3(0.8, 0.98, 0.78), g * 0.75);
    if (g > 0.02 && fm < 0.008 && uWearLite < 0.5) {
      vec3 c = floor(p / 0.07);
      vec3 r = (p / 0.07 - c - 0.5 - 0.6 * (vec3(hash(c.xy + c.z * 7.1), hash(c.yz + c.x * 3.3), hash(c.zx + c.y * 5.9)) - 0.5)) * 0.07;
      float rr = uPixelRatio * (0.7 + 0.5 * hash(c.xz + 1.9));
      ink = max(ink, (1.0 - smoothstep(rr - 0.6, rr + 0.6, length(r) / fm)) * step(hash(c.xz + c.y * 11.3), 0.35) * g * 0.6 * (1.0 - smoothstep(0.004, 0.008, fm)));
    }
    // repaired patches of a fresher render, along the wall's dominant axis (faded where it turns: no seam on a dome)
    bool sx = abs(n.x) > abs(n.z);
    vec2 w = sx ? p.zy : p.xy, wf = max(sx ? vec2(fw.z, fy) : vec2(fw.x, fy), vec2(1e-6));
    float axisK = smoothstep(0.12, 0.3, abs(abs(n.x) - abs(n.z))) * up;
    vec2 cs = vec2(${f(W.cell[0])}, ${f(W.cell[1])}), cc = floor(w / cs) + (sx ? 17.0 : 3.0);
    if (axisK > 0.0 && hash(cc) < ${f(W.patch)}) {
      vec2 lo = (floor(w / cs) + 0.08 + 0.3 * vec2(hash(cc + 1.1), hash(cc + 2.2))) * cs;
      vec2 hi = (floor(w / cs) + 0.62 + 0.3 * vec2(hash(cc + 3.3), hash(cc + 4.4))) * cs;
      vec2 dd = min(w - lo, hi - w);
      vec2 spx = (hi - lo) / wf;
      if (min(dd.x, dd.y) > 0.0) {
        alb *= mix(vec3(1.0), vec3(1.1, 0.97, 0.95), axisK * smoothstep(2.0, 6.0, min(spx.x, spx.y)));
        ink = max(ink, inkLine(min(dd.x / wf.x, dd.y / wf.y), 0.8) * axisK * 0.65 * smoothstep(8.0, 16.0, min(spx.x, spx.y)));
        // painted relief: the fresh render laid a little proud of the old, its edge toward the sun lit
        if (uRelief > 0.0) {
          vec2 dp = dd / wf, gp = dp.x < dp.y ? vec2(w.x - lo.x < hi.x - w.x ? -1.0 : 1.0, 0.0) : vec2(0.0, w.y - lo.y < hi.y - w.y ? -1.0 : 1.0);
          float lit = smoothstep(-0.05, 0.2, dot(n, uSunDir));
          alb = reliefTone(alb, reliefEdge(min(dp.x, dp.y), gp, (sx ? uSunDir.zy : uSunDir.xy) * lit, 0.8) * axisK * smoothstep(10.0, 20.0, min(spx.x, spx.y)));
        }
      }
    }
    return ink;
  }
`;

export const PALE_STONE_GLSL = /* glsl */ `
  // ---------------------------------------------------------------- Lorn's pale stone (src/surface-marks.js PALE_STONE)
  // A wall of pale stone at p (world), fw its metres per px along x, y, z, n its world normal: each block's tone, the worn
  // arrises, rain streaks, the damp foot into alb; the joints', streaks', cracks' and pits' ink.
  float paleStone(vec3 p, vec3 fw, vec3 n, inout vec3 alb) {
    float ink = 0.0, wear = uPaleStone.w;
    // the damp band at the foot: darker, its top wavering
    float hf = p.y - uPaleStone.z, dtop = ${f(P.damp)} * (0.75 + 0.5 * vnoise(p.xz * 0.45 + 3.7));
    float damp = (1.0 - smoothstep(dtop - 0.06, dtop + 0.06, hf)) * step(-1.5, hf) * (1.0 - smoothstep(0.6, 0.8, abs(n.y)));
    alb *= mix(vec3(1.0), vec3(0.84, 0.84, 0.89), damp * min(wear, 1.0));
    // (a top: its flagstones in the same blocks, laid along x; no streaks, no damp)
    bool sx = abs(n.x) > abs(n.z), top = n.y > 0.75;
    vec2 q = top ? p.xz : sx ? p.zy : p.xy, fq = max(top ? vec2(fw.x, fw.z) : sx ? vec2(fw.z, fw.y) : vec2(fw.x, fw.y), vec2(1e-6));
    float fm = max(fq.x, fq.y), sd = top ? 57.0 : sx ? 31.0 : 0.0;
    float C = uPaleStone.x, row = floor(q.y / C);
    float L = uPaleStone.y * (0.75 + 0.5 * hash(vec2(row, 5.1 + sd)));
    float u = q.x / L + hash(vec2(row, 2.7 + sd)), col = floor(u);
    vec2 id = vec2(col, row) + sd;
    float lx = (u - col) * L, ly = q.y - row * C;
    float pW = L / fq.x, pH = C / fq.y;
    if (n.y < -0.75 || (abs(n.y) > 0.6 && !top) || min(pW, pH) < 2.0) return 0.0;
    float kT = smoothstep(3.0, 8.0, min(pW, pH));
    // each block its tone, a mottle in it, now and then a warmer block put in
    vec3 m = vec3(1.0 + 0.08 * (hash(id + 0.3) - 0.5) + 0.03 * (vnoise(q * 1.6 + id) - 0.5));
    if (hash(id + 7.7) < ${f(P.warm)}) m *= vec3(1.045, 1.0, 0.92);
    alb *= mix(vec3(1.0), m, kT);
    // its outline: soft round corners; its upper arris worn and catching the light
    float ex = min(lx, L - lx), ey = min(ly, C - ly), rc = 0.07 * C;
    float dpx = ex < rc && ey < rc ? max(rc - length(vec2(rc - ex, rc - ey)), 0.0) / fm : min(ex / fq.x, ey / fq.y);
    ink = max(ink, inkLine(dpx, 0.9) * smoothstep(5.0, 10.0, min(pW, pH)) * 0.7);
    // painted relief: each block a little proud of its joints, the edge toward the sun lit, the other shaded
    float rel = 0.0;
    if (uRelief > 0.0) {
      vec2 sg = vec2(lx < 0.5 * L ? -1.0 : 1.0, ly < 0.5 * C ? -1.0 : 1.0);
      vec2 gp = ex < rc && ey < rc ? normalize(vec2(rc - ex, rc - ey) + 1e-5) * sg : ex / fq.x < ey / fq.y ? vec2(sg.x, 0.0) : vec2(0.0, sg.y);
      float lit = smoothstep(-0.05, 0.2, dot(n, uSunDir));
      rel = reliefEdge(dpx, gp, (top ? uSunDir.xz : sx ? uSunDir.zy : uSunDir.xy) * lit, 0.9) * smoothstep(8.0, 16.0, min(pW, pH));
    }
    float arris = (C - ly) / fq.y;
    alb *= 1.0 + (top ? 0.0 : 0.05) * smoothstep(1.0, 1.8, arris) * (1.0 - smoothstep(1.8, 4.0, arris)) * smoothstep(8.0, 14.0, pH);
    // fine rain streaks hanging from a course's top, darker, tapering down
    if (!top && hash(vec2(row, 9.9 + sd)) < ${f(P.streaks)} * wear) {
      float sw = 0.11, sc = floor(lx / sw);
      vec2 sid = id + vec2(sc * 0.37, 4.4);
      float len = C * (0.25 + 0.6 * hash(sid + 1.3)), s = C - ly;
      if (hash(sid) < 0.35 && s < len) {
        float k = 1.0 - s / len, xs = (sc + 0.5) * sw + 0.02 * (vnoise(vec2(q.y * 6.0, sc)) - 0.5);
        float wd = mix(0.003, 0.01, k), dx = abs(lx - xs);
        float on = 1.0 - smoothstep(wd, wd + fq.x, dx);
        alb *= 1.0 - 0.08 * on * k * smoothstep(1.0, 3.0, 0.01 / fq.x);
        ink = max(ink, inkLine(dx / fq.x, 0.5) * k * 0.4 * (1.0 - smoothstep(0.004, 0.01, fm)));
      }
    }
    // near: a hairline crack across the odd block, sparse pits
    float kN = 1.0 - smoothstep(0.006, 0.014, fm);
    if (kN > 0.0 && uWearLite < 0.5) {
      if (hash(id + 3.9) < ${f(P.crack)} * wear) {
        float an = (hash(id + 5.3) - 0.5) * 1.4 + 0.8;
        vec2 dir = vec2(cos(an), sin(an)), o = vec2(hash(id + 6.6) * L, hash(id + 8.8) * C);
        vec2 r = vec2(lx, ly) - o;
        float s = dot(r, dir), off = dot(r, vec2(-dir.y, dir.x)) - 0.03 * C * (vnoise(vec2(s * 9.0, id.x)) - 0.5);
        float reach = C * (0.25 + 0.4 * hash(id + 2.4));
        ink = max(ink, inkLine(abs(off) / fm, 0.45) * (1.0 - smoothstep(reach * 0.6, reach, abs(s))) * step(1.5, dpx) * kN * 0.65);
      }
      vec2 pc = q / 0.21, pq = floor(pc);
      vec2 pd = (fract(pc) - 0.2 - 0.6 * hash2(pq + 47.0)) * 0.21 / fq;
      float pr = 0.9 * uPixelRatio * (0.6 + 0.8 * hash(pq + 3.0));
      ink = max(ink, (1.0 - smoothstep(pr - 0.6, pr + 0.6, length(pd))) * step(hash(pq + 8.0), 0.1 * wear) * step(1.0, dpx) * kN * 0.5);
    }
    if (rel != 0.0) alb = reliefTone(alb, rel);
    return ink;
  }
`;

export const BURIED_CITY_GLSL = /* glsl */ `
  // ---------------------------------------------------------------- the Glass Dunes' buried city (src/surface-marks.js BURIED_CITY)
  // Sandstone at p (world), fw its metres per px along x, y, z, n its world normal: the wind's bands and scoured runs, worn
  // tops, sand-blasted blocks, the sand against its foot into alb; the bands' and the sand line's ink.
  float buriedCity(vec3 p, vec3 fw, vec3 n, inout vec3 alb) {
    float fy = max(fw.y, 1e-6), fm = max(max(fw.x, fw.z), fy), ink = 0.0;
    vec2 q = p.xz;
    float up = 1.0 - smoothstep(0.55, 0.8, abs(n.y));
    // the wind's bands: soft, each its tone, wavering along the wall; broken lines between them
    float Bh = uBuried.x, yb = p.y / Bh + 0.6 * (vnoise(q * 0.07 + 2.3) - 0.5), bi = floor(yb);
    float kB = smoothstep(2.0, 6.0, Bh / fy) * up;
    alb *= 1.0 + (hash(vec2(bi, 6.1)) - 0.5) * 0.11 * kB * uBuried.w;
    float run = smoothstep(0.48, 0.62, vnoise(q * 0.3 + bi * 1.7));
    ink = max(ink, inkLine(abs(fract(yb + 0.5) - 0.5) * Bh / fy, 0.6) * run * 0.55 * smoothstep(7.0, 14.0, Bh / fy) * up);
    // painted relief: the line between two bands a groove the wind cut, its lower lip lit by a high sun, its upper shaded
    float rel = 0.0;
    if (uRelief > 0.0) {
      float tb = fract(yb + 0.5) - 0.5, lit = smoothstep(-0.05, 0.2, dot(n, uSunDir));
      rel = reliefEdge(abs(tb) * Bh / fy, vec2(0.0, tb > 0.0 ? -1.0 : 1.0), vec2(0.0, uSunDir.y * lit), 0.6) * run * up * smoothstep(9.0, 18.0, Bh / fy);
    }
    // scoured lighter runs along the bands
    float st = 0.5 * (vnoise(vec2(q.x * 0.22, p.y * 6.0)) + vnoise(vec2(q.y * 0.22, p.y * 6.0 + 5.0)));
    alb *= 1.0 + 0.08 * smoothstep(0.6, 0.78, st) * smoothstep(1.0, 3.0, 0.16 / fy) * up * uBuried.w;
    // wind-worn tops, and a few blocks sand-blasted lighter (soft: never a colour edge)
    alb *= 1.0 + 0.05 * smoothstep(0.5, 0.85, n.y);
    if (rel != 0.0) alb = reliefTone(alb, rel);
    vec3 c = floor(p / vec3(2.2, 1.1, 2.2));
    if (hash(c.xz + c.y * 13.7) < ${f(B.blasted)}) alb *= 1.0 + 0.045 * up;
    // the sand against the foot: its line wavering, sand-coloured below, a faint stain over it
    if (uBuried.z > 0.0) {
      float h = p.y - uBuried.y, sl = uBuried.z * (0.55 + 0.9 * vnoise(q * 0.4 + 7.7));
      if (h > -3.0 && h < sl + 0.6) {
        float below = 1.0 - smoothstep(sl - 0.025, sl + 0.025, h);
        alb = mix(alb, vec3(${B.sandColor.map(f).join(', ')}), below * 0.7 * up);
        alb *= 1.0 - 0.07 * (1.0 - smoothstep(0.0, 0.35, h - sl)) * step(sl, h) * up;
        ink = max(ink, inkLine(abs(h - sl) / fy, 0.8) * 0.7 * up * (1.0 - smoothstep(0.02, 0.05, fy)));
      }
    }
    return ink;
  }
`;

export const DOMES_GLSL = /* glsl */ `
  // ---------------------------------------------------------------- the desert's domes (src/surface-marks.js DOMES)
  // A dome (or a tower) at p (object space: its foot's middle at the origin), fphi the metres-free px of its azimuth (a
  // turn's share per px), frc its ring coordinate's per px, mpp its metres per px: the panels' tones, painted rings, the
  // raised seams' light, the scour into alb; the seams' and vents' ink.
  float domesRing(vec3 p) {
    if (uDomes.w > 1.5) return p.y / uDomes.x;
    return atan(p.y, max(length(p.xz), 1e-4)) / 1.5708 * uDomes.x;
  }
  float domes(vec3 p, float fphi, float frc, float mpp, inout vec3 alb) {
    bool tower = uDomes.w > 1.5;
    float rc = domesRing(p), ri = floor(rc), ink = 0.0;
    float N = tower ? uDomes.y : (ri >= uDomes.x - 1.0 ? 0.0 : max(3.0, floor(uDomes.y * cos((ri + 0.5) / uDomes.x * 1.5708) + 0.5)));
    float phi = atan(p.z, p.x) / 6.28318;
    float u = phi * N + hash(vec2(ri, 3.3)), pj = floor(u);
    float pR = 1.0 / max(frc, 1e-6), pA = N > 0.0 ? 1.0 / max(fphi * N, 1e-6) : 1e4;
    vec2 id = vec2(ri, N > 0.0 ? pj - N * floor(pj / N) : 0.0);
    // a ring painted another colour now and then (the sheet's bands), a few panels of another tone
    float rOdd = ri - 2.0 * floor(ri * 0.5);
    if (uDomesBand.a > 0.0 && rOdd > 0.5 && (tower || ri < uDomes.x - 1.0) && hash(vec2(ri, 11.3)) < uDomesBand.a * 2.0) alb = uDomesBand.rgb;
    float ho = hash(id + 7.1);
    if (ho < ${f(D.odd)}) alb *= mix(vec3(1.0), ho < ${f(D.odd / 2)} ? vec3(0.94, 0.955, 0.965) : vec3(1.04, 1.02, 0.975), smoothstep(3.0, 8.0, min(pR, pA)));
    // wind-polished top, sand-scoured foot
    if (!tower) alb *= 1.0 + 0.035 * smoothstep(0.65, 0.9, rc / uDomes.x);
    float sc = 1.0 - smoothstep(0.3, uDomes.z, p.y + 0.8 * (vnoise(p.xz * 0.6) - 0.5));
    alb = mix(alb, alb * vec3(1.03, 0.95, 0.84), sc * 0.55);
    // the seams: rings (staying far) and the joints round them (going first), each with a light line over it: raised
    float dR = abs(fract(rc + 0.5) - 0.5) * pR, dA = abs(fract(u + 0.5) - 0.5) * pA;
    float kR = smoothstep(3.0, 7.0, pR), kA = smoothstep(6.0, 12.0, pA) * kR;
    ink = max(ink, max(inkLine(dR, 0.8) * kR, inkLine(dA, 0.7) * kA) * 0.7);
    float e = fract(rc) * pR;
    alb *= 1.0 + 0.08 * smoothstep(0.9, 1.6, e) * (1.0 - smoothstep(1.6, 3.0, e)) * smoothstep(8.0, 14.0, pR);
    // a small round vent in the odd panel, near
    float rv = 0.16 / max(mpp, 1e-6);
    if (N > 0.0 && rv > 1.5 && hash(id + 2.9) < ${f(D.vent)}) {
      vec2 v = vec2((fract(u) - 0.5) * pA, (fract(rc) - 0.55) * pR);
      float dv = length(v);
      alb *= 1.0 - 0.35 * (1.0 - smoothstep(rv * 0.7, rv * 0.8, dv));
      ink = max(ink, inkLine(abs(dv - rv), 0.8) * smoothstep(1.5, 3.0, rv) * 0.8);
    }
    return ink;
  }
`;

export const CHANNEL_GLSL = /* glsl */ `
  // ---------------------------------------------------------------- a water channel (src/surface-marks.js CHANNEL)
  // A channel's water at p (object space: along x or z, its middle at 0), fw its metres per px along x, y, z, t the time:
  // the light along its edges and the wet lip into alb; the flow lines' ink.
  float channel(vec3 p, vec3 fw, float t, inout vec3 alb) {
    bool az = uChannel.y > 0.5;
    float a = az ? p.z : p.x, cr = az ? p.x : p.z;
    float fc = max(az ? fw.x : fw.z, 1e-6), hw = uChannel.x, e = hw - abs(cr);
    // the darker wet lip at its very edge, a pale line of light a little in from it
    float lipW = max(0.02, 1.2 * fc), e0 = max(0.055, 2.6 * fc), lw = max(0.016, 1.1 * fc);
    alb = mix(alb, alb * 0.7, 1.0 - smoothstep(lipW * 0.6, lipW, e));
    alb = mix(alb, vec3(0.95, 0.98, 0.92), (1.0 - smoothstep(lw * 0.5, lw, abs(e - e0))) * 0.9);
    // calm flow lines along the current, wavering, in long runs, carried down it; gone far
    float kF = smoothstep(5.0, 10.0, 0.5 * hw / fc), ink = 0.0;
    if (kF > 0.0) {
      float s = a - t * uChannel.z;
      for (int k = 0; k < 3; k++) {
        float fk = float(k), c0 = hw * (fk - 1.0) * 0.5 + hw * 0.36 * (vnoise(vec2(s * 0.8, fk * 7.3)) - 0.5);
        float run = smoothstep(0.42, 0.56, vnoise(vec2(s * 0.35, fk * 3.1 + 9.0)));
        ink = max(ink, inkLine(abs(cr - c0) / fc, 0.7) * run * kF * 0.65);
      }
    }
    return ink;
  }
`;

export const ROCK_TOP_GLSL = /* glsl */ `
  // ---------------------------------------------------------------- a rock's walked top (src/surface-marks.js ROCK_TOP, issue 685)
  // (the open-ground sheet's marks in their rock version: the sky stones' tables, plateaus, island and arch, where the
  //  author walks; their sides keep the strata)
  // the warmer patches' field (its border at 0.6, jagged by a fine octave), the cooler ones' (under 0.3), the fissures'
  float rockTopWarm(vec2 p) { return vnoise(p * 0.035 + 7.1) * 0.6 + vnoise(p * 0.13 + 2.9) * 0.3 + vnoise(p * 0.8 + 5.5) * 0.1; }
  float rockTopCool(vec2 p) { return vnoise(p * 0.05 + 13.7) * 0.7 + vnoise(p * 0.19 + 6.1) * 0.3; }
  float rockTopFissure(vec2 p) { return vnoise(p * 0.09 + 3.3) * 0.8 + vnoise(p * 0.45 + 1.1) * 0.2; }
  // A rock's top at p (world), fw its metres per px along x, y, z, n its world normal, s2 the sun's way across the ground,
  // len its shadows' length: the patches' tones into alb; the crack net's, the patches' edge's, the fissures' and the
  // pebbles' ink. Its sides (n.y under ~0.8) are left as they are.
  float rockTop(vec3 p, vec3 fw, vec3 n, vec2 s2, float len, inout vec3 alb) {
    vec2 q = p.xz;
    float gm = max(max(fw.x, fw.z), 1e-6);
    float v1 = rockTopWarm(q), v2 = rockTopCool(q), v3 = rockTopFissure(q);
    float f1 = max(fwidth(v1), 1e-5), f2 = max(fwidth(v2), 1e-5), f3 = max(fwidth(v3), 1e-5);
    // (the fissures' field across the ground, for the painted relief: its screen derivatives and the ground's, in uniform flow)
    vec4 rtD = vec4(dFdx(q), dFdy(q));
    vec2 rtV = vec2(dFdx(v3), dFdy(v3));
    float up = smoothstep(0.72, 0.88, n.y);
    if (up <= 0.0) return 0.0;
    float k = uRockTop.z * up, ink = 0.0;
    // the patches: a warmer, sandier tone and a cooler grey one, each soft over a few pixels (never a colour edge)
    float w1 = max(0.012, 4.0 * f1), w2 = max(0.012, 4.0 * f2);
    float warm = smoothstep(0.6 - w1, 0.6 + w1, v1), cool = 1.0 - smoothstep(0.3 - w2, 0.3 + w2, v2);
    alb *= mix(vec3(1.0), vec3(1.0, 0.965, 0.9), warm * k * 0.85);
    alb *= mix(vec3(1.0), vec3(0.95, 0.955, 0.985), cool * k);
    alb *= 1.0 + 0.035 * (vnoise(q * 2.3 + 4.4) - 0.5) * k * (1.0 - smoothstep(0.01, 0.025, gm));   // (a fine mottle, near)
    // the warm patches' edge: a broken pen line along it, near and in the middle distance
    float brk = smoothstep(0.32, 0.5, vnoise(q * 0.7 + 8.3));
    ink = max(ink, inkLine(abs(v1 - 0.6) / f1, 0.9) * brk * 0.65 * k * (1.0 - smoothstep(0.03, 0.08, gm)));
    // a crackled net of small cells in the warm patches (the sheet's dried crust), near
    float C = uRockTop.x, cpx = C / gm, kC = smoothstep(8.0, 16.0, cpx) * smoothstep(0.35, 0.8, warm);
    if (kC > 0.0) {
      float gaps = smoothstep(0.42, 0.62, vnoise(q * 0.9 + 2.2)) * smoothstep(0.45, 0.85, warm * (0.6 + 0.8 * vnoise(q * 0.3 + 5.1)));
      float reach = (0.45 * uPixelRatio + 0.6) / cpx * 1.01;
      float d = voronoiBorder(q / C, reach) * cpx;
      ink = max(ink, inkLine(d, 0.7) * gaps * kC * 0.45 * k);
    }
    // long fissures across the rock, jagged, in runs, out to the middle distance
    float run = smoothstep(0.52, 0.64, vnoise(q * 0.04 + 9.9));
    ink = max(ink, inkLine(abs(v3 - 0.5) / f3, 1.0) * run * 0.75 * k * (1.0 - smoothstep(0.05, 0.14, gm)));
    // painted relief: a fissure engraved, its wall toward the sun in shade, its far lip lit (the field's way across the
    // ground from its screen derivatives: the 2 x 2 inverse of the ground's)
    if (uRelief > 0.0 && run > 0.0) {
      float det = rtD.x * rtD.w - rtD.y * rtD.z;
      vec2 gv = vec2(rtD.w * rtV.x - rtD.y * rtV.y, rtD.x * rtV.y - rtD.z * rtV.x) / (abs(det) > 1e-14 ? det : 1e-14);
      vec2 away = normalize(gv + 1e-9) * (v3 > 0.5 ? 1.0 : -1.0);
      // (half strength: the fissure's field is steep across it, so its band is narrow and a full one was inked by
      //  post.js as a second line beside the fissure)
      alb = reliefTone(alb, reliefEdge(abs(v3 - 0.5) / f3, -away, uSunDir.xz, 1.0) * run * k * (1.0 - smoothstep(0.03, 0.09, gm)) * 0.5);
    }
    // pebbles and stones with their shadows (castK 1: a top is in the sun)
    if (uRockTop.y > 0.0 && gm < 0.25) {
      ink = max(ink, pebbleField(q, gm, s2, len, 1.0, 1.1, uRockTop.y * 0.55, vec2(0.04, 0.11), 63.0) * up);
      ink = max(ink, pebbleField(q, gm, s2, len, 1.0, 4.0, uRockTop.y * 0.6, vec2(0.1, 0.26), 87.0) * up);
    }
    return ink;
  }
`;

const CF = CRYSTAL_FACETS;

export const CRYSTAL_FACETS_GLSL = /* glsl */ `
  // ---------------------------------------------------------------- Lorn's crystals (src/surface-marks.js CRYSTAL_FACETS)
  // how far x is from the nearest whole number
  float crystalWhole(float x) { return abs(x - floor(x + 0.5)); }
  float crystalMax(vec3 c) { return max(max(c.r, c.g), max(c.b, 1e-3)); }
  // A crystal at fu (its uv by facetUV: u in facets round it, v up it from the root; v < 0 a face with no facet frame), fw
  // the per px of u, u - v and v, n its world normal (flat), vd the way to the eye, sun the sun's, p the point (world), mpp
  // its metres per px: each facet's tone, the root's glow, the rim, a split, fractures and inclusions into alb and emit
  // (the glow); the split's ink.
  float crystalFacets(vec2 fu, vec3 fw, vec3 n, vec3 vd, vec3 sun, vec3 p, float mpp, inout vec3 alb, inout float emit) {
    // each facet one flat tone: lighter toward the sky and the sun, its own a little (a seed from its flat normal, steady
    // over the face and different on the next crystal's), deeper and cooler in shade
    float sunK = dot(n, sun), seed = fract(dot(n, vec3(17.31, 31.73, 23.17)));
    alb *= (1.0 + ${f(CF.sky)} * n.y + ${f(CF.sun)} * sunK + ${f(CF.tone)} * (seed - 0.5)) * mix(vec3(${CF.shade.map(f).join(', ')}), vec3(1.0), smoothstep(-0.35, 0.25, sunK));
    // (an albedo channel over ~0.9 is printed as a grain of specks, not a flat light: each tone scaled down whole under a
    //  ceiling, its hue kept, the facets under 0.72 so the glow and the rim have room over them)
    alb *= min(1.0, 0.72 / crystalMax(alb));
    if (fu.y < -0.5) return 0.0;
    // the inner glow, brighter toward the root and where you look into the facet: paler, and glowing a little more
    // (in three flat steps up from the root, each under post.js's colour-edge threshold: a smooth ramp there is printed
    //  as a dithered grain, never flat colour)
    float v = clamp(fu.y, 0.0, 1.0), vpx = max(fw.z, 1e-5), root = 0.0;
    for (int k = 1; k <= 3; k++) root += 1.0 - smoothstep(-1.0, 1.0, (v - ${f(CF.root)} * float(k) / 3.0) / vpx);
    root /= 3.0;
    float gk = root * (0.6 + 0.4 * clamp(dot(n, vd), 0.0, 1.0)) * uFacetMarks.y;
    vec3 warm = alb + vec3(0.16, 0.1, 0.13);   // (a warm pale light, as the sheet's)
    alb = mix(alb, warm * (0.88 / crystalMax(warm)), gk * 0.9);
    emit = max(emit, min(uGlow + ${f(CF.emit)} * gk, 0.95));
    // the facet: which one (its triangle runs (x, 0), (x + 1, 0), (x + 1, 1) in uv) and how big on screen
    float x = floor(fu.x - 0.5 * fu.y), a = fu.x - x;
    float fpx = 1.0 / max(fw.x, 1e-5), ink = 0.0;
    float h = fract(seed * 13.7 + x * 0.618);
    // a pale rim along its two long edges, soft inward (never a colour edge post.js inks: its crease is the line)
    float d = min(crystalWhole(fu.x) / max(fw.x, 1e-5), crystalWhole(fu.x - fu.y) / max(fw.y, 1e-5));
    float rw = clamp(fpx * 0.06, 2.5, 7.0) * uPixelRatio;
    vec3 pale = alb + 0.2;
    alb = mix(alb, pale * (0.88 / crystalMax(pale)), (1.0 - smoothstep(0.0, rw, d)) * smoothstep(5.0, 14.0, fpx) * ${f(CF.rim)} * uFacetMarks.x);
    // now and then a facet split in two from its point down to its root, the two halves a shade apart, a fine line between
    if (h < ${f(CF.split)}) {
      float a0 = 0.25 + 0.5 * fract(h * 7.31), s = a - a0 - (1.0 - a0) * v;
      float sp = abs(s) / max(fw.x + (1.0 - a0) * fw.z, 1e-5);
      alb *= 1.0 + 0.07 * (smoothstep(-1.5, 1.5, s / max(fw.x, 1e-5)) - 0.5) * smoothstep(10.0, 20.0, fpx);
      ink = max(ink, inkLine(sp, 0.5) * 0.8 * smoothstep(16.0, 40.0, fpx));
    }
    alb *= min(1.0, 0.88 / crystalMax(alb));
    // near: sparse fractures and tiny inclusions, in the facet's own plane (metres)
    float kN = (1.0 - smoothstep(0.012, 0.03, mpp)) * uFacetMarks.z;
    if (kN > 0.0 && uWearLite < 0.5) {
      vec3 t1 = normalize(abs(n.y) < 0.95 ? cross(n, vec3(0.0, 1.0, 0.0)) : vec3(1.0, 0.0, 0.0)), t2 = cross(n, t1);
      vec2 q = vec2(dot(p, t1), dot(p, t2)) + seed * 37.0;
      // a fracture: a pale hairline at its own slant across a cell, wavering
      vec2 cc = floor(q / ${f(CF.crack[0])});
      if (hash(cc + 4.7) < ${f(CF.crack[1])}) {
        float an = 0.6 + 1.9 * hash(cc + 1.3);
        vec2 dir = vec2(cos(an), sin(an)), o = (cc + 0.25 + 0.5 * hash2(cc + 9.1)) * ${f(CF.crack[0])}, r = q - o;
        float along = dot(r, dir), off = dot(r, vec2(-dir.y, dir.x)) - 0.025 * (vnoise(vec2(along * 7.0, cc.x + cc.y * 3.1)) - 0.5);
        float reach = ${f(CF.crack[0])} * (0.3 + 0.35 * hash(cc + 6.2));
        float on = 1.0 - smoothstep(reach * 0.6, reach, abs(along)), dp = abs(off) / mpp;
        // (pale as a light, through the glow: a paler albedo there would be a colour edge post.js breaks into specks)
        emit = max(emit, (1.0 - smoothstep(0.4, 1.4, dp)) * on * kN * 0.86);
      }
      // inclusions: tiny bright specks, a few a facet
      vec2 dq = q / ${f(CF.dots[0])}, dc = floor(dq);
      float dd = length((fract(dq) - 0.2 - 0.6 * hash2(dc + 21.0)) * ${f(CF.dots[0])}) / mpp, dr = max(0.012 / mpp, 0.8 * uPixelRatio);
      float dot1 = (1.0 - smoothstep(dr - 0.5, dr + 0.5, dd)) * step(hash(dc + 5.5), ${f(CF.dots[1])}) * kN;
      emit = max(emit, dot1 * 0.92);
    }
    return ink;
  }
`;

/** Every module's GLSL in one (the Unity port's SurfaceMarks.hlsl is made from this). */
export const MARKS_GLSL = [INTERIOR_GLSL, SHEET_GLSL, TIMBER_GLSL, GROUND_MID_GLSL, SEA_WALL_GLSL, PALE_STONE_GLSL, BURIED_CITY_GLSL, DOMES_GLSL, CHANNEL_GLSL, ROCK_TOP_GLSL, CRYSTAL_FACETS_GLSL];
