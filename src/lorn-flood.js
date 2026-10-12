import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeMaterial } from './materials.js';
import { formAxis } from './form.js';
import { jitter } from './world.js';
import { mulberry32, smoothstep } from './noise.js';
import { lathe, ROOT_INK } from './levels/perdide2.js';
import { braid, taper } from './levels/wood-kit.js';
import { shiftAt } from './levels/names.js';
import { TRIALS } from './trials/data.js';
import { KEEPERS_LIGHT, KEEPERS_STAKES, WATER_WAY_SOUTH, LAMP_BOAT, FERRY_BELL } from './lorn-crossing.js';
import { CLEARINGS, VIEW_LANE } from './lorn-wood-data.js';
import { LightShaft } from './veil.js';
import { Bucket, plain, bar } from './lorn-kit.js';

// The flooded wood (issue #188, the author's pick of Lorn's explorations, `flooded-wood`: references/levels/Lorn/
// environment/explorations/flooded-wood/). The swamp's water runs into the Deep Wood: the crossing does not end at a
// shore, it ends in a drowned forest. Built into Lorn after the rest (src/levels/perdide.js), its own dice (no rng of
// the world's), clear of what floats and races on the water.
//
//   the drowned trunks  the wood's dark trunks standing out of the open water south of the keepers' light, few at first
//                       and closer and closer toward the wood, on splayed roots arching into the water, pale trumpet
//                       fungi up their sides; the keepers' stakes run on between them
//   the root gates      two great arches of tangled roots over the stakes' channel, trunk to trunk: the skiff goes in
//                       under them (the mouth by the keepers' light, the second where the wood closes overhead)
//   the clearings       off the lit path, reached by water (src/lorn-wood-data.js CLEARINGS), each with a shaft of rose
//                       light falling into it and a pause: the egg isle (a moss mound heaped with glowing eggs, a little
//                       keeper's hut), the heron's nest (on a broken drowned trunk, the heron on its rim), the drowned
//                       dome (a moss dome half under the water, its round door lit just over it)
//   floodWeight(x, z)   how far into the drowned wood (x, z) is, 0..1: the light goes from the swamp's twilight blue to
//                       the wood's rose (src/levels/perdide.js atmo)
// Trunks, roots, fungi, mounds, eggs, the stump and the dome are solid as drawn; the heron, the pads and the doors drawn only.
//
//   buildFloodedWood(scene, terrain, { veils, trunks }) → { trunks, gates, clearings, sights, lights, channel }

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const TAU = Math.PI * 2;
/** Where the drowned trunks may stand. */
export const DROWNED = { x0: -270, x1: 60, bands: [[-225, -290, 6], [-290, -330, 12], [-330, -405, 40]] };
/** The stakes' leg into the wood (src/lorn-crossing.js KEEPERS_STAKES: from the open water to Hollin's island). */
export const CHANNEL = KEEPERS_STAKES.way.slice(KEEPERS_STAKES.way.findIndex(([x, z]) => x === -150 && z === -80)).map(([x, z]) => [x, z]);
/** The root gates over it: how far along its last open-water leg (0..1), how wide, how high. */
export const GATES = [{ at: 0.05, span: 30, apex: 13 }, { at: 0.62, span: 30, apex: 14 }];

export const floodWeight = (x, z) => smoothstep(-215, -380, z) * smoothstep(320, 180, Math.abs(x + 80));

const segDist = (x, z, [ax, az], [bx, bz]) => {
  const ex = bx - ax, ez = bz - az, L = ex * ex + ez * ez, t = Math.max(0, Math.min(1, ((x - ax) * ex + (z - az) * ez) / L));
  return Math.hypot(x - ax - ex * t, z - az - ez * t);
};
const lineDist = (x, z, pts) => { let d = Infinity; for (let i = 1; i < pts.length; i++) d = Math.min(d, segDist(x, z, pts[i - 1], pts[i])); return d; };

/** The courses on the water round the drowned wood ([x, z] lines, world): the reed race's and the lagoon laps' gates. */
export function raceLines() {
  return ['perdide', 'perdide2'].map((w) => (TRIALS[w]?.gates ?? []).map(([x, z]) => shiftAt(w, [x, z])));
}

export function buildFloodedWood(scene, terrain, { veils = null, trunks: woodTrunks = [] } = {}) {
  const rng = mulberry32(1880), R = (a, b) => a + rng() * (b - a);
  const H = (x, z) => terrain.heightAt(x, z);
  const mats = {
    fungus: makeMaterial({ color: '#a9a2cf', flat: true, glow: 0.12, shade: 0.5, side: THREE.DoubleSide }),
    egg: makeMaterial({ color: '#f6dcb0', glow: 1 }),
    moss: makeMaterial({ color: '#3f6a6a', grid: 2.2, flat: true }),
    mound: makeMaterial({ color: '#4d786e', color2: '#588276', flat: true, pattern: 'leaves', hatch: 2.2, shade: 0.55, spot: 0 }),
    door: makeMaterial({ color: '#9fe0d0', glow: 0.95 }),
    frame: makeMaterial({ color: '#2a4248', flat: true }),
    heron: makeMaterial({ color: '#c9cfe0', flat: true }),
    beak: makeMaterial({ color: '#e6a05a', flat: true }),
    pad: makeMaterial({ color: '#2f5a4f', flat: true }),
    lamp: makeMaterial({ color: '#f2a07a', glow: 1 }),
    wood: makeMaterial({ color: '#3a3446', flat: true }),
  };
  const trunkParts = { '#2f3a4f': [], '#3a4560': [], '#28324a': [] }, rootParts = { '#2f4a55': [], '#34505a': [], '#2b3f50': [] };
  const tk = Object.keys(trunkParts), rk = Object.keys(rootParts);
  const solid = new Bucket(), drawn = new Bucket(), lights = [], sights = [];
  const keepClear = [
    ...raceLines().map((pts) => ({ pts, pad: 14 })),
    { pts: CHANNEL, pad: 12 },
    { pts: WATER_WAY_SOUTH, pad: 12 },
    { pts: VIEW_LANE, pad: 3 },   // (the keepers' lookout's view to the Crystal: src/lorn-wood-data.js)
  ];
  const spots = [[KEEPERS_LIGHT.x, KEEPERS_LIGHT.z, 18], [LAMP_BOAT.x, LAMP_BOAT.z, 14], [FERRY_BELL.x, FERRY_BELL.z, 14], [0, -478, 46],
    ...['perdide2', 'perdide2-orb'].map((k) => { const o = { perdide2: [-23.7, 31.6], 'perdide2-orb': [40, -10] }[k]; const [x, z] = shiftAt('perdide2', o); return [x, z, 34]; })];
  const placed = [];
  const free = (x, z, reach) => keepClear.every(({ pts, pad }) => lineDist(x, z, pts) > reach + pad)
    && spots.every(([sx, sz, r]) => Math.hypot(x - sx, z - sz) > r + reach)
    && woodTrunks.every((t) => Math.hypot(x - t.x, z - t.z) > reach + t.r * 2.3 + 3)
    && placed.every((t) => Math.hypot(x - t.x, z - t.z) > reach + t.reach + 3);

  // ---------------------------------------------------------- a drowned trunk: its shaft, its flare, its roots, its fungi
  const trunk = (x, z, r, h, k) => {
    const g0 = H(x, z);
    const shaft = formAxis(new THREE.CylinderGeometry(r * 0.84, r, h, 10, 4, true), 'wrap').translate(0, h / 2, 0);
    jitter(shaft, 0.1, 0.05, 900 + k);
    const flare = formAxis(lathe([[r * 1.9, -2.5], [r * 1.4, 0.2], [r * 1.12, 2.6], [r, 5.5]], 10), 'wrap');
    jitter(flare, 0.16, 0.2, 940 + k);
    const ry = rng() * TAU;
    for (const g of [shaft, flare]) { g.rotateY(ry).translate(x, g0 - 0.5, z); g.deleteAttribute('uv'); }
    trunkParts[tk[k % 3]].push(shaft.toNonIndexed(), flare.toNonIndexed());
    // splayed roots, arching out of the trunk into the water
    // (out of its foot a few metres up, bowing out and down: prop roots, as the sheet's trunks stand on)
    const n = 7 + Math.floor(rng() * 3), reach = r + 6;
    for (let i = 0; i < n; i++) {
      const a = ry + (i / n) * TAU + R(-0.25, 0.25), c = Math.cos(a), s = Math.sin(a), y0 = R(2.5, 6), out = R(3, 6);
      const ring = (d, y) => V(x + c * d, y, z + s * d);
      const ex = x + c * (r + out), ez = z + s * (r + out);
      const pts = [ring(r * 0.8, y0), ring(r + out * 0.3, y0 * 0.85), ring(r + out * 0.72, y0 * 0.42), V(ex, Math.min(H(ex, ez), 0) - 1, ez)];
      rootParts[rk[(k + i) % 3]].push(taper(pts, R(0.4, 0.7), 0.5, 16, 6).toNonIndexed());
    }
    // pale trumpet fungi up its sides (the sheet's)
    const f = 2 + Math.floor(rng() * 3);
    for (let i = 0; i < f; i++) {
      const a = rng() * TAU, y = R(6, 40), s = R(1.2, 2.4), rr = r * (1 - 0.16 * (y / h)) + s * 1.1;
      const g = lathe([[0.08, -0.9], [0.25, -0.5], [0.7, 0.0], [1.4, 0.35], [1.45, 0.45], [1.25, 0.42], [0.6, 0.1], [0.12, -0.5]], 10).scale(s, s, s);
      solid.add('fungus', g.translate(x + Math.cos(a) * rr, g0 + y, z + Math.sin(a) * rr));
    }
    placed.push({ x, z, r, h, reach });
    return { x, z, r, h };
  };

  // ---------------------------------------------------------- the root gates over the channel, each between two trunks
  const gates = [];
  {
    const leg = [CHANNEL.findIndex(([x]) => x === -64), CHANNEL.findIndex(([x]) => x === -30)];
    const [ax, az] = CHANNEL[leg[0]], [bx, bz] = CHANNEL[leg[1]];
    const d = V(bx - ax, 0, bz - az).normalize(), n = V(-d.z, 0, d.x);
    GATES.forEach((G, k) => {
      const c = V(ax + (bx - ax) * G.at, 0, az + (bz - az) * G.at), half = G.span / 2;
      const ends = [-1, 1].map((s) => c.clone().addScaledVector(n, s * (half + 3.4)));
      for (const e of ends) trunk(e.x, e.z, 3.4, R(130, 160), 20 + k * 2);
      const at = (s, y, f = 0) => c.clone().addScaledVector(n, s).addScaledVector(d, f).setY(y);
      const course = [at(-half - 1, 5), at(-half * 0.7, G.apex * 0.75, 1), at(-half * 0.3, G.apex * 0.97, -1), at(0, G.apex), at(half * 0.35, G.apex * 0.95, 1), at(half * 0.72, G.apex * 0.72, -1), at(half + 1, 5)];
      for (const b of braid(course, 1.5, { n: 5, seed: 188 + k, turns: 3, tubular: 36, radial: 6, splay: 0.4 })) rootParts[rk[k % 3]].push(b.toNonIndexed());
      // a second, thinner root under it, sagging, a whip root trailing in the water
      const sag = [at(-half - 1, 3.5, 2), at(-half * 0.4, G.apex * 0.62, 3), at(half * 0.4, G.apex * 0.6, 2.5), at(half + 1, 3.5, 2)];
      rootParts[rk[(k + 1) % 3]].push(taper(sag, 0.7, 0.8, 30, 6).toNonIndexed());
      gates.push({ at: c.clone().setY(0.5), apex: G.apex, span: G.span, clear: G.apex * 0.6 - 0.7 });
      sights.push({ name: k ? 'the inner root gate' : 'the root gate', at: c.clone().setY(0.5) });   // (where you pass under it)
    });
  }

  // ---------------------------------------------------------- the drowned trunks, few at first and closer toward the wood
  {
    // (band by band from the open water in: a few, more, then as close as they will stand)
    const D = DROWNED;
    let n = 0;
    for (const [z0, z1, count] of D.bands) for (let tries = 0, k = 0; tries < 1500 && k < count; tries++) {
      const x = R(D.x0, D.x1), z = R(z1, z0), r = R(2.2, 4.4), h = R(105, 165);
      if (H(x, z) > -0.6 || !free(x, z, r + 6)) continue;
      trunk(x, z, r, h, n++);
      k++;
    }
  }

  // ---------------------------------------------------------- the clearings
  const clearings = [];
  const shaft = (x, z, r) => {
    if (!veils) return null;
    return new LightShaft(veils, scene, { color: '#ffd6c4', alpha: [0.1, 0.13], inner: 0.5, near: 5 }).set(V(x - 4, 125, z - 3), r * 0.55, V(x + 2, 0.2, z + 1.5), r * 0.85);
  };
  const pads = (x, z, r, n, seed) => {
    const rr = mulberry32(seed);
    for (let i = 0; i < n; i++) {
      const a = rr() * TAU, d = r * (0.55 + rr() * 0.6), s = 0.4 + rr() * 0.9;
      drawn.add('pad', new THREE.CircleGeometry(s, 9, 0.3, TAU - 0.6).rotateX(-Math.PI / 2).translate(x + Math.cos(a) * d, 0.03, z + Math.sin(a) * d));
    }
  };
  for (const C of CLEARINGS) {
    const { x, z, r } = C;
    const sh = shaft(x, z, r);
    pads(x, z, r, 26, 1880 + clearings.length);
    lights.push(new THREE.Vector4(x, 2, z, r * 1.2));
    if (C.id === 'eggs') {
      // a moss mound out of the water, heaped with glowing eggs, a little keeper's hut at its back with two spires
      const m = new THREE.IcosahedronGeometry(1, 3);
      jitter(m, 0.14, 1.4, 1881);
      solid.add('mound', m.scale(7.5, 2.4, 6.2).translate(x, -0.9, z));
      const er = mulberry32(1882);
      for (let i = 0; i < 34; i++) {
        const a = er() * TAU, d = Math.sqrt(er()) * 3.4, s = 0.35 + er() * 0.35;
        solid.add('egg', new THREE.SphereGeometry(s, 9, 7).scale(1, 1.3, 1).translate(x - 1.5 + Math.cos(a) * d, 1.35 + s + (3.4 - d) * 0.18, z + 1 + Math.sin(a) * d));
      }
      const hx = x + 3.6, hz = z - 2.2;
      solid.add('moss', new THREE.SphereGeometry(2.4, 16, 8, 0, TAU, 0, Math.PI / 2).scale(1, 0.9, 1).translate(hx, 1.0, hz));
      for (const [dx, hh] of [[-0.7, 1.6], [0.8, 1.1]]) drawn.add('frame', bar(V(hx + dx, 2.9, hz), V(hx + dx, 2.9 + hh, hz), 0.06), new THREE.SphereGeometry(0.14, 6, 4).translate(hx + dx, 3.0 + hh, hz));
      const door = new THREE.CircleGeometry(0.6, 14);
      door.lookAt(V(x - hx, 0, z - hz).normalize());
      drawn.add('door', door.translate(hx + (x - hx) * 0.55, 1.75, hz + (z - hz) * 0.55));
      lights.push(new THREE.Vector4(x - 1.5, 2.5, z + 1, 9));
      clearings.push({ id: C.id, at: V(x, 1.6, z), shaft: sh });
      sights.push({ name: 'the egg isle', at: V(x, 1.6, z) });
    } else if (C.id === 'heron') {
      // a drowned trunk broken off 7 m up, a nest of roots on it, three pale eggs, the heron on its rim
      const st = formAxis(new THREE.CylinderGeometry(2.6, 3.1, 9, 12, 3, false), 'wrap').translate(0, 4.5, 0);
      jitter(st, 0.18, 0.4, 1883);
      const P = st.attributes.position;
      for (let i = 0; i < P.count; i++) if (P.getY(i) > 8.9) P.setY(i, P.getY(i) - ((i * 7) % 5) * 0.45);   // (its broken top)
      st.translate(x, -2, z); st.deleteAttribute('uv');
      trunkParts[tk[1]].push(st.toNonIndexed());
      const top = 6.6;
      const bowl = [];
      for (let k = 0; k < 3; k++) {
        const pts = [], rr = 2.0 + k * 0.25;
        for (let i = 0; i <= 14; i++) { const a = (i / 14) * TAU + k; pts.push(V(x + Math.cos(a) * rr, top + k * 0.28 + Math.sin(a * 3 + k) * 0.12, z + Math.sin(a) * rr)); }
        bowl.push(...braid(pts, 0.26, { n: 2, seed: 1884 + k, turns: 4, splay: 0 }));
      }
      for (const b of bowl) rootParts[rk[2]].push(b.toNonIndexed());
      for (const [dx, dz] of [[-0.5, 0.2], [0.4, 0.5], [0.1, -0.5]]) solid.add('egg', new THREE.SphereGeometry(0.32, 9, 7).scale(1, 1.3, 1).translate(x + dx, top + 0.5, z + dz));
      // the heron: a long body, an S of a neck, a dagger of a beak, two stick legs
      const hx = x + 1.9, hz = z - 0.6, hy = top + 0.7;
      drawn.add('heron', new THREE.SphereGeometry(0.55, 10, 7).scale(1, 0.75, 1.7).rotateY(0.6).translate(hx, hy + 1.45, hz));
      const neck = [V(hx + 0.35, hy + 1.7, hz + 0.6), V(hx + 0.2, hy + 2.3, hz + 0.75), V(hx + 0.45, hy + 2.75, hz + 0.6), V(hx + 0.55, hy + 3.05, hz + 0.95)];
      drawn.add('heron', taper(neck, 0.16, 0.6, 12, 5), new THREE.SphereGeometry(0.2, 8, 6).translate(hx + 0.55, hy + 3.1, hz + 1.0));
      drawn.add('beak', new THREE.ConeGeometry(0.07, 0.75, 5).rotateX(Math.PI / 2).rotateY(0.45).translate(hx + 0.72, hy + 3.08, hz + 1.38));
      for (const s of [-0.18, 0.18]) drawn.add('beak', bar(V(hx + s, hy - 0.1, hz), V(hx + s * 0.6, hy + 1.1, hz), 0.035, 4));
      clearings.push({ id: C.id, at: V(x, top + 0.4, z), shaft: sh });
      sights.push({ name: 'the heron’s nest', at: V(x, top + 0.4, z) });
    } else if (C.id === 'dome') {
      // a moss dome sunk to its shoulders, its round door just over the water, a mooring post with a lamp
      solid.add('moss', new THREE.SphereGeometry(7, 26, 12, 0, TAU, 0, Math.PI / 2).scale(1, 0.72, 1).translate(x, -2.2, z));
      const o = V(108 - x, 0, -652 - z).normalize();   // (its door to the water-way, where the boats came by)
      const door = new THREE.CircleGeometry(1.15, 18);
      door.lookAt(V(o.x, 0.25, o.z));
      const dp = V(x, 0.95, z).addScaledVector(o, 6.65);
      drawn.add('door', door.translate(dp.x, dp.y, dp.z));
      drawn.add('frame', new THREE.TorusGeometry(1.15, 0.2, 6, 18).lookAt(V(o.x, 0.25, o.z)).translate(dp.x + o.x * 0.05, dp.y, dp.z + o.z * 0.05));
      const post = V(x, 0, z).addScaledVector(o, 10.5).addScaledVector(V(-o.z, 0, o.x), 2.5), g0 = Math.min(H(post.x, post.z), 0);
      solid.add('wood', new THREE.CylinderGeometry(0.16, 0.22, 3.6 - g0, 6).translate(post.x, (3.6 + g0) / 2, post.z));
      drawn.add('lamp', new THREE.CylinderGeometry(0.3, 0.3, 0.7, 6).translate(post.x, 3.95, post.z));
      drawn.add('frame', new THREE.ConeGeometry(0.48, 0.42, 6).translate(post.x, 4.5, post.z));
      lights.push(new THREE.Vector4(dp.x + o.x * 2, 1.2, dp.z + o.z * 2, 9), new THREE.Vector4(post.x, 3.9, post.z, 7));
      clearings.push({ id: C.id, at: V(x, 2.6, z), shaft: sh });
      sights.push({ name: 'the drowned dome', at: V(x, 2.6, z) });
    }
  }

  // ---------------------------------------------------------- into the scene
  const g = new THREE.Group();
  g.name = 'The flooded wood';
  for (const [c, l] of Object.entries(trunkParts)) if (l.length) {
    const m = new THREE.Mesh(mergeGeometries(l), makeMaterial({ color: c, flat: true, pattern: 'cracks', detail: 'organic', form: true }));
    m.name = 'The drowned trunks';
    m.userData.castShadow = true;
    g.add(m);
  }
  for (const [c, l] of Object.entries(rootParts)) if (l.length) {
    const m = new THREE.Mesh(mergeGeometries(l.map((x) => { x.deleteAttribute('uv'); return x; })), makeMaterial({ color: c, detail: 'organic', ...ROOT_INK }));
    m.name = 'The drowned roots';
    g.add(m);
  }
  for (const m of solid.meshes(mats, { name: 'The flooded wood' })) g.add(m);
  for (const m of drawn.meshes(mats, { solid: false, name: 'The flooded wood, drawn' })) g.add(m);
  scene.add(g);
  sights.push({ name: 'the drowned trunks', at: V(-40, 0.5, -300) });
  return { trunks: placed, gates, clearings, sights, lights, channel: CHANNEL };
}
