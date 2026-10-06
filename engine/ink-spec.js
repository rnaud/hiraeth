// A material as the engines see it: makeMaterial's options read back from its uniforms, as plain
// numbers and arrays (no three.js objects), so an engine can pick its own ink shader and set it up.
// (scripts/unity-export/export-world.mjs materialOf reads the same uniforms for the C# port.)
//
//   inkSpec(material) → {
//     type: 'ink' | 'basic' | 'shader' | 'other',  // makeMaterial's G-buffer surface, a plain colour, another shader
//     name, side (0 front, 1 back, 2 double), transparent, opacity, vertexColors, depthWrite, depthTest,
//     defines: { METAL: 1, … },
//     u: { uColor: [r, g, b], uMode: 1, uGlow: 0, … }   // every uniform the material has of its own
//   }
//
// The shared uniforms (sun, shadows, wind, time: sharedUniforms in src/materials.js) are left out:
// they are the frame's, sent once a frame, not each material's.
import { sharedUniforms } from '../src/materials.js';

const SHARED = new Set(Object.keys(sharedUniforms));

/** A uniform's value as numbers: a number, [r, g, b], [x, y(, z, w)], a matrix's 9 / 16, an array of them flattened; null for textures. */
export function plainValue(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number' || typeof v === 'boolean') return +v;
  if (v.isColor) return [v.r, v.g, v.b];
  if (v.isVector2) return [v.x, v.y];
  if (v.isVector3) return [v.x, v.y, v.z];
  if (v.isVector4 || v.isQuaternion) return [v.x, v.y, v.z, v.w];
  if (v.isMatrix3 || v.isMatrix4) return Array.from(v.elements);
  if (v.isTexture) return null;
  if (Array.isArray(v)) {
    const parts = v.map(plainValue);
    return parts.some((p) => p === null) ? null : parts.flat();
  }
  if (ArrayBuffer.isView(v)) return Array.from(v);
  return null;
}

export function inkSpec(m) {
  const spec = {
    type: 'other', name: m.name || '', side: m.side ?? 0, transparent: !!m.transparent, opacity: m.opacity ?? 1,
    vertexColors: !!m.vertexColors, depthWrite: m.depthWrite !== false, depthTest: m.depthTest !== false,
    defines: {}, u: {},
  };
  if (m.defines) for (const [k, v] of Object.entries(m.defines)) spec.defines[k] = typeof v === 'number' ? v : v === '' || v === true ? 1 : String(v);
  if (m.uniforms) {
    spec.type = m.uniforms.uMode ? 'ink' : 'shader';
    for (const [k, u] of Object.entries(m.uniforms)) {
      if (SHARED.has(k)) continue;
      const v = plainValue(u?.value);
      if (v !== null) spec.u[k] = v;
      else if (u?.value?.isTexture) spec.u[k] = { texture: u.value.uuid };
    }
  } else {
    spec.type = m.isMeshBasicMaterial || m.isSpriteMaterial || m.isPointsMaterial || m.isLineBasicMaterial ? 'basic' : 'other';
    if (m.color) spec.u.uColor = [m.color.r, m.color.g, m.color.b];
    if (m.emissive) spec.u.uEmissive = [m.emissive.r, m.emissive.g, m.emissive.b];
    if (m.map) spec.u.map = { texture: m.map.uuid };
  }
  return spec;
}
