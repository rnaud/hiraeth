// Issue #473: the traveller's eyes in Unity were blurred next to the web's. The page paints them from his head's 2048 px
// texture (portrait-head.js wearPortraitHeadFace, uMap); the engines' VM decodes no JPEG, so Unity drew them from his vertex
// colours (engine/traveller-paint.js), a few vertices across an iris. Now the eyes and brows go as their own picture
// (scripts/tripo/bake-eye-paint.mjs, eye-paint.png), read by the head's fit in PortraitFace.hlsl as the page reads uMap.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import sharp from 'sharp';
import { LIVE_VECTORS } from '../engine/mirror.js';
import { inkSpec } from '../engine/ink-spec.js';
import { portMaterial } from '../engine/unity/port-format.js';
import { UnityBackend } from '../engine/unity/backend.js';
import { ENCODED_TEXTURES } from '../engine/encoded-textures.js';
import { makeMaterial } from '../src/materials.js';
import { PORTRAIT_EYE_PAINT, PORTRAIT_EYES_FAR, PORTRAIT_FACE_INK } from '../src/characters/portrait-head.js';
import { bakeEyePaint, readHead } from '../scripts/tripo/bake-eye-paint.mjs';

THREE.ColorManagement.enabled = false;
const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const PNG = new URL('../public/characters/traveller-v1/head-v3/eye-paint.png', import.meta.url).pathname;
const FACE = read('unity/Hiraeth/Assets/Hiraeth/Shaders/PortraitFace.hlsl'), SURFACE = read('unity/Hiraeth/Assets/Hiraeth/Shaders/Surface.shader');
const HEAD = read('src/characters/portrait-head.js').replace(/\s/g, '');

test('eye-paint.png is what bake-eye-paint.mjs makes of head-v3, at PORTRAIT_EYE_PAINT\'s size', async () => {
  const { data: made, info } = await sharp(await bakeEyePaint()).raw().toBuffer({ resolveWithObject: true });
  const { data: kept } = await sharp(PNG).raw().toBuffer({ resolveWithObject: true });
  assert.deepEqual([info.width, info.height, info.channels], [...PORTRAIT_EYE_PAINT.size, 4]);
  assert.equal(Buffer.compare(made, kept), 0, 'run node scripts/tripo/bake-eye-paint.mjs');
});

test('the eye paint is as fine as the head\'s own texture round the eyes, many times finer than its vertices', () => {
  const { P, U, index } = readHead();
  const { box: [x0, y0, x1, y1], size: [w, h] } = PORTRAIT_EYE_PAINT;
  let fa = 0, ua = 0, edges = 0, n = 0;
  const area = (A, s, v) => Math.abs((A[v[1] * s] - A[v[0] * s]) * (A[v[2] * s + 1] - A[v[0] * s + 1]) - (A[v[2] * s] - A[v[0] * s]) * (A[v[1] * s + 1] - A[v[0] * s + 1])) / 2;
  for (let t = 0; t < index.length; t += 3) {
    const v = [index[t], index[t + 1], index[t + 2]];
    const cx = (P[v[0] * 3] + P[v[1] * 3] + P[v[2] * 3]) / 3, cy = (P[v[0] * 3 + 1] + P[v[1] * 3 + 1] + P[v[2] * 3 + 1]) / 3, cz = (P[v[0] * 3 + 2] + P[v[1] * 3 + 2] + P[v[2] * 3 + 2]) / 3;
    if (cz < 0.1 || Math.hypot((cx - (cx < 0 ? -0.118 : 0.125)) / 0.052, (cy - 0.522) / 0.024) > 1) continue;
    fa += area(P, 3, v); ua += area(U, 2, v) * 2048 * 2048;
    edges += Math.hypot(P[v[1] * 3] - P[v[0] * 3], P[v[1] * 3 + 1] - P[v[0] * 3 + 1]); n++;
  }
  const texture = Math.sqrt(ua / fa), paint = Math.min(w / (x1 - x0), h / (y1 - y0)), vertices = n / edges;
  assert.ok(paint >= texture * 0.95, `the paint's ${paint.toFixed(0)} px a unit against the JPEG's ${texture.toFixed(0)}`);
  assert.ok(paint >= vertices * 8, `and the vertex colours' ${vertices.toFixed(0)} a unit`);
  // (and the box holds both eyes, their lash lines and the brows: PORTRAIT_EYES_FAR's zone and the brow box)
  const [zx, zy] = PORTRAIT_EYES_FAR.zone;
  assert.ok(x0 < -0.118 - zx && x1 > 0.125 + zx && y0 < 0.522 - zy && y1 > 0.592 + 0.05);
});

test('each painted eye: a dark pupil at its middle on a light white, sharp edges (the web\'s, not a blur)', async () => {
  const { data } = await sharp(PNG).raw().toBuffer({ resolveWithObject: true });
  const { box: [x0, y0, x1, y1], size: [w, h] } = PORTRAIT_EYE_PAINT;
  const lum = (x, y) => { const i = Math.round((x - x0) / (x1 - x0) * w - 0.5), j = Math.round((y1 - y) / (y1 - y0) * h - 0.5), k = (j * w + i) * 4; return 0.3 * data[k] + 0.55 * data[k + 1] + 0.15 * data[k + 2]; };
  for (const ex of [-0.118, 0.125]) {
    let lo = 255, hi = 0, step = 0;
    for (let x = ex - 0.045; x <= ex + 0.045; x += 1 / 1200) {
      const l = lum(x, 0.522); lo = Math.min(lo, l); hi = Math.max(hi, l);
      step = Math.max(step, Math.abs(lum(x + 1 / 1150, 0.522) - l));
    }
    assert.ok(lo < 60 && hi > 170, `eye ${ex}: pupil ${lo.toFixed(0)}, white ${hi.toFixed(0)}`);
    assert.ok(step > 40, `eye ${ex}: the iris's edge within a texel or two (${step.toFixed(0)})`);
  }
});

test('the port: the box and the live iris on the head\'s material, the picture named _EyePaint after it, -js-off eyepaint the before', () => {
  const m = makeMaterial({ color: '#ffffff', figure: true }).clone();
  Object.assign(m.uniforms, { uHeadSpeech: { value: new THREE.Vector4() }, uPortraitBlink: { value: 0 }, uHeadEye: { value: new THREE.Vector4(0, 0, 0.004, -0.002) } });
  m.userData.portraitFace = [-0.001, 1.487, -0.006, 0.28, 0.293];
  m.userData.portraitEyeBox = PORTRAIT_EYE_PAINT.box.slice();
  const tex = new THREE.Texture();
  tex.image = { width: 1, height: 1, data: null };
  tex.userData.encoded = { bytes: new Uint8Array([137, 80, 78, 71]), mime: 'image/png' };
  ENCODED_TEXTURES.set('eyes.png', tex);
  m.userData.portraitEyePaint = 'eyes.png';
  // (a clone keeps it: three copies userData through JSON)
  assert.equal(m.clone().userData.portraitEyePaint, 'eyes.png');
  const p = portMaterial(inkSpec(m), 1);
  assert.deepEqual(p.phEyeBox, [...PORTRAIT_EYE_PAINT.box]); assert.deepEqual(p.phEye, [0, 0, 0.004, -0.002]);
  const calls = [];
  const host = { Material: (mid, json) => calls.push(['mat', mid, JSON.parse(json)]), TextureImage: (id, b, flags) => calls.push(['img', id, flags]), Texture() {}, MaterialTexture: (mid, prop, tid) => calls.push(['tex', mid, prop, tid]) };
  new UnityBackend(host).material(7, inkSpec(m), m);
  assert.deepEqual(calls.map((c) => c[0]), ['mat', 'img', 'tex']);
  assert.ok(calls[0][2].phEyeBox, 'the box with the material');
  assert.equal(calls[1][2] & 3, 1, 'three\'s flipY; not sRGB: display values as the page\'s shader turns its uMap to');
  assert.deepEqual(calls[2].slice(1, 3), [7, '_EyePaint']);
  const before = new UnityBackend(host); before.eyePaint = false; calls.length = 0;
  before.material(8, inkSpec(m), m);
  assert.deepEqual(calls.map((c) => c[0]), ['mat']); assert.equal(calls[0][2].phEyeBox, undefined, 'his vertex colours as before');
  // (the iris's offset live: uHeadEye, one for one with the C# names)
  const cs = read('unity/Hiraeth/Assets/HiraethJS/Runtime/BridgeRenderer.cs').match(/static readonly string\[\] LiveVectors = \{([^}]+)\}/)[1].match(/"[^"]+"/g);
  assert.equal(cs[LIVE_VECTORS.indexOf('uHeadEye')], '"_PhEye"');
  const loader = read('unity/Hiraeth/Assets/Hiraeth/Runtime/WorldLoader.cs');
  for (const k of ['phEyeBox', 'phEye']) assert.ok(loader.includes(`("${k}", "_`), `WorldLoader sets ${k}`);
  assert.ok(read('unity/Hiraeth/Assets/HiraethJS/Editor/BridgeBuild.cs').includes('"eye-paint.png"'), 'the players carry the picture');
  assert.ok(read('engine/game.js').includes("'characters/traveller-v1/head-v3/eye-paint.png'") && read('engine/game.js').includes('encodedPicture(EYES)'));
});

test('PortraitFace.hlsl works the paint with the web\'s numbers (portrait-head.js)', () => {
  for (const n of ['.052,.024', '.074,.040', '.085,.11', '.034,.05', '.12,ph.y-.592', '.06,.17', '.12,.25', '.28,.62', '.2,.42', '.17,.2', '.15,.2', '.79,.525,.37'])
    assert.ok(HEAD.includes(n), `portrait-head.js still ${n}`);
  const f = FACE.replace(/\s/g, '').replace(/0\./g, '.');
  for (const n of ['.052,.024', '.074,.040', '.085,.11', '.034,.05', '.12,ph.y-.592', '.06,.17', '.12,.25', '.28,.62', '.2,.42', '.17,.2', '.15,.2', '.79,.525,.37'])
    assert.ok(f.includes(n), `PortraitFace.hlsl ${n}`);
  const fx = (a) => a.map((v) => String(v).replace(/^0\./, '.')).join(',');
  assert.ok(f.includes(`smoothstep(${fx(PORTRAIT_EYES_FAR.face.map((v) => v.toFixed(1)))},faceR)`.replace(/\.0(?=[,)])/g, '.0')), 'the far fade\'s face heights');
  assert.ok(f.includes(fx(PORTRAIT_EYES_FAR.tone)) && f.includes(fx(PORTRAIT_EYES_FAR.brow)), 'the far tones');
  assert.ok(f.includes(`${String(PORTRAIT_FACE_INK.faceHeight).replace(/^0\./, '.')}/max(max(fwidth(ph.x),fwidth(ph.y))`), 'the face\'s height');
  assert.match(FACE, /if \(_PhEyeBox\.z > _PhEyeBox\.x\) albedo = portraitEyePaint\(albedo, ph\);/);
  assert.match(SURFACE, /#define HIRAETH_EYE_PAINT_DECLARED\s*\n\s*TEXTURE2D\(_EyePaint\)/);
  assert.match(SURFACE, /float4 _PhEyeBox, _PhEye;/);
});

test('people\'s eyes in Unity (Figure.hlsl) are the web\'s: eyes.js EYE_GLSL\'s iris and materials.js eyeball\'s lid and lash line', () => {
  const web = (read('src/eyes.js') + read('src/materials.js')).replace(/\s/g, '');
  const fig = read('unity/Hiraeth/Assets/Hiraeth/Shaders/Figure.hlsl').replace(/\s/g, '').replace(/lerp/g, 'mix').replace(/float(?=[234]\()/g, 'vec');
  for (const n of ['mix(c,mix(iris,EYE_INK,0.72),smoothstep(0.8-aa,0.8+aa,r)*near', '(1.0-smoothstep(0.4-aa,0.4+aa,r))*near', 'smoothstep(0.17-aa,0.17+aa,length(e-vec2(-0.26,0.3)))',
    'hl*smoothstep(3.0,5.5,rpx)', 'mix(0.42,-0.62,', '(1.15+0.5*smoothstep(-0.6,0.8,d.x*side))*(1.0-0.35*', 'smoothstep(lash-fy*0.6,lash+fy*0.6,-dy))*step(dy,fy*0.5)']) {
    assert.ok(web.includes(n), `the web still ${n}`);
    assert.ok(fig.replace(/nearK/g, 'near').includes(n), `Figure.hlsl ${n}`);
  }
});
