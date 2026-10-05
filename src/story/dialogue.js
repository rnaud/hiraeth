import * as THREE from 'three';
import { parseLine, stripTone } from './tone.js';
import { pickTwoShot, pickLookShot, pullIn } from './shot.js';
import { planLine, voiceOf, PLAYER_VOICE, LANGUAGES, REVEAL_CPS, isQuote } from './voice.js';
import { syllableOpen, syllableEnvelope } from '../talk-face.js';
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
//   · { quest, reached: stage } · (ctx) => bool
// Effects (a single one or a list): { set: { flag: value } } · { start: id } · { advance: id | [id, fromStage] }
//   · { stage: [id, stage] } · { give: item } · { take: item } · { keepsake: {...} } · { emit: [event, payload] }
//   · { track: id } · (ctx) => {}
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
    if (e.keepsake) { if (game.addKeepsake(e.keepsake)) ctx.onKeepsake?.(e.keepsake); }
    if (e.emit) game.emit(e.emit[0], e.emit[1]);
  }
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
    const entry = (t.entry ?? [{ node: Object.keys(t.nodes)[0] }]).find((e) => check(e.if, ctx));
    this.goto(entry?.node ?? Object.keys(t.nodes)[0]);
  }
  goto(id) {
    const n = this.person.talk.nodes[id];
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
    if (!this.lastPage || this.ended) return [];
    const list = (this.node.choices ?? []).map((c, index) => ({ ...c, index, text: stripTone(c.text), tone: parseLine(c.text).tone })).filter((c) => check(c.if, this.ctx) && !(c.once && this.ctx.game.flag(`said.${this.person.id}.${this.nodeId}.${c.index}`)));
    if (list.length) return list;
    if (this.node.next) return [];
    return [{ text: this.node.bye ?? '(leave)', end: true, index: -1 }];
  }
  /** Next page, or the node's `next`; false if it is waiting for a choice. */
  advance() {
    if (this.ended) return false;
    if (!this.lastPage) { this.page++; return true; }
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

const REVEAL = REVEAL_CPS;   // letters per second at an even pace (each line's voice and tone scale it)
const FRESH = 3;             // letters at the caret still in the alien script (the translator catching up)

/** A letter in a world's script (the same letter always the same glyph). */
function glyphOf(c, glyphs) {
  if (!glyphs || /\s/.test(c)) return c;
  if (/[^\p{L}\p{N}]/u.test(c)) return '';
  const G = [...glyphs];
  return G[(c.toLowerCase().codePointAt(0) * 7) % G.length];
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
    this.blend = 0;          // the two-shot camera's weight
    this.clock = 0;          // s, while open (the mouths' syllables are timed on it)
    this._mouth = [];        // syllables being said: { at, dur, open, who: 'npc' | 'player' }
    this.answer = null;      // the traveller's spoken answer: { tone, until }
    this.el = typeof document !== 'undefined' ? document.getElementById('dialogue') : null;
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
      window.addEventListener('keydown', (e) => {
        if (!this.open || e.repeat) return;
        if (e.code === 'Escape') { e.stopImmediatePropagation(); this.close(); return; }
        const n = Number(e.key);
        if (n >= 1 && n <= 9) { const c = this.runner.choices()[n - 1]; if (c) this.choose(c.index); return; }
        if (e.code === 'KeyE' || e.code === 'Space' || e.code === 'Enter') {
          if (performance.now() - this.openedAt < 250) return;   // the press that opened it
          e.preventDefault();
          // Enter / E on a focused choice picks it; otherwise finish the line, then turn the page
          const f = document.activeElement;
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
    this.runner = new DialogueRunner(person, ctx);
    if (this.runner.ended) return false;
    this.open = true;
    this.openedAt = typeof performance !== 'undefined' ? performance.now() : 0;
    this.revealed = 0;
    this._mouth.length = 0; this.answer = null;
    this.game.set(`met.${person.id}`, true);
    this.game.emit('dialogue:start', { npc, id: person.id });
    this.onOpen(person, npc);
    if (this.el) {
      this.q('.dlg-name').textContent = person.name;
      this.q('.dlg-title').textContent = person.title ?? '';
      const chip = this.q('.dlg-chip');
      chip.style.background = person.color ?? '#d8a24a';
      this.q('.dlg-chip span').textContent = person.name[0];
      const img = this.q('.dlg-chip img');
      img.hidden = true;
      // the portrait: a data URL, or { src, background } (just them against a flat colour: src/story/portrait-bg.js)
      try {
        const shot = this.portrait?.(person, npc), src = typeof shot === 'string' ? shot : shot?.src;
        if (src) { img.src = src; img.hidden = false; if (shot.background) chip.style.background = shot.background; }
      } catch { /* no sketch */ }
      this.el.classList.add('open');
      document.body.classList.add('talking');
      document.exitPointerLock?.();
      this.render();
    }
    return true;
  }

  next() {
    if (!this.open) return;
    if (this.revealed < this.runner.text.length) { this.revealed = this.runner.text.length; this.render(); return; }
    if (this.runner.advance()) { this.revealed = 0; this.render(); return; }
    if (this.runner.ended) this.close();
    else if (this.runner.choices().length === 1 && this.runner.choices()[0].end) this.close();
  }

  choose(i) {
    if (!this.open) return;
    if (this.revealed < this.runner.text.length) { this.revealed = this.runner.text.length; this.render(); return; }
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
    this.revealed = 0;
    this.render();
  }

  close() {
    if (!this.open) return;
    this.open = false;
    this.closedAt = typeof performance !== 'undefined' ? performance.now() : 0;
    this.el?.classList.remove('open');
    if (typeof document !== 'undefined') document.body.classList.remove('talking');
    this.game.emit('dialogue:end', { npc: this.npc, id: this.person.id });
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
    this._plan = Object.assign(plan, { key, next: 0, narrator, player, foreign: !LANGUAGES[lang]?.native && !(narrator && !plan.syllables.length) });
    return this._plan;
  }

  render() {
    if (!this.el) return;
    const r = this.runner, full = r.text;
    const plan = this.voicePlan();
    // reveal letter by letter, keeping the motifs whole; the last few letters at the caret
    // are still in the speaker's own script, resolving into the translation as you read
    const n = Math.floor(this.revealed), revealing = n < full.length;
    const glyphs = plan.foreign && revealing ? LANGUAGES[plan.lang]?.glyphs : '';
    const cut = glyphs ? Math.max(0, n - FRESH) : n;
    const shown = full.slice(0, cut);
    const fresh = glyphs ? [...full.slice(cut, n)].map((c) => glyphOf(c, glyphs)).join('') : '';
    this.q('.dlg-text').innerHTML = formatText(shown.replace(/\{\w*$/, '').replace(/\*([^*]*)$/, (m, w) => ((shown.match(/\*/g)?.length ?? 0) % 2 ? w : m)))   // hide only a star still waiting for its pair
      + (fresh ? `<span class="dlg-alien">${fresh.replace(/[&<>]/g, '')}</span>` : '') + (revealing ? '<span class="dlg-caret">▍</span>' : '');
    this.q('.dlg-text').classList.toggle('player', r.speaker === 'player');
    const done = this.revealed >= full.length;
    const choices = done ? r.choices() : [];
    const box = this.q('.dlg-choices');
    const html = choices.map((c, k) => `<button data-i="${c.index}"><span>${k + 1}</span>${formatText(c.text)}</button>`).join('');
    if (box.dataset.html !== html) {
      box.innerHTML = html; box.dataset.html = html;
      if (choices.length && document.body.classList.contains('controller')) box.querySelector('button')?.focus();
    }
    // a small mark at the panel's corner when the line is done and the next press turns the page
    this.el.classList.toggle('more', done && !choices.length);
  }

  /** Per frame: reveal text, voice blips, keep the speaker turned to you. */
  update(dt) {
    this._dt = dt;
    this.clock += dt;   // (on after closing too: the traveller's last answer is still being said)
    const target = this.open ? 1 : 0;
    this.blend += (target - this.blend) * (1 - Math.exp(-(this.open ? 3.2 : 4.5) * dt));
    if (!this.open) return;
    this.sound?.holdFloor?.();   // nobody else mumbles over a conversation
    const len = this.runner.text.length;
    if (this.revealed < len) {
      // the voice keeps step with the letters: each syllable sounds as the reveal reaches it
      const plan = this.voicePlan();
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
   * looked at again every so often (people walk into it) and eased over.
   * @param o.sight         sightOf(physics), or null (no level geometry)
   * @param o.faceA/faceB   the faces (default: over the feet)
   * @param o.look          the thing looked at (no two-shot)
   * @param o.facing        which way the traveller faces (for a thing right overhead)
   */
  frameCamera(camera, player, npcPos, up = new THREE.Vector3(0, 1, 0), avoid = [], o = {}) {
    if (this.blend < 0.002 || !(npcPos || o.look)) { this._side = 0; this._shot = null; this._across = null; return; }
    const dt = Math.min(this._dt ?? 1 / 60, 0.1);
    this._shotT = (this._shotT ?? 0) - dt;
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
      if (!this._shot) { this._eye.copy(pick.eye); this._look.copy(pick.look); }
      this._shot = pick;
      this._side = pick.side;
      this._shotT = 0.6;
    }
    // eased toward the pick (it moves when people move), and never through a wall on the way
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
