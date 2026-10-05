import * as THREE from 'three';
import { makeMaterial, MODE_WATER, MODE_STRATA } from './materials.js';

export const BASIN = { x: -430, z: -180, rx: 72, rz: 49 };
export function basinHeight(x, z, height) {
  const r = Math.hypot((x - BASIN.x) / BASIN.rx, (z - BASIN.z) / BASIN.rz);
  const blend = THREE.MathUtils.smoothstep(r, 0.65, 1.3);
  const bed = height(BASIN.x, BASIN.z) - 1.8 + 2.0 * THREE.MathUtils.smoothstep(r, 0.45, 0.7);
  return THREE.MathUtils.lerp(bed, height(x, z), blend);
}

/** Broad silhouettes and open space from the desert reference sheets. */
export function buildDesertVistas(scene, terrain) {
  const root = new THREE.Group(); root.name = 'Desert reference landmarks'; scene.add(root);
  const cream = makeMaterial({ color: '#efdfc7', flat: true });
  const blue = makeMaterial({ color: '#a9c4d1', flat: true, metal: 'painted' });
  const violet = makeMaterial({ color: '#b7a0bb', color2: '#a995b0', color3: '#d3bfd4', flat: true, mode: MODE_STRATA, strataSize: 7 });
  const rope = makeMaterial({ color: '#716c70', flat: true, metal: 'iron' });
  function mesh(geometry, material, position, parent = root) {
    const m = new THREE.Mesh(geometry, material);m.position.copy(position);parent.add(m);return m;
  }
  function cable(points, radius = .12, parent = root) {
    const m = mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 36, radius, 5), rope, new THREE.Vector3(), parent);
    m.userData.noCollide = true; return m;
  }
  // Dish canopies over the existing dome village; radial seams keep the scale readable.
  for (const [x, z, radius, height, tilt] of [[460, -620, 48, 60, -.18], [590, -690, 36, 48, .24]]) {
    const base = terrain.baseAt(x, z, 9), top = base + height;
    mesh(new THREE.CylinderGeometry(7, 11, height, 14), cream, new THREE.Vector3(x, base + height / 2, z));
    const dish = new THREE.Group();dish.position.set(x, top, z);dish.rotation.z = tilt;root.add(dish);
    const profile = Array.from({length: 13}, (_, i) => {const r=i/12*radius;return new THREE.Vector2(r, 10*(r/radius)**2);});
    mesh(new THREE.LatheGeometry(profile, 48), makeMaterial({color:'#d5e1dd',flat:true,side:THREE.DoubleSide,metal:'painted'}), new THREE.Vector3(), dish);
    for(let i=0;i<12;i++){
      const a=i*Math.PI/6;
      cable(profile.map(p=>new THREE.Vector3(Math.sin(a)*p.x,p.y+.04,Math.cos(a)*p.x)),.075,dish);
    }
    mesh(new THREE.CylinderGeometry(.22,.4,24,6), blue, new THREE.Vector3(0,12,0),dish);
  }
  // Shallow mineral water with a walkable bed, beneath lavender cliffs.
  const waterY = terrain.heightAt(BASIN.x,BASIN.z) + 1.25;
  const water = mesh(new THREE.CircleGeometry(1,64).rotateX(-Math.PI/2), makeMaterial({color:'#69d3c6',color2:'#a3e4d5',mode:MODE_WATER,flat:true}),new THREE.Vector3(BASIN.x,waterY,BASIN.z));
  water.scale.set(BASIN.rx*.66,1,BASIN.rz*.66);water.userData.noCollide=true;
  for(const [dx,dz,r,h] of [[-85,-35,28,38],[-45,-76,33,31],[20,-82,25,27]]){
    const x=BASIN.x+dx,z=BASIN.z+dz,base=terrain.baseAt(x,z,r);
    const m=mesh(new THREE.CylinderGeometry(r*.9,r,h,7),violet,new THREE.Vector3(x,base+h/2-2,z));m.scale.z=.7;
  }
  // A slender suspension bridge between two climbable rock shelves.
  const cx=-430,cz=-470,half=62;
  const top=Math.max(terrain.heightAt(cx-half,cz),terrain.heightAt(cx+half,cz))+28;
  for(const side of [-1,1]){
    const x=cx+side*half,base=terrain.baseAt(x,cz,19),h=top-base;
    mesh(new THREE.CylinderGeometry(18,24,h,7),violet,new THREE.Vector3(x,base+h/2,cz));
    for(const z of [-2.2,2.2])mesh(new THREE.CylinderGeometry(.24,.35,10,6),cream,new THREE.Vector3(x,top+5,cz+z));
  }
  const yAt=t=>top-5*Math.sin(Math.PI*t);
  for(let i=0;i<62;i++){
    const t=(i+.5)/62,x=cx-half+t*half*2,y=yAt(t);
    const plank=mesh(new THREE.BoxGeometry(2.03,.3,4.4),cream,new THREE.Vector3(x,y,cz));
    plank.rotation.z=Math.atan(-5*Math.PI*Math.cos(Math.PI*t)/(half*2));
  }
  for(const side of [-1,1]){
    const pts=Array.from({length:25},(_,i)=>new THREE.Vector3(cx-half+i/24*half*2,yAt(i/24)+4,cz+side*2.2));cable(pts,.15);
    for(let i=0;i<=24;i++){
      const t=i/24,x=cx-half+t*half*2,y=yAt(t);
      cable([new THREE.Vector3(x,y,cz+side*2.2),new THREE.Vector3(x,y+4,cz+side*2.2)],.07);
    }
  }
  return { root, basin: new THREE.Vector3(BASIN.x,waterY,BASIN.z), bridge: new THREE.Vector3(cx,top-5,cz) };
}
