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

const f = (v) => (Number.isInteger(v) ? `${v}.0` : `${+v.toFixed(5)}`);
const R = INTERIOR, S = SHEET, T = TIMBER;

export const INTERIOR_GLSL = /* glsl */ `
  // ---------------------------------------------------------------- interiors (src/surface-marks.js INTERIOR)
  // a grout line's place: a row's or a column's line moved a few millimetres its own way
  float interiorJ(float i, float sd) { return i + ${f(R.jitter)} * (hash(vec2(i, sd)) - 0.5); }
  // A room's floor at q (m, the room's x z), fq its metres per px each way: each tile's tone into alb; its grout's ink.
  float interiorFloor(vec2 q, vec2 fq, inout vec3 alb) {
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
  // A wall of sheet-metal panels at q (m: along, up), fq its metres per px, seed the building's: the panels' repaints and
  // rust into alb; the seams', rivets' and streaks' ink.
  float sheetWall(vec2 q, vec2 fq, float seed, inout vec3 alb) {
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
    // rivets in rows along each seam, a little in from it
    float sp = ${f(S.rivet.step)}, ins = ${f(S.rivet.inset)};
    float kR = smoothstep(4.0, 8.0, sp / fm);
    if (kR > 0.0) {
      vec2 d1 = vec2(lx - (floor(lx / sp) + 0.5) * sp, min(abs(ly - ins), abs(ly - (H - ins))));
      vec2 d2 = vec2(min(abs(lx - ins), abs(lx - (W - ins))), ly - (floor(ly / sp) + 0.5) * sp);
      float dr = min(length(d1 / fqm), length(d2 / fqm));
      float rp = max(${f(S.rivet.r)} / fm, 0.6 * uPixelRatio);
      ink = max(ink, (1.0 - smoothstep(rp - 0.6, rp + 0.6, dr)) * kR * 0.8);
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
    return ink;
  }
`;

export const TIMBER_GLSL = /* glsl */ `
  // ---------------------------------------------------------------- worked timber (src/surface-marks.js TIMBER)
  // Timber at p (object space, m), its face's axis (0 x, 1 y, 2 z: the face's normal's), pf its metres per px each way, ny
  // the world normal's y: each plank's tone, a painted one, the sun on its top into alb; its joints', grain's, knots' ink.
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
  // The ground at p (m, x z) and height y, gm its metres per px, yfw the height's per px, slope 1 - n.y, s2 the sun's way
  // across the ground, len its shadows' length, castK how lit: long lines along the fall of the slopes and stones that
  // still read off in the middle distance: their ink.
  // broad soft patches of another tone, a few percent (soft: never a colour edge): the albedo's factor
  vec3 groundMidTone(vec2 p) {
    float v = vnoise(p * 0.0045 + 5.3) * 0.6 + vnoise(p * 0.017 + 1.7) * 0.4;
    float k = smoothstep(0.5, 0.64, v) * uGroundMid.z;
    return mix(vec3(1.0), vec3(1.09, 1.07, 0.9), k);   // (paler, toward ochre: the sheet's soft drifts of another tone)
  }
  float groundMid(vec2 p, float y, float gm, float yfw, float slope, vec2 s2, float len, float castK) {
    float k = uGroundMid.z, ink = 0.0;
    // long pen lines along the fall of the slopes: the height's contours on rolling ground, in long runs, from ~15 m out
    float mid = smoothstep(0.012, 0.04, gm);
    float S = uGroundMid.x, cpx = S / max(yfw, 1e-6);
    float onSlope = smoothstep(0.03, 0.08, slope) * (1.0 - smoothstep(0.35, 0.5, slope));
    if (mid > 0.0 && onSlope > 0.0 && cpx > 6.0) {
      float run = smoothstep(0.5, 0.62, vnoise(p * 0.012 + 9.1));
      float d = abs(fract(y / S + 0.5) - 0.5) * cpx;
      ink = max(ink, inkLine(d, 0.8) * run * onSlope * mid * smoothstep(6.0, 14.0, cpx) * 0.6 * k);
    }
    // stones that still read in the middle distance (the near pebbles are ground-ink.js's)
    if (uGroundMid.y > 0.0 && gm < 0.25) ink = max(ink, pebbleField(p, gm, s2, len, castK, 4.5, uGroundMid.y, vec2(0.12, 0.3), 91.0) * mid);
    return ink;
  }
`;

/** Every module's GLSL in one (the Unity port's SurfaceMarks.hlsl is made from this). */
export const MARKS_GLSL = [INTERIOR_GLSL, SHEET_GLSL, TIMBER_GLSL, GROUND_MID_GLSL];
