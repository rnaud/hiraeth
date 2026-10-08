import * as THREE from 'three';
import { makeMaterial } from '../materials.js';
import { registerInteractable, PRIORITY } from '../interact.js';
import { hitboxes } from '../hitboxes.js';

// The Arena's hitbox board (src/hitboxes.js): a stone post with a slate showing a wire cube, by the way in.
// Walk up and press the interact button (B / ○, E) to show or hide the fight's hitboxes; its lamp is lit
// while they show. (Elsewhere: F4, L3 + R3, or the dev menu.)

export function placeHitboxBoard(scene, at, { heading = 0 } = {}) {
  const g = new THREE.Group();
  const stone = makeMaterial({ color: '#b9a88e', color2: '#a29177', color3: '#8f7f66' });
  const slate = makeMaterial({ color: '#2f2a33', flat: true });
  const wire = makeMaterial({ color: '#29d3ff', glow: 1, flat: true, key: 'hitbox-board-wire' });
  const lampOff = '#5a5148', lampOn = '#ff5fb4';
  const lampMat = makeMaterial({ color: lampOff, glow: 1, flat: true, key: 'hitbox-board-lamp' });
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 1.9, 8), stone); post.position.y = 0.95;
  const board = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.0, 0.12), stone); board.position.set(0, 1.95, 0.05); board.rotation.x = -0.18;
  const face = new THREE.Mesh(new THREE.PlaneGeometry(1.08, 0.8), slate); face.position.set(0, 1.96, 0.12); face.rotation.x = -0.18;
  g.add(post, board, face);
  // the glyph: a wire cube drawn in glowing bars, slanted with the slate
  const glyph = new THREE.Group(); glyph.position.set(0, 1.96, 0.16); glyph.rotation.x = -0.18;
  const s = 0.2, o = 0.09;
  const bar = (x, y, w, h) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.02), wire); m.position.set(x, y, 0); glyph.add(m); };
  for (const [dx, dy] of [[0, 0], [o, o]]) { bar(dx, s + dy, 2 * s, 0.03); bar(dx, -s + dy, 2 * s, 0.03); bar(-s + dx, dy, 0.03, 2 * s); bar(s + dx, dy, 0.03, 2 * s); }
  for (const [x, y] of [[-s, -s], [s, -s], [-s, s], [s, s]]) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(Math.hypot(o, o), 0.03, 0.02), wire);
    m.position.set(x + o / 2, y + o / 2, 0); m.rotation.z = Math.PI / 4; glyph.add(m);
  }
  g.add(glyph);
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 8), lampMat); lamp.position.y = 2.6; g.add(lamp);
  g.position.copy(at); g.rotation.y = heading;
  scene.add(g);
  const light = () => lampMat.uniforms?.uColor?.value?.set(hitboxes.on ? lampOn : lampOff);
  light();
  const offs = [hitboxes.listen(light), registerInteractable({
    id: 'arena.hitboxes', priority: PRIORITY.use, range: 3,
    at: () => g.position.clone().add(new THREE.Vector3(0, 2.8, 0)),
    prompt: () => (hitboxes.on ? 'hide the hitboxes' : 'show the hitboxes'),
    distance: (p) => p.pos.distanceTo(g.position),
    use: () => hitboxes.toggle(),
  })];
  return { object: g, remove() { for (const f of offs) f(); g.removeFromParent(); } };
}
