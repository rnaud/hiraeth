import * as THREE from 'three';
import { V, UP, smooth, closeUp, facing, rightOf, orbit } from './film.js';

// Lorn's climax, filmed (src/story/moment.js): once per save, skippable, and never in the way
// (when it can't play, perdide.js does what it always did: the heart's page, "One crystal
// answers, then another…").
//
//   crystal  the splinter raised in the cave's heart, and the cave singing the light's phrase
//            back to it (perdide.moment.crystal)
//            A  wide, down the cave behind him: the dark ring of crystals round its empty place,
//               the traveller at it raising the splinter                                    0.0–2.4
//            B  over his shoulder, past the raised splinter across the ring: one crystal
//               answers, then another, then a third (a light comes up in each); then the whole
//               ring and the walls take the phrase (the cave answers: perdide.heart.rung)   2.4–5.4
//            C  high under the vault, a slow arc: the cave singing, the walls pulsing in the
//               song's colour; far off, the phrase once more, thin, like a voice calling     5.4–7.6
//            D  his face, three-quarter, lit from the ring below, looking up into the song:
//               the corner of his mouth goes up (a slight smirk; no line)                   7.6–9.8
//            sound: the father's theme in Lorn's mode (sound.swell('father')) from the first
//            answer, the phrase of the singing light as the cave takes it (the caller's
//            ringHeart), its far echo; the controls come back with the cave still singing
//            (it sings for 14 s from its beat)
//
// What it shows is the caller's and applied for sure: the cave answers on B's beat (`rung`:
// the keepsake, then perdide.heart.rung, which rings the heart and tints the tank), and again,
// idempotently, at the end (a skip, a failure). The heart's page is not shown: its news (the
// tank's new band, the keepsake) is toasted at the end.
//
// Show, don't tell: the traveller says nothing, and reacts with his face only (m.look 'smirk').
// The phrase may sound like a voice from far away; nothing is said about whose.

// s per panel; ANSWER: s into the moment each crystal answers; RING: the cave takes the phrase;
// ECHO: the far phrase; SMIRK: s into D before his mouth goes up
export const CRYSTAL = { A: 2.4, B: 3.0, C: 2.2, D: 2.2, ANSWER: [2.9, 3.5, 4.1], RING: 4.7, ECHO: 6.3, SMIRK: 1.1 };
export const MOMENTS = [{ id: 'perdide.crystal', flag: 'perdide.moment.crystal', beat: 'the cave sings the light’s phrase back to the splinter' }];

/**
 * @param deps.heart   the ring's centre (on the cave floor)
 * @param deps.axis    the cave's long axis (flat)
 * @param deps.rung()  the cave answers (idempotent: the keepsake, perdide.heart.rung); returns true the first time
 * @param deps.phrase(vol)  the phrase of the singing light
 * @param deps.others  the people about (B's lens takes the shoulder away from them)
 */
export function setupPerdideMoments(ctx, { heart, axis, rung, phrase, others }) {
  const { player, sound, moments, toast, level } = ctx;
  const off = { crystal: () => false };
  if (!moments || !heart) return off;

  // the three crystals that answer first (of the nine round the ring: perdide.js), each with a light of its own (dark till then)
  const crystalAt = (i) => { const a = (i / 9) * Math.PI * 2; return heart.clone().add(V(Math.cos(a) * 2.3, 1.4 + (i % 3) * 0.35, Math.sin(a) * 2.3)); };
  const lights = [0, 1, 2].map(() => new THREE.Vector4(0, -1e5, 0, 0));
  level.lights?.push(...lights);
  const dark = (l) => l.set(0, -1e5, 0, 0);

  function crystal() {
    const P = player.pos.clone();
    // which way he stands from the ring (inside it: the way he faces)
    let d = V(P.x - heart.x, 0, P.z - heart.z);
    if (d.lengthSq() < 0.6) d = facing(player).negate();
    d.normalize();
    const side = rightOf(d);
    // B's shoulder: the one away from anyone walking near (Ysse tends the cave)
    const by = (others ?? []).filter((n) => n?.pos && n.pos.distanceTo(P) < 12).map((n) => side.dot(V(n.pos.x - P.x, 0, n.pos.z - P.z)));
    const sB = by.length && by.reduce((a, b) => a + Math.sign(b), 0) > 0 ? -1 : 1;
    // the cave runs along `axis`: the wide shot looks down it, from behind him
    const along = axis.clone().multiplyScalar(Math.sign(axis.dot(d)) || 1);
    const H = heart.clone();
    // the answering crystals: the three on the ring's far side from him, left to right
    const far = Math.atan2(-d.z, -d.x), k0 = Math.round((far / (Math.PI * 2)) * 9);
    const answer = [k0 - 1, k0, k0 + 1].map((i) => crystalAt(((i % 9) + 9) % 9));
    const farMid = H.clone().addScaledVector(d, -1.6).addScaledVector(UP, 1.5);
    const up = H.clone().addScaledVector(UP, 3.6);
    const chest = (out = V(0, 0, 0)) => out.copy(player.pos).addScaledVector(UP, 1.35);
    const B0 = CRYSTAL.A, C0 = B0 + CRYSTAL.B, D0 = C0 + CRYSTAL.C;
    let first = false;
    const ring = () => { if (rung()) first = true; };
    const a0 = Math.atan2(along.x, along.z);
    const m = moments.play({
      id: 'perdide.crystal', flag: 'perdide.moment.crystal', dur: D0 + CRYSTAL.D,
      shots: [
        // A: wide, down the cave from behind him: the ring, dark, and him raising the splinter at it
        { dur: CRYSTAL.A, from: { pos: H.clone().addScaledVector(along, 10.5).addScaledVector(side, 2.2).addScaledVector(UP, 4.6), look: H.clone().addScaledVector(UP, 1.2), fov: 50 },
          to: { pos: H.clone().addScaledVector(along, 9.0).addScaledVector(side, 1.8).addScaledVector(UP, 4.0), look: H.clone().addScaledVector(UP, 1.4), fov: 48 } },
        // B: over his shoulder (the side away from whoever walks the cave), past his raised hand across the
        // ring to its far crystals as they answer one by one
        { dur: CRYSTAL.B,
          from: { pos: P.clone().addScaledVector(d, 2.5).addScaledVector(side, 1.15 * sB).addScaledVector(UP, 2.0), look: farMid.clone(), fov: 46 },
          to: { pos: P.clone().addScaledVector(d, 2.0).addScaledVector(side, 0.95 * sB).addScaledVector(UP, 1.9), look: farMid.clone().addScaledVector(UP, 0.3), fov: 43 } },
        // C: high under the vault, a slow arc over the singing ring
        { dur: CRYSTAL.C, from: orbit({ at: H, r: 7.5, h: 6.2, a0: a0 + 0.9, a1: a0 + 1.35, dur: CRYSTAL.C, lookUp: 1.0, fov: 56, fov1: 54 }) },
        // D: his face, lit from the ring, looking up into the song
        { dur: CRYSTAL.D, clear: false, from: closeUp(player, { angle: 0.55, dur: CRYSTAL.D, drop: 0.14 }) },
      ],
      beats: [
        { t: CRYSTAL.ANSWER[0], run: () => { sound.critter?.('chime', 0.5); sound.swell?.('father', H.clone()); } },
        { t: CRYSTAL.ANSWER[1], run: () => sound.critter?.('chime', 0.6) },
        { t: CRYSTAL.ANSWER[2], run: () => sound.critter?.('chime', 0.7) },
        // the cave answers (the caller's: the heart rings, the walls take the phrase, the tank its colour)
        { t: CRYSTAL.RING, run: ring },
        // far off, the phrase once more, thin
        { t: CRYSTAL.ECHO, run: () => phrase?.(0.035) },
      ],
      onStart: (mm) => {
        mm.face = H.clone();
        mm.eyes = H.clone().addScaledVector(UP, 1.2);
      },
      onFrame: (mm, t) => {
        // one crystal, then another, then a third: each a light that comes up and holds, then gives way to the ring's
        for (let i = 0; i < 3; i++) {
          const k = smooth((t - CRYSTAL.ANSWER[i]) / 0.5) * (1 - 0.6 * smooth((t - CRYSTAL.RING - 1.2) / 1.5));
          if (k > 0.01) { const c = answer[i]; lights[i].set(c.x, c.y + 0.4, c.z, 9 * k); } else dark(lights[i]);
        }
        // he holds the splinter up into the ring, and lowers it before his face's panel
        const lift = t < 0.5 ? 0 : t < D0 ? smooth((t - 0.5) / 0.8) * (1 - smooth((t - D0 + 0.7) / 0.6)) : 0;
        player.aim = lift > 0.01 ? { k: lift, point: up, dir: up.clone().sub(chest()).normalize() } : null;
        // his eyes on the crystals as they answer, then up into the vault
        if (t > CRYSTAL.ANSWER[0] && t < CRYSTAL.RING) mm.eyes = answer[Math.min(2, Math.floor((t - CRYSTAL.ANSWER[0]) / 0.6))];
        else if (t >= CRYSTAL.RING) mm.eyes = H.clone().addScaledVector(UP, 4.5);
        mm.look = t > D0 + CRYSTAL.SMIRK ? 'smirk' : null;
      },
      onEnd: () => {
        player.aim = null;
        for (const l of lights) dark(l);
        ring();
        if (first) toast('Keepsake: A singing splinter');
        toast('The cave sings the phrase back to the splinter. Crystal-violet rises through your glass: a new colour band in the tank.');
      },
    });
    return !!m;
  }

  return { crystal };
}
