// Gestures while people talk (issue #197): as someone says a line, their body above the hips takes a
// pose or a gesture in the line's tone (src/story/tone.js), from Mixamo's captured conversation clips
// (public/anim/gestures.glb, scripts/mocap/build-gestures.mjs), laid over their idle by the Animator
// (Animator.playGesture: above the legs, so the feet stay planted where the idle has them).
//
//   talkGestures.drive(animator, { speaking, tone, key, text, listening, seated })   this frame (src/story/index.js)
//   talkGestures.drive(animator, null)                                                 out of the conversation
//
// The Animator steps the layer in its own update (Animator.update: TalkGesture.update) and plays what it
// returns. A line (a new `key`) picks a clip for its tone, never the one this body played last; words
// that say no, hello, yes or thank you pick by what they say instead (INTENTS). Loops (talking, sad idle,
// thinking) play while the line is said and a moment after; one-shots (a wave, a shrug, a surprise) play
// to their end, and a long line carries on with a talking loop. The one listening nods now and then
// (ACK). Each change is a crossfade (two layers at most). Without gestures.glb (not loaded yet, or the
// engine bridge with -js-off gestures) nothing is played and nothing is computed; the engines load it alone (engine/game.js).

/**
 * The clips (gestures.glb, named `gesture_<id>`), one-shots unless `loop`; `w` a clip's own share of the pose
 * (Excited pumps its fists in front of the belly: at full weight a slim body's went into it).
 */
export const GESTURE_CLIPS = {
  talking_1: { loop: true }, talking_2: { loop: true }, talking_3: { loop: true }, talking_4: { loop: true },
  arm_gesture: {}, acknowledging: {}, angry_gesture: {}, annoyed_head_shake: {}, disappointed: {}, excited: { w: 0.8 },
  sad_idle_1: { loop: true }, sad_idle_2: { loop: true }, shaking_head_no: {}, standing_arguing: {}, surprised: {},
  thankful: {}, thinking: { loop: true }, waving: {}, yelling: {}, being_cocky: {}, dismissing_gesture: {},
  happy_hand_gesture: {}, hard_head_nod: {}, head_nod_yes: {}, lengthy_head_nod: {}, look_away_gesture: {},
  relieved_sigh: {}, sarcastic_head_nod: {}, thoughtful_head_shake: {},
};

/** A line's tone → the clips it may take (TONES of src/story/tone.js: every one has some). */
export const TONE_GESTURES = {
  neutral: ['talking_1', 'talking_2', 'talking_3', 'talking_4', 'arm_gesture'],
  happy: ['happy_hand_gesture', 'thankful', 'excited'],
  playful: ['being_cocky', 'excited', 'sarcastic_head_nod', 'happy_hand_gesture'],
  sad: ['sad_idle_1', 'sad_idle_2', 'disappointed'],
  tired: ['relieved_sigh', 'sad_idle_2', 'disappointed'],
  solemn: ['thinking', 'thoughtful_head_shake', 'lengthy_head_nod'],
  angry: ['angry_gesture', 'standing_arguing', 'dismissing_gesture', 'yelling'],
  shout: ['yelling', 'angry_gesture', 'standing_arguing'],
  scared: ['surprised', 'look_away_gesture'],
  surprised: ['surprised', 'excited'],
  curious: ['thinking', 'arm_gesture', 'talking_4'],
  whisper: ['talking_3', 'head_nod_yes'],
};

/**
 * What the words themselves say, over the tone: a refusal shakes the head, a greeting or a goodbye waves,
 * agreeing nods, thanks are thankful. Read off the line's start (and "thank" anywhere).
 */
export const INTENTS = [
  { kind: 'thanks', test: /\bthank(s| you)\b/i, clips: ['thankful'] },
  { kind: 'no', test: /^\W*(no|nope|never|not (now|yet|here|this)|i (won't|will not|can't|cannot|refuse)|don't)\b/i, clips: ['shaking_head_no', 'annoyed_head_shake'], angry: ['annoyed_head_shake', 'dismissing_gesture'] },
  { kind: 'greet', test: /^\W*(hello|hi|hey|greetings|welcome|well met|good (morning|evening|day)|farewell|goodbye|good ?bye|bye|safe travels|until next time)\b/i, clips: ['waving'] },
  { kind: 'yes', test: /^\W*(yes|yeah|yep|aye|of course|sure|agreed|indeed|very well|all ?right|okay|ok|right you are)\b/i, clips: ['acknowledging', 'head_nod_yes', 'hard_head_nod'] },
];

/** How the layer moves (s, weights). */
export const GESTURE = {
  in: 0.3,          // blend in
  out: 0.45,        // blend out (and a crossfade's old layer)
  cut: 0.3,         // blend out when the talk is gone (closed, skipped, cut off by a scene, a load, a teleport, a menu)
                    // or the body moves on its own: none left holding a pose after it (issue #551)
  hold: 0.8,        // a loop keeps going this long after its line is said
  cap: 1.6,         // a one-shot is let go at most this long after its line
  long: 5,          // a one-shot longer than this starts somewhere in it and plays at most `most`
  most: 4.5,
  carry: 1.2,       // a one-shot over with the line still being said for this long: a talking loop carries on
  w: 1, whisper: 0.6, seated: 0.75,   // how much of the pose it takes
};
/** The one listening: now and then a nod, a little after the other's line starts. */
export const ACK = { chance: 0.4, after: [0.5, 1.2], w: 0.8, clips: ['acknowledging', 'head_nod_yes', 'lengthy_head_nod'] };

/**
 * How far a gesture may tip the body back from the idle under it (rad; issue #678). Mixamo's actors stand a little
 * back as they talk and nod with the face well up: laid over the game's idle, every clip leaned the trunk back 7-15°
 * and lifted the face 15-25° above it, and a listener's nod at someone at eye height (Plumb before his face) read as
 * staring at the sky. `back`: the trunk (the spine's line, hips to neck) leaning back past the idle's; `up`: the face
 * lifted above the idle's. Both approached softly from half way (heldPitch); leaning forward and looking down are the
 * gestures' own (a sigh, a bow, Sad Idle's eyes on the ground) and kept.
 */
export const GESTURE_POSE = { back: 0.05, up: 0.14 };

/**
 * A pitch past the idle's (`over`, rad, positive the way it is limited) as it is kept: as it is up to half of `most`,
 * then bent softly so it never quite reaches `most` (monotonic, the slope 1 at the knee: no flat top to a nod).
 */
export function heldPitch(over, most) {
  if (!(over > most / 2)) return over;
  const k = most / 2;
  return k + k * Math.tanh((over - k) / k);
}

const clipName = (id) => `gesture_${id}`;
const hash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
const rand = (seed) => { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };

/** What a line's words say (INTENTS), or null. */
export function intentOf(text) {
  const s = String(text ?? '');
  for (const I of INTENTS) if (I.test.test(s)) return I;
  return null;
}

/**
 * The clips a line may take: by what it says, else by its tone (an unknown tone: neutral's).
 * `has(id)`: whether that clip is there (default: all are).
 */
export function gestureChoices(tone, text, has = () => true) {
  const I = intentOf(text);
  const list = I ? ((tone === 'angry' || tone === 'shout') && I.angry ? I.angry : I.clips) : TONE_GESTURES[tone] ?? TONE_GESTURES.neutral;
  return list.filter(has);
}

/** One clip for a line: among its choices, never `last` (the neutral talk when nothing else is left); `r` 0..1. */
export function pickGesture(tone, text, last, r = Math.random(), has = () => true) {
  let list = gestureChoices(tone, text, has).filter((id) => id !== last);
  if (!list.length) list = TONE_GESTURES.neutral.filter((id) => id !== last && has(id));
  return list.length ? list[Math.min(list.length - 1, Math.floor(r * list.length))] : null;
}

/** One body's gestures: up to two layers (the one coming in, the one going out). */
export class TalkGesture {
  constructor(seed = 0) {
    this.seed = seed >>> 0;
    this.layers = [];      // { id, d, loop, t, end, w, wMax, out, spine }
    this.last = null;      // the clip played last (never twice in a row)
    this.key = null;       // the line being said (or listened to)
    this.since = 0;        // s since this body's line was last being said
    this.ack = null;       // a nod waiting: { at, id }
    this.out = [];         // what update() returns (reused)
    // (seated: the arms and the head only, the spine left on the seat as it sits)
  }

  get idle() { return !this.layers.length && !this.ack; }

  start(id, A, wMax, r, spine = true) {
    const clip = A?.moveClip?.(clipName(id));
    if (!clip) return false;
    const loop = !!(GESTURE_CLIPS[id]?.loop ?? clip.userData?.loop), d = clip.duration;
    let t = 0, end = d;
    if (loop) t = r * d;   // (a loop from anywhere in it: the same talk twice doesn't start on the same beat)
    else if (d > GESTURE.long) { t = r * (d - GESTURE.most); end = t + GESTURE.most; }
    wMax *= GESTURE_CLIPS[id]?.w ?? 1;
    for (const L of this.layers) L.out = true;
    this.layers.push({ id, d, loop, t, end, w: 0, wMax, out: false, spine });
    if (this.layers.length > 2) this.layers.splice(0, this.layers.length - 2);
    this.last = id;
    return true;
  }

  /**
   * Step `dt` s. `info`: this frame's { speaking, tone, key, text, listening, seated } (null: not in a
   * conversation). `A`: the Animator (its clips). Returns [{ name, t, w, spine }] to play, under-most first.
   */
  update(dt, info, A) {
    const out = this.out;
    out.length = 0;
    if (info) {
      const r = rand(hash(`${info.key ?? ''}|${this.seed}`));
      const wMax = info.seated ? GESTURE.seated : info.tone === 'whisper' ? GESTURE.whisper : GESTURE.w;
      if (info.speaking) {
        this.since = 0;
        this.ack = null;
        if (info.key !== this.key) {
          this.key = info.key;
          const has = (id) => !!A?.moveClip?.(clipName(id));
          const id = pickGesture(info.tone, info.text, this.last, r(), has);
          if (id) this.start(id, A, wMax, r());
        } else {
          // a one-shot ending with the line still being said: a talking loop carries on from it
          const cur = this.layers.find((L) => !L.out);
          if (!cur || (!cur.loop && cur.end - cur.t < GESTURE.out + dt)) {
            const id = pickGesture('neutral', '', this.last, r(), (x) => !!GESTURE_CLIPS[x]?.loop && !!A?.moveClip?.(clipName(x)));
            if (id) this.start(id, A, wMax, r(), !info.seated);
          }
        }
      } else {
        this.since += dt;
        // listening to the other's new line: now and then a nod
        if (info.listening && info.key !== this.key) {
          this.key = info.key;
          if (r() < ACK.chance) {
            const list = ACK.clips.filter((x) => x !== this.last && !!A?.moveClip?.(clipName(x)));
            this.ack = { at: ACK.after[0] + r() * (ACK.after[1] - ACK.after[0]), id: list[Math.floor(r() * list.length)] ?? null };
          }
        }
        if (this.ack && (this.ack.at -= dt) <= 0) {
          if (this.ack.id && !this.layers.some((L) => !L.out) && this.start(this.ack.id, A, ACK.w * (info.seated ? GESTURE.seated : 1), 0, !info.seated)) this.layers.at(-1).ack = true;
          this.ack = null;
        }
        // (a nod plays to its end; the speaker's own gestures let go a moment after the line)
        for (const L of this.layers) if (!L.out && !L.ack && (L.loop ? this.since > GESTURE.hold : this.since > GESTURE.cap)) L.out = true;
      }
    } else {
      // (no talk this frame, however it ended: every layer lets go, quickly: GESTURE.cut, issue #551)
      this.ack = null; this.key = null;
      for (const L of this.layers) { L.out = true; L.cut = true; }
    }
    // the layers: time on, weights toward their goal, the spent ones dropped
    for (let i = this.layers.length - 1; i >= 0; i--) {
      const L = this.layers[i];
      L.t += dt;
      if (L.loop) { if (L.t >= L.d) L.t %= L.d; }
      else if (L.t >= L.end - GESTURE.out) L.out = true;
      L.w += (L.out ? -dt / (L.cut ? GESTURE.cut : GESTURE.out) : dt / GESTURE.in) * L.wMax;
      if (L.w > L.wMax) L.w = L.wMax;
      if (L.w <= 0 && L.out) { this.layers.splice(i, 1); continue; }
    }
    for (const L of this.layers) {
      const k = L.w / L.wMax, e = k * k * (3 - 2 * k);   // (eased)
      out.push({ name: clipName(L.id), t: Math.min(L.t, L.d), w: e * L.wMax, spine: L.spine });
    }
    return out;
  }
}

/** Who gestures this frame: the Animator keeps its own TalkGesture (Animator.update steps it). `on`: false with ?gestures=0 (to compare). */
export const talkGestures = {
  on: !(typeof location !== 'undefined' && /[?&]gestures=0\b/.test(location.search ?? '')),
  drive(A, info) {
    if (!this.on || !A || !A.lib?.motion?.clips?.length) return;   // (no captured clips: nothing to play, nothing to step)
    if (!info && !A.talkGesture) return;
    A.talkGesture ??= new TalkGesture(A._gestureSeed ?? (A._gestureSeed = (Math.random() * 2 ** 32) >>> 0));
    A.talkInfo = info;
    A.talkDriven = true;
  },
};
