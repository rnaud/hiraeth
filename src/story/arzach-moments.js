import { V, UP, smooth, closeUp, facing, rightOf } from './film.js';

// Vael's first time, filmed (src/story/moment.js): once per save, skippable, and never in the way
// (when it can't play, arzach.js does what it always did: she comes down from the far haze).
//
//   bird  the rider's flute is played and the bird comes down for the first time, and bows
//         (arzach.moment.bird)
//         A  wide, low behind him and off his side: him at the edge of the frame by the
//            room's window, the haze where the call goes; far out a speck answers (her cry) 0.0–2.4
//         B  a long lens from beside him, up into the haze: she comes down out of it,
//            wings wide, growing, the pan following her in (the world's motif swells)    2.4–6.0
//         C  his face, three-quarter, turned to where she comes down: her cry as she
//            lands; he watches, and the corner of his mouth goes up                     6.0–8.2
//         D  from out past her, high: she lowers her long neck to him and opens her
//            wings, him above her (on the sill) or before her (on the plain); the
//            controls come back with her still bowed in front of you                    8.2–10.2
//         sound: the flute (played by the caller), a far cry, the world's motif
//         (sound.swell('motif')), her cry as she lands (the caller's)
//
// What it shows is the caller's, and runs on its own: she is called and flies in (bird.summon),
// lands and bows (arzach.js update), and the promise is kept when the bow ends. The moment only
// brings her start in nearer (so she lands on its third panel) and makes her first bow longer (so
// it is still deep when you get the controls back); a skip puts the bow back to its own length.
// The flute's toast is said at its end.
//
// Show, don't tell: the traveller says nothing, and reacts with his face only (m.look 'smirk').

// s per panel; FROM: m out (and UP m up) she starts, so she lands near C's start;
// BOW: her first bow's length (s; else 4.2); SMIRK: s into C before his mouth goes up
export const BIRD = { A: 2.4, B: 3.6, C: 2.2, D: 2.0, FROM: 200, UP: 120, BOW: 5.6, cryAt: 1.7, swellAt: 2.4, SMIRK: 1.0 };
export const MOMENTS = [{ id: 'arzach.bird', flag: 'arzach.moment.bird', beat: 'the bird comes down out of the haze and bows' }];

export function setupArzachMoments(ctx, { bird, bow, cry, bowNow, tower = null }) {
  const { player, sound, moments, toast, physics } = ctx;
  const off = { bird: () => false };
  if (!moments || !bird) return off;

  /** Her head, about (the neck's tip in her body's frame: src/bird.js). */
  const headOf = (out = V(0, 0, 0)) => out.set(Math.sin(bird.heading), 0, Math.cos(bird.heading)).multiplyScalar(2.2).add(bird.pos).addScaledVector(UP, 1.5);

  /**
   * She comes down to `land` (where the caller summons her); `said` is the flute's toast.
   * Call before bird.summon: it sets where she starts from. True if it plays.
   */
  function comeDown({ land, said }) {
    const P = player.pos.clone();
    // the way she comes: from out beyond where she lands (off the tower's rim, or past you on the plain)
    let out = V(land.x - P.x, 0, land.z - P.z);
    if (out.lengthSq() < 1) out = facing(player);
    out.normalize();
    // (the side of him away from the lone tower's room, when he plays it up there: the lens stays out of its walls)
    const flatTo = (p, q) => Math.hypot(p.x - q.x, p.z - q.z);
    const awayFrom = (dir) => { const s = rightOf(dir); return tower && flatTo(P.clone().add(s), tower) < flatTo(P.clone().sub(s), tower) ? s.negate() : s; };
    const away = awayFrom(out);
    const start = land.clone().addScaledVector(out, BIRD.FROM).addScaledVector(UP, BIRD.UP);
    const eye = P.clone().addScaledVector(UP, 1.6);
    const B0 = BIRD.A, C0 = B0 + BIRD.B, D0 = C0 + BIRD.C;
    // B's lens: beside and a little behind him, low, looking up past his shoulder at her (the pan eased)
    const pan = { t: 0, look: null }, D = { side: null };
    const m = moments.play({
      id: 'arzach.bird', flag: 'arzach.moment.bird', dur: D0 + BIRD.D,
      shots: [
        // A: wide, behind him and off his side, low: him to one side of the frame, the haze she will come out of filling it
        { dur: BIRD.A, from: { pos: eye.clone().addScaledVector(away, 5).addScaledVector(out, -6.5).addScaledVector(UP, -1.2), look: eye.clone().addScaledVector(out, 10).addScaledVector(UP, 3), fov: 50 },
          to: { pos: eye.clone().addScaledVector(away, 4.6).addScaledVector(out, -5.8).addScaledVector(UP, -1.0), look: eye.clone().addScaledVector(out, 10).addScaledVector(UP, 3.6), fov: 48 } },
        // B: the long lens up at her, following her down out of the haze
        { dur: BIRD.B, ease: 'linear', clear: false,
          from: (t) => {
            const want = bird.pos.clone();
            const dt = Math.max(0, t - pan.t); pan.t = t;
            if (!pan.look) pan.look = want; else pan.look.lerp(want, 1 - Math.exp(-6 * dt));
            const k = smooth(t / BIRD.B);
            return { pos: eye.clone().addScaledVector(out, -2.2).addScaledVector(away, 1.3).addScaledVector(UP, -0.35), look: pan.look.clone(), fov: 30 + 14 * k };
          } },
        // C: his face, turned to where she comes down
        { dur: BIRD.C, clear: false, from: closeUp(player, { angle: -0.55, dur: BIRD.C }) },
        // D: the two of them, as she bows to him, her wings open
        { dur: BIRD.D, from: (t) => {
          const k = smooth(t / BIRD.D), h = headOf();
          const to = V(bird.pos.x - P.x, 0, bird.pos.z - P.z);
          const f = to.lengthSq() > 0.5 ? to.normalize() : out;
          const sep = eye.distanceTo(h), over = eye.y - h.y;
          if (over > 2) {
            // up on the tower, above her: from out past her and high, clear of her wings (open air beyond the balcony's rim)
            const r = awayFrom(f), mid = eye.clone().lerp(h, 0.72);
            return { pos: h.clone().addScaledVector(f, 8 + 0.8 * sep - 1.2 * k).addScaledVector(r, 5).addScaledVector(UP, 1.6 + 0.65 * over), look: mid.addScaledVector(UP, -0.6), fov: 50 };
          }
          // level with her on the plain: side-on, her bowed neck and his face across the frame (the clearer side)
          const mid = eye.clone().lerp(h, 0.5);
          if (!D.side) {
            const r = rightOf(f), ray = (d) => physics?.rayDistance?.(mid, d, 12) ?? Infinity;
            D.side = ray(r) >= ray(r.clone().negate()) ? r : r.negate();
          }
          return { pos: mid.clone().addScaledVector(D.side, 9.5 - 0.8 * k).addScaledVector(f, -1.5).addScaledVector(UP, 0.9), look: mid.addScaledVector(UP, -0.5), fov: 46 };
        } },
      ],
      beats: [
        { t: BIRD.cryAt, run: () => cry?.(0.85) },
        { t: BIRD.swellAt, run: () => sound.swell?.('motif', land.clone()) },
        // (she should have landed and begun her bow by now: if she hasn't, she bows where she is)
        { t: D0, run: () => bowNow?.() },
      ],
      onStart: (mm) => {
        // her start, nearer: she lands as the third panel begins
        bird.pos.copy(start);
        bow.len = BIRD.BOW;
        mm.face = land.clone();
        mm.eyes = bird.pos;
      },
      onFrame: (mm, t) => {
        mm.eyes = t < D0 ? bird.pos : headOf();
        mm.look = t > C0 + BIRD.SMIRK ? 'smirk' : null;
      },
      onEnd: (mm, skipped) => {
        // skipped before her bow: it keeps its own length
        if (skipped && bow.t <= 0) bow.len = undefined;
        toast(said);
      },
    });
    return !!m;
  }

  return { bird: comeDown };
}
