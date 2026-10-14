import { page, screen } from '../platform.js';
import * as THREE from 'three';
import { parseLine, stripTone } from './tone.js';
import { pickTwoShot, pickLookShot, pickSingle, pullIn } from './shot.js';
import { Coverage } from './coverage.js';
import { planLine, voiceOf, PLAYER_VOICE, LANGUAGES, REVEAL_CPS, isQuote, spokenMask } from './voice.js';
import { scriptOf, lineChunks, chunkSvg, setWordMeasure, wordWidth } from './scripts.js';
import { syllableOpen, syllableEnvelope } from '../talk-face.js';
import { confirmKey } from '../native-pad.js';
import { keyBadge, keyText, keySig, hasKeys, inputKind } from '../prompt-keys.js';
import { markKeyPhrase } from './key-phrase.js';
const _ac = new THREE.Vector3(), _bq = new THREE.Vector3(), _cv = new THREE.Vector3();

/**
 * A word's width in em in the panel's face (index.html #dialogue: var(--face)), from a canvas: what the script's boxes
 * are sized by (src/story/scripts.js setWordMeasure). Null without a canvas (node's tests: 1ch a letter).
 */
function panelMeasure(el) {
  const g = typeof document !== 'undefined' ? document.createElement?.('canvas')?.getContext?.('2d') : null;
  if (!g || typeof getComputedStyle !== 'function') return null;
  const seen = new Map();
  return (text, bold) => {
    const k = `${bold ? 1 : 0}${text}`;
    let w = seen.get(k);
    if (w === undefined) {
      g.font = `${bold ? 'bold' : 'normal'} 100px ${getComputedStyle(el).fontFamily}`;
      w = g.measureText(text).width / 100;
      if (seen.size > 4000) seen.clear();
      seen.set(k, w);
    }
    return w;
  };
}

// Conversations. People are data:
//
//   { id: 'ama', name: 'Ama', title: 'keeper of the fires', color: '#c8483a', voice: 1.1,
//     talk: {
//       entry: [                                    // the first entry whose `if` holds opens the talk
//         { if: { quest: 'desert.power', stage: 'ama' }, node: 'power' },
//         { if: { flag: 'met.ama' }, node: 'again' },
//         { node: 'hello' },
//       ],
//       nodes: {
//         hello: { say: ['Line one.', 'Line two, about the {glyph}.'], do: { set: { 'met.ama': true } },
//                  choices: [
//                    { text: 'What are the fires for?', goto: 'fires' },
//                    { text: 'I need power for my ship.', if: { quest: 'desert.power', active: true },
//                      do: [{ advance: ['desert.power', 'ama'] }, { give: 'jar' }], goto: 'jar' },
//                    { text: 'Goodbye.', end: true },
//                  ] },
//         ...
//       } } }
//
// Conditions: { flag, is? } · { not } · { all: [] } · { any: [] } · { has: item }
//   · { quest, stage: s | [s] } · { quest, active } · { quest, done } · { quest, started }
//   · { quest, reached: stage } · { quest, failed } · (ctx) => bool
// Effects (a single one or a list): { set: { flag: value } } · { start: id } · { advance: id | [id, fromStage] }
//   · { stage: [id, stage] } · { give: item } · { take: item } · { keepsake: {...} } · { emit: [event, payload] }
//   · { track: id } · { fail: id } · (ctx) => {}
// Text: {glyph} is the recurring three-dots-over-an-arc mark, {key:aim} a verb's input as the player holds
// it (src/prompt-keys.js keyText: never voiced, drawn again if the input changes), *words* are highlighted: the places
// to go and the things to do (a span of more than eight words is a quotation: a letter, a recording).
// A node without choices ends with "(leave)"; `next: id` continues with another node.

export const MOTIFS = {
  glyph: { plain: '⁖⌒', html: '<svg class="glyph" viewBox="0 0 24 16" aria-label="the glyph: three dots over an arc"><circle cx="5" cy="4" r="2"/><circle cx="12" cy="2.6" r="2"/><circle cx="19" cy="4" r="2"/><path d="M2 14 Q12 6 22 14" fill="none" stroke-width="2"/></svg>' },
};

/** Expand motifs, key placeholders and emphasis for display (html) or for tests and toasts (plain); `kind`: the input in hand. */
export function formatText(text, html = true, kind = inputKind()) {
  let s = String(stripTone(text ?? ''));   // (a line may be { text, tone })
  if (html) s = s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  s = s.replace(/\{(\w+)\}/g, (m, k) => MOTIFS[k] ? (html ? MOTIFS[k].html : MOTIFS[k].plain) : m);
  // the key phrase, "something of value", lettered as itself wherever it is said (src/story/key-phrase.js)
  s = markKeyPhrase(s, html);
  // a short span is a highlight (a place to go, a thing to do); a long one is a quotation (a letter, a recording)
  s = s.replace(/\*([^*]+)\*/g, (m, w) => !html ? w : isQuote(w) ? `<em class="quote">${w}</em>` : `<em>${w}</em>`);
  // {key:aim}: the verb's input for the hands on the game, as they are now (src/prompt-keys.js keyText)
  return keyText(s, { html, kind });
}

/** `person` saying only `line` (a quest they would give is held back, issue #328): their talk for this once. */
export function heldBackPerson(person, line) {
  return { ...person, talk: { entry: [{ node: 'held' }], nodes: { held: { say: [line] } } } };
}

/** The quests an answer's effects (or the node it leads to) would start. */
const startsIn = (effects) => (Array.isArray(effects) ? effects : effects ? [effects] : []).flatMap((e) => (e && typeof e === 'object' && e.start ? [e.start] : []));

/** Evaluate a condition against the game state and quests. */
export function check(cond, ctx) {
  if (cond == null) return true;
  if (typeof cond === 'function') return !!cond(ctx);
  if (Array.isArray(cond)) return cond.every((c) => check(c, ctx));
  const { game, quests } = ctx;
  if (cond.all) return cond.all.every((c) => check(c, ctx));
  if (cond.any) return cond.any.some((c) => check(c, ctx));
  if (cond.not) return !check(cond.not, ctx);
  if (cond.has) return !!quests?.has(cond.has);
  if (cond.flag) return 'is' in cond ? game.flag(cond.flag) === cond.is : !!game.flag(cond.flag);
  if (cond.quest) {
    const q = cond.quest, s = quests.stage(q);
    if ('stage' in cond) return Array.isArray(cond.stage) ? cond.stage.includes(s) : s === cond.stage;
    if ('active' in cond) return quests.isActive(q) === !!cond.active;
    if ('done' in cond) return quests.isDone(q) === !!cond.done;
    if ('failed' in cond) return !!quests.isFailed?.(q) === !!cond.failed;
    if ('started' in cond) return quests.isStarted(q) === !!cond.started;
    if ('reached' in cond) return quests.reached(q, cond.reached);
    return quests.isActive(q);
  }
  return true;
}

/** Apply effects. */
export function apply(effects, ctx) {
  if (!effects) return;
  for (const e of Array.isArray(effects) ? effects : [effects]) {
    if (typeof e === 'function') { e(ctx); continue; }
    const { game, quests } = ctx;
    if (e.set) for (const [k, v] of Object.entries(e.set)) game.set(k, v);
    if (e.start) quests.start(e.start);
    if (e.advance) { const [id, from] = Array.isArray(e.advance) ? e.advance : [e.advance, null]; quests.advance(id, from); }
    if (e.stage) quests.set(e.stage[0], e.stage[1]);
    if (e.give) { quests.give(e.give); ctx.onGive?.(e.give); }
    if (e.take) quests.take(e.take);
    if (e.track) quests.track(e.track);
    if (e.fail) quests.fail(e.fail);
    if (e.keepsake) { if (game.addKeepsake(e.keepsake)) ctx.onKeepsake?.(e.keepsake); }
    if (e.emit) game.emit(e.emit[0], e.emit[1]);
  }
}

// Listen-only talk, for the people who aren't part of a quest (bystanders, the crowd):
//
//   talk: { listen: [
//     '~tired~ One line.',                                     // an entry: a line,
//     ['~playful~ Two lines,', '~neutral~ or three at most.'], // a few lines,
//     { if: { not: { flag: 'temple.desert.done' } }, say: '~neutral~ A hint while it is still news.' },
//     { after: { flag: 'world.desert.done' }, say: '~happy~ News: said first, once it holds.' },
//     { say: '~neutral~ (He plays.)', do: { emit: ['music:solo', { who: 'bako' }] } },
//   ] }
//
// No answers: they say one entry, and the next press ends the talk. Talk again for the next one,
// round and round (never the same twice running, remembered in the save: heard.<key>); an entry
// whose `after` has just come true (a quest done, the temple woken) jumps the queue, once.
// `person.heard` is the key when several people share an id (a crowd's people).

const isEntry = (e) => e && typeof e === 'object' && !Array.isArray(e) && 'say' in e;
const hashOf = (s) => { let h = 2166136261; for (const c of String(s)) h = Math.imul(h ^ c.codePointAt(0), 16777619); return h >>> 0; };

/** The entry a listen-only person says now ({ say, do } or null), and remember it. */
export function pickListen(person, ctx) {
  const list = person.talk?.listen ?? [], game = ctx.game ?? {}, key = `heard.${person.heard ?? person.id}`;
  const open = list.map((e, k) => ({ e: isEntry(e) ? e : { say: e }, k })).filter(({ e }) => check(e.if, ctx) && check(e.after, ctx));
  if (!open.length) return null;
  let pick = open.find(({ e, k }) => e.after && !game.flag?.(`${key}.n${k}`));
  if (pick) game.set?.(`${key}.n${pick.k}`, true);
  else {
    const last = game.flag?.(key);
    // the first time, somewhere along the list (people sharing a list don't all start with the same line)
    const from = typeof last === 'number' ? last : (hashOf(person.seed ?? person.id) % list.length) - 1;
    pick = open.find(({ k }) => k > from) ?? open[0];
    if (pick.k === last && open.length > 1) pick = open.find(({ k }) => k !== last);
  }
  game.set?.(key, pick.k);
  return pick.e;
}

/**
 * The conversation logic without any DOM: which node, which page, which
 * choices are open. The panel (DialogueUI) and the tests both drive this.
 */
export class DialogueRunner {
  constructor(person, ctx) {
    this.person = person;
    this.ctx = ctx;
    this.ended = false;
    const t = person.talk;
    if (t.listen) {
      // listen-only: one entry, said as a single node with no answers
      const said = pickListen(person, ctx);
      if (!said) { this.ended = true; this.pages = []; this.tones = []; this.page = 0; this.node = {}; return; }
      this.talk = { nodes: { listen: { say: said.say, do: said.do, listen: true } } };
      this.goto('listen');
      return;
    }
    this.talk = t;
    const entry = (t.entry ?? [{ node: Object.keys(t.nodes)[0] }]).find((e) => check(e.if, ctx));
    this.goto(entry?.node ?? Object.keys(t.nodes)[0]);
  }
  /** Only listening: no answers, and the talk ends after the last line. */
  get listening() { return !!this.node?.listen; }
  goto(id) {
    const n = this.talk.nodes[id];
    if (!n) { this.ended = true; return; }
    this.nodeId = id;
    this.node = n;
    // each page: its words and its tone ('~sad~ …' or { text, tone }: src/story/tone.js)
    const said = (Array.isArray(n.say) ? n.say : [n.say ?? '']).filter((s) => check(typeof s === 'object' && s?.if ? s.if : null, this.ctx)).map((s) => parseLine(s));
    this.pages = said.map((p) => p.text);
    this.tones = said.map((p) => p.tone);
    this.page = 0;
    apply(n.do, this.ctx);
    this.ctx.onNode?.(id, n);
  }
  /** Lines said after this node's own (each with its tone): what a giver says of the quests the talk gave (issue #273). */
  addPages(lines = []) {
    if (this.ended || !lines.length) return;
    for (const l of lines) { const p = parseLine(l); this.pages.push(p.text); this.tones.push(p.tone); }
  }
  get text() { return this.pages[this.page] ?? ''; }
  get tone() { return this.tones?.[this.page] ?? 'neutral'; }
  get speaker() { return this.node.speaker === 'player' ? 'player' : 'npc'; }
  get lastPage() { return this.page >= this.pages.length - 1; }
  /** An answer that would give a quest held back for something it needs (issue #328: src/story/quest-needs.js): not offered. */
  startsHeld(c) {
    const q = this.ctx.quests;
    if (!q?.blocked) return false;
    return [...startsIn(c.do), ...startsIn(this.person.talk?.nodes?.[c.goto]?.do)].some((id) => !q.isStarted?.(id) && q.blocked(id));
  }
  /** The choices to show now (only on the last page): [{ text, index }]. Always at least "(leave)" when the node ends. */
  choices() {
    if (!this.lastPage || this.ended || this.listening) return [];
    const list = (this.node.choices ?? []).map((c, index) => ({ ...c, index, text: stripTone(c.text), tone: parseLine(c.text).tone })).filter((c) => check(c.if, this.ctx) && !(c.once && this.ctx.game.flag(`said.${this.person.id}.${this.nodeId}.${c.index}`)) && !this.startsHeld(c));
    if (list.length) return list;
    if (this.node.next) return [];
    return [{ text: this.node.bye ?? '(leave)', end: true, index: -1 }];
  }
  /**
   * The answers this node will end on, whichever page is up (the panel keeps their room from the first page: answers
   * coming up when the words were done moved the words up the screen as you read them, issue #60).
   */
  choicesAhead() {
    if (this.ended || this.listening) return [];
    const page = this.page;
    this.page = Math.max(0, this.pages.length - 1);
    try { return this.choices(); } finally { this.page = page; }
  }
  /** Next page, or the node's `next`; false if it is waiting for a choice. */
  advance() {
    if (this.ended) return false;
    if (!this.lastPage) { this.page++; return true; }
    if (this.listening) { this.ended = true; return false; }   // (the next press closes the panel)
    if (this.node.next && !(this.node.choices ?? []).some((c) => check(c.if, this.ctx))) { this.goto(this.node.next); return true; }
    return false;
  }
  choose(i) {
    const c = this.choices().find((x) => x.index === i) ?? this.choices()[i];
    if (!c) return false;
    if (c.once) this.ctx.game.set(`said.${this.person.id}.${this.nodeId}.${c.index}`, true);
    apply(c.do, this.ctx);
    this.ctx.onChoice?.(c);
    if (c.end || !c.goto) { this.ended = true; return true; }
    this.goto(c.goto);
    return true;
  }
}

// ---------------------------------------------------------------------------

/**
 * One answer as a button: its mark in a column of its own, then its words (index.html
 * #dialogue .dlg-choices). The column holds all three marks, and the body's input class
 * shows one: the keyboard's number, a plain › for touch, and with a controller the
 * confirm button's badge on the focused answer (› on the others). Each answer has the
 * same three, so the column is as wide on every one, and the words, a flex item of their
 * own, wrap beside it and never under or over it.
 */
export function choiceHtml(c, k, key = confirmKey()) {
  return `<button data-i="${c.index}"><span class="dlg-key" aria-hidden="true"><b class="dlg-num">${k + 1}</b><b class="dlg-mark">›</b>${keyBadge(key)}</span>`
    + `<span class="dlg-say">${formatText(c.text)}</span></button>`;
}

const REVEAL = REVEAL_CPS;   // letters per second at an even pace (each line's voice and tone scale it)
/** The translator as the tongues page shows it (tools/tongues.html): a word turns into your words LAG letters after
 * it is said, fading over FADE more. The panel no longer plays it (issue #147: the page is shown whole, in your words,
 * at once; the voice still says it at its own pace). (14 and 12 until October 2026) */
export const LAG = 5, FADE = 5;

/** px kept clear over the portrait at the top of the screen when a tall page has to be fitted (Dialogue.fit). */
export const FIT_MARGIN = 6;

/** The conversation camera: a re-pick this far from the eye (m) is a cut; cuts no closer together than CUT_GAP s (unless the page turns, or the shot is blocked). */
export const CUT_FAR = 0.8, CUT_GAP = 2.5;
/** The traveller in the panel on his own lines: his name tag and his chip's colour (his coral shirt). */
export const TRAVELLER_TAG = { id: 'you', name: 'You', title: '', color: '#d9694a' };

let _chunks = { text: null, list: [] };
/**
 * A line as the panel shows it while it is said: its first `shown` characters, the words said
 * but not yet translated in the speaker's own script (src/story/scripts.js: each world's), the
 * rest in your words. A word turns when `translated` (letters, LAG behind the reveal) passes its
 * end, its English fading in over its glyphs. The glyphs are drawn exactly as wide as the
 * English (measured in the panel's face: scripts.js wordWidth), so nothing moves when a word turns.
 * @param o.lang        the speaker's tongue; null: no translation (home speech, the traveller)
 * @param o.spoken      spokenMask(text): stage directions and narration aren't in the script
 */
export function revealHtml(full, { lang = null, shown = full.length, translated = Infinity, spoken = null } = {}) {
  const n = Math.min(full.length, Math.floor(shown));
  const S = lang ? scriptOf(lang) : null;
  let disp = '', at = 0;
  const units = [];
  if (S && translated < full.length + FADE) {
    if (_chunks.text !== full) _chunks = { text: full, list: lineChunks(full) };
    for (const ch of _chunks.list) {
      if (ch.from >= n) break;
      const age = translated - ch.to;
      if (age >= FADE) continue;
      const li = Math.max(0, ch.text.search(/[\p{L}\p{N}]/u));
      if (spoken && !spoken[ch.from + li]) continue;
      disp += full.slice(at, ch.from) + '\uE000' + ch.text + '\uE001';
      units.push({ ch, shown: n - ch.from, a: age > 0 ? Math.ceil((age / FADE) * 6) / 6 : 0 });
      at = ch.to;
    }
  }
  if (at < n) disp += full.slice(at, n);
  // hide a motif half typed, and a star still waiting for its pair
  const shownText = disp.replace(/\{[\w:]*$/, '').replace(/\*([^*]*)$/, (m, w) => ((disp.match(/\*/g)?.length ?? 0) % 2 ? w : m));
  let u = 0;
  return formatText(shownText).replace(/\uE000([^\uE001]*)\uE001/g, (m, eng) => {
    const x = units[u++], o = { shown: x.shown, proper: x.ch.proper, space: x.ch.space, bold: x.ch.bold };
    if (!x.a) return chunkSvg(x.ch.text, lang, o);
    // turning: the English fading in, the glyphs fading out over it
    const a = Math.min(1, x.a);
    return `<span style="white-space:nowrap"><span style="opacity:${a.toFixed(2)}">${eng}</span>${chunkSvg(x.ch.text, lang, { ...o, style: `margin-left:-${wordWidth(x.ch.text, x.ch.bold)};opacity:${(1 - a).toFixed(2)}` })}</span>`;
  });
}

/**
 * The conversation panel, the facing and the two-shot camera.
 * @param o.game, o.quests  state
 * @param o.sound           Sound (voice blips, chimes)
 * @param o.portrait        (person, npc) => dataURL | null: a live sketch of their face
 * @param o.portraitYou     (tone) => dataURL | { src, background } | null: the traveller's, wearing that tone (his own lines)
 * @param o.onOpen/onClose  callbacks (pause the procession, let go of the pointer…)
 */
export class Dialogue {
  constructor({ game, quests, sound = null, portrait = null, portraitYou = null, toast = () => {}, onOpen = () => {}, onClose = () => {} }) {
    Object.assign(this, { game, quests, sound, portrait, portraitYou, toast, onOpen, onClose });
    this.cover = new Coverage();   // who the camera frames (src/story/coverage.js)
    this._you = new Map();   // his portraits this conversation, by tone
    this.open = false;
    this.blend = 0;          // the two-shot camera's weight: 1 while talking, 0 after (a cut both ways, never a swing)
    this.clock = 0;          // s, while open (the mouths' syllables are timed on it)
    this._mouth = [];        // syllables being said: { at, dur, open, who: 'npc' | 'player' }
    this.el = page.byId('dialogue');
    this._eye = new THREE.Vector3(); this._look = new THREE.Vector3(); this._eyeC = new THREE.Vector3(); this._q = new THREE.Quaternion();
    this._m = new THREE.Matrix4();
    if (this.el) {
      setWordMeasure(panelMeasure(this.el));   // (a script's words as wide as their English in the panel's face)
      // the speaker's name in plain ink on the paper's first line, their portrait at its corner (issue #208: no
      // caption box, no subtitle); no button hints and no translator tag (a foreign page fades in once: .dlg-text.heard)
      this.el.innerHTML = `<div class="dlg-panel"><div class="dlg-who"><div class="dlg-chip"><img alt=""><span></span></div></div>
        <div class="dlg-tag"><b class="dlg-name"></b></div>
        <p class="dlg-text"></p><div class="dlg-choices"></div><i class="dlg-more" aria-hidden="true"></i><span class="dlg-next" aria-hidden="true"></span></div>`;
      this.q = (s) => this.el.querySelector(s);
      this.el.addEventListener('click', (e) => {
        const b = e.target.closest('.dlg-choices:not(.waiting) button[data-i]');
        if (b) this.choose(+b.dataset.i);
        else if (e.target.closest('.dlg-panel')) this.next();
      });
      // the mouse on an answer moves the cue there (one underlined answer, the one Enter / E would pick)
      this.el.addEventListener('pointerover', (e) => {
        const b = e.target.closest?.('.dlg-choices:not(.waiting) button[data-i]');
        if (b && e.pointerType === 'mouse') b.focus({ preventScroll: true });
      });
      page.on('keydown', (e) => {
        if (!this.open || e.repeat) return;
        if (e.code === 'Escape') { e.stopImmediatePropagation(); this.close(); return; }
        const n = Number(e.key);
        if (n >= 1 && n <= 9) { const c = this.runner.choices()[n - 1]; if (c) this.choose(c.index); return; }
        if (e.code === 'KeyE' || e.code === 'Space' || e.code === 'Enter') {
          if (performance.now() - this.openedAt < 250) return;   // the press that opened it
          e.preventDefault();
          // Enter / E on a focused choice picks it; otherwise the page turns (it is all shown at once)
          const f = page.activeElement();
          if (f?.dataset?.i !== undefined && this.el.contains(f)) this.choose(+f.dataset.i);
          else this.next();
        }
      }, true);
    }
  }

  /**
   * Talk to `person` (data) embodied by `npc` (an NPC, or a crowd person's puppet);
   * or look at a thing (no npc) at `at`, `look` being the part to look at when
   * `at` is only where you stand to see it (the foot of a statue).
   */
  start(person, npc = null, at = null, look = null) {
    if (this.open) return false;
    this.person = person; this.npc = npc; this.at = at; this.look = look;
    const ctx = this.ctx = {
      game: this.game, quests: this.quests, person, npc,
      onGive: (item) => this.toast(`Received: ${this.quests.itemName?.(item) ?? item}`),
      onKeepsake: (k) => this.toast(`Keepsake: ${k.name}`),
      // (each node reached, for whoever writes things down: the Sightings, src/story/sightings.js)
      onNode: (node, n) => this.game.emit('dialogue:node', { id: person.id, node, say: n.say }),
    };
    // one who would give a quest but for a critical item it needs (issue #328): one line, where it is, instead of their
    // talk; the quest that gets it starts if it hadn't (src/story/quest-needs.js)
    const held = this.quests?.heldBack?.(person.id);
    if (held) {
      person = this.person = ctx.person = heldBackPerson(person, held.line);
      const via = held.need?.quest;
      if (via && via !== held.quest && this.quests.def?.(via) && !this.quests.isStarted(via) && !this.quests.blocked?.(via)) this.quests.start(via);
    }
    // the world's opening quest, if this is one who opens it: under way before they speak (src/story/quests.js opensWith)
    // (and every quest they give, issue #273: what they say of one as they give it, a box's where, ends their first words)
    else this.quests?.opening?.(person.id);
    this.runner = new DialogueRunner(person, ctx);
    this.runner.addPages(this.quests?.givenWords?.() ?? []);
    if (this.runner.ended) { this.quests?.opened?.(); return false; }
    this.open = true;
    this.openedAt = typeof performance !== 'undefined' ? performance.now() : 0;
    this.revealed = 0;   // (how far the voice has said the page: its syllables, the mouths, the camera's coverage)
    this._mouth.length = 0;
    this._doneAt = null; this._you.clear(); this._chip = null; this._wordsSaid = null;
    this.cover.reset(this.clock); this._framed = null;
    // the camera cuts straight to the two-shot (frameCamera picks it on the next frame, after onOpen
    // has made room between the two): no swing round from the follow camera
    this.blend = 1; this._shot = null; this._across = null; this._cutAt = this.clock;
    this.game.set(`met.${person.id}`, true);
    this.game.emit('dialogue:start', { npc, id: person.id });
    this.onOpen(person, npc);
    // the portrait: a data URL, or { src, background } (just them against a flat colour: src/story/portrait-bg.js);
    // an engine's panel (publish) shows it too
    this.shot = null;
    try { this.shot = this.portrait?.(person, npc) ?? null; } catch { /* no sketch */ }
    if (this.el) {
      this.showChip();
      this.el.classList.add('open');
      page.bodyClass('talking', true);
      page.exitPointerLock();
    }
    this.render();   // (and its state for an engine's panel, which has no page: publish)
    return true;
  }

  /** Whose line the panel shows now: 'player' on his own pages. */
  get voice() { return this.runner?.speaker === 'player' ? 'player' : 'npc'; }

  /** The tone of what is being said now. */
  get nowTone() { return this.runner?.tone ?? 'neutral'; }

  /** His portrait wearing `tone` (captured once a conversation per tone: Dialogue's portraitYou). */
  youShot(tone) {
    if (!this._you.has(tone)) { let s = null; try { s = this.portraitYou?.(tone) ?? null; } catch { /* no sketch */ } this._you.set(tone, s); }
    return this._you.get(tone);
  }

  /** The name tag and the portrait: the person's, or the traveller's on his own lines (the initial when there is no sketch). */
  showChip() {
    const you = this.voice === 'player';
    const who = you ? TRAVELLER_TAG : this.person, shot = you ? this.youShot(this.nowTone) : this.shot;
    const key = `${you ? 'you' : 'them'}:${typeof shot === 'string' ? shot.length : shot?.src?.length ?? 0}:${you ? this.nowTone : ''}`;
    if (!this.el || this._chip === key) return;
    this._chip = key;
    this.q('.dlg-name').textContent = who.name;
    const chip = this.q('.dlg-chip');
    chip.style.background = who.color ?? '#d8a24a';
    chip.classList.toggle('you', you);
    this.q('.dlg-chip span').textContent = who.name[0];
    const img = this.q('.dlg-chip img');
    img.hidden = true;
    const src = typeof shot === 'string' ? shot : shot?.src;
    if (src) { img.src = src; img.hidden = false; if (shot.background) chip.style.background = shot.background; }
  }

  /** Turn the page (or close on the last one). The page is shown whole as it comes, so a press never just
   * "finishes the line" (it did until issue #147): the voice of the page left behind stops with it. */
  next() {
    if (!this.open) return;
    if (this.runner.advance()) { this.revealed = 0; this.render(); return; }
    if (this.runner.ended) this.close();
    else if (this.runner.choices().length === 1 && this.runner.choices()[0].end) this.close();
  }

  choose(i) {
    if (!this.open) return;
    // the answer he picked is not said again (it used to be: his words in the panel, a mumble, the camera on
    // him, before the reply; playtest, October 2026): the one he talks to replies at once
    this.runner.choose(i);
    this.sound?.toolClick?.(true);
    if (this.runner.ended) { this.close(); return; }
    this.revealed = 0;
    this.render();
  }

  close() {
    if (!this.open) return;
    this.open = false;
    this.blend = 0;   // and cuts back to the follow camera, which has kept its place behind the traveller all along
    this.closedAt = typeof performance !== 'undefined' ? performance.now() : 0;
    this.el?.classList.remove('open');
    page.bodyClass('talking', false);
    screen.set('dialogue', null);
    this.game.emit('dialogue:end', { npc: this.npc, id: this.person.id });
    this.quests?.opened?.();   // (the quest this talk opened says so now)
    this.onClose(this.person, this.npc);
  }

  /** The voice of the page now showing: its syllables (planLine), language and pace. */
  voicePlan() {
    const r = this.runner, key = `${r.nodeId}:${r.page}:${r.text.length}`;
    if (this._plan?.key === key) return this._plan;
    const player = r.speaker === 'player';
    // things you look at are narration: only their *quoted* words are voiced (a recording, a letter; not
    // a *highlight*), and a broadcast (narrator: true) voices every *starred* word
    const narrator = !player && (this.person.narrator ? 'all' : this.person.narrator ?? (!this.npc && !this.person.kind && !this.person.speaks));
    const lang = player ? 'home' : this.person.lang ?? this.sound?.language ?? 'home';
    const voice = voiceOf(player ? PLAYER_VOICE : { ...this.person, scale: this.person.scale ?? this.npc?.person?.size ?? this.npc?.object?.scale?.x });
    const plan = planLine({ text: r.text, tone: r.tone }, { voice, lang, narrator });
    this._plan = Object.assign(plan, { key, next: 0, narrator, player, foreign: !LANGUAGES[lang]?.native && !(narrator && !plan.syllables.length), mask: spokenMask(r.text, narrator) });
    return this._plan;
  }

  render() {
    this.publish();
    // each line as it comes up, for whoever listens to the words (main.js: the hum, src/story/hum.js)
    const said = this.runner?.text;
    if (said && said !== this._wordsSaid) { this._wordsSaid = said; this.game?.emit?.('words', { text: said }); }
    if (!this.el) return;
    this.showChip();
    const r = this.runner;
    const full = r.text;
    const plan = this.voicePlan();
    // the page whole and in your words at once (issue #147: no typing, no words turning out of the speaker's
    // script; the voice says it at its own pace). A foreign speaker's page fades in once as it comes (.heard),
    // the translator's only trace. The node's longest page is laid out unseen under it (.dlg-ghost): the panel
    // keeps its size as the pages turn (issue #60)
    const ghost = (r.pages ?? []).reduce((a, b) => (b.length > a.length ? b : a), full);
    const text = `<span class="dlg-ghost" aria-hidden="true">${formatText(ghost)}</span><span class="dlg-live">${formatText(full)}</span>`;
    const el = this.q('.dlg-text');
    let laid = false;
    if (el._html !== text) { el.innerHTML = text; el._html = text; laid = true; }
    el.classList.toggle('player', r.speaker === 'player');
    el.classList.toggle('heard', !!plan.foreign);
    const choices = r.choices();
    // (choicesAhead: the answers' room kept on a page before them, so they stand where they will be)
    const ahead = choices.length ? choices : r.choicesAhead(), waiting = !choices.length && ahead.length > 0;
    const box = this.q('.dlg-choices');
    const html = ahead.map((c, k) => choiceHtml(c, k)).join('');
    box.classList.toggle('waiting', waiting);
    const fresh = box.dataset.html !== html;
    if (fresh) { box.innerHTML = html; box.dataset.html = html; laid = true; }
    if (fresh || box.dataset.shown !== String(choices.length > 0)) {
      box.dataset.shown = String(choices.length > 0);
      for (const b of box.querySelectorAll('button')) b.tabIndex = choices.length ? 0 : -1;
      // once they are done talking, the first answer is the one a press would pick (issue #211): focused, whatever is
      // in hand (it was only with a pad, and lost when one node's answers led straight to the next's)
      if (choices.length) box.querySelector('button')?.focus?.({ preventScroll: true });
    }
    // a small mark at the panel's corner when the next press turns the page
    this.el.classList.toggle('more', !choices.length);
    // (and, with a pad in hand, the button that turns it: index.html .dlg-next; native-pad.js prints it as the pad does)
    const next = this.q('.dlg-next'), key = confirmKey();
    if (next && next.dataset.key !== key) { next.dataset.key = key; next.innerHTML = keyBadge(key); }
    if (laid) this.fit();
  }

  /**
   * The panel kept on the screen: the type is never made smaller to fit the box (the box grows instead), but a
   * page and its answers too tall for a short screen (the Retroid's 410 CSS px, a phone on its side, a big text
   * size) are drawn just small enough that the portrait's top stays in view (--fit, index.html #dialogue).
   */
  fit() {
    const el = this.el;
    if (!el?.style || typeof getComputedStyle === 'undefined') return;
    el.style.removeProperty('--fit');
    // (offsetTop: where the panel stands, without the slide it comes in on; the portrait stands 2.1 em over it)
    const room = () => el.offsetTop - parseFloat(getComputedStyle(el).fontSize) * 2.2 - FIT_MARGIN;
    let f = 1;
    for (let k = 0; k < 3; k++) {
      const over = -room();
      if (!(over > 0.5)) break;
      f *= Math.max(0.6, 1 - over / Math.max(1, el.offsetHeight + over * 0.3));
      el.style.setProperty('--fit', f.toFixed(3));
    }
    this.fitted = f;
  }

  /** The panel as data (platform.js screen.dialogue): an engine draws its own from it; the page's is render(). */
  publish() {
    // (the page whole at once, as the page's panel shows it: issue #147)
    const r = this.runner, full = r.text, n = full.length, done = true;
    const choices = r.choices(), you = this.voice === 'player';
    const p = you ? TRAVELLER_TAG : this.person, shot = you ? this.youShot(this.nowTone) : this.shot;
    const text = full;
    screen.set('dialogue', {
      name: p.name, title: '', color: p.color ?? '#d8a24a', speaker: you ? 'player' : r.speaker ?? 'npc',
      portrait: (typeof shot === 'string' ? shot : shot?.src) ?? null, backdrop: (typeof shot === 'object' && shot?.background) || null,
      text, shown: n, done, more: done && !choices.length,
      choices: choices.map((c) => ({ text: c.text, tone: c.tone ?? null, index: c.index })),
    });
  }

  /** Per frame: reveal text, voice blips, keep the speaker turned to you. */
  update(dt) {
    this._dt = dt;
    this.clock += dt;   // (on after closing too: the mouths finish their last syllable)
    this.blend = this.open ? 1 : 0;   // (eased until October 2026: the camera swung round the pair to get there)
    if (!this.open) return;
    this.sound?.holdFloor?.();   // nobody else mumbles over a conversation
    const len = this.runner.text.length;
    // the input changed hands (a pad picked up, a key moved) with a {key:…} on the page: drawn again in the new names
    const sig = keySig();
    if (sig !== this._keySig) { const was = this._keySig; this._keySig = sig; if (was !== undefined && [this.runner.text, ...this.runner.choices().map((c) => c.text)].some(hasKeys)) this.render(); }
    // who the camera frames (src/story/coverage.js): his face while he speaks, or taking in a strong line
    const r = this.runner, done = this.revealed >= len;
    if (!done) this._doneAt = null; else this._doneAt ??= this.clock;
    this.cover.update({ t: this.clock, page: `${r.nodeId}:${r.page}`, speaker: r.speaker, tone: r.tone,
      done, doneFor: done ? this.clock - this._doneAt : 0, letters: len, can: this._canSingle !== false });
    if (this.revealed < len) {
      // the voice says the page at its own pace (the words are all shown already): each syllable as it comes up
      const plan = this.voicePlan();
      this.revealed = Math.min(len, this.revealed + dt * (plan.cps || REVEAL));
      const S = plan.syllables;
      while (plan.next < S.length && S[plan.next].i < this.revealed) {
        const syl = S[plan.next++];
        if (this.sound?.syllable) this.sound.syllable(syl, { plan });
        else this.sound?.blip?.(syl.f0 / 170);
        this.say({ at: this.clock, dur: syl.dur, open: syllableOpen(syl), who: plan.player ? 'player' : 'npc' });
      }
    }
  }

  /** A syllable starts in `who`'s mouth: the one before it shuts. */
  say(e) {
    for (const p of this._mouth) if (p.who === e.who && p.at <= e.at && p.at + p.dur > e.at - 0.03) p.dur = Math.max(0, e.at - p.at - 0.03);
    this._mouth.push(e);
  }

  /** How open `who`'s mouth is now ('npc' | 'player'), from the syllables being said (0 between them). */
  mouth(who) {
    let m = 0, keep = 0;
    for (const e of this._mouth) {
      const dt = this.clock - e.at;
      if (dt > e.dur + 0.1) continue;
      this._mouth[keep++] = e;
      if (e.who === who) m = Math.max(m, syllableEnvelope(dt, e.dur) * e.open);
    }
    this._mouth.length = keep;
    return m;
  }

  /**
   * Who says what now, for their faces (src/talk-face.js): the person's line while it is revealed, the
   * traveller's own pages. { npc: { speaking, tone, mouth, key, text }, player: { … } }
   */
  faces() {
    const r = this.runner, revealing = this.open && this.revealed < (r?.text.length ?? 0);
    const voiced = (this._plan?.syllables.length ?? 0) > 0 && !this._plan?.narrator;
    const side = (who) => {
      const lines = this.open && r?.speaker === who && revealing;
      // (a line with no voice to follow, the mouth moves by itself: null)
      // (`key`, `text`: the page being said, for the gestures that go with it: src/talk-gesture.js)
      const f = { speaking: !!lines, tone: r?.tone ?? 'neutral', mouth: lines && !voiced ? null : this.mouth(who), key: r ? `${r.nodeId}:${r.page}` : null, text: r?.text ?? '' };
      // (the traveller taking in a strong line, the camera on him: the look he wears, src/story/coverage.js REACTS)
      if (who === 'player' && !f.speaking && this.open && this.cover.reaction) f.look = this.cover.reaction.look;
      return f;
    };
    return { npc: side('npc'), player: side('player') };
  }

  /**
   * The conversation camera, blended over the follow camera by `blend`:
   * talking to someone, the two-shot (both faces in frame, off to the side of
   * the line between them); looking at a thing (o.look), over the traveller's
   * shoulder at it. The shot is picked so that nothing stands in the way
   * (src/story/shot.js): walls, trees, rocks, the ground (o.sight) and
   * bystanders (`avoid`: feet positions, or a function returning them). It is
   * looked at again every so often (people walk into it) and on every new page:
   * a small change is eased over, a new angle is a cut (never a swing round the
   * pair): at once when the page turns or the shot is blocked, else at most every
   * CUT_GAP seconds. While the traveller speaks or takes a strong line in (this.cover:
   * src/story/coverage.js), a closer three-quarter shot of his face from beside the other's
   * shoulder (pickSingle), on the two-shot's side of the line between them; a framing change is
   * always a cut, and when there is no clear close shot the two-shot stays.
   * @param o.sight         sightOf(physics), or null (no level geometry)
   * @param o.faceA/faceB   the faces (default: over the feet)
   * @param o.single        the traveller's face as drawn (its centre), when a close shot of him may be had (null: never)
   * @param o.singleFacing  the way his face looks (the close shot's angle is taken mostly off it)
   * @param o.viewH         the view's height (CSS px: his face no taller than SINGLE.most px on a big screen)
   * @param o.radiusB       the other's body radius (m: a giant is wider)
   * @param o.look          the thing looked at (no two-shot)
   * @param o.facing        which way the traveller faces (for a thing right overhead)
   */
  frameCamera(camera, player, npcPos, up = new THREE.Vector3(0, 1, 0), avoid = [], o = {}) {
    if (this.blend < 0.002 || !(npcPos || o.look)) { this._side = 0; this._shot = null; this._two = null; this._across = null; this._framed = null; return; }
    const dt = Math.min(this._dt ?? 1 / 60, 0.1);
    this._shotT = (this._shotT ?? 0) - dt;
    const page = this.runner ? `${this.runner.nodeId}:${this.runner.page}` : '';
    const turned = page !== this._shotPage;
    if (turned) { this._shotPage = page; this._shotT = 0; }
    // who is framed (src/story/coverage.js): the two-shot, or his face; a new framing is picked and cut to now
    const single = !o.look && npcPos && o.single ? o.single : null;
    this._canSingle = !!single;
    const want = single && this.cover.who === 'traveller' ? 'traveller' : 'two';
    const reframed = want !== this._framed;
    if (reframed) { this._framed = want; this._framedOk = true; this._shotT = 0; }
    if (!this._shot || (this.open && this._shotT <= 0)) {
      // pick (or check again) the shot: the one with nothing in the way, near the one the camera is already on
      const people = typeof avoid === 'function' ? avoid() : avoid;
      const args = { a: player.pos, up, aspect: camera.aspect, fov: camera.fov, from: this._shot ? null : camera.position, sight: o.sight ?? null, people, prefer: this._shot };
      // (standing nose to nose the line between you is a few cm long and its way is noise: keep the
      // last good one rather than let it swing the shot about)
      let b = npcPos;
      if (b && !o.look) {
        const ac = _ac.subVectors(b, player.pos); ac.addScaledVector(up, -ac.dot(up));
        if (ac.lengthSq() > 0.3 * 0.3) (this._across ??= new THREE.Vector3()).copy(ac).normalize();
        else if (this._across) b = _bq.copy(player.pos).addScaledVector(this._across, 0.3).addScaledVector(up, up.dot(_ac.subVectors(npcPos, player.pos)));
      }
      let pick = null;
      if (want === 'traveller' && this._framedOk) {
        // the side of the line between them the camera is on (the 180° rule): the shot's, or where it is now
        const across = new THREE.Vector3().subVectors(b, player.pos); across.addScaledVector(up, -across.dot(up));
        const sideNow = Math.sign(new THREE.Vector3().crossVectors(up, across).dot(_cv.subVectors(camera.position, player.pos))) || 1;
        const fb = o.faceB ?? b.clone().addScaledVector(up, 1.55);
        const s = pickSingle({ fa: single, fb, b, radius: o.radiusB ?? 0.3, up, aspect: camera.aspect, fov: camera.fov, side: this._side || sideNow, sight: o.sight ?? null, people, facing: o.singleFacing ?? null, height: o.viewH ?? null, prefer: this._shot?.kind === 'single' ? this._shot : null });
        if (s.ok) pick = s;
        else this._framedOk = false;   // (no clear close shot: the two-shot for the rest of this beat, not cut back to it later)
      }
      if (!pick) {
        pick = o.look
          ? pickLookShot({ ...args, head: o.faceA, target: o.look, facing: o.facing })
          : pickTwoShot({ ...args, b, faceA: o.faceA, faceB: o.faceB, side: this._side || 0, prefer: this._two ?? this._shot });
        if (!o.look) this._two = pick;
      }
      const old = this._shot;
      // a new angle (another side, another kind of shot, or the eye somewhere else): a cut, not a swing
      const jump = !old || pick.kind !== old.kind || pick.side !== old.side || pick.eye.distanceTo(this._eye) > CUT_FAR;
      // (the old one blocked now: the candidate nearest it, as scored this time round)
      const stale = jump && old && pick.all?.find((c) => c.kind === old.kind && c.side === old.side && c.eye.distanceTo(old.eye) < 0.6)?.blocked;
      // (into or out of his close shot: always a cut, the coverage has already waited as long as it should)
      const close = !!old && (pick.kind === 'single') !== (old.kind === 'single');
      const cut = !old || close || (jump && (turned || stale || this.clock - (this._cutAt ?? -1e9) >= CUT_GAP));
      if (!jump || cut) {
        if (cut) { this._eye.copy(pick.eye); this._look.copy(pick.look); this._cutAt = this.clock; this.cuts = (this.cuts ?? 0) + 1; }
        this._shot = pick;
        this._side = pick.side;
      }
      this._shotT = 0.6;
    }
    // eased toward the pick when it only drifts (people shifting), and never through a wall on the way
    const e = 1 - Math.exp(-3 * dt);
    this._eye.lerp(this._shot.eye, e);
    this._look.lerp(this._shot.look, e);
    const eye = this._eyeC.copy(this._eye);
    if (o.sight) pullIn(eye, this._shot.anchor, o.sight, 0.3);
    const k = THREE.MathUtils.smoothstep(this.blend, 0, 1);
    camera.position.lerp(eye, k);
    this._m.lookAt(camera.position, this._look, up);
    this._q.setFromRotationMatrix(this._m);
    camera.quaternion.slerp(this._q, k);
    camera.updateMatrixWorld();
  }
}
