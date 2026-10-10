import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeMaterial } from './materials.js';
import { rideColumn } from './updraft.js';

// The City-Shaft's air pillars (the author, 2026-10-10: "City shaft should have pillars of air coming up to help me
// come back up with my wings"). The shaft breathes: warm air off the acid lake rises up it, and the makers' vents
// gather it into a few tall columns that the city calls the pillars. Open your wings in one, or just fall into it
// (they open by themselves), and it carries you straight up (src/updraft.js), past every level, to hang at its top
// over a landing: the spire's pillar beside the palace's spire, from the bottom viaduct to the palace landing, the
// crown's, a short one on the palace landing that lifts you past the dome to glide down onto its crown, and
// three by the terraces' inner edges, from the lake to above the rim, so you can steer off onto any terrace on the
// way, or glide back to the rim from the top. Drawn as the house draws wind: pale rings drifting up, soft pastel
// streaks, a few ink strokes and motes, all instanced (four draws for every pillar together, no lights); only the
// stretch of each near the camera is drawn (a window that slides along the pillar, its pieces anchored to the world).
// From across the shaft each reads by its body, a see-through column (src/veil.js: two more draws a pillar):
// inked down both sides, a pale wash between, hazed with the shaft, fading out round the eye as you ride it.
//
//   const pillars = new ShaftPillars(scene)
//   pillars.update(dt, t, { player, camera })    per frame, after the traveller (the level's update)
//   pillarAt(pos)                                  the pillar a point is in, or null (pure)

/**
 * The pillars: id, name, angle round the shaft (rad) and distance from its axis (m), foot and top (y), half-width (m),
 * lift (the speed it pulls toward, m/s: open wings rise at about half of it, some 18 m/s, half a minute up the shaft), and where its top lets you off. Their angles are clear of the spire's bridges
 * and the floating pads all the way up (tests/shaft-pillars.test.js), their wall ones inside every terrace's edge, and
 * topping out high enough to glide back to the rim over the high terrace's tallest houses.
 */
export const PILLARS = [
  { id: 'spire', name: 'the spire’s air pillar', a: 4.29, r: 58, foot: -286, top: 327, w: 5, lift: 36, onto: 'the palace landing' },
  { id: 'crown', name: 'the crown’s air pillar', a: 4.6, r: 44, foot: 320, top: 362, w: 3.5, lift: 24, onto: 'the dome’s crown' },
  { id: 'depths', name: 'the depths’ air pillar', a: 3.12, r: 187, foot: -372, top: 248, w: 5, lift: 36, onto: 'the rim' },
  { id: 'halfway', name: 'the halfway air pillar', a: 1.86, r: 187, foot: -372, top: 224, w: 5, lift: 36, onto: 'the rim' },
  { id: 'rim', name: 'the rim’s air pillar', a: 6.16, r: 187, foot: -372, top: 256, w: 5, lift: 36, onto: 'the rim' },
];
/** How far over its top a pillar still holds you (m: the rise eases to nothing at its top, and may carry you a little past). */
const OVER = 4;
/** The rise eases to nothing over the top this many metres of a pillar (its lift × 0.35: a long, gentle stop). */
export const easeOf = (c) => Math.max(4, c.lift * 0.35);
/** The pillar's axis (x, z). */
export const pillarAxis = (p) => ({ x: Math.cos(p.a) * p.r, z: Math.sin(p.a) * p.r });
/** Is p (feet) in pillar c? */
export function inPillar(c, p) {
  const ax = pillarAxis(c);
  return Math.hypot(p.x - ax.x, p.z - ax.z) < c.w && p.y > c.foot - 1 && p.y < c.top + OVER;
}
/** The pillar p (feet) is in, or null. */
export const pillarAt = (p, list = PILLARS) => list.find((c) => inPillar(c, p)) ?? null;

/** How the pillars are drawn: each kind a lattice anchored to the world (spacing m, rise m/s, half the window drawn round the camera m). */
export const LOOK = {
  rings: { spacing: 7, rise: 5, half: 150 },
  streaks: { spacing: 2.4, rise: 9, half: 90 },
  ink: { spacing: 5.5, rise: 7, half: 110 },
  motes: { spacing: 1.4, rise: 4, half: 45 },
};
const STREAK_TONES = ['#f4c7bd', '#cfe4ee', '#f5ead2', '#e3d2ee', '#f3d6a8'];

/** A lattice's pieces in a window (pure): every k with y = foot + k·spacing + rise·t inside [lo, hi]. */
export function latticeRange(foot, spacing, u, lo, hi) {
  return [Math.ceil((lo - foot - u) / spacing), Math.floor((hi - foot - u) / spacing)];
}
const hash = (k, s) => { const x = Math.sin(k * 127.1 + s * 311.7) * 43758.5453; return x - Math.floor(x); };

/** The column's body: a see-through cylinder (src/veil.js), its rim inked down both sides, its body a pale wash; put away with the eye within `hideWithin` m of its axis. */
export const BODY = { color: '#f4f1ea', wash: '#f7eee6', veil: 0.36, alpha: 0.26, glow: 0.3, near: 7, hideWithin: 32 };

export class ShaftPillars {
  /** veils: the level's see-through surfaces (src/veil.js): the pillars' bodies are drawn there, seen from across the shaft. */
  constructor(scene, { pillars = PILLARS, veils = null } = {}) {
    this.pillars = pillars.map((c) => ({ ...c, ...pillarAxis(c) }));
    this.root = new THREE.Group();
    this.root.name = 'The air pillars';
    const n = (L) => Math.ceil((2 * L.half) / L.spacing) + 2;
    const P = this.pillars.length;
    const inst = (geo, mat, count, colors) => {
      const m = new THREE.InstancedMesh(geo, mat, count);
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      if (colors) m.setColorAt(0, new THREE.Color());
      m.frustumCulled = false; m.castShadow = false; m.receiveShadow = false;
      m.count = 0;
      this.root.add(m);
      return m;
    };
    this.rings = inst(new THREE.TorusGeometry(1, 0.03, 4, 32).rotateX(Math.PI / 2), makeMaterial({ color: '#fbfaf2', glow: 0.55, flat: true, key: 'incal.pillar.ring' }), n(LOOK.rings) * P);
    this.streaks = inst(new THREE.BoxGeometry(0.2, 1, 0.2), makeMaterial({ color: '#ffffff', glow: 0.45, flat: true, key: 'incal.pillar.streak' }), n(LOOK.streaks) * P, true);
    this.ink = inst(new THREE.BoxGeometry(0.05, 1, 0.05), makeMaterial({ color: '#34405e', flat: true, key: 'incal.pillar.ink' }), n(LOOK.ink) * P);
    this.motes = inst(new THREE.OctahedronGeometry(0.13, 0), makeMaterial({ color: '#fff4d8', glow: 0.6, flat: true, key: 'incal.pillar.mote' }), n(LOOK.motes) * P);
    this.tones = STREAK_TONES.map((c) => new THREE.Color(c));
    // the makers' stone rings at each pillar's foot and top, a blue band under each (one mesh)
    const parts = [];
    for (const c of this.pillars) {
      for (const [y, r, t] of [[c.foot + 0.12, c.w + 0.15, 0.32], [c.top - 4, c.w + 0.4, 0.18]]) {
        parts.push(new THREE.TorusGeometry(r, t, 6, 44).rotateX(Math.PI / 2).translate(c.x, y, c.z));
      }
    }
    const stone = new THREE.Mesh(mergeGeometries(parts.map((g) => { g.deleteAttribute('uv'); return g; })), makeMaterial({ color: '#d9cba9', color2: '#c9b892', flat: true, key: 'incal.pillar.stone' }));
    const band = new THREE.Mesh(mergeGeometries(this.pillars.map((c) => new THREE.TorusGeometry(c.w + 0.15, 0.1, 4, 44).rotateX(Math.PI / 2).translate(c.x, c.foot + 0.42, c.z)).map((g) => { g.deleteAttribute('uv'); return g; })), makeMaterial({ color: '#3d6fa8', flat: true }));
    stone.userData.floats = band.userData.floats = true;   // (the clipping audit: they hang in the air by design)
    this.root.add(stone, band);
    // the body, seen from afar: an open cylinder whose rim the ink pass draws as two lines, its body a pale wash (one
    // each: close by it is put away, its rim grazing the eye would fill the view, and the rings and streaks say it)
    const bodyMat = makeMaterial({ color: BODY.color, flat: true, glow: BODY.glow, veil: BODY.veil, line: 0.6, lineTint: 0.7, key: 'incal.pillar.body' });
    this.bodies = this.pillars.map((c) => {
      const g = new THREE.CylinderGeometry(c.w, c.w, c.top - c.foot, 28, 1, true).translate(c.x, (c.top + c.foot) / 2, c.z);
      g.deleteAttribute('uv');
      const m = new THREE.Mesh(g, bodyMat);
      m.name = `${c.name} (its body)`;
      m.castShadow = false; m.receiveShadow = false;
      m.userData.floats = true;
      this.root.add(m);
      return { c, m };
    });
    if (veils) { this.root.updateMatrixWorld(true); for (const b of this.bodies) veils.add(b.m, { color: BODY.wash, glow: BODY.glow, alpha: BODY.alpha, near: BODY.near, side: THREE.FrontSide }); }
    this.root.traverse((o) => { o.userData.noCollide = true; o.userData.dynamic = true; });
    scene?.add(this.root);
    this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._p = new THREE.Vector3(); this._s = new THREE.Vector3();
    this.riding = null;
    this.onRide = null;   // (pillar) => void: the first moment of each ride (src/story/incal.js says so once)
  }
  /** The pillar p (feet) is in, or null. */
  at(p) { return pillarAt(p, this.pillars); }
  /** Lay one kind's pieces out round the camera's height: each(pillar, k, y, fade, index) writes instance `index`. */
  lay(mesh, L, t, cy, each) {
    let i = 0;
    const max = mesh.instanceMatrix.count;
    for (const c of this.pillars) {
      const lo = Math.max(c.foot, cy - L.half), hi = Math.min(c.top, cy + L.half);
      if (hi <= lo) continue;
      const u = t * L.rise, [k0, k1] = latticeRange(c.foot, L.spacing, u, lo, hi);
      for (let k = k0; k <= k1 && i < max; k++) {
        const y = c.foot + k * L.spacing + u;
        // (fading in at its foot and out at its top, and at the window's ends where those are not the pillar's)
        const fade = Math.min(1, (y - c.foot) / 6, (c.top - y) / 8, lo > c.foot ? (y - lo) / 12 : 1, hi < c.top ? (hi - y) / 12 : 1);
        if (fade > 0.02) each(c, k, y, fade, i++);
      }
    }
    mesh.count = i;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }
  set(mesh, i, x, y, z, sx, sy, sz, yaw = 0) {
    this._q.setFromAxisAngle(_up, yaw);
    mesh.setMatrixAt(i, this._m.compose(this._p.set(x, y, z), this._q, this._s.set(sx, sy, sz)));
  }
  update(dt, t, { player, camera } = {}) {
    const cy = camera?.position.y ?? player?.pos.y ?? 0;
    const eye = camera?.position ?? player?.pos;
    if (eye) for (const b of this.bodies) b.m.visible = Math.hypot(eye.x - b.c.x, eye.z - b.c.z) > BODY.hideWithin || eye.y > b.c.top + BODY.hideWithin || eye.y < b.c.foot - BODY.hideWithin;
    // the rings: wide and thin, breathing a little as they rise
    this.lay(this.rings, LOOK.rings, t, cy, (c, k, y, f, i) => {
      const s = c.w * (0.62 + 0.3 * hash(k, 1)) * f * (1 + 0.05 * Math.sin(t * 2 + k));
      this.set(this.rings, i, c.x, y, c.z, s, 1, s, t * 0.3 + k);
    });
    // the pastel streaks: long and quick, at a hashed spot across it, swirling slowly round it
    this.lay(this.streaks, LOOK.streaks, t, cy, (c, k, y, f, i) => {
      const a = hash(k, 2) * Math.PI * 2 + t * 0.25, r = c.w * (0.25 + 0.7 * hash(k, 3));
      this.set(this.streaks, i, c.x + Math.cos(a) * r, y, c.z + Math.sin(a) * r, f, (2.5 + 4 * hash(k, 4)) * f, f);
      this.streaks.setColorAt(i, this.tones[Math.floor(hash(k, 5) * this.tones.length)]);
    });
    // the ink: a few long strokes at its edge, as the drawings mark a draught
    this.lay(this.ink, LOOK.ink, t, cy, (c, k, y, f, i) => {
      const a = hash(k, 6) * Math.PI * 2 + t * 0.12, r = c.w * (0.85 + 0.12 * hash(k, 7));
      this.set(this.ink, i, c.x + Math.cos(a) * r, y, c.z + Math.sin(a) * r, 1, (4 + 7 * hash(k, 8)) * f, 1);
    });
    // the motes: specks drifting up and round
    this.lay(this.motes, LOOK.motes, t, cy, (c, k, y, f, i) => {
      const a = hash(k, 9) * Math.PI * 2 + t * (0.4 + 0.4 * hash(k, 10)), r = c.w * Math.sqrt(hash(k, 11)) * 0.95;
      const s = f * (0.6 + 0.8 * hash(k, 12));
      this.set(this.motes, i, c.x + Math.cos(a) * r, y, c.z + Math.sin(a) * r, s, s, s, t + k);
    });
    this.carry(dt, player);
  }
  /** The ride: open wings go straight up; a fall into it opens them (or, without wings, the rising air breaks it). */
  carry(dt, P) {
    if (!P || P.dead || P.down || P.ride || P.swim || P.jetFlight || P.climbing || P.boarding) { this.riding = null; return null; }
    const c = this.at(P.pos);
    if (!c) { this.riding = null; return null; }
    if (P.gliding) {
      rideColumn(P, dt, { x: c.x, z: c.z, top: c.top, lift: c.lift, ease: easeOf(c), r: c.w });
      if (this.riding !== c) { this.riding = c; this.onRide?.(c); }
      return c;
    }
    if (!P.onGround && P.vel.y < -2) {
      if (P.canGlide) P._autoGlide = true;   // (the wings open by themselves, as off a flyer: player.js)
      else P.vel.y = Math.max(P.vel.y, -8);   // (no wings: the rising air only breaks the fall)
    }
    return null;
  }
  dispose() { this.root.removeFromParent(); }
}
const _up = new THREE.Vector3(0, 1, 0);
