// Who the conversation camera frames (src/story/dialogue.js frameCamera): the two-shot of both of
// them, or a closer three-quarter shot of the traveller from beside the other's shoulder, so his face
// (src/characters/tripo-face.js) is large enough to read.
//
//   const cover = new Coverage()
//   cover.update({ t, page, speaker, tone, answering, done, doneFor, letters, can })  → 'two' | 'traveller'
//   cover.who / cover.reaction / cover.cuts
//
// The traveller is framed while he says something (one of his own pages, or the answer just chosen:
// Dialogue's answer beat) and, now and then, when the other says a line with a strong tone: once the
// line is out, the camera cuts to his face taking it in (a reaction, `reaction`: the look he wears,
// REACTS). The rest of the time the two-shot. Calm cuts:
//   - a shot changes on its own (a reaction) only after it has been held COVER.hold s;
//   - a reaction is held until the page turns, and comes no sooner than COVER.react.gap s after his
//     face was last framed (a reaction or his own words), only for a line of COVER.react.min letters
//     or more, COVER.react.after s after it is out;
//   - consecutive pages by the same speaker keep their shot (the other's pages the two-shot, his his);
//   - `can` false (riding, no room for the close shot): the two-shot throughout.

export const COVER = {
  hold: 1.6,                                    // s a shot is held before it changes by itself
  react: { after: 0.45, gap: 6, min: 18 },      // a reaction: s after the line is out, s since his face was last framed, letters at least
};

/** The look the traveller wears taking in a line of each strong tone (src/expression.js TONE_EXPRESSIONS); other tones: no reaction. */
export const REACTS = {
  sad: 'sad', angry: 'scared', scared: 'scared', surprised: 'surprised', shout: 'surprised',
  happy: 'happy', playful: 'smirk', solemn: 'solemn',
};

export class Coverage {
  constructor() { this.reset(); }
  /** A new conversation at time t: the two-shot it opens on is held like any other. */
  reset(t = -Infinity) {
    this.who = 'two';
    this.since = t;              // when the shot last changed
    this.closeAt = -Infinity;    // when his face was last on the screen (a reaction, or his own words)
    this.reaction = null;        // { page, look } while the traveller is taking a line in
    this.page = null;
    this.cuts = 0;               // changes of who is framed
  }
  /**
   * This frame: what is being said, and so who is framed.
   * @param s.t          the conversation's clock (s)
   * @param s.page       a key for the page showing (node:page)
   * @param s.speaker    'npc' | 'player': whose page it is
   * @param s.tone       its tone
   * @param s.answering  the traveller is saying the answer he chose
   * @param s.done       the page's line is all out
   * @param s.doneFor    s since it was
   * @param s.letters    its length
   * @param s.can        a close shot of him is possible at all
   */
  update({ t = 0, page = null, speaker = 'npc', tone = 'neutral', answering = false, done = false, doneFor = 0, letters = 0, can = true } = {}) {
    const turned = page !== this.page;
    this.page = page;
    if (turned && this.reaction && this.reaction.page !== page) this.reaction = null;
    let want = 'two';
    if (!can) this.reaction = null;
    else if (answering || speaker === 'player') { want = 'traveller'; this.reaction = null; }
    else if (this.reaction) want = 'traveller';
    else if (REACTS[tone] && done && doneFor >= COVER.react.after && letters >= COVER.react.min
      && t - this.closeAt >= COVER.react.gap && this.who === 'two' && t - this.since >= COVER.hold) {
      this.reaction = { page, look: REACTS[tone] };
      want = 'traveller';
    }
    if (want !== this.who) {
      this.who = want;
      this.since = t;
      this.cuts++;
    }
    if (this.who === 'traveller') this.closeAt = t;
    return this.who;
  }
}
