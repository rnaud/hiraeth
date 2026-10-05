import * as THREE from 'three';
import { planetMaterial, planetLook, flatMaterial } from './approach.js';
import { TABLE } from './interior.js';

// The holo table in the middle of the deck (built in src/ship/interior.js):
// over its glass, a small planet turns, the world the ship is at right now
// (in the prologue, out in space: the planet it is falling toward). It is
// drawn the way the approach from space and the galactic map draw a world
// (src/ship/approach.js: its colours, its shadow crescent, its own mark),
// with a teal rim of light and two scan rings turning round it.
//
//   const t = new HoloTable(model, levelId);   // adds itself to the ship's group
//   t.update(dt, camera)                       // every frame: it turns, and faces the camera
//   t.power(state)                             // 'on' | 'emergency' | 'alarm' | 'dead' (Ship.setPower)

const TEAL = '#9fe0d6';

export class HoloTable {
  constructor(model, id) {
    this.id = id;
    const look = planetLook(id);
    const g = (this.group = new THREE.Group());
    g.name = 'holo-table';
    g.userData.noCollide = true;
    g.position.copy(model.interior.points.table);
    // the planet (a unit sphere, scaled) and what goes with it, in a frame that faces the camera
    const face = (this.face = new THREE.Group());
    face.scale.setScalar(TABLE.planetR);
    this.body = new THREE.Mesh(new THREE.SphereGeometry(1, 40, 28), planetMaterial(id));
    // (small on screen: fewer stripes, lighter lines, or it reads as a ball of ink)
    this.body.material.uniforms.uInkK.value = 0.6;
    this.body.material.uniforms.uFreq.value = 0.45;
    face.add(this.body);
    const rim = new THREE.Mesh(new THREE.RingGeometry(1.03, 1.1, 64), flatMaterial(TEAL));
    rim.position.z = -0.02;
    face.add(rim);
    if (look.mark === 'ring') {
      const ring = new THREE.Mesh(new THREE.RingGeometry(1.35, 1.62, 96), flatMaterial(look.ink));
      ring.rotation.set(-1.25, 0.2, -0.32);
      face.add(ring);
    }
    if (look.mark === 'moon') {
      const moon = new THREE.Mesh(new THREE.SphereGeometry(0.2, 24, 16), flatMaterial(look.ink));
      moon.position.set(1.05, 0.95, -0.6);
      face.add(moon);
    }
    g.add(face);
    // two thin scan rings, tipped, turning slowly round the planet
    const r = TABLE.planetR * 1.45, t1 = new THREE.TorusGeometry(r, 0.009, 4, 64).rotateX(Math.PI / 2 + 0.35);
    const t2 = new THREE.TorusGeometry(r * 1.12, 0.008, 4, 64).rotateX(Math.PI / 2 - 0.5).rotateZ(0.4);
    const rings = new THREE.BufferGeometry();
    {
      const a = t1.toNonIndexed(), b = t2.toNonIndexed();
      const pos = new Float32Array(a.attributes.position.count * 3 + b.attributes.position.count * 3);
      pos.set(a.attributes.position.array); pos.set(b.attributes.position.array, a.attributes.position.array.length);
      rings.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      rings.computeVertexNormals();
    }
    this.rings = new THREE.Mesh(rings, flatMaterial(TEAL));
    g.add(this.rings);
    g.traverse((o) => { o.userData.noCollide = true; });
    model.group.add(g);
    this.state = 'on';
    this.t = 0;
  }

  /** Everything drawn (for the ship's "only when near" list and its no-shadow list). */
  get object() { return this.group; }

  power(state) { this.state = state; }

  update(dt, camera) {
    this.t += dt;
    const st = this.state;
    // flickers on emergency power, stutters in the alarm, gone when the ship is dead
    const on = st === 'on' || (st === 'emergency' && Math.sin(this.t * 1.7) + Math.sin(this.t * 7.3) > -1.6) || (st === 'alarm' && Math.random() > 0.35);
    this.face.visible = this.rings.visible = on;
    if (!on || !this.group.parent?.visible) return;
    this.body.material.uniforms.uSpin.value += dt * 0.25;
    this.rings.rotation.y += dt * 0.4;
    if (camera) this.face.lookAt(camera.position);
  }
}
