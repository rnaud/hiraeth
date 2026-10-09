import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeMaterial, MODE_RIBBON } from './materials.js';

// The fluid sword's model (the selected design: references/Core Objects/Reviewed Gadgets/Fluid Sword -
// Selected 2026-10-09/reference-3.jpeg), held and swung by src/fluid-blade.js:
//
//   - the hilt: a leather-wrapped grip (a spiral of bands with grooves between them), a brass collar over
//     the index finger that swells into a bulb and opens into an oval cup where the fluid comes out (a bead of
//     it always stands in the cup), and a brass pommel under the little finger with a small curled tail
//   - the blade: broad and liquid, narrow where it leaves the cup, splashing out to its full width a tenth of
//     the way up (its edges ragged there, as water thrown), the leading edge almost straight, the trailing edge
//     curving up into a long point; lens-shaped in section with a ridge down the middle. Drawn in turquoise
//     with sand-cream currents and deep teal pools flowing up it (src/materials.js fluid kind 'blade'), alive:
//     ripples, bubbles, a wobbling skin, bowed by the swing, a ring at each blow, a breathing glow (src/blade-shader.js)
//   - the wake: a ribbon of the fluid trailing off the outer half of the edge through a cut, falling and
//     tapering as it dissolves into print dots (one strip, rebuilt from the last few frames' blade)
//
// The hilt's frame is the grip's (src/blade-grip.js fistGrip): +y up the blade, +x the leading edge, z the flat.
// Origin the grip's middle, where the fingers close. Three draw calls held (grip, brass, the cup's bead), four
// with the blade lit, five through a cut.

/** The hilt (m, in its frame): the wrapped grip's ends, its radius, the wrap's bands; where the blade leaves the cup. */
export const HILT = {
  grip: [-0.082, 0.056], radius: 0.0145, band: 0.0135, raise: 0.0024,
  mouth: 0.1,   // y of the cup's lip: the blade starts just under it (BLADE.guard + 0.012 in fluid-blade.js)
  pommel: -0.128,
};
/** The blade's palette, from the sheet: turquoise body, sand-cream currents, deep teal pools, a pale and a gold rim, the ridge's light. */
export const SWORD_TONES = { base: '#38b8a9', cream: '#e7dca0', deep: '#1e8886', pale: '#b9f1e4', gold: '#e9c46e', light: '#f4fff9' };
/** The wake's bands (turquoise, pale, cream) and the drops' colours. */
export const WAKE_TONES = ['#3fbfae', '#7fdccb', '#e3d79c'];
/** The wake's strands: [from, to] along the blade (share of it), and their life (share of the cut's): one off the point, a thinner one off the middle. */
export const WAKE_STRANDS = [[0.8, 1.0, 1], [0.5, 0.6, 0.7]];

// the outline (x of each edge, m, for a blade 0.11 m at its widest, 1 long): the leading edge (+x) nearly
// straight, the trailing edge (-x) broad near the hilt and curving up into the point, which leans to the lead
const KEYS_V = [0, 0.04, 0.1, 0.18, 0.3, 0.45, 0.6, 0.75, 0.87, 0.95, 1];
const LEAD = [0.024, 0.04, 0.05, 0.053, 0.053, 0.051, 0.047, 0.04, 0.031, 0.022, 0.014];
const TRAIL = [-0.024, -0.044, -0.056, -0.058, -0.056, -0.05, -0.04, -0.026, -0.01, 0.004, 0.014];
const REF_W = 0.111;   // LEAD - TRAIL at the widest

/** Catmull-Rom through the keys at v (0..1). */
function spline(keys, v) {
  const n = KEYS_V.length;
  let i = 0;
  while (i < n - 2 && v > KEYS_V[i + 1]) i++;
  const t = THREE.MathUtils.clamp((v - KEYS_V[i]) / (KEYS_V[i + 1] - KEYS_V[i]), 0, 1);
  const p0 = keys[Math.max(0, i - 1)], p1 = keys[i], p2 = keys[i + 1], p3 = keys[Math.min(n - 1, i + 2)];
  const t2 = t * t, t3 = t2 * t;
  return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
}
/** A fixed jag in [-1, 1] (the ragged splash near the hilt: the same every build). */
const jag = (v, s) => Math.sin(v * 91.7 + s * 3.1) * 0.6 + Math.sin(v * 213.3 + s * 7.7) * 0.4;

/**
 * The blade's edges at `v` (0 at the cup, 1 the point) for a blade `width` m at its widest:
 * { lead, trail } x (m) of the leading and trailing edges (ragged near the hilt when `ragged`).
 */
export function bladeEdges(v, width = REF_W, ragged = true) {
  const k = width / REF_W;
  let lead = spline(LEAD, v) * k, trail = spline(TRAIL, v) * k;
  if (ragged && v < 0.3) {
    const a = 0.0065 * k * Math.pow(1 - v / 0.3, 1.5) * Math.min(1, v / 0.03);
    lead += a * 0.6 * jag(v, 1); trail -= a * (0.7 + 0.3 * jag(v, 2));
  }
  return { lead, trail };
}
/** The blade's width (m) at v. */
export const bladeWidthAt = (v, width = REF_W) => { const e = bladeEdges(v, width, false); return e.lead - e.trail; };

/**
 * The blade's mesh, `length` m from the cup (y 0) to the point, `width` m at its widest: two faces of a lens
 * (a ridge down the middle, thin at the edges, the edges split so the ink draws them). aFold: x across
 * (-1 the trailing edge .. 1 the leading), y along (0 .. 1), what the fluid's shader reads.
 */
export function bladeGeometry(length = 0.85, width = REF_W, { rows = 34, across = 7, thick = 0.0085 } = {}) {
  const pos = [], fold = [], idx = [];
  const vs = Array.from({ length: rows }, (_, i) => { const t = i / (rows - 1); return t < 0.5 ? 0.5 * Math.pow(2 * t, 1.25) : 1 - 0.5 * Math.pow(2 * (1 - t), 1.15); });
  for (const side of [1, -1]) {
    const base = pos.length / 3;
    for (const v of vs) {
      const { lead, trail } = bladeEdges(v, width);
      const w = Math.max(lead - trail, 1e-4), T = thick * Math.min(1, (w / width) * 1.15) * (v > 0.97 ? (1 - v) / 0.03 : 1);
      for (let j = 0; j < across; j++) {
        const u = -1 + (2 * j) / (across - 1), x = trail + ((u + 1) / 2) * (lead - trail);
        const z = side * T * Math.pow(Math.max(0, 1 - u * u), 0.7) + side * 0.0004;
        pos.push(x, v * length, z); fold.push(u, v);
      }
    }
    for (let i = 0; i < rows - 1; i++) for (let j = 0; j < across - 1; j++) {
      const a = base + i * across + j, b = a + 1, c = a + across, d = c + 1;
      if (side > 0) idx.push(a, b, c, b, d, c); else idx.push(a, c, b, b, c, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aFold', new THREE.Float32BufferAttribute(fold, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** The wrapped grip: a cylinder whose radius rises in flat bands spiralling round it, a groove between each. */
export function gripGeometry({ radial = 12, rows = 34 } = {}) {
  const [y0, y1] = HILT.grip, pos = [], idx = [];
  for (let i = 0; i <= rows; i++) {
    const y = y0 + ((y1 - y0) * i) / rows;
    for (let j = 0; j <= radial; j++) {
      const a = (j / radial) * Math.PI * 2, f = ((y / HILT.band - j / radial) % 1 + 1) % 1;
      const band = THREE.MathUtils.smoothstep(f, 0, 0.14) * (1 - THREE.MathUtils.smoothstep(f, 0.86, 1));
      const r = HILT.radius * (1 + 0.04 * (i / rows)) + HILT.raise * band;
      pos.push(Math.cos(a) * r, y, Math.sin(a) * r);
    }
  }
  for (let i = 0; i < rows; i++) for (let j = 0; j < radial; j++) {
    const a = i * (radial + 1) + j, b = a + 1, c = a + radial + 1, d = c + 1;
    idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}

const lathe = (pts, seg = 12) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg);
/** The brass: the collar (a ring, a bulb with two studs, an oval cup) and the pommel with its curled tail, one geometry. */
export function brassGeometry() {
  const collar = lathe([[0.0, 0.049], [0.015, 0.05], [0.0185, 0.053], [0.0195, 0.058], [0.0178, 0.062], [0.0212, 0.068], [0.0245, 0.076], [0.0226, 0.083],
    [0.0186, 0.087], [0.0212, 0.091], [0.0262, 0.096], [0.0276, HILT.mouth], [0.0258, HILT.mouth + 0.004], [0.0205, HILT.mouth + 0.003], [0.015, 0.094]]);
  // (the cup opens oval, along the edge: the broad blade comes out of it)
  const p = collar.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const k = THREE.MathUtils.smoothstep(p.getY(i), 0.084, 0.098);
    p.setX(i, p.getX(i) * (1 + 0.45 * k)); p.setZ(i, p.getZ(i) * (1 - 0.15 * k));
  }
  collar.computeVertexNormals();
  const studs = [-1, 1].map((s) => new THREE.SphereGeometry(0.0052, 6, 4).translate(s * 0.0248, 0.076, 0));
  const pommel = lathe([[0.0, -0.077], [0.015, -0.078], [0.019, -0.082], [0.0202, -0.087], [0.0176, -0.09], [0.0214, -0.097], [0.0226, -0.104], [0.0192, -0.111],
    [0.0112, -0.116], [0.0086, -0.119], [0.0092, -0.123], [0.0052, -0.127], [0.0, HILT.pommel]]);
  const curl = new THREE.CatmullRomCurve3([[0, -0.124, 0], [0.011, -0.133, 0], [0.025, -0.132, 0], [0.032, -0.122, 0], [0.026, -0.113, 0]].map((a) => new THREE.Vector3(...a)));
  const tail = new THREE.TubeGeometry(curl, 12, 0.0026, 5, false);
  return mergeGeometries([collar, ...studs, pommel, tail].map((g) => { g.deleteAttribute('uv'); return g; }));
}

/**
 * How a cut trails its fluid (`special` the attack: null for the combo; CHARGE/AIR/RIPOSTE/DASH and the others
 * by their `clip`; `full` a charge held to full): how much wider than WAKE_STRANDS its strands are, its life (s),
 * drops shed a frame, their size, fall and colours, and its tones.
 */
export function wakeStyle(special = null, full = false) {
  const clip = special?.clip ?? '';
  const S = { wide: 1, life: 0.2, drops: 2, size: 0.012, grav: 7, tones: WAKE_TONES, dropTones: WAKE_TONES.slice(0, 2) };
  if (/gs_slash_1/.test(clip)) Object.assign(S, full ? { wide: 1.8, life: 0.3, drops: 5, size: 0.016 } : { wide: 1.4, life: 0.26, drops: 3, size: 0.014 });   // the charged cut
  else if (/jump_attack/.test(clip)) Object.assign(S, { wide: 1.2, life: 0.24, drops: 3, grav: 12 });   // the air cut: thrown down with it
  else if (/ss_slash_4/.test(clip)) Object.assign(S, { wide: 1.4, life: 0.26, drops: 4, size: 0.014, tones: ['#ffd46b', WAKE_TONES[0], WAKE_TONES[2]], dropTones: ['#ffd46b', WAKE_TONES[0]] });   // the riposte: gold in it
  else if (/ss_attack_2/.test(clip)) Object.assign(S, { wide: 1, life: 0.32, drops: 3, grav: 4 });   // the dash cut: a long streak
  else if (/high_spin|slide_attack/.test(clip)) Object.assign(S, { wide: 1.2, life: 0.24, drops: 3 });   // the grown whirl and lunge
  return S;
}

/** The blade's material (one, shared): src/materials.js fluid kind 'blade'. */
export function swordMaterial() {
  const T = SWORD_TONES;
  return makeMaterial({ color: '#ffffff', fluid: 'blade', glow: 0.5, fluidBase: T.base, fluidTones: [T.cream, T.deep, T.pale, T.gold, T.base, T.light], key: 'fluid-sword' });
}

/** The sword's meshes: { group (the hilt's frame), blade (its own group, y 0 at the cup), wake, material }. */
export function buildSword({ length = 0.85, width = REF_W, bladeBase = HILT.mouth } = {}) {
  const fluid = swordMaterial();
  const brass = makeMaterial({ color: '#d6aa58', metal: 'brass', key: 'fluid-sword-brass' });
  const leather = makeMaterial({ color: '#6b4630', key: 'fluid-sword-grip' });
  const hilt = new THREE.Group();
  const grip = new THREE.Mesh(gripGeometry(), leather), metal = new THREE.Mesh(brassGeometry(), brass);
  // the bead of fluid standing in the cup (the blade's root while it is out)
  const bead = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 5).scale(0.029, 0.007, 0.017).translate(0, HILT.mouth + 0.001, 0), fluid);
  grip.name = 'grip'; metal.name = 'brass'; bead.name = 'bead';
  hilt.add(grip, metal, bead);
  const core = new THREE.Mesh(bladeGeometry(length, width), fluid);
  core.name = 'blade';
  const blade = new THREE.Group();
  blade.position.y = bladeBase;
  blade.add(core);
  const group = new THREE.Group();
  group.add(blade, hilt);
  return { group, hilt, blade, core, material: fluid, builtLength: length, builtWidth: width };
}

/**
 * The wake: ribbons of fluid trailing off the edge through a cut (world space; WAKE_STRANDS: one off the point,
 * a thinner, shorter one off the middle). Each frame of a cut lays the blade's segment down; older ones fall
 * (gravity), narrow to their outer edge and dissolve into print dots (MODE_RIBBON: aFold.y the age), the colour
 * bands fixed along them (aFold.x). One mesh for all the strands.
 */
export class BladeWake {
  constructor(parent, { samples = 16, strands = WAKE_STRANDS } = {}) {
    this.n = samples; this.strands = strands; this.list = []; this.time = 0; this.laid = 0;
    const nV = samples * 2 * strands.length;
    this.pos = new Float32Array(nV * 3); this.nrm = new Float32Array(nV * 3); this.fold = new Float32Array(nV * 2);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('normal', new THREE.BufferAttribute(this.nrm, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aFold', new THREE.BufferAttribute(this.fold, 2).setUsage(THREE.DynamicDrawUsage));
    const idx = [];
    for (let k = 0; k < strands.length; k++) for (let i = 0; i < samples - 1; i++) { const a = (k * samples + i) * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    g.setIndex(idx); g.setDrawRange(0, 0);
    this.geo = g;
    this.mat = makeMaterial({ color: '#ffffff', mode: MODE_RIBBON, glow: 0.45, fluid: 'trail', fluidTones: WAKE_TONES, side: THREE.DoubleSide, key: 'fluid-sword-wake' });
    this.mat.uniforms.uFluidA.value.y = WAKE_TONES.length;
    this.mesh = new THREE.Mesh(g, this.mat);
    this.mesh.name = 'blade wake'; this.mesh.frustumCulled = false; this.mesh.visible = false;
    this.mesh.userData.noCollide = true; this.mesh.userData.dynamic = true;
    parent?.add(this.mesh);
    this._a = new THREE.Vector3(); this._b = new THREE.Vector3(); this._t = new THREE.Vector3(); this._s = new THREE.Vector3();
  }

  /** Strand `k`'s edges for a laid segment `s` at `age` (0..1), `wide` (wakeStyle): inner into a (returned), outer into b. */
  edges(s, k, age, wide, a, b) {
    const [from, to] = this.strands[k], inner = Math.max(0.15, to - (to - from) * wide);
    b.lerpVectors(s.a, s.b, to);
    return a.lerpVectors(s.a, s.b, inner).lerp(b, 0.8 * Math.pow(age, 0.8));   // (narrowing to its outer edge as it ages)
  }

  /** Lay the blade's segment `seg` ({a, b}: cup to point, world) if `cutting`, age the rest; `style` wakeStyle; `up` the world's up. */
  update(dt, seg, cutting, style, up) {
    this.time += dt;
    const S = style ?? this.style ?? wakeStyle();
    this.style = S;
    if (cutting && seg) {
      this.list.unshift({ a: seg.a.clone(), b: seg.b.clone(), t: this.time, d: this.laid++, life: S.life, wide: S.wide });
      if (this.list.length > this.n) this.list.length = this.n;
    }
    while (this.list.length && this.time - this.list[this.list.length - 1].t > this.list[this.list.length - 1].life) this.list.pop();
    const L = this.list, m = L.length;
    this.mesh.visible = m >= 2;
    if (m < 2) { this.geo.setDrawRange(0, 0); return; }
    if (S.tones !== this._tones) { this._tones = S.tones; this.mat.uniforms.uFluidTones.value.forEach((c, i) => c.set(S.tones[i % S.tones.length])); this.mat.uniforms.uFluidA.value.y = S.tones.length; }
    const U = up ?? this._s.set(0, 1, 0).clone(), N = this.n;
    for (let k = 0; k < this.strands.length; k++) {
      const lifeK = this.strands[k][2] ?? 1, ageOf = (s) => THREE.MathUtils.clamp((this.time - s.t) / (s.life * lifeK), 0, 1);
      let last = 0;
      for (let i = 0; i < m; i++) if (ageOf(L[i]) < 1) last = i;
      for (let i = 0; i < N; i++) {
        const o = (k * N + i) * 2, src = L[Math.min(i, last)], age = i <= last ? ageOf(src) : 1, since = this.time - src.t;
        const fall = 0.5 * S.grav * 0.25 * since * since;   // (falling as water does)
        const a = this.edges(src, k, age, src.wide ?? 1, this._a, this._b);
        a.addScaledVector(U, -fall * 0.6); this._b.addScaledVector(U, -fall);
        if (i > last) a.copy(this._b);   // (past this strand's life or the laid samples: folded to a point, nothing drawn)
        a.toArray(this.pos, o * 3); this._b.toArray(this.pos, o * 3 + 3);
        this.fold[o * 2] = this.fold[o * 2 + 2] = src.d * 0.45 + k * 0.5;
        this.fold[o * 2 + 1] = this.fold[o * 2 + 3] = 0.25 + age * 0.75;
      }
    }
    // normals: along the strip × across it (inner to outer)
    for (let k = 0; k < this.strands.length; k++) for (let i = 0; i < N; i++) {
      const o = (k * N + i) * 2, j = (k * N + Math.min(i + 1, N - 1)) * 2, h = (k * N + Math.max(i - 1, 0)) * 2;
      this._t.fromArray(this.pos, j * 3).sub(this._a.fromArray(this.pos, h * 3));
      this._s.fromArray(this.pos, o * 3 + 3).sub(this._b.fromArray(this.pos, o * 3));
      const n = this._t.cross(this._s);
      if (n.lengthSq() < 1e-14) n.copy(U); else n.normalize();
      n.toArray(this.nrm, o * 3); n.toArray(this.nrm, o * 3 + 3);
    }
    for (const k of ['position', 'normal', 'aFold']) this.geo.attributes[k].needsUpdate = true;
    this.geo.setDrawRange(0, this.geo.index.count);
  }

  clear() { this.list.length = 0; this.mesh.visible = false; this.geo.setDrawRange(0, 0); }
  dispose() { this.mesh.removeFromParent(); this.geo.dispose(); }
}
