// How each archetype fights beyond its moves (issue #722, docs/design/enemy-fun.md section A; docs/systems/foes.md
// "Poise, tiers and states"): its weight, its poise, how it grows with the route, its low-health change, the follow-up it
// chains, the swing it hops back from, the move it backs off to make. Data here, read by the Foe's mind (src/foes.js),
// so a later tier (the plan's D13) reuses it with its own numbers.
//
//   mass     how hard it is to shove (1: a person's weight). A blow's knock-back is divided by it; at `LAUNCH.mass` and
//            under, the charged cut and the riposte throw a walker off its feet (it flies, lands, lies a moment).
//   poise    how many blows of the blade's weight (a combo swing 1, the third 3) it stands before its stance breaks. The
//            breakers break it at once: the charged cut, the riposte, the dash cut, a perfect parry. Broken, it goes
//            down (POISE.down s, cuts double, the riposte's window opens), then gets up with its poise whole again.
//            Worn poise comes back after POISE.after s untouched. A light cut never stops a wind-up once begun: only
//            a broken poise does (hyper-armour for the committed part: Lynel, Iron Knuckle, Sekiro's posture).
//   fodder   it stays as frail as it was in every world (the blot, the skitters, the moths: the ones that make you feel
//            strong); its poise is one cut and it flinches rather than going down.
//   low      { kind, below }: once, under `below` of its health:
//              'enrage'  it rears and steams; faster wind-ups (RAGE.wind, never under RAGE.min s), shorter waits, quicker
//                        on its feet, more follow-ups
//              'flee'    it cries out and runs to the nearest one of its pack (waking it) or away from you, RUN.time s;
//                        cornered after, it fights enraged
//              'last'    its last move comes next, at once (`attack`: the roller's last roll, the hound's rake); `cling`:
//                        a blow that would end it from above `below` leaves it a sliver, so the last move is always seen
//   follow   { id, on, chance }: after its move `id` misses ('whiff') or a plain guard takes it ('block'), the same move
//            again at once, its wind-up FOLLOW.wind as long (never under FOLLOW.min s: the body plays the same tell, faster)
//   evade    { chance, hop }: as your swing begins in its reach and in front of it, it may hop back `hop` m out of it
//            (EVADE.cool s between): you need a feint, the dash cut, a charged cut, or to catch it after its own blow
//   backstep the move it steps back to make (its min range): the weighted pick may choose a move out of its range and walk
//            to where it fits, backing off for a lunge, closing in for a bite (no foe repeats one move at one distance)
//   alone    what the last of a pack does when its packmates fall: 'flee' (wildlife: it cowers and runs) or 'rage'
//   down     the pose its own body has for lying down, used when its poise breaks: 'flip' (on its back: the crab, the toad),
//            'topple' (on its side, legs out: the heron); without one, its body's lean is held (src/foe-react.js 'down')

/** The archetypes' fight data (src/enemies/archetypes.js ids; a kind with none takes `fightOf`'s defaults). */
export const FIGHT = {
  crab: { mass: 2.2, poise: 4, down: 'flip', low: { kind: 'flee', below: 0.34 }, alone: 'flee', follow: { id: 'snap', on: ['whiff'], chance: 0.5 } },
  skitter: { mass: 0.4, poise: 1, fodder: true, alone: 'flee' },
  centipede: { mass: 2.6, poise: 6, low: { kind: 'enrage', below: 0.4 }, alone: 'rage', follow: { id: 'lunge', on: ['whiff'], chance: 0.5 } },
  toad: { mass: 1.6, poise: 3, down: 'flip', low: { kind: 'flee', below: 0.4 }, alone: 'flee' },
  lizard: { mass: 0.9, poise: 3, low: { kind: 'enrage', below: 0.4 }, alone: 'rage', follow: { id: 'bite', on: ['whiff', 'block'], chance: 0.5 }, evade: { chance: 0.35, hop: 2.2 }, backstep: 'bite' },
  heron: { mass: 0.8, poise: 3, down: 'topple', low: { kind: 'flee', below: 0.4 }, alone: 'flee', follow: { id: 'spear', on: ['whiff'], chance: 0.4 }, evade: { chance: 0.3, hop: 2.4 }, backstep: 'spear' },
  roller: { mass: 1.8, poise: 4, low: { kind: 'last', below: 0.34, attack: 'last', cling: true }, alone: 'rage' },
  rootknot: { mass: 4, poise: 5, low: { kind: 'enrage', below: 0.4 }, alone: 'rage', follow: { id: 'lash', on: ['whiff'], chance: 0.5 } },
  jelly: { mass: 0.7, poise: 2, low: { kind: 'flee', below: 0.5 }, alone: 'flee' },
  moth: { mass: 0.3, poise: 1, fodder: true, alone: 'flee' },
  ray: { mass: 1, poise: 3, low: { kind: 'enrage', below: 0.4 }, alone: 'rage', follow: { id: 'skim', on: ['whiff'], chance: 0.35 } },
  worm: { mass: 2, poise: 4, low: { kind: 'enrage', below: 0.4 }, alone: 'rage' },
  tripod: { mass: 3, poise: 6, low: { kind: 'enrage', below: 0.4 }, alone: 'rage', backstep: 'beam' },
  cart: { mass: 3.5, poise: 6, low: { kind: 'enrage', below: 0.4 }, alone: 'rage', backstep: 'ram' },
  bell: { mass: 5, poise: 8, low: { kind: 'enrage', below: 0.4 }, alone: 'rage' },
  drone: { mass: 0.8, poise: 3, low: { kind: 'enrage', below: 0.4 }, alone: 'rage', follow: { id: 'ram', on: ['whiff'], chance: 0.4 } },
  brute: { mass: 4, poise: 8, low: { kind: 'enrage', below: 0.4 }, alone: 'rage', follow: { id: 'sweep', on: ['whiff', 'block'], chance: 0.5 } },
  fencer: { mass: 1.6, poise: 6, low: { kind: 'enrage', below: 0.4 }, alone: 'rage' },
  blot: { mass: 0.6, poise: 1, fodder: true, low: { kind: 'enrage', below: 0.5 }, alone: 'rage' },
  shade: { mass: 0.7, poise: 4, low: { kind: 'enrage', below: 0.4 }, alone: 'rage', follow: { id: 'cut', on: ['whiff', 'block'], chance: 0.5 }, backstep: 'feint' },
  hound: { mass: 0.9, poise: 3, low: { kind: 'last', below: 0.67, attack: 'rake' }, alone: 'rage', follow: { id: 'pounce', on: ['whiff'], chance: 0.4 }, evade: { chance: 0.3, hop: 2.5 } },
  marionette: { mass: 0.6, poise: 3, low: { kind: 'flee', below: 0.4 }, alone: 'flee' },
  wisp: { mass: 0.5, poise: 3, low: { kind: 'enrage', below: 0.4 }, alone: 'rage' },
  // (issue #724: the mummers' low change is the mask knocked off, src/foes.js Foes.unmask: it drops what it holds and runs)
  mummer: { mass: 0.7, poise: 2, low: { kind: 'flee', below: 0.5 }, alone: 'flee', follow: { id: 'whack', on: ['whiff'], chance: 0.4 }, evade: { chance: 0.2, hop: 1.8 }, backstep: 'volley' },
  mummerking: { mass: 3.5, poise: 7, low: { kind: 'enrage', below: 0.4 }, alone: 'rage', follow: { id: 'smash', on: ['whiff'], chance: 0.4 } },
  // (issue #726, roster v4: low, a grunt runs to its hulk (`to`: the kind it looks to first); the hulk rages)
  grunt: { mass: 0.8, poise: 2, low: { kind: 'flee', below: 0.5, to: 'hulk' }, alone: 'flee', follow: { id: 'club', on: ['whiff'], chance: 0.5 }, evade: { chance: 0.25, hop: 1.8 }, backstep: 'lunge' },
  hulk: { mass: 4, poise: 8, low: { kind: 'enrage', below: 0.4 }, alone: 'rage', follow: { id: 'sweep', on: ['whiff'], chance: 0.4 } },
};

/**
 * Toughness by the route's stage (src/foe-worlds.js WORLDS stage 0-4): health and poise grow so the first worlds stay
 * the teachers (one combo) and the last ones' foes stand two or three; `cap` the most health any grows to. Gentle grows
 * half as much (`gentle`). Fodder never grows.
 */
export const TIER = { hp: [1, 1, 1.4, 1.8, 2.2], poise: [1, 1, 1.25, 1.5, 1.75], cap: 16, gentle: 0.5 };
/** Poise: s untouched before worn poise comes back, and how fast (a share of it a second); s down when broken (heavy: `heavy`). */
export const POISE = { after: 1.8, back: 0.6, down: 1.4, heavy: 1.1, gentle: 0.8 };
/** The charged cut and the riposte throw a walker this light or lighter off its feet: m/s up, m/s along the blow. */
export const LAUNCH = { mass: 1.2, up: 6.2, along: 4.5 };
/** Enraged: its wind-ups this long (never under `min` s), its waits, its speed, more follow-ups; its steam every `steam` s. */
export const RAGE = { wind: 0.82, min: 0.5, cool: 0.6, speed: 1.15, follow: 0.25, steam: 0.45 };
/** A follow-up: its wind-up this share of the move's own, never under `min` s; one in a row. */
export const FOLLOW = { wind: 0.65, min: 0.45 };
/** Fleeing: s it runs, how fast (× its speed), m it looks for a packmate in. */
export const RUN = { time: 3, speed: 1.15, ally: 25 };
/** Hopping back from a swing: s the hop takes, m high at its top, s before it may again. */
export const EVADE = { time: 0.32, up: 0.45, cool: 2.4 };
/** The alert beat: s it rears and calls before it comes on (Gentle `gentle`); m round it its pack wakes, any kind. */
export const ALERT = { time: 0.55, gentle: 0.75, pack: 14, spread: 0.3 };
/** A packmate falls within `near` m: it rears and calls, `time` s. */
export const MOURN = { near: 14, time: 0.4 };
/** Waiting its turn (the strike tokens): s per beat, and how often each beat is a circle, a feint or a taunt. */
export const WAIT = { beat: [1.1, 2.2], circle: 0.55, feint: 0.25, taunt: 0.2, speed: 0.75, feintStep: 0.9 };
/** The weighted pick reaches for a move out of its range at this share of its weight, and walks to it at most `time` s. */
export const REACH = { share: 0.5, time: 1.6 };

const DEFAULT = { mass: 1, poise: 3, alone: 'rage' };

/** An archetype's fight data, with its kind's def's weight read in for kinds with none (the old kinds, the makers' machine). */
export function fightOf(archetype, def = {}) {
  const F = FIGHT[archetype];
  if (F) return F;
  return { ...DEFAULT, mass: def.heavy ? 2.5 : def.light ? 0.5 : 1, poise: def.heavy ? 5 : def.light ? 1 : 3, fodder: !!def.light };
}

/** How much tougher at stage `stage` (0-4): { hp, poise } multipliers (pure: tests). Fodder: 1. Gentle: half the growth. */
export function tierScale(stage = 1, { fodder = false, gentle = false } = {}, T = TIER) {
  if (fodder) return { hp: 1, poise: 1 };
  const i = Math.max(0, Math.min(T.hp.length - 1, Math.round(stage)));
  const g = (k) => (gentle ? 1 + (k - 1) * T.gentle : k);
  return { hp: g(T.hp[i]), poise: g(T.poise[i]) };
}

/** Its health at a stage: the base times the tier, in halves, never over the cap (nor under the base). */
export function tierHp(hp, stage, o = {}, T = TIER) {
  const k = tierScale(stage, o, T).hp;
  if (k === 1) return hp;
  return Math.max(hp, Math.min(Math.max(hp, T.cap), Math.round(hp * k * 2) / 2));
}

/** What a blow does to poise (pure: tests): 'break' at once for a breaker, else its weight worn off. */
export function poiseWear(mode, info = {}) {
  if (mode === 'blade') {
    if (info.breaks || info.riposte || info.dash || info.source === 'parry') return Infinity;
    return Math.max(0.5, info.damage ?? 1);
  }
  if (mode === 'shoot' || mode === 'fire') return 1;
  if (mode === 'push') return 1.5;
  return 0;
}

/** A wind-up's length enraged or as a follow-up (pure: tests): never under the floor, never longer than it was. */
export function quickWind(wind, k, min) { return Math.min(wind, Math.max(min, wind * k)); }

// ---------------------------------------------------------------------------------------------------------------------
// Armour that comes off, weak points, the head zone and the stronger tiers (issue #722, docs/design/enemy-fun.md C11, C12,
// D13; docs/systems/foes.md "Armour, weak points and tiers"). Data here; the plates and weak points are real parts of the
// bodies (src/enemies/plans/: model.plates, model.weak), the Foe's mind reads this (src/foes.js Foe.wearPlates).
//
//   ARMOUR[archetype]
//     plates   how many plates it wears (its body builds as many: model.plates)
//     hold     what each plate stands of the blade's weight before it falls: a light cut chips 1, the heavy third swing 2;
//              the breakers knock one off at once (the charged cut, the riposte, the dash cut, a perfect parry, its
//              poise broken, its guard broken, a bomb), and so does its gun mode (`pops`, once each PLATE.gun s)
//     soak     the share of a cut's harm the plates take while any still stand (the bell's bronze and the crab's shell
//              already turn light cuts aside: 0)
//     bare     what it loses with its last plate (fully open, Darknut): the bell's bronze no longer turns your blade
//              (clapper), the crab its shell, the brute its guard; a machine's iron no longer turns the gun (shoot)
// With every plate gone it turns fast and dangerous (BARE: quicker wind-ups and waits, faster on its feet) and fully open
// (its cuts BARE.takes as hard). Fodder never wears any.

/** The heavy foes' plates. */
export const ARMOUR = {
  bell: { plates: 3, hold: 3, pops: ['push'], soak: 0, bare: { clapper: false, stout: false } },
  brute: { plates: 3, hold: 3, pops: ['stun'], soak: 0.4, bare: { guard: null, stout: false, heavy: false } },
  crab: { plates: 2, hold: 2, pops: ['fire'], soak: 0, bare: { shell: false, guard: null, heavy: false } },
  tripod: { plates: 3, hold: 2, pops: ['stun'], soak: 0.4, bare: { heavy: false, shoot: 1 } },
  cart: { plates: 2, hold: 3, pops: ['shoot'], soak: 0.4, bare: { heavy: false } },
};
/** Bare (every plate off): its wind-ups this long (never under `min` s), its waits, its speed, how hard your cuts land. */
export const BARE = { wind: 0.8, min: 0.5, cool: 0.7, speed: 1.25, takes: 1.25 };
/**
 * A plate: s between two its gun mode may knock off; s a fallen one lies before it sinks away (`sink` s); m/s it flies off
 * (out, up); how far it hangs loose as it is chipped (rad, at its last hold).
 */
export const PLATE = { gun: 2.5, lie: 6, sink: 1.2, out: 2.6, up: 3.4, loose: 0.32 };

/**
 * What a blow does to its plates (pure: tests): 'pop' (one falls at once), a chip of its hold (a number), or 0.
 * r: what the body made of it ('glance', 'guarded', 'guardbreak', true...); broke: its poise broke with this blow.
 */
export function plateBlow(A, mode, info = {}, r = true, broke = false) {
  if (!A || !r || r === 'burst') return 0;
  if (broke || r === 'guardbreak' || info.source === 'bomb') return 'pop';
  if (r === 'guarded') return 1;   // (its guard took the blow, whatever it was: a chip)
  if (mode === 'blade') {
    if (info.breaks || info.riposte || info.dash || info.source === 'parry') return 'pop';
    return (info.combo === 2 || (info.damage ?? 1) >= 2) ? 2 : 1;
  }
  if (A.pops?.includes(mode)) return 'pop';
  return 0;
}

/**
 * Weak points (C12: the tripod's lamp, the brute's furnace door, the bell's clapper, the cart's eyes in its smoke): a shot
 * or a cut there stuns it `stun` s and opens the riposte's window (src/fluid-blade.js openRiposte); `cut` its harm × from the
 * blade there; then `cool` s before the same weak point stuns it again (a shot still lands there as a headshot). m: the
 * blade's point within the weak point's radius and this margin.
 */
export const WEAK = { stun: 1.6, cool: 4, cut: 1.5, margin: 0.25 };
/**
 * The head zone of a shot (any foe with eyes: its gaze part, or its weak point): a headshot. A creature's stance breaks at
 * once (the plan's A1 breaker), `cool` s between two (meanwhile a headshot wears it `wear` ×); fodder flinches and takes
 * `fodder` × its harm. `r`: m round the eyes at a body's size 1.
 */
export const HEAD = { r: 0.3, cool: 6, fodder: 2, wear: 2 };

/** Does a shot along (point, dir) pass within r of `at` (pure: tests)? Its nearest approach from `back` m before the point on. */
export function rayNear(point, dir, at, r, back = 1.5) {
  const ax = at.x - point.x, ay = at.y - point.y, az = at.z - point.z, l = Math.hypot(dir.x, dir.y, dir.z) || 1;
  const t = Math.max(-back, (ax * dir.x + ay * dir.y + az * dir.z) / l);
  const px = ax - (dir.x / l) * t, py = ay - (dir.y / l) * t, pz = az - (dir.z / l) * t;
  return Math.hypot(px, py, pz) <= r;
}

/**
 * The stronger tier of each archetype (D13, BotW's colours): darker and banded (src/enemies/skins.js tierSkin, the bands
 * painted by src/enemies/surfaces.js TIER_SURFACE), its health and poise TIER_UP over its stage's, and ONE new move:
 *   combo [a, b]   after its move a lands or misses, b at once (once): the tripod's second bolt, the drone's harpoon
 *                  then its ram (the body plays b's own wind-up: its tell)
 *   unlock id      a move its other skins only had (the toad's volley, the roller's ricochet)
 *   patch {id: {}} one of its moves made stronger (the bell's toll five rings, the brute's slam two quakes)
 * `words`: what the gallery and the docs say of it. Mixed into packs and encounter sites from TIER_FROM's stage on, a share
 * TIER_SHARE[stage] of the non-fodder foes. Fodder (the blot, the skitters, the moths) has no tier: it stays the fodder.
 */
export const TIERS = {
  crab: { combo: ['snap', 'snap'], words: 'its snap comes twice, the second quicker' },
  centipede: { combo: ['ring', 'lunge'], words: 'out of its ring it lunges at once' },
  toad: { unlock: 'volley', words: 'it lobs a volley of three' },
  lizard: { combo: ['blare', 'bite'], words: 'its blare shoves you, then it bites' },
  heron: { combo: ['spear', 'sweep'], words: 'a spear, then a sweep of the bill' },
  roller: { unlock: 'ricochet', words: 'it rolls off the walls at you' },
  rootknot: { unlock: 'puff', words: 'it puffs spores' },
  jelly: { unlock: 'mend', words: 'it mends its neighbours' },
  ray: { unlock: 'draft', words: 'its downdraft throws you out of a glide' },
  worm: { combo: ['erupt', 'spit'], words: 'it spits stones as it erupts' },
  tripod: { combo: ['beam', 'beam'], words: 'its lamp fires a second bolt' },
  cart: { combo: ['ram', 'pour'], words: 'it pours its slag after a ram' },
  bell: { patch: { toll: { wave: { speed: 6.5, reach: 12, damage: 0.5, width: 0.6, count: 5, every: 0.55 } } }, words: 'its toll runs five rings' },
  drone: { combo: ['harpoon', 'ram'], words: 'it reels you in, then rams' },
  brute: { patch: { slam: { wave: { speed: 7, reach: 8, damage: 0.5, width: 0.55, count: 2, every: 0.6 } } }, words: 'its slam sends two quakes' },
  fencer: { combo: ['overhead', 'sweep'], words: 'an overhead, then a sweep' },
  shade: { combo: ['cut', 'cut'], words: 'it cuts twice' },
  hound: { combo: ['pounce', 'bite'], words: 'it bites as it lands its pounce' },
  marionette: { combo: ['yank', 'yank'], words: 'its strings yank twice' },
  wisp: { combo: ['fireball', 'flare'], words: 'it flares after its fireball' },
  // (the doc's tier 2, "masked in metal": its mask takes two headshots (def.mask.hits), and it whacks twice)
  mummer: { combo: ['whack', 'whack'], mask: 2, words: 'masked in metal (two headshots to knock it off); it whacks twice' },
  mummerking: { combo: ['throw', 'smash'], words: 'it throws a mummer and comes in behind it with the beam' },
  grunt: { combo: ['lunge', 'club'], words: 'out of its lunge it clubs you at once' },
  hulk: { patch: { stomp: { wave: { speed: 7, reach: 8, damage: 0.5, width: 0.55 } } }, words: 'its stomp sends a quake running out over the ground' },
};
/** The stage of the route a tier first comes in at, and the share of the non-fodder foes in tier by stage (0-4). */
export const TIER_FROM = 3;
export const TIER_SHARE = [0, 0, 0, 0.3, 0.45];
/** A tier's toughness over its stage's (× health, never past TIER.cap; × poise). */
export const TIER_UP = { hp: 1.25, poise: 1.25 };

/** A tier's def (pure: tests): the kind's def with its new move (patched, unlocked) and its health; null without a tier. */
export function tierDef(archetype, def) {
  const T = TIERS[archetype];
  if (!T) return null;
  const attacks = def.attacks.map((a) => {
    let x = a;
    if (T.patch?.[a.id]) x = { ...x, ...T.patch[a.id] };
    if (T.unlock === a.id && x.skins) { const { skins, ...rest } = x; x = rest; }
    return x;
  });
  return { ...def, attacks, attack: attacks[0], ...(T.mask && def.mask ? { mask: { ...def.mask, hits: T.mask } } : {}) };
}
