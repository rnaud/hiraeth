import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeMaterial, MODE_WATER } from './materials.js';
import { rough } from './desert-hearth.js';
import { smoothstep } from './noise.js';
import { SALT_PAN, WELLS, BOATS, STORY } from './desert-sites.js';
import { WASH, PAN } from './desert-landmarks.js';
import { finish, ribcageMaterial } from './desert-ribcage.js';

// The memory of water (issue #167; references/levels/The Desert/environment/explorations/water-memory/): the water
// that has not risen left its marks (src/desert-sites.js SALT_PAN, WELLS, BOATS).
//
//   the dry riverbed  the giants' dry wash (src/desert-giants.js) keeps the river's tide lines, pale salt along its
//                     banks, and two boats lie stranded on their sides on them
//   the salt pan      where the wash ends, east of the camps, a level white crust (PAN in desertHeight). Over it hangs
//                     a mirage of the old lake: pale water, reeds, three sails, seen from afar, sinking into the pan as
//                     you come near (`update`: by the camera's distance). When the tree drinks (the roots, issue #161:
//                     src/story/desert-water.js) the pan floods: a shallow water (MODE_WATER, a body the water system
//                     finds once it shows: you wade it, the bike skims it) rising over half a minute, the mirage gone,
//                     the procession's circuit through it.
//   the qanat wells   five round shafts with a little windcatcher each, in a line from the giant's hand to Qanat: the
//                     old channel under the sand. Listen at them (the story): the water is nearer at every well. Dark
//                     inside while the tree is dry; once it drinks, water glints in them.
//
//   const w = buildWaterMemory(scene, terrain)  →  { group, pan, mirage, flood, wells, boats, line, sights, clear, avoid, update(dt, t, o), setFlood(k) }

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
/** The mirage: wholly there farther than `far` from the pan's middle, sunk away nearer than `near` (m). The flood: its rise (s), its depth (m). */
export const MIRAGE = { near: 95, far: 210 };
export const FLOOD = { secs: 30, depth: 0.3 };
/**
 * The flood's sheet (issue #553: until v1.87 a disc 8 m wider than the pan at its full height, hanging up to a metre over
 * the sand where the ground round the pan falls away): spoke by spoke from the pan's middle, level at `top` to the shore
 * (where the ground rises over it: the spoke ends half a metre into it), or, where the ground falls away from the pan's
 * lip, thinning over the lip for a few metres (`spill`) down to an edge tucked `tuck` m under the sand. Local to `C` (its
 * heights from `top`), so the mesh rises as one.
 */
export const FLOOD_SHEET = { segs: 96, out: 8, spill: 4, tuck: 0.1, rings: [0.2, 0.4, 0.6, 0.75, 0.85, 0.9, 0.94, 0.97, 1] };
export function floodGeometry(H, C, top) {
  const S = FLOOD_SHEET, R = SALT_PAN.r + S.out, depth = top - C.y, pos = [0, 0, 0], idx = [];
  for (let s = 0; s < S.segs; s++) {
    const a = s / S.segs * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a), h = (r) => H(C.x + ca * r, C.z + sa * r);
    // the shore (the ground over the water) and the lip (the pan's level ground ends lower)
    let shore = Infinity, lip = Infinity;
    for (let r = 0; r <= R + S.spill; r += 0.25) {
      const g = h(r);
      if (g > top + 0.05) { shore = r; break; }
      if (g < C.y - 0.02 && lip === Infinity) lip = r;
    }
    lip = Math.min(lip, R);   // (no lip and no shore by R: it thins away over the last few metres all the same)
    const end = Math.min(shore + 0.5, lip + S.spill);
    for (const f of S.rings) {
      const r = end * f, g = h(r);
      const skin = r <= lip ? depth : THREE.MathUtils.lerp(depth, -S.tuck, smoothstep(lip, end, r));
      pos.push(ca * r, Math.min(top, g + skin) - top, sa * r);
    }
  }
  const n = S.rings.length;
  for (let s = 0; s < S.segs; s++) {
    const a = 1 + s * n, b = 1 + ((s + 1) % S.segs) * n;
    idx.push(0, b, a);
    for (let k = 0; k < n - 1; k++) idx.push(a + k, b + k, a + k + 1, b + k, b + k + 1, a + k + 1);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  return g;
}
const flatGeo = (g) => { g = g.index ? g.toNonIndexed() : g; for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k); if (!g.attributes.normal) g.computeVertexNormals(); return g; };

export function buildWaterMemory(scene, terrain) {
  const H = (x, z) => terrain.heightAt(x, z);
  const group = new THREE.Group(); group.name = 'The memory of water';
  const clear = [];
  const parts = { salt: [], stain: [], wood: [], wood2: [], stone: [], stone2: [], clay: [], cloth: [], dark: [], wet: [], slot: [] };
  const mats = {
    salt: (() => { const m = makeMaterial({ color: '#f1ece0', color2: '#e3dccb', flat: true, pattern: 'cracks' }); m.polygonOffset = true; m.polygonOffsetFactor = -1; m.polygonOffsetUnits = -2; return m; })(),
    stain: (() => { const m = makeMaterial({ color: '#efe6d3', flat: true }); m.polygonOffset = true; m.polygonOffsetFactor = -1; m.polygonOffsetUnits = -2; return m; })(),
    wood: makeMaterial({ color: '#8a6a4a', flat: true, timber: true }),
    wood2: makeMaterial({ color: '#a88a64', flat: true, timber: true }),
    stone: makeMaterial({ color: '#cdb38f', color2: '#bfa27c', flat: true }),
    stone2: makeMaterial({ color: '#d9c3a0', flat: true }),
    clay: makeMaterial({ color: '#b86a43', flat: true }),
    cloth: makeMaterial({ color: '#c8483a', flat: true, side: THREE.DoubleSide }),
    dark: makeMaterial({ color: '#2f2b36', flat: true }),
    slot: makeMaterial({ color: '#2f2b36', flat: true }),
    wet: makeMaterial({ color: '#5fb7ad', color2: '#8fd6cc', flat: true, glow: 0.35 }),
  };

  // ---------------------------------------------------------------- the salt pan's crust
  const L = PAN.level(), C = V(SALT_PAN.x, L, SALT_PAN.z), R = SALT_PAN.r - 5;
  {
    const segs = 40, rings = 6, pos = [C.x, L + 0.02, C.z], idx = [];
    for (let r = 1; r <= rings; r++) for (let s = 0; s < segs; s++) {
      const a = s / segs * Math.PI * 2, edge = R * (0.9 + 0.1 * Math.sin(a * 3 + 1.3) * Math.cos(a * 5)), d = edge * r / rings;
      pos.push(C.x + Math.cos(a) * d, L + 0.02, C.z + Math.sin(a) * d);
    }
    for (let s = 0; s < segs; s++) idx.push(0, 1 + ((s + 1) % segs), 1 + s);
    for (let r = 1; r < rings; r++) for (let s = 0; s < segs; s++) { const a = 1 + (r - 1) * segs + s, b = 1 + (r - 1) * segs + ((s + 1) % segs); idx.push(a, b, a + segs, b, b + segs, a + segs); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
    parts.salt.push(g);
  }

  // ---------------------------------------------------------------- the river's tide lines along the wash, and its boats
  {
    const P = WASH.points, bed = WASH.opt.bed;
    for (const s0 of [bed + 1.6, bed + 4.2]) for (const sgn of [-1, 1]) {
      for (let i = 2; i < P.length - 3; i++) {
        if (Math.sin(i * 0.53 + s0 + sgn) < -0.35) continue;   // (worn away here and there)
        const q = [];
        for (const k of [i, i + 1]) {
          const a = P[k - 1], b = P[k + 1], dx = b[0] - a[0], dz = b[1] - a[1], Ln = Math.hypot(dx, dz), nx = -dz / Ln * sgn, nz = dx / Ln * sgn;
          const f = WASH.fadeAt(k / (P.length - 1) * WASH.length);
          if (f < 0.6) { q.length = 0; break; }
          for (const w of [-0.3, 0.3]) { const x = P[k][0] + nx * (s0 + w), z = P[k][1] + nz * (s0 + w); q.push(x, H(x, z) + 0.02, z); }
        }
        if (q.length < 12) continue;
        const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(q, 3));
        g.setIndex(sgn > 0 ? [0, 1, 2, 1, 3, 2] : [0, 2, 1, 1, 2, 3]); g.computeVertexNormals();
        if (g.attributes.normal.getY(0) < 0) g.setIndex(sgn > 0 ? [0, 2, 1, 1, 2, 3] : [0, 1, 2, 1, 3, 2]);
        g.computeVertexNormals();
        parts.stain.push(g.toNonIndexed());
      }
    }
  }
  const boats = [];
  for (const [along, side, turn] of BOATS) {
    const u = along / WASH.length, c = WASH.curve.getPointAt(u), t = WASH.curve.getTangentAt(u), n = V(-t.z, 0, t.x);
    const p = c.clone().addScaledVector(n, side); p.y = H(p.x, p.z);
    const heading = Math.atan2(t.x, t.z) + turn, lean = 1.15 * Math.sign(side);
    // a hull of planks lying on its side: half a lathe, its keel toward the bank
    const K = 1.6, hull = new THREE.LatheGeometry([[0.05, -3.4], [0.9, -2.8], [1.35, -1.2], [1.45, 0.6], [1.25, 2.2], [0.6, 3.3], [0.05, 3.7]].map(([r, y]) => new THREE.Vector2(r * K, y * K)), 12, Math.PI * 0.5, Math.PI)
      .rotateX(Math.PI / 2).scale(1, 0.75, 1).rotateZ(lean).rotateY(heading).translate(p.x, p.y + 0.55 * K, p.z);
    parts.wood.push(hull);
    for (const k of [-2.6, 0, 2.6]) { const r = p.clone().add(V(Math.sin(heading) * k, 1.0, Math.cos(heading) * k)); parts.wood2.push(new THREE.BoxGeometry(3.8, 0.18, 0.4).rotateZ(lean * 0.9).rotateY(heading).translate(r.x, r.y, r.z)); }
    // its mast, broken, lying beside it
    const m = p.clone().add(V(Math.cos(heading) * 3.4 * -Math.sign(side), 0.25, -Math.sin(heading) * 3.4 * -Math.sign(side)));
    parts.wood2.push(new THREE.CylinderGeometry(0.15, 0.2, 7.5, 5).rotateZ(Math.PI / 2 - 0.08).rotateY(heading + Math.PI / 2 + 0.3).translate(m.x, m.y, m.z));
    boats.push({ at: p.clone(), heading });
    clear.push({ x: p.x, z: p.z, r: 7 });
  }

  // ---------------------------------------------------------------- the qanat wells, from the giant's hand to Qanat
  const wells = WELLS.map(([x, z], i) => {
    const face = Math.atan2(STORY.city.x - x, STORY.city.z - z);
    const g0 = Math.min(...[0, 1, 2, 3, 4, 5].map((k) => H(x + Math.cos(k) * 1.9, z + Math.sin(k) * 1.9)));
    // the shaft's round wall, its rim, the dark (or the water) down inside
    parts.stone.push(new THREE.LatheGeometry([[1.15, -0.6], [1.75, -0.6], [1.8, 0.9], [1.65, 1.05], [1.2, 1.05], [1.15, 0.9]].map(([r, y]) => new THREE.Vector2(r, y)), 16).translate(x, g0, z));
    // (level over the highest sand inside the shaft, issue #553: at its middle's height, a sloping site's sand came up through it)
    const inside = Math.max(H(x, z), ...[0, 1, 2, 3, 4, 5, 6, 7].map((k) => H(x + Math.cos(k * Math.PI / 4) * 1.15, z + Math.sin(k * Math.PI / 4) * 1.15)));
    const disc = new THREE.CircleGeometry(1.15, 16).rotateX(-Math.PI / 2).translate(x, inside + 0.04, z);
    parts.dark.push(disc.clone()); parts.wet.push(disc);
    // the windcatcher beside it, toward the city: a little square tower, slots under its cap
    const wx = x - Math.cos(face) * 2.9, wz = z + Math.sin(face) * 2.9, wy = H(wx, wz);
    parts.stone2.push(rough(new THREE.BoxGeometry(1.5, 4.4, 1.5), 0.03, 1.6, i).translate(wx, wy + 2.0, wz));
    parts.stone.push(new THREE.BoxGeometry(1.9, 0.3, 1.9).rotateY(face).translate(wx, wy + 4.35, wz));
    parts.stone2.push(new THREE.ConeGeometry(1.0, 0.9, 4).rotateY(face + Math.PI / 4).translate(wx, wy + 4.95, wz));
    for (let k = 0; k < 4; k++) { const a = face + k * Math.PI / 2, sx = Math.sin(a) * 0.76, sz = Math.cos(a) * 0.76; parts.slot.push(new THREE.BoxGeometry(0.34, 0.9, 0.05).rotateY(a).translate(wx + sx, wy + 3.55, wz + sz)); }
    // a clay jar and a coil of rope at its lip, a stick with a red cloth
    const jx = x + Math.sin(face + 1.9) * 2.3, jz = z + Math.cos(face + 1.9) * 2.3;
    parts.clay.push(new THREE.LatheGeometry([[0.05, 0], [0.32, 0.1], [0.4, 0.42], [0.22, 0.72], [0.16, 0.82]].map(([r, y]) => new THREE.Vector2(r, y)), 9).translate(jx, H(jx, jz), jz));
    { const rx = x + Math.sin(face - 1.6) * 2.2, rz = z + Math.cos(face - 1.6) * 2.2; parts.wood.push(new THREE.TorusGeometry(0.42, 0.07, 4, 10).rotateX(Math.PI / 2).translate(rx, H(rx, rz) + 0.08, rz)); }
    if (i % 2 === 0) {
      const sx = x + Math.sin(face + 2.9) * 2.0, sz = z + Math.cos(face + 2.9) * 2.0, sy = H(sx, sz);
      parts.wood.push(new THREE.CylinderGeometry(0.035, 0.045, 2.2, 4).translate(sx, sy + 1.1, sz));
      parts.cloth.push(new THREE.PlaneGeometry(0.3, 0.9).translate(0, -0.45, 0).rotateZ(0.15).rotateY(face + i).translate(sx, sy + 2.1, sz));
    }
    clear.push({ x, z, r: 3.2 }, { x: wx, z: wz, r: 1.4 });
    // (where you kneel to listen: on the side away from the windcatcher, the rim at your ear)
    const stand = V(x + Math.cos(face) * 2.6, 0, z - Math.sin(face) * 2.6); stand.y = H(stand.x, stand.z);
    return { n: i + 1, at: V(x, g0, z), look: V(x, g0 + 0.9, z), stand, windcatcher: V(wx, wy + 5, wz) };
  });

  const meshes = {};
  for (const [k, list] of Object.entries(parts)) {
    if (!list.length) continue;
    const m = new THREE.Mesh(mergeGeometries(list.map(flatGeo)), mats[k]);
    m.name = `The memory of water (${k})`;
    if (['salt', 'stain', 'cloth', 'dark', 'wet', 'clay', 'slot'].includes(k)) m.userData.noCollide = true;
    m.receiveShadow = true;
    group.add(m);
    meshes[k] = m;
  }
  meshes.wet.visible = false;

  // ---------------------------------------------------------------- the mirage over the pan: the old lake, its reeds and sails
  const mirage = new THREE.Group(); mirage.name = 'The salt pan’s mirage';
  {
    // (hanging a little over the pan, as a mirage does, so it shows over the dunes' crests from afar)
    // (one mesh coloured per vertex, the ribcages' material: the lake, its reeds, the sails both ways round, the hulls)
    const geos = [], put = (g, c) => geos.push(finish(g, c));
    put(new THREE.CircleGeometry(1, 40).rotateX(-Math.PI / 2).scale(R * 1.05, 1, R * 0.8).translate(0, 2.2, 0), '#a9ded4');
    for (let k = 0; k < 26; k++) { const a = k * 2.4, d = R * (0.55 + 0.3 * ((k * 7) % 5) / 5), x = Math.cos(a) * d * 0.86, z = Math.sin(a) * d * 0.62; put(new THREE.ConeGeometry(0.18, 3.4 + (k % 3) * 0.9, 4).translate(x * 1.15, 3.6, z * 1.2), '#8fb48a'); }
    for (const [x, z, s0] of [[-14, -4, 1], [7, 9, 0.8], [18, -10, 1.2]]) {
      const s = s0 * 1.7, y0 = 2.0;
      put(new THREE.BoxGeometry(3.2 * s, 0.5 * s, 1.0 * s).translate(x, y0 + 0.45 * s, z), '#b98c62');
      const P = [x - 1.2 * s, y0 + 0.8 * s, z, x + 1.0 * s, y0 + 0.8 * s, z, x - 0.9 * s, y0 + 5.2 * s, z];
      for (const order of [[0, 1, 2], [0, 2, 1]]) { const sail = new THREE.BufferGeometry(); sail.setAttribute('position', new THREE.Float32BufferAttribute(order.flatMap((i) => P.slice(i * 3, i * 3 + 3)), 3)); sail.computeVertexNormals(); put(sail, '#f6f1e4'); }
    }
    mirage.add(new THREE.Mesh(mergeGeometries(geos), ribcageMaterial()));
    mirage.traverse((o) => { if (o.isMesh) { o.userData.noCollide = true; o.userData.floats = true; o.userData.water = false; o.userData.noBatch = true; o.castShadow = false; } });
    mirage.position.copy(C);
  }
  group.add(mirage);

  // ---------------------------------------------------------------- the flood: a shallow water over the whole pan
  const flood = new THREE.Mesh(floodGeometry(H, C, L + FLOOD.depth), makeMaterial({ color: '#69d3c6', color2: '#a3e4d5', mode: MODE_WATER, flat: true }));
  flood.name = 'The salt pan’s flood';
  flood.userData.noCollide = true; flood.userData.waterMoves = true; flood.userData.dynamic = true;
  flood.position.set(C.x, L - 0.4, C.z);
  flood.visible = false;
  group.add(flood);
  const st = { k: 0, mirage: 1 };
  const setFlood = (k) => {
    st.k = THREE.MathUtils.clamp(k, 0, 1);
    flood.visible = st.k > 0.001;
    // (it rises out of the crust: laid at its full height, issue #553, its sheet under the ground until it is over the pan)
    flood.position.y = L - 0.4 + (0.4 + FLOOD.depth) * smoothstep(0, 1, st.k);
    meshes.wet.visible = st.k > 0.05; meshes.dark.visible = !meshes.wet.visible;   // (the water risen in the wells)
    mirage.visible = st.k < 0.02 && st.mirage > 0.02;
  };
  clear.push({ x: C.x, z: C.z, r: SALT_PAN.r });

  scene.add(group);
  const line = wells.map((w) => [w.at.x, w.at.y, w.at.z]);
  const sights = [
    { name: 'the salt pan', at: V(C.x + R * 0.8, L, C.z + 6) },
    { name: 'a boat stranded in the dry wash', at: boats[1].at },
    { name: 'the first qanat well', at: wells[0].stand },
  ];
  return {
    group, pan: { at: C, level: L, r: SALT_PAN.r }, mirage, flood, wells, boats, line, sights, clear, setFlood, state: st, meshes,
    avoid: (x, z, r = 0) => clear.some((c) => Math.hypot(x - c.x, z - c.z) < c.r + r),
    /** The mirage sinks into the pan as you come near, and stands again as you go (it is gone once the pan floods). */
    update(dt, t, o = {}) {
      const cam = o.camera?.position;
      if (!cam) return;
      const d = Math.hypot(cam.x - C.x, cam.z - C.z), k = smoothstep(MIRAGE.near, MIRAGE.far, d);
      st.mirage = k;
      mirage.visible = st.k < 0.02 && k > 0.02;
      if (mirage.visible) { mirage.scale.set(0.75 + 0.25 * k, k, 0.75 + 0.25 * k); mirage.position.y = L + 0.05 + 0.6 * Math.sin(t * 0.7) * 0.15 * k; }
    },
  };
}
