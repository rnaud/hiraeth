import * as THREE from 'three';
import { makeMaterial } from './materials.js';

// The rider's clutter: a traveller who carries everything they own. Little
// inked objects strapped to the torso frame (y = 0 at the hips, 0.74 at the
// collar, +z forward): pouches and a canteen on the belt, a bedroll and a pot
// across the shoulders, charms on a bandolier, a lantern, a cup and bells that
// swing as you move.

const mats = new Map();
const METAL_OF = { '#d8a24a': 'brass' };   // the brass buckles, charms and studs (materials.js METALS)
const mat = (c) => { if (!mats.has(c)) mats.set(c, makeMaterial({ color: c, flat: true, ...(METAL_OF[c] ? { metal: METAL_OF[c] } : {}) })); return mats.get(c); };

const C = {
  leather: '#8a5a3c', dark: '#5a3a2c', brass: '#d8a24a', cream: '#efe2c8', red: '#c8483a',
  teal: '#5fb7ad', blue: '#34405e', clay: '#c8673f', green: '#6f8a42', bone: '#f2ead6',
};

/** Hang a group of meshes so it can swing about its top. */
function dangle(list, parent, pos, build) {
  const pivot = new THREE.Group();
  pivot.position.copy(pos);
  build(pivot);
  parent.add(pivot);
  list.push({ obj: pivot, ax: 0, az: 0, vx: 0, vz: 0, rest: pivot.rotation.clone() });
  return pivot;
}

const box = (w, h, d, c, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(c)); m.position.set(x, y, z); return m; };
const cyl = (r0, r1, h, c, x = 0, y = 0, z = 0, seg = 7) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r0, r1, h, seg), mat(c)); m.position.set(x, y, z); return m; };
const ball = (r, c, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 0), mat(c)); m.position.set(x, y, z); return m; };

/** Point on the belt: angle 0 = front, +PI/2 = the character's left. */
const onBelt = (a, y = 0.02, r = 0.19) => new THREE.Vector3(Math.sin(a) * r, y, Math.cos(a) * r);

export class Trinkets {
  constructor(anchor) {
    this.group = new THREE.Group();
    this.swing = [];
    const g = this.group, S = this.swing;
    // belt
    g.add(new THREE.Mesh(new THREE.TorusGeometry(0.175, 0.022, 4, 16).rotateX(Math.PI / 2).translate(0, 0.04, 0), mat(C.dark)));
    g.add(box(0.06, 0.05, 0.02, C.brass, 0, 0.04, 0.18));                                  // buckle
    // pouches round the front of the belt
    [[-1.0, C.leather], [-0.55, C.red], [0.5, C.teal], [0.95, C.leather], [1.35, C.dark]].forEach(([a, c], i) => {
      const p = onBelt(a, -0.02);
      const pouch = box(0.07 + (i % 2) * 0.02, 0.08, 0.045, c, p.x, p.y, p.z);
      pouch.rotation.y = a;
      g.add(pouch);
      const flap = box(0.075 + (i % 2) * 0.02, 0.02, 0.05, C.dark, p.x, p.y + 0.045, p.z);
      flap.rotation.y = a;
      g.add(flap);
    });
    // dangling from the belt: canteen, cup, keys, bells, a tiny bottle
    dangle(S, g, onBelt(-1.3, 0.0), (p) => { p.add(cyl(0.005, 0.005, 0.08, C.dark, 0, -0.04, 0)); p.add(cyl(0.045, 0.045, 0.11, C.blue, 0, -0.13, 0, 9)); p.add(cyl(0.015, 0.015, 0.03, C.brass, 0, -0.06, 0)); });
    dangle(S, g, onBelt(0.2, 0.0), (p) => { p.add(cyl(0.004, 0.004, 0.06, C.dark, 0, -0.03, 0)); p.add(cyl(0.028, 0.02, 0.04, C.brass, 0, -0.08, 0)); });
    dangle(S, g, onBelt(-0.25, 0.0), (p) => { p.add(cyl(0.003, 0.003, 0.09, C.dark, 0, -0.045, 0)); p.add(ball(0.018, C.brass, 0, -0.1, 0)); p.add(ball(0.014, C.brass, 0.02, -0.08, 0)); });
    dangle(S, g, onBelt(0.75, 0.0), (p) => { p.add(cyl(0.003, 0.003, 0.05, C.dark, 0, -0.025, 0)); p.add(cyl(0.016, 0.016, 0.06, C.green, 0, -0.08, 0)); p.add(cyl(0.007, 0.007, 0.02, C.cream, 0, -0.12, 0)); });
    dangle(S, g, onBelt(1.15, 0.0), (p) => { p.add(cyl(0.004, 0.004, 0.12, C.dark, 0, -0.06, 0)); p.add(box(0.05, 0.06, 0.05, C.brass, 0, -0.15, 0)); p.add(box(0.035, 0.04, 0.035, C.cream, 0, -0.15, 0)); });   // lantern
    // bandolier from the right shoulder to the left hip, with charms and a feather
    const band = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.62, 0.012), mat(C.leather));
    band.position.set(0.0, 0.42, 0.155); band.rotation.z = -0.62;
    g.add(band);
    for (let k = 0; k < 5; k++) {
      const t = (k + 0.5) / 5 - 0.5;
      const x = Math.sin(0.62) * t * 0.62, y = 0.42 - Math.cos(0.62) * t * 0.62;
      g.add([box(0.025, 0.035, 0.02, [C.brass, C.teal, C.red, C.bone, C.brass][k], x, y, 0.168), ball(0.015, C.bone, x, y, 0.17)][k % 2]);
    }
    dangle(S, g, new THREE.Vector3(-0.06, 0.6, 0.165), (p) => { const f = box(0.012, 0.11, 0.004, C.cream, 0, -0.06, 0); f.rotation.z = 0.2; p.add(f); p.add(box(0.004, 0.04, 0.006, C.red, 0.006, -0.01, 0)); });
    // a rolled bedroll across the shoulders, strapped, with a pot and a rolled map on top
    g.add(cyl(0.065, 0.065, 0.46, C.clay, 0, 0.83, -0.12, 9).rotateZ(Math.PI / 2));
    g.add(cyl(0.068, 0.068, 0.02, C.dark, -0.13, 0.83, -0.12, 9).rotateZ(Math.PI / 2));
    g.add(cyl(0.068, 0.068, 0.02, C.dark, 0.13, 0.83, -0.12, 9).rotateZ(Math.PI / 2));
    g.add(cyl(0.06, 0.05, 0.07, C.blue, 0.16, 0.93, -0.13, 9));                             // pot
    g.add(cyl(0.012, 0.012, 0.03, C.blue, 0.16, 0.975, -0.13));
    const map = cyl(0.022, 0.022, 0.3, C.cream, -0.1, 0.92, -0.14); map.rotation.z = Math.PI / 2 - 0.3; g.add(map);
    // a walking stick tucked behind, poking up past the shoulder with a little pennant
    const stick = cyl(0.012, 0.012, 1.15, C.dark, -0.2, 0.62, -0.17, 5); stick.rotation.z = 0.25; g.add(stick);
    dangle(S, g, new THREE.Vector3(-0.34, 1.16, -0.17), (p) => { p.add(box(0.11, 0.06, 0.005, C.red, -0.055, -0.03, 0)); });
    // a spoon and a little brush stuck in the bedroll straps
    const spoon = cyl(0.006, 0.006, 0.14, C.bone, 0.12, 0.9, -0.07, 4); spoon.rotation.x = -0.3; g.add(spoon);
    g.add(ball(0.016, C.bone, 0.12, 0.97, -0.09));
    anchor.add(g);
    g.traverse((o) => { o.userData.noCollide = true; });
  }

  /** Swing the hanging bits from the body's acceleration (in the anchor's frame) and the gait. */
  update(dt, accLocal, phase, moving) {
    for (const s of this.swing) {
      // a damped spring per item, kicked opposite to acceleration
      const kx = -accLocal.z * 0.02 + Math.sin(phase * 2 + s.rest.y) * 0.25 * moving;
      const kz = accLocal.x * 0.02 + Math.cos(phase + s.rest.x) * 0.15 * moving;
      s.vx += ((kx - s.ax) * 60 - s.vx * 6) * dt;
      s.vz += ((kz - s.az) * 60 - s.vz * 6) * dt;
      s.ax += s.vx * dt; s.az += s.vz * dt;
      s.obj.rotation.set(s.rest.x + s.ax, s.rest.y, s.rest.z + s.az);
    }
  }
}
