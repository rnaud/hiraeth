import * as THREE from 'three';
import { BELLS } from './hull.js';

// The ship's engines as seen from outside, for landing and take-off: a jet of
// flame out of each of the four lift jets under the belly, and where the jets hit
// the ground, dust blown flat out along it from under the ship (more the lower
// it is); a puff from under each foot as it touches down or lifts off.
//
// Everything comes from the ship's own parts (src/ship/hull.js): the bells at
// BELLS (THRUSTERS here), the feet where the legs stand. The ground under the ship is found
// from beneath the hull (Ship.floorAt), not from above, where the parked
// ship's own collider would be.

/** The bells' mouths (ship-local): the four lift jets under the belly, two forward, two aft. */
export const THRUSTERS = BELLS;
/** How high (m above the ground) the jets still raise dust. */
export const BLAST_H = 30;

const FIRE = ['#fff3c4', '#ffd27a', '#ff9a4a', '#f2c54b'];
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const _n = new THREE.Vector3(), _d = new THREE.Vector3(), _p = new THREE.Vector3(), _v = new THREE.Vector3(), _c = new THREE.Color();

/** How hard the jets blow on the ground from height h (m) at engine power 0..1: 0 above BLAST_H, 1 sitting on it. */
export function blast(h, power = 1) {
  if (!(h < BLAST_H) || power <= 0) return 0;
  return power * Math.pow(1 - Math.max(h, 0) / BLAST_H, 1.3);
}

/**
 * One frame of the engines: flame from each bell, dust where the jets meet the ground.
 * @param o { power 0..1, palette: the ground's colours for the dust, rate (puffs per second at full blast) }
 * @returns the strongest blast this frame (0..1)
 */
export function exhaust(ship, model, dt, { power = 1, palette, rate = 34 } = {}) {
  model.group.updateMatrixWorld();
  _d.set(0, -1, 0).applyQuaternion(model.group.quaternion);
  let most = 0;
  for (const local of THRUSTERS) {
    _n.copy(local).applyMatrix4(model.group.matrixWorld);
    // the jet: short-lived tongues of flame straight out of the bell
    if (power > 0.05) {
      for (let i = 0, m = rnd(dt * 26 * power); i < m; i++) {
        _p.copy(_n).addScaledVector(_d, 0.2 + Math.random() * 0.4).add(_v.set((Math.random() - 0.5) * 0.5, 0, (Math.random() - 0.5) * 0.5));
        ship.flame.emit(_p, _v.copy(_d).multiplyScalar(10 + Math.random() * 8 * power), 0.45 + Math.random() * 0.35 * power, 0.22 + Math.random() * 0.18, pick(FIRE));
      }
    }
    // the blast on the ground right under the bell, blown out flat along it
    const g = ship.floorAt(_n.x, _n.z);
    const q = blast(_n.y - g, power);
    most = Math.max(most, q);
    if (q <= 0.01 || !palette) continue;
    for (let i = 0, m = rnd(dt * rate * q); i < m; i++) {
      const a = Math.random() * Math.PI * 2, s = Math.sin(a), c = Math.cos(a);
      const r0 = 0.6 + Math.random() * (1.2 + (_n.y - g) * 0.08);   // a wider spot from higher up
      _p.set(_n.x + s * r0, 0, _n.z + c * r0);
      _p.y = ship.floorAt(_p.x, _p.z) + 0.35;
      const sp = 7 + 12 * q + Math.random() * 4;
      _v.set(s * sp, 0.6 + Math.random() * 1.6 * q, c * sp);
      ship.dust.emit(_p, _v, 0.4 + Math.random() * 0.5 + 0.65 * q, 1.4 + Math.random() * 0.8, _c.set(pick(palette)));
    }
  }
  return most;
}

/** A puff of dust from under each landing foot (touching down, lifting off). */
export function footPuffs(ship, model, { palette, n = 6, speed = 4 } = {}) {
  const feet = model.hull?.feet ?? [];
  if (!palette) return;
  model.group.updateMatrixWorld();
  for (const f of feet) {
    _n.copy(f).applyMatrix4(model.group.matrixWorld);
    const out = _d.set(_n.x - model.group.position.x, 0, _n.z - model.group.position.z).normalize();
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.random() * 0.5;
      _v.set(Math.sin(a), 0, Math.cos(a)).multiplyScalar(speed * (0.6 + Math.random() * 0.6)).addScaledVector(out, speed * 0.5);
      _v.y = 0.5 + Math.random();
      _p.set(_n.x + Math.sin(a) * 1.1, 0, _n.z + Math.cos(a) * 1.1);
      _p.y = ship.floorAt(_p.x, _p.z) + 0.25;
      ship.dust.emit(_p, _v, 0.45 + Math.random() * 0.35, 1.1 + Math.random() * 0.6, _c.set(pick(palette)));
    }
  }
}

/** A whole number of puffs for this frame from a fractional rate (the remainder by chance). */
function rnd(x) { const n = Math.floor(x); return n + (Math.random() < x - n ? 1 : 0); }

