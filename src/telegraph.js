import * as THREE from 'three';
import { makeMaterial, releaseMaterial } from './materials.js';

// Body telegraphs (docs/systems/foes.md "Telegraphs: the body, not the floor"): every attack of every foe, world
// enemy and temple guardian is told by the body that makes it, never by a disc, a fan or a lane filled on the
// floor. A wind-up has four parts, all read from the attacker:
//
//   the pose     each attack's own: rear back, coil, raise, crouch, spin up (the models' anim; a guardian's
//                `rig` too). The pose is complete at POSE_DONE of the wind-up and then held still: the brief
//                stillness before the strike.
//   the glow     a spark gathering on the striking part (a claw, a foot, a jaw, a lens, a core: ChargeGlow), in
//                the attacker's tone, swelling and quickening, white-hot through the held stillness.
//   the sound    rising with the wind-up, over exactly its length (src/audio.js foeWarn / guardianWarn).
//   the eyes     orange through the wind-up (as before).
//
// The one exception: a lobbed or thrown projectile (a glob, a hurled chunk, a cog, a seed) keeps a landing mark
// on the ground where it will fall (`lob: true`), since the thrower's wind-up can't show where it lands.
// The hitbox overlay (src/hitboxes.js) still draws every zone, for debugging.

/** The share of a wind-up the pose takes to build; held still after it (the stillness before the strike). */
export const POSE_DONE = 0.75;

/**
 * Wind-up minimums (s, Normal; Gentle is TELL.slow × longer), by what the attack is (windClass):
 * a combo's follow-up (the first move was the tell) · a quarter heart's nip · an ordinary blow (half a heart) ·
 * a heavy one (three quarters or more, or a knock-down) · a guardian's own move · a guardian's combo link.
 * (v1.4's combat review flagged the hound's 0.60 s pounce as too short to read.)
 */
export const WIND_MIN = { chain: 0.4, light: 0.5, ordinary: 0.7, heavy: 0.95, guardian: 1.0, link: 0.6 };

/** What an attack is, for its wind-up's minimum. */
export function windClass(a) {
  if (a.chain) return 'chain';
  if ((a.damage ?? 0) >= 0.75 || a.knock || a.grab || a.tether) return 'heavy';
  if ((a.damage ?? 0) <= 0.25) return 'light';
  return 'ordinary';
}
/** The shortest wind-up attack a may have (a foe's or a world enemy's). */
export const windMin = (a) => WIND_MIN[windClass(a)];
/** A guardian's move: its own (≥ 1 s) or a link inside a combo (≥ 0.6 s; it follows a move already read). */
export const guardianWindMin = (a) => (a.link ? WIND_MIN.link : WIND_MIN.guardian);

/** Is this attack a projectile that may mark where it lands? Only lobbed or thrown ones (`lob`), at your feet. */
export const isProjectile = (a) => !!a?.lob && (a.at === 'target' || a.at === 'player' || a.motion === 'lob');
/** Is anything drawn on the ground for this attack while it winds up? Only a projectile's landing mark. */
export const groundMark = (a) => isProjectile(a);

/** Shared by everything that winds up: Gentle's slower wind-ups (src/foes.js sets it each frame from the setting). */
export const TELL = { slow: 1 };

const SPARK = new THREE.OctahedronGeometry(1, 0);
const RAY = new THREE.BoxGeometry(0.12, 0.12, 1);
const _c = new THREE.Color(), _w = new THREE.Color('#fff6d8');
let uid = 0;

/**
 * The glow building on the striking part: a spark of the attacker's tone that swells and spins faster as the
 * wind-up builds, and burns white through the stillness before the strike (k ≥ POSE_DONE). One per attacker.
 *   const g = new ChargeGlow(parent, tone, size); g.set(k, at, t); g.hide(); g.dispose()
 */
export class ChargeGlow {
  constructor(parent, tone = '#f05a3c', size = 0.32) {
    this.tone = new THREE.Color(tone); this.size = size;
    this.mat = makeMaterial({ color: tone, glow: 1, flat: true, key: `charge-glow.${uid++}` });
    this.group = new THREE.Group(); this.group.name = 'charge glow';
    this.core = new THREE.Mesh(SPARK, this.mat);
    this.rays = [0, 1, 2].map((i) => { const r = new THREE.Mesh(RAY, this.mat); r.rotation.set(i * 1.1, i * 2.1, 0); this.group.add(r); return r; });
    this.group.add(this.core);
    this.group.traverse((o) => { o.userData.noCollide = true; o.userData.dynamic = true; });
    this.group.visible = false;
    this.k = 0;
    parent.add(this.group);
  }
  /** k: the wind-up's progress 0..1 (≥ 1: the strike itself, a last flare); at: world point of the striking part. */
  set(k, at, t = performance.now() / 1000) {
    this.k = k;
    if (!(k > 0.02)) { this.hide(); return; }
    const held = k >= POSE_DONE, u = Math.min(1, k / POSE_DONE);
    const s = this.size * (0.25 + 0.75 * u) * (held ? 1.15 + 0.12 * Math.sin(t * 40) : 1 + 0.08 * Math.sin(t * (8 + 20 * u)));
    this.group.position.copy(at);
    this.group.scale.setScalar(s);
    this.group.rotation.y = t * (2 + 9 * u); this.group.rotation.x = t * 1.3;
    for (const r of this.rays) r.scale.z = 1.4 + 1.8 * u + (held ? 0.8 : 0);
    this.mat.uniforms.uColor.value.copy(_c.copy(this.tone).lerp(_w, held ? 0.85 : u * 0.45));
    this.mat.uniforms.uGlow.value = 0.6 + 0.4 * u;
    this.group.visible = true;
  }
  get visible() { return this.group.visible; }
  hide() { this.group.visible = false; this.k = 0; }
  dispose() { this.group.removeFromParent(); releaseMaterial(this.mat); }
}

/** The pose's progress through a wind-up (0..1 by POSE_DONE, then held). */
export const poseK = (k) => THREE.MathUtils.smoothstep(k, 0, POSE_DONE);
