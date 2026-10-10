import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeMaterial } from '../materials.js';
import { registerTarget } from '../targets.js';
import { registerInteractable, PRIORITY } from '../interact.js';
import { featherGeometry } from '../avian.js';
import { QUESTS, PEOPLE, LOCALS, THINGS, ITEMS, KNUCKLE_ORDER, KNUCKLE_LINES, KNUCKLE_HINT_STEP, RIDER_CALL, RIDER_CALL_BEAT, KEEPSAKE } from './arzach-data.js';
import { riddleState, strikeKnuckle, nextKnuckle, glinting, dots, knuckleRadius } from './knuckle-riddle.js';
import { stripTone } from './tone.js';
import { setupArzachMoments } from './arzach-moments.js';

// Vael's story, alive (arzach-data.js has the words): "The Waiting Bird".
//
//   the start    Oïa sits on a stone on the plain, watching the lone tower
//   the wind     a column of rising air up the tower's side (WIND): it lifts open
//                wings (the fluid wings, from the Aerie) to the balcony
//   the tower    the balcony, three stone steps up round the room, the sill
//                and the one window: on the sill, the rider's little bone flute
//                (a model you pick up); through the window, the room and the map
//   the call     playing the flute (RIDER_CALL, five notes) brings the bird down
//                for the first time; until then she is hidden and can't be
//                ridden (bird.dormant)
//   the plain    Senn listens to the standing stones (they hum as you pass);
//                Kesh keeps the stone hand, whose knuckles ring
//   the spires   two shed feathers on the caps of two spires; the third
//                drifts down from the stone hand's palm when it has rung
//
// The bird is the level's mount (player.mount). Her look and her bow are
// layered over her own pose. Saves that rode her before she was hidden
// (arzach.rode) keep her in sight.

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
/** The rider's roost (src/vael-ways.js), named once as you fly near it (m: within range, not on it, about its height). */
export const ROOST_CALL = { range: 120, near: 14, height: 70, text: 'Off to one side, on a floating stone: a little lean-to and a long white streamer. Somebody camped in the sky.' };

/** The wind up the lone tower's side: its foot (on the sand, beside the balcony), radius, top and lift. */
export function WIND(T, ground) {
  const a = -0.35, r = 27;   // round from the window's side, toward the landing
  const foot = V(T.x + Math.sin(a) * r, 0, T.z + Math.cos(a) * r);
  foot.y = ground(foot.x, foot.z) - 0.5;
  return { foot, r: 4.6, top: T.floor + 7, lift: 26 };   // (lift: what the column pulls toward; open wings rise at about half of it, some 13 m/s: twenty seconds up the tower)
}
/** Is p (feet) in the column? */
export const windContains = (W, p) => Math.hypot(p.x - W.foot.x, p.z - W.foot.z) < W.r && p.y > W.foot.y - 1 && p.y < W.top + 1;
/**
 * Open wings in the column: lifted, slowly, toward its middle; near its top it eases, turns you to the
 * balcony and lets you glide onto it (the temple's Updraft, src/temples/pieces.js, on a tower's scale).
 */
export function windLift(W, P, dt, onto) {
  const k = THREE.MathUtils.clamp((W.top - P.pos.y) / 4, 0, 1), want = W.lift * k;
  P.vel.y = Math.max(P.vel.y, want * 0.5) + (want - P.vel.y) * Math.min(1, dt * 3);
  if (k > 0.5) {
    P.glideSpeed = Math.min(P.glideSpeed ?? 1.5, 1.5);
    const c = Math.min(1, dt * 1.5);
    P.pos.x += (W.foot.x - P.pos.x) * c; P.pos.z += (W.foot.z - P.pos.z) * c;
  } else if (onto) {
    // the crest: it turns you toward the balcony and lets you go
    const h = angleTo(P.pos, onto);
    P.heading += wrap(h - P.heading) * Math.min(1, dt * 4);
    P.glideSpeed = Math.max(P.glideSpeed ?? 0, 8);
  }
}

/** The rider's flute: bone, finger holes, a cord round its foot and a white feather on it, on a folded cloth. Lying along x. */
export function fluteModel() {
  const g = new THREE.Group();
  g.name = 'The rider’s flute';
  const cloth = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.025, 0.3), makeMaterial({ color: '#8a6e52', color2: '#b0705a', flat: true }));
  cloth.position.set(0.02, 0.0, 0.03); cloth.rotation.y = 0.12;
  g.add(cloth);
  const bone = makeMaterial({ color: '#efe3c6', color2: '#dccba6', flat: true, glow: 0.12 });
  const dark = makeMaterial({ color: '#4a3a32', flat: true });
  const cord = makeMaterial({ color: '#b55d48', flat: true });
  const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.04, 0.46, 10).rotateZ(Math.PI / 2), bone);
  tube.position.y = 0.04;
  g.add(tube);
  const lip = new THREE.Mesh(new THREE.TorusGeometry(0.036, 0.009, 4, 12).rotateY(Math.PI / 2), bone);
  lip.position.set(-0.23, 0.04, 0);
  g.add(lip);
  const holes = mergeGeometries([-0.1, -0.03, 0.04, 0.11].map((x) => new THREE.CylinderGeometry(0.009, 0.009, 0.012, 6).translate(x, 0.075, 0).toNonIndexed()));
  g.add(new THREE.Mesh(holes, dark));
  const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.012, 0.03), dark);
  mouth.position.set(-0.17, 0.075, 0);
  g.add(mouth);
  const knot = new THREE.Mesh(new THREE.TorusGeometry(0.043, 0.008, 4, 12).rotateY(Math.PI / 2), cord);
  knot.position.set(0.19, 0.04, 0);
  g.add(knot);
  const tie = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.16, 4).rotateX(Math.PI / 2 - 0.3), cord);
  tie.position.set(0.21, 0.02, 0.07);
  g.add(tie);
  const feather = new THREE.Mesh(featherGeometry(0.34, 0.08), makeMaterial({ color: '#fbf6ea', glow: 0.25, side: THREE.DoubleSide }));
  feather.position.set(0.24, 0.012, 0.14);
  feather.rotation.set(-Math.PI / 2, 0, -0.5);
  g.add(feather);
  g.traverse((o) => { o.userData.noCollide = true; });
  return g;
}

/** The rider's call on the flute (audio.js tune: on the effects bus, something you play, not the score). */
export const playCall = (sound) => !!sound?.tune?.(RIDER_CALL, RIDER_CALL_BEAT);

export function setupArzach(ctx) {
  const { level, physics, player, quests, dialogue, game, sound, story, spawn, talkable, scene, toast, npcs } = ctx;
  const A = level.arzach;
  if (!A) return null;
  for (const q of QUESTS) quests.define(q);
  quests.itemNames = { ...(quests.itemNames ?? {}), ...ITEMS };
  // the main quest doesn't just appear: it starts when you talk to Oïa (the scout finds them till then: src/story/quests.js opensWith)
  if (!quests.isStarted('arzach.bird')) quests.opensWith('arzach.bird', 'oia');
  const T = A.tower, H = A.hand;
  const bird = player.mount?.kind === 'bird' ? player.mount : null;
  const ground = (x, z, from = 1e4) => { const g = physics.groundAt(x, from, z, 2e4); return Number.isFinite(g) ? g : level.ground.heightAt(x, z); };
  const done = () => quests.isDone('arzach.bird');
  // she is not seen, and cannot be ridden, until you have played her call (or met her before: an older save)
  const shown = () => done() || !!game.flag('arzach.bird.called') || !!game.flag('arzach.rode') || !!game.flag('bird.promise');
  const hideBird = (hidden) => { if (!bird) return; bird.dormant = hidden; bird.object.visible = !hidden; };
  hideBird(!shown());
  let quietT = -1e9;
  if (bird) bird.onDormantCall = () => {
    const now = Date.now();
    if (now - quietT < 6000) return;
    quietT = now;
    sound.whistle?.('mount');
    toast(quests.has('whistle') ? 'You whistle. Nothing answers. Her call is the rider’s, on the flute.' : 'You whistle into the haze. Nothing answers. Whatever she listens for, it isn’t that.');
  };

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
  thing(THINGS.drawing, drawing.position, { range: 1.8, enabled: () => drawing.visible });
  const palmFoot = H.palm.clone().addScaledVector(V(H.normal.x, 0, H.normal.z).normalize(), 9);
  palmFoot.y = ground(palmFoot.x, palmFoot.z, H.palm.y + 10);
  thing(THINGS.palm, palmFoot, { range: 6, prompt: 'look at the stone hand', look: H.palm });
  // the fallen giant: a look from in front of its face (src/levels/arzach.js colossus)
  if (A.colossus?.face) {
    const C = A.colossus, out = V(C.face.x - C.head.x, 0, C.face.z - C.head.z).normalize();
    const faceFoot = C.face.clone().addScaledVector(out, 14);
    faceFoot.y = ground(faceFoot.x, faceFoot.z, C.face.y + 30);
    thing(THINGS.colossus, faceFoot, { range: 9, prompt: 'look at the fallen giant', look: C.face, height: 6 });
    quests.locate?.('colossus', () => faceFoot);
  }
  // the ways home (src/vael-ways.js): the rider's mounting stone on the bird's tracks, and the roost on a stone in the sky
  if (A.tracks?.mount) thing(THINGS.mounting, A.tracks.mount.stand, { range: 3.4, prompt: 'look at the mounting stone', look: A.tracks.mount.look });
  if (A.roost) thing(THINGS.roost, A.roost.stand, { range: 3.4, prompt: 'look at the lean-to', look: A.roost.look });

  // ---------------------------------------------------------------- the rider's flute, on the sill
  // a little bone flute with a white feather tied to it by a worn cord, lying on the sill by the window
  const flute = fluteModel();
  const fluteAt = V(T.sill.x + 1.5, T.sill.y + 0.07, T.sill.z - 0.6);
  flute.position.copy(fluteAt);
  flute.rotation.y = 0.5;
  flute.scale.setScalar(1.5);
  flute.visible = !game.flag('arzach.window.seen') && !quests.has('whistle');
  scene.add(flute);
  const fluteLamp = new THREE.Vector4(fluteAt.x, fluteAt.y + 0.5, fluteAt.z, flute.visible ? 1.4 : 0);
  level.lights?.push(fluteLamp);
  const takeFlute = () => {
    if (!flute.visible) return;
    flute.visible = false; fluteLamp.w = 0;
    quests.give('whistle');
    game.set('arzach.window.seen', true);
    game.set('clue.arzach.arzach2', true);   // the map on the wall: the sky stones, the way to Vael II
    toast('A little bone flute, a white feather tied to it by a worn cord. Through the window: a narrow bed, an upturned cup, and on the wall a painted map of floating stones, a monastery and a bell.');
    sound.chime?.();
  };
  registerInteractable({ id: 'flute', priority: PRIORITY.use, range: 2.6, prompt: 'take the rider’s flute', at: () => fluteAt,
    enabled: () => flute.visible, distance: (p) => (Math.abs(p.pos.y - fluteAt.y) < 2.5 ? flat(p.pos, fluteAt) : Infinity), use: takeFlute });

  // ---------------------------------------------------------------- the wind up the tower's side
  // a column of rising air beside the balcony, from the sand to just over the balcony's floor: open
  // wings in it are carried up, round and up, and at its top it tips you onto the balcony
  const wind = WIND(T, ground);
  const windRoot = new THREE.Group();
  windRoot.name = 'The wind up the lone tower';
  const windMat = makeMaterial({ color: '#f4f8f6', flat: true, glow: 0.45, key: 'arzach.wind' });
  const windRing = new THREE.TorusGeometry(wind.r * 0.8, 0.09, 4, 32).rotateX(Math.PI / 2);
  const ringCount = Math.round((wind.top - wind.foot.y) / 5);
  const rings = Array.from({ length: ringCount }, (_, i) => { const m = new THREE.Mesh(windRing, windMat); m.userData.noCollide = true; windRoot.add(m); return { m, s: i / ringCount, w: 0.7 + (i % 3) * 0.15 }; });
  {
    const stone = new THREE.Mesh(new THREE.TorusGeometry(wind.r, 0.35, 4, 28).rotateX(Math.PI / 2), makeMaterial({ color: '#efe6d2', color2: '#e0d2b8', flat: true }));
    stone.position.copy(wind.foot).add(V(0, 0.1, 0)); stone.userData.noCollide = true; windRoot.add(stone);
  }
  scene.add(windRoot);
  const told = new Set();
  const once = (key, text) => { if (!told.has(key)) { told.add(key); toast(text); } };
  const updateWind = (dt, t) => {
    const pp = player.pos;
    windRoot.visible = flat(pp, wind.foot) < 1400;
    if (!windRoot.visible) return;
    const span = wind.top - wind.foot.y;
    for (const r of rings) {
      r.s = (r.s + dt * 0.035) % 1;
      r.m.position.set(wind.foot.x, wind.foot.y + 0.5 + r.s * span, wind.foot.z);
      const fade = Math.min(1, r.s * 10, (1 - r.s) * 8);
      r.m.scale.setScalar(Math.max(0.01, fade * (r.w + 0.08 * Math.sin(t * 2 + r.s * 30))));
      r.m.rotation.y = t * 0.4 + r.s * 3;
    }
    if (windMat.uniforms?.uGlow) windMat.uniforms.uGlow.value = 0.35 + 0.1 * Math.sin(t * 1.7);
    if (player.riding || !windContains(wind, pp)) return;
    if (!player.gliding) {
      if (player.canGlide === false) once('nowings', 'The wind rushes up the tower’s side and tugs at your cloak. It would carry wings. The makers’ white house on the plain, west of the landing, keeps a pair.');
      else if (!player.onGround) once('wings', 'The wind rushes up past you. Open your wings in it: hold A / × as you fall.');
      else once('jump', 'The wind rushes up the tower’s side. Jump into it, and open your wings as you fall (hold A / ×).');
      return;
    }
    windLift(wind, player, dt, T.balcony);
    once('ride', 'The wind fills your wings and carries you up the tower’s side.');
  };

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
    enabled: () => quests.stage('arzach.feathers') === 'give' && (game.flag('item.feather') ?? 0) >= 3 && !player.riding && !bird.dormant,
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
  // (the riddle, made readable by looking: src/story/knuckle-riddle.js. Each knuckle stone is sized by its place
  // in the order, smallest to tallest, and carries that place in dots cut on its outer face)
  const side = V(-H.normal.z, 0, H.normal.x).normalize();
  const dotMat = ownMaterial({ color: '#5a4636', glow: 0, flat: true, _id: 'arzach.knuckle.dots' });
  const knuckles = H.knuckles.map((k, i) => {
    const r = knuckleRadius(i, KNUCKLE_ORDER);
    const mat = ownMaterial({ color: '#efe6d2', glow: 0, flat: true, _id: `arzach.knuckle.${i}` });
    const m = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 10), mat);
    m.position.copy(k.pos);
    m.userData.noCollide = true;
    scene.add(m);
    const n = dots(i, KNUCKLE_ORDER);
    for (let d = 0; d < n; d++) {
      const dot = new THREE.Mesh(new THREE.SphereGeometry(0.42, 8, 6), dotMat);
      dot.position.copy(k.pos).addScaledVector(H.normal, r * 0.93).addScaledVector(side, (d - (n - 1) / 2) * 1.05);
      dot.userData.noCollide = true;
      scene.add(dot);
    }
    return { ...k, i, m, mat, r, lit: 0 };
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
  const riddle = riddleState();
  riddle.rung = !!game.flag('arzach.hand.rung');
  const hand = { riddle, t: 0, open: riddle.rung ? 1 : 0, opening: false, fail: 0, get seq() { return riddle.seq; } };
  // once Kesh has called the order out, the journal spells it too
  const ringStep = quests.def('arzach.hand')?.stages.find((x) => x.id === 'ring');
  const spellStep = () => { if (ringStep) ringStep.text = KNUCKLE_HINT_STEP; };
  if (game.flag('arzach.hand.hint')) spellStep();
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
    registerTarget({ kind: 'knuckle', radius: k.r, position: () => k.pos, enabled: () => player.pos.distanceTo(k.pos) < 120,
      onHit: (mode) => {
        if (mode !== 'shoot') { k.lit = Math.max(k.lit, 0.3); return true; }
        const { result, hint } = strikeKnuckle(riddle, k.i, KNUCKLE_ORDER);
        if (result === 'wrong') {
          // a dull knock, every knuckle flashes rust and goes dark, the chain starts again (no bell: the notes are
          // only for the right ones, so the rising scale is the sign you are on the way)
          hand.fail = 1;
          for (const o of knuckles) o.lit = 0;
          if (riddle.seq[0] === k.i) k.lit = 1;
          if (sound.ctx) sound.critter?.('clank', 0.8);
          if (hint === 'call') {
            game.set('arzach.hand.hint', true);
            spellStep();
            if (!quests.isStarted('arzach.hand')) quests.start('arzach.hand');
            toast(`Kesh: ${stripTone(KNUCKLE_LINES.call)}`);
          } else if (hint === 'glint') toast(stripTone(KNUCKLE_LINES.glint));
          else toast(stripTone(KNUCKLE_LINES.miss));
          return true;
        }
        k.lit = 1;
        knuckleNote(k);
        if (result === 'rung') ringHand();
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
      // she lowers her long neck to you and opens her wings wide (bow.len: her first, filmed, is longer)
      const len = bow.short ? 2.2 : bow.len ?? 4.2, k = Math.sin(Math.PI * Math.min(bow.t / len, 1));
      bird.body.rotation.x += 0.62 * k;
      bird.body.position.y = -0.25 * k;
      // (out of the fold, bird.js poseWings: unrolled, swept forward, the feathers and the hand at their full size)
      for (const w of bird.wings) {
        w.shoulder.rotation.x *= 1 - k; w.shoulder.rotation.y -= w.side * 1.0 * k; w.shoulder.rotation.z += w.side * 0.35 * k;
        w.shoulder.scale.z += (1 - w.shoulder.scale.z) * k;
        w.elbow.rotation.y += w.side * 0.1 * k; w.elbow.rotation.z *= 1 - k; w.elbow.scale.setScalar(w.elbow.scale.x + (1 - w.elbow.scale.x) * k);
      }
    };
  }
  const cry = (pitch = 1) => {
    if (!sound.ctx || !sound.sweep) return;
    const t = sound.ctx.currentTime;
    sound.sweep(t, 700 * pitch, 1500 * pitch, 0.35, 0.05, 'triangle');
    sound.sweep(t + 0.32, 1500 * pitch, 650 * pitch, 0.6, 0.04, 'triangle');
  };
  // the rider's flute: E anywhere (while you carry it and haven't played it): her call, and she comes down
  // (the first time filmed, src/story/arzach-moments.js: set up below, once her bow exists; else as always)
  let film = { bird: () => false };
  const call = { state: game.flag('arzach.bird.called') && !game.flag('arzach.bird.promise') ? 'coming' : null, t: 0 };
  // (it sits just inside talking range: someone right beside you still comes first)
  registerInteractable({ id: 'whistle', priority: PRIORITY.use, range: 3, prompt: 'play the rider’s flute',
    enabled: () => quests.stage('arzach.bird') === 'call' && quests.has('whistle') && !player.riding,
    distance: () => 2.9,
    use: () => {
      game.set('arzach.bird.called', true);
      call.state = 'coming'; call.t = 0;
      playCall(sound);
      const said = 'Five notes: low, rising, a turn, and a long high one. Your fingers learn them as they play. High over the haze, something answers.';
      let filmed = false;
      if (bird) {
        hideBird(false);
        // she comes down out of the haze for the first time: from high over the plain, to you
        // (on the tower's top, to its balcony)
        const pp = player.pos, top = flat(pp, T) < 40 && pp.y > T.floor - 6;
        const d = player.frame?.dir ? player.frame.dir(player.heading, _v) : _v.set(Math.sin(player.heading), 0, Math.cos(player.heading));
        // (on the balcony's open rim, out from under the room's dome and clear of the steps and the sill)
        const land = top ? V(T.x + Math.sin(-0.6) * 17.5, T.floor, T.z + Math.cos(-0.6) * 17.5) : V(pp.x + d.z * 3 + d.x * 2.5, pp.y, pp.z - d.x * 3 + d.z * 2.5);
        bird.pos.set(pp.x - 170, Math.max(pp.y, T.floor) + 150, pp.z + 140);
        bird.landed = false;
        // filmed, the first time (it brings her start in nearer and says the toast at its end)
        filmed = film.bird({ land, said });
        bird.summon(land.x, land.z, angleTo(land, pp), top ? land : pp);
      }
      if (!filmed) toast(said);
    } });
  /** She bows to you (on landing beside you; a moment asks for it if she is late). */
  const bowNow = () => {
    if (call.state !== 'coming' || !bird) return;
    call.state = 'bowing'; bow.t = 0.001; bow.short = false;
    bird.heading = angleTo(bird.pos, player.pos);
    cry(1.1);
  };
  const keepPromise = () => {
    if (game.flag('arzach.bird.promise')) return;
    game.set('arzach.bird.promise', true);
  };
  // the story catches up when you take it out of order (rode off before sitting with Oïa, found the window first…)
  const catchUp = () => {
    if (done()) return;
    if (quests.stage('arzach.bird') === 'ride') quests.set('arzach.bird', 'tower');   // (saves from when you rode her to the tower)
    const want = game.flag('arzach.bird.called') ? 'promise' : quests.has('whistle') ? 'call' : null;
    if (want && !quests.reached('arzach.bird', want)) quests.set('arzach.bird', want);
  };
  game.on('flag', catchUp);
  catchUp();
  quests.def('arzach.bird').onDone = () => {
    game.set('bird.promise', true);
    game.set('world.arzach.done', true);
    game.addKeepsake(KEEPSAKE);
    toast('Keepsake: the bird’s promise. Wherever there is sky, she will come when you call.');
    setTimeout(() => story.complete?.(), 1500);
  };

  film = setupArzachMoments(ctx, { bird, bow, cry, bowNow, tower: T });

  // ---------------------------------------------------------------- places for the quest markers
  quests.locate('oia', () => people.oia.pos);
  // (while she has not answered her call she is nowhere: the feathers wait for her at the tower's balcony, where she comes down)
  quests.locate('bird', () => (bird && !bird.dormant ? bird.pos : bird ? T.balcony : people.oia.pos));
  quests.locate('balcony', () => T.balcony);
  quests.locate('wind', () => (player.pos.y < T.floor - 20 ? wind.foot : T.balcony));
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
      const near = bird.pos.distanceTo(pp) < 15 && (bird.mode === 'idle' || bird.mode === undefined || bird.landed);   // (15: on the balcony, below you on the sill)
      if (near || call.t > 25) bowNow();
    }
    if (bow.t > 0) {
      bow.t += dt;
      if (bow.t > (bow.short ? 2.2 : bow.len ?? 4.2)) {
        bow.t = 0; bow.len = undefined;
        if (call.state === 'bowing') { call.state = null; keepPromise(); }
      }
    }
    // the hand: knuckles glow when struck, dim after; the palm opens when it rings
    // (the chain so far stays lit; a miss flashes them all rust; after enough misses the next right one glints)
    const next = nextKnuckle(riddle, KNUCKLE_ORDER), glint = glinting(riddle);
    for (const k of knuckles) {
      const held = riddle.seq.includes(k.i) ? 0.75 : 0;
      k.lit = Math.max(game.flag('arzach.hand.rung') ? 0.25 : held, k.lit - dt * 0.35);
      const pulse = glint && k.i === next ? 0.35 + 0.35 * Math.sin(t * 5) : 0;
      k.mat.uniforms.uGlow.value = Math.max(k.lit * 0.8, pulse, hand.fail * 0.6);
      k.mat.uniforms.uColor.value.set(hand.fail > 0.05 ? '#c0623e' : k.lit > 0.05 ? '#f6cf8a' : pulse > 0.05 ? '#fff4d6' : '#efe6d2');
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
    // the wind up the tower
    updateWind(dt, t);
    // flying home from the tower, the roost comes up on the bird's line: named once, while there is time to land on it
    if (A.roost && !told.has('roost') && !game.flag('arzach.roost.seen') && shown()) {
      const R = A.roost.top, pp = player.pos;
      if (flat(pp, R) < ROOST_CALL.range && flat(pp, R) > ROOST_CALL.near && Math.abs(pp.y - R.y) < ROOST_CALL.height) once('roost', ROOST_CALL.text);
    }
  };

  return { people, update, hand, bow, call, feathers, knuckles, ringHand, cry, flute, takeFlute, wind, shown, film };
}
