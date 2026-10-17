// The grappling hook on a foe (issue #399; docs/systems/gadgets.md, "The hook on a foe"). Locked on (R3, Tab), RT / R2
// throws the hook at the locked foe (with the hook in hand, or nothing in hand: src/gadgets/index.js); an aimed throw that
// catches a foe does the same. What it does depends on the foe's size and weight, a class in its data (`hook` on each
// kind: src/enemies/archetypes.js, src/foes.js), never on its name:
//   light     yanked to the traveller: a short arc, landing in front of him, dazed (a cut lands double)
//   heavy     pinned: held where it stands HOOK_FOE.pin s, the rope taut, the body straining against it
//   flyer     pulled down out of the air, dazed near the ground
//   armoured  the hook clanks off
// and by the moment: a buried or running-shadow foe is missed, a rolled-up or shelled front clanks it off, a guardian
// shrugs it off (it bites, the rope snaps taut and is thrown loose). A cooldown between catches; a reach; and the line
// from the glove to the foe must be clear of the world (a wall takes the hook).
// Pure: tests/hook-foes.test.js.

export const HOOK_FOE = {
  range: 16,       // m from the glove to the foe's body: further, the hook falls short
  cool: 2.6,       // s between catches (the chip's ring fills meanwhile)
  yank: 0.42,      // s the yank's arc takes at most (shorter close in: yankTime)
  yankSpeed: 26,   // m/s along the arc
  lift: [0.3, 1.3, 0.16],   // m the arc rises at its middle: a share of the way (0.16 a metre), 0.3 to 1.3 m (yankLift)
  before: 1.25,    // m from the traveller to where a yanked foe lands (and its own radius)
  daze: 1.1,       // s dazed once landed (and pulled down): a cut lands double
  pin: 1.8,        // s a heavy foe is held
  down: 1.4,       // s a flyer stays down
  stop: { yank: 0.05, pin: 0.08, down: 0.06 },   // s of hit-stop on the catch
  kick: { yank: 0.25, pin: 0.35, down: 0.3 },    // the camera's nudge on the catch
};

export const HOOK_CLASSES = ['light', 'heavy', 'flyer', 'armoured'];

/** A kind's class (its data's `hook`); a kind without one is judged by its body (a flyer, heavy, else light). */
export function hookClass(def = {}) {
  if (HOOK_CLASSES.includes(def.hook)) return def.hook;
  return def.hover ? 'flyer' : def.heavy ? 'heavy' : 'light';
}

/**
 * What the hook does to foe `f` it reaches (a Foe, or a guardian's GuardianLock): 'yank' | 'pin' | 'down' | 'clank' |
 * 'miss' | 'shrug' | 'none' (gone). `dir`: the hook's way, from the traveller to it (a blow's, as Foe.frontal takes it:
 * a shell faced clanks it off).
 */
export function hookOutcome(f, dir = null) {
  if (!f || f.alive === false || f.dying) return 'none';
  if (f.guardian) return 'shrug';
  if (f.buried || f.phased) return 'miss';
  if (f.rolling) return 'clank';
  if (f.shelled && !(f.flipped > 0) && dir && f.frontal?.(dir)) return 'clank';
  const c = hookClass(f.def);
  return c === 'armoured' ? 'clank' : c === 'heavy' ? 'pin' : c === 'flyer' ? 'down' : 'yank';
}

/** May the locked throw go: 'cool' (catching again too soon), 'far' (past its reach: it falls short), 'blocked' (the world in the way), 'ok'. */
export function lockShot({ d, blocked = false, cool = 0, range = HOOK_FOE.range } = {}) {
  if (cool > 0) return 'cool';
  if (!(d <= range)) return 'far';
  if (blocked) return 'blocked';
  return 'ok';
}

/** How high a yank of d metres (the foe's way to the traveller) arcs at its middle (m). */
export const yankLift = (d, [lo, hi, k] = HOOK_FOE.lift) => Math.min(hi, Math.max(lo, d * k));

/** How long a yank of d metres takes (s). */
export const yankTime = (d) => Math.min(HOOK_FOE.yank, Math.max(0.18, d / HOOK_FOE.yankSpeed));

/**
 * The lesson for a lock just taken (R3, Tab; main.js and engine/combat.js): the hops first ('hint.hop'), then, with the
 * hook owned, the hook on a foe ('hint.hookLock'); each once. taught(key) → bool.
 */
export function lockLesson({ taught = () => false, hook = false } = {}) {
  if (!taught('hint.hop')) return 'hint.hop';
  if (hook && !taught('hint.hookLock')) return 'hint.hookLock';
  return null;
}
