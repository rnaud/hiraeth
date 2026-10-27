// One owner for every music the game plays (issue #711: "no two music should ever overlap").
//
// Each kind of music has a lane: a gain (and the gain of its room, its reverb send) that every source of that kind
// goes through. MusicOwner gives the floor to one lane at a time, the highest-ranked one wanted now, and drives the
// lanes' gains on the audio clock:
//  - the lanes losing the floor fade out, as fast as the one coming in asks (its `cut`: a fight's in a third of a
//    second) or their own `out`, whichever is quicker;
//  - the lane taking the floor holds where it is (silent) until every other is under MUSIC_EPS, then fades in.
// So at most one lane is ever above MUSIC_EPS: the old music is out before the new comes in, never the two summed.
// The envelopes are tracked here (an engine's AudioParam.value can already be the scheduled endpoint), and the lanes'
// rise times are known ahead, so a recording can start where its lane comes in (startAt) and keep its opening.
//
// The lanes, highest first (src/audio.js Sound.musicWants says which are wanted):
//   menu     the pause menu's or the title's music (menuMusic, playTitleTheme)
//   game     a minigame's own music (the pilgrims' drum circle, src/minigames/drums.js)
//   swell    a moment's music: a story moment's swell, a musician's solo, the Garden's sphere song, a box's fanfare,
//            the father's charge (held for its length)
//   prologue the prologue's recording, in the ship
//   battle   a fight: its recording (src/scene-music.js), or the drum layer where that is not there
//   bands    the musicians of a world, when you are near enough to hear them
//   theme    the world's recorded theme (src/soundtracks.js, src/music-moments.js)
//   score    the world's procedural score (src/score.js)

/** A lane under this gain is out: the next may come in (-30 dB). */
export const MUSIC_EPS = 0.03;

/** rank: who wins the floor; cut: how fast the others leave when it takes it (s); in / out: its own fades (s). */
export const MUSIC_LANES = {
  menu: { rank: 7, cut: 0.25, in: 0.6, out: 0.5 },
  game: { rank: 6, cut: 0.3, in: 0.3, out: 0.8 },
  swell: { rank: 5, cut: 0.3, in: 0.2, out: 1 },
  prologue: { rank: 4, cut: 1, in: 1, out: 1 },
  battle: { rank: 3, cut: 0.3, in: 0.25, out: 1.5 },
  bands: { rank: 2, cut: 1, in: 1, out: 1.5 },
  theme: { rank: 1, cut: 1, in: 2, out: 10 },     // (out: the moments' long fade, src/music-moments.js)
  score: { rank: 0, cut: 10, in: 1.5, out: 0.6 },   // (cut: what hands it the floor leaves at its own pace)
};

/** A linear envelope: `from` held until `start`, then a straight line to `to` at `end`. */
const valueAt = (e, t) => (t <= e.start ? e.from : t >= e.end ? e.to : e.from + (e.to - e.from) * ((t - e.start) / (e.end - e.start)));
/** When an envelope falls to `eps` (now if it is under it already, never if it never does). */
function fallsTo(e, eps, t) {
  const v = valueAt(e, t);
  if (v <= eps) return t;
  if (e.to > eps || e.end <= t) return Infinity;
  const k = (v - eps) / (v - e.to);   // (the part of what is left of the line)
  return t + (e.end - Math.max(t, e.start)) * k + Math.max(0, e.start - t);
}

export class MusicOwner {
  /** ctx: the audio context; lanes: MUSIC_LANES (or a test's own). */
  constructor(ctx, { lanes = MUSIC_LANES, eps = MUSIC_EPS } = {}) {
    this.ctx = ctx; this.T = lanes; this.eps = eps;
    this.lanes = {};
    this.floor = null;
    for (const id of Object.keys(lanes)) this.lanes[id] = { id, nodes: [], env: { from: 0, to: 0, start: 0, end: 0 } };
  }

  /** The lane's gain (into `dest`) that its music goes through; `room`: its reverb send's, gated alike. */
  node(id, dest, { room = false } = {}) {
    const L = this.lanes[id];
    if (!L) throw new Error(`no music lane ${id}`);
    const key = room ? 'room' : 'dry';
    if (!L[key]) {
      const g = this.ctx.createGain();
      g.gain.value = valueAt(L.env, this.ctx.currentTime);
      if (dest) g.connect(dest);
      L[key] = g; L.nodes.push(g);
      this.apply(g, L.env);   // (made mid-fade: it follows the lane's envelope from here)
    }
    return L[key];
  }

  /** A lane's gain now (0..1), from the envelope. */
  level(id, t = this.ctx.currentTime) { const L = this.lanes[id]; return L ? valueAt(L.env, t) : 0; }
  /** The lanes above MUSIC_EPS at `t` (never more than one). */
  audible(t = this.ctx.currentTime) { return Object.keys(this.lanes).filter((id) => this.level(id, t) > this.eps); }
  /** When the lane comes in (its fade's start): now when it is in or not the floor. A recording starts there. */
  startAt(id, t = this.ctx.currentTime) {
    const e = this.lanes[id]?.env;
    return e && this.floor === id && e.to > 0 && e.start > t ? e.start : t;
  }

  /** Which lane has the floor for these wants ({ lane: true }): the highest-ranked wanted, or none. */
  pick(wants) {
    let best = null;
    for (const [id, on] of Object.entries(wants)) if (on && this.T[id] && (best === null || this.T[id].rank > this.T[best].rank)) best = id;
    return best;
  }

  /** Per frame (and on any change): give the floor to the lane these wants pick. Returns the floor. */
  update(wants, t = this.ctx.currentTime) {
    const floor = this.pick(wants);
    if (floor === this.floor) return floor;
    this.floor = floor;
    const cut = floor ? this.T[floor].cut : Infinity;
    // the others out, as fast as the newcomer asks (or their own fade, if quicker); a fade under way only ever quickens
    let clear = t;
    for (const L of Object.values(this.lanes)) {
      if (L.id === floor) continue;
      const v = valueAt(L.env, t);
      if (v > 0 || L.env.to > 0) {   // (a lane waiting to come in has a rise ahead of it: called off too)
        const end = t + Math.min(this.T[L.id].out, cut) * v;
        const was = L.env.to === 0 ? Math.max(L.env.end, t) : Infinity;
        if (end < was || L.env.start > t) this.set(L, { from: v, to: 0, start: t, end });
      }
      clear = Math.max(clear, fallsTo(L.env, this.eps, t));
    }
    // the floor: held where it is until the rest is out, then in
    if (floor) {
      const L = this.lanes[floor], v = valueAt(L.env, t);   // (above MUSIC_EPS only when all the rest is under it)
      const start = Number.isFinite(clear) ? clear : t;
      this.set(L, { from: v, to: 1, start, end: start + this.T[floor].in * (1 - v) });
    }
    return floor;
  }

  /** At the start (nothing playing yet): the floor to the lane wanted, at once, as the music has always begun. */
  settle(wants, t = this.ctx.currentTime) {
    this.floor = this.pick(wants);
    for (const L of Object.values(this.lanes)) { const v = L.id === this.floor ? 1 : 0; this.set(L, { from: v, to: v, start: t, end: t }); }
    return this.floor;
  }

  set(L, env) {
    L.env = env;
    for (const g of L.nodes) this.apply(g, env);
  }

  /** Schedule a lane's gain along its envelope from now. */
  apply(g, env) {
    const t = this.ctx.currentTime, p = g.gain;
    p.cancelScheduledValues(t);
    p.setValueAtTime(valueAt(env, t), t);
    if (env.end <= t) return;
    if (env.start > t) p.setValueAtTime(env.from, env.start);
    p.linearRampToValueAtTime(env.to, env.end);
  }
}
