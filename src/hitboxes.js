import * as THREE from 'three';
import { BLADE, GUARD, EVADE, bladeTouchRadius, lockTarget, iframeWindow } from './fluid-blade.js';
import { STRIKE_RISE, hurtRadius, sweepRadius } from './foes.js';
import { HOP } from './foe-height.js';
import { allTargets } from './targets.js';
import { bodyBoxes } from './foe-body.js';
import { BOMB } from './gadgets/bomb.js';

// The hitbox overlay's shapes (docs/systems/foes.md, "Hitboxes"): what the fight tests, read from the same
// data the combat code reads, as plain shapes that src/hitbox-overlay.js draws (and the tests check).
//
//   hitboxes.on · hitboxes.set(on) · hitboxes.toggle() · hitboxes.listen(f)   the switch (main.js keeps it in the settings)
//   collectHitboxes({ player, tool, foes, gadgets }) → [shape]                 every shape this frame
//   registerHitboxes((out, ctx) => out.push(shape))                            another system's own shapes (a new foe's
//                                                                              projectiles), drawn the same way
//
// Shapes (world space, y up, the foes' flat headings: forward is (sin h, cos h)):
//   { kind: 'sphere', c, r }                 a ball (three rings)
//   { kind: 'circle', c, r }                 flat on the ground round c
//   { kind: 'fan', c, h, range, angle, r0 }  flat, from c along heading h, half-angle `angle` (a cone attack, a guard)
//   { kind: 'lane', c, h, range, width, back }  a flat strip ahead of c
//   { kind: 'box', m, box }                  a box (box: a local Box3, m: its world matrix): a part of a foe's body
//   { kind: 'segment', a, b }                a line
//   { kind: 'sweep', a0, b0, a1, b1 }        the blade's swept quad, last frame's segment to this one
//   { kind: 'column', c, h0, h1, r }         the traveller's hurt column: a point at the feet, ±STRIKE_RISE of height
//   { kind: 'diamond', c, r }                the lock-on marker
//   { kind: 'label', c, text }               words over a thing
// Each has `color` (HITBOX_COLORS), `tag` (what it is, for the tests) and optional `fill` (0..1: a see-through floor).

/** One colour per meaning, distinct on the desert's sand and the sky. */
export const HITBOX_COLORS = {
  hurt: '#29d3ff',        // the traveller's hurt column
  bladeWind: '#ffe14a',   // the swing winding up / following through: not cutting
  bladeActive: '#ff2a3c', // the blade cutting: its segment, its sweep and its coarse cone
  guard: '#5ee07c',       // the guard's arc
  parry: '#ffffff',       // the guard's perfect-parry window, live
  evade: '#c48cff',       // an evade under way, open to blows (before or after its i-frames, or given none)
  iframes: '#f2e8ff',     // an evade's i-frames: nothing lands
  lock: '#ff9d1c',        // the lock-on
  soft: '#ffd9a0',        // the soft lock (the foe a swing turns to)
  foeHurt: '#ff5fb4',     // a foe's target sphere, and the blade's touch ring round it
  telegraph: '#ffa53a',   // a foe winding up: where its strike will land
  active: '#ff1f1f',      // a foe's strike, live
  spent: '#a05050',       // a strike already checked
  sight: '#7d8dff',       // a foe's sight (aggro)
  reach: '#3fe0c0',       // a foe's reach (it winds up inside it)
  keep: '#9fd0ff',        // a lobber's keep-away (the toad's)
  shot: '#00ffd5',        // a glob in flight
  bomb: '#ff7a00',        // a bomb's blast
  hook: '#b8ff3a',        // the grappling hook's line and head
};

const listeners = new Set();
/** The switch: off by default (nothing is built or drawn while off). */
export const hitboxes = {
  on: false,
  set(on) { on = !!on; if (on === this.on) return; this.on = on; for (const f of listeners) f(on); },
  toggle() { this.set(!this.on); return this.on; },
  listen(f) { listeners.add(f); return () => listeners.delete(f); },
};

const sources = new Set();
/** Another system's shapes: fn(out, ctx) pushes its own (the same kinds). Returns the way to take it back. */
export function registerHitboxes(fn) { sources.add(fn); return () => sources.delete(fn); }

const v3 = (p) => new THREE.Vector3(p.x, p.y, p.z);
const flatHeading = (d) => Math.atan2(d.x, d.z);

/** The foe's state in words: what its mind is doing, stunned, dazed or reeling, perched, waiting or hopping, its hp. */
export function foeStatus(f) {
  const parts = [f.state === 'recover' && f.reel ? f.reel : f.state];
  if (f.dazed > 0) parts.push(`dazed ${f.dazed.toFixed(1)}s`);   // (knocked off a ledge: stars over it)
  else if (f.stunned > 0) parts.push(`stunned ${f.stunned.toFixed(1)}s`);
  if (f.perched != null) parts.push('perched');                   // (on the high ground over you: src/foe-height.js)
  if (f.waiting) parts.push('waiting: no way to you');             // (holding off below or above you)
  if (f.hop) parts.push(f.hop.t < HOP.crouch ? 'crouched to hop' : 'hopping');
  if (f.state === 'wind' || f.state === 'strike') parts.push(`${Math.round(f.k * 100)}%`);
  if (f.state === 'recover') parts.push(`${Math.max(0, f.timer).toFixed(1)}s`);
  parts.push(`hp ${Math.max(0, +f.hp.toFixed(1))}/${f.def.hp}`);
  return `${f.def.name} · ${parts.join(' · ')}`;
}

/** A foe's shapes: its target sphere and blade ring, its ranges, its strike's area by phase, its label. */
export function foeHitboxes(f, out = [], { player = null, locked = null } = {}) {
  if (!f.alive || f.dead !== undefined) return out;
  const D = f.def, C = HITBOX_COLORS, chest = v3(f.chest), ground = v3(f.pos);
  const r = hurtRadius(D), body = f.hurtBody ?? null;
  // an archetype's body: the boxes of its drawn parts are what the blade meets (src/foe-body.js); its sphere (faint) is the
  // shots' and the lock's
  if (body) for (const b of bodyBoxes(body)) out.push({ kind: 'box', m: b.m, box: b.box, color: C.foeHurt, tag: 'foe.body', foe: f });
  out.push({ kind: 'sphere', c: chest, r, color: C.foeHurt, tag: 'foe.hurt', foe: f, faint: !!body, dashed: !!body });
  out.push({ kind: 'circle', c: chest, r: bladeTouchRadius({ radius: r }), color: C.foeHurt, tag: 'foe.bladeTouch', foe: f, dashed: true, faint: !!body });
  out.push({ kind: 'circle', c: ground, r: D.sight, color: C.sight, tag: 'foe.sight', foe: f, faint: true });
  out.push({ kind: 'circle', c: ground, r: D.reach, color: C.reach, tag: 'foe.reach', foe: f, faint: true });
  if (D.keep) out.push({ kind: 'circle', c: ground, r: D.keep, color: C.keep, tag: 'foe.keep', foe: f, faint: true, dashed: true });
  const phase = f.attackPhase, a = f.atk ?? D.attack;   // (the attack it is on: src/foe-kinds.js)
  if (phase) {
    const color = phase === 'telegraph' ? C.telegraph : phase === 'active' ? C.active : C.spent;
    const o = v3(f.attackOrigin()); o.y = f.level ?? f.pos.y;   // (drawn at the foe’s feet (a hovering foe’s held level, src/foes.js): it reaches the traveller within STRIKE_RISE of that)
    const base = { color, tag: `foe.attack.${phase}`, foe: f, phase, fill: phase === 'active' ? 0.3 : 0.14 };
    if (a.sweep && phase !== 'telegraph') {
      // a charge (a ray's glide, a crab's spin): what hits is its body, wherever it runs into you, so the live shape
      // is the circle round it (sweepRadius); the lane it set off along stays drawn, faint, from where it began
      const from = v3(f.attackAt); from.y = f.level ?? f.pos.y;
      out.push({ kind: 'lane', c: from, h: f.attackH, range: a.range ?? 20, width: a.width ?? 2.4, back: 1, color: C.telegraph, tag: 'foe.charge.path', foe: f, faint: true, fill: 0 });
      const armed = f.contacted || f.k >= (a.contact ?? 0);   // (the first moment of the charge does not hit yet)
      out.push({ kind: 'circle', c: ground, r: sweepRadius(a, D), ...base, ...(armed ? {} : { color: C.telegraph, tag: 'foe.attack.telegraph', phase: 'telegraph', fill: 0.14 }) });
    } else if (a.shape === 'ring') out.push({ kind: 'circle', c: o, r: a.radius ?? 4, ...base });
    else if (a.shape === 'cone') out.push({ kind: 'fan', c: o, h: f.attackH, range: a.range ?? 12, angle: a.angle ?? 0.6, ...base });
    else if (a.shape === 'lane') out.push({ kind: 'lane', c: o, h: f.attackH, range: a.range ?? 20, width: a.width ?? 2.4, back: 1, ...base });
    // a lobbed glob: its flight drawn as it is (Foes.look), its landing ring above
    if (a.at === 'target' && f.model?.glob?.visible) out.push({ kind: 'sphere', c: v3(f.model.glob.position), r: 0.22, color: C.shot, tag: 'foe.glob', foe: f });
  }
  out.push({ kind: 'label', c: chest.clone().setY(chest.y + D.height * 0.6 + 0.7), text: foeStatus(f) + (locked === f ? ' · locked' : ''), color: phase ? (phase === 'telegraph' ? C.telegraph : C.active) : f.stunned > 0 || f.reel ? '#bfe9ff' : '#ffffff', tag: 'foe.label', foe: f });
  return out;
}

/**
 * The traveller's shapes: the hurt column (foes test a point at the feet and a height window), the blade
 * (its coarse cone, its segment and sweep, by phase), the guard's arc (white while a parry would land), an
 * evade, the lock-on. `prev` keeps last frame's blade segment between calls (the sweep).
 */
export function playerHitboxes({ player: P, tool = null, foes = null }, out = [], prev = {}) {
  if (!P) return out;
  const C = HITBOX_COLORS, up = P.frame?.up ?? new THREE.Vector3(0, 1, 0), feet = v3(P.pos);
  const B = tool?.blade;
  const evading = !!B?.evadeT, says = [];   // (the traveller's words: one label over the head, the first colour leads)
  const gentle = foes?.gentle ?? B?.gentle ?? false, safe = evading && !!B.iframes?.(gentle);   // (the evade's i-frames: nothing lands)
  out.push({ kind: 'column', c: feet, h0: -STRIKE_RISE, h1: STRIKE_RISE, r: 0.22, color: safe ? C.iframes : evading ? C.evade : C.hurt, tag: safe ? 'player.hurt.iframes' : 'player.hurt' });
  if (B?.swinging && tool.player) {
    const cutting = B.cutting, color = cutting ? C.bladeActive : C.bladeWind;
    const K = B.coarse();
    out.push({ kind: 'fan', c: K.origin, h: flatHeading(K.dir), range: K.reach, angle: Math.min(K.angle, Math.PI), color, tag: cutting ? 'blade.cone.active' : 'blade.cone', faint: !cutting, r0: 0 });
    const seg = B.bladeSegment?.();
    if (seg) {
      out.push({ kind: 'segment', a: seg.a, b: seg.b, color, tag: cutting ? 'blade.segment.active' : 'blade.segment', thick: true });
      if (cutting && prev.blade) out.push({ kind: 'sweep', a0: prev.blade.a, b0: prev.blade.b, a1: seg.a, b1: seg.b, color, tag: 'blade.sweep', fill: 0.25 });
      prev.blade = { a: seg.a.clone(), b: seg.b.clone() };
    } else prev.blade = null;
    says.push({ text: `swing ${B.n + 1}${B.special ? ' (grown)' : ''} · ${cutting ? 'CUTTING' : B.phase}`, color, tag: 'blade.label' });
  } else prev.blade = null;
  if (B && B.guardK > 0.03) {
    const live = B.parryLive, color = live ? C.parry : C.guard;
    const c = feet.clone().addScaledVector(up, 1.1);
    // (the arc the shield covers as drawn, src/shield.js; with no shield drawn, GUARD.angle round the guard's way)
    const arc = B.guardArc;
    out.push({ kind: 'fan', c, h: flatHeading(arc?.dir ?? B.dir), range: 1.5, angle: arc?.half ?? GUARD.angle, r0: 0.35, color, tag: live ? 'guard.parry' : B.guarding ? 'guard.up' : 'guard.rising', fill: live ? 0.35 : 0.15, faint: !B.guarding });
    says.push({ text: live ? `PARRY ${Math.max(0, GUARD.perfect - B.guardAge).toFixed(2)}s` : B.guarding ? 'guard (a block costs a charge)' : 'guard rising', color, tag: 'guard.label' });
  }
  if (evading) {
    // (its i-frames, EVADE in src/fluid-blade.js: the window [from, to] s into it, none for an evade begun in the rest after one)
    const color = safe ? C.iframes : C.evade, [w0, w1] = iframeWindow(gentle), age = B.evadeAge ?? 0;
    out.push({ kind: 'circle', c: feet, r: 0.9, color, tag: safe ? 'evade.iframes' : 'evade', fill: safe ? 0.35 : 0.18 });
    out.push({ kind: 'segment', a: feet.clone().addScaledVector(up, 0.05), b: feet.clone().addScaledVector(up, 0.05).addScaledVector(B.evadeDir, 1.6), color, tag: 'evade.dir' });
    const state = safe ? `I-FRAMES ${Math.max(0, w1 - age).toFixed(2)}s` : B.evadeGranted === false ? 'no i-frames (too soon after the last)' : age < w0 ? 'i-frames next' : 'i-frames over';
    says.push({ text: `evade ${age.toFixed(2)}/${EVADE.duration}s · ${state}${B.dodged ? ' · DODGED' : ''}`, color, tag: 'evade.label' });
  }
  if (says.length) out.push({ kind: 'label', c: feet.clone().addScaledVector(up, 2.7), text: says.map((x) => x.text).join(' · '), color: says[0].color, tag: says.map((x) => x.tag).join(' '), lift: 1 });
  // the lock-on (R3 / Tab) and the soft lock a swing or the guard turns to
  const hard = foes?.lock ?? null;
  if (hard?.alive) out.push({ kind: 'diamond', c: v3(hard.chest).setY(hard.chest.y + hard.def.height * 0.6 + 0.35), r: 0.28, color: C.lock, tag: 'lock' });
  if (tool && !hard) {
    const soft = lockTarget(P.pos, BLADE.lock, allTargets(), tool.lockOn?.() ?? null);
    if (soft) { const c = soft.position(); out.push({ kind: 'diamond', c: v3(c).setY(c.y + 0.9), r: 0.18, color: C.soft, tag: 'lock.soft', dashed: true }); }
  }
  return out;
}

/** The globs in flight (they are rays against the targets' spheres: drawn as their point and a step of their path). */
export function shotHitboxes(tool, out = []) {
  for (const g of tool?.globs ?? []) {
    if (g.state !== 'fly') continue;
    out.push({ kind: 'sphere', c: v3(g.pos), r: 0.08, color: HITBOX_COLORS.shot, tag: 'shot' });
    out.push({ kind: 'segment', a: v3(g.pos), b: v3(g.pos).addScaledVector(g.dir, 0.9), color: HITBOX_COLORS.shot, tag: 'shot.path' });
  }
  return out;
}

/** Bombs (their blast reach round them) and the grappling hook (its line and head) while out. */
export function gadgetHitboxes(gadgets, out = []) {
  const bombs = gadgets?.inst?.get?.('bomb');
  for (const b of bombs?.live ?? []) {
    out.push({ kind: 'sphere', c: v3(b.pos), r: BOMB.r, color: HITBOX_COLORS.bomb, tag: 'bomb' });
    out.push({ kind: 'circle', c: v3(b.pos), r: BOMB.radius, color: HITBOX_COLORS.bomb, tag: 'bomb.blast', dashed: true });
    if (b.fuse != null) out.push({ kind: 'label', c: v3(b.pos).setY(b.pos.y + 0.7), text: `bomb ${Math.max(0, b.fuse).toFixed(1)}s`, color: HITBOX_COLORS.bomb, tag: 'bomb.label' });
  }
  const hook = gadgets?.inst?.get?.('hook');
  if (hook && hook.state && hook.state !== 'idle' && hook.headPos) {
    const hand = hook.hand ? hook.hand(new THREE.Vector3()) : null;
    if (hand) out.push({ kind: 'segment', a: hand, b: v3(hook.headPos), color: HITBOX_COLORS.hook, tag: 'hook.line' });
    out.push({ kind: 'sphere', c: v3(hook.headPos), r: 0.15, color: HITBOX_COLORS.hook, tag: 'hook.head' });
  }
  return out;
}

/** Every shape this frame. ctx { player, tool, foes, gadgets }; prev: kept between frames (the blade's sweep). */
export function collectHitboxes(ctx, prev = {}) {
  const out = [];
  for (const f of ctx.foes?.list ?? []) foeHitboxes(f, out, { player: ctx.player, locked: ctx.foes.lock });
  playerHitboxes(ctx, out, prev);
  shotHitboxes(ctx.tool, out);
  gadgetHitboxes(ctx.gadgets, out);
  for (const fn of sources) { try { fn(out, ctx); } catch (e) { console.warn('hitboxes', e); } }
  return out;
}
