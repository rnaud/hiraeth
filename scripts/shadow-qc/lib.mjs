// The shadow QC's analysis (.claude/skills/shadow-qc/SKILL.md), pure: no three.js, no browser. The page
// (scripts/shadow-qc/probes.js) evaluates the game's own shadow lookup (materials.js SHADOW_GLSL) at fixed probe points
// on the Shadow Room's surfaces every frame and traces the true answer once (rays to the sun through a BVH of the
// room); this file judges each frame against that truth and adds the frames up per spot. tests/shadow-qc.test.js feeds
// it made-up probes.
//
// A probe (static, set once): spot (index), truth (1 in a cast shadow, 0 lit, -1 not judged: turned from the sun or
// grazing it under FACET_EDGE), edge (m to the nearest change of the truth on its patch), reach (m from the probe to
// what shades it, the truth ray's hit; Infinity when lit), hit (the caster's point [x, y, z], for "off screen").
// A frame (Float32Arrays, one value a probe): sh (the lit fraction the surface draws, getShadow: 0 shade .. 1 lit),
// vis (1 on screen and not hidden), px (the pixel's footprint, m), sF / s0 / s1 (each cascade's own lit fraction,
// before the steepening), iF / i0 / i1 (how far inside each cascade's window, 0..1: the blend weights).

/** The thresholds a spot is green under, and why. */
export const LIMITS = {
  facet: 0.03,        // materials.js FACET_EDGE: a flat face this close to edge-on goes to shade whole; not judged
  dark: 0.5,          // sh under this is drawn as shade (the toon threshold, after the steepening)
  margin: 0.03,       // m added to every probe's edge tolerance (its own spacing's half is added too)
  contact: 0.6,       // m: a probe shaded by something this close is at a contact (a post's foot, a stair's nose)
  change: 0.2,        // a probe's lit fraction changing by more than this between two frames is a visible flicker
  // the verdict (a share of the judged probes, over the whole walk through the spot)
  acne: 0.002,        // lit probes drawn in shade (self-shadowing specks): at most 0.2 %
  leak: 0.01,         // shaded probes drawn lit, away from contacts and from the edge: at most 1 %
  peter: 0.05,        // shaded probes at a contact drawn lit (the shadow come loose from its foot): at most 5 %
  offscreen: 0.01,    // shaded probes whose caster is off screen, drawn lit: at most 1 %
  shimmer: 0.004,     // probes near an edge flickering frame to frame while nothing moves: at most 0.4 % a frame
  pops: 0.002,        // the same, where the cascades' blend changed under them: at most 0.2 % a frame
  seam: 0.08,         // probes in a cascade's fade band where the two cascades disagree: at most 8 %
  coverage: 0.7,      // the traveller's shadow: at least 70 % of it drawn
  spill: 0.35,        // and at most 35 % of its area drawn where it isn't (bloated, offset)
  gap: 0.06,          // m: the shadow starting this much further from the planted foot than it should, at worst (p90)
};

const cut = (x) => Math.min(1, Math.max(0, (x - 0.5) * 3 + 0.5));   // (materials.js SHADOW_CUT: the steepening)

/**
 * Distance (m) from each cell of a patch's grid to the nearest change of its truth (a shadow's edge), along the
 * grid (a chamfer transform: 1 a step across, √2 diagonally). `truth` per cell (1, 0, or -1 / null: no probe),
 * `pos` per cell [x, y, z] (two neighbours further apart than 2.5 steps are different surfaces, not an edge).
 */
export function edgeDistances(nu, nv, truth, pos, step) {
  const N = nu * nv, d = new Float32Array(N).fill(Infinity);
  const ok = (k) => truth[k] === 0 || truth[k] === 1;
  const near = (a, b) => { const p = pos[a], q = pos[b]; return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]) < 2.5 * step; };
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
    const k = j * nu + i;
    if (!ok(k)) continue;
    for (const [di, dj] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) {
      const a = i + di, b = j + dj;
      if (a < 0 || b < 0 || a >= nu || b >= nv) continue;
      const m = b * nu + a;
      if (ok(m) && truth[m] !== truth[k] && near(k, m)) { d[k] = 0.5 * step; break; }
    }
  }
  // two passes of the chamfer
  const D = Math.SQRT2 * step;
  const relax = (k, m, w) => { if (d[m] + w < d[k]) d[k] = d[m] + w; };
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
    const k = j * nu + i;
    if (i > 0) relax(k, k - 1, step);
    if (j > 0) { relax(k, k - nu, step); if (i > 0) relax(k, k - nu - 1, D); if (i < nu - 1) relax(k, k - nu + 1, D); }
  }
  for (let j = nv - 1; j >= 0; j--) for (let i = nu - 1; i >= 0; i--) {
    const k = j * nu + i;
    if (i < nu - 1) relax(k, k + 1, step);
    if (j < nv - 1) { relax(k, k + nu, step); if (i < nu - 1) relax(k, k + nu + 1, D); if (i > 0) relax(k, k + nu - 1, D); }
  }
  return d;
}

/**
 * How far from a true edge (m) a probe's drawn answer may differ from the truth: the filter's reach on the cascade it
 * reads (the tent over 5 texels, 3 with 4 taps, widened to the pixel up to 2.5 times: materials.js sampleShadow), the
 * normal offset (it moves the lookup off the surface), the probes' own spacing and a margin.
 * `cas`: { texel, offset } of the cascade (m), `taps` 9 or 4.
 */
export function tolerance(cas, px, taps, spacing, L = LIMITS) {
  const spread = Math.min(2.5, Math.max(1, px / cas.texel));
  const half = (taps < 5 ? 1.5 : 2.5) * cas.texel * spread;
  return half + cas.offset + 0.5 * spacing + L.margin;
}

/** The cascade a probe reads mostly: 0 fine, 1 near, 2 far (its blend weights). */
export const cascadeOf = (iF, i0) => (iF >= 0.5 ? 0 : i0 >= 0.5 ? 1 : 2);

/** A spot's empty counters. */
export const counters = () => ({
  frames: 0, lit: 0, acne: 0, shade: 0, leak: 0, contact: 0, peter: 0, off: 0, offLit: 0,
  edge: 0, shimmer: 0, pops: 0, band: 0, seam: 0, worst: 0,
  charFrames: 0, charTruth: 0, charDrawn: 0, charSpill: 0, gaps: [],
});

/**
 * Judge one frame. P: the static probes ({ spot: Int8Array, truth: Int8Array, edge: Float32Array, reach:
 * Float32Array, spacing: Float32Array }); F: this frame (sh, vis, px, sF, s0, s1, iF, i0, i1, ndl); prev: the last
 * frame's (or null); ctx: { cascades: [{ texel, offset }, ...] (fine, near, far), taps, hero (the fine map is the
 * hero map: the traveller alone, materials.js uShadowHero), moved: Uint8Array (a mover or
 * the traveller may shade the probe in this frame or the last: not judged), offscreen: (i) => caster off screen?,
 * turned (the light turned between the frames: no flicker judged) }. Adds into `acc` (spot index → counters) and
 * returns { score, bad: [[i, kind], ...] } (this frame's misjudged probes, for the contact sheet).
 */
export function judgeFrame(P, F, prev, ctx, acc, L = LIMITS) {
  const N = P.truth.length, bad = [];
  const seen = new Set();
  let score = 0;
  for (let i = 0; i < N; i++) {
    if (!F.vis[i] || ctx.moved?.[i]) continue;
    const t = P.truth[i];
    if (t < 0 || F.ndl[i] < L.facet) continue;
    const s = P.spot[i], A = (acc[s] ??= counters());
    seen.add(s);
    // (with the hero map the fine map holds only the traveller: the world's shadows are the near and far maps')
    const c = cascadeOf(ctx.hero ? 0 : F.iF[i], F.i0[i]), cas = ctx.cascades[c];
    if (!cas) continue;
    const tol = tolerance(cas, F.px[i], ctx.taps, P.spacing[i], L);
    const dark = F.sh[i] < L.dark;
    // (a probe its patch's grid calls clear, but judged wrong: is it really that far from every edge? ctx.clear looks
    // round it; it may lie by a shadow narrower than the grid's spacing)
    if (P.edge[i] > tol && ((t === 0) !== dark || !ctx.clear || ctx.clear(i, tol))) {
      if (t === 0) { A.lit++; if (dark) { A.acne++; bad.push([i, 'acne']); score += 1; } }
      else {
        A.shade++;
        const off = ctx.offscreen?.(i);
        if (off) { A.off++; if (!dark) { A.offLit++; bad.push([i, 'off']); score += 2; } }
        else if (P.reach[i] < L.contact) { A.contact++; if (!dark) { A.peter++; bad.push([i, 'peter']); score += 1; } }
        else if (!dark) { A.leak++; bad.push([i, 'leak']); score += 1; }
      }
    }
    // flicker: a probe near an edge, on screen both frames, nothing moving over it, the light still
    if (prev && prev.vis[i] && !ctx.turned && P.edge[i] < 3 * tol) {
      A.edge++;
      if (Math.abs(F.sh[i] - prev.sh[i]) > L.change) {
        const blend = Math.abs(F.iF[i] - prev.iF[i]) + Math.abs(F.i0[i] - prev.i0[i]) + Math.abs(F.i1[i] - prev.i1[i]);
        if (blend > 0.02) { A.pops++; bad.push([i, 'pop']); } else { A.shimmer++; bad.push([i, 'shimmer']); }
        score += 3;
      }
    }
    // seams: in a fade band (the finer cascade partly in), do the two cascades agree?
    const fb = !ctx.hero && F.iF[i] > 0.02 && F.iF[i] < 0.98 && F.i0[i] > 0.98, nb = F.i0[i] > 0.02 && F.i0[i] < 0.98 && F.i1[i] > 0.98;
    if (fb || nb) {
      A.band++;
      const a = fb ? F.sF[i] : F.s0[i], b = fb ? F.s0[i] : F.s1[i];
      if (Math.abs(cut(a) - cut(b)) > 0.5) { A.seam++; bad.push([i, 'seam']); score += 0.5; }
    }
  }
  for (const s of seen) acc[s].frames++;
  return { score, bad };
}

/**
 * The traveller's own shadow this frame, from the probes laid on the ground under it (probes.js charProbes): truth
 * (1 where his body shades the ground, 0 lit by him; -1 not judged: shaded by something else, or off screen), sh the
 * drawn lit fraction, w each probe's area (m²); feet: per planted foot, the drawn and true distance (m) from the foot
 * along the shadow to where it starts. Adds into `A` (that spot's counters).
 */
export function judgeCharacter(truth, sh, w, feet, A, L = LIMITS) {
  let T = 0, D = 0, S = 0;
  for (let i = 0; i < truth.length; i++) {
    if (truth[i] < 0) continue;
    const shade = 1 - Math.min(1, Math.max(0, sh[i]));
    if (truth[i] === 1) { T += w[i]; D += w[i] * shade; } else S += w[i] * shade;
  }
  if (T <= 0) return null;
  A.charFrames++; A.charTruth += T; A.charDrawn += D; A.charSpill += S;
  for (const f of feet) if (Number.isFinite(f.drawn) && Number.isFinite(f.truth)) A.gaps.push(Math.max(0, f.drawn - f.truth));
  return { coverage: D / T, spill: S / T };
}

const pct = (xs, p) => { if (!xs.length) return 0; const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
const rate = (a, b) => (b > 0 ? a / b : 0);

/** A spot's measures and its verdict against LIMITS. Rates are shares of the judged probes (flicker: a frame). */
export function verdict(A, L = LIMITS) {
  const m = {
    frames: A.frames,
    acne: rate(A.acne, A.lit), leak: rate(A.leak, A.shade - A.contact - A.off), peter: rate(A.peter, A.contact), offscreen: rate(A.offLit, A.off),
    shimmer: rate(A.shimmer, A.edge), pops: rate(A.pops, A.edge), seam: rate(A.seam, A.band),
    coverage: A.charTruth > 0 ? A.charDrawn / A.charTruth : null, spill: A.charTruth > 0 ? A.charSpill / A.charTruth : null,
    gap: A.gaps.length ? pct(A.gaps, 0.9) : null,
    n: { lit: A.lit, shade: A.shade, contact: A.contact, off: A.off, edge: A.edge, band: A.band, char: A.charFrames },
  };
  const fails = [];
  const over = (k, lim, min = 200) => { if (m[k] > lim && (k === 'shimmer' || k === 'pops' ? A.edge : k === 'seam' ? A.band : k === 'offscreen' ? A.off : k === 'peter' ? A.contact : k === 'acne' ? A.lit : A.shade) >= min) fails.push(`${k} ${(m[k] * 100).toFixed(2)} % > ${(lim * 100).toFixed(1)} %`); };
  over('acne', L.acne); over('leak', L.leak); over('peter', L.peter); over('offscreen', L.offscreen);
  over('shimmer', L.shimmer); over('pops', L.pops); over('seam', L.seam);
  if (m.coverage != null && A.charFrames >= 10) {
    if (m.coverage < L.coverage) fails.push(`the traveller's shadow ${(m.coverage * 100).toFixed(0)} % drawn < ${L.coverage * 100} %`);
    if (m.spill > L.spill) fails.push(`spill ${(m.spill * 100).toFixed(0)} % > ${L.spill * 100} %`);
    if (m.gap > L.gap) fails.push(`contact gap ${(m.gap * 100).toFixed(1)} cm > ${L.gap * 100} cm`);
  }
  return { measures: m, fails, green: fails.length === 0 };
}

/** A markdown table: rows of [run, spot, verdict()] results. */
export function table(rows) {
  const f = (x, d = 2) => (x == null ? '–' : `${(x * 100).toFixed(d)} %`);
  const out = [['run', 'spot', 'verdict', 'frames', 'acne', 'leak', 'peter-pan', 'off-screen', 'shimmer /frame', 'pops /frame', 'seams', 'his shadow', 'spill', 'gap p90']];
  for (const [run, spot, r] of rows) {
    const m = r.measures;
    out.push([run, spot, r.green ? 'green' : `**red**: ${r.fails.join('; ')}`, m.frames, f(m.acne), f(m.leak), f(m.peter), f(m.offscreen), f(m.shimmer, 3), f(m.pops, 3), f(m.seam, 1),
      m.coverage == null ? '–' : `${(m.coverage * 100).toFixed(0)} %`, m.spill == null ? '–' : `${(m.spill * 100).toFixed(0)} %`, m.gap == null ? '–' : `${(m.gap * 100).toFixed(1)} cm`]);
  }
  return out.map((r, i) => `| ${r.join(' | ')} |${i === 0 ? `\n|${r.map(() => '---').join('|')}|` : ''}`).join('\n');
}

/** Counters added together (a run's spots into one, or runs into one). */
export function merge(...list) {
  const A = counters();
  for (const x of list) for (const k of Object.keys(A)) { if (k === 'gaps') A.gaps.push(...(x.gaps ?? [])); else A[k] += x[k] ?? 0; }
  return A;
}
