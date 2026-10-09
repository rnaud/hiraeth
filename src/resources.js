import { game as sharedGame } from './game-state.js';
import { items as sharedItems } from './items.js';
import { RES_VERSION } from './save-migrate.js';

// The traveller's resources: hearts, the magic bar and the healing potions (docs/systems/items.md,
// "Hearts, magic and potions"). One small module so the later shops (heart containers, magic
// expansions, potions for sale) and the currency plug in without touching the systems that spend them.
//
//   Hearts   the health. HEARTS.start full hearts at the start; every hurt is counted in quarter hearts
//            (quarters()); an ordinary foe's blow takes half a heart (DAMAGE). They never come back by
//            themselves: a potion heals. The player holds the current hearts (src/player.js: player.hearts,
//            player.maxHearts; player.health is the same as a share of the whole, 0..1, for the old callers).
//   Magic    the bar the backpack spends (the old three chambers): MAGIC.start units, one unit is what a
//            chamber was (a shot, a push, a boost, a mode's glob, a shield that breaks); the jets burn it
//            smoothly. It refills by itself like stamina: MAGIC.delay s after the last spend, empty to full
//            (the starting bar) in MAGIC.fill s. src/fluid-tool.js Reserve is the bar; this module says how
//            long it is (maxMagic) and how quickly it comes back (magicPace, the quick coil).
//   Potions  POTION.heal hearts back, drunk with the potion button (KEYS.potion, View + D-pad ↓, the touch
//            flask). A count: POTION.start in a new game, at most POTION.cap carried; the shops sell more
//            (src/shop.js). The `infinite` flag is the dev menu's (and was everyone's until the first shop).
//
// The save: game flags, so the format grows freely (src/game-state.js):
//   res.v                 the resources' format (RES_VERSION; src/save-migrate.js stamps old saves)
//   res.hearts.extra      heart containers gained beyond HEARTS.start (later: shops, quests)
//   res.magic.extra       magic expansions gained beyond the items' own (later: shops), in units
//   res.potions           potions carried (unset: POTION.start, a new game's)
//   res.potions.infinite  potions never run out (the dev menu; unset: false. Until the first shop, v1.5, it was
//                         everyone's: src/save-migrate.js step 5 gave those saves a full stock instead)
//   res.chimes            the wallet: chimes carried (CHIMES.cap at most)
//   res.chimes.earned     chimes ever picked up out in the worlds (not the Arena's training: src/chimes.js)
// The items that lengthen the bar (MAGIC_ITEMS: the fourth chamber, 'cell') are read from
// the items themselves, so a save that had one before the bar existed has it now, and the dev menu's revoke
// takes it back.
//
//   import { resources } from './resources.js';
//   resources.maxHearts · resources.maxMagic · resources.magicPace → { delay, rate }
//   resources.potions → { count, infinite } · resources.takePotion() → bool
//   resources.chimes · resources.addChimes(n, { source, training }) · resources.spend(n) → bool
//   resources.canAfford(n) · game.on('wallet', ({ count, delta, source }) => …)   the currency (src/chimes.js)
//   resources.meets('magic:4')   a requirement (src/temples/runtime.js, src/trials/index.js): 'magic:<n>' is
//                                a bar of at least n units, anything else an item

/** The format of the res.* flags (src/save-migrate.js stamps it). */
export { RES_VERSION };

/** Hearts: how many at the start, and the most there can ever be (containers). */
export const HEARTS = { start: 3, cap: 20 };

/**
 * The magic bar, in units (one unit = one old chamber = a third of the starting bar). delay: s after the last
 * spend before it refills; fill: s from empty to full for the starting bar (rate = start / fill units a second).
 * The quick coil (item 'coil'): delay `coil.delay`, the starting bar full in `coil.fill` s.
 */
export const MAGIC = { start: 3, cap: 9, delay: 1, fill: 4, coil: { delay: 0.5, fill: 2 } };
/** Items that lengthen the bar, and by how many units each. */
export const MAGIC_ITEMS = { cell: 1 };

/** What each use of the backpack costs, in units of the bar (the jets: units a second at full throttle). */
export const MAGIC_COST = { shoot: 1, push: 1, boost: 1, shield: 1, gadget: 1, jets: 0.3 };

/**
 * The currency, chimes (docs/systems/items.md, "Chimes"): a wallet of whole chimes, at most `cap`. What the
 * foes drop and the purses are in src/chimes.js.
 */
export const CHIMES = { cap: 9999 };

/**
 * The potion: hearts back, and the drink (s: the flask to the lips and down; the hearts come at `at`); `start` in a
 * new game's pack, at most `cap` carried (the shops, src/shop.js, sell more).
 */
export const POTION = { heal: 2, time: 0.9, at: 0.45, start: 3, cap: 5 };

/**
 * The damage table, in hearts (docs/systems/foes.md, "What they do to you"). The foes' and guardians' own
 * attacks carry their value in their data (src/foes.js FOES, src/foe-kinds.js, each temple's guardian);
 * these are the baselines they are balanced against.
 */
export const DAMAGE = {
  graze: 0.25,      // a swarm's nip, a flash, a burn from slag, a first touch of spines
  blow: 0.5,        // an ordinary foe's attack: the baseline
  heavy: 0.75,      // a big foe's swing, a dive, a pounce
  crushing: 1,      // a machine's slam, a guardian's heaviest strikes
  fall: 2,          // the worst a fall that isn't fatal can take (src/player.js FALL.worst)
};

/**
 * A hurt in hearts, counted in quarters: rounded to the nearest quarter (a tie rounds down, so halving a
 * three-quarter blow gives a quarter), never less than one quarter for any hurt at all; 0 for none.
 */
export function quarters(h) {
  if (!(h > 0)) return 0;
  return Math.max(0.25, Math.round(h * 4 - 1e-9) / 4);
}

/**
 * The forgiving rule (docs/systems/foes.md): a single blow never takes you from more than one heart to
 * nothing. Above `low` hearts it leaves at least `floor` (a quarter heart); at one heart or less, a blow can
 * knock you out. Falls and the world's hurts have their own (never the last quarter, unless the fall was fatal).
 */
export const HIT = { floor: 0.25, low: 1, airborne: 1.3 };
/** The damage (hearts) a strike does to someone at `hearts`: the full bite when low, else capped to leave HIT.floor. */
export function strikeDamage(hearts, damage) {
  if (hearts <= HIT.low + 1e-9) return damage;   // already low: this one can knock you out
  return Math.min(damage, Math.max(0, hearts - HIT.floor));
}
/** A hurt that never takes the last quarter (a non-fatal fall, a drowning bite, a temple's spikes). */
export const sparing = (hearts, damage) => Math.min(damage, Math.max(0, hearts - HIT.floor));

/** The hearts someone has now (the player; a test's stand-in with only a 0..1 `health` counts as HEARTS.start). */
export function heartsOf(P) {
  if (Number.isFinite(P?.hearts)) return P.hearts;
  return (P?.health ?? 1) * (P?.maxHearts ?? HEARTS.start);
}

/** A requirement met by a set of items alone (the temple solver, src/temples/logic.js solve): 'magic:<n>' by the starting bar and the items that lengthen it. */
export function meetsWith(has, id, extra = 0) {
  const m = /^magic:(\d+(?:\.\d+)?)$/.exec(id ?? '');
  if (!m) return has(id);
  let n = MAGIC.start + extra;
  for (const [it, k] of Object.entries(MAGIC_ITEMS)) if (has(it)) n += k;
  return Math.min(MAGIC.cap, n) >= +m[1] - 1e-9;
}

const num = (v, d = 0) => (Number.isFinite(+v) && v !== null && v !== undefined && v !== '' ? +v : d);

/** The resources of the save in `state` (the game flags) and its `items`. */
export class Resources {
  constructor(state = sharedGame, itemStore = sharedItems) { this.state = state; this.items = itemStore; }
  get maxHearts() { return Math.min(HEARTS.cap, HEARTS.start + Math.max(0, Math.floor(num(this.state.flag('res.hearts.extra'))))); }
  /** The bar's length in units: the start, the items that lengthen it, and the expansions gained. */
  get maxMagic() {
    let n = MAGIC.start + Math.max(0, num(this.state.flag('res.magic.extra')));
    for (const [id, k] of Object.entries(MAGIC_ITEMS)) if (this.items.has(id)) n += k;
    return Math.min(MAGIC.cap, n);
  }
  /** How the bar refills: { delay: s after the last spend, rate: units a second }. The quick coil quickens both. */
  get magicPace() {
    const P = this.items.has('coil') ? MAGIC.coil : MAGIC;
    return { delay: P.delay, rate: MAGIC.start / P.fill };
  }
  /** Potions: how many, and whether they run out. */
  get potions() {
    const n = this.state.flag('res.potions');
    return { count: Math.max(0, Math.floor(num(n, POTION.start))), infinite: !!this.state.flag('res.potions.infinite') };
  }
  /** One potion out of the pack: false when there are none (an infinite stock always has one). */
  takePotion() {
    const p = this.potions;
    if (p.infinite) return true;
    if (p.count <= 0) return false;
    this.state.set('res.potions', p.count - 1);
    return true;
  }
  /** Potions into the pack (the shops), up to POTION.cap; returns how many went in. */
  addPotions(n = 1) {
    const was = this.potions.count, now = Math.min(Math.max(POTION.cap, was), was + Math.max(0, Math.floor(n)));
    this.state.set('res.potions', now);
    return now - was;
  }
  setPotionsInfinite(on) { this.state.set('res.potions.infinite', !!on); }
  addHeartContainer(n = 1) { this.state.set('res.hearts.extra', Math.max(0, Math.floor(num(this.state.flag('res.hearts.extra')))) + n); }
  addMagic(n = 1) { this.state.set('res.magic.extra', Math.max(0, num(this.state.flag('res.magic.extra'))) + n); }
  /** The wallet: chimes carried (whole, 0..CHIMES.cap). */
  get chimes() { return Math.min(CHIMES.cap, Math.max(0, Math.floor(num(this.state.flag('res.chimes'))))); }
  /** Chimes ever picked up in the worlds (the Arena's training gains not counted). */
  get chimesEarned() { return Math.max(0, Math.floor(num(this.state.flag('res.chimes.earned')))); }
  canAfford(n) { return Number.isFinite(+n) && +n >= 0 && this.chimes >= Math.ceil(+n); }
  /**
   * Chimes in: whole, up to CHIMES.cap (what would pass it is lost). `training` (the Arena): into the wallet, so
   * the shops can be tried there, but not counted as earned. Returns how many went in; says so ('wallet').
   */
  addChimes(n, { source = null, training = false } = {}) {
    const was = this.chimes, add = Math.max(0, Math.floor(num(n)));
    const now = Math.min(CHIMES.cap, was + add), delta = now - was;
    if (!add) return 0;
    if (delta) this.state.set('res.chimes', now);
    if (!training) this.state.set('res.chimes.earned', this.chimesEarned + add);
    if (delta) this.state.emit?.('wallet', { count: now, delta, source, training: !!training });
    return delta;
  }
  /** Pay `n` chimes (batch 3's shops): false, and nothing taken, when short (or n is not a sensible amount). */
  spend(n, { source = null } = {}) {
    const k = Math.ceil(num(n, NaN));
    if (!Number.isFinite(k) || k < 0 || !this.canAfford(k)) return false;
    if (k === 0) return true;
    const now = this.chimes - k;
    this.state.set('res.chimes', now);
    this.state.emit?.('wallet', { count: now, delta: -k, source });
    return true;
  }
  /** A requirement: 'magic:<n>' a bar of at least n units (the old "fourth chamber" is magic:4), else an item. */
  meets(id) {
    const m = /^magic:(\d+(?:\.\d+)?)$/.exec(id ?? '');
    if (m) return this.maxMagic >= +m[1] - 1e-9;
    return this.items.has(id);
  }
}

export const resources = new Resources();
