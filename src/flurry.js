import * as THREE from 'three';
import { inArea } from './temples/boss.js';
import { flurryK } from './feel.js';

// The perfect dodge and its flurry (docs/systems/foes.md "The back flip, the side hop and the flurry"; Breath of the Wild's
// flurry rush): locked on, a back flip or a side hop (src/jump.js HOP, Player.hop) begun just before a blow would land
// slows the world round you (src/feel.js flurry: the foes, the guardians, their blows, everything but you) for FLURRY.time
// s of your own time, with a soft pastel vignette (FlurryFx); while it lasts nothing touches you, and a cut pulls you in
// from further (FLURRY.reach) and chains without the combo's rest (FLURRY.cool): a few free blows.
//
// The window, from the attacks' own data (every archetype's: src/enemies/archetypes.js, src/foes.js FOES; every guardian's
// moves: src/temples/*.js), measured as the time left before the blow lands (`landsIn`: the rest of its wind-up, then its
// strike phase up to its `contact`; a lob, a flash, a blink at the end of its wind-up): a hop begun with
//   0 ≤ landsIn ≤ dodgeLead(wind) = clamp(DODGE.share × wind, DODGE.min, DODGE.max)   (× DODGE.gentle on Gentle)
// and you in the blow's way (its area grown by DODGE.margin, or within its reach and DODGE.margin) is perfect. A third of
// the wind-up: a tell of 0.6 s (a blot's) gives 0.21 s, one of 1.2 s (a guardian's) 0.4 s; never under 0.2 s (a fast jab
// would be a frame-perfect guess), never over 0.42 s (a slow wind-up would be a free flurry: hop as soon as it starts).
// Generous next to the parry's 0.18 s, as the hop also has to read the blow's way. A blow the hop's dodge frames swallow
// (FluidBlade.hop: a shockwave's front, a lob's flight, anything Foes.strike asks Player.dodge about) counts as well.

export const DODGE = { share: 0.35, min: 0.2, max: 0.42, gentle: 1.3, margin: 1.2 };
/** The flurry: `time` s of your time, the world at `rate`, eased over `ease` s; the cut's pull `reach` m; the combo's rest × `cool`; `again` s before the next may start. */
export const FLURRY = { time: 3.5, rate: 0.12, ease: 0.2, reach: 6, cool: 0.3, again: 1.2 };

/** How long before a blow lands a hop is perfect, for a wind-up of `wind` s (pure: tests). */
export function dodgeLead(wind, gentle = false, D = DODGE) {
  return THREE.MathUtils.clamp(D.share * (wind > 0 ? wind : 0.8), D.min, D.max) * (gentle ? D.gentle : 1);
}

/**
 * Seconds (the world's) until a foe's blow lands, from its mind (pure: tests): `s` { state, timer, k, contacted }, `a` the
 * attack, `wind` its wind-up now (the Gentle setting's and a marionette's strings in it). null: no blow coming.
 */
export function landsIn(s, a, wind) {
  if (!a) return null;
  const strike = a.strike ?? 0.24, contact = a.sweep ? a.contact ?? 0 : a.contact ?? 0.55;
  if (s.state === 'wind') return Math.max(0, wind - (s.timer ?? 0)) + (a.instant || a.at === 'target' ? 0 : contact * strike);
  if (s.state === 'strike' && !s.contacted) return a.sweep ? 0 : Math.max(0, contact - (s.k ?? 0)) * strike;
  return null;
}

/** Does a blow do anything to you (harm, a grab, a flash, a shove)? A ward, a mend or a possession does not. */
export const harmful = (a) => !!a && !a.ward && !a.mend && !a.possess && (a.damage > 0 || a.knock || a.grab || a.tether || a.blind || a.slip || a.blur || a.shove || a.wave);

/** An attack's area grown by `m` (the dodge reads a near miss too). */
export function grownArea(a, m = DODGE.margin) {
  return { ...a, radius: (a.radius ?? 4) + m, range: (a.range ?? 12) + m, angle: (a.angle ?? 0.6) + 0.3, width: (a.width ?? 2.4) + 2 * m };
}
/** How far a blow reaches from its maker (m): its reach, its lunge or dash, its shape's size. */
export const reachOf = (a) => Math.max(a.max ?? 0, (a.lunge ?? 0) + 1.5, a.dash ?? 0, a.shape === 'ring' ? (a.radius ?? 0) + (a.ahead ?? 0) : a.range ?? 0);

/**
 * A foe's coming blow as the dodge sees it (pure but for the foe's own methods): { t (s to land), wind, near } or null.
 * `slow` the Gentle setting's wind-up factor (Foes.env.slow), `windK` a marionette's (POSSESS.wind) when it drives it.
 */
export function foeThreat(f, P, slow = 1, windK = 1) {
  if (!f?.alive || f.dead !== undefined || f.dying) return null;
  const a = f.atk ?? f.def?.attack;
  if (!harmful(a)) return null;
  const wind = (a.wind ?? 0.8) * slow * windK;
  const t = landsIn(f, a, wind);
  if (t == null) return null;
  const origin = a.at === 'target' || a.shape === 'ring' ? f.attackAt ?? f.pos : f.attackOrigin?.() ?? f.pos;
  const near = (origin && inArea(grownArea(a), origin, f.attackH ?? f.heading ?? 0, P.pos))
    || Math.hypot(P.pos.x - f.pos.x, P.pos.z - f.pos.z) <= reachOf(a) + (f.def?.radius ?? 0.6) + DODGE.margin;
  return { t, wind, near, a };
}

/** A guardian's coming move as the dodge sees it: { t, wind, near } or null (src/temples/boss.js Guardian). */
export function guardianThreat(g, P) {
  const a = g?.attack;
  if (!a || g.struck || g.state !== 'fight' || !harmful({ damage: 1, ...a })) return null;
  const wind = g.windFor ?? a.wind ?? 1.2, t = Math.max(0, wind - (g.at ?? 0));
  const pts = g.points?.(a) ?? [g.attackAt];
  const near = pts.some((p) => p && inArea(grownArea(a), p, g.attackH ?? 0, P.pos))
    || (a.at === 'self' && Math.hypot(P.pos.x - g.model.pos.x, P.pos.z - g.model.pos.z) <= (a.radius ?? 4) + DODGE.margin);
  return { t, wind, near, a };
}

/** Is a hop now a perfect dodge against `threat` ({ t, wind, near })? (pure: tests) */
export const perfectAgainst = (threat, gentle = false) => !!threat && threat.near && threat.t >= 0 && threat.t <= dodgeLead(threat.wind, gentle);

/**
 * The flurry's screen: a soft vignette of lavender and cream closing in from the edges, as a page's margin washed in
 * pastel; drawn by the page (a gradient: no pass, no draw call), its opacity following the slow time (feel.js flurryK).
 */
export class FlurryFx {
  constructor(parent = typeof document !== 'undefined' ? document.body : null) {
    if (!parent) return;
    this.el = Object.assign(document.createElement('div'), { id: 'flurry-fx' });
    this.el.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:23;opacity:0;display:none;'
      + 'background:radial-gradient(ellipse 75% 70% at 50% 50%, rgba(247,236,210,0) 58%, rgba(214,200,236,0.32) 82%, rgba(120,98,160,0.5) 100%);'
      + 'box-shadow:inset 0 0 0 2px rgba(43,33,31,0.28), inset 0 0 0 7px rgba(247,236,210,0.18)';
    parent.appendChild(this.el);
  }
  update() {
    if (!this.el) return;
    const k = flurryK();
    this.el.style.display = k > 0.01 ? '' : 'none';
    this.el.style.opacity = k.toFixed(3);
  }
  dispose() { this.el?.remove(); }
}
