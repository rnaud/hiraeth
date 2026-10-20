import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeMaterial } from './materials.js';
import { rough } from './desert-hearth.js';

// The fragments' markers (issue #550, its second pass: "Where a world lacks reachable landmarks, add small ones where the
// fragments need to go"): where a world's places of interest are full (two fragments a place, tests/fragments-reach.js
// PLACE_CAP) and its fragments would otherwise bunch on them and leave the rest of it empty, the rest are set out over
// it, each on a little prop of that world's own: a cairn of flat stones as the pilgrims stack them in the open worlds
// (src/desert-road.js), a squat stone plinth in the built ones. Each a place of its own (`markerName`), one fragment on
// it; the fragment floats just over its top (src/fragments.js FRAGMENT.lift). Picked by scripts/fragment-spots.mjs
// --anchors with the fragments themselves: FRAGMENT_MARKERS is its output, [x, y, z] the ground under each.
//
// Drawn as one mesh a world (one draw), no collision (you walk up to it and the fragment is yours from 1.5 m), built by
// src/fragments.js createFragments, so on the web and in the engines alike. They stay when the fragment is taken.

/** The markers, world by world: [x, y, z] (the ground there), each under one fragment (src/fragments-data.js FRAGMENT_PLACES). */
export const FRAGMENT_MARKERS = {
  desert: [
    [-450.0, 3.74, -268.1],
    [-124.0, 32.03, -510.1],
    [392.0, 1.94, 785.9],
  ],
  arzach: [
    [214.0, 40.00, -572.0],
    [262.0, 34.84, -1106.0],
    [216.0, 40.00, -822.0],
    [222.0, 37.88, -166.0],
    [458.0, 44.18, -890.0],
    [-620.0, 41.39, -1588.0],
    [-808.0, 43.60, -906.0],
    [-148.0, 26.19, -1756.0],
    [460.0, 22.18, -1304.0],
    [-86.0, 37.21, 52.0],
    [-856.0, 31.11, -1286.0],
    [216.0, 47.32, -1648.0],
    [-324.0, 47.58, -1496.0],
  ],
  perdide: [
    [-428.0, 2.63, 60.0],
    [674.0, 21.05, -624.0],
    [-696.0, 37.83, -446.0],
    [-638.0, 0.18, 238.0],
    [448.0, 1.56, -176.0],
    [-536.0, 0.10, -810.0],
    [430.0, 2.36, 422.0],
    [-412.0, 6.17, -162.0],
    [394.0, 1.09, -858.0],
    [304.0, 1.38, -468.0],
    [-302.0, 1.34, -950.0],
    [684.0, 4.74, -356.0],
    [-362.0, 0.08, -626.0],
  ],
  edena: [
    [-202.0, 12.69, 638.0],
    [264.0, 13.88, -404.0],
    [28.0, 1.60, -546.0],
    [-618.0, 23.18, 210.0],
    [624.0, 19.56, 282.0],
    [538.0, -9.56, -438.0],
    [-616.0, 5.77, -254.0],
    [76.0, 25.47, 694.0],
    [-372.0, 18.21, -574.0],
    [680.0, 12.16, -90.0],
    [392.0, 13.17, 572.0],
    [354.0, 7.58, 162.0],
  ],
  underwater: [[-103.8, -0.45, -126.9], [-25.8, -0.59, -182.9]],
  incal: [
    [746.0, 200.00, -14.0],
    [262.0, 200.00, -526.0],
    [214.0, 200.00, 696.0],
    [730.0, 200.00, 476.0],
    [-364.0, 200.00, -196.0],
    [606.0, 200.00, -396.0],
    [-100.0, 200.00, 522.0],
    [408.0, 200.00, 446.0],
    [502.0, 200.00, -650.0],
    [38.0, 200.00, -260.0],
    [-258.0, 150.00, 6.0],
    [968.0, 200.00, 88.0],
    [582.0, 200.00, 164.0],
    [-160.0, 150.00, -202.0],
  ],
  glassdunes: [
    [-554.0, 14.24, -130.0],
    [-556.0, 15.16, 198.0],
    [-324.0, 26.86, -242.0],
    [282.0, 1.51, -144.0],
    [-354.0, 67.89, 108.0],
    [-430.0, 14.04, 366.0],
    [552.0, 16.54, 302.0],
    [268.0, 14.16, 556.0],
    [454.0, 17.42, 478.0],
    [-556.0, 15.54, 532.0],
    [62.0, 12.40, 556.0],
    [556.0, 12.66, 100.0],
    [556.0, 15.86, -198.0],
    [-276.0, 15.44, 556.0],
  ],
  buried: [
    [226.0, 15.45, -60.0],
    [-466.0, 16.84, 580.0],
    [424.0, 11.78, -254.0],
    [-134.0, 11.09, 538.0],
    [-512.0, 4.17, -164.0],
    [444.0, 19.44, 454.0],
    [-572.0, 18.22, 400.0],
    [168.0, 17.27, 730.0],
    [366.0, 13.68, 118.0],
    [-172.0, 13.46, -592.0],
    [146.0, 17.07, 444.0],
    [-474.0, 16.76, 92.0],
    [-282.0, 17.20, 328.0],
    [42.0, 11.32, -528.0],
    [250.0, 9.24, -422.0],
    [582.0, 16.91, 190.0],
    [-250.0, 5.45, -290.0],
    [486.0, 18.32, -54.0],
  ],
  moonfoundry: [
    [156.0, 0.00, -181.0],
    [14.0, 13.06, -4.0],
    [-153.0, 0.00, 33.0],
    [-150.0, 0.00, -285.0],
    [103.0, 0.00, -283.0],
    [-54.0, 0.00, -280.0],
    [153.0, 0.00, 33.0],
    [155.0, 0.00, -50.0],
    [-125.0, 6.24, -46.0],
    [-154.0, 0.00, -206.0],
    [-153.0, 0.00, -131.0],
    [-11.0, 30.25, -212.0],
  ],
  spheres: [
    [610.0, -2.44, -270.0],
    [154.0, -0.46, -606.0],
    [-494.0, -4.26, 36.0],
    [432.0, 1.61, -458.0],
    [-326.0, 1.43, -302.0],
    [-314.0, -0.51, 56.0],
    [68.0, 4.54, -418.0],
    [390.0, 2.41, -288.0],
    [-66.0, -0.41, 8.0],
  ],
  spacecity: [
    [-68.0, 0.00, 15.0],
    [28.0, 0.00, -99.0],
    [27.0, 0.00, -43.0],
    [79.0, 66.00, -133.0],
    [95.0, 68.91, -126.0],
    [89.0, 42.92, -116.0],
    [-80.0, -4.00, -75.0],
    [-22.0, 0.00, -42.0],
    [-103.0, -4.00, -43.0],
  ],
  bazaar: [
    [-84.0, 0.00, -48.0],
    [-226.0, 0.00, -494.0],
    [208.0, 0.00, 158.0],
    [-272.0, 0.00, -240.0],
    [-216.0, 0.00, 158.0],
    [282.0, 0.00, -494.0],
    [282.0, 0.00, -220.0],
    [-4.0, 0.00, 178.0],
    [-6.0, 0.00, -466.0],
    [-128.0, 0.00, -338.0],
    [170.0, 0.00, 2.0],
    [-210.0, 0.00, 12.0],
    [-282.0, 0.00, -372.0],
    [220.0, 0.00, -374.0],
    [158.0, 0.00, -188.0],
    [62.0, 0.00, 68.0],
    [-146.0, 0.00, -182.0],
    [-64.0, 0.00, 68.0],
  ],
};

/** A marker's name as a place of interest. */
export const markerName = (i) => `the light’s cairn (${i + 1})`;

/** Each world's marker: a cairn of flat stones in the open worlds, a plinth in the built ones, in the world's own stone. */
export const MARKER_STYLE = {
  desert: { kind: 'cairn', color: '#cdb38f', color2: '#bfa27c' },
  arzach: { kind: 'cairn', color: '#cbb59a', color2: '#b49c80' },
  perdide: { kind: 'cairn', color: '#8f9b8c', color2: '#76857a' },
  edena: { kind: 'cairn', color: '#d6cfba', color2: '#bdb49c' },
  underwater: { kind: 'plinth', color: '#a9bcbd', color2: '#8ea4a6' },
  incal: { kind: 'plinth', color: '#e6dac2', color2: '#cdbfa3' },
  glassdunes: { kind: 'cairn', color: '#d9c4a2', color2: '#c2ab86' },
  buried: { kind: 'cairn', color: '#b79c7a', color2: '#9e8463' },
  moonfoundry: { kind: 'plinth', color: '#b2aaa0', color2: '#958d83' },
  spheres: { kind: 'plinth', color: '#e8e4d8', color2: '#d0cbbd' },
  spacecity: { kind: 'plinth', color: '#cbc2d8', color2: '#b0a6c0' },
  bazaar: { kind: 'plinth', color: '#bdb4a2', color2: '#a39a88' },
};
/** How tall a marker stands (m): under the fragment, which floats 0.9 m over the ground. */
export const MARKER_HEIGHT = 0.5;

/** One marker's geometry at (x, y, z): a cairn of three flat stones, or a plinth (a base, a drum, a cap). */
export function markerGeometry(kind, x, y, z, seed = 0) {
  const parts = [];
  if (kind === 'plinth') {
    parts.push(new THREE.CylinderGeometry(0.48, 0.52, 0.14, 10).translate(0, 0.07, 0));
    parts.push(new THREE.CylinderGeometry(0.3, 0.34, 0.28, 10).translate(0, 0.28, 0));
    parts.push(new THREE.CylinderGeometry(0.4, 0.36, 0.08, 10).translate(0, 0.46, 0));
  } else {
    let h = -0.04;
    for (let k = 0; k < 3; k++) {
      const r = 0.5 - k * 0.11, t = r * 0.5;
      parts.push(rough(new THREE.IcosahedronGeometry(r, 0).scale(1.2, 0.5, 1), 0.03, 3, seed * 7 + k).rotateY(seed * 1.7 + k * 0.9).translate(Math.sin(k * 2.1 + seed) * 0.04, h + t * 0.5, Math.cos(k * 1.7 + seed) * 0.04));
      h += t * 0.85;
    }
  }
  const g = mergeGeometries(parts.map((p) => {
    const q = p.index ? p.toNonIndexed() : p;
    for (const k of Object.keys(q.attributes)) if (k !== 'position' && k !== 'normal') q.deleteAttribute(k);
    return q;
  }));
  return g.translate(x, y, z);
}

/** The world's markers as one mesh (null where it has none), put in the scene; `physics` sets each on the ground there. */
export function buildFragmentMarkers(scene, levelId, physics = null) {
  const list = FRAGMENT_MARKERS[levelId] ?? [], style = MARKER_STYLE[levelId];
  if (!list.length || !style) return null;
  const geos = list.map(([x, y, z], i) => {
    const g = physics?.groundAt?.(x, y + 1.5, z, 4);
    return markerGeometry(style.kind, x, Number.isFinite(g) && Math.abs(g - y) < 0.8 ? g : y, z, i + 1);
  });
  const mesh = new THREE.Mesh(mergeGeometries(geos), makeMaterial({ color: style.color, color2: style.color2, flat: true, key: `fragment.markers.${style.kind}` }));
  mesh.name = 'The light’s cairns';
  mesh.userData.noCollide = true;
  scene?.add(mesh);
  return mesh;
}
