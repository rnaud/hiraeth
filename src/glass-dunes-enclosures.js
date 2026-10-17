import * as THREE from 'three';
import { mulberry32, smoothstep } from './noise.js';
import { GLASS_ATTR } from './dune-glass-shader.js';

// The selected cleft has inflated cells in two directions, unlike the long
// vertical folds of the older dunes. Keep these forms local to the new places.
function cellField(seed, size = 6) {
  const cells = new Map();
  const get = (x, y) => {
    const key = `${x},${y}`;
    if (!cells.has(key)) {
      const r = mulberry32((seed + x * 73856093 + y * 19349663) >>> 0);
      cells.set(key, { x: x + .5 + (y % 2) * .35 + (r() - .5) * .4, y: y + .5 + (r() - .5) * .4, tone: .9 + r() * .2 });
    }
    return cells.get(key);
  };
  return (u, v) => {
    const x = u / size, y = v / (size * .88), ix = Math.floor(x), iy = Math.floor(y);
    let first = Infinity, second = Infinity, tone = 1;
    for (let a = ix - 2; a <= ix + 2; a++) for (let b = iy - 2; b <= iy + 2; b++) {
      const c = get(a, b), d = (x - c.x) ** 2 + (y - c.y) ** 2;
      if (d < first) { second = first; first = d; tone = c.tone; }
      else if (d < second) second = d;
    }
    // Zero on shared borders, a rounded belly within each irregular cell.
    return { belly: Math.sqrt(Math.max(0, 1 - first / Math.max(second, 1e-5))), tone };
  };
}

/** Inflate the front of a ridge into fused rounded lobes; retain its solid back. */
export function cellularRidge(ridge, { seed = 1, size = 6, depth = 3 } = {}) {
  const { geo, frames, length } = ridge, p = geo.attributes.position, c = geo.attributes.color, a = geo.attributes[GLASS_ATTR];
  const rows = p.count / frames.length, field = cellField(seed, size), shade = new THREE.Color();
  for (let i = 0; i < frames.length; i++) {
    const f = frames[i], u = i / (frames.length - 1) * length;
    for (let j = 0; j < rows; j++) {
      const k = i * rows + j, y = p.getY(k) - f.g, t = j / (rows - 1);
      const { belly, tone } = field(u, y);
      const face = 1 - smoothstep(.38, .59, t);
      const end = Math.min(smoothstep(0, 4, u), smoothstep(0, 4, length - u));
      const push = depth * belly * face * end * smoothstep(-1, 1, y);
      p.setXYZ(k, p.getX(k) - f.nx * push, p.getY(k), p.getZ(k) - f.nz * push);
      shade.set('#4f835d').lerp(new THREE.Color('#94b479'), .22 + .36 * belly + .14 * Math.min(1, y / f.h));
      shade.multiplyScalar(tone * (.76 + .24 * belly));
      c.setXYZ(k, shade.r, shade.g, shade.b);
      // Thick green glass, with rounded shading instead of vertical light streaks.
      a.setXYZW(k, 100, .1 + .1 * belly, belly * .82, Math.max(0, y / f.h));
    }
  }
  p.needsUpdate = true; geo.computeVertexNormals(); geo.computeBoundingSphere();
  return ridge;
}

/** Rounded, embedded cells carry the lobed surface around the cleft's opening. */
export function cellularVault(batch, mat, q, seed = 41, cellScale = 1) {
  const rng = mulberry32(seed), up = new THREE.Vector3(0, 1, 0);
  const across = new THREE.Vector3(q.nz, 0, -q.nx), into = new THREE.Vector3(q.nx, 0, q.nz);
  const r = q.w / 2 + 2.3, shoulder = q.h - q.w / 2;
  const ring = [];
  for (const side of [-1, 1]) for (let y = 1; y < shoulder; y += 5 * cellScale) ring.push([side * r, y]);
  for (let i = 0; i <= Math.ceil(11/cellScale); i++) { const a = i / Math.ceil(11/cellScale) * Math.PI; ring.push([Math.cos(a) * r, shoulder + Math.sin(a) * r]); }
  for (let row = 0; row < 4; row++) for (const [x, y] of ring) {
    const g = new THREE.SphereGeometry(1, 20, 14);
    g.deleteAttribute('uv');
    g.scale((3.8 + rng() * .6)*cellScale, (3.7 + rng() * .8)*cellScale, (3.7 + rng() * .5)*cellScale);
    g.rotateY(Math.atan2(q.nx, q.nz));
    const centre = new THREE.Vector3(q.x, q.y, q.z).addScaledVector(across, x + (rng() - .5) * 1.6).addScaledVector(up, y + (rng() - .5) * 1.8).addScaledVector(into, -1 + row * 5 + (rng() - .5) * 2);
    g.translate(...centre.toArray());
    const count = g.attributes.position.count, color = new Float32Array(count * 3), glass = new Float32Array(count * 4);
    const tone = new THREE.Color('#6d996b').multiplyScalar(.83 + rng() * .22);
    for (let i = 0; i < count; i++) { color.set(tone.toArray(), i * 3); glass.set([100, .12, .5, .6], i * 4); }
    g.setAttribute('color', new THREE.BufferAttribute(color, 3));
    g.setAttribute(GLASS_ATTR, new THREE.BufferAttribute(glass, 4));
    batch.add(mat, g);
  }
}

/** A roofed chamber with a thick open mouth, solid back and an irregular glass ceiling. */
export function glassCave(kit, mat, { x, y, z, scale=[1,1,1] }) {
  const sections = new THREE.CatmullRomCurve3([
    new THREE.Vector3(19, 27, 31), new THREE.Vector3(28, 34, 22),
    new THREE.Vector3(36, 39, 3), new THREE.Vector3(35, 42, -23),
    new THREE.Vector3(29, 35, -40),
  ], false, 'centripetal'); // width, height, distance along the chamber
  const ns = 96, na = 160, stride = na + 1, layer = (ns + 1) * stride;
  const positions = [], colors = [], glass = [], indices = [];
  const dark = new THREE.Color('#285f4d'), light = new THREE.Color('#92c59a');
  for (let side = 0; side < 2; side++) for (let i = 0; i <= ns; i++) {
    const s = sections.getPoint(i / ns), shell = side ? 7 : 0;
    for (let j = 0; j <= na; j++) {
      const theta = j / na * Math.PI, sy = Math.sin(theta);
      const fold = Math.sin(theta * 19 + s.z * .12 + Math.sin(s.z * .18 + theta * 4) * .75) + .35 * Math.sin(theta * 37 - s.z * .1);
      const broad = Math.sin(theta * 5 + s.z * .08) * 2.5;
      const roof = Math.pow(sy, .75), ripple = (fold * 2.8 + broad) * sy;
      positions.push(x + Math.cos(theta) * (s.x + shell + ripple), y - 2 + roof * (s.y + shell) + ripple, z + s.z - shell * (i / ns) ** 5);
      const col = dark.clone().lerp(light, .38 + fold * .2 + (1 - sy) * .16);
      if (side) col.multiplyScalar(1.14);
      colors.push(col.r, col.g, col.b); glass.push(100, .12 + .5 * Math.max(0, fold) * (.72 + .28 * Math.sin(s.z * .3 + theta * 9)), .45 + fold * .25, 2);
    }
  }
  // The inner surface faces into the chamber, the outer surface into the landscape.
  for (let side = 0; side < 2; side++) for (let i = 0; i < ns; i++) for (let j = 0; j < na; j++) {
    const a = side * layer + i * stride + j, b = a + 1, d = a + stride, c = d + 1;
    if (side) indices.push(a, c, b, a, d, c); else indices.push(a, b, c, a, c, d);
  }
  // A broad, irregular lip joins both surfaces around the open entrance.
  for (let j = 0; j < na; j++) indices.push(j, layer + j + 1, j + 1, j, layer + j, layer + j + 1);
  // A folded rear wall closes the chamber, with its own normals at the seam.
  // Radial rings avoid the giant fan triangles that flatten the cave's far wall.
  for (let side = 0; side < 2; side++) {
    const first = positions.length / 3, rings = 36, end = side * layer + ns * stride;
    for (let i = 0; i <= rings; i++) for (let j = 0; j <= na; j++) {
      const t = i / rings, k = (end + j) * 3;
      const xx = (positions[k] - x) * t, yy = (positions[k + 1] - y + 2) * t;
      const fold = Math.sin(xx * .72 + yy * .06) + .35 * Math.sin(xx * 1.8 - yy * .14);
      positions.push(x + xx, y - 2 + yy, z - 40 - (side ? 7 : 0) + (fold * 2 + 2) * Math.sin(t * Math.PI));
      const col = dark.clone().lerp(light, .35 + fold * .22);
      colors.push(col.r, col.g, col.b); glass.push(100, .12 + .48 * Math.max(0, fold), .5 + fold * .25, 2);
      if(i < rings && j < na) {
        const a = first + i * stride + j, b = a + 1, d = a + stride, c = d + 1;
        if(side) indices.push(a,b,c,a,c,d); else indices.push(a,c,b,a,d,c);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  g.setAttribute(GLASS_ATTR, new THREE.Float32BufferAttribute(glass, 4));
  g.setIndex(indices);
  const pos=g.attributes.position;for(let i=0;i<pos.count;i++)pos.setXYZ(i,x+(pos.getX(i)-x)*scale[0],y+(pos.getY(i)-y)*scale[1],z+31+(pos.getZ(i)-z-31)*scale[2]);
  g.computeVertexNormals();
  // (no shadow: the sun comes through the glass and lights the court, as in the plate)
  const cave = kit.mesh(g, mat, { shadow: false }); cave.name = 'The courtyard cave — roof, walls and mouth';
  return cave;
}
