import * as T from 'three';
import { makeMaterial, sharedUniforms as SU } from '../materials.js';
// Adapt the imported linear-space textures/colours to the game's printed-colour
// G-buffer. Keep the preview's repair and lining treatments in both render modes.
export function makeReviewInkMaterial(mesh, { lining = false } = {}) {
 const original=mesh.material;
 const mat=makeMaterial({color:original.color,map:original.map,vertexColors:original.vertexColors,side:original.side,figure:true}).clone();
 Object.assign(mat.uniforms,SU);
 const repair=!!mesh.geometry.attributes.trouserRepair;
 if(repair){
  mat.vertexShader=mat.vertexShader.replace('out vec2 vTextureUV;', 'out vec2 vTextureUV;\nin float trouserRepair; out float vRepair;').replace('vTextureUV = uv;', 'vTextureUV = uv; vRepair = trouserRepair;');
  mat.fragmentShader=mat.fragmentShader.replace('in vec2 vTextureUV;', 'in vec2 vTextureUV; in float vRepair;');
 }
 const fabric=new T.Color().setHex(0xcbb897, T.LinearSRGBColorSpace).convertSRGBToLinear(),inside=new T.Color().setHex(0xb46249, T.LinearSRGBColorSpace).convertSRGBToLinear();
 mat.fragmentShader=mat.fragmentShader.replace('albedo *= instColor;', `albedo *= instColor;
 ${repair?`albedo=mix(albedo,vec3(${fabric.toArray().join(',')}),vRepair);`:''}
 ${lining?`if (!gl_FrontFacing) albedo=vec3(${inside.toArray().join(',')});`:''}
 albedo=mix(albedo*12.92,1.055*pow(max(albedo,vec3(0.0)),vec3(1.0/2.4))-.055,step(vec3(.0031308),albedo));`);
 return mat;
}
