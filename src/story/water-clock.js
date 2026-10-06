import * as THREE from 'three';
import { makeMaterial, MODE_WATER } from '../materials.js';
import { registerTarget } from '../targets.js';
import { registerInteractable, PRIORITY } from '../interact.js';
import { Puffs } from './puffs.js';

// Mira's water clock (Viridel): where Lorn II's errand of a brass gear ends
// (src/levels/content.js ERRANDS 'gear'). Delivering it (greeting Mira) starts a
// little quest of its own (edena.clock): fit the gear in the clock (E), then fill
// its leaking bowl with three quick splashes (shoot) so it tips and rings the
// bell. One splash at a time only drips away again: it wants the whole tank, fast.
//
// Flags: edena.clock.fitted, edena.clock.rung.

const Q = 'edena.clock';
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const flat = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
export const CLOCK = { x: 24, z: 37 };
export const FILL = { shot: 0.36, drain: 0.12 };   // per splash; per second

export function setupWaterClock(ctx) {
  const { level, player, quests, game, sound, scene, toast, journal } = ctx;
  const y0 = level.ground.heightAt(CLOCK.x, CLOCK.z);
  const at = V(CLOCK.x, y0, CLOCK.z);
  const white = makeMaterial({ color: '#f7f4ec', flat: true, grid: 3 });
  const brass = makeMaterial({ color: '#d8a24a', flat: true, metal: 'painted' });
  const teal = makeMaterial({ color: '#62c3c9', flat: true });
  const water = makeMaterial({ color: '#7fc4d0', color2: '#9ad3d9', mode: MODE_WATER });
  const g = new THREE.Group();
  g.position.copy(at);
  // the stand, the drip tank on its post, the bowl on its pivot, the bell on its arm
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.9, 1.1, 16).translate(0, 0.55, 0), white));
  g.add(new THREE.Mesh(new THREE.BoxGeometry(0.25, 2.6, 0.25).translate(-0.55, 1.3, 0), white));
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.36, 0.6, 14).translate(-0.55, 2.75, 0), teal));
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.5, 6).rotateZ(Math.PI / 2).translate(-0.3, 2.45, 0), teal));
  const pivot = new THREE.Group();
  pivot.position.set(0.05, 1.55, 0);
  const bowl = new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), white);
  bowl.material = makeMaterial({ color: '#f7f4ec', flat: true, side: THREE.DoubleSide });
  pivot.add(bowl);
  const fillMesh = new THREE.Mesh(new THREE.CircleGeometry(0.46, 16).rotateX(-Math.PI / 2), water);
  fillMesh.userData.noCollide = true;
  pivot.add(fillMesh);
  g.add(pivot);
  g.add(new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 1.3).translate(0.05, 1.55, 0), brass));   // the axle
  const gear = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.08, 12).rotateX(Math.PI / 2).translate(0.05, 1.55, 0.7), brass);
  for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; gear.add(new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.12, 0.08).translate(0.05 + Math.cos(a) * 0.38, 1.55 + Math.sin(a) * 0.38, 0.7).rotateZ(0), brass)); }
  g.add(gear);
  g.add(new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.6, 0.1).translate(0.75, 0.8 + 1.1, -0.55), white));
  const bell = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.3, 12, 1, true).translate(0.75, 2.62, -0.55), makeMaterial({ color: '#d8a24a', flat: true, side: THREE.DoubleSide, metal: 'painted' }));
  g.add(bell);
  g.traverse((o) => { if (o !== g) o.userData.noCollide = true; });
  scene.add(g);
  const drops = new Puffs(scene, { color: '#bfe6ea', max: 30, glow: 0.4, detail: 0 });
  quests.locate('clock', () => at.clone().add(V(0, 1.6, 0)));

  const st = { lv: 0, tip: game.flag('edena.clock.rung') ? 0 : 0, tipping: 0, ring: 0 };
  const fitted = () => !!game.flag('edena.clock.fitted');
  const show = () => { gear.visible = fitted(); fillMesh.visible = st.lv > 0.02; fillMesh.position.y = -0.4 + 0.36 * Math.min(1, st.lv); fillMesh.scale.setScalar(0.5 + 0.5 * Math.min(1, st.lv)); };
  show();

  // the gear arrives with the errand: delivering it to Mira starts this
  const delivered = () => !!journal?.errand?.('gear')?.done;
  const maybeStart = () => { if (delivered() && !quests.isStarted(Q) && quests.def(Q)) quests.start(Q); };

  registerInteractable({ id: 'clock.gear', priority: PRIORITY.use, range: 2.8, prompt: 'fit the brass gear in the water clock', at: () => at.clone().add(V(0, 1.9, 0)),
    enabled: () => quests.stage(Q) === 'fit', distance: (p) => (Math.abs(p.pos.y - at.y) < 3 ? flat(p.pos, at) : Infinity),
    use: () => { game.set('edena.clock.fitted', true); show(); sound.chime?.(); toast('The gear slides onto the axle and bites. Now the bowl: it leaks, so it wants filling fast.'); } });
  registerTarget({ kind: 'clockBowl', radius: 0.8, position: () => at.clone().add(V(0.05, 1.55, 0)), enabled: () => flat(player.pos, at) < 40 && !st.tipping,
    onHit: (mode) => {
      if (mode === 'push') { st.wobble = 1; toast('The bowl rocks on its pivot. It wants water, not wind.'); return true; }
      drops.burst(at.clone().add(V(0.05, 1.7, 0)), { n: 4, rise: 0.8, size: 0.14, spread: 0.5, life: 0.9, gravity: 4 });
      st.lv = Math.min(1.05, st.lv + FILL.shot);
      if (!fitted()) { toast(quests.isStarted(Q) ? 'The bowl fills, and drains through the old crack; nothing turns: the gear is missing.' : 'A water clock, its axle bare: the gear that should be on it is missing.'); return true; }
      if (st.lv >= 1) {
        st.tipping = 0.0001;
        if (quests.isActive(Q)) game.set('edena.clock.rung', true);
        toast('The bowl fills, tips, and the bell rings: time to water.');
      } else if (st.lv < FILL.shot * 1.5) toast('The bowl takes it, and starts to drip. Quick: more.');
      return true;
    } });

  function update(dt) {
    maybeStart();
    if (st.tipping) {
      st.tipping += dt;
      const k = st.tipping < 0.6 ? st.tipping / 0.6 : Math.max(0, 1 - (st.tipping - 1.4) / 1.2);
      pivot.rotation.z = -1.4 * k;
      if (st.tipping > 0.5 && !st.ring) { st.ring = 1; sound.chime?.(); drops.burst(at.clone().add(V(0.6, 1.4, 0)), { n: 10, rise: 0.4, size: 0.18, spread: 0.6, life: 1.2, gravity: 6 }); st.lv = 0; }
      bell.rotation.x = st.ring ? Math.sin(st.tipping * 18) * 0.3 * Math.max(0, 1 - st.tipping / 2.5) : 0;
      if (st.tipping > 2.6) { st.tipping = 0; st.ring = 0; pivot.rotation.z = 0; bell.rotation.x = 0; }
    } else if (st.lv > 0) st.lv = Math.max(0, st.lv - FILL.drain * dt);
    if (st.wobble > 0) { st.wobble = Math.max(0, st.wobble - dt * 2); pivot.rotation.x = Math.sin(st.wobble * 20) * 0.15 * st.wobble; }
    show();
    drops.update(dt);
  }
  return { update, at, state: st };
}
