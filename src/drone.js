import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeMaterial } from './materials.js';
import { painted, paintMaterial } from './vehicle-kit.js';

// The scout drone's body, and the way it folds (src/scout.js flies it).
//
// A round little pod with one big eye, built like a seed that blooms: the
// lower half is the hull (ivory, a blue rim at the waist, a rubber foot under
// the belly, the lens on its face), the upper half is four shell petals on
// hinges round the rim. Folded, the petals close into a smooth dome over
// four small rotors tucked inside, the whip antenna drawn in until only its
// brass bead shows at the top: a compact egg that sits on its foot on the
// radio pack or the tank, eye shut. Unfolded, the petals swing out and down
// into four vanes (the rotors on their inner faces, now upright and spinning),
// the antenna springs up and the eye lights.
//
// Drone frame: +z the lens (forward), +y up, the origin the hull's centre.
// Everything is one skinned mesh (the paint, faceted colours, one draw call)
// on a dozen bones (the petals, the rotors, the antenna), and the lens its own
// small glowing mesh.

export const DRONE = {
  R: 0.095,             // hull radius
  squat: 0.82,          // the lower half's height, of R
  shell: 0.006,         // the petals' gap over the hull
  thick: 0.007,         // petal shell thickness
  petalW: 1.42,         // petal width (rad round the axis; four leave thin seams)
  apex: 0.17,           // the hole at the top the antenna comes through (rad from the axis)
  mount: 0.95,          // the rotors' place on each petal (rad from the axis)
  standoff: 0.02,       // rotor hub off the petal's inner face
  blade: 0.042,         // rotor radius
  eye: { el: -0.32, r: 0.036 },   // lens: elevation (rad, below the waist) and radius
  antenna: { base: 0.055, tip: 0.2 },   // rod from the inner dome to its bead (y), unfolded
  colors: { hull: '#91ab83', petal: '#f2e9ce', petalIn: '#bed2ad', rim: '#b49860', foot: '#4a4150',
    brass: '#e2b552', dark: '#3a3346', blade: '#4a4150', socket: '#2b2433', inner: '#e9dfbf', blur: '#eef3fb' },
};
const D = DRONE;
/** Belly: the drone's centre over the surface it rests on (the foot's underside). */
export const DRONE_BELLY = D.R * D.squat + 0.008;
/**
 * How the drone sits on its dock (the dock's rotation in its parent's frame,
 * a chest-like frame: +y up, +z forward, +x the wearer's left): on a flat top
 * (the radio pack), foot down; on the left side of something upright (the
 * tank), foot against it. Either way its lens looks back, away from you
 * (towards the camera behind you), and its top points away from the surface.
 */
export const DOCK_ON_TOP = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);
export const DOCK_ON_SIDE = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(
  new THREE.Vector3(0, 1, 0), new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 0, -1)));
/** The petals' unfolded angle: the rotor axes upright (π − mount). */
export const PETAL_OPEN = Math.PI - D.mount;
/** Petal azimuths: the diagonals, so the lens looks out between the two front ones. */
const AZ = [Math.PI / 4, -Math.PI / 4, (3 * Math.PI) / 4, (-3 * Math.PI) / 4];

const dirOf = (th, ph, out = new THREE.Vector3()) => out.set(Math.sin(th) * Math.sin(ph), Math.cos(th), Math.sin(th) * Math.cos(ph));

/** A patch of sphere (polar th0..th1 from +y, azimuth ph0..ph1 from +z), normals outward (or inward, wound to face in). */
function patch(r, th0, th1, ph0, ph1, nTh, nPh, inward = false) {
  const pos = [], nrm = [], idx = [], d = new THREE.Vector3();
  for (let i = 0; i <= nTh; i++) for (let j = 0; j <= nPh; j++) {
    dirOf(th0 + ((th1 - th0) * i) / nTh, ph0 + ((ph1 - ph0) * j) / nPh, d);
    pos.push(d.x * r, d.y * r, d.z * r);
    nrm.push(...(inward ? d.clone().negate() : d).toArray());
  }
  const at = (i, j) => i * (nPh + 1) + j;
  for (let i = 0; i < nTh; i++) for (let j = 0; j < nPh; j++) {
    const a = at(i, j), b = at(i + 1, j), c = at(i + 1, j + 1), e = at(i, j + 1);
    if (inward) idx.push(a, e, b, b, e, c); else idx.push(a, b, e, b, c, e);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  g.setIndex(idx);
  return g;
}
/** A thin strip closing a shell's edge between two radii along a curve of directions. */
function rim(r0, r1, dirs) {
  const pos = [], idx = [];
  for (const d of dirs) pos.push(...d.clone().multiplyScalar(r0).toArray(), ...d.clone().multiplyScalar(r1).toArray());
  for (let i = 0; i < dirs.length - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2, a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  const flat = g.toNonIndexed();   // both faces, each with its own normal
  flat.computeVertexNormals();
  return flat;
}
const basis = (x, y, z, p) => new THREE.Matrix4().makeBasis(x, y, z).setPosition(p);

/**
 * The fold, as a small state machine over three values: the eye (0 shut .. 1
 * open), the petals (0 closed .. 1 open) and the rotors (angle, speed).
 * Opening: the eye wakes, the petals bloom, the rotors spin up once the vanes
 * are out. Closing: the rotors spin down and stop with their blades along the
 * petals (so they fit inside), then the petals close, then the eye. It can
 * turn back at any point. state: 'folded' | 'unfolding' | 'open' | 'folding'.
 */
export const FOLD = { eye: 0.14, open: 0.4, close: 0.36, spinUp: 0.3, spinDown: 0.22, rpm: 42, spinAt: 0.55, park: 9 };
export class DroneFold {
  constructor() { this.snap(false); this.blinkIn = 2.5; this.blink = 0; }
  /** Jump straight to folded (false) or open (true), e.g. after a teleport. */
  snap(open) {
    this.want = open; this.eye = this.petals = open ? 1 : 0;
    this.rate = open ? FOLD.rpm : 0; this.spin = 0; this.parked = !open;
    this.state = open ? 'open' : 'folded';
  }
  /** Rotor blades along their petal (spin a multiple of π: a two-blade rotor). */
  get aligned() { const m = this.spin % Math.PI; return Math.min(m, Math.PI - m) < 1e-3; }
  /** open: bloom (or fold, false); awake: open the eye already, the petals still shut (a launch's first hop). */
  update(dt, open, awake = open) {
    this.want = open;
    if (dt <= 0) return this;
    if (awake && !open) this.eye = Math.min(1, this.eye + dt / FOLD.eye);
    if (open) {
      this.parked = false;
      this.eye = Math.min(1, this.eye + dt / FOLD.eye);
      if (this.eye > 0.5) this.petals = Math.min(1, this.petals + dt / FOLD.open);
      const goal = this.petals >= FOLD.spinAt ? FOLD.rpm : 0;
      this.rate = Math.min(goal, this.rate + (FOLD.rpm / FOLD.spinUp) * dt);
      this.spin += this.rate * dt;
      // now and then, a blink
      if ((this.blinkIn -= dt) <= 0) { this.blink = 0.16; this.blinkIn = 2.2 + ((this.spin * 7.3) % 3); }
    } else {
      // spin down, then turn on to the next blade-along-the-petal angle and stop there
      if (!this.parked) {
        this.rate = Math.max(0, this.rate - (FOLD.rpm / FOLD.spinDown) * dt);
        const speed = Math.max(this.rate, FOLD.park);
        const next = Math.ceil(this.spin / Math.PI - 1e-6) * Math.PI;
        if (this.rate <= FOLD.park && this.spin + speed * dt >= next) { this.spin = next % (2 * Math.PI); this.rate = 0; this.parked = true; }
        else this.spin += speed * dt;
      }
      if (this.parked) this.petals = Math.max(0, this.petals - dt / FOLD.close);
      if (this.petals < 0.35 && !awake) this.eye = Math.max(0, this.eye - dt / FOLD.eye);
    }
    this.blink = Math.max(0, this.blink - dt);
    this.state = open ? (this.petals >= 1 && this.rate >= FOLD.rpm ? 'open' : 'unfolding')
      : (this.petals <= 0 && this.rate <= 0 && (awake || this.eye <= 0) ? 'folded' : 'folding');
    return this;
  }
  /** How open the lens looks: shut while asleep, a quick squint on a blink. */
  get lid() { return this.eye * (this.blink > 0 ? Math.abs(this.blink - 0.08) / 0.08 : 1); }
}

const easeBloom = (k) => {
  // a bloom with a little overshoot at the end (easeOutBack), eased in at the start
  const c = 1.4, x = k - 1;
  return k <= 0 ? 0 : k >= 1 ? 1 : 1 + (c + 1) * x * x * x + c * x * x;
};

/** The drone: object (a Group to place), pose(fold) each frame, lens (the glowing mesh) and hull points. */
export class Drone {
  constructor() {
    const C = D.colors, R = D.R;
    this.object = new THREE.Group();
    this.object.name = 'Scout drone';
    const parts = [];
    const add = (geo, color, bone, m = null) => { if (m) geo.applyMatrix4(m); parts.push({ g: painted(geo, color), bone }); };
    // ---- bones: 0 the hull, 1-4 petals, 5-8 rotors, 9 the antenna's rod, 10 its bead, 11-14 the rotors' blur rings
    const bones = Array.from({ length: 15 }, () => new THREE.Bone());
    const [hull] = bones;
    this.hinges = AZ.map((ph, i) => {
      const o = new THREE.Vector3(Math.sin(ph), 0, Math.cos(ph));
      const at = o.clone().multiplyScalar(R + 0.004);
      const axis = new THREE.Vector3(0, 1, 0).cross(o).normalize();   // turns the petal's top outward and down
      const b = bones[1 + i]; b.position.copy(at); hull.add(b);
      return { o, at, axis, bone: b };
    });

    // ---- the hull: the lower half, squat, ivory
    const lower = patch(R, Math.PI / 2, Math.PI, 0, Math.PI * 2, 6, 20);
    lower.scale(1, D.squat, 1);
    add(lower, C.hull, 0);
    add(new THREE.TorusGeometry(R + 0.001, 0.009, 5, 28).rotateX(Math.PI / 2), C.rim, 0);                        // the rim at the waist
    add(new THREE.CylinderGeometry(R * 0.5, R * 0.42, 0.012, 16), C.foot, 0, new THREE.Matrix4().makeTranslation(0, -R * D.squat - 0.002, 0));   // the foot
    // the inner dome (seen when the petals are open), with a collar for the antenna
    add(patch(R * 0.6, 0, Math.PI / 2, 0, Math.PI * 2, 4, 16), C.inner, 0);
    add(new THREE.CylinderGeometry(0.012, 0.016, 0.014, 10), C.brass, 0, new THREE.Matrix4().makeTranslation(0, R * 0.6 + 0.004, 0));
    // the hinges' knuckles on the rim
    for (const h of this.hinges) add(new THREE.CylinderGeometry(0.008, 0.008, 0.03, 8).rotateZ(Math.PI / 2), C.brass, 0,
      basis(h.axis, new THREE.Vector3(0, 1, 0), h.o, h.at));
    // the eye: a brass bezel round a dark socket (the lens is its own mesh), a little brow over it
    const el = D.eye.el, eyeDir = new THREE.Vector3(0, Math.sin(el), Math.cos(el));
    const eyeUp = new THREE.Vector3(0, Math.cos(el), -Math.sin(el)), eyeX = new THREE.Vector3(1, 0, 0);
    const surf = R / Math.hypot(Math.cos(el), Math.sin(el) / D.squat);   // where the eye's ray leaves the squat hull
    const eyeAt = eyeDir.clone().multiplyScalar(surf * 0.97);
    const eyeM = basis(eyeX, eyeUp, eyeDir, eyeAt);
    add(new THREE.TorusGeometry(D.eye.r + 0.004, 0.008, 6, 22), C.brass, 0, eyeM.clone());
    add(new THREE.CircleGeometry(D.eye.r + 0.002, 20).translate(0, 0, -0.002), C.socket, 0, eyeM.clone());
    this.eye = { at: eyeAt, m: eyeM };

    // ---- the petals: outer shell (blue), inner face (pale), closed edges
    const th0 = D.apex, th1 = Math.PI / 2 - 0.02, ro = R + D.shell, ri = ro - D.thick;
    this.rotors = this.hinges.map((h, i) => {
      const ph = AZ[i], p0 = ph - D.petalW / 2, p1 = ph + D.petalW / 2, bone = 1 + i;
      add(patch(ro, th0, th1, p0, p1, 7, 8), C.petal, bone);
      add(patch(ri, th0, th1, p0, p1, 7, 8, true), C.petalIn, bone);
      const N = 8, edge = (th, ph) => dirOf(th, ph);
      add(rim(ri, ro, Array.from({ length: N + 1 }, (_, k) => edge(th0 + ((th1 - th0) * k) / N, p0))), C.petal, bone);
      add(rim(ri, ro, Array.from({ length: N + 1 }, (_, k) => edge(th0 + ((th1 - th0) * k) / N, p1))), C.petal, bone);
      add(rim(ri, ro, Array.from({ length: N + 1 }, (_, k) => edge(th0, p0 + ((p1 - p0) * k) / N))), C.petal, bone);
      add(rim(ri, ro, Array.from({ length: N + 1 }, (_, k) => edge(th1, p0 + ((p1 - p0) * k) / N))), C.petal, bone);
      // a brass stripe down the middle of each petal: reads as a vane's spar when open
      add(patch(ro + 0.0015, th0 + 0.08, th1 - 0.05, ph - 0.07, ph + 0.07, 5, 1), C.brass, bone);
      // the rotor on the inner face: blades along the petal when stopped (so they fit inside)
      const n = dirOf(D.mount, ph), y = n.clone().negate();
      const at = n.clone().multiplyScalar(ri - D.standoff);
      const z = new THREE.Vector3(Math.cos(D.mount) * Math.sin(ph), -Math.sin(D.mount), Math.cos(D.mount) * Math.cos(ph));   // down the meridian
      const x = new THREE.Vector3().crossVectors(y, z);
      const b = bones[5 + i];
      b.position.copy(at).sub(h.at);
      b.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
      h.bone.add(b);
      const rotM = basis(x, y, z, at);
      add(new THREE.CylinderGeometry(0.006, 0.006, D.standoff, 6).translate(0, -D.standoff / 2, 0), C.dark, bone, rotM.clone());   // mast
      add(new THREE.CylinderGeometry(0.011, 0.013, 0.012, 10), C.brass, 5 + i, rotM.clone());   // hub
      for (const s of [-1, 1]) {
        const blade = new THREE.BoxGeometry(0.015, 0.003, D.blade - 0.01).translate(0, 0.002, s * (D.blade / 2 + 0.004));
        blade.rotateZ(s * 0.25);   // a little pitch
        add(blade, C.blade, 5 + i, rotM.clone());
      }
      // the blur: a pale ring round the spinning blades, the way a drawing shows a rotor turning (shrunk into the hub when still)
      const blur = bones[11 + i];
      blur.position.copy(b.position); blur.quaternion.copy(b.quaternion); h.bone.add(blur);
      for (const flip of [false, true]) {
        const ring = new THREE.RingGeometry(D.blade * 0.78, D.blade + 0.003, 22, 1).rotateX(flip ? Math.PI / 2 : -Math.PI / 2).translate(0, 0.002, 0);
        add(ring, C.blur, 11 + i, rotM.clone());
      }
      return { bone: b, axis: new THREE.Vector3(0, 1, 0), rest: b.quaternion.clone(), blur };
    });

    // ---- the antenna: a rod drawn out of the inner dome, and its bead
    const A = D.antenna, rod = bones[9], bead = bones[10];
    rod.position.set(0, A.base, 0); hull.add(rod); hull.add(bead);
    add(new THREE.CylinderGeometry(0.0032, 0.004, A.tip - A.base, 5).translate(0, (A.tip - A.base) / 2, 0), C.dark, 9, new THREE.Matrix4().makeTranslation(0, A.base, 0));
    add(new THREE.SphereGeometry(0.011, 8, 6).translate(0, A.tip, 0), C.brass, 10);   // (authored where it is bound: the rod's tip)
    this.antenna = { rod, bead, spring: new THREE.Vector2(), vel: new THREE.Vector2() };

    // ---- one skinned mesh, bound in the folded pose
    for (const p of parts) {
      const n = p.g.attributes.position.count;
      p.g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(new Uint16Array(n * 4).map((_, k) => (k % 4 === 0 ? p.bone : 0)), 4));
      p.g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(new Float32Array(n * 4).map((_, k) => (k % 4 === 0 ? 1 : 0)), 4));
    }
    const geo = mergeGeometries(parts.map((p) => p.g));
    this.mesh = new THREE.SkinnedMesh(geo, paintMaterial({ smooth: true, glow: 0.18 }));
    this.mesh.frustumCulled = false;   // the petals reach past the folded bounds
    this.mesh.add(hull);
    bead.position.set(0, A.tip, 0);
    this.mesh.updateMatrixWorld(true);
    this.mesh.bind(new THREE.Skeleton(bones), new THREE.Matrix4());
    this.bones = bones;
    this.object.add(this.mesh);

    // ---- the lens: its own glowing dome in the socket (it squints shut when asleep)
    this.lens = new THREE.Mesh(new THREE.SphereGeometry(D.eye.r, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2).rotateX(Math.PI / 2).scale(1, 1, 0.45),
      makeMaterial({ color: '#70e7df', glow: 1, key: 'scout-lens' }));   // its own material: it dims and lights
    this.lens.position.copy(eyeAt); this.lens.quaternion.setFromRotationMatrix(eyeM);
    this.object.add(this.lens);
    for (const o of [this.mesh, this.lens]) { o.userData.noCollide = true; o.userData.dynamic = true; }
    this.lensLit = new THREE.Color('#70e7df'); this.lensDim = new THREE.Color('#2f5d69');
    this.fold = null;
    this.pose(new DroneFold());
  }

  /** The bones for this fold (and the antenna's sway: `lean`, a local sideways push in m/s²). */
  pose(fold, dt = 0, lean = null) {
    this.fold = fold;
    const a = PETAL_OPEN * easeBloom(fold.petals);
    for (const h of this.hinges) h.bone.quaternion.setFromAxisAngle(h.axis, a);
    const q = this._q ??= new THREE.Quaternion();
    const blur = THREE.MathUtils.smoothstep(fold.rate / FOLD.rpm, 0.45, 0.9);
    for (const r of this.rotors) {
      r.bone.quaternion.copy(r.rest).multiply(q.setFromAxisAngle(r.axis, fold.spin));
      r.blur.scale.setScalar(Math.max(blur, 1e-3));
    }
    // the antenna springs up with the petals (bead at the dome's top when folded), and sways
    const A = D.antenna, S = this.antenna;
    const top = D.R + D.shell + 0.006, len = (top - A.base) + (A.tip - top) * THREE.MathUtils.smoothstep(fold.petals, 0.25, 0.9);
    if (dt > 0) {
      const k = 120, c = 9;
      const fx = lean ? -lean.x * 0.004 : 0, fz = lean ? -lean.y * 0.004 : 0;
      S.vel.x += (fx - k * S.spring.x - c * S.vel.x) * dt; S.vel.y += (fz - k * S.spring.y - c * S.vel.y) * dt;
      S.spring.addScaledVector(S.vel, dt).clampScalar(-0.5, 0.5);
    }
    const sway = fold.petals;   // folded: held straight in its collar
    S.rod.rotation.set(S.spring.y * sway, 0, S.spring.x * sway);
    S.rod.scale.set(1, len / (A.tip - A.base), 1);
    S.rod.updateMatrix();
    S.bead.position.set(0, len, 0).applyQuaternion(S.rod.quaternion).add(S.rod.position);
    // the lens: shut to a thin slit asleep, lit as it wakes
    const lid = fold.lid;
    this.lens.scale.set(1, 0.08 + 0.92 * lid, 1);
    const u = this.lens.material.uniforms;
    u.uColor.value.copy(this.lensDim).lerp(this.lensLit, Math.min(1, fold.eye * 1.2));
    u.uGlow.value = 0.35 + 0.65 * fold.eye;
  }

  /** Points on the drone's surface in its own frame at the current pose (the tests' hull). */
  hull(step = 3) {
    this.mesh.updateMatrixWorld(true);
    this.mesh.skeleton.update();
    const out = [], n = this.mesh.geometry.attributes.position.count;
    for (let i = 0; i < n; i += step) out.push(this.mesh.getVertexPosition(i, new THREE.Vector3()));   // skinned, in the drone's frame
    return out;
  }
}
