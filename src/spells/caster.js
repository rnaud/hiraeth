import * as THREE from 'three';
import { SPELLS, SPELL_COOLDOWN } from './data.js';
import { spellBook } from './book.js';
import { makeMaterial } from '../materials.js';
import { thinRing } from '../thin.js';

// Casting the spells (docs/systems/spells.md): the press (LB / L1 + RB / R1 together, src/controller.js PadSpell; Y,
// KEYS.spell; the touch ✺ button, TouchSpell), the 30 s recovery, and what each spell does and shows while it works.
// The same in the page and the engines (main.js and engine/game.js make it through wireSpells, src/spells/index.js).
//
//   const caster = new SpellCaster({ scene, player, foes: () => foes, tool, sound, game, toast, hud })
//   caster.update(dt, input, paused)    each frame, after the foes; input: the frame's controls (KeyY, PadSpell, TouchSpell)
//   caster.cast()                       → { ok, why }: 'none' (no spell known), 'cool' (recovering), 'unable' (riding, down)
//
// What each one touches, while it works:
//   ward    player.absorb(amount, why): a blow (not a fall, the water, a knock-out) is taken by the rings instead (Player.hurt)
//   tide    foes.slowAt(pos): the foes' step inside its dome (Foes.update), their wind-ups and strikes with it
//   shards  foes.hurt(f, 'blade', …): every foe whose body the circling shards pass through, each once a beat
//   veil    player.veiled: the foes lose you (Foe.update: as when you ride off), give up the chase, never notice you;
//           a cut (the blade swinging) or the gun's shot lifts it

const _up = new THREE.Vector3(0, 1, 0), _v = new THREE.Vector3(), _w = new THREE.Vector3(), _q = new THREE.Quaternion();
/** Reasons a press does not cast. */
export const WONT = { none: 'none', cool: 'cool', unable: 'unable' };

/** Is a press now (the frame's controls): any of the spell's inputs. */
export const spellInput = (c = {}) => !!(c.KeyY || c.PadSpell || c.TouchSpell);

const glow = (color, g = 0.9) => makeMaterial({ color, flat: true, glow: g, thin: 1.6 });
const ring = (R, color, tube = 0.03) => new THREE.Mesh(thinRing(new THREE.TorusGeometry(R, tube, 4, 64), R, 64, 4), glow(color));
const mark = (m) => { m.frustumCulled = false; m.userData.noCollide = true; m.castShadow = false; return m; };

export class SpellCaster {
  constructor({ scene = null, player = null, foes = () => null, tool = null, sound = null, game, toast = () => {}, hud = null } = {}) {
    Object.assign(this, { scene, player, foesOf: foes, tool, sound, game, toast, hud });
    this.book = spellBook(game);
    this.cool = 0;          // s left before the next cast
    this.active = null;     // { id, t, time, … } the spell working now
    this.was = false;       // the press's input last frame (a press is its rise)
    this.toldCool = 0;      // (the "recovers in" word, not more than once a second and a half)
    this.fx = new THREE.Group(); this.fx.name = 'Spells'; this.fx.userData.noCollide = true;
    scene?.add(this.fx);
    this.views = {};
    // (a shot of the glove lifts the veil, as a cut does)
    this.shot = false;
    this.offShot = game?.on?.('tool:fire', () => { this.shot = true; }) ?? null;
  }

  get foes() { return this.foesOf?.() ?? null; }
  /** The spell chosen (or null). */
  get selected() { return this.book.selected(); }
  /** Ready to cast: a spell known, recovered, none working. */
  get ready() { return !!this.selected && this.cool <= 0; }

  /** Cast the chosen spell. */
  cast() {
    const id = this.selected, P = this.player;
    if (!id) return { ok: false, why: WONT.none };
    if (this.cool > 0) {
      if (this.toldCool <= 0) { this.toast(`${SPELLS[id].name} recovers in ${Math.ceil(this.cool)} s.`); this.toldCool = 1.5; }
      this.sound?.fluidEmpty?.();
      return { ok: false, why: WONT.cool };
    }
    if (!P || P.ride || P.down || P.dead) return { ok: false, why: WONT.unable };
    this.end();
    // (RB / R1 a moment before LB / L1: the swing it began is still winding up; the chord was the spell, so it is dropped)
    const B = this.tool?.blade;
    if (B?.swinging && B.phase === 'wind' && !B.special) B.stop?.();
    const S = SPELLS[id], T = S.tune;
    this.cool = SPELL_COOLDOWN;
    this.active = { id, t: 0, time: T.time };
    this.game?.emit?.('spell:cast', { id });
    // the cast: a ring of the spell's colour runs out over the ground from his feet
    const up = this.upAt(_w);
    this.tool?.rings?.add?.({ from: _v.copy(P.pos).addScaledVector(up, 0.08), dir: up, r0: 0.3, r1: id === 'tide' ? T.r : 2.6, life: 0.55, color: S.color, thick: 1.4 });
    this.begin[id].call(this, S, T);
    return { ok: true, id };
  }

  /** The traveller's up (a world whose down moves: his frame's). */
  upAt(out) { return out.copy(this.player?.frame?.up ?? _up); }

  // ------------------------------------------------------------------ each spell's start

  begin = {
    ward(S, T) {
      const A = this.active; A.blocks = T.blocks;
      const v = this.view('ward', () => {
        const g = new THREE.Group();
        g.userData.rings = [0, 1, 2].map((i) => { const m = mark(ring(T.r * (1 - i * 0.08), S.color, 0.035)); g.add(m); return m; });
        return g;
      });
      v.visible = true; v.scale.setScalar(0.01);
      this.player.absorb = (amount, why) => this.wardTakes(amount, why);
      this.sound?.shieldOpen?.();
    },
    tide(S, T) {
      const A = this.active; A.at = this.player.pos.clone(); A.up = this.upAt(new THREE.Vector3());
      const v = this.view('tide', () => {
        const g = new THREE.Group(), R = T.r;
        // the dome's lines: its foot on the ground, two latitudes, a meridian turning; twelve ticks round its foot, a hand
        g.add(mark(ring(R, S.color, 0.08)));
        for (const [h, k] of [[0.42, 0.9], [0.78, 0.62]]) { const m = mark(ring(R * k, S.color, 0.03)); m.position.y = R * h; m.rotation.x = Math.PI / 2; g.add(m); }
        g.children[0].rotation.x = Math.PI / 2;
        const mer = mark(ring(R, S.color, 0.025)); g.add(mer); g.userData.meridian = mer;
        const tickG = new THREE.BoxGeometry(0.08, 0.05, 0.9), tickM = glow(S.color, 0.8);
        for (let i = 0; i < 12; i++) { const t = mark(new THREE.Mesh(tickG, tickM)); const a = (i / 12) * Math.PI * 2; t.position.set(Math.sin(a) * (R - 0.6), 0.05, Math.cos(a) * (R - 0.6)); t.rotation.y = a; g.add(t); }
        const hand = mark(new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.06, R * 0.8), glow(S.color, 1))); hand.geometry.translate(0, 0.08, R * 0.4); g.add(hand); g.userData.hand = hand;
        // slow ripples running out over the ground from where it was cast to its edge
        g.userData.ripples = [0, 1, 2].map(() => { const m = mark(ring(1, S.color, 0.035)); m.rotation.x = Math.PI / 2; m.position.y = 0.04; g.add(m); return m; });
        return g;
      });
      v.visible = true; v.position.copy(A.at); v.quaternion.setFromUnitVectors(_up, A.up); v.scale.setScalar(0.01);
      const r2 = T.r * T.r;
      if (this.foes) this.foes.slowAt = (pos) => (pos && pos.distanceToSquared(A.at) < r2 ? T.slow : 1);
      A.hum = this.sound?.makersHumRise?.(Math.min(2, T.time)) ?? null;
      this.sound?.chime?.();
    },
    shards(S, T) {
      const A = this.active; A.cut = new Map();
      const v = this.view('shards', () => {
        const g = new THREE.Group(), geo = new THREE.OctahedronGeometry(0.22, 0); geo.scale(0.45, 0.45, 2.2);
        const mat = glow(S.color, 1);
        g.userData.shards = Array.from({ length: T.n }, () => { const m = mark(new THREE.Mesh(geo, mat)); g.add(m); return m; });
        g.add(mark(ring(T.r, S.color, 0.02)));
        g.children[g.children.length - 1].rotation.x = Math.PI / 2;
        return g;
      });
      v.visible = true; v.scale.setScalar(0.01);
      this.sound?.fluidRiposte?.(false);
    },
    veil(S, T) {
      const v = this.view('veil', () => {
        const g = new THREE.Group(), n = 16, geo = new THREE.BoxGeometry(0.035, 2.3, 0.035), mat = glow(S.color, 1);
        g.userData.bars = Array.from({ length: n }, (_, i) => { const a = (i / n) * Math.PI * 2, m = mark(new THREE.Mesh(geo, mat)); m.position.set(Math.sin(a) * T.r, 1.15, Math.cos(a) * T.r); g.add(m); return m; });
        for (const y of [0.05, 2.3]) { const m = mark(ring(T.r, S.color, 0.025)); m.rotation.x = Math.PI / 2; m.position.y = y; g.add(m); }
        return g;
      });
      v.visible = true; v.scale.setScalar(0.01);
      this.player.veiled = true;
      // (the foes chasing you now lose you at once: Foe.update sends them home)
      this.sound?.whoosh?.(0.7);
    },
  };

  /** A blow on the traveller while the ward is up: taken by its rings (true), or let through (a fall, the water). */
  wardTakes(amount, why) {
    const A = this.active;
    if (!A || A.id !== 'ward' || !(A.blocks > 0)) return false;
    if (amount === Infinity || why === 'fall' || why === 'drown') return false;
    A.blocks--;
    const P = this.player, up = this.upAt(_w);
    this.tool?.rings?.add?.({ from: _v.copy(P.pos).addScaledVector(up, 1.05), dir: up, r0: 0.6, r1: 1.9, life: 0.35, color: SPELLS.ward.color, thick: 1.6 });
    this.sound?.fluidBlock?.(true);
    this.game?.emit?.('spell:ward', { left: A.blocks, why });
    if (A.blocks <= 0) A.t = Math.max(A.t, A.time - 0.3);   // (its last ring gone: it fades now)
    return true;
  }

  view(id, make) {
    let v = this.views[id];
    if (!v) { v = this.views[id] = make(); v.visible = false; this.fx.add(v); }
    return v;
  }

  // ------------------------------------------------------------------ each frame

  update(dt, input = {}, paused = false, hidden = false) {
    const want = spellInput(input);
    const press = want && !this.was;
    this.was = want;
    this.toldCool = Math.max(0, this.toldCool - dt);
    if (!paused) {
      this.cool = Math.max(0, this.cool - dt);
      if (press) this.cast();
      if (this.active) this.work(dt);
    }
    this.shot = false;
    if (hidden) this.hud?.show(null);   // (photo mode: no chip, as the engines clear it)
    else this.showHud();
  }

  work(dt) {
    const A = this.active, S = SPELLS[A.id], T = S.tune, P = this.player;
    A.t += dt;
    const u = A.t / A.time, grow = Math.min(1, A.t / 0.25), fade = Math.min(1, (A.time - A.t) / 0.35), k = Math.max(0.01, Math.min(grow, fade));
    const v = this.views[A.id];
    const up = this.upAt(_w);
    if (A.id === 'ward' && v) {
      v.position.copy(P.pos).addScaledVector(up, 1.05); v.quaternion.setFromUnitVectors(_up, up); v.scale.setScalar(k);
      const R = v.userData.rings;
      R.forEach((m, i) => { m.visible = i < A.blocks + 1; m.rotation.set(A.t * (1.6 + i * 0.7), A.t * (2.3 - i * 0.5) + i * 1.1, i * 0.9); });
    } else if (A.id === 'tide' && v) {
      v.scale.setScalar(k);
      v.userData.meridian.rotation.y = A.t * 0.35;
      v.userData.hand.rotation.y = -A.t * 0.8;
      v.userData.ripples.forEach((m, i) => { const f = (A.t / 2.6 + i / 3) % 1; m.scale.setScalar(Math.max(0.05, f * T.r)); m.visible = f > 0.04; });
    } else if (A.id === 'shards' && v) {
      v.position.copy(P.pos).addScaledVector(up, 1.0); v.quaternion.setFromUnitVectors(_up, up); v.scale.setScalar(k);
      const n = v.userData.shards.length;
      v.userData.shards.forEach((m, i) => {
        const a = A.t * T.spin + (i / n) * Math.PI * 2;
        m.position.set(Math.sin(a) * T.r, Math.sin(A.t * 5 + i) * 0.12, Math.cos(a) * T.r);
        m.rotation.set(0, a + Math.PI / 2, 0);
      });
      this.shardsCut(dt, T, up);
    } else if (A.id === 'veil' && v) {
      v.position.copy(P.pos); v.quaternion.setFromUnitVectors(_up, up); v.scale.set(k, 1, k);
      v.rotation.y = 0; v.quaternion.multiply(_q.setFromAxisAngle(_up, A.t * 0.9));
      v.userData.bars.forEach((m, i) => { m.scale.y = 0.55 + 0.45 * Math.abs(Math.sin(A.t * 3 + i * 1.7)); });
      // (a cut, a shot: the veil lifts)
      if (this.tool?.blade?.swinging || this.shot) A.t = Math.max(A.t, A.time - 0.3);
      P.veiled = true;
    }
    if (u >= 1) this.end();
  }

  /** The shards' cuts: each live foe whose body the circling ring of shards passes through, once every T.every s. */
  shardsCut(dt, T, up) {
    const F = this.foes, P = this.player, A = this.active;
    if (!F?.list) return;
    for (const [f, t] of A.cut) A.cut.set(f, t - dt);
    let cut = 0;
    for (const f of F.list) {
      if (!f.alive || f.dead !== undefined || f.dying || !f.pos) continue;
      if ((A.cut.get(f) ?? 0) > 0) continue;
      _v.subVectors(f.pos, P.pos);
      const h = _v.dot(up); _v.addScaledVector(up, -h);
      const d = _v.length(), r = (f.def?.radius ?? 0.6) + T.reach;
      if (Math.abs(d - T.r) > r || h < -1.5 || h > 2.5 + (f.def?.height ?? 1)) continue;
      const dir = d > 1e-4 ? _v.divideScalar(d).clone() : null;
      const at = f.chest?.clone?.() ?? f.pos.clone();
      F.hurt?.(f, 'blade', dir, { damage: T.damage, source: 'shards' }, at);
      A.cut.set(f, T.every);
      cut++;
    }
    // (one slash for the ring's pass, however many it cut: four foes met at once stacked four, issue #638; each foe's own cry
    // still answers its cut, Foes.hurt)
    if (cut) this.sound?.fluidSlashHit?.(true);
  }

  /** The spell working now stops (its time out, its rings spent, a new cast, the world left). */
  end() {
    const A = this.active;
    if (!A) return;
    this.active = null;
    const v = this.views[A.id];
    if (v) v.visible = false;
    if (A.id === 'ward' && this.player) this.player.absorb = null;
    if (A.id === 'tide' && this.foes) { this.foes.slowAt = null; A.hum?.stop?.(); }
    if (A.id === 'veil' && this.player) { this.player.veiled = false; this.sound?.whoosh?.(0.35); }
  }

  /** The chip (src/spells/hud.js): the spell chosen, how far it has recovered, the seconds left, what is working. */
  showHud() {
    if (!this.hud) return;
    const id = this.selected;
    if (!id) { this.hud.show(null); return; }
    const S = SPELLS[id], A = this.active;
    this.hud.show({ id, name: S.name, glyph: S.glyph, color: S.color, k: 1 - this.cool / SPELL_COOLDOWN, left: this.cool, ready: this.cool <= 0,
      active: A && A.id === id ? Math.max(0, 1 - A.t / A.time) : 0 });
  }

  /** The state for a test or a save's look: { selected, cool, active }. */
  state() { return { selected: this.selected, cool: this.cool, active: this.active?.id ?? null }; }

  dispose() {
    this.end();
    this.offShot?.();
    this.fx.removeFromParent();
    this.fx.traverse((o) => o.geometry?.dispose?.());
    this.hud?.dispose?.();
  }
}
