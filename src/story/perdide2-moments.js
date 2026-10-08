import { V, UP, smooth, closeUp, facing, rightOf } from './film.js';

// Lorn II's climax, filmed (src/story/moment.js): once per save, skippable, and never in the way
// (when it can't play, perdide2.js does what it always did: the toast, the saucer blinking at once).
//
//   pools  the last dark pool lit, and an answer from across the water (perdide2.moment.pools)
//          A  wide, past the pool at him: the dark water drinks his fluid and lights up in his
//             colours, its eggs and its painted Welcome warming                            0.0–2.6
//          B  out over the deep pool, at the half-sunk saucer: it blinks back, three short,
//             one long, its thin beam going up over the wood (the world's motif swells)    2.6–5.6
//          C  behind him and above: the lit pool by him, the keepers' lamp pools warm along
//             the path, the way across the water to what answered                         5.6–7.8
//          D  his face, three-quarter, lit from the pool, turned to the light across the
//             water: the corner of his mouth goes up (a slight smirk; no line)            7.8–10.0
//          sound: the pool's chime (the caller's), the world's motif (sound.swell('motif'))
//          from the saucer as it answers; the controls come back with it still blinking
//          (it blinks till you go and see)
//
// What it shows is the caller's and applied for sure: the pool is lit before the first frame (the
// caller's light()); the saucer answers on B's beat (`answer`: perdide2.saucer.answered, its blink
// started there) and again, idempotently, at the end (a skip, a failure); the third pool's toast is
// said at the end.
//
// Show, don't tell: the traveller says nothing, and reacts with his face only (m.look 'smirk').

// s per panel; ANSWER: s into the moment the saucer blinks back; SMIRK: s into D before his mouth goes up
export const POOLS = { A: 2.6, B: 3.0, C: 2.2, D: 2.2, ANSWER: 2.75, SMIRK: 1.0 };
export const MOMENTS = [{ id: 'perdide2.pools', flag: 'perdide2.moment.pools', beat: 'the last dark pool is lit and the saucer blinks back across the water' }];

/**
 * @param deps.saucerAt  the saucer (on the water)
 */
export function setupPerdide2Moments(ctx, { saucerAt }) {
  const { player, sound, moments, toast } = ctx;
  const off = { pools: () => false };
  if (!moments || !saucerAt) return off;

  /**
   * The third pool lit (P: the caller's pool, already lit); `answer()` starts the saucer's blink
   * (idempotent), `said` is the toast. True if it plays.
   */
  function pools(P, { answer, said }) {
    const me = player.pos.clone(), c = P.c.clone();
    // from the pool, the way back to him (he shot it from up to 40 m off)
    let toMe = V(me.x - c.x, 0, me.z - c.z);
    const dMe = toMe.length();
    toMe = dMe > 0.5 ? toMe.divideScalar(dMe) : facing(player).negate();
    const side = rightOf(toMe);
    const S = saucerAt.clone();
    let toS = V(S.x - me.x, 0, S.z - me.z).normalize();
    if (!Number.isFinite(toS.x)) toS = facing(player);
    const sSide = rightOf(toS);
    // A looks at the pool with him beyond it; far off, at the pool and the way to him
    const lookA = c.clone().addScaledVector(toMe, Math.min(dMe, 8) * 0.35).addScaledVector(UP, 0.6);
    const B0 = POOLS.A, C0 = B0 + POOLS.B, D0 = C0 + POOLS.C;
    const m = moments.play({
      id: 'perdide2.pools', flag: 'perdide2.moment.pools', dur: D0 + POOLS.D,
      shots: [
        // A: past the pool, low and a little to the side, him beyond it
        { dur: POOLS.A, from: { pos: c.clone().addScaledVector(toMe, -6.2).addScaledVector(side, 2.6).addScaledVector(UP, 2.6), look: lookA, fov: 48 },
          to: { pos: c.clone().addScaledVector(toMe, -5.2).addScaledVector(side, 2.0).addScaledVector(UP, 2.2), look: lookA.clone().addScaledVector(UP, 0.15), fov: 46 } },
        // B: out over the deep pool, at the saucer as it blinks back and its beam goes up
        { dur: POOLS.B, from: { pos: S.clone().addScaledVector(toS, -26).addScaledVector(sSide, 7).addScaledVector(UP, 4.5), look: S.clone().addScaledVector(UP, 4), fov: 44 },
          to: { pos: S.clone().addScaledVector(toS, -22).addScaledVector(sSide, 5.5).addScaledVector(UP, 4.0), look: S.clone().addScaledVector(UP, 7), fov: 44 } },
        // C: behind him and above, close (the wood is dense): the lit pool by him, the lamp pools warm along
        // the path, and the way across the water to the light that answered
        { dur: POOLS.C, from: { pos: me.clone().addScaledVector(toS, -5.2).addScaledVector(sSide, 1.8).addScaledVector(UP, 3.4), look: me.clone().addScaledVector(toS, 4).addScaledVector(UP, 1.6), fov: 54 },
          to: { pos: me.clone().addScaledVector(toS, -4.5).addScaledVector(sSide, 1.5).addScaledVector(UP, 3.0), look: me.clone().addScaledVector(toS, 4).addScaledVector(UP, 2.0), fov: 52 } },
        // D: his face, turned to the light across the water
        { dur: POOLS.D, clear: false, from: closeUp(player, { angle: -0.5, dur: POOLS.D, drop: 0.12 }) },
      ],
      beats: [
        // the saucer answers (the caller's: perdide2.saucer.answered, three short, one long)
        { t: POOLS.ANSWER, run: () => { answer(); sound.swell?.('motif', S.clone()); } },
      ],
      onStart: (mm) => {
        mm.face = c.clone();
        mm.eyes = c.clone();
      },
      onFrame: (mm, t) => {
        // he watches the pool light, then turns to what answers
        if (t > B0) { mm.face = S; mm.eyes = S.clone().addScaledVector(UP, 4); }
        mm.look = t > D0 + POOLS.SMIRK ? 'smirk' : null;
      },
      onEnd: () => {
        answer();
        toast(said);
      },
    });
    return !!m;
  }

  return { pools };
}
