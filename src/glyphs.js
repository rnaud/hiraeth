// The makers' inscriptions (makeMaterial({ glyphs }), materials.js).
//
// The makers marked everything they made (LORE.md, "The glyph"): three dots over an arc that
// bows upward (∩), and their other carved signs, the rings, the two moons, the pale four-point
// star. On their buildings (Qanat's gate and the giant's brow, the Builders' ruins in Viridel,
// the standing stones, the observatory, the shrines) they are cut into the stone:
//  - laid out like an inscription: the even rows of the wall's grid carry a frieze between two
//    incised border lines, a row of signs with the makers' mark opening every sixth; the odd rows
//    are plain wall, with now and then a seal (a framed panel holding the mark, big)
//  - carved, not drawn: each stroke is a groove, and the rim on the light's side casts a shadow
//    into it (the groove's upper part drops into the shadow tone, which post.js inks like any
//    shadow edge), with a fine outline round the cut
//  - only on upright faces, and only while a groove is at least ~1.5 px wide: far away the wall
//    is just the wall
//
// The layout below is plain integer arithmetic so the JS mirror is exact (tests/glyphs.test.js).

/** The signs, by number: 0 is the makers' mark. */
export const GLYPH_SIGNS = ['mark', 'ring and dot', 'two moons', 'pale star', 'staff under an arc', 'three over a line', 'door', 'sun on a staff'];
export const GLYPH = { band: 0.36, pitch: 0.82, border: 0.62, every: 6, seal: 0.16, sealUnit: 0.7, groove: 0.066 };

/** The layout's hash: a small integer in, 0..1 out (the same in GLSL: exact in floats). */
export function glyphHash(a) {
  a = ((a % 89) + 89) % 89;
  return ((a * a * 13 + a * 7 + 3) % 61) / 61;
}

/** Which sign sits in slot j of the frieze on row r (rows count up the wall, in grid cells). */
export function glyphSign(r, j) {
  if (((j % GLYPH.every) + GLYPH.every) % GLYPH.every === 0) return 0;
  return 1 + Math.floor(glyphHash(j + r * 31) * 7);
}

/** What a row of the wall carries: a frieze (even rows) or plain wall with seals. */
export const glyphRow = (r) => (((r % 2) + 2) % 2 === 0 ? 'frieze' : 'plain');

/** Whether cell c of a plain row r holds a seal. */
export const glyphSeal = (r, c) => glyphHash(c * 3 + r * 11 + 5) <= GLYPH.seal;

const f = (v) => v.toFixed(4);

export const GLYPH_GLSL = /* glsl */ `
  // ---------------------------------------------------------------- the makers' inscriptions (src/glyphs.js)
  float glyphHash(float a) { a = mod(a, 89.0); return mod(a * a * 13.0 + a * 7.0 + 3.0, 61.0) / 61.0; }
  float gRing(vec2 q, vec2 c, float r) { return abs(length(q - c) - r); }
  // the upper half of a ring (an arc that bows upward), its ends cut square
  float gArc(vec2 q, vec2 c, float r) { vec2 d = q - c; return d.y >= 0.0 ? abs(length(d) - r) : length(vec2(abs(d.x) - r, d.y)); }
  float gDot(vec2 q, vec2 c, float r) { return max(length(q - c) - r, 0.0); }   // a drilled dot
  float gDiamond(vec2 q, float a, float b) { vec2 p = abs(q); return (p.x / a + p.y / b - 1.0) / sqrt(1.0 / (a * a) + 1.0 / (b * b)); }
  // one sign: the distance (glyph units, the sign ~0.6 across) to its nearest stroke
  float glyphSignD(vec2 q, float k) {
    if (k < 0.5) {   // the makers' mark: three dots over an arc that bows upward
      float d = gArc(q, vec2(0.0, -0.24), 0.27);
      return min(d, min(gDot(q, vec2(-0.21, 0.2), 0.05), min(gDot(q, vec2(0.0, 0.29), 0.05), gDot(q, vec2(0.21, 0.2), 0.05))));
    }
    if (k < 1.5) return min(gRing(q, vec2(0.0), 0.25), gDot(q, vec2(0.0), 0.05));                         // a ring round a dot
    if (k < 2.5) return min(gRing(q, vec2(-0.1, 0.0), 0.19), gRing(q, vec2(0.1, 0.0), 0.19));             // the two moons
    if (k < 3.5) return abs(min(gDiamond(q, 0.1, 0.36), gDiamond(q, 0.36, 0.1)));                         // the pale star
    if (k < 4.5) return min(segDist(q, vec2(0.0, -0.32), vec2(0.0, 0.1)), gArc(q, vec2(0.0, 0.1), 0.17));  // a staff under an arc
    if (k < 5.5) return min(segDist(q, vec2(-0.26, -0.16), vec2(0.26, -0.16)),                             // three over a line
                            min(gDot(q, vec2(-0.19, 0.12), 0.05), min(gDot(q, vec2(0.0, 0.12), 0.05), gDot(q, vec2(0.19, 0.12), 0.05))));
    if (k < 6.5) return min(gArc(q, vec2(0.0, -0.3), 0.3), gArc(q, vec2(0.0, -0.3), 0.15));               // a door: two arcs
    return min(min(gRing(q, vec2(0.0, 0.15), 0.12), segDist(q, vec2(-0.24, -0.28), vec2(0.24, -0.28))),   // a sun on a staff
               segDist(q, vec2(0.0, 0.03), vec2(0.0, -0.28)));
  }
  // The inscription over a wall, g in grid cells (x along the face, y up): the distance to the
  // nearest carved stroke, in glyph units (unit: a glyph unit, in cells).
  float inscriptionD(vec2 g, out float unit) {
    float r = floor(g.y), fy = fract(g.y);
    unit = ${f(GLYPH.band)};
    if (mod(r, 2.0) < 0.5) {
      float by = (fy - 0.5) / unit;
      float border = min(abs(by - ${f(GLYPH.border)}), abs(by + ${f(GLYPH.border)}));
      float bx = g.x / (unit * ${f(GLYPH.pitch)}), j = floor(bx);
      vec2 q = vec2((fract(bx) - 0.5) * ${f(GLYPH.pitch)}, by);
      float k = mod(j, ${GLYPH.every.toFixed(1)}) < 0.5 ? 0.0 : 1.0 + floor(glyphHash(j + r * 31.0) * 7.0);
      return min(abs(by) < 0.5 ? glyphSignD(q, k) : 1e3, border);
    }
    float c = floor(g.x);
    if (glyphHash(c * 3.0 + r * 11.0 + 5.0) > ${f(GLYPH.seal)}) return 1e3;
    unit = ${f(GLYPH.sealUnit)};
    vec2 q = (fract(g) - 0.5) / unit;
    return min(glyphSignD(q, 0.0), abs(max(abs(q.x), abs(q.y)) - 0.6));
  }
  // Carved: x = the groove, y = the part of it in the rim's shadow, z = a fine outline round the cut.
  // fw: the cell coordinates' screen footprint (cells per px).
  vec3 glyphs(vec2 g, vec2 fw) {
    float px = 1.0 / max(max(fw.x, fw.y), 1e-6);
    float unit;
    float d = inscriptionD(g, unit);
    float upx = unit * px;   // px per glyph unit
    const float w = ${f(GLYPH.groove)};
    float vis = smoothstep(1.1, 2.2, 2.0 * w * upx / max(uPixelRatio, 1.0));
    if (vis <= 0.0 || d > w * 4.0) return vec3(0.0);
    float aa = 0.7 / upx;
    float groove = 1.0 - smoothstep(w - aa, w + aa, d);
    // the light comes from above and a little to the left: where the point a groove's width
    // towards it is out of the cut, the rim shades this one
    float u2;
    float dl = inscriptionD(g + vec2(-0.45, 1.0) * (w * 1.3 * unit), u2);
    float shade = groove * smoothstep(w - aa, w + aa, dl);
    float edge = inkLine(abs(d - w) * upx, 0.75) * (1.0 - shade);
    return vec3(groove, shade, edge) * vis;
  }
`;
