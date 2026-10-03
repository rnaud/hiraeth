import * as THREE from 'three';
import { makeMaterial } from './materials.js';

// The hero's kit, after the reference plate: a glass bubble helmet over a
// blue headset (ear cups, mic, a gadget cluster and little aerials at the
// back), a boxy blue radio pack with dials, a lens and a long whip antenna
// with a ball tip, cables looping down to a tan belt crowded with pouches,
// and a handheld device. Authored in the humanoid's anchor frames: the chest
// anchor (y = 0 at the hips, 0.74 at the collar, +z forward) and the head
// anchor (centre of the skull, +z = face).

const mats = new Map();
const mat = (c, o = {}) => { const k = c + JSON.stringify(o); if (!mats.has(k)) mats.set(k, makeMaterial({ color: c, flat: true, ...o })); return mats.get(k); };

export const GEAR_COLORS = {
  steel: '#86a9d8', steelDark: '#5f86bf', steelLight: '#b8d0ec', tan: '#c9a577', tanDark: '#a8794f',
  leather: '#b08a5a', brass: '#e2b552', glass: '#dcefff', screen: '#cfeef2', ink: '#2b211f', rubber: '#3a4466',
};
const G = GEAR_COLORS;

function mesh(geo, m, x = 0, y = 0, z = 0) {
  const o = new THREE.Mesh(geo, m);
  o.position.set(x, y, z);
  o.userData.noCollide = true;
  return o;
}
const box = (w, h, d, c, x, y, z) => mesh(new THREE.BoxGeometry(w, h, d), mat(c), x, y, z);
const cyl = (r0, r1, h, c, x, y, z, seg = 10) => mesh(new THREE.CylinderGeometry(r0, r1, h, seg), mat(c), x, y, z);
const tube = (pts, r, c) => mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p))), 24, r, 5), mat(c));

export class Gear {
  /** @param humanoid Humanoid (for its head / chest anchors and bones) */
  constructor(scene, humanoid, char) {
    this.h = humanoid;
    this.noShadow = [];
    this.springs = [];
    const chest = humanoid.chestAnchor, head = humanoid.headAnchor;
    // the old cloak collar isn't part of this outfit
    for (const o of chest.children) if (o.geometry?.type === 'TorusGeometry' && Math.abs(o.position.y - 0.74) < 0.02) o.visible = false;

    // ---------------------------------------------------------------- helmet + headset
    const hs = new THREE.Group();
    head.add(hs);
    const bubble = mesh(new THREE.SphereGeometry(0.205, 28, 20), makeMaterial({ color: G.glass, glass: true, glow: 0.35 }), 0, 0.015, 0.035);
    hs.add(bubble);
    this.noShadow.push(bubble);
    hs.add(mesh(new THREE.TorusGeometry(0.135, 0.026, 6, 22).rotateX(Math.PI / 2), mat(G.steelDark), 0, -0.165, 0.01));   // neck ring
    for (const sx of [-1, 1]) {
      const cup = cyl(0.058, 0.058, 0.045, G.steel, sx * 0.118, -0.005, -0.005, 14);
      cup.rotation.z = Math.PI / 2;
      hs.add(cup);
      const pad = cyl(0.036, 0.036, 0.02, G.rubber, sx * 0.145, -0.005, -0.005, 10);
      pad.rotation.z = Math.PI / 2;
      hs.add(pad);
    }
    hs.add(mesh(new THREE.TorusGeometry(0.125, 0.012, 5, 18, Math.PI), mat(G.steelDark), 0, 0.0, -0.01));            // headband
    hs.add(tube([[0.12, -0.03, 0.03], [0.1, -0.08, 0.1], [0.04, -0.075, 0.13]], 0.006, G.rubber));                   // mic boom
    hs.add(mesh(new THREE.SphereGeometry(0.014, 8, 6), mat(G.ink), 0.035, -0.075, 0.135));
    // gadget cluster at the back of the head
    hs.add(box(0.11, 0.09, 0.05, G.steel, 0, 0.03, -0.135));
    hs.add(box(0.05, 0.05, 0.03, G.steelDark, 0.045, 0.085, -0.13));
    hs.add(cyl(0.022, 0.022, 0.03, G.steelLight, -0.035, 0.03, -0.165, 10).rotateX(Math.PI / 2));
    hs.add(cyl(0.012, 0.012, 0.02, G.brass, 0.03, 0.02, -0.165, 8).rotateX(Math.PI / 2));
    hs.add(tube([[-0.05, 0.0, -0.13], [-0.1, -0.06, -0.08], [-0.11, -0.03, -0.02]], 0.006, G.rubber));
    hs.add(tube([[0.05, 0.0, -0.13], [0.09, -0.08, -0.1], [0.1, -0.15, -0.05]], 0.006, G.rubber));
    hs.add(cyl(0.004, 0.004, 0.2, G.ink, 0.02, 0.2, -0.13, 4));                                                     // aerials
    hs.add(mesh(new THREE.SphereGeometry(0.012, 8, 6), mat(G.brass), 0.02, 0.3, -0.13));
    hs.add(cyl(0.005, 0.005, 0.11, G.ink, 0.06, 0.15, -0.12, 4));

    // ---------------------------------------------------------------- radio pack
    const pack = new THREE.Group();
    chest.add(pack);
    this.scoutDock = new THREE.Object3D();
    this.scoutDock.position.set(0, 0.74, -0.29);
    pack.add(this.scoutDock);
    pack.add(box(0.34, 0.4, 0.2, G.steel, 0, 0.5, -0.27));
    pack.add(box(0.36, 0.06, 0.22, G.steelDark, 0, 0.3, -0.27));
    pack.add(box(0.12, 0.14, 0.03, G.steelDark, -0.08, 0.56, -0.385));
    pack.add(box(0.06, 0.04, 0.02, G.steelLight, 0.09, 0.64, -0.38));
    for (const [x, y, r, c] of [[0.07, 0.48, 0.05, G.steelLight], [-0.09, 0.42, 0.032, G.steelDark], [0.1, 0.38, 0.025, G.brass], [-0.02, 0.36, 0.02, G.steelLight]]) {
      pack.add(cyl(r, r, 0.03, c, x, y, -0.385, 14).rotateX(Math.PI / 2));
      pack.add(cyl(r * 0.45, r * 0.45, 0.035, G.ink, x, y, -0.392, 8).rotateX(Math.PI / 2));
    }
    // a lens ring on the side, like a little camera
    pack.add(mesh(new THREE.TorusGeometry(0.055, 0.016, 6, 16).rotateY(Math.PI / 2), mat(G.steelDark), 0.19, 0.42, -0.25));
    pack.add(cyl(0.04, 0.04, 0.02, G.screen, 0.19, 0.42, -0.25, 14).rotateZ(Math.PI / 2));
    // pipes over the top
    pack.add(tube([[-0.12, 0.7, -0.2], [-0.06, 0.8, -0.22], [0.04, 0.78, -0.24], [0.08, 0.7, -0.22]], 0.014, G.steelDark));
    pack.add(tube([[0.02, 0.7, -0.33], [0.08, 0.77, -0.33], [0.14, 0.72, -0.3]], 0.01, G.rubber));
    // shoulder straps, down the front to the belt
    for (const sx of [-1, 1]) {
      const s = box(0.045, 0.62, 0.014, G.tan, sx * 0.1, 0.42, 0.158);
      s.rotation.z = sx * 0.05;
      pack.add(s);
      pack.add(box(0.05, 0.03, 0.02, G.brass, sx * 0.1, 0.55, 0.16));
      pack.add(tube([[sx * 0.1, 0.74, 0.12], [sx * 0.12, 0.79, 0.0], [sx * 0.12, 0.72, -0.16]], 0.022, G.tan));
    }
    // cables from the pack down to the belt and one long loop by the leg
    pack.add(tube([[0.14, 0.32, -0.3], [0.21, 0.2, -0.2], [0.22, 0.05, -0.05], [0.18, 0.02, 0.08]], 0.009, G.rubber));
    pack.add(tube([[-0.1, 0.3, -0.33], [-0.2, 0.1, -0.25], [-0.27, -0.25, -0.1], [-0.25, -0.38, 0.0], [-0.2, -0.1, 0.12], [-0.12, 0.02, 0.17]], 0.008, G.steelDark));
    // the whip antenna: a chain of segments swinging on springs, ball at the tip
    {
      let parent = new THREE.Group();
      parent.position.set(0.13, 0.72, -0.33);
      parent.rotation.set(-0.12, 0, -0.1);
      pack.add(parent);
      pack.add(cyl(0.02, 0.025, 0.06, G.steelDark, 0.13, 0.73, -0.33, 8));
      const N = 7, L = 0.17;
      for (let i = 0; i < N; i++) {
        const seg = new THREE.Group();
        if (i > 0) seg.position.y = L;
        parent.add(seg);
        seg.add(cyl(0.006 - i * 0.0005, 0.007 - i * 0.0005, L, G.ink, 0, L / 2, 0, 4));
        this.springs.push({ obj: seg, ax: 0, az: 0, vx: 0, vz: 0, k: 1 + i * 0.4, rest: i ? 0.07 : 0 });   // a slight bend back
        parent = seg;
      }
      parent.add(mesh(new THREE.SphereGeometry(0.03, 10, 8), mat(G.brass, { glow: 0.3 }), 0, L, 0));
    }

    // ---------------------------------------------------------------- belt with pouches
    const belt = new THREE.Group();
    chest.add(belt);
    belt.add(mesh(new THREE.TorusGeometry(0.178, 0.026, 4, 18).rotateX(Math.PI / 2), mat(G.leather), 0, 0.03, 0));
    belt.add(box(0.06, 0.05, 0.02, G.brass, 0, 0.03, 0.185));
    const pouches = [[-1.15, 0.1, 0.12, G.tan], [-0.75, 0.12, 0.13, G.tan], [-0.35, 0.08, 0.1, G.tanDark], [0.4, 0.11, 0.11, G.tan],
      [0.8, 0.09, 0.13, G.tan], [1.2, 0.13, 0.12, G.tanDark], [1.75, 0.1, 0.1, G.tan], [-1.75, 0.08, 0.11, G.tan], [Math.PI, 0.12, 0.09, G.tanDark]];
    for (const [a, w, h, c] of pouches) {
      const r = 0.2, g = new THREE.Group();
      g.position.set(Math.sin(a) * r, 0.0, Math.cos(a) * r);
      g.rotation.y = a;
      g.add(box(w, h, 0.05, c, 0, -0.02, 0.0));
      g.add(box(w + 0.006, 0.03, 0.056, G.tanDark, 0, 0.035, 0.0));                 // flap
      g.add(box(0.014, 0.02, 0.01, G.brass, 0, 0.02, 0.03));                          // snap
      belt.add(g);
    }
    belt.add(tube([[0.18, -0.02, 0.1], [0.22, -0.12, 0.08], [0.2, -0.2, 0.04]], 0.008, G.rubber));   // a coiled lead
    // a dangling meter on a strap
    {
      const piv = new THREE.Group();
      piv.position.set(0.21, -0.02, -0.06);
      piv.add(cyl(0.004, 0.004, 0.1, G.leather, 0, -0.05, 0, 4));
      piv.add(box(0.05, 0.07, 0.03, G.steelDark, 0, -0.13, 0));
      piv.add(box(0.03, 0.02, 0.005, G.screen, 0, -0.12, 0.016));
      belt.add(piv);
      this.springs.push({ obj: piv, ax: 0, az: 0, vx: 0, vz: 0, k: 0.8, rest: 0, dangle: true });
    }

    // ---------------------------------------------------------------- handheld device (placed in the right hand each frame)
    const dev = new THREE.Group();
    dev.add(box(0.075, 0.13, 0.018, G.steel, 0, 0, 0));
    dev.add(mesh(new THREE.BoxGeometry(0.058, 0.09, 0.004), makeMaterial({ color: G.screen, flat: true, glow: 0.45 }), 0, 0.012, 0.0105));
    dev.add(cyl(0.004, 0.004, 0.06, G.ink, 0.028, 0.09, -0.004, 4));
    dev.traverse((o) => { o.userData.noCollide = true; });
    scene.add(dev);
    this.device = dev;

    for (const g of [hs, pack, belt]) g.traverse((o) => { o.userData.noCollide = true; });
    this.char = char;
  }

  /** Swing the antenna and the dangling meter; place the device in the right hand. */
  update(dt, accLocal, phase, moving, visible) {
    for (const s of this.springs) {
      const kx = (-accLocal.z * 0.012 + Math.sin(phase * 2) * 0.08 * moving) * s.k;
      const kz = (accLocal.x * 0.012 + Math.cos(phase) * 0.05 * moving) * s.k;
      s.vx += ((kx - s.ax) * 90 - s.vx * 7) * dt;
      s.vz += ((kz - s.az) * 90 - s.vz * 7) * dt;
      s.ax += s.vx * dt; s.az += s.vz * dt;
      s.obj.rotation.set(s.rest + s.ax, 0, s.az);
    }
    const B = this.h.b, hand = B.hand_r, fore = B.lowerarm_r;
    this.device.visible = visible;
    if (!hand || !visible) return;
    // held in the fist: long edge along the forearm, screen facing back up the arm towards the eyes
    const hp = hand.getWorldPosition(_a), fp = fore.getWorldPosition(_b);
    const along = _c.subVectors(hp, fp).normalize();
    const head = B.Head.getWorldPosition(_d);
    const toEye = _e.subVectors(head, hp).normalize();
    const side = _f.crossVectors(along, toEye).normalize();
    const normal = _g.crossVectors(side, along).normalize();
    _m.makeBasis(side, along, normal);
    this.device.quaternion.setFromRotationMatrix(_m);
    this.device.position.copy(hp).addScaledVector(along, 0.06).addScaledVector(normal, 0.02);
  }
}

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _d = new THREE.Vector3(), _e = new THREE.Vector3(), _f = new THREE.Vector3(), _g = new THREE.Vector3();
const _m = new THREE.Matrix4();
