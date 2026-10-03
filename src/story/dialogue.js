import * as THREE from 'three';

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
// Text: {glyph} is the recurring three-dots-over-an-arc mark, *words* are emphasised.
// A node without choices ends with "(leave)"; `next: id` continues with another node.

export const MOTIFS = {
  glyph: { plain: '⁖⌒', html: '<svg class="glyph" viewBox="0 0 24 16" aria-label="the glyph: three dots over an arc"><circle cx="5" cy="4" r="2"/><circle cx="12" cy="2.6" r="2"/><circle cx="19" cy="4" r="2"/><path d="M2 14 Q12 6 22 14" fill="none" stroke-width="2"/></svg>' },
};

/** Expand motifs and emphasis for display (html) or for tests and toasts (plain). */
export function formatText(text, html = true) {
  let s = String(text ?? '');
  if (html) s = s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  s = s.replace(/\{(\w+)\}/g, (m, k) => MOTIFS[k] ? (html ? MOTIFS[k].html : MOTIFS[k].plain) : m);
  s = s.replace(/\*([^*]+)\*/g, (m, w) => html ? `<em>${w}</em>` : w);
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
    this.pages = (Array.isArray(n.say) ? n.say : [n.say ?? '']).filter((s) => check(typeof s === 'object' && s?.if ? s.if : null, this.ctx)).map((s) => (typeof s === 'object' ? s.text : s));
    this.page = 0;
    apply(n.do, this.ctx);
    this.ctx.onNode?.(id, n);
  }
  get text() { return this.pages[this.page] ?? ''; }
  get speaker() { return this.node.speaker === 'player' ? 'player' : 'npc'; }
  get lastPage() { return this.page >= this.pages.length - 1; }
  /** The choices to show now (only on the last page): [{ text, index }]. Always at least "(leave)" when the node ends. */
  choices() {
    if (!this.lastPage || this.ended) return [];
    const list = (this.node.choices ?? []).map((c, index) => ({ ...c, index })).filter((c) => check(c.if, this.ctx) && !(c.once && this.ctx.game.flag(`said.${this.person.id}.${this.nodeId}.${c.index}`)));
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

const REVEAL = 48;   // letters per second

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
    this.el = typeof document !== 'undefined' ? document.getElementById('dialogue') : null;
    this._eye = new THREE.Vector3(); this._look = new THREE.Vector3(); this._q = new THREE.Quaternion();
    this._m = new THREE.Matrix4();
    if (this.el) {
      this.el.innerHTML = `<div class="dlg-panel"><div class="dlg-who"><div class="dlg-chip"><img alt=""><span></span></div><div><b class="dlg-name"></b><i class="dlg-title"></i></div></div>
        <p class="dlg-text"></p><div class="dlg-choices"></div><div class="dlg-hint"></div></div>`;
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

  /** Talk to `person` (data) embodied by `npc` (an NPC, or a crowd person's puppet). */
  start(person, npc = null, at = null) {
    if (this.open) return false;
    this.person = person; this.npc = npc; this.at = at;
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
      try { const src = this.portrait?.(person, npc); if (src) { img.src = src; img.hidden = false; } } catch { /* no sketch */ }
      this.el.classList.add('open');
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
    this.runner.choose(i);
    this.sound?.toolClick?.(true);
    if (this.runner.ended) { this.close(); return; }
    this.revealed = 0;
    this.render();
  }

  close() {
    if (!this.open) return;
    this.open = false;
    this.closedAt = typeof performance !== 'undefined' ? performance.now() : 0;
    this.el?.classList.remove('open');
    this.game.emit('dialogue:end', { npc: this.npc, id: this.person.id });
    this.onClose(this.person, this.npc);
  }

  render() {
    if (!this.el) return;
    const r = this.runner, full = r.text;
    // reveal letter by letter, keeping the motifs whole
    const shown = full.slice(0, Math.floor(this.revealed));
    this.q('.dlg-text').innerHTML = formatText(shown.replace(/\{\w*$/, '').replace(/\*([^*]*)$/, '$1')) + (this.revealed < full.length ? '<span class="dlg-caret">▍</span>' : '');
    this.q('.dlg-text').classList.toggle('player', r.speaker === 'player');
    const done = this.revealed >= full.length;
    const choices = done ? r.choices() : [];
    const box = this.q('.dlg-choices');
    const html = choices.map((c, k) => `<button data-i="${c.index}"><span>${k + 1}</span>${formatText(c.text)}</button>`).join('');
    if (box.dataset.html !== html) {
      box.innerHTML = html; box.dataset.html = html;
      if (choices.length && document.body.classList.contains('controller')) box.querySelector('button')?.focus();
    }
    this.q('.dlg-hint').textContent = !done ? 'E / click: skip' : choices.length ? '1–4 or click to answer · Esc leave' : 'E / click: continue · Esc leave';
  }

  /** Per frame: reveal text, voice blips, keep the speaker turned to you. */
  update(dt) {
    const target = this.open ? 1 : 0;
    this.blend += (target - this.blend) * (1 - Math.exp(-(this.open ? 3.2 : 4.5) * dt));
    if (!this.open) return;
    const len = this.runner.text.length;
    if (this.revealed < len) {
      const before = Math.floor(this.revealed);
      this.revealed = Math.min(len, this.revealed + dt * REVEAL);
      const now = Math.floor(this.revealed);
      if (now !== before && now % 3 === 0 && /\w/.test(this.runner.text[now] ?? '')) this.sound?.voice?.(this.runner.speaker === 'player' ? 1.5 : (this.person.voice ?? 1));
      this.render();
    }
  }

  /**
   * The two-shot: both faces in frame, the camera off to the side of the
   * line between them, a little behind the traveller's shoulder. Blended
   * over the follow camera by `blend`.
   */
  frameCamera(camera, player, npcPos, up = new THREE.Vector3(0, 1, 0)) {
    if (this.blend < 0.002 || !npcPos) return;
    const a = player.pos, b = npcPos;
    const mid = this._look.copy(a).lerp(b, 0.5).addScaledVector(up, 1.5);
    const across = new THREE.Vector3().subVectors(b, a); across.addScaledVector(up, -across.dot(up));
    const sep = Math.max(across.length(), 0.8);
    across.normalize();
    const side = new THREE.Vector3().crossVectors(up, across).normalize();
    // keep the side the camera is already on, so the cut is short
    if (side.dot(new THREE.Vector3().subVectors(camera.position, mid)) < 0) side.negate();
    const dist = 2.6 + sep * 1.15;
    const eye = this._eye.copy(mid).addScaledVector(side, dist).addScaledVector(across, -sep * 0.35).addScaledVector(up, 0.25);
    const k = THREE.MathUtils.smoothstep(this.blend, 0, 1);
    camera.position.lerp(eye, k);
    this._m.lookAt(camera.position, mid.addScaledVector(across, 0.08 * sep), up);
    this._q.setFromRotationMatrix(this._m);
    camera.quaternion.slerp(this._q, k);
    camera.updateMatrixWorld();
  }
}
