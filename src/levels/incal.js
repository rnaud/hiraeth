import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { mulberry32 } from '../noise.js';
import { makeMaterial, MODE_STRATA } from '../materials.js';
import { Taxi } from '../taxi.js';
import { soften } from '../world.js';
import { Banner, Puffs } from '../life.js';

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

// a Mediterranean hill-town on blue-grey viaducts (after the reference plate)
const PASTELS = ['#f1e6cf', '#ead7b5', '#f3ead8', '#e6cfae', '#efe2c8', '#dcc6a4'];   // cream / ochre walls
const RUST = ['#d9c3a0', '#cdb38e', '#e2cfb0', '#c9b596', '#d6bfa0'];               // warmer, dustier lower down
const ROOFS = ['#d9784f', '#c8673f', '#e08a5c', '#b9603e'];                         // terracotta
const STEEL = { color: '#9fb2c6', color2: '#8aa0b8', color3: '#b3c3d3' };            // blue-grey structure

export function createIncal(scene) {
  const rng = mulberry32(1977);
  const pick = (a) => a[Math.floor(rng() * a.length)];
  const movers = [];
  const banners = [];

  const strata = (c1, c2, c3, size = 6, extra = {}) =>
    makeMaterial({ color: c1, color2: c2, color3: c3, mode: MODE_STRATA, strataSize: size, ...extra });

  // merged geometry buckets (one draw per material, keeps the town cheap)
  const buckets = new Map();
  const bucket = (key, mat) => { if (!buckets.has(key)) buckets.set(key, { mat, geos: [] }); return buckets.get(key).geos; };
  const placed = (g, x, y, z, rot = 0) => g.rotateY(rot).translate(x, y, z);
  const wallMat = (i) => strata(PASTELS[i % PASTELS.length], PASTELS[(i + 2) % PASTELS.length], '#f6efe0', 3.2, { grid: 2.4, flat: true });
  const roofMat = (i) => makeMaterial({ color: ROOFS[i % ROOFS.length], flat: true });

  /** A villa: block walls with a window grid, a hipped roof, a dome on a drum, or a roof garden. */
  function house(x, y, z) {
    const w = 5 + rng() * 6, d = 5 + rng() * 6, h = 5 + rng() * 9, rot = rng() * TAU, wi = Math.floor(rng() * 6), ri = Math.floor(rng() * 4);
    bucket('wall' + wi, wallMat(wi)).push(placed(new THREE.BoxGeometry(w, h, d).translate(0, h / 2, 0), x, y, z, rot));
    const kind = rng();
    if (kind < 0.5) {
      const roof = new THREE.ConeGeometry(Math.hypot(w, d) * 0.56, 2.2 + rng() * 2, 4, 1).rotateY(Math.PI / 4);
      roof.scale(w / Math.max(w, d), 1, d / Math.max(w, d));
      bucket('roof' + ri, roofMat(ri)).push(placed(roof.translate(0, h + 1.1, 0), x, y, z, rot));
    } else if (kind < 0.78) {
      const r = Math.min(w, d) * 0.36;
      bucket('wall' + wi, wallMat(wi)).push(placed(new THREE.CylinderGeometry(r, r, 2, 12).translate(0, h + 1, 0), x, y, z, rot));
      bucket('roof' + ri, roofMat(ri)).push(placed(new THREE.SphereGeometry(r * 1.05, 14, 8, 0, TAU, 0, Math.PI / 2).translate(0, h + 2, 0), x, y, z, rot));
    } else {
      bucket('wall' + wi, wallMat(wi)).push(placed(new THREE.BoxGeometry(w + 0.4, 0.9, d + 0.4).translate(0, h + 0.45, 0), x, y, z, rot));
      trees.push([x, y + h + 0.9, z, 0.6]);    // a little roof garden
    }
  }
  const trees = [];   // [x, y, z, scale]

  // ---------------------------------------------------------- the shaft wall
  {
    const h = TOP - BOTTOM + 5;   // ends exactly at the rim so you can walk off the edge
    const g = new THREE.CylinderGeometry(R, R, h, 128, 1, true);
    g.translate(0, BOTTOM - 5 + h / 2, 0);
    const wall = new THREE.Mesh(g, makeMaterial({
      color: '#e6d6b8', color2: '#d9c7a6', color3: '#b3c3d3', mode: MODE_STRATA, strataSize: 9,
      grid: 4, side: THREE.BackSide,
    }));
    scene.add(wall);
  }

  // ---------------------------------------------------------- the surface around the rim
  {
    const g = new THREE.RingGeometry(R, 2600, 160, 1);
    g.rotateX(-Math.PI / 2);
    const plain = new THREE.Mesh(g, makeMaterial({ color: '#e9dcc2', grid: 3 }));
    plain.position.y = TOP;
    scene.add(plain);
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
      const g = soften(new THREE.CylinderGeometry(r * (0.85 + rng() * 0.15), r, th, segs, 4), 0.07);
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
    if (opts.roof) {
      const ri = Math.floor(rng() * 4);
      bucket('roof' + ri, roofMat(ri)).push(new THREE.SphereGeometry(r * 1.25, 14, 8, 0, TAU, 0, Math.PI / 2).scale(1, 1.3, 1).translate(x, baseY + y, z));
    } else if (top < 0.35 && !opts.flatTop) {
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
      const slab = new THREE.Mesh(sectorGeometry(r0, R, a0, a1, 7),
        strata(STEEL.color, STEEL.color2, STEEL.color3, 1.4, { flat: true, grid: 3 }));
      slab.position.y = y;
      scene.add(slab);
      terraces.push({ y, r0, a0, a1 });

      // laundry and banners hanging off the edge
      for (let k = 0; k < Math.floor(span * 3); k++) {
        if (rng() < 0.4) continue;
        const ang = a0 + rng() * span, rr = r0 + 0.3;
        banners.push(new Banner(scene, new THREE.Vector3(Math.cos(ang) * rr, y - 5, Math.sin(ang) * rr), -ang + Math.PI / 2,
          { width: 2 + rng() * 3, height: 5 + rng() * 9, color: pick(depth < 0.45 ? PASTELS : RUST) }));
      }

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
      // a packed hill-town: villas in rows, a few domed towers, cypresses and olive trees between
      const count = Math.floor(span * 80);
      for (let k = 0; k < count; k++) {
        const ang = a0 + (k + 0.5 + (rng() - 0.5) * 0.5) / count * span;
        const rad = r0 + 8 + rng() * (width - 14);
        const x = Math.cos(ang) * rad, z = Math.sin(ang) * rad;
        const roll = rng();
        if (roll < 0.6) house(x, y, z);
        else if (roll < 0.66) tower(x, z, y, maxH * (0.45 + rng() * 0.5), 3 + rng() * 4, palette, { roof: true });
        else trees.push([x, y, z, 0.8 + rng() * 0.8]);
      }
    }
    a += TAU / nSectors;
  });

  // ---------------------------------------------------------- central spire
  {
    const height = TOP + 120 - BOTTOM;
    const g = new THREE.CylinderGeometry(SPIRE_R * 0.8, SPIRE_R, height, 16);
    g.translate(0, BOTTOM + height / 2, 0);
    scene.add(new THREE.Mesh(g, strata('#f1e6cf', '#9fb2c6', '#e6cfae', 5, { grid: 4 })));
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
      ring.userData.noCollide = true; // moving
      scene.add(ring);
      movers.push({ obj: ring, update: (t) => { ring.rotation.y = t * (0.3 + i * 0.2); ring.rotation.x = Math.PI / 2 + Math.sin(t * 0.4 + i) * 0.3; } });
    }

    // rings around the spire at each level + bridges to the terraces
    LEVELS.forEach((y) => {
      const ring = new THREE.Mesh(sectorGeometry(SPIRE_R, SPIRE_RING, 0, TAU, 4), strata(STEEL.color, STEEL.color2, '#f1e6cf', 1.5, { flat: true, grid: 3 }));
      ring.position.y = y;
      scene.add(ring);
      const level = terraces.filter((t) => t.y === y);
      const nb = 2 + Math.floor(rng() * 2);
      for (let b = 0; b < nb; b++) {
        const t = level[b % level.length];
        const phi = t.a0 + (0.15 + rng() * 0.7) * (t.a1 - t.a0);
        const len = t.r0 - SPIRE_RING + 2;
        const mid = SPIRE_RING - 1 + len / 2;
        const g = new THREE.BoxGeometry(len, 2.5, 7);
        const m = new THREE.Mesh(g, strata(STEEL.color, STEEL.color2, STEEL.color3, 1.4, { flat: true, grid: 3.5 }));
        m.position.set(Math.cos(phi) * mid, y - 1.25, Math.sin(phi) * mid);
        m.rotation.y = -phi;
        scene.add(m);
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
  }

  // ---------------------------------------------------------- cables across the shaft
  const cableMat = makeMaterial({ color: '#8aa0b8' });
  for (let i = 0; i < 26; i++) {
    const a = rng() * TAU, b = a + Math.PI * (0.5 + rng());
    const y = BOTTOM + 40 + rng() * (TOP - BOTTOM - 40);
    const p0 = new THREE.Vector3(Math.cos(a) * R, y, Math.sin(a) * R);
    const p1 = new THREE.Vector3(Math.cos(b) * R, y + (rng() - 0.5) * 40, Math.sin(b) * R);
    const mid = p0.clone().lerp(p1, 0.5);
    mid.y -= 20 + rng() * 40;
    const curve = new THREE.QuadraticBezierCurve3(p0, mid, p1);
    scene.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 40, 0.25, 5), cableMat));
  }

  // ---------------------------------------------------------- billboards on the wall
  for (let i = 0; i < 40; i++) {
    const a = rng() * TAU, y = BOTTOM + 30 + rng() * (TOP - BOTTOM - 30);
    const m = new THREE.Mesh(new THREE.BoxGeometry(14 + rng() * 10, 8 + rng() * 6, 0.8),
      makeMaterial({ color: pick(['#d9784f', '#9fb2c6', '#f2c54b']), flat: true, grid: 2.2, glyphs: true }));
    m.position.set(Math.cos(a) * (R - 1.2), y, Math.sin(a) * (R - 1.2));
    m.lookAt(0, y, 0);
    scene.add(m);
  }

  // ---------------------------------------------------------- hero: the Incal
  // The light Incal and its dark twin, turning slowly high above the palace.
  {
    const grp = new THREE.Group();
    grp.position.set(0, TOP + 250, 0);
    grp.userData.noCollide = true;
    const light = new THREE.Mesh(new THREE.OctahedronGeometry(14, 0).scale(1, 1.3, 1), makeMaterial({ color: '#fff8e8', flat: true, glow: 1 }));
    const dark = new THREE.Mesh(new THREE.OctahedronGeometry(7, 0).scale(1, 1.3, 1), makeMaterial({ color: '#2b211f', flat: true }));
    const halo = new THREE.Mesh(new THREE.TorusGeometry(26, 0.5, 6, 64), makeMaterial({ color: '#f2c54b', glow: 1 }));
    halo.rotation.x = Math.PI / 2;
    grp.add(light, dark, halo);
    scene.add(grp);
    movers.push({ update: (t) => {
      light.rotation.y = t * 0.3;
      dark.position.set(Math.cos(t * 0.5) * 32, Math.sin(t * 0.7) * 8, Math.sin(t * 0.5) * 32);
      dark.rotation.y = -t * 0.6;
      halo.rotation.z = t * 0.2;
      grp.position.y = TOP + 250 + Math.sin(t * 0.4) * 4;
    } });
  }

  // ---------------------------------------------------------- acid steam
  const steam = new Puffs(scene, {
    count: 70, color: '#cfe08a', glow: 0.35, rise: 4, life: 12, size: 10,
    area: (r) => { const a = r() * TAU, d = Math.sqrt(r()) * (R - 20); return new THREE.Vector3(Math.cos(a) * d, BOTTOM + 1, Math.sin(a) * d); },
  });

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
    if (rng() < 0.5) {   // tall white slab towers with ribbed faces
      const w = 14 + rng() * 22, hh = 60 + rng() * 220;
      bucket('slab', strata('#f4f0e6', '#e3e8ee', '#d7dee8', 4, { grid: 3.5, flat: true }))
        .push(placed(new THREE.BoxGeometry(w, hh, w * (0.6 + rng() * 0.6)).translate(0, hh / 2, 0), Math.cos(a) * rad, TOP, Math.sin(a) * rad, rng() * TAU));
    } else tower(Math.cos(a) * rad, Math.sin(a) * rad, TOP, h, 6 + rng() * 16, PASTELS, { roof: true });
  }

  // ---------------------------------------------------------- flying traffic
  // Taxis need the physics (built after the level), so they're created in init().
  const taxiSpecs = [];
  for (let i = 0; i < 80; i++) {
    const color = rng() < 0.45 ? '#f2c54b' : pick(PASTELS);
    const scale = 2.0 + rng() * 0.6;
    let lane;
    if (i < 12) {
      // vertical shuttles between levels
      const a = rng() * TAU, rad = 60 + rng() * 120;
      const y0 = BOTTOM + 40 + rng() * 100, y1 = y0 + 150 + rng() * 300, sp = 0.05 + rng() * 0.08, ph = rng() * 10;
      lane = (t, taxi) => {
        const k = 0.5 - 0.5 * Math.cos(t * sp + ph);
        taxi.pos.set(Math.cos(a) * rad, y0 + (y1 - y0) * k, Math.sin(a) * rad);
        taxi.heading = Math.PI / 2 - a;
        taxi.bank = 0;
        taxi.pitch = 0;
      };
    } else {
      const rad = 60 + rng() * 170, y = BOTTOM + 30 + rng() * (TOP + 80 - BOTTOM);
      const w = (rng() < 0.5 ? -1 : 1) * (6 + rng() * 10) / rad, ph = rng() * TAU, bob = rng() * 10;
      lane = (t, taxi) => {
        const a = ph + w * t;
        taxi.pos.set(Math.cos(a) * rad, y + Math.sin(t * 0.7 + bob) * 1.5, Math.sin(a) * rad);
        taxi.heading = Math.atan2(-Math.sin(a) * w, Math.cos(a) * w); // along the lane
        taxi.bank = Math.sign(w) * 0.2;                                  // lean into the curve
        taxi.pitch = 0;
      };
    }
    taxiSpecs.push({ color, scale, lane });
  }
  const vehicles = [];

  // ---------------------------------------------------------- arched viaducts across the void
  {
    const steel = strata(STEEL.color, STEEL.color2, STEEL.color3, 2, { grid: 4 });
    for (let i = 0; i < 4; i++) {
      const y = LEVELS[1 + i * 2] + 2, a = rng() * TAU, span = R * 2 - 30;
      const deck = new THREE.BoxGeometry(span, 4, 16).translate(0, y, 0);
      // the arch beneath: a deep half-ring, flattened
      const arch = new THREE.TorusGeometry(span / 2, 5, 6, 40, Math.PI).rotateX(Math.PI).scale(1, 0.32, 2.4).translate(0, y - 2, 0);
      const g = mergeGeometries([deck, arch]);
      g.rotateY(a);
      const m = new THREE.Mesh(g, steel);
      scene.add(m);
      // a row of villas and trees along the deck
      for (let k = -6; k <= 6; k++) {
        const t = k / 6 * (span / 2 - 20), c = Math.cos(-a), sn = Math.sin(-a);
        if (Math.abs(t) < SPIRE_RING + 4) continue;
        const x = t * c, z = t * sn;
        if (k % 3 === 0) trees.push([x, y + 2, z, 0.9]); else house(x, y + 2, z);
      }
    }
  }

  // ---------------------------------------------------------- the megastructure overhead
  // a vast blue grid saucer hanging over the shaft, its underside ribbed and glazed
  {
    const steel = strata('#7f97b4', '#6f88a8', '#9fb2c6', 5, { grid: 6 });
    const parts = [
      new THREE.CylinderGeometry(260, 150, 46, 64, 4).translate(0, 0, 0),
      new THREE.CylinderGeometry(200, 262, 10, 64).translate(0, 28, 0),
      new THREE.SphereGeometry(190, 40, 14, 0, TAU, 0, Math.PI / 2).scale(1, 0.32, 1).translate(0, 33, 0),
      new THREE.CylinderGeometry(70, 30, 60, 24).translate(0, -50, 0),
    ];
    const m = new THREE.Mesh(mergeGeometries(parts), steel);
    m.position.set(-230, TOP + 175, 40);   // over the far side: framed when you look across
    m.userData.noCollide = true;
    scene.add(m);
  }

  // ---------------------------------------------------------- trees: cypresses and round olives
  {
    const dummy = new THREE.Object3D(), color = new THREE.Color();
    const cypress = new THREE.CapsuleGeometry(1.1, 7, 3, 8).translate(0, 4.6, 0);
    const lobes = [];
    for (let k = 0; k < 7; k++) { const a = k * 2.39996, r = 0.9 + (k % 3) * 0.5; lobes.push(new THREE.IcosahedronGeometry(1.5 + (k % 2) * 0.5, 0).translate(Math.cos(a) * r, 3 + (k % 3) * 0.8, Math.sin(a) * r)); }
    lobes.push(new THREE.CylinderGeometry(0.25, 0.35, 3, 5).translate(0, 1.5, 0));
    const olive = mergeGeometries(lobes.map((g) => g.toNonIndexed()));
    olive.computeVertexNormals();
    const greens = ['#5e7a3a', '#4f6b34', '#6f8a42', '#56733f'];
    const hash01 = (i) => ((Math.sin(i * 12.9898) * 43758.5453) % 1 + 1) % 1;
    for (const geo of [cypress, olive]) {
      const list = trees.filter((_, i) => (hash01(i) < 0.55) === (geo === cypress));
      const mesh = new THREE.InstancedMesh(geo, makeMaterial({ color: '#ffffff', scrub: true }), Math.max(list.length, 1));
      list.forEach(([x, y, z, s], i) => {
        dummy.position.set(x, y, z);
        dummy.rotation.set(0, rng() * TAU, 0);
        dummy.scale.set(s, s * (geo === cypress ? 0.9 + rng() * 0.8 : 1), s);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
        mesh.setColorAt(i, color.set(pick(greens)));
      });
      mesh.userData.noCollide = true;
      scene.add(mesh);
    }
  }

  // merge the town buckets
  for (const { mat, geos } of buckets.values()) {
    if (!geos.length) continue;
    const g = mergeGeometries(geos.map((x) => (x.index ? x : x.toNonIndexed())).map((x) => { x.deleteAttribute('uv'); return x; }));
    scene.add(new THREE.Mesh(g, mat));
  }

  // a railing and cypresses at the spawn, looking out over the town (as in the plate)
  {
    const rail = new THREE.TubeGeometry(new THREE.LineCurve3(new THREE.Vector3(R + 0.6, TOP + 1.1, -30), new THREE.Vector3(R + 0.6, TOP + 1.1, 30)), 8, 0.12, 8);
    scene.add(new THREE.Mesh(rail, makeMaterial({ color: '#c9d2dc' })));
    for (let k = -30; k <= 30; k += 6) scene.add(new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.1, 6).translate(R + 0.6, TOP + 0.55, k), makeMaterial({ color: '#c9d2dc' })));
  }

  // ---------------------------------------------------------- level description
  const spawn = new THREE.Vector3(R + 14, TOP, 0);
  return {
    id: 'incal',
    ground: { heightAt: () => -Infinity }, // everything walkable is real geometry
    spawn,
    spawnHeading: -Math.PI / 2,   // facing the pit
    camYaw: Math.PI / 2,
    features: { mount: false, wind: false, jetpack: true, climb: true, taxis: true },
    vehicles,
    // called once the physics exists: spawn the taxis (they collide when driven)
    init(physics) {
      for (const spec of taxiSpecs) {
        const taxi = new Taxi(physics, spec.color, spec.scale, spec.lane);
        taxi.update(0, null, 0);
        scene.add(taxi.object);
        vehicles.push(taxi);
      }
    },
    defaults: { hour: 12.5, preset: 'Moebius print' },
    sky: {
      script: {
        day: ['#8fb4da', '#eef0ea', '#93a6cf', '#fffaf0', '#fff6dc'],   // print: clear blue over a pale haze
        dusk: ['#8a8fc8', '#f4a8a0', '#8a6fb8', '#ffd2c0', '#ffe2b8'],
        night: ['#1d2250', '#4a4a8a', '#3d3a80', '#9a9ad0', '#f2f0e6'],
      },
      planets: [{ az: 210, el: 16, size: 9, color: '#e8b9c4', ring: 0.25 }],
    },
    killY: BOTTOM + 4,
    // haze thickens and turns acid-green as you descend
    atmo(x, z, y = TOP) {
      const inside = Math.hypot(x, z) < R;
      const d = inside ? THREE.MathUtils.clamp((TOP - y) / (TOP - BOTTOM), 0, 1) : 0;
      const tint = [1.0 - 0.08 * d, 0.92 + 0.06 * d, 0.95 - 0.12 * d];
      const name = !inside ? 'The rim' : d < 0.3 ? 'Upper levels' : d < 0.65 ? 'Middle levels' : 'The depths';
      return { tint, fog: 1.6 + d * 1.6, name };
    },
    life: {
      flocks: [{ count: 12, color: '#f3ead8', size: 1.8, radius: 90, height: [15, 50], seed: 3 },
               { count: 10, color: '#f3ead8', size: 1.6, radius: 140, height: [-40, 10], speed: -0.1, seed: 9 }],
      motes: { count: 180, color: '#bdb4c8', size: 0.05, rise: -0.3, wind: [0.4, 0.2] },
    },
    // taxis are solid: bump into them, or land on a roof and ride along
    dynamic: () => vehicles,
    // inside the shaft the sun comes in steeper, so the terraces are lit like the plate
    lightAt(p, dir) {
      const inside = Math.hypot(p.x, p.z) < R + 20 && p.y < TOP + 40;
      if (inside && dir.y > 0.05) { dir.y += 0.9; dir.normalize(); }
    },
    update(dt, t, ctx) {
      if (ctx?.player) Taxi.playerPos = ctx.player.pos;
      for (const m of movers) m.update(t);
      for (const b of banners) b.update(t);
      steam.update(dt);
    },
    constrainCamera(pos) {
      if (pos.y > TOP - 0.5) return;
      const d = Math.hypot(pos.x, pos.z);
      if (d > R - 3) { pos.x *= (R - 3) / d; pos.z *= (R - 3) / d; }
    },
  };
}
