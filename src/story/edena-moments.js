import { V, UP, smooth, closeUp, from } from './film.js';

// Viridel's climax, filmed (src/story/moment.js): the builders' gate gives way and the flood takes
// the middle of Esk's terraces, for good. Once per save, skippable, and never in the way (when it
// can't play, terraces.js does what it always did).
//
//   terraces  the cistern gate tears loose and the water takes the terraces (edena.moment.terraces)
//             A  low on the south terraces, looking up at the builders' wall: the wheel gives
//                its one notch, water spurts, the wall cracks and the gate tears loose        0.0–2.0
//             B  high beside the lane: the sheet of water runs down it toward the hollow, the
//                white walls and the rows of tea going one step after another              2.0–4.8
//             C  low across the hollow, looking back up the slope: the mud and the uprooted
//                bushes come down into it, the gardens either side standing                  4.8–6.6
//             D  the traveller's face, three-quarter, turned to the lane: quiet dismay (a
//                solemn look, then a sad one; no line)                                         6.6–8.8
//             sound: the gate's own notch, crack and roar (terraces.js), and the father's theme
//             swelling over it as the gate goes (sound.swell('father'))
//
// The flood is never the moment's: it runs on its own clock (10 s, terraces.js floodStep), started as
// the wheel turns, so the controls come back while the water is still pouring down the raw slope and
// the mud is still spreading in the hollow. Its toasts that only say what the panels show wait out
// (terraces st.filmed); the last one (the water goes quiet) comes when it does.
//
// Show, don't tell: he says nothing, and his face is quiet (m.look 'solemn', then 'sad': worn
// without a word, the mouth shut and the hands still; src/talk-face.js).

export const MOMENTS = [
  { id: 'edena.terraces', flag: 'edena.moment.terraces', beat: 'the cistern gate gives way and the flood takes the terraces' },
];

// SAD: s into the face's panel before the solemn look gives way to a sad one
export const TERRACES = { A: 2.0, B: 2.8, C: 1.8, D: 2.2, swellAt: 1.7, SAD: 0.9 };

const T1z = (L) => L.zs[L.zs.length - 1];   // (the terraces' north end)

export function setupEdenaMoments(ctx, { terraces }) {
  const { player, sound, level, moments } = ctx;
  const off = { terraces: () => false };
  if (!moments || !terraces?.flood) return off;
  const H = (x, z) => level.ground.heightAt(x, z);
  const F = terraces.flood, L = terraces.layout, st = terraces.state;
  const [def] = MOMENTS;

  function flood() {
    const cz = F.cz, wheel = terraces.wheelAt.clone(), hx = F.hollow.x, hz = F.hollow.z;
    const onLane = (x) => V(x, H(x, cz), cz);
    const mid = onLane((L.steps[1].xl + L.steps[2].xu) / 2);
    // the water's leading edge, a little ahead of it (where the eye goes), eased so a long lens never jerks
    const pan = { t: -1, look: V(0, 0, 0) };
    const ahead = (t) => {
      const x = Math.max(hx + 6, F.front() - 3), want = onLane(x).addScaledVector(UP, 0.6);
      if (pan.t < 0 || t < pan.t) pan.look.copy(want); else pan.look.lerp(want, 1 - Math.exp(-6 * (t - pan.t)));
      pan.t = t;
      return pan.look.clone();
    };
    // B's lens: high over the top terrace's north end, looking down the lane the way the water goes
    const bAt = V(L.steps[0].xl + 2, 0, cz + 26);
    bAt.y = Math.max(H(bAt.x, bAt.z), L.topAt(0, T1z(L))) + 16;
    // C's lens: low over the hollow's far (south-west) rim, looking back up the slope
    const cAt = V(hx - 6, 0, hz - 17);
    cAt.y = H(cAt.x, cAt.z) + 3.2;
    const cLook = onLane(hx + 22).addScaledVector(UP, 2.5);
    const m = moments.play({
      ...def, dur: TERRACES.A + TERRACES.B + TERRACES.C + TERRACES.D,
      shots: [
        // A: low on the south side, the wall and its gate above, pushing in as it cracks
        { dur: TERRACES.A, clear: false,
          from: from(wheel, V(-1, 0, -0.75), { dist: 17, h: -1.2, lookUp: -1.4, fov: 46 }),
          to: from(wheel, V(-1, 0, -0.75), { dist: 14.5, h: -1.6, lookUp: -1.8, fov: 44 }) },
        // B: down the lane as the water takes it, the eye on its front
        { dur: TERRACES.B, ease: 'linear', clear: false, from: (t) => ({ pos: bAt.clone().addScaledVector(UP, -0.6 * smooth(t / TERRACES.B)), look: ahead(t), fov: 48 }) },
        // C: from the hollow, up the slope: the mud and the bushes coming down into it
        { dur: TERRACES.C, clear: false, from: { pos: cAt, look: cLook, fov: 46 }, to: { pos: cAt.clone().add(V(1.2, 0.5, 0.8)), look: cLook.clone().addScaledVector(UP, -0.6), fov: 44 } },
        // D: his face, turned to it
        { dur: TERRACES.D, clear: false, from: closeUp(player, { angle: 0.55, dur: TERRACES.D, drop: 0.06 }) },
      ],
      beats: [
        { t: TERRACES.swellAt, run: () => sound.swell?.('father', mid.clone()) },
      ],
      onStart: (mm) => {
        if (st.flood < 0) st.flood = 0;   // (the gate's push started it; for sure)
        mm.face = wheel; mm.eyes = wheel;
      },
      onFrame: (mm, t) => {
        // he turns from the gate to the lane as the water goes down it, and watches its front
        if (t > TERRACES.swellAt) { mm.face = mid; mm.eyes = onLane(Math.max(hx, F.front())); }
        const D0 = TERRACES.A + TERRACES.B + TERRACES.C;
        mm.look = t < D0 - 0.4 ? null : t < D0 + TERRACES.SAD ? 'solemn' : 'sad';
      },
      onEnd: () => {
        // the flood is the terraces' own, and goes on: only make sure it has begun
        if (st.flood < 0) st.flood = 0;
      },
    });
    return !!m;
  }

  return { terraces: flood };
}
