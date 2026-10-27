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
