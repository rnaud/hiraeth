import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeMaterial } from '../materials.js';
import { registerTarget } from '../targets.js';
import { registerInteractable, PRIORITY } from '../interact.js';
import { Banner } from '../life.js';
import { STORY } from '../desert-sites.js';
import { COOL_FIRE, FIRE, SMOKE_COOL } from './flames.js';
import { setMagic } from './magic-water.js';
import { QUESTS, PEOPLE, THINGS, LINES, ITEMS, CROWD_TALK, STAGE_MIGRATION, VILLAGERS, MURMURS, VILLAGER_TALK } from './desert-data.js';
import { items } from '../items.js';
import { setupHoverbike } from './desert-bike.js';

// The desert's story, alive: who stands where, what reacts to you, and the
// chain of the main quest (desert-data.js has the words).
//
//   the camps    Ama by the main fire; Sefa (oud), Bako (ney) and Teo on the
//                benches; Ilo running between the tents; Marrow by his crates
//   the circuit  the Speaker walks ahead of the procession (crowd.js column)
//   the city     Hessa keeps the dry well at the burning tree's roots; beside
//                it the Givers' shrine with the makers' chest (src/boxes/: the
//                backpack), Nour the eldest on her bench by it, and a few
//                people of Qanat about the terraces and the avenue
//   the dunes    old Oum sits on a stone where she fell behind
//   the cave     the pool, the fallen rib across the channel, the mural
//
// The reaction at the shrine: the first time you come near the closed chest,
// the people on the terrace turn and murmur and the tree flares; when it opens
// (box:opened), Qanat gathers round the shrine, the tree flares high, everyone
// in the avenue looks up, and Nour gets up off her bench, comes to you and
// talks (the 'elder' stage). Until the chest is open, the camps, the gate and
// the procession wave you on toward the city.
//
// Flags (game-state.js): desert.city.entered, desert.shrine.gathered (the
// reaction played), desert.elder.heard (Nour sent you on), desert.quest.v
// (the stage migration), desert.camps.seen, desert.jar.given,
// desert.speaker.heard, desert.well.seen, desert.cave.seen,
// desert.channel.open (the rib is pushed clear: the tree drinks),
// desert.jar.filled, desert.ship.fed, desert.pool.tinted (the first wade
// added a colour to the tool), desert.teo.drumming, desert.ilo.following,
// desert.ilo.atSkull, desert.oum.following, desert.oum.home, and a few
// "read" flags for the carvings. Items: jar, water, drum, cord.

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const _v = V(0, 0, 0), _w = V(0, 0, 0);
const flat = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const EARLY = ['city', 'box'];   // the main quest's stages before the chest is open

/**
 * Old saves (desert.quest.v < 2): the stages before the cave moved (the box is
 * in the city now, then Nour). An old stage goes where STAGE_MIGRATION says;
 * the steps already done advance at once on their flags. Returns the new
 * stage, or null if nothing changed.
 */
export function migrateDesertQuest(game) {
  if ((game.flag('desert.quest.v') ?? 0) >= 2) return null;
  const s = game.flag('quest.desert.power');
  const to = STAGE_MIGRATION[s] ?? null;
  if (to) game.set('quest.desert.power', to);
  game.set('desert.quest.v', 2);
  return to;
}

export function setupDesert(ctx) {
  const { level, physics, player, crowd, quests, dialogue, game, sound, story, spawn, talkable, scene, toast, tool } = ctx;
  const Q = level.qanat;
  if (!Q) return null;
  const city = Q.city, camps = Q.camps, cave = Q.cave;
  migrateDesertQuest(game);
  for (const q of QUESTS) quests.define(q);
  quests.itemNames = ITEMS;
  // the main quest: power for the ship (unless the ship already has it)
  if (!quests.isStarted('desert.power') && !game.flag('ship.powered')) quests.start('desert.power');

  const ground = (p, from = 4) => { const g = physics.groundAt(p.x, p.y + from, p.z); return Number.isFinite(g) ? g : p.y; };
  const onGround = (p) => V(p.x, ground(V(p.x, p.y, p.z), 3), p.z);
  const loop = (c, r, n = 4, a0 = 0) => Array.from({ length: n }, (_, i) => { const a = a0 + i / n * Math.PI * 2; return onGround(V(c.x + Math.sin(a) * r, c.y, c.z + Math.cos(a) * r)); });

  // ---------------------------------------------------------------- the people
  const seat = (i) => Q.seats.find((s) => s.fire.big && s.i === i);
  const people = {};
  const fire = camps.fires[0];
  people.ama = spawn(PEOPLE.ama, { route: loop(V(fire.x, fire.y, fire.z), 2.7, 5, 0.3), speed: 0.7 });
  for (const [id, k] of [['sefa', 0], ['bako', 1], ['teo', 2]]) {
    const s = seat(k);
    people[id] = spawn(PEOPLE[id], { route: [s.at.clone()], seat: 0.02, heading: s.heading });
  }
  const iloHome = camps.spot(9, 16);
  const iloRoute = loop(V(iloHome.x, iloHome.y, iloHome.z), 7, 5);
  people.ilo = spawn(PEOPLE.ilo, { route: iloRoute, speed: 2.4 });
  const marrowAt = camps.spot(-19, -14);
  people.marrow = spawn(PEOPLE.marrow, { route: loop(marrowAt, 1.6, 3), speed: 0.6 });
  // Hessa sweeps round the well on the top terrace
  const wellC = city.well;
  people.hessa = spawn(PEOPLE.hessa, { route: [0.9, 2.2, 3.6].map((a) => onGround(V(wellC.x + Math.sin(a + city.yaw) * 3.6, wellC.y, wellC.z + Math.cos(a + city.yaw) * 3.6))), speed: 0.5 });
  // the Speaker walks a few steps ahead of the procession
  const head = V(0, 0, 0);
  people.speaker = spawn(PEOPLE.speaker, {
    route: [onGround(crowd?.columnHead('procession', 4) ?? city.gate.clone())],
    follow: () => {
      if (!crowd?.route('procession')) return null;
      crowd.columnHead('procession', 4.5, head);
      head.y = ground(head, 3);
      return { pos: head, speed: crowd.route('procession').column.speed, near: 0.6, max: 3 };
    },
  });
  // Oum: on her stone in the dunes, or following you, or home by the fire
  const oumStone = onGround(V(STORY.pilgrim.x, 0, STORY.pilgrim.z).setY(level.ground.heightAt(STORY.pilgrim.x, STORY.pilgrim.z)));
  const oumSeat = seat(3);
  const oumFollow = V(0, 0, 0);
  let oumWaitT = 0;
  people.oum = spawn(PEOPLE.oum, {
    route: [game.flag('desert.oum.home') ? oumSeat.at.clone() : oumStone.clone()],
    seat: game.flag("desert.oum.home") ? 0.02 : game.flag('desert.oum.following') ? null : 0.45,
    heading: game.flag('desert.oum.home') ? oumSeat.heading : 1.2,
  });
  const oum = people.oum;
  // Nour: on her bench by the Givers' shrine, keeping the makers' chest company (desert-city.js)
  const shrine = city.shrine;
  people.nour = spawn(PEOPLE.nour, { route: [shrine.bench.at.clone()], seat: 0.02, heading: shrine.bench.heading, speed: 0.8 });
  const nour = people.nour;
  // the people of Qanat: two on the top terrace, the rest down in the avenue by the main stairs
  const T = city.top - city.center.y;
  const homes = [
    [[8.6, T, 2.5], [8.2, T, -3.5]], [[-9.6, T, -3.2], [-8.9, T, -6.4]],
    [[-4.4, 0, 35], [-3.8, 0, 41]], [[4.4, 0, 34], [4.8, 0, 39]], [[-2.8, 0, 46], [2.6, 0, 46]], [[3.2, 0, 52], [-3.0, 0, 50]],
  ].map((pts) => pts.map(([x, y, z]) => onGround(city.local(x, y + 1, z))));
  const villagers = VILLAGERS.map((v, i) => {
    const n = spawn({ ...VILLAGER_TALK, ...v }, { route: homes[i], speed: 0.9 });
    n.home = homes[i];
    n.below = i >= 2;   // down in the avenue: up the main stairs to gather
    return n;
  });
  // where they gather: round the shrine's front and its open side (its left is the terrace's edge), clear of the well
  // (shrine-local: x across, z out front)
  const gatherSpots = [[-1.6, 2.8], [1.3, 2.3], [2.8, 1.0], [-1.1, 4.4], [3.5, -0.6], [-1.3, 5.7], [4.3, 1.0], [2.5, -2.0]]
    .map(([x, z]) => shrine.at(x, 0, z))
    .filter((p) => { const g = physics.groundAt(p.x, shrine.box.y + 1.5, p.z, 3); return Number.isFinite(g) && Math.abs(g - shrine.box.y) < 0.3 && flat(p, city.well) > 3.4; })
    .map((p) => p.setY(shrine.box.y));
  // a stone for Oum to sit on, and her staff
  {
    const st = new THREE.Mesh(new THREE.IcosahedronGeometry(0.55, 0).scale(1.2, 0.8, 1), makeMaterial({ color: '#c9b8a0', flat: true }));
    st.position.copy(oumStone).add(V(0, 0.05, 0));
    st.userData.noCollide = true;
    scene.add(st);
  }

  // ---------------------------------------------------------------- following
  const iloFollow = V(0, 0, 0);
  const updateFollowers = (dt) => {
    // Ilo: at your heels on the way to the skull, then waiting on its lip
    const I = people.ilo;
    const iloQ = quests.stage('desert.ilo');
    if (iloQ === 'lead') {
      const d = player.frame?.dir ? player.frame.dir(player.heading, _w) : _w.set(Math.sin(player.heading), 0, Math.cos(player.heading));
      iloFollow.copy(player.pos).addScaledVector(d, -1.6).add(V(d.z * 0.9, 0, -d.x * 0.9));
      I.follow = () => (player.pos.y > 600 ? null : { pos: iloFollow, speed: Math.min(Math.hypot(player.vel.x, player.vel.z), 3.5), near: 1.0, max: 6 });
      if (flat(player.pos, Q.giant.door) < 9 && flat(I.pos, Q.giant.door) < 12) game.set('desert.ilo.atSkull', true);
    } else if (iloQ === 'below') {
      const wait = Q.giant.door.clone().add(V(Math.sin(Q.giant.yaw) * 4 + Math.cos(Q.giant.yaw) * 2.5, 0, Math.cos(Q.giant.yaw) * 4 - Math.sin(Q.giant.yaw) * 2.5));
      I.follow = () => ({ pos: wait, speed: 1.5, near: 0.8, max: 3, face: Q.giant.yaw + Math.PI });
    } else {
      I.follow = null;
      // back home between the tents once you've gone (no long walk through the walls)
      if (flat(I.pos, iloRoute[0]) > 30 && flat(I.pos, player.pos) > 50) I.pos.copy(iloRoute[0]);
    }
    // Oum: slow, and she sits down if you run off
    if (game.flag('desert.oum.following') && !game.flag('desert.oum.home')) {
      oum.seat = null;
      const far = flat(player.pos, oum.pos) > 22 || player.pos.y > 600;
      oumWaitT -= dt;
      if (far && oumWaitT <= 0 && flat(player.pos, oum.pos) < 60) { oum.shout = { text: '~shout~ Wait for me!', until: oum.time + 2.2 }; oumWaitT = 9; }
      const d = _w.set(oum.pos.x - player.pos.x, 0, oum.pos.z - player.pos.z).normalize();
      oumFollow.copy(player.pos).addScaledVector(d, 2.2);
      oum.follow = () => (far ? null : { pos: oumFollow, speed: 1.1, near: 1.2, max: 1.6 });
      if (flat(oum.pos, fire) < 14) {
        game.set('desert.oum.home', true);
        sound.chime();
      }
    } else if (game.flag('desert.oum.home')) {
      // to her seat by the fire
      if (!oum.seat) {
        if (flat(oum.pos, oumSeat.at) > 0.8) oum.follow = () => ({ pos: oumSeat.at, speed: 1, near: 0.3, max: 1.4 });
        else { oum.follow = null; oum.seat = 0.02; oum.heading = oumSeat.heading; }
      }
    }
  };

  // ---------------------------------------------------------------- things to look at
  const thing = (def, at, { range = 3, prompt, enabled = () => true, use } = {}) => registerInteractable({
    id: def.id, priority: PRIORITY.use, range, prompt: prompt ?? `look at ${def.name.replace(/^The /, 'the ')}`,
    at: () => at, enabled, distance: (p) => (Math.abs(p.pos.y - at.y) < 4 ? flat(p.pos, at) : Infinity),
    use: use ?? (() => dialogue.start(def, null, at)),
  });
  thing(THINGS.well, city.wellLook, { range: 3.4, prompt: 'look into the well' });
  thing(THINGS.stele, city.stele, { range: 3.2, prompt: 'read the stele' });
  const browAt = Q.giant.door.clone().add(V(Math.sin(Q.giant.yaw) * 3, 0, Math.cos(Q.giant.yaw) * 3));
  thing(THINGS.brow, browAt, { range: 4, prompt: 'look up at the skull' });
  thing(THINGS.mural, cave.mural.clone().setY(cave.origin.y), { range: 4, prompt: 'look at the mural' });

  // ---------------------------------------------------------------- the drum
  let drum = null;
  if (!quests.isDone('desert.drum') && !quests.has('drum')) {
    const g = new THREE.Group();
    const red = makeMaterial({ color: '#c8483a', flat: true }), skin = makeMaterial({ color: '#f3ead8', flat: true });
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.22, 16), red));
    // the skin and its ring of shells, one mesh
    const parts = [new THREE.CylinderGeometry(0.4, 0.4, 0.02, 16).translate(0, 0.12, 0)];
    for (let i = 0; i < 8; i++) parts.push(new THREE.SphereGeometry(0.05, 6, 4).translate(Math.sin(i * 0.785) * 0.43, 0, Math.cos(i * 0.785) * 0.43));
    g.add(new THREE.Mesh(mergeGeometries(parts.map((p) => p.toNonIndexed())), skin));
    const p = V(STORY.drum.x, 0, STORY.drum.z); p.y = level.ground.heightAt(p.x, p.z) + 0.3;
    g.position.copy(p); g.rotation.set(1.2, 0.4, 0.3);
    g.traverse((o) => { o.userData.noCollide = true; });
    scene.add(g);
    drum = { g, at: p };
    quests.locate('drum', () => p);
    drum.off = registerInteractable({ id: 'drum', priority: PRIORITY.use, range: 2.6, prompt: 'pick up the drum', at: () => p, distance: (pl) => flat(pl.pos, p),
      use: () => {
        quests.give('drum');
        toast(`Picked up ${ITEMS.drum}`);
        if (!quests.isStarted('desert.drum')) quests.start('desert.drum', 'return'); else quests.advance('desert.drum', 'find');
        g.removeFromParent(); drum.off(); drum = null; sound.chime();
      } });
  }

  // ---------------------------------------------------------------- the hoverbike
  // not yours from the start: Marrow hid it under a tarp in a hollow (src/story/desert-bike.js)
  const hollow = setupHoverbike(ctx);

  // ---------------------------------------------------------------- the channel and the pool
  const st = { level: cave.levels.low, boneT: 0, flare: 0, drink: 0, approached: false, campsIn: false };
  const open = () => !!game.flag('desert.channel.open');
  // the tool pushes only once the backpack is found (src/boxes/); before that the rib is heaved by hand
  const toolHasPush = () => !!tool && (tool.owned ?? items.has('backpack'));
  const clearChannel = (how) => {
    if (open()) return;
    game.set('desert.channel.open', true);
    st.boneT = 0.001;
    toast(how === 'push' ? 'The fluid shoves the rib: it rolls off the channel. Water runs.' : 'You heave. The rib grinds, tips, and rolls off the channel. Water runs.');
    sound.whoosh?.();
    sound.chime();
  };
  // the tool's push clears it (src/targets.js); a shot only rocks it
  const boneTarget = registerTarget({ kind: 'bone', radius: 2.6, position: () => cave.bone.position, enabled: () => !open() && player.pos.distanceTo(cave.origin) < 200,
    onHit: (mode) => {
      if (mode === 'push') { clearChannel('push'); return true; }
      st.wobble = 1;
      if (!st.hinted) { st.hinted = true; toast('The rib rocks, and settles. It needs a shove: push it (C, middle click, or RB / R1).'); }
      return true;
    } });
  void boneTarget;
  // E: without the tool's push, heave it by hand; with it, a hint
  registerInteractable({ id: 'bone', priority: PRIORITY.use, range: 4.2, at: () => cave.bone.position, enabled: () => !open(),
    prompt: () => (toolHasPush() ? 'look at the fallen rib' : 'heave the fallen rib'),
    distance: (p) => (p.pos.distanceTo(cave.origin) < 200 ? flat(p.pos, cave.bone.position) : Infinity),
    use: () => { if (toolHasPush()) dialogue.start(THINGS.bone, null, cave.bone.position); else clearChannel('heave'); } });

  const applyOpen = (instant) => {
    // the tree drinks: cool fire, a full well, a bright pool, a feast
    city.flames.setPalette(COOL_FIRE, instant);
    city.smoke?.setPalette(SMOKE_COOL, instant, COOL_FIRE[1]);
    city.wellWater.visible = true;
    cave.streamOn = true;
    if (crowd) for (const p of crowd.people) if (p.spot?.id === 'procession') p.lines = LINES.drinking;
    sound.setBandMode('camp', 'feast'); sound.setBandMode('procession', 'feast'); sound.setBandMode('tree', 'feast');
    st.drinking = true;
    if (instant) { st.level = cave.levels.high; st.boneT = 1; st.drink = 1; }
  };
  // the smoke column casts no shadow across the city (the renderer hides level.noShadow in its shadow passes)
  if (city.smoke) (level.noShadow ??= []).push(city.smoke.mesh);
  if (open()) applyOpen(true);
  game.on('flag:desert.channel.open', (v) => { if (v) applyOpen(false); });

  // wading: the fluid refills (and takes a colour, the first time); the jar fills
  let wasIn = false;
  const wade = () => {
    const c = cave.poolCenter;
    const inPool = player.pos.distanceTo(cave.origin) < 200 && flat(player.pos, c) < cave.poolR && player.pos.y < cave.origin.y + st.level + 0.25;
    if (inPool && !wasIn) {
      if (!open()) toast('The water is shallow and dull, barely moving. It’s waiting for something.');
      else {
        const addColour = !game.flag('desert.pool.tinted') && items.has('backpack');   // (no tank, nothing to tint yet)
        // the fluid tool listens for this (fluid-tool.js): a full tank, and for good a new colour band
        game.emit('tool:refill', { addColour });
        if (addColour) { game.set('desert.pool.tinted', true); toast('The water climbs your hose. The tank takes its colours.'); }
        if (quests.has('jar') && !game.flag('desert.jar.filled')) {
          quests.take('jar'); quests.give('water');
          game.set('desert.jar.filled', true);
          toast(`Ama’s jar fills: ${ITEMS.water}`);
          sound.chime();
        }
      }
    }
    wasIn = inPool;
  };

  // ---------------------------------------------------------------- the ship
  const shipPos = () => {
    const s = level.ship?.pos ?? level.shipSite ?? level.spawn;
    return s.isVector3 ? s : V(s.x, s.y ?? level.ground.heightAt(s.x, s.z), s.z);
  };
  const feedShip = () => {
    if (!quests.has('water') || game.flag('desert.ship.fed')) return false;
    quests.take('water');
    game.set('desert.ship.fed', true);
    return true;
  };
  game.on('ship:enter', () => feedShip());
  // the backpack found: a nudge to try it
  game.on('box:opened', ({ item } = {}) => {
    if (item !== 'backpack') return;
    setTimeout(() => toast('Try shooting (G) or pushing (C).'), 3200);
  });
  quests.def('desert.power').onDone = () => {
    game.set('ship.powered', true);
    game.set('world.desert.done', true);
    game.addKeepsake({ id: 'desert.knowing', level: 'desert', name: 'What the giants left', kind: 'knowing', text: 'The giants carried the water. The tree drinks what they left.' });
    toast('The ship hums awake. The galaxy is open.');
    setTimeout(() => story.complete?.(), 1200);
  };

  // ---------------------------------------------------------------- places for the quest markers
  quests.locate('camps', () => camps.center);
  quests.locate('cityGate', () => city.gate);
  quests.locate('well', () => city.wellLook);
  quests.locate('caveIn', () => cave.inside);
  quests.locate('skull', () => Q.giant.door);
  quests.locate('bone', () => cave.bone.position);
  quests.locate('pool', () => cave.poolCenter);
  quests.locate('ship', shipPos);
  quests.locate('mask', () => V(-20, level.ground.heightAt(-20, -372), -372));
  for (const [id, n] of Object.entries(people)) quests.locate(id, () => n.pos);

  // ---------------------------------------------------------------- the procession's banners, lanterns and drum
  const props = [];
  if (crowd) {
    const pole = makeMaterial({ color: '#4a3a2a', flat: true }), lamp = makeMaterial({ color: '#fff3c4', glow: 1, flat: true }), brass = makeMaterial({ color: '#e2b552', flat: true });
    const drumM = makeMaterial({ color: '#c8483a', flat: true });
    const colours = ['#c8483a', '#5fb7ad', '#f2c54b', '#8a6fb8', '#f3ead8', '#e6875f'];
    let ci = 0;
    for (const p of crowd.people) {
      if (!p.role) continue;
      const g = new THREE.Group();
      g.userData.noCollide = true;
      let banner = null, light = null;
      const one = (list) => mergeGeometries(list.map((x) => (x.index ? x.toNonIndexed() : x)));
      if (p.role === 'banner') {
        g.add(new THREE.Mesh(one([new THREE.CylinderGeometry(0.035, 0.045, 4.4, 5).translate(0, 2.2, 0), new THREE.BoxGeometry(1.5, 0.06, 0.06).translate(0, 4.3, 0)]), pole));
        banner = new Banner(scene, V(0, 0, 0), 0, { width: 1.3, height: 2.6, color: colours[ci++ % colours.length] });
      } else if (p.role === 'lantern') {
        g.add(new THREE.Mesh(one([new THREE.CylinderGeometry(0.03, 0.04, 3.2, 5).translate(0, 1.6, 0),
          new THREE.TorusGeometry(0.35, 0.03, 4, 10, Math.PI).rotateZ(-Math.PI / 2).translate(0.3, 3.2, 0), new THREE.CylinderGeometry(0.12, 0.2, 0.08, 6).translate(0.62, 3.15, 0)]), brass));
        g.add(new THREE.Mesh(new THREE.OctahedronGeometry(0.22, 0).scale(1, 1.4, 1).translate(0.62, 2.85, 0), lamp));
        light = new THREE.Vector4(0, -1e5, 0, 9);
        level.lights.push(light);
      } else if (p.role === 'drum') {
        g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.33, 0.33, 0.3, 14).rotateZ(Math.PI / 2 - 0.3).translate(0, 1.05, 0.32), drumM));
      }
      g.traverse((o) => { o.userData.noCollide = true; });
      scene.add(g);
      props.push({ p, g, banner, light, side: p.role === 'drum' ? 0 : 0.3 });
    }
  }
  const drummer = crowd?.people.find((p) => p.role === 'drum');
  const updateProps = (t, camPos) => {
    for (const pr of props) {
      const p = pr.p, far = p.pos.distanceToSquared(camPos) > 300 * 300;
      pr.g.visible = !far;
      if (pr.banner) pr.banner.mesh.visible = !far;
      if (far) { if (pr.light) pr.light.set(0, -1e5, 0, 0); continue; }
      const h = p.heading, rx = Math.cos(h), rz = -Math.sin(h);
      pr.g.position.set(p.pos.x + rx * pr.side, p.pos.y, p.pos.z + rz * pr.side);
      pr.g.rotation.y = h;
      pr.g.position.y += Math.abs(Math.sin(p.phase * Math.PI * 2)) * 0.04;
      if (pr.banner) {
        pr.banner.mesh.position.copy(pr.g.position).add(_v.set(0, 4.28, 0));
        pr.banner.mesh.rotation.y = h + Math.PI / 2;
        if (p.pos.distanceToSquared(camPos) < 120 * 120) pr.banner.update(t);
      }
      if (pr.light) pr.light.set(pr.g.position.x + rx * 0.62, pr.g.position.y + 2.9, pr.g.position.z + rz * 0.62, 9);
    }
  };

  // ---------------------------------------------------------------- music
  sound.setBands([
    { id: 'camp', pos: V(fire.x, fire.y + 1, fire.z), radius: 85, parts: game.flag('desert.teo.drumming') ? ['oud', 'ney', 'chant', 'drum'] : ['oud', 'ney', 'chant'], mode: open() ? 'feast' : 'play' },
    { id: 'procession', pos: () => drummer?.pos ?? null, radius: 75, parts: ['drum', 'bell'], mode: open() ? 'feast' : 'play', vol: 0.9, duck: 0.6 },
    { id: 'tree', pos: city.treeBase, radius: 110, parts: ['chant', 'bell'], mode: open() ? 'feast' : 'play', vol: 0.55, duck: 0.4 },
  ]);
  game.on('flag:desert.teo.drumming', (v) => { const b = sound.band('camp'); if (v && b && !b.parts.includes('drum')) b.parts.push('drum'); });
  // Bako plays his ney for you when you ask: the one song it knows, slow and strange (sound.solo)
  game.on('music:solo', ({ who } = {}) => {
    const n = people[who];
    if (!n || !sound.solo) return;
    const len = sound.solo(() => V(n.pos.x, n.pos.y + 1.4, n.pos.z));
    if (len) n.shout = { text: '~solemn~ ♪  ♪', until: n.time + len };
  });

  // ---------------------------------------------------------------- the tree notices you
  const treeTarget = registerTarget({ kind: 'tree', radius: 14, position: () => city.crown, onHit: () => { st.flare = Math.max(st.flare, 1); return true; } });
  void treeTarget;

  // ---------------------------------------------------------------- the shrine: Qanat notices, gathers, and Nour comes
  const say = (n, text, secs = 3) => { n.shout = { text, until: n.time + secs }; };
  const pick = (list, i) => list[i % list.length];
  const boxAt = shrine.box;
  const faceBox = (p) => Math.atan2(boxAt.x - p.x, boxAt.z - p.z);
  /** Walk an NPC along points (the stairs), then stand at the last one facing `face`. */
  const walkPath = (n, pts, { speed = 1.25, face = null } = {}) => {
    let i = 0;
    n.follow = () => {
      while (i < pts.length - 1 && flat(n.pos, pts[i]) < 0.9) i++;
      return { pos: pts[i], speed, near: i < pts.length - 1 ? 0.5 : 0.35, max: speed + 0.6, face: face ?? undefined };
    };
  };
  const stairs = [city.plinthStair.clone(), city.local(0, T * 0.5, 22), city.stairTop.clone()];
  const sh = { noticed: false, gather: null, nour: null, timers: [] };
  const later = (secs, fn) => sh.timers.push({ at: secs, fn });
  const boxOpen = () => !!game.flag('box.desert.backpack') || items.has('backpack');
  const notice = () => {
    // the first time you come near the closed chest: heads turn, a murmur, the tree flares a little
    sh.noticed = true;
    st.flare = Math.max(st.flare, 1.1);
    let k = 0;
    for (const n of [...villagers, people.hessa]) {
      if (flat(n.pos, boxAt) > 30) continue;
      const line = n === people.hessa ? '~shout~ Grandmother! The sky-stranger is at the chest!' : pick(MURMURS.near, k);
      later(0.3 + k++ * 0.9, () => say(n, line, 3));
    }
    crowd?.lookAt(boxAt.clone().setY(boxAt.y + 1), 6, { near: boxAt, r: 60 });
  };
  const gather = () => {
    // the chest is open: everyone comes to see, the tree flares high, Nour gets up
    game.set('desert.shrine.gathered', true);
    sh.gather = { t: 0 };
    st.flare = Math.max(st.flare, 2.4);
    sound.chime?.();
    crowd?.lookAt(boxAt.clone().setY(boxAt.y + 2), 14, { near: boxAt, r: 90 });
    villagers.forEach((n, i) => {
      const spot = gatherSpots[i % Math.max(1, gatherSpots.length)];
      if (!spot) return;
      walkPath(n, n.below ? [...stairs, spot] : [spot], { speed: n.below ? 1.6 : 1.2, face: faceBox(spot) });
      later(0.6 + i * 0.75, () => say(n, pick(MURMURS.gather, i), 3.2));
    });
    later(1.2, () => say(people.hessa, '~shout~ Grandmother! It opened!', 3));
    // Nour: up off her bench, to you
    sh.nour = { t: 0, talked: false };
    nour.seat = null;
    later(0.4, () => say(nour, MURMURS.nour[0], 2));
    later(2.6, () => say(nour, MURMURS.nour[1], 3));
    nour.follow = () => ({ pos: player.pos, speed: 0.95, near: 1.8, max: 1.5 });
  };
  const disperse = () => {
    // back to their doors and their sweeping, a while after
    for (const n of villagers) walkPath(n, n.below ? [...stairs].reverse().concat([n.home[0]]) : [n.home[0]], { speed: 1.0 });
    later(45, () => { for (const n of villagers) n.follow = null; });
  };
  const nourHome = () => {
    // back to her bench and down onto it
    sh.nour = null;
    nour.follow = () => {
      if (flat(nour.pos, shrine.bench.at) < 0.45) { nour.follow = null; nour.seat = 0.02; nour.heading = shrine.bench.heading; nour.pos.copy(shrine.bench.at); return null; }
      return { pos: shrine.bench.at, speed: 0.8, near: 0.3, max: 1.1 };
    };
  };
  game.on('box:opened', ({ id } = {}) => { if (id === 'desert.backpack' && !game.flag('desert.shrine.gathered')) gather(); });
  game.on('dialogue:end', ({ id } = {}) => {
    if (id !== 'nour') return;
    if (sh.nour) sh.nour.talked = true;
    if (sh.gather) sh.gather.talked = true;
  });
  const updateShrine = (dt, pp) => {
    for (const tm of sh.timers) tm.at -= dt;
    for (const tm of sh.timers.filter((x) => x.at <= 0)) { sh.timers.splice(sh.timers.indexOf(tm), 1); tm.fn(); }
    const dBox = flat(pp, boxAt), level = Math.abs(pp.y - boxAt.y) < 3;
    if (!sh.noticed && !boxOpen() && dBox < 13 && level) notice();
    if (sh.gather) {
      sh.gather.t += dt;
      // they stay a while (all through Nour's talk), then drift back to their doors
      if (!sh.gather.dispersed && ((sh.gather.talked && sh.gather.t > 50) || sh.gather.t > 120)) { sh.gather.dispersed = true; disperse(); }
    }
    if (sh.nour) {
      sh.nour.t += dt;
      // she reaches you: the conversation opens on its own (once)
      if (!sh.nour.talked && !dialogue.open && flat(nour.pos, pp) < 2.6 && level && !player.riding && sh.nour.t > 1.5) {
        if (dialogue.start(PEOPLE.nour, nour)) sh.nour.talked = true;
      }
      // you walked off: she waits by the shrine, where the marker finds her
      if (!sh.nour.talked && dBox > 16 && !sh.nour.waiting) { sh.nour.waiting = true; const w = shrine.at(-1.6, 0, 1.8).setY(boxAt.y); nour.follow = () => ({ pos: w, speed: 0.9, near: 0.4, face: faceBox(w) }); }
      if (sh.nour.waiting && !sh.nour.talked && dBox < 7) { sh.nour.waiting = false; nour.follow = () => ({ pos: player.pos, speed: 0.95, near: 1.8, max: 1.5 }); }
      if (sh.nour.talked && dBox > 30) nourHome();
    }
  };

  // ---------------------------------------------------------------- waved on toward the city
  const early = () => EARLY.includes(quests.stage('desert.power'));
  const setWaveOn = (on) => {
    if (!crowd) return;
    for (const p of crowd.people) {
      const id = p.spot?.id, extra = LINES.waveOn[id];
      if (!extra) continue;
      p.baseLines ??= p.lines;
      if (on && p.lines === p.baseLines) p.lines = p.baseLines.flatMap((l, i) => (i < extra.length ? [extra[(i + Math.floor(p.seed * 4)) % extra.length], l] : [l]));
      else if (!on && p.lines !== LINES.drinking) p.lines = p.baseLines;
    }
  };
  setWaveOn(early());
  quests.onChange(({ id }) => { if (id === 'desert.power') setWaveOn(early()); });

  // ---------------------------------------------------------------- per frame
  const camPos = V(0, 0, 0);
  const update = (dt, t, { camera }) => {
    camPos.copy(camera.position);
    const pp = player.pos;
    // the camps: first sight sets the quest moving; people turn to look and wave
    const dCamps = flat(pp, camps.center);
    if (dCamps < 45 && !game.flag('desert.camps.seen')) game.set('desert.camps.seen', true);
    if (dCamps < 34 && !st.campsIn && crowd) {
      st.campsIn = true;
      const now = crowd.time;
      for (const p of crowd.people) {
        if (p.spot?.id !== 'camp' && p.spot?.id !== 'gate') continue;
        const d = flat(p.pos, pp);
        if (d > 30) continue;
        p.lookUntil = now + 4 + Math.random() * 2;
        if (!p.walk && Math.random() < 0.4 && d < 22) { p.faceUntil = now + 1.5 + Math.random(); p.greetT = now; }
      }
      for (const n of [people.ama, people.ilo]) n.greeted = 0;
      if (early()) { say(people.ama, '~shout~ To the city, sky-stranger! Up to the tree!', 3.5); later(1.4, () => say(people.ilo, '~shout~ Nour’s chest is humming! Go and see!', 3)); }
    } else if (dCamps > 60) st.campsIn = false;
    // into the city: the walls are round it
    if (!game.flag('desert.city.entered') && flat(pp, city.center) < 60 && Math.abs(pp.y - city.center.y) < 30) game.set('desert.city.entered', true);
    // the Speaker waves you on too, as you come up to the procession
    if (early() && !st.speakerWaved && flat(pp, people.speaker.pos) < 14) { st.speakerWaved = true; say(people.speaker, '~happy~ Qanat is ahead, little star. Up to the tree!', 3.5); }
    updateShrine(dt, pp);
    if (pp.distanceTo(cave.origin) < 80 && !game.flag('desert.cave.seen')) game.set('desert.cave.seen', true);
    updateFollowers(dt);
    wade();
    // the ship: walk up with the living water (or enter it: 'ship:enter')
    if (quests.has('water') && flat(pp, shipPos()) < 10) feedShip();

    // the tree: flares when you first come near, glows warmer the closer you are
    const dTree = flat(pp, city.treeBase);
    if (dTree < 95 && !st.approached) { st.approached = true; st.flare = 1.4; game.set('desert.tree.flared', true); }
    else if (dTree > 160) st.approached = false;
    st.flare = Math.max(0, st.flare - dt * 0.35);
    const near = THREE.MathUtils.clamp(1 - dTree / 120, 0, 1);
    city.flames.intensity = 1 + 0.25 * near + st.flare * 0.6 + (st.drinking ? 0.15 : 0);
    city.embers.rate = 1 + st.flare * 2.5;
    city.light.w = 70 + st.flare * 40;

    // the channel: the rib rolls aside, the stream runs, the pool rises and brightens
    if (st.boneT > 0 && st.boneT < 1) {
      st.boneT = Math.min(1, st.boneT + dt / 1.6);
      const k = THREE.MathUtils.smootherstep(st.boneT, 0, 1);
      cave.bone.position.lerpVectors(cave.boneRest.pos, cave.boneAside, k);
      cave.bone.position.y += Math.sin(Math.PI * k) * 0.8;
      cave.bone.rotation.set(cave.boneRest.rot.x + k * 2.6, cave.boneRest.rot.y, cave.boneRest.rot.z + k * 0.4);
    } else if (st.boneT >= 1) {
      cave.bone.position.copy(cave.boneAside);
      cave.bone.rotation.set(cave.boneRest.rot.x + 2.6, cave.boneRest.rot.y, cave.boneRest.rot.z + 0.4);
    } else if (st.wobble > 0) {
      st.wobble = Math.max(0, st.wobble - dt * 2);
      cave.bone.rotation.x = cave.boneRest.rot.x + Math.sin(st.wobble * 20) * 0.06 * st.wobble;
    }
    if (open()) {
      st.level = Math.min(cave.levels.high, st.level + dt * 0.12);
      st.drink = Math.min(1, st.drink + dt / 6);
    }
    cave.pool.position.y = cave.origin.y + st.level;
    cave.poolLight.w = 14 + 16 * st.drink;
    const inCave = camPos.distanceTo(cave.origin) < 300;
    if (inCave) {
      // the same fluid as the tank: dull and slow while the channel is blocked, alive once the water runs
      st.poolT = (st.poolT ?? 0) + dt * (0.35 + 0.65 * st.drink);
      setMagic(cave.poolMat, st.poolT, { bright: 0.25 + 0.75 * st.drink, tones: st.drink > 0.5 ? 6 : 4 });
      setMagic(cave.streamMat, t * (open() ? 2.2 : 0.4), { bright: open() ? 1 : 0.55, tones: 6 });
    }
    if (city.wellWater.visible && flat(camPos, city.well) < 250) {
      city.wellWater.position.y = Math.min(city.well.y + 0.95, city.wellWater.position.y + dt * 0.25);
      setMagic(city.wellMat, t, { bright: 1, tones: 6 });
    }

    // the musicians pick up your tune when you stand with them
    if (!st.drinking) sound.setBandMode('camp', flat(pp, fire) < 9 ? 'near' : 'play');
    updateProps(t, camPos);
    hollow.update(dt, t, camPos);
  };

  return {
    people, update, state: st, villagers, shrine: sh, gatherSpots, hollow,
    /** E on a crowd person: their short conversation (by where they stand). */
    crowdTalk(p) {
      const id = p.spot?.id;
      const list = (id === 'procession' && st.drinking ? CROWD_TALK.drinking : CROWD_TALK[id]) ?? null;
      if (!list) return null;
      const base = list[Math.floor(p.seed * list.length) % list.length];
      return { id: `crowd.${id}`, color: p.style?.cloak ?? '#d8a24a', kind: p.kind, seed: `crowd:${p.id}`, scale: p.size, ...base }   // a voice of their own (src/story/voice.js voiceOf hashes the seed);
    },
    onTalk(person, npc, on) {
      // the procession stops for you while you talk with someone in it (or its Speaker)
      if (on && (npc === people.speaker || person.id === 'crowd.procession')) st.holdProcession = true;
      if (!on) st.holdProcession = false;
    },
    hold() { if (st.holdProcession) crowd?.hold('procession', 0.4); },
    toolHasPush,
  };
}
