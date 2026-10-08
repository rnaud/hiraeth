import * as THREE from 'three';
import { V, closeUp, smooth } from './film.js';

// The Sealed Hangar's climax, filmed (src/story/moment.js): once per save, skippable, and never
// in the way (when it can't play, the Hangar goes on as it always did: Lune's words tell it).
//
//   signal  Lune holds the stamped signal to the ring's slit and, for the first time, it is read:
//           nine dots of light fall on the floor between them (garage.moment.signal). It plays as
//           her talk closes (the talk says what she does; the film shows it).
//           A  wide and low along the ring's floor from its near end: the two of them small at
//              the bottom of the great drum, the floor curving up on both sides toward the slit                0.0–2.4
//           B  from beside Lune's feet, looking up the curve to the slit: the light it lets
//              in, the one window of the ring (the world's motif swells)                        2.4–4.8
//           C  from above, between them: the nine dots come on one by one on the floor,
//              three by three, the signal read at last                                         4.8–7.6
//           D  his face, three-quarter, lit from below by the dots: he looks at them, and the
//              corner of his mouth goes up (a slight smirk; no line)                           7.6–10.0
//           Control comes back with the dots still lying there, shimmering on the floor (they
//           fade a while later, or once he walks off): the climax is still happening.
//
// What it shows is applied for sure: the dots come on on C's beats and, all of them, in onEnd
// (a skip, a failure). The talk already set what the story needs (garage.signal.read, the quest
// on to the desk); the film adds nothing the story waits on, and without it nothing changes.
//
// Show, don't tell: the traveller says nothing, and reacts with his face only, a slight smirk at
// most (m.look 'smirk': worn quietly, no mouth and no hands; src/talk-face.js).

export const MOMENTS = [{ id: 'garage.signal', flag: 'garage.moment.signal', beat: 'the signal is read through the ring’s slit' }];

// DOTS: s into the film each dot comes on (C's panel); SMIRK: s into the face's panel; LINGER: s the
// dots stay on the floor after it (unless he walks AWAY m off)
export const SIGNAL = { A: 2.4, B: 2.4, C: 2.8, D: 2.4, swellAt: 2.5, DOTS: 5.1, DOT_STEP: 0.2, SMIRK: 1.0, LINGER: 40, AWAY: 25 };

/**
 * @param ctx  the world's ctx (player, sound, level, scene)
 * @param o    { G (level.garage), moments, lune (the npc), lampOn (the board's lit lamps' material, already drawn) }
 * @returns    { signal(): true if it plays, update(dt, t), dots }
 */
export function setupGarageMoments(ctx, { G, moments, lune, lampOn }) {
  const { player, sound, level, scene } = ctx;
  const off = { signal: () => false, update: () => {}, dots: null };
  if (!moments || !G || !lune || !lampOn || !scene) return off;
  const C = G.C_POS, R = G.RING_R;

  // the nine dots: made now, out of the board's own lit material (nothing new to compile), hidden
  const dots = new THREE.Group();
  dots.visible = false;
  dots.userData.noCollide = true;
  const geo = new THREE.CircleGeometry(0.15, 14).rotateX(-Math.PI / 2);
  const spots = [];
  for (let i = 0; i < 9; i++) {
    const s = new THREE.Mesh(geo, lampOn);
    s.position.set(((i % 3) - 1) * 0.5, 0.1, (Math.floor(i / 3) - 1) * 0.5);
    s.visible = false;
    s.userData.noCollide = true;
    dots.add(s); spots.push(s);
  }
  scene.add(dots);
  const glow = new THREE.Vector4(0, -1e5, 0, 0);
  level.lights?.push(glow);
  const live = { t: -1, at: V(0, 0, 0) };
  const dotOn = (i) => { spots[i].visible = true; dots.visible = true; };
  const allOn = () => { for (let i = 0; i < 9; i++) dotOn(i); };
  const dark = () => { dots.visible = false; for (const s of spots) s.visible = false; glow.set(0, -1e5, 0, 0); live.t = -1; };

  /** The ring's floor under p, and its up there (toward the axis). */
  const floorAt = (p) => {
    const d = V(0, p.y - C.y, p.z - C.z).normalize();
    return { pos: V(p.x, C.y + d.y * R, C.z + d.z * R), up: d.clone().negate() };
  };

  function signal() {
    const def = MOMENTS[0];
    const P = player.pos.clone(), L = lune.pos.clone();
    if (G.zoneId(P) !== 'C' || P.distanceTo(L) > 14) return false;
    const mid = floorAt(P.clone().lerp(L, 0.5)), M = mid.pos, U = mid.up;
    const pair = V(L.x - P.x, 0, L.z - P.z); pair.addScaledVector(U, -pair.dot(U));
    if (pair.lengthSq() < 0.01) pair.set(1, 0, 0);
    pair.normalize();
    const side = V(0, 0, 0).crossVectors(U, pair).normalize();
    // the slit: straight over the ring's axis from the floor's bottom, at this stretch of the ring
    const slit = V(M.x, C.y + R, C.z);
    // A: low on the floor toward the ring's near end, looking along it: the long drum rises behind them
    const ax = V(Math.sign(C.x - M.x) || 1, 0, 0);
    const aPos = M.clone().addScaledVector(ax, -15).addScaledVector(U, 1.6);
    const aLook = M.clone().addScaledVector(ax, 12).addScaledVector(U, 6);
    // B: from by Lune's feet, up the curve to the slit (tilted off the vertical: the camera keeps +y up)
    const bPos = L.clone().addScaledVector(pair, 1.1).addScaledVector(side, 0.9).addScaledVector(U, 0.5);
    const bLook = slit.clone().addScaledVector(ax, 60);
    // C: above them, looking down between their feet
    const cPos = M.clone().addScaledVector(U, 4.0).addScaledVector(side, 1.6).addScaledVector(pair, -0.6);
    // the dots lie on the floor between them
    dots.position.copy(M);
    dots.quaternion.setFromUnitVectors(V(0, 1, 0), U);
    dots.rotateY(Math.atan2(pair.x, pair.z));
    dots.updateMatrixWorld(true);
    const m = moments.play({
      id: def.id, flag: def.flag, dur: SIGNAL.A + SIGNAL.B + SIGNAL.C + SIGNAL.D,
      shots: [
        { dur: SIGNAL.A, from: { pos: aPos, look: aLook, fov: 60 }, to: { pos: aPos.clone().addScaledVector(ax, 2.5), look: aLook.clone().addScaledVector(U, 2), fov: 56 } },
        { dur: SIGNAL.B, clear: false, from: { pos: bPos, look: bLook, fov: 54 }, to: { pos: bPos.clone().addScaledVector(U, 0.3), look: bLook.clone().addScaledVector(ax, 25), fov: 50 } },
        { dur: SIGNAL.C, clear: false, from: { pos: cPos, look: M.clone(), fov: 50 }, to: { pos: cPos.clone().addScaledVector(U, -0.6), look: M.clone(), fov: 46 } },
        { dur: SIGNAL.D, clear: false, from: closeUp(player, { angle: 0.55, dur: SIGNAL.D, drop: 0.14 }) },
      ],
      beats: [
        { t: SIGNAL.swellAt, run: () => sound.swell?.('motif', M.clone()) },
        ...Array.from({ length: 9 }, (_, i) => ({ t: SIGNAL.DOTS + i * SIGNAL.DOT_STEP, run: () => { dotOn(i); if (i % 3 === 2) sound.chime?.(); } })),
      ],
      onStart: (mm) => {
        dark();
        live.at.copy(M);
        mm.face = M.clone();
        mm.eyes = L.clone().addScaledVector(U, 1.6);
      },
      onFrame: (mm, t) => {
        const B0 = SIGNAL.A, C0 = B0 + SIGNAL.B, D0 = C0 + SIGNAL.C;
        // the dots' light on the two of them, coming up as they come on
        const n = spots.filter((s) => s.visible).length;
        if (n) glow.set(M.x + U.x, M.y + U.y, M.z + U.z, 5 + 2 * smooth(n / 9)); else glow.set(0, -1e5, 0, 0);
        mm.eyes = t < B0 ? L.clone().addScaledVector(U, 1.6) : t < C0 ? slit : M;
        mm.look = t > D0 + SIGNAL.SMIRK ? 'smirk' : null;
      },
      onEnd: () => {
        allOn();
        glow.set(M.x + U.x, M.y + U.y, M.z + U.z, 7);
        live.t = 0;
      },
    });
    if (!m) dark();
    return !!m;
  }

  /** After the film: the dots shimmer on the floor a while, then go (or once he walks off). */
  const update = (dt, t) => {
    if (live.t < 0 || moments.playing) return;
    live.t += dt;
    const s = 1 + 0.08 * Math.sin(t * 2.3);
    for (const d of spots) d.scale.setScalar(s);
    const k = 1 - smooth((live.t - SIGNAL.LINGER) / 3);
    glow.w = 7 * k * (0.9 + 0.1 * Math.sin(t * 2.3));
    if (k <= 0 || player.pos.distanceTo(live.at) > SIGNAL.AWAY) dark();
  };

  return { signal, update, dots };
}
