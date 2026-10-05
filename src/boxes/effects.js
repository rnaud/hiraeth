import * as THREE from 'three';
import { game as sharedGame } from '../game-state.js';
import { items } from '../items.js';
import { makeMaterial } from '../materials.js';
import { starShape, BOX_COLORS } from './model.js';

// What the boxes' special items do (src/items.js documents them). Kept cheap
// and from the outside: nothing here edits the tool or the player.
//
//   cell     the tank's reserve holds 4 charges (tool.reserve.max)
//   coil     it refills 3 s after the last use (tool.reserve.delay)
//   lantern  after dusk a little paper lantern glows on the tank and lights the ground
//   lens     unopened boxes show a pale column from afar (src/boxes/index.js reads it)
//   bell     V sounds a bell note; unopened boxes within 90 m answer (game event 'bell' { pos })
//   star     a pale enamel star on the hood, over the brow
//
//   const fx = createItemEffects({ player, tool, level, sound, isNight: () => bool });
//   fx.update(dt, t)   per frame

const BASE = { charges: 3, delay: 5 };
/** The star on the traveller's helmet liner (head-anchor frame: the skull's centre), facing up and out. */
export const TRAVELLER_STAR = { at: new THREE.Vector3(0, 0.102, 0.079), tilt: -0.9, scale: 0.7 };

export function createItemEffects({ player, tool = null, level = null, sound = null, isNight = () => false, game: g = sharedGame, keys = typeof window !== 'undefined' ? window : null, toast = () => {} }) {
  const H = player?.humanoid;
  // ---- the tank upgrades
  const applyTank = () => {
    const R = tool?.reserve;
    if (!R) return;
    const max = BASE.charges + (items.has('cell') ? 1 : 0);
    if (R.max !== max) { const wasFull = R.charges >= R.max; R.max = max; R.charges = wasFull ? max : Math.min(R.charges, max); }
    R.delay = items.has('coil') ? 3 : BASE.delay;
  };
  // ---- the lantern: a paper lantern on the tank (or the hip, without one) and a light at night
  let lantern = null;
  const light = new THREE.Vector4(0, -1e5, 0, 0);
  level?.lights?.push(light);
  if (H?.chestAnchor) {
    const grp = new THREE.Group();
    const paper = makeMaterial({ color: '#e0503a', flat: true, glow: 0.2, key: 'lantern.paper' });
    grp.add(new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 8).scale(1, 1.25, 1), paper));
    grp.add(new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.025, 0.016, 8).translate(0, 0.07, 0), makeMaterial({ color: '#2b211f', flat: true })));
    grp.add(new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.07, 4).translate(0, 0.11, 0), makeMaterial({ color: '#c8483a', flat: true })));
    grp.position.set(0.28, 0.6, -0.3);   // hung off the tank's left rail, below the cap (chest-anchor frame)
    grp.traverse((o) => { o.userData.noCollide = true; });
    grp.visible = false;
    H.chestAnchor.add(grp);
    lantern = { grp, paper };
  }
  // ---- the star on the hood
  let star = null;
  if (H?.headAnchor) {
    star = new THREE.Mesh(new THREE.ExtrudeGeometry(starShape(0.045, 0.015), { depth: 0.008, bevelEnabled: false }),
      makeMaterial({ color: BOX_COLORS.star, flat: true, glow: 0.3 }));
    star.position.set(0, 0.17, 0.112);   // on the brow (the imported head: eyes at y 0.09, the crown at 0.23)
    star.rotation.set(-0.5, 0, 0);
    // the traveller in his suit (humanoid.js outfit): the head anchor is the skull's centre and the bubble
    // helmet closes round it, so the star is pinned on the liner over his fringe, inside the glass (at the old
    // place it stood out through the top of the helmet)
    if (H.outfit) { star.position.copy(TRAVELLER_STAR.at); star.rotation.set(TRAVELLER_STAR.tilt, 0, 0); star.scale.setScalar(TRAVELLER_STAR.scale); }
    star.userData.noCollide = true;
    star.visible = false;
    H.headAnchor.add(star);
  }
  // ---- the bell
  let bellT = 0;
  const ring = () => {
    if (!items.has('bell') || bellT > 0 || !player || player.hidden) return false;
    bellT = 1.2;
    sound?.bell?.();
    g.emit('bell', { pos: player.pos.clone() });
    return true;
  };
  const onKey = (e) => { if (e.code === 'KeyV' && !e.repeat && !(globalThis.document?.activeElement?.tagName === 'INPUT')) ring(); };
  keys?.addEventListener?.('keydown', onKey);
  const off = items.on((id, owned) => {
    applyTank();
    if (owned && id === 'bell') setTimeout(() => toast('The bell-note whistle: press V (or click the right stick, R3) to sound it.'), 1800);
  });
  applyTank();

  return {
    ring,
    update(dt, t) {
      bellT = Math.max(0, bellT - dt);
      applyTank();   // (cheap; the tool may rebuild its reserve)
      const hasLantern = items.has('lantern');
      const night = hasLantern && isNight();
      if (lantern) {
        lantern.grp.visible = hasLantern && player?.object?.visible !== false;
        lantern.paper.uniforms.uGlow.value = night ? 0.9 + 0.1 * Math.sin(t * 7) : 0.2;
        lantern.grp.rotation.z = Math.sin(t * 2.3) * 0.15;
      }
      if (night && player && !player.hidden) light.set(player.pos.x, player.pos.y + 1.2, player.pos.z, 7.5 + Math.sin(t * 7) * 0.3);
      else light.set(0, -1e5, 0, 0);
      if (star) star.visible = items.has('star');
    },
    dispose() { off(); keys?.removeEventListener?.('keydown', onKey); lantern?.grp.removeFromParent(); star?.removeFromParent(); },
  };
}
