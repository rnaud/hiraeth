// The motion QC's judgement (.claude/skills/motion-qc/SKILL.md), pure: the per-frame samples of a scripted run in
// (scripts/motion-qc/sample.mjs records them, in node or in the running game), the per-scenario measures, events,
// worst frames and verdict out. No three.js, no browser: tests/motion-qc.test.js feeds it made-up tracks.
//
// A sample (one a frame, after the traveller is posed):
//   t, dt, tag       the run's clock, this frame's step (s), the script's phase
//   stick            the stick asked for this frame ([x, y], camera-relative; null: let go), run (Shift held)
//   pos, vel         the body (the controller's: feet, m; m/s) [x, y, z]; heading (rad), onGround
//   feet.l / feet.r  { ball, ankle: [x, y, z] world, gBall, gAnkle: the ground under them (y), held: planted by
//                    feet.js and fully blended in }
//   joints           [[x, y, z], ...]: the JOINTS below, world, less pos (what the eye sees, the camera following)
//   w                the BONES' angular velocities (rad/s, local: [x, y, z] each)
//   chest            the chest's facing (rad, world yaw)
//   mm               { w: matching's share of the pose, jumps (so far), clip }; move: the captured move over the
//                    loops (src/loco-moves.js) or null; gait: the loop that leads ('idle' 'walk' 'jog' 'sprint');
//                    pivot (src/locomotion.js)
//   us               { match, anim }: µs spent this frame in Animator.match and in the whole Animator.update
// The meta: { ballRest, ankleRest } (the ball's and the ankle's height over the sole at rest, m), fps.

export const JOINTS = ['pelvis', 'spine_03', 'Head', 'upperarm_l', 'upperarm_r', 'lowerarm_l', 'lowerarm_r', 'hand_l', 'hand_r', 'thigh_l', 'thigh_r', 'calf_l', 'calf_r', 'foot_l', 'foot_r', 'ball_l', 'ball_r'];
export const BONES = ['pelvis', 'spine_01', 'spine_02', 'spine_03', 'neck_01', 'Head', 'clavicle_l', 'upperarm_l', 'lowerarm_l', 'hand_l',
  'clavicle_r', 'upperarm_r', 'lowerarm_r', 'hand_r', 'thigh_l', 'calf_l', 'foot_l', 'ball_l', 'thigh_r', 'calf_r', 'foot_r', 'ball_r'];

/** The thresholds a scenario is green under (why each: the skill, "What is measured"). */
export const LIMITS = {
  contact: 0.03,      // m: a ball within this of the ground is touching it
  still: 0.6,         // m/s: and a planted step's ball comes this slow at least once (else it skimmed the ground in a swing)
  slideP95: 0.06,     // m a planted step slides over the ground: 95 % of the steps under this
  slideMax: 0.12,     //    and the worst one
  held: 0.02,         // m: a foot feet.js holds moves over its hold
  sink: 0.03,         // m: a sole under the ground
  popW: 14,           // rad/s: a bone's angular velocity off its neighbours' (two frames each side) by this is a pop
  popsPerMin: 3,
  jolt: 0.03,         // m: a joint off the smooth curve through its neighbours' places by this is a jolt
  joltsPerMin: 3,
  boundary: 0.03,     // m: the worst jolt within two frames of a blend boundary (a matcher jump, the matching or a move easing in or out)
  start: 0.22,        // s from the stick pushed (standing) to a foot off the ground
  stop: 1.1,          // s from the stick let go (moving) to both feet held and still
  turn: 0.3,          // s from the stick turned (by over 60°) to the chest half way round
  pivotSlip: 0.05,    // m the pivoting foot moves while held, through a pivot
  crossed: 0.03,      // share of a pivot's frames with the feet crossed (the left one right of the right one)
};

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const pct = (xs, p) => { if (!xs.length) return 0; const s = [...xs].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
const hspeed = (s) => Math.hypot(s.vel[0], s.vel[2]);
const steering = (s) => !!(s.stick && Math.hypot(s.stick[0], s.stick[1]) > 0.1);
/** Per minute, a short run rounded up to a minute (a 20 s scenario may have its share). */
const perMin = (n, secs) => n / Math.max(1, secs / 60);

/**
 * The planted steps: each time a ball touches the ground (within LIMITS.contact) for 4 frames or more, how far it
 * moved over the ground meanwhile (m; touching down and lifting off included), and, separately, how far a held foot
 * moved over its hold. Also the deepest sink.
 */
export function steps(S, meta, warm = 0.3) {
  const out = [], holds = [], skims = [];
  let sink = 0;
  // (a foot that never comes to rest over its contact, under LIMITS.still, skimmed the ground in its swing: not a step)
  const keep = (run) => { if (run.n >= 4) (run.slowest < LIMITS.still ? out : skims).push(run); };
  for (const side of ['l', 'r']) {
    let run = null, hold = null;
    for (let i = 1; i < S.length; i++) {
      const s = S[i], f = s.feet[side], g = S[i - 1].feet[side];
      if (s.t < warm) continue;
      const h = f.ball[1] - meta.ballRest - f.gBall;
      if (Number.isFinite(f.gBall)) sink = Math.max(sink, -h);
      const hh = f.ankle[1] - meta.ankleRest - f.gAnkle;
      if (Number.isFinite(f.gAnkle)) sink = Math.max(sink, -hh - 0.04);   // (the heel's sole is ~4 cm under the ankle's rest line when the toe is down)
      const d = Math.hypot(f.ball[0] - g.ball[0], f.ball[2] - g.ball[2]);
      if (h < LIMITS.contact && s.onGround !== false) {
        if (!run) run = { side, from: i, t: s.t, tag: s.tag, slide: 0, n: 0, worstFrame: i, worstD: 0, slowest: Infinity };
        run.slide += d; run.n++;
        run.slowest = Math.min(run.slowest, d / Math.max(s.dt, 1e-3));
        if (d > run.worstD) { run.worstD = d; run.worstFrame = i; }
      } else if (run) { keep(run); run = null; }
      if (f.held && g.held) { hold ??= { side, from: i, t: s.t, tag: s.tag, slide: 0 }; hold.slide += d; }
      else if (hold) { holds.push(hold); hold = null; }
    }
    if (run) keep(run);
    if (hold) holds.push(hold);
  }
  return { steps: out, holds, skims, sink };
}

/** Pops: a bone's angular velocity off the mean of its neighbours' (two frames each side) by over LIMITS.popW. */
export function pops(S, warm = 0.3) {
  const out = [];
  for (let i = 2; i < S.length - 2; i++) {
    if (S[i].t < warm || !S[i].w) continue;
    let worst = 0, bone = -1;
    const nb = S[i].w.length;
    for (let b = 0; b < nb; b++) {
      const w = S[i].w[b], m = [0, 1, 2].map((k) => (S[i - 2].w[b][k] + S[i - 1].w[b][k] + S[i + 1].w[b][k] + S[i + 2].w[b][k]) / 4);
      const e = len(sub(w, m));
      if (e > worst) { worst = e; bone = b; }
    }
    if (worst > LIMITS.popW) out.push({ i, t: S[i].t, tag: S[i].tag, size: worst, bone: BONES[bone] ?? bone });
  }
  return merge(out);
}

/**
 * Jolts: a joint (JOINTS, relative to the body) off the cubic through its places two frames either side by over
 * LIMITS.jolt (m). A smooth swing, even a sprint's, stays under a millimetre; a pose that jumps shows its jump's half
 * or more. Every frame's worst, for the boundaries and the worst frames.
 */
export function jolts(S, warm = 0.3) {
  const per = new Float32Array(S.length), which = new Int16Array(S.length).fill(-1);
  for (let i = 2; i < S.length - 2; i++) {
    if (S[i].t < warm || !S[i].joints) continue;
    let worst = 0, j0 = -1;
    for (let j = 0; j < S[i].joints.length; j++) {
      const p = (k) => S[i + k].joints[j];
      const e = Math.hypot(...[0, 1, 2].map((k) => p(0)[k] - (-p(-2)[k] + 4 * p(-1)[k] + 4 * p(1)[k] - p(2)[k]) / 6));
      if (e > worst) { worst = e; j0 = j; }
    }
    // (a teleport or a step of the floor the body takes in one frame: the joints are relative to the body, so it cancels)
    per[i] = worst; which[i] = j0;
  }
  const out = [];
  for (let i = 0; i < S.length; i++) if (per[i] > LIMITS.jolt) out.push({ i, t: S[i].t, tag: S[i].tag, size: per[i], joint: JOINTS[which[i]] ?? which[i] });
  return { per, which, events: merge(out) };
}

/** Events within 3 frames of each other are one (the worst kept). */
function merge(ev) {
  const out = [];
  for (const e of ev) {
    const last = out[out.length - 1];
    if (last && e.i - last.i <= 3) { if (e.size > last.size) Object.assign(last, e); }
    else out.push({ ...e });
  }
  return out;
}

/**
 * The blend boundaries: a matcher jump, matching's share or a captured move's crossing a half, the leading loop
 * changing, a pivot starting or ending. Each with the worst jolt within two frames of it.
 */
export function boundaries(S, per, which) {
  const out = [];
  const add = (i, kind) => {
    let size = 0, j = -1;
    for (let k = Math.max(0, i - 2); k <= Math.min(S.length - 1, i + 2); k++) if (per[k] > size) { size = per[k]; j = which[k]; }
    out.push({ i, t: S[i].t, tag: S[i].tag, kind, size, joint: JOINTS[j] ?? j });
  };
  for (let i = 1; i < S.length; i++) {
    const a = S[i - 1], b = S[i];
    if (b.t < 0.3) continue;
    if ((b.mm?.jumps ?? 0) > (a.mm?.jumps ?? 0)) add(i, `jump to ${b.mm.clip ?? '?'}`);
    if ((a.mm?.w ?? 0) < 0.5 && (b.mm?.w ?? 0) >= 0.5) add(i, 'matching in');
    if ((a.mm?.w ?? 0) >= 0.5 && (b.mm?.w ?? 0) < 0.5) add(i, 'matching out');
    if ((a.move ?? null) !== (b.move ?? null)) add(i, b.move ? `move ${b.move}` : `move ${a.move} out`);
    if (a.gait && b.gait && a.gait !== b.gait) add(i, `${a.gait} → ${b.gait}`);
    if (!!a.pivot !== !!b.pivot) add(i, b.pivot ? 'pivot' : 'pivot out');
  }
  return out;
}

/**
 * The pose's answer to the stick: starts (pushed while standing: s to a foot 3 cm off the ground), stops (let go
 * while moving: s to both feet held and still for 0.3 s) and turns (the stick's way turned by over 60°: s until the
 * chest has turned half as far).
 */
export function latency(S, meta) {
  const starts = [], stopsOut = [], turns = [];
  const fps = 1 / (S[1]?.dt || 1 / 60);
  for (let i = 1; i < S.length; i++) {
    const a = S[i - 1], b = S[i];
    if (steering(b) && !steering(a) && hspeed(a) < 0.2) {
      let got = null;
      for (let k = i; k < Math.min(S.length, i + fps * 2); k++) {
        if (!steering(S[k])) break;
        if (['l', 'r'].some((s) => S[k].feet[s].ball[1] - meta.ballRest - S[k].feet[s].gBall > 0.03)) { got = S[k].t - b.t; break; }
      }
      starts.push({ i, t: b.t, tag: b.tag, s: got ?? Infinity });
    }
    if (!steering(b) && steering(a) && hspeed(a) > 1) {
      let held = 0, got = null;
      for (let k = i; k < Math.min(S.length, i + fps * 4); k++) {
        if (steering(S[k])) break;
        const both = ['l', 'r'].every((s) => S[k].feet[s].held) && hspeed(S[k]) < 0.05;
        held = both ? held + 1 : 0;
        if (held >= fps * 0.3) { got = S[k - held + 1].t - b.t; break; }
      }
      stopsOut.push({ i, t: b.t, tag: b.tag, s: got ?? Infinity });
    }
    // (the stick's way in the world: camera-relative, the camera still in a scripted run; `camYaw` turns it)
    if (steering(a) && steering(b)) {
      const wa = Math.atan2(a.stick[0], a.stick[1]), wb = Math.atan2(b.stick[0], b.stick[1]), turned = wrap(wb - wa);
      if (Math.abs(turned) > Math.PI / 3) {
        const c0 = b.chest;
        let got = null;
        for (let k = i; k < Math.min(S.length, i + fps * 2); k++) if (Math.abs(wrap(S[k].chest - c0)) >= Math.abs(turned) / 2) { got = S[k].t - b.t; break; }
        turns.push({ i, t: b.t, tag: b.tag, by: turned, s: got ?? Infinity });
      }
    }
  }
  return { starts, stops: stopsOut, turns };
}

/**
 * Pivots: each stretch the controller calls a pivot (src/locomotion.js), and a second after it. The pivoting foot is
 * the one held longest; slip is how far it moved while held; crossed the share of frames with the left foot right of
 * the right one (in the body's frame, by over 3 cm); steps how many times the other foot set down; done the s until
 * both feet are held and the body has stopped turning.
 */
export function pivots(S, fps = 60) {
  const out = [];
  for (let i = 1; i < S.length; i++) {
    if (!S[i].pivot || S[i - 1].pivot) continue;
    let end = i;
    while (end < S.length - 1 && (S[end].pivot || end - i < 6)) end++;
    const to = Math.min(S.length - 1, end + fps);
    const heldN = { l: 0, r: 0 };
    for (let k = i; k <= to; k++) for (const s of ['l', 'r']) if (S[k].feet[s].held) heldN[s]++;
    const pf = heldN.l >= heldN.r ? 'l' : 'r', other = pf === 'l' ? 'r' : 'l';
    let slip = 0, run = 0, crossed = 0, stepsN = 0, done = null;
    for (let k = i + 1; k <= to; k++) {
      const f = S[k].feet[pf], g = S[k - 1].feet[pf];
      if (f.held && g.held) { run += Math.hypot(f.ball[0] - g.ball[0], f.ball[2] - g.ball[2]); slip = Math.max(slip, run); } else run = 0;
      if (S[k].feet[other].held && !S[k - 1].feet[other].held) stepsN++;
      // (the body's frame: x left of the facing; the left foot should be left of the right one)
      const h = S[k].heading, lx = [Math.cos(h), 0, -Math.sin(h)];
      const dl = S[k].feet.l.ankle, dr = S[k].feet.r.ankle;
      const side = (dl[0] - dr[0]) * lx[0] + (dl[2] - dr[2]) * lx[2];
      if (side < -0.03) crossed++;
      if (done === null && k > end && S[k].feet.l.held && S[k].feet.r.held && Math.abs(wrap(S[k].heading - S[k - 1].heading)) * fps < 0.3) done = S[k].t - S[i].t;
    }
    out.push({ i, t: S[i].t, tag: S[i].tag, foot: pf, slip, crossed: crossed / Math.max(1, to - i), steps: stepsN, done: done ?? Infinity });
  }
  return out;
}

/** The matcher's cost and the Animator's: mean and 95th percentile µs a frame, over the frames that ran it. */
export function cost(S) {
  const m = S.map((s) => s.us?.match).filter(Number.isFinite), a = S.map((s) => s.us?.anim).filter(Number.isFinite);
  const mean = (xs) => (xs.length ? xs.reduce((x, y) => x + y, 0) / xs.length : 0);
  return { match: { mean: mean(m), p95: pct(m, 0.95) }, anim: { mean: mean(a), p95: pct(a, 0.95) } };
}

/**
 * Everything about one run: the measures, the verdict against LIMITS (and which ones failed), the events and the
 * worst frames (the indices of the samples to draw for the contact sheet: the worst slide, pop, jolt and boundary).
 */
export function analyse(S, meta) {
  const fps = Math.round(1 / (S[1]?.dt || 1 / 60));
  const secs = S.length ? S[S.length - 1].t - S[0].t : 0;
  const st = steps(S, meta), P = pops(S), J = jolts(S), B = boundaries(S, J.per, J.which), L = latency(S, meta), V = pivots(S, fps);
  const slides = st.steps.map((x) => x.slide);
  let walked = 0;
  for (let i = 1; i < S.length; i++) walked += Math.hypot(S[i].pos[0] - S[i - 1].pos[0], S[i].pos[2] - S[i - 1].pos[2]);
  const finite = (xs) => xs.filter(Number.isFinite);
  const worstOf = (xs, k) => (xs.length ? Math.max(...xs.map((x) => x[k])) : 0);
  const m = {
    steps: slides.length,
    slideP50: pct(slides, 0.5), slideP95: pct(slides, 0.95), slideMax: slides.length ? Math.max(...slides) : 0,
    slidePerM: walked > 0.5 ? slides.reduce((a, b) => a + b, 0) / walked : 0,
    held: worstOf(st.holds, 'slide'), sink: st.sink, skims: st.skims.length,
    pops: P.length, popsPerMin: perMin(P.length, secs), popMax: worstOf(P, 'size'),
    jolts: J.events.length, joltsPerMin: perMin(J.events.length, secs), joltMax: worstOf(J.events, 'size'),
    boundaries: B.length, boundaryMax: worstOf(B, 'size'),
    start: L.starts.length ? Math.max(...L.starts.map((x) => x.s)) : null,
    stop: L.stops.length ? Math.max(...L.stops.map((x) => x.s)) : null,
    turn: L.turns.length ? Math.max(...L.turns.map((x) => x.s)) : null,
    pivots: V.length, pivotSlip: worstOf(V, 'slip'), crossed: worstOf(V, 'crossed'), pivotDone: V.length ? Math.max(...V.map((x) => x.done)) : null,
    ...(() => { const c = cost(S); return { matchUs: c.match.mean, matchUs95: c.match.p95, animUs: c.anim.mean, animUs95: c.anim.p95 }; })(),
    mmShare: S.length ? S.reduce((a, s) => a + (s.mm?.w ?? 0), 0) / S.length : 0,
    secs, walked,
  };
  const fails = [];
  if (m.slideP95 > LIMITS.slideP95) fails.push('slideP95');
  if (m.slideMax > LIMITS.slideMax) fails.push('slideMax');
  if (m.held > LIMITS.held) fails.push('held');
  if (m.sink > LIMITS.sink) fails.push('sink');
  if (m.popsPerMin > LIMITS.popsPerMin) fails.push('pops');
  if (m.joltsPerMin > LIMITS.joltsPerMin) fails.push('jolts');
  if (m.boundaryMax > LIMITS.boundary) fails.push('boundary');
  if (m.start !== null && !(m.start <= LIMITS.start)) fails.push('start');
  if (m.stop !== null && !(m.stop <= LIMITS.stop)) fails.push('stop');
  if (m.turn !== null && !(m.turn <= LIMITS.turn)) fails.push('turn');
  if (m.pivots && m.pivotSlip > LIMITS.pivotSlip) fails.push('pivotSlip');
  if (m.pivots && m.crossed > LIMITS.crossed) fails.push('crossed');
  // the worst frames: the worst step's worst frame, the worst pops, jolts and boundaries (each once, by how far over)
  const cand = [
    ...st.steps.map((x) => ({ i: x.worstFrame, sev: x.slide / LIMITS.slideMax, what: `${x.side} foot slid ${(x.slide * 100).toFixed(1)} cm over a step (${x.tag})` })),
    ...P.map((x) => ({ i: x.i, sev: x.size / LIMITS.popW, what: `pop: ${x.bone} ${x.size.toFixed(0)} rad/s off its neighbours (${x.tag})` })),
    ...J.events.map((x) => ({ i: x.i, sev: x.size / LIMITS.jolt, what: `jolt: ${x.joint} ${(x.size * 100).toFixed(1)} cm off its curve (${x.tag})` })),
    ...B.map((x) => ({ i: x.i, sev: x.size / LIMITS.boundary, what: `${x.kind}: ${(x.size * 100).toFixed(1)} cm (${x.tag})` })),
  ].sort((a, b) => b.sev - a.sev);
  const worst = [];
  for (const c of cand) if (worst.length < 6 && !worst.some((w) => Math.abs(w.i - c.i) < 10)) worst.push(c);
  return { measures: m, fails, green: !fails.length, events: { steps: st.steps, holds: st.holds, skims: st.skims, pops: P, jolts: J.events, boundaries: B, ...L, pivots: V }, worst };
}

const f2 = (x, d = 2) => (x === null || x === undefined ? '-' : Number.isFinite(x) ? x.toFixed(d) : '∞');
const cm = (x) => (Number.isFinite(x) ? (x * 100).toFixed(1) : '∞');

/** The report's table (markdown): one row a scenario and way. */
export function table(rows) {
  const head = '| scenario | way | verdict | slide p50 / p95 / max (cm) | held (cm) | sink (cm) | pops /min | jolts /min (max cm) | boundary max (cm) | start / stop / turn (s) | pivot slip (cm), crossed | matcher µs mean / p95 | matching share |';
  const sep = '|' + '---|'.repeat(13);
  const lines = rows.map(({ name, way, r }) => {
    const m = r.measures;
    return `| ${name} | ${way} | ${r.green ? 'green' : `**red**: ${r.fails.join(', ')}`} | ${cm(m.slideP50)} / ${cm(m.slideP95)} / ${cm(m.slideMax)} | ${cm(m.held)} | ${cm(m.sink)} | ${f2(m.popsPerMin, 1)} | ${f2(m.joltsPerMin, 1)} (${cm(m.joltMax)}) | ${cm(m.boundaryMax)} | ${f2(m.start)} / ${f2(m.stop)} / ${f2(m.turn)} | ${m.pivots ? `${cm(m.pivotSlip)}, ${Math.round(m.crossed * 100)} %` : '-'} | ${m.matchUs ? `${f2(m.matchUs, 0)} / ${f2(m.matchUs95, 0)}` : '-'} | ${Math.round(m.mmShare * 100)} % |`;
  });
  return [head, sep, ...lines].join('\n');
}
