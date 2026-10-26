// The makers' machined finish (issue #669): what the picked sheets of the temples' walls and floors draw inside each panel
// and plate (references/surfaces/temple-walls/sheet-1.jpg, temple-floors/sheet-1.jpg), shared by the futuristic skins.
// A skin's body knows its own panels (their joints, rings and courses); it hands each pixel's panel to mkFinish(): the
// point from the panel's middle, its half size, its number. mkFinish gives it its own tone (each panel a step apart, as
// the sheets' slabs at different depths), an inlaid border line a hand in from its joints (the floors' plates, the bigger
// wall panels), small round sockets (a floor plate's corners, high up a wall panel) and, near, sparse fine machining marks.
// Clean, precise, high tech: never organic (no moss, roots, rot). Everything goes by its size on screen: the marks first,
// then the sockets and borders; far off a panel is its tone and the skin's own joints, as the sheets' distance strips.
//
// MK_GLSL joins each skin's helpers (its `glsl`), so the Unity port's SkinPatterns.hlsl gets it with the skin
// (scripts/unity-export/skin-hlsl.mjs: each skin's copy prefixed). It reads the surface shader's uPixelRatio and uWearLite.

/**
 * tone: a panel's tone, ± (a share of its colour), and the panel size on screen (px) it fades in over; inset: the border's
 * distance in from the joints (m), its line (CSS px) and strength, and how many px it must be in to be drawn; recess: the
 * share of wall panels set back, the shadow's width along their top and left edges (m) and how dark; socket: the
 * share of panels with sockets, their ring's radius (m), the dark middle's share of it and how dark; marks: the share of a
 * panel's rows (rows `row` m apart) with a mark, their length (m: from + up to), line (px), strength and the metres per
 * px over which they fade out.
 */
export const MK = {
  tone: { amount: 0.18, fade: [4, 12] },
  inset: { m: 0.13, line: 0.7, ink: 0.42, px: [3, 6] },
  recess: { share: 0.4, m: 0.06, dark: 0.3 },
  socket: { share: 0.32, r: 0.055, dark: 0.5, depth: 0.4, px: [2.2, 4.5], ink: 0.7 },
  marks: { share: 0.22, row: 0.16, len: [0.07, 0.28], line: 0.5, ink: 0.45, far: [0.004, 0.009] },
};

const f = (v) => (Number.isInteger(v) ? `${v}.0` : `${+v.toFixed(5)}`);

export const MK_GLSL = /* glsl */ `
  // the makers' machined finish (src/temples/skins/machined.js)
  float mkH(vec2 p) { return fract(sin(dot(p, vec2(41.37, 289.13))) * 43758.5453); }
  // a fine line d metres from its middle, w CSS px wide, px metres a pixel
  float mkLine(float d, float px, float w) { float hw = 0.5 * w * uPixelRatio * px; return 1.0 - smoothstep(hw, hw + px, d); }
  // A panel's or plate's finish: lp the point from its middle (m: along, across), hs its half size (m), id its number, px
  // metres a pixel, flr: a floor's plate (its border always, sockets at its corners) or a wall's panel (a border on half of
  // them, a socket high up it). Its tone into albedo; its ink.
  float mkFinish(vec2 lp, vec2 hs, float id, float px, bool flr, inout vec3 albedo) {
    vec2 e = hs - abs(lp);
    float de = min(e.x, e.y);
    if (de < 0.0) return 0.0;
    float h1 = mkH(vec2(id, 1.31)), h2 = mkH(vec2(id, 7.93)), h3 = mkH(vec2(id, 3.17));
    albedo *= 1.0 + ${f(MK.tone.amount)} * (h1 - 0.5) * smoothstep(${f(MK.tone.fade[0])}, ${f(MK.tone.fade[1])}, min(hs.x, hs.y) / px);
    float ink = 0.0;
    float inset = min(${f(MK.inset.m)}, 0.3 * min(hs.x, hs.y));
    float kB = smoothstep(${f(MK.inset.px[0])}, ${f(MK.inset.px[1])}, inset / px);
    if (kB > 0.0 && (flr || h3 < 0.5)) ink = max(ink, mkLine(abs(de - inset), px, ${f(MK.inset.line)}) * kB * ${f(MK.inset.ink)});
    // a wall's panel set back (some of them): the shadow its neighbours cast along its top and its left edge
    if (!flr && h3 > ${f(1 - MK.recess.share)}) {
      float sl = min(hs.y - lp.y, lp.x + hs.x);
      albedo *= 1.0 - ${f(MK.recess.dark)} * (1.0 - smoothstep(${f(MK.recess.m)} - px, ${f(MK.recess.m)} + px, sl)) * smoothstep(1.0, 2.5, ${f(MK.recess.m)} / px);
    }
    float R = ${f(MK.socket.r)};
    float kS = smoothstep(${f(MK.socket.px[0])}, ${f(MK.socket.px[1])}, R / px);
    if (kS > 0.0 && h2 < ${f(MK.socket.share)} && min(hs.x, hs.y) > 4.0 * R) {
      vec2 c;
      float on = 1.0;
      if (flr) {
        // at the corner of its quarter, two sockets' width in from the border; two or three of the four corners
        vec2 sg = vec2(lp.x < 0.0 ? -1.0 : 1.0, lp.y < 0.0 ? -1.0 : 1.0);
        c = sg * (hs - vec2(inset + 2.5 * R));
        on = step(0.35, mkH(sg + id * 0.37));
      } else {
        c = vec2((h3 - 0.5) * hs.x, -hs.y + min(1.4 + 1.2 * h1, 1.6 * hs.y));
      }
      float d = length(lp - c);
      ink = max(ink, mkLine(abs(d - R), px, 0.8) * kS * on * ${f(MK.socket.ink)});
      albedo *= 1.0 - ${f(MK.socket.depth)} * (1.0 - smoothstep(R * ${f(MK.socket.dark)} - px, R * ${f(MK.socket.dark)} + px, d)) * kS * on;
    }
    // near: sparse fine machining marks, short hairlines along its longer side
    float kM = 1.0 - smoothstep(${f(MK.marks.far[0])}, ${f(MK.marks.far[1])}, px);
    if (kM > 0.0 && uWearLite < 0.5) {
      bool ax = hs.x >= hs.y;
      vec2 q = ax ? lp : lp.yx, hq = ax ? hs : hs.yx;
      float row = floor(q.y / ${f(MK.marks.row)});
      float ry = (row + 0.5 + 0.5 * (mkH(vec2(row, id + 0.7)) - 0.5)) * ${f(MK.marks.row)};
      float x0 = (mkH(vec2(row, id + 5.1)) - 0.5) * 1.6 * hq.x, len = ${f(MK.marks.len[0])} + ${f(MK.marks.len[1])} * mkH(vec2(row, id + 9.3));
      float on = step(mkH(vec2(row, id + 3.3)), ${f(MK.marks.share)}) * step(x0, q.x) * step(q.x, x0 + len) * step(0.06, de);
      ink = max(ink, mkLine(abs(q.y - ry), px, ${f(MK.marks.line)}) * on * kM * ${f(MK.marks.ink)});
    }
    return ink;
  }
`;
