import { V, UP, smooth, closeUp, facing, rightOf } from './film.js';

// The City-Shaft's climax, filmed (src/story/moment.js): the splinter given back from the palace's
// crown, and the Lodestar lit again over the shaft. Once per save, skippable, and never in the way
// (when it can't play, incal.js frames it as it always did: its own slow look up, st.cine).
//
//   lodestar  the splinter climbs home and the Lodestar burns again (incal.moment.lodestar)
//             A  low behind his shoulder on the crown, looking up: the splinter leaves his
//                hand and climbs, singing, the dim light far above                         0.0–2.4
//             B  wide and low from out beside the dome, up past the crown: the splinter
//                reaches the Lodestar and it flares (incal.js arrive, at 3.6 s)            2.4–5.0
//             C  across the shaft at its wall: the billboards have stopped selling, LOOK UP
//                on them in light, the terraces round them warmer                          5.0–6.8
//             D  the traveller's face, three-quarter from below, lit from above, looking up:
//                the corner of his mouth goes up (a slight smirk; no line)                 6.8–9.0
//             sound: the splinter's whoosh as it goes, the chime as it lands, the world's
//             motif swelling over the score as the light flares (sound.swell('motif'))
//
// The light is incal.js's: the splinter's climb (3.6 s) and the light easing up after it (st.k, a slow
// rise) run on their own clocks, so the controls come back while the Lodestar is still brightening and
// its flare still fading. A skip lands the splinter at once (land(): the flare, the city looking up).
// What arrive() says waits for the end (told(), st.filming).
//
// Show, don't tell: he says nothing (m.look 'smirk' at most; src/talk-face.js).

export const MOMENTS = [
  { id: 'incal.lodestar', flag: 'incal.moment.lodestar', beat: 'the Lodestar lights again over the shaft' },
];

// ARRIVE: when the splinter reaches the light (incal.js: its climb takes 3.6 s); SMIRK: s into the face's panel
export const LODESTAR = { A: 2.4, B: 2.6, C: 1.8, D: 2.2, ARRIVE: 3.6, SMIRK: 1.0 };

export function setupIncalMoments(ctx, { st, splinter, incalPos, land, told, P, S }) {
  const { player, sound, moments, toast, physics } = ctx;
  const off = { lodestar: () => false };
  if (!moments || !splinter) return off;
  const [def] = MOMENTS;
  const PY = P.palace.y;

  /**
   * The wall C frames: a billboard seen from out in the open shaft (`r` from the axis), the first one, by
   * how near the upper levels it hangs, with nothing between it and the lens (physics.rayDistance).
   */
  const wall = (r = 175) => {
    // (incal.js writes LOOK UP on two in three, ONCE A DAY on every third: LOOK UP first)
    const bs = (S.billboards ?? []).map((b, i) => ({ b, once: i % 3 === 2 })).filter(({ b }) => Math.hypot(b.pos.x, b.pos.z) > r + 40)
      .sort((a, c) => a.once - c.once || Math.abs(a.b.pos.y - 140) - Math.abs(c.b.pos.y - 140));
    for (const { b } of bs) {
      const n = V(0, 0, 1).applyQuaternion(b.quat).setY(0).normalize(), side = rightOf(n);
      const at = b.pos.clone(), d = Math.hypot(at.x, at.z) - r;
      const lens = at.clone().addScaledVector(n, d).addScaledVector(side, 6).addScaledVector(UP, 12);
      const start = at.clone().addScaledVector(n, 1.2), dir = lens.clone().sub(start), len = dir.length();
      dir.divideScalar(len);
      const hit = physics?.rayDistance ? physics.rayDistance(start, dir, len) : Infinity;
      if (!(hit < len - 0.5)) return { at, n, side, lens };
    }
    return null;
  };

  function lodestar() {
    const P0 = player.pos.clone(), f = facing(player);
    const light = incalPos();
    const head = P0.clone().addScaledVector(UP, 1.7);
    // A: low at his shoulder on the outer side (the needle, on the axis, stays behind him), the eye on the
    // splinter as it climbs (eased: no jerk)
    const outward = Math.hypot(P0.x, P0.z) > 1.5 ? V(P0.x, 0, P0.z).normalize() : f.clone().negate();
    const aAt = P0.clone().addScaledVector(outward, 4.6).addScaledVector(rightOf(outward), 1.6).addScaledVector(UP, 0.5);
    const pan = { t: -1, look: V(0, 0, 0) };
    const follow = (t) => {
      const want = splinter.visible ? splinter.position.clone() : light.clone();
      // (never straight up: the frame keeps his head and shoulder at its foot)
      want.lerp(head, 0.6 - 0.25 * smooth(t / LODESTAR.A));
      if (pan.t < 0 || t < pan.t) pan.look.copy(head.clone().addScaledVector(UP, 2)); else pan.look.lerp(want, 1 - Math.exp(-4 * (t - pan.t)));
      pan.t = t;
      return pan.look.clone();
    };
    const W = wall();
    const cFrom = W ? { pos: W.lens, look: W.at.clone().addScaledVector(UP, 1), fov: 26 } : null;
    const cTo = W ? { pos: W.lens.clone().lerp(W.at, 0.12), look: W.at.clone().addScaledVector(UP, 1.6), fov: 25 } : null;
    const m = moments.play({
      ...def, dur: LODESTAR.A + LODESTAR.B + LODESTAR.C + LODESTAR.D,
      shots: [
        // A: over his shoulder, looking up as it leaves his hand
        { dur: LODESTAR.A, ease: 'linear', clear: false, from: (t) => ({ pos: aAt.clone().addScaledVector(UP, -0.25 * smooth(t / LODESTAR.A)), look: follow(t), fov: 58 }) },
        // B: out beside the dome on the open side, low, up past the crown to the light (as incal.js's own look up)
        { dur: LODESTAR.B, clear: false, from: { pos: V(100, PY + 4, 34), look: V(0, PY + 92, 0), fov: 56 }, to: { pos: V(97, PY + 6, 33), look: V(0, PY + 98, 0), fov: 54 } },
        // C: across the shaft at its wall, the billboards saying LOOK UP (or, with none, the light again from below)
        cFrom ? { dur: LODESTAR.C, clear: false, from: cFrom, to: cTo }
          : { dur: LODESTAR.C, clear: false, from: { pos: V(0, PY - 140, 120), look: light, fov: 40 } },
        // D: his face, from a little below, looking up into the light
        { dur: LODESTAR.D, clear: false, from: closeUp(player, { angle: 0.6, dur: LODESTAR.D, drop: 0.22, dist: 1.35 }) },
      ],
      beats: [
        { t: LODESTAR.ARRIVE + 0.05, run: () => sound.swell?.('motif', light.clone()) },
      ],
      onStart: (mm) => {
        st.filming = true;
        st.cine = null;   // (the old framing gives way to the panels)
        mm.eyes = splinter.position;
      },
      onFrame: (mm, t) => {
        // he watches it go, then the light
        mm.eyes = st.release && splinter.visible ? splinter.position : light;
        mm.look = t > LODESTAR.A + LODESTAR.B + LODESTAR.C + LODESTAR.SMIRK ? 'smirk' : null;
      },
      onEnd: () => {
        st.filming = false;
        land();   // (skipped mid-climb: home at once)
        const later = st.toldLater ?? [];
        st.toldLater = [];
        for (const t of later) (told ?? toast)(t);
      },
    });
    return !!m;
  }

  return { lodestar };
}
