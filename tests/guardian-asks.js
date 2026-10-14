// A test helper (not a test): answer a guardian phase's second verb (src/temples/boss.js `asks`, v1.63 #257) the way
// play does, so a test that fights through that phase gets past it: the guardian driven until it winds up one of the
// asked moves, then the push or the splash into it (Guardian.hit), or the traveller stood in its way with the guard
// held (Player.guard) or a perfect dodge's flurry on (Player.untouchable) as it lands. Its opening is then cut short
// (back to the fight) so the test goes on as the phase did before. True when it answered.
import * as THREE from 'three';

export function answerAsks({ G, P, frame }, { keep = false, s = 90 } = {}) {
  if (!G.asking) return false;
  const A = G.phase.asks;
  const until = (fn, t) => { for (let i = 0; i < t * 60; i++) { frame(); if (fn()) return true; } return false; };
  const winding = () => G.state === 'fight' && G.attack && A.moves.includes(G.attack.id) && !G.struck;
  const stand = () => {   // (in front of it, inside the move's reach)
    const m = G.model, f = new THREE.Vector3(Math.sin(m.heading), 0, Math.cos(m.heading));
    // (a blow on its body lands only where its body reaches: just past its edge, v1.70 #319)
    const a = (G.attack && A.moves.includes(G.attack.id) ? G.attack : null) ?? G.def.attacks[A.moves[0]], d = Math.min(4, (a.range ?? a.radius ?? 4) * 0.5, a.parts ? (m.radius ?? 3) + 0.4 : Infinity);
    P.teleport(m.pos.clone().addScaledVector(f, d).setY(G.arena.y + 0.2), new THREE.Vector3(0, 1, 0), f.clone().negate());
    P.vel?.set(0, 0, 0);
  };
  const guard = P.guard, untouchable = P.untouchable, from = P.pos.clone();
  // (its other moves pass him by while he waits, as a player keeping clear would: knocked down, nothing reaches him)
  const asked = () => !!G.attack && A.moves.includes(G.attack.id);
  if (A.verb === 'parry') P.guard = () => 'perfect';
  P.untouchable = () => A.verb === 'dodge' || !asked();
  let ok = false;
  try {
    for (let k = 0; k < 8 && !ok; k++) {
      // (a blow already on its way as this began may answer it: a front still running, v1.70)
      if (!until(() => { if (!G.attack) stand(); return winding() || !G.asking; }, s / 8)) continue;   // (near it, so a close move comes)
      if (!G.asking) { ok = true; continue; }
      if (A.verb === 'push' || A.verb === 'shot') { ok = G.hit('body', A.verb === 'push' ? 'push' : 'shoot', null, {}) && !G.asking; continue; }
      // (the guard or the dodge: stood in its way, through to the blow)
      while (winding()) { stand(); frame(); }
      // (a blow that runs on after it strikes, a front or a beam's sweep, or lands with its body: through its live window)
      for (let i = 0; i < 90 && G.live && G.asking; i++) frame();
      ok = !G.asking;
    }
  } finally {
    P.guard = guard; P.untouchable = untouchable;
    P.teleport(from, new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1)); P.vel?.set(0, 0, 0);   // (back where the test had him)
  }
  if (ok && !keep && G.state === 'open') { G.enter('fight'); G.cool = 0.3; }
  return ok;
}
