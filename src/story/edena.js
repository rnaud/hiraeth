import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeMaterial, MODE_STRATA } from '../materials.js';
import { registerTarget } from '../targets.js';
import { registerInteractable, PRIORITY } from '../interact.js';
import { Puffs, ownMaterial } from './puffs.js';
import { QUESTS, PEOPLE, THINGS, ITEMS } from './edena-data.js';

// Viridel's story, alive (edena-data.js has the words).
//
//   near the start  Mira (the water clock) and Sol, level people
//   the ruins       Oro, who grows pyramids from seeds
//   the trees       Lio, who climbs; the tallest tree, with Talo's lookout
//                   on its floating crown (a boost from the upper canopy)
//   the ship        Vey among the vines; the hatch, the cabin, the log at the
//                   cockpit panel; the veil of flowers over the scorch on the
//                   flank, which parts when you water it (shoot), never when
//                   you shove it (push)
//
// Flags (game-state.js): edena.mira.heard, edena.vey.asked,
// edena.cabin.seen, edena.log.read, edena.veil.open, edena.veil.pushed,
// edena.scar.seen, edena.rumour.light, edena.seed.planted,
// edena.seed.watered, edena.lookout.read; clue.edena.struck,
// clue.edena.pod. Items: seed.

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const flat = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const ease = (t) => t * t * (3 - 2 * t);

export function setupEdena(ctx) {
  const { level, physics, player, quests, dialogue, game, sound, story, spawn, scene, toast, npcs } = ctx;
  const E = level.edena;
  if (!E) return null;
  for (const q of QUESTS) quests.define(q);
  quests.itemNames = ITEMS;
  const Q = 'edena.garden';
  if (!quests.isStarted(Q)) quests.start(Q);
  const S = E.crashed, T = E.tall;
  const ground = (x, z) => level.ground.heightAt(x, z);
  const onGround = (x, z) => { const g = physics.groundAt(x, ground(x, z) + 6, z, 30); return V(x, Number.isFinite(g) ? g : ground(x, z), z); };

  // ---------------------------------------------------------------- the people
  const people = {};
  for (const id of ['mira', 'sol', 'oro', 'lio']) { const n = npcs.find((m) => m.def?.id === id); if (n) people[id] = n; }
  // Vey walks slowly up and down the flank, by the hatch
  const out = V(Math.sin(S.hatchHeading), 0, Math.cos(S.hatchHeading)), side = V(out.z, 0, -out.x);
  const veyAt = (a, b) => onGround(S.hatch.x + out.x * a + side.x * b, S.hatch.z + out.z * a + side.z * b);
  people.vey = spawn(PEOPLE.vey, { route: [veyAt(4, -5), veyAt(5, -9), veyAt(3.5, -13)], speed: 0.5 });

  // ---------------------------------------------------------------- places
  for (const [id, n] of Object.entries(people)) quests.locate(id, () => n.pos);
  const shipAt = onGround(S.hatch.x + out.x * 8, S.hatch.z + out.z * 8);
  // where to stand to see the flank (and the marker for the veil): out from the scorch, on the ground
  const look = S.scar.clone().addScaledVector(V(S.scarNormal.x, 0, S.scarNormal.z).normalize(), 9);
  const veilLook = onGround(look.x, look.z);
  quests.locate('ship', () => shipAt);
  quests.locate('hatch', () => S.hatch);
  quests.locate('panel', () => S.panel);
  quests.locate('veil', () => veilLook);
  quests.locate('veilLook', () => veilLook);
  quests.locate('lookout', () => T.lookout);
  // the seed: on the pond's far shore (west), where the bank comes out of the water
  const P = E.pond, dir = V(-0.8, 0, -0.6).normalize();
  let r = 0;
  while (r < P.r * 1.4 && ground(P.x + dir.x * r, P.z + dir.z * r) < P.y + 0.15) r += 1;
  const seedAt = onGround(P.x + dir.x * (r + 2), P.z + dir.z * (r + 2));
  const sproutAt = onGround(141, 92);
  quests.locate('seed', () => seedAt);
  quests.locate('sprout', () => sproutAt);

  // ---------------------------------------------------------------- the cabin and the log
  const thing = (def, at, { range = 3, prompt, enabled = () => true, use, dy = 4 } = {}) => registerInteractable({
    id: def.id, priority: PRIORITY.use, range, prompt: prompt ?? `look at ${def.name.replace(/^The /, 'the ')}`,
    at: () => at, enabled, distance: (p) => (Math.abs(p.pos.y - at.y) < dy ? flat(p.pos, at) : Infinity),
    use: use ?? (() => dialogue.start(def, null, at)),
  });
  thing(THINGS.log, S.panel.clone().add(V(0, 1, -0.6)), { range: 2.6, prompt: 'touch the cockpit panel' });
  const open = () => !!game.flag('edena.veil.open');
  thing(THINGS.scar, veilLook, { range: 6, prompt: 'look at the scorch under the flowers', enabled: open, dy: 6 });
  thing(THINGS.lookout, T.lookout, { range: 3.2, prompt: 'read the note on the post' });

  // ---------------------------------------------------------------- the veil over the scorch
  const petals = new Puffs(scene, { color: '#f2a7b5', max: 70, glow: 0.5, detail: 0 });
  const pollen = new Puffs(scene, { color: '#f2c54b', max: 40, glow: 0.6, detail: 0 });
  const st = { veil: open() ? (quests.isDone(Q) ? 0.18 : 1) : 0, veilTo: open() ? (quests.isDone(Q) ? 0.18 : 1) : 0, shiver: 0, nearShip: false, seen: 0, walked: 0, last: player.pos.clone(), grow: game.flag('edena.seed.watered') ? 1 : 0, crown: false };
  S.part(st.veil);
  const mayOpen = () => game.flag('edena.log.read') || quests.reached(Q, 'veil');
  const bloom = (at, n = 10, spread = 1.4) => { petals.burst(at, { n, rise: 1.2, size: 0.32, spread, life: 3.5, gravity: 0.4 }); pollen.burst(at, { n: Math.ceil(n / 2), rise: 0.8, size: 0.18, spread, life: 3 }); };
  registerTarget({ kind: 'veil', radius: 3.6, position: () => S.scar, enabled: () => !open() && flat(player.pos, S.scar) < 70,
    onHit: (mode) => {
      if (mode === 'push') {
        st.shiver = 1;
        game.set('edena.veil.pushed', true);
        toast('The vines shove back. They close tighter over the hull.');
        return true;
      }
      if (!mayOpen()) { st.shiver = 0.6; toast('The flowers drink the fluid, and turn their faces to you. That’s all, for now.'); bloom(S.scar, 4); return true; }
      game.set('edena.veil.open', true);
      st.veilTo = 1;
      toast('The flowers drink, and open, and the vines draw slowly aside, as if they had been waiting to be asked.');
      sound.chime?.();
      return true;
    } });

  // ---------------------------------------------------------------- the seed, and the pyramid it grows into
  const pyramidGeo = (s) => mergeGeometries(Array.from({ length: 5 }, (_, i) => new THREE.BoxGeometry(s * (1 - i * 0.18), s * 0.18, s * (1 - i * 0.18)).translate(0, s * 0.18 * (i + 0.5), 0).toNonIndexed()));
  const white = makeMaterial({ color: '#f3ead8', color2: '#f2c5b0', color3: '#e7d8b6', mode: MODE_STRATA, strataSize: 0.12, flat: true });
  const seedMat = ownMaterial({ color: '#fbf8f0', glow: 0.3, flat: true });
  const seed = new THREE.Mesh(pyramidGeo(0.5), seedMat);
  seed.position.copy(seedAt);
  seed.userData.noCollide = true;
  seed.visible = !quests.has('seed') && !game.flag('edena.seed.planted') && !quests.isDone('edena.seed');
  scene.add(seed);
  const seedLight = new THREE.Vector4(seedAt.x, seedAt.y + 0.6, seedAt.z, seed.visible ? 4 : 0);
  level.lights?.push?.(seedLight);
  registerInteractable({ id: 'seed', priority: PRIORITY.use, range: 2.6, prompt: 'pick up the little white seed', at: () => seed.position, enabled: () => seed.visible,
    distance: (p) => (Math.abs(p.pos.y - seedAt.y) < 4 ? flat(p.pos, seedAt) : Infinity),
    use: () => {
      quests.give('seed');
      seed.visible = false; seedLight.w = 0;
      if (!quests.isStarted('edena.seed')) quests.start('edena.seed', 'return'); else quests.advance('edena.seed', 'find');
      toast(`Picked up ${ITEMS.seed}. It is warm, and seems to lean toward the meadow.`);
      sound.chime?.();
    } });
  const sprout = new THREE.Mesh(pyramidGeo(3.6), white);
  sprout.position.copy(sproutAt).add(V(0, -0.05, 0));
  sprout.userData.noCollide = true;
  scene.add(sprout);
  const planted = new THREE.Mesh(pyramidGeo(0.5), seedMat);
  planted.position.copy(sproutAt);
  planted.userData.noCollide = true;
  scene.add(planted);
  const showSprout = () => {
    planted.visible = !!game.flag('edena.seed.planted') && st.grow < 0.12;
    sprout.visible = st.grow > 0.001;
    sprout.scale.setScalar(Math.max(0.001, st.grow));
  };
  showSprout();
  registerTarget({ kind: 'sprout', radius: 1.4, position: () => sproutAt.clone().add(V(0, 0.3, 0)), enabled: () => !!game.flag('edena.seed.planted') && !game.flag('edena.seed.watered'),
    onHit: (mode) => {
      if (mode !== 'shoot') { toast('The seed rocks in its little hollow. It wants water, not wind.'); return true; }
      game.set('edena.seed.watered', true);
      st.grow = Math.max(st.grow, 0.0011);
      bloom(sproutAt.clone().add(V(0, 0.5, 0)), 12, 2);
      toast('The seed drinks, and splits, and climbs: step on step on step.');
      sound.chime?.();
      return true;
    } });

  // ---------------------------------------------------------------- the end of the main quest
  quests.def(Q).onDone = () => {
    game.set('world.edena.done', true);
    st.veilTo = 0.18;   // the flowers close over it again, mostly
    setTimeout(() => story.complete?.(), 1200);
  };

  // ---------------------------------------------------------------- music
  sound.setBands?.([
    { id: 'clock', pos: people.mira ? () => people.mira.pos : V(30, 0, 30), radius: 30, parts: ['bell'], mode: 'play', vol: 0.35, duck: 0.2 },
    { id: 'ship', pos: S.centre.clone(), radius: 80, parts: ['chant'], mode: 'play', vol: 0.4, duck: 0.3 },
  ]);

  // ---------------------------------------------------------------- per frame
  const update = (dt, t) => {
    const pp = player.pos;
    if (!game.flag('edena.cabin.seen') && pp.y > 1400 && Math.hypot(pp.x - S.panel.x, pp.z - S.panel.z) < 18) game.set('edena.cabin.seen', true);
    // the ship's flowers breathe out petals when you first come close
    const dShip = flat(pp, S.centre);
    if (dShip < 42 && pp.y < 1000 && !st.nearShip) { st.nearShip = true; for (let k = 0; k < 4; k++) bloom(S.centre.clone().add(V((Math.random() - 0.5) * 30, 6 + Math.random() * 6, (Math.random() - 0.5) * 30)), 6, 2); }
    else if (dShip > 80) st.nearShip = false;
    // the veil: drawn aside when watered; a shove makes it shiver and close tighter; afterwards it closes over again
    if (game.flag('edena.scar.seen') && st.veilTo > 0.5 && !quests.isDone(Q)) { st.seen += dt; if (st.seen > 40) st.veilTo = 0.35; }
    const before = st.veil;
    st.veil += (st.veilTo - st.veil) * Math.min(1, dt * (st.veilTo > st.veil ? 0.5 : 0.06));
    if (Math.abs(st.veil - st.veilTo) < 0.002) st.veil = st.veilTo;
    let k = st.veil;
    if (st.shiver > 0) { st.shiver = Math.max(0, st.shiver - dt * 1.2); k = Math.max(0, st.veil - 0.06 * st.shiver * (0.5 + 0.5 * Math.sin(t * 30))); }
    if (k !== before || st.shiver > 0) S.part(k);
    if (st.veil > 0.2 && st.veil < 0.9 && st.veilTo > st.veil && Math.random() < dt * 8) bloom(S.scar.clone().add(V((Math.random() - 0.5) * 6, (Math.random() - 0.5) * 4, (Math.random() - 0.5) * 6)), 3, 1);
    // the seed glows when you're near; carried, it scatters petals in your footsteps
    if (seed.visible) { const near = THREE.MathUtils.clamp(1 - flat(pp, seedAt) / 25, 0, 1); seedMat.uniforms.uGlow.value = 0.25 + 0.6 * near * (0.6 + 0.4 * Math.sin(t * 3)); seedLight.w = 3 + 4 * near; }
    if (quests.has('seed')) {
      st.walked += flat(pp, st.last);
      if (st.walked > 3) { st.walked = 0; petals.burst(pp.clone().add(V(0, 0.2, 0)), { n: 3, rise: 0.6, size: 0.25, spread: 0.8, life: 2.5, gravity: 0.3 }); }
    }
    st.last.copy(pp);
    // the planted seed grows into a small pyramid
    if (game.flag('edena.seed.watered') && st.grow < 1) { st.grow = Math.min(1, st.grow + dt / 9); showSprout(); if (st.grow >= 1) quests.isActive('edena.seed') && quests.advance('edena.seed', 'water'); }
    else if (planted.visible !== (!!game.flag('edena.seed.planted') && st.grow < 0.12)) showSprout();
    // the crown: a gust of petals when you land on it
    const onCrown = flat(pp, T.crown) < T.crownR && Math.abs(pp.y - T.crown.y) < 2;
    if (onCrown && !st.crown) bloom(pp.clone().add(V(0, 1, 0)), 14, 3);
    st.crown = onCrown;
    petals.update(dt);
    pollen.update(dt);
  };

  return { people, update, state: st, seedAt, sproutAt, veilLook };
}
