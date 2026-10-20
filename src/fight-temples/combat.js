// Temporary fight-temple rules. Restore the original methods when the run ends;
// none of these rewards changes the save or combat outside the hall.
export const TEMPLE_COMBAT = { rollBright: 3, eliteBonus: 2, refillDelay: 0.8, refillRate: 1 };

export function templeCombat({ blade, foes, reserve, active, contains, reward }) {
  const roll = blade?.onRollDodge, hurt = foes?.hurt;
  if (blade) blade.onRollDodge = function (...args) {
    roll?.apply(this, args);
    if (!active()) return;
    if (reserve) reserve.level = Math.min(reserve.max, reserve.level + 1);
    reward();
  };
  if (hurt) foes.hurt = function (foe, mode, dir, info, point) {
    if (active() && contains(foe) && foe.gorged && mode === 'blade' && (info?.charged || info?.riposte)) {
      info = { ...info, damage: (info.damage ?? 1) + TEMPLE_COMBAT.eliteBonus };
    }
    return hurt.call(this, foe, mode, dir, info, point);
  };
  return () => {
    if (blade) { if (roll === undefined) delete blade.onRollDodge; else blade.onRollDodge = roll; }
    if (hurt) foes.hurt = hurt;
  };
}
