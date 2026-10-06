import * as T from 'three';
import { makeMaterial, sharedUniforms as SU } from '../src/materials.js';
import { createPost, PRESETS } from '../src/post.js';
import { createGBuffer, createComposeTarget, createBlit, setSubject } from '../src/pipeline.js';
import { Cascade, shadowDirection } from '../src/shadows.js';

import { makeReviewInkMaterial } from '../src/characters/tripo-material.js';
export { makeReviewInkMaterial };

export function createReviewInk(renderer,scene,meshes,{garment,grid,helper}){
 const post=createPost(),U=post.uniforms,gbuffer=createGBuffer(),compose=createComposeTarget(),blit=createBlit(compose.texture);
 // The game disables colour management and uses printed RGB shader colours.
 // This preview retains normal Three.js colour management for its standard view.
 const converted=new Set();for(const u of [...Object.values(SU),...Object.values(U)])if(u.value?.isColor&&!converted.has(u.value)){converted.add(u.value);u.value.convertLinearToSRGB();}
 for(const [k,v]of Object.entries(PRESETS['Moebius print']))if(U[k])U[k].value=Array.isArray(v)?[...v]:v;
 U.tAlbedo.value=gbuffer.textures[0];U.tNormal.value=gbuffer.textures[1];U.tHatch.value=gbuffer.textures[2];
 const bg=scene.background.clone().convertLinearToSRGB();U.uBackdrop.value.set(bg.r,bg.g,bg.b,1);
 SU.uSunDir.value.set(2,4,3).normalize();SU.uCloudShadows.value=0;U.uSunDir.value.copy(SU.uSunDir.value);
 const materials=meshes.map(mesh=>({mesh,standard:mesh.material,ink:makeReviewInkMaterial(mesh,{lining:mesh===garment})}));
 const cascades=[
  new Cascade({name:'fine',size:2048,extent:12,depth:1600,bias:3.4,offset:2.6,uniforms:{map:SU.uShadowMap0,matrix:SU.uShadowMatrix0,bias:SU.uShadowBias0,offset:SU.uShadowNormalOffset0}}),
  new Cascade({name:'near',size:256,extent:220,depth:1600,uniforms:{map:SU.uShadowMap,matrix:SU.uShadowMatrix,bias:SU.uShadowBias,offset:SU.uShadowNormalOffset}}),
  new Cascade({name:'far',size:256,extent:1150,depth:3200,uniforms:{map:SU.uShadowMap2,matrix:SU.uShadowMatrix2,bias:SU.uShadowBias2,offset:SU.uShadowNormalOffset2}}),
 ];
 for(const c of cascades)c.prime(renderer);cascades[1].disable();cascades[2].disable();
 SU.uShadowTexel.value.set(...cascades.map(c=>c.texel));
 const shadow=new T.MeshBasicMaterial({side:T.DoubleSide,colorWrite:false}),overlay=new T.Scene(),up=new T.Vector3(0,1,0),origin=new T.Vector3(),center=new T.Vector3(0,1,0),dir=shadowDirection(SU.uSunDir.value);
 let width=0,height=0;
 return {render(camera,time){
  const size=renderer.getDrawingBufferSize(new T.Vector2());
  if(width!==size.x||height!==size.y){width=size.x;height=size.y;gbuffer.setSize(width,height);compose.setSize(width,height);U.uRes.value.copy(size);U.uPixelRatio.value=SU.uPixelRatio.value=renderer.getPixelRatio();blit.material.uniforms.resolution.value.set(1/width,1/height);}
  const background=scene.background,gridVisible=grid.visible,helperVisible=helper.visible,autoClear=renderer.autoClear;
  try{
   renderer.autoClear=false;scene.background=null;grid.visible=false;helper.visible=false;
   scene.updateMatrixWorld(true);camera.updateMatrixWorld();
   scene.overrideMaterial=shadow;cascades[0].aim(dir);cascades[0].place(center);cascades[0].render(renderer,scene);scene.overrideMaterial=null;
   for(const m of materials)m.mesh.material=m.ink;
   SU.uTime.value=U.uTime.value=time;U.uInvProj.value.copy(camera.projectionMatrixInverse);U.uCamWorld.value.copy(camera.matrixWorld);U.uProj11.value=camera.projectionMatrix.elements[5];setSubject(U,camera,origin,up);
   renderer.setRenderTarget(gbuffer);renderer.setClearColor(0,0);renderer.clear();renderer.render(scene,camera);
   post.bakeNoise(renderer);renderer.setRenderTarget(compose);renderer.clear();renderer.render(post.scene,post.camera);
   renderer.setRenderTarget(null);renderer.clear();renderer.render(blit.scene,post.camera);
   if(helperVisible){overlay.add(helper);helper.visible=true;renderer.clearDepth();renderer.render(overlay,camera);scene.add(helper);}
  }finally{
   for(const m of materials)m.mesh.material=m.standard;
   scene.overrideMaterial=null;scene.background=background;grid.visible=gridVisible;helper.visible=helperVisible;renderer.autoClear=autoClear;renderer.setRenderTarget(null);
  }
 }};
}
