import * as THREE from 'three';
import { makeMaterial, MODE_WATER, MODE_STRATA } from './materials.js';

export const BASIN = { x: -430, z: -180, rx: 72, rz: 49 };
/**
 * The mineral basin's cut (issue #200: "the water pond in the desert is floating above the desert"). Until v1.57 its bed
 * sank 1.8 m and rose back over a long shallow bank, the water 0.55 m deep at the middle and its sheet's edge level with
 * the crust round it, so from anywhere but overhead it read as a sheet laid on the sand. Now a bank (r 0.44 → 0.82 of
 * the basin's radii: its top no sharper than a dune's crest for the bike, tests/dunes.test.js) goes down to a bed
 * `depth` m below, the water `low` m under the crust round it: the waterline meets the bank at about r 0.61, and the
 * sheet, out to r `sheet`, ends inside the bank, under the ground.
 */
export const BASIN_CUT = { depth: 2.2, low: 1.3, bank: [0.44, 0.82], blend: [0.78, 1.25], sheet: 0.68 };
export function basinHeight(x, z, height) {
  const r = Math.hypot((x - BASIN.x) / BASIN.rx, (z - BASIN.z) / BASIN.rz);
  const C = BASIN_CUT, blend = THREE.MathUtils.smoothstep(r, C.blend[0], C.blend[1]);
  if (blend >= 1) return height(x, z);   // (outside it, the ground exactly as it is)
  const bed = height(BASIN.x, BASIN.z) - C.depth * (1 - THREE.MathUtils.smoothstep(r, C.bank[0], C.bank[1]));
  return THREE.MathUtils.lerp(bed, height(x, z), blend);
}

/**
 * The basin's shore (issue #200), laid on the bank its cut makes: a band of wet sand from the waterline up, damp sand
 * over it to the bank's top, and a lip of pale salt stones along the top, so the water reads as lying down in the
 * crust and not on it. Drawn on the ground (the bands, polygon offset) and walked through (the stones), nothing to collide with.
 */
export const BASIN_RIM = { wet: [0.58, 0.665], damp: [0.665, 0.75], lip: 0.765, stones: 60 };
function buildBasinRim(root, terrain) {
  const C = BASIN, at = (a, r) => [C.x + Math.cos(a) * C.rx * r, C.z + Math.sin(a) * C.rz * r];
  const onGround = (m) => { m.polygonOffset = true; m.polygonOffsetFactor = -2; m.polygonOffsetUnits = -4; return m; };
  const band = ([r0, r1], color, name, lift) => {
    const segs = 384, rings = 8, pos = [], idx = [];
    for (let s = 0; s <= segs; s++) for (let k = 0; k <= rings; k++) {
      // (ragged edges: each band's inner and outer lines wander, so the shore is no drawn ellipse)
      const a = s / segs * Math.PI * 2, j = 0.018 * Math.sin(a * 5 + r0 * 40) + 0.012 * Math.sin(a * 13 + r1 * 70);
      const [x, z] = at(a, r0 + (r1 - r0) * k / rings + j * (k === 0 || k === rings ? 1 : 0.5));
      // (terrain.heightAt is the drawn ground's own triangles: the band, close-meshed, lies a few centimetres over them)
      const t = terrain.heightAt(x, z);
      pos.push(x, t + lift, z);   // (under the water's line, the water over it)
    }
    for (let s = 0; s < segs; s++) for (let k = 0; k < rings; k++) {
      const i = s * (rings + 1) + k, j = i + rings + 1;
      idx.push(i, j, i + 1, i + 1, j, j + 1);   // (facing up)
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
    const m = new THREE.Mesh(g, onGround(makeMaterial({ color, flat: true }))); m.name = name; m.userData.noCollide = true; root.add(m);
    return m;
  };
  band(BASIN_RIM.wet, '#d6c19c', 'Basin shore (wet sand)', 0.05);   // (over the damp where their ragged edges cross)
  band(BASIN_RIM.damp, '#e9dcc2', 'Basin shore (damp sand)', 0.035);
  // the salt lip: low pale stones along the bank's top, scattered as the plain's pebbles are (instanced, walked through:
  // a solid row of them changed the desert's collision enough to move a fragment's footing far off, tests/contact-audit)
  const n = BASIN_RIM.stones, dummy = new THREE.Object3D();
  const lip = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1, 0), makeMaterial({ color: '#efe7d6', color2: '#ddd2bd', flat: true }), n);
  for (let i = 0; i < n; i++) {
    const a = i / n * Math.PI * 2 + 0.05 * Math.sin(i * 7.1), r = BASIN_RIM.lip + 0.012 * Math.sin(i * 3.7);
    const [x, z] = at(a, r), s = 0.35 + 0.3 * (0.5 + 0.5 * Math.sin(i * 2.3));
    dummy.position.set(x, terrain.heightAt(x, z) + s * 0.12, z);
    dummy.rotation.set(0, i * 1.3, 0);
    dummy.scale.set(s * 1.4, s * 0.45, s);
    dummy.updateMatrix();
    lip.setMatrixAt(i, dummy.matrix);
  }
  lip.computeBoundingSphere();
  lip.name = 'Basin shore (salt lip)'; lip.userData.noCollide = true; root.add(lip);
}

/** Broad silhouettes and open space from the desert reference sheets. */
export function buildDesertVistas(scene, terrain) {
  const root = new THREE.Group(); root.name = 'Desert reference landmarks'; scene.add(root);
  const cream = makeMaterial({ color: '#efdfc7', flat: true });
  const blue = makeMaterial({ color: '#a9c4d1', flat: true, metal: 'painted' });
  const violet = makeMaterial({ color: '#b7a0bb', color2: '#a995b0', color3: '#d3bfd4', flat: true, mode: MODE_STRATA, strataSize: 7, cracks: 0.8 });   // (cracks down the cliffs' faces)
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
  // (seated in its cut, issue #200: the water under the crust's level, its sheet's edge inside the bank: BASIN_CUT)
  const waterY = terrain.heightAt(BASIN.x,BASIN.z) + BASIN_CUT.depth - BASIN_CUT.low;
  const water = mesh(new THREE.CircleGeometry(1,64).rotateX(-Math.PI/2), makeMaterial({color:'#69d3c6',color2:'#a3e4d5',mode:MODE_WATER,flat:true}),new THREE.Vector3(BASIN.x,waterY,BASIN.z));
  water.scale.set(BASIN.rx*BASIN_CUT.sheet,1,BASIN.rz*BASIN_CUT.sheet);water.userData.noCollide=true;
  buildBasinRim(root, terrain);
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
