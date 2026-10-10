import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeMaterial } from '../materials.js';
import { registerTarget } from '../targets.js';
import { registerInteractable, PRIORITY } from '../interact.js';
import { DARK_POOLS, DOMES, SAUCER, FEN, HOLLIN_END, CAVE } from '../levels/perdide2.js';
import { magicMaterial, magicPool, setMagic } from './magic-water.js';
import { QUESTS, PEOPLE, THINGS, ITEMS, LINES, keepsakeFor } from './perdide2-data.js';
import { setupPerdide2Moments } from './perdide2-moments.js';
import { quietOr } from '../hint-level.js';

// Lorn II's story, alive (perdide2-data.js has the words): "The Lamps Are Kept".
//
//   the island   Hollin, the old lamp-keeper, waits where the path begins
//   the path     three pools gone dark (shoot them alight; they take your colours);
//                Pim by the moss domes (her door, the latch back on, is held open by
//                moss: wake the moss lamp over it with a shot, then push it shut),
//                Robin at the second dark pool
//   the water    the saucer in the deep pool (Odile and Talo's lifeboat), and old
//                Fen in the far dome on its mud islet (the skiff is his: light the
//                lamp on his mooring post, then nudge the empty skiff into its berth)
//   the cave     Bram minds the mouth; Hollin walks down to wait there at the end
//
// The world notices you: once Hollin knows you're here, the lamp-keepers
// brighten the pools ahead of you as you walk the path (Robin, once you've lit
// hers, runs ahead and brightens them further); the saucer blinks back at the
// third relit pool; at the end every pool on the path is lit for you.
//
// Flags (game-state.js): perdide2.hollin.met, perdide2.pool.<0-2>,
// perdide2.pools.lit (how many), perdide2.saucer.answered, perdide2.saucer.seen,
// perdide2.hollin.told, perdide2.promise ('yes' | 'maybe'), perdide2.fen.told,
// perdide2.rumour.light, perdide2.glyph.heard, clue.perdide2.edena,
// perdide2.pim.lamp / perdide2.pim.door (Pim's moss lamp woken, her door pushed shut),
// perdide2.fen.lamp / perdide2.skiff.home (Fen's landing lamp lit, the skiff in its berth).
// Items: latch, lamp.

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const flat = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const Q = 'perdide2.lamps';
const WARM = new THREE.Color('#fff1dc');
const UP = new THREE.Vector3(0, 1, 0), _q = new THREE.Quaternion();

export function setupPerdide2(ctx) {
  const { level, physics, player, quests, dialogue, game, sound, story, spawn, scene, toast, npcs, moments = null } = ctx;
  if (!level.saucer) return null;   // (the Deep Wood on its own, or in Lorn: src/levels/perdide.js)
  for (const q of QUESTS) quests.define(q);
  quests.itemNames = { ...(quests.itemNames ?? {}), ...ITEMS };
  // the main quest doesn't just appear: it starts when you talk to Hollin (the scout finds them till then: src/story/quests.js opensWith)
  if (!quests.isStarted(Q) && !game.flag('world.perdide2.done')) quests.opensWith(Q, 'hollin.perdide2', { at: 'hollin' });

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
    // (the arc bows upward, ∩, like the glyph everywhere: a half torus from 0 to π is the top half)
    ink.push(new THREE.TorusGeometry(0.36, 0.035, 3, 14, Math.PI).translate(0, 0.22, 0.19).toNonIndexed());
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
  let film = { pools: () => false };
  const light = (P) => {
    if (P.on) return false;
    P.on = true; P.flare = 1;
    P.dark.visible = false; P.live.visible = true;
    game.set(`perdide2.pool.${P.i}`, true);
    const n = lit() + 1;
    game.set('perdide2.pools.lit', n);
    sound.chime();
    const said = n < 3 ? `The pool drinks your fluid and lights up in your colours. ${n} of 3.` : 'The third pool lights up. And across the water, something blinks back: three short, one long.';
    for (const p of Object.values(people)) if (p.pos.distanceTo(P.c) < 40) p.shout = { text: LINES.lit[Math.floor(Math.random() * LINES.lit.length)], until: p.time + 2.5 };
    // the third, filmed (src/story/perdide2-moments.js): the saucer answers on its beat and the toast comes at its end; else at once
    if (n >= 3 && film.pools(P, { answer, said })) return true;
    toast(said);
    if (n >= 3) answer();
    return true;
  };
  // the saucer answers: three short, one long, from the start of its phrase (idempotent)
  const answer = () => {
    if (game.flag('perdide2.saucer.answered')) return;
    st.blink0 = st.clock;
    game.set('perdide2.saucer.answered', true);
  };
  for (const P of pools) {
    registerTarget({ kind: 'pool', radius: 2.9, accepts: ['fire'], position: () => P.c, enabled: () => !P.on && flat(player.pos, P.c) < 120,
      onHit: (mode) => {
        if (mode === 'shoot' || mode === 'fire') return light(P);   // the lamp pools take an ember glob too
        if (!P.pushed) { P.pushed = true; toast(quietOr('The push ripples the dark water, and it settles.', 'The push ripples the dark water, and it settles. It wants your fluid itself: shoot it.')); }
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

  // ---------------------------------------------------------------- Pim's door: moss in the frame, her moss lamp asleep
  // The latch back on, the shell door still won't swing to: it hung open so long that the
  // moss crept into its frame (moss creeps toward the dark). The moss lamp over the door
  // went out the night the sky rang. Wake it with your fluid (a shot) and the moss shrinks
  // back from its light; then push the door shut. A push first only rocks it.
  const LQ = 'perdide2.latch';
  const pd = (() => {
    const q = pimDoor.door.quaternion, dr = pimDoor.R * 0.28;
    const ax = V(1, 0, 0).applyQuaternion(q), ay = V(0, 1, 0).applyQuaternion(q), az = V(0, 0, 1).applyQuaternion(q);
    const onDoor = (x, y, z) => pimDoor.pos.clone().addScaledVector(ax, x).addScaledVector(ay, y).addScaledVector(az, z);
    // the shell door, hinged on its left edge: open, it stands out from the dome like a page
    const shellMat = makeMaterial({ color: '#e8dcc4', flat: true, glow: 0.05, side: THREE.DoubleSide, pimShell: true });
    const rimMat = makeMaterial({ color: '#3a8f8a', flat: true });
    const hinge = new THREE.Group();
    hinge.position.copy(onDoor(-dr, 0, 0.16));
    const leaf = new THREE.Group();
    leaf.add(new THREE.Mesh(new THREE.CircleGeometry(dr * 1.02, 24).translate(dr, 0, 0), shellMat));
    leaf.add(new THREE.Mesh(new THREE.TorusGeometry(dr * 1.02, 0.07, 4, 24).translate(dr, 0, 0.02), rimMat));
    for (let k = 1; k < 5; k++) leaf.add(new THREE.Mesh(new THREE.TorusGeometry(dr * 0.2 * k, 0.025, 3, 20, Math.PI * 0.9).rotateZ(-Math.PI * 0.45).translate(dr * 0.15, 0, 0.03), rimMat));   // the shell's growth lines
    // Pim's latch on it, once it's back (the ring of shell with its teal hook)
    const latchOn = new THREE.Group();
    latchOn.add(new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.06, 6, 14), makeMaterial({ color: '#f3ead8', flat: true })));
    latchOn.add(new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.035, 4, 10, Math.PI).rotateZ(-Math.PI / 2).translate(0.24, 0, 0), rimMat));
    latchOn.position.set(dr * 1.75, 0, 0.08);
    leaf.add(latchOn);
    hinge.add(leaf);
    hinge.traverse((o) => { o.userData.noCollide = true; });
    // moss tufts crept into the frame, round the doorway's right side and sill
    const mossMat = makeMaterial({ color: '#6f9a4e', flat: true });
    const tufts = [-1.3, -0.75, -0.2, 0.35, 0.9, 1.45, 2.0, 2.55].map((a, k) => {
      const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5 + (k % 3) * 0.12, 0).scale(1, 0.75, 0.7), mossMat);
      m.position.copy(onDoor(Math.cos(a - Math.PI / 2) * dr * 0.96, Math.sin(a - Math.PI / 2) * dr * 0.96, 0.25));
      m.rotation.set(k, k * 2, 0); m.userData.noCollide = true;
      return m;
    });
    // the moss lamp over the door: a cushion of moss, grey asleep, glowing awake
    const lampMat = makeMaterial({ color: '#5d6b66', glow: 0.04, pimLamp: true });
    const lampAt = onDoor(0, dr + 0.85, 0.35);
    const lamp = new THREE.Group();
    lamp.position.copy(lampAt);
    lamp.add(new THREE.Mesh(new THREE.SphereGeometry(0.62, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.8, 1), lampMat));
    for (let k = 0; k < 5; k++) lamp.add(new THREE.Mesh(new THREE.SphereGeometry(0.15, 6, 4).translate(Math.cos(k * 1.26) * 0.5, 0.05, Math.sin(k * 1.26) * 0.5), lampMat));
    lamp.traverse((o) => { o.userData.noCollide = true; });
    scene.add(hinge, lamp, ...tufts);
    const glowL = new THREE.Vector4(lampAt.x + pimDoor.out.x * 1.5, lampAt.y, lampAt.z + pimDoor.out.z * 1.5, 0);
    level.lights.push(glowL);
    const doorAt = onDoor(0, -0.5, 1.1);
    return { q, ay, hinge, leaf, latchOn, shellMat, tufts, lamp, lampMat, lampAt, glowL, doorAt, open: 1, shut: 0, lit: 0, rock: 0, closing: false };
  })();
  const OPEN = -1.75;   // the leaf's swing (radians about the door's up axis; 0 shut)
  const lampOn = () => !!game.flag('perdide2.pim.lamp') || quests.isDone(LQ);
  const doorShut = () => !!game.flag('perdide2.pim.door') || quests.isDone(LQ);
  if (lampOn()) pd.lit = 1;
  if (doorShut()) pd.open = 0;
  const wakeLamp = () => {
    if (lampOn()) return false;
    game.set('perdide2.pim.lamp', true);
    sound.chime();
    toast('The moss lamp drinks your fluid and wakes, glowing. In the doorway the moss curls back from the light.');
    if (people.pim) people.pim.shout = { text: '~happy~ My lamp! Look at the moss shrink!', until: people.pim.time + 2.5 };
    return true;
  };
  const shutDoor = () => {
    if (pd.closing || doorShut()) return false;
    pd.closing = true;
    sound.whoosh?.();
    return true;
  };
  const doorShutDone = () => {
    game.set('perdide2.pim.door', true);
    quests.give('lamp');
    toast(`Click. Pim’s door shuts, and opens, and shuts again. She presses ${ITEMS.lamp} into your hands: it lights itself when it’s dark enough.`);
    if (people.pim) people.pim.shout = { text: '~happy~ Shut! Open! Shut! Listen to that click!', until: people.pim.time + 3 };
    quests.advance(LQ, 'shut');
  };
  registerTarget({ kind: 'mossLamp', radius: 0.9, accepts: ['fire'], position: () => pd.lampAt, enabled: () => quests.stage(LQ) === 'shut' && !lampOn() && flat(player.pos, pd.lampAt) < 80,
    onHit: (mode) => {
      if (mode === 'shoot' || mode === 'fire') return wakeLamp();
      return true;   // a push sways the cushion; the door's own target says what's wrong
    } });
  let doorShotTold = false;
  registerTarget({ kind: 'pimDoor', radius: 1.8, position: () => pd.doorAt, enabled: () => quests.stage(LQ) === 'shut' && !pd.closing && flat(player.pos, pd.doorAt) < 60,
    onHit: (mode) => {
      if (mode === 'push') {
        if (lampOn()) return shutDoor();
        pd.rock = 1;
        toast(quietOr('The door rocks on its hinge and sticks: moss has crept into the frame.', 'The door rocks on its hinge and sticks: moss has crept into the frame. Moss shrinks from light, and the moss lamp over the door is asleep.'));
        return true;
      }
      if (!doorShotTold) { doorShotTold = true; toast(quietOr('The splash runs down the shell door.', 'The splash runs down the shell door. It wants a shove, not a soaking.')); }
      return true;
    } });
  const updatePimDoor = (dt) => {
    const near = camPos.distanceToSquared(pimDoor.pos) < 140 * 140;
    pd.hinge.visible = pd.lamp.visible = near;
    for (const t of pd.tufts) t.visible = near && pd.lit < 0.98;
    if (!near && !pd.closing) return;
    // the lamp wakes, and the moss shrinks back from it
    if (lampOn() && pd.lit < 1) pd.lit = Math.min(1, pd.lit + dt / 1.5);
    const u = pd.lampMat.uniforms;
    u.uColor.value.set('#5d6b66').lerp(col.set('#c8f2b0'), pd.lit);
    u.uGlow.value = 0.04 + 0.96 * pd.lit * (0.9 + 0.1 * Math.sin(st.clock * 1.7));
    pd.glowL.w = 9 * pd.lit;
    for (const [k, t] of pd.tufts.entries()) t.scale.setScalar(Math.max(0.01, 1 - pd.lit * (1 + k * 0.1)));
    // the leaf: open, rocking when it sticks, swinging shut when pushed
    if (pd.closing) {
      pd.shut += dt / 0.7;
      pd.open = 1 - THREE.MathUtils.smoothstep(pd.shut, 0, 1);
      if (pd.shut >= 1) { pd.closing = false; pd.open = 0; doorShutDone(); }
    }
    pd.rock = Math.max(0, pd.rock - dt * 1.6);
    const ang = OPEN * pd.open + Math.sin(pd.rock * 18) * 0.12 * pd.rock;
    pd.hinge.quaternion.copy(pd.q).multiply(_q.setFromAxisAngle(UP, ang));
    pd.latchOn.visible = quests.reached(LQ, 'shut');
    if (quests.isDone(LQ)) { pd.shellMat.uniforms.uColor.value.set('#ffe6c0'); pd.shellMat.uniforms.uGlow.value = 0.55; }
  };

  // ---------------------------------------------------------------- Fen's berth: the skiff brought home
  // Beside his landing, two posts in the deep water mark the skiff's old berth; the bow
  // post carries the mooring ring and Fen's landing lamp, dark since the skiff stopped
  // coming home. Light the lamp (a shot), then let the skiff come in on its own: step off
  // onto the landing and give it a nudge (a push within 10 m of the berth), and it glides
  // in under the lamp. Sailed in, Fen waves you off; toward a dark berth it shies off.
  const SK = 'perdide2.skiff';
  const bt = (() => {
    const out = fenDoor.out, side = V(-out.z, 0, out.x);
    const at = V(L0.x, 0, L0.z).addScaledVector(side, 6.2);
    const heading = Math.atan2(-out.x, -out.z);   // bow toward the dome, at the ring
    const wood = makeMaterial({ color: '#4a3f3a', flat: true, pattern: 'cracks' });
    const ringMat = makeMaterial({ color: '#3a8f8a', flat: true });
    const lampMat = makeMaterial({ color: '#4d5868', glow: 0.04, fenLamp: true });
    const g = new THREE.Group();
    const post = (p, h) => g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.26, h + 2.4, 7).translate(p.x, h / 2 - 1.2, p.z), wood));
    const bow = at.clone().addScaledVector(out, -3.0), stern = at.clone().addScaledVector(out, 3.0);
    post(bow, 3.2); post(stern, 1.4);
    // the mooring ring on the bow post, facing the berth
    g.add(new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.08, 5, 16).rotateY(heading).translate(bow.x + out.x * 0.3, 1.1, bow.z + out.z * 0.3), ringMat));
    // the lamp on top: a glass float in a little cage
    const lampAt = V(bow.x, 3.75, bow.z);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.42, 10, 7), lampMat);
    lamp.position.copy(lampAt);
    g.add(lamp);
    g.add(new THREE.Mesh(new THREE.ConeGeometry(0.34, 0.3, 7).translate(lampAt.x, lampAt.y + 0.5, lampAt.z), wood));
    // a rope slung between the posts
    const rope = new THREE.CatmullRomCurve3([V(bow.x, 1.5, bow.z), V(at.x, 1.0, at.z).addScaledVector(side, 0.7), V(stern.x, 1.2, stern.z)]);
    g.add(new THREE.Mesh(new THREE.TubeGeometry(rope, 12, 0.05, 4), wood));
    g.traverse((o) => { o.userData.noCollide = true; });
    scene.add(g);
    const glowL = new THREE.Vector4(lampAt.x, lampAt.y, lampAt.z, 0);
    level.lights.push(glowL);
    return { at, heading, g, lampAt, lampMat, glowL, lit: 0, inside: false, glide: null };
  })();
  const fenLampOn = () => !!game.flag('perdide2.fen.lamp') || quests.isDone(SK);
  if (fenLampOn()) bt.lit = 1;
  const BERTH_R = 3.2;
  registerTarget({ kind: 'fenLamp', radius: 0.8, accepts: ['fire'], position: () => bt.lampAt, enabled: () => quests.stage(SK) === 'home' && !fenLampOn() && flat(player.pos, bt.lampAt) < 80,
    onHit: (mode) => {
      if (mode === 'push') return true;
      game.set('perdide2.fen.lamp', true);
      sound.chime();
      toast('Fen’s landing lamp takes your fluid and glows over the empty berth.');
      if (people.fen) people.fen.shout = { text: '~happy~ My lamp! Forty years!', until: people.fen.time + 2.5 };
      return true;
    } });
  const ridingIt = (M) => (player.ride != null ? player.ride === M : !!player.riding);
  // a nudge near the landing: under a lit lamp it knows the way and glides in on its own
  // (the push itself, src/fluid-tool.js, only slides it along its keel); a dark berth it shies from
  const darkTold = { at: -Infinity };
  const toldDark = () => {
    if (st.clock - darkTold.at < 4) return;
    darkTold.at = st.clock;
    toast('The skiff noses toward the dark berth and shies off. It doesn’t know it’s home: Fen’s lamp is out.');
  };
  const NUDGE_R = 10;
  registerTarget({ kind: 'skiffHome', radius: 1.3, position: () => player.mount.pos,
    enabled: () => { const M = player.mount; return M?.kind === 'skiff' && quests.stage(SK) === 'home' && !bt.glide && !ridingIt(M) && !M.auto && flat(M.pos, bt.at) < NUDGE_R; },
    onHit: (mode) => {
      if (mode !== 'push') return false;
      if (fenLampOn()) bt.glide = { t: 0 };
      else toldDark();
      return true;
    } });
  const updateBerth = (dt) => {
    bt.g.visible = camPos.distanceToSquared(bt.at) < 160 * 160;
    if (fenLampOn() && bt.lit < 1) bt.lit = Math.min(1, bt.lit + dt / 1.2);
    if (bt.g.visible) {
      const u = bt.lampMat.uniforms;
      u.uColor.value.set('#4d5868').lerp(col.set('#ffd6a0'), bt.lit);
      u.uGlow.value = 0.04 + 0.96 * bt.lit;
      bt.glowL.w = 10 * bt.lit;
    }
    const M = player.mount;
    if (!M || M.kind !== 'skiff' || quests.stage(SK) !== 'home') return;
    if (bt.glide) {
      // it slides the last bit on its own, under the lamp, and bumps the ring
      const G = bt.glide, k = 1 - Math.exp(-2 * dt);
      G.t += dt;
      M.speed = 0; M.vel.set(0, M.vel.y, 0); M.yawRate = 0;
      M.pos.x += (bt.at.x - M.pos.x) * k; M.pos.z += (bt.at.z - M.pos.z) * k;
      let dh = bt.heading - M.heading; dh = Math.atan2(Math.sin(dh), Math.cos(dh));
      M.heading += dh * k;
      if (G.t > 2.4) {
        bt.glide = null;
        M.pos.x = bt.at.x; M.pos.z = bt.at.z; M.heading = bt.heading;
        game.set('perdide2.skiff.home', true);
        toast('The skiff slides into its berth under the lamp, bumps the ring, and stays. Out on his landing, Fen laughs out loud.');
        if (people.fen) people.fen.shout = { text: '~happy~ Home! Look at her, under the lamp!', until: people.fen.time + 3 };
        quests.advance(SK, 'home');
      }
      return;
    }
    const d = flat(M.pos, bt.at), ridden = ridingIt(M);
    if (d > BERTH_R + 1.5) { bt.inside = false; return; }
    if (d > BERTH_R) return;
    if (!ridden && !M.auto && fenLampOn()) { bt.glide = { t: 0 }; return; }
    if (bt.inside) return;
    bt.inside = true;
    if (ridden) toast(quietOr('Fen waves you off: “Not sailed in! Let her come the last bit on her own.”', 'Fen waves you off: “Not sailed in! Step off on my landing and let her come the last bit on her own. A nudge does it.”'));
    else if (!M.auto) {
      toldDark();
      M.speed = -(Math.sign(M.speed) || 1) * 3;   // it backs out again
    }
  };

  // ---------------------------------------------------------------- the end
  quests.def(Q).onDone = () => {
    game.set('world.perdide2.done', true);
    game.addKeepsake(keepsakeFor(game.flag('perdide2.promise')));
    toast('Every pool on the path is lit for you. Something of value? Someone, waiting for you to come back.');
    setTimeout(() => story.complete?.(), 1200);
  };

  // ---------------------------------------------------------------- places for the quest markers
  quests.locate('darkPool', nearestDark);
  quests.locate('saucer', () => saucerAt);
  quests.locate('latch', () => latchAt);
  quests.locate('pimDoor', () => (lampOn() ? pd.doorAt : pd.lampAt));
  quests.locate('fenBerth', () => (fenLampOn() ? bt.at.clone().setY(0.6) : bt.lampAt));
  quests.locate('cave', () => V(CAVE.x, CAVE.y, CAVE.mouth));
  // (where the pools are done and where Hollin waits at the end: for the level design audit's route, stages' `ends`, `stands`)
  quests.locate('lastPool', () => pools.at(-1)?.c ?? null);
  quests.locate('hollinEnd', () => hollinEnd);
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
      const ph = (st.clock - (st.blink0 ?? 0)) % 3.2, on = ph < 1.2 ? (ph % 0.4) < 0.22 : ph < 2.4;
      const k = on ? 1 : 0.08;
      S.light.material.uniforms.uGlow.value = k;
      S.glow.w = 6 + 14 * k;
      beam.visible = on && !game.flag('perdide2.saucer.seen');
    }
    // Hollin walks down to the cave to see the lights (when you're not watching)
    if (quests.reached(Q, 'answer') && !people.hollin?.atCave && people.hollin && flat(player.pos, people.hollin.pos) > 50) moveHollin();
    if (latch) latch.g.visible = camPos.distanceToSquared(latchAt) < 120 * 120;
    updatePimDoor(dt);
    updateBerth(dt);
    updateWave(dt);
    // the water-way's lamps (src/deep-wood-ways.js): lit once Hollin has heard what was in the saucer
    level.waterWay?.lit(quests.isDone(Q) || !!game.flag('perdide2.hollin.told'));
  };

  // the third pool's moment (src/story/perdide2-moments.js)
  film = setupPerdide2Moments(ctx, { saucerAt });

  return { people, update, pools, light, film, state: st, pimDoor: pd, berth: bt, places: { saucerAt, latchAt, fenAt, wickAt, hollinEnd, pimLamp: pd.lampAt, pimDoorAt: pd.doorAt, fenLamp: bt.lampAt, berth: bt.at } };
}
