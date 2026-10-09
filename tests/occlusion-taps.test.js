// The composite's two screen-space occlusion estimates (post.js: crease shading's creaseAO, the spot
// blacks' enclosure) made cheaper without changing what they compute: constant tap directions, the
// view ray taken as affine in uv, no branch inside the loops (docs/systems/performance.md).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { readFileSync } from 'node:fs';
import { createPost, OCCLUSION_TAPS, glslVec2s, occlusionShare, SPOT_FRAME, SPOT_SWELL, spotFrame, spotSwell, glslVec3 } from '../src/post.js';

const shader = createPost().scene.children[0].material.fragmentShader;
const body = (name) => {
  const a = shader.indexOf(`float ${name}(`);
  assert.ok(a >= 0, name);
  let depth = 0, i = shader.indexOf('{', a);
  for (let j = i; j < shader.length; j++) {
    if (shader[j] === '{') depth++;
    else if (shader[j] === '}' && --depth === 0) return shader.slice(i, j + 1);
  }
  throw new Error(`unclosed ${name}`);
};

test('the spot taps are the directions the shader used to work out per pixel', () => {
  for (const n of [8, 4]) {
    const taps = OCCLUSION_TAPS.spot(n);
    assert.equal(taps.length, n);
    taps.forEach(([x, y], i) => {
      const a = 0.39 + (i * 6.2832) / n, r = (Math.floor(i / 2) * 2 === i) ? 1 : 0.55;
      assert.ok(Math.abs(x - Math.cos(a) * r) < 1e-12 && Math.abs(y - Math.sin(a) * r) < 1e-12, `${n} taps, #${i}`);
    });
    assert.ok(shader.includes(glslVec2s(`SPOT_TAPS${n}`, taps)), `SPOT_TAPS${n} in the composite`);
  }
  assert.match(glslVec2s('X', [[1, -0.5]]), /^const vec2 X\[1\] = vec2\[1\]\(vec2\(1\.0000000, -0\.5000000\)\);$/);
});

test('no skip (continue / break), cos or sin inside the occlusion loops', () => {
  for (const name of ['enclosure', 'spotTap', 'creaseAO']) {
    const b = body(name);
    assert.ok(!/\bcontinue\b|\bbreak\b/.test(b), `${name}: a tap that doesn't count weighs 0, it isn't skipped`);
  }
  const enc = body('enclosure');
  // the spot taps' directions are constants: the only sines are the swell's two waves, once a pixel, before the loops
  assert.equal((enc.match(/\bsin\(/g) ?? []).length, 2);
  assert.ok(!/\bcos\(/.test(enc));
  assert.ok(enc.indexOf('sin(') < enc.indexOf('for ('), 'the swell is worked out once, not per tap');
  assert.ok(!/viewPos\(suv/.test(enc + body('spotTap')), 'the tap positions from the affine ray');
  const ao = body('creaseAO');
  assert.equal((ao.match(/\bcos\(/g) ?? []).length, 2, 'crease shading: one turn per pixel (and the spiral\'s own constant steps)');
  // the surface flags (is the tap on a grass blade, or a person?) only read for a tap that would close something in,
  // or one nearer than the point (a person hiding what stands behind them)
  assert.match(ao, /if \(c > 0\.0 \|\| \(sd > 0\.0 && sd < d\)\) \{ float t = mod\(texture\(tHatch, suv\)\.a, 16\.0\); np = step\(mod\(t, 8\.0\), 1\.5\); c \*= step\(t, 7\.5\) \* np; \}/);
  assert.equal((ao.match(/texture\(tHatch/g) ?? []).length, 1);
});

test('a person closes nothing in: no spot-black or crease halo round a climber or round people’s feet', () => {
  // gHatch.a packs glow (0..1) + 2 hero + 4 figure + 8 soft + 16 face + 32 drift: notPerson(suv) is 0 on the
  // traveller and on anyone else, whatever else the pixel carries, and 1 on everything that isn't a person
  const notPerson = (a) => ((a % 8) <= 1.5 ? 1 : 0);   // (GLSL step(mod(a, 8), 1.5))
  for (const glow of [0, 0.6, 1]) for (const soft of [0, 8]) for (const face of [0, 16]) for (const drift of [0, 32]) {
    const rest = glow + soft + face + drift;
    assert.equal(notPerson(rest), 1, `not a person: ${rest}`);
    assert.equal(notPerson(rest + 2), 0, `the traveller: ${rest + 2}`);
    assert.equal(notPerson(rest + 4), 0, `a figure: ${rest + 4}`);
  }
  assert.ok(shader.includes('float notPerson(vec2 suv) { return step(mod(texture(tHatch, suv).a, 8.0), 1.5); }'));
  const enc = body('enclosure');
  // both loops (8 taps, 4 on the handheld): a person's tap is left out of the share (below)
  // (a tap on a person first looks past them, twice as far out; still on one, it is left out)
  assert.equal((enc.match(/float np = notPerson\(suv\);\s*if \(np < 0\.5\) \{ suv = spotUv\(P \+ 2\.0 \* o, rA, rB\); np = notPerson\(suv\); \}/g) ?? []).length, 2);
  assert.equal((enc.match(/occ \+= spotTap\(suv, P, nV, rA, rB, r1, r2\) \* np; seen \+= np;/g) ?? []).length, 2);
  assert.equal((enc.match(/return occ \/ max\(seen, 1\.0\);/g) ?? []).length, 2);
  assert.ok(!/texture\(tHatch/.test(enc + body('spotTap')));
});

test('a person in front leaves no pale ghost in the shading behind them (Marrow by the ship, the tree’s stairs)', () => {
  // a point in a recess: 6 of 8 taps close it in. A person steps in front and hides 3 of them: counted as open
  // (before) the share fell from 0.75 to 0.375 and the spot-black mass got a pale hole the person's shape; left
  // out, the share is the remaining taps' and a person in front of open ground closes nothing
  const recess = [1, 1, 1, 1, 1, 1, 0, 0].map((c) => ({ c, person: false }));
  assert.equal(occlusionShare(recess), 0.75);
  const hidden = recess.map((t, i) => (i < 3 ? { c: 0, person: true } : t));
  assert.ok(Math.abs(occlusionShare(hidden) - 0.6) < 1e-12, 'the five taps still seeing the recess');
  const before = hidden.reduce((a, t) => a + t.c, 0) / 8;
  assert.ok(occlusionShare(hidden) > before + 0.2, 'no longer counted as open');
  // a uniform recess: hiding any taps leaves the share as it was
  const full = Array.from({ length: 8 }, () => ({ c: 1, person: false }));
  assert.equal(occlusionShare(full.map((t, i) => (i % 3 ? t : { c: 0, person: true }))), 1);
  // open ground with a person in front: still open; every tap on the person: open
  assert.equal(occlusionShare(Array.from({ length: 8 }, (_, i) => ({ c: 0, person: i < 5 }))), 0);
  assert.equal(occlusionShare(Array.from({ length: 4 }, () => ({ c: 1, person: true }))), 0);
  // crease shading takes the same share (the clamp x 2.2 over it)
  assert.match(body('creaseAO'), /return clamp\(ao \/ max\(seen, 1\.0\) \* 2\.2, 0\.0, 1\.0\);/);
  // and so does the Unity port's composite (it had no person test at all)
  const unity = readFileSync(new URL('../unity/Memento/Assets/Memento/Shaders/Composite.shader', import.meta.url), 'utf8');
  assert.equal((unity.match(/return (saturate\(ao|occ) \/ max\(seen, 1\.0\)/g) ?? []).length, 2);
  // (crease shading's one, the spot blacks' and its look past the person)
  assert.equal((unity.match(/np = step\(fmod\((t|tH\(suv\)\.a), 8\.0\), 1\.5\)/g) ?? []).length, 3);
});

test('the view ray is affine in uv, so a tap can be placed without the inverse projection', () => {
  // post.js viewPos(uv, d) = r / -r.z * d with r = invProj * (uv * 2 - 1, 1, 1): its xy at d = 1 must be
  // uv * rA + rB, rA and rB taken from viewPos at (0, 0) and (1, 1), for any perspective camera (an
  // off-centre one too: the photo mode's and the portraits' view offsets)
  const viewPos = (inv, u, v) => {
    const p = new THREE.Vector4(u * 2 - 1, v * 2 - 1, 1, 1).applyMatrix4(inv);
    const r = new THREE.Vector3(p.x / p.w, p.y / p.w, p.z / p.w);
    return r.multiplyScalar(1 / -r.z);
  };
  const cams = [new THREE.PerspectiveCamera(55, 16 / 9, 0.3, 5000), new THREE.PerspectiveCamera(30, 0.75, 0.1, 800)];
  cams[1].setViewOffset(1600, 1200, 300, 120, 800, 600);
  for (const cam of cams) {
    cam.updateProjectionMatrix();
    const inv = cam.projectionMatrixInverse;
    const b = viewPos(inv, 0, 0), a = viewPos(inv, 1, 1).sub(b);
    for (const [u, v] of [[0.13, 0.71], [0.5, 0.5], [0.97, 0.02], [-0.04, 1.05]]) {
      const want = viewPos(inv, u, v);
      assert.ok(Math.abs(want.z + 1) < 1e-9);
      assert.ok(Math.abs(u * a.x + b.x - want.x) < 1e-6 && Math.abs(v * a.y + b.y - want.y) < 1e-6, `${cam.fov}° at ${u}, ${v}`);
    }
  }
});

test('crease shading turns its spiral with one rotation: the same directions as a cos and a sin per tap', () => {
  // GLSL mat2(c, s, -s, c) is column-major: turn * (x, y) = (c x - s y, s x + c y)
  for (const a0 of [0, 0.7, 2.9, 6.1]) {
    const c = Math.cos(a0), s = Math.sin(a0);
    for (let i = 0; i < 8; i++) {
      const b = i * 2.39996, x = Math.cos(b), y = Math.sin(b);
      assert.ok(Math.abs(c * x - s * y - Math.cos(a0 + b)) < 1e-12 && Math.abs(s * x + c * y - Math.sin(a0 + b)) < 1e-12);
    }
  }
  assert.ok(body('creaseAO').includes('mat2 turn = mat2(cs.x, cs.y, -cs.y, cs.x);'));
});

// ---------------------------------------------------------------- spot blacks anchored to the surface
// (playtest: "on stepped geometry the masses come in blocks that shift as the camera moves, worst on Handheld's
// 4 taps"; docs/systems/rendering.md "Spot blacks anchored to the surface")
const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const unit3 = (a) => { const l = Math.hypot(...a); return a.map((x) => x / l); };

test('the spot taps’ frame lies on the surface, level along it and straight up it, x on level ground', () => {
  const normals = [];
  for (let el = -89; el <= 89; el += 7) for (let az = 0; az < 360; az += 13) {
    const e = el * Math.PI / 180, a = az * Math.PI / 180;
    normals.push([Math.cos(e) * Math.sin(a), Math.sin(e), Math.cos(e) * Math.cos(a)]);
  }
  normals.push([0, 1, 0], [0, -1, 0], [1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1], unit3([0.0001, 0.99999, -0.0002]));
  for (const n of normals) {
    const [t1, t2] = spotFrame(n);
    for (const v of [t1, t2]) assert.ok(Math.abs(Math.hypot(...v) - 1) < 1e-6 && Math.abs(dot3(v, n)) < 1e-6, `on the surface: ${n}`);
    assert.ok(Math.abs(dot3(t1, t2)) < 1e-6);
    if (Math.abs(n[1]) < SPOT_FRAME.blend[0]) {
      assert.ok(Math.abs(t1[1]) < 1e-6, `the first axis is level: ${n}`);
      assert.ok(Math.abs(Math.abs(t2[1]) - Math.sqrt(1 - n[1] * n[1])) < 1e-6, `the second runs straight up or down the face: ${n}`);
    }
    if (Math.abs(n[1]) > SPOT_FRAME.blend[1]) {
      const x = unit3([1 - n[0] * n[0], -n[0] * n[1], -n[0] * n[2]]);
      assert.ok(Math.abs(Math.abs(dot3(t1, x)) - 1) < 1e-6, `level ground: x laid on it: ${n}`);
    }
  }
  // continuous up to the sign (the patterns are the same turned half a turn, below): a small turn of the normal turns
  // the axis a little, everywhere but inside the blend to level ground (slopes under 6°), where a field of contours
  // has to give way to one direction somewhere
  const blendSlope = Math.acos(SPOT_FRAME.blend[0]) * 180 / Math.PI;
  assert.ok(blendSlope < 6);
  for (const n of normals) for (const d of [[0.01, 0, 0], [0, 0.01, 0], [0, 0, 0.01]]) {
    const m = unit3(n.map((x, i) => x + d[i]));
    if (Math.max(Math.abs(n[1]), Math.abs(m[1])) > SPOT_FRAME.blend[0] - 0.001) continue;
    const a = spotFrame(n)[0], b = spotFrame(m)[0];
    assert.ok(Math.abs(dot3(a, b)) > 0.99, `${n} → ${m}: ${dot3(a, b)}`);
  }
  // and the shader builds the same axes (the wall's turned to agree with the ground's: their dot is n.z)
  assert.ok(body('enclosure').includes('vec3 wall = vec3(n.z, 0.0, -n.x) * ((n.z < 0.0 ? -1.0 : 1.0)'));
});

test('the spot tap patterns are the same turned half a turn, and a wall always has as many taps below as above', () => {
  for (const n of [4, 8]) {
    const taps = OCCLUSION_TAPS.spot(n);
    taps.forEach(([x, y], i) => { const [u, v] = taps[(i + n / 2) % n]; assert.ok(Math.abs(x + u) < 1e-4 && Math.abs(y + v) < 1e-4); });   // (2π as 6.2832)
    // on a riser or a room's wall the second axis runs up the face: half the taps reach below the point, and at the
    // smallest swell the shallowest of them still reaches a tenth of the radius down (0.3 m at the desert's 3 m: past
    // the foot of a 0.37 m riser from its middle)
    const below = taps.filter(([, y]) => y < 0);
    assert.equal(below.length, n / 2);
    assert.ok(Math.min(...below.map(([, y]) => -y)) * SPOT_SWELL.range[0] > 0.1);
  }
});

test('the spot swell is a slow function of the world point alone, in its range; the shaders take the same', () => {
  for (const R of [1, 3, 3.5]) {
    let prev = null;
    const step = 0.05;
    const slope = 0.25 * (Math.hypot(...SPOT_SWELL.waves[0]) + Math.hypot(...SPOT_SWELL.waves[1])) / (R * SPOT_SWELL.scale);
    for (let x = 0; x < 40; x += step) {
      const s = spotSwell([x, 0.3 * x, -0.7 * x], R);
      assert.ok(s >= 0 && s <= 1);
      if (prev !== null) assert.ok(Math.abs(s - prev) <= slope * step * Math.hypot(1, 0.3, 0.7) + 1e-9, 'continuous');
      prev = s;
    }
  }
  const enc = body('enclosure');
  assert.ok(enc.includes(glslVec3(SPOT_SWELL.waves[0])) && enc.includes(glslVec3(SPOT_SWELL.waves[1])));
  assert.ok(enc.includes(`mix(${SPOT_SWELL.range[0].toFixed(2)}, ${SPOT_SWELL.range[1].toFixed(2)}, swell)`));
  assert.ok(enc.includes(`smoothstep(${SPOT_FRAME.blend[0].toFixed(4)}, ${SPOT_FRAME.blend[1].toFixed(4)}, abs(n.y))`));
  // the Unity port: the same frame and swell
  const unity = readFileSync(new URL('../unity/Memento/Assets/Memento/Shaders/Composite.shader', import.meta.url), 'utf8');
  for (const w of SPOT_SWELL.waves) assert.ok(unity.includes(`float3(${w.map((x) => x.toFixed(3)).join(', ')})`), `Unity: wave ${w}`);
  assert.ok(unity.includes(`lerp(${SPOT_SWELL.range[0]}, ${SPOT_SWELL.range[1]}, swell)`) && unity.includes(`(R * ${SPOT_SWELL.scale})`));
  assert.ok(unity.includes(`smoothstep(${SPOT_FRAME.blend[0]}, ${SPOT_FRAME.blend[1]}, abs(n.y))`) && unity.includes('float3 wall = float3(n.z, 0.0, -n.x) * ((n.z < 0.0 ? -1.0 : 1.0)'));
});

// A twin of both estimates (the screen-fixed taps before, the surface taps now) on a staircase of boxes, the depth
// buffer raycast: a point on a riser seen as the camera swings round it.
function stairScene() {
  const scene = new THREE.Scene(), mat = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
  const RISE = 0.37, RUN = 0.93;
  for (let s = 0; s < 12; s++) {
    const top = (s + 1) * RISE, len = 12 - s * RUN;
    scene.add(new THREE.Mesh(new THREE.BoxGeometry(6.5, top, len).translate(0, top / 2, -s * RUN - len / 2), mat));
  }
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(200, 200).rotateX(-Math.PI / 2), mat));
  scene.updateMatrixWorld(true);
  return { scene, RISE, RUN };
}
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
function spotTwin(scene, cam, P, R, taps, mode, H = 540) {
  const W = H * cam.aspect, ray = new THREE.Raycaster();
  const hit = (u, v) => {
    ray.setFromCamera(new THREE.Vector2(u * 2 - 1, v * 2 - 1), cam);
    const h = ray.intersectObjects(scene.children, false)[0];
    return h ? { d: -h.point.clone().applyMatrix4(cam.matrixWorldInverse).z, n: h.face.normal.clone().transformDirection(h.object.matrixWorld) } : { d: 0 };
  };
  const pc = P.clone().project(cam), uv = [pc.x * 0.5 + 0.5, pc.y * 0.5 + 0.5];
  const { d, n: nW } = hit(...uv);
  const vp = (u, v) => { const p = new THREE.Vector4(u * 2 - 1, v * 2 - 1, 1, 1).applyMatrix4(cam.projectionMatrixInverse); return [p.x / p.w / -(p.z / p.w), p.y / p.w / -(p.z / p.w)]; };
  const rB = vp(0, 0), r11 = vp(1, 1), rA = [r11[0] - rB[0], r11[1] - rB[1]];
  const Pv = new THREE.Vector3(uv[0] * rA[0] + rB[0], uv[1] * rA[1] + rB[1], -1).multiplyScalar(d);
  const toView = new THREE.Matrix3().setFromMatrix4(cam.matrixWorldInverse);
  const nV = nW.clone().applyMatrix3(toView).normalize();
  const k = cam.projectionMatrix.elements[5] * 0.5 * H, px = Math.min(96, Math.max(4, R * k / d));
  const Pw = Pv.clone().applyMatrix4(cam.matrixWorld).toArray();
  const Rm = px * d / k * (SPOT_SWELL.range[0] + (SPOT_SWELL.range[1] - SPOT_SWELL.range[0]) * spotSwell(Pw, R));
  const [t1, t2] = spotFrame(nW.toArray()).map((t) => new THREE.Vector3(...t).applyMatrix3(toView).multiplyScalar(Rm));
  let occ = 0;
  for (const [x, y] of OCCLUSION_TAPS.spot(taps)) {
    let su, sv;
    if (mode === 'screen') { su = uv[0] + x * px / W; sv = uv[1] + y * px / H; }
    else { const S = Pv.clone().addScaledVector(t1, x).addScaledVector(t2, y); su = (S.x / -S.z - rB[0]) / rA[0]; sv = (S.y / -S.z - rB[1]) / rA[1]; }
    const sd = hit(su, sv).d;
    if (sd <= 0) continue;
    const v = new THREE.Vector3(su * rA[0] + rB[0], sv * rA[1] + rB[1], -1).multiplyScalar(sd).sub(Pv), dist = v.length();
    occ += smooth(0.12, 0.5, nV.dot(v) / dist) * (1 - smooth(R * 1.5, R * 3, dist));
  }
  return occ / taps;
}

test('a riser’s spot black stays put as the camera swings round it (it used to come and go with the view)', () => {
  const { scene, RISE, RUN } = stairScene();
  const R = 3, threshold = 0.3;   // (the desert's uSpot.y and .z)
  const P = new THREE.Vector3(0.6, 2 * RISE + 0.18, -2 * RUN + 0.001);
  for (const taps of [4, 8]) {
    const got = { screen: [], surface: [] };
    for (let yaw = -40; yaw <= 40; yaw += 10) {
      const cam = new THREE.PerspectiveCamera(55, 16 / 9, 0.1, 2000), a = yaw * Math.PI / 180;
      cam.position.set(P.x + Math.sin(a) * 9, P.y + 4, P.z + Math.cos(a) * 9);
      cam.lookAt(P); cam.updateMatrixWorld(true);
      for (const mode of ['screen', 'surface']) got[mode].push(spotTwin(scene, cam, P, R, taps, mode));
    }
    const spread = (l) => Math.max(...l) - Math.min(...l), show = (l) => l.map((x) => x.toFixed(2)).join(' ');
    assert.ok(Math.min(...got.surface) > threshold + 0.05, `${taps} taps: the riser is a mass from every side (${show(got.surface)})`);
    assert.ok(spread(got.surface) < 0.12, `${taps} taps: steady (${show(got.surface)})`);
    if (taps === 4) {
      assert.ok(Math.min(...got.screen) < threshold && Math.max(...got.screen) > threshold, `before: on and off with the view (${show(got.screen)})`);
      assert.ok(spread(got.surface) < spread(got.screen) / 2);
    }
  }
});
