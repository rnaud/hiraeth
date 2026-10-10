import * as THREE from 'three';
import { questGoal } from './quest-goals.js';
import { hintsFor } from '../hint-level.js';

// Quests: ids, stages, objective text and a place in the world. Progress is
// kept in the shared game state (game-state.js), so it survives reloads and
// other systems can read it:  game.flag('quest.desert.power') → 'cave'.
//
//   quests.define({
//     id: 'desert.power', title: 'Power for the ship', world: 'desert', main: true,
//     stages: [
//       { id: 'camps', text: 'Follow the smoke to the camps', goto: [x, y, z], radius: 25 },
//       { id: 'ama', text: 'Talk to Ama by the fires', talk: 'ama' },          // advanced by a dialogue choice
//       { id: 'jar', text: 'Bring the drum to Teo', bring: 'drum', to: 'teo', at: 'drum' },
//       { id: 'bone', text: 'Clear the channel', flag: 'desert.bone.cleared' }, // set by another system
//     ],
//     onStage(stage, quests) {},   // optional
//     onDone(quests) {},
//   });
//   quests.start('desert.power')            // → first stage
//   quests.advance('desert.power')          // → next stage (or 'done' after the last)
//   quests.set('desert.power', 'cave')      // jump to a stage
//   quests.stage(id) / isActive(id) / isDone(id)
//   quests.give('drum') / has('drum') / take('drum')   // items (flags item.<id>)
//   quests.fail('edena.terraces')           // → 'failed': it ended, and it went wrong (no retry)
//   quests.locate('teo', () => npc.pos)     // named places for markers and 'talk' objectives
//   quests.objective(player) → { id, label, position } of the tracked quest, for the scout
//
// Objective kinds (one per stage):
//   goto  [x,y,z] | Vector3 | () => Vector3 | locator name, with radius: advances on arrival
//   talk  npc id: the marker sits on them; the conversation advances it
//   bring item, to npc: the marker is on the item (at) until you have it, then on `to`
//   flag  name (+ value, default true): advances when the flag is set, by anyone
// `at` overrides where the marker stands for any kind. A stage with
// `optional: true` is not shown as the tracked objective. A quest with `background: true` (it
// starts on its own: the makers' boxes) is only tracked when nothing else is, or when chosen.
// One with `arrival: true` (a temple's, started on arrival) gives the scout to the world's opening
// conversation while that waits (opensWith, below).
//
// Events (game.emit): 'quest' { id, stage, prev }. Flags: quest.<id> = stage
// id, 'done' or 'failed'; quest.tracked = the id the scout finds (Q, R3) and the quest log marks;
// failed.<id> = the title of a quest that failed (the father's charge lists them,
// src/story/charge.js, whatever world you are in).
//
// A world's opening quest doesn't just appear on arrival (players: "I should talk to someone who
// gives me a hint"): quests.opensWith(id, ['ama', 'nour']) holds it back until you talk to one of
// them. Until then the scout finds the first of them (the first stage's label); the conversation
// starts it just before they speak (Dialogue.start asks quests.opening(person.id)), so what they say
// is said with the quest under way; its "Quest:" toast waits for the end of that talk (quests.opened())
// or for the stage the talk moves it on to.
//
// A failed quest has ended like a finished one (not active, never tracked), but it
// went wrong: the journal files it under its own heading with a ✗ stamp and its
// `failOutro`; `onFail` runs instead of `onDone`. It can't be retried.

const DONE = 'done';
/** How long the objective marker stays after the scout has found the objective (s). */
export const MARKER_SECONDS = 30;
export const FAILED = 'failed';

export class Quests {
  constructor({ game, toast = () => {}, sound = null } = {}) {
    this.game = game;
    this.toast = toast;
    this.sound = sound;
    this.defs = new Map();
    this.locators = new Map();
    this.listeners = new Set();
    this._v = new THREE.Vector3();
    this.opener = null;   // { id, who: [person ids], label, at }: the opening quest, waiting for a conversation
    this._quiet = null;   // the quest a conversation just started: its toast waits (opened())
  }

  define(def) {
    def.stages = def.stages.map((s) => ({ ...s }));
    this.defs.set(def.id, def);
    return def;
  }
  def(id) { return this.defs.get(id); }

  // ------------------------------------------------------------ state
  stage(id) { return this.game.flag(`quest.${id}`); }
  isStarted(id) { return this.stage(id) !== undefined; }
  isDone(id) { return this.stage(id) === DONE; }
  isFailed(id) { return this.stage(id) === FAILED; }
  /** Over, one way or the other. */
  isEnded(id) { const s = this.stage(id); return s === DONE || s === FAILED; }
  isActive(id) { const s = this.stage(id); return s !== undefined && s !== DONE && s !== FAILED; }
  /** True if the quest has reached `stage` (or finished): stage order is the definition's. */
  reached(id, stage) {
    const d = this.def(id), s = this.stage(id);
    if (!d || s === undefined) return false;
    if (s === DONE || s === FAILED) return true;
    const i = d.stages.findIndex((x) => x.id === s), j = d.stages.findIndex((x) => x.id === stage);
    return i >= 0 && j >= 0 && i >= j;
  }
  current(id) { const d = this.def(id), s = this.stage(id); return d?.stages.find((x) => x.id === s) ?? null; }

  start(id, stage = null) {
    const d = this.def(id);
    if (!d) throw new Error(`no quest ${id}`);
    if (this.isStarted(id) && !stage) return false;
    return this.set(id, stage ?? d.stages[0].id);
  }

  /** Move to the next stage; `from` guards against double advances (only if still at that stage). */
  advance(id, from = null) {
    const d = this.def(id), s = this.stage(id);
    if (!d || s === undefined || s === DONE) return false;
    if (from && s !== from) return false;
    const i = d.stages.findIndex((x) => x.id === s);
    return this.set(id, i + 1 < d.stages.length ? d.stages[i + 1].id : DONE);
  }

  complete(id) { return this.set(id, DONE); }
  fail(id) { return this.set(id, FAILED); }

  set(id, stage) {
    const d = this.def(id);
    if (!d) throw new Error(`no quest ${id}`);
    const end = stage === DONE || stage === FAILED;
    if (!end && !d.stages.some((x) => x.id === stage)) throw new Error(`quest ${id} has no stage ${stage}`);
    const prev = this.stage(id);
    if (prev === stage) return false;
    if (prev === FAILED) return false;   // (a failed quest stays failed)
    this.game.set(`quest.${id}`, stage);
    // the quest that moved is the one you are on: tracked (what the scout finds, Q / R3), except
    // that one that starts on its own (`background`: a makers' box offered on arrival) doesn't take
    // that from the quest you are on; choosing it in the quest log does
    if (!end && !(d.background && this.tracked())) this.track(id);
    else if (this.game.flag('quest.tracked') === id) this.game.set('quest.tracked', this.active().find((q) => q.main)?.id ?? this.active()[0]?.id ?? null);
    // the conversation that opens a quest starts it quietly (its toast waits for the talk's end, opened());
    // a stage it moves on to during that talk is said as the quest's first word
    const opening = this._quiet === id;
    if (opening) this._quiet = prev === undefined && !end ? id : null;
    const st = d.stages.find((x) => x.id === stage);
    if (opening && prev === undefined && !end) { /* (said at the talk's end) */ }
    else {
      if (stage === DONE) { this.toast(`${d.main ? 'Completed' : 'Done'}: ${d.title}`); d.onDone?.(this); }
      else if (stage === FAILED) { this.game.set(`failed.${id}`, d.title); this.toast(`What happened: ${d.title}`); d.onFail?.(this); }
      else if (prev === undefined || opening) this.startToast(d, st);
      else if (hintsFor('objective')) this.toast(`${d.title}: ${st.text}`);   // (the next step pushed onto the screen: hints full; else its chime, and the quest log has it)
      if (stage === FAILED) this.sound?.fail?.(); else this.sound?.chime?.();
    }
    st?.onEnter?.(this);
    d.onStage?.(stage, this, prev);
    this.game.emit('quest', { id, stage, prev });
    for (const f of this.listeners) f({ id, stage, prev });
    return true;
  }
  onChange(f) { this.listeners.add(f); return () => this.listeners.delete(f); }
  /**
   * A quest begins: its toast in its own look (kind 'quest': src/ship/cinema.js questToastHtml), not as the other notices.
   * Its first step under the title with hints full (src/hint-level.js 'objective'); else the title alone, the quest log has the step.
   */
  startToast(d, st) {
    const big = d.main || d.major, step = hintsFor('objective') ? st?.text ?? '' : '';
    this.toast(`${big ? 'Quest' : 'New errand'}: ${d.title}${step ? ` · ${step}` : ''}`, { kind: 'quest', head: big ? 'New quest' : 'New errand', title: d.title, step });
  }

  // (only a quest of this world: one tracked in another, still under way there, has no marker here and
  // would hide this world's own objective, the opening conversation too)
  tracked() { const t = this.game.flag('quest.tracked'); return t && this.def(t) && this.isActive(t) ? t : null; }
  track(id) { if (this.isActive(id)) this.game.set('quest.tracked', id); }
  /** The player chose it in the quest log (it is what the scout finds, even over a world's opening conversation). */
  choose(id) { this.track(id); if (this.isActive(id)) this._chosen = id; }

  active() { return [...this.defs.values()].filter((d) => this.isActive(d.id)); }
  finished() { return [...this.defs.values()].filter((d) => this.isDone(d.id)); }
  failed() { return [...this.defs.values()].filter((d) => this.isFailed(d.id)); }

  // ------------------------------------------------------------ items
  itemName(item) { return this.itemNames?.[item] ?? item; }
  has(item) { return (this.game.flag(`item.${item}`) ?? 0) > 0; }
  give(item, n = 1) { this.game.set(`item.${item}`, (this.game.flag(`item.${item}`) ?? 0) + n); this.game.emit('item', { item, n }); return true; }
  take(item) { if (!this.has(item)) return false; this.game.set(`item.${item}`, this.game.flag(`item.${item}`) - 1); this.game.emit('item', { item, n: -1 }); return true; }
  /** What you carry for the quests (this world's named items you hold): their names, for the gear page. */
  carried() { return Object.keys(this.itemNames ?? {}).filter((k) => this.has(k)).map((k) => this.itemName(k)); }

  // ------------------------------------------------------------ places
  locate(name, fn) { this.locators.set(name, fn); return () => this.locators.delete(name); }
  resolve(at) {
    if (at == null) return null;
    if (typeof at === 'string') { const f = this.locators.get(at); return f ? this.resolve(f()) : null; }
    if (typeof at === 'function') return this.resolve(at());
    if (at.isVector3) return at;
    if (Array.isArray(at)) return this._v.set(at[0], at[1], at[2]);
    return null;
  }
  /** Where the stage's marker stands (a fresh Vector3), or null. */
  where(stage) {
    if (!stage) return null;
    let at = stage.at;
    if (stage.bring && !stage.at) at = stage.to;
    else if (stage.bring && this.has(stage.bring)) at = stage.to;
    at ??= stage.goto ?? stage.talk ?? null;
    const p = this.resolve(at);
    return p ? p.clone() : null;
  }

  // ------------------------------------------------------------ the opening conversation
  /**
   * The world's opening quest `id` waits for a conversation with one of `who` (person ids, the
   * first the one the scout finds): `label` for the scout (default: the first stage's), `at` a
   * place or locator for it (default: the first of `who`).
   */
  opensWith(id, who, { label = null, at = null } = {}) {
    this.opener = { id, who: [].concat(who), label, at };
    return this.opener;
  }
  /** The opening quest still waiting for its conversation (or null). */
  pendingOpener() {
    const o = this.opener;
    return o && this.def(o.id) && !this.isStarted(o.id) ? o : null;
  }
  /** A conversation with `personId` begins (before they speak): it starts the opening quest if they are one who opens it. */
  opening(personId) {
    const o = this.pendingOpener();
    if (!o || !o.who.includes(personId)) return false;
    this._quiet = o.id;
    this.start(o.id);
    return true;
  }
  /** The conversation is over: the quest it started says so now (unless a stage it moved to said it already). */
  opened() {
    const id = this._quiet;
    this._quiet = null;
    if (!id || !this.isActive(id)) return false;
    const d = this.def(id), st = this.current(id);
    this.startToast(d, st);
    this.sound?.chime?.();
    return true;
  }
  /** Who the scout finds while the opening quest waits: { id, quest, label, position } or null. */
  openerObjective() {
    const o = this.pendingOpener();
    if (!o) return null;
    const p = this.resolve(o.at ?? o.who[0]);
    if (!p) return null;
    const st = this.def(o.id).stages[0];
    return { id: `opener-${o.id}`, quest: o.id, label: o.label ?? st.label ?? st.text, position: p.clone() };
  }

  /** The tracked quest's objective for the scout and the marker: { id, label, position } or null. */
  objective() {
    const id = this.tracked() ?? this.active().find((q) => q.main)?.id ?? this.active()[0]?.id;
    // the opening quest still waits for its conversation: the one to talk to comes first, before a quest
    // that started on its own on arrival (a box's, `background`; a temple's, `arrival`), unless you chose
    // that one in the quest log (an errand someone gave you keeps the scout)
    const self = this.def(id)?.background || this.def(id)?.arrival;
    if (this.pendingOpener() && (!id || (self && id !== this._chosen))) { const o = this.openerObjective(); if (o) return o; }
    if (!id) return null;
    const st = this.current(id);
    const position = this.where(st);
    return position ? { id: `quest-${id}-${st.id}`, quest: id, label: st.label ?? st.text, position } : null;
  }

  /** Arrivals and flags: advance any stage whose condition is met. */
  update(player) {
    for (const d of this.defs.values()) {
      const st = this.current(d.id);
      if (!st) continue;
      if (st.goto !== undefined && player) {
        const p = this.resolve(st.goto);
        if (p) {
          const r = st.radius ?? 12;
          if (Math.hypot(player.pos.x - p.x, player.pos.z - p.z) < r && Math.abs(player.pos.y - p.y) < (st.vertical ?? Math.max(r, 12))) this.advance(d.id, st.id);
        }
      } else if (st.flag) {
        const want = st.value ?? true;
        if (this.game.flag(st.flag) === want) this.advance(d.id, st.id);
      } else if (st.when?.(this)) this.advance(d.id, st.id);
    }
  }

  /** "◆ label · 120 m" for the HUD line. */
  hud(player) {
    const o = this.objective();
    if (!o) return null;
    const d = player ? player.pos.distanceTo(o.position) : 0;
    return `◆ ${o.label} · ${d < 1000 ? Math.round(d) + ' m' : (d / 1000).toFixed(1) + ' km'}`;
  }

  /** The quest's overall goal, in a few words (src/story/quest-goals.js; the title if it has none). */
  goal(id) { return questGoal(this.def(id)); }

  /**
   * What the Quests panel and the scout's find show (docs/systems/ui.md, "The game menu"): for each
   * active quest only its overall goal and its next step, never the steps already done; the quests
   * that ended, by title only (the newest first), for a short list.
   *   → { active: [{ id, title, goal, step, label, main, tracked }], done: [{ id, title, outro }], failed: [{ id, title, outro }] }
   */
  summary(world = null) {
    const list = [...this.defs.values()].filter((d) => (!world || d.world === world) && this.isStarted(d.id));
    const tracked = this.tracked() ?? this.objective()?.quest ?? null;
    const now = (d) => { const st = this.current(d.id); return { id: d.id, title: d.title, goal: this.goal(d.id), step: st?.text ?? '', label: st?.label ?? st?.text ?? '', main: !!(d.main || d.major), tracked: d.id === tracked }; };
    // the one you are on first, then the main quests, then the rest in the order they were given
    const active = list.filter((d) => this.isActive(d.id)).map(now).sort((a, b) => (b.tracked - a.tracked) || (b.main - a.main));
    const ended = (d, outro) => ({ id: d.id, title: d.title, outro });
    return {
      active,
      done: list.filter((d) => this.isDone(d.id)).map((d) => ended(d, d.outro ?? 'Done.')).reverse(),
      failed: list.filter((d) => this.isFailed(d.id)).map((d) => ended(d, d.failOutro ?? 'It went wrong.')).reverse(),
    };
  }

  /**
   * The quests as HTML (the Quests panel's text, and a plain list where there is no panel): each active
   * quest's goal and next step, then the finished and failed ones by title, a short list.
   */
  journalHtml(world = null) {
    const { active, done, failed } = this.summary(world);
    if (!active.length && !done.length && !failed.length) return '';
    const mark = (q) => (q.main ? '◆ ' : '◇ ');
    const card = (q) => `<div class="quest${q.tracked ? ' tracked' : ''}" data-quest="${q.id}">
        <h3>${mark(q)}${q.title}${q.tracked ? ' <span>tracked</span>' : ''}</h3>
        <p class="goal">${q.goal}</p><p class="now">${q.step}</p></div>`;
    const short = (list, cls, stamp) => list.slice(0, ENDED_SHOWN).map((q) => `<li class="quest finished${cls}" data-quest="${q.id}">${q.title}<b class="stamp${cls}">${stamp}</b></li>`).join('')
      + (list.length > ENDED_SHOWN ? `<li class="more">and ${list.length - ENDED_SHOWN} more</li>` : '');
    return `<section class="quests"><h2>Quests <span>${done.length}/${active.length + done.length + failed.length} complete</span></h2>${active.map(card).join('')}`
      + (done.length ? `<h4 class="qgroup">Completed</h4><ul class="ended">${short(done, '', '✓ Complete')}</ul>` : '')
      + (failed.length ? `<h4 class="qgroup failed">What happened</h4><ul class="ended">${short(failed, ' failed', '· What happened')}</ul>` : '')
      + '</section>';
  }
}

/** How many finished (or failed) quests the short list names. */
export const ENDED_SHOWN = 6;

/**
 * The objective marker: a slowly turning diamond over the target, a thin beam below it. Fluid-cyan,
 * unlike the gold story beacon. Not always there: it shows for a while after the scout has found
 * the objective (reveal(seconds): src/scout.js, main.js), then fades; nothing hangs in the air otherwise.
 */
export class QuestMarker {
  constructor(scene, makeMaterial) {
    this.group = new THREE.Group();
    this.group.userData.noCollide = true;
    const glow = makeMaterial({ color: '#70e7df', glow: 1, flat: true });
    this.gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.7, 0).scale(0.75, 1.3, 0.75), glow);
    this.ring = new THREE.Mesh(new THREE.TorusGeometry(1.1, 0.06, 5, 28), makeMaterial({ color: '#fff6dc', glow: 1 }));
    this.beam = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1, 6, 1, true).translate(0, -0.5, 0), makeMaterial({ color: '#70e7df', glow: 1, side: THREE.DoubleSide }));
    for (const m of [this.gem, this.ring, this.beam]) m.userData.noCollide = true;
    this.group.add(this.gem, this.ring, this.beam);
    this.group.visible = false;
    scene.add(this.group);
    this.k = 0;
    this.shown = 0;   // s left to show (reveal)
  }
  /** Show it for `secs` (the scout found the objective). */
  reveal(secs = MARKER_SECONDS) { this.shown = Math.max(this.shown, secs); }
  update(dt, t, objective, player, camera, hidden = false) {
    this.shown = Math.max(0, this.shown - dt);
    const on = !!objective && !hidden && this.shown > 0;
    this.k += ((on ? 1 : 0) - this.k) * (1 - Math.exp(-4 * dt));
    this.group.visible = this.k > 0.02 && !!objective;
    if (!objective) return;
    const p = objective.position;
    const d = camera ? camera.position.distanceTo(p) : 50;
    // big enough to find from afar, small up close; hidden when you're on top of it
    const s = THREE.MathUtils.clamp(d * 0.018, 0.6, 9) * this.k * THREE.MathUtils.smoothstep(Math.hypot(player.pos.x - p.x, player.pos.z - p.z), 3, 9);
    const lift = 3.2 + s * 1.6;
    this.group.position.set(p.x, p.y + lift + Math.sin(t * 2) * 0.15 * s, p.z);
    this.gem.scale.setScalar(Math.max(s, 1e-3));
    this.ring.scale.setScalar(Math.max(s, 1e-3));
    this.gem.rotation.y = t * 1.4;
    this.ring.rotation.set(Math.PI / 2 + Math.sin(t * 0.8) * 0.3, 0, t * 0.5);
    this.beam.scale.set(Math.max(s * 0.6, 1e-3), Math.max(lift - 0.5, 0.1), Math.max(s * 0.6, 1e-3));
  }
}
