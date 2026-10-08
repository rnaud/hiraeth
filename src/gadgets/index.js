import * as THREE from 'three';
import { GADGETS, nextGadget, wheelSlot } from './registry.js';
import { items as sharedItems } from '../items.js';
import { game as sharedGame } from '../game-state.js';
import { GadgetWorld } from './world.js';
import { GadgetHud } from './hud.js';
import { InkBursts, inkMat } from './kit.js';
import { sfx } from './sfx.js';

// The gadgets' runtime (docs/systems/gadgets.md): one per world, made in main.js after the foes. It holds
// an instance of every registered gadget (src/gadgets/registry.js), the one in hand (the flag
// `gadget.equipped`), the use button and the choosing, the camera's aim while a gadget aims, the chip, the
// reticle and the wheel (src/gadgets/hud.js), and the world's loose things and cracked walls (world.js).
//
// The buttons (gadgetInput):
//   use    Y / △ (the pad's top button), T, the middle mouse button, touch ◆: pressed, held, let go
//          (with nothing in hand Y / △ is the scout's ping, as before: claims('ping'))
//   choose D-pad ↑ or B: a tap takes the next one (Shift + B the one before; nothing in hand is one stop
//          of the round), held a moment it opens the wheel: point the left stick (WASD) at one, let go
//          (the D-pad's ↑ is the bell-note whistle only while no gadget is owned: claims('bell'))
//
//   const gadgets = new Gadgets({ scene, physics, player, camera, rig, sound, tool, level, foes, input, notice })
//   gadgets.control(dt, ctl, paused)   before the traveller moves (a reel sets his velocity)
//   gadgets.update(dt, paused)         after the fluid tool (the aim's camera and pose are set last)
//   gadgets.equip(id | null) · gadgets.cycle(±1) · gadgets.equipped · gadgets.owned() · gadgets.claims(action)

/** How long the choose button is held before the wheel opens (s). */
export const WHEEL_HOLD = 0.32;
export const EQUIPPED_FLAG = 'gadget.equipped';

/** The gadget buttons from the merged input (keyboard, mouse, pad, touch). */
export function gadgetInput(c = {}) {
  return {
    use: !!(c.KeyT || c.MouseMiddle || c.PadGadget || c.TouchGadget),
    pick: !!(c.KeyB || c.PadGadgetPick),
    back: !!(c.ShiftLeft || c.ShiftRight) && !!c.KeyB,
  };
}

const _v = new THREE.Vector3();
const smooth = (k) => k * k * (3 - 2 * k);

export class Gadgets {
  constructor({ defs = GADGETS, scene = null, physics = null, player = null, camera = null, rig = null, sound = null, tool = null, level = null, foes = null, input = null, notice = null, touch = false, items = sharedItems, game = sharedGame, icon = null, drawIcon = null, relics = null, flammables = null }) {
    Object.assign(this, { defs, scene, physics, player, camera, rig, sound, tool, level, foes, items, game, icon, drawIcon, relics, flammables });
    this.fx = new THREE.Group(); this.fx.name = 'Gadgets'; this.fx.userData.noCollide = true;
    scene?.add(this.fx);
    level?.noShadow?.push?.(this.fx);
    this.hud = new GadgetHud({ camera, touch, input });
    this.hud.onTap = () => this.cycle(1);
    this.world = new GadgetWorld({ physics, player, spec: level?.gadgetYard ?? level?.gadgetWorld ?? null, sound, tool, game });
    this.bursts = new InkBursts(this.fx, { drops: tool?.drops ?? null });
    this.debrisMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), inkMat('#b9a88e'), 96);
    this.debrisMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(96 * 3), 3);
    this.debrisMesh.count = 0; this.debrisMesh.frustumCulled = false; this.debrisMesh.userData.noCollide = true;
    this.fx.add(this.debrisMesh);
    const said = new Map();
    this.ctx = {
      scene, physics, player, camera, rig, sound, tool, level, foes, game, items, relics, flammables,
      world: this.world, fx: this.fx, hud: this.hud, bursts: this.bursts, sfx,
      // a short word on the screen (src/main.js showToast), at most every few seconds for the same key
      notice: (text, key = text) => { const t = performance.now(); if ((said.get(key) ?? -1e9) + 3000 > t) return; said.set(key, t); notice?.(text); },
      // where an aiming gadget points this frame (the traveller turns to it, the camera comes over the shoulder)
      aimAt: (point, dir) => { this.aimPoint.copy(point); this.aimDir.copy(dir); this.aimWanted = true; },
      // another gadget's instance (the hourglass rewinds the bombs in flight)
      gadget: (id) => this.inst.get(id) ?? null,
    };
    this.world.notice = this.ctx.notice;
    this.aimPoint = new THREE.Vector3(); this.aimDir = new THREE.Vector3(0, 0, -1); this.aimK = 0; this.aimWanted = false;
    this.inst = new Map();
    for (const d of defs) {
      try { this.inst.set(d.id, d.create(this.ctx)); } catch (e) { console.warn('gadget', d.id, e); }
    }
    this.held = { use: false, pick: false }; this.pickT = 0; this.wheelOn = false; this.wheelHi = -1;
    this.penT = 0;
    // found (a box, the dev menu, ?items=): nothing in hand yet, the first one found is taken in hand
    this.offs = [items.on?.((id, owned) => {
      if (!this.inst.has(id)) return;
      if (owned && !this.equipped) this.equip(id, { quiet: true });
      if (!owned && this.equipped === id) this.equip(null);
    })].filter(Boolean);
    if (!this.equipped && this.owned().length && game.flag(EQUIPPED_FLAG) === undefined) this.equip(this.owned()[0], { quiet: true });
  }

  /** The gadgets owned, in their order. */
  owned() { return this.defs.filter((d) => this.items.has(d.id) && this.inst.has(d.id)).map((d) => d.id); }
  /** The one in hand (an owned id) or null. */
  get equipped() { const id = this.game.flag(EQUIPPED_FLAG); return id && this.items.has(id) && this.inst.has(id) ? id : null; }
  get current() { const id = this.equipped; return id ? this.inst.get(id) : null; }
  def(id) { return this.defs.find((d) => d.id === id) ?? null; }

  equip(id, { quiet = false } = {}) {
    if (id && (!this.items.has(id) || !this.inst.has(id))) return false;
    const was = this.equipped;
    if (was === id) return false;
    if (was) this.inst.get(was)?.unequip?.();
    this.game.set(EQUIPPED_FLAG, id ?? null);
    if (id) { const g = this.inst.get(id); if (quiet) g?.equipQuiet?.(); else g?.equip?.(); }
    else if (!quiet) sfx.equip(this.sound);
    this.game.emit?.('gadget:equip', { id: id ?? null });
    return true;
  }
  cycle(dir = 1) { return this.equip(nextGadget(this.owned(), this.equipped, dir)); }

  /** Does a gadget take this button's old job? 'ping' (Y / △ with one in hand, on foot), 'bell' (D-pad ↑ once any is owned). */
  claims(action) {
    if (action === 'ping') return !!this.equipped && !this.player?.ride;
    if (action === 'bell') return this.owned().length > 0;
    return false;
  }

  /** What the wheel lists: nothing in hand first, then the gadgets owned. */
  wheelList() {
    return [{ id: null, glyph: 'none', name: 'nothing in hand (Y / △ pings)', none: true }, ...this.owned().map((id) => ({ id, glyph: this.def(id).glyph ?? '◆', name: this.def(id).name, icon: this.icon?.(id) ?? null }))];
  }

  /** Before the traveller moves: the buttons, the wheel, what the gadget in hand does to him. */
  control(dt, input = {}, paused = false) {
    if (paused) {
      // a menu, a conversation, a scene: whatever was under way lets go, the wheel closes
      if (this.wheelOn) { this.wheelOn = false; this.hud.wheel(null); }
      for (const i of this.inst.values()) i.cancel?.();
      this.held = { use: false, pick: false };
      return;
    }
    const g = gadgetInput(input), cur = this.current;
    // the choose button: a tap, the next one; held, the wheel
    if (g.pick && !this.held.pick) { this.pickT = 0; }
    if (g.pick) {
      this.pickT += dt;
      if (!this.wheelOn && this.pickT >= WHEEL_HOLD && this.owned().length) { this.wheelOn = true; this.wheelHi = -1; cur?.cancel?.(); }
    }
    if (this.wheelOn) {
      const list = this.wheelList();
      const sx = input.stick?.x ?? ((input.KeyD ? 1 : 0) - (input.KeyA ? 1 : 0)), sy = input.stick?.y ?? ((input.KeyW ? 1 : 0) - (input.KeyS ? 1 : 0));
      const s = wheelSlot(sx, sy, list.length);
      if (s >= 0) this.wheelHi = s;
      this.hud.wheel(list, this.wheelHi);
      // (the stick chooses: the traveller stands still meanwhile)
      for (const k of ['KeyW', 'KeyA', 'KeyS', 'KeyD']) input[k] = false;
      if ('stick' in input) input.stick = null;
      if (!g.pick) {
        this.wheelOn = false; this.hud.wheel(null);
        if (this.wheelHi >= 0) this.equip(list[this.wheelHi].id);
      }
    } else if (!g.pick && this.held.pick && this.pickT < WHEEL_HOLD) this.cycle(g.back || this.held.back ? -1 : 1);
    this.held.pick = g.pick; this.held.back = g.back;
    // the use button: pressed, held, let go (to the gadget in hand)
    if (cur && !this.wheelOn) {
      if (g.use && !this.held.use) cur.press?.();
      else if (g.use) cur.hold?.(dt);
      else if (this.held.use) cur.release?.();
    } else if (this.held.use && cur) cur.release?.();
    this.held.use = g.use;
    for (const i of this.inst.values()) i.control?.(dt, input);
  }

  /** After the traveller and the fluid tool: the gadgets, the world's loose things, the aim's camera, the HUD. */
  update(dt, paused = false) {
    this.aimWanted = false;
    for (const [id, i] of this.inst) { try { i.update?.(dt, paused); } catch (e) { if (!this._warned) console.warn('gadget', id, e); this._warned = true; } }
    if (!paused) this.world.update(dt);
    this.bursts.update(dt);
    this.drawDebris();
    this.updatePen(dt);
    // the aim: the camera over the shoulder, the traveller turned to it (as the fluid tool's own aim)
    const want = this.aimWanted && !paused ? 1 : 0;
    this.aimK += (want - this.aimK) * (1 - Math.exp(-(want ? 11 : 8) * dt));
    if (this.aimK < 0.002) this.aimK = 0;
    const P = this.player;
    if (this.aimK > 0 && P && !P.ride) {
      if (this.rig) this.rig.aimK = Math.max(this.rig.aimK ?? 0, smooth(this.aimK));
      if (!P.aim || P.aim.k < this.aimK) P.aim = Object.assign(this._pose ??= {}, { k: this.aimK, point: this.aimPoint, dir: this.aimDir });
    }
    // the chip
    const id = this.equipped, cur = this.current;
    const busy = P?.ride || P?.dead;
    if (id && !busy) {
      const h = cur?.hud?.() ?? {};
      const pad = typeof document !== 'undefined' && document.body?.classList?.contains('controller');
      // its picture (the model drawn by the game's pipeline, src/item-icons.js), one draw while it is missing
      const url = this.icon?.(id) ?? null;
      if (!url && this.drawIcon && !this._drawn?.has(id) && !paused) { (this._drawn ??= new Set()).add(id); this.drawIcon(); }
      this.hud.chip({ def: this.def(id), icon: url, ...h, key: pad ? 'Y / △' : typeof document !== 'undefined' && document.body?.classList?.contains('touch') ? '◆' : 'T' });
    } else this.hud.chip(null);
  }

  /** The broken walls' chunks (world.debris) in one instanced mesh. */
  drawDebris() {
    const list = this.world.debris, M = this.debrisMesh;
    if (!list.length && !M.count) return;
    const m = (this._m ??= new THREE.Matrix4()), q = (this._q ??= new THREE.Quaternion()), s = (this._s ??= new THREE.Vector3()), c = (this._c ??= new THREE.Color());
    let n = 0;
    for (const d of list) {
      if (n >= 96) break;
      const k = d.t < 1.4 ? 1 : Math.max(0, 1 - (d.t - 1.4) / 0.8);
      q.setFromAxisAngle(d.spin, d.t * 5);
      m.compose(d.pos, q, s.setScalar(Math.max(0.001, d.s * k)));
      M.setMatrixAt(n, m); M.setColorAt(n, c.set(d.color)); n++;
    }
    M.count = n; M.instanceMatrix.needsUpdate = true; if (M.instanceColor) M.instanceColor.needsUpdate = true;
  }

  /** The Gadget Yard's pen of ink blots: kept at its count, new ones only while you are away from it. */
  updatePen(dt) {
    const pen = this.world.pen, F = this.foes, P = this.player;
    if (!pen || !F?.on || !P) return;
    this.penT -= dt;
    if (this.penT > 0) return;
    this.penT = 2.5;
    const inPen = F.list.filter((f) => f.alive && f.pen === pen).length;
    if (inPen >= pen.count || P.pos.distanceTo(pen.center) < pen.r + 4) return;
    const a = Math.random() * Math.PI * 2, r = Math.random() * pen.r * 0.6;
    const at = _v.set(pen.center.x + Math.cos(a) * r, pen.center.y, pen.center.z + Math.sin(a) * r);
    const y = this.physics?.groundAt?.(at.x, at.y + 3, at.z, 10);
    if (Number.isFinite(y)) at.y = y;
    const f = F.add('blot', at.clone());
    f.pen = pen;
    f.def = { ...f.def, giveUp: pen.r, sight: pen.r + 6 };   // (they stay home in their pen)
  }

  dispose() {
    for (const i of this.inst.values()) i.dispose?.();
    this.offs.forEach((f) => f());
    this.world.dispose(); this.bursts.dispose(); this.hud.dispose();
    this.fx.removeFromParent();
  }
}
