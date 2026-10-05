import * as THREE from 'three';
import { seeded, merge, put, paint, dome, cyl, cone, ball, ell, lathe, box, disc, tube, leaf, blade, ribbed, arc } from './flora-kit.js';

// Every world's own plants (src/flora.js places them). Nothing is shared between
// worlds: each set is drawn in its world's palette and mood, in the Moebius manner
// (flat colours, inked forms, alien and graphic), with one or two large plants
// (3–8 m, solid: you bump into them and can climb them) among the small ones.
//
// A species:
//   id, name     unique across all worlds (world.name)
//   h            nominal height (m) its geometry is built at; size: [min, max] height
//   large        a big plant: a grove of a few, kept apart, with collision (collide: [radius, height] at h)
//   patch        [min, max] plants in a clump of it; spread: the clump's radius (m); spacing: between plants (m)
//   weight       how often it leads a patch; with: species that grow at its feet
//   sway         how far the tip moves in the breeze (m); shadow: false for ground cover
//   hurts        'spikes': brushing or climbing it pricks you (src/hazards.js)
//   glow         self-lit (the swamps' lanterns and bulbs)
//   wade         may stand this deep in water (m); slope: steepest ground (rise / run)
//   build()      the geometry, standing on y = 0, h tall

const TAU = Math.PI * 2;
const around = (n, fn) => Array.from({ length: n }, (_, i) => fn(i, (i / n) * TAU));

// ======================================================================= the desert (Sable): rose, teal, ochre, cream
const DESERT = [
  { id: 'desert.totem', name: 'Bell totem', h: 5.1, size: [3.6, 6.4], large: true, collide: [0.6, 3.6], patch: [2, 4], spread: 9, spacing: 4, weight: 0.7, with: ['desert.barrel', 'desert.star'],
    build: () => {
      const parts = []; let y = 0;
      for (const [r, hh] of [[0.58, 1.4], [0.5, 1.25], [0.42, 1.1], [0.32, 0.9]]) {
        parts.push(ribbed([[r * 0.7, 0], [r, hh * 0.35], [r * 0.95, hh * 0.7], [r * 0.62, hh]], 8, 0.07, '#5f9e8a', 24, [0, y, 0]));
        parts.push(cyl(r * 0.7, r * 0.7, 0.14, '#e57f5b', 10, [0, y + hh - 0.07, 0]));
        y += hh;
      }
      parts.push(ell(0.26, 0.42, 0.26, '#5f9e8a', [0.6, 1.1, 0], [0, 0, -0.5]), ell(0.22, 0.36, 0.22, '#5f9e8a', [-0.5, 2.0, 0.1], [0, 0, 0.5]));
      parts.push(cone(0.12, 0.5, '#f3ead8', 6, [0, y, 0]), ball(0.09, '#c8483a', [0, y + 0.5, 0]));
      return merge(parts);
    } },
  { id: 'desert.sentinel', name: 'Sand candelabra', h: 5.4, size: [4, 7], large: true, hurts: 'spikes', collide: [0.5, 4.2], patch: [1, 3], spread: 10, spacing: 5, weight: 0.5, with: ['desert.whip', 'desert.star'],
    build: () => {
      const parts = [ribbed([[0.38, 0], [0.46, 0.6], [0.44, 3.8], [0.36, 4.9], [0.1, 5.25]], 10, 0.06, '#6f9a7a', 20)];
      for (const [side, y0, up] of [[1, 1.8, 3.6], [-1, 2.6, 4.3]]) {
        parts.push(tube([[0, y0, 0], [side * 0.7, y0 + 0.1, 0], [side * 1.1, y0 + 0.6, 0], [side * 1.15, up, 0]], 0.26, 0.22, '#6f9a7a', 8, 10));
        parts.push(ell(0.24, 0.12, 0.24, '#f3ead8', [side * 1.15, up, 0]), ball(0.07, '#e57f5b', [side * 1.15, up + 0.12, 0]));
      }
      parts.push(ell(0.2, 0.1, 0.2, '#f3ead8', [0, 5.25, 0]), ball(0.08, '#e57f5b', [0, 5.36, 0]));
      return merge(parts);
    } },
  { id: 'desert.lamp', name: 'Sun-lamp stalk', h: 3, size: [2, 3.6], patch: [3, 7], spread: 4, spacing: 0.9, weight: 1, sway: 0.08, with: ['desert.star'],
    build: () => merge([
      tube([[0, 0, 0], [0.1, 1.2, 0], [0.35, 2.4, 0], [0.7, 2.95, 0], [0.95, 2.72, 0]], 0.07, 0.035, '#8a8a4a', 5, 10),
      ell(0.17, 0.27, 0.17, '#f3ead8', [0.95, 2.38, 0]), cyl(0.14, 0.14, 0.07, '#d9643a', 8, [0.95, 2.6, 0]),
      leaf(0.7, 0.18, 0.05, '#7f9a5a', { up: 0.6, yaw: 1.2, droop: 0.4 }), leaf(0.6, 0.16, 0.05, '#7f9a5a', { up: 0.7, yaw: 4.2, droop: 0.4 }),
    ]) },
  { id: 'desert.barrel', name: 'Ribbed barrel', h: 0.9, size: [0.5, 1.2], patch: [4, 10], spread: 3.5, spacing: 0.9, weight: 1.2, with: ['desert.star'],
    build: () => merge([
      ribbed([[0.05, 0], [0.42, 0.15], [0.5, 0.45], [0.42, 0.75], [0.18, 0.88], [0.02, 0.9]], 12, 0.1, '#4f9a8f', 24),
      ...around(5, (i, a) => ell(0.09, 0.05, 0.09, '#e57f5b', [Math.cos(a) * 0.14, 0.89, Math.sin(a) * 0.14])),
      ball(0.05, '#f2c54b', [0, 0.93, 0]),
    ]) },
  { id: 'desert.star', name: 'Salt star', h: 0.4, size: [0.25, 0.5], patch: [6, 14], spread: 3, spacing: 0.7, weight: 1.2, shadow: false,
    build: () => merge([
      ...around(9, (i, a) => leaf(0.65, 0.14, 0.05, '#d8d7b0', { up: 0.5, yaw: a, droop: 0.15 })),
      ...around(5, (i, a) => leaf(0.42, 0.12, 0.05, '#e9a08a', { up: 1.0, yaw: a + 0.3, droop: 0.1 })),
    ]) },
  { id: 'desert.whip', name: 'Dune whip', h: 2.5, size: [1.6, 3], patch: [2, 5], spread: 5, spacing: 1.6, weight: 0.8, sway: 0.1,
    build: () => {
      const r = seeded('desert.whip'), parts = [];
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * TAU + r() * 0.5, d = 0.5 + r() * 0.4, top = 1.9 + r() * 0.6;
        const p = [[0, 0, 0], [Math.cos(a) * d * 0.2, top * 0.33, Math.sin(a) * d * 0.2], [Math.cos(a) * d * 0.6, top * 0.68, Math.sin(a) * d * 0.6], [Math.cos(a) * d, top, Math.sin(a) * d]];
        parts.push(tube(p, 0.045, 0.016, '#8a4a3a', 4, 6), cone(0.035, 0.25, '#d9643a', 4, p[3]));
      }
      return merge(parts);
    } },
];

// ======================================================================= the City-Shaft rim (L'Incal): cream, terracotta, steel blue, olive
const INCAL = [
  { id: 'incal.agave', name: 'Lantern agave', h: 4.6, size: [3.4, 5.2], large: true, collide: [0.85, 1.1], patch: [1, 3], spread: 6, spacing: 3.6, weight: 0.8, with: ['incal.cushion', 'incal.thistle'],
    build: () => merge([
      ...around(12, (i, a) => leaf(1.4 - (i % 3) * 0.2, 0.34, 0.12, i % 2 ? '#8fa6a0' : '#7f9a96', { up: 0.35 + (i % 3) * 0.28, yaw: a, droop: 0.25 })),
      tube([[0, 0.3, 0], [0.05, 2, 0], [0, 4.3, 0]], 0.09, 0.04, '#a0905a', 5, 8),
      ...[2.6, 3.1, 3.6, 4.1].flatMap((y, k) => around(3, (i, a) => ell(0.22 - k * 0.03, 0.08, 0.22 - k * 0.03, '#f2c54b', [Math.cos(a + k) * (0.32 - k * 0.05), y, Math.sin(a + k) * (0.32 - k * 0.05)]))),
    ]) },
  { id: 'incal.palm', name: 'Fan palm', h: 4.2, size: [3, 5], large: true, collide: [0.32, 3.2], patch: [1, 3], spread: 6, spacing: 3.2, weight: 0.7, with: ['incal.bells', 'incal.cushion'], sway: 0.08,
    build: () => {
      const parts = [tube([[0, 0, 0], [0.12, 1.6, 0], [0.05, 3.4, 0]], 0.3, 0.2, '#8a5a40', 7, 6)];
      for (const y of [0.7, 1.4, 2.1, 2.8]) parts.push(cyl(0.3 - y * 0.03, 0.3 - y * 0.03, 0.12, '#6a4530', 8, [0.08, y, 0]));
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * TAU, up = 0.35 + (i % 2) * 0.35, end = [0.05 + Math.cos(a) * 0.9, 3.4 + Math.sin(up) * 0.9, Math.sin(a) * 0.9];
        parts.push(tube([[0.05, 3.4, 0], end], 0.04, 0.03, '#7f8a4a', 4, 2));
        for (let k = 0; k < 6; k++) parts.push(blade(0.9, 0.14, '#6f8a42', { lean: 0.5 + up * 0.6, yaw: Math.PI / 2 - a + (k - 2.5) * 0.18, at: end, thin: 0.15 }));
      }
      return merge(parts);
    } },
  { id: 'incal.bells', name: 'Terracotta bellflower', h: 1.15, size: [0.8, 1.4], patch: [5, 11], spread: 3, spacing: 0.6, weight: 1.1, sway: 0.06,
    build: () => {
      const parts = [];
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * TAU, d = 0.18, top = 0.85 + (i % 3) * 0.12;
        const p = [[0, 0, 0], [Math.cos(a) * d * 0.5, top * 0.6, Math.sin(a) * d * 0.5], [Math.cos(a) * d, top, Math.sin(a) * d], [Math.cos(a) * (d + 0.12), top - 0.06, Math.sin(a) * (d + 0.12)]];
        parts.push(tube(p, 0.02, 0.012, '#6f8a42', 4, 6));
        for (const k of [2, 3]) parts.push(lathe([[0, 0], [0.11, 0], [0.1, 0.07], [0.07, 0.16], [0, 0.2]], '#d9743a', 7, [p[k][0], p[k][1] - 0.22, p[k][2]]));
      }
      parts.push(...around(3, (i, a) => leaf(0.35, 0.12, 0.03, '#6f8a42', { up: 0.4, yaw: a, droop: 0.3 })));
      return merge(parts);
    } },
  { id: 'incal.thistle', name: 'Blue globe thistle', h: 0.95, size: [0.6, 1.1], patch: [4, 9], spread: 3, spacing: 0.7, weight: 1,
    build: () => {
      const r = seeded('incal.thistle'), parts = [];
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * TAU, top = [Math.cos(a) * 0.12, 0.72 + i * 0.1, Math.sin(a) * 0.12];
        parts.push(tube([[0, 0, 0], top], 0.022, 0.016, '#7f9aa6', 4, 2));
        const head = ball(0.13, '#6f8ad0', top, 1);
        const P = head.attributes.position;
        for (let k = 0; k < P.count; k++) { const f = 1 + 0.28 * r(); P.setXYZ(k, top[0] + (P.getX(k) - top[0]) * f, top[1] + (P.getY(k) - top[1]) * f, top[2] + (P.getZ(k) - top[2]) * f); }
        parts.push(head, leaf(0.3, 0.1, 0.02, '#9ab0b8', { up: 0.5, yaw: a + 0.6, droop: 0.2, at: [top[0] * 0.4, 0.25, top[2] * 0.4] }));
      }
      return merge(parts);
    } },
  { id: 'incal.cushion', name: 'Rosemary cushion', h: 0.4, size: [0.3, 0.55], patch: [5, 12], spread: 3.5, spacing: 0.9, weight: 1, shadow: false,
    build: () => {
      const r = seeded('incal.cushion');
      return merge([
        dome(0.55, 0.4, 0.5, '#9aa88a'),
        ...Array.from({ length: 8 }, () => { const a = r() * TAU, e = 0.3 + r() * 0.9; return ball(0.05, '#9b7fc8', [Math.cos(a) * 0.5 * Math.cos(e), 0.4 * Math.sin(e) + 0.02, Math.sin(a) * 0.46 * Math.cos(e)]); }),
      ]);
    } },
];

// ======================================================================= Vael: bone, pale stone, peach, lavender
const ARZACH = [
  { id: 'arzach.horn', name: 'Spiral horn', h: 5.6, size: [3.8, 7.5], large: true, collide: [0.7, 3.2], patch: [2, 4], spread: 10, spacing: 4.5, weight: 0.7, with: ['arzach.plates', 'arzach.quills'],
    build: () => {
      const main = [], stripe = [];
      for (let i = 0; i <= 14; i++) {
        const t = i / 14;
        main.push([Math.sin(t * 2.6) * 0.5 * t, t * 5.6, (1 - Math.cos(t * 2.6)) * 0.35 * t]);
      }
      for (let i = 0; i <= 48; i++) {
        const t = i / 48, a = t * 22, r = (0.78 * (1 - t) + 0.06 * t) * 1.02;
        stripe.push([Math.sin(t * 2.6) * 0.5 * t + Math.cos(a) * r, t * 5.6, (1 - Math.cos(t * 2.6)) * 0.35 * t + Math.sin(a) * r]);
      }
      return merge([tube(main, 0.78, 0.05, '#efe6d2', 9, 16), tube(stripe, 0.09, 0.02, '#b0705a', 4, 48)]);
    } },
  { id: 'arzach.podlamp', name: 'Pod lantern', h: 6, size: [4.2, 7.8], large: true, collide: [0.22, 3.6], patch: [2, 5], spread: 8, spacing: 3, weight: 0.8, with: ['arzach.quills', 'arzach.coral'], sway: 0.12,
    build: () => merge([
      tube([[0, 0, 0], [0.2, 2, 0], [0.8, 4.2, 0], [1.6, 5.6, 0], [2.1, 5.75, 0], [2.3, 5.25, 0]], 0.15, 0.05, '#d8c7a6', 6, 14),
      ell(0.36, 0.62, 0.36, '#cfa5d5', [2.3, 4.62, 0], undefined, 10, 7), cyl(0.17, 0.17, 0.12, '#5a4a6a', 8, [2.3, 5.12, 0]),
      ball(0.08, '#f4efe2', [2.3, 4.0, 0]),
      ...around(3, (i, a) => leaf(1.2, 0.26, 0.06, '#d8c7a6', { up: 0.5, yaw: a + 0.4, droop: 0.4 })),
    ]) },
  { id: 'arzach.coral', name: 'Bone coral', h: 1.6, size: [1, 2.2], patch: [3, 7], spread: 4, spacing: 1.2, weight: 1,
    build: () => {
      const r = seeded('arzach.coral'), parts = [];
      const grow = (from, a, len, rad, depth) => {
        const up = 0.35 + r() * 0.4, to = [from[0] + Math.cos(a) * len * Math.cos(up) * 0.6, from[1] + len * Math.sin(up) + len * 0.4, from[2] + Math.sin(a) * len * Math.cos(up) * 0.6];
        parts.push(tube([from, [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2 + 0.05, (from[2] + to[2]) / 2], to], rad, rad * 0.65, '#f4efe2', 5, 3));
        if (depth > 0) for (let k = 0; k < 2; k++) grow(to, a + (k ? 0.7 : -0.7) + (r() - 0.5) * 0.4, len * 0.7, rad * 0.65, depth - 1);
        else parts.push(ball(rad * 0.9, '#f4efe2', to));
      };
      parts.push(tube([[0, 0, 0], [0, 0.5, 0]], 0.1, 0.085, '#f4efe2', 5, 2));
      for (let k = 0; k < 3; k++) grow([0, 0.5, 0], (k / 3) * TAU + r(), 0.5, 0.075, 2);
      return merge(parts);
    } },
  { id: 'arzach.quills', name: 'Lavender quills', h: 1, size: [0.6, 1.2], patch: [5, 12], spread: 3.5, spacing: 0.6, weight: 1.1, sway: 0.07,
    build: () => {
      const r = seeded('arzach.quills');
      return merge(Array.from({ length: 13 }, (_, i) => {
        const a = (i / 13) * TAU + r(), lean = 0.08 + r() * 0.3, len = 0.6 + r() * 0.4;
        const tip = [Math.sin(a) * Math.sin(lean) * len, Math.cos(lean) * len, Math.cos(a) * Math.sin(lean) * len];
        return [cyl(0.018, 0.01, len, '#c9b8a0', 4, [0, 0, 0], [lean, a, 0]), ball(0.045, '#b58fcf', tip)];
      }));
    } },
  { id: 'arzach.plates', name: 'Stone mallow', h: 0.36, size: [0.22, 0.45], patch: [6, 14], spread: 3, spacing: 0.8, weight: 1, shadow: false,
    build: () => merge([
      cyl(0.05, 0.04, 0.3, '#c9b8a0', 5),
      disc(0.42, 0.06, '#e9c49a', 9, [0.05, 0.08, 0]), disc(0.32, 0.06, '#d99a7a', 9, [-0.04, 0.17, 0.05]),
      disc(0.24, 0.05, '#e9c49a', 9, [0.03, 0.25, -0.03]), disc(0.13, 0.05, '#d99a7a', 8, [0, 0.31, 0]),
    ]) },
];

// ======================================================================= Vael II: peach plain, bone, coral, cloud white, teal
const ARZACH2 = [
  { id: 'arzach2.pagoda', name: 'Pagoda reed', h: 6, size: [4, 7.4], large: true, collide: [0.24, 4], patch: [2, 5], spread: 8, spacing: 3.2, weight: 0.8, with: ['arzach2.tumble', 'arzach2.puff'], sway: 0.1,
    build: () => merge([
      cyl(0.18, 0.11, 5.8, '#f4efe2', 7),
      ...[[1.6, 1.3], [2.6, 1.1], [3.5, 0.9], [4.3, 0.7], [5.0, 0.5]].map(([y, r], i) => lathe([[0, 0], [r, 0.06], [r * 0.95, 0.15], [0, 0.22]], i % 2 ? '#f3ead8' : '#e8a68e', 12, [0, y, 0])),
      ball(0.16, '#e8a68e', [0, 5.9, 0], 1),
    ]) },
  { id: 'arzach2.bladder', name: 'Sky bladder', h: 3.6, size: [2.8, 4.4], large: true, collide: [1.15, 2.6], patch: [1, 3], spread: 7, spacing: 4, weight: 0.6, with: ['arzach2.fan', 'arzach2.tumble'],
    build: () => merge([
      paintBands(lathe([[0.15, 0], [0.5, 0.3], [0.95, 0.8], [1.18, 1.4], [1.25, 2.1], [1.1, 2.6], [0.8, 3.0], [0.35, 3.35], [0.08, 3.6]], '#f3ead8', 18)),
      cyl(0.09, 0.05, 0.4, '#e8a68e', 5, [0, 3.5, 0]),
    ]) },
  { id: 'arzach2.kite', name: 'Kite flower', h: 2.6, size: [1.8, 3.1], patch: [3, 8], spread: 4, spacing: 1, weight: 1, sway: 0.1,
    build: () => merge([
      tube([[0, 0, 0], [0.08, 1.2, 0], [0.04, 2.3, 0]], 0.04, 0.025, '#5d7562', 4, 6),
      put(ell(0.32, 0.46, 0.06, '#5fb7ad', [0, 0, 0], undefined, 4, 2), [0.04, 2.35, 0], [0.3, 0.4, 0]),
      ball(0.07, '#f3ead8', [0.04, 2.35, 0.06]),
      leaf(0.45, 0.12, 0.03, '#5d7562', { up: 0.6, yaw: 0.5, droop: 0.3, at: [0.06, 0.8, 0] }), leaf(0.4, 0.11, 0.03, '#5d7562', { up: 0.7, yaw: 3.6, droop: 0.3, at: [0.06, 1.3, 0] }),
    ]) },
  { id: 'arzach2.puff', name: 'Cloud puffball', h: 0.8, size: [0.5, 1], patch: [4, 9], spread: 3, spacing: 0.8, weight: 1, sway: 0.04,
    build: () => {
      const r = seeded('arzach2.puff');
      return merge(Array.from({ length: 6 }, (_, i) => {
        const a = (i / 6) * TAU + r(), d = 0.12 + r() * 0.2, y = 0.35 + r() * 0.38, rr = 0.16 + r() * 0.1;
        return [cyl(0.016, 0.012, y, '#c9b8a0', 4, [Math.cos(a) * d, 0, Math.sin(a) * d]), ball(rr, '#fbf8f0', [Math.cos(a) * d, y + rr * 0.7, Math.sin(a) * d], 1)];
      }));
    } },
  { id: 'arzach2.fan', name: 'Coral fan', h: 1.5, size: [1, 1.9], patch: [3, 7], spread: 3.5, spacing: 1, weight: 0.9,
    build: () => merge([
      ell(0.7, 0.72, 0.05, '#d9643a', [0, 0.72, 0], undefined, 12, 6),
      ...around(5, (i) => { const a = -1.1 + (i / 4) * 2.2; return tube([[0, 0, 0.03], [Math.sin(a) * 0.62, 0.72 + Math.cos(a) * 0.62, 0.04]], 0.03, 0.015, '#a8402e', 4, 2); }),
      cyl(0.06, 0.05, 0.12, '#a8402e', 5),
    ]) },
  { id: 'arzach2.tumble', name: 'Peach rosette', h: 0.25, size: [0.18, 0.34], patch: [6, 14], spread: 3, spacing: 0.6, weight: 1, shadow: false,
    build: () => merge([...around(7, (i, a) => ell(0.16, 0.03, 0.16, '#d9b08a', [Math.cos(a) * 0.18, 0.12, Math.sin(a) * 0.18], [0.25, -a, 0])), ball(0.07, '#f3ead8', [0, 0.18, 0], 1)]) },
];

// ======================================================================= Brask's plateau (the Sealed Hangar): ochre, teal, amber, steel
const GARAGE = [
  { id: 'garage.bolt', name: 'Bolt cactus', h: 4.3, size: [3, 5.4], large: true, hurts: 'spikes', collide: [0.58, 3.4], patch: [2, 4], spread: 8, spacing: 3.5, weight: 0.8, with: ['garage.cog', 'garage.spring'],
    build: () => {
      const parts = []; let y = 0;
      for (const r of [0.55, 0.5, 0.45, 0.38]) {
        parts.push(cyl(r, r * 0.96, 0.85, '#3f8f8a', 6, [0, y, 0]));
        parts.push(cyl(r + 0.09, r + 0.09, 0.14, '#efc770', 6, [0, y + 0.85, 0]));
        y += 0.99;
      }
      parts.push(cyl(0.26, 0.26, 0.2, '#f3ead8', 6, [0, y, 0]), cyl(0.02, 0.02, 0.5, '#2b2f45', 4, [0, y + 0.2, 0]), ball(0.07, '#c8483a', [0, y + 0.72, 0]));
      return merge(parts);
    } },
  { id: 'garage.periscope', name: 'Periscope tree', h: 6.4, size: [4.6, 7.6], large: true, collide: [0.2, 5], patch: [1, 3], spread: 8, spacing: 4, weight: 0.6, with: ['garage.dish', 'garage.cog'],
    build: () => merge([
      tube([[0, 0, 0], [0, 4.5, 0], [0.1, 5.6, 0], [0.7, 6.1, 0], [1.2, 6.1, 0]], 0.19, 0.12, '#70858c', 7, 12),
      disc(0.75, 0.12, '#efc770', 16, [1.18, 6.1, 0], [0, 0, -Math.PI / 2]),
      disc(0.45, 0.04, '#2b2f45', 14, [1.3, 6.1, 0], [0, 0, -Math.PI / 2]),
      ...around(8, (i, a) => ell(0.12, 0.26, 0.08, '#f3ead8', [1.3, 6.1 + Math.cos(a) * 0.95, Math.sin(a) * 0.95], [a, 0, 0])),
      ...around(3, (i, a) => tube([[0, 0.5, 0], [Math.cos(a) * 0.5, 0.15, Math.sin(a) * 0.5], [Math.cos(a) * 0.8, -0.05, Math.sin(a) * 0.8]], 0.08, 0.04, '#70858c', 5, 4)),
    ]) },
  { id: 'garage.spring', name: 'Spring fern', h: 0.9, size: [0.6, 1.2], patch: [5, 11], spread: 3, spacing: 0.7, weight: 1.1, sway: 0.05,
    build: () => merge(around(5, (i, a) => {
      const pts = [], top = 0.55 + (i % 3) * 0.1, out = 0.18;
      for (let k = 0; k <= 6; k++) { const t = k / 6; pts.push([Math.cos(a) * out * t, top * t, Math.sin(a) * out * t]); }
      for (let k = 1; k <= 12; k++) {
        const t = k / 12, ang = t * 1.8 * TAU, rad = 0.16 * (1 - t * 0.85);
        const fx = out + Math.sin(ang) * rad, fy = top + 0.16 - Math.cos(ang) * rad;
        pts.push([Math.cos(a) * fx, fy, Math.sin(a) * fx]);
      }
      return tube(pts, 0.045, 0.02, '#8aae4f', 5, 14);
    })) },
  { id: 'garage.dish', name: 'Antenna lily', h: 2, size: [1.4, 2.5], patch: [3, 7], spread: 4, spacing: 1, weight: 0.9, sway: 0.08,
    build: () => merge([
      tube([[0, 0, 0], [0.05, 0.9, 0], [0.15, 1.75, 0]], 0.03, 0.022, '#5a6a5a', 4, 6),
      lathe([[0, 0], [0.3, 0.05], [0.52, 0.14], [0.56, 0.2], [0.4, 0.18], [0, 0.08]], '#f3ead8', 14, [0.15, 1.75, 0], [0, 0, -0.4]),
      cyl(0.015, 0.015, 0.4, '#efc770', 4, [0.15, 1.82, 0], [0, 0, -0.4]), ball(0.04, '#efc770', [0.31, 2.18, 0]),
      leaf(0.5, 0.12, 0.03, '#5a6a5a', { up: 0.5, yaw: 1.5, droop: 0.4 }), leaf(0.45, 0.12, 0.03, '#5a6a5a', { up: 0.6, yaw: 4.4, droop: 0.4 }),
    ]) },
  { id: 'garage.cog', name: 'Gear moss', h: 0.2, size: [0.14, 0.3], patch: [7, 16], spread: 3, spacing: 0.7, weight: 1.1, shadow: false,
    build: () => merge([disc(0.32, 0.12, '#e6875f', 24, [0, 0, 0], undefined, (a) => (Math.cos(a * 12) > 0 ? 1 : 0.8)), disc(0.11, 0.18, '#f3ead8', 8)]) },
];

// ======================================================================= the Buried Machine: pale sand, rust, teal, ash
const BURIED = [
  { id: 'buried.chimney', name: 'Chimney stalk', h: 5.5, size: [4, 7], large: true, collide: [0.45, 4.2], patch: [2, 5], spread: 8, spacing: 3, weight: 0.8, with: ['buried.worms', 'buried.bulbs'],
    build: () => merge([
      lathe([[0.48, 0], [0.4, 1], [0.32, 3], [0.38, 4.5], [0.76, 5.4], [0.7, 5.5], [0.3, 5.36]], '#a8482e', 10),
      cyl(0.36, 0.35, 0.28, '#e8dcc4', 10, [0, 2, 0]), disc(0.62, 0.02, '#2b211f', 10, [0, 5.37, 0]),
    ]) },
  { id: 'buried.gourd', name: 'Ash gourd', h: 3.2, size: [2.6, 4], large: true, collide: [1.25, 2.4], patch: [1, 3], spread: 7, spacing: 4, weight: 0.6, with: ['buried.blades', 'buried.bulbs'],
    build: () => merge([
      paint(lathe([[0.6, 0], [1.25, 0.6], [1.4, 1.4], [1.1, 2.3], [0.4, 2.9], [0.2, 3.2]], '#d8d0c0', 15), (x, y, z) => (Math.cos(Math.atan2(z, x) * 5) > 0.82 ? '#b85a3a' : '#d8d0c0')),
      cyl(0.14, 0.1, 0.5, '#a8482e', 6, [0, 3.1, 0]),
    ]) },
  { id: 'buried.worms', name: 'Rust tube worms', h: 1.3, size: [0.6, 1.6], patch: [4, 9], spread: 3, spacing: 0.8, weight: 1.1, sway: 0.03,
    build: () => {
      const r = seeded('buried.worms');
      return merge(Array.from({ length: 7 }, (_, i) => {
        const a = (i / 7) * TAU + r(), d = i ? 0.12 + r() * 0.16 : 0, rr = 0.06 + r() * 0.04, len = 0.4 + r() * 0.9, at = [Math.cos(a) * d, 0, Math.sin(a) * d];
        return [cyl(rr, rr * 0.9, len, '#b85a3a', 7, at), cyl(rr * 0.85, rr * 2.4, 0.13, '#f3ead8', 9, [at[0], len, at[2]])];
      }));
    } },
  { id: 'buried.blades', name: 'Teal blade leaf', h: 1.2, size: [0.8, 1.5], patch: [4, 9], spread: 3, spacing: 0.8, weight: 1,
    build: () => merge([...around(6, (i, a) => blade(0.8 + (i % 3) * 0.2, 0.2, i % 2 ? '#4f7f7a' : '#5f8f88', { lean: 0.12 + (i % 2) * 0.12, yaw: a, thin: 0.25 })), ball(0.12, '#2f4f4c', [0, 0.04, 0])]) },
  { id: 'buried.bulbs', name: 'Ash bulbs', h: 0.5, size: [0.3, 0.65], patch: [5, 11], spread: 3, spacing: 0.9, weight: 1, shadow: false,
    build: () => merge([[0, 0, 0, 1], [0.42, 0, 0.1, 0.7], [-0.2, 0, 0.38, 0.55]].flatMap(([x, y, z, s]) => [
      lathe([[0, 0], [0.25 * s, 0.1 * s], [0.3 * s, 0.25 * s], [0.15 * s, 0.42 * s], [0.02 * s, 0.55 * s]], '#e9dcc4', 9, [x, y, z]),
      box(0.03 * s, 0.2 * s, 0.06 * s, '#2b211f', [x + 0.29 * s, 0.16 * s, z]),
    ])) },
];

// ======================================================================= Viridel: mint, pink, aqua, peach, lavender, yellow
const EDENA = [
  { id: 'edena.parasol', name: 'Giant parasol leaf', h: 4.8, size: [3.6, 6], large: true, collide: [0.2, 3.6], patch: [2, 5], spread: 9, spacing: 3.4, weight: 0.8, with: ['edena.ribbon', 'edena.daisy'], sway: 0.1,
    build: () => {
      const g = new THREE.SphereGeometry(1, 14, 6).scale(1.9, 0.12, 1.4), P = g.attributes.position;
      const droop = (x, z) => 0.35 * (x * x + z * z) / 3.6;
      for (let i = 0; i < P.count; i++) P.setY(i, P.getY(i) - droop(P.getX(i), P.getZ(i)));
      g.computeVertexNormals();
      // the midrib along the top of the leaf, turned with it
      const tilt = -0.22, rib = [];
      for (let i = 0; i <= 8; i++) {
        const x = -1.7 + 3.4 * (i / 8), y = 0.12 * Math.sqrt(Math.max(0, 1 - (x / 1.9) ** 2)) - droop(x, 0) + 0.015;
        rib.push([1.25 + x * Math.cos(tilt) - y * Math.sin(tilt), 4.5 + x * Math.sin(tilt) + y * Math.cos(tilt), 0]);
      }
      return merge([
        tube([[0, 0, 0], [0.1, 1.5, 0], [0.4, 3.2, 0], [0.9, 4.25, 0]], 0.16, 0.09, '#4f9a7a', 6, 10),
        put(paint(g, '#7fcfa8'), [1.25, 4.5, 0], [0, 0, tilt]),
        tube(rib, 0.045, 0.02, '#f3ead8', 4, 8),
      ]);
    } },
  { id: 'edena.allium', name: 'Bulb tower', h: 4, size: [3, 5], large: true, collide: [0.14, 3], patch: [2, 6], spread: 7, spacing: 2.2, weight: 0.8, with: ['edena.pompom', 'edena.tulip'], sway: 0.1,
    build: () => merge([
      cyl(0.09, 0.06, 3.5, '#5f9a6a', 6), ball(0.45, '#f6c7a0', [0, 3.55, 0], 1),
      tube([[0, 1.8, 0], [0.4, 2.1, 0], [0.55, 2.5, 0]], 0.04, 0.03, '#5f9a6a', 4, 4), ball(0.26, '#f2a7b5', [0.55, 2.7, 0], 1),
      tube([[0, 2.4, 0], [-0.35, 2.7, 0.1], [-0.45, 3.0, 0.15]], 0.035, 0.025, '#5f9a6a', 4, 4), ball(0.2, '#b5a7e6', [-0.45, 3.16, 0.15], 1),
      ...around(4, (i, a) => leaf(0.9, 0.16, 0.04, '#7fcfa8', { up: 0.7, yaw: a, droop: 0.5 })),
    ]) },
  { id: 'edena.tulip', name: 'Tulip cups', h: 0.9, size: [0.6, 1.1], patch: [6, 14], spread: 3.5, spacing: 0.5, weight: 1.2, sway: 0.05,
    build: () => merge(around(4, (i, a) => {
      const top = 0.6 + (i % 3) * 0.12, at = [Math.cos(a) * 0.12, top, Math.sin(a) * 0.12];
      return [
        tube([[0, 0, 0], [at[0] * 0.5, top * 0.5, at[2] * 0.5], at], 0.02, 0.016, '#5f9a6a', 4, 4),
        lathe([[0, 0], [0.1, 0.04], [0.13, 0.14], [0.1, 0.24], [0, 0.27]], ['#f2a7b5', '#f2c54b', '#f3ead8', '#f2a7b5'][i], 8, at),
        leaf(0.32, 0.1, 0.03, '#7fcfa8', { up: 0.9, yaw: a + 0.5, droop: 0.2 }),
      ];
    })) },
  { id: 'edena.pompom', name: 'Pom-pom clover', h: 0.42, size: [0.25, 0.5], patch: [6, 14], spread: 3, spacing: 0.5, weight: 1.1, shadow: false,
    build: () => merge([
      ...around(5, (i, a) => { const at = [Math.cos(a) * 0.1, 0.3 + (i % 2) * 0.06, Math.sin(a) * 0.1]; return [cyl(0.012, 0.01, at[1], '#5f9a6a', 4, [at[0], 0, at[2]]), ball(0.07, '#b5a7e6', at, 1)]; }),
      ...around(4, (i, a) => ell(0.09, 0.02, 0.09, '#7fcfa8', [Math.cos(a) * 0.12, 0.06, Math.sin(a) * 0.12])),
    ]) },
  { id: 'edena.daisy', name: 'Daisy mat', h: 0.15, size: [0.1, 0.2], patch: [8, 18], spread: 3.5, spacing: 0.45, weight: 1.1, shadow: false,
    build: () => merge([[0, 0], [0.22, 0.12], [-0.12, 0.2]].flatMap(([x, z], k) => [
      ...around(8, (i, a) => ell(0.03, 0.012, 0.1, '#f8f4ea', [x + Math.sin(a) * 0.09, 0.12 - k * 0.02, z + Math.cos(a) * 0.09], [0, a, 0], 4, 2)),
      ball(0.04, '#f2c54b', [x, 0.13 - k * 0.02, z]),
    ])) },
  { id: 'edena.ribbon', name: 'Ribbon lily', h: 1.2, size: [0.8, 1.4], patch: [3, 8], spread: 3.5, spacing: 0.9, weight: 1, sway: 0.07,
    build: () => merge([
      ...around(7, (i, a) => leaf(1.1 + (i % 2) * 0.2, 0.09, 0.03, '#9fd6c9', { up: 1.0 + (i % 3) * 0.12, yaw: a, droop: 0.65 })),
      tube([[0, 0, 0], [0.04, 0.6, 0], [0, 1.15, 0]], 0.02, 0.015, '#5f9a6a', 4, 4),
      ...around(5, (i, a) => ell(0.04, 0.02, 0.1, '#f3ead8', [Math.sin(a) * 0.08, 1.17, Math.cos(a) * 0.08], [-0.4, a, 0], 6, 3)),
      ball(0.035, '#f2c54b', [0, 1.19, 0]),
    ]) },
];

// ======================================================================= the Garden of Spheres: lime, dark green, cream, orange, pale blue
const SPHERES = [
  { id: 'spheres.orblily', name: 'Orb lily', h: 4.6, size: [3.4, 5.6], large: true, collide: [0.14, 3.6], patch: [2, 5], spread: 8, spacing: 2.6, weight: 0.8, with: ['spheres.crocus', 'spheres.pearls'], sway: 0.08,
    build: () => merge([
      cyl(0.13, 0.08, 3.85, '#3f6b45', 6), cyl(0.12, 0.3, 0.16, '#e8872f', 10, [0, 3.8, 0]), ball(0.6, '#eef0d8', [0, 4.4, 0], 2),
      ...around(3, (i, a) => leaf(1, 0.28, 0.05, '#4f7f4a', { up: 0.5, yaw: a, droop: 0.4 })),
    ]) },
  { id: 'spheres.beadtree', name: 'Bead tree', h: 3.8, size: [3, 4.8], large: true, collide: [0.24, 2.6], patch: [1, 3], spread: 7, spacing: 4, weight: 0.6, with: ['spheres.whitebells', 'spheres.crocus'], sway: 0.05,
    build: () => {
      const parts = [tube([[0, 0, 0], [0.15, 1.5, 0], [0, 2.9, 0]], 0.24, 0.13, '#6a5a4a', 7, 6)];
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * TAU, end = [Math.cos(a) * 1.5, 3.3, Math.sin(a) * 1.5];
        parts.push(tube([[0, 2.85, 0], [Math.cos(a) * 0.7, 3.65, Math.sin(a) * 0.7], end], 0.07, 0.035, '#6a5a4a', 4, 6));
        for (let k = 0; k < 5; k++) parts.push(ball(0.11 - k * 0.012, k % 2 ? '#eef0d8' : '#c8dbe6', [end[0], end[1] - 0.18 - k * 0.24, end[2]], 1));
      }
      return merge(parts);
    } },
  { id: 'spheres.rush', name: 'Lake rush', h: 1.6, size: [1.1, 1.9], patch: [7, 16], spread: 3.5, spacing: 0.45, weight: 1, sway: 0.08, wade: 0.5,
    build: () => {
      const r = seeded('spheres.rush');
      return merge(Array.from({ length: 9 }, (_, i) => {
        const a = r() * TAU, d = r() * 0.15, len = 1.1 + r() * 0.5, lean = r() * 0.12, at = [Math.cos(a) * d, 0, Math.sin(a) * d];
        const tip = [at[0] + Math.sin(a) * Math.sin(lean) * len, len * Math.cos(lean), at[2] + Math.cos(a) * Math.sin(lean) * len];
        return i % 2 ? [cyl(0.016, 0.01, len, '#6f8a44', 4, at, [lean, a, 0]), cyl(0.04, 0.04, 0.22, '#8a5a40', 6, [tip[0], tip[1] - 0.32, tip[2]], [lean, a, 0])]
          : [cyl(0.014, 0.006, len, '#7f9a4a', 4, at, [lean, a, 0])];
      }));
    } },
  { id: 'spheres.crocus', name: 'Saffron cup', h: 0.26, size: [0.16, 0.32], patch: [8, 18], spread: 3, spacing: 0.4, weight: 1.1, shadow: false,
    build: () => merge(around(5, (i, a) => {
      const at = [Math.cos(a) * 0.1, 0.12 + (i % 2) * 0.04, Math.sin(a) * 0.1];
      return [cyl(0.01, 0.008, at[1], '#7f9a4a', 4, [at[0], 0, at[2]]), lathe([[0, 0], [0.04, 0.03], [0.06, 0.09], [0.05, 0.13], [0.0, 0.08]], '#e8872f', 7, at), blade(0.22, 0.03, '#7f9a4a', { lean: 0.3, yaw: a + 1, thin: 0.3 })];
    })) },
  { id: 'spheres.pearls', name: 'String of pearls', h: 0.32, size: [0.22, 0.4], patch: [6, 12], spread: 3, spacing: 0.6, weight: 1, shadow: false,
    build: () => merge(around(5, (i, a) => {
      const pts = arc(0.45, 0.28, a, 0.3, 5);
      return [tube(pts, 0.012, 0.01, '#5f8a4f', 3, 5), ...pts.slice(1).map((p) => ball(0.045, '#8fa85a', p, 1))];
    })) },
  { id: 'spheres.whitebells', name: 'Pale bells', h: 0.9, size: [0.6, 1.1], patch: [4, 10], spread: 3, spacing: 0.7, weight: 1, sway: 0.06,
    build: () => merge(around(3, (i, a) => {
      const pts = arc(0.45, 0.85, a, 0.35, 6);
      return [tube(pts, 0.018, 0.01, '#4f6b3a', 4, 6), ...[2, 3, 4, 5].map((k) => lathe([[0, 0], [0.07, 0], [0.06, 0.04], [0.04, 0.1], [0, 0.13]], '#f6f3e6', 7, [pts[k][0], pts[k][1] - 0.16, pts[k][2]]))];
    })) },
];

// ======================================================================= Lorn: violet, teal glow, lime glow, swamp green
const PERDIDE = [
  { id: 'perdide.stilt', name: 'Stilt fungus', h: 5.4, size: [4, 7], large: true, collide: [0.16, 4], patch: [2, 5], spread: 8, spacing: 2.8, weight: 0.8, with: ['perdide.puffs', 'perdide.eyes'], glow: 0.25,
    build: () => merge([
      tube([[0, 0, 0], [0.2, 2, 0], [0.05, 4, 0], [0.1, 5.2, 0]], 0.15, 0.08, '#8a6fb8', 6, 10),
      ...[[2.6, 1.2], [3.8, 0.95], [5.05, 0.7]].map(([y, r], i) => lathe([[0.02, -0.06], [r, -0.05], [r * 0.95, 0], [0.05, r * 0.32]], i % 2 ? '#94ebd3' : '#7fe0d0', 12, [i === 1 ? 0.06 : 0.1, y, 0])),
    ]) },
  { id: 'perdide.pipes', name: 'Organ pipes', h: 3.4, size: [2.6, 4.2], large: true, collide: [0.7, 2.8], patch: [1, 3], spread: 7, spacing: 4, weight: 0.6, with: ['perdide.swampfan', 'perdide.puffs'], wade: 0.6,
    build: () => merge([[0, 0, 0.32, 3.4], [0.5, 0.2, 0.22, 2.4], [-0.35, 0.4, 0.25, 2.9], [0.15, -0.5, 0.18, 1.8], [-0.45, -0.35, 0.16, 1.5], [0.55, -0.35, 0.14, 1.2]].flatMap(([x, z, r, h]) => [
      cyl(r * 1.1, r, h, '#4a3f6a', 8, [x, 0, z]), cyl(r * 1.18, r * 1.18, 0.1, '#7fe0d0', 8, [x, h - 0.05, z]), disc(r * 0.9, 0.02, '#1c1830', 8, [x, h + 0.05, z]),
    ])) },
  { id: 'perdide.eyes', name: 'Eye bulb', h: 0.8, size: [0.5, 1], patch: [4, 9], spread: 3, spacing: 0.7, weight: 1, sway: 0.05, glow: 0.35,
    build: () => merge(around(4, (i, a) => {
      const top = 0.55 + (i % 2) * 0.2, at = [Math.cos(a) * 0.16, top, Math.sin(a) * 0.16];
      return [tube([[0, 0, 0], [at[0] * 0.3, top * 0.6, at[2] * 0.3], at], 0.02, 0.014, '#3f5a3a', 4, 4), ball(0.1, '#d6ff9a', at, 1), ball(0.04, '#2b211f', [at[0] * 1.55, at[1] + 0.02, at[2] * 1.55])];
    })) },
  { id: 'perdide.swampfan', name: 'Swamp fan', h: 1.2, size: [0.8, 1.5], patch: [3, 8], spread: 3.5, spacing: 1, weight: 1, wade: 0.5,
    build: () => merge([...around(5, (i, a) => leaf(1.1, 0.45, 0.05, i % 2 ? '#3f5a3a' : '#4a6a40', { up: 0.95 + (i % 2) * 0.15, yaw: a, droop: 0.3, w: 10 })), cyl(0.05, 0.03, 0.75, '#8a5a9a', 6)]) },
  { id: 'perdide.puffs', name: 'Spore puffs', h: 0.34, size: [0.2, 0.42], patch: [6, 14], spread: 3, spacing: 0.5, weight: 1.1, shadow: false,
    build: () => {
      const r = seeded('perdide.puffs');
      return merge(Array.from({ length: 6 }, (_, i) => { const a = r() * TAU, d = r() * 0.22, rr = 0.08 + r() * 0.06; return ball(rr, i % 2 ? '#b08ac8' : '#9a74b8', [Math.cos(a) * d, rr * 0.8 + (i % 3) * 0.04, Math.sin(a) * d], 1); }));
    } },
];

// ======================================================================= Lorn II, the Deep Wood: violet, peach-orange, dark teal, lilac
const PERDIDE2 = [
  { id: 'perdide2.lantern', name: 'Lantern pod', h: 4.5, size: [3.4, 5.6], large: true, collide: [0.16, 3], patch: [2, 4], spread: 8, spacing: 3, weight: 0.8, with: ['perdide2.fingers', 'perdide2.plume'], glow: 0.4, sway: 0.08,
    build: () => merge([
      tube([[0, 0, 0], [0.1, 2, 0], [0.6, 3.8, 0], [1.4, 4.4, 0], [1.9, 4.1, 0]], 0.15, 0.06, '#2c4448', 6, 12),
      lathe([[0, 0], [0.3, 0.15], [0.38, 0.5], [0.25, 0.85], [0, 1]], '#ffb38a', 10, [1.9, 3.05, 0]),
      ...around(3, (i, a) => leaf(0.9, 0.3, 0.05, '#2c4448', { up: 0.5, yaw: a + 0.8, droop: 0.4 })),
    ]) },
  { id: 'perdide2.candelabra', name: 'Candelabra', h: 4, size: [3, 4.8], large: true, collide: [0.18, 3], patch: [1, 3], spread: 7, spacing: 3.6, weight: 0.6, with: ['perdide2.trumpet', 'perdide2.brackets'],
    build: () => {
      const cup = (at) => lathe([[0, 0], [0.12, 0.05], [0.22, 0.25], [0.18, 0.28], [0.05, 0.12]], '#c9c1ea', 10, at);
      return merge([
        cyl(0.13, 0.09, 3.7, '#6f6a94', 7), cup([0, 3.7, 0]),
        ...around(4, (i, a) => { const y0 = 1.6 + (i % 2) * 0.6, end = [Math.cos(a) * 1.1, y0 + 1.1, Math.sin(a) * 1.1]; return [tube([[0, y0, 0], [Math.cos(a) * 0.8, y0 + 0.15, Math.sin(a) * 0.8], end], 0.06, 0.045, '#6f6a94', 5, 6), cup(end)]; }),
      ]);
    } },
  { id: 'perdide2.fingers', name: 'Coral fingers', h: 0.9, size: [0.5, 1.1], patch: [4, 10], spread: 3, spacing: 0.7, weight: 1.1,
    build: () => {
      const r = seeded('perdide2.fingers');
      return merge(Array.from({ length: 7 }, (_, i) => {
        const a = (i / 7) * TAU + r(), d = i ? 0.1 + r() * 0.12 : 0, rr = 0.06 + r() * 0.03, len = 0.3 + r() * 0.45, lean = r() * 0.25;
        return [put(paintCapsule(rr, len, i % 2 ? '#f08a6a' : '#f6a27e'), [Math.cos(a) * d, len / 2 + rr, Math.sin(a) * d], [lean, a, 0])];
      }));
    } },
  { id: 'perdide2.trumpet', name: 'Velvet trumpet', h: 1, size: [0.7, 1.25], patch: [4, 9], spread: 3, spacing: 0.7, weight: 1, sway: 0.05,
    build: () => merge(around(3, (i, a) => {
      const top = 0.55 + i * 0.1, at = [Math.cos(a) * 0.14, top, Math.sin(a) * 0.14], tilt = [0.45, Math.PI / 2 - a, 0];
      return [
        tube([[0, 0, 0], [at[0] * 0.4, top * 0.6, at[2] * 0.4], at], 0.02, 0.016, '#2c4448', 4, 4),
        lathe([[0.02, 0], [0.04, 0.15], [0.08, 0.28], [0.2, 0.38], [0.22, 0.4], [0.0, 0.3]], '#8a6fc8', 10, at, tilt),
      ];
    })) },
  { id: 'perdide2.brackets', name: 'Shelf brackets', h: 0.62, size: [0.4, 0.75], patch: [3, 8], spread: 3, spacing: 0.9, weight: 0.9, shadow: false,
    build: () => merge([
      cyl(0.16, 0.12, 0.5, '#3a3550', 7),
      ...[[0.12, 0.2, 0.34, 0], [0.3, 0.16, 0.28, 2.2], [0.44, 0.12, 0.22, 4.1]].map(([y, h, r, a]) => put(paintHalfDisc(r, 0.06, '#e2dcf2'), [0, y + h, 0], [0, a, 0])),
    ]) },
  { id: 'perdide2.plume', name: 'Feather plume', h: 0.9, size: [0.6, 1.1], patch: [5, 11], spread: 3, spacing: 0.6, weight: 1, sway: 0.08,
    build: () => merge(around(5, (i, a) => {
      const lean = 0.15 + (i % 2) * 0.15, len = 0.55 + (i % 3) * 0.1, tip = [Math.sin(a) * Math.sin(lean) * len, Math.cos(lean) * len, Math.cos(a) * Math.sin(lean) * len];
      return [cyl(0.012, 0.008, len, '#6f6a94', 4, [0, 0, 0], [lean, a, 0]), ell(0.05, 0.2, 0.05, '#f6d8c0', tip, [lean, a, 0], 6, 4)];
    })) },
];

// ======================================================================= the Signal Market: enamel colours in pots along the pavements
const BAZAAR = [
  { id: 'bazaar.strappalm', name: 'Strap palm', h: 4.2, size: [3.2, 4.8], large: true, collide: [0.72, 1.1], patch: [1, 2], spread: 6, spacing: 5, weight: 0.8, with: ['bazaar.gutter'], sway: 0.06,
    build: () => merge([
      box(1.3, 0.6, 1.3, '#46616a'), box(1.15, 0.04, 1.15, '#2b211f', [0, 0.6, 0]),
      tube([[0, 0.6, 0], [0.1, 2, 0], [0, 3.4, 0]], 0.17, 0.12, '#7a5a40', 6, 6),
      ...[1.2, 1.8, 2.4, 3].map((y) => cyl(0.16, 0.16, 0.08, '#5a4030', 7, [0.05, y, 0])),
      ...around(12, (i, a) => leaf(1.6 - (i % 3) * 0.2, 0.14, 0.04, i % 2 ? '#5f8a4f' : '#4f7a44', { up: 0.4 + (i % 3) * 0.3, yaw: a, droop: 0.9, at: [0, 3.4, 0] })),
    ]) },
  { id: 'bazaar.lampflower', name: 'Street lamp flower', h: 3.6, size: [3, 4.2], large: true, collide: [0.12, 3], patch: [1, 3], spread: 7, spacing: 4, weight: 0.6, with: ['bazaar.tinstar', 'bazaar.gutter'], glow: 0.5,
    build: () => merge([
      tube([[0, 0, 0], [0.05, 1.8, 0], [0.3, 3.3, 0], [0.75, 3.6, 0], [1.0, 3.45, 0]], 0.07, 0.04, '#2b2f45', 5, 10),
      cone(0.3, 0.3, '#d9508a', 10, [1.0, 3.2, 0]), ball(0.2, '#f6dcb0', [1.0, 3.12, 0], 1),
      ...around(3, (i, a) => leaf(0.6, 0.2, 0.04, '#3f6b45', { up: 0.6, yaw: a, droop: 0.4 })),
    ]) },
  { id: 'bazaar.pipebloom', name: 'Pipe blossom', h: 1.8, size: [1.3, 2.1], patch: [2, 4], spread: 3, spacing: 1.2, weight: 1, sway: 0.04,
    build: () => merge([
      lathe([[0.2, 0], [0.32, 0.45], [0.35, 0.5], [0, 0.5]], '#c8643a', 12),
      ...around(5, (i, a) => {
        const at = [Math.cos(a) * 0.12, 0.5, Math.sin(a) * 0.12], top = 0.6 + (i % 3) * 0.35;
        return [cyl(0.02, 0.018, top, '#4f6b3a', 4, at), lathe([[0.02, 0], [0.05, 0.12], [0.1, 0.22], [0.16, 0.27], [0.0, 0.2]], i % 2 ? '#52c8cf' : '#d9508a', 9, [at[0], 0.5 + top, at[2]])];
      }),
    ]) },
  { id: 'bazaar.tinstar', name: 'Tin star', h: 0.65, size: [0.45, 0.8], patch: [2, 5], spread: 2.5, spacing: 0.8, weight: 1,
    build: () => merge([
      box(0.42, 0.3, 0.42, '#f6dcb0'), box(0.44, 0.06, 0.44, '#c8483a', [0, 0.2, 0]),
      ...around(4, (i, a) => {
        const at = [Math.cos(a) * 0.09, 0.3, Math.sin(a) * 0.09], top = 0.18 + (i % 2) * 0.12;
        return [cyl(0.01, 0.01, top, '#4f6b3a', 4, at), disc(0.1, 0.02, '#f2c54b', 12, [at[0], 0.3 + top, at[2]], [0.3, a, 0], (q) => (Math.cos(q * 6) > 0 ? 1 : 0.45)), disc(0.03, 0.03, '#2b2f45', 6, [at[0], 0.31 + top, at[2]], [0.3, a, 0])];
      }),
    ]) },
  { id: 'bazaar.gutter', name: 'Gutter puff', h: 0.25, size: [0.15, 0.32], patch: [4, 10], spread: 2.5, spacing: 0.35, weight: 1.1, shadow: false,
    build: () => merge([
      ...around(4, (i, a) => { const at = [Math.cos(a) * 0.05, 0.16 + (i % 2) * 0.06, Math.sin(a) * 0.05]; return [cyl(0.006, 0.006, at[1], '#6f8a42', 3, [at[0], 0, at[2]]), ball(0.045, '#f8f6ee', at, 1)]; }),
      ...around(3, (i, a) => leaf(0.16, 0.05, 0.015, '#6f8a42', { up: 0.15, yaw: a, droop: 0.05 })),
    ]) },
  { id: 'bazaar.creeper', name: 'Kerb creeper', h: 0.7, size: [0.5, 0.9], patch: [2, 5], spread: 3, spacing: 0.9, weight: 0.9,
    build: () => {
      const r = seeded('bazaar.creeper');
      return merge([
        dome(0.45, 0.55, 0.4, '#2f5a3a', [0, 0, 0], 8, 3),
        ...Array.from({ length: 16 }, (_, i) => { const a = r() * TAU, e = 0.2 + r() * 1.1; return ell(0.15, 0.03, 0.13, i % 2 ? '#3f6b45' : '#5a8a4f', [Math.cos(a) * 0.45 * Math.cos(e), 0.55 * Math.sin(e) + 0.02, Math.sin(a) * 0.4 * Math.cos(e)], [0.6 - e * 0.5, Math.PI / 2 - a, 0], 6, 3); }),
      ]);
    } },
];

// ------------------------------------------------------------------ small helpers
/** Narrow coral bands round a lathe (the sky bladder). */
function paintBands(g) { return paint(g, (x, y, z) => (Math.cos(Math.atan2(z, x) * 6) > 0.75 ? '#e8a68e' : '#f3ead8')); }
function paintCapsule(r, len, col) { return paint(new THREE.CapsuleGeometry(r, len, 3, 7), col); }
function paintHalfDisc(r, h, col) { return paint(new THREE.CylinderGeometry(r, r * 0.9, h, 10, 1, false, -Math.PI / 2, Math.PI), col); }

// ======================================================================= home: peach grass, lilac and teal, round as the house
const HOME = [
  { id: 'home.umbrella', name: 'Little umbrella tree', h: 5.6, size: [4, 7], large: true, collide: [0.25, 3.8], patch: [1, 3], spread: 10, spacing: 5, weight: 0.5, with: ['home.puff', 'home.peach'], sway: 0.08,
    build: () => merge([
      tube([[0, 0, 0], [0.2, 2.2, 0.05], [-0.15, 4.2, -0.05], [0.25, 5.3, 0]], 0.2, 0.12, '#8a5a3c', 6, 10),
      disc(2.3, 0.35, '#3f9f98', 18, [0.25, 5.2, 0], [0, 0, 0], (a) => 1 + 0.05 * Math.sin(a * 5)),
      disc(2.35, 0.08, '#f2c49a', 18, [0.25, 5.14, 0]),
      disc(1.3, 0.28, '#5fb7ad', 14, [-0.1, 3.9, 0.1]),
      disc(1.33, 0.06, '#f2c49a', 14, [-0.1, 3.86, 0.1]),
    ]) },
  { id: 'home.cypress', name: 'Round cypress', h: 4.4, size: [3, 5.6], large: true, collide: [0.4, 3], patch: [2, 4], spread: 6, spacing: 2.6, weight: 0.5, with: ['home.daisy'], sway: 0.05,
    build: () => merge([
      cyl(0.16, 0.12, 0.8, '#8a5a3c', 6),
      ell(0.9, 1.9, 0.9, '#3f8f8a', [0, 2.4, 0], [0, 0, 0], 10, 8),
      ell(0.6, 0.9, 0.6, '#5fb7ad', [0.1, 3.9, 0.05], [0, 0, 0], 8, 6),
    ]) },
  { id: 'home.puff', name: 'Puffball bush', h: 1.1, size: [0.7, 1.5], patch: [3, 7], spread: 4, spacing: 1.1, weight: 1, with: ['home.daisy'], sway: 0.03,
    build: () => merge([ball(0.55, '#5fb7ad', [0, 0.5, 0], 1, [1, 0.9, 1]), ball(0.32, '#3f8f8a', [0.35, 0.3, 0.2], 1), ball(0.28, '#b9a3c9', [-0.3, 0.75, -0.1], 1)]) },
  { id: 'home.peach', name: 'Peach grass', h: 0.9, size: [0.6, 1.2], patch: [8, 18], spread: 4, spacing: 0.45, weight: 1.6, shadow: false, sway: 0.12,
    build: () => merge(around(7, (i, a) => blade(0.6 + (i % 3) * 0.15, 0.08, i % 2 ? '#e3a97c' : '#f2c49a', { lean: 0.25 + (i % 2) * 0.15, yaw: a }))) },
  { id: 'home.daisy', name: 'Hill daisies', h: 0.35, size: [0.25, 0.45], patch: [8, 16], spread: 3, spacing: 0.35, weight: 1.2, shadow: false, sway: 0.04,
    build: () => merge(around(5, (i, a) => {
      const at = [Math.cos(a) * 0.1, 0.25 + (i % 2) * 0.08, Math.sin(a) * 0.1];
      return [tube([[0, 0, 0], at], 0.012, 0.01, '#5f9a4a', 3, 2), disc(0.055, 0.01, i % 3 ? '#f7f4ec' : '#f2c54b', 8, at), ball(0.02, '#e8a33a', [at[0], at[1] + 0.012, at[2]])];
    })) },
  { id: 'home.bells', name: 'Lilac bell stalks', h: 1.4, size: [0.9, 1.7], patch: [4, 9], spread: 3, spacing: 0.6, weight: 0.8, sway: 0.08,
    build: () => merge([
      tube([[0, 0, 0], [0.05, 0.7, 0], [0.12, 1.3, 0]], 0.025, 0.015, '#5f9a6a', 4, 5),
      ...[0.6, 0.8, 1.0, 1.15, 1.3].map((y, i) => lathe([[0.001, 0], [0.05, 0.02], [0.065, 0.08], [0.04, 0.11]], i % 2 ? '#b9a3c9' : '#a99be0', 7, [0.06 + y * 0.05 + (i % 2 ? 0.06 : -0.06), y - 0.12, 0], [Math.PI, 0, 0])),
      leaf(0.35, 0.09, 0.02, '#7fb069', { up: 0.4, yaw: 0.5, droop: 0.4 }), leaf(0.3, 0.08, 0.02, '#7fb069', { up: 0.5, yaw: 3.6, droop: 0.4 }),
    ]) },
];

export const SPECIES = { home: HOME, desert: DESERT, incal: INCAL, arzach: ARZACH, arzach2: ARZACH2, garage: GARAGE, buried: BURIED, edena: EDENA, spheres: SPHERES, perdide: PERDIDE, perdide2: PERDIDE2, bazaar: BAZAAR };
