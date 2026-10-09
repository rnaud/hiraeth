import * as THREE from 'three';
import { spoken } from './tone.js';
import { makeMaterial } from '../materials.js';
import { closeUp } from './film.js';
import { QUESTS, PEOPLE, KEEPSAKE, ARRIVE_LINES, QUEST_ID as Q } from './lantern-data.js';

// The Lantern, alive (lantern-data.js has the words; src/levels/lantern.js the place).
//
//  - Ilen waits at the lantern's step, watching the bar. The quest ("We Heard You") is on from the
//    landing and points at her; the talk is the meeting, and ends with her coming home with you
//    (`finale.met`: the quest done, the world done, her keepsake).
//  - The first time you step up onto the island, a short filmed moment (src/story/moment.js): the
//    singing light comes down out of the dusk into the lantern's crown. Skippable; once a save.
//  - After the talk she shuts her house and walks down the bar to the ship, and goes aboard. Back
//    here later (after the true ending) she is at home, not here: the lantern keeps itself.

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const flat = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
/** s per panel of the light's arrival (A: him and the light coming down, B: the crown, C: his face). */
export const LANTERN_SHOTS = { A: 4.0, B: 4.0, C: 2.0 };
/** The light coming down: its radius (m) and the least it spans on screen (degrees). */
export const ORB = { R: 0.9, MIN_DEG: 3.2 };
/**
 * The light's scale `dist` m from the lens: its own (`k`) close to, never smaller on screen than
 * ORB.MIN_DEG far off. (At 0.9 m, 80 m up in the dusk it was a few pixels, all ink contour: a dark
 * disc until it reached the crown. The QC pass.)
 */
/**
 * A frame from `pos` with `low` in its lower part and `high` in its upper part: the look `lean` of the way
 * from one to the other, the lens wide enough (`spread` times the angle between them, within `min`..`max`
 * degrees) that both sit inside the letterbox.
 */
export function frameBoth(pos, low, high, { lean = 0.42, spread = 1.7, min = 48, max = 76 } = {}) {
  const a = low.clone().sub(pos).normalize(), b = high.clone().sub(pos).normalize();
  const ang = (a.angleTo(b) * 180) / Math.PI;
  const dir = a.clone().lerp(b, lean).normalize();
  return { look: pos.clone().addScaledVector(dir, 20), fov: Math.min(max, Math.max(min, ang * spread)) };
}
export const orbScale = (dist, k = 1) => Math.max(k, (dist * Math.tan((ORB.MIN_DEG * Math.PI) / 360)) / ORB.R);

export function setupLantern(ctx) {
  const { level, quests, dialogue, game, spawn, story, sound, player, toast = () => {}, moments = null } = ctx;
  const G = level.lantern;
  if (!G) return null;
  for (const q of QUESTS) quests.define(q);
  if (!quests.isStarted(Q) && !game.flag('finale.met')) quests.start(Q);
  if (quests.isActive(Q)) quests.track(Q);

  const S = G.spots;
  const ilen = spawn(PEOPLE.ilen, { route: [S.ilen.clone()], heading: 0.2 });
  quests.locate('ilen', () => ilen.pos);
  const ship = () => level.ship?.pos ?? level.spawn;
  const st = { leaving: false, aboard: !!game.flag('finale.met'), arrived: !!game.flag('lantern.moment.arrive') };
  if (st.aboard) ilen.object.visible = false;   // (aboard already, or home: the lantern keeps itself)

  quests.def(Q).onDone = () => {
    game.set('world.lantern.done', true);
    game.addKeepsake(KEEPSAKE);
    setTimeout(() => story?.complete?.(), 1200);
  };

  // after the meeting: she shuts the house and walks to the ship
  const leave = () => {
    if (st.leaving || st.aboard) return;
    st.leaving = true;
    const route = [S.house, S.step, S.isle, S.bar, ship()].map((p) => p.clone());
    let i = 0;
    ilen.follow = () => {
      while (i < route.length - 1 && flat(ilen.pos, route[i]) < 1.4) i++;
      return { pos: route[i], speed: 1.5, near: 0.4 };
    };
  };
  game.on('dialogue:end', ({ id } = {}) => { if (id === 'ilen' && game.flag('finale.met')) leave(); });

  // the light comes down into the crown, the first time you step up onto the island
  const arrive = () => {
    st.arrived = true;
    const top = G.top.clone();
    // three panels (the cinematics QC pass, docs/systems/cinematics-qc.md: before, the first framed empty
    // dusk with the lantern under the subtitle, and the second pulled in against the crown's rail):
    //   A behind him, wide, the lantern's crown above the caption and the light coming down to it;
    //   B across from the crown at its height, wide, as the light settles in; C his face, looking up
    const P = player.pos.clone(), d = V(top.x - P.x, 0, top.z - P.z);
    if (d.lengthSq() < 1) d.set(0, 0, -1);
    d.normalize();
    const r = V(-d.z, 0, d.x);
    // where it comes from: out past the crown as he sees it, high and a little aside (a fixed offset put it
    // behind the lens from some ways up onto the island)
    const from = top.clone().addScaledVector(d, 45).addScaledVector(r, -20).add(V(0, 40, 0));
    const orb = new THREE.Mesh(new THREE.SphereGeometry(ORB.R, 16, 12), makeMaterial({ color: '#fff4c8', glow: 1, flat: true }));
    orb.userData.noCollide = true;
    orb.position.copy(from);
    level.lantern.crown.parent?.add(orb);
    const m = moments?.play?.({
      id: 'lantern.arrive', flag: 'lantern.moment.arrive', dur: LANTERN_SHOTS.A + LANTERN_SHOTS.B + LANTERN_SHOTS.C,
      shots: [
        { dur: LANTERN_SHOTS.A, ease: 'linear', from: (t) => {
          const k = Math.min(1, t / LANTERN_SHOTS.A), lit = orb.getWorldPosition(V(0, 0, 0));
          const pos = P.clone().addScaledVector(d, -9 + 1.2 * k).addScaledVector(r, 2.5 - 0.3 * k).add(V(0, 2.4 - 0.2 * k, 0));
          // the crown low in the frame and the light coming down above it, both in from the start (the QC pass:
          // the light was above the frame until 3 s, and the dark moon in the dusk read as it)
          return { pos, ...frameBoth(pos, top, lit) };
        } },
        { dur: LANTERN_SHOTS.B, clear: false, from: { pos: top.clone().addScaledVector(d, -26).addScaledVector(r, 9).add(V(0, -1, 0)), look: top.clone().add(V(0, 0.5, 0)), fov: 34 },
          to: { pos: top.clone().addScaledVector(d, -23).addScaledVector(r, 8).add(V(0, -1.5, 0)), look: top.clone(), fov: 32 } },
        { dur: LANTERN_SHOTS.C, clear: false, from: closeUp(player, { angle: 0.55, dur: LANTERN_SHOTS.C, drop: 0.2 }) },
      ],
      // (in time order: the moment runs its beats in the order given, so the chime listed last came at 4.8 s)
      beats: [
        { t: 0.2, run: () => sound?.chime?.() },
        { t: 0.4, line: spoken('scene', ARRIVE_LINES[0]), secs: 3.6 },
        { t: LANTERN_SHOTS.A + 0.3, line: spoken('scene', ARRIVE_LINES[1]), secs: 3.8 },
      ],
      onStart: (mm) => { mm.face = top.clone(); mm.eyes = top.clone(); },
      onFrame: (mm, t) => {
        orb.position.lerpVectors(from, top, Math.min(1, t / 7) ** 0.7);
        // (glowing from the start: never so small far off that its contour is all there is of it)
        const lens = mm.camera?.()?.pos, at = orb.getWorldPosition(mm.eyes);
        orb.scale.setScalar(orbScale(lens ? lens.distanceTo(at) : 0, 1 - Math.min(1, t / 8) * 0.4));
      },
      onEnd: () => { orb.removeFromParent(); game.set('lantern.moment.arrive', true); },
    });
    if (!m) { orb.removeFromParent(); game.set('lantern.moment.arrive', true); }
  };

  const update = (dt) => {
    if (!st.arrived && !st.aboard && !dialogue.open && flat(player.pos, S.isle) < 14) arrive();
    if (st.leaving && !st.aboard && flat(ilen.pos, ship()) < 3) {
      st.aboard = true;
      ilen.follow = null;
      ilen.object.visible = false;
      toast('Ilen goes up the ramp into the ship, one hand on the hull.');
    }
    void dt;
  };

  return { people: { ilen }, update, state: st, arrive };
}
