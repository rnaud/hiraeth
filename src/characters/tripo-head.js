import * as T from 'three';
import { cleanExpression } from '../expression.js';
import { HEAD_INK_GLSL, headInkState, headSide } from './head-ink.js';

// The approved H3.1 export is kept intact. This uniform fit puts its neck inside
// the scarf; the skull/hair silhouette is unchanged, and the face is drawn over its paint (head-ink.js).
export const HEAD_FIT = Object.freeze({ scale: 0.32, offset: [-0.001, 1.455, -0.006], neck: [1.495, 1.557] });
export const HEAD_KEYS = ['blink', 'smile', 'brow', 'browTilt', 'asymmetry', 'open'];
const smooth = (a, b, x) => { const t = T.MathUtils.clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const patch = (x, y, w, h) => 1 - smooth(0.55, 1, Math.hypot(x / w, y / h));

/** Remove just the old skin/scalp after garment extraction, including unused vertices. */
export function removeOriginalHead(mesh) {
  const g = mesh.geometry, p = g.attributes.position, skin = g.attributes.travellerSkin, hair = g.attributes.travellerHair;
  const indices = [], remap = new Map();
  for (let k = 0; k < g.index.count; k += 3) {
    const face = [0, 1, 2].map(j => g.index.getX(k + j));
    const remove = face.some(i => p.getY(i) > 1.55) || face.reduce((sum, i) => sum + (p.getY(i) > 1.55 ? 1 : Math.max(skin.getX(i), hair.getX(i))), 0) > 1.4;
    if (remove) continue;
    for (const i of face) { if (!remap.has(i)) remap.set(i, remap.size); indices.push(remap.get(i)); }
  }
  const out = new T.BufferGeometry();
  for (const [name, a] of Object.entries(g.attributes)) {
    const values = new a.array.constructor(remap.size * a.itemSize);
    for (const [old, next] of remap) for (let j = 0; j < a.itemSize; j++) values[next * a.itemSize + j] = a.array[old * a.itemSize + j];
    out.setAttribute(name, new T.BufferAttribute(values, a.itemSize, a.normalized));
  }
  out.setIndex(indices); out.computeBoundingBox(); out.computeBoundingSphere(); mesh.geometry = out; g.dispose();
}

/** Bind a separate generated head to exactly the body's fitted rest skeleton. */
export function makeTripoHead(asset, body) {
  const sources = []; asset.scene.traverse(o => { if (o.isMesh) sources.push(o); });
  if (sources.length !== 1) throw new Error('Tripo head v2 expects its single original mesh');
  const source = sources[0], g = source.geometry.clone(), original = g.attributes.position.clone();
  const p = g.attributes.position, s = HEAD_FIT.scale, off = HEAD_FIT.offset;
  const bones = body.skeleton.bones, headIndex = bones.findIndex(b => b.name === 'Head'), neckIndex = bones.findIndex(b => b.name === 'neck_01');
  if (headIndex < 0 || neckIndex < 0) throw new Error('Tripo head needs the fitted Head and neck_01 joints');
  const si = new Uint16Array(p.count * 4), sw = new Float32Array(p.count * 4);
  for (let i = 0; i < p.count; i++) {
    const x = original.getX(i), y = original.getY(i), z = original.getZ(i);
    // Height alone also caught the low chin. Restrict the scarf repair to the
    // throat cylinder, behind the jaw, so the approved profile stays unchanged.
    const throat = 1 - smooth(0.12, 0.17, Math.hypot(x, z + 0.02));
    const neckFlare = 1 + 0.45 * (1 - smooth(0.20, 0.32, y)) * throat;
    p.setXYZ(i, x * s * neckFlare + off[0], y * s + off[1], z * s * neckFlare + off[2]);
    // Low jaw vertices belong to the skull even at the neck blend's height.
    const head = Math.max(smooth(...HEAD_FIT.neck, p.getY(i)), (1 - throat) * smooth(0.21, 0.25, y));
    si[i * 4] = headIndex; si[i * 4 + 1] = neckIndex; sw[i * 4] = head; sw[i * 4 + 1] = 1 - head;
  }
  // The export's flared display base ends below the scarf, so trim its hidden foot.
  const keep = [];
  for (let i = 0; i < g.index.count; i += 3) {
    const tri = [0, 1, 2].map(k => g.index.getX(i + k));
    if (tri.every(j => original.getY(j) > 0.09)) keep.push(...tri);
  }
  g.setIndex(keep);
  g.setAttribute('skinIndex', new T.Uint16BufferAttribute(si, 4));
  g.setAttribute('skinWeight', new T.Float32BufferAttribute(sw, 4));
  // Small shape keys deform the generated features and carry their own UVs with
  // them; the drawn face (head-ink.js, in rest coordinates) rides them the same way.
  // The gaze moves only the drawn iris (a uniform), not the lids.
  const keys = HEAD_KEYS.map(() => new Float32Array(p.count * 3));
  for (let i = 0; i < p.count; i++) {
    const x = original.getX(i), y = original.getY(i), z = original.getZ(i), side = Math.sign(x), ax = Math.abs(x);
    const front = smooth(0.15, 0.20, z), eyeX = ax - 0.102, eyeY = y - 0.593;
    const eye = patch(eyeX, eyeY, 0.074, 0.048) * front;
    const brow = patch(ax - 0.11, y - 0.651, 0.092, 0.047) * front;
    const mouth = patch(x, y - 0.396, 0.17, 0.10) * front;
    const corner = smooth(0.015, 0.105, ax) * mouth;
    const lower = (1 - smooth(0.385, 0.415, y)) * patch(x, y - 0.355, 0.20, 0.16) * front;
    const delta = (k, dx, dy, dz = 0) => { keys[k][i * 3] = dx * s; keys[k][i * 3 + 1] = dy * s; keys[k][i * 3 + 2] = dz * s; };
    delta(0, 0, -eyeY * 0.995 * eye);
    delta(1, side * 0.012 * corner, 0.022 * corner);
    delta(2, 0, 0.022 * brow);
    delta(3, 0, (0.11 - ax) * 0.33 * brow);
    delta(4, 0, side * (0.009 * brow + 0.006 * corner));
    delta(5, 0, -0.05 * lower, -0.006 * lower);
  }
  g.morphAttributes.position = keys.map((a, i) => { const attr = new T.Float32BufferAttribute(a, 3); attr.name = HEAD_KEYS[i]; return attr; });
  // Normal deltas keep moving eyelids/lips lit with their deformed surface.
  // Subtract a computed base so neutral still uses Tripo's supplied normals.
  const scratch = new T.BufferGeometry(); scratch.setIndex(g.index);
  scratch.setAttribute('position', p.clone()); scratch.computeVertexNormals();
  const baseNormals = scratch.attributes.normal.array.slice();
  g.morphAttributes.normal = keys.map(a => {
    const q = scratch.attributes.position.array;
    for (let i = 0; i < q.length; i++) q[i] = p.array[i] + a[i];
    scratch.computeVertexNormals();
    return new T.Float32BufferAttribute(scratch.attributes.normal.array.map((v, i) => v - baseNormals[i]), 3);
  });
  scratch.dispose();
  g.morphTargetsRelative = true;
  g.computeBoundingBox(); g.computeBoundingSphere();
  const mesh = new T.SkinnedMesh(g, source.material.clone()); mesh.name = 'TravellerTripoHeadV2'; mesh.frustumCulled = false;
  body.parent.add(mesh); mesh.bind(body.skeleton, body.bindMatrix);
  return mesh;
}

const SRGB_LINE = 'albedo=mix(albedo*12.92,1.055*pow(max(albedo,vec3(0.0)),vec3(1.0/2.4))-.055,step(vec3(.0031308),albedo));';
/** Existing expression/blink/speech interface, now driving the new mesh's shape keys. */
export function wearTripoHeadFace(mesh) {
  const mat = mesh.material;
  if (!mat.fragmentShader.includes(SRGB_LINE)) throw new Error('Head face needs the game ink material');
  mat.uniforms.uHeadSpeech = { value: new T.Vector4() };
  mat.uniforms.uHeadEye = { value: new T.Vector4() };
  mat.uniforms.uHeadSide = { value: 0 };
  mat.fragmentShader = mat.fragmentShader.replace('void main()', `uniform vec4 uHeadSpeech;\n${HEAD_INK_GLSL}\nvoid main()`).replace(SRGB_LINE, `${SRGB_LINE}
    vec3 hb = (vBind - vec3(${HEAD_FIT.offset.join(',')})) / ${HEAD_FIT.scale};
    // the face drawn over the paint (head-ink.js), with the size of a pixel in source units
    albedo = headInk(albedo, hb, max(fwidth(hb.x) + fwidth(hb.y), 1e-6) * 0.75);
    // Speech shades a small opening on the deformed lip surface; this is stylized ink, not an oral cavity.
    float ha = max(fwidth(hb.y), 0.001);
    float ho = uHeadSpeech.x;
    float hx = hb.x / (0.094 - 0.015 * ho);
    float hh = 0.026 * ho * sqrt(max(0.0, 1.0 - hx * hx));
    float mouthInk = (1.0 - smoothstep(hh - ha, hh + ha, abs(hb.y - 0.396)))
      * (1.0 - smoothstep(0.94, 1.0, abs(hx))) * smoothstep(0.19, 0.23, hb.z) * smoothstep(0.015, 0.06, ho);
    vec3 oral = vec3(0.16, 0.055, 0.045);
    float teeth = smoothstep(0.25, 0.65, uHeadSpeech.y) * smoothstep(0.40, 0.65, ho)
      * smoothstep(0.398, 0.402, hb.y) * (1.0 - smoothstep(0.65, 0.82, abs(hx)));
    albedo = mix(albedo, mix(oral, vec3(0.83,0.77,0.65), teeth), mouthInk);
  `);
  mat.needsUpdate = true;
  const matrix = new T.Matrix4(), view = new T.Matrix4(), cam = new T.Vector3();
  const headBone = mesh.skeleton?.bones.findIndex(b => b.name === 'Head') ?? -1;
  const centre = new T.Vector3(HEAD_FIT.offset[0], 1.619, 0.076);
  // Which side of his face the camera is on (rest space: the sine of its angle off his nose, + his left),
  // for the nose's line on the side turned away: worked out as each camera draws him (portraits too).
  mesh.onBeforeRender = (renderer, scene, camera) => {
    const u = mesh.material.uniforms?.uHeadSide;
    if (!u || headBone < 0) return;
    const sk = mesh.skeleton;
    view.multiplyMatrices(sk.bones[headBone].matrixWorld, sk.boneInverses[headBone]).multiply(mesh.bindMatrix).premultiply(mesh.bindMatrixInverse).premultiply(mesh.matrixWorld).invert();
    cam.setFromMatrixPosition(camera.matrixWorld).applyMatrix4(view).sub(centre);
    u.value = headSide(cam);
  };
  const face = {
    mesh, expression: cleanExpression(), blink: 0, look: [0, 0], state: headInkState(cleanExpression()),
    set(e) { this.expression = cleanExpression(e); this.push(); },
    eyes(blink = 0, squint = null, look = null) {
      this.blink = blink;
      if (squint != null) this.expression.squint = squint;
      this.look[0] = look ? (look.x ?? look[0]) : 0; this.look[1] = look ? (look.y ?? look[1]) : 0;
      this.push();
    },
    push() {
      const s = headInkState(this.expression, { blink: this.blink, look: this.look }, this.state), w = mesh.morphTargetInfluences;
      for (let i = 0; i < s.keys.length; i++) w[i] = s.keys[i];
      // (the uniforms looked up each push: markHero gives the player copies of his materials)
      const u = mesh.material.uniforms;
      u.uHeadSpeech?.value.set(s.speech[0], s.speech[1], 0, 0);
      u.uHeadEye?.value.set(...s.eye);
    },
    at(head, out) {
      const sk = mesh.skeleton, i = sk.bones.indexOf(head); if (i < 0) return null;
      matrix.multiplyMatrices(head.matrixWorld, sk.boneInverses[i]).multiply(mesh.bindMatrix).premultiply(mesh.bindMatrixInverse).premultiply(mesh.matrixWorld);
      return out.set(HEAD_FIT.offset[0], 1.619, 0.076).applyMatrix4(matrix);
    },
    facing(out) { return out.set(0, 0, 1).transformDirection(matrix); },
  };
  face.push(); return face;
}
