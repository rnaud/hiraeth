// One stamina for running, climbing and the swimmer's crawl (player.stamina, 0..1).
//  - Sprinting on foot (L3 / Shift) spends STAMINA.sprint a second, climbing what it always did
//    (Player.updateClimb), the front crawl SWIM.sprintCost (src/swim.js).
//  - It comes back on the ground (and afloat, not crawling) once nothing has spent it for
//    STAMINA.delay s: faster standing than walking or jogging; never in the air or on the wall.
//  - Run dry, you are winded (player.winded): no sprint, no fast climb, no new grab of a wall
//    until it is back to STAMINA.recover. On the wall it lets go, as it always did.
// The HUD's ring (index.html #stamina, main.js updateStamina) shows it while it isn't full.

export const STAMINA = {
  sprint: 0.085,     // per s of sprinting on foot: ~12 s from full
  stand: 0.42,       // per s back, standing still
  walk: 0.26,        // per s back, walking or jogging
  swim: 0.25,        // per s back, afloat (not crawling)
  delay: 0.6,        // s after the last spending before it starts coming back
  recover: 0.5,      // winded until it is back to this
  climbFast: 1.6,    // climbing fast (L3 / Shift on the wall) costs this much more
};

/** Spend `amount` of the bar (a sprint's, a climb's); run dry, the body is winded. */
export function spendStamina(P, amount) {
  if (!(amount > 0)) return P.stamina;
  P.stamina = Math.max(0, (P.stamina ?? 1) - amount);
  P._staminaRest = 0;
  if (P.stamina <= 0) P.winded = true;
  return P.stamina;
}

/** Rest for dt s at `rate` a second (after STAMINA.delay s without spending). */
export function restStamina(P, dt, rate) {
  P._staminaRest = (P._staminaRest ?? Infinity) + dt;
  if (P._staminaRest < STAMINA.delay) return P.stamina;
  P.stamina = Math.min(1, (P.stamina ?? 1) + rate * dt);
  if (P.winded && P.stamina >= STAMINA.recover) P.winded = false;
  return P.stamina;
}

/** Can the body sprint (or climb fast) now? */
export const canSprint = (P) => !P.winded && (P.stamina ?? 1) > 0;

/** Full again: a respawn, a restart, a new world. */
export function fillStamina(P) { P.stamina = 1; P.winded = false; P._staminaRest = Infinity; }
