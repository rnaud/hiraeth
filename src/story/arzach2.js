import * as THREE from 'three';
import { makeMaterial } from '../materials.js';
import { registerInteractable, PRIORITY } from '../interact.js';
import { game as sharedGame } from '../game-state.js';
import { QUESTS, PEOPLE, LOCALS, THINGS, ITEMS, CAIRN_STONES } from './arzach2-data.js';

// Arzach II's story, alive (arzach2-data.js has the words): "The Bell Under the Cloud".
//
//   the start plateau  Sister Aube by her hermitage, watching the cloud
//   the monastery      Brother Calix under the bell tower, Mother Ysolde by the
//                      courtyard wall; the bell in its open belfry, its rope
//   the island         the clapper, lying before the church door
//   the great table    Tiv by his cairn's footing stone; the sky stones climb
//                      round from the table's east rim, three cairn stones on them
//   the plain          Ondine, walking to the lone tower; the face on its plinth
//
// Ringing the bell swings it in the belfry and tolls; the cloud sea settles
// (its puffs and deck sink), and the floating stones come down a little. After
// Calix gives you the note, the tank sings it whenever you shoot, in every
// world (the listener below is installed when this module loads).

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const flat = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const angleTo = (from, to) => Math.atan2(to.x - from.x, to.z - from.z);
const SETTLE = 16;          // m the cloud sinks when the bell rings
const STONES_DOWN = 6;      // m the floating stones come down

// ------------------------------------------------------------------ the bell's note, from the tank
// A low FM bell. In Arzach II it plays through the level's Sound; elsewhere the
// module keeps a tiny AudioContext of its own (shooting is a user gesture).
let noteSound = null, ownCtx = null, lastNote = -1;
export function playBellNote({ vol = 0.07, f = 164.8 } = {}) {
  try {
    if (globalThis.localStorage?.getItem('moebius.muted') === '1') return false;
    if (noteSound?.ctx) { noteSound.instrument?.('bell', f, noteSound.ctx.currentTime + 0.05, 2, vol * 1.4, noteSound.fx); return true; }
    const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!AC) return false;
    ownCtx ??= new AC();
    const ctx = ownCtx, t = ctx.currentTime + 0.05;
    if (ctx.state === 'suspended') ctx.resume();
    const car = ctx.createOscillator(), mod = ctx.createOscillator(), mg = ctx.createGain(), out = ctx.createGain();
    car.frequency.value = f; mod.frequency.value = f * 3.5;
    mg.gain.setValueAtTime(f * 2.2, t); mg.gain.exponentialRampToValueAtTime(1, t + 2.4);
    out.gain.setValueAtTime(0, t); out.gain.linearRampToValueAtTime(vol, t + 0.01); out.gain.exponentialRampToValueAtTime(0.0005, t + 3);
    mod.connect(mg).connect(car.frequency); car.connect(out).connect(ctx.destination);
    car.start(t); mod.start(t); car.stop(t + 3.1); mod.stop(t + 3.1);
    return true;
  } catch { return false; }
}
sharedGame.on('tool:fire', (e) => {
  if (e?.mode !== 'shoot' || !sharedGame.flag('arzach2.bell.note')) return;
  const now = globalThis.performance?.now?.() ?? 0;
  if (now - lastNote < 250) return;
  lastNote = now;
  playBellNote();
});

export function setupArzach2(ctx) {
  const { level, physics, player, quests, dialogue, game, sound, story, spawn, talkable, scene, toast, npcs } = ctx;
  const A = level.arzach2;
  if (!A) return null;
  noteSound = sound;
  for (const q of QUESTS) quests.define(q);
  quests.itemNames = { ...(quests.itemNames ?? {}), ...ITEMS };
  if (!quests.isStarted('arzach2.bell')) quests.start('arzach2.bell');
  if (game.flag('arzach2.cairn.placed') === undefined) game.set('arzach2.cairn.placed', 0);
  const ground = (x, z, from) => { const g = physics.groundAt(x, from, z, 60); return Number.isFinite(g) ? g : from - 3; };
  const Q = 'arzach2.bell';

  // ---------------------------------------------------------------- the people
  const people = {};
  LOCALS.forEach((def, i) => { const n = npcs[i]; if (n && !n.def?.talk) { talkable(n, def); people[def.id] = n; } });
  const ysAt = V(-244, 0, -246); ysAt.y = ground(ysAt.x, ysAt.z, A.monastery.y + 10);
  people.ysolde = spawn(PEOPLE.ysolde, { route: [ysAt.clone(), V(-238, ground(-238, -249, A.monastery.y + 10), -249)], speed: 0.5 });
  const tivAt = V(-22, 0, -443); tivAt.y = ground(tivAt.x, tivAt.z, A.table.y + 6);
  people.tiv = spawn(PEOPLE.tiv, { route: [tivAt.clone()], heading: angleTo(tivAt, A.sky[0].pos) });

  // ---------------------------------------------------------------- things
  const thing = (def, at, { range = 3, prompt, enabled = () => true, use, height = 4 } = {}) => registerInteractable({
    id: def.id, priority: PRIORITY.use, range, prompt: prompt ?? `look at ${def.name.replace(/^The /, 'the ')}`,
    at: () => at, enabled, distance: (p) => (Math.abs(p.pos.y - at.y) < height ? flat(p.pos, at) : Infinity),
    use: use ?? (() => dialogue.start(def, null, at)),
  });
  thing(THINGS.face, A.face, { range: 7, height: 8, prompt: 'look at the face on the tower' });

  // ---------------------------------------------------------------- the clapper, on the island
  const bronze = makeMaterial({ color: '#c99a52', color2: '#b3843f', color3: '#e0b66a', flat: true });
  const clapperGeo = new THREE.CylinderGeometry(0.12, 0.12, 1.6, 6).translate(0, 0.8, 0);
  const clapperBall = new THREE.SphereGeometry(0.42, 10, 8);
  const makeClapper = () => {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(clapperGeo, bronze), new THREE.Mesh(clapperBall, bronze));
    g.userData.noCollide = true;
    return g;
  };
  let lying = null;
  const clapperAt = A.clapper.clone();
  if (!quests.has('clapper') && !game.flag('arzach2.clapper.hung')) {
    lying = makeClapper();
    lying.position.copy(clapperAt).add(V(0, 0.35, 0));
    lying.rotation.set(0, 0.6, Math.PI / 2 - 0.15);
    scene.add(lying);
    const light = new THREE.Vector4(clapperAt.x, clapperAt.y + 1, clapperAt.z, 7);
    level.lights?.push(light);
    const off = registerInteractable({ id: 'clapper', priority: PRIORITY.use, range: 2.8, prompt: 'pick up the bell’s clapper', at: () => clapperAt,
      distance: (p) => (Math.abs(p.pos.y - clapperAt.y) < 3 ? flat(p.pos, clapperAt) : Infinity),
      use: () => {
        quests.give('clapper');
        toast(`Picked up ${ITEMS.clapper}. It is warm, and it hums very faintly against your hand.`);
        if (!quests.reached(Q, 'clapper')) quests.set(Q, 'clapper');
        lying.removeFromParent(); off(); light.set(0, -1e5, 0, 0); sound.chime();
      } });
  }
  // the clapper back in the bell (once Calix has hung it)
  const hungClapper = makeClapper();
  hungClapper.rotation.x = Math.PI;
  hungClapper.position.set(0, -0.5, 0);
  hungClapper.scale.setScalar(1.15);
  hungClapper.visible = !!game.flag('arzach2.clapper.hung');
  A.bell.add(hungClapper);
  game.on('flag:arzach2.clapper.hung', (v) => { hungClapper.visible = !!v; });

  // ---------------------------------------------------------------- the bell, the rope, the cloud
  const bell = { t: -1, amp: 0, tolls: 0, settle: game.flag('arzach2.bell.rung') ? 1 : 0, dip: 0, ringing: false, next: 75 };
  const toll = (vol = 0.16) => {
    if (!sound.ctx || !sound.instrument) return;
    const t = sound.ctx.currentTime;
    sound.instrument('bell', 82.4, t, 3, vol, sound.fx);
    sound.instrument('bell', 164.8, t + 0.01, 3, vol * 0.8, sound.fx);
    sound.instrument('bell', 246.9, t + 0.02, 2, vol * 0.25, sound.fx);
  };
  const ring = (hard = true) => {
    bell.t = 0; bell.amp = hard ? 0.42 : 0.2; bell.ringing = true; bell.tolls = 0;
    A.rope.rotation.x = 0.08;
  };
  const pull = () => {
    if (!game.flag('arzach2.clapper.hung')) {
      bell.t = 0; bell.amp = 0.18; bell.ringing = false;
      dialogue.start(THINGS.bell, null, A.ropeFoot);
      return;
    }
    ring(true);
    if (!game.flag('arzach2.bell.rung')) {
      game.set('arzach2.bell.rung', true);
      toast('The bell speaks: one low note that goes on and on. Under the cliffs, the cloud begins to settle.');
      for (const id of ['calix', 'ysolde']) { const n = people[id]; if (n) n.shout = { text: id === 'calix' ? '~shout~ Listen. Listen!' : '~shout~ Thirty years!', until: n.time + 3 }; }
    } else bell.dip = 1;
  };
  registerInteractable({ id: 'bellrope', priority: PRIORITY.use, range: 2.6, at: () => A.ropeFoot,
    prompt: () => (game.flag('arzach2.clapper.hung') ? 'pull the bell rope' : 'pull the bell rope'),
    distance: (p) => (Math.abs(p.pos.y - A.ropeFoot.y) < 3 ? flat(p.pos, A.ropeFoot) : Infinity), use: pull });

  // ---------------------------------------------------------------- the cairn and the sky stones
  const stoneMat = makeMaterial({ color: '#f4ecdc', flat: true, glow: 0.12 });
  const stoneGeo = (s) => new THREE.SphereGeometry(1, 10, 7).scale(s.r * 1.15, s.r * s.sy, s.r);
  const stones = {};
  for (const s of CAIRN_STONES) {
    const sky = A.sky[s.sky];
    const m = new THREE.Mesh(stoneGeo(s), stoneMat);
    m.userData.noCollide = true;
    const at = sky.pos.clone().add(V(sky.r * 0.35, s.r * s.sy * 0.85, 0));
    m.position.copy(at);
    const st = stones[s.id] = { ...s, m, at, light: new THREE.Vector4(at.x, at.y + 1, at.z, 5) };
    level.lights?.push(st.light);
    scene.add(m);
    if (game.flag(`arzach2.${s.id}`)) { m.visible = false; st.light.set(0, -1e5, 0, 0); }
    st.off = registerInteractable({ id: `stone.${s.id}`, priority: PRIORITY.use, range: 2.6, prompt: `pick up ${ITEMS[s.id]}`, at: () => st.at,
      enabled: () => m.visible && m.parent === scene, distance: (p) => (Math.abs(p.pos.y - st.at.y) < 3 ? flat(p.pos, st.at) : Infinity),
      use: () => {
        m.visible = false; st.light.set(0, -1e5, 0, 0);
        game.set(`arzach2.${s.id}`, true);
        quests.give(s.id);
        if (!quests.isStarted('arzach2.cairn')) quests.start('arzach2.cairn');
        toast(`Picked up ${ITEMS[s.id]}`);
        sound.chime();
      } });
  }
  // the stack, as it grows on the footing stone
  const stackY = [];
  { let y = A.cairn.y; for (const s of CAIRN_STONES) { y += s.r * s.sy; stackY.push(y); y += s.r * s.sy * 0.92; } }
  const placed = CAIRN_STONES.map((s, i) => {
    const m = new THREE.Mesh(stoneGeo(s), makeMaterial({ color: '#efe4cf', flat: true }));
    m.position.set(A.cairn.x + (i - 1) * 0.06, stackY[i], A.cairn.z);
    m.rotation.y = i * 0.9;
    m.userData.noCollide = true;
    m.visible = (game.flag('arzach2.cairn.placed') ?? 0) > i;
    scene.add(m);
    return m;
  });
  game.on('arzach2:cairn', (id) => {
    const n = game.flag('arzach2.cairn.placed') ?? 0;
    if (!quests.has(id)) return;
    if (CAIRN_STONES[n]?.id === id) {
      quests.take(id);
      placed[n].visible = true;
      game.set('arzach2.cairn.last', 'ok');
      game.set('arzach2.cairn.placed', n + 1);
      sound.chime();
      if (n + 1 === 3) { cairnHum = 1; people.tiv && (people.tiv.shout = { text: '~shout~ It stands!', until: people.tiv.time + 3 }); }
    } else {
      game.set('arzach2.cairn.last', null);
      game.set('arzach2.cairn.last', 'fell');
      sound.critter?.('clack', 0.8);
    }
  });
  let cairnHum = 0;
  thing(THINGS.cairn, A.cairn, { range: 3.2, prompt: 'look at Tiv’s cairn' });
  quests.locate('cairnStone', () => {
    let best = null, bd = Infinity;
    for (const st of Object.values(stones)) {
      if (!st.m.visible) continue;
      const d = player.pos.distanceTo(st.at);
      if (d < bd) { bd = d; best = st.at; }
    }
    return best ?? A.cairn;
  });

  // ---------------------------------------------------------------- the story catches up when you take it out of order
  const catchUp = () => {
    if (quests.isDone(Q)) return;
    const want = game.flag('arzach2.bell.rung') ? 'listen' : game.flag('arzach2.clapper.hung') ? 'ring'
      : quests.has('clapper') || game.flag('arzach2.calix.asked') ? 'clapper' : null;
    if (want && !quests.reached(Q, want)) quests.set(Q, want);
  };
  game.on('flag', catchUp);
  catchUp();
  quests.def(Q).onDone = () => {
    game.set('world.arzach2.done', true);
    toast('The bell’s note goes with you. Shoot, and the tank will sing it.');
    setTimeout(() => story.complete?.(), 1500);
  };

  // ---------------------------------------------------------------- places for the quest markers
  for (const [id, n] of Object.entries(people)) quests.locate(id, () => n.pos);
  quests.locate('monastery', () => A.monastery);
  quests.locate('clapper', () => clapperAt);
  quests.locate('rope', () => A.ropeFoot);
  quests.locate('cairn', () => A.cairn);
  quests.locate('face', () => A.face);

  // ---------------------------------------------------------------- per frame
  const cloudBase = A.cloud.map((m) => m.position.y), floatBase = A.floaters.position.y;
  const st = { landed: false };
  const update = (dt, t) => {
    const pp = player.pos;
    // the bell swings (a damped pendulum), and tolls at the top of each swing
    if (bell.t >= 0) {
      bell.t += dt;
      const w = 2.1, decay = Math.exp(-bell.t / 4.5), a = bell.amp * decay * Math.sin(w * bell.t);
      A.bell.rotation.x = a;
      const beat = Math.floor((bell.t * w) / Math.PI);
      if (bell.ringing && beat > bell.tolls && decay > 0.15) { bell.tolls = beat; toll(0.16 * decay + 0.03); }
      if (bell.t === dt && bell.ringing) toll(0.2);
      A.rope.rotation.x = Math.sin(bell.t * 5) * 0.06 * decay;
      if (decay < 0.02) { bell.t = -1; A.bell.rotation.x = 0; A.rope.rotation.x = 0; }
    }
    // the cloud settles once the bell has rung (and dips again, a little, each time you ring it)
    if (game.flag('arzach2.bell.rung') && bell.settle < 1) bell.settle = Math.min(1, bell.settle + dt / 12);
    bell.dip = Math.max(0, bell.dip - dt / 6);
    const k = THREE.MathUtils.smootherstep(bell.settle, 0, 1), dip = Math.sin(Math.PI * bell.dip) * 2.5;
    const drop = SETTLE * k + dip;
    A.cloud.forEach((m, i) => { m.position.y = cloudBase[i] - drop; });
    A.floaters.position.y = floatBase - STONES_DOWN * k;
    // after it has rung, the monks ring it at dusk and dawn (here: now and then, when you're near the cliff)
    if (game.flag('arzach2.bell.rung') && quests.isDone(Q)) {
      bell.next -= dt;
      if (bell.next <= 0) { bell.next = 90 + Math.random() * 40; if (pp.distanceTo(A.monastery) < 700 && bell.t < 0) ring(false); }
    }
    // the monks look up when you first land on the cliff
    if (!st.landed && flat(pp, A.monastery) < 70 && Math.abs(pp.y - A.monastery.y) < 6 && !player.riding) {
      st.landed = true;
      const y = people.ysolde; if (y) y.shout = { text: '~shout~ A visitor! On a bird!', until: y.time + 3 };
      const c = people.calix; if (c) c.greeted = 0;
    }
    // the cairn hums when it stands: its stones shimmer
    if (cairnHum > 0 || game.flag('arzach2.cairn.placed') === 3) {
      cairnHum = Math.max(0, cairnHum - dt * 0.3);
      for (const m of placed) m.position.x += Math.sin(t * 9 + m.position.y) * 0.002 * cairnHum;
    }
    // the cairn stones on the sky stones turn slowly (things that fell up are restless)
    for (const s of Object.values(stones)) if (s.m.visible) { s.m.rotation.y += dt * 0.3; s.m.position.y = s.at.y + Math.sin(t * 1.2 + s.sky) * 0.06; }
  };

  return { people, update, bell, stones, pull, ring };
}
