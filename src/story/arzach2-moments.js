import { V, UP, closeUp } from './film.js';

// Vael II's first time, filmed (src/story/moment.js): once per save, skippable, and never in the way
// (when it can't play, arzach2.js does what it always did: the bell rings at once, the cloud settles).
//
//   bell  the rope is pulled and the bell rings after thirty years (arzach2.moment.bell)
//         A  wide, out over the cliff's edge: the white monastery on the rose cliff over the
//            sea of cloud, the bell tower, the traveller small at the rope's foot; he pulls,
//            and the first note goes out                                                 0.0–2.4
//         B  level with the open belfry, through its arch: the bell swings on its yoke and
//            tolls, the father's theme swelling under it                                  2.4–5.0
//         C  from the cliff's lip, out and down across the sea of cloud to the start plateau
//            and its aqueduct: the cloud settles, its puffs going down round the piers      5.0–7.6
//         D  his face, three-quarter, turned out over the cloud: he listens, and the corner
//            of his mouth goes up; the controls come back with the bell still tolling and
//            the cloud still going down                                                  7.6–9.8
//         sound: the bell's tolls (the caller's ring), the father's theme in the world's mode
//         (sound.swell('father'): the bell recalls the harbour bell at home)
//
// What it shows is the caller's, applied for sure: the bell's flag is set before it plays; the
// ring comes on a beat (the pull, seen first) and at its end if that beat never came; the cloud
// waits for the bell to be heard (bell.hold) and then settles a little quicker than its own twelve
// seconds (bell.settleFor), on its own clock, so it goes on settling after the controls come back.
// The toast and the monks' shouts are said at its end (and the shouts on the ring's beat).
//
// Show, don't tell: the traveller says nothing, and reacts with his face only (m.look 'smirk').

// s per panel; RING: the pull's beat; SETTLE: s after the start the cloud begins to settle, and
// SETTLE_FOR: how long it takes then; OUT: the way out over the cloud from the rope (radians,
// 0 = +z: the open side toward the start plateau); SMIRK: s into D before his mouth goes up
export const BELL = { A: 2.4, B: 2.6, C: 2.6, D: 2.2, RING: 0.6, SETTLE: 3.4, SETTLE_FOR: 8, OUT: 1.05, swellAt: 2.4, SMIRK: 0.9 };
export const MOMENTS = [{ id: 'arzach2.bell', flag: 'arzach2.moment.bell', beat: 'the bell rings after thirty years and the cloud settles' }];

export function setupArzach2Moments(ctx, { A, bell, ring }) {
  const { player, sound, moments, toast } = ctx;
  const off = { bell: () => false };
  if (!moments || !A?.bell) return off;

  /** The bell rings for the first time: `said` its toast, `shout()` the monks' cries. True if it plays. */
  function rings({ said, shout }) {
    const out = V(Math.sin(BELL.OUT), 0, Math.cos(BELL.OUT));
    const side = V(-out.z, 0, out.x);
    const rope = A.ropeFoot.clone(), T = A.bellTower;
    const bellAt = A.bell.position.clone().addScaledVector(UP, -1.6);   // (the bell's waist: it hangs from its yoke)
    const far = rope.clone().addScaledVector(out, 60).setY(rope.y + 0.6);
    // about the cloud sea's top (its puffs stand well over the deck)
    const cloudTop = (A.cloudY ?? -36) + 30;
    const B0 = BELL.A, C0 = B0 + BELL.B, D0 = C0 + BELL.C;
    let rang = false;
    const doRing = () => { if (rang) return; rang = true; ring(); shout?.(); };
    const m = moments.play({
      id: 'arzach2.bell', flag: 'arzach2.moment.bell', dur: D0 + BELL.D,
      shots: [
        // A: wide, out over the cliff's edge, the tower and him at its foot (its look on the rope's face: inside the tower the lens would be pulled in)
        { dur: BELL.A, from: { pos: rope.clone().addScaledVector(out, 118).addScaledVector(side, -14).addScaledVector(UP, 10), look: rope.clone().addScaledVector(UP, 7), fov: 44 },
          to: { pos: rope.clone().addScaledVector(out, 112).addScaledVector(side, -13).addScaledVector(UP, 11), look: rope.clone().addScaledVector(UP, 8), fov: 42 } },
        // B: level with the belfry, through its arch (across the swing): the bell on its yoke
        { dur: BELL.B, clear: false, from: { pos: bellAt.clone().add(V(10.5, -0.6, 0.4)), look: bellAt.clone(), fov: 38 }, to: { pos: bellAt.clone().add(V(9.4, -0.5, 0.3)), look: bellAt.clone(), fov: 36 } },
        // C: from the cliff's lip (60° round from the rope: open ground to the edge, 100 m), out and down over the cloud as it goes down
        // (clear: false: looking that far, the pull-in would catch a needle and drop the lens into the cloud)
        { dur: BELL.C, clear: false, from: { pos: rope.clone().addScaledVector(out, 96).addScaledVector(side, -6).addScaledVector(UP, 7), look: rope.clone().addScaledVector(out, 290).addScaledVector(side, 30).setY(cloudTop - 16), fov: 56 },
          to: { pos: rope.clone().addScaledVector(out, 99).addScaledVector(side, -5).addScaledVector(UP, 6), look: rope.clone().addScaledVector(out, 290).addScaledVector(side, 33).setY(cloudTop - 22), fov: 56 } },
        // D: his face, turned out over the cloud
        { dur: BELL.D, clear: false, from: closeUp(player, { angle: 0.5, dur: BELL.D }) },
      ],
      beats: [
        { t: BELL.RING, run: doRing },
        { t: BELL.swellAt, run: () => sound.swell?.('father', bellAt.clone()) },
        { t: BELL.SETTLE, run: () => { bell.hold = false; bell.settleFor = BELL.SETTLE_FOR; } },
      ],
      onStart: (mm) => {
        bell.hold = true;   // (the cloud waits to be seen going down)
        mm.face = V(T.x, rope.y, T.z);
        mm.eyes = bellAt;
      },
      onFrame: (mm, t) => {
        // he looks up at the bell, then turns out to the cloud as it goes down
        if (t > C0) { mm.face = far; mm.eyes = far.clone().addScaledVector(UP, -6); }
        mm.look = t > D0 + BELL.SMIRK ? 'smirk' : null;
      },
      onEnd: () => {
        doRing();
        if (bell.hold) { bell.hold = false; bell.settleFor = BELL.SETTLE_FOR; }
        toast(said);
      },
    });
    return !!m;
  }

  return { bell: rings };
}
