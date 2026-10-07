import { page, screen } from '../platform.js';
import * as THREE from 'three';
import { parseLine, stripTone } from './tone.js';
import { pickTwoShot, pickLookShot, pullIn } from './shot.js';
import { planLine, voiceOf, PLAYER_VOICE, LANGUAGES, REVEAL_CPS, isQuote, spokenMask } from './voice.js';
import { scriptOf, lineChunks, chunkSvg } from './scripts.js';
import { syllableOpen, syllableEnvelope } from '../talk-face.js';
import { confirmKey } from '../native-pad.js';
import { keyBadge } from '../prompt-keys.js';
const _ac = new THREE.Vector3(), _bq = new THREE.Vector3();

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
// Text: {glyph} is the recurring three-dots-over-an-arc mark, *words* are highlighted: the places
// to go and the things to do (a span of more than eight words is a quotation: a letter, a recording).
// A node without choices ends with "(leave)"; `next: id` continues with another node.

export const MOTIFS = {
  glyph: { plain: '⁖⌒', html: '<svg class="glyph" viewBox="0 0 24 16" aria-label="the glyph: three dots over an arc"><circle cx="5" cy="4" r="2"/><circle cx="12" cy="2.6" r="2"/><circle cx="19" cy="4" r="2"/><path d="M2 14 Q12 6 22 14" fill="none" stroke-width="2"/></svg>' },
};

/** Expand motifs and emphasis for display (html) or for tests and toasts (plain). */
export function formatText(text, html = true) {
  let s = String(stripTone(text ?? ''));   // (a line may be { text, tone })
  if (html) s = s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  s = s.replace(/\{(\w+)\}/g, (m, k) => MOTIFS[k] ? (html ? MOTIFS[k].html : MOTIFS[k].plain) : m);
  // a short span is a highlight (a place to go, a thing to do); a long one is a quotation (a letter, a recording)
  s = s.replace(/\*([^*]+)\*/g, (m, w) => !html ? w : isQuote(w) ? `<em class="quote">${w}</em>` : `<em>${w}</em>`);
  return s;
}

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
  get text() { return this.pages[this.page] ?? ''; }
  get tone() { return this.tones?.[this.page] ?? 'neutral'; }
  get speaker() { return this.node.speaker === 'player' ? 'player' : 'npc'; }
  get lastPage() { return this.page >= this.pages.length - 1; }
  /** The choices to show now (only on the last page): [{ text, index }]. Always at least "(leave)" when the node ends. */
  choices() {
    if (!this.lastPage || this.ended || this.listening) return [];
    const list = (this.node.choices ?? []).map((c, index) => ({ ...c, index, text: stripTone(c.text), tone: parseLine(c.text).tone })).filter((c) => check(c.if, this.ctx) && !(c.once && this.ctx.game.flag(`said.${this.person.id}.${this.nodeId}.${c.index}`)));
    if (list.length) return list;
    if (this.node.next) return [];
    return [{ text: this.node.bye ?? '(leave)', end: true, index: -1 }];
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
/** The translator: a word turns into your words LAG letters after it is said, fading over FADE more.
 * (14 and 12 until October 2026: the line stayed alien for half a second or more behind the caret) */
export const LAG = 5, FADE = 5;

/** The conversation camera: a re-pick this far from the eye (m) is a cut; cuts no closer together than CUT_GAP s (unless the page turns, or the shot is blocked). */
export const CUT_FAR = 0.8, CUT_GAP = 2.5;

let _chunks = { text: null, list: [] };
/**
 * A line as the panel shows it while it is said: its first `shown` characters, the words said
 * but not yet translated in the speaker's own script (src/story/scripts.js: each world's), the
 * rest in your words. A word turns when `translated` (letters, LAG behind the reveal) passes its
 * end, its English fading in over its glyphs. The glyphs are drawn exactly as wide as the
 * English (the font is monospaced), so nothing moves when a word turns.
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
  const shownText = disp.replace(/\{\w*$/, '').replace(/\*([^*]*)$/, (m, w) => ((disp.match(/\*/g)?.length ?? 0) % 2 ? w : m));
  let u = 0;
  return formatText(shownText).replace(/\uE000([^\uE001]*)\uE001/g, (m, eng) => {
    const x = units[u++], o = { shown: x.shown, proper: x.ch.proper, space: x.ch.space };
    if (!x.a) return chunkSvg(x.ch.text, lang, o);
    // turning: the English fading in, the glyphs fading out over it
    const len = [...x.ch.text].length, a = Math.min(1, x.a);
    return `<span style="white-space:nowrap"><span style="opacity:${a.toFixed(2)}">${eng}</span>${chunkSvg(x.ch.text, lang, { ...o, style: `margin-left:-${len}ch;opacity:${(1 - a).toFixed(2)}` })}</span>`;
  });
}

/**
 * The conversation panel, the facing and the two-shot camera.
 * @param o.game, o.quests  state
 * @param o.sound           Sound (voice blips, chimes)
 * @param o.portrait        (person, npc) => dataURL | null: a live sketch of their face
 * @param o.onOpen/onClose  callbacks (pause the procession, let go of the pointer…)
 */
export class Dialogue {
  constructor({ game, quests, sound = null, portrait = null, toast = () => {}, onOpen = () => {}, onClose = () => {} }) {
    Object.assign(this, { game, quests, sound, portrait, toast, onOpen, onClose });
    this.open = false;
    this.blend = 0;          // the two-shot camera's weight: 1 while talking, 0 after (a cut both ways, never a swing)
    this.clock = 0;          // s, while open (the mouths' syllables are timed on it)
    this._mouth = [];        // syllables being said: { at, dur, open, who: 'npc' | 'player' }
    this.answer = null;      // the traveller's spoken answer: { tone, until }
    this.el = page.byId('dialogue');
    this._eye = new THREE.Vector3(); this._look = new THREE.Vector3(); this._eyeC = new THREE.Vector3(); this._q = new THREE.Quaternion();
    this._m = new THREE.Matrix4();
    if (this.el) {
      // the speaker's name in a caption tab along the panel's top edge, their portrait at its corner;
      // no button hints and no translator tag: the words resolving out of their script say it all
      this.el.innerHTML = `<div class="dlg-panel"><div class="dlg-who"><div class="dlg-chip"><img alt=""><span></span></div></div>
        <div class="dlg-tag"><b class="dlg-name"></b><i class="dlg-title"></i></div>
        <p class="dlg-text"></p><div class="dlg-choices"></div><i class="dlg-more" aria-hidden="true"></i></div>`;
      this.q = (s) => this.el.querySelector(s);
      this.el.addEventListener('click', (e) => {
        const b = e.target.closest('button[data-i]');
        if (b) this.choose(+b.dataset.i);
        else if (e.target.closest('.dlg-panel')) this.next();
      });
      page.on('keydown', (e) => {
        if (!this.open || e.repeat) return;
        if (e.code === 'Escape') { e.stopImmediatePropagation(); this.close(); return; }
        const n = Number(e.key);
        if (n >= 1 && n <= 9) { const c = this.runner.choices()[n - 1]; if (c) this.choose(c.index); return; }
        if (e.code === 'KeyE' || e.code === 'Space' || e.code === 'Enter') {
          if (performance.now() - this.openedAt < 250) return;   // the press that opened it
          e.preventDefault();
          // Enter / E on a focused choice picks it; otherwise finish the line, then turn the page
          const f = page.activeElement();
          if (f?.dataset?.i !== undefined && this.el.contains(f) && this.revealed >= this.runner.text.length) this.choose(+f.dataset.i);
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
    };
    // the world's opening quest, if this is one who opens it: under way before they speak (src/story/quests.js opensWith)
    this.quests?.opening?.(person.id);
    this.runner = new DialogueRunner(person, ctx);
    if (this.runner.ended) { this.quests?.opened?.(); return false; }
    this.open = true;
    this.openedAt = typeof performance !== 'undefined' ? performance.now() : 0;
    this.revealed = 0; this.translated = -LAG;
    this._mouth.length = 0; this.answer = null;
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
      this.q('.dlg-name').textContent = person.name;
      this.q('.dlg-title').textContent = person.title ?? '';
      const chip = this.q('.dlg-chip');
      chip.style.background = person.color ?? '#d8a24a';
      this.q('.dlg-chip span').textContent = person.name[0];
      const img = this.q('.dlg-chip img');
      img.hidden = true;
      const shot = this.shot, src = typeof shot === 'string' ? shot : shot?.src;
      if (src) { img.src = src; img.hidden = false; if (shot.background) chip.style.background = shot.background; }
      this.el.classList.add('open');
      page.bodyClass('talking', true);
      page.exitPointerLock();
      this.render();
    }
    return true;
  }

  next() {
    if (!this.open) return;
    if (this.revealed < this.runner.text.length) { this.revealed = this.runner.text.length; this.translated = Infinity; this.render(); return; }
    if (this.runner.advance()) { this.revealed = 0; this.translated = -LAG; this.render(); return; }
    if (this.runner.ended) this.close();
    else if (this.runner.choices().length === 1 && this.runner.choices()[0].end) this.close();
  }

  choose(i) {
    if (!this.open) return;
    if (this.revealed < this.runner.text.length) { this.revealed = this.runner.text.length; this.translated = Infinity; this.render(); return; }
    const said = this.runner.choices().find((c) => c.index === i);
    this.runner.choose(i);
    this.sound?.toolClick?.(true);
    // the traveller answers, in their own words (a short mumble; actions in brackets are silent): his
    // face wears the answer's tone and his mouth says its syllables (answering(), mouth('player'))
    if (said) {
      const plan = planLine({ text: said.text, tone: said.tone }, { voice: voiceOf(PLAYER_VOICE), lang: 'home', max: 7 });
      this.sound?.speak?.(plan, { channel: 'choice', gain: 0.8 });
      plan.syllables.forEach((syl, k, S) => this._mouth.push({ at: this.clock + syl.t, dur: Math.min(syl.dur, (S[k + 1]?.t ?? Infinity) - syl.t - 0.03), open: syllableOpen(syl), who: 'player' }));
      this.answer = plan.syllables.length ? { tone: said.tone ?? plan.tone, until: this.clock + plan.total + 0.1 } : null;
    }
    if (this.runner.ended) { this.close(); return; }
    this.revealed = 0; this.translated = -LAG;
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
    if (!this.el) return;
    const r = this.runner, full = r.text;
    const plan = this.voicePlan();
    // reveal letter by letter, keeping the motifs whole: the words come in the speaker's own
    // script as they are said, and turn into the translation a moment behind (revealHtml)
    const n = Math.floor(this.revealed), revealing = n < full.length;
    const text = revealHtml(full, { lang: plan.foreign ? plan.lang : null, shown: n, translated: this.translated, spoken: plan.mask })
      + (revealing ? '<span class="dlg-caret">▍</span>' : '');
    const el = this.q('.dlg-text');
    if (el._html !== text) { el.innerHTML = text; el._html = text; }
    this.q('.dlg-text').classList.toggle('player', r.speaker === 'player');
    const done = this.revealed >= full.length;
    const choices = done ? r.choices() : [];
    const box = this.q('.dlg-choices');
    const html = choices.map((c, k) => choiceHtml(c, k)).join('');
    if (box.dataset.html !== html) {
      box.innerHTML = html; box.dataset.html = html;
      if (choices.length && page.hasBodyClass('controller')) box.querySelector('button')?.focus();
    }
    // a small mark at the panel's corner when the line is done and the next press turns the page
    this.el.classList.toggle('more', done && !choices.length);
  }

  /** The panel as data (platform.js screen.dialogue): an engine draws its own from it; the page's is render(). */
  publish() {
    const r = this.runner, full = r.text, n = Math.floor(this.revealed), done = this.revealed >= full.length;
    const choices = done ? r.choices() : [], p = this.person, shot = this.shot;
    screen.set('dialogue', {
      name: p.name, title: p.title ?? '', color: p.color ?? '#d8a24a', speaker: r.speaker ?? 'npc',
      portrait: (typeof shot === 'string' ? shot : shot?.src) ?? null, backdrop: (typeof shot === 'object' && shot?.background) || null,
      text: full, shown: n, done, more: done && !choices.length,
      choices: choices.map((c) => ({ text: c.text, tone: c.tone ?? null, index: c.index })),
    });
  }

  /** Per frame: reveal text, voice blips, keep the speaker turned to you. */
  update(dt) {
    this._dt = dt;
    this.clock += dt;   // (on after closing too: the traveller's last answer is still being said)
    this.blend = this.open ? 1 : 0;   // (eased until October 2026: the camera swung round the pair to get there)
    if (!this.open) return;
    this.sound?.holdFloor?.();   // nobody else mumbles over a conversation
    const len = this.runner.text.length;
    if (this.revealed < len || this.translated < len + FADE) {
      // the voice keeps step with the letters: each syllable sounds as the reveal reaches it
      const plan = this.voicePlan();
      this.translated = plan.foreign ? this.translated + dt * (plan.cps || REVEAL) : Infinity;
      this.revealed = Math.min(len, this.revealed + dt * (plan.cps || REVEAL));
      const S = plan.syllables;
      while (plan.next < S.length && S[plan.next].i < this.revealed) {
        const syl = S[plan.next++];
        if (this.sound?.syllable) this.sound.syllable(syl, { plan });
        else this.sound?.blip?.(syl.f0 / 170);
        this.say({ at: this.clock, dur: syl.dur, open: syllableOpen(syl), who: plan.player ? 'player' : 'npc' });
      }
      this.render();
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

  /** The traveller's answer while he says it ({ tone }), else null. */
  answering() { return this.answer && this.clock < this.answer.until ? this.answer : null; }

  /**
   * Who says what now, for their faces (src/talk-face.js): the person's line while it is revealed, the
   * traveller's pages and spoken answers. { npc: { speaking, tone, mouth }, player: { … } }
   */
  faces() {
    const r = this.runner, revealing = this.open && this.revealed < (r?.text.length ?? 0);
    const voiced = (this._plan?.syllables.length ?? 0) > 0 && !this._plan?.narrator;
    const ans = this.answering();
    const side = (who) => {
      const lines = this.open && r?.speaker === who && revealing;
      // (a line with no voice to follow, the mouth moves by itself: null)
      return { speaking: !!(lines || (who === 'player' && ans)), tone: who === 'player' && ans ? ans.tone : r?.tone ?? 'neutral', mouth: lines && !voiced ? null : this.mouth(who) };
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
   * CUT_GAP seconds.
   * @param o.sight         sightOf(physics), or null (no level geometry)
   * @param o.faceA/faceB   the faces (default: over the feet)
   * @param o.look          the thing looked at (no two-shot)
   * @param o.facing        which way the traveller faces (for a thing right overhead)
   */
  frameCamera(camera, player, npcPos, up = new THREE.Vector3(0, 1, 0), avoid = [], o = {}) {
    if (this.blend < 0.002 || !(npcPos || o.look)) { this._side = 0; this._shot = null; this._across = null; return; }
    const dt = Math.min(this._dt ?? 1 / 60, 0.1);
    this._shotT = (this._shotT ?? 0) - dt;
    const page = this.runner ? `${this.runner.nodeId}:${this.runner.page}` : '';
    const turned = page !== this._shotPage;
    if (turned) { this._shotPage = page; this._shotT = 0; }
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
      const pick = o.look
        ? pickLookShot({ ...args, head: o.faceA, target: o.look, facing: o.facing })
        : pickTwoShot({ ...args, b, faceA: o.faceA, faceB: o.faceB });
      const old = this._shot;
      // a new angle (another side, another kind of shot, or the eye somewhere else): a cut, not a swing
      const jump = !old || pick.kind !== old.kind || pick.side !== old.side || pick.eye.distanceTo(this._eye) > CUT_FAR;
      // (the old one blocked now: the candidate nearest it, as scored this time round)
      const stale = jump && old && pick.all?.find((c) => c.kind === old.kind && c.side === old.side && c.eye.distanceTo(old.eye) < 0.6)?.blocked;
      const cut = !old || (jump && (turned || stale || this.clock - (this._cutAt ?? -1e9) >= CUT_GAP));
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
