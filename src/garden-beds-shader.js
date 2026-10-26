// Garden beds (issue #691, makeMaterial({ beds }), S_BEDS): planted beds and tilled soil as the picked sheet draws them
// (references/surfaces/garden-beds/sheet-1.jpg): earth raked in straight furrows, a ridge lit and a furrow shaded, rows of
// seedlings and small rounded bushes along the ridges (a share of the rows planted), a few bare patches of drier, paler
// earth, scattered pebbles each with a small shadow. On a material's upward faces only (a bed's sides keep their colour).
// Every mark goes by its size on screen, as the sheet's distance strip: pebbles and the furrows' pen lines near, the plants
// and the ridges' tone in the middle distance, flat colour far, the rows the last to go.
//
// BEDS_GLSL is the very GLSL the web draws (materials.js includes it under S_BEDS); scripts/unity-export/beds-hlsl.mjs turns
// it into the Unity port's Shaders/GardenBeds.hlsl (tests/garden-beds.test.js checks it is current). It reads the surface
// shader's hash, vnoise, inkLine, uPixelRatio, uWearLite and the material's uBeds.

/**
 * row: a furrow-to-furrow spacing (m); plants: the share of the rows planted, their spacing along a row (× the row) and their
 * radius (× the row, from + up to), their green; ridge: the ridges' and furrows' tone (±); dry: the drier patches' share and
 * how much paler; pebble: its cell (m), share, radius (m); far: the rows' fade (px a row), the plants' (px a plant), the near
 * marks' (m a px).
 */
export const BEDS = {
  row: 0.55,
  plants: { share: 0.7, step: 1.15, r: [0.2, 0.16], green: [0.5, 0.62, 0.32], dark: [0.27, 0.38, 0.2] },
  ridge: 0.09,
  dry: { share: 0.3, pale: [1.28, 1.2, 1.1] },
  pebble: { cell: 0.6, share: 0.22, r: 0.035 },
  far: { rows: [3, 8], plants: [2.5, 6], near: [0.006, 0.014] },
};

/**
 * A material's beds as its uniform: [row (m), turn (rad: the rows' direction from x), plants (share of rows planted), 1],
 * or zeros. beds: true (the defaults), a number (the row, m) or { row, turn, plants }. Never on terrain, water, glass,
 * figures or lights.
 */
export function bedsOf(o) {
  const b = o.beds;
  if (!b || o.glass || o.glow || o.figure || o.facePart || o.eye || o.mode === 1 || o.mode === 3) return [0, 0, 0, 0];
  const d = typeof b === 'object' ? b : typeof b === 'number' ? { row: b } : {};
  return [Math.max(d.row ?? BEDS.row, 0.15), d.turn ?? 0, Math.min(Math.max(d.plants ?? BEDS.plants.share, 0), 1), 1];
}

const f = (v) => (Number.isInteger(v) ? `${v}.0` : `${v}`);
const B = BEDS, v3 = (a) => `vec3(${a.map(f).join(', ')})`;

export const BEDS_GLSL = /* glsl */ `
  // ---------------------------------------------------------------- garden beds (src/garden-beds-shader.js)
  // A bed's top at p (world xz), fw its metres per px along x and z, s2 the sun's way across the ground: the furrows' and
  // ridges' tone, the drier patches, the plants and the pebbles into alb; the furrows', plants' and pebbles' ink.
  float gardenBeds(vec2 p, vec2 fw, vec2 s2, inout vec3 alb) {
    float R = uBeds.x, c = cos(uBeds.y), s = sin(uBeds.y);
    vec2 q = vec2(c * p.x + s * p.y, -s * p.x + c * p.y);
    vec2 fq = vec2(abs(c) * fw.x + abs(s) * fw.y, abs(s) * fw.x + abs(c) * fw.y);
    float px = max(max(fq.x, fq.y), 1e-6), ink = 0.0;
    // the drier, paler patches (soft, under the colour-edge threshold)
    float dryN = vnoise(p * 0.18 + 3.1) * 0.7 + vnoise(p * 0.7 + 8.3) * 0.3;
    float dry = smoothstep(1.0 - ${f(B.dry.share)} - 0.08, 1.0 - ${f(B.dry.share)} + 0.08, dryN);
    alb *= mix(vec3(1.0), ${v3(B.dry.pale)}, dry * 0.6);
    // the rows: a ridge lit, a furrow shaded; a fine pen line along the furrow's bottom near
    float kR = smoothstep(${f(B.far.rows[0])}, ${f(B.far.rows[1])}, R / max(fq.y, 1e-6));
    if (kR <= 0.0) return 0.0;
    float v = q.y / R, row = floor(v), fv = fract(v);
    alb *= 1.0 + ${f(B.ridge)} * cos(6.2831853 * fv) * kR * (1.0 - dry * 0.6);
    float dF = abs(fv - 0.5) * R / max(fq.y, 1e-6);
    ink = max(ink, inkLine(dF, 0.6) * 0.32 * kR * smoothstep(8.0, 16.0, R / max(fq.y, 1e-6)) * (1.0 - dry * 0.7));
    // the plants along the ridges of the planted rows: seedlings and small rounded bushes, a shadow on the ground beside each
    float planted = step(hash(vec2(row, 4.7)), uBeds.z) * (1.0 - dry);
    if (planted > 0.0) {
      float S = R * ${f(B.plants.step)}, u = q.x / S + hash(vec2(row, 1.3)), cell = floor(u);
      float big = step(0.5, hash(vec2(row, 9.1)));
      float r = R * (${f(B.plants.r[0])} + ${f(B.plants.r[1])} * big) * (0.8 + 0.4 * hash(vec2(cell, row) + 2.2));
      float kP = smoothstep(${f(B.far.plants[0])}, ${f(B.far.plants[1])}, r / px);
      if (kP > 0.0 && hash(vec2(cell, row) + 6.1) > 0.12) {
        vec2 ctr = vec2((cell + 0.5 + 0.25 * (hash(vec2(cell, row) + 5.5) - 0.5) - hash(vec2(row, 1.3))) * S, (row + 0.5) * R);
        vec2 qq = q - ctr;
        vec2 sh = vec2(c * s2.x + s * s2.y, -s * s2.x + c * s2.y);
        float dS = length(qq + sh * r * 0.7);
        alb *= 1.0 - 0.3 * (1.0 - smoothstep(r * 0.85, r * 1.05, dS)) * kP;
        float d = length(qq) * (1.0 + 0.18 * sin(atan(qq.y, qq.x) * 5.0 + cell));
        float inP = 1.0 - smoothstep(r - px, r + px, d);
        vec3 g = mix(${v3(B.plants.dark)}, ${v3(B.plants.green)}, smoothstep(-r, r * 0.6, dot(qq, -sh)));
        alb = mix(alb, g, inP * kP);
        ink = max(ink, inkLine(abs(d - r) / px, 0.8) * 0.75 * kP);
      }
    }
    // near: pebbles, each with a small shadow
    float kN = 1.0 - smoothstep(${f(B.far.near[0])}, ${f(B.far.near[1])}, px);
    if (kN > 0.0 && uWearLite < 0.5) {
      vec2 pc = floor(p / ${f(B.pebble.cell)});
      if (hash(pc + 7.3) < ${f(B.pebble.share)}) {
        vec2 o = (pc + 0.2 + 0.6 * vec2(hash(pc + 1.1), hash(pc + 2.9))) * ${f(B.pebble.cell)};
        float pr = ${f(B.pebble.r)} * (0.7 + 0.6 * hash(pc + 4.4)), d = length(p - o);
        alb *= 1.0 - 0.28 * (1.0 - smoothstep(pr * 0.9, pr * 1.1, length(p - o + s2 * pr * 0.8))) * kN;
        float on = 1.0 - smoothstep(pr - px, pr + px, d);
        alb = mix(alb, vec3(0.86, 0.83, 0.76), on * kN);
        ink = max(ink, inkLine(abs(d - pr) / px, 0.6) * 0.6 * kN);
      }
    }
    return ink;
  }
`;
