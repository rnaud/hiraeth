// Fewer surface programs (docs/systems/performance.md, "Fewer surface programs"): three.js keys a material's program
// on its side (DoubleSide adds DOUBLE_SIDED, BackSide FLIP_SIDED), on whether the geometry has normals (HAS_NORMAL)
// and on the material's vertexColors (USE_COLOR). The surface shader (src/materials.js) reads none of the first
// three (it turns a back face's normal itself) and reads the colour attribute by a uniform (uVertexColors), so for a
// material that says `userData.sharesProgram` these are left out of the key: the same program for both, where each split
// had cost the Xbox another ~0.7 s of compiling. A Vite plugin (vite.config.js) applies this to three's module as it
// is served and built; patchThree throws if three's code has changed, so an upgrade can't silently stop it
// (tests/three-program-keys.test.js runs it on the installed three).
import { readFileSync } from 'node:fs';

/** Put into three's module beside its array setters: does the array `v` (numbers, or vectors / colours) hold what the
 *  uniform `u` last sent (u.cache, float32), item by item? keepArray records what was sent. */
export const ARRAY_CACHE = `
function sameArray( u, v, k ) {
	const c = u.cache, n = u.size * k;
	if ( c.length !== n || v.length === undefined ) return false;
	const f = Math.fround;
	if ( typeof v[ 0 ] === 'number' ) {
		if ( v.length < n ) return false;
		for ( let i = 0; i < n; i ++ ) if ( c[ i ] !== f( v[ i ] ) ) return false;
		return true;
	}
	if ( v.length < u.size ) return false;
	for ( let i = 0, j = 0; i < u.size; i ++, j += k ) {
		const e = v[ i ];
		if ( e === null || e === undefined ) return false;
		if ( e.isColor ) { if ( k !== 3 || c[ j ] !== f( e.r ) || c[ j + 1 ] !== f( e.g ) || c[ j + 2 ] !== f( e.b ) ) return false; continue; }
		if ( c[ j ] !== f( e.x ) || c[ j + 1 ] !== f( e.y ) || c[ j + 2 ] !== f( e.z ) || ( k === 4 && c[ j + 3 ] !== f( e.w ) ) ) return false;
	}
	return true;
}
function keepArray( u, data, k ) {
	const n = u.size * k;
	if ( u.cache.length !== n ) u.cache = new Float32Array( n );
	for ( let i = 0; i < n; i ++ ) u.cache[ i ] = data[ i ];
}
`;

/** What is replaced in three's WebGLPrograms.getParameters, and with what. */
export const THREE_PATCHES = [
  ['doubleSided: material.side === DoubleSide,', 'doubleSided: material.side === DoubleSide && material.userData.sharesProgram !== true,'],
  ['flipSided: material.side === BackSide,', 'flipSided: material.side === BackSide && material.userData.sharesProgram !== true,'],
  ['vertexNormals: !! geometry.attributes.normal,', 'vertexNormals: !! geometry.attributes.normal || material.userData.sharesProgram === true,'],
  ['vertexColors: material.vertexColors,', 'vertexColors: material.vertexColors || material.userData.sharesProgram === true,'],
  // (renderObjects: a scene's override material may pick one of its variants for each object, `overrideFor(object)`.
  //  One override material drawing plain, instanced and skinned meshes in turn had three look its program up again at
  //  every change of kind (getParameters, the cache key: ~1.8 ms a frame of the Xbox's shadow passes); a variant per
  //  kind keeps each one's program. The variants compile the same programs. main.js shadowOverride)
  ['material = overrideMaterial;', 'material = overrideMaterial.overrideFor !== undefined ? overrideMaterial.overrideFor( object ) : overrideMaterial;'],
  // (an array of vectors, the light list or a palette: compared with what the program last got before it is flattened
  //  and sent, as three does for a single vector; it flattened every one at every material change, ~2 ms a frame of
  //  the Xbox's main thread. sameArray below)
  ['function setValueV3fArray( gl, v ) {\n\n\tconst data = flatten( v, this.size, 3 );\n\n\tgl.uniform3fv( this.addr, data );\n\n}',
    'function setValueV3fArray( gl, v ) {\n\n\tif ( sameArray( this, v, 3 ) ) return;\n\n\tconst data = flatten( v, this.size, 3 );\n\n\tgl.uniform3fv( this.addr, data );\n\n\tkeepArray( this, data, 3 );\n\n}'],
  ['function setValueV4fArray( gl, v ) {\n\n\tconst data = flatten( v, this.size, 4 );\n\n\tgl.uniform4fv( this.addr, data );\n\n}',
    'function setValueV4fArray( gl, v ) {\n\n\tif ( sameArray( this, v, 4 ) ) return;\n\n\tconst data = flatten( v, this.size, 4 );\n\n\tgl.uniform4fv( this.addr, data );\n\n\tkeepArray( this, data, 4 );\n\n}'],
  // (a texture uploaded again, a body's bones every frame, a batch's tables: its sampling parameters set again only if
  //  they changed; a GL texture keeps them. Each upload had set four or five, ~95 texParameteri calls a frame)
  ['\t\t\tsetTextureParameters( textureType, texture );\n',
    '\t\t\tconst paramsKey = texture.wrapS + \',\' + texture.wrapT + \',\' + texture.wrapR + \',\' + texture.magFilter + \',\' + texture.minFilter + \',\' + texture.anisotropy + \',\' + texture.compareFunction + \',\' + texture.generateMipmaps;\n\t\t\tif ( textureProperties.__paramsKey !== paramsKey || sourceProperties.__version === undefined || forceUpload === true ) {\n\n\t\t\t\tsetTextureParameters( textureType, texture ); textureProperties.__paramsKey = paramsKey;\n\n\t\t\t}\n'],
  ['// Array of vectors (from flat array or array of THREE.VectorN)\n',
    `// Array of vectors (from flat array or array of THREE.VectorN), compared with what was sent before they are\n${ARRAY_CACHE}`],
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
