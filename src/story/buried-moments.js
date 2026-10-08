import { V, UP, closeUp } from './film.js';

// The Buried Machine's climax, filmed (src/story/moment.js): once per save, skippable, and
// never in the way (when it can't play, buried.js turns the wheel as it always did).
//
//   wheel  the Wick is lit and the traveller stands before the great wheel: it turns one tooth,
//          and goes on turning (buried.moment.wheel)
//          A  wide, low behind the traveller: the wheel's arc stands out of the dune over
//             him; it creaks back, then lurches (the world's motif swells on the lurch)   0.0–2.3
//          B  low on the sand where the teeth come up out of the dune, along the rim: the
//             iron climbs out of the sand, the sand pouring off it                         2.3–4.9
//          C  far out on the dunes beyond it: the wheel small on the horizon, and high over it
//             the hanging city rocking like a cradle                                       4.9–7.2
//          D  his face, three-quarter, turned to the wheel: he watches, and the corner of
//             his mouth goes up (a slight smirk; no line)                                 7.2–9.4
//          Control comes back while it is still happening: the tooth has just gone round
//          (buried.js finishTurn, at TURN_TIME = 7 s), the sand is still sliding off into its
//          hollow (till 10 s) and the wheel eases up to its endless turn.
//
// What it shows is applied for sure: the turn starts as the moment starts (on its own clock,
// buried.js st.turning) and again in onEnd if it somehow didn't (a failure); a skip only cuts
// the film, the wheel goes on. The toasts of the turn (its start, the tooth) are said at the end.
//
// Show, don't tell: the traveller says nothing, and reacts with his face only, a slight smirk
// at most (m.look 'smirk': worn quietly, no mouth and no hands; src/talk-face.js).

export const MOMENTS = [{ id: 'buried.wheel', flag: 'buried.moment.wheel', beat: 'the great wheel turns, and goes on turning' }];

// SMIRK: s into the face's panel before the corner of his mouth goes up; LURCH: when the turn's
// creak back gives way to the heavy lurch forward (buried.js: 0.15 of TURN_TIME)
export const WHEEL = { A: 2.3, B: 2.6, C: 2.3, D: 2.2, LURCH: 1.05, SMIRK: 1.0 };

const flatDist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

/**
 * @param ctx  the world's ctx (player, sound, toast)
 * @param o    { W (level.buried.wheel), st (the story's state), moments, startTurn(), turned(), city (level.buried.city), watchAt }
 * @returns    { wheel(): true if it plays }
 */
export function setupBuriedMoments(ctx, { W, st, moments, startTurn, turned, city, watchAt }) {
  const { player, sound, toast, level } = ctx;
  /** Keep a lens above the sand (it only sinks from here on, as the sand slides off). */
  const above = (p, h = 1.4) => { const g = level?.ground?.heightAt?.(p.x, p.z); if (Number.isFinite(g) && p.y < g + h) p.y = g + h; return p; };
  const off = { wheel: () => false };
  if (!moments || !W) return off;

  function wheel() {
    const def = MOMENTS[0];
    const c = W.centre.clone();
    const F = V(W.face.x, 0, W.face.z).normalize(), across = V(F.z, 0, -F.x);
    // where he watches from: his own spot, unless he's on the wheel itself (then the watching place before it)
    const anchor = flatDist(player.pos, c) > W.R * 0.7 ? player.pos.clone() : watchAt.clone();
    const toP = V(anchor.x - c.x, 0, anchor.z - c.z).normalize();
    const faceSide = Math.sign(toP.dot(F)) || 1;
    const arc = V(c.x, W.top - 13, c.z);
    // A: low behind him and to one side, looking past him up at the arc
    const sideA = Math.sign(toP.dot(across)) || 1;
    const aPos = above(anchor.clone().addScaledVector(toP, 9).addScaledVector(across, sideA * 4.5).addScaledVector(UP, 1.8));
    const aLook = anchor.clone().addScaledVector(toP, -20).addScaledVector(UP, 7.5);
    // B: where the teeth come up out of the sand, on his side of the wheel
    const depth = W.ground - c.y, along = Math.sqrt(Math.max(0, (W.R + 2) ** 2 - depth * depth));
    const E = c.clone().addScaledVector(across, sideA * along); E.y = W.ground;
    const bPos = above(E.clone().addScaledVector(F, faceSide * 24).addScaledVector(across, sideA * 9).addScaledVector(UP, 3), 2);
    const bLook = E.clone().addScaledVector(across, -sideA * 10).addScaledVector(UP, 6);
    // C: far out on the dunes beyond the wheel, from the city's other side: the wheel small on the
    // horizon, and over it, high up, the hanging city rocking
    const cityAt = city ? city.getWorldPosition(V(0, 0, 0)) : c.clone().addScaledVector(UP, 500);
    const away = V(c.x - cityAt.x, 0, c.z - cityAt.z);
    if (away.lengthSq() < 1) away.copy(F).negate();
    away.normalize();
    const cPos = above(c.clone().addScaledVector(away, 250).addScaledVector(across, 20), 18);
    const cLook = cPos.clone().addScaledVector(away, -100).addScaledVector(UP, 50);
    let held = null;
    const m = moments.play({
      id: def.id, flag: def.flag, dur: WHEEL.A + WHEEL.B + WHEEL.C + WHEEL.D,
      shots: [
        // (no pulling in on these: what they look at is the wheel itself, which would stop the ray at once)
        { dur: WHEEL.A, clear: false, from: { pos: aPos, look: aLook, fov: 52 }, to: { pos: aPos.clone().addScaledVector(toP, -1.6).addScaledVector(UP, 0.5), look: aLook.clone().addScaledVector(UP, 1.5), fov: 48 } },
        { dur: WHEEL.B, clear: false, ease: 'out', from: { pos: bPos, look: bLook, fov: 44 }, to: { pos: bPos.clone().addScaledVector(F, -faceSide * 2.5).addScaledVector(UP, 0.6), look: bLook.clone().addScaledVector(UP, 3), fov: 42 } },
        { dur: WHEEL.C, clear: false, from: { pos: cPos, look: cLook, fov: 62 }, to: { pos: cPos.clone().addScaledVector(away, -6), look: cLook.clone().addScaledVector(UP, 6), fov: 58 } },
        { dur: WHEEL.D, clear: false, from: closeUp(player, { angle: 0.55, dur: WHEEL.D, drop: 0.1 }) },
      ],
      beats: [
        { t: WHEEL.LURCH, run: () => sound.swell?.('motif', arc.clone()) },
      ],
      onStart: (mm) => {
        held = [];
        st.heldToasts = held;   // (buried.js says the turn's toasts here, for the end)
        startTurn();
        mm.face = c.clone().setY(anchor.y);
        mm.eyes = arc;
      },
      onFrame: (mm, t) => {
        const D0 = WHEEL.A + WHEEL.B + WHEEL.C;
        mm.eyes = t < WHEEL.A + WHEEL.B ? arc : V(c.x, W.top - 4, c.z);
        mm.look = t > D0 + WHEEL.SMIRK ? 'smirk' : null;
      },
      onEnd: () => {
        if (st.heldToasts === held) st.heldToasts = null;
        if (!st.turning && !turned()) startTurn();   // (it turns, film or no film)
        for (const t of held ?? []) toast(t);
        held = null;
      },
    });
    // (a start that failed: buried.js does it all itself; nothing of ours may hold its toasts)
    if (!m && st.heldToasts === held) { st.heldToasts = null; for (const t of held ?? []) toast(t); }
    return !!m;
  }

  return { wheel };
}
