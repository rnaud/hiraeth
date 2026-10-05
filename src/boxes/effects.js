import * as THREE from 'three';
import { game as sharedGame } from '../game-state.js';
import { items } from '../items.js';
import { makeMaterial } from '../materials.js';
import { starShape, BOX_COLORS } from './model.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// What the boxes' special items do (src/items.js documents them). Kept cheap
// and from the outside: nothing here edits the tool or the player.
//
//   cell     the tank's reserve holds 4 charges (tool.reserve.max)
//   coil     it refills 3 s after the last use (tool.reserve.delay)
//   lantern  after dusk a little paper lantern glows on the tank and lights the ground
//   lens     unopened boxes show a pale column from afar (src/boxes/index.js reads it)
//   bell     V sounds a bell note; unopened boxes within 90 m answer (game event 'bell' { pos })
//   star     a pale enamel star on the hood, over the brow
//   resin    climbing tires you half as fast (player.climbK)
//   soles    a hard landing counts as a slower one (player.fallGuard: the drop it takes to tumble grows by a third)
//   hush     creatures don't hear you walk up (player.hush: src/wildlife.js reads it)
//   moss     after dusk a soft light round your feet (smaller than the lantern's; the lantern wins)
//   pouch    small flowers come up in your footsteps where you walk, and fade a while later
//   reed     you hold your breath twice as long under water (player.breathK: src/swim.js reads it)
//   scarf    the fluid wings sink slower (player.sinkK: src/player.js's glide reads it)
//   shell    every few seconds, unopened boxes within 45 m answer softly, as if to the bell (game event 'bell' { soft })
//
//   const fx = createItemEffects({ player, tool, level, sound, isNight: () => bool });
//   fx.update(dt, t)   per frame

const BASE = { charges: 3, delay: 5 };
const LANTERN_AT = new THREE.Vector3(0.28, 0.6, -0.3);   // the lantern on the tank's left rail, in the chest anchor's frame
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
    grp.position.copy(LANTERN_AT);   // hung off the tank's left rail, below the cap (chest-anchor frame)
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
  // ---- the bell (and the listening shell's soft hum)
  let bellT = 0, shellT = 3;
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

  // ---- the seed pouch: flowers in your footsteps (one instanced pool, recycled)
  let blooms = null, bloomI = 0, walked = 0;
  const lastStep = new THREE.Vector3(1e9, 0, 0);
  const BLOOM = { n: 160, every: 1.7, life: 40 };
  const bloomColors = ['#f2a7b8', '#f6d36a', '#ffffff', '#b7a0cf', '#ef7e62'].map((c) => new THREE.Color(c));
  const _bm = new THREE.Matrix4(), _bq = new THREE.Quaternion(), _bs = new THREE.Vector3(), _bp = new THREE.Vector3(), _by = new THREE.Vector3(0, 1, 0);
  function bloomPool() {
    if (blooms || !player?.scene) return blooms;
    const parts = [];
    for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; parts.push(new THREE.SphereGeometry(0.07, 6, 4).scale(1, 0.35, 0.6).translate(Math.sin(a) * 0.075, 0.16, Math.cos(a) * 0.075).toNonIndexed()); }
    parts.push(new THREE.SphereGeometry(0.04, 6, 4).translate(0, 0.17, 0).toNonIndexed());
    parts.push(new THREE.CylinderGeometry(0.008, 0.012, 0.16, 4).translate(0, 0.08, 0).toNonIndexed());
    for (const g of parts) g.deleteAttribute('uv');
    const mesh = new THREE.InstancedMesh(mergeGeometries(parts), makeMaterial({ color: '#ffffff', flat: true, key: 'pouch.bloom' }), BLOOM.n);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.userData.noCollide = true; mesh.userData.dynamic = true; mesh.frustumCulled = false;
    for (let i = 0; i < BLOOM.n; i++) { mesh.setMatrixAt(i, _bm.makeScale(0, 0, 0)); mesh.setColorAt(i, bloomColors[i % bloomColors.length]); }
    player.scene.add(mesh);
    blooms = { mesh, born: new Float32Array(BLOOM.n).fill(-1e9), at: Array.from({ length: BLOOM.n }, () => new THREE.Vector3()), rot: new Float32Array(BLOOM.n) };
    return blooms;
  }
  function updateBlooms(dt, t) {
    if (!items.has('pouch') && !blooms) return;
    const B = bloomPool();
    if (!B) return;
    // a new flower every few steps on the ground (not riding, not in a temple's rooms high over the world)
    if (items.has('pouch') && player.onGround && !player.riding && !player.inDark && !player.climbing) {
      walked += player.pos.distanceTo(lastStep) < 3 ? player.pos.distanceTo(lastStep) : 0;
      if (walked > BLOOM.every) {
        walked = 0;
        const i = bloomI++ % BLOOM.n;
        B.born[i] = t; B.rot[i] = Math.random() * 6.28;
        B.at[i].copy(player.pos).add(_bp.set((Math.random() - 0.5) * 0.5, 0.01, (Math.random() - 0.5) * 0.5));
      }
    }
    lastStep.copy(player.pos);
    let any = false;
    for (let i = 0; i < BLOOM.n; i++) {
      const age = t - B.born[i];
      if (age < 0 || age > BLOOM.life + 2) continue;
      const k = Math.min(1, age / 0.6) * Math.min(1, Math.max(0, (BLOOM.life + 2 - age) / 3));
      _bq.setFromAxisAngle(_by, B.rot[i]);
      B.mesh.setMatrixAt(i, _bm.compose(B.at[i], _bq, _bs.setScalar(Math.max(1e-3, k) * 1.6)));
      any = true;
    }
    if (any) B.mesh.instanceMatrix.needsUpdate = true;
  }

  return {
    ring,
    update(dt, t) {
      updateBlooms(dt, t);
      bellT = Math.max(0, bellT - dt);
      // the listening shell: what the makers hid nearby hums back now and then, softly
      if (items.has('shell') && player && !player.hidden && (shellT -= dt) <= 0) { shellT = 7; g.emit('bell', { pos: player.pos.clone(), reach: 45, soft: true }); }
      applyTank();   // (cheap; the tool may rebuild its reserve)
      const hasLantern = items.has('lantern'), hasMoss = items.has('moss');
      const night = (hasLantern || hasMoss) && (isNight() || !!player?.inDark);   // (inDark: a temple's dark rooms, src/temples/)
      if (lantern) {
        // hung on the tank itself, so it goes with it into a vehicle's socket (it was left floating by
        // your back); moved over only while the tank is on the back, where the two frames agree
        const tank = tool?.tank?.group;
        if (tank && lantern.grp.parent !== tank && (tool.where ?? 'back') === 'back' && tank.parent === H.chestAnchor) {
          H.chestAnchor.add(lantern.grp); lantern.grp.position.copy(LANTERN_AT);
          H.chestAnchor.updateWorldMatrix(true, true);
          tank.attach(lantern.grp);
        }
        lantern.grp.visible = hasLantern && player?.object?.visible !== false;
        lantern.paper.uniforms.uGlow.value = night && hasLantern ? 0.9 + 0.1 * Math.sin(t * 7) : 0.2;
        lantern.grp.rotation.z = Math.sin(t * 2.3) * 0.15;
      }
      if (night && player && !player.hidden) light.set(player.pos.x, player.pos.y + (hasLantern ? 1.2 : 0.6), player.pos.z, hasLantern ? 7.5 + Math.sin(t * 7) * 0.3 : 4.2 + Math.sin(t * 1.3) * 0.2);
      else light.set(0, -1e5, 0, 0);
      if (star) star.visible = items.has('star');
      if (player) { player.climbK = items.has('resin') ? 0.5 : 1; player.fallGuard = items.has('soles') ? 1.3 : 1; player.hush = items.has('hush'); player.breathK = items.has('reed') ? 2 : 1; player.sinkK = items.has('scarf') ? 0.6 : 1; }
    },
    dispose() { off(); keys?.removeEventListener?.('keydown', onKey); lantern?.grp.removeFromParent(); star?.removeFromParent(); blooms?.mesh.removeFromParent(); },
  };
}
