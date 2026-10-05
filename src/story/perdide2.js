import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeMaterial } from '../materials.js';
import { registerTarget } from '../targets.js';
import { registerInteractable, PRIORITY } from '../interact.js';
import { DARK_POOLS, DOMES, SAUCER, FEN, HOLLIN_END, CAVE } from '../levels/perdide2.js';
import { magicMaterial, magicPool, setMagic } from './magic-water.js';
import { QUESTS, PEOPLE, THINGS, ITEMS, LINES } from './perdide2-data.js';

// Lorn II's story, alive (perdide2-data.js has the words): "The Lamps Are Kept".
//
//   the island   Hollin, the old lamp-keeper, waits where the path begins
//   the path     three pools gone dark (shoot them alight; they take your colours);
//                Pim by the moss domes, Wick at the second dark pool
//   the water    the saucer in the deep pool (Odile and Talo's lifeboat), and old
//                Fen in the far dome on its mud islet (the skiff is his)
//   the cave     Bram minds the mouth; Hollin walks down to wait there at the end
//
// The world notices you: once Hollin knows you're here, the lamp-keepers
// brighten the pools ahead of you as you walk the path (Wick, once you've lit
// hers, runs ahead and brightens them further); the saucer blinks back at the
// third relit pool; at the end every pool on the path is lit for you.
//
// Flags (game-state.js): perdide2.hollin.met, perdide2.pool.<0-2>,
// perdide2.pools.lit (how many), perdide2.saucer.answered, perdide2.saucer.seen,
// perdide2.hollin.told, perdide2.promise ('yes' | 'maybe'), perdide2.fen.told,
// perdide2.rumour.light, perdide2.glyph.heard, clue.perdide2.edena.
// Items: latch, lamp.

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const flat = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const Q = 'perdide2.lamps';
const WARM = new THREE.Color('#fff1dc');

export function setupPerdide2(ctx) {
  const { level, physics, player, quests, dialogue, game, sound, story, spawn, scene, toast, npcs } = ctx;
  if (level.id !== 'perdide2' || !level.saucer) return null;
  for (const q of QUESTS) quests.define(q);
  quests.itemNames = { ...(quests.itemNames ?? {}), ...ITEMS };
  if (!quests.isStarted(Q) && !game.flag('world.perdide2.done')) quests.start(Q);

  const ground = (x, z, up = 3) => { const h = level.ground.heightAt(x, z), g = physics.groundAt(x, h + up, z, up + 4); return Number.isFinite(g) ? g : h; };
  const at = (x, z) => V(x, ground(x, z), z);

  // ---------------------------------------------------------------- the people
  const people = {};
  for (const n of npcs) { const key = n.def?.id?.split('.')[0]; if (['hollin', 'pim', 'bram'].includes(key)) people[key] = n; }   // (ids: 'hollin.perdide2', 'pim.perdide2': other worlds have a Hollin and a Pim)
  const wickAt = at(DARK_POOLS[1].x - 1.6, DARK_POOLS[1].z + 4.2);
  people.wick = spawn(PEOPLE.wick, { route: [wickAt.clone(), at(wickAt.x + 1.4, wickAt.z + 1.6)], speed: 0.6 });
  const fenDoor = level.domeDoors[FEN.dome];
  // on his landing stage, a raft moored at the door (src/levels/perdide2.js)
  const L0 = level.fenLanding ?? fenDoor.pos.clone().addScaledVector(fenDoor.out, 3.4);
  const fenAt = at(L0.x + fenDoor.out.x * 0.8, L0.z + fenDoor.out.z * 0.8);
  people.fen = spawn(PEOPLE.fen, { route: [fenAt.clone(), at(L0.x - fenDoor.out.z * 1.6, L0.z + fenDoor.out.x * 1.6)], speed: 0.4 });
  // people far off are drawn only within their own distance (the wood is dense)
  const eye = V(0, 0, 0);
  const drawWithin = (n, d) => { if (!n) return; const show = n.show.bind(n); n.show = (on) => show(on && eye.distanceToSquared(n.pos) < d * d); };
  for (const n of Object.values(people)) drawWithin(n, 150);
  const hollinEnd = at(HOLLIN_END.x, HOLLIN_END.z);
  const moveHollin = () => {
    const h = people.hollin;
    if (!h || h.atCave) return;
    h.atCave = true;
    h.route = [hollinEnd.clone(), at(hollinEnd.x + 1.5, hollinEnd.z - 1)]; h.wp = 0;
    h.pos.copy(hollinEnd);
    h.lines = ['~happy~ Look at them. Every pool, lit.', '~tired~ I walked all the way down. My knees will tell me about it tomorrow.'];
  };
  if (quests.reached(Q, 'tell') || quests.isDone(Q)) moveHollin();

  // ---------------------------------------------------------------- the dark pools
  const darkMat = makeMaterial({ color: '#2a3248', flat: true });
  const stoneMat = makeMaterial({ color: '#3a4560', flat: true });
  const lit = () => game.flag('perdide2.pools.lit') ?? 0;
  const pools = DARK_POOLS.map((D, i) => {
    const y = Math.max(ground(D.x, D.z), 0) + 0.06;
    const c = V(D.x, y, D.z);
    const dark = new THREE.Mesh(new THREE.CircleGeometry(D.r, 24).rotateX(-Math.PI / 2), darkMat);
    dark.position.copy(c); dark.userData.noCollide = true;
    const mat = magicMaterial(31 + i);
    const live = magicPool(D.r, mat);
    live.position.copy(c).add(V(0, 0.01, 0)); live.visible = false;
    // a ring of eggs round it, grey while it's dark
    const eggMat = makeMaterial({ color: '#8a8ea0', glow: 0.05, darkPoolEggs: i });
    const eggs = [];
    for (let k = 0; k < 7; k++) {
      const a = k * 0.9 + i, d = D.r + 0.5 + (k % 2) * 0.4, s = 0.32 + ((k * 3) % 4) * 0.08;
      const ex = D.x + Math.cos(a) * d, ez = D.z + Math.sin(a) * d;
      if (k === 6) continue;
      eggs.push(new THREE.SphereGeometry(1, 10, 7).scale(s, s * 1.35, s).translate(ex, Math.max(ground(ex, ez), -0.3) + s * 0.8, ez).toNonIndexed());
    }
    const eggMesh = new THREE.Mesh(mergeGeometries(eggs), eggMat);
    eggMesh.userData.noCollide = true;
    // the Welcome painted on a stone beside it: three lamps over a hull
    const a6 = 6 * 0.9 + i, sx = D.x + Math.cos(a6) * (D.r + 1.1), sz = D.z + Math.sin(a6) * (D.r + 1.1);
    const inkMat = makeMaterial({ color: '#4a4f63', flat: true, glow: 0.1, welcome: i });
    const stone = new THREE.Group();
    stone.position.set(sx, ground(sx, sz), sz);
    stone.rotation.y = Math.atan2(D.x - sx, D.z - sz);
    stone.add(new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.0, 0.35).translate(0, 0.4, 0), stoneMat));
    const ink = [-0.3, 0, 0.3].map((x, k) => new THREE.SphereGeometry(0.08, 6, 4).translate(x, 0.72 + (k === 1 ? 0.05 : 0), 0.19).toNonIndexed());
    ink.push(new THREE.TorusGeometry(0.36, 0.035, 3, 14, Math.PI).rotateZ(Math.PI).translate(0, 0.62, 0.19).toNonIndexed());
    stone.add(new THREE.Mesh(mergeGeometries(ink), inkMat));
    stone.traverse((o) => { o.userData.noCollide = true; });
    const props = new THREE.Group();   // drawn only within 110 m
    props.add(dark, live, eggMesh, stone);
    scene.add(props);
    const light = new THREE.Vector4(c.x, c.y + 1, c.z, 0);
    level.lights.push(light);
    const P = { i, c, D, props, dark, live, mat, eggMat, inkMat, light, k: 0, flare: 0, on: !!game.flag(`perdide2.pool.${i}`) };
    if (P.on) { P.k = 1; dark.visible = false; live.visible = true; }
    return P;
  });
  const light = (P) => {
    if (P.on) return false;
    P.on = true; P.flare = 1;
    P.dark.visible = false; P.live.visible = true;
    game.set(`perdide2.pool.${P.i}`, true);
    const n = lit() + 1;
    game.set('perdide2.pools.lit', n);
    sound.chime();
    toast(n < 3 ? `The pool drinks your fluid and lights up in your colours. ${n} of 3.` : 'The third pool lights up. And across the water, something blinks back: three short, one long.');
    for (const p of Object.values(people)) if (p.pos.distanceTo(P.c) < 40) p.shout = { text: LINES.lit[Math.floor(Math.random() * LINES.lit.length)], until: p.time + 2.5 };
    if (n >= 3) game.set('perdide2.saucer.answered', true);
    return true;
  };
  for (const P of pools) {
    registerTarget({ kind: 'pool', radius: 2.9, accepts: ['fire'], position: () => P.c, enabled: () => !P.on && flat(player.pos, P.c) < 120,
      onHit: (mode) => {
        if (mode === 'shoot' || mode === 'fire') return light(P);   // the lamp pools take an ember glob too
        if (!P.pushed) { P.pushed = true; toast('The push ripples the dark water, and it settles. It wants your fluid itself: shoot it.'); }
        return true;
      } });
    registerInteractable({ id: `darkPool${P.i}`, priority: PRIORITY.use, range: 3.6, prompt: 'look at the dark pool', at: () => P.c, enabled: () => !P.on,
      distance: (p) => (Math.abs(p.pos.y - P.c.y) < 3 ? flat(p.pos, P.c) : Infinity), use: () => dialogue.start(THINGS.pool, null, P.c) });
  }
  const nearestDark = () => {
    let best = null, bd = Infinity;
    for (const P of pools) if (!P.on) { const d = flat(player.pos, P.c); if (d < bd) { bd = d; best = P; } }
    return best?.c ?? null;
  };

  // ---------------------------------------------------------------- the saucer
  const S = level.saucer;
  const saucerAt = V(SAUCER.x, Math.max(ground(SAUCER.x, SAUCER.z), 0), SAUCER.z);
  {
    // the glyph scorched across its flank, three dots over an arc, black on the teal
    const scorch = makeMaterial({ color: '#1d2a3a', flat: true });
    const r = SAUCER.r, onHull = (x, z, lift = 0.02) => V(x, 0.34 * Math.sqrt(Math.max(0, r * r - x * x - z * z)) + lift, z);
    // on the flank away from the canopy: the dots toward the crown, the arch below them toward the rim
    const parts = [-1.6, 0, 1.6].map((z, k) => new THREE.SphereGeometry(0.4, 8, 5).scale(1, 0.4, 1).translate(...onHull(k === 1 ? -3.0 : -3.35, z).toArray()).toNonIndexed());
    const arc = new THREE.CatmullRomCurve3([-2.7, -1.35, 0, 1.35, 2.7].map((z) => onHull(-5.5 + 1.0 * (1 - (z / 2.7) ** 2), z, 0.05)));
    parts.push(new THREE.TubeGeometry(arc, 16, 0.17, 4).toNonIndexed());
    const m = new THREE.Mesh(mergeGeometries(parts.map((g) => { g.deleteAttribute('uv'); return g; })), scorch);
    m.userData.noCollide = true;
    S.group.add(m);
  }
  // a thin beam over it while it answers, so you can see it from the path
  const beamMat = makeMaterial({ color: '#f2a07a', glow: 1, side: THREE.DoubleSide, saucerBeam: true });
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 40, 6, 1, true).translate(0, 20, 0), beamMat);
  beam.position.copy(saucerAt); beam.userData.noCollide = true; beam.visible = false;
  scene.add(beam);
  registerInteractable({ id: 'saucer', priority: PRIORITY.use, range: 11, whileRiding: true, prompt: 'look into the saucer', at: () => saucerAt.clone().add(V(0, 3, 0)),
    distance: (p) => flat(p.pos, saucerAt), use: () => dialogue.start(THINGS.saucer, null, saucerAt) });

  // ---------------------------------------------------------------- Pim's latch on the glass dome
  const glass = DOMES[3];
  const latchAt = V(glass.x, 0, glass.z);
  latchAt.y = physics.groundAt(glass.x, 40, glass.z, 60);
  if (!Number.isFinite(latchAt.y)) latchAt.y = level.domeDoors[3].top;
  let latch = null;
  if (!quests.isDone('perdide2.latch') && !quests.has('latch')) {
    const g = new THREE.Group();
    const shell = makeMaterial({ color: '#f3ead8', flat: true }), hook = makeMaterial({ color: '#3a8f8a', flat: true });
    g.add(new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.07, 6, 16).rotateX(Math.PI / 2), shell));
    g.add(new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.04, 4, 10, Math.PI).translate(0.32, 0.05, 0), hook));
    g.position.copy(latchAt).add(V(0, 0.1, 0));
    g.traverse((o) => { o.userData.noCollide = true; });
    scene.add(g);
    const L = new THREE.Vector4(latchAt.x, latchAt.y + 1, latchAt.z, 5);
    level.lights.push(L);
    latch = { g, L };
    latch.off = registerInteractable({ id: 'latch', priority: PRIORITY.use, range: 2.4, prompt: 'pick up the latch', at: () => latchAt,
      distance: (p) => (Math.abs(p.pos.y - latchAt.y) < 2.5 ? flat(p.pos, latchAt) : Infinity),
      use: () => {
        quests.give('latch');
        toast(`Picked up ${ITEMS.latch}`);
        if (!quests.isStarted('perdide2.latch')) quests.start('perdide2.latch', 'return'); else quests.advance('perdide2.latch', 'find');
        g.removeFromParent(); latch.off();
        const k = level.lights.indexOf(L); if (k >= 0) level.lights.splice(k, 1);
        latch = null; sound.chime();
      } });
  }
  // Pim's door glows warm once it shuts again
  const pimDoor = level.domeDoors[0];
  const warmDoor = () => {
    if (pimDoor.warm) return;
    pimDoor.warm = true;
    pimDoor.door.material = makeMaterial({ color: '#ffd6a0', glow: 1, pimDoor: true });
    level.lights.push(new THREE.Vector4(pimDoor.pos.x + pimDoor.out.x * 2, pimDoor.pos.y, pimDoor.pos.z + pimDoor.out.z * 2, 11));
  };
  if (quests.isDone('perdide2.latch')) warmDoor();
  quests.def('perdide2.latch').onDone = () => warmDoor();

  // ---------------------------------------------------------------- the end
  quests.def(Q).onDone = () => {
    game.set('world.perdide2.done', true);
    game.addKeepsake({ id: 'perdide2.person', level: 'perdide2', name: 'Hollin’s lamps', kind: 'person',
      text: game.flag('perdide2.promise') === 'yes' ? 'A promise to Hollin, keeper of the lamps: you will come back to the deep wood one day, so that once the lamps were lit for someone who came.'
        : 'Hollin, keeper of the lamps, asked you to come back one day. You didn’t promise. The pools will be lit either way.' });
    toast('Every pool on the path is lit for you. Something of value? Someone, waiting for you to come back.');
    setTimeout(() => story.complete?.(), 1200);
  };

  // ---------------------------------------------------------------- places for the quest markers
  quests.locate('darkPool', nearestDark);
  quests.locate('saucer', () => saucerAt);
  quests.locate('latch', () => latchAt);
  quests.locate('cave', () => V(CAVE.x, CAVE.y, CAVE.mouth));
  for (const [id, n] of Object.entries(people)) quests.locate(id, () => n.pos);
  // the label counts the pools
  const poolStage = quests.def(Q).stages.find((s) => s.id === 'pools');
  const setPoolLabel = () => { poolStage.label = `A dark pool (${lit()} of 3 lit)`; };
  setPoolLabel();
  game.on('flag:perdide2.pools.lit', setPoolLabel);

  // ---------------------------------------------------------------- the lamp-keepers light the way
  const wave = { t: 0, all: quests.isDone(Q) ? 1 : 0 };
  const PL = level.poolList ?? [], PM = level.poolMesh, col = new THREE.Color();
  const updateWave = (dt) => {
    if (!PM || !PL.length) return;
    if ((wave.t -= dt) > 0) return;
    const step = 0.1 - wave.t; wave.t = 0.1;
    const met = !!game.flag('perdide2.hollin.met'), wick = !!game.flag('perdide2.pool.1');
    if (quests.isDone(Q) || game.flag('perdide2.hollin.told')) wave.all = Math.min(1, wave.all + step / 4);
    const reach = wick ? 42 : 26, p = player.pos;
    let dirty = false;
    for (let i = 0; i < PL.length; i++) {
      const e = PL[i];
      const d = flat(p, e.pos);
      const want = Math.max(wave.all, met && d < reach ? THREE.MathUtils.smoothstep(reach, reach * 0.4, d) : 0);
      if (Math.abs(want - e.k) < 0.01 && !(want === 0 && e.k > 0)) continue;
      e.k += (want - e.k) * Math.min(1, step * (want > e.k ? 2.5 : 0.6));
      if (e.k < 0.005) e.k = 0;
      PM.setColorAt(i, col.copy(e.color).lerp(WARM, 0.65 * e.k));
      dirty = true;
    }
    if (dirty) PM.instanceColor.needsUpdate = true;
  };

  // ---------------------------------------------------------------- per frame
  const st = { clock: 0 };
  const camPos = V(0, 0, 0);
  const update = (dt, t, { camera }) => {
    st.clock += dt;
    camPos.copy(camera?.position ?? player.pos);
    eye.copy(camPos);
    // the relit pools hold the traveller's colours
    for (const P of pools) {
      P.props.visible = camPos.distanceToSquared(P.c) < 110 * 110;
      if (!P.on || !P.props.visible) continue;
      P.flare = Math.max(0, P.flare - dt * 0.4);
      P.k = Math.min(1, P.k + dt / 2.5);
      if (camPos.distanceToSquared(P.c) < 200 * 200) setMagic(P.mat, st.clock * (0.5 + P.flare), { bright: 0.3 + 0.7 * P.k, tones: 6 });
      P.eggMat.uniforms.uColor.value.set('#8a8ea0').lerp(col.set('#f6dcb0'), P.k);
      P.eggMat.uniforms.uGlow.value = 0.05 + 0.95 * P.k;
      P.inkMat.uniforms.uColor.value.set('#4a4f63').lerp(col.set('#ffd6a0'), P.k);
      P.inkMat.uniforms.uGlow.value = 0.1 + 0.9 * P.k;
      P.light.w = 9 * P.k + 10 * P.flare;
    }
    // the saucer answers: three short, one long
    if (game.flag('perdide2.saucer.answered')) {
      const ph = st.clock % 3.2, on = ph < 1.2 ? (ph % 0.4) < 0.22 : ph < 2.4;
      const k = on ? 1 : 0.08;
      S.light.material.uniforms.uGlow.value = k;
      S.glow.w = 6 + 14 * k;
      beam.visible = on && !game.flag('perdide2.saucer.seen');
    }
    // Hollin walks down to the cave to see the lights (when you're not watching)
    if (quests.reached(Q, 'answer') && !people.hollin?.atCave && people.hollin && flat(player.pos, people.hollin.pos) > 50) moveHollin();
    if (latch) latch.g.visible = camPos.distanceToSquared(latchAt) < 120 * 120;
    updateWave(dt);
  };

  return { people, update, pools, light, places: { saucerAt, latchAt, fenAt, wickAt, hollinEnd } };
}
