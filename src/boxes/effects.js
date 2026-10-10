import * as THREE from 'three';
import { game as sharedGame } from '../game-state.js';
import { items } from '../items.js';
import { resources } from '../resources.js';
import { makeMaterial } from '../materials.js';
import { starShape, BOX_COLORS } from './model.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createEchoShell } from '../echo-shell.js';
import { hintsFor } from '../hint-level.js';

// What the boxes' special items do (src/items.js documents them). Kept cheap
// and from the outside: nothing here edits the tool or the player.
//
//   cell     the glass reservoir (once the fourth chamber): the magic bar is a unit longer (src/resources.js maxMagic → tool.reserve.max)
//   coil     the bar refills sooner and faster (src/resources.js magicPace → tool.reserve.delay, rate)
//   lantern  after dusk a little paper lantern glows on the tank and lights the ground
//   lens     unopened boxes show a pale column from afar (src/boxes/index.js reads it)
//   bell     V sounds a bell note; unopened boxes within 90 m answer (game event 'bell' { pos })
//   star     a pale enamel star on the overshirt's lapel (over the brow when a hood is up)
//   resin    climbing tires you half as fast (player.climbK)
//   soles    a hard landing counts as a slower one (player.fallGuard: the drop it takes to tumble grows by a third)
//   hush     creatures don't hear you walk up (player.hush: src/wildlife.js reads it)
//   moss     after dusk a soft light round your feet (smaller than the lantern's; the lantern wins)
//   pouch    small flowers come up in your footsteps where you walk, and fade a while later
//   reed     you hold your breath twice as long under water (player.breathK: src/swim.js reads it)
//   scarf    the fluid wings sink slower (player.sinkK: src/player.js's glide reads it)
//   shell    every few seconds, unopened boxes within 45 m answer softly, as if to the bell (game event 'bell' { soft })
//   echo     the echo shell (src/echo-shell.js) keeps the last makers' note sung near you; V (Y / △) plays it back
//            with the bell (ring())
//   level    the brass level: where down has turned (the Hangar's quarter and ring), a little level at the screen's
//            edge shows how the floor lies under the view
//   bloom    (the gun mode) where a bloom glob lands on the world, a few flowers come up (the seed pouch's pool)
//
//   const fx = createItemEffects({ player, tool, level, sound, isNight: () => bool });
//   fx.update(dt, t)   per frame

export const LANTERN_AT = new THREE.Vector3(0.225, 0.37, -0.3);   // the lantern off the flask's left stave, beside the rucksack, in the chest anchor's frame
/** The makers' star pinned to the coral lapel (chest-anchor frame). */
export const TRAVELLER_STAR = { at: new THREE.Vector3(-0.125, 0.61, 0.18), tilt: -0.12, scale: 0.55 };
/** The same on the game's traveller (TravellerV1: no outfit flag; its chest anchor sits lower): measured on its overshirt's left lapel. */
export const LAPEL_STAR = { at: new THREE.Vector3(-0.075, 0.62, 0.12), tilt: -0.12, scale: 0.55 };

export function createItemEffects({ player, tool = null, level = null, sound = null, camera = null, isNight = () => false, game: g = sharedGame, keys = typeof window !== 'undefined' ? window : null, toast = () => {} }) {
  const H = player?.humanoid;
  // ---- the tank upgrades
  const applyTank = () => {
    const R = tool?.reserve;
    if (!R) return;
    const max = resources.maxMagic, pace = resources.magicPace;
    if (R.max !== max) { const wasFull = R.level >= R.max - 1e-6; R.max = max; R.level = wasFull ? max : Math.min(R.level, max); }
    R.delay = pace.delay; R.rate = pace.rate;
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
  // ---- the star on the lapel (or the hood)
  let star = null;
  if (H?.headAnchor) {
    star = new THREE.Mesh(new THREE.ExtrudeGeometry(starShape(0.045, 0.015), { depth: 0.008, bevelEnabled: false }),
      makeMaterial({ color: BOX_COLORS.star, flat: true, glow: 0.3 }));
    star.userData.noCollide = true;
    star.visible = false;
    placeStar();
  }
  /**
   * On the hood's brow when the hood is up; with the traveller's bare head (his outfit, or the hood down),
   * the earned star belongs on his lapel. (Pinned to the brow with no hood there, it hung in the air in
   * front of his hair: every moment's close-up showed it; the cinematics QC pass.)
   */
  function placeStar() {
    if (!star) return;
    const hooded = !H.outfit && !!H.hood?.some((h) => h.isMesh && h.visible);   // (the hood's own shell: the goggles' group stays in the list)
    if (star.userData.hooded === hooded && star.parent) return;
    star.userData.hooded = hooded;
    if (hooded) { star.position.set(0, 0.17, 0.112); star.rotation.set(-0.5, 0, 0); star.scale.setScalar(1); }   // on the brow (the imported head: eyes at y 0.09, the crown at 0.23)
    else { const L = H.outfit ? TRAVELLER_STAR : LAPEL_STAR; star.position.copy(L.at); star.rotation.set(L.tilt, 0, 0); star.scale.setScalar(L.scale); }
    (hooded ? H.headAnchor : H.chestAnchor).add(star);
  }
  // ---- the bell (and the listening shell's soft hum); the echo shell plays back on the same button
  let bellT = 0, shellT = 3;
  const echo = createEchoShell({ player, game: g, items, sound, toast });
  const ring = () => {
    let rang = false;
    if (items.has('bell') && bellT <= 0 && player && !player.hidden) {
      bellT = 1.2;
      sound?.bell?.();
      g.emit('bell', { pos: player.pos.clone() });
      rang = true;
    }
    // (the shell answers a breath after the bell, so the two notes can be told apart)
    if (items.has('echo')) { if (rang) setTimeout(() => echo.play(), 450); else rang = echo.play(); }
    return rang;
  };
  const onKey = (e) => { if (e.code === 'KeyV' && !e.repeat && !(globalThis.document?.activeElement?.tagName === 'INPUT')) ring(); };
  keys?.addEventListener?.('keydown', onKey);
  const off = items.on((id, owned) => {
    applyTank();
    // (the box's card has just said how: these say it again, hints full only: src/hint-level.js)
    if (owned && id === 'bell' && hintsFor('tip')) setTimeout(() => toast('The bell-note whistle: sound it with {key:whistle}.'), 1800);
    if (owned && id === 'echo' && hintsFor('tip')) setTimeout(() => toast('The echo shell: let something sing near it, then play it back with {key:whistle}.'), 1800);
  });
  // ---- a bloom glob on the world: a few flowers come up where it landed (the pouch's pool)
  const offBloom = g.on?.('tool:bloom', ({ point } = {}) => {
    const B = point && bloomPool();
    if (!B) return;
    const t = clock;
    for (let k = 0; k < 5; k++) {
      const i = bloomI++ % BLOOM.n;
      B.born[i] = t; B.rot[i] = Math.random() * 6.28;
      B.at[i].copy(point).add(_bp.set((Math.random() - 0.5) * 1.1, 0.01, (Math.random() - 0.5) * 1.1));
    }
  });
  let clock = 0;
  // ---- the brass level: a little bubble level at the screen's edge where down has turned
  let levelEl = null, levelBar = null;
  const _lu = new THREE.Vector3(), _lr = new THREE.Vector3(), _lf = new THREE.Vector3();
  function updateLevel() {
    if (typeof document === 'undefined' || !document.body?.appendChild || !player?.frame?.up) return;
    const up = player.frame.up, on = items.has('level') && up.y < 0.95 && !player.hidden && !!camera;
    if (!levelEl && !on) return;
    if (!levelEl) {
      levelEl = document.createElement('div');
      levelEl.className = 'brass-level';
      levelEl.style.cssText = 'position:fixed;right:calc(18px + var(--safe-right, 0px));top:50%;width:54px;height:54px;margin-top:-27px;border-radius:50%;'
        + 'border:3px solid #b8862f;background:radial-gradient(circle at 40% 35%,#e9f3cf,#a9cf8e);box-shadow:2px 2px 0 #2b211f;z-index:20;pointer-events:none;overflow:hidden;opacity:0;transition:opacity .5s';
      levelBar = document.createElement('i');
      levelBar.style.cssText = 'position:absolute;left:-10px;right:-10px;top:50%;height:2px;margin-top:-1px;background:#2b211f;transform-origin:50% 50%';
      const bubble = document.createElement('b');
      bubble.style.cssText = 'position:absolute;left:50%;top:50%;width:12px;height:12px;margin:-6px;border-radius:50%;background:#fbf7e8;border:2px solid #2b211f';
      levelEl.appendChild(levelBar); levelEl.appendChild(bubble);
      document.body.appendChild(levelEl);
    }
    levelEl.style.opacity = on ? '0.9' : '0';
    if (!on) return;
    // the floor's line across the view: the camera's right and forward against the way up here
    camera.matrixWorld.extractBasis(_lr, _lu, _lf);
    const roll = Math.atan2(-_lr.dot(up), _lu.dot(up)), pitch = THREE.MathUtils.clamp(_lf.dot(up), -1, 1);
    levelBar.style.transform = `translateY(${(-pitch * 22).toFixed(1)}px) rotate(${(-roll * 180 / Math.PI).toFixed(1)}deg)`;
  }
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
    echo,
    update(dt, t) {
      clock = t;
      updateBlooms(dt, t);
      echo.update(dt);
      updateLevel();
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
      if (star) { star.visible = items.has('star'); if (star.visible) placeStar(); }
      if (player) { player.climbK = items.has('resin') ? 0.5 : 1; player.fallGuard = items.has('soles') ? 1.3 : 1; player.hush = items.has('hush'); player.breathK = items.has('reed') ? 2 : 1; player.sinkK = items.has('scarf') ? 0.6 : 1; }
    },
    dispose() { off(); offBloom?.(); echo.dispose(); levelEl?.remove?.(); keys?.removeEventListener?.('keydown', onKey); lantern?.grp.removeFromParent(); star?.removeFromParent(); blooms?.mesh.removeFromParent(); },
  };
}
