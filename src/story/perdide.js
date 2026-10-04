import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeMaterial } from '../materials.js';
import { registerTarget } from '../targets.js';
import { registerInteractable, PRIORITY } from '../interact.js';
import { GREAT, BED, ISLE, CAVE } from '../levels/perdide.js';
import { QUESTS, PEOPLE, THINGS, ITEMS, LINES } from './perdide-data.js';

// Perdide's story, alive (perdide-data.js has the words): "The Great Crystal".
//
//   the landing  Wendel by the eggs, Sedge by the reeds, Corm at the snapping bed
//   the crystal  Saba sits on her stone at its foot; the root stone carries the Hush
//   the cave     Ysse keeps it; the heart is a ring of crystals round an empty place
//   the isle     the fireflies' nest, in the channel by the cave island (Ivo watches them)
//
// The Great Crystal sings in the rain (a real shower, or three splashes of the
// fluid on its spires). While it sings every plant in the swamp shuts its
// mouth (level.silence), rings of light run out from the spires and the
// "singing light" phrase plays: three bright notes and a long arc.
//
// Flags (game-state.js): perdide.wendel.heard, perdide.saba.heard,
// perdide.crystal.sung (the quest song: the 213th phrase), perdide.clue.ship
// (the song is the light that struck the ship), perdide.splinter.taken,
// perdide.heart.rung (the cave answers; the tank takes a crystal-violet band:
// perdide.tank.tinted), perdide.patience.kept (the bed let you be: the plants
// stop snapping at you), perdide.fireflies.home, perdide.nest.seen,
// perdide.rumour.light, perdide.glyph.heard, perdide.hush.seen,
// clue.perdide.perdide2. Items: splinter, jar.

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const flat = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const Q = 'perdide.crystal';
const CRYSTAL_TONE = '#c7a6f2';
const PATIENCE = 20;        // s standing in the bed, feeding nothing
const SONG = 34;            // s the crystal sings after three splashes

/** The phrase of the singing light: three bright notes (the dots) and a long arc down and up again. */
export function singingLight(sound, vol = 0.1) {
  if (!sound?.ctx || !sound.instrument) return false;
  const t = sound.ctx.currentTime, f = (d, o) => sound.freq(d, o);
  [0, 0.34, 0.68].forEach((d, i) => sound.instrument('bell', f(i === 1 ? 9 : 7, 1), t + d, 1.4, vol));
  sound.sweep(t + 1.1, f(7, 1), f(0, 0), 1.3, vol * 0.45, 'sine');
  sound.sweep(t + 2.4, f(0, 0), f(7, 1), 1.5, vol * 0.45, 'sine');
  sound.instrument('chant', f(0, 0), t + 1.1, 2.6, vol * 0.5);
  return true;
}

export function setupPerdide(ctx) {
  const { level, physics, player, quests, dialogue, game, sound, story, spawn, scene, toast, npcs } = ctx;
  if (level.id !== 'perdide' || !level.crystal) return null;
  // the weather (main.js puts it on window once everything is built; tests have none)
  const sky = () => ctx.weather ?? globalThis.weather ?? null;
  for (const q of QUESTS) quests.define(q);
  quests.itemNames = { ...(quests.itemNames ?? {}), ...ITEMS };
  if (!quests.isStarted(Q) && !game.flag('world.perdide.done')) quests.start(Q);

  const C = level.crystal;
  // the walkable surface just above the swamp floor (not the cave's roof, nor a fungus cap)
  const ground = (x, z, up = 3) => { const h = level.ground.heightAt(x, z), g = physics.groundAt(x, h + up, z, up + 4); return Number.isFinite(g) ? g : h; };
  const at = (x, z) => V(x, ground(x, z), z);
  // toward the landing from the crystal, and across
  const toLanding = V(-GREAT.x, 0, -GREAT.z).normalize(), across = V(-toLanding.z, 0, toLanding.x);
  const foot = (d, s = 0) => at(GREAT.x + toLanding.x * d + across.x * s, GREAT.z + toLanding.z * d + across.z * s);

  // ---------------------------------------------------------------- the people
  const people = {};
  for (const n of npcs) if (n.def?.id && ['wendel', 'sedge', 'ivo'].includes(n.def.id)) people[n.def.id] = n;
  const sabaAt = foot(23, -2);
  people.saba = spawn(PEOPLE.saba, { route: [sabaAt.clone()], seat: 0.45, heading: Math.atan2(toLanding.x, toLanding.z) + Math.PI * 0.85 });
  const corm = V(BED.x + 8.5, 0, BED.z + 2.5);
  people.corm = spawn(PEOPLE.corm, { route: [at(corm.x, corm.z), at(corm.x + 1.5, corm.z + 3), at(corm.x - 1, corm.z + 4.5)], speed: 0.55 });
  const axis = V(Math.sin(CAVE.rot), 0, Math.cos(CAVE.rot)), side = V(axis.z, 0, -axis.x);
  const heart = at(CAVE.x, CAVE.z);
  people.ysse = spawn(PEOPLE.ysse, { route: [at(heart.x + side.x * 4.5 + axis.x * 2, heart.z + side.z * 4.5 + axis.z * 2), at(heart.x + side.x * 4 - axis.x * 5, heart.z + side.z * 4 - axis.z * 5)], speed: 0.45 });
  // people far off are drawn only within their own distance (Ysse only near her cave)
  const eye = V(0, 0, 0);
  const drawWithin = (n, d) => { if (!n) return; const show = n.show.bind(n); n.show = (on) => show(on && eye.distanceToSquared(n.pos) < d * d); };
  drawWithin(people.saba, 150); drawWithin(people.ysse, 90); drawWithin(people.ivo, 140);

  // Saba's stone, and the root stone with the Hush carved in it
  const stoneMat = makeMaterial({ color: '#a99bb0', flat: true }), inkMat = makeMaterial({ color: '#efe4ff', flat: true, glow: 0.7 });
  {
    const st = new THREE.Mesh(new THREE.IcosahedronGeometry(0.55, 0).scale(1.2, 0.8, 1), stoneMat);
    st.position.copy(sabaAt).add(V(0, 0.05, 0));
    st.userData.noCollide = true;
    scene.add(st);
  }
  const hushAt = foot(17.5, 2.5);
  {
    const g = new THREE.Group();
    g.position.copy(hushAt);
    g.rotation.y = Math.atan2(toLanding.x, toLanding.z);
    g.add(new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.5, 1.8).translate(0, 0.15, 0), stoneMat));
    // the glyph, three dots over an arc, set into the top
    const parts = [-0.55, 0, 0.55].map((x, i) => new THREE.CylinderGeometry(0.13, 0.13, 0.06, 10).translate(x, 0.42, -0.25 - (i === 1 ? 0.08 : 0)).toNonIndexed());
    parts.push(new THREE.TorusGeometry(0.75, 0.06, 4, 18, Math.PI).rotateX(-Math.PI / 2).translate(0, 0.42, 0.55).toNonIndexed());
    g.add(new THREE.Mesh(mergeGeometries(parts), inkMat));
    g.traverse((o) => { o.userData.noCollide = true; });
    scene.add(g);
  }

  // ---------------------------------------------------------------- things to look at
  const thing = (def, p, { range = 3, prompt, enabled = () => true, use, whileRiding = false } = {}) => registerInteractable({
    id: def.id, priority: PRIORITY.use, range, prompt: prompt ?? `look at ${def.name.replace(/^The /, 'the ')}`, whileRiding,
    at: () => p, enabled, distance: (pl) => (Math.abs(pl.pos.y - p.y) < 4 ? flat(pl.pos, p) : Infinity),
    use: use ?? (() => dialogue.start(def, null, p)),
  });
  thing(THINGS.hush, hushAt, { range: 3.2, prompt: 'look at the root stone' });
  const crystalLook = foot(13);
  thing(THINGS.crystal, crystalLook, { range: 4, prompt: 'look up at the crystal' });

  // ---------------------------------------------------------------- the song
  const st = { k: 0, until: -1, clock: 0, hits: [], phraseT: 0, near: false, tank: false, ringT: 0, quest: false };
  const raining = () => (sky()?.state?.rain ?? 0) > 0.35;
  const singing = () => st.clock < st.until;
  const sing = (dur, why) => {
    const was = singing();
    st.until = Math.max(st.until, st.clock + dur);
    if (!was) {
      st.phraseT = 0.6;
      if (flat(player.pos, GREAT) < 400) toast(why === 'rain' ? 'Rain on the Great Crystal. It sings, and every jaw in the swamp shuts.' : 'The crystal rings under your fluid like struck glass, and begins to sing. Every jaw in the swamp shuts.');
      for (const n of Object.values(people)) if (n.pos.distanceTo(player.pos) < 60) n.shout = { text: LINES.singing[Math.floor(Math.random() * LINES.singing.length)], until: n.time + 2.6 };
    }
  };
  // a shower to go with your rain, if the sky is between moods
  const callRain = () => {
    const weather = sky();
    if (!weather || weather.mode !== 'auto' || weather.target > 0.3) return;
    weather.kind = 'rain'; weather.target = 0.75; weather.timer = SONG + 10;
  };
  // the fluid splashes the spires (a few points up each one) or the heart of the cluster
  const ring = (mode) => {
    if (mode !== 'shoot') { if (!st.pushed) { st.pushed = true; toast('The push breaks on the crystal like a wave on a cliff. It hums a little lower, and doesn’t move.'); } return true; }
    st.hits = st.hits.filter((t) => st.clock - t < 14);
    st.hits.push(st.clock);
    st.flash = 1;
    sound.critter?.('chime', 0.8);
    if (st.hits.length >= 3 && !singing()) { st.hits = []; sing(SONG, 'fluid'); callRain(); }
    else if (!singing() && st.hits.length === 1 && !st.hinted) { st.hinted = true; toast('The spire rings, and the ring fades. Again, close together…'); }
    return true;
  };
  const near = () => flat(player.pos, GREAT) < 160;
  registerTarget({ kind: 'crystal', radius: 12, position: () => C.center, enabled: near, onHit: ring });
  for (const s of C.spires ?? []) registerTarget({ kind: 'crystal', radius: s.r, position: () => s.pos, enabled: near, onHit: ring });

  // rings of light running out from the spires while it sings
  const ringMat = makeMaterial({ color: '#efe4ff', glow: 1, flat: true, side: THREE.DoubleSide });
  const rings = [0, 1, 2].map((i) => {
    const m = new THREE.Mesh(new THREE.TorusGeometry(1, 0.01, 3, 96).rotateX(Math.PI / 2), ringMat);   // a flat ribbon, scaled out
    m.userData.noCollide = true; m.visible = false; m.position.copy(C.pos).add(V(0, 4 + i * 9, 0));
    scene.add(m);
    return m;
  });
  const baseColor = new THREE.Color(CRYSTAL_TONE), songColor = new THREE.Color('#f4eeff');

  // ---------------------------------------------------------------- the splinter
  let splinter = null;
  const splinterAt = foot(15.5, -2.2);
  const dropSplinter = () => {
    if (splinter || game.flag('perdide.splinter.taken')) return;
    const g = new THREE.Mesh(new THREE.CylinderGeometry(0, 0.22, 1.1, 5).translate(0, 0.55, 0), makeMaterial({ color: '#e9dcff', flat: true, glow: 1 }));
    g.position.copy(splinterAt).add(V(0, 0.05, 0));
    g.rotation.set(0.9, 0.4, 0.3);
    g.userData.noCollide = true;
    scene.add(g);
    const light = V(0, 0, 0);
    const L = new THREE.Vector4(splinterAt.x, splinterAt.y + 0.8, splinterAt.z, 6);
    level.lights.push(L);
    splinter = { g, L, off: null, light };
    splinter.off = registerInteractable({ id: 'splinter', priority: PRIORITY.use, range: 2.6, prompt: 'pick up the splinter', at: () => splinterAt, distance: (p) => flat(p.pos, splinterAt),
      use: () => {
        quests.give('splinter');
        game.set('perdide.splinter.taken', true);
        toast(`Picked up ${ITEMS.splinter}. It hums against your palm.`);
        sound.chime();
        g.removeFromParent();
        const k = level.lights.indexOf(L); if (k >= 0) level.lights.splice(k, 1);
        splinter.off(); splinter = null;
      } });
  };
  if (game.flag('perdide.crystal.sung') && !game.flag('perdide.splinter.taken')) dropSplinter();

  // ---------------------------------------------------------------- the cave's heart
  const heartMat = makeMaterial({ color: '#5a6f7a', flat: true, glow: 0.15, heartRing: true });
  {
    const parts = [];
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2, h = 1.6 + (i % 3) * 0.7;
      parts.push(new THREE.CylinderGeometry(0, 0.28, h, 5).translate(0, h / 2, 0).rotateZ(Math.cos(a) * 0.25).rotateX(-Math.sin(a) * 0.25).translate(Math.cos(a) * 2.3, -0.1, Math.sin(a) * 2.3).toNonIndexed());
    }
    const m = new THREE.Mesh(mergeGeometries(parts), heartMat);
    m.position.copy(heart);
    m.userData.noCollide = true;
    scene.add(m);
  }
  const heartLight = new THREE.Vector4(heart.x, heart.y + 1.5, heart.z, 0);
  level.lights.push(heartLight);
  thing(THINGS.heart, heart, { range: 3.4, prompt: () => (quests.has('splinter') && !game.flag('perdide.heart.rung') ? 'hold up the splinter' : 'look at the ring of crystals') });
  const caveSong = { k: game.flag('perdide.heart.rung') ? 0.35 : 0, t: 0 };
  const ringHeart = () => {
    caveSong.t = 14;
    singingLight(sound, 0.12);
    if (!game.flag('perdide.tank.tinted')) {
      game.set('perdide.tank.tinted', true);
      // the tank takes the crystal's colour for good (fluid-tool.js listens)
      game.emit('tool:refill', { addColour: true, tone: CRYSTAL_TONE });
    }
  };
  game.on('flag:perdide.heart.rung', (v) => { if (v) ringHeart(); });
  quests.def(Q).onDone = () => {
    game.set('world.perdide.done', true);
    game.addKeepsake({ id: 'perdide.thing', level: 'perdide', name: 'A singing splinter', kind: 'thing', text: 'A splinter of the Great Crystal that harmonises with your tank. It sings the phrase of the light that struck your ship.' });
    toast('The splinter sings with your tank. Something of value? It fell from the same sky as whatever struck you.');
    setTimeout(() => story.complete?.(), 1200);
  };

  // ---------------------------------------------------------------- feed nothing
  const pat = { t: 0, fed: 0, in: false };
  const bedPlants = (level.plants ?? []).filter((p) => p.bed);
  const fedCount = () => bedPlants.reduce((s, p) => s + p.fed, 0);
  if (game.flag('perdide.patience.kept')) level.tame = true;
  const updatePatience = (dt) => {
    if (quests.stage('perdide.patience') !== 'wait') return;
    const inBed = flat(player.pos, BED) < BED.r + 1.6 && !player.riding && Math.abs(player.pos.y - ground(BED.x, BED.z)) < 3;
    const fed = fedCount();
    if (fed > pat.fed) {
      pat.fed = fed;
      if (pat.t > 0.5 || inBed) toast('A jaw gulps your fluid and snaps for more. They think you’re a feeder now. Start again: feed them nothing.');
      pat.t = 0; level.calm = false;
      if (people.corm) people.corm.shout = { text: 'Ha! See? They love it!', until: people.corm.time + 2.5 };
      return;
    }
    if (!inBed) {
      if (pat.in && pat.t > 3) toast('You stepped out of the bed. The plants forget you.');
      pat.in = false; pat.t = 0; level.calm = false;
      return;
    }
    if (!pat.in) { pat.in = true; toast('The jaws snap at the air around you. Stand still. Feed them nothing.'); }
    pat.t += dt;
    if (pat.t > PATIENCE * 0.55 && !level.calm) { level.calm = true; toast('One by one, the jaws slow down…'); }
    if (pat.t >= PATIENCE) {
      game.set('perdide.patience.kept', true);
      level.tame = true;
      toast('The jaws open wide and lazy, like old dogs in the sun. They know you now: no plant in the swamp will snap at you again.');
      sound.chime();
    }
  };

  // ---------------------------------------------------------------- the fireflies
  const N_FLY = 36, flyMat = makeMaterial({ color: '#f2e38f', glow: 1, flat: true });
  const flies = new THREE.InstancedMesh(new THREE.OctahedronGeometry(0.055, 0), flyMat, N_FLY);
  flies.userData.noCollide = true;
  flies.frustumCulled = false;
  scene.add(flies);
  const fly = Array.from({ length: N_FLY }, (_, i) => ({ ph: i * 2.39996, r: 0.4 + ((i * 7) % 11) / 11 * 1.5, s: 0.6 + ((i * 5) % 7) / 7, y: ((i * 3) % 5) / 5 }));
  const ivoHome = people.ivo ? people.ivo.route[0].clone() : V(-112, 1.6, 108);
  const air = (x, z, lift = 2.2) => V(x, Math.max(level.ground.heightAt(x, z), 0) + lift, z);
  const route = [air(ivoHome.x + 4, ivoHome.z + 2), air(-98, 113), air(-86, 117), air(-74, 118), air(-63, 115), air(level.nest.x, level.nest.z, 1.6)];
  const swarm = { c: route[0].clone(), i: 0, spread: 1, home: !!game.flag('perdide.fireflies.home'), hatch: 0 };
  if (swarm.home) swarm.c.copy(route[route.length - 1]);
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = V(1, 1, 1), _p = V(0, 0, 0);
  const updateFlies = (dt, t, camPos) => {
    const stage = quests.stage('perdide.fireflies');
    const followers = quests.isDone('perdide.fireflies');
    // where the swarm is: over Ivo's reeds, on its way, at the nest; afterwards a few of them stay by you
    if (stage === 'follow' && !swarm.home) {
      const next = route[Math.min(swarm.i + 1, route.length - 1)];
      const d = flat(player.pos, swarm.c);
      if (d < 18 && swarm.i < route.length - 1) {
        const to = _p.subVectors(next, swarm.c), L = to.length();
        if (L < 0.5) swarm.i++;
        else swarm.c.addScaledVector(to, Math.min(1, (d < 10 ? 4.2 : 2.6) * dt / L));
      }
      if (swarm.i >= route.length - 1 && flat(player.pos, swarm.c) < 11) {
        swarm.home = true;
        game.set('perdide.fireflies.home', true);
        swarm.hatch = 1;
        if (!dialogue.open) dialogue.start(THINGS.nest, null, swarm.c);
      }
    } else if (!swarm.home && !followers) {
      swarm.c.lerp(route[0], 1 - Math.exp(-dt));
    }
    swarm.hatch = Math.max(0, swarm.hatch - dt * 0.12);
    const C0 = swarm.c;
    const show = camPos.distanceToSquared(C0) < 260 * 260 || followers;
    flies.visible = show;
    if (!show) return;
    for (let i = 0; i < N_FLY; i++) {
      const f = fly[i];
      let cx = C0.x, cy = C0.y, cz = C0.z, r = f.r * (1 + swarm.hatch * 2.5);
      if (followers && i < 10) {   // a handful keep you company
        cx = player.pos.x; cy = player.pos.y + 1.6; cz = player.pos.z; r = 0.9 + f.r * 0.6;
      } else if (followers || swarm.home) { cx = route[route.length - 1].x; cy = route[route.length - 1].y; cz = route[route.length - 1].z; }
      const a = t * 0.8 * f.s + f.ph;
      _p.set(cx + Math.cos(a) * r, cy + Math.sin(t * 1.7 * f.s + f.ph) * 0.6 + f.y, cz + Math.sin(a * 1.3) * r);
      const blink = 0.55 + 0.45 * Math.max(0, Math.sin(t * 3.1 * f.s + f.ph * 3));
      _m.compose(_p, _q, _s.setScalar(blink));
      flies.setMatrixAt(i, _m);
    }
    flies.instanceMatrix.needsUpdate = true;
  };

  // ---------------------------------------------------------------- places for the quest markers
  quests.locate('crystal', () => C.pos);
  quests.locate('crystalFoot', () => C.pos);
  quests.locate('splinter', () => splinterAt);
  quests.locate('heart', () => heart);
  quests.locate('bed', () => at(BED.x, BED.z));
  quests.locate('fireflies', () => swarm.c);
  quests.locate('nest', () => level.nest);
  for (const [id, n] of Object.entries(people)) quests.locate(id, () => n.pos);

  // ---------------------------------------------------------------- music: the hum, and the song
  sound.setBands?.([
    { id: 'hum', pos: C.center, radius: 140, parts: ['chant'], mode: 'play', vol: 0.45, duck: 0.2 },
    { id: 'song', pos: () => (st.k > 0.05 ? C.center : null), radius: 340, parts: ['bell', 'chant'], mode: 'feast', vol: 0.9, duck: 0.5 },
  ]);

  // ---------------------------------------------------------------- per frame
  const camPos = V(0, 0, 0);
  const update = (dt, t, { camera }) => {
    st.clock += dt;
    camPos.copy(camera?.position ?? player.pos);
    eye.copy(camPos);
    const dC = flat(player.pos, GREAT);
    // the tank hums back the first time you come close
    if (dC < 70 && !st.near) { st.near = true; if (!game.flag('perdide.crystal.met')) { game.set('perdide.crystal.met', true); toast('The hum gets into your teeth. Your tank hums back.'); } }
    else if (dC > 120) st.near = false;
    // rain: a real shower makes it sing while you are anywhere near
    if (raining() && dC < 400) sing(3, 'rain');
    // the quest's song: once Saba has asked for rain, the first song she hears is a new phrase
    if (singing() && st.k > 0.85 && quests.stage(Q) === 'sing' && dC < 140 && !game.flag('perdide.crystal.sung')) {
      game.set('perdide.crystal.sung', true);
      dropSplinter();
      toast('Under the song, a phrase you have heard before: three bright notes and a long arc. A splinter breaks from a spire and falls at its foot.');
    }
    // the song's swell: plants shut, the spires brighten, rings run out across the swamp
    const target = singing() ? 1 : 0;
    st.k += (target - st.k) * (1 - Math.exp(-(target ? 0.7 : 0.35) * dt));
    st.flash = Math.max(0, (st.flash ?? 0) - dt * 1.5);
    level.silence = st.k;
    const pulse = 0.5 + 0.5 * Math.sin(st.clock * 5.2);
    C.mat.uniforms.uColor.value.copy(baseColor).lerp(songColor, Math.min(0.6, st.k * (0.2 + 0.35 * pulse) + st.flash * 0.4));
    C.mat.uniforms.uGlow.value = 0.8 + 0.2 * Math.min(1, st.k + st.flash);
    C.light.w = 60 + 110 * st.k + 30 * st.flash;
    const ringsOn = st.k > 0.04 && camPos.distanceToSquared(C.center) < 700 * 700;
    for (let i = 0; i < rings.length; i++) {
      const R = rings[i];
      R.visible = ringsOn;
      if (!ringsOn) continue;
      const u = ((st.clock * 0.28 + i / rings.length) % 1);
      R.scale.set(12 + u * 90, 1 + u * 2, 12 + u * 90);
      R.position.y = C.pos.y + 9 + i * 11 + u * 5;
    }
    if (singing() && (st.phraseT -= dt) <= 0) { st.phraseT = 7.5; singingLight(sound, 0.07 + 0.08 * Math.max(0, 1 - dC / 300)); }
    // the cave answers the splinter
    if (caveSong.t > 0) caveSong.t -= dt;
    caveSong.k += ((caveSong.t > 0 ? 1 : game.flag('perdide.heart.rung') ? 0.35 : 0) - caveSong.k) * (1 - Math.exp(-1.5 * dt));
    if (level.caveMat && flat(camPos, CAVE) < 200) {
      const cp = 0.5 + 0.5 * Math.sin(st.clock * 4);
      level.caveMat.uniforms.uColor.value.set('#7fe0d0').lerp(songColor, caveSong.k * (caveSong.t > 0 ? 0.3 + 0.5 * cp : 0.15));
      heartMat.uniforms.uColor.value.set('#5a6f7a').lerp(baseColor, Math.min(1, caveSong.k * 1.8));
      heartMat.uniforms.uGlow.value = 0.15 + 0.85 * Math.min(1, caveSong.k * 2);
      heartLight.w = 18 * Math.min(1, caveSong.k * 2) * (0.85 + 0.15 * cp);
    }
    updatePatience(dt);
    updateFlies(dt, t, camPos);
  };

  return { people, update, state: st, sing, swarm, patience: pat, places: { heart, splinterAt, hushAt, sabaAt, route } };
}
