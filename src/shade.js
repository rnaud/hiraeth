import * as THREE from 'three';
import { makeMaterial, releaseMaterial } from './materials.js';
import { buildCharacter } from './player.js';
import { Humanoid } from './humanoid.js';
import { Animator } from './animator.js';
import { Locomotion } from './locomotion.js';
import { Dots } from './fluid-tool.js';
import { Footprints } from './life.js';

// A shade's body (src/foes.js, kind 'shade'; docs/systems/foes.md, "The shade"): a person made of living
// shadow. The game's own skinned body and its animator (walks, and the Sword and Shield pack's attack as it
// strikes), dressed in the 'shadow' fluid (materials.js: near-black violet running down it in streaks, its
// feet melting into print dots, holes dripping down its body), two pale violet eyes, drops of shadow
// falling off it and dark pools left on the floor where it walks (a footprints decal: it darkens what it
// lands on, never inked).
//
//   const body = new ShadeBody(scene, { lib, human, pools })   (Foes makes one a shade; pools: shared ShadePools)
//   body.update(dt, foe)       after the foe's mind: walks where it went, strikes as it winds up and strikes
//   body.melt = 0..1           how much has run away (its coming and its going)

/** The strike from motion capture: the clip, its wind-up (start → the cut) and its follow-through. */
export const SHADE_STRIKE = { clip: 'mixamo_ss_attack_2', from: 0.1, cut: 0.55, to: 0.95 };
export const SHADE_TONES = ['#15121c', '#3b2a5c', '#6c4fa0'];
const UP = new THREE.Vector3(0, 1, 0);
let uid = 0;

/** The floor's pools and the falling drops, shared by every shade in a world. */
export class ShadePools {
  constructor(scene) {
    const blob = new THREE.Shape();
    for (let i = 0; i <= 14; i++) {
      const a = (i / 14) * Math.PI * 2, r = 0.22 * (1 + 0.25 * Math.sin(a * 3 + 1) + 0.15 * Math.sin(a * 5));
      if (i === 0) blob.moveTo(Math.cos(a) * r, Math.sin(a) * r); else blob.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    this.pools = new Footprints(scene, { count: 120, life: 9, depth: 0.32, geometry: new THREE.ShapeGeometry(blob, 3) });
    this.drops = new Dots(scene, 220, makeMaterial({ color: '#ffffff', flat: true, key: 'shade-drops' }));
  }
  update(dt) { this.pools.update(dt); this.drops.update(dt, UP); }
  dispose() { this.pools.mesh?.removeFromParent(); this.drops.mesh?.removeFromParent(); }
}

export class ShadeBody {
  constructor(scene, { lib, human, pools }) {
    this.scene = scene; this.pools = pools; this.melt = 1; this.time = Math.random() * 10; this.dripT = 0; this.poolT = 0;
    this.char = buildCharacter({});
    this.group = this.char.root;
    this.group.userData.noCollide = true;
    scene.add(this.group);
    this.humanoid = new Humanoid(human, this.char, 'm', { skin: '#15121c', build: 'average' });
    // its own material (its own time and melt), the shadow fluid on the skinned body
    this.mat = makeMaterial({ color: SHADE_TONES[0], fluid: 'shadow', fluidTones: SHADE_TONES, fluidBox: [0, 1.8, 0.3, 0], line: 0.5, lineTint: 0.6, key: `shade-${uid++}` });
    const eyes = makeMaterial({ color: '#c9a8ff', flat: true, glow: 0.95, key: 'shade-eyes' });
    this.humanoid.model.traverse((o) => {
      if (!o.isMesh) return;
      o.userData.dynamic = true; o.userData.noCollide = true;
      if (o === this.humanoid.eyeMesh) o.material = eyes;
      else if (o === this.humanoid.browMesh) o.visible = false;
      else o.material = this.mat;
    });
    this.animator = new Animator(lib, this.char);
    this.animator.bindBody(this.humanoid);
    this.loco = new Locomotion({ walk: 1.4, style: { lean: 0.8, bank: 0.8 } });
    this.last = null;
  }

  update(dt, f) {
    this.time += dt;
    const A = this.animator, N = A.lib.native ?? {};
    const speed = this.last && dt > 0 ? Math.hypot(f.pos.x - this.last.x, f.pos.z - this.last.z) / dt : 0;
    (this.last ??= new THREE.Vector3()).copy(f.pos);
    // its strike: the clip up to the cut as it winds up, on through the follow-through as it recovers
    const S = SHADE_STRIKE;
    if (f.state === 'wind') A.playUpper(S.clip, S.from + f.k * (S.cut - 0.16 - S.from), Math.min(1, f.k * 4));
    else if (f.state === 'strike') A.playUpper(S.clip, S.cut - 0.16 + f.k * 0.29, 1);
    else if (f.state === 'recover' && f._struck !== undefined) {
      f._struck += dt;
      const u = f._struck / 0.45;
      if (u < 1) A.playUpper(S.clip, S.cut + 0.13 + u * (S.to - S.cut - 0.13), 1 - u * u);
    }
    if (f.state === 'wind') f._struck = 0;
    A.update(dt, { speed, onGround: true, mode: 'ground', walkAt: (N.walk ?? 1.4) * 1.3, jogAt: N.jog ?? 3, sprintAt: (N.sprint ?? 6) * 1.2, strideScale: 1.05 });
    this.group.position.copy(f.pos);
    this.group.quaternion.setFromAxisAngle(UP, f.heading);
    A.apply(this.group, { legScale: 1.04 });
    this.loco.update(dt, { vf: speed, speed, heading: f.heading, ground: true });
    this.loco.pose(this.char);
    this.humanoid.update();
    // the shadow's flow, and how much of it has run away
    this.mat.uniforms.uFluidA.value.z = this.time;
    this.mat.uniforms.uFluidB.value.y = THREE.MathUtils.clamp(this.melt, 0, 1);
    // drops fall off it; where it walks, it leaves dark pools
    if (!this.pools) return;
    this.dripT -= dt; this.poolT -= dt;
    if (this.dripT <= 0) {
      this.dripT = 0.06;
      const a = Math.random() * Math.PI * 2, at = new THREE.Vector3(f.pos.x + Math.cos(a) * 0.22, f.pos.y + 0.4 + Math.random() * 1.2, f.pos.z + Math.sin(a) * 0.22);
      this.pools.drops.add({ pos: at, vel: new THREE.Vector3(0, -0.4, 0), grav: 9, size: 0.03 + Math.random() * 0.025, stretch: 2.5, life: 0.5, color: Math.random() < 0.8 ? SHADE_TONES[0] : SHADE_TONES[1] });
    }
    if (this.poolT <= 0 && (speed > 0.3 || Math.random() < 0.02)) {
      this.poolT = speed > 0.3 ? 0.28 : 0.8;
      this.pools.pools.add(new THREE.Vector3(f.pos.x + (Math.random() - 0.5) * 0.3, f.pos.y + 0.02, f.pos.z + (Math.random() - 0.5) * 0.3), Math.random() * Math.PI * 2, UP);
    }
  }

  dispose() { this.group.removeFromParent(); releaseMaterial(this.mat); }
}
