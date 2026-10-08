import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeMaterial, MODE_STRATA } from '../materials.js';
import { registerTarget } from '../targets.js';
import { buildItemModel } from '../boxes/model.js';
import { thinPole } from '../thin.js';
import { tagMetal } from './metal.js';

// The Gadget Yard's building kit (src/levels/gadget-yard.js; docs/systems/gadgets.md, "The Gadget Yard"):
// blocks to climb and stand on, anchor rings, cracked walls and boulders, crates and metal crates, floor
// plates and gates, hit targets, lamps, a pen of foes. Each gadget's `yard(kit)` gets a kit for its own bay
// (a patch of the yard about 14 m across, its local +z toward the middle of the yard, -z away, x across,
// y up from the ground) and places what it needs to be tried with; what moves or breaks is collected into
// the level's `gadgetYard` (src/gadgets/world.js adopts it), what is hit into `level.targets`.
//
//   const yard = new YardKit(scene)          (the level's builder)
//   const kit = yard.bay(origin, yaw)        a bay's kit: block, anchor, cracked, crate, plate, gate, target, lamp, pole, steps, pen, flag
//   yard.out()                               → { gadgetYard, targets }

/** Kept out of the level's baked collision (a moving or breaking thing brings its own: src/gadgets/world.js). */
const loose = (o) => { o.traverse((m) => { m.userData.noCollide = true; }); return o; };
const v3 = (a) => (a?.isVector3 ? a.clone() : new THREE.Vector3(...a));

export class YardKit {
  constructor(scene) {
    this.scene = scene;
    this.spec = { props: [], breakables: [], anchors: [], plates: [], gates: [], ropes: [], pickups: [], pen: null };
    this.targets = [];
    this.flammables = [];   // (src/flammable.js: lanterns an ember lights)
    const M = (o) => makeMaterial({ flat: false, ...o });
    this.mats = {
      stone: M({ color: '#c9b79a', color2: '#b7a385', color3: '#a08d70', mode: MODE_STRATA, strataSize: 0.9 }),
      pale: M({ color: '#e6d7b8', color2: '#d9c7a3', color3: '#c2ad88', mode: MODE_STRATA, strataSize: 1.4 }),
      cracked: M({ color: '#d8b98e', color2: '#c9a479', color3: '#b38b62', mode: MODE_STRATA, strataSize: 0.6, cracks: 1 }),
      crack: makeMaterial({ color: '#2b211f', flat: true }),
      wood: makeMaterial({ color: '#c98f55', flat: true }),
      woodDark: makeMaterial({ color: '#8a5a34', flat: true }),
      metal: makeMaterial({ color: '#7f8a96', flat: true, metal: 'steel' }),
      rivet: makeMaterial({ color: '#4c545e', flat: true }),
      brass: makeMaterial({ color: '#d6a94a', flat: true, metal: 'brass' }),
      red: makeMaterial({ color: '#c8483a', flat: true }),
      ink: makeMaterial({ color: '#2b211f', flat: true }),
      paper: makeMaterial({ color: '#f3e7cc', flat: true }),
      lampOff: makeMaterial({ color: '#8d8371', flat: true }),
      lampOn: makeMaterial({ color: '#ffe9a8', flat: true, glow: 1 }),
      plate: makeMaterial({ color: '#7d6b54', flat: true }),
      teal: makeMaterial({ color: '#4fa3a5', flat: true }),
      iron: makeMaterial({ color: '#5d6672', flat: true, metal: 'iron' }),
      rope: makeMaterial({ color: '#c9a66b', flat: true, thin: 1.6 }),
      inkPot: makeMaterial({ color: '#2f3456', flat: true }),
    };
    this.bays = [];
  }

  /** A bay's kit at `origin` (on the ground), turned by `yaw` about up (its local -z faces away from the yard's middle). */
  bay(origin, yaw = 0) {
    const g = new THREE.Group();
    g.position.copy(v3(origin)); g.rotation.y = yaw;
    g.updateMatrixWorld(true);
    this.scene.add(g);
    const kit = new BayKit(this, g);
    this.bays.push(kit);
    return kit;
  }

  out() { return { gadgetYard: this.spec, targets: this.targets, flammables: this.flammables }; }
}

class BayKit {
  constructor(yard, group) { this.yard = yard; this.group = group; this.mats = yard.mats; this.spec = yard.spec; }
  /** Local → world. */
  at(p) { return this.group.localToWorld(v3(p)); }
  dir(d) { return v3(d).applyQuaternion(this.group.quaternion).normalize(); }
  add(mesh) { this.group.add(mesh); mesh.updateMatrixWorld(true); return mesh; }

  /** A solid block, size [w, h, d] centred at `c` (local). */
  block(size, c, { mat = 'stone', yaw = 0 } = {}) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(...size), this.mats[mat] ?? mat);
    m.position.copy(v3(c)); m.rotation.y = yaw;
    return this.add(m);
  }
  /** A flight of steps up to `height` from `at` (local), going toward -z. */
  steps(at, height, { width = 2, rise = 0.5, run = 0.7, yaw = 0, mat = 'pale' } = {}) {
    const n = Math.ceil(height / rise), base = v3(at), parts = [];
    for (let i = 0; i < n; i++) parts.push(new THREE.BoxGeometry(width, rise * (i + 1), run).translate(0, rise * (i + 1) / 2, -i * run).toNonIndexed());
    const m = new THREE.Mesh(mergeGeometries(parts), this.mats[mat]);
    m.position.copy(base); m.rotation.y = yaw;
    return this.add(m);
  }
  /** A tall pole with a small platform on top (local `at` on the ground). */
  pole(at, height) {
    const g = new THREE.Group(); g.position.copy(v3(at));
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.32, height, 10).translate(0, height / 2, 0), this.mats.pale));
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(1.1, 0.8, 0.35, 14).translate(0, height - 0.17, 0), this.mats.stone));
    return this.add(g);
  }
  /** An anchor ring the hook finds (aim assist), at `p` facing `normal` (local). */
  anchor(p, { normal = [0, 0, 1] } = {}) {
    const n = v3(normal).normalize(), g = new THREE.Group();
    g.position.copy(v3(p));
    g.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), n);
    g.add(new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.07, 8, 20), this.mats.brass));
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.3, 8).rotateX(Math.PI / 2).translate(0, 0, -0.15), this.mats.ink));
    g.add(new THREE.Mesh(new THREE.CircleGeometry(0.18, 12).translate(0, 0, 0.01), this.mats.red));
    g.traverse((o) => { o.userData.noCollide = true; });
    this.add(g);
    this.spec.anchors.push({ pos: this.at(p), normal: this.dir(n), radius: 0.4 });
    return g;
  }
  /** A cracked wall (or `shape: 'boulder'`): size [w, h, d] centred at `c` (local); a blast breaks it, it grows back after `regrow` s. */
  cracked(size, c, { shape = 'wall', regrow = 12, yaw = 0 } = {}) {
    const [w, h, d] = size, g = new THREE.Group();
    g.position.copy(v3(c)); g.rotation.y = yaw;
    const body = shape === 'boulder' ? new THREE.DodecahedronGeometry(Math.min(w, h, d) * 0.55, 1).scale(w / Math.min(w, h, d), h / Math.min(w, h, d), d / Math.min(w, h, d)) : new THREE.BoxGeometry(w, h, d);
    g.add(new THREE.Mesh(body, this.mats.cracked));
    // the cracks, drawn in ink across both faces: zigzags from the middle out (they read from far off)
    const parts = [];
    let seed = Math.round(w * 13 + h * 7 + d * 3);
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (const side of [1, -1]) {
      for (let k = 0; k < 5; k++) {
        let x = (rnd() - 0.5) * w * 0.2, y = (rnd() - 0.5) * h * 0.2;
        const a0 = (k / 5) * Math.PI * 2 + rnd();
        for (let s = 0; s < 4; s++) {
          const a = a0 + (rnd() - 0.5) * 1.1, L = Math.min(w, h) * (0.12 + rnd() * 0.1);
          const nx = x + Math.cos(a) * L, ny = y + Math.sin(a) * L;
          if (Math.abs(nx) > w / 2 - 0.05 || Math.abs(ny) > h / 2 - 0.05) break;
          const seg = new THREE.BoxGeometry(L + 0.04, 0.05 + 0.03 * (3 - s) / 3, 0.03).rotateZ(a).translate((x + nx) / 2, (y + ny) / 2, side * (d / 2 + (shape === 'boulder' ? 0.12 : 0.012)));
          parts.push(seg.toNonIndexed()); x = nx; y = ny;
        }
      }
    }
    if (parts.length) g.add(new THREE.Mesh(mergeGeometries(parts), this.mats.crack));
    loose(g);   // (its collision is its own, added and taken away as it breaks: world.js)
    this.add(g);
    this.spec.breakables.push({ object: g, center: this.at(c), radius: Math.max(w, h, d) / 2, regrow, color: '#c9a479' });
    return g;
  }
  /** A loose crate at `c` (local centre; it sits half its size above its footing), `metal` a heavy steel one. */
  crate(c, { metal = false, size = metal ? 1 : 0.9 } = {}) {
    const g = new THREE.Group(), s = size, M = this.mats;
    g.add(new THREE.Mesh(new THREE.BoxGeometry(s, s, s), metal ? M.metal : M.wood));
    // its frame: the edges in a darker tone (wood: planks; steel: bands and rivets)
    const e = s * 0.09, parts = [];
    for (const [ax, ay] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      parts.push(new THREE.BoxGeometry(s + 0.02, e, e).translate(0, ay * (s / 2 - e / 2), ax * (s / 2 - e / 2) + ax * 0.012));
      parts.push(new THREE.BoxGeometry(e, s + 0.02, e).translate(ax * (s / 2 - e / 2) + ax * 0.012, 0, ay * (s / 2 - e / 2) + ay * 0.012));
      parts.push(new THREE.BoxGeometry(e, e, s + 0.02).translate(ax * (s / 2 - e / 2) + ax * 0.012, ay * (s / 2 - e / 2), 0));
    }
    if (!metal) for (const z of [1, -1]) parts.push(new THREE.BoxGeometry(s * 1.05, e * 0.8, e * 0.6).rotateZ(Math.PI / 4).scale(0.95, 1, 1).translate(0, 0, z * (s / 2 + 0.01)));
    g.add(new THREE.Mesh(mergeGeometries(parts.map((p) => p.toNonIndexed())), metal ? M.rivet : M.woodDark));
    loose(g);   // (its collision moves with it: world.js addMover)
    g.position.copy(this.at(c));
    g.rotation.y = this.group.rotation.y + (metal ? 0 : 0.2);
    this.yard.scene.add(g);
    this.spec.props.push({ object: g, r: s * 0.62, h: s / 2, mass: metal ? 4 : 1, metal, light: !metal, kind: metal ? 'metal crate' : 'crate' });
    return g;
  }
  /** A floor plate (local `at` on the ground, radius r): pressed by the traveller (unless `things`: only by a thing of `mass` or more) or a crate. Returns its index. */
  plate(at, { radius = 0.9, mass = 1, things = false } = {}) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius * 1.05, 0.16, 20), this.mats.plate);
    m.position.copy(v3(at)).add(new THREE.Vector3(0, 0.08, 0));
    m.userData.noCollide = true;
    this.add(m);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(radius * 0.7, 0.04, 4, 24).rotateX(Math.PI / 2).translate(0, 0.17, 0), this.mats.teal);
    ring.userData.noCollide = true; m.add(ring);
    const w = this.at(at);
    this.spec.plates.push({ pos: w, radius, mass, things, object: null });
    return this.spec.plates.length - 1;
  }
  /** Bars across an opening (size [w, h, d] centred at `c`), sinking into the ground while any of `plates` is pressed. */
  gate(size, c, { plates = [] } = {}) {
    const [w, h, d] = size, g = new THREE.Group(), parts = [];
    for (let x = -w / 2 + 0.2; x <= w / 2 - 0.15; x += 0.42) parts.push(new THREE.CylinderGeometry(0.07, 0.07, h, 6).translate(x, 0, 0).toNonIndexed());
    parts.push(new THREE.BoxGeometry(w, 0.18, d).translate(0, h / 2 - 0.09, 0).toNonIndexed(), new THREE.BoxGeometry(w, 0.18, d).translate(0, -h / 2 + 0.3, 0).toNonIndexed());
    g.add(new THREE.Mesh(mergeGeometries(parts), this.mats.metal));
    loose(g);
    g.position.copy(v3(c));
    this.add(g);
    this.spec.gates.push({ object: g, travel: h - 0.05, plates });
    return g;
  }
  /** A round target on a post (local `at` on the ground): anything that hits it (fluid, hook, a blast) flips it and lights its lamp. */
  target(at, { height = 1.8 } = {}) {
    const g = new THREE.Group(); g.position.copy(v3(at));
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, height, 8).translate(0, height / 2, 0), this.mats.woodDark));
    const face = new THREE.Group(); face.position.y = height + 0.35;
    face.add(new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.08, 20).rotateX(Math.PI / 2), this.mats.paper));
    face.add(new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.05, 4, 20).translate(0, 0, 0.045), this.mats.red));
    const eye = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.1, 12).rotateX(Math.PI / 2), this.mats.lampOff);
    face.add(eye);
    g.add(face);
    this.add(g);
    const world = this.at([at[0], height + 0.35, at[2]]);
    const state = { lit: false, spin: 0 };
    this.yard.targets.push({ kind: 'switch', radius: 0.5, position: () => world,
      accepts: ['stun', 'fire', 'bloom'],
      onHit: () => { state.lit = !state.lit; eye.material = state.lit ? this.mats.lampOn : this.mats.lampOff; face.rotation.y += Math.PI; return true; } });
    return g;
  }
  /** A lamp on a short post (lit; a sign of something behind a wall). */
  lamp(at) {
    const g = new THREE.Group(); g.position.copy(v3(at));
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 1.3, 8).translate(0, 0.65, 0), this.mats.ink));
    g.add(new THREE.Mesh(new THREE.IcosahedronGeometry(0.26, 1).translate(0, 1.5, 0), this.mats.lampOn));
    return this.add(g);
  }
  /** A pen of `count` foes (ink blots), low walls round a square of half-side r at local `c`. */
  pen(c, r, count = 3) {
    const h = 1.35, t = 0.35;
    for (const [x, z, w, d] of [[0, -r, 2 * r + t, t], [0, r, 2 * r + t, t], [-r, 0, t, 2 * r], [r, 0, t, 2 * r]]) this.block([w, h, d], [c[0] + x, h / 2, c[2] + z], { mat: 'pale' });
    this.spec.pen = { center: this.at(c), r, count };
  }
  /** A crate hung on a rope from `top` (local) `length` m down: cut the rope (the boomerang, the blade) and it falls. */
  rope(top, { length = 2.5, metal = false } = {}) {
    const t = v3(top), crate = this.crate([t.x, t.y - length - 0.45, t.z], { metal });
    const m = new THREE.Mesh(thinPole(new THREE.CylinderGeometry(0.035, 0.035, 1, 5, 1, true).translate(0, -0.5, 0)), this.mats.rope);
    m.frustumCulled = false;
    loose(m); this.yard.scene.add(m);
    this.spec.ropes.push({ object: m, top: this.at(top), length, prop: this.spec.props.length - 1 });
    return m;
  }
  /** A small pot of the makers' ink to pick up (local `at` on the ground: it floats a little above). */
  pickup(at, { amount = 1 } = {}) {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.3, 10), this.mats.inkPot));
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.08, 10).translate(0, 0.19, 0), this.mats.brass));
    g.add(new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.025, 4, 16).rotateX(Math.PI / 2).translate(0, -0.02, 0), this.mats.paper));
    loose(g);
    const w = this.at([at[0], (at[1] ?? 0) + 0.7, at[2]]);
    g.position.copy(w); this.yard.scene.add(g);
    this.spec.pickups.push({ object: g, pos: w, kind: 'ink', amount });
    return g;
  }
  /** A lantern on a post, unlit: an ember (the fluid tool's fire, or a boomerang carrying it) lights it (src/flammable.js). */
  lantern(at, { height = 2.2 } = {}) {
    const g = new THREE.Group(); g.position.copy(v3(at));
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, height, 8).translate(0, height / 2, 0), this.mats.ink));
    g.add(new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.06, 0.06).translate(0.25, height - 0.05, 0), this.mats.ink));
    const cage = new THREE.Group(); cage.position.set(0.5, height - 0.45, 0);
    cage.add(new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.42, 6), this.mats.lampOff));
    cage.add(new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.16, 6).translate(0, 0.29, 0), this.mats.iron));
    g.add(cage);
    this.add(g);
    this.yard.flammables.push({ at: this.at([at[0] + 0.5, height - 0.45, at[2]]), kind: 'lantern', r: 0.6, top: 0.3 });
    return g;
  }
  /** A heavy block of iron fixed in place (size [w, h, d] centred at `c`): the magnet pulls you to it (src/gadgets/metal.js). */
  ironBlock(size, c, { yaw = 0 } = {}) {
    const m = this.block(size, c, { mat: 'iron', yaw });
    // rivets along its edges, inked
    const [w, h, d] = size, parts = [];
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) parts.push(new THREE.BoxGeometry(w + 0.04, 0.08, 0.08).translate(0, sy * (h / 2 - 0.04), sx * (d / 2 - 0.04) + sx * 0.02).toNonIndexed());
    const bands = new THREE.Mesh(mergeGeometries(parts), this.mats.rivet);
    bands.position.copy(m.position); bands.rotation.copy(m.rotation);
    this.add(bands);
    tagMetal(m);
    return m;
  }
  /** The bay's mark: a banner on a pole in its colour, and the gadget's own model on a plinth, large. */
  flag(color = '#c8483a', id = this.gadget) {
    const g = new THREE.Group(); g.position.set(-6.2, 0, 3.2);
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 4.4, 8).translate(0, 2.2, 0), this.mats.ink));
    const banner = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.9).translate(0.72, 3.8, 0), makeMaterial({ color, flat: true, side: THREE.DoubleSide }));
    banner.userData.noCollide = true;
    g.add(banner);
    this.add(g);
    if (id) {
      const plinth = this.block([1.2, 1, 1.2], [6.2, 0.5, 3.2], { mat: 'pale' });
      const model = buildItemModel(id);
      model.scale.setScalar(4);
      model.position.set(6.2, 1.9, 3.2);
      model.traverse((o) => { o.userData.noCollide = true; });
      this.add(model);
      this.statue = model; this.plinth = plinth;
    }
  }
}
