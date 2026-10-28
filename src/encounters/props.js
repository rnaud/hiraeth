import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeMaterial } from '../materials.js';
import { Flames } from '../story/flames.js';

// The things of an encounter site (issue #722; src/encounters/sites.js lays them out, index.js makes and keeps them):
// the camp's fire (stones, logs and the world's own flames, src/story/flames.js: it burns whoever stands in it, foe
// or traveller), the logs round it, a lookout's post with its rag, a nest's ring of stones and bones, a cairn, an
// ambush's sign (the sand twitching over what lies under it, or a shadow on the ground), and the foes' coffer: a
// little box of rough stone bound in brass, as the temples' coffers are (src/temples/pieces.js Coffer), shut until the
// site is cleared. Each is a few merged meshes in shared colours (one draw a colour), nothing solid (as the temples'
// coffer), every piece set on the ground under it.
//
//   const p = buildProp(type, { at: Vector3 (on the ground), heading, ground(x, z) → y, r, seed })
//   p.group · p.update(dt, t, near) · p.dispose()      (a coffer: p.open(k), p.wake(k))

/** The sand an ambush's mound is heaped of, world by world (its ground's own colour, near enough: a grey-tan mound read as a lid). */
export const SAND_TONES = { desert: '#eebf9f', glassdunes: '#f0cf97', buried: '#ecd5a2' };
export const PROP_COLORS = { wood: '#7a5a3c', bark: '#5b4330', stone: '#9c9184', dark: '#6f665c', bone: '#e9dfc6', cloth: '#b4493c', coffer: '#8f8170', trim: '#c9a04f', ink: '#2b211f', shade: '#3e3550', sand: '#cdb89a', lamp: '#f6c84e' };
const mat = (c) => makeMaterial({ color: PROP_COLORS[c] ?? c, key: `site.${c}` });
const T = (g, p = [0, 0, 0], r = [0, 0, 0], s = [1, 1, 1]) => { g.deleteAttribute('uv'); return g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(...p), new THREE.Quaternion().setFromEuler(new THREE.Euler(...r)), new THREE.Vector3(...s))); };
function meshOf(geos, m) {
  const g = mergeGeometries(geos.map((x) => (x.index ? x.toNonIndexed() : x)));
  geos.forEach((x) => x.dispose());
  const out = new THREE.Mesh(g, m);
  out.userData.noCollide = true;
  return out;
}
/** A seeded stream of numbers in [0, 1). */
const seeded = (s) => () => ((s = (s * 16807 + 11) % 2147483647) / 2147483647);

/**
 * A prop of `type` at `at` (its ground), turned to `heading`. `ground(x, z)`: the ground under a piece (each stone of a
 * ring sits on its own ground). Returns { group, update(dt, t, near), dispose() }.
 */
export function buildProp(type, { at, heading = 0, ground = null, r = 3.4, seed = 1, tone = null } = {}) {
  const group = new THREE.Group();
  group.name = `site ${type}`;
  group.position.copy(at); group.rotation.y = heading;
  group.userData.noCollide = true;
  const rnd = seeded(seed * 7919 + 13);
  // a piece's height off the group's own ground (local x, z), so a ring on a slope follows it
  const local = new THREE.Vector3();
  const lift = (x, z) => {
    if (!ground) return 0;
    local.set(x, 0, z).applyAxisAngle(_up, heading).add(at);
    const y = ground(local.x, local.z);
    return Number.isFinite(y) && Math.abs(y - at.y) < 1.5 ? y - at.y : 0;
  };
  const parts = {};   // colour → geometries
  const put = (c, g) => (parts[c] ??= []).push(g);
  const P = { group, update() {}, dispose() { group.traverse((o) => o.geometry?.dispose?.()); group.removeFromParent(); P.flames?.geo.dispose(); } };
  if (type === 'fire') {
    for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI * 2, x = Math.sin(a) * 1.0, z = Math.cos(a) * 1.0; put(i % 3 ? 'stone' : 'dark', T(new THREE.IcosahedronGeometry(0.3, 0), [x, lift(x, z) + 0.1, z], [a, a * 2, 0], [1, 0.7, 1])); }
    for (let i = 0; i < 3; i++) put('bark', T(new THREE.CylinderGeometry(0.12, 0.13, 1.5, 6), [0, lift(0, 0) + 0.2, 0], [Math.PI / 2, i * 1.05, 0.25]));
    put('ink', T(new THREE.CircleGeometry(0.85, 10).rotateX(-Math.PI / 2), [0, lift(0, 0) + 0.03, 0]));   // (the burnt ground under it)
    const y0 = lift(0, 0) + 0.2;
    P.flames = new Flames(group, [{ at: new THREE.Vector3(0, y0, 0), h: 1.9, r: 0.55 }, { at: new THREE.Vector3(0.28, y0, -0.16), h: 1.3, r: 0.38, phase: 2 }, { at: new THREE.Vector3(-0.24, y0, 0.2), h: 1.4, r: 0.4, phase: 4 }, { at: new THREE.Vector3(0, y0 + 0.05, 0), h: 1, r: 0.3, core: 1, phase: 1 }], { seed: seed * 5 });
    P.update = (dt, t, near) => { if (near) P.flames.update(dt, t); };
  } else if (type === 'log') {
    put('bark', T(new THREE.CylinderGeometry(0.2, 0.22, 1.7, 7), [0, lift(0, 0) + 0.18, 0], [0, 0, Math.PI / 2]));
    put('wood', T(new THREE.CircleGeometry(0.19, 7), [0.86, lift(0.86, 0) + 0.18, 0], [0, Math.PI / 2, 0]));
  } else if (type === 'post') {
    // a lookout's post: a pole driven in, a cross-piece and a red rag on it that stirs
    put('bark', T(new THREE.CylinderGeometry(0.08, 0.11, 3, 6), [0, lift(0, 0) + 1.45, 0], [0.04, 0, 0.03]));
    put('bark', T(new THREE.CylinderGeometry(0.05, 0.05, 1.1, 5), [0, lift(0, 0) + 2.6, 0], [0, 0, Math.PI / 2]));
    for (let i = 0; i < 3; i++) { const a = (i / 3) * Math.PI * 2; put('stone', T(new THREE.IcosahedronGeometry(0.22, 0), [Math.sin(a) * 0.3, lift(0, 0) + 0.08, Math.cos(a) * 0.3], [a, 0, 0], [1, 0.7, 1])); }
    const rag = new THREE.PlaneGeometry(0.75, 0.55, 3, 1).translate(0.4, -0.3, 0);
    rag.deleteAttribute('uv');
    const flag = new THREE.Mesh(rag, makeMaterial({ color: PROP_COLORS.cloth, side: THREE.DoubleSide, key: 'site.rag' }));
    flag.position.set(0.5, lift(0, 0) + 2.6, 0); flag.userData.noCollide = true;
    group.add(flag);
    const base = rag.attributes.position.array.slice();
    P.update = (dt, t, near) => {
      if (!near) return;
      const a = rag.attributes.position.array;
      for (let i = 0; i < a.length; i += 3) { const u = base[i] / 0.8; a[i + 2] = base[i + 2] + Math.sin(t * 3.1 + u * 4) * 0.08 * u; }
      rag.attributes.position.needsUpdate = true;
    };
  } else if (type === 'nest') {
    // a ring of stones, and old bones in it and over its rim: something lives here, and has eaten
    const n = 14;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + rnd() * 0.2, rr = r + (rnd() - 0.5) * 0.4, x = Math.sin(a) * rr, z = Math.cos(a) * rr, s = 0.32 + rnd() * 0.22;
      put(i % 4 ? 'stone' : 'dark', T(new THREE.IcosahedronGeometry(s, 0), [x, lift(x, z) + s * 0.4, z], [rnd() * 3, rnd() * 3, 0], [1.2, 0.75, 1]));
    }
    for (let i = 0; i < 7; i++) {
      const a = rnd() * Math.PI * 2, rr = rnd() * (r - 0.6), x = Math.sin(a) * rr, z = Math.cos(a) * rr;
      put('bone', T(new THREE.CylinderGeometry(0.05, 0.05, 0.55 + rnd() * 0.4, 5), [x, lift(x, z) + 0.06, z], [Math.PI / 2, rnd() * 3, 0]));
      put('bone', T(new THREE.SphereGeometry(0.085, 6, 4), [x + 0.25, lift(x, z) + 0.06, z]));
    }
    for (let i = 0; i < 12; i++) {   // (twigs and straw)
      const a = rnd() * Math.PI * 2, rr = r * (0.55 + rnd() * 0.4), x = Math.sin(a) * rr, z = Math.cos(a) * rr;
      put('wood', T(new THREE.CylinderGeometry(0.03, 0.03, 0.9, 4), [x, lift(x, z) + 0.05, z], [Math.PI / 2, a + 1.2 + rnd(), 0]));
    }
  } else if (type === 'cairn') {
    let y = lift(0, 0);
    for (let i = 0; i < 4; i++) { const s = 0.42 - i * 0.08; put(i % 2 ? 'dark' : 'stone', T(new THREE.IcosahedronGeometry(s, 0), [rnd() * 0.08, y + s * 0.6, rnd() * 0.08], [rnd(), rnd() * 3, 0], [1.15, 0.7, 1.1])); y += s * 1.05; }
  } else if (type === 'sand' || type === 'shadow') {
    // the sign: the sand over it heaves now and then, a puff of grit off it (or a shadow that slides about on the ground
    // with nothing over it); the twitch and the sound are index.js's (it knows where you are)
    const sign = new THREE.Group();
    sign.position.y = lift(0, 0);
    group.add(sign);
    if (type === 'sand') {
      const mound = T(new THREE.IcosahedronGeometry(1, 1), [0, 0, 0], [0, 0, 0], [1.5, 0.28, 1.1]);
      const m = new THREE.Mesh(mound, mat(tone ?? 'sand')); m.userData.noCollide = true; sign.add(m);
      for (let i = 0; i < 5; i++) { const a = rnd() * 6.28, rr = 1.2 + rnd() * 0.8; const c = new THREE.Mesh(T(new THREE.IcosahedronGeometry(0.16, 0), [Math.sin(a) * rr, 0.04, Math.cos(a) * rr], [rnd(), rnd(), 0], [1.3, 0.5, 1]), mat(tone ?? 'sand')); c.userData.noCollide = true; sign.add(c); }
      P.sign = m;
    } else {
      const m = new THREE.Mesh(T(new THREE.CircleGeometry(1, 14).rotateX(-Math.PI / 2), [0, 0.03, 0], [0, 0, 0], [1.7, 1, 1.1]), mat('shade')); m.userData.noCollide = true; sign.add(m);
      P.sign = m;
    }
    P.signType = type;
    P.update = (dt, t, near) => {
      if (!near || !P.sign) return;
      const tw = P.twitch ?? 0;
      if (type === 'sand') { P.sign.scale.set(1 + tw * 0.08, 1 + tw * 0.9 + Math.sin(t * 9) * tw * 0.25, 1 + tw * 0.08); P.sign.position.y = tw * 0.05; }
      else { P.sign.position.set(Math.sin(t * 0.37) * 0.8, 0, Math.cos(t * 0.29) * 0.6); P.sign.scale.setScalar(0.9 + 0.12 * Math.sin(t * 0.8) + tw * 0.25); }
    };
  } else if (type === 'rack') {
    // a weapon rack (issue #726, the grunts'): two forked posts and a pole across them, a spear leaning on it and a bow
    // hung from it; each gone from it as a grunt takes it (P.rack.stock: src/foes.js RACK, src/encounters/index.js)
    const y = lift(0, 0);
    for (const x of [-0.75, 0.75]) {
      put('bark', T(new THREE.CylinderGeometry(0.05, 0.07, 1.3, 6), [x, y + 0.62, 0], [0, 0, x * 0.05]));
      for (const s of [-1, 1]) put('bark', T(new THREE.CylinderGeometry(0.03, 0.04, 0.3, 5), [x + s * 0.06, y + 1.36, 0], [0, 0, -s * 0.45]));
      put('stone', T(new THREE.IcosahedronGeometry(0.16, 0), [x, y + 0.05, 0.1], [x, 1, 0], [1, 0.6, 1]));
    }
    put('wood', T(new THREE.CylinderGeometry(0.035, 0.035, 1.8, 6), [0, y + 1.32, 0], [0, 0, Math.PI / 2]));
    const spear = new THREE.Group(), bow = new THREE.Group();
    spear.add(meshOf([T(new THREE.CylinderGeometry(0.018, 0.02, 1.7, 6), [0.25, y + 0.85, 0.12], [0.12, 0, -0.2])], mat('wood')), meshOf([T(new THREE.ConeGeometry(0.04, 0.17, 4), [0.08, y + 1.74, 0.23], [0.12, 0, -0.2], [1, 1, 0.4])], mat('dark')));
    const arc = [];
    for (let i = 0; i <= 8; i++) { const a = -1.1 + 2.2 * (i / 8); arc.push(new THREE.Vector3(-0.35 + Math.sin(a) * 0.05, y + 0.95 + Math.sin(a) * 0.38, 0.06 + (Math.cos(a) - Math.cos(1.1)) * 0.22)); }
    bow.add(meshOf([new THREE.TubeGeometry(new THREE.CatmullRomCurve3(arc), 10, 0.016, 5)], mat('wood')), meshOf([T(new THREE.CylinderGeometry(0.004, 0.004, 0.76, 3), [-0.35, y + 0.95, 0.06])], mat('ink')));
    for (const w of [spear, bow]) { w.userData.noCollide = true; group.add(w); }
    P.weapons = { spear, bow };
    P.update = () => { const S = P.rack?.stock; if (S) for (const [k, w] of Object.entries(P.weapons)) w.visible = S.includes(k); };
  } else if (type === 'coffer') {
    // the foes' coffer (the temples' Coffer's build): a block of rough stone, brass bands, a lid that swings back, a little
    // lamp in its front that glows once it may be opened
    const y = lift(0, 0);
    put('coffer', T(new THREE.BoxGeometry(1.2, 0.62, 0.8), [0, y + 0.31, 0]));
    for (const x of [-0.42, 0.42]) put('trim', T(new THREE.BoxGeometry(0.12, 0.64, 0.84), [x, y + 0.32, 0]));
    put('trim', T(new THREE.BoxGeometry(1.24, 0.1, 0.84), [0, y + 0.1, 0]));
    const lid = new THREE.Group();
    lid.position.set(0, y + 0.62, -0.4);
    const lidMesh = meshOf([T(new THREE.BoxGeometry(1.2, 0.2, 0.8), [0, 0.1, 0.4])], mat('coffer'));
    const lidTrim = meshOf([T(new THREE.BoxGeometry(0.12, 0.22, 0.84), [-0.42, 0.11, 0.4]), T(new THREE.BoxGeometry(0.12, 0.22, 0.84), [0.42, 0.11, 0.4])], mat('trim'));
    lid.add(lidMesh, lidTrim);
    group.add(lid);
    const glow = makeMaterial({ color: PROP_COLORS.lamp, glow: 0.05, flat: true, key: `site.coffer.lamp.${seed}` });
    const lamp = new THREE.Mesh(T(new THREE.SphereGeometry(0.09, 8, 6), [0, y + 0.45, 0.41], [0, 0, 0], [1, 1, 0.5]), glow);
    lamp.userData.noCollide = true;
    group.add(lamp);
    P.lid = lid; P.k = 0; P.awake = 0;
    P.open = (k) => { P.k = k; lid.rotation.x = -k * 1.9; };
    P.update = (dt, t) => { if (glow.uniforms?.uGlow) glow.uniforms.uGlow.value = P.k > 0.5 ? 0.04 : 0.05 + P.awake * (0.25 + 0.12 * Math.sin(t * 2.4)); };
  } else throw new Error(`no such site prop: ${type}`);
  for (const [c, geos] of Object.entries(parts)) group.add(meshOf(geos, mat(c)));
  return P;
}
const _up = new THREE.Vector3(0, 1, 0);

/** A sleeper's little "z"s: two inked letters rising over it and fading, one mesh of two for every sleeper near (index.js). */
export function sleepMarks(parent) {
  const zs = new THREE.Shape();
  const w = 0.22, h = 0.22, t = 0.05;
  zs.moveTo(0, h); zs.lineTo(w, h); zs.lineTo(w, h - t); zs.lineTo(t * 1.3, t); zs.lineTo(w, t); zs.lineTo(w, 0); zs.lineTo(0, 0); zs.lineTo(0, t); zs.lineTo(w - t * 1.3, h - t); zs.lineTo(0, h - t); zs.closePath();
  const g = new THREE.ShapeGeometry(zs).translate(-w / 2, 0, 0);
  g.deleteAttribute('uv');
  const m = makeMaterial({ color: PROP_COLORS.ink, flat: true, side: THREE.DoubleSide, key: 'site.zz' });
  const group = new THREE.Group();
  group.userData.noCollide = true;
  const a = new THREE.Mesh(g, m), b = new THREE.Mesh(g, m);
  a.userData.noCollide = b.userData.noCollide = true;
  b.scale.setScalar(0.7);
  group.add(a, b);
  parent.add(group);
  return {
    group,
    /** Over `top` (a world point), facing `eye`, at time t; hidden when shown is false. */
    set(top, eye, t, shown) {
      group.visible = shown;
      if (!shown) return;
      group.position.copy(top);
      if (eye) group.rotation.y = Math.atan2(eye.x - top.x, eye.z - top.z);
      for (const [i, z] of [[0, a], [1, b]]) { const u = (t * 0.45 + i * 0.5) % 1; z.position.set(0.15 * i + Math.sin(u * 6) * 0.06, u * 0.7, 0); z.scale.setScalar((i ? 0.7 : 1) * (0.6 + 0.6 * Math.sin(Math.PI * u))); }
    },
    dispose() { g.dispose(); group.removeFromParent(); },
  };
}
