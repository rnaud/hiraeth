// Paving (issue #669, makeMaterial({ paving }), S_PAVING): the plazas' and streets' flagstones as the picked sheet draws
// them (references/surfaces/paving/sheet-1.jpg): courses of uneven depth with staggered joints, stones of uneven length,
// worn round corners, each stone a shade lighter or darker (a few rosier or sandier, now and then a patch of another stone), the odd
// cracked slab, grit gathered in the joints, small pits, and a brass survey disc here and there. Drawn on a paved
// material's upward faces only (its sides keep their grid). Every mark goes by its size on screen, as the sheet's distance
// strip draws it: dense near (grit, pits, cracks), the joints and tones in the middle distance (the joints across a course
// first, the seams between courses last), flat colour far: no grey ruled field toward the horizon.
//
// PAVING_GLSL is the very GLSL the web draws (materials.js includes it under S_PAVING); scripts/unity-export/paving-hlsl.mjs
// turns it into the Unity port's Shaders/Paving.hlsl (tests/engine-unity.test.js checks it is current). It reads the
// surface shader's hash, hash2, inkLine, uPixelRatio, uWearLite and the material's uPaving.

/**
 * size: a course's depth (m, the default; a material's paving: n asks for n); len: a course's stones' length (× the course,
 * from + up to); jitter: how far each seam (row) and joint (col) moves (a share of a course or a stone); corner: the worn
 * corners' radius (× the course); joint: the joints' line (CSS px) and strength; far: each layer's fade by its size on
 * screen (px: the joints by their stone's length, the seams by its depth, the tones by its smaller side); tone: value (±),
 * the tint of the warmer and cooler stones, their shares and the patches' (× wear); near: metres per px over which the fine
 * marks (grit, pits) fade, crack: theirs, and the share of cracked stones (× wear), their kinks (× the course), amplitude
 * (× the course), width (px: at the edge, at the end) and strength; grit: its cell (m), the band along the joints (m), its
 * dots' radius (px), share and strength; pit: the same in the stone's face; disc: a brass survey disc's share of the
 * stones, radius (m) and colour.
 */
export const PAVING = {
  size: 1.6,
  len: [1.1, 0.9],
  jitter: { row: 0.4, col: 0.5 },
  corner: 0.06,
  joint: { width: 1.0, ink: 0.8 },
  far: { joint: [8, 16], seam: [7, 14], tone: [8, 20] },
  tone: { value: 0.035, tint: 0.07, warm: 0.18, cool: 0.14, patch: 0.03 },
  near: [0.005, 0.01],
  crack: { far: [0.012, 0.025], share: 0.14, kink: [0.11, 0.42], amp: [0.035, 0.09], width: [0.9, 0.35], ink: 0.75 },
  grit: { cell: 0.035, band: [0.012, 0.04], r: 0.8, share: 0.45, ink: 0.65 },
  pit: { cell: 0.22, r: 0.9, share: 0.16, ink: 0.55 },
  disc: { share: 0.018, r: 0.1, color: [0.8, 0.64, 0.33] },
};

/**
 * A material's paving as its uniform: [course (m), wear 0..2, tone 0..2, turn (rad: the courses' direction)], or zeros.
 * paving: true (the defaults), a number (the course, m) or { size, wear, tone, turn }. Never on terrain, water, glass,
 * figures or lights.
 */
export function pavingOf(o) {
  const p = o.paving;
  if (!p || o.glass || o.glow || o.figure || o.facePart || o.eye || o.mode === 1 || o.mode === 3) return [0, 0, 0, 0];
  const d = typeof p === 'object' ? p : typeof p === 'number' ? { size: p } : {};
  const clamp = (v, a, b) => Math.min(Math.max(v, a), b);
  return [Math.max(d.size ?? PAVING.size, 0.2), clamp(d.wear ?? 1, 0, 2), clamp(d.tone ?? 1, 0, 2), d.turn ?? 0];
}

const f = (v) => (Number.isInteger(v) ? `${v}.0` : `${v}`);
const P = PAVING;

export const PAVING_GLSL = /* glsl */ `
  // ---------------------------------------------------------------- paving (src/paving-shader.js)
  // a course's seam (its foot) and a stone's joint in its course, each moved by a share of a course or a stone
  float paveSeam(float r, float S) { return (r + ${f(P.jitter.row)} * (hash(vec2(r, 3.7)) - 0.5)) * S; }
  float paveJoint(float c, float r) { return c + ${f(P.jitter.col)} * (hash(vec2(c, r) + 1.7) - 0.5); }
  // a line jagged as a crack is, kinked every unit: -0.5..0.5
  float paveJag(float x, float sd) { float i = floor(x); return mix(hash(vec2(i, sd)), hash(vec2(i + 1.0, sd)), x - i) - 0.5; }
  // the stone p (m, courses along x) lies in: its box (x0, y0, x1, y1) and its cell (its column, its course)
  vec4 paveStone(vec2 p, float S, out vec2 id) {
    float r = floor(p.y / S);
    if (p.y < paveSeam(r, S)) r -= 1.0;
    else if (p.y >= paveSeam(r + 1.0, S)) r += 1.0;
    float L = S * (${f(P.len[0])} + ${f(P.len[1])} * hash(vec2(r, 8.1)));
    float o = hash(vec2(r, 5.3)) * 7.0;
    float u = p.x / L + o, c = floor(u);
    if (u < paveJoint(c, r)) c -= 1.0;
    else if (u >= paveJoint(c + 1.0, r)) c += 1.0;
    id = vec2(c, r);
    return vec4((paveJoint(c, r) - o) * L, paveSeam(r, S), (paveJoint(c + 1.0, r) - o) * L, paveSeam(r + 1.0, S));
  }
  // A paved face at p (m: world x, z), fp its metres per device px along each: each stone's tone into alb; its ink.
  float paving(vec2 p, vec2 fp, inout vec3 alb) {
    float S = uPaving.x, wear = uPaving.y;
    float ca = cos(uPaving.w), sa = sin(uPaving.w);
    p = vec2(ca * p.x + sa * p.y, ca * p.y - sa * p.x);
    fp = max(vec2(abs(ca) * fp.x + abs(sa) * fp.y, abs(sa) * fp.x + abs(ca) * fp.y), vec2(1e-6));
    // (far off, the longest stone under its joints' and its course under its seams' first fade: flat colour, nothing to pay)
    if (${f(P.len[0] + P.len[1])} * ${f(1 + P.jitter.col / 2)} * S / fp.x < ${f(P.far.joint[0])} && ${f(1 + P.jitter.row)} * S / fp.y < ${f(P.far.seam[0])}) return 0.0;
    vec2 id;
    vec4 b = paveStone(p, S, id);
    vec2 h = 0.5 * (b.zw - b.xy), q = p - 0.5 * (b.xy + b.zw);
    vec2 spx = 2.0 * h / fp;
    float fm = max(fp.x, fp.y);
    // its outline: a box with worn round corners; how far in from its edge this is (px, across that edge)
    float rc = min(${f(P.corner)} * S, 0.45 * min(h.x, h.y));
    vec2 a = abs(q) - (h - rc);
    float dm;
    vec2 g;
    if (a.x > 0.0 && a.y > 0.0) { float l = length(a); dm = l - rc; g = a / max(l, 1e-6); }
    else if (a.x > a.y) { dm = a.x - rc; g = vec2(1.0, 0.0); }
    else { dm = a.y - rc; g = vec2(0.0, 1.0); }
    float dpx = max(-dm / dot(g, fp), 0.0);
    // the joints by distance: those across a course go first, the seams between the courses last
    float kJ = smoothstep(${f(P.far.joint[0])}, ${f(P.far.joint[1])}, spx.x), kR = smoothstep(${f(P.far.seam[0])}, ${f(P.far.seam[1])}, spx.y);
    float ink = inkLine(dpx, ${f(P.joint.width)}) * mix(kR, kJ, g.x) * ${f(P.joint.ink)};
    // each stone its tone: a shade lighter or darker, a few rosier or sandier, now and then a patch of another stone
    float t = hash(id + 4.3), wear1 = min(wear, 1.0);
    vec3 m = vec3(1.0 + ${f(P.tone.value * 2)} * (hash(id + 0.17) - 0.5));
    if (t < ${f(P.tone.warm)}) m *= vec3(${f(1 + P.tone.tint * 0.3)}, ${f(1 - P.tone.tint * 0.35)}, ${f(1 - P.tone.tint * 0.25)});
    else if (t < ${f(P.tone.warm + P.tone.cool)}) m *= vec3(${f(1 - P.tone.tint * 0.05)}, ${f(1 - P.tone.tint * 0.1)}, ${f(1 - P.tone.tint * 0.5)});
    bool patched = t > 1.0 - ${f(P.tone.patch)} * wear;
    if (patched) m *= vec3(0.94, 0.95, 0.97);
    alb *= mix(vec3(1.0), m, smoothstep(${f(P.far.tone[0])}, ${f(P.far.tone[1])}, min(spx.x, spx.y)) * uPaving.z);
    // a crack across the odd stone, from one edge, jagged, thinning to its end inside it
    float kC = 1.0 - smoothstep(${f(P.crack.far[0])}, ${f(P.crack.far[1])}, fm);
    if (kC > 0.0 && hash(id + 9.7) < ${f(P.crack.share)} * wear) {
      float sd = floor(hash(id + 2.9) * 61.0);
      float an = (hash(id + 3.1) - 0.5) * 1.1 + (h.x > h.y ? 1.5708 : 0.0);
      vec2 dir = vec2(cos(an), sin(an)), nr = vec2(-dir.y, dir.x);
      vec2 o = (vec2(hash(id + 6.1), hash(id + 7.3)) - 0.5) * h;
      float s = dot(q - o, dir), off = dot(q - o, nr);
      float j = (paveJag(s / (${f(P.crack.kink[0])} * S), sd) * ${f(P.crack.amp[0])} + paveJag(s / (${f(P.crack.kink[1])} * S), sd + 17.0) * ${f(P.crack.amp[1])}) * S;
      float hl = length(h), end = (hash(id + 8.3) * 0.8 - 0.2) * hl;
      float w = mix(${f(P.crack.width[0])}, ${f(P.crack.width[1])}, smoothstep(end - 0.6 * hl, end, s));
      float cpx = abs(off - j) / max(dot(abs(nr), fp), 1e-6);
      ink = max(ink, inkLine(cpx, w) * (1.0 - smoothstep(end - 0.12 * S, end, s)) * step(0.5, dpx) * kC * ${f(P.crack.ink)});
    }
    // near: grit gathered in the joints, pits in the stone's face (a patched stone's grain), a brass survey disc
    float kN = 1.0 - smoothstep(${f(P.near[0])}, ${f(P.near[1])}, fm);
    if (kN > 0.0 && uWearLite < 0.5) {
      vec2 gc = p / ${f(P.grit.cell)}, gi = floor(gc);
      vec2 gd = (fract(gc) - 0.2 - 0.6 * hash2(gi + 31.0)) * ${f(P.grit.cell)} / fp;
      float gr = ${f(P.grit.r)} * uPixelRatio * (0.7 + 0.6 * hash(gi + 2.0));
      float band = 1.0 - smoothstep(${f(P.grit.band[0])}, ${f(P.grit.band[1])}, -dm);
      ink = max(ink, (1.0 - smoothstep(gr - 0.6, gr + 0.6, length(gd))) * step(hash(gi + 5.0), ${f(P.grit.share)} * wear) * band * kN * ${f(P.grit.ink)});
      vec2 pc = p / ${f(P.pit.cell)}, pq = floor(pc);
      vec2 pd = (fract(pc) - 0.2 - 0.6 * hash2(pq + 47.0)) * ${f(P.pit.cell)} / fp;
      float pr = ${f(P.pit.r)} * uPixelRatio * (0.6 + 0.8 * hash(pq + 3.0));
      float share = patched ? 0.9 : ${f(P.pit.share)} * wear1;
      ink = max(ink, (1.0 - smoothstep(pr - 0.6, pr + 0.6, length(pd))) * step(hash(pq + 8.0), share) * step(1.0, dpx) * kN * ${f(P.pit.ink)});
    }
    if (hash(id + 12.1) < ${f(P.disc.share)} && min(h.x, h.y) > ${f(P.disc.r * 2.5)}) {
      vec2 dq = q - (vec2(hash(id + 13.3), hash(id + 14.7)) - 0.5) * (h - ${f(P.disc.r * 2.5)});
      float R = ${f(P.disc.r)}, dr = length(dq);
      float kD = smoothstep(1.5, 3.5, R / fm), kDi = smoothstep(3.0, 6.0, R / fm);
      alb = mix(alb, vec3(${P.disc.color.map(f).join(', ')}), (1.0 - smoothstep(R - fm, R + fm, dr)) * kD);
      float di = inkLine(abs(dr - R) / fm, 0.9);
      di = max(di, inkLine(abs(dr - 0.55 * R) / fm, 0.6) * kDi);
      if (dr < 0.55 * R) di = max(di, inkLine(min(abs(dq.x), abs(dq.y)) / fm, 0.6) * kDi);
      ink = max(ink, di * kD);
    }
    return ink;
  }
`;

// The layout's twin in JavaScript (tests/paving.test.js checks the courses and stones it makes; the GLSL above draws them):
// materials.js hash() and the same seams, joints and stones, in doubles.
const fract = (x) => x - Math.floor(x);
function hash(x, y) {
  let px = fract(x * 123.34), py = fract(y * 456.21);
  const d = px * (px + 45.32) + py * (py + 45.32);
  px += d; py += d;
  return fract(px * py);
}
const seam = (r, S) => (r + P.jitter.row * (hash(r, 3.7) - 0.5)) * S;
const joint = (c, r) => c + P.jitter.col * (hash(c + 1.7, r + 1.7) - 0.5);
/** The stone (x, y: m, courses along x) lies in: { box: [x0, y0, x1, y1], id: [column, course] } (paveStone's). */
export function stoneAt(x, y, S = P.size) {
  let r = Math.floor(y / S);
  if (y < seam(r, S)) r -= 1;
  else if (y >= seam(r + 1, S)) r += 1;
  const L = S * (P.len[0] + P.len[1] * hash(r, 8.1)), o = hash(r, 5.3) * 7;
  const u = x / L + o;
  let c = Math.floor(u);
  if (u < joint(c, r)) c -= 1;
  else if (u >= joint(c + 1, r)) c += 1;
  return { box: [(joint(c, r) - o) * L, seam(r, S), (joint(c + 1, r) - o) * L, seam(r + 1, S)], id: [c, r] };
}
