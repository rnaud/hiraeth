import * as THREE from 'three';
import { makeMaterial } from './materials.js';
import { flask } from './shop-kit.js';

// Potions a foe leaves now and then (v1.41, the author: "enemies sometimes drop potions"; docs/systems/items.md "Hearts,
// magic and potions"). On 'foe:burst' (src/foes.js) a roll (potionChance): more likely when you are hurt or have none,
// never with a full pack, never from a game's endless waves or a foe lost out of the world; and after `pity` foes with
// none, the next one surely. The potion pops up out of the foe and lands on the ground, the shop's corked red flask
// (src/shop-kit.js flask) twice its size, turning and bobbing over a small soft glow; walked over (`take` m) it goes
// into the pack (resources.addPotions); left `life` s, it fades.
//
//   const drops = new PotionDrops(scene, { groundAt, onTake })
//   drops.maybe(event, { hearts, max, potions, cap, infinite }) · drops.update(dt, playerPos) · drops.clear()

export const POTION_DROP = {
  chance: 0.1,      // a foe down, with nothing special
  hurt: 0.22,       // with half your hearts or fewer
  none: 0.1,        // more again with no potion left
  pity: 9,          // foes in a row with none: the next one drops one
  take: 1.2,        // m: walked over (flat, round the feet)
  life: 45,         // s on the ground before it fades (the last `fade`)
  fade: 3,
  size: 2.2,        // × the shop's flask
  pop: 4.2,         // m/s up out of the foe
  bob: 0.06,        // m
};

/**
 * The chance a foe leaves a potion (pure: tests): 0 when it can't (the pack full or endless, a game's waves, lost out of
 * the world), else POTION_DROP.chance, `hurt` with half your hearts or fewer, plus `none` with no potion left; 1 once
 * `since` foes went by with none (POTION_DROP.pity).
 */
export function potionChance({ hearts = 3, max = 3, potions = 0, cap = 5, infinite = false, waves = false, lost = false, since = 0 } = {}, D = POTION_DROP) {
  if (infinite || waves || lost || potions >= cap) return 0;
  if (since >= D.pity) return 1;
  return (hearts <= max / 2 ? D.hurt : D.chance) + (potions <= 0 ? D.none : 0);
}

const RED = '#d9503f', CORK = '#b07a45', GLOW = '#ffd9c2';

export class PotionDrops {
  constructor(parent, { groundAt = () => null, onTake = () => {}, rng = Math.random } = {}) {
    this.groundAt = groundAt; this.onTake = onTake; this.rng = rng;
    this.list = []; this.since = 0; this.time = 0;
    const F = flask(0, 0, 0, POTION_DROP.size);
    // (the shop's own materials: the same programs as its shelf, nothing new to compile)
    this.glassGeo = F.glass; this.corkGeo = F.cork;
    this.glassMat = makeMaterial({ color: RED, flat: true });
    this.corkMat = makeMaterial({ color: CORK, flat: true });
    this.glowGeo = new THREE.CircleGeometry(0.32, 16).rotateX(-Math.PI / 2);
    this.glowMat = makeMaterial({ color: GLOW, flat: true, glow: 1 });
    this.parent = parent;
  }

  /** A foe went down (the 'foe:burst' event): maybe a potion, by potionChance. Returns the drop or null. */
  maybe(e = {}, state = {}) {
    if (!e.pos || e.practice && state.noPractice) return null;
    const p = potionChance({ ...state, waves: !!e.waves, lost: !!e.lost, since: this.since });
    if (!(p > 0)) return null;
    if (this.rng() >= p) { this.since++; return null; }
    this.since = 0;
    return this.drop(e.pos);
  }

  /** A potion out of `pos`: it pops up and lands on the ground. */
  drop(pos) {
    const g = new THREE.Group();
    g.name = 'Potion drop';
    const glass = new THREE.Mesh(this.glassGeo, this.glassMat), cork = new THREE.Mesh(this.corkGeo, this.corkMat);
    const body = new THREE.Group(); body.add(glass, cork); g.add(body);
    const glow = new THREE.Mesh(this.glowGeo, this.glowMat); glow.renderOrder = 6; g.add(glow);
    g.traverse((o) => { o.userData.noCollide = true; o.userData.dynamic = true; });
    glow.userData.castShadow = false;
    const a = this.rng() * Math.PI * 2;
    const d = { g, body, glow, pos: pos.clone().setY(pos.y + 0.6), vel: new THREE.Vector3(Math.sin(a) * 1.2, POTION_DROP.pop, Math.cos(a) * 1.2), age: 0, landed: false, floor: null, spin: this.rng() * 6 };
    g.position.copy(d.pos);
    this.parent?.add(g);
    this.list.push(d);
    return d;
  }

  /** Per frame: the flight and landing, the bob and turn, the pick-up (player at `at`, or null), the fading. Returns those taken. */
  update(dt, at = null) {
    this.time += dt;
    const taken = [];
    for (const d of this.list) {
      d.age += dt;
      if (!d.landed) {
        d.floor ??= this.groundAt(d.pos.x, d.pos.y, d.pos.z) ?? d.pos.y - 0.6;
        d.vel.y -= 14 * dt;
        d.pos.addScaledVector(d.vel, dt);
        if (d.vel.y < 0 && d.pos.y <= d.floor) { d.pos.y = d.floor; d.landed = true; d.vel.set(0, 0, 0); }
      }
      const lift = d.landed ? 0.18 + POTION_DROP.bob * Math.sin(this.time * 2.6 + d.spin) : 0;
      d.g.position.copy(d.pos);
      d.body.position.y = lift;
      d.body.rotation.y = d.spin + this.time * 1.4;
      d.glow.position.y = 0.02;
      d.glow.visible = d.landed;
      const left = POTION_DROP.life - d.age, k = Math.min(1, Math.max(0, left / POTION_DROP.fade));
      d.g.scale.setScalar(Math.min(1, 0.3 + d.age * 4) * (left < POTION_DROP.fade ? k : 1));
      if (at && d.age > 0.35 && Math.hypot(at.x - d.pos.x, at.z - d.pos.z) < POTION_DROP.take && at.y > d.pos.y - 1 && at.y < d.pos.y + 1.8) { d.done = true; taken.push(d); }
      else if (left <= 0) d.done = true;
    }
    for (const d of this.list) if (d.done) d.g.removeFromParent();
    this.list = this.list.filter((d) => !d.done);
    for (const d of taken) this.onTake(d);
    return taken;
  }

  clear() { for (const d of this.list) d.g.removeFromParent(); this.list = []; }
}
