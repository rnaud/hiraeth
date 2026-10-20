import * as THREE from 'three';
import { NPC, registerNPCTargets } from '../npc.js';
import { makeMaterial } from '../materials.js';
import { items as sharedItems } from '../items.js';
import { fragmentCounts } from '../fragments-data.js';
import { FragmentShop } from '../fragment-shop.js';
import { THRUM, THRUM_SHOP_LINES, thrumPerson } from './scientist-data.js';
import { ARRIVAL, arrivalFrom, arrivalShots, runSpeed, runTime } from './scientist-arrival.js';

// The scientist (src/story/scientist-data.js: Anselm Thrum; docs/systems/fragments.md). src/story/index.js sets him
// up in every world:
//
//   setupScientist({ levelId, scene, physics, level, ship, npcs, lib, humans, game, items, talkable, dialogue, player, toast, moments })
//     → { def, aboard, field, meet(), arrive(), update(dt), jar, shop, shopEntry() }
//
// Once met (`frag.met`) he lives aboard the ship, in the hold by the crates (ABOARD, ship-local), in every world, and
// talks there: his count, and his shop (v1.62, issue #185: his upgrades for fragments, src/fragment-shop.js; main.js
// opens shopEntry() in the shop panel on game 'shop:open' { shop: 'thrum' }). Before that he is nowhere; the first
// fragment you pick up (game 'fragment', src/fragments.js) brings him, filmed (issue #550, src/story/scientist-arrival.js):
// he runs in from out of sight to his spot beside you (meetSpot), out of breath, and the talk opens; where it can't be
// filmed (no way in for him, no stage) he comes up beside you and the talk opens at once, as before. Once that talk has opened he is met, however it ends (`frag.met`: B out of it too). The one who met
// you stays where he met you until you are far off or aboard, then is gone (he is in the hold by then). While the ship
// flies (an arrival's landing, a take-off: its hull off where it is parked) he is out of sight in the shut hull, and
// back in his place once it is down. On the crate beside him, a jar of what you have brought him, a splinter for each
// (up to JAR_MAX), glowing.

const UP = new THREE.Vector3(0, 1, 0);
/** His place aboard (ship-local, src/ship/interior.js: the hold, in front of the starboard crate, facing the doorway). */
export const ABOARD = { at: [1.55, 0, 19.75], heading: -2.4, jar: [1.2, 0.71, 20.52] };   // (the hold moved aft and grew: issue #195; the ship twice the size, #338: z 9.45 / 10.22 before)
/** At most this many splinters in his jar. */
export const JAR_MAX = 24;
/**
 * His lamp (v1.86, issue #481: bought for fragments, src/fragment-shop.js THRUM_WARES 'lamp'): the jar lit, a light in
 * the hold whose reach grows with every fragment found, past the jar's 24 (`lampReach(found)`, m), and a glow in the jar.
 */
export const LAMP = { base: 2.2, per: 0.035, max: 9 };
export const lampReach = (found) => Math.min(LAMP.max, LAMP.base + LAMP.per * Math.max(0, found));
/** How far off the one who met you goes. */
const FIELD_GONE = 40;

/** Where he comes up beside you for the first meeting: a few steps off, on ground near yours, with room and nothing between. */
export function meetSpot({ physics, level, at, heading = 0 }) {
  if (!physics || !at) return null;
  const eye = at.clone().addScaledVector(UP, 1.2);
  for (const r of [4.5, 3.5, 6]) {
    for (let k = 0; k < 12; k++) {
      const a = heading + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * (Math.PI / 6) + 0.6;
      const p = at.clone().add(new THREE.Vector3(Math.sin(a) * r, 0, Math.cos(a) * r));
      const g = physics.groundAt(p.x, at.y + 2, p.z, 5);
      if (!Number.isFinite(g) || Math.abs(g - at.y) > 1.2) continue;
      p.y = g;
      if (level?.unsafe?.(p)) continue;
      if (physics.rayDistance(p.clone().addScaledVector(UP, 0.3), UP, 2) < 1.9) continue;
      const to = p.clone().addScaledVector(UP, 1.2).sub(eye), d = to.length();
      if (physics.rayDistance(eye, to.normalize(), d) < d - 0.3) continue;
      return { at: p, heading: Math.atan2(at.x - p.x, at.z - p.z) };
    }
  }
  return null;
}

/** His jar on the crate: glass, and a splinter for each fragment brought (up to JAR_MAX). */
function buildJar() {
  const g = new THREE.Group();
  g.name = 'thrum.jar';
  g.userData.noCollide = true;
  // (a brass-bound jar with no glass drawn: its foot, its lid and four ribs, so the splinters inside show)
  const brass = makeMaterial({ color: '#c58d4a', flat: true });
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.03, 14).translate(0, 0.015, 0), brass));
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.135, 0.135, 0.04, 14).translate(0, 0.32, 0), brass));
  for (let k = 0; k < 4; k++) { const a = (k / 4) * Math.PI * 2; g.add(new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.3, 0.012).translate(Math.cos(a) * 0.125, 0.165, Math.sin(a) * 0.125), brass)); }
  const geo = new THREE.OctahedronGeometry(0.042, 0).scale(0.75, 1.9, 0.75), mat = makeMaterial({ color: '#dff7ff', glow: 1, flat: true });
  const bits = [];
  for (let i = 0; i < JAR_MAX; i++) {
    const a = i * 2.4, r = 0.03 + 0.06 * ((i * 37) % 10) / 10;
    const m = new THREE.Mesh(geo, mat);
    m.position.set(Math.cos(a) * r, 0.04 + Math.floor(i / 6) * 0.05, Math.sin(a) * r);
    m.rotation.set(i * 0.7, i, i * 0.3);
    m.visible = false;
    g.add(m); bits.push(m);
  }
  // (his lamp: a glow in the jar, larger with the count; hidden until it is bought)
  const glow = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 8), makeMaterial({ color: '#fff3c4', glow: 1, flat: true }));
  glow.position.y = 0.17;
  glow.visible = false;
  g.add(glow);
  return {
    group: g, glow,
    show(n) { bits.forEach((b, i) => { b.visible = i < n; }); },
    lamp(on, found = 0) { glow.visible = on; glow.scale.setScalar(on ? 0.6 + 0.9 * Math.min(1, found / 200) : 1); },
  };
}

export function setupScientist({ levelId, scene, physics, level, ship = null, npcs = [], lib = null, humans = null, game, items = sharedItems, talkable, dialogue = null, player = null, sound = null, moments = null }) {
  if (!game) return null;
  const flags = () => game.data?.flags ?? {};
  const def = thrumPerson({ flags, has: (id) => items.has(id), here: levelId });
  const make = (at, heading) => {
    const npc = new NPC(scene, physics, {
      route: [at.clone()], palette: def.palette, lines: def.lines, lib, human: humans ? humans[0] : null, kind: def.kind,
      scale: def.scale, head: def.head, cape: def.cape, look: def.look, world: def.world, def, speed: 0.6, facing: heading,
    });
    npc.heading = heading;
    npcs.push(npc);
    registerNPCTargets([npc]);
    npc.untalk = talkable?.(npc, def);
    return npc;
  };
  const drop = (npc) => {
    npc.untalk?.();
    const k = npcs.indexOf(npc);
    if (k >= 0) npcs.splice(k, 1);
    npc.show?.(false);
    npc.object.visible = false;
  };
  const rt = { def, aboard: null, field: null, jar: null, pending: false, meeting: false, shop: new FragmentShop({ game, items }) };
  /** His shop, for the shop panel (src/shop-panel.js open: kind 'fragments'). */
  rt.shopEntry = () => ({ kind: 'fragments', shop: { id: 'thrum', label: THRUM.name }, logic: rt.shop, keeper: THRUM, lines: THRUM_SHOP_LINES, npc: rt.aboard ?? rt.field });

  // aboard, by the crates (with the ship parked here)
  const board = () => {
    if (rt.aboard || !ship?.parked || !scene || !physics) return;
    const m = ship.parked;
    const at = ship.world(m, new THREE.Vector3(...ABOARD.at));
    rt.aboard = make(at, ship.worldHeading(m, ABOARD.heading));
    const jar = buildJar();
    jar.group.position.set(...ABOARD.jar);
    m.group.add(jar.group);
    // (drawn with the rooms, only with the camera near enough to see in: src/ship/ship.js update, m.indoor; its 30 pieces
    // were drawn from anywhere the ship was in view, through its hull)
    m.indoor?.push(jar.group);
    if (m.indoorShown !== undefined) jar.group.visible = m.indoorShown;
    rt.jar = jar;
    const found = fragmentCounts(flags()).found;
    jar.show(Math.min(JAR_MAX, found));
    jar.lamp(!!game.flag('thrum.lamp'), found);
  };
  // his lamp's light in the hold (bought: issue #481), where the jar is, its reach the count's
  const lampLight = new THREE.Vector4(0, -1e5, 0, 0);
  const lights = level ? (level.lights ??= []) : null;
  const _jp = new THREE.Vector3();
  const lampOn = () => !!rt.jar && !!game.flag('thrum.lamp');
  // (the light's tune, bought: he plays it whole when asked, issue #481)
  const offTune = game.on?.('thrum:tune', () => sound?.lightTheme?.({ vol: 0.9 }));
  const offBought = game.on?.('thrum:bought', (e) => { if (e?.ware === 'lamp') rt.jar?.lamp(true, fragmentCounts(flags()).found); });
  if (game.flag('frag.met')) board();
  const offFrag = game.on?.('fragment', (e) => {
    rt.jar?.show(Math.min(JAR_MAX, e.found));
    if (lampOn()) rt.jar.lamp(true, e.found);
    if (!game.flag('frag.met')) rt.pending = true;
  });

  const spotNow = () => meetSpot({ physics, level, at: player.pos, heading: player.heading ?? 0 })
    ?? { at: player.pos.clone().add(new THREE.Vector3(-Math.sin(player.heading ?? 0) * 2.5, 0, -Math.cos(player.heading ?? 0) * 2.5)), heading: player.heading ?? 0 };
  /** The talk opens with him (the meeting's: "Don't drop it!"). */
  const talkNow = () => { rt.meeting = dialogue?.start(def, rt.field) !== false; };

  /** The first meeting: he comes up beside you, and the talk opens (now, or as soon as nothing else has the screen). */
  rt.meet = () => {
    if (game.flag('frag.met') || rt.field || !player || !scene || !physics) return false;
    const spot = spotNow();
    rt.field = make(spot.at, spot.heading);
    rt.pending = false;
    talkNow();
    return true;
  };

  /**
   * The first meeting, filmed (issue #550): he runs in from out of sight to his spot beside you, winded, and the talk
   * opens. Where there is no way in for him or no stage to film it on, rt.meet(): beside you at once. → the Moment, or null.
   */
  rt.arrive = () => {
    if (game.flag('frag.met') || rt.field || !player || !scene || !physics) return null;
    if (!moments?.canPlay?.()) { rt.meet(); return null; }
    const spot = spotNow();
    const eye = player.pos.clone().add(new THREE.Vector3(0, 1.6, 0));
    const toward = ship?.parked?.group?.position ?? null;
    const from = arrivalFrom({ physics, level, meet: spot.at, eye, toward });
    if (!from) { rt.meet(); return null; }
    const M = spot.at.clone(), P = player.pos.clone();
    const npc = make(from.at.clone(), Math.atan2(M.x - from.at.x, M.z - from.at.z));
    npc.facing = null;
    rt.field = npc;
    rt.pending = false;
    rt.arrival = { from, spot, run: runTime(Math.hypot(M.x - from.at.x, M.z - from.at.z)), done: false };
    // (his run: toward his spot at the run's pace, slowing over the last metres: src/npc.js follow)
    const fol = { pos: M, near: ARRIVAL.near, speed: ARRIVAL.run, max: ARRIVAL.run };
    const flat = () => Math.hypot(npc.pos.x - M.x, npc.pos.z - M.z);
    npc.follow = () => fol;
    const arrived = () => {
      npc.follow = null;
      npc.facing = spot.heading;
      npc.winded = 1;
      rt.winded = ARRIVAL.windedFor;
    };
    const { shots, dur } = arrivalShots({ P, M, S: from.at, run: rt.arrival.run, him: () => npc.pos, physics }, ARRIVAL);
    const head = new THREE.Vector3();
    // (his box's ticking, quickening as he comes: the finder's beep, src/audio.js)
    const tick = { at: 0.35 };
    const m = moments.play({
      id: ARRIVAL.id, dur, shots, behind: true,
      onFrame: (mm, t) => {
        const left = flat();
        if (npc.follow) {
          fol.speed = fol.max = runSpeed(left);
          if (left < ARRIVAL.near + 0.05) arrived();
        }
        // the traveller turns to him and watches him come
        mm.face = npc.pos;
        mm.eyes = head.copy(npc.pos).setY(npc.pos.y + 1.6);
        if (t >= tick.at && npc.follow) { sound?.finderBeep?.(1500 - 600 * Math.min(1, left / 24)); tick.at = t + 0.16 + 0.03 * Math.min(left, 14); }
      },
      onEnd: () => {
        // (skipped or cut short: on his spot all the same, facing you, out of breath)
        if (npc.follow || flat() > 0.6) { npc.pos.copy(M); npc.object.position.copy(M); npc.heading = spot.heading; arrived(); }
        rt.arrival.done = true;
        talkNow();
      },
    });
    if (!m) {
      // (it couldn't be filmed after all: he is beside you, as before)
      npc.follow = null; npc.pos.copy(M); npc.heading = spot.heading; npc.facing = spot.heading;
      talkNow();
    }
    return m;
  };

  /** The ship off where it is parked (flying in, taking off): its hull shut, him out of sight in it. */
  const flying = () => {
    const g = ship?.parked?.group, rest = ship?.restPos;
    return !!(g && rest && g.position.distanceToSquared(rest) > 0.01);
  };

  rt.update = (dt = 1 / 60) => {
    // (the first fragment: once nothing else has the screen, and he is on his feet, or has been in the air a while)
    if (rt.pending && !dialogue?.open && !ship?.playing && !moments?.playing) {
      rt.airT = player && player.onGround === false ? (rt.airT ?? 0) + dt : 0;
      if (!(rt.airT > 0 && rt.airT < 2.5)) { if (moments) rt.arrive(); else rt.meet(); }
    }
    // (winded from his run: his breath back over the talk's first lines)
    if (rt.field && rt.winded > 0 && !moments?.playing) { rt.winded -= dt; rt.field.winded = Math.max(0, Math.min(1, rt.winded / 1.5)); }
    if (lights) {
      const on = lampOn() && !rt.aboard?.away;
      const k = lights.indexOf(lampLight);
      if (on) {
        rt.jar.group.getWorldPosition(_jp);
        lampLight.set(_jp.x, _jp.y + 0.6, _jp.z, lampReach(fragmentCounts(flags()).found));
        if (k < 0) lights.push(lampLight);
      } else if (k >= 0) lights.splice(k, 1);
    }
    // (the meeting's talk opened: he is met however it ended, so he is aboard from now on, in every world)
    if (rt.meeting && !dialogue?.open) { rt.meeting = false; if (!game.flag('frag.met')) game.set('frag.met', true); }
    if (rt.aboard) {
      const away = flying();
      if (away !== !!rt.aboard.away) {
        rt.aboard.away = away;
        // (down again: back on his spot by the crate, facing the doorway)
        if (!away) { rt.aboard.pos.copy(ship.world(ship.parked, new THREE.Vector3(...ABOARD.at))); rt.aboard.heading = ship.worldHeading(ship.parked, ABOARD.heading); }
      }
    }
    if (rt.field) {
      if (game.flag('frag.met')) board();
      const far = player && rt.field.pos.distanceTo(player.pos) > FIELD_GONE;
      const aboardNow = ship?.parked && player && ship.isInside(ship.parked, player.pos);
      if (!dialogue?.open && game.flag('frag.met') && (far || aboardNow)) { drop(rt.field); rt.field = null; }
    }
  };
  rt.dispose = () => {
    offFrag?.(); offTune?.(); offBought?.(); rt.jar?.group.removeFromParent();
    const k = lights?.indexOf(lampLight) ?? -1;
    if (k >= 0) lights.splice(k, 1);
  };
  return rt;
}

export { THRUM };
