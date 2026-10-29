// The camera QC's analysis (.claude/skills/camera-qc/SKILL.md), pure: the per-frame samples a scripted walk recorded
// in the running game in, the per-scenario measures, events and verdict out. No three.js, no browser: the tests
// (tests/camera-qc.test.js) feed it made-up tracks.
//
// A sample (one a frame, recorded right after CameraRig.update):
//   t, dt        the world's clock and this frame's step (s)
//   cam, look    the camera's position and the point it looks at (rig._look) [x, y, z]
//   pos          the traveller's feet [x, y, z]
//   fwd          the camera's forward (unit) [x, y, z]
//   cmdYaw, cmdPitch  the turn the script asked for this frame (rad: the stick, the mouse)
//   clear        the room round the lens (m, capped at 1): the nearest surface along six rays
//   occl         the head hidden from the lens by the collision (bool)
//   head, chest  where the head and the chest land on the screen (NDC [x, y], or null behind the camera)
//   tight        rig.tightK (0 open .. 1 close in), side (the shoulder offset, m), shoulder (±1)
//   share        the traveller's height on the screen (feet to 1.75 m over them), a share of the frame's height
//   ride         riding, gliding, on the jets, climbing or swimming (the open framing is judged on foot only)
//   body         the lens's distance from the traveller's own axis (his feet + 0.2 m to 1.75 m; m), pitch the view's (+ down)
//   cut          he is left out of the view (the lens in him: materials.js uHeroCut): not judged in his body nor out of the frame
//   whole        locked on: [the foe's drawn body whole, his body whole, his feet, the ground at its feet] each on the screen (1/0,
//                within FRAME_EDGE), and the share of its screen box his body covers; issue #752: "I should see the whole enemy and
//                myself and the ground"; with foeD its distance (m)

/** The thresholds a scenario is green under. Per minute of the run unless said. */
export const LIMITS = {
  pop: 0.25,          // m: the arm shorter or longer by this much in one frame is a collision pop
  jump: 0.12,         // m: a kink in the camera's path: this frame's move differs from the last one's by this much
  jumpK: 2.5,         //    and by this many times its neighbours' kinks (a spike, not a rough stretch)
  lookJump: 0.1,      // m: a kink in the look point's path
  spin: 90,           // deg/s of turn nobody asked for, in one frame, and spinK × its neighbours'
  spinK: 3,
  clip: 0.3,          // m: the lens nearer a surface than its near plane (0.3 m) is clipping into it
  body: 0.5,          // m: the lens nearer his axis than this has its near plane (0.3 m) in his body (shoulders 0.2-0.25 m off
                      //    it): the camera through the traveller (issue #324, aboard the ship), unless he is left out (cut)
  wobble: 0.01,       // m: the arm's in-out moves smaller than this are not counted as a reversal
  // the verdict: at most this many of each a minute (pops, jumps, look jumps, spins), these shares of the frames
  perMin: { pops: 2, jumps: 2, lookJumps: 2, spins: 2 },
  share: { clip: 0.01, occluded: 0.03, out: 0.01, lockHidden: 0.1, inBody: 0.01 },
  hide: 0.5,   // locked on, the foe counts as hidden when the traveller's body covers this share of its screen box,
  hideFrom: 2.5,   // and it is at least this far off (m): nearer, in the cut's reach, the two overlap from any camera behind him
  reversals: 1.5,     // a second: the arm going in and out (jitter against small or moving geometry)
  rms: 0.015,         // m: the camera's roughness (its kinks' root mean square, every frame)
  // a scenario that asks (`framing`): on foot in the open (tight under openBelow), the traveller's median height on the
  // screen within this range (Sable's framing, v1.49: about a third of the frame), judged over at least `minFrames`
  framing: [0.28, 0.4], openBelow: 0.1, minFrames: 30,
};

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
/** Turn a vector round +y by `a` rad (the rig's yaw turns the arm round up). */
const yawed = (v, a) => { const c = Math.cos(a), s = Math.sin(a); return [v[0] * c + v[2] * s, v[1], -v[0] * s + v[2] * c]; };
const angle = (a, b) => Math.acos(Math.max(-1, Math.min(1, dot(a, b) / (len(a) * len(b) || 1))));
const DEG = 180 / Math.PI;
const pct = (xs, p) => { if (!xs.length) return 0; const s = [...xs].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
const offScreen = (n) => !n || Math.abs(n[0]) > 1 || Math.abs(n[1]) > 1;

/** Is a frame a hand-over (a teleport, a respawn, a door): the traveller moved more than 3 m in it. Not judged. */
export const isCut = (a, b) => len(sub(b.pos, a.pos)) > 3;
/** How much of rectangle `a` ([x0, y0, x1, y1]) rectangle `b` covers, 0..1 (a locked foe's screen box, the traveller's). */
export function cover(a, b) {
  const w = Math.max(0, Math.min(a[2], b[2]) - Math.max(a[0], b[0])), h = Math.max(0, Math.min(a[3], b[3]) - Math.max(a[1], b[1]));
  const A = (a[2] - a[0]) * (a[3] - a[1]);
  return A > 0 ? (w * h) / A : 0;
}

/**
 * The per-frame measures between consecutive samples: the arm's change (pop), the camera's move off its smooth
 * path round the traveller (after the asked-for turn), the look point's, the turn nobody asked for (deg/s).
 */
export function steps(S) {
  const out = [];
  for (let i = 1; i < S.length; i++) {
    const a = S[i - 1], b = S[i], dt = Math.max(1e-3, b.dt);
    if (isCut(a, b)) { out.push(null); continue; }
    const armA = len(sub(a.cam, a.look)), armB = len(sub(b.cam, b.look));
    // the camera's and the look point's own moves this frame (their paths: a jump is a kink in one, measured below),
    // less the swing round the look point that the script's turn asked for (its hands may start and stop at once)
    const arm = sub(a.cam, a.look), swing = sub(yawed(arm, b.cmdYaw ?? 0), arm);
    const d = sub(sub(b.cam, a.cam), swing), dl = sub(b.look, a.look);
    const asked = Math.abs(b.cmdYaw ?? 0) * Math.cos(Math.asin(Math.max(-1, Math.min(1, b.fwd[1])))) + Math.abs(b.cmdPitch ?? 0);
    const spin = Math.max(0, angle(a.fwd, b.fwd) - asked) * DEG / dt;
    out.push({ i, t: b.t, dt, arm: armB, dArm: armB - armA, spin, d, dl });
  }
  // the kinks: how much this frame's move differs from the last one's (m). A walk, a turn, the arm easing out, a jump's
  // rise are smooth and differ little frame to frame; a pop, a snap of the shoulder or a shove off a wall differ at once.
  // (The traveller's own step is in both moves, so it cancels; so does the turn the script asked for, nearly.)
  for (let i = 0; i < out.length; i++) {
    const x = out[i], p = out[i - 1];
    if (!x) continue;
    // (a hitch, one frame twice as long as the last or half: the comparison means nothing there; not judged)
    if (!p || x.dt > 1.8 * p.dt || p.dt > 1.8 * x.dt) { x.move = 0; x.look = 0; continue; }
    const k = x.dt / p.dt;   // (a longer frame moves further: compare like with like)
    x.move = len(sub(x.d, p.d.map((v) => v * k)));
    x.look = len(sub(x.dl, p.dl.map((v) => v * k)));
  }
  return out;
}

/** A spike: this frame's value past `abs` and `k` times its neighbours' mean (two each side). */
function spikes(vals, abs, k) {
  const hit = [];
  for (let i = 0; i < vals.length; i++) {
    const v = vals[i];
    if (v == null || v < abs) continue;
    const n = [vals[i - 2], vals[i - 1], vals[i + 1], vals[i + 2]].filter((x) => x != null);
    const m = n.length ? n.reduce((s, x) => s + x, 0) / n.length : 0;
    if (v > k * m) hit.push(i);
  }
  return hit;
}

/**
 * The open framing: the traveller's median height on the screen (a share of the frame's) over the frames on foot in the
 * open (not riding, gliding, climbing or swimming; tight under L.openBelow), and how many frames that was.
 */
export function framing(S, L = LIMITS) {
  const xs = S.filter((s) => s.share != null && !s.ride && (s.tight ?? 0) < L.openBelow).map((s) => s.share);
  return { share: xs.length ? +pct(xs, 0.5).toFixed(3) : null, frames: xs.length };
}

/** Locked on, what counts as framed: on the screen within this much of its half-size (NDC), and his body covering at most `FRAME_COVER` of its screen box. */
export const FRAME_EDGE = 0.95, FRAME_COVER = 0.35;
/** The distance bands the lock's framing is reported in (m from him to the foe; issue #752: 2, 5 and 9 m). */
export const FRAME_BANDS = { 2: [1, 3.2], 5: [3.8, 6.4], 9: [7.4, 11] };
/**
 * Locked on, the share of frames with everything framed (the foe whole, him whole, his feet and the ground at its feet,
 * and his body covering no more than FRAME_COVER of it: `whole`), in each distance band and over all: { all: { share, frames }, 2: …, 5: …, 9: … }, and how often each part was lost.
 */
export function lockFraming(S, bands = FRAME_BANDS) {
  const out = {}, lost = [0, 0, 0, 0, 0];
  const add = (k, ok) => { const o = (out[k] ??= { ok: 0, frames: 0 }); o.frames++; if (ok) o.ok++; };
  for (const s of S) {
    if (!s.whole || s.foeD == null) continue;
    const seen = s.whole.slice(0, 4).map(Boolean).concat((s.whole[4] ?? 0) <= FRAME_COVER), ok = seen.every(Boolean);
    seen.forEach((v, i) => { if (!v) lost[i]++; });
    add('all', ok);
    for (const [k, [lo, hi]] of Object.entries(bands)) if (s.foeD >= lo && s.foeD <= hi) add(k, ok);
  }
  for (const o of Object.values(out)) o.share = +(o.ok / Math.max(1, o.frames)).toFixed(3);
  const n = out.all?.frames ?? 0;
  out.lost = { foe: +(lost[0] / Math.max(1, n)).toFixed(3), him: +(lost[1] / Math.max(1, n)).toFixed(3), feet: +(lost[2] / Math.max(1, n)).toFixed(3), ground: +(lost[3] / Math.max(1, n)).toFixed(3), covered: +(lost[4] / Math.max(1, n)).toFixed(3) };
  return out;
}

/** The scenario's measures, its events (worst first) and its verdict against LIMITS (opts.framing: judge the open framing too). */
export function analyse(S, L = LIMITS, opts = {}) {
  const st = steps(S), ok = st.filter(Boolean);
  const secs = ok.reduce((s, x) => s + x.dt, 0) || 1e-3, mins = secs / 60;
  const events = [];
  // collision pops: the arm cut short or let out by a lot in one frame
  for (const x of ok) if (Math.abs(x.dArm) > L.pop) events.push({ kind: 'pop', t: x.t, i: x.i, size: x.dArm, sev: Math.abs(x.dArm) / L.pop });
  // jumps: the camera off its smooth path; the look point off the traveller's
  const moves = st.map((x) => x?.move ?? null);
  for (const j of spikes(moves, L.jump, L.jumpK)) events.push({ kind: 'jump', t: st[j].t, i: st[j].i, size: st[j].move, sev: st[j].move / L.jump });
  const looks = st.map((x) => x?.look ?? null);
  for (const j of spikes(looks, L.lookJump, L.jumpK)) events.push({ kind: 'look', t: st[j].t, i: st[j].i, size: st[j].look, sev: st[j].look / L.lookJump });
  const spins = st.map((x) => x?.spin ?? null);
  for (const j of spikes(spins, L.spin, L.spinK)) events.push({ kind: 'spin', t: st[j].t, i: st[j].i, size: st[j].spin, sev: st[j].spin / L.spin });
  // the lens: in a wall, the traveller hidden or out of the frame
  let clip = 0, occl = 0, out = 0, n = 0, locked = 0, hid = 0, inBody = 0;
  for (let i = 1; i < S.length; i++) {
    const s = S[i];
    n++;
    if (s.clear < L.clip) { clip++; events.push({ kind: 'clip', t: s.t, i, size: s.clear, sev: 1 + (L.clip - s.clear) / L.clip }); }
    if (s.occl) occl++;
    // (in his body and drawn: left out of the view, s.cut, the room is seen from where he stands, not his insides)
    if (s.body != null && s.body < L.body && !s.cut) { inBody++; events.push({ kind: 'in body', t: s.t, i, size: s.body, sev: 1 + (L.body - s.body) / L.body }); }
    if (!s.cut && (offScreen(s.head) || offScreen(s.chest))) { out++; events.push({ kind: 'out', t: s.t, i, size: 0, sev: 1.5 }); }
    if (s.foeCover != null && !(s.foeD < L.hideFrom)) { locked++; if (s.foeCover > L.hide) { hid++; events.push({ kind: 'foe hidden', t: s.t, i, size: s.foeCover, sev: 1 + s.foeCover }); } }
  }
  // jitter: the arm going in and out, frame to frame (reversals a second), and the path's roughness
  let rev = 0, lastSign = 0;
  for (const x of ok) {
    if (Math.abs(x.dArm) < L.wobble) continue;
    const sgn = Math.sign(x.dArm);
    if (lastSign && sgn !== lastSign) rev++;
    lastSign = sgn;
  }
  const rough = [];
  for (const x of ok) rough.push(x.move);   // (the kinks, every frame: how rough the camera's path is)
  const rms = rough.length ? Math.sqrt(rough.reduce((s, x) => s + x * x, 0) / rough.length) : 0;
  const count = (k) => events.filter((e) => e.kind === k).length;
  const m = {
    secs: +secs.toFixed(1), frames: S.length, fps: +(ok.length / secs).toFixed(0),
    pops: count('pop'), jumps: count('jump'), lookJumps: count('look'), spins: count('spin'),
    popMax: +Math.max(0, ...ok.map((x) => Math.abs(x.dArm))).toFixed(2),
    jumpMax: +Math.max(0, ...moves.filter((x) => x != null)).toFixed(2),
    spinP95: +pct(spins.filter((x) => x != null), 0.95).toFixed(0), spinMax: +Math.max(0, ...spins.filter((x) => x != null)).toFixed(0),
    clip: +(clip / Math.max(1, n)).toFixed(3), occluded: +(occl / Math.max(1, n)).toFixed(3), out: +(out / Math.max(1, n)).toFixed(3),
    reversals: +(rev / secs).toFixed(2), rms: +rms.toFixed(4),
    lockHidden: +(hid / Math.max(1, locked)).toFixed(3), locked, inBody: +(inBody / Math.max(1, n)).toFixed(3),
    armMin: +Math.min(...ok.map((x) => x.arm), Infinity).toFixed(2), armMax: +Math.max(...ok.map((x) => x.arm), 0).toFixed(2),
    framing: framing(S, L).share,
    lockFrame: S.some((s) => s.whole) ? lockFraming(S) : null,
  };
  const fails = [];
  // (so many a minute, rounded up: a half-minute run may have one)
  for (const k of ['pops', 'jumps', 'lookJumps', 'spins']) if (m[k] > Math.ceil(L.perMin[k] * mins - 1e-9)) fails.push(`${k} ${m[k]} in ${m.secs} s (${(m[k] / mins).toFixed(1)}/min > ${L.perMin[k]})`);
  for (const k of ['clip', 'occluded', 'out', 'lockHidden', 'inBody']) if (m[k] > L.share[k]) fails.push(`${k} ${(m[k] * 100).toFixed(1)} % > ${L.share[k] * 100} %`);
  if (m.reversals > L.reversals) fails.push(`reversals ${m.reversals}/s > ${L.reversals}`);
  if (m.rms > L.rms) fails.push(`roughness ${(m.rms * 100).toFixed(1)} cm > ${L.rms * 100} cm`);
  if (opts.framing) {
    const [lo, hi] = Array.isArray(opts.framing) ? opts.framing : L.framing, fr = framing(S, L);
    if (fr.frames < L.minFrames) fails.push(`framing: only ${fr.frames} frames on foot in the open`);
    else if (!(fr.share >= lo && fr.share <= hi)) fails.push(`framing: the traveller ${(fr.share * 100).toFixed(0)} % of the frame's height, not ${lo * 100}–${hi * 100} %`);
  }
  events.sort((a, b) => b.sev - a.sev);
  return { measures: m, events, fails, green: fails.length === 0 };
}

/** The worst `n` events, at least `gap` s apart (one picture per moment). */
export function worst(events, n = 6, gap = 0.6) {
  const picked = [];
  for (const e of events) {
    if (picked.length >= n) break;
    if (picked.some((p) => Math.abs(p.t - e.t) < gap)) continue;
    picked.push(e);
  }
  return picked;
}

/** A markdown table of scenarios (name → analyse()). */
export function table(results) {
  const rows = [['scenario', 'verdict', 's', 'fps', 'pops', 'jumps', 'look', 'spins', 'pop max (m)', 'jump max (m)', 'spin p95 (°/s)', 'clip', 'in body', 'hidden', 'out', 'rev/s', 'rough (cm)', 'arm (m)', 'foe hidden', 'framing']];
  for (const [name, r] of Object.entries(results)) {
    const m = r.measures;
    rows.push([name, r.green ? 'green' : `**red**: ${r.fails.join('; ')}`, m.secs, m.fps, m.pops, m.jumps, m.lookJumps, m.spins, m.popMax, m.jumpMax, m.spinP95,
      `${(m.clip * 100).toFixed(1)} %`, `${((m.inBody ?? 0) * 100).toFixed(1)} %`, `${(m.occluded * 100).toFixed(1)} %`, `${(m.out * 100).toFixed(1)} %`, m.reversals, (m.rms * 100).toFixed(2), `${m.armMin}–${m.armMax}`, m.locked ? `${(m.lockHidden * 100).toFixed(1)} %` : '-', m.framing != null ? `${(m.framing * 100).toFixed(0)} %` : '-']);
  }
  return rows.map((r, i) => `| ${r.join(' | ')} |${i === 0 ? `\n|${r.map(() => '---').join('|')}|` : ''}`).join('\n');
}
