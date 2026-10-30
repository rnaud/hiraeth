import * as THREE from 'three';
import { TANK } from '../fluid-tool.js';
import { faceOf } from './moment.js';
import { PLACEMENTS } from '../boxes/placements.js';

// The desert's two first times, filmed (src/story/moment.js): once per save, skippable, and
// never in the way (when one can't play, desert.js does what it always did).
//
//   flow  the debris comes out of the drain and the water runs for the first time (desert.moment.flow)
//         A  wide, high across the giant's chest: the debris is dragged clear             0.0–2.6
//         B  a long lens up the gutter from past its end: the crack lights and the water
//            bursts out and comes down it, the traveller beside it watching
//            (the flow waits for this panel: st.flowDelay)                             2.6–5.3
//         C  high over the gutter's end, across the basin: the pool spreads over the
//            dry bed from its lowest point, round the roots, its light coming up       5.3–8.6
//         D  the traveller's face, three-quarter, lit from below: he watches, and the
//            corner of his mouth goes up (a slight smirk; no line)                     8.6–11.5
//         sound: a low rumble as the debris goes, a splash at the crack and in the basin,
//         the world's motif swelling over the score (sound.swell('motif'))
//   fill  wading in with the empty tank (desert.moment.fill)
//         A  wide, over the water: the traveller stops in the glowing pool              0.0–2.3
//         B  over his shoulder, close on the tank: the water climbs into the dry glass,
//            slowly, in three colours, its glow on his back                            2.3–5.9
//         C  beside him, the full tank glowing on his back, its lights coming on one by
//            one: something beside the pool hums back, and he turns to it (the makers'
//            shrine's door, issue #156). Nothing is fired: he has nothing to fire it with yet
//            (the gun is in the Givers' Hearth; it ended with a glob shot out over the
//            pool until the author's playthrough, issue #70)                            5.9–8.7
//         D  his face: a slight smirk, nothing said                                    8.7–11.2
//         sound: the father's theme on the desert's duduk (sound.swell('father')), the
//         tank's bubbling run, the chest's faint answer; then the toast
//   font  the lever pulled in the Rose House's Font Room (issue #784; desert.moment.font)
//         A  wide and high from by the doorway: the dry pool, the lever pulled, the spouts pour     0.0–2.6
//         B  low at the kerb, across the fluid rising round his boots, its light on him             2.6–5.4
//         C  close behind his hip on the battery filling; up past it to the makers' mark as it
//            lights (the full battery: off in the house a makers' door sinks)                    5.4–8.4
//         D  his face, lit from the pool, turned up to the mark; a slight smirk                    8.4–10.8
//         sound: the lever's clunk and a rumble, the father's theme, the pour, the mark's answer
//         and the motif over it
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
// answerAt: s into the moment the chest by the pool hums back (panel C)
export const FILL = { A: 2.3, B: 3.6, C: 2.8, D: 2.5, fillAt: 2.5, fillFor: 2.8, answerAt: 6.5, SMIRK: 0.9 };
/**
 * The Font Room's film (issue #784): its panels (s); pourAt: s in, the spouts pour; riseFor: the pool's rise; fillAt: s
 * into C the glass starts to fill, over fillFor; tiltAt: s into C the lens tilts up to the mark, which lights half a
 * second on; SMIRK: s into the face's panel.
 */
export const FONT_FILM = { A: 2.6, B: 2.8, C: 3.0, D: 2.4, pourAt: 0.9, riseFor: 5.0, fillAt: 0.3, fillFor: 2.0, tiltAt: 1.7, SMIRK: 1.0 };

export function setupDesertMoments(ctx, { cave, st, tool, moments, fillTank, fillJar, FILLED }) {
  const { player, sound, level, toast } = ctx;
  const off = { flow: () => false, fill: () => false, font: () => false };
  if (!moments || !cave) return off;
  const L = (x, y, z) => cave.local(x, y, z);
  // lights the moments bring (off until then): the stream's head, the tank's glow
  const headLight = new THREE.Vector4(0, -1e5, 0, 0), tankLight = new THREE.Vector4(0, -1e5, 0, 0), poolLight = new THREE.Vector4(0, -1e5, 0, 0);
  level.lights?.push(headLight, tankLight, poolLight);
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
        // A: high on the far side of the gutter, outside the hanging roots: the debris and the traveller, the crack beyond
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
    // what hums back from beside the pool: the makers' shrine's door, its lens lighting with the full tank (issue #156),
    // else the lift valve's chest (src/boxes/placements.js desert.lift), else ahead over the water
    const lift = PLACEMENTS.desert?.find((x) => x.id === 'desert.lift')?.site?.(level);
    const door = cave.shrine?.box?.at;
    const answer = door ? door.clone().add(V(0, 1.75, 0)) : lift ? V(lift.at[0], lift.at[1] + 0.6, lift.at[2]) : ahead.clone();
    const m = moments.play({
      id: 'desert.fill', flag: 'desert.moment.fill', dur: FILL.A + FILL.B + FILL.C + FILL.D,
      shots: [
        // A: out over the water, looking back at him standing in the glowing pool
        { dur: FILL.A, from: { pos: P.clone().addScaledVector(n, 5.2).addScaledVector(r, 1.5).addScaledVector(UP, 2.0), look: P.clone().addScaledVector(UP, 0.95), fov: 42 },
          to: { pos: P.clone().addScaledVector(n, 4.2).addScaledVector(r, 1.1).addScaledVector(UP, 1.7), look: P.clone().addScaledVector(UP, 1.05), fov: 40 } },
        // B: behind his left hip, close on the glass as the water climbs into it (the battery hangs at his left side, a
        //    little behind it: issue #745)
        { dur: FILL.B, clear: false,
          from: (t) => {
            const k = smooth(t / FILL.B), f = facing(_f), tk = tankAt(_h);
            const side = rightOf(f);
            return { pos: tk.clone().addScaledVector(f, -(0.8 - 0.15 * k)).addScaledVector(side, -(0.75 - 0.08 * k)).addScaledVector(UP, 0.32), look: tk.clone().addScaledVector(UP, 0.02), fov: 40 };
          } },
        // C: over his shoulder (the lit battery at his hip at the frame's side) toward what hums back beside the pool,
        //    as he turns to it: the chest beyond him
        { dur: FILL.C, clear: false,
          from: (t) => {
            const k = smooth(t / FILL.C), c = chest(_h);
            const to = V(answer.x - c.x, 0, answer.z - c.z);
            const d = to.lengthSq() > 1 ? to.normalize() : facing(_f), side = rightOf(d);
            return { pos: c.clone().addScaledVector(d, -(2.1 - 0.3 * k)).addScaledVector(side, 0.75).addScaledVector(UP, 0.3), look: c.clone().addScaledVector(d, 4).addScaledVector(UP, -0.25), fov: 46 };
          } },
        // D: his face
        { dur: FILL.D, clear: false, from: closeUp({ angle: -0.5, dur: FILL.D }) },
      ],
      beats: [
        { t: 0.2, run: () => sound.swell?.('father', P.clone()) },
        { t: FILL.fillAt, run: () => doFill() },
        // the tank's lights come on again, one after another, for the shot to see
        { t: FILL.A + FILL.B + 0.2, run: () => { if (tool?.ringLit) tool.ringLit = tool.ringLit.map((_, i) => -i * 0.7); } },
        // and something beside the pool hums back
        { t: FILL.answerAt, run: () => sound.boxAnswer?.(0.6) },
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
        // he looks round at the full tank, then turns to what hums back (no aiming, nothing fired: issue #70)
        if (t > FILL.answerAt) mm.face = answer;
        mm.eyes = t < C0 ? tankAt(_f) : t < FILL.answerAt ? tankAt(_f) : answer;
        mm.look = t > D0 + FILL.SMIRK ? 'smirk' : null;
      },
      onEnd: () => {
        if (tool) tool.fillTo = null;
        dark(tankLight);
        doFill();
        if (filled.wasDry) toast(FILLED());
        else if (filled.addColour) toast('The water climbs into your battery. Its glass takes the colours.');
        fillJar();
      },
    });
    return !!m;
  }

  // ---------------------------------------------------------------- the Font Room: the battery fills (issue #784)
  /**
   * The lever pulled at the dry pool's heart in the Rose House's Font Room (src/temples/desert.js fontRoom; the story's
   * lever, src/story/desert.js, plants his feet at it first): the spouts pour, the pool fills round his boots, the fluid
   * climbs into the dry battery at his hip and it glows; the makers' mark on the far wall lights with it, and off in the
   * house a makers' door sinks. `charge()`: the state, applied on its beat and for sure at the end (null once done).
   */
  function font({ charge }) {
    const RT = level.temples?.find?.((t) => t.id === 'desert') ?? (level.temple?.id === 'desert' ? level.temple : null);
    const F = RT?.font;
    if (!F) return false;
    const P = player.pos.clone();
    const toLever = V(F.at.x - P.x, 0, F.at.z - P.z);
    const n = toLever.lengthSq() > 0.25 ? toLever.normalize() : facing();
    const r = rightOf(n);
    const pool = F.at.clone(), mark = F.mark.clone();
    let filled = null;
    const doFill = () => { if (!filled) filled = charge() ?? { wasDry: false, addColour: false }; };
    const tankAt = (out = V(0, 0, 0)) => {
      const g = tool?.tank?.group;
      if (g && player.object?.visible !== false) { g.updateWorldMatrix(true, false); return g.localToWorld(out.set(0, TANK.height * 0.5, 0)); }
      return out.copy(player.pos).addScaledVector(UP, 1.0).addScaledVector(r, 0.25);
    };
    const T0 = FONT_FILM, B0 = T0.A, C0 = B0 + T0.B, D0 = C0 + T0.C;
    const rise = (t) => smooth((t - T0.pourAt - 0.5) / T0.riseFor);
    const tilt = { t: -1, look: V(0, 0, 0) };
    const m = moments.play({
      id: 'desert.font', flag: 'desert.moment.font', dur: D0 + T0.D,
      shots: [
        // A: wide and high from behind him by the doorway: the dry pool, the four pylons, the lever pulled; the spouts pour
        { dur: T0.A, from: { pos: P.clone().addScaledVector(n, -11.8).addScaledVector(r, 2.2).addScaledVector(UP, 7.2), look: pool.clone().addScaledVector(n, 2).addScaledVector(UP, 0.6), fov: 52 },
          to: { pos: P.clone().addScaledVector(n, -10.2).addScaledVector(r, 1.8).addScaledVector(UP, 6.0), look: pool.clone().addScaledVector(n, 1.5).addScaledVector(UP, 0.8), fov: 50 } },
        // B: low at the kerb on his right, across the rising fluid: it climbs round his boots, its light coming up on him
        { dur: T0.B, from: { pos: P.clone().addScaledVector(r, 4.6).addScaledVector(n, 1.6).addScaledVector(UP, 0.55), look: P.clone().addScaledVector(UP, 0.55), fov: 44 },
          to: { pos: P.clone().addScaledVector(r, 3.8).addScaledVector(n, 1.3).addScaledVector(UP, 0.65), look: P.clone().addScaledVector(UP, 0.75), fov: 42 } },
        // C: close behind his left hip on the battery as the fluid climbs into the glass (it hangs at his left side, a
        //    little behind it: issue #745); then up past it to the makers' mark on the far wall as it lights
        { dur: T0.C, clear: false, ease: 'linear',
          from: (t) => {
            const tk = tankAt(_h), k = smooth((t - T0.tiltAt) / (T0.C - T0.tiltAt));
            const want = tk.clone().lerp(mark, 0.85 * k);
            if (tilt.t < 0) tilt.look.copy(want); else tilt.look.lerp(want, 1 - Math.exp(-7 * Math.max(0, t - tilt.t)));
            tilt.t = t;
            return { pos: tk.clone().addScaledVector(n, -(0.9 - 0.12 * smooth(t / T0.C))).addScaledVector(r, -0.8).addScaledVector(UP, 0.22 - 0.2 * k), look: tilt.look.clone(), fov: 40 + 8 * k };
          } },
        // D: his face, lit from the pool below, turned up to the lit mark
        { dur: T0.D, clear: false, from: closeUp({ angle: -0.95, dur: T0.D, drop: 0.1 }) },
      ],
      beats: [
        { t: 0.25, run: () => { sound.thud?.(); sound.rumble?.(2.4, 0.3); } },
        { t: 0.5, run: () => sound.swell?.('father', pool.clone()) },
        { t: T0.pourAt, run: () => { sound.waterRise?.(); sound.splash?.(0.8); } },
        { t: C0 + T0.fillAt, run: () => doFill() },
        { t: C0 + T0.tiltAt + 0.5, run: () => { F.lit = 1; sound.boxAnswer?.(0.8); sound.swell?.('motif', mark.clone()); sound.rumble?.(1.4, 0.18); } },
      ],
      onStart: (mm) => {
        F.hold = true; F.pull = 0; F.pour = 0; F.k = 0; F.lit = 0;
        if (tool) tool.fillTo = 0;   // (the glass stays dry until its beat, then fills slowly)
        mm.face = pool.clone(); mm.eyes = F.lever.clone();
      },
      onFrame: (mm, t, dt = 1 / 60) => {
        F.pull = smooth((t - 0.15) / 0.55);
        F.pour = t < T0.pourAt ? 0 : t < D0 ? smooth((t - T0.pourAt) / 1.2) : Math.max(0, 1 - (t - D0) / 1.5);
        F.k = rise(t);
        const k = smooth((t - C0 - T0.fillAt) / T0.fillFor);
        if (tool) tool.fillTo = t < C0 + T0.fillAt ? 0 : k;
        // the pool's light comes up with the fluid; the battery's glow on his hip as it fills
        poolLight.set(pool.x, pool.y + 1.2, pool.z, 12 * F.k);
        if (t > C0 - 0.3) { const tk = tankAt(_f); tankLight.set(tk.x, tk.y + 0.25, tk.z, 6 * k); } else dark(tankLight);
        // he watches the lever, then the fluid round him, then the glass at his hip, then the mark as it lights
        mm.eyes = t < T0.pourAt ? F.lever : t < C0 ? pool.clone().addScaledVector(r, 2.5) : t < C0 + T0.tiltAt + 0.3 ? tankAt(_f) : mark;
        if (t > C0 + T0.tiltAt + 0.3) mm.face = mark;
        mm.look = t > D0 + T0.SMIRK ? 'smirk' : null;
        void dt;
      },
      onEnd: () => {
        F.hold = false;
        if (tool) tool.fillTo = null;
        dark(tankLight); dark(poolLight);
        doFill();
        toast(filled?.wasDry ? FILLED() : 'Living water fills the pool, and your battery with it.');
      },
    });
    return !!m;
  }

  // ---------------------------------------------------------------- the tree catches (issue #239)
  /**
   * The spark-stone set in the roots: the tree burns again, filmed from the ground by him out to the whole of it
   * (src/story/desert.js setStone calls it; the lighting runs on its own clock, LIGHT there: the stone into the water,
   * the spark up the trunk, the fire growing over six seconds). `at`: { roots, treeBase, crown, spark() }.
   */
  function lit(at) {
    const P = player.pos.clone();
    // the way out from the trunk to the roots and down the avenue (the camera backs away along it), and across it
    const out = V(at.roots.x - at.treeBase.x, 0, at.roots.z - at.treeBase.z);
    if (out.lengthSq() < 1e-4) out.copy(facing()).negate(); else out.normalize();
    // (across the avenue, on the side away from anyone standing by him: Hessa sweeps beside the roots)
    const side = rightOf(out);
    if (at.avoid && (at.avoid.x - P.x) * side.x + (at.avoid.z - P.z) * side.z > 0) side.negate();
    const mid = at.treeBase.clone().addScaledVector(UP, LIT.midY), crown = at.crown.clone();
    // B and C's lens: backing away down the avenue and rising, a little to the side so the trunk isn't edge-on
    // (from where A's push ends, so B moves on from it without a cut; rising a little ahead of backing off)
    const A1 = P.clone().addScaledVector(out, 1.9).addScaledVector(side, 1.0).addScaledVector(UP, 0.75);
    const far = at.treeBase.clone().addScaledVector(out, LIT.far).addScaledVector(side, 14).addScaledVector(UP, LIT.high);
    const crane = (k) => { const p = A1.clone().lerp(far, k); p.y = THREE.MathUtils.lerp(A1.y, far.y, Math.pow(k, 0.8)); return p; };
    const pan = { t: -1, look: V(0, 0, 0) };
    const m = moments.play({
      id: 'desert.lit', flag: 'desert.moment.lit', dur: LIT.A + LIT.B + LIT.C,
      shots: [
        // A: on the ground beside him, low, the stone going from his hand into the wet roots
        { dur: LIT.A, from: { pos: P.clone().addScaledVector(out, 1.7).addScaledVector(side, 1.3).addScaledVector(UP, 0.55), look: at.roots.clone().addScaledVector(UP, 0.2), fov: 48 },
          to: { pos: A1.clone(), look: at.roots.clone().addScaledVector(UP, 0.9), fov: 50 } },
        // B: backing off and rising as the spark climbs the bark, the lens tilting up after it
        { dur: LIT.B, ease: 'linear', clear: false,
          from: (t) => {
            const k = smooth(t / LIT.B) * LIT.craneB;
            const want = at.spark() ?? crown;
            if (pan.t < 0) pan.look.copy(at.roots).addScaledVector(UP, 0.9); else pan.look.lerp(want, 1 - Math.exp(-6 * Math.max(0, t - pan.t)));
            pan.t = t;
            return { pos: crane(k), look: pan.look.clone(), fov: 50 };
          } },
        // C: the long pull back and up to the whole tree over the city, the fire growing out of its crown
        { dur: LIT.C, ease: 'linear', clear: false,
          from: (t) => {
            const k = LIT.craneB + (1 - LIT.craneB) * smooth(t / LIT.C);
            const look = pan.look.clone().lerp(mid, smooth(t / 1.6));
            return { pos: crane(k), look, fov: 50 + 6 * smooth(t / LIT.C) };
          } },
      ],
      beats: [
        { t: LIT.swellAt, run: () => sound.swell?.('motif', crown.clone()) },
      ],
      onStart: (mm) => { mm.face = at.roots.clone(); mm.eyes = at.roots.clone(); },
      onFrame: (mm, t) => {
        // he watches the spark up the trunk, then the crown
        const s = at.spark();
        mm.eyes = s ? s.clone() : crown;
        if (t > LIT.A + LIT.B) mm.face = crown;
      },
    });
    return !!m;
  }

  return { flow, fill, lit, font };
}

/**
 * The tree catching, filmed (issue #239: "it starts at the ground level, but then zooms out to see a scale"): A, low
 * beside him at the roots (s); B, backing off and rising as the spark climbs; C, the long pull back to the whole tree;
 * far: the crane's distance from the trunk at the end (m), high its height there, craneB how far it has gone by C,
 * midY where the wide shot looks (m up the trunk), swellAt when the motif swells (as it catches: src/story/desert.js LIGHT).
 */
export const LIT = { A: 2.2, B: 2.6, C: 5.4, far: 150, high: 62, craneB: 0.16, midY: 24, swellAt: 3.6 };
