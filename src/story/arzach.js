import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeMaterial } from '../materials.js';
import { registerTarget } from '../targets.js';
import { registerInteractable, PRIORITY } from '../interact.js';
import { featherGeometry } from '../avian.js';
import { QUESTS, PEOPLE, LOCALS, THINGS, ITEMS, KNUCKLE_ORDER } from './arzach-data.js';

// Vael's story, alive (arzach-data.js has the words): "The Waiting Bird".
//
//   the start    Oïa sits on a stone beside the bird, watching the lone tower;
//                the bird keeps turning to look at it too, until she is called
//   the tower    the balcony, three stone steps up round the room, the sill
//                and the one window: the rider's room, the map, the whistle
//   the plain    Senn listens to the standing stones (they hum as you pass);
//                Hollin keeps the stone hand, whose knuckles ring
//   the spires   two shed feathers on the caps of two spires; the third
//                drifts down from the stone hand's palm when it has rung
//
// The bird is the level's mount (player.mount). Her look and her bow are
// layered over her own pose (bird.js stays untouched).

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const flat = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const angleTo = (from, to) => Math.atan2(to.x - from.x, to.z - from.z);
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

/** A material of our own (makeMaterial caches by options): its colour and glow can change without touching anything else. */
function ownMaterial(o) {
  const base = makeMaterial(o), m = base.clone();
  m.uniforms = { ...base.uniforms, uColor: { value: new THREE.Color(o.color) }, uGlow: { value: o.glow ?? 0 } };
  return m;
}

// where the shed feathers lie: the caps of two spires (arzach.js spires, by their place), and the hand's palm
const FEATHER_SPIRES = [[170, -282], [414, -543]];

export function setupArzach(ctx) {
  const { level, physics, player, quests, dialogue, game, sound, story, spawn, talkable, scene, toast, npcs } = ctx;
  const A = level.arzach;
  if (!A) return null;
  for (const q of QUESTS) quests.define(q);
  quests.itemNames = { ...(quests.itemNames ?? {}), ...ITEMS };
  if (!quests.isStarted('arzach.bird')) quests.start('arzach.bird');
  const T = A.tower, H = A.hand;
  const bird = player.mount?.kind === 'bird' ? player.mount : null;
  const ground = (x, z, from = 1e4) => { const g = physics.groundAt(x, from, z, 2e4); return Number.isFinite(g) ? g : level.ground.heightAt(x, z); };
  const done = () => quests.isDone('arzach.bird');

  // ---------------------------------------------------------------- the people
  const people = {};
  // Oïa on a stone beside where the bird waits, facing the tower
  const oiaAt = V(17, 0, 2); oiaAt.y = ground(oiaAt.x, oiaAt.z);
  people.oia = spawn(PEOPLE.oia, { route: [oiaAt.clone()], seat: 0.45, heading: angleTo(oiaAt, T) });
  {
    const st = new THREE.Mesh(new THREE.IcosahedronGeometry(0.6, 0).scale(1.2, 0.75, 1), makeMaterial({ color: '#efe4cf', flat: true }));
    st.position.copy(oiaAt).add(V(0, 0.08, 0)); st.userData.noCollide = true; scene.add(st);
  }
  // the level's own three (content.js; their indices matter for the errands)
  LOCALS.forEach((def, i) => { const n = npcs[i]; if (n && !n.def?.talk) { talkable(n, def); people[def.id] = n; } });

  // her drawing in the sand: the bird's track, the glyph (once she has drawn it)
  const drawing = new THREE.Group();
  {
    const ink = makeMaterial({ color: '#8a6e52', flat: true });
    const parts = [-0.32, 0, 0.32].map((dx) => new THREE.CylinderGeometry(0.075, 0.075, 0.02, 8).translate(dx, 0, dx ? 0 : -0.08).toNonIndexed());
    const arc = new THREE.TorusGeometry(0.42, 0.03, 3, 14, Math.PI).rotateX(-Math.PI / 2).translate(0, 0, 0.32);
    parts.push(arc.toNonIndexed());
    drawing.add(new THREE.Mesh(mergeGeometries(parts), ink));
    const at = oiaAt.clone().addScaledVector(V(Math.sin(angleTo(oiaAt, T)), 0, Math.cos(angleTo(oiaAt, T))), 2.0);
    at.y = ground(at.x, at.z, at.y + 3) + 0.03;
    drawing.position.copy(at);
    drawing.rotation.y = angleTo(oiaAt, T) + Math.PI;
    drawing.scale.setScalar(2.4);
    drawing.userData.noCollide = true;
    drawing.visible = !!game.flag('arzach.glyph.drawn');
    scene.add(drawing);
    game.on('flag:arzach.glyph.drawn', (v) => { drawing.visible = !!v; });
  }

  // ---------------------------------------------------------------- things to look at
  const thing = (def, at, { range = 3, prompt, enabled = () => true, look = null, use, height = 4 } = {}) => registerInteractable({
    id: def.id, priority: PRIORITY.use, range, prompt: prompt ?? `look at ${def.name.replace(/^The /, 'the ').replace(/^A /, 'a ')}`,
    at: () => at, enabled, distance: (p) => (Math.abs(p.pos.y - at.y) < height ? flat(p.pos, at) : Infinity),
    use: use ?? (() => dialogue.start(def, null, at, look)),
  });
  const windowAt = T.sill.clone().add(V(0, 1.2, 0));
  thing(THINGS.window, windowAt, { range: 3.6, prompt: () => (game.flag('arzach.window.seen') ? 'look into the room' : 'look through the window'),
    enabled: () => quests.stage('arzach.bird') !== 'call' });   // with the whistle in hand, E blows it, even on the sill
  thing(THINGS.drawing, drawing.position, { range: 1.8, enabled: () => drawing.visible });
  const palmFoot = H.palm.clone().addScaledVector(V(H.normal.x, 0, H.normal.z).normalize(), 9);
  palmFoot.y = ground(palmFoot.x, palmFoot.z, H.palm.y + 10);
  thing(THINGS.palm, palmFoot, { range: 6, prompt: 'look at the stone hand', look: H.palm });

  // the window lights up warm once you've looked in: you can see it from the plain
  const winLit = new THREE.Mesh(new THREE.BoxGeometry(4.6, 6.6, 0.4), makeMaterial({ color: '#f6cf8a', glow: 0.85 }));
  winLit.position.copy(T.window).add(V(0, 0, 0.45));
  winLit.userData.noCollide = true;
  winLit.visible = !!game.flag('arzach.window.seen');
  scene.add(winLit);
  const winLight = V(0, -1e5, 0);
  const winLamp = new THREE.Vector4(T.window.x, T.window.y, T.window.z + 3, 0);
  level.lights?.push(winLamp);
  game.on('flag:arzach.window.seen', () => { winLit.visible = true; });

  // ---------------------------------------------------------------- the feathers
  const featherMat = makeMaterial({ color: '#fbf6ea', glow: 0.55, side: THREE.DoubleSide });
  const featherGeo = featherGeometry(2.2, 0.5);
  const feathers = [];
  const addFeather = (i, at) => {
    if (game.flag(`arzach.feather.${i}`)) return null;
    const g = new THREE.Group();
    const m = new THREE.Mesh(featherGeo, featherMat);
    m.rotation.set(-0.5, 0, 0.3); m.position.z = 1.1;
    g.add(m);
    g.position.copy(at);
    g.userData.noCollide = true;
    scene.add(g);
    const light = new THREE.Vector4(at.x, at.y + 0.6, at.z, 6);
    level.lights?.push(light);
    const f = { i, g, at: at.clone(), base: at.y, light, live: true };
    f.off = registerInteractable({ id: `feather.${i}`, priority: PRIORITY.use, range: 2.8, prompt: 'pick up the feather', at: () => f.g.position,
      enabled: () => f.live && !f.falling, distance: (p) => (Math.abs(p.pos.y - f.g.position.y) < 3.5 ? flat(p.pos, f.g.position) : Infinity),
      use: () => pickFeather(f) });
    feathers.push(f);
    return f;
  };
  const pickFeather = (f) => {
    f.live = false; f.g.removeFromParent(); f.off(); f.light.set(0, -1e5, 0, 0);
    game.set(`arzach.feather.${f.i}`, true);
    if (!quests.isStarted('arzach.feathers')) quests.start('arzach.feathers');
    quests.give('feather');
    const n = game.flag('item.feather') ?? 0;
    toast(n >= 3 ? 'Three feathers. They are lighter than they look, and warm.' : `Picked up ${ITEMS.feather} (${n} of 3)`);
    sound.chime();
  };
  FEATHER_SPIRES.forEach(([x, z], i) => {
    const s = A.spires.find((sp) => sp.cap && Math.hypot(sp.x - x, sp.z - z) < 3);
    if (!s) return;
    const at = V(s.x + s.cap * 0.25, 0, s.z - s.cap * 0.2); at.y = ground(at.x, at.z, s.capY + 6) + 0.35;
    addFeather(i, at);
  });
  // the third: in the hand's palm until it rings, then it drifts down to the sand in front of it
  const palmFeatherAt = H.palm.clone().addScaledVector(H.normal, 1.5);
  const featherRest = palmFoot.clone().add(V(-H.normal.z, 0, H.normal.x).normalize().multiplyScalar(3.5));
  featherRest.y = ground(featherRest.x, featherRest.z, H.palm.y + 10) + 0.35;
  let handFeather = null;
  if (!game.flag('arzach.feather.2')) {
    if (game.flag('arzach.hand.rung')) handFeather = addFeather(2, featherRest);
    else { handFeather = addFeather(2, palmFeatherAt); handFeather.held = true; }
  }
  quests.locate('feather', () => {
    let best = null, bd = Infinity;
    for (const f of feathers) {
      if (!f.live) continue;
      const p = f.held ? palmFoot : f.g.position, d = flat(player.pos, p);
      if (d < bd) { bd = d; best = p; }
    }
    return best;
  });
  // the bird takes them back: three bright feathers in her wing
  const wingFeathers = [];
  const dressWing = () => {
    if (!bird || wingFeathers.length) return;
    const tones = ['#52c8cf', '#966ede', '#ef7e62'];
    bird.wings.forEach((w, k) => {
      for (let j = 0; j < (k ? 2 : 1); j++) {
        const m = new THREE.Mesh(featherGeometry(2.4, 0.42), makeMaterial({ color: tones[(k + j * 2) % 3], glow: 0.35, side: THREE.DoubleSide }));
        m.position.set(w.side * (1.0 + j * 0.3), -0.02, -0.25 - j * 0.1);
        m.rotation.y = -w.side * (0.75 + j * 0.15);
        w.elbow.add(m);
        wingFeathers.push(m);
      }
    });
  };
  if (game.flag('arzach.feathers.given')) dressWing();
  if (bird) registerInteractable({ id: 'feathers.give', priority: PRIORITY.use, range: 6.5, prompt: 'give the bird her feathers', at: () => _v.copy(bird.pos).add(V(0, 2.4, 0)),
    enabled: () => quests.stage('arzach.feathers') === 'give' && (game.flag('item.feather') ?? 0) >= 3 && !player.riding,
    distance: (p) => bird.pos.distanceTo(p.pos) - 0.5,
    use: () => {
      for (let i = 0; i < 3; i++) quests.take('feather');
      game.set('arzach.feathers.given', true);
      dressWing();
      bow.t = 0.001; bow.short = true;
      toast('She takes each feather in her beak and tucks it back into her wing. Three bright feathers flash there now when she flies.');
      sound.chime();
    } });

  // ---------------------------------------------------------------- the stone hand
  const knuckles = H.knuckles.map((k, i) => {
    const mat = ownMaterial({ color: '#efe6d2', glow: 0, flat: true, _id: `arzach.knuckle.${i}` });
    const m = new THREE.Mesh(new THREE.SphereGeometry(3.4, 12, 8), mat);
    m.position.copy(k.pos);
    m.userData.noCollide = true;
    scene.add(m);
    return { ...k, i, m, mat, lit: 0 };
  });
  const palmGlyph = (() => {
    const mat = ownMaterial({ color: '#8a6e52', glow: 0, flat: true, _id: 'arzach.palm' });
    const parts = [-1.6, 0, 1.6].map((dx) => new THREE.SphereGeometry(0.55, 8, 6).translate(dx, 1.4 + (dx ? 0 : 0.4), 0).toNonIndexed());
    parts.push(new THREE.TorusGeometry(2.2, 0.28, 4, 16, Math.PI).translate(0, -1.4, 0).toNonIndexed());
    const m = new THREE.Mesh(mergeGeometries(parts), mat);
    m.position.copy(H.palm).addScaledVector(H.normal, -1.85);
    m.quaternion.copy(H.group.quaternion);
    m.userData.noCollide = true;
    scene.add(m);
    return { m, mat };
  })();
  const hand = { seq: [], t: 0, open: game.flag('arzach.hand.rung') ? 1 : 0, opening: false, fail: 0 };
  const knuckleNote = (k) => {
    if (!sound.ctx) return;
    const rank = KNUCKLE_ORDER.indexOf(k.i);
    sound.instrument?.('bell', [196, 247, 294, 392][rank] ?? 220, sound.ctx.currentTime, 2, 0.12, sound.fx);
  };
  const ringHand = () => {
    if (game.flag('arzach.hand.rung')) return;
    if (!quests.isStarted('arzach.hand')) quests.start('arzach.hand');
    game.set('arzach.hand.rung', true);
    hand.opening = true;
    toast('The hand rings, all four knuckles at once, a long chord. The mark in its palm glows. Something white slips from the stone fingers.');
    sound.chime();
  };
  for (const k of knuckles) {
    registerTarget({ kind: 'knuckle', radius: 3.4, position: () => k.pos, enabled: () => player.pos.distanceTo(k.pos) < 120,
      onHit: (mode) => {
        if (mode !== 'shoot') { k.lit = Math.max(k.lit, 0.3); return true; }
        k.lit = 1;
        knuckleNote(k);
        if (game.flag('arzach.hand.rung')) return true;
        hand.seq.push(k.i);
        const n = hand.seq.length;
        if (KNUCKLE_ORDER[n - 1] !== k.i) {
          hand.seq = KNUCKLE_ORDER[0] === k.i ? [k.i] : [];
          hand.fail = 1;
          if (sound.ctx) sound.critter?.('clank', 0.8);
          if (!hand.hinted && quests.isActive('arzach.hand')) { hand.hinted = true; toast('A dull knock. The knuckles go quiet. Small to tall, Hollin said.'); }
        } else if (n === KNUCKLE_ORDER.length) ringHand();
        return true;
      } });
  }
  quests.locate('hand', () => palmFoot);

  // ---------------------------------------------------------------- the bird: she looks at the tower, and bows
  const _v = V(0, 0, 0);
  const bow = { t: 0, short: false };
  if (bird) {
    const idle = bird.idle.bind(bird), pose = bird.pose.bind(bird);
    bird.idle = (dt) => {
      idle(dt);
      // until she is called, she keeps turning to look at the lone tower
      if (!done() && bird.mode !== 'ridden' && bow.t === 0) bird.heading += wrap(angleTo(bird.pos, T) - bird.heading) * (1 - Math.exp(-0.6 * dt));
    };
    bird.pose = (dt) => {
      pose(dt);
      if (bow.t <= 0) return;
      // she lowers her long neck to you and opens her wings wide
      const len = bow.short ? 2.2 : 4.2, k = Math.sin(Math.PI * Math.min(bow.t / len, 1));
      bird.body.rotation.x += 0.62 * k;
      bird.body.position.y = -0.25 * k;
      for (const w of bird.wings) { w.shoulder.rotation.y -= w.side * 1.0 * k; w.shoulder.rotation.z += w.side * 0.35 * k; w.elbow.rotation.y -= w.side * 1.2 * k; }
    };
  }
  const cry = (pitch = 1) => {
    if (!sound.ctx || !sound.sweep) return;
    const t = sound.ctx.currentTime;
    sound.sweep(t, 700 * pitch, 1500 * pitch, 0.35, 0.05, 'triangle');
    sound.sweep(t + 0.32, 1500 * pitch, 650 * pitch, 0.6, 0.04, 'triangle');
  };
  // the rider's whistle: E anywhere (while you carry it and haven't blown it)
  const call = { state: game.flag('arzach.bird.called') && !game.flag('arzach.bird.promise') ? 'coming' : null, t: 0 };
  // (it sits just inside talking range: someone right beside you, or the bird, still comes first)
  registerInteractable({ id: 'whistle', priority: PRIORITY.use, range: 3, prompt: 'blow the rider’s whistle',
    enabled: () => quests.stage('arzach.bird') === 'call' && quests.has('whistle') && !player.riding,
    distance: () => 2.9,
    use: () => {
      game.set('arzach.bird.called', true);
      call.state = 'coming'; call.t = 0;
      if (sound.ctx && sound.sweep) { const t = sound.ctx.currentTime; sound.sweep(t, 1900, 2600, 0.45, 0.05); sound.sweep(t + 0.5, 2600, 1700, 0.7, 0.04); }
      toast('One long note, rising. Far off, the bird lifts her head.');
      if (bird && bird.pos.distanceTo(player.pos) > 12) {
        const d = player.frame?.dir ? player.frame.dir(player.heading, _v) : _v.set(Math.sin(player.heading), 0, Math.cos(player.heading));
        bird.summon(player.pos.x + d.z * 3 + d.x * 2.5, player.pos.z - d.x * 3 + d.z * 2.5, player.heading + Math.PI, player.pos);
      }
    } });
  const keepPromise = () => {
    if (game.flag('arzach.bird.promise')) return;
    game.set('arzach.bird.promise', true);
  };
  // the story catches up when you take it out of order (rode off before sitting with Oïa, found the window first…)
  const catchUp = () => {
    if (done()) return;
    const want = game.flag('arzach.bird.called') ? 'promise' : quests.has('whistle') ? 'call' : game.flag('arzach.rode') && !quests.reached('arzach.bird', 'ride') ? 'tower' : null;
    if (want && !quests.reached('arzach.bird', want)) quests.set('arzach.bird', want);
  };
  game.on('flag', catchUp);
  catchUp();
  quests.def('arzach.bird').onDone = () => {
    game.set('bird.promise', true);
    game.set('world.arzach.done', true);
    game.addKeepsake({ id: 'arzach.person', level: 'arzach', name: 'The bird’s promise', kind: 'person', text: 'She bowed her long neck and opened her wings. Wherever there is sky, call, and she will come.' });
    toast('Keepsake: the bird’s promise. Wherever there is sky, she will come when you call.');
    setTimeout(() => story.complete?.(), 1500);
  };

  // ---------------------------------------------------------------- places for the quest markers
  quests.locate('oia', () => people.oia.pos);
  quests.locate('bird', () => bird?.pos ?? people.oia.pos);
  quests.locate('balcony', () => T.balcony);
  quests.locate('window', () => windowAt);
  for (const [id, n] of Object.entries(people)) if (id !== 'oia') quests.locate(id, () => n.pos);

  // ---------------------------------------------------------------- per frame
  const st = { menhir: new Map(), near: false, rideToast: false, towerCry: false };
  const update = (dt, t) => {
    const pp = player.pos;
    // riding her for the first time
    if (bird && player.riding && player.ride === bird && !game.flag('arzach.rode')) {
      game.set('arzach.rode', true);
      if (!done()) { toast('She lifts before you ask. She knows the way.'); cry(1); }
    }
    // she cries once when the tower comes near on her back
    if (bird && player.ride === bird && !st.towerCry && flat(pp, T) < 260 && !done()) { st.towerCry = true; cry(0.9); }
    // the whistle: she flies to you, lands, and bows
    if (call.state === 'coming' && !bird) { call.state = null; keepPromise(); }
    if (call.state === 'coming' && bird) {
      call.t += dt;
      const near = bird.pos.distanceTo(pp) < 11 && (bird.mode === 'idle' || bird.mode === undefined || bird.landed);
      if (near || call.t > 25) {
        call.state = 'bowing'; bow.t = 0.001; bow.short = false;
        bird.heading = angleTo(bird.pos, pp);
        cry(1.1);
      }
    }
    if (bow.t > 0) {
      bow.t += dt;
      const len = bow.short ? 2.2 : 4.2;
      if (bow.t > len) {
        bow.t = 0;
        if (call.state === 'bowing') { call.state = null; keepPromise(); }
      }
    }
    // the hand: knuckles glow when struck, dim after; the palm opens when it rings
    for (const k of knuckles) {
      k.lit = Math.max(game.flag('arzach.hand.rung') ? 0.25 : 0, k.lit - dt * (hand.fail > 0 ? 2.5 : 0.35));
      k.mat.uniforms.uGlow.value = k.lit * 0.8;
      k.mat.uniforms.uColor.value.set(k.lit > 0.05 ? '#f6cf8a' : '#efe6d2');
    }
    hand.fail = Math.max(0, hand.fail - dt * 2);
    if (hand.opening && hand.open < 1) hand.open = Math.min(1, hand.open + dt / 3);
    palmGlyph.mat.uniforms.uGlow.value = hand.open * (0.7 + 0.15 * Math.sin(t * 2));
    palmGlyph.mat.uniforms.uColor.value.set(hand.open > 0.05 ? '#f2c54b' : '#8a6e52');
    // the third feather drifts down from the palm, turning
    if (handFeather?.held && game.flag('arzach.hand.rung')) { handFeather.held = false; handFeather.falling = 0.0001; }
    if (handFeather?.falling > 0 && handFeather.live) {
      const f = handFeather;
      f.falling = Math.min(1, f.falling + dt / 6);
      const k = f.falling;
      f.g.position.lerpVectors(palmFeatherAt, featherRest, k);
      f.g.position.x += Math.sin(k * 14) * 1.6 * (1 - k);
      f.g.position.z += Math.cos(k * 11) * 1.2 * (1 - k);
      if (k >= 1) f.falling = 0;
    }
    for (const f of feathers) {
      if (!f.live) continue;
      if (!f.falling) f.g.position.y = (f.held ? palmFeatherAt.y : f.g.position.y - (f.bob ?? 0)) + (f.bob = Math.sin(t * 1.4 + f.i) * 0.12);
      f.g.rotation.y += dt * 0.6;
      f.light.set(f.g.position.x, f.g.position.y + 0.6, f.g.position.z, 6);
    }
    // the standing stones hum as you walk past (Senn's stones)
    if (!player.riding) {
      for (let i = 0; i < A.menhirs.length; i++) {
        const m = A.menhirs[i];
        if (Math.abs(pp.x - m.x) > 5 || Math.abs(pp.z - m.z) > 5) continue;
        const last = st.menhir.get(i) ?? -1e9;
        if (t - last > 12 && Math.hypot(pp.x - m.x, pp.z - m.z) < 4.5) {
          st.menhir.set(i, t);
          if (sound.ctx && sound.pluck) [0, 7].forEach((d, j) => sound.pluck(sound.freq(d, -1), sound.ctx.currentTime + j * 0.4, 0.08, 'sine', sound.fx));
        }
      }
    }
    // the lit window throws a little warm light on the sill
    winLamp.w = winLit.visible ? 14 : 0;
    void winLight;
  };

  return { people, update, hand, bow, call, feathers, knuckles, ringHand, cry };
}
