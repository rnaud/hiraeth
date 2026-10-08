import * as THREE from 'three';
import { spoken } from './tone.js';
import { makeMaterial } from '../materials.js';
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
    const top = G.top.clone(), from = top.clone().add(V(-30, 40, 60));
    const orb = new THREE.Mesh(new THREE.SphereGeometry(0.9, 16, 12), makeMaterial({ color: '#fff4c8', glow: 1, flat: true }));
    orb.userData.noCollide = true;
    orb.position.copy(from);
    level.lantern.crown.parent?.add(orb);
    const m = moments?.play?.({
      id: 'lantern.arrive', flag: 'lantern.moment.arrive', dur: 9,
      shots: [
        { dur: 4.5, from: { pos: player.pos.clone().add(V(4, 1.6, 6)), look: top.clone().add(V(-10, 14, 20)), fov: 48 }, to: { pos: player.pos.clone().add(V(3, 1.4, 5)), look: top.clone().add(V(-3, 4, 6)), fov: 44 } },
        { dur: 4.5, from: { pos: top.clone().add(V(9, -8, 22)), look: top.clone(), fov: 40 }, to: { pos: top.clone().add(V(7, -9, 18)), look: top.clone().add(V(0, -1, 0)), fov: 38 } },
      ],
      beats: [
        { t: 0.4, line: spoken('scene', ARRIVE_LINES[0]), secs: 4 },
        { t: 4.8, line: spoken('scene', ARRIVE_LINES[1]), secs: 4 },
        { t: 0.2, run: () => sound?.chime?.() },
      ],
      onFrame: (mm, t) => { orb.position.lerpVectors(from, top, Math.min(1, t / 7) ** 0.7); orb.scale.setScalar(1 - Math.min(1, t / 8) * 0.4); },
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
