import * as THREE from 'three';

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
//   quests.locate('teo', () => npc.pos)     // named places for markers and 'talk' objectives
//   quests.objective(player) → { id, label, position } of the tracked quest, for the scout
//
// Objective kinds (one per stage):
//   goto  [x,y,z] | Vector3 | () => Vector3 | locator name, with radius: advances on arrival
//   talk  npc id: the marker sits on them; the conversation advances it
//   bring item, to npc: the marker is on the item (at) until you have it, then on `to`
//   flag  name (+ value, default true): advances when the flag is set, by anyone
// `at` overrides where the marker stands for any kind. A stage with
// `optional: true` is not shown as the tracked objective.
//
// Events (game.emit): 'quest' { id, stage, prev }. Flags: quest.<id> = stage
// id or 'done'; quest.tracked = the id shown on the HUD and pinged by Q.

const DONE = 'done';

export class Quests {
  constructor({ game, toast = () => {}, sound = null } = {}) {
    this.game = game;
    this.toast = toast;
    this.sound = sound;
    this.defs = new Map();
    this.locators = new Map();
    this.listeners = new Set();
    this._v = new THREE.Vector3();
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
  isActive(id) { const s = this.stage(id); return s !== undefined && s !== DONE; }
  /** True if the quest has reached `stage` (or finished): stage order is the definition's. */
  reached(id, stage) {
    const d = this.def(id), s = this.stage(id);
    if (!d || s === undefined) return false;
    if (s === DONE) return true;
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

  set(id, stage) {
    const d = this.def(id);
    if (!d) throw new Error(`no quest ${id}`);
    if (stage !== DONE && !d.stages.some((x) => x.id === stage)) throw new Error(`quest ${id} has no stage ${stage}`);
    const prev = this.stage(id);
    if (prev === stage) return false;
    this.game.set(`quest.${id}`, stage);
    if (stage !== DONE) this.track(id);
    else if (this.tracked() === id) this.game.set('quest.tracked', this.active().find((q) => q.main)?.id ?? this.active()[0]?.id ?? null);
    const st = d.stages.find((x) => x.id === stage);
    if (stage === DONE) { this.toast(`${d.main ? 'Completed' : 'Done'}: ${d.title}`); d.onDone?.(this); }
    else if (prev === undefined) this.toast(`${d.main ? 'Quest' : 'New errand'}: ${d.title} · ${st.text}`);
    else this.toast(`${d.title}: ${st.text}`);
    this.sound?.chime?.();
    st?.onEnter?.(this);
    d.onStage?.(stage, this, prev);
    this.game.emit('quest', { id, stage, prev });
    for (const f of this.listeners) f({ id, stage, prev });
    return true;
  }
  onChange(f) { this.listeners.add(f); return () => this.listeners.delete(f); }

  tracked() { const t = this.game.flag('quest.tracked'); return t && this.isActive(t) ? t : null; }
  track(id) { if (this.isActive(id)) this.game.set('quest.tracked', id); }

  active() { return [...this.defs.values()].filter((d) => this.isActive(d.id)); }
  finished() { return [...this.defs.values()].filter((d) => this.isDone(d.id)); }

  // ------------------------------------------------------------ items
  itemName(item) { return this.itemNames?.[item] ?? item; }
  has(item) { return (this.game.flag(`item.${item}`) ?? 0) > 0; }
  give(item, n = 1) { this.game.set(`item.${item}`, (this.game.flag(`item.${item}`) ?? 0) + n); this.game.emit('item', { item, n }); return true; }
  take(item) { if (!this.has(item)) return false; this.game.set(`item.${item}`, this.game.flag(`item.${item}`) - 1); this.game.emit('item', { item, n: -1 }); return true; }

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

  /** The tracked quest's objective for the scout and the marker: { id, label, position } or null. */
  objective() {
    const id = this.tracked() ?? this.active().find((q) => q.main)?.id ?? this.active()[0]?.id;
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

  /** A journal section: active then finished quests, the current step under each. */
  journalHtml(world = null) {
    const list = [...this.defs.values()].filter((d) => (!world || d.world === world) && this.isStarted(d.id));
    if (!list.length) return '';
    const tracked = this.tracked();
    const act = list.filter((d) => this.isActive(d.id)), fin = list.filter((d) => this.isDone(d.id));
    const row = (d) => {
      const done = this.isDone(d.id), st = this.current(d.id);
      const steps = d.stages.filter((s) => this.reached(d.id, s.id) && s !== st && !s.secret).map((s) => `<li class="done">${s.text}</li>`).join('');
      // finished: a stamp, and only how it ended (its steps are history)
      if (done) return `<div class="quest finished" data-quest="${d.id}">
        <h3>${d.main ? '◆ ' : '◇ '}${d.title}<b class="stamp">✓ Complete</b></h3>
        <ul><li class="outro">${d.outro ?? 'Done.'}</li></ul></div>`;
      return `<div class="quest${d.id === tracked ? ' tracked' : ''}" data-quest="${d.id}">
        <h3>${d.main ? '◆ ' : '◇ '}${d.title}${d.id === tracked ? ' <span>tracked</span>' : ''}</h3>
        <ul>${steps}<li class="now">${st?.text ?? ''}</li></ul></div>`;
    };
    return `<section class="quests"><h2>Quests <span>${fin.length}/${list.length} complete</span></h2>${act.map(row).join('')}`
      + (fin.length ? `<h4 class="qgroup">Completed</h4>${fin.map(row).join('')}` : '')
      + `<p class="qhint">choose a quest to track it</p></section>`;
  }
}

/** The objective marker: a slowly turning diamond over the target, a thin beam below it. Fluid-cyan, unlike the gold story beacon. */
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
  }
  update(dt, t, objective, player, camera, hidden = false) {
    const on = !!objective && !hidden;
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
