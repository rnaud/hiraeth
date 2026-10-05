import { expressionFor, cleanExpression, EXPRESSION_KEYS } from './expression.js';

// Faces that talk (src/expression.js on a Humanoid): while someone says a line they wear its tone
// (src/story/tone.js), their mouth opening and closing on the syllables the voice sings
// (src/story/voice.js planLine), and after it they keep that look a moment and ease back to their
// face at rest (Humanoid.restExpression: the traveller's little smile, everyone else neutral).
//
//   talkFaces.drive(humanoid, { speaking, tone, mouth })   this frame (mouth 0..1, or null: it moves by itself)
//   talkFaces.drive(humanoid, { look: 'smirk' })           a face without a word: no mouth, no hands
//   talkFaces.update(dt)                                    once a frame, after every drive()
//
// Who is driven: the person you talk to and the traveller when he answers (src/story/index.js), and
// the one villager near you whose balloon is up (main.js). Each person's materials are their own
// already (NPC.restyle, Humanoid.ownMaterials), so a face costs a few uniforms a frame, only while
// it moves; once at rest it is let go.

export const TALK_FACE = {
  in: 7,          // how fast the face takes on the tone (1/s; and from one tone to the next)
  hold: 1.3,      // s the tone stays after the line is said
  out: 2.2,       // how fast it eases back to rest (1/s)
  mouth: 60,      // the mouth's own smoothing (1/s): quick, but no flicker
  loud: { shout: 0.7, whisper: 0.2 }, def: 0.4,   // how wide a syllable opens the mouth, by tone
  near: 12,       // m from the camera: a villager's balloon is said with their face too (main.js)
};

/** How open the mouth is for a syllable of a plan (planLine): its vowel (the first formant: a wide, i narrow) and stress. */
export function syllableOpen(s) {
  const f1 = s?.vowel?.[0] ?? 500;
  const stress = Math.min(1.25, Math.max(0.8, Math.sqrt((s?.gain ?? 0.11) / 0.11)));
  return Math.min(1, Math.max(0.2, (f1 - 260) / 560) * stress);
}

/** A syllable's opening over time (dt: s since it began): open and shut again within it, so the next one starts closed. */
export function syllableEnvelope(dt, dur) {
  const u = dt / (dur + 0.03);
  return u <= 0 || u >= 1 ? 0 : Math.sin(Math.PI * u) ** 0.7;
}

/** The mouth for a whole plan, `t` s after its first syllable (each syllable shut by the next: 0 between and after them). */
export function mouthAt(plan, t) {
  let m = 0;
  const S = plan?.syllables ?? [];
  for (let i = 0; i < S.length; i++) {
    const s = S[i];
    if (s.t > t) break;
    const dur = Math.min(s.dur, (S[i + 1]?.t ?? Infinity) - s.t - 0.03);
    m = Math.max(m, syllableEnvelope(t - s.t, dur) * syllableOpen(s));
  }
  return m;
}

/** The mouth moving by itself, for a line with no voice to follow (time t, s). */
export const freeMouth = (t) => Math.max(0, Math.sin(t * 13) * 0.6 + Math.sin(t * 7.3 + 1) * 0.4);

/** One talking face. */
export class TalkFace {
  constructor(h) {
    this.h = h;
    this.tone = 'neutral';
    this.hold = 0;       // s left at full after the line
    this.open = 0;       // the mouth on the syllables, smoothed
    this.talk = 0;       // 0..1 speaking, smoothed (the tone's own mouth gives way to the syllables)
    this.t = 0;
    this.cur = cleanExpression(h.expression ?? h.restExpression ?? {});   // the face now, eased toward the tone's
  }

  /**
   * Step; returns false once the face is back at rest (and stays). `look`: a face worn without a word
   * (a cinematic's smirk): the expression only, the mouth shut and the hands still (quiet: hands.js talkOf).
   */
  update(dt, { speaking = false, tone = null, mouth = null, look = null } = {}) {
    const T = TALK_FACE;
    this.t += dt;
    if (speaking) { if (tone) this.tone = tone; this.hold = T.hold; this.quiet = false; }
    else if (look) { this.tone = look; this.hold = T.hold; this.quiet = true; }
    else if (this.hold > 0) this.hold -= dt;
    const on = speaking || !!look || this.hold > 0;
    // toward the line's tone while it is said and a moment after, then back to rest; a new tone blends from the last
    const goal = expressionFor(this.tone, { amount: on ? 1 : 0, rest: this.h.restExpression });
    const k = 1 - Math.exp(-(on ? T.in : T.out) * dt);
    const c = this.cur;
    let off = 0;
    for (const d of EXPRESSION_KEYS) { c[d.key] += (goal[d.key] - c[d.key]) * k; off = Math.max(off, Math.abs(goal[d.key] - c[d.key])); }
    c.gaze = goal.gaze;
    const want = speaking ? (mouth ?? freeMouth(this.t)) : 0;
    this.open += (want - this.open) * (1 - Math.exp(-T.mouth * dt));
    this.talk += ((speaking ? 1 : 0) - this.talk) * (1 - Math.exp(-8 * dt));
    // the tone's own opening (a gasp, a shout) half closes while the syllables open and shut the mouth over it
    const e = { ...c, open: Math.min(1, c.open * (1 - 0.5 * this.talk) + this.open * (T.loud[this.tone] ?? T.def)) };
    const busy = on || off > 0.004 || this.open > 0.01;
    this.h.setExpression(busy ? e : this.h.restExpression);
    return busy;
  }
}

/** Every talking face this frame. */
export class TalkFaces {
  constructor() {
    this.faces = new Map();   // Humanoid -> TalkFace
    this.driven = new Map();  // Humanoid -> this frame's { speaking, tone, mouth }
  }
  /** This frame, `h` says (speaking) a line in `tone`, the mouth at `mouth`; or listens (speaking false). */
  drive(h, o = {}) {
    if (!h?.setExpression) return;
    const prev = this.driven.get(h);
    // (driven twice in a frame, a conversation over a balloon: speaking wins)
    if (!prev || (o.speaking && !prev.speaking)) this.driven.set(h, o);
  }
  update(dt) {
    for (const h of this.driven.keys()) if (!this.faces.has(h)) this.faces.set(h, new TalkFace(h));
    for (const [h, f] of this.faces) {
      if (!f.update(dt, this.driven.get(h) ?? {})) this.faces.delete(h);
    }
    this.driven.clear();
  }
  /** Let a face go at once, back at rest (a pooled body given to someone else). */
  release(h) {
    if (!this.faces.has(h)) return;
    this.faces.delete(h);
    h.setExpression(h.restExpression);
  }
  get size() { return this.faces.size; }
}

/** The game's faces (one set for the whole world). */
export const talkFaces = new TalkFaces();
