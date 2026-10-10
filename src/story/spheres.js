import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeMaterial } from '../materials.js';
import { registerTarget } from '../targets.js';
import { registerInteractable, PRIORITY } from '../interact.js';
import { Puffs, ownMaterial } from './puffs.js';
import { QUESTS, PEOPLE, THINGS, ITEMS, SOUNDS, orbDegree } from './spheres-data.js';
import { setupSpheresMoments } from './spheres-moments.js';

// The Garden of Spheres' story, alive (spheres-data.js has the words).
//
//   the grove    Linnet, the listener (a level person), near the start
//   the lake     Nell on the south shore; the glint in the water (shoot it)
//   the meadow   Emrys on the meadow pyramid's summit, who has looked under a sphere
//   the spheres  every great sphere rings its own note when the fluid touches
//                it (shoot them: the garden is an instrument); three remember
//                more: splashed, a ring of light closes round its foot, it
//                plays its sound (then a band of its own) and rings ripple out
//   the avenue   Cael walking it slowly; white bells along its edges open
//                as you pass, and shut if you run or jump
//   the plaza    Ume by the pole; splash the pole with the three sounds and
//                it plays them back as one little tune, then together (the
//                great sphere on the horizon answers with a halo; filmed the first
//                time: spheres-moments.js)
//
// Flags (game-state.js): spheres.aube.heard, spheres.heard.bell / chant /
// drum, spheres.heard.three, spheres.chord.heard, spheres.rumour.light,
// spheres.pebble.out / taken / placed, spheres.avenue.walked;
// clue.spheres.desert. Items: pebble.

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const flat = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

export function setupSpheres(ctx) {
  const { level, physics, player, quests, dialogue, game, sound, story, spawn, scene, toast, npcs, moments } = ctx;
  const G = level.spheres;
  if (!G) return null;
  const film = setupSpheresMoments(ctx, { moments, G });
  for (const q of QUESTS) quests.define(q);
  quests.itemNames = ITEMS;
  const Q = 'spheres.listen';
  // the main quest doesn't just appear: it starts when you talk to Linnet (the scout finds them till then: src/story/quests.js opensWith)
  if (!quests.isStarted(Q)) quests.opensWith(Q, 'aube.spheres', { at: 'aube' });
  const H = (x, z) => level.ground.heightAt(x, z);
  const onGround = (x, z, from = 30) => { const g = physics.groundAt(x, from, z, 80); return V(x, Number.isFinite(g) ? g : H(x, z), z); };
  const Pz = G.plaza, pole = V(Pz.x, Pz.ground, Pz.z);

  // ---------------------------------------------------------------- the people
  const people = {};
  for (const id of ['aube', 'nell', 'ivo', 'cael']) { const n = npcs.find((m) => m.def?.id === (PEOPLE[id]?.id ?? id)); if (n) people[id] = n; }
  // Cael walks the avenue, up and down, slowly
  if (people.cael) {
    people.cael.route = [onGround(6.5, G.avenue.z0 - 6), onGround(6.5, -470), onGround(6.5, G.avenue.z1 + 6), onGround(6.5, -470)];
    people.cael.wp = 1; people.cael.speed = 0.9;
  }
  // Ume walks slowly round the pole on the inner rings
  people.ume = spawn(PEOPLE.ume, { route: [0, 1, 2, 3, 4].map((i) => { const a = (i / 5) * Math.PI * 2 + 0.3; return onGround(Pz.x + Math.sin(a) * 6.5, Pz.z + Math.cos(a) * 6.5, Pz.ground + 5); }), speed: 0.45 });
  for (const [id, n] of Object.entries(people)) quests.locate(id, () => n.pos);

  // ---------------------------------------------------------------- the spheres that remember
  const ids = Object.keys(SOUNDS);
  const heard = (id) => !!game.flag(`spheres.heard.${id}`);
  const count = () => ids.filter(heard).length;
  const ringMat = (c) => ownMaterial({ color: c, glow: 0, flat: true });
  const motes = new Puffs(scene, { color: '#fff6dc', max: 80, glow: 1, detail: 0 });
  const L = ids.map((id) => {
    const o = G.listen[id];
    const centre = V(o.x, o.y, o.z);
    const rr = o.R + 3.5;
    const footY = Math.max(...[0, 1, 2, 3].map((k) => H(o.x + Math.sin(k * 1.57) * rr, o.z + Math.cos(k * 1.57) * rr))) + 0.12;
    const mat = ringMat('#fff3c4');
    const ring = new THREE.Mesh(new THREE.TorusGeometry(rr, 0.14, 4, 96).rotateX(Math.PI / 2), mat);
    ring.position.set(o.x, footY, o.z);
    ring.userData.noCollide = true;
    scene.add(ring);
    // three ripples that run out over the meadow when it remembers
    const pulses = [0, 1, 2].map(() => { const m = new THREE.Mesh(new THREE.TorusGeometry(rr, 0.2, 4, 96).rotateX(Math.PI / 2), ringMat('#fff6dc')); m.position.copy(ring.position); m.visible = false; m.userData.noCollide = true; scene.add(m); return m; });
    return { id, o, centre, ring, mat, pulses, voice: heard(id) ? 0.3 : 0, pulseT: -1, near: false, hinted: false, footY };
  });
  quests.locate('sphere', () => {
    let best = null, bd = Infinity;
    for (const s of L) { if (heard(s.id)) continue; const d = flat(s.centre, player.pos); if (d < bd) { bd = d; best = s; } }
    const s = best ?? L[0];
    return V(s.o.x, s.footY, s.o.z + s.o.R + 4);
  });
  const remember = (s) => {
    game.set(`spheres.heard.${s.id}`, true);
    s.pulseT = 0; s.voice = 1; s.voiceT = 14;
    toast(`The sphere remembers: ${SOUNDS[s.id].text}.`);
    if (s.id === 'drum') {
      game.set('clue.spheres.desert', true);
      if (game.flag('desert.teo.drumming') || game.flag('world.desert.done')) setTimeout(() => toast('Dum, tek-dum. You know this rhythm: the pilgrims walked to it, round the great tree in the desert.'), 3800);
    }
    if (count() >= 3) game.set('spheres.heard.three', true);
  };
  // every great sphere is a note: shoot one and it rings (bigger, lower); the three that remember play their sound
  const rememberer = (o) => L.find((s) => s.o === o);
  const orbHit = (o) => (mode, point) => {
    const at = V(o.x, o.y, o.z), s = rememberer(o), soft = mode === 'push';
    motes.burst(point ?? at, { n: soft ? 2 : 5, rise: 1.6, size: 0.25 + Math.min(o.R, 40) * 0.006, spread: 1, life: 2.2 });
    if (!s) {
      sound.orbNote?.(orbDegree(o.R), at, { size: Math.min(1, o.R / 46), soft });
      // the avenue's answering pair: the other one rings back across the road a moment later
      const pair = G.answering ?? [], other = pair.includes(o) ? pair.find((q) => q && q !== o) : null;
      if (other) setTimeout(() => { const oa = V(other.x, other.y, other.z); sound.orbNote?.(orbDegree(other.R), oa, { size: Math.min(1, other.R / 46), soft: true }); motes.burst(oa, { n: 3, rise: 1.6, size: 0.26, spread: 1, life: 2.2 }); }, 420);
      return true;
    }
    s.flash = 1;
    sound.remembered?.(SOUNDS[s.id].part, at, { vol: soft ? 0.6 : 1 });
    if (!heard(s.id)) remember(s);
    return true;
  };
  for (const o of G.orbs ?? []) {
    if (o.R > 100) continue;   // (the great sphere on the horizon is out of reach)
    const c = V(o.x, o.y, o.z);
    registerTarget({ kind: 'orb', radius: o.R, position: () => c, enabled: () => flat(player.pos, o) < o.R + 70, onHit: orbHit(o), orb: o });
  }

  // ---------------------------------------------------------------- the pole, its hum, and the chord
  const polePos = V(Pz.x, Pz.ground + 1, Pz.z + 2.2);
  quests.locate('plaza', () => V(Pz.x, Pz.ground, Pz.z + Pz.r - 4));
  quests.locate('pole', () => polePos);
  const crown = new THREE.Mesh(new THREE.SphereGeometry(1.05, 16, 10), ownMaterial({ color: '#fff3c4', glow: 0, flat: true }));
  crown.position.set(Pz.x, Pz.top, Pz.z);
  crown.visible = false; crown.userData.noCollide = true;
  scene.add(crown);
  const plazaPulses = [0, 1, 2, 3].map(() => { const m = new THREE.Mesh(new THREE.TorusGeometry(3, 0.32, 4, 96).rotateX(Math.PI / 2), ringMat('#fff6dc')); m.position.set(Pz.x, Pz.inner + 0.08, Pz.z); m.visible = false; m.userData.noCollide = true; scene.add(m); return m; });
  // the great sphere answers: a halo standing round it on the horizon
  const Gr = G.great;
  const halo = new THREE.Mesh(new THREE.TorusGeometry(Gr.R * 1.12, 2.4, 6, 120), ownMaterial({ color: '#fff3c4', glow: 0, flat: true }));
  halo.position.set(Gr.x, Gr.y, Gr.z);
  halo.visible = false; halo.userData.noCollide = true;
  scene.add(halo);
  const st = { pole: 0, poleHinted: false, chordT: game.flag('spheres.chord.heard') ? 99 : -1, walk: null, walkBest: 0, bellsDirty: true };
  const chord = () => {
    game.set('spheres.chord.heard', true);
    st.chordT = 0;
    const b = sound.band?.('pole');
    if (b) { b.parts = ['bell', 'chant', 'drum', ...(game.flag('spheres.pebble.placed') ? ['ney'] : [])]; b.vol = 1; b.radius = 140; }
    sound.setBandMode?.('pole', 'near');
    // first as one little tune, the bell carrying it over the voices and the drum; then the band holds the chord
    const len = sound.spheresSong?.(V(Pz.x, Pz.top, Pz.z), { ney: !!game.flag('spheres.pebble.placed') }) ?? 0;
    if (b && len) { b.vol = 0.15; setTimeout(() => { b.vol = 1; }, len * 1000); }
    for (const s of L) { s.voice = Math.max(s.voice, 0.6); s.voiceT = 20 + len; s.pulseT = 0; }
    // the first time it is filmed (the rings, the halo, his face), its toast after; else at once
    const said = () => toast('The pole sings them back: the bell, the voices and the drum, one tune, then all at once. On the horizon the great sphere answers.');
    if (!film.chord(said)) said();
  };
  // splash the pole: with the three sounds (and the plaza reached), the chord; before that, only its own hum
  const poleHit = (mode, point) => {
    motes.burst(point ?? V(Pz.x, Pz.top, Pz.z), { n: 4, rise: 1.4, size: 0.22, spread: 0.8, life: 2 });
    if (game.flag('spheres.chord.heard')) { sound.orbNote?.(0, V(Pz.x, Pz.top, Pz.z), { size: 0.3, soft: mode === 'push' }); return true; }
    if (game.flag('spheres.heard.three') && quests.reached(Q, 'pole')) { chord(); return true; }
    sound.orbNote?.(0, V(Pz.x, Pz.top, Pz.z), { size: 0.3, soft: true });
    if (!st.poleHinted) { st.poleHinted = true; toast(count() < 3 ? `The pole hums its one note back at you. It is waiting for more than that: ${count()} of the three sounds.` : 'The pole hums back. Come onto the plaza and give it a splash there.'); }
    return true;
  };
  for (const [dy, r] of [[2.5, 1.3], [6, 1.3], [10, 1.3], [14, 1.3], [Pz.top - Pz.ground, 1.6]]) {
    const c = V(Pz.x, Pz.ground + dy, Pz.z);
    registerTarget({ kind: 'pole', radius: r, position: () => c, enabled: () => flat(player.pos, pole) < 80, onHit: poleHit });
  }

  // ---------------------------------------------------------------- the lake's reflection: the glint, the pebble
  const Lk = G.lake;
  const glintAt = V(Lk.x + 14, Lk.level + 0.06, Lk.z + Lk.rz * 0.8);
  const shore = onGround(Lk.x + 10, Lk.z + Lk.rz * 1.13);
  quests.locate('glint', () => shore.clone().lerp(glintAt, 0.3).setY(Lk.level));
  quests.locate('pebble', () => shore);
  const glint = new THREE.Mesh(new THREE.OctahedronGeometry(0.5, 0).scale(1.4, 0.15, 1.4), ownMaterial({ color: '#ffffff', glow: 1, flat: true }));
  glint.position.copy(glintAt);
  glint.userData.noCollide = true;
  glint.visible = !game.flag('spheres.pebble.out');
  scene.add(glint);
  const sparkle = new Puffs(scene, { color: '#ffffff', max: 20, glow: 1, detail: 0 });
  const mirror = ownMaterial({ color: '#dff1f2', glow: 0.55, flat: true });
  const pebble = new THREE.Mesh(new THREE.SphereGeometry(0.32, 12, 8).scale(1, 0.55, 0.8), mirror);
  pebble.userData.noCollide = true;
  const pebbleOn = () => game.flag('spheres.pebble.out') && !game.flag('spheres.pebble.taken');
  pebble.position.copy(shore).add(V(0, 0.2, 0));
  pebble.visible = !!pebbleOn();
  scene.add(pebble);
  const placed = new THREE.Mesh(new THREE.CircleGeometry(0.75, 20).rotateX(-Math.PI / 2), mirror);
  placed.position.set(Pz.x, Pz.inner + 0.06, Pz.z + 1.05);
  placed.visible = !!game.flag('spheres.pebble.placed');
  placed.userData.noCollide = true;
  scene.add(placed);
  let jump = null;
  registerTarget({ kind: 'glint', radius: 2.5, position: () => glintAt, enabled: () => glint.visible && flat(player.pos, glintAt) < 90,
    onHit: (mode) => {
      if (mode !== 'shoot') { toast('Ripples run out over the still water. The glint slides away under them, and comes back.'); return true; }
      game.set('spheres.pebble.out', true);
      glint.visible = false;
      jump = { t: 0 };
      pebble.visible = true;
      toast('The water jumps where the fluid lands, and throws something bright up onto the shore.');
      sound.chime?.();
      return true;
    } });
  registerInteractable({ id: 'pebble', priority: PRIORITY.use, range: 2.6, prompt: 'pick up the mirrored pebble', at: () => pebble.position, enabled: () => pebble.visible && !jump,
    distance: (p) => (Math.abs(p.pos.y - shore.y) < 4 ? flat(p.pos, shore) : Infinity),
    use: () => {
      quests.give('pebble'); game.set('spheres.pebble.taken', true);
      if (!quests.isStarted('spheres.pebble')) quests.start('spheres.pebble', 'carry');
      pebble.visible = false;
      toast(`Picked up ${ITEMS.pebble}. In it, the sky behind you.`);
      sound.chime?.();
    } });
  registerInteractable({ id: 'placePebble', priority: PRIORITY.use, range: 4.5, prompt: 'set the pebble at the pole’s foot', at: () => polePos, enabled: () => quests.has('pebble'),
    distance: (p) => flat(p.pos, pole),
    use: () => {
      quests.take('pebble');
      placed.visible = true;
      dialogue.start(THINGS.pebble, null, polePos);
      const b = sound.band?.('pole');
      if (b && game.flag('spheres.chord.heard') && !b.parts.includes('ney')) b.parts.push('ney');
    } });

  // ---------------------------------------------------------------- the avenue: white bells that open for slow walkers
  const Av = G.avenue;
  const bells = [];
  for (let z = Av.z0 - 2; z >= Av.z1 + 2; z -= 3.1) for (const s of [-1, 1]) bells.push({ x: s * (4.1 + Math.sin(z * 0.7) * 0.25), z, y: H(s * 4.1, z), k: 0, open: false });
  const bellGeo = mergeGeometries([new THREE.CylinderGeometry(0.03, 0.04, 0.7, 4).translate(0, 0.35, 0).toNonIndexed(), new THREE.ConeGeometry(0.22, 0.32, 7, 1, true).rotateX(Math.PI).translate(0, 0.62, 0).toNonIndexed()]);
  const bellMesh = new THREE.InstancedMesh(bellGeo, makeMaterial({ color: '#fbf8f0', glow: 0.2, flat: true, side: THREE.DoubleSide }), bells.length);
  bellMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  bellMesh.userData.noCollide = true; bellMesh.userData.dynamic = true;
  scene.add(bellMesh);
  const dB = new THREE.Object3D();
  const placeBell = (i) => { const b = bells[i]; dB.position.set(b.x, b.y, b.z); dB.rotation.set(0.5 - 0.5 * b.k, b.x > 0 ? -1.2 : 1.2, 0); dB.scale.set(0.6 + 0.9 * b.k, 0.8 + 0.4 * b.k, 0.6 + 0.9 * b.k); dB.updateMatrix(); bellMesh.setMatrixAt(i, dB.matrix); };
  if (game.flag('spheres.avenue.walked')) for (const b of bells) { b.k = 1; b.open = true; }
  bells.forEach((_, i) => placeBell(i));
  quests.locate('avenue', () => V(0, H(0, Av.z0 - 4), Av.z0 - 4));
  const onAvenue = (p) => Math.abs(p.x) < 9 && p.z < Av.z0 + 6 && p.z > Av.z1 - 6;
  const breakWalk = (why) => {
    if (!st.walk) return;
    st.walk = null;
    for (const b of bells) b.open = false;
    if (quests.isActive('spheres.avenue') && !game.flag('spheres.avenue.walked')) toast(why === 'run' ? 'The bells along the avenue shut. Slowly: start again from the arch.' : 'The bells shut. Start again from the arch, and keep your feet on the road.');
  };

  // ---------------------------------------------------------------- the end of the main quest
  quests.def(Q).onDone = () => {
    game.set('world.spheres.done', true);
    setTimeout(() => story.complete?.(), 1200);
  };

  // ---------------------------------------------------------------- music: each sphere's sound, and the pole's hum
  sound.setBands?.([
    ...L.map((s) => ({ id: `sphere.${s.id}`, pos: () => (s.voice > 0.01 ? s.centre : null), radius: s.o.R + 70, parts: [SOUNDS[s.id].part], mode: 'play', vol: s.voice, duck: 0.6 })),
    { id: 'pole', pos: V(Pz.x, Pz.ground + 4, Pz.z), radius: game.flag('spheres.chord.heard') ? 140 : 60, parts: game.flag('spheres.chord.heard') ? ['bell', 'chant', 'drum', ...(game.flag('spheres.pebble.placed') ? ['ney'] : [])] : ['chant'], mode: game.flag('spheres.chord.heard') ? 'near' : 'play', vol: game.flag('spheres.chord.heard') ? 0.8 : 0.35, duck: 0.4 },
  ]);

  // ---------------------------------------------------------------- per frame
  const _m = V(0, 0, 0);
  const update = (dt, t, { camera } = {}) => {
    const pp = player.pos;
    const speed = Math.hypot(player.vel?.x ?? 0, player.vel?.z ?? 0);
    const grounded = player.onGround ?? true;

    // the spheres that remember: the ring round its foot flares when the fluid lands, and closes as it remembers
    // (standing still beside one does nothing: it wants the fluid, Linnet's "give one a splash")
    for (const s of L) {
      const d = flat(pp, s.centre), inRange = d < s.o.R + 30 && pp.y < s.centre.y + s.o.R + 3;
      if (inRange && !s.near && !heard(s.id) && !s.hinted && game.flag('spheres.aube.heard')) { s.hinted = true; toast('Give it a splash of your fluid, and listen.'); }
      s.near = inRange;
      s.flash = Math.max(0, (s.flash ?? 0) - dt * 0.8);
      // the ring: wide and dark until it has remembered, then closed round the foot, faintly lit, brightening near you
      const lit = Math.max(s.flash, heard(s.id) ? 0.35 + 0.4 * THREE.MathUtils.clamp(1 - d / (s.o.R + 40), 0, 1) : 0);
      s.mat.uniforms.uGlow.value = lit;
      s.ring.visible = lit > 0.02 && flat(camera?.position ?? pp, s.centre) < 600;
      s.ring.scale.setScalar(heard(s.id) ? 1 + 0.12 * s.flash : 1.6);
      // the ripples
      if (s.pulseT >= 0) {
        s.pulseT += dt;
        s.pulses.forEach((m, i) => { const u = (s.pulseT - i * 0.6) / 3.2; m.visible = u > 0 && u < 1; if (m.visible) { m.scale.setScalar(1 + u * 2.6); m.material.uniforms.uGlow.value = 1 - u; } });
        if (s.pulseT > 5) { s.pulseT = -1; s.pulses.forEach((m) => { m.visible = false; }); }
        if (s.pulseT > 0 && s.pulseT < 2.5 && Math.random() < dt * 25) { _m.set(s.o.x + (Math.random() - 0.5) * s.o.R, s.centre.y + s.o.R * 0.9, s.o.z + (Math.random() - 0.5) * s.o.R); motes.burst(_m, { n: 2, rise: 3, size: 0.3, spread: 1.2, life: 3 }); }
      }
      // its voice: loud when it has just remembered, then a quiet echo whenever you pass
      if (s.voiceT > 0) s.voiceT -= dt; else if (heard(s.id)) s.voice += (0.3 - s.voice) * Math.min(1, dt * 0.3);
      const b = sound.band?.(`sphere.${s.id}`);
      if (b) b.vol = s.voice;
    }

    // the pole: splashed with the three sounds, it sings them back (poleHit, above); its crown glows as you come near
    const dPole = flat(pp, pole);
    if (game.flag('spheres.heard.three') && !game.flag('spheres.chord.heard') && quests.reached(Q, 'pole')) {
      st.pole += ((dPole < 30 ? 0.35 + 0.15 * Math.sin(t * 2.2) : 0) - st.pole) * Math.min(1, dt * 2);
      crown.visible = st.pole > 0.02;
      crown.material.uniforms.uGlow.value = st.pole;
      if (st.pole > 0.05 && Math.random() < dt * 6 * st.pole) motes.burst(V(Pz.x, Pz.top + 0.6, Pz.z), { n: 1, rise: 1.5, size: 0.2, spread: 0.4, life: 2.5 });
    }
    if (st.chordT >= 0 && st.chordT < 12) {
      st.chordT += dt;
      crown.visible = true;
      crown.material.uniforms.uGlow.value = 0.6 + 0.4 * Math.sin(st.chordT * 3);
      plazaPulses.forEach((m, i) => { const u = ((st.chordT - i * 0.9) % 4) / 4; m.visible = st.chordT > i * 0.9 && st.chordT < 10; if (m.visible) { m.scale.setScalar(1 + u * 9); m.material.uniforms.uGlow.value = 1 - u; } });
      const hk = Math.sin(Math.PI * Math.min(1, st.chordT / 10));
      halo.visible = hk > 0.02;
      halo.material.uniforms.uGlow.value = hk;
      halo.scale.setScalar(0.96 + 0.08 * hk);
      if (st.chordT >= 12) { plazaPulses.forEach((m) => { m.visible = false; }); halo.visible = false; crown.material.uniforms.uGlow.value = 0.4; }
    }

    // the glint winks; the pebble, thrown up out of the water, lands on the shore
    if (glint.visible) { glint.material.uniforms.uGlow.value = 0.6 + 0.4 * Math.sin(t * 2.3); glint.rotation.y = t * 0.4; if (Math.random() < dt * 0.8) sparkle.burst(glintAt, { n: 2, rise: 0.4, size: 0.12, spread: 0.6, life: 0.9 }); }
    if (jump) {
      jump.t = Math.min(1, jump.t + dt / 1.1);
      pebble.position.lerpVectors(glintAt, shore.clone().add(V(0, 0.2, 0)), jump.t);
      pebble.position.y += Math.sin(Math.PI * jump.t) * 4;
      if (jump.t >= 1) { jump = null; sparkle.burst(shore.clone().add(V(0, 0.3, 0)), { n: 6, rise: 1, size: 0.15, spread: 1, life: 1.2 }); }
    } else if (pebble.visible) pebble.rotation.y = t;

    // the avenue walk
    if (quests.isActive('spheres.avenue') && !game.flag('spheres.avenue.walked')) {
      const at = onAvenue(pp);
      if (!st.walk && at && pp.z > Av.z0 - 12 && pp.z < Av.z0 + 6 && grounded) st.walk = { z: pp.z, run: 0 };
      if (st.walk) {
        if (!at) breakWalk('left');
        else {
          st.walk.run = speed > 5.2 ? st.walk.run + dt : Math.max(0, st.walk.run - dt);
          if (st.walk.run > 0.5) breakWalk('run');
          else if ((player.vel?.y ?? 0) > 3.5) breakWalk('jump');
          else if (pp.z < Av.z1 + 2) { game.set('spheres.avenue.walked', true); st.walk = null; for (const b of bells) b.open = true; toast('The last bells open behind you. The cypresses lean in to see who walked so slowly.'); sound.chime?.(); }
        }
      }
    }
    // the bells: open as a slow walker passes, shut again if the walk breaks
    const walking = !!st.walk || game.flag('spheres.avenue.walked');
    for (let i = 0; i < bells.length; i++) {
      const b = bells[i];
      if (walking && !b.open && Math.abs(b.z - pp.z) < 6 && Math.abs(b.x - pp.x) < 8) b.open = true;
      const target = b.open ? 1 : 0;
      if (b.k !== target) { b.k += Math.sign(target - b.k) * Math.min(Math.abs(target - b.k), dt * 1.6); placeBell(i); st.bellsDirty = true; }
    }
    if (st.bellsDirty) { bellMesh.instanceMatrix.needsUpdate = true; st.bellsDirty = false; }

    motes.update(dt);
    sparkle.update(dt);
  };

  return { people, update, state: st, listeners: L, shore, glintAt, pole, bells, film, chord };
}
