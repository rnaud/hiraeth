import * as THREE from 'three';
import { spoken, stripTone } from './tone.js';
import { makeMaterial } from '../materials.js';
import { closeUp } from './film.js';
import { t as tr } from '../i18n.js';
import { QUESTS, PEOPLE, KEEPSAKE, ARRIVE_LINES, LAMPS, ANSWER, LAMP_LINES, ANSWERED_LINES, QUEST_ID as Q } from './lantern-data.js';

// The Lantern, alive (lantern-data.js has the words; src/levels/lantern.js the place).
//
//  - The quest ("We Heard You") is on from the landing: the sand bar to the island, then the light's song, then
//    Ilen. The talk is the meeting, and ends with her coming home with you (`finale.met`: the quest done, the
//    world done, her keepsake).
//  - The first time you step up onto the island, a short filmed moment (src/story/moment.js): the
//    singing light comes down out of the dusk into the lantern's crown. Skippable; once a save.
//  - Then the light sings to the keepers' three lamps round the shore (LAMPS), one at a time, a beam from the crown
//    on the one it sings to. A whistle within ANSWER.reach of an unlit lamp (the game's 'whistle', 'bell' or 'echo':
//    src/boxes/effects.js ring) lights it (`lantern.lamp.<i>`). The third rings the island (`lantern.answered`):
//    a short moment at the round house, and Ilen comes out to the lantern's step. Until then she is indoors.
//    (A save from before v1.47 that had met her, or was already at her stage, finds her on the step.)
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
  // (indoors until someone answers the light; on the step for a save that met her or was waiting at her stage already)
  const outside = () => !!(game.flag('lantern.answered') || game.flag('met.ilen') || quests.stage(Q) === 'ilen');
  const ilen = spawn(PEOPLE.ilen, { route: [S.ilen.clone()], heading: 0.2 });
  quests.locate('ilen', () => ilen.pos);
  quests.locate('isle', () => S.isle);
  const ship = () => level.ship?.pos ?? level.spawn;
  const st = { leaving: false, aboard: !!game.flag('finale.met'), arrived: !!game.flag('lantern.moment.arrive'), landed: !!game.flag('lantern.moment.arrive'), out: outside(), sing: 0 };
  // (`away`: hidden whatever the distance, src/npc.js; aboard already, or home: the lantern keeps itself)
  const away = (on) => { ilen.away = on; if (on) ilen.object.visible = false; };
  if (st.aboard) away(true);
  else if (!st.out) { away(true); ilen.pos.copy(S.house); }

  // ---- the keepers' lamps: the light sings to each in turn, and a whistle by it answers
  const lamps = setupLamps(ctx, G);
  const lit = (i) => !!game.flag(`lantern.lamp.${i}`);
  const current = () => LAMPS.findIndex((_, i) => !lit(i));
  quests.locate('lamp', () => lamps.at(Math.max(0, current())));
  for (let i = 0; i < LAMPS.length; i++) lamps.light(i, lit(i) || st.out);
  const answer = (pos) => {
    if (st.out || st.aboard || !pos || dialogue.open) return;
    const i = LAMPS.findIndex((_, k) => !lit(k) && flat(pos, lamps.at(k)) < ANSWER.reach);
    if (i < 0) return;
    game.set(`lantern.lamp.${i}`, true);
    lamps.light(i, true);
    sound?.orbNote?.(2 + i * 2, lamps.at(i), { size: 0.6 });
    if (LAMPS.every((_, k) => lit(k))) answered();
    else toast(stripTone(LAMP_LINES[Math.min(i, LAMP_LINES.length - 1)]));
  };
  const offs = [
    game.on('whistle', (e) => { sound?.whistle?.('mount'); answer(e?.pos ?? player.pos); }),
    game.on('bell', (e) => { if (!e?.soft) answer(e?.pos ?? player.pos); }),
    game.on('echo', (e) => answer(e?.pos ?? player.pos)),
  ];
  // all three: the island rings, and she comes out to the step
  const comeOut = () => {
    st.out = true;
    away(false);
    ilen.object.visible = true;
    ilen.pos.copy(S.house);
    const route = [S.house, S.ilen].map((p) => p.clone());
    let i = 0;
    ilen.follow = () => {
      while (i < route.length - 1 && flat(ilen.pos, route[i]) < 1.2) i++;
      if (i === route.length - 1 && flat(ilen.pos, route[i]) < 0.6) { ilen.follow = null; return null; }
      return { pos: route[i], speed: 1.3, near: 0.4 };
    };
  };
  const answered = () => {
    game.set('lantern.answered', true);
    lamps.ring();
    sound?.chime?.();
    const door = S.house.clone(), look = door.clone().add(V(0, 1.2, 0));
    const from = S.step.clone().lerp(door, 0.35).add(V(3, 2.2, 3));
    const m = moments?.play?.({
      id: 'lantern.answered', flag: 'lantern.moment.answered', dur: 5.5,
      shots: [{ dur: 5.5, from: { pos: from, look, fov: 46 }, to: { pos: from.clone().add(V(-0.6, -0.2, -0.6)), look: S.ilen.clone().add(V(0, 1.2, 0)), fov: 44 } }],
      beats: [
        { t: 0.2, line: spoken('scene', ANSWERED_LINES[0]), secs: 2.6 },
        { t: 2.0, run: comeOut },
        { t: 2.9, line: spoken('scene', ANSWERED_LINES[1]), secs: 2.4 },
      ],
      onEnd: () => { if (!st.out) comeOut(); },
    });
    if (!m) { toast(ANSWERED_LINES.map(stripTone).join(' ')); comeOut(); }
  };

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
      onEnd: () => { orb.removeFromParent(); game.set('lantern.moment.arrive', true); st.landed = true; },
    });
    if (!m) { orb.removeFromParent(); game.set('lantern.moment.arrive', true); st.landed = true; }
  };

  const update = (dt, t = 0) => {
    if (!st.arrived && !st.aboard && !dialogue.open && flat(player.pos, S.isle) < 14) arrive();
    // the light's song to the lamp it is on, while nobody has answered all three
    const on = st.landed && !st.out && !st.aboard ? current() : -1;
    lamps.update(dt, t, on);
    if (on >= 0 && (st.sing -= dt) <= 0) { st.sing = ANSWER.every; sound?.orbNote?.(2 + on * 2, G.top, { size: 0.9, vol: 0.7 }); }
    // (the whistle taught once, as the song begins: the step itself names no button)
    if (on >= 0 && !dialogue.open && !game.flag('lantern.song.told')) { game.set('lantern.song.told', true); toast(tr('teach.lanternWhistle')); }
    if (st.leaving && !st.aboard && flat(ilen.pos, ship()) < 3) {
      st.aboard = true;
      ilen.follow = null;
      away(true);
      toast('Ilen goes up the ramp into the ship, one hand on the hull.');
    }
    void dt;
  };

  const dispose = () => { for (const off of offs) off?.(); lamps.dispose(); };
  return { people: { ilen }, update, dispose, state: st, arrive, lamps, answer };
}

/**
 * The keepers' three lamps (LAMPS) and the light's beam: story props, nothing to stand on (a post, a glass cup that
 * lights; a thin beam from the crown to the lamp it sings to). { at(i), light(i, on), ring(), update(dt, t, on), dispose() }.
 */
function setupLamps({ physics = null, scene = null }, G) {
  const ground = (x, z) => { const y = physics?.groundAt?.(x, 30, z); return Number.isFinite(y) ? y : 0.4; };
  const root = new THREE.Group();
  root.name = 'The keepers’ lamps';
  const post = makeMaterial({ color: '#8a6a52', flat: true }), ink = makeMaterial({ color: '#2b211f', flat: true });
  const dark = makeMaterial({ color: '#cdbfae', flat: true }), glow = makeMaterial({ color: '#fff2c2', glow: 1, flat: true });
  const beamMat = makeMaterial({ color: '#fff4c8', glow: 1, flat: true, transparent: true, opacity: 0.5 });
  const list = LAMPS.map(([x, z]) => {
    const y = ground(x, z), g = new THREE.Group();
    g.position.set(x, y, z);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 1.7, 6), post); pole.position.y = 0.85;
    const cup = new THREE.Mesh(new THREE.SphereGeometry(0.26, 12, 8), dark); cup.position.y = 1.95;
    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.22, 10), ink); cap.position.y = 2.3;
    g.add(pole, cup, cap);
    root.add(g);
    return { g, cup, top: new THREE.Vector3(x, y + 1.95, z), on: false };
  });
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1, 6, 1, true).translate(0, 0.5, 0), beamMat);
  beam.visible = false;
  root.add(beam);
  root.traverse((o) => { o.userData.noCollide = true; o.userData.dynamic = true; });
  scene?.add(root);
  const _d = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);
  let ringT = 0;
  return {
    at: (i) => list[i].top,
    light(i, on) { const L = list[i]; L.on = !!on; L.cup.material = on ? glow : dark; },
    ring() { ringT = 2.4; },
    update(dt, t, on) {
      ringT = Math.max(0, ringT - dt);
      for (const L of list) L.cup.scale.setScalar(L.on ? 1 + 0.08 * Math.sin(t * 2.6) + ringT * 0.25 : 1);
      beam.visible = on >= 0;
      if (on < 0) return;
      // from the crown down to the lamp it sings to, breathing as it sings
      const from = G.top, to = list[on].top;
      _d.subVectors(to, from);
      beam.position.copy(from);
      beam.scale.set(1 + 0.4 * Math.sin(t * 3), _d.length(), 1 + 0.4 * Math.sin(t * 3));
      beam.quaternion.setFromUnitVectors(UP, _d.normalize());
    },
    dispose() { root.removeFromParent(); },
  };
}
