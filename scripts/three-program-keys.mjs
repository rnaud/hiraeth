// Fewer surface programs (docs/systems/performance.md, "Fewer surface programs"): three.js keys a material's program
// on its side (DoubleSide adds DOUBLE_SIDED, BackSide FLIP_SIDED), on whether the geometry has normals (HAS_NORMAL)
// and on the material's vertexColors (USE_COLOR). The surface shader (src/materials.js) reads none of the first
// three (it turns a back face's normal itself) and reads the colour attribute by a uniform (uVertexColors), so for a
// material that says `userData.sharesProgram` these are left out of the key: the same program for both, where each split
// had cost the Xbox another ~0.7 s of compiling. A Vite plugin (vite.config.js) applies this to three's module as it
// is served and built; patchThree throws if three's code has changed, so an upgrade can't silently stop it
// (tests/three-program-keys.test.js runs it on the installed three).
import { readFileSync } from 'node:fs';

/** What is replaced in three's WebGLPrograms.getParameters, and with what. */
export const THREE_PATCHES = [
  ['doubleSided: material.side === DoubleSide,', 'doubleSided: material.side === DoubleSide && material.userData.sharesProgram !== true,'],
  ['flipSided: material.side === BackSide,', 'flipSided: material.side === BackSide && material.userData.sharesProgram !== true,'],
  ['vertexNormals: !! geometry.attributes.normal,', 'vertexNormals: !! geometry.attributes.normal || material.userData.sharesProgram === true,'],
  ['vertexColors: material.vertexColors,', 'vertexColors: material.vertexColors || material.userData.sharesProgram === true,'],
];

/** three.module.js with the patches in. Throws if any of them doesn't match exactly once. */
export function patchThree(code) {
  for (const [from, to] of THREE_PATCHES) {
    const n = code.split(from).length - 1;
    if (n !== 1) throw new Error(`three-program-keys: "${from}" found ${n} times in three.module.js (three.js changed: see scripts/three-program-keys.mjs)`);
    code = code.replace(from, to);
  }
  return code;
}

const isThree = (id) => /[\\/]three[\\/]build[\\/]three\.module\.js$/.test(id.split('?')[0]);

/** The Vite plugin: three's module patched as it is served (three left out of the dev server's pre-bundling, so it is) and built. */
export function threeProgramKeys() {
  return {
    name: 'three-program-keys',
    enforce: 'pre',
    config: () => ({ optimizeDeps: { exclude: ['three'] } }),
    load(id) { return isThree(id) ? patchThree(readFileSync(id.split('?')[0], 'utf8')) : null; },
  };
}
