// A shot sent back at its shooter (issue #766, the author: "Me deflecting projectiles shouldn't stun the enemy";
// docs/systems/foes.md "Shots sent back"). One rule for every shot a foe fires or throws from afar: the mummers' and
// grunts' arrows and rocks, the blots' and toads' spit, the brute's slab, the worm's spit stones, the tripod's and the
// oracle's bolts, the ember wisp's fireball.
//
// - A plain guard stops it at the shield. Nothing happens to the shooter, which is metres away: it is not staggered,
//   shoved or opened as a foe whose blow you blocked at arm's length is (src/foes.js Foes.strike).
// - A perfect parry (and for the fireball, a cut timed as it arrives) sends it back: it hurts its shooter `damage`
//   (a cut's units, 'world' harm: no poise worn, src/enemies/fight.js poiseWear) and the shooter flinches, a short
//   reel (`flinch`: its def.hit s, its wind-up lost). Never stunned, never knocked down, never its guard broken.
//
// A harpoon's or a root's line is not a shot (its line is cut, the drone dazed: onParry 'cut'), nor a blow struck from
// arm's length.

/** A returned shot: its harm to the shooter (cut units) and the reel it causes (the hit-reaction's name). */
export const RETURN = { damage: 1.5, reel: 'flinch' };

/** Is attack `a` a shot (fired or thrown from afar: a lob, the fireball, a bolt, a bow's arrow, attack.shot)? (pure: tests) */
export const isShot = (a) => !!a && (!!a.lob || !!a.ball || !!a.shot || a.onParry === 'reflect' || a.weapon === 'bow');

/** What a returned shot hands Foes.hurt: 'world' harm of RETURN.damage, a flinch, no stun (pure: tests). */
export const returnedBlow = (R = RETURN) => ({ damage: R.damage, source: 'returned', flinch: true, reel: R.reel });
