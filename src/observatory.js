import * as THREE from 'three';
import { makeMaterial } from './materials.js';

export const OBSERVATORY = { x: 800, z: 200, radius: 65 };
const TARGETS = [2, 0, 3];
export const aligned = (turns) => TARGETS.every((v, i) => turns[i] === v);
export const turnDial = (turns, i) => turns.map((v, j) => j === i ? (v + 1) % 4 : v);

// Built before collision baking. Only the moving roof and optical apparatus
// are excluded: the tower, resting ledges and chamber are solid.
export function buildObservatory(scene, ground) {
  const { x, z } = OBSERVATORY;
  const y = ground.baseAt(x, z, 26);
  const root = new THREE.Group(); root.position.set(x, y, z); scene.add(root);
  const stone = makeMaterial({ color: '#efdbc0', grid: 3, glyphs: true });
  const blue = makeMaterial({ color: '#697a98' });
  const brass = makeMaterial({ color: '#d8a24a' });
  const glow = makeMaterial({ color: '#fff1b5', glow: 1 });
  function mesh(geo, mat, px, py, pz, parent = root) {
    const m = new THREE.Mesh(geo, mat); m.position.set(px, py, pz); parent.add(m); return m;
  }
  // Receding tiers expose resting ledges without unclimbable overhangs.
  const ledges = [];
  for (let i = 0; i < 6; i++) {
    const radius = 26 - i * 1.6, h = 8 * (i + 1);
    mesh(new THREE.CylinderGeometry(radius, radius, i === 0 ? 20 : 8, 12), stone, 0, i === 0 ? -2 : h - 4, 0);
    ledges.push(new THREE.Vector3(x + radius - 0.8, y + h, z));
  }
  mesh(new THREE.CylinderGeometry(17.5, 18, 2, 12), stone, 0, 49, 0);
  mesh(new THREE.CylinderGeometry(17.5, 17.5, 2, 12), stone, 0, 50, 0);
  // Chamber opens toward the dunes. Slender columns frame the view.
  for (let i = 0; i < 12; i++) {
    const a = i * Math.PI / 6, px = Math.sin(a) * 16, pz = Math.cos(a) * 16;
    mesh(new THREE.CylinderGeometry(0.7, 0.9, 9, 6), stone, px, 55.5, pz);
    if (i > 2 && i < 10) {
      const wall = mesh(new THREE.BoxGeometry(8.4, 5, 0.7), blue, px, 53.5, pz);
      wall.rotation.y = a;
    }
  }
  const roof = [];
  for (let i = 0; i < 4; i++) {
    const pivot = new THREE.Group(); pivot.position.set(0, 61, 0); pivot.rotation.y = i * Math.PI / 2;
    pivot.userData.noCollide = true; root.add(pivot);
    const leaf = new THREE.Group(); leaf.position.z = 17; pivot.add(leaf);
    mesh(new THREE.BoxGeometry(23, 0.65, 17), blue, 0, 0, -8.5, leaf);
    roof.push(leaf);
  }
  // The central lens is visible above the roof, giving the ruin its silhouette.
  mesh(new THREE.CylinderGeometry(0.6, 1.2, 20, 8), brass, 0, 61, 0).userData.noCollide = true;
  const crown = mesh(new THREE.TorusGeometry(5, 0.35, 6, 48), brass, 0, 72, 0);
  crown.userData.noCollide = true;
  const dials = [], beams = [], receivers = [], lights = [];
  for (let i = 0; i < 3; i++) {
    const a = i * Math.PI * 2 / 3, px = Math.sin(a) * 10, pz = Math.cos(a) * 10;
    mesh(new THREE.CylinderGeometry(1.6, 2, 1.5, 8), stone, px, 51.75, pz);
    const dial = new THREE.Group(); dial.position.set(px, 53.5, pz); dial.userData.noCollide = true; root.add(dial);
    mesh(new THREE.TorusGeometry(1.4, 0.16, 6, 24), brass, 0, 0, 0, dial);
    mesh(new THREE.BoxGeometry(0.8, 2, 0.12), glow, 0, 0, 0, dial);
    const beam = mesh(new THREE.CylinderGeometry(0.055, 0.055, 1, 6), glow, 0, 0, 0);
    beam.userData.noCollide = true;
    const receiver = mesh(new THREE.TorusGeometry(1.6 + i * 0.5, 0.12, 6, 32), glow, 0, 54 + i * 0.7, 0);
    receiver.rotation.x = Math.PI / 2; receiver.userData.noCollide = true;
    receivers.push(receiver);
    lights.push(new THREE.Vector4(x + px, y + 54, z + pz, 0));
    dials.push(dial); beams.push(beam);
  }
  const constellation = new THREE.Group(); constellation.userData.noCollide = true; root.add(constellation);
  const stars = [[-7, 68, 0], [-4, 73, -2], [0, 75, 0], [5, 72, 1], [7, 68, -1], [0, 65, 0]];
  stars.forEach((p, i) => {
    mesh(new THREE.OctahedronGeometry(0.45), glow, ...p, constellation);
    if (i) {
      const a = new THREE.Vector3(...stars[i - 1]), b = new THREE.Vector3(...p);
      const line = mesh(new THREE.CylinderGeometry(0.035, 0.035, a.distanceTo(b), 5), glow, ...a.clone().add(b).multiplyScalar(0.5).toArray(), constellation);
      line.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.sub(a).normalize());
    }
  });
  constellation.visible = false;
  return { root, roof, dials, beams, receivers, lights, constellation, ledges, center: new THREE.Vector3(x, y + 51, z) };
}

export class ObservatoryQuest {
  constructor({ model, journal, traveler, story, capture, sound }) {
    Object.assign(this, { model, journal, traveler, story, capture, sound });
    this.state = journal.data.observatory ??= { started: false, turns: [0, 1, 1], done: false, fragments: [] };
    this.opening = this.state.done ? 1 : 0;
    this.pendingPage = this.state.done && !this.state.illustrated;
    this.refreshTraveler();
    this.draw(0);
  }
  save() { this.journal.save(); }
  refreshTraveler() {
    this.traveler.lines = this.state.done
      ? ['You brought the stars back. I saw them from here.', 'Keep the sketch. It belongs to your journey now.']
      : ['A sleeping observatory stands east of here: a tower crowned by a brass ring.', 'Take my sketch. Rest on its ledges, then turn the three lenses toward the heart.'];
    this.traveler.lineIdx = 0;
  }
  page(title, caption, shots) {
    const imgs = shots.map(([eye, look], i) => this.capture(eye, look, i === 0 ? 900 : 440, i === 0 ? 380 : 300));
    this.story.page.innerHTML = `<div class="sheet"><div class="p p1"><img src="${imgs[0]}" alt="Observatory sketch"><div class="cap"><b>${title}</b><br>${caption}</div></div>${imgs.slice(1).map((img, i) => `<div class="p p${i + 2}"><img src="${img}" alt="Observatory detail"></div>`).join('')}<div class="hint">click / E to continue</div></div>`;
    this.story.page.classList.add('open'); this.story.pageOpen = true;
    document.exitPointerLock?.(); this.sound.page();
    return imgs[0];
  }
  nearby(player) {
    if (!this.state.started || this.state.done || player.riding) return -1;
    return this.model.dials.findIndex((d) => player.pos.distanceTo(d.getWorldPosition(new THREE.Vector3())) < 4);
  }
  update(dt, player, input, paused) {
    const down = !!input.KeyE, pressed = down && !this.held; this.held = down;
    if (paused) return false;
    const c = this.model.center;
    if (!this.state.started && this.traveler.greeted) {
      this.state.started = true;
      this.state.img = this.page('THE SLEEPING OBSERVATORY', 'East of camp, a brass ring breaks the horizon. Six ledges lead to the lenses. Turn their light toward the heart.', [
        [c.clone().add(new THREE.Vector3(-85, -12, 90)), c],
        [c.clone().add(new THREE.Vector3(24, 12, 28)), c.clone().add(new THREE.Vector3(0, 10, 0))],
        [this.traveler.pos.clone().add(new THREE.Vector3(4, 2, 4)), this.traveler.pos.clone().add(new THREE.Vector3(0, 1.5, 0))],
      ]);
      this.save();
    }
    this.fragment = '';
    const fragments = ['The keeper climbed each morning to polish the sun.', 'Three lenses, one heart. Follow each beam to the centre.', 'The roof was closed on the day the keeper left.'];
    this.model.ledges.forEach((p, i) => {
      if (i % 2 || Math.abs(player.pos.y - p.y) > 2 || Math.hypot(player.pos.x - c.x, player.pos.z - c.z) > 29) return;
      this.fragment = fragments[i / 2];
      if (!this.state.fragments.includes(this.fragment)) { this.state.fragments.push(this.fragment); this.save(); }
    });
    const index = this.nearby(player);
    if (index >= 0 && pressed) {
      this.state.turns = turnDial(this.state.turns, index);
      this.sound.chime();
      if (aligned(this.state.turns)) { this.state.done = true; this.pendingPage = true; this.refreshTraveler(); }
      this.save();
    }
    if (this.state.done && !this.state.returned && this.traveler.greeted && player.pos.distanceTo(this.traveler.pos) < 10) {
      this.state.returned = true; this.sound.chime(); this.save();
    }
    this.draw(dt);
    if (this.pendingPage && this.opening >= 1) {
      this.pendingPage = false;
      this.state.img = this.page('THE STARS REMEMBER', 'The roof unfolds. For the first time in an age, the observatory draws its constellation. The traveler will see it too. The dunes wait below: climb out and glide home.', [
        [c.clone().add(new THREE.Vector3(35, 32, 45)), c.clone().add(new THREE.Vector3(0, 12, 0))],
        [c.clone().add(new THREE.Vector3(12, 5, 12)), c.clone().add(new THREE.Vector3(0, 20, 0))],
        [player.pos.clone().add(new THREE.Vector3(5, 3, 5)), player.pos.clone().add(new THREE.Vector3(0, 1, 0))],
      ]);
      this.state.illustrated = true;
      this.save();
    }
    return index >= 0;
  }
  draw(dt) {
    if (this.state.done) this.opening = Math.min(1, this.opening + dt / 5);
    this.model.roof.forEach((r) => { r.rotation.x = this.opening * Math.PI * 0.9; });
    this.model.constellation.visible = this.state.done;
    this.model.dials.forEach((d, i) => {
      const correct = this.state.turns[i] === TARGETS[i];
      this.model.receivers[i].visible = correct;
      this.model.lights[i].w = correct ? 14 : 0;
      const angle = Math.atan2(-d.position.x, -d.position.z) + (this.state.turns[i] - TARGETS[i]) * Math.PI / 2;
      d.rotation.y = angle;
      const end = correct ? new THREE.Vector3(0, 54, 0) : d.position.clone().add(new THREE.Vector3(Math.sin(angle) * 6, 0, Math.cos(angle) * 6));
      const b = this.model.beams[i], delta = end.clone().sub(d.position);
      b.position.copy(end).add(d.position).multiplyScalar(0.5);
      b.scale.y = delta.length(); b.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize());
    });
  }
  hud(player) {
    if (!this.state.started) return 'Meet the traveler beside camp';
    if (this.state.done) return this.state.returned ? 'The stars remember · expedition complete' : 'Observatory awake · glide back to the traveler';
    const i = this.nearby(player);
    if (i >= 0) return `E turn lens ${i + 1} · ${this.state.turns.filter((v, j) => v === TARGETS[j]).length}/3 beams aligned`;
    return this.fragment || `Sleeping observatory · east · ${Math.round(player.pos.distanceTo(this.model.center))} m · J sketch`;
  }
}
