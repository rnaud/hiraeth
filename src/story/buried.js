import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeMaterial } from '../materials.js';
import { registerTarget } from '../targets.js';
import { registerInteractable, PRIORITY } from '../interact.js';
import { Flames, Embers } from './flames.js';
import { Puffs, ownMaterial } from './puffs.js';
import { QUESTS, PEOPLE, THINGS, ITEMS, AMBER } from './buried-data.js';

// The Buried Machine's story, alive (buried-data.js has the words).
//
//   the domes    Wen by the great dome, Hask on his bench, Dun among the
//                chimneys, Pim near the start (a level person)
//   the canyon   Ossa by the ledge, three gauges on posts (shoot the dials)
//   the oculus   Tull at the doorway; the Wick in the middle, its oil valve
//                (push it open, then shoot the wick); the warm window above
//   the wheel    east of the domes; once the Wick is lit and you stand
//                before it, it turns one tooth: the hanging city rocks, every
//                chimney puffs, and a sliver of the tooth drops at its foot
//
// Flags (game-state.js): buried.wen.heard, buried.hask.asked,
// buried.canyon.seen, buried.oculus.seen, buried.valve.open,
// buried.oculus.lit, buried.wheel.turned, buried.tooth.found,
// buried.tank.amber (the Wick's light added the amber band),
// buried.gauge.0..2, buried.gauges.read, buried.chimneys.open,
// buried.window.touched, buried.rumour.light; clue.buried.mark,
// clue.buried.garage. Items: tooth, key.

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const flat = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const TAU = Math.PI * 2;
const ease = (t) => t * t * (3 - 2 * t);
export const TURN_TIME = 7;   // s for the wheel's one tooth

export function setupBuried(ctx) {
  const { level, physics, player, quests, dialogue, game, sound, story, spawn, scene, toast, npcs } = ctx;
  const B = level.buried;
  if (!B) return null;
  for (const q of QUESTS) quests.define(q);
  quests.itemNames = ITEMS;
  const Q = 'buried.tooth';
  if (!quests.isStarted(Q)) quests.start(Q);

  const ground = (x, z, from = 30) => { const g = physics.groundAt(x, from, z, 400); return Number.isFinite(g) ? g : level.ground.heightAt(x, z); };
  const onGround = (x, z, from) => V(x, ground(x, z, from), z);
  const loop = (c, r, n = 4, a0 = 0) => Array.from({ length: n }, (_, i) => { const a = a0 + (i / n) * TAU; return onGround(c.x + Math.sin(a) * r, c.z + Math.cos(a) * r, c.y + 12); });
  const W = B.wheel, O = B.oculus, K = B.wick;

  // ---------------------------------------------------------------- the people
  const people = {};
  const dome = B.heroDome;
  people.wen = spawn(PEOPLE.wen, { route: loop(dome, 7.2, 5, 0.4), speed: 0.7 });
  // Hask on a stone bench by his dome, watching the sky to the south
  const bench = onGround(-12.5, -15.5);
  {
    const st = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.45, 0.7).translate(0, 0.2, 0), makeMaterial({ color: '#d9d3b8', flat: true }));
    st.position.copy(bench); st.rotation.y = 0.5;
    st.userData.noCollide = true;
    scene.add(st);
  }
  people.hask = spawn(PEOPLE.hask, { route: [bench.clone()], seat: 0.45, heading: Math.PI + 0.5 });
  people.dun = spawn(PEOPLE.dun, { route: loop(V(61, 0, 0), 4.5, 4), speed: 1.0 });
  for (const id of ['pim', 'ossa', 'tull']) { const n = npcs.find((m) => m.def?.id === id); if (n) people[id] = n; }

  // ---------------------------------------------------------------- places for the markers
  for (const [id, n] of Object.entries(people)) quests.locate(id, () => n.pos);
  const canyonAt = V(B.canyonX(-175), B.floorAt(-175), -175);
  const oculusAt = V(O.x, O.floor, O.z + O.r - 8);
  const watchAt = W.centre.clone().addScaledVector(W.face, 46); watchAt.y = ground(watchAt.x, watchAt.z);
  const windowAt = V(O.x, O.balcony, O.z - O.r + 3);
  const hook = B.tower.clone().add(V(-15, 7.4, 6));
  quests.locate('canyon', () => canyonAt);
  quests.locate('oculus', () => oculusAt);
  quests.locate('valve', () => K.valve.at);
  quests.locate('wick', () => K.centre);
  quests.locate('watch', () => watchAt);
  quests.locate('wheel', () => watchAt);
  quests.locate('tooth', () => W.drop);
  quests.locate('key', () => hook);
  quests.locate('window', () => windowAt);
  quests.locate('gauge', () => {
    let best = null, bd = Infinity;
    B.gauges.forEach((g, i) => { if (game.flag(`buried.gauge.${i}`)) return; const d = flat(g.stand, player.pos); if (d < bd) { bd = d; best = g.stand; } });
    return best ?? B.gauges[0].stand;
  });

  // ---------------------------------------------------------------- things to look at
  const thing = (def, at, { range = 3.2, prompt, enabled = () => true, use, dy = 4 } = {}) => registerInteractable({
    id: def.id, priority: PRIORITY.use, range, prompt: prompt ?? `look at ${def.name.replace(/^The /, 'the ')}`,
    at: () => at, enabled, distance: (p) => (Math.abs(p.pos.y - at.y) < dy ? flat(p.pos, at) : Infinity),
    use: use ?? (() => dialogue.start(def, null, at)),
  });
  thing(THINGS.wick, K.centre.clone().setY(K.rim), { range: 5.5, prompt: () => (game.flag('buried.oculus.lit') ? 'look at the Wick' : 'look at the lamp'), dy: 6 });
  thing(THINGS.window, windowAt, { range: 4.5, prompt: 'lay your hand on the window', dy: 3 });
  const numbersAt = V(O.x - 10.5, O.floor + 1.6, O.z + O.r - 3.5);
  thing(THINGS.numbers, numbersAt, { range: 3.2, prompt: 'read the scratched numbers' });
  thing(THINGS.wheel, watchAt.clone().lerp(W.drop, 0.75), { range: 9, prompt: 'look at the great wheel', dy: 8 });
  // the numbers: scratched rows on the drum wall by the doorway
  {
    const parts = [];
    for (let r = 0; r < 7; r++) for (let k = 0; k < 6 + (r % 3); k++) parts.push(new THREE.BoxGeometry(0.32 + ((r * 7 + k * 3) % 4) * 0.08, 0.05, 0.03).translate(k * 0.5 - 1.6, 2.2 - r * 0.28, 0).toNonIndexed());
    parts.push(new THREE.BoxGeometry(1.8, 0.09, 0.03).translate(-0.2, 0.05, 0).toNonIndexed());
    const m = new THREE.Mesh(mergeGeometries(parts), makeMaterial({ color: '#e9dcc0', flat: true }));
    const a = Math.atan2(numbersAt.x - O.x, numbersAt.z - O.z);
    m.position.set(O.x + Math.sin(a) * (O.r - 0.25), O.floor + 0.6, O.z + Math.cos(a) * (O.r - 0.25));
    m.rotation.y = a + Math.PI;
    m.userData.noCollide = true;
    scene.add(m);
  }

  // ---------------------------------------------------------------- smoke, sand and the chimneys
  const smoke = new Puffs(scene, { color: '#f1e8d6', max: 90 });
  const sand = new Puffs(scene, { color: '#e3d3ae', max: 50, glow: 0.4 });
  const chimneys = [...B.chimneys];
  const puffAt = (p, big = 1) => smoke.burst(p, { n: Math.round(2 + big * 2), rise: 1.6 + big * 1.2, size: 0.9 + big * 0.7, spread: 0.4, life: 3 + big });
  // a splash on a chimney: it coughs
  chimneys.forEach((c) => registerTarget({ kind: 'chimney', radius: 1.2, position: () => c, enabled: () => flat(player.pos, c) < 120, onHit: () => { puffAt(c, 0.8); return true; } }));

  // ---------------------------------------------------------------- the gauges
  const gaugeRead = (i) => !!game.flag(`buried.gauge.${i}`);
  const READING = [-0.38, -0.47, -0.38].map((k) => k * Math.PI);   // where each needle settles (ninety, ninety-one, ninety)
  const gst = B.gauges.map((g, i) => ({ k: gaugeRead(i) ? 1 : 0, twitch: 0, rest: g.needle.rotation.z, read: READING[i] }));
  B.gauges.forEach((g, i) => {
    if (gaugeRead(i)) g.needle.rotation.z = gst[i].read;
    registerTarget({ kind: 'gauge', radius: 2.2, position: () => g.centre, enabled: () => flat(player.pos, g.centre) < 90,
      onHit: (mode) => {
        if (gaugeRead(i)) { gst[i].twitch = 1; return true; }
        if (mode !== 'shoot') { gst[i].twitch = 1; toast('The needle trembles, and sticks. A sharp splash might free it.'); return true; }
        game.set(`buried.gauge.${i}`, true);
        gst[i].k = 0.0001;
        sound.chime?.();
        const n = B.gauges.filter((_, j) => gaugeRead(j)).length;
        toast(n < 3 ? `The needle jumps: ${['ninety', 'ninety-one', 'ninety'][i]}. (${n} of 3 gauges read)` : `The needle jumps: ${['ninety', 'ninety-one', 'ninety'][i]}. All three gauges read.`);
        if (n >= 3) game.set('buried.gauges.read', true);
        return true;
      } });
  });

  // ---------------------------------------------------------------- the Wick: valve, oil, flame, the light going up
  const lit = () => !!game.flag('buried.oculus.lit');
  const valveOpen = () => !!game.flag('buried.valve.open');
  const st = { valveT: valveOpen() ? 1 : 0, oil: valveOpen() ? 1 : 0, lightK: lit() ? 1 : 0, wobble: 0, turnT: 0, turning: false, wait: 0, sway: 0, swayT: 0, idle: 3, hello: false, amberIn: false, dropT: 0 };
  const toolHasPush = () => !!(ctx.tool && typeof ctx.tool.push === 'function');
  // the oil: a dark amber disc rising in the dish
  const oilMat = ownMaterial({ color: '#7a4a1e', flat: true, glow: 0 });
  const oil = new THREE.Mesh(new THREE.CircleGeometry(2.6, 24).rotateX(-Math.PI / 2), oilMat);
  oil.position.copy(K.centre).setY(K.bowlY - 0.3);
  oil.userData.noCollide = true;
  scene.add(oil);
  const openValve = (how) => {
    if (valveOpen()) return;
    game.set('buried.valve.open', true);
    toast(how === 'push' ? 'The fluid shoves the handwheel round. Something gurgles in the pipe, and dark oil wells up into the dish.' : 'You heave on the handwheel until it gives. Dark oil wells up into the dish.');
    sound.whoosh?.(); sound.chime?.();
  };
  registerTarget({ kind: 'valve', radius: 1.8, position: () => K.valve.at, enabled: () => !valveOpen() && flat(player.pos, K.valve.at) < 80,
    onHit: (mode) => {
      if (mode === 'push') { openValve('push'); return true; }
      st.wobble = 1;
      if (!st.hinted) { st.hinted = true; toast('The handwheel rings, and doesn’t move. It needs a shove: push it (C, middle click, or B / ○).'); }
      return true;
    } });
  registerInteractable({ id: 'valve', priority: PRIORITY.use, range: 3.4, at: () => K.valve.at, enabled: () => !valveOpen(),
    prompt: () => (toolHasPush() ? 'look at the oil valve' : 'heave the oil valve'),
    distance: (p) => (Math.abs(p.pos.y - K.valve.at.y) < 4 ? flat(p.pos, K.valve.at) : Infinity),
    use: () => { if (toolHasPush()) dialogue.start(THINGS.wick, null, K.valve.at); else openValve('heave'); } });
  // the flame (amber tongues in the dish), embers, a light, and the shaft going up through the open sky
  let flames = null, embers = null, shaft = null;
  const wickLight = V(0, 0, 0); const wickL = new THREE.Vector4(K.centre.x, K.rim + 2, K.centre.z, 0);
  level.lights.push(wickL);
  const lightUp = (instant) => {
    if (flames) return;
    const parent = new THREE.Group(); parent.position.copy(K.centre).setY(K.bowlY); parent.userData.noCollide = true; scene.add(parent);
    const tongues = [];
    for (let i = 0; i < 7; i++) { const a = (i / 7) * TAU; tongues.push({ at: V(Math.cos(a) * 1.1, 0, Math.sin(a) * 1.1), h: 2.2 + (i % 3) * 0.5, r: 0.55 }); }
    tongues.push({ at: V(0, 0, 0), h: 3.6, r: 0.8, core: 1 });
    flames = new Flames(parent, tongues, { palette: ['#fff3c4', '#ffd98a', AMBER, '#d9782f', '#a8502a'], seed: 4 });
    embers = new Embers(scene, [K.centre.clone().setY(K.bowlY + 3)], { count: 40, color: '#ffd98a', rise: 3, life: 6, spread: 1.6 });
    const sm = ownMaterial({ color: '#ffcf7a', glow: 1, flat: true });
    shaft = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 0.7, 1, 12, 1, true).translate(0, 0.5, 0), sm);
    shaft.material.side = THREE.DoubleSide;
    shaft.position.copy(K.centre).setY(K.bowlY + 4.2);
    shaft.userData.noCollide = true;
    scene.add(shaft);
    st.lightK = instant ? 1 : 0.001;
    oilMat.uniforms.uColor.value.set('#e9a53c'); oilMat.uniforms.uGlow.value = 0.9;
  };
  const light = () => {
    if (lit() || !valveOpen()) return false;
    game.set('buried.oculus.lit', true);
    lightUp(false);
    toast('The wick takes the spark. Amber light climbs the drum and goes straight up into the sky. Far off, something heavy shifts.');
    sound.whoosh?.(); sound.chime?.();
    return true;
  };
  registerTarget({ kind: 'wick', radius: 3, accepts: ['fire'], position: () => K.centre.clone().setY(K.bowlY + 0.5), enabled: () => !lit() && flat(player.pos, K.centre) < 80,
    onHit: (mode) => {
      if (!valveOpen()) { toast(mode === 'fire' ? 'The ember glob flares on the dry wick and dies. There’s no oil in the dish yet.' : 'The fluid hisses on the dry wick and runs off. There’s no oil in the dish yet.'); return true; }
      if (mode === 'shoot' || mode === 'fire') return light();
      toast('The oil shivers. The wick wants a spark, not a shove.');
      return true;
    } });
  if (lit()) lightUp(true);
  if (valveOpen()) { oil.position.y = K.bowlY; K.valve.wheel.rotation.z = TAU * 2; }

  // ---------------------------------------------------------------- the wheel and the tooth it sheds
  const toothStep = TAU / W.teeth;
  const turned = () => !!game.flag('buried.wheel.turned');
  if (turned()) W.spin.rotation.z = -toothStep;
  const tooth = new THREE.Group();
  {
    const g = new THREE.CylinderGeometry(0.22, 0.5, 0.85, 4, 1).rotateY(Math.PI / 4).scale(1, 1, 0.55);
    tooth.add(new THREE.Mesh(g, makeMaterial({ color: '#c0603e', flat: true })));
    tooth.add(new THREE.Mesh(new THREE.CylinderGeometry(0.23, 0.23, 0.08, 4).rotateY(Math.PI / 4).scale(1, 1, 0.56).translate(0, 0.43, 0), makeMaterial({ color: '#e9a53c', glow: 0.7, flat: true })));
    tooth.position.copy(W.drop).add(V(0, 0.42, 0));
    tooth.rotation.set(0.3, 0.7, 1.2);
    tooth.visible = turned() && !game.flag('buried.tooth.found');
    tooth.userData.noCollide = true;
    scene.add(tooth);
  }
  const toothLight = new THREE.Vector4(W.drop.x, W.drop.y + 1, W.drop.z, tooth.visible ? 6 : 0);
  level.lights.push(toothLight);
  registerInteractable({ id: 'tooth', priority: PRIORITY.use, range: 3, prompt: 'pick up the warm tooth', at: () => tooth.position, enabled: () => tooth.visible && st.dropT <= 0,
    distance: (p) => (Math.abs(p.pos.y - W.drop.y) < 4 ? flat(p.pos, W.drop) : Infinity),
    use: () => {
      quests.give('tooth');
      game.set('buried.tooth.found', true);
      tooth.visible = false; toothLight.w = 0;
      toast(`Picked up ${ITEMS.tooth}. It is warm, like something alive.`);
      sound.chime?.();
    } });
  // a splash on the wheel: sand pours off the teeth
  registerTarget({ kind: 'wheel', radius: W.R, position: () => W.centre, enabled: () => flat(player.pos, W.centre) < 220,
    onHit: (mode, point) => { if (point) sand.burst(point.clone(), { n: 4, rise: -1, size: 0.7, spread: 0.6, life: 2.2, gravity: 4 }); return true; } });
  const startTurn = () => {
    st.turning = true; st.turnT = 0;
    sound.whoosh?.();
    sound.setBandMode?.('wheel', 'feast');
    const b = sound.band?.('wheel'); if (b && !b.parts.includes('drum')) b.parts.push('drum');
    toast('The ground shudders. The great wheel is turning.');
  };
  const finishTurn = () => {
    st.turning = false;
    W.spin.rotation.z = -toothStep;
    game.set('buried.wheel.turned', true);
    // the sliver falls from the arc and lands at the wheel's foot
    tooth.visible = true; st.dropT = 1.2; toothLight.w = 6;
    sound.chime?.();
    sound.setBandMode?.('domes', 'feast');
    toast('One tooth. Up above, the hanging city rocks like a cradle, and every chimney on the dunes breathes out.');
  };

  // ---------------------------------------------------------------- the key on the derrick's hook
  const key = new THREE.Group();
  {
    const brass = makeMaterial({ color: '#e2b552', glow: 0.3, flat: true });
    key.add(new THREE.Mesh(mergeGeometries([new THREE.TorusGeometry(0.22, 0.06, 5, 12).toNonIndexed(), new THREE.BoxGeometry(0.08, 0.7, 0.08).translate(0, -0.55, 0).toNonIndexed(),
      new THREE.BoxGeometry(0.22, 0.08, 0.08).translate(0.1, -0.8, 0).toNonIndexed(), new THREE.BoxGeometry(0.16, 0.08, 0.08).translate(0.07, -0.66, 0).toNonIndexed()]), brass));
    key.position.copy(hook);
    key.visible = !quests.isDone('buried.key') && !quests.has('key');
    key.userData.noCollide = true;
    scene.add(key);
  }
  registerInteractable({ id: 'key', priority: PRIORITY.use, range: 4, prompt: 'take Dun’s key off the hook', at: () => hook, enabled: () => key.visible,
    distance: (p) => (Math.abs(p.pos.y - hook.y) < 5 ? flat(p.pos, hook) : Infinity),
    use: () => {
      quests.give('key');
      key.visible = false;
      if (!quests.isStarted('buried.key')) quests.start('buried.key', 'return'); else quests.advance('buried.key', 'find');
      toast(`Took ${ITEMS.key} off the crane hook. Don’t look down.`);
      sound.chime?.();
    } });

  // ---------------------------------------------------------------- the end of the main quest
  quests.def(Q).onDone = () => {
    game.set('world.buried.done', true);
    toast('The dome people will count this year as the one the sky-child watched.');
    setTimeout(() => story.complete?.(), 1200);
  };

  // ---------------------------------------------------------------- music
  sound.setBands?.([
    { id: 'domes', pos: dome.clone().add(V(0, 2, 0)), radius: 70, parts: ['ney', 'oud'], mode: turned() ? 'feast' : 'play', vol: 0.55, duck: 0.4 },
    { id: 'wheel', pos: watchAt.clone().lerp(W.centre, 0.6).setY(W.ground + 8), radius: 140, parts: turned() ? ['chant', 'bell'] : ['chant'], mode: 'play', vol: 0.5, duck: 0.3 },
  ]);

  // ---------------------------------------------------------------- per frame
  const camF = V(0, 0, 0), toW = V(0, 0, 0), _p = V(0, 0, 0);
  const update = (dt, t, { camera } = {}) => {
    const pp = player.pos;
    // arrivals
    if (!game.flag('buried.canyon.seen') && pp.z < -150 && pp.y < B.floorAt(pp.z) + 12 && Math.abs(pp.x - B.canyonX(pp.z)) < 30) game.set('buried.canyon.seen', true);
    if (!game.flag('buried.oculus.seen') && Math.hypot(pp.x - O.x, pp.z - O.z) < O.r && pp.y < O.top) game.set('buried.oculus.seen', true);

    // the domes say hello: the nearest chimneys puff, one after another, the first time you come close
    const dDome = flat(pp, dome);
    if (dDome < 40 && !st.hello) {
      st.hello = true;
      chimneys.map((c) => [c, flat(c, pp)]).sort((a, b) => a[1] - b[1]).slice(0, 5).forEach(([c], i) => setTimeout(() => puffAt(c, 0.6), 400 + i * 500));
    } else if (dDome > 90) st.hello = false;
    // the domes breathe: now and then a chimney near you puffs (often, once Dun's key has opened them)
    st.idle -= dt;
    if (st.idle <= 0) {
      st.idle = game.flag('buried.chimneys.open') ? 1.6 + Math.random() * 2 : 5 + Math.random() * 6;
      const near = chimneys.filter((c) => flat(c, pp) < 160);
      if (near.length) puffAt(near[Math.floor(Math.random() * near.length)], 0.35);
    }

    // the gauges: needles twitch as you pass; a read one swings up to its number and settles
    B.gauges.forEach((g, i) => {
      const s = gst[i];
      if (s.k > 0 && s.k < 1) {
        s.k = Math.min(1, s.k + dt / 1.4);
        const k = s.k, over = Math.sin(k * Math.PI * 2.5) * (1 - k) * 0.5;
        g.needle.rotation.z = THREE.MathUtils.lerp(s.rest, s.read, ease(k)) + over;
      } else {
        const near = flat(pp, g.centre) < 12 && !gaugeRead(i) ? 1 : 0;
        s.twitch = Math.max(near * 0.25, s.twitch - dt * 1.5);
        g.needle.rotation.z = (gaugeRead(i) ? s.read : s.rest) + Math.sin(t * 23 + i) * 0.04 * s.twitch;
      }
    });

    // the valve turns, the oil wells up; a shove that didn't take makes it ring
    if (valveOpen() && st.valveT < 1) {
      st.valveT = Math.min(1, st.valveT + dt / 2.2);
      K.valve.wheel.rotation.z = ease(st.valveT) * TAU * 2;
    } else if (st.wobble > 0) {
      st.wobble = Math.max(0, st.wobble - dt * 2.5);
      K.valve.wheel.rotation.z = Math.sin(st.wobble * 25) * 0.05 * st.wobble;
    }
    if (valveOpen()) { st.oil = Math.min(1, st.oil + dt / 3); oil.position.y = K.bowlY - 0.3 + 0.3 * st.oil; }

    // the Wick: flame, embers, the shaft of light rising out of the oculus
    const nearOculus = flat(camera?.position ?? pp, K.centre) < 420;
    if (flames && nearOculus) {
      st.lightK = Math.min(1, st.lightK + dt / 4);
      flames.intensity = 0.6 + 0.4 * st.lightK + Math.sin(t * 3.1) * 0.05;
      flames.update(dt, t);
      embers.update(dt, t);
    }
    if (shaft) {
      const k = st.lightK;
      shaft.scale.set(0.5 + 0.5 * k, Math.max(0.01, (O.top - K.bowlY + 260) * ease(k)), 0.5 + 0.5 * k);
      shaft.material.uniforms.uGlow.value = 0.65 + 0.2 * Math.sin(t * 1.3);
      wickL.w = 34 * k;
      B.porthole.light.w = 16 + 18 * k;
    }
    // standing in the Wick's light: the tank fills, and the first time takes the amber
    const inLight = lit() && st.lightK > 0.5 && flat(pp, K.centre) < 6 && pp.y < O.floor + 8;
    if (inLight && !st.amberIn) {
      const addColour = !game.flag('buried.tank.amber');
      game.emit('tool:refill', { addColour, tone: AMBER });
      if (addColour) { game.set('buried.tank.amber', true); toast('The oil-light runs down your hose. The tank takes an amber band.'); }
    }
    st.amberIn = inLight;

    // the wheel: once the Wick is lit, it turns when someone stands before it and watches
    if (lit() && !turned() && !st.turning) {
      const d = flat(pp, W.centre);
      let watching = d < 70;
      if (!watching && d < 170 && pp.y > W.ground - 12 && camera) {
        camera.getWorldDirection(camF);
        toW.set(W.centre.x, W.top - W.R * 0.4, W.centre.z).sub(camera.position).normalize();
        watching = camF.dot(toW) > 0.55;
      }
      st.wait = watching ? st.wait + dt : 0;
      if (st.wait > 1.2) startTurn();
    }
    if (st.turning) {
      st.turnT += dt;
      const u = st.turnT / TURN_TIME;
      // a creak back, the heavy lurch forward, a little overshoot, settle
      let k;
      if (u < 0.15) k = -0.06 * Math.sin((u / 0.15) * Math.PI * 0.5);
      else if (u < 0.75) k = -0.06 + 1.1 * ease((u - 0.15) / 0.6);
      else k = 1 + 0.04 * Math.cos(((u - 0.75) / 0.25) * Math.PI * 1.5) * (1 - (u - 0.75) / 0.25);
      W.spin.rotation.z = -toothStep * k;
      // sand pours off the teeth where they come out of the dune, chimneys breathe in a wave from the wheel
      if (u > 0.15 && u < 0.8 && Math.random() < dt * 12) {
        const side = Math.random() < 0.5 ? -1 : 1, along = Math.sqrt(Math.max(0, (W.R + 2) ** 2 - (W.ground - W.centre.y) ** 2));
        _p.set(W.centre.x + side * along * W.face.z, W.ground + 1 + Math.random() * 6, W.centre.z - side * along * W.face.x);
        _p.lerp(V(W.centre.x, W.top - 1, W.centre.z), Math.random() * 0.9);
        sand.burst(_p, { n: 3, rise: -0.5, size: 0.9, spread: 0.7, life: 2.4, gravity: 5 });
      }
      if (u > 0.2 && !st.waved) {
        st.waved = true;
        st.sway = 1; st.swayT = 0;
        [...chimneys, ...B.stacks].map((c) => [c, flat(c, W.centre)]).forEach(([c, dd]) => setTimeout(() => puffAt(c, 1), dd * 6));
      }
      if (u >= 1) finishTurn();
    }
    // the falling tooth
    if (st.dropT > 0) {
      st.dropT = Math.max(0, st.dropT - dt);
      const k = 1 - st.dropT / 1.2;
      tooth.position.lerpVectors(V(W.drop.x, W.top - 6, W.drop.z), W.drop.clone().add(V(0, 0.42, 0)), k * k);
      tooth.rotation.x += dt * 6;
      if (st.dropT === 0) { tooth.rotation.set(0.3, 0.7, 1.2); sand.burst(W.drop.clone(), { n: 6, rise: 1.2, size: 0.6, spread: 1.2, life: 1.6, gravity: 3 }); }
    } else if (tooth.visible) {
      tooth.position.y = W.drop.y + 0.42 + Math.sin(t * 2) * 0.05;
    }

    // the hanging city: always a slow breath of sway, a great rocking when the wheel turns
    st.swayT += dt;
    const big = st.sway * Math.exp(-st.swayT / 9) * Math.sin(st.swayT * TAU / 7);
    if (st.sway && st.swayT > 60) st.sway = 0;
    B.city.rotation.z = 0.0025 * Math.sin(t * 0.09) + 0.03 * big;
    B.city.rotation.x = 0.0018 * Math.cos(t * 0.07) + 0.012 * big;

    smoke.update(dt, null);
    sand.update(dt, null);
  };

  return { people, update, state: st, turn: () => startTurn() };
}
