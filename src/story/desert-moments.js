import * as THREE from 'three';
import { TANK } from '../fluid-tool.js';
import { faceOf } from './moment.js';

// The desert's two first times, filmed (src/story/moment.js): once per save, skippable, and
// never in the way (when one can't play, desert.js does what it always did).
//
//   flow  the rib rolls off the channel and the water runs for the first time (desert.moment.flow)
//         A  wide, high across the giant's chest: the rib tips, rolls and falls clear      0.0–2.6
//         B  a long lens up the gutter from past its end: the crack lights and the water
//            bursts out and comes down it, the traveller by the post watching
//            (the flow waits for this panel: st.flowDelay)                             2.6–5.3
//         C  high over the gutter's end, across the basin: the pool spreads over the
//            dry bed from its lowest point, round the roots, its light coming up       5.3–8.6
//         D  the traveller's face, three-quarter, lit from below: he watches, and the
//            corner of his mouth goes up (a slight smirk; no line)                     8.6–11.5
//         sound: a low rumble as the rib goes, a splash at the crack and in the basin,
//         the world's motif swelling over the score (sound.swell('motif'))
//   fill  wading in with the empty tank (desert.moment.fill)
//         A  wide, over the water: the traveller stops in the glowing pool              0.0–2.3
//         B  over his shoulder, close on the tank: the water climbs into the dry glass,
//            slowly, in three colours, its glow on his back                            2.3–5.9
//         C  beside him: he lifts the glove, its knuckles light one by one, and a first
//            glob leaves the nozzle and splashes out across the pool                    5.9–8.7
//         D  his face: a slight smirk, nothing said                                    8.7–11.2
//         sound: the father's theme on the desert's duduk (sound.swell('father')), the
//         tank's bubbling run, the glob's shot and splash; then the toast with the controls
//
// What they show is applied for sure: the channel is open before the flow's first frame (the
// water runs on its own clock, paced a little); the tank fills on a beat of `fill`, and if that
// beat never came (skipped, failed) at its end, with the jar; the toasts are said at the end.
//
// Show, don't tell: the traveller says nothing in them, and reacts with his face only, a slight
// smirk at most (m.look 'smirk': worn quietly, no mouth and no hands; src/talk-face.js).

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const UP = V(0, 1, 0);
const smooth = (t) => { t = Math.min(1, Math.max(0, t)); return t * t * (3 - 2 * t); };

// SMIRK: s into the face's panel before the corner of his mouth goes up
export const FLOW = { A: 2.6, B: 2.7, C: 3.3, D: 2.9, flowDelay: 2.4, SMIRK: 1.1 };
export const FILL = { A: 2.3, B: 3.6, C: 2.8, D: 2.5, fillAt: 2.5, fillFor: 2.8, sparkAt: 7.2, SMIRK: 0.9 };

export function setupDesertMoments(ctx, { cave, st, tool, moments, fillTank, fillJar, FILLED }) {
  const { player, sound, level, toast } = ctx;
  const off = { flow: () => false, fill: () => false };
  if (!moments || !cave) return off;
  const L = (x, y, z) => cave.local(x, y, z);
  // lights the moments bring (off until then): the stream's head, the tank's glow
  const headLight = new THREE.Vector4(0, -1e5, 0, 0), tankLight = new THREE.Vector4(0, -1e5, 0, 0);
  level.lights?.push(headLight, tankLight);
  const dark = (l) => l.set(0, -1e5, 0, 0);

  const _h = V(0, 0, 0), _f = V(0, 0, 0);
  /** The traveller's face (his head bone, else up from his feet). */
  const faceAt = (out = V(0, 0, 0)) => {
    const head = player.humanoid?.b?.Head;
    if (head && player.object?.visible !== false) return head.getWorldPosition(out).addScaledVector(UP, 0.06);
    return out.copy(player.pos).addScaledVector(UP, 1.62);
  };
  const facing = (out = V(0, 0, 0)) => (player.frame?.dir ? player.frame.dir(player.heading, out) : out.set(Math.sin(player.heading), 0, Math.cos(player.heading))).setY(0).normalize();
  const rightOf = (f, out = V(0, 0, 0)) => out.set(-f.z, 0, f.x);
  const turn = (v, a) => V(v.x * Math.cos(a) + v.z * Math.sin(a), 0, -v.x * Math.sin(a) + v.z * Math.cos(a));
  /**
   * A close-up on his face, `angle` off the way it looks (a three-quarter view), framed off the head as it
   * is posed (src/story/moment.js faceOf), its turn followed slowly so the panel never swings; it pushes in.
   */
  const _face = { pos: V(0, 0, 0), fwd: V(0, 0, 0) };
  const closeUp = ({ angle, dur, dist = 1.4, push = 0.2, fov = 36, drop = 0.08 }) => {
    const sm = { t: -1, fwd: V(0, 0, 1) };
    return (t) => {
      const F = faceOf(player.humanoid, _face);
      const at = F ? F.pos.clone() : faceAt(V(0, 0, 0));
      const want = F && Math.hypot(F.fwd.x, F.fwd.z) > 0.3 ? V(F.fwd.x, 0, F.fwd.z).normalize() : facing(V(0, 0, 0));
      if (sm.t < 0 || t < sm.t) sm.fwd.copy(want); else sm.fwd.lerp(want, 1 - Math.exp(-1.5 * (t - sm.t))).normalize();
      sm.t = t;
      const k = smooth(t / dur);
      return { pos: at.clone().addScaledVector(turn(sm.fwd, angle), dist - push * k).addScaledVector(UP, -drop), look: at.clone().addScaledVector(UP, -0.06), fov: fov - 2 * k };
    };
  };

  // ---------------------------------------------------------------- the water's first run
  function flow(said) {
    const perp = V(-cave.chDir.z, 0, cave.chDir.x).normalize();
    const poolAt = cave.poolCenter.clone();
    const mouth = cave.streamAt(1), crack = cave.crack.clone();
    const head = (out = V(0, 0, 0)) => cave.streamAt(st.flow, out);
    // B's lens: past the gutter's end over the basin's rim, beside it on the post's side, looking back up it
    const along = mouth.clone().sub(crack).setY(0).normalize();
    const beyond = mouth.clone().addScaledVector(along, 3.4).addScaledVector(perp, -1.7).addScaledVector(UP, 2.1);
    const pan = { t: 0, look: V(0, -1e5, 0) };
    const m = moments.play({
      id: 'desert.flow', flag: 'desert.moment.flow', dur: FLOW.A + FLOW.B + FLOW.C + FLOW.D,
      shots: [
        // A: high on the far side of the gutter, outside the hanging roots: the rib, the post and the traveller, the crack beyond
        { dur: FLOW.A, from: { pos: L(11.5, 6.8, 10.5), look: L(21.5, 0.9, -3.0), fov: 50 }, to: { pos: L(12.6, 6.0, 9.0), look: L(21.2, 0.8, -3.6), fov: 46 } },
        // B: from past the gutter's end, a long lens up it to the crack as it breaks; the water comes down it toward us
        { dur: FLOW.B, ease: 'linear', clear: false,
          from: (t) => {
            const look = st.flow < 0.03 ? crack.clone().addScaledVector(UP, -0.5) : head().addScaledVector(UP, 0.2);
            if (st.flow > 0.72) look.lerp(cave.streamAt(0.72).addScaledVector(UP, 0.2), 1);
            // (the pan eased: a long lens must not jerk)
            const dt = Math.max(0, t - pan.t); pan.t = t;
            if (pan.look.y < -1e4) pan.look.copy(look); else pan.look.lerp(look, 1 - Math.exp(-9 * dt));
            return { pos: beyond.clone(), look: pan.look.clone(), fov: 34 };
          } },
        // C: over the gutter's end, looking across the dry bed as the pool spreads over it and the roots dip into it
        { dur: FLOW.C, from: { pos: L(16.5, 5.6, 5.0), look: L(3.0, -1.6, -1.0), fov: 54 }, to: { pos: L(15.0, 4.4, 6.6), look: L(2.0, -1.4, -0.4), fov: 56 } },
        // D: his face, lit from the pool below, turned to it
        { dur: FLOW.D, clear: false, from: closeUp({ angle: 0.5, dur: FLOW.D, drop: 0.12 }) },
      ],
      beats: [
        { t: 0, run: () => { sound.rumble?.(2.8, 0.28); } },
        { t: FLOW.flowDelay, run: () => { sound.splash?.(0.7); sound.swell?.('motif', poolAt.clone()); } },
        { t: FLOW.flowDelay + 2.6, run: () => sound.splash?.(1) },
      ],
      onStart: (mm) => {
        st.flowDelay = FLOW.flowDelay;   // (the water waits for the crack's panel)
        mm.eyes = cave.bone.position;
      },
      onFrame: (mm, t) => {
        const C0 = FLOW.A + FLOW.B;
        // the light comes with the water: on its head down the gutter, then up out of the basin
        if (st.flow > 0 && st.flow < 1) { const h = head(); headLight.set(h.x, h.y + 0.8, h.z, 9); } else dark(headLight);
        st.glow = t < C0 ? 0 : 14 * smooth((t - C0) / 2.2);
        // he turns to the pool as it fills, and watches it
        if (t > FLOW.A) { mm.face = poolAt; mm.eyes = st.flow < 1 ? head(_f) : mouth; }
        if (t > C0) mm.eyes = poolAt;
        // his face, at the end: watching, then the corner of his mouth goes up
        mm.look = t > C0 + FLOW.C + FLOW.SMIRK ? 'smirk' : null;
      },
      onEnd: () => {
        st.flowDelay = undefined; st.glow = 0;
        dark(headLight);
        toast(said);
      },
    });
    return !!m;
  }

  // ---------------------------------------------------------------- the empty tank's first fill
  function fill() {
    const P = player.pos.clone();
    const toPool = V(cave.poolCenter.x - P.x, 0, cave.poolCenter.z - P.z);
    const n = toPool.lengthSq() > 4 ? toPool.normalize() : facing();
    const r = rightOf(n);
    const ahead = P.clone().addScaledVector(n, 7).addScaledVector(UP, 0.6);
    let filled = null;
    const doFill = () => { if (!filled) filled = fillTank(); };
    const tankAt = (out = V(0, 0, 0)) => {
      const g = tool?.tank?.group;
      if (g && player.object?.visible !== false) { g.updateWorldMatrix(true, false); return g.localToWorld(out.set(0, TANK.height * 0.5, 0)); }
      return out.copy(player.pos).addScaledVector(UP, 1.3).addScaledVector(facing(_f), -0.25);
    };
    const chest = (out = V(0, 0, 0)) => out.copy(player.pos).addScaledVector(UP, 1.35);
    const aimDir = n.clone().addScaledVector(UP, 0.32).normalize();
    const sparkTo = P.clone().addScaledVector(n, 8).addScaledVector(UP, 1.2);
    const m = moments.play({
      id: 'desert.fill', flag: 'desert.moment.fill', dur: FILL.A + FILL.B + FILL.C + FILL.D,
      shots: [
        // A: out over the water, looking back at him standing in the glowing pool
        { dur: FILL.A, from: { pos: P.clone().addScaledVector(n, 5.2).addScaledVector(r, 1.5).addScaledVector(UP, 2.0), look: P.clone().addScaledVector(UP, 0.95), fov: 42 },
          to: { pos: P.clone().addScaledVector(n, 4.2).addScaledVector(r, 1.1).addScaledVector(UP, 1.7), look: P.clone().addScaledVector(UP, 1.05), fov: 40 } },
        // B: over his right shoulder, close on the glass as the water climbs into it
        { dur: FILL.B, clear: false,
          from: (t) => {
            const k = smooth(t / FILL.B), f = facing(_f), tk = tankAt(_h);
            const side = rightOf(f);
            return { pos: tk.clone().addScaledVector(f, -(1.05 - 0.2 * k)).addScaledVector(side, 0.5 - 0.08 * k).addScaledVector(UP, 0.28), look: tk.clone().addScaledVector(UP, 0.02), fov: 40 };
          } },
        // C: beside him, along the raised arm and out over the pool where the glob goes (from behind and well out
        //    to his side, him at the frame's left: from just behind his head, it filled half the frame in
        //    silhouette and hid the glove; the cinematics QC pass, docs/systems/cinematics-qc.md)
        { dur: FILL.C, clear: false,
          from: (t) => {
            const k = smooth(t / FILL.C), c = chest(_h), f = facing(_f), side = rightOf(f);
            return { pos: c.clone().addScaledVector(side, 1.6).addScaledVector(f, -1.7 + 0.2 * k).addScaledVector(UP, 0.15), look: c.clone().addScaledVector(f, 3).addScaledVector(UP, 0.05), fov: 50 };
          } },
        // D: his face
        { dur: FILL.D, clear: false, from: closeUp({ angle: -0.5, dur: FILL.D }) },
      ],
      beats: [
        { t: 0.2, run: () => sound.swell?.('father', P.clone()) },
        { t: FILL.fillAt, run: () => doFill() },
        // the glove's knuckles light again, one after another, for the shot to see
        { t: FILL.A + FILL.B + 0.2, run: () => { if (tool?.ringLit) tool.ringLit = tool.ringLit.map((_, i) => -i * 0.7); } },
        { t: FILL.sparkAt, run: () => tool?.spark?.(aimDir) },
      ],
      onStart: (mm) => {
        if (tool) tool.fillTo = 0;   // (the glass stays dry until its beat, then fills slowly)
        mm.face = P.clone().addScaledVector(n, 5);
      },
      onFrame: (mm, t) => {
        const B0 = FILL.A, C0 = FILL.A + FILL.B, D0 = C0 + FILL.C;
        const k = smooth((t - FILL.fillAt) / FILL.fillFor);
        if (tool) tool.fillTo = t < FILL.fillAt ? 0 : k;
        // the tank glows on his back as it fills
        if (t > B0 && t < D0 + 0.5) { const tk = tankAt(_h); tankLight.set(tk.x, tk.y + 0.3, tk.z, 7 * k); } else dark(tankLight);
        // he lifts the glove and lets the first glob go
        const lift = t < C0 ? 0 : t < D0 ? smooth((t - C0) / 0.6) * (1 - smooth((t - D0 + 1.0) / 0.6)) : 0;   // (down before his face's panel)
        player.aim = lift > 0.01 ? { k: lift, point: sparkTo, dir: aimDir } : null;
        mm.eyes = t < C0 ? tankAt(_f) : t < D0 ? sparkTo : ahead;
        mm.look = t > D0 + FILL.SMIRK ? 'smirk' : null;
      },
      onEnd: () => {
        if (tool) tool.fillTo = null;
        player.aim = null;
        dark(tankLight);
        doFill();
        if (filled.wasDry) toast(FILLED());
        else if (filled.addColour) toast('The water climbs into your tank. The tank takes its colours.');
        fillJar();
      },
    });
    return !!m;
  }

  return { flow, fill };
}
