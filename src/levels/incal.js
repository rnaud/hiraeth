import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { mulberry32 } from '../noise.js';
import { makeMaterial, MODE_STRATA } from '../materials.js';

// ---------------------------------------------------------------------------
// "La Cité-Puits": the city-shaft from Jodorowsky & Moebius' L'Incal.
// An enormous vertical pit lined with terraces, the rich at the sunny top,
// the poor in the depths, an acid lake at the bottom, a central spire with
// rings and bridges, floating landing pads and flying taxis on circular lanes.
// Traverse it with the jetpack.
// ---------------------------------------------------------------------------

const R = 260;          // shaft radius
const TOP = 200;        // rim / surface level
const BOTTOM = -380;    // acid lake
const LEVELS = [150, 92, 36, -24, -86, -150, -218, -290];
const SPIRE_R = 24;
const SPIRE_RING = 48;

const TAU = Math.PI * 2;
const angleIn = (a, a0, a1) => {
  const d = ((a - a0) % TAU + TAU) % TAU;
  return d <= ((a1 - a0) % TAU + TAU) % TAU || a1 - a0 >= TAU - 1e-6;
};

// Walkable surfaces at many heights, looked up through a coarse spatial grid.
class CityGround {
  constructor(cell = 24) {
    this.cell = cell;
    this.grid = new Map();
  }
  add(p) {
    const c = this.cell;
    for (let ix = Math.floor(p.minX / c); ix <= Math.floor(p.maxX / c); ix++)
      for (let iz = Math.floor(p.minZ / c); iz <= Math.floor(p.maxZ / c); iz++) {
        const k = ix * 73856093 ^ iz * 19349663;
        if (!this.grid.has(k)) this.grid.set(k, []);
        this.grid.get(k).push(p);
      }
  }
  /** Highest walkable surface at (x, z) whose height is <= y. -Infinity if none. */
  heightAt(x, z, y = Infinity) {
    const k = Math.floor(x / this.cell) * 73856093 ^ Math.floor(z / this.cell) * 19349663;
    const list = this.grid.get(k);
    let best = -Infinity;
    if (!list) return best;
    for (const p of list) if (p.y <= y && p.y > best && p.contains(x, z)) best = p.y;
    return best;
  }
  ring(cx, cz, r0, r1, a0, a1, y) {
    this.add({
      y, minX: cx - r1, maxX: cx + r1, minZ: cz - r1, maxZ: cz + r1,
      contains: (x, z) => {
        const dx = x - cx, dz = z - cz, d = Math.hypot(dx, dz);
        return d >= r0 && d <= r1 && angleIn(Math.atan2(dz, dx), a0, a1);
      },
    });
  }
  disc(cx, cz, r, y) {
    this.add({
      y, minX: cx - r, maxX: cx + r, minZ: cz - r, maxZ: cz + r,
      contains: (x, z) => (x - cx) ** 2 + (z - cz) ** 2 <= r * r,
    });
  }
  // box along direction phi (radians in the xz-plane), half sizes hu (along) / hv (across)
  box(cx, cz, hu, hv, phi, y) {
    const c = Math.cos(phi), s = Math.sin(phi), e = hu + hv;
    this.add({
      y, minX: cx - e, maxX: cx + e, minZ: cz - e, maxZ: cz + e,
      contains: (x, z) => {
        const dx = x - cx, dz = z - cz;
        return Math.abs(dx * c + dz * s) <= hu && Math.abs(-dx * s + dz * c) <= hv;
      },
    });
  }
}

// Annular sector slab, top face at y = 0, thickness t (world angle = atan2(z, x)).
function sectorGeometry(r0, r1, a0, a1, t) {
  const shape = new THREE.Shape();
  shape.moveTo(Math.cos(a0) * r1, Math.sin(a0) * r1);
  shape.absarc(0, 0, r1, a0, a1, false);
  shape.lineTo(Math.cos(a1) * r0, Math.sin(a1) * r0);
  shape.absarc(0, 0, r0, a1, a0, true);
  const g = new THREE.ExtrudeGeometry(shape, { depth: t, bevelEnabled: false, curveSegments: Math.max(8, Math.ceil((a1 - a0) * 18)) });
  g.rotateX(Math.PI / 2); // shape (x, y) -> world (x, z); extrusion goes downward
  return g;
}

const PASTELS = ['#e88fa6', '#62c3c9', '#f2c54b', '#a99be0', '#f3ead8', '#e6875f', '#8fcf9a'];
const RUST = ['#b8735a', '#8f7f9e', '#a8946a', '#7f9a8f', '#c9a27a'];

export function createIncal(scene) {
  const rng = mulberry32(1977);
  const pick = (a) => a[Math.floor(rng() * a.length)];
  const ground = new CityGround();
  const colliders = [];
  const movers = [];

  const strata = (c1, c2, c3, size = 6, extra = {}) =>
    makeMaterial({ color: c1, color2: c2, color3: c3, mode: MODE_STRATA, strataSize: size, ...extra });

  // ---------------------------------------------------------- the shaft wall
  {
    const h = TOP - BOTTOM + 10;
    const g = new THREE.CylinderGeometry(R, R, h, 128, 1, true);
    g.translate(0, BOTTOM - 5 + h / 2, 0);
    const wall = new THREE.Mesh(g, makeMaterial({
      color: '#e9cdb8', color2: '#d9b3c0', color3: '#c7c0dd', mode: MODE_STRATA, strataSize: 9,
      grid: 6, glyphs: true, side: THREE.BackSide,
    }));
    scene.add(wall);
    colliders.push({ x: 0, z: 0, r: R, inside: true, y0: BOTTOM - 50, y1: TOP - 0.6 });
  }

  // ---------------------------------------------------------- the surface around the rim
  {
    const g = new THREE.RingGeometry(R, 2600, 160, 1);
    g.rotateX(-Math.PI / 2);
    const plain = new THREE.Mesh(g, makeMaterial({ color: '#ecd9b8' }));
    plain.position.y = TOP;
    scene.add(plain);
    ground.ring(0, 0, R, 2600, 0, TAU, TOP);
    // a low parapet with gaps around the rim
    for (let i = 0; i < 24; i++) {
      if (i % 4 === 0) continue;
      const a0 = (i / 24) * TAU, a1 = a0 + TAU / 24 * 0.9;
      const p = new THREE.Mesh(sectorGeometry(R, R + 2.5, a0, a1, 1.6), makeMaterial({ color: '#f3ead8', flat: true }));
      p.position.y = TOP + 1.6;
      scene.add(p);
    }
  }

  // ---------------------------------------------------------- towers
  function tower(x, z, baseY, height, radius, palette, opts = {}) {
    const parts = [];
    const segs = 6 + Math.floor(rng() * 3) * 2;
    let y = 0, r = radius;
    const tiers = 1 + Math.floor(rng() * 3);
    for (let t = 0; t < tiers; t++) {
      const th = (height / tiers) * (0.8 + rng() * 0.4);
      const g = new THREE.CylinderGeometry(r * (0.85 + rng() * 0.15), r, th, segs);
      g.translate(0, y + th / 2, 0);
      parts.push(g);
      y += th;
      if (rng() < 0.5) { // a balcony ring
        const ring = new THREE.CylinderGeometry(r * 1.25, r * 1.25, 0.8, segs);
        ring.translate(0, y - th * 0.35, 0);
        parts.push(ring);
      }
      r *= 0.65 + rng() * 0.2;
    }
    const top = rng();
    if (top < 0.35 && !opts.flatTop) {
      const dome = new THREE.SphereGeometry(r * 1.2, 14, 7, 0, TAU, 0, Math.PI / 2);
      dome.translate(0, y, 0);
      parts.push(dome);
    } else if (top < 0.6 && !opts.flatTop) {
      const bulb = new THREE.SphereGeometry(r * 1.6, 12, 8);
      bulb.scale(1, 0.75, 1);
      bulb.translate(0, y + r * 0.9, 0);
      parts.push(bulb, new THREE.CylinderGeometry(0.3, 0.3, r * 4, 4).translate(0, y + r * 2.5, 0));
    }
    const mat = strata(pick(palette), pick(palette), pick(palette), 2.5 + rng() * 3, { grid: 2.5 + rng() * 2, flat: segs <= 8 });
    const m = new THREE.Mesh(mergeGeometries(parts), mat);
    m.position.set(x, baseY, z);
    m.rotation.y = rng() * TAU;
    scene.add(m);
    colliders.push({ x, z, r: radius + 0.2, y0: baseY - 1, y1: baseY + y - 0.5 });
    if (top >= 0.6 || opts.flatTop) ground.disc(x, z, r * 0.95, baseY + y); // walkable roof
    return baseY + y;
  }

  // ---------------------------------------------------------- terraces
  const terraces = [];
  LEVELS.forEach((y, li) => {
    const depth = li / (LEVELS.length - 1);              // 0 = top, 1 = bottom
    const width = 46 + rng() * 20;
    const r0 = R - width;
    const palette = depth < 0.45 ? PASTELS : RUST;
    const nSectors = 2 + Math.floor(rng() * 2);
    let a = rng() * TAU;
    const gap = 0.18 + rng() * 0.15;
    for (let s = 0; s < nSectors; s++) {
      const span = TAU / nSectors - gap;
      const a0 = a, a1 = a + span;
      const slab = new THREE.Mesh(sectorGeometry(r0, R, a0, a1, 5),
        strata(depth < 0.45 ? '#efe0c8' : '#c9b49a', depth < 0.45 ? '#e4c9cf' : '#b4a2a8', '#d8d0e0', 1.6, { flat: true }));
      slab.position.y = y;
      scene.add(slab);
      ground.ring(0, 0, r0, R, a0, a1, y);
      terraces.push({ y, r0, a0, a1 });

      // railing along the inner edge, with openings
      const steps = Math.ceil(span * 6);
      for (let k = 0; k < steps; k++) {
        if (rng() < 0.3) continue;
        const b0 = a0 + (k / steps) * span, b1 = b0 + span / steps * 0.85;
        const rail = new THREE.Mesh(sectorGeometry(r0, r0 + 0.6, b0, b1, 1.2), makeMaterial({ color: '#34405e', flat: true }));
        rail.position.y = y + 1.2;
        scene.add(rail);
      }

      // buildings on the terrace, below the next terrace up
      const above = li === 0 ? TOP + 60 : LEVELS[li - 1];
      const maxH = Math.max(above - y - 9, 10);
      const count = Math.floor(span * 9);
      for (let k = 0; k < count; k++) {
        const ang = a0 + (k + 0.5 + (rng() - 0.5) * 0.6) / count * span;
        const rad = r0 + 10 + rng() * (width - 18);
        const br = 4 + rng() * (depth < 0.45 ? 8 : 6);
        if (rng() < 0.25) continue; // keep some plazas open
        tower(Math.cos(ang) * rad, Math.sin(ang) * rad, y, maxH * (0.35 + rng() * 0.65), br, palette,
          { flatTop: depth > 0.45 && rng() < 0.6 });
      }
    }
    a += TAU / nSectors;
  });

  // ---------------------------------------------------------- central spire
  {
    const height = TOP + 120 - BOTTOM;
    const g = new THREE.CylinderGeometry(SPIRE_R * 0.8, SPIRE_R, height, 16);
    g.translate(0, BOTTOM + height / 2, 0);
    scene.add(new THREE.Mesh(g, strata('#f3ead8', '#62c3c9', '#e88fa6', 5, { grid: 4, glyphs: true })));
    colliders.push({ x: 0, z: 0, r: SPIRE_R + 0.5 });
    // golden palace on top
    const palace = mergeGeometries([
      new THREE.SphereGeometry(34, 24, 12, 0, TAU, 0, Math.PI / 2).translate(0, 0, 0),
      new THREE.CylinderGeometry(36, 36, 3, 24).translate(0, -1.5, 0),
      new THREE.CylinderGeometry(1.2, 1.2, 70, 6).translate(0, 55, 0),
      new THREE.SphereGeometry(4, 12, 8).translate(0, 92, 0),
    ]);
    const pm = new THREE.Mesh(palace, makeMaterial({ color: '#f2c54b', grid: 5 }));
    pm.position.y = TOP + 120;
    scene.add(pm);
    for (let i = 0; i < 3; i++) { // orbiting rings around the needle
      const ring = new THREE.Mesh(new THREE.TorusGeometry(14 - i * 3, 0.6, 6, 40), makeMaterial({ color: '#62c3c9' }));
      ring.position.y = TOP + 120 + 50 + i * 12;
      ring.rotation.x = Math.PI / 2;
      scene.add(ring);
      movers.push({ obj: ring, update: (t) => { ring.rotation.y = t * (0.3 + i * 0.2); ring.rotation.x = Math.PI / 2 + Math.sin(t * 0.4 + i) * 0.3; } });
    }

    // rings around the spire at each level + bridges to the terraces
    LEVELS.forEach((y) => {
      const ring = new THREE.Mesh(sectorGeometry(SPIRE_R, SPIRE_RING, 0, TAU, 4), strata('#f3ead8', '#e4c9cf', '#a99be0', 1.5, { flat: true }));
      ring.position.y = y;
      scene.add(ring);
      ground.ring(0, 0, SPIRE_R, SPIRE_RING, 0, TAU, y);
      const level = terraces.filter((t) => t.y === y);
      const nb = 2 + Math.floor(rng() * 2);
      for (let b = 0; b < nb; b++) {
        const t = level[b % level.length];
        const phi = t.a0 + (0.15 + rng() * 0.7) * (t.a1 - t.a0);
        const len = t.r0 - SPIRE_RING + 2;
        const mid = SPIRE_RING - 1 + len / 2;
        const g = new THREE.BoxGeometry(len, 2.5, 7);
        const m = new THREE.Mesh(g, makeMaterial({ color: pick(['#f3ead8', '#62c3c9', '#e88fa6']), flat: true, grid: 3.5 }));
        m.position.set(Math.cos(phi) * mid, y - 1.25, Math.sin(phi) * mid);
        m.rotation.y = -phi;
        scene.add(m);
        ground.box(m.position.x, m.position.z, len / 2, 3.5, phi, y);
      }
    });
  }

  // ---------------------------------------------------------- floating landing pads
  for (let i = 0; i < 34; i++) {
    const a = rng() * TAU, rad = 70 + rng() * 115;
    const y = BOTTOM + 60 + rng() * (TOP - BOTTOM - 50);
    const r = 5 + rng() * 5;
    const g = mergeGeometries([
      new THREE.CylinderGeometry(r, r * 0.85, 1.6, 14).translate(0, -0.8, 0),
      new THREE.ConeGeometry(r * 0.6, r * 1.2, 10).rotateX(Math.PI).translate(0, -1.6 - r * 0.6, 0),
    ]);
    const m = new THREE.Mesh(g, makeMaterial({ color: pick(PASTELS), flat: true, grid: 2 }));
    m.position.set(Math.cos(a) * rad, y, Math.sin(a) * rad);
    scene.add(m);
    ground.disc(m.position.x, m.position.z, r * 0.95, y);
  }

  // ---------------------------------------------------------- cables across the shaft
  const cableMat = makeMaterial({ color: '#34405e' });
  for (let i = 0; i < 26; i++) {
    const a = rng() * TAU, b = a + Math.PI * (0.5 + rng());
    const y = BOTTOM + 40 + rng() * (TOP - BOTTOM - 40);
    const p0 = new THREE.Vector3(Math.cos(a) * R, y, Math.sin(a) * R);
    const p1 = new THREE.Vector3(Math.cos(b) * R, y + (rng() - 0.5) * 40, Math.sin(b) * R);
    const mid = p0.clone().lerp(p1, 0.5);
    mid.y -= 20 + rng() * 40;
    const curve = new THREE.QuadraticBezierCurve3(p0, mid, p1);
    scene.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 40, 0.45, 5), cableMat));
  }

  // ---------------------------------------------------------- billboards on the wall
  for (let i = 0; i < 40; i++) {
    const a = rng() * TAU, y = BOTTOM + 30 + rng() * (TOP - BOTTOM - 30);
    const m = new THREE.Mesh(new THREE.BoxGeometry(14 + rng() * 10, 8 + rng() * 6, 0.8),
      makeMaterial({ color: pick(['#e88fa6', '#62c3c9', '#f2c54b']), flat: true, grid: 2.2, glyphs: true }));
    m.position.set(Math.cos(a) * (R - 1.2), y, Math.sin(a) * (R - 1.2));
    m.lookAt(0, y, 0);
    scene.add(m);
  }

  // ---------------------------------------------------------- the acid lake
  {
    const lake = new THREE.Mesh(new THREE.CylinderGeometry(R, R, 2, 96), makeMaterial({ color: '#b8d65a' }));
    lake.position.y = BOTTOM - 1;
    scene.add(lake);
  }

  // ---------------------------------------------------------- skyline around the rim
  for (let i = 0; i < 90; i++) {
    const a = rng() * TAU, rad = R + 40 + Math.pow(rng(), 0.7) * 900;
    const h = 30 + rng() * rng() * 260;
    tower(Math.cos(a) * rad, Math.sin(a) * rad, TOP, h, 6 + rng() * 16, PASTELS);
  }

  // ---------------------------------------------------------- flying traffic
  const taxiParts = (color) => {
    const g = mergeGeometries([
      new THREE.BoxGeometry(1.7, 1.0, 3.4),
      new THREE.ConeGeometry(0.8, 1.4, 6).rotateX(Math.PI / 2).translate(0, 0, 2.3),
      new THREE.BoxGeometry(2.8, 0.25, 1.0).translate(0, -0.2, -0.9),
    ]);
    const body = new THREE.Mesh(g, makeMaterial({ color, flat: true }));
    const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.75, 10, 6, 0, TAU, 0, Math.PI / 2), makeMaterial({ color: '#f3ead8' }));
    canopy.position.set(0, 0.5, 0.3);
    const grp = new THREE.Group();
    grp.add(body, canopy);
    return grp;
  };
  for (let i = 0; i < 80; i++) {
    const car = taxiParts(rng() < 0.45 ? '#f2c54b' : pick(PASTELS));
    const scale = 1.3 + rng() * 1.2;
    car.scale.setScalar(scale);
    scene.add(car);
    if (i < 12) {
      // vertical shuttles between levels
      const a = rng() * TAU, rad = 60 + rng() * 120;
      const y0 = BOTTOM + 40 + rng() * 100, y1 = y0 + 150 + rng() * 300, sp = 0.05 + rng() * 0.08, ph = rng() * 10;
      movers.push({ obj: car, update: (t) => {
        const k = 0.5 - 0.5 * Math.cos(t * sp + ph);
        car.position.set(Math.cos(a) * rad, y0 + (y1 - y0) * k, Math.sin(a) * rad);
        car.rotation.set(0, -a, 0);
      } });
    } else {
      const rad = 60 + rng() * 170, y = BOTTOM + 30 + rng() * (TOP + 80 - BOTTOM);
      const w = (rng() < 0.5 ? -1 : 1) * (6 + rng() * 10) / rad, ph = rng() * TAU, bob = rng() * 10;
      movers.push({ obj: car, update: (t) => {
        const a = ph + w * t;
        car.position.set(Math.cos(a) * rad, y + Math.sin(t * 0.7 + bob) * 1.5, Math.sin(a) * rad);
        // face along the lane, bank into the curve
        car.rotation.set(0, Math.atan2(-Math.sin(a) * w, Math.cos(a) * w), -Math.sign(w) * 0.2, 'YXZ');
      } });
    }
  }

  // ---------------------------------------------------------- level description
  const spawn = new THREE.Vector3(R + 14, TOP, 0);
  return {
    id: 'incal',
    ground,
    colliders,
    spawn,
    spawnHeading: -Math.PI / 2,   // facing the pit
    camYaw: Math.PI / 2,
    features: { bike: false, wind: false, jetpack: true },
    defaults: { hour: 12.5 },
    killY: BOTTOM + 4,
    // haze thickens and turns acid-green as you descend
    atmo(x, z, y = TOP) {
      const inside = Math.hypot(x, z) < R;
      const d = inside ? THREE.MathUtils.clamp((TOP - y) / (TOP - BOTTOM), 0, 1) : 0;
      const tint = [1.0 - 0.08 * d, 0.92 + 0.06 * d, 0.95 - 0.12 * d];
      const name = !inside ? 'The rim' : d < 0.3 ? 'Upper levels' : d < 0.65 ? 'Middle levels' : 'The depths';
      return { tint, fog: 1.6 + d * 1.6, name };
    },
    update(dt, t) {
      for (const m of movers) m.update(t);
    },
    constrainCamera(pos) {
      if (pos.y > TOP - 0.5) return;
      const d = Math.hypot(pos.x, pos.z);
      if (d > R - 3) { pos.x *= (R - 3) / d; pos.z *= (R - 3) / d; }
    },
  };
}
