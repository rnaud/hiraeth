// The composite's two screen-space occlusion estimates (post.js: crease shading's creaseAO, the spot
// blacks' enclosure) made cheaper without changing what they compute: constant tap directions, the
// view ray taken as affine in uv, no branch inside the loops (docs/systems/performance.md).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { readFileSync } from 'node:fs';
import { createPost, OCCLUSION_TAPS, glslVec2s, occlusionShare, SPOT_FRAME, SPOT_PAST, SPOT_SWELL, spotBehind, spotFrame, spotShare, spotSwell, glslVec3, SPOT_POCKET, DUST_PAST } from '../src/post.js';

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
  for (const name of ['enclosure', 'spotTapAt', 'planeAlong', 'planeNear', 'creaseAO']) {
    const b = body(name);
    assert.ok(!/\bcontinue\b|\bbreak\b/.test(b), `${name}: a tap that doesn't count weighs 0, it isn't skipped`);
  }
  const enc = body('enclosure');
  // the spot taps' directions are constants: the only sines are the swell's two waves, once a pixel, before the loops
  assert.equal((enc.match(/\bsin\(/g) ?? []).length, 2);
  assert.ok(!/\bcos\(/.test(enc));
  assert.ok(enc.indexOf('sin(') < enc.indexOf('for ('), 'the swell is worked out once, not per tap');
  assert.ok(!/viewPos\(/.test(enc.slice(enc.indexOf('float r1')) + body('spotTapAt')), 'the tap positions from the affine ray');
  const ao = body('creaseAO');
  assert.equal((ao.match(/\bcos\(/g) ?? []).length, 2, 'crease shading: one turn per pixel (and the spiral\'s own constant steps)');
  // the surface flags (is the tap on a grass blade, or a person?) only read for a tap that would close something in,
  // or one nearer than the point (a person hiding what stands behind them)
  assert.ok(ao.includes('if (c > 0.0 || (sd > 0.0 && sd < d)) { float a = texture(tHatch, suv).a, t = mod(a, 16.0); np = step(mod(t, 8.0), 1.5) * max(step(a, 63.5), self); c *= step(t, 7.5) * np; }'));
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
  // both loops (8 taps, 4 on the handheld): a tap on a person stands for what the person hides (spotBehind, below):
  // the planes of what is seen two and four times as far out and of the other taps, met along its ray
  for (const n of [8, 4]) {
    assert.ok(enc.includes(`tp[i] = notStanding(tuv[i], self);`) && enc.includes(`vec2 tuv[${n}]; vec4 tq[${n}]; float tp[${n}];`), `${n} taps: read first`);
    assert.ok(enc.includes(`return mix(occ / ${n}.0, pair / ${n / 2}.0, ground);`), `${n} taps: every tap counts (SPOT_POCKET)`);
  }
  assert.equal((enc.match(/if \(tp\[i\] < 0\.5\) \{/g) ?? []).length, 2);
  assert.equal((enc.match(/sd = -\(P\.z \+ o\.z\);/g) ?? []).length, 2, 'the point’s own surface: the farthest the hidden tap can see');
  assert.equal((enc.match(/vec2 p2 = spotUv\(P \+ 2\.0 \* o, rA, rB\), p4 = spotUv\(P \+ 4\.0 \* o, rA, rB\);/g) ?? []).length, 2);
  // (each plane only where the ray meets it near where it was seen: SPOT_PAST.near, × the pocket's radius)
  const nr = (k) => SPOT_PAST.near[k].toFixed(2).replace('.', '\\.');
  assert.equal((enc.match(new RegExp(`for \\(int j = 0; j < \\d; j\\+\\+\\) if \\(tp\\[j\\] > 0\\.5\\) sd = planeNear\\(tuv\\[j\\], tq\\[j\\], r, toView, rA, rB, lo, sd, ${nr('taps')}\\);`, 'g')) ?? []).length, 2);
  assert.equal((enc.match(new RegExp(`if \\(notStanding\\(p[24], self\\) > 0\\.5\\) sd = planeNear\\(p[24], texture\\(tNormal, p[24]\\), r, toView, rA, rB, lo, sd, ${nr('past')}\\);`, 'g')) ?? []).length, 4);
  // the third look past him (issue #28): to either side of the tap's place, along the other axis
  assert.equal((enc.match(new RegExp(`vec3 op = \\(-SPOT_TAPS\\d\\[i\\]\\.y \\* t1 \\+ SPOT_TAPS\\d\\[i\\]\\.x \\* t2\\) \\* ${SPOT_PAST.side.toFixed(2).replace('.', '\\.')};`, 'g')) ?? []).length, 2);
  assert.equal((enc.match(new RegExp(`sd = planeNear\\(s[12], texture\\(tNormal, s[12]\\), r, toView, rA, rB, lo, sd, ${nr('side')}\\);`, 'g')) ?? []).length, 4);
  assert.equal((enc.match(/tc\[i\] = spotTapAt\(tuv\[i\], sd, P, nV, rA, rB, r1, r2\) \* mix\(/g) ?? []).length, 2);
  assert.match(body('planeNear'), /return t > lo && t < hi \? t : hi;/);
  assert.match(body('planeNear'), /if \(lim > 0\.0 && length\(r \* t - Q\) > lim \* spotReach\) t = hi;/);
  assert.ok(!/texture\(tHatch/.test(enc + body('spotTapAt')));
});

test('a mover (a foe, the drone) is seen past as a person is: no dark halo on the wall behind a hovering drone', () => {
  // gHatch.a + 64 (materials.js MOVER): notStanding is 0 on a mover's pixel, unless the point is on a mover itself
  // (self = 1: its own pockets keep their spot blacks), and 0 on a person whatever the point
  const notStanding = (a, self) => ((a % 8) <= 1.5 ? 1 : 0) * Math.max(a <= 63.5 ? 1 : 0, self);
  for (const glow of [0, 0.5, 0.875]) for (const soft of [0, 8]) for (const face of [0, 16]) for (const drift of [0, 32]) {
    const rest = glow + soft + face + drift;
    assert.equal(notStanding(rest, 0), 1);
    assert.equal(notStanding(rest + 64, 0), 0, `a mover: ${rest + 64}`);
    assert.equal(notStanding(rest + 64, 1), 1, `seen from the mover itself: ${rest + 64}`);
    assert.equal(notStanding(rest + 4, 1), 0, 'a person, from a mover');
  }
  assert.ok(shader.includes('float notStanding(vec2 suv, float self) { float a = texture(tHatch, suv).a; return step(mod(a, 8.0), 1.5) * max(step(a, 63.5), self); }'));
  const enc = body('enclosure');
  assert.equal((enc.match(/notStanding\((p2|p4), self\)/g) ?? []).length, 4, 'what is seen past a person or a mover is not one either');
  // every reader of gHatch.a takes the mover's 64 off first (the main decode, the line kernel's drift test)
  assert.ok(shader.indexOf('surface.a -= 64.0 * mover;') < shader.indexOf('float drift = step(31.5, surface.a);'));
  assert.ok(shader.includes('vec4 fa = mod(vec4(t1.a, t2.a, t3.a, t4.a), 64.0);'));
  assert.ok(shader.includes('enclosure(uv, N.xyz, depth, uSpot.y, POST_LITE ? 4 : 8, mover)') && shader.includes('creaseAO(uv, N.xyz, depth, fc, mover)'));
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
  const unity = readFileSync(new URL('../unity/Hiraeth/Assets/Hiraeth/Shaders/Composite.shader', import.meta.url), 'utf8');
  assert.equal((unity.match(/return saturate\(ao \/ max\(seen, 1\.0\)/g) ?? []).length, 1);
  assert.equal((unity.match(/np = step\(fmod\(t, 8\.0\), 1\.5\)/g) ?? []).length, 1);
  // (the spot blacks: what a person hides, as post.js spotBehind)
  // (each tap read where it is used: a tap on a person reads the others again)
  assert.ok(unity.includes('float tpI = step(fmod(tH(tuvI).a, 8.0), 1.5);') && unity.includes('return lerp(occ / n8, pair / (n8 / 2), ground);'));
  assert.ok(unity.includes('if (step(fmod(tH(tuvJ).a, 8.0), 1.5) > 0.5) sd = planeNear(tuvJ, tN(tuvJ), r, toView, rA, rB, lo, sd, 1.5 * Rm);'));
  assert.ok(unity.includes('sd = planeNear(s1, tN(s1), r, toView, rA, rB, lo, sd, 2.0 * Rm);'), 'the look to the side (issue #28)');
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
  const unity = readFileSync(new URL('../unity/Hiraeth/Assets/Hiraeth/Shaders/Composite.shader', import.meta.url), 'utf8');
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
  const c = [], dy = [];
  for (const [x, y] of OCCLUSION_TAPS.spot(taps)) {
    let su, sv;
    if (mode === 'screen') { su = uv[0] + x * px / W; sv = uv[1] + y * px / H; }
    else { const S = Pv.clone().addScaledVector(t1, x).addScaledVector(t2, y); su = (S.x / -S.z - rB[0]) / rA[0]; sv = (S.y / -S.z - rB[1]) / rA[1]; }
    const h = hit(su, sv), sd = h.d;
    if (sd <= 0) { c.push(0); dy.push(0); continue; }
    const v = new THREE.Vector3(su * rA[0] + rB[0], sv * rA[1] + rB[1], -1).multiplyScalar(sd).sub(Pv), dist = v.length();
    dy.push(v.clone().applyMatrix4(new THREE.Matrix4().extractRotation(cam.matrixWorld)).y);
    c.push(smooth(0.12, 0.5, nV.dot(v) / dist) * (1 - smooth(R * 1.5, R * 3, dist)));
  }
  // (the screen-fixed taps before: the plain share; on the surface now: SPOT_POCKET's rule, 'share' the plain share)
  return mode === 'surface' ? spotShare(c, dy, nW.y) : c.reduce((a, b) => a + b, 0) / taps;
}

test('a riser’s enclosure stays put as the camera swings round it (it used to come and go with the view)', () => {
  const { scene, RISE, RUN } = stairScene();
  const R = 3, threshold = 0.3;   // (the desert's uSpot.y and .z)
  const P = new THREE.Vector3(0.6, 2 * RISE + 0.18, -2 * RUN + 0.001);
  for (const taps of [4, 8]) {
    const got = { screen: [], share: [], surface: [] };
    for (let yaw = -40; yaw <= 40; yaw += 10) {
      const cam = new THREE.PerspectiveCamera(55, 16 / 9, 0.1, 2000), a = yaw * Math.PI / 180;
      cam.position.set(P.x + Math.sin(a) * 9, P.y + 4, P.z + Math.cos(a) * 9);
      cam.lookAt(P); cam.updateMatrixWorld(true);
      for (const mode of ['screen', 'share', 'surface']) got[mode].push(spotTwin(scene, cam, P, R, taps, mode));
    }
    const spread = (l) => Math.max(...l) - Math.min(...l), show = (l) => l.map((x) => x.toFixed(2)).join(' ');
    // the taps on the surface: the same share from every side (the riser's foot, the tread below it, in front)
    assert.ok(Math.min(...got.share) > threshold + 0.05, `${taps} taps: the riser's foot reads closed from every side (${show(got.share)})`);
    assert.ok(spread(got.share) < 0.12, `${taps} taps: steady (${show(got.share)})`);
    if (taps === 4) {
      assert.ok(Math.min(...got.screen) < threshold && Math.max(...got.screen) > threshold, `before: on and off with the view (${show(got.screen)})`);
      assert.ok(spread(got.share) < spread(got.screen) / 2);
    }
    // and a tread closes no riser in (SPOT_POCKET): no spot black along the stairs, from any side
    assert.ok(Math.max(...got.surface) < threshold - 0.05, `${taps} taps: no mass on the riser (${show(got.surface)})`);
  }
});

// What makes a pocket (SPOT_POCKET): a wall standing on open ground, an alley between two walls, a balcony over a wall.
function pocketScene(kind) {
  const scene = new THREE.Scene(), mat = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(200, 200).rotateX(-Math.PI / 2), mat));
  // a wall 8 m tall, its face at z = 0 looking +z
  scene.add(new THREE.Mesh(new THREE.BoxGeometry(30, 8, 3).translate(0, 4, -1.5), mat));
  if (kind === 'alley') scene.add(new THREE.Mesh(new THREE.BoxGeometry(30, 8, 3).translate(0, 4, 1.6 + 1.5), mat));   // (1.6 m wide)
  if (kind === 'balcony') scene.add(new THREE.Mesh(new THREE.BoxGeometry(30, 0.25, 2.2).translate(0, 3.1, 1.1), mat));
  scene.updateMatrixWorld(true);
  return scene;
}
const pocketAt = (kind, P, taps, R = 3, mode = 'surface') => {
  const scene = pocketScene(kind), out = [];
  for (const yaw of [-30, 0, 30]) {
    const cam = new THREE.PerspectiveCamera(55, 16 / 9, 0.1, 2000), a = yaw * Math.PI / 180;
    cam.position.set(P.x + Math.sin(a) * 7, 2.2, Math.cos(a) * 7);
    if (kind === 'alley') cam.position.set(P.x + 5 * (yaw < 0 ? -1 : 1), 4 + Math.abs(yaw) / 15, 0.8);   // (into the alley, from above its end)
    cam.lookAt(P); cam.updateMatrixWorld(true);
    out.push(spotTwin(scene, cam, P, R, taps, mode));
  }
  return out;
};

test('the floor makes no pocket: no spot black along the foot of a wall on open ground, on the wall or the ground', () => {
  for (const taps of [4, 8]) {
    const ground = pocketAt('wall', new THREE.Vector3(0.3, 0, 0.35), taps), foot = pocketAt('wall', new THREE.Vector3(0.3, 0.3, 0.001), taps);
    assert.ok(Math.max(...ground, ...foot) < 0.25, `${taps} taps: ground ${ground.map((x) => x.toFixed(2))}, wall ${foot.map((x) => x.toFixed(2))}`);
  }
});

test('real pockets keep their spot black: an alley’s floor between two walls, the wall under a balcony; its underside as it was', () => {
  for (const taps of [4, 8]) {
    const alley = pocketAt('alley', new THREE.Vector3(0.3, 0, 0.8), taps);
    const under = pocketAt('balcony', new THREE.Vector3(0.3, 2.7, 0.001), taps);
    const slab = pocketAt('balcony', new THREE.Vector3(0.3, 2.975, 0.25), taps);
    const show = (l) => l.map((x) => x.toFixed(2)).join(' ');
    // (4 taps, Handheld: on level ground the long taps lie along the world's x, so an alley along x is only seen across by
    //  the short ones, 0.55 R: the floor of a narrow alley along x keeps no spot black there; 8 taps see it both ways)
    // (the depth buffer sees less of the walls from straight down the alley: lower there, never lost)
    if (taps === 8) assert.ok(Math.max(...alley) > 0.4 && Math.min(...alley) > 0.2, `${taps} taps: the alley's floor (${show(alley)})`);
    assert.ok(Math.min(...under) > 0.35, `${taps} taps: the wall under the balcony (${show(under)})`);
    // (a face turned down keeps every tap: the balcony's underside reads as it did)
    const slabBefore = pocketAt('balcony', new THREE.Vector3(0.3, 2.975, 0.25), taps, 3, 'share');
    assert.deepEqual(slab.map((x) => x.toFixed(4)), slabBefore.map((x) => x.toFixed(4)), `${taps} taps: the balcony's underside (${show(slab)})`);
  }
});

test('spotShare: the plain share on a wall; what stands lower closes nothing (but under a ceiling); on the ground, opposite taps both', () => {
  // a wall point: two taps closed, one of them by something a metre lower
  assert.equal(spotShare([1, 0, 0, 0, 1, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0, 0], 0), 0.25);
  assert.equal(spotShare([1, 0, 0, 0, 1, 0, 0, 0], [-1, 0, 0, 0, 0, 0, 0, 0], 0), 0.125);
  // an eave's underside: the wall below it closes it in
  assert.equal(spotShare([1, 0, 0, 0, 1, 0, 0, 0], [-1, 0, 0, 0, -1, 0, 0, 0], -1), 0.25);
  // a ground point: one side closed is no pocket; both sides is
  assert.equal(spotShare([1, 1, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0, 0], 1), 0);
  assert.equal(spotShare([1, 1, 0, 0, 1, 1, 0, 0], [0, 0, 0, 0, 0, 0, 0, 0], 1), 0.5);
  assert.equal(spotShare([1, 1, 1, 1], [0, 0, 0, 0], 1), 1);
  // the shader and the Unity port take the same constants
  const enc = body('enclosure'), [b0, b1] = SPOT_POCKET.below.map((x) => x.toFixed(2));
  assert.ok(enc.includes(`smoothstep(${b0}, ${b1}, dy), 1.0, under)`) && enc.includes(`smoothstep(${SPOT_POCKET.up.map((x) => x.toFixed(2)).join(', ')}, n.y)`));
  const unity = readFileSync(new URL('../unity/Hiraeth/Assets/Hiraeth/Shaders/Composite.shader', import.meta.url), 'utf8');
  assert.ok(unity.includes(`lerp(smoothstep(${SPOT_POCKET.below.join(', ')}, dy), 1.0, under)`) && unity.includes('return lerp(occ / n8, pair / (n8 / 2), ground);'));
  assert.ok(unity.includes(`smoothstep(${SPOT_POCKET.up.join(', ')}, n.y)`) && unity.includes(`smoothstep(${SPOT_POCKET.under.join(', ')}, -n.y)`));
});

// A twin of the spot blacks with a person in front (visual audit v1.4, finding 1: a dark copy of the traveller on
// the wall beside him in a room's corner, Handheld): the mask with the person against without, round them.
function personScene(kind, aspect = 16 / 9) {
  const scene = new THREE.Scene(), mat = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.55, 1.75, 0.3).translate(0, 0.875, 0), mat);
  let eye, look;
  if (kind === 'corner') {   // two walls square to each other on a floor; he stands 1.3 m out from the corner
    scene.add(new THREE.Mesh(new THREE.PlaneGeometry(40, 40).rotateX(-Math.PI / 2).translate(10, 0, 10), mat));
    scene.add(new THREE.Mesh(new THREE.PlaneGeometry(40, 8).rotateY(Math.PI / 2).translate(0, 4, 10), mat));
    scene.add(new THREE.Mesh(new THREE.PlaneGeometry(40, 8).translate(10, 4, 0), mat));
    const n = new THREE.Vector3(1, 0, 1).normalize(), foot = n.clone().multiplyScalar(1.3);
    body.position.copy(foot); body.lookAt(foot.clone().add(n));
    eye = new THREE.Vector3(0, 2.2, 0).addScaledVector(n, 5); look = foot.clone().setY(0.9);
  } else if (kind === 'wallend' || kind === 'house') {   // the Shadow Room's house (shadow-room.js): he stands just past its north wall's west end
    scene.add(new THREE.Mesh(new THREE.PlaneGeometry(120, 120).rotateX(-Math.PI / 2).translate(30, 0, -76), mat));
    const B = (w, h, d, x, y, z) => scene.add(new THREE.Mesh(new THREE.BoxGeometry(w, h, d).translate(x, y, z), mat));
    const H = 4.5;
    B(10, H, 0.4, 30, H / 2, -72);   // the north wall, x 25..35
    if (kind === 'house') {
      B(0.4, H, 8, 25, H / 2, -76); B(4.2, H, 0.4, 27.1, H / 2, -80); B(4.2, H, 0.4, 32.9, H / 2, -80); B(1.6, H - 2.6, 0.4, 30, 2.6 + (H - 2.6) / 2, -80);
      B(0.4, 3, 8, 35, 1.5, -76); B(10.6, 0.4, 8.6, 30, H + 0.2, -76);   // the east wall, the roof
    }
    body.position.set(24.39, 0, -71.16); body.rotation.y = 15.089;
    eye = new THREE.Vector3(24.17, 4.02, -66.96); look = new THREE.Vector3(24.4, 1.6, -71.33);
  } else {   // on the stairs, a riser behind him
    const RISE = 0.37, RUN = 0.93;
    for (let s = 0; s < 12; s++) { const top = (s + 1) * RISE, len = 12 - s * RUN; scene.add(new THREE.Mesh(new THREE.BoxGeometry(6.5, top, len).translate(0, top / 2, -s * RUN - len / 2), mat)); }
    scene.add(new THREE.Mesh(new THREE.PlaneGeometry(200, 200).rotateX(-Math.PI / 2), mat));
    body.position.set(0.3, 2 * RISE, 1.3 - 3 * RUN);
    eye = body.position.clone().add(new THREE.Vector3(1.5, 3, 6)); look = body.position.clone().add(new THREE.Vector3(0, 0.9, 0));
  }
  scene.add(body); scene.updateMatrixWorld(true);
  const cam = new THREE.PerspectiveCamera(55, aspect, 0.1, 500);
  cam.position.copy(eye); cam.lookAt(look); cam.updateMatrixWorld(true);
  return { scene, body, cam, look };
}
// The enclosure at uv (as post.js spotLoop): 'past' the rule before (a person's tap looked twice as far out, left
// out if that was a person too), 'behind' the rule now (spotBehind); withPerson false: the same view without him.
function personTwin({ scene, body, cam }, u, v, rule, withPerson, taps, R = 3, H = 360) {
  const ray = new THREE.Raycaster(), toView = new THREE.Matrix3().setFromMatrix4(cam.matrixWorldInverse);
  const hit = (su, sv) => {
    ray.setFromCamera(new THREE.Vector2(su * 2 - 1, sv * 2 - 1), cam);
    const h = ray.intersectObjects(scene.children, false).find((x) => withPerson || x.object !== body);
    return h ? { d: -h.point.clone().applyMatrix4(cam.matrixWorldInverse).z, n: h.face.normal.clone().transformDirection(h.object.matrixWorld), person: h.object === body } : { d: 0, person: false };
  };
  const vp = (a, b) => { const p = new THREE.Vector4(a * 2 - 1, b * 2 - 1, 1, 1).applyMatrix4(cam.projectionMatrixInverse); return [p.x / p.w / -(p.z / p.w), p.y / p.w / -(p.z / p.w)]; };
  const rB = vp(0, 0), r11 = vp(1, 1), rA = [r11[0] - rB[0], r11[1] - rB[1]];
  const ray3 = (a, b) => new THREE.Vector3(a * rA[0] + rB[0], b * rA[1] + rB[1], -1);
  const uvOf = (S) => [(S.x / -S.z - rB[0]) / rA[0], (S.y / -S.z - rB[1]) / rA[1]];
  const h0 = hit(u, v);
  if (!h0.d || h0.person) return null;
  const P = ray3(u, v).multiplyScalar(h0.d), nV = h0.n.clone().applyMatrix3(toView).normalize();
  const k = cam.projectionMatrix.elements[5] * 0.5 * H;
  const Rm = Math.min(96, Math.max(4, R * k / h0.d)) * h0.d / k * (SPOT_SWELL.range[0] + (SPOT_SWELL.range[1] - SPOT_SWELL.range[0]) * spotSwell(P.clone().applyMatrix4(cam.matrixWorld).toArray(), R));
  const [t1, t2] = spotFrame(h0.n.toArray()).map((t) => new THREE.Vector3(...t).applyMatrix3(toView).multiplyScalar(Rm));
  const close = (uv, sd) => { if (sd <= 0) return 0; const w = ray3(...uv).multiplyScalar(sd).sub(P), dist = w.length(); return smooth(0.12, 0.5, nV.dot(w) / dist) * (1 - smooth(R * 1.5, R * 3, dist)); };
  const plane = (h, uv) => ({ n: h.n.clone().applyMatrix3(toView).toArray(), p: ray3(...uv).multiplyScalar(h.d).toArray() });
  const T = OCCLUSION_TAPS.spot(taps).map(([x, y]) => { const o = t1.clone().multiplyScalar(x).addScaledVector(t2, y), uv = uvOf(P.clone().add(o)); return { o, x, y, uv, h: hit(...uv) }; });
  const N = SPOT_PAST.near;
  const seenAround = T.filter((t) => !t.h.person && t.h.d).map((t) => ({ ...plane(t.h, t.uv), lim: N.taps * Rm }));
  let occ = 0, seen = 0;
  // ('now': the shader's whole rule, SPOT_POCKET's on the taps as spotBehind leaves them, spotShare)
  const cs = [], dys = [], persons = [], rot = new THREE.Matrix4().extractRotation(cam.matrixWorld);
  const keep = (uv, d, person) => { cs.push(close(uv, d)); dys.push(d > 0 ? ray3(...uv).multiplyScalar(d).sub(P).applyMatrix4(rot).y : 0); persons.push(person); };
  for (const { o, uv, h } of T) {
    if (!h.person) { occ += close(uv, h.d); seen++; if (rule === 'now') keep(uv, h.d, false); continue; }
    const uv2 = uvOf(P.clone().addScaledVector(o, 2)), h2 = hit(...uv2);
    if (rule === 'past') { if (!h2.person) { occ += close(uv2, h2.d); seen++; } continue; }
    const uv4 = uvOf(P.clone().addScaledVector(o, 4)), h4 = hit(...uv4);
    // (and to either side of the tap's place, along the other axis: SPOT_PAST.side)
    const { x, y } = T.find((t) => t.o === o), op = t1.clone().multiplyScalar(-y).addScaledVector(t2, x).multiplyScalar(SPOT_PAST.side);
    const sides = [1, -1].map((k) => { const q = uvOf(P.clone().add(o).addScaledVector(op, k)); return [hit(...q), q]; });
    const planes = [...[[h2, uv2], [h4, uv4]].filter(([q]) => !q.person && q.d).map(([q, quv]) => ({ ...plane(q, quv), lim: N.past * Rm })),
      ...sides.filter(([q]) => !q.person && q.d).map(([q, quv]) => ({ ...plane(q, quv), lim: N.side * Rm })), ...seenAround];
    const sd = spotBehind(-(P.z + o.z), h.d, ray3(...uv).toArray(), planes, rule === 'now' ? { P: P.toArray(), n: nV.toArray(), reach: Rm } : null);
    occ += close(uv, sd); seen++;
    if (rule === 'now') keep(uv, sd, true);
  }
  return rule === 'now' ? spotShare(cs, dys, h0.n.y, persons) : occ / Math.max(seen, 1);
}
function personGhost(kind, rule, taps, threshold = 0.3, { H = 360, aspect = 16 / 9, step = 6, span = 150 } = {}) {
  const sc = personScene(kind, aspect), W = H * aspect, c = sc.look.clone().project(sc.cam);
  let dark = 0, pale = 0, mass = 0;
  for (let py = -span; py <= span; py += step) for (let px = -span; px <= span; px += step) {
    const u = c.x * 0.5 + 0.5 + px / W, v = c.y * 0.5 + 0.5 + py / H;
    const a = personTwin(sc, u, v, rule, true, taps, 3, H); if (a === null) continue;
    const m1 = smooth(threshold - 0.03, threshold + 0.03, a), m0 = smooth(threshold - 0.03, threshold + 0.03, personTwin(sc, u, v, rule, false, taps, 3, H));
    if (m0 > 0.5) mass++;
    if (m1 - m0 > 0.3) dark++; else if (m0 - m1 > 0.3) pale++;
  }
  return { dark, pale, mass };
}

test('a person in front of a room’s corner leaves the corner’s spot black as it was (no dark copy beside him)', () => {
  // before: a tap on him looked twice as far out, past the corner onto the other wall, which stands in front of the
  // point: a dark copy of him on the wall beside him (Handheld's 4 taps)
  const before = personGhost('corner', 'past', 4), now = personGhost('corner', 'behind', 4);
  assert.ok(before.mass > 50 && before.dark > 25, `the bug, before: ${JSON.stringify(before)}`);
  assert.ok(now.dark <= 2 && now.pale <= 2, `4 taps: ${JSON.stringify(now)}`);
  const now8 = personGhost('corner', 'behind', 8);
  assert.ok(now8.dark <= 2 && now8.pale <= 2, `8 taps: ${JSON.stringify(now8)}`);
});

test('a person on the stairs leaves the risers’ spot blacks behind him as they were', () => {
  for (const taps of [4, 8]) {
    const g = personGhost('stairs', 'behind', taps), old = personGhost('stairs', 'past', taps);
    assert.ok(g.mass > 50, 'risers in view');
    assert.ok(g.dark + g.pale <= Math.max(4, old.dark + old.pale), `${taps} taps: no worse than before (${JSON.stringify(g)} against ${JSON.stringify(old)})`);
    assert.ok(g.dark + g.pale < g.mass * 0.03, `${taps} taps: ${JSON.stringify(g)}`);
  }
});

test('what a person hides: the nearest surface met behind them, never behind the point’s own surface', () => {
  const ray = [0, 0, -1];
  // a wall facing the eye at depth 6 behind a person at 4, the point's own surface along the ray at 8: the wall
  assert.equal(spotBehind(8, 4, ray, [{ n: [0, 0, 1], p: [0, 0, -6] }]), 6);
  // the wall behind the point's own surface (or in front of the person): the point's surface goes on (open)
  assert.equal(spotBehind(8, 4, ray, [{ n: [0, 0, 1], p: [0, 0, -9] }]), 8);
  assert.equal(spotBehind(8, 4, ray, [{ n: [0, 0, 1], p: [0, 0, -3] }]), 8);
  // a surface seen from behind (facing away along the ray) is no wall for it; the nearest of several wins
  assert.equal(spotBehind(8, 4, ray, [{ n: [0, 0, -1], p: [0, 0, -6] }]), 8);
  assert.equal(spotBehind(8, 4, ray, [{ n: [0, 0, 1], p: [0, 0, -7] }, { n: [0, 0.6, 0.8], p: [0, 0, -5] }, { n: [0, 0, 1], p: [0, 0, -6] }]), 5);
  // a plane seen behind the point's own surface (round a convex edge) is not taken (SPOT_PAST.front): the point at
  // depth 8 facing the eye, a wall seen at depth 9 behind it, carried on in front of it
  const round = [{ n: [0.8, 0, 0.6], p: [2.4, 0, -9.2] }];   // (met along the ray at depth 6, seen at 9.2)
  assert.equal(spotBehind(8, 4, ray, round), 6);
  assert.equal(spotBehind(8, 4, ray, round, { P: [0, 0, -8], n: [0, 0, 1], reach: 1 }), 8);
  assert.equal(spotBehind(8, 4, ray, [{ n: [0, 0, 1], p: [0, 0, -6] }], { P: [0, 0, -8], n: [0, 0, 1], reach: 1 }), 6);
  // a plane met far from where it was seen is not taken (SPOT_PAST.near: a wall carried past a wide hem)
  assert.equal(spotBehind(8, 4, ray, [{ n: [0, 0, 1], p: [3, 0, -6], lim: 1 }]), 8);
  assert.equal(spotBehind(8, 4, ray, [{ n: [0, 0, 1], p: [0.5, 0, -6], lim: 1 }]), 6);
});

test('the dust band at a wall’s foot looks past a person on its probe: no pale copy of the traveller in it', () => {
  const at = shader.indexOf('weathered walls: a flat band of darker dust');
  const part = shader.slice(at, shader.indexOf('...and where sand banks', at));
  assert.ok(part.includes('float onPerson = 1.0 - notPerson(puv);'), 'the probe asks whether it is on a person');
  assert.ok(part.includes(`for (int k = 0; k < ${DUST_PAST.steps}; k++)`) && part.includes(`max(dyPx, ${DUST_PAST.minStep.toFixed(3)} * uRes.y)`), 'and looks on down past them');
  assert.ok(part.includes('Np.y > 0.7 && onPerson < 0.5'), 'never takes a person for the ground');
});

test('a person beside a wall’s end leaves no dark copy of themselves on the ground there (the Shadow Room, the author’s view)', () => {
  // before: the look past him carried the wall's end plane on behind him, and the ground beside him read closed from
  // both sides: a person-shaped mass of spot black beside his head
  for (const taps of [4, 8]) {
    const g = personGhost('wallend', 'now', taps);
    assert.ok(g.dark <= 2, `${taps} taps: ${JSON.stringify(g)}`);
  }
});

test('the shader’s rule on people: a corner keeps its walls’ masses as they were, no dark or pale copy beside him', () => {
  for (const taps of [4, 8]) {
    const g = personGhost('corner', 'now', taps);
    assert.ok(g.mass > 20, `${taps} taps: the corner's walls in view (${JSON.stringify(g)})`);
    assert.ok(g.dark <= 3 && g.pale <= 3, `${taps} taps: ${JSON.stringify(g)}`);
  }
});

test('the Shadow Room’s house, the author’s view at his window’s size: no copy of the traveller on its wall’s narrow end', () => {
  // (player, camera and window from the author's console, October 2026: High, 2022 × 698 at render scale 1.5; the pocket's
  //  radius then ~0.5 m, held by its 96 px. The look past him took the planes seen round him, the north face's and the
  //  roof's, carried on behind him in front of the end face: a dark copy of him on it, 37-52 samples here. Only a plane
  //  seen well in front of the point's own surface is taken now: SPOT_PAST.front)
  const o = { H: 1047, aspect: 2022 / 698, step: 8, span: 260 };
  for (const taps of [4, 8]) {
    const g = personGhost('house', 'now', taps, 0.3, o);
    assert.ok(g.mass > 50, `${taps} taps: the house's masses in view (${JSON.stringify(g)})`);
    assert.ok(g.dark <= 2 && g.pale <= 2, `${taps} taps: ${JSON.stringify(g)}`);
  }
});
